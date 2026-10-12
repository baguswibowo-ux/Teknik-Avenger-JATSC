/**
 * GABUNG NAMA PANGGILAN LAMA KE NAMA AKUNNYA.
 *
 *   node elogbook/tools/gabung-nama-lama.mjs                  lihat rencananya saja
 *   node elogbook/tools/gabung-nama-lama.mjs --terapkan       benar-benar menulis
 *   node elogbook/tools/gabung-nama-lama.mjs --kembalikan <berkas cadangan>
 *   ... --db <berkas .db>                                     database lain
 *
 * Kenapa ada alat ini. Sampai akhir Agustus 2026 nama pelaksana di logbook
 * Radtel diketik bebas: "Yoga", "Agista", "Berry PL", "Tony E.P.". Sesudah itu
 * nama diambil dari akun. Akibatnya rekap pengalaman memecah satu orang jadi
 * beberapa baris, dan pengalaman Agustus-nya tidak terhitung pada namanya yang
 * sekarang. Alat ini mengganti nama lama itu dengan nama akunnya — catatannya
 * sendiri tidak dihapus dan isinya tidak disentuh.
 *
 * Yang diubah hanya tiga kolom: entries.teknisi_nama_list, entries.teknisi_nama,
 * dan issues.dilaporkan_oleh — dan hanya pada unit di PETA.
 *
 * Tanpa --terapkan tidak ada yang ditulis. Dengan --terapkan, nilai lama tiap
 * baris yang berubah disimpan dulu ke berkas cadangan di samping database, dan
 * --kembalikan memasangnya lagi.
 *
 * Tanpa --db, yang dipakai database di pohon berkas tempat alat ini berada
 * (atau ELOGBOOK_DATA_DIR kalau disetel) — jadi dijalankan dari folder uji ia
 * mengubah data uji, bukan produksi.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

/**
 * nama akun -> nama-nama lama yang ternyata orang yang sama. Pencocokannya
 * mengabaikan huruf besar-kecil dan spasi berlebih. Nama lama yang tidak ada di
 * sini (Sarman, Deon, Tito) tidak punya akun dan dibiarkan apa adanya.
 *
 * "Agit" dan "Ryan" tidak terang dari namanya saja; keduanya dipastikan dari
 * siapa yang menulis catatannya dan dengan siapa ia berdinas.
 */
const PETA = {
  radtel: {
    'Yoga Noer Pratama Putra': ['Yoga'],
    'Dwinta Agista Audyari Ismail': ['Agista', 'Dwinta Agista', 'Agista Audyari Ismail'],
    'Bagus Wibowo': ['Bagus'],
    'Gabriela Zahasyah Nagara Putri': ['Bela'],
    'Berry Poedjolaksono': ['Berry', 'Berry P', 'Berry PL'],
    'Cipto Hadi P.': ['Cipto'],
    'Fakhrizal Ahmad': ['Fakhrizal', 'Fahrizal', 'Fak'],
    'Yuki Novisasori': ['Yuki'],
    'Tony Edi Purnomo': ['Tony', 'Tony E.P.', 'Tony E.P', 'Toni Edy Purnomo', 'Tony Edy Purnomo'],
    'Yunika Br Kembaren': ['Yunika', 'Yunika Br Kembareno'],
    'Tri Wijayanto Untung Legowo': ['Untung', 'Untung (J)'],
    'Muhamad Dea Ahpi Ahdiat': ['Dea', 'Muh. Dea', 'Muh Dea Ahpi'],
    'Dhody Kurnia Sentosa': ['Dhody'],
    'Nidya Agita': ['Nidya', 'Agita', 'Agit'],
    'Riyan Pratomu Siregar': ['Riyan', 'Riyan P.', 'Riyan P', 'Ryan']
  }
};

const DIR = path.dirname(fileURLToPath(import.meta.url));
const arg = process.argv.slice(2);
const ambil = (nama) => {
  const i = arg.indexOf(nama);
  return i >= 0 ? arg[i + 1] : '';
};
const terapkan = arg.includes('--terapkan');
const berkasKembali = ambil('--kembalikan');
const dataDir = process.env.ELOGBOOK_DATA_DIR || path.resolve(DIR, '..', 'data');
const berkasDb = path.resolve(ambil('--db') || path.join(dataDir, 'elogbook.db'));

if (!fs.existsSync(berkasDb)) {
  console.error('Tidak ketemu: ' + berkasDb);
  process.exit(1);
}
console.log('Database : ' + berkasDb);

const kunci = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
const db = new DatabaseSync(berkasDb, { readOnly: !terapkan && !berkasKembali });
const ubahEntri = () => db.prepare('UPDATE entries SET teknisi_nama = ?, teknisi_nama_list = ? WHERE id = ?');
const ubahIsu = () => db.prepare('UPDATE issues SET dilaporkan_oleh = ? WHERE id = ?');

/** Semua tulisan dalam satu transaksi: gagal di tengah berarti tidak ada yang berubah. */
function dalamTransaksi(kerja) {
  db.exec('BEGIN IMMEDIATE');
  try { kerja(); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
}

if (berkasKembali) {
  const lama = JSON.parse(fs.readFileSync(berkasKembali, 'utf8'));
  dalamTransaksi(() => {
    const e = ubahEntri(), i = ubahIsu();
    for (const b of lama.entries) e.run(b.teknisi_nama, b.teknisi_nama_list, b.id);
    for (const b of lama.issues) i.run(b.dilaporkan_oleh, b.id);
  });
  console.log(`Dikembalikan: ${lama.entries.length} logbook, ${lama.issues.length} isu.`);
  process.exit(0);
}

/* --- Tujuan harus nama tepat SATU akun aktif; kalau tidak, pemetaannya dilewati. --- */
const jumlahAkun = new Map();
for (const a of db.prepare('SELECT nama FROM users WHERE aktif = 1').all()) {
  jumlahAkun.set(kunci(a.nama), (jumlahAkun.get(kunci(a.nama)) || 0) + 1);
}
const ganti = {};   // unit -> Map(kunci nama lama -> nama akun)
for (const [unit, peta] of Object.entries(PETA)) {
  ganti[unit] = new Map();
  for (const [akun, lamaList] of Object.entries(peta)) {
    if (jumlahAkun.get(kunci(akun)) !== 1) {
      console.log(`LEWATI   : "${akun}" bukan nama tepat satu akun aktif.`);
      continue;
    }
    for (const l of lamaList) ganti[unit].set(kunci(l), akun);
  }
}

const hitung = new Map();   // "lama -> baru" -> banyaknya
const catat = (lama, baru) => {
  const k = `${lama}  ->  ${baru}`;
  hitung.set(k, (hitung.get(k) || 0) + 1);
};
/** Nama pengganti, atau nama itu sendiri kalau tidak ada di peta. */
const baruDari = (unit, nama) => {
  const b = ganti[unit]?.get(kunci(nama));
  if (b && b !== nama) { catat(nama, b); return b; }
  return nama;
};

const cadangan = { dibuat: new Date().toISOString(), db: berkasDb, entries: [], issues: [] };
const rencanaEntri = [];
const rencanaIsu = [];
const tanda = Object.keys(ganti).map(() => '?').join(',');

for (const r of db.prepare(`SELECT id, unit, teknisi_nama, teknisi_nama_list FROM entries WHERE unit IN (${tanda})`).all(...Object.keys(ganti))) {
  let daftar = [];
  try { daftar = JSON.parse(r.teknisi_nama_list || '[]'); } catch { daftar = []; }
  if (!Array.isArray(daftar)) daftar = [];
  const punyaList = daftar.length > 0;
  // Catatan paling lama hanya punya nama tunggal berisi "A, B".
  if (!punyaList) daftar = String(r.teknisi_nama || '').split(',');
  const bersih = daftar.map((x) => String(x || '').trim()).filter(Boolean);
  // Dua nama lama bisa jatuh ke orang yang sama; ia cukup tercantum sekali.
  const baru = [...new Set(bersih.map((n) => baruDari(r.unit, n)))];
  if (baru.join('|') === bersih.join('|')) continue;
  cadangan.entries.push({ id: r.id, teknisi_nama: r.teknisi_nama, teknisi_nama_list: r.teknisi_nama_list });
  rencanaEntri.push([baru.join(', '), punyaList ? JSON.stringify(baru) : r.teknisi_nama_list, r.id]);
}

for (const r of db.prepare(`SELECT id, unit, dilaporkan_oleh FROM issues WHERE unit IN (${tanda})`).all(...Object.keys(ganti))) {
  const lama = String(r.dilaporkan_oleh || '').trim();
  if (!lama) continue;
  const baru = baruDari(r.unit, lama);
  if (baru === lama) continue;
  cadangan.issues.push({ id: r.id, dilaporkan_oleh: r.dilaporkan_oleh });
  rencanaIsu.push([baru, r.id]);
}

for (const [k, n] of [...hitung.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(String(n).padStart(5) + 'x  ' + k);
}
console.log(`\nBaris yang berubah: ${rencanaEntri.length} logbook, ${rencanaIsu.length} isu.`);

if (!terapkan) {
  console.log('Belum ada yang ditulis. Tambahkan --terapkan untuk menjalankannya.');
  process.exit(0);
}
if (!rencanaEntri.length && !rencanaIsu.length) process.exit(0);

const cap = cadangan.dibuat.replace(/[-:]/g, '').slice(0, 15);
const berkasCadangan = path.join(path.dirname(berkasDb), `cadangan-nama-lama-${cap}.json`);
fs.writeFileSync(berkasCadangan, JSON.stringify(cadangan));
dalamTransaksi(() => {
  const e = ubahEntri(), i = ubahIsu();
  for (const b of rencanaEntri) e.run(...b);
  for (const b of rencanaIsu) i.run(...b);
});
console.log('Tertulis. Nilai lamanya: ' + berkasCadangan);
console.log('Membatalkan: node elogbook/tools/gabung-nama-lama.mjs --kembalikan "' + berkasCadangan + '"');
