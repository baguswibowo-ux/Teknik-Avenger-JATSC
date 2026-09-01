/**
 * Pintu masuk untuk Vercel — SATU deploy untuk dua aplikasi.
 *
 * Dulu ada dua proyek Vercel: dashboard ini, dan E-Logbook sebagai proyek
 * terpisah (e-log-book-server). Dashboard meneruskan /api/*, /uploads, dan
 * /logbook/* ke sana lewat HTTP menyeberang domain — dan seluruh kerumitan
 * cookie lintas-subdomain di DEPLOY.md lahir dari situ.
 *
 * Di sini keduanya menyatu dalam satu fungsi. E-Logbook tetap app Express-nya
 * sendiri (halaman di "/", API di "/api"), tidak dipindah alamatnya. server.js
 * memanggilnya lewat fetch() ke satu alamat internal; fetch itu dicegat lalu
 * dijalankan LANGSUNG sebagai pemanggilan fungsi ke app E-Logbook — tanpa
 * socket, tanpa jaringan.
 *
 * === Kenapa pemanggilan fungsi langsung, bukan socket ===
 *
 * Dua transport bersocket sudah dicoba dan GAGAL di Vercel, keduanya
 * menggantung 30 detik lalu 500:
 *
 *  1. Loopback TCP (listen 127.0.0.1:port) — fetch ke 127.0.0.1 dari dalam
 *     fungsi yang sama tidak pernah tersambung.
 *  2. Socket domain Unix (listen /tmp/*.sock) — sama: http.request ke socket
 *     itu menggantung.
 *
 * Runtime Vercel tampaknya melarang fungsi menyambung ke socket yang
 * didengarnya sendiri — TCP maupun Unix. Yang tersisa: memanggil handler
 * Express-nya langsung dengan req/res buatan, tanpa socket sama sekali.
 *
 * === Kenapa req/res buatan sendiri, bukan light-my-request ===
 *
 * light-my-request (alat baku Fastify untuk ini) dicoba juga: ~seperempat
 * permintaan 500 di Vercel. Sebabnya, response palsunya melempar galat TAK
 * TERTANGKAP kalau ada yang menulis ke sana SETELAH ia usai — dan Express
 * memang kadang menulis lagi lewat finalhandler/on-finished sesudah respons
 * selesai. light-my-request membaca this._lightMyRequest.stream yang sudah
 * dibuang oleh destroy(), lalu meledak dan meracuni invocation-nya. Timing
 * tulisan-telat itu beda di Vercel, jadi tidak pernah muncul di komputer.
 *
 * res buatan di bawah kebal soal itu: write()/end() SETELAH selesai jadi
 * no-op yang aman, bukan galat. Karena murni pemanggilan fungsi (tanpa socket
 * maupun timer), perilakunya sama persis di komputer dan di Vercel.
 *
 * Berkas inilah satu-satunya yang tahu soal Vercel. server.js dan
 * elogbook/server.js tetap dua app Express biasa.
 */
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';

/* Alamat internal E-Logbook. Bukan alamat nyata — cuma penanda supaya fetch()
   di server.js bisa dikenali dan dialihkan. Harus URL yang sah: server.js
   sempat memanggil new URL(ASAL) untuk membaca port-nya. */
const ASAL_INTERNAL = 'http://elog.internal';

/* E-Logbook diimpor sebagai app Express biasa — app.listen() dan persiapan DB
   di dalamnya hanya berjalan kalau berkas itu DIJALANKAN LANGSUNG, jadi di sini
   ia cuma mengembalikan app-nya tanpa efek samping. */
const { default: elogApp } = await import('../elogbook/server.js');

/** Ubah headers apa pun (objek biasa atau Headers) jadi objek biasa berkunci huruf kecil. */
function keObjekHeaders(h) {
  const src = !h ? {} : (typeof h.entries === 'function' ? Object.fromEntries(h.entries()) : h);
  const out = {};
  for (const [k, v] of Object.entries(src)) {
    if (v != null) out[String(k).toLowerCase()] = v;
  }
  return out;
}

/**
 * Jalankan satu permintaan lewat app Express E-Logbook di dalam proses ini,
 * dengan req/res buatan, lalu bungkus hasilnya sebagai Response standar — bentuk
 * yang sama persis dengan yang dikembalikan fetch().
 */
function dispatchElog(url, init = {}) {
  const u = new URL(url);
  return new Promise((resolve, reject) => {
    /* Socket kosong hanya sebagai dasar objek — tidak pernah tersambung ke mana
       pun. IncomingMessage/ServerResponse butuh sesuatu di .socket; yang ini
       cukup, dan karena write/end di bawah ditimpa, tak ada byte yang benar-benar
       menyentuhnya. */
    const soket = new Socket();

    const req = new IncomingMessage(soket);
    req.method = (init.method || 'GET').toUpperCase();
    req.url = u.pathname + u.search;
    req.headers = keObjekHeaders(init.headers);
    req.httpVersion = '1.1';
    req.httpVersionMajor = 1;
    req.httpVersionMinor = 1;

    const res = new ServerResponse(req);
    res.assignSocket(soket);

    const potongan = [];
    let selesai = false;

    const tuntas = () => {
      if (selesai) return;
      selesai = true;
      const kepala = new Headers();
      const semua = res.getHeaders();
      for (const [nama, nilai] of Object.entries(semua)) {
        if (nilai == null) continue;
        // set-cookie datang sebagai array; di-append satu per satu supaya
        // getSetCookie() di server.js membacanya utuh.
        if (Array.isArray(nilai)) for (const v of nilai) kepala.append(nama, String(v));
        else kepala.append(nama, String(nilai));
      }
      resolve(new Response(Buffer.concat(potongan), { status: res.statusCode || 200, headers: kepala }));
    };

    const jadikanBuffer = (data, enc) =>
      data == null ? null : (Buffer.isBuffer(data) ? data : Buffer.from(data, enc || 'utf8'));

    /* Tangkap badan langsung dari argumen write/end, JANGAN lewat serialisasi
       ServerResponse ke soket. Tulisan SETELAH selesai jadi no-op — inilah yang
       membuatnya kebal terhadap tulisan-telat finalhandler yang meledakkan
       light-my-request. */
    res.write = function (data, enc, cb) {
      if (typeof enc === 'function') { cb = enc; enc = undefined; }
      if (!selesai) { const b = jadikanBuffer(data, enc); if (b && b.length) potongan.push(b); }
      if (typeof cb === 'function') cb();
      return true;
    };
    res.end = function (data, enc, cb) {
      if (typeof data === 'function') { cb = data; data = undefined; }
      else if (typeof enc === 'function') { cb = enc; enc = undefined; }
      if (!selesai) {
        const b = jadikanBuffer(data, enc);
        if (b && b.length) potongan.push(b);
      }
      if (typeof cb === 'function') cb();
      if (!selesai) {
        // Emit supaya penyimak on-finished/stream.finished Express jalan, LALU
        // tuntaskan. Dibungkus try supaya penyimak yang melempar tidak menggagalkan
        // pembungkusan respons yang sudah lengkap.
        try { res.emit('finish'); } catch { /* penyimak bermasalah: diabaikan */ }
        try { res.emit('close'); } catch { /* idem */ }
      }
      tuntas();
      return res;
    };

    // Badan permintaan (POST dsb.) disuapkan lalu ditutup supaya body-parser jalan.
    const badan = jadikanBuffer(init.body);
    if (badan && badan.length) req.push(badan);
    req.push(null);

    try {
      elogApp(req, res);
    } catch (e) {
      if (!selesai) reject(e);
    }
  });
}

/* Cegat fetch HANYA untuk alamat internal; sisanya (mis. Supabase) lewat apa
   adanya. Dipasang sebelum server.js diimpor supaya sudah berlaku saat
   permintaan pertama datang. */
const fetchAsli = globalThis.fetch;
globalThis.fetch = function (input, init) {
  const url = typeof input === 'string' ? input : (input && input.url) || '';
  if (url.startsWith(ASAL_INTERNAL)) return dispatchElog(url, init);
  return fetchAsli.call(this, input, init);
};

/* Jaring pengaman terakhir: kalau ada galat tak tertangkap yang lolos dari
   penyimak respons (bukan dari alur normal di atas), catat saja — jangan biarkan
   satu galat latar mematikan seluruh fungsi dan menjatuhkan permintaan yang tak
   bersalah. */
process.on('uncaughtException', (e) => {
  console.error('[gabung] uncaughtException diabaikan:', e && e.stack || e);
});

/* server.js membaca ELOGBOOK_ASAL sekali saat modul dimuat, jadi alamat
   internal harus sudah terpasang di env lebih dulu. */
process.env.ELOGBOOK_ASAL = ASAL_INTERNAL;

export default (await import('../server.js')).default;
