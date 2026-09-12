/* E-Logbook · js/28c-profil.js — Profil akun
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh (setelah
   28-telegram.js, karena modal ini memanggil muatStatusTelegram()).

   Kenapa ada layar ini. Sambungan Telegram menempel pada AKUN, bukan pada
   tanda tangan — satu sambungan berlaku untuk semua dokumen orang itu. Dulu
   panelnya menumpang di modal "TTD Saya" karena di situlah tempat kosong yang
   ada; akibatnya orang harus membuka urusan tanda tangan untuk mengatur
   sesuatu yang tidak ada hubungannya.

   Pintunya adalah NAMA SENDIRI di kepala halaman, bukan tombol baru. Kepala
   halaman di HP sudah penuh dan susunannya baru saja dirapikan, jadi menambah
   tombol di sana berarti menggeser yang lain lagi.

   Sengaja hanya menampilkan, belum menyunting: sunting nama dan ganti kata
   sandi menyusul, dan tempatnya sudah jelas — di bawah blok identitas ini. */

function openProfilModal(){
  if(!userSaatIni) return;                 // belum masuk: tidak ada yang ditampilkan
  isiProfilIdentitas();
  document.getElementById('profilModalBg').classList.add('show');
  // Panel Telegram menyembunyikan dirinya sendiri kalau server belum
  // menyalakan bot (js/28-telegram.js).
  if(typeof muatStatusTelegram === 'function') muatStatusTelegram();
}

function closeProfilModal(){
  document.getElementById('profilModalBg').classList.remove('show');
}

/** Identitas apa adanya dari sesi yang sedang berjalan — tidak memanggil
    server: semuanya sudah ada di userSaatIni dan unitSaya. */
function isiProfilIdentitas(){
  const wadah = document.getElementById('profilIdentitas');
  if(!wadah) return;
  const u = userSaatIni || {};
  const unit = (typeof unitSaya !== 'undefined' && Array.isArray(unitSaya) && unitSaya.length)
    ? unitSaya.map(x => x.nama || x.kode).join(', ')
    : T('semuaUnit');
  const baris = [
    [T('profilNama'),     u.nama || u.username || '-'],
    [T('profilUsername'), u.username || '-'],
    [T('profilPeran'),    T('peran_' + u.role)],
    [T('profilUnit'),     unit]
  ];
  wadah.innerHTML = baris.map(([label, isi]) =>
    `<div class="profil-baris"><span class="profil-label">${escapeHtml(label)}</span>
     <span class="profil-isi">${escapeHtml(isi)}</span></div>`).join('');
}
