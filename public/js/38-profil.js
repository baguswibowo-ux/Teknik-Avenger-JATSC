/* =======================================================================
   PROFIL AKUN

   Satu-satunya tempat orang mengurus akunnya sendiri. Isinya sekarang
   identitas dan sambungan Telegram; sunting nama dan ganti kata sandi
   menyusul, dan tempatnya sudah disiapkan di bawah blok identitas.

   KENAPA DI DASHBOARD, BUKAN DI E-LOGBOOK. Akunnya memang satu: dashboard
   tidak punya daftar akun sendiri, ia menanyakan identitas ke E-Logbook lewat
   /api/me (lihat 12-jembatan-elogbook.js). Dashboard juga pintu masuk yang
   sebenarnya — E-Logbook duduk di dalamnya, di /logbook/. Menaruh pengaturan
   akun di dalam E-Logbook berarti orang harus masuk satu lapis lebih dalam
   untuk sesuatu yang tidak ada hubungannya dengan formulir.

   Panel Telegram memanggil API E-Logbook apa adanya lewat srvApi — tidak ada
   endpoint baru di server dashboard, dan tidak ada salinan data di sini.

   KODE TAUT DIAMBIL DI MUKA. Dulu di E-Logbook urutannya: tekan "Hubungkan",
   tunggu server, baru muncul tombol yang membuka Telegram. Dua tekan untuk
   satu maksud. Di sini kode sudah diminta diam-diam begitu kartu Profil
   terbuka, jadi tombol yang dilihat orang MEMANG tautan t.me: satu tekan,
   mendarat di bot, tinggal Start.

   TIDAK ADA TOMBOL YANG MEMUTUS. Semua tombol di kartu ini aman ditekan
   berkali-kali; yang terjadi hanya kode taut baru, dan kode berlaku sekali
   pakai. Sambungan berpindah hanya kalau ada chat lain yang benar-benar
   menekan Start — artinya orangnya memang sedang pindah Telegram. Notifikasi
   tanda tangan bukan pilihan pribadi, jadi tidak boleh ada jalan
   mematikannya dengan salah tekan.
   ======================================================================= */

/** Keadaan panel Telegram: status terakhir dari server, tautan yang sudah
    siap, dan tahap penyiapannya ('muat' | 'siap' | 'gagal'). */
let tgInfo = { aktif:false, tertaut:false, botUsername:'' };
let tgTautan = '';
let tgSiap = 'muat';

function bukaProfil(){
  const u = SRV.sesi;
  if(!u){
    pesan(T('Masuk dulu untuk membuka profil.', 'Sign in first to open your profile.'));
    return;
  }
  gambarProfilIdentitas(u);
  el('lapisProfil').classList.add('buka');
  muatProfilTelegram();
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

/* ---------- Notifikasi Telegram ---------- */

async function muatProfilTelegram(){
  const panel = el('profilTelegram');
  try{
    tgInfo = await srvApi('telegramStatus') || { aktif:false };
  }catch(e){
    tgInfo = { aktif:false };
  }
  // Server belum menyalakan bot (tanpa token BotFather): sembunyikan seluruh
  // bagian, jangan tampilkan tombol yang tidak akan berfungsi.
  panel.hidden = !tgInfo.aktif;
  if(!tgInfo.aktif) return;
  tgTautan = '';
  tgSiap = 'muat';
  gambarProfilTelegram();
  if(!tgInfo.tertaut) await siapkanTautanTg();
}

/** Minta kode taut lebih dulu supaya tombolnya sungguh-sungguh tautan
    Telegram. Aman dipanggil berulang: yang berubah cuma kode yang berlaku. */
async function siapkanTautanTg(){
  let data = null;
  try{ data = await srvApi('telegramTaut'); }catch(e){ data = null; }
  if(data && data.aktif && data.tautan){
    tgTautan = data.tautan;
    tgSiap = 'siap';
    if(data.botUsername) tgInfo.botUsername = data.botUsername;
  }else{
    tgSiap = 'gagal';
  }
  gambarProfilTelegram();
  return tgTautan;
}

function gambarProfilTelegram(){
  const status = el('profilTgStatus');
  const aksi = el('profilTgAksi');

  if(tgInfo.tertaut){
    status.innerHTML = `<span class="tg-lencana on">${T('Terhubung','Connected')}</span> `
      + esc(T('Notifikasi dikirim ke Telegram Anda.', 'Notifications go to your Telegram.'));
    aksi.innerHTML = `<button class="btn garis" id="btnGantiTg">${esc(T('Ganti akun Telegram','Switch Telegram account'))}</button>`;
    el('btnGantiTg').addEventListener('click', gantiAkunTg);
    return;
  }

  status.innerHTML = `<span class="tg-lencana off">${T('Belum terhubung','Not connected')}</span>`;

  if(tgSiap === 'muat'){
    aksi.innerHTML = `<span class="bantu">${esc(T('Menyiapkan tautan…','Preparing the link…'))}</span>`;
    return;
  }
  if(tgSiap === 'gagal'){
    aksi.innerHTML = `<button class="btn" id="btnUlangTg">${esc(T('Hubungkan Telegram','Connect Telegram'))}</button>`
      + `<span class="bantu">${esc(T('Tautan gagal disiapkan — coba lagi.','The link could not be prepared — try again.'))}</span>`;
    el('btnUlangTg').addEventListener('click', siapkanTautanTg);
    return;
  }
  /* Tautan sungguhan, bukan tombol yang memanggil server dulu. Statusnya
     disegarkan sendiri beberapa detik kemudian, supaya yang kembali dari
     Telegram langsung melihat "Terhubung" tanpa menekan apa pun lagi. */
  aksi.innerHTML =
    `<a class="btn" href="${esc(tgTautan)}" target="_blank" rel="noopener" id="tautTg"
      >▶ ${esc(T('Hubungkan lewat Telegram','Connect via Telegram'))}</a>
     <button class="btn garis" id="btnCekTg">${esc(T('Sudah, cek status','Done, check status'))}</button>
     <div class="bantu">${T(
        'Satu tekan membuka bot <b>@' + esc(tgInfo.botUsername || '') + '</b> di Telegram — tinggal tekan <b>Start</b> di sana.',
        'One tap opens the <b>@' + esc(tgInfo.botUsername || '') + '</b> bot in Telegram — just press <b>Start</b> there.')}</div>`;
  el('tautTg').addEventListener('click', ()=> setTimeout(muatProfilTelegram, 4000));
  el('btnCekTg').addEventListener('click', muatProfilTelegram);
}

/** Pindah ke Telegram lain: kode baru, lalu bot dibuka langsung. Chat lama
    TETAP menerima sampai chat baru menekan Start — menekan tombol ini tidak
    memutus apa pun, jadi salah tekan tidak berakibat. */
async function gantiAkunTg(){
  const aksi = el('profilTgAksi');
  aksi.innerHTML = `<span class="bantu">${esc(T('Menyiapkan tautan…','Preparing the link…'))}</span>`;
  const url = await siapkanTautanTg();
  if(!url){ pesan(T('Bot Telegram belum siap di server.','The Telegram bot is not ready on the server.')); return; }
  aksi.innerHTML =
    `<a class="btn" href="${esc(url)}" target="_blank" rel="noopener" id="tautTgBaru"
      >▶ ${esc(T('Buka Telegram & tekan Start','Open Telegram and press Start'))}</a>
     <button class="btn garis" id="btnCekTg2">${esc(T('Sudah, cek status','Done, check status'))}</button>
     <div class="bantu">${T(
        'Buka tautan ini di Telegram yang <b>baru</b>. Sampai di sana ditekan Start, notifikasi tetap ke Telegram lama.',
        'Open this link in the <b>new</b> Telegram. Until Start is pressed there, notifications keep going to the old one.')}</div>`;
  el('btnCekTg2').addEventListener('click', muatProfilTelegram);
  // Sekalian buka langsung — kalau pop-up diblokir, tombol di atas tetap ada.
  try{ window.open(url, '_blank', 'noopener'); }catch(e){ /* diabaikan */ }
}

/* ---------- Pemasangan ---------- */

el('tombolProfil').addEventListener('click', bukaProfil);
el('btnTutupProfil').addEventListener('click', tutupProfil);
el('lapisProfil').addEventListener('click', e=>{ if(e.target === el('lapisProfil')) tutupProfil(); });
document.addEventListener('keydown', e=>{
  if(e.key === 'Escape' && el('lapisProfil').classList.contains('buka')) tutupProfil();
});
