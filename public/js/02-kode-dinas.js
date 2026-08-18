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
  /* Nama lama, dari sebelum kode JATSC/New dipakai. Masih ada di data contoh
     dan di jadwal yang terlanjur diisi; membuangnya akan mengosongkan petak
     dinas keduanya tanpa ada yang tahu sebabnya. */
  'Pagi':  { mulai:0,  sampai:7,  warna:'var(--accent)', nama:'Pagi',  pita:'P', geser:true },
  'Siang': { mulai:7,  sampai:13, warna:'var(--warn)',   nama:'Siang', pita:'S', geser:true },
  'Malam': { mulai:12, sampai:24, warna:'var(--muted)',  nama:'Malam', pita:'M', malam:true }
};

/* Urutan pita di panel Cakupan 24 Jam, dari yang paling lebar. */
const URUT_PITA = ['PS','M','P','S'];

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

const PART = [
  { nama:'Power Amplifier VHF 50W', pn:'PA-50-VHF-R3', unit:'radkom', rak:'A-01', stok:2, min:2, satuan:'pcs', pakai:'2026-06-18' },
  { nama:'Modul Catu Daya Garex', pn:'GRX-PSU-300', unit:'radtel', rak:'A-04', stok:1, min:2, satuan:'pcs', pakai:'2026-07-02' },
  { nama:'Panel Jack Headset CWP', pn:'GRX-JCK-07', unit:'radtel', rak:'A-05', stok:0, min:2, satuan:'pcs', pakai:'2026-08-04' },
  { nama:'Headset Operator CWP', pn:'HS-CWP-02', unit:'radtel', rak:'A-06', stok:5, min:3, satuan:'pcs', pakai:'2026-08-04' },
  { nama:'Hard Disk Recording 4TB', pn:'NPT-HDD-4T', unit:'radtel', rak:'A-07', stok:3, min:2, satuan:'pcs', pakai:'2026-05-09' },
  { nama:'Kabel Coax RG-214 (rol)', pn:'RG214-100M', unit:'radkom', rak:'B-02', stok:3, min:1, satuan:'rol', pakai:'2026-05-27' },
  { nama:'Konektor N-Type', pn:'CON-N-50', unit:'radkom', rak:'B-03', stok:12, min:8, satuan:'pcs', pakai:'2026-07-14' },
  { nama:'Baterai UPS 12V 100Ah', pn:'UPS-BAT-12100', unit:'listrikmekanik', rak:'C-01', stok:8, min:6, satuan:'pcs', pakai:'2026-07-19' },
  { nama:'Filter Udara AC Presisi', pn:'ACP-FLT-24', unit:'listrikmekanik', rak:'C-03', stok:0, min:4, satuan:'pcs', pakai:'2026-07-30' },
  { nama:'Oli Mesin Genset (drum)', pn:'OIL-15W40-D', unit:'listrikmekanik', rak:'C-05', stok:2, min:1, satuan:'drum', pakai:'2026-07-05' },
  { nama:'Hard Disk Server 2TB', pn:'HDD-ENT-2T', unit:'amhsadps', rak:'D-02', stok:4, min:2, satuan:'pcs', pakai:'2026-04-11' },
  { nama:'Kartu Extractor Radar', pn:'RDR-EXT-C4', unit:'pengamatan', rak:'D-05', stok:1, min:1, satuan:'pcs', pakai:'2026-02-14' },
  { nama:'Modul Receiver DME', pn:'DME-RX-M2', unit:'ppabn', rak:'B-05', stok:1, min:1, satuan:'pcs', pakai:'2026-03-22' },
  { nama:'Lampu Obstruction LED', pn:'OBS-LED-R', unit:'gedungkeamanan', rak:'E-01', stok:2, min:4, satuan:'pcs', pakai:'2026-06-05' },
  { nama:'Kamera CCTV Dome', pn:'CCTV-DM-4M', unit:'gedungkeamanan', rak:'E-02', stok:3, min:2, satuan:'pcs', pakai:'2026-08-12' },
  { nama:'Modul I/O FDPS', pn:'FDP-IO-12', unit:'fdpsrdps', rak:'D-08', stok:2, min:2, satuan:'pcs', pakai:'2026-06-30' }
];

