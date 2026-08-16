/**
 * DASHBOARD FASILITAS TEKNIK JATSC — "AVENGER"
 *
 * Aplikasi berdiri sendiri. Halamannya disajikan dari public/, dan yang sudah
 * jadi di E-Logbook TIDAK ditulis ulang di sini: setiap permintaan ke /api/*
 * diteruskan apa adanya ke server E-Logbook yang sudah jalan.
 *
 * Kenapa diteruskan, bukan dipanggil langsung dari halaman:
 * halaman ini disajikan dari localhost:3100, E-Logbook hidup di localhost:3000.
 * Bagi browser itu dua asal yang berbeda — fetch lintas asal akan ditolak, dan
 * cookie sesinya tidak ikut terkirim. Dengan diteruskan lewat server ini,
 * bagi browser semuanya tetap satu asal, jadi blok "Jembatan E-Logbook" di
 * public/index.html jalan apa adanya tanpa satu baris pun diubah.
 *
 * E-LogBook-Server tidak pernah disunting dari sini. Yang dipakai hanya API-nya.
 *
 * Jalankan:  npm start
 * Setelan lewat environment variable (semuanya boleh dikosongkan):
 *   PORT             port HTTP aplikasi ini            (bawaan 3100)
 *   HOST             alamat bind                       (bawaan 0.0.0.0)
 *   ELOGBOOK_ASAL    alamat server E-Logbook           (bawaan http://127.0.0.1:3000)
 *   ELOGBOOK_MATI    set 1 untuk mematikan penerusan   (halaman jatuh ke data contoh)
 */

import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

try { process.loadEnvFile?.(); } catch { /* tidak ada .env: pakai bawaan */ }

const ROOT = path.dirname(fileURLToPath(import.meta.url));

const PORT  = Number(process.env.PORT || 3100);
const HOST  = process.env.HOST || '0.0.0.0';
const ASAL  = (process.env.ELOGBOOK_ASAL || 'http://127.0.0.1:3000').replace(/\/+$/, '');
const TERUS = process.env.ELOGBOOK_MATI !== '1';

const app = express();
app.disable('x-powered-by');

/* =====================================================================
   PENERUSAN KE E-LOGBOOK

   Dipasang sebelum apa pun yang membaca badan permintaan. express.json()
   akan menghabiskan aliran badannya, dan yang tersisa untuk diteruskan
   tinggal permintaan kosong — karena itu badannya dikumpulkan sendiri
   sebagai byte mentah dan dikirim ulang persis seperti datangnya.

   Batas 80 MB menyamai batas di E-Logbook: lampiran dikirim sebagai base64
   di dalam badan permintaan, dan batas bawaan Express (100 kb) jauh dari cukup.
   ===================================================================== */

const JALUR_TERUS = ['/api', '/uploads'];

/** Kepala yang tidak boleh ikut diteruskan: hop-by-hop, atau diisi ulang oleh fetch. */
const KEPALA_DIBUANG = new Set([
  'host', 'connection', 'keep-alive', 'transfer-encoding', 'upgrade',
  'proxy-authorization', 'proxy-connection', 'te', 'trailer',
  'content-length', 'accept-encoding'
]);

const badanMentah = express.raw({ type: () => true, limit: '80mb' });

async function teruskan(req, res) {
  if (!TERUS) {
    return res.status(503).json({ error: 'Penerusan ke E-Logbook dimatikan (ELOGBOOK_MATI=1).' });
  }

  const kepala = {};
  for (const [nama, nilai] of Object.entries(req.headers)) {
    if (!KEPALA_DIBUANG.has(nama.toLowerCase())) kepala[nama] = nilai;
  }

  const punyaBadan = req.method !== 'GET' && req.method !== 'HEAD';
  const badan = punyaBadan && Buffer.isBuffer(req.body) && req.body.length ? req.body : undefined;

  // Batas waktu supaya server E-Logbook yang menggantung tidak ikut
  // menggantungkan aplikasi ini. 30 detik: getAllData lintas unit memang lambat.
  const henti = AbortSignal.timeout(30_000);

  let jawab;
  try {
    jawab = await fetch(ASAL + req.originalUrl, {
      method: req.method,
      headers: kepala,
      body: badan,
      redirect: 'manual',
      signal: henti
    });
  } catch (e) {
    // Halaman menganggap "bukan JSON" sebagai "server tidak ada", lalu jatuh ke
    // data contoh dengan sendirinya. Jawaban JSON di sini justru membuatnya
    // mengira servernya ada tapi rusak — jadi sengaja dibiarkan polos.
    const sebab = e?.name === 'TimeoutError' ? 'tidak menjawab dalam 30 detik' : (e?.message || e);
    console.warn(`[teruskan] ${req.method} ${req.originalUrl} → ${ASAL} gagal: ${sebab}`);
    return res.status(502).type('text/plain')
      .send(`E-Logbook di ${ASAL} tidak terjangkau: ${sebab}`);
  }

  res.status(jawab.status);
  jawab.headers.forEach((nilai, nama) => {
    const n = nama.toLowerCase();
    if (n === 'content-encoding' || n === 'content-length' || n === 'transfer-encoding') return;
    // set-cookie harus lewat getSetCookie(): forEach menggabung beberapa cookie
    // jadi satu baris berkoma, dan browser membacanya sebagai satu cookie rusak.
    if (n === 'set-cookie') return;
    res.setHeader(nama, nilai);
  });
  const cookie = jawab.headers.getSetCookie?.() || [];
  if (cookie.length) res.setHeader('Set-Cookie', cookie);

  const isi = Buffer.from(await jawab.arrayBuffer());
  res.end(isi);
}

for (const jalur of JALUR_TERUS) {
  app.use(jalur, badanMentah, teruskan);
}

/* =====================================================================
   HALAMAN
   ===================================================================== */

app.get('/_info', (_req, res) => {
  res.json({
    aplikasi: 'Dashboard Fasilitas Teknik JATSC (Avenger)',
    versi: process.env.npm_package_version || '0.1.0',
    port: PORT,
    elogbook: TERUS ? ASAL : null
  });
});

app.use(express.static(path.join(ROOT, 'public'), { extensions: ['html'] }));

/* =====================================================================
   START
   ===================================================================== */

app.listen(PORT, HOST, () => {
  console.log(`Dashboard Fasilitas Teknik JATSC — http://localhost:${PORT}`);
  console.log(TERUS
    ? `Data E-Logbook diteruskan ke ${ASAL}`
    : 'Penerusan E-Logbook dimatikan — halaman memakai data contoh.');
});
