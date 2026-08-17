/**
 * Pindahkan seluruh isi database SQLite ke Supabase, sekaligus mengunggah
 * tanda tangan dan lampiran dari folder uploads/ ke Supabase Storage.
 *
 *   npm run migrasi              lihat rencananya saja, tidak menulis apa pun
 *   npm run migrasi -- --jalan   benar-benar memindahkan
 *
 * Password pengguna ikut pindah apa adanya (hash + salt), jadi semua orang
 * tetap masuk dengan password yang sudah mereka pakai. Tidak ada yang perlu
 * disetel ulang.
 *
 * Aman diulang: kalau dijalankan dua kali, baris yang sudah ada dilewati.
 * Membaca kredensial dari .env, sama seperti server.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
try { process.loadEnvFile(path.join(ROOT, '.env')); } catch { /* nanti diperiksa di bawah */ }

const JALAN = process.argv.includes('--jalan');

const SQLITE_FILE = process.env.ELOGBOOK_DATA_DIR
  ? path.join(process.env.ELOGBOOK_DATA_DIR, 'elogbook.db')
  : path.join(ROOT, 'data', 'elogbook.db');
const UPLOAD_DIR = process.env.ELOGBOOK_UPLOAD_DIR || path.join(ROOT, 'uploads');

if (!fs.existsSync(SQLITE_FILE)) {
  console.error(`Database SQLite tidak ditemukan di:\n  ${SQLITE_FILE}`);
  process.exit(1);
}
for (const k of ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY']) {
  if (!process.env[k]) { console.error(`${k} belum diisi di .env.`); process.exit(1); }
}

// db-pg.js menolak dimuat tanpa DATABASE_URL, jadi impornya setelah pemeriksaan.
const { pool, unggahBerkas } = await import('../db-pg.js');

const sq = new DatabaseSync(SQLITE_FILE, { readOnly: true });
const ambil = (sql) => sq.prepare(sql).all();

const q = async (sql, params = []) => (await pool.query(sql, params)).rows;

console.log(`Sumber : ${SQLITE_FILE}`);
console.log(`Tujuan : ${process.env.SUPABASE_URL}`);
console.log(JALAN ? 'Mode   : MEMINDAHKAN\n' : 'Mode   : LIHAT SAJA (tambahkan --jalan untuk benar-benar memindahkan)\n');

/* ---------- 1. Pengguna ----------
 * Kolom id di Postgres berurut sendiri, jadi id lama belum tentu sama.
 * Petanya disimpan untuk membetulkan user_unit. */

const penggunaSqlite = ambil('SELECT * FROM users ORDER BY id');
const petaUser = new Map();
let userBaru = 0, userDiperbarui = 0;

for (const u of penggunaSqlite) {
  const ada = (await q('SELECT id FROM users WHERE lower(username) = lower($1)', [u.username]))[0];

  if (ada) {
    // Username yang sama sudah ada di Supabase — biasanya akun "admin" bawaan
    // yang terbentuk otomatis saat database masih kosong, dengan password
    // sementara. Sistem kantor yang jadi acuan, jadi datanya ditimpa supaya
    // semua orang tetap masuk dengan password yang selama ini dipakai.
    if (JALAN) {
      await q(
        `UPDATE users SET nama=$1, role=$2, pass_hash=$3, pass_salt=$4, aktif=$5 WHERE id=$6`,
        [u.nama, u.role, u.pass_hash, u.pass_salt, !!u.aktif, ada.id]
      );
    }
    petaUser.set(u.id, ada.id);
    userDiperbarui++;
    continue;
  }

  if (JALAN) {
    const baru = (await q(
      `INSERT INTO users (username, nama, role, pass_hash, pass_salt, aktif, dibuat_pada)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [u.username, u.nama, u.role, u.pass_hash, u.pass_salt, !!u.aktif, u.dibuat_pada]
    ))[0];
    petaUser.set(u.id, baru.id);
  } else {
    // Mode lihat-saja: id belum ada, tetapi tetap dipetakan supaya hitungan
    // hak unit di bawah menunjukkan angka sebenarnya.
    petaUser.set(u.id, -1);
  }
  userBaru++;
}
console.log(`Pengguna      : ${userBaru} baru, ${userDiperbarui} diperbarui (password ikut pindah)`);

/* ---------- 2. Hak akses unit ---------- */

let unitBaru = 0;
for (const r of ambil('SELECT * FROM user_unit')) {
  const idBaru = petaUser.get(r.user_id);
  if (idBaru === undefined) continue;
  if (JALAN) {
    await q('INSERT INTO user_unit (user_id, unit) VALUES ($1,$2) ON CONFLICT DO NOTHING',
            [idBaru, r.unit]);
  }
  unitBaru++;
}
console.log(`Hak unit      : ${unitBaru}`);

/* ---------- 3. Berkas ke Supabase Storage ----------
 * Nama berkas dipertahankan supaya path yang tersimpan di database tetap sah. */

const berkasDipakai = new Set();
const catatPath = (p) => { if (p && String(p).startsWith('/uploads/')) berkasDipakai.add(String(p).slice(9)); };

for (const e of ambil('SELECT teknisi_ttd, pj_ttd FROM entries')) { catatPath(e.teknisi_ttd); catatPath(e.pj_ttd); }
for (const d of ambil('SELECT teknisi_ttd, manager_ttd FROM dailychecks')) { catatPath(d.teknisi_ttd); catatPath(d.manager_ttd); }
for (const m of ambil('SELECT teknisi_ttd, personil_ops_ttd FROM monitoring')) { catatPath(m.teknisi_ttd); catatPath(m.personil_ops_ttd); }
for (const l of ambil('SELECT manager_ttd, teknisi_ttd FROM ltk')) { catatPath(l.manager_ttd); catatPath(l.teknisi_ttd); }
for (const d of ambil('SELECT teknisi_ttd, manager_ttd FROM dstest')) { catatPath(d.teknisi_ttd); catatPath(d.manager_ttd); }
for (const t of ['lampiran', 'lampiran_isu', 'lampiran_ltk']) {
  for (const l of ambil(`SELECT path FROM ${t}`)) catatPath(l.path);
}

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
               '.webp': 'image/webp', '.pdf': 'application/pdf' };

let berkasNaik = 0, berkasHilang = 0;
for (const nama of berkasDipakai) {
  const lokal = path.join(UPLOAD_DIR, nama);
  if (!fs.existsSync(lokal)) { berkasHilang++; continue; }
  if (JALAN) {
    await unggahBerkas(nama, fs.readFileSync(lokal), MIME[path.extname(nama).toLowerCase()] || 'application/octet-stream');
  }
  berkasNaik++;
}
console.log(`Berkas        : ${berkasNaik} diunggah${berkasHilang ? `, ${berkasHilang} tidak ditemukan di uploads/` : ''}`);

/* ---------- 4. Tabel data ----------
 * Kolomnya sama persis antara SQLite dan Postgres, jadi disalin apa adanya.
 * Urutannya penting: induk dulu, baru lampirannya. */

const TABEL = [
  'entries', 'dailychecks', 'issues', 'monitoring', 'ltk', 'dstest',
  'lampiran', 'lampiran_isu', 'lampiran_ltk'
];

for (const tabel of TABEL) {
  const baris = ambil(`SELECT * FROM ${tabel}`);
  if (baris.length === 0) { console.log(`${tabel.padEnd(14)}: 0`); continue; }

  let masuk = 0, lewat = 0;
  for (const r of baris) {
    const ada = (await q(`SELECT 1 FROM ${tabel} WHERE id = $1`, [r.id]))[0];
    if (ada) { lewat++; continue; }
    if (JALAN) {
      const kolom = Object.keys(r);
      const tanda = kolom.map((_, i) => '$' + (i + 1)).join(',');
      await q(`INSERT INTO ${tabel} (${kolom.join(',')}) VALUES (${tanda})`,
              kolom.map((k) => r[k]));
    }
    masuk++;
  }
  console.log(`${tabel.padEnd(14)}: ${masuk} dipindah${lewat ? `, ${lewat} sudah ada` : ''}`);
}

sq.close();
await pool.end();

console.log(JALAN
  ? '\nSelesai. Periksa hasilnya dengan membuka aplikasi memakai ELOGBOOK_DB=postgres.'
  : '\nItu baru rencana. Jalankan lagi dengan --jalan untuk benar-benar memindahkan.');
