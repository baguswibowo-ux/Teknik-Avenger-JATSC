/**
 * SALIN DATA PRODUKSI KE SEBUAH SALINAN UJI.
 *
 *   node elogbook/tools/siapkan-uji.mjs --dari "D:\Airnav\2026\Teknik JATSC Avenger"
 *   node elogbook/tools/siapkan-uji.mjs --dari <folder produksi> --timpa
 *   node elogbook/tools/siapkan-uji.mjs --dari <folder produksi> --tanpa-foto
 *
 * Kenapa ada alat ini. Tiap perubahan harus bisa dicoba dengan data sungguhan
 * sebelum dipasang, dan yang diuji adalah APLIKASI UTUH — dashboard dengan
 * E-Logbook di /logbook/, sama seperti produksi. Jadi yang disalin bukan hanya
 * database E-Logbook:
 *
 *   elogbook/data/elogbook.db  database E-Logbook (VACUUM INTO)
 *   elogbook/uploads           lampiran formulir
 *   data/                      punya dashboard: dinas, dokumen, personel, hak
 *   public/foto               galeri wajah (boleh dilewati, --tanpa-foto)
 *
 * Menyalin `elogbook.db` dengan Copy-Item SALAH: server produksi memakai WAL,
 * jadi berkas .db saja tertinggal beberapa jam di belakang -shm/-wal yang tidak
 * ikut tersalin. VACUUM INTO membaca database yang sedang hidup lewat SQLite
 * sendiri dan menulis satu berkas utuh yang sudah menyertakan isi WAL — tanpa
 * mengunci, tanpa menghentikan produksi. Berkas JSON dashboard disalin biasa:
 * kecil, dan ditulis sekali-jadi.
 *
 * Produksi hanya DIBACA. Tujuannya wajib folder lain (worktree); menyalin ke
 * folder yang sama dengan sumbernya ditolak.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const TUJUAN_AKAR = path.resolve(DIR, '..', '..');            // tools -> elogbook -> akar

const arg = process.argv.slice(2);
const ambil = (nama) => {
  const i = arg.indexOf(nama);
  return i >= 0 ? arg[i + 1] : '';
};
const timpa = arg.includes('--timpa');
const tanpaFoto = arg.includes('--tanpa-foto');
const dariAkar = ambil('--dari');

if (!dariAkar) {
  console.error('Sebutkan folder produksinya:');
  console.error('  node elogbook/tools/siapkan-uji.mjs --dari "D:\\Airnav\\2026\\Teknik JATSC Avenger"');
  process.exit(1);
}

const SUMBER_AKAR = path.resolve(dariAkar);
if (SUMBER_AKAR.toLowerCase() === TUJUAN_AKAR.toLowerCase()) {
  console.error('Sumber dan tujuan folder yang sama — alat ini untuk menyalin ke worktree lain.');
  process.exit(1);
}

const sumberDb = path.join(SUMBER_AKAR, 'elogbook', 'data', 'elogbook.db');
const tujuanDb = path.join(TUJUAN_AKAR, 'elogbook', 'data', 'elogbook.db');
if (!fs.existsSync(sumberDb)) {
  console.error('Tidak ketemu: ' + sumberDb);
  process.exit(1);
}
if (fs.existsSync(tujuanDb) && !timpa) {
  console.error('Sudah ada ' + tujuanDb + ' — tambahkan --timpa kalau memang mau diganti.');
  process.exit(1);
}

const mb = (b) => (b / 1048576).toFixed(1) + ' MB';

/** Besar sebuah folder, untuk laporan di layar saja. */
function besarFolder(dir) {
  let jumlah = 0;
  for (const it of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (it.isFile()) {
      try { jumlah += fs.statSync(path.join(it.parentPath || it.path, it.name)).size; } catch { /* lewati */ }
    }
  }
  return jumlah;
}

/** Salin satu folder apa adanya, menimpa isi lama. */
function salinFolder(nama, relatif) {
  const sumber = path.join(SUMBER_AKAR, relatif);
  const tujuan = path.join(TUJUAN_AKAR, relatif);
  if (!fs.existsSync(sumber)) {
    console.log(nama.padEnd(10) + ': sumbernya tidak ada — dilewati.');
    return;
  }
  fs.rmSync(tujuan, { recursive: true, force: true });
  fs.cpSync(sumber, tujuan, { recursive: true });
  console.log(nama.padEnd(10) + ': ' + tujuan + '  (' + mb(besarFolder(tujuan)) + ')');
}

/* --- Database E-Logbook. VACUUM INTO menolak berkas tujuan yang sudah ada. --- */
fs.mkdirSync(path.dirname(tujuanDb), { recursive: true });
for (const ekor of ['', '-shm', '-wal']) {
  try { fs.rmSync(tujuanDb + ekor); } catch { /* belum ada: lewati */ }
}
/* readOnly: apa pun yang terjadi di sini tidak boleh sampai ke produksi. */
const dbSumber = new DatabaseSync(sumberDb, { readOnly: true });
try {
  dbSumber.exec(`VACUUM INTO '${tujuanDb.replace(/'/g, "''")}'`);
} finally {
  dbSumber.close();
}
console.log('Database  : ' + tujuanDb + '  (' + mb(fs.statSync(tujuanDb).size) + ')');

salinFolder('Lampiran', path.join('elogbook', 'uploads'));
salinFolder('Dashboard', 'data');
if (tanpaFoto) console.log('Foto      : dilewati (--tanpa-foto).');
else salinFolder('Foto', path.join('public', 'foto'));

console.log('\nSelesai. Salinan ini terpisah penuh dari produksi: menyuntingnya tidak');
console.log('mengubah apa pun di ' + SUMBER_AKAR);
