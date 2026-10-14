/* E-Logbook · js/12h-daily-check-rdps.js — Daily Check unit fdpsrdps:
   NEW-JAATS (lokasi New JATSC) dan E-JAATS (lokasi JATSC)
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh.

   DUA LEMBAR, SATU MESIN. Unit ini menjaga dua sistem di dua gedung, jadi
   form-nya punya sub-tab lokasi (#dcRdpsLokasi di index.html): New JATSC →
   lembar NEW-JAATS, JATSC → lembar E-JAATS. Keduanya digambar mesin tabel
   yang sama di berkas ini; bedanya cuma daftar bagian/tabelnya (RDPS_FORM).
   Catatan tersimpan membawa __rdpsForm ('newjaats' | 'ejaats') di state-nya;
   catatan lama tanpa kunci itu = NEW-JAATS. Lembar E-JAATS diterangkan di
   atas daftarnya sendiri, sesudah bagian NEW-JAATS.

   ---- NEW-JAATS ----

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
  swAk: { opsi: [['bg', 'BLINKING GREEN', 'BLINK G', 'ok'], ['ga', 'GREEN-AMBER', 'G-AMBER', 'warn'], ['ba', 'BLINKING AMBER', 'BLINK A', 'fail']] },

  /* ----- E-JAATS (lokasi JATSC) — mengikuti kotak centang di kertasnya.
     Kelas 'off' = memang tidak dipakai/tidak tersambung: bukan temuan. ----- */
  // Hampir semua kotak: OK / NOT OK
  oknok: { opsi: [['ok', 'OK', 'OK', 'ok'], ['nok', 'NOT OK', 'NOT OK', 'fail']] },
  // Active splitter & CWP: OK / NOT OK / NOT USED
  oknu:  { opsi: [['ok', 'OK', 'OK', 'ok'], ['nok', 'NOT OK', 'NOT OK', 'fail'], ['nu', 'NOT USED', 'N/USED', 'off']] },
  // Network monitoring: up / down
  updn:  { opsi: [['up', 'UP', 'UP', 'ok'], ['down', 'DOWN', 'DOWN', 'fail']] },
  // Status server SDDS: Proc / Maintenance
  pm:    { opsi: [['proc', 'PROC', 'PROC', 'ok'], ['maint', 'MAINTENANCE', 'MAINT', 'warn']] },
  // Status server MDSI/PRISMA: Proc / Ready — pasangan aktif-siaga, dua-duanya
  // sehat dan tidak bisa ditebak, jadi dilewati tombol Semua normal.
  pr:    { opsi: [['proc', 'PROC', 'PROC', 'ok'], ['ready', 'READY', 'READY', 'ok']], tanpaMassal: true },
  // Status server ARTAS: Main / Hs (hot standby) — alasannya sama
  mh:    { opsi: [['main', 'MAIN', 'MAIN', 'ok'], ['hs', 'HOT STANDBY', 'HS', 'ok']], tanpaMassal: true },
  // Processing status ARTAS: Dual = redundant (normal), Single = tinggal satu
  ds:    { opsi: [['dual', 'DUAL', 'DUAL', 'ok'], ['single', 'SINGLE', 'SINGLE', 'warn']] },
  // Sensor ARTAS: V connect · X disconnect · O not connect
  conn:  { opsi: [['v', 'CONNECT', 'V CONN', 'ok'], ['x', 'DISCONNECT', 'X DISC', 'fail'], ['o', 'NOT CONNECT', 'O N/C', 'warn']] },
  // Sensor ala Nagios (SN. consistency, interface, NTP) — urutan kertasnya
  nag:   { opsi: [['ok', 'OK', 'OK', 'ok'], ['crit', 'CRIT', 'CRIT', 'fail'], ['unk', 'UNKNOWN', 'UNKN', 'warn'], ['warn', 'WARN', 'WARN', 'warn']] },
  // Mode PRISMA: ONLINE / NOT ONLINE
  onl:   { opsi: [['on', 'ONLINE', 'ONLINE', 'ok'], ['off', 'NOT ONLINE', 'NOT ONL', 'warn']] },
  // USER ARTAS OUT: hanya SATU ARTAS OUT yang tersambung ke broadcast, jadi
  // yang tidak tersambung itu wajar (off) — dan tidak bisa diisi massal.
  out:   { opsi: [['c', 'CONNECTED', 'CONN', 'ok'], ['n', 'NOT CONNECTED', 'N/C', 'off']], tanpaMassal: true },
  // Kotak centang tunggal (pekerjaan harian, backup SFPL): sudah dikerjakan
  cek:   { opsi: [['v', 'SUDAH', '✓', 'ok']] }
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
     penuh : true → selebar layar/kertas (tabel berkolom banyak)
     ket   : [teks] → catatan kecil di bawah tabel (petunjuk dari kertasnya)

   TABEL MELINTANG (E-JAATS). Di lembar E-JAATS perangkatnya di KOLOM
   (SDDS-A | SDDS-B) dan yang diperiksa di baris, jadi satu kolom memuat
   angka dan tombol sekaligus. Kolom begitu ditulis t:'baris', j:'baris' dan
   tipe selnya dibawa barisnya ({ n, t, j }) — rdpsTipe() yang menentukan. */
const rdpsBaris = (n, j, s) => ({ n, j: j || '', s: s || '' });
/** Tipe isian satu sel: dari kolomnya, atau dari barisnya kalau kolom t:'baris'. */
const rdpsTipe = (col, row) => col.t === 'baris' ? (row.t || 'teks') : col.t;
/** Pilihan yang bukan temuan: normal (ok) atau memang tidak dipakai (off). */
const rdpsSehat = o => o[3] === 'ok' || o[3] === 'off';
/** Pecah satu daftar panjang jadi n tabel berdampingan (lajur di kertasnya). */
function rdpsLajur(id, judul, sebut, kepalaNama, cols, daftar, n){
  const per = Math.ceil(daftar.length / n);
  return Array.from({ length: n }, (_, i) => ({
    id: `${id}-${i + 1}`, judul: `${judul} (${i + 1}/${n})`, sebut, kepalaNama, cols,
    rows: daftar.slice(i * per, (i + 1) * per).map(x => rdpsBaris(x))
  }));
}

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

/* =====================================================================
   ---- E-JAATS (lokasi JATSC) ----
   Dialihaksarakan dari "EJAATS Daily Logbook (Format Terbaru) 2026.xlsx",
   dua sheet yang di kertasnya dua halaman E-JAATS DAILY REPORT:
     · "EJAATS SW BARU"  — status software: Services Radar & ADS-B di
                           SDDS-A/B, GUI REC tiap CWP, ARTAS 1-2 (A/B),
                           MDSI, PRISMA, R2D2, Network Monitoring, CNMS,
                           Backup SFPL
     · "E-JAATS HW_BARU" — pekerjaan pemeliharaan harian + status hardware:
                           server, switch/NTP, RCS Rack, Active Splitter, CWP
   Sama seperti NEW-JAATS: SATU catatan per dinas, sub-tab hanya membagi
   layar. Baris yang di Excel-nya disembunyikan (radar MDN1, CKG3 kedua di
   ARTAS, splitter "NO. 6 (SMG2)" & "NO. 7 (BACS)") tidak ikut — memang tidak
   tercetak di kertasnya. cwp207 yang tertulis dua kali di daftar GUI REC
   dijadikan satu.
   ===================================================================== */

/** Baris bertipe sendiri untuk tabel melintang: tombol pilihan / kotak angka. */
const ejP = (n, j) => ({ n, t: 'pilih', j, s: '' });
const ejA = n => ({ n, t: 'angka', j: '', s: '' });
/** Kolom tabel melintang — satu kolom per perangkat. */
const ejKol = (...nama) => nama.map((h, i) => ({ k: 'abcd'[i], h, t: 'baris', j: 'baris' }));
/** Kolom status tunggal, dan kolom Keterangan. */
const ejSt = (j, h) => ({ k: 'st', h: h || 'Status', t: 'pilih', j });
const ejKet = { k: 'ket', h: 'Keterangan', t: 'teks', lebar: true };
const ejUrut = (awalan, dari, sampai, lebar) =>
  Array.from({ length: sampai - dari + 1 }, (_, i) => awalan + String(dari + i).padStart(lebar || 1, '0'));

// Baris yang berulang di tiap server: CpuUsage (USER/SYST/WAIT), DiskUsage
// (/ dan /boot), Memory (Ram GB + persen + kotak OK), FAN1-4.
const EJ_CPU  = [ejA('CPU User (%)'), ejA('CPU Syst (%)'), ejA('CPU Wait (%)')];
const EJ_DISK = [ejA('Disk / (%)'), ejA('Disk /boot (%)')];
const EJ_MEM  = [ejA('RAM (GB)'), ejA('Memory (%)'), ejP('Memory Status', 'oknok')];
const EJ_FAN  = ['FAN1', 'FAN2', 'FAN3', 'FAN4'].map(n => ejP(n, 'oknok'));

/* ---------- Bagian 1: SDDS — Services Radar · ADS-B · GUI REC ---------- */
const EJ_RADAR = ['CKG2','JOG2','KNO','NTA','PKU2','TPG2','PNK2','PDG','CKG3','BACS','SMG2','PLB2'];
const EJ_ADSB  = ['ATC OUT ADSB INT.','B. ACEH','BANJARMASIN','BENGKULU','KULONPROGO','MATAK','MEDAN','NATUNA','PALEMBANG',
                  'PAN. BUN','PEKANBARU','PONTIANAK','SEMARANG','NIAS','SOETA','LASIKIN','PUTUSIBAU','TANJ. PINANG',
                  'SURABAYA','LOC. UDP IN ADSB'];
const EJ_GUIREC = [...ejUrut('cwp', 1, 35, 2), 'cwp38', 'cwp39', 'cwp40', ...ejUrut('cwp', 201, 214),
                   'cwptwr1', 'cwptwr2', 'cwptwr4', 'cwptwr6', 'cwptwr9', 'sur_rec'];

function ejTabelSdds(){
  const ab = [{ k:'a', h:'SDDS-A', t:'pilih', j:'oknok' }, { k:'b', h:'SDDS-B', t:'pilih', j:'oknok' }];
  const gui = rdpsLajur('ej-gui', 'GUI REC', 'GUI REC', 'CWP', [ejSt('oknok', 'GUI REC')], EJ_GUIREC, 3);
  gui[gui.length - 1].ket = ['GUI REC: 1. cd /home/sdd/teknisi/  2. ketik ./gui_info  3. more gui_now.log'];
  return [
    { id:'ej-radar', judul:'Services RADAR', sebut:'Radar', kepalaNama:'Radar', no:true, cols:ab, rows: EJ_RADAR.map(n => rdpsBaris(n)) },
    { id:'ej-adsb',  judul:'Services ADS-B', sebut:'ADS-B', kepalaNama:'ADS-B', no:true, cols:ab, rows: EJ_ADSB.map(n => rdpsBaris(n)) },
    { id:'ej-sdds',  judul:'Server SDDS', sebut:'SDDS', kepalaNama:'Item', cols: ejKol('SDDS-A', 'SDDS-B'),
      rows: [ejP('Status Server', 'pm'), ...EJ_CPU, ...EJ_DISK, ...EJ_MEM] },
    ...gui
  ];
}

/* ---------- Bagian 2: ARTAS ---------- */
const EJ_ARTAS_SENSOR = ['ADS-B','BACS2','CKG2','CKG3','JOG2','KNO1','NTA','PDG','PKU2','PLB2','PNK2','SMG2','TPG2'];

function ejTabelArtas(){
  const kol = ejKol('ARTAS1-A', 'ARTAS1-B', 'ARTAS2-A', 'ARTAS2-B');
  return [
    { id:'ej-artas', judul:'Services ARTAS', sebut:'ARTAS', kepalaNama:'Services', cols: kol,
      rows: [ejP('Status Server', 'mh'), ejP('Processing Status', 'ds'), ...EJ_ARTAS_SENSOR.map(n => ejP(n, 'conn'))],
      ket: ['V = Connect · X = Disconnect · O = Not Connect', 'Dual = Redundant'] },
    { id:'ej-artas-item', judul:'ARTAS — CPU · Disk · Module', sebut:'ARTAS', kepalaNama:'Item', cols: kol,
      rows: [ejA('CPU Total (%)'), ejA('CPU User (%)'), ejA('CPU System (%)'), ejA('CPU Wait (%)'),
             ejA('Disk / (%)'), ejA('Disk /locrec (%)'), ejA('Disk /rec (%)'), ejA('Memory+SWAP (%)'),
             ejP('FUNC. MMS', 'oknok'), ejP('FUNC. RBR', 'oknok'), ejP('FUNC. SRV', 'oknok'), ejP('FUNC. TRK', 'oknok'),
             ejP('CLOCK STATUS', 'oknok'), ejP('USER ARTAS OUT', 'out')],
      ket: ['NOTE: only one ARTAS OUT connected to broadcast.'] }
  ];
}

/* ---------- Bagian 3: MDSI · PRISMA · R2D2 · Backup SFPL ---------- */
function ejTabelServer(){
  const nag = (...nama) => nama.map(n => ejP(n, 'nag'));
  return [
    { id:'ej-mdsi', judul:'MDSI', sebut:'MDSI', kepalaNama:'Services', cols: ejKol('MDSI-A', 'MDSI-B'),
      rows: [ejP('Status Server', 'pr'), ...EJ_CPU, ejP('CPU Status', 'oknok'), ...EJ_DISK, ejP('Disk Status', 'oknok'), ...EJ_MEM,
             ...nag('SN. CONFIG CONSISTENCY', 'SN. MODE CONSISTENCY', 'SN. FDPS RECEPTION', 'SN. SDPS RECEPTION', 'NTP SYNC.', 'SafetyNet State'),
             ...EJ_FAN] },
    { id:'ej-prisma', judul:'PRISMA', sebut:'PRISMA', kepalaNama:'Services', cols: ejKol('PRISMA-A', 'PRISMA-B'),
      rows: [ejP('Status Server', 'pr'), ...EJ_CPU, ejP('CPU Status', 'oknok'), ...EJ_DISK, ejP('Disk Status', 'oknok'), ...EJ_MEM,
             ...nag('Interface AFTN', 'Interface ARTAS', 'Interface S/N'), ejP('Mode', 'onl'), ejP('NTP Sync.', 'nag'),
             ...EJ_FAN] },
    { id:'ej-r2d2', judul:'R2D2', sebut:'R2D2', kepalaNama:'Services', cols: ejKol('R2D2-A', 'R2D2-B'),
      rows: [...EJ_CPU, ejA('CPU Total (%)'), ejP('CPU Status', 'oknok'),
             ejA('Disk / (%)'), ejA('Disk /boot (%)'), ejA('Disk /home (%)'), ejA('Disk /log (%)'), ejA('Disk /rec (%)'),
             ...EJ_MEM, ejP('NTP Sync.', 'nag')] },
    { id:'ej-sfpl', judul:'Backup SFPL ke CWP35', sebut:'Backup', kepalaNama:'Backup', cols: [ejSt('cek', 'Sudah')],
      rows: ['Backup SFPL1', 'Backup SFPL2'].map(n => rdpsBaris(n)),
      ket: ['SFPL1: 1. ssh fdps@fdps1, isi password  2. cd /usr/atcsys/log/sfpl/  3. cp sfplXX sdd@(IPCWP35):/home/sdd/sfpl1',
            'SFPL2: 1. ssh fdps@fdps2, isi password  2. cd /usr/atcsys/log/sfpl/  3. cp sfplXX sdd@(IPCWP35):/home/sdd/sfpl2'] }
  ];
}

/* ---------- Bagian 4: NETWORK MONITORING · TIME · CNMS ---------- */
const EJ_SWITCH = ejUrut('SW', 1, 8);
const EJ_NTP = ['NTP-A', 'NTP-B'];

function ejTabelNetwork(){
  return [
    { id:'ej-net',  judul:'Network Monitoring', sebut:'Network', kepalaNama:'Switch', cols: [ejSt('updn')], rows: EJ_SWITCH.map(n => rdpsBaris(n)) },
    { id:'ej-time', judul:'Time', sebut:'Time', kepalaNama:'NTP', cols: [ejSt('updn')], rows: EJ_NTP.map(n => rdpsBaris(n)) },
    { id:'ej-cnms', judul:'CNMS', sebut:'CNMS', kepalaNama:'Item', cols: ejKol('CNMS'),
      rows: [ejP('Status', 'oknok'), ...EJ_CPU, ejP('CPU Status', 'oknok'), ...EJ_DISK, ejP('Disk Status', 'oknok')] }
  ];
}

/* ---------- Bagian 5: HARDWARE (sheet "E-JAATS HW_BARU") ---------- */
const EJ_HARIAN = [
  '1. Periksa status komputer server dan workstation pada CNMS',
  '2. Periksa kerapian, kebersihan, dan suhu di ruang Processing Room',
  '3. Periksa operasional Flight Strip Printer di setiap sektor control ATC',
  '4. Periksa kondisi kebersihan monitor LCD 2K2K di setiap sektor control ATC',
  '5. Periksa status input AFTN (koordinasikan dengan unit AMSC-ADPS)'
];
const EJ_HW_SERVER = ['SDDS-NG-1','SDDS-NG-2','ARTAS-1','ARTAS-2','PRISMA-1','PRISMA-2','MDSI-1','MDSI-2','R2D2-1','R2D2-2'];
const EJ_HW_KOMPONEN = [['lan','LAN Card'],['psu','Power Supply'],['ram','RAM'],['cpu','Processor'],['fan','Fan'],['fp','Front Panel'],['hdd','Harddisk']];
const EJ_RCS = ['CMG CARD','SNL CARD','FAN UNIT','PSU','SNL-H CARD'];
const EJ_SPLITTER = ['NO. 1 (JOG2)','NO. 2 (CKG2)','NO. 3 (PKU2)','NO. 4 (PLB2)','NO. 5 (SMG2)','NO. 6 (BAC2)',
                     'NO. 7 (CKG3)','NO. 8 (NTA2)','NO. 9 (KNO)','NO. 10 (TPG2)','NO. 11 (PNK2)','NO. 12 (PDG2)'];
const EJ_HW_CWP = [...ejUrut('CWP', 1, 35), ...ejUrut('CWP', 38, 41), ...ejUrut('CWP', 201, 214),
                   'CWPTWR1','CWPTWR2','CWPTWR3','CWPTWR4','CWPTWR6','CWPTWR8','CWPTWR9'];

function ejTabelHardware(){
  return [
    // Di kertasnya suhu ditulis di samping pekerjaan no. 2 — di sini baris sendiri.
    { id:'ej-harian', judul:'Pekerjaan Pemeliharaan Harian', sebut:'Pekerjaan harian', kepalaNama:'Pekerjaan', penuh:true,
      cols: [{ k:'c', h:'Check', t:'baris', j:'baris' }],
      rows: [...EJ_HARIAN.map(n => ejP(n, 'cek')), ejA('Suhu ruang Processing Room (°C)')] },
    // Di kertasnya perangkat di kolom dan komponen di baris; di sini dibalik
    // supaya tujuh kolom (bukan sepuluh) — lebih muat di layar HP dan A4.
    { id:'ej-hw-srv', judul:'Server — Hardware Status', sebut:'Hardware', kepalaNama:'Device', penuh:true,
      cols: EJ_HW_KOMPONEN.map(([k, h]) => ({ k, h, t:'pilih', j:'oknok' })), rows: EJ_HW_SERVER.map(n => rdpsBaris(n)) },
    { id:'ej-hw-net', judul:'Network — Hardware Status', sebut:'Hardware Network', kepalaNama:'Device',
      cols: [ejSt('oknok'), ejKet], rows: [...EJ_SWITCH, ...EJ_NTP].map(n => rdpsBaris(n)) },
    { id:'ej-rcs', judul:'RCS Rack', sebut:'RCS Rack', kepalaNama:'Device',
      cols: [{ k:'a', h:'Chain A', t:'pilih', j:'oknok' }, { k:'b', h:'Chain B', t:'pilih', j:'oknok' }, ejKet],
      rows: EJ_RCS.map(n => rdpsBaris(n)) },
    { id:'ej-spl', judul:'Active Splitter', sebut:'Active Splitter', kepalaNama:'Device',
      cols: [ejSt('oknu'), ejKet], rows: EJ_SPLITTER.map(n => rdpsBaris(n)) },
    ...rdpsLajur('ej-cwp', 'Controller Working Position', 'CWP', 'Device', [ejSt('oknu')], EJ_HW_CWP, 4)
  ];
}

/* Sub-tab di layar mengikuti DUA SHEET Excel-nya — "EJAATS SW" dan
   "E-JAATS HW" (EJAATS_GRUP) — bukan per bagian: teknisi mencarinya dengan
   nama sheet itu. Bagian-bagian software tampil berurutan di dalam tab SW,
   persis urutan halaman 1 kertasnya; halaman 2 = hardware. */
const EJAATS_GRUP = [
  { id:'sw', label:'💾 EJAATS SW' },
  { id:'hw', label:'🛠 E-JAATS HW' }
];
const EJAATS_BAGIAN = [
  { id:'sdds',   grup:'sw', judul:'SDDS — SERVICES RADAR · ADS-B · GUI REC', tabel: ejTabelSdds },
  { id:'artas',  grup:'sw', judul:'ARTAS',                                   tabel: ejTabelArtas, minKartu: 400, lajurCetak: 250 },
  { id:'server', grup:'sw', judul:'MDSI · PRISMA · R2D2',                    tabel: ejTabelServer },
  { id:'net',    grup:'sw', judul:'NETWORK MONITORING · CNMS',               tabel: ejTabelNetwork },
  { id:'hw',     grup:'hw', judul:'HARDWARE',                                tabel: ejTabelHardware, halamanBaru: true }
];

/* ---------- Registry lembar (= sub-tab lokasi) ----------
   label  : nama lembar/sistemnya        lokasi : gedungnya (teks sub-tab)
   judul  : kepala halaman cetak         legenda: arti label tombol
   grup   : (opsional) sub-tab layar = kelompok bagian (b.grup), bukan per bagian */
const RDPS_FORM = {
  newjaats: {
    label: 'NEW-JAATS', lokasi: 'NEW JATSC', judul: 'NEW-JAATS DAILY REPORT', bagian: RDPS_BAGIAN,
    legenda: [
      ['Server / Radar / Switch / CWP', 'OPR = Operative/Operational · FAIL = Failed · MAINT = Maintenance · MAIN/STBY = Main/Standby'],
      ['LED Server (HPE)', 'GREEN = Normal · AMBER = Check iLO/IML · RED = Troubleshoot'],
      ['LED Cisco C9300L', 'Status & System: GREEN = Normal · BLINK G = Degraded · AMBER = Fault — Active: BLINK G = Normal · G-AMBER = Degraded · BLINK A = Fault']
    ]
  },
  ejaats: {
    label: 'E-JAATS', lokasi: 'JATSC', judul: 'E-JAATS DAILY REPORT', bagian: EJAATS_BAGIAN, grup: EJAATS_GRUP,
    legenda: [
      ['Kotak status', 'OK / NOT OK · UP / DOWN · N/USED = Not Used · ✓ = sudah dikerjakan'],
      ['Status server', 'PROC / MAINT (SDDS) · PROC / READY (MDSI, PRISMA) · MAIN / HS = Hot Standby (ARTAS)'],
      ['ARTAS', 'DUAL = Redundant · SINGLE · V CONN = Connect · X DISC = Disconnect · O N/C = Not Connect'],
      ['SafetyNet / Interface / NTP', 'OK · CRIT · UNKN = Unknown · WARN']
    ]
  }
};
const rdpsFormSah = f => (RDPS_FORM[f] ? f : 'newjaats');
/** Lembar sebuah catatan tersimpan. Catatan sebelum E-JAATS ada tidak membawa
    __rdpsForm — semuanya NEW-JAATS. */
const rdpsFormTersimpan = state => rdpsFormSah(state && state.__rdpsForm);
const rdpsBagianForm = form => RDPS_FORM[rdpsFormSah(form)].bagian;
/** Sub-tab layar sebuah lembar: kelompoknya kalau ada (E-JAATS: SW / HW),
    kalau tidak bagian-bagiannya sendiri (NEW-JAATS). → [{ id, label }] */
const rdpsTabForm = form => RDPS_FORM[rdpsFormSah(form)].grup || rdpsBagianForm(form);
/** Bagian yang tampil di bawah satu sub-tab. */
const rdpsBagianTab = (form, tabId) => rdpsBagianForm(form).filter(b => (RDPS_FORM[rdpsFormSah(form)].grup ? b.grup : b.id) === tabId);

/* ---------- State ---------- */

/** Lembar (lokasi) yang sedang dibuka di form. Ikut tersimpan sebagai
    __rdpsForm oleh saveDailyCheck. */
let dcRdpsForm = 'newjaats';
/** Sub-tab yang sedang tampil di layar (id bagian, atau id kelompok untuk
    lembar ber-grup). Tidak ikut tersimpan — semua bagian selalu disimpan bersama. */
let dcRdpsBagian = 'server';
/** Isian tiap lembar. Pindah lokasi bukan reset: isian lembar yang
    ditinggalkan tetap di sini sampai form di-reset. */
let dcRdpsStates = { newjaats: {}, ejaats: {} };
/** Isian lembar YANG SEDANG DIBUKA (menunjuk salah satu dcRdpsStates). Kunci
    "tabel|nama|kolom"; kotak kosong tidak punya kunci sama sekali. */
let dcRdpsState = dcRdpsStates.newjaats;

const rdpsKunci = (tbl, row, col) => `${tbl.id}|${row.n}|${col.k}`;
function initDcRdpsState(){
  dcRdpsStates = { newjaats: {}, ejaats: {} };
  dcRdpsState = dcRdpsStates[dcRdpsForm];
}
/** Jadikan `form` lembar yang dibuka, tanpa menggambar. Dipakai sub-tab lokasi
    dan pemuatan catatan untuk disunting. */
function rdpsPakaiForm(form){
  dcRdpsForm = rdpsFormSah(form);
  dcRdpsState = dcRdpsStates[dcRdpsForm];
  const tab = rdpsTabForm(dcRdpsForm);
  if(!tab.some(b => b.id === dcRdpsBagian)) dcRdpsBagian = tab[0].id;
}
/** Unit FDPS-RDPS sedang aktif? Dipakai dispatcher simpan/cetak/edit. */
function dcRdpsAktif(){ return typeof unitAktif !== 'undefined' && unitAktif === 'fdpsrdps'; }

/** Jenis pilihan yang berlaku untuk satu sel. */
const rdpsJenisSel = (col, row) => RDPS_JENIS[col.j === 'baris' ? row.j : col.j] || RDPS_JENIS.opf;
const rdpsOpsi = (jenis, v) => jenis.opsi.find(o => o[0] === v) || null;

/** Semua sel pilih yang terisi dari sebuah state → [{tbl,row,col,opsi}].
    Dipakai temuan dan hitungan isi. */
function rdpsJelajah(fn, form){
  rdpsBagianForm(form || dcRdpsForm).forEach(b => b.tabel().forEach(tbl => tbl.rows.forEach(row => tbl.cols.forEach(col => fn(b, tbl, row, col)))));
}

/** Temuan untuk riwayat/ringkasan: kotak berkelas fail → fails, warn → warns. */
function rdpsTemuan(state, form){
  const st = state || dcRdpsState, fails = [], warns = [];
  rdpsJelajah((b, tbl, row, col) => {
    if(rdpsTipe(col, row) !== 'pilih') return;
    const o = rdpsOpsi(rdpsJenisSel(col, row), st[rdpsKunci(tbl, row, col)]);
    if(!o || rdpsSehat(o)) return;
    const kolom = tbl.cols.filter(c => c.t !== 'teks' && c.t !== 'info').length > 1 ? ` ${col.g ? col.g + ' ' : ''}${col.h}` : '';
    const teks = `${tbl.sebut} · ${row.n}${kolom}: ${o[1]}`;
    (o[3] === 'fail' ? fails : warns).push(teks);
  }, form);
  return { fails, warns };
}

/** Hitungan kotak status per sub-tab: {isi, total, rusak}. */
function rdpsHitung(bagianId){
  let isi = 0, total = 0, rusak = 0;
  rdpsBagianTab(dcRdpsForm, bagianId).forEach(b => b.tabel().forEach(tbl => tbl.rows.forEach(row => tbl.cols.forEach(col => {
    if(rdpsTipe(col, row) !== 'pilih') return;
    total++;
    const o = rdpsOpsi(rdpsJenisSel(col, row), dcRdpsState[rdpsKunci(tbl, row, col)]);
    if(o){ isi++; if(!rdpsSehat(o)) rusak++; }
  }))));
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
  btn.classList.remove('ok', 'warn', 'fail', 'off', 'minus');
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
    if(rdpsTipe(col, row) !== 'pilih') return;
    const jenis = rdpsJenisSel(col, row);
    if(jenis.tanpaMassal) return;
    const k = rdpsKunci(tbl, row, col);
    if(!dcRdpsState[k]){ dcRdpsState[k] = jenis.opsi[0][0]; n++; }
  }));
  renderDcRdpsTable();
  if(typeof toast === 'function') toast(n ? `${n} kotak ditandai normal — yang tidak normal ubah manual.` : 'Semua kotak di tabel ini sudah terisi.');
}
const rdpsSemuaTabel = () => rdpsBagianForm(dcRdpsForm).flatMap(b => b.tabel());

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
  const tipe = rdpsTipe(col, row);
  if(tipe === 'pilih'){
    const jenis = rdpsJenisSel(col, row);
    const o = rdpsOpsi(jenis, v);
    if(mode === 'isi'){
      const jKey = col.j === 'baris' ? row.j : col.j;
      return `<td><button type="button" class="status-btn rdps-pilih ${o ? o[3] : 'minus'}" data-k="${escapeHtml(k)}"
                data-j="${jKey}" title="${o ? escapeHtml(o[1]) : 'Belum dicek'}" onclick="rdpsPutar(this)">${o ? escapeHtml(o[2]) : '–'}</button></td>`;
    }
    if(cetak){
      // Di kertas yang rusak ditebalkan supaya langsung kelihatan.
      const tebal = o && !rdpsSehat(o) ? 'font-weight:bold;' : '';
      return `<td style="text-align:center;white-space:nowrap;${tebal}">${o ? escapeHtml(o[2]) : '–'}</td>`;
    }
    return `<td><span class="status-btn rdps-pilih ${o ? o[3] : 'minus'}" style="cursor:default;" title="${o ? escapeHtml(o[1]) : ''}">${o ? escapeHtml(o[2]) : '–'}</span></td>`;
  }
  const teks = escapeHtml(v == null ? '' : String(v));
  if(mode === 'isi'){
    const lebar = tipe === 'angka' ? 'rdps-angka' : (col.lebar ? 'rdps-remark' : '');
    return `<td><input type="text" class="lk-isi ${lebar}" data-k="${escapeHtml(k)}" value="${teks}"
              ${tipe === 'angka' ? 'inputmode="decimal"' : ''} oninput="rdpsIsi(this)"></td>`;
  }
  const rata = tipe === 'angka' ? 'center' : 'left';
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
  const ket = tbl.ket || [];
  if(cetak){
    return `<div class="rdps-blk${tbl.penuh ? ' rdps-penuh' : ''}"><div class="rdps-blkh">${escapeHtml(tbl.judul)}</div>
      <table class="rdps-print">${rdpsKepalaHtml(tbl, true)}<tbody>${body}</tbody></table>
      ${ket.map(x => `<div class="rdps-ketc">${escapeHtml(x)}</div>`).join('')}</div>`;
  }
  const bisaMassal = mode === 'isi' && tbl.rows.some(row => tbl.cols.some(col => rdpsTipe(col, row) === 'pilih' && !rdpsJenisSel(col, row).tanpaMassal));
  const tombol = bisaMassal
    ? `<button type="button" class="btn ghost" style="padding:3px 9px;font-size:11px;" onclick="rdpsSemuaNormal('${tbl.id}')">✓ Semua normal</button>` : '';
  return `<div class="rdps-kartu${tbl.penuh ? ' rdps-penuh' : ''}">
    <div class="rdps-kartu-kepala"><span>${escapeHtml(tbl.judul)}</span>${tombol}</div>
    <div class="lk-gulir"><table class="lk-tbl rdps-tbl">${rdpsKepalaHtml(tbl, false)}<tbody>${body}</tbody></table></div>
    ${ket.length ? `<div class="rdps-ket">${ket.map(x => `<div>${escapeHtml(x)}</div>`).join('')}</div>` : ''}
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
function rdpsLegendaHtml(cetak, form){
  const baris = [...RDPS_FORM[rdpsFormSah(form)].legenda, ['Kotak kosong (–)', 'belum / tidak dicek']];
  if(cetak) return `<div class="rdps-nb"><b>KETERANGAN :</b> ${baris.map(([a, b]) => `<b>${escapeHtml(a)}</b>: ${escapeHtml(b)}`).join(' &nbsp;|&nbsp; ')}</div>`;
  return baris.map(([a, b]) => `<div><b style="color:var(--text);">${escapeHtml(a)}</b> — ${escapeHtml(b)}</div>`).join('');
}

/* ---------- Form isian ---------- */

/** Gambar form ke #dcRdpsWrap: info + sub-tab bagian + isi bagian aktif. */
function renderDcRdpsTable(){
  const wrap = document.getElementById('dcRdpsWrap');
  if(!wrap) return;
  const lembar = RDPS_FORM[dcRdpsForm];
  const tabs = rdpsTabForm(dcRdpsForm);
  const b = tabs.find(x => x.id === dcRdpsBagian) || tabs[0];
  // Satu sub-tab bisa memuat beberapa bagian (E-JAATS SW) — masing-masing diberi judul.
  const isi = rdpsBagianTab(dcRdpsForm, b.id);
  // Posisi gulir modal dijaga — "Semua normal" menggambar ulang seluruh bagian.
  const modal = wrap.closest('.modal');
  const gulir = modal ? modal.scrollTop : 0;
  wrap.innerHTML = `
    <div class="rdps-info">
      <div><b style="color:var(--text);">${escapeHtml(lembar.judul)}</b> · Lokasi <b style="color:var(--accent);">${escapeHtml(lembar.lokasi)}</b> — ${tabs.length} tab di bawah satu lembar: diisi per tab, disimpan &amp; dicetak sekaligus.
        Klik kotak untuk memutar status; klik terus sampai kembali <b>–</b> untuk mengosongkan.</div>
      <details style="margin-top:4px;"><summary style="cursor:pointer;color:var(--accent);">Arti label</summary>${rdpsLegendaHtml(false, dcRdpsForm)}</details>
    </div>
    <nav class="subtabs" id="dcRdpsSubtabs">${tabs.map(x =>
      `<button type="button" class="subtab-btn${x.id === b.id ? ' active' : ''}" data-rdps="${x.id}" onclick="setDcRdpsBagian('${x.id}')">${escapeHtml(x.label)} <span class="rdps-hitung"></span></button>`
    ).join('')}</nav>
    ${isi.map(x => (isi.length > 1 ? `<div class="lk-seksi-judul">${escapeHtml(x.judul)}</div>` : '') + rdpsBagianHtml(x, dcRdpsState, 'isi')).join('')}`;
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
  if(!rdpsTabForm(dcRdpsForm).some(x => x.id === id)) return;
  dcRdpsBagian = id;
  renderDcRdpsTable();
  const nav = document.getElementById('dcRdpsSubtabs');
  if(nav) nav.scrollIntoView({ block:'nearest' });
}

/* ---------- Selektor lokasi (sub-tab New JATSC / JATSC) ---------- */

/** Dipanggil sub-tab lokasi. Ganti lembar yang tampak; isian lembar lain
    tetap tinggal (dcRdpsStates). */
function setDcRdpsForm(form){
  if(!RDPS_FORM[form]) return;
  if(dcRdpsForm !== form){
    rdpsPakaiForm(form);
    dcRdpsBagian = rdpsTabForm(form)[0].id;
    renderDcRdpsTable();
  }
  sinkronSubtabRdps();
}
/** Sorot sub-tab lokasi yang cocok. Dipanggil juga oleh terapkanUnit() supaya
    pemuatan catatan untuk disunting ikut menyorotnya. */
function sinkronSubtabRdps(){
  document.querySelectorAll('#dcRdpsLokasi .subtab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.rdpsform === dcRdpsForm);
  });
}

/* ---------- Baca-saja: detail & cetak ---------- */

/** Detail modal — semua bagian lembarnya berurutan. */
function dcRdpsDetailHtml(state){
  const st = state || {};
  return rdpsBagianForm(rdpsFormTersimpan(st)).map(b => `<div class="lk-seksi-judul" style="margin-top:16px;">${escapeHtml(b.judul)}</div>${rdpsBagianHtml(b, st, 'baca')}`).join('');
}

/** Halaman cetak: satu dokumen berisi keempat bagian, portrait, huruf rapat,
    tabel mengalir dalam beberapa lajur (seperti AMHS) — tabel kecil saling
    berdampingan, tabel lebar (status software server) selebar kertas. */
function buildDcRdpsPrintHtml(r, state){
  const st = state || {};
  const form = rdpsFormTersimpan(st);
  const lembar = RDPS_FORM[form];
  const temuan = rdpsTemuan(st, form);
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
    #printArea .rdps .rdps-ketc{font-size:5.6pt;line-height:1.2;word-break:break-word;}
    #printArea .rdps .no-border td{border:none !important;padding:0 3px !important;}
  </style>`;
  return gaya + `
    <div class="rdps">
      <div style="text-align:center;font-weight:bold;font-size:11pt;">${escapeHtml(lembar.judul)}</div>
      <div style="text-align:center;font-size:7.5pt;margin-bottom:4px;">Fasilitas Otomasi — Unit FDPS-RDPS · Lokasi ${escapeHtml(lembar.lokasi)}</div>
      <table class="no-border" style="font-size:8pt;margin-bottom:2px;"><tr>
        <td style="width:50%;">HARI/TANGGAL : ${escapeHtml(r.tanggal || '') || '________'}</td>
        <td>DINAS : ${escapeHtml(r.dinas || '') || '________'}</td></tr></table>
      ${lembar.bagian.map(b => rdpsBagianHtml(b, st, 'cetak')).join('')}
      ${rdpsLegendaHtml(true, form)}
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
            ${r.managerTtd ? (namaPhHtml(r.managerNama) || '&nbsp;') : '&nbsp;'}
          </div>
        </td>
      </tr></table>
    </div>`;
}
