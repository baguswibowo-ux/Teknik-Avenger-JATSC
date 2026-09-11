/* E-Logbook · js/28-telegram.js — Notifikasi Telegram per-akun
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh (setelah
   27-ttd-tersimpan.js karena panelnya menumpang di modal "TTD Saya").

   Bot Telegram tidak bisa mengirim ke nomor telepon — hanya ke chat_id, dan
   chat_id baru bisa didapat setelah orangnya menekan Start di bot. Jadi tiap
   akun menautkan dirinya sekali:

     1. tekan "Hubungkan" → server memberi tautan t.me/<bot>?start=<kode>
     2. tautan dibuka → Telegram terbuka di bot → tekan Start
     3. bot menerima /start <kode>, server mengunci chat itu ke akun ini

   Sesudah itu notifikasi "perlu TTD" dan "sudah di-TTD" masuk ke Telegram
   pribadinya. Panel ini menyembunyikan dirinya sendiri kalau server belum
   menyalakan bot (tanpa token BotFather), supaya tidak ada tombol yang tak
   berfungsi. */

/** Status terakhir dari server, supaya render tidak perlu memanggil ulang. */
let telegramInfo = { aktif: false, tertaut: false, botUsername: '' };

/** Dipanggil saat modal "TTD Saya" dibuka. Diam-diam pulang kalau panelnya
    tidak ada (mis. layout lama dari cache). */
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
  renderTelegram();
}

function renderTelegram(){
  const status = document.getElementById('telegramStatus');
  const aksi = document.getElementById('telegramAksi');
  if(!status || !aksi) return;

  if(telegramInfo.tertaut){
    status.innerHTML = '<span class="tg-badge tg-on">✅ Terhubung</span> '
      + 'Notifikasi dikirim ke Telegram Anda.';
    aksi.innerHTML = '<button class="btn ghost" onclick="putuskanTelegram()">Putuskan</button>';
  }else{
    status.innerHTML = '<span class="tg-badge tg-off">Belum terhubung</span>';
    aksi.innerHTML = '<button class="btn" onclick="hubungkanTelegram()">🔗 Hubungkan Telegram</button>';
  }
}

/** Minta tautan taut ke server, lalu tampilkan tombol yang membuka bot. */
async function hubungkanTelegram(){
  const aksi = document.getElementById('telegramAksi');
  if(aksi) aksi.innerHTML = '<span class="subtle-note">Menyiapkan tautan…</span>';
  let data;
  try{
    data = await gsRun('telegramTaut');
  }catch(e){
    toast(e?.message || 'Gagal menyiapkan tautan Telegram.');
    renderTelegram();
    return;
  }
  if(!data || !data.aktif || !data.tautan){
    toast('Bot Telegram belum siap di server.');
    renderTelegram();
    return;
  }
  const url = data.tautan;
  if(aksi){
    aksi.innerHTML =
      `<a class="btn" href="${escapeHtml(url)}" target="_blank" rel="noopener">▶ Buka bot &amp; tekan Start</a>
       <button class="btn ghost" onclick="muatStatusTelegram()">Sudah, cek status</button>
       <div class="subtle-note" style="margin-top:6px;">
         Tekan tombol di atas → Telegram akan terbuka di bot
         <b>@${escapeHtml(data.botUsername || '')}</b> → tekan <b>Start</b>.
         Setelah bot membalas "berhasil terhubung", tekan "Sudah, cek status".
       </div>`;
  }
  // Sekalian buka langsung — kalau pop-up diblokir, tombol di atas tetap ada.
  try{ window.open(url, '_blank', 'noopener'); }catch(e){ /* diabaikan */ }
}

async function putuskanTelegram(){
  try{
    await gsRun('telegramPutus');
    telegramInfo.tertaut = false;
    toast('Notifikasi Telegram diputus.');
  }catch(e){
    toast(e?.message || 'Gagal memutus.');
  }
  renderTelegram();
}
