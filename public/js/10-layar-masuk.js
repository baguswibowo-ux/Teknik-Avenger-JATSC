/* =======================================================================
   LAYAR MASUK
   ======================================================================= */
/* kmMulai() dan srvPeriksa() dipanggil di kaki berkas, bukan di sini:
   keduanya membaca SRV, dan SRV baru lahir di blok JEMBATAN di bawah. */

/* =======================================================================
   TIDAK ADA LAGI DAFTAR AKUN DI KARTU MASUK

   Pernah ada, dan bentuknya deret tombol berisi seluruh username yang sedang
   aktif: tekan satu, kolom username terisi. Dalam data contoh yang muncul akun
   contoh; tersambung, yang muncul akun E-Logbook sungguhan dari
   /api/akun-daftar.

   Dibuang atas permintaan, dan itu sekaligus mengembalikan penjagaan yang dulu
   dikorbankan untuknya. /api/login di E-Logbook sengaja menyamakan pesan
   salahnya — "username atau password salah", tidak pernah menyebut yang mana —
   supaya tidak ketahuan username mana yang terdaftar. Daftar pra-login
   membatalkan itu seluruhnya: yang tersisa untuk ditebak cuma password.
   Sekarang keduanya harus ditebak lagi.

   Sempat digantikan ingatan satu username di peramban ini sendiri. Itu pun
   sudah dibuang: yang mengetik username kini mengetiknya sendiri, dan tidak
   ada nama yang tertinggal untuk orang berikutnya.

   /api/akun-daftar tidak dipanggil dari mana pun lagi. Endpointnya masih hidup
   di E-Logbook; matikan sekalian dengan ELOGBOOK_DAFTAR_AKUN=0.
   ======================================================================= */

el('btnMasuk').addEventListener('click', masuk);
el('iPass').addEventListener('keydown', e=>{ if(e.key === 'Enter') masuk(); });
el('iUser').addEventListener('keydown', e=>{ if(e.key === 'Enter') masuk(); });

/* Satu jalan masuk saja sekarang: akun E-Logbook yang sungguhan. Dulu ada
   dua, dan yang kedua memakai daftar akun tiruan di peramban — berguna untuk
   etalase di luar jaringan kantor, tapi sesudah dideploy ia cuma jadi pintu
   yang membuka layar berisi angka karangan. */
function masuk(){ return masukServer(); }

function bukaDashboard(){
  el('layarMasuk').classList.add('pergi');
  el('app').classList.add('tampil');
  gambarSemua();
  simpanSesi();
  // Tiga modul server menyusul: layar tidak perlu menunggunya, dan yang berubah
  // begitu ia datang cukup digambar ulang di tempatnya masing-masing.
  //
  // Berurutan, bukan serentak: jdwMuatAwal() yang memanggil hakMuat(), dan
  // kegiatan berkala maupun personel ikut menampilkan tombol berdasarkan hak
  // itu. Dijalankan berbarengan, keduanya akan sempat menggambar diri dengan
  // hak yang belum terjawab.
  jdwMuatAwal()
    .then(async ()=>{
      gambarDinas();
      if(unitDibuka && subtabAktif === 'dinas') jdwGambar();
      gambarAkun();     // panel hak di tab Kelola Akun ikut isinya
      /* Daftar galeri ikut ditarik ULANG di sini, bukan cuma sekali saat halaman
         dibuka. Di jalur tabel indeksnya menuntut sesi, jadi tarikan pertama —
         yang terjadi jauh sebelum ada yang masuk — dijawab 401 dan galerinya
         tinggal kosong sampai halaman disegarkan. */
      await Promise.all([bklMuat(), psnMuat(), muatGaleri()]);
      gambarUbin(); gambarPerhatian(); gambarLonceng(); gambarPersonel();
      if(unitDibuka) gambarUnit();
    })
    .catch(e=>console.warn('Modul dashboard gagal dimuat:', e && e.message || e));
}

