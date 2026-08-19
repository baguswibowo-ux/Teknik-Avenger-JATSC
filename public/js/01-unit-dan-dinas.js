/* =======================================================================
   KERANGKA UNIT DAN KODE DINAS

   Berkas ini dulu bernama 01-data-contoh.js dan isinya karangan: peralatan,
   sparepart, trouble, jadwal, cuplikan logbook, sampai lima akun tiruan.
   Semuanya sudah dibuang. Yang tersisa di sini bukan contoh melainkan
   kerangka — dua hal yang memang tidak datang dari mana-mana:

     KODE_DINAS      bentuk hari kerja, sama untuk seluruh unit
     UNIT_KERANGKA   daftar unit beserta ilustrasinya

   UNIT_KERANGKA tetap perlu ada sekalipun daftar unit yang sungguhan datang
   dari E-Logbook, karena satu kolom di dalamnya tidak dijawab siapa pun:
   `adegan`, yaitu ilustrasi vektor tiap unit. Nama dan peralatannya ditimpa
   jawaban server begitu ada yang masuk — lihat srvPasang().
   ======================================================================= */

/* Kode dinas yang dipakai seluruh unit. Empat yang pertama adalah bentuk
   sehari-hari — PS dan Malam, masing-masing di JATSC dan New JATSC. P dan S
   adalah pecahan PS untuk hari yang dibagi dua orang; kalau ia dipakai, malam
   hari itu mundur ke pukul 13:00. Jamnya ada di SHIFT, jauh di bawah.

   Satu daftar untuk semua unit, bukan per unit: pembagian JATSC/New JATSC itu
   pembagian gedung, dan gedungnya sama untuk semua teknik. */
const KODE_DINAS = ['PSJ','PSN','MJ','MN','P','S'];

/* Yang dipasang sebagai petak sebelum ada jadwal yang bisa dibaca. P dan S
   tidak ikut: keduanya bentuk khusus untuk hari yang dibagi dua orang, dan
   memasang kartunya di muka hanya melahirkan dua kotak "tidak ada personel"
   yang tidak pernah terisi. Begitu jadwalnya masuk, petaknya diambil dari
   kode yang benar-benar terisi di sana — lihat kodeDipakaiUnit(). */
const KODE_DINAS_INTI = ['PSJ','PSN','MJ','MN'];

/* Kerangka, bukan isi. `nama` dan `alat` di sini cuma dipakai sampai jawaban
   server datang; yang tidak pernah ditimpa hanya `adegan`. */
const UNIT_KERANGKA = [
  { kode:'radtel', nama:'Radtel', alat:'Radio Komunikasi, VSCS Garex, Recording Neptuno',
    adegan:'menara', dinas:KODE_DINAS },
  { kode:'radkom', nama:'Radkom', alat:'Radio Komunikasi VHF/HF A/G',
    adegan:'antena', dinas:KODE_DINAS },
  { kode:'ppabn', nama:'Pendaratan Presisi & Navigasi', alat:'ILS, DVOR/DME, NDB',
    adegan:'ils', dinas:KODE_DINAS },
  { kode:'pengamatan', nama:'Pengamatan', alat:'Radar Pengamatan',
    adegan:'radar', dinas:KODE_DINAS },
  { kode:'amhsadps', nama:'AMHS-ADPS', alat:'AMHS dan ADPS',
    adegan:'server', dinas:KODE_DINAS },
  { kode:'fdpsrdps', nama:'FDPS-RDPS', alat:'FDPS dan RDPS',
    adegan:'kontrol', dinas:KODE_DINAS },
  { kode:'listrikmekanik', nama:'Listrik dan Mekanik', alat:'Kelistrikan dan Mekanikal',
    adegan:'genset', dinas:KODE_DINAS },
  { kode:'gedungkeamanan', nama:'Gedung dan Keamanan', alat:'Gedung dan Sistem Keamanan',
    adegan:'gedung', dinas:KODE_DINAS }
];

/* Daftar unit yang sedang berlaku. Salinan, bukan kerangkanya sendiri:
   srvPasang() menyusunnya ulang dari jawaban server, dan kerangka yang ikut
   berubah tidak akan bisa dipakai lagi sebagai acuan. */
let UNIT = UNIT_KERANGKA.map(u => ({ ...u }));

/* Wadah yang isinya datang dari server dashboard ini sendiri (/unitdb).
   Sengaja dibiarkan kosong di sini: unit yang belum punya catatan harus
   terlihat kosong, bukan terisi daftar yang tidak pernah ada. */
const PERALATAN = {};

/* Papan trouble, disusun dari isu E-Logbook oleh srvPasang(). */
let TROUBLE = [];

/* Cuplikan logbook per unit, juga dari srvPasang(). Unit yang belum punya
   catatan tampil kosong — dulu diisi empat baris karangan per unit, dan di
   layar yang sudah tersambung keempatnya tidak bisa dibedakan dari yang asli. */
let LOGBOOK = {};
