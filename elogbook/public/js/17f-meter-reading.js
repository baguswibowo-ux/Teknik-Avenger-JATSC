/* E-Logbook · js/17f-meter-reading.js — Preventive Maintenance › METER READING
   unit Navigasi (ppabn). Dimuat dari index.html sesuai nomor berkas.

   Meter Reading ILS SELEX. Pohon di sub-tab "Meter Reading":
     ILS ─┬─ ILS 07L → LLZ 07L · GP 07L · TDME 07L
          ├─ ILS 07R → LLZ 07R · GP 07R · TDME 07R
          ├─ ILS 25L → LLZ 25L · GP 25L · TDME 25L
          └─ ILS 25R → LLZ 25R · GP 25R · TDME 25R · OM 25R
     DVOR/DME → (form menyusul)

   Tiap lembar dialihaksarakan apa adanya dari "METER READING ILS Selex 2025.xlsx"
   (satu sheet = satu lembar). Bentuk lembar per JENIS fasilitas sama persis untuk
   keempat ujung landas — cuma nilai default kepala (freq/channel/ident) yang beda —
   jadi satu skema per jenis (LLZ/GP/TDME/OM) dipakai bersama; id lembar (mis.
   'llz-07l') menentukan judul + default kepala.

   PENYIMPANAN. Menumpang tabel `dstest` seperti Ground Check LLZ (17e), Weekly
   Check (17d), dan Maintenance Radio (17c): dibedakan lewat state.__format ===
   'mrreading' + state.__mrForm (id lembar). Seluruh rangkaian TTD Manager Teknik,
   kotak masuk TTD, hapus, dan cetak sudah tersedia untuk 'dstest'. Guard daftar-site
   di insertDsTest (db.js + db-pg.js) dilewati untuk format ini.

   Lembar dibangun dari SKEMA: tiap lembar = deret "seksi", tiap seksi = satu tabel
   (kepala baris-ganda ditulis tangan agar merge kolomnya benar; baris data digenerik
   dari daftar kolom). Nilai disimpan datar di mrData[`${si}_${ri}_${col}`]. */

/* ---------- Registry lembar (id → judul + default kepala) ---------- */

const MR_FORMS = {
  'llz-07l': { jenis: 'llz', label: 'LLZ 07L', equip: 'LOCALIZER 07L', freq: '111.5 MHz', ident: 'ICHL' },
  'llz-07r': { jenis: 'llz', label: 'LLZ 07R', equip: 'LOCALIZER 07R', freq: '110.5 MHz', ident: 'ICHR' },
  'llz-25l': { jenis: 'llz', label: 'LLZ 25L', equip: 'LOCALIZER 25L', freq: '111.1 MHz', ident: 'ICGL' },
  'llz-25r': { jenis: 'llz', label: 'LLZ 25R', equip: 'LOCALIZER 25R', freq: '110.9 MHz', ident: 'ICGR' },
  'gp-07l':  { jenis: 'gp',  label: 'GP 07L',  equip: 'GLIDEPATH 07L' },
  'gp-07r':  { jenis: 'gp',  label: 'GP 07R',  equip: 'GLIDEPATH 07R' },
  'gp-25l':  { jenis: 'gp',  label: 'GP 25L',  equip: 'GLIDEPATH 25L' },
  'gp-25r':  { jenis: 'gp',  label: 'GP 25R',  equip: 'GLIDEPATH 25R' },
  'tdme-07l':{ jenis: 'tdme',label: 'TDME 07L',equip: 'TDME 07 L', channel: '52X', ident: 'ICHL', lokasi: 'SHELTER GP 07L' },
  'tdme-07r':{ jenis: 'tdme',label: 'TDME 07R',equip: 'TDME 07 R', channel: '42X', ident: 'ICHR', lokasi: 'SHELTER GP 07R' },
  'tdme-25l':{ jenis: 'tdme',label: 'TDME 25L',equip: 'TDME 25 L', channel: '48X', ident: 'ICGL', lokasi: 'SHELTER GP 25L' },
  'tdme-25r':{ jenis: 'tdme',label: 'TDME 25R',equip: 'TDME 25 R', channel: '',    ident: 'ICGR', lokasi: 'SHELTER GP 25R' },
  'om-25r':  { jenis: 'om',  label: 'OM 25R',  equip: 'OUTER MARKER 25R' }
};
const MR_URUT = Object.keys(MR_FORMS);

/* ---------- Pembangun seksi (skema per jenis) ---------- */

/** baris data: {no,label,unit}. `no`/`unit` boleh kosong. */
const R = (no, label, unit) => ({ no: no || '', label, unit: unit || '' });
/** baris sub-judul selebar tabel. */
const G = t => ({ group: t });
/** header sel: string sederhana, atau [teks, colspan, rowspan]. */

function mrSeksiLlz(){
  const monRows = [
    G('COURSE :'),
    R('1', 'CENTER LINE RF LEVEL', '%'), R('2', 'CENTER LINE DDM', 'DDM'),
    R('3', 'CENTER LINE SDM', '%'), R('4', 'IDENT MOD PERCENT', '%'),
    R('5', 'WIDTH DDM', 'DDM'), R('6', 'IDENT STATUS', 'NORMAL'),
    G('CLEARANCE :'),
    R('1', 'RF LEVEL', '%'), R('2', 'CLEARANCE 1 DDM', 'DDM'), R('3', 'SDM', '%'),
    R('4', 'IDENT MOD PERCENT', '%'), R('5', 'CLEARANCE 2 DDM', 'DDM'),
    R('6', 'IDENT STATUS', 'NORMAL'), R('7', 'RF FREQ. DIFFERENCE', 'Hz')
  ];
  const cfgRows = [
    G('COURSE'),
    R('1', 'CSB Modulation Balance Offset', 'DDM'), R('2', 'CSB Modulation Percent Scale', '%'),
    R('3', 'CSB RF Voltage Level Scale', '%'), R('4', 'SBO RF Voltage Level Scale', '%'),
    R('5', 'SBO Phase Offset', 'Degrees'), R('6', 'Ident Level Scale', '%'),
    G('Clearance'),
    R('1', 'CSB Modulation Balance Offset', 'DDM'), R('2', 'CSB Modulation Percent Scale', '%'),
    R('3', 'CSB RF Voltage Level Scale', '%'), R('4', 'SBO RF Voltage Level Scale', '%'),
    R('5', 'SBO Phase Offset', 'Degrees'), R('6', 'Ident Level Scale', '%')
  ];
  const wnRows = [
    G('COURSE'),
    R('', 'CSB Mod Balance', 'DDM'), R('', 'CSB Mod Percent', '%'), R('', 'CSB RF Level', '%'),
    R('', 'SBO RF Level', '%'), R('', 'Ident Mod Level', '%'),
    G('Clearance'),
    R('', 'CSB Mod Balance', 'DDM'), R('', 'CSB Mod Percent', '%'), R('', 'CSB RF Level', '%'),
    R('', 'SBO RF Level', '%'), R('', 'Ident Mod Level', '%')
  ];
  return [
    { title: 'MONITOR READING', cols: ['t1im1','t1im2','t1sm1','t1sm2','t1nm1','t1nm2','t2im1','t2im2','t2sm1','t2sm2','t2nm1','t2nm2'],
      head: [
        [['NO',1,3],['PARAMETER',1,3],['TRANSMITTER 1',6],['TRANSMITTER 2',6],['UNIT',1,3]],
        [['INTEGRAL',2],['STANDBY',2],['NFM',2],['INTEGRAL',2],['STANDBY',2],['NFM',2]],
        ['M1','M2','M1','M2','M1','M2','M1','M2','M1','M2','M1','M2']
      ], rows: monRows },
    { title: 'TRANSMITTER WATTMETER DATA', cols: ['c1m','c1s','cl1m','cl1s','c2m','c2s','cl2m','cl2s'],
      head: [
        [['NO',1,2],['PARAMETER',1,2],['COURSE Tx 1',2],['CLEARANCE Tx 1',2],['COURSE Tx 2',2],['CLEARANCE Tx 2',2],['UNIT',1,2]],
        ['MAIN','STANDBY','MAIN','STANDBY','MAIN','STANDBY','MAIN','STANDBY']
      ], rows: [
        R('1','CSB FORWARD POWER','Watts'), R('2','CSB REFLECTED POWER','Watts'),
        R('3','SBO FORWARD POWER','Watts'), R('4','SBO REFLECTED POWER','Watts'),
        R('5','CSB FORWARD POWER','Watts'), R('6','SBO FORWARD POWER','Watts')
      ] },
    { title: 'TRANSMITTER CONFIGURATION', cols: ['tx1','tx2'],
      head: [['NO','PARAMETER','TX1','TX2','UNIT']], rows: cfgRows },
    { title: 'TRANSMITTER CONFIGURATION — Waveform Normal', no: false, cols: ['reading'],
      head: [['PARAMETER','Reading','UNIT']], rows: wnRows },
    { title: 'RMS DATA', no: false, cols: ['data'],
      head: [['PARAMETER','DATA','UNIT']], rows: [
        G('POWER SUPPLY'),
        R('','AC INPUT','VOLT'), R('','Tx 1 - 24 V PS','VOLT'), R('','Tx 2 - 24 V PS','VOLT'),
        R('','BATTERY 1','VOLT'), R('','BATTERY 2','VOLT'),
        G('DC CONVERTER'),
        R('','+5 VDC MONITOR 1','VOLT'), R('','+12 VDC MONITOR 1','VOLT'), R('','-12 VDC MONITOR 1','VOLT'),
        R('','+24 VDC MONITOR 1','VOLT'), R('','+5 VDC MONITOR 2','VOLT'), R('','+12 VDC MONITOR 2','VOLT'),
        R('','-12 VDC MONITOR 2','VOLT'), R('','+24 VDC MONITOR 2','VOLT')
      ] },
    { title: 'BATTERY CHECK', cols: ['charge','discharge'],
      head: [['NO','PARAMETER','CHARGE','DISCHARGE','UNIT']], rows: [
        R('1','VOLTAGE','VOLT'), R('2','CURRENT','AMP')
      ] },
    ...mrSeksiStatusIls(['CLR']),
    ...mrSeksiLingkungan(['AC RUANGAN','ALAT KEBERSIHAN','LAMPU RUANGAN','LAIN-LAIN'])
  ];
}

/** ILS STATUS untuk LLZ (empat sub-tabel + parameter integritas). */
function mrSeksiStatusIls(){
  return [
    { title: 'ILS STATUS — TRANSMITTER ON AIR', no: false, unit: false, cols: ['main','stby'],
      head: [['PARAMETER','MAIN','STANDBY']], rows: [ R('','TRANSMITTER 1'), R('','TRANSMITTER 2') ] },
    { title: 'MONITOR STATUS', no: false, unit: false, cols: ['main','stby'],
      head: [['PARAMETER','MAIN','STANDBY']], rows: [ R('','NORMAL'), R('','ALARM'), R('','BYPASS') ] },
    { title: 'NEAR FIELD MONITOR', no: false, unit: false, cols: ['tx1','tx2'],
      head: [['PARAMETER','TX1','TX2']], rows: [ R('','NORMAL'), R('','ALARM'), R('','BYPASS') ] },
    { title: 'INTEGRITY', no: false, unit: false, cols: ['val'],
      head: [['PARAMETER','NILAI']], rows: [
        R('4','INT. CRS POS'), R('5','INT. CRS WIDTH'), R('6','INT. CLR 1'),
        R('7','INT. CLR 2'), R('8','NFM POS')
      ] }
  ];
}

/** KONDISI LINGKUNGAN + Catatan (label sarana bervariasi antar jenis). */
function mrSeksiLingkungan(sarana){
  return [
    { title: 'KONDISI LINGKUNGAN', unit: false, cols: ['ket'],
      head: [['NO','SARANA','KETERANGAN']],
      rows: sarana.map((s, i) => R(String(i + 1), s)) },
    { title: 'CATATAN', type: 'note' }
  ];
}

function mrSeksiGp(){
  return [
    { title: 'MONITOR READING', cols: ['t1im1','t1im2','t1sm1','t1sm2','t1nm1','t1nm2','t2im1','t2im2','t2sm1','t2sm2','t2nm1','t2nm2'],
      head: [
        [['NO',1,3],['PARAMETER',1,3],['TX1',6],['TX2',6],['UNIT',1,3]],
        [['INTEGRAL',2],['STANDBY',2],['NFM',2],['INTEGRAL',2],['STANDBY',2],['NFM',2]],
        ['M1','M2','M1','M2','M1','M2','M1','M2','M1','M2','M1','M2']
      ], rows: [
        G('COURSE :'),
        R('1','PATH RF LEVEL','%'), R('2','PATH DDM','DDM'), R('3','PATH SDM','%'), R('4','WIDTH DDM','DDM'),
        G('CLEARANCE :'),
        R('1','RF LEVEL','%'), R('2','150Hz MOD PERCENT','%'), R('3','RF FREQ. DIFFERENCE','Hz')
      ] },
    { title: 'TRANSMITTER READING WATTMETER DATA', cols: ['c1m','c1s','cl1m','cl1s','c2m','c2s','cl2m','cl2s'],
      head: [
        [['NO',1,2],['PARAMETER',1,2],['COURSE Tx 1',2],['CLEARANCE Tx 1',2],['COURSE Tx 2',2],['CLEARANCE Tx 2',2],['UNIT',1,2]],
        ['MAIN','STANDBY','MAIN','STANDBY','MAIN','STANDBY','MAIN','STANDBY']
      ], rows: [
        R('1','CSB FORWARD POWER','Watts'), R('2','CSB REFLECTED POWER','Watts'),
        R('3','SBO FORWARD POWER','Watts'), R('4','SBO REFLECTED POWER','Watts'),
        R('5','FORWARD POWER','Watts'), R('6','REFLECTED POWER','Watts')
      ] },
    { title: 'ANTENA PARAMETERS', cols: ['tx1','tx2'],
      head: [['PARAMETER','TX 1','TX 2','UNIT']], rows: [
        R('','UPPER','Watts'), R('','MIDDLE','Watts'), R('','LOWER','Watts')
      ] },
    { title: 'TRANSMITTER CONFIGURATION', cols: ['tx1','tx2'],
      head: [['NO','PARAMETER','TX1','TX2','UNIT']], rows: [
        G('COURSE'),
        R('1','CSB Modulation Balance Offset','DDM'), R('2','CSB Modulation Percent Scale','%'),
        R('3','CSB RF Voltage Level Scale','%'), R('4','SBO RF Voltage Level Scale','%'),
        R('5','SBO Phase Offset','Degrees'),
        G('Clearance'),
        R('1','Modulation Percent Scale','%'), R('2','RF Voltage Level Scale','%')
      ] },
    { title: 'TRANSMITTER CONFIGURATION — Waveform Normal', no: false, cols: ['reading'],
      head: [['PARAMETER','Reading','UNIT']], rows: [
        G('COURSE'),
        R('','CSB Mod Balance','DDM'), R('','CSB Mod Percent','%'), R('','CSB RF Level','%'), R('','SBO RF Level','%'),
        G('Clearance'),
        R('','Mod Percent','%'), R('','RF Level','%')
      ] },
    { title: 'RMS DATA', no: false, cols: ['data'],
      head: [['PARAMETER','DATA','UNIT']], rows: [
        G('POWER SUPPLY'),
        R('','AC INPUT','VOLT'), R('','Tx 1 - 24 V PS','VOLT'), R('','Tx 2 - 24 V PS','VOLT'),
        R('','BATTERY 1','VOLT'), R('','BATTERY 2','VOLT'),
        G('DC CONVERTER'),
        R('','+5 VDC MONITOR 1','VOLT'), R('','+12 VDC MONITOR 1','VOLT'), R('','-12 VDC MONITOR 1','VOLT'),
        R('','+24 VDC MONITOR 1','VOLT'), R('','+5 VDC MONITOR 2','VOLT'), R('','+12 VDC MONITOR 2','VOLT'),
        R('','-12 VDC MONITOR 2','VOLT'), R('','+24 VDC MONITOR 2','VOLT')
      ] },
    { title: 'BATTERY CHECK', cols: ['charge','discharge'],
      head: [['NO','PARAMETER','CHARGE','DISCHARGE','UNIT']], rows: [
        R('1','VOLTAGE','VOLT'), R('2','CURRENT','AMP')
      ] },
    { title: 'ILS STATUS — TRANSMITTER ON AIR', no: false, unit: false, cols: ['main','stby'],
      head: [['PARAMETER','MAIN','STBY']], rows: [ R('','TRANSMITTER 1'), R('','TRANSMITTER 2') ] },
    { title: 'MONITOR STATUS', no: false, unit: false, cols: ['intg','stby'],
      head: [['PARAMETER','INTG','STBY']], rows: [ R('','NORMAL'), R('','ALARM'), R('','BYPASS') ] },
    { title: 'NEAR FIELD MONITOR', no: false, unit: false, cols: ['val'],
      head: [['PARAMETER','STATUS']], rows: [ R('','NORMAL'), R('','ALARM'), R('','BYPASS') ] },
    { title: 'INTEGRITY', no: false, unit: false, cols: ['val'],
      head: [['PARAMETER','NILAI']], rows: [
        R('4','INT PATH POS'), R('5','INT PATH WIDTH'), R('6','NFM PATH')
      ] },
    ...mrSeksiLingkungan(['SUHU RUANGAN','ALAT KEBERSIHAN','LAMPU RUANGAN','LAIN-LAIN'])
  ];
}

function mrSeksiTdme(){
  const monRows = [
    R('1','Delay','49.68 - 50.32 µs'), R('2','Spacing','11.68 - 12.32 µs'),
    R('3','Tx Power','550 - 1225 watts'), R('4','ERP','-2.7 - 0.9 dB'),
    R('5','Efficiency','73.0 %'), R('6','PRF','730 - 6000 ppps'),
    R('7','Tx Freq','1198.004 MHz'), R('8','Tx Freq.Error','-18 - 18 ppm'),
    R('9','Rx LO Freq','109.004 MHz'), R('10','Rx LO Freq.Error','-18 - 18 ppm'),
    R('11','Rx Freq.','1134.997 MHz'), R('12','VSWR','3.0 :1'),
    R('13','Ident Status','NORMAL'), R('14','Ident Code','')
  ];
  const monHead = [
    [['NO',1,2],['PARAMETER',1,2],['TX I',2],['TX II',2],['LIMIT',1,2]],
    ['INTEGRAL','STAND BY','INTEGRAL','STAND BY']
  ];
  return [
    { title: 'MONITOR DATA — MONITOR 1', cols: ['ti_int','ti_stby','tii_int','tii_stby'], head: monHead, rows: monRows },
    { title: 'MONITOR DATA — MONITOR 2', cols: ['ti_int','ti_stby','tii_int','tii_stby'], head: monHead, rows: monRows },
    { title: 'POWER SUPPLY DATA', cols: ['data'],
      head: [['NO','PARAMETER','DATA','LIMIT']], rows: [
        R('1','AC INPUT','98 - 132 V'), R('2','TX 1 48 Voltage','46.6 - 54.4 V'),
        R('3','TX 1 Current','0.5 - 15.0 A'), R('4','TX 2 48 Voltage','46.6 - 54.4 V'),
        R('5','TX 2 Current','0.5 - 15.0 A')
      ] },
    { title: 'BATTERY CHECK', no: false, unit: false, cols: ['current','voltage'],
      head: [['PARAMETER','Current (Amp)','Voltage (Volts)']], rows: [
        R('','CHARGE'), R('','DISCHARGE')
      ] }
  ];
}

function mrSeksiOm(){
  return [
    { title: 'MONITOR READING', cols: ['m1','m2','mstby'],
      head: [
        [['NO',1,2],['PARAMETER',1,2],['DATA MONITOR',3],['UNIT',1,2]],
        ['MONITOR 1','MONITOR 2','MONITOR STANDBY']
      ], rows: [
        R('1','RF LEVEL','dB'), R('2','IDENT MODULATION','%')
      ] },
    { title: 'TRANSMITTER READING', cols: ['t1','t2'],
      head: [
        [['NO',1,2],['PARAMETER',1,2],['TRANSMITTER DATA',2],['UNIT',1,2]],
        ['TRANSMITTER 1','TRANSMITTER 2']
      ], rows: [
        R('1','FORWARD POWER','WATTS'), R('2','REFLECTED POWER','WATTS'), R('3','VSWR','WATTS')
      ] },
    { title: 'RMS DATA POWER SUPPLY', cols: ['sys1','sys2','mb1','mb2'],
      head: [
        [['NO',1,2],['PARAMETER',1,2],['DATA',4],['UNIT',1,2]],
        ['SYS. 1','SYS. 2','MB. 1','MB. 2']
      ], rows: [
        R('1','AC INPUT','VOLT'), R('2','15VDC','VOLT')
      ] },
    { title: 'ILS STATUS — TRANSMITTER ON AIR', no: false, unit: false, cols: ['main','stby'],
      head: [['PARAMETER','MAIN','STANDBY']], rows: [ R('','TRANSMITTER 1'), R('','TRANSMITTER 2') ] },
    { title: 'MONITOR STATUS', no: false, unit: false, cols: ['intg','stby'],
      head: [['PARAMETER','INTEGRAL','STANDBY']], rows: [ R('','NORMAL'), R('','ALARM'), R('','BYPASS') ] },
    { title: 'MONITOR STANDBY', no: false, unit: false, cols: ['val'],
      head: [['PARAMETER','NILAI']], rows: [ R('4','RF LEVEL'), R('5','IDENT MODULATION') ] },
    { title: 'BATTERY CHECK', cols: ['charge','discharge'],
      head: [['NO','PARAMETER','CHARGE','DISCHARGE','UNIT']], rows: [
        R('1','VOLTAGE','VOLT'), R('2','CURRENT','AMPERE')
      ] },
    ...mrSeksiLingkungan(['AC RUANGAN','ALAT KEBERSIHAN','LAMPU RUANGAN','LAIN-LAIN'])
  ];
}

/** Seksi untuk sebuah lembar (dari jenisnya). */
function mrSeksi(formId){
  const jenis = (MR_FORMS[formId] || {}).jenis;
  if(jenis === 'llz') return mrSeksiLlz();
  if(jenis === 'gp')  return mrSeksiGp();
  if(jenis === 'tdme')return mrSeksiTdme();
  if(jenis === 'om')  return mrSeksiOm();
  return [];
}

/* ---------- State lembar yang sedang diisi ---------- */

let mrForm = 'llz-07l';
let mrData = {};              // { `${si}_${ri}_${col}`: string }
let mrTeknisiRows = [];
let mrTeknisiSeq = 0;

const mrKey = (si, ri, col) => si + '_' + ri + '_' + col;
function mrSet(si, ri, col, val){ mrData[mrKey(si, ri, col)] = val; }
function mrVal(data, si, ri, col){ const v = data[mrKey(si, ri, col)]; return v === undefined ? '' : v; }

/* ---------- Render tabel dari skema ---------- */

/** Kepala tabel: sec.head = deret baris; sel = string | [teks,colspan,rowspan]. */
function mrHead(sec, cetak){
  const fs = cetak ? 'font-size:6.4pt;' : '';
  return '<thead>' + sec.head.map(baris =>
    '<tr>' + baris.map(sel => {
      const t = Array.isArray(sel) ? sel[0] : sel;
      const cs = Array.isArray(sel) && sel[1] ? ` colspan="${sel[1]}"` : '';
      const rs = Array.isArray(sel) && sel[2] ? ` rowspan="${sel[2]}"` : '';
      return `<th${cs}${rs} style="${fs}">${escapeHtml(t)}</th>`;
    }).join('') + '</tr>'
  ).join('') + '</thead>';
}

/** Jumlah kolom total satu seksi (untuk colspan baris sub-judul). */
function mrTotalCol(sec){
  return (sec.no === false ? 0 : 1) + 1 + sec.cols.length + (sec.unit === false ? 0 : 1);
}

/** Satu sel terukur. mode 'form' → input; selainnya → teks. */
function mrCell(si, ri, col, data, mode, cetak){
  const val = mrVal(data, si, ri, col);
  if(mode === 'form'){
    return `<td><input type="text" id="mr_${si}_${ri}_${col}" value="${escapeHtml(val)}"
      oninput="mrSet(${si},${ri},'${col}',this.value)"
      style="width:100%;box-sizing:border-box;background:var(--panel-2);border:1px solid var(--line);color:var(--text);border-radius:5px;padding:5px 3px;font-size:12.5px;text-align:center;"></td>`;
  }
  return `<td style="text-align:center;${cetak ? 'font-size:6.4pt;' : ''}">${escapeHtml(val) || '-'}</td>`;
}

/** Satu seksi tabel. */
function mrSeksiTabel(sec, si, data, mode){
  const cetak = mode === 'cetak';
  const fs = cetak ? 'font-size:6.4pt;' : '';
  if(sec.type === 'note'){
    const val = mrVal(data, si, 0, 'note');
    const isi = mode === 'form'
      ? `<textarea id="mr_${si}_0_note" oninput="mrSet(${si},0,'note',this.value)" rows="2"
           style="width:100%;box-sizing:border-box;background:var(--panel-2);border:1px solid var(--line);color:var(--text);border-radius:6px;padding:8px;font-size:13px;">${escapeHtml(val)}</textarea>`
      : `<div style="min-height:20px;white-space:pre-wrap;${fs}">${escapeHtml(val) || '-'}</div>`;
    return `<div class="mr-seksi"><div class="mr-seksi-judul" style="${fs}">${escapeHtml(sec.title)}</div>${isi}</div>`;
  }
  const total = mrTotalCol(sec);
  const body = sec.rows.map((r, ri) => {
    if(r.group){
      return `<tr class="mr-grp"><td colspan="${total}" style="text-align:left;font-weight:bold;${fs}">${escapeHtml(r.group)}</td></tr>`;
    }
    let tds = '';
    if(sec.no !== false) tds += `<td style="text-align:center;color:var(--muted);${fs}">${escapeHtml(r.no)}</td>`;
    tds += `<td class="mr-par" style="${fs}">${escapeHtml(r.label)}</td>`;
    tds += sec.cols.map(col => mrCell(si, ri, col, data, mode, cetak)).join('');
    if(sec.unit !== false) tds += `<td style="text-align:center;color:var(--muted);${fs}">${escapeHtml(r.unit)}</td>`;
    return `<tr>${tds}</tr>`;
  }).join('');
  const cls = cetak ? 'mr-tbl mr-print' : 'mr-tbl';
  const tableStyle = cetak ? 'width:100%;border-collapse:collapse;'
                           : 'width:100%;border-collapse:collapse;min-width:' + Math.max(520, total * 68) + 'px;';
  return `<div class="mr-seksi">
    <div class="mr-seksi-judul" style="${fs}">${escapeHtml(sec.title)}</div>
    <div style="overflow-x:auto;"><table class="${cls}" style="${tableStyle}">${mrHead(sec, cetak)}<tbody>${body}</tbody></table></div>
  </div>`;
}

/** Seluruh lembar (semua seksi). */
function mrLembar(formId, data, mode){
  return mrSeksi(formId).map((sec, si) => mrSeksiTabel(sec, si, data, mode)).join('');
}

function renderMrTable(){
  const wrap = document.getElementById('mrWrap');
  if(wrap) wrap.innerHTML = mrLembar(mrForm, mrData, 'form');
}

/* ---------- Teknisi (nama + baris dinamis) ---------- */

function renderMrTeknisi(){
  const wrap = document.getElementById('mrTeknisiList');
  if(!wrap) return;
  wrap.innerHTML = mrTeknisiRows.map((t, i) => `
    <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;">
      <span style="font-family:var(--font-mono);color:var(--accent);font-size:12px;min-width:18px;">${i + 1}.</span>
      <input type="text" value="${escapeHtml(t.nama)}" placeholder="${T('namaTeknisiPelaksana')} ${i + 1}"
             list="teknisiDatalist"
             oninput="mrTeknisiRows[${i}].nama=this.value"
             style="flex:1;background:var(--panel-2);border:1px solid var(--line);color:var(--text);border-radius:6px;padding:9px 10px;font-size:16px;">
      ${mrTeknisiRows.length > 1 ? `<button class="icon-btn" onclick="hapusMrTeknisi('${t.key}')">✕</button>` : ''}
    </div>`).join('');
}
function addMrTeknisi(){
  const isiAwal = mrTeknisiRows.length === 0 && userSaatIni ? (userSaatIni.nama || userSaatIni.username || '') : '';
  mrTeknisiRows.push({ key: 'm' + (mrTeknisiSeq++), nama: isiAwal });
  renderMrTeknisi();
}
function hapusMrTeknisi(key){ mrTeknisiRows = mrTeknisiRows.filter(x => x.key !== key); renderMrTeknisi(); }

/* ---------- Modal (buka / tutup / simpan) ---------- */

function openMrModal(form){
  if(!MR_FORMS[form]) form = MR_URUT[0];
  mrForm = form;
  mrData = {};
  const def = MR_FORMS[form];
  document.getElementById('mrModalJudul').textContent = 'Meter Reading — ' + def.label;
  const meta = [def.equip];
  if(def.freq) meta.push('FREQ: ' + def.freq);
  if(def.channel) meta.push('CH: ' + def.channel);
  if(def.ident) meta.push('IDENT: ' + def.ident);
  document.getElementById('mrModalMeta').textContent = meta.join('  ·  ');
  document.getElementById('mrTanggal').value = tanggalHariIni();
  // Jam terisi otomatis (picker HH:MM) supaya tak perlu ketik manual; tetap
  // bisa digeser kalau lembarnya diisi untuk jam pemeriksaan yang lain.
  document.getElementById('mrJam').value = (typeof jamSekarang === 'function') ? jamSekarang() : '';
  document.getElementById('mrManagerNama').value = '';
  document.getElementById('mrManagerAkun').value = '';
  mrTeknisiRows = []; mrTeknisiSeq = 0; addMrTeknisi();
  if(!sigPads['sigMr']) setupSigCanvas('sigMr');
  resizeSigCanvas('sigMr'); clearSig('sigMr');
  // Kanvas TTD SENGAJA dibiarkan kosong — teknisi tanda tangan sendiri, atau
  // klik "✍ pakai TTD tersimpan". Jangan auto-tempel.
  if(typeof pasangTombolTtdTersimpan === 'function') pasangTombolTtdTersimpan();
  renderMrTable();
  document.getElementById('mrModalBg').classList.add('show');
  setTimeout(() => resizeSigCanvas('sigMr'), 60);
}
function closeMrModal(){ document.getElementById('mrModalBg').classList.remove('show'); }

async function saveMr(){
  const btn = document.getElementById('mrSaveBtn'); btn.disabled = true;
  try{
    const state = {
      __format: 'mrreading', __mrForm: mrForm,
      header: { jam: document.getElementById('mrJam').value.trim() },
      data: mrData
    };
    const saved = await gsRun('addDsTest', {
      unit: unitAktif,
      kategori: 'mrreading',
      tanggal: document.getElementById('mrTanggal').value,
      state,
      teknisiNamaList: mrTeknisiRows.map(t => (t.nama || '').trim()).filter(Boolean),
      teknisiTtd: getSigDataUrl('sigMr'),
      managerNama: document.getElementById('mrManagerNama').value.trim(),
      ttdUntuk: ttdUntukTerpilih('mrManagerAkun', document.getElementById('mrManagerNama').value)
    });
    dsList.unshift(mapDs(saved));
    renderMrList(mrForm);
    closeMrModal();
    toast('Meter Reading tersimpan.');
  }catch(e){ toast(T('gagalSimpan') + ' — ' + (e.message || T('coba'))); }
  btn.disabled = false;
}

/* ---------- Daftar riwayat (satu daftar per lembar) ---------- */

const mrAdalah = (d, form) => !!(d && d.state && d.state.__format === 'mrreading' &&
                                 (!form || d.state.__mrForm === form));

let mrTampilSemua = {};
function resetCariMr(form){
  mrTampilSemua[form] = true;
  const el = document.getElementById('cariMrTanggal-' + form); if(el) el.value = '';
  renderMrList(form);
}

function renderMrList(form){
  const wrap = document.getElementById('mrList-' + form);
  if(!wrap) return;
  const semua = (typeof dsList !== 'undefined' ? dsList : []).filter(d => mrAdalah(d, form));
  const tgl = (document.getElementById('cariMrTanggal-' + form) || {}).value || '';
  const daftar = tgl ? semua.filter(d => String(d.tanggal || '').slice(0, 10) === tgl)
                     : (mrTampilSemua[form] ? semua : semua.filter(d => dalamSeminggu(d.tanggal)));

  if(semua.length === 0){ wrap.innerHTML = '<div class="empty">Belum ada Meter Reading.</div>'; return; }
  if(daftar.length === 0){ wrap.innerHTML = '<div class="empty">' + T('takAdaHasil') + '</div>'; return; }

  wrap.innerHTML = daftar.map(d => {
    return `<div class="dc-history-item">
      <div><b>${escapeHtml(d.tanggal)}</b></div>
      <span class="tag ok">${escapeHtml((MR_FORMS[form] || {}).label || form)}</span>
      <div style="font-size:11.5px;color:var(--muted);">${T('teknisiPelaksana')}: ${escapeHtml(d.teknisiNama) || '-'}</div>
      ${diinputOlehHtml(d.diinputOleh, d.dibuatPada, String(d.tanggal || '').slice(0, 10))}
      <div style="display:flex;gap:4px;">
        <button class="btn ghost" style="padding:6px 10px;" onclick="openMrDetail('${d.id}')">${T('detail')}</button>
        <button class="icon-btn" title="${T('cetak')}" onclick="printMr('${d.id}')">🖨</button>
        <button class="icon-btn hanya-admin" title="${T('hapus')}" onclick="hapusMr('${d.id}')">✕</button>
      </div>
    </div>`;
  }).join('');
}

/** Segarkan semua daftar (dipanggil init/terapkanUnit). */
function renderSemuaMrList(){ MR_URUT.forEach(renderMrList); }

async function hapusMr(id){
  if(!adminAktif()){ toast(T('hanyaAdminHapus')); return; }
  const d = dsList.find(x => x.id === id);
  if(!confirm(`${T('konfirmasiHapus')} ${d ? d.tanggal : ''}?`)) return;
  const form = (d && d.state && d.state.__mrForm) || MR_URUT[0];
  const salinan = dsList.slice();
  dsList = dsList.filter(x => x.id !== id);
  renderMrList(form);
  try{ await gsRun('deleteDsTest', id); }
  catch(e){ dsList = salinan; renderMrList(form); toast(T('gagalHapus') + ' — ' + (e.message || T('coba'))); }
}

/* ---------- Detail & cetak ---------- */

function mrInfoBaris(d){
  const form = (d.state && d.state.__mrForm) || MR_URUT[0];
  const def = MR_FORMS[form] || {};
  const h = (d.state && d.state.header) || {};
  const info = [
    ['Tanggal', d.tanggal],
    ['Jam', h.jam || '-'],
    ['Equipment', def.equip || '-']
  ];
  if(def.freq) info.push(['Frequency', def.freq]);
  if(def.channel) info.push(['Channel', def.channel]);
  if(def.ident) info.push(['Ident', def.ident]);
  if(def.lokasi) info.push(['Lokasi', def.lokasi]);
  return info;
}

function openMrDetail(id){
  const d = dsList.find(x => x.id === id);
  if(!d || !d.state) return;
  const form = d.state.__mrForm || MR_URUT[0];
  const data = d.state.data || {};
  const info = mrInfoBaris(d).map(([k, v]) =>
    `<div><span style="color:var(--muted);">${escapeHtml(k)}:</span> <b>${escapeHtml(v)}</b></div>`).join('');
  document.getElementById('formDetailJudul').textContent = 'Meter Reading ' + (MR_FORMS[form] || {}).label;
  document.getElementById('formDetailBody').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 18px;font-size:12.5px;line-height:1.6;margin-bottom:12px;">${info}</div>
    ${mrLembar(form, data, 'detail')}
    <div class="detail-ttd">
      <div class="sig-block"><b>${T('teknisiPelaksana')}</b>${escapeHtml(d.teknisiNama) || '-'}${sigThumbHtml(d.teknisiTtd)}</div>
      <div class="sig-block"><b>${T('mengetahuiManager')}</b>${renderPihakKedua('dstest', d.id, d.managerNama, d.managerTtd)}${sigPejabatHtml('dstest', d.id, d.managerTtd, d)}</div>
    </div>
    <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line);">${diinputOlehHtml(d.diinputOleh, d.dibuatPada, String(d.tanggal || '').slice(0, 10))}</div>`;
  document.getElementById('formDetailPrintBtn').onclick = () => { closeFormDetail(); printMr(id); };
  document.getElementById('formDetailBg').classList.add('show');
}

function printMr(id){
  const d = dsList.find(x => x.id === id);
  if(!d || !d.state) return;
  if(!tolakCetakBilaBelumTtd(d, 'dstest')) return;
  const form = d.state.__mrForm || MR_URUT[0];
  const def = MR_FORMS[form] || {};
  const data = d.state.data || {};
  const info = mrInfoBaris(d).map(([k, v]) =>
    `<tr><td style="padding:0 6px 1px 0;white-space:nowrap;">${escapeHtml(k)}</td><td>: ${escapeHtml(v)}</td></tr>`).join('');
  doPrint(`
    <div style="text-align:center;font-weight:bold;font-size:12pt;">METER READING — INSTRUMENT LANDING SYSTEM</div>
    <div style="text-align:center;font-size:10pt;margin-bottom:6px;">SELEX-SI · ${escapeHtml(def.equip || def.label)}</div>
    <table class="no-border" style="font-size:8pt;margin-bottom:8px;"><tbody>${info}</tbody></table>
    ${mrLembar(form, data, 'cetak')}
    <table class="no-border" style="font-size:9pt;margin-top:14px;">
      <tr>
        <td style="width:55%;text-align:left;vertical-align:top;">
          <div style="margin-bottom:6px;">PETUGAS :</div>
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
