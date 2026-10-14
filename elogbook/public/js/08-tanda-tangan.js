/* E-Logbook · js/08-tanda-tangan.js — Papan tanda tangan: gambar, ukur ulang, dan hasil PNG
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh. */

/* ============== SIGNATURE PAD ============== */
const sigPads = {};

/* Papan yang sedang memakai tanda tangan tersimpan milik akun, bukan goresan
   tangan (lihat 27-ttd-tersimpan.js). Disimpan di sini karena getSigDataUrl
   adalah satu-satunya pintu yang dipakai seluruh formulir untuk mengambil hasil
   tanda tangan — jadi tiap formulir tidak perlu tahu-menahu asalnya. */
const sigTersimpan = {};

/* TTD SEBAGAI QR (12 Oktober 2026). Tanda tangan tidak lagi digambar: tiap
   papan menjadi satu tombol, dan menekannya berarti "bubuhkan tanda tangan
   akun saya". Yang dikirim ke server cuma penanda ini — identitasnya diambil
   server dari sesi login, lalu disimpan sebagai gambar QR berisi unit, nama,
   dan NIK (lihat elogbook/ttd-qr.js).

   Seluruh formulir tetap memakai pintu yang sama (setupSigCanvas, clearSig,
   getSigDataUrl), jadi tidak satu pun perlu tahu bahwa papannya berganti. */
const PENANDA_QR = 'qr:akun';
/* Yang masih benar-benar digambar: hanya papan di jendela "TTD Saya". */
const PAPAN_GORES = ['sigTtdSaya'];
/* Penanda tangannya tidak punya akun — QR-nya memuat nama yang diketik di
   formulir, bukan nama akun yang sedang login. */
const PAPAN_ATAS_NAMA = ['sigMonOps', 'sigMonManOps', 'sigMonManOpsEdit', 'sigBapbPemakai', 'sigBapbPemakaiEdit'];

function setupSigQr(id, canvas){
  const state = {canvas, ctx: canvas.getContext('2d'), qr:true, empty:true, tetap:''};
  sigPads[id] = state;
  canvas.style.display = 'none';
  const wrap = canvas.closest('.sig-wrap');
  const bar = wrap && wrap.querySelector('.sig-toolbar');
  if(bar) bar.style.display = 'none';
  // Pejabat menandatangani lewat tombol simpan jendelanya sendiri.
  if(id === 'sigTtdPejabat'){ const fld = canvas.closest('.field'); if(fld) fld.style.display = 'none'; }
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'sig-qr-tombol';
  b.id = 'qr_' + id;
  b.onclick = ()=>{ if(state.tetap) return; state.empty = !state.empty; gambarSigQr(id); };
  canvas.parentNode.insertBefore(b, canvas);
  gambarSigQr(id);
}

function gambarSigQr(id){
  const s = sigPads[id], b = document.getElementById('qr_' + id);
  if(!s || !b) return;
  b.classList.toggle('sudah', !s.empty);
  if(s.tetap){
    b.innerHTML = `<img src="${s.tetap}" alt="TTD"><span>${escapeHtml(T('ttdQrSudahAda'))}</span>`;
  }else if(s.empty){
    b.innerHTML = `<b>${escapeHtml(T('ttdQrTekan'))}</b><span>${escapeHtml(T(PAPAN_ATAS_NAMA.includes(id) ? 'ttdQrKetNama' : 'ttdQrKet'))}</span>`;
  }else{
    b.innerHTML = `<b>✔ ${escapeHtml(T('ttdQrSudah'))}</b><span>${escapeHtml(T('ttdQrBatal'))}</span>`;
  }
}

/** Petak yang sudah ditandatangani sebelumnya (dinas pagi di lembar AMHS yang
    dilanjutkan dinas siang): tampil sebagai sudah terisi dan dikirim balik apa
    adanya, tidak bisa ditekan ulang atas nama orang lain. */
function sigIsiDariUrl(id, url){
  const s = sigPads[id];
  if(!s || !s.qr || !url) return false;
  s.tetap = url; s.empty = false;
  gambarSigQr(id);
  return true;
}

/** Ukur ulang kanvas sesuai lebar tampilnya. Wajib dipanggil saat kanvas baru terlihat,
 *  karena elemen tersembunyi (modal/tab) punya lebar 0 dan bikin kanvas tidak bisa digambar. */
function resizeSigCanvas(id){
  const s = sigPads[id];
  if(!s || s.qr) return;
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
  // Kanvas bisa tidak ada — mis. papan yang dihapus dari sebuah form (Manager
  // Teknik BAPB kini TTD susulan, tanpa kanvas). Lewati diam-diam supaya
  // initAllSigPads() tidak putus di tengah dan menyeret init() ikut gagal.
  if(!canvas) return;
  if(!PAPAN_GORES.includes(id)){ setupSigQr(id, canvas); return; }
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
  if(s.qr){ s.empty = true; s.tetap = ''; gambarSigQr(id); return; }
  resizeSigCanvas(id);
  s.ctx.save();
  s.ctx.setTransform(1,0,0,1,0,0);
  s.ctx.clearRect(0,0,s.canvas.width,s.canvas.height);
  s.ctx.restore();
  s.empty = true;
}
function getSigDataUrl(id){
  const q = sigPads[id];
  if(q && q.qr) return q.tetap || (q.empty ? null : PENANDA_QR);
  if(sigTersimpan[id]) return sigTersimpan[id];   // TTD tersimpan menggantikan goresan
  const s = sigPads[id]; if(!s || s.empty) return null; return s.canvas.toDataURL('image/png');
}
/* 'sigFeeTeknisi' — papan TTD susulan di jendela sunting catatan — ikut di sini
   dan bukan dibuat saat jendelanya dibuka, supaya pasangTombolTtdTersimpan()
   yang jalan sekali di init() ikut memasang tombol "pakai TTD tersimpan" di
   atasnya. Kanvas di dalam modal tersembunyi berlebar 0; resizeSigCanvas
   menunda dirinya sendiri sampai jendelanya benar-benar terlihat. */
function initAllSigPads(){ ['sigFeTeknisi','sigFeeTeknisi','sigDcTeknisi','sigMon','sigMonOps','sigMonManOps','sigDs','sigRadio','sigWk','sigLtkTeknisi','sigTtdPejabat','sigBerkala','sigBapbPemakai','sigBapbPetugas'].forEach(id=>{ if(!sigPads[id]) setupSigCanvas(id); }); }
function resizeAllVisibleSigPads(){ Object.keys(sigPads).forEach(resizeSigCanvas); }
window.addEventListener('resize', resizeAllVisibleSigPads);
window.addEventListener('orientationchange', ()=>setTimeout(resizeAllVisibleSigPads, 250));
function sigThumbHtml(url){
  if(!url) return '<span class="sig-empty-thumb">— belum TTD —</span>';
  if(String(url).includes('/qr-ttd/')){
    return `<div class="sig-thumb sig-qr"><img src="${url}" alt="TTD QR" title="${escapeHtml(T('ttdQrPerbesar'))}" onclick="bukaQrBesar(event, this.src)"></div>`;
  }
  return `<div class="sig-thumb"><img src="${url}" alt="TTD"></div>`;
}

/** QR sebesar layar. Di daftar, QR-nya hanya sebesar ibu jari — cukup untuk
    dikenali, terlalu rapat untuk kamera. Diketuk, ia tampil besar di atas latar
    putih supaya bisa dipindai dari HP lain. */
function bukaQrBesar(ev, src){
  if(ev){ ev.stopPropagation(); ev.preventDefault(); }
  document.getElementById('qrBesar')?.remove();
  const d = document.createElement('div');
  d.id = 'qrBesar';
  d.className = 'qr-besar';
  d.innerHTML = `<img src="${src}" alt="TTD QR"><span>${escapeHtml(T('ttdQrTutup'))}</span>`;
  d.onclick = ()=> d.remove();
  document.body.appendChild(d);
}
