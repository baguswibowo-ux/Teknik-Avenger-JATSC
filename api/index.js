/**
 * Pintu masuk untuk Vercel — SATU deploy untuk dua aplikasi.
 *
 * Dulu ada dua proyek Vercel: dashboard ini, dan E-Logbook sebagai proyek
 * terpisah (e-log-book-server). Dashboard meneruskan /api/*, /uploads, dan
 * /logbook/* ke sana lewat HTTP menyeberang domain — dan seluruh kerumitan
 * cookie lintas-subdomain di DEPLOY.md lahir dari situ.
 *
 * Di sini keduanya menyatu dalam satu fungsi. Persis seperti di komputer
 * kantor (lihat jalankan-semua.js): E-Logbook dinyalakan sebagai server
 * loopback internal di 127.0.0.1, dan ELOGBOOK_ASAL menunjuk ke sana. Kode
 * penerusan di server.js tidak berubah sedikit pun — hanya TUJUAN-nya yang
 * pindah dari e-log-book-server.vercel.app ke loopback dalam proses yang sama.
 *
 * Kenapa server loopback, bukan menumpuk dua app Express jadi satu:
 * E-Logbook menyajikan halamannya di akar "/" dan API-nya di "/api", persis
 * seperti dashboard. Menumpuknya berarti salah satu harus pindah alamat, dan
 * itu menyunting E-Logbook untuk alasan yang bukan permintaan siapa pun. Server
 * loopback membiarkan E-Logbook tetap di alamatnya sendiri — cuma satu proses,
 * bukan satu deploy. Alasan yang sama dengan komentar di jalankan-semua.js.
 *
 * Berkas inilah satu-satunya yang tahu soal Vercel. server.js dan
 * elogbook/server.js tetap dua app Express biasa yang tidak tahu di mana
 * mereka dijalankan.
 */
import http from 'node:http';

/* E-Logbook diimpor sebagai app Express biasa — app.listen() dan persiapan
   DB di dalamnya hanya berjalan kalau berkas itu DIJALANKAN LANGSUNG, jadi di
   sini ia cuma mengembalikan app-nya tanpa efek samping. */
const { default: elogApp } = await import('../elogbook/server.js');

/* Nyalakan E-Logbook di port loopback internal, sekali per cold-start. Port 0
   berarti "pilihkan port bebas mana pun" — tidak ada yang perlu menebaknya,
   karena hanya proses ini yang memanggilnya. */
try {
  const srv = http.createServer(elogApp);
  await new Promise((selesai, gagal) => {
    srv.once('error', gagal);
    srv.listen(0, '127.0.0.1', selesai);
  });
  const port = srv.address().port;
  process.env.ELOGBOOK_ASAL = `http://127.0.0.1:${port}`;
  console.log(`[gabung] E-Logbook internal siap di ${process.env.ELOGBOOK_ASAL}`);
} catch (e) {
  /* Kalau loopback gagal naik, JANGAN timpa ELOGBOOK_ASAL: biarkan nilai env
     yang ada (mis. alamat E-Logbook lama) tetap berlaku sebagai jaring pengaman.
     Kalau tidak ada pun, penerusan akan menjawab 502 dengan pesan jelas —
     bukan fungsi yang gagal boot sama sekali. */
  console.error('[gabung] E-Logbook internal gagal naik, pakai ELOGBOOK_ASAL yang ada:', e && e.message || e);
}

/* Baru sekarang server.js diimpor: ia membaca ELOGBOOK_ASAL sekali saat modul
   dimuat, jadi nilai di atas harus sudah terpasang lebih dulu. */
export default (await import('../server.js')).default;
