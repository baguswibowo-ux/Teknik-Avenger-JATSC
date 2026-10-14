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
                       managerOps:m.ManagerOps||'', managerOpsTtd:m.ManagerOpsTTD||'',
                       managerNama:m.ManagerNama||'', managerTtd:m.ManagerTTD||'',
                       teknisiNamaList:m.TeknisiNamaListJSON||[],
                       teknisiTtd:m.TeknisiTTD||'', diinputOleh:m.DiinputOleh||'', dibuatPada:m.DibuatPada||'',
                       dibuatOlehUsername:m.DibuatOlehUsername||'',
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
  document.getElementById('monManOps').value = '';
  // Manager Teknik dipilih dari akun pejabat — tanpa isian nama. Daftarnya
  // sama dengan pemilih "Kirim TTD ke akun" di form lain (pejabatList).
  document.getElementById('monManagerAkun').innerHTML =
    `<option value="">${escapeHtml(T('monPilihManager'))}</option>` +
    pejabatList.map(p=>`<option value="${escapeHtml(p.username)}">${escapeHtml(p.nama)}</option>`).join('');
  monBaris = []; monSeq = 0;
  for(let i=0;i<3;i++) tambahBarisMon();   // mulai dengan beberapa baris kosong
  monTeknisiRows = []; monTeknisiSeq = 0; addMonTeknisi();
  if(monTeknisiRows[0]) monTeknisiRows[0].nama = userSaatIni ? (userSaatIni.nama || userSaatIni.username) : '';
  renderMonTeknisi();
  ['sigMon','sigMonManOps'].forEach(id=>{ if(!sigPads[id]) setupSigCanvas(id); resizeSigCanvas(id); clearSig(id); });
  document.getElementById('monModalBg').classList.add('show');
  setTimeout(()=>['sigMon','sigMonManOps'].forEach(resizeSigCanvas), 60);
}
function closeMonModal(){ document.getElementById('monModalBg').classList.remove('show'); }

async function saveMon(){
  const baris = monBaris
    .map(b=>{ const o={}; KOLOM_MON.forEach(k=>o[k]=(b[k]||'').trim()); return o; })
    .filter(b=>KOLOM_MON.some(k=>b[k]!==''));
  if(baris.length === 0){ toast(T('monKosong')); return; }

  const namaTeknikMon = monTeknisiRows.map(t=>(t.nama||'').trim()).filter(Boolean);
  // QR Manager Operasi memuat nama yang diketik — tanpa nama tidak ada isinya.
  const managerOps = document.getElementById('monManOps').value.trim();
  const managerOpsTtd = getSigDataUrl('sigMonManOps');
  if(managerOpsTtd && !managerOps){ toast(T('monManOpsNamaKosong')); return; }
  // Manager Teknik: akun yang dipilih jadi tujuan TTD, dan namanya yang
  // tercatat di lembar. Dikosongkan boleh — seperti form lain.
  const ttdUntuk = document.getElementById('monManagerAkun').value;
  const managerNama = (pejabatList.find(p=>p.username===ttdUntuk) || {}).nama || '';
  const btn = document.getElementById('monSaveBtn'); btn.disabled = true;
  try{
    const saved = await gsRun('addMonitoring', {
      unit: unitAktif,
      tanggal: document.getElementById('monTanggal').value,
      managerNama, ttdUntuk,
      personilTeknik: namaTeknikMon.join(', '),
      teknisiNamaList: namaTeknikMon,
      managerOps, managerOpsTtd,
      teknisiTtd: getSigDataUrl('sigMon'),
      baris
    });
    await unggahLampiranForm('lfMon', 'monitoring', saved);   // berkas yang dipilih di form (10-lampiran.js)
    monitoring.unshift(mapMon(saved));
    renderMonList();
    closeMonModal();
    toast(T('monTersimpan'));
  }catch(e){ toast(T('gagalSimpan') + ' — ' + (e.message || T('coba'))); }
  btn.disabled = false;
}

let monTampilSemua = false;
function resetCariMon(){ monTampilSemua = true; document.getElementById('cariMonTanggal').value = ''; renderMonList(); }

function renderMonList(){
  const wrap = document.getElementById('monList');
  if(!wrap) return;
  const tgl = (document.getElementById('cariMonTanggal') || {}).value || '';
  const daftar = tgl ? monitoring.filter(m => String(m.tanggal||'').slice(0,10) === tgl)
                     : (monTampilSemua ? monitoring : monitoring.filter(m => dalamSeminggu(m.tanggal)));

  if(monitoring.length === 0){ wrap.innerHTML = '<div class="empty">' + T('belumAdaMon') + '</div>'; return; }
  if(daftar.length === 0){ wrap.innerHTML = '<div class="empty">' + T('takAdaHasil') + '</div>'; return; }

  wrap.innerHTML = daftar.map(m=>`
    <div class="dc-history-item">
      <div><b>${escapeHtml(m.tanggal)}</b> &middot; ${m.baris.length} ${T('barisPengamatanSingkat')}</div>
      <div style="font-size:11.5px;color:var(--muted);">
        ${T('bapbTeknik')}: ${escapeHtml(m.managerNama)||'-'} &middot; ${T('personilTeknik')}: ${escapeHtml(m.personilTeknik)||'-'}
      </div>
      ${diinputOlehHtml(m.diinputOleh, m.dibuatPada, String(m.tanggal||'').slice(0,10))}
      <div style="display:flex;gap:4px;">
        <button class="btn ghost" style="padding:6px 10px;" onclick="openMonDetail('${m.id}')">${T('detail')}</button>
        <button class="icon-btn" title="${T('cetak')}" onclick="printMon('${m.id}')">🖨</button>
        ${bolehHapusLembarForm(m.dibuatOlehUsername, !!m.managerTtd) ? `<button class="icon-btn" title="${T('hapus')}" onclick="hapusMon('${m.id}')">✕</button>` : ''}
      </div>
    </div>`).join('');
}

async function hapusMon(id){
  const m = monitoring.find(x=>x.id===id);
  if(!m || !bolehHapusLembarForm(m.dibuatOlehUsername, !!m.managerTtd)){ toast(T('hanyaPembuatHapus')); return; }
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

/** Lembar lama (sebelum 14 Okt 2026) punya petak Personil Operasi. Form baru
    tidak lagi mengisinya, tapi yang sudah tercatat tetap ditampilkan. */
const monAdaOpsLama = m => !!(m.personilOps || m.personilOpsTtd);

function openMonDetail(id){
  const m = monitoring.find(x=>x.id===id);
  if(!m) return;
  document.getElementById('formDetailJudul').textContent = T('monModal');
  document.getElementById('formDetailBody').innerHTML = `
    <div style="font-size:13px;line-height:1.7;margin-bottom:10px;"><b>${escapeHtml(m.tanggal)}</b></div>
    ${monTabelHtml(m, false)}
    <div class="detail-ttd">
      <div class="sig-block"><b>${T('managerOps')}</b>${escapeHtml(m.managerOps)||'-'}${sigThumbHtml(m.managerOpsTtd)}${bolehUbahManOpsMon(m) ? monManOpsEditBtn(m.id) : ''}</div>
      <div class="sig-block"><b>${T('bapbTeknik')}</b>${renderPihakKedua('monitoring', m.id, m.managerNama, m.managerTtd)}${sigPejabatHtml('monitoring', m.id, m.managerTtd, m)}</div>
      ${monAdaOpsLama(m) ? `<div class="sig-block"><b>${T('personilOps')}</b>${escapeHtml(m.personilOps)||'-'}${sigThumbHtml(m.personilOpsTtd)}</div>` : ''}
      <div class="sig-block"><b>${T('personilTeknik')}</b>${escapeHtml(m.personilTeknik)||'-'}${sigThumbHtml(m.teknisiTtd)}</div>
    </div>
    ${lampiranCatatanHtml('monitoring', m.id)}
    <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line);">${diinputOlehHtml(m.diinputOleh, m.dibuatPada, String(m.tanggal||'').slice(0,10))}</div>`;
  document.getElementById('formDetailPrintBtn').onclick = ()=>{ closeFormDetail(); printMon(id); };
  document.getElementById('formDetailBg').classList.add('show');
}

/* ---------- Sunting susulan TTD Manager Operasi ----------
   Sama dengan TTD Manager Pemakai di BAPB (18b-bapb.js): pembuat lembar (atau
   admin) bisa membubuhkan atau mengganti paraf Manager Operasi belakangan,
   selama Manager Teknik BELUM tanda tangan. Sesudah itu petaknya ikut beku —
   server menjaga hal yang sama (updateMonitoring di db.js). */

function bolehUbahManOpsMon(m){
  if(!m || m.__titipan || m.managerTtd) return false;
  if(typeof kelolaUnitAktif === 'function' && kelolaUnitAktif()) return true;
  return !!(userSaatIni && m.dibuatOlehUsername && userSaatIni.username === m.dibuatOlehUsername);
}

function monManOpsEditBtn(id){
  return `<button class="btn ghost" style="display:block;padding:2px 6px;font-size:11px;margin-top:4px;"
    onclick="openMonManOpsModal('${id}')">${T('bapbUbahTtdPemakai')}</button>`;
}

let monManOpsTargetId = null;

function openMonManOpsModal(id){
  const m = monitoring.find(x=>x.id===id);
  if(!m) return;
  monManOpsTargetId = id;
  document.getElementById('monManOpsEditNama').value = m.managerOps || '';
  const sig = 'sigMonManOpsEdit';
  if(!sigPads[sig]) setupSigCanvas(sig);
  resizeSigCanvas(sig); clearSig(sig);
  document.getElementById('monManOpsBg').classList.add('show');
  setTimeout(()=>resizeSigCanvas(sig), 60);
}

function closeMonManOpsModal(){
  document.getElementById('monManOpsBg').classList.remove('show');
  monManOpsTargetId = null;
}

async function simpanMonManOps(){
  if(!monManOpsTargetId) return;
  const id = monManOpsTargetId;
  const nama = document.getElementById('monManOpsEditNama').value.trim();
  // TTD baru kalau tombolnya ditekan; kalau tidak, biarkan yang lama.
  const ttdBaru = getSigDataUrl('sigMonManOpsEdit');
  if(ttdBaru && !nama){ toast(T('monManOpsNamaKosong')); return; }
  const patch = { managerOps: nama };
  if(ttdBaru) patch.managerOpsTtd = ttdBaru;
  const btn = document.getElementById('monManOpsSaveBtn'); btn.disabled = true;
  try{
    const saved = await gsRun('updateMonitoring', id, patch);
    const i = monitoring.findIndex(x=>x.id===id);
    if(i >= 0) monitoring[i] = mapMon(saved);
    renderMonList();
    closeMonManOpsModal();
    // Buka lagi detailnya supaya hasilnya langsung terlihat di tempat yang sama.
    openMonDetail(id);
    toast(T('monTersimpan'));
  }catch(e){ toast(T('gagalSimpan') + ' — ' + (e.message || T('coba'))); }
  btn.disabled = false;
}

function printMon(id){
  const m = monitoring.find(x=>x.id===id);
  if(!m) return;
  // Boleh dicetak sebelum Manager Operasi / Manager Teknik TTD — kolom TTD-nya
  // keluar kosong. Tiga kolom seperti BAPB: Manager Operasi · Manager Teknik ·
  // Personil Teknik. Lembar lama yang punya Personil Operasi mendapat kolomnya.
  const kolom = [
    ['Mengetahui,', 'Manager Operasi', m.managerOpsTtd, m.managerOps],
    ['Mengetahui / Menyetujui,', 'Manager Teknik', m.managerTtd, m.managerNama],
    ...(monAdaOpsLama(m) ? [['&nbsp;', 'Personil Operasi', m.personilOpsTtd, m.personilOps]] : []),
    ['&nbsp;', 'Personil Teknik', m.teknisiTtd, m.personilTeknik]
  ];
  const lebar = Math.floor(100 / kolom.length);
  const ttdKolom = kolom.map(([atas, jabatan, ttd, nama]) => `
        <td style="width:${lebar}%;text-align:center;vertical-align:top;">
          <div>${atas}</div>
          <div>${jabatan}</div>
          <div style="height:46px;">${ttdImg(ttd, 40)}</div>
          <div style="border-top:1px solid #000;display:inline-block;min-width:150px;padding:0 10px;">${ttd ? (escapeHtml(nama)||'&nbsp;') : '&nbsp;'}</div>
        </td>`).join('');
  doPrint(`
    <div style="text-align:center;font-weight:bold;font-size:12pt;margin-bottom:4px;">MONITORING FREKUENSI NEW JATSC</div>
    <div style="text-align:center;font-size:9pt;margin-bottom:10px;">TANGGAL : ${escapeHtml(m.tanggal)}</div>
    ${monTabelHtml(m, true)}
    <table class="no-border" style="font-size:9pt;margin-top:16px;break-inside:avoid;">
      <tr>${ttdKolom}
      </tr>
    </table>`, 'landscape');
}
