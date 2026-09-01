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
  try{
    if(!SRV.ada || !SRV.sesi) return lupakanSesi();
    segarkanKartuMasuk();
    await srvMuat();
  }catch(e){
    console.warn('Sesi sebelumnya tidak bisa dipulihkan:', e && e.message || e);
    return lupakanSesi();
  }

  bukaDashboard();
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

