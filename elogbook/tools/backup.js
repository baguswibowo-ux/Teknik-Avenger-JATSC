/**
 * Backup database + tanda tangan.
 *
 *   npm run backup
 *
 * Hasilnya: backup/YYYY-MM-DD_HHmm/elogbook.db + uploads/
 * Aman dijalankan selagi server hidup — memakai "VACUUM INTO" milik SQLite,
 * yang menghasilkan salinan utuh, bukan sekadar menyalin berkas yang bisa
 * tertangkap di tengah penulisan.
 *
 * Simpan hasilnya ke media lain (share folder / hard disk terpisah) —
 * backup di mesin yang sama tidak menolong kalau mesinnya rusak.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, UPLOAD_DIR } from '../db.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const BACKUP_ROOT = process.env.ELOGBOOK_BACKUP_DIR || path.join(ROOT, 'backup');
const SIMPAN_HARI = Number(process.env.ELOGBOOK_BACKUP_KEEP_DAYS || 30);

// UTC, sama seperti seluruh waktu di aplikasi — supaya nama folder backup bisa
// langsung dicocokkan dengan tanggal pada catatan tanpa menghitung selisih zona.
const iso = new Date().toISOString();
const stamp = `${iso.slice(0, 10)}_${iso.slice(11, 13)}${iso.slice(14, 16)}Z`;
const tujuan = path.join(BACKUP_ROOT, stamp);

fs.mkdirSync(tujuan, { recursive: true });

// VACUUM INTO menolak menimpa berkas yang sudah ada, jadi pastikan bersih.
const dbTujuan = path.join(tujuan, 'elogbook.db');
if (fs.existsSync(dbTujuan)) fs.unlinkSync(dbTujuan);
db.exec(`VACUUM INTO '${dbTujuan.replace(/'/g, "''")}'`);

if (fs.existsSync(UPLOAD_DIR)) {
  fs.cpSync(UPLOAD_DIR, path.join(tujuan, 'uploads'), { recursive: true });
}

const ukuranDb = (fs.statSync(dbTujuan).size / 1024).toFixed(0);
console.log(`Backup selesai: ${tujuan}  (database ${ukuranDb} KB)`);

/* ---------- Buang backup lama ---------- */
if (SIMPAN_HARI > 0) {
  const batas = Date.now() - SIMPAN_HARI * 864e5;
  let dibuang = 0;
  for (const nama of fs.readdirSync(BACKUP_ROOT)) {
    const f = path.join(BACKUP_ROOT, nama);
    if (f === tujuan) continue;
    const st = fs.statSync(f);
    if (st.isDirectory() && st.mtimeMs < batas) {
      fs.rmSync(f, { recursive: true, force: true });
      dibuang++;
    }
  }
  if (dibuang) console.log(`${dibuang} backup lebih tua dari ${SIMPAN_HARI} hari dihapus.`);
}
