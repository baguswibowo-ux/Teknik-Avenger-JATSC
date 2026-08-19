/**
 * E-LOGBOOK NEW JATSC — SERVER
 *
 * Menggantikan Google Apps Script. Frontend memanggil POST /api/<namaFungsi>
 * dengan body { args: [...] }; nama fungsinya sama persis dengan yang dulu
 * dipanggil lewat google.script.run, sehingga isi Index.html hampir tak berubah.
 *
 * Jalankan:  npm start
 * Konfigurasi lewat environment variable (semuanya opsional):
 *   PORT                     port HTTP (default 3000)
 *   HOST                     alamat bind (default 0.0.0.0 = semua antarmuka)
 *   ELOGBOOK_SECURE_COOKIE   set 1 kalau diakses lewat HTTPS
 *   ELOGBOOK_SESSION_DAYS    umur sesi login (default 30 hari)
 *   AVENGER_TAUTAN           alamat Dashboard Fasilitas Teknik untuk tombol
 *                            pulang. Wajib begitu aplikasi ini tidak lagi di
 *                            port sebelah dashboard — di Vercel, misalnya.
 *                            Kosong: tombolnya disembunyikan, bukan menunjuk
 *                            alamat yang salah.
 */

import express from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

/**
 * Lapisan data dipilih saat start:
 *   ELOGBOOK_DB=postgres  → db-pg.js  (Supabase, berkas di Supabase Storage)
 *   selain itu            → db.js     (SQLite, berkas di folder uploads/)
 *
 * Kedua versi punya nama fungsi yang sama persis. Bedanya versi Postgres
 * async, jadi seluruh pemanggilan di berkas ini memakai await — pada versi
 * SQLite yang sinkron, await tidak mengubah apa pun.
 */
// Baca .env kalau ada. Node punya ini sejak 20.6 — tidak perlu pustaka tambahan.
try { process.loadEnvFile?.(); } catch { /* tidak ada .env: pakai SQLite seperti biasa */ }

const PAKAI_POSTGRES = String(process.env.ELOGBOOK_DB || '').toLowerCase() === 'postgres';

const {
  UPLOAD_DIR, LAMPIRAN_MAKS_BYTE, LAMPIRAN_MAKS_JUMLAH,
  listEntries, insertEntry, removeEntry, updateEntry,
  listDailyChecks, insertDailyCheck, removeDailyCheck, updateDailyCheck, getDailyCheckDetailById,
  listIssues, insertIssue, updateIssue, removeIssue, getIssue,
  tambahLampiranIsu, hapusLampiranIsu,
  listMonitoring, insertMonitoring, removeMonitoring,
  listDsTest, insertDsTest, removeDsTest, DS_SITE, KATEGORI_DS,
  listBerkala, insertBerkala, removeBerkala, BERKALA_ITEM, JENIS_BERKALA,
  LOKASI,
  tambahLampiranLtk, hapusLampiranLtk, getLtk,
  listLtk, insertLtk, removeLtk,
  getUserByUsername, verifyPassword, createUser, countUsers, hapusUser,
  jenisTtdSah, unitCatatan, tandaTanganiCatatan, listPejabatAktif, getInboxTtd,
  getTtdTersimpan, simpanTtdTersimpan, hapusTtdTersimpan, rekapMentah,
  listUsers, setPassword, setAktif, setRole, setNama, ROLE_VALID, SEMUA_UNIT, jumlahAdminAktif,
  UNIT, KODE_UNIT, unitSah, unitUntukUser, setUnitUser,
  createSession, getSessionUser, deleteSession, purgeExpiredSessions,
  ambilBerkas
} = await import(PAKAI_POSTGRES ? './db-pg.js' : './db.js');

const ROOT = path.dirname(fileURLToPath(import.meta.url));

/**
 * Benar kalau berkas ini yang dijalankan (server kantor, npm start), salah
 * kalau ia hanya diimpor sebagai handler serverless oleh api/index.js. Beberapa
 * pekerjaan rumah tangga hanya masuk akal pada proses yang hidup terus — lihat
 * bagian START di bawah.
 */
const DIJALANKAN_LANGSUNG = process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const COOKIE_NAME = 'elogbook_sesi';
const SESSION_DAYS = Number(process.env.ELOGBOOK_SESSION_DAYS || 30);

const app = express();
app.disable('x-powered-by');

// Tanda tangan, StateJSON daily check, dan lampiran hasil scan berukuran besar —
// batas bawaan 100kb jauh dari cukup. Lampiran dikirim sebagai base64 di dalam
// payload, jadi batasnya harus di atas 6 x 8 MB ditambah pemuaian base64.
app.use(express.json({ limit: '80mb' }));

/* ============== SESI ============== */

function readCookie(req, name) {
  const raw = req.headers.cookie;
  if (!raw) return '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i === -1) continue;
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return '';
}

function setSessionCookie(res, token) {
  const bits = [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_DAYS * 86400}`
  ];
  if (process.env.ELOGBOOK_SECURE_COOKIE === '1') bits.push('Secure');
  res.setHeader('Set-Cookie', bits.join('; '));
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

const currentUser = (req) => getSessionUser(readCookie(req, COOKIE_NAME));

async function requireAuth(req, res, next) {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: 'Belum login atau sesi sudah berakhir.' });
  req.user = user;
  next();
}

const isAdmin = (user) => user?.role === 'admin';
/** Pejabat hanya boleh melihat. Yang boleh menambah data cuma admin dan teknisi. */
const bolehMenulis = (user) => user?.role === 'admin' || user?.role === 'teknisi';

/**
 * Satu-satunya perubahan data yang boleh dilakukan pejabat: membubuhkan tanda
 * tangannya sendiri pada petak yang masih kosong. Teknisi tidak termasuk —
 * mereka menandatangani saat mengisi formulirnya.
 */
const bolehTtdSusulan = (user) => user?.role === 'admin' || user?.role === 'pejabat';

/**
 * Pastikan pemakai memang berhak membuka unit yang dimintanya.
 * Unit dikirim klien, jadi tidak boleh dipercaya begitu saja — tanpa
 * pemeriksaan ini siapa pun bisa membaca logbook unit lain hanya dengan
 * mengganti satu kata pada permintaannya.
 */
async function pastikanUnit(user, unit) {
  const kode = String(unit || '').trim();
  if (!unitSah(kode)) throw new Error('Unit logbook tidak dikenal: ' + kode);
  if (!(await unitUntukUser(user)).includes(kode)) {
    throw new Error('Akun Anda tidak diberi akses ke logbook ' + kode + '.');
  }
  return kode;
}

/**
 * Username yang boleh ditunjuk sebagai penerima TTD susulan (lihat db.js:
 * getInboxTtd). Dipercaya balik ke server, bukan sekadar diteruskan dari
 * klien — kalau boleh diisi apa saja, catatan bisa "ditunjuk" ke akun yang
 * bukan pejabat/admin, atau ke akun yang sudah nonaktif.
 */
async function ttdUntukSah(username) {
  const u = String(username || '').trim();
  if (!u) return '';
  const target = await getUserByUsername(u);
  if (!target || !target.aktif) return '';
  if (target.role !== 'pejabat' && target.role !== 'admin') return '';
  return target.username;
}

/* ============== LOGIN ============== */

// Penahan tebak-password sederhana: per alamat IP, di memori.
const gagalLogin = new Map();
const BATAS_GAGAL = 8;
const JEDA_MS = 5 * 60 * 1000;

function bolehCoba(ip) {
  const r = gagalLogin.get(ip);
  if (!r) return true;
  if (Date.now() - r.terakhir > JEDA_MS) { gagalLogin.delete(ip); return true; }
  return r.n < BATAS_GAGAL;
}

function catatGagal(ip) {
  const r = gagalLogin.get(ip) || { n: 0, terakhir: 0 };
  r.n += 1;
  r.terakhir = Date.now();
  gagalLogin.set(ip, r);
}

app.post('/api/login', async (req, res) => {
  const ip = req.ip || 'x';
  if (!bolehCoba(ip)) {
    return res.status(429).json({ error: 'Terlalu banyak percobaan gagal. Tunggu 5 menit.' });
  }
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  const user = username ? await getUserByUsername(username) : null;

  // Pesan sengaja disamakan agar tidak membocorkan username mana yang terdaftar.
  const tolak = () => { catatGagal(ip); return res.status(401).json({ error: 'Username atau password salah.' }); };
  if (!user || !user.aktif) return tolak();
  if (!verifyPassword(password, user.pass_hash, user.pass_salt)) return tolak();

  gagalLogin.delete(ip);
  setSessionCookie(res, await createSession(user.id));
  res.json({ user: { username: user.username, nama: user.nama, role: user.role } });

  // Di serverless tidak ada proses yang hidup terus untuk menjadwalkan
  // pembersihan, jadi disisipkan di sini: login jarang terjadi (sesi berumur
  // 30 hari), dan karena dikerjakan setelah jawaban dikirim, orangnya tidak
  // ikut menunggu. Kalau wadahnya keburu dibekukan, giliran login berikutnya
  // yang mengerjakan — tidak ada yang rusak kalau terlewat.
  if (!DIJALANKAN_LANGSUNG) {
    purgeExpiredSessions().catch((err) =>
      console.error('[sesi] gagal membersihkan sesi kedaluwarsa:', err?.message || err));
  }
});

app.post('/api/logout', async (req, res) => {
  const token = readCookie(req, COOKIE_NAME);
  if (token) await deleteSession(token);
  clearSessionCookie(res);
  res.json({ ok: true });
});

/**
 * Pendaftaran mandiri. Akun terbentuk dalam keadaan NONAKTIF dan tanpa unit,
 * jadi belum bisa masuk maupun membuka apa pun sampai administrator
 * mengaktifkannya dan menentukan perannya. Dengan begitu, membuka pendaftaran
 * tidak sama dengan membuka pintu.
 */
app.post('/api/daftar', async (req, res) => {
  const ip = req.ip || 'x';
  // Memakai penahan yang sama dengan login, supaya pendaftaran tidak bisa
  // dipakai membanjiri database.
  if (!bolehCoba(ip)) {
    return res.status(429).json({ error: 'Terlalu banyak percobaan. Tunggu 5 menit.' });
  }

  const username = String(req.body?.username || '').trim().toLowerCase();
  const nama = String(req.body?.nama || '').trim();
  const password = String(req.body?.password || '');

  try {
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
      throw new Error('Username 3–32 karakter, hanya huruf kecil, angka, titik, garis bawah, atau strip.');
    }
    if (!nama) throw new Error('Nama lengkap belum diisi.');
    if (password.length < 6) throw new Error('Password minimal 6 karakter.');
    if (await getUserByUsername(username)) throw new Error('Username itu sudah dipakai. Pilih yang lain.');

    const dibuat = await createUser({ username, password, nama, role: 'teknisi', unit: [] });
    await setAktif(username, false);
    console.log('[daftar] akun baru menunggu konfirmasi:', username);
    res.json({ ok: true, username: dibuat.username });
  } catch (err) {
    catatGagal(ip);
    res.status(400).json({ error: err?.message || 'Pendaftaran gagal.' });
  }
});

/**
 * Siapa yang sedang masuk.
 *
 * Dashboard Fasilitas Teknik menanyakan endpoint ini untuk tiap permintaan
 * yang menulis — ia tidak punya sesi sendiri. Karena itu unit ikut dijawab:
 * di sana hak menyunting dipagari per unit ("personel unit ini boleh mengubah
 * sparepart unit ini"), dan pagar itu tidak bisa ditegakkan oleh pihak yang
 * tidak tahu unit apa yang dipegang si pemanggil. Tanpa ini satu-satunya
 * pilihan yang tersisa adalah mempercayai unit yang dikirim peramban —
 * yaitu tidak memagari apa pun.
 *
 * `semuaUnit` dijawab terpisah supaya yang membacanya tidak perlu ikut
 * menghafal peran mana yang memegang seluruh unit; daftar itu milik db.js
 * dan boleh berubah tanpa membuat pembacanya diam-diam jadi salah.
 */
app.get('/api/me', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: 'Belum login.' });
  const unit = await unitUntukUser(user);
  res.json({
    user: {
      username: user.username,
      nama: user.nama,
      role: user.role,
      unit,
      semuaUnit: unit.length === KODE_UNIT.length
    }
  });
});

/**
 * Daftar akun untuk layar masuk — dijawab SEBELUM login, sengaja.
 *
 * Yang diminta: orang memilih namanya dari daftar, bukan mengetik username yang
 * mudah salah eja. Yang dikorbankan harus disebut terang-terangan: /api/login
 * di atas menyamakan pesan salahnya supaya tidak ketahuan username mana yang
 * terdaftar, dan daftar ini membatalkan penjagaan itu. Yang tersisa cuma
 * password, plus penahan 8 percobaan gagal per 5 menit.
 *
 * Karena itu isinya ditipiskan sampai yang benar-benar perlu untuk memilih:
 * username dan nama. Peran, unit, status aktif, apalagi apa pun yang berbau
 * sandi, tidak ikut — semuanya baru terbaca setelah masuk. Akun nonaktif juga
 * tidak muncul: ia tidak bisa dipakai masuk, jadi menampilkannya hanya
 * membocorkan sesuatu tanpa menolong siapa pun.
 *
 * Matikan dengan ELOGBOOK_DAFTAR_AKUN=0 kalau servernya suatu saat terbuka ke
 * jaringan yang lebih luas dari kantor.
 */
const DAFTAR_AKUN_TERBUKA = process.env.ELOGBOOK_DAFTAR_AKUN !== '0';

app.get('/api/akun-daftar', async (_req, res) => {
  if (!DAFTAR_AKUN_TERBUKA) {
    return res.status(404).json({ error: 'Daftar akun tidak dibuka di server ini.' });
  }
  try {
    const daftar = (await listUsers())
      .filter((u) => u.aktif)
      .map((u) => ({ username: u.username, nama: u.nama || u.username }));
    res.json({ akun: daftar });
  } catch (err) {
    console.error('[akun-daftar]', err);
    res.status(500).json({ error: 'Gagal mengambil daftar akun.' });
  }
});

/* ============== API — nama fungsi sama dengan Apps Script lama ============== */

const MAX_ROWS = 200;

/**
 * Fungsi yang boleh dipakai semua pengguna yang sudah login.
 * Isinya hanya membaca dan menambah — tidak ada yang mengubah atau menghapus.
 */
/**
 * Unit yang diminta klien. Klien lama belum mengirimnya sama sekali, jadi
 * kalau kosong dipakai unit pertama yang boleh dibuka akun itu — untuk akun
 * yang ada sekarang berarti Radtel, persis seperti sebelum unit dikenal.
 */
async function unitDiminta(user, unit) {
  const boleh = await unitUntukUser(user);
  if (boleh.length === 0) throw new Error('Akun Anda belum diberi akses ke logbook mana pun.');
  if (!unit) return boleh[0];
  return pastikanUnit(user, unit);
}

/**
 * Unit yang dibuka saat memuat layar, beserta daftar unit yang boleh dibuka
 * akun itu. Berbeda dari unitDiminta: unit yang tidak (lagi) boleh dibuka bukan
 * alasan menggagalkan pemuatan, melainkan dilewati begitu saja dan diganti unit
 * pertama yang memang boleh.
 *
 * Perangkat mengingat unit yang terakhir dibuka, sementara hak unit sebuah akun
 * bisa berubah kapan saja — begitu administrator memindahkannya, ingatan itu
 * jadi usang. Kalau permintaannya ditolak keras, layar akun itu gagal memuat
 * dan orangnya terkunci di luar tanpa tahu sebabnya. Tidak ada risiko kebocoran:
 * yang dikembalikan tetap hanya unit yang boleh dibuka akun itu, dan unit mana
 * yang akhirnya dipakai ikut dikirim di dalam jawaban.
 *
 * Daftar unitnya ikut dikembalikan, bukan diambil lagi terpisah: getAllData
 * membutuhkan keduanya, dan pada lapisan Postgres tiap pengambilan berarti satu
 * perjalanan pulang-pergi ke Supabase.
 */
async function unitDanHakAkses(user, unit) {
  const boleh = await unitUntukUser(user);
  if (boleh.length === 0) throw new Error('Akun Anda belum diberi akses ke logbook mana pun.');
  const diminta = String(unit || '');
  return { boleh, unit: boleh.includes(diminta) ? diminta : boleh[0] };
}

/** Fungsi yang menambah atau mengubah data. Pejabat ditolak di sini. */
const API_TULIS = new Set([
  'addEntry', 'addDailyCheck', 'addIssue', 'addMonitoring', 'addLtk', 'addDsTest', 'addBerkala',
  'updateEntry', 'updateDailyCheck'
]);

/** Fungsi tanda tangan susulan: administrator dan pejabat, bukan teknisi. */
const API_TTD = new Set(['tandaTangani']);

/**
 * Stempel waktu input sebenarnya hanya untuk administrator.
 *
 * Menyembunyikannya di layar saja tidak cukup: jawaban getAllData bisa dibaca
 * apa adanya dari peramban, jadi yang bukan administrator memang tidak boleh
 * menerima angkanya sama sekali. Kolomnya dipakai memeriksa apakah sebuah
 * catatan benar-benar dibuat pada jam yang tertulis — keterangan pemeriksaan,
 * bukan bagian dari isi catatan.
 */
const tanpaJejakInput = (rows) => rows.map(({ DibuatPada, ...sisa }) => sisa);

/* ============== REKAP & MATRIK PENGALAMAN ==============
 * Satu-satunya tempat rumus rekap ditulis. Kedua lapisan database hanya
 * menyetor baris mentah (rekapMentah), sisanya dihitung di sini.
 *
 * Yang dijawab rekap ini bukan "berapa formulir terisi", melainkan APA SAJA
 * YANG SUDAH PERNAH DIALAMI unit ini: kejadian apa yang benar-benar terjadi,
 * kapan pertama kali, dan siapa yang sudah pernah menanganinya.
 *
 * Aturannya satu, dan itu yang menentukan bentuk seluruh jawabannya: TIDAK ADA
 * DAFTAR JENIS KEJADIAN YANG DITETAPKAN LEBIH DULU. Setiap baris lahir dari
 * catatan yang sudah masuk. Jenis yang belum pernah terjadi tidak muncul
 * sebagai baris bernilai nol — ia memang tidak punya baris.
 */

/** Tiga formulir yang mencatat kejadian, beserta cara membacanya.
 *
 *  `teks`   — yang dibaca ATURAN_JENIS untuk mengenali jenis kejadian; sengaja
 *             lebih luas dari yang ditampilkan supaya modul dan kelompok ikut
 *             menentukan golongan tanpa harus ikut terbaca di layar.
 *  `uraian` — yang ditampilkan sebagai isi catatan.
 */
const SUMBER_KEJADIAN = [
  {
    kunci: 'entries', label: 'Logbook',
    teks: (r) => r.uraian,
    uraian: (r) => r.uraian
  },
  {
    kunci: 'ltk', label: 'LTK',
    teks: (r) => [r.peralatan, r.modul, r.kelompok, r.analisa, r.perbaikan].filter(Boolean).join(' '),
    uraian: (r) => [r.peralatan, r.analisa, r.perbaikan].filter(Boolean).join(' — ')
  },
  {
    kunci: 'issues', label: 'Isu',
    teks: (r) => [r.jenis, r.keterangan].filter(Boolean).join(' '),
    uraian: (r) => [r.jenis, r.keterangan].filter(Boolean).join(' — ')
  }
];

/**
 * Jenis kejadian ditebak dari kata kunci pada teks yang diketik teknisi.
 *
 * Ini bagian yang paling lemah dan disengaja terbuka: formulir logbook tidak
 * punya kolom "jenis kegiatan", uraiannya teks bebas, jadi tidak ada yang bisa
 * dijumlahkan langsung. Aturannya dikirim apa adanya ke layar supaya bisa
 * dibantah baris per baris, bukan disembunyikan sebagai angka jadi.
 *
 * URUTANNYA BERPENGARUH — yang pertama cocok yang dipakai, jadi yang lebih
 * khusus ditaruh lebih dulu: "genset mati" harus jatuh ke catu daya, bukan ke
 * peralatan mati; "ganti modul karena alarm" ke penggantian, bukan ke alarm.
 *
 * Yang tidak cocok aturan mana pun TIDAK dipaksa masuk golongan terdekat. Ia
 * masuk "Belum tergolong" dan tetap terlihat — kalau aturannya kurang, itu
 * harus kelihatan, bukan hilang diam-diam ke dalam golongan yang salah.
 */
const ATURAN_JENIS = [
  { jenis: 'Catu daya & kelistrikan', kata: ['genset', 'ups', 'pln', 'listrik', 'catu daya', 'tegangan', 'padam', 'breaker', 'panel ats'] },
  { jenis: 'Penggantian modul / suku cadang', kata: ['ganti', 'penggantian', 'replace', 'sparepart', 'suku cadang'] },
  { jenis: 'Gangguan frekuensi & interferensi', kata: ['interferensi', 'noise', 'jamming', 'frekuensi', 'sinyal lemah', 'modulasi'] },
  { jenis: 'Peralatan mati / tidak berfungsi', kata: ['mati total', 'down', 'tidak berfungsi', 'tidak menyala', 'off air', 'blank', 'hang'] },
  { jenis: 'Alarm & indikasi gangguan', kata: ['alarm', 'warning', 'fault', 'error', 'indikasi', 'abnormal'] },
  { jenis: 'Konfigurasi & perangkat lunak', kata: ['konfigurasi', 'setting', 'software', 'update', 'upgrade', 'restart', 'reboot', 'database'] },
  { jenis: 'Pemeliharaan berkala', kata: ['pemeliharaan', 'preventive', 'perawatan', 'pembersihan', 'cleaning', 'kalibrasi', 'mingguan', 'bulanan'] },
  { jenis: 'Pengecekan & pengukuran', kata: ['pengecekan', 'cek ', 'pengukuran', 'ukur', 'uji', 'test', 'pengamatan', 'monitoring', 'pemeriksaan'] },
  { jenis: 'Koordinasi & serah terima', kata: ['koordinasi', 'serah terima', 'briefing', 'laporan ke', 'melapor'] }
];

const BELUM_TERGOLONG = 'Belum tergolong';

/** Golongan sebuah teks bebas. Spasi pembungkus dipasang supaya kata kunci
 *  berakhiran spasi ("cek ") tidak ikut menangkap "pengecekan". */
function golongkanKejadian(teks) {
  const t = ' ' + String(teks || '').toLowerCase().replace(/\s+/g, ' ') + ' ';
  for (const a of ATURAN_JENIS) {
    for (const k of a.kata) if (t.includes(k)) return a.jenis;
  }
  return BELUM_TERGOLONG;
}

/** Banyaknya catatan yang ikut dikirim untuk penelusuran "tekan sel, lihat
 *  catatannya". Matriksnya sendiri tetap dihitung dari SELURUH baris; batas ini
 *  hanya membatasi daftar yang bisa dibuka, supaya rentang setahun tidak
 *  mengirim ribuan uraian sekaligus. */
const MAKS_CATATAN_REKAP = 500;

/**
 * Periode sebuah tanggal. Bulan → "2026-08". Pekan → tanggal Senin-nya, supaya
 * kuncinya bisa diurutkan sebagai teks biasa sekaligus langsung terbaca sebagai
 * tanggal awal pekan. Perhitungannya UTC, sama seperti seluruh aplikasi.
 */
function kunciPeriode(iso, mode) {
  const s = String(iso || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  if (mode === 'bulan') return s.slice(0, 7);
  const d = new Date(s + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));   // mundur ke Senin
  return d.toISOString().slice(0, 10);
}

/** Nama pelaksana sebuah baris: daftar nama kalau ada, kalau tidak nama tunggalnya.
 *  Isu tidak punya kolom teknisi — yang tercatat pelapornya. */
function namaPelaksana(row) {
  let daftar = [];
  try { daftar = JSON.parse(row.teknisi_nama_list || '[]'); } catch { daftar = []; }
  if (!Array.isArray(daftar)) daftar = [];
  const bersih = daftar.map((x) => String(x || '').trim()).filter(Boolean);
  if (bersih.length) return bersih;
  const tunggal = String(row.teknisi_nama || row.dilaporkan_oleh || '').trim();
  return tunggal ? [tunggal] : [];
}

/** Ketiga formulir disatukan jadi satu deretan kejadian yang bentuknya sama,
 *  supaya sisa perhitungannya tidak perlu tahu lagi asal tiap baris. */
function barisKejadian(mentah) {
  const hasil = [];
  for (const s of SUMBER_KEJADIAN) {
    for (const r of (mentah[s.kunci] || [])) {
      const tanggal = String(r.tanggal || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) continue;   // tanggal kosong/rusak: tak bisa ditempatkan
      hasil.push({
        id: String(r.id || ''),
        tanggal,
        asal: s.label,
        jenis: golongkanKejadian(s.teks(r)),
        uraian: String(s.uraian(r) || '').trim(),
        orang: namaPelaksana(r),
        lokasi: String(r.lokasi || '').trim()
      });
    }
  }
  return hasil.sort((a, b) => (a.tanggal < b.tanggal ? 1 : a.tanggal > b.tanggal ? -1 : 0));
}

function susunRekap(mentah, mode) {
  const baris = barisKejadian(mentah);
  const periode = new Set();
  const petaJenis = new Map();   // jenis -> { total, perPeriode, pertama, orang:Set }
  const petaOrang = new Map();   // nama  -> { total, perJenis, pertama }

  for (const b of baris) {
    const k = kunciPeriode(b.tanggal, mode);
    if (!k) continue;
    periode.add(k);

    if (!petaJenis.has(b.jenis)) {
      petaJenis.set(b.jenis, { total: 0, perPeriode: {}, pertama: b.tanggal, orang: new Set() });
    }
    const j = petaJenis.get(b.jenis);
    j.total++;
    j.perPeriode[k] = (j.perPeriode[k] || 0) + 1;
    if (b.tanggal < j.pertama) j.pertama = b.tanggal;

    for (const nama of b.orang) {
      j.orang.add(nama);
      if (!petaOrang.has(nama)) petaOrang.set(nama, { total: 0, perJenis: {}, pertama: b.tanggal });
      const o = petaOrang.get(nama);
      o.total++;
      o.perJenis[b.jenis] = (o.perJenis[b.jenis] || 0) + 1;
      if (b.tanggal < o.pertama) o.pertama = b.tanggal;
    }
  }

  const jenis = [...petaJenis.entries()]
    .map(([nama, d]) => ({
      nama, total: d.total, perPeriode: d.perPeriode, pertama: d.pertama, orang: d.orang.size,
      // Petak periode tempat jenis ini pertama muncul. Dihitung di sini, bukan
      // di layar, supaya rumus "minggu ke berapa" tetap satu tempat saja.
      periodePertama: kunciPeriode(d.pertama, mode)
    }))
    .sort((a, b) => b.total - a.total || a.nama.localeCompare(b.nama));

  const orang = [...petaOrang.entries()]
    .map(([nama, d]) => ({ nama, total: d.total, perJenis: d.perJenis, pertama: d.pertama }))
    .sort((a, b) => b.total - a.total || a.nama.localeCompare(b.nama));

  return {
    mode,
    periode: [...periode].sort(),
    jenis,
    orang,
    totalSemua: baris.length,
    belumTergolong: petaJenis.get(BELUM_TERGOLONG)?.total || 0,
    // Aturannya ikut dikirim supaya layar tidak menyalin ulang daftar kata
    // kunci yang sama — kalau aturannya berubah di sini, layarnya ikut sendiri.
    aturan: ATURAN_JENIS.map((a) => ({ jenis: a.jenis, kata: a.kata })),
    catatan: baris.slice(0, MAKS_CATATAN_REKAP),
    catatanDipotong: Math.max(0, baris.length - MAKS_CATATAN_REKAP)
  };
}

const API = {
  /**
   * Ringkasan dan matriks satu unit untuk satu rentang tanggal. Argumennya satu
   * objek, bukan deretan parameter — supaya menambah saringan kelak tidak
   * menggeser posisi identitas pemanggil yang selalu jadi argumen terakhir.
   */
  getRekap: async (opsi, user) => {
    const o = opsi && typeof opsi === 'object' ? opsi : {};
    const unit = await unitDiminta(user, o.unit);
    const mode = o.mode === 'bulan' ? 'bulan' : 'pekan';
    const dari = String(o.dari || '').slice(0, 10);
    const sampai = String(o.sampai || '').slice(0, 10);
    const hasil = susunRekap(await rekapMentah(unit, dari, sampai), mode);
    return { ...hasil, unit, dari, sampai };
  },

  getAllData: async (unit, user) => {
    // Pemanggil boleh tidak menyertakan unit sama sekali. Argumen terakhir
    // selalu identitas pemanggil, jadi kalau yang masuk ke posisi unit ternyata
    // objek pengguna, berarti unitnya memang tidak dikirim.
    if (unit && typeof unit === 'object') { user = unit; unit = ''; }
    const { boleh: bolehUnit, unit: u } = await unitDanHakAkses(user, unit);
    const jejak = isAdmin(user) ? (rows) => rows : tanpaJejakInput;

    /**
     * Sebelas pengambilan di bawah ini tidak saling bergantung — tidak ada yang
     * memakai hasil yang lain — jadi dijalankan berbarengan, bukan berderet.
     *
     * Pada SQLite bedanya tidak terasa: fungsinya sinkron, jadi tetap berjalan
     * satu per satu dan Promise.all cuma membungkus nilai yang sudah jadi. Yang
     * berubah adalah lapisan Postgres: berderet berarti sebelas kali menunggu
     * jaringan ke Supabase secara berurutan, dan itulah yang membuat pemuatan
     * pertama di Vercel memakan waktu detikan. Berbarengan, yang menentukan
     * hanya kueri paling lambat.
     */
    const [entries, dcHistory, issues, monitoring, ltk, dstest, berkala,
           users, pejabatList, inboxTtd, ttdTersimpan] = await Promise.all([
      listEntries(u, MAX_ROWS),
      listDailyChecks(u, MAX_ROWS),
      listIssues(u),
      listMonitoring(u, MAX_ROWS),
      listLtk(u, MAX_ROWS),
      listDsTest(u, MAX_ROWS),
      listBerkala(u, MAX_ROWS),
      isAdmin(user) ? listUsers() : [],
      // Daftar pejabat untuk menunjuk penerima TTD susulan saat mengisi
      // formulir — perlu diketahui seluruh pengguna, bukan cuma admin.
      listPejabatAktif(),
      // Kotak masuk TTD hanya berarti untuk peran yang memang bisa menandatangani.
      bolehTtdSusulan(user) ? getInboxTtd(user.username) : [],
      // Tanda tangan tersimpan milik akun yang sedang masuk — miliknya sendiri
      // saja, tidak pernah milik orang lain.
      getTtdTersimpan(user.username)
    ]);

    return {
      unit: u,
      unitSaya: UNIT.filter((x) => bolehUnit.includes(x.kode)),
      entries: jejak(entries),
      dcHistory: jejak(dcHistory),
      issues: jejak(issues),
      monitoring: jejak(monitoring),
      ltk: jejak(ltk),
      dstest: jejak(dstest),
      dsSite: DS_SITE,
      kategoriDs: KATEGORI_DS,
      berkala: jejak(berkala),
      // Daftar pekerjaan berkala ikut dikirim, bukan ditanam di layar: satu
      // sumber di berkala-item.js, dan menambah pekerjaan tidak perlu
      // menyentuh berkas peramban.
      berkalaItem: BERKALA_ITEM,
      jenisBerkala: JENIS_BERKALA,
      lokasi: LOKASI,
      batasLampiran: { maksByte: LAMPIRAN_MAKS_BYTE, maksJumlah: LAMPIRAN_MAKS_JUMLAH },
      users,
      pejabatList,
      inboxTtd,
      ttdTersimpan
    };
  },

  addEntry: async (entry, user) => insertEntry(
    { ...(entry || {}), unit: await unitDiminta(user, entry?.unit), ttdUntuk: await ttdUntukSah(entry?.ttdUntuk) },
    user.username, user.nama),

  /**
   * Sunting catatan logbook yang sudah tersimpan. Hanya pembuat aslinya atau
   * admin — teknisi lain boleh melihat dan menambah catatan baru, tapi tidak
   * mengubah punya orang lain. updateEntry sendiri yang memastikan ini
   * (row.dibuat_oleh dicocokkan di sana), karena baris catatannya sudah
   * diambil di situ juga — tidak perlu baca dua kali.
   */
  updateEntry: async (id, patch, user) => {
    const unit = await unitCatatan('logbook', String(id));
    if (!unit) throw new Error('Catatan tidak ditemukan — mungkin sudah dihapus.');
    await pastikanUnit(user, unit);
    return updateEntry(String(id), patch || {}, { username: user.username, admin: isAdmin(user) });
  },

  addDailyCheck: async (rec, user) => insertDailyCheck(
    { ...(rec || {}), unit: await unitDiminta(user, rec?.unit), ttdUntuk: await ttdUntukSah(rec?.ttdUntuk) },
    user.username, user.nama),

  /** Sunting tanggal daily check yang sudah tersimpan — lihat updateEntry di atas. */
  updateDailyCheck: async (id, patch, user) => {
    const unit = await unitCatatan('dailycheck', String(id));
    if (!unit) throw new Error('Catatan tidak ditemukan — mungkin sudah dihapus.');
    await pastikanUnit(user, unit);
    return updateDailyCheck(String(id), patch || {}, { username: user.username, admin: isAdmin(user) });
  },

  getDailyCheckDetail: (id) => getDailyCheckDetailById(String(id)),

  // Menentukan status isu sama saja dengan mengubahnya — itu hak administrator.
  // Isu dari teknisi selalu masuk berstatus Open, apa pun yang dikirim klien.
  // Lampiran fase closed pun ikut dibuang, karena isunya belum boleh ditutup.
  addMonitoring: async (rec, user) => insertMonitoring(
    { ...(rec || {}), unit: await unitDiminta(user, rec?.unit), ttdUntuk: await ttdUntukSah(rec?.ttdUntuk) },
    user.username, user.nama),

  addDsTest: async (rec, user) => insertDsTest(
    { ...(rec || {}), unit: await unitDiminta(user, rec?.unit), ttdUntuk: await ttdUntukSah(rec?.ttdUntuk) },
    user.username, user.nama),

  addBerkala: async (rec, user) => insertBerkala(
    { ...(rec || {}), unit: await unitDiminta(user, rec?.unit), ttdUntuk: await ttdUntukSah(rec?.ttdUntuk) },
    user.username, user.nama),

  addLtk: async (rec, user) => insertLtk(
    { ...(rec || {}), unit: await unitDiminta(user, rec?.unit), ttdUntuk: await ttdUntukSah(rec?.ttdUntuk) },
    user.username, user.nama),

  /**
   * Bubuhkan tanda tangan pihak kedua pada catatan yang belum ditandatangani.
   *
   * Identitas penandatangan diambil dari akun yang sedang masuk, bukan dari
   * kiriman klien — kalau boleh diketik sendiri, paraf ini kehilangan artinya.
   * Yang disimpan sebagai nama pada formulir tetap tulisan teknisi; identitas
   * ini hanya dicatat sebagai keterangan siapa yang membubuhkan.
   */
  tandaTangani: async (jenis, id, ttd, mode, user) => {
    // Argumen mode dulu menandai stempel QR dan sekarang tidak berarti apa-apa,
    // tetapi tetap diterima: peramban yang masih memegang berkas js lama dari
    // cache mengirimkannya, dan tanpa ini identitas pemanggil mendarat di
    // posisi yang salah. Klien yang lebih tua lagi hanya mengirim tiga argumen.
    if (mode && typeof mode === 'object') { user = mode; }
    const j = String(jenis || '');
    if (!jenisTtdSah(j)) throw new Error('Jenis catatan tidak dikenal: ' + j);

    // Unit catatannya diperiksa juga, walau admin dan pejabat memang memegang
    // seluruh unit — supaya aturan tetap benar kalau kelak ada peran lain.
    const unit = await unitCatatan(j, String(id));
    if (!unit) throw new Error('Catatan tidak ditemukan — mungkin sudah dihapus.');
    await pastikanUnit(user, unit);

    return tandaTanganiCatatan(j, String(id), {
      nama: user.nama || user.username,
      username: user.username,
      role: user.role,
      ttd: String(ttd || '')
    });
  },

  /* ---------- Tanda tangan tersimpan milik akun sendiri ----------
     Sengaja tanpa parameter username: yang bisa disentuh hanya milik akun yang
     sedang masuk. Teknisi maupun pejabat sama-sama boleh — ini tanda tangan
     pribadinya, bukan perubahan pada data logbook, jadi tidak masuk API_TULIS
     yang menutup jalur penambahan data bagi pejabat. */

  simpanTtdSaya: async (dataUrl, user) => {
    const d = String(dataUrl || '');
    if (!d.startsWith('data:image/')) throw new Error('Tanda tangannya masih kosong.');
    return simpanTtdTersimpan(user.username, d);
  },

  hapusTtdSaya: async (user) => hapusTtdTersimpan(user.username),

  addIssue: async (isu, user) => insertIssue(
    {
      ...(isAdmin(user) ? (isu || {}) : { ...(isu || {}), status: 'Open', lampiranClosed: [] }),
      unit: await unitDiminta(user, isu?.unit)
    },
    user.username,
    user.nama
  )
};

const sameUser = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

/**
 * Fungsi khusus administrator: seluruh perubahan, penghapusan, dan pengelolaan
 * akun. Penjagaannya di sini, bukan di tombol — menyembunyikan tombol saja
 * tidak menghalangi siapa pun memanggil API-nya langsung.
 */
const API_ADMIN = {
  deleteEntry: (id) => removeEntry(String(id)),
  deleteDcRecord: (id) => removeDailyCheck(String(id)),

  updateIssueField: (id, headerField, value) => updateIssue(String(id), String(headerField), value),
  deleteIssue: (id) => removeIssue(String(id)),
  deleteMonitoring: (id) => removeMonitoring(String(id)),
  deleteLtk: (id) => removeLtk(String(id)),
  deleteDsTest: (id) => removeDsTest(String(id)),
  deleteBerkala: (id) => removeBerkala(String(id)),

  // Menempel berkas ke LTK yang sudah tersimpan berarti mengubahnya — admin saja.
  addLtkLampiran: async (id, daftar) => {
    if (!(await getLtk(String(id)))) throw new Error('LTK tidak ditemukan.');
    await tambahLampiranLtk(String(id), daftar || []);
    return getLtk(String(id));
  },
  deleteLtkLampiran: async (ltkId, lampiranId) => {
    await hapusLampiranLtk(String(lampiranId));
    return getLtk(String(ltkId));
  },

  // Menempelkan bukti ke isu yang sudah tersimpan berarti mengubah isu itu,
  // jadi ikut aturan yang sama: administrator saja.
  addIssueLampiran: async (id, fase, daftar) => {
    if (!(await getIssue(String(id)))) throw new Error('Isu tidak ditemukan.');
    await tambahLampiranIsu(String(id), String(fase), daftar || []);
    return getIssue(String(id));
  },
  deleteIssueLampiran: async (issueId, lampiranId) => {
    await hapusLampiranIsu(String(lampiranId));
    return getIssue(String(issueId));
  },

  /* ---------- Pengelolaan akun ---------- */

  listUsers: async () => listUsers(),

  addUser: async (data) => {
    const username = String(data?.username || '').trim().toLowerCase();
    const password = String(data?.password || '');
    const nama = String(data?.nama || '').trim();
    const role = ROLE_VALID.includes(data?.role) ? data.role : 'teknisi';

    if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
      throw new Error('Username 3–32 karakter, hanya huruf kecil, angka, titik, garis bawah, atau strip.');
    }
    if (password.length < 6) throw new Error('Password minimal 6 karakter.');
    if (await getUserByUsername(username)) throw new Error(`Username "${username}" sudah dipakai.`);

    // Teknisi tanpa unit tidak bisa membuka apa pun, jadi tolak sejak awal
    // daripada membuat akun yang langsung buntu saat dipakai.
    const unit = (Array.isArray(data?.unit) ? data.unit : []).filter(unitSah);
    // Admin dan pejabat otomatis memegang seluruh unit, jadi tidak perlu dipilih.
    if (!SEMUA_UNIT.includes(role) && unit.length === 0) {
      throw new Error('Pilih minimal satu unit logbook untuk akun teknisi.');
    }

    const dibuat = await createUser({ username, password, nama, role, unit });
    return listUsers();
  },

  setUserUnit: async (username, daftar) => {
    const target = await getUserByUsername(String(username || '').trim());
    if (!target) throw new Error(`Pengguna "${username}" tidak ditemukan.`);
    const unit = (Array.isArray(daftar) ? daftar : []).filter(unitSah);
    if (!SEMUA_UNIT.includes(target.role) && unit.length === 0) {
      throw new Error('Akun teknisi harus punya minimal satu unit logbook.');
    }
    await setUnitUser(target.id, unit);
    return listUsers();
  },

  setUserPassword: async (username, password) => {
    const u = String(username || '').trim();
    if (String(password || '').length < 6) throw new Error('Password minimal 6 karakter.');
    if (!(await getUserByUsername(u))) throw new Error(`Pengguna "${u}" tidak ditemukan.`);
    await setPassword(u, String(password));
    return true;
  },

  /**
   * Ganti nama tampilan akun — dipakai untuk penunjukan TTD susulan
   * (lihat ttdUntukDariNama di 20-ttd-pejabat.js): nama pada formulir
   * dicocokkan persis ke nama akun ini, jadi mengganti sebutan jabatan
   * (mis. "PH Budi" saat penggantian sementara) cukup dengan mengubah nama
   * di sini, tanpa membuat akun baru.
   */
  setUserNama: async (username, nama) => {
    const u = String(username || '').trim();
    const n = String(nama || '').trim();
    if (!n) throw new Error('Nama tidak boleh kosong.');
    if (!(await getUserByUsername(u))) throw new Error(`Pengguna "${u}" tidak ditemukan.`);
    await setNama(u, n);
    return listUsers();
  },

  setUserRole: async (username, role, user) => {
    const u = String(username || '').trim();
    if (!ROLE_VALID.includes(role)) throw new Error('Role tidak dikenal.');
    const target = await getUserByUsername(u);
    if (!target) throw new Error(`Pengguna "${u}" tidak ditemukan.`);
    if (target.role === 'admin' && role !== 'admin' && (await jumlahAdminAktif()) <= 1) {
      throw new Error('Ini administrator aktif terakhir — turunkan perannya hanya setelah ada administrator lain.');
    }
    if (sameUser(target.username, user.username) && role !== 'admin') {
      throw new Error('Anda tidak bisa menurunkan peran akun Anda sendiri.');
    }
    await setRole(u, role);
    return listUsers();
  },

  /**
   * Hapus akun. Hanya yang sudah nonaktif — menonaktifkan dulu memutus sesinya
   * dan memberi jeda untuk berubah pikiran, sedangkan penghapusan ini tidak
   * bisa dibatalkan. Catatan yang pernah diinput akun itu tetap tinggal.
   */
  deleteUser: async (username, user) => {
    const u = String(username || '').trim();
    const target = await getUserByUsername(u);
    if (!target) throw new Error(`Pengguna "${u}" tidak ditemukan.`);
    if (sameUser(target.username, user.username)) {
      throw new Error('Anda tidak bisa menghapus akun Anda sendiri.');
    }
    // Admin nonaktif tidak terhitung admin aktif, jadi menghapusnya tidak
    // mungkin membuat sistem kehabisan pengelola. Syarat nonaktif itulah yang
    // sekaligus menjaga administrator terakhir.
    if (target.aktif) {
      throw new Error('Nonaktifkan akun itu dulu — hanya akun nonaktif yang boleh dihapus.');
    }
    await hapusUser(target.username);
    return listUsers();
  },

  setUserAktif: async (username, aktif, user) => {
    const u = String(username || '').trim();
    const target = await getUserByUsername(u);
    if (!target) throw new Error(`Pengguna "${u}" tidak ditemukan.`);
    if (sameUser(target.username, user.username)) {
      throw new Error('Anda tidak bisa menonaktifkan akun Anda sendiri.');
    }
    if (!aktif && target.role === 'admin' && (await jumlahAdminAktif()) <= 1) {
      throw new Error('Ini administrator aktif terakhir — nonaktifkan hanya setelah ada administrator lain.');
    }
    await setAktif(u, !!aktif);
    return listUsers();
  }
};

app.post('/api/:fn', requireAuth, async (req, res) => {
  const fn = req.params.fn;
  const adminOnly = Object.prototype.hasOwnProperty.call(API_ADMIN, fn);
  const handler = adminOnly ? API_ADMIN[fn]
                : Object.prototype.hasOwnProperty.call(API, fn) ? API[fn]
                : null;
  if (!handler) return res.status(404).json({ error: 'Fungsi tidak dikenal: ' + fn });

  if (adminOnly && !isAdmin(req.user)) {
    return res.status(403).json({ error: 'Hanya administrator yang boleh melakukan ini.' });
  }
  // Peran pejabat sengaja hanya bisa melihat: seluruh unit terbuka baginya,
  // tetapi tidak satu pun jalur penambahan data.
  if (API_TULIS.has(fn) && !bolehMenulis(req.user)) {
    return res.status(403).json({ error: 'Peran Anda hanya dapat melihat, tidak menambah data.' });
  }
  if (API_TTD.has(fn) && !bolehTtdSusulan(req.user)) {
    return res.status(403).json({ error: 'Hanya pejabat dan administrator yang dapat membubuhkan tanda tangan.' });
  }

  const args = Array.isArray(req.body?.args) ? req.body.args : [];
  try {
    // Argumen terakhir selalu identitas pemanggil; handler boleh mengabaikannya.
    const result = await handler(...args, req.user);
    res.json({ result: result === undefined ? null : result });
  } catch (err) {
    console.error(`[api:${fn}]`, err);
    res.status(500).json({ error: err?.message || 'Kesalahan server.' });
  }
});

/* ============== BERKAS STATIS ============== */

// Tanda tangan dan lampiran hanya boleh dilihat setelah login.
// Pada Postgres berkasnya ada di Supabase Storage, jadi disalurkan lewat server
// — bukan lewat URL publik — supaya pemeriksaan login tetap berlaku sama.
if (PAKAI_POSTGRES) {
  app.get('/uploads/:nama', requireAuth, async (req, res) => {
    try {
      const berkas = await ambilBerkas('/uploads/' + req.params.nama);
      if (!berkas) return res.status(404).send('Berkas tidak ditemukan.');
      res.setHeader('Content-Type', berkas.mime);
      res.setHeader('Cache-Control', 'private, max-age=604800');
      res.send(berkas.buf);
    } catch (err) {
      console.error('[uploads]', err);
      res.status(500).send('Gagal mengambil berkas.');
    }
  });
} else {
  app.use('/uploads', requireAuth, express.static(UPLOAD_DIR, {
    maxAge: '7d',
    setHeaders: (res) => res.setHeader('Cache-Control', 'private, max-age=604800')
  }));
}

/**
 * Alamat Dashboard Fasilitas Teknik, untuk tombol pulang di kepala halaman.
 *
 * Disajikan sebagai skrip kecil, bukan ditanam di index.html: berkas itu sama
 * untuk semua pemasangan, sedangkan alamat dashboard berbeda di tiap tempat.
 * Di kantor ia port sebelah; di Vercel ia domain yang sama sekali lain.
 *
 * Kosong berarti "tidak diketahui" — dan layar yang menerimanya memilih
 * menyembunyikan tombolnya daripada menunjuk alamat yang salah. Sebelum ini
 * variabelnya dibaca layar tapi tidak pernah diisi siapa pun, jadi tombol
 * pulang selalu jatuh ke tebakan port 3100: benar di kantor, dan menggantung
 * tanpa pesan apa pun di Vercel.
 */
app.get('/avenger-tautan.js', (req, res) => {
  res.type('application/javascript');
  res.setHeader('Cache-Control', 'no-store');
  res.send('window.AVENGER_TAUTAN = ' + JSON.stringify(process.env.AVENGER_TAUTAN || '') + ';\n');
});

app.use(express.static(path.join(ROOT, 'public'), { extensions: ['html'] }));

app.use((req, res) => res.status(404).send('Halaman tidak ditemukan.'));

/* ============== START ============== */

/**
 * Di Vercel berkas ini tidak dijalankan langsung, melainkan diimpor oleh
 * api/index.js lalu dijadikan handler. Karena itu app.listen() dan persiapan di
 * bawah hanya dijalankan kalau berkas ini memang yang dijalankan — di server
 * kantor dan saat npm start.
 *
 * Keduanya dulu dijalankan tanpa syarat, dan di serverless itu berarti dua
 * perjalanan ke database yang menahan permintaan pertama tiap kali wadahnya
 * baru dinyalakan — padahal jawabannya selalu sama: databasenya tidak kosong.
 * Database Supabase disiapkan sekali di luar aplikasi (npm run migrasi), bukan
 * oleh permintaan HTTP yang kebetulan mendarat di wadah baru.
 *
 * Sesi yang kedaluwarsa tetap tidak bisa dipakai di mana pun: getSessionUser
 * menolak sekaligus menghapusnya. purge hanya merapikan baris yang tertinggal,
 * dan di serverless itu dikerjakan sesudah login berhasil — lihat /api/login.
 */
if (DIJALANKAN_LANGSUNG) {
  // Kalau database masih kosong, buat akun admin awal supaya server bisa langsung dipakai.
  if ((await countUsers()) === 0) {
    const password = crypto.randomBytes(6).toString('base64url');
    await createUser({ username: 'admin', password, nama: 'Administrator', role: 'admin' });
    console.log('\n' + '='.repeat(64));
    // Hanya ASCII: konsol Windows memakai codepage yang merusak karakter seperti em dash.
    console.log('  Database masih kosong. Akun awal dibuat:');
    console.log('    username : admin');
    console.log('    password : ' + password);
    console.log('  CATAT SEKARANG. Password ini tidak ditampilkan lagi.');
    console.log('  Ganti dengan:  npm run user -- passwd admin');
    console.log('='.repeat(64) + '\n');
  }

  await purgeExpiredSessions();
  setInterval(purgeExpiredSessions, 6 * 3600 * 1000).unref();
  app.listen(PORT, HOST, () => {
    console.log(`E-Logbook New JATSC berjalan di http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
    if (HOST === '0.0.0.0') {
      console.log('Dari komputer lain di jaringan kantor: http://<alamat-IP-server>:' + PORT);
    }
  });
}

export default app;
