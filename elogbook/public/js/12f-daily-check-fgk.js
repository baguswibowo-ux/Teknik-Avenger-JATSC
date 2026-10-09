/* E-Logbook · js/12f-daily-check-fgk.js — Daily check Fasilitas Gedung & Keamanan
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh.

   Unit "Gedung dan Keamanan" punya TIGA lembar harian di dua gedung.
   Sub-tabnya dua tingkat: baris atas LOKASI (New JATSC / JATSC) seperti
   Radtel, dan di dalam New JATSC baris kedua memilih satu dari dua lembarnya
   (Toilet / Lift & Akses Door). JATSC lembarnya satu, tanpa baris kedua:
     · "New JATSC · Toilet" — CEKLIS FASILITAS TOILET NEW JATSC: status per alat
       di tiap toilet/mushalla, dikelompokkan per gedung dan lantai.
     · "New JATSC · Lift & Akses Door" — CEK LIST HARIAN NEW JATSC: lift gedung
       ATS dan akses door (reader, magnetic, push button, status lock) per ruang.
     · "JATSC"     — CHEKLIST HARIAN DI JATSC: lift penumpang/service, server
       CCTV, dan sistem pengendali jalan masuk.
   Kunci internalnya 'toilet', 'akses', dan 'jatsc' (tertanam di state catatan
   yang sudah tersimpan lewat __fgkForm) — jangan diganti; peta lokasi dan
   isinya ada di DC_FGK_LABEL / DC_FGK_ISI di bawah.

   Bedanya dengan lembar Pengamatan: lembar JATSC bukan status semata —
   ada kolom pengukuran (tegangan lift, suhu car, tegangan UPS, suhu ruangan,
   tegangan barrier gate) yang di form aslinya memang ditulis angkanya. Jadi
   baris boleh berupa:
     'Nama'                              → sel status (klik untuk berputar)
     { n:'Nama', t:'isi', sat:'°C' }     → sel isian angka/teks
   Sel status memakai skema yang sama dengan unit lain — ✓ Baik / ! Perlu
   Perhatian / ✕ Rusak (ok / warn / fail) — supaya render, temuan, dan cetaknya
   bisa memakai pola yang sudah teruji.

   Tata letaknya beda per lembar: lembar Toilet cuma satu kolom STATUS, jadi
   blok-bloknya dialirkan ke beberapa kolom sempit (.pgm-cols) supaya sekali
   layar terlihat banyak. Lembar JATSC tabelnya lebar (empat lift /
   dua server), jadi ditumpuk lebar penuh. */

/* ---------- Form 1: TOILET & MUSHALLA (New JATSC) ---------- */
const DC_FGK_TOILET = [
  { kode:'A', judul:'A. GEDUNG ATS — LANTAI 1', blok:[
    { judul:'Belakang MER · Toilet Pria', kolom:['STATUS'], baris:[
      'Wastafel 1','Wastafel 2','Hand dryer','Toilet Duduk','Shower','Jet Shower',
      'Urinoir 1','Urinoir 2','Urinoir 3','Pintu Dalam 1','Pintu Dalam 2'
    ]},
    { judul:'Belakang MER · Toilet Wanita', kolom:['STATUS'], baris:[
      'Wastafel 1','Wastafel 2','Hand dryer','Toilet Duduk','Shower','Jet Shower',
      'Pintu Dalam 1','Pintu Dalam 2'
    ]},
    { judul:'Belakang MER · Mushalla', kolom:['STATUS'], baris:[
      'Kran Wudhu 1','Kran Wudhu 2','Kran Wudhu 3'
    ]},
    { judul:'Depan MER · Toilet Pria', kolom:['STATUS'], baris:[
      'Wastafel 1','Wastafel 2','Hand dryer',
      'Toilet Duduk 1','Toilet Duduk 2','Toilet Duduk 3',
      'Jet Shower 1','Jet Shower 2','Jet Shower 3',
      'Urinoir 1','Urinoir 2','Urinoir 3',
      'Pintu Dalam 1','Pintu Dalam 2','Pintu Dalam 3'
    ]},
    { judul:'Depan MER · Toilet Wanita', kolom:['STATUS'], baris:[
      'Wastafel 1','Wastafel 2','Wastafel 3','Hand dryer',
      'Toilet Duduk 1','Toilet Duduk 2','Toilet Duduk 3',
      'Jet Shower 1','Jet Shower 2','Jet Shower 3',
      'Pintu Dalam 1','Pintu Dalam 2','Pintu Dalam 3'
    ]}
  ]},

  { kode:'B', judul:'B. GEDUNG ATS — LANTAI 2', blok:[
    { judul:'Depan Ops Room · Toilet Pria', kolom:['STATUS'], baris:[
      'Wastafel 1','Wastafel 2','Hand dryer',
      'Toilet Duduk 1','Toilet Duduk 2','Toilet Duduk 3',
      'Jet Shower 1','Jet Shower 2','Jet Shower 3',
      'Urinoir 1','Urinoir 2','Urinoir 3',
      'Pintu Dalam 1','Pintu Dalam 2','Pintu Dalam 3'
    ]},
    { judul:'Depan Ops Room · Toilet Wanita', kolom:['STATUS'], baris:[
      'Wastafel 1','Wastafel 2','Wastafel 3','Hand dryer',
      'Toilet Duduk 1','Toilet Duduk 2','Toilet Duduk 3',
      'Jet Shower 1','Jet Shower 2','Jet Shower 3',
      'Pintu Dalam 1','Pintu Dalam 2','Pintu Dalam 3'
    ]},
    { judul:'Belakang Ops Room · Toilet Wanita', kolom:['STATUS'], baris:[
      'Wastafel 1','Wastafel 2','Hand dryer',
      'Toilet Duduk 1','Toilet Duduk 2',
      'Jet Shower 1','Jet Shower 2',
      'Pintu Dalam 1','Pintu Dalam 2'
    ]},
    { judul:'Belakang Ops Room · Musollah', kolom:['STATUS'], baris:[
      'Kran Wudhu 1','Kran Wudhu 2','Kran Wudhu 3'
    ]}
  ]},

  { kode:'C', judul:'C. GEDUNG ATS — LANTAI 3', blok:[
    { judul:'Toilet Pria', kolom:['STATUS'], baris:[
      'Wastafel 1','Wastafel 2','Hand dryer',
      'Toilet Duduk 1','Toilet Duduk 2','Toilet Duduk 3',
      'Jet Shower 1','Jet Shower 2','Jet Shower 3',
      'Urinoir 1','Urinoir 2','Urinoir 3',
      'Pintu Dalam 1','Pintu Dalam 2','Pintu Dalam 3'
    ]},
    { judul:'Toilet Wanita', kolom:['STATUS'], baris:[
      'Wastafel 1','Wastafel 2','Wastafel 3','Hand dryer',
      'Toilet Duduk 1','Toilet Duduk 2','Toilet Duduk 3',
      'Jet Shower 1','Jet Shower 2','Jet Shower 3',
      'Pintu Dalam 1','Pintu Dalam 2','Pintu Dalam 3'
    ]}
  ]},

  { kode:'D', judul:'D. GEDUNG MEP', blok:[
    { judul:'Toilet Pria', kolom:['STATUS'], baris:[
      'Wastafel','Toilet Duduk','Jet Shower','Shower',
      'Urinoir 1','Urinoir 2','Pintu Dalam 1','Pintu Dalam 2'
    ]},
    { judul:'Toilet Wanita', kolom:['STATUS'], baris:[
      'Wastafel','Toilet Duduk','Jet Shower','Shower',
      'Pintu Dalam 1','Pintu Dalam 2'
    ]},
    { judul:'Mushalla', kolom:['STATUS'], baris:[
      'Kran Wudhu 1','Kran Wudhu 2'
    ]}
  ]},

  { kode:'E', judul:'E. GEDUNG RADAR', blok:[
    { judul:'Fasilitas Toilet & Dapur', kolom:['STATUS'], baris:[
      'Toilet Duduk','Jet Shower','Shower','Kran air','Wastafel Dapur'
    ]}
  ]}
];

/* ---------- Form 2: PENGECEKAN HARIAN JATSC ---------- */
/* Kolom lift dipendekkan (LIFT PNP A / LIFT SVC TER) supaya kepala tabelnya
   tidak memaksa tabel melebar — nama panjangnya ada di judul blok. */
const FGK_LIFT = ['LIFT PNP A','LIFT PNP B','LIFT SVC TER','LIFT SVC MER'];
const FGK_SRV  = ['SERVER 1','SERVER 2'];

const DC_FGK_JATSC = [
  { kode:'A', judul:'A. PERALATAN LIFT PENUMPANG DAN LIFT SERVICE', catatan:true, blok:[
    { judul:'Tegangan (V) — Lift Penumpang A/B · Lift Service TER/MER', kolom:FGK_LIFT, baris:[
      { n:'L1-L2 / L1-N', t:'isi', ph:'390 / 226' },
      { n:'L2-L3 / L2-N', t:'isi', ph:'391 / 227' },
      { n:'L3-L1 / L3-N', t:'isi', ph:'388 / 227' },
      { n:'OVP',          t:'isi', ph:'227' }
    ]},
    { judul:'Suhu dalam Car', kolom:FGK_LIFT, baris:[
      { n:'Suhu dalam Car', t:'isi', sat:'°C', ph:'24' }
    ]},
    { judul:'Pemeriksaan Fungsi', kolom:FGK_LIFT, baris:[
      'Panel Control',
      'Fungsi tombol & indikator dalam car',
      'Fungsi tombol & indikator operasi',
      'Interkom System',
      'Penerangan dalam Car',
      'System buka / tutup pintu car',
      'System pengamanan pintu Car',
      'Pembersihan Seal Pintu',
      'Pembersihan Seal Car'
    ]}
  ]},

  { kode:'B', judul:'B. PERALATAN SERVER CCTV', catatan:true, blok:[
    { judul:'Pembersihan', kolom:FGK_SRV, baris:[
      'Camera Control System','Monitor','UPS'
    ]},
    { judul:'Pembersihan ruangan pusat pengendali (Control Center)', kolom:FGK_SRV, baris:[
      'Pemeriksaan supply voltage','Main Supply voltage','Output voltage UPS'
    ]},
    { judul:'Pemeriksaan Kabel', kolom:FGK_SRV, baris:[
      'Kabel-kabel dan konektor yang terlihat'
    ]},
    { judul:'Parameter Pengukuran', kolom:FGK_SRV, baris:[
      { n:'Suhu Ruangan',       t:'isi', sat:'°C', ph:'20' },
      { n:'Tegangan I/P UPS',   t:'isi', sat:'V',  ph:'226' },
      { n:'Tegangan O/P UPS 1', t:'isi', sat:'V',  ph:'230' },
      { n:'Tegangan O/P UPS 2', t:'isi', sat:'V',  ph:'220' }
    ]}
  ]},

  { kode:'C', judul:'C. SISTEM PENGENDALI JALAN MASUK', catatan:true, blok:[
    /* Kolom "Kinerja Peralatan" di form aslinya adalah target yang dijawab
       Ya/Tidak — targetnya ditulis menyatu dengan nama itemnya supaya satu
       kolom jawaban saja sudah cukup. */
    { judul:'Kinerja Peralatan — Jawaban Ya / Tidak', kolom:['JAWABAN'], baris:[
      'Personel · Teridentifikasi',
      'Fingerprint / Card · Berfungsi',
      'Door / Barrier Gate / Portal · Berfungsi',
      'Mechanical Lock / Unlock · Tersedia dan Berfungsi',
      'Electrical Lock / Unlock · Berfungsi',
      'Access Control Record · Data tersedia',
      'Alarm System · Berfungsi',
      'Central Control Unit (CPU / Server) · Baik & Berfungsi',
      'Local Control Unit (Access Control Panel) · Baik & Berfungsi',
      'Buku catatan kegiatan pemeliharaan · Tersedia',
      'Buku catatan kegiatan perbaikan · Tersedia',
      'Petunjuk Standar Operasi Peralatan · Tersedia',
      'Respon Time Back Up Supply (max. 3 dtk) · Terpenuhi',
      'Kapasitas Catu Daya Battery (min. 10 mnt) · Terpenuhi',
      'Kebersihan ruangan server peralatan · Bersih'
    ]},
    { judul:'Pengukuran', kolom:['NILAI'], baris:[
      { n:'Temperatur Ruangan Server Peralatan (max. 25°C)', t:'isi', sat:'°C', ph:'20' },
      { n:'Tegangan Barrier Gate — In',  t:'isi', sat:'V',  ph:'227' },
      { n:'Tegangan Barrier Gate — Out', t:'isi', sat:'V',  ph:'228' },
      { n:'Meteran Air',                 t:'isi', sat:'m3', ph:'—' }
    ]}
  ]}
];

/* ---------- Form 3: LIFT & AKSES DOOR (New JATSC) ---------- */
/* Lembar aslinya dua tabel bersebelahan: lift gedung ATS (satu lift, satu kolom
   "Cheklist/Pengukuran") dan akses door per ruang. Kolom BAIK / U/S tiap
   komponen akses door dilebur jadi satu sel status (✓ = baik, ✕ = U/S), dan
   Qty ditulis menyatu dengan nama ruangnya. Kolom KETERANGAN akses door tetap
   per baris seperti di kertasnya — kolom isian bebas (isiKolom), jadi seksi
   itu tidak perlu catatan di bawah tabelnya. */
const FGK_PINTU = ['READER','MAGNETIC','PUSH BUTTON','STATUS LOCK','KETERANGAN'];

const DC_FGK_AKSES = [
  { kode:'A', judul:'A. LIFT GEDUNG ATS', catatan:true, blok:[
    { judul:'Tegangan (V)', kolom:['CEKLIS / UKUR'], baris:[
      { n:'L1-L2 / L1-N', t:'isi', ph:'390 / 226' },
      { n:'L2-L3 / L2-N', t:'isi', ph:'391 / 227' },
      { n:'L3-L1 / L3-N', t:'isi', ph:'388 / 227' }
    ]},
    { judul:'Pemeriksaan', kolom:['CEKLIS / UKUR'], baris:[
      'Panel Control',
      { n:'Suhu dalam Car', t:'isi', sat:'°C', ph:'24' },
      'Fungsi tombol & indikator dalam car',
      'Fungsi tombol & indikator operasi',
      'Interkom System',
      'Penerangan dalam Car',
      'System buka / tutup pintu car',
      'System pengamanan pintu Car',
      'Pembersihan Seal Pintu',
      'Pembersihan Seal Car'
    ]}
  ]},

  { kode:'B', judul:'B. AKSES DOOR GEDUNG ATS', blok:[
    { judul:'Per ruang (jumlah pintu)', kolom:FGK_PINTU, isiKolom:['KETERANGAN'], baris:[
      'Ruang MER (4)',
      'Ruang Mantek (1)',
      'Engineering Workshop (1)',
      'Engineering Locker Room (1)',
      'AMHS-RDPS (1)',
      'Test Bed (2)',
      'Ruang Comm/AMHS (1)',
      'Ruang OP INMC (1)',
      'Ops Room (3)',
      'FIC Room (1)',
      'Ruang Rapat OPS Room (1)',
      'Ruang UPS (1)',
      'Ruang Panel (1)',
      'Pintu Kaca Samping (1)',
      'Pintu Kaca Lantai 2 (1)'
    ]}
  ]}
];

const DC_FGK = { toilet: DC_FGK_TOILET, akses: DC_FGK_AKSES, jatsc: DC_FGK_JATSC };

/** Kunci lembar yang sah dari state tersimpan; catatan lama tanpa __fgkForm
    adalah lembar Toilet. */
const fgkFormSah = f => (DC_FGK[f] ? f : 'toilet');

/** Info bar & halaman cetak: LOKASI gedungnya, sama gaya dengan Radtel. */
const DC_FGK_LABEL = { toilet:'NEW JATSC', akses:'NEW JATSC', jatsc:'JATSC' };

/** Nama lembar selengkapnya — untuk kartu riwayat, yang memuat ketiga lembar
    campur jadi satu daftar. */
const DC_FGK_NAMA = { toilet:'NEW JATSC · Toilet', akses:'NEW JATSC · Lift & Akses Door', jatsc:'JATSC' };

/** Isi lembar di lokasi itu — pendamping label di info bar, supaya tahu apa
    yang diperiksa tanpa harus menggulir formnya. */
const DC_FGK_ISI = {
  toilet:'Toilet & Mushalla',
  akses :'Lift · Akses Door',
  jatsc :'Lift · Server CCTV · Sistem Pengendali Jalan Masuk'
};

/** Baris judul kedua di halaman cetak — menyebut lembar aslinya. */
const DC_FGK_SUBJUDUL = {
  toilet:'FASILITAS TOILET DAN MUSHALLA — NEW JATSC',
  akses :'LIFT · AKSES DOOR GEDUNG ATS — NEW JATSC',
  jatsc :'LIFT · SERVER CCTV · SISTEM PENGENDALI JALAN MASUK — JATSC'
};

/** alir = blok dialirkan ke kolom sempit (lembar Toilet yang cuma 1 kolom
    status). Lembar lain tabelnya lebar, jadi ditumpuk lebar penuh. */
const DC_FGK_ALIR = { toilet:true, akses:false, jatsc:false };

/** Form yang sedang dipilih. Sub-tab menggantikan selektor Lokasi Radtel. */
let dcFgkForm = 'toilet';

/** State per-form supaya isian di satu lembar tidak hilang saat pindah ke
    lembar lain — sama semangatnya dengan dcState/dcJState. Kunci di dalam tiap
    form: "sk|bi|ri|kk" (seksi kode, blok index, baris index, kolom); catatan
    per-seksi memakai kunci "sk|__ket". Nama item tidak dipakai di kunci —
    item yang kebetulan bernama sama antar blok tidak saling menimpa. */
let dcFgkState = { toilet:{}, akses:{}, jatsc:{} };

function fgkKunci(sk, bi, ri, kk){ return `${sk}|${bi}|${ri}|${kk}`; }
function fgkKunciKet(sk){ return `${sk}|__ket`; }

/** Nama baris boleh string (sel status) atau objek (sel isian). */
const fgkNama  = b => (typeof b === 'string' ? b : (b && b.n) || '');
const fgkIsian = b => !!(b && typeof b === 'object' && b.t === 'isi');
/** Kolom isian bebas — diketik di SEMUA baris blok itu (mis. KETERANGAN). */
const fgkKolomIsi = (blok, kk) => !!(blok.isiKolom && blok.isiKolom.includes(kk));

function initDcFgkState(){
  dcFgkState = { toilet:{}, akses:{}, jatsc:{} };
  Object.keys(DC_FGK).forEach(form=>{
    DC_FGK[form].forEach(seksi=>{
      if(seksi.catatan) dcFgkState[form][fgkKunciKet(seksi.kode)] = '';
      seksi.blok.forEach((blok, bi)=>{
        blok.baris.forEach((baris, ri)=>{
          if(!fgkNama(baris)) return;
          blok.kolom.forEach(kk=>{
            const awal = (fgkIsian(baris) || fgkKolomIsi(blok, kk)) ? '' : 'ok';
            dcFgkState[form][fgkKunci(seksi.kode, bi, ri, kk)] = awal;
          });
        });
      });
    });
  });
}

function cycleFgkStatus(s){ return s==='ok' ? 'warn' : (s==='warn' ? 'fail' : 'ok'); }
function fgkSimbol(s){ return s==='ok' ? '✓' : (s==='warn' ? '!' : '✕'); }

function toggleDcFgkStatus(k){
  const st = dcFgkState[dcFgkForm];
  st[k] = cycleFgkStatus(st[k] || 'ok');
  renderDcFgkTable();
}

/** Sel isian TIDAK menggambar ulang tabel — mengetik sambil dirender ulang
    akan membuat kursor melompat keluar dari kotaknya. */
function setDcFgkIsi(k, nilai){
  dcFgkState[dcFgkForm][k] = String(nilai == null ? '' : nilai);
}

/** Kumpulkan temuan (fail = rusak, warn = perlu perhatian) untuk satu lembar.
    Sel isian tidak ikut — angkanya bukan status. Nama yang tampil dibuat
    manusiawi: "A · Belakang MER · Toilet Pria · Shower". */
function fgkTemuan(form){
  const fails = [], warns = [];
  const data = DC_FGK[form] || [];
  const st = dcFgkState[form] || {};
  data.forEach(seksi=>{
    seksi.blok.forEach((blok, bi)=>{
      blok.baris.forEach((baris, ri)=>{
        const nama = fgkNama(baris);
        if(!nama || fgkIsian(baris)) return;
        blok.kolom.forEach(kk=>{
          if(fgkKolomIsi(blok, kk)) return;
          const s = st[fgkKunci(seksi.kode, bi, ri, kk)];
          const satuKolom = blok.kolom.length === 1;
          const label = `${seksi.kode} · ${blok.judul ? blok.judul + ' · ' : ''}${nama}${satuKolom ? '' : ' (' + kk + ')'}`;
          if(s === 'fail') fails.push(label);
          else if(s === 'warn') warns.push(label);
        });
      });
    });
  });
  return { fails, warns };
}

/* ---------- Penggambar bersama (form isian, detail, dan cetak) ---------- */
/** Satu blok jadi satu tabel. `mode`:
      'isi'    → sel bisa diklik / diketik (form)
      'baca'   → baca-saja untuk modal detail
      'cetak'  → baca-saja untuk halaman cetak (tanpa var CSS) */
function fgkBlokHtml(seksi, blok, bi, st, mode){
  const cetak = mode === 'cetak';
  const rows = blok.baris.map((baris, ri)=>{
    const nama = fgkNama(baris);
    if(!nama) return '';
    const sel = blok.kolom.map(kk=>{
      const k = fgkKunci(seksi.kode, bi, ri, kk);
      const v = st[k];
      if(fgkKolomIsi(blok, kk)){
        const teks = escapeHtml(v == null ? '' : String(v));
        if(mode === 'isi'){
          return `<td><input type="text" class="fgk-isi fgk-isi-bebas" value="${teks}"
                    oninput="setDcFgkIsi('${k}', this.value)"></td>`;
        }
        return `<td style="text-align:left;">${teks}</td>`;
      }
      if(fgkIsian(baris)){
        // Satuan duduk SEBARIS di kanan kotaknya (bukan turun ke baris kedua),
        // supaya baris pengukuran tidak jadi dua kali lebih tinggi dari baris
        // status di sebelahnya.
        const teks = escapeHtml(v == null ? '' : String(v));
        const sat = baris.sat
          ? `<span class="fgk-sat" style="color:${cetak ? '#555' : 'var(--muted)'};">${escapeHtml(baris.sat)}</span>`
          : '';
        if(mode === 'isi'){
          return `<td><span class="fgk-sel"><input type="text" class="fgk-isi" value="${teks}" placeholder="${escapeHtml(baris.ph || '')}"
                    oninput="setDcFgkIsi('${k}', this.value)">${sat}</span></td>`;
        }
        return `<td><span class="fgk-sel">${teks || '<span style="opacity:.45;">–</span>'}${teks ? sat : ''}</span></td>`;
      }
      const s = v || 'ok';
      if(mode === 'isi'){
        return `<td><button class="status-btn ${s}" onclick="toggleDcFgkStatus('${k}')">${fgkSimbol(s)}</button></td>`;
      }
      if(cetak){
        return `<td style="text-align:center;"><span class="${s === 'ok' ? 'p-ok' : (s === 'warn' ? 'p-warn' : 'p-fail')}">${fgkSimbol(s)}</span></td>`;
      }
      return `<td><span class="status-btn ${s}" style="cursor:default;">${fgkSimbol(s)}</span></td>`;
    }).join('');
    const namaTd = cetak
      ? `<td style="text-align:left;">${escapeHtml(nama)}</td>`
      : `<td class="name">${escapeHtml(nama)}</td>`;
    return `<tr>${namaTd}${sel}</tr>`;
  }).join('');

  if(cetak){
    const sub = blok.judul ? `<div style="font-size:6.5pt;color:#333;margin:1px 0 0;">${escapeHtml(blok.judul)}</div>` : '';
    const head = blok.kolom.map(k=>`<td${fgkKolomIsi(blok, k) ? ' style="width:30%;"' : ''}>${escapeHtml(k)}</td>`).join('');
    return `<div style="margin:0 0 3px;">${sub}<table style="width:100%;font-size:7pt;border-collapse:collapse;">
      <thead><tr class="p-kepala"><td>Item</td>${head}</tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  }
  const sub = blok.judul ? `<div class="pgm-blok-judul">${escapeHtml(blok.judul)}</div>` : '';
  const head = blok.kolom.map(k=>`<th${fgkKolomIsi(blok, k) ? ' class="fgk-th-bebas"' : ''}>${escapeHtml(k)}</th>`).join('');
  return `<div class="pgm-blok">${sub}<table class="pgm">
    <thead><tr><th>Item</th>${head}</tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

/** Catatan (KETERANGAN) satu seksi — di lembar aslinya satu kolom memanjang di
    samping tabelnya. Di layar dibuat sebentuk Remark: satu .field dengan label
    di atas dan textarea di bawahnya, bukan kotak sebaris yang sempit — isinya
    memang kalimat, bukan angka. */
function fgkKetHtml(seksi, st, mode){
  if(!seksi.catatan) return '';
  const k = fgkKunciKet(seksi.kode);
  const v = escapeHtml(st[k] == null ? '' : String(st[k]));
  if(mode === 'cetak'){
    return `<div style="font-size:7pt;margin:1px 0 4px;"><b>KETERANGAN :</b> ${v.replace(/\n/g, '<br>') || '&nbsp;'}</div>`;
  }
  if(mode === 'isi'){
    // Tanpa baris baru sesudah <textarea>: pengurai HTML membuang satu newline
    // pertama, dan catatan yang diawali baris kosong jadi ikut terpotong.
    return `<div class="field fgk-ket"><label>Keterangan — Seksi ${escapeHtml(seksi.kode)}</label>` +
      `<textarea rows="2" placeholder="catatan untuk seksi ini (opsional)" ` +
      `oninput="setDcFgkIsi('${k}', this.value)">${v}</textarea></div>`;
  }
  return v
    ? `<div class="fgk-ket-baca"><b>Keterangan — Seksi ${escapeHtml(seksi.kode)}:</b><br>${v.replace(/\n/g, '<br>')}</div>`
    : '';
}

/** Satu lembar utuh untuk layar (form isian / modal detail). */
function fgkLembarHtml(form, st, mode){
  const data = DC_FGK[form] || [];
  const alir = DC_FGK_ALIR[form];
  return data.map(seksi=>{
    const kepala = `<div class="pgm-seksi-judul">${escapeHtml(seksi.judul)}</div>`;
    const blok = seksi.blok.map((b, bi)=>fgkBlokHtml(seksi, b, bi, st, mode)).join('');
    const isi = alir ? `<div class="pgm-cols">${blok}</div>` : `<div class="fgk-stack">${blok}</div>`;
    return `<div class="pgm-seksi">${kepala}${isi}${fgkKetHtml(seksi, st, mode)}</div>`;
  }).join('');
}

/** Gambar lembar yang sedang dipilih ke #dcFgkWrap. */
function renderDcFgkTable(){
  const wrap = document.getElementById('dcFgkWrap');
  if(!wrap) return;
  wrap.innerHTML = fgkLembarHtml(dcFgkForm, dcFgkState[dcFgkForm] || {}, 'isi');
}

/** Baca-saja untuk modal detail dan halaman cetak.
    CETAK lembar Toilet: isi tiap kolom SAMPAI PENUH setinggi halaman lalu
    lanjut ke kolom kanannya — sama algoritma dengan lembar Pengamatan (12e),
    supaya 100-an baris statusnya tetap muat satu halaman A4 portrait.
    CETAK lembar JATSC: tabelnya lebar, jadi ditumpuk lebar penuh. */
function dcFgkTabelBaca(form, state, cetak){
  const data = DC_FGK[form] || [];
  if(!cetak) return fgkLembarHtml(form, state, 'baca');
  if(form === 'akses') return fgkCetakAksesHtml(state);

  // Lembar JATSC: seksi A (empat kolom lift) memakai lebar penuh, lalu
  // B (dua kolom server) dan C (satu kolom jawaban) berdampingan di bawahnya.
  // Ditumpuk bertiga lembarnya jadi ±304mm — lewat satu halaman A4; disandingkan
  // begini muat, dan susunannya pun lebih dekat ke lembar aslinya.
  if(!DC_FGK_ALIR[form]){
    const seksiHtml = seksi=>{
      const kepala = `<div style="font-weight:bold;font-size:8pt;margin:4px 0 2px;border-bottom:1px solid #000;">${escapeHtml(seksi.judul)}</div>`;
      const blok = seksi.blok.map((b, bi)=>fgkBlokHtml(seksi, b, bi, state, 'cetak')).join('');
      return `${kepala}${blok}${fgkKetHtml(seksi, state, 'cetak')}`;
    };
    const atas = data.slice(0, 1).map(s=>`<div style="margin-bottom:4px;">${seksiHtml(s)}</div>`).join('');
    const sisa = data.slice(1);
    if(!sisa.length) return `<div class="fgk-cetak">${atas}</div>`;
    // Bagi sisa seksi ke dua kolom sesuai jumlah barisnya, bukan sekadar
    // separuh-separuh — supaya kedua kolom kira-kira sama tingginya.
    const beban = sisa.map(s=>s.blok.reduce((n, b)=>n + b.baris.length + 2, 0));
    const total = beban.reduce((a, b)=>a + b, 0);
    let potong = 1, kiri = beban[0];
    while(potong < sisa.length && kiri + beban[potong] <= total / 2){ kiri += beban[potong]; potong++; }
    const kolom = [sisa.slice(0, potong), sisa.slice(potong)].filter(k=>k.length);
    const cells = kolom.map(k=>
      `<td style="border:none;vertical-align:top;width:${(100 / kolom.length).toFixed(2)}%;padding:0 6px 0 0;">${k.map(seksiHtml).join('')}</td>`
    ).join('');
    return `<div class="fgk-cetak">${atas}
      <table style="table-layout:fixed;width:100%;border-collapse:collapse;"><tbody><tr>${cells}</tr></tbody></table></div>`;
  }

  // H_KOLOM = taksiran muatan satu kolom penuh pada A4 portrait (satuan "baris").
  const H_KOLOM = 66;
  const maxK = 6;
  const items = [];
  data.forEach(seksi=>{
    items.push({ w:1.6, judul:true,
      html:`<div style="font-weight:bold;font-size:7.5pt;margin:2px 0 1px;border-bottom:1px solid #000;">${escapeHtml(seksi.judul)}</div>` });
    seksi.blok.forEach((b, bi)=>{
      items.push({ w:b.baris.length + 2, judul:false, html:fgkBlokHtml(seksi, b, bi, state, 'cetak') });
    });
    if(seksi.catatan) items.push({ w:1.4, judul:false, html:fgkKetHtml(seksi, state, 'cetak') });
  });

  // JUMLAH kolom: sebanyak yang dibutuhkan untuk mengisi tinggi halaman.
  const beban = items.map(i=>i.w);
  const total = beban.reduce((s, w)=>s + w, 0);
  const N = Math.min(maxK, Math.max(1, Math.ceil(total / H_KOLOM)));

  // BAGI RATA ke N kolom: cari-biner batas tinggi terkecil supaya muat N kolom.
  const muat = (H)=>{ let k = 1, cur = 0; for(const w of beban){ if(w > H + 1e-6) return Infinity; if(cur + w <= H + 1e-6) cur += w; else { k++; cur = w; } } return k; };
  let lo = Math.max(...beban), hi = total;
  for(let it = 0; it < 50 && hi - lo > 1e-4; it++){ const mid = (lo + hi) / 2; if(muat(mid) <= N) hi = mid; else lo = mid; }
  const H = hi;

  const cols = [{ w:0, html:'' }];
  for(let i = 0; i < items.length; i++){
    const item = items[i];
    const cur = cols[cols.length - 1];
    let kolomBaru = cur.w > 0 && cur.w + item.w > H + 1e-6 && cols.length < N;
    // Judul seksi jangan menggantung sendirian di dasar kolom.
    if(!kolomBaru && item.judul && cur.w > 0 && cols.length < N){
      const nx = items[i + 1];
      if(nx && cur.w + item.w + nx.w > H + 1e-6) kolomBaru = true;
    }
    if(kolomBaru) cols.push({ w:0, html:'' });
    const c = cols[cols.length - 1];
    c.w += item.w; c.html += item.html;
  }
  while(cols.length < N) cols.push({ w:0, html:'' });

  const cells = cols.map(col=>
    `<td style="border:none;vertical-align:top;width:${(100 / N).toFixed(2)}%;padding:0 6px 0 0;">${col.html}</td>`
  ).join('');
  return `<table class="pgm-print" style="table-layout:fixed;width:100%;border-collapse:collapse;"><tbody><tr>${cells}</tr></tbody></table>`;
}

/** CETAK lembar Lift & Akses Door — meniru lembar kertasnya ("Cek List Harian
    NJ"): SATU tabel menyatu, lift di kiri dan akses door di kanan, baris demi
    baris sejajar. Kolom dan lebarnya diambil dari lembar aslinya: NO · URAIAN
    KEGIATAN · CHEKLIST/PENGUKURAN · AKSES DOOR · Qty · READER / MAGNETIC /
    PUSH BUTTON (masing-masing BAIK | U/S) · STATUS LOCK · KETERANGAN.
    Sel status layar (✓ / ! / ✕) dipetakan ke dua kolomnya: ✓ jatuh di BAIK,
    ✕ jadi centang di U/S, dan ! (perlu perhatian) ditulis di BAIK.
    Gayanya (.fgk-asli) ada di buildDcFgkAksesPrintHtml, 24-cetak-daily-check.js. */
function fgkCetakAksesHtml(state){
  const st = state || {};
  const [lift, pintu] = DC_FGK_AKSES;
  const KK = lift.blok[0].kolom[0];
  const sim = s => `<span class="${s === 'ok' ? 'p-ok' : (s === 'warn' ? 'p-warn' : 'p-fail')}">${fgkSimbol(s)}</span>`;

  // Sisi lift: baris kepala "Tegangan (V)", tiga baris ukurnya, satu baris
  // kosong (di kertasnya juga kosong), lalu butir 2 dst. yang bernomor.
  const kiri = [{ no:'1', nama:lift.blok[0].judul, nilai:'' }];
  lift.blok[0].baris.forEach((b, ri)=>{
    kiri.push({ no:'', nama:fgkNama(b), nilai:escapeHtml(st[fgkKunci(lift.kode, 0, ri, KK)] || '') });
  });
  kiri.push({ no:'', nama:'', nilai:'' });
  lift.blok[1].baris.forEach((b, ri)=>{
    const v = st[fgkKunci(lift.kode, 1, ri, KK)];
    const nilai = fgkIsian(b)
      ? (v ? escapeHtml(String(v)) + (b.sat ? ' ' + escapeHtml(b.sat) : '') : '')
      : sim(v || 'ok');
    kiri.push({ no:String(ri + 2), nama:fgkNama(b), nilai });
  });

  const komponen = pintu.blok[0].kolom.slice(0, 3);       // READER, MAGNETIC, PUSH BUTTON
  const kanan = pintu.blok[0].baris.map((b, ri)=>{
    const m = /^(.*?)\s*\((\d+)\)$/.exec(fgkNama(b)) || [null, fgkNama(b), ''];
    const k = kk => st[fgkKunci(pintu.kode, 0, ri, kk)];
    const dua = komponen.map(kk=>{
      const s = k(kk) || 'ok';
      return `<td class="t">${s === 'fail' ? '' : sim(s)}</td><td class="t">${s === 'fail' ? '<span class="p-fail">✓</span>' : ''}</td>`;
    }).join('');
    return `<td>${escapeHtml(m[1])}</td><td class="t">${escapeHtml(m[2])}</td>${dua}` +
      `<td class="t">${sim(k('STATUS LOCK') || 'ok')}</td><td>${escapeHtml(k('KETERANGAN') || '')}</td>`;
  });

  const n = Math.max(kiri.length, kanan.length);
  let rows = '';
  for(let i = 0; i < n; i++){
    const L = kiri[i] || { no:'', nama:'', nilai:'' };
    rows += `<tr><td class="t">${L.no}</td><td>${escapeHtml(L.nama)}</td><td class="t">${L.nilai}</td>` +
      (kanan[i] || '<td></td>'.repeat(10)) + '</tr>';
  }
  return `<table class="fgk-asli">
    <colgroup><col style="width:2.6%"><col style="width:22%"><col style="width:10.4%"><col style="width:15%"><col style="width:2.8%">${'<col style="width:5%">'.repeat(6)}<col style="width:5.8%"><col style="width:11.4%"></colgroup>
    <thead>
      <tr><td rowspan="2">NO</td><td colspan="2">LIFT GEDUNG ATS</td><td rowspan="2">AKSES DOOR GEDUNG ATS</td><td rowspan="2">Qty</td>
          <td colspan="2">READER</td><td colspan="2">MAGNETIC</td><td colspan="2">PUSH BUTTON</td><td rowspan="2">STATUS LOCK</td><td rowspan="2">KETERANGAN</td></tr>
      <tr><td>URAIAN KEGIATAN</td><td>CHEKLIST/<br>PENGUKURAN</td>${'<td>BAIK</td><td>U/S</td>'.repeat(3)}</tr>
    </thead>
    <tbody>${rows}</tbody></table>`;
}

/** Detail modal: pilih lembar dari __fgkForm yang tersimpan (default toilet). */
const dcFgkDetailHtml = state => dcFgkTabelBaca(fgkFormSah(state && state.__fgkForm), state, false);

/* ---------- Selektor form (sub-tab dua tingkat) ---------- */
/** Lembar New JATSC yang terakhir dibuka — tujuan tombol lokasi "New JATSC"
    sepulang dari JATSC. */
let dcFgkFormNj = 'toilet';

/** Dipanggil sub-tab. Ganti lembar yang tampak; isian lembar lain tetap tinggal. */
function setDcFgkForm(nilai){
  if(!DC_FGK[nilai]) return;
  if(dcFgkForm !== nilai){
    dcFgkForm = nilai;
    renderDcFgkTable();
  }
  sinkronSubtabFgk();
  // Penangan klik .subtab-btn umum (04-toast-tab.js) jalan SESUDAH onclick ini
  // dan mencabut sorotan semua sub-tab kecuali yang ditekan — padahal di sini
  // dua tombol harus menyala sekaligus (lokasi + lembarnya). Pasang lagi.
  setTimeout(sinkronSubtabFgk, 0);
}

/** Tombol lokasi baris atas. 'nj' kembali ke lembar New JATSC yang terakhir
    dibuka; JATSC lembarnya satu, jadi tombolnya langsung setDcFgkForm('jatsc'). */
function setDcFgkLokasi(lokasi){
  setDcFgkForm(lokasi === 'jatsc' ? 'jatsc' : dcFgkFormNj);
}

/** Sorot sub-tab yang cocok + segarkan info bar (lokasi & isi lembarnya). */
function sinkronSubtabFgk(){
  const diJatsc = dcFgkForm === 'jatsc';
  if(!diJatsc) dcFgkFormNj = dcFgkForm;
  document.querySelectorAll('#dcFgkSubtabs .subtab-btn').forEach(b=>{
    b.classList.toggle('active', b.dataset.fgklokasi
      ? (b.dataset.fgklokasi === 'jatsc') === diJatsc
      : b.dataset.fgkform === dcFgkForm);
  });
  const lembar = document.getElementById('dcFgkLembar');
  if(lembar) lembar.style.display = diJatsc ? 'none' : '';
  const bar = document.getElementById('dcFgkInfo');
  if(bar){
    bar.style.display = dcGedungKeamananAktif() ? '' : 'none';
    const namaEl = document.getElementById('dcFgkInfoNama');
    if(namaEl) namaEl.textContent = DC_FGK_LABEL[dcFgkForm] || '';
    const isiEl = document.getElementById('dcFgkInfoIsi');
    if(isiEl) isiEl.textContent = DC_FGK_ISI[dcFgkForm] || '';
  }
}

/** Unit Gedung & Keamanan sedang aktif? Dipakai dispatcher simpan/cetak. */
function dcGedungKeamananAktif(){ return unitAktif === 'gedungkeamanan'; }
