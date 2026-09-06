/* E-Logbook · js/17g-maint-listrik.js — Preventive Maintenance unit Listrik & Mekanik
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh.

   Tujuh lembar pemeliharaan dari "Checklist Pemeliharaan.xlsx" dijadikan
   SUB-TAB Preventive Maintenance masing-masing — satu kegiatan satu sub-tab,
   pola yang sama dengan Radtel (DS Test · Maintenance Radio · empat pekerjaan
   berkala). Dipisah begini karena tiap kegiatan punya jadwal berkalanya
   sendiri: riwayat, TTD Manager Teknik, dan cetaknya pun berdiri sendiri.

     paneldist  → PEMELIHARAAN RUTIN PANEL DISTRIBUSI
     sts        → PEMELIHARAAN BULANAN STS TOWER JATSC
     ups        → PEMELIHARAAN RUTIN UPS  (+ tabel tambahan Baterai UPS)
     chiller    → PEMELIHARAAN RUTIN BULANAN CHILLER, POMPA CHILLER & POMPA DISTRIBUSI
     ahu        → PEMELIHARAAN RUTIN AIR HANDLING UNIT
     genset     → PEMELIHARAAN RUTIN GENSET
     grounding  → PEMELIHARAAN SISTEM PENANGKAL PETIR DAN SISTEM PEMBUMIAN

   Sheet "0. Work Order" tidak dijadikan lembar sendiri — isinya perintah kerja
   (tanggal, klasifikasi, petugas, material) yang di aplikasi ini sudah
   dikerjakan kepala tiap form + Logbook Fasilitas.

   KOLOM YANG DIISI PEMAKAI. Di form aslinya kepala kolom Panel / UPS / Genset
   sengaja DIKOSONGKAN — teknisi menulis sendiri panel mana yang diukur hari
   itu. Di sini kolomnya pun dibuat begitu: ditambah/dikurangi lewat tombol
   "+ Kolom", namanya diketik di kepala tabel, dan ikut tersimpan di state
   (`kolom`) supaya cetak & detail menampilkan nama yang sama.

   TABEL TAMBAHAN BATERAI (lembar UPS). Sheet "3.b Maint UPS Battery" adalah
   lampiran lembar UPS — sederet tegangan per sel baterai (di berkasnya ada dua
   blok: 150 sel dan 96 sel). Karena jumlah sel berbeda-beda per UPS, blok
   baterai dibuat bisa ditambah sendiri: tiap blok punya nama UPS, merk, tipe,
   dan jumlah sel; selnya digambar tiga kolom bernomor seperti aslinya.

   PENYIMPANAN. Menumpang tabel `dstest` seperti Maintenance Radio (17c),
   Weekly Check (17d), Ground Check (17e), dan Meter Reading (17f): dibedakan
   lewat state.__format === 'maintlistrik' + state.__mlForm (id lembar).
   Seluruh rangkaian TTD Manager Teknik, kotak masuk TTD, hapus, dan cetak
   sudah tersedia untuk 'dstest'. Guard daftar-site di insertDsTest (db.js +
   db-pg.js) dilewati untuk format ini.

   SEMUA KOTAK ISIAN DIWARNAI SENDIRI (--panel-2 / --line / --text) lewat kelas
   .ml-isi di css/05-tabel.css. Kotak bawaan peramban berlatar putih dan di
   tema gelap terlihat seperti bercak — pelajaran dari lembar Gedung &
   Keamanan; jangan biarkan ada <input> di berkas ini yang lolos tanpa warna. */

/* ---------- Pembentuk baris (sebangun dengan 12g) ---------- */

/** Baris data. `sat` hanya terpakai kalau seksinya ber-kolom SATUAN. */
const MLR = (no, label, sat, opsi) => Object.assign({ no: no || '', label, sat: sat || '' }, opsi || {});
/** Baris sub-judul selebar tabel — padanan sel yang di-merge menurun di Excel. */
const MLG = teks => ({ group: teks });
/** Baris identitas: sederet kotak teks berlabel, selebar tabel. Dipakai lembar
    AHU yang tiap unitnya diawali tiga isian "AHU: / Merk: / Type:". */
const MLI = (kunci, medan) => ({ ident: kunci, medan });

/** Kolom pilihan (tombol berputar) — dipakai lembar Grounding & Petir yang
    jawabannya ADA/TIDAK ADA dan BAIK/TIDAK BAIK, bukan angka. */
const MLP = (k, opsi, kelas) => ({ k, t: 'pilih', opsi, kelas });

/* ---------- Lembar 1: Panel Distribusi ---------- */
/* Kolom panelnya dibuat pemakai (lihat `dyn`). Satuan Cos Phi di berkas
   aslinya tertulis "Hz" — jelas keliru untuk faktor daya, jadi dikosongkan. */
function mlSeksiPanelDist(){
  return [
    { judul: 'DATA PENGUKURAN PANEL DISTRIBUSI',
      dyn: { label: 'PANEL', sub: 'RUANG', awal: 3, ph: 'mis. LP-1', phSub: 'mis. R. Panel' },
      sat: true, ket: true,
      rows: [
        MLG('1 · Tegangan'),
        MLR('', 'L1-L2 / RS', 'Vac'), MLR('', 'L1-L3 / TR', 'Vac'), MLR('', 'L2-L3 / ST', 'Vac'),
        MLR('', 'L1-N', 'Vac'), MLR('', 'L2-N', 'Vac'), MLR('', 'L3-N', 'Vac'),
        MLR('', 'L1-G', 'Vac'), MLR('', 'L2-G', 'Vac'), MLR('', 'L3-G', 'Vac'),
        MLR('', 'N-G', 'Vac'),
        MLG('2 · Arus'),
        MLR('', 'L1 / R', 'A'), MLR('', 'L2 / S', 'A'), MLR('', 'L3 / T', 'A'), MLR('', 'N', 'A'),
        MLR('3', 'Frequency', 'Hz'),
        MLR('4', 'Cos Phi (φ) *', ''),
        MLR('5', 'Temperatur Ruangan', '°C'),
        MLR('6', 'Temperatur Panel', '°C'),
        MLR('7', 'Temperatur Kabel', '°C')
      ] }
  ];
}

/* ---------- Lembar 2: STS (bulanan) ---------- */
/* Bentuk tabelnya sama persis dengan lembar STS harian; yang beda cuma judul
   dan kekerapannya. Daftar sembilan lokasinya dipakai bersama dari
   js/12g-daily-check-listrik.js (LK_STS_LOKASI) — satu sumber kebenaran untuk
   "sembilan lokasi STS di JATSC"; kalau lokasinya berubah, dua-duanya ikut.
   Ada fallback kalau 12g belum termuat, supaya berkas ini tidak ikut mati. */
const ML_STS_LOKASI = (typeof LK_STS_LOKASI !== 'undefined') ? LK_STS_LOKASI : [
  'ESS', 'AMSC', 'MER', 'PROCESSING ROOM', 'OPS. ROOM 1',
  'MDS', 'OPS. ROOM 2', 'BILLING SYSTEM', 'TER'
];

function mlSeksiSts(){
  const blok = lokasi => [
    MLG(lokasi),
    MLR('1', 'STS Line 1'),
    MLR('2', 'STS Line 2'),
    MLR('3', 'Output STS', '', { tanpa: ['kondisi'] })
  ];
  return [
    { judul: 'PEMELIHARAAN PANEL STS PER LOKASI',
      cols: ['rn', 'sn', 'tn', 'ir', 'is', 'it', 'suhu', 'frek',
             MLP('kondisi', ['ON', 'STANDBY', 'OFF'], ['ok', 'warn', 'minus'])],
      ket: true,
      head: [
        [['NO', 1, 2], ['JENIS PANEL', 1, 2], ['TEGANGAN (VOLT)', 3], ['ARUS (AMPERE)', 3],
         ['SUHU RUANGAN (°C)', 1, 2], ['FREKUENSI (Hz)', 1, 2], ['KONDISI', 1, 2], ['KETERANGAN', 1, 2]],
        ['R-N', 'S-N', 'T-N', 'R', 'S', 'T']
      ],
      rows: ML_STS_LOKASI.flatMap(blok) }
  ];
}

/* ---------- Lembar 3: UPS (+ tabel tambahan baterai) ---------- */
function mlSeksiUps(){
  return [
    { judul: 'DATA PENGUKURAN UPS',
      dyn: { label: 'UPS', sub: 'LOKASI', awal: 3, ph: 'mis. UPS 1', phSub: 'mis. MER' },
      sat: true, ket: true,
      rows: [
        MLG('1 · Tegangan Rectifier'),
        MLR('', 'L1-N / L1-L2', 'Vac'), MLR('', 'L2-N / L1-L3', 'Vac'), MLR('', 'L3-N / L2-L3', 'Vac'),
        MLG('2 · Arus Rectifier'),
        MLR('', 'L1', 'A'), MLR('', 'L2', 'A'), MLR('', 'L3', 'A'),
        MLR('3', 'Frequency Input', 'Hz'),
        MLG('4 · Tegangan Inverter'),
        MLR('', 'L1-N / L1-L2', 'Vac'), MLR('', 'L2-N / L1-L3', 'Vac'), MLR('', 'L3-N / L2-L3', 'Vac'),
        MLG('5 · Arus Inverter'),
        MLR('', 'L1', 'A'), MLR('', 'L2', 'A'), MLR('', 'L3', 'A'),
        MLR('6', 'Frequency Output', 'Hz'),
        MLR('7', 'Temperatur Ruangan', '°C'),
        MLR('8', 'Temperatur Cover', '°C'),
        MLR('9', 'Temperatur Battery', '°C'),
        MLR('10', 'Tegangan Floating', 'Vdc'),
        MLR('11', 'Arus Battery', 'A'),
        MLR('12', 'Daya', 'KVA / KW'),
        MLR('13', 'Kapasitas Battery', 'Ah')
      ] },
    /* Lampiran "3.b Maint UPS Battery" — jumlah blok & jumlah selnya ditentukan
       pemakai, karena tiap UPS beda banyak baterainya (di berkas aslinya ada
       yang 150 sel, ada yang 96). */
    { tipe: 'baterai', judul: 'HASIL PENGUKURAN BATERAI UPS' }
  ];
}

/* ---------- Lembar 4: Chiller, Pompa Chiller & Pompa Distribusi ---------- */
function mlSeksiChiller(){
  const cond = [];
  for(let i = 1; i <= 12; i++) cond.push('c' + i);
  return [
    { judul: 'GEDUNG 612 — CHILLER',
      cols: ['ar', 'as', 'at', 'tin', 'tout', 'sin', 'sout', ...cond, 'kkond', 'kcomp', 'disc', 'suct'],
      ket: true,
      head: [
        [['NO', 1, 2], ['PERALATAN', 1, 2], ['AMPERE COMP.', 3], ['TEK. AIR (bar)', 2],
         ['TEMP. AIR (°C)', 2], ['CONDENSOR', 12], ['KINERJA (%)', 2], ['TEKANAN (bar)', 2],
         ['KETERANGAN', 1, 2]],
        ['R', 'S', 'T', 'IN', 'OUT', 'IN', 'OUT',
         '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12',
         'Kond', 'Comp', 'DISC', 'SUCT']
      ],
      rows: [
        MLG('1 · CHILLER 1  (180 TR)'),
        MLR('', 'COMP. 1'), MLR('', 'COMP. 2'),
        MLG('2 · CHILLER 2  (180 TR)'),
        MLR('', 'COMP. 1'), MLR('', 'COMP. 2'), MLR('', 'COMP. 3'),
        MLG('3 · CHILLER 3  (180 TR)'),
        MLR('', 'COMP. 1'), MLR('', 'COMP. 2'),
        MLG('4 · TEMPERATUR LUAR'),
        MLR('', 'Temperatur Luar', '', { only: ['ar'] })
      ] },

    { judul: 'GEDUNG 612 — POMPA CHILLER & POMPA DISTRIBUSI',
      cols: ['ar', 'as', 'at', 'tin', 'tout', 'seal', 'kopling', 'bmotor', 'bpompa'],
      ket: true,
      head: [
        [['NO', 1, 2], ['PERALATAN', 1, 2], ['AMPERE MOTOR', 3], ['TEK. AIR (bar)', 2],
         ['POMPA', 2], ['BEARING', 2], ['KETERANGAN', 1, 2]],
        ['R', 'S', 'T', 'IN', 'OUT', 'SEAL', 'KOPLING', 'MOTOR', 'POMPA']
      ],
      rows: [
        MLR('1', 'POMPA DIST. 1  (7,5 KW)'),
        MLR('2', 'POMPA DIST. 2  (7,5 KW)'),
        MLR('3', 'POMPA DIST. 3  (7,5 KW)'),
        MLR('4', 'POMPA DIST. 4  (7,5 KW)'),
        MLR('5', 'POMPA CH. 1  (20 KW)'),
        MLR('6', 'POMPA CH. 2  (20 KW)')
      ] }
  ];
}

/* ---------- Lembar 5: AHU ---------- */
/* Lima slot AHU seperti di berkas aslinya; tiap slot diawali baris identitas
   (AHU / Merk / Type) yang diisi teknisi, lalu satu baris pengukuran. */
function mlSeksiAhu(){
  const rows = [];
  for(let i = 1; i <= 5; i++){
    rows.push(MLI('ahu' + i, [
      { k: 'nama', label: 'AHU',  ph: 'mis. AHU 13' },
      { k: 'merk', label: 'Merk', ph: '' },
      { k: 'tipe', label: 'Type', ph: '' }
    ]));
    rows.push(MLR(String(i), 'Pengukuran AHU ' + i));
  }
  return [
    { judul: 'DATA PENGUKURAN AIR HANDLING UNIT',
      cols: ['ar', 'as', 'at', 'tin', 'tout', 'sin', 'sout', 'bmotor', 'bblower',
             'filter', 'blower', 'vbelt'],
      ket: true,
      head: [
        [['NO', 1, 2], ['DATA PENGUKURAN', 1, 2], ['AMPERE MOTOR', 3], ['TEK. AIR (bar)', 2],
         ['TEMP. AIR (°C)', 2], ['BEARING', 2], ['AHU', 3], ['KETERANGAN', 1, 2]],
        ['R', 'S', 'T', 'IN', 'OUT', 'IN', 'OUT', 'Motor', 'Blower', 'Filter', 'Blower', 'V-Belt']
      ],
      rows }
  ];
}

/* ---------- Lembar 6: Genset ---------- */
/* Penomoran 17 muncul dua kali di berkas aslinya (Battery Panel Control dan
   kWH PLN) — dibiarkan apa adanya supaya cocok dengan kertasnya. */
function mlSeksiGenset(){
  return [
    { judul: 'DATA PENGUKURAN GENSET',
      dyn: { label: 'GENSET', sub: 'LOKASI', awal: 2, ph: 'mis. Genset 1', phSub: 'mis. Gd. 720' },
      sat: true, ket: true,
      rows: [
        MLG('1 · Tegangan PLN'),
        MLR('', 'L1-N / L1-L2', 'Vac'), MLR('', 'L2-N / L1-L3', 'Vac'), MLR('', 'L3-N / L2-L3', 'Vac'),
        MLG('2 · Arus PLN'),
        MLR('', 'L1', 'A'), MLR('', 'L2', 'A'), MLR('', 'L3', 'A'), MLR('', 'N', 'A'),
        MLR('3', 'Frequency PLN', 'Hz'),
        MLG('4 · Tegangan Stabilizer'),
        MLR('', 'L1-N / L1-L2', 'Vac'), MLR('', 'L2-N / L1-L3', 'Vac'), MLR('', 'L3-N / L2-L3', 'Vac'),
        MLG('5 · Arus Stabilizer'),
        MLR('', 'L1', 'A'), MLR('', 'L2', 'A'), MLR('', 'L3', 'A'), MLR('', 'N', 'A'),
        MLR('6', 'Frequency Stabilizer', 'Hz'),
        MLG('7 · Tegangan Genset'),
        MLR('', 'L1-N / L1-L2', 'Vac'), MLR('', 'L2-N / L1-L3', 'Vac'), MLR('', 'L3-N / L2-L3', 'Vac'),
        MLG('8 · Arus Genset'),
        MLR('', 'L1', 'A'), MLR('', 'L2', 'A'), MLR('', 'L3', 'A'), MLR('', 'N', 'A'),
        MLR('9', 'Frequency Genset', 'Hz'),
        MLR('10', 'RPM Genset', 'rpm'),
        MLR('11', 'Hour Counter', 'jam'),
        MLR('12', 'Temperatur Ruangan', '°C'),
        MLR('13', 'Tangki Induk', 'liter'),
        MLR('14', 'Tangki Harian', 'liter'),
        MLR('15', 'Fill Rite Flow Meter', 'liter'),
        MLR('16', 'Battery Starter', 'Vdc'),
        MLR('17', 'Battery Panel Control', 'Vdc'),
        MLR('17', 'kWH PLN', 'kWh'),
        MLR('18', 'Cadangan Air Aki', 'botol'),
        MLR('19', 'Cadangan Oli Pelumas', 'liter')
      ] }
  ];
}

/* ---------- Lembar 7: Grounding & Penangkal Petir ---------- */
function mlSeksiGrounding(){
  return [
    { judul: 'VISUAL — HASIL PEMERIKSAAN',
      cols: [MLP('ada', ['ADA', 'TIDAK ADA'], ['ok', 'fail']),
             MLP('kondisi', ['BAIK', 'TIDAK BAIK'], ['ok', 'fail'])],
      ket: true,
      head: [['NO', 'ITEM PEMERIKSAAN', 'KETERSEDIAAN', 'KONDISI', 'CATATAN']],
      rows: [
        MLR('1', 'Terminal Udara'),
        MLR('2', 'Konduktor Turun'),
        MLR('3', 'Modul Penangkal Petir'),
        MLR('4', 'Sambungan dan Clamp'),
        MLR('5', 'Kabel Pembumian'),
        MLR('6', 'Lighting Counter')
      ] },

    /* Nilai standarnya ditulis menyatu dengan nama itemnya — di berkas aslinya
       kolom STANDARD isinya tetap, bukan sesuatu yang diisi teknisi. */
    { judul: 'PENGUKURAN', sat: true, ket: true,
      cols: ['hasil'],
      head: [['NO', 'ITEM PEMERIKSAAN', 'HASIL', 'SATUAN', 'CATATAN']],
      rows: [
        MLR('1', 'Nilai Tahanan Tanah  ·  standar ≤ 3 Ω', 'Ω'),
        MLR('2', 'Nilai Tahanan Pentanahan Peralatan  ·  standar ≤ 1 Ω', 'Ω'),
        MLR('3', 'Uji Kontinuitas Konduktor Turun dan Kabel Pentanahan', '')
      ] }
  ];
}

/* ---------- Katalog lembar ---------- */

const ML_FORMS = {
  paneldist: {
    label: 'Panel Distribusi',
    judul: 'PEMELIHARAAN RUTIN PANEL DISTRIBUSI',
    sub: 'Tegangan · Arus · Frekuensi · Temperatur, per panel',
    orientasi: 'portrait',
    meta: [{ k: 'lokasi', label: 'Lokasi', ph: 'mis. Gedung 720' }],
    seksi: mlSeksiPanelDist
  },
  sts: {
    label: 'STS',
    judul: 'PEMELIHARAAN BULANAN STS TOWER JATSC',
    sub: 'Sembilan lokasi × STS Line 1 / Line 2 / Output',
    orientasi: 'portrait',
    meta: [{ k: 'waktu', label: 'Waktu', tipe: 'jam' }],
    seksi: mlSeksiSts
  },
  ups: {
    label: 'UPS',
    judul: 'PEMELIHARAAN RUTIN UPS',
    sub: 'Rectifier · Inverter · Battery, plus tabel tegangan sel baterai',
    orientasi: 'portrait',
    meta: [{ k: 'lokasi', label: 'Lokasi', ph: 'mis. Gedung 720' },
           { k: 'waktu',  label: 'Waktu',  tipe: 'jam' }],
    seksi: mlSeksiUps
  },
  chiller: {
    label: 'Chiller',
    judul: 'PEMELIHARAAN RUTIN BULANAN CHILLER, POMPA CHILLER, DAN POMPA DISTRIBUSI TOWER JATSC',
    sub: 'Tiga chiller · empat pompa distribusi · dua pompa chiller',
    // Dua puluh tiga kolom ukur — satu-satunya lembar yang tak muat di kertas
    // berdiri; ini dicetak melintang.
    orientasi: 'landscape',
    meta: [{ k: 'waktu', label: 'Waktu', tipe: 'jam' }],
    seksi: mlSeksiChiller
  },
  ahu: {
    label: 'AHU',
    judul: 'PEMELIHARAAN RUTIN AIR HANDLING UNIT',
    sub: 'Lima slot AHU — ampere motor, tekanan & temperatur air, bearing',
    orientasi: 'portrait',
    meta: [{ k: 'lokasi', label: 'Lokasi', ph: 'mis. Gedung 612 — AHU 13 untuk Gedung 613' },
           { k: 'waktu',  label: 'Waktu',  tipe: 'jam' }],
    seksi: mlSeksiAhu
  },
  genset: {
    label: 'Genset',
    judul: 'PEMELIHARAAN RUTIN GENSET',
    sub: 'PLN · Stabilizer · Genset, tangki, battery, cadangan',
    orientasi: 'portrait',
    meta: [{ k: 'lokasi', label: 'Lokasi', ph: 'mis. Gedung 720' }],
    seksi: mlSeksiGenset
  },
  grounding: {
    label: 'Grounding & Petir',
    judul: 'PEMELIHARAAN SISTEM PENANGKAL PETIR DAN SISTEM PEMBUMIAN',
    sub: 'Checklist visual + pengukuran tahanan pembumian',
    orientasi: 'portrait',
    meta: [{ k: 'peralatan', label: 'Nama Peralatan / Fasilitas', ph: '' },
           { k: 'lokasi',    label: 'Lokasi', ph: '' }],
    seksi: mlSeksiGrounding
  }
};
const ML_URUT = ['paneldist', 'sts', 'ups', 'chiller', 'ahu', 'genset', 'grounding'];

/** Seksi lembar itu. Dihitung tiap kali dipanggil — skemanya murni data. */
function mlSeksi(form){
  const f = ML_FORMS[form];
  return f ? f.seksi() : [];
}

/* ---------- State lembar yang sedang diisi ---------- */

let mlForm = 'paneldist';
/** Nilai sel, kunci "si|ri|kol"; sel identitas "si|ri|ident:medan". */
let mlData = {};
/** Kolom buatan pemakai untuk lembar ber-`dyn`: [{n, s}] (nama, sub). */
let mlKolom = [];
/** Blok baterai tambahan (lembar UPS): [{ups, merk, tipe, n}]. */
let mlBat = [];
/** Isian kepala (lokasi/waktu/peralatan) menurut ML_FORMS[form].meta. */
let mlMeta = {};
let mlTeknisiRows = [];
let mlTeknisiSeq = 0;

const mlKunci = (si, ri, kol) => `${si}|${ri}|${kol}`;
function mlSet(k, v){ mlData[k] = String(v == null ? '' : v); }
function mlVal(data, k){ const v = (data || {})[k]; return v === undefined ? '' : v; }

/** Kunci kolom sebuah descriptor — string biasa atau objek MLP. */
const mlKolKunci = c => (typeof c === 'string' ? c : c.k);

/** Kolom data seksi: yang statis dari `cols`, yang dinamis dari `mlKolom`. */
function mlKolomSeksi(sec, kolom){
  if(!sec.dyn) return sec.cols || [];
  return (kolom || []).map((_, i)=>'d' + i);
}

/** Daftar kunci kolom yang boleh diisi pada satu baris — data + 'ket'.
    only/tanpa mengatur kolom ANGKA saja; kolom KETERANGAN tetap terbuka
    kecuali disebut di `tanpa`. Sama aturan dengan 12g. */
function mlKolomAktif(sec, row, kolom){
  let data = mlKolomSeksi(sec, kolom).map(mlKolKunci);
  if(row.only)       data = data.filter(k=>row.only.includes(k));
  else if(row.tanpa) data = data.filter(k=>!row.tanpa.includes(k));
  const ket = sec.ket && !(row.tanpa && row.tanpa.includes('ket')) ? ['ket'] : [];
  return data.concat(ket);
}

/** Nilai awal satu lembar. Kolom pilihan mulai di pilihan pertama (ADA / BAIK /
    ON) — di form aslinya memang selalu ada satu kotak yang tercentang. */
function mlInit(form){
  mlData = {};
  mlMeta = {};
  mlBat  = [];
  const def = ML_FORMS[form] || {};
  (def.meta || []).forEach(m=>{ mlMeta[m.k] = ''; });
  // Kolom dinamis: sediakan sebanyak `awal` kolom kosong supaya tabelnya tidak
  // tampil tanpa satu kolom pun.
  const dyn = mlSeksi(form).find(s=>s.dyn);
  mlKolom = dyn ? Array.from({ length: dyn.dyn.awal }, ()=>({ n:'', s:'' })) : [];
  mlSeksi(form).forEach((sec, si)=>{
    if(sec.tipe) return;
    (sec.rows || []).forEach((row, ri)=>{
      if(row.group) return;
      if(row.ident){ row.medan.forEach(m=>{ mlData[mlKunci(si, ri, 'ident:' + m.k)] = ''; }); return; }
      mlKolomAktif(sec, row, mlKolom).forEach(k=>{
        const c = (sec.cols || []).find(x=>mlKolKunci(x) === k);
        mlData[mlKunci(si, ri, k)] = (c && c.t === 'pilih') ? c.opsi[0] : '';
      });
    });
  });
}

/* ---------- Kolom dinamis (Panel / UPS / Genset) ---------- */

function mlTambahKolom(){ mlKolom.push({ n:'', s:'' }); renderMlTable(); }
function mlHapusKolom(i){
  if(mlKolom.length <= 1) return;   // satu kolom terakhir jangan dihapus
  mlKolom.splice(i, 1);
  // Nilai kolom setelahnya bergeser satu ke kiri — kalau tidak digeser,
  // angka yang tadinya milik kolom 3 tiba-tiba tampil di kolom 2.
  const baru = {};
  Object.entries(mlData).forEach(([k, v])=>{
    const m = k.match(/^(\d+)\|(\d+)\|d(\d+)$/);
    if(!m){ baru[k] = v; return; }
    const idx = +m[3];
    if(idx === i) return;                       // kolom yang dihapus
    baru[`${m[1]}|${m[2]}|d${idx > i ? idx - 1 : idx}`] = v;
  });
  mlData = baru;
  renderMlTable();
}
function mlSetKolom(i, medan, v){ if(mlKolom[i]) mlKolom[i][medan] = v; }

/* ---------- Blok baterai tambahan (lembar UPS) ---------- */

function mlTambahBat(){ mlBat.push({ ups:'', merk:'', tipe:'', n:50 }); renderMlTable(); }
function mlHapusBat(i){
  mlBat.splice(i, 1);
  const baru = {};
  Object.entries(mlData).forEach(([k, v])=>{
    const m = k.match(/^bat\|(\d+)\|(\d+)$/);
    if(!m){ baru[k] = v; return; }
    const bi = +m[1];
    if(bi === i) return;
    baru[`bat|${bi > i ? bi - 1 : bi}|${m[2]}`] = v;
  });
  mlData = baru;
  renderMlTable();
}
function mlSetBat(i, medan, v){
  if(!mlBat[i]) return;
  if(medan === 'n'){
    // Batasi 1..300: di bawah satu tabelnya kosong, di atas itu bukan lagi
    // lembar baterai UPS — kemungkinan besar salah ketik.
    const n = Math.max(1, Math.min(300, parseInt(v, 10) || 0));
    mlBat[i].n = n;
    renderMlTable();
    return;
  }
  mlBat[i][medan] = v;
}

/* ---------- Penggambar ---------- */

/** Besar huruf tabel di kertas — satu tetapan supaya ketujuh lembar seukuran. */
const ML_FS_CETAK = 'font-size:6.6pt;';

/** Kepala tabel. Untuk seksi ber-kolom dinamis kepalanya dirakit di sini
    (label + kotak nama yang bisa diketik), bukan dari `sec.head`. */
function mlHeadHtml(sec, kolom, mode){
  const cetak = mode === 'cetak';
  const fs = cetak ? ML_FS_CETAK : '';
  const sel = (t, cs, rs) => {
    const c = cs ? ` colspan="${cs}"` : '';
    const r = rs ? ` rowspan="${rs}"` : '';
    return cetak
      ? `<td${c}${r} style="${fs}text-align:center;font-weight:bold;">${escapeHtml(t)}</td>`
      : `<th${c}${r}>${escapeHtml(t)}</th>`;
  };
  const bungkus = isi => cetak ? `<tr class="p-kepala">${isi}</tr>` : `<tr>${isi}</tr>`;

  if(sec.dyn){
    const n = Math.max(1, (kolom || []).length);
    let b1 = sel('NO', 0, 2) + sel('DATA PENGUKURAN', 0, 2) + sel(sec.dyn.label, n);
    if(sec.sat) b1 += sel('SATUAN', 0, 2);
    if(sec.ket) b1 += sel('KETERANGAN', 0, 2);
    const b2 = (kolom || []).map((k, i)=>{
      if(mode !== 'isi'){
        const nama = escapeHtml(k.n || '—');
        const sub  = k.s ? `<div style="font-weight:400;${cetak ? 'font-size:5.8pt;' : 'font-size:9px;'}">${escapeHtml(k.s)}</div>` : '';
        return cetak
          ? `<td style="${fs}text-align:center;font-weight:bold;">${nama}${sub}</td>`
          : `<th>${nama}${sub}</th>`;
      }
      return `<th style="min-width:96px;">
        <input type="text" class="ml-isi ml-kol" value="${escapeHtml(k.n)}" placeholder="${escapeHtml(sec.dyn.ph || '')}"
               oninput="mlSetKolom(${i}, 'n', this.value)">
        <input type="text" class="ml-isi ml-kol ml-kol-sub" value="${escapeHtml(k.s)}" placeholder="${escapeHtml(sec.dyn.phSub || '')}"
               oninput="mlSetKolom(${i}, 's', this.value)">
        ${(kolom.length > 1) ? `<button class="icon-btn ml-kol-x" title="Hapus kolom" onclick="mlHapusKolom(${i})">✕</button>` : ''}
      </th>`;
    }).join('');
    return '<thead>' + bungkus(b1) + bungkus(b2) + '</thead>';
  }

  return '<thead>' + (sec.head || []).map(baris=>
    bungkus(baris.map(s=>{
      const t  = Array.isArray(s) ? s[0] : s;
      const cs = Array.isArray(s) && s[1] ? s[1] : 0;
      const rs = Array.isArray(s) && s[2] ? s[2] : 0;
      return sel(t, cs, rs);
    }).join(''))
  ).join('') + '</thead>';
}

/** Jumlah kolom total satu seksi — untuk colspan baris sub-judul. */
function mlTotalKolom(sec, kolom){
  return (sec.no === false ? 0 : 1) + 1 + mlKolomSeksi(sec, kolom).length +
         (sec.sat ? 1 : 0) + (sec.ket ? 1 : 0);
}

/** Lebar kolom untuk cetak — kolom angka dibagi rata supaya lebar sel tidak
    ditentukan panjang tulisan kepalanya. Sama alasan dengan 12g. */
function mlColgroupCetak(sec, kolom){
  const nData = mlKolomSeksi(sec, kolom).length;
  if(nData < 3) return '';
  const wNo = sec.no === false ? 0 : 3;
  const wSat = sec.sat ? 6 : 0;
  const wKet = sec.ket ? 11 : 0;
  const wLabel = nData > 14 ? 14 : 20;
  const wData = Math.max(1, 100 - wNo - wLabel - wSat - wKet) / nData;
  const col = w => `<col style="width:${w}%">`;
  return '<colgroup>' + (wNo ? col(wNo) : '') + col(wLabel) +
    Array.from({ length:nData }, ()=>col(wData.toFixed(2))).join('') +
    (wSat ? col(wSat) : '') + (wKet ? col(wKet) : '') + '</colgroup>';
}

/** Satu sel. `mode`: 'isi' | 'baca' | 'cetak'. */
function mlSelHtml(sec, si, ri, kol, data, mode, aktif){
  const cetak = mode === 'cetak';
  const fs = cetak ? ML_FS_CETAK : '';
  if(!aktif){
    return `<td style="text-align:center;${fs}color:${cetak ? '#999' : 'var(--muted)'};">–</td>`;
  }
  const k = mlKunci(si, ri, kol);
  const v = mlVal(data, k);
  const desc = (sec.cols || []).find(x=>mlKolKunci(x) === kol);

  if(desc && desc.t === 'pilih'){
    const i = Math.max(0, desc.opsi.indexOf(v));
    const teks = desc.opsi[i];
    const kls  = (desc.kelas && desc.kelas[i]) || 'ok';
    if(mode === 'isi'){
      return `<td><button class="status-btn ${kls} ml-pilih" onclick="mlPutar('${k}','${escapeHtml(kol)}',${si})">${escapeHtml(teks)}</button></td>`;
    }
    if(cetak) return `<td style="text-align:center;${fs}">${escapeHtml(teks)}</td>`;
    return `<td><span class="status-btn ${kls} ml-pilih" style="cursor:default;">${escapeHtml(teks)}</span></td>`;
  }

  const teks = escapeHtml(v);
  if(mode === 'isi'){
    return `<td class="${kol === 'ket' ? 'ml-ket' : ''}"><input type="text" class="ml-isi"
              value="${teks}" oninput="mlSet('${k}', this.value)"></td>`;
  }
  const kosong = cetak ? '' : '<span style="opacity:.45;">–</span>';
  return `<td style="text-align:${kol === 'ket' ? 'left' : 'center'};${fs}">${teks || kosong}</td>`;
}

/** Putar sel pilihan ke pilihan berikutnya. */
function mlPutar(k, kol, si){
  const sec = mlSeksi(mlForm)[si];
  const desc = sec && (sec.cols || []).find(x=>mlKolKunci(x) === kol);
  if(!desc || !desc.opsi) return;
  const i = Math.max(0, desc.opsi.indexOf(mlData[k]));
  mlData[k] = desc.opsi[(i + 1) % desc.opsi.length];
  renderMlTable();
}

/** Baris identitas (AHU / Merk / Type) — selebar tabel. */
function mlIdentHtml(sec, si, ri, row, data, mode, total){
  const cetak = mode === 'cetak';
  const fs = cetak ? ML_FS_CETAK : '';
  const isi = row.medan.map(m=>{
    const k = mlKunci(si, ri, 'ident:' + m.k);
    const v = mlVal(data, k);
    if(mode === 'isi'){
      return `<span class="ml-ident-medan"><b>${escapeHtml(m.label)}</b>
        <input type="text" class="ml-isi" value="${escapeHtml(v)}" placeholder="${escapeHtml(m.ph || '')}"
               oninput="mlSet('${k}', this.value)"></span>`;
    }
    return `<span class="ml-ident-medan"><b>${escapeHtml(m.label)}</b> ${escapeHtml(v) || '–'}</span>`;
  }).join('');
  const kelas = cetak ? '' : ' class="ml-grp"';
  const gaya = cetak ? `${fs}text-align:left;background:#e8e8e8;` : 'text-align:left;';
  return `<tr${kelas}><td colspan="${total}" style="${gaya}"><span class="ml-ident">${isi}</span></td></tr>`;
}

/** Satu seksi = satu tabel. */
function mlSeksiHtml(sec, si, data, kolom, bat, mode){
  if(sec.tipe === 'baterai') return mlBateraiHtml(sec, data, bat, mode);
  const cetak = mode === 'cetak';
  const fs = cetak ? ML_FS_CETAK : '';
  const total = mlTotalKolom(sec, kolom);
  const kols = mlKolomSeksi(sec, kolom);

  const body = (sec.rows || []).map((row, ri)=>{
    if(row.group){
      return cetak
        ? `<tr><td colspan="${total}" style="${fs}text-align:left;font-weight:bold;background:#e8e8e8;">${escapeHtml(row.group)}</td></tr>`
        : `<tr class="ml-grp"><td colspan="${total}" style="text-align:left;font-weight:bold;">${escapeHtml(row.group)}</td></tr>`;
    }
    if(row.ident) return mlIdentHtml(sec, si, ri, row, data, mode, total);
    const aktif = mlKolomAktif(sec, row, kolom);
    let tds = '';
    if(sec.no !== false) tds += `<td style="text-align:center;${fs}color:${cetak ? '#555' : 'var(--muted)'};">${escapeHtml(row.no)}</td>`;
    tds += `<td class="ml-par" style="${fs}">${escapeHtml(row.label)}</td>`;
    tds += kols.map(c=>{
      const k = mlKolKunci(c);
      return mlSelHtml(sec, si, ri, k, data, mode, aktif.includes(k));
    }).join('');
    if(sec.sat) tds += `<td style="text-align:center;${fs}color:${cetak ? '#555' : 'var(--muted)'};">${escapeHtml(row.sat)}</td>`;
    if(sec.ket) tds += mlSelHtml(sec, si, ri, 'ket', data, mode, aktif.includes('ket'));
    return `<tr>${tds}</tr>`;
  }).join('');

  const tombol = (sec.dyn && mode === 'isi')
    ? `<button class="btn ghost ml-tambah" onclick="mlTambahKolom()">${T('mlTambahKolom')} ${escapeHtml(sec.dyn.label)}</button>`
    : '';

  if(cetak){
    const cg = mlColgroupCetak(sec, kolom);
    return `<div style="margin:0 0 6px;">
      <div style="font-weight:bold;font-size:7pt;margin:4px 0 2px;border-bottom:1px solid #000;">${escapeHtml(sec.judul)}</div>
      <table class="ml-print" style="width:100%;border-collapse:collapse;${ML_FS_CETAK}${cg ? 'table-layout:fixed;' : ''}">${cg}${mlHeadHtml(sec, kolom, mode)}<tbody>${body}</tbody></table>
    </div>`;
  }
  const gaya = 'width:100%;border-collapse:collapse;min-width:' + Math.max(560, total * 72) + 'px;';
  const tabel = `<table class="ml-tbl" style="${gaya}">${mlHeadHtml(sec, kolom, mode)}<tbody>${body}</tbody></table>`;
  return `<div class="ml-seksi">
    <div class="ml-seksi-kepala"><div class="ml-seksi-judul">${escapeHtml(sec.judul)}</div>${tombol}</div>
    <div class="ml-gulir">${tabel}</div></div>`;
}

/* ---------- Tabel tambahan: tegangan sel baterai UPS ---------- */

/** Satu blok baterai: kepala (UPS/merk/tipe/jumlah sel) + sel bernomor yang
    dibagi TIGA kolom seperti lembar aslinya (1–50 | 51–100 | 101–150). */
function mlBatBlokHtml(blok, bi, data, mode){
  const cetak = mode === 'cetak';
  const fs = cetak ? ML_FS_CETAK : '';
  const n = Math.max(1, blok.n || 1);
  const perKolom = Math.ceil(n / 3);

  const sel = idx => {
    const k = `bat|${bi}|${idx}`;
    const v = mlVal(data, k);
    if(mode === 'isi'){
      return `<td class="ml-bat-no">${idx}</td><td><input type="text" class="ml-isi"
                value="${escapeHtml(v)}" oninput="mlSet('${k}', this.value)"></td>`;
    }
    return `<td class="ml-bat-no" style="${fs}">${idx}</td><td style="text-align:center;${fs}">${escapeHtml(v) || (cetak ? '' : '<span style="opacity:.45;">–</span>')}</td>`;
  };
  const kosong = `<td style="${fs}"></td><td style="${fs}"></td>`;

  let body = '';
  for(let r = 0; r < perKolom; r++){
    let tr = '';
    for(let c = 0; c < 3; c++){
      const idx = c * perKolom + r + 1;
      tr += idx <= n ? sel(idx) : kosong;
    }
    body += `<tr>${tr}</tr>`;
  }

  const kepalaSel = `<td>${escapeHtml(T('mlNo'))}</td><td>${escapeHtml(T('mlTeganganV'))}</td>`;
  const thead = cetak
    ? `<thead><tr class="p-kepala">${kepalaSel.repeat(3)}</tr></thead>`
    : `<thead><tr>${`<th>${escapeHtml(T('mlNo'))}</th><th>${escapeHtml(T('mlTeganganV'))}</th>`.repeat(3)}</tr></thead>`;

  const ident = mode === 'isi'
    ? `<div class="ml-bat-kepala">
         <span class="ml-ident-medan"><b>${escapeHtml(T('mlUps'))}</b>
           <input type="text" class="ml-isi" value="${escapeHtml(blok.ups)}" placeholder="mis. UPS 1"
                  oninput="mlSetBat(${bi}, 'ups', this.value)"></span>
         <span class="ml-ident-medan"><b>${escapeHtml(T('mlMerkBaterai'))}</b>
           <input type="text" class="ml-isi" value="${escapeHtml(blok.merk)}"
                  oninput="mlSetBat(${bi}, 'merk', this.value)"></span>
         <span class="ml-ident-medan"><b>${escapeHtml(T('mlTipe'))}</b>
           <input type="text" class="ml-isi" value="${escapeHtml(blok.tipe)}"
                  oninput="mlSetBat(${bi}, 'tipe', this.value)"></span>
         <span class="ml-ident-medan"><b>${escapeHtml(T('mlJumlahSel'))}</b>
           <input type="number" min="1" max="300" class="ml-isi" style="max-width:74px;" value="${blok.n}"
                  onchange="mlSetBat(${bi}, 'n', this.value)"></span>
         <button class="icon-btn" title="Hapus blok baterai" onclick="mlHapusBat(${bi})">✕</button>
       </div>`
    : `<div class="ml-bat-kepala" style="${fs}"><b>${escapeHtml(T('mlUps'))}</b> ${escapeHtml(blok.ups) || '–'}
         &nbsp;·&nbsp; <b>${escapeHtml(T('mlMerkBaterai'))}</b> ${escapeHtml(blok.merk) || '–'}
         &nbsp;·&nbsp; <b>${escapeHtml(T('mlTipe'))}</b> ${escapeHtml(blok.tipe) || '–'}
         &nbsp;·&nbsp; <b>${n}</b> ${escapeHtml(T('mlSel'))}</div>`;

  const kelas = cetak ? 'ml-print' : 'ml-tbl';
  const gaya = cetak ? `width:100%;border-collapse:collapse;${ML_FS_CETAK}`
                     : 'width:100%;border-collapse:collapse;';
  const tabel = `<table class="${kelas}" style="${gaya}">${thead}<tbody>${body}</tbody></table>`;
  return `<div class="ml-bat-blok">${ident}${cetak ? tabel : `<div class="ml-gulir">${tabel}</div>`}</div>`;
}

function mlBateraiHtml(sec, data, bat, mode){
  const cetak = mode === 'cetak';
  const daftar = bat || [];
  const tombol = mode === 'isi'
    ? `<button class="btn ghost ml-tambah" onclick="mlTambahBat()">${T('mlTambahBat')}</button>` : '';
  if(!daftar.length){
    if(mode !== 'isi') return '';   // tak ada blok → tak usah dicetak sama sekali
    return `<div class="ml-seksi">
      <div class="ml-seksi-kepala"><div class="ml-seksi-judul">${escapeHtml(sec.judul)}</div>${tombol}</div>
      <div class="subtle-note">${escapeHtml(T('mlBatKosong'))}</div>
    </div>`;
  }
  const blok = daftar.map((b, bi)=>mlBatBlokHtml(b, bi, data, mode)).join('');
  if(cetak){
    return `<div style="margin:6px 0 0;">
      <div style="font-weight:bold;font-size:7pt;margin:4px 0 2px;border-bottom:1px solid #000;">${escapeHtml(sec.judul)}</div>
      ${blok}</div>`;
  }
  return `<div class="ml-seksi">
    <div class="ml-seksi-kepala"><div class="ml-seksi-judul">${escapeHtml(sec.judul)}</div>${tombol}</div>
    ${blok}</div>`;
}

/* ---------- Lembar utuh ---------- */

function mlLembar(form, data, kolom, bat, mode){
  return mlSeksi(form).map((sec, si)=>mlSeksiHtml(sec, si, data, kolom, bat, mode)).join('');
}

function renderMlTable(){
  const wrap = document.getElementById('mlWrap');
  if(!wrap) return;
  wrap.innerHTML = mlLembar(mlForm, mlData, mlKolom, mlBat, 'isi');
}

/* ---------- Isian kepala (lokasi / waktu / peralatan) ---------- */

function mlSetMeta(k, v){ mlMeta[k] = String(v == null ? '' : v); }

/** Isian kepala. Medan ber-`tipe:'jam'` memakai pemilih jam bawaan peramban
    (HH:MM) — sama dengan Logbook, Isu, dan Meter Reading; isinya diisikan jam
    sekarang waktu modal dibuka, jadi tak perlu diketik, tapi tetap bisa
    digeser kalau lembarnya diisi untuk jam pemeriksaan yang lain. */
function renderMlMeta(){
  const wrap = document.getElementById('mlMetaWrap');
  if(!wrap) return;
  const medan = (ML_FORMS[mlForm] || {}).meta || [];
  wrap.innerHTML = medan.map(m=>{
    const nilai = escapeHtml(mlMeta[m.k] || '');
    const isian = m.tipe === 'jam'
      ? `<input type="time" value="${nilai}" onchange="mlSetMeta('${m.k}', this.value)">`
      : `<input type="text" value="${nilai}" placeholder="${escapeHtml(m.ph || '')}"
                oninput="mlSetMeta('${m.k}', this.value)">`;
    return `<div class="field"><label>${escapeHtml(m.label)}</label>${isian}</div>`;
  }).join('');
}

/** Ringkasan kepala untuk detail & cetak. */
function mlMetaTeks(form, meta){
  const medan = (ML_FORMS[form] || {}).meta || [];
  return medan.map(m=>`${m.label} : ${(meta || {})[m.k] || '________'}`);
}

/* ---------- Teknisi ---------- */

function renderMlTeknisi(){
  const wrap = document.getElementById('mlTeknisiList');
  if(!wrap) return;
  wrap.innerHTML = mlTeknisiRows.map((t, i)=>`
    <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;">
      <span style="font-family:var(--font-mono);color:var(--accent);font-size:12px;min-width:18px;">${i + 1}.</span>
      <input type="text" value="${escapeHtml(t.nama)}" placeholder="${T('namaTeknisiPelaksana')} ${i + 1}"
             list="teknisiDatalist"
             oninput="mlTeknisiRows[${i}].nama=this.value"
             style="flex:1;background:var(--panel-2);border:1px solid var(--line);color:var(--text);border-radius:6px;padding:9px 10px;font-size:16px;">
      ${mlTeknisiRows.length > 1 ? `<button class="icon-btn" onclick="hapusMlTeknisi('${t.key}')">✕</button>` : ''}
    </div>`).join('');
}
function addMlTeknisi(){
  const isiAwal = mlTeknisiRows.length === 0 && userSaatIni ? (userSaatIni.nama || userSaatIni.username || '') : '';
  mlTeknisiRows.push({ key:'l' + (mlTeknisiSeq++), nama: isiAwal });
  renderMlTeknisi();
}
function hapusMlTeknisi(key){ mlTeknisiRows = mlTeknisiRows.filter(x=>x.key !== key); renderMlTeknisi(); }

/* ---------- Modal (buka / tutup / simpan / sunting) ----------
   Satu modal dipakai untuk mengisi baru DAN menyunting. Yang membedakan cuma
   mlEditingId: kalau terisi, simpan memanggil updateDsTest dan bilah
   "sedang menyunting" muncul di atas form. Pola & aturannya kembar dengan
   sunting daily check (14-daily-check-umum.js):
     · catatan yang sudah ditandatangani Manager Teknik terkunci — tombol
       suntingnya pun tidak digambar, dan server menolaknya;
     · selain administrator, hanya pembuat catatan yang boleh menyunting.
   Lembar (mlForm) TIDAK ikut bisa diganti saat menyunting: jenis lembar itu
   identitas catatannya. Salah lembar berarti catatan baru, bukan suntingan. */

/** Id catatan yang sedang disunting; null = sedang mengisi lembar baru. */
let mlEditingId = null;

/** Segarkan judul tombol simpan & bilah penanda sesuai mode yang sedang jalan. */
function mlTerapkanModeSunting(){
  const btn = document.getElementById('mlSaveBtn');
  if(btn) btn.textContent = mlEditingId ? T('simpanPerubahan') : T('simpanMl');
  const bar = document.getElementById('mlEditingBanner');
  if(bar) bar.style.display = mlEditingId ? '' : 'none';
}

function openMlModal(form){
  if(!ML_FORMS[form]) form = ML_URUT[0];
  mlEditingId = null;
  mlForm = form;
  mlInit(form);
  const def = ML_FORMS[form];
  document.getElementById('mlModalJudul').textContent = def.judul;
  document.getElementById('mlModalSub').textContent = T('mlSub_' + form) || def.sub || '';
  document.getElementById('mlTanggal').value = tanggalHariIni();
  document.getElementById('mlManagerNama').value = '';
  document.getElementById('mlManagerAkun').value = '';
  // Jam terisi otomatis (pemilih HH:MM) supaya tak perlu diketik — sama dengan
  // Logbook, Isu, dan Meter Reading.
  (def.meta || []).forEach(m=>{
    if(m.tipe === 'jam') mlMeta[m.k] = (typeof jamSekarang === 'function') ? jamSekarang() : '';
  });
  mlTeknisiRows = []; mlTeknisiSeq = 0; addMlTeknisi();
  if(!sigPads['sigMl']) setupSigCanvas('sigMl');
  resizeSigCanvas('sigMl'); clearSig('sigMl');
  // Kanvas TTD SENGAJA dibiarkan kosong — teknisi tanda tangan sendiri, atau
  // klik "✍ pakai TTD tersimpan". Jangan auto-tempel.
  if(typeof pasangTombolTtdTersimpan === 'function') pasangTombolTtdTersimpan();
  renderMlMeta();
  renderMlTable();
  mlTerapkanModeSunting();
  document.getElementById('mlModalBg').classList.add('show');
  setTimeout(()=>resizeSigCanvas('sigMl'), 60);
}

/** Buka catatan tersimpan untuk disunting. Seluruh isinya dikembalikan ke
    form: lembar, isian kepala, kolom buatan pemakai, blok baterai, seluruh
    sel, daftar nama teknisi, dan nama manager. TTD teknisi yang lama tidak
    ditempel ke kanvas — kanvas kosong berarti "TTD tidak diubah"; menandatangani
    ulang barulah menggantinya. */
function openMlEdit(id){
  const d = dsList.find(x=>x.id === id);
  if(!d || !d.state){ toast(T('takAdaHasil')); return; }
  if(d.managerTtd){ toast(T('mlTerkunci')); return; }

  const form = mlFormTersimpan(d.state);
  const def = ML_FORMS[form];
  mlForm = form;
  mlInit(form);                       // siapkan kerangka kosong lembar itu dulu
  mlEditingId = id;

  // Isi tersimpan ditimpakan di atas kerangka — kunci yang belum pernah ada
  // (mis. lembar yang skemanya sudah bertambah) tetap kosong, bukan hilang.
  mlMeta  = Object.assign({}, mlMeta, d.state.meta || {});
  mlData  = Object.assign({}, mlData, d.state.data || {});
  const kolom = Array.isArray(d.state.kolom) ? d.state.kolom : [];
  if(kolom.length) mlKolom = kolom.map(k=>({ n:(k && k.n) || '', s:(k && k.s) || '' }));
  mlBat = (Array.isArray(d.state.bat) ? d.state.bat : []).map(b=>({
    ups:(b && b.ups) || '', merk:(b && b.merk) || '', tipe:(b && b.tipe) || '', n:(b && b.n) || 1
  }));

  document.getElementById('mlModalJudul').textContent = def.judul;
  document.getElementById('mlModalSub').textContent = T('mlSub_' + form) || def.sub || '';
  document.getElementById('mlTanggal').value = String(d.tanggal || '').slice(0, 10);
  document.getElementById('mlManagerNama').value = d.managerNama || '';
  const akun = document.getElementById('mlManagerAkun');
  if(akun) akun.value = d.ttdUntuk || '';

  mlTeknisiRows = []; mlTeknisiSeq = 0;
  const daftar = (d.teknisiNamaList && d.teknisiNamaList.length)
    ? d.teknisiNamaList
    : String(d.teknisiNama || '').split(',').map(s=>s.trim()).filter(Boolean);
  if(daftar.length) daftar.forEach(nama=>mlTeknisiRows.push({ key:'l' + (mlTeknisiSeq++), nama }));
  else addMlTeknisi();
  renderMlTeknisi();

  if(!sigPads['sigMl']) setupSigCanvas('sigMl');
  resizeSigCanvas('sigMl'); clearSig('sigMl');
  if(typeof pasangTombolTtdTersimpan === 'function') pasangTombolTtdTersimpan();
  renderMlMeta();
  renderMlTable();
  mlTerapkanModeSunting();
  document.getElementById('mlModalBg').classList.add('show');
  setTimeout(()=>resizeSigCanvas('sigMl'), 60);
}

/** Keluar dari mode sunting tanpa menyentuh catatannya. */
function batalEditMl(){
  const form = mlForm;
  closeMlModal();
  mlEditingId = null;
  mlTerapkanModeSunting();
  renderMlList(form);
}

function closeMlModal(){ document.getElementById('mlModalBg').classList.remove('show'); }

async function saveMl(){
  const btn = document.getElementById('mlSaveBtn'); btn.disabled = true;
  const menyunting = !!mlEditingId;
  try{
    const state = {
      __format:'maintlistrik', __mlForm: mlForm,
      meta: mlMeta, kolom: mlKolom, bat: mlBat, data: mlData
    };
    const payload = {
      unit: unitAktif,
      kategori: 'maintlistrik',
      tanggal: document.getElementById('mlTanggal').value,
      state,
      teknisiNamaList: mlTeknisiRows.map(t=>(t.nama || '').trim()).filter(Boolean),
      teknisiTtd: getSigDataUrl('sigMl'),
      managerNama: document.getElementById('mlManagerNama').value.trim(),
      ttdUntuk: ttdUntukTerpilih('mlManagerAkun', document.getElementById('mlManagerNama').value)
    };
    if(menyunting){
      const saved = await gsRun('updateDsTest', mlEditingId, payload);
      const i = dsList.findIndex(x=>x.id === mlEditingId);
      if(i !== -1) dsList[i] = mapDs(saved);
      const form = mlForm;
      closeMlModal();
      mlEditingId = null;
      mlTerapkanModeSunting();
      renderMlList(form);
      toast(T('tersimpanPerubahan'));
    }else{
      const saved = await gsRun('addDsTest', payload);
      dsList.unshift(mapDs(saved));
      renderMlList(mlForm);
      closeMlModal();
      toast(T('mlTersimpan'));
    }
  }catch(e){ toast(T('gagalSimpan') + ' — ' + (e.message || T('coba'))); }
  btn.disabled = false;
}

/* ---------- Daftar riwayat (satu daftar per lembar) ---------- */

const mlAdalah = (d, form) => !!(d && d.state && d.state.__format === 'maintlistrik' &&
                                 (!form || d.state.__mlForm === form));

let mlTampilSemua = {};
function resetCariMl(form){
  mlTampilSemua[form] = true;
  const el = document.getElementById('cariMlTanggal-' + form); if(el) el.value = '';
  renderMlList(form);
}

/** Ringkasan isi satu catatan untuk kartu riwayat: berapa sel yang sudah diisi.
    Lembar ini isinya angka ukur — tidak ada "lolos / tidak lolos" untuk
    dihitung — jadi yang berguna disebut adalah kelengkapannya. Kecuali lembar
    Grounding yang memang punya jawaban BAIK / TIDAK BAIK. */
function mlRingkas(form, state){
  const data = (state && state.data) || {};
  let terisi = 0, buruk = 0;
  Object.entries(data).forEach(([k, v])=>{
    const s = String(v == null ? '' : v).trim();
    if(!s) return;
    if(s === 'TIDAK ADA' || s === 'TIDAK BAIK'){ buruk++; return; }
    if(k.includes('|ident:')) return;   // nama alat, bukan hasil ukur
    if(s === 'ADA' || s === 'BAIK' || s === 'ON') return;   // pilihan bawaan
    terisi++;
  });
  return { terisi, buruk };
}

function renderMlList(form){
  const wrap = document.getElementById('mlList-' + form);
  if(!wrap) return;
  const semua = (typeof dsList !== 'undefined' ? dsList : []).filter(d=>mlAdalah(d, form));
  const tgl = (document.getElementById('cariMlTanggal-' + form) || {}).value || '';
  const daftar = tgl ? semua.filter(d=>String(d.tanggal || '').slice(0, 10) === tgl)
                     : (mlTampilSemua[form] ? semua : semua.filter(d=>dalamSeminggu(d.tanggal)));

  if(semua.length === 0){ wrap.innerHTML = '<div class="empty">' + T('mlBelumAda') + '</div>'; return; }
  if(daftar.length === 0){ wrap.innerHTML = '<div class="empty">' + T('takAdaHasil') + '</div>'; return; }

  wrap.innerHTML = daftar.map(d=>{
    const r = mlRingkas(form, d.state);
    const tag = r.buruk
      ? `<span class="tag fail">${r.buruk} ${escapeHtml(T('mlTidakBaik'))}</span>`
      : `<span class="tag ok">${r.terisi} ${escapeHtml(T('mlNilaiTercatat'))}</span>`;
    const meta = mlMetaTeks(form, (d.state || {}).meta)
      .filter(s=>!s.endsWith('________')).join(' · ');
    return `<div class="dc-history-item">
      <div><b>${escapeHtml(d.tanggal)}</b>${meta ? ' &middot; ' + escapeHtml(meta) : ''}</div>
      ${tag}
      <div style="font-size:11.5px;color:var(--muted);">${T('teknisiPelaksana')}: ${escapeHtml(d.teknisiNama) || '-'}</div>
      ${diinputOlehHtml(d.diinputOleh, d.dibuatPada, String(d.tanggal || '').slice(0, 10))}
      <div style="display:flex;gap:4px;">
        <button class="btn ghost" style="padding:6px 10px;" onclick="openMlDetail('${d.id}')">${T('detail')}</button>
        ${(!d.managerTtd && bolehSuntingCatatan(d.dibuatOlehUsername))
          ? `<button class="icon-btn" title="${T('mlSunting')}" onclick="openMlEdit('${d.id}')">✎</button>` : ''}
        <button class="icon-btn" title="${T('cetak')}" onclick="printMl('${d.id}')">🖨</button>
        <button class="icon-btn hanya-admin" title="${T('hapus')}" onclick="hapusMl('${d.id}')">✕</button>
      </div>
    </div>`;
  }).join('');
}

/** Segarkan ketujuh daftar sekaligus (dipanggil init / terapkanUnit). */
function renderSemuaMlList(){ ML_URUT.forEach(renderMlList); }

async function hapusMl(id){
  if(!adminAktif()){ toast(T('hanyaAdminHapus')); return; }
  const d = dsList.find(x=>x.id === id);
  if(!confirm(`${T('konfirmasiHapus')} ${d ? d.tanggal : ''}?`)) return;
  const form = (d && d.state && d.state.__mlForm) || ML_URUT[0];
  const salinan = dsList.slice();
  dsList = dsList.filter(x=>x.id !== id);
  renderMlList(form);
  try{ await gsRun('deleteDsTest', id); }
  catch(e){ dsList = salinan; renderMlList(form); toast(T('gagalHapus') + ' — ' + (e.message || T('coba'))); }
}

/* ---------- Detail & cetak ---------- */

/** Lembar mana yang tersimpan di sebuah state. */
function mlFormTersimpan(state){
  const f = state && state.__mlForm;
  return ML_FORMS[f] ? f : ML_URUT[0];
}

/** Gambar lembar tersimpan dalam keadaan baca-saja. Lembar dibaca dari state
    itu sendiri — bukan dari mlForm yang kebetulan sedang dibuka. */
function mlLembarTersimpan(state, mode){
  const form = mlFormTersimpan(state);
  return mlLembar(form, (state && state.data) || {}, (state && state.kolom) || [],
                  (state && state.bat) || [], mode);
}

function openMlDetail(id){
  const d = dsList.find(x=>x.id === id);
  if(!d || !d.state) return;
  const form = mlFormTersimpan(d.state);
  const def = ML_FORMS[form];
  document.getElementById('formDetailJudul').textContent = def.judul;
  const meta = mlMetaTeks(form, d.state.meta).join(' &middot; ');
  document.getElementById('formDetailBody').innerHTML = `
    <div style="font-size:13px;line-height:1.7;margin-bottom:10px;"><b>${escapeHtml(d.tanggal)}</b><br>${meta}</div>
    ${mlLembarTersimpan(d.state, 'baca')}
    <div class="detail-ttd">
      <div class="sig-block"><b>${T('teknisiPelaksana')}</b>${escapeHtml(d.teknisiNama) || '-'}${sigThumbHtml(d.teknisiTtd)}</div>
      <div class="sig-block"><b>${T('mengetahuiManager')}</b>${renderPihakKedua('dstest', d.id, d.managerNama, d.managerTtd)}${sigPejabatHtml('dstest', d.id, d.managerTtd, d)}</div>
    </div>
    <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line);">${diinputOlehHtml(d.diinputOleh, d.dibuatPada, String(d.tanggal || '').slice(0, 10))}</div>`;
  document.getElementById('formDetailPrintBtn').onclick = ()=>{ closeFormDetail(); printMl(id); };
  document.getElementById('formDetailBg').classList.add('show');
}

function printMl(id){
  const d = dsList.find(x=>x.id === id);
  if(!d || !d.state) return;
  if(!tolakCetakBilaBelumTtd(d, 'dstest')) return;
  const form = mlFormTersimpan(d.state);
  const def = ML_FORMS[form];
  const meta = mlMetaTeks(form, d.state.meta);
  const kolomMeta = [`HARI/TANGGAL : ${escapeHtml(d.tanggal)}`].concat(meta.map(escapeHtml));
  doPrint(`
    <style>
      /* Kelas tabel LAYAR (.ml-tbl) sengaja tidak dibawa ke #printArea — kepala
         tabelnya dilukis --panel-2 yang gelap, dan kertas berlatar putih. */
      #printArea .ml-print td{padding:0 3px;line-height:1.15;}
      #printArea .ml-bat-kepala{margin:3px 0 1px;}
      #printArea .ml-ident-medan{margin-right:14px;}
    </style>
    <div style="text-align:center;font-weight:bold;font-size:11.5pt;margin-bottom:2px;">${escapeHtml(def.judul)}</div>
    <div style="text-align:center;font-weight:bold;font-size:10pt;margin-bottom:8px;">BANDARA INTERNASIONAL SOEKARNO — HATTA</div>
    <table class="no-border" style="font-size:9pt;margin-bottom:8px;">
      <tr>${kolomMeta.map(t=>`<td>${t}</td>`).join('')}</tr>
    </table>

    ${mlLembarTersimpan(d.state, 'cetak')}

    <table class="no-border" style="font-size:9pt;margin-top:14px;">
      <tr>
        <td style="width:55%;text-align:left;vertical-align:top;">
          <div style="margin-bottom:6px;">PELAKSANA TEKNISI :</div>
          ${teknisiPrintBlock(d)}
        </td>
        <td style="text-align:center;vertical-align:top;">
          <div>Mengetahui,</div>
          <div style="margin-bottom:4px;">Manager Teknik</div>
          <div style="height:46px;">${ttdImg(d.managerTtd, 40)}</div>
          <div style="border-top:1px solid #000;display:inline-block;padding:0 24px;">${d.managerTtd ? (escapeHtml(d.managerNama) || '&nbsp;') : '&nbsp;'}</div>
        </td>
      </tr>
    </table>`, def.orientasi || 'portrait');
}

/** Unit Listrik & Mekanik sedang aktif? Dipakai 07-unit.js. */
function mlUnitAktif(){ return unitAktif === 'listrikmekanik'; }
