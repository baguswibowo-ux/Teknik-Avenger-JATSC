/* E-Logbook · js/17c-radio.js — Sub-tab MAINTENANCE RADIO: sampling 7 sesi (67 radio)
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh.

   Bentuknya persis DS Test, tapi objeknya radio/frequency, bukan channel DS.
   Form-nya mengikuti workbook "Checklist Maintenance channel Radio v2.xlsx":
   67 radio (sheet DATABASE RADIO) dibagi ke 7 sesi selang-seling supaya tiap
   radio tersentuh persis sekali per siklus, tanpa duplikat:

     Sesi ganjil (1,3,5,7): 10 radio
     Sesi genap  (2,4,6)  :  9 radio
     → 4×10 + 3×9 = 67 radio, habis dalam satu siklus 7 sesi.

   Kolom baris — ikut sheet CHECKLIST RADIO:
     No · Radio / Frequency Sampling · Voltage PTT Standby (VDC) ·
     Voltage PTT Aktif (VDC) · Indikasi PTT (otomatis) · Power RX (dB) ·
     Power TX (dB) · Hasil · Remark

   Ambang PTT (dari sheet PANDUAN): Standby 5–60 VDC, Aktif 0–40 VDC. Indikasi
   "Normal" hanya kalau kedua pembacaan ada dan di dalam ambang; salah satu di
   luar → "Abnormal"; salah satunya kosong → "—". Power RX/TX dicatat manual
   dalam dB (batas normalnya beda menurut radio/site/alat) — tidak ikut menilai
   indikasi. Kalau standar berubah, ubah RADIO_VOLT_AMBANG.

   PENYIMPANAN. Radio menumpang tabel `dstest` yang sama: catatannya dibedakan
   lewat state.__format === 'radio'. Semua rangkaian tanda tangan pihak-kedua
   (Manager Teknik), kotak masuk TTD, dan hapus/cetak sudah tersedia untuk
   'dstest' — jadi radio ikut memakainya tanpa tabel/rute baru. Daftar riwayat
   DS Test menyaring keluar catatan radio, dan sebaliknya (lihat renderDsList
   dan renderRadioList). */

/* ---------- Konstanta ---------- */

/** Batas tegangan PTT sesuai sheet PANDUAN. */
const RADIO_VOLT_AMBANG = { stbyMin:5, stbyMax:60, aktifMin:0, aktifMax:40 };

/** Cycle status baris Hasil: klik memutar ok → notok → noans → ok. Sama persis
    dengan DS Test supaya klik-nya konsisten bagi orang yang mengisi keduanya. */
const RADIO_STAT_URUT   = { ok:'notok', notok:'noans', noans:'ok' };
const RADIO_STAT_SIMBOL = { ok:'✓', notok:'✕', noans:'?' };
const RADIO_STAT_LABEL  = { ok:'OK', notok:'NOT OK', noans:'NO ANSWER' };

/** Master 67 radio/frequency — sheet DATABASE RADIO. Urutan ini yang menentukan
    isi tiap sesi (dibagi berurutan oleh RADIO_PLAN). */
const RADIO_LIST = [
  "128.3 MEU", "125.75 710/720", "132.2 MEU", "124.2 TER/MER",
  "133.2 SBR", "129.9 710/720", "133.45 SLGT", "127.9 TER/MER",
  "132.3 PKU", "126.45 710/720", "125.2 CRB", "135.9 710/720",
  "132.7 PLB", "125.45 TER/MER", "129.9 CRB", "125.05 710/720",
  "132.1 TKB", "126.85 710/720", "132.9 PKP", "124.15 710/720",
  "128.3 GNLG", "132.85 BKL", "125.2 PGRN", "132.2 710/720",
  "132.3 DJB", "132.7 710/720", "128.7 PKP", "132.1 TER/MER",
  "133.2 SDKL", "124.35 TER/MER", "134.45 PNK", "125.7 TKB",
  "133.325 NTA", "133.2 SLGT", "135.9 TKG", "134.025",
  "132.9 DJB", "134.025 NTA", "134.025 BTH", "133.325 TNJ",
  "125.45 710/720", "130.1 CRB", "120.9 CRB", "132.85 PDG",
  "134.3 CRB", "127.95 710/720", "132.1 KLPG", "119.75 710/720",
  "133.1 PLB", "123.75 710/720", "132.15 TKG", "132.85 NIAS",
  "134.5 KLPG", "133.9 TPD", "134.0 CRB", "120.9 TKB",
  "132.3 PDG", "133.5 PNK", "135.85 PKU", "127.9 710/720",
  "130.1 TER/MER", "134.025 MTK", "129.9 TER/MER", "133.5 KTP",
  "127.95 TER/MER", "125.7 TPD", "125.35 710/720"
];
const RADIO_TOTAL = RADIO_LIST.length; // 67

/** Tujuh sesi selang-seling: ganjil 10 radio, genap 9. Dibagi berurutan dari
    RADIO_LIST sehingga 67 radio habis persis dalam satu siklus tanpa duplikat. */
const RADIO_PLAN = (function(){
  const plan = []; let i = 0;
  for(let s = 1; s <= 7; s++){
    const n = (s % 2 === 1) ? 10 : 9;
    plan.push({ sesi:s, radios: RADIO_LIST.slice(i, i + n) });
    i += n;
  }
  return plan;
})();

/* ---------- State form ---------- */

/** Sesi yang sedang diisi (1..7). Auto-advance ke sesi berikut yang belum
    tersimpan; siklus balik ke 1 setelah sesi 7 disimpan. */
let radioSesi = 1;
const RADIO_SESI_KEY = 'elogbook.radio.sesiTerakhir';
function radioSesiBerikut(){
  let terakhir = 0;
  try{ terakhir = +localStorage.getItem(RADIO_SESI_KEY) || 0; }catch(_){}
  return (terakhir >= 1 && terakhir <= 7) ? (terakhir % 7) + 1 : 1;
}
function radioCatatSesi(sesi){ try{ localStorage.setItem(RADIO_SESI_KEY, String(sesi)); }catch(_){} }

/** Baris form: array of {code, ptts, ptta, rx, tx, hasil, remark}. code kosong
    saat baris pertama kali dibuat — user memilih dari dropdown yang sudah
    dibatasi minus radio yang sudah dipakai di siklus ini & minus pilihan baris
    lain. */
let radioRows = [];

/** Kunci LocalStorage untuk daftar radio yang SUDAH dipakai dalam siklus 7-sesi
    yang sedang berjalan. Bertambah tiap simpan; direset otomatis setelah 67
    radio penuh, atau manual lewat radioResetCycle(). */
const RADIO_DIPAKAI_KEY = 'elogbook.radio.dipakaiCycle';
function radioDipakai(){
  try{ const v = JSON.parse(localStorage.getItem(RADIO_DIPAKAI_KEY) || '[]');
       return Array.isArray(v) ? v : []; }catch(_){ return []; }
}
function radioCatatDipakai(codes){
  const set = new Set(radioDipakai());
  (codes || []).forEach(c => { if(c) set.add(String(c).trim()); });
  if(set.size >= RADIO_TOTAL){
    try{ localStorage.removeItem(RADIO_DIPAKAI_KEY); }catch(_){}
  }else{
    try{ localStorage.setItem(RADIO_DIPAKAI_KEY, JSON.stringify([...set])); }catch(_){}
  }
}
function radioResetCycle(){
  if(!confirm('Reset daftar radio yang sudah dicek di siklus ini? Sesi berikutnya akan kembali menawarkan semua radio.')) return;
  try{ localStorage.removeItem(RADIO_DIPAKAI_KEY); }catch(_){}
  try{ localStorage.removeItem(RADIO_SESI_KEY); }catch(_){}
  radioSesi = 1;
  radioRows = radioBangunBarisSesi(radioSesi);
  const sel = document.getElementById('radioSesi');
  if(sel){ sel.innerHTML = radioSesiPilihanHtml(); sel.value = String(radioSesi); }
  renderRadioTable();
  toast('Siklus Maintenance Radio direset — mulai lagi dari sesi 1.');
}

let radioTeknisiRows = [];
let radioTeknisiSeq = 0;

/* ---------- Bangun baris dari sesi ---------- */

/** Baris kosong sebanyak kuota sesi. User memilih code-nya sendiri lewat
    dropdown yang dibatasi per-siklus. */
function radioBangunBarisSesi(sesi){
  const rencana = RADIO_PLAN[Math.max(1, Math.min(7, sesi)) - 1];
  return rencana.radios.map(()=> ({ code:'', ptts:'', ptta:'', rx:'', tx:'', hasil:'ok', remark:'' }));
}

function initRadioBaruUntukSesi(sesi){
  radioSesi = Math.max(1, Math.min(7, sesi || 1));
  radioRows = radioBangunBarisSesi(radioSesi);
}

/** Radio yang boleh dipilih pada baris `idx`: seluruh RADIO_LIST minus yang
    sudah "dipakai" di siklus ini, minus pilihan baris lain di form, plus
    pilihan baris ini sendiri (supaya <option> tetap valid). */
function radioOpsiUntukBaris(idx){
  const r = radioRows[idx];
  if(!r) return [];
  const tabu = new Set(radioDipakai());
  radioRows.forEach((rr, i) => { if(i !== idx && rr.code) tabu.add(rr.code); });
  return RADIO_LIST.filter(c => !tabu.has(c) || c === r.code);
}

/* ---------- Indikasi PTT (otomatis) ---------- */

/** Tafsir status PTT per baris. Return 'normal' / 'abnormal' / 'kosong'. */
function radioIndikasi(ptts, ptta){
  const s = parseFloat(ptts), a = parseFloat(ptta);
  const punyaS = !isNaN(s), punyaA = !isNaN(a);
  if(!punyaS || !punyaA) return 'kosong';
  const v = RADIO_VOLT_AMBANG;
  const okS = s >= v.stbyMin && s <= v.stbyMax;
  const okA = a >= v.aktifMin && a <= v.aktifMax;
  return (okS && okA) ? 'normal' : 'abnormal';
}
const RADIO_INDIKASI_LABEL = { normal:'Normal', abnormal:'Abnormal', kosong:'—' };
const RADIO_INDIKASI_KELAS = { normal:'ok', abnormal:'fail', kosong:'minus' };

/* ---------- Interaksi baris ---------- */

function toggleRadioHasil(idx){
  const r = radioRows[idx]; if(!r) return;
  r.hasil = RADIO_STAT_URUT[r.hasil] || 'ok';
  renderRadioTable();
}
function setRadioCode(idx, nilai){
  const r = radioRows[idx]; if(!r) return;
  r.code = String(nilai || '').trim();
  renderRadioTable();
}
function setRadioVolt(idx, kolom, nilai){
  const r = radioRows[idx]; if(!r) return;
  r[kolom] = String(nilai || '');
  renderRadioTable(); // indikasi PTT bergantung padanya
}
function setRadioPower(idx, kolom, nilai){
  const r = radioRows[idx]; if(!r) return;
  r[kolom] = String(nilai || ''); // rx/tx tidak mengubah indikasi — tak perlu render ulang
}
function setRadioRemark(idx, nilai){
  const r = radioRows[idx]; if(!r) return;
  r.remark = String(nilai || '');
}

function gantiRadioSesi(nilai){
  const s = Math.max(1, Math.min(7, parseInt(nilai, 10) || 1));
  if(s === radioSesi) return;
  const ada = radioRows.some(r => r.code || r.ptts || r.ptta || r.rx || r.tx || r.remark || r.hasil !== 'ok');
  if(ada && !confirm('Isian sesi ini belum disimpan — pindah sesi akan mengosongkannya. Lanjut?')){
    const sel = document.getElementById('radioSesi'); if(sel) sel.value = String(radioSesi);
    return;
  }
  radioSesi = s;
  radioRows = radioBangunBarisSesi(s);
  renderRadioTable();
}

/* ---------- Render form ---------- */

function radioSesiPilihanHtml(){
  return RADIO_PLAN.map(p =>
    `<option value="${p.sesi}"${p.sesi===radioSesi?' selected':''}>Sesi ${p.sesi} — ${p.radios.length} radio</option>`
  ).join('');
}

function renderRadioTable(){
  const head = document.getElementById('radioThead');
  const body = document.getElementById('radioBody');
  if(!body) return;

  if(head){
    head.innerHTML = `<tr>
      <th style="width:34px;">No</th>
      <th style="width:180px;">Radio / Frequency Sampling</th>
      <th style="width:104px;">PTT Standby (VDC)</th>
      <th style="width:104px;">PTT Aktif (VDC)</th>
      <th style="width:92px;">Indikasi PTT</th>
      <th style="width:88px;">Power RX (dB)</th>
      <th style="width:88px;">Power TX (dB)</th>
      <th style="width:70px;">Hasil</th>
      <th>Remark</th>
    </tr>`;
  }

  const volt = (idx, kolom) => `<td>
    <input type="number" step="any" class="rk-ket" style="text-align:right;"
           value="${escapeHtml((radioRows[idx]||{})[kolom]||'')}" placeholder="–"
           oninput="setRadioVolt(${idx},'${kolom}', this.value)"></td>`;
  const power = (idx, kolom) => `<td>
    <input type="number" step="any" class="rk-ket" style="text-align:right;"
           value="${escapeHtml((radioRows[idx]||{})[kolom]||'')}" placeholder="–"
           oninput="setRadioPower(${idx},'${kolom}', this.value)"></td>`;

  const rows = radioRows.map((r, idx)=>{
    const ind = radioIndikasi(r.ptts, r.ptta);
    const indKelas = RADIO_INDIKASI_KELAS[ind];
    const indLabel = RADIO_INDIKASI_LABEL[ind];
    const opsi = radioOpsiUntukBaris(idx);
    const opsiHtml = [
      `<option value="">— pilih —</option>`,
      ...opsi.map(c => `<option value="${escapeHtml(c)}"${c===r.code?' selected':''}>${escapeHtml(c)}</option>`)
    ].join('');
    const hasil = r.hasil || 'ok';
    const hasilCls = hasil === 'notok' ? 'fail' : (hasil === 'noans' ? 'minus' : 'ok');
    return `<tr>
      <td>${idx + 1}</td>
      <td><select class="rk-ket" style="width:100%;background:var(--panel-2);border:1px solid var(--line);color:var(--text);border-radius:6px;padding:6px 8px;"
                  onchange="setRadioCode(${idx}, this.value)">${opsiHtml}</select></td>
      ${volt(idx,'ptts')}${volt(idx,'ptta')}
      <td style="text-align:center;">
        <span class="tag ${indKelas}" style="font-size:10.5px;">${escapeHtml(indLabel)}</span>
      </td>
      ${power(idx,'rx')}${power(idx,'tx')}
      <td><button class="status-btn ${hasilCls}" title="${RADIO_STAT_LABEL[hasil]||'OK'}"
                  onclick="toggleRadioHasil(${idx})">${RADIO_STAT_SIMBOL[hasil]||'✓'}</button></td>
      <td><input type="text" class="rk-ket" value="${escapeHtml(r.remark||'')}"
                 oninput="setRadioRemark(${idx}, this.value)"></td>
    </tr>`;
  }).join('');
  body.innerHTML = rows;

  const info = document.getElementById('radioSesiInfo');
  if(info){
    const rencana = RADIO_PLAN[radioSesi - 1];
    const dipakai = new Set(radioDipakai());
    const sedang  = new Set();
    radioRows.forEach(r => { if(r.code) sedang.add(r.code); });
    info.innerHTML =
      `<b>Sesi ${radioSesi}/7</b> — kuota ${rencana.radios.length} radio.` +
      ` Siklus: <b>${dipakai.size}/${RADIO_TOTAL}</b> tersimpan, ${sedang.size} sedang dipilih, sisa <b>${RADIO_TOTAL - dipakai.size - sedang.size}</b>.`;
  }
}

/* ---------- Teknisi ---------- */

function renderRadioTeknisi(){
  const wrap = document.getElementById('radioTeknisiList');
  if(!wrap) return;
  wrap.innerHTML = radioTeknisiRows.map((t,i)=>`
    <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;">
      <span style="font-family:var(--font-mono);color:var(--accent);font-size:12px;min-width:18px;">${i+1}.</span>
      <input type="text" value="${escapeHtml(t.nama)}" placeholder="${T('namaTeknisiPelaksana')} ${i+1}"
             list="teknisiDatalist"
             oninput="radioTeknisiRows[${i}].nama=this.value"
             style="flex:1;background:var(--panel-2);border:1px solid var(--line);color:var(--text);border-radius:6px;padding:9px 10px;font-size:16px;">
      ${radioTeknisiRows.length>1 ? `<button class="icon-btn" onclick="hapusRadioTeknisi('${t.key}')">✕</button>` : ''}
    </div>`).join('');
}
function addRadioTeknisi(){
  const isiAwal = radioTeknisiRows.length === 0 && userSaatIni ? (userSaatIni.nama || userSaatIni.username || '') : '';
  radioTeknisiRows.push({key:'r'+(radioTeknisiSeq++), nama: isiAwal});
  renderRadioTeknisi();
}
function hapusRadioTeknisi(key){ radioTeknisiRows = radioTeknisiRows.filter(x=>x.key!==key); renderRadioTeknisi(); }

/* ---------- Modal (buka / tutup / simpan) ---------- */

function openRadioModal(){
  document.getElementById('radioTanggal').value = tanggalHariIni();
  document.getElementById('radioManagerNama').value = '';
  document.getElementById('radioManagerAkun').value = '';
  radioTeknisiRows = []; radioTeknisiSeq = 0; addRadioTeknisi();
  ['sigRadio'].forEach(id=>{ if(!sigPads[id]) setupSigCanvas(id); resizeSigCanvas(id); clearSig(id); });

  initRadioBaruUntukSesi(radioSesiBerikut());
  const sel = document.getElementById('radioSesi');
  if(sel){ sel.innerHTML = radioSesiPilihanHtml(); sel.value = String(radioSesi); }
  renderRadioTable();

  document.getElementById('radioModalBg').classList.add('show');
  setTimeout(()=>['sigRadio'].forEach(resizeSigCanvas), 60);
}
function closeRadioModal(){ document.getElementById('radioModalBg').classList.remove('show'); }

async function saveRadio(){
  const kosong = radioRows.map((r,i)=> r.code ? null : (i+1)).filter(Boolean);
  if(kosong.length){
    toast(`Baris ${kosong.join(', ')} belum dipilih radio-nya.`);
    return;
  }
  const btn = document.getElementById('radioSaveBtn'); btn.disabled = true;
  try{
    const state = {
      __format: 'radio',
      __sesi: radioSesi,
      rows: radioRows.map(r => ({
        code:   String(r.code||'').trim(),
        ptts:   String(r.ptts || ''),
        ptta:   String(r.ptta || ''),
        rx:     String(r.rx || ''),
        tx:     String(r.tx || ''),
        hasil:  r.hasil || 'ok',
        remark: String(r.remark || '')
      }))
    };
    const saved = await gsRun('addDsTest', {
      unit: unitAktif,
      kategori: 'radio',
      tanggal: document.getElementById('radioTanggal').value,
      state,
      teknisiNamaList: radioTeknisiRows.map(t=>(t.nama||'').trim()).filter(Boolean),
      teknisiTtd: getSigDataUrl('sigRadio'),
      managerNama: document.getElementById('radioManagerNama').value.trim(),
      ttdUntuk: ttdUntukTerpilih('radioManagerAkun', document.getElementById('radioManagerNama').value)
    });
    dsList.unshift(mapDs(saved));
    renderRadioList();
    radioCatatSesi(radioSesi);
    radioCatatDipakai(state.rows.map(r => r.code));
    closeRadioModal();
    toast('Checklist Maintenance Radio tersimpan.');
  }catch(e){ toast(T('gagalSimpan') + ' — ' + (e.message || T('coba'))); }
  btn.disabled = false;
}

let radioTampilSemua = false;
function resetCariRadio(){ radioTampilSemua = true; const el = document.getElementById('cariRadioTanggal'); if(el) el.value = ''; renderRadioList(); }

/* ---------- Ringkasan temuan ---------- */

/** Baris bermasalah = Hasil NOT OK atau indikasi PTT Abnormal. Baris NO ANSWER
    tidak dihitung gangguan (radio bisa memang tidak menjawab saat sampling). */
function radioTemuan(state){
  const gagal = [];
  ((state && state.rows) || []).forEach(r=>{
    const buruk = r.hasil === 'notok';
    const abnormal = radioIndikasi(r.ptts, r.ptta) === 'abnormal';
    if(buruk || abnormal) gagal.push(r.code || '?');
  });
  return gagal;
}

/** Hanya catatan berformat radio yang muncul di daftar ini. */
const radioAdalah = (d) => !!(d && d.state && d.state.__format === 'radio');

/* ---------- Daftar riwayat ---------- */

function renderRadioList(){
  const wrap = document.getElementById('radioList');
  if(!wrap) return;
  const semua = (typeof dsList !== 'undefined' ? dsList : []).filter(radioAdalah);
  const tgl = (document.getElementById('cariRadioTanggal') || {}).value || '';
  const daftar = tgl ? semua.filter(d=>String(d.tanggal||'').slice(0,10) === tgl)
                     : (radioTampilSemua ? semua : semua.filter(d=>dalamSeminggu(d.tanggal)));

  if(semua.length === 0){ wrap.innerHTML = '<div class="empty">Belum ada checklist Maintenance Radio.</div>'; return; }
  if(daftar.length === 0){ wrap.innerHTML = '<div class="empty">' + T('takAdaHasil') + '</div>'; return; }

  wrap.innerHTML = daftar.map(d=>{
    const gagal = radioTemuan(d.state);
    const jenis = `Sampling · Sesi ${+d.state.__sesi || '?'}/7`;
    return `<div class="dc-history-item">
      <div><b>${escapeHtml(d.tanggal)}</b> &middot; ${jenis}</div>
      <span class="tag ${gagal.length ? 'fail' : 'ok'}">${gagal.length ? gagal.length + ' ' + T('siteBermasalah') : T('semuaLolos')}</span>
      <div style="font-size:11.5px;color:var(--muted);">${T('teknisiPelaksana')}: ${escapeHtml(d.teknisiNama)||'-'}</div>
      ${diinputOlehHtml(d.diinputOleh, d.dibuatPada, String(d.tanggal||'').slice(0,10))}
      <div style="display:flex;gap:4px;">
        <button class="btn ghost" style="padding:6px 10px;" onclick="openRadioDetail('${d.id}')">${T('detail')}</button>
        <button class="icon-btn" title="${T('cetak')}" onclick="printRadio('${d.id}')">🖨</button>
        <button class="icon-btn hanya-admin" title="${T('hapus')}" onclick="hapusRadio('${d.id}')">✕</button>
      </div>
    </div>`;
  }).join('');
}

async function hapusRadio(id){
  if(!adminAktif()){ toast(T('hanyaAdminHapus')); return; }
  const d = dsList.find(x=>x.id===id);
  if(!confirm(`${T('konfirmasiHapus')} ${d ? d.tanggal : ''}?`)) return;
  const salinan = dsList.slice();
  dsList = dsList.filter(x=>x.id!==id);
  renderRadioList();
  try{ await gsRun('deleteDsTest', id); }
  catch(e){ dsList = salinan; renderRadioList(); toast(T('gagalHapus') + ' — ' + (e.message||T('coba'))); }
}

/* ---------- Tabel siap-baca (detail + cetak) ---------- */

function radioTabelBaca(state, cetak){
  const sesi = +state.__sesi || 0;
  const rows = Array.isArray(state.rows) ? state.rows : [];
  const kelasCetakSt  = { ok:'p-ok', notok:'p-fail', noans:'p-minus' };
  const kelasCetakInd = { normal:'p-ok', abnormal:'p-fail', kosong:'p-minus' };

  const selSt = s => cetak
    ? `<td style="text-align:center;"><span class="${kelasCetakSt[s]||'p-ok'}">${RADIO_STAT_SIMBOL[s]||'✓'}</span></td>`
    : `<td><span class="status-btn ${s==='notok'?'fail':(s==='noans'?'minus':'ok')}" style="cursor:default;">${RADIO_STAT_SIMBOL[s]||'✓'}</span></td>`;
  const num = v => `<td style="text-align:right;white-space:nowrap;">${escapeHtml(String(v ?? '').trim() || '–')}</td>`;

  const barisHtml = rows.map((r, i)=>{
    const ind = radioIndikasi(r.ptts, r.ptta);
    const indLabel = RADIO_INDIKASI_LABEL[ind];
    const indHtml = cetak
      ? `<td style="text-align:center;"><span class="${kelasCetakInd[ind]||'p-minus'}">${escapeHtml(indLabel)}</span></td>`
      : `<td style="text-align:center;"><span class="tag ${RADIO_INDIKASI_KELAS[ind]}" style="font-size:10.5px;">${escapeHtml(indLabel)}</span></td>`;
    return `<tr>
      <td style="text-align:center;">${i+1}</td>
      <td style="text-align:left;">${escapeHtml(r.code||'')}</td>
      ${num(r.ptts)}${num(r.ptta)}
      ${indHtml}
      ${num(r.rx)}${num(r.tx)}
      ${selSt(r.hasil||'ok')}
      <td style="text-align:left;font-size:${cetak?'7.5pt':'11px'};">${escapeHtml(r.remark||'')}</td>
    </tr>`;
  }).join('');

  const t = cetak ? 'td' : 'th';
  const kelas = cetak ? ' class="p-kepala"' : '';
  const thead = `<tr${kelas}>
    <${t}>NO</${t}><${t}>RADIO / FREQUENCY SAMPLING</${t}>
    <${t}>PTT STANDBY (VDC)</${t}><${t}>PTT AKTIF (VDC)</${t}><${t}>INDIKASI PTT</${t}>
    <${t}>POWER RX (dB)</${t}><${t}>POWER TX (dB)</${t}><${t}>HASIL</${t}><${t}>REMARK</${t}></tr>`;
  const tabel = `<table class="${cetak?'':'dc ds'}" style="font-size:${cetak?'8pt':''};">
    <thead>${thead}</thead><tbody>${barisHtml}</tbody></table>`;
  const kepala = cetak
    ? `<div style="font-size:9pt;margin-bottom:4px;">SAMPLING SESI ${sesi}/7 — ${rows.length} radio</div>`
    : `<div style="font-size:12px;color:var(--muted);margin-bottom:6px;">Sampling Sesi ${sesi}/7 — ${rows.length} radio</div>`;
  return kepala + (cetak ? tabel : `<div class="dc-table-wrap">${tabel}</div>`);
}

/* ---------- Detail & cetak ---------- */

function openRadioDetail(id){
  const d = dsList.find(x=>x.id===id);
  if(!d) return;
  const jenis = `Sampling · Sesi ${+d.state.__sesi || '?'}/7`;
  document.getElementById('formDetailJudul').textContent = 'Maintenance Radio';
  document.getElementById('formDetailBody').innerHTML = `
    <div style="font-size:13px;line-height:1.7;margin-bottom:10px;"><b>${escapeHtml(d.tanggal)}</b> &middot; ${jenis}</div>
    ${radioTabelBaca(d.state, false)}
    <div class="detail-ttd">
      <div class="sig-block"><b>${T('teknisiPelaksana')}</b>${escapeHtml(d.teknisiNama)||'-'}${sigThumbHtml(d.teknisiTtd)}</div>
      <div class="sig-block"><b>${T('mengetahuiManager')}</b>${renderPihakKedua('dstest', d.id, d.managerNama, d.managerTtd)}${sigPejabatHtml('dstest', d.id, d.managerTtd, d)}</div>
    </div>
    <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line);">${diinputOlehHtml(d.diinputOleh, d.dibuatPada, String(d.tanggal||'').slice(0,10))}</div>`;
  document.getElementById('formDetailPrintBtn').onclick = ()=>{ closeFormDetail(); printRadio(id); };
  document.getElementById('formDetailBg').classList.add('show');
}

function printRadio(id){
  const d = dsList.find(x=>x.id===id);
  if(!d) return;
  if(!tolakCetakBilaBelumTtd(d, 'dstest')) return;
  const legend = '<b>NB :</b> ✓ : OK &nbsp;&nbsp; ✕ : NOT OK &nbsp;&nbsp; ? : NO ANSWER &nbsp;&nbsp; · Indikasi PTT: Standby 5–60 VDC, Aktif 0–40 VDC. Power RX/TX dicatat manual (dB).';
  doPrint(`
    <div style="text-align:center;font-weight:bold;font-size:12pt;margin-bottom:4px;">CHECKLIST MAINTENANCE RADIO</div>
    <div style="text-align:center;font-size:9pt;margin-bottom:10px;">TANGGAL : ${escapeHtml(d.tanggal)}</div>
    ${radioTabelBaca(d.state, true)}
    <div style="font-size:8.5pt;margin-top:8px;">${legend}</div>
    <table class="no-border" style="font-size:9pt;margin-top:14px;">
      <tr>
        <td style="width:55%;text-align:left;vertical-align:top;">
          <div style="margin-bottom:6px;">TEKNISI PELAKSANA :</div>
          ${teknisiPrintBlock(d)}
        </td>
        <td style="text-align:center;vertical-align:top;">
          <div>Mengetahui,</div>
          <div style="margin-bottom:4px;">Manager Teknik</div>
          <div style="height:46px;">${ttdImg(d.managerTtd, 40)}</div>
          <div style="border-top:1px solid #000;display:inline-block;padding:0 24px;">${d.managerTtd ? (escapeHtml(d.managerNama)||'&nbsp;') : '&nbsp;'}</div>
        </td>
      </tr>
    </table>`, 'landscape');
}
