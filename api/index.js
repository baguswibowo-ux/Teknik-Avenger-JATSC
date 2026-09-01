/**
 * Pintu masuk untuk Vercel — SATU deploy untuk dua aplikasi.
 *
 * Dulu ada dua proyek Vercel: dashboard ini, dan E-Logbook sebagai proyek
 * terpisah (e-log-book-server). Dashboard meneruskan /api/*, /uploads, dan
 * /logbook/* ke sana lewat HTTP menyeberang domain — dan seluruh kerumitan
 * cookie lintas-subdomain di DEPLOY.md lahir dari situ.
 *
 * Di sini keduanya menyatu dalam satu fungsi. E-Logbook tetap app Express-nya
 * sendiri (halaman di "/", API di "/api"), tidak dipindah alamatnya — tapi
 * penerusan tidak lagi lewat jaringan. server.js memanggilnya lewat fetch()
 * ke satu alamat internal, dan di sini fetch itu dicegat lalu dijalankan
 * LANGSUNG di dalam proses ini, tanpa socket sama sekali.
 *
 * Kenapa bukan server loopback (http.createServer + listen 127.0.0.1):
 * itu SUDAH DICOBA dan gagal di Vercel. Fungsinya boot normal — servernya
 * ter-bind dan dapat port — tapi fetch('http://127.0.0.1:port') dari dalam
 * fungsi yang sama tidak pernah tersambung: tiap permintaan yang diteruskan
 * menggantung sampai batas 30 detik lalu 500. Runtime Vercel tampaknya tidak
 * mengizinkan fungsi menyambung ke server loopback yang dinyalakannya sendiri.
 *
 * Dispatch in-process tidak menyentuh jaringan sama sekali, jadi kebal soal
 * itu: kalau lolos di komputer, ia lolos di Vercel dengan alasan yang sama —
 * hanya panggilan fungsi Express biasa. light-my-request adalah alat baku
 * untuk menyuntik permintaan ke handler Node tanpa socket (dipakai Fastify).
 *
 * Berkas inilah satu-satunya yang tahu soal Vercel. server.js dan
 * elogbook/server.js tetap dua app Express biasa yang tidak tahu di mana
 * mereka dijalankan.
 */
import inject from 'light-my-request';

/* Alamat internal E-Logbook. Bukan alamat nyata — cuma penanda supaya fetch()
   di server.js bisa dikenali dan dialihkan ke dispatch in-process. Harus URL
   yang sah: server.js sempat memanggil new URL(ASAL) untuk membaca port-nya. */
const ASAL_INTERNAL = 'http://elog.internal';

/* E-Logbook diimpor sebagai app Express biasa — app.listen() dan persiapan DB
   di dalamnya hanya berjalan kalau berkas itu DIJALANKAN LANGSUNG, jadi di sini
   ia cuma mengembalikan app-nya tanpa efek samping. */
const { default: elogApp } = await import('../elogbook/server.js');

/** Ubah headers apa pun (objek biasa atau Headers) jadi objek biasa untuk inject. */
function keObjekHeaders(h) {
  if (!h) return {};
  if (typeof h.entries === 'function') return Object.fromEntries(h.entries());
  return h;
}

/**
 * Jalankan satu permintaan lewat app Express E-Logbook di dalam proses ini,
 * lalu bungkus hasilnya sebagai Response standar — bentuk yang sama persis
 * dengan yang dikembalikan fetch(), supaya kode penerusan di server.js tidak
 * perlu tahu bahwa transportnya sudah bukan jaringan.
 */
async function dispatchElog(url, init = {}) {
  const jalur = url.slice(ASAL_INTERNAL.length) || '/';
  const res = await inject(elogApp, {
    method: init.method || 'GET',
    url: jalur.startsWith('/') ? jalur : '/' + jalur,
    headers: keObjekHeaders(init.headers),
    // body fetch berupa Buffer/string; inject menerima keduanya sebagai payload.
    payload: init.body,
  });

  /* Susun ulang headers. set-cookie sengaja di-append satu per satu: E-Logbook
     bisa memasang lebih dari satu, dan server.js membacanya kembali lewat
     getSetCookie() — bukan forEach yang menggabungnya jadi satu baris rusak. */
  const kepala = new Headers();
  for (const [nama, nilai] of Object.entries(res.headers)) {
    if (nilai == null) continue;
    if (Array.isArray(nilai)) for (const v of nilai) kepala.append(nama, String(v));
    else kepala.append(nama, String(nilai));
  }
  return new Response(res.rawPayload, { status: res.statusCode, headers: kepala });
}

/* Cegat fetch HANYA untuk alamat internal; sisanya (mis. Supabase) lewat apa
   adanya. Dipasang sebelum server.js diimpor supaya ia sudah berlaku saat
   permintaan pertama datang. */
const fetchAsli = globalThis.fetch;
globalThis.fetch = function (input, init) {
  const url = typeof input === 'string' ? input : (input && input.url) || '';
  if (url.startsWith(ASAL_INTERNAL)) return dispatchElog(url, init);
  return fetchAsli.call(this, input, init);
};

/* server.js membaca ELOGBOOK_ASAL sekali saat modul dimuat, jadi alamat
   internal harus sudah terpasang di env lebih dulu. */
process.env.ELOGBOOK_ASAL = ASAL_INTERNAL;

export default (await import('../server.js')).default;
