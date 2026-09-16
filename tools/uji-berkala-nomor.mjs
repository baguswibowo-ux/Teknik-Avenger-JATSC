/**
 * Penomoran baris tiap lembar pekerjaan berkala.
 *
 * Lembar-lembar ini dibaca per satuan yang diperiksa — per perangkat Neptuno,
 * per kelompok alat — bukan sebagai satu daftar panjang. Nomor yang berjalan
 * terus melewati batas satuannya membuat "baris 79" tidak memberi tahu siapa
 * pun ia ada di kelompok mana, dan itu menyulitkan justru pada saat hasilnya
 * dicocokkan dengan layar perangkatnya.
 *
 * Satuan resetnya tidak sama untuk semua lembar, jadi tidak bisa diperiksa
 * dengan satu aturan seragam — harapannya ditulis apa adanya di bawah.
 * Neptuno sengaja TIDAK direset per kelompok: satu perangkat punya dua seksi
 * (Monit Summary lalu NTP Status) yang dibaca sebagai satu lembar 1..26.
 *
 * Yang kedua diperiksa di sini: KODE tiap baris tetap unik. Kode itulah yang
 * mengunci isi catatan — nomor cuma untuk dibaca. Kode kembar membuat dua
 * baris berbagi satu isian, dan itu merusak catatan lama tanpa suara.
 *
 * Jalankan dari akar aplikasi: node tools/uji-berkala-nomor.mjs
 */
import { BERKALA_ITEM } from '../elogbook/berkala-item.js';

/* jenis -> daftar blok yang diharapkan: [nama blok, jumlah baris].
   Tiap blok harus bernomor 1..jumlah, berurutan, tanpa lompat. */
const HARAPAN = {
  neptuno: [
    ['Neptuno 1', 26], ['Neptuno 2', 26], ['Neptuno 3', 26], ['Neptuno 4', 26]
  ],
  gatevox:        [['GateVox', 9]],
  'cleaning-cwp': [['CWP', 85]],
  'restart-cwp':  [['CWP', 85], ['Neptuno', 4], ['TMCS', 2]]
};

/* Neptuno dikelompokkan per PERANGKAT (dua seksi jadi satu lembar), yang lain
   per kelompok sebagaimana tertulis di barisnya. */
const blokDari = (jenis, it) =>
  jenis === 'neptuno' ? 'Neptuno ' + it.kode.slice(1, 2) : (it.grup || '(tanpa grup)');

let lulus = 0;
const gagal = [];

for (const [jenis, daftar] of Object.entries(BERKALA_ITEM)) {
  const harap = HARAPAN[jenis];
  if (!harap) { gagal.push(`${jenis}: lembar baru yang belum punya harapan di uji ini`); continue; }

  const blok = [];
  for (const it of daftar) {
    const nama = blokDari(jenis, it);
    if (!blok.length || blok[blok.length - 1].nama !== nama) blok.push({ nama, nomor: [] });
    blok[blok.length - 1].nomor.push(it.no);
  }

  const salah = [];
  if (blok.length !== harap.length) {
    salah.push(`ada ${blok.length} blok, seharusnya ${harap.length}`);
  } else {
    blok.forEach((b, i) => {
      const [namaHarap, jumlahHarap] = harap[i];
      if (b.nama !== namaHarap) salah.push(`blok ke-${i + 1} bernama "${b.nama}", seharusnya "${namaHarap}"`);
      if (b.nomor.length !== jumlahHarap) salah.push(`${b.nama}: ${b.nomor.length} baris, seharusnya ${jumlahHarap}`);
      const urut = b.nomor.every((n, k) => n === k + 1);
      if (!urut) salah.push(`${b.nama}: nomornya ${b.nomor[0]}..${b.nomor[b.nomor.length - 1]}, seharusnya mulai 1 dan naik satu-satu`);
    });
  }

  const kode = new Set(daftar.map((x) => x.kode));
  if (kode.size !== daftar.length) salah.push(`kode kembar: ${daftar.length - kode.size} baris`);

  if (salah.length) gagal.push(jenis + ':\n      ' + salah.join('\n      '));
  else { lulus++; console.log(`  ${jenis}: ${blok.length} blok, ${daftar.length} baris, kode unik — OK`); }
}

console.log(`\nLembar berkala diperiksa: ${Object.keys(BERKALA_ITEM).length}`);
for (const g of gagal) console.log('  GAGAL ' + g);
console.log(`\n${lulus} lulus, ${gagal.length} gagal`);
process.exit(gagal.length ? 1 : 0);
