/* =======================================================================
   SESI YANG BERTAHAN SAAT HALAMAN DISEGARKAN

   Sebelumnya menekan F5 melempar siapa pun kembali ke layar masuk. Untuk
   halaman yang memang dipakai berjam-jam sambil dinas itu menjengkelkan, dan
   tidak ada alasannya: dalam mode server yang menjaga pintu tetap cookie sesi
   E-Logbook, dan penanda di sini tidak menggantikannya sedikit pun — sesi yang
   sudah mati di sana tetap berakhir di layar masuk.

   sessionStorage, bukan localStorage: yang perlu bertahan cuma segarnya
   halaman, bukan tutupnya peramban. Menutup tab tetap berarti keluar, dan itu
   yang diharapkan orang dari komputer yang dipakai bergantian satu ruangan.
   ======================================================================= */
const SESI_KUNCI = 'avenger.sesi';

function simpanSesi(){
  if(!akun) return;
  const layar = document.querySelector('.layar.aktif');
  try{
    sessionStorage.setItem(SESI_KUNCI, JSON.stringify({
      user:  akun.user,
      layar: layar ? layar.id.slice(2) : 'beranda',
      unit:  unitDibuka
    }));
  }catch(e){ /* penyimpanan ditolak (mode privat, kuota): sesi cukup seumur tab */ }
}

function lupakanSesi(){
  try{ sessionStorage.removeItem(SESI_KUNCI); }catch(e){ /* tidak apa-apa */ }
  // Simpanan jawaban server ikut pergi bersama sesinya: keluar berarti tidak
  // ada data siapa pun yang tertinggal untuk tampil sekilas di refresh berikut.
  if(typeof simpananLupakan === 'function') simpananLupakan();
  // data-pulih dipasang inline di <head> supaya layar masuk tidak berkedip
  // sekilas sebelum dashboard muncul; kalau sesi gagal dipulihkan, atribut ini
  // harus lepas supaya kartu masuk kelihatan lagi.
  document.documentElement.removeAttribute('data-pulih');
}

function bacaSesi(){
  try{ return JSON.parse(sessionStorage.getItem(SESI_KUNCI) || 'null'); }
  catch(e){ return null; }
}

/**
 * Buka kembali dashboard seperti sebelum halaman disegarkan.
 *
 * Dipanggil setelah srvPeriksa() selesai, bukan sebelumnya: mode server baru
 * boleh dipulihkan kalau cookie E-Logbook-nya memang masih hidup, dan itu
 * jawaban /api/me yang menentukan. Kegagalan apa pun berakhir sama — penanda
 * dibuang dan layar masuk tetap yang tampil.
 */
async function pulihkanSesi(){
  const s = bacaSesi();
  if(!s){ document.documentElement.removeAttribute('data-pulih'); return; }
  if(!SRV.ada || !SRV.sesi) return lupakanSesi();
  segarkanKartuMasuk();

  /* Dua pass — lihat SIMPANAN JAWABAN SERVER di 12-jembatan-elogbook.js.

     Pass pertama dari simpanan: tanpa jaringan, dashboard langsung tampil
     dengan data yang terakhir dilihat akun ini. Gagal di sini bukan masalah
     (tab baru belum punya simpanan, atau simpanannya milik akun lain) —
     tinggal jatuh ke jalur biasa, yang memang jalur lama.

     Pass kedua ke server, lalu gambar ulang. Kalau yang ini gagal SESUDAH
     simpanan tampil, dashboard dibiarkan berdiri dengan data terakhirnya —
     kecuali servernya bilang sesinya sudah tidak berlaku (401/403): data lama
     di balik sesi yang mati harus turun dan kartu masuk yang naik. */
  let dariSimpanan = false;
  try{
    await srvMuat({ simpanan: 'baca' });
    bukaDashboard();
    pulihkanLayar(s);
    el('ketBeranda').textContent += T(' · memperbarui dari server…', ' · refreshing from server…');
    dariSimpanan = true;
  }catch(e){
    // Simpanan yang tidak terpakai dibuang: yang setengah cocok lebih buruk
    // daripada yang tidak ada, karena gagalnya akan berulang tiap refresh.
    simpananLupakan();
  }

  try{
    await srvMuat();
  }catch(e){
    const sesiMati = /menjawab 40[13]\b/.test(e && e.message || '');
    if(dariSimpanan && !sesiMati){
      console.warn('Pembaruan dari server gagal; data terakhir tetap ditampilkan:', e && e.message || e);
      gambarSemua();      // menghapus tanda "memperbarui…" — yang tampil memang data terakhir
      return;
    }
    console.warn('Sesi sebelumnya tidak bisa dipulihkan:', e && e.message || e);
    lupakanSesi();
    if(dariSimpanan){
      akun = null; unitDibuka = null;
      el('app').classList.remove('tampil');
      el('layarMasuk').classList.remove('pergi');
      segarkanKartuMasuk();
      pesan(T('Sesi Anda sudah berakhir — silakan masuk lagi.', 'Your session has ended — please sign in again.'));
    }
    return;
  }

  if(dariSimpanan){
    gambarSemua();        // data segar menimpa yang dari simpanan, tanda "memperbarui…" ikut hilang
    if(unitDibuka) gambarUnit();
  }else{
    bukaDashboard();
    pulihkanLayar(s);
  }
}

/** Kembali ke layar dan unit yang terbuka sebelum halaman disegarkan. */
function pulihkanLayar(s){
  if(s.unit && bolehBuka(s.unit)) bukaUnit(s.unit);
  // Layar yang tombolnya sedang tersembunyi tidak ikut dipulihkan — Kelola Akun
  // milik akun yang sebelumnya administrator, dan yang masuk sekarang belum
  // tentu orang yang sama.
  const tombol = document.querySelector(`#rel button[data-layar="${s.layar}"]`);
  if(tombol && !tombol.hidden) pindahLayar(s.layar);
}

el('tombolKeluar').addEventListener('click', async ()=>{
  lupakanSesi();
  akun = null; unitDibuka = null;
  el('app').classList.remove('tampil');
  el('layarMasuk').classList.remove('pergi');
  el('iPass').value = '';
  // Kolom username dikosongkan dan dibiarkan kosong: sesi yang sudah diputus
  // tidak meninggalkan nama siapa pun. Di komputer yang dipakai bergantian,
  // orang berikutnya tidak menemukan jejak orang sebelumnya di layar masuk.
  el('iUser').value = ''; userDiketik = false;
  kmSetTab('masuk');
  kmSetMasuk(true);         // yang baru keluar biasanya mau masuk lagi
  pasangTabAkun();          // tab Kelola Akun ikut pergi bersama akunnya
  pindahLayar('beranda');
  // Sesi E-Logbook-nya ikut diputus — keluar yang tidak mengeluarkan adalah
  // janji yang tidak ditepati. Lihat putusSesiServer(). Kartu masuknya
  // digambar ulang sesudahnya supaya baris status dan tombolnya tidak
  // tertinggal di keadaan sebelum keluar.
  await putusSesiServer();
  segarkanKartuMasuk();
});

