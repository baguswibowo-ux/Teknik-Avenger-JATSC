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
             oninput="teknisiRows[${i}].nama=this.value" style="flex:1;background:var(--panel-2);border:1px solid var(--line);color:var(--text);border-radius:6px;padding:9px 10px;font-size:16px;">
      ${teknisiRows.length>1 ? `<button class="icon-btn" title="Hapus" onclick="removeTeknisi('${t.key}')">✕</button>` : ''}
    </div>`).join('');
}
function addTeknisi(){
  teknisiRows.push({key:'k'+(teknisiSeq++), nama:''});
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

function resetDcForm(){
  initDcState(); renderDcTable();
  initDcRkState(); renderDcRkTable();
  document.getElementById('dcSuhu').value=''; document.getElementById('dcRemark').value='';
  document.getElementById('dcManagerNama').value='';
  document.getElementById('dcManagerAkun').value='';
  ['sigDcTeknisi'].forEach(id=>{ if(sigPads[id]) clearSig(id); });
  teknisiRows = []; teknisiSeq = 0;
  addTeknisi();  // mulai dengan 1 baris nama
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
  const fails = [], warns = [];

  if(radkom){
    // Radkom hanya mengenal OK dan NOT OK — tidak ada tingkat "alarm".
    fails.push(...rkTemuan(dcRkState));
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
  const payload = {
    tanggal: tanggalDcTersimpan(),
    tanggalIso: document.getElementById('dcTanggal').value,
    dinas: document.getElementById('dcDinas').value,
    suhu: radkom ? '' : document.getElementById('dcSuhu').value.trim(),
    remark: document.getElementById('dcRemark').value.trim(),
    teknisiNamaList: namaList,
    teknisiNama: namaList.join(', '),
    teknisiTtd: getSigDataUrl('sigDcTeknisi'),
    managerNama: document.getElementById('dcManagerNama').value.trim(),
    ttdUntuk: ttdUntukTerpilih('dcManagerAkun', document.getElementById('dcManagerNama').value),
    state: radkom ? dcRkState : dcState, fails, warns,
    unit: unitAktif
  };
  toast('Menyimpan daily check ke server...');
  try{
    const saved = await gsRun('addDailyCheck', payload);
    dcHistory.unshift(mapDc(saved));
    renderDcHistory();
    toast('Daily check tersimpan.');
  }catch(e){ toast('Gagal menyimpan.'); }
  btn.disabled = false;
}

/** Rentang tanggal dari bilah filter di atas riwayat, dipakai memilah daftar
    yang tampil — supaya administrator gampang menemukan catatan lama yang
    mau dihapus tanpa harus menggulir seluruh riwayat. */
function dcHistoryTersaring(){
  const from = (document.getElementById('cariDcDari')   || {}).value || '';
  const to   = (document.getElementById('cariDcSampai') || {}).value || '';
  if(!from && !to) return dcHistory;
  return dcHistory.filter(r=>{
    const d = String(r.tanggalIso || '').slice(0,10);
    if(!d) return false;
    if(from && d < from) return false;
    if(to   && d > to)   return false;
    return true;
  });
}
function resetCariDc(){
  ['cariDcDari','cariDcSampai'].forEach(id=>{ const el = document.getElementById(id); if(el) el.value = ''; });
  renderDcHistory();
}
function renderDcHistory(){
  const wrap = document.getElementById('dcHistory');
  if(dcHistory.length===0){ wrap.innerHTML = '<div class="empty">' + T('belumAdaDc') + '</div>'; return; }
  const daftar = dcHistoryTersaring();
  if(daftar.length===0){ wrap.innerHTML = '<div class="empty">' + T('takAdaFilter') + '</div>'; return; }
  wrap.innerHTML = daftar.map(r=>{
    const tag = r.fails.length ? `<span class="tag fail">${r.fails.length} gangguan</span>`
              : r.warns.length ? `<span class="tag warn">${r.warns.length} alarm</span>`
              : `<span class="tag ok">semua normal</span>`;
    return `<div class="dc-history-item">
      <div><b>${r.tanggal}</b> &middot; Dinas ${escapeHtml(r.dinas)} &middot; Suhu MER ${escapeHtml(r.suhu)||'-'}</div>
      ${tag}
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
  const cells = item => {
    if(!item) return '<td class="name"></td>'+'<td></td>'.repeat(5);
    const st = state[item] || {netA:'ok',netB:'ok',appA:'ok',appB:'ok',eqp:'ok'};
    let h = `<td class="name">${item}</td>`;
    dcCols.forEach(c=>{ h += `<td><span class="status-btn ${cls(st[c]||'ok')}" style="cursor:default;">${sym(st[c]||'ok')}</span></td>`; });
    return h;
  };
  const n = Math.max(leftItems.length, rightItems.length);
  let rows = '';
  for(let i=0;i<n;i++) rows += `<tr>${cells(leftItems[i])}${cells(rightItems[i])}</tr>`;
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
  const teknisiTtd = detail.teknisiTtd || r.teknisiTtd;
  const managerTtd = detail.managerTtd || r.managerTtd;

  const namaList = (r.teknisiNamaList && r.teknisiNamaList.length) ? r.teknisiNamaList
                 : (r.teknisiNama ? String(r.teknisiNama).split(',').map(s=>s.trim()).filter(Boolean) : []);
  const tekHtml = (namaList.length ? namaList.map((n,i)=>`<div>${i+1}. ${escapeHtml(n)}</div>`).join('') : '<div style="color:var(--muted);">-</div>')
    + sigThumbHtml(teknisiTtd);

  body.innerHTML = `
    <div style="font-size:13px;margin-bottom:10px;line-height:1.7;">
      <b>${escapeHtml(r.tanggal)}</b><br>
      Dinas: ${escapeHtml(r.dinas)||'-'} &middot; Suhu MER: ${escapeHtml(r.suhu)||'-'}
    </div>
    ${dcRadkomAktif()
      ? dcRkDetailHtml(state)
      : dcDetailTable(dcLeftItems.slice(0,dcLeftItems.indexOf('TMCS 1')), dcRightItems.slice(0,dcRightItems.indexOf('SW 3')), state) +
        '<div style="height:8px;"></div>' +
        dcDetailTable(dcLeftItems.slice(dcLeftItems.indexOf('TMCS 1')), dcRightItems.slice(dcRightItems.indexOf('SW 3')), state)}
    ${r.remark ? `<div style="margin-top:12px;font-size:13px;"><b>Remark:</b><br>${escapeHtml(r.remark).replace(/\n/g,'<br>')}</div>` : ''}
    <div class="detail-ttd">
      <div class="sig-block"><b>${T('teknisiPelaksana')}</b>${tekHtml}</div>
      <div class="sig-block"><b>Mengetahui — Manager Teknik</b>${escapeHtml(r.managerNama)||'-'}${sigPejabatHtml('dailycheck', r.id, managerTtd, r)}</div>
    </div>`;
}

/* ---------- Sunting tanggal daily check tersimpan ----------
   Pemilih tanggal saat mengisi bisa salah pencet, dan checklist-nya sendiri
   terlalu panjang untuk dibuat ulang hanya karena itu — jadi hanya tanggalnya
   yang bisa disunting di sini. */
let dcEditId = null;

function openDcEditModal(id){
  const r = dcHistory.find(x=>x.id===id);
  if(!r){ toast('Catatan tidak ditemukan.'); return; }
  dcEditId = id;
  document.getElementById('dceTanggal').value = r.tanggalIso || tanggalHariIni();
  document.getElementById('dceTanggal').max = tanggalHariIni();
  document.getElementById('dcEditModalBg').classList.add('show');
}

function closeDcEditModal(){
  document.getElementById('dcEditModalBg').classList.remove('show');
  dcEditId = null;
}

async function saveDcEdit(){
  if(!dcEditId) return;
  const iso = document.getElementById('dceTanggal').value;
  if(!iso){ toast('Tanggal belum diisi.'); return; }
  const btn = document.getElementById('dceSaveBtn'); btn.disabled = true;
  const patch = {
    tanggal: tanggalPanjang(new Date(iso + 'T00:00:00Z')),
    tanggalIso: iso
  };
  try{
    const saved = await gsRun('updateDailyCheck', dcEditId, patch);
    const i = dcHistory.findIndex(x=>x.id===dcEditId);
    if(i !== -1) dcHistory[i] = mapDc(saved);
    renderDcHistory();
    closeDcEditModal();
    toast(T('tersimpanPerubahan'));
  }catch(e){ toast('Gagal menyimpan — ' + (e.message||'coba lagi.')); }
  btn.disabled = false;
}
