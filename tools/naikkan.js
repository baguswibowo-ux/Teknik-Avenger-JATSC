/**
 * NAIKKAN SIMPANAN AVENGER KE SUPABASE
 *
 * Menyalin apa yang sekarang ada di data/ dan public/foto/ ke tabel
 * avenger_state dan bucket avenger. Ini langkah E di DEPLOY.md Bagian 8.
 *
 * KERING DULU, SELALU
 *
 * Tanpa argumen, alat ini tidak menulis apa pun — ia cuma menyebutkan apa yang
 * AKAN naik, berapa besarnya, dan mana yang sudah ada di sana. Baru dengan
 * --gas ia benar-benar menulis. Menaikkan data adalah tindakan yang pantas
 * dilihat dulu bentuknya, bukan dijalankan lalu diperiksa belakangan.
 *
 * YANG TIDAK DILAKUKAN ALAT INI
 *
 * Ia tidak menghapus apa pun, baik di Supabase maupun di disk. Berkas asli
 * tetap di tempatnya. Kalau hasilnya keliru, yang perlu dibereskan cuma yang di
 * Supabase — sumbernya tidak tersentuh.
 *
 * Ia juga tidak menimpa diam-diam: dokumen atau berkas yang sudah ada di sana
 * dilewati, kecuali diminta --timpa.
 *
 * JALANKAN
 *
 *   node tools/naikkan.js              lihat dulu apa yang akan naik
 *   node tools/naikkan.js --gas        naikkan
 *   node tools/naikkan.js --gas --timpa   naikkan, termasuk yang sudah ada
 *
 * Setelan diambil dari .env di akar Avenger kalau ada; kalau tidak, dari
 * elogbook/.env, karena databasenya memang satu dan sama.
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const GAS = process.argv.includes('--gas');
const TIMPA = process.argv.includes('--timpa');

/* ---------- setelan ---------- */

function muatEnv() {
  const calon = [path.join(ROOT, '.env'), path.join(ROOT, 'elogbook', '.env')];
  const dipakai = calon.find((c) => existsSync(c));
  if (!dipakai) return null;
  for (const baris of readFileSync(dipakai, 'utf8').split(/\r?\n/)) {
    const m = baris.match(/^\s*([A-Z_][A-Z_0-9]*)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return dipakai;
}

const dariEnv = muatEnv();
process.env.AVENGER_DB = 'postgres';   // alat ini memang hanya untuk jalur tabel

const kurang = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY']
  .filter((k) => !process.env[k]);
if (kurang.length) {
  console.error('Belum lengkap: ' + kurang.join(', ') + '.');
  console.error(dariEnv ? 'Dibaca dari ' + dariEnv : 'Tidak ada .env yang ditemukan.');
  process.exit(1);
}

const { bacaJson, tulisJson, bacaBiner, tulisBiner, mimeDari, kunciDari } =
  await import('../simpanan.js');

/* ---------- apa yang naik ---------- */

/** Semua berkas di bawah satu folder, rekursif. Folder yang tidak ada bukan
    kesalahan — Avenger yang belum pernah dipakai memang belum punya isinya. */
async function isiFolder(folder) {
  const hasil = [];
  async function telusuri(dir) {
    let entri;
    try {
      entri = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entri) {
      const penuh = path.join(dir, e.name);
      if (e.isDirectory()) await telusuri(penuh);
      else hasil.push(penuh);
    }
  }
  await telusuri(folder);
  return hasil.sort();
}

const rapi = (n) => n < 1024 ? n + ' B'
  : n < 1024 * 1024 ? (n / 1024).toFixed(1) + ' KB'
  : (n / 1024 / 1024).toFixed(1) + ' MB';

const berkasSemua = [
  ...await isiFolder(path.join(ROOT, 'data')),
  ...await isiFolder(path.join(ROOT, 'public', 'foto'))
];

/* Berkas sementara sisa penulisan yang terputus tidak pernah pantas naik —
   isinya menurut definisi belum utuh. */
const kandidat = berkasSemua.filter((b) => !b.endsWith('.tmp'));

const dokumen = kandidat.filter((b) => b.toLowerCase().endsWith('.json'));
const biner = kandidat.filter((b) => !b.toLowerCase().endsWith('.json'));

/* ---------- kerjakan ---------- */

console.log(GAS ? '== MENAIKKAN ==' : '== KERING: tidak ada yang ditulis ==');
console.log('Setelan dari: ' + dariEnv);
console.log('Bucket: ' + (process.env.AVENGER_BUCKET || 'avenger') + '\n');

let naik = 0, lewat = 0, gagal = 0;

console.log('DOKUMEN JSON -> tabel avenger_state');
for (const b of dokumen) {
  const kunci = kunciDari(b);
  let isi;
  try {
    isi = JSON.parse(await fs.readFile(b, 'utf8'));
  } catch (e) {
    console.log('  GAGAL BACA  ' + kunci + ' — ' + (e?.message || e));
    gagal++;
    continue;
  }
  const ukuran = rapi((await fs.stat(b)).size);

  /* Penanda unik dipakai untuk membedakan "sudah ada" dari "isinya memang
     null" — tanpa itu dokumen yang sah bernilai null akan disangka belum ada
     lalu ditimpa. */
  const belum = Symbol('belum');
  const sudah = await bacaJson(b, belum) !== belum;
  if (sudah && !TIMPA) {
    console.log('  sudah ada   ' + kunci + '  (' + ukuran + ') — dilewati');
    lewat++;
    continue;
  }
  if (!GAS) {
    console.log('  akan naik   ' + kunci + '  (' + ukuran + ')' + (sudah ? ' — MENIMPA' : ''));
    naik++;
    continue;
  }
  try {
    await tulisJson(b, isi, 'naikkan.js');
    console.log('  naik        ' + kunci + '  (' + ukuran + ')' + (sudah ? ' — ditimpa' : ''));
    naik++;
  } catch (e) {
    console.log('  GAGAL       ' + kunci + ' — ' + (e?.message || e));
    gagal++;
  }
}

console.log('\nBERKAS BINER -> bucket');
for (const b of biner) {
  const kunci = kunciDari(b);
  const ukuran = rapi((await fs.stat(b)).size);
  let sudah = false;
  try {
    sudah = !!(await bacaBiner(b));
  } catch { /* simpanan tidak terjawab: diperlakukan sebagai belum ada */ }
  if (sudah && !TIMPA) {
    console.log('  sudah ada   ' + kunci + '  (' + ukuran + ') — dilewati');
    lewat++;
    continue;
  }
  if (!GAS) {
    console.log('  akan naik   ' + kunci + '  (' + ukuran + ')' + (sudah ? ' — MENIMPA' : ''));
    naik++;
    continue;
  }
  try {
    await tulisBiner(b, await fs.readFile(b), mimeDari(b));
    console.log('  naik        ' + kunci + '  (' + ukuran + ')' + (sudah ? ' — ditimpa' : ''));
    naik++;
  } catch (e) {
    console.log('  GAGAL       ' + kunci + ' — ' + (e?.message || e));
    gagal++;
  }
}

console.log('\n' + (GAS ? 'Naik: ' : 'Akan naik: ') + naik
  + ' · dilewati: ' + lewat + ' · gagal: ' + gagal);
if (!GAS) console.log('Jalankan lagi dengan --gas kalau daftar di atas sudah benar.');
process.exit(gagal ? 1 : 0);
