/* E-Logbook · js/14-daily-check-umum.js — Daftar teknisi, pemilihan bentuk per unit, simpan, riwayat, detail
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh. */

/* ---------- Daftar nama teknisi dinamis (TTD cukup satu, di bawah) ---------- */
let teknisiRows = [];   // [{key, nama}]
let teknisiSeq = 0;

function renderTeknisiList(){
  const wrap = document.getElementById('teknisiList');
  wrap.innerHTML = teknisiRows.map((t, i)=>`
    <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;">
      <span style="font-family:var(--font-mono);color:var(--accent);font-size:12px;min-width:18px;">${i+1}.</span>
      <input type="text" value="${escapeHtml(t.nama)}" placeholder="Nama teknisi ${i+1}"
             list="teknisiDatalist"
             oninput="teknisiRows[${i}].nama=this.value" style="flex:1;background:var(--panel-2);border:1px solid var(--line);color:var(--text);border-radius:6px;padding:9px 10px;font-size:16px;">
      ${teknisiRows.length>1 ? `<button class="icon-btn" title="Hapus" onclick="removeTeknisi('${t.key}')">✕</button>` : ''}
    </div>`).join('');
}
function addTeknisi(){
  // Baris pertama pra-isi dengan yang sedang login — dialah teknisi yang lagi
  // berdinas dan yang mengisi. Baris berikutnya kosong; kalau salah orang atau
  // admin yang mengisi atas nama, tinggal diganti.
  const isiAwal = teknisiRows.length === 0 && userSaatIni ? (userSaatIni.nama || userSaatIni.username || '') : '';
  teknisiRows.push({key:'k'+(teknisiSeq++), nama: isiAwal});
  renderTeknisiList();
}
function removeTeknisi(key){
  teknisiRows = teknisiRows.filter(x=>x.key!==key);
  renderTeknisiList();
}
function collectTeknisiNama(){
  return teknisiRows.map(t=>(t.nama||'').trim()).filter(Boolean);
}

/** Unit yang sedang dibuka memakai formulir daily check yang mana. */
const dcRadkomAktif = () => unitAktif === 'radkom';

/** Suhu MER hanya diukur di form Garex — Radtel di gedung MER. Unit yang punya
    form daily check-nya sendiri tidak mengenal kolom itu: saveDailyCheck memang
    menyimpannya kosong dan 07-unit.js menyembunyikan isiannya, tapi riwayat &
    detailnya dulu tetap menulis "Suhu MER -" untuk semua unit — terbaca seolah
    ada pengukuran yang lupa diisi. Daftarnya kembar dengan yang menyembunyikan
    #dcSuhuWrap di 07-unit.js; kalau nambah unit ber-form sendiri, tambah di
    kedua tempat. */
const UNIT_TANPA_SUHU_MER = ['radkom', 'ppabn', 'pengamatan', 'gedungkeamanan', 'amhsadps', 'listrikmekanik'];
const unitPakaiSuhuMer = () => !UNIT_TANPA_SUHU_MER.includes(unitAktif);

function resetDcForm(){
  initDcState(); renderDcTable();
  initDcRkState(); renderDcRkTable();
  initDcJState(); renderDcJatscTable();
  initDcNState(); renderDcNavTable();
  if(typeof initDcPgmState === 'function'){ initDcPgmState(); renderDcPgmTable(); }
  if(typeof initDcFgkState === 'function'){ initDcFgkState(); renderDcFgkTable(); }
  if(typeof initDcLkState === 'function'){ initDcLkState(); renderDcLkTable(); }
  document.getElementById('dcSuhu').value=''; document.getElementById('dcRemark').value='';
  document.getElementById('dcManagerNama').value='';
  document.getElementById('dcManagerAkun').value='';
  ['sigDcTeknisi'].forEach(id=>{ if(sigPads[id]) clearSig(id); });
  teknisiRows = []; teknisiSeq = 0;
  addTeknisi();  // mulai dengan 1 baris nama
}

/* ---------- Modal form daily check ----------
   Form daily check dibuka lewat "+ Form Baru" sebagai modal — riwayat tampil
   lebih dulu, pola sama dengan DS Test/Berkala. Semua id di dalam form tak
   berubah; hanya wadahnya jadi modal, jadi 07-unit.js & fungsi simpan/detail
   membacanya seperti semula. Unit AMHS & officer tidak memakai modal ini
   (07-unit.js menyembunyikan tombolnya) — AMHS punya form inline sendiri. */
function openDcFormModal(){
  // Unit AMHS punya form inline sendiri (#dcAmhsWrap), bukan modal Garex —
  // "+ Form Baru" cukup menampakkannya (juga riwayat-dulu, seperti unit lain).
  if(typeof dcAmhsAktif === 'function' && dcAmhsAktif()){ bukaFormAmhs(); return; }
  // "+ Form Baru" selalu entri baru: kalau tadinya sedang menyunting, keluar
  // dari mode itu dulu (batalEditDc me-reset form), kalau tidak reset biasa.
  if(dcEditingId) batalEditDc();
  else resetDcForm();
  setDcTanggal();
  const bg = document.getElementById('dcFormModalBg');
  if(bg) bg.classList.add('show');
  // Kanvas TTD berlebar 0 selama modal tersembunyi — ukur ulang setelah tampil.
  setTimeout(()=>{ if(typeof resizeAllVisibleSigPads === 'function') resizeAllVisibleSigPads(); }, 60);
}
function closeDcFormModal(){
  const bg = document.getElementById('dcFormModalBg');
  if(bg) bg.classList.remove('show');
}

/* ---------- AMHS: form inline yang ikut pola "riwayat-dulu, form saat diklik" ----------
   Form AMHS terlalu besar untuk modal — dibiarkan inline (#dcAmhsWrap) tapi
   disembunyikan sampai "+ Form Baru" ditekan. Sebuah bilah "Tutup" disisipkan
   di atasnya untuk kembali ke daftar riwayat. Alur Riwayat→Edit AMHS juga
   memanggil bukaFormAmhs() supaya form-nya muncul saat menyunting. */
function pasangTombolTutupAmhs(){
  const wrap = document.getElementById('dcAmhsWrap');
  if(!wrap || document.getElementById('amhsTutupBar')) return;
  const bar = document.createElement('div');
  bar.id = 'amhsTutupBar';
  bar.style.cssText = 'display:flex;justify-content:flex-end;margin-bottom:10px;';
  bar.innerHTML = '<button class="btn ghost" onclick="tutupFormAmhs()">✕ Tutup — kembali ke riwayat</button>';
  wrap.insertBefore(bar, wrap.firstChild);
}
function bukaFormAmhs(){
  const wrap = document.getElementById('dcAmhsWrap');
  if(!wrap) return;
  wrap.style.display = '';
  pasangTombolTutupAmhs();
  if(typeof resizeAllVisibleSigPads === 'function') setTimeout(resizeAllVisibleSigPads, 60);
  wrap.scrollIntoView({ behavior:'smooth', block:'start' });
}
function tutupFormAmhs(){
  const wrap = document.getElementById('dcAmhsWrap');
  if(wrap) wrap.style.display = 'none';
  const rw = document.getElementById('dcRiwayatWrap');
  if(rw) rw.scrollIntoView({ behavior:'smooth', block:'start' });
}

/** Dipanggil oleh selector Lokasi. Kalau bentuk formnya berubah, layar bagian
    checklist ikut ganti — dan judul di kepala tab, karena judul menyebut nama
    peralatan spesifiknya (Garex vs Frequentis). Yang sudah diklik di form
    sebelumnya tetap tinggal di state — pindah lokasi bukan reset. */
function perbaruiLokasiDc(){
  // terapkanUnit() membaca ulang layar unit dari unitAktif — di dalamnya
  // dcLokasi ikut dibaca dan Wrap/judulnya menyesuaikan.
  if(typeof terapkanUnit === 'function') terapkanUnit();
  else{
    const jatsc = document.getElementById('dcLokasi')?.value === 'jatsc';
    document.getElementById('dcGarexWrap').style.display = jatsc ? 'none' : '';
    document.getElementById('dcJatscWrap').style.display = jatsc ? '' : 'none';
    if(jatsc && Object.keys(dcJState || {}).length === 0){ initDcJState(); renderDcJatscTable(); }
  }
  sinkronSubtabDc();
}

/** Sub-tab lokasi (di index.html #dcSubtabs) menggantikan dropdown Nama
    Peralatan + Lokasi yang dulu. Keduanya sekarang paten mengikuti sub-tab —
    dcLokasi menentukan bentuk form, dcTempat sekadar label kertas yang selalu
    ikut. Kedua elemen disembunyikan tapi tetap ditulis di sini karena masih
    dibaca sebagai sumber kebenaran oleh saveDailyCheck, openDcDetail, dan
    07-unit.js. */
function setDcLokasi(nilai){
  const el = document.getElementById('dcLokasi');
  const tempat = document.getElementById('dcTempat');
  if(tempat) tempat.value = nilai;
  if(!el) return;
  if(el.value === nilai){ sinkronSubtabDc(); return; }
  el.value = nilai;
  perbaruiLokasiDc();
}

/** Sorot sub-tab yang cocok dengan nilai dcLokasi. Dipanggil setiap kali
    lokasi berubah, dan juga oleh terapkanUnit() supaya pemuatan detail
    catatan (yang menulis dcLokasi.value langsung) ikut menyorot sub-tab. */
function sinkronSubtabDc(){
  const nilai = document.getElementById('dcLokasi')?.value || 'new-jatsc';
  // Kalau detail catatan lama yang dimuat, dcTempat sering diset terpisah
  // oleh openDcDetail — di sini ia disamakan lagi supaya tidak beda-beda.
  const tempat = document.getElementById('dcTempat');
  if(tempat) tempat.value = nilai;
  const cocok = nilai === 'jatsc' ? 'dc-jatsc' : 'dc-newjatsc';
  document.querySelectorAll('#dcSubtabs .subtab-btn').forEach(b=>{
    b.classList.toggle('active', b.dataset.subtab === cocok);
  });
  // Info peralatan + lokasi di bawah sub-tab. Sub-tab hanya menampilkan
  // "New JATSC / JATSC"; nama peralatan spesifiknya (Garex vs Frequentis)
  // dipisah ke sini supaya tetap terlihat di layar dan tercetak dari kepala
  // form. Info bar hanya muncul kalau sub-tab lokasi memang dipakai unit ini
  // (Radtel) — 07-unit.js yang menentukan visibilitas #dcSubtabs.
  const bar = document.getElementById('dcInfoLokasi');
  const pAlat = document.getElementById('dcInfoPeralatan');
  const pTempat = document.getElementById('dcInfoTempat');
  const subtabs = document.getElementById('dcSubtabs');
  const punyaSubtab = subtabs && subtabs.style.display !== 'none';
  if(bar) bar.style.display = punyaSubtab ? '' : 'none';
  if(pAlat)   pAlat.textContent   = (nilai === 'jatsc') ? 'VCS Frequentis 3020X' : 'VCS Garex 300';
  if(pTempat) pTempat.textContent = (nilai === 'jatsc') ? 'JATSC' : 'New JATSC';
}
/* ---------- Hari / Tanggal daily check ----------
   Isian ini bisa dipilih sendiri: checklist dinas malam sering baru sempat
   diketik pagi harinya, dan hari yang terlewat perlu bisa disusulkan. Bawaannya
   tetap hari ini menurut jam server.

   Yang DISIMPAN tetap teks panjang "JUMAT / 7 AGU 2026", sama seperti sebelum
   isian ini bisa diubah — supaya catatan lama dan baru sebentuk, dan nama
   harinya ikut tercetak di formulir seperti yang diminta lembar bakunya.
   Isian <input type="date"> sendiri memakai YYYY-MM-DD, dan nilai itu ikut
   dikirim terpisah sebagai tanggalIso — dipakai server untuk mengurutkan
   riwayat, karena teks panjang di atas tidak bisa diurutkan langsung. */

/** Tanggal yang sedang dipilih, dalam bentuk yang disimpan ke server. */
function tanggalDcTersimpan(){
  const v = document.getElementById('dcTanggal').value;
  if(!v) return '';
  // Ditafsirkan sebagai UTC, sama seperti seluruh waktu di aplikasi ini.
  return tanggalPanjang(new Date(v + 'T00:00:00Z'));
}

/** Tampilkan nama harinya di bawah isian — pemilih tanggal hanya menunjukkan
    angka, sementara yang tercetak di formulir memakai nama hari. */
function perbaruiHariDc(){
  const el = document.getElementById('dcHariTeks');
  if(el) el.textContent = tanggalDcTersimpan();
}

function setDcTanggal(){
  const el = document.getElementById('dcTanggal');
  el.value = tanggalHariIni();
  // Checklist mencatat keadaan yang sudah diperiksa, jadi tanggal yang belum
  // terjadi tidak masuk akal. Mundur ke belakang tetap boleh.
  el.max = tanggalHariIni();
  perbaruiHariDc();
}

async function saveDailyCheck(){
  const radkom = dcRadkomAktif();
  const jatsc  = dcRadtelJatscAktif();
  const nav    = (typeof dcNavAktif === 'function') && dcNavAktif();
  const pgm    = (typeof dcPengamatanAktif === 'function') && dcPengamatanAktif();
  const fgk    = (typeof dcGedungKeamananAktif === 'function') && dcGedungKeamananAktif();
  const lk     = (typeof dcListrikAktif === 'function') && dcListrikAktif();
  const fails = [], warns = [];

  if(radkom){
    // Radkom hanya mengenal OK dan NOT OK — tidak ada tingkat "alarm".
    fails.push(...rkTemuan(dcRkState));
  }else if(nav){
    const t = navTemuan();
    fails.push(...t.fails);
    warns.push(...t.warns);
  }else if(jatsc){
    const t = jatscTemuan();
    fails.push(...t.fails);
    warns.push(...t.warns);
  }else if(pgm){
    const t = pgmTemuan(dcPgmForm);
    fails.push(...t.fails);
    warns.push(...t.warns);
  }else if(fgk){
    const t = fgkTemuan(dcFgkForm);
    fails.push(...t.fails);
    warns.push(...t.warns);
  }else if(lk){
    // Lembar listrik seluruhnya angka ukur — lkTemuan() memang selalu kosong;
    // dipanggil apa adanya supaya bentuk cabangnya kembar dengan unit lain.
    const t = lkTemuan(dcLkForm);
    fails.push(...t.fails);
    warns.push(...t.warns);
  }else{
    Object.entries(dcState).forEach(([item, cols])=>{
      Object.entries(cols).forEach(([col,val])=>{
        if(val==='fail') fails.push(`${item} (${col})`);
        if(val==='warn') warns.push(`${item} (${col})`);
      });
    });
  }

  const btn = document.getElementById('dcSaveBtn'); btn.disabled = true;
  const namaList = collectTeknisiNama();
  // Nama alat dan lokasi ditanamkan di dalam state — kolom database untuk daily
  // check tidak berubah bentuknya, dan mesin baca tahu form mana yang dipakai
  // dari kunci __lokasi/__tempat di dalam JSON-nya.
  const tempatDipilih = document.getElementById('dcTempat')?.value || 'new-jatsc';
  const meta = nav
    ? { __lokasi:'navigasi', __tempat:'navigasi' }
    : jatsc
      ? { __lokasi:'jatsc', __tempat: tempatDipilih }
      : { __lokasi:'new-jatsc', __tempat: tempatDipilih };
  // Pengamatan, Gedung & Keamanan, dan Listrik & Mekanik menumpang tabel
  // dailychecks yang sama (pola AMHS): lembar mana yang dipakai ditandai
  // __format + __pgmForm (ckg3/mer), __fgkForm (toilet/jatsc), atau __lkForm
  // (sts/mds/beban/ups) di dalam state JSON.
  const stateDipakai = radkom ? dcRkState
                     : nav    ? { ...dcNState, ...meta }
                     : jatsc  ? { ...dcJState, ...meta }
                     : pgm    ? { ...dcPgmState[dcPgmForm], __format:'pengamatan', __pgmForm:dcPgmForm }
                     : fgk    ? { ...dcFgkState[dcFgkForm], __format:'fgk', __fgkForm:dcFgkForm }
                     : lk     ? { ...dcLkState[dcLkForm], __format:'listrik', __lkForm:dcLkForm }
                              : { ...dcState,  ...meta };
  const payload = {
    tanggal: tanggalDcTersimpan(),
    tanggalIso: document.getElementById('dcTanggal').value,
    dinas: document.getElementById('dcDinas').value,
    suhu: (radkom || jatsc || nav || pgm || fgk || lk) ? '' : document.getElementById('dcSuhu').value.trim(),
    remark: document.getElementById('dcRemark').value.trim(),
    teknisiNamaList: namaList,
    teknisiNama: namaList.join(', '),
    teknisiTtd: getSigDataUrl('sigDcTeknisi'),
    managerNama: document.getElementById('dcManagerNama').value.trim(),
    ttdUntuk: ttdUntukTerpilih('dcManagerAkun', document.getElementById('dcManagerNama').value),
    state: stateDipakai, fails, warns,
    unit: unitAktif
  };
  const menyunting = !!dcEditingId;
  toast(menyunting ? 'Menyimpan perubahan...' : 'Menyimpan daily check ke server...');
  try{
    if(menyunting){
      const saved = await gsRun('updateDailyCheck', dcEditingId, payload);
      const i = dcHistory.findIndex(x=>x.id===dcEditingId);
      if(i !== -1) dcHistory[i] = mapDc(saved);
      renderDcHistory();
      batalEditDc();          // keluar dari mode sunting, reset form
      toast(T('tersimpanPerubahan'));
    }else{
      const saved = await gsRun('addDailyCheck', payload);
      dcHistory.unshift(mapDc(saved));
      renderDcHistory();
      closeDcFormModal();
      toast('Daily check tersimpan.');
    }
  }catch(e){ toast('Gagal menyimpan — ' + (e.message||'coba lagi.')); }
  btn.disabled = false;
}

/** YYYY-MM-DD `n` hari lalu (UTC), untuk batas "seminggu terakhir". */
function isoMundurHari(n){
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - n)).toISOString().slice(0,10);
}
/** True jika tanggal (apa pun bentuknya, diambil 10 huruf awal = YYYY-MM-DD)
    masih dalam 7 hari terakhir. Dipakai semua daftar riwayat untuk membatasi
    tampilan default ke seminggu; catatan lebih lama disembunyikan sampai
    dipanggil lewat filter tanggal / kata, atau "Tampilkan Semua". */
function dalamSeminggu(dateLike){
  const d = String(dateLike || '').slice(0,10);
  return !!d && d >= isoMundurHari(6);
}

/** Default riwayat: hanya SEMINGGU terakhir supaya ringkas. Isi rentang tanggal
    untuk periode lain; tombol "↺ Tampilkan Semua" (resetCariDc) menyetel
    dcTampilSemua=true untuk membuka seluruh riwayat. Dipakai bersama daftar
    daily check biasa (renderDcHistory) dan AMHS (renderDcAmhsHistory) — bukan
    oleh cetak (cetak per-catatan), jadi batas ini murni untuk tampilan layar. */
let dcTampilSemua = false;
function dcHistoryTersaring(){
  const from = (document.getElementById('cariDcDari')   || {}).value || '';
  const to   = (document.getElementById('cariDcSampai') || {}).value || '';
  if(from || to){
    return dcHistory.filter(r=>{
      const d = String(r.tanggalIso || '').slice(0,10);
      if(!d) return false;
      if(from && d < from) return false;
      if(to   && d > to)   return false;
      return true;
    });
  }
  if(dcTampilSemua) return dcHistory;
  const batas = isoMundurHari(6);   // hari ini + 6 hari ke belakang = 7 hari
  return dcHistory.filter(r=>{
    const d = String(r.tanggalIso || '').slice(0,10);
    return d && d >= batas;
  });
}
function resetCariDc(){
  // "Tampilkan Semua" benar-benar membuka semua riwayat (lepas batas seminggu).
  dcTampilSemua = true;
  ['cariDcDari','cariDcSampai'].forEach(id=>{ const el = document.getElementById(id); if(el) el.value = ''; });
  renderDcHistory();
}
/** Chip dinas di kartu riwayat. Menandai HANYA dinas milik catatan itu
    (hijau ✓); dinas lain abu (−). Sebelumnya menandai cakupan seharian —
    membingungkan saat satu hari punya beberapa dinas (mis. Siang & PS dua-duanya
    hijau di semua kartu hari itu). Daftar dinas ikut unit (Radtel P/S/M/PS,
    Radkom PS/M). */
function dcSingkatDinas(n){ return n==='Pagi'?'P' : n==='Siang'?'S' : n==='Malam'?'M' : n; }
function dcChipDinasHtml(r){
  const u = (typeof infoUnit === 'function') ? infoUnit() : null;
  const daftar = (u && u.dinas && u.dinas.length) ? u.dinas : ['Pagi','Siang','Malam','PS'];
  return `<div style="display:flex;gap:5px;flex-wrap:wrap;margin:6px 0 2px;">` +
    daftar.map(n=>{
      const ini = (n === r.dinas);
      return `<span class="status-btn ${ini?'ok':'minus'}" title="${escapeHtml(n)}${ini?' — dinas catatan ini':''}"
                style="cursor:default;width:auto;padding:0 9px;font-size:10.5px;">${escapeHtml(dcSingkatDinas(n))} ${ini?'✓':'−'}</span>`;
    }).join('') + `</div>`;
}

function renderDcHistory(){
  // Unit AMHS punya daftar riwayatnya sendiri (kolom dinas/suhu tidak dipakai).
  if(typeof dcAmhsAktif === 'function' && dcAmhsAktif()){ renderDcAmhsHistory(); return; }
  const wrap = document.getElementById('dcHistory');
  if(dcHistory.length===0){ wrap.innerHTML = '<div class="empty">' + T('belumAdaDc') + '</div>'; return; }
  const daftar = dcHistoryTersaring();
  if(daftar.length===0){ wrap.innerHTML = '<div class="empty">' + T('takAdaFilter') + '</div>'; return; }
  wrap.innerHTML = daftar.map(r=>{
    const tag = r.fails.length ? `<span class="tag fail">${r.fails.length} gangguan</span>`
              : r.warns.length ? `<span class="tag warn">${r.warns.length} alarm</span>`
              : `<span class="tag ok">semua normal</span>`;
    return `<div class="dc-history-item">
      <div><b>${r.tanggal}</b> &middot; Dinas ${escapeHtml(r.dinas)}${unitPakaiSuhuMer() ? ' &middot; Suhu MER ' + (escapeHtml(r.suhu)||'-') : ''}</div>
      ${tag}
      ${dcChipDinasHtml(r)}
      <div style="font-size:11.5px;color:var(--muted);">Teknisi: ${escapeHtml(r.teknisiNama)||'-'} &middot; Mengetahui: ${escapeHtml(r.managerNama)||'-'}</div>
      ${diinputOlehHtml(r.diinputOleh, r.dibuatPada, r.tanggalIso)}
      <div style="display:flex;gap:4px;">
        <button class="btn ghost" style="padding:6px 10px;" onclick="openDcDetail('${r.id}')">${T('detail')}</button>
        ${(!r.managerTtd && bolehSuntingCatatan(r.dibuatOlehUsername)) ? `<button class="icon-btn" title="${T('suntingTanggalDc')}" onclick="openDcEditModal('${r.id}')">✎</button>` : ''}
        <button class="icon-btn" title="Cetak" onclick="printSavedDailyCheck('${r.id}')">🖨</button>
        <button class="icon-btn hanya-admin" title="Hapus" onclick="deleteDcRecord('${r.id}')">✕</button>
      </div>
    </div>`;
  }).join('');
}
async function deleteDcRecord(id){
  if(!adminAktif()){ toast(T('hanyaAdminHapus')); return; }
  const r = dcHistory.find(x=>x.id===id);
  if(!confirm(`Hapus daily check ${r ? r.tanggal : 'ini'}? Tindakan ini tidak bisa dibatalkan.`)) return;
  const salinan = dcHistory.slice();
  dcHistory = dcHistory.filter(x=>x.id!==id);
  renderDcHistory();
  try{ await gsRun('deleteDcRecord', id); }
  catch(e){ dcHistory = salinan; renderDcHistory(); toast('Gagal menghapus — ' + (e.message||'coba lagi.')); }
}

/* ---------- Lihat detail daily check tersimpan ---------- */
function closeDcDetail(){ document.getElementById('dcDetailBg').classList.remove('show'); }

function dcDetailTable(leftItems, rightItems, state){
  const sym = s => s==='ok' ? '✓' : (s==='warn' ? '!' : '✕');
  const cls = s => s==='ok' ? 'ok' : (s==='warn' ? 'warn' : 'fail');
  const kosong6 = '<td class="name"></td>'+'<td></td>'.repeat(5);
  const cells = item => {
    if(!item) return kosong6;
    const st = state[item] || {netA:'ok',netB:'ok',appA:'ok',appB:'ok',eqp:'ok'};
    let h = `<td class="name">${item}</td>`;
    dcCols.forEach(c=>{ h += `<td><span class="status-btn ${cls(st[c]||'ok')}" style="cursor:default;">${sym(st[c]||'ok')}</span></td>`; });
    return h;
  };
  const subRow = item => {
    if(!item) return null;
    const chip = (label, dipilih)=>{
      const kelas = dipilih ? 'ok' : 'minus';
      return `<span class="status-btn ${kelas}" style="cursor:default;width:auto;padding:0 10px;font-size:11.5px;">${label}</span>`;
    };
    if(/^GATEVOX [1-9]$/.test(item)){
      const cpu = (state[item] && state[item].mainCpu) || 'A';
      return `<td class="name" style="padding-left:22px;color:var(--muted);font-size:12px;">CPU Main:</td>` +
        `<td colspan="5" style="text-align:left;">${chip('A · '+(cpu==='A'?'Main':'Standby'), cpu==='A')} ${chip('B · '+(cpu==='B'?'Main':'Standby'), cpu==='B')}</td>`;
    }
    if(item === 'TMCS 1' || item === 'TMCS 2'){
      const n = (state['TMCS 1'] && Number(state['TMCS 1'].mainTmcs)) || 1;
      const angka = item === 'TMCS 1' ? 1 : 2;
      const iniMain = n === angka;
      return `<td class="name" style="padding-left:22px;color:var(--muted);font-size:12px;">Main/standby:</td>` +
        `<td colspan="5" style="text-align:left;">${chip(iniMain?'Main':'Standby', iniMain)}</td>`;
    }
    return null;
  };
  const n = Math.max(leftItems.length, rightItems.length);
  let rows = '';
  for(let i=0;i<n;i++){
    rows += `<tr>${cells(leftItems[i])}${cells(rightItems[i])}</tr>`;
    const lSub = subRow(leftItems[i]);
    const rSub = subRow(rightItems[i]);
    if(lSub || rSub) rows += `<tr>${lSub || kosong6}${rSub || kosong6}</tr>`;
  }
  return `<div class="dc-table-wrap"><table class="dc"><thead><tr>
    <th>Item</th><th>Net A</th><th>Net B</th><th>App A</th><th>App B</th><th>Eqp</th>
    <th>Item</th><th>Net A</th><th>Net B</th><th>App A</th><th>App B</th><th>Eqp</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

/**
 * Tabel baca-saja daily check Radkom. Dipakai modal detail maupun halaman cetak
 * — `cetak` hanya mengganti gaya agar terbaca di atas kertas putih.
 */
function dcRkTabelBaca(state, cetak){
  const sym = s => s === 'ok' ? '✓' : '✕';
  const sel = s => cetak
    ? `<td style="text-align:center;"><span class="${s==='ok'?'p-ok':'p-fail'}">${sym(s)}</span></td>`
    : `<td><span class="status-btn ${s==='ok'?'ok':'fail'}" style="cursor:default;">${sym(s)}</span></td>`;
  const ket = k => escapeHtml((state.ket && state.ket[k]) || '');

  const blok = (grup)=>{
    let baris = '';
    for(const s of grup.data){
      const punyaSub = !!(s.sub && s.sub.length);
      const kKet = rkKunci(grup.kode, s.no);
      const selKet = `<td rowspan="${punyaSub ? s.sub.length + 1 : 1}" style="font-size:${cetak?'7.5pt':'11px'};">${ket(kKet)}</td>`;

      if(punyaSub){
        baris += `<tr><td>${s.no}</td><td style="text-align:left;">${escapeHtml(s.nama)}</td>
          <td style="text-align:left;">${escapeHtml(s.p)}</td><td></td><td></td>
          <td style="text-align:left;">${escapeHtml(s.s)}</td><td></td><td></td>${selKet}</tr>`;
        s.sub.forEach((sb,i)=>{
          const b = state[rkKunci(grup.kode,s.no,i)] || {};
          baris += `<tr><td></td><td style="text-align:left;padding-left:${cetak?'12px':'20px'};">${escapeHtml(sb.nama)}</td>
            <td></td>${sel(b.pTx||'ok')}${sel(b.pRx||'ok')}
            <td style="text-align:left;">${escapeHtml(sb.sek||'')}</td>
            ${sb.sek ? sel(b.sTx||'ok') + sel(b.sRx||'ok') : '<td></td><td></td>'}</tr>`;
        });
      }else{
        const b = state[rkKunci(grup.kode,s.no)] || {};
        const adaS = !!(s.s && s.s !== '-');
        baris += `<tr><td>${s.no}</td><td style="text-align:left;">${escapeHtml(s.nama)}</td>
          <td style="text-align:left;">${escapeHtml(s.p)}</td>${sel(b.pTx||'ok')}${sel(b.pRx||'ok')}
          <td style="text-align:left;">${escapeHtml(s.s)}</td>
          ${adaS ? sel(b.sTx||'ok') + sel(b.sRx||'ok') : '<td></td><td></td>'}${selKet}</tr>`;
      }
    }
    const judul = grup.judul ? `<div style="font-weight:bold;font-size:${cetak?'9pt':'11px'};margin:8px 0 4px;">${grup.judul}</div>` : '';
    const tabel = `<table class="${cetak?'':'dc rk'}" style="font-size:${cetak?'7.5pt':''};">
      <thead>
        <tr class="p-kepala"><td rowspan="2">NO</td><td rowspan="2">SEKTOR</td><td colspan="3">FREKUENSI PRIMARY</td>
            <td colspan="3">FREKUENSI SECONDARY</td><td rowspan="2">KETERANGAN</td></tr>
        <tr class="p-kepala"><td>FREK</td><td>TX</td><td>RX</td><td>FREK</td><td>TX</td><td>RX</td></tr>
      </thead><tbody>${baris}</tbody></table>`;
    return judul + (cetak ? tabel : `<div class="dc-table-wrap" style="margin-bottom:10px;">${tabel}</div>`);
  };

  const barisCwp = DC_RK_CWP.map(c=>{
    const b = state[rkKunci('cwp',c.no)] || {};
    return `<tr><td>${c.no}</td><td style="text-align:left;">${escapeHtml(c.nama)}</td>
      ${DC_RK_CWP_KOLOM.map(k=>sel(b[k.kunci]||'ok')).join('')}
      <td style="font-size:${cetak?'7.5pt':'11px'};">${ket(rkKunci('cwp',c.no))}</td></tr>`;
  }).join('');
  const tabelCwp = `<table class="${cetak?'':'dc rk'}" style="font-size:${cetak?'7.5pt':''};">
    <thead><tr class="p-kepala"><td>NO</td><td>FIC JAKARTA SECTOR</td>
      ${DC_RK_CWP_KOLOM.map(k=>`<td>${k.judul}</td>`).join('')}<td>KETERANGAN</td></tr></thead>
    <tbody>${barisCwp}</tbody></table>`;

  return DC_RK_GRUP.map(blok).join('') +
    `<div style="font-weight:bold;font-size:${cetak?'9pt':'11px'};margin:8px 0 4px;">II. CWP FIC &amp; ATMCP</div>` +
    (cetak ? tabelCwp : `<div class="dc-table-wrap">${tabelCwp}</div>`);
}

const dcRkDetailHtml = state => dcRkTabelBaca(state, false);

async function openDcDetail(id){
  const r = dcHistory.find(x=>x.id===id);
  if(!r) return;
  const body = document.getElementById('dcDetailBody');
  document.getElementById('dcDetailBg').classList.add('show');
  document.getElementById('dcDetailPrintBtn').onclick = ()=>{ closeDcDetail(); printSavedDailyCheck(id); };
  const dcEditBtn = document.getElementById('dcDetailEditBtn');
  dcEditBtn.onclick = ()=>{ closeDcDetail(); openDcEditModal(id); };
  // Sudah disetujui manager teknik, atau bukan pembuat aslinya (dan bukan admin).
  dcEditBtn.style.display = (!r.managerTtd && bolehSuntingCatatan(r.dibuatOlehUsername)) ? '' : 'none';

  body.innerHTML = `<div class="empty">Memuat detail...</div>`;
  let detail = {};
  try{ detail = await gsRun('getDailyCheckDetail', id) || {}; }
  catch(e){ body.innerHTML = '<div class="empty">Gagal memuat detail. Coba lagi.</div>'; return; }
  const state = detail.state || {};
  // Unit AMHS: form-nya beda total (3 sub-sistem + TTD tiap dinas). Render
  // detailnya lewat modul-nya sendiri; edit belum didukung, jadi tombolnya
  // disembunyikan. TTD Manager tetap lewat alur pihak-kedua yang sama.
  if(state.__format === 'amhs'){
    dcEditBtn.style.display = 'none';
    renderDcAmhsDetail(r, detail, state);
    return;
  }
  const teknisiTtd = detail.teknisiTtd || r.teknisiTtd;
  const managerTtd = detail.managerTtd || r.managerTtd;

  const namaList = (r.teknisiNamaList && r.teknisiNamaList.length) ? r.teknisiNamaList
                 : (r.teknisiNama ? String(r.teknisiNama).split(',').map(s=>s.trim()).filter(Boolean) : []);
  const tekHtml = (namaList.length ? namaList.map((n,i)=>`<div>${i+1}. ${escapeHtml(n)}</div>`).join('') : '<div style="color:var(--muted);">-</div>')
    + sigThumbHtml(teknisiTtd);

  // Bentuk detail ikut lokasi yang tersimpan pada state — bukan lokasi yang
  // kebetulan sedang dipilih di form. Riwayat lama masih dari sebelum kolom
  // ini ada; state tanpa __lokasi diperlakukan sebagai New JATSC.
  const jatscTersimpan = state && state.__lokasi === 'jatsc';
  const navTersimpan   = state && state.__lokasi === 'navigasi';
  const pgmTersimpan   = state && state.__format === 'pengamatan';
  const fgkTersimpan   = state && state.__format === 'fgk';
  const lkTersimpan    = state && state.__format === 'listrik';
  body.innerHTML = `
    <div style="font-size:13px;margin-bottom:10px;line-height:1.7;">
      <b>${escapeHtml(r.tanggal)}</b><br>
      Dinas: ${escapeHtml(r.dinas)||'-'}${(!unitPakaiSuhuMer() || jatscTersimpan || navTersimpan || pgmTersimpan || fgkTersimpan || lkTersimpan) ? '' : ' &middot; Suhu MER: ' + (escapeHtml(r.suhu)||'-')}${pgmTersimpan ? ' &middot; Form: ' + escapeHtml((typeof DC_PGM_LABEL !== 'undefined' && DC_PGM_LABEL[state.__pgmForm]) || 'Radar CKG 3') : ''}${fgkTersimpan ? ' &middot; Lokasi: ' + escapeHtml((typeof DC_FGK_LABEL !== 'undefined' && DC_FGK_LABEL[state.__fgkForm]) || 'New JATSC') : ''}${lkTersimpan ? ' &middot; Lembar: ' + escapeHtml((typeof DC_LK_LABEL !== 'undefined' && DC_LK_LABEL[state.__lkForm]) || 'STS') : ''}
    </div>
    ${dcRadkomAktif()
      ? dcRkDetailHtml(state)
      : (lkTersimpan
        ? dcLkDetailHtml(state)
        : (fgkTersimpan
        ? dcFgkDetailHtml(state)
        : (pgmTersimpan
          ? dcPgmDetailHtml(state)
          : (navTersimpan
          ? dcNavDetailHtml(state)
          : (jatscTersimpan
              ? dcJatscDetailHtml(state)
              : dcDetailTable(dcLeftItems.slice(0,dcLeftItems.indexOf('TMCS 1')), dcRightItems.slice(0,dcRightItems.indexOf('SW 3')), state) +
                '<div style="height:8px;"></div>' +
                dcDetailTable(dcLeftItems.slice(dcLeftItems.indexOf('TMCS 1')), dcRightItems.slice(dcRightItems.indexOf('SW 3')), state))))))}
    ${r.remark ? `<div style="margin-top:12px;font-size:13px;"><b>Remark:</b><br>${escapeHtml(r.remark).replace(/\n/g,'<br>')}</div>` : ''}
    <div class="detail-ttd">
      <div class="sig-block"><b>${T('teknisiPelaksana')}</b>${tekHtml}</div>
      <div class="sig-block"><b>Mengetahui — Manager Teknik</b>${renderPihakKedua('dc', r.id, r.managerNama, managerTtd)}${sigPejabatHtml('dailycheck', r.id, managerTtd, r)}</div>
    </div>`;
}

/* ---------- Sunting daily check tersimpan (di form utama) ----------
   Catatan yang sudah ditandatangani manager teknik menjadi kunci — tombol
   suntingnya sudah tersembunyi (renderDcHistory) dan server pun menolak
   perubahan (updateDailyCheck). Sebelum itu, seluruh isi form boleh diubah:
   tanggal, dinas, suhu, remark, seluruh sel checklist, daftar nama teknisi,
   tanda tangan teknisi, dan nama manager teknik. Alat dan lokasi ikut boleh
   diganti — kalau catatan awalnya salah lokasi/salah alat, itu harus bisa
   dibetulkan tanpa hapus-tulis ulang.

   Alur suntingnya BERLANGSUNG DI FORM UTAMA, bukan di modal terpisah. Seluruh
   isian catatan lama disalin ke form; pesan sudah-menyunting muncul di atas
   selector Alat/Lokasi; tombol simpan berubah judulnya menjadi "Simpan
   Perubahan"; ada tombol Batal Edit untuk mengembalikan form ke keadaan
   kosong tanpa menyentuh catatannya. */
let dcEditingId = null;

async function openDcEditModal(id){
  const r = dcHistory.find(x=>x.id===id);
  if(!r){ toast('Catatan tidak ditemukan.'); return; }
  if(r.managerTtd){
    toast('Sudah ditandatangani manager teknik — tidak bisa disunting.');
    return;
  }

  toast('Memuat detail catatan...');
  let detail = {};
  try{ detail = await gsRun('getDailyCheckDetail', id) || {}; }
  catch(e){ toast('Gagal memuat detail — ' + (e.message||'coba lagi.')); return; }

  const state = detail.state || {};
  const isJatsc = state && state.__lokasi === 'jatsc';
  const isNav   = state && state.__lokasi === 'navigasi';
  const isPgm   = state && state.__format === 'pengamatan';
  const isFgk   = state && state.__format === 'fgk';
  const isLk    = state && state.__format === 'listrik';
  const tempat  = (state && state.__tempat) || 'new-jatsc';
  // Pengamatan: kembalikan dulu form yang tersimpan (Radar CKG 3 / Fasilitas
  // Pengamatan) sebelum layar unit dipasang, supaya wrap-nya menggambar
  // lembar yang benar. Gedung & Keamanan sama polanya.
  if(isPgm && typeof setDcPgmForm === 'function'){
    dcPgmForm = (state.__pgmForm === 'mer') ? 'mer' : 'ckg3';
  }
  if(isFgk && typeof setDcFgkForm === 'function'){
    dcFgkForm = (state.__fgkForm === 'jatsc') ? 'jatsc' : 'toilet';
  }
  if(isLk && typeof lkFormTersimpan === 'function'){
    dcLkForm = lkFormTersimpan(state);
  }

  // Selector nama alat & lokasi. Untuk Navigasi tidak ada pilihan
  // Garex/Frequentis — form-nya tunggal — jadi kedua selector dibiarkan
  // apa adanya (terapkanUnit tetap yang menentukan wadah yang kelihatan).
  const dcLokasi = document.getElementById('dcLokasi');
  const dcTempat = document.getElementById('dcTempat');
  if(!isNav){
    if(dcLokasi) dcLokasi.value = isJatsc ? 'jatsc' : 'new-jatsc';
    if(dcTempat) dcTempat.value = tempat;
  }
  // Terapkan ulang layar unit supaya wrap yg cocok kelihatan.
  if(typeof terapkanUnit === 'function') terapkanUnit();

  // Isi state checklist ke variabel form.
  if(isPgm){
    initDcPgmState();
    Object.entries(state).forEach(([k, v])=>{
      if(k.startsWith('__')) return;
      dcPgmState[dcPgmForm][k] = v;
    });
    renderDcPgmTable();
    if(typeof sinkronSubtabPgm === 'function') sinkronSubtabPgm();
  }else if(isFgk){
    initDcFgkState();
    Object.entries(state).forEach(([k, v])=>{
      if(k.startsWith('__')) return;   // kunci catatan ("A|__ket") tidak kena — "__" ada di tengah
      dcFgkState[dcFgkForm][k] = v;
    });
    renderDcFgkTable();
    if(typeof sinkronSubtabFgk === 'function') sinkronSubtabFgk();
  }else if(isLk){
    initDcLkState();
    Object.entries(state).forEach(([k, v])=>{
      if(k.startsWith('__')) return;
      dcLkState[dcLkForm][k] = v;
    });
    renderDcLkTable();
    if(typeof sinkronSubtabLk === 'function') sinkronSubtabLk();
  }else if(isNav){
    initDcNState();
    Object.entries(state).forEach(([k, v])=>{
      if(k.startsWith('__')) return;
      dcNState[k] = v;
    });
    renderDcNavTable();
  }else if(isJatsc){
    initDcJState();
    Object.entries(state).forEach(([k, v])=>{
      if(k.startsWith('__')) return;
      dcJState[k] = v;
    });
    renderDcJatscTable();
  }else{
    initDcState();
    Object.entries(state).forEach(([itemName, cols])=>{
      if(!itemName || itemName.startsWith('__')) return;
      if(dcState[itemName] && cols && typeof cols === 'object'){
        dcState[itemName] = { ...dcState[itemName], ...cols };
      }
    });
    renderDcTable();
  }

  // Field-field header form
  document.getElementById('dcSuhu').value   = r.suhu || '';
  document.getElementById('dcDinas').value  = r.dinas || 'Pagi';
  document.getElementById('dcRemark').value = r.remark || '';
  document.getElementById('dcManagerNama').value = r.managerNama || '';

  // Tanggal
  const tglInput = document.getElementById('dcTanggal');
  tglInput.value = r.tanggalIso || tanggalHariIni();
  tglInput.max   = tanggalHariIni();
  perbaruiHariDc();

  // Daftar nama teknisi
  const list = (r.teknisiNamaList && r.teknisiNamaList.length) ? r.teknisiNamaList
             : (r.teknisiNama ? String(r.teknisiNama).split(',').map(s=>s.trim()).filter(Boolean) : []);
  teknisiRows = list.map(nama=>({ key:'k'+(teknisiSeq++), nama }));
  if(teknisiRows.length === 0) addTeknisi(); else renderTeknisiList();

  // Kanvas TTD teknisi sengaja dikosongkan — TTD lamanya tetap tersimpan di
  // server, dan kalau kanvas tidak ditandatangani ulang saat disimpan, server
  // membiarkan TTD lamanya (lihat updateDailyCheck: hanya URL data baru yang
  // menggantikan berkas). Menampilkan TTD lama sebagai gambar di kanvas malah
  // membingungkan — sekali orang menekan "bersihkan" karyanya hilang tanpa
  // sebab yang tampak.
  if(sigPads['sigDcTeknisi']) clearSig('sigDcTeknisi');

  // Ganti tombol simpan, tampilkan spanduk, gulir ke atas.
  dcEditingId = id;
  const btn = document.getElementById('dcSaveBtn');
  btn.textContent = T('simpanPerubahan');
  const banner = document.getElementById('dcEditingBanner');
  const bannerTeks = document.getElementById('dcEditingTeks');
  if(bannerTeks) bannerTeks.textContent = 'Menyunting daily check: ' + (r.tanggal || '');
  if(banner) banner.style.display = '';
  // Sunting berlangsung di modal yang sama dengan "+ Form Baru".
  const bg = document.getElementById('dcFormModalBg');
  if(bg) bg.classList.add('show');
  setTimeout(()=>{ if(typeof resizeAllVisibleSigPads === 'function') resizeAllVisibleSigPads(); }, 60);
}

/** Batalkan edit — form kembali ke keadaan mengisi baru. Dipakai juga oleh
    saveDailyCheck (edit-sukses) dan openDcFormModal; menutup modal supaya
    setelah simpan/batal kembali ke daftar riwayat. */
function batalEditDc(){
  dcEditingId = null;
  const btn = document.getElementById('dcSaveBtn');
  btn.textContent = T('simpanDc');
  const banner = document.getElementById('dcEditingBanner');
  if(banner) banner.style.display = 'none';
  resetDcForm();
  if(typeof closeDcFormModal === 'function') closeDcFormModal();
}
