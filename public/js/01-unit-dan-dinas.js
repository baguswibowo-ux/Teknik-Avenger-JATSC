/* =======================================================================
   KODE DINAS DAN ILUSTRASI UNIT

   Berkas ini dulu bernama 01-data-contoh.js dan isinya karangan; sesudah itu
   sempat menyimpan kerangka unit lengkap dengan nama dan peralatannya. Kedua
   isi itu sudah pergi, dan yang tersisa cuma dua hal yang memang tidak datang
   dari mana-mana:

     KODE_DINAS    bentuk hari kerja, sama untuk seluruh unit
     ADEGAN_UNIT   ilustrasi vektor tiap unit

   NAMA DAN PERALATAN UNIT TIDAK ADA DI SINI, DAN ITU DISENGAJA. Daftar unit
   yang berlaku milik E-Logbook (UNIT di db.js dan db-pg.js); dashboard ini
   menerimanya lewat getAllData dan menyusun UNIT dari situ — lihat srvPasang().

   Sebabnya pernah terlihat: berkas ini menulis ppabn sebagai "Pendaratan
   Presisi & Navigasi", E-Logbook menulisnya "Pendaratan Presisi & Alat Bantu
   Navigasi". Yang tampil bergantung pada siapa yang membuka, karena nama dari
   server dulu hanya menimpa unit yang dipegang akun itu — unit lain tetap
   memakai salinan di sini. Satu unit, dua nama, di layar yang sama.

   Yang tinggal di sini justru yang TIDAK dijawab E-Logbook: gambar unitnya.
   ======================================================================= */

/* Kode dinas yang dipakai seluruh unit. Empat yang pertama adalah bentuk
   sehari-hari — PS dan Malam, masing-masing di JATSC dan New JATSC. P dan S
   adalah pecahan PS untuk hari yang dibagi dua orang; kalau ia dipakai, malam
   hari itu mundur ke pukul 13:00. Jamnya ada di SHIFT, jauh di bawah.

   Satu daftar untuk semua unit, bukan per unit: pembagian JATSC/New JATSC itu
   pembagian gedung, dan gedungnya sama untuk semua teknik.

   JANGAN diganti dengan `dinas` dari daftar unit E-Logbook, sekalipun namanya
   sama. Yang di sana daftar shift untuk lembar logbook — 'Pagi', 'Siang',
   'Malam', 'PS' — bentuk lama dari sebelum kode gedung dipakai, dan radkom
   malah memakai daftarnya sendiri. srvPasang() dulu menimpanya begitu saja,
   dan akibatnya jadwal dinas menawarkan kode yang tidak dikenal modulnya
   sendiri, di bawah keterangan yang menjelaskan kode yang tidak ada di
   daftarnya. */
const KODE_DINAS = [
  /* Bentuk penuh sehari: PSJ/PSN (PS per gedung), MJ/MN (Malam per gedung).
     P/S polos ada untuk pecahan hari yang belum menyebut gedung; PJ/PNJ/SJ/SNJ
     memberi bentuk pecahannya per gedung, sama seperti PS diberi PSJ/PSN. */
  'PSJ','PSN','MJ','MN','P','S','PJ','PNJ','SJ','SNJ',
  /* SPKL — Surat Perintah Kerja Lembur; satu varian untuk tiap bentuk dinas
     dasarnya, supaya kartu SPKL berdiri sejajar dengan petak dinas biasa di
     jadwal harian. Jam dan pita cakupan mengikuti varian dasarnya (lihat
     SHIFT), warnanya sengaja beda supaya kartu SPKL tidak salah dibaca sebagai
     jaga rutin. */
  'SPKLPSJ','SPKLPSN','SPKLMJ','SPKLMN','SPKLP','SPKLS','SPKLPJ','SPKLPNJ','SPKLSJ','SPKLSNJ',
  /* Tidak berdinas — orangnya tetap muncul di petak hari itu supaya siapa yang
     absen kelihatan, tetapi tanpa jam dan tanpa hitungan cakupan (lihat entri
     `libur:true` di SHIFT). Pengimpor membedakannya dari sel kosong, jadi
     'CUTI' di lembar aslinya tidak lagi jatuh ke "libur" begitu saja.
     DL (Dinas Luar) ikut di sini: orangnya bertugas tetapi di luar stasiun,
     jadi tampil di petaknya tanpa jam dan tanpa cakupan — sama seperti CUTI. */
  'CUTI','CAP','IJIN','DL'
];

/* Yang dipasang sebagai petak sebelum ada jadwal yang bisa dibaca. P dan S
   tidak ikut: keduanya bentuk khusus untuk hari yang dibagi dua orang, dan
   memasang kartunya di muka hanya melahirkan dua kotak "tidak ada personel"
   yang tidak pernah terisi. Begitu jadwalnya masuk, petaknya diambil dari
   kode yang benar-benar terisi di sana — lihat kodeDipakaiUnit(). */
const KODE_DINAS_INTI = ['PSJ','PSN','MJ','MN'];

/* Ilustrasi vektor per unit, dibangkitkan 05-ilustrasi.js menurut nilai ini.
   Satu-satunya kolom unit yang memang milik dashboard ini. Unit yang belum
   punya barisnya jatuh ke 'server' — bentuk paling netral yang ada. */
const ADEGAN_UNIT = {
  radtel:         'menara',
  radkom:         'antena',
  ppabn:          'ils',
  pengamatan:     'radar',
  amhsadps:       'server',
  fdpsrdps:       'kontrol',
  listrikmekanik: 'genset',
  gedungkeamanan: 'gedung'
};

/* Daftar unit yang sedang berlaku, disusun srvPasang() dari jawaban E-Logbook.
   Kosong sampai ada yang masuk, dan itu benar: sebelum login tidak ada satu
   layar unit pun yang digambar, dan daftar tebakan hanya akan sempat terlihat
   kalau salah. */
let UNIT = [];

/* Wadah yang isinya datang dari server dashboard ini sendiri (/unitdb).
   Sengaja dibiarkan kosong di sini: unit yang belum punya catatan harus
   terlihat kosong, bukan terisi daftar yang tidak pernah ada. */
const PERALATAN = {};

/* Izin Stasiun Radio per unit — juga dari /unitdb, berkunci kode unit.
   { kode unit -> [ {id, nama, nomor, frek, kelas, lokasi, mulai, habis, ket} ] } */
const ISR = {};

/* Papan trouble, disusun dari isu E-Logbook oleh srvPasang(). */
let TROUBLE = [];

/* Cuplikan logbook per unit, juga dari srvPasang(). Unit yang belum punya
   catatan tampil kosong — dulu diisi empat baris karangan per unit, dan di
   layar yang sudah tersambung keempatnya tidak bisa dibedakan dari yang asli. */
let LOGBOOK = {};

/* Catatan yang jamnya sudah lewat namun tanda tangannya belum dibubuhkan —
   dihitung sekali oleh srvPasang() dari formulir yang dibawa E-Logbook. Dipakai
   lonceng untuk memberi tahu manager/teknisi kalau ada yang menggantung, tanpa
   perlu memanggil server terpisah: seluruh data yang diperlukan sudah ada di
   jawaban getAllData. */
let TTD_TERLAMBAT = [];
