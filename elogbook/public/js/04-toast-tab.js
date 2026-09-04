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

/* Tab BERTINGKAT generik (.lvl). Dipakai di dalam sub-tab yang isinya masih
   bercabang — mis. Ground Check → LLZ/GP/MM → 07L/07R/25R/25L. Tiap tingkat
   adalah satu <div class="lvl"> berisi <div class="lvl-tabs"> (tombol
   .lvl-btn dengan data-target = id panel) dan <div class="lvl-body"> (panel
   .lvl-panel). Karena tombolnya menukar hanya anak LANGSUNG level-nya sendiri
   (":scope >"), tingkat di dalam panel tak ikut terpengaruh — jadi satu handler
   melayani berapa pun kedalaman. Tak menyentuh .subtab-btn / .subview. */
document.querySelectorAll('.lvl-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const tabs = btn.parentElement;                       // .lvl-tabs tingkat ini
    const lvl  = btn.closest('.lvl');
    const body = lvl && lvl.querySelector(':scope > .lvl-body');
    if(tabs) tabs.querySelectorAll(':scope > .lvl-btn').forEach(b=>b.classList.remove('active'));
    if(body) body.querySelectorAll(':scope > .lvl-panel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    const t = document.getElementById(btn.dataset.target);
    if(t) t.classList.add('active');
    setTimeout(()=>{ if(typeof resizeAllVisibleSigPads === 'function') resizeAllVisibleSigPads(); }, 50);
  });
});
