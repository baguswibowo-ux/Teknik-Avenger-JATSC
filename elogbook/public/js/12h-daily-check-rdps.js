/* E-Logbook · js/12h-daily-check-rdps.js — Daily Check NEW-JAATS (unit fdpsrdps)
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh.

   Dialihaksarakan dari "NEW-JAATS Daily Logbook (Update) 2026.xlsx", sheet
   "NEW-JAATS 1 DailyCheck" — satu lembar besar NEW-JAATS DAILY REPORT yang di
   kertasnya berisi empat bagian berurutan:
     · SUBSYSTEM SERVER — status software (disk/memory/network + status) dan
                          status hardware (LED Health / NIC / Drive) server
                          ATMAS INDRA OPS, FALLBACK, TESTBED
     · RADAR SOURCE     — 14 radar + 22 ADS-B di RDCU 1-2 OPS, RDCU3
                          Contingency, dan RDCU1 Fallback/Testbed
     · NETWORK          — switch OPS/FALLBACK/TESTBED + LED Cisco C9300L
     · WORKSTATION      — CWP OPS/FALLBACK/TESTBED, Flight Strip Printer,
                          Laser Printer
   Satu lembar per dinas, pola yang sama dengan Listrik (12g): menumpang modal
   daily check baku (tanggal, dinas, teknisi, TTD, manager). BEDANYA: keempat
   bagian di sini SATU catatan — sub-tab cuma membagi layar supaya ±700 kotak
   tidak menumpuk sekaligus. Simpan, detail, dan cetak selalu keempatnya.

   ISIAN. Tiap kotak status mulai kosong (–) dan diputar per klik lewat
   pilihan jenisnya (RDPS_JENIS) lalu kembali ke kosong. Kotak yang tetap
   kosong tercetak "–": memang tidak dicek, bukan dianggap normal. Tombol
   "✓ Semua normal" di tiap tabel mengisi kotak yang MASIH KOSONG dengan
   pilihan pertama (normal) — yang sudah ditandai rusak tidak tertimpa. Angka
   disk/memory/LAN boleh kosong.

   KUNCI STATE "tabel|nama|kolom" — memakai NAMA baris, bukan urutannya,
   supaya catatan lama tetap terbaca kalau suatu hari daftar CWP/radar
   disisipi atau diurut ulang. Nama baris unik di dalam satu tabel. */

/* ---------- Jenis pilihan ----------
   [nilai tersimpan, label panjang (detail/cetak), label tombol, kelas warna].
   Urutannya urutan putar. Pilihan pertama dianggap "normal" oleh tombol
   Semua normal. Kelas: ok = normal, warn = perlu perhatian (temuan kuning),
   fail = gangguan (temuan merah). */
const RDPS_JENIS = {
  // Server/switch/CWP: OPERATIVE / FAILED
  opf:  { opsi: [['opr', 'OPERATIVE', 'OPR', 'ok'], ['fail', 'FAILED', 'FAIL', 'fail']] },
  // Radar source: OPERATIVE / FAILED / MAINTENANCE (urutan kertasnya)
  opfm: { opsi: [['opr', 'OPERATIVE', 'OPR', 'ok'], ['fail', 'FAILED', 'FAIL', 'fail'], ['maint', 'MAINTENANCE', 'MAINT', 'warn']] },
  // Server tanpa pasangan & laser printer: Operational / Maint.
  om:   { opsi: [['opr', 'OPERATIONAL', 'OPR', 'ok'], ['maint', 'MAINTENANCE', 'MAINT', 'warn']] },
  // Server berpasangan: Main / Standby / Maint. Main dan Standby sama-sama
  // sehat — yang mana yang Main tidak bisa ditebak, jadi jenis ini dilewati
  // tombol Semua normal (tanpaMassal).
  msm:  { opsi: [['main', 'MAIN', 'MAIN', 'ok'], ['stby', 'STANDBY', 'STBY', 'ok'], ['maint', 'MAINTENANCE', 'MAINT', 'warn']], tanpaMassal: true },
  // LED server HPE: Solid Green normal · Flashing Amber cek iLO/IML · Flashing Red troubleshoot
  led:  { opsi: [['g', 'SOLID GREEN', 'GREEN', 'ok'], ['a', 'FLASHING AMBER', 'AMBER', 'warn'], ['r', 'FLASHING RED', 'RED', 'fail']] },
  // LED Status & System Cisco C9300L: Green normal · Blinking Green degraded · Amber fault
  swSt: { opsi: [['g', 'GREEN', 'GREEN', 'ok'], ['bg', 'BLINKING GREEN', 'BLINK G', 'warn'], ['a', 'AMBER', 'AMBER', 'fail']] },
  // LED Active Cisco C9300L: Blinking Green normal · Green-Amber degraded · Blinking Amber fault
  swAk: { opsi: [['bg', 'BLINKING GREEN', 'BLINK G', 'ok'], ['ga', 'GREEN-AMBER', 'G-AMBER', 'warn'], ['ba', 'BLINKING AMBER', 'BLINK A', 'fail']] }
};

/* ---------- Pembentuk tabel ----------
   { id, judul, sebut, cols, rows, no?, penuh? }
     sebut : nama pendek untuk daftar temuan ("Server OPS", "Radar RDCU 1-2 OPS")
     cols  : { k, h, t, j?, g?, sat? }
               t = 'pilih' (tombol putar, jenis j; j:'baris' → jenis dari baris)
                   'angka' (kotak angka, satuan sat) · 'teks' · 'info' (baca saja)
               g = kepala grup di atas h; kolom bertetangga ber-g sama digabung
     rows  : { n: nama, j?: jenis (untuk kolom j:'baris'), s?: isi kolom info }
     no    : true → kolom nomor urut
     penuh : true → selebar layar/kertas (tabel berkolom banyak) */
const rdpsBaris = (n, j, s) => ({ n, j: j || '', s: s || '' });

/* ---------- Bagian 1: SUBSYSTEM SERVER ---------- */
// [nama, jenis status] — Main/Standby untuk yang berpasangan, Operational/
// Maint untuk yang tunggal, persis kotak centang di kertasnya.
const RDPS_SRV_OPS = [
  ['FDP 1','msm'], ['FDP 2','msm'], ['ADM/TBS 1','msm'], ['ADM/TBS 2','msm'],
  ['DRF 1','om'], ['DRF 2','om'], ['DLS 1','msm'], ['DLS 2','msm'],
  ['FDS 1','msm'], ['FDS 2','msm'], ['SDP 1','msm'], ['SDP 2','msm'],
  ['SDP 3 CSDP','om'], ['RDCU 1','om'], ['RDCU 2','om'], ['RDCU 3','om'],
  ['RDCU 4 HLM','om'], ['SNET 1','msm'], ['SNET 2','msm']
];
// Fallback dan Testbed memuat sembilan server yang sama, semuanya tunggal.
const RDPS_SRV_CADANGAN = ['FDP 1','ADM/TBS 1','DLS 1','FDS 1','SDP 1','SDP 3 CSDP','RDCU 1','RDCU 3','SNET 1'];
// Status hardware memakai penamaan rak (FDP A/B, ADM/TBS A/B) — beda dengan
// nama di status software; dibiarkan seperti di kertasnya.
const RDPS_HW_OPS = ['FDP A','FDP B','ADM/TBS A','ADM/TBS B','DRF 1','DRF 2','DLS 1','DLS 2','FDS 1','FDS 2',
                     'SDP 1','SDP 2','SDP 3 CSDP','RDCU 1','RDCU 2','RDCU 3','RDCU 4 HLM','SNET 1','SNET 2'];
const RDPS_HW_CADANGAN = ['FDP A','ADM/TBS A','DLS 1','FDS 1','SDP 1','SDP 3 CSDP','RDCU 1','RDCU 3','SNET 1'];

const RDPS_COL_SW = [
  { k:'du', g:'DISK',    h:'Usage',       t:'angka', sat:'%' },
  { k:'df', g:'DISK',    h:'Free Space',  t:'teks' },
  { k:'mu', g:'MEMORY',  h:'Consumption', t:'angka', sat:'%' },
  { k:'mt', g:'MEMORY',  h:'Total',       t:'teks' },
  { k:'l1', g:'NETWORK', h:'LAN1',        t:'angka', sat:'%' },
  { k:'l2', g:'NETWORK', h:'LAN2',        t:'angka', sat:'%' },
  { k:'st', h:'Status', t:'pilih', j:'baris' }
];
const RDPS_COL_HW = [
  { k:'hl',  h:'Health LED',     t:'pilih', j:'led' },
  { k:'nic', h:'NIC Status LED', t:'pilih', j:'led' },
  { k:'drv', h:'Drive LED',      t:'pilih', j:'led' }
];

function rdpsTabelServer(){
  const sw = (id, lingkup, rows) => ({
    id, judul: `Server ATMAS INDRA ${lingkup} — Software Status`, sebut: `Server ${lingkup}`, kepalaNama: 'Server',
    cols: RDPS_COL_SW, rows, penuh: true
  });
  const hw = (id, lingkup, rows) => ({
    id, judul: `Server ATMAS INDRA ${lingkup} — Hardware Status`, sebut: `Hardware ${lingkup}`, kepalaNama: 'Server',
    cols: RDPS_COL_HW, rows: rows.map(n => rdpsBaris(n))
  });
  return [
    sw('sw-ops', 'OPS',      RDPS_SRV_OPS.map(([n, j]) => rdpsBaris(n, j))),
    sw('sw-fb',  'FALLBACK', RDPS_SRV_CADANGAN.map(n => rdpsBaris(n, 'om'))),
    sw('sw-tb',  'TESTBED',  RDPS_SRV_CADANGAN.map(n => rdpsBaris(n, 'om'))),
    hw('hw-ops', 'OPS',      RDPS_HW_OPS),
    hw('hw-fb',  'FALLBACK', RDPS_HW_CADANGAN),
    hw('hw-tb',  'TESTBED',  RDPS_HW_CADANGAN)
  ];
}

/* ---------- Bagian 2: RADAR SOURCE ---------- */
const RDPS_RADAR = ['BAC','KNO','PKU2','TNJ2','PNK2','CKG3','JOG2','SMG2','PLB2','NTA2','PDG','BJM','SUB','PKB'];
const RDPS_ADSB  = ['BACADS','BKLADS','JMBADS','MDNADS','NIAADS','PKLADS','PKUADS','PNKADS','SMGADS','SRBADS','TNJADS',
                    'BJMADS','CLPADS','LSKADS','MWKADS','NTNADS','PKPADS','PLMADS','PTBADS','SOTADS','TJQADS','YIAADS'];
/* Tiga panel RDCU, masing-masing dua kolom pemeriksaan — kepala kolomnya
   ditulis persis kertasnya. */
const RDPS_RDCU = [
  { id:'rd12', nama:'RDCU 1-2 OPS',      a:'LINE 1',            b:'LINE 2' },
  { id:'rd3',  nama:'RDCU3 CONTINGENCY', a:'OPS · LINE 1',      b:'FALLBACK · LINE 1' },
  { id:'rd1',  nama:'RDCU1',             a:'FALLBACK · LINE 1', b:'TESTBED · LINE 1' }
];

function rdpsTabelRadar(){
  const tabel = (p, jenis, daftar) => ({
    id: `${p.id}-${jenis}`,
    judul: `Services ${jenis === 'radar' ? 'Radar' : 'ADS-B'} — ${p.nama}`,
    sebut: `${jenis === 'radar' ? 'Radar' : 'ADS-B'} ${p.nama}`,
    no: true, kepalaNama: 'ID',
    cols: [
      { k:'a',  g:p.a, h:'Status', t:'pilih', j:'opfm' },
      { k:'ar', g:p.a, h:'Remark', t:'teks', lebar:true },
      { k:'b',  g:p.b, h:'Status', t:'pilih', j:'opfm' },
      { k:'br', g:p.b, h:'Remark', t:'teks', lebar:true }
    ],
    rows: daftar.map(n => rdpsBaris(n))
  });
  return RDPS_RDCU.flatMap(p => [tabel(p, 'radar', RDPS_RADAR), tabel(p, 'adsb', RDPS_ADSB)]);
}

/* ---------- Bagian 3: NETWORK ---------- */
const RDPS_SWITCH_OPS = ['SW 1 BB','SW 2 BB','SW 3 BB','SW 1 CGK','SW 2 CGK','SW 3 CGK','SW 1 CON','SW 2 CON','SW 3 CON',
                         'SW 1 HLP','SW 2 HLP','SW 1 CYBER','NTP 1','NTP 2','ADLC-ATC A','ADLC-ATC B'];
const RDPS_SWITCH_CADANGAN = ['SW 1 BB','SW 2 BB','SW 3 BB','SW 1 CTRL','SW 2 CTRL','SW 3 CTRL','SW 1 CGK','SW 2 CGK','SW 3 CGK','SW 1 CYBER'];
const RDPS_C9300_OPS = RDPS_SWITCH_OPS.slice(0, 12);          // tanpa NTP & ADLC
const RDPS_C9300_TB  = ['SW 1 BB','SW 2 BB','SW 3 BB','SW 1 CYBER'];
const RDPS_COL_C9300 = [
  { k:'sl', h:'Status LED', t:'pilih', j:'swSt' },
  { k:'al', h:'Active LED', t:'pilih', j:'swAk' },
  { k:'yl', h:'System LED', t:'pilih', j:'swSt' }
];

function rdpsTabelNetwork(){
  const sw = (id, lingkup, daftar) => ({
    id, judul: `Network Switches ${lingkup}`, sebut: `Switch ${lingkup}`, kepalaNama: 'Switch',
    cols: [{ k:'st', h:'Status', t:'pilih', j:'opf' }], rows: daftar.map(n => rdpsBaris(n))
  });
  const led = (id, lingkup, daftar) => ({
    id, judul: `Cisco Catalyst C9300L ${lingkup} — Hardware Status`, sebut: `C9300L ${lingkup}`, kepalaNama: 'Switch',
    cols: RDPS_COL_C9300, rows: daftar.map(n => rdpsBaris(n))
  });
  return [
    sw('net-ops', 'OPS', RDPS_SWITCH_OPS),
    sw('net-fb', 'FALLBACK', RDPS_SWITCH_CADANGAN),
    sw('net-tb', 'TESTBED', RDPS_SWITCH_CADANGAN),
    led('c9-ops', 'OPS', RDPS_C9300_OPS),
    led('c9-fb', 'FALLBACK', RDPS_SWITCH_CADANGAN),
    led('c9-tb', 'TESTBED', RDPS_C9300_TB)
  ];
}

/* ---------- Bagian 4: WORKSTATION ---------- */
/* [nama CWP, sektor]. Di kertasnya tiap daftar dibagi tiga lajur; di sini
   dijadikan tiga tabel supaya urutannya tetap terbaca sama. */
const RDPS_WS_OPS = [
  [['OS ACC-CWP1','Open Sector'],['OS ACC-CWP2','PLANNER ACC1'],['OS ACC-CWP3','Open Sector'],['OS ACC-CWP4','PLANNER ACC2'],
   ['OS ACC-CWP5','Open Sector'],['OS ACC-CWP6','Open Sector'],['OS ACC-CWP7','Open Sector'],['ACC-CWP8','UIOS'],['ACC-CWP9','-'],
   ['ACC-CWP10','UBAC'],['ACC-CWP11','PL. UBAC,UIOS,UMDN'],['ACC-CWP12','UMDN'],['ACC-CWP13','-'],['SPV ACC-CWP14','-'],
   ['ACC-CWP15','UPKU'],['ACC-CWP16','PL. UPKU,UPLB'],['ACC-CWP17','UPLB'],['ACC-CWP18','-'],['ACC-CWP19','UJKT'],
   ['ACC-CWP20','PL. UJKT'],['SPV ACC-CWP21','-'],['ACC-CWP22','UBTE'],['ACC-CWP23','PL. UBTE'],['ACC-CWP24','UPKP'],
   ['ACC-CWP25','PL. UPKP'],['ACC-CWP26','UTPG'],['ACC-CWP27','PL. UTPG'],['SPV ACC-CWP28','-'],['ACC-CWP29','UNTA'],
   ['ACC-CWP30','PPL. UNTA'],['ACC-CWP31','UPNK'],['ACC-CWP32','PL. UPNK,UTPN'],['ACC-CWP33','UTPN'],['ACC-CWP34','-'],
   ['SPV ACC-CWP35','-'],['ACC-CWP36','USMG'],['ACC-CWP37','PL. UBND,UJOG,USMG'],['ACC-CWP38','UJOG'],['ACC-CWP39','-']],
  [['ACC-CWP40','UBND'],['ACC-CWP41','-'],['ACC-CWP42','-'],['TMA-CWP43','JKLE'],['TMA-CWP44','PL. JKLE'],['TMA-CWP45','JKLC'],
   ['TMA-CWP46','PL. JKLC'],['TMA-CWP47','JKLN'],['TMA-CWP48','PL. JKLN'],['SPV APP-CWP49','-'],['TMA-CWP50','JKTW'],
   ['TMA-CWP51','PL. JKTW'],['TMA-CWP52','JKTE'],['TMA-CWP53','PL. JKTE'],['TMA-CWP54','TMA1'],['TMA-CWP55','TMA1'],
   ['SPV APP-CWP56','-'],['TMA-CWP57','JKTS'],['TMA-CWP58','PL. JKTS'],['TMA-CWP59','JKCN'],['TMA-CWP60','PL. JKCN'],
   ['TMA-CWP61','JKCE'],['TMA-CWP62','PL. JKCE'],['SPV APP-CWP63','-'],['TMA-CWP64','JKLS'],['TMA-CWP65','PL. JKLS'],
   ['TMA-CWP66','JKDW'],['TMA-CWP67','PL. JKDW'],['TMA-CWP68','JKDE'],['TMA-CWP69','PL. JKDE'],['SPV APP-CWP70','-'],
   ['TMA-CWP71','TJKG'],['TMA-CWP72','PL. TJKG'],['TMA-CWP73','-'],['TMA-CWP74','PL. BNDG'],['TMA-CWP75','-'],
   ['TMA-CWP76','PL. KJTI'],['SPV APP-CWP77','-'],['ATFM-CWP78','-']],
  [['ATFM-CWP79','-'],['ACC-CWP80','-'],['ACC-CWP81','-'],['FIC-CWP82','FIC1'],['FIC-CWP83','FIC2'],['FIC-CWP84','PL. FIC1, FIC2'],
   ['TECH-SPV CWP85',''],['TECH-SPV CWP86',''],['DBM-CWP87',''],['PLBK-CWP88',''],['HLM-CWP89',''],['JATSC TWR-CWP90',''],
   ['JATSC TWR-CWP91',''],['JATSC TWR-CWP92',''],['JATSC TWR-CWP93',''],['JATSC TWR-CWP94',''],['JATSC TWR-CWP95',''],
   ['JATSC TWR-CWP96',''],['JATSC TWR-CWP97',''],['JATSC TWR-CWP98',''],['JATSC TWR-CWP99',''],['SPV TWR-CWP100',''],
   ['CMD-1',''],['CMD-2',''],['CMD-3',''],['CMD-4',''],['CMD-5',''],['CMD-6',''],['CMD-7',''],['CMD-8',''],
   ['DAT-1',''],['FDD-1',''],['FDD-2',''],['FDD-3',''],['FDD-4',''],['DBM','']]
];
const RDPS_WS_FB = [
  ['ACC-CWP1','ACC-CWP2','ACC-CWP3','ACC-CWP4','ACC-CWP5','ACC-CWP6','ACC-CWP7','ACC-CWP8','ACC-CWP9','ACC-CWP10',
   'ACC-CWP11','ACC-CWP12','ACC-CWP13','ACC-CWP14','ACC-CWP15','ACC SPV-CWP67','APP SPV-CWP73'],
  ['TMA-CWP31','TMA-CWP32','TMA-CWP33','TMA-CWP34','TMA-CWP35','TMA-CWP36','TMA-CWP37','TMA-CWP38','TMA-CWP39','TMA-CWP40',
   'TMA-CWP41','TMA-CWP42','TMA-CWP43','TMA-CWP44','Open Sec-CWP60','Open Sec-CWP61','Open Sec-CWP62'],
  ['Sec. SPV-CWP78','MGR SPV-CWP79','TeK. SPV-CWP85','ADC TWR-CWP90','ADC TWR-CWP93','ADC TWR-CWP94','ADC TWR-CWP98',
   'FDD-1','DBM','CMD-1','CMD-2','CMD-4','DAT-1']
];
const RDPS_WS_TB = ['ACC-TMA-APP-CWP1','ACC-TMA-APP-CWP2','SPV-CWP3','TWR-CWP4','TWR-CWP5',
                    'SPV-CMD1','CTRL MONITOR-CMD2','DAT1','DBM','EPP','SM','SSF'];
const RDPS_FSP = [
  [['CWP1','OPEN SECTOR'],['CWP3','OPEN SECTOR'],['CWP5','OPEN SECTOR'],['CWP8','UIOS'],['CWP10','UBAC'],['CWP12','UMDN'],
   ['CWP15','UPKU'],['CWP17','UPLB'],['CWP19','UJKT'],['CWP21','ACC SPV'],['CWP22','UBTE']],
  [['CWP24','UPKP'],['CWP26','UTPE'],['CWP29','UNTA'],['CWP31','UPNK'],['CWP33','UTPN'],['CWP36','USMG'],['CWP38','UJOG'],
   ['CWP40','UBND'],['CWP49','APP SPV'],['CWP51','CTR'],['CWP56','TMA SPV']],
  [['CWP63',''],['CWP70',''],['CWP77',''],['CWP82',''],['CWP83',''],['CWP84',''],['CWP90',''],['CWP93',''],['CWP94',''],['CWP97','']]
];
const RDPS_LASER = ['DAT LP', 'DBM LP', 'OPSUP LP'];

function rdpsTabelWorkstation(){
  const opf = { k:'st', h:'Status', t:'pilih', j:'opf' };
  const sek = { k:'sek', h:'Sector', t:'info' };
  const lajur = (id, judul, sebut, daftar, pakaiSektor) => daftar.map((isi, i) => ({
    id: `${id}-${i + 1}`,
    judul: `${judul} (${i + 1}/${daftar.length})`, sebut, kepalaNama: 'Workstation',
    cols: pakaiSektor ? [sek, opf] : [opf],
    rows: isi.map(x => Array.isArray(x) ? rdpsBaris(x[0], '', x[1]) : rdpsBaris(x))
  }));
  return [
    ...lajur('ws-ops', 'Workstation OPS', 'CWP OPS', RDPS_WS_OPS, true),
    ...lajur('ws-fb', 'Workstation FALLBACK', 'CWP FALLBACK', RDPS_WS_FB, false),
    { id:'ws-tb', judul:'Workstation TESTBED', sebut:'CWP TESTBED', kepalaNama:'Workstation', cols:[opf], rows: RDPS_WS_TB.map(n => rdpsBaris(n)) },
    ...lajur('fsp', 'Flight Strip Printer OPS', 'FSP', RDPS_FSP, true),
    { id:'lp', judul:'Laser Printer', sebut:'Laser Printer', kepalaNama:'Printer',
      cols:[{ k:'st', h:'Status', t:'pilih', j:'om' }], rows: RDPS_LASER.map(n => rdpsBaris(n)) }
  ];
}

/* ---------- Registry bagian (= sub-tab di layar, = urutan di kertas) ----------
   minKartu    : lebar minimum kartu tabel di layar (px), bawaan 290
   lajurCetak  : lebar lajur di kertas (px), bawaan 170
   halamanBaru : mulai di halaman baru saat dicetak — hasilnya halaman 1
                 Server, halaman 2 Radar + Network, halaman 3 Workstation */
const RDPS_BAGIAN = [
  { id:'server',  label:'🖥 Server',       judul:'SUBSYSTEM SERVER', tabel: rdpsTabelServer },
  // Tabel radar punya dua pasang Status + Remark — butuh kartu lebih lebar
  // supaya LINE 2 tidak terpotong di layar.
  { id:'radar',   label:'📡 Radar Source', judul:'RADAR SOURCE',     tabel: rdpsTabelRadar, minKartu: 470, lajurCetak: 230, halamanBaru: true },
  { id:'network', label:'🔌 Network',      judul:'NETWORK',          tabel: rdpsTabelNetwork },
  { id:'ws',      label:'💻 Workstation',  judul:'WORKSTATION',      tabel: rdpsTabelWorkstation, halamanBaru: true }
];

/* ---------- State ---------- */

/** Bagian yang sedang tampil di layar. Tidak ikut tersimpan — keempatnya
    selalu disimpan bersama. */
let dcRdpsBagian = 'server';
/** Isian seluruh lembar. Kunci "tabel|nama|kolom"; kotak kosong tidak punya
    kunci sama sekali. */
let dcRdpsState = {};

const rdpsKunci = (tbl, row, col) => `${tbl.id}|${row.n}|${col.k}`;
function initDcRdpsState(){ dcRdpsState = {}; }
/** Unit FDPS-RDPS sedang aktif? Dipakai dispatcher simpan/cetak/edit. */
function dcRdpsAktif(){ return typeof unitAktif !== 'undefined' && unitAktif === 'fdpsrdps'; }

/** Jenis pilihan yang berlaku untuk satu sel. */
const rdpsJenisSel = (col, row) => RDPS_JENIS[col.j === 'baris' ? row.j : col.j] || RDPS_JENIS.opf;
const rdpsOpsi = (jenis, v) => jenis.opsi.find(o => o[0] === v) || null;

/** Semua sel pilih yang terisi dari sebuah state → [{tbl,row,col,opsi}].
    Dipakai temuan dan hitungan isi. */
function rdpsJelajah(fn){
  RDPS_BAGIAN.forEach(b => b.tabel().forEach(tbl => tbl.rows.forEach(row => tbl.cols.forEach(col => fn(b, tbl, row, col)))));
}

/** Temuan untuk riwayat/ringkasan: kotak berkelas fail → fails, warn → warns. */
function rdpsTemuan(state){
  const st = state || dcRdpsState, fails = [], warns = [];
  rdpsJelajah((b, tbl, row, col) => {
    if(col.t !== 'pilih') return;
    const o = rdpsOpsi(rdpsJenisSel(col, row), st[rdpsKunci(tbl, row, col)]);
    if(!o || o[3] === 'ok') return;
    const kolom = tbl.cols.length > 1 ? ` ${col.g ? col.g + ' ' : ''}${col.h}` : '';
    const teks = `${tbl.sebut} · ${row.n}${kolom}: ${o[1]}`;
    (o[3] === 'fail' ? fails : warns).push(teks);
  });
  return { fails, warns };
}

/** Hitungan kotak status per bagian: {isi, total, rusak}. Untuk sub-tab. */
function rdpsHitung(bagianId){
  let isi = 0, total = 0, rusak = 0;
  const b = RDPS_BAGIAN.find(x => x.id === bagianId);
  if(!b) return { isi, total, rusak };
  b.tabel().forEach(tbl => tbl.rows.forEach(row => tbl.cols.forEach(col => {
    if(col.t !== 'pilih') return;
    total++;
    const o = rdpsOpsi(rdpsJenisSel(col, row), dcRdpsState[rdpsKunci(tbl, row, col)]);
    if(o){ isi++; if(o[3] !== 'ok') rusak++; }
  })));
  return { isi, total, rusak };
}

/* ---------- Isian ---------- */

/** Tombol status diputar di tempat — tidak menggambar ulang tabel, supaya
    ratusan tombol tidak berkedip dan gulir tidak meloncat. */
function rdpsPutar(btn){
  const k = btn.dataset.k;
  const jenis = RDPS_JENIS[btn.dataset.j] || RDPS_JENIS.opf;
  const i = jenis.opsi.findIndex(o => o[0] === dcRdpsState[k]);
  const lanjut = jenis.opsi[i + 1];               // sesudah pilihan terakhir → kosong
  if(lanjut) dcRdpsState[k] = lanjut[0]; else delete dcRdpsState[k];
  rdpsLukisTombol(btn, lanjut || null);
  rdpsSegarkanSubtab();
}
function rdpsLukisTombol(btn, o){
  btn.classList.remove('ok', 'warn', 'fail', 'minus');
  btn.classList.add(o ? o[3] : 'minus');
  btn.textContent = o ? o[2] : '–';
  btn.title = o ? o[1] : 'Belum dicek';
}
function rdpsIsi(el){
  const v = el.value.trim();
  if(v) dcRdpsState[el.dataset.k] = v; else delete dcRdpsState[el.dataset.k];
}

/** Isi kotak status yang MASIH KOSONG di satu tabel dengan pilihan normalnya.
    Yang sudah ditandai (termasuk FAIL) tidak disentuh; jenis Main/Standby
    dilewati karena tak bisa ditebak. */
function rdpsSemuaNormal(tabelId){
  const tbl = rdpsSemuaTabel().find(t => t.id === tabelId);
  if(!tbl) return;
  let n = 0;
  tbl.rows.forEach(row => tbl.cols.forEach(col => {
    if(col.t !== 'pilih') return;
    const jenis = rdpsJenisSel(col, row);
    if(jenis.tanpaMassal) return;
    const k = rdpsKunci(tbl, row, col);
    if(!dcRdpsState[k]){ dcRdpsState[k] = jenis.opsi[0][0]; n++; }
  }));
  renderDcRdpsTable();
  if(typeof toast === 'function') toast(n ? `${n} kotak ditandai normal — yang tidak normal ubah manual.` : 'Semua kotak di tabel ini sudah terisi.');
}
const rdpsSemuaTabel = () => RDPS_BAGIAN.flatMap(b => b.tabel());

/* ---------- Penggambar bersama (isi / baca / cetak) ---------- */

/** Kepala tabel. Kolom ber-g sama yang bertetangga digabung jadi satu sel
    kepala di baris pertama; kolom tanpa g memanjang dua baris. */
function rdpsKepalaHtml(tbl, cetak){
  const sel = (teks, attr) => cetak
    ? `<td${attr} style="text-align:center;font-weight:bold;">${escapeHtml(teks)}</td>`
    : `<th${attr}>${escapeHtml(teks)}</th>`;
  const tr = isi => cetak ? `<tr class="p-kepala">${isi}</tr>` : `<tr>${isi}</tr>`;
  const adaGrup = tbl.cols.some(c => c.g);
  const rs = adaGrup ? ' rowspan="2"' : '';
  let atas = (tbl.no ? sel('No', rs) : '') + sel(tbl.kepalaNama || 'Nama', rs);
  let bawah = '';
  for(let i = 0; i < tbl.cols.length; i++){
    const c = tbl.cols[i];
    if(!c.g){ atas += sel(c.h + (c.sat && !cetak ? ` (${c.sat})` : ''), rs); continue; }
    let j = i;
    while(j + 1 < tbl.cols.length && tbl.cols[j + 1].g === c.g) j++;
    atas += sel(c.g, j > i ? ` colspan="${j - i + 1}"` : '');
    for(let x = i; x <= j; x++) bawah += sel(tbl.cols[x].h + (tbl.cols[x].sat ? ` ${tbl.cols[x].sat}` : ''), '');
    i = j;
  }
  return '<thead>' + tr(atas) + (adaGrup ? tr(bawah) : '') + '</thead>';
}

/** Satu sel data. mode: 'isi' | 'baca' | 'cetak'. */
function rdpsSelHtml(tbl, row, col, st, mode){
  const cetak = mode === 'cetak';
  if(col.t === 'info'){
    // Di kertas sektor dikecilkan: empat lajur workstation harus muat selebar A4.
    return `<td style="text-align:left;${cetak ? 'font-size:5.8pt;' : 'color:var(--muted);font-size:11px;'}">${escapeHtml(row.s || '')}</td>`;
  }
  const k = rdpsKunci(tbl, row, col);
  const v = st[k];
  if(col.t === 'pilih'){
    const jenis = rdpsJenisSel(col, row);
    const o = rdpsOpsi(jenis, v);
    if(mode === 'isi'){
      const jKey = col.j === 'baris' ? row.j : col.j;
      return `<td><button type="button" class="status-btn rdps-pilih ${o ? o[3] : 'minus'}" data-k="${escapeHtml(k)}"
                data-j="${jKey}" title="${o ? escapeHtml(o[1]) : 'Belum dicek'}" onclick="rdpsPutar(this)">${o ? escapeHtml(o[2]) : '–'}</button></td>`;
    }
    if(cetak){
      // Di kertas yang rusak ditebalkan supaya langsung kelihatan.
      const tebal = o && o[3] !== 'ok' ? 'font-weight:bold;' : '';
      return `<td style="text-align:center;white-space:nowrap;${tebal}">${o ? escapeHtml(o[2]) : '–'}</td>`;
    }
    return `<td><span class="status-btn rdps-pilih ${o ? o[3] : 'minus'}" style="cursor:default;" title="${o ? escapeHtml(o[1]) : ''}">${o ? escapeHtml(o[2]) : '–'}</span></td>`;
  }
  const teks = escapeHtml(v == null ? '' : String(v));
  if(mode === 'isi'){
    const lebar = col.t === 'angka' ? 'rdps-angka' : (col.lebar ? 'rdps-remark' : '');
    return `<td><input type="text" class="lk-isi ${lebar}" data-k="${escapeHtml(k)}" value="${teks}"
              ${col.t === 'angka' ? 'inputmode="decimal"' : ''} oninput="rdpsIsi(this)"></td>`;
  }
  const rata = col.t === 'angka' ? 'center' : 'left';
  return `<td style="text-align:${rata};">${teks || (cetak ? '' : '<span style="opacity:.45;">–</span>')}</td>`;
}

/** Satu tabel. Di layar dibungkus kartu kecil bertombol "Semua normal". */
function rdpsTabelHtml(tbl, st, mode){
  const cetak = mode === 'cetak';
  const body = tbl.rows.map((row, i) => {
    let tds = tbl.no ? `<td style="text-align:center;${cetak ? '' : 'color:var(--muted);'}">${i + 1}</td>` : '';
    tds += `<td class="${cetak ? '' : 'lk-par'}" style="text-align:left;${cetak ? 'white-space:nowrap;' : ''}">${escapeHtml(row.n)}</td>`;
    tds += tbl.cols.map(col => rdpsSelHtml(tbl, row, col, st, mode)).join('');
    return `<tr>${tds}</tr>`;
  }).join('');
  if(cetak){
    return `<div class="rdps-blk${tbl.penuh ? ' rdps-penuh' : ''}"><div class="rdps-blkh">${escapeHtml(tbl.judul)}</div>
      <table class="rdps-print">${rdpsKepalaHtml(tbl, true)}<tbody>${body}</tbody></table></div>`;
  }
  const bisaMassal = mode === 'isi' && tbl.rows.some(row => tbl.cols.some(col => col.t === 'pilih' && !rdpsJenisSel(col, row).tanpaMassal));
  const tombol = bisaMassal
    ? `<button type="button" class="btn ghost" style="padding:3px 9px;font-size:11px;" onclick="rdpsSemuaNormal('${tbl.id}')">✓ Semua normal</button>` : '';
  return `<div class="rdps-kartu${tbl.penuh ? ' rdps-penuh' : ''}">
    <div class="rdps-kartu-kepala"><span>${escapeHtml(tbl.judul)}</span>${tombol}</div>
    <div class="lk-gulir"><table class="lk-tbl rdps-tbl">${rdpsKepalaHtml(tbl, false)}<tbody>${body}</tbody></table></div>
  </div>`;
}

/** Satu bagian utuh (semua tabelnya). */
function rdpsBagianHtml(b, st, mode){
  const isi = b.tabel().map(tbl => rdpsTabelHtml(tbl, st, mode)).join('');
  if(mode === 'cetak'){
    const lajur = b.lajurCetak ? ` style="column-width:${b.lajurCetak}px;"` : '';
    return `<div class="rdps-bagian${b.halamanBaru ? ' rdps-halaman-baru' : ''}"><div class="rdps-bagian-judul">${escapeHtml(b.judul)}</div><div class="rdps-cols"${lajur}>${isi}</div></div>`;
  }
  const min = b.minKartu ? ` style="grid-template-columns:repeat(auto-fill, minmax(min(100%, ${b.minKartu}px), 1fr));"` : '';
  return `<div class="rdps-grid"${min}>${isi}</div>`;
}

/** Legenda singkat: arti tiap label, dikelompokkan per jenis pemeriksaan. */
function rdpsLegendaHtml(cetak){
  const baris = [
    ['Server / Radar / Switch / CWP', 'OPR = Operative/Operational · FAIL = Failed · MAINT = Maintenance · MAIN/STBY = Main/Standby'],
    ['LED Server (HPE)', 'GREEN = Normal · AMBER = Check iLO/IML · RED = Troubleshoot'],
    ['LED Cisco C9300L', 'Status & System: GREEN = Normal · BLINK G = Degraded · AMBER = Fault — Active: BLINK G = Normal · G-AMBER = Degraded · BLINK A = Fault'],
    ['Kotak kosong (–)', 'belum / tidak dicek']
  ];
  if(cetak) return `<div class="rdps-nb"><b>KETERANGAN :</b> ${baris.map(([a, b]) => `<b>${escapeHtml(a)}</b>: ${escapeHtml(b)}`).join(' &nbsp;|&nbsp; ')}</div>`;
  return baris.map(([a, b]) => `<div><b style="color:var(--text);">${escapeHtml(a)}</b> — ${escapeHtml(b)}</div>`).join('');
}

/* ---------- Form isian ---------- */

/** Gambar form ke #dcRdpsWrap: info + sub-tab bagian + isi bagian aktif. */
function renderDcRdpsTable(){
  const wrap = document.getElementById('dcRdpsWrap');
  if(!wrap) return;
  const b = RDPS_BAGIAN.find(x => x.id === dcRdpsBagian) || RDPS_BAGIAN[0];
  // Posisi gulir modal dijaga — "Semua normal" menggambar ulang seluruh bagian.
  const modal = wrap.closest('.modal');
  const gulir = modal ? modal.scrollTop : 0;
  wrap.innerHTML = `
    <div class="rdps-info">
      <div><b style="color:var(--text);">NEW-JAATS DAILY REPORT</b> — empat bagian di bawah satu lembar: diisi per tab, disimpan &amp; dicetak sekaligus.
        Klik kotak untuk memutar status; klik terus sampai kembali <b>–</b> untuk mengosongkan.</div>
      <details style="margin-top:4px;"><summary style="cursor:pointer;color:var(--accent);">Arti label</summary>${rdpsLegendaHtml(false)}</details>
    </div>
    <nav class="subtabs" id="dcRdpsSubtabs">${RDPS_BAGIAN.map(x =>
      `<button type="button" class="subtab-btn${x.id === b.id ? ' active' : ''}" data-rdps="${x.id}" onclick="setDcRdpsBagian('${x.id}')">${escapeHtml(x.label)} <span class="rdps-hitung"></span></button>`
    ).join('')}</nav>
    ${rdpsBagianHtml(b, dcRdpsState, 'isi')}`;
  rdpsSegarkanSubtab();
  if(modal) modal.scrollTop = gulir;
}

/** Hitungan "terisi/total" + jumlah temuan di tiap tombol sub-tab. */
function rdpsSegarkanSubtab(){
  document.querySelectorAll('#dcRdpsSubtabs .subtab-btn').forEach(btn => {
    const h = rdpsHitung(btn.dataset.rdps);
    const el = btn.querySelector('.rdps-hitung');
    if(!el) return;
    el.innerHTML = `${h.isi}/${h.total}` + (h.rusak ? ` <b style="color:var(--fail);">· ${h.rusak} temuan</b>` : '');
  });
}

function setDcRdpsBagian(id){
  if(!RDPS_BAGIAN.some(x => x.id === id)) return;
  dcRdpsBagian = id;
  renderDcRdpsTable();
  const nav = document.getElementById('dcRdpsSubtabs');
  if(nav) nav.scrollIntoView({ block:'nearest' });
}

/* ---------- Baca-saja: detail & cetak ---------- */

/** Detail modal — keempat bagian berurutan. */
function dcRdpsDetailHtml(state){
  const st = state || {};
  return RDPS_BAGIAN.map(b => `<div class="lk-seksi-judul" style="margin-top:16px;">${escapeHtml(b.judul)}</div>${rdpsBagianHtml(b, st, 'baca')}`).join('');
}

/** Halaman cetak: satu dokumen berisi keempat bagian, portrait, huruf rapat,
    tabel mengalir dalam beberapa lajur (seperti AMHS) — tabel kecil saling
    berdampingan, tabel lebar (status software server) selebar kertas. */
function buildDcRdpsPrintHtml(r, state){
  const st = state || {};
  const temuan = rdpsTemuan(st);
  const daftarTemuan = [...temuan.fails, ...temuan.warns];
  const gaya = `<style>
    #printArea .rdps{font-size:6.6pt;line-height:1.15;}
    #printArea .rdps .rdps-bagian{margin-top:6px;}
    #printArea .rdps .rdps-halaman-baru{break-before:page;page-break-before:always;}
    #printArea .rdps .rdps-bagian-judul{font-weight:bold;font-size:8.5pt;background:#dbe5f1;border:1px solid #000;padding:1px 4px;margin-bottom:3px;}
    #printArea .rdps .rdps-cols{column-width:170px;column-gap:6px;}
    #printArea .rdps .rdps-blk{break-inside:avoid;-webkit-column-break-inside:avoid;margin:0 0 4px;}
    #printArea .rdps .rdps-blk.rdps-penuh{column-span:all;}
    #printArea .rdps .rdps-blkh{font-weight:bold;font-size:6.9pt;margin:1px 0;}
    #printArea .rdps table.rdps-print{width:100%;border-collapse:collapse;}
    #printArea .rdps table.rdps-print td{border:1px solid #000;padding:0 2px !important;font-size:6.4pt;}
    #printArea .rdps .rdps-nb{font-size:6.3pt;margin-top:4px;}
    #printArea .rdps .no-border td{border:none !important;padding:0 3px !important;}
  </style>`;
  return gaya + `
    <div class="rdps">
      <div style="text-align:center;font-weight:bold;font-size:11pt;">NEW-JAATS DAILY REPORT</div>
      <div style="text-align:center;font-size:7.5pt;margin-bottom:4px;">Fasilitas Otomasi — Unit FDPS-RDPS</div>
      <table class="no-border" style="font-size:8pt;margin-bottom:2px;"><tr>
        <td style="width:50%;">HARI/TANGGAL : ${escapeHtml(r.tanggal || '') || '________'}</td>
        <td>DINAS : ${escapeHtml(r.dinas || '') || '________'}</td></tr></table>
      ${RDPS_BAGIAN.map(b => rdpsBagianHtml(b, st, 'cetak')).join('')}
      ${rdpsLegendaHtml(true)}
      ${daftarTemuan.length ? `<div class="rdps-nb"><b>TEMUAN :</b> ${escapeHtml(daftarTemuan.join('; '))}</div>` : ''}
      ${r.remark ? `<div class="rdps-nb"><b>CATATAN :</b> ${escapeHtml(r.remark).replace(/\n/g, '<br>')}</div>` : ''}
      <table class="no-border" style="font-size:8pt;margin-top:10px;break-inside:avoid;"><tr>
        <td style="width:55%;text-align:left;vertical-align:top;">
          <div style="margin-bottom:4px;">PETUGAS :</div>
          ${teknisiPrintBlock(r)}
        </td>
        <td style="text-align:center;vertical-align:top;">
          <div>Mengetahui,</div>
          <div style="margin-bottom:4px;">Manager Teknik</div>
          <div style="height:46px;">${ttdImg(r.managerTtd, 40)}</div>
          <div style="border-top:1px solid #000;display:inline-block;padding:0 24px;">
            ${r.managerTtd ? (escapeHtml(r.managerNama) || '&nbsp;') : '&nbsp;'}
          </div>
        </td>
      </tr></table>
    </div>`;
}
