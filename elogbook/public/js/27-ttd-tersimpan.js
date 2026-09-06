/* E-Logbook · js/27-ttd-tersimpan.js — Tanda tangan tersimpan milik tiap akun
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh.

   Tiap orang menggambar tanda tangannya sendiri lewat jendela "TTD Saya",
   lalu memakainya ulang di formulir mana pun tanpa menggambar lagi. Dua tempat
   memakainya:

   1. PAPAN TANDA TANGAN DI FORMULIR. Tombol "pakai TTD tersimpan" di tiap papan
      menutupi kanvasnya dengan tanda tangan yang sudah ada. "Bersihkan"
      mengembalikannya jadi papan kosong seperti semula.

   2. PEJABAT MENYETUJUI. Di jendela pembubuhan TTD susulan, satu tombol
      memungut tanda tangan tersimpan itu lalu langsung mengirimkannya — tanpa
      menggambar ulang tiap kali menyetujui catatan.

   MULTI-SLOT UNTUK ADMIN DAN PEJABAT
   Admin dan pejabat boleh menyimpan sampai lima TTD sekaligus. Salah satu slot
   ditandai "aktif" dan itulah yang selalu dibubuhkan sampai pemiliknya memilih
   slot lain — sehingga rekap-rekap yang sudah tertanda tetap konsisten. Teknisi
   tetap satu slot; UI-nya kelihatan sama seperti sebelum ini.

   YANG DIKIRIM KE SERVER SELALU GAMBARNYA, BUKAN PATH BERKAS MILIK AKUN.
   Menghapus catatan ikut menghapus berkas tanda tangannya (removeSignatureFile
   di db.js), jadi kalau catatan memakai path yang sama dengan milik akun, satu
   penghapusan melenyapkan tanda tangan orang itu dari seluruh catatan lain
   sekaligus. Tiap catatan harus memegang salinannya sendiri. */

/** Struktur lengkap yang dipegang server: daftar slot, indeks aktif, dan batas
    maksimalnya. Awalnya diisi bentuk minimal supaya kode di bawah aman dipanggil
    sebelum init() menjawab. */
let ttdTersimpanInfo = { slots: [{ path: '', dibuatPada: '' }], aktif: 0, maks: 1 };

/** Path /uploads/... slot AKTIF. Nilai cermin dari ttdTersimpanInfo — dijaga
    supaya kode lama yang membaca variabel ini tidak perlu ikut diubah. */
let ttdTersimpanSaya = '';
/** Salinan dataURL slot aktif. Dibaca sekali; diinvalidasi saat slot berubah. */
let ttdTersimpanData = '';

/** Slot mana yang jadi target Simpan berikutnya. Dipilih ulang lewat tombol
    "Isi/Ganti" di daftar; tidak ditulis ke server sampai pengguna menekan
    Simpan. Untuk teknisi selalu 0. */
let ttdSlotAkanDiisi = 0;

/** Dipanggil init() begitu getAllData menjawab, dan tiap kali server membalas
    dengan struktur terbaru (setelah simpan/hapus/pilih). */
function setTtdTersimpan(info){
  const maks = Math.max(1, Number(info?.maks) || 1);
  const sumber = Array.isArray(info?.slots) ? info.slots : [];
  const slots = [];
  for(let i=0; i<maks; i++){
    const s = sumber[i];
    slots.push({ path: String(s?.path || ''), dibuatPada: String(s?.dibuatPada || '') });
  }
  const aktif = Math.max(0, Math.min(maks - 1, Number(info?.aktif) || 0));
  ttdTersimpanInfo = { slots, aktif, maks };
  ttdTersimpanSaya = String(slots[aktif]?.path || '');
  ttdTersimpanData = '';
  if(ttdSlotAkanDiisi >= maks) ttdSlotAkanDiisi = 0;
  perbaruiTampilanTtdTersimpan();
  renderTtdSaya();
}

/** Kompatibilitas: kode lama memanggil setTtdTersimpanSaya(path). Sekarang path
    itu diperlakukan sebagai satu slot aktif tunggal. */
function setTtdTersimpanSaya(path){
  setTtdTersimpan({ slots: [{ path: String(path || ''), dibuatPada: '' }], aktif: 0, maks: 1 });
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

/** Selama slot aktifnya kosong, tombolnya tidak ada gunanya — sembunyikan. */
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

/* ---------- Jendela "TTD Saya": daftar slot dan pengelolaannya ---------- */

function openTtdSayaModal(){
  if(!userSaatIni) return;
  // Papannya baru ada saat jendela ini dibuka pertama kali; initAllSigPads
  // sengaja tidak menyertakannya karena kanvas tersembunyi berlebar 0.
  if(!sigPads['sigTtdSaya']) setupSigCanvas('sigTtdSaya');
  clearSig('sigTtdSaya');
  // Target awal saat modal dibuka: slot pertama yang masih kosong (kalau ada),
  // supaya "Simpan TTD" langsung mengisi tempat kosong, bukan menimpa yang ada.
  const idxKosong = ttdTersimpanInfo.slots.findIndex(s=>!s.path);
  ttdSlotAkanDiisi = idxKosong >= 0 ? idxKosong : ttdTersimpanInfo.aktif;
  renderTtdSaya();
  document.getElementById('ttdSayaModalBg').classList.add('show');
  setTimeout(()=>resizeSigCanvas('sigTtdSaya'), 60);
  // Segarkan panel Notifikasi Telegram (js/28-telegram.js) — menyembunyikan
  // dirinya sendiri kalau server belum menyalakan bot.
  if(typeof muatStatusTelegram === 'function') muatStatusTelegram();
}

function closeTtdSayaModal(){
  document.getElementById('ttdSayaModalBg').classList.remove('show');
}

function labelSlotTtd(i){ return (T('ttdSlot') || 'Slot') + ' ' + (i + 1); }

function tanggalSingkatLokal(iso){
  if(!iso) return '';
  try{
    const d = new Date(iso);
    if(!Number.isFinite(d.getTime())) return '';
    return d.toLocaleDateString(bahasa === 'en' ? 'en-GB' : (bahasa === 'es' ? 'es' : 'id'),
      { day:'2-digit', month:'short', year:'numeric' });
  }catch{ return ''; }
}

function renderTtdSaya(){
  const wrap = document.getElementById('ttdSayaPratinjau');
  if(!wrap) return;
  const { slots, aktif, maks } = ttdTersimpanInfo;
  const kartu = slots.map((s, i)=>{
    const kosong = !s.path;
    const dipakai = !kosong && i === aktif;
    const stempel = s.dibuatPada ? tanggalSingkatLokal(s.dibuatPada) : '';
    const gambar = kosong
      ? `<span class="sig-empty-thumb">${escapeHtml(T('ttdTersimpanKosong'))}</span>`
      : `<div class="sig-thumb"><img src="${s.path}" alt="${escapeHtml(labelSlotTtd(i))}"></div>`;
    // Radio "pakai TTD ini" hanya muncul di akun multi-slot; slot kosong tetap
    // menampilkannya (disabled) supaya kartu-kartunya sejajar.
    const radio = maks > 1 ? `
      <label class="ttd-slot-pilih">
        <input type="radio" name="ttdSlotAktif" ${dipakai ? 'checked' : ''} ${kosong ? 'disabled' : ''}
          onchange="pilihSlotTtdAktif(${i})">
        <span>${dipakai ? escapeHtml(T('ttdSlotDipilih') || 'Sedang dipakai') : escapeHtml(T('ttdSlotPilih') || 'Pakai TTD ini')}</span>
      </label>` : '';
    const targetKini = ttdSlotAkanDiisi === i ? ' aktif' : '';
    const tblIsi = `<button type="button" class="btn ghost btn-mini" onclick="pilihSlotUntukDiisi(${i})">${escapeHtml(kosong ? (T('ttdSlotIsi') || 'Isi') : (T('ttdSlotGanti') || 'Ganti'))}</button>`;
    const tblHapus = kosong ? '' : `<button type="button" class="btn ghost btn-mini btn-hapus-akun" onclick="hapusSlotTtd(${i})">${escapeHtml(T('ttdSlotHapus') || 'Hapus')}</button>`;
    return `
      <div class="ttd-slot-kartu${dipakai ? ' dipakai' : ''}${targetKini}">
        <div class="ttd-slot-kepala">
          <b>${escapeHtml(labelSlotTtd(i))}</b>
          ${stempel ? `<span class="ttd-slot-stempel">${escapeHtml(stempel)}</span>` : ''}
        </div>
        <div class="ttd-slot-gambar">${gambar}</div>
        ${radio}
        <div class="ttd-slot-tombol">${tblIsi}${tblHapus}</div>
      </div>`;
  }).join('');
  wrap.innerHTML = kartu;

  // Petunjuk di atas kanvas menyebutkan slot mana yang sedang diisi. Untuk
  // akun satu slot, petunjuknya tidak menambah pengetahuan siapa pun — sembunyikan.
  const petunjuk = document.getElementById('ttdSlotTarget');
  if(petunjuk){
    if(maks > 1){
      const teks = (T('ttdSlotSedangMengisi') || 'Sedang mengisi Slot {n}. Tekan Simpan setelah selesai.')
        .replace('{n}', String(ttdSlotAkanDiisi + 1));
      petunjuk.textContent = teks;
      petunjuk.style.display = '';
    } else {
      petunjuk.style.display = 'none';
    }
  }
}

function pilihSlotUntukDiisi(i){
  const maks = ttdTersimpanInfo.maks;
  ttdSlotAkanDiisi = Math.max(0, Math.min(maks - 1, i|0));
  clearSig('sigTtdSaya');
  renderTtdSaya();
  // Gulir ke kanvas supaya orangnya langsung tahu ke mana matanya harus pindah.
  document.getElementById('sigTtdSaya')?.scrollIntoView({ behavior:'smooth', block:'center' });
}

async function pilihSlotTtdAktif(i){
  const maks = ttdTersimpanInfo.maks;
  const idx = Math.max(0, Math.min(maks - 1, i|0));
  // Slot kosong tidak boleh jadi aktif — radio-nya sudah disabled, jaga lagi
  // di sisi klien supaya tidak mengirim permintaan sia-sia.
  if(!ttdTersimpanInfo.slots[idx]?.path){ renderTtdSaya(); return; }
  try{
    const info = await gsRun('pilihTtdSayaAktif', { slotIdx: idx });
    setTtdTersimpan(info);
    toast(T('ttdSlotDipilihToast') || 'Slot aktif diperbarui.');
  }catch(e){
    toast(e.message || T('ttdTersimpanGagal'));
  }
}

async function simpanTtdSaya(){
  const data = getSigDataUrl('sigTtdSaya');
  if(!data){ toast(T('ttdKosong')); return; }
  const btn = document.getElementById('ttdSayaSaveBtn');
  if(btn) btn.disabled = true;
  try{
    const info = await gsRun('simpanTtdSaya', { dataUrl: data, slotIdx: ttdSlotAkanDiisi });
    setTtdTersimpan(info);
    clearSig('sigTtdSaya');
    toast(T('ttdTersimpanDisimpan'));
  }catch(e){
    toast(e.message || T('ttdTersimpanGagal'));
  }
  if(btn) btn.disabled = false;
}

async function hapusSlotTtd(i){
  const maks = ttdTersimpanInfo.maks;
  const idx = Math.max(0, Math.min(maks - 1, i|0));
  const slot = ttdTersimpanInfo.slots[idx];
  if(!slot?.path) return;
  const pesan = maks > 1
    ? (T('ttdSlotHapusTanya') || 'Hapus tanda tangan di Slot {n}?').replace('{n}', String(idx + 1))
    : T('ttdTersimpanHapusTanya');
  if(!confirm(pesan)) return;
  try{
    const info = await gsRun('hapusTtdSaya', { slotIdx: idx });
    setTtdTersimpan(info);
    toast(T('ttdTersimpanDihapus'));
  }catch(e){
    toast(e.message || T('ttdTersimpanGagal'));
  }
}

/** Kompatibilitas dengan pemanggilan lama (tombol "Hapus yang tersimpan" di
    modal satu-slot). Menghapus slot aktif. */
async function hapusTtdSaya(){
  return hapusSlotTtd(ttdTersimpanInfo.aktif);
}
