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
 * dijalankan ke E-Logbook di dalam proses yang sama.
 *
 * Transportnya: SOCKET DOMAIN UNIX. E-Logbook dinyalakan sebagai http.Server
 * biasa yang mendengar di sebuah berkas socket di /tmp, dan permintaan internal
 * dikirim ke situ lewat node:http. Ini HTTP sungguhan — req dan res asli di
 * kedua ujung — tapi lewat berkas socket, bukan jaringan.
 *
 * Kenapa bukan yang lain, keduanya sudah dicoba dan gagal di Vercel:
 *
 *  1. Server loopback TCP (listen 127.0.0.1:port): fungsinya boot, tapi fetch
 *     ke 127.0.0.1 dari dalam fungsi yang sama tidak pernah tersambung —
 *     tiap permintaan menggantung 30 detik lalu 500. Runtime Vercel tampaknya
 *     menutup antarmuka loopback jaringan. Socket domain Unix bukan jaringan
 *     (ia berkas), jadi lolos dari batasan itu.
 *
 *  2. Dispatch mock lewat light-my-request (menyuntik req/res palsu ke handler
 *     tanpa socket): ~seperempat permintaan 500. Response palsunya melempar
 *     galat TAK TERTANGKAP saat on-finished Express menulis ke sana setelah ia
 *     usai (light-my-request/lib/response.js: undefined 'stream'), dan galat
 *     tak tertangkap itu meracuni invocation-nya. req/res asli lewat socket
 *     tidak punya daur hidup rapuh itu.
 *
 * Berkas inilah satu-satunya yang tahu soal Vercel. server.js dan
 * elogbook/server.js tetap dua app Express biasa yang tidak tahu di mana
 * mereka dijalankan.
 */
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

/* Alamat internal E-Logbook. Bukan alamat nyata — cuma penanda supaya fetch()
   di server.js bisa dikenali dan dialihkan ke socket. Harus URL yang sah:
   server.js sempat memanggil new URL(ASAL) untuk membaca port-nya. */
const ASAL_INTERNAL = 'http://elog.internal';

/* E-Logbook diimpor sebagai app Express biasa — app.listen() dan persiapan DB
   di dalamnya hanya berjalan kalau berkas itu DIJALANKAN LANGSUNG, jadi di sini
   ia cuma mengembalikan app-nya tanpa efek samping. */
const { default: elogApp } = await import('../elogbook/server.js');

/* Nyalakan E-Logbook di socket domain Unix, sekali per cold-start. Nama berkasnya
   diberi pid + waktu supaya dua wadah yang berbagi disk (jarang, tapi mungkin)
   tidak berebut berkas yang sama.

   Di Vercel (Linux) ini berkas di /tmp. Di Windows AF_UNIX lewat jalur berkas
   tidak didukung Node — ia memakai named pipe (\\.\pipe\...) — jadi dipilih
   sesuai platform. Yang berlaku di produksi selalu cabang Linux; cabang Windows
   hanya supaya uji lokal bisa jalan (di kantor pemakaian sebenarnya lewat
   jalankan-semua.js, dua proses, bukan berkas ini). */
const NAMA_SOCKET = `elog-${process.pid}-${Date.now()}.sock`;
const JALUR_SOCKET = process.platform === 'win32'
  ? `\\\\.\\pipe\\${NAMA_SOCKET}`
  : path.join(os.tmpdir(), NAMA_SOCKET);
const serverElog = http.createServer(elogApp);
await new Promise((selesai, gagal) => {
  serverElog.once('error', gagal);
  serverElog.listen(JALUR_SOCKET, selesai);
});

/** Ubah headers apa pun (objek biasa atau Headers) jadi objek biasa untuk node:http. */
function keObjekHeaders(h) {
  if (!h) return {};
  if (typeof h.entries === 'function') return Object.fromEntries(h.entries());
  return h;
}

/**
 * Kirim satu permintaan ke E-Logbook lewat socket, kembalikan Response standar —
 * bentuk yang sama persis dengan yang dikembalikan fetch(), supaya kode
 * penerusan di server.js tidak perlu tahu transportnya bukan jaringan.
 */
function dispatchElog(url, init = {}) {
  const u = new URL(url);
  return new Promise((resolve, reject) => {
    const permintaan = http.request(
      {
        socketPath: JALUR_SOCKET,
        method: init.method || 'GET',
        path: u.pathname + u.search,
        headers: keObjekHeaders(init.headers),
      },
      (res) => {
        const potongan = [];
        res.on('data', (c) => potongan.push(c));
        res.on('end', () => {
          const kepala = new Headers();
          for (const [nama, nilai] of Object.entries(res.headers)) {
            if (nilai == null) continue;
            // set-cookie datang sebagai array dari node:http; di-append satu per
            // satu supaya getSetCookie() di server.js membacanya utuh.
            if (Array.isArray(nilai)) for (const v of nilai) kepala.append(nama, String(v));
            else kepala.append(nama, String(nilai));
          }
          resolve(new Response(Buffer.concat(potongan), { status: res.statusCode, headers: kepala }));
        });
        res.on('error', reject);
      }
    );
    permintaan.on('error', reject);
    if (init.body != null) permintaan.write(init.body);
    permintaan.end();
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

/* server.js membaca ELOGBOOK_ASAL sekali saat modul dimuat, jadi alamat
   internal harus sudah terpasang di env lebih dulu. */
process.env.ELOGBOOK_ASAL = ASAL_INTERNAL;

export default (await import('../server.js')).default;
