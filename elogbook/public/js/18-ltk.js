/* E-Logbook · js/18-ltk.js — Tab LTK — Laporan Kerusakan, pencarian, dan lampirannya
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh. */

/* ============== TAB — LTK ============== */

const mapLtk = l => ({ id:l.ID, lampiran:l.Lampiran||[], tanggalLapor:l.TanggalLapor, penyelenggara:l.Penyelenggara,
  kelompok:l.Kelompok, peralatan:l.Peralatan, modul:l.Modul, analisa:l.Analisa, perbaikan:l.Perbaikan,
  tanggalRusak:l.TanggalRusak, jamRusak:l.JamRusak, tanggalSelesai:l.TanggalSelesai, jamSelesai:l.JamSelesai,
  jamTerputus:l.JamTerputus, kota:l.Kota, managerNama:l.ManagerNama, managerTtd:l.ManagerTTD,
  teknisiNama:l.TeknisiNama, teknisiTtd:l.TeknisiTTD, diinputOleh:l.DiinputOleh||'', dibuatPada:l.DibuatPada||'',
  ttdOleh:l.TtdOleh||'', ttdPada:l.TtdPada||'', ttdUntuk:l.TtdUntuk||'' });

function openLtkModal(){
  const u = infoUnit() || {};
  document.getElementById('ltkTanggalLapor').value = tanggalHariIni();
  document.getElementById('ltkKota').value = 'Tangerang';
  document.getElementById('ltkPenyelenggara').value = u.ltkPenyelenggara || '';
  document.getElementById('ltkKelompok').value = u.ltkKelompok || '';
  document.getElementById('ltkPeralatan').value = u.ltkPeralatan || '';
  ['ltkModul','ltkAnalisa','ltkPerbaikan','ltkTanggalRusak','ltkJamRusak',
   'ltkTanggalSelesai','ltkJamSelesai','ltkJamTerputus','ltkManagerNama','ltkManagerAkun'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('ltkTeknisiNama').value = userSaatIni ? (userSaatIni.nama || userSaatIni.username) : '';
  resetLampiran('ltkLampiran');
  ['sigLtkTeknisi'].forEach(id=>{
    if(!sigPads[id]) setupSigCanvas(id);
    resizeSigCanvas(id); clearSig(id);
  });
  document.getElementById('ltkModalBg').classList.add('show');
  setTimeout(()=>['sigLtkTeknisi'].forEach(resizeSigCanvas), 60);
}
function closeLtkModal(){ document.getElementById('ltkModalBg').classList.remove('show'); }

async function saveLtk(){
  const v = id => document.getElementById(id).value.trim();
  if(!v('ltkPeralatan')){ toast(T('ltkPeralatanKosong')); return; }
  const btn = document.getElementById('ltkSaveBtn'); btn.disabled = true;
  try{
    const saved = await gsRun('addLtk', {
      unit: unitAktif,
      tanggalLapor: v('ltkTanggalLapor'), kota: v('ltkKota'),
      penyelenggara: v('ltkPenyelenggara'), kelompok: v('ltkKelompok'),
      peralatan: v('ltkPeralatan'), modul: v('ltkModul'),
      analisa: v('ltkAnalisa'), perbaikan: v('ltkPerbaikan'),
      tanggalRusak: v('ltkTanggalRusak'), jamRusak: v('ltkJamRusak'),
      tanggalSelesai: v('ltkTanggalSelesai'), jamSelesai: v('ltkJamSelesai'),
      jamTerputus: v('ltkJamTerputus'),
      lampiran: kirimLampiran('ltkLampiran'),
      managerNama: v('ltkManagerNama'),
      ttdUntuk: ttdUntukTerpilih('ltkManagerAkun', v('ltkManagerNama')),
      teknisiNama: v('ltkTeknisiNama'), teknisiTtd: getSigDataUrl('sigLtkTeknisi')
    });
    ltkList.unshift(mapLtk(saved));
    renderLtkList();
    closeLtkModal();
    toast(T('ltkTersimpan'));
  }catch(e){ toast(T('gagalSimpan') + ' — ' + (e.message || T('coba'))); }
  btn.disabled = false;
}

let ltkTampilSemua = false;
function resetCariLtk(){
  ltkTampilSemua = true;
  ['cariLtkKata','cariLtkDari','cariLtkSampai','cariLtkStatus'].forEach(id=>{
    const el = document.getElementById(id); if(el) el.value = '';
  });
  renderLtkList();
}

/** Saring LTK: kata kunci pada peralatan/modul/analisa, rentang tanggal pelaporan, dan status. */
function saringLtk(){
  const nilai = id => ((document.getElementById(id) || {}).value || '').trim();
  const kata = nilai('cariLtkKata').toLowerCase();
  const dari = nilai('cariLtkDari'), sampai = nilai('cariLtkSampai'), status = nilai('cariLtkStatus');
  const adaFilter = !!(kata || dari || sampai || status);

  const hasil = ltkList.filter(l=>{
    if(kata){
      const cakupan = [l.peralatan, l.modul, l.analisa].join(' ').toLowerCase();
      // Semua kata harus ada, urutannya bebas — "processor vhf" tetap ketemu.
      if(!kata.split(/\s+/).every(k=>cakupan.includes(k))) return false;
    }
    const d = String(l.tanggalLapor || '').slice(0,10);
    if(dari && (!d || d < dari)) return false;
    if(sampai && (!d || d > sampai)) return false;
    if(status === 'selesai' && !l.tanggalSelesai) return false;
    if(status === 'belum' && l.tanggalSelesai) return false;
    return true;
  });
  // Tanpa filter apa pun: default seminggu terakhir (pakai Tanggal Pelaporan).
  if(!adaFilter && !ltkTampilSemua) return hasil.filter(l => dalamSeminggu(l.tanggalLapor));
  return hasil;
}

function renderLtkList(){
  const wrap = document.getElementById('ltkList');
  if(!wrap) return;
  if(ltkList.length === 0){ wrap.innerHTML = '<div class="empty">' + T('belumAdaLtk') + '</div>'; return; }
  const daftar = saringLtk();
  if(daftar.length === 0){ wrap.innerHTML = '<div class="empty">' + T('takAdaHasil') + '</div>'; return; }
  wrap.innerHTML = daftar.map(l=>{
    const selesai = !!(l.tanggalSelesai);
    return `<div class="dc-history-item">
      <div><b>${escapeHtml(l.peralatan)||'-'}</b>${l.modul ? ' — ' + escapeHtml(l.modul) : ''}</div>
      <span class="tag ${selesai?'ok':'fail'}">${selesai ? T('ltkSelesai') : T('ltkBelumSelesai')}</span>
      <div style="font-size:11.5px;color:var(--muted);">
        ${T('tanggalPelaporan')}: ${escapeHtml(l.tanggalLapor)||'-'}
        ${l.tanggalRusak ? ' &middot; ' + T('tanggalRusak') + ': ' + escapeHtml(l.tanggalRusak) : ''}
      </div>
      ${diinputOlehHtml(l.diinputOleh, l.dibuatPada, String(l.tanggalLapor||'').slice(0,10))}
      <div style="display:flex;gap:4px;">
        <button class="btn ghost" style="padding:6px 10px;" onclick="openLtkDetail('${l.id}')">${T('detail')}</button>
        <button class="icon-btn" title="${T('cetak')}" onclick="printLtk('${l.id}')">🖨</button>
        <button class="icon-btn hanya-admin" title="${T('hapus')}" onclick="hapusLtk('${l.id}')">✕</button>
      </div>
    </div>`;
  }).join('');
}

async function hapusLtk(id){
  if(!adminAktif()){ toast(T('hanyaAdminHapus')); return; }
  const l = ltkList.find(x=>x.id===id);
  if(!confirm(`${T('konfirmasiHapus')} ${l ? l.peralatan : ''}?`)) return;
  const salinan = ltkList.slice();
  ltkList = ltkList.filter(x=>x.id!==id);
  renderLtkList();
  try{ await gsRun('deleteLtk', id); }
  catch(e){ ltkList = salinan; renderLtkList(); toast(T('gagalHapus') + ' — ' + (e.message||T('coba'))); }
}

/** Baris uraian LTK, dipakai modal detail maupun cetak. */
function ltkBarisHtml(l, cetak){
  const gaya = cetak ? 'font-size:9pt;' : 'font-size:13px;';
  const b = (no, uraian, data) => `<tr>
    <td style="width:34px;text-align:center;${gaya}">${no}</td>
    <td style="${gaya}${cetak?'':'color:var(--muted);'}width:38%;">${uraian}</td>
    <td style="${gaya}white-space:pre-wrap;">${data || '&nbsp;'}</td></tr>`;
  // Butir 8 dan 9 punya dua baris: tanggal dulu, jamnya di baris bawahnya —
  // persis seperti form aslinya, dan baris jam tidak diberi nomor sendiri.
  const bJam = (uraian, jm) => `<tr>
    <td style="${gaya}"></td>
    <td style="${gaya}${cetak?'':'color:var(--muted);'}">${uraian}</td>
    <td style="${gaya}">${escapeHtml(jm) ? escapeHtml(jm) + ' UTC' : 'UTC'}</td></tr>`;

  return `
    <table style="${cetak?'':'width:100%;'}">
      <thead><tr class="p-kepala"><td style="text-align:center;${gaya}"><b>NO.</b></td><td style="${gaya}"><b>URAIAN</b></td><td style="${gaya}"><b>DATA</b></td></tr></thead>
      <tbody>
        ${b(1,'Tanggal Pelaporan', escapeHtml(l.tanggalLapor))}
        ${b(2,'Penyelenggara Pelayanan', escapeHtml(l.penyelenggara))}
        ${b(3,'Kelompok Fasilitas', escapeHtml(l.kelompok))}
        ${b(4,'Nama Peralatan', escapeHtml(l.peralatan))}
        ${b(5,'Bagian / Modul yang rusak', escapeHtml(l.modul))}
        ${b(6,'Analisa Terjadinya Kerusakan', escapeHtml(l.analisa))}
        ${b(7,'Kegiatan Perbaikan / Tindak Lanjut', escapeHtml(l.perbaikan))}
        ${b(8,'Tanggal Terjadi Kerusakan', escapeHtml(l.tanggalRusak))}
        ${bJam('Jam Terjadi Kerusakan', l.jamRusak)}
        ${b(9,'Tanggal Selesai Perbaikan', escapeHtml(l.tanggalSelesai))}
        ${bJam('Jam Selesai Perbaikan', l.jamSelesai)}
        ${b(10,'Jumlah Jam Operasional Terputus', escapeHtml(l.jamTerputus))}
      </tbody>
    </table>`;
}

function openLtkDetail(id){
  const l = ltkList.find(x=>x.id===id);
  if(!l) return;
  document.getElementById('formDetailJudul').textContent = T('ltkModal');
  document.getElementById('formDetailBody').innerHTML = `
    ${ltkBarisHtml(l, false)}
    ${lampiranGaleriHtml(l.lampiran)}
    <div class="detail-ttd">
      <div class="sig-block"><b>${T('teknisiTelekom')}</b>${escapeHtml(l.teknisiNama)||'-'}${sigThumbHtml(l.teknisiTtd)}</div>
      <div class="sig-block"><b>${T('managerTeknik1')}</b>${renderPihakKedua('ltk', l.id, l.managerNama, l.managerTtd)}${sigPejabatHtml('ltk', l.id, l.managerTtd, l)}</div>
    </div>
    <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line);">${diinputOlehHtml(l.diinputOleh, l.dibuatPada, String(l.tanggalLapor||'').slice(0,10))}</div>`;
  document.getElementById('formDetailPrintBtn').onclick = ()=>{ closeFormDetail(); printLtk(id); };
  document.getElementById('formDetailBg').classList.add('show');
}

function printLtk(id){
  const l = ltkList.find(x=>x.id===id);
  if(!l) return;
  if(!tolakCetakBilaBelumTtd(l, 'ltk')) return;
  doPrint(`
    <div style="text-align:center;font-weight:bold;font-size:12pt;">LAPORAN TERJADINYA KERUSAKAN DAN KEGIATAN PERBAIKAN</div>
    <div style="text-align:center;font-weight:bold;font-size:11pt;margin-bottom:10px;">FASILITAS TELEKOMUNIKASI PENERBANGAN</div>
    ${ltkBarisHtml(l, true)}
    ${lampiranPrintHtml(l.lampiran, 'LAMPIRAN')}
    <table class="no-border" style="font-size:9pt;margin-top:18px;">
      <tr>
        <td style="width:50%;text-align:center;vertical-align:top;">
          <div>Mengetahui,</div>
          <div style="margin-bottom:4px;">Manager Teknik 1</div>
          <div style="height:48px;">${ttdImg(l.managerTtd, 42)}</div>
          <div style="border-top:1px solid #000;display:inline-block;padding:0 24px;">${l.managerTtd ? (escapeHtml(l.managerNama)||'&nbsp;') : '&nbsp;'}</div>
        </td>
        <td style="text-align:center;vertical-align:top;">
          <div>${escapeHtml(l.kota)||'Tangerang'}, ${escapeHtml(l.tanggalLapor)}</div>
          <div style="margin-bottom:4px;">Teknisi Telekomunikasi</div>
          <div style="height:48px;">${ttdImg(l.teknisiTtd, 42)}</div>
          <div style="border-top:1px solid #000;display:inline-block;padding:0 24px;">${l.teknisiTtd ? (escapeHtml(l.teknisiNama)||'&nbsp;') : '&nbsp;'}</div>
        </td>
      </tr>
    </table>`, 'landscape');
}

function closeFormDetail(){ document.getElementById('formDetailBg').classList.remove('show'); }
