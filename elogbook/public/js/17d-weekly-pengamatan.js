/* E-Logbook · js/17d-weekly-pengamatan.js — Preventive Maintenance unit Pengamatan
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh.

   Tiga lembar Weekly Check radar Pengamatan dijadikan sub-tab Preventive
   Maintenance tersendiri (masing-masing riwayat + cetak + TTD Manager sendiri):

     ckg3   → WEEKLY CHECK RADAR CKG 3   (panel indikator rinci)
     smrt1  → WEEKLY CHECK SMR T1         (Channel A/B + LCMS + UPS)
     smrt3  → WEEKLY CHECK SMR T3         (bentuknya sama persis SMR T1)

   Skema statusnya disamakan dengan Daily Check Pengamatan (12e) dan Radtel
   Frequentis: Normal / Alarm / Gangguan (ok / warn / fail), klik untuk
   berputar. Field ukur di form asli (Fwd/Rev Power, tegangan UPS, suhu, RPM,
   Time&Date OK/NOT OK) ikut dicatat sebagai status — bukan angka — mengikuti
   keputusan unit Pengamatan yang status-only.

   PENYIMPANAN. Menumpang tabel `dstest` yang sama seperti Maintenance Radio:
   catatannya dibedakan lewat state.__format === 'pgmweekly' + state.__wForm
   (ckg3/smrt1/smrt3). Seluruh rangkaian TTD pihak-kedua (Manager Teknik),
   kotak masuk TTD, hapus, dan cetak sudah tersedia untuk 'dstest' — jadi
   weekly check ikut memakainya tanpa tabel/rute baru. Guard daftar-site di
   insertDsTest (db.js + db-pg.js) dilewati untuk format ini. */

/* ---------- Bentuk lembar: seksi → blok {judul, kolom, baris} ---------- */

/** Weekly Check Radar CKG 3. Dialihaksarakan dari "Weekly Check CKG 3.xlsx". */
const WK_CKG3 = [
  { kode:'A', judul:'A. PHISICALLY CHECK', blok:[
    { judul:'Antenna', kolom:['STATUS'], baris:[
      'Motor 1','Gearbox 1','Clutch 1','Encoder 1',
      'Motor 2','Gearbox 2','Clutch 2','Encoder 2',
      'Pedestal','Oil Level','Obst. Light',
      'Revolution Period','RPM','Temperatur Ruangan'
    ]},
    { judul:'Control & Monitoring Check', kolom:['STATUS'], baris:[
      'SRG','SLG 1','SLG 2','VR3000'
    ]}
  ]},

  { kode:'B', judul:'B. PRIMARY SURVEILLANCE RADAR', blok:[
    { judul:'PSR', kolom:['STATUS'], baris:['Operasional','Standby'] },
    { judul:'BLOWER', kolom:['CH A','CH B'], baris:[
      'A14','A15','A16','MPVS A1','MPVS A2','BPSM A1','BPSM A2','BPSM A3','BPSM A4'
    ]},
    { judul:'AGSU', kolom:['STATUS'], baris:[
      'REMOTE','LOCAL','EPG A','EPG B','RXG A','RXG B','TSU A','TSU B','MWG A','MWG B'
    ]},
    { judul:'TXG · TXCU', kolom:['A1','A2'], baris:[
      'RST','FAIL','SI 1','SI 2','INTL','SI 3','SI 4','ACT','SI 5','PWR'
    ]},
    { judul:'TXG · PRPA / PA', kolom:['STATUS'], baris:[
      'PRPA 1','PRPA 2','PA 1','PA 2','PA 3','PA 4','PA 5','PA 6','PA 7','PA 8','PA 9','PA 10'
    ]},
    { judul:'TXG · PSU', kolom:['STATUS'], baris:[
      '3U5PS','3U15PS','3U15PS','3U5PS','3U15PS','3U15PS'
    ]},
    { judul:'TSU', kolom:['A7','A8'], baris:['RST','FAIL','ACT','RSV'] },
    { judul:'SDCU', kolom:['STATUS'], baris:[
      'RST','SI 1','SI 2','SI 3','VBA','VBI','VBE','SI 4','SI 5','PWR'
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
    { judul:'MWPG · MWPS', kolom:['MWPS 1','MWPS 2'], baris:[
      'DC OK','AC OK','ENABLE','ON / OFF'
    ]},
    { judul:'ERPS (RXG A / RXG B)', kolom:['RXG A','RXG B'], baris:['DC OK','AC OK','FAN'] },
    { judul:'RGCU (RXG A / RXG B)', kolom:['RXG A','RXG B'], baris:[
      'RST','FAIL','SI 1','SI 2','VBA','VBI','VBE','ACT','SI 3','PWR'
    ]}
  ]},

  { kode:'D', judul:'D. EPG A / EPG B', blok:[
    { judul:'ERPSA', kolom:['EPG A','EPG B'], baris:[
      'DC OK','AC OK','FAN','GPB (A3)','GPB (A6)','GPB (A8)'
    ]},
    { judul:'SYNU', kolom:['EPG A','EPG B'], baris:[
      'RST','FAIL','SI 1','SIM','VBA','VBI','VBE','ACT','SI 2','SI 3'
    ]},
    { judul:'CBU', kolom:['EPG A','EPG B'], baris:[
      'RST','FAIL','SI 1','SI 2','VBA','VBI','VBE','ACT','SI 3','PWR'
    ]},
    { judul:'COHO', kolom:['EPG A','EPG B'], baris:[
      'LO2 TX','LVL OK 1','LO2 RX A','LVL OK 2','LO2 RX B','LVL OK 3',
      'CLOCK G','LVL OK 4','CLOCK C','LVL OK 5'
    ]},
    { judul:'STALO', kolom:['EPG A','EPG B'], baris:['TX OK','RX A OK','RX B OK'] }
  ]},

  { kode:'E', judul:'E. MONOPOULSE SECONDARY SURVEILLANCE RADAR', blok:[
    { judul:'Transponder', kolom:['TX 1','TX 2'], baris:['Operasional','Standby'] },
    { judul:'CTT Tx-TRA / MEX-MRU', kolom:['A','B'], baris:[
      'SAU','SDU','TRA','EMU','CTU','TPS','MRU','MCPU','MPSU','MICE 02','MICE 03','MVEX'
    ]},
    { judul:'Additional Modul', kolom:['STATUS'], baris:[
      'NTP Server 1','NTP Server 2','Switch 1','Switch 2'
    ]},
    { judul:'RDM', kolom:['Main','Standby'], baris:['RDM 1','RDM 2'] }
  ]},

  { kode:'F', judul:'F. METER READING', blok:[
    { judul:'TPS Supply', kolom:['CH1','CH2'], baris:[
      '+5VDC','+15VDC','-15VDC','+28VDC','+48VDC'
    ]},
    { judul:'MFEX Supply', kolom:['CH1','CH2'], baris:[
      '+3.3VDC','+15VDC','-15VDC','-12VDC','+12VDC','+5VDC'
    ]},
    { judul:'Pulse Check', kolom:['STATUS'], baris:['P1','P2','P3','P5','P6'] },
    { judul:'ARP / ACP', kolom:['STATUS'], baris:['ARP','ACP A','ACP B'] }
  ]}
];

/** Weekly Check SMR (T1 & T3 bentuknya identik). Dua channel A & B, plus
    LCMS/ACU/cooling/UPS bersama. Dialihaksarakan dari "Weekly Check SMR T1/T3". */
function wkSmrKanal(kode, judul){
  return { kode, judul, blok:[
    { judul:'Control & Status', kolom:['STATUS'], baris:[
      'MAINS','ANTENNA','TX','RED.','Time & Date'
    ]},
    { judul:'BITE Error Details', kolom:['STATUS'], baris:[
      'Fatal Errors','Critical Errors','Non Critical Errors','Warnings'
    ]},
    { judul:'BITE Measurements', kolom:['STATUS'], baris:[
      'Fwd Power','Rev Power','Noise Fig.','Ant. Tellb.'
    ]},
    { judul:'SSPA', kolom:['STATUS'], baris:['Active'] },
    { judul:'RXTX Control', kolom:['STATUS'], baris:['L1','L2','L3','L4'] },
    { judul:'CPU', kolom:['PC1','PC2'], baris:[
      'Ethernet','PCI','HD (Blinking)','ON','3V3','5V0','CP 4','CRC Fail / Power OK'
    ]}
  ]};
}
const WK_SMR = [
  wkSmrKanal('A', 'CHANNEL A'),
  wkSmrKanal('B', 'CHANNEL B'),
  { kode:'C', judul:'RACK LCMS · SCANTER ACU · COOLING', blok:[
    { judul:'Rack LCMS (RST)', kolom:['STATUS'], baris:['RST','FAN 1','FAN 2','FAN 3','FAN 4'] },
    { judul:'Scanter ACU', kolom:['STATUS'], baris:['Switch FIUB','SW 3A','SW 3B','Operation FAN'] },
    { judul:'Ruangan', kolom:['STATUS'], baris:['Suhu Ruangan','Cooling System Delair'] }
  ]},
  { kode:'D', judul:'UPS', blok:[
    { judul:'UPS Status', kolom:['STATUS'], baris:['Load On','On Batt','Bypass','Fault'] },
    { judul:'UPS Voltage', kolom:['STATUS'], baris:[
      'Vin (1)','Vin (2)','Vin (3)','Vout (1)','Vout (2)','Vout (3)'
    ]}
  ]}
];

/** Katalog lembar. `label`/`sub` dipakai kepala sub-tab; `judul` untuk cetak. */
const WK_FORMS = {
  ckg3:  { data: WK_CKG3, judul: 'WEEKLY CHECK RADAR CKG 3' },
  smrt1: { data: WK_SMR,  judul: 'WEEKLY CHECK SURFACE MOVEMENT RADAR (SMR T1)' },
  smrt3: { data: WK_SMR,  judul: 'WEEKLY CHECK SURFACE MOVEMENT RADAR (SMR T3)' }
};
const WK_URUT = ['ckg3','smrt1','smrt3'];

/* ---------- State form yang sedang diisi ---------- */

/** Lembar yang sedang dibuka di modal. */
let wkForm = 'ckg3';
/** Status per-sel lembar yang sedang diisi. Kunci "kode|bi|ri|kk". */
let wkSel = {};
let wkTeknisiRows = [];
let wkTeknisiSeq = 0;

function wkKunci(kode, bi, ri, kk){ return `${kode}|${bi}|${ri}|${kk}`; }
function wkCyclePutar(s){ return s === 'ok' ? 'warn' : (s === 'warn' ? 'fail' : 'ok'); }
function wkSimbol(s){ return s === 'ok' ? '✓' : (s === 'warn' ? '!' : '✕'); }

/** Semua sel mulai dari 'ok' (Normal). */
function wkInitSel(form){
  const sel = {};
  (WK_FORMS[form].data).forEach(seksi=>{
    seksi.blok.forEach((b, bi)=>{
      b.baris.forEach((nama, ri)=>{
        if(!nama) return;
        b.kolom.forEach(kk=>{ sel[wkKunci(seksi.kode, bi, ri, kk)] = 'ok'; });
      });
    });
  });
  return sel;
}

function toggleWkStatus(k){
  wkSel[k] = wkCyclePutar(wkSel[k] || 'ok');
  renderWkTable();
}

/** Temuan: fail = gangguan, warn = alarm. Label manusiawi "B · SDCU · SI 3". */
function wkTemuan(form, sel){
  const fails = [], warns = [];
  (WK_FORMS[form] ? WK_FORMS[form].data : []).forEach(seksi=>{
    seksi.blok.forEach((b, bi)=>{
      b.baris.forEach((nama, ri)=>{
        if(!nama) return;
        b.kolom.forEach(kk=>{
          const s = sel[wkKunci(seksi.kode, bi, ri, kk)];
          const label = `${seksi.kode} · ${b.judul ? b.judul + ' · ' : ''}${nama}${kk!=='STATUS' ? ' ('+kk+')' : ''}`;
          if(s === 'fail') fails.push(label);
          else if(s === 'warn') warns.push(label);
        });
      });
    });
  });
  return { fails, warns };
}

/* ---------- Bagi blok ke kolom cetak dengan dasar rata ---------- */

/** Partisi kontigu array `w` ke `k` bagian yang MEMINIMALKAN bagian terberat
    (DP min-max klasik). Dipakai dengan tinggi-piksel ASLI tiap blok supaya
    kolom cetak sama tinggi (dasarnya sejajar). Menjaga urutan; return `[a,b)`. */
function wkPartisiRata(w, k){
  const n = w.length;
  if(k <= 1) return [[0, n]];
  if(k >= n) return w.map((_, i)=>[i, i + 1]);
  const pre = [0];
  for(let i = 0; i < n; i++) pre.push(pre[i] + w[i]);
  const dp  = Array.from({ length:k + 1 }, ()=> new Array(n + 1).fill(Infinity));
  const cut = Array.from({ length:k + 1 }, ()=> new Array(n + 1).fill(0));
  for(let i = 0; i <= n; i++) dp[1][i] = pre[i];
  for(let j = 2; j <= k; j++){
    for(let i = j; i <= n; i++){
      for(let p = j - 1; p < i; p++){
        const val = Math.max(dp[j - 1][p], pre[i] - pre[p]);
        if(val < dp[j][i]){ dp[j][i] = val; cut[j][i] = p; }
      }
    }
  }
  const bounds = [];
  let i = n, j = k;
  while(j > 0){ const p = j === 1 ? 0 : cut[j][i]; bounds.unshift([p, i]); i = p; j--; }
  return bounds;
}

/** Partisi kontigu yang MEMINIMALKAN selisih (tertinggi − terpendek) antar
    kolom → dasar kolom paling sejajar, tanpa kolom kuncup. Brute-force semua
    posisi potong (jumlahnya kecil untuk lembar ini); kalau kombinasinya
    kebanyakan, mundur ke min-max `wkPartisiRata`. */
function wkPartisiSpread(h, k){
  const n = h.length;
  if(k <= 1) return [[0, n]];
  if(k >= n) return h.map((_, i)=>[i, i + 1]);
  // Perkiraan jumlah kombinasi C(n-1, k-1); kalau > ~3 juta, pakai min-max.
  let komb = 1;
  for(let a = 0; a < k - 1; a++) komb = komb * (n - 1 - a) / (a + 1);
  if(komb > 3e6) return wkPartisiRata(h, k);
  const pre = [0];
  for(let i = 0; i < n; i++) pre.push(pre[i] + h[i]);
  let bestSpread = Infinity, bestMax = Infinity, bestCut = null;
  const cuts = new Array(k - 1);
  (function rec(start, ci){
    if(ci === k - 1){
      const b = [0, ...cuts, n];
      let mx = -Infinity, mn = Infinity;
      for(let j = 0; j < k; j++){ const s = pre[b[j + 1]] - pre[b[j]]; if(s > mx) mx = s; if(s < mn) mn = s; }
      const spread = mx - mn;
      if(spread < bestSpread || (spread === bestSpread && mx < bestMax)){ bestSpread = spread; bestMax = mx; bestCut = b.slice(); }
      return;
    }
    for(let c = start; c <= n - (k - 1 - ci); c++){ cuts[ci] = c; rec(c + 1, ci + 1); }
  })(1, 0);
  const bounds = [];
  for(let j = 0; j < k; j++) bounds.push([bestCut[j], bestCut[j + 1]]);
  return bounds;
}

/** Ukur tinggi piksel tiap potongan HTML pada lebar kolom `colW` (px). Memakai
    satu kotak tersembunyi supaya layout betulan yang menghitung — termasuk nama
    yang membungkus dua baris. Kembali ke bobot taksiran kalau tak ada DOM. */
function wkUkurTinggi(items, colW){
  if(typeof document === 'undefined' || !document.body) return items.map(it=>it.w);
  const probe = document.createElement('div');
  probe.style.cssText = `position:absolute;left:-9999px;top:0;visibility:hidden;width:${colW}px;`;
  document.body.appendChild(probe);
  const H = items.map(it=>{ probe.innerHTML = it.html; return probe.offsetHeight || 1; });
  document.body.removeChild(probe);
  return H;
}

/* ---------- Render tabel status (form isian & baca-saja) ---------- */

/** Gambar lembar `form` dengan state `sel`.
      mode 'form'   → tombol bisa diklik (toggleWkStatus)
      mode 'detail' → span baca-saja (modal detail)
      mode 'cetak'  → span baca-saja, kelas cetak p-ok/p-warn/p-fail */
function wkTabel(form, sel, mode){
  const data = (WK_FORMS[form] ? WK_FORMS[form].data : []);
  const st = sel || {};
  const cetak = mode === 'cetak';
  const bisaKlik = mode === 'form';

  const selHtml = (s, k) => {
    if(cetak) return `<td style="text-align:center;"><span class="${s==='ok'?'p-ok':(s==='warn'?'p-warn':'p-fail')}">${wkSimbol(s)}</span></td>`;
    if(bisaKlik) return `<td><button class="status-btn ${s}" onclick="toggleWkStatus('${k}')">${wkSimbol(s)}</button></td>`;
    return `<td><span class="status-btn ${s}" style="cursor:default;">${wkSimbol(s)}</span></td>`;
  };

  // CETAK: isi tiap kolom SAMPAI PENUH setinggi halaman lalu lanjut ke kanan,
  // supaya seluruh lembar (bahkan CKG 3 yang 308 sel) muat SATU halaman A4
  // portrait. Pola bin-packing sama persis Daily Check Pengamatan (12e) yang
  // sudah teruji: hitung jumlah kolom seperlunya, lalu bagi rata tingginya.
  if(cetak){
    const H_KOLOM = 46;   // taksiran muatan satu kolom penuh (satuan "baris") A4 portrait
    const maxK = 7;
    const items = [];
    data.forEach(seksi=>{
      items.push({ w:1.6, judul:true,
        html:`<div style="font-weight:bold;font-size:7pt;margin:2px 0 1px;border-bottom:1px solid #000;">${escapeHtml(seksi.judul)}</div>` });
      seksi.blok.forEach((b, bi)=>{
        const headKols = b.kolom.map(k=>`<td>${escapeHtml(k)}</td>`).join('');
        const rows = b.baris.map((nama, ri)=>{
          const stats = b.kolom.map(kk=>selHtml(st[wkKunci(seksi.kode, bi, ri, kk)] || 'ok', '')).join('');
          return `<tr><td style="text-align:left;">${escapeHtml(nama)}</td>${stats}</tr>`;
        }).join('');
        const sub = b.judul ? `<div style="font-size:6pt;color:#333;margin:1px 0 0;line-height:1.1;">${escapeHtml(b.judul)}</div>` : '';
        items.push({ w:b.baris.length + 2, judul:false,
          html:`<div style="margin:0 0 2px;">${sub}<table style="width:100%;font-size:6.3pt;line-height:1.05;border-collapse:collapse;">
            <thead><tr class="p-kepala"><td>Item</td>${headKols}</tr></thead><tbody>${rows}</tbody></table></div>` });
      });
    });

    const total = items.reduce((s, it)=>s + it.w, 0);
    const N = Math.min(maxK, Math.max(1, Math.ceil(total / H_KOLOM)));

    // DASAR KOLOM RATA (permintaan user): ukur tinggi ASLI tiap blok di lebar
    // kolom cetak, lalu bagi ke N kolom dengan partisi min-max. Karena tinggi
    // yang dipakai nyata (bukan taksiran), kolom-kolomnya sama tinggi — dasarnya
    // sejajar walau ada nama yang membungkus dua baris. Lebar area cetak A4
    // portrait ≈ 718px (190mm @96dpi); dipakai hanya untuk MENGUKUR — proporsi
    // tingginya tetap benar berapa pun DPI printer sesungguhnya.
    const gap = 12;
    const colW = Math.max(90, Math.floor((718 - (N - 1) * gap) / N));
    const tinggi = wkUkurTinggi(items, colW);
    const bounds = wkPartisiSpread(tinggi, N);
    const cols = bounds.map(([a, b])=> items.slice(a, b).map(it=>it.html).join(''));
    while(cols.length < N) cols.push('');
    const cells = cols.map(html=>
      `<td style="border:none;vertical-align:top;width:${(100 / N).toFixed(2)}%;padding:0 ${gap/2}px;">${html}</td>`
    ).join('');
    return `<table class="pgm-print" style="table-layout:fixed;width:100%;border-collapse:collapse;"><tbody><tr>${cells}</tr></tbody></table>`;
  }

  // LAYAR (form isian & modal detail): kompak per-seksi.
  return data.map(seksi=>{
    const kepala = `<div class="pgm-seksi-judul">${escapeHtml(seksi.judul)}</div>`;
    const blok = seksi.blok.map((b, bi)=>{
      const headKols = b.kolom.map(k=>`<th>${escapeHtml(k)}</th>`).join('');
      const rows = b.baris.map((nama, ri)=>{
        const stats = b.kolom.map(kk=>{
          const k = wkKunci(seksi.kode, bi, ri, kk);
          return selHtml(st[k] || 'ok', k);
        }).join('');
        return `<tr><td class="name">${escapeHtml(nama)}</td>${stats}</tr>`;
      }).join('');
      const sub = b.judul ? `<div class="pgm-blok-judul">${escapeHtml(b.judul)}</div>` : '';
      return `<div class="pgm-blok">${sub}<table class="pgm">
        <thead><tr><th>Item</th>${headKols}</tr></thead><tbody>${rows}</tbody></table></div>`;
    }).join('');
    return `<div class="pgm-seksi">${kepala}<div class="pgm-cols">${blok}</div></div>`;
  }).join('');
}

function renderWkTable(){
  const wrap = document.getElementById('wkWrap');
  if(!wrap) return;
  wrap.innerHTML = wkTabel(wkForm, wkSel, 'form');
}

/* ---------- Teknisi (nama + baris dinamis) ---------- */

function renderWkTeknisi(){
  const wrap = document.getElementById('wkTeknisiList');
  if(!wrap) return;
  wrap.innerHTML = wkTeknisiRows.map((t,i)=>`
    <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;">
      <span style="font-family:var(--font-mono);color:var(--accent);font-size:12px;min-width:18px;">${i+1}.</span>
      <input type="text" value="${escapeHtml(t.nama)}" placeholder="${T('namaTeknisiPelaksana')} ${i+1}"
             list="teknisiDatalist"
             oninput="wkTeknisiRows[${i}].nama=this.value"
             style="flex:1;background:var(--panel-2);border:1px solid var(--line);color:var(--text);border-radius:6px;padding:9px 10px;font-size:16px;">
      ${wkTeknisiRows.length>1 ? `<button class="icon-btn" onclick="hapusWkTeknisi('${t.key}')">✕</button>` : ''}
    </div>`).join('');
}
function addWkTeknisi(){
  const isiAwal = wkTeknisiRows.length === 0 && userSaatIni ? (userSaatIni.nama || userSaatIni.username || '') : '';
  wkTeknisiRows.push({key:'w'+(wkTeknisiSeq++), nama: isiAwal});
  renderWkTeknisi();
}
function hapusWkTeknisi(key){ wkTeknisiRows = wkTeknisiRows.filter(x=>x.key!==key); renderWkTeknisi(); }

/* ---------- Modal (buka / tutup / simpan) ---------- */

function openWkModal(form){
  if(!WK_FORMS[form]) form = 'ckg3';
  wkForm = form;
  wkSel = wkInitSel(form);
  document.getElementById('wkModalJudul').textContent = WK_FORMS[form].judul;
  document.getElementById('wkTanggal').value = tanggalHariIni();
  document.getElementById('wkManagerNama').value = '';
  document.getElementById('wkManagerAkun').value = '';
  wkTeknisiRows = []; wkTeknisiSeq = 0; addWkTeknisi();
  if(!sigPads['sigWk']) setupSigCanvas('sigWk');
  resizeSigCanvas('sigWk'); clearSig('sigWk');
  // Pastikan tombol "✍ pakai TTD tersimpan" terpasang (idempoten) lalu langsung
  // pakai TTD tersimpan milik akun kalau ada — teknisi tinggal Bersihkan bila
  // mau tanda tangan baru.
  if(typeof pasangTombolTtdTersimpan === 'function') pasangTombolTtdTersimpan();
  if(typeof ttdTersimpanSaya !== 'undefined' && ttdTersimpanSaya && typeof pakaiTtdTersimpan === 'function'){
    pakaiTtdTersimpan('sigWk');
  }
  renderWkTable();
  document.getElementById('wkModalBg').classList.add('show');
  setTimeout(()=>resizeSigCanvas('sigWk'), 60);
}
function closeWkModal(){ document.getElementById('wkModalBg').classList.remove('show'); }

async function saveWk(){
  const btn = document.getElementById('wkSaveBtn'); btn.disabled = true;
  try{
    const state = { __format:'pgmweekly', __wForm:wkForm, sel:wkSel };
    const saved = await gsRun('addDsTest', {
      unit: unitAktif,
      kategori: 'pgmweekly',
      tanggal: document.getElementById('wkTanggal').value,
      state,
      teknisiNamaList: wkTeknisiRows.map(t=>(t.nama||'').trim()).filter(Boolean),
      teknisiTtd: getSigDataUrl('sigWk'),
      managerNama: document.getElementById('wkManagerNama').value.trim(),
      ttdUntuk: ttdUntukTerpilih('wkManagerAkun', document.getElementById('wkManagerNama').value)
    });
    dsList.unshift(mapDs(saved));
    renderWkList(wkForm);
    closeWkModal();
    toast('Weekly Check tersimpan.');
  }catch(e){ toast(T('gagalSimpan') + ' — ' + (e.message || T('coba'))); }
  btn.disabled = false;
}

/* ---------- Daftar riwayat (satu daftar per lembar) ---------- */

/** Catatan berformat weekly dengan lembar tertentu. */
const wkAdalah = (d, form) => !!(d && d.state && d.state.__format === 'pgmweekly' &&
                                 (!form || d.state.__wForm === form));

let wkTampilSemua = { ckg3:false, smrt1:false, smrt3:false };
function resetCariWk(form){
  wkTampilSemua[form] = true;
  const el = document.getElementById('cariWkTanggal-'+form); if(el) el.value = '';
  renderWkList(form);
}

function renderWkList(form){
  const wrap = document.getElementById('wkList-'+form);
  if(!wrap) return;
  const semua = (typeof dsList !== 'undefined' ? dsList : []).filter(d=>wkAdalah(d, form));
  const tgl = (document.getElementById('cariWkTanggal-'+form) || {}).value || '';
  const daftar = tgl ? semua.filter(d=>String(d.tanggal||'').slice(0,10) === tgl)
                     : (wkTampilSemua[form] ? semua : semua.filter(d=>dalamSeminggu(d.tanggal)));

  if(semua.length === 0){ wrap.innerHTML = '<div class="empty">Belum ada Weekly Check.</div>'; return; }
  if(daftar.length === 0){ wrap.innerHTML = '<div class="empty">' + T('takAdaHasil') + '</div>'; return; }

  wrap.innerHTML = daftar.map(d=>{
    const t = wkTemuan(form, (d.state && d.state.sel) || {});
    const jml = t.fails.length + t.warns.length;
    const tag = jml
      ? `<span class="tag fail">${t.fails.length} gangguan · ${t.warns.length} alarm</span>`
      : `<span class="tag ok">${T('semuaLolos')}</span>`;
    return `<div class="dc-history-item">
      <div><b>${escapeHtml(d.tanggal)}</b></div>
      ${tag}
      <div style="font-size:11.5px;color:var(--muted);">${T('teknisiPelaksana')}: ${escapeHtml(d.teknisiNama)||'-'}</div>
      ${diinputOlehHtml(d.diinputOleh, d.dibuatPada, String(d.tanggal||'').slice(0,10))}
      <div style="display:flex;gap:4px;">
        <button class="btn ghost" style="padding:6px 10px;" onclick="openWkDetail('${d.id}')">${T('detail')}</button>
        <button class="icon-btn" title="${T('cetak')}" onclick="printWk('${d.id}')">🖨</button>
        <button class="icon-btn hanya-admin" title="${T('hapus')}" onclick="hapusWk('${d.id}')">✕</button>
      </div>
    </div>`;
  }).join('');
}

/** Segarkan ketiga daftar sekaligus (dipanggil init/terapkanUnit). */
function renderSemuaWkList(){ WK_URUT.forEach(renderWkList); }

async function hapusWk(id){
  if(!adminAktif()){ toast(T('hanyaAdminHapus')); return; }
  const d = dsList.find(x=>x.id===id);
  if(!confirm(`${T('konfirmasiHapus')} ${d ? d.tanggal : ''}?`)) return;
  const form = (d && d.state && d.state.__wForm) || 'ckg3';
  const salinan = dsList.slice();
  dsList = dsList.filter(x=>x.id!==id);
  renderWkList(form);
  try{ await gsRun('deleteDsTest', id); }
  catch(e){ dsList = salinan; renderWkList(form); toast(T('gagalHapus') + ' — ' + (e.message||T('coba'))); }
}

/* ---------- Detail & cetak ---------- */

function openWkDetail(id){
  const d = dsList.find(x=>x.id===id);
  if(!d || !d.state) return;
  const form = d.state.__wForm || 'ckg3';
  const sel = d.state.sel || {};
  document.getElementById('formDetailJudul').textContent = WK_FORMS[form] ? WK_FORMS[form].judul : 'Weekly Check';
  document.getElementById('formDetailBody').innerHTML = `
    <div style="font-size:13px;line-height:1.7;margin-bottom:10px;"><b>${escapeHtml(d.tanggal)}</b></div>
    ${wkTabel(form, sel, 'detail')}
    <div class="detail-ttd">
      <div class="sig-block"><b>${T('teknisiPelaksana')}</b>${escapeHtml(d.teknisiNama)||'-'}${sigThumbHtml(d.teknisiTtd)}</div>
      <div class="sig-block"><b>${T('mengetahuiManager')}</b>${renderPihakKedua('dstest', d.id, d.managerNama, d.managerTtd)}${sigPejabatHtml('dstest', d.id, d.managerTtd, d)}</div>
    </div>
    <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line);">${diinputOlehHtml(d.diinputOleh, d.dibuatPada, String(d.tanggal||'').slice(0,10))}</div>`;
  document.getElementById('formDetailPrintBtn').onclick = ()=>{ closeFormDetail(); printWk(id); };
  document.getElementById('formDetailBg').classList.add('show');
}

function printWk(id){
  const d = dsList.find(x=>x.id===id);
  if(!d || !d.state) return;
  if(!tolakCetakBilaBelumTtd(d, 'dstest')) return;
  const form = d.state.__wForm || 'ckg3';
  const sel = d.state.sel || {};
  const judul = WK_FORMS[form] ? WK_FORMS[form].judul : 'WEEKLY CHECK';
  const legend = '<b>Ket :</b> ✓ Normal Operation &nbsp;&nbsp; ! Alarm / Perlu Pantau &nbsp;&nbsp; ✕ Alarm / Fault';
  doPrint(`
    <div style="text-align:center;font-weight:bold;font-size:12pt;margin-bottom:4px;">${escapeHtml(judul)}</div>
    <div style="text-align:center;font-size:9pt;margin-bottom:10px;">HARI/TANGGAL : ${escapeHtml(d.tanggal)}</div>
    ${wkTabel(form, sel, 'cetak')}
    <div style="font-size:8.5pt;margin-top:8px;">${legend}</div>
    <table class="no-border" style="font-size:9pt;margin-top:14px;">
      <tr>
        <td style="width:55%;text-align:left;vertical-align:top;">
          <div style="margin-bottom:6px;">PELAKSANA :</div>
          ${teknisiPrintBlock(d)}
        </td>
        <td style="text-align:center;vertical-align:top;">
          <div>Mengetahui,</div>
          <div style="margin-bottom:4px;">Manager Teknik</div>
          <div style="height:46px;">${ttdImg(d.managerTtd, 40)}</div>
          <div style="border-top:1px solid #000;display:inline-block;padding:0 24px;">${d.managerTtd ? (escapeHtml(d.managerNama)||'&nbsp;') : '&nbsp;'}</div>
        </td>
      </tr>
    </table>`, 'portrait');
}
