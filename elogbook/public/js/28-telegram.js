/* E-Logbook · js/28-telegram.js — Notifikasi Telegram per-akun
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh (sebelum
   28c-profil.js, yang memanggil muatStatusTelegram saat modal Profil dibuka).

   Bot Telegram tidak bisa mengirim ke nomor telepon — hanya ke chat_id, dan
   chat_id baru bisa didapat setelah orangnya menekan Start di bot. Jadi tiap
   akun menautkan dirinya sekali:

     1. server memberi tautan t.me/<bot>?start=<kode>
     2. tautan dibuka → Telegram terbuka di bot → tekan Start
     3. bot menerima /start <kode>, server mengunci chat itu ke akun ini

   KODENYA DIAMBIL DI MUKA, sebelum ada yang ditekan. Dulu urutannya: tekan
   "Hubungkan" → tunggu server → baru muncul tombol yang membuka Telegram. Dua
   tekan untuk satu maksud, dan yang pertama cuma menunggu. Sekarang begitu
   panel ini tampil, kode taut sudah diminta diam-diam, jadi tombol yang
   terlihat orang MEMANG tautan Telegram: satu tekan, mendarat di bot, tinggal
   Start. Ongkosnya satu permintaan kecil tiap kali Profil dibuka oleh akun
   yang belum tertaut — kode lama digantikan yang baru, dan kode berlaku sekali
   pakai, jadi tidak ada yang menumpuk.

   TIDAK ADA TOMBOL YANG MEMUTUS. Semua tombol di panel ini aman ditekan
   berkali-kali: yang terjadi hanya kode taut baru. Sambungan yang sudah ada
   cuma berpindah kalau ada chat lain yang benar-benar menekan Start, dan itu
   berarti orangnya memang sedang pindah Telegram. Notifikasi TTD bukan pilihan
   pribadi, jadi tidak boleh ada jalan mematikannya dengan salah tekan.

   Panel ini menyembunyikan dirinya sendiri kalau server belum menyalakan bot
   (tanpa token BotFather), supaya tidak ada tombol yang tak berfungsi. */

/** Status terakhir dari server, supaya render tidak perlu memanggil ulang. */
let telegramInfo = { aktif: false, tertaut: false, botUsername: '' };

/** Tautan t.me/<bot>?start=<kode> yang sudah siap pakai, dan keadaan
    penyiapannya: 'muat' (sedang diminta), 'siap', atau 'gagal'. */
let telegramTautan = '';
let telegramSiap = 'muat';

/** Dipanggil saat modal Profil dibuka. Diam-diam pulang kalau panelnya tidak
    ada (mis. layout lama yang masih tertahan cache peramban). */
async function muatStatusTelegram(){
  const panel = document.getElementById('telegramPanel');
  if(!panel) return;
  try{
    telegramInfo = await gsRun('telegramStatus') || { aktif:false };
  }catch(e){
    telegramInfo = { aktif:false };
  }
  if(!telegramInfo.aktif){
    // Server belum mengaktifkan bot — sembunyikan seluruh bagian.
    panel.style.display = 'none';
    return;
  }
  panel.style.display = '';
  telegramTautan = '';
  telegramSiap = 'muat';
  renderTelegram();                       // tampilkan keadaan dulu, jangan menunggu jaringan
  if(!telegramInfo.tertaut) await siapkanTautanTelegram();
}

/** Minta kode taut ke server lebih dulu, supaya tombolnya sungguh-sungguh
    tautan Telegram dan bukan tombol yang menyuruh menunggu. Aman dipanggil
    berulang: yang berubah hanya kode yang berlaku. */
async function siapkanTautanTelegram(){
  let data = null;
  try{
    data = await gsRun('telegramTaut');
  }catch(e){
    data = null;
  }
  if(data && data.aktif && data.tautan){
    telegramTautan = data.tautan;
    telegramSiap = 'siap';
    if(data.botUsername) telegramInfo.botUsername = data.botUsername;
  }else{
    telegramSiap = 'gagal';
  }
  renderTelegram();
  return telegramTautan;
}

function renderTelegram(){
  const status = document.getElementById('telegramStatus');
  const aksi = document.getElementById('telegramAksi');
  if(!status || !aksi) return;

  if(telegramInfo.tertaut){
    status.innerHTML = '<span class="tg-badge tg-on">✅ Terhubung</span> '
      + 'Notifikasi dikirim ke Telegram Anda.';
    aksi.innerHTML = '<button class="btn ghost" onclick="gantiAkunTelegram()">Ganti akun Telegram</button>';
    return;
  }

  status.innerHTML = '<span class="tg-badge tg-off">Belum terhubung</span>';

  if(telegramSiap === 'muat'){
    aksi.innerHTML = '<span class="subtle-note">Menyiapkan tautan…</span>';
    return;
  }
  if(telegramSiap === 'gagal'){
    aksi.innerHTML = '<button class="btn" onclick="siapkanTautanTelegram()">🔗 Hubungkan Telegram</button>'
      + '<span class="subtle-note" style="margin-left:8px;">Tautan gagal disiapkan — coba lagi.</span>';
    return;
  }
  /* Tautan sungguhan, bukan tombol yang memanggil server dulu. Statusnya
     disegarkan sendiri beberapa detik kemudian, supaya orang yang kembali dari
     Telegram langsung melihat "Terhubung" tanpa menekan apa pun lagi. */
  aksi.innerHTML =
    `<a class="btn" href="${escapeHtml(telegramTautan)}" target="_blank" rel="noopener"
        onclick="setTimeout(muatStatusTelegram, 4000);">▶ Hubungkan lewat Telegram</a>
     <button class="btn ghost" onclick="muatStatusTelegram()">Sudah, cek status</button>
     <div class="subtle-note" style="margin-top:6px;">
       Satu tekan membuka bot <b>@${escapeHtml(telegramInfo.botUsername || '')}</b> di Telegram
       — tinggal tekan <b>Start</b> di sana. Kalau statusnya belum berubah
       sekembalinya ke sini, tekan "Sudah, cek status".
     </div>`;
}

/** Pindah ke Telegram lain: kode baru, lalu bot dibuka langsung. Chat lama
    TETAP menerima sampai chat baru menekan Start — menekan tombol ini tidak
    memutus apa pun, jadi salah tekan tidak berakibat. */
async function gantiAkunTelegram(){
  const aksi = document.getElementById('telegramAksi');
  if(aksi) aksi.innerHTML = '<span class="subtle-note">Menyiapkan tautan…</span>';
  const url = await siapkanTautanTelegram();
  if(!url){ toast('Bot Telegram belum siap di server.'); return; }
  if(aksi){
    aksi.innerHTML =
      `<a class="btn" href="${escapeHtml(url)}" target="_blank" rel="noopener">▶ Buka Telegram &amp; tekan Start</a>
       <button class="btn ghost" onclick="muatStatusTelegram()">Sudah, cek status</button>
       <div class="subtle-note" style="margin-top:6px;">
         Buka tautan ini di Telegram yang <b>baru</b>. Sampai di sana ditekan
         Start, notifikasi tetap ke Telegram lama.
       </div>`;
  }
  // Sekalian buka langsung — kalau pop-up diblokir, tombol di atas tetap ada.
  try{ window.open(url, '_blank', 'noopener'); }catch(e){ /* diabaikan */ }
}
