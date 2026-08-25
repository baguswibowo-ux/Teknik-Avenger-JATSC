/* E-Logbook · js/25-login.js — Sesi pemakai: identitas, keluar, dan pintu yang tertutup
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh.

   Aplikasi ini TIDAK punya layar masuk sendiri. Kartu masuk dan kartu daftar
   akun berdiri di Dashboard Fasilitas Teknik, dan keduanya tetap memanggil
   /api/login serta /api/daftar milik server ini lewat penerusan — yang dibuang
   layarnya, bukan pintunya. Sesinya memang cuma satu sejak kedua aplikasi satu
   asal; dua layar masuk untuk satu kunci hanya menambah cara untuk salah, dan
   tidak ada yang menerangkan mana yang sedang berlaku.

   Yang tinggal di berkas ini tiga hal: menempelkan identitas orang yang sudah
   masuk ke kepala halaman, tombol Keluar, dan satu panel pemberitahuan untuk
   keadaan "tidak ada sesi yang sah". */

/* ============== IDENTITAS ============== */
let userSaatIni = null;

function tampilkanUser(user){
  userSaatIni = user;
  // Sisa unit milik akun sebelumnya dibuang. Tanpa ini, kalau sesi habis lalu
  // orang lain masuk di halaman yang sama, layarnya masih memakai unit orang
  // yang tadi sampai data baru datang.
  unitAktif = '';
  unitSaya = [];
  document.getElementById('userChipNama').textContent =
    (user.nama || user.username) + ' · ' + T('peran_' + user.role);
  document.getElementById('userChip').style.display = '';
  terapkanPeran();
}

/* ============== PINTU TERTUTUP ============== */
/**
 * Tidak ada sesi yang sah. Dua keadaan, dan jalannya berbeda.
 *
 * Disajikan LEWAT dashboard: orangnya diantar langsung ke layar masuk
 * dashboard. Begitu halaman ini berada di balik pintu, akar asal ini MEMANG
 * dashboard — '/' sudah pasti benar dan sudah pasti hidup, karena ia baru saja
 * menyajikan halaman ini. Bukan window.AVENGER_TAUTAN: alamat dari variabel
 * hanya menambah satu cara untuk salah, dan yang menunjuk host lain akan
 * melempar orang keluar dari asal yang baru saja disatukan.
 *
 * replace, bukan href: layar tanpa sesi tidak pantas bisa didatangi lagi
 * dengan tombol Back.
 *
 * Dibuka LANGSUNG di alamat aplikasi ini: yang tampil panelnya, dengan tautan
 * ke dashboard. Sengaja tidak dipantulkan sendiri — di keadaan ini alamat
 * dashboard cuma tebakan (lihat alamatDashboard() di js/26-init.js), dan
 * memantulkan orang ke alamat yang belum tentu hidup menukar satu kebingungan
 * dengan kebingungan yang lebih sulit dibaca.
 */
function sesiTakSah(kunciPesan){
  if(window.LEWAT_PINTU_AVENGER){ location.replace('/'); return; }
  tampilkanPintuTutup(kunciPesan);
}

function tampilkanPintuTutup(kunciPesan){
  document.getElementById('userChip').style.display = 'none';

  /* Sebabnya dipasang lewat data-t, bukan sebagai teks jadi: kalau orangnya
     mengganti bahasa sesudah panel ini terbuka, terapkanBahasa() menyalinnya
     ulang tanpa perlu tahu panel ini ada. */
  const pesan = document.getElementById('pintuPesan');
  if(kunciPesan){
    pesan.setAttribute('data-t', kunciPesan);
    pesan.textContent = T(kunciPesan);
    pesan.style.display = '';
  }else{
    pesan.removeAttribute('data-t');
    pesan.textContent = '';
    pesan.style.display = 'none';
  }

  // Tanpa alamat, href-nya sengaja dilepas: CSS menyembunyikan tautan yang
  // belum menunjuk ke mana pun.
  const tautan = document.getElementById('pintuTautan');
  const alamat = alamatDashboard();
  if(alamat) tautan.href = alamat; else tautan.removeAttribute('href');

  document.getElementById('pintuTutup').classList.add('show');
}

/* ============== KELUAR ============== */
async function doLogout(){
  try{ await fetch('/api/logout', { method:'POST', credentials:'same-origin' }); }catch(e){}
  userSaatIni = null;

  // Sesinya cuma satu: menekan Keluar di sini juga mengeluarkan orang itu dari
  // dashboard. Jadi keluarnya diantar ke layar masuk dashboard.
  if(window.LEWAT_PINTU_AVENGER){ location.replace('/'); return; }

  /* Dibuka langsung di alamat aplikasi ini: muat ulang, supaya tidak ada sisa
     data di layar setelah keluar. Yang menyambut sesudahnya panel pintu
     tertutup — mulai() yang memasangnya, karena /api/me sudah menjawab 401. */
  location.reload();
}

/* ============== PEMERIKSAAN SESI ============== */
/** Dipanggil saat halaman dibuka: cek apakah cookie sesi masih berlaku. */
async function mulai(){
  try{
    const res = await fetch('/api/me', { credentials:'same-origin' });
    catatWaktuServer(res);   // selaraskan jam sedini mungkin, bahkan sebelum layar hidup
    tickClock();
    if(res.ok){
      const data = await res.json();
      tampilkanUser(data.user);
      await init();
      return;
    }
  }catch(e){
    /* Servernya yang tidak menjawab, bukan sesinya yang mati. Memantulkan orang
       ke dashboard di keadaan ini keliru dua kali: alamatnya belum tentu hidup,
       dan yang salah memang bukan sesinya. */
    document.getElementById('syncBadge').innerHTML =
      '<span class="sync-dot" style="background:var(--fail);box-shadow:none;"></span> server tidak dapat dihubungi';
    tampilkanPintuTutup('takBisaHubungiServer');
    return;
  }
  sesiTakSah();
}
