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
import fs from 'node:fs/promises';
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
   GALERI FOTO — satu-satunya bagian yang menulis ke disk

   Foto tersimpan di public/foto/<unit>/, keterangannya di
   public/foto/daftar.json. Keduanya bersebelahan dan ikut masuk git, jadi
   memindahkan proyek ini tidak pernah memisahkan foto dari keterangannya.

   Modul galeri belum ada di E-Logbook, jadi ini benar-benar milik aplikasi
   ini — bukan sesuatu yang nanti diambil dari sana.

   Berkasnya dikirim sebagai base64 di dalam JSON, bentuk yang sama dengan
   lampiran di E-Logbook. Tidak perlu pengurai multipart, dan satu bentuk
   badan permintaan untuk seluruh aplikasi.
   ===================================================================== */

const FOTO_DIR   = path.join(ROOT, 'public', 'foto');
const FOTO_JSON  = path.join(FOTO_DIR, 'daftar.json');
const FOTO_BATAS = 15 * 1024 * 1024;   // per berkas, sebelum base64
const FOTO_EXT   = new Set(['.jpg', '.jpeg', '.png', '.webp']);

/** Kode unit dipakai sebagai nama folder — hanya huruf dan angka yang boleh. */
const unitSah = (u) => /^[a-z0-9]{2,32}$/.test(String(u || ''));

/**
 * Nama berkas datang dari klien, jadi tidak boleh dipercaya: `../` di dalamnya
 * cukup untuk menulis ke mana saja di disk. basename() memotong seluruh jalur,
 * lalu daftar putih karakter menutup sisanya.
 */
function berkasSah(nama) {
  const n = path.basename(String(nama || '')).trim();
  if (!n || n.length > 120) return '';
  if (!/^[A-Za-z0-9._-]+$/.test(n)) return '';
  if (!FOTO_EXT.has(path.extname(n).toLowerCase())) return '';
  return n;
}

async function bacaDaftar() {
  try {
    return JSON.parse(await fs.readFile(FOTO_JSON, 'utf8'));
  } catch {
    return {};   // belum ada, atau rusak: mulai dari kosong
  }
}

/**
 * Tulis lewat berkas sementara lalu rename. rename di dalam satu volume
 * bersifat atomik, jadi daftar.json tidak pernah tertangkap separuh tertulis
 * kalau prosesnya mati di tengah jalan.
 */
async function tulisDaftar(daftar) {
  const sementara = FOTO_JSON + '.tmp';
  await fs.writeFile(sementara, JSON.stringify(daftar, null, 2) + '\n', 'utf8');
  await fs.rename(sementara, FOTO_JSON);
}

const badanGaleri = express.json({ limit: '60mb' });

app.post('/galeri/:unit', badanGaleri, async (req, res) => {
  const unit = String(req.params.unit || '').toLowerCase();
  if (!unitSah(unit)) return res.status(400).json({ error: 'Kode unit tidak sah.' });

  const nama = berkasSah(req.body?.berkas);
  if (!nama) return res.status(400).json({ error: 'Nama berkas tidak sah — harus .jpg, .jpeg, .png, atau .webp.' });

  const isi = Buffer.from(String(req.body?.isi || ''), 'base64');
  if (!isi.length) return res.status(400).json({ error: 'Isi berkas kosong.' });
  if (isi.length > FOTO_BATAS) {
    return res.status(413).json({ error: `Berkas lebih dari ${Math.round(FOTO_BATAS / 1024 / 1024)} MB.` });
  }

  try {
    await fs.mkdir(path.join(FOTO_DIR, unit), { recursive: true });
    await fs.writeFile(path.join(FOTO_DIR, unit, nama), isi);

    const daftar = await bacaDaftar();
    const isiUnit = daftar[unit] || (daftar[unit] = []);
    const lama = isiUnit.find(f => f.berkas === nama);
    const entri = {
      berkas: nama,
      tgl: /^\d{4}-\d{2}-\d{2}$/.test(req.body?.tgl || '') ? req.body.tgl : '',
      ket: String(req.body?.ket || '').slice(0, 400)
    };
    // Mengunggah ulang berkas dengan nama yang sama mengisi entri yang sudah
    // ada, tidak menambah entri kembar. Keterangan lama dipertahankan kalau
    // yang baru dikirim kosong — mengganti berkas bukan berarti membuang
    // keterangan yang sudah ditulis dengan susah payah.
    if (lama) {
      lama.tgl = entri.tgl || lama.tgl;
      lama.ket = entri.ket || lama.ket;
    } else {
      isiUnit.push(entri);
    }
    await tulisDaftar(daftar);

    res.json({ ok: true, berkas: nama, jumlah: isiUnit.length });
  } catch (e) {
    console.error('[galeri] gagal menyimpan:', e);
    res.status(500).json({ error: 'Gagal menyimpan berkas: ' + (e?.message || e) });
  }
});

app.delete('/galeri/:unit/:berkas', async (req, res) => {
  const unit = String(req.params.unit || '').toLowerCase();
  const nama = berkasSah(req.params.berkas);
  if (!unitSah(unit) || !nama) return res.status(400).json({ error: 'Permintaan tidak sah.' });

  try {
    const daftar = await bacaDaftar();
    // Hanya berkas yang memang terdaftar yang boleh dihapus. Tanpa syarat ini,
    // endpoint ini bisa dipakai menghapus berkas apa pun di dalam foto/.
    const isiUnit = daftar[unit] || [];
    if (!isiUnit.some(f => f.berkas === nama)) {
      return res.status(404).json({ error: 'Foto tidak ada dalam daftar.' });
    }
    daftar[unit] = isiUnit.filter(f => f.berkas !== nama);
    await tulisDaftar(daftar);
    await fs.rm(path.join(FOTO_DIR, unit, nama), { force: true });
    res.json({ ok: true });
  } catch (e) {
    console.error('[galeri] gagal menghapus:', e);
    res.status(500).json({ error: 'Gagal menghapus: ' + (e?.message || e) });
  }
});

/* =====================================================================
   HALAMAN
   ===================================================================== */

app.get('/_info', (_req, res) => {
  res.json({
    aplikasi: 'Dashboard Fasilitas Teknik JATSC (Avenger)',
    versi: process.env.npm_package_version || '0.1.0',
    port: PORT,
    elogbook: TERUS ? ASAL : null,
    // Alamat E-Logbook untuk DIBUKA DI PERAMBAN, berbeda dari ASAL yang dipakai
    // server ini. ASAL menunjuk 127.0.0.1 — benar dari sisi server, tapi kalau
    // dashboardnya dibuka dari komputer lain di jaringan, 127.0.0.1 di sana
    // adalah komputer itu sendiri, bukan mesin E-Logbook. Karena itu bawaannya
    // null: halaman merangkainya dari hostname yang sedang ia pakai, dan
    // ELOGBOOK_TAUTAN dipakai hanya kalau alamatnya memang lain sendiri.
    tautanElogbook: process.env.ELOGBOOK_TAUTAN || null,
    portElogbook: TERUS ? Number(new URL(ASAL).port || 80) : null
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
