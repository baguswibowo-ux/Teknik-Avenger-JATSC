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
  // Panel PH (js/28b-ph.js) — menyembunyikan dirinya untuk selain pejabat/admin.
  if(typeof muatPh === 'function') muatPh();
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

/* ---------- Tanda tangan dari berkas gambar (pilih berkas / tempel) ----------
   Banyak orang sudah punya gambar tanda tangannya — yang biasa ditempel ke Word
   atau Excel. Gambar itu boleh dipakai di jendela "TTD Saya" sebagai ganti
   menggambar: lewat tombol "pilih berkas gambar", atau disalin lalu ditempel
   (Ctrl+V) selagi jendelanya terbuka.

   Gambarnya TIDAK disimpan apa adanya. Seluruh aplikasi menganggap tanda tangan
   itu goresan PUTIH di atas latar TEMBUS PANDANG (papan gelap di layar; modul
   cetak yang membaliknya jadi tinta hitam), sedangkan berkas orang hampir
   selalu tinta gelap di atas kertas putih. Jadi tiap titik diubah: makin gelap
   titiknya, makin pekat putihnya; latar kertasnya jadi tembus pandang. Hasilnya
   dituang ke kanvas papan, sehingga Simpan, slot, dan pemakaiannya di formulir
   berjalan persis seperti tanda tangan yang digambar. */

/** Sisi terpanjang gambar yang diolah — cukup tajam untuk cetak, dan foto HP
    belasan megapiksel tidak membuat peramban tersendat. */
const TTD_TEMPEL_SISI_MAKS = 1400;

function muatGambarBerkas(berkas){
  return new Promise((resolve)=>{
    const url = URL.createObjectURL(berkas);
    const img = new Image();
    img.onload = ()=>{ URL.revokeObjectURL(url); resolve(img); };
    img.onerror = ()=>{ URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

/** Gambar -> kanvas berisi goresan putih di atas latar tembus pandang, sudah
    dipangkas ke tepi goresannya. null kalau tidak ada goresan yang terbaca. */
function gambarJadiGoresanTtd(img){
  const skala = Math.min(1, TTD_TEMPEL_SISI_MAKS / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * skala));
  const h = Math.max(1, Math.round(img.naturalHeight * skala));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently:true });
  ctx.drawImage(img, 0, 0, w, h);
  const asli = ctx.getImageData(0, 0, w, h);
  const px = asli.data;
  const n = w * h;

  // Kecerahan tiap titik seandainya gambarnya diletakkan di atas kertas putih
  // (PNG berlatar tembus pandang ikut terbaca benar), plus sebarannya.
  const terang = new Uint8Array(n);
  const sebaran = new Uint32Array(256);
  let tembus = 0;
  for(let i = 0; i < n; i++){
    const a = px[i * 4 + 3] / 255;
    if(a < 0.5) tembus++;
    const l = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
    const v = Math.round(l * a + 255 * (1 - a));
    terang[i] = v; sebaran[v]++;
  }
  const persentil = (p)=>{ let jml = 0; const batas = n * p; for(let v = 0; v < 256; v++){ jml += sebaran[v]; if(jml >= batas) return v; } return 255; };
  // Latar = kecerahan yang dimiliki kebanyakan titik; tinta = yang tergelap.
  // Persentil tintanya kecil sekali: tanda tangan tipis di tengah pindaian
  // selembar penuh bisa cuma sepersekian persen dari seluruh titik.
  const latar = persentil(0.85), tinta = persentil(0.0005);

  const pekat = new Uint8ClampedArray(n);
  if(latar - tinta >= 40){
    // Sepertiga rentang teratas dianggap latar (bayangan kertas, bintik JPG).
    const atas = latar - (latar - tinta) * 0.33, rentang = Math.max(1, atas - tinta);
    for(let i = 0; i < n; i++) pekat[i] = Math.max(0, Math.min(1, (atas - terang[i]) / rentang)) * 255;
  }else if(tembus > n * 0.3){
    // Tinta terang di atas latar tembus pandang (mis. PNG keluaran aplikasi
    // ini sendiri): bentuknya ada di kanal alfa, bukan di warnanya.
    for(let i = 0; i < n; i++) pekat[i] = px[i * 4 + 3];
  }else{
    return null;
  }

  // Pangkas ke tepi goresan, supaya tanda tangannya memenuhi papan dan tidak
  // tenggelam di tengah halaman kosong hasil pindaian.
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for(let y = 0; y < h; y++){
    for(let x = 0; x < w; x++){
      if(pekat[y * w + x] > 90){
        if(x < x0) x0 = x; if(x > x1) x1 = x;
        if(y < y0) y0 = y; if(y > y1) y1 = y;
      }
    }
  }
  if(x1 < x0 || y1 < y0) return null;
  // Goresan yang nyaris memenuhi seluruh gambar berarti latarnya ikut terbaca
  // sebagai tinta (foto gelap, gambar bukan tanda tangan) — tolak saja.
  let isi = 0;
  for(let i = 0; i < n; i++) if(pekat[i] > 90) isi++;
  if(isi > n * 0.6) return null;

  for(let i = 0; i < n; i++){
    px[i * 4] = 255; px[i * 4 + 1] = 255; px[i * 4 + 2] = 255; px[i * 4 + 3] = pekat[i];
  }
  ctx.putImageData(asli, 0, 0);
  const lw = x1 - x0 + 1, lh = y1 - y0 + 1;
  const hasil = document.createElement('canvas');
  hasil.width = lw; hasil.height = lh;
  hasil.getContext('2d').drawImage(c, x0, y0, lw, lh, 0, 0, lw, lh);
  return hasil;
}

/** Tuang berkas gambar ke papan "TTD Saya". Dipanggil pemilih berkas dan
    penangan tempel di bawah. */
async function tempelGambarTtd(berkas){
  if(!berkas) return;
  if(!/^image\//.test(berkas.type || '')){ toast(T('ttdTempelBukanGambar')); return; }
  const img = await muatGambarBerkas(berkas);
  if(!img || !img.naturalWidth){ toast(T('ttdTempelBukanGambar')); return; }
  const goresan = gambarJadiGoresanTtd(img);
  if(!goresan){ toast(T('ttdTempelKosong')); return; }

  const id = 'sigTtdSaya';
  if(!sigPads[id]) setupSigCanvas(id);
  clearSig(id);
  const s = sigPads[id];
  if(!s) return;
  const kotak = s.canvas.getBoundingClientRect();
  if(!kotak.width || !kotak.height) return;
  // Muat utuh di dalam papan dengan sedikit jarak tepi; tidak diperbesar
  // melebihi papan, tidak digepengkan.
  const tepi = 10;
  const k = Math.min((kotak.width - tepi * 2) / goresan.width, (kotak.height - tepi * 2) / goresan.height);
  const gw = goresan.width * k, gh = goresan.height * k;
  s.ctx.imageSmoothingQuality = 'high';
  s.ctx.drawImage(goresan, (kotak.width - gw) / 2, (kotak.height - gh) / 2, gw, gh);
  s.empty = false;
  toast(T('ttdTempelOk'));
}

/* Tempel (Ctrl+V) selagi jendela "TTD Saya" terbuka. Hanya gambar yang
   ditangkap — menempel teks ke kotak isian di jendela itu (panel PH) tetap
   berjalan seperti biasa. */
document.addEventListener('paste', (e)=>{
  if(!document.getElementById('ttdSayaModalBg')?.classList.contains('show')) return;
  const butir = [...(e.clipboardData?.items || [])].find(b=>b.kind === 'file' && /^image\//.test(b.type));
  const berkas = butir && butir.getAsFile();
  if(!berkas) return;
  e.preventDefault();
  tempelGambarTtd(berkas);
});
