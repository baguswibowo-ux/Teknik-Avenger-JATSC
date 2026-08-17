/* E-Logbook · js/27-ttd-tersimpan.js — Tanda tangan tersimpan milik tiap akun
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh.

   Tiap orang menggambar tanda tangannya sendiri SEKALI lewat jendela "TTD
   Saya", lalu memakainya ulang di formulir mana pun tanpa menggambar lagi.
   Dua tempat memakainya:

   1. PAPAN TANDA TANGAN DI FORMULIR. Tombol "pakai TTD tersimpan" di tiap papan
      menutupi kanvasnya dengan tanda tangan yang sudah ada. "Bersihkan"
      mengembalikannya jadi papan kosong seperti semula.

   2. PEJABAT MENYETUJUI. Di jendela pembubuhan TTD susulan, satu tombol
      memungut tanda tangan tersimpan itu lalu langsung mengirimkannya — tanpa
      menggambar ulang tiap kali menyetujui catatan.

   YANG DIKIRIM KE SERVER SELALU GAMBARNYA, BUKAN PATH BERKAS MILIK AKUN.
   Menghapus catatan ikut menghapus berkas tanda tangannya (removeSignatureFile
   di db.js), jadi kalau catatan memakai path yang sama dengan milik akun, satu
   penghapusan melenyapkan tanda tangan orang itu dari seluruh catatan lain
   sekaligus. Tiap catatan harus memegang salinannya sendiri. */

/** Path /uploads/... tanda tangan tersimpan milik akun yang sedang masuk. */
let ttdTersimpanSaya = '';
/** Salinan dataURL-nya. Berkasnya dibaca sekali, lalu diingat selama halaman hidup. */
let ttdTersimpanData = '';

/** Dipanggil init() begitu getAllData menjawab, dan tiap kali yang tersimpan berubah. */
function setTtdTersimpanSaya(path){
  ttdTersimpanSaya = String(path || '');
  ttdTersimpanData = '';
  perbaruiTampilanTtdTersimpan();
}

/** Berkas PNG milik akun -> dataURL, lewat kanvas. Sama asal (/uploads di balik
    login), jadi kanvasnya tidak tercemar dan boleh dibaca kembali. */
function gambarKeDataUrl(url){
  return new Promise((resolve)=>{
    const img = new Image();
    img.onload = ()=>{
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      try{ resolve(c.toDataURL('image/png')); }catch(e){ resolve(''); }
    };
    img.onerror = ()=> resolve('');
    img.src = url;
  });
}

async function dataUrlTtdTersimpan(){
  if(!ttdTersimpanSaya) return '';
  if(!ttdTersimpanData) ttdTersimpanData = await gambarKeDataUrl(ttdTersimpanSaya);
  return ttdTersimpanData;
}

/* ---------- Papan tanda tangan: pakai yang tersimpan ---------- */

/** Papan di jendela "TTD Saya" tidak ikut diberi tombol ini — di situlah tanda
    tangan tersimpannya dibuat, jadi memakainya kembali di sana tidak berarti. */
const PAPAN_TANPA_TOMBOL_TERSIMPAN = ['sigTtdSaya'];

/** Tombolnya disisipkan ke tiap papan lewat kode, bukan di index.html — supaya
    menambah papan baru tidak perlu mengingat tombol ini. */
function pasangTombolTtdTersimpan(){
  Object.keys(sigPads).forEach(id=>{
    if(PAPAN_TANPA_TOMBOL_TERSIMPAN.includes(id)) return;
    const bar = document.getElementById(id)?.closest('.sig-wrap')?.querySelector('.sig-toolbar');
    if(!bar || bar.querySelector('.sig-pakai')) return;
    const b = document.createElement('button');
    b.className = 'sig-pakai';
    b.type = 'button';
    // data-t, bukan sekadar textContent: tombolnya lahir dari kode, tapi
    // terapkanBahasa() menyapu seluruh [data-t] — jadi ikut berganti bahasa.
    b.dataset.t = 'pakaiTtdTersimpan';
    b.textContent = T('pakaiTtdTersimpan');
    b.onclick = ()=> pakaiTtdTersimpan(id);
    bar.insertBefore(b, bar.querySelector('.sig-clear'));
  });
  perbaruiTampilanTtdTersimpan();
}

/** Selama akun ini belum punya tanda tangan tersimpan, tombolnya tidak ada
    gunanya — sembunyikan, jangan biarkan ditekan lalu menjawab "belum ada". */
function perbaruiTampilanTtdTersimpan(){
  const ada = !!ttdTersimpanSaya;
  document.querySelectorAll('.sig-pakai').forEach(b=>{ b.style.display = ada ? '' : 'none'; });
  const jalur = document.getElementById('ttdTersimpanJalur');
  if(jalur) jalur.style.display = ada ? '' : 'none';
}

async function pakaiTtdTersimpan(padId){
  const data = await dataUrlTtdTersimpan();
  if(!data){ toast(T('ttdTersimpanBelumAda')); return; }
  sigTersimpan[padId] = data;

  const wrap = document.getElementById(padId)?.closest('.sig-wrap');
  if(!wrap) return;
  document.getElementById('lapis_' + padId)?.remove();
  const lapis = document.createElement('div');
  lapis.className = 'sig-tersimpan-lapis';
  lapis.id = 'lapis_' + padId;
  lapis.innerHTML = `<img src="${data}" alt="TTD"><span>${escapeHtml(userSaatIni?.nama || userSaatIni?.username || '')}</span>`;
  wrap.insertBefore(lapis, wrap.firstChild);
  toast(T('ttdTersimpanDipakai'));
}

/* ---------- Pejabat menyetujui dengan TTD tersimpan ---------- */

async function setujuiDenganTtdTersimpan(){
  if(!ttdTarget) return;
  const data = await dataUrlTtdTersimpan();
  if(!data){ toast(T('ttdTersimpanBelumAda')); return; }
  await kirimTtdPejabat(data, 'ttdTersimpanSaveBtn');
}

/* ---------- Jendela "TTD Saya": membuat dan menghapus ---------- */

function openTtdSayaModal(){
  if(!userSaatIni) return;
  // Papannya baru ada saat jendela ini dibuka pertama kali; initAllSigPads
  // sengaja tidak menyertakannya karena kanvas tersembunyi berlebar 0.
  if(!sigPads['sigTtdSaya']) setupSigCanvas('sigTtdSaya');
  clearSig('sigTtdSaya');
  renderTtdSaya();
  document.getElementById('ttdSayaModalBg').classList.add('show');
  setTimeout(()=>resizeSigCanvas('sigTtdSaya'), 60);
}

function closeTtdSayaModal(){
  document.getElementById('ttdSayaModalBg').classList.remove('show');
}

function renderTtdSaya(){
  const wrap = document.getElementById('ttdSayaPratinjau');
  if(wrap){
    wrap.innerHTML = ttdTersimpanSaya
      ? `<div class="sig-thumb"><img src="${ttdTersimpanSaya}" alt="TTD tersimpan"></div>`
      : `<span class="sig-empty-thumb">${T('ttdTersimpanKosong')}</span>`;
  }
  const hapus = document.getElementById('ttdSayaHapusBtn');
  if(hapus) hapus.style.display = ttdTersimpanSaya ? '' : 'none';
}

async function simpanTtdSaya(){
  const data = getSigDataUrl('sigTtdSaya');
  if(!data){ toast(T('ttdKosong')); return; }
  const btn = document.getElementById('ttdSayaSaveBtn');
  if(btn) btn.disabled = true;
  try{
    // Menyimpan yang baru menggantikan yang lama — satu akun satu tanda tangan,
    // jadi tidak ada daftar yang perlu dipilih tiap kali memakainya.
    setTtdTersimpanSaya(await gsRun('simpanTtdSaya', data));
    clearSig('sigTtdSaya');
    renderTtdSaya();
    toast(T('ttdTersimpanDisimpan'));
  }catch(e){
    toast(e.message || T('ttdTersimpanGagal'));
  }
  if(btn) btn.disabled = false;
}

async function hapusTtdSaya(){
  if(!ttdTersimpanSaya) return;
  if(!confirm(T('ttdTersimpanHapusTanya'))) return;
  const btn = document.getElementById('ttdSayaHapusBtn');
  if(btn) btn.disabled = true;
  try{
    await gsRun('hapusTtdSaya');
    setTtdTersimpanSaya('');
    renderTtdSaya();
    toast(T('ttdTersimpanDihapus'));
  }catch(e){
    toast(e.message || T('ttdTersimpanGagal'));
  }
  if(btn) btn.disabled = false;
}
