/* E-Logbook · js/08-tanda-tangan.js — Papan tanda tangan: gambar, ukur ulang, dan hasil PNG
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh. */

/* ============== SIGNATURE PAD ============== */
const sigPads = {};

/* Papan yang sedang memakai tanda tangan tersimpan milik akun, bukan goresan
   tangan (lihat 27-ttd-tersimpan.js). Disimpan di sini karena getSigDataUrl
   adalah satu-satunya pintu yang dipakai seluruh formulir untuk mengambil hasil
   tanda tangan — jadi tiap formulir tidak perlu tahu-menahu asalnya. */
const sigTersimpan = {};

/** Ukur ulang kanvas sesuai lebar tampilnya. Wajib dipanggil saat kanvas baru terlihat,
 *  karena elemen tersembunyi (modal/tab) punya lebar 0 dan bikin kanvas tidak bisa digambar. */
function resizeSigCanvas(id){
  const s = sigPads[id];
  if(!s) return;
  const rect = s.canvas.getBoundingClientRect();
  if(rect.width === 0) return;                 // masih tersembunyi, tunda
  const ratio = window.devicePixelRatio || 1;
  const targetW = Math.round(rect.width * ratio);
  const targetH = Math.round(rect.height * ratio);
  if(s.canvas.width === targetW && s.canvas.height === targetH) return;  // sudah pas
  const prev = s.empty ? null : s.canvas.toDataURL('image/png');
  s.canvas.width = targetW;
  s.canvas.height = targetH;
  s.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);  // setTransform, bukan scale (agar tidak menumpuk)
  s.ctx.lineWidth = 2.2; s.ctx.lineCap = 'round'; s.ctx.lineJoin = 'round'; s.ctx.strokeStyle = '#ffffff';
  if(prev){
    const img = new Image();
    img.onload = ()=> s.ctx.drawImage(img, 0, 0, rect.width, rect.height);
    img.src = prev;
  }
}

function setupSigCanvas(id){
  const canvas = document.getElementById(id);
  const ctx = canvas.getContext('2d');
  const state = {canvas, ctx, drawing:false, empty:true};
  sigPads[id] = state;
  resizeSigCanvas(id);

  function pos(e){
    const rect = canvas.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    return {x:p.clientX-rect.left, y:p.clientY-rect.top};
  }
  function start(e){
    e.preventDefault();
    resizeSigCanvas(id);          // pastikan ukuran benar sebelum menggambar
    state.drawing=true;
    const p=pos(e); ctx.beginPath(); ctx.moveTo(p.x,p.y);
    ctx.lineTo(p.x+0.1,p.y+0.1); ctx.stroke();   // titik, agar tap tunggal terlihat
    state.empty=false;
  }
  function move(e){ if(!state.drawing) return; e.preventDefault(); const p=pos(e); ctx.lineTo(p.x,p.y); ctx.stroke(); state.empty=false; }
  function end(){ state.drawing=false; }

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);
  canvas.addEventListener('touchstart', start, {passive:false});
  canvas.addEventListener('touchmove', move, {passive:false});
  canvas.addEventListener('touchend', end);
  canvas.addEventListener('touchcancel', end);
}
function clearSig(id){
  delete sigTersimpan[id];
  document.getElementById('lapis_' + id)?.remove();
  const s = sigPads[id]; if(!s) return;
  resizeSigCanvas(id);
  s.ctx.save();
  s.ctx.setTransform(1,0,0,1,0,0);
  s.ctx.clearRect(0,0,s.canvas.width,s.canvas.height);
  s.ctx.restore();
  s.empty = true;
}
function getSigDataUrl(id){
  if(sigTersimpan[id]) return sigTersimpan[id];   // TTD tersimpan menggantikan goresan
  const s = sigPads[id]; if(!s || s.empty) return null; return s.canvas.toDataURL('image/png');
}
/* 'sigFeeTeknisi' — papan TTD susulan di jendela sunting catatan — ikut di sini
   dan bukan dibuat saat jendelanya dibuka, supaya pasangTombolTtdTersimpan()
   yang jalan sekali di init() ikut memasang tombol "pakai TTD tersimpan" di
   atasnya. Kanvas di dalam modal tersembunyi berlebar 0; resizeSigCanvas
   menunda dirinya sendiri sampai jendelanya benar-benar terlihat. */
function initAllSigPads(){ ['sigFeTeknisi','sigFeeTeknisi','sigDcTeknisi','sigMon','sigMonOps','sigDs','sigRadio','sigWk','sigLtkTeknisi','sigTtdPejabat','sigBerkala','sigBapbPemakai','sigBapbTeknik','sigBapbPetugas'].forEach(id=>{ if(!sigPads[id]) setupSigCanvas(id); }); }
function resizeAllVisibleSigPads(){ Object.keys(sigPads).forEach(resizeSigCanvas); }
window.addEventListener('resize', resizeAllVisibleSigPads);
window.addEventListener('orientationchange', ()=>setTimeout(resizeAllVisibleSigPads, 250));
function sigThumbHtml(url){
  if(!url) return '<span class="sig-empty-thumb">— belum TTD —</span>';
  return `<div class="sig-thumb"><img src="${url}" alt="TTD"></div>`;
}
