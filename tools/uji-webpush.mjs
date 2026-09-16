/**
 * Uji webpush.js — tanpa jaringan, tanpa database.
 *
 *   node tools/uji-webpush.mjs
 *
 * Yang diperiksa:
 *   1. Enkripsi sama persis dengan contoh resmi RFC 8291 Lampiran A.
 *   2. Pesan yang dienkripsi bisa dibuka lagi dengan cara HP membukanya.
 *   3. Token VAPID sah menurut kunci publiknya, dan audiensnya asal layanan.
 *   4. Hanya alamat layanan notifikasi yang dikenal yang diterima.
 *   5. Teks Telegram berubah jadi judul + isi yang benar.
 */
import crypto from 'node:crypto';
import {
  buatKunciVapid, kunciVapidSah, tokenVapid, enkripsi, endpointSah, kunciLanggananSah, pesanUntukPush
} from '../webpush.js';
import { pesanPerluTtd, pesanBelumTtd } from '../telegram.js';

let lulus = 0, gagal = 0;
function cek(nama, benar, rinci) {
  if (benar) { lulus++; console.log('  ok   ' + nama); }
  else { gagal++; console.log('  GAGAL ' + nama + (rinci ? '\n        ' + rinci : '')); }
}
const b64u = (b) => Buffer.from(b).toString('base64url');
const dari = (s) => Buffer.from(s, 'base64url');

/** Buka badan aes128gcm seperti peramban: kunci privat HP + auth. */
function bukaSeperti(badan, uaEcdh, auth) {
  const salt = badan.subarray(0, 16);
  const idlen = badan[20];
  const asPublik = badan.subarray(21, 21 + idlen);
  const sandi = badan.subarray(21 + idlen);
  const uaPublik = uaEcdh.getPublicKey();
  const bersama = uaEcdh.computeSecret(asPublik);
  const hk = (ikm, g, info, n) => Buffer.from(crypto.hkdfSync('sha256', ikm, g, info, n));
  const ikm = hk(bersama, dari(auth), Buffer.concat([Buffer.from('WebPush: info\0'), uaPublik, asPublik]), 32);
  const cek = hk(ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hk(ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12);
  const d = crypto.createDecipheriv('aes-128-gcm', cek, nonce);
  d.setAuthTag(sandi.subarray(sandi.length - 16));
  const polos = Buffer.concat([d.update(sandi.subarray(0, sandi.length - 16)), d.final()]);
  let akhir = polos.length - 1;
  while (akhir >= 0 && polos[akhir] === 0) akhir--;
  if (polos[akhir] !== 2) throw new Error('pembatas rekaman bukan 0x02');
  return polos.subarray(0, akhir).toString('utf8');
}

console.log('\n1. Contoh resmi RFC 8291 Lampiran A');
{
  const as = crypto.createECDH('prime256v1');
  as.setPrivateKey(dari('yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw'));
  const uaPublik = 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4';
  const auth = 'BTBZMqHH6r4Tts7J_aSIgg';
  const hasil = enkripsi('When I grow up, I want to be a watermelon', uaPublik, auth,
    { salt: dari('DGv6ra1nlYgDCS1FRnbzlw'), ecdh: as });
  const harap = 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN';
  cek('badan terenkripsi sama dengan RFC', b64u(hasil) === harap, 'dapat ' + b64u(hasil));
  const ua = crypto.createECDH('prime256v1');
  ua.setPrivateKey(dari('q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94'));
  cek('kunci publik HP contoh cocok', b64u(ua.getPublicKey()) === uaPublik);
  cek('dibuka ulang jadi teks aslinya', bukaSeperti(hasil, ua, auth) === 'When I grow up, I want to be a watermelon');
}

console.log('\n2. Pesan acak dibuka seperti HP');
{
  const ua = crypto.createECDH('prime256v1'); ua.generateKeys();
  const auth = b64u(crypto.randomBytes(16));
  const teks = JSON.stringify({ judul: '🔔 Perlu tanda tangan Anda', isi: 'Logbook — JATSC\nUnit: Radtel' });
  const badan = enkripsi(teks, b64u(ua.getPublicKey()), auth);
  cek('isi kembali utuh (emoji & tanda pisah)', bukaSeperti(badan, ua, auth) === teks);
  const badan2 = enkripsi(teks, b64u(ua.getPublicKey()), auth);
  cek('tiap kiriman berbeda (garam & kunci sementara baru)', !badan.equals(badan2));
  let tolak = false;
  try { enkripsi('x', 'bukan-kunci', auth); } catch { tolak = true; }
  cek('kunci langganan rusak ditolak', tolak);
}

console.log('\n3. Token VAPID');
{
  const k = buatKunciVapid();
  cek('kunci baru sah', kunciVapidSah(k));
  cek('kunci rusak tidak sah', !kunciVapidSah({ publik: k.publik, privat: 'abc' }) && !kunciVapidSah({}));
  cek('kunci privat milik pasangan lain tidak sah', !kunciVapidSah({ publik: k.publik, privat: buatKunciVapid().privat }));
  const ep = 'https://fcm.googleapis.com/fcm/send/abc:def';
  const t = tokenVapid(ep, k, 'https://teknik-avengers.com', 1_800_000_000);
  const [h, p, s] = t.split('.');
  const muatan = JSON.parse(dari(p).toString());
  cek('audiens = asal layanan', muatan.aud === 'https://fcm.googleapis.com');
  cek('kedaluwarsa 12 jam', muatan.exp === 1_800_000_000 + 12 * 3600);
  cek('subjek terbawa', muatan.sub === 'https://teknik-avengers.com');
  cek('algoritma ES256', JSON.parse(dari(h).toString()).alg === 'ES256');
  const pub = dari(k.publik);
  const kunciPublik = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33)) }, format: 'jwk' });
  const sah = crypto.verify('sha256', Buffer.from(h + '.' + p), { key: kunciPublik, dsaEncoding: 'ieee-p1363' }, dari(s));
  cek('tanda tangan sah menurut kunci publik', sah);
  cek('tanda tangan 64 byte (r||s)', dari(s).length === 64);
}

console.log('\n4. Alamat layanan notifikasi');
cek('Google (Android/Chrome)', endpointSah('https://fcm.googleapis.com/fcm/send/xyz'));
cek('Apple (iPhone)', endpointSah('https://web.push.apple.com/QGx...'));
cek('Firefox', endpointSah('https://updates.push.services.mozilla.com/wpush/v2/abc'));
cek('http ditolak', !endpointSah('http://fcm.googleapis.com/fcm/send/xyz'));
cek('alamat dalam ditolak', !endpointSah('https://127.0.0.1:3000/internal/daftar'));
cek('domain tiruan ditolak', !endpointSah('https://fcm.googleapis.com.jahat.example/x'));
cek('akhiran tanpa titik ditolak', !endpointSah('https://evilpush.apple.com/x'));
cek('sampah ditolak', !endpointSah('bukan url') && !endpointSah(''));
cek('kunci langganan pendek ditolak', !kunciLanggananSah('BAAA', 'AAAA'));

console.log('\n5. Teks Telegram → notifikasi HP');
{
  const m = pesanUntukPush(pesanPerluTtd({
    dokumen: 'Logbook — JATSC', unit: 'Radtel', tanggal: '2026-09-15', pembuat: 'Bagus Wibowo',
    cuplikan: 'Terima dinas <M> & normal'
  }), { url: '/logbook/#kotak-ttd:::logbook-abc', tag: 'ttd-logbook-abc', tetap: true });
  cek('judul baris pertama tanpa tag HTML', m.judul === '🔔 Perlu tanda tangan Anda', m.judul);
  cek('isi memuat dokumen & pengirim', m.isi.includes('Dokumen: Logbook — JATSC') && m.isi.includes('Dikirim oleh: Bagus Wibowo'));
  cek('entitas HTML dikembalikan', m.isi.includes('Terima dinas <M> & normal'), m.isi);
  cek('baris "Buka E-Logbook" dibuang', !m.isi.includes('Buka E-Logbook'));
  cek('url & tag & tetap terbawa', m.url === '/logbook/#kotak-ttd:::logbook-abc' && m.tag === 'ttd-logbook-abc' && m.tetap === true);
  const b = pesanUntukPush(pesanBelumTtd({ dokumen: 'Daily Check', menunggu: 'Muhammad Deny Saputra', menit: 30 }));
  cek('pengingat belum TTD menyebut nama lengkap', b.isi.includes('Menunggu tanda tangan: Muhammad Deny Saputra'));
  cek('url luar ditolak jadi /', pesanUntukPush('x', { url: 'https://jahat.example' }).url === '/'
    && pesanUntukPush('x', { url: '//jahat.example' }).url === '/');
  cek('pesan kosong tetap berjudul', pesanUntukPush('').judul === 'Avengers');
}

console.log(`\n${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
