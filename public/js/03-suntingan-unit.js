/* =======================================================================
   SUNTINGAN DATABASE UNIT — peralatan dan sparepart

   Kedua daftar di atas milik dashboard ini sendiri: E-Logbook belum punya
   modul peralatan maupun sparepart, jadi tidak ada tempat di sana untuk
   mengirimkan perubahannya. Yang bisa dilakukan sekarang menyimpannya di
   peramban yang sedang dipakai, dan itu yang dikerjakan blok ini.

   localStorage, bukan sessionStorage: suntingan data bukan sesi. Yang menata
   daftar peralatan satu unit sore ini berharap menemukannya utuh besok pagi,
   sekalipun tabnya sudah lama ditutup. Konsekuensinya jelas dan harus
   dikatakan apa adanya di layar: simpanannya per peramban, tidak berpindah ke
   komputer lain, dan tidak sampai ke siapa pun.

   Isi bawaan di atas tetap jadi titik nolnya. Tombol "Kembalikan ke bawaan"
   membuang simpanan itu, jadi tidak ada jalan buntu kalau daftarnya terlanjur
   berantakan.
   ======================================================================= */
const DB_KUNCI = { peralatan:'avenger.db.peralatan', sparepart:'avenger.db.sparepart' };

/* Salinan bawaan diambil sebelum simpanan dipasang — setelah itu PERALATAN dan
   PART sudah tidak asli lagi, dan tidak ada lagi yang bisa dijadikan acuan. */
const DB_BAWAAN = {
  peralatan: JSON.parse(JSON.stringify(PERALATAN)),
  sparepart: JSON.parse(JSON.stringify(PART))
};

function dbSimpan(){
  try{
    localStorage.setItem(DB_KUNCI.peralatan, JSON.stringify(PERALATAN));
    localStorage.setItem(DB_KUNCI.sparepart, JSON.stringify(PART));
  }catch(e){
    console.warn('Suntingan tidak bisa disimpan:', e && e.message || e);
    pesan(T('Perubahan tampil di layar, tapi peramban ini menolak menyimpannya.',
            'The change is on screen, but this browser refused to store it.'));
  }
}

/* Isi PERALATAN dan PART diganti di tempat, bukan lewat penugasan ulang:
   keduanya const, dan CONTOH serta seluruh fungsi gambar memegang rujukan yang
   sama sejak awal. */
function dbPakai(peralatan, sparepart){
  Object.keys(PERALATAN).forEach(k=>delete PERALATAN[k]);
  Object.assign(PERALATAN, JSON.parse(JSON.stringify(peralatan)));
  PART.splice(0, PART.length, ...JSON.parse(JSON.stringify(sparepart)));
}

function dbMuat(){
  try{
    const p = JSON.parse(localStorage.getItem(DB_KUNCI.peralatan) || 'null');
    const s = JSON.parse(localStorage.getItem(DB_KUNCI.sparepart) || 'null');
    if(p && typeof p === 'object' && !Array.isArray(p)){
      Object.keys(PERALATAN).forEach(k=>delete PERALATAN[k]);
      Object.assign(PERALATAN, p);
    }
    if(Array.isArray(s)) PART.splice(0, PART.length, ...s);
  }catch(e){
    console.warn('Suntingan tersimpan tidak terbaca, dipakai bawaannya:', e && e.message || e);
  }
}

function dbKembalikan(){
  dbPakai(DB_BAWAAN.peralatan, DB_BAWAAN.sparepart);
  try{
    localStorage.removeItem(DB_KUNCI.peralatan);
    localStorage.removeItem(DB_KUNCI.sparepart);
  }catch(e){ /* tidak ada yang perlu dibuang */ }
}

/** Ada suntingan tersimpan? Dipakai untuk memutuskan tombol pengembalian muncul.

    Saat tersambung, tombolnya tidak pernah muncul: yang tersimpan di server
    milik bersama, dan "kembalikan ke bawaan" di situ berarti mengganti daftar
    peralatan sungguhan satu unit dengan daftar contoh — sekali tekan, untuk
    semua orang. Pengembalian itu hanya masuk akal terhadap simpanan peramban
    sendiri, dan hanya di situ ia ditawarkan. */
const dbAdaSuntingan = () => {
  if(SRV.aktif) return false;
  try{ return !!(localStorage.getItem(DB_KUNCI.peralatan) || localStorage.getItem(DB_KUNCI.sparepart)); }
  catch(e){ return false; }
};

dbMuat();

/* Cuplikan logbook per unit — bentuk barisnya mengikuti unit masing-masing.
   Radkom membawa jam selesai dan frekuensi, unit lain tidak. */
let LOGBOOK = {
  radtel:[
    { tgl:'2026-08-13', jam:'02:15', dinas:'Malam', uraian:'Pemeriksaan harian VSCS Garex, seluruh CWP normal kecuali CWP-07', pj:'S. Handoko' },
    { tgl:'2026-08-13', jam:'09:40', dinas:'Pagi', uraian:'Penggantian headset operator CWP-03, uji suara dua arah normal', pj:'B. Santoso' },
    { tgl:'2026-08-12', jam:'14:20', dinas:'Siang', uraian:'Backup rekaman Neptuno periode 01–10 Agustus ke media eksternal', pj:'R. Alfian' },
    { tgl:'2026-08-12', jam:'07:05', dinas:'Pagi', uraian:'Serah terima dinas, tidak ada gangguan menonjol semalam', pj:'B. Santoso' }
  ],
  radkom:[
    { tgl:'2026-08-13', jam:'03:10', selesai:'03:45', frek:'118.750', dinas:'M', uraian:'Pengukuran daya pancar TX-1, hasil 32W dari 55W nominal', pj:'Y. Saputra' },
    { tgl:'2026-08-13', jam:'08:30', selesai:'09:15', frek:'126.400', dinas:'P', uraian:'Uji jangkauan bersama ATC, laporan pilot jelas di 60 NM', pj:'A. Rahman' },
    { tgl:'2026-08-12', jam:'15:05', selesai:'15:30', frek:'121.500', dinas:'S', uraian:'Pengecekan kanal darurat, modulasi normal', pj:'T. Wibisono' },
    { tgl:'2026-08-12', jam:'06:50', selesai:'07:10', frek:'—', dinas:'P', uraian:'Pemeriksaan VSWR seluruh antena dipole, satu titik di atas ambang', pj:'A. Rahman' }
  ]
};
const LOGBOOK_UMUM = [
  { tgl:'2026-08-13', jam:'08:20', dinas:'Pagi', uraian:'Pemeriksaan harian peralatan, hasil terlampir pada formulir daily check', pj:'—' },
  { tgl:'2026-08-12', jam:'14:10', dinas:'Siang', uraian:'Serah terima dinas berjalan normal', pj:'—' }
];

const SEJARAH = {
  tx:[
    { tgl:'2026-07-24', warna:'merah', judul:'Daya pancar TX 118.75 turun', rinci:'Turun ±40%. Dialihkan ke transmitter cadangan dalam 6 menit. PA menunggu sparepart.' },
    { tgl:'2026-03-12', warna:'', judul:'Kalibrasi tahunan', rinci:'Pengukuran daya, frekuensi, dan modulasi seluruh kanal A/G. Semua dalam batas.' },
    { tgl:'2025-11-08', warna:'kuning', judul:'Penggantian antena VHF #3', rinci:'VSWR naik di atas 1.8 saat hujan. Antena dan konektor N diganti.' },
    { tgl:'2019-06-02', warna:'', judul:'Instalasi awal', rinci:'Pemasangan dan commissioning bersama vendor, termasuk uji jangkauan udara.' }
  ],
  grx:[
    { tgl:'2026-08-04', warna:'kuning', judul:'Jack headset CWP-07 longgar', rinci:'Suara putus-putus saat kabel bergerak. Menunggu panel jack pengganti.' },
    { tgl:'2026-01-20', warna:'', judul:'Kalibrasi dan uji fungsi tahunan', rinci:'Uji seluruh posisi CWP, interkom, dan perekaman. Tidak ada temuan.' },
    { tgl:'2024-09-15', warna:'', judul:'Upgrade firmware server VSCS', rinci:'Naik ke rilis 3.4.2 untuk memperbaiki gangguan sinkron perekaman.' },
    { tgl:'2021-04-27', warna:'', judul:'Instalasi awal', rinci:'Pemasangan 12 posisi CWP di tower dan ACC beserta recording Neptuno.' }
  ],
  acp:[
    { tgl:'2026-07-31', warna:'merah', judul:'AC presisi R. Equipment bocor', rinci:'Kebocoran refrigeran, suhu ruang naik 3°C. AC cadangan menanggung beban.' },
    { tgl:'2026-04-18', warna:'', judul:'Pembersihan dan ganti filter', rinci:'Filter keempat unit diganti, evaporator dibersihkan.' },
    { tgl:'2020-02-11', warna:'', judul:'Instalasi awal', rinci:'Pemasangan empat unit AC presisi ruang equipment.' }
  ]
};
const SPEK = {
  tx:{ 'Merk / Tipe':'R&S Series4200', 'Serial':'RS-4200-JKT-11', 'Tahun Pasang':'2019', 'Umur':'7 tahun', 'Kalibrasi Berikut':'12 Mar 2027' },
  grx:{ 'Merk / Tipe':'Garex 300 VSCS', 'Serial':'GRX-300-JTS-04', 'Tahun Pasang':'2021', 'Umur':'5 tahun', 'Kalibrasi Berikut':'20 Jan 2027' },
  acp:{ 'Merk / Tipe':'Stulz CyberAir 3', 'Serial':'STZ-CA3-08', 'Tahun Pasang':'2020', 'Umur':'6 tahun', 'Servis Berikut':'18 Okt 2026' }
};

/* Pegangan ke data contoh yang asli. Sambungan ke server menimpa UNIT,
   TROUBLE, dan LOGBOOK dengan objek baru — tidak pernah mengubah isi yang
   lama — jadi menyimpan rujukannya saja sudah cukup untuk kembali ke contoh
   tanpa memuat ulang halaman. */
const CONTOH = { UNIT, TROUBLE, LOGBOOK };

