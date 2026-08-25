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

/* ============== SUB-TAB (di dalam Preventive Maintenance) ==============
   Deretan sub-tab hanya menukar .subview di dalam wadah tab utamanya —
   tidak menyentuh .view di luar. Jadi klik di sini tidak akan menutup
   tab utama yang sedang aktif. */
document.querySelectorAll('.subtab-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const wadah = btn.closest('.view');
    if(!wadah) return;
    wadah.querySelectorAll('.subtab-btn').forEach(b=>b.classList.remove('active'));
    wadah.querySelectorAll('.subview').forEach(v=>v.classList.remove('active'));
    btn.classList.add('active');
    const anak = document.getElementById('view-'+btn.dataset.subtab);
    if(anak) anak.classList.add('active');
    if(typeof tutupPratinjau === 'function' && tutupPratinjau()) window.scrollTo({ top:0, behavior:'auto' });
    setTimeout(()=>{ if(typeof resizeAllVisibleSigPads === 'function') resizeAllVisibleSigPads(); }, 50);
  });
});
