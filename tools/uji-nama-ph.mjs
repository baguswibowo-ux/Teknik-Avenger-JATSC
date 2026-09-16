/**
 * Nama yang tercetak di bawah tanda tangan kalau PH yang membubuhkan.
 *
 * Ini tulisan yang masuk ke ARSIP dan ikut tercetak di lembar resmi, jadi
 * bentuknya tidak boleh berubah tanpa sengaja. Yang dijaga di sini: nama PH-nya
 * sendiri yang di depan (bukan nama pejabat yang diwakili — itu sama saja
 * dengan memalsu arsip), kedudukannya disebut, lalu nama pejabatnya.
 *
 * Jalankan dari akar aplikasi: node tools/uji-nama-ph.mjs
 */
import { namaCetakPh } from '../elogbook/ttd-hak.js';

const diwakili = [
  { username: 'uus', nama: 'Uus Susanto' },
  { username: 'arya', nama: 'Arya Gunawan' }
];

let lulus = 0, gagal = 0;
const cek = (nama, dapat, harap) => {
  if (dapat === harap) lulus++;
  else { gagal++; console.log(`  GAGAL ${nama}\n    dapat "${dapat}"\n    harap "${harap}"`); }
};

// Bentuk yang diminta, persis seperti yang tercetak di kolom MANAGER TEKNIK.
cek('manager teknik',
  namaCetakPh('Uji Teknisi', 'uus', diwakili, 'Manager Teknik'),
  'Uji Teknisi (PH Manager Teknik Uus Susanto)');

// Lembar Monitoring: slotnya memang Personil Operasi, bukan Manager Teknik.
cek('personil operasi',
  namaCetakPh('Uji Teknisi', 'arya', diwakili, 'Personil Operasi'),
  'Uji Teknisi (PH Personil Operasi Arya Gunawan)');

// Keterangan pembeda slot tidak ikut tercetak di bawah tanda tangan.
cek('label berkurung dibersihkan',
  namaCetakPh('Uji Teknisi', 'uus', diwakili, 'Manager Teknik (BAPB)'),
  'Uji Teknisi (PH Manager Teknik Uus Susanto)');

// Tanpa kedudukan: bentuk lama, supaya pemanggil yang belum menyebutkannya
// tidak ikut berubah diam-diam.
cek('tanpa kedudukan',
  namaCetakPh('Budi Santoso', 'arya', diwakili),
  'Budi Santoso (PH Arya Gunawan)');

// Pejabat yang namanya tidak ada di daftar pengalihan: jatuh ke username-nya,
// bukan jadi kurung kosong yang tidak menerangkan siapa pun.
cek('pejabat di luar daftar',
  namaCetakPh('Uji Teknisi', 'sutrisno', diwakili, 'Manager Teknik'),
  'Uji Teknisi (PH Manager Teknik sutrisno)');

// Username dicocokkan tanpa peduli besar-kecil hurufnya.
cek('username huruf besar',
  namaCetakPh('Uji Teknisi', 'UUS', diwakili, 'Manager Teknik'),
  'Uji Teknisi (PH Manager Teknik Uus Susanto)');

console.log(`\n${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
