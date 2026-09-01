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
// Sub-unit yang jadi tab aktif di panel Identity. null = alat induknya sendiri
// yang ditampilkan. Kalau alat berpindah, ini dilepas dulu supaya id lama
// tidak nyasar jadi rujukan tab di alat baru.
let subDipilih = null;
// Grup lokasi peralatan yang sedang jadi tab aktif di layar Peralatan.
// '' = tab "Semua" (tidak ada penyaringan). Nilai selain '' menyaring kartu
// alat ke yang punya grup ini — termasuk grup yang belum punya isi (baru
// dibuat lewat tombol "+"), sehingga pemakai bisa menekan Tambah peralatan
// dan alatnya langsung masuk grup itu.
let grupDipilih = '';

const bolehBuka = (kode) => !!akun && (akun.unit === 'semua' || akun.unit.includes(kode));
const unitBoleh = () => UNIT.filter(u=>bolehBuka(u.kode));

/**
 * Petak dinas hari ini untuk satu unit.
 *
 * Dua sumber saja sekarang: jadwal bulanan yang memang sudah diisi orang
 * (modul Jadwal Dinas di bawah), lalu petak kosong menurut kode dinas baku.
 * Di antara keduanya dulu ada daftar nama karangan; ia sudah dibuang.
 *
 * Unit yang belum punya jadwal karena itu tampil KOSONG — alasannya sama
 * dengan cuplikan logbook di layar unit. Nama orang yang tidak pernah ada,
 * terpampang sebagai "berdinas hari ini", jauh lebih buruk daripada petak
 * yang jujur kosong.
 */
function dinasUnit(kode){
  return dinasHariIni(kode) || petakBaku(kode);
}

function pesan(teks){
  const p = el('pesan'); p.textContent = teks; p.classList.add('tampil');
  clearTimeout(pesan._t); pesan._t = setTimeout(()=>p.classList.remove('tampil'), 2600);
}

/**
 * Pengganti window.prompt() yang menyatu dengan tema dashboard. Dialog
 * bawaan peramban ("localhost:3100 says …") memaksa gaya sistem yang
 * berbenturan tajam dengan sisa layar — dan pada layar sentuh ia sering
 * memakai fokus tanpa tempat mengetik yang benar-benar terlihat.
 *
 * Opsi: { judul, keterangan, nilaiAwal, contoh, okTeks, batalTeks, ijinKosong }
 * Kembalinya Promise<string|null>. null berarti Batal atau Esc; string
 * kosong hanya ikut kalau ijinKosong=true (mis. hapus grup pakai nama kosong).
 */
function dialogInput(opts = {}){
  return new Promise((selesai)=>{
    const {
      judul = '',
      keterangan = '',
      nilaiAwal = '',
      contoh = '',
      okTeks = 'OK',
      batalTeks = T('Batal','Cancel'),
      ijinKosong = false
    } = opts;

    const lapis = document.createElement('div');
    lapis.className = 'lapis-ubah buka';
    lapis.innerHTML = `
      <div class="kartu-ubah" role="dialog" aria-modal="true" style="width:min(440px,100%)">
        <div class="kepala"><h3></h3></div>
        <div class="badan">
          <div class="isian" style="margin-bottom:0">
            <label></label>
            <input type="text" autocomplete="off" spellcheck="false">
          </div>
        </div>
        <div class="kaki">
          <button type="button" class="btn garis kecil" data-dip-batal></button>
          <button type="button" class="btn kecil" data-dip-ok></button>
        </div>
      </div>`;

    // textContent, bukan innerHTML — teks datang dari pemanggil dan
    // beberapa lokasinya lolos ke sini apa adanya. Kalau nanti perlu
    // penekanan HTML kecil, ganti selektif per pemanggil, bukan seluruhnya.
    lapis.querySelector('.kepala h3').textContent = judul;
    lapis.querySelector('label').textContent = keterangan || judul;
    const inp = lapis.querySelector('input');
    inp.value = nilaiAwal;
    if(contoh) inp.placeholder = contoh;
    lapis.querySelector('[data-dip-ok]').textContent = okTeks;
    lapis.querySelector('[data-dip-batal]').textContent = batalTeks;

    const tutup = (nilai)=>{
      document.removeEventListener('keydown', kunci);
      lapis.remove();
      selesai(nilai);
    };
    const kirim = ()=>{
      const nilai = inp.value.trim();
      if(!nilai && !ijinKosong) return; // Enter dengan input kosong = tidak melakukan apa-apa
      tutup(nilai);
    };
    const kunci = (e)=>{
      if(e.key === 'Escape') tutup(null);
      if(e.key === 'Enter'){ e.preventDefault(); kirim(); }
    };

    lapis.querySelector('[data-dip-ok]').addEventListener('click', kirim);
    lapis.querySelector('[data-dip-batal]').addEventListener('click', ()=>tutup(null));
    // Klik latar (bukan kartu) = Batal — konsisten dengan lapis-ubah lain.
    lapis.addEventListener('click', (e)=>{ if(e.target === lapis) tutup(null); });
    document.addEventListener('keydown', kunci);

    document.body.appendChild(lapis);
    // Fokus & pilih setelah lapis masuk DOM supaya browser tidak abaikan.
    requestAnimationFrame(()=>{ inp.focus(); inp.select(); });
  });
}

