/**
 * NOTIFIKASI HP (WEB PUSH) — pengirim tanpa pustaka tambahan
 *
 * Saudara telegram.js: yang itu mengirim ke chat Telegram, yang ini ke HP yang
 * sudah menekan "Aktifkan notifikasi" di dashboard. Isi pesannya sengaja sama —
 * teks Telegram (HTML) diubah jadi judul + isi oleh pesanUntukPush(), jadi
 * kalimatnya tetap disusun di satu tempat.
 *
 * Dua standar yang dikerjakan di sini, dua-duanya cukup dengan node:crypto:
 *   RFC 8292  VAPID   — server membuktikan dirinya ke layanan notifikasi
 *                       (Google untuk Android/Chrome, Apple untuk iPhone) dengan
 *                       token ES256 yang ditandatangani kunci privat server.
 *   RFC 8291  aes128gcm — isi pesan dienkripsi untuk satu HP saja; layanan
 *                       notifikasinya sendiri tidak bisa membacanya.
 *
 * Tidak ada `web-push` dari npm: proyek ini sengaja hanya bergantung pada
 * express dan pg, dan dua standar di atas cuma butuh ~100 baris. Ujinya
 * (enkripsi dibuka ulang seperti HP membukanya, tanda tangan VAPID diperiksa)
 * di tools/uji-webpush.mjs.
 */
import crypto from 'node:crypto';

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const dariB64u = (s) => Buffer.from(String(s || ''), 'base64url');

/* ============== KUNCI VAPID ============== */

/** Sepasang kunci baru: publik 65 byte (titik P-256 tak termampatkan) dan
    privat 32 byte, keduanya base64url — bentuk yang dipakai peramban. */
export function buatKunciVapid() {
  const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = privateKey.export({ format: 'jwk' });
  return {
    publik: b64u(Buffer.concat([Buffer.from([4]), dariB64u(jwk.x), dariB64u(jwk.y)])),
    privat: jwk.d
  };
}

function kunciPrivat({ publik, privat }) {
  const p = dariB64u(publik);
  return crypto.createPrivateKey({
    key: { kty: 'EC', crv: 'P-256', x: b64u(p.subarray(1, 33)), y: b64u(p.subarray(33, 65)), d: privat },
    format: 'jwk'
  });
}

export function kunciVapidSah(k) {
  try {
    const p = dariB64u(k && k.publik);
    if (p.length !== 65 || p[0] !== 4 || dariB64u(k.privat).length !== 32) return false;
    // Kunci privat harus benar-benar pasangan kunci publiknya: yang tidak
    // berpasangan tetap bisa menandatangani, tapi semua kiriman ditolak 403.
    // Dihitung ulang dari bagian privatnya saja: kunci JWK memakai x,y yang
    // diberikan apa adanya tanpa memeriksa kecocokannya.
    const ec = crypto.createECDH('prime256v1');
    ec.setPrivateKey(dariB64u(k.privat));
    return ec.getPublicKey().equals(p);
  } catch {
    return false;
  }
}

/** Token VAPID untuk satu alamat layanan notifikasi. `subjek` wajib mailto:
    atau https: — Apple menolak selain itu. Berlaku 12 jam (batasnya 24). */
export function tokenVapid(endpoint, kunci, subjek, kiniDetik = Math.floor(Date.now() / 1000)) {
  const kepala = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const isi = b64u(JSON.stringify({ aud: new URL(endpoint).origin, exp: kiniDetik + 12 * 3600, sub: subjek }));
  const data = kepala + '.' + isi;
  const ttd = crypto.sign('sha256', Buffer.from(data), { key: kunciPrivat(kunci), dsaEncoding: 'ieee-p1363' });
  return data + '.' + b64u(ttd);
}

/* ============== LANGGANAN DARI PERAMBAN ============== */

/* Hanya layanan notifikasi yang dikenal. Alamat langganan dikirim peramban,
   jadi tanpa daftar ini akun mana pun bisa menyuruh server mengirim POST ke
   alamat sembarang — termasuk ke dalam jaringan kantor sendiri. */
const LAYANAN_PUSH = [
  'fcm.googleapis.com', 'android.googleapis.com',   // Chrome, Android, Edge baru
  'push.apple.com',                                 // Safari & iPhone (web.push.apple.com)
  'push.services.mozilla.com',                      // Firefox
  'notify.windows.com'                              // Edge lama di Windows
];

export function endpointSah(endpoint) {
  try {
    const u = new URL(String(endpoint || ''));
    if (u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase();
    return LAYANAN_PUSH.some((d) => host === d || host.endsWith('.' + d));
  } catch {
    return false;
  }
}

export function kunciLanggananSah(p256dh, auth) {
  const p = dariB64u(p256dh);
  return p.length === 65 && p[0] === 4 && dariB64u(auth).length >= 16;
}

/* ============== ENKRIPSI (RFC 8291) ============== */

/** Isi pesan terenkripsi untuk satu langganan, siap jadi badan POST.
    `salt` dan `ecdh` hanya diisi oleh uji. */
export function enkripsi(teks, p256dh, auth, { salt = crypto.randomBytes(16), ecdh = null } = {}) {
  const uaPublik = dariB64u(p256dh);
  const rahasia = dariB64u(auth);
  if (!kunciLanggananSah(p256dh, auth)) throw new Error('Kunci langganan tidak sah.');

  const ec = ecdh || crypto.createECDH('prime256v1');
  if (!ecdh) ec.generateKeys();
  const asPublik = ec.getPublicKey();
  const bersama = ec.computeSecret(uaPublik);

  // hkdfSync = HKDF-Extract(salt, ikm) lalu HKDF-Expand(info) — persis dua
  // langkah yang ditulis RFC 8291 §3.3 dan §3.4.
  const hk = (ikm, garam, info, n) => Buffer.from(crypto.hkdfSync('sha256', ikm, garam, info, n));
  const ikm = hk(bersama, rahasia, Buffer.concat([Buffer.from('WebPush: info\0'), uaPublik, asPublik]), 32);
  const cek = hk(ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hk(ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12);

  const sandi = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  // 0x02 = pembatas rekaman terakhir (dan satu-satunya).
  const isi = Buffer.concat([
    sandi.update(Buffer.concat([Buffer.from(String(teks), 'utf8'), Buffer.from([2])])),
    sandi.final(),
    sandi.getAuthTag()
  ]);

  const kepala = Buffer.alloc(21);
  salt.copy(kepala, 0);
  kepala.writeUInt32BE(4096, 16);   // rs
  kepala[20] = asPublik.length;     // idlen = 65
  return Buffer.concat([kepala, asPublik, isi]);
}

/* ============== KIRIM ============== */

/**
 * Kirim satu pesan ke satu langganan { endpoint, p256dh, auth }.
 * `muatan` objek { judul, isi, url, tag, tetap } — dibaca sw.js di peramban.
 * → { ok, status, hilang }. hilang = HP itu sudah mencabut langganannya
 *   (404/410): baris langganannya boleh dibuang.
 */
export async function kirimPush(langganan, muatan, kunci, { subjek, ttl = 24 * 3600, urgensi = 'high' } = {}) {
  try {
    const badan = enkripsi(JSON.stringify(muatan), langganan.p256dh, langganan.auth);
    const jawab = await fetch(langganan.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `vapid t=${tokenVapid(langganan.endpoint, kunci, subjek)}, k=${kunci.publik}`,
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: String(ttl),
        Urgency: urgensi
      },
      body: badan,
      signal: AbortSignal.timeout(15000)
    });
    return { ok: jawab.ok, status: jawab.status, hilang: jawab.status === 404 || jawab.status === 410 };
  } catch (err) {
    return { ok: false, status: 0, hilang: false, galat: err?.message || String(err) };
  }
}

/* ============== TEKS ============== */

const lepasHtml = (s) => String(s == null ? '' : s)
  .replace(/<[^>]*>/g, '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&amp;/g, '&');

/**
 * Pesan Telegram (HTML, baris dipisah \n) → muatan notifikasi HP.
 * Baris pertama jadi judul, sisanya isi. Baris "Buka E-Logbook → …" dibuang:
 * di HP, mengetuk notifikasinya sendiri yang membuka tempatnya.
 */
export function pesanUntukPush(html, { url = '/', tag = '', tetap = false } = {}) {
  const baris = lepasHtml(html).split('\n').map((x) => x.trim()).filter(Boolean)
    .filter((x) => !/^Buka E-Logbook\b/i.test(x));
  const isi = baris.slice(1).join('\n');
  return {
    judul: (baris[0] || 'Avengers').slice(0, 120),
    isi: isi.length > 700 ? isi.slice(0, 699) + '…' : isi,
    url: /^\/(?!\/)/.test(String(url)) ? String(url) : '/',
    tag: String(tag || '').slice(0, 120),
    tetap: !!tetap
  };
}
