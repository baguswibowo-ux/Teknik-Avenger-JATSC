/* =======================================================================
   BAHASA — Indonesia dan Inggris, hanya untuk dashboard

   Layar masuknya sengaja tidak ikut: isinya sudah berbahasa Inggris sejak awal
   (CNS/ATM OPERATIONS, RUNWAY IN USE, SISTEM NORMAL) karena begitulah konsol
   operasional ditulis. Yang perlu diterjemahkan bagian yang dibaca sambil
   bekerja, dan itu dashboardnya.

   Dua jalur, sesuai asal teksnya:

   1. Teks yang sudah ada di HTML membawa `data-en` berisi versi Inggrisnya.
      Versi Indonesianya tidak perlu ditulis dua kali — yang di markup itulah
      aslinya, disimpan sekali ke ASLI sebelum sempat tertimpa.
   2. Teks yang dirangkai JS memakai T('...', '...'). Tanpa kamus berkunci:
      kunci seperti 'unit.judul' memaksa siapa pun yang membaca kodenya
      melompat ke tempat lain hanya untuk tahu kalimat apa yang sedang dicetak.

   Pilihannya di localStorage, bukan sessionStorage: bahasa itu preferensi
   orangnya, bukan sifat satu sesi.
   ======================================================================= */
let BHS = 'id';
try{ if(localStorage.getItem('avenger.bahasa') === 'en') BHS = 'en'; }
catch(e){ /* peramban menolak: Indonesia saja */ }

/** Teks dua bahasa untuk yang dirangkai JS. Indonesia dulu, itu aslinya. */
const T = (id, en) => BHS === 'en' ? en : id;

/** Locale untuk tanggal dan jam, mengikuti bahasa yang sedang dipilih. */
const LOKAL = () => BHS === 'en' ? 'en-GB' : 'id-ID';

const ASLI_ISI   = new WeakMap();   // innerHTML Indonesia, diambil sekali
const ASLI_JUDUL = new WeakMap();   // title Indonesia, idem

function terapkanBahasa(){
  document.documentElement.lang = BHS;
  document.querySelectorAll('[data-en]').forEach(n=>{
    if(!ASLI_ISI.has(n)) ASLI_ISI.set(n, n.innerHTML);
    n.innerHTML = BHS === 'en' ? n.dataset.en : ASLI_ISI.get(n);
  });
  document.querySelectorAll('[data-en-judul]').forEach(n=>{
    if(!ASLI_JUDUL.has(n)) ASLI_JUDUL.set(n, n.title);
    n.title = BHS === 'en' ? n.dataset.enJudul : ASLI_JUDUL.get(n);
  });
  const b = el('tombolBahasa');
  // Tombolnya menyebut bahasa yang akan dituju, bukan yang sedang dipakai —
  // yang sedang dipakai sudah terbaca dari seluruh halaman.
  b.textContent = BHS === 'en' ? 'ID' : 'EN';
  b.title = BHS === 'en' ? 'Beralih ke Bahasa Indonesia' : 'Switch to English';
}

let akun = null;          // akun yang sedang masuk
let unitDibuka = null;    // unit yang sedang dibuka di layar Database Unit
let subtabAktif = 'peralatan';
let alatDipilih = null;

const bolehBuka = (kode) => !!akun && (akun.unit === 'semua' || akun.unit.includes(kode));
const unitBoleh = () => UNIT.filter(u=>bolehBuka(u.kode));

/**
 * Petak dinas hari ini untuk satu unit.
 *
 * Tiga sumber, berurutan: jadwal bulanan yang memang sudah diisi orang (modul
 * Jadwal Dinas di bawah), lalu — hanya dalam data contoh — daftar karangan di
 * CONTOH, lalu petak kosong menurut kode dinas baku.
 *
 * Saat tersambung ke server, unit yang belum punya jadwal tampil KOSONG, bukan
 * diisi nama karangan: alasannya sama dengan cuplikan logbook di layar unit.
 * Nama orang yang tidak pernah ada, terpampang sebagai "berdinas hari ini",
 * jauh lebih buruk daripada petak yang jujur kosong.
 */
function dinasUnit(kode){
  const nyata = dinasHariIni(kode);
  if(nyata) return nyata;
  return SRV.aktif ? petakBaku(kode) : (DINAS[kode] || petakBaku(kode));
}

function pesan(teks){
  const p = el('pesan'); p.textContent = teks; p.classList.add('tampil');
  clearTimeout(pesan._t); pesan._t = setTimeout(()=>p.classList.remove('tampil'), 2600);
}

