/* E-Logbook · js/27-ttd-tersimpan.js — Tanda tangan tersimpan milik tiap akun
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh.

   Tiap orang menggambar tanda tangannya sendiri lewat jendela "TTD Saya", lalu
   memakainya ulang di formulir mana pun tanpa menggambar lagi. Dua tempat
   memakainya:

   1. PAPAN TANDA TANGAN DI FORMULIR. Tombol "pakai TTD tersimpan" di tiap
      papan menutupi kanvasnya dengan tanda tangan tersimpan. "Bersihkan"
      mengembalikannya jadi papan kosong seperti semula.

   2. PEJABAT MENYETUJUI. Di jendela pembubuhan TTD susulan, satu tombol
      memungut tanda tangan tersimpan lalu langsung mengirimkannya — tanpa
      menggambar ulang tiap kali menyetujui catatan.

   Teknisi cukup memegang SATU slot: yang disimpan menggantikan yang lama.
   Pejabat/admin boleh memegang beberapa slot bertanda label (mis. "MT asli",
   "PH Bagus") — di dinas Manajer Teknik sering ada PH silih berganti dan tiap
   PH punya tanda tangan sendiri. Batasnya diatur server (7 slot per akun).
   Saat memakai atau menyetujui, kalau slot lebih dari satu, muncul pemilih
   yang menanyakan slot mana yang mau dipakai.

   YANG DIKIRIM KE SERVER SELALU GAMBARNYA, BUKAN PATH BERKAS MILIK AKUN.
   Menghapus catatan ikut menghapus berkas tanda tangannya (removeSignatureFile
   di db.js), jadi kalau catatan memakai path yang sama dengan milik akun, satu
   penghapusan melenyapkan tanda tangan orang itu dari seluruh catatan lain
   sekaligus. Tiap catatan harus memegang salinannya sendiri. */

/** Slot TTD milik akun yang sedang masuk — [{label, path}]. */
let ttdSlotsSaya = [];
/** Cache dataURL per path (path -> dataURL). Berkasnya dibaca sekali, lalu
    diingat selama halaman hidup. Path baru berarti entri baru. */
const ttdSlotDataCache = {};

/** Peran ini boleh memegang lebih dari satu slot TTD. Sinkron dengan
    bolehBanyakSlot di server: pejabat + admin. */
function bolehBanyakSlotTtd(){
  const r = String(userSaatIni?.role || '').toLowerCase();
  return r === 'admin' || r === 'pejabat';
}

/** Dipanggil init() begitu getAllData menjawab, dan tiap kali slot berubah. */
function setTtdSlotsSaya(slots){
  ttdSlotsSaya = Array.isArray(slots)
    ? slots
        .map(s => ({ label: String(s?.label || ''), path: String(s?.path || '') }))
        .filter(s => s.path)
    : [];
  // Cache dataURL yang path-nya sudah tidak ada lagi ikut dibuang, supaya
  // slot berlabel sama tapi berkas berbeda tidak memungut gambar yang lama.
  for(const p of Object.keys(ttdSlotDataCache)){
    if(!ttdSlotsSaya.some(s => s.path === p)) delete ttdSlotDataCache[p];
  }
  perbaruiTampilanTtdTersimpan();
}

/* ---------- Kompatibilitas lama ----------
   Dulu ada satu variabel path tunggal; sebagian modul lain mungkin masih
   membacanya. Petakan ke slot pertama supaya kode lama tetap jalan. */
Object.defineProperty(window, 'ttdTersimpanSaya', {
  get(){ return ttdSlotsSaya[0]?.path || ''; },
  configurable: true
});

/** Berkas PNG milik akun -> dataURL, lewat kanvas. Sama asal (/uploads di
    balik login), jadi kanvasnya tidak tercemar dan boleh dibaca kembali. */
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

async function dataUrlSlot(slot){
  if(!slot || !slot.path) return '';
  if(!ttdSlotDataCache[slot.path]) ttdSlotDataCache[slot.path] = await gambarKeDataUrl(slot.path);
  return ttdSlotDataCache[slot.path];
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

/** Selama belum ada slot tersimpan, tombolnya tidak ada gunanya — sembunyikan,
    jangan biarkan ditekan lalu menjawab "belum ada". */
function perbaruiTampilanTtdTersimpan(){
  const ada = ttdSlotsSaya.length > 0;
  document.querySelectorAll('.sig-pakai').forEach(b=>{ b.style.display = ada ? '' : 'none'; });
  const jalur = document.getElementById('ttdTersimpanJalur');
  if(jalur) jalur.style.display = ada ? '' : 'none';
}

/** Pilih slot yang mau dipakai. Kalau cuma satu, langsung. Kalau lebih, buka
    pemilih — pengguna memilih dan callback dipanggil dengan slot itu. Kalau
    membatalkan, callback tidak dipanggil sama sekali. */
async function pilihSlotTtd(callback){
  if(ttdSlotsSaya.length === 0){ toast(T('ttdTersimpanBelumAda')); return; }
  if(ttdSlotsSaya.length === 1){ await callback(ttdSlotsSaya[0]); return; }
  bukaPickerSlotTtd(callback);
}

/* Papan mana yang sedang dipilih slot-nya — dipakai oleh pemilih supaya bisa
   memanggil pakaiTtdTersimpanKe() dengan padId asalnya. */
let pickerSlotCallback = null;

function bukaPickerSlotTtd(callback){
  pickerSlotCallback = callback;
  const body = document.getElementById('ttdSlotPickerBody');
  if(!body){ pickerSlotCallback = null; return; }
  body.innerHTML = ttdSlotsSaya.map((s, i)=>`
    <button class="btn ghost" style="display:flex;align-items:center;gap:10px;justify-content:flex-start;padding:8px 10px;text-align:left;" onclick="pilihanSlotTtd(${i})">
      <img src="${escapeHtml(s.path)}" alt="" style="width:64px;height:36px;object-fit:contain;background:#fff;border:1px solid var(--line);border-radius:4px;">
      <span style="flex:1;">${escapeHtml(s.label) || `<i style="color:var(--muted);">${T('ttdSlotTanpaLabel')}</i>`}</span>
    </button>`).join('');
  document.getElementById('ttdSlotPickerBg').classList.add('show');
}

function tutupPickerSlotTtd(){
  document.getElementById('ttdSlotPickerBg')?.classList.remove('show');
  pickerSlotCallback = null;
}

async function pilihanSlotTtd(idx){
  const slot = ttdSlotsSaya[idx];
  const cb = pickerSlotCallback;
  tutupPickerSlotTtd();
  if(slot && cb){
    // Slot yang dipilih dipindah ke depan sebagai default berikutnya.
    ttdSlotsSaya = [slot, ...ttdSlotsSaya.filter((_, i) => i !== idx)];
    await cb(slot);
  }
}

async function pakaiTtdTersimpan(padId){
  await pilihSlotTtd(async (slot)=>{
    const data = await dataUrlSlot(slot);
    if(!data){ toast(T('ttdTersimpanBelumAda')); return; }
    sigTersimpan[padId] = data;

    const wrap = document.getElementById(padId)?.closest('.sig-wrap');
    if(!wrap) return;
    document.getElementById('lapis_' + padId)?.remove();
    const lapis = document.createElement('div');
    lapis.className = 'sig-tersimpan-lapis';
    lapis.id = 'lapis_' + padId;
    const namaAkun = userSaatIni?.nama || userSaatIni?.username || '';
    const capNama = slot.label ? `${namaAkun} · ${slot.label}` : namaAkun;
    lapis.innerHTML = `<img src="${data}" alt="TTD"><span>${escapeHtml(capNama)}</span>`;
    wrap.insertBefore(lapis, wrap.firstChild);
    toast(T('ttdTersimpanDipakai'));
  });
}

/* ---------- Pejabat menyetujui dengan TTD tersimpan ---------- */

async function setujuiDenganTtdTersimpan(){
  if(!ttdTarget) return;
  await pilihSlotTtd(async (slot)=>{
    const data = await dataUrlSlot(slot);
    if(!data){ toast(T('ttdTersimpanBelumAda')); return; }
    await kirimTtdPejabat(data, 'ttdTersimpanSaveBtn');
  });
}

/* ---------- Jendela "TTD Saya": membuat dan menghapus ---------- */

function openTtdSayaModal(){
  if(!userSaatIni) return;
  // Papannya baru ada saat jendela ini dibuka pertama kali; initAllSigPads
  // sengaja tidak menyertakannya karena kanvas tersembunyi berlebar 0.
  if(!sigPads['sigTtdSaya']) setupSigCanvas('sigTtdSaya');
  clearSig('sigTtdSaya');
  const labelInput = document.getElementById('ttdSayaLabelInput');
  if(labelInput) labelInput.value = '';
  renderTtdSaya();
  document.getElementById('ttdSayaModalBg').classList.add('show');
  setTimeout(()=>resizeSigCanvas('sigTtdSaya'), 60);
}

function closeTtdSayaModal(){
  document.getElementById('ttdSayaModalBg').classList.remove('show');
}

function renderTtdSaya(){
  const banyak = bolehBanyakSlotTtd();
  const slotWrap    = document.getElementById('ttdSayaSlotList');
  const pratinjau   = document.getElementById('ttdSayaPratinjauWrap');
  const labelWrap   = document.getElementById('ttdSayaLabelWrap');
  const gambarLabel = document.getElementById('ttdSayaGambarLabel');
  const hapusBtn    = document.getElementById('ttdSayaHapusBtn');
  const simpanBtn   = document.getElementById('ttdSayaSaveBtn');
  const catatan     = document.getElementById('ttdSayaCatatan');

  if(banyak){
    // Daftar slot + form tambah. Simpan berarti "tambah slot ini".
    if(pratinjau) pratinjau.style.display = 'none';
    if(labelWrap) labelWrap.style.display = '';
    if(hapusBtn)  hapusBtn.style.display = 'none';
    if(simpanBtn){ simpanBtn.dataset.t = 'ttdSayaTambahSlot'; simpanBtn.textContent = T('ttdSayaTambahSlot'); }
    if(gambarLabel){ gambarLabel.dataset.t = 'ttdSayaGambarSlotBaru'; gambarLabel.textContent = T('ttdSayaGambarSlotBaru'); }
    if(catatan){ catatan.dataset.t = 'ttdSayaCatatanBanyak'; catatan.textContent = T('ttdSayaCatatanBanyak'); }

    if(slotWrap){
      slotWrap.style.display = '';
      if(ttdSlotsSaya.length === 0){
        slotWrap.innerHTML = `<div class="empty" style="margin-bottom:10px;">${T('ttdSlotKosong')}</div>`;
      }else{
        slotWrap.innerHTML = `
          <label style="display:block;font-size:11px;color:var(--muted);margin-bottom:6px;">${T('ttdSlotTersimpan')} (${ttdSlotsSaya.length}/${T('ttdSlotBatas')})</label>
          <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px;">
            ${ttdSlotsSaya.map((s, i)=>`
              <div style="display:flex;align-items:center;gap:10px;padding:6px 8px;border:1px solid var(--line);border-radius:6px;background:var(--panel-2);">
                <img src="${escapeHtml(s.path)}" alt="" style="width:56px;height:32px;object-fit:contain;background:#fff;border:1px solid var(--line);border-radius:4px;">
                <span style="flex:1;font-size:13px;">${escapeHtml(s.label) || `<i style="color:var(--muted);">${T('ttdSlotTanpaLabel')}</i>`}</span>
                <button class="btn ghost btn-hapus-akun" style="padding:4px 10px;font-size:11px;" onclick="hapusSlotTtd(${i})">${T('ttdSayaHapus')}</button>
              </div>`).join('')}
          </div>`;
      }
    }
  }else{
    // Mode teknisi: satu slot, seperti sebelum fitur multi-slot.
    if(slotWrap){ slotWrap.style.display = 'none'; slotWrap.innerHTML = ''; }
    if(pratinjau) pratinjau.style.display = '';
    if(labelWrap) labelWrap.style.display = 'none';
    if(simpanBtn){ simpanBtn.dataset.t = 'ttdSayaSimpan'; simpanBtn.textContent = T('ttdSayaSimpan'); }
    if(gambarLabel){ gambarLabel.dataset.t = 'ttdSayaGambarBaru'; gambarLabel.textContent = T('ttdSayaGambarBaru'); }
    if(catatan){ catatan.dataset.t = 'ttdSayaCatatan'; catatan.textContent = T('ttdSayaCatatan'); }

    const wrap = document.getElementById('ttdSayaPratinjau');
    const path = ttdSlotsSaya[0]?.path || '';
    if(wrap){
      wrap.innerHTML = path
        ? `<div class="sig-thumb"><img src="${escapeHtml(path)}" alt="TTD tersimpan"></div>`
        : `<span class="sig-empty-thumb">${T('ttdTersimpanKosong')}</span>`;
    }
    if(hapusBtn) hapusBtn.style.display = path ? '' : 'none';
  }
}

async function simpanTtdSaya(){
  const data = getSigDataUrl('sigTtdSaya');
  if(!data){ toast(T('ttdKosong')); return; }
  const banyak = bolehBanyakSlotTtd();
  let label = '';
  if(banyak){
    label = String(document.getElementById('ttdSayaLabelInput')?.value || '').trim();
    if(!label){ toast(T('ttdSayaLabelWajib')); return; }
  }
  const btn = document.getElementById('ttdSayaSaveBtn');
  if(btn) btn.disabled = true;
  try{
    setTtdSlotsSaya(await gsRun('simpanTtdSaya', data, label));
    clearSig('sigTtdSaya');
    const labelInput = document.getElementById('ttdSayaLabelInput');
    if(labelInput) labelInput.value = '';
    renderTtdSaya();
    toast(T(banyak ? 'ttdSlotDitambahkan' : 'ttdTersimpanDisimpan'));
  }catch(e){
    toast(e.message || T('ttdTersimpanGagal'));
  }
  if(btn) btn.disabled = false;
}

async function hapusTtdSaya(){
  // Dipanggil dari tombol footer — mode teknisi (satu slot). Untuk pejabat,
  // hapus per-slot lewat hapusSlotTtd().
  if(!ttdSlotsSaya.length) return;
  if(!confirm(T('ttdTersimpanHapusTanya'))) return;
  const btn = document.getElementById('ttdSayaHapusBtn');
  if(btn) btn.disabled = true;
  try{
    // Pass null eksplisit — supaya server tidak salah tafsir args kosong sebagai
    // parameter `user` (satu-satunya arg yang dijamin ada di sisi server).
    setTtdSlotsSaya(await gsRun('hapusTtdSaya', null));
    renderTtdSaya();
    toast(T('ttdTersimpanDihapus'));
  }catch(e){
    toast(e.message || T('ttdTersimpanGagal'));
  }
  if(btn) btn.disabled = false;
}

async function hapusSlotTtd(idx){
  const slot = ttdSlotsSaya[idx];
  if(!slot) return;
  const nama = slot.label || T('ttdSlotTanpaLabel');
  if(!confirm(T('ttdSlotHapusTanya').replace('{label}', nama))) return;
  try{
    setTtdSlotsSaya(await gsRun('hapusTtdSaya', slot.label));
    renderTtdSaya();
    toast(T('ttdSlotDihapus'));
  }catch(e){
    toast(e.message || T('ttdTersimpanGagal'));
  }
}
