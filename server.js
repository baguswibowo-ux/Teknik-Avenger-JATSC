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
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  bacaJson, tulisJson, DI_TABEL,
  hapusJson, tulisBiner, bacaBiner, hapusBiner, mimeDari,
  urlUnggahBertanda, ukuranBiner,
  BISA_TULIS_JSON, BISA_TULIS_BINER
} from './simpanan.js';

try { process.loadEnvFile?.(); } catch { /* tidak ada .env: pakai bawaan */ }

const ROOT = path.dirname(fileURLToPath(import.meta.url));

const PORT  = Number(process.env.PORT || 3100);
const HOST  = process.env.HOST || '0.0.0.0';
const ASAL  = (process.env.ELOGBOOK_ASAL || 'http://127.0.0.1:3000').replace(/\/+$/, '');
const TERUS = process.env.ELOGBOOK_MATI !== '1';

/* Galeri dulu dimatikan begitu VERCEL terpasang, dengan alasan yang benar:
   di sana berkas aplikasi baca-saja dan yang tertulis ke /tmp hilang begitu
   fungsinya selesai. Jawaban yang menjelaskan itu tetap lebih baik daripada
   500 dari fs.writeFile yang tidak berarti apa-apa bagi pemakai.

   Yang berubah: pertanyaannya bukan lagi "apakah ini Vercel" melainkan "apakah
   fotonya benar-benar bisa disimpan". Sejak Supabase Storage jadi salah satu
   jawabannya, keduanya tidak lagi sama — dan yang tahu jawabannya simpanan.js,
   bukan tebakan dari nama satu environment variable.

   Bisa dipaksa mati lewat GALERI_MATI=1 untuk mencobanya di komputer sendiri. */
const GALERI = process.env.GALERI_MATI !== '1' && BISA_TULIS_BINER;

/* Data contoh: angka karangan yang menyatu di halaman, supaya seluruh alurnya
   bisa dicoba tanpa server. Berguna sebelum dipasang di kantor dan di salinan
   etalase; berbahaya sesudahnya, karena yang membaca layar di lingkungan
   sungguhan berhak menganggap yang tertulis di sana nyata.

   Sejak pemilih TUJUAN dibuang, data contoh bukan lagi sesuatu yang dipilih
   orang: ia cuma berlaku kalau E-Logbook memang tidak terjawab. Yang diputuskan
   di sini karena itu satu hal saja — boleh tidak halaman ini JATUH ke data
   contoh waktu servernya diam.

   Bawaannya boleh, karena itu yang benar untuk salinan etalase dan untuk
   mencoba di komputer sendiri. Di server kantor, tempat E-Logbook memang selalu
   ada, pasang DATA_CONTOH=0: di sana server yang diam adalah kerusakan yang
   pantas terlihat, bukan alasan menampilkan angka karangan. Sengaja TIDAK
   ditebak dari VERCEL — etalase justru satu-satunya yang hidup dari data
   contoh, jadi menebaknya dari sana persis terbalik. */
const DATA_CONTOH = process.env.DATA_CONTOH !== '0';

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
   public/foto/daftar.json. Keduanya bersebelahan supaya tidak pernah terpisah,
   tapi keduanya DI LUAR git (lihat .gitignore): repositori proyek ini publik,
   sementara isi galeri adalah wajah pegawai di dalam ruang terbatas. Hasil
   clone karena itu datang dengan galeri kosong, dan daftar.json dibuat sendiri
   saat foto pertama diunggah.

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

/* Dulu sepasang fungsi sendiri yang membaca dan menulis daftar.json langsung ke
   disk. Sekarang lewat simpanan.js seperti sebelas dokumen lainnya: indeks foto
   tidak punya alasan menempuh jalur yang berbeda dari fotonya sendiri, dan
   kalau keduanya berbeda jalur, salah satu bisa tertinggal. */
const bacaDaftar = () => bacaJson(FOTO_JSON, {});
const tulisDaftar = (daftar) => tulisJson(FOTO_JSON, daftar);

const badanGaleri = express.json({ limit: '60mb' });

/** Satu penjaga untuk kedua endpoint yang menulis. */
function galeriHidup(_req, res, next) {
  if (GALERI) return next();
  res.status(503).json({
    error: 'Galeri dimatikan di lingkungan ini: penyimpanannya tidak permanen, '
         + 'jadi foto yang diunggah akan hilang dengan sendirinya.'
  });
}

/**
 * Indeks galeri — foto apa saja yang ada, beserta keterangannya.
 *
 * DI BAWAH /galeri/, BUKAN /foto/daftar.json, DAN ITU BUKAN SOAL RAPI-RAPIAN.
 *
 * Layar dulu membacanya di /foto/daftar.json, dan di Vercel jalur itu tidak
 * pernah sampai ke sini. Bukan karena rewrite-nya kurang — `/foto/(.*)` sudah
 * terdaftar — melainkan karena **berkas statis diperiksa lebih dulu daripada
 * rewrite**. Deploy lewat `npx vercel` ikut mengunggah public/foto/ dari
 * komputer kantor (CLI tidak membaca .gitignore, dan .vercelignore belum ada),
 * jadi ada berkas statis bernama persis itu di deployment — dan ia menang.
 *
 * Yang terbaca pemakai: seluruh galeri produksi beku pada keadaan komputer
 * kantor hari itu. Unggahan baru berhasil betulan — 200, berkasnya mendarat di
 * Storage, indeksnya diperbarui di tabel — tapi tidak ada satu pun yang
 * membaca indeks itu, jadi tidak ada yang berubah di layar. "Berhasil tapi
 * fotonya tidak muncul", berulang kali, tanpa satu pun galat.
 *
 * .vercelignore menutup sebabnya. Jalur ini menutup KELASNYA: di bawah
 * /galeri/ tidak ada dan tidak akan pernah ada berkas di public/ yang bisa
 * membayanginya, apa pun yang terlanjur terunggah nanti.
 *
 * Sesinya dituntut hanya di jalur tabel — sama persis dengan syarat fotonya
 * sendiri di bawah, supaya jalur kantor tidak berubah sedikit pun.
 */
app.get('/galeri/daftar', async (req, res) => {
  if (DI_TABEL && !(await siapa(req))) {
    return res.status(401).json({
      error: 'Masuk dengan akun E-Logbook Anda dulu untuk melihat daftar galeri.'
    });
  }
  // Indeksnya berubah tiap unggahan, dan salinan lama di cache peramban membuat
  // foto yang baru masuk seolah tidak tersimpan.
  res.set('Cache-Control', 'no-store');
  res.json(await bacaDaftar());
});

app.post('/galeri/:unit', galeriHidup, badanGaleri, async (req, res) => {
  const unit = String(req.params.unit || '').toLowerCase();
  if (!unitSah(unit)) return res.status(400).json({ error: 'Kode unit tidak sah.' });

  /* Dulu galeri boleh diisi tanpa masuk sama sekali, dan yang ditanyakan ke
     E-Logbook cuma untuk mengisi nama di log. Itu berubah: galeri sekarang
     salah satu modul yang dipagari per unit, jadi identitasnya dipakai
     sebagai penjagaan, bukan sekadar catatan. */
  const user = await siapa(req);
  if (!user) {
    return res.status(401).json({
      error: 'Masuk dengan akun E-Logbook Anda dulu — galeri hanya bisa diisi setelah masuk.'
    });
  }
  if (!(await bolehIsi(user, 'galeri', unit))) {
    return res.status(403).json({
      error: bolehUnit(user, unit)
        ? 'Peran akun Anda tidak diberi hak mengisi galeri.'
        : 'Akun Anda tidak memegang unit ini, jadi galerinya tidak bisa Anda isi.'
    });
  }

  const nama = berkasSah(req.body?.berkas);
  if (!nama) return res.status(400).json({ error: 'Nama berkas tidak sah — harus .jpg, .jpeg, .png, atau .webp.' });

  const isi = Buffer.from(String(req.body?.isi || ''), 'base64');
  if (!isi.length) return res.status(400).json({ error: 'Isi berkas kosong.' });
  if (isi.length > FOTO_BATAS) {
    return res.status(413).json({ error: `Berkas lebih dari ${Math.round(FOTO_BATAS / 1024 / 1024)} MB.` });
  }

  try {
    await tulisBiner(path.join(FOTO_DIR, unit, nama), isi);

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

    await catat(user, {
      modul: 'galeri', aksi: lama ? 'ganti' : 'unggah', unit, rincian: nama
    });
    res.json({ ok: true, berkas: nama, jumlah: isiUnit.length });
  } catch (e) {
    console.error('[galeri] gagal menyimpan:', e);
    res.status(500).json({ error: 'Gagal menyimpan berkas: ' + (e?.message || e) });
  }
});

app.delete('/galeri/:unit/:berkas', galeriHidup, async (req, res) => {
  const unit = String(req.params.unit || '').toLowerCase();
  const nama = berkasSah(req.params.berkas);
  if (!unitSah(unit) || !nama) return res.status(400).json({ error: 'Permintaan tidak sah.' });

  const user = await siapa(req);
  if (!user) {
    return res.status(401).json({ error: 'Masuk dengan akun E-Logbook Anda dulu.' });
  }
  if (!(await bolehHapus(user, 'galeri', unit))) {
    return res.status(403).json({
      error: 'Menghapus foto hanya bisa dilakukan administrator. Yang lain boleh menambah '
           + 'dan mengganti keterangannya.'
    });
  }

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
    await hapusBiner(path.join(FOTO_DIR, unit, nama));
    await catat(user, { modul: 'galeri', aksi: 'hapus', unit, rincian: nama });
    res.json({ ok: true });
  } catch (e) {
    console.error('[galeri] gagal menghapus:', e);
    res.status(500).json({ error: 'Gagal menghapus: ' + (e?.message || e) });
  }
});

/* =====================================================================
   JADWAL DINAS — modul milik aplikasi ini

   Belum ada padanannya di E-Logbook, jadi ditulis di sini seluruhnya, dengan
   pola yang sama dengan galeri di atas: berkas JSON di data/, ditulis lewat
   berkas sementara lalu rename.

   Kenapa di server dan bukan di localStorage seperti suntingan peralatan:
   yang diminta adalah "semua orang bisa lihat jadwal bulan yang sedang
   berjalan". Jadwal yang tersimpan di peramban masing-masing tidak pernah
   bisa memenuhi itu — ia hanya terlihat oleh yang mengetiknya.

   SIAPA YANG BOLEH MENGISI
   Melihat: siapa saja, tanpa login sekalipun. Mengisi: hanya administrator
   E-Logbook, dan akun yang ditunjuk administrator lewat daftar petugas.
   Identitas tidak pernah dipercaya dari badan permintaan — ia ditanyakan
   balik ke E-Logbook dengan cookie yang dibawa permintaannya, jadi yang
   berlaku tetap sesi E-Logbook yang sungguhan.
   ===================================================================== */

const DATA_DIR      = path.join(ROOT, 'data');
const DINAS_JSON    = path.join(DATA_DIR, 'dinas.json');
const PETUGAS_JSON  = path.join(DATA_DIR, 'dinas-petugas.json');
const HAK_JSON      = path.join(DATA_DIR, 'hak.json');

/* Jadwal dinas cuma butuh dokumen JSON, tidak butuh berkas biner — jadi ia
   sudah bisa disimpan di Vercel begitu jalur tabel menyala, lebih dulu daripada
   galeri dan dokumen yang masih menunggu Storage. */
const DINAS_TULIS = BISA_TULIS_JSON;

const bulanSah = (b) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(b || ''));

/* bacaJson dan tulisJson pindah ke simpanan.js. Yang berubah cuma tempatnya
   menulis — berkas di server kantor, tabel avenger_state di Supabase kalau
   AVENGER_DB=postgres. Bentuk panggilannya persis sama, jadi tidak satu pun
   dari ketiga puluh lima pemanggil di bawah perlu tahu yang mana yang berlaku.

   Alasan lengkapnya, termasuk kenapa satu tabel kunci-nilai dan bukan tabel
   per modul, ada di kepala simpanan.js. */

/**
 * Siapa yang mengirim permintaan ini, menurut E-Logbook.
 *
 * Cookie diteruskan apa adanya, dan yang menjawab tetap server E-Logbook —
 * aplikasi ini tidak pernah membuat atau memeriksa sesi sendiri. Kalau
 * penerusan dimatikan atau servernya tidak terjangkau, jawabannya null, dan
 * yang null tidak pernah boleh menulis apa pun.
 */
async function siapa(req) {
  if (!TERUS) return null;
  try {
    const jawab = await fetch(ASAL + '/api/me', {
      headers: req.headers.cookie ? { cookie: req.headers.cookie } : {},
      signal: AbortSignal.timeout(8000)
    });
    if (!jawab.ok) return null;
    const j = await jawab.json().catch(() => null);
    return (j && j.user) || null;
  } catch (e) {
    console.warn('[dinas] tidak bisa menanyakan sesi ke E-Logbook:', e?.message || e);
    return null;
  }
}

/* ---------------------------------------------------------------------
   SIAPA BOLEH MENGISI APA

   Modul milik dashboard ini dijaga dengan aturan yang sama tapi tidak selalu
   sama isinya: jadwal dinas pantas dibuka untuk pejabat, sedangkan mengganti
   logo unit tidak. Karena itu haknya satu berkas dengan satu kunci per modul,
   bukan satu daftar untuk semuanya.

   Dua jalan diberikan untuk tiap modul, dan keduanya memang perlu:
     peran   — berlaku untuk seluruh akun berperan itu, cara yang biasa
     petugas — satu-dua nama yang ditunjuk di luar perannya, untuk pengecualian

   Administrator selalu boleh, tanpa perlu tercantum di mana pun: kalau tidak,
   satu berkas hak yang salah tulis bisa mengunci semua orang sekaligus,
   termasuk yang seharusnya membetulkannya.

   TIGA HAL YANG MEMAGARI, BUKAN SATU
   Sejak hak menyunting dibuka sampai ke personel unit, satu daftar peran tidak
   lagi cukup. Yang berlaku sekarang tiga lapis, dan ketiganya harus lolos:

     1. modul   — perannya tercantum di hak.json untuk modul itu
     2. unit    — modulnya milik unit yang memang dipegang akun itu
     3. hapus   — menghapus bukan bentuk lain dari menyunting; ia punya
                  daftar perannya sendiri yang jauh lebih pendek

   Lapis kedua ada karena tanpanya "personel unit boleh menyunting" berarti
   personel unit mana pun boleh menyunting unit mana pun — yang bukan itu
   maksudnya. Unit yang dipegang sebuah akun tidak pernah dibaca dari badan
   permintaan; ia datang bersama identitasnya dari /api/me E-Logbook.

   Lapis ketiga ada karena mengisi salah masih bisa diperbaiki dengan mengisi
   ulang, sedangkan menghapus tidak meninggalkan apa pun untuk diperbaiki.

   PERAN
     admin      Administrator — seluruh unit, seluruh modul, termasuk menghapus
     pejabat    Seluruh unit, sebatas modul yang dibuka untuknya. Tidak menghapus
     adminunit  Satu unit: mengisi, mengubah, MENGHAPUS, dan membaca log
                aktivitas unitnya. Administrator yang wilayahnya satu unit
     pic        Satu unit: mengisi dan mengubah. Tidak menghapus
     teknisi    Satu unit: mengisi dan mengubah, sebatas modul yang dibuka

   pic dan teknisi berangkat dari hak bawaan yang sama persis. Bedanya bukan di
   bawaan melainkan di apa yang bisa dilakukan administrator terhadap keduanya:
   satu modul bisa ditutup untuk teknisi dan tetap terbuka untuk pic, tanpa
   menyentuh peran siapa pun di E-Logbook.
   --------------------------------------------------------------------- */

const MODUL_HAK = ['dinas', 'berkala', 'personel',
                   'peralatan', 'sparepart', 'sejarah', 'dokumen', 'galeri'];

const PERAN_SAH = ['admin', 'pejabat', 'adminunit', 'pic', 'teknisi'];

/* Peran yang wilayahnya satu unit saja. Dipakai untuk memutuskan apakah
   penjagaan unit perlu ditegakkan — bukan untuk memutuskan haknya. */
const PERAN_SATU_UNIT = new Set(['adminunit', 'pic', 'teknisi']);

/* Peran yang boleh menghapus. Sengaja pendek, dan sengaja terpisah dari
   hak.json: menghapus bukan sesuatu yang pantas terbuka karena satu centang
   yang salah di layar pengaturan. adminunit tetap dibatasi unitnya sendiri. */
const PERAN_HAPUS = new Set(['admin', 'adminunit']);

/* Modul yang isinya milik satu unit tertentu. Untuk yang tidak ada di sini —
   hak, misalnya — penjagaan unit tidak berlaku karena tidak ada unit yang
   bisa dijadikan pagar. */
const MODUL_PER_UNIT = new Set(['dinas', 'berkala', 'peralatan', 'sparepart',
                                'sejarah', 'dokumen', 'galeri']);

/* Bawaan kalau hak.json belum ada.

   Jadwal dinas berhenti di adminunit: ia mengatur orang, bukan mencatat
   pekerjaan. Daftar peralatan berhenti di admin: isinya daftar induk yang
   dipakai modul lain sebagai acuan — trouble, sejarah, dan dokumen semuanya
   menunjuk id peralatan — jadi satu baris yang diganti nama atau dibuang
   menggeser layar orang lain, bukan cuma layar yang mengubahnya. Yang
   mengisinya kami sendiri; unit lain membacanya.

   Sisanya terbuka sampai teknisi — itu yang diminta, "semua personel sesuai
   unit yang dituju bisa menyunting". Yang menahannya dari jadi kacau bukan
   daftar ini melainkan pagar unit dan pagar hapus.

   Semuanya tetap bisa dibuka lagi dari layar Hak Akses — daftar ini bawaan,
   bukan aturan mati. */
const HAK_BAWAAN = {
  dinas:     { peran: ['admin', 'pejabat', 'adminunit'],               petugas: [] },
  berkala:   { peran: ['admin', 'pejabat', 'adminunit', 'pic', 'teknisi'], petugas: [] },
  personel:  { peran: ['admin', 'adminunit', 'pic', 'teknisi'],        petugas: [] },
  peralatan: { peran: ['admin'],                                       petugas: [] },
  sparepart: { peran: ['admin', 'adminunit', 'pic', 'teknisi'],        petugas: [] },
  /* Sejarah peralatan berhenti di teknisi, tidak ikut daftar induknya yang
     administrator. Keduanya memang menunjuk peralatan yang sama, tapi yang
     dijaga berbeda: mengganti nama atau membuang satu baris peralatan
     menggeser layar orang lain, sementara menuliskan apa yang terjadi pada
     alat itu adalah pekerjaan orang yang sedang berdinas di depannya. Kalau
     ia harus menunggu administrator, riwayatnya tidak akan pernah terisi. */
  sejarah:   { peran: ['admin', 'pejabat', 'adminunit', 'pic', 'teknisi'], petugas: [] },
  dokumen:   { peran: ['admin', 'adminunit', 'pic', 'teknisi'],        petugas: [] },
  galeri:    { peran: ['admin', 'adminunit', 'pic', 'teknisi'],        petugas: [] }
};

const namaSah = (u) => /^[a-z0-9._-]{3,32}$/.test(String(u || '').trim().toLowerCase());

/** Bentuk hak yang tersimpan dirapikan tiap kali dibaca: berkas ini disunting
    tangan sesekali, dan satu kunci yang hilang tidak boleh menjatuhkan modulnya. */
function rapikanHak(mentah) {
  const hasil = {};
  for (const m of MODUL_HAK) {
    const asal = (mentah && mentah[m]) || {};
    hasil[m] = {
      peran: [...new Set((Array.isArray(asal.peran) ? asal.peran : HAK_BAWAAN[m].peran)
        .map((p) => String(p || '').trim().toLowerCase()).filter((p) => PERAN_SAH.includes(p)))],
      petugas: [...new Set((Array.isArray(asal.petugas) ? asal.petugas : [])
        .map((u) => String(u || '').trim().toLowerCase()).filter(namaSah))]
    };
  }
  return hasil;
}

/**
 * Hak yang berlaku sekarang.
 *
 * dinas-petugas.json dari versi sebelumnya ikut dibaca dan dilebur ke kunci
 * dinas — penunjukan yang sudah terlanjur dibuat tidak boleh hilang hanya
 * karena tempat menyimpannya berpindah.
 */
async function bacaHak() {
  const hak = rapikanHak(await bacaJson(HAK_JSON, null));
  const lama = await bacaJson(PETUGAS_JSON, null);
  if (Array.isArray(lama) && lama.length) {
    hak.dinas.petugas = [...new Set([...hak.dinas.petugas,
      ...lama.map((u) => String(u || '').trim().toLowerCase()).filter(namaSah)])];
  }
  return hak;
}

const peranUser = (user) => String((user && user.role) || '').toLowerCase();

/**
 * Unit yang dipegang sebuah akun, menurut E-Logbook.
 *
 * Dijawab null kalau akun itu memegang seluruh unit — null di sini berarti
 * "tidak ada pagar", bukan "tidak ada unit". Keduanya beda jauh, dan larik
 * kosong dipakai untuk yang kedua.
 *
 * Salinan E-Logbook yang lebih tua belum mengirim unit sama sekali. Di situ
 * yang berlaku ketentuan lama: admin dan pejabat memegang semuanya, sisanya
 * tidak diketahui — dan yang tidak diketahui tidak diberi apa-apa. Menebak
 * ke arah sebaliknya berarti membuka seluruh unit untuk semua orang setiap
 * kali dua server ini berbeda versi.
 */
function unitDipegang(user) {
  if (!user) return [];
  const peran = peranUser(user);
  if (peran === 'admin' || user.semuaUnit === true) return null;
  if (!Array.isArray(user.unit)) {
    if (peran === 'pejabat') return null;
    console.warn('[hak] E-Logbook tidak mengirim unit untuk akun', user.username,
                 '— akun ini diperlakukan sebagai belum punya unit.');
    return [];
  }
  return user.unit.map((u) => String(u || '').toLowerCase());
}

/** Akun ini memegang unit tersebut? Unit kosong berarti pertanyaannya tidak
    tentang unit tertentu, dan pagar unit tidak punya apa-apa untuk dijaga. */
function bolehUnit(user, unit) {
  const punya = unitDipegang(user);
  if (punya === null) return true;
  const u = String(unit || '').toLowerCase();
  if (!u) return true;
  return punya.includes(u);
}

/**
 * Boleh mengisi atau mengubah?
 *
 * `unit` boleh dikosongkan untuk modul yang memang tidak milik unit mana pun.
 * Untuk yang milik unit, mengosongkannya berarti pagar unit tidak ditegakkan —
 * jadi pemanggil di modul per-unit harus selalu mengirimkannya.
 */
async function bolehIsi(user, modul, unit = '') {
  if (!user) return false;
  if (peranUser(user) === 'admin') return true;
  if (MODUL_PER_UNIT.has(modul) && !bolehUnit(user, unit)) return false;
  const hak = (await bacaHak())[modul];
  if (!hak) return false;
  if (hak.peran.includes(peranUser(user))) return true;
  return hak.petugas.includes(String(user.username || '').toLowerCase());
}

/**
 * Boleh menghapus?
 *
 * Bukan turunan dari bolehIsi: yang boleh mengisi jauh lebih banyak daripada
 * yang boleh menghapus, dan itu memang disengaja. Yang lolos di sini cuma
 * administrator dan admin unit — admin unit hanya di unitnya sendiri.
 */
async function bolehHapus(user, modul, unit = '') {
  if (!user) return false;
  const peran = peranUser(user);
  if (peran === 'admin') return true;
  if (!PERAN_HAPUS.has(peran)) return false;
  if (!bolehUnit(user, unit)) return false;
  // Yang tidak boleh mengisi sebuah modul juga tidak punya urusan menghapus
  // isinya — hak.json tetap berlaku, hanya tidak pernah cukup sendirian.
  return bolehIsi(user, modul, unit);
}

/** Hak seluruh modul untuk satu orang sekaligus — halaman menanyakannya sekali
    di awal, bukan sekali menjelang tiap tombol digambar.

    Untuk modul per-unit yang dijawab adalah hak atas unit yang dipegangnya;
    halaman tetap harus memeriksa unit yang sedang dibuka lewat unitDipegang.
    Yang dikirim di sini "boleh, sejauh unitnya benar", bukan "boleh di mana
    pun" — dan halaman tidak pernah jadi tempat penjagaan yang sesungguhnya. */
async function bolehSemua(user) {
  const hasil = {};
  for (const m of MODUL_HAK) {
    hasil[m] = {
      isi:   await bolehIsi(user, m, ''),
      hapus: await bolehHapus(user, m, '')
    };
  }
  return hasil;
}

/* =====================================================================
   LOG AKTIVITAS — siapa mengubah apa, dan kapan

   Sampai sekarang jejak penyuntingan tersebar dan setengah-setengah: jadwal
   dinas menyimpan _diubah per unit, kegiatan berkala menyimpan siapa yang
   menandai selesai, dan sisanya — hak, personel, galeri — tidak menyimpan
   apa-apa sama sekali. Yang hilang justru pertanyaan yang paling sering
   ditanyakan sesudah data berubah: ini siapa yang mengisi.

   Satu berkas untuk seluruh modul, entri terbaru di depan, dipotong pada
   AKTIVITAS_BATAS. Yang dicatat cuma perbuatannya, bukan isi datanya —
   log ini tidak boleh jadi salinan kedua dari data yang dicatatnya.

   Pencatatan tidak pernah menggagalkan pekerjaan yang dicatat: kalau
   penulisan log-nya gagal, yang gagal cuma log-nya.
   ===================================================================== */

const AKTIVITAS_JSON  = path.join(DATA_DIR, 'aktivitas.json');
const AKTIVITAS_BATAS = 400;

async function catat(user, isi) {
  if (!DINAS_TULIS) return;
  try {
    const daftar = await bacaJson(AKTIVITAS_JSON, []);
    daftar.unshift({
      jam:  new Date().toISOString(),
      oleh: (user && user.username) || '—',
      nama: (user && (user.nama || user.username)) || '—',
      peran: (user && user.role) || '',
      modul: String(isi.modul || ''),
      aksi:  String(isi.aksi  || ''),
      unit:  String(isi.unit  || ''),
      rincian: String(isi.rincian || '').slice(0, 200)
    });
    await tulisJson(AKTIVITAS_JSON, daftar.slice(0, AKTIVITAS_BATAS));
  } catch (e) {
    console.warn('[aktivitas] tidak tercatat:', e?.message || e);
  }
}

/**
 * Log aktivitas boleh dibaca siapa, dan sebatas unit mana.
 *
 *   null            tidak boleh sama sekali
 *   { unit: null }  seluruh unit, tanpa saringan
 *   { unit: [...] } hanya unit-unit itu
 *
 * Sebelumnya cukup sudah masuk. Itu terlalu longgar: isinya nama orang beserta
 * jam ia bekerja, dan tiap akun teknisi bisa membaca gerak-gerik semua orang
 * di seluruh unit. Sekarang administrator saja — ditambah admin unit, yang
 * hanya melihat unitnya sendiri.
 */
function aktivitasUntuk(user) {
  if (!user) return null;
  const peran = peranUser(user);
  if (peran === 'admin') return { unit: null };
  if (peran === 'adminunit') {
    const punya = unitDipegang(user);
    return { unit: punya === null ? null : punya };
  }
  return null;
}

app.get('/aktivitas', async (req, res) => {
  const user = await siapa(req);
  if (!user) {
    return res.status(401).json({ error: 'Masuk dengan akun E-Logbook Anda dulu untuk melihat log aktivitas.' });
  }
  const izin = aktivitasUntuk(user);
  if (!izin) {
    return res.status(403).json({
      error: 'Log aktivitas hanya bisa dibuka administrator.'
    });
  }
  let daftar = await bacaJson(AKTIVITAS_JSON, []);
  if (izin.unit) {
    // Catatan tanpa unit — perubahan hak, misalnya — melintasi seluruh unit.
    // Menampilkannya pada admin unit berarti membocorkan yang justru
    // dipagari saringan ini.
    const punya = new Set(izin.unit);
    daftar = daftar.filter((a) => a && a.unit && punya.has(String(a.unit).toLowerCase()));
  }
  const batas = Math.min(AKTIVITAS_BATAS, Math.max(1, Number(req.query.batas) || 120));
  res.json({
    aktivitas: daftar.slice(0, batas),
    jumlah: daftar.length,
    // Supaya halaman bisa mengatakan terus terang bahwa yang tampil sebagian,
    // bukan membiarkan orang menyangka unitnya memang sesepi itu.
    unitSaring: izin.unit || null
  });
});

const badanDinas = express.json({ limit: '2mb' });

/** Identitas dan hak pemanggil — dipakai halaman untuk menampilkan tombol
    sunting atau alasannya kalau tidak ada. */
app.get('/dinas/saya', async (req, res) => {
  const user = await siapa(req);
  const boleh = await bolehSemua(user);
  const punya = unitDipegang(user);
  res.json({
    user: user ? {
      username: user.username, nama: user.nama, role: user.role,
      // Unit yang dipegang, dan apakah pagarnya berlaku. Halaman memakainya
      // untuk memutuskan unit mana yang digambar — bukan untuk memutuskan
      // siapa boleh menulis; itu diputuskan lagi di sini pada tiap permintaan.
      unit: punya === null ? [] : punya,
      semuaUnit: punya === null
    } : null,
    // boleh tetap boolean supaya salinan halaman yang lebih tua tidak pecah;
    // yang baru membaca bolehModul di sebelahnya.
    boleh: boleh.dinas.isi,
    bolehModul: boleh,
    // Log aktivitas bukan modul yang bisa diisi, jadi ia tidak ada di
    // bolehModul. Haknya dijawab terpisah supaya halaman tahu perlu
    // menggambar tabnya atau tidak.
    bolehAktivitas: !!aktivitasUntuk(user),
    bisaTulis: DINAS_TULIS
  });
});

/** Berkas hak selengkapnya. Administrator saja — di dalamnya ada daftar nama. */
app.get('/hak', async (req, res) => {
  const user = await siapa(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Hanya administrator yang boleh melihat daftar hak.' });
  }
  res.json({ hak: await bacaHak(), peranSah: PERAN_SAH, modul: MODUL_HAK });
});

app.put('/hak', badanDinas, async (req, res) => {
  const user = await siapa(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Hanya administrator yang boleh mengubah daftar hak.' });
  }
  if (!DINAS_TULIS) {
    return res.status(503).json({ error: 'Daftar hak tidak bisa disimpan di lingkungan ini.' });
  }
  const hak = rapikanHak(req.body && req.body.hak);
  try {
    await tulisJson(HAK_JSON, hak);
    // Berkas lama sudah dilebur ke dalam hak.json oleh bacaHak(); membiarkannya
    // hidup berarti nama yang baru dicabut muncul kembali pada pembacaan
    // berikutnya. Dihapus setelah penggantinya benar-benar tertulis.
    await hapusJson(PETUGAS_JSON);
    await catat(user, {
      modul: 'hak', aksi: 'ubah',
      rincian: MODUL_HAK.map((m) => `${m}: ${hak[m].peran.join('/') || '—'}`
        + (hak[m].petugas.length ? ` +${hak[m].petugas.length} ditunjuk` : '')).join(' · ')
    });
    res.json({ ok: true, hak });
  } catch (e) {
    console.error('[hak] gagal menyimpan:', e);
    res.status(500).json({ error: 'Gagal menyimpan daftar hak: ' + (e?.message || e) });
  }
});

/** Jadwal satu bulan, seluruh unit. Terbuka untuk siapa saja — ini memang
    yang diminta: jadwal bulan berjalan terlihat oleh semua orang. */
app.get('/dinas/bulan/:bulan', async (req, res) => {
  const bulan = String(req.params.bulan || '');
  if (!bulanSah(bulan)) return res.status(400).json({ error: 'Bulan harus berbentuk YYYY-MM.' });
  const semua = await bacaJson(DINAS_JSON, {});
  res.json({ bulan, jadwal: semua[bulan] || {} });
});

/**
 * Simpan jadwal satu unit untuk satu bulan. Satu unit per permintaan, bukan
 * seluruh bulan sekaligus: dua orang yang mengisi unit berbeda pada saat yang
 * sama tidak saling menimpa.
 */
app.put('/dinas/bulan/:bulan/:unit', badanDinas, async (req, res) => {
  const bulan = String(req.params.bulan || '');
  const unit  = String(req.params.unit || '').toLowerCase();
  if (!bulanSah(bulan)) return res.status(400).json({ error: 'Bulan harus berbentuk YYYY-MM.' });
  if (!unitSah(unit))   return res.status(400).json({ error: 'Kode unit tidak sah.' });

  if (!DINAS_TULIS) {
    return res.status(503).json({
      error: 'Jadwal tidak bisa disimpan di lingkungan ini: penyimpanannya tidak permanen.'
    });
  }

  const user = await siapa(req);
  if (!user) {
    return res.status(401).json({
      error: 'Masuk dengan akun E-Logbook Anda dulu — jadwal dinas hanya bisa diisi setelah masuk.'
    });
  }
  if (!(await bolehIsi(user, 'dinas', unit))) {
    return res.status(403).json({
      error: bolehUnit(user, unit)
        ? 'Peran akun Anda tidak diberi hak mengisi jadwal dinas. Mintalah administrator '
          + 'membuka perannya, atau menunjuk akun Anda satu per satu.'
        : 'Akun Anda tidak memegang unit ini, jadi jadwalnya tidak bisa Anda isi.'
    });
  }

  // Bentuknya dirapikan di sini, bukan dipercaya apa adanya: yang tersimpan
  // dibaca kembali oleh setiap orang, dan satu baris rusak dari satu peramban
  // cukup untuk membuat layar semua orang gagal.
  const masuk = Array.isArray(req.body?.orang) ? req.body.orang : [];
  const hariMax = new Date(Number(bulan.slice(0, 4)), Number(bulan.slice(5, 7)), 0).getDate();
  const orang = masuk.slice(0, 200).map((o) => ({
    nama:  String(o?.nama  || '').trim().slice(0, 80),
    peran: String(o?.peran || '').trim().slice(0, 60),
    hari:  Array.from({ length: hariMax }, (_, i) =>
             String((Array.isArray(o?.hari) ? o.hari[i] : '') || '').trim().slice(0, 12))
  })).filter((o) => o.nama);

  try {
    const semua = await bacaJson(DINAS_JSON, {});
    if (!semua[bulan]) semua[bulan] = {};
    // Mengosongkan jadwal yang sudah terisi membuang pekerjaan orang lain
    // sebulan penuh, dan tidak meninggalkan apa pun untuk dikembalikan. Itu
    // penghapusan, apa pun nama tombolnya di layar.
    const adaIsinya = Array.isArray(semua[bulan][unit]) && semua[bulan][unit].length > 0;
    if (!orang.length && adaIsinya && !(await bolehHapus(user, 'dinas', unit))) {
      return res.status(403).json({
        error: 'Mengosongkan jadwal yang sudah terisi terhitung menghapus, dan itu hanya '
             + 'bisa dilakukan administrator.'
      });
    }
    if (orang.length) semua[bulan][unit] = orang;
    else delete semua[bulan][unit];        // unit yang dikosongkan tidak perlu tinggal
    semua[bulan]._diubah = {
      ...(semua[bulan]._diubah || {}),
      [unit]: { oleh: user.username, jam: new Date().toISOString() }
    };
    await tulisJson(DINAS_JSON, semua);
    await catat(user, {
      modul: 'dinas', aksi: orang.length ? 'simpan' : 'kosongkan', unit,
      rincian: `${bulan} · ${orang.length} orang`
    });
    res.json({ ok: true, jumlah: orang.length });
  } catch (e) {
    console.error('[dinas] gagal menyimpan:', e);
    res.status(500).json({ error: 'Gagal menyimpan jadwal: ' + (e?.message || e) });
  }
});

/* Dua jalur di bawah ini bentuk lama dari /hak, dipertahankan supaya salinan
   halaman yang belum diperbarui tetap bisa membaca dan menunjuk petugas jadwal
   dinas. Keduanya menyentuh hak.json yang sama, bukan berkas tersendiri. */
app.get('/dinas/petugas', async (req, res) => {
  const user = await siapa(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Hanya administrator yang boleh melihat daftar ini.' });
  }
  res.json({ petugas: (await bacaHak()).dinas.petugas });
});

app.put('/dinas/petugas', badanDinas, async (req, res) => {
  const user = await siapa(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Hanya administrator yang boleh mengubah daftar ini.' });
  }
  if (!DINAS_TULIS) {
    return res.status(503).json({ error: 'Daftar petugas tidak bisa disimpan di lingkungan ini.' });
  }
  try {
    const hak = await bacaHak();
    hak.dinas.petugas = [...new Set((Array.isArray(req.body?.petugas) ? req.body.petugas : [])
      .map((u) => String(u || '').trim().toLowerCase()).filter(namaSah))];
    await tulisJson(HAK_JSON, hak);
    await hapusJson(PETUGAS_JSON);
    await catat(user, {
      modul: 'hak', aksi: 'ubah',
      rincian: `petugas jadwal dinas: ${hak.dinas.petugas.length} nama`
    });
    res.json({ ok: true, petugas: hak.dinas.petugas });
  } catch (e) {
    console.error('[dinas] gagal menyimpan petugas:', e);
    res.status(500).json({ error: 'Gagal menyimpan daftar petugas: ' + (e?.message || e) });
  }
});

/* =====================================================================
   KEGIATAN BERKALA — pekerjaan mingguan dan bulanan

   Yang disimpan di sini DAFTAR pekerjaannya, bukan riwayat pengerjaannya:
   "periksa grounding tiap Senin", "ganti filter genset tiap tanggal 5".
   Riwayatnya di berkala-selesai.json, satu baris per pekerjaan per periode,
   supaya daftar pekerjaannya tetap pendek dan tidak tumbuh seumur pemakaian.

   PERIODE — kunci yang mengikat pekerjaan pada satu putaran waktu
     mingguan    'YYYY-Www'  minggu ISO, mulai Senin
     bulanan     'YYYY-MM'
     triwulan    'YYYY-Qn'   n = 1..4
     semesteran  'YYYY-Sn'   n = 1..2
     tahunan     'YYYY'
   Semuanya dihitung ulang di server saat menandai selesai, tidak diterima
   dari badan permintaan: tanggal peramban yang meleset sehari cukup untuk
   menandai minggu yang salah sebagai sudah dikerjakan.
   ===================================================================== */

const BERKALA_JSON  = path.join(DATA_DIR, 'berkala.json');
const SELESAI_JSON  = path.join(DATA_DIR, 'berkala-selesai.json');

/** Minggu ISO: Kamis di minggu yang sama menentukan tahunnya, jadi 1 Januari
    yang jatuh di hari Jumat masih terhitung minggu terakhir tahun sebelumnya. */
function pekanIso(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const hari = t.getUTCDay() || 7;              // Minggu = 7, bukan 0
  t.setUTCDate(t.getUTCDate() + 4 - hari);      // geser ke Kamis minggu ini
  const awal = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const nomor = Math.ceil(((t - awal) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(nomor).padStart(2, '0')}`;
}

/** Hari-hari sepekan kegiatan ini jatuh, 1 = Senin sampai 7 = Minggu.
    Bentuknya harus sama persis dengan bklHariDaftar() di public/index.html:
    kalau layar menggambar satu baris hari Senin untuk kegiatan yang harinya
    belum diisi, server harus menerima tanda selesai untuk hari itu juga. */
function hariDaftar(keg) {
  const m = Array.isArray(keg.hari) ? keg.hari : (keg.hari == null ? [] : [keg.hari]);
  const d = [...new Set(m.map(Number).filter((h) => Number.isInteger(h) && h >= 1 && h <= 7))];
  return d.length ? d.sort((a, b) => a - b) : [1];
}

function periodeSekarang(jenis, d = new Date()) {
  const tahun = d.getFullYear();
  const bulan = d.getMonth();                 // 0..11
  switch (jenis) {
    case 'mingguan':   return pekanIso(d);
    case 'triwulan':   return `${tahun}-Q${Math.floor(bulan / 3) + 1}`;
    case 'semesteran': return `${tahun}-S${Math.floor(bulan / 6) + 1}`;
    case 'tahunan':    return String(tahun);
    default:           return `${tahun}-${String(bulan + 1).padStart(2, '0')}`;
  }
}

const BERKALA_JENIS = new Set(['mingguan', 'bulanan', 'triwulan', 'semesteran', 'tahunan']);

/* Rombongan yang mengerjakan. Kosong berarti siapa pun yang berdinas hari itu,
   dan itulah keadaan seluruh kegiatan yang sudah tersimpan sebelum kolom ini
   ada — jadi kolomnya boleh tidak disebut sama sekali dan artinya tetap sama
   dengan perilaku lama.

   Hanya dua, bukan seluruh kode dinas. Yang membedakan pekerjaan berkala cuma
   siang atau malam; huruf gedung dan pecahan P/S tidak pernah menentukan siapa
   yang memegang pekerjaannya. Kembarannya rombonganShift() di
   public/js/02-kode-dinas.js. */
const BERKALA_SHIFT = new Set(['', 'PS', 'M']);

/* Dari mana tanda "sudah dikerjakan" datang. Kosong berarti ditandai orang di
   layar dashboard, seperti sejak awal; sisanya dibuktikan lembar yang sudah
   diisi di E-Logbook, dan sebutannya dipakai untuk menyusun penolakan di
   bawah.

   Yang bukan kosong ada karena pekerjaannya sudah punya bukti yang lebih baik.
   Tiap kali dikerjakan ada satu lembar berisi hasilnya yang tersimpan di
   E-Logbook, lengkap dengan nama dan tanda tangan. Meminta orang mencentang
   ulang di sini berarti dua catatan untuk satu pekerjaan — dan yang satu bisa
   berkata sudah sementara yang lain kosong. Tanda di dashboard mengikuti
   lembar itu, tidak menggantikannya.

   Daftar ini kembarannya BERKALA_SUMBER di public/index.html, dan yang di sana
   yang lengkap: ia juga tahu larik mana yang dibaca dan tab mana yang dituju
   tautannya. Yang perlu diketahui server cuma dua hal — sumber mana yang sah
   tersimpan, dan apa sebutannya waktu menolak. Menambah sumber baru berarti
   menambah satu baris di sini DAN satu baris di sana; kalau yang di sini
   tertinggal, sumbernya tidak akan pernah bisa disimpan. */
const BERKALA_SUMBER = new Map([
  ['', ''],
  ['dstest',     'lembar DS Test'],
  ['dailycheck', 'lembar Daily Check'],
  ['monitoring', 'lembar Monitoring Frekuensi'],
  /* Empat lembar pekerjaan berkala Radtel. Di E-Logbook keempatnya tersimpan
     di satu tabel dan dibedakan kolom jenis; di sini tetap empat sumber
     terpisah, karena yang membuktikan Cleaning CWP bukan lembar Restart CWP. */
  ['bk-neptuno',  'lembar Cek Query Neptuno'],
  ['bk-gatevox',  'lembar Restart CPU Gatevox'],
  ['bk-cleaning', 'lembar Cleaning CWP'],
  ['bk-restart',  'lembar Restart CWP']
]);

/* Berapa bulan panjang satu putaran, untuk jenis yang lebih panjang dari
   sebulan. Angkanya sekaligus batas atas kolom "bulan ke-" pada kegiatannya:
   pekerjaan triwulan jatuh di bulan ke-1, ke-2, atau ke-3 dalam triwulan itu. */
const BERKALA_PANJANG = { triwulan: 3, semesteran: 6, tahunan: 12 };

/** Satu baris kegiatan, dirapikan. Bentuk yang tersimpan dibaca semua orang —
    alasan yang sama dengan jadwal dinas di atas. */
function rapikanKegiatan(k, adaId) {
  const jenis = BERKALA_JENIS.has(k?.jenis) ? k.jenis : 'mingguan';
  const nama = String(k?.nama || '').trim().slice(0, 120);
  if (!nama) return null;
  let id = String(k?.id || '').trim().slice(0, 40).replace(/[^A-Za-z0-9_-]/g, '');
  if (!id || adaId.has(id)) {
    let n = 1;
    do { id = 'k' + n++; } while (adaId.has(id));
  }
  adaId.add(id);
  const panjang = BERKALA_PANJANG[jenis] || 0;

  /* Hari dulu satu angka, sekarang daftar: DS Test jatuh Senin, Rabu, dan
     Sabtu, dan "sekali seminggu" tidak bisa menampung itu. Angka tunggal dari
     data yang sudah tersimpan tetap dibaca — ia cuma daftar sepanjang satu.
     Daftar yang habis disaring diperlakukan sebagai Senin, bukan dibiarkan
     kosong: kegiatan mingguan tanpa satu hari pun tidak akan pernah muncul di
     kalender, dan yang menyimpannya tidak akan pernah tahu sebabnya. */
  const hariMentah = Array.isArray(k?.hari) ? k.hari : (k?.hari == null ? [] : [k.hari]);
  const hari = [...new Set(hariMentah
    .map((h) => Number(h))
    .filter((h) => Number.isInteger(h) && h >= 1 && h <= 7))].sort((a, b) => a - b);

  return {
    id, nama, jenis,
    // hari [1..7] (Senin..Minggu) untuk mingguan; tanggal 1..28 untuk yang lain.
    // Tanggalnya berhenti di 28 dengan sengaja: tanggal 31 tidak ada di semua
    // bulan, dan pekerjaan yang jatuh pada tanggal yang tidak ada tidak pernah
    // muncul sama sekali.
    hari:    jenis === 'mingguan' ? (hari.length ? hari : [1]) : null,
    // bulan ke-berapa DI DALAM putarannya, bukan bulan kalender — kecuali
    // tahunan, yang putarannya memang setahun penuh sehingga keduanya sama.
    // Tanpa kolom ini, pekerjaan triwulan tidak punya tanggal jatuh tempo sama
    // sekali: "sekali dalam tiga bulan" tidak memberi tahu bulan yang mana.
    bulan:   panjang ? Math.min(panjang, Math.max(1, Number(k?.bulan) || 1)) : null,
    tanggal: jenis === 'mingguan' ? null : Math.min(28, Math.max(1, Number(k?.tanggal) || 1)),
    alat: String(k?.alat || '').trim().slice(0, 40),
    ket:  String(k?.ket  || '').trim().slice(0, 400),
    // Kegiatan lama tidak punya kolom ini dan tetap dibaca — tanpa sumber
    // berarti ditandai manual, yaitu perilaku sebelumnya.
    sumber: BERKALA_SUMBER.has(k?.sumber) ? (k.sumber || '') : '',
    // Rombongan yang mengerjakan: 'PS', 'M', atau kosong untuk siapa pun yang
    // berdinas. Nilai asing dijatuhkan jadi kosong, bukan ditolak: yang salah
    // di sini hanya membuat pekerjaannya berlaku untuk semua orang, dan itu
    // lebih baik daripada seluruh daftar unit gagal disimpan.
    shift: BERKALA_SHIFT.has(k?.shift) ? (k.shift || '') : ''
  };
}

/** Seluruh kegiatan berkala, semua unit. Terbuka seperti jadwal dinas — yang
    berdinas perlu tahu apa yang jatuh tempo minggu ini tanpa harus masuk. */
app.get('/berkala', async (_req, res) => {
  res.json({
    kegiatan: await bacaJson(BERKALA_JSON, {}),
    selesai:  await bacaJson(SELESAI_JSON, {}),
    periode:  Object.fromEntries([...BERKALA_JENIS].map((j) => [j, periodeSekarang(j)]))
  });
});

app.put('/berkala/:unit', badanDinas, async (req, res) => {
  const unit = String(req.params.unit || '').toLowerCase();
  if (!unitSah(unit)) return res.status(400).json({ error: 'Kode unit tidak sah.' });
  if (!DINAS_TULIS) {
    return res.status(503).json({
      error: 'Kegiatan berkala tidak bisa disimpan di lingkungan ini: penyimpanannya tidak permanen.'
    });
  }

  const user = await siapa(req);
  if (!user) {
    return res.status(401).json({ error: 'Masuk dengan akun E-Logbook Anda dulu.' });
  }
  if (!(await bolehIsi(user, 'berkala', unit))) {
    return res.status(403).json({
      error: bolehUnit(user, unit)
        ? 'Peran akun Anda tidak diberi hak mengatur kegiatan berkala.'
        : 'Akun Anda tidak memegang unit ini, jadi kegiatannya tidak bisa Anda atur.'
    });
  }

  const adaId = new Set();
  const daftar = (Array.isArray(req.body?.kegiatan) ? req.body.kegiatan : [])
    .slice(0, 100).map((k) => rapikanKegiatan(k, adaId)).filter(Boolean);

  try {
    const semua = await bacaJson(BERKALA_JSON, {});

    /* Daftar dikirim utuh, jadi membuang satu kegiatan tampak sama dengan
       menyimpan daftar yang kebetulan lebih pendek. Yang hilang dicari dengan
       membandingkan id — tanpa ini pagar hapus bisa dilewati siapa pun yang
       boleh menyimpan, cukup dengan mengirim daftar tanpa baris yang ingin
       dibuangnya. */
    const lamaId = new Set((semua[unit] || []).map((k) => k.id));
    for (const k of daftar) lamaId.delete(k.id);
    if (lamaId.size && !(await bolehHapus(user, 'berkala', unit))) {
      return res.status(403).json({
        error: `Menghapus kegiatan (${lamaId.size} baris hilang dari daftar) hanya bisa `
             + 'dilakukan administrator. Menambah dan mengubah tetap boleh.'
      });
    }

    if (daftar.length) semua[unit] = daftar; else delete semua[unit];
    await tulisJson(BERKALA_JSON, semua);
    await catat(user, {
      modul: 'berkala', aksi: 'atur', unit,
      rincian: `${daftar.length} kegiatan`
    });
    res.json({ ok: true, jumlah: daftar.length });
  } catch (e) {
    console.error('[berkala] gagal menyimpan:', e);
    res.status(500).json({ error: 'Gagal menyimpan kegiatan berkala: ' + (e?.message || e) });
  }
});

/**
 * Tandai satu kegiatan sudah dikerjakan pada periode berjalan.
 *
 * Cukup sudah masuk — tidak perlu hak mengatur. Yang mengerjakan pekerjaan
 * mingguan adalah teknisi yang sedang berdinas, dan merekalah yang paling
 * berhak mengatakan bahwa pekerjaannya sudah selesai. Yang mengatur DAFTAR-nya
 * tetap terbatas.
 */
app.post('/berkala/selesai', badanDinas, async (req, res) => {
  if (!DINAS_TULIS) {
    return res.status(503).json({ error: 'Tidak bisa dicatat di lingkungan ini: penyimpanannya tidak permanen.' });
  }
  const user = await siapa(req);
  if (!user) return res.status(401).json({ error: 'Masuk dengan akun E-Logbook Anda dulu.' });

  const unit = String(req.body?.unit || '').toLowerCase();
  const id   = String(req.body?.id || '').trim();
  if (!unitSah(unit) || !id) return res.status(400).json({ error: 'Unit atau kegiatan tidak sah.' });

  const semua = await bacaJson(BERKALA_JSON, {});
  const keg = (semua[unit] || []).find((k) => k.id === id);
  if (!keg) return res.status(404).json({ error: 'Kegiatan itu tidak ada di daftar unit tersebut.' });

  // Menandai pekerjaan unit lain sudah selesai bukan sesuatu yang perlu bisa
  // dilakukan siapa pun yang kebetulan sudah masuk.
  if (!bolehUnit(user, unit)) {
    return res.status(403).json({ error: 'Akun Anda tidak memegang unit ini.' });
  }

  /* Kegiatan yang tandanya datang dari E-Logbook tidak bisa ditandai dari sini,
     juga oleh yang berhak. Kalau boleh, dua catatan untuk satu pekerjaan bisa
     berselisih — dan yang dipercaya orang justru yang lebih mudah ditekan,
     bukan yang berisi hasilnya. Layar sudah menyembunyikan tombolnya; ini
     penjagaan untuk permintaan yang tidak lewat layar. */
  const sebutSumber = BERKALA_SUMBER.get(keg.sumber);
  if (sebutSumber) {
    return res.status(409).json({
      error: `"${keg.nama}" ditandai sendiri dari ${sebutSumber} di E-Logbook. `
           + 'Isi lembarnya di sana — tanda di dashboard ini mengikutinya.'
    });
  }

  /* Kegiatan mingguan sekarang bisa jatuh beberapa hari dalam sepekan, jadi
     satu tanda per pekan tidak cukup lagi: mencentang hari Senin akan membuat
     Rabu dan Sabtu ikut tampak beres. Untuk jenis ini yang jadi kunci adalah
     TANGGAL kejadiannya.

     Tanggalnya datang dari peramban, dan karena itu diperiksa di sini: harus
     salah satu hari yang memang dijadwalkan, dan harus di minggu yang sedang
     berjalan. Tanpa syarat kedua, satu permintaan bisa menandai selesai
     pekerjaan bulan depan. */
  let periode;
  if (keg.jenis === 'mingguan') {
    const tgl = String(req.body?.tanggal || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tgl)) {
      return res.status(400).json({ error: 'Tanggal kejadian tidak sah.' });
    }
    const d = new Date(tgl + 'T00:00:00');
    if (isNaN(d)) return res.status(400).json({ error: 'Tanggal kejadian tidak sah.' });
    if (!hariDaftar(keg).includes(d.getDay() || 7)) {
      return res.status(400).json({ error: 'Kegiatan ini tidak dijadwalkan pada hari itu.' });
    }
    if (pekanIso(d) !== pekanIso(new Date())) {
      return res.status(400).json({
        error: 'Hanya kejadian di minggu yang sedang berjalan yang bisa ditandai.'
      });
    }
    periode = tgl;
  } else {
    periode = periodeSekarang(keg.jenis);
  }
  const kunci = `${unit}|${id}|${periode}`;

  try {
    const catatan = await bacaJson(SELESAI_JSON, {});
    if (req.body?.batal) {
      /* Membatalkan tanda selesai menghapus catatan orang. Membetulkan tanda
         yang baru saja salah ditekan sendiri harus tetap mudah — kalau tidak,
         satu salah tekan berarti menunggu administrator. Jadi yang dibuka:
         pemiliknya sendiri, atau yang memang berhak menghapus. */
      const punya = catatan[kunci];
      const sendiri = punya && String(punya.oleh || '').toLowerCase()
                             === String(user.username || '').toLowerCase();
      if (punya && !sendiri && !(await bolehHapus(user, 'berkala', unit))) {
        return res.status(403).json({
          error: `Tanda selesai ini dibuat ${punya.nama || punya.oleh}. Hanya yang `
               + 'bersangkutan atau administrator yang bisa membatalkannya.'
        });
      }
      delete catatan[kunci];
    } else {
      catatan[kunci] = {
        oleh: user.username,
        nama: user.nama || user.username,
        jam: new Date().toISOString(),
        catatan: String(req.body?.catatan || '').trim().slice(0, 400)
      };
    }
    // Catatan lebih dari setahun dibuang di sini, bukan lewat pembersihan
    // terjadwal yang tidak ada yang menjalankannya. Berkasnya kecil, dan
    // penulisannya toh sudah terjadi.
    const batas = new Date(Date.now() - 400 * 86400000).toISOString();
    for (const [k, v] of Object.entries(catatan)) {
      if (v && v.jam && v.jam < batas) delete catatan[k];
    }
    await tulisJson(SELESAI_JSON, catatan);
    await catat(user, {
      modul: 'berkala', aksi: req.body?.batal ? 'batal-selesai' : 'selesai', unit,
      rincian: `${keg.nama} · ${periode}`
    });
    res.json({ ok: true, periode, selesai: catatan[kunci] || null });
  } catch (e) {
    console.error('[berkala] gagal mencatat:', e);
    res.status(500).json({ error: 'Gagal mencatat: ' + (e?.message || e) });
  }
});

/* =====================================================================
   PERSONEL — sertifikat, lisensi, rating, dan masa berlakunya

   Yang dijaga di sini bukan cuma siapa boleh menulis, tapi juga siapa boleh
   MEMBACA nomornya. Nama, jenis sertifikat, dan tanggal berlakunya perlu
   terlihat luas — beranda memberi peringatan dua bulan sebelum habis, dan
   peringatan yang cuma terlihat oleh administrator tidak menolong siapa pun.
   Nomor lisensinya lain perkara: itu identitas orang, dan tidak ada gunanya
   ditampilkan pada layar yang terbuka. Jadi nomornya dipotong untuk yang
   belum masuk, dan utuh untuk yang sudah.
   ===================================================================== */

const PERSONEL_JSON = path.join(DATA_DIR, 'personel.json');

const tglSah = (t) => /^\d{4}-\d{2}-\d{2}$/.test(String(t || '')) ? t : '';

function rapikanPersonel(p, adaId) {
  const nama = String(p?.nama || '').trim().slice(0, 80);
  if (!nama) return null;
  let id = String(p?.id || '').trim().slice(0, 40).replace(/[^A-Za-z0-9_-]/g, '');
  if (!id || adaId.has(id)) {
    let n = 1;
    do { id = 'p' + n++; } while (adaId.has(id));
  }
  adaId.add(id);
  return {
    id, nama,
    unit: String(p?.unit || '').trim().toLowerCase().slice(0, 32),
    // Penghubung ke akun E-Logbook. Ini yang membuat peringatan bisa sampai ke
    // orangnya sendiri dan bukan cuma ke papan pengumuman bersama.
    username: String(p?.username || '').trim().toLowerCase().slice(0, 32),
    jabatan: String(p?.jabatan || '').trim().slice(0, 80),
    /* Tiap sertifikat punya id sendiri sejak berkas bukti bisa ditempelkan
       padanya. Menunjuknya lewat nomor urut tidak cukup: satu baris yang
       dihapus menggeser seluruh sisanya, dan bukti lisensi berpindah menempel
       ke sertifikat orang yang sama tapi yang lain. */
    sertifikat: (Array.isArray(p?.sertifikat) ? p.sertifikat : []).slice(0, 30).map((s, i) => ({
      id: String(s?.id || '').trim().slice(0, 40).replace(/[^A-Za-z0-9_-]/g, '') || ('s' + (i + 1)),
      jenis:  String(s?.jenis  || 'Sertifikat').trim().slice(0, 40),
      nama:   String(s?.nama   || '').trim().slice(0, 120),
      nomor:  String(s?.nomor  || '').trim().slice(0, 60),
      rating: String(s?.rating || '').trim().slice(0, 80),
      terbit:  tglSah(s?.terbit),
      berlaku: tglSah(s?.berlaku)
    })).filter((s) => s.nama || s.nomor || s.rating)
  };
}

app.get('/personel', async (req, res) => {
  const user = await siapa(req);
  const daftar = await bacaJson(PERSONEL_JSON, []);
  const boleh = await bolehIsi(user, 'personel');
  const isi = user ? daftar : daftar.map((p) => ({
    ...p,
    sertifikat: (p.sertifikat || []).map((s) => ({ ...s, nomor: s.nomor ? '••••' : '' }))
  }));
  res.json({
    personel: isi, boleh, bisaTulis: DINAS_TULIS, masuk: !!user,
    bolehHapus: await bolehHapus(user, 'personel'),
    // Unit yang boleh disunting akun ini; null berarti seluruhnya. Halaman
    // memakainya untuk mengunci baris milik unit lain.
    unitBoleh: unitDipegang(user)
  });
});

app.put('/personel', badanDinas, async (req, res) => {
  if (!DINAS_TULIS) {
    return res.status(503).json({
      error: 'Data personel tidak bisa disimpan di lingkungan ini: penyimpanannya tidak permanen.'
    });
  }
  const user = await siapa(req);
  if (!user) return res.status(401).json({ error: 'Masuk dengan akun E-Logbook Anda dulu.' });
  if (!(await bolehIsi(user, 'personel'))) {
    return res.status(403).json({ error: 'Peran akun Anda tidak diberi hak mengubah data personel.' });
  }

  const adaId = new Set();
  const sebelum = await bacaJson(PERSONEL_JSON, []);
  let daftar = (Array.isArray(req.body?.personel) ? req.body.personel : [])
    .slice(0, 500).map((p) => rapikanPersonel(p, adaId)).filter(Boolean);

  /* Daftar personel satu berkas untuk seluruh unit, dan halaman mengirimnya
     utuh. Untuk akun yang wilayahnya satu unit itu berbahaya: kiriman yang
     kebetulan tidak memuat baris unit lain akan menghapus baris itu, tanpa
     seorang pun bermaksud menghapusnya.

     Jadi yang dipakai dari kiriman hanya baris milik unit yang dipegangnya;
     baris unit lain diambil dari yang tersimpan, bukan dari kiriman. Yang
     tidak berhak menyentuhnya juga tidak bisa menghapusnya karena lalai. */
  const punya = unitDipegang(user);
  if (punya !== null) {
    const wilayah = new Set(punya);
    const milikSaya  = (p) => wilayah.has(String(p.unit || '').toLowerCase());
    const dikirimSaya = daftar.filter(milikSaya);

    // Baris yang hilang dari wilayahnya sendiri — itu penghapusan sungguhan.
    const idKirim = new Set(dikirimSaya.map((p) => p.id));
    const hilang = (Array.isArray(sebelum) ? sebelum : [])
      .filter((p) => milikSaya(p) && !idKirim.has(p.id));
    if (hilang.length && !(await bolehHapus(user, 'personel'))) {
      return res.status(403).json({
        error: `Menghapus data personel (${hilang.length} orang hilang dari daftar) hanya `
             + 'bisa dilakukan administrator. Menambah dan mengubah tetap boleh.'
      });
    }

    const unitLain = (Array.isArray(sebelum) ? sebelum : []).filter((p) => !milikSaya(p));
    daftar = [...unitLain, ...dikirimSaya];
  } else {
    const idKirim = new Set(daftar.map((p) => p.id));
    const hilang = (Array.isArray(sebelum) ? sebelum : []).filter((p) => !idKirim.has(p.id));
    if (hilang.length && !(await bolehHapus(user, 'personel'))) {
      return res.status(403).json({
        error: `Menghapus data personel (${hilang.length} orang hilang dari daftar) hanya `
             + 'bisa dilakukan administrator. Menambah dan mengubah tetap boleh.'
      });
    }
  }

  try {
    await tulisJson(PERSONEL_JSON, daftar);
    /* Yang disebut di log cuma jumlahnya dan arah perubahannya. Nomor lisensi
       tidak boleh bocor lewat pintu belakang bernama "log aktivitas" — bagian
       PERSONEL di atas menyembunyikannya dari yang belum masuk justru karena
       itu identitas orang. */
    const selisih = daftar.length - (Array.isArray(sebelum) ? sebelum.length : 0);
    await catat(user, {
      modul: 'personel', aksi: selisih > 0 ? 'tambah' : selisih < 0 ? 'hapus' : 'ubah',
      rincian: `${daftar.length} orang terdaftar`
    });
    res.json({ ok: true, jumlah: daftar.length });
  } catch (e) {
    console.error('[personel] gagal menyimpan:', e);
    res.status(500).json({ error: 'Gagal menyimpan data personel: ' + (e?.message || e) });
  }
});

/* =====================================================================
   DATABASE UNIT — peralatan dan sparepart

   Sebelumnya keduanya hidup di localStorage: tiap peramban menyimpan
   salinannya sendiri, dan suntingan seseorang tidak pernah sampai ke layar
   siapa pun. Untuk daftar contoh itu cukup. Untuk daftar peralatan yang
   dipakai bersama satu unit, tidak: yang diminta adalah personel unit
   menyunting daftar unitnya dan hasilnya terlihat oleh unit itu — dan itu
   tidak mungkin selama datanya tidak pernah meninggalkan peramban.

   Bentuknya mengikuti kegiatan berkala: satu berkas per modul, berkunci kode
   unit. Sparepart pun dikunci per unit walau aslinya larik datar dengan kolom
   unit — dengan begitu pagar unit menjadi bentuk datanya sendiri, bukan
   sesuatu yang harus diingat menyaring di tiap tempat yang menyentuhnya.
   ===================================================================== */

const UNITDB_JSON = {
  peralatan: path.join(DATA_DIR, 'peralatan.json'),
  sparepart: path.join(DATA_DIR, 'sparepart.json')
};

const STATUS_ALAT = new Set(['Normal', 'Warning', 'Down']);
const SATUAN_PART = new Set(['pcs', 'rol', 'drum', 'set', 'meter', 'liter']);

/** id yang sah dan unik di dalam unitnya; yang kosong diberi nomor urut. */
function idBaris(nilai, adaId, awalan) {
  let id = String(nilai || '').trim().slice(0, 40).replace(/[^A-Za-z0-9_-]/g, '');
  if (!id || adaId.has(id)) {
    let n = 1;
    do { id = awalan + n++; } while (adaId.has(id));
  }
  adaId.add(id);
  return id;
}

/* Kolom papan nama yang sama-sama dipunyai peralatan dan sparepart. Dipisah
   supaya keduanya tidak diam-diam berbeda saat salah satunya disunting. */
function papanNama(x) {
  return {
    merk:  String(x?.merk  || '').trim().slice(0, 60),
    sn:    String(x?.sn    || '').trim().slice(0, 60),
    tahun: String(x?.tahun || '').trim().slice(0, 10),
    // Nama berkas foto dokumentasi di galeri unit — yang disimpan di baris ini
    // cuma namanya, berkasnya sendiri milik galeri.
    foto: (Array.isArray(x?.foto) ? x.foto : []).slice(0, 30)
      .map((f) => path.basename(String(f || '')).slice(0, 120))
      .filter((f) => /^[A-Za-z0-9._-]+$/.test(f)),
    // Kapan baris ini masuk daftar. Dipertahankan apa adanya kalau sudah ada;
    // baris baru diberi cap sekarang oleh halaman.
    dibuat: tglJamSah(x?.dibuat)
  };
}

/** ISO 8601 seadanya — yang tidak berbentuk itu dibuang, bukan diperbaiki. */
const tglJamSah = (t) =>
  /^\d{4}-\d{2}-\d{2}T[\d:.]+Z?$/.test(String(t || '')) ? String(t) : '';

function rapikanAlat(a, adaId) {
  const nama = String(a?.nama || '').trim().slice(0, 120);
  if (!nama) return null;
  return {
    id: idBaris(a?.id, adaId, 'a'),
    nama,
    tipe:   String(a?.tipe   || '').trim().slice(0, 120),
    lokasi: String(a?.lokasi || '').trim().slice(0, 80),
    status: STATUS_ALAT.has(a?.status) ? a.status : 'Normal',
    // Nama adegan tiga dimensi yang dipakai halaman. Dibiarkan apa adanya
    // sepanjang bentuknya aman — daftar adegannya milik halaman, dan server
    // tidak perlu ikut menghafalnya supaya keduanya bisa berubah sendiri.
    adegan: String(a?.adegan || '').trim().toLowerCase().slice(0, 24).replace(/[^a-z0-9_-]/g, ''),
    // Foto galeri yang dipakai sebagai gambar kartunya. Kosong = pakai
    // ilustrasi tiga dimensi.
    gambar: path.basename(String(a?.gambar || '')).slice(0, 120)
      .replace(/[^A-Za-z0-9._-]/g, ''),
    pn: String(a?.pn || '').trim().slice(0, 60),
    ...papanNama(a)
  };
}

function rapikanPart(p, adaId) {
  const nama = String(p?.nama || '').trim().slice(0, 120);
  if (!nama) return null;
  const bulat = (n, bawaan) => {
    const v = Number(n);
    return Number.isFinite(v) ? Math.min(99999, Math.max(0, Math.round(v))) : bawaan;
  };
  return {
    id: idBaris(p?.id, adaId, 's'),
    nama,
    pn:  String(p?.pn  || '').trim().slice(0, 60),
    rak: String(p?.rak || '').trim().slice(0, 24),
    stok: bulat(p?.stok, 0),
    min:  bulat(p?.min,  0),
    satuan: SATUAN_PART.has(p?.satuan) ? p.satuan : 'pcs',
    pakai: tglSah(p?.pakai),
    tipe: String(p?.tipe || '').trim().slice(0, 120),
    ...papanNama(p)
  };
}

const UNITDB_RAPI = { peralatan: rapikanAlat, sparepart: rapikanPart };

/** Seluruh database unit. Terbuka seperti kegiatan berkala — yang berdinas
    perlu melihat daftar peralatan unitnya tanpa harus masuk dulu. */
app.get('/unitdb', async (_req, res) => {
  res.json({
    peralatan: await bacaJson(UNITDB_JSON.peralatan, {}),
    sparepart: await bacaJson(UNITDB_JSON.sparepart, {}),
    logo:      await bacaLogo()
  });
});

app.put('/unitdb/:modul/:unit', badanDinas, async (req, res) => {
  const modul = String(req.params.modul || '');
  const unit  = String(req.params.unit  || '').toLowerCase();
  if (!UNITDB_JSON[modul]) return res.status(400).json({ error: 'Modul tidak dikenal.' });
  if (!unitSah(unit))      return res.status(400).json({ error: 'Kode unit tidak sah.' });
  if (!DINAS_TULIS) {
    return res.status(503).json({
      error: 'Database unit tidak bisa disimpan di lingkungan ini: penyimpanannya tidak permanen.'
    });
  }

  const user = await siapa(req);
  if (!user) return res.status(401).json({ error: 'Masuk dengan akun E-Logbook Anda dulu.' });
  if (!(await bolehIsi(user, modul, unit))) {
    return res.status(403).json({
      error: bolehUnit(user, unit)
        ? `Peran akun Anda tidak diberi hak mengubah ${modul} unit ini.`
        : 'Akun Anda tidak memegang unit ini, jadi databasenya tidak bisa Anda ubah.'
    });
  }

  const adaId = new Set();
  const rapi = UNITDB_RAPI[modul];
  const kunci = modul === 'peralatan' ? 'peralatan' : 'sparepart';
  const daftar = (Array.isArray(req.body?.[kunci]) ? req.body[kunci] : [])
    .slice(0, 300).map((x) => rapi(x, adaId)).filter(Boolean);

  try {
    const semua = await bacaJson(UNITDB_JSON[modul], {});

    // Alasannya sama dengan kegiatan berkala: daftar dikirim utuh, jadi
    // membuang satu baris tidak terlihat berbeda dari menyimpan daftar yang
    // lebih pendek. Yang hilang dicari lewat id.
    const lamaId = new Set((semua[unit] || []).map((x) => x.id));
    for (const x of daftar) lamaId.delete(x.id);
    if (lamaId.size && !(await bolehHapus(user, modul, unit))) {
      return res.status(403).json({
        error: `Menghapus baris (${lamaId.size} hilang dari daftar) hanya bisa dilakukan `
             + 'administrator. Menambah dan mengubah tetap boleh.'
      });
    }

    if (daftar.length) semua[unit] = daftar; else delete semua[unit];
    await tulisJson(UNITDB_JSON[modul], semua);
    await catat(user, {
      modul, aksi: lamaId.size ? 'hapus' : 'simpan', unit,
      rincian: `${daftar.length} baris`
    });
    res.json({ ok: true, jumlah: daftar.length });
  } catch (e) {
    console.error(`[${modul}] gagal menyimpan:`, e);
    res.status(500).json({ error: 'Gagal menyimpan: ' + (e?.message || e) });
  }
});

/* =====================================================================
   SEJARAH PERALATAN — garis waktu per alat

   Sampai sekarang isinya TIDAK datang dari mana pun: SEJARAH di
   public/js/03-suntingan-unit.js adalah tiga daftar yang ditulis tangan
   sebagai contoh, berkunci id alat — tx, grx, acp. Karena id itu juga dipakai
   peralatan sungguhan, contoh itu ikut muncul di produksi dan terbaca seolah
   riwayat betulan, lengkap dengan tanggal dan nama vendor yang tidak pernah
   ada. Itu yang dibereskan blok ini: yang tampil sekarang isi simpanan,
   dan yang di berkas contoh tinggal di jalur data contoh saja.

   Rencana jangka panjangnya tetap seperti yang tertulis di daftar modul:
   satu garis waktu yang DIRANGKAI dari logbook, isu, dan LTK. Itu belum bisa
   sekarang — tidak ada satu pun baris logbook di E-Logbook yang menyebut id
   peralatan, jadi tidak ada yang bisa dirangkai. Yang bisa dikerjakan hari ini
   adalah menuliskannya sendiri, dan bentuk simpanannya sengaja dibuat sama
   dengan yang nanti akan dihasilkan perangkaian itu: satu baris = satu
   kejadian, bertanggal, bertingkat perhatian. Kalau nanti logbook bisa
   menyebut peralatan, barisnya tinggal ditambahkan dari sana.

   Berkunci unit lalu id alat, bukan id alat saja: id hanya unik di dalam
   unitnya (lihat idBaris), jadi 'tx' milik Radkom dan 'tx' milik unit lain
   adalah dua alat yang berbeda.
   ===================================================================== */

const SEJARAH_JSON = path.join(DATA_DIR, 'sejarah.json');
const SEJARAH_WARNA = new Set(['', 'kuning', 'merah']);

/** Satu kejadian, dirapikan. idnya ditetapkan pemanggil, bukan di sini —
    pemberian id harus melihat yang sudah tersimpan, dan fungsi ini tidak
    tahu apa-apa tentang itu.

    Tanggal boleh kosong: kejadian lama yang tanggal pastinya sudah tidak ada
    yang ingat tetap lebih berharga tercatat daripada tidak. Yang tanpa
    tanggal jatuh ke ekor urutan, dan layar menyebutnya apa adanya. */
function rapikanKejadian(k, id) {
  const judul = String(k?.judul || '').trim().slice(0, 120);
  if (!judul) return null;
  return {
    id,
    tgl: tglSah(k?.tgl),
    // Kosong = kejadian biasa, kuning = perlu diperhatikan, merah = gangguan.
    warna: SEJARAH_WARNA.has(k?.warna) ? (k.warna || '') : '',
    judul,
    rinci: String(k?.rinci || '').trim().slice(0, 1000),
    /* Ketiganya ditimpa rutenya dari sesi yang sedang berjalan — yang
       dikirim layar tidak pernah dipakai. Tetap dirapikan di sini supaya
       bentuk barisnya lengkap walau pemanggil lain suatu saat lupa. */
    oleh: String(k?.oleh || '').trim().slice(0, 32),
    olehNama: String(k?.olehNama || '').trim().slice(0, 80),
    dicatat: tglJamSah(k?.dicatat)
  };
}

/** Seluruh sejarah, semua unit. Terbuka seperti daftar peralatannya sendiri —
    yang berdinas perlu tahu apa yang pernah terjadi pada alat di depannya. */
app.get('/sejarah', async (_req, res) => {
  res.json({ sejarah: await bacaJson(SEJARAH_JSON, {}), bisaTulis: DINAS_TULIS });
});

/**
 * Ganti garis waktu satu alat.
 *
 * Dikirim utuh per alat, bentuk yang sama dengan kegiatan berkala dan database
 * unit — jadi pagar hapusnya juga sama: baris yang hilang dari kiriman dicari
 * lewat id, karena tanpa itu siapa pun yang boleh menyimpan bisa membuang
 * baris orang lain cukup dengan tidak menyertakannya.
 */
app.put('/sejarah/:unit/:alat', badanDinas, async (req, res) => {
  const unit = String(req.params.unit || '').toLowerCase();
  const alat = String(req.params.alat || '').trim().slice(0, 40).replace(/[^A-Za-z0-9_-]/g, '');
  if (!unitSah(unit) || !alat) return res.status(400).json({ error: 'Permintaan tidak sah.' });
  if (!DINAS_TULIS) {
    return res.status(503).json({
      error: 'Sejarah peralatan tidak bisa disimpan di lingkungan ini: penyimpanannya tidak permanen.'
    });
  }

  const user = await siapa(req);
  if (!user) return res.status(401).json({ error: 'Masuk dengan akun E-Logbook Anda dulu.' });
  if (!(await bolehIsi(user, 'sejarah', unit))) {
    return res.status(403).json({
      error: bolehUnit(user, unit)
        ? 'Peran akun Anda tidak diberi hak menulis sejarah peralatan.'
        : 'Akun Anda tidak memegang unit ini, jadi sejarah alatnya tidak bisa Anda tulis.'
    });
  }

  try {
    const semua = await bacaJson(SEJARAH_JSON, {});
    const perUnit = semua[unit] || {};
    const sebelum = new Map((perUnit[alat] || []).map((k) => [k.id, k]));

    /* Pemberian id melihat yang SUDAH tersimpan, bukan cuma yang sekiriman.
       Kalau tidak: baris baru yang dikirim di urutan pertama akan diberi 'h1',
       menabrak baris lama yang kebetulan bernama sama — dan tabrakan itu tidak
       terlihat sebagai kesalahan. Ia terbaca sebagai penyuntingan: baris lama
       tertimpa isinya, penjaga hapus tidak menyala karena idnya memang ada di
       kiriman, dan pencatat aslinya ikut menempel pada kejadian yang bukan
       miliknya. Layar ini mengirim baris baru di urutan pertama, jadi ini
       bukan kemungkinan yang jauh. */
    const mentah = (Array.isArray(req.body?.sejarah) ? req.body.sejarah : []).slice(0, 200);
    const bersihId = (x) => String(x || '').trim().slice(0, 40).replace(/[^A-Za-z0-9_-]/g, '');
    const dipakai = new Set(sebelum.keys());
    for (const k of mentah) { const id = bersihId(k?.id); if (id) dipakai.add(id); }

    const diklaim = new Set();
    const daftar = mentah.map((k) => {
      let id = bersihId(k?.id);
      if (!id || diklaim.has(id)) {
        let n = 1;
        do { id = 'h' + n++; } while (dipakai.has(id));
        dipakai.add(id);
      }
      diklaim.add(id);
      return rapikanKejadian(k, id);
    }).filter(Boolean)
      // Diurutkan di sini, bukan di layar: yang membaca berikutnya belum tentu
      // layar ini — dan garis waktu yang urutannya tergantung siapa yang
      // menampilkannya bukan garis waktu.
      .sort((a, b) => String(b.tgl).localeCompare(String(a.tgl)));

    /* Siapa yang mencatat ditetapkan DI SINI, bukan diterima dari layar.
       Kalau diterima, satu permintaan yang dirangkai tangan bisa menuliskan
       nama siapa pun di bawah kejadian apa pun — dan riwayat peralatan dibaca
       bertahun-tahun sesudahnya, saat tidak ada lagi yang ingat.

       Baris yang sudah ada mempertahankan pencatat aslinya: membetulkan salah
       ketik pada kejadian tahun lalu tidak membuat yang membetulkan jadi orang
       yang menyaksikannya. */
    const sekarang = new Date().toISOString();
    for (const k of daftar) {
      const lama = sebelum.get(k.id);
      k.oleh     = lama ? lama.oleh     : user.username;
      k.olehNama = lama ? lama.olehNama : (user.nama || user.username);
      k.dicatat  = lama ? lama.dicatat  : sekarang;
    }

    const lamaId = new Set(sebelum.keys());
    for (const k of daftar) lamaId.delete(k.id);
    if (lamaId.size && !(await bolehHapus(user, 'sejarah', unit))) {
      return res.status(403).json({
        error: `Menghapus kejadian (${lamaId.size} baris hilang dari daftar) hanya bisa `
             + 'dilakukan administrator. Menambah dan mengubah tetap boleh.'
      });
    }

    if (daftar.length) perUnit[alat] = daftar; else delete perUnit[alat];
    if (Object.keys(perUnit).length) semua[unit] = perUnit; else delete semua[unit];
    await tulisJson(SEJARAH_JSON, semua);
    await catat(user, {
      modul: 'sejarah', aksi: 'tulis', unit, rincian: `${alat} · ${daftar.length} kejadian`
    });
    res.json({ ok: true, jumlah: daftar.length, sejarah: daftar });
  } catch (e) {
    console.error('[sejarah] gagal menyimpan:', e);
    res.status(500).json({ error: 'Gagal menyimpan sejarah: ' + (e?.message || e) });
  }
});

/* =====================================================================
   LOGO UNIT — gambar pengenal tiap unit

   Hanya administrator. Logo bukan data pekerjaan sehari-hari: ia tampil di
   kepala tiap layar unit, dan yang menggantinya mengubah tampilan untuk
   semua orang sekaligus. Karena itu ia tidak ikut hak.json — tidak ada
   centang yang bisa membukanya untuk peran lain tanpa sengaja.

   Berkasnya menumpang tempat galeri: public/foto/_logo/. Awalan garis bawah
   membuatnya tidak mungkin bentrok dengan kode unit, yang hanya boleh huruf
   dan angka.
   ===================================================================== */

const LOGO_DIR   = path.join(FOTO_DIR, '_logo');
const LOGO_JSON  = path.join(LOGO_DIR, 'daftar.json');
const LOGO_BATAS = 2 * 1024 * 1024;    // logo yang lebih besar dari ini pasti salah pilih berkas
const LOGO_EXT   = new Set(['.png', '.webp', '.jpg', '.jpeg', '.svg']);

async function bacaLogo() { return bacaJson(LOGO_JSON, {}); }

app.post('/logo/:unit', galeriHidup, badanGaleri, async (req, res) => {
  const unit = String(req.params.unit || '').toLowerCase();
  if (!unitSah(unit)) return res.status(400).json({ error: 'Kode unit tidak sah.' });

  const user = await siapa(req);
  if (!user) return res.status(401).json({ error: 'Masuk dengan akun E-Logbook Anda dulu.' });
  if (peranUser(user) !== 'admin') {
    return res.status(403).json({ error: 'Hanya administrator yang boleh mengganti logo unit.' });
  }

  // Nama berkasnya ditentukan di sini, bukan diambil dari kiriman: yang perlu
  // dipertahankan cuma jenis gambarnya. Nama dari klien tidak menambah apa pun
  // selain satu jalur lagi yang harus dibersihkan.
  const ext = path.extname(String(req.body?.berkas || '')).toLowerCase();
  if (!LOGO_EXT.has(ext)) {
    return res.status(400).json({ error: 'Logo harus .png, .webp, .jpg, atau .svg.' });
  }
  const isi = Buffer.from(String(req.body?.isi || ''), 'base64');
  if (!isi.length) return res.status(400).json({ error: 'Isi berkas kosong.' });
  if (isi.length > LOGO_BATAS) {
    return res.status(413).json({ error: `Logo lebih dari ${Math.round(LOGO_BATAS / 1024 / 1024)} MB.` });
  }

  const nama = unit + ext;
  try {
    // Logo lama dengan ekstensi berbeda harus pergi, kalau tidak dua berkas
    // untuk satu unit tertinggal dan yang lama tidak pernah terpakai lagi.
    const daftar = await bacaLogo();
    if (daftar[unit] && daftar[unit].berkas && daftar[unit].berkas !== nama) {
      await hapusBiner(path.join(LOGO_DIR, daftar[unit].berkas));
    }
    await tulisBiner(path.join(LOGO_DIR, nama), isi);
    daftar[unit] = { berkas: nama, jam: new Date().toISOString() };
    await tulisJson(LOGO_JSON, daftar);
    await catat(user, { modul: 'logo', aksi: 'ganti', unit, rincian: nama });
    res.json({ ok: true, berkas: nama, url: `/foto/_logo/${nama}` });
  } catch (e) {
    console.error('[logo] gagal menyimpan:', e);
    res.status(500).json({ error: 'Gagal menyimpan logo: ' + (e?.message || e) });
  }
});

app.delete('/logo/:unit', galeriHidup, async (req, res) => {
  const unit = String(req.params.unit || '').toLowerCase();
  if (!unitSah(unit)) return res.status(400).json({ error: 'Kode unit tidak sah.' });

  const user = await siapa(req);
  if (!user) return res.status(401).json({ error: 'Masuk dengan akun E-Logbook Anda dulu.' });
  if (peranUser(user) !== 'admin') {
    return res.status(403).json({ error: 'Hanya administrator yang boleh menghapus logo unit.' });
  }

  try {
    const daftar = await bacaLogo();
    if (!daftar[unit]) return res.status(404).json({ error: 'Unit ini memang belum punya logo.' });
    await hapusBiner(path.join(LOGO_DIR, daftar[unit].berkas));
    delete daftar[unit];
    await tulisJson(LOGO_JSON, daftar);
    await catat(user, { modul: 'logo', aksi: 'hapus', unit, rincian: '' });
    res.json({ ok: true });
  } catch (e) {
    console.error('[logo] gagal menghapus:', e);
    res.status(500).json({ error: 'Gagal menghapus logo: ' + (e?.message || e) });
  }
});

/* =====================================================================
   DOKUMEN UNIT — berkas yang tinggal, bukan yang hilang saat disegarkan

   Sampai sekarang tab Dokumen cuma menyimpan object URL di memori tab: begitu
   halaman disegarkan, seluruh daftarnya hilang. Itu memang disengaja selama
   belum ada keputusan berkasnya mau ditaruh di mana dan siapa yang boleh
   membukanya. Keputusannya sekarang ada, dan bentuknya di bawah ini.

   DI LUAR public/, tidak seperti galeri. Galeri berisi foto yang memang untuk
   dipandang siapa saja yang membuka dashboard, jadi ia disajikan sebagai
   berkas statis. Dokumen tidak: di dalamnya ada SOP, sertifikat, dan berita
   acara yang bertanda tangan. Karena itu berkasnya tinggal di data/dokumen/
   — yang tidak pernah disajikan express.static — dan satu-satunya jalan
   mengambilnya lewat GET /dokumen/:unit/:id, yang menuntut sesi E-Logbook.

   Nama di disk BUKAN nama aslinya. Yang tersimpan <id><ekstensi>, dan nama
   asli orangnya tinggal di daftar.json. Tiga hal sekaligus beres: tidak ada
   jalan tembus lewat "../" di nama berkas, dua berkas bernama sama tidak
   saling menimpa, dan nama yang mengandung apa pun — spasi, tanda kurung,
   huruf beraksen — tidak perlu dipotong supaya aman di disk.

   Daftarnya sendiri terbuka seperti jadwal dinas dan kegiatan berkala: yang
   berdinas perlu tahu dokumen apa yang ada tanpa harus masuk. Yang menuntut
   sesi cuma isi berkasnya.
   ===================================================================== */

const DOK_DIR   = path.join(DATA_DIR, 'dokumen');
const DOK_JSON  = path.join(DOK_DIR, 'daftar.json');
const DOK_BATAS = 25 * 1024 * 1024;      // sama dengan batas yang tertulis di layar

/* Ekstensi yang boleh masuk. Daftar putih, bukan daftar hitam: yang tidak
   disebut ditolak. Tidak ada .exe, .bat, .cmd, .ps1, .js, .html — berkas yang
   bisa dijalankan atau bisa membawa skrip tidak punya urusan di rak dokumen,
   dan sekali ada di sana ia menunggu ditekan orang. */
const DOK_EXT = new Set([
  '.pdf',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.odt', '.ods', '.odp', '.rtf', '.txt', '.csv', '.md',
  '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tif', '.tiff',
  '.zip', '.rar', '.7z',
  '.dwg', '.dxf'
]);

/* Alasannya sama dengan galeri dan jadwal dinas: di Vercel dan sejenisnya yang
   tertulis ke disk hilang begitu fungsinya selesai. Lebih baik menolak dengan
   sebabnya daripada menerima berkas yang diam-diam menguap.

   Sejak berkasnya bisa mendarat di Supabase Storage, yang ditanyakan bukan lagi
   nama lingkungannya melainkan apakah simpanan binernya benar-benar ada. */
const DOK_TULIS = BISA_TULIS_BINER;

function dokumenHidup(_req, res, next) {
  if (DOK_TULIS) return next();
  res.status(503).json({
    error: 'Dokumen tidak bisa disimpan di lingkungan ini: penyimpanannya tidak permanen, '
         + 'jadi berkas yang diunggah akan hilang dengan sendirinya.'
  });
}

const dokIdSah = (x) => /^[a-f0-9]{16}$/.test(String(x || ''));

/** Ekstensi dari nama yang dikirim klien. Yang dipakai cuma ekstensinya —
    sisa namanya tidak pernah menyentuh disk, jadi tidak perlu dibersihkan. */
function dokEkstensi(nama) {
  const e = path.extname(String(nama || '')).toLowerCase();
  return DOK_EXT.has(e) ? e : '';
}

/** Nama yang ikut turun ke peramban saat berkasnya dibuka. Petik ganda, garis
    miring terbalik, dan baris baru dibuang: ketiganya memutus kepala
    Content-Disposition. */
const dokNamaAman = (nama) => String(nama || 'berkas')
  .replace(/[\r\n"\\]/g, '').trim().slice(0, 120) || 'berkas';

/** Satu baris dokumen, dirapikan. Kategori dan kaitan peralatan datang dari
    layar dan boleh apa saja — yang penting panjangnya berhenti di suatu tempat. */
const dokBaris = (b) => ({
  id:       String(b.id || ''),
  berkas:   String(b.berkas || ''),
  nama:     String(b.nama || '').slice(0, 200),
  jenis:    String(b.jenis || '').slice(0, 120),
  ukuran:   Number(b.ukuran) || 0,
  kategori: String(b.kategori || '').slice(0, 40),
  alat:     String(b.alat || '').slice(0, 40),
  waktu:    String(b.waktu || ''),
  oleh:     String(b.oleh || ''),
  olehNama: String(b.olehNama || '')
});

/** Seluruh dokumen, semua unit. Isi berkasnya tidak ikut — hanya keterangannya. */
app.get('/dokumen', async (_req, res) => {
  const daftar = await bacaJson(DOK_JSON, {});
  res.json({ dokumen: daftar, bisaTulis: DOK_TULIS });
});

/**
 * Ambil satu berkas.
 *
 * Menuntut sesi, tidak seperti daftarnya. Yang membedakan: daftar cuma
 * menyebut ada dokumen apa, sementara ini menyerahkan isinya — dan isi berita
 * acara memuat nama serta tanda tangan orang.
 *
 * Yang boleh mengambil siapa pun yang sudah masuk, bukan hanya pemegang
 * unitnya. Dashboard ini memang begitu sejak awal: melihat terbuka untuk semua
 * yang berdinas, yang dipagari per unit adalah menulis.
 */
app.get('/dokumen/:unit/:id', async (req, res) => {
  const unit = String(req.params.unit || '').toLowerCase();
  if (!unitSah(unit) || !dokIdSah(req.params.id)) {
    return res.status(400).json({ error: 'Permintaan tidak sah.' });
  }

  const user = await siapa(req);
  if (!user) {
    return res.status(401).json({ error: 'Masuk dengan akun E-Logbook Anda dulu untuk membuka dokumen.' });
  }

  const daftar = await bacaJson(DOK_JSON, {});
  const baris = (daftar[unit] || []).find((b) => b.id === req.params.id);
  if (!baris) return res.status(404).json({ error: 'Dokumen tidak ada dalam daftar.' });

  /* Jalurnya dirangkai dari id yang sudah lolos /^[a-f0-9]{16}$/ dan dari
     ekstensi yang sudah lolos daftar putih waktu diunggah, bukan dari apa pun
     yang dibawa permintaan ini. Tidak ada bagian nama yang datang dari luar. */
  try {
    const berkas = await bacaBiner(path.join(DOK_DIR, unit, baris.berkas));
    if (!berkas) return res.status(404).json({ error: 'Berkasnya tidak ada lagi di server.' });
    res.setHeader('Content-Disposition', `inline; filename="${dokNamaAman(baris.nama)}"`);
    res.type(berkas.mime).send(berkas.buf);
  } catch (e) {
    /* Berkas yang hilang sudah dijawab 404 di atas. Sampai di sini artinya
       simpanannya yang tidak terjawab, dan itu bukan 404 — mengatakan
       "tidak ada" pada berkas yang sebenarnya ada cuma menyesatkan. */
    console.error('[dokumen] gagal mengambil:', e);
    res.status(502).json({ error: 'Simpanan dokumen tidak terjawab. Coba lagi sebentar lagi.' });
  }
});

/**
 * Penjaga yang sama untuk ketiga rute unggah dokumen. Mengembalikan pemakainya,
 * atau null sesudah menuliskan sendiri jawaban penolakannya — jadi pemanggil
 * cukup berhenti tanpa perlu tahu penolakan mana yang terjadi.
 */
async function dokPenjagaIsi(req, res, unit) {
  if (!unitSah(unit)) { res.status(400).json({ error: 'Kode unit tidak sah.' }); return null; }

  const user = await siapa(req);
  if (!user) {
    res.status(401).json({ error: 'Masuk dengan akun E-Logbook Anda dulu.' });
    return null;
  }
  if (!(await bolehIsi(user, 'dokumen', unit))) {
    res.status(403).json({
      error: bolehUnit(user, unit)
        ? 'Peran akun Anda tidak diberi hak mengisi dokumen unit.'
        : 'Akun Anda tidak memegang unit ini, jadi dokumennya tidak bisa Anda isi.'
    });
    return null;
  }
  return user;
}

/* =====================================================================
   UNGGAH LANGSUNG — dua langkah, dan berkasnya tidak lewat sini

   Vercel membatasi badan permintaan ke fungsi serverless di 4.500.000 byte
   dan tidak menyediakan cara menaikkannya. Dikirim sebagai base64 di dalam
   JSON, itu berarti berkas asli hanya ±3,2 MB yang muat — sementara layar rak
   dokumen menjanjikan 25 MB. Selama berkasnya harus melewati fungsi ini,
   janji itu mustahil ditepati, dan yang didapat pemakai adalah 413 telanjang
   dari Vercel sebelum satu baris pun kode di sini sempat berjalan.

   Jadi berkasnya tidak dilewatkan. '/siap' memeriksa hak dan menentukan nama
   objeknya, lalu menjawab URL bertanda tangan berumur pendek; peramban menaruh
   berkasnya langsung ke Storage. '/catat' memasukkannya ke daftar — dengan
   ukuran yang dibaca dari simpanan, bukan dari angka yang dikirim layar.

   Yang sengaja tidak dijaga: berkas yang sudah mendarat tapi '/catat'-nya tidak
   pernah datang akan tinggal di bucket tanpa tercatat. Ia tidak muncul di layar
   dan tidak merusak apa pun selain memakan ruang. Membereskannya butuh penyapu
   berkala, dan itu pekerjaan tersendiri yang belum ada — disebut di sini supaya
   tidak ditemukan orang lain sebagai kejutan.

   Di kantor jalur ini tidak terpakai: '/siap' menjawab { langsung:false } dan
   layar kembali ke unggahan base64 biasa, yang di sana memang tidak berbatas.
   ===================================================================== */

app.post('/dokumen/:unit/siap', dokumenHidup, badanDinas, async (req, res) => {
  const unit = String(req.params.unit || '').toLowerCase();
  const user = await dokPenjagaIsi(req, res, unit);
  if (!user) return;

  const nama = String(req.body?.nama || '').trim();
  const ext = dokEkstensi(nama);
  if (!ext) {
    return res.status(400).json({
      error: 'Jenis berkas ini tidak diterima. Yang boleh: '
           + [...DOK_EXT].map((x) => x.slice(1).toUpperCase()).join(', ') + '.'
    });
  }

  /* Ukuran di sini masih angka dari layar, jadi ia hanya dipakai untuk menolak
     lebih awal — bukan untuk dicatat. Yang dicatat nanti dibaca dari simpanan. */
  const ukuran = Number(req.body?.ukuran);
  if (!Number.isFinite(ukuran) || ukuran <= 0) {
    return res.status(400).json({ error: 'Ukuran berkas tidak disebut.' });
  }
  if (ukuran > DOK_BATAS) {
    return res.status(413).json({ error: `Berkas lebih dari ${Math.round(DOK_BATAS / 1024 / 1024)} MB.` });
  }

  const id = crypto.randomBytes(8).toString('hex');
  const berkas = id + ext;
  try {
    const url = await urlUnggahBertanda(path.join(DOK_DIR, unit, berkas));
    // Tidak ada Storage yang bisa dituju — di kantor memang begitu, dan itu
    // bukan kegagalan. Layar akan memakai jalur base64 yang lama.
    if (!url) return res.json({ langsung: false });
    res.json({ langsung: true, id, berkas, url });
  } catch (e) {
    console.error('[dokumen] gagal meminta izin unggah:', e);
    res.status(502).json({ error: 'Simpanan tidak memberi izin unggah. Coba lagi sebentar lagi.' });
  }
});

app.post('/dokumen/:unit/catat', dokumenHidup, badanDinas, async (req, res) => {
  const unit = String(req.params.unit || '').toLowerCase();
  const user = await dokPenjagaIsi(req, res, unit);
  if (!user) return;

  const nama = String(req.body?.nama || '').trim();
  const ext = dokEkstensi(nama);
  if (!ext) {
    return res.status(400).json({
      error: 'Jenis berkas ini tidak diterima. Yang boleh: '
           + [...DOK_EXT].map((x) => x.slice(1).toUpperCase()).join(', ') + '.'
    });
  }

  /* Penanda harus persis seperti yang dibuat '/siap'. Tanpa syarat ini, isinya
     bisa dipakai menunjuk nama objek lain di dalam folder unit ini. */
  const id = String(req.body?.id || '');
  if (!/^[0-9a-f]{16}$/.test(id)) {
    return res.status(400).json({ error: 'Penanda unggahan tidak sah.' });
  }
  const berkas = id + ext;
  const jalur = path.join(DOK_DIR, unit, berkas);

  try {
    /* Sekaligus dua hal: bukti bahwa berkasnya memang mendarat, dan ukuran
       sebenarnya. Unggahan yang putus di tengah mendarat lebih kecil daripada
       yang dijanjikan layar, dan catatan yang berbohong soal itu lebih buruk
       daripada tidak mencatat sama sekali. */
    const ukuran = await ukuranBiner(jalur);
    if (!ukuran) {
      return res.status(404).json({
        error: 'Berkasnya tidak ada di simpanan — unggahannya mungkin terputus. Coba ulangi.'
      });
    }
    if (ukuran > DOK_BATAS) {
      await hapusBiner(jalur);
      return res.status(413).json({ error: `Berkas lebih dari ${Math.round(DOK_BATAS / 1024 / 1024)} MB.` });
    }

    const daftar = await bacaJson(DOK_JSON, {});
    const isiUnit = daftar[unit] || (daftar[unit] = []);
    const baris = dokBaris({
      id, berkas, nama,
      jenis: req.body?.jenis,
      ukuran,
      kategori: req.body?.kategori,
      alat: req.body?.alat,
      waktu: new Date().toISOString(),
      oleh: user.username,
      olehNama: user.nama || user.username
    });
    isiUnit.unshift(baris);
    await tulisJson(DOK_JSON, daftar);

    await catat(user, { modul: 'dokumen', aksi: 'unggah', unit, rincian: nama });
    res.json({ ok: true, baris, jumlah: isiUnit.length });
  } catch (e) {
    console.error('[dokumen] gagal mencatat unggahan langsung:', e);
    res.status(500).json({ error: 'Gagal mencatat berkas: ' + (e?.message || e) });
  }
});

/** Unggah satu berkas. Bentuk badannya sama dengan galeri: base64 di dalam JSON. */
app.post('/dokumen/:unit', dokumenHidup, badanGaleri, async (req, res) => {
  const unit = String(req.params.unit || '').toLowerCase();
  const user = await dokPenjagaIsi(req, res, unit);
  if (!user) return;

  const nama = String(req.body?.nama || '').trim();
  const ext = dokEkstensi(nama);
  if (!ext) {
    return res.status(400).json({
      error: 'Jenis berkas ini tidak diterima. Yang boleh: '
           + [...DOK_EXT].map((x) => x.slice(1).toUpperCase()).join(', ') + '.'
    });
  }

  const isi = Buffer.from(String(req.body?.isi || ''), 'base64');
  if (!isi.length) return res.status(400).json({ error: 'Isi berkas kosong.' });
  if (isi.length > DOK_BATAS) {
    return res.status(413).json({ error: `Berkas lebih dari ${Math.round(DOK_BATAS / 1024 / 1024)} MB.` });
  }

  try {
    const id = crypto.randomBytes(8).toString('hex');
    const berkas = id + ext;
    await tulisBiner(path.join(DOK_DIR, unit, berkas), isi);

    const daftar = await bacaJson(DOK_JSON, {});
    const isiUnit = daftar[unit] || (daftar[unit] = []);
    const baris = dokBaris({
      id, berkas, nama,
      jenis: req.body?.jenis,
      // dari berkas yang benar-benar tersimpan, bukan dari angka yang dikirim layar
      ukuran: isi.length,
      kategori: req.body?.kategori,
      alat: req.body?.alat,
      waktu: new Date().toISOString(),
      oleh: user.username,
      olehNama: user.nama || user.username
    });
    isiUnit.unshift(baris);        // terbaru di atas, sama dengan urutan di layar
    await tulisJson(DOK_JSON, daftar);

    await catat(user, { modul: 'dokumen', aksi: 'unggah', unit, rincian: nama });
    res.json({ ok: true, baris, jumlah: isiUnit.length });
  } catch (e) {
    console.error('[dokumen] gagal menyimpan:', e);
    res.status(500).json({ error: 'Gagal menyimpan berkas: ' + (e?.message || e) });
  }
});

/**
 * Ganti kategori atau kaitan peralatannya. Berkasnya sendiri tidak tersentuh,
 * jadi ini masih "mengisi", bukan "menghapus" — haknya pun hak mengisi.
 */
app.patch('/dokumen/:unit/:id', dokumenHidup, badanGaleri, async (req, res) => {
  const unit = String(req.params.unit || '').toLowerCase();
  if (!unitSah(unit) || !dokIdSah(req.params.id)) {
    return res.status(400).json({ error: 'Permintaan tidak sah.' });
  }

  const user = await siapa(req);
  if (!user) return res.status(401).json({ error: 'Masuk dengan akun E-Logbook Anda dulu.' });
  if (!(await bolehIsi(user, 'dokumen', unit))) {
    return res.status(403).json({ error: 'Akun Anda tidak berhak mengubah dokumen unit ini.' });
  }

  try {
    const daftar = await bacaJson(DOK_JSON, {});
    const baris = (daftar[unit] || []).find((b) => b.id === req.params.id);
    if (!baris) return res.status(404).json({ error: 'Dokumen tidak ada dalam daftar.' });

    if (req.body?.kategori !== undefined) baris.kategori = String(req.body.kategori).slice(0, 40);
    if (req.body?.alat !== undefined)     baris.alat     = String(req.body.alat).slice(0, 40);
    await tulisJson(DOK_JSON, daftar);

    await catat(user, { modul: 'dokumen', aksi: 'ubah', unit, rincian: baris.nama });
    res.json({ ok: true, baris: dokBaris(baris) });
  } catch (e) {
    console.error('[dokumen] gagal mengubah:', e);
    res.status(500).json({ error: 'Gagal mengubah: ' + (e?.message || e) });
  }
});

/** Keluarkan satu dokumen. Berkasnya ikut dihapus dari disk — daftar yang
    kosong sementara berkasnya menumpuk cuma menyisakan sampah tak terlihat. */
app.delete('/dokumen/:unit/:id', dokumenHidup, async (req, res) => {
  const unit = String(req.params.unit || '').toLowerCase();
  if (!unitSah(unit) || !dokIdSah(req.params.id)) {
    return res.status(400).json({ error: 'Permintaan tidak sah.' });
  }

  const user = await siapa(req);
  if (!user) return res.status(401).json({ error: 'Masuk dengan akun E-Logbook Anda dulu.' });
  if (!(await bolehHapus(user, 'dokumen', unit))) {
    return res.status(403).json({
      error: 'Mengeluarkan dokumen hanya bisa dilakukan administrator. Yang lain boleh menambah '
           + 'dan mengubah keterangannya.'
    });
  }

  try {
    const daftar = await bacaJson(DOK_JSON, {});
    const isiUnit = daftar[unit] || [];
    const baris = isiUnit.find((b) => b.id === req.params.id);
    if (!baris) return res.status(404).json({ error: 'Dokumen tidak ada dalam daftar.' });

    daftar[unit] = isiUnit.filter((b) => b.id !== baris.id);
    await tulisJson(DOK_JSON, daftar);
    await hapusBiner(path.join(DOK_DIR, unit, baris.berkas));

    await catat(user, { modul: 'dokumen', aksi: 'hapus', unit, rincian: baris.nama });
    res.json({ ok: true });
  } catch (e) {
    console.error('[dokumen] gagal menghapus:', e);
    res.status(500).json({ error: 'Gagal menghapus: ' + (e?.message || e) });
  }
});

/* =====================================================================
   BUKTI SERTIFIKAT PERSONEL — berkasnya, bukan cuma nomornya

   Sampai sekarang satu baris sertifikat cuma memuat jenis, nama, nomor,
   rating, dan dua tanggal. Yang ditanya orang pertama kali saat lisensi
   diperiksa bukan itu, melainkan "mana pindaiannya" — dan jawabannya selama
   ini ada di folder pribadi masing-masing.

   Bentuk simpanannya sengaja dibuat sama persis dengan rak dokumen unit:
   berkas di luar public/, nama di disk = <id><ekstensi> bukan nama aslinya,
   dan satu-satunya jalan mengambilnya lewat rute yang menuntut sesi. Yang
   berbeda cuma kunci raknya — di sana kode unit, di sini id orangnya.

   LEBIH TERTUTUP DARIPADA DOKUMEN UNIT, DAN ITU DISENGAJA. Daftar dokumen unit
   terbuka tanpa masuk karena yang berdinas perlu tahu ada SOP apa. Daftar ini
   tidak: nama berkasnya sendiri sudah menyebut jenis lisensi dan sering nomor
   serinya, dan itu identitas orang — hal yang sama yang membuat nomor lisensi
   disamarkan untuk yang belum masuk di GET /personel.

   Yang boleh mengunggah: yang boleh mengubah data personel unit itu. Yang
   boleh menghapus: administrator — sama dengan bagian data personel lainnya.
   ===================================================================== */

const PSN_DIR  = path.join(DATA_DIR, 'personel-berkas');
const PSN_JSON = path.join(PSN_DIR, 'daftar.json');

/** Rak berkas satu orang. Bentuknya sama dengan dokBaris, ditambah `sert` —
    id baris sertifikat yang dibuktikannya, atau kosong kalau berdiri sendiri. */
const psnBerkasBaris = (b) => ({
  id:       String(b.id || ''),
  sert:     String(b.sert || '').slice(0, 40),
  berkas:   String(b.berkas || ''),
  nama:     String(b.nama || '').slice(0, 200),
  jenis:    String(b.jenis || '').slice(0, 120),
  ukuran:   Number(b.ukuran) || 0,
  waktu:    String(b.waktu || ''),
  oleh:     String(b.oleh || ''),
  olehNama: String(b.olehNama || '')
});

/**
 * Penjaga bersama untuk keempat rute yang menulis.
 *
 * Mengembalikan { user, orang } atau null sesudah menuliskan sendiri jawaban
 * penolakannya. Orangnya ikut dicari di sini, bukan di tiap rute: pagar unit
 * berdiri di atas unit ORANGNYA, dan tanpa barisnya tidak ada unit yang bisa
 * dijadikan pagar.
 */
async function psnPenjagaIsi(req, res) {
  const id = String(req.params.id || '').trim().slice(0, 40).replace(/[^A-Za-z0-9_-]/g, '');
  if (!id) { res.status(400).json({ error: 'Penanda personel tidak sah.' }); return null; }

  if (!DOK_TULIS) {
    res.status(503).json({
      error: 'Berkas tidak bisa disimpan di lingkungan ini: penyimpanannya tidak permanen, '
           + 'jadi yang diunggah akan hilang dengan sendirinya.'
    });
    return null;
  }

  const user = await siapa(req);
  if (!user) { res.status(401).json({ error: 'Masuk dengan akun E-Logbook Anda dulu.' }); return null; }

  const orang = (await bacaJson(PERSONEL_JSON, [])).find((p) => p.id === id);
  if (!orang) { res.status(404).json({ error: 'Personel tidak ada dalam daftar.' }); return null; }

  if (!(await bolehIsi(user, 'personel')) || !bolehUnit(user, orang.unit)) {
    res.status(403).json({
      error: bolehUnit(user, orang.unit)
        ? 'Peran akun Anda tidak diberi hak mengubah data personel.'
        : 'Akun Anda tidak memegang unit orang ini, jadi berkasnya tidak bisa Anda isi.'
    });
    return null;
  }
  return { user, orang, id };
}

/** Rak seluruh orang. Menuntut sesi — alasannya di kepala blok ini. */
app.get('/personel/berkas', async (req, res) => {
  if (!(await siapa(req))) {
    return res.status(401).json({ error: 'Masuk dengan akun E-Logbook Anda dulu.' });
  }
  res.json({ berkas: await bacaJson(PSN_JSON, {}), bisaTulis: DOK_TULIS });
});

/** Minta izin unggah langsung. Bentuknya sama dengan /dokumen/:unit/siap, dan
    alasannya sama: batas 4.500.000 byte di Vercel. Pindaian sertifikat A4
    berwarna lewat dengan mudah di atas angka itu. */
app.post('/personel/:id/berkas/siap', badanDinas, async (req, res) => {
  const penjaga = await psnPenjagaIsi(req, res);
  if (!penjaga) return;

  const nama = String(req.body?.nama || '').trim();
  const ext = dokEkstensi(nama);
  if (!ext) {
    return res.status(400).json({
      error: 'Jenis berkas ini tidak diterima. Yang boleh: '
           + [...DOK_EXT].map((x) => x.slice(1).toUpperCase()).join(', ') + '.'
    });
  }
  const ukuran = Number(req.body?.ukuran);
  if (!Number.isFinite(ukuran) || ukuran <= 0) {
    return res.status(400).json({ error: 'Ukuran berkas tidak disebut.' });
  }
  if (ukuran > DOK_BATAS) {
    return res.status(413).json({ error: `Berkas lebih dari ${Math.round(DOK_BATAS / 1024 / 1024)} MB.` });
  }

  const bid = crypto.randomBytes(8).toString('hex');
  const berkas = bid + ext;
  try {
    const url = await urlUnggahBertanda(path.join(PSN_DIR, penjaga.id, berkas));
    if (!url) return res.json({ langsung: false });
    res.json({ langsung: true, id: bid, berkas, url });
  } catch (e) {
    console.error('[personel] gagal meminta izin unggah:', e);
    res.status(502).json({ error: 'Simpanan tidak memberi izin unggah. Coba lagi sebentar lagi.' });
  }
});

/** Catat berkas yang sudah mendarat lewat URL bertanda tangan. */
app.post('/personel/:id/berkas/catat', badanDinas, async (req, res) => {
  const penjaga = await psnPenjagaIsi(req, res);
  if (!penjaga) return;

  const nama = String(req.body?.nama || '').trim();
  const ext = dokEkstensi(nama);
  if (!ext) return res.status(400).json({ error: 'Jenis berkas ini tidak diterima.' });

  const bid = String(req.body?.id || '');
  if (!/^[0-9a-f]{16}$/.test(bid)) {
    return res.status(400).json({ error: 'Penanda unggahan tidak sah.' });
  }
  const berkas = bid + ext;
  const jalur = path.join(PSN_DIR, penjaga.id, berkas);

  try {
    // Ukurannya dibaca dari simpanan, bukan dari angka yang dikirim layar:
    // unggahan yang putus di tengah mendarat lebih kecil daripada yang
    // dijanjikan, dan catatan yang berbohong soal itu lebih buruk daripada
    // tidak mencatat sama sekali.
    const ukuran = await ukuranBiner(jalur);
    if (!ukuran) {
      return res.status(404).json({
        error: 'Berkasnya tidak ada di simpanan — unggahannya mungkin terputus. Coba ulangi.'
      });
    }
    if (ukuran > DOK_BATAS) {
      await hapusBiner(jalur);
      return res.status(413).json({ error: `Berkas lebih dari ${Math.round(DOK_BATAS / 1024 / 1024)} MB.` });
    }
    res.json({ ok: true, baris: await psnBerkasSimpan(penjaga, { id: bid, berkas, nama, ukuran, req }) });
  } catch (e) {
    console.error('[personel] gagal mencatat unggahan langsung:', e);
    res.status(500).json({ error: 'Gagal mencatat berkas: ' + (e?.message || e) });
  }
});

/** Unggah base64 — jalur kantor, dan cadangan kalau Storage tidak menjawab. */
app.post('/personel/:id/berkas', badanGaleri, async (req, res) => {
  const penjaga = await psnPenjagaIsi(req, res);
  if (!penjaga) return;

  const nama = String(req.body?.nama || '').trim();
  const ext = dokEkstensi(nama);
  if (!ext) {
    return res.status(400).json({
      error: 'Jenis berkas ini tidak diterima. Yang boleh: '
           + [...DOK_EXT].map((x) => x.slice(1).toUpperCase()).join(', ') + '.'
    });
  }

  const isi = Buffer.from(String(req.body?.isi || ''), 'base64');
  if (!isi.length) return res.status(400).json({ error: 'Isi berkas kosong.' });
  if (isi.length > DOK_BATAS) {
    return res.status(413).json({ error: `Berkas lebih dari ${Math.round(DOK_BATAS / 1024 / 1024)} MB.` });
  }

  try {
    const bid = crypto.randomBytes(8).toString('hex');
    const berkas = bid + ext;
    await tulisBiner(path.join(PSN_DIR, penjaga.id, berkas), isi);
    res.json({
      ok: true,
      baris: await psnBerkasSimpan(penjaga, { id: bid, berkas, nama, ukuran: isi.length, req })
    });
  } catch (e) {
    console.error('[personel] gagal menyimpan berkas:', e);
    res.status(500).json({ error: 'Gagal menyimpan berkas: ' + (e?.message || e) });
  }
});

/** Satu-satunya tempat rak ditulis — dipakai kedua jalur unggah di atas. */
async function psnBerkasSimpan(penjaga, { id, berkas, nama, ukuran, req }) {
  const rak = await bacaJson(PSN_JSON, {});
  const milik = rak[penjaga.id] || (rak[penjaga.id] = []);
  const baris = psnBerkasBaris({
    id, berkas, nama,
    sert: req.body?.sert,
    jenis: req.body?.jenis,
    ukuran,
    waktu: new Date().toISOString(),
    oleh: penjaga.user.username,
    olehNama: penjaga.user.nama || penjaga.user.username
  });
  milik.unshift(baris);
  await tulisJson(PSN_JSON, rak);
  /* Yang disebut di log nama berkasnya, bukan nomor lisensinya — alasan yang
     sama dengan PUT /personel: log aktivitas tidak boleh jadi pintu belakang
     yang membocorkan apa yang sengaja disamarkan di rute utamanya. */
  await catat(penjaga.user, {
    modul: 'personel', aksi: 'unggah', unit: penjaga.orang.unit || '',
    rincian: `${penjaga.orang.nama} · ${nama}`
  });
  return baris;
}

/**
 * Ambil satu berkas.
 *
 * Cukup sudah masuk, tidak harus pemegang unitnya — sama dengan dokumen unit.
 * Yang memeriksa lisensi orang lain saat menyusun jadwal memang perlu
 * membukanya, dan pagar unit di dashboard ini memang menjaga menulis, bukan
 * melihat.
 */
app.get('/personel/:id/berkas/:bid', async (req, res) => {
  const id = String(req.params.id || '').trim().slice(0, 40).replace(/[^A-Za-z0-9_-]/g, '');
  if (!id || !dokIdSah(req.params.bid)) {
    return res.status(400).json({ error: 'Permintaan tidak sah.' });
  }

  const user = await siapa(req);
  if (!user) {
    return res.status(401).json({ error: 'Masuk dengan akun E-Logbook Anda dulu untuk membuka berkas.' });
  }

  const rak = await bacaJson(PSN_JSON, {});
  const baris = (rak[id] || []).find((b) => b.id === req.params.bid);
  if (!baris) return res.status(404).json({ error: 'Berkas tidak ada dalam daftar.' });

  try {
    const isi = await bacaBiner(path.join(PSN_DIR, id, baris.berkas));
    if (!isi) return res.status(404).json({ error: 'Berkasnya tidak ada lagi di simpanan.' });
    res.setHeader('Content-Disposition', `inline; filename="${dokNamaAman(baris.nama)}"`);
    res.type(isi.mime).send(isi.buf);
  } catch (e) {
    console.error('[personel] gagal mengambil berkas:', e);
    res.status(502).json({ error: 'Simpanan berkas tidak terjawab. Coba lagi sebentar lagi.' });
  }
});

/** Keluarkan satu berkas. Berkasnya ikut dihapus — daftar yang kosong
    sementara berkasnya menumpuk cuma menyisakan sampah tak terlihat. */
app.delete('/personel/:id/berkas/:bid', async (req, res) => {
  const penjaga = await psnPenjagaIsi(req, res);
  if (!penjaga) return;
  if (!dokIdSah(req.params.bid)) return res.status(400).json({ error: 'Permintaan tidak sah.' });

  if (!(await bolehHapus(penjaga.user, 'personel'))) {
    return res.status(403).json({
      error: 'Menghapus bukti sertifikat hanya bisa dilakukan administrator. '
           + 'Mengunggah yang baru tetap boleh — yang lama tinggal berdampingan.'
    });
  }

  try {
    const rak = await bacaJson(PSN_JSON, {});
    const milik = rak[penjaga.id] || [];
    const i = milik.findIndex((b) => b.id === req.params.bid);
    if (i < 0) return res.status(404).json({ error: 'Berkas tidak ada dalam daftar.' });

    const [baris] = milik.splice(i, 1);
    if (milik.length) rak[penjaga.id] = milik; else delete rak[penjaga.id];
    await tulisJson(PSN_JSON, rak);
    await hapusBiner(path.join(PSN_DIR, penjaga.id, baris.berkas));

    await catat(penjaga.user, {
      modul: 'personel', aksi: 'hapus-berkas', unit: penjaga.orang.unit || '',
      rincian: `${penjaga.orang.nama} · ${baris.nama}`
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('[personel] gagal menghapus berkas:', e);
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
    portElogbook: TERUS ? Number(new URL(ASAL).port || 80) : null,
    /* Ke mana simpanan menulis. Bukan rahasia — ia cuma menyebut jalurnya,
       bukan alamat atau kuncinya.

       Ini yang paling menentukan dan paling tidak terlihat: kalau AVENGER_DB
       tidak sampai ke deployment, aplikasinya tetap menjawab 200 di semua
       halaman, cuma isinya kosong. Tanpa baris ini, satu-satunya cara
       membedakan "belum ada datanya" dari "melihat ke tempat yang salah"
       adalah menebak. */
    simpanan: DI_TABEL ? 'tabel' : 'berkas',
    // Dua kemampuan yang tidak selalu ada, supaya halaman tidak menawarkan
    // tombol yang pasti gagal. Menebaknya dari sisi peramban tidak mungkin:
    // gagalnya baru ketahuan setelah tombolnya terlanjur ditekan.
    galeriBisaTulis: GALERI,
    dokumenBisaTulis: DOK_TULIS,
    // Boleh tidak halaman ini jatuh ke data contoh waktu E-Logbook diam.
    // Di server kantor jawabannya tidak: di sana server yang tidak terjawab
    // adalah kerusakan yang pantas terlihat, bukan alasan menampilkan angka
    // karangan yang bisa disangka nyata oleh yang membaca.
    // DATA_CONTOH=0 di server kantor; bawaannya menyala.
    dataContoh: DATA_CONTOH,
    // Tanpa penerusan, alamat E-Logbook tidak bisa dirangkai dari hostname yang
    // sedang dipakai — di cloud, hostname:3000 menunjuk entah ke mana. Hanya
    // ELOGBOOK_TAUTAN yang berlaku di situ.
    elogbookTerjangkau: TERUS || !!process.env.ELOGBOOK_TAUTAN
  });
});

/* =====================================================================
   FOTO DI JALUR TABEL

   Di server kantor foto ada di public/foto/ dan express.static di bawah yang
   menyajikannya — tidak ada yang berubah di sana, dan rute ini tidak dipasang
   sama sekali.

   Di jalur tabel fotonya tidak ada di disk, jadi ia harus diambilkan dari
   Storage. Rute ini dipasang SEBELUM express.static supaya ia yang menjawab.

   SATU HAL YANG BERUBAH ARTINYA, DAN PANTAS DIKATAKAN TERANG-TERANGAN

   Selama Avenger di kantor, /foto/ terbuka tanpa masuk — dan itu tidak apa-apa,
   karena yang bisa menjangkaunya cuma orang di dalam jaringan kantor. Begitu
   Avenger pindah ke Vercel, rute yang sama terbuka untuk seluruh internet.
   Bucket yang privat TIDAK menutup itu: privat cuma menghalangi jalan langsung
   ke Supabase, sedangkan rute ini berdiri di depannya.

   Karena isinya wajah pegawai di ruang terbatas, di jalur tabel foto unit
   MENUNTUT SESI. Logo unit tidak — ia memang lambang yang untuk dilihat, dan
   menutupnya cuma membuat kop halaman rusak bagi yang belum masuk.

   Kalau suatu saat galeri memang ingin terbuka untuk umum, itu keputusan
   tersendiri yang pantas diambil sadar-sadar, bukan diwarisi diam-diam dari
   cara berkasnya kebetulan disajikan. */
if (DI_TABEL) {
  app.get('/foto/:unit/:berkas', async (req, res) => {
    const unit = String(req.params.unit || '').toLowerCase();
    const logo = unit === '_logo';
    if (!logo && !unitSah(unit)) return res.status(400).json({ error: 'Kode unit tidak sah.' });

    /* Sesi diperiksa SEBELUM daftarnya dibuka, dan urutan itu bukan kebetulan.
       Kalau dibalik, yang terdaftar menjawab 401 sementara yang tidak menjawab
       404 — dan selisih dua angka itu sudah cukup untuk menebak-nebak nama
       berkas dari luar sampai ketemu. Nama foto di sini memuat kode unit dan
       tanggal, jadi yang bocor bukan cuma "ada berkas". */
    if (!logo && !(await siapa(req))) {
      return res.status(401).json({
        error: 'Masuk dengan akun E-Logbook Anda dulu untuk melihat foto unit.'
      });
    }

    /* Yang disajikan hanya yang memang terdaftar. Tanpa syarat ini, rute ini
       jadi jalan membaca objek apa pun di dalam bucket dengan menebak namanya. */
    const nama = path.basename(String(req.params.berkas || ''));
    const terdaftar = logo
      ? Object.values(await bacaJson(LOGO_JSON, {})).some((l) => l && l.berkas === nama)
      : ((await bacaDaftar())[unit] || []).some((f) => f.berkas === nama);
    if (!terdaftar) return res.status(404).json({ error: 'Foto tidak ada dalam daftar.' });

    try {
      const berkas = await bacaBiner(path.join(FOTO_DIR, unit, nama));
      if (!berkas) return res.status(404).json({ error: 'Berkasnya tidak ada lagi di simpanan.' });
      res.type(berkas.mime || mimeDari(nama)).send(berkas.buf);
    } catch (e) {
      console.error('[foto] gagal mengambil:', e);
      res.status(502).json({ error: 'Simpanan foto tidak terjawab.' });
    }
  });
}

app.use(express.static(path.join(ROOT, 'public'), { extensions: ['html'] }));

/* =====================================================================
   START
   ===================================================================== */

/* Dijalankan sendiri (npm start) → menyalakan server sungguhan.
   Diimpor (api/index.js di Vercel) → hanya menyerahkan app-nya, karena di sana
   tidak ada proses yang menyala terus: tiap permintaan memanggil fungsi, dan
   listen() di dalamnya hanya akan menahan port yang tidak pernah dipakai. */
const dijalankanLangsung = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (dijalankanLangsung) {
  app.listen(PORT, HOST, () => {
    console.log(`Dashboard Fasilitas Teknik JATSC — http://localhost:${PORT}`);
    console.log(TERUS
      ? `Data E-Logbook diteruskan ke ${ASAL}`
      : 'Penerusan E-Logbook dimatikan — halaman memakai data contoh.');
    /* Ke mana simpanan menulis adalah hal yang paling mahal kalau salah dan
       paling tidak terlihat kalau tidak dikatakan: jadwal yang tersimpan ke
       tempat yang keliru baru ketahuan waktu orang lain tidak melihatnya. */
    console.log(DI_TABEL
      ? 'Simpanan modul Avenger: tabel avenger_state di Postgres.'
      : `Simpanan modul Avenger: berkas di ${DATA_DIR}`);
    if (!GALERI) console.log('Galeri dimatikan — penyimpanan tidak permanen.');
  });
}

export default app;
