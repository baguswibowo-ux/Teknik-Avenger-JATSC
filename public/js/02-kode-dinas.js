/* =======================================================================
   KODE DINAS

   Jamnya UTC, sama seperti lembar jadwal yang diedarkan tiap bulan. Di
   penerbangan UTC yang jadi patokan, dan menuliskan lembar sumbernya dalam
   WIB hanya memindahkan kesalahan ke tempat lain. Konversi ke WIB terjadi
   sekali saja, waktu menggambar label — hitungan "sedang dinas" tetap UTC,
   supaya benar juga kalau dashboard ini dibuka dari zona waktu lain.

   J = JATSC, N = New JATSC. Dua gedung dengan jam yang sama persis; yang
   dibedakan tempat orangnya berdinas, bukan panjang shiftnya.

   Malam berangkat pukul 12:00, tepat saat PS pulang. Tapi kalau hari itu
   dipecah P (00–07) dan S (07–13), siangnya baru selesai pukul 13:00 dan
   malamnya ikut mundur satu jam. Itulah gunanya `geser` di bawah: penanda
   bahwa kode ini memanjangkan hari, dan `malam` pada yang ikut mundur.

   `pita` menyebut pita mana yang mewakili kode ini di panel Cakupan 24 Jam.
   PSJ dan PSN berbagi pita yang sama persis; menggambar keduanya bertumpuk di
   tempat yang sama tidak menerangkan apa pun.
   ======================================================================= */
const SHIFT = {
  'PSJ':  { mulai:0,  sampai:12, warna:'var(--ok)',     nama:'PS JATSC',        pita:'PS' },
  'PSN':  { mulai:0,  sampai:12, warna:'var(--ok)',     nama:'PS New JATSC',    pita:'PS' },
  'MJ':   { mulai:12, sampai:24, warna:'var(--muted)',  nama:'Malam JATSC',     pita:'M', malam:true },
  'MN':   { mulai:12, sampai:24, warna:'var(--muted)',  nama:'Malam New JATSC', pita:'M', malam:true },
  'P':    { mulai:0,  sampai:7,  warna:'var(--accent)', nama:'Pagi',            pita:'P', geser:true },
  'S':    { mulai:7,  sampai:13, warna:'var(--warn)',   nama:'Siang',           pita:'S', geser:true },
  /* Pagi/Siang per gedung — pasangan JATSC/New JATSC untuk pecahan pagi dan
     siang, mirip PSJ/PSN dan MJ/MN. Jamnya sama persis dengan P dan S polos;
     `geser:true` ikut supaya kalau hari itu dipecah, malamnya tetap mundur ke
     13:00 seperti aturannya di P dan S. */
  'PJ':   { mulai:0,  sampai:7,  warna:'var(--accent)', nama:'Pagi JATSC',      pita:'P', geser:true },
  'PNJ':  { mulai:0,  sampai:7,  warna:'var(--accent)', nama:'Pagi New JATSC',  pita:'P', geser:true },
  'SJ':   { mulai:7,  sampai:13, warna:'var(--warn)',   nama:'Siang JATSC',     pita:'S', geser:true },
  'SNJ':  { mulai:7,  sampai:13, warna:'var(--warn)',   nama:'Siang New JATSC', pita:'S', geser:true },
  /* Pola campuran ("hybrid", mis. Listrik): dalam satu hari sebagian orang
     berdinas PS + M (12 jam) dan sebagian lagi P + S + M (dipecah tiga). Kalau
     yang dipecah memakai PJ/SJ di atas, `geser` ikut memundurkan MJ SEMUA orang
     ke 13:00 — padahal malam rombongan PS tetap berangkat 12:00. Karena itu
     pecahannya diberi kode sendiri: P1/S1 TANPA `geser`, dan M1 yang jamnya
     memang 13:00, jadi M biasa hari itu tidak tersentuh.
     `cetak` = tulisan di lembar cetak PUM: P1 / S1 / M1 tanpa huruf gedung,
     supaya di lembar itu pecahan tiga tetap terbedakan dari PS dan M biasa
     (tanpa `cetak`, yang tercetak pitanya: PS, M, P, S). */
  /* Tanpa huruf gedung — untuk unit yang dinasnya P / S / M dan tidak
     membedakan JATSC / New JATSC. Jam dan sifatnya sama dengan yang bergedung. */
  'P1':   { mulai:0,  sampai:7,  warna:'var(--accent)', nama:'Pagi 1',            pita:'P', cetak:'P1' },
  'S1':   { mulai:7,  sampai:13, warna:'var(--warn)',   nama:'Siang 1',           pita:'S', cetak:'S1' },
  'M1':   { mulai:13, sampai:24, warna:'var(--muted)',  nama:'Malam 1',           pita:'M', cetak:'M1', malam:true },
  'P1J':  { mulai:0,  sampai:7,  warna:'var(--accent)', nama:'Pagi 1 JATSC',      pita:'P', cetak:'P1' },
  'P1NJ':  { mulai:0,  sampai:7,  warna:'var(--accent)', nama:'Pagi 1 New JATSC',  pita:'P', cetak:'P1' },
  'S1J':  { mulai:7,  sampai:13, warna:'var(--warn)',   nama:'Siang 1 JATSC',     pita:'S', cetak:'S1' },
  'S1NJ':  { mulai:7,  sampai:13, warna:'var(--warn)',   nama:'Siang 1 New JATSC', pita:'S', cetak:'S1' },
  'M1J':  { mulai:13, sampai:24, warna:'var(--muted)',  nama:'Malam 1 JATSC',     pita:'M', cetak:'M1', malam:true },
  'M1NJ':  { mulai:13, sampai:24, warna:'var(--muted)',  nama:'Malam 1 New JATSC', pita:'M', cetak:'M1', malam:true },
  /* Tanpa huruf gedung. Tidak ditawarkan di daftar kode unit — lembar yang
     menulis 'PS' saja belum menyebut JATSC atau New JATSC, dan impor memang
     harus melaporkannya sebagai kode asing supaya dilengkapi. Tetap dikenal
     di sini supaya jamnya dan warnanya betul kalau terlanjur terisi. */
  'PS':   { mulai:0,  sampai:12, warna:'var(--ok)',     nama:'Pagi–Siang',      pita:'PS' },
  'M':    { mulai:12, sampai:24, warna:'var(--muted)',  nama:'Malam',           pita:'M', malam:true },
  /* Nama lama, dari sebelum kode JATSC/New dipakai. Masih ada di jadwal yang
     terlanjur diisi dengannya; membuangnya akan mengosongkan petak dinas
     bulan-bulan itu tanpa ada yang tahu sebabnya. */
  'Pagi':  { mulai:0,  sampai:7,  warna:'var(--accent)', nama:'Pagi',  pita:'P', geser:true },
  'Siang': { mulai:7,  sampai:13, warna:'var(--warn)',   nama:'Siang', pita:'S', geser:true },
  'Malam': { mulai:12, sampai:24, warna:'var(--muted)',  nama:'Malam', pita:'M', malam:true },

  /* SPKL — Surat Perintah Kerja Lembur. Enam varian, satu untuk tiap bentuk
     shift di KODE_DINAS supaya kartu SPKL bisa berdiri di petak yang tepat
     (PS JATSC / PS New JATSC / Malam JATSC / Malam New JATSC / Pagi / Siang).
     Jamnya sama persis dengan varian dasarnya — SPKL itu penanda "kerja lembur
     dengan surat perintah", bukan periode jam yang berbeda. Warnanya ungu
     supaya jelas beda dari dinas biasa, dan tetap terbaca di kedua mode tema. */
  'SPKLPSJ': { mulai:0,  sampai:12, warna:'#a855f7', nama:'SPKL PS JATSC',      pita:'PS' },
  'SPKLPSN': { mulai:0,  sampai:12, warna:'#a855f7', nama:'SPKL PS New JATSC',  pita:'PS' },
  'SPKLMJ':  { mulai:12, sampai:24, warna:'#a855f7', nama:'SPKL Malam JATSC',   pita:'M', malam:true },
  'SPKLMN':  { mulai:12, sampai:24, warna:'#a855f7', nama:'SPKL Malam New JATSC', pita:'M', malam:true },
  'SPKLP':   { mulai:0,  sampai:7,  warna:'#a855f7', nama:'SPKL Pagi',          pita:'P', geser:true },
  'SPKLS':   { mulai:7,  sampai:13, warna:'#a855f7', nama:'SPKL Siang',         pita:'S', geser:true },
  /* SPKL per gedung untuk pecahan pagi dan siang — mengikuti pola PJ/PNJ/SJ/SNJ
     di atas. Jamnya sama dengan varian dasarnya, warnanya tetap ungu SPKL. */
  'SPKLPJ':  { mulai:0,  sampai:7,  warna:'#a855f7', nama:'SPKL Pagi JATSC',      pita:'P', geser:true },
  'SPKLPNJ': { mulai:0,  sampai:7,  warna:'#a855f7', nama:'SPKL Pagi New JATSC',  pita:'P', geser:true },
  'SPKLSJ':  { mulai:7,  sampai:13, warna:'#a855f7', nama:'SPKL Siang JATSC',     pita:'S', geser:true },
  'SPKLSNJ': { mulai:7,  sampai:13, warna:'#a855f7', nama:'SPKL Siang New JATSC', pita:'S', geser:true },
  /* SPKL untuk pecahan tiga P1 / S1 / M1, polos dan per gedung. Jam dan sifat
     sama dengan dasarnya: tanpa `geser`, dan M1 memang mulai 13:00. */
  'SPKLP1':   { mulai:0,  sampai:7,  warna:'#a855f7', nama:'SPKL Pagi 1',            pita:'P' },
  'SPKLS1':   { mulai:7,  sampai:13, warna:'#a855f7', nama:'SPKL Siang 1',           pita:'S' },
  'SPKLM1':   { mulai:13, sampai:24, warna:'#a855f7', nama:'SPKL Malam 1',           pita:'M', malam:true },
  'SPKLP1J':  { mulai:0,  sampai:7,  warna:'#a855f7', nama:'SPKL Pagi 1 JATSC',      pita:'P' },
  'SPKLS1J':  { mulai:7,  sampai:13, warna:'#a855f7', nama:'SPKL Siang 1 JATSC',     pita:'S' },
  'SPKLM1J':  { mulai:13, sampai:24, warna:'#a855f7', nama:'SPKL Malam 1 JATSC',     pita:'M', malam:true },
  'SPKLP1NJ': { mulai:0,  sampai:7,  warna:'#a855f7', nama:'SPKL Pagi 1 New JATSC',  pita:'P' },
  'SPKLS1NJ': { mulai:7,  sampai:13, warna:'#a855f7', nama:'SPKL Siang 1 New JATSC', pita:'S' },
  'SPKLM1NJ': { mulai:13, sampai:24, warna:'#a855f7', nama:'SPKL Malam 1 New JATSC', pita:'M', malam:true },

  /* Tidak berdinas — kartu tetap tampil supaya manajer melihat siapa saja yang
     tidak masuk hari itu, tetapi tanpa jam dan tanpa pita cakupan. `libur:true`
     memberi tahu kartuShift untuk menyembunyikan jam, dan kosongnya `pita`
     membuat rombonganShift() menjawab '' sehingga lonceng berkala tidak
     mengingatkan mereka yang sedang cuti. */
  'CUTI': { mulai:0, sampai:0, warna:'var(--muted)', nama:'Cuti Tahunan',       libur:true },
  'CAP':  { mulai:0, sampai:0, warna:'var(--fail)',  nama:'Cuti Alasan Penting', libur:true },
  'IJIN': { mulai:0, sampai:0, warna:'var(--warn)',  nama:'Ijin',               libur:true },
  /* Sakit — dulu ditampung CAP lewat alias. Diberi kode sendiri (permintaan
     Bagus, 12 Okt 2026) supaya di jadwal dan di keterangan lembar cetak
     tertulis "Sakit", bukan "Cuti Alasan Penting". Sifatnya sama dengan cuti:
     tampil di petaknya, tanpa jam dan tanpa cakupan. Warnanya merah muda
     supaya beda dari CAP (merah) dan IJIN (kuning), terbaca di kedua tema. */
  'SAKIT': { mulai:0, sampai:0, warna:'#ec4899',     nama:'Sakit',              libur:true },
  /* Dinas Luar — orangnya sedang bertugas, tetapi di luar stasiun (diklat,
     rapat, penugasan lapangan). Untuk papan cakupan ini ia sama seperti cuti:
     tetap tampil di petak hari itu supaya terlihat siapa yang tidak di tempat,
     tetapi tanpa jam dan tanpa pita — jadi lonceng berkala tidak mengingatkan
     yang sedang di luar. Warnanya teal supaya tidak salah dibaca sebagai salah
     satu kode cuti/absen, dan tetap terbaca di kedua mode tema. */
  'DL':   { mulai:0, sampai:0, warna:'#14b8a6',      nama:'Dinas Luar',         libur:true }
};

/* =======================================================================
   TANGGAL MERAH — Minggu dan hari libur nasional

   Dipakai tabel Jadwal Dinas (kolomnya diblok merah sampai bawah) dan lembar
   cetaknya (kolom abu-abu), supaya dua-duanya sepakat.

   Yang tanggalnya TETAP tiap tahun dihitung dari aturannya. Yang berpindah
   tiap tahun (Idul Fitri, Idul Adha, Nyepi, Imlek, Waisak, Wafat & Kenaikan
   Yesus Kristus, Isra Mikraj, Maulid, 1 Muharram) harus DITULIS per tahun di
   LIBUR_BERPINDAH menurut SKB tiga menteri tahun itu — sengaja tidak ditebak:
   kolom merah yang salah lebih menyesatkan daripada yang belum diisi. Cuti
   bersama bukan tanggal merah dan tidak dicatat di sini.
   ======================================================================= */
const LIBUR_TETAP = { '01-01':'Tahun Baru Masehi', '05-01':'Hari Buruh', '06-01':'Hari Lahir Pancasila',
                      '08-17':'Hari Kemerdekaan RI', '12-25':'Hari Raya Natal' };
/* 'YYYY-MM-DD': 'nama libur'. Kosong = tahun itu belum diisi. */
const LIBUR_BERPINDAH = {};

/** Nama tanggal merah untuk tanggal `h` di bulan 'YYYY-MM', atau '' kalau hari biasa. */
function tanggalMerah(bulan, h){
  const m = String(bulan || '').match(/^(\d{4})-(\d{2})$/);
  if(!m) return '';
  const hh = String(h).padStart(2, '0');
  const libur = LIBUR_BERPINDAH[`${m[1]}-${m[2]}-${hh}`] || LIBUR_TETAP[`${m[2]}-${hh}`];
  if(libur) return libur;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(h)).getDay() === 0 ? 'Minggu' : '';
}

/* =======================================================================
   BARIS TANPA NOMOR — judul grup di tabel jadwal

   Baris jadwal tidak selalu orang: "GRUP 1", "GROUP 2" adalah judul yang
   ditaruh di atas nama-nama grupnya. Baris seperti itu tidak bernomor, dan
   nomor urut baris di bawahnya meneruskan hitungan seolah judulnya tidak ada.

   `tanpaNo` di barisnya yang menentukan — diatur lewat klik nomor di mode
   sunting. Baris yang belum pernah diatur (jadwal lama) ditebak: bernama
   GRUP/GROUP dan tanpa NIK = judul. Dipakai tabel di layar dan lembar cetak.
   ======================================================================= */
function jdwTanpaNomor(o){
  if(o && typeof o.tanpaNo === 'boolean') return o.tanpaNo;
  return /^(grup|group)\b/i.test(String((o && o.nama) || '').trim()) && !String((o && o.nik) || '').trim();
}
/** Nomor urut tiap baris — '' untuk baris tanpa nomor: [1, 2, '', 3, …]. */
function jdwNomorUrut(baris){
  let n = 0;
  return (Array.isArray(baris) ? baris : []).map(o=>jdwTanpaNomor(o) ? '' : ++n);
}

/* Urutan pita di panel Cakupan 24 Jam, dari yang paling lebar. */
const URUT_PITA = ['PS','M','P','S'];

/* Dua rombongan, lebih kasar daripada pita. Kegiatan berkala dikerjakan
   rombongan siang atau rombongan malam, dan tidak pernah lebih halus dari itu:
   hari yang dipecah P (00–07) dan S (07–13) tetap dikerjakan orang-orang yang
   sama dengan hari yang utuh PS, cuma dibagi dua. Karena itu P dan S ikut PS,
   bukan berdiri sendiri.

   Huruf gedungnya tidak ikut di rombongan — gedung dibaca terpisah lewat
   gedungShift() di bawah, dan hanya dipakai kalau kegiatannya sendiri menyebut
   Lokasi. Kegiatan tanpa Lokasi tetap untuk seluruh unit. */
const ROMBONGAN_NAMA = { PS:['PS','Day'], M:['Malam','Night'] };

/**
 * Gedung satu kode dinas: 'jatsc', 'new-jatsc', atau '' kalau kodenya tidak
 * menyebut gedung (P, S, PS, M, nama lama) atau tidak dikenal.
 *
 * Dibaca dari nama di SHIFT, bukan dari huruf terakhir kodenya: PNJ berakhiran
 * J padahal New JATSC, dan IJIN berakhiran N padahal bukan gedung apa pun.
 *
 * Dipakai untuk mengalamatkan kegiatan berkala yang menyebut Lokasi — Daily
 * Check JATSC milik yang berdinas PSJ/MJ, bukan yang berdinas PSN/MN walau
 * unitnya sama. Kode tanpa gedung dijawab '' dan yang memanggil TIDAK
 * menyaringnya: pekerjaan yang terkirim ke dua gedung masih bisa dibetulkan,
 * pekerjaan yang tidak terkirim ke siapa pun tidak ada yang tahu.
 */
const gedungShift = (kode) => {
  const b = kodeBaku(kode);
  const nama = b ? SHIFT[b].nama : '';
  return /New JATSC/.test(nama) ? 'new-jatsc' : /JATSC/.test(nama) ? 'jatsc' : '';
};

/** Orang berkode dinas ini termasuk tujuan kegiatan `k`, menurut gedungnya? */
const gedungCocok = (k, kode) => {
  const lokasi = k && k.lokasi;
  const g = gedungShift(kode);
  return !lokasi || !g || g === lokasi;
};

/* =======================================================================
   PEMBAKU KODE — dari tulisan di lembar ke kunci SHIFT

   Yang tersimpan di jadwal tidak selalu kunci SHIFT yang bersih. Pengimpor
   sengaja MENYIMPAN APA ADANYA kode yang tidak dikenalinya (lihat imporKode di
   22-impor-jadwal.js) supaya salah ketik kelihatan alih-alih hilang diam-diam,
   dan jadwal yang sudah terlanjur masuk memang berisi tulisan seperti ini:

     'C  U  T  I'    huruf berspasi, sisa pembacaan lembar Excel/PDF
     'MJ (SPKL)'     SPKL ditulis di belakang, bukan di depan seperti 'SPKLMJ'
     'PSJ (SPKL)'    idem
     'Pagi'          nama lama, sebelum kode J/NJ dipakai

   Semuanya kode yang artinya jelas bagi yang membacanya, tetapi tidak sama
   dengan kunci SHIFT — jadi tanpa pembaku ini 'C  U  T  I' terhitung berdinas
   dan 'MJ (SPKL)' tidak punya rombongan. Dua-duanya salah, dan dua-duanya
   diam-diam.

   Yang dilakukan: buang semua yang bukan huruf, samakan besar-kecilnya, lalu
   cocokkan — langsung, lewat alias nama panjang, atau lewat SPKL yang letaknya
   terbalik. Yang tetap tidak ketemu dijawab '' — dan yang memanggil yang
   memutuskan apa artinya kode asing baginya.
   ======================================================================= */

/* Nama panjang dan singkatan yang artinya sudah pasti, dipetakan ke kunci
   SHIFT-nya. Kembarannya IMPOR_ALIAS di 22-impor-jadwal.js; yang di sana
   menyaring waktu impor, yang di sini menolong jadwal yang terlanjur
   tersimpan dengan tulisan itu. */
const ALIAS_SHIFT = {
  PAGI:'Pagi', SIANG:'Siang', MALAM:'Malam',
  CT:'CUTI', CUTITAHUNAN:'CUTI',
  CUTIALASANPENTING:'CAP', SKT:'SAKIT',
  IZIN:'IJIN', DINASLUAR:'DL'
};

/** Kunci SHIFT untuk satu tulisan kode, atau '' kalau memang tidak dikenal. */
function kodeBaku(kode){
  /* Kode berangka (P1J, M1NJ) dicocokkan dulu selagi angkanya masih ada —
     kalau angkanya ikut dibuang, 'M1J' terbaca 'MJ' dan jamnya salah. */
  const rapat = String(kode == null ? '' : kode).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if(/\d/.test(rapat)){
    if(SHIFT[rapat]) return rapat;
    /* SPKL di belakang kode berangka: 'M1J (SPKL)' → 'SPKLM1J'. Tanpa ini
       angkanya terbuang di bawah dan ia terbaca 'SPKLMJ' — malam yang salah jam. */
    const dasar = rapat.replace('SPKL', '');
    if(dasar !== rapat && SHIFT['SPKL' + dasar]) return 'SPKL' + dasar;
  }
  const huruf = rapat.replace(/[^A-Z]/g, '');
  if(!huruf) return '';
  if(SHIFT[huruf]) return huruf;
  if(ALIAS_SHIFT[huruf] && SHIFT[ALIAS_SHIFT[huruf]]) return ALIAS_SHIFT[huruf];
  /* SPKL di belakang: 'MJ (SPKL)' → 'MJSPKL' → dasarnya 'MJ' → 'SPKLMJ'.
     Kalau dasarnya tidak punya varian SPKL sendiri, dasarnya yang dipakai —
     yang penting orangnya berdinas pada bentuk shift itu. */
  const tanpa = huruf.replace('SPKL', '');
  if(tanpa !== huruf && tanpa){
    const dasar = SHIFT[tanpa] ? tanpa : (ALIAS_SHIFT[tanpa] || '');
    if(dasar) return SHIFT['SPKL' + dasar] ? 'SPKL' + dasar : dasar;
  }
  return '';
}

/** Rombongan satu kode dinas: 'PS', 'M', atau '' kalau kodenya tidak dikenal. */
const rombonganShift = (kode) => {
  const b = kodeBaku(kode);
  const p = b && SHIFT[b].pita;
  return !p ? '' : p === 'M' ? 'M' : 'PS';
};

/**
 * Orang dengan kode ini benar-benar masuk hari itu?
 *
 * Yang dijawab 'tidak' cuma kode yang ditandai `libur` di SHIFT — CUTI, CAP,
 * IJIN, dan DL. Keempatnya tetap tampil di petak dinas supaya terlihat siapa
 * yang tidak di tempat, tetapi pekerjaan berkala bukan urusan mereka: yang
 * mengerjakan pekerjaan berkala adalah yang berdinas — PS, P, S, M, mau JATSC
 * mau New JATSC, termasuk yang berdinas dengan SPKL.
 *
 * Kode yang benar-benar asing — tidak dikenal kodeBaku() sekalipun — dihitung
 * BERDINAS. Lembar jadwal kadang memakai tulisan yang belum dikenal di sini,
 * dan menganggapnya libur berarti diam-diam membebaskan orangnya dari
 * pekerjaan yang sebenarnya jadi tanggungannya. Yang salah alamat masih bisa
 * dibetulkan orangnya; yang tidak pernah muncul tidak ada yang tahu.
 */
const berdinasShift = (kode) => {
  if(!String(kode == null ? '' : kode).trim()) return false;
  const b = kodeBaku(kode);
  return !b || !SHIFT[b].libur;
};

/**
 * Jam satu kode dinas dalam UTC, sebagai { mulai, sampai }.
 *
 * `kodeHari` adalah seluruh kode yang benar-benar dipakai unit itu pada hari
 * yang sama. Ia hanya berpengaruh pada shift malam: kalau harinya dipecah P
 * dan S, malamnya mulai 13:00, bukan 12:00.
 */
function jamShift(kode, kodeHari){
  const s = SHIFT[kode];
  if(!s) return { mulai:0, sampai:0 };
  const mundur = s.malam && (kodeHari || []).some(k=>SHIFT[k] && SHIFT[k].geser);
  return { mulai: mundur ? 13 : s.mulai, sampai: s.sampai };
}

/** Warna satu kode dinas. `lain` dipakai untuk kode yang tidak dikenal — di
    kartu dinas abu-abu masih masuk akal, di sel tabel jadwal tidak. */
const warnaShift = (kode, lain) => (SHIFT[kode] && SHIFT[kode].warna) ||
                                   (lain === undefined ? 'var(--muted)' : lain);

/** Sedang berjalan sekarang? Diukur dengan jam UTC, bukan jam peramban. */
const sedangShift = (j) => { const u = new Date().getUTCHours(); return u >= j.mulai && u < j.sampai; };

const jamPad  = (h) => String(h % 24).padStart(2,'0') + ':00';
const jamWib  = (h) => jamPad(h + 7);
/** "00:00–12:00 UTC" — patokannya, dan yang tertulis di lembar aslinya. */
const labelUtc = (j) => `${jamPad(j.mulai)}–${jamPad(j.sampai)} UTC`;
/** "07:00–19:00 WIB" — untuk yang membaca sambil melihat jam dinding. */
const labelWib = (j) => `${jamWib(j.mulai)}–${jamWib(j.sampai)} WIB`;

/* =======================================================================
   AKHIR DINAS — untuk cuplikan logbook E-Logbook

   Labelnya label lembar E-Logbook (Pagi / Siang / PS / Malam), bukan kode
   jadwal di atas. Jamnya UTC dan WAJIB sama dengan AKHIR_DINAS_UTC di
   elogbook/server.js (pengingat TTD) — kalau keduanya berselisih, "dinas
   sudah selesai" berarti dua hal yang berbeda di dua layar.

     Pagi 07 UTC (14 WIB) · Siang 13 UTC (20 WIB) · PS 12 UTC (19 WIB)
     Malam 24 UTC (07 WIB esok harinya)

   Cuplikan menampilkan dinas yang SUDAH SELESAI dalam 48 jam terakhir — dua
   hari dinas. Dinas yang sedang berjalan belum ikut; begitu selesai ia masuk,
   dan dinas yang sama dua hari sebelumnya keluar. Karena yang dihitung jam
   selesai tiap dinas, aturannya sama untuk hari berpola P/S/M maupun PS/M,
   tanpa perlu tahu pola hari itu.
   ======================================================================= */
const AKHIR_DINAS_LOGBOOK_UTC = { p:7, pagi:7, s:13, siang:13, ps:12, m:24, malam:24 };
const DUA_HARI_DINAS_MS = 48 * 3600 * 1000;

/** Akhir dinas satu catatan logbook, ms epoch; NaN kalau tanggal/dinas tak dikenal. */
function akhirDinasLogbook(tgl, dinas){
  const m = String(tgl || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const jam = AKHIR_DINAS_LOGBOOK_UTC[String(dinas || '').trim().toLowerCase()];
  if(!m || jam === undefined) return NaN;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), jam);
}

/** Masuk cuplikan dua hari dinas? Dinasnya sudah selesai, paling lama 48 jam lalu. */
const dalamDuaHariDinas = (akhir, kini = Date.now()) =>
  Number.isFinite(akhir) && akhir <= kini && akhir > kini - DUA_HARI_DINAS_MS;

/* Daftar sparepart. Kosong di sini, dan itu disengaja: isinya datang dari
   /unitdb pada server dashboard ini. Sebelum ada yang masuk, yang benar
   memang belum ada apa-apa. */
const PART = [];

