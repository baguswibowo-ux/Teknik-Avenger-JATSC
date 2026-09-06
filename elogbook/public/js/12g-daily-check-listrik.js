/* E-Logbook · js/12g-daily-check-listrik.js — Daily check Fasilitas Listrik & Mekanik
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh.

   Unit "Listrik dan Mekanik" punya EMPAT lembar harian — dialihaksarakan apa
   adanya dari "1. Pengecekan Harian Complete.xlsx" (satu sheet = satu lembar):
     · STS           — PENGECEKAN HARIAN STS TOWER JATSC (9 lokasi × 3 panel)
     · MDS           — PENGECEKAN HARIAN MDS NO BREAK TOWER JATSC
     · Beban Listrik — PENGECEKAN HARIAN BEBAN LISTRIK TOWER JATSC
     · UPS           — PENGECEKAN HARIAN UPS BEBAN UTAMA OPERASIONAL JATSC
   Keempatnya dipilih lewat sub-tab, pola yang sama dengan Pengamatan (12e) dan
   Gedung & Keamanan (12f). Sheet MASTER di berkasnya cuma penampung tanggal /
   nama pejabat yang dirujuk keempat lembar — di sini pekerjaan itu sudah
   dikerjakan kepala form (tanggal, dinas, teknisi, manager), jadi tak perlu
   lembar sendiri.

   BEDANYA DENGAN LEMBAR UNIT LAIN. Lembar listrik bukan checklist status —
   isinya angka ukur (tegangan, arus, suhu, frekuensi, kWh). Jadi tidak ada sel
   ✓/!/✕ yang berputar seperti Radtel/Pengamatan/FGK, kecuali satu kolom
   KONDISI di lembar STS & MDS yang memang di form aslinya berupa tiga kotak
   centang ON / STANDBY / OFF. Karena tak ada sel sehat/rusak, lembar ini tidak
   menyumbang temuan (fails/warns) — lihat lkTemuan() di bawah.

   BENTUK TABEL. Kepala baris-ganda (TEGANGAN → R-N/S-N/T-N dst.) ditulis
   tangan per seksi supaya colspan-nya benar; baris datanya digenerik dari
   daftar kolom — sama cara dengan Meter Reading (17f). Skema satu seksi:
     { judul, head, cols, rows, no?, sat?, ket? }
       head  : deret baris kepala; sel = 'Teks' | ['Teks', colspan, rowspan]
       cols  : kunci kolom data, urut kiri→kanan. Kunci 'kondisi' istimewa —
               selnya tombol berputar ON → STANDBY → OFF, bukan kotak angka.
       rows  : LKR(no,label,sat) untuk baris data, LKG('Judul') untuk baris
               sub-judul selebar tabel (padanan sel LOKASI yang di Excel-nya
               di-merge menurun).
       no    : false → tanpa kolom NO           (default: ada)
       sat   : true  → ada kolom SATUAN, isinya LKR(...,sat)  (default: tidak)
       ket   : true  → ada kolom KETERANGAN berisi kotak teks (default: tidak)
     Baris boleh mempersempit sel yang boleh diisi:
       only  : ['suhu']       → hanya kolom itu yang punya kotak isian
       tanpa : ['kondisi']    → semua kolom kecuali yang disebut
     Sel yang tidak aktif digambar strip redup — jelas "memang tidak diukur",
     bukan "lupa diisi".

   SEMUA KOTAK ISIAN DIWARNAI SENDIRI (--panel-2 / --line / --text). Kotak
   bawaan peramban berlatar putih dan di tema gelap terlihat seperti bercak —
   pelajaran dari lembar Gedung & Keamanan; jangan biarkan ada <input> atau
   <textarea> di berkas ini yang lolos tanpa warna. */

/* ---------- Pembentuk baris ---------- */

/** Baris data. `sat` hanya terpakai kalau seksinya ber-kolom SATUAN. */
const LKR = (no, label, sat, opsi) => Object.assign({ no: no || '', label, sat: sat || '' }, opsi || {});
/** Baris sub-judul selebar tabel — padanan sel LOKASI yang di-merge di Excel. */
const LKG = teks => ({ group: teks });

/* ---------- Lembar 1: STS ---------- */
/* Sembilan lokasi, masing-masing tiga panel yang sama. Baris "Output STS"
   tidak punya kotak KONDISI — di form aslinya kolom ON/STANDBY/OFF memang
   hanya diisi untuk kedua STS Line-nya. */
const LK_STS_LOKASI = [
  'ESS', 'AMSC', 'MER', 'PROCESSING ROOM', 'OPS. ROOM 1',
  'MDS', 'OPS. ROOM 2', 'BILLING SYSTEM', 'TER'
];

const lkBlokSts = lokasi => [
  LKG(lokasi),
  LKR('1', 'STS Line 1'),
  LKR('2', 'STS Line 2'),
  LKR('3', 'Output STS', '', { tanpa: ['kondisi'] })
];

function lkSeksiSts(){
  return [
    { judul: 'PENGECEKAN PANEL STS PER LOKASI',
      cols: ['rn', 'sn', 'tn', 'ir', 'is', 'it', 'suhu', 'frek', 'kondisi'],
      ket: true,
      head: [
        [['NO', 1, 2], ['JENIS PANEL', 1, 2], ['TEGANGAN (VOLT)', 3], ['ARUS (AMPERE)', 3],
         ['SUHU RUANGAN (°C)', 1, 2], ['FREKUENSI (Hz)', 1, 2], ['KONDISI', 1, 2], ['KETERANGAN', 1, 2]],
        ['R-N', 'S-N', 'T-N', 'R', 'S', 'T']
      ],
      rows: LK_STS_LOKASI.flatMap(lkBlokSts) },

    /* Catatan kaki lembar STS: tiga pembacaan kWh yang di Excel-nya ditulis
       lepas di bawah tabel (KHW → PRIORITY / TEKNIKAL / AOC). */
    { judul: 'CATATAN — PEMBACAAN kWh', no: false, sat: true,
      cols: ['nilai'],
      head: [['PENYULANG', 'PEMBACAAN', 'SATUAN']],
      rows: [
        LKR('', 'PRIORITY', 'kWh'),
        LKR('', 'TEKNIKAL', 'kWh'),
        LKR('', 'AOC', 'kWh')
      ] }
  ];
}

/* ---------- Lembar 2: MDS No Break ---------- */
/* Penomoran 1, 2, 4, 5, 6 mengikuti form aslinya — nomor 3 memang tidak ada
   di sana; jangan "dirapikan" jadi berurutan, kertasnya yang jadi tak cocok. */
function lkSeksiMds(){
  return [
    { judul: 'PENGECEKAN PANEL MDS NO BREAK',
      cols: ['rn', 'sn', 'tn', 'ir', 'is', 'it', 'in', 'tr', 'ts', 'tt', 'truang', 'kondisi'],
      ket: true,
      head: [
        [['NO', 1, 2], ['JENIS PANEL', 1, 2], ['TEGANGAN (VOLT)', 3], ['ARUS (AMPERE)', 4],
         ['SUHU (°C)', 4], ['KONDISI', 1, 2], ['KETERANGAN', 1, 2]],
        ['R-N', 'S-N', 'T-N', 'R', 'S', 'T', 'N', 'R', 'S', 'T', 'RUANG']
      ],
      rows: [
        LKG('1 · MDS 1'),
        LKR('1', 'Inc. MCCB 3P 250 A'),
        LKG('2 · MDS 2'),
        LKR('2', 'Inc. MCCB 3P 250 A'),
        LKG('4 · MCC 1'),
        LKR('', '- ASC 1  ·  T: 25 A, M: 250 A'),
        LKR('', '- ASC 2  ·  T: 25 A, M: 250 A'),
        LKR('', '- DER 1  ·  M: 60 A'),
        LKR('', '- DER 2  ·  M: 60 A'),
        LKR('', '- CR 1  ·  T: 32 A, M: 250 A'),
        LKR('', '- CR 2  ·  T: 32 A, M: 250 A'),
        LKR('', '- PR 1  ·  M: 76 A'),
        LKR('', '- PR 2  ·  M: 76 A'),
        LKG('5 · MCC 2'),
        LKR('', '- FDPT / ASC  ·  T: 12 A, M: 250 A'),
        LKR('', '- Tower 1  ·  T: 16 A, M: 250 A'),
        LKR('', '- Tower 2  ·  T: 16 A, M: 250 A'),
        LKR('', '- Spare  ·  T: 22 A, M: 250 A'),
        LKR('', '- EP 2000 7E  ·  T: 2 A, M: 250 A'),
        LKR('', '- Main FAT 50  ·  M: 100 A'),
        LKR('', '- Stand By FAT 50  ·  M: 100 A'),
        LKG('6 · Temperatur Ruang Battery'),
        LKR('', 'Ruang Battery', '', { only: ['truang'] })
      ] }
  ];
}

/* ---------- Lembar 3: Beban Listrik ---------- */
/* Nomor 4 tidak ada di form aslinya — sama seperti MDS, dibiarkan apa adanya.
   Baris temperatur trafo & gardu hanya punya kolom suhu; sisanya distrip. */
function lkSeksiBeban(){
  const suhuSaja = { only: ['suhu'] };
  return [
    { judul: 'GEDUNG 612 — PENGUKURAN BEBAN',
      cols: ['pf', 'teg', 'a1', 'ir', 'is', 'it', 'kwh', 'suhu'],
      ket: true,
      head: [
        [['NO', 1, 2], ['JENIS PANEL', 1, 2], ['COS ɸ (PF)', 1, 2], ['TEGANGAN (V)', 1, 2],
         ['ARUS 1 PHASE (A)', 1, 2], ['ARUS (A)', 3], ['kWh', 1, 2], ['SUHU (°C)', 1, 2],
         ['KETERANGAN', 1, 2]],
        ['R', 'S', 'T']
      ],
      rows: [
        LKG('1 · PANEL COMMON CUBICLE'),
        LKR('', 'P7 13'),
        LKR('', 'T7 05 A'),
        LKG('2 · PANEL CHILLER'),
        LKR('', 'CHILLER 1'),
        LKR('', 'CHILLER 2'),
        LKR('', 'CHILLER 3'),
        LKG('3 · PANEL MDS'),
        LKR('', 'MDS T7 LCA'),
        LKR('', 'MDS T7 LCB'),
        LKR('', 'MDS P7 LCA'),
        LKR('', 'MDS P7 LCB'),
        LKG('5 · Temperatur Trafo'),
        LKR('', 'Trafo T-7A', '', suhuSaja),
        LKR('', 'Trafo T-7B', '', suhuSaja),
        LKR('', 'Trafo P-7A', '', suhuSaja),
        LKR('', 'Trafo P-7B', '', suhuSaja),
        LKG('6 · Temperatur Gardu'),
        LKR('', 'Gardu T7', '', suhuSaja)
      ] }
  ];
}

/* ---------- Lembar 4: UPS ---------- */
/* Lembar ini terbalik dari tiga lembar lain: BARISNYA parameter, KOLOMNYA
   sembilan UPS. Kunci kolom dipendekkan (u1..u9) supaya kunci state-nya tidak
   ikut berubah kalau label kapasitasnya suatu saat dikoreksi. */
const LK_UPS_KOLOM = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8', 'u9'];
const LK_UPS_KEPALA = [
  'MER · ICA (20 KVA)',
  'PROC. ROOM (20 KVA)',
  'PROC. ROOM · ICA (20 KVA)',
  'OPS ROOM (40 KVA)',
  'UPS 1 (200 KVA)',
  'UPS 2 (200 KVA)',
  'UPS PILLER (10 KVA)',
  'UPS EATON · AOC (80 KVA)',
  'UPS EATON · MDS (80 KVA)'
];

function lkSeksiUps(){
  return [
    { judul: 'GEDUNG 612 & 613 — DATA PENGUKURAN UPS', sat: true, ket: true,
      cols: LK_UPS_KOLOM,
      head: [
        [['NO', 1, 2], ['DATA PENGUKURAN', 1, 2], ['MERK DAN KAPASITAS UPS', LK_UPS_KOLOM.length],
         ['SATUAN', 1, 2], ['KETERANGAN', 1, 2]],
        LK_UPS_KEPALA
      ],
      rows: [
        LKG('1 · Tegangan Rectifier'),
        LKR('', 'L1-N / L1-L2', 'Vac'),
        LKR('', 'L2-N / L1-L3', 'Vac'),
        LKR('', 'L3-N / L2-L3', 'Vac'),
        LKG('2 · Arus Rectifier'),
        LKR('', 'L1', 'A'),
        LKR('', 'L2', 'A'),
        LKR('', 'L3', 'A'),
        LKR('3', 'Frequency Input', 'Hz'),
        LKG('4 · Tegangan Inverter'),
        LKR('', 'L1-N / L1-L2', 'Vac'),
        LKR('', 'L2-N / L1-L3', 'Vac'),
        LKR('', 'L3-N / L2-L3', 'Vac'),
        LKG('5 · Arus Inverter'),
        LKR('', 'L1', 'A'),
        LKR('', 'L2', 'A'),
        LKR('', 'L3', 'A'),
        LKR('6', 'Frequency Output', 'Hz'),
        LKR('7', 'Temperatur Ruangan', '°C'),
        LKR('8', 'Temperatur Cover', '°C'),
        LKR('9', 'Temperatur Battery', '°C'),
        LKR('10', 'Tegangan Floating', 'Vdc'),
        LKR('11', 'Arus Battery', 'A'),
        LKR('12', 'Daya', 'KVA / KW'),
        LKR('13', 'Kapasitas Battery', 'Ah'),
        LKG('14 · Temperatur Inverter Choke'),
        LKR('', 'L601', '°C'),
        LKR('', 'L602', '°C'),
        LKR('', 'L603', '°C'),
        LKG('15 · Temperatur Rectifier Choke'),
        LKR('', 'L101', '°C'),
        LKR('', 'L102', '°C'),
        LKR('', 'L103', '°C')
      ] }
  ];
}

/* ---------- Registry lembar ---------- */

const DC_LK_SEKSI = {
  sts:   lkSeksiSts,
  mds:   lkSeksiMds,
  beban: lkSeksiBeban,
  ups:   lkSeksiUps
};
const DC_LK_URUT = ['sts', 'mds', 'beban', 'ups'];

/** Label sub-tab & info bar. */
const DC_LK_LABEL = { sts:'STS', mds:'MDS', beban:'Beban Listrik', ups:'UPS' };

/** Isi lembar — pendamping label di info bar, supaya tahu apa yang diperiksa
    tanpa harus menggulir formnya. */
const DC_LK_ISI = {
  sts:  'STS Line 1 · Line 2 · Output — 9 lokasi',
  mds:  'MDS 1 & 2 · MCC 1 · MCC 2 · Ruang Battery',
  beban:'Common Cubicle · Chiller · Panel MDS · Trafo · Gardu T7',
  ups:  '9 UPS — Rectifier · Inverter · Battery'
};

/** Judul lembar di halaman cetak — memakai judul form aslinya. */
const DC_LK_SUBJUDUL = {
  sts:  'PENGECEKAN HARIAN STS TOWER JATSC',
  mds:  'PENGECEKAN HARIAN MDS NO BREAK TOWER JATSC',
  beban:'PENGECEKAN HARIAN BEBAN LISTRIK TOWER JATSC',
  ups:  'PENGECEKAN HARIAN UPS BEBAN UTAMA OPERASIONAL JATSC'
};

/** Seksi lembar itu. Dihitung tiap kali dipanggil — skemanya murni data. */
function lkSeksi(form){
  const f = DC_LK_SEKSI[form];
  return f ? f() : [];
}

/* ---------- State ---------- */

/** Lembar yang sedang dipilih. Sub-tab yang menggantinya. */
let dcLkForm = 'sts';

/** State per-lembar supaya isian di satu lembar tidak hilang saat pindah ke
    lembar lain — sama semangatnya dengan dcFgkState/dcPgmState. Kunci di dalam
    tiap lembar: "si|ri|kol" (index seksi, index baris, kunci kolom). Kolom
    KETERANGAN memakai kunci kolom 'ket'. */
let dcLkState = { sts:{}, mds:{}, beban:{}, ups:{} };

const lkKunci = (si, ri, kol) => `${si}|${ri}|${kol}`;

function initDcLkState(){
  dcLkState = { sts:{}, mds:{}, beban:{}, ups:{} };
  DC_LK_URUT.forEach(form=>{
    lkSeksi(form).forEach((sec, si)=>{
      sec.rows.forEach((row, ri)=>{
        if(row.group) return;
        lkKolomAktif(sec, row).forEach(kol=>{
          // Kotak angka mulai kosong; KONDISI mulai di ON — di form aslinya
          // memang selalu ada satu kotak yang tercentang.
          dcLkState[form][lkKunci(si, ri, kol)] = (kol === 'kondisi') ? 'on' : '';
        });
      });
    });
  });
}

/** Daftar kunci kolom yang boleh diisi pada satu baris — data + 'ket'.
    only/tanpa mengatur kolom ANGKA saja; kolom KETERANGAN tetap terbuka
    kecuali memang disebut di `tanpa` — baris yang cuma diukur suhunya pun
    perlu tempat menulis sebabnya. */
function lkKolomAktif(sec, row){
  let data = sec.cols;
  if(row.only)       data = data.filter(k=>row.only.includes(k));
  else if(row.tanpa) data = data.filter(k=>!row.tanpa.includes(k));
  const ket = sec.ket && !(row.tanpa && row.tanpa.includes('ket')) ? ['ket'] : [];
  return data.concat(ket);
}

/** Lembar ini punya kolom KONDISI? Info bar hanya menerangkan sandinya kalau
    memang ada — Beban Listrik & UPS tidak punya kolom itu. */
function lkPunyaKondisi(form){
  return lkSeksi(form).some(sec=>sec.cols.includes('kondisi'));
}

/** Sel isian TIDAK menggambar ulang tabel — mengetik sambil dirender ulang
    akan membuat kursor melompat keluar dari kotaknya. */
function setDcLkIsi(k, nilai){
  dcLkState[dcLkForm][k] = String(nilai == null ? '' : nilai);
}

const LK_KONDISI = ['on', 'standby', 'off'];
const lkKondisiLabel = s => s === 'standby' ? 'STBY' : (s === 'off' ? 'OFF' : 'ON');
const lkKondisiPanjang = s => s === 'standby' ? 'STANDBY' : (s === 'off' ? 'OFF' : 'ON');
/** ON hijau, STANDBY kuning, OFF abu — OFF di lembar ini keadaan yang sah
    (banyak STS Line 2 memang mati), bukan gangguan, jadi jangan dimerahkan. */
const lkKondisiKelas = s => s === 'standby' ? 'warn' : (s === 'off' ? 'minus' : 'ok');

function toggleDcLkKondisi(k){
  const st = dcLkState[dcLkForm];
  const i = LK_KONDISI.indexOf(st[k] || 'on');
  st[k] = LK_KONDISI[(i + 1) % LK_KONDISI.length];
  renderDcLkTable();
}

/** Temuan untuk kartu riwayat. Lembar listrik seluruhnya angka ukur — tidak
    ada sel sehat/rusak yang bisa dihitung jadi gangguan atau alarm, dan kolom
    KONDISI menyatakan posisi kerja (ON/STANDBY/OFF), bukan kesehatan. Jadi
    lembar ini sengaja tidak menyumbang temuan; hal yang perlu dicatat ditulis
    di kolom KETERANGAN tiap baris atau di Remark. */
function lkTemuan(){ return { fails: [], warns: [] }; }

/* ---------- Penggambar bersama (form isian, detail, dan cetak) ---------- */

/** Besar huruf tabel di kertas. Yang membatasi bukan tinggi halaman — lembar
    paling panjang (STS, 40-an baris) masih sisa banyak di A4 berdiri —
    melainkan LEBARNYA: MDS punya enam belas kolom yang harus muat di 194mm.
    Satu tetapan supaya keempat lembar tetap seukuran; kalau ada kolom yang
    mulai berganti baris di kertas, kecilkan di sini saja. */
const LK_FS_CETAK = 'font-size:7pt;';

/** Kepala tabel: sec.head = deret baris; sel = 'Teks' | ['Teks',colspan,rowspan].

    DI KERTAS kepalanya memakai .p-kepala (biru muda seperti lembar aslinya) dan
    sel <td>, bukan kelas layar .lk-tbl — kelas itu melukis kepala tabel dengan
    --panel-2 yang gelap, dan #printArea berlatar putih; kalau terbawa, kepala
    tabelnya keluar hitam pekat di kertas. */
function lkHeadHtml(sec, cetak){
  const fs = cetak ? LK_FS_CETAK : '';
  return '<thead>' + sec.head.map(baris=>{
    const sel = baris.map(s=>{
      const t  = Array.isArray(s) ? s[0] : s;
      const cs = Array.isArray(s) && s[1] ? ` colspan="${s[1]}"` : '';
      const rs = Array.isArray(s) && s[2] ? ` rowspan="${s[2]}"` : '';
      return cetak
        ? `<td${cs}${rs} style="${fs}text-align:center;font-weight:bold;">${escapeHtml(t)}</td>`
        : `<th${cs}${rs}>${escapeHtml(t)}</th>`;
    }).join('');
    return cetak ? `<tr class="p-kepala">${sel}</tr>` : `<tr>${sel}</tr>`;
  }).join('') + '</thead>';
}

/** Jumlah kolom total satu seksi — untuk colspan baris sub-judul. */
function lkTotalKolom(sec){
  return (sec.no === false ? 0 : 1) + 1 + sec.cols.length + (sec.sat ? 1 : 0) + (sec.ket ? 1 : 0);
}

/** Satu sel terukur. `mode`: 'isi' → bisa diketik/diklik, 'baca' → modal
    detail, 'cetak' → halaman cetak (tanpa var CSS). */
function lkSelHtml(si, ri, kol, st, mode, aktif){
  const cetak = mode === 'cetak';
  const fs = cetak ? LK_FS_CETAK : '';
  if(!aktif){
    // Sel yang memang tidak diukur di form aslinya — strip redup, bukan kotak
    // kosong yang terbaca "lupa diisi".
    return `<td style="text-align:center;${fs}color:${cetak ? '#999' : 'var(--muted)'};">–</td>`;
  }
  const k = lkKunci(si, ri, kol);
  const v = st[k];

  if(kol === 'kondisi'){
    const s = v || 'on';
    if(mode === 'isi'){
      return `<td><button class="status-btn ${lkKondisiKelas(s)} lk-kondisi"
                onclick="toggleDcLkKondisi('${k}')">${lkKondisiLabel(s)}</button></td>`;
    }
    if(cetak) return `<td style="text-align:center;${fs}">${lkKondisiPanjang(s)}</td>`;
    return `<td><span class="status-btn ${lkKondisiKelas(s)} lk-kondisi"
              style="cursor:default;">${lkKondisiLabel(s)}</span></td>`;
  }

  const teks = escapeHtml(v == null ? '' : String(v));
  if(mode === 'isi'){
    // Warna kotak ditulis sendiri — <input> tanpa warna berlatar putih dan di
    // tema gelap terlihat seperti bercak.
    return `<td class="${kol === 'ket' ? 'lk-ket' : ''}"><input type="text" class="lk-isi"
              value="${teks}" oninput="setDcLkIsi('${k}', this.value)"></td>`;
  }
  const kosong = cetak ? '' : '<span style="opacity:.45;">–</span>';
  return `<td style="text-align:${kol === 'ket' ? 'left' : 'center'};${fs}">${teks || kosong}</td>`;
}

/** Lebar kolom untuk cetak. Tanpa ini tata letak otomatis membagi lebar
    menurut PANJANG TULISAN kepalanya — "SUHU RUANGAN (°C)" jadi selebar tiga
    kolom arus digabung, padahal isinya sama-sama satu angka. Kolom angka
    dibagi rata; nama panel & keterangan dapat jatah tetap.

    Tidak dipakai untuk seksi berkolom sedikit (mis. catatan kWh) — di sana
    bagi-rata justru membuat satu kotak isian selebar setengah halaman. */
function lkColgroupCetak(sec){
  if(sec.cols.length < 3) return '';
  const wNo = sec.no === false ? 0 : 3;
  const wSat = sec.sat ? 6 : 0;
  const wKet = sec.ket ? 12 : 0;
  const wLabel = 22;
  const wData = Math.max(1, 100 - wNo - wLabel - wSat - wKet) / sec.cols.length;
  const col = w => `<col style="width:${w}%">`;
  return '<colgroup>' +
    (wNo ? col(wNo) : '') + col(wLabel) +
    sec.cols.map(()=>col(wData.toFixed(2))).join('') +
    (wSat ? col(wSat) : '') + (wKet ? col(wKet) : '') +
    '</colgroup>';
}

/** Satu seksi = satu tabel. */
function lkSeksiHtml(sec, si, st, mode){
  const cetak = mode === 'cetak';
  const fs = cetak ? LK_FS_CETAK : '';
  const total = lkTotalKolom(sec);

  const body = sec.rows.map((row, ri)=>{
    if(row.group){
      // Baris LOKASI: di layar pakai .lk-grp (warna zebra tema), di kertas abu
      // muda yang ditulis langsung — kelas layar tidak dibawa ke #printArea.
      return cetak
        ? `<tr><td colspan="${total}" style="${fs}text-align:left;font-weight:bold;background:#e8e8e8;">${escapeHtml(row.group)}</td></tr>`
        : `<tr class="lk-grp"><td colspan="${total}" style="text-align:left;font-weight:bold;">${escapeHtml(row.group)}</td></tr>`;
    }
    const aktif = lkKolomAktif(sec, row);
    let tds = '';
    if(sec.no !== false) tds += `<td style="text-align:center;${fs}color:${cetak ? '#555' : 'var(--muted)'};">${escapeHtml(row.no)}</td>`;
    tds += `<td class="lk-par" style="${fs}">${escapeHtml(row.label)}</td>`;
    tds += sec.cols.map(kol=>lkSelHtml(si, ri, kol, st, mode, aktif.includes(kol))).join('');
    if(sec.sat) tds += `<td style="text-align:center;${fs}color:${cetak ? '#555' : 'var(--muted)'};">${escapeHtml(row.sat)}</td>`;
    if(sec.ket) tds += lkSelHtml(si, ri, 'ket', st, mode, aktif.includes('ket'));
    return `<tr>${tds}</tr>`;
  }).join('');

  if(cetak){
    // Tanpa kelas .lk-tbl / .lk-seksi-judul: keduanya berwarna tema gelap.
    // Yang dibawa hanya .lk-print, penanda buat gaya cetak yang disuntikkan
    // buildDcLkPrintHtml (rapat-rapat sel supaya lembarnya muat sehalaman).
    const cg = lkColgroupCetak(sec);
    const tl = cg ? 'table-layout:fixed;' : '';
    return `<div style="margin:0 0 6px;">
      <div style="font-weight:bold;font-size:7pt;margin:4px 0 2px;border-bottom:1px solid #000;">${escapeHtml(sec.judul)}</div>
      <table class="lk-print" style="width:100%;border-collapse:collapse;${LK_FS_CETAK}${tl}">${cg}${lkHeadHtml(sec, true)}<tbody>${body}</tbody></table>
    </div>`;
  }
  const gaya = 'width:100%;border-collapse:collapse;min-width:' + Math.max(560, total * 72) + 'px;';
  const tabel = `<table class="lk-tbl" style="${gaya}">${lkHeadHtml(sec, false)}<tbody>${body}</tbody></table>`;
  return `<div class="lk-seksi"><div class="lk-seksi-judul">${escapeHtml(sec.judul)}</div><div class="lk-gulir">${tabel}</div></div>`;
}

/** Satu lembar utuh. */
function lkLembarHtml(form, st, mode){
  return lkSeksi(form).map((sec, si)=>lkSeksiHtml(sec, si, st, mode)).join('');
}

/** Gambar lembar yang sedang dipilih ke #dcLkWrap. */
function renderDcLkTable(){
  const wrap = document.getElementById('dcLkWrap');
  if(!wrap) return;
  wrap.innerHTML = lkLembarHtml(dcLkForm, dcLkState[dcLkForm] || {}, 'isi');
}

/** Baca-saja untuk modal detail dan halaman cetak. */
function dcLkTabelBaca(form, state, cetak){
  return lkLembarHtml(form, state || {}, cetak ? 'cetak' : 'baca');
}

/** Detail modal: pilih lembar dari __lkForm yang tersimpan (default STS). */
const dcLkDetailHtml = state => dcLkTabelBaca(lkFormTersimpan(state), state, false);

/** Lembar mana yang tersimpan di sebuah state — dipakai detail & cetak. */
function lkFormTersimpan(state){
  const f = state && state.__lkForm;
  return DC_LK_SEKSI[f] ? f : 'sts';
}

/* ---------- Selektor lembar (sub-tab) ---------- */

/** Dipanggil sub-tab. Ganti lembar yang tampak; isian lembar lain tetap tinggal. */
function setDcLkForm(nilai){
  if(!DC_LK_SEKSI[nilai]) return;
  if(dcLkForm === nilai){ sinkronSubtabLk(); return; }
  dcLkForm = nilai;
  renderDcLkTable();
  sinkronSubtabLk();
}

/** Sorot sub-tab yang cocok + segarkan info bar (lembar & isinya). */
function sinkronSubtabLk(){
  document.querySelectorAll('#dcLkSubtabs .subtab-btn').forEach(b=>{
    b.classList.toggle('active', b.dataset.lkform === dcLkForm);
  });
  const bar = document.getElementById('dcLkInfo');
  if(bar){
    bar.style.display = dcListrikAktif() ? '' : 'none';
    const namaEl = document.getElementById('dcLkInfoNama');
    if(namaEl) namaEl.textContent = DC_LK_LABEL[dcLkForm] || '';
    const isiEl = document.getElementById('dcLkInfoIsi');
    if(isiEl) isiEl.textContent = DC_LK_ISI[dcLkForm] || '';
    const hintEl = document.getElementById('dcLkInfoHint');
    if(hintEl){
      const ada = lkPunyaKondisi(dcLkForm);
      hintEl.style.display = ada ? '' : 'none';
      if(ada) hintEl.textContent = ' · Kolom KONDISI diklik untuk berputar: ON → STBY → OFF';
    }
  }
}

/** Unit Listrik & Mekanik sedang aktif? Dipakai dispatcher simpan/cetak. */
function dcListrikAktif(){ return unitAktif === 'listrikmekanik'; }
