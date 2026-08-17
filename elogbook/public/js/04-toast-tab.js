/* E-Logbook · js/04-toast-tab.js — Pesan sekilas dan perpindahan antar tab
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh. */

/* ============== TOAST ============== */
function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(()=>t.classList.remove('show'), 2600);
}

/* ============== TABS ============== */
document.querySelectorAll('.tab-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('view-'+btn.dataset.tab).classList.add('active');
    // Pratinjau selalu milik tab tempat ia dibuka. Kalau ditinggal, ia akan
    // menggantung di bawah tab berikutnya dan menyesatkan — jadi ditutup.
    // Membukanya tadi menggulir layar turun ke lembar pratinjau, jadi begitu
    // ditutup layar dikembalikan ke atas — kalau tidak, tab baru terbuka di
    // ruang kosong dan terlihat seperti tidak ada isinya.
    if(tutupPratinjau()) window.scrollTo({ top:0, behavior:'auto' });
    // tab yang baru muncul: ukur ulang kanvas TTD di dalamnya
    setTimeout(()=>{ if(typeof resizeAllVisibleSigPads === 'function') resizeAllVisibleSigPads(); }, 50);
    // Rekap punya datanya sendiri dari server, jadi baru diminta saat tabnya dibuka.
    if(btn.dataset.tab === 'rekap' && typeof muatRekapKalauPerlu === 'function') muatRekapKalauPerlu();
  });
});
