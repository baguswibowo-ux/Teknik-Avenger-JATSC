/**
 * Tiap lembar Preventive harus bisa disunting selama Manager Teknik belum
 * menandatangani — sama seperti catatan logbook dan daily check.
 *
 * Mode suntingnya dirakit dari enam bagian yang saling bergantung, dan yang
 * paling gampang luput bukan kodenya melainkan sambungannya: tombol ✎ yang
 * memanggil fungsi yang tidak ada, bilah "sedang menyunting" yang id-nya salah
 * ketik sehingga tidak pernah muncul, atau tombol Batal Edit yang menunjuk
 * fungsi lain. Semuanya diam saja waktu salah — tidak ada yang tahu sampai ada
 * teknisi yang mencoba membetulkan lembarnya dan gagal.
 *
 * Yang diperiksa per lembar:
 *   1. ada penampung id yang sedang disunting
 *   2. tombol ✎ di daftar riwayat, dan hanya kalau belum ada TTD manager
 *      serta penekannya memang berhak (bolehSuntingCatatan)
 *   3. fungsi pembuka, pembatal, dan penerap mode suntingnya ada
 *   4. bilah penandanya ada di markup, dan id-nya sama dengan yang dicari js
 *   5. tombol Batal Edit di bilah itu memanggil pembatal yang benar
 *   6. simpannya bercabang ke fungsi server yang benar
 *
 * Jalankan dari akar aplikasi: node tools/uji-sunting-lembar.mjs
 */
import fs from 'node:fs';

const JS_DIR = 'elogbook/public/js';
const html = fs.readFileSync('elogbook/public/index.html', 'utf8');

/* nama    : sebutan lembarnya, untuk laporan
   berkas  : berkas js-nya
   awalan  : awalan nama variabel & fungsinya
   bilah   : id bilah penanda mode sunting di markup
   simpan  : aksi server yang dipanggil waktu menyunting
   daftar  : fungsi penggambar daftar riwayat (tempat tombol ✎ duduk) */
const LEMBAR = [
  { nama: 'DS Test',              berkas: '17-ds-test.js',            awalan: 'ds',      bilah: 'dsEditingBanner',     simpan: 'updateDsTest',  buka: 'openDsEdit' },
  { nama: 'Maintenance Radio',    berkas: '17c-radio.js',             awalan: 'radio',   bilah: 'radioEditingBanner',  simpan: 'updateDsTest',  buka: 'openRadioEdit' },
  { nama: 'Weekly Check',         berkas: '17d-weekly-pengamatan.js', awalan: 'wk',      bilah: 'wkEditingBanner',     simpan: 'updateDsTest',  buka: 'openWkEdit' },
  { nama: 'Ground Check LLZ',     berkas: '17e-llz-navigasi.js',      awalan: 'llz',     bilah: 'llzEditingBanner',    simpan: 'updateDsTest',  buka: 'openLlzEdit' },
  { nama: 'Meter Reading',        berkas: '17f-meter-reading.js',     awalan: 'mr',      bilah: 'mrEditingBanner',     simpan: 'updateDsTest',  buka: 'openMrEdit' },
  { nama: 'Maintenance Listrik',  berkas: '17g-maint-listrik.js',     awalan: 'ml',      bilah: 'mlEditingBanner',     simpan: 'updateDsTest',  buka: 'openMlEdit' },
  { nama: 'Meter Reading Radkom', berkas: '17h-meter-radkom.js',      awalan: 'rk',      bilah: 'rkEditingBanner',     simpan: 'updateDsTest',  buka: 'openRkEdit' },
  { nama: 'Pekerjaan Berkala',    berkas: '19-berkala.js',            awalan: 'berkala', bilah: 'bkEditingBanner',     simpan: 'updateBerkala', buka: 'openBerkalaEdit' }
];

const besar = (s) => s.charAt(0).toUpperCase() + s.slice(1);

let lulus = 0;
const gagal = [];

for (const l of LEMBAR) {
  const js = fs.readFileSync(JS_DIR + '/' + l.berkas, 'utf8');
  const salah = [];

  const editingId = l.awalan + 'EditingId';
  if (!js.includes('let ' + editingId)) salah.push('tidak ada penampung ' + editingId);

  if (!new RegExp('function\\s+' + l.buka + '\\s*\\(').test(js)) salah.push(l.buka + '() tidak ada');

  const batal = 'batalEdit' + besar(l.awalan);
  if (!new RegExp('function\\s+' + batal + '\\s*\\(').test(js)) salah.push(batal + '() tidak ada');

  // Tombol ✎ di daftar riwayat, dengan kedua pagarnya.
  if (!js.includes(l.buka + "('${")) salah.push('tombol sunting tidak dipasang di daftar riwayat');
  if (!js.includes('managerTtd && ')) salah.push('tombol sunting tidak dipagari TTD manager');
  if (!js.includes('bolehSuntingCatatan(')) salah.push('tombol sunting tidak dipagari bolehSuntingCatatan');

  // Bilah penanda: id yang dicari js harus ada di markup, dan tombol Batal
  // Edit di dalamnya harus menunjuk pembatal lembar ini - bukan lembar lain.
  if (!js.includes("'" + l.bilah + "'")) salah.push('js tidak mencari bilah ' + l.bilah);
  const bilah = new RegExp('id="' + l.bilah + '"[\\s\\S]{0,400}?</div>').exec(html);
  if (!bilah) salah.push('bilah ' + l.bilah + ' tidak ada di markup');
  else if (!bilah[0].includes(batal + '()')) salah.push('tombol Batal Edit di ' + l.bilah + ' tidak memanggil ' + batal);

  if (!js.includes("gsRun('" + l.simpan + "'")) salah.push('simpannya tidak memanggil ' + l.simpan);

  if (salah.length) gagal.push(l.nama + ':\n      ' + salah.join('\n      '));
  else lulus++;
}

console.log(`Lembar Preventive diperiksa: ${LEMBAR.length}`);
for (const g of gagal) console.log('  GAGAL ' + g);
console.log(`\n${lulus} lulus, ${gagal.length} gagal`);
process.exit(gagal.length ? 1 : 0);
