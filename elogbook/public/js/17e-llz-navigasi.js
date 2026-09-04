/* E-Logbook · js/17e-llz-navigasi.js — Preventive Maintenance unit Navigasi (ppabn)
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh.

   GROUND CHECK PERFORMANCE CURVE (GC LLZ). Localizer punya empat ujung landas
   di JATSC: LLZ 07L, LLZ 07R, LLZ 25R, LLZ 25L. Bentuk lembarnya sama persis
   untuk keempatnya (cuma nilai ukurnya yang beda), jadi satu modal dipakai
   bersama dan sub-tab yang menekan tombolnya menentukan lembar mana.

   Lembarnya dialihaksarakan dari "1. FORM GC LLZ buat di upload.xlsx" (sheet
   "GC LLZ 07L 17 AGUSTUS 2026"): sebelas titik ukur dari 90 Hz side melewati
   center line sampai 150 Hz side, masing-masing untuk TX 1 dan TX 2. Tiap
   titik mencatat DDM (ddm), SUM (%), MOD 90 Hz, MOD 150 Hz, dan RF LEVEL (dB).
   DDM (µA) dihitung otomatis dari DDM (ddm) — 0,155 ddm = 150 µA — dan dipakai
   sebagai sumbu tegak grafik "Ground Performance Curve" yang tergambar LANGSUNG
   begitu angkanya diketik.

   PENYIMPANAN. Menumpang tabel `dstest` yang sama seperti Maintenance Radio dan
   Weekly Check Pengamatan — catatannya dibedakan lewat state.__format ===
   'llzgc' + state.__llzForm (07l/07r/25r/25l). Seluruh rangkaian TTD Manager
   Teknik, kotak masuk TTD, hapus, dan cetak sudah tersedia untuk 'dstest',
   jadi lembar ini ikut memakainya tanpa tabel/rute baru. Guard daftar-site di
   insertDsTest (db.js + db-pg.js) dilewati untuk format ini. */

/* ---------- Bentuk lembar ---------- */

/** Empat ujung landas. `label` untuk kepala sub-tab & judul cetak. */
const LLZ_FORMS = {
  '07l': 'LLZ 07L',
  '07r': 'LLZ 07R',
  '25r': 'LLZ 25R',
  '25l': 'LLZ 25L'
};
const LLZ_URUT = ['07l', '07r', '25r', '25l'];

/** 0,155 ddm setara 150 µA — konstanta konversi DDM (µA) = DDM (ddm) × faktor. */
const LLZ_UA_PER_DDM = 150 / 0.155;   // ≈ 967,742

/** Sebelas titik ukur tetap. `deg` teks tampil (mengikuti form, selalu positif);
    `gdeg` derajat bertanda untuk sumbu grafik: 90 Hz side negatif, C/L nol,
    150 Hz side positif — supaya kurvanya membentuk huruf-S yang benar. */
const LLZ_ROWS = [
  { side: '90HZ SIDE',  sector: 'CLR',           jarak: '40,04', deg: '20',   gdeg: -20 },
  { side: '',           sector: '',              jarak: '29,47', deg: '15',   gdeg: -15 },
  { side: '',           sector: 'COURSE SECTOR', jarak: '19,40', deg: '10',   gdeg: -10 },
  { side: '',           sector: '',              jarak: '9,62',  deg: '5',    gdeg: -5  },
  { side: 'CW',         sector: '',              jarak: '3,00',  deg: '1,56', gdeg: -1.56 },
  { side: 'C/L',        sector: '',              jarak: '0',     deg: '0',    gdeg: 0   },
  { side: 'CW',         sector: '',              jarak: '3,00',  deg: '1,56', gdeg: 1.56 },
  { side: '150HZ SIDE', sector: '',              jarak: '9,62',  deg: '5',    gdeg: 5   },
  { side: '',           sector: '',              jarak: '19,40', deg: '10',   gdeg: 10  },
  { side: '',           sector: 'CLR',           jarak: '29,47', deg: '15',   gdeg: 15  },
  { side: '',           sector: '',              jarak: '40,04', deg: '20',   gdeg: 20  }
];

/** Enam kolom terukur per transmitter. `ua` dihitung, sisanya diketik. */
const LLZ_COLS = [
  { k: 'ddm',  label: 'DDM<br>(ddm)' },
  { k: 'ua',   label: 'DDM<br>(µA)', calc: true },
  { k: 'sum',  label: 'SUM<br>(%)' },
  { k: 'm90',  label: 'MOD<br>90 Hz' },
  { k: 'm150', label: 'MOD<br>150 Hz' },
  { k: 'rf',   label: 'RF LEVEL<br>(dB)' }
];
/** Kolom terukur yang bisa diketik (semua kecuali µA yang dihitung). */
const LLZ_INPUT_KEYS = LLZ_COLS.filter(c => !c.calc).map(c => c.k);

/* ---------- State lembar yang sedang diisi ---------- */

let llzForm = '07l';
/** Per baris: { tx1:{ddm,sum,m90,m150,rf}, tx2:{...} } — string mentah. */
let llzVals = [];
let llzTeknisiRows = [];
let llzTeknisiSeq = 0;

function llzBlankTx(){ return { ddm: '', sum: '', m90: '', m150: '', rf: '' }; }
function llzInitVals(){ llzVals = LLZ_ROWS.map(() => ({ tx1: llzBlankTx(), tx2: llzBlankTx() })); }

/** Angka toleran koma/titik; kembalikan NaN kalau kosong/tak sah. */
function llzNum(v){
  if(v === null || v === undefined) return NaN;
  const s = String(v).trim().replace(',', '.');
  if(s === '') return NaN;
  const n = Number(s);
  return isFinite(n) ? n : NaN;
}
/** DDM (µA) dari DDM (ddm). Kosong kalau ddm belum diisi. */
function llzUa(ddm){ const n = llzNum(ddm); return isFinite(n) ? n * LLZ_UA_PER_DDM : NaN; }
/** Tampilkan angka ringkas (maks 1 desimal) dengan koma desimal gaya Indonesia. */
function llzFmt(n, des){
  if(!isFinite(n)) return '';
  const d = (des === undefined) ? 1 : des;
  return n.toFixed(d).replace('.', ',');
}

/* ---------- Grafik Ground Performance Curve (SVG murni) ---------- */

/** Bulatkan ke atas ke angka "bulat" (1/2/2,5/5 ×10ⁿ) untuk skala sumbu. */
function llzNiceCeil(x){
  if(!isFinite(x) || x <= 0) return 1;
  const e = Math.pow(10, Math.floor(Math.log10(x)));
  const f = x / e;
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nf * e;
}

/** Gambar satu kurva. `pts` = [{label, y}] (y boleh NaN = titik kosong).
    `c` = warna {stroke, grid, text, axis}. Titik dijejer rata (sumbu kategori,
    sama seperti grafik di Excel-nya) dan diberi label derajat di bawahnya. */
function llzChartSvg(title, pts, c){
  const W = 560, H = 300, mL = 50, mR = 16, mT = 32, mB = 42;
  const x0 = mL, x1 = W - mR, y0 = mT, y1 = H - mB;
  const n = pts.length;
  const ys = pts.map(p => p.y).filter(v => isFinite(v));
  let M = ys.length ? Math.max(...ys.map(Math.abs)) : 1;
  M = llzNiceCeil(M * 1.05);
  const X = i => x0 + (n <= 1 ? 0 : (i / (n - 1)) * (x1 - x0));
  const Y = v => y1 - ((v + M) / (2 * M)) * (y1 - y0);

  const ticks = [-M, -M / 2, 0, M / 2, M];
  const grid = ticks.map(t => {
    const y = Y(t);
    const tebal = t === 0 ? 1.4 : 0.7;
    return `<line x1="${x0}" y1="${y.toFixed(1)}" x2="${x1}" y2="${y.toFixed(1)}" stroke="${c.grid}" stroke-width="${tebal}"/>`
      + `<text x="${x0 - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="${c.text}">${llzFmt(t, 0)}</text>`;
  }).join('');

  // Garis penghubung hanya lewat titik yang terisi (kosong = putus).
  const isian = pts.map((p, i) => ({ i, y: p.y })).filter(p => isFinite(p.y));
  const poly = isian.length >= 2
    ? `<polyline fill="none" stroke="${c.stroke}" stroke-width="2" stroke-linejoin="round"
         points="${isian.map(p => `${X(p.i).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ')}"/>`
    : '';
  const dots = isian.map(p =>
    `<circle cx="${X(p.i).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="2.6" fill="${c.stroke}"/>`).join('');

  const xlab = pts.map((p, i) =>
    `<text x="${X(i).toFixed(1)}" y="${y1 + 14}" text-anchor="middle" font-size="8" fill="${c.text}">${escapeHtml(p.label)}</text>`).join('');

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px;height:auto;font-family:var(--font-mono,monospace);">
    <text x="${W / 2}" y="18" text-anchor="middle" font-size="12" font-weight="bold" fill="${c.text}">${escapeHtml(title)}</text>
    <text x="14" y="${(y0 + y1) / 2}" text-anchor="middle" font-size="9" fill="${c.text}" transform="rotate(-90 14 ${(y0 + y1) / 2})">D D M (µA)</text>
    ${grid}
    <line x1="${x0}" y1="${y0}" x2="${x0}" y2="${y1}" stroke="${c.axis}" stroke-width="1"/>
    ${poly}${dots}${xlab}
    <text x="${W / 2}" y="${H - 4}" text-anchor="middle" font-size="9" fill="${c.text}">DEGREE</text>
  </svg>`;
}

/** Dua kurva TX 1 & TX 2 dari kumpulan nilai `vals`. */
function llzChartsHtml(vals, cetak){
  const c = cetak
    ? { stroke: '#0a58ca', grid: '#d0d0d0', text: '#111', axis: '#333' }
    : { stroke: 'var(--accent)', grid: 'var(--line)', text: 'var(--text)', axis: 'var(--muted)' };
  const mk = tx => LLZ_ROWS.map((r, i) => ({ label: r.gdeg < 0 ? '-' + r.deg : (r.gdeg > 0 ? r.deg : '0'), y: llzUa((vals[i] && vals[i][tx] || {}).ddm) }));
  const wrapStyle = cetak
    ? 'display:flex;gap:12px;justify-content:center;'
    : 'display:flex;gap:16px;flex-wrap:wrap;justify-content:center;';
  const boxStyle = cetak ? 'flex:1;min-width:0;' : 'flex:1;min-width:320px;';
  return `<div style="${wrapStyle}">
    <div style="${boxStyle}">${llzChartSvg('TX 1  Ground Performance Curve', mk('tx1'), c)}</div>
    <div style="${boxStyle}">${llzChartSvg('TX 2  Ground Performance Curve', mk('tx2'), c)}</div>
  </div>`;
}

function llzDrawCharts(){
  const el = document.getElementById('llzCharts');
  if(el) el.innerHTML = llzChartsHtml(llzVals, false);
}

/* ---------- Tabel lembar (isian, detail, cetak) ---------- */

/** Kepala tabel dua baris: kolom tetap + TX 1 (6) + TX 2 (6). */
function llzThead(cetak){
  const fs = cetak ? 'font-size:6.6pt;' : '';
  const sub = LLZ_COLS.map(col => `<th style="${fs}">${col.label}</th>`).join('');
  return `<thead>
    <tr>
      <th rowspan="2" style="${fs}">SIDE</th>
      <th rowspan="2" style="${fs}">SECTOR</th>
      <th rowspan="2" style="${fs}">JARAK<br>(M)</th>
      <th rowspan="2" style="${fs}">DEGRESS<br>(°)</th>
      <th colspan="6" style="${fs}">TX 1</th>
      <th colspan="6" style="${fs}">TX 2</th>
    </tr>
    <tr>${sub}${sub}</tr>
  </thead>`;
}

/** Satu sel terukur. mode 'form' → input; selainnya → teks. */
function llzCell(ri, tx, col, vals, mode, cetak){
  if(col.calc){
    const ua = llzUa((vals[ri] && vals[ri][tx] || {}).ddm);
    const txt = isFinite(ua) ? llzFmt(ua, 0) : (mode === 'form' ? '' : '-');
    if(mode === 'form') return `<td style="text-align:center;color:var(--muted);"><span id="llzUa_${ri}_${tx}">${txt}</span></td>`;
    return `<td style="text-align:center;${cetak ? 'font-size:6.6pt;' : ''}">${escapeHtml(txt)}</td>`;
  }
  const val = (vals[ri] && vals[ri][tx] || {})[col.k] || '';
  if(mode === 'form'){
    const redraw = col.k === 'ddm';
    return `<td><input type="text" inputmode="decimal" id="llz_${ri}_${tx}_${col.k}" value="${escapeHtml(val)}"
      oninput="llzSet(${ri},'${tx}','${col.k}',this.value${redraw ? ',true' : ''})"
      style="width:100%;box-sizing:border-box;background:var(--panel-2);border:1px solid var(--line);color:var(--text);border-radius:5px;padding:6px 4px;font-size:13px;text-align:center;"></td>`;
  }
  return `<td style="text-align:center;${cetak ? 'font-size:6.6pt;' : ''}">${escapeHtml(val) || '-'}</td>`;
}

/** Bangun seluruh tabel. */
function llzTabel(vals, mode){
  const cetak = mode === 'cetak';
  const fs = cetak ? 'font-size:6.6pt;' : '';
  const body = LLZ_ROWS.map((r, ri) => {
    const tetap = `<td style="text-align:center;${fs}">${escapeHtml(r.side)}</td>`
      + `<td style="text-align:center;${fs}">${escapeHtml(r.sector)}</td>`
      + `<td style="text-align:center;${fs}">${escapeHtml(r.jarak)}</td>`
      + `<td style="text-align:center;${fs}">${escapeHtml(r.deg)}</td>`;
    const tx1 = LLZ_COLS.map(col => llzCell(ri, 'tx1', col, vals, mode, cetak)).join('');
    const tx2 = LLZ_COLS.map(col => llzCell(ri, 'tx2', col, vals, mode, cetak)).join('');
    return `<tr>${tetap}${tx1}${tx2}</tr>`;
  }).join('');
  const cls = cetak ? 'llz-print' : 'llz';
  const tableStyle = cetak
    ? 'width:100%;border-collapse:collapse;'
    : 'width:100%;border-collapse:collapse;min-width:920px;';
  return `<table class="${cls}" style="${tableStyle}">${llzThead(cetak)}<tbody>${body}</tbody></table>`;
}

/** Tulis nilai ke state; redraw µA + grafik hanya saat DDM (ddm) berubah. */
function llzSet(ri, tx, key, val, redraw){
  if(!llzVals[ri]) llzVals[ri] = { tx1: llzBlankTx(), tx2: llzBlankTx() };
  llzVals[ri][tx][key] = val;
  if(redraw){
    const ua = llzUa(val);
    const cell = document.getElementById(`llzUa_${ri}_${tx}`);
    if(cell) cell.textContent = isFinite(ua) ? llzFmt(ua, 0) : '';
    llzDrawCharts();
  }
}

function renderLlzTable(){
  const wrap = document.getElementById('llzWrap');
  if(wrap) wrap.innerHTML = llzTabel(llzVals, 'form');
  llzDrawCharts();
}

/* ---------- Teknisi (nama + baris dinamis) ---------- */

function renderLlzTeknisi(){
  const wrap = document.getElementById('llzTeknisiList');
  if(!wrap) return;
  wrap.innerHTML = llzTeknisiRows.map((t, i) => `
    <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;">
      <span style="font-family:var(--font-mono);color:var(--accent);font-size:12px;min-width:18px;">${i + 1}.</span>
      <input type="text" value="${escapeHtml(t.nama)}" placeholder="${T('namaTeknisiPelaksana')} ${i + 1}"
             list="teknisiDatalist"
             oninput="llzTeknisiRows[${i}].nama=this.value"
             style="flex:1;background:var(--panel-2);border:1px solid var(--line);color:var(--text);border-radius:6px;padding:9px 10px;font-size:16px;">
      ${llzTeknisiRows.length > 1 ? `<button class="icon-btn" onclick="hapusLlzTeknisi('${t.key}')">✕</button>` : ''}
    </div>`).join('');
}
function addLlzTeknisi(){
  const isiAwal = llzTeknisiRows.length === 0 && userSaatIni ? (userSaatIni.nama || userSaatIni.username || '') : '';
  llzTeknisiRows.push({ key: 'l' + (llzTeknisiSeq++), nama: isiAwal });
  renderLlzTeknisi();
}
function hapusLlzTeknisi(key){ llzTeknisiRows = llzTeknisiRows.filter(x => x.key !== key); renderLlzTeknisi(); }

/* ---------- Modal (buka / tutup / simpan) ---------- */

function openLlzModal(form){
  if(!LLZ_FORMS[form]) form = '07l';
  llzForm = form;
  llzInitVals();
  document.getElementById('llzModalJudul').textContent = 'Ground Check Performance Curve — ' + LLZ_FORMS[form];
  document.getElementById('llzTanggal').value = tanggalHariIni();
  document.getElementById('llzMerk').value = 'Selex 2100';
  document.getElementById('llzIdent').value = 'ICHL / 111.5 MHz';
  document.getElementById('llzJarakAntena').value = '';
  document.getElementById('llzManagerNama').value = '';
  document.getElementById('llzManagerAkun').value = '';
  llzTeknisiRows = []; llzTeknisiSeq = 0; addLlzTeknisi();
  if(!sigPads['sigLlz']) setupSigCanvas('sigLlz');
  resizeSigCanvas('sigLlz'); clearSig('sigLlz');
  // Kanvas TTD SENGAJA dibiarkan kosong — teknisi tanda tangan sendiri, atau
  // klik "✍ pakai TTD tersimpan" kalau mau. Jangan auto-tempel: biar ada
  // effort nempel TTD, bukan tiba-tiba sudah ada tanda tangan kita.
  if(typeof pasangTombolTtdTersimpan === 'function') pasangTombolTtdTersimpan();
  renderLlzTable();
  document.getElementById('llzModalBg').classList.add('show');
  setTimeout(() => resizeSigCanvas('sigLlz'), 60);
}
function closeLlzModal(){ document.getElementById('llzModalBg').classList.remove('show'); }

async function saveLlz(){
  const btn = document.getElementById('llzSaveBtn'); btn.disabled = true;
  try{
    const header = {
      ident: document.getElementById('llzIdent').value.trim(),
      merk: document.getElementById('llzMerk').value.trim(),
      jarakAntena: document.getElementById('llzJarakAntena').value.trim()
    };
    const state = { __format: 'llzgc', __llzForm: llzForm, header, rows: llzVals };
    const saved = await gsRun('addDsTest', {
      unit: unitAktif,
      kategori: 'llzgc',
      tanggal: document.getElementById('llzTanggal').value,
      state,
      teknisiNamaList: llzTeknisiRows.map(t => (t.nama || '').trim()).filter(Boolean),
      teknisiTtd: getSigDataUrl('sigLlz'),
      managerNama: document.getElementById('llzManagerNama').value.trim(),
      ttdUntuk: ttdUntukTerpilih('llzManagerAkun', document.getElementById('llzManagerNama').value)
    });
    dsList.unshift(mapDs(saved));
    renderLlzList(llzForm);
    closeLlzModal();
    toast('Ground Check LLZ tersimpan.');
  }catch(e){ toast(T('gagalSimpan') + ' — ' + (e.message || T('coba'))); }
  btn.disabled = false;
}

/* ---------- Daftar riwayat (satu daftar per lembar) ---------- */

const llzAdalah = (d, form) => !!(d && d.state && d.state.__format === 'llzgc' &&
                                  (!form || d.state.__llzForm === form));

let llzTampilSemua = { '07l': false, '07r': false, '25r': false, '25l': false };
function resetCariLlz(form){
  llzTampilSemua[form] = true;
  const el = document.getElementById('cariLlzTanggal-' + form); if(el) el.value = '';
  renderLlzList(form);
}

function renderLlzList(form){
  const wrap = document.getElementById('llzList-' + form);
  if(!wrap) return;
  const semua = (typeof dsList !== 'undefined' ? dsList : []).filter(d => llzAdalah(d, form));
  const tgl = (document.getElementById('cariLlzTanggal-' + form) || {}).value || '';
  const daftar = tgl ? semua.filter(d => String(d.tanggal || '').slice(0, 10) === tgl)
                     : (llzTampilSemua[form] ? semua : semua.filter(d => dalamSeminggu(d.tanggal)));

  if(semua.length === 0){ wrap.innerHTML = '<div class="empty">Belum ada Ground Check.</div>'; return; }
  if(daftar.length === 0){ wrap.innerHTML = '<div class="empty">' + T('takAdaHasil') + '</div>'; return; }

  wrap.innerHTML = daftar.map(d => {
    const h = (d.state && d.state.header) || {};
    return `<div class="dc-history-item">
      <div><b>${escapeHtml(d.tanggal)}</b></div>
      <span class="tag ok">${escapeHtml(h.ident || LLZ_FORMS[form])}</span>
      <div style="font-size:11.5px;color:var(--muted);">${T('teknisiPelaksana')}: ${escapeHtml(d.teknisiNama) || '-'}</div>
      ${diinputOlehHtml(d.diinputOleh, d.dibuatPada, String(d.tanggal || '').slice(0, 10))}
      <div style="display:flex;gap:4px;">
        <button class="btn ghost" style="padding:6px 10px;" onclick="openLlzDetail('${d.id}')">${T('detail')}</button>
        <button class="icon-btn" title="${T('cetak')}" onclick="printLlz('${d.id}')">🖨</button>
        <button class="icon-btn hanya-admin" title="${T('hapus')}" onclick="hapusLlz('${d.id}')">✕</button>
      </div>
    </div>`;
  }).join('');
}

/** Segarkan keempat daftar sekaligus (dipanggil init/terapkanUnit). */
function renderSemuaLlzList(){ LLZ_URUT.forEach(renderLlzList); }

async function hapusLlz(id){
  if(!adminAktif()){ toast(T('hanyaAdminHapus')); return; }
  const d = dsList.find(x => x.id === id);
  if(!confirm(`${T('konfirmasiHapus')} ${d ? d.tanggal : ''}?`)) return;
  const form = (d && d.state && d.state.__llzForm) || '07l';
  const salinan = dsList.slice();
  dsList = dsList.filter(x => x.id !== id);
  renderLlzList(form);
  try{ await gsRun('deleteDsTest', id); }
  catch(e){ dsList = salinan; renderLlzList(form); toast(T('gagalHapus') + ' — ' + (e.message || T('coba'))); }
}

/* ---------- Detail & cetak ---------- */

function llzInfoBaris(d){
  const h = (d.state && d.state.header) || {};
  const form = (d.state && d.state.__llzForm) || '07l';
  return [
    ['Tanggal', d.tanggal],
    ['Fasilitas', 'Alat Bantu Pendaratan Presisi'],
    ['Lokalizer', LLZ_FORMS[form]],
    ['Merk', h.merk || '-'],
    ['Ident-Freq', h.ident || '-'],
    ['Jarak dari antenna localizer', (h.jarakAntena ? h.jarakAntena + ' M' : '-')]
  ];
}

function openLlzDetail(id){
  const d = dsList.find(x => x.id === id);
  if(!d || !d.state) return;
  const form = d.state.__llzForm || '07l';
  const vals = d.state.rows || [];
  const info = llzInfoBaris(d).map(([k, v]) =>
    `<div><span style="color:var(--muted);">${escapeHtml(k)}:</span> <b>${escapeHtml(v)}</b></div>`).join('');
  document.getElementById('formDetailJudul').textContent = 'GC ' + LLZ_FORMS[form];
  document.getElementById('formDetailBody').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 18px;font-size:12.5px;line-height:1.6;margin-bottom:12px;">${info}</div>
    <div style="overflow-x:auto;">${llzTabel(vals, 'detail')}</div>
    <div style="margin-top:14px;">${llzChartsHtml(vals, false)}</div>
    <div class="detail-ttd">
      <div class="sig-block"><b>${T('teknisiPelaksana')}</b>${escapeHtml(d.teknisiNama) || '-'}${sigThumbHtml(d.teknisiTtd)}</div>
      <div class="sig-block"><b>${T('mengetahuiManager')}</b>${renderPihakKedua('dstest', d.id, d.managerNama, d.managerTtd)}${sigPejabatHtml('dstest', d.id, d.managerTtd, d)}</div>
    </div>
    <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line);">${diinputOlehHtml(d.diinputOleh, d.dibuatPada, String(d.tanggal || '').slice(0, 10))}</div>`;
  document.getElementById('formDetailPrintBtn').onclick = () => { closeFormDetail(); printLlz(id); };
  document.getElementById('formDetailBg').classList.add('show');
}

function printLlz(id){
  const d = dsList.find(x => x.id === id);
  if(!d || !d.state) return;
  if(!tolakCetakBilaBelumTtd(d, 'dstest')) return;
  const form = d.state.__llzForm || '07l';
  const vals = d.state.rows || [];
  const h = (d.state && d.state.header) || {};
  const info = llzInfoBaris(d).map(([k, v]) =>
    `<tr><td style="padding:0 6px 1px 0;white-space:nowrap;">${escapeHtml(k)}</td><td>: ${escapeHtml(v)}</td></tr>`).join('');
  const legend = '<b>Ket :</b> DDM (µA) = DDM (ddm) × 967,74 &nbsp;·&nbsp; kurva TX 1 & TX 2 dari 90 Hz side → C/L → 150 Hz side.';
  doPrint(`
    <div style="text-align:center;font-weight:bold;font-size:12pt;">GROUNDCHECK PERFORMANCE CURVE</div>
    <div style="text-align:center;font-size:10pt;margin-bottom:8px;">LOCALIZER ${escapeHtml(LLZ_FORMS[form])}</div>
    <table class="no-border" style="font-size:8.5pt;margin-bottom:8px;"><tbody>${info}</tbody></table>
    <div style="overflow-x:auto;">${llzTabel(vals, 'cetak')}</div>
    <div style="margin-top:10px;">${llzChartsHtml(vals, true)}</div>
    <div style="font-size:8pt;margin-top:6px;">${legend}</div>
    <table class="no-border" style="font-size:9pt;margin-top:14px;">
      <tr>
        <td style="width:55%;text-align:left;vertical-align:top;">
          <div style="margin-bottom:6px;">TEKNISI RATED ILS :</div>
          ${teknisiPrintBlock(d)}
        </td>
        <td style="text-align:center;vertical-align:top;">
          <div>Mengetahui,</div>
          <div style="margin-bottom:4px;">Manager Teknik</div>
          <div style="height:46px;">${ttdImg(d.managerTtd, 40)}</div>
          <div style="border-top:1px solid #000;display:inline-block;padding:0 24px;">${d.managerTtd ? (escapeHtml(d.managerNama) || '&nbsp;') : '&nbsp;'}</div>
        </td>
      </tr>
    </table>`, 'landscape');
}
