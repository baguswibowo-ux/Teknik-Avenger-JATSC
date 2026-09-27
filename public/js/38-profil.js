/* =======================================================================
   PROFIL AKUN

   Satu-satunya tempat orang mengurus akunnya sendiri. Isinya sekarang
   identitas dan notifikasi HP (40-notif-hp.js); sunting nama dan ganti kata
   sandi menyusul, dan tempatnya sudah disiapkan di bawah blok identitas.

   KENAPA DI DASHBOARD, BUKAN DI E-LOGBOOK. Akunnya memang satu: dashboard
   tidak punya daftar akun sendiri, ia menanyakan identitas ke E-Logbook lewat
   /api/me (lihat 12-jembatan-elogbook.js). Dashboard juga pintu masuk yang
   sebenarnya — E-Logbook duduk di dalamnya, di /logbook/. Menaruh pengaturan
   akun di dalam E-Logbook berarti orang harus masuk satu lapis lebih dalam
   untuk sesuatu yang tidak ada hubungannya dengan formulir.
   ======================================================================= */

function bukaProfil(){
  const u = SRV.sesi;
  if(!u){
    pesan(T('Masuk dulu untuk membuka profil.', 'Sign in first to open your profile.'));
    return;
  }
  gambarProfilIdentitas(u);
  el('lapisProfil').classList.add('buka');
  if(typeof hpSegarkanProfil === 'function') hpSegarkanProfil();   // bagian Notifikasi HP, 40-notif-hp.js
}

function tutupProfil(){
  el('lapisProfil').classList.remove('buka');
}

/** Identitas apa adanya dari sesi yang sedang berjalan — tidak memanggil
    server: semuanya sudah ada di SRV.sesi, jawaban /api/me. */
function gambarProfilIdentitas(u){
  const unit = u.semuaUnit
    ? T('semua unit', 'all units')
    : ((u.unit || []).map(k => namaUnit(k)).join(', ') || T('belum diberi unit', 'no unit assigned'));
  const baris = [
    [T('Nama','Name'),          u.nama || u.username],
    [T('Username','Username'),  u.username],
    [T('Peran','Role'),         peranTampil(u.role)],
    [T('Unit','Unit'),          unit]
  ];
  el('profilIdentitas').innerHTML = baris.map(([label, isi]) =>
    `<div class="profil-baris"><span class="profil-label">${esc(label)}</span>
     <span class="profil-isi">${esc(isi)}</span></div>`).join('');
}

/* ---------- Pemasangan ---------- */

el('tombolProfil').addEventListener('click', bukaProfil);
el('btnTutupProfil').addEventListener('click', tutupProfil);
el('lapisProfil').addEventListener('click', e=>{ if(e.target === el('lapisProfil')) tutupProfil(); });
document.addEventListener('keydown', e=>{
  if(e.key === 'Escape' && el('lapisProfil').classList.contains('buka')) tutupProfil();
});
