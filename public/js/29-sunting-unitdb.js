/* =======================================================================
   MENYUNTING DATABASE UNIT — peralatan dan sparepart

   Yang bisa disunting hanya dua daftar itu, dan alasannya bukan kemalasan.
   Trouble dan logbook datang dari E-Logbook begitu dashboard tersambung;
   menyuntingnya di sini akan melahirkan salinan lokal yang berbeda dari
   aslinya, tanpa satu pun jalan mengirimkannya kembali. Peralatan dan
   sparepart tidak punya rumah di sana sama sekali, jadi di sinilah tempatnya.

   Penyimpanannya localStorage — lihat catatan di blok SUNTINGAN DATABASE UNIT
   di atas.
   ======================================================================= */

const adeganPilihan = () => [
  ['antena',T('Antena / tiang','Antenna / mast')], ['radar','Radar'], ['ils','ILS'],
  ['server',T('Server / rak','Server / rack')], ['kontrol',T('Ruang kontrol','Control room')],
  ['genset',T('Genset / listrik','Genset / power')], ['gedung',T('Gedung','Building')],
  ['menara',T('Menara ATC','ATC tower')]
];
const ALAT_STATUS = ['Normal','Warning','Down'];
const PART_SATUAN = ['pcs','rol','drum','set','meter','liter'];

let dataDibuka = null;   // { jenis, unit, asal } — asal null berarti tambah baru

const alatDaftar = (unit) => PERALATAN[unit] || (PERALATAN[unit] = []);

/**
 * id peralatan dipakai sebagai kunci oleh trouble, sejarah, spek, dan daftar
 * dokumen — jadi harus unik di dalam unitnya dan tidak boleh berubah setelah
 * dibuat. Dirangkai dari namanya supaya masih terbaca saat menengok data
 * mentahnya, dengan angka di belakang kalau bentrok.
 */
function alatIdBaru(unit, nama){
  const pokok = String(nama || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu,'')
    .replace(/[^a-z0-9]+/g,'').slice(0,10) || 'alat';
  const ada = new Set(alatDaftar(unit).map(a=>a.id));
  if(!ada.has(pokok)) return pokok;
  let n = 2; while(ada.has(pokok + n)) n++;
  return pokok + n;
}

