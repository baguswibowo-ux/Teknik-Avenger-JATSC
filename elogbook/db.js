/**
 * E-LOGBOOK NEW JATSC — LAPISAN DATABASE
 *
 * Memakai SQLite bawaan Node (node:sqlite) supaya tidak ada modul native yang
 * perlu dikompilasi di server kantor. Seluruh database ada di satu berkas:
 *   data/elogbook.db
 * Backup = menyalin berkas itu beserta folder uploads/.
 */

import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isoDariTanggalPanjang } from './tanggal-lama.js';
import { DS_SITE, KATEGORI_DS, kategoriDsSah, dsSiteUntuk } from './ds-site.js';
import { BERKALA_ITEM, JENIS_BERKALA, jenisBerkalaSah, berkalaItemUntuk } from './berkala-item.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.ELOGBOOK_DATA_DIR || path.join(ROOT, 'data');
export const UPLOAD_DIR = process.env.ELOGBOOK_UPLOAD_DIR || path.join(ROOT, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'elogbook.db');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export const db = new DatabaseSync(DB_FILE);

// WAL: penulisan tidak mengunci pembacaan — penting kalau beberapa teknisi
// menyimpan catatan bersamaan saat pergantian dinas.
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

/* Tabel berkala sempat berbentuk mingguan/bulanan berkolom `periode`. Bentuk
   itu dibuang: pekerjaannya sekarang dipecah per jenis, dan kolomnya `jenis`.
   Yang lama disingkirkan di sini supaya CREATE TABLE IF NOT EXISTS di bawah
   benar-benar membuat yang baru — tanpa ini ia menemukan tabel bernama sama
   lalu diam saja, dan kolom `jenis` tidak akan pernah ada.

   Hanya tabel berbentuk lama yang dibuang, dikenali dari kolom `periode`.
   Bentuk baru dilewati, jadi menjalankan ini berkali-kali tidak menghapus
   catatan siapa pun. */
try {
  const kolom = db.prepare("PRAGMA table_info(berkala)").all();
  if (kolom.length && kolom.some((k) => k.name === 'periode')) {
    db.exec('DROP TABLE berkala');
    console.log('[db] tabel berkala bentuk lama (periode) dibuang, dibuat ulang berkolom jenis');
  }
} catch (e) {
  console.error('[db] gagal memeriksa tabel berkala lama:', e?.message || e);
}

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  username     TEXT NOT NULL UNIQUE COLLATE NOCASE,
  nama         TEXT NOT NULL DEFAULT '',
  role         TEXT NOT NULL DEFAULT 'teknisi',
  pass_hash    TEXT NOT NULL,
  pass_salt    TEXT NOT NULL,
  aktif        INTEGER NOT NULL DEFAULT 1,
  dibuat_pada  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token        TEXT PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dibuat_pada  TEXT NOT NULL,
  kadaluarsa   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entries (
  id                TEXT PRIMARY KEY,
  tanggal           TEXT NOT NULL DEFAULT '',
  jam               TEXT NOT NULL DEFAULT '',
  dinas             TEXT NOT NULL DEFAULT '',
  uraian            TEXT NOT NULL DEFAULT '',
  teknisi_nama      TEXT NOT NULL DEFAULT '',
  teknisi_ttd       TEXT NOT NULL DEFAULT '',
  pj_nama           TEXT NOT NULL DEFAULT '',
  pj_ttd            TEXT NOT NULL DEFAULT '',
  teknisi_nama_list TEXT NOT NULL DEFAULT '[]',
  dibuat_pada       TEXT NOT NULL,
  dibuat_oleh       TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_entries_tanggal ON entries(tanggal, jam);

CREATE TABLE IF NOT EXISTS dailychecks (
  id                TEXT PRIMARY KEY,
  tanggal           TEXT NOT NULL DEFAULT '',
  dinas             TEXT NOT NULL DEFAULT '',
  suhu              TEXT NOT NULL DEFAULT '',
  remark            TEXT NOT NULL DEFAULT '',
  teknisi_nama      TEXT NOT NULL DEFAULT '',
  teknisi_ttd       TEXT NOT NULL DEFAULT '',
  manager_nama      TEXT NOT NULL DEFAULT '',
  manager_ttd       TEXT NOT NULL DEFAULT '',
  state_json        TEXT NOT NULL DEFAULT '{}',
  fails_json        TEXT NOT NULL DEFAULT '[]',
  warns_json        TEXT NOT NULL DEFAULT '[]',
  teknisi_nama_list TEXT NOT NULL DEFAULT '[]',
  dibuat_pada       TEXT NOT NULL,
  dibuat_oleh       TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_dc_tanggal ON dailychecks(tanggal);

CREATE TABLE IF NOT EXISTS issues (
  id              TEXT PRIMARY KEY,
  jenis           TEXT NOT NULL DEFAULT '',
  keterangan      TEXT NOT NULL DEFAULT '',
  lokasi          TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'Open',
  tanggal_report  TEXT NOT NULL DEFAULT '',
  tanggal_closed  TEXT NOT NULL DEFAULT '',
  dibuat_pada     TEXT NOT NULL,
  dibuat_oleh     TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS lampiran (
  id           TEXT PRIMARY KEY,
  entry_id     TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  nama         TEXT NOT NULL DEFAULT '',
  path         TEXT NOT NULL DEFAULT '',
  mime         TEXT NOT NULL DEFAULT '',
  ukuran       INTEGER NOT NULL DEFAULT 0,
  dibuat_pada  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lampiran_entry ON lampiran(entry_id);

-- Lampiran isu dipisah per fase: 'open' = bukti saat kejadian dilaporkan,
-- 'closed' = bukti saat isu dinyatakan selesai.
CREATE TABLE IF NOT EXISTS lampiran_isu (
  id           TEXT PRIMARY KEY,
  issue_id     TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  fase         TEXT NOT NULL DEFAULT 'open',
  nama         TEXT NOT NULL DEFAULT '',
  path         TEXT NOT NULL DEFAULT '',
  mime         TEXT NOT NULL DEFAULT '',
  ukuran       INTEGER NOT NULL DEFAULT 0,
  dibuat_pada  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lampiran_isu ON lampiran_isu(issue_id);

-- Form Monitoring Frekuensi: satu lembar berisi banyak baris pengamatan.
CREATE TABLE IF NOT EXISTS monitoring (
  id               TEXT PRIMARY KEY,
  unit             TEXT NOT NULL DEFAULT 'radkom',
  tanggal          TEXT NOT NULL DEFAULT '',
  baris_json       TEXT NOT NULL DEFAULT '[]',
  personil_ops     TEXT NOT NULL DEFAULT '',
  personil_teknik  TEXT NOT NULL DEFAULT '',
  teknisi_ttd      TEXT NOT NULL DEFAULT '',
  dibuat_pada      TEXT NOT NULL,
  dibuat_oleh      TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_monitoring_unit ON monitoring(unit, tanggal);

-- LTK: Laporan Terjadinya Kerusakan dan Kegiatan Perbaikan.
CREATE TABLE IF NOT EXISTS ltk (
  id               TEXT PRIMARY KEY,
  unit             TEXT NOT NULL DEFAULT 'radkom',
  tanggal_lapor    TEXT NOT NULL DEFAULT '',
  penyelenggara    TEXT NOT NULL DEFAULT '',
  kelompok         TEXT NOT NULL DEFAULT '',
  peralatan        TEXT NOT NULL DEFAULT '',
  modul            TEXT NOT NULL DEFAULT '',
  analisa          TEXT NOT NULL DEFAULT '',
  perbaikan        TEXT NOT NULL DEFAULT '',
  tanggal_rusak    TEXT NOT NULL DEFAULT '',
  jam_rusak        TEXT NOT NULL DEFAULT '',
  tanggal_selesai  TEXT NOT NULL DEFAULT '',
  jam_selesai      TEXT NOT NULL DEFAULT '',
  jam_terputus     TEXT NOT NULL DEFAULT '',
  kota             TEXT NOT NULL DEFAULT 'Tangerang',
  manager_nama     TEXT NOT NULL DEFAULT '',
  manager_ttd      TEXT NOT NULL DEFAULT '',
  teknisi_nama     TEXT NOT NULL DEFAULT '',
  teknisi_ttd      TEXT NOT NULL DEFAULT '',
  dibuat_pada      TEXT NOT NULL,
  dibuat_oleh      TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_ltk_unit ON ltk(unit, tanggal_lapor);

CREATE TABLE IF NOT EXISTS lampiran_ltk (
  id           TEXT PRIMARY KEY,
  ltk_id       TEXT NOT NULL REFERENCES ltk(id) ON DELETE CASCADE,
  nama         TEXT NOT NULL DEFAULT '',
  path         TEXT NOT NULL DEFAULT '',
  mime         TEXT NOT NULL DEFAULT '',
  ukuran       INTEGER NOT NULL DEFAULT 0,
  dibuat_pada  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lampiran_ltk ON lampiran_ltk(ltk_id);

-- BAPB: Berita Acara Pemasangan Barang. Susunan meta dan tanda tangannya
-- mengikuti berkas Excel resmi (kop PERUM LPPNPI · KANTOR CABANG GEDUNG 611).
-- Daftar barang disimpan sebagai JSON di items_json — kolomnya sama dengan
-- tabel Excel-nya (No, Nama Barang, Ukuran, Banyaknya, Tgl Pemasangan,
-- Keterangan) tanpa kueri per-item, jadi tidak perlu tabel anak. Tiga panel
-- tanda tangan: Manager Pemakai, Manager Teknik, Petugas Pemasangan.
--
-- TTD susulan: hanya SATU slot pihak-kedua yang dirutekan ke akun — Manager
-- Teknik (teknik_nama/teknik_ttd), lewat ttd_untuk seperti form lain (lihat
-- JENIS_TTD 'bapb'). Manager Pemakai tetap dibubuhkan di form saat mengisi
-- dan masih bisa disunting belakangan (updateBapb) selama teknik belum
-- tanda tangan. Petugas (teknisi pelaksana) juga di form saat mengisi.
CREATE TABLE IF NOT EXISTS bapb (
  id               TEXT PRIMARY KEY,
  unit             TEXT NOT NULL DEFAULT 'radkom',
  nomor            TEXT NOT NULL DEFAULT '',
  tanggal          TEXT NOT NULL DEFAULT '',
  untuk_pekerjaan  TEXT NOT NULL DEFAULT '',
  lokasi           TEXT NOT NULL DEFAULT '',
  items_json       TEXT NOT NULL DEFAULT '[]',
  pemakai_nama       TEXT NOT NULL DEFAULT '',
  pemakai_ttd        TEXT NOT NULL DEFAULT '',
  teknik_nama        TEXT NOT NULL DEFAULT '',
  teknik_ttd         TEXT NOT NULL DEFAULT '',
  petugas_nama       TEXT NOT NULL DEFAULT '',
  petugas_nama_list  TEXT NOT NULL DEFAULT '[]',
  petugas_ttd        TEXT NOT NULL DEFAULT '',
  ttd_oleh           TEXT NOT NULL DEFAULT '',
  ttd_pada           TEXT NOT NULL DEFAULT '',
  ttd_untuk          TEXT NOT NULL DEFAULT '',
  dibuat_pada        TEXT NOT NULL,
  dibuat_oleh        TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_bapb_unit ON bapb(unit, tanggal);

-- DS Test: uji sambungan direct speech ke tiap site, satu lembar per sesi uji.
CREATE TABLE IF NOT EXISTS dstest (
  id                TEXT PRIMARY KEY,
  unit              TEXT NOT NULL DEFAULT 'radtel',
  tanggal           TEXT NOT NULL DEFAULT '',
  state_json        TEXT NOT NULL DEFAULT '{}',
  teknisi_nama      TEXT NOT NULL DEFAULT '',
  teknisi_nama_list TEXT NOT NULL DEFAULT '[]',
  teknisi_ttd       TEXT NOT NULL DEFAULT '',
  dibuat_pada       TEXT NOT NULL,
  dibuat_oleh       TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_dstest_unit ON dstest(unit, tanggal);

-- Pekerjaan berkala: satu lembar per jenis pekerjaan per unit. Keempat
-- jenisnya punya tabnya sendiri di layar, tapi satu tabel di sini — bentuk
-- lembarnya sama persis, yang berbeda cuma daftar barisnya.
-- Daftar itemnya di berkala-item.js, bukan di tabel ini: yang disimpan hanya
-- hasil pengisiannya, berkunci kode item. Menambah item tidak perlu migrasi.
CREATE TABLE IF NOT EXISTS berkala (
  id                TEXT PRIMARY KEY,
  unit              TEXT NOT NULL DEFAULT 'radtel',
  jenis             TEXT NOT NULL DEFAULT 'neptuno',
  tanggal           TEXT NOT NULL DEFAULT '',
  state_json        TEXT NOT NULL DEFAULT '{}',
  catatan           TEXT NOT NULL DEFAULT '',
  teknisi_nama      TEXT NOT NULL DEFAULT '',
  teknisi_nama_list TEXT NOT NULL DEFAULT '[]',
  teknisi_ttd       TEXT NOT NULL DEFAULT '',
  manager_nama      TEXT NOT NULL DEFAULT '',
  manager_ttd       TEXT NOT NULL DEFAULT '',
  dibuat_pada       TEXT NOT NULL,
  dibuat_oleh       TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_berkala_unit ON berkala(unit, jenis, tanggal);

-- Unit mana saja yang boleh dibuka sebuah akun. Diatur administrator.
CREATE TABLE IF NOT EXISTS user_unit (
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  unit     TEXT NOT NULL,
  PRIMARY KEY (user_id, unit)
);

CREATE TABLE IF NOT EXISTS telegram_akun (
  username       TEXT PRIMARY KEY COLLATE NOCASE,
  chat_id        TEXT NOT NULL DEFAULT '',
  tautan_token   TEXT NOT NULL DEFAULT '',
  ditautkan_pada TEXT NOT NULL DEFAULT '',
  dibuat_pada    TEXT NOT NULL DEFAULT ''
);
`);

/* ============== MIGRASI KOLOM ==============
 * CREATE TABLE IF NOT EXISTS tidak menambah kolom baru ke tabel yang sudah ada.
 * Database yang dibuat versi lama diperbarui di sini, otomatis saat server hidup. */

function tambahKolom(tabel, kolom, definisi) {
  const sudahAda = db.prepare(`PRAGMA table_info(${tabel})`).all().some((c) => c.name === kolom);
  if (!sudahAda) db.exec(`ALTER TABLE ${tabel} ADD COLUMN ${kolom} ${definisi}`);
}

tambahKolom('issues', 'tanggal_report', "TEXT NOT NULL DEFAULT ''");
tambahKolom('issues', 'tanggal_closed', "TEXT NOT NULL DEFAULT ''");
tambahKolom('issues', 'dibuat_oleh', "TEXT NOT NULL DEFAULT ''");
tambahKolom('issues', 'dilaporkan_oleh', "TEXT NOT NULL DEFAULT ''");
/* Siapa yang menutup isu (username), dan keterangan penutupannya. Terpisah dari
   dilaporkan_oleh — pelapor bisa teknisi lapangan, penutup selalu administrator
   (peran yang boleh mengubah status). ditutup_oleh tersimpan sebagai username;
   nama tampilan disusun listIssues/getIssue dari petaNamaPengguna, sama polanya
   dengan diinputOleh. */
tambahKolom('issues', 'ditutup_oleh', "TEXT NOT NULL DEFAULT ''");
tambahKolom('issues', 'keterangan_closed', "TEXT NOT NULL DEFAULT ''");

/* ---------- Unit logbook ----------
 * Seluruh data yang sudah ada berasal dari Radtel, jadi kolom baru ini
 * default-nya 'radtel' — catatan lama tidak perlu disentuh sama sekali. */
tambahKolom('entries', 'unit', "TEXT NOT NULL DEFAULT 'radtel'");
tambahKolom('dailychecks', 'unit', "TEXT NOT NULL DEFAULT 'radtel'");
tambahKolom('issues', 'unit', "TEXT NOT NULL DEFAULT 'radtel'");

// Kolom khusus Radkom: jam kegiatan punya awal dan akhir, ditambah frekuensi.
tambahKolom('entries', 'jam_selesai', "TEXT NOT NULL DEFAULT ''");
tambahKolom('entries', 'frek', "TEXT NOT NULL DEFAULT ''");

// Monitoring: tanda tangan personil operasi dan daftar nama teknisi pelaksana.
tambahKolom('monitoring', 'personil_ops_ttd', "TEXT NOT NULL DEFAULT ''");
tambahKolom('monitoring', 'teknisi_nama_list', "TEXT NOT NULL DEFAULT '[]'");

/* Lokasi gedung tempat catatan dibuat. Kosong pada catatan lama: gedungnya
   memang tidak pernah dicatat waktu itu, dan menebaknya sekarang sama saja
   dengan mengarang isi buku catatan. */
tambahKolom('entries', 'lokasi', "TEXT NOT NULL DEFAULT ''");

/* Siapa yang membubuhkan tanda tangan susulan, dan kapan. Terpisah dari nama
   pada formulir — nama itu milik teknisi yang mengisi, ini sekadar keterangan
   status yang tidak pernah ikut tercetak.

   ttd_untuk: akun yang DITUNJUK untuk membubuhkan — beda dari ttd_oleh yang
   baru terisi SETELAH tanda tangannya dibubuhkan. Dipakai untuk kotak masuk
   TTD (lihat getInboxTtd): begitu teknisi menuliskan nama yang cocok dengan
   akun pejabat/manager teknik yang dikenal, akun itu bisa melihat sendiri
   catatan mana saja yang menunggunya. Menunjuk akun bukan berarti hanya akun
   itu yang boleh menandatangani — pejabat lain tetap bisa membubuhkan seperti
   biasa kalau yang ditunjuk sedang tidak dinas. */
for (const tabel of ['entries', 'dailychecks', 'monitoring', 'dstest', 'ltk', 'berkala', 'bapb']) {
  tambahKolom(tabel, 'ttd_oleh', "TEXT NOT NULL DEFAULT ''");
  tambahKolom(tabel, 'ttd_pada', "TEXT NOT NULL DEFAULT ''");
  tambahKolom(tabel, 'ttd_untuk', "TEXT NOT NULL DEFAULT ''");
}

/* Tanda tangan tersimpan milik akun: digambar sekali oleh pemiliknya lewat menu
   "TTD Saya", lalu dipakai ulang tiap mengisi formulir tanpa menggambar lagi.
   Isinya path berkas, sama seperti tanda tangan pada catatan — bedanya berkas
   ini milik akun, bukan milik satu catatan. Lihat simpanTtdTersimpan.

   Bentuk kolomnya berubah: dulu satu path polos, kini JSON larik hingga 5 slot
   untuk admin dan pejabat (teknisi tetap 1). Yang lama TIDAK dimigrasikan
   paksa — pembaca (parseSlotsTtd) menerima keduanya. Kolom ttd_aktif menunjuk
   slot yang sedang dipilih; selama pilihan tidak diubah dan slotnya tidak
   dihapus, TTD yang dipakai selalu itu. */
tambahKolom('users', 'ttd_tersimpan', "TEXT NOT NULL DEFAULT ''");
tambahKolom('users', 'ttd_aktif', "INTEGER NOT NULL DEFAULT 0");

/* Penanda super-admin: berada DI ATAS peran, bukan menggantikannya. Peran tetap
   menentukan pagar akses biasa (admin/pejabat/adminunit/pic/teknisi); superadmin
   dipakai gerbang fitur yang belum ada di dunia peran biasa — dan yang belum
   tentu berbentuk apa pun sampai fiturnya lahir. Kolomnya sengaja orthogonal
   supaya jalur admin yang sudah ada tidak ikut berubah perilaku kalau flag ini
   diisi atau dikosongkan. */
tambahKolom('users', 'superadmin', "INTEGER NOT NULL DEFAULT 0");

// DS Test: kategori daftar site, plus penandatangan Manager Teknik.
tambahKolom('dstest', 'kategori', "TEXT NOT NULL DEFAULT 'domestik'");
tambahKolom('dstest', 'manager_nama', "TEXT NOT NULL DEFAULT ''");
tambahKolom('dstest', 'manager_ttd', "TEXT NOT NULL DEFAULT ''");

/* Daily check menyimpan tanggalnya sebagai teks panjang ("KAMIS / 6 AGU 2026")
   yang tidak bisa diurutkan langsung — lihat tanggal-lama.js. Kolom ini
   menyimpan bentuk ISO-nya, khusus untuk ORDER BY riwayat. */
tambahKolom('dailychecks', 'tanggal_urut', "TEXT NOT NULL DEFAULT ''");

// BAPB: daftar nama teknisi pelaksana (JSON), disusulkan supaya tabel yang
// sudah terlanjur dibuat tanpa kolom ini ikut mendapat kolomnya.
tambahKolom('bapb', 'petugas_nama_list', "TEXT NOT NULL DEFAULT '[]'");

db.exec("CREATE INDEX IF NOT EXISTS idx_entries_unit ON entries(unit, tanggal)");

// Isu lama: pelapornya belum pernah diisi — pakai nama penginput sebagai nilai awal.
db.exec(`UPDATE issues
         SET dilaporkan_oleh = dibuat_oleh
         WHERE dilaporkan_oleh = '' AND dibuat_oleh <> ''`);

// Isu lama belum punya tanggal report — ambil dari waktu pembuatannya.
db.exec(`UPDATE issues
         SET tanggal_report = substr(dibuat_pada, 1, 10)
         WHERE tanggal_report = '' AND dibuat_pada <> ''`);

// Daily check lama belum punya tanggal_urut — tafsir balik dari teks panjangnya,
// atau kalau tidak dikenali sekalipun, pakai waktu pembuatannya sebagai taksiran.
for (const r of db.prepare("SELECT id, tanggal, dibuat_pada FROM dailychecks WHERE tanggal_urut = ''").all()) {
  const iso = isoDariTanggalPanjang(r.tanggal) || String(r.dibuat_pada || '').slice(0, 10);
  if (iso) db.prepare('UPDATE dailychecks SET tanggal_urut = ? WHERE id = ?').run(iso, r.id);
}

/* ============== UTILITAS ============== */

export const newId = () => crypto.randomUUID();
export const nowIso = () => new Date().toISOString();

/**
 * Tanggal hari ini menurut UTC, format YYYY-MM-DD.
 * Sengaja UTC, bukan zona waktu server: seluruh aplikasi memakai UTC, dan kalau
 * server dipasang di zona WIB, tanggal lokalnya sudah berganti tujuh jam lebih
 * awal daripada tanggal UTC yang tertulis di catatan lain.
 */
export const today = () => nowIso().slice(0, 10);

const parseJson = (s, fallback) => { try { return JSON.parse(s); } catch { return fallback; } };

/* ============== PENGGUNA & SESI ============== */

const SCRYPT_LEN = 64;

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, SCRYPT_LEN).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password, hash, salt) {
  const calc = crypto.scryptSync(String(password), salt, SCRYPT_LEN);
  const known = Buffer.from(hash, 'hex');
  if (known.length !== calc.length) return false;
  return crypto.timingSafeEqual(calc, known);
}

export function createUser({ username, password, nama = '', role = 'teknisi', unit }) {
  const { hash, salt } = hashPassword(password);
  db.prepare(`INSERT INTO users (username, nama, role, pass_hash, pass_salt, aktif, dibuat_pada)
              VALUES (?, ?, ?, ?, ?, 1, ?)`)
    .run(String(username).trim(), nama, role, hash, salt, nowIso());
  const dibuat = getUserByUsername(username);

  // Akun tanpa unit tidak bisa membuka apa pun. Kalau pemanggil tidak
  // menentukan, beri unit pertama supaya tidak ada jalur — termasuk command
  // line — yang menghasilkan akun buntu.
  // Larik kosong berarti memang belum diberi unit — itu keadaan akun hasil
  // pendaftaran yang masih menunggu konfirmasi. Hanya kalau tidak disebut
  // sama sekali, akun diberi unit pertama supaya tidak buntu.
  setUnitUser(dibuat.id, Array.isArray(unit) ? unit : [KODE_UNIT[0]]);
  return dibuat;
}

export function setPassword(username, password) {
  const { hash, salt } = hashPassword(password);
  const r = db.prepare('UPDATE users SET pass_hash = ?, pass_salt = ? WHERE username = ?')
    .run(hash, salt, String(username).trim());
  return r.changes > 0;
}

export function setAktif(username, aktif) {
  const r = db.prepare('UPDATE users SET aktif = ? WHERE username = ?')
    .run(aktif ? 1 : 0, String(username).trim());
  if (!aktif) {
    const u = getUserByUsername(username);
    if (u) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id);
  }
  return r.changes > 0;
}

/**
 * Hapus akun untuk selamanya.
 *
 * Hanya akun yang sudah nonaktif yang boleh dihapus. Menonaktifkan lebih dulu
 * memutus seluruh sesinya dan memberi jeda untuk berubah pikiran — penghapusan
 * ini sendiri tidak bisa dibatalkan. Syarat itu diperiksa di sini, bukan hanya
 * di server.js, supaya jalur command line ikut terjaga.
 *
 * Catatan yang pernah diinput akun ini TIDAK ikut terhapus. Kolom dibuat_oleh
 * menyimpan username sebagai teks biasa, jadi jejak siapa yang menginput tetap
 * terbaca walaupun akunnya sudah tidak ada.
 */
export function hapusUser(username, opts = {}) {
  const u = getUserByUsername(username);
  if (!u) return false;
  // Super-admin boleh langsung hapus akun aktif — satu langkah, tanpa
  // nonaktifkan-dulu. Untuk peran lain, jalur dua-langkah tetap berlaku.
  if (u.aktif && !opts.paksa) {
    throw new Error('Akun itu masih aktif. Nonaktifkan dulu sebelum dihapus.');
  }
  // Keduanya sebenarnya ikut terhapus lewat ON DELETE CASCADE; ditulis tegas
  // supaya tidak bergantung pada PRAGMA foreign_keys yang bisa saja mati.
  // Lewat jalur paksa sesinya belum tentu putus — diputus di sini juga.
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id);
  db.prepare('DELETE FROM user_unit WHERE user_id = ?').run(u.id);
  // Tanda tangan tersimpannya ikut hilang bersama akunnya. Yang sudah terlanjur
  // dibubuhkan pada catatan tidak tersentuh — itu salinan tersendiri.
  for (const s of parseSlotsTtd(u.ttd_tersimpan)) {
    if (s.path) removeSignatureFile(s.path);
  }
  return db.prepare('DELETE FROM users WHERE id = ?').run(u.id).changes > 0;
}

/* ============== UNIT LOGBOOK ============== */

/**
 * Dua unit untuk sementara. Perbedaannya bukan sekadar nama: bentuk barisnya
 * berbeda, jadi tiap unit membawa daftar dinas dan label kolomnya sendiri.
 */
export const UNIT = [
  /* ---------- Fasilitas Komunikasi Penerbangan ---------- */
  {
    kode: 'radtel',
    nama: 'Radtel',
    brand: 'E-Logbook Fasilitas Komunikasi Penerbangan',
    judul: 'Buku Catatan Fasilitas',
    kelompok: 'Fasilitas Komunikasi Penerbangan (Radtel)',
    peralatan: 'VCS Garex, Recording Neptuno',
    dinas: ['Pagi', 'Siang', 'Malam', 'PS'],
    pakaiJamSelesai: true,
    pakaiFrek: false,
    labelUraian: 'Uraian Pekerjaan / Kejadian',
    labelPj: 'Manager Teknik',
    adaDailyCheck: true,
    dcJudul: 'Daily Check VCS Garex 300 — Unit Radtel',
    adaMonitoring: false,
    adaDsTest: true,
    // Pekerjaan mingguan dan bulanan Radtel — daftarnya di berkala-item.js.
    adaBerkala: true,
    adaLtk: true,
    ltkPenyelenggara: 'Telekomunikasi Penerbangan',
    ltkKelompok: 'Fasilitas Komunikasi Penerbangan (Radtel)',
    ltkPeralatan: 'VSCS Garex 300'
  },
  {
    kode: 'radkom',
    nama: 'Radkom',
    brand: 'E-Logbook Fasilitas Komunikasi Penerbangan',
    judul: 'Buku Catatan Fasilitas dan Kegiatan',
    kelompok: 'Komunikasi Penerbangan',
    peralatan: 'Radio Komunikasi VHF/HF A/G',
    dinas: ['P', 'S', 'PS', 'M'],
    pakaiJamSelesai: true,
    pakaiFrek: true,
    labelUraian: 'Catatan / Tindakan',
    labelPj: 'Manager Teknik',
    adaDailyCheck: true,
    dcJudul: 'Daily Check Unit Radkom — New JATSC',
    adaMonitoring: true,
    adaDsTest: false,
    adaBerkala: false,
    adaLtk: true,
    ltkPenyelenggara: 'Telekomunikasi Penerbangan',
    ltkKelompok: 'Radio Komunikasi Penerbangan',
    ltkPeralatan: 'Transmitter VHF A/G'
  },

  /* ---------- Fasilitas Pendaratan Presisi, Alat Bantu Navigasi dan Pengamatan ---------- */
  {
    kode: 'ppabn',
    nama: 'Pendaratan Presisi & Alat Bantu Navigasi',
    brand: 'E-Logbook Fasilitas Pendaratan Presisi, Alat Bantu Navigasi dan Pengamatan',
    judul: 'Buku Catatan Fasilitas',
    kelompok: 'Fasilitas Pendaratan Presisi dan Alat Bantu Navigasi',
    peralatan: 'ILS, DVOR/DME, NDB',
    dinas: ['Pagi', 'Siang', 'Malam', 'PS'],
    pakaiJamSelesai: true,
    pakaiFrek: false,
    labelUraian: 'Uraian Pekerjaan / Kejadian',
    labelPj: 'Manager Teknik',
    // Daily Check sudah punya form-nya sendiri (ILS empat runway + DVOR/DME
    // dua site) — lihat js/12c-daily-check-navigasi.js. Monitoring, DS Test,
    // dan pekerjaan berkala belum berlaku di unit ini.
    adaDailyCheck: true,
    adaMonitoring: false,
    adaDsTest: false,
    adaBerkala: false,
    adaLtk: true,
    ltkPenyelenggara: 'Telekomunikasi Penerbangan',
    ltkKelompok: 'Fasilitas Pendaratan Presisi dan Alat Bantu Navigasi',
    ltkPeralatan: ''
  },
  {
    kode: 'pengamatan',
    nama: 'Pengamatan',
    brand: 'E-Logbook Fasilitas Pendaratan Presisi, Alat Bantu Navigasi dan Pengamatan',
    judul: 'Buku Catatan Fasilitas',
    kelompok: 'Fasilitas Pengamatan Penerbangan',
    peralatan: 'Radar Pengamatan',
    dinas: ['Pagi', 'Siang', 'Malam', 'PS'],
    pakaiJamSelesai: true,
    pakaiFrek: false,
    labelUraian: 'Uraian Pekerjaan / Kejadian',
    labelPj: 'Manager Teknik',
    // Daily Check punya form-nya sendiri: dua lembar (Radar CKG 3 + Fasilitas
    // Pengamatan) yang dipilih lewat sub-tab — lihat
    // js/12e-daily-check-pengamatan.js. Monitoring, DS Test, dan berkala belum
    // berlaku di unit ini.
    adaDailyCheck: true,
    dcJudul: 'Daily Check Fasilitas Pengamatan — Radar CKG 3 · Fasilitas Pengamatan',
    adaMonitoring: false,
    adaDsTest: false,
    adaBerkala: false,
    adaLtk: true,
    ltkPenyelenggara: 'Telekomunikasi Penerbangan',
    ltkKelompok: 'Fasilitas Pengamatan Penerbangan',
    ltkPeralatan: ''
  },

  /* ---------- Fasilitas Otomasi ---------- */
  {
    kode: 'amhsadps',
    nama: 'AMHS-ADPS',
    brand: 'E-Logbook Fasilitas Otomasi',
    judul: 'Buku Catatan Fasilitas',
    kelompok: 'Fasilitas Otomasi',
    peralatan: 'AMHS, AADPS, D-ATIS',
    dinas: ['Pagi', 'Siang', 'Malam', 'PS'],
    pakaiJamSelesai: true,
    pakaiFrek: false,
    labelUraian: 'Uraian Pekerjaan / Kejadian',
    labelPj: 'Manager Teknik',
    // Daily Check punya form sendiri (AMHS · AADPS · D-ATIS) — lihat
    // js/12d-daily-check-amhs.js. Monitoring, DS Test, dan berkala belum berlaku.
    adaDailyCheck: true,
    dcJudul: 'Daily Check Fasilitas Otomasi — AMHS · AADPS · D-ATIS',
    adaMonitoring: false,
    adaDsTest: false,
    adaBerkala: false,
    adaLtk: true,
    ltkPenyelenggara: 'Telekomunikasi Penerbangan',
    ltkKelompok: 'Fasilitas Otomasi',
    ltkPeralatan: ''
  },
  {
    kode: 'fdpsrdps',
    nama: 'FDPS-RDPS',
    brand: 'E-Logbook Fasilitas Otomasi',
    judul: 'Buku Catatan Fasilitas',
    kelompok: 'Fasilitas Otomasi',
    peralatan: 'FDPS dan RDPS',
    dinas: ['Pagi', 'Siang', 'Malam', 'PS'],
    pakaiJamSelesai: true,
    pakaiFrek: false,
    labelUraian: 'Uraian Pekerjaan / Kejadian',
    labelPj: 'Manager Teknik',
    // Formulir khusus unit ini menunggu form aslinya. Sampai itu ada, yang
    // tersedia baru Logbook Fasilitas, Isu, dan LTK yang memang berlaku umum.
    adaDailyCheck: false,
    adaMonitoring: false,
    adaDsTest: false,
    adaBerkala: false,
    adaLtk: true,
    ltkPenyelenggara: 'Telekomunikasi Penerbangan',
    ltkKelompok: 'Fasilitas Otomasi',
    ltkPeralatan: ''
  },

  /* ---------- Fasilitas Penunjang ---------- */
  {
    kode: 'listrikmekanik',
    nama: 'Listrik dan Mekanik',
    brand: 'E-Logbook Fasilitas Penunjang',
    judul: 'Buku Catatan Fasilitas',
    kelompok: 'Fasilitas Penunjang',
    peralatan: 'Kelistrikan dan Mekanikal',
    dinas: ['Pagi', 'Siang', 'Malam', 'PS'],
    pakaiJamSelesai: true,
    pakaiFrek: false,
    labelUraian: 'Uraian Pekerjaan / Kejadian',
    labelPj: 'Manager Teknik',
    // Daily Check punya form-nya sendiri: empat lembar (STS, MDS No Break,
    // Beban Listrik, dan UPS Beban Utama Operasional) yang dipilih lewat
    // sub-tab — lihat js/12g-daily-check-listrik.js. Monitoring, DS Test, dan
    // berkala belum berlaku di unit ini.
    adaDailyCheck: true,
    dcJudul: 'Daily Check Fasilitas Listrik & Mekanik — STS · MDS · Beban Listrik · UPS',
    adaMonitoring: false,
    adaDsTest: false,
    adaBerkala: false,
    adaLtk: true,
    ltkPenyelenggara: 'Telekomunikasi Penerbangan',
    ltkKelompok: 'Fasilitas Penunjang',
    ltkPeralatan: ''
  },
  {
    kode: 'gedungkeamanan',
    nama: 'Gedung dan Keamanan',
    brand: 'E-Logbook Fasilitas Penunjang',
    judul: 'Buku Catatan Fasilitas',
    kelompok: 'Fasilitas Penunjang',
    peralatan: 'Gedung dan Sistem Keamanan',
    dinas: ['Pagi', 'Siang', 'Malam', 'PS'],
    pakaiJamSelesai: true,
    pakaiFrek: false,
    labelUraian: 'Uraian Pekerjaan / Kejadian',
    labelPj: 'Manager Teknik',
    // Daily Check punya form-nya sendiri: dua lembar (Toilet & Mushalla di New
    // JATSC, dan Pengecekan Harian JATSC untuk lift / server CCTV / sistem
    // pengendali jalan masuk) yang dipilih lewat sub-tab — lihat
    // js/12f-daily-check-fgk.js. Monitoring, DS Test, dan berkala belum
    // berlaku di unit ini.
    adaDailyCheck: true,
    dcJudul: 'Daily Check Fasilitas Gedung & Keamanan — New JATSC · JATSC',
    adaMonitoring: false,
    adaDsTest: false,
    adaBerkala: false,
    adaLtk: true,
    ltkPenyelenggara: 'Telekomunikasi Penerbangan',
    ltkKelompok: 'Fasilitas Penunjang',
    ltkPeralatan: ''
  }
];

export const KODE_UNIT = UNIT.map((u) => u.kode);
export const unitSah = (kode) => KODE_UNIT.includes(kode);

/** Unit yang boleh dibuka sebuah akun. Administrator selalu boleh semuanya. */
export function unitUntukUser(user) {
  if (!user) return [];
  if (SEMUA_UNIT.includes(user.role)) return KODE_UNIT.slice();
  const rows = db.prepare('SELECT unit FROM user_unit WHERE user_id = ?').all(user.id);
  const punya = new Set(rows.map((r) => r.unit));
  // Urutkan mengikuti urutan baku UNIT, bukan urutan baris di database. Tanpa ini
  // unit bawaan yang terbuka bergantung pada urutan administrator mencentang.
  return KODE_UNIT.filter((k) => punya.has(k));
}

export function setUnitUser(userId, daftar) {
  const bersih = [...new Set((Array.isArray(daftar) ? daftar : []).filter(unitSah))];
  db.prepare('DELETE FROM user_unit WHERE user_id = ?').run(userId);
  const ins = db.prepare('INSERT INTO user_unit (user_id, unit) VALUES (?, ?)');
  for (const u of bersih) ins.run(userId, u);
  return bersih;
}

// Peran PIC dokumen — penanggung-jawab satu jenis dokumen (jadwal dinas,
// sparepart, atau ISR) LINTAS seluruh unit. Didefinisikan di sini, di atas
// pemakaian pertamanya (loop bootstrap unit di bawah tidak boleh menaruh baris
// user_unit untuk peran semua-unit). Dipakai lagi di ROLE_VALID dan SEMUA_UNIT.
export const PIC_ROLE = ['pic-dinas', 'pic-sparepart', 'pic-isr'];

// Akun yang sudah ada dibuat sebelum unit dikenal — beri akses Radtel supaya
// tidak ada yang mendadak kehilangan logbook yang selama ini dipakainya.
// Peran lintas-unit (admin, pejabat, dan PIC) sengaja dilewat: akses mereka
// sudah lintas unit lewat peran, jadi baris user_unit di sini bukan pagar akses
// melainkan opt-in tampil sebagai teknisi di unit itu (lihat listTeknisiUnit).
// Menaruh 'radtel' otomatis untuk mereka berarti nama mereka muncul di daftar
// saran teknisi Radtel tanpa pernah memintanya.
const LEWAT_BOOTSTRAP_UNIT = ['admin', 'pejabat', ...PIC_ROLE];
const qLewat = LEWAT_BOOTSTRAP_UNIT.map(() => '?').join(',');
for (const u of db.prepare(`SELECT id FROM users WHERE role NOT IN (${qLewat})`).all(...LEWAT_BOOTSTRAP_UNIT)) {
  const punya = db.prepare('SELECT COUNT(*) AS n FROM user_unit WHERE user_id = ?').get(u.id).n;
  if (punya === 0) db.prepare("INSERT INTO user_unit (user_id, unit) VALUES (?, 'radtel')").run(u.id);
}

/* ---------- Bootstrap super-admin ----------
   Dua akun yang selalu berpenanda super-admin — kalau akunnya ada. Dijalankan
   pada tiap cold start supaya penanda ini tidak bisa hilang tanpa disengaja
   (misalnya diubah lewat SQL langsung, atau tabelnya diimpor ulang dari cadangan
   lama). Kalau kelak perlu daftar yang bisa diubah dari UI, ganti bagian ini
   dengan bacaan tabel — untuk sekarang cukup dua nama yang diminta pemilik
   aplikasi ini. Perbandingannya case-insensitive lewat lower(). */
export const SUPERADMIN_TETAP = ['bagus', 'admin'];
db.prepare(
  `UPDATE users SET superadmin = 1
    WHERE lower(username) IN (${SUPERADMIN_TETAP.map(() => '?').join(',')})
      AND superadmin = 0`
).run(...SUPERADMIN_TETAP);

/**
 * admin     — kendali penuh, termasuk menghapus dan mengelola akun
 * pejabat   — melihat seluruh unit; satu-satunya perubahan yang boleh dilakukannya
 *             adalah membubuhkan tanda tangannya pada petak yang masih kosong
 * adminunit — administrator yang wilayahnya satu unit: mengisi, mengubah,
 *             menghapus, dan membaca log aktivitas — semuanya hanya di unitnya
 * teknisi   — hanya menambah, dan hanya pada unit yang diberikan kepadanya
 *
 * adminunit dipakai Dashboard Fasilitas Teknik, bukan oleh E-Logbook sendiri.
 * E-Logbook tetap perlu mengenalnya: peran disimpan di sini, dan yang tidak
 * ada di daftar ini tidak akan pernah bisa diberikan kepada siapa pun. Di
 * dalam E-Logbook sendiri ia berperilaku seperti teknisi: bukan SEMUA_UNIT,
 * jadi tetap dibatasi unit yang diberikan kepadanya.
 *
 * pic-dinas / pic-sparepart / pic-isr — PIC (penanggung-jawab) satu jenis
 * dokumen LINTAS seluruh unit. Dipakai Dashboard Fasilitas Teknik: di sana
 * mereka hanya membuka satu database (jadwal dinas / sparepart / ISR) untuk
 * semua unit, boleh menyunting dan mencetak. Di E-Logbook mereka SEMUA_UNIT
 * (membaca seluruh unit) tetapi bukan pengisi — dashboard yang menegakkan
 * batas "satu modul saja". Lihat PIC_ROLE di atas.
 *
 * Peran `pic` (lama, tanpa akhiran) sudah dihapus. Akun lama dengan role='pic'
 * dimigrasikan otomatis jadi `adminunit` di blok migrasi cold start di bawah.
 */
export const ROLE_VALID = ['admin', 'pejabat', 'adminunit', 'teknisi', ...PIC_ROLE];

/** Peran yang boleh membuka seluruh unit tanpa perlu diberi satu per satu.
    adminunit sengaja TIDAK di sini: seluruh gunanya justru terletak pada
    wilayahnya yang satu unit. PIC ikut — jangkauannya memang seluruh unit. */
export const SEMUA_UNIT = ['admin', 'pejabat', ...PIC_ROLE];

/* ---------- Migrasi role: pic → adminunit ----------
   Peran `pic` dihapus. Akun lama diubah jadi `adminunit` — peran terdekat
   yang masih satu unit. Idempoten: cold start berikutnya jadi no-op karena
   sudah tidak ada baris pic. */
try {
  const r = db.prepare("UPDATE users SET role = 'adminunit' WHERE role = 'pic'").run();
  if (r.changes > 0) console.log(`[db] migrasi peran: ${r.changes} akun pic → adminunit`);
} catch (err) {
  console.error('[db] gagal migrasi peran pic → adminunit:', err?.message || err);
}

export function setRole(username, role) {
  if (!ROLE_VALID.includes(role)) return false;
  const r = db.prepare('UPDATE users SET role = ? WHERE username = ?')
    .run(role, String(username).trim());
  return r.changes > 0;
}

export function setNama(username, nama) {
  const r = db.prepare('UPDATE users SET nama = ? WHERE username = ?')
    .run(String(nama).trim(), String(username).trim());
  return r.changes > 0;
}

/**
 * Ganti username akun. Username dulu tidak bisa diubah karena setiap kolom yang
 * menyimpannya harus ikut berpindah — dibuat_oleh/ttd_oleh/ttd_untuk/ditutup_oleh
 * di seluruh tabel catatan. Sekarang perpindahannya dijalankan dalam satu
 * transaksi supaya tidak pernah ada keadaan setengah: username lama sudah lenyap
 * tapi catatan lama masih memilikinya.
 *
 * Sesi tetap hidup — kolom sessions merujuk user_id, bukan username. Hak petugas
 * di dashboard (dinas-petugas.json di server dashboard, TERPISAH dari database
 * ini) tidak ikut terupdate; admin perlu menetapkan ulang penugasannya di sana
 * setelah username diubah.
 */
export function setUsername(oldUsername, newUsername) {
  const lama = String(oldUsername || '').trim();
  const baru = String(newUsername || '').trim().toLowerCase();
  if (lama === baru) return false;
  if (!/^[a-z0-9._-]{3,32}$/.test(baru)) {
    throw new Error('Username baru 3–32 karakter: huruf kecil, angka, titik, garis bawah, atau strip.');
  }
  const target = getUserByUsername(lama);
  if (!target) throw new Error(`Pengguna "${lama}" tidak ditemukan.`);
  const bentrok = getUserByUsername(baru);
  if (bentrok && bentrok.id !== target.id) {
    throw new Error(`Username "${baru}" sudah dipakai akun lain.`);
  }

  const TABEL_TEKS_USERNAME = [
    ['entries',     ['dibuat_oleh', 'ttd_oleh', 'ttd_untuk']],
    ['dailychecks', ['dibuat_oleh', 'ttd_oleh', 'ttd_untuk']],
    ['issues',      ['dibuat_oleh', 'ditutup_oleh']],
    ['monitoring',  ['dibuat_oleh', 'ttd_oleh', 'ttd_untuk']],
    ['dstest',      ['dibuat_oleh', 'ttd_oleh', 'ttd_untuk']],
    ['ltk',         ['dibuat_oleh', 'ttd_oleh', 'ttd_untuk']],
    ['berkala',     ['dibuat_oleh', 'ttd_oleh', 'ttd_untuk']],
    ['bapb',        ['dibuat_oleh']]
  ];
  const setUname = db.prepare('UPDATE users SET username = ? WHERE id = ?');
  db.exec('BEGIN');
  try {
    setUname.run(baru, target.id);
    for (const [tabel, kolom] of TABEL_TEKS_USERNAME) {
      // Tabel yang mungkin belum ada di skema lama (BAPB dipasang belakangan) —
      // lewati saja kalau memang bukan bagian dari basis data ini.
      const ada = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = ?"
      ).get(tabel);
      if (!ada) continue;
      for (const k of kolom) {
        try {
          db.prepare(`UPDATE ${tabel} SET ${k} = ? WHERE ${k} = ?`).run(baru, lama);
        } catch { /* kolomnya mungkin belum lahir di skema lama — abaikan */ }
      }
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return true;
}

/**
 * Jumlah admin yang masih aktif. Dipakai untuk menolak perubahan yang membuat
 * sistem tidak punya admin sama sekali — kalau itu terjadi, akun tidak bisa
 * dikelola lagi kecuali lewat command line di server.
 */
export const jumlahAdminAktif = () =>
  db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND aktif = 1").get().n;

export const getUserByUsername = (username) =>
  db.prepare('SELECT * FROM users WHERE username = ?').get(String(username).trim());

/**
 * Isi `unit` di sini adalah baris user_unit apa adanya — untuk semua peran,
 * termasuk admin dan pejabat. Untuk admin/pejabat baris itu bukan pagar akses
 * (perannya sudah membuka seluruh unit lewat SEMUA_UNIT), melainkan tanda
 * "muncul sebagai saran teknisi di unit ini" — dipilih di layar Kelola Akun,
 * dibaca oleh listTeknisiUnit. Layar kartu akun butuh baris mentah supaya
 * kotak centangnya mencerminkan pilihannya, bukan hasil sintesis "seluruh
 * unit" yang membuat semua kotak selalu tampak tercentang.
 */
export const listUsers = () =>
  db.prepare('SELECT id, username, nama, role, aktif, superadmin, dibuat_pada FROM users ORDER BY username')
    .all()
    .map((u) => {
      const rows = db.prepare('SELECT unit FROM user_unit WHERE user_id = ?').all(u.id);
      const punya = new Set(rows.map((r) => r.unit));
      return { ...u, unit: KODE_UNIT.filter((k) => punya.has(k)) };
    });

export const countUsers = () =>
  db.prepare('SELECT COUNT(*) AS n FROM users').get().n;

const SESSION_DAYS = Number(process.env.ELOGBOOK_SESSION_DAYS || 30);

export function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const exp = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, dibuat_pada, kadaluarsa) VALUES (?, ?, ?, ?)')
    .run(token, userId, nowIso(), exp);
  return token;
}

export function getSessionUser(token) {
  if (!token) return null;
  const row = db.prepare(`
    SELECT u.id, u.username, u.nama, u.role, u.aktif, u.superadmin, s.kadaluarsa
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ?`).get(token);
  if (!row) return null;
  if (row.kadaluarsa < nowIso()) { deleteSession(token); return null; }
  if (!row.aktif) return null;
  return {
    id: row.id, username: row.username, nama: row.nama, role: row.role,
    superadmin: !!row.superadmin
  };
}

/** Penanda super-admin, berlaku terpisah dari peran. Dipakai gerbang fitur yang
    belum ada padanannya di dunia peran biasa. Aman dipanggil dengan null/undef. */
export const isSuperadmin = (u) => !!(u && (u.superadmin === true || u.superadmin === 1));

export const deleteSession = (token) =>
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);

export const purgeExpiredSessions = () =>
  db.prepare('DELETE FROM sessions WHERE kadaluarsa < ?').run(nowIso());

/* ============== TANDA TANGAN ============== */

/**
 * Simpan tanda tangan (dataURL dari kanvas) sebagai berkas PNG di uploads/,
 * kembalikan path web-nya. Kalau nilainya sudah berupa path/URL (data lama
 * hasil impor), kembalikan apa adanya.
 */
export function saveSignature(dataUrl, prefix) {
  if (!dataUrl) return '';
  if (!String(dataUrl).startsWith('data:')) return String(dataUrl);
  const idx = dataUrl.indexOf('base64,');
  if (idx === -1) return '';
  const buf = Buffer.from(dataUrl.slice(idx + 7), 'base64');
  const name = `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.png`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
  return '/uploads/' + name;
}

/** Hapus berkas TTD yang tidak lagi dipakai (dipanggil saat record dihapus). */
function removeSignatureFile(webPath) {
  if (!webPath || !webPath.startsWith('/uploads/')) return;
  const name = path.basename(webPath);
  try { fs.unlinkSync(path.join(UPLOAD_DIR, name)); } catch { /* sudah hilang: abaikan */ }
}

/* ---------- Tanda tangan tersimpan milik akun ----------
 * Tiap orang menggambar tanda tangannya sendiri sekali, lalu memakainya ulang
 * di formulir mana pun tanpa menggambar lagi. Hanya pemilik akun yang bisa
 * membuat dan menghapus miliknya — tidak ada jalur bagi siapa pun untuk
 * memasang tanda tangan atas nama orang lain.
 *
 * Berkas milik akun ini TIDAK PERNAH ikut dipasang ke catatan. Yang masuk ke
 * catatan selalu salinan barunya (klien mengirimkan gambarnya, bukan path-nya),
 * karena removeSignatureFile menghapus berkas TTD saat catatan dihapus — kalau
 * path-nya dipakai bersama, menghapus satu catatan berarti melenyapkan tanda
 * tangan orang itu dari seluruh catatan lain sekaligus.
 */

/* ---------- Slot TTD tersimpan: format dan batas per peran ----------
   Admin dan pejabat boleh menyimpan sampai lima TTD sekaligus; teknisi tetap
   satu. Salah satu slot dipilih sebagai "aktif" dan itulah yang dibubuhkan tiap
   kali memakai TTD tersimpan — sampai pemiliknya berganti pilihan, atau slot
   itu ia hapus dan gambar ulang. Kolom disimpan sebagai JSON larik untuk
   multi-slot; nilai polos lama (satu path) tetap dibaca sebagai satu slot. */
const MAKS_SLOT_TTD_PER_PERAN = { admin: 5, pejabat: 5 };
function batasSlotTtd(role) { return MAKS_SLOT_TTD_PER_PERAN[role] || 1; }

function parseSlotsTtd(raw) {
  const s = String(raw || '').trim();
  if (!s) return [];
  if (s[0] === '[') {
    try {
      const arr = JSON.parse(s);
      if (!Array.isArray(arr)) return [];
      return arr.map((x) => ({
        path: String(x?.path || ''),
        dibuatPada: String(x?.dibuatPada || '')
      }));
    } catch { return []; }
  }
  // Cara lama: satu path polos — dianggap slot pertama.
  return [{ path: s, dibuatPada: '' }];
}

function isiHinggaMaks(slots, maks) {
  const out = [];
  for (let i = 0; i < maks; i++) {
    const x = slots[i];
    out.push({ path: String(x?.path || ''), dibuatPada: String(x?.dibuatPada || '') });
  }
  return out;
}

function serialisasiSlotsTtd(slots) {
  const bersih = (slots || []).map((s) => ({
    path: String(s?.path || ''),
    dibuatPada: String(s?.dibuatPada || '')
  }));
  // Trailing slot kosong dipangkas supaya kolom rapi; kalau semuanya kosong,
  // kolom dikembalikan ke '' — sinyal "belum pernah menyimpan".
  while (bersih.length && !bersih[bersih.length - 1].path) bersih.pop();
  if (!bersih.length) return '';
  return JSON.stringify(bersih);
}

function bacaAktifSah(u, maks) {
  const raw = Number(u?.ttd_aktif);
  if (!Number.isFinite(raw) || raw < 0 || raw >= maks) return 0;
  return Math.floor(raw);
}

function bacaTtdTersimpanUser(u) {
  const maks = batasSlotTtd(u?.role);
  const slots = isiHinggaMaks(parseSlotsTtd(u?.ttd_tersimpan), maks);
  const aktif = bacaAktifSah(u, maks);
  return { slots, aktif, maks };
}

/**
 * Bentuk baru: { slots: [{path, dibuatPada}, ...], aktif, maks }.
 * Peramban lama yang memanggil bentuk lama (satu string path) hanya perlu
 * membaca slot pada indeks "aktif" dari struktur ini.
 */
export function getTtdTersimpan(username) {
  const u = getUserByUsername(username);
  if (!u) return { slots: [{ path: '', dibuatPada: '' }], aktif: 0, maks: 1 };
  return bacaTtdTersimpanUser(u);
}

export function simpanTtdTersimpan(username, dataUrl, slotIdx = 0) {
  const u = getUserByUsername(username);
  if (!u) throw new Error('Akun tidak ditemukan.');
  const maks = batasSlotTtd(u.role);
  const idx = Math.max(0, Math.min(maks - 1, Number(slotIdx) | 0));
  const slots = isiHinggaMaks(parseSlotsTtd(u.ttd_tersimpan), maks);
  const baru = saveSignature(dataUrl, 'ttd_akun');
  if (!baru) throw new Error('Tanda tangannya masih kosong.');
  const lama = slots[idx].path;
  slots[idx] = { path: baru, dibuatPada: new Date().toISOString() };
  db.prepare('UPDATE users SET ttd_tersimpan = ? WHERE id = ?').run(serialisasiSlotsTtd(slots), u.id);
  // Yang lama dibuang setelah yang baru tercatat: kalau urutannya terbalik dan
  // penyimpanannya gagal, orangnya kehilangan keduanya.
  if (lama) removeSignatureFile(lama);
  return getTtdTersimpan(username);
}

export function hapusTtdTersimpan(username, slotIdx = 0) {
  const u = getUserByUsername(username);
  if (!u) return getTtdTersimpan(username);
  const maks = batasSlotTtd(u.role);
  const idx = Math.max(0, Math.min(maks - 1, Number(slotIdx) | 0));
  const slots = isiHinggaMaks(parseSlotsTtd(u.ttd_tersimpan), maks);
  const lama = slots[idx].path;
  slots[idx] = { path: '', dibuatPada: '' };
  db.prepare('UPDATE users SET ttd_tersimpan = ? WHERE id = ?').run(serialisasiSlotsTtd(slots), u.id);
  if (lama) removeSignatureFile(lama);
  return getTtdTersimpan(username);
}

export function pilihTtdTersimpanAktif(username, slotIdx) {
  const u = getUserByUsername(username);
  if (!u) throw new Error('Akun tidak ditemukan.');
  const maks = batasSlotTtd(u.role);
  const idx = Math.max(0, Math.min(maks - 1, Number(slotIdx) | 0));
  db.prepare('UPDATE users SET ttd_aktif = ? WHERE id = ?').run(idx, u.id);
  return getTtdTersimpan(username);
}

/* ============== SIAPA YANG MENGINPUT ============== */

/**
 * Peta username -> nama tampil. Dibuat sekali per pembacaan daftar supaya tidak
 * ada kueri per baris. Username yang akunnya sudah dihapus tetap ditampilkan
 * apa adanya, jadi jejak input tidak pernah hilang.
 */
function petaNamaPengguna() {
  const map = new Map();
  for (const u of db.prepare('SELECT username, nama FROM users').all()) {
    map.set(String(u.username).toLowerCase(), u.nama || u.username);
  }
  return map;
}

const namaTampil = (map, username) =>
  username ? (map.get(String(username).toLowerCase()) || username) : '';

/* ============== LAMPIRAN (HASIL SCAN / FOTO) ============== */

/** Hanya jenis berkas ini yang boleh masuk. Ekstensi ditentukan server, bukan klien. */
const LAMPIRAN_EKSTENSI = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf'
};
export const LAMPIRAN_MAKS_BYTE = 8 * 1024 * 1024;   // 8 MB per berkas
export const LAMPIRAN_MAKS_JUMLAH = 6;               // per catatan

/** Nama berkas dari klien hanya dipakai sebagai label — pisahkan dari nama di disk. */
function bersihkanNamaBerkas(nama) {
  return String(nama || '')
    .replace(/[\\/]/g, '_')          // tidak boleh menunjuk folder lain
    .replace(/[\x00-\x1f]/g, '')     // buang karakter kendali
    .trim()
    .slice(0, 120);
}

const rowToLampiran = (l) => ({
  ID: l.id, Nama: l.nama, Path: l.path, Mime: l.mime, Ukuran: l.ukuran
});

/** Ambil lampiran untuk sekumpulan catatan sekaligus (hindari kueri per baris). */
function lampiranUntuk(entryIds) {
  const hasil = new Map();
  if (!entryIds.length) return hasil;
  const tanda = entryIds.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT * FROM lampiran WHERE entry_id IN (${tanda}) ORDER BY dibuat_pada`
  ).all(...entryIds);
  for (const l of rows) {
    if (!hasil.has(l.entry_id)) hasil.set(l.entry_id, []);
    hasil.get(l.entry_id).push(rowToLampiran(l));
  }
  return hasil;
}

/**
 * Tulis satu berkas ke disk setelah jenis dan ukurannya diperiksa.
 * Dipakai lampiran catatan maupun lampiran isu, supaya aturannya tidak pernah
 * berbeda antara keduanya.
 */
function tulisBerkasLampiran(f) {
  const dataUrl = String(f?.data || '');
  const cocok = /^data:([^;,]+);base64,/i.exec(dataUrl);
  if (!cocok) return null;

  const mime = cocok[1].toLowerCase();
  const ext = LAMPIRAN_EKSTENSI[mime];
  if (!ext) throw new Error(`Jenis berkas tidak diizinkan: ${mime}. Hanya JPG, PNG, WEBP, dan PDF.`);

  const buf = Buffer.from(dataUrl.slice(cocok[0].length), 'base64');
  if (buf.length === 0) return null;
  if (buf.length > LAMPIRAN_MAKS_BYTE) {
    throw new Error(`Berkas "${bersihkanNamaBerkas(f.nama) || 'tanpa nama'}" lebih dari 8 MB.`);
  }

  const namaDisk = `lampiran_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, namaDisk), buf);

  return {
    id: newId(),
    nama: bersihkanNamaBerkas(f.nama) || namaDisk,
    path: '/uploads/' + namaDisk,
    mime,
    ukuran: buf.length
  };
}

/**
 * Simpan lampiran sebuah catatan. Tiap berkas dikirim sebagai
 * { nama, data } dengan data berupa dataURL base64.
 */
export function simpanLampiran(entryId, daftar) {
  if (!Array.isArray(daftar) || daftar.length === 0) return [];
  if (daftar.length > LAMPIRAN_MAKS_JUMLAH) {
    throw new Error(`Maksimal ${LAMPIRAN_MAKS_JUMLAH} lampiran per catatan.`);
  }

  const ins = db.prepare(`INSERT INTO lampiran (id, entry_id, nama, path, mime, ukuran, dibuat_pada)
                          VALUES (?, ?, ?, ?, ?, ?, ?)`);
  const hasil = [];
  for (const f of daftar) {
    const row = tulisBerkasLampiran(f);
    if (!row) continue;
    ins.run(row.id, entryId, row.nama, row.path, row.mime, row.ukuran, nowIso());
    hasil.push(rowToLampiran(row));
  }
  return hasil;
}

/** Buang berkas lampiran dari disk (barisnya ikut terhapus lewat ON DELETE CASCADE). */
function hapusBerkasLampiran(entryId) {
  const rows = db.prepare('SELECT path FROM lampiran WHERE entry_id = ?').all(entryId);
  for (const l of rows) removeSignatureFile(l.path);
}

/**
 * Tambah dan buang lampiran catatan yang sudah tersimpan — dipakai updateEntry.
 * Hak aksesnya sudah diperiksa di sana; di sini tinggal jatah dan kepemilikan
 * barisnya.
 *
 * Berkas baru ditulis lebih dulu, baru yang lama dibuang: kalau ada berkas baru
 * yang ditolak, tidak ada bukti lama yang sudah terlanjur hilang.
 */
function suntingLampiranEntry(entryId, tambah, buang) {
  const daftarTambah = Array.isArray(tambah) ? tambah : [];
  const idBuang = (Array.isArray(buang) ? buang : []).map(String);
  if (daftarTambah.length === 0 && idBuang.length === 0) return;

  const milik = db.prepare('SELECT id, path FROM lampiran WHERE entry_id = ?').all(entryId);
  const dibuang = milik.filter((l) => idBuang.includes(String(l.id)));
  const sisa = milik.length - dibuang.length;
  if (sisa + daftarTambah.length > LAMPIRAN_MAKS_JUMLAH) {
    throw new Error(`Maksimal ${LAMPIRAN_MAKS_JUMLAH} lampiran per catatan. Sekarang sudah ada ${sisa}.`);
  }

  simpanLampiran(entryId, daftarTambah);

  const del = db.prepare('DELETE FROM lampiran WHERE id = ? AND entry_id = ?');
  for (const l of dibuang) { del.run(l.id, entryId); removeSignatureFile(l.path); }
}

/* ---------- Lampiran isu (fase open / closed) ---------- */

export const FASE_ISU = ['open', 'closed'];

function lampiranIsuUntuk(issueIds) {
  const hasil = new Map();
  if (!issueIds.length) return hasil;
  const tanda = issueIds.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT * FROM lampiran_isu WHERE issue_id IN (${tanda}) ORDER BY dibuat_pada`
  ).all(...issueIds);
  for (const l of rows) {
    if (!hasil.has(l.issue_id)) hasil.set(l.issue_id, { open: [], closed: [] });
    const kotak = hasil.get(l.issue_id);
    (l.fase === 'closed' ? kotak.closed : kotak.open).push(rowToLampiran(l));
  }
  return hasil;
}

/** Jumlah lampiran isu dihitung per fase, jadi bukti open dan closed masing-masing punya jatah. */
export function tambahLampiranIsu(issueId, fase, daftar) {
  if (!FASE_ISU.includes(fase)) throw new Error('Fase lampiran tidak dikenal.');
  if (!Array.isArray(daftar) || daftar.length === 0) return [];

  const sudahAda = db.prepare('SELECT COUNT(*) AS n FROM lampiran_isu WHERE issue_id = ? AND fase = ?')
    .get(issueId, fase).n;
  if (sudahAda + daftar.length > LAMPIRAN_MAKS_JUMLAH) {
    throw new Error(`Maksimal ${LAMPIRAN_MAKS_JUMLAH} lampiran untuk fase ${fase}. Sekarang sudah ada ${sudahAda}.`);
  }

  const ins = db.prepare(`INSERT INTO lampiran_isu (id, issue_id, fase, nama, path, mime, ukuran, dibuat_pada)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  const hasil = [];
  for (const f of daftar) {
    const row = tulisBerkasLampiran(f);
    if (!row) continue;
    ins.run(row.id, issueId, fase, row.nama, row.path, row.mime, row.ukuran, nowIso());
    hasil.push(rowToLampiran(row));
  }
  return hasil;
}

export function hapusLampiranIsu(lampiranId) {
  const r = db.prepare('SELECT path FROM lampiran_isu WHERE id = ?').get(lampiranId);
  if (!r) return false;
  db.prepare('DELETE FROM lampiran_isu WHERE id = ?').run(lampiranId);
  removeSignatureFile(r.path);
  return true;
}

function hapusBerkasLampiranIsu(issueId) {
  const rows = db.prepare('SELECT path FROM lampiran_isu WHERE issue_id = ?').all(issueId);
  for (const l of rows) removeSignatureFile(l.path);
}

/* ---------- Lampiran LTK ---------- */

function lampiranLtkUntuk(ltkIds) {
  const hasil = new Map();
  if (!ltkIds.length) return hasil;
  const tanda = ltkIds.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT * FROM lampiran_ltk WHERE ltk_id IN (${tanda}) ORDER BY dibuat_pada`
  ).all(...ltkIds);
  for (const l of rows) {
    if (!hasil.has(l.ltk_id)) hasil.set(l.ltk_id, []);
    hasil.get(l.ltk_id).push(rowToLampiran(l));
  }
  return hasil;
}

export function tambahLampiranLtk(ltkId, daftar) {
  if (!Array.isArray(daftar) || daftar.length === 0) return [];
  const sudahAda = db.prepare('SELECT COUNT(*) AS n FROM lampiran_ltk WHERE ltk_id = ?').get(ltkId).n;
  if (sudahAda + daftar.length > LAMPIRAN_MAKS_JUMLAH) {
    throw new Error(`Maksimal ${LAMPIRAN_MAKS_JUMLAH} lampiran per LTK. Sekarang sudah ada ${sudahAda}.`);
  }
  const ins = db.prepare(`INSERT INTO lampiran_ltk (id, ltk_id, nama, path, mime, ukuran, dibuat_pada)
                          VALUES (?, ?, ?, ?, ?, ?, ?)`);
  const hasil = [];
  for (const f of daftar) {
    const row = tulisBerkasLampiran(f);
    if (!row) continue;
    ins.run(row.id, ltkId, row.nama, row.path, row.mime, row.ukuran, nowIso());
    hasil.push(rowToLampiran(row));
  }
  return hasil;
}

export function hapusLampiranLtk(lampiranId) {
  const r = db.prepare('SELECT path FROM lampiran_ltk WHERE id = ?').get(lampiranId);
  if (!r) return false;
  db.prepare('DELETE FROM lampiran_ltk WHERE id = ?').run(lampiranId);
  removeSignatureFile(r.path);
  return true;
}

function hapusBerkasLampiranLtk(ltkId) {
  const rows = db.prepare('SELECT path FROM lampiran_ltk WHERE ltk_id = ?').all(ltkId);
  for (const l of rows) removeSignatureFile(l.path);
}

/* ============== LOGBOOK ============== */

/**
 * Gedung tempat peralatannya berada. Fasilitas satu unit tersebar di dua gedung,
 * dan lembar catatannya memang dibedakan per gedung.
 *
 * Daftarnya dikirim ke frontend lewat getAllData, jadi menambah gedung ketiga
 * kelak cukup di baris ini saja.
 */
export const LOKASI = ['JATSC', 'New JATSC'];
export const lokasiSah = (l) => LOKASI.includes(l);

/** Bentuk objek dibuat sama persis dengan respons Apps Script lama, supaya frontend tak perlu diubah. */
const rowToEntry = (r, extra = {}) => ({
  ID: r.id, Tanggal: r.tanggal, Jam: r.jam, Dinas: r.dinas, Uraian: r.uraian,
  Lokasi: r.lokasi || '',
  JamSelesai: r.jam_selesai || '', Frek: r.frek || '', Unit: r.unit || 'radtel',
  TeknisiNama: r.teknisi_nama, TeknisiTTD: r.teknisi_ttd,
  PJNama: r.pj_nama, PJTTD: r.pj_ttd,
  TeknisiNamaListJSON: parseJson(r.teknisi_nama_list, []),
  DiinputOleh: extra.diinputOleh ?? (r.dibuat_oleh || ''),
  // Waktu sebenarnya baris ini masuk ke server — dicatat sejak awal tapi dulu
  // tidak pernah dikirim ke layar. Tanggal dan jam di atas diketik sendiri oleh
  // teknisi, jadi hanya angka ini yang bisa dipakai administrator memastikan
  // sebuah catatan benar-benar dibuat pada jam yang tertulis.
  DibuatPada: r.dibuat_pada || '',
  // Username mentah (bukan nama tampilan) — dipakai klien menentukan siapa
  // yang boleh menyunting, tanpa perlu percaya kiriman klien.
  DibuatOlehUsername: r.dibuat_oleh || '',
  TtdOleh: extra.ttdOleh ?? (r.ttd_oleh || ''), TtdPada: r.ttd_pada || '', TtdUntuk: r.ttd_untuk || '',
  Lampiran: extra.lampiran || []
});

export function listEntries(unit = 'radtel', limit = 200) {
  const rows = db.prepare(`SELECT * FROM entries WHERE unit = ?
                           ORDER BY tanggal DESC, jam DESC, dibuat_pada DESC LIMIT ?`)
    .all(unit, limit);
  const nama = petaNamaPengguna();
  const lamp = lampiranUntuk(rows.map((r) => r.id));
  return rows.map((r) => rowToEntry(r, {
    diinputOleh: namaTampil(nama, r.dibuat_oleh),
    ttdOleh: namaTampil(nama, r.ttd_oleh),
    lampiran: lamp.get(r.id) || []
  }));
}

export function insertEntry(entry, olehUsername = '', olehNama = '') {
  const id = newId();
  const namaList = Array.isArray(entry.teknisiNamaList) ? entry.teknisiNamaList : [];
  const unit = unitSah(entry.unit) ? entry.unit : 'radtel';
  const row = {
    id,
    // Baris ini tidak dibaca ulang dari database sebelum dikembalikan ke
    // klien, jadi dibuat_oleh harus diisi manual di sini — kalau tidak,
    // DibuatOlehUsername kosong sampai layar dimuat ulang, dan tombol
    // sunting tidak langsung muncul untuk catatan yang baru saja dibuat.
    // Alasan yang sama berlaku untuk dibuat_pada: stempel waktu aslinya harus
    // sudah terlihat di kartu begitu catatannya tersimpan.
    dibuat_oleh: olehUsername,
    dibuat_pada: nowIso(),
    tanggal: entry.tanggal || '',
    jam: entry.jam || '',
    jam_selesai: entry.jamSelesai || '',
    frek: entry.frek || '',
    unit,
    dinas: entry.dinas || '',
    // Lokasi yang tidak dikenal disimpan sebagai kosong, bukan apa adanya —
    // kolom ini dipakai menyaring hasil cetak, jadi isinya harus terbatas.
    lokasi: lokasiSah(entry.lokasi) ? entry.lokasi : '',
    uraian: entry.uraian || '',
    teknisi_nama: entry.teknisiNama || '',
    teknisi_ttd: saveSignature(entry.teknisiTtd, 'logbook_teknisi'),
    pj_nama: entry.pjNama || '',
    pj_ttd: saveSignature(entry.pjTtd, 'logbook_pj'),
    ttd_untuk: entry.ttdUntuk || '',
    teknisi_nama_list: JSON.stringify(namaList)
  };
  db.prepare(`INSERT INTO entries
    (id, tanggal, jam, jam_selesai, frek, unit, dinas, lokasi, uraian, teknisi_nama, teknisi_ttd,
     pj_nama, pj_ttd, ttd_untuk, teknisi_nama_list, dibuat_pada, dibuat_oleh)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(row.id, row.tanggal, row.jam, row.jam_selesai, row.frek, row.unit, row.dinas, row.lokasi,
         row.uraian, row.teknisi_nama, row.teknisi_ttd, row.pj_nama, row.pj_ttd, row.ttd_untuk,
         row.teknisi_nama_list, row.dibuat_pada, olehUsername);

  // Lampiran disimpan setelah catatannya ada, karena barisnya menunjuk ke entry_id.
  const lampiran = simpanLampiran(id, entry.lampiran);

  return rowToEntry(row, { diinputOleh: olehNama || olehUsername, lampiran });
}

export function removeEntry(id) {
  const r = db.prepare('SELECT teknisi_ttd, pj_ttd FROM entries WHERE id = ?').get(id);
  hapusBerkasLampiran(id);
  db.prepare('DELETE FROM entries WHERE id = ?').run(id);
  if (r) { removeSignatureFile(r.teknisi_ttd); removeSignatureFile(r.pj_ttd); }
  return true;
}

/**
 * Sunting catatan logbook yang sudah tersimpan — dibuat karena salah ketik
 * tanggal, jam, atau uraian baru ketahuan belakangan, dan sebelum ini
 * satu-satunya jalan memperbaikinya adalah menghapus lalu mengetik ulang.
 *
 * Sengaja TIDAK menyentuh nama teknisi maupun tanda tangan — itu bukti kerja
 * yang sudah dibubuhkan, bukan metadata yang boleh ditimpa diam-diam.
 *
 * Lampiran ikut bisa disunting, karena hasil scan sering baru dipegang setelah
 * catatannya tersimpan. Pagarnya sama persis dengan pagar uraian di atas:
 * selama belum ditandatangani penanggung jawab, dan hanya oleh pembuatnya
 * (atau admin). Setelah ditandatangani, berkasnya terkunci bersama isinya.
 *
 * TTD TEKNISI YANG TERLUPA boleh dibubuhkan susulan dari sini, dan aturannya
 * sama persis dengan tandaTanganiCatatan:
 *
 *   Petak yang sudah terisi TIDAK pernah ditimpa. Mengganti tanda tangan yang
 *   sudah ada bukan melengkapi — itu menghapus paraf yang sudah dibubuhkan.
 *
 *   Yang boleh membubuhkan hanya pembuat catatannya sendiri, admin sekalipun
 *   tidak. Menyunting kalimat orang lain adalah membetulkan; membubuhkan tanda
 *   tangan orang lain adalah menandatangani atas namanya.
 */
/**
 * Boleh tidaknya sebuah TTD teknisi susulan dibubuhkan — dan kalau boleh,
 * gambar yang akan disimpan. Kosong berarti memang tidak ada yang dibubuhkan.
 *
 * Tidak menyentuh database sama sekali, supaya versi SQLite dan Postgres bisa
 * memegang aturan yang persis sama.
 */
function periksaTtdSusulan(row, ttdBaru, actor = {}) {
  if (!ttdBaru) return '';
  if (row.teknisi_ttd) {
    throw new Error('Catatan ini sudah bertanda tangan teknisi — yang sudah dibubuhkan tidak diganti dari sini.');
  }
  if (!row.dibuat_oleh || row.dibuat_oleh !== actor.username) {
    throw new Error('Hanya pembuat catatan ini yang bisa membubuhkan TTD teknisinya.');
  }
  /* Harus gambar, bukan path. saveSignature meneruskan apa adanya yang bukan
     dataURL — itu memang dibutuhkan pengimpor lembar lama — dan klien yang
     mengirim balik '/uploads/ttd_akun_....png' akan membuat catatan ini memakai
     berkas TTD tersimpan milik akun. Menghapus catatannya kelak ikut
     melenyapkan tanda tangan orang itu dari seluruh catatan lain. */
  const teks = String(ttdBaru);
  if (!teks.startsWith('data:image/')) throw new Error('Tanda tangannya tidak berbentuk gambar.');
  return teks;
}

export function updateEntry(id, patch = {}, actor = {}) {
  const row = db.prepare('SELECT * FROM entries WHERE id = ?').get(String(id));
  if (!row) throw new Error('Catatan tidak ditemukan — mungkin sudah dihapus.');
  if (row.pj_ttd) throw new Error('Catatan ini sudah ditandatangani penanggung jawab — tidak bisa disunting lagi.');
  // Hanya pembuat aslinya (atau admin) yang boleh membetulkan — teknisi lain
  // hanya bisa melihat dan menambah catatannya sendiri, bukan mengubah punya orang lain.
  if (!actor.admin && row.dibuat_oleh && row.dibuat_oleh !== actor.username) {
    throw new Error('Hanya pembuat catatan ini yang bisa menyuntingnya.');
  }

  const uraian = patch.uraian !== undefined ? String(patch.uraian || '').trim() : row.uraian;
  if (!uraian) throw new Error('Uraian pekerjaan tidak boleh kosong.');

  // Diperiksa sebelum apa pun ditulis — lihat catatan TTD di atas.
  const bubuhTtd = periksaTtdSusulan(row, patch.teknisiTtd, actor);

  const next = {
    tanggal: patch.tanggal !== undefined ? String(patch.tanggal || '') : row.tanggal,
    jam: patch.jam !== undefined ? String(patch.jam || '') : row.jam,
    jam_selesai: patch.jamSelesai !== undefined ? String(patch.jamSelesai || '') : row.jam_selesai,
    frek: patch.frek !== undefined ? String(patch.frek || '').trim() : row.frek,
    dinas: patch.dinas !== undefined ? String(patch.dinas || '') : row.dinas,
    lokasi: patch.lokasi !== undefined ? (lokasiSah(patch.lokasi) ? patch.lokasi : '') : row.lokasi,
    uraian
  };

  // Lampiran lebih dulu: kalau jatahnya penuh atau berkasnya ditolak, suntingan
  // teksnya ikut batal — tidak ada catatan yang diam-diam berubah sementara
  // klien menerima pesan gagal.
  suntingLampiranEntry(String(id), patch.lampiranBaru, patch.lampiranHapus);

  // Berkas TTD ditulis paling akhir sebelum barisnya disimpan: kalau lampiran
  // di atas ditolak, tidak ada berkas tanda tangan yatim yang tertinggal.
  next.teknisi_ttd = bubuhTtd ? saveSignature(bubuhTtd, 'logbook_teknisi') : row.teknisi_ttd;

  db.prepare(`UPDATE entries SET tanggal = ?, jam = ?, jam_selesai = ?, frek = ?, dinas = ?, lokasi = ?, uraian = ?,
                                 teknisi_ttd = ?
              WHERE id = ?`)
    .run(next.tanggal, next.jam, next.jam_selesai, next.frek, next.dinas, next.lokasi, next.uraian,
         next.teknisi_ttd, String(id));

  const nama = petaNamaPengguna();
  const lampiran = lampiranUntuk([String(id)]).get(String(id)) || [];
  return rowToEntry({ ...row, ...next }, {
    diinputOleh: namaTampil(nama, row.dibuat_oleh),
    ttdOleh: namaTampil(nama, row.ttd_oleh),
    lampiran
  });
}

/* ============== DAILY CHECK ============== */

/** Lokasi form yang dipakai — 'jatsc' (Frequentis 3020X) atau 'new-jatsc'
    (Garex 300). Ditanam ke state_json waktu simpan (saveDailyCheck di
    14-daily-check-umum.js). Dashboard membaca kolom Lokasi ini untuk memisah
    "Daily Check JATSC" dari "Daily Check New JATSC" pada pilihan sumber
    Kegiatan Berkala. */
function lokasiDariStateJson(stateJson) {
  const s = parseJson(stateJson, {});
  const v = String(s.__lokasi || '').toLowerCase();
  return (v === 'jatsc' || v === 'new-jatsc') ? v : '';
}

/** Ringkasan untuk daftar riwayat — state_json ikut dibaca cuma untuk memetik
    kolom Lokasi; isi state penuh tidak dikembalikan (masih besar). */
const rowToDcRingkas = (r, extra = {}) => ({
  ID: r.id, Tanggal: r.tanggal, Dinas: r.dinas, Suhu: r.suhu, Remark: r.remark,
  TeknisiNama: r.teknisi_nama, TeknisiTTD: r.teknisi_ttd,
  ManagerNama: r.manager_nama, ManagerTTD: r.manager_ttd,
  FailsJSON: parseJson(r.fails_json, []),
  WarnsJSON: parseJson(r.warns_json, []),
  TeknisiNamaListJSON: parseJson(r.teknisi_nama_list, []),
  DiinputOleh: extra.diinputOleh ?? (r.dibuat_oleh || ''),
  DibuatPada: r.dibuat_pada || '',
  DibuatOlehUsername: r.dibuat_oleh || '',
  TtdOleh: extra.ttdOleh ?? (r.ttd_oleh || ''), TtdPada: r.ttd_pada || '', TtdUntuk: r.ttd_untuk || '',
  TanggalIso: r.tanggal_urut || '',
  Lokasi: extra.lokasi ?? lokasiDariStateJson(r.state_json)
});

export function listDailyChecks(unit = 'radtel', limit = 200) {
  const rows = db.prepare(`SELECT id, tanggal, tanggal_urut, dinas, suhu, remark, teknisi_nama, teknisi_ttd,
                                  manager_nama, manager_ttd, fails_json, warns_json, teknisi_nama_list,
                                  dibuat_oleh, dibuat_pada, ttd_oleh, ttd_pada, ttd_untuk, state_json
                           FROM dailychecks WHERE unit = ?
                           ORDER BY tanggal_urut DESC, dibuat_pada DESC LIMIT ?`)
    .all(unit, limit);
  const nama = petaNamaPengguna();
  return rows.map((r) => rowToDcRingkas(r, {
    diinputOleh: namaTampil(nama, r.dibuat_oleh),
    ttdOleh: namaTampil(nama, r.ttd_oleh)
  }));
}

export function getDailyCheckDetailById(id) {
  const r = db.prepare('SELECT state_json, teknisi_ttd, manager_ttd FROM dailychecks WHERE id = ?').get(id);
  if (!r) return null;
  return {
    state: parseJson(r.state_json, {}),
    teknisiTtd: r.teknisi_ttd,
    managerTtd: r.manager_ttd
  };
}

export function insertDailyCheck(rec, olehUsername = '', olehNama = '') {
  const id = newId();
  const namaList = Array.isArray(rec.teknisiNamaList) ? rec.teknisiNamaList : [];
  const row = {
    id,
    // Diisi manual sama seperti insertEntry — baris ini tidak dibaca ulang
    // dari database sebelum dikembalikan ke klien.
    dibuat_oleh: olehUsername,
    dibuat_pada: nowIso(),
    unit: unitSah(rec.unit) ? rec.unit : 'radtel',
    tanggal: rec.tanggal || '',
    tanggal_urut: String(rec.tanggalIso || '').trim() || isoDariTanggalPanjang(rec.tanggal) || today(),
    dinas: rec.dinas || '',
    suhu: rec.suhu || '',
    remark: rec.remark || '',
    teknisi_nama: rec.teknisiNama || '',
    teknisi_ttd: saveSignature(rec.teknisiTtd, 'dailycheck_teknisi'),
    manager_nama: rec.managerNama || '',
    manager_ttd: saveSignature(rec.managerTtd, 'dailycheck_manager'),
    ttd_untuk: rec.ttdUntuk || '',
    state_json: JSON.stringify(rec.state || {}),
    fails_json: JSON.stringify(rec.fails || []),
    warns_json: JSON.stringify(rec.warns || []),
    teknisi_nama_list: JSON.stringify(namaList)
  };
  db.prepare(`INSERT INTO dailychecks
    (id, unit, tanggal, tanggal_urut, dinas, suhu, remark, teknisi_nama, teknisi_ttd, manager_nama, manager_ttd,
     ttd_untuk, state_json, fails_json, warns_json, teknisi_nama_list, dibuat_pada, dibuat_oleh)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(row.id, row.unit, row.tanggal, row.tanggal_urut, row.dinas, row.suhu, row.remark, row.teknisi_nama, row.teknisi_ttd,
         row.manager_nama, row.manager_ttd, row.ttd_untuk, row.state_json, row.fails_json, row.warns_json,
         row.teknisi_nama_list, row.dibuat_pada, olehUsername);

  return Object.assign(rowToDcRingkas(row, { diinputOleh: olehNama || olehUsername }), {
    StateJSON: rec.state || {},
    FailsJSON: rec.fails || [],
    WarnsJSON: rec.warns || []
  });
}

export function removeDailyCheck(id) {
  const r = db.prepare('SELECT teknisi_ttd, manager_ttd FROM dailychecks WHERE id = ?').get(id);
  db.prepare('DELETE FROM dailychecks WHERE id = ?').run(id);
  if (r) { removeSignatureFile(r.teknisi_ttd); removeSignatureFile(r.manager_ttd); }
  return true;
}

/**
 * Ubah daily check yang sudah tersimpan.
 *
 * Manager teknik yang sudah bertanda tangan MENGUNCI catatan — tidak lagi bisa
 * disunting oleh siapa pun. Sebelum itu, seluruh bagian teknisi boleh diubah:
 * tanggal, dinas, suhu, remark, seluruh sel checklist, nama-nama teknisi, dan
 * tanda tangan teknisi (yang lama dihapus dari penyimpanan supaya tidak
 * tertinggal sebagai berkas anak yatim). Nama manager teknik boleh disunting
 * teknisinya (kolom pengetikan biasa), tapi tanda tangannya tidak — itu ranah
 * pejabat lewat pintu tanda-tangan-susulan.
 *
 * tanggal_urut ikut disegarkan supaya riwayatnya tetap terurut benar
 * (lihat tanggal-lama.js).
 */
export function updateDailyCheck(id, patch = {}, actor = {}) {
  const row = db.prepare('SELECT * FROM dailychecks WHERE id = ?').get(String(id));
  if (!row) throw new Error('Catatan tidak ditemukan — mungkin sudah dihapus.');
  if (row.manager_ttd) throw new Error('Catatan ini sudah ditandatangani manager teknik — tidak bisa disunting lagi.');
  if (!actor.admin) {
    if (row.unit === 'amhsadps') {
      // Daily check AMHS sengaja kolaboratif lintas dinas: pagi mengisi, siang/
      // malam melanjutkan lewat Edit (tiap dinas akun sendiri) — jadi batasan
      // "hanya pembuat" tidak berlaku. TAPI Officer (pejabat) hanya melihat &
      // menandatangani, tidak menyunting checklist.
      if (actor.role === 'pejabat') {
        throw new Error('Officer hanya bisa melihat dan menandatangani, tidak menyunting checklist.');
      }
    } else if (row.dibuat_oleh && row.dibuat_oleh !== actor.username) {
      throw new Error('Hanya pembuat catatan ini yang bisa menyuntingnya.');
    }
  }

  const tanggal = patch.tanggal !== undefined ? String(patch.tanggal || '') : row.tanggal;
  if (!tanggal) throw new Error('Tanggal tidak boleh kosong.');
  const tanggal_urut = String(patch.tanggalIso || '').trim() || isoDariTanggalPanjang(tanggal) || row.tanggal_urut;

  const dinas    = patch.dinas    !== undefined ? String(patch.dinas || '') : row.dinas;
  const suhu     = patch.suhu     !== undefined ? String(patch.suhu || '')  : row.suhu;
  const remark   = patch.remark   !== undefined ? String(patch.remark || ''): row.remark;
  const managerNama = patch.managerNama !== undefined ? String(patch.managerNama || '') : row.manager_nama;

  const teknisiNamaList = Array.isArray(patch.teknisiNamaList) ? patch.teknisiNamaList : null;
  const teknisiNama = patch.teknisiNama !== undefined
    ? String(patch.teknisiNama || '')
    : (teknisiNamaList ? teknisiNamaList.join(', ') : row.teknisi_nama);
  const teknisi_nama_list = teknisiNamaList ? JSON.stringify(teknisiNamaList) : row.teknisi_nama_list;

  // TTD teknisi: kalau kirimannya URL data baru, disimpan sebagai berkas dan
  // yang lama dihapus. Kalau kosong / null / undefined, TTD tidak diubah —
  // supaya "tidak menyunting TTD" bukan berarti "menghapus TTD".
  let teknisi_ttd = row.teknisi_ttd;
  if (patch.teknisiTtd !== undefined && patch.teknisiTtd !== null && String(patch.teknisiTtd).startsWith('data:')) {
    if (row.teknisi_ttd) removeSignatureFile(row.teknisi_ttd);
    teknisi_ttd = saveSignature(patch.teknisiTtd, 'dailycheck_teknisi');
  }

  const state_json = patch.state !== undefined ? JSON.stringify(patch.state || {}) : row.state_json;
  const fails_json = Array.isArray(patch.fails) ? JSON.stringify(patch.fails) : row.fails_json;
  const warns_json = Array.isArray(patch.warns) ? JSON.stringify(patch.warns) : row.warns_json;
  // Akun tujuan TTD susulan (kotak masuk Manager). Untuk AMHS ini baru diisi
  // dinas malam lewat Edit, jadi harus ikut diperbarui — kalau tidak, TTD
  // Manager tak pernah terkirim. Belum ditandatangani (dijaga di atas), aman.
  const ttd_untuk = patch.ttdUntuk !== undefined ? String(patch.ttdUntuk || '') : row.ttd_untuk;

  db.prepare(`UPDATE dailychecks SET tanggal = ?, tanggal_urut = ?, dinas = ?, suhu = ?, remark = ?,
                                    teknisi_nama = ?, teknisi_nama_list = ?, teknisi_ttd = ?,
                                    manager_nama = ?, ttd_untuk = ?,
                                    state_json = ?, fails_json = ?, warns_json = ?
                              WHERE id = ?`)
    .run(tanggal, tanggal_urut, dinas, suhu, remark,
         teknisiNama, teknisi_nama_list, teknisi_ttd,
         managerNama, ttd_untuk,
         state_json, fails_json, warns_json, String(id));

  const nama = petaNamaPengguna();
  const rowBaru = { ...row, tanggal, tanggal_urut, dinas, suhu, remark,
                    teknisi_nama: teknisiNama, teknisi_nama_list, teknisi_ttd,
                    manager_nama: managerNama, ttd_untuk,
                    state_json, fails_json, warns_json };
  return rowToDcRingkas(rowBaru, {
    diinputOleh: namaTampil(nama, row.dibuat_oleh),
    ttdOleh: namaTampil(nama, row.ttd_oleh)
  });
}

/* ============== ISU ============== */

const rowToIssue = (r, extra = {}) => ({
  ID: r.id, Jenis: r.jenis, Keterangan: r.keterangan, Lokasi: r.lokasi, Status: r.status,
  TanggalReport: r.tanggal_report || '', TanggalClosed: r.tanggal_closed || '',
  DilaporkanOleh: r.dilaporkan_oleh || '',
  DiinputOleh: extra.diinputOleh ?? (r.dibuat_oleh || ''),
  DitutupOleh: extra.ditutupOleh ?? (r.ditutup_oleh || ''),
  KeteranganClosed: r.keterangan_closed || '',
  DibuatPada: r.dibuat_pada || '',
  LampiranOpen: extra.lampiranOpen || [],
  LampiranClosed: extra.lampiranClosed || []
});

export function listIssues(unit = 'radtel') {
  const rows = db.prepare('SELECT * FROM issues WHERE unit = ? ORDER BY dibuat_pada').all(unit);
  const nama = petaNamaPengguna();
  const lamp = lampiranIsuUntuk(rows.map((r) => r.id));
  return rows.map((r) => {
    const kotak = lamp.get(r.id) || { open: [], closed: [] };
    return rowToIssue(r, {
      diinputOleh: namaTampil(nama, r.dibuat_oleh),
      ditutupOleh: namaTampil(nama, r.ditutup_oleh),
      lampiranOpen: kotak.open,
      lampiranClosed: kotak.closed
    });
  });
}

/** Satu isu lengkap dengan lampirannya — dipakai setelah lampiran ditambah/dihapus. */
export function getIssue(id) {
  const r = getIssueRow(id);
  if (!r) return null;
  const kotak = lampiranIsuUntuk([id]).get(id) || { open: [], closed: [] };
  const nama = petaNamaPengguna();
  return rowToIssue(r, {
    diinputOleh: namaTampil(nama, r.dibuat_oleh),
    ditutupOleh: namaTampil(nama, r.ditutup_oleh),
    lampiranOpen: kotak.open,
    lampiranClosed: kotak.closed
  });
}

const getIssueRow = (id) => db.prepare('SELECT * FROM issues WHERE id = ?').get(id);

export const STATUS_ISU = ['Open', 'Proses', 'Closed'];

/**
 * Isu dibuat sekaligus dengan isinya. Teknisi yang hanya boleh menginput tetap
 * bisa melapor lengkap dalam satu langkah, tanpa perlu hak mengubah baris.
 */
export function insertIssue(isu = {}, olehUsername = '', olehNama = '') {
  const id = newId();
  const status = STATUS_ISU.includes(isu.status) ? isu.status : 'Open';
  const row = {
    id,
    unit: unitSah(isu.unit) ? isu.unit : 'radtel',
    jenis: String(isu.jenis || '').trim(),
    keterangan: String(isu.keterangan || '').trim(),
    lokasi: String(isu.lokasi || '').trim(),
    status,
    // Sejak isu punya jam (bukan hanya tanggal), nilai bawaannya memakai
    // waktu sekarang lengkap YYYY-MM-DDTHH:MM. Klien pengirim yang lama
    // (hanya tanggal) tetap dihormati apa adanya — datanya tidak diubah.
    tanggal_report: String(isu.tanggalReport || '').trim() || nowIso().slice(0, 16),
    tanggal_closed: status === 'Closed' ? nowIso().slice(0, 16) : '',
    // Kalau admin membuat isunya langsung dalam status Closed, dialah penutupnya.
    // Untuk isu yang lahir Open lalu ditutup belakangan, ditutup_oleh diisi oleh
    // updateIssue saat statusnya berubah.
    ditutup_oleh: status === 'Closed' ? String(olehUsername || '') : '',
    keterangan_closed: String(isu.keteranganClosed || '').trim(),
    // Pelapor selalu = akun yang login saat isu dibuat. Nilai dari klien
    // sengaja diabaikan — supaya jejak "siapa memasukkan" tidak bisa dialihkan
    // ke nama orang lain, baik lewat form maupun rekayasa payload.
    dilaporkan_oleh: olehNama || olehUsername || '',
    dibuat_pada: nowIso()
  };
  db.prepare(`INSERT INTO issues (id, unit, jenis, keterangan, lokasi, status, tanggal_report, tanggal_closed,
                                  ditutup_oleh, keterangan_closed, dilaporkan_oleh, dibuat_pada, dibuat_oleh)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(row.id, row.unit, row.jenis, row.keterangan, row.lokasi, row.status,
         row.tanggal_report, row.tanggal_closed, row.ditutup_oleh, row.keterangan_closed,
         row.dilaporkan_oleh, row.dibuat_pada, olehUsername);

  const lampiranOpen = tambahLampiranIsu(id, 'open', isu.lampiranOpen);
  const lampiranClosed = status === 'Closed' ? tambahLampiranIsu(id, 'closed', isu.lampiranClosed) : [];

  return rowToIssue(row, {
    diinputOleh: olehNama || olehUsername,
    ditutupOleh: status === 'Closed' ? (olehNama || olehUsername) : '',
    lampiranOpen, lampiranClosed
  });
}

/** Nama kolom dibatasi daftar putih — nilai dari klien tidak boleh masuk ke SQL.
    DilaporkanOleh sengaja tidak diikutkan: pelapor dikunci = akun yang
    membuat isu, tidak bisa diubah setelahnya. Lihat createIssue. */
const ISSUE_FIELDS = {
  Jenis: 'jenis', Keterangan: 'keterangan', Lokasi: 'lokasi', Status: 'status',
  TanggalReport: 'tanggal_report', TanggalClosed: 'tanggal_closed',
  KeteranganClosed: 'keterangan_closed'
};

/**
 * Ubah satu kolom isu. Mengembalikan isu versi terbaru (atau null kalau gagal),
 * karena mengubah Status ikut menggeser tanggal closed-nya.
 *
 * `closerUsername` dicatat sebagai ditutup_oleh saat status berubah ke 'Closed'
 * — dan dikosongkan lagi saat isunya dibuka kembali. Kalau isunya sudah pernah
 * ditutup dan cuma disunting lagi, penutupnya yang lama dipertahankan.
 */
export function updateIssue(id, headerField, value, closerUsername = '') {
  const col = ISSUE_FIELDS[headerField];
  if (!col) return null;
  const sebelum = getIssueRow(id);
  if (!sebelum) return null;

  db.prepare(`UPDATE issues SET ${col} = ? WHERE id = ?`).run(String(value ?? ''), id);

  // Tanggal closed mengikuti status: terisi sendiri saat isu ditutup, dan
  // dikosongkan lagi kalau isunya dibuka kembali. Tanggal yang sudah diisi
  // manual tidak ditimpa. Penutupnya (username) ikut pola yang sama.
  if (col === 'status') {
    const status = String(value ?? '');
    if (status === 'Closed') {
      if (!sebelum.tanggal_closed) {
        db.prepare('UPDATE issues SET tanggal_closed = ? WHERE id = ?').run(nowIso().slice(0, 16), id);
      }
      if (!sebelum.ditutup_oleh && closerUsername) {
        db.prepare('UPDATE issues SET ditutup_oleh = ? WHERE id = ?').run(String(closerUsername), id);
      }
    } else if (status !== 'Closed') {
      if (sebelum.tanggal_closed) {
        db.prepare("UPDATE issues SET tanggal_closed = '' WHERE id = ?").run(id);
      }
      if (sebelum.ditutup_oleh) {
        db.prepare("UPDATE issues SET ditutup_oleh = '' WHERE id = ?").run(id);
      }
    }
  }

  return getIssue(id);
}

/**
 * Tutup satu isu — tindakan yang boleh dikerjakan bukan hanya admin, tapi juga
 * teknisi (mereka yang menyelesaikan gangguan di lapangan). Menyatukan tiga
 * perubahan sekaligus dalam satu panggilan: status → Closed, catatan
 * penutupan (kalau diisi), dan tanggal + penutup diisi otomatis.
 *
 * Bedanya dengan updateIssue biasa: fungsi ini hanya berurusan dengan urusan
 * penutupan — jenis/keterangan/lokasi/pelapor tidak bisa disentuh dari sini,
 * jadi teknisi yang menutup tidak bisa sekaligus "membetulkan" jenis isu
 * orang lain lewat celah ini. Kalau isunya sudah Closed sebelumnya, catatan
 * penutupan tetap boleh diperbarui — tapi tanggal_closed dan ditutup_oleh
 * yang lama dipertahankan (penutup pertama itu yang berlaku).
 */
export function tutupIsu(id, keteranganClosed, closerUsername = '') {
  const sebelum = getIssueRow(id);
  if (!sebelum) return null;

  db.prepare("UPDATE issues SET status = 'Closed' WHERE id = ?").run(id);

  const catatan = String(keteranganClosed || '').trim();
  if (catatan) {
    db.prepare('UPDATE issues SET keterangan_closed = ? WHERE id = ?').run(catatan, id);
  }
  if (!sebelum.tanggal_closed) {
    db.prepare('UPDATE issues SET tanggal_closed = ? WHERE id = ?').run(nowIso().slice(0, 16), id);
  }
  if (!sebelum.ditutup_oleh && closerUsername) {
    db.prepare('UPDATE issues SET ditutup_oleh = ? WHERE id = ?').run(String(closerUsername), id);
  }
  return getIssue(id);
}

/**
 * Menempel bukti fase "closed" pada isu. Terpisah dari addIssueLampiran
 * (admin-only) karena teknisi yang menutup isu perlu bisa melampirkan foto
 * hasil pekerjaan — tapi TIDAK boleh mengubah isunya di luar itu. Fase
 * dikunci ke 'closed'; upaya ke 'open' ditolak sejak di sini.
 */
export function tambahBuktiTutupIsu(id, daftar) {
  if (!getIssueRow(id)) throw new Error('Isu tidak ditemukan.');
  tambahLampiranIsu(String(id), 'closed', daftar || []);
  return getIssue(id);
}

/* ============== RUTE TTD (Nama pihak-kedua + akun tujuan) ==============
 *
 * Cerminan Postgres di db-pg.js. Nama Manager Teknik/PJ dan akun tujuan TTD
 * (ttd_untuk) bisa diedit selama pihak keduanya BELUM membubuhkan tanda tangan;
 * setelah tercetak, rute-nya beku — mengganti nama di bawah TTD yang sudah ada
 * sama dengan memalsu arsip. Berlaku untuk kelima form yang punya slot pihak
 * kedua: entry (logbook), daily check, LTK, berkala, DS test.
 */
const RUTE_TTD_META = {
  entry:   { tabel: 'entries',     ttdCol: 'pj_ttd',      namaCol: 'pj_nama',      subyek: 'penanggung jawab' },
  dc:      { tabel: 'dailychecks', ttdCol: 'manager_ttd', namaCol: 'manager_nama', subyek: 'manager teknik' },
  ltk:     { tabel: 'ltk',         ttdCol: 'manager_ttd', namaCol: 'manager_nama', subyek: 'manager teknik' },
  berkala: { tabel: 'berkala',     ttdCol: 'manager_ttd', namaCol: 'manager_nama', subyek: 'manager teknik' },
  dstest:  { tabel: 'dstest',      ttdCol: 'manager_ttd', namaCol: 'manager_nama', subyek: 'manager teknik' },
  bapb:    { tabel: 'bapb',        ttdCol: 'teknik_ttd',  namaCol: 'teknik_nama',  subyek: 'manager teknik' }
};

export function updateTtdRouting(kind, id, patch = {}) {
  const meta = RUTE_TTD_META[String(kind || '').toLowerCase()];
  if (!meta) throw new Error(`Jenis catatan tidak dikenal: ${kind}`);
  const row = db.prepare(`SELECT ${meta.ttdCol} AS ttd, ${meta.namaCol} AS nama, ttd_untuk FROM ${meta.tabel} WHERE id = ?`)
                .get(String(id));
  if (!row) throw new Error('Catatan tidak ditemukan — mungkin sudah dihapus.');
  if (row.ttd) {
    throw new Error(`Catatan ini sudah ditandatangani ${meta.subyek} — nama dan akun tujuannya tidak bisa diubah lagi.`);
  }
  const setBaru = {};
  if (patch.managerNama !== undefined) setBaru[meta.namaCol] = String(patch.managerNama || '').trim();
  if (patch.pjNama !== undefined)      setBaru[meta.namaCol] = String(patch.pjNama || '').trim();
  if (patch.ttdUntuk !== undefined)    setBaru.ttd_untuk    = String(patch.ttdUntuk || '').trim();
  const kunci = Object.keys(setBaru);
  if (!kunci.length) return true;
  const potongan = kunci.map((k) => `${k} = ?`).join(', ');
  db.prepare(`UPDATE ${meta.tabel} SET ${potongan} WHERE id = ?`)
    .run(...kunci.map((k) => setBaru[k]), String(id));
  return true;
}

/* ============== FORM MONITORING FREKUENSI ============== */

/** Kolom baris pengamatan, urutannya sama dengan form aslinya. */
export const KOLOM_MONITORING = [
  'sector', 'frequency', 'time', 'flight', 'level', 'bearing', 'range', 'radioSite', 'readibility', 'note'
];

const bersihkanBarisMonitoring = (daftar) =>
  (Array.isArray(daftar) ? daftar : [])
    .map((b) => {
      const o = {};
      for (const k of KOLOM_MONITORING) o[k] = String(b?.[k] ?? '').trim();
      return o;
    })
    // Baris yang seluruh kolomnya kosong tidak perlu disimpan.
    .filter((b) => KOLOM_MONITORING.some((k) => b[k] !== ''));

const rowToMonitoring = (r, extra = {}) => ({
  ID: r.id, Unit: r.unit, Tanggal: r.tanggal,
  Baris: parseJson(r.baris_json, []),
  PersonilOps: r.personil_ops, PersonilTeknik: r.personil_teknik,
  PersonilOpsTTD: r.personil_ops_ttd || '',
  TeknisiTTD: r.teknisi_ttd,
  TeknisiNamaListJSON: parseJson(r.teknisi_nama_list, []),
  DiinputOleh: extra.diinputOleh ?? (r.dibuat_oleh || ''),
  DibuatPada: r.dibuat_pada || '',
  TtdOleh: extra.ttdOleh ?? (r.ttd_oleh || ''), TtdPada: r.ttd_pada || '', TtdUntuk: r.ttd_untuk || ''
});

export function listMonitoring(unit = 'radkom', limit = 200) {
  const rows = db.prepare(`SELECT * FROM monitoring WHERE unit = ?
                           ORDER BY tanggal DESC, dibuat_pada DESC LIMIT ?`).all(unit, limit);
  const nama = petaNamaPengguna();
  return rows.map((r) => rowToMonitoring(r, {
    diinputOleh: namaTampil(nama, r.dibuat_oleh),
    ttdOleh: namaTampil(nama, r.ttd_oleh)
  }));
}

export function insertMonitoring(rec = {}, olehUsername = '', olehNama = '') {
  const baris = bersihkanBarisMonitoring(rec.baris);
  if (baris.length === 0) throw new Error('Belum ada baris pengamatan yang terisi.');

  const namaList = Array.isArray(rec.teknisiNamaList) ? rec.teknisiNamaList : [];
  const row = {
    id: newId(),
    unit: unitSah(rec.unit) ? rec.unit : 'radkom',
    tanggal: String(rec.tanggal || '').trim() || today(),
    baris_json: JSON.stringify(baris),
    personil_ops: String(rec.personilOps || '').trim(),
    personil_teknik: String(rec.personilTeknik || '').trim(),
    personil_ops_ttd: saveSignature(rec.personilOpsTtd, 'monitoring_ops'),
    teknisi_ttd: saveSignature(rec.teknisiTtd, 'monitoring_teknisi'),
    ttd_untuk: rec.ttdUntuk || '',
    teknisi_nama_list: JSON.stringify(namaList),
    dibuat_pada: nowIso()
  };
  db.prepare(`INSERT INTO monitoring (id, unit, tanggal, baris_json, personil_ops, personil_teknik,
                                      personil_ops_ttd, teknisi_ttd, ttd_untuk, teknisi_nama_list, dibuat_pada, dibuat_oleh)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(row.id, row.unit, row.tanggal, row.baris_json, row.personil_ops, row.personil_teknik,
         row.personil_ops_ttd, row.teknisi_ttd, row.ttd_untuk, row.teknisi_nama_list, row.dibuat_pada, olehUsername);
  return rowToMonitoring(row, { diinputOleh: olehNama || olehUsername });
}

export function removeMonitoring(id) {
  const r = db.prepare('SELECT teknisi_ttd, personil_ops_ttd FROM monitoring WHERE id = ?').get(id);
  db.prepare('DELETE FROM monitoring WHERE id = ?').run(id);
  if (r) { removeSignatureFile(r.teknisi_ttd); removeSignatureFile(r.personil_ops_ttd); }
  return true;
}

/* ============== DS TEST ============== */

/* Daftar site-nya pindah ke ds-site.js supaya db.js dan db-pg.js memakai
   sumber yang sama (diimpor di atas). Diekspor ulang di sini agar
   pemanggilnya — server.js — tidak perlu tahu asalnya. */
export { DS_SITE, KATEGORI_DS, kategoriDsSah, dsSiteUntuk };

const rowToDsTest = (r, extra = {}) => ({
  ID: r.id, Unit: r.unit, Tanggal: r.tanggal,
  Kategori: r.kategori || 'domestik',
  ManagerNama: r.manager_nama || '', ManagerTTD: r.manager_ttd || '',
  State: parseJson(r.state_json, {}),
  TeknisiNama: r.teknisi_nama,
  TeknisiNamaListJSON: parseJson(r.teknisi_nama_list, []),
  TeknisiTTD: r.teknisi_ttd,
  DiinputOleh: extra.diinputOleh ?? (r.dibuat_oleh || ''),
  // Username pembuatnya dibawa apa adanya supaya tombol Sunting bisa
  // muncul hanya untuk yang berhak — sama pola dengan logbook & daily check.
  DibuatOlehUsername: r.dibuat_oleh || '',
  DibuatPada: r.dibuat_pada || '',
  TtdOleh: extra.ttdOleh ?? (r.ttd_oleh || ''), TtdPada: r.ttd_pada || '', TtdUntuk: r.ttd_untuk || ''
});

export function listDsTest(unit = 'radtel', limit = 200) {
  const rows = db.prepare(`SELECT * FROM dstest WHERE unit = ?
                           ORDER BY tanggal DESC, dibuat_pada DESC LIMIT ?`).all(unit, limit);
  const nama = petaNamaPengguna();
  return rows.map((r) => rowToDsTest(r, {
    diinputOleh: namaTampil(nama, r.dibuat_oleh),
    ttdOleh: namaTampil(nama, r.ttd_oleh)
  }));
}

export function insertDsTest(rec = {}, olehUsername = '', olehNama = '') {
  const namaList = Array.isArray(rec.teknisiNamaList) ? rec.teknisiNamaList : [];
  // Lima jenis lembar menumpang tabel ini, dibedakan lewat state.__format:
  //   'radio'        Maintenance Radio            (17c)
  //   'pgmweekly'    Weekly Check Pengamatan      (17d)
  //   'llzgc'        Ground Check LLZ             (17e)
  //   'mrreading'    Meter Reading ILS            (17f)
  //   'maintlistrik' Pemeliharaan Listrik & Mekanik (17g)
  // Kelimanya tak punya entri DS_SITE — daftar item/lembarnya ada di peramban
  // — jadi pemeriksaan site dilewati.
  const fmt = rec.state && rec.state.__format;
  const isKhusus = fmt === 'radio' || fmt === 'pgmweekly' || fmt === 'llzgc' || fmt === 'mrreading' ||
                   fmt === 'maintlistrik';
  const kategori = fmt === 'radio' ? 'radio'
                 : fmt === 'pgmweekly' ? 'pgmweekly'
                 : fmt === 'llzgc' ? 'llzgc'
                 : fmt === 'mrreading' ? 'mrreading'
                 : fmt === 'maintlistrik' ? 'maintlistrik'
                 : (kategoriDsSah(rec.kategori) ? rec.kategori : 'domestik');
  // Daftar site yang masih kosong berarti formnya belum bisa dipakai —
  // menyimpan lembar tanpa satu pun site hanya menghasilkan berkas kosong.
  if (!isKhusus && dsSiteUntuk(kategori).length === 0) {
    throw new Error('Daftar site untuk kategori ' + kategori + ' belum diisi.');
  }
  const row = {
    id: newId(),
    unit: unitSah(rec.unit) ? rec.unit : 'radtel',
    kategori,
    tanggal: String(rec.tanggal || '').trim() || today(),
    state_json: JSON.stringify(rec.state || {}),
    manager_nama: String(rec.managerNama || '').trim(),
    manager_ttd: saveSignature(rec.managerTtd, 'dstest_manager'),
    ttd_untuk: rec.ttdUntuk || '',
    teknisi_nama: namaList.join(', '),
    teknisi_nama_list: JSON.stringify(namaList),
    teknisi_ttd: saveSignature(rec.teknisiTtd, 'dstest_teknisi'),
    dibuat_pada: nowIso()
  };
  db.prepare(`INSERT INTO dstest (id, unit, kategori, tanggal, state_json, teknisi_nama, teknisi_nama_list,
                                  teknisi_ttd, manager_nama, manager_ttd, ttd_untuk, dibuat_pada, dibuat_oleh)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(row.id, row.unit, row.kategori, row.tanggal, row.state_json, row.teknisi_nama, row.teknisi_nama_list,
         row.teknisi_ttd, row.manager_nama, row.manager_ttd, row.ttd_untuk, row.dibuat_pada, olehUsername);
  return rowToDsTest(row, { diinputOleh: olehNama || olehUsername });
}

/**
 * Sunting lembar dstest yang sudah tersimpan (DS Test dan semua form preventive
 * yang menumpang tabel ini). Aturannya sama dengan updateDailyCheck:
 *   · sudah ditandatangani manager teknik → terkunci, tidak bisa disunting;
 *   · selain administrator, hanya pembuat catatan yang boleh menyuntingnya.
 * Yang boleh diubah: tanggal, isi lembar (state), daftar & TTD teknisi, nama
 * manager, dan akun tujuan TTD. Unit dan kategori TIDAK diubah — jenis lembar
 * itu identitas catatannya, bukan isian.
 *
 * TTD teknisi hanya diganti kalau kirimannya URL data baru; kosong berarti
 * "tidak menyunting TTD", bukan "hapus TTD".
 */
export function updateDsTest(id, patch = {}, actor = {}) {
  const row = db.prepare('SELECT * FROM dstest WHERE id = ?').get(String(id));
  if (!row) throw new Error('Catatan tidak ditemukan — mungkin sudah dihapus.');
  if (row.manager_ttd) throw new Error('Catatan ini sudah ditandatangani manager teknik — tidak bisa disunting lagi.');
  if (!actor.admin && row.dibuat_oleh && row.dibuat_oleh !== actor.username) {
    throw new Error('Hanya pembuat catatan ini yang bisa menyuntingnya.');
  }

  const tanggal = patch.tanggal !== undefined ? String(patch.tanggal || '') : row.tanggal;
  if (!tanggal) throw new Error('Tanggal tidak boleh kosong.');
  const managerNama = patch.managerNama !== undefined ? String(patch.managerNama || '') : row.manager_nama;
  const teknisiNamaList = Array.isArray(patch.teknisiNamaList) ? patch.teknisiNamaList : null;
  const teknisiNama = teknisiNamaList ? teknisiNamaList.join(', ') : row.teknisi_nama;
  const teknisi_nama_list = teknisiNamaList ? JSON.stringify(teknisiNamaList) : row.teknisi_nama_list;

  let teknisi_ttd = row.teknisi_ttd;
  if (patch.teknisiTtd !== undefined && patch.teknisiTtd !== null && String(patch.teknisiTtd).startsWith('data:')) {
    if (row.teknisi_ttd) removeSignatureFile(row.teknisi_ttd);
    teknisi_ttd = saveSignature(patch.teknisiTtd, 'dstest_teknisi');
  }
  const state_json = patch.state !== undefined ? JSON.stringify(patch.state || {}) : row.state_json;
  const ttd_untuk = patch.ttdUntuk !== undefined ? String(patch.ttdUntuk || '') : row.ttd_untuk;

  db.prepare(`UPDATE dstest SET tanggal = ?, state_json = ?, teknisi_nama = ?, teknisi_nama_list = ?,
                                teknisi_ttd = ?, manager_nama = ?, ttd_untuk = ?
                          WHERE id = ?`)
    .run(tanggal, state_json, teknisiNama, teknisi_nama_list, teknisi_ttd, managerNama, ttd_untuk, String(id));

  const nama = petaNamaPengguna();
  const rowBaru = { ...row, tanggal, state_json, teknisi_nama: teknisiNama, teknisi_nama_list,
                    teknisi_ttd, manager_nama: managerNama, ttd_untuk };
  return rowToDsTest(rowBaru, {
    diinputOleh: namaTampil(nama, row.dibuat_oleh),
    ttdOleh: namaTampil(nama, row.ttd_oleh)
  });
}

export function removeDsTest(id) {
  const r = db.prepare('SELECT teknisi_ttd, manager_ttd FROM dstest WHERE id = ?').get(id);
  db.prepare('DELETE FROM dstest WHERE id = ?').run(id);
  if (r) { removeSignatureFile(r.teknisi_ttd); removeSignatureFile(r.manager_ttd); }
  return true;
}

/* ============== PEKERJAAN BERKALA ==============
 * Daftar itemnya di berkala-item.js dan diekspor ulang di sini supaya
 * server.js tidak perlu tahu asalnya — pola yang sama dengan DS Test.
 *
 * Yang disimpan cuma hasil pengisian, berkunci kode item. Item yang belum
 * pernah ada waktu lembar itu diisi terbaca kosong, dan itu memang benar:
 * pekerjaan yang baru ditambahkan bulan ini tidak pernah dikerjakan bulan lalu.
 */

export { BERKALA_ITEM, JENIS_BERKALA, jenisBerkalaSah, berkalaItemUntuk };

const rowToBerkala = (r, extra = {}) => ({
  ID: r.id, Unit: r.unit, Tanggal: r.tanggal,
  Jenis: r.jenis || 'neptuno',
  State: parseJson(r.state_json, {}),
  Catatan: r.catatan || '',
  ManagerNama: r.manager_nama || '', ManagerTTD: r.manager_ttd || '',
  TeknisiNama: r.teknisi_nama,
  TeknisiNamaListJSON: parseJson(r.teknisi_nama_list, []),
  TeknisiTTD: r.teknisi_ttd,
  DiinputOleh: extra.diinputOleh ?? (r.dibuat_oleh || ''),
  DibuatPada: r.dibuat_pada || '',
  TtdOleh: extra.ttdOleh ?? (r.ttd_oleh || ''), TtdPada: r.ttd_pada || '', TtdUntuk: r.ttd_untuk || ''
});

export function listBerkala(unit = 'radtel', limit = 200) {
  const rows = db.prepare(`SELECT * FROM berkala WHERE unit = ?
                           ORDER BY tanggal DESC, dibuat_pada DESC LIMIT ?`).all(unit, limit);
  const nama = petaNamaPengguna();
  return rows.map((r) => rowToBerkala(r, {
    diinputOleh: namaTampil(nama, r.dibuat_oleh),
    ttdOleh: namaTampil(nama, r.ttd_oleh)
  }));
}

export function insertBerkala(rec = {}, olehUsername = '', olehNama = '') {
  const namaList = Array.isArray(rec.teknisiNamaList) ? rec.teknisiNamaList : [];
  const jenis = jenisBerkalaSah(rec.jenis) ? rec.jenis : 'neptuno';
  // Jenis tanpa satu pun item berarti formnya belum bisa dipakai — sama
  // alasannya dengan DS Test: yang tersimpan hanya lembar kosong.
  if (berkalaItemUntuk(jenis).length === 0) {
    throw new Error('Daftar pekerjaan untuk jenis ' + jenis + ' belum diisi.');
  }
  const row = {
    id: newId(),
    unit: unitSah(rec.unit) ? rec.unit : 'radtel',
    jenis,
    tanggal: String(rec.tanggal || '').trim() || today(),
    state_json: JSON.stringify(rec.state || {}),
    catatan: String(rec.catatan || '').trim(),
    manager_nama: String(rec.managerNama || '').trim(),
    manager_ttd: saveSignature(rec.managerTtd, 'berkala_manager'),
    ttd_untuk: rec.ttdUntuk || '',
    teknisi_nama: namaList.join(', '),
    teknisi_nama_list: JSON.stringify(namaList),
    teknisi_ttd: saveSignature(rec.teknisiTtd, 'berkala_teknisi'),
    dibuat_pada: nowIso()
  };
  db.prepare(`INSERT INTO berkala (id, unit, jenis, tanggal, state_json, catatan, teknisi_nama,
                                   teknisi_nama_list, teknisi_ttd, manager_nama, manager_ttd,
                                   ttd_untuk, dibuat_pada, dibuat_oleh)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(row.id, row.unit, row.jenis, row.tanggal, row.state_json, row.catatan, row.teknisi_nama,
         row.teknisi_nama_list, row.teknisi_ttd, row.manager_nama, row.manager_ttd, row.ttd_untuk,
         row.dibuat_pada, olehUsername);
  return rowToBerkala(row, { diinputOleh: olehNama || olehUsername });
}

export function removeBerkala(id) {
  const r = db.prepare('SELECT teknisi_ttd, manager_ttd FROM berkala WHERE id = ?').get(id);
  db.prepare('DELETE FROM berkala WHERE id = ?').run(id);
  if (r) { removeSignatureFile(r.teknisi_ttd); removeSignatureFile(r.manager_ttd); }
  return true;
}

/* ============== LTK — LAPORAN TERJADINYA KERUSAKAN ============== */

const rowToLtk = (r, extra = {}) => ({
  ID: r.id, Unit: r.unit,
  TanggalLapor: r.tanggal_lapor, Penyelenggara: r.penyelenggara, Kelompok: r.kelompok,
  Peralatan: r.peralatan, Modul: r.modul, Analisa: r.analisa, Perbaikan: r.perbaikan,
  TanggalRusak: r.tanggal_rusak, JamRusak: r.jam_rusak,
  TanggalSelesai: r.tanggal_selesai, JamSelesai: r.jam_selesai,
  JamTerputus: r.jam_terputus, Kota: r.kota,
  ManagerNama: r.manager_nama, ManagerTTD: r.manager_ttd,
  TeknisiNama: r.teknisi_nama, TeknisiTTD: r.teknisi_ttd,
  Lampiran: extra.lampiran || [],
  DiinputOleh: extra.diinputOleh ?? (r.dibuat_oleh || ''),
  DibuatPada: r.dibuat_pada || '',
  TtdOleh: extra.ttdOleh ?? (r.ttd_oleh || ''), TtdPada: r.ttd_pada || '', TtdUntuk: r.ttd_untuk || ''
});

export function listLtk(unit = 'radkom', limit = 200) {
  const rows = db.prepare(`SELECT * FROM ltk WHERE unit = ?
                           ORDER BY tanggal_lapor DESC, dibuat_pada DESC LIMIT ?`).all(unit, limit);
  const nama = petaNamaPengguna();
  const lamp = lampiranLtkUntuk(rows.map((r) => r.id));
  return rows.map((r) => rowToLtk(r, {
    diinputOleh: namaTampil(nama, r.dibuat_oleh),
    ttdOleh: namaTampil(nama, r.ttd_oleh),
    lampiran: lamp.get(r.id) || []
  }));
}

export function insertLtk(rec = {}, olehUsername = '', olehNama = '') {
  const teks = (v) => String(v ?? '').trim();
  if (!teks(rec.peralatan)) throw new Error('Nama peralatan belum diisi.');

  const row = {
    id: newId(),
    unit: unitSah(rec.unit) ? rec.unit : 'radkom',
    tanggal_lapor: teks(rec.tanggalLapor) || today(),
    penyelenggara: teks(rec.penyelenggara),
    kelompok: teks(rec.kelompok),
    peralatan: teks(rec.peralatan),
    modul: teks(rec.modul),
    analisa: teks(rec.analisa),
    perbaikan: teks(rec.perbaikan),
    tanggal_rusak: teks(rec.tanggalRusak),
    jam_rusak: teks(rec.jamRusak),
    tanggal_selesai: teks(rec.tanggalSelesai),
    jam_selesai: teks(rec.jamSelesai),
    jam_terputus: teks(rec.jamTerputus),
    kota: teks(rec.kota) || 'Tangerang',
    manager_nama: teks(rec.managerNama),
    manager_ttd: saveSignature(rec.managerTtd, 'ltk_manager'),
    ttd_untuk: teks(rec.ttdUntuk),
    teknisi_nama: teks(rec.teknisiNama),
    teknisi_ttd: saveSignature(rec.teknisiTtd, 'ltk_teknisi'),
    dibuat_pada: nowIso()
  };
  db.prepare(`INSERT INTO ltk (id, unit, tanggal_lapor, penyelenggara, kelompok, peralatan, modul,
                               analisa, perbaikan, tanggal_rusak, jam_rusak, tanggal_selesai, jam_selesai,
                               jam_terputus, kota, manager_nama, manager_ttd, ttd_untuk, teknisi_nama, teknisi_ttd,
                               dibuat_pada, dibuat_oleh)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(row.id, row.unit, row.tanggal_lapor, row.penyelenggara, row.kelompok, row.peralatan, row.modul,
         row.analisa, row.perbaikan, row.tanggal_rusak, row.jam_rusak, row.tanggal_selesai, row.jam_selesai,
         row.jam_terputus, row.kota, row.manager_nama, row.manager_ttd, row.ttd_untuk, row.teknisi_nama, row.teknisi_ttd,
         row.dibuat_pada, olehUsername);
  const lampiran = tambahLampiranLtk(row.id, rec.lampiran);
  return rowToLtk(row, { diinputOleh: olehNama || olehUsername, lampiran });
}

export function getLtk(id) {
  const r = db.prepare('SELECT * FROM ltk WHERE id = ?').get(id);
  if (!r) return null;
  const nama = petaNamaPengguna();
  return rowToLtk(r, {
    diinputOleh: namaTampil(nama, r.dibuat_oleh),
    ttdOleh: namaTampil(nama, r.ttd_oleh),
    lampiran: lampiranLtkUntuk([id]).get(id) || []
  });
}

export function removeLtk(id) {
  const r = db.prepare('SELECT manager_ttd, teknisi_ttd FROM ltk WHERE id = ?').get(id);
  hapusBerkasLampiranLtk(id);
  db.prepare('DELETE FROM ltk WHERE id = ?').run(id);
  if (r) { removeSignatureFile(r.manager_ttd); removeSignatureFile(r.teknisi_ttd); }
  return true;
}

/* ============== BAPB — BERITA ACARA PEMASANGAN BARANG ==============
 * Daftar barangnya dibaca-tulis utuh sebagai satu larik JSON. Setiap baris
 * dilongarkan sebelum simpan — kolom yang tidak dikenal dibuang, angka
 * dipaksa ke bentuk teks — supaya bentuk yang dikirim klien tidak menyusup
 * ke database apa adanya. */

const bapbItemBersih = (it = {}) => ({
  no: String(it.no ?? '').trim(),
  namaBarang: String(it.namaBarang ?? '').trim(),
  ukuran: String(it.ukuran ?? '').trim(),
  banyaknya: String(it.banyaknya ?? '').trim(),
  tanggalPemasangan: String(it.tanggalPemasangan ?? '').trim(),
  keterangan: String(it.keterangan ?? '').trim()
});

const rowToBapb = (r, extra = {}) => {
  let items = [];
  try { items = JSON.parse(r.items_json || '[]'); } catch { items = []; }
  let petugasList = [];
  try { petugasList = JSON.parse(r.petugas_nama_list || '[]'); } catch { petugasList = []; }
  return {
    ID: r.id, Unit: r.unit,
    Nomor: r.nomor, Tanggal: r.tanggal,
    UntukPekerjaan: r.untuk_pekerjaan, Lokasi: r.lokasi,
    Items: Array.isArray(items) ? items : [],
    PemakaiNama: r.pemakai_nama, PemakaiTTD: r.pemakai_ttd,
    TeknikNama: r.teknik_nama, TeknikTTD: r.teknik_ttd,
    // Nama teknisi pelaksana sekarang bisa jamak. Kolom lama `petugas_nama`
    // tetap terisi versi rangkumannya (dipisah koma) supaya rekap/pencarian
    // yang masih memanggilnya tidak putus.
    PetugasNama: r.petugas_nama,
    PetugasNamaList: Array.isArray(petugasList) ? petugasList : [],
    PetugasTTD: r.petugas_ttd,
    DiinputOleh: extra.diinputOleh ?? (r.dibuat_oleh || ''),
    DibuatOlehUsername: r.dibuat_oleh || '',
    DibuatPada: r.dibuat_pada || '',
    // Keterangan susulan slot Manager Teknik — sejajar form lain.
    TtdOleh: extra.ttdOleh ?? (r.ttd_oleh || ''), TtdPada: r.ttd_pada || '', TtdUntuk: r.ttd_untuk || ''
  };
};

export function listBapb(unit = 'radkom', limit = 200) {
  const rows = db.prepare(`SELECT * FROM bapb WHERE unit = ?
                           ORDER BY tanggal DESC, dibuat_pada DESC LIMIT ?`).all(unit, limit);
  const nama = petaNamaPengguna();
  return rows.map((r) => rowToBapb(r, {
    diinputOleh: namaTampil(nama, r.dibuat_oleh),
    ttdOleh: namaTampil(nama, r.ttd_oleh)
  }));
}

export function insertBapb(rec = {}, olehUsername = '', olehNama = '') {
  const teks = (v) => String(v ?? '').trim();
  const items = Array.isArray(rec.items) ? rec.items.map(bapbItemBersih) : [];

  // Nama teknisi pelaksana bisa jamak. Yang datang: `petugasNamaList` (larik).
  // `petugas_nama` diisi rangkumannya (dipisah koma) supaya kolom aslinya tetap
  // punya nilai bermakna kalau ada yang membacanya langsung tanpa JSON.
  const petugasList = Array.isArray(rec.petugasNamaList)
    ? rec.petugasNamaList.map((n) => teks(n)).filter(Boolean)
    : (teks(rec.petugasNama) ? [teks(rec.petugasNama)] : []);
  const petugasRingkas = petugasList.join(', ');

  const row = {
    id: newId(),
    unit: unitSah(rec.unit) ? rec.unit : 'radkom',
    nomor: teks(rec.nomor),
    tanggal: teks(rec.tanggal) || today(),
    untuk_pekerjaan: teks(rec.untukPekerjaan),
    lokasi: teks(rec.lokasi),
    items_json: JSON.stringify(items),
    pemakai_nama: teks(rec.pemakaiNama),
    pemakai_ttd: saveSignature(rec.pemakaiTtd, 'bapb_pemakai'),
    // Manager Teknik tidak lagi dibubuhkan di form: namanya boleh diisi (sebagai
    // tujuan), tanda tangannya dibubuhkan susulan lewat kotak masuk. ttd_untuk
    // menunjuk akun mantek supaya lembarnya muncul di kotak masuknya.
    teknik_nama: teks(rec.teknikNama),
    teknik_ttd: '',
    ttd_untuk: teks(rec.ttdUntuk),
    petugas_nama: petugasRingkas,
    petugas_nama_list: JSON.stringify(petugasList),
    petugas_ttd: saveSignature(rec.petugasTtd, 'bapb_petugas'),
    dibuat_pada: nowIso()
  };
  db.prepare(`INSERT INTO bapb (id, unit, nomor, tanggal, untuk_pekerjaan, lokasi, items_json,
                                pemakai_nama, pemakai_ttd, teknik_nama, teknik_ttd, ttd_untuk,
                                petugas_nama, petugas_nama_list, petugas_ttd, dibuat_pada, dibuat_oleh)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(row.id, row.unit, row.nomor, row.tanggal, row.untuk_pekerjaan, row.lokasi, row.items_json,
         row.pemakai_nama, row.pemakai_ttd, row.teknik_nama, row.teknik_ttd, row.ttd_untuk,
         row.petugas_nama, row.petugas_nama_list, row.petugas_ttd, row.dibuat_pada, olehUsername);
  return rowToBapb(row, { diinputOleh: olehNama || olehUsername });
}

/**
 * Sunting susulan BAPB — hanya panel Manager Pemakai (nama + tanda tangan).
 * Ini "langkah terakhir sebelum ke mantek": teknisi bisa menyimpan lembarnya
 * dulu, lalu membubuhkan/mengganti TTD pemakai belakangan. Dikunci begitu
 * Manager Teknik sudah tanda tangan — mengubah paraf di bawah lembar yang
 * sudah disahkan mantek sama saja memalsu arsip.
 */
export function updateBapb(id, patch = {}, { username = '', admin = false } = {}) {
  const r = db.prepare('SELECT dibuat_oleh, teknik_ttd, pemakai_ttd FROM bapb WHERE id = ?').get(String(id));
  if (!r) throw new Error('BAPB tidak ditemukan — mungkin sudah dihapus.');
  if (!admin && String(r.dibuat_oleh || '') !== String(username || '')) {
    throw new Error('Hanya pembuat lembar ini atau administrator yang boleh menyuntingnya.');
  }
  if (r.teknik_ttd) {
    throw new Error('Manager Teknik sudah tanda tangan — panel pemakai tidak bisa diubah lagi.');
  }
  const setBaru = {};
  if (patch.pemakaiNama !== undefined) setBaru.pemakai_nama = String(patch.pemakaiNama || '').trim();
  if (patch.pemakaiTtd !== undefined) {
    // TTD baru: string dataURL → simpan; string kosong → hapus paraf.
    const path = patch.pemakaiTtd ? saveSignature(patch.pemakaiTtd, 'bapb_pemakai') : '';
    if (r.pemakai_ttd && r.pemakai_ttd !== path) removeSignatureFile(r.pemakai_ttd);
    setBaru.pemakai_ttd = path;
  }
  const kunci = Object.keys(setBaru);
  if (kunci.length) {
    const potongan = kunci.map((k) => `${k} = ?`).join(', ');
    db.prepare(`UPDATE bapb SET ${potongan} WHERE id = ?`).run(...kunci.map((k) => setBaru[k]), String(id));
  }
  return getBapb(String(id));
}

export function getBapb(id) {
  const r = db.prepare('SELECT * FROM bapb WHERE id = ?').get(id);
  if (!r) return null;
  const nama = petaNamaPengguna();
  return rowToBapb(r, {
    diinputOleh: namaTampil(nama, r.dibuat_oleh),
    ttdOleh: namaTampil(nama, r.ttd_oleh)
  });
}

export function removeBapb(id) {
  const r = db.prepare('SELECT pemakai_ttd, teknik_ttd, petugas_ttd FROM bapb WHERE id = ?').get(id);
  db.prepare('DELETE FROM bapb WHERE id = ?').run(id);
  if (r) {
    removeSignatureFile(r.pemakai_ttd);
    removeSignatureFile(r.teknik_ttd);
    removeSignatureFile(r.petugas_ttd);
  }
  return true;
}

export const removeIssue = (id) => {
  hapusBerkasLampiranIsu(id);
  db.prepare('DELETE FROM issues WHERE id = ?').run(id);
  return true;
};

/* ============== TANDA TANGAN SUSULAN ==============
 * Catatan diinput teknisi saat dinas, sementara tanda tangan pihak kedua —
 * penanggung jawab, manager teknik, personil operasi — sering baru dibubuhkan
 * belakangan, kadang berhari-hari kemudian. Sebelum ini satu-satunya jalan
 * adalah menghapus catatannya lalu mengetik ulang semuanya.
 *
 * Daftar di bawah ini adalah SATU-SATUNYA kolom yang boleh disentuh lewat jalur
 * ini: petak tanda tangan pihak kedua pada tiap formulir. Nama tabel dan kolom
 * datang dari daftar tetap ini, bukan dari klien, jadi aman dirangkai ke SQL.
 */

export const JENIS_TTD = {
  logbook:    { tabel: 'entries',     nama: 'pj_nama',      ttd: 'pj_ttd',           prefix: 'logbook_pj',         label: 'Manager Teknik',   tglKolom: 'tanggal' },
  dailycheck: { tabel: 'dailychecks', nama: 'manager_nama', ttd: 'manager_ttd',      prefix: 'dailycheck_manager', label: 'Manager Teknik',   tglKolom: 'tanggal' },
  monitoring: { tabel: 'monitoring',  nama: 'personil_ops', ttd: 'personil_ops_ttd', prefix: 'monitoring_ops',     label: 'Personil Operasi', tglKolom: 'tanggal' },
  dstest:     { tabel: 'dstest',      nama: 'manager_nama', ttd: 'manager_ttd',      prefix: 'dstest_manager',     label: 'Manager Teknik',   tglKolom: 'tanggal' },
  berkala:    { tabel: 'berkala',     nama: 'manager_nama', ttd: 'manager_ttd',      prefix: 'berkala_manager',    label: 'Manager Teknik',   tglKolom: 'tanggal' },
  ltk:        { tabel: 'ltk',         nama: 'manager_nama', ttd: 'manager_ttd',      prefix: 'ltk_manager',        label: 'Manager Teknik',   tglKolom: 'tanggal_lapor' },
  // BAPB hanya merutekan SATU slot pihak-kedua ke akun — Manager Teknik.
  // Manager Pemakai & petugas dibubuhkan di form, di luar jalur susulan ini.
  bapb:       { tabel: 'bapb',        nama: 'teknik_nama',  ttd: 'teknik_ttd',       prefix: 'bapb_teknik',        label: 'Manager Teknik (BAPB)', tglKolom: 'tanggal' }
};

export const jenisTtdSah = (jenis) =>
  Object.prototype.hasOwnProperty.call(JENIS_TTD, String(jenis));

/** Unit pemilik sebuah catatan. Dipakai server untuk memeriksa hak akses. */
export function unitCatatan(jenis, id) {
  if (!jenisTtdSah(jenis)) return '';
  const t = JENIS_TTD[jenis];
  const r = db.prepare(`SELECT unit FROM ${t.tabel} WHERE id = ?`).get(String(id));
  return r ? (r.unit || '') : '';
}

/**
 * Bubuhkan tanda tangan pihak kedua pada catatan yang belum ditandatangani.
 *
 * Petak yang sudah terisi tidak pernah ditimpa: mengganti tanda tangan yang
 * sudah ada bukan "melengkapi", itu menghapus paraf orang lain.
 *
 * NAMA PADA FORMULIR TIDAK DIGANTI. Nama penanggung jawab atau manager teknik
 * sudah ditulis teknisi waktu mengisi formulirnya, dan itulah nama yang sah di
 * lembar cetak. Nama akun penandatangan hanya dicatat terpisah sebagai
 * keterangan siapa yang membubuhkan — tidak pernah muncul di hasil cetak.
 * Satu-satunya kalau nama pada formulir memang masih kosong, barulah nama akun
 * penandatangan dipakai supaya petaknya tidak tercetak tanpa nama sama sekali.
 */
export function tandaTanganiCatatan(jenis, id, { nama, username, role, ttd }) {
  if (!jenisTtdSah(jenis)) throw new Error('Jenis catatan tidak dikenal: ' + jenis);
  const t = JENIS_TTD[jenis];
  const row = db.prepare(`SELECT ${t.nama} AS nama, ${t.ttd} AS ttd, ttd_untuk,
                                 dibuat_oleh, ${t.tglKolom} AS tanggal
                            FROM ${t.tabel} WHERE id = ?`)
    .get(String(id));
  if (!row) throw new Error('Catatan tidak ditemukan — mungkin sudah dihapus.');
  if (row.ttd) throw new Error('Catatan ini sudah ditandatangani.');
  // Kalau catatan ditunjuk ke akun tertentu, hanya akun itu atau admin yang
  // boleh membubuhkan — nama pada formulir bisa sekadar sebutan jabatan
  // ("PH", dsb.), jadi kecocokan nama tidak dipakai untuk menentukan hak ini.
  if (row.ttd_untuk && role !== 'admin' && String(username || '').toLowerCase() !== String(row.ttd_untuk).toLowerCase()) {
    throw new Error('Catatan ini ditujukan untuk akun lain — hanya akun yang ditunjuk atau admin yang dapat menandatangani.');
  }

  const path = saveSignature(ttd, t.prefix);
  if (!path) throw new Error('Tanda tangannya kosong.');

  const namaTetap = String(row.nama || '').trim() ? row.nama : String(nama || '');
  const pada = nowIso();
  db.prepare(`UPDATE ${t.tabel} SET ${t.nama} = ?, ${t.ttd} = ?, ttd_oleh = ?, ttd_pada = ? WHERE id = ?`)
    .run(namaTetap, path, String(username || ''), pada, String(id));
  return {
    jenis, id: String(id), nama: namaTetap, ttd: path,
    ttdOleh: String(nama || username || ''), ttdPada: pada,
    // Untuk notifikasi balik ke pembuat/pelaksana (lihat server.js): siapa yang
    // membuat lembar ini, dan tanggalnya. Bukan bagian dari data formulir.
    dibuatOleh: String(row.dibuat_oleh || ''), tanggal: String(row.tanggal || '')
  };
}

/* ============== REKAP ==============
 * Baris seperlunya untuk satu rentang tanggal — tanpa batas 200 baris yang
 * berlaku di layar, karena rekap sebulan penuh justru butuh semuanya.
 *
 * Penjumlahannya sengaja TIDAK dikerjakan di SQL: rumus "minggu ke berapa"
 * berbeda antara SQLite dan Postgres, dan menulisnya dua kali berarti dua
 * tempat yang bisa berbeda diam-diam. Yang dikirim ke server.js baris mentah,
 * dan di sanalah satu-satunya rumus rekapnya.
 *
 * TIGA FORMULIR SAJA. Rekap ini menjawab "apa yang sudah pernah dialami", dan
 * hanya ketiga formulir inilah yang mencatat kejadian: logbook, laporan
 * kerusakan, dan isu. Daily check, monitoring, dan DS test tidak ikut —
 * isinya pemeriksaan yang memang dijadwalkan tiap hari, jadi memasukkannya
 * akan menenggelamkan kejadian yang benar-benar terjadi di bawah rutinitas.
 *
 * Kolom teksnya (uraian, analisa, keterangan) ikut terbawa karena dari
 * situlah jenis kejadian dikenali — lihat ATURAN_JENIS di server.js.
 */
export function rekapMentah(unit, dari, sampai) {
  const arg = [String(unit || ''), String(dari || '0000-01-01'), String(sampai || '9999-12-31')];
  const amb = (sql) => db.prepare(sql).all(...arg);
  return {
    entries: amb(`SELECT id, tanggal, dinas, lokasi, uraian, teknisi_nama, teknisi_nama_list
                    FROM entries WHERE unit = ? AND tanggal BETWEEN ? AND ?`),
    ltk: amb(`SELECT id, tanggal_lapor AS tanggal, peralatan, kelompok, modul, analisa, perbaikan,
                     teknisi_nama
                FROM ltk WHERE unit = ? AND tanggal_lapor BETWEEN ? AND ?`),
    issues: amb(`SELECT id, tanggal_report AS tanggal, status, jenis, keterangan, lokasi,
                        dilaporkan_oleh
                   FROM issues WHERE unit = ? AND substr(tanggal_report, 1, 10) BETWEEN ? AND ?`)
  };
}

/**
 * Akun yang boleh ditunjuk sebagai penerima TTD susulan — pejabat yang
 * masih aktif saja, bukan administrator (admin cuma pengelola sistem, bukan
 * penandatangan formulir). Dikirim ke SELURUH pengguna yang login (bukan
 * cuma admin), karena teknisi di form-lah yang memilih siapa yang dituju.
 */
export function listPejabatAktif() {
  return db.prepare(`SELECT username, nama FROM users
                      WHERE aktif = 1 AND role = 'pejabat'
                      ORDER BY nama COLLATE NOCASE`).all();
}

/**
 * Daftar ringkas seluruh akun aktif — hanya username + nama, tanpa peran
 * atau data lain. Dipakai dashboard untuk melengkapi nama dari daftar
 * petugas di hak.json (yang isinya username saja). Non-admin: aman karena
 * username & nama sudah tampil di formulir E-Logbook untuk siapa pun yang
 * login.
 */
export function listAkunAktif() {
  return db.prepare(`SELECT username, nama FROM users
                      WHERE aktif = 1
                      ORDER BY nama COLLATE NOCASE`).all();
}

/**
 * Pejabat aktif yang sudah opt-in ke satu unit (mencentangnya di Kelola Akun).
 * Dipakai kartu cetak dashboard untuk menaruh nama Manajer Teknik bidang itu
 * pada kolom tanda tangan kanan. Kalau tidak ada satu pun yang opt-in, kartu
 * cetak boleh jatuh balik ke listPejabatAktif().
 */
export function listPejabatUnit(unitKode) {
  const kode = String(unitKode || '').trim();
  if (!kode) return [];
  return db.prepare(`
    SELECT u.username, u.nama
      FROM users u
     WHERE u.aktif = 1 AND u.role = 'pejabat'
       AND EXISTS (SELECT 1 FROM user_unit uu WHERE uu.user_id = u.id AND uu.unit = ?)
     ORDER BY u.nama COLLATE NOCASE`).all(kode);
}

/**
 * Akun yang muncul sebagai saran nama teknisi di formulir untuk satu unit.
 * Baris pertama nama teknisi tetap otomatis diisi nama pengisi dokumen; baris
 * berikutnya menampilkan daftar ini sebagai saran, supaya nama-nama yang salah
 * eja atau salah singkatan tidak lagi tersimpan sebagai salinan berbeda dari
 * orang yang sama.
 *
 * Yang menentukan bukan peran, melainkan keanggotaan unit di user_unit:
 *   - Teknisi/PIC/Admin Unit: user_unit-nya adalah pagar akses; ikut menjadi
 *     opt-in otomatis sebagai anggota tim unit itu.
 *   - Administrator dan Pejabat: akses mereka lintas unit lewat peran, jadi
 *     user_unit tidak dipakai untuk pagar; di sini ia dipakai sebagai opt-in
 *     — administrator yang memang ikut dinas di unit tertentu mencentang unit
 *     itu di Kelola Akun, dan namanya baru muncul sebagai saran teknisi di
 *     sana. Yang tidak mencentang tidak muncul, walaupun teknis mereka boleh
 *     membuka semua unit.
 */
export function listTeknisiUnit(unitKode) {
  const kode = String(unitKode || '').trim();
  if (!kode) return [];
  return db.prepare(`
    SELECT u.username, u.nama
      FROM users u
     WHERE u.aktif = 1
       AND EXISTS (SELECT 1 FROM user_unit uu WHERE uu.user_id = u.id AND uu.unit = ?)
     ORDER BY u.nama COLLATE NOCASE`).all(kode);
}

/**
 * Kotak masuk TTD seorang akun: seluruh catatan di lima formulir yang
 * menunjuknya (ttd_untuk) dan belum ditandatangani siapa pun. Lintas unit —
 * pejabat dan admin memang berhak atas semua unit, jadi tidak digilir per unit
 * seperti data lainnya.
 */
export function getInboxTtd(username) {
  const u = String(username || '').trim();
  if (!u) return [];
  const hasil = [];
  for (const [jenis, t] of Object.entries(JENIS_TTD)) {
    const rows = db.prepare(`SELECT id, unit, ${t.nama} AS nama, ${t.tglKolom} AS tanggal, dibuat_pada
                              FROM ${t.tabel} WHERE ttd_untuk = ? AND (${t.ttd} = '' OR ${t.ttd} IS NULL)
                              ORDER BY dibuat_pada DESC LIMIT 50`).all(u);
    for (const r of rows) {
      hasil.push({
        jenis, id: r.id, unit: r.unit || '', nama: r.nama || '',
        tanggal: r.tanggal || '', label: t.label, dibuatPada: r.dibuat_pada
      });
    }
  }
  hasil.sort((a, b) => (a.dibuatPada < b.dibuatPada ? 1 : -1));
  return hasil;
}

/* ============== TAUTAN TELEGRAM ==============
 * Pemetaan akun E-Logbook ↔ chat Telegram, plus token taut sekali-pakai.
 * Notifikasi dikirim ke chat_id, dan chat_id hanya bisa didapat setelah orang
 * itu menekan Start di bot — jadi tiap akun menautkan dirinya sekali:
 *   1. buatTautanTelegram → token acak yang ditaruh di tautan t.me/<bot>?start=…
 *   2. orang membuka tautan, bot menerima /start <token>
 *   3. tautkanTelegram(token, chatId) mengunci chat itu ke akun tersebut
 * Cermin Postgres-nya ada di db-pg.js — kalau yang satu diubah, yang lain ikut. */

export function buatTautanTelegram(username) {
  const u = String(username || '').trim();
  if (!u) throw new Error('Akun tidak dikenal.');
  const token = crypto.randomBytes(24).toString('base64url');
  const ada = db.prepare('SELECT username FROM telegram_akun WHERE username = ?').get(u);
  if (ada) {
    db.prepare('UPDATE telegram_akun SET tautan_token = ? WHERE username = ?').run(token, u);
  } else {
    db.prepare(`INSERT INTO telegram_akun (username, chat_id, tautan_token, ditautkan_pada, dibuat_pada)
                VALUES (?, '', ?, '', ?)`).run(u, token, nowIso());
  }
  return token;
}

export function tautkanTelegram(token, chatId) {
  const t = String(token || '').trim();
  const c = String(chatId || '').trim();
  if (!t || !c) return null;
  const row = db.prepare(`SELECT username FROM telegram_akun
                           WHERE tautan_token = ? AND tautan_token <> ''`).get(t);
  if (!row) return null;
  // Satu chat Telegram hanya boleh menempel ke satu akun: lepas tautan lama chat ini.
  db.prepare("UPDATE telegram_akun SET chat_id = '' WHERE chat_id = ? AND username <> ?")
    .run(c, row.username);
  db.prepare(`UPDATE telegram_akun SET chat_id = ?, tautan_token = '', ditautkan_pada = ?
               WHERE username = ?`).run(c, nowIso(), row.username);
  const usr = db.prepare('SELECT nama FROM users WHERE username = ?').get(row.username);
  return { username: row.username, nama: (usr && usr.nama) || row.username };
}

export function getChatIdTelegram(username) {
  const u = String(username || '').trim();
  if (!u) return '';
  const row = db.prepare('SELECT chat_id FROM telegram_akun WHERE username = ?').get(u);
  return (row && row.chat_id) || '';
}

export function putusTautanTelegram(username) {
  const u = String(username || '').trim();
  if (u) db.prepare("UPDATE telegram_akun SET chat_id = '', tautan_token = '' WHERE username = ?").run(u);
  return { tertaut: false };
}

export function statusTautanTelegram(username) {
  const u = String(username || '').trim();
  if (!u) return { tertaut: false, ditautkanPada: '' };
  const row = db.prepare('SELECT chat_id, ditautkan_pada FROM telegram_akun WHERE username = ?').get(u);
  return { tertaut: !!(row && row.chat_id), ditautkanPada: (row && row.ditautkan_pada) || '' };
}
