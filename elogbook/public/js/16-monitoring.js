/* E-Logbook · js/16-monitoring.js — Tab Form Monitoring Frekuensi
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh. */

/* ============== TAB — FORM MONITORING FREKUENSI ==============
   Satu lembar berisi banyak baris pengamatan, sama seperti form kertasnya.
   Barisnya dinamis karena jumlah pengamatan per dinas tidak pernah tetap. */

const KOLOM_MON = ['sector','frequency','time','flight','level','bearing','range','radioSite','readibility','note'];
let monBaris = [];
let monSeq = 0;
let monTeknisiRows = [];
let monTeknisiSeq = 0;

function renderMonTeknisi(){
  const wrap = document.getElementById('monTeknisiList');
  wrap.innerHTML = monTeknisiRows.map((t,i)=>`
    <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;">
      <span style="font-family:var(--font-mono);color:var(--accent);font-size:12px;min-width:18px;">${i+1}.</span>
      <input type="text" value="${escapeHtml(t.nama)}" placeholder="${T('namaTeknisiPelaksana')} ${i+1}"
             list="teknisiDatalist"
             oninput="monTeknisiRows[${i}].nama=this.value"
             style="flex:1;background:var(--panel-2);border:1px solid var(--line);color:var(--text);border-radius:6px;padding:9px 10px;font-size:16px;">
      ${monTeknisiRows.length>1 ? `<button class="icon-btn" onclick="hapusMonTeknisi('${t.key}')">✕</button>` : ''}
    </div>`).join('');
}
function addMonTeknisi(){
  const isiAwal = monTeknisiRows.length === 0 && userSaatIni ? (userSaatIni.nama || userSaatIni.username || '') : '';
  monTeknisiRows.push({key:'t'+(monTeknisiSeq++), nama: isiAwal});
  renderMonTeknisi();
}
function hapusMonTeknisi(key){ monTeknisiRows = monTeknisiRows.filter(x=>x.key!==key); renderMonTeknisi(); }

const mapMon = m => ({ id:m.ID, tanggal:m.Tanggal, baris:m.Baris||[],
                       personilOps:m.PersonilOps||'', personilTeknik:m.PersonilTeknik||'',
                       personilOpsTtd:m.PersonilOpsTTD||'',
                       teknisiNamaList:m.TeknisiNamaListJSON||[],
                       teknisiTtd:m.TeknisiTTD||'', diinputOleh:m.DiinputOleh||'', dibuatPada:m.DibuatPada||'',
                       ttdOleh:m.TtdOleh||'', ttdPada:m.TtdPada||'', ttdUntuk:m.TtdUntuk||'' });

function barisMonKosong(){ const o = { key:'m'+(monSeq++) }; KOLOM_MON.forEach(k=>o[k]=''); return o; }
function tambahBarisMon(){ monBaris.push(barisMonKosong()); renderBarisMon(); }
function hapusBarisMon(key){ monBaris = monBaris.filter(b=>b.key!==key); if(monBaris.length===0) tambahBarisMon(); else renderBarisMon(); }
function setBarisMon(key, kolom, nilai){ const b = monBaris.find(x=>x.key===key); if(b) b[kolom] = nilai; }

function renderBarisMon(){
  document.getElementById('monBody').innerHTML = monBaris.map((b,i)=>`
    <tr>
      <td>${i+1}</td>
      ${KOLOM_MON.map(k=>`<td><input type="text" class="mon-in" value="${escapeHtml(b[k])}"
          oninput="setBarisMon('${b.key}','${k}',this.value)"></td>`).join('')}
      <td><button class="icon-btn" title="${T('hapus')}" onclick="hapusBarisMon('${b.key}')">✕</button></td>
    </tr>`).join('');
}

function openMonModal(){
  document.getElementById('monTanggal').value = tanggalHariIni();
  document.getElementById('monOps').value = '';
  document.getElementById('monOpsAkun').value = '';
  monBaris = []; monSeq = 0;
  for(let i=0;i<3;i++) tambahBarisMon();   // mulai dengan beberapa baris kosong
  monTeknisiRows = []; monTeknisiSeq = 0; addMonTeknisi();
  if(monTeknisiRows[0]) monTeknisiRows[0].nama = userSaatIni ? (userSaatIni.nama || userSaatIni.username) : '';
  renderMonTeknisi();
  ['sigMon','sigMonOps'].forEach(id=>{ if(!sigPads[id]) setupSigCanvas(id); resizeSigCanvas(id); clearSig(id); });
  document.getElementById('monModalBg').classList.add('show');
  setTimeout(()=>['sigMon','sigMonOps'].forEach(resizeSigCanvas), 60);
}
function closeMonModal(){ document.getElementById('monModalBg').classList.remove('show'); }

async function saveMon(){
  const baris = monBaris
    .map(b=>{ const o={}; KOLOM_MON.forEach(k=>o[k]=(b[k]||'').trim()); return o; })
    .filter(b=>KOLOM_MON.some(k=>b[k]!==''));
  if(baris.length === 0){ toast(T('monKosong')); return; }

  const namaTeknikMon = monTeknisiRows.map(t=>(t.nama||'').trim()).filter(Boolean);
  const btn = document.getElementById('monSaveBtn'); btn.disabled = true;
  try{
    const saved = await gsRun('addMonitoring', {
      unit: unitAktif,
      tanggal: document.getElementById('monTanggal').value,
      personilOps: document.getElementById('monOps').value.trim(),
      ttdUntuk: ttdUntukTerpilih('monOpsAkun', document.getElementById('monOps').value),
      personilTeknik: namaTeknikMon.join(', '),
      teknisiNamaList: namaTeknikMon,
      personilOpsTtd: getSigDataUrl('sigMonOps'),
      teknisiTtd: getSigDataUrl('sigMon'),
      baris
    });
    monitoring.unshift(mapMon(saved));
    renderMonList();
    closeMonModal();
    toast(T('monTersimpan'));
  }catch(e){ toast(T('gagalSimpan') + ' — ' + (e.message || T('coba'))); }
  btn.disabled = false;
}

function resetCariMon(){ document.getElementById('cariMonTanggal').value = ''; renderMonList(); }

function renderMonList(){
  const wrap = document.getElementById('monList');
  if(!wrap) return;
  const tgl = (document.getElementById('cariMonTanggal') || {}).value || '';
  const daftar = tgl ? monitoring.filter(m => String(m.tanggal||'').slice(0,10) === tgl) : monitoring;

  if(monitoring.length === 0){ wrap.innerHTML = '<div class="empty">' + T('belumAdaMon') + '</div>'; return; }
  if(daftar.length === 0){ wrap.innerHTML = '<div class="empty">' + T('takAdaHasil') + '</div>'; return; }

  wrap.innerHTML = daftar.map(m=>`
    <div class="dc-history-item">
      <div><b>${escapeHtml(m.tanggal)}</b> &middot; ${m.baris.length} ${T('barisPengamatanSingkat')}</div>
      <div style="font-size:11.5px;color:var(--muted);">
        ${T('personilOps')}: ${escapeHtml(m.personilOps)||'-'} &middot; ${T('personilTeknik')}: ${escapeHtml(m.personilTeknik)||'-'}
      </div>
      ${diinputOlehHtml(m.diinputOleh, m.dibuatPada, String(m.tanggal||'').slice(0,10))}
      <div style="display:flex;gap:4px;">
        <button class="btn ghost" style="padding:6px 10px;" onclick="openMonDetail('${m.id}')">${T('detail')}</button>
        <button class="icon-btn" title="${T('cetak')}" onclick="printMon('${m.id}')">🖨</button>
        <button class="icon-btn hanya-admin" title="${T('hapus')}" onclick="hapusMon('${m.id}')">✕</button>
      </div>
    </div>`).join('');
}

async function hapusMon(id){
  if(!adminAktif()){ toast(T('hanyaAdminHapus')); return; }
  const m = monitoring.find(x=>x.id===id);
  if(!confirm(`${T('konfirmasiHapus')} ${m ? m.tanggal : ''}?`)) return;
  const salinan = monitoring.slice();
  monitoring = monitoring.filter(x=>x.id!==id);
  renderMonList();
  try{ await gsRun('deleteMonitoring', id); }
  catch(e){ monitoring = salinan; renderMonList(); toast(T('gagalHapus') + ' — ' + (e.message||T('coba'))); }
}

function monTabelHtml(m, cetak){
  const th = KOLOM_MON_JUDUL.map(j=>`<${cetak?'td':'th'}>${j}</${cetak?'td':'th'}>`).join('');
  const baris = m.baris.map((b,i)=>`<tr><td style="text-align:center;">${i+1}</td>${
    KOLOM_MON.map(k=>`<td style="text-align:left;">${escapeHtml(b[k]||'')}</td>`).join('')}</tr>`).join('');
  const tabel = `<table class="${cetak?'':'dc mon'}" style="font-size:${cetak?'8pt':''};">
    <thead><tr class="p-kepala"><${cetak?'td':'th'}>No</${cetak?'td':'th'}>${th}</tr></thead>
    <tbody>${baris}</tbody></table>`;
  return cetak ? tabel : `<div class="dc-table-wrap">${tabel}</div>`;
}
const KOLOM_MON_JUDUL = ['Sector','Frequency','Time','Flight','Level','Bearing','Range','Radio Site','Readibility','Note'];

function openMonDetail(id){
  const m = monitoring.find(x=>x.id===id);
  if(!m) return;
  document.getElementById('formDetailJudul').textContent = T('monModal');
  document.getElementById('formDetailBody').innerHTML = `
    <div style="font-size:13px;line-height:1.7;margin-bottom:10px;"><b>${escapeHtml(m.tanggal)}</b></div>
    ${monTabelHtml(m, false)}
    <div class="detail-ttd">
      <div class="sig-block"><b>${T('personilOps')}</b>${escapeHtml(m.personilOps)||'-'}${sigPejabatHtml('monitoring', m.id, m.personilOpsTtd, m)}</div>
      <div class="sig-block"><b>${T('personilTeknik')}</b>${escapeHtml(m.personilTeknik)||'-'}${sigThumbHtml(m.teknisiTtd)}</div>
    </div>
    <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line);">${diinputOlehHtml(m.diinputOleh, m.dibuatPada, String(m.tanggal||'').slice(0,10))}</div>`;
  document.getElementById('formDetailPrintBtn').onclick = ()=>{ closeFormDetail(); printMon(id); };
  document.getElementById('formDetailBg').classList.add('show');
}

function printMon(id){
  const m = monitoring.find(x=>x.id===id);
  if(!m) return;
  if(!tolakCetakBilaBelumTtd(m, 'monitoring')) return;
  doPrint(`
    <div style="text-align:center;font-weight:bold;font-size:12pt;margin-bottom:4px;">MONITORING FREKUENSI NEW JATSC</div>
    <div style="text-align:center;font-size:9pt;margin-bottom:10px;">TANGGAL : ${escapeHtml(m.tanggal)}</div>
    ${monTabelHtml(m, true)}
    <table class="no-border" style="font-size:9pt;margin-top:16px;">
      <tr>
        <td style="width:50%;text-align:center;vertical-align:top;">
          <div>Personil Operasi</div>
          <div style="height:46px;">${ttdImg(m.personilOpsTtd, 40)}</div>
          <div style="border-top:1px solid #000;display:inline-block;padding:0 24px;">${m.personilOpsTtd ? (escapeHtml(m.personilOps)||'&nbsp;') : '&nbsp;'}</div>
        </td>
        <td style="text-align:center;vertical-align:top;">
          <div>Personil Teknik</div>
          <div style="height:46px;">${ttdImg(m.teknisiTtd, 40)}</div>
          <div style="border-top:1px solid #000;display:inline-block;padding:0 24px;">${m.teknisiTtd ? (escapeHtml(m.personilTeknik)||'&nbsp;') : '&nbsp;'}</div>
        </td>
      </tr>
    </table>`, 'landscape');
}
