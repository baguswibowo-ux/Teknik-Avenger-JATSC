/**
 * E-LOGBOOK NEW JATSC — LAPISAN DATABASE (POSTGRES / SUPABASE)
 *
 * Cerminan dari db.js, tetapi untuk Postgres. Dipakai kalau aplikasi dijalankan
 * di Vercel atau di mana pun yang tidak punya penyimpanan berkas menetap.
 *
 * Perbedaan mendasar dari versi SQLite:
 *   - Semua fungsi async. Pemanggil wajib await.
 *   - Berkas (tanda tangan, lampiran) tidak ditulis ke disk, tetapi ke
 *     Supabase Storage. Yang disimpan di database tetap path-nya saja,
 *     jadi bentuk datanya sama persis dengan versi SQLite.
 *
 * Environment variable yang wajib:
 *   DATABASE_URL           connection string Postgres Supabase
 *   SUPABASE_URL           https://<ref>.supabase.co
 *   SUPABASE_SERVICE_KEY   service role key (JANGAN pernah dikirim ke browser)
 * Opsional:
 *   ELOGBOOK_BUCKET        nama bucket storage (default: elogbook)
 */

import crypto from 'node:crypto';
import pg from 'pg';
import { isoDariTanggalPanjang } from './tanggal-lama.js';
import { DS_SITE, KATEGORI_DS, kategoriDsSah, dsSiteUntuk } from './ds-site.js';
import { BERKALA_ITEM, JENIS_BERKALA, jenisBerkalaSah, berkalaItemUntuk } from './berkala-item.js';

const { Pool } = pg;

// node-pg mengembalikan bigint sebagai TEKS, karena bisa melebihi angka aman
// JavaScript. Di aplikasi ini bigint hanya dipakai untuk id pengguna dan ukuran
// berkas — keduanya jauh di bawah batas itu. Tanpa baris ini, COUNT(*) menjadi
// "3" bukan 3, dan perbandingan angka diam-diam meleset.
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));

const DATABASE_URL = process.env.DATABASE_URL || '';
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const BUCKET = process.env.ELOGBOOK_BUCKET || 'elogbook';

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL belum diisi. Lapisan Postgres tidak bisa dipakai tanpa itu.');
}

/**
 * Ukuran kolam koneksi.
 *
 * Di serverless kolam ini pernah dibatasi satu koneksi, dengan alasan tiap
 * permintaan bisa mendarat di wadah yang berbeda sehingga koneksi tambahan
 * hanya membuang jatah Supabase. Alasannya benar untuk permintaan yang saling
 * susul, tapi keliru untuk satu permintaan yang membaca banyak tabel sekaligus:
 * dengan kolam satu koneksi, sepuluh kueri getAllData yang dikirim berbarengan
 * tetap mengantre satu per satu, dan menunggu jaringan sepuluh kali berderet.
 * Empat cukup untuk memotong antrean itu tanpa menghabiskan jatah koneksi.
 *
 * Di server kantor yang hidup terus, kolam yang lebih besar berguna karena
 * beberapa teknisi menyimpan bersamaan saat pergantian dinas.
 */
const DI_SERVERLESS = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

export const pool = new Pool({
  connectionString: DATABASE_URL,
  // Supabase memakai sertifikat yang tidak ada di daftar bawaan Node.
  ssl: { rejectUnauthorized: false },
  max: Number(process.env.PGPOOL_MAX || (DI_SERVERLESS ? 4 : 5)),
  idleTimeoutMillis: DI_SERVERLESS ? 10_000 : 30_000,
  connectionTimeoutMillis: 15_000
});

// Koneksi bisa diputus sepihak oleh pooler Supabase saat menganggur. Tanpa
// penangan ini, Node menganggapnya galat tak tertangani dan menghentikan proses.
pool.on('error', (err) => console.error('[pg] koneksi menganggur bermasalah:', err.message));

/* ============== PEMBANTU KUERI ============== */

/* Galat yang berarti "koneksinya mati", bukan "kuerinya salah".
 *
 * Pooler Supabase memutus koneksi menganggur sepihak. Pool bisa terlanjur
 * menyerahkan koneksi seperti itu ke satu kueri sebelum sempat tahu ia sudah
 * mati — kueri itu gagal seketika dengan galat koneksi, bukan galat SQL.
 * Percobaan kedua mengambil koneksi baru dan lolos.
 *
 * Ini lebih sering terjadi sejak E-Logbook jadi komponen internal di dalam
 * fungsi Avenger (satu deploy): banyak permintaan dilayani rute Avenger sendiri
 * tanpa menyentuh pool ini, jadi koneksinya lebih lama menganggur dan lebih
 * sering diputus. Yang paling kena: /api/me, yang tiap dibuka menanyakan tabel
 * sessions.
 *
 * Hanya galat koneksi yang diulang. Galat SQL (sintaks, batasan, tipe)
 * diteruskan apa adanya — mengulangnya cuma menyembunyikan bug di balik
 * percobaan kedua yang gagal dengan cara yang sama. */
const GALAT_KONEKSI = /ECONNRESET|Connection terminated|terminating connection|Connection ended|server closed the connection|encountered a connection error|socket hang up|ETIMEDOUT|EPIPE|read ECONNRESET/i;
const KODE_KONEKSI = new Set(['57P01', '57P02', '57P03', '08006', '08003', '08000', 'ECONNRESET', 'EPIPE', 'ETIMEDOUT']);

function galatKoneksi(e) {
  if (!e) return false;
  if (e.code && KODE_KONEKSI.has(e.code)) return true;
  return GALAT_KONEKSI.test(e.message || '');
}

/** Jalankan kueri; kalau gagal karena koneksi basi, ambil koneksi baru sekali lagi. */
async function kueri(sql, params = []) {
  try {
    return await pool.query(sql, params);
  } catch (e) {
    if (!galatKoneksi(e)) throw e;
    console.warn('[pg] koneksi basi, ulang sekali:', e.message || e.code);
    return await pool.query(sql, params);
  }
}

/** Jalankan kueri, kembalikan seluruh baris. */
const q = async (sql, params = []) => (await kueri(sql, params)).rows;
/** Baris pertama saja, atau undefined. */
const q1 = async (sql, params = []) => (await kueri(sql, params)).rows[0];
/** Jumlah baris yang terpengaruh. */
const jalankan = async (sql, params = []) => (await kueri(sql, params)).rowCount;

/* ============== TABEL SUSULAN ==============
 * Skema Supabase dibuat sekali di luar aplikasi, dan tabel yang lahir setelah
 * itu tidak punya jalan masuk ke sana selain lewat sini. Kolom susulan di bawah
 * memakai ALTER; tabel yang memang belum pernah ada perlu CREATE.
 *
 * IF NOT EXISTS membuatnya aman dijalankan pada tiap cold start, dan tidak
 * seperti ALTER TABLE, CREATE TABLE IF NOT EXISTS pada tabel yang sudah ada
 * tidak mengunci apa pun.
 *
 * Bentuknya harus sepadan dengan CREATE TABLE berkala di db.js. Keduanya
 * ditulis dua kali karena tipe SQLite dan Postgres memang berbeda — kalau yang
 * satu diubah, yang lain wajib ikut.
 */
const TABEL_SUSULAN = [
  /* Bentuk lama berkolom `periode` (mingguan/bulanan) dibuang. Pekerjaannya
     sekarang dipecah per jenis. Tanpa ini CREATE TABLE IF NOT EXISTS di
     bawah menemukan tabel bernama sama lalu diam saja, dan kolom `jenis`
     tidak akan pernah ada. Hanya bentuk lama yang kena — dikenali dari
     kolom `periode`, jadi aman diulang tiap cold start. */
  `DO $$
   BEGIN
     IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = current_schema()
                  AND table_name = 'berkala' AND column_name = 'periode') THEN
       DROP TABLE berkala;
     END IF;
   END $$`,
  `CREATE TABLE IF NOT EXISTS berkala (
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
     ttd_oleh          TEXT NOT NULL DEFAULT '',
     ttd_pada          TEXT NOT NULL DEFAULT '',
     ttd_untuk         TEXT NOT NULL DEFAULT '',
     dibuat_pada       TEXT NOT NULL,
     dibuat_oleh       TEXT NOT NULL DEFAULT ''
   )`,
  'CREATE INDEX IF NOT EXISTS idx_berkala_unit ON berkala(unit, jenis, tanggal)',
  /* BAPB — Berita Acara Pemasangan Barang. Bentuknya harus sepadan dengan
     CREATE TABLE bapb di db.js. Daftar barangnya disimpan sebagai teks JSON
     di items_json (bukan tabel anak) — kolomnya ikut berkas Excel resminya. */
  `CREATE TABLE IF NOT EXISTS bapb (
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
   )`,
  'CREATE INDEX IF NOT EXISTS idx_bapb_unit ON bapb(unit, tanggal)',
  /* Tautan notifikasi Telegram — sepadan dengan CREATE TABLE telegram_akun di
     db.js. username disimpan lowercase oleh pemanggil supaya cocok lintas kasus. */
  `CREATE TABLE IF NOT EXISTS telegram_akun (
     username       TEXT PRIMARY KEY,
     chat_id        TEXT NOT NULL DEFAULT '',
     tautan_token   TEXT NOT NULL DEFAULT '',
     ditautkan_pada TEXT NOT NULL DEFAULT '',
     dibuat_pada    TEXT NOT NULL DEFAULT ''
   )`
];
for (const sql of TABEL_SUSULAN) {
  try {
    await pool.query(sql);
  } catch (err) {
    console.error('[db-pg] gagal membuat tabel susulan:', err?.message || err);
  }
}

/* ============== MIGRASI KOLOM ==============
 * Skema Supabase dibuat sekali di luar aplikasi, jadi kolom yang ditambahkan
 * belakangan disusulkan di sini — sepadan dengan tambahKolom() di db.js.
 *
 * Keberadaan kolom diperiksa dulu lewat katalog, baru ALTER kalau memang belum
 * ada. Berkas ini dimuat ulang pada tiap cold start di Vercel, dan ALTER TABLE
 * mengunci tabelnya walau tidak mengubah apa-apa — pemeriksaan SELECT tidak.
 *
 * Pemeriksaannya satu kueri untuk seluruh kolom sekaligus, bukan satu kueri per
 * kolom. Daftar di bawah ada delapan belas baris, dan dulu tiap barisnya berarti
 * satu perjalanan ke Supabase yang menahan permintaan pertama tiap kali wadah
 * Vercel baru dinyalakan — belasan kali menunggu jaringan hanya untuk memastikan
 * tidak ada yang perlu diubah.
 *
 * Kegagalannya dicatat tapi tidak menghentikan proses: kalau akun database-nya
 * memang tidak berhak mengubah skema, itu harus terbaca di log, bukan membuat
 * seluruh aplikasi gagal start. */
const KOLOM_SUSULAN = [
  ['entries', 'lokasi', "TEXT NOT NULL DEFAULT ''"],
  // Siapa membubuhkan tanda tangan susulan, dan kapan. Terpisah dari nama pada
  // formulir — nama itu milik teknisi yang mengisi. ttd_untuk: akun yang
  // DITUNJUK untuk membubuhkan, dipakai kotak masuk TTD — lihat getInboxTtd.
  ...['entries', 'dailychecks', 'monitoring', 'dstest', 'ltk', 'bapb'].flatMap((t) => [
    [t, 'ttd_oleh', "TEXT NOT NULL DEFAULT ''"],
    [t, 'ttd_pada', "TEXT NOT NULL DEFAULT ''"],
    [t, 'ttd_untuk', "TEXT NOT NULL DEFAULT ''"]
  ]),
  // Daily check menyimpan tanggalnya sebagai teks panjang ("KAMIS / 6 AGU 2026")
  // yang tidak bisa diurutkan langsung — lihat tanggal-lama.js. Kolom ini
  // menyimpan bentuk ISO-nya, khusus untuk ORDER BY riwayat.
  ['dailychecks', 'tanggal_urut', "TEXT NOT NULL DEFAULT ''"],
  // Tanda tangan tersimpan milik akun — lihat simpanTtdTersimpan. Kolomnya
  // sekarang menampung JSON larik hingga 5 slot untuk admin/pejabat; teknisi
  // tetap satu. ttd_aktif menunjuk slot yang sedang dipakai.
  ['users', 'ttd_tersimpan', "TEXT NOT NULL DEFAULT ''"],
  ['users', 'ttd_aktif', "INTEGER NOT NULL DEFAULT 0"],
  // Penanda super-admin — orthogonal terhadap peran. Peran tetap menentukan
  // pagar akses; superadmin dipakai gerbang fitur yang belum ada padanannya
  // di dunia peran biasa. Lihat catatan senama di db.js.
  ['users', 'superadmin', "INTEGER NOT NULL DEFAULT 0"],
  // BAPB: daftar nama teknisi pelaksana (JSON) — disusulkan supaya tabel yang
  // sudah dibuat tanpa kolom ini ikut mendapat kolomnya.
  ['bapb', 'petugas_nama_list', "TEXT NOT NULL DEFAULT '[]'"],
  // Isu tertutup: siapa yang menutup, dan keterangan penutupannya. Terpisah
  // dari dibuat_oleh — pelapor/penginput bisa teknisi, penutup selalu admin.
  ['issues', 'ditutup_oleh', "TEXT NOT NULL DEFAULT ''"],
  ['issues', 'keterangan_closed', "TEXT NOT NULL DEFAULT ''"]
];
try {
  const sudahAda = new Set(
    (await q(
      `SELECT table_name, column_name FROM information_schema.columns
       WHERE table_schema = current_schema() AND table_name = ANY($1::text[])`,
      [[...new Set(KOLOM_SUSULAN.map(([tabel]) => tabel))]]
    )).map((r) => `${r.table_name}.${r.column_name}`)
  );
  for (const [tabel, kolom, definisi] of KOLOM_SUSULAN) {
    if (sudahAda.has(`${tabel}.${kolom}`)) continue;
    try {
      await pool.query(`ALTER TABLE ${tabel} ADD COLUMN ${kolom} ${definisi}`);
    } catch (err) {
      console.error(`[db-pg] gagal menambah kolom ${tabel}.${kolom}:`, err?.message || err);
    }
  }
} catch (err) {
  console.error('[db-pg] gagal memeriksa kolom susulan:', err?.message || err);
}

/* ---------- Bootstrap super-admin ----------
   Dua akun yang selalu berpenanda super-admin — kalau akunnya ada. Dijalankan
   pada tiap cold start; kalau flag hilang karena impor ulang dari cadangan
   lama, ia dipulihkan sendiri. Perbandingannya case-insensitive. */
export const SUPERADMIN_TETAP = ['bagus', 'admin'];
try {
  await jalankan(
    `UPDATE users SET superadmin = 1
      WHERE lower(username) = ANY($1::text[]) AND superadmin = 0`,
    [SUPERADMIN_TETAP]
  );
} catch (err) {
  console.error('[db-pg] gagal menandai super-admin:', err?.message || err);
}

/* ---------- Migrasi role: pic → adminunit ----------
   Peran `pic` dihapus. Akun lama diubah jadi `adminunit` — peran terdekat
   yang masih satu unit. Idempoten: cold start berikutnya jadi no-op karena
   sudah tidak ada baris pic. */
try {
  const n = await jalankan("UPDATE users SET role = 'adminunit' WHERE role = 'pic'");
  if (n > 0) console.log(`[db-pg] migrasi peran: ${n} akun pic → adminunit`);
} catch (err) {
  console.error('[db-pg] gagal migrasi peran pic → adminunit:', err?.message || err);
}

// Daily check lama belum punya tanggal_urut — tafsir balik dari teks panjangnya,
// atau kalau tidak dikenali sekalipun, pakai waktu pembuatannya sebagai taksiran.
// Baris yang perlu ditambal diperbarui dalam satu perintah, bukan satu per baris:
// pengisian ini dijalankan lagi pada tiap cold start, dan pada saat pertama
// jumlah barisnya bisa ratusan.
try {
  const lama = await q("SELECT id, tanggal, dibuat_pada FROM dailychecks WHERE tanggal_urut = ''");
  const ids = [];
  const isos = [];
  for (const r of lama) {
    const iso = isoDariTanggalPanjang(r.tanggal) || String(r.dibuat_pada || '').slice(0, 10);
    if (!iso) continue;
    ids.push(r.id);
    isos.push(iso);
  }
  if (ids.length) {
    await jalankan(
      `UPDATE dailychecks SET tanggal_urut = tambalan.iso
         FROM (SELECT unnest($1::text[]) AS id, unnest($2::text[]) AS iso) AS tambalan
        WHERE dailychecks.id = tambalan.id`,
      [ids, isos]
    );
  }
} catch (err) {
  console.error('[db-pg] gagal mengisi tanggal_urut catatan lama:', err?.message || err);
}

/* ============== UTILITAS ============== */

export const newId = () => crypto.randomUUID();
export const nowIso = () => new Date().toISOString();

/** Tanggal hari ini menurut UTC, format YYYY-MM-DD. Sama seperti versi SQLite. */
export const today = () => nowIso().slice(0, 10);

const parseJson = (s, fallback) => { try { return JSON.parse(s); } catch { return fallback; } };

/* ============== PENYIMPANAN BERKAS — SUPABASE STORAGE ==============
 * Dipanggil lewat REST API-nya langsung, jadi tidak perlu menambah pustaka
 * klien Supabase. Path yang disimpan di database tetap berbentuk
 * "/uploads/<nama>" supaya seluruh frontend dan modul cetak tidak berubah. */

function pastikanStorageSiap() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error('SUPABASE_URL dan SUPABASE_SERVICE_KEY belum diisi — berkas tidak bisa disimpan.');
  }
}

const kepalaStorage = () => ({
  Authorization: `Bearer ${SERVICE_KEY}`,
  apikey: SERVICE_KEY
});

const namaDariPath = (webPath) => String(webPath || '').replace(/^\/uploads\//, '');

export async function unggahBerkas(namaDisk, buf, mime) {
  pastikanStorageSiap();
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${encodeURIComponent(namaDisk)}`, {
    method: 'POST',
    headers: { ...kepalaStorage(), 'Content-Type': mime || 'application/octet-stream', 'x-upsert': 'true' },
    body: buf
  });
  if (!res.ok) {
    throw new Error(`Gagal mengunggah berkas ke storage (${res.status}): ${await res.text()}`);
  }
  return '/uploads/' + namaDisk;
}

/** Ambil isi berkas. Dipakai server untuk menyajikan /uploads/<nama> di balik login. */
export async function ambilBerkas(webPath) {
  pastikanStorageSiap();
  const nama = namaDariPath(webPath);
  if (!nama) return null;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${encodeURIComponent(nama)}`, {
    headers: kepalaStorage()
  });
  if (!res.ok) return null;
  return {
    buf: Buffer.from(await res.arrayBuffer()),
    mime: res.headers.get('content-type') || 'application/octet-stream'
  };
}

async function hapusBerkas(webPath) {
  const nama = namaDariPath(webPath);
  if (!nama || !SUPABASE_URL || !SERVICE_KEY) return;
  try {
    await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${encodeURIComponent(nama)}`, {
      method: 'DELETE', headers: kepalaStorage()
    });
  } catch { /* berkasnya mungkin memang sudah tidak ada — abaikan */ }
}

/**
 * Simpan tanda tangan (dataURL kanvas) sebagai PNG. Kalau nilainya sudah berupa
 * path (data lama hasil impor), kembalikan apa adanya.
 */
export async function saveSignature(dataUrl, prefix) {
  if (!dataUrl) return '';
  if (!String(dataUrl).startsWith('data:')) return String(dataUrl);
  const idx = dataUrl.indexOf('base64,');
  if (idx === -1) return '';
  const buf = Buffer.from(dataUrl.slice(idx + 7), 'base64');
  const nama = `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.png`;
  return unggahBerkas(nama, buf, 'image/png');
}

/* ---------- Tanda tangan tersimpan milik akun ----------
 * Cerminan dari getTtdTersimpan/simpanTtdTersimpan/hapusTtdTersimpan di db.js,
 * termasuk aturannya: berkas milik akun ini tidak pernah dipasang langsung ke
 * catatan — yang masuk ke catatan selalu salinan barunya, supaya menghapus satu
 * catatan tidak melenyapkan tanda tangan orang itu dari catatan yang lain. */

/* ---------- Slot TTD tersimpan: cermin dari db.js ---------- */
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

export async function getTtdTersimpan(username) {
  const u = await getUserByUsername(username);
  if (!u) return { slots: [{ path: '', dibuatPada: '' }], aktif: 0, maks: 1 };
  return bacaTtdTersimpanUser(u);
}

export async function simpanTtdTersimpan(username, dataUrl, slotIdx = 0) {
  const u = await getUserByUsername(username);
  if (!u) throw new Error('Akun tidak ditemukan.');
  const maks = batasSlotTtd(u.role);
  const idx = Math.max(0, Math.min(maks - 1, Number(slotIdx) | 0));
  const slots = isiHinggaMaks(parseSlotsTtd(u.ttd_tersimpan), maks);
  const baru = await saveSignature(dataUrl, 'ttd_akun');
  if (!baru) throw new Error('Tanda tangannya masih kosong.');
  const lama = slots[idx].path;
  slots[idx] = { path: baru, dibuatPada: new Date().toISOString() };
  await jalankan('UPDATE users SET ttd_tersimpan = $1 WHERE id = $2', [serialisasiSlotsTtd(slots), u.id]);
  if (lama) await hapusBerkas(lama);
  return getTtdTersimpan(username);
}

export async function hapusTtdTersimpan(username, slotIdx = 0) {
  const u = await getUserByUsername(username);
  if (!u) return getTtdTersimpan(username);
  const maks = batasSlotTtd(u.role);
  const idx = Math.max(0, Math.min(maks - 1, Number(slotIdx) | 0));
  const slots = isiHinggaMaks(parseSlotsTtd(u.ttd_tersimpan), maks);
  const lama = slots[idx].path;
  slots[idx] = { path: '', dibuatPada: '' };
  await jalankan('UPDATE users SET ttd_tersimpan = $1 WHERE id = $2', [serialisasiSlotsTtd(slots), u.id]);
  if (lama) await hapusBerkas(lama);
  return getTtdTersimpan(username);
}

export async function pilihTtdTersimpanAktif(username, slotIdx) {
  const u = await getUserByUsername(username);
  if (!u) throw new Error('Akun tidak ditemukan.');
  const maks = batasSlotTtd(u.role);
  const idx = Math.max(0, Math.min(maks - 1, Number(slotIdx) | 0));
  await jalankan('UPDATE users SET ttd_aktif = $1 WHERE id = $2', [idx, u.id]);
  return getTtdTersimpan(username);
}

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

export const getUserByUsername = (username) =>
  q1('SELECT * FROM users WHERE lower(username) = lower($1)', [String(username).trim()]);

export async function createUser({ username, password, nama = '', role = 'teknisi', unit }) {
  const { hash, salt } = hashPassword(password);
  const dibuat = await q1(
    `INSERT INTO users (username, nama, role, pass_hash, pass_salt, aktif, dibuat_pada)
     VALUES ($1, $2, $3, $4, $5, true, $6) RETURNING *`,
    [String(username).trim(), nama, role, hash, salt, nowIso()]
  );
  // Akun tanpa unit tidak bisa membuka apa pun — sama seperti versi SQLite,
  // tidak ada jalur yang boleh menghasilkan akun buntu.
  // Larik kosong berarti memang belum diberi unit — keadaan akun hasil
  // pendaftaran yang masih menunggu konfirmasi.
  await setUnitUser(dibuat.id, Array.isArray(unit) ? unit : [KODE_UNIT[0]]);
  lupakanNamaPengguna();
  return dibuat;
}

export async function setPassword(username, password) {
  const { hash, salt } = hashPassword(password);
  const n = await jalankan(
    'UPDATE users SET pass_hash = $1, pass_salt = $2 WHERE lower(username) = lower($3)',
    [hash, salt, String(username).trim()]
  );
  return n > 0;
}

export async function setAktif(username, aktif) {
  const n = await jalankan(
    'UPDATE users SET aktif = $1 WHERE lower(username) = lower($2)',
    [!!aktif, String(username).trim()]
  );
  if (!aktif) {
    const u = await getUserByUsername(username);
    if (u) await jalankan('DELETE FROM sessions WHERE user_id = $1', [u.id]);
  }
  return n > 0;
}

/**
 * Hapus akun untuk selamanya — sama aturannya dengan versi SQLite: hanya akun
 * yang sudah nonaktif, dan catatan yang pernah diinputnya tetap tinggal karena
 * dibuat_oleh menyimpan username sebagai teks biasa.
 */
export async function hapusUser(username, opts = {}) {
  const u = await getUserByUsername(username);
  if (!u) return false;
  // Super-admin boleh langsung hapus akun aktif — satu langkah, tanpa
  // nonaktifkan-dulu. Untuk peran lain, jalur dua-langkah tetap berlaku.
  if (u.aktif && !opts.paksa) {
    throw new Error('Akun itu masih aktif. Nonaktifkan dulu sebelum dihapus.');
  }
  await jalankan('DELETE FROM sessions WHERE user_id = $1', [u.id]);
  await jalankan('DELETE FROM user_unit WHERE user_id = $1', [u.id]);
  // Tanda tangan tersimpannya ikut hilang; yang sudah dibubuhkan pada catatan
  // tidak tersentuh karena itu salinan tersendiri.
  for (const s of parseSlotsTtd(u.ttd_tersimpan)) {
    if (s.path) await hapusBerkas(s.path);
  }
  const terhapus = (await jalankan('DELETE FROM users WHERE id = $1', [u.id])) > 0;
  if (terhapus) lupakanNamaPengguna();
  return terhapus;
}

/**
 * admin     — kendali penuh, termasuk menghapus dan mengelola akun
 * pejabat   — melihat seluruh unit; satu-satunya perubahan yang boleh dilakukannya
 *             adalah membubuhkan tanda tangannya pada petak yang masih kosong
 * adminunit — administrator yang wilayahnya satu unit: mengisi, mengubah,
 *             menghapus, dan membaca log aktivitas — semuanya hanya di unitnya
 * teknisi   — hanya menambah, dan hanya pada unit yang diberikan kepadanya
 *
 * Daftar ini WAJIB sama persis dengan yang di db.js. SQLite dipakai di laptop,
 * Postgres di produksi — selisih peran antara keduanya hanya rusak setelah
 * dideploy: setUserRole menolak dengan "Role tidak dikenal.", sementara
 * Kelola Akun di dashboard mengirim peran lebih dulu lalu unit; lemparan itu
 * menghentikan antreannya sebelum unitnya sempat tersimpan. Yang terlihat
 * orang: unit yang dipilih tidak pernah berubah dan akunnya tetap mendarat di
 * unit lamanya.
 *
 * pic-dinas / pic-sparepart / pic-isr — PIC (penanggung-jawab) satu jenis
 * dokumen LINTAS seluruh unit. Dipakai Dashboard Fasilitas Teknik: di sana
 * mereka hanya membuka satu database (jadwal dinas / sparepart / ISR) untuk
 * semua unit, boleh menyunting dan mencetak. Di E-Logbook mereka SEMUA_UNIT
 * (membaca seluruh unit) tetapi bukan pengisi — dashboard yang menegakkan
 * batas "satu modul saja". WAJIB sama persis dengan PIC_ROLE di db.js.
 *
 * Peran `pic` (lama, tanpa akhiran) sudah dihapus. Akun lama dengan role='pic'
 * dimigrasikan otomatis jadi `adminunit` di blok migrasi cold start di bawah.
 */
export const PIC_ROLE = ['pic-dinas', 'pic-sparepart', 'pic-isr'];
export const ROLE_VALID = ['admin', 'pejabat', 'adminunit', 'teknisi', ...PIC_ROLE];

/** Peran yang boleh membuka seluruh unit tanpa perlu diberi satu per satu.
    adminunit sengaja TIDAK di sini: seluruh gunanya justru terletak pada
    wilayahnya yang satu unit. PIC ikut — jangkauannya memang seluruh unit. */
export const SEMUA_UNIT = ['admin', 'pejabat', ...PIC_ROLE];

export async function setRole(username, role) {
  if (!ROLE_VALID.includes(role)) return false;
  const n = await jalankan(
    'UPDATE users SET role = $1 WHERE lower(username) = lower($2)',
    [role, String(username).trim()]
  );
  return n > 0;
}

export async function setNama(username, nama) {
  const n = await jalankan(
    'UPDATE users SET nama = $1 WHERE lower(username) = lower($2)',
    [String(nama).trim(), String(username).trim()]
  );
  if (n > 0) lupakanNamaPengguna();
  return n > 0;
}

/**
 * Ganti username akun. Seluruh kolom teks yang menyimpan username lama ikut
 * berpindah — dibuat_oleh/ttd_oleh/ttd_untuk/ditutup_oleh — dalam satu
 * transaksi supaya tidak pernah ada keadaan setengah.
 *
 * Sesi hidup: sessions merujuk user_id, bukan username. Hak petugas di
 * dashboard (dinas-petugas.json di server dashboard, TERPISAH dari database
 * ini) tidak ikut berubah — admin perlu menetapkan ulang setelah rename.
 */
export async function setUsername(oldUsername, newUsername) {
  const lama = String(oldUsername || '').trim();
  const baru = String(newUsername || '').trim().toLowerCase();
  if (lama === baru) return false;
  if (!/^[a-z0-9._-]{3,32}$/.test(baru)) {
    throw new Error('Username baru 3–32 karakter: huruf kecil, angka, titik, garis bawah, atau strip.');
  }
  const target = await getUserByUsername(lama);
  if (!target) throw new Error(`Pengguna "${lama}" tidak ditemukan.`);
  const bentrok = await getUserByUsername(baru);
  if (bentrok && String(bentrok.id) !== String(target.id)) {
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
  const klien = await pool.connect();
  try {
    await klien.query('BEGIN');
    await klien.query('UPDATE users SET username = $1 WHERE id = $2', [baru, target.id]);
    for (const [tabel, kolom] of TABEL_TEKS_USERNAME) {
      // Tabel BAPB dibuat lewat susulan; kalau belum ada di deployment ini,
      // lewati saja tanpa membatalkan seluruh transaksi.
      const cek = await klien.query(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema = current_schema() AND table_name = $1
            AND column_name = ANY($2::text[])`,
        [tabel, kolom]
      );
      const kolomAda = new Set(cek.rows.map((r) => r.column_name));
      for (const k of kolom) {
        if (!kolomAda.has(k)) continue;
        await klien.query(`UPDATE ${tabel} SET ${k} = $1 WHERE ${k} = $2`, [baru, lama]);
      }
    }
    await klien.query('COMMIT');
  } catch (err) {
    await klien.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    klien.release();
  }
  lupakanNamaPengguna();
  return true;
}

export const jumlahAdminAktif = async () =>
  Number((await q1("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND aktif = true")).n);

export const countUsers = async () =>
  Number((await q1('SELECT COUNT(*) AS n FROM users')).n);

export async function listUsers() {
  const [rows, unit] = await Promise.all([
    q('SELECT id, username, nama, role, aktif, superadmin, dibuat_pada FROM users ORDER BY username'),
    q('SELECT user_id, unit FROM user_unit')
  ]);
  const peta = new Map();
  for (const r of unit) {
    if (!peta.has(String(r.user_id))) peta.set(String(r.user_id), new Set());
    peta.get(String(r.user_id)).add(r.unit);
  }
  return rows.map((u) => ({
    ...u,
    aktif: u.aktif ? 1 : 0,   // frontend lama membaca 0/1, bukan boolean
    // Baris user_unit apa adanya, untuk semua peran. Untuk admin/pejabat baris
    // itu bukan pagar akses melainkan tanda "muncul sebagai saran teknisi di
    // unit ini" (dibaca listTeknisiUnit). Lihat catatan senama di db.js.
    unit: KODE_UNIT.filter((k) => (peta.get(String(u.id)) || new Set()).has(k))
  }));
}

const SESSION_DAYS = Number(process.env.ELOGBOOK_SESSION_DAYS || 30);

export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const exp = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  await jalankan(
    'INSERT INTO sessions (token, user_id, dibuat_pada, kadaluarsa) VALUES ($1, $2, $3, $4)',
    [token, userId, nowIso(), exp]
  );
  return token;
}

export async function getSessionUser(token) {
  if (!token) return null;
  const row = await q1(
    `SELECT u.id, u.username, u.nama, u.role, u.aktif, u.superadmin, s.kadaluarsa
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = $1`, [token]
  );
  if (!row) return null;
  if (row.kadaluarsa < nowIso()) { await deleteSession(token); return null; }
  if (!row.aktif) return null;
  return {
    id: row.id, username: row.username, nama: row.nama, role: row.role,
    superadmin: !!row.superadmin
  };
}

/** Penanda super-admin, berlaku terpisah dari peran. Aman dipanggil dengan null. */
export const isSuperadmin = (u) => !!(u && (u.superadmin === true || u.superadmin === 1));

export const deleteSession = (token) =>
  jalankan('DELETE FROM sessions WHERE token = $1', [token]);

export const purgeExpiredSessions = () =>
  jalankan('DELETE FROM sessions WHERE kadaluarsa < $1', [nowIso()]);

/* ============== UNIT LOGBOOK ============== */

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

export async function unitUntukUser(user) {
  if (!user) return [];
  if (SEMUA_UNIT.includes(user.role)) return KODE_UNIT.slice();
  const rows = await q('SELECT unit FROM user_unit WHERE user_id = $1', [user.id]);
  const punya = new Set(rows.map((r) => r.unit));
  // Urutkan mengikuti urutan baku UNIT, bukan urutan baris database.
  return KODE_UNIT.filter((k) => punya.has(k));
}

export async function setUnitUser(userId, daftar) {
  const bersih = [...new Set((Array.isArray(daftar) ? daftar : []).filter(unitSah))];
  await jalankan('DELETE FROM user_unit WHERE user_id = $1', [userId]);
  for (const u of bersih) {
    await jalankan('INSERT INTO user_unit (user_id, unit) VALUES ($1, $2)', [userId, u]);
  }
  return bersih;
}

/* ============== SIAPA YANG MENGINPUT ============== */

/**
 * Peta username → nama lengkap, dipakai mengganti "dibuat_oleh" menjadi nama
 * yang terbaca. Tujuh daftar yang dikirim getAllData semuanya membutuhkannya,
 * dan dulu masing-masing mengambil sendiri tabel users yang sama persis —
 * tujuh perjalanan ke Supabase untuk satu jawaban yang tidak berubah.
 *
 * Karena itu hasilnya disimpan sebentar. Umurnya sengaja pendek: nama pengguna
 * memang jarang berubah, tapi kalau berubah, perubahannya harus terlihat tanpa
 * perlu menunggu wadahnya mati. Pengambilan yang sedang berjalan juga dibagi
 * pakai, supaya tujuh pemanggilan berbarengan tidak berubah jadi tujuh kueri.
 * Fungsi yang mengubah nama akun memanggil lupakanNamaPengguna() sendiri, jadi
 * perubahan dari server ini terlihat seketika.
 */
const NAMA_TTL_MS = Number(process.env.ELOGBOOK_CACHE_NAMA_MS || 15_000);
let namaTersimpan = null;   // { pada, peta }
let namaSedangDiambil = null;

export function lupakanNamaPengguna() {
  namaTersimpan = null;
}

async function petaNamaPengguna() {
  if (namaTersimpan && Date.now() - namaTersimpan.pada < NAMA_TTL_MS) return namaTersimpan.peta;
  if (namaSedangDiambil) return namaSedangDiambil;

  namaSedangDiambil = (async () => {
    try {
      const map = new Map();
      for (const u of await q('SELECT username, nama FROM users')) {
        map.set(String(u.username).toLowerCase(), u.nama || u.username);
      }
      namaTersimpan = { pada: Date.now(), peta: map };
      return map;
    } finally {
      namaSedangDiambil = null;
    }
  })();
  return namaSedangDiambil;
}

const namaTampil = (map, username) =>
  username ? (map.get(String(username).toLowerCase()) || username) : '';

/* ============== LAMPIRAN ============== */

const LAMPIRAN_EKSTENSI = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf'
};
export const LAMPIRAN_MAKS_BYTE = 8 * 1024 * 1024;
export const LAMPIRAN_MAKS_JUMLAH = 6;

function bersihkanNamaBerkas(nama) {
  return String(nama || '')
    .replace(/[\\/]/g, '_')
    .replace(/[\x00-\x1f]/g, '')
    .trim()
    .slice(0, 120);
}

const rowToLampiran = (l) => ({
  ID: l.id, Nama: l.nama, Path: l.path, Mime: l.mime, Ukuran: Number(l.ukuran)
});

/** Periksa lalu unggah satu berkas. Aturannya sama persis dengan versi SQLite. */
async function tulisBerkasLampiran(f) {
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
  const path = await unggahBerkas(namaDisk, buf, mime);
  return {
    id: newId(),
    nama: bersihkanNamaBerkas(f.nama) || namaDisk,
    path,
    mime,
    ukuran: buf.length
  };
}

/** Ambil lampiran untuk sekumpulan induk sekaligus (hindari kueri per baris). */
async function lampiranUntuk(tabel, kolomInduk, ids) {
  const hasil = new Map();
  if (!ids.length) return hasil;
  const rows = await q(
    `SELECT * FROM ${tabel} WHERE ${kolomInduk} = ANY($1::text[]) ORDER BY dibuat_pada`, [ids]
  );
  for (const l of rows) {
    const kunci = l[kolomInduk];
    if (!hasil.has(kunci)) hasil.set(kunci, []);
    hasil.get(kunci).push(rowToLampiran(l));
  }
  return hasil;
}

export async function simpanLampiran(entryId, daftar) {
  if (!Array.isArray(daftar) || daftar.length === 0) return [];
  if (daftar.length > LAMPIRAN_MAKS_JUMLAH) {
    throw new Error(`Maksimal ${LAMPIRAN_MAKS_JUMLAH} lampiran per catatan.`);
  }
  const hasil = [];
  for (const f of daftar) {
    const row = await tulisBerkasLampiran(f);
    if (!row) continue;
    await jalankan(
      `INSERT INTO lampiran (id, entry_id, nama, path, mime, ukuran, dibuat_pada)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [row.id, entryId, row.nama, row.path, row.mime, row.ukuran, nowIso()]
    );
    hasil.push(rowToLampiran(row));
  }
  return hasil;
}

async function hapusBerkasLampiran(tabel, kolomInduk, indukId) {
  const rows = await q(`SELECT path FROM ${tabel} WHERE ${kolomInduk} = $1`, [indukId]);
  for (const l of rows) await hapusBerkas(l.path);
}

/**
 * Tambah dan buang lampiran catatan tersimpan — cerminan dari versi SQLite.
 * Berkas baru ditulis lebih dulu, baru yang lama dibuang.
 */
async function suntingLampiranEntry(entryId, tambah, buang) {
  const daftarTambah = Array.isArray(tambah) ? tambah : [];
  const idBuang = (Array.isArray(buang) ? buang : []).map(String);
  if (daftarTambah.length === 0 && idBuang.length === 0) return;

  const milik = await q('SELECT id, path FROM lampiran WHERE entry_id = $1', [entryId]);
  const dibuang = milik.filter((l) => idBuang.includes(String(l.id)));
  const sisa = milik.length - dibuang.length;
  if (sisa + daftarTambah.length > LAMPIRAN_MAKS_JUMLAH) {
    throw new Error(`Maksimal ${LAMPIRAN_MAKS_JUMLAH} lampiran per catatan. Sekarang sudah ada ${sisa}.`);
  }

  await simpanLampiran(entryId, daftarTambah);

  for (const l of dibuang) {
    await jalankan('DELETE FROM lampiran WHERE id = $1 AND entry_id = $2', [l.id, entryId]);
    await hapusBerkas(l.path);
  }
}

/* ---------- Lampiran isu (fase open / closed) ---------- */

export const FASE_ISU = ['open', 'closed'];

async function lampiranIsuUntuk(issueIds) {
  const hasil = new Map();
  if (!issueIds.length) return hasil;
  const rows = await q(
    'SELECT * FROM lampiran_isu WHERE issue_id = ANY($1::text[]) ORDER BY dibuat_pada', [issueIds]
  );
  for (const l of rows) {
    if (!hasil.has(l.issue_id)) hasil.set(l.issue_id, { open: [], closed: [] });
    const kotak = hasil.get(l.issue_id);
    (l.fase === 'closed' ? kotak.closed : kotak.open).push(rowToLampiran(l));
  }
  return hasil;
}

export async function tambahLampiranIsu(issueId, fase, daftar) {
  if (!FASE_ISU.includes(fase)) throw new Error('Fase lampiran tidak dikenal.');
  if (!Array.isArray(daftar) || daftar.length === 0) return [];

  const sudahAda = Number((await q1(
    'SELECT COUNT(*) AS n FROM lampiran_isu WHERE issue_id = $1 AND fase = $2', [issueId, fase]
  )).n);
  if (sudahAda + daftar.length > LAMPIRAN_MAKS_JUMLAH) {
    throw new Error(`Maksimal ${LAMPIRAN_MAKS_JUMLAH} lampiran untuk fase ${fase}. Sekarang sudah ada ${sudahAda}.`);
  }

  const hasil = [];
  for (const f of daftar) {
    const row = await tulisBerkasLampiran(f);
    if (!row) continue;
    await jalankan(
      `INSERT INTO lampiran_isu (id, issue_id, fase, nama, path, mime, ukuran, dibuat_pada)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [row.id, issueId, fase, row.nama, row.path, row.mime, row.ukuran, nowIso()]
    );
    hasil.push(rowToLampiran(row));
  }
  return hasil;
}

export async function hapusLampiranIsu(lampiranId) {
  const r = await q1('SELECT path FROM lampiran_isu WHERE id = $1', [lampiranId]);
  if (!r) return false;
  await jalankan('DELETE FROM lampiran_isu WHERE id = $1', [lampiranId]);
  await hapusBerkas(r.path);
  return true;
}

/* ---------- Lampiran LTK ---------- */

export async function tambahLampiranLtk(ltkId, daftar) {
  if (!Array.isArray(daftar) || daftar.length === 0) return [];
  const sudahAda = Number((await q1(
    'SELECT COUNT(*) AS n FROM lampiran_ltk WHERE ltk_id = $1', [ltkId]
  )).n);
  if (sudahAda + daftar.length > LAMPIRAN_MAKS_JUMLAH) {
    throw new Error(`Maksimal ${LAMPIRAN_MAKS_JUMLAH} lampiran per LTK. Sekarang sudah ada ${sudahAda}.`);
  }
  const hasil = [];
  for (const f of daftar) {
    const row = await tulisBerkasLampiran(f);
    if (!row) continue;
    await jalankan(
      `INSERT INTO lampiran_ltk (id, ltk_id, nama, path, mime, ukuran, dibuat_pada)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [row.id, ltkId, row.nama, row.path, row.mime, row.ukuran, nowIso()]
    );
    hasil.push(rowToLampiran(row));
  }
  return hasil;
}

export async function hapusLampiranLtk(lampiranId) {
  const r = await q1('SELECT path FROM lampiran_ltk WHERE id = $1', [lampiranId]);
  if (!r) return false;
  await jalankan('DELETE FROM lampiran_ltk WHERE id = $1', [lampiranId]);
  await hapusBerkas(r.path);
  return true;
}

/* ============== LOGBOOK ============== */

/** Gedung tempat peralatannya berada — sama daftarnya dengan versi SQLite. */
export const LOKASI = ['JATSC', 'New JATSC'];
export const lokasiSah = (l) => LOKASI.includes(l);

const rowToEntry = (r, extra = {}) => ({
  ID: r.id, Tanggal: r.tanggal, Jam: r.jam, Dinas: r.dinas, Uraian: r.uraian,
  Lokasi: r.lokasi || '',
  JamSelesai: r.jam_selesai || '', Frek: r.frek || '', Unit: r.unit || 'radtel',
  TeknisiNama: r.teknisi_nama, TeknisiTTD: r.teknisi_ttd,
  PJNama: r.pj_nama, PJTTD: r.pj_ttd,
  TeknisiNamaListJSON: parseJson(r.teknisi_nama_list, []),
  DiinputOleh: extra.diinputOleh ?? (r.dibuat_oleh || ''),
  // Waktu sebenarnya baris ini masuk ke server — tanggal dan jam di atas diketik
  // sendiri oleh teknisi, jadi hanya angka ini yang bisa dipakai administrator
  // memastikan sebuah catatan benar-benar dibuat pada jam yang tertulis.
  DibuatPada: r.dibuat_pada || '',
  DibuatOlehUsername: r.dibuat_oleh || '',
  TtdOleh: extra.ttdOleh ?? (r.ttd_oleh || ''), TtdPada: r.ttd_pada || '', TtdUntuk: r.ttd_untuk || '',
  Lampiran: extra.lampiran || []
});

export async function listEntries(unit = 'radtel', limit = 200) {
  const rows = await q(
    `SELECT * FROM entries WHERE unit = $1
     ORDER BY tanggal DESC, jam DESC, dibuat_pada DESC LIMIT $2`, [unit, limit]
  );
  // Peta nama dan daftar lampiran tidak saling bergantung — diambil berbarengan.
  const [nama, lamp] = await Promise.all([
    petaNamaPengguna(),
    lampiranUntuk('lampiran', 'entry_id', rows.map((r) => r.id))
  ]);
  return rows.map((r) => rowToEntry(r, {
    diinputOleh: namaTampil(nama, r.dibuat_oleh),
    ttdOleh: namaTampil(nama, r.ttd_oleh),
    lampiran: lamp.get(r.id) || []
  }));
}

export async function insertEntry(entry, olehUsername = '', olehNama = '') {
  const id = newId();
  const namaList = Array.isArray(entry.teknisiNamaList) ? entry.teknisiNamaList : [];
  const row = {
    id,
    // Diisi manual: baris ini tidak dibaca ulang dari database sebelum
    // dikembalikan ke klien, jadi DibuatOlehUsername akan kosong kalau
    // dibiarkan — tombol sunting tidak langsung muncul untuk catatan baru.
    dibuat_oleh: olehUsername,
    tanggal: entry.tanggal || '',
    jam: entry.jam || '',
    jam_selesai: entry.jamSelesai || '',
    frek: entry.frek || '',
    unit: unitSah(entry.unit) ? entry.unit : 'radtel',
    dinas: entry.dinas || '',
    // Lokasi tak dikenal disimpan kosong — kolom ini dipakai menyaring cetakan.
    lokasi: lokasiSah(entry.lokasi) ? entry.lokasi : '',
    uraian: entry.uraian || '',
    teknisi_nama: entry.teknisiNama || '',
    teknisi_ttd: await saveSignature(entry.teknisiTtd, 'logbook_teknisi'),
    pj_nama: entry.pjNama || '',
    pj_ttd: await saveSignature(entry.pjTtd, 'logbook_pj'),
    ttd_untuk: entry.ttdUntuk || '',
    teknisi_nama_list: JSON.stringify(namaList),
    dibuat_pada: nowIso()
  };
  await jalankan(
    `INSERT INTO entries
      (id, tanggal, jam, jam_selesai, frek, unit, dinas, lokasi, uraian, teknisi_nama, teknisi_ttd,
       pj_nama, pj_ttd, ttd_untuk, teknisi_nama_list, dibuat_pada, dibuat_oleh)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
    [row.id, row.tanggal, row.jam, row.jam_selesai, row.frek, row.unit, row.dinas, row.lokasi,
     row.uraian, row.teknisi_nama, row.teknisi_ttd, row.pj_nama, row.pj_ttd, row.ttd_untuk, row.teknisi_nama_list,
     row.dibuat_pada, olehUsername]
  );

  const lampiran = await simpanLampiran(id, entry.lampiran);
  return rowToEntry(row, { diinputOleh: olehNama || olehUsername, lampiran });
}

export async function removeEntry(id) {
  const r = await q1('SELECT teknisi_ttd, pj_ttd FROM entries WHERE id = $1', [id]);
  await hapusBerkasLampiran('lampiran', 'entry_id', id);
  await jalankan('DELETE FROM entries WHERE id = $1', [id]);
  if (r) { await hapusBerkas(r.teknisi_ttd); await hapusBerkas(r.pj_ttd); }
  return true;
}

/**
 * Sunting catatan logbook yang sudah tersimpan — cerminan dari updateEntry
 * di db.js. Sengaja TIDAK menyentuh nama teknisi; lampiran boleh ditambah dan
 * dibuang, dan TTD teknisi yang terlupa boleh dibubuhkan susulan — keduanya
 * selama catatannya masih boleh disunting. Aturan TTD-nya diterangkan panjang
 * di db.js: yang sudah terisi tidak pernah ditimpa, dan yang boleh membubuhkan
 * hanya pembuat catatannya sendiri.
 */
/** Cerminan dari periksaTtdSusulan di db.js — alasannya diterangkan di sana. */
function periksaTtdSusulan(row, ttdBaru, actor = {}) {
  if (!ttdBaru) return '';
  if (row.teknisi_ttd) {
    throw new Error('Catatan ini sudah bertanda tangan teknisi — yang sudah dibubuhkan tidak diganti dari sini.');
  }
  if (!row.dibuat_oleh || row.dibuat_oleh !== actor.username) {
    throw new Error('Hanya pembuat catatan ini yang bisa membubuhkan TTD teknisinya.');
  }
  const teks = String(ttdBaru);
  if (!teks.startsWith('data:image/')) throw new Error('Tanda tangannya tidak berbentuk gambar.');
  return teks;
}

export async function updateEntry(id, patch = {}, actor = {}) {
  const row = await q1('SELECT * FROM entries WHERE id = $1', [String(id)]);
  if (!row) throw new Error('Catatan tidak ditemukan — mungkin sudah dihapus.');
  if (row.pj_ttd) throw new Error('Catatan ini sudah ditandatangani penanggung jawab — tidak bisa disunting lagi.');
  if (!actor.admin && row.dibuat_oleh && row.dibuat_oleh !== actor.username) {
    throw new Error('Hanya pembuat catatan ini yang bisa menyuntingnya.');
  }

  const uraian = patch.uraian !== undefined ? String(patch.uraian || '').trim() : row.uraian;
  if (!uraian) throw new Error('Uraian pekerjaan tidak boleh kosong.');

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

  // Lampiran lebih dulu — alasannya sama dengan versi SQLite.
  await suntingLampiranEntry(String(id), patch.lampiranBaru, patch.lampiranHapus);

  next.teknisi_ttd = bubuhTtd ? await saveSignature(bubuhTtd, 'logbook_teknisi') : row.teknisi_ttd;

  await jalankan(
    `UPDATE entries SET tanggal = $1, jam = $2, jam_selesai = $3, frek = $4, dinas = $5, lokasi = $6, uraian = $7,
                        teknisi_ttd = $8
     WHERE id = $9`,
    [next.tanggal, next.jam, next.jam_selesai, next.frek, next.dinas, next.lokasi, next.uraian,
     next.teknisi_ttd, String(id)]
  );

  const nama = await petaNamaPengguna();
  const lampiran = (await lampiranUntuk('lampiran', 'entry_id', [String(id)])).get(String(id)) || [];
  return rowToEntry({ ...row, ...next }, {
    diinputOleh: namaTampil(nama, row.dibuat_oleh),
    ttdOleh: namaTampil(nama, row.ttd_oleh),
    lampiran
  });
}

/* ============== DAILY CHECK ============== */

/** Lokasi form yang dipakai — 'jatsc' (Frequentis 3020X) atau 'new-jatsc'
    (Garex 300). Marker ini ditanam ke state_json waktu simpan (lihat
    saveDailyCheck di 14-daily-check-umum.js). Dashboard membaca kolom Lokasi
    di sini untuk memisah "Daily Check JATSC" dari "Daily Check New JATSC"
    pada pilihan sumber Kegiatan Berkala. */
function lokasiDariStateJson(stateJson) {
  const s = parseJson(stateJson, {});
  const v = String(s.__lokasi || '').toLowerCase();
  return (v === 'jatsc' || v === 'new-jatsc') ? v : '';
}

/** Lembar mana di dalam satu unit yang dipakai baris ini — kunci sub-lembar yang
    ditanam form di state: __pgmForm (Pengamatan), __fgkForm (Gedung & Keamanan),
    __lkForm (Listrik & Mekanik), __sistem (AMHS). Kosong untuk unit yang lembarnya
    tunggal. Dibaca dashboard Avenger untuk menyaring bukti kegiatan berkala per
    lembar, sama perannya dengan kolom Lokasi bagi Radtel. */
function formDariStateJson(stateJson) {
  const s = parseJson(stateJson, {});
  const v = s.__pgmForm || s.__fgkForm || s.__lkForm || s.__sistem || '';
  return String(v).toLowerCase().slice(0, 40);
}

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
  Lokasi: extra.lokasi ?? lokasiDariStateJson(r.state_json),
  Form: formDariStateJson(r.state_json)
});

export async function listDailyChecks(unit = 'radtel', limit = 200) {
  const rows = await q(
    `SELECT id, tanggal, tanggal_urut, dinas, suhu, remark, teknisi_nama, teknisi_ttd,
            manager_nama, manager_ttd, fails_json, warns_json, teknisi_nama_list, dibuat_oleh,
            dibuat_pada, ttd_oleh, ttd_pada, ttd_untuk, state_json
     FROM dailychecks WHERE unit = $1
     ORDER BY tanggal_urut DESC, dibuat_pada DESC LIMIT $2`, [unit, limit]
  );
  const nama = await petaNamaPengguna();
  return rows.map((r) => rowToDcRingkas(r, {
    diinputOleh: namaTampil(nama, r.dibuat_oleh),
    ttdOleh: namaTampil(nama, r.ttd_oleh)
  }));
}

export async function getDailyCheckDetailById(id) {
  const r = await q1('SELECT state_json, teknisi_ttd, manager_ttd FROM dailychecks WHERE id = $1', [id]);
  if (!r) return null;
  return { state: parseJson(r.state_json, {}), teknisiTtd: r.teknisi_ttd, managerTtd: r.manager_ttd };
}

export async function insertDailyCheck(rec, olehUsername = '', olehNama = '') {
  const id = newId();
  const namaList = Array.isArray(rec.teknisiNamaList) ? rec.teknisiNamaList : [];
  const row = {
    id,
    dibuat_oleh: olehUsername,
    unit: unitSah(rec.unit) ? rec.unit : 'radtel',
    tanggal: rec.tanggal || '',
    tanggal_urut: String(rec.tanggalIso || '').trim() || isoDariTanggalPanjang(rec.tanggal) || today(),
    dinas: rec.dinas || '',
    suhu: rec.suhu || '',
    remark: rec.remark || '',
    teknisi_nama: rec.teknisiNama || '',
    teknisi_ttd: await saveSignature(rec.teknisiTtd, 'dailycheck_teknisi'),
    manager_nama: rec.managerNama || '',
    manager_ttd: await saveSignature(rec.managerTtd, 'dailycheck_manager'),
    ttd_untuk: rec.ttdUntuk || '',
    state_json: JSON.stringify(rec.state || {}),
    fails_json: JSON.stringify(rec.fails || []),
    warns_json: JSON.stringify(rec.warns || []),
    teknisi_nama_list: JSON.stringify(namaList),
    dibuat_pada: nowIso()
  };
  await jalankan(
    `INSERT INTO dailychecks
      (id, unit, tanggal, tanggal_urut, dinas, suhu, remark, teknisi_nama, teknisi_ttd, manager_nama, manager_ttd,
       ttd_untuk, state_json, fails_json, warns_json, teknisi_nama_list, dibuat_pada, dibuat_oleh)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
    [row.id, row.unit, row.tanggal, row.tanggal_urut, row.dinas, row.suhu, row.remark, row.teknisi_nama,
     row.teknisi_ttd, row.manager_nama, row.manager_ttd, row.ttd_untuk, row.state_json, row.fails_json,
     row.warns_json, row.teknisi_nama_list, row.dibuat_pada, olehUsername]
  );
  return Object.assign(rowToDcRingkas(row, { diinputOleh: olehNama || olehUsername }), {
    StateJSON: rec.state || {},
    FailsJSON: rec.fails || [],
    WarnsJSON: rec.warns || []
  });
}

export async function removeDailyCheck(id) {
  const r = await q1('SELECT teknisi_ttd, manager_ttd FROM dailychecks WHERE id = $1', [id]);
  await jalankan('DELETE FROM dailychecks WHERE id = $1', [id]);
  if (r) { await hapusBerkas(r.teknisi_ttd); await hapusBerkas(r.manager_ttd); }
  return true;
}

/** Ubah daily check yang sudah tersimpan — cerminan dari updateDailyCheck di db.js.
 *  Manager teknik yang sudah bertanda tangan mengunci catatan. Sebelum itu,
 *  seluruh bagian teknisi (tanggal/dinas/suhu/remark/state/nama/TTD teknisi/nama
 *  manager) boleh disunting; TTD manager sendiri hanya berubah lewat pintu
 *  tanda-tangan-susulan. */
export async function updateDailyCheck(id, patch = {}, actor = {}) {
  const row = await q1('SELECT * FROM dailychecks WHERE id = $1', [String(id)]);
  if (!row) throw new Error('Catatan tidak ditemukan — mungkin sudah dihapus.');
  if (row.manager_ttd) throw new Error('Catatan ini sudah ditandatangani manager teknik — tidak bisa disunting lagi.');
  if (!actor.admin) {
    if (row.unit === 'amhsadps') {
      // Kolaboratif lintas dinas (pagi/siang/malam akun sendiri), tapi Officer
      // (pejabat) hanya melihat & menandatangani — tidak menyunting checklist.
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

  let teknisi_ttd = row.teknisi_ttd;
  if (patch.teknisiTtd !== undefined && patch.teknisiTtd !== null && String(patch.teknisiTtd).startsWith('data:')) {
    if (row.teknisi_ttd) await hapusBerkas(row.teknisi_ttd);
    teknisi_ttd = await saveSignature(patch.teknisiTtd, 'dailycheck_teknisi');
  }

  const state_json = patch.state !== undefined ? JSON.stringify(patch.state || {}) : row.state_json;
  const fails_json = Array.isArray(patch.fails) ? JSON.stringify(patch.fails) : row.fails_json;
  const warns_json = Array.isArray(patch.warns) ? JSON.stringify(patch.warns) : row.warns_json;

  // Akun tujuan TTD susulan (kotak masuk Manager). Untuk AMHS baru diisi dinas
  // malam lewat Edit — harus ikut diperbarui atau TTD Manager tak pernah terkirim.
  const ttd_untuk = patch.ttdUntuk !== undefined ? String(patch.ttdUntuk || '') : row.ttd_untuk;

  await jalankan(`UPDATE dailychecks SET tanggal = $1, tanggal_urut = $2, dinas = $3, suhu = $4, remark = $5,
                                        teknisi_nama = $6, teknisi_nama_list = $7, teknisi_ttd = $8,
                                        manager_nama = $9, ttd_untuk = $10,
                                        state_json = $11, fails_json = $12, warns_json = $13
                                  WHERE id = $14`,
    [tanggal, tanggal_urut, dinas, suhu, remark,
     teknisiNama, teknisi_nama_list, teknisi_ttd,
     managerNama, ttd_untuk,
     state_json, fails_json, warns_json, String(id)]);

  const nama = await petaNamaPengguna();
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

export async function listIssues(unit = 'radtel') {
  const rows = await q('SELECT * FROM issues WHERE unit = $1 ORDER BY dibuat_pada', [unit]);
  const [nama, lamp] = await Promise.all([
    petaNamaPengguna(),
    lampiranIsuUntuk(rows.map((r) => r.id))
  ]);
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

export async function getIssue(id) {
  const r = await q1('SELECT * FROM issues WHERE id = $1', [id]);
  if (!r) return null;
  const [nama, lamp] = await Promise.all([
    petaNamaPengguna(),
    lampiranIsuUntuk([id])
  ]);
  const kotak = lamp.get(id) || { open: [], closed: [] };
  return rowToIssue(r, {
    diinputOleh: namaTampil(nama, r.dibuat_oleh),
    ditutupOleh: namaTampil(nama, r.ditutup_oleh),
    lampiranOpen: kotak.open,
    lampiranClosed: kotak.closed
  });
}

export const STATUS_ISU = ['Open', 'Proses', 'Closed'];

export async function insertIssue(isu = {}, olehUsername = '', olehNama = '') {
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
    /* Admin yang menciptakan isu langsung Closed berarti dialah penutupnya.
       Untuk isu yang lahir Open lalu ditutup belakangan, ditutup_oleh diisi
       oleh updateIssue saat statusnya berubah. */
    ditutup_oleh: status === 'Closed' ? String(olehUsername || '') : '',
    keterangan_closed: String(isu.keteranganClosed || '').trim(),
    // Pelapor selalu = akun yang login saat isu dibuat. Nilai dari klien
    // sengaja diabaikan — supaya jejak "siapa memasukkan" tidak bisa
    // dialihkan ke nama orang lain, baik lewat form maupun rekayasa payload.
    dilaporkan_oleh: olehNama || olehUsername || '',
    dibuat_pada: nowIso()
  };
  await jalankan(
    `INSERT INTO issues (id, unit, jenis, keterangan, lokasi, status, tanggal_report, tanggal_closed,
                         ditutup_oleh, keterangan_closed, dilaporkan_oleh, dibuat_pada, dibuat_oleh)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [row.id, row.unit, row.jenis, row.keterangan, row.lokasi, row.status,
     row.tanggal_report, row.tanggal_closed, row.ditutup_oleh, row.keterangan_closed,
     row.dilaporkan_oleh, row.dibuat_pada, olehUsername]
  );

  const lampiranOpen = await tambahLampiranIsu(id, 'open', isu.lampiranOpen);
  const lampiranClosed = status === 'Closed' ? await tambahLampiranIsu(id, 'closed', isu.lampiranClosed) : [];
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

export async function updateIssue(id, headerField, value, closerUsername = '') {
  const col = ISSUE_FIELDS[headerField];
  if (!col) return null;
  const sebelum = await q1('SELECT * FROM issues WHERE id = $1', [id]);
  if (!sebelum) return null;

  await jalankan(`UPDATE issues SET ${col} = $1 WHERE id = $2`, [String(value ?? ''), id]);

  // Tanggal closed dan penutupnya mengikuti status: terisi saat isu ditutup,
  // dikosongkan lagi saat dibuka kembali. Yang sudah ada tidak ditimpa —
  // penutup pertama itu yang berlaku, penyuntingan status berikutnya bukan
  // menutup ulang.
  if (col === 'status') {
    const status = String(value ?? '');
    if (status === 'Closed') {
      if (!sebelum.tanggal_closed) {
        await jalankan('UPDATE issues SET tanggal_closed = $1 WHERE id = $2', [nowIso().slice(0, 16), id]);
      }
      if (!sebelum.ditutup_oleh && closerUsername) {
        await jalankan('UPDATE issues SET ditutup_oleh = $1 WHERE id = $2', [String(closerUsername), id]);
      }
    } else if (status !== 'Closed') {
      if (sebelum.tanggal_closed) {
        await jalankan("UPDATE issues SET tanggal_closed = '' WHERE id = $1", [id]);
      }
      if (sebelum.ditutup_oleh) {
        await jalankan("UPDATE issues SET ditutup_oleh = '' WHERE id = $1", [id]);
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
export async function tutupIsu(id, keteranganClosed, closerUsername = '') {
  const sebelum = await q1('SELECT * FROM issues WHERE id = $1', [id]);
  if (!sebelum) return null;

  await jalankan("UPDATE issues SET status = 'Closed' WHERE id = $1", [id]);

  const catatan = String(keteranganClosed || '').trim();
  if (catatan) {
    await jalankan('UPDATE issues SET keterangan_closed = $1 WHERE id = $2', [catatan, id]);
  }
  if (!sebelum.tanggal_closed) {
    await jalankan('UPDATE issues SET tanggal_closed = $1 WHERE id = $2', [nowIso().slice(0, 16), id]);
  }
  if (!sebelum.ditutup_oleh && closerUsername) {
    await jalankan('UPDATE issues SET ditutup_oleh = $1 WHERE id = $2', [String(closerUsername), id]);
  }
  return getIssue(id);
}

/**
 * Menempel bukti fase "closed" pada isu. Terpisah dari addIssueLampiran
 * (admin-only) karena teknisi yang menutup isu perlu bisa melampirkan foto
 * hasil pekerjaan — tapi TIDAK boleh mengubah isunya di luar itu. Fase
 * dikunci ke 'closed'; upaya ke 'open' ditolak sejak di sini.
 */
export async function tambahBuktiTutupIsu(id, daftar) {
  const ada = await q1('SELECT 1 FROM issues WHERE id = $1', [id]);
  if (!ada) throw new Error('Isu tidak ditemukan.');
  await tambahLampiranIsu(String(id), 'closed', daftar || []);
  return getIssue(id);
}

export async function removeIssue(id) {
  await hapusBerkasLampiran('lampiran_isu', 'issue_id', id);
  await jalankan('DELETE FROM issues WHERE id = $1', [id]);
  return true;
}

/* ============== RUTE TTD (Nama pihak-kedua + akun tujuan) ==============
 *
 * Nama Manager Teknik/PJ dan akun yang dituju TTD-nya ditetapkan saat catatan
 * dibuat, dan sebelum sekarang tidak ada jalan mengubahnya lagi. Kalau
 * pengirimnya salah tunjuk — nama MT keliru, akun tujuan bukan orangnya — satu-
 * satunya obat adalah menghapus catatan lalu mengulang. Fungsi ini menutup celah
 * itu untuk kelima form yang punya slot pihak kedua: entry (logbook), daily
 * check, LTK, berkala, DS test.
 *
 * Aturannya sengaja ketat: begitu pihak kedua sudah membubuhkan tanda tangannya
 * (kolom *_ttd berisi PATH ke berkas TTD), rute-nya tidak boleh berubah lagi —
 * mengganti nama di bawah tanda tangan yang sudah tercetak sama dengan memalsu
 * arsipnya.
 */
const RUTE_TTD_META = {
  entry:   { tabel: 'entries',     ttdCol: 'pj_ttd',      namaCol: 'pj_nama',      subyek: 'penanggung jawab' },
  dc:      { tabel: 'dailychecks', ttdCol: 'manager_ttd', namaCol: 'manager_nama', subyek: 'manager teknik' },
  ltk:     { tabel: 'ltk',         ttdCol: 'manager_ttd', namaCol: 'manager_nama', subyek: 'manager teknik' },
  berkala: { tabel: 'berkala',     ttdCol: 'manager_ttd', namaCol: 'manager_nama', subyek: 'manager teknik' },
  dstest:  { tabel: 'dstest',      ttdCol: 'manager_ttd', namaCol: 'manager_nama', subyek: 'manager teknik' },
  bapb:    { tabel: 'bapb',        ttdCol: 'teknik_ttd',  namaCol: 'teknik_nama',  subyek: 'manager teknik' }
};

export async function updateTtdRouting(kind, id, patch = {}) {
  const meta = RUTE_TTD_META[String(kind || '').toLowerCase()];
  if (!meta) throw new Error(`Jenis catatan tidak dikenal: ${kind}`);
  const row = await q1(`SELECT ${meta.ttdCol}, ${meta.namaCol}, ttd_untuk FROM ${meta.tabel} WHERE id = $1`, [String(id)]);
  if (!row) throw new Error('Catatan tidak ditemukan — mungkin sudah dihapus.');
  if (row[meta.ttdCol]) {
    throw new Error(`Catatan ini sudah ditandatangani ${meta.subyek} — nama dan akun tujuannya tidak bisa diubah lagi.`);
  }
  const setBaru = {};
  if (patch.managerNama !== undefined) setBaru[meta.namaCol] = String(patch.managerNama || '').trim();
  if (patch.pjNama !== undefined)      setBaru[meta.namaCol] = String(patch.pjNama || '').trim();
  if (patch.ttdUntuk !== undefined)    setBaru.ttd_untuk    = String(patch.ttdUntuk || '').trim();
  const kunci = Object.keys(setBaru);
  if (!kunci.length) return true;
  const potongan = kunci.map((k, i) => `${k} = $${i + 1}`).join(', ');
  await jalankan(`UPDATE ${meta.tabel} SET ${potongan} WHERE id = $${kunci.length + 1}`,
    [...kunci.map((k) => setBaru[k]), String(id)]);
  return true;
}

/* ============== FORM MONITORING FREKUENSI ============== */

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

export async function listMonitoring(unit = 'radkom', limit = 200) {
  const rows = await q(
    `SELECT * FROM monitoring WHERE unit = $1 ORDER BY tanggal DESC, dibuat_pada DESC LIMIT $2`,
    [unit, limit]
  );
  const nama = await petaNamaPengguna();
  return rows.map((r) => rowToMonitoring(r, {
    diinputOleh: namaTampil(nama, r.dibuat_oleh),
    ttdOleh: namaTampil(nama, r.ttd_oleh)
  }));
}

export async function insertMonitoring(rec = {}, olehUsername = '', olehNama = '') {
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
    personil_ops_ttd: await saveSignature(rec.personilOpsTtd, 'monitoring_ops'),
    teknisi_ttd: await saveSignature(rec.teknisiTtd, 'monitoring_teknisi'),
    ttd_untuk: rec.ttdUntuk || '',
    teknisi_nama_list: JSON.stringify(namaList),
    dibuat_pada: nowIso()
  };
  await jalankan(
    `INSERT INTO monitoring (id, unit, tanggal, baris_json, personil_ops, personil_teknik,
                             personil_ops_ttd, teknisi_ttd, ttd_untuk, teknisi_nama_list, dibuat_pada, dibuat_oleh)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [row.id, row.unit, row.tanggal, row.baris_json, row.personil_ops, row.personil_teknik,
     row.personil_ops_ttd, row.teknisi_ttd, row.ttd_untuk, row.teknisi_nama_list, row.dibuat_pada, olehUsername]
  );
  return rowToMonitoring(row, { diinputOleh: olehNama || olehUsername });
}

export async function removeMonitoring(id) {
  const r = await q1('SELECT teknisi_ttd, personil_ops_ttd FROM monitoring WHERE id = $1', [id]);
  await jalankan('DELETE FROM monitoring WHERE id = $1', [id]);
  if (r) { await hapusBerkas(r.teknisi_ttd); await hapusBerkas(r.personil_ops_ttd); }
  return true;
}

/* ============== DS TEST ============== */

/* Daftar site-nya di ds-site.js, sama persis dengan yang dipakai db.js
   (diimpor di atas). Diekspor ulang supaya server.js tidak perlu tahu
   sedang memakai SQLite atau Postgres. */
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

export async function listDsTest(unit = 'radtel', limit = 200) {
  const rows = await q(
    'SELECT * FROM dstest WHERE unit = $1 ORDER BY tanggal DESC, dibuat_pada DESC LIMIT $2',
    [unit, limit]
  );
  const nama = await petaNamaPengguna();
  return rows.map((r) => rowToDsTest(r, {
    diinputOleh: namaTampil(nama, r.dibuat_oleh),
    ttdOleh: namaTampil(nama, r.ttd_oleh)
  }));
}

export async function insertDsTest(rec = {}, olehUsername = '', olehNama = '') {
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
  if (!isKhusus && dsSiteUntuk(kategori).length === 0) {
    throw new Error('Daftar site untuk kategori ' + kategori + ' belum diisi.');
  }
  const row = {
    id: newId(),
    unit: unitSah(rec.unit) ? rec.unit : 'radtel',
    kategori,
    tanggal: String(rec.tanggal || '').trim() || today(),
    state_json: JSON.stringify(rec.state || {}),
    teknisi_nama: namaList.join(', '),
    teknisi_nama_list: JSON.stringify(namaList),
    teknisi_ttd: await saveSignature(rec.teknisiTtd, 'dstest_teknisi'),
    manager_nama: String(rec.managerNama || '').trim(),
    manager_ttd: await saveSignature(rec.managerTtd, 'dstest_manager'),
    ttd_untuk: rec.ttdUntuk || '',
    dibuat_pada: nowIso()
  };
  await jalankan(
    `INSERT INTO dstest (id, unit, kategori, tanggal, state_json, teknisi_nama, teknisi_nama_list,
                         teknisi_ttd, manager_nama, manager_ttd, ttd_untuk, dibuat_pada, dibuat_oleh)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [row.id, row.unit, row.kategori, row.tanggal, row.state_json, row.teknisi_nama,
     row.teknisi_nama_list, row.teknisi_ttd, row.manager_nama, row.manager_ttd, row.ttd_untuk,
     row.dibuat_pada, olehUsername]
  );
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
export async function updateDsTest(id, patch = {}, actor = {}) {
  const row = await q1('SELECT * FROM dstest WHERE id = $1', [String(id)]);
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
    if (row.teknisi_ttd) await hapusBerkas(row.teknisi_ttd);
    teknisi_ttd = await saveSignature(patch.teknisiTtd, 'dstest_teknisi');
  }
  const state_json = patch.state !== undefined ? JSON.stringify(patch.state || {}) : row.state_json;
  const ttd_untuk = patch.ttdUntuk !== undefined ? String(patch.ttdUntuk || '') : row.ttd_untuk;

  await jalankan(`UPDATE dstest SET tanggal = $1, state_json = $2, teknisi_nama = $3,
                                    teknisi_nama_list = $4, teknisi_ttd = $5, manager_nama = $6,
                                    ttd_untuk = $7
                              WHERE id = $8`,
    [tanggal, state_json, teknisiNama, teknisi_nama_list, teknisi_ttd, managerNama, ttd_untuk, String(id)]);

  const nama = await petaNamaPengguna();
  const rowBaru = { ...row, tanggal, state_json, teknisi_nama: teknisiNama, teknisi_nama_list,
                    teknisi_ttd, manager_nama: managerNama, ttd_untuk };
  return rowToDsTest(rowBaru, {
    diinputOleh: namaTampil(nama, row.dibuat_oleh),
    ttdOleh: namaTampil(nama, row.ttd_oleh)
  });
}

export async function removeDsTest(id) {
  const r = await q1('SELECT teknisi_ttd, manager_ttd FROM dstest WHERE id = $1', [id]);
  await jalankan('DELETE FROM dstest WHERE id = $1', [id]);
  if (r) { await hapusBerkas(r.teknisi_ttd); await hapusBerkas(r.manager_ttd); }
  return true;
}

/* ============== PEKERJAAN BERKALA ==============
   Daftar itemnya di berkala-item.js, sama persis dengan yang dipakai db.js
   (diimpor di atas). Yang disimpan cuma hasil pengisiannya, berkunci kode
   item — menambah pekerjaan tidak perlu migrasi. */

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

export async function listBerkala(unit = 'radtel', limit = 200) {
  const rows = await q(
    'SELECT * FROM berkala WHERE unit = $1 ORDER BY tanggal DESC, dibuat_pada DESC LIMIT $2',
    [unit, limit]
  );
  const nama = await petaNamaPengguna();
  return rows.map((r) => rowToBerkala(r, {
    diinputOleh: namaTampil(nama, r.dibuat_oleh),
    ttdOleh: namaTampil(nama, r.ttd_oleh)
  }));
}

export async function insertBerkala(rec = {}, olehUsername = '', olehNama = '') {
  const namaList = Array.isArray(rec.teknisiNamaList) ? rec.teknisiNamaList : [];
  const jenis = jenisBerkalaSah(rec.jenis) ? rec.jenis : 'neptuno';
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
    teknisi_nama: namaList.join(', '),
    teknisi_nama_list: JSON.stringify(namaList),
    teknisi_ttd: await saveSignature(rec.teknisiTtd, 'berkala_teknisi'),
    manager_nama: String(rec.managerNama || '').trim(),
    manager_ttd: await saveSignature(rec.managerTtd, 'berkala_manager'),
    ttd_untuk: rec.ttdUntuk || '',
    dibuat_pada: nowIso()
  };
  await jalankan(
    `INSERT INTO berkala (id, unit, jenis, tanggal, state_json, catatan, teknisi_nama,
                          teknisi_nama_list, teknisi_ttd, manager_nama, manager_ttd,
                          ttd_untuk, dibuat_pada, dibuat_oleh)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [row.id, row.unit, row.jenis, row.tanggal, row.state_json, row.catatan, row.teknisi_nama,
     row.teknisi_nama_list, row.teknisi_ttd, row.manager_nama, row.manager_ttd, row.ttd_untuk,
     row.dibuat_pada, olehUsername]
  );
  return rowToBerkala(row, { diinputOleh: olehNama || olehUsername });
}

export async function removeBerkala(id) {
  const r = await q1('SELECT teknisi_ttd, manager_ttd FROM berkala WHERE id = $1', [id]);
  await jalankan('DELETE FROM berkala WHERE id = $1', [id]);
  if (r) { await hapusBerkas(r.teknisi_ttd); await hapusBerkas(r.manager_ttd); }
  return true;
}

/* ============== LTK ============== */

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

export async function listLtk(unit = 'radkom', limit = 200) {
  const rows = await q(
    'SELECT * FROM ltk WHERE unit = $1 ORDER BY tanggal_lapor DESC, dibuat_pada DESC LIMIT $2',
    [unit, limit]
  );
  const [nama, lamp] = await Promise.all([
    petaNamaPengguna(),
    lampiranUntuk('lampiran_ltk', 'ltk_id', rows.map((r) => r.id))
  ]);
  return rows.map((r) => rowToLtk(r, {
    diinputOleh: namaTampil(nama, r.dibuat_oleh),
    ttdOleh: namaTampil(nama, r.ttd_oleh),
    lampiran: lamp.get(r.id) || []
  }));
}

export async function insertLtk(rec = {}, olehUsername = '', olehNama = '') {
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
    manager_ttd: await saveSignature(rec.managerTtd, 'ltk_manager'),
    ttd_untuk: teks(rec.ttdUntuk),
    teknisi_nama: teks(rec.teknisiNama),
    teknisi_ttd: await saveSignature(rec.teknisiTtd, 'ltk_teknisi'),
    dibuat_pada: nowIso()
  };
  await jalankan(
    `INSERT INTO ltk (id, unit, tanggal_lapor, penyelenggara, kelompok, peralatan, modul,
                      analisa, perbaikan, tanggal_rusak, jam_rusak, tanggal_selesai, jam_selesai,
                      jam_terputus, kota, manager_nama, manager_ttd, ttd_untuk, teknisi_nama, teknisi_ttd,
                      dibuat_pada, dibuat_oleh)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
    [row.id, row.unit, row.tanggal_lapor, row.penyelenggara, row.kelompok, row.peralatan, row.modul,
     row.analisa, row.perbaikan, row.tanggal_rusak, row.jam_rusak, row.tanggal_selesai,
     row.jam_selesai, row.jam_terputus, row.kota, row.manager_nama, row.manager_ttd, row.ttd_untuk,
     row.teknisi_nama, row.teknisi_ttd, row.dibuat_pada, olehUsername]
  );

  const lampiran = await tambahLampiranLtk(row.id, rec.lampiran);
  return rowToLtk(row, { diinputOleh: olehNama || olehUsername, lampiran });
}

export async function getLtk(id) {
  const r = await q1('SELECT * FROM ltk WHERE id = $1', [id]);
  if (!r) return null;
  const nama = await petaNamaPengguna();
  return rowToLtk(r, {
    diinputOleh: namaTampil(nama, r.dibuat_oleh),
    ttdOleh: namaTampil(nama, r.ttd_oleh),
    lampiran: (await lampiranUntuk('lampiran_ltk', 'ltk_id', [id])).get(id) || []
  });
}

export async function removeLtk(id) {
  const r = await q1('SELECT manager_ttd, teknisi_ttd FROM ltk WHERE id = $1', [id]);
  await hapusBerkasLampiran('lampiran_ltk', 'ltk_id', id);
  await jalankan('DELETE FROM ltk WHERE id = $1', [id]);
  if (r) { await hapusBerkas(r.manager_ttd); await hapusBerkas(r.teknisi_ttd); }
  return true;
}

/* ============== BAPB — BERITA ACARA PEMASANGAN BARANG ==============
 * Sepadan dengan versi SQLite: item disimpan sebagai JSON di satu kolom,
 * kolom per-item dibersihkan sebelum masuk. Tanpa lampiran, tanpa ttd
 * susulan — dua pihak kedua (Pemakai + Teknik) belum muat di JENIS_TTD
 * slot-tunggal, itu urusan langkah berikutnya. */

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

export async function listBapb(unit = 'radkom', limit = 200) {
  const rows = await q(
    'SELECT * FROM bapb WHERE unit = $1 ORDER BY tanggal DESC, dibuat_pada DESC LIMIT $2',
    [unit, limit]
  );
  const nama = await petaNamaPengguna();
  return rows.map((r) => rowToBapb(r, {
    diinputOleh: namaTampil(nama, r.dibuat_oleh),
    ttdOleh: namaTampil(nama, r.ttd_oleh)
  }));
}

export async function insertBapb(rec = {}, olehUsername = '', olehNama = '') {
  const teks = (v) => String(v ?? '').trim();
  const items = Array.isArray(rec.items) ? rec.items.map(bapbItemBersih) : [];

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
    pemakai_ttd: await saveSignature(rec.pemakaiTtd, 'bapb_pemakai'),
    // Manager Teknik dibubuhkan susulan lewat kotak masuk, bukan di form;
    // ttd_untuk menunjuk akun mantek tujuannya.
    teknik_nama: teks(rec.teknikNama),
    teknik_ttd: '',
    ttd_untuk: teks(rec.ttdUntuk),
    petugas_nama: petugasRingkas,
    petugas_nama_list: JSON.stringify(petugasList),
    petugas_ttd: await saveSignature(rec.petugasTtd, 'bapb_petugas'),
    dibuat_pada: nowIso()
  };
  await jalankan(
    `INSERT INTO bapb (id, unit, nomor, tanggal, untuk_pekerjaan, lokasi, items_json,
                       pemakai_nama, pemakai_ttd, teknik_nama, teknik_ttd, ttd_untuk,
                       petugas_nama, petugas_nama_list, petugas_ttd, dibuat_pada, dibuat_oleh)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
    [row.id, row.unit, row.nomor, row.tanggal, row.untuk_pekerjaan, row.lokasi, row.items_json,
     row.pemakai_nama, row.pemakai_ttd, row.teknik_nama, row.teknik_ttd, row.ttd_untuk,
     row.petugas_nama, row.petugas_nama_list, row.petugas_ttd, row.dibuat_pada, olehUsername]
  );
  return rowToBapb(row, { diinputOleh: olehNama || olehUsername });
}

/**
 * Sunting susulan BAPB — cerminan Postgres dari updateBapb di db.js. Hanya
 * panel Manager Pemakai (nama + TTD), dan dikunci begitu Manager Teknik sudah
 * tanda tangan.
 */
export async function updateBapb(id, patch = {}, { username = '', admin = false } = {}) {
  const r = await q1('SELECT dibuat_oleh, teknik_ttd, pemakai_ttd FROM bapb WHERE id = $1', [String(id)]);
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
    const path = patch.pemakaiTtd ? await saveSignature(patch.pemakaiTtd, 'bapb_pemakai') : '';
    if (r.pemakai_ttd && r.pemakai_ttd !== path) await hapusBerkas(r.pemakai_ttd);
    setBaru.pemakai_ttd = path;
  }
  const kunci = Object.keys(setBaru);
  if (kunci.length) {
    const potongan = kunci.map((k, i) => `${k} = $${i + 1}`).join(', ');
    await jalankan(`UPDATE bapb SET ${potongan} WHERE id = $${kunci.length + 1}`,
      [...kunci.map((k) => setBaru[k]), String(id)]);
  }
  return getBapb(String(id));
}

export async function getBapb(id) {
  const r = await q1('SELECT * FROM bapb WHERE id = $1', [id]);
  if (!r) return null;
  const nama = await petaNamaPengguna();
  return rowToBapb(r, {
    diinputOleh: namaTampil(nama, r.dibuat_oleh),
    ttdOleh: namaTampil(nama, r.ttd_oleh)
  });
}

export async function removeBapb(id) {
  const r = await q1('SELECT pemakai_ttd, teknik_ttd, petugas_ttd FROM bapb WHERE id = $1', [id]);
  await jalankan('DELETE FROM bapb WHERE id = $1', [id]);
  if (r) {
    await hapusBerkas(r.pemakai_ttd);
    await hapusBerkas(r.teknik_ttd);
    await hapusBerkas(r.petugas_ttd);
  }
  return true;
}

/* ============== TANDA TANGAN SUSULAN ==============
 * Sama persis aturannya dengan versi SQLite: hanya petak tanda tangan pihak
 * kedua yang boleh disentuh, dan hanya kalau petak itu masih kosong. Nama tabel
 * dan kolom datang dari daftar tetap di bawah, bukan dari klien. */

export const JENIS_TTD = {
  logbook:    { tabel: 'entries',     nama: 'pj_nama',      ttd: 'pj_ttd',           prefix: 'logbook_pj',         label: 'Manager Teknik',   tglKolom: 'tanggal' },
  dailycheck: { tabel: 'dailychecks', nama: 'manager_nama', ttd: 'manager_ttd',      prefix: 'dailycheck_manager', label: 'Manager Teknik',   tglKolom: 'tanggal' },
  monitoring: { tabel: 'monitoring',  nama: 'personil_ops', ttd: 'personil_ops_ttd', prefix: 'monitoring_ops',     label: 'Personil Operasi', tglKolom: 'tanggal' },
  dstest:     { tabel: 'dstest',      nama: 'manager_nama', ttd: 'manager_ttd',      prefix: 'dstest_manager',     label: 'Manager Teknik',   tglKolom: 'tanggal' },
  berkala:    { tabel: 'berkala',     nama: 'manager_nama', ttd: 'manager_ttd',      prefix: 'berkala_manager',    label: 'Manager Teknik',   tglKolom: 'tanggal' },
  ltk:        { tabel: 'ltk',         nama: 'manager_nama', ttd: 'manager_ttd',      prefix: 'ltk_manager',        label: 'Manager Teknik',   tglKolom: 'tanggal_lapor' },
  // BAPB hanya merutekan slot Manager Teknik; Pemakai & petugas di form.
  bapb:       { tabel: 'bapb',        nama: 'teknik_nama',  ttd: 'teknik_ttd',       prefix: 'bapb_teknik',        label: 'Manager Teknik (BAPB)', tglKolom: 'tanggal' }
};

export const jenisTtdSah = (jenis) =>
  Object.prototype.hasOwnProperty.call(JENIS_TTD, String(jenis));

/** Unit pemilik sebuah catatan. Dipakai server untuk memeriksa hak akses. */
export async function unitCatatan(jenis, id) {
  if (!jenisTtdSah(jenis)) return '';
  const t = JENIS_TTD[jenis];
  const r = await q1(`SELECT unit FROM ${t.tabel} WHERE id = $1`, [String(id)]);
  return r ? (r.unit || '') : '';
}

/**
 * Nama pada formulir tidak diganti — itu tulisan teknisi yang mengisi, dan itu
 * yang sah di lembar cetak. Nama akun penandatangan dicatat terpisah sebagai
 * keterangan status. Hanya kalau nama pada formulir memang masih kosong, nama
 * akun penandatangan dipakai supaya petaknya tidak tercetak tanpa nama.
 */
export async function tandaTanganiCatatan(jenis, id, { nama, username, role, ttd }) {
  if (!jenisTtdSah(jenis)) throw new Error('Jenis catatan tidak dikenal: ' + jenis);
  const t = JENIS_TTD[jenis];
  const row = await q1(
    `SELECT ${t.nama} AS nama, ${t.ttd} AS ttd, ttd_untuk,
            dibuat_oleh, ${t.tglKolom} AS tanggal
       FROM ${t.tabel} WHERE id = $1`, [String(id)]
  );
  if (!row) throw new Error('Catatan tidak ditemukan — mungkin sudah dihapus.');
  if (row.ttd) throw new Error('Catatan ini sudah ditandatangani.');
  // Kalau catatan ditunjuk ke akun tertentu, hanya akun itu atau admin yang
  // boleh membubuhkan — nama pada formulir bisa sekadar sebutan jabatan
  // ("PH", dsb.), jadi kecocokan nama tidak dipakai untuk menentukan hak ini.
  if (row.ttd_untuk && role !== 'admin' && String(username || '').toLowerCase() !== String(row.ttd_untuk).toLowerCase()) {
    throw new Error('Catatan ini ditujukan untuk akun lain — hanya akun yang ditunjuk atau admin yang dapat menandatangani.');
  }

  const path = await saveSignature(ttd, t.prefix);
  if (!path) throw new Error('Tanda tangannya kosong.');

  const namaTetap = String(row.nama || '').trim() ? row.nama : String(nama || '');
  const pada = nowIso();
  await jalankan(
    `UPDATE ${t.tabel} SET ${t.nama} = $1, ${t.ttd} = $2, ttd_oleh = $3, ttd_pada = $4 WHERE id = $5`,
    [namaTetap, path, String(username || ''), pada, String(id)]
  );
  return {
    jenis, id: String(id), nama: namaTetap, ttd: path,
    ttdOleh: String(nama || username || ''), ttdPada: pada,
    // Untuk notifikasi balik ke pembuat/pelaksana — lihat server.js.
    dibuatOleh: String(row.dibuat_oleh || ''), tanggal: String(row.tanggal || '')
  };
}

/**
 * Baris mentah untuk rekap — cerminan dari rekapMentah di db.js. Penjumlahannya
 * dikerjakan server.js, bukan di sini, supaya rumusnya satu tempat saja.
 */
export async function rekapMentah(unit, dari, sampai) {
  const arg = [String(unit || ''), String(dari || '0000-01-01'), String(sampai || '9999-12-31')];
  const amb = (sql) => q(sql, arg);
  return {
    entries: await amb(`SELECT id, tanggal, dinas, lokasi, uraian, teknisi_nama, teknisi_nama_list
                          FROM entries WHERE unit = $1 AND tanggal BETWEEN $2 AND $3`),
    ltk: await amb(`SELECT id, tanggal_lapor AS tanggal, peralatan, kelompok, modul, analisa, perbaikan,
                           teknisi_nama
                      FROM ltk WHERE unit = $1 AND tanggal_lapor BETWEEN $2 AND $3`),
    issues: await amb(`SELECT id, tanggal_report AS tanggal, status, jenis, keterangan, lokasi,
                              dilaporkan_oleh
                         FROM issues WHERE unit = $1 AND substr(tanggal_report, 1, 10) BETWEEN $2 AND $3`)
  };
}

/**
 * Akun yang boleh ditunjuk sebagai penerima TTD susulan — pejabat yang masih
 * aktif saja, bukan administrator (admin cuma pengelola sistem, bukan
 * penandatangan formulir). Dikirim ke seluruh pengguna yang login, bukan
 * cuma admin.
 */
export async function listPejabatAktif() {
  return q(`SELECT username, nama FROM users
            WHERE aktif = true AND role = 'pejabat'
            ORDER BY nama`);
}

/**
 * Daftar ringkas seluruh akun aktif — hanya username + nama, tanpa peran.
 * Dipakai dashboard untuk melengkapi nama dari daftar petugas di hak.json.
 * Cerminan Postgres dari listAkunAktif di db.js.
 */
export async function listAkunAktif() {
  return q(`SELECT username, nama FROM users
            WHERE aktif = true
            ORDER BY nama`);
}

/**
 * Pejabat aktif yang opt-in ke satu unit — cerminan Postgres dari listPejabatUnit
 * di db.js. Dipakai kartu cetak dashboard untuk memasang Manajer Teknik bidang
 * itu pada kolom tanda tangan kanan.
 */
export async function listPejabatUnit(unitKode) {
  const kode = String(unitKode || '').trim();
  if (!kode) return [];
  return q(`
    SELECT u.username, u.nama
      FROM users u
     WHERE u.aktif = true AND u.role = 'pejabat'
       AND EXISTS (SELECT 1 FROM user_unit uu WHERE uu.user_id = u.id AND uu.unit = $1)
     ORDER BY u.nama`, [kode]);
}

/**
 * Akun yang muncul sebagai saran nama teknisi di formulir untuk satu unit.
 * Cerminan Postgres dari listTeknisiUnit di db.js — lihat catatan panjang di
 * sana untuk aturan admin/pejabat opt-in.
 */
export async function listTeknisiUnit(unitKode) {
  const kode = String(unitKode || '').trim();
  if (!kode) return [];
  return q(`
    SELECT u.username, u.nama
      FROM users u
     WHERE u.aktif = true
       AND EXISTS (SELECT 1 FROM user_unit uu WHERE uu.user_id = u.id AND uu.unit = $1)
     ORDER BY u.nama`, [kode]);
}

/**
 * Kotak masuk TTD seorang akun — cerminan dari getInboxTtd di db.js. Lintas
 * unit, karena pejabat dan admin memang berhak atas semua unit.
 *
 * Kelima tabelnya ditanyakan dalam satu perintah, bukan lima kali berurutan.
 * Nama tabel dan kolomnya datang dari JENIS_TTD — daftar tetap di berkas ini,
 * bukan dari klien — jadi menyusunnya sebagai teks tetap aman; yang datang dari
 * luar cuma username, dan itu tetap lewat parameter.
 */
const SQL_INBOX_TTD = Object.entries(JENIS_TTD).map(([jenis, t]) =>
  `(SELECT '${jenis}' AS jenis, id, unit, ${t.nama} AS nama, ${t.tglKolom} AS tanggal, dibuat_pada
      FROM ${t.tabel} WHERE ttd_untuk = $1 AND (${t.ttd} = '' OR ${t.ttd} IS NULL)
     ORDER BY dibuat_pada DESC LIMIT 50)`
).join('\n   UNION ALL\n') + '\n   ORDER BY dibuat_pada DESC';

export async function getInboxTtd(username) {
  const u = String(username || '').trim();
  if (!u) return [];
  const rows = await q(SQL_INBOX_TTD, [u]);
  return rows.map((r) => ({
    jenis: r.jenis, id: r.id, unit: r.unit || '', nama: r.nama || '',
    tanggal: r.tanggal || '', label: JENIS_TTD[r.jenis].label, dibuatPada: r.dibuat_pada
  }));
}

/* ============== TAUTAN TELEGRAM ==============
 * Cermin Postgres dari fungsi senama di db.js — lihat catatan lengkap di sana.
 * Postgres TEXT peka huruf besar/kecil, jadi username dinormalkan lowercase di
 * sini (SQLite memakai COLLATE NOCASE) agar cocok lintas penulisan kasus. */

const tgUser = (u) => String(u || '').trim().toLowerCase();

export async function buatTautanTelegram(username) {
  const u = tgUser(username);
  if (!u) throw new Error('Akun tidak dikenal.');
  const token = crypto.randomBytes(24).toString('base64url');
  await jalankan(
    `INSERT INTO telegram_akun (username, chat_id, tautan_token, ditautkan_pada, dibuat_pada)
     VALUES ($1, '', $2, '', $3)
     ON CONFLICT (username) DO UPDATE SET tautan_token = EXCLUDED.tautan_token`,
    [u, token, nowIso()]
  );
  return token;
}

export async function tautkanTelegram(token, chatId) {
  const t = String(token || '').trim();
  const c = String(chatId || '').trim();
  if (!t || !c) return null;
  const row = await q1(
    `SELECT username FROM telegram_akun WHERE tautan_token = $1 AND tautan_token <> ''`, [t]
  );
  if (!row) return null;
  await jalankan("UPDATE telegram_akun SET chat_id = '' WHERE chat_id = $1 AND username <> $2",
    [c, row.username]);
  await jalankan(
    `UPDATE telegram_akun SET chat_id = $1, tautan_token = '', ditautkan_pada = $2 WHERE username = $3`,
    [c, nowIso(), row.username]
  );
  const usr = await q1('SELECT nama FROM users WHERE lower(username) = $1', [row.username]);
  return { username: row.username, nama: (usr && usr.nama) || row.username };
}

export async function getChatIdTelegram(username) {
  const u = tgUser(username);
  if (!u) return '';
  const row = await q1('SELECT chat_id FROM telegram_akun WHERE username = $1', [u]);
  return (row && row.chat_id) || '';
}

export async function putusTautanTelegram(username) {
  const u = tgUser(username);
  if (u) await jalankan("UPDATE telegram_akun SET chat_id = '', tautan_token = '' WHERE username = $1", [u]);
  return { tertaut: false };
}

export async function statusTautanTelegram(username) {
  const u = tgUser(username);
  if (!u) return { tertaut: false, ditautkanPada: '' };
  const row = await q1('SELECT chat_id, ditautkan_pada FROM telegram_akun WHERE username = $1', [u]);
  return { tertaut: !!(row && row.chat_id), ditautkanPada: (row && row.ditautkan_pada) || '' };
}
