/* E-Logbook · js/17h-meter-radkom.js — Preventive Maintenance unit Radkom
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh.

   Tiga belas lembar dari "METER READING.xlsx" (folder Radkom) dijadikan
   SUB-TAB Preventive Maintenance, mengikuti komposisi tab yang diminta:

     rk-ming     MINGGUAN   → Radio 710 · Radio 720 · Radio MER · Radio TER
     rk-bul      BULANAN    → Radio 710 · Radio 720 · Radio MER · Radio TER
     rk-rstx     RADIO R&S TX   (Meter Reading Transmitter HF MWARA, Gedung 710)
     rk-rsrx     RADIO R&S RX   (Meter Reading Receiver HF MWARA, Gedung 720)
     rk-battery  BATTERY        (Pengukuran Battery dan Kondisi Charger)
     rk-txvhf    TX VHF         (Preventive Maintenance Transmitter VHF, semesteran)
     rk-antvhf   ANTENA VHF     (Preventive Maintenance Antena VHF, tahunan)

   Mingguan dan Bulanan bertingkat (.lvl, handler generik di 04-toast-tab.js):
   satu sub-tab, di dalamnya empat lembar — satu per gedung/ruang radio. Tiap
   lembar punya riwayat, TTD Manager Teknik, dan cetaknya sendiri.

   ISI LEMBAR DISALIN APA ADANYA dari sheet-nya, termasuk perbedaan kecil antar
   sheet yang mungkin disengaja pembuatnya:
     · daftar frekuensi 720 Mingguan (21 item) ≠ 720 Bulanan (22 item, +127.95);
     · MER item 2: Mingguan 124.55 (EQP 1) / 135.9 (EQP 2), Bulanan terbalik;
     · kolom "Pengukuran Catu Daya" di 710 Bulanan ada di ANTARA transmitter dan
       receiver (TX: VAC · VDC); di 720 / MER / TER ada SETELAH receiver (Tx VAC ·
       Rx VAC);
     · beberapa item punya EQP 3 & 4, bukan 1 & 2 (MER 121.75, TER 127.9 RCU).
   Yang dirapikan hanya penomoran (710 Mingguan/Bulanan menomori "5" dua kali —
   di sini 1..22 berurutan) dan koma desimal "132,7" → "132.7".

   FREKUENSI & MERK BISA DISUNTING. Di sheet nilainya tetap, tapi di sini
   dijadikan kotak isian yang sudah terisi nilai sheet — kalau kelak ada radio
   yang diganti frekuensinya, teknisi cukup menimpa angkanya tanpa menunggu
   kode diubah; nilai yang tersimpan ikut ke detail & cetak.

   PENYIMPANAN. Menumpang tabel `dstest` seperti 17c–17g: dibedakan lewat
   state.__format === 'mrradkom' + state.__rkForm (id lembar). Seluruh rangkaian
   TTD Manager Teknik, kotak masuk TTD, sunting (updateDsTest), hapus, dan
   cetak sudah tersedia untuk 'dstest'. Guard daftar-site di insertDsTest
   (db.js + db-pg.js) dilewati untuk format ini.

   BENTUK LEMBAR = GRID. Berbeda dengan 17g yang tabelnya "baris item × kolom
   ukur", lembar Radkom banyak sel yang di-merge menurun (satu frekuensi dua
   baris EQP; satu radio empat baris IBIT/IP). Karena itu tiap lembar dibangun
   sebagai grid eksplisit: `head` (baris kepala, sel = teks atau [teks, colspan,
   rowspan]) dan `body` (baris data, sel = objek RK_*). Penggambar cuma satu,
   tiga mode: 'isi' | 'baca' | 'cetak'. Nilai disimpan datar di rkData[kunci].

   SEMUA KOTAK ISIAN DIWARNAI SENDIRI lewat kelas .rk-isi (css/05-tabel.css) —
   jangan biarkan ada <input> di berkas ini yang lolos tanpa warna. */

/* ---------- Pembentuk sel grid ---------- */

/** Sel teks tetap (nomor, label IBIT, satuan, angka EQP). */
const RKT = (v, opsi) => Object.assign({ t:'txt', v: String(v == null ? '' : v) }, opsi || {});
/** Sel isian teks. `def` = nilai awal (mis. frekuensi dari sheet). */
const RKI = (k, opsi) => Object.assign({ k }, opsi || {});
/** Sel pilihan berputar (√ / X). */
const RKP = (k, opsi, kelas, extra) => Object.assign({ k, opsi, kelas }, extra || {});

/* ---------- Daftar frekuensi per lembar VHF A/G ----------
   V(freq, merk, eqp): freq string = sama untuk semua EQP (sel di-merge menurun
   seperti sheet); freq array = satu per EQP (MER/TER item 135.9 / 124.55). */
const V = (f, merk, eqp) => ({ f, merk, eqp: eqp || ['1', '2'] });

const RK_F_710 = [
  V('118.2', 'SELEX OTE'),  V('118.75', 'SELEX OTE'), V('125.45', 'SELEX OTE'),
  V('127.9', 'SELEX OTE'),  V('127.95', 'SELEX OTE'), V('119.75', 'SELEX OTE'),
  V('127.95', 'SELEX OTE'), V('123.75', 'SELEX OTE'), V('124.35', 'SELEX OTE 100W'),
  V('126.85', 'PAE'),       V('124.95', 'SELEX OTE'), V('126.45', 'SELEX OTE'),
  V('124.15', 'SELEX OTE'), V('125.75', 'SELEX OTE'), V('121.5', 'SELEX OTE'),
  V('125.35', 'SELEX OTE'), V('132.2', 'SELEX OTE'),  V('135.9', 'SELEX OTE 100W'),
  V('125.05', 'SELEX OTE'), V('119.3', 'SELEX OTE'),  V('132.7', 'SELEX OTE 100W'),
  V('129.9', 'SELEX OTE 100W')
];
const RK_F_720_MING = [
  V('118.2', 'SELEX OTE'),  V('118.75', 'SELEX OTE'), V('125.45', 'SELEX OTE'),
  V('127.9', 'SELEX OTE'),  V('119.75', 'SELEX OTE'), V('123.75', 'SELEX OTE'),
  V('125.55', 'SELEX OTE'), V('124.35', 'SELEX OTE'), V('124.95', 'SELEX OTE'),
  V('124.15', 'SELEX OTE'), V('126.45', 'SELEX OTE'), V('125.75', 'SELEX OTE'),
  V('121.5', 'SELEX OTE'),  V('125.35', 'SELEX OTE'), V('132.2', 'SELEX OTE'),
  V('135.9', 'SELEX OTE'),  V('125.05', 'SELEX OTE'), V('119.3', 'SELEX OTE'),
  V('132.7', 'SELEX OTE'),  V('129.9', 'SELEX OTE'),  V('126.85', 'PAE')
];
const RK_F_720_BUL = [
  V('118.2', 'SELEX OTE'),  V('118.75', 'SELEX OTE'), V('125.45', 'SELEX OTE'),
  V('127.9', 'SELEX OTE'),  V('127.95', 'SELEX OTE'), V('119.75', 'SELEX OTE'),
  V('123.75', 'SELEX OTE'), V('125.55', 'SELEX OTE'), V('124.35', 'SELEX OTE'),
  V('124.95', 'SELEX OTE'), V('124.15', 'SELEX OTE'), V('126.45', 'SELEX OTE'),
  V('125.75', 'SELEX OTE'), V('121.5', 'SELEX OTE'),  V('125.35', 'SELEX OTE'),
  V('132.2', 'SELEX OTE'),  V('135.9', 'SELEX OTE'),  V('125.05', 'SELEX OTE'),
  V('119.3', 'SELEX OTE'),  V('132.7', 'SELEX OTE'),  V('129.9', 'SELEX OTE'),
  V('126.85', 'PAE')
];
const RK_F_MER_MING = [
  V('123.15', 'PAE'), V(['124.55', '135.9'], 'PAE'), V('127.95', 'PAE'),
  V('127.9 (RCU)', 'PAE'), V('130.1', 'PAE'), V(['132.7 (RCU)', '125.45 (RCU)'], 'PAE'),
  V('132.1', 'PAE'), V('124.2', 'PAE'), V('121.75', 'PAE', ['3', '4']),
  V('124.35 (RCU)', 'OTE SELEX')
];
const RK_F_MER_BUL = [
  V('123.15', 'PAE'), V(['135.9', '124.55'], 'PAE'), V('127.95', 'PAE'),
  V('127.9 (RCU)', 'PAE'), V('130.1', 'PAE'), V(['132.7 (RCU)', '125.45 (RCU)'], 'PAE'),
  V('132.1', 'PAE'), V('124.2', 'PAE'), V('121.75', 'PAE', ['3', '4']),
  V('124.35 (RCU)', 'OTE SELEX')
];
const RK_F_TER = [
  V('128.95', 'SELEX'), V('121.95', 'SELEX'), V('121.6', 'SELEX'), V('124.25', 'SELEX'),
  V('129.9', 'SELEX'),  V('120.25', 'SELEX'), V('128.85', 'SELEX'), V('125.15', 'PAE'),
  V('127.9 (RCU)', 'PAE', ['3', '4']), V(['135.9', '124.55'], 'PAE'), V('132.1', 'PAE'),
  V('123.15', 'PAE'),   V('130.1', 'PAE'),    V(['132.7 (RCU)', '125.45 (RCU)'], 'PAE'),
  V('127.95', 'PAE'),   V('121.75', 'PAE')
];

/* ---------- Grid lembar VHF A/G (Mingguan & Bulanan) ----------
   catu: null (mingguan) | 'tengah' (710 bulanan: TX VAC·VDC di antara TX & RX)
                         | 'akhir'  (720/MER/TER bulanan: Tx VAC · Rx VAC di ujung) */
function rkGridVhf(daftar, catu){
  const txHead = [['PARAMETER TRANSMITTER', 6]];
  const rxHead = [['PARAMETER RECEIVER', 3]];
  const h1 = [['NO', 1, 3], ['FREQ. (MHz)', 1, 3], ['MERK', 1, 3], ['EQP', 1, 3]].concat(txHead);
  const h2 = [['MEASURE', 3], 'SET RF OUT', 'SET MOD', 'SET AF IN P'];
  const h3 = ['RF OUT (Watt)', 'VSWR', 'TEMP (°C)', 'watt', '%', 'dBm'];
  let cols = ['rfout', 'vswr', 'temp', 'setrf', 'setmod', 'setafin'];
  if(catu === 'tengah'){
    h1.push(['PENGUKURAN CATU DAYA', 2]); h2.push(['TX', 2]); h3.push('VAC', 'VDC');
    cols = cols.concat(['txvac', 'txvdc']);
  }
  h1.push(...rxHead); h2.push('RSSI', 'SET AF OUT', 'SQUELCH'); h3.push('dBm', 'dBm', 'dBm');
  cols = cols.concat(['rssi', 'setafout', 'squelch']);
  if(catu === 'akhir'){
    h1.push(['PENGUKURAN CATU DAYA', 2]); h2.push('Tx', 'Rx'); h3.push('VAC', 'VAC');
    cols = cols.concat(['txvac', 'rxvac']);
  }
  h1.push(['KETERANGAN', 1, 3]);

  const body = [];
  daftar.forEach((it, i)=>{
    const n = it.eqp.length;
    it.eqp.forEach((e, j)=>{
      const row = [];
      if(j === 0){
        row.push(RKT(i + 1, { rs: n, muted: true }));
        if(!Array.isArray(it.f)) row.push(RKI(`i${i}_f`, { def: it.f, rs: n, w: 'freq' }));
      }
      if(Array.isArray(it.f)) row.push(RKI(`r${i}_${j}_f`, { def: it.f[j] || '', w: 'freq' }));
      if(j === 0) row.push(RKI(`i${i}_m`, { def: it.merk, rs: n, w: 'merk' }));
      row.push(RKT(e, { muted: true }));
      cols.forEach(c=>row.push(RKI(`r${i}_${j}_${c}`)));
      row.push(RKI(`r${i}_${j}_ket`, { ket: true }));
      body.push(row);
    });
  });
  return { head: [h1, h2, h3], body, lebar: { no: 3, freq: 8, merk: 9, eqp: 3, ket: 14 } };
}

/* ---------- Grid Radio R&S (HF MWARA) ----------
   Satu radio = empat baris (IBIT Status · Connection Quality · CH Auto Recall
   Time · User level) bersanding dengan empat baris IP (IP Address Radio · IP
   Address (C.U) · Sub Mask · Gateway). Kolom lain di-merge empat baris. */
const RK_IBIT = ['IBIT Status', 'Connection Quality', 'CH Auto Recall Time', 'User level'];
const RK_IP_TX = [['IP Address Radio', ''], ['IP Address', '172.18.14.'], ['Sub Mask', '255.255.255.'], ['Gateway ad', '0.0.0.']];
const RK_IP_RX = [['IP Address Radio', '172.18.14.'], ['IP Address C.U', '172.18.14.'], ['Sub Mask', '255.255.255.'], ['Gateway ad', '0.0.0.']];

function rkGridRs(jenis){
  const tx = jenis === 'tx';
  const ip = tx ? RK_IP_TX : RK_IP_RX;
  // NO di sheet RX sudah terisi (3, 5, 7, 9, 11, 12); di TX kosong.
  const blok = tx ? ['', ''] : ['3', '5', '7', '9', '11', '12'];
  const kolom2 = tx ? 'HARI/ TANGGAL' : 'FREQ';
  const ukur = tx ? ['POWER', 'MODE', 'SQUELCH', 'ERRORS'] : ['BW', 'MODE', 'SQUELCH', 'RSSI Thres'];
  const ukurK = tx ? ['power', 'mode', 'squelch', 'errors'] : ['bw', 'mode', 'squelch', 'rssi'];
  const head = [['NO', kolom2, 'START IBIT', 'KET', 'IP ADDRES', 'KET'].concat(ukur, ['KETERANGAN'])];
  const body = [];
  blok.forEach((no, b)=>{
    for(let j = 0; j < 4; j++){
      const row = [];
      if(j === 0){
        row.push(RKI(`b${b}_no`, { def: no, rs: 4, w: 'no' }));
        row.push(RKI(`b${b}_k2`, { rs: 4, w: 'merk' }));
      }
      row.push(RKT(RK_IBIT[j], { left: true }));
      row.push(RKI(`b${b}_ibit${j}`));
      row.push(RKT(ip[j][0], { left: true }));
      row.push(RKI(`b${b}_ip${j}`, { def: ip[j][1], w: 'ip' }));
      if(j === 0){
        ukurK.forEach(k=>row.push(RKI(`b${b}_${k}`, { rs: 4 })));
        row.push(RKI(`b${b}_ket`, { rs: 4, ket: true }));
      }
      body.push(row);
    }
  });
  return { head, body };
}

/* ---------- Grid Battery & Charger ---------- */
function rkGridBattery(){
  const head = [
    [['BATTERY', 1, 2], ['CHARGE', 2], ['DISCHARGE', 2], ['KETERANGAN', 1, 2]],
    ['PENGUKURAN (V)', 'TOTAL (V)', 'PENGUKURAN (V)', 'TOTAL (V)']
  ];
  const body = [];
  for(let i = 0; i < 8; i++){
    for(let j = 0; j < 2; j++){
      const row = [];
      if(j === 0) row.push(RKT(i + 1, { rs: 2, muted: true }));
      row.push(RKI(`bt${i}_c${j}`));
      if(j === 0) row.push(RKI(`bt${i}_ct`, { rs: 2 }));
      row.push(RKI(`bt${i}_d${j}`));
      if(j === 0){ row.push(RKI(`bt${i}_dt`, { rs: 2 })); row.push(RKI(`bt${i}_ket`, { rs: 2, ket: true })); }
      body.push(row);
    }
  }
  return { head, body };
}
function rkGridCharger(){
  const head = [['CHARGER', 'AC SUPPLY IN (VOLT)', 'FUNGSI CHARGE/DISCHARGE', 'KETERANGAN']];
  const body = [];
  for(let i = 0; i < 4; i++){
    body.push([RKT(i + 1, { muted: true }), RKI(`ch${i}_ac`), RKI(`ch${i}_fungsi`), RKI(`ch${i}_ket`, { ket: true })]);
  }
  return { head, body };
}

/* ---------- Grid TX VHF (semesteran) — 17 pemancar × TX 1/2 ---------- */
function rkGridTxVhf(){
  const head = [
    [['NO', 1, 2], ['HARI/ TANGGAL', 1, 2], 'FREQ', ['MERK', 1, 2], ['TX', 1, 2], 'P OUT*', 'P REF*', ['VSWR', 1, 2], ['KETERANGAN', 1, 2]],
    ['MHz', 'Watt', 'Watt']
  ];
  const body = [];
  for(let i = 0; i < 17; i++){
    ['1', '2'].forEach((e, j)=>{
      const row = [];
      if(j === 0){
        row.push(RKT(i + 1, { rs: 2, muted: true }));
        row.push(RKI(`t${i}_tgl`, { rs: 2, w: 'merk' }));
        row.push(RKI(`t${i}_f`, { rs: 2, w: 'freq' }));
        row.push(RKI(`t${i}_m`, { rs: 2, w: 'merk' }));
      }
      row.push(RKT(e, { muted: true }));
      row.push(RKI(`t${i}_${j}_pout`), RKI(`t${i}_${j}_pref`), RKI(`t${i}_${j}_vswr`));
      row.push(RKI(`t${i}_${j}_ket`, { ket: true }));
      body.push(row);
    });
  }
  return { head, body, catatan: '* Menggunakan Alat Ukur' };
}

/* ---------- Grid Antena VHF (tahunan) — 10 baris, tiga kolom kondisi √ / X ---------- */
const RK_KONDISI = ['–', '√', 'X'];
const RK_KONDISI_KELAS = ['minus', 'ok', 'fail'];
function rkGridAntVhf(){
  const head = [['NO', 'HARI/ TANGGAL', 'GRUP FREKUENSI (MHz)', 'TIANG ANTENA', 'LABRANG TIANG', 'KONEKTOR & SURGE PROTECTION', 'KETERANGAN']];
  const body = [];
  for(let i = 0; i < 10; i++){
    body.push([
      RKT(i + 1, { muted: true }),
      RKI(`a${i}_tgl`, { w: 'merk' }),
      RKI(`a${i}_grup`, { w: 'freq' }),
      RKP(`a${i}_tiang`, RK_KONDISI, RK_KONDISI_KELAS),
      RKP(`a${i}_labrang`, RK_KONDISI, RK_KONDISI_KELAS),
      RKP(`a${i}_konektor`, RK_KONDISI, RK_KONDISI_KELAS),
      RKI(`a${i}_ket`, { ket: true })
    ]);
  }
  return { head, body, catatan: '* BAIK = √   ·   PERLU PERBAIKAN = X' };
}

/* ---------- Katalog lembar ----------
   grup   : sub-tab tempat lembar ini tinggal (rk-<grup>)
   judul  : baris judul cetak (array = beberapa baris)
   lokasi : teks tetap (tercetak apa adanya) — kalau tidak ada, jadi isian `meta`
   meta   : isian kepala tambahan [{k,label,ph}] (suhu ruangan, lokasi bebas)
   seksi  : () => [{judul?, grid}] */
const RK_VHF_JUDUL = kala => [`PEMELIHARAAN ${kala} FASILITAS TELEKOMUNIKASI PENERBANGAN`, 'METER READING RADIO VHF A/G'];
const RK_META_SUHU = { k: 'suhu', label: 'Suhu Ruangan (°C)', ph: 'mis. 21' };
const RK_META_LOKASI = { k: 'lokasi', label: 'Lokasi', ph: '' };

function rkVhf(kala, lokasi, daftar, catu){
  return {
    grup: kala === 'MINGGUAN' ? 'ming' : 'bul',
    label: `Radio ${lokasi.replace('Gedung ', '')}`,
    judul: RK_VHF_JUDUL(kala),
    lokasi,
    orientasi: 'landscape',
    meta: [RK_META_SUHU],
    seksi: ()=>[{ grid: rkGridVhf(daftar, catu) }]
  };
}

const RK_FORMS = {
  'ming-710': rkVhf('MINGGUAN', 'Gedung 710', RK_F_710, null),
  'ming-720': rkVhf('MINGGUAN', 'Gedung 720', RK_F_720_MING, null),
  'ming-mer': rkVhf('MINGGUAN', 'MER', RK_F_MER_MING, null),
  'ming-ter': rkVhf('MINGGUAN', 'TER', RK_F_TER, null),
  'bul-710':  rkVhf('BULANAN', 'Gedung 710', RK_F_710, 'tengah'),
  'bul-720':  rkVhf('BULANAN', 'Gedung 720', RK_F_720_BUL, 'akhir'),
  'bul-mer':  rkVhf('BULANAN', 'MER', RK_F_MER_BUL, 'akhir'),
  'bul-ter':  rkVhf('BULANAN', 'TER', RK_F_TER, 'akhir'),
  rstx: {
    grup: 'rstx', label: 'Radio R&S TX',
    judul: ['METER READING TRANSMITTER HF MWARA R&S'],
    lokasi: 'GEDUNG 710', orientasi: 'landscape',
    meta: [{ k: 'suhu', label: 'Suhu Ruangan HF (°C)', ph: 'mis. 21' }],
    seksi: ()=>[{ grid: rkGridRs('tx') }]
  },
  rsrx: {
    grup: 'rsrx', label: 'Radio R&S RX',
    judul: ['METER READING RECEIVER HF MWARA R&S'],
    lokasi: 'GEDUNG 720', orientasi: 'landscape',
    meta: [],
    seksi: ()=>[{ grid: rkGridRs('rx') }]
  },
  battery: {
    grup: 'battery', label: 'Battery',
    judul: ['PENGUKURAN BATTERY DAN KONDISI CHARGER'],
    orientasi: 'landscape',
    meta: [RK_META_LOKASI],
    seksi: ()=>[{ judul: 'BATTERY', grid: rkGridBattery() }, { judul: 'CHARGER', grid: rkGridCharger() }]
  },
  txvhf: {
    grup: 'txvhf', label: 'TX VHF',
    judul: ['PREVENTIVE MAINTENANCE TRANSMITTER VHF', '(SEMESTERAN)'],
    orientasi: 'portrait',
    meta: [RK_META_LOKASI],
    seksi: ()=>[{ grid: rkGridTxVhf() }]
  },
  antvhf: {
    grup: 'antvhf', label: 'Antena VHF',
    judul: ['PREVENTIVE MAINTENANCE ANTENA VHF', '(TAHUNAN)'],
    orientasi: 'portrait',
    meta: [RK_META_LOKASI],
    seksi: ()=>[{ grid: rkGridAntVhf() }]
  }
};
const RK_URUT = Object.keys(RK_FORMS);
/** Sub-tab (rk-<grup>) tempat sebuah lembar tinggal — dipakai 20-ttd-pejabat.js. */
function rkGrupForm(form){ const f = RK_FORMS[form]; return f ? f.grup : 'ming'; }

/* ---------- State lembar yang sedang diisi ---------- */

let rkForm = RK_URUT[0];
let rkData = {};
let rkMeta = {};
let rkTeknisiRows = [];
let rkTeknisiSeq = 0;

function rkSet(k, v){ rkData[k] = String(v == null ? '' : v); }
function rkVal(data, k){ const v = (data || {})[k]; return v === undefined ? '' : v; }

/** Semua sel isian sebuah lembar (untuk nilai awal & ringkasan). */
function rkSelIsian(form){
  const f = RK_FORMS[form];
  if(!f) return [];
  const hasil = [];
  f.seksi().forEach(s=>s.grid.body.forEach(row=>row.forEach(c=>{ if(c.k) hasil.push(c); })));
  return hasil;
}

/** Nilai awal: frekuensi/merk/IP dari sheet; kolom pilihan mulai di "–". */
function rkInit(form){
  rkData = {};
  rkMeta = {};
  ((RK_FORMS[form] || {}).meta || []).forEach(m=>{ rkMeta[m.k] = ''; });
  rkSelIsian(form).forEach(c=>{
    rkData[c.k] = c.opsi ? c.opsi[0] : (c.def || '');
  });
}

/* ---------- Penggambar ---------- */

const RK_FS_CETAK = 'font-size:6.6pt;';

function rkHeadHtml(head, mode){
  const cetak = mode === 'cetak';
  const fs = cetak ? RK_FS_CETAK : '';
  return '<thead>' + head.map(baris=>{
    const isi = baris.map(s=>{
      const t  = Array.isArray(s) ? s[0] : s;
      const cs = Array.isArray(s) && s[1] > 1 ? ` colspan="${s[1]}"` : '';
      const rs = Array.isArray(s) && s[2] > 1 ? ` rowspan="${s[2]}"` : '';
      return cetak
        ? `<td${cs}${rs} style="${fs}text-align:center;font-weight:bold;">${escapeHtml(t)}</td>`
        : `<th${cs}${rs}>${escapeHtml(t)}</th>`;
    }).join('');
    return cetak ? `<tr class="p-kepala">${isi}</tr>` : `<tr>${isi}</tr>`;
  }).join('') + '</thead>';
}

function rkSelHtml(c, data, mode){
  const cetak = mode === 'cetak';
  const fs = cetak ? RK_FS_CETAK : '';
  const rs = c.rs > 1 ? ` rowspan="${c.rs}"` : '';
  const cs = c.cs > 1 ? ` colspan="${c.cs}"` : '';
  const align = c.left || c.ket ? 'left' : 'center';

  if(c.t === 'txt'){
    const warna = c.muted ? (cetak ? 'color:#555;' : 'color:var(--muted);') : '';
    const kelas = cetak ? '' : (c.left ? ' class="rk-label"' : '');
    return `<td${rs}${cs}${kelas} style="${fs}text-align:${align};${warna}">${escapeHtml(c.v)}</td>`;
  }

  const v = rkVal(data, c.k);
  if(c.opsi){
    const i = Math.max(0, c.opsi.indexOf(v));
    const teks = c.opsi[i];
    const kls = (c.kelas && c.kelas[i]) || 'minus';
    if(mode === 'isi'){
      return `<td${rs}${cs}><button class="status-btn rk-pilih ${kls}" onclick="rkPutar('${c.k}')">${escapeHtml(teks)}</button></td>`;
    }
    if(cetak) return `<td${rs}${cs} style="${fs}text-align:center;">${teks === '–' ? '' : escapeHtml(teks)}</td>`;
    return `<td${rs}${cs}><span class="status-btn rk-pilih ${kls}" style="cursor:default;">${escapeHtml(teks)}</span></td>`;
  }

  if(mode === 'isi'){
    const kelasTd = c.ket ? ' class="rk-ket"' : (c.w ? ` class="rk-w-${c.w}"` : '');
    return `<td${rs}${cs}${kelasTd}><input type="text" class="rk-isi" value="${escapeHtml(v)}"
              placeholder="${escapeHtml(c.ph || '')}" oninput="rkSet('${c.k}', this.value)"></td>`;
  }
  const kosong = cetak ? '' : '<span style="opacity:.45;">–</span>';
  return `<td${rs}${cs} style="${fs}text-align:${align};">${escapeHtml(v) || kosong}</td>`;
}

function rkPutar(k){
  const c = rkSelIsian(rkForm).find(x=>x.k === k);
  if(!c || !c.opsi) return;
  const i = Math.max(0, c.opsi.indexOf(rkData[k]));
  rkData[k] = c.opsi[(i + 1) % c.opsi.length];
  renderRkTable();
}

/** Jumlah kolom grid (dari baris kepala pertama, dihitung colspan-nya). */
function rkJumlahKolom(grid){
  return (grid.head[0] || []).reduce((n, s)=>n + (Array.isArray(s) && s[1] > 1 ? s[1] : 1), 0);
}

function rkSeksiHtml(sec, data, mode){
  const cetak = mode === 'cetak';
  const g = sec.grid;
  const body = g.body.map(row=>`<tr>${row.map(c=>rkSelHtml(c, data, mode)).join('')}</tr>`).join('');
  const catatan = g.catatan
    ? (cetak ? `<div style="font-size:7pt;margin:3px 0 0;">${escapeHtml(g.catatan)}</div>`
             : `<div class="subtle-note" style="margin-top:6px;">${escapeHtml(g.catatan)}</div>`)
    : '';
  if(cetak){
    const judul = sec.judul
      ? `<div style="font-weight:bold;font-size:7.5pt;margin:5px 0 2px;border-bottom:1px solid #000;">${escapeHtml(sec.judul)}</div>` : '';
    return `<div style="margin:0 0 6px;">${judul}
      <table class="rk-print" style="width:100%;border-collapse:collapse;${RK_FS_CETAK}">${rkHeadHtml(g.head, mode)}<tbody>${body}</tbody></table>${catatan}</div>`;
  }
  const n = rkJumlahKolom(g);
  const tabel = `<table class="rk-tbl" style="width:100%;border-collapse:collapse;min-width:${Math.max(560, n * 78)}px;">${rkHeadHtml(g.head, mode)}<tbody>${body}</tbody></table>`;
  const judul = sec.judul ? `<div class="rk-seksi-judul">${escapeHtml(sec.judul)}</div>` : '';
  return `<div class="rk-seksi">${judul}<div class="rk-gulir">${tabel}</div>${catatan}</div>`;
}

function rkLembar(form, data, mode){
  const f = RK_FORMS[form];
  if(!f) return '';
  return f.seksi().map(s=>rkSeksiHtml(s, data, mode)).join('');
}

function renderRkTable(){
  const wrap = document.getElementById('rkWrap');
  if(!wrap) return;
  wrap.innerHTML = rkLembar(rkForm, rkData, 'isi');
}

/* ---------- Isian kepala (lokasi bebas / suhu ruangan) ---------- */

function rkSetMeta(k, v){ rkMeta[k] = String(v == null ? '' : v); }

function renderRkMeta(){
  const wrap = document.getElementById('rkMetaWrap');
  if(!wrap) return;
  const f = RK_FORMS[rkForm] || {};
  const tetap = f.lokasi
    ? `<div class="field"><label>${escapeHtml(T('rkLokasi'))}</label><input type="text" value="${escapeHtml(f.lokasi)}" disabled></div>` : '';
  wrap.innerHTML = tetap + (f.meta || []).map(m=>`<div class="field"><label>${escapeHtml(m.label)}</label>
      <input type="text" value="${escapeHtml(rkMeta[m.k] || '')}" placeholder="${escapeHtml(m.ph || '')}"
             oninput="rkSetMeta('${m.k}', this.value)"></div>`).join('');
}

/** Baris kepala untuk detail & cetak: "Lokasi : …", "Suhu Ruangan : …". */
function rkMetaTeks(form, meta){
  const f = RK_FORMS[form] || {};
  const hasil = [];
  if(f.lokasi) hasil.push(`${T('rkLokasi')} : ${f.lokasi}`);
  (f.meta || []).forEach(m=>hasil.push(`${m.label} : ${(meta || {})[m.k] || '________'}`));
  return hasil;
}

/* ---------- Teknisi (Petugas 1–4) ---------- */

function renderRkTeknisi(){
  const wrap = document.getElementById('rkTeknisiList');
  if(!wrap) return;
  wrap.innerHTML = rkTeknisiRows.map((t, i)=>`
    <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;">
      <span style="font-family:var(--font-mono);color:var(--accent);font-size:12px;min-width:18px;">${i + 1}.</span>
      <input type="text" value="${escapeHtml(t.nama)}" placeholder="${T('namaTeknisiPelaksana')} ${i + 1}"
             list="teknisiDatalist"
             oninput="rkTeknisiRows[${i}].nama=this.value"
             style="flex:1;background:var(--panel-2);border:1px solid var(--line);color:var(--text);border-radius:6px;padding:9px 10px;font-size:16px;">
      ${rkTeknisiRows.length > 1 ? `<button class="icon-btn" onclick="hapusRkTeknisi('${t.key}')">✕</button>` : ''}
    </div>`).join('');
}
function addRkTeknisi(){
  const isiAwal = rkTeknisiRows.length === 0 && userSaatIni ? (userSaatIni.nama || userSaatIni.username || '') : '';
  rkTeknisiRows.push({ key:'k' + (rkTeknisiSeq++), nama: isiAwal });
  renderRkTeknisi();
}
function hapusRkTeknisi(key){ rkTeknisiRows = rkTeknisiRows.filter(x=>x.key !== key); renderRkTeknisi(); }

/* ---------- Modal (buka / tutup / simpan / sunting) ----------
   Aturannya kembar dengan 17g: satu modal untuk isi baru dan sunting;
   rkEditingId terisi berarti simpan memanggil updateDsTest. Lembar tidak
   bisa diganti saat menyunting — jenis lembar adalah identitas catatan. */

let rkEditingId = null;

function rkTerapkanModeSunting(){
  const btn = document.getElementById('rkSaveBtn');
  if(btn) btn.textContent = rkEditingId ? T('simpanPerubahan') : T('simpanRk');
  const bar = document.getElementById('rkEditingBanner');
  if(bar) bar.style.display = rkEditingId ? '' : 'none';
}

function rkJudulModal(form){
  const f = RK_FORMS[form];
  document.getElementById('rkModalJudul').textContent = f.judul.join(' ');
  document.getElementById('rkModalSub').textContent = f.label + (f.lokasi ? ' · ' + f.lokasi : '');
}

function openRkModal(form){
  if(!RK_FORMS[form]) form = RK_URUT[0];
  rkEditingId = null;
  rkForm = form;
  rkInit(form);
  rkJudulModal(form);
  document.getElementById('rkTanggal').value = tanggalHariIni();
  document.getElementById('rkManagerNama').value = '';
  document.getElementById('rkManagerAkun').value = '';
  rkTeknisiRows = []; rkTeknisiSeq = 0; addRkTeknisi();
  if(!sigPads['sigRk']) setupSigCanvas('sigRk');
  resizeSigCanvas('sigRk'); clearSig('sigRk');
  // Kanvas TTD dibiarkan kosong — teknisi tanda tangan sendiri atau pakai TTD tersimpan.
  if(typeof pasangTombolTtdTersimpan === 'function') pasangTombolTtdTersimpan();
  renderRkMeta();
  renderRkTable();
  rkTerapkanModeSunting();
  document.getElementById('rkModalBg').classList.add('show');
  setTimeout(()=>resizeSigCanvas('sigRk'), 60);
}

function openRkEdit(id){
  const d = dsList.find(x=>x.id === id);
  if(!d || !d.state){ toast(T('takAdaHasil')); return; }
  if(d.managerTtd){ toast(T('rkTerkunci')); return; }

  const form = rkFormTersimpan(d.state);
  rkForm = form;
  rkInit(form);
  rkEditingId = id;
  rkMeta = Object.assign({}, rkMeta, d.state.meta || {});
  rkData = Object.assign({}, rkData, d.state.data || {});

  rkJudulModal(form);
  document.getElementById('rkTanggal').value = String(d.tanggal || '').slice(0, 10);
  document.getElementById('rkManagerNama').value = d.managerNama || '';
  const akun = document.getElementById('rkManagerAkun');
  if(akun) akun.value = d.ttdUntuk || '';

  rkTeknisiRows = []; rkTeknisiSeq = 0;
  const daftar = (d.teknisiNamaList && d.teknisiNamaList.length)
    ? d.teknisiNamaList
    : String(d.teknisiNama || '').split(',').map(s=>s.trim()).filter(Boolean);
  if(daftar.length) daftar.forEach(nama=>rkTeknisiRows.push({ key:'k' + (rkTeknisiSeq++), nama }));
  else addRkTeknisi();
  renderRkTeknisi();

  if(!sigPads['sigRk']) setupSigCanvas('sigRk');
  resizeSigCanvas('sigRk'); clearSig('sigRk');
  if(typeof pasangTombolTtdTersimpan === 'function') pasangTombolTtdTersimpan();
  renderRkMeta();
  renderRkTable();
  rkTerapkanModeSunting();
  document.getElementById('rkModalBg').classList.add('show');
  setTimeout(()=>resizeSigCanvas('sigRk'), 60);
}

function batalEditRk(){
  const form = rkForm;
  closeRkModal();
  rkEditingId = null;
  rkTerapkanModeSunting();
  renderRkList(form);
}

function closeRkModal(){ document.getElementById('rkModalBg').classList.remove('show'); }

async function saveRk(){
  const btn = document.getElementById('rkSaveBtn'); btn.disabled = true;
  const menyunting = !!rkEditingId;
  try{
    const state = { __format:'mrradkom', __rkForm: rkForm, meta: rkMeta, data: rkData };
    const payload = {
      unit: unitAktif,
      kategori: 'mrradkom',
      tanggal: document.getElementById('rkTanggal').value,
      state,
      teknisiNamaList: rkTeknisiRows.map(t=>(t.nama || '').trim()).filter(Boolean),
      teknisiTtd: getSigDataUrl('sigRk'),
      managerNama: document.getElementById('rkManagerNama').value.trim(),
      ttdUntuk: ttdUntukTerpilih('rkManagerAkun', document.getElementById('rkManagerNama').value)
    };
    if(menyunting){
      const saved = await gsRun('updateDsTest', rkEditingId, payload);
      const i = dsList.findIndex(x=>x.id === rkEditingId);
      if(i !== -1) dsList[i] = mapDs(saved);
      const form = rkForm;
      closeRkModal();
      rkEditingId = null;
      rkTerapkanModeSunting();
      renderRkList(form);
      toast(T('tersimpanPerubahan'));
    }else{
      const saved = await gsRun('addDsTest', payload);
      dsList.unshift(mapDs(saved));
      renderRkList(rkForm);
      closeRkModal();
      toast(T('rkTersimpan'));
    }
  }catch(e){ toast(T('gagalSimpan') + ' — ' + (e.message || T('coba'))); }
  btn.disabled = false;
}

/* ---------- Daftar riwayat (satu daftar per lembar) ---------- */

const rkAdalah = (d, form) => !!(d && d.state && d.state.__format === 'mrradkom' &&
                                 (!form || d.state.__rkForm === form));

let rkTampilSemua = {};
function resetCariRk(form){
  rkTampilSemua[form] = true;
  const el = document.getElementById('cariRkTanggal-' + form); if(el) el.value = '';
  renderRkList(form);
}

/** Ringkasan kartu riwayat: berapa sel ukur terisi (nilai bawaan sheet —
    frekuensi, merk, awalan IP — tidak dihitung), dan berapa "X" di lembar antena. */
function rkRingkas(form, state){
  const data = (state && state.data) || {};
  const sel = rkSelIsian(form);
  let terisi = 0, buruk = 0;
  sel.forEach(c=>{
    const v = String(data[c.k] == null ? '' : data[c.k]).trim();
    if(!v) return;
    if(c.opsi){ if(v === 'X') buruk++; return; }
    if(c.def !== undefined && v === c.def) return;
    terisi++;
  });
  return { terisi, buruk };
}

function renderRkList(form){
  const wrap = document.getElementById('rkList-' + form);
  if(!wrap) return;
  const semua = (typeof dsList !== 'undefined' ? dsList : []).filter(d=>rkAdalah(d, form));
  const tgl = (document.getElementById('cariRkTanggal-' + form) || {}).value || '';
  const daftar = tgl ? semua.filter(d=>String(d.tanggal || '').slice(0, 10) === tgl)
                     : (rkTampilSemua[form] ? semua : semua.filter(d=>dalamSeminggu(d.tanggal)));

  if(semua.length === 0){ wrap.innerHTML = '<div class="empty">' + T('rkBelumAda') + '</div>'; return; }
  if(daftar.length === 0){ wrap.innerHTML = '<div class="empty">' + T('takAdaHasil') + '</div>'; return; }

  wrap.innerHTML = daftar.map(d=>{
    const r = rkRingkas(form, d.state);
    const tag = r.buruk
      ? `<span class="tag fail">${r.buruk} ${escapeHtml(T('rkPerluPerbaikan'))}</span>`
      : `<span class="tag ok">${r.terisi} ${escapeHtml(T('rkNilaiTercatat'))}</span>`;
    const meta = rkMetaTeks(form, (d.state || {}).meta).filter(s=>!s.endsWith('________')).join(' · ');
    return `<div class="dc-history-item">
      <div><b>${escapeHtml(d.tanggal)}</b>${meta ? ' &middot; ' + escapeHtml(meta) : ''}</div>
      ${tag}
      <div style="font-size:11.5px;color:var(--muted);">${T('teknisiPelaksana')}: ${escapeHtml(d.teknisiNama) || '-'}</div>
      ${diinputOlehHtml(d.diinputOleh, d.dibuatPada, String(d.tanggal || '').slice(0, 10))}
      <div style="display:flex;gap:4px;">
        <button class="btn ghost" style="padding:6px 10px;" onclick="openRkDetail('${d.id}')">${T('detail')}</button>
        ${(!d.managerTtd && bolehSuntingCatatan(d.dibuatOlehUsername))
          ? `<button class="icon-btn" title="${T('rkSunting')}" onclick="openRkEdit('${d.id}')">✎</button>` : ''}
        <button class="icon-btn" title="${T('cetak')}" onclick="printRk('${d.id}')">🖨</button>
        <button class="icon-btn hanya-admin" title="${T('hapus')}" onclick="hapusRk('${d.id}')">✕</button>
      </div>
    </div>`;
  }).join('');
}

/** Segarkan ketiga belas daftar sekaligus (dipanggil init / terapkanUnit / TTD). */
function renderSemuaRkList(){ RK_URUT.forEach(renderRkList); }

async function hapusRk(id){
  if(!adminAktif()){ toast(T('hanyaAdminHapus')); return; }
  const d = dsList.find(x=>x.id === id);
  if(!confirm(`${T('konfirmasiHapus')} ${d ? d.tanggal : ''}?`)) return;
  const form = rkFormTersimpan(d && d.state);
  const salinan = dsList.slice();
  dsList = dsList.filter(x=>x.id !== id);
  renderRkList(form);
  try{ await gsRun('deleteDsTest', id); }
  catch(e){ dsList = salinan; renderRkList(form); toast(T('gagalHapus') + ' — ' + (e.message || T('coba'))); }
}

/* ---------- Detail & cetak ---------- */

function rkFormTersimpan(state){
  const f = state && state.__rkForm;
  return RK_FORMS[f] ? f : RK_URUT[0];
}

function openRkDetail(id){
  const d = dsList.find(x=>x.id === id);
  if(!d || !d.state) return;
  const form = rkFormTersimpan(d.state);
  const f = RK_FORMS[form];
  document.getElementById('formDetailJudul').textContent = f.judul.join(' ') + ' — ' + f.label;
  const meta = rkMetaTeks(form, d.state.meta).map(escapeHtml).join(' &middot; ');
  document.getElementById('formDetailBody').innerHTML = `
    <div style="font-size:13px;line-height:1.7;margin-bottom:10px;"><b>${escapeHtml(d.tanggal)}</b><br>${meta}</div>
    ${rkLembar(form, d.state.data || {}, 'baca')}
    <div class="detail-ttd">
      <div class="sig-block"><b>${T('teknisiPelaksana')}</b>${escapeHtml(d.teknisiNama) || '-'}${sigThumbHtml(d.teknisiTtd)}</div>
      <div class="sig-block"><b>${T('mengetahuiManager')}</b>${renderPihakKedua('dstest', d.id, d.managerNama, d.managerTtd)}${sigPejabatHtml('dstest', d.id, d.managerTtd, d)}</div>
    </div>
    <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line);">${diinputOlehHtml(d.diinputOleh, d.dibuatPada, String(d.tanggal || '').slice(0, 10))}</div>`;
  document.getElementById('formDetailPrintBtn').onclick = ()=>{ closeFormDetail(); printRk(id); };
  document.getElementById('formDetailBg').classList.add('show');
}

function printRk(id){
  const d = dsList.find(x=>x.id === id);
  if(!d || !d.state) return;
  if(!tolakCetakBilaBelumTtd(d, 'dstest')) return;
  const form = rkFormTersimpan(d.state);
  const f = RK_FORMS[form];
  const meta = rkMetaTeks(form, d.state.meta).map(escapeHtml);
  // Kepala seperti sheet: LOKASI / TANGGAL di kiri, PETUGAS 1–4 di kanan.
  const petugas = (d.teknisiNamaList && d.teknisiNamaList.length)
    ? d.teknisiNamaList
    : String(d.teknisiNama || '').split(',').map(s=>s.trim()).filter(Boolean);
  const petugasHtml = [0, 1, 2, 3].map(i=>`${i + 1}. ${escapeHtml(petugas[i] || '')}`)
    .map(t=>`<div>${t}</div>`).join('');
  const judul = f.judul.map((t, i)=>
    `<div style="text-align:center;font-weight:bold;font-size:${i === 0 ? '11.5pt' : '10pt'};margin-bottom:2px;">${escapeHtml(t)}</div>`).join('');
  doPrint(`
    <style>
      #printArea .rk-print td{padding:0 3px;line-height:1.2;}
    </style>
    ${judul}
    <table class="no-border" style="font-size:9pt;margin:6px 0 8px;width:100%;">
      <tr>
        <td style="vertical-align:top;">
          ${meta.map(t=>`<div>${t}</div>`).join('')}
          <div>TANGGAL : ${escapeHtml(d.tanggal)}</div>
        </td>
        <td style="vertical-align:top;text-align:left;width:40%;">
          <div>PETUGAS :</div>${petugasHtml}
        </td>
      </tr>
    </table>

    ${rkLembar(form, d.state.data || {}, 'cetak')}

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
    </table>`, f.orientasi || 'landscape');
}
