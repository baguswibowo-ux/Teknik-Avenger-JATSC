/* =======================================================================
   DATA CONTOH — semua isinya karangan.
   Nama unit, peralatan, dan daftar dinas disalin dari db.js supaya bentuknya
   tidak meleset.

   UNIT, TROUBLE, dan LOGBOOK memakai `let`, bukan `const`: ketiganya diganti
   isi sungguhan begitu halaman ini disambungkan ke server E-Logbook (lihat
   blok JEMBATAN E-LOGBOOK di bawah). Yang lain — peralatan, sparepart, jadwal
   dinas, sejarah — tetap contoh, karena modulnya memang belum ada di server.
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

let UNIT = [
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

/* Akun contoh. Peran 'admin' dan 'pejabat' membuka semua unit — sama seperti
   SEMUA_UNIT di db.js. Teknisi hanya membuka unit yang ditugaskan padanya.

   `role` adalah kode peran yang diperiksa, `peran` sebutannya di layar. Dipisah
   karena sebutan boleh berganti kapan saja, kode peran tidak — dan tanpa `role`
   akun contoh tidak akan pernah bisa membuka tab Kelola Akun, padahal justru
   itu yang perlu bisa dicoba tanpa server. */
const AKUN = [
  { user:'radtel',  nama:'B. Santoso',  role:'teknisi', peran:'Teknisi Radtel',  peranEn:'Radtel Technician',     unit:['radtel'] },
  { user:'radkom',  nama:'A. Rahman',   role:'teknisi', peran:'Teknisi Radkom',  peranEn:'Radkom Technician',     unit:['radkom'] },
  { user:'listrik', nama:'D. Prasetyo', role:'teknisi', peran:'Teknisi Listrik', peranEn:'Electrical Technician', unit:['listrikmekanik'] },
  { user:'admin',   nama:'H. Setiawan', role:'admin',   peran:'Admin Faskompen', peranEn:'Faskompen Admin',       unit:'semua' },
  { user:'pejabat', nama:'M. Fauzi',    role:'pejabat', peran:'Manager Teknik',  peranEn:'Technical Manager',     unit:'semua' }
];

/* Peralatan per unit — inilah yang membuat isi tiap unit berbeda. */
const PERALATAN = {
  radtel:[
    { id:'grx', nama:'VSCS Garex 300', tipe:'Garex 300 · 12 CWP', lokasi:'R. Equipment Lt.2', status:'Warning', adegan:'kontrol' },
    { id:'npt', nama:'Recording Neptuno', tipe:'Neptuno R2 · 64 kanal', lokasi:'R. Equipment Lt.2', status:'Normal', adegan:'server' },
    { id:'vhfg',nama:'Radio VHF Ground', tipe:'Park Air T6 · 8 unit', lokasi:'Shelter TX', status:'Normal', adegan:'antena' },
    { id:'hfs', nama:'HF SSB Transceiver', tipe:'Codan 2110 · 2 unit', lokasi:'R. Radio', status:'Normal', adegan:'antena' }
  ],
  radkom:[
    { id:'tx', nama:'Transmitter VHF A/G', tipe:'R&S Series4200 · 12 kanal', lokasi:'Shelter TX', status:'Down', adegan:'antena' },
    { id:'rx', nama:'Receiver VHF A/G', tipe:'R&S Series4200 · 12 kanal', lokasi:'Shelter RX', status:'Normal', adegan:'antena' },
    { id:'hf', nama:'HF Transceiver A/G', tipe:'Rockwell HF-2050', lokasi:'R. Radio', status:'Normal', adegan:'menara' },
    { id:'ant',nama:'Antenna System', tipe:'Dipole array · 14 titik', lokasi:'Tower antena', status:'Warning', adegan:'antena' },
    { id:'rcu',nama:'Remote Control Unit', tipe:'RCMS v4', lokasi:'R. Equipment', status:'Normal', adegan:'kontrol' }
  ],
  ppabn:[
    { id:'ils', nama:'ILS RWY 25L', tipe:'Thales 420 · LLZ/GP/MM', lokasi:'Sisi runway 25L', status:'Normal', adegan:'ils' },
    { id:'dvor',nama:'DVOR/DME', tipe:'Selex 1150A', lokasi:'Shelter DVOR', status:'Warning', adegan:'radar' },
    { id:'ndb', nama:'NDB', tipe:'Nautel ND-2000', lokasi:'Area NDB', status:'Normal', adegan:'antena' }
  ],
  pengamatan:[
    { id:'psr', nama:'Primary Surveillance Radar', tipe:'Thales STAR-2000', lokasi:'Tower radar', status:'Warning', adegan:'radar' },
    { id:'ssr', nama:'SSR Mode-S', tipe:'Thales RSM-970S', lokasi:'Tower radar', status:'Normal', adegan:'radar' },
    { id:'ads', nama:'ADS-B Station', tipe:'Comsoft R400', lokasi:'R. Otomasi', status:'Normal', adegan:'server' }
  ],
  amhsadps:[
    { id:'amhs',nama:'AMHS Server', tipe:'Comsoft AIDA-NG · redundan', lokasi:'R. Otomasi', status:'Down', adegan:'server' },
    { id:'adps',nama:'ADPS Server', tipe:'ADPS v3 · 2 node', lokasi:'R. Otomasi', status:'Normal', adegan:'server' },
    { id:'sw',  nama:'Message Switch', tipe:'MSW-400', lokasi:'R. Otomasi', status:'Normal', adegan:'server' }
  ],
  fdpsrdps:[
    { id:'fdps',nama:'FDPS Server', tipe:'Indra iTEC · 2 node', lokasi:'R. Otomasi', status:'Warning', adegan:'server' },
    { id:'rdps',nama:'RDPS Server', tipe:'Indra iTEC · 2 node', lokasi:'R. Otomasi', status:'Normal', adegan:'server' },
    { id:'cwp', nama:'CWP Display', tipe:'Barco 2K · 18 posisi', lokasi:'R. ACC', status:'Normal', adegan:'kontrol' }
  ],
  listrikmekanik:[
    { id:'gen', nama:'Genset 500 kVA', tipe:'Cummins C500 · 2 unit', lokasi:'R. Genset', status:'Normal', adegan:'genset' },
    { id:'ups', nama:'UPS 200 kVA', tipe:'Schneider Galaxy VS', lokasi:'R. UPS', status:'Normal', adegan:'genset' },
    { id:'acp', nama:'AC Presisi', tipe:'Stulz CyberAir · 4 unit', lokasi:'R. Equipment', status:'Down', adegan:'genset' },
    { id:'ats', nama:'Panel ATS/AMF', tipe:'Deep Sea 8610', lokasi:'R. Panel', status:'Normal', adegan:'genset' }
  ],
  gedungkeamanan:[
    { id:'cctv',nama:'Sistem CCTV', tipe:'Hikvision · 64 kamera', lokasi:'Seluruh gedung', status:'Down', adegan:'gedung' },
    { id:'acc', nama:'Access Control', tipe:'HID · 22 pintu', lokasi:'Seluruh gedung', status:'Normal', adegan:'gedung' },
    { id:'fire',nama:'Fire Alarm System', tipe:'Notifier NFS2-3030', lokasi:'Seluruh gedung', status:'Normal', adegan:'gedung' }
  ]
};

let TROUBLE = [
  { unit:'radkom', alat:'tx', jenis:'Transmitter VHF', ket:'TX VHF 118.75 MHz daya pancar turun ±40%, cadangan dipakai', lokasi:'Shelter TX', status:'Proses', tgl:'2026-07-24', pic:'A. Rahman' },
  { unit:'listrikmekanik', alat:'acp', jenis:'AC Presisi', ket:'AC presisi ruang equipment #2 bocor, suhu naik 3°C', lokasi:'R. Equipment', status:'Open', tgl:'2026-07-31', pic:'D. Prasetyo' },
  { unit:'radtel', alat:'grx', jenis:'VSCS Garex 300', ket:'Headset jack CWP-07 kontak longgar, suara putus-putus', lokasi:'Tower CWP-07', status:'Proses', tgl:'2026-08-04', pic:'B. Santoso' },
  { unit:'ppabn', alat:'dvor', jenis:'DVOR/DME', ket:'Monitor DME idle time melebihi ambang saat pagi', lokasi:'Shelter DVOR', status:'Open', tgl:'2026-08-07', pic:'E. Kurnia' },
  { unit:'pengamatan', alat:'psr', jenis:'Radar PSR', ket:'Plot extractor sesekali kehilangan sinkron, log dikumpulkan', lokasi:'R. Radar', status:'Proses', tgl:'2026-08-09', pic:'F. Hidayat' },
  { unit:'amhsadps', alat:'amhs', jenis:'AMHS', ket:'Antrean pesan menumpuk ke satu tujuan, menunggu balasan', lokasi:'R. Otomasi', status:'Open', tgl:'2026-08-11', pic:'C. Wijaya' },
  { unit:'gedungkeamanan', alat:'cctv', jenis:'CCTV', ket:'Kamera koridor lantai 3 mati, kabel diduga terjepit', lokasi:'Koridor Lt.3', status:'Open', tgl:'2026-08-12', pic:'G. Nugroho' },
  { unit:'fdpsrdps', alat:'fdps', jenis:'FDPS', ket:'Cetak strip lambat pada jam sibuk, indikasi antrean printer', lokasi:'R. Otomasi', status:'Proses', tgl:'2026-08-13', pic:'C. Wijaya' },
  { unit:'radkom', alat:'ant', jenis:'Antenna System', ket:'VSWR antena dipole #9 naik ke 1.9 saat hujan', lokasi:'Tower antena', status:'Open', tgl:'2026-08-06', pic:'A. Rahman' }
];

/* Dinas hari ini per unit. Radkom sengaja dibuat memakai P dan S, bukan PS:
   itu satu-satunya bentuk hari yang memundurkan malam ke pukul 13:00, dan
   tanpa satu contoh pun aturan itu tidak pernah kelihatan di data contoh. */
const DINAS = {
  radtel:[ {k:'PSJ',o:[{n:'B. Santoso',p:'Teknisi'}]}, {k:'PSN',o:[{n:'R. Alfian',p:'Teknisi'}]},
           {k:'MJ',o:[{n:'S. Handoko',p:'Teknisi'}]}, {k:'MN',o:[{n:'G. Nugroho',p:'Penanggung Jawab'}]} ],
  radkom:[ {k:'P',o:[{n:'A. Rahman',p:'Teknisi'}]}, {k:'S',o:[{n:'T. Wibisono',p:'Teknisi'}]},
           {k:'MJ',o:[{n:'Y. Saputra',p:'Teknisi'}]}, {k:'MN',o:[{n:'M. Fauzi',p:'Manager Teknik'}]} ],
  ppabn:[ {k:'PSJ',o:[{n:'E. Kurnia',p:'Teknisi'}]}, {k:'PSN',o:[{n:'N. Aprilia',p:'Teknisi'}]},
          {k:'MJ',o:[{n:'W. Gunawan',p:'Teknisi'}]}, {k:'MN',o:[]} ],
  pengamatan:[ {k:'PSJ',o:[{n:'F. Hidayat',p:'Teknisi'}]}, {k:'PSN',o:[{n:'L. Ramadhan',p:'Teknisi'}]},
               {k:'MJ',o:[{n:'P. Adiputra',p:'Teknisi'}]}, {k:'MN',o:[]} ],
  amhsadps:[ {k:'PSJ',o:[{n:'C. Wijaya',p:'Teknisi'}]}, {k:'PSN',o:[{n:'K. Mahendra',p:'Teknisi'}]},
             {k:'MJ',o:[]}, {k:'MN',o:[{n:'H. Setiawan',p:'Admin'}]} ],
  fdpsrdps:[ {k:'PSJ',o:[{n:'C. Wijaya',p:'Teknisi'}]}, {k:'PSN',o:[{n:'V. Anggara',p:'Teknisi'}]},
             {k:'MJ',o:[]}, {k:'MN',o:[]} ],
  listrikmekanik:[ {k:'PSJ',o:[{n:'D. Prasetyo',p:'Teknisi'}]}, {k:'PSN',o:[{n:'I. Kurniawan',p:'Teknisi'}]},
                   {k:'MJ',o:[{n:'Z. Firmansyah',p:'Teknisi'}]}, {k:'MN',o:[]} ],
  gedungkeamanan:[ {k:'PSJ',o:[{n:'G. Nugroho',p:'Teknisi'}]}, {k:'PSN',o:[{n:'U. Salim',p:'Teknisi'}]},
                   {k:'MJ',o:[{n:'O. Pratama',p:'Teknisi'}]}, {k:'MN',o:[]} ]
};
