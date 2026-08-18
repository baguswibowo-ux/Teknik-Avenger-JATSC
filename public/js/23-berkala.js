/* =======================================================================
   KEGIATAN BERKALA — mingguan, bulanan, triwulan, semesteran, tahunan

   Ini modul yang menjawab pertanyaan "apa yang harus dikerjakan minggu ini",
   dan ia sengaja duduk di sebelah jadwal dinas, bukan berdiri sendiri di layar
   lain. Alasannya sederhana: yang mengerjakan pekerjaan mingguan adalah orang
   yang kebetulan berdinas hari itu, dan ia mengetahuinya dari jadwal — bukan
   dari daftar terpisah yang harus diingat untuk dibuka.

   Karena itu kegiatan berkala muncul di tiga tempat sekaligus:
     · tabel jadwal bulanan   — baris penanda di atas nama-nama, jadi terlihat
                                tanggal berapa saja yang ada pekerjaannya
     · beranda                — yang jatuh tempo dan belum dikerjakan
     · lonceng tiap akun      — hanya untuk yang namanya ada di dinas hari ini

   DUA HAL YANG DISIMPAN TERPISAH, dan itu disengaja:
     daftar kegiatannya  — pendek, jarang berubah, dijaga haknya
     catatan selesainya  — satu baris tiap kegiatan tiap periode, boleh diisi
                           siapa saja yang sudah masuk
   Kalau keduanya jadi satu, daftar pekerjaan yang isinya delapan baris akan
   tumbuh jadi ribuan baris riwayat dalam setahun, dan tiap kali ada yang
   menandai selesai seluruh daftarnya ikut ditulis ulang.
   ======================================================================= */

const BERKALA_KUNCI = 'avenger.berkala';
const BERKALA_JENIS = ['mingguan','bulanan','triwulan','semesteran','tahunan'];
const BERKALA_NAMA = {
  mingguan:   ['Mingguan','Weekly'],
  bulanan:    ['Bulanan','Monthly'],
  triwulan:   ['Triwulan','Quarterly'],
  semesteran: ['Semesteran','Half-yearly'],
  tahunan:    ['Tahunan','Yearly']
};
const bklJenisNama = (j) => T(...(BERKALA_NAMA[j] || BERKALA_NAMA.mingguan));
/* Berapa bulan panjang satu putaran, untuk yang lebih panjang dari sebulan.
   Angkanya sekaligus batas kolom "bulan ke-": pekerjaan triwulan jatuh di bulan
   ke-1, ke-2, atau ke-3 di dalam triwulan yang sedang berjalan. Harus sama
   persis dengan BERKALA_PANJANG di server.js. */
const BERKALA_PANJANG = { triwulan:3, semesteran:6, tahunan:12 };
const BULAN_NAMA = [
  ['Januari','January'], ['Februari','February'], ['Maret','March'], ['April','April'],
  ['Mei','May'], ['Juni','June'], ['Juli','July'], ['Agustus','August'],
  ['September','September'], ['Oktober','October'], ['November','November'], ['Desember','December']
];
const HARI_NAMA = [
  ['Senin','Monday'], ['Selasa','Tuesday'], ['Rabu','Wednesday'], ['Kamis','Thursday'],
  ['Jumat','Friday'], ['Sabtu','Saturday'], ['Minggu','Sunday']
];
const hariNama = (n) => T(...(HARI_NAMA[Math.min(6, Math.max(0, Number(n) - 1))] || HARI_NAMA[0]));

/* Rombongan yang mengerjakan, di samping harinya. Yang mengerjakan pekerjaan
   berkala adalah orang yang kebetulan berdinas, dan "berdinas hari Senin" masih
   menyebut dua rombongan yang tidak pernah bertemu: yang masuk pagi sampai
   siang, dan yang masuk malam. Menyebut salah satunya membuat pekerjaan ini
   punya pemilik yang jelas.

   Kosong tetap sah dan tetap jadi bawaan. Pekerjaan yang memang boleh
   dikerjakan siapa saja yang ada tidak perlu dipaksa memilih, dan seluruh
   kegiatan yang sudah tersimpan sebelum kolom ini ada memang ada di keadaan
   itu. Daftarnya kembaran BERKALA_SHIFT di server.js; nama rombongannya
   diambil dari ROMBONGAN_NAMA di 02-kode-dinas.js supaya tidak ada dua tempat
   yang menamai hal yang sama. */
const BERKALA_SHIFT = ['', 'PS', 'M'];
const bklShiftNama = (s) => s && ROMBONGAN_NAMA[s]
  ? T(...ROMBONGAN_NAMA[s]) : T('Semua shift','Any shift');
/** Rombongan kegiatan ini, dirapikan. Nilai asing dibaca sebagai kosong. */
const bklShift = (k) => BERKALA_SHIFT.includes(k?.shift) ? (k.shift || '') : '';

/* Kegiatan contoh, dipakai saat belum ada apa pun yang tersimpan. Bukan sekadar
   pengisi layar: modul yang dibuka pertama kali dalam keadaan kosong tidak
   memperlihatkan apa pun tentang bentuknya, dan yang pertama kali membukanya
   justru orang yang belum tahu apa yang mau diisikan. */
const BERKALA_CONTOH = {
  radtel: [
    // Hari 1, 3, 6 = Senin, Rabu, Sabtu. Tandanya tidak dicentang di sini —
    // lihat blok KEGIATAN YANG TANDANYA DATANG DARI E-LOGBOOK.
    // Hari 1, 3, 6 = Senin, Rabu, Sabtu. Shift PS karena DS Test perlu lawan
    // bicara di site seberang, dan site itu berpenghuni pada jam kerja.
    { id:'ds', nama:'Pengecekan DS (DS Test)', jenis:'mingguan', hari:[1,3,6], bulan:null, tanggal:null,
      sumber:'dstest', alat:'', shift:'PS',
      ket:'Uji incoming dan outgoing seluruh site. Lembarnya diisi di E-Logbook; tanda di sini mengikutinya.' },
    { id:'k1', nama:'Periksa daya pancar dan VSWR', jenis:'mingguan', hari:2, bulan:null, tanggal:null,
      alat:'', shift:'PS', ket:'Catat hasilnya di logbook. Kalau turun lebih dari 10%, buka trouble.' },
    // Yang dikerjakan malam: lalu lintas sepi, jadi memutus kanal satu per satu
    // tidak mengganggu siapa pun.
    { id:'k4', nama:'Restart terjadwal CWP', jenis:'mingguan', hari:7, bulan:null, tanggal:null,
      alat:'', shift:'M', ket:'Malam Minggu, saat lalu lintas paling sepi. Satu posisi dulu, pastikan naik lagi.' },
    { id:'k2', nama:'Bersihkan filter pendingin shelter', jenis:'bulanan', hari:null, bulan:null, tanggal:5,
      alat:'', ket:'' },
    { id:'k3', nama:'Kalibrasi ulang power meter', jenis:'triwulan', hari:null, bulan:3, tanggal:10,
      alat:'', ket:'Bulan terakhir tiap triwulan, sesudah laporan bulanan ditutup.' }
  ],
  radkom: [
    { id:'k1', nama:'Uji rekaman suara semua kanal', jenis:'mingguan', hari:1, bulan:null, tanggal:null,
      alat:'', ket:'' },
    { id:'k2', nama:'Kalibrasi headset dan mikrofon meja', jenis:'bulanan', hari:null, bulan:null, tanggal:12,
      alat:'', ket:'' },
    { id:'k3', nama:'Uji penuh sistem perekam suara', jenis:'semesteran', hari:null, bulan:1, tanggal:15,
      alat:'', ket:'Bersama pengawas operasi.' }
  ],
  listrikmekanik: [
    { id:'k1', nama:'Uji nyala genset tanpa beban', jenis:'mingguan', hari:5, bulan:null, tanggal:null,
      alat:'', ket:'Minimal 15 menit. Catat jam operasi dan suhu air.' },
    { id:'k2', nama:'Periksa level elektrolit baterai UPS', jenis:'bulanan', hari:null, bulan:null, tanggal:3,
      alat:'', ket:'' },
    { id:'k3', nama:'Uji beban penuh genset dan serah terima', jenis:'tahunan', hari:null, bulan:8, tanggal:20,
      alat:'', ket:'Sekali setahun, Agustus. Perlu koordinasi dengan operasi.' }
  ]
};

const BKL = {
  kegiatan: {},        // { unit: [kegiatan] }
  selesai:  {},        // { 'unit|id|periode': {oleh, nama, jam} }
  sunting:  false,
  draf:     null,
  unit:     null       // unit yang drafnya sedang dibuka
};

/* =======================================================================
   KEGIATAN YANG TANDANYA DATANG DARI E-LOGBOOK

   Kegiatan berkala boleh menyebut SUMBER tandanya: bukan dicentang orang di
   sini, melainkan dibuktikan lembar yang sudah diisi di E-Logbook.

   Sebelum ini kegiatannya harus dicentang lagi di dashboard: dua catatan
   untuk satu pekerjaan, dan yang satu bisa berkata sudah sementara lembarnya
   kosong. Sekarang tandanya DIBACA dari lembar itu — dashboard ini tidak
   menyimpan apa pun tentangnya, dan tidak bisa mengarangnya.

   Yang dibaca cuma TANGGAL lembarnya. Isi per site, tanda tangan, dan
   kategorinya tetap tinggal di E-Logbook; menyalinnya ke sini hanya
   melahirkan salinan yang lebih tua dari aslinya.

   Tanpa sambungan ke server (data contoh), kegiatan bersumber lembar jatuh
   kembali ke tanda manual — tidak ada lembar untuk dibaca, dan kartu yang
   selamanya "belum" tidak memperlihatkan apa pun.

   ---- Menambah sumber baru ----

   Yang pertama disambungkan DS Test, dan DS Test cuma ada di satu unit. Karena
   itu daftar di bawah dibuat sebagai REGISTRI, bukan sederet perbandingan
   "sumber === dstest" yang tersebar: menyambungkan formulir E-Logbook
   berikutnya cukup menambah satu baris di sini, dan seluruh layar — cip di
   kartu, pemilih di mode sunting, tombol tautan, Kotak Masuk — ikut sendiri.

   Satu baris menyebut tujuh hal, kadang delapan:
     label  sebutan panjang, untuk pemilih di mode sunting
     cip    sebutan pendek, untuk cip di kartu dan di Kotak Masuk
     judul  nama tabnya, untuk label tombol ("Buka DS Test")
     sebut  sebutan di dalam kalimat ("menunggu lembar DS Test")
     paket  nama larik pada jawaban getAllData E-Logbook
     tab    tab E-Logbook untuk tautan #<tab>:<unit>, lihat kotakTautanForm()
     ada    penanda per unit di daftar unit E-Logbook — unit yang tidak punya
            formulirnya tidak dipasangi tombol yang menuju tab tersembunyi
     saring boleh tidak ada. Dipakai kalau beberapa sumber berbagi satu larik
            dan dibedakan kolom di dalamnya — empat lembar pekerjaan berkala
            Radtel semuanya datang di larik berkala, dipisah kolom Jenis
   ditambah tiga pembaca baris (tgl, nama, rinci), karena tiap formulir menamai
   kolomnya sendiri-sendiri dan bentuk itu milik E-Logbook, bukan milik sini.

   LTK sengaja TIDAK ada di daftar ini walau tabnya ada di semua unit: LTK
   dibuat waktu ada kerusakan, bukan menurut putaran waktu. Memakainya sebagai
   bukti kegiatan berkala berarti pekerjaan rutin baru terhitung selesai kalau
   ada yang rusak.
   ======================================================================= */

/** Lembar E-Logbook yang jadi bukti: { sumber: { unit: [baris] } }. */
let BUKTI = {};

/** Penanda formulir per unit, apa adanya dari daftar unit E-Logbook. Dipakai
    untuk memutuskan tombol tautannya dipasang atau tidak. */
let UNIT_FORM = {};

const BERKALA_SUMBER = {
  '': { label: ['Ditandai di sini', 'Ticked off here'] },

  /* DS Test radtel jatuh Senin, Rabu, dan Sabtu. Satu hari bisa punya beberapa
     lembar — domestik, internasional, SLI & GSM, PABX masing-masing satu — dan
     satu saja sudah cukup jadi bukti hari itu dikerjakan. */
  dstest: {
    label: ['Lembar DS Test E-Logbook', 'E-Logbook DS Test sheet'],
    cip:   'DS TEST',  judul: 'DS Test',
    sebut: ['lembar DS Test', 'the DS Test sheet'],
    paket: 'dstest',  tab: 'dstest',  ada: 'adaDsTest',
    tgl:   (x)=> isoTgl(x.Tanggal) || isoTgl(x.DibuatPada),
    nama:  (x)=> x.TeknisiNama || x.DiinputOleh,
    rinci: (x)=> x.Kategori || ''
  },

  /* Daily Check diisi tiap dinas, jadi satu tanggal bisa punya beberapa lembar
     — dan yang membedakannya kolom Dinas, bukan kategori. Tanggalnya diambil
     dari TanggalIso lebih dulu: kolom Tanggal di formulir itu teks yang
     diketik orang, dan yang dicocokkan di sini tanggal kalender. */
  dailycheck: {
    label: ['Lembar Daily Check E-Logbook', 'E-Logbook Daily Check sheet'],
    cip:   'DAILY CHECK',  judul: 'Daily Check',
    sebut: ['lembar Daily Check', 'the Daily Check sheet'],
    paket: 'dcHistory',  tab: 'dailycheck',  ada: 'adaDailyCheck',
    tgl:   (x)=> isoTgl(x.TanggalIso) || isoTgl(x.Tanggal) || isoTgl(x.DibuatPada),
    nama:  (x)=> x.TeknisiNama || x.DiinputOleh,
    rinci: (x)=> x.Dinas || ''
  },

  /* Monitoring Frekuensi — satu lembar berisi banyak baris pengamatan, dan
     yang menandatanganinya dua orang: teknik dan operasi. Yang disebut di
     dashboard yang teknik, karena kegiatannya kegiatan teknik. */
  monitoring: {
    label: ['Lembar Monitoring Frekuensi E-Logbook', 'E-Logbook frequency monitoring sheet'],
    cip:   'MONITORING',  judul: 'Monitoring Frekuensi',
    sebut: ['lembar Monitoring Frekuensi', 'the frequency monitoring sheet'],
    paket: 'monitoring',  tab: 'monitoring',  ada: 'adaMonitoring',
    tgl:   (x)=> isoTgl(x.Tanggal) || isoTgl(x.DibuatPada),
    nama:  (x)=> x.PersonilTeknik || x.DiinputOleh,
    rinci: ()=> ''
  },

  /* ---- Empat lembar pekerjaan berkala Radtel ----
     Di E-Logbook keempatnya satu tabel dan satu jendela pengisian, dibedakan
     kolom Jenis; yang berbeda cuma daftar barisnya. Di sini tetap empat sumber
     terpisah, dan itu bukan pengulangan yang bisa dipadatkan: yang membuktikan
     Cleaning CWP bukan lembar Restart CWP, walau keduanya datang lewat pintu
     yang sama. Karena itu tiap baris menyaring lariknya sendiri.

     Keempatnya hanya ada di Radtel, jadi ada-nya satu: adaBerkala. Unit lain
     yang memilih sumber ini akan diberi tahu lembarnya tidak ada di sana —
     lihat salahForm di bklIsi(). */
  'bk-neptuno': {
    label: ['Lembar Cek Query Neptuno E-Logbook', 'E-Logbook Neptuno query check sheet'],
    cip:   'CEK NEPTUNO',  judul: 'Cek Query Neptuno',
    sebut: ['lembar Cek Query Neptuno', 'the Neptuno query check sheet'],
    paket: 'berkala',  tab: 'bk-neptuno',  ada: 'adaBerkala',
    saring:(x)=> x.Jenis === 'neptuno',
    tgl:   (x)=> isoTgl(x.Tanggal) || isoTgl(x.DibuatPada),
    nama:  (x)=> x.TeknisiNama || x.DiinputOleh,
    rinci: ()=> ''
  },

  'bk-gatevox': {
    label: ['Lembar Restart CPU Gatevox E-Logbook', 'E-Logbook Gatevox CPU restart sheet'],
    cip:   'RESTART GATEVOX',  judul: 'Restart CPU Gatevox',
    sebut: ['lembar Restart CPU Gatevox', 'the Gatevox CPU restart sheet'],
    paket: 'berkala',  tab: 'bk-gatevox',  ada: 'adaBerkala',
    saring:(x)=> x.Jenis === 'gatevox',
    tgl:   (x)=> isoTgl(x.Tanggal) || isoTgl(x.DibuatPada),
    nama:  (x)=> x.TeknisiNama || x.DiinputOleh,
    rinci: ()=> ''
  },

  'bk-cleaning': {
    label: ['Lembar Cleaning CWP E-Logbook', 'E-Logbook CWP cleaning sheet'],
    cip:   'CLEANING CWP',  judul: 'Cleaning CWP',
    sebut: ['lembar Cleaning CWP', 'the CWP cleaning sheet'],
    paket: 'berkala',  tab: 'bk-cleaning',  ada: 'adaBerkala',
    saring:(x)=> x.Jenis === 'cleaning-cwp',
    tgl:   (x)=> isoTgl(x.Tanggal) || isoTgl(x.DibuatPada),
    nama:  (x)=> x.TeknisiNama || x.DiinputOleh,
    rinci: ()=> ''
  },

  'bk-restart': {
    label: ['Lembar Restart CWP E-Logbook', 'E-Logbook CWP restart sheet'],
    cip:   'RESTART CWP',  judul: 'Restart CWP',
    sebut: ['lembar Restart CWP', 'the CWP restart sheet'],
    paket: 'berkala',  tab: 'bk-restart',  ada: 'adaBerkala',
    saring:(x)=> x.Jenis === 'restart-cwp',
    tgl:   (x)=> isoTgl(x.Tanggal) || isoTgl(x.DibuatPada),
    nama:  (x)=> x.TeknisiNama || x.DiinputOleh,
    rinci: ()=> ''
  }
};

/** Baris registri untuk satu kegiatan. Sumber yang tidak dikenal — kegiatan
    lama, atau berkas yang disunting tangan — dibaca sebagai tanda manual,
    bukan dijatuhkan. */
const bklSumber = (k) => (k && BERKALA_SUMBER[k.sumber]) || BERKALA_SUMBER[''];

/** Kegiatan ini tandanya sedang benar-benar dibaca dari E-Logbook? Butuh dua
    hal: kegiatannya memang menyebut sumber, DAN ada server untuk dibaca. */
const bklDariElogbook = (k) => SRV.aktif && !!bklSumber(k).paket;

/** Unit ini memang punya formulirnya di E-Logbook? Dijawab dari daftar unit
    yang dikirim server. Selama daftarnya belum ada — data contoh, atau
    pemuatan yang gagal — dijawab false: tombol yang menuju tab tersembunyi
    lebih buruk daripada tidak ada tombol. */
function bklFormAda(unit, k){
  const s = bklSumber(k);
  return !!s.ada && !!(UNIT_FORM[unit] || {})[s.ada];
}

/**
 * Pilihan "Tanda selesai" untuk satu unit — hanya lembar yang MEMANG ADA di
 * sana.
 *
 * Sebelum ini daftarnya sama untuk semua unit. Radtel tidak punya Monitoring
 * Frekuensi, tapi tetap bisa memilihnya, dan kegiatan yang memilihnya akan
 * menunggu lembar yang tidak akan pernah datang — kartunya merah selamanya
 * tanpa satu pun petunjuk kenapa. Pilihan yang tidak mungkin benar lebih baik
 * tidak ditawarkan sejak awal.
 *
 * Dua hal tetap ditawarkan walau tidak lolos:
 *   — "Ditandai di sini", yang memang tidak butuh lembar apa pun;
 *   — sumber yang SEDANG dipakai kegiatan ini, diberi keterangan. Membuangnya
 *     dari daftar membuat pemilihnya menunjuk pilihan lain, dan menyimpan
 *     tanpa menyentuh kolom itu akan diam-diam mengganti sumbernya. Yang
 *     salah harus terlihat salah, bukan hilang.
 *
 * Selama daftar unit belum ada — data contoh, atau pemuatan yang gagal —
 * semuanya ditawarkan. Menyembunyikan pilihan karena tidak tahu jawabannya
 * lebih buruk daripada menawarkan terlalu banyak.
 */
function bklPilihanSumber(unit, k){
  const kini = (k && k.sumber) || '';
  const tahu = !!UNIT_FORM[unit];
  return Object.keys(BERKALA_SUMBER)
    .filter(s=>!s || s === kini || !tahu || bklFormAda(unit, { sumber:s }))
    .map(s=>{
      const label = T(...BERKALA_SUMBER[s].label);
      const hilang = s && tahu && !bklFormAda(unit, { sumber:s });
      return { nilai:s, label: hilang
        ? label + T(' — tidak ada di unit ini', ' — not in this unit') : label };
    });
}

/**
 * Cip sumber di kartu kegiatan — dan, kalau lembarnya memang bisa dituju,
 * sekaligus pintunya.
 *
 * Menekan cip DS TEST membuka tab DS Test di E-Logbook langsung, tanpa mampir
 * ke halaman depan. Itu jalan yang paling pendek dari "kartunya bilang belum"
 * ke "lembarnya diisi", dan cipnya memang tempat yang dicari orang: di situ
 * nama formulirnya tertulis.
 *
 * Jatuh kembali jadi cip biasa — tulisan, bukan tautan — dalam keadaan yang
 * sama dengan kotakTautanForm(): tidak bersumber lembar, alamat E-Logbook
 * belum diketahui, atau unit ini memang tidak punya formulirnya. Cip yang
 * kelihatan bisa ditekan lalu tidak melakukan apa-apa lebih buruk daripada
 * cip yang memang cuma keterangan.
 */
function bklCipSumber(unit, k){
  const f = bklSumber(k);
  if(!f.cip) return '';
  const ket = T('Tandanya dibaca dari ' + T(...f.sebut) + ' di E-Logbook, tidak dicentang di sini.',
                'The mark is read from ' + T(...f.sebut) + ' in E-Logbook, not ticked off here.');
  if(!f.tab || !TAUTAN_ELOGBOOK || !bklFormAda(unit, k)){
    return `<span class="cip" title="${esc(ket)}">${esc(f.cip)}</span>`;
  }
  return `<a class="cip" href="${esc(TAUTAN_ELOGBOOK)}#${esc(f.tab)}:${esc(unit)}"
    title="${esc(ket + ' ' + T('Tekan untuk membuka tab ' + f.judul + ' di sana.',
                               'Press to open the ' + f.judul + ' tab there.'))}">${esc(f.cip)}</a>`;
}

/** Lembar yang membuktikan kegiatan ini dikerjakan pada tanggal itu. Satu hari
    bisa punya beberapa lembar, dan satu saja sudah cukup jadi bukti. Yang
    ditampilkan lembar pertama; sisanya cuma dihitung. */
function bklBukti(unit, k, tanggal){
  if(!bklDariElogbook(k)) return null;
  const baris = ((BUKTI[k.sumber] || {})[unit] || []).filter(x=>x.tgl === tanggal);
  if(!baris.length) return null;
  return { ...baris[0], jumlah: baris.length,
           rinci: [...new Set(baris.map(x=>x.rinci).filter(Boolean))] };
}

/** Minggu ISO — bentuknya harus sama persis dengan yang di server.js, karena
    kunci catatan selesainya dirangkai dari sini dan diperiksa di sana. */
function pekanIso(d){
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const hari = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - hari);
  const awal = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const nomor = Math.ceil(((t - awal) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(nomor).padStart(2,'0')}`;
}
/** Kunci periode berjalan. Bentuknya harus sama persis dengan periodeSekarang()
    di server.js — catatan selesai dicocokkan dengan kunci ini. */
function periodeKini(jenis, d = new Date()){
  const tahun = d.getFullYear(), bulan = d.getMonth();
  switch(jenis){
    case 'mingguan':   return pekanIso(d);
    case 'triwulan':   return `${tahun}-Q${Math.floor(bulan / 3) + 1}`;
    case 'semesteran': return `${tahun}-S${Math.floor(bulan / 6) + 1}`;
    case 'tahunan':    return String(tahun);
    default:           return bulanKode(d);
  }
}

/** Tanggal sebagai 'YYYY-MM-DD' menurut jam setempat — bukan toISOString(),
    yang menggeser tanggal ke UTC dan membuat kejadian sebelum jam 07.00 WIB
    tercatat sebagai hari sebelumnya. */
const bklTgl = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${
  String(d.getDate()).padStart(2,'0')}`;

/** Kunci selesai untuk satu kejadian. Mingguan berkunci tanggal, sisanya tetap
    berkunci periode — bentuknya harus sama persis dengan server.js. */
const bklKunciTgl = (unit, k, tanggal) => k.jenis === 'mingguan'
  ? `${unit}|${k.id}|${tanggal}`
  : `${unit}|${k.id}|${periodeKini(k.jenis)}`;
/**
 * Sudah dikerjakan atau belum, untuk satu kejadian.
 *
 * Kegiatan yang bersumber E-Logbook dijawab lembarnya, dan hanya lembarnya:
 * catatan manual yang mungkin tertinggal dari sebelum kegiatannya disambungkan
 * sengaja tidak ikut dibaca. Kalau ikut, kartunya bisa berkata "sudah" karena
 * tanda lama, padahal lembar minggu ini belum ada — dan itu persis kesalahan
 * yang membuat penyambungannya perlu.
 */
function bklSudahTgl(unit, k, tanggal){
  if(bklDariElogbook(k)) return bklBukti(unit, k, tanggal);
  return BKL.selesai[bklKunciTgl(unit, k, tanggal)] || null;
}

const bklDaftar = (unit) => BKL.kegiatan[unit] || [];

/**
 * Hari-hari kegiatan mingguan sebagai daftar angka 1..7 (Senin..Minggu).
 *
 * Bentuk lama menyimpan satu angka, bukan daftar. Dibaca di sini supaya
 * kegiatan yang sudah terlanjur tersimpan — dan salinan halaman ini yang
 * lebih tua, yang masih mengirim angka tunggal — tidak perlu disentuh.
 * Jawabannya tidak pernah kosong: lihat sebabnya di rapikanKegiatan().
 */
function bklHariDaftar(k){
  const m = Array.isArray(k.hari) ? k.hari : (k.hari == null ? [] : [k.hari]);
  const d = [...new Set(m.map(h=>Number(h)).filter(h=>Number.isInteger(h) && h >= 1 && h <= 7))];
  return d.length ? d.sort((a,b)=>a-b) : [1];
}

/**
 * Tanggal jatuh tempo kegiatan ini di dalam periode yang sedang berjalan —
 * periode yang memuat `acuan`, bukan selalu hari ini.
 *
 * Untuk yang lebih panjang dari sebulan, `bulan` menunjuk bulan KE-BERAPA di
 * dalam putarannya, bukan bulan kalender: pekerjaan triwulan dengan bulan 2
 * jatuh di bulan Februari untuk triwulan pertama, dan bulan Mei untuk triwulan
 * kedua. Tahunan yang putarannya setahun penuh jadi pengecualian yang tidak
 * perlu disebut — di sana bulan ke-3 memang bulan Maret.
 */
function bklJatuh(k, acuan = new Date()){
  const tahun = acuan.getFullYear(), bulan = acuan.getMonth();
  const tanggal = Math.min(28, Math.max(1, Number(k.tanggal) || 1));
  const ke = Math.max(1, Number(k.bulan) || 1) - 1;

  switch(k.jenis){
    case 'bulanan':    return new Date(tahun, bulan, tanggal);
    case 'triwulan':   return new Date(tahun, Math.floor(bulan / 3) * 3 + Math.min(2, ke), tanggal);
    case 'semesteran': return new Date(tahun, Math.floor(bulan / 6) * 6 + Math.min(5, ke), tanggal);
    case 'tahunan':    return new Date(tahun, Math.min(11, ke), tanggal);
  }
  // Mingguan: kejadian PERTAMA pada minggu yang memuat acuan, dihitung dari
  // Senin. Kegiatan yang jatuh beberapa hari sepekan punya kejadian lain juga —
  // itu dijawab bklKejadian(). Fungsi ini tetap menjawab satu tanggal karena
  // pemanggil lamanya memang menanyakan satu.
  return bklKejadian(k, acuan)[0];
}

/**
 * Seluruh tanggal kejadian kegiatan ini di dalam periode yang memuat `acuan`.
 *
 * Kegiatan mingguan bisa jatuh beberapa hari sepekan — DS Test Senin, Rabu,
 * Sabtu — dan masing-masing perlu ditandai sendiri. Untuk jenis lain
 * jawabannya satu tanggal, jatuh temponya sendiri.
 *
 * Saling menyebut dengan bklJatuh(), dan itu aman: jenis selain mingguan
 * berhenti di switch bklJatuh() sebelum sampai ke sini, dan yang mingguan
 * dihitung di sini tanpa memanggil balik.
 */
function bklKejadian(k, acuan = new Date()){
  if(k.jenis !== 'mingguan') return [bklJatuh(k, acuan)];
  const kini = acuan.getDay() || 7;
  const senin = new Date(acuan);
  senin.setDate(acuan.getDate() - (kini - 1));
  senin.setHours(0,0,0,0);
  return bklHariDaftar(k).map(h=>{
    const t = new Date(senin);
    t.setDate(senin.getDate() + (h - 1));
    return t;
  });
}

/* Warna cip jenis. Hanya dua yang diberi warna — mingguan dan bulanan, yang
   memang paling sering datang; tiga yang lebih panjang dibiarkan polos supaya
   warna di kartu ini tetap berarti "seberapa sering", bukan "seberapa gawat".
   Warna kegawatan sudah dipakai di kaki kartunya. */
const bklRupaJenis = (j) => j === 'mingguan' ? 'aman' : j === 'bulanan' ? 'awas' : '';

/** Kalimat pendek "kapan pekerjaan ini jatuh", untuk kepala kartunya. */
function bklKapan(k){
  const tgl = Number(k.tanggal) || 1;
  const ke  = Number(k.bulan) || 1;
  const urutEn = tgl === 1 ? 'st' : tgl === 2 ? 'nd' : tgl === 3 ? 'rd' : 'th';
  switch(k.jenis){
    case 'bulanan':
      return T(`tiap tanggal ${tgl}`, `on the ${tgl}${urutEn} of the month`);
    case 'triwulan':
      return T(`tiap triwulan · bulan ke-${ke} tgl ${tgl}`,
               `every quarter · month ${ke}, day ${tgl}`);
    case 'semesteran':
      return T(`tiap semester · bulan ke-${ke} tgl ${tgl}`,
               `every half-year · month ${ke}, day ${tgl}`);
    case 'tahunan':
      return T(`tiap ${tgl} ${T(...BULAN_NAMA[Math.min(11, ke - 1)])}`,
               `every ${tgl} ${T(...BULAN_NAMA[Math.min(11, ke - 1)])}`);
    default: {
      const nama = bklHariDaftar(k).map(hariNama);
      return T(`tiap ${nama.join(', ')}`, `every ${nama.join(', ')}`);
    }
  }
}

/* ---------- Ambil dan simpan ---------- */

function bklLokalMuat(){
  try{
    const s = JSON.parse(localStorage.getItem(BERKALA_KUNCI) || 'null');
    if(s && s.kegiatan) return s;
  }catch(e){ /* rusak: pakai contoh */ }
  return { kegiatan: JSON.parse(JSON.stringify(BERKALA_CONTOH)), selesai:{} };
}
function bklLokalSimpan(){
  try{ localStorage.setItem(BERKALA_KUNCI,
    JSON.stringify({ kegiatan:BKL.kegiatan, selesai:BKL.selesai })); }
  catch(e){ console.warn('Kegiatan berkala tidak bisa disimpan di peramban:', e && e.message || e); }
}

async function bklMuat(){
  if(!SRV.aktif){
    const s = bklLokalMuat();
    BKL.kegiatan = s.kegiatan; BKL.selesai = s.selesai || {};
    return;
  }
  try{
    const r = await srvFetch('/berkala', {}, 10000);
    const j = await r.json().catch(()=>null);
    if(!r.ok) throw new Error((j && j.error) || ('server menjawab ' + r.status));
    BKL.kegiatan = (j && j.kegiatan) || {};
    BKL.selesai  = (j && j.selesai)  || {};
  }catch(e){
    console.warn('Kegiatan berkala tidak bisa diambil:', e && e.message || e);
    BKL.kegiatan = {}; BKL.selesai = {};
  }
}

async function bklSimpanUnit(unit, kegiatan){
  if(!SRV.aktif){
    if(kegiatan.length) BKL.kegiatan[unit] = kegiatan; else delete BKL.kegiatan[unit];
    bklLokalSimpan();
    aktCatat('berkala', 'atur', unit, `${kegiatan.length} ${T('kegiatan','jobs')}`);
    return;
  }
  const r = await srvFetch('/berkala/' + unit, {
    method:'PUT', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ kegiatan })
  }, 12000);
  const j = await r.json().catch(()=>null);
  if(!r.ok) throw new Error((j && j.error) || ('server menjawab ' + r.status));
  if(kegiatan.length) BKL.kegiatan[unit] = kegiatan; else delete BKL.kegiatan[unit];
}

async function bklTandai(unit, k, batal, tanggal){
  const kunci = bklKunciTgl(unit, k, tanggal);
  if(!SRV.aktif){
    if(batal) delete BKL.selesai[kunci];
    else BKL.selesai[kunci] = {
      oleh: akun ? akun.user : '—', nama: akun ? akun.nama : '—', jam: new Date().toISOString()
    };
    bklLokalSimpan();
    aktCatat('berkala', batal ? 'batal-selesai' : 'selesai', unit, k.nama);
    return;
  }
  const r = await srvFetch('/berkala/selesai', {
    method:'POST', headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ unit, id:k.id, batal: !!batal, tanggal })
  }, 10000);
  const j = await r.json().catch(()=>null);
  if(!r.ok) throw new Error((j && j.error) || ('server menjawab ' + r.status));
  if(batal) delete BKL.selesai[kunci];
  else BKL.selesai[kunci] = (j && j.selesai) || { oleh: akun.user, nama: akun.nama, jam:new Date().toISOString() };
}

/* ---------- Yang jatuh tempo, lintas unit ---------- */

/**
 * Kegiatan yang periode berjalannya belum ditandai selesai.
 *
 * Yang dikembalikan sudah diurut dari yang paling mendesak: yang tanggalnya
 * sudah lewat lebih dulu, baru yang akan datang. Unit yang tidak boleh dibuka
 * akun ini dilewati — memberi tahu orang tentang pekerjaan yang tidak bisa ia
 * lihat rinciannya hanya melahirkan pertanyaan, bukan pekerjaan yang selesai.
 */
function bklJatuhTempo(hanyaUnit){
  const keluar = [];
  Object.entries(BKL.kegiatan).forEach(([unit, daftar])=>{
    if(hanyaUnit && unit !== hanyaUnit) return;
    if(!hanyaUnit && !bolehBuka(unit)) return;
    (daftar || []).forEach(k=>{
      const kini = new Date(); kini.setHours(0,0,0,0);
      bklKejadian(k).forEach(j=>{
        const tanggal = bklTgl(j);
        if(bklSudahTgl(unit, k, tanggal)) return;
        keluar.push({ unit, k, tanggal, sisa: Math.round((j - kini) / 86400000) });
      });
    });
  });
  return keluar.sort((a,b)=>a.sisa - b.sisa);
}

/** Kegiatan yang jatuh pada satu tanggal tertentu di bulan yang sedang dilihat.
    Dijawab lewat bklJatuh() dengan tanggal itu sebagai acuan, bukan dengan
    membandingkan kolomnya satu per satu: sejak ada triwulan dan semesteran,
    "tanggal 5" saja tidak cukup — bulannya ikut menentukan. */
function bklPadaHari(unit, bulan, hari){
  const tgl = new Date(Number(bulan.slice(0,4)), Number(bulan.slice(5,7)) - 1, hari);
  // bklKejadian(), bukan bklJatuh(): kegiatan tiga hari sepekan harus tertandai
  // di ketiga tanggalnya, bukan cuma di yang pertama.
  return bklDaftar(unit).filter(k=>bklKejadian(k, tgl).some(j=>
    j.getFullYear() === tgl.getFullYear()
    && j.getMonth() === tgl.getMonth()
    && j.getDate()  === tgl.getDate()));
}

/* ---------- Subtab Kegiatan Berkala ---------- */

function bklIsi(unit){
  const boleh = BOLEH.berkala && JDW.bisaTulis;
  const daftar = BKL.sunting && BKL.unit === unit ? BKL.draf : bklDaftar(unit);

  const kepala = `
    <div class="atur-data">
      <span class="ket">${daftar.length} ${T('kegiatan berkala di unit ini','recurring jobs in this unit')}
        · ${T('pekan','week')} ${esc(periodeKini('mingguan'))}</span>
      <span class="tombol">
        ${BKL.sunting
          ? `<button class="btn garis kecil" id="bklBatal">${T('Batal','Cancel')}</button>
             <button class="btn garis kecil" id="bklTambah">${T('Tambah kegiatan','Add a job')}</button>
             <button class="btn kecil" id="bklSimpan">${T('Simpan kegiatan','Save jobs')}</button>`
          : boleh
            ? `<button class="btn kecil" id="bklSunting">${T('Atur kegiatan','Set up jobs')}</button>`
            : ''}
      </span>
    </div>
    ${boleh || BKL.sunting ? '' : `<div class="catatan" style="margin-top:0"><b>${
      T('Anda hanya bisa melihat daftar ini.','You can only view this list.')}</b> ${esc(hakSebab('berkala'))} ${
      T('Menandai pekerjaan sudah dikerjakan tetap boleh — itu memang pekerjaan yang berdinas.',
        'Ticking a job off is still allowed — that is the work of whoever is on duty.')}</div>`}`;

  if(BKL.sunting && BKL.unit === unit){
    const baris = daftar.map((k,i)=>`
      <div class="bkl-sunting" data-i="${i}">
        <div class="isian" style="margin-bottom:0;flex:2;min-width:190px">
          <label>${T('Pekerjaan','Job')}</label>
          <input type="text" data-bkl="${i}" data-kolom="nama" value="${esc(k.nama || '')}"
            placeholder="${T('mis. Periksa daya pancar','e.g. Check transmit power')}"></div>
        <div class="isian" style="margin-bottom:0;min-width:130px">
          <label>${T('Ulangan','Repeats')}</label>
          <select data-bkl="${i}" data-kolom="jenis">${BERKALA_JENIS.map(j=>
            `<option value="${j}"${k.jenis===j?' selected':''}>${esc(bklJenisNama(j))}</option>`).join('')}
          </select></div>
        ${BERKALA_PANJANG[k.jenis] ? `
        <div class="isian" style="margin-bottom:0;min-width:150px">
          <label>${k.jenis === 'tahunan' ? T('Bulan','Month') : T('Bulan ke-','Month of period')}</label>
          <select data-bkl="${i}" data-kolom="bulan">${
            Array.from({ length: BERKALA_PANJANG[k.jenis] }, (_,b)=>
              `<option value="${b+1}"${Number(k.bulan)===b+1?' selected':''}>${
                k.jenis === 'tahunan' ? esc(T(...BULAN_NAMA[b]))
                                      : esc(T(`Bulan ke-${b+1}`, `Month ${b+1}`))}</option>`).join('')}
          </select></div>` : ''}
        <div class="isian" style="margin-bottom:0;min-width:${k.jenis === 'mingguan' ? 230 : 120}px">
          <label>${k.jenis === 'mingguan' ? T('Hari','Weekdays') : T('Tanggal','Day of month')}</label>
          ${k.jenis === 'mingguan'
            ? `<div style="display:flex;gap:7px;flex-wrap:wrap;padding:7px 0">${
                HARI_NAMA.map((_,h)=>{
                  const aktif = bklHariDaftar(k).includes(h + 1);
                  return `<label style="display:inline-flex;align-items:center;gap:4px;font-size:11.5px">
                    <input type="checkbox" data-bkl-hari="${i}" value="${h+1}"${aktif?' checked':''}>
                    ${esc(hariNama(h+1).slice(0,3))}</label>`;
                }).join('')}</div>`
            : `<input type="number" min="1" max="28" data-bkl="${i}" data-kolom="tanggal"
                 value="${Number(k.tanggal) || 1}">`}</div>
        <div class="isian" style="margin-bottom:0;min-width:130px">
          <label>${T('Shift','Shift')}</label>
          <select data-bkl="${i}" data-kolom="shift">${BERKALA_SHIFT.map(s=>
            `<option value="${s}"${bklShift(k) === s ? ' selected' : ''}>${
              esc(bklShiftNama(s))}</option>`).join('')}
          </select></div>
        <div class="isian" style="margin-bottom:0;min-width:200px">
          <label>${T('Tanda selesai','Completion mark')}</label>
          <select data-bkl="${i}" data-kolom="sumber">${bklPilihanSumber(unit, k).map(o=>
            `<option value="${o.nilai}"${(k.sumber || '') === o.nilai ? ' selected' : ''}>${
              esc(o.label)}</option>`).join('')}
          </select></div>
        <div class="isian" style="margin-bottom:0;flex:2;min-width:170px">
          <label>${T('Catatan','Notes')}</label>
          <input type="text" data-bkl="${i}" data-kolom="ket" value="${esc(k.ket || '')}"></div>
        <button class="btn garis kecil" data-bkl-buang="${i}"
          title="${T('Hapus kegiatan ini','Delete this job')}">✕</button>
      </div>`).join('');

    return kepala + `<div class="panel"><div class="badan">${baris || `
      <div style="color:var(--muted);font-size:12.5px">${
        T('Belum ada kegiatan. Tekan Tambah kegiatan.','No jobs yet. Press Add a job.')}</div>`}</div></div>
      <div class="catatan"><b>${T('Shift menentukan lonceng siapa yang berbunyi.',
        'The shift decides whose bell rings.')}</b> ${
        T('Pekerjaan ber-shift PS hanya diberitahukan ke yang berdinas pagi–siang, dan Malam '
        + 'hanya ke yang berdinas malam. Biarkan "Semua shift" kalau memang boleh dikerjakan '
        + 'siapa saja yang ada — itu yang berlaku untuk semua kegiatan yang sudah tersimpan '
        + 'sebelumnya. Menandai selesai tetap boleh dilakukan siapa pun; yang disaring hanya '
        + 'pemberitahuannya.',
          'A job on PS is only announced to the day crew, and Malam only to the night crew. Leave it '
        + 'on "Any shift" if anyone on duty may do it — that is what applies to every job saved '
        + 'before this. Ticking a job off is still open to anyone; only the notification is filtered.')}
        <br><b>${T('Tanggal 29, 30, dan 31 sengaja tidak ada.',
        'The 29th, 30th, and 31st are deliberately missing.')}</b> ${
        T('Bulan Februari tidak punya ketiganya, dan pekerjaan yang jatuh pada tanggal yang tidak ada '
        + 'tidak akan pernah muncul sama sekali. Pilih tanggal 28 ke bawah.',
          'February has none of them, and a job falling on a date that does not exist would never appear at '
        + 'all. Choose the 28th or earlier.')}
        <br><b>${T('Bulan ke- dihitung dari awal putarannya.','The month is counted from the start of the period.')}</b> ${
        T('Pekerjaan triwulan dengan bulan ke-2 jatuh di Februari untuk triwulan pertama, Mei untuk '
        + 'triwulan kedua, dan seterusnya — jadi ia benar-benar berulang tiap tiga bulan. Hanya pada '
        + 'Tahunan bulannya bulan kalender biasa.',
          'A quarterly job set to month 2 falls in February for the first quarter, May for the second, and '
        + 'so on — so it really does come round every three months. Only on Yearly is the month an '
        + 'ordinary calendar month.')}</div>`;
  }

  const kartu = daftar.map(k=>{
    const kini = new Date(); kini.setHours(0,0,0,0);
    const kejadian = bklKejadian(k).map(j=>({
      tanggal: bklTgl(j),
      hari: j.getDay() || 7,
      sisa: Math.round((j - kini) / 86400000),
      sudah: bklSudahTgl(unit, k, bklTgl(j))
    }));
    // Warna kartunya diambil dari kejadian paling mendesak yang belum beres:
    // satu hari yang sudah lewat tetap harus terlihat merah walau dua hari
    // lain di pekan yang sama sudah dicentang.
    const belum = kejadian.filter(x=>!x.sudah).sort((a,b)=>a.sisa - b.sisa)[0];
    const rupa = !belum ? 'aman' : belum.sisa < 0 ? 'bahaya' : belum.sisa <= 1 ? 'awas' : '';
    // Nama harinya disebut hanya kalau kejadiannya lebih dari satu. Pada
    // kegiatan bulanan yang memang cuma jatuh sekali, "Rabu ·" tidak
    // menambah apa pun selain panjang baris.
    const banyak = kejadian.length > 1;
    // Tanda yang dibaca dari E-Logbook tidak bisa ditekan dari sini — tombolnya
    // diganti keterangan asalnya, supaya yang membaca tahu ke mana harus pergi
    // kalau tandanya belum muncul.
    const dariEl = bklDariElogbook(k);
    return `<article class="bkl-kartu ${rupa}">
      <div class="bkl-atas">
        <span class="cip ${bklRupaJenis(k.jenis)}">${esc(bklJenisNama(k.jenis).toUpperCase())}</span>
        ${bklCipSumber(unit, k)}
        ${bklShift(k) ? `<span class="cip bkl-shift" title="${
          T('Dikerjakan rombongan ini','Done by this crew')}">${esc(bklShiftNama(bklShift(k)))}</span>` : ''}
        <span class="mono bkl-kapan">${esc(bklKapan(k))}</span>
      </div>
      <h4>${esc(k.nama)}</h4>
      ${k.ket ? `<p>${esc(k.ket)}</p>` : ''}
      ${kejadian.map(x=>{
        const hari = banyak ? esc(hariNama(x.hari)) + ' · ' : '';
        // Yang membedakan lembar sehari berbeda tiap formulir — kategori pada
        // DS Test, dinas pada Daily Check — jadi yang disebut apa pun yang
        // dikembalikan registrinya, tanpa dinamai di sini.
        const lembar = x.sudah && Array.isArray(x.sudah.rinci) && x.sudah.rinci.length
          ? ' · ' + esc(x.sudah.rinci.join(', ')) : '';
        return `<div class="bkl-kaki">
        ${x.sudah
          ? `<span class="bkl-status aman">${hari}${T('Sudah dikerjakan','Done')} · ${esc(x.sudah.nama || x.sudah.oleh)}${lembar}
              <span class="mono">${new Date(x.sudah.jam).toLocaleDateString(LOKAL(),{day:'numeric',month:'short'})}</span></span>`
          : `<span class="bkl-status ${x.sisa < 0 ? 'bahaya' : x.sisa <= 1 ? 'awas' : ''}">${hari}${
              x.sisa < 0 ? T(`Lewat ${-x.sisa} hari`, `${-x.sisa} days overdue`)
              : x.sisa === 0 ? T('Jatuh tempo hari ini','Due today')
              : T(`${x.sisa} hari lagi`, `in ${x.sisa} days`)}</span>`}
        ${dariEl
          ? `<span class="mono" style="font-size:10.5px;color:var(--muted);white-space:nowrap">${
              x.sudah ? T('dari ' + T(...bklSumber(k).sebut), 'from ' + T(...bklSumber(k).sebut))
                      : T('menunggu ' + T(...bklSumber(k).sebut), 'awaiting ' + T(...bklSumber(k).sebut))}</span>`
          : `<button class="btn ${x.sudah ? 'garis ' : ''}kecil" data-bkl-tandai="${esc(k.id)}"
              data-tanggal="${esc(x.tanggal)}" data-batal="${x.sudah ? '1' : ''}">${x.sudah
                ? T('Batalkan tanda','Undo')
                : T('Tandai selesai','Mark done')}</button>`}
      </div>`;}).join('')}
    </article>`;
  }).join('');

  /* Keterangan sambungan hanya muncul kalau unit ini memang punya kegiatan
     yang bersumber E-Logbook. Ditulis dua rupa: yang tersambung perlu tahu
     lembarnya diisi di mana, yang memakai data contoh perlu tahu kenapa
     tombolnya masih ada. Sumber yang disebut yang benar-benar dipakai unit
     ini — menyebut ketiganya pada unit yang cuma punya satu hanya membuat
     kalimatnya panjang tanpa menambah apa pun. */
  const sumberDipakai = [...new Set(daftar.map(k=>k.sumber)
    .filter(x=>x && BERKALA_SUMBER[x] && BERKALA_SUMBER[x].paket))];
  const cipDipakai = sumberDipakai.map(x=>BERKALA_SUMBER[x].cip).join(' / ');
  const lembarDipakai = sumberDipakai.map(x=>T(...BERKALA_SUMBER[x].sebut)).join(' / ');

  /* Kegiatan yang menyebut formulir yang TIDAK dimiliki unit ini. Tandanya
     tidak akan pernah datang — bukan karena pekerjaannya belum dilakukan,
     melainkan karena lembarnya memang tidak ada di sana. Dibiarkan diam,
     kartunya akan selamanya merah dan tidak seorang pun tahu sebabnya. */
  const salahForm = SRV.aktif
    ? daftar.filter(k=>bklDariElogbook(k) && !bklFormAda(unit, k)) : [];

  const ketDs = !sumberDipakai.length ? '' : `<div class="catatan"><b>${
    T('Ada kegiatan yang tandanya datang dari E-Logbook.',
      'Some jobs get their mark from E-Logbook.')}</b> ${SRV.aktif
    ? T(`Kegiatan bercip ${cipDipakai} tidak dicentang di sini. Tandanya dibaca dari ${lembarDipakai} `
      + 'yang tersimpan di E-Logbook: begitu lembar hari itu diisi di sana, kartunya berubah '
      + 'sendiri. Kalau tandanya belum muncul padahal pekerjaannya sudah dilakukan, yang belum '
      + 'ada lembarnya — bukan tandanya.',
        `Jobs tagged ${cipDipakai} are not ticked off here. The mark is read from ${lembarDipakai} `
      + 'stored in E-Logbook: as soon as that day\'s sheet is filled in there, the card changes '
      + 'by itself. If the mark is missing even though the work was done, what is missing is the '
      + 'sheet, not the mark.')
    : T(`Halaman ini sedang memakai data contoh, jadi tidak ada ${lembarDipakai} untuk dibaca — `
      + 'kegiatannya jatuh kembali ke tanda manual. Tersambung ke server, tombolnya hilang dan '
      + 'tandanya mengikuti lembar di E-Logbook.',
        `This page is on sample data, so there is no ${lembarDipakai} to read — those jobs fall back `
      + 'to a manual tick. Connected to the server, the button disappears and the mark follows the '
      + 'sheet in E-Logbook.')}${salahForm.length ? `<br><br><b>${
    T('Satu hal yang perlu dibetulkan.','One thing needs fixing.')}</b> ${
    T(`${salahForm.map(k=>'"' + k.nama + '"').join(', ')} menunggu lembar yang tidak dimiliki unit ini di `
      + 'E-Logbook, jadi tandanya tidak akan pernah datang. Ganti sumbernya lewat Atur kegiatan, atau '
      + 'kembalikan ke tanda manual dengan tombol di bawah.',
        `${salahForm.map(k=>'"' + k.nama + '"').join(', ')} waits on a sheet this unit does not have in `
      + 'E-Logbook, so the mark will never arrive. Change its source under Set up jobs, or use the '
      + 'button below to put it back on a manual tick.')}${boleh
    ? `<br><br><button class="btn kecil" id="bklBetulkan">${
        T(`Kembalikan ${salahForm.length} kegiatan ke tanda manual`,
          `Put ${salahForm.length} job(s) back on a manual tick`)}</button>` : ''}` : ''}</div>`;

  return kepala
    + (daftar.length
        ? `<div class="bkl-grid">${kartu}</div>`
        : `<div class="panel"><div class="badan" style="color:var(--muted);font-size:12.5px;line-height:1.7">
            ${T('Belum ada kegiatan berkala untuk unit ini.','No recurring jobs for this unit yet.')}
            ${boleh ? T('Tekan Atur kegiatan untuk mengisinya.','Press Set up jobs to fill it in.') : ''}</div></div>`)
    + `<div class="catatan"><b>${T('Tandanya ikut ke jadwal dan ke beranda.',
        'The marks travel to the roster and to the home screen.')}</b> ${
        T('Tanggal yang ada pekerjaannya diberi tanda di baris atas tabel Jadwal Dinas, dan yang belum '
        + 'dikerjakan sampai jatuh tempo muncul di beranda serta di lonceng akun orang yang berdinas '
        + 'hari itu. Menandai selesai berlaku untuk periode berjalan saja — minggu depan ia kembali '
        + 'kosong dengan sendirinya.',
          'Dates with work on them are marked on the top row of the Duty Roster table, and anything still '
        + 'undone at its due date appears on the home screen and in the notification bell of whoever is on '
        + 'duty that day. Marking a job done applies to the current period only — next week it empties '
        + 'itself again.')}</div>`
    + ketDs;
}

function bklGambar(){
  const kotak = el('s-berkala');
  if(!kotak || !unitDibuka) return;
  kotak.innerHTML = bklIsi(unitDibuka);
  bklPasang(unitDibuka);
  bklLencana();
}

/** Angka di label subtab. Ditambal langsung, bukan lewat gambarUnit(): menggambar
    ulang seluruh layar unit akan memantulkan subtab yang sedang dibuka kembali ke
    Peralatan tiap kali satu pekerjaan ditandai selesai. */
function bklLencana(){
  const tab = document.querySelector('#subtab button[data-sub="berkala"]');
  if(!tab) return;
  const n = bklJatuhTempo(unitDibuka).filter(x=>x.sisa <= 0).length;
  tab.innerHTML = T('Kegiatan Berkala','Recurring Jobs')
    + (n ? ` <span class="mono" style="opacity:.75">(${n})</span>` : '');
}

function bklPasang(unit){
  const kotak = el('s-berkala'); if(!kotak) return;

  const sunting = kotak.querySelector('#bklSunting');
  if(sunting) sunting.addEventListener('click', ()=>{
    BKL.draf = bklDaftar(unit).map(k=>({ ...k }));
    if(!BKL.draf.length) BKL.draf.push({ id:'', nama:'', jenis:'mingguan', hari:[1], bulan:1, tanggal:1, sumber:'', shift:'', ket:'', alat:'' });
    BKL.sunting = true; BKL.unit = unit;
    bklGambar();
  });

  const batal = kotak.querySelector('#bklBatal');
  if(batal) batal.addEventListener('click', ()=>{
    BKL.sunting = false; BKL.draf = null; bklGambar();
  });

  const tambah = kotak.querySelector('#bklTambah');
  if(tambah) tambah.addEventListener('click', ()=>{
    BKL.draf.push({ id:'', nama:'', jenis:'mingguan', hari:[1], bulan:1, tanggal:1, sumber:'', shift:'', ket:'', alat:'' });
    bklGambar();
  });

  /* Membetulkan kegiatan yang menunggu lembar yang tidak dimiliki unit ini.
     Menyaring pemilih hanya mencegah yang baru; yang terlanjur tersimpan —
     termasuk yang tertinggal di localStorage dari sebelum penyaringnya ada —
     akan menunggu selamanya sampai ada yang mengubahnya, dan kartunya merah
     tanpa sebab yang kelihatan.

     Yang dikembalikan cuma sumbernya, jadi tanda manual. Menebak lembar
     pengganti bukan urusan layar ini: yang tahu pekerjaan itu sebenarnya
     dibuktikan apa hanya orang yang mengerjakannya. */
  const betulkan = kotak.querySelector('#bklBetulkan');
  if(betulkan) betulkan.addEventListener('click', async ()=>{
    const daftar = bklDaftar(unit);
    const kena = daftar.filter(k=>bklDariElogbook(k) && !bklFormAda(unit, k));
    if(!kena.length) return;
    betulkan.disabled = true;
    try{
      await bklSimpanUnit(unit, daftar.map(k=>kena.includes(k) ? { ...k, sumber:'' } : { ...k }));
      bklGambar(); gambarUbin(); gambarPerhatian();
      if(subtabAktif === 'dinas') jdwGambar();
      pesan(T(`${kena.length} kegiatan dikembalikan ke tanda manual.`,
              `${kena.length} job(s) put back on a manual tick.`));
    }catch(e){
      pesan(T('Gagal menyimpan: ','Could not save: ') + (e && e.message || e));
      betulkan.disabled = false;
    }
  });

  const simpan = kotak.querySelector('#bklSimpan');
  if(simpan) simpan.addEventListener('click', async ()=>{
    const bersih = BKL.draf
      .map((k,i)=>({
        id: k.id || 'k' + (i + 1),
        nama: String(k.nama || '').trim(),
        jenis: BERKALA_JENIS.includes(k.jenis) ? k.jenis : 'mingguan',
        hari:    k.jenis === 'mingguan' ? bklHariDaftar(k) : null,
        bulan:   BERKALA_PANJANG[k.jenis]
          ? Math.min(BERKALA_PANJANG[k.jenis], Math.max(1, Number(k.bulan) || 1)) : null,
        tanggal: k.jenis === 'mingguan' ? null : Math.min(28, Math.max(1, Number(k.tanggal) || 1)),
        sumber: BERKALA_SUMBER[k.sumber] ? (k.sumber || '') : '',
        shift: bklShift(k),
        alat: k.alat || '', ket: String(k.ket || '').trim()
      }))
      .filter(k=>k.nama);
    simpan.disabled = true;
    try{
      await bklSimpanUnit(unit, bersih);
      BKL.sunting = false; BKL.draf = null;
      bklGambar();
      gambarUbin(); gambarPerhatian();
      if(subtabAktif === 'dinas') jdwGambar();
      pesan(T('Kegiatan berkala tersimpan.','Recurring jobs saved.'));
    }catch(e){
      pesan(T('Gagal menyimpan: ','Could not save: ') + (e && e.message || e));
      simpan.disabled = false;
    }
  });

  // Sunting menulis langsung ke draf. Menggambar ulang tiap ketikan akan
  // melempar kursor keluar dari kotaknya — kecuali saat jenisnya berganti,
  // karena kotak di sebelahnya memang harus berubah bentuk.
  kotak.querySelectorAll('[data-bkl]').forEach(i=>{
    const k = BKL.draf && BKL.draf[Number(i.dataset.bkl)];
    if(!k) return;
    const acara = i.tagName === 'SELECT' ? 'change' : 'input';
    i.addEventListener(acara, ()=>{
      k[i.dataset.kolom] = i.value;
      if(i.dataset.kolom === 'jenis'){
        if(i.value === 'mingguan'){ k.hari = bklHariDaftar(k); }
        else if(!k.tanggal) k.tanggal = 1;
        const panjang = BERKALA_PANJANG[i.value];
        // Dijepit, bukan sekadar diisi kalau kosong: berpindah dari tahunan
        // (bulan bisa 12) ke triwulan (paling jauh 3) akan meninggalkan angka
        // yang tidak ada pilihannya, dan kotaknya tampil seolah belum dipilih.
        if(panjang) k.bulan = Math.min(panjang, Math.max(1, Number(k.bulan) || 1));
        bklGambar();
      }
    });
  });
  /* Centang hari tidak lewat [data-bkl] di atas: yang di sana menulis satu nilai
     ke satu kolom, sedangkan tujuh kotak ini bersama-sama menyusun satu daftar. */
  kotak.querySelectorAll('[data-bkl-hari]').forEach(c=>{
    c.addEventListener('change', ()=>{
      const k = BKL.draf && BKL.draf[Number(c.dataset.bklHari)];
      if(!k) return;
      const punya = new Set(bklHariDaftar(k));
      // Hari terakhir tidak boleh ikut dilepas: kegiatan mingguan tanpa satu
      // hari pun tidak akan pernah muncul di kalender, dan yang melepasnya
      // tidak akan pernah tahu kenapa.
      if(c.checked) punya.add(Number(c.value));
      else if(punya.size > 1) punya.delete(Number(c.value));
      else { c.checked = true; return; }
      k.hari = [...punya].sort((a,b)=>a-b);
    });
  });

  kotak.querySelectorAll('[data-bkl-buang]').forEach(b=>{
    b.addEventListener('click', ()=>{
      BKL.draf.splice(Number(b.dataset.bklBuang), 1);
      if(!BKL.draf.length) BKL.draf.push({ id:'', nama:'', jenis:'mingguan', hari:[1], bulan:1, tanggal:1, sumber:'', shift:'', ket:'', alat:'' });
      bklGambar();
    });
  });

  kotak.querySelectorAll('[data-bkl-tandai]').forEach(b=>{
    b.addEventListener('click', async ()=>{
      const k = bklDaftar(unit).find(x=>x.id === b.dataset.bklTandai);
      if(!k) return;
      b.disabled = true;
      try{
        await bklTandai(unit, k, !!b.dataset.batal, b.dataset.tanggal);
        bklGambar(); gambarUbin(); gambarPerhatian(); gambarLonceng();
      }catch(e){
        pesan(T('Gagal mencatat: ','Could not record it: ') + (e && e.message || e));
        b.disabled = false;
      }
    });
  });
}

