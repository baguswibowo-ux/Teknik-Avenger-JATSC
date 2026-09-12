/**
 * SALIN DATA PRODUKSI KE SEBUAH SALINAN UJI.
 *
 *   node elogbook/tools/siapkan-uji.mjs --dari "D:\Airnav\2026\Teknik JATSC Avenger"
 *   node elogbook/tools/siapkan-uji.mjs --dari <folder produksi> --timpa
 *
 * Kenapa ada alat ini. Tiap perubahan harus bisa dicoba dengan data sungguhan
 * sebelum dipasang, dan menyalin `elogbook.db` dengan Copy-Item SALAH: server
 * produksi memakai WAL, jadi berkas .db saja tertinggal beberapa jam di
 * belakang -shm/-wal yang tidak ikut tersalin. VACUUM INTO membaca database
 * yang sedang hidup lewat SQLite sendiri dan menulis satu berkas utuh yang
 * sudah menyertakan isi WAL — tanpa mengunci, tanpa menghentikan produksi.
 *
 * Produksi hanya DIBACA. Tujuannya wajib folder lain (worktree); menyalin ke
 * folder yang sama dengan sumbernya ditolak.
 *
 * Yang disalin: elogbook/data/elogbook.db dan elogbook/uploads. Berkas dashboard
 * di data/ akar TIDAK ikut — server uji ini menjalankan E-Logbook saja.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const TUJUAN_ELOG = path.resolve(DIR, '..');                 // …/elogbook di worktree ini

const arg = process.argv.slice(2);
const ambil = (nama) => {
  const i = arg.indexOf(nama);
  return i >= 0 ? arg[i + 1] : '';
};
const timpa = arg.includes('--timpa');
const dariAkar = ambil('--dari');

if (!dariAkar) {
  console.error('Sebutkan folder produksinya:');
  console.error('  node elogbook/tools/siapkan-uji.mjs --dari "D:\\Airnav\\2026\\Teknik JATSC Avenger"');
  process.exit(1);
}

const sumberElog = path.join(path.resolve(dariAkar), 'elogbook');
const sumberDb = path.join(sumberElog, 'data', 'elogbook.db');
const sumberUpload = path.join(sumberElog, 'uploads');
const tujuanDb = path.join(TUJUAN_ELOG, 'data', 'elogbook.db');
const tujuanUpload = path.join(TUJUAN_ELOG, 'uploads');

if (path.resolve(sumberElog).toLowerCase() === path.resolve(TUJUAN_ELOG).toLowerCase()) {
  console.error('Sumber dan tujuan folder yang sama — alat ini untuk menyalin ke worktree lain.');
  process.exit(1);
}
if (!fs.existsSync(sumberDb)) {
  console.error('Tidak ketemu: ' + sumberDb);
  process.exit(1);
}
if (fs.existsSync(tujuanDb) && !timpa) {
  console.error('Sudah ada ' + tujuanDb + ' — tambahkan --timpa kalau memang mau diganti.');
  process.exit(1);
}

const mb = (b) => (b / 1048576).toFixed(1) + ' MB';

/* VACUUM INTO menolak berkas tujuan yang sudah ada. */
fs.mkdirSync(path.dirname(tujuanDb), { recursive: true });
for (const ekor of ['', '-shm', '-wal']) {
  try { fs.rmSync(tujuanDb + ekor); } catch { /* belum ada: lewati */ }
}

/* readonly: apa pun yang terjadi di sini tidak boleh sampai ke produksi. */
const dbSumber = new DatabaseSync(sumberDb, { readOnly: true });
try {
  dbSumber.exec(`VACUUM INTO '${tujuanDb.replace(/'/g, "''")}'`);
} finally {
  dbSumber.close();
}
console.log('Database  : ' + tujuanDb + '  (' + mb(fs.statSync(tujuanDb).size) + ')');

if (fs.existsSync(sumberUpload)) {
  fs.rmSync(tujuanUpload, { recursive: true, force: true });
  fs.cpSync(sumberUpload, tujuanUpload, { recursive: true });
  const jumlah = fs.readdirSync(tujuanUpload).length;
  console.log('Lampiran  : ' + tujuanUpload + '  (' + jumlah + ' berkas)');
} else {
  console.log('Lampiran  : sumbernya tidak ada — dilewati.');
}

console.log('\nSelesai. Salinan ini terpisah penuh dari produksi: menyuntingnya tidak');
console.log('mengubah apa pun di ' + sumberElog);
