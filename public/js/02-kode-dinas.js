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
  'Malam': { mulai:12, sampai:24, warna:'var(--muted)',  nama:'Malam', pita:'M', malam:true }
};

/* Urutan pita di panel Cakupan 24 Jam, dari yang paling lebar. */
const URUT_PITA = ['PS','M','P','S'];

/* Dua rombongan, lebih kasar daripada pita. Kegiatan berkala dikerjakan
   rombongan siang atau rombongan malam, dan tidak pernah lebih halus dari itu:
   hari yang dipecah P (00–07) dan S (07–13) tetap dikerjakan orang-orang yang
   sama dengan hari yang utuh PS, cuma dibagi dua. Karena itu P dan S ikut PS,
   bukan berdiri sendiri.

   Huruf gedungnya sengaja tidak ikut. Pekerjaan berkala melekat pada peralatan
   di unitnya, bukan pada gedung tempat orangnya duduk — memisahkan PSJ dari PSN
   akan membuat satu pekerjaan yang sama harus ditulis dua kali. */
const ROMBONGAN_NAMA = { PS:['PS','Day'], M:['Malam','Night'] };

/** Rombongan satu kode dinas: 'PS', 'M', atau '' kalau kodenya tidak dikenal. */
const rombonganShift = (kode) => {
  const p = SHIFT[kode] && SHIFT[kode].pita;
  return !p ? '' : p === 'M' ? 'M' : 'PS';
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

/* Daftar sparepart. Kosong di sini, dan itu disengaja: isinya datang dari
   /unitdb pada server dashboard ini. Sebelum ada yang masuk, yang benar
   memang belum ada apa-apa. */
const PART = [];

