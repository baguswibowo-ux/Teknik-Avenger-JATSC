/* E-Logbook · js/12e-daily-check-pengamatan.js — Daily check Fasilitas Pengamatan
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh.

   Unit Pengamatan punya DUA lembar daily check yang berbeda ISI-nya (bukan
   lokasi seperti Radtel): "Radar CKG 3" (rinci per modul radar CKG 3) dan
   "Fasilitas Pengamatan" (menyeluruh: CKG3 ringkas + ADS-B + SMR + SMS + MLAT).
   Pemilih formnya (sub-tab) menggantikan peran selektor Lokasi di Radtel.

   Skema statusnya sengaja disamakan dengan Radtel Frequentis (DC_JATSC):
   Normal / Alarm / Gangguan (ok / warn / fail), klik untuk berputar. Bentuk
   data BLOK-nya juga sama — { judul, kolom, baris } — supaya render, cetak,
   dan detail-nya bisa memakai pola yang sudah teruji. Tiap modul yang punya
   deretan indikator LED dijadikan satu blok; modul kembar (mis. TXCU A1/A2)
   digabung jadi kolom bersebelahan supaya ringkas dan mengikuti tata letak
   form fisiknya. Field pengukuran (RPM, TX Power, VSWR, dsb.) ikut dicatat
   sebagai status Normal/Alarm/Gangguan — sesuai permintaan, tanpa angka. */

/* ---------- Form 1: RADAR CKG 3 (rinci) ---------- */
const DC_PGM_CKG3 = [
  { kode:'A', judul:'A. PHISICALLY CHECK — ANTENNA', blok:[
    { judul:'Antenna', kolom:['STATUS'], baris:[
      'Motor 1','Gearbox 1','Clutch 1','Encoder 1',
      'Motor 2','Gearbox 2','Clutch 2','Encoder 2',
      'Pedestal','Oil Level','Obst. Light',
      'Revolution Period','Temperatur Ruangan'
    ]},
    { judul:'Control & Monitoring Check', kolom:['STATUS'], baris:[
      'SRG','SLG 1','SLG 2','VR3000','Record Data on VR3000'
    ]}
  ]},

  { kode:'B', judul:'B. PRIMARY SURVEILLANCE RADAR', blok:[
    { judul:'TXCU (TXG)', kolom:['A1','A2'], baris:[
      'RST','FAIL','SI 1','SI 2','INTL','SI 3','SI 4','ACT','SI 5','PWR'
    ]},
    { judul:'PSU (SDG)', kolom:['STATUS'], baris:[
      '3U5PS','3U15PS','3U15PS','3U5PS','3U15PS','3U15PS'
    ]},
    { judul:'SDCU', kolom:['STATUS'], baris:[
      'RST','SI 1','SI 2','SI 3','VBA','VBI','VBE','SI 4','SI 5','PWR'
    ]},
    { judul:'TSU', kolom:['A7','A8'], baris:[
      'RST','FAIL','ACT','RSV'
    ]},
    { judul:'BLOWER', kolom:['STATUS'], baris:[
      'A14','A15','A16','MVPS A1','MVPS A2','BPSM A1','BPSM A2','BPSM A3','BPSM A4'
    ]},
    { judul:'AGSU', kolom:['STATUS'], baris:[
      'REMOTE','LOCAL','EPG A','EPG B','RXG A','RXG B','MWG A','MWG B','TSU A','TSU B'
    ]},
    { judul:'ERPS (RXG A / RXG B)', kolom:['RXG A','RXG B'], baris:[
      'DC OK','AC OK','FAN'
    ]},
    { judul:'RGCU (RXG A / RXG B)', kolom:['RXG A','RXG B'], baris:[
      'RST','FAIL','SI 1','SI 2','VBA','VBI','VBE','ACT','SI 3','PWR'
    ]}
  ]},

  { kode:'C', judul:'C. MICROWAVE CONTROL (MWCG)', blok:[
    { judul:'PSU (MWCG)', kolom:['STATUS'], baris:[
      '3U5PS','3U15PS','3U15PS','3U5PS','3U15PS','3U15PS'
    ]},
    { judul:'MWCU (A7)', kolom:['STATUS'], baris:[
      'RST','FAIL','SI 1','SIM','VBA','VBI','VBE','ACT','SI 2','SI 3'
    ]},
    { judul:'MWCU (A8)', kolom:['STATUS'], baris:[
      'RST','FAIL','SI 1','SI 2','COMM A','COMM B','SI 3','ACT','SI 4','PWR'
    ]},
    { judul:'ERPSA (EPG A / EPG B)', kolom:['EPG A','EPG B'], baris:[
      'DC OK','AC OK','FAN','GPB (A3)','GPB (A6)','GPB (A8)'
    ]},
    { judul:'SYNU (EPG A / EPG B)', kolom:['EPG A','EPG B'], baris:[
      'RST','FAIL','SI 1','SIM','VBA','VBI','VBE','ACT','SI 2','SI 3'
    ]},
    { judul:'CBU (EPG A / EPG B)', kolom:['EPG A','EPG B'], baris:[
      'RST','FAIL','SI 1','SI 2','VBA','VBI','VBE','ACT','SI 3','PWR'
    ]},
    { judul:'COHO (EPG A / EPG B)', kolom:['EPG A','EPG B'], baris:[
      'LO2 TX','LVL OK 1','LO2 RX A','LVL OK 2','LO2 RX B','LVL OK 3',
      'CLOCK G','LVL OK 4','CLOCK C','LVL OK 5'
    ]}
  ]},

  { kode:'D', judul:'D. MICROWAVE POWER (MWPG)', blok:[
    { judul:'MWPS', kolom:['MWPS 1','MWPS 2'], baris:[
      'DC OK','AC OK','ENABLE','ON / OFF'
    ]},
    { judul:'STALO', kolom:['STATUS'], baris:['TX OK','RX A OK','RX B OK'] },
    { judul:'Pengukuran', kolom:['STATUS'], baris:[
      'System Pressure','TX Power','VSWR Antenna','Pulse Length'
    ]}
  ]},

  { kode:'E', judul:'E. MONOPOULSE SECONDARY SURVEILLANCE RADAR', blok:[
    { judul:'Transponder', kolom:['TX 1','TX 2'], baris:[
      'Operasional','Standby','Switch Over'
    ]},
    { judul:'Modul MSSR', kolom:['STATUS'], baris:[
      'CTT Tx-TRA','SAU','EMU','MRU','MICE 02',
      'SDU','CTU','MCPU','MICE 03','TRA','TPS','MPSU','MVEX'
    ]},
    { judul:'Additional Module', kolom:['STATUS'], baris:[
      'RDM 1','RDM 2','NTP Server 1','NTP Server 2','Switch 1','Switch 2'
    ]},
    { judul:'Measures Power', kolom:['STATUS'], baris:[
      'Direct PWR Sum','Ref PWR Sum','Direct PWR Omni','Ref PWR Omni'
    ]}
  ]}
];

/* ---------- Form 2: FASILITAS PENGAMATAN (menyeluruh) ---------- */
const DC_PGM_MER = [
  { kode:'A', judul:'A. RADAR CKG3 — PRIMARY SURVEILLANCE RADAR', blok:[
    { judul:'Antenna System', kolom:['STATUS'], baris:[
      'Encoder 1','Motor 1','Encoder 2','Motor 2','Online','Standby'
    ]},
    { judul:'MWG', kolom:['STATUS'], baris:[
      'TGT H 1','TGT H 2','WX HI 1','WX HI 2','TGT LO 1','TGT LO 2','WX LO 1','WX LO 2'
    ]},
    { judul:'TXG', kolom:['STATUS'], baris:[
      'TXCU 1','TXCU 2','PRPA 1','PRPA 2','Online','Standby'
    ]},
    { judul:'GPRG', kolom:['STATUS'], baris:[
      'CPC 1','CPC 2','RXG 1','RXG 2','EPG 1','EPG 2','Online','Standby'
    ]},
    { judul:'Power Amplifier', kolom:['STATUS'], baris:[
      'PA1','PA2','PA3','PA4','PA5','PA6','PA7','PA8','PA9','PA10','Temperatur'
    ]},
    { judul:'SDG / MWCG / WCD', kolom:['STATUS'], baris:[
      'TXG','GPRG1','GPRG2'
    ]},
    { judul:'Power TXG', kolom:['STATUS'], baris:[
      'SDCS A','SDCS B','NTP Server 1','NTP Server 2','Switch 1','Switch 2'
    ]}
  ]},

  { kode:'B', judul:'B. MONOPOULSE SECONDARY SURVEILLANCE RADAR', blok:[
    { judul:'CTT Tx-TRA / MEX-MRU', kolom:['STATUS'], baris:[
      'SAU','EMU','MRU','MICE02','SDU','CTU','MCPU','MICE03','TRA','TPS','MPSU','MVEX'
    ]},
    { judul:'Operation (Ch1-Ch2)', kolom:['STATUS'], baris:[
      'Switch Over'
    ]},
    { judul:'Statistic', kolom:['STATUS'], baris:[
      'Process Load','Used Memory','Radar Data Display'
    ]},
    { judul:'Radar Data Merger System', kolom:['RDM 1','RDM 2'], baris:[
      'LAN 1','LAN 2','COM 1','COM 2','COM 3','COM 4'
    ]}
  ]},

  { kode:'C', judul:'C. ADS-B SOETTA', blok:[
    { judul:'Data — MTSC', kolom:['Channel A','Channel B'], baris:[
      'Master','Slave'
    ]},
    { judul:'Hardware State', kolom:['GS A','GS B'], baris:[
      'Fan','Temperatur','Current Temp 1','Current Temp 2','Current Temp 3'
    ]}
  ]},

  { kode:'D', judul:'D. SURFACE MOVEMENT RADAR', blok:[
    { judul:'SMR T1', kolom:['STATUS'], baris:[
      'Data','Redundant Fail Over','Antenna Rotation','RPM'
    ]},
    { judul:'SMR T3', kolom:['STATUS'], baris:[
      'Data','Redundant Fail Over','Antenna Rotation','RPM'
    ]}
  ]},

  { kode:'E', judul:'E. SURVEILLANCE MONITORING SYSTEM', blok:[
    { judul:'Data', kolom:['STATUS'], baris:[
      'CKG3','KNO','PLB2','TPG2','NTA1','PNK2','BAC2','PKU2','SMG2','PDG1','JOG2'
    ]},
    { judul:'Chart', kolom:['STATUS'], baris:[
      'CKG3','KNO','PLB2','TPG2','NTA1','PNK2','BAC2','PKU2','SMG2','PDG1','JOG2'
    ]}
  ]},

  { kode:'F', judul:'F. MULTILATERATION (MLAT)', blok:[
    { judul:'Subsystem', kolom:['STATUS'], baris:[
      'Receiver','Transmitter','Optical Line','Central Processing',
      'Communication','Power Subsystem','Load Overview Subsystem','Time Subsystem'
    ]}
  ]}
];

const DC_PGM = { ckg3: DC_PGM_CKG3, mer: DC_PGM_MER };

/** Label form untuk sub-tab, judul cetak, dan info bar. */
const DC_PGM_LABEL = { ckg3: 'Radar CKG 3', mer: 'Fasilitas Pengamatan' };

/** Form yang sedang dipilih. Sub-tab menggantikan selektor Lokasi Radtel. */
let dcPgmForm = 'ckg3';

/** State per-form supaya klik di satu form tidak hilang saat pindah ke form
    lain — sama semangatnya dengan dcState/dcJState yang hidup berdampingan.
    Kunci di dalam tiap form: "sk|bi|ri|kk" (seksi kode, blok index, baris
    index, kolom). Nama item tidak dipakai di kunci — item yang kebetulan
    bernama sama antar blok (mis. banyak "3U15PS") tidak saling menimpa. */
let dcPgmState = { ckg3:{}, mer:{} };

function pgmKunci(sk, bi, ri, kk){ return `${sk}|${bi}|${ri}|${kk}`; }

function initDcPgmState(){
  dcPgmState = { ckg3:{}, mer:{} };
  Object.keys(DC_PGM).forEach(form=>{
    DC_PGM[form].forEach(seksi=>{
      seksi.blok.forEach((blok, bi)=>{
        blok.baris.forEach((nama, ri)=>{
          if(!nama) return;
          blok.kolom.forEach(kk=>{
            dcPgmState[form][pgmKunci(seksi.kode, bi, ri * 2, kk)] = 'ok';
          });
        });
      });
    });
  });
}

function cyclePgmStatus(s){ return s==='ok' ? 'warn' : (s==='warn' ? 'fail' : 'ok'); }
function pgmSimbol(s){ return s==='ok' ? '✓' : (s==='warn' ? '!' : '✕'); }

function toggleDcPgmStatus(k){
  const st = dcPgmState[dcPgmForm];
  st[k] = cyclePgmStatus(st[k] || 'ok');
  renderDcPgmTable();
}

/** Kumpulkan temuan (fail = gangguan, warn = alarm) untuk form tertentu.
    Nama yang tampil dibuat manusiawi: "B · SDCU · SI 3 (STATUS)". */
function pgmTemuan(form){
  const fails = [], warns = [];
  const data = DC_PGM[form] || [];
  const st = dcPgmState[form] || {};
  data.forEach(seksi=>{
    seksi.blok.forEach((blok, bi)=>{
      blok.baris.forEach((nama, ri)=>{
        if(!nama) return;
        blok.kolom.forEach(kk=>{
          const s = st[pgmKunci(seksi.kode, bi, ri * 2, kk)];
          const label = `${seksi.kode} · ${blok.judul ? blok.judul + ' · ' : ''}${nama}${kk!=='STATUS' ? ' ('+kk+')' : ''}`;
          if(s === 'fail') fails.push(label);
          else if(s === 'warn') warns.push(label);
        });
      });
    });
  });
  return { fails, warns };
}

/** Gambar form pengamatan yang sedang dipilih ke #dcPgmWrap — tata letak
    kompak: blok kecil dialirkan ke beberapa kolom (.pgm-cols) supaya sekali
    layar terlihat banyak, mengikuti kepadatan lembar aslinya. */
function renderDcPgmTable(){
  const wrap = document.getElementById('dcPgmWrap');
  if(!wrap) return;
  const data = DC_PGM[dcPgmForm] || [];
  const st = dcPgmState[dcPgmForm] || {};
  wrap.innerHTML = data.map(seksi=>{
    const kepala = `<div class="pgm-seksi-judul">${escapeHtml(seksi.judul)}</div>`;
    const blok = seksi.blok.map((b, bi)=>{
      const sub = b.judul ? `<div class="pgm-blok-judul">${escapeHtml(b.judul)}</div>` : '';
      const headKols = b.kolom.map(k=>`<th>${escapeHtml(k)}</th>`).join('');
      const rows = b.baris.map((nama, ri)=>{
        const status = b.kolom.map(kk=>{
          const k = pgmKunci(seksi.kode, bi, ri * 2, kk);
          const s = st[k] || 'ok';
          return `<td><button class="status-btn ${s}" onclick="toggleDcPgmStatus('${k}')">${pgmSimbol(s)}</button></td>`;
        }).join('');
        return `<tr><td class="name">${escapeHtml(nama)}</td>${status}</tr>`;
      }).join('');
      return `<div class="pgm-blok">${sub}<table class="pgm">
        <thead><tr><th>Item</th>${headKols}</tr></thead>
        <tbody>${rows}</tbody></table></div>`;
    }).join('');
    return `<div class="pgm-seksi">${kepala}<div class="pgm-cols">${blok}</div></div>`;
  }).join('');
}

/** Baca-saja untuk modal detail (kompak, kolom) dan halaman cetak (kolom rapat
    supaya muat satu halaman). `form` menentukan lembar; state-nya "sk|bi|ri|kk". */
function dcPgmTabelBaca(form, state, cetak){
  const data = DC_PGM[form] || [];
  const sel = s => cetak
    ? `<td style="text-align:center;"><span class="${s==='ok'?'p-ok':(s==='warn'?'p-warn':'p-fail')}">${pgmSimbol(s)}</span></td>`
    : `<td><span class="status-btn ${s}" style="cursor:default;">${pgmSimbol(s)}</span></td>`;

  // CETAK: isi tiap kolom SAMPAI PENUH setinggi halaman, lalu lanjut ke kolom
  // kanannya. Kolom-kolom yang penuh sama-sama mentok ke dasar halaman = rata
  // bawahnya (sejajar); hanya kolom paling kanan yang boleh tersisa sedikit.
  // Lebar kolom menyesuaikan jumlah kolom yang terpakai supaya mengisi lebar.
  // H_KOLOM = taksiran muatan satu kolom penuh pada A4 portrait (satuan "baris").
  if(cetak){
    const H_KOLOM = 66;    // dikalibrasi: kolom penuh ≈ tinggi area cek 1 halaman
    const maxK = 6;
    const items = [];
    data.forEach(seksi=>{
      items.push({ w:1.6, judul:true,
        html:`<div style="font-weight:bold;font-size:7.5pt;margin:2px 0 1px;border-bottom:1px solid #000;">${escapeHtml(seksi.judul)}</div>` });
      seksi.blok.forEach((b, bi)=>{
        const headKols = b.kolom.map(k=>`<td>${escapeHtml(k)}</td>`).join('');
        const rows = b.baris.map((nama, ri)=>{
          const stats = b.kolom.map(kk=>sel(state[pgmKunci(seksi.kode, bi, ri * 2, kk)] || 'ok')).join('');
          return `<tr><td style="text-align:left;">${escapeHtml(nama)}</td>${stats}</tr>`;
        }).join('');
        const sub = b.judul ? `<div style="font-size:6.5pt;color:#333;margin:1px 0 0;">${escapeHtml(b.judul)}</div>` : '';
        items.push({ w:b.baris.length + 2, judul:false,
          html:`<div style="margin:0 0 3px;">${sub}<table style="width:100%;font-size:7pt;border-collapse:collapse;">
            <thead><tr class="p-kepala"><td>Item</td>${headKols}</tr></thead>
            <tbody>${rows}</tbody></table></div>` });
      });
    });

    // JUMLAH kolom: sebanyak yang dibutuhkan untuk mengisi tinggi halaman.
    const beban = items.map(i=>i.w);
    const total = beban.reduce((s,w)=>s + w, 0);
    const N = Math.min(maxK, Math.max(1, Math.ceil(total / H_KOLOM)));

    // BAGI RATA ke N kolom: cari-biner batas tinggi terkecil supaya muat N kolom.
    // Hasilnya semua kolom kira-kira setinggi — proporsional untuk kedua lembar
    // (CKG 3 maupun Fasilitas Pengamatan), bukan kolom terakhir yang melompong.
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

  // LAYAR (modal detail): kompak per-seksi, sama dengan form isian.
  return data.map(seksi=>{
    const kepala = `<div class="pgm-seksi-judul">${escapeHtml(seksi.judul)}</div>`;
    const blok = seksi.blok.map((b, bi)=>{
      const headKols = b.kolom.map(k=>`<th>${escapeHtml(k)}</th>`).join('');
      const rows = b.baris.map((nama, ri)=>{
        const stats = b.kolom.map(kk=>sel(state[pgmKunci(seksi.kode, bi, ri * 2, kk)] || 'ok')).join('');
        return `<tr><td class="name">${escapeHtml(nama)}</td>${stats}</tr>`;
      }).join('');
      const sub = b.judul ? `<div class="pgm-blok-judul">${escapeHtml(b.judul)}</div>` : '';
      return `<div class="pgm-blok">${sub}<table class="pgm">
        <thead><tr><th>Item</th>${headKols}</tr></thead>
        <tbody>${rows}</tbody></table></div>`;
    }).join('');
    return `<div class="pgm-seksi">${kepala}<div class="pgm-cols">${blok}</div></div>`;
  }).join('');
}

/** Detail modal: pilih form dari __pgmForm yang tersimpan (default ckg3). */
const dcPgmDetailHtml = state => dcPgmTabelBaca((state && state.__pgmForm) || 'ckg3', state, false);

/* ---------- Selektor form (sub-tab) ---------- */
/** Dipanggil sub-tab. Ganti form yang tampak; state form lain tetap tinggal. */
function setDcPgmForm(nilai){
  if(!DC_PGM[nilai]) return;
  if(dcPgmForm === nilai){ sinkronSubtabPgm(); return; }
  dcPgmForm = nilai;
  renderDcPgmTable();
  sinkronSubtabPgm();
}

/** Sorot sub-tab yang cocok + segarkan info bar peralatan. */
function sinkronSubtabPgm(){
  document.querySelectorAll('#dcPgmSubtabs .subtab-btn').forEach(b=>{
    b.classList.toggle('active', b.dataset.pgmform === dcPgmForm);
  });
  const bar = document.getElementById('dcPgmInfo');
  if(bar){
    const punya = dcPengamatanAktif();
    bar.style.display = punya ? '' : 'none';
    const namaEl = document.getElementById('dcPgmInfoNama');
    if(namaEl) namaEl.textContent = DC_PGM_LABEL[dcPgmForm] || '';
  }
}

/** Unit Pengamatan sedang aktif? Dipakai dispatcher simpan/cetak. */
function dcPengamatanAktif(){ return unitAktif === 'pengamatan'; }
