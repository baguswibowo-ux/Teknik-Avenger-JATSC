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

-- Unit mana saja yang boleh dibuka sebuah akun. Diatur administrator.
CREATE TABLE IF NOT EXISTS user_unit (
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  unit     TEXT NOT NULL,
  PRIMARY KEY (user_id, unit)
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
for (const tabel of ['entries', 'dailychecks', 'monitoring', 'dstest', 'ltk']) {
  tambahKolom(tabel, 'ttd_oleh', "TEXT NOT NULL DEFAULT ''");
  tambahKolom(tabel, 'ttd_pada', "TEXT NOT NULL DEFAULT ''");
  tambahKolom(tabel, 'ttd_untuk', "TEXT NOT NULL DEFAULT ''");
}

/* Tanda tangan tersimpan milik akun: digambar sekali oleh pemiliknya lewat menu
   "TTD Saya", lalu dipakai ulang tiap mengisi formulir tanpa menggambar lagi.
   Isinya path berkas, sama seperti tanda tangan pada catatan — bedanya berkas
   ini milik akun, bukan milik satu catatan. Lihat simpanTtdTersimpan. */
tambahKolom('users', 'ttd_tersimpan', "TEXT NOT NULL DEFAULT ''");

// DS Test: kategori daftar site, plus penandatangan Manager Teknik.
tambahKolom('dstest', 'kategori', "TEXT NOT NULL DEFAULT 'domestik'");
tambahKolom('dstest', 'manager_nama', "TEXT NOT NULL DEFAULT ''");
tambahKolom('dstest', 'manager_ttd', "TEXT NOT NULL DEFAULT ''");

/* Daily check menyimpan tanggalnya sebagai teks panjang ("KAMIS / 6 AGU 2026")
   yang tidak bisa diurutkan langsung — lihat tanggal-lama.js. Kolom ini
   menyimpan bentuk ISO-nya, khusus untuk ORDER BY riwayat. */
tambahKolom('dailychecks', 'tanggal_urut', "TEXT NOT NULL DEFAULT ''");

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
export function hapusUser(username) {
  const u = getUserByUsername(username);
  if (!u) return false;
  if (u.aktif) throw new Error('Akun itu masih aktif. Nonaktifkan dulu sebelum dihapus.');
  // Keduanya sebenarnya ikut terhapus lewat ON DELETE CASCADE; ditulis tegas
  // supaya tidak bergantung pada PRAGMA foreign_keys yang bisa saja mati.
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id);
  db.prepare('DELETE FROM user_unit WHERE user_id = ?').run(u.id);
  // Tanda tangan tersimpannya ikut hilang bersama akunnya. Yang sudah terlanjur
  // dibubuhkan pada catatan tidak tersentuh — itu salinan tersendiri.
  removeSignatureFile(u.ttd_tersimpan);
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
    peralatan: 'Radio Komunikasi, VSCS Garex, Recording Neptuno',
    dinas: ['Pagi', 'Siang', 'Malam', 'PS'],
    pakaiJamSelesai: false,
    pakaiFrek: false,
    labelUraian: 'Uraian Pekerjaan / Kejadian',
    labelPj: 'Penanggung Jawab',
    adaDailyCheck: true,
    dcJudul: 'Daily Check VCS Garex 300 — Unit Radtel',
    adaMonitoring: false,
    adaDsTest: true,
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
    pakaiJamSelesai: false,
    pakaiFrek: false,
    labelUraian: 'Uraian Pekerjaan / Kejadian',
    labelPj: 'Penanggung Jawab',
    // Formulir khusus unit ini menunggu form aslinya. Sampai itu ada, yang
    // tersedia baru Logbook Fasilitas, Isu, dan LTK yang memang berlaku umum.
    adaDailyCheck: false,
    adaMonitoring: false,
    adaDsTest: false,
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
    pakaiJamSelesai: false,
    pakaiFrek: false,
    labelUraian: 'Uraian Pekerjaan / Kejadian',
    labelPj: 'Penanggung Jawab',
    // Formulir khusus unit ini menunggu form aslinya. Sampai itu ada, yang
    // tersedia baru Logbook Fasilitas, Isu, dan LTK yang memang berlaku umum.
    adaDailyCheck: false,
    adaMonitoring: false,
    adaDsTest: false,
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
    peralatan: 'AMHS dan ADPS',
    dinas: ['Pagi', 'Siang', 'Malam', 'PS'],
    pakaiJamSelesai: false,
    pakaiFrek: false,
    labelUraian: 'Uraian Pekerjaan / Kejadian',
    labelPj: 'Penanggung Jawab',
    // Formulir khusus unit ini menunggu form aslinya. Sampai itu ada, yang
    // tersedia baru Logbook Fasilitas, Isu, dan LTK yang memang berlaku umum.
    adaDailyCheck: false,
    adaMonitoring: false,
    adaDsTest: false,
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
    pakaiJamSelesai: false,
    pakaiFrek: false,
    labelUraian: 'Uraian Pekerjaan / Kejadian',
    labelPj: 'Penanggung Jawab',
    // Formulir khusus unit ini menunggu form aslinya. Sampai itu ada, yang
    // tersedia baru Logbook Fasilitas, Isu, dan LTK yang memang berlaku umum.
    adaDailyCheck: false,
    adaMonitoring: false,
    adaDsTest: false,
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
    pakaiJamSelesai: false,
    pakaiFrek: false,
    labelUraian: 'Uraian Pekerjaan / Kejadian',
    labelPj: 'Penanggung Jawab',
    // Formulir khusus unit ini menunggu form aslinya. Sampai itu ada, yang
    // tersedia baru Logbook Fasilitas, Isu, dan LTK yang memang berlaku umum.
    adaDailyCheck: false,
    adaMonitoring: false,
    adaDsTest: false,
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
    pakaiJamSelesai: false,
    pakaiFrek: false,
    labelUraian: 'Uraian Pekerjaan / Kejadian',
    labelPj: 'Penanggung Jawab',
    // Formulir khusus unit ini menunggu form aslinya. Sampai itu ada, yang
    // tersedia baru Logbook Fasilitas, Isu, dan LTK yang memang berlaku umum.
    adaDailyCheck: false,
    adaMonitoring: false,
    adaDsTest: false,
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

// Akun yang sudah ada dibuat sebelum unit dikenal — beri akses Radtel supaya
// tidak ada yang mendadak kehilangan logbook yang selama ini dipakainya.
for (const u of db.prepare('SELECT id FROM users').all()) {
  const punya = db.prepare('SELECT COUNT(*) AS n FROM user_unit WHERE user_id = ?').get(u.id).n;
  if (punya === 0) db.prepare("INSERT INTO user_unit (user_id, unit) VALUES (?, 'radtel')").run(u.id);
}

/**
 * admin     — kendali penuh, termasuk menghapus dan mengelola akun
 * pejabat   — melihat seluruh unit; satu-satunya perubahan yang boleh dilakukannya
 *             adalah membubuhkan tanda tangannya pada petak yang masih kosong
 * adminunit — administrator yang wilayahnya satu unit: mengisi, mengubah,
 *             menghapus, dan membaca log aktivitas — semuanya hanya di unitnya
 * pic       — penanggung jawab satu unit: mengisi dan mengubah, tidak menghapus
 * teknisi   — hanya menambah, dan hanya pada unit yang diberikan kepadanya
 *
 * Dua yang di tengah dipakai Dashboard Fasilitas Teknik, bukan oleh E-Logbook
 * sendiri. E-Logbook tetap perlu mengenalnya: peran disimpan di sini, dan yang
 * tidak ada di daftar ini tidak akan pernah bisa diberikan kepada siapa pun —
 * jadi tanpa keduanya, pagar per unit di dashboard tidak punya akun untuk
 * dijaga. Di dalam E-Logbook sendiri keduanya berperilaku seperti teknisi:
 * bukan SEMUA_UNIT, jadi tetap dibatasi unit yang diberikan kepadanya.
 */
export const ROLE_VALID = ['admin', 'pejabat', 'adminunit', 'pic', 'teknisi'];

/** Peran yang boleh membuka seluruh unit tanpa perlu diberi satu per satu.
    adminunit dan pic sengaja TIDAK di sini: seluruh gunanya justru terletak
    pada wilayahnya yang satu unit. */
export const SEMUA_UNIT = ['admin', 'pejabat'];

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
 * Jumlah admin yang masih aktif. Dipakai untuk menolak perubahan yang membuat
 * sistem tidak punya admin sama sekali — kalau itu terjadi, akun tidak bisa
 * dikelola lagi kecuali lewat command line di server.
 */
export const jumlahAdminAktif = () =>
  db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND aktif = 1").get().n;

export const getUserByUsername = (username) =>
  db.prepare('SELECT * FROM users WHERE username = ?').get(String(username).trim());

export const listUsers = () =>
  db.prepare('SELECT id, username, nama, role, aktif, dibuat_pada FROM users ORDER BY username')
    .all()
    .map((u) => ({ ...u, unit: unitUntukUser(u) }));

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
    SELECT u.id, u.username, u.nama, u.role, u.aktif, s.kadaluarsa
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ?`).get(token);
  if (!row) return null;
  if (row.kadaluarsa < nowIso()) { deleteSession(token); return null; }
  if (!row.aktif) return null;
  return { id: row.id, username: row.username, nama: row.nama, role: row.role };
}

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

export function getTtdTersimpan(username) {
  const u = getUserByUsername(username);
  return u ? (u.ttd_tersimpan || '') : '';
}

export function simpanTtdTersimpan(username, dataUrl) {
  const u = getUserByUsername(username);
  if (!u) throw new Error('Akun tidak ditemukan.');
  const baru = saveSignature(dataUrl, 'ttd_akun');
  if (!baru) throw new Error('Tanda tangannya masih kosong.');
  const lama = u.ttd_tersimpan;
  db.prepare('UPDATE users SET ttd_tersimpan = ? WHERE id = ?').run(baru, u.id);
  // Yang lama dibuang setelah yang baru tercatat, bukan sebelumnya: kalau
  // urutannya terbalik dan penyimpanannya gagal, orangnya kehilangan keduanya.
  if (lama) removeSignatureFile(lama);
  return baru;
}

export function hapusTtdTersimpan(username) {
  const u = getUserByUsername(username);
  if (!u) return false;
  db.prepare("UPDATE users SET ttd_tersimpan = '' WHERE id = ?").run(u.id);
  if (u.ttd_tersimpan) removeSignatureFile(u.ttd_tersimpan);
  return true;
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
 * Sengaja TIDAK menyentuh nama teknisi, tanda tangan, atau lampiran — itu
 * bukti kerja yang sudah dibubuhkan, bukan metadata yang boleh ditimpa diam-diam.
 */
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

  const next = {
    tanggal: patch.tanggal !== undefined ? String(patch.tanggal || '') : row.tanggal,
    jam: patch.jam !== undefined ? String(patch.jam || '') : row.jam,
    jam_selesai: patch.jamSelesai !== undefined ? String(patch.jamSelesai || '') : row.jam_selesai,
    frek: patch.frek !== undefined ? String(patch.frek || '').trim() : row.frek,
    dinas: patch.dinas !== undefined ? String(patch.dinas || '') : row.dinas,
    lokasi: patch.lokasi !== undefined ? (lokasiSah(patch.lokasi) ? patch.lokasi : '') : row.lokasi,
    uraian
  };

  db.prepare(`UPDATE entries SET tanggal = ?, jam = ?, jam_selesai = ?, frek = ?, dinas = ?, lokasi = ?, uraian = ?
              WHERE id = ?`)
    .run(next.tanggal, next.jam, next.jam_selesai, next.frek, next.dinas, next.lokasi, next.uraian, String(id));

  const nama = petaNamaPengguna();
  const lampiran = lampiranUntuk([String(id)]).get(String(id)) || [];
  return rowToEntry({ ...row, ...next }, {
    diinputOleh: namaTampil(nama, row.dibuat_oleh),
    ttdOleh: namaTampil(nama, row.ttd_oleh),
    lampiran
  });
}

/* ============== DAILY CHECK ============== */

/** Ringkasan untuk daftar riwayat — state_json sengaja tidak ikut karena besar. */
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
  TanggalIso: r.tanggal_urut || ''
});

export function listDailyChecks(unit = 'radtel', limit = 200) {
  const rows = db.prepare(`SELECT id, tanggal, tanggal_urut, dinas, suhu, remark, teknisi_nama, teknisi_ttd,
                                  manager_nama, manager_ttd, fails_json, warns_json, teknisi_nama_list,
                                  dibuat_oleh, dibuat_pada, ttd_oleh, ttd_pada, ttd_untuk
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
 * Ubah tanggal daily check yang sudah tersimpan — pemilih tanggal saat mengisi
 * bisa salah pencet, dan checklist-nya sendiri terlalu panjang untuk dibuat
 * ulang hanya karena itu. tanggal_urut ikut disegarkan supaya riwayatnya tetap
 * terurut benar (lihat tanggal-lama.js).
 */
export function updateDailyCheck(id, patch = {}, actor = {}) {
  const row = db.prepare('SELECT * FROM dailychecks WHERE id = ?').get(String(id));
  if (!row) throw new Error('Catatan tidak ditemukan — mungkin sudah dihapus.');
  if (row.manager_ttd) throw new Error('Catatan ini sudah ditandatangani manager teknik — tidak bisa disunting lagi.');
  if (!actor.admin && row.dibuat_oleh && row.dibuat_oleh !== actor.username) {
    throw new Error('Hanya pembuat catatan ini yang bisa menyuntingnya.');
  }

  const tanggal = patch.tanggal !== undefined ? String(patch.tanggal || '') : row.tanggal;
  if (!tanggal) throw new Error('Tanggal tidak boleh kosong.');
  const tanggal_urut = String(patch.tanggalIso || '').trim() || isoDariTanggalPanjang(tanggal) || row.tanggal_urut;

  db.prepare('UPDATE dailychecks SET tanggal = ?, tanggal_urut = ? WHERE id = ?')
    .run(tanggal, tanggal_urut, String(id));

  const nama = petaNamaPengguna();
  return rowToDcRingkas({ ...row, tanggal, tanggal_urut }, {
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
  return rowToIssue(r, {
    diinputOleh: namaTampil(petaNamaPengguna(), r.dibuat_oleh),
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
    tanggal_report: String(isu.tanggalReport || '').trim() || today(),
    tanggal_closed: status === 'Closed' ? today() : '',
    // Pelapor diketik sendiri: yang menemukan gangguan sering bukan orang yang
    // mengetikkannya ke sistem. Kalau dikosongkan, dipakai nama penginputnya.
    dilaporkan_oleh: String(isu.dilaporkanOleh || '').trim() || olehNama || olehUsername,
    dibuat_pada: nowIso()
  };
  db.prepare(`INSERT INTO issues (id, unit, jenis, keterangan, lokasi, status, tanggal_report, tanggal_closed,
                                  dilaporkan_oleh, dibuat_pada, dibuat_oleh)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(row.id, row.unit, row.jenis, row.keterangan, row.lokasi, row.status,
         row.tanggal_report, row.tanggal_closed, row.dilaporkan_oleh, row.dibuat_pada, olehUsername);

  const lampiranOpen = tambahLampiranIsu(id, 'open', isu.lampiranOpen);
  const lampiranClosed = status === 'Closed' ? tambahLampiranIsu(id, 'closed', isu.lampiranClosed) : [];

  return rowToIssue(row, { diinputOleh: olehNama || olehUsername, lampiranOpen, lampiranClosed });
}

/** Nama kolom dibatasi daftar putih — nilai dari klien tidak boleh masuk ke SQL. */
const ISSUE_FIELDS = {
  Jenis: 'jenis', Keterangan: 'keterangan', Lokasi: 'lokasi', Status: 'status',
  TanggalReport: 'tanggal_report', TanggalClosed: 'tanggal_closed',
  DilaporkanOleh: 'dilaporkan_oleh'
};

/**
 * Ubah satu kolom isu. Mengembalikan isu versi terbaru (atau null kalau gagal),
 * karena mengubah Status ikut menggeser tanggal closed-nya.
 */
export function updateIssue(id, headerField, value) {
  const col = ISSUE_FIELDS[headerField];
  if (!col) return null;
  const sebelum = getIssueRow(id);
  if (!sebelum) return null;

  db.prepare(`UPDATE issues SET ${col} = ? WHERE id = ?`).run(String(value ?? ''), id);

  // Tanggal closed mengikuti status: terisi sendiri saat isu ditutup, dan
  // dikosongkan lagi kalau isunya dibuka kembali. Tanggal yang sudah diisi
  // manual tidak ditimpa.
  if (col === 'status') {
    const status = String(value ?? '');
    if (status === 'Closed' && !sebelum.tanggal_closed) {
      db.prepare('UPDATE issues SET tanggal_closed = ? WHERE id = ?').run(today(), id);
    } else if (status !== 'Closed' && sebelum.tanggal_closed) {
      db.prepare("UPDATE issues SET tanggal_closed = '' WHERE id = ?").run(id);
    }
  }

  return getIssue(id);
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
  const kategori = kategoriDsSah(rec.kategori) ? rec.kategori : 'domestik';
  // Daftar site yang masih kosong berarti formnya belum bisa dipakai —
  // menyimpan lembar tanpa satu pun site hanya menghasilkan berkas kosong.
  if (dsSiteUntuk(kategori).length === 0) {
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

export function removeDsTest(id) {
  const r = db.prepare('SELECT teknisi_ttd, manager_ttd FROM dstest WHERE id = ?').get(id);
  db.prepare('DELETE FROM dstest WHERE id = ?').run(id);
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
  logbook:    { tabel: 'entries',     nama: 'pj_nama',      ttd: 'pj_ttd',           prefix: 'logbook_pj',         label: 'Penanggung Jawab', tglKolom: 'tanggal' },
  dailycheck: { tabel: 'dailychecks', nama: 'manager_nama', ttd: 'manager_ttd',      prefix: 'dailycheck_manager', label: 'Manager Teknik',   tglKolom: 'tanggal' },
  monitoring: { tabel: 'monitoring',  nama: 'personil_ops', ttd: 'personil_ops_ttd', prefix: 'monitoring_ops',     label: 'Personil Operasi', tglKolom: 'tanggal' },
  dstest:     { tabel: 'dstest',      nama: 'manager_nama', ttd: 'manager_ttd',      prefix: 'dstest_manager',     label: 'Manager Teknik',   tglKolom: 'tanggal' },
  ltk:        { tabel: 'ltk',         nama: 'manager_nama', ttd: 'manager_ttd',      prefix: 'ltk_manager',        label: 'Manager Teknik',   tglKolom: 'tanggal_lapor' }
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
  const row = db.prepare(`SELECT ${t.nama} AS nama, ${t.ttd} AS ttd, ttd_untuk FROM ${t.tabel} WHERE id = ?`)
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
    ttdOleh: String(nama || username || ''), ttdPada: pada
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
                   FROM issues WHERE unit = ? AND tanggal_report BETWEEN ? AND ?`)
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
