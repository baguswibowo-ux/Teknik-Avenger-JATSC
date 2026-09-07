/**
 * TARIK DATA DARI SUPABASE KE KOMPUTER INI
 *
 *   node tools/tarik-supabase.js              tarik semuanya
 *   node tools/tarik-supabase.js --hanya-cek  hitung saja, tidak menulis apa pun
 *   node tools/tarik-supabase.js --tanpa-berkas  tabel saja, lewati Storage
 *
 * Bagian dari pindah hosting Vercel → PC sendiri (Sep 2026). Di Vercel kedua
 * aplikasi memakai Supabase (ELOGBOOK_DB=postgres, AVENGER_DB=postgres); di
 * PC sendiri keduanya memakai jalur berkas: E-Logbook ke SQLite
 * elogbook/data/elogbook.db + elogbook/uploads/, Avenger ke data/*.json +
 * public/foto/. Skrip ini memindahkan isinya, sekali jalan, tanpa mengubah
 * apa pun di Supabase — semua kueri ke sana murni SELECT.
 *
 * Yang dipindahkan:
 *   1. 15 tabel E-Logbook  → SQLite baru yang skemanya dibuat db.js sendiri,
 *      jadi kolomnya persis yang dipakai kode SQLite. Kolom yang ada di
 *      Postgres tapi tidak di SQLite dilaporkan, bukan diam-diam dibuang.
 *   2. avenger_state       → satu berkas per baris; kuncinya memang jalur
 *      relatif terhadap akar aplikasi (data/dinas.json, public/foto/daftar.json).
 *   3. Storage bucket elogbook → elogbook/uploads/<nama>  (TTD dan lampiran;
 *      kolom di tabel sudah berisi '/uploads/<nama>', jadi tidak ada yang
 *      perlu ditulis ulang)
 *   4. Storage bucket avenger  → <akar>/<nama>  (foto, logo, dokumen unit)
 *
 * Data lokal yang sudah ada TIDAK dihapus: dipindahkan ke
 * _cadangan-lokal-<waktu>/ sebelum ditimpa. Berkas unggahan yang namanya sama
 * dan ukurannya sama dilewati, jadi skrip ini aman dijalankan berulang.
 *
 * Kredensial dibaca dari .env lalu .vercel/.env.production.local (hasil
 * `npx vercel pull --environment=production`). Yang wajib: DATABASE_URL,
 * SUPABASE_URL, SUPABASE_SERVICE_KEY.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ELOG = path.join(ROOT, 'elogbook');
const HANYA_CEK = process.argv.includes('--hanya-cek');
const TANPA_BERKAS = process.argv.includes('--tanpa-berkas');

for (const f of ['.env', path.join('elogbook', '.env'), path.join('.vercel', '.env.production.local')]) {
  try { process.loadEnvFile(path.join(ROOT, f)); } catch { /* tidak ada: lewat */ }
}
/* Variabel bertanda Sensitive di Vercel ikut tertarik sebagai teks "[SENSITIVE]",
   bukan nilainya. Itu bukan kredensial — anggap kosong supaya pesan galatnya
   menyebut variabel yang belum diisi, bukan "host 'base' tidak ditemukan". */
for (const k of Object.keys(process.env)) {
  if (process.env[k] === '[SENSITIVE]') delete process.env[k];
}
const DATABASE_URL = process.env.DATABASE_URL || '';
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const BUCKET_ELOG = process.env.ELOGBOOK_BUCKET || 'elogbook';
const BUCKET_AVENGER = process.env.AVENGER_BUCKET || 'avenger';

if (!DATABASE_URL) gagal('DATABASE_URL kosong. Isi di .env — ambil dari Supabase → Connect → Transaction pooler (port 6543).');
if (!TANPA_BERKAS && (!SUPABASE_URL || !SERVICE_KEY)) gagal('SUPABASE_URL / SUPABASE_SERVICE_KEY kosong — perlu untuk mengunduh berkas.');

function gagal(pesan) { console.error('✗ ' + pesan); process.exit(1); }
const stempel = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
const CADANGAN = path.join(ROOT, `_cadangan-lokal-${stempel}`);
const catatan = [];   // peringatan yang dikumpulkan, dicetak di akhir

/* ============== 1. POSTGRES ============== */
const { default: pg } = await import('pg');
const kolam = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 3 });
const q = (sql, params) => kolam.query(sql, params).then((r) => r.rows);
await q('SELECT 1');
console.log('✓ Tersambung ke Postgres Supabase');

/* Urutan mengikuti kunci asing: induk dulu, anak kemudian. */
const TABEL = [
  'users', 'user_unit', 'sessions',
  'entries', 'lampiran',
  'issues', 'lampiran_isu',
  'monitoring', 'ltk', 'lampiran_ltk',
  'dstest', 'berkala', 'bapb', 'dailychecks', 'telegram_akun'
];

const jumlahPg = {};
for (const t of TABEL) jumlahPg[t] = Number((await q(`SELECT count(*) n FROM ${t}`))[0].n);
const stateRows = await q('SELECT kunci, isi FROM avenger_state ORDER BY kunci');

if (HANYA_CEK) {
  console.log('\nJumlah baris di Supabase:');
  for (const t of TABEL) console.log(`  ${t.padEnd(14)} ${jumlahPg[t]}`);
  console.log(`  ${'avenger_state'.padEnd(14)} ${stateRows.length}`);
  if (!TANPA_BERKAS) {
    for (const b of [BUCKET_ELOG, BUCKET_AVENGER]) {
      const daftar = await daftarObjek(b);
      console.log(`  storage:${b.padEnd(6)} ${daftar.length} berkas, ${(daftar.reduce((s, o) => s + o.ukuran, 0) / 1e6).toFixed(1)} MB`);
    }
  }
  await kolam.end();
  process.exit(0);
}

/* ============== 2. SQLITE BARU, SKEMA DARI db.js ============== */
const SCRATCH = path.join(ELOG, 'data', `_tarik-${stempel}`);
fs.mkdirSync(SCRATCH, { recursive: true });
process.env.ELOGBOOK_DATA_DIR = SCRATCH;
/* db.js membuka <DATA_DIR>/elogbook.db saat diimpor, menjalankan CREATE TABLE
   dan semua tambahKolom-nya. Itu persis skema yang dipakai server nanti. */
const { db } = await import('../elogbook/db.js');
console.log('✓ SQLite baru dibuat dengan skema db.js');

const kolomSqlite = (t) => db.prepare(`PRAGMA table_info(${t})`).all();
const jumlahSqlite = {};
db.exec('PRAGMA foreign_keys = OFF');
db.exec('BEGIN');
try {
  for (const t of TABEL) {
    const baris = await q(`SELECT * FROM ${t}`);
    const kolom = kolomSqlite(t);
    if (!kolom.length) { catatan.push(`tabel ${t} tidak ada di skema SQLite — ${baris.length} baris dilewati`); continue; }
    const namaSqlite = new Set(kolom.map((c) => c.name));
    const namaPg = baris.length ? Object.keys(baris[0]) : (await q(
      `SELECT column_name FROM information_schema.columns WHERE table_name=$1`, [t])).map((r) => r.column_name);
    const hilang = namaPg.filter((k) => !namaSqlite.has(k));
    if (hilang.length) catatan.push(`${t}: kolom Postgres tidak punya padanan di SQLite dan TIDAK ikut: ${hilang.join(', ')}`);
    const pakai = kolom.filter((c) => namaPg.includes(c.name));

    db.exec(`DELETE FROM ${t}`);   // db.js bisa menanam akun bawaan; datanya dari Supabase saja
    const sql = `INSERT INTO ${t} (${pakai.map((c) => c.name).join(',')}) VALUES (${pakai.map(() => '?').join(',')})`;
    const stmt = db.prepare(sql);
    for (const r of baris) {
      stmt.run(...pakai.map((c) => nilaiSqlite(r[c.name], c)));
    }
    jumlahSqlite[t] = db.prepare(`SELECT count(*) n FROM ${t}`).get().n;
  }
  /* users.id AUTOINCREMENT: lanjutkan dari id terbesar, bukan dari 1. */
  const maks = db.prepare('SELECT max(id) m FROM users').get().m || 0;
  db.exec(`INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES ('users', ${maks})`);
  db.exec('COMMIT');
} catch (e) {
  db.exec('ROLLBACK');
  db.close();
  fs.rmSync(SCRATCH, { recursive: true, force: true });
  await kolam.end();
  gagal('Gagal menyalin tabel: ' + e.message);
}
db.exec('PRAGMA foreign_keys = ON');
const fkRusak = db.prepare('PRAGMA foreign_key_check').all();
if (fkRusak.length) catatan.push(`foreign_key_check menemukan ${fkRusak.length} baris yatim (induknya tidak ada): ${JSON.stringify(fkRusak.slice(0, 5))}`);
db.close();
console.log('✓ Tabel tersalin');

/** Postgres → SQLite: boolean jadi 0/1, bigint (datang sebagai string) jadi angka, null jadi bawaan kolom. */
function nilaiSqlite(v, kolom) {
  if (v === null || v === undefined) {
    if (!kolom.notnull) return null;
    return /INT|REAL|NUM/i.test(kolom.type) ? 0 : '';
  }
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (/INT/i.test(kolom.type) && typeof v === 'string' && /^-?\d+$/.test(v)) return Number(v);
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}

/* ============== 3. avenger_state → BERKAS ============== */
let stateDitulis = 0;
for (const { kunci, isi } of stateRows) {
  if (kunci.includes('..') || path.isAbsolute(kunci)) { catatan.push(`kunci avenger_state mencurigakan dilewati: ${kunci}`); continue; }
  const tujuan = path.join(ROOT, kunci);
  cadangkan(tujuan);
  let teks = isi;
  try { teks = JSON.stringify(JSON.parse(isi), null, 2) + '\n'; } catch { catatan.push(`${kunci}: isinya bukan JSON sah, ditulis apa adanya`); }
  fs.mkdirSync(path.dirname(tujuan), { recursive: true });
  fs.writeFileSync(tujuan, teks, 'utf8');
  stateDitulis++;
}
console.log(`✓ avenger_state: ${stateDitulis} dokumen ditulis`);

/* ============== 4. STORAGE → DISK ============== */
const hasilBerkas = { diunduh: 0, dilewati: 0, gagal: [] , byte: 0 };
if (!TANPA_BERKAS) {
  await unduhBucket(BUCKET_ELOG, (nama) => path.join(ELOG, 'uploads', nama));
  await unduhBucket(BUCKET_AVENGER, (nama) => path.join(ROOT, nama));
  console.log(`✓ Storage: ${hasilBerkas.diunduh} diunduh (${(hasilBerkas.byte / 1e6).toFixed(1)} MB), ${hasilBerkas.dilewati} sudah ada, ${hasilBerkas.gagal.length} gagal`);
}

/** Daftar objek satu bucket. Lewat SQL ke storage.objects — satu kueri, rekursif dengan sendirinya. */
async function daftarObjek(bucket) {
  const rows = await q(`SELECT name, (metadata->>'size')::bigint AS ukuran FROM storage.objects WHERE bucket_id=$1 ORDER BY name`, [bucket]);
  return rows.map((r) => ({ nama: r.name, ukuran: Number(r.ukuran || 0) }));
}

async function unduhBucket(bucket, tujuanUntuk) {
  const daftar = await daftarObjek(bucket);
  const antrean = daftar.slice();
  const pekerja = Array.from({ length: 6 }, async () => {
    for (let o = antrean.shift(); o; o = antrean.shift()) {
      if (o.nama.includes('..')) { hasilBerkas.gagal.push(o.nama + ' (nama mencurigakan)'); continue; }
      const tujuan = tujuanUntuk(o.nama);
      try {
        const st = fs.statSync(tujuan);
        if (st.size === o.ukuran) { hasilBerkas.dilewati++; continue; }
      } catch { /* belum ada */ }
      try {
        const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${o.nama.split('/').map(encodeURIComponent).join('/')}`, {
          headers: { Authorization: 'Bearer ' + SERVICE_KEY, apikey: SERVICE_KEY }
        });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const buf = Buffer.from(await r.arrayBuffer());
        fs.mkdirSync(path.dirname(tujuan), { recursive: true });
        fs.writeFileSync(tujuan, buf);
        hasilBerkas.diunduh++; hasilBerkas.byte += buf.length;
      } catch (e) {
        hasilBerkas.gagal.push(`${bucket}/${o.nama}: ${e.message}`);
      }
    }
  });
  await Promise.all(pekerja);
  process.stdout.write(`  ${bucket}: ${daftar.length} objek diproses\n`);
}

/* ============== 5. PASANG SQLITE BARU ============== */
const DB_LAMA = path.join(ELOG, 'data', 'elogbook.db');
for (const akhiran of ['', '-wal', '-shm']) cadangkan(DB_LAMA + akhiran);
fs.renameSync(path.join(SCRATCH, 'elogbook.db'), DB_LAMA);
fs.rmSync(SCRATCH, { recursive: true, force: true });
console.log('✓ elogbook/data/elogbook.db dipasang');

/** Pindahkan berkas yang sudah ada ke folder cadangan, dengan jalur relatifnya. */
function cadangkan(berkas) {
  if (!fs.existsSync(berkas)) return;
  const tujuan = path.join(CADANGAN, path.relative(ROOT, berkas));
  fs.mkdirSync(path.dirname(tujuan), { recursive: true });
  fs.renameSync(berkas, tujuan);
}

/* ============== 6. LAPORAN ============== */
await kolam.end();
console.log('\nJumlah baris  Supabase → SQLite');
let beda = 0;
for (const t of TABEL) {
  const a = jumlahPg[t], b = jumlahSqlite[t] ?? '-';
  if (a !== b) beda++;
  console.log(`  ${t.padEnd(14)} ${String(a).padStart(5)} → ${String(b).padStart(5)} ${a === b ? '' : '  ← BEDA'}`);
}
if (hasilBerkas.gagal.length) { console.log('\nBerkas gagal diunduh:'); for (const g of hasilBerkas.gagal) console.log('  ' + g); }
if (catatan.length) { console.log('\nCatatan:'); for (const c of catatan) console.log('  • ' + c); }
if (fs.existsSync(CADANGAN)) console.log(`\nData lokal lama dipindahkan ke ${path.relative(ROOT, CADANGAN)}/`);
console.log(beda || hasilBerkas.gagal.length ? '\n⚠ Selesai dengan perbedaan — periksa di atas.' : '\n✓ Selesai. Jalankan `npm start` lalu buka http://localhost:3100/logbook/');
