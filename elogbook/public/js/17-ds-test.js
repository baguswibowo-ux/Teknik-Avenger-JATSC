/* E-Logbook · js/17-ds-test.js — Tab DS Test: site domestik/internasional, incoming & outgoing
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh. */

/* ============== TAB — DS TEST ==============
   Daftar site-nya tetap dan datang dari server, jadi menambah site cukup di
   ds-site.js. Tiap site dinilai INCOMING dan OUTGOING, dengan keterangan
   bebas — di lembar aslinya kolom itu diisi tanggal uji atau catatan seperti
   "No Answer" dan "suara kecil".

   Kategorinya juga datang dari server, dan pilihan di modal dibangun dari
   daftar itu — menambah blok baru di ds-site.js tidak perlu menyentuh berkas
   ini, cukup menambah labelnya di 02-bahasa.js. Selain domestik, blok-bloknya
   di lembar aslinya tidak punya kolom SITE, jadi kolom itu disembunyikan untuk
   kategori yang seluruh site-nya kosong. */

let dsSiteSemua = {};
let dsKategoriUrut = ['domestik', 'internasional', 'sli-gsm', 'pabx'];
let dsKategori = 'domestik';
let dsState = {};

/** Daftar site untuk kategori yang sedang dipilih. */
const dsSiteAktif = () => dsSiteSemua[dsKategori] || [];
const dsSiteUntuk = (kategori) => dsSiteSemua[kategori || 'domestik'] || [];

/** Label kategori; kunci yang belum punya terjemahan tampil apa adanya. */
const dsLabelKategori = (kategori) => T('dsKat_' + (kategori || 'domestik'));

/** Kategori yang tak satu pun barisnya bersite tidak perlu kolom SITE. */
const dsPakaiSite = (kategori) => dsSiteUntuk(kategori).some(s => s.site);

/* Kode site pernah berubah nama (PNK 3 → PNK FIC, MDN 2 → MDN FIC,
   PGK → PGK TWR). Hasil DS Test tersimpan berkunci kode, jadi catatan lama
   dicari lewat alias — tanpa ini nilainya terbaca kosong dan tampil ✓. */
function dsAmbilState(state, s){
  if(!state) return {};
  if(state[s.code]) return state[s.code];
  for(const lama of (s.alias || [])) if(state[lama]) return state[lama];
  return {};
}

let dsTeknisiRows = [];
let dsTeknisiSeq = 0;

const mapDs = d => ({ id:d.ID, tanggal:d.Tanggal, state:d.State||{}, kategori:d.Kategori||'domestik',
                      managerNama:d.ManagerNama||'', managerTtd:d.ManagerTTD||'',
                      teknisiNama:d.TeknisiNama||'', teknisiNamaList:d.TeknisiNamaListJSON||[],
                      teknisiTtd:d.TeknisiTTD||'', diinputOleh:d.DiinputOleh||'', dibuatPada:d.DibuatPada||'',
                      ttdOleh:d.TtdOleh||'', ttdPada:d.TtdPada||'', ttdUntuk:d.TtdUntuk||'' });

function initDsState(){
  dsState = {};
  dsSiteAktif().forEach(s=>{ dsState[s.code] = { in:'ok', out:'ok', vin:'', vout:'', ket:'' }; });
}

/** Isi pilihan kategori dari daftar yang dikirim server. */
function isiPilihanKategoriDs(){
  const sel = document.getElementById('dsKategori');
  if(!sel) return;
  const sebelumnya = sel.value || dsKategori;
  // data-t dipasang supaya terapkanBahasa() ikut menerjemahkannya saat
  // bahasa diganti, tanpa perlu membangun ulang pilihannya.
  sel.innerHTML = dsKategoriUrut.map(k =>
    `<option value="${escapeHtml(k)}" data-t="dsKat_${escapeHtml(k)}">${escapeHtml(dsLabelKategori(k))}</option>`).join('');
  sel.value = dsKategoriUrut.includes(sebelumnya) ? sebelumnya : dsKategoriUrut[0];
  dsKategori = sel.value;
}

/** Ganti kategori: daftar site dan seluruh isian ikut berganti. */
function gantiKategoriDs(){
  dsKategori = document.getElementById('dsKategori').value;
  initDsState();
  renderDsTable();
  const kosong = dsSiteAktif().length === 0;
  document.getElementById('dsKosongNote').style.display = kosong ? '' : 'none';
  document.getElementById('dsSaveBtn').disabled = kosong;
}
/* ok (dilakukan, normal) -> fail (dilakukan, NOT OK) -> minus (tidak
   dilakukan pengecekan) -> kembali ke ok. */
const DS_STATUS_URUT = { ok:'fail', fail:'minus', minus:'ok' };
const DS_STATUS_SIMBOL = { ok:'✓', fail:'✕', minus:'−' };

function toggleDs(code, kolom){
  const b = dsState[code]; if(!b) return;
  b[kolom] = DS_STATUS_URUT[b[kolom]] || 'ok';
  renderDsTable();
}
function setDsKet(code, nilai){ if(dsState[code]) dsState[code].ket = nilai; }
/* Voltage disimpan apa adanya sebagai teks, tidak dibulatkan atau divalidasi:
   yang diketik teknisi adalah angka yang terbaca di alat, dan lembar ini
   merekam pembacaan itu — bukan menilainya. */
function setDsVolt(code, kolom, nilai){ if(dsState[code]) dsState[code][kolom] = nilai; }

/* Kepala tabel DS, dipakai bersama oleh form, detail, dan cetakan.

   Jendelanya selebar layar, jadi lebar kolom perlu diarahkan: tanpa itu sisa
   ruangnya dibagi rata dan kolom INCOMING/OUTGOING ikut melar sampai ratusan
   piksel — tombolnya tetap 28px dan berdiri sendirian jauh dari kode
   salurannya, sehingga mata sulit melacak sedang menilai baris yang mana.
   Dua kolom status dipatok sempit, dan sisa ruang dialirkan ke KETERANGAN
   yang memang diisi tulisan bebas. Ukuran cetak diatur 09-cetak.css. */
function dsTheadHtml(kategori, cetak){
  const t = cetak ? 'td' : 'th';
  const kelas = cetak ? ' class="p-kepala"' : '';
  const lebarNo  = cetak ? '' : ' style="width:34px;"';
  const lebarKet = cetak ? '' : ' style="width:26%;"';
  const lebarSt  = cetak ? '' : ' style="width:82px;"';
  const lebarV   = cetak ? '' : ' style="width:76px;"';
  const site = dsPakaiSite(kategori) ? `<${t} rowspan="2">SITE</${t}>` : '';
  return `<tr${kelas}><${t} rowspan="2"${lebarNo}>NO</${t}>${site}<${t} rowspan="2">CODE</${t}>
      <${t} colspan="2">NEW JATSC</${t}><${t} colspan="2">VOLTAGE</${t}><${t} rowspan="2"${lebarKet}>KETERANGAN</${t}></tr>
    <tr${kelas}><${t}${lebarSt}>INCOMING</${t}><${t}${lebarSt}>OUTGOING</${t}>
      <${t}${lebarV}>INCOMING</${t}><${t}${lebarV}>OUTGOING</${t}></tr>`;
}

function renderDsTable(){
  const body = document.getElementById('dsBody');
  if(!body) return;
  const head = document.getElementById('dsThead');
  if(head) head.innerHTML = dsTheadHtml(dsKategori, false);
  const pakaiSite = dsPakaiSite(dsKategori);
  const sel = (code, kolom) => {
    const s = (dsState[code] || {})[kolom] || 'ok';
    return `<td><button class="status-btn ${s}" onclick="toggleDs('${code}','${kolom}')">${DS_STATUS_SIMBOL[s]}</button></td>`;
  };
  /* Angka bebas: sebagian alat membaca desimal, sebagian bulat, dan sebagian
     site memang tidak punya pembacaan sama sekali. step="any" supaya peramban
     tidak menolak koma, dan kosong tetap sah. */
  const volt = (code, kolom) => `<td><input type="number" step="any" class="rk-ket" style="text-align:right;"
                 value="${escapeHtml((dsState[code]||{})[kolom]||'')}" placeholder="–"
                 oninput="setDsVolt('${code}','${kolom}', this.value)"></td>`;
  body.innerHTML = dsSiteAktif().map(s=>`
    <tr>
      <td>${s.no}</td>
      ${pakaiSite ? `<td class="rk-nama">${escapeHtml(s.site)}</td>` : ''}
      <td class="rk-frek">${escapeHtml(s.code)}</td>
      ${sel(s.code,'in')}${sel(s.code,'out')}
      ${volt(s.code,'vin')}${volt(s.code,'vout')}
      <td><input type="text" class="rk-ket" value="${escapeHtml((dsState[s.code]||{}).ket||'')}"
                 onchange="setDsKet('${s.code}', this.value)"></td>
    </tr>`).join('');
}

function renderDsTeknisi(){
  const wrap = document.getElementById('dsTeknisiList');
  wrap.innerHTML = dsTeknisiRows.map((t,i)=>`
    <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;">
      <span style="font-family:var(--font-mono);color:var(--accent);font-size:12px;min-width:18px;">${i+1}.</span>
      <input type="text" value="${escapeHtml(t.nama)}" placeholder="${T('namaTeknisiPelaksana')} ${i+1}"
             oninput="dsTeknisiRows[${i}].nama=this.value"
             style="flex:1;background:var(--panel-2);border:1px solid var(--line);color:var(--text);border-radius:6px;padding:9px 10px;font-size:16px;">
      ${dsTeknisiRows.length>1 ? `<button class="icon-btn" onclick="hapusDsTeknisi('${t.key}')">✕</button>` : ''}
    </div>`).join('');
}
function addDsTeknisi(){ dsTeknisiRows.push({key:'d'+(dsTeknisiSeq++), nama:''}); renderDsTeknisi(); }
function hapusDsTeknisi(key){ dsTeknisiRows = dsTeknisiRows.filter(x=>x.key!==key); renderDsTeknisi(); }

function openDsModal(){
  document.getElementById('dsTanggal').value = tanggalHariIni();
  document.getElementById('dsKategori').value = dsKategori;
  document.getElementById('dsManagerNama').value = '';
  document.getElementById('dsManagerAkun').value = '';
  dsTeknisiRows = []; dsTeknisiSeq = 0; addDsTeknisi();
  ['sigDs'].forEach(id=>{ if(!sigPads[id]) setupSigCanvas(id); resizeSigCanvas(id); clearSig(id); });
  gantiKategoriDs();
  document.getElementById('dsModalBg').classList.add('show');
  setTimeout(()=>['sigDs'].forEach(resizeSigCanvas), 60);
}
function closeDsModal(){ document.getElementById('dsModalBg').classList.remove('show'); }

async function saveDs(){
  const btn = document.getElementById('dsSaveBtn'); btn.disabled = true;
  try{
    const saved = await gsRun('addDsTest', {
      unit: unitAktif,
      kategori: dsKategori,
      tanggal: document.getElementById('dsTanggal').value,
      state: dsState,
      teknisiNamaList: dsTeknisiRows.map(t=>(t.nama||'').trim()).filter(Boolean),
      teknisiTtd: getSigDataUrl('sigDs'),
      managerNama: document.getElementById('dsManagerNama').value.trim(),
      ttdUntuk: ttdUntukTerpilih('dsManagerAkun', document.getElementById('dsManagerNama').value)
    });
    dsList.unshift(mapDs(saved));
    renderDsList();
    closeDsModal();
    toast(T('dsTersimpan'));
  }catch(e){ toast(T('gagalSimpan') + ' — ' + (e.message || T('coba'))); }
  btn.disabled = false;
}

function resetCariDs(){ document.getElementById('cariDsTanggal').value = ''; renderDsList(); }

/** Ringkasan berapa site yang tidak lolos, supaya tidak perlu menyisir
    seluruh baris — domestik saja sudah 34. Yang dihitung cuma yang NOT OK;
    baris yang sengaja tidak dicek (−) bukan temuan. */
function dsTemuan(state, kategori){
  return dsSiteUntuk(kategori).filter(s=>{
    const b = dsAmbilState(state, s);
    return b.in === 'fail' || b.out === 'fail';
  }).map(s=>s.code);
}

function renderDsList(){
  const wrap = document.getElementById('dsList');
  if(!wrap) return;
  const tgl = (document.getElementById('cariDsTanggal') || {}).value || '';
  const daftar = tgl ? dsList.filter(d=>String(d.tanggal||'').slice(0,10) === tgl) : dsList;

  if(dsList.length === 0){ wrap.innerHTML = '<div class="empty">' + T('belumAdaDs') + '</div>'; return; }
  if(daftar.length === 0){ wrap.innerHTML = '<div class="empty">' + T('takAdaHasil') + '</div>'; return; }

  wrap.innerHTML = daftar.map(d=>{
    const gagal = dsTemuan(d.state, d.kategori);
    return `<div class="dc-history-item">
      <div><b>${escapeHtml(d.tanggal)}</b> &middot; ${escapeHtml(dsLabelKategori(d.kategori))}</div>
      <span class="tag ${gagal.length ? 'fail' : 'ok'}">${gagal.length ? gagal.length + ' ' + T('siteBermasalah') : T('semuaLolos')}</span>
      <div style="font-size:11.5px;color:var(--muted);">${T('teknisiPelaksana')}: ${escapeHtml(d.teknisiNama)||'-'}</div>
      ${diinputOlehHtml(d.diinputOleh, d.dibuatPada, String(d.tanggal||'').slice(0,10))}
      <div style="display:flex;gap:4px;">
        <button class="btn ghost" style="padding:6px 10px;" onclick="openDsDetail('${d.id}')">${T('detail')}</button>
        <button class="icon-btn" title="${T('cetak')}" onclick="printDs('${d.id}')">🖨</button>
        <button class="icon-btn hanya-admin" title="${T('hapus')}" onclick="hapusDs('${d.id}')">✕</button>
      </div>
    </div>`;
  }).join('');
}

async function hapusDs(id){
  if(!adminAktif()){ toast(T('hanyaAdminHapus')); return; }
  const d = dsList.find(x=>x.id===id);
  if(!confirm(`${T('konfirmasiHapus')} ${d ? d.tanggal : ''}?`)) return;
  const salinan = dsList.slice();
  dsList = dsList.filter(x=>x.id!==id);
  renderDsList();
  try{ await gsRun('deleteDsTest', id); }
  catch(e){ dsList = salinan; renderDsList(); toast(T('gagalHapus') + ' — ' + (e.message||T('coba'))); }
}

function dsTabelBaca(state, cetak, kategori){
  const sym = s => DS_STATUS_SIMBOL[s] || DS_STATUS_SIMBOL.ok;
  const kelasCetak = { ok:'p-ok', fail:'p-fail', minus:'p-minus' };
  const sel = s => cetak
    ? `<td style="text-align:center;"><span class="${kelasCetak[s] || 'p-ok'}">${sym(s)}</span></td>`
    : `<td><span class="status-btn ${s === 'fail' || s === 'minus' ? s : 'ok'}" style="cursor:default;">${sym(s)}</span></td>`;
  const pakaiSite = dsPakaiSite(kategori);
  /* Catatan sebelum kolom voltage ada tidak menyimpan vin/vout sama sekali.
     Yang kosong tampil sebagai "–", bukan "0": lembar lama memang tidak pernah
     mengukurnya, dan menuliskan angka di situ akan mengarang pembacaan. */
  const volt = (nilai) => `<td style="text-align:right;white-space:nowrap;">${escapeHtml(String(nilai ?? '').trim() || '–')}</td>`;
  const baris = dsSiteUntuk(kategori).map(s=>{
    const b = dsAmbilState(state, s);
    return `<tr><td style="text-align:center;">${s.no}</td>
      ${pakaiSite ? `<td style="text-align:left;">${escapeHtml(s.site)}</td>` : ''}
      <td style="text-align:left;">${escapeHtml(s.code)}</td>
      ${sel(b.in||'ok')}${sel(b.out||'ok')}
      ${volt(b.vin)}${volt(b.vout)}
      <td style="text-align:left;font-size:${cetak?'7.5pt':'11px'};">${escapeHtml(b.ket||'')}</td></tr>`;
  }).join('');
  const tabel = `<table class="${cetak?'':'dc ds'}" style="font-size:${cetak?'8pt':''};">
    <thead>${dsTheadHtml(kategori, cetak)}</thead><tbody>${baris}</tbody></table>`;
  return cetak ? tabel : `<div class="dc-table-wrap">${tabel}</div>`;
}

function openDsDetail(id){
  const d = dsList.find(x=>x.id===id);
  if(!d) return;
  document.getElementById('formDetailJudul').textContent = T('dsModal');
  document.getElementById('formDetailBody').innerHTML = `
    <div style="font-size:13px;line-height:1.7;margin-bottom:10px;"><b>${escapeHtml(d.tanggal)}</b> &middot; ${escapeHtml(dsLabelKategori(d.kategori))}</div>
    ${dsTabelBaca(d.state, false, d.kategori)}
    <div class="detail-ttd">
      <div class="sig-block"><b>${T('teknisiPelaksana')}</b>${escapeHtml(d.teknisiNama)||'-'}${sigThumbHtml(d.teknisiTtd)}</div>
      <div class="sig-block"><b>${T('mengetahuiManager')}</b>${escapeHtml(d.managerNama)||'-'}${sigPejabatHtml('dstest', d.id, d.managerTtd, d)}</div>
    </div>
    <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line);">${diinputOlehHtml(d.diinputOleh, d.dibuatPada, String(d.tanggal||'').slice(0,10))}</div>`;
  document.getElementById('formDetailPrintBtn').onclick = ()=>{ closeFormDetail(); printDs(id); };
  document.getElementById('formDetailBg').classList.add('show');
}

/* Judul cetakan mengikuti kepala blok di lembar Alokasi Komunikasi, dan
   tetap berbahasa lembar itu berapa pun bahasa antarmuka yang aktif. */
const DS_JUDUL_CETAK = {
  domestik:      'DS DOMESTIC NEW JATSC',
  internasional: 'DS INTERNATIONAL NEW JATSC',
  'sli-gsm':     'SLI & GSM NEW JATSC',
  pabx:          'PABX NEW JATSC'
};

function printDs(id){
  const d = dsList.find(x=>x.id===id);
  if(!d) return;
  const nama = (d.teknisiNamaList && d.teknisiNamaList.length) ? d.teknisiNamaList : [d.teknisiNama || ''];
  const judul = DS_JUDUL_CETAK[d.kategori] || DS_JUDUL_CETAK.domestik;
  doPrint(`
    <div style="text-align:center;font-weight:bold;font-size:12pt;margin-bottom:4px;">${escapeHtml(judul)}</div>
    <div style="text-align:center;font-size:9pt;margin-bottom:10px;">TANGGAL : ${escapeHtml(d.tanggal)}</div>
    ${dsTabelBaca(d.state, true, d.kategori)}
    <div style="font-size:8.5pt;margin-top:8px;"><b>NB :</b> ✓ : OK &nbsp;&nbsp; ✕ : NOT OK &nbsp;&nbsp; − : TIDAK DICEK</div>
    <table class="no-border" style="font-size:9pt;margin-top:14px;">
      <tr>
        <td style="width:55%;text-align:center;vertical-align:top;">
          <div style="margin-bottom:6px;">TEKNISI PELAKSANA :</div>
          ${nama.map((n,i)=>`<div>${i+1}. ${escapeHtml(n) || '______________________'}</div>`).join('')}
          <div style="height:40px;margin-top:4px;">${ttdImg(d.teknisiTtd, 34)}</div>
        </td>
        <td style="text-align:center;vertical-align:top;">
          <div>Mengetahui,</div>
          <div style="margin-bottom:4px;">Manager Teknik</div>
          <div style="height:46px;">${ttdImg(d.managerTtd, 40)}</div>
          <div style="border-top:1px solid #000;display:inline-block;padding:0 24px;">${escapeHtml(d.managerNama)||'&nbsp;'}</div>
        </td>
      </tr>
    </table>`, 'landscape');
}
