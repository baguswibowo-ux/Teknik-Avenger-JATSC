/* E-Logbook · js/12d-daily-check-amhs.js — Daily Check Fasilitas Otomasi (unit amhsadps)
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh.

   Tiga sub-sistem dalam satu shift: AMHS, AADPS, D-ATIS — dari workbook
   "AMHS/Ver_3.xlsx" (sheet AMHS, AADPS, D-ATIS). Bentuknya deretan blok
   pemeriksaan; tiap item dicek per shift Pagi/Siang/Malam (P/S/M):
     √  = kondisi normal      (status-btn ok)
     X  = kondisi tidak normal(status-btn fail)
     –  = belum/tidak dicek   (status-btn minus)
   Baris "lingkari" (Main/Standby, Primary/Secondary) memilih nomor unit aktif;
   baris "Nilai %/Suhu" diisi angka.

   CATATAN PENTING: modul ini BARU tampil (belum simpan ke server). Tombol
   Simpan/Cetak dan alur TTD Manager (pihak-kedua) menyusul setelah isi checklist
   difinalkan. Header dinas + TTD tiap dinas + TTD Manager Teknik dipakai bersama
   ketiga sub-sistem karena satu shift memeriksa ketiganya sekaligus. */

/* ---------- Pembangun baris ---------- */
const AmG = (label)=>({t:'grp',label});            // grup + checkable
const AmC = (label)=>({t:'chk',label});            // item status √/X
const AmO = (label,opt)=>({t:'opt',label,opt});    // lingkari pilihan
const AmV = (label,sat)=>({t:'val',label,sat:sat||'%'}); // isi nilai
const AmN = (label)=>({t:'note',label});           // catatan bebas
const amBlk = (nama,rows)=>({nama,rows});

/* ---------- Data 3 sheet ---------- */
const AMHS_SHEETS = {
AMHS:{judul:'AMHS ( AUTOMATIC MESSAGE HANDLING SYSTEM ) — INDRA AVITECH',blocks:[
  amBlk('Check Status Server MTA',[
    AmG('*WIII'),AmO('Main','1 / 2'),AmO('Standby','1 / 2'),
    AmG('*WAAA'),AmO('Main','3 / 4'),AmO('Standby','3 / 4'),
    AmG('*BACKUP'),AmO('Main','5 / 6'),AmO('Standby','5 / 6'),
  ]),
  amBlk('Check HDD Capacity MTA (Nilai %)',[
    AmG('Cluster WIII'),AmV('vgsys1-1vroot'),AmV('vgsys1-1vusr'),AmV('vgsys1-1vvar'),AmV('vgsys1-1vopt'),AmV('md90'),AmV('md30'),AmV('md31'),AmV('md32'),AmV('md33'),AmV('md34'),
    AmG('Cluster WAAA'),AmV('vgsys1-1vroot'),AmV('vgsys1-1vusr'),AmV('vgsys1-1vvar'),AmV('vgsys1-1vopt'),AmV('md90'),AmV('md30'),AmV('md31'),AmV('md32'),AmV('md33'),AmV('md34'),
    AmG('Cluster BACKUP'),AmV('vgsys1-1vroot'),AmV('vgsys1-1vusr'),AmV('vgsys1-1vvar'),AmV('vgsys1-1vopt'),AmV('md30'),AmV('md90'),AmV('md31'),AmV('md32'),AmV('md33'),AmV('md34'),
  ]),
  amBlk('Resources',[
    AmG('avi_mhs'),AmC('mhs_vip'),AmC('mhs_dsa'),AmC('mhs_pp'),
    AmG('avi_mhsds'),AmC('mhsds_vip'),AmC('mhsds_ldap'),
    AmG('avi_mhsdb'),AmC('mhsdb_vip'),AmC('mhsdb_avi0'),AmC('mhsdb_avi0_list'),
    AmG('avi_mhs_storage'),AmC('mhs_disks_u30'),AmC('mhs_fs_u30'),
    AmG('avi_mhsdb_storage'),AmC('mhsdb_disks_u31'),AmC('mhsdb_fs_u31'),AmC('mhsdb_disks_u32'),AmC('mhsdb_fs_u32'),AmC('mhsdb_disks_u33'),AmC('mhsdb_fs_u33'),AmC('mhsdb_disks_u34'),AmC('mhsdb_fs_u34'),
    AmG('avi_mhsds_storage'),AmC('mhsds_disks_u90'),AmC('mhs_fs_u90'),AmC('ipmi-fence-mhs1/3/5'),AmC('ipmi-fence-mhs2/4/6'),
    AmG('avi_mhsavs'),AmC('mhsavs_mom'),AmC('mhsavs_srv_sci'),AmC('mhsavs_srv_mcu'),AmC('mhsavs_srv_mtu'),AmC('mhsavs_srv_snw'),AmC('mhsavs_srv_amr'),
    AmG('avi_mhsswc'),AmC('mhsswc_amsi'),AmC('mhsswc_sfm'),AmC('mhsswc_amhs'),AmC('mhsswc_mos'),AmC('mhsswc_amhsrv'),AmC('mhsswc_stat'),
    AmN('Baculum - Error (Yesterday) :'),
  ]),
  amBlk('Line Status — WIII',[
    AmG('MTA'),AmC('MTA-WAAA-1'),AmC('MTA-WSSS-1'),AmC('MTA-YBBB-1'),
    AmG('TAS'),AmC('DGCA (4)'),AmC('FPL_CENTER_A (15)'),AmC('MEDAN (13)'),AmC('PALEMBANG (10)'),AmC('PEKANBARU (11)'),AmC('PONTIANAK (12)'),
    AmG('TCP'),AmC('A-SMGCS'),AmC('AIIS'),AmC('ATIS'),AmC('AWOS'),AmC('BASARNAS'),AmC('DUMMY1'),AmC('LOMAN'),AmC('TJ. PINANG'),AmC('TNI_AU'),
    AmG('UA LOCAL'),AmC('UA1 (DBM)'),AmC('UA2 (FDO)'),AmC('UA3 (FIC)'),AmC('UA4 (BMKG)'),AmC('UA5 (COMM/AMHS)'),AmC('UA6 (COMM/AMHS)'),AmC('UA7 (MANKOM)'),AmC('UA8'),AmC('UA9'),AmC('UA10 (ARO)'),AmC('UA11 (ARO)'),AmC('UA12 (PIA)'),
    AmG('Operator Supervisor'),AmC('TECH 1'),AmC('SMC TECH'),
    AmG('JMX -HEAP (NAGIOS) — Nilai %'),AmV('MCU-SRV'),AmV('MOM'),AmV('MTU-SRV'),AmV('SCI'),
    AmN('Service Critical :'),
  ]),
  amBlk('Line Status — WAAA',[
    AmG('MTA'),AmC('MTA-WIII-1'),AmC('MTA-YBBB-1'),
    AmG('TAS'),AmC('FPL_CENTER_B (1)'),
    AmG('TCP'),AmC('AMBON'),AmC('BALI'),AmC('BALIKPAPAN'),AmC('BANJARMASIN'),AmC('BIAK'),AmC('CHEETAH'),AmC('HADES'),AmC('JAYAPURA'),AmC('KENDARI'),AmC('KUPANG'),AmC('LOMAN'),AmC('MANADO'),AmC('MANOKWARI'),AmC('MERAUKE'),AmC('MINILAB'),AmC('PALANGKARAYA'),AmC('PALU'),AmC('SORONG'),AmC('SURABAYA'),AmC('TARAKAN'),AmC('TERNATE'),AmC('TIMIKA'),AmC('TOPSKY'),AmC('WAMENA'),AmC('YOGYAKARTA'),
  ]),
  amBlk('Check Periperal',[
    AmG('Periperal'),AmC('MHS Cluster 1'),AmC('MHS Cluster 2'),AmC('MHS Cluster 3'),
  ]),
  amBlk('Monitoring and Backup',[
    AmC('Aruba 24 Ports'),AmC('Tape'),AmC('Cisco Firepower'),AmC('Perle Terminal Server'),
  ]),
  amBlk('Check Suhu Ruangan',[
    AmV('MER','°C'),
  ]),
]},

AADPS:{judul:'AADPS ( AUTOMATED AERONAUTICAL DATA PROCESSING SYSTEM ) — INDRA AVITECH',blocks:[
  amBlk('Check Status Server AIP',[
    AmO('Main','1 / 2 / 3 / 4'),AmO('Standby','1 / 2 / 3 / 4'),
  ]),
  amBlk('Resources — AIP',[
    AmG('avi_aip'),AmC('aip_vip'),AmC('aip_arincapi'),AmC('aip_mysql'),AmC('aip_suite'),
    AmG('avi_aipds'),AmC('aipds_vip'),AmC('aipds_ldap'),
    AmG('avi_aip_storage'),AmC('aip_disks_u20'),AmC('sip_fs_u20'),
    AmG('avi_aipds_storage'),AmC('aip_disks_u91'),AmC('aip_fs_u91'),
    AmG('ipme-fence-aip1'),AmC('ipme-fence-aip2'),AmC('ipme-fence-aip3'),AmC('ipme-fence-aip4'),
    AmG('avi_aip_ng'),AmC('aip_nginx'),AmC('aip_mongo'),AmC('aip_pub_ccm'),AmC('aip_pub_pdf'),
  ]),
  amBlk('Check HDD Capacity — AIP (Nilai %)',[
    AmV('vgsys1-1vroot'),AmV('vgsys1-1vusr'),AmV('vgsys1-1vopt'),AmV('vgsys1-1vvar'),AmV('md91'),AmV('md20'),
  ]),
  amBlk('Check Status Server AIS',[
    AmO('Main','1 / 2'),AmO('Standby','1 / 2'),
  ]),
  amBlk('Resources — AIS',[
    AmG('avi_ais'),AmC('ais_vip'),AmC('ais_bgd'),AmC('ais_mom'),AmC('ais_srv'),AmC('ais_notif'),AmC('ais_oaq'),AmC('ais_snw'),AmC('ais_lcd'),
    AmG('avi_aisds'),AmC('aisds_vip'),AmC('aisds_ldap'),
    AmG('avi_ais_storage'),AmC('ais_disks_u10'),AmC('ais_fs_u10'),
    AmG('avi_aisds_storage'),AmC('ais_disks_u92'),AmC('ais_fs_u92'),AmC('ipme-fence-ais1'),AmC('ipme-fence-ais2'),
  ]),
  amBlk('Check HDD Capacity — AIS (Nilai %)',[
    AmV('vgsys1-1vroot'),AmV('vgsys1-1vusr'),AmV('vgsys1-1vvar'),AmV('vgsys1-1vopt'),AmV('md92'),AmV('md10'),
  ]),
  amBlk('Check Status Server ORA',[
    AmO('Main','1 / 2'),AmO('Standby','1 / 2'),
  ]),
  amBlk('Resources — ORA',[
    AmG('avi_aisdb'),AmC('aisdb_vip'),AmC('aisdb_avi2'),AmC('aisdb_avi2_list'),
    AmG('avi_aipdb'),AmC('aipdb_vip'),AmC('aipdb_avi1'),AmC('aipdb_avi1_list'),
    AmG('avi_aisdb_storage'),AmC('aisdb_disks_u11'),AmC('aisdb_fs_u11'),AmC('axldb_disks_u61'),AmC('axldb_fs_u61'),AmC('aisdb_disks_u12'),AmC('aisdb_fs_u12'),AmC('aisdb_disks_u13'),AmC('aisdb_fs_u13'),
    AmG('avi_aipdb_storage'),AmC('aipdb_disks_u21'),AmC('aipdb_fs_u21'),AmC('aipdb_disks_u22'),AmC('aipdb_fs_u22'),AmC('aipdb_disks_u23'),AmC('aipdb_fs_u23'),AmC('ipmi-fence-ora1'),AmC('ipmi-fence-ora2'),
  ]),
  amBlk('Check HDD Capacity — ORA (Nilai %)',[
    AmV('vgsys1-1vroot'),AmV('vgsys1-1vusr'),AmV('vgsys1-1vopt'),AmV('vgsys1-1vvar'),AmV('md11'),AmV('md21'),AmV('md61'),AmV('md22'),AmV('md12'),AmV('md23'),AmV('md13'),
  ]),
  amBlk('Check Status Server AXL',[
    AmO('Main','1 / 2'),AmO('Standby','1 / 2'),
  ]),
  amBlk('Resources — AXL',[
    AmG('avi_axl'),AmC('axl_vip'),AmC('axl_mom'),AmC('axl_srv'),
    AmG('avi_axl_storage'),AmC('axl_disks_u60'),AmC('axl_fs_u60'),AmC('ipmi-fence-axl1'),AmC('ipmi-fence-axl2'),
  ]),
  amBlk('Check HDD Capacity — AXL (Nilai %)',[
    AmV('vgsys1-1vroot'),AmV('vgsys1-1vusr'),AmV('vgsys1-1vvar'),AmV('vgsys1-1vopt'),AmV('md60'),
    AmN('Nagios - Service Critical :'),
    AmN('Baculum - Error (Yesterday) :'),
  ]),
  amBlk('Line Status — User Agent',[
    AmC('id-cgk-cmso1'),AmC('id-cgk-deo1'),AmC('id-cgk-deo2'),AmC('id-cgk-dvvo1'),AmC('id-cgk-dvvo2'),AmC('id-cgk-dvvo3'),AmC('id-cgk-admo1'),AmC('id-cgk-admo2'),AmC('id-cgk-apo1'),AmC('id-cgk-apo2'),AmC('id-cgk-apo3'),AmC('id-cgk-ac1'),AmC('id-cgk-ac2'),AmC('id-cgk-sa1'),AmC('id-cgk-sa2'),AmC('id-cgk-no1'),AmC('id-cgk-no2'),
  ]),
  amBlk('Check Suhu Ruangan',[
    AmV('MER','°C'),
  ]),
]},

'D-ATIS':{judul:'D-ATIS ( AERODROME TERMINAL INFORMATION SYSTEM ) — MERK DTN',blocks:[
  amBlk('*Check Status System D-ATIS',[
    AmO('Primary','1 / 2'),AmO('Secondary','1 / 2'),
  ]),
  amBlk('Check ATIS MetVoIP',[
    AmC('ATIS MePVoIP A'),AmC('ATIS MePVoIP B'),
  ]),
  amBlk('Check Atis Audio System',[
    AmC('Gateway'),
    AmG('Check Interfaces'),AmC('AMHS'),AmC('NTP'),AmC('SITA'),
    AmG('Check SITA'),AmC('Incoming'),AmC('Outgoing'),
  ]),
  amBlk('Check Jaringan Workstation (via Admin)',[
    AmG('Workstation'),AmC('WIIIIWS01'),
    AmG('Check Tools Variable'),AmC('AMHS'),AmC('Datalink SITA'),AmC('NTP3Time'),
    AmG('Check Tools Debug'),AmC('Output Data AMHS'),AmC('Output Data SITA'),AmC('Output Data D-ATIS'),
  ]),
  amBlk('Check Audio Monitor',[
    AmC('Audio Speaker ATIS'),AmC('Audio Speaker VOLMET'),
    AmC('Update Data ATIS/DATIS'),AmC('Update Data VOLMET/DVOLMET'),
    AmC('Monitor Alarm'),AmC('System Alarm Primary (Hot)'),AmC('System Alarm Secondary (Cold)'),
    AmN('Note jika terdapat Alarm :'),
  ]),
  amBlk('Check Suhu Ruangan',[
    AmV('Ruang ATIS','°C'),
  ]),
  amBlk('Check Kebersihan',[
    AmC('Server ATIS A'),AmC('Server ATIS B'),
  ]),
]},
};

/* ---------- Render sel ---------- */
const AMHS_SUB = ['AMHS','AADPS','D-ATIS'];
let dcAmhsBuilt = false;
let dcAmhsSubAktif = 'AMHS';

/* Tiap sel interaktif diberi kunci stabil `data-amk = sys|blok|baris|shift`
   (note tanpa shift) supaya bisa dikumpulkan saat simpan dan digambar ulang
   read-only saat detail/cetak. */
function amhsStatusCell(key){
  // default '–' (minus): belum dicek. Klik memutar – → √ → X → –
  return `<td style="padding:3px 4px;"><button type="button" class="status-btn minus" data-amk="${key}" onclick="amhsCycle(this)">–</button></td>`;
}
function amhsOptCell(key,opt){
  const parts = String(opt).split('/').map(s=>s.trim());
  const chips = parts.map(p=>
    `<button type="button" onclick="amhsPilihChip(this)" style="min-width:22px;height:24px;border-radius:12px;border:1px solid var(--line);background:var(--panel-2);color:var(--muted);cursor:pointer;font-size:11px;font-family:var(--font-mono);padding:0 6px;margin:0 1px;">${escapeHtml(p)}</button>`
  ).join('');
  return `<td style="padding:3px 4px;white-space:nowrap;"><span class="am-opt" data-amk="${key}">${chips}</span></td>`;
}
function amhsValCell(key,sat){
  return `<td style="padding:3px 4px;white-space:nowrap;"><input type="text" inputmode="decimal" data-amk="${key}" placeholder="–" style="width:48px;background:var(--panel-2);border:1px solid var(--line);color:var(--text);border-radius:5px;padding:4px 5px;font-size:12px;text-align:right;"><span style="color:var(--muted);font-size:10px;margin-left:3px;">${escapeHtml(sat)}</span></td>`;
}
function amhsRenderBlock(sys, b, bi){
  let rows = '';
  b.rows.forEach((r, ri)=>{
    if(r.t==='note'){
      rows += `<tr><td colspan="4" style="text-align:left;background:rgba(255,179,0,.05);">
        <div style="font-size:10.5px;color:var(--warn);font-family:var(--font-mono);margin-bottom:3px;">${escapeHtml(r.label)}</div>
        <input type="text" data-amk="${sys}|${bi}|${ri}" placeholder="tulis di sini…" style="width:100%;background:transparent;border:none;border-bottom:1px dashed var(--line);color:var(--text);font-size:12px;padding:3px 0;"></td></tr>`;
      return;
    }
    const k = sh => `${sys}|${bi}|${ri}|${sh}`;
    let c1,c2,c3;
    if(r.t==='opt'){ c1=amhsOptCell(k('P'),r.opt);c2=amhsOptCell(k('S'),r.opt);c3=amhsOptCell(k('M'),r.opt); }
    else if(r.t==='val'){ c1=amhsValCell(k('P'),r.sat);c2=amhsValCell(k('S'),r.sat);c3=amhsValCell(k('M'),r.sat); }
    else { c1=amhsStatusCell(k('P'));c2=amhsStatusCell(k('S'));c3=amhsStatusCell(k('M')); }
    const namaGaya = r.t==='grp'
      ? 'text-align:left;background:rgba(41,182,246,.08);color:var(--accent);font-weight:700;font-family:var(--font-mono);font-size:11.5px;white-space:nowrap;'
      : 'text-align:left;font-family:var(--font-mono);font-size:11.5px;white-space:nowrap;';
    rows += `<tr><td style="${namaGaya}">${escapeHtml(r.label)}</td>${c1}${c2}${c3}</tr>`;
  });
  return `<div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:hidden;">
    <div style="padding:9px 12px;font-family:var(--font-mono);font-size:12px;background:var(--panel-2);border-bottom:1px solid var(--line);">${escapeHtml(b.nama)}</div>
    <div style="overflow-x:auto;"><table class="dc ds" style="min-width:0;">
      <thead><tr><th style="text-align:left;">Item</th><th style="width:44px;">P</th><th style="width:44px;">S</th><th style="width:44px;">M</th></tr></thead>
      <tbody>${rows}</tbody></table></div></div>`;
}

function amhsCycle(btn){
  if(btn.classList.contains('minus')){ btn.classList.remove('minus'); btn.classList.add('ok'); btn.textContent='√'; }
  else if(btn.classList.contains('ok')){ btn.classList.remove('ok'); btn.classList.add('fail'); btn.textContent='✕'; }
  else { btn.classList.remove('fail'); btn.classList.add('minus'); btn.textContent='–'; }
}
function amhsChipMati(b){ b.style.background='var(--panel-2)'; b.style.color='var(--muted)'; b.style.borderColor='var(--line)'; b.style.fontWeight='400'; b.removeAttribute('data-on'); }
function amhsChipHidup(b){ b.style.background='var(--accent)'; b.style.color='var(--accent-teks)'; b.style.borderColor='var(--accent)'; b.style.fontWeight='700'; b.setAttribute('data-on','1'); }
function amhsPilihChip(chip){
  const wrap = chip.parentElement;             // span.am-opt
  const sudah = chip.getAttribute('data-on') === '1';
  wrap.querySelectorAll('button').forEach(amhsChipMati);
  if(!sudah) amhsChipHidup(chip);              // klik ulang = batalkan pilihan
}

/* ---------- Kunci sistem & papan tanda tangan ----------
   TTD sekarang MILIK TIAP SISTEM: tiap sub-tab (AMHS/AADPS/D-ATIS) disimpan
   sebagai catatan tersendiri, punya TTD 3 dinas + Manager Teknik sendiri.
   Nama petugas dinas dipakai bersama (satu shift, orang yang sama). */
const AMHS_KEY = { 'AMHS':'amhs', 'AADPS':'aadps', 'D-ATIS':'datis' };
// TTD dinas saja (Pagi/Siang/Malam) — orangnya beda tiap dinas. TTD Manager
// Teknik TIDAK di aplikasi: lembar dicetak lalu diserahkan & ditandatangani
// manual oleh dinas malam ke Manager Teknik.
const amhsPadIds = () => AMHS_SUB.flatMap(s => ['pagi','siang','malam'].map(g => `sigAmhs_${AMHS_KEY[s]}_${g}`));
/** id → sistem yang sedang disunting (null = catatan baru). Per sistem. */
const dcAmhsEditId = { amhs:null, aadps:null, datis:null };

/* Snapshot saat sebuah catatan DIMUAT untuk disunting — dipakai menghitung
   "penginput per dinas": kita hanya menetapkan akun yang login SEKARANG pada
   dinas yang benar-benar berubah/ditambah oleh sunting ini, dinas lain tetap
   memakai penginput lamanya. Per sistem. { pin:{...}, nama:{pagi,siang,malam} } */
const dcAmhsMuat = { amhs:null, aadps:null, datis:null };

/* Daftar petugas per dinas — dinamis (tambah sesuai kebutuhan lewat "+ Nama").
   Dipakai bersama ketiga sistem. Baris pertama tiap dinas otomatis terisi nama
   akun yang sedang login (dialah yang berdinas & mengisi). */
const AMHS_DINAS = { pagi:[], siang:[], malam:[] };  // {key, nama}
let amhsTeknisiSeq = 0;

/** Header kolom dinas + tombol "+ Nama" + wadah daftar (diisi renderAmhsDinasList). */
function amhsDinasNamaKolom(judul, grup){
  return `<div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px;">
      <span style="font-family:var(--font-mono);font-size:10.5px;letter-spacing:.08em;color:var(--muted);text-transform:uppercase;">${escapeHtml(judul)}</span>
      <button class="btn ghost" style="padding:5px 10px;" onclick="addAmhsTeknisi('${grup}')">+ Nama</button>
    </div>
    <div id="amhsDinasList_${grup}"></div>
  </div>`;
}

function renderAmhsDinasList(grup){
  const wrap = document.getElementById('amhsDinasList_' + grup);
  if(!wrap) return;
  const rows = AMHS_DINAS[grup] || [];
  wrap.innerHTML = rows.length ? rows.map((t,i)=>`
    <div style="display:flex;gap:6px;align-items:center;margin-bottom:5px;">
      <span style="font-family:var(--font-mono);color:var(--accent);min-width:16px;font-size:11px;">${i+1}</span>
      <input type="text" data-amdinas="${grup}" list="teknisiDatalist" value="${escapeHtml(t.nama)}"
             placeholder="Nama teknisi ${i+1}" oninput="amhsSetTeknisi('${grup}','${t.key}',this.value)"
             style="flex:1;background:var(--panel-2);border:1px solid var(--line);color:var(--text);border-radius:6px;padding:6px 8px;font-size:12.5px;">
      <button class="icon-btn" title="Hapus" onclick="hapusAmhsTeknisi('${grup}','${t.key}')">✕</button>
    </div>`).join('')
    : `<div style="font-size:11px;color:var(--muted);font-style:italic;">Belum ada — klik <b>+ Nama</b>.</div>`;
}
function addAmhsTeknisi(grup){
  // Baris pertama pra-isi dengan akun yang sedang login (dia yang berdinas).
  const kosong = (AMHS_DINAS[grup] || []).length === 0;
  const isiAwal = kosong && typeof userSaatIni !== 'undefined' && userSaatIni ? (userSaatIni.nama || userSaatIni.username || '') : '';
  AMHS_DINAS[grup].push({ key: 'd' + (amhsTeknisiSeq++), nama: isiAwal });
  renderAmhsDinasList(grup);
  amhsPerbaruiManagerVisibility();
}
function hapusAmhsTeknisi(grup, key){
  AMHS_DINAS[grup] = (AMHS_DINAS[grup] || []).filter(x => x.key !== key);
  renderAmhsDinasList(grup);
  amhsPerbaruiManagerVisibility();
}
function amhsSetTeknisi(grup, key, v){
  const t = (AMHS_DINAS[grup] || []).find(x => x.key === key);
  if(t) t.nama = v;
  if(grup === 'malam') amhsPerbaruiManagerVisibility();
}

/** Blok Manager Teknik (nama + kirim TTD ke akun) hanya muncul saat DINAS MALAM
    sudah terisi — dialah yang menyerahkan ke Manager. Sebelum itu disembunyikan. */
function amhsPerbaruiManagerVisibility(){
  const adaMalam = (AMHS_DINAS.malam || []).some(t => (t.nama || '').trim());
  document.querySelectorAll('#dcAmhsWrap .amhs-mgr-wrap').forEach(el=>{ el.style.display = adaMalam ? '' : 'none'; });
}

/** Satu papan TTD (kanvas native) + label. */
function amhsSigPad(sigId, label, hint){
  return `<div class="field" style="margin-top:8px;"><label>${escapeHtml(label)}</label>
    <div class="sig-wrap"><canvas id="${sigId}"></canvas>
      <div class="sig-toolbar"><span class="sig-hint">${escapeHtml(hint)}</span>
      <button class="sig-clear" onclick="clearSig('${sigId}')">bersihkan</button></div></div></div>`;
}

/** Blok TTD dinas (Pagi/Siang/Malam — orang berbeda) + tombol milik SATU sistem.
    Tanpa TTD Manager Teknik: lembar diserahkan & ditandatangani manual ke
    Manager Teknik oleh dinas malam. */
function amhsBlokTtd(sys){
  const k = AMHS_KEY[sys];
  return `<div class="card" style="margin-top:16px;">
    <div style="font-family:var(--font-mono);font-size:10.5px;letter-spacing:.08em;color:var(--accent);text-transform:uppercase;margin-bottom:4px;">Tanda Tangan Dinas &amp; Simpan — ${escapeHtml(sys)}</div>
    <div class="subtle-note" style="margin-bottom:10px;">Tiap dinas menandatangani kolomnya sendiri lalu <b>Simpan</b>. Dinas berikutnya membuka lagi lewat <b>Riwayat → Edit</b> untuk melanjutkan. <b>Dinas malam</b> mengisi nama Manager Teknik &amp; kirim TTD ke akunnya (Manager menyetujui lewat kotak masuk), lalu mencetak &amp; menyerahkan.</div>
    <div class="grid3">
      ${amhsSigPad(`sigAmhs_${k}_pagi`,  'TTD Dinas Pagi',  'tanda tangan dinas pagi')}
      ${amhsSigPad(`sigAmhs_${k}_siang`, 'TTD Dinas Siang', 'tanda tangan dinas siang')}
      ${amhsSigPad(`sigAmhs_${k}_malam`, 'TTD Dinas Malam', 'tanda tangan dinas malam')}
    </div>
    <div class="amhs-mgr-wrap" id="amhsMgr_${k}" style="display:none;margin-top:12px;">
      <div class="subtle-note" style="margin-bottom:8px;color:var(--accent);">Dinas malam — isi Manager Teknik lalu Simpan untuk mengirim TTD ke kotak masuknya:</div>
      <div class="grid2">
        <div class="field"><label>Manager Teknik (Nama)</label>
          <input type="text" id="dcAmhsMgr_${k}" list="pejabatDatalist" placeholder="Nama manager teknik"></div>
        <div class="field"><label>Kirim TTD ke akun</label>
          <select id="dcAmhsAkun_${k}"><option value="">Otomatis (dari nama di atas)</option></select></div>
      </div>
    </div>
    <div class="modal-footer" style="margin-top:12px;">
      <button class="btn ghost" id="dcAmhsBatal_${k}" style="display:none;" onclick="batalEditDcAmhs('${sys}')">✕ Batal Edit</button>
      <button class="btn ghost" onclick="resetDcAmhsSistem('${sys}')">Reset ${escapeHtml(sys)}</button>
      <button class="btn ghost" onclick="printCurrentDcAmhsSistem('${sys}')">🖨 Cetak ${escapeHtml(sys)}</button>
      <button class="btn btn-tambah" id="dcAmhsSaveBtn_${k}" onclick="saveDcAmhsSistem('${sys}')">💾 Simpan ${escapeHtml(sys)}</button>
    </div>
  </div>`;
}

/* ---------- Bangun seluruh form sekali ---------- */
function bangunDcAmhs(){
  const wrap = document.getElementById('dcAmhsWrap');
  if(!wrap) return;

  const subtabBtn = AMHS_SUB.map((n,i)=>
    `<button type="button" class="subtab-btn${i===0?' active':''}" data-amhs-sub="${n}" onclick="pindahDcAmhsSub('${n}')">${escapeHtml(n)}</button>`
  ).join('');

  const subviews = AMHS_SUB.map((n,i)=>{
    const s = AMHS_SHEETS[n];
    return `<div class="amhs-subview" data-amhs-view="${n}" style="display:${i===0?'block':'none'};">
      <div style="font-family:var(--font-mono);font-size:12px;color:var(--accent);letter-spacing:.04em;border:1px dashed var(--accent-dim);border-radius:8px;padding:8px 12px;margin-bottom:14px;background:rgba(41,182,246,.06);">${escapeHtml(s.judul)}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px;align-items:start;">
        ${s.blocks.map((b,bi)=>amhsRenderBlock(n,b,bi)).join('')}
      </div>
      <div class="field" style="margin-top:14px;"><label>Catatan ${escapeHtml(n)}</label><textarea data-amcat="${n}" placeholder="Catatan ${escapeHtml(n)}…"></textarea></div>
      ${amhsBlokTtd(n)}
    </div>`;
  }).join('');

  wrap.innerHTML = `
    <div class="card">
      <div class="grid3">
        <div class="field"><label>Hari / Tanggal</label><input type="date" id="dcAmhsTanggal"></div>
        <div class="field"><label>Jam Pengecekan (UTC)</label>
          <div style="display:flex;gap:8px;">
            <div style="flex:1;"><div style="font-family:var(--font-mono);font-size:10px;color:var(--muted);margin-bottom:3px;text-align:center;">PAGI</div><input type="time" id="dcAmhsJamP"></div>
            <div style="flex:1;"><div style="font-family:var(--font-mono);font-size:10px;color:var(--muted);margin-bottom:3px;text-align:center;">SIANG</div><input type="time" id="dcAmhsJamS"></div>
            <div style="flex:1;"><div style="font-family:var(--font-mono);font-size:10px;color:var(--muted);margin-bottom:3px;text-align:center;">MALAM</div><input type="time" id="dcAmhsJamM"></div>
          </div></div>
        <div class="field"><label>Fasilitas</label><input type="text" value="AMHS · AADPS · D-ATIS" readonly style="color:var(--muted);"></div>
      </div>
      <div style="font-family:var(--font-mono);font-size:10.5px;letter-spacing:.08em;color:var(--muted);text-transform:uppercase;margin:6px 0 10px;">Petugas Dinas <span style="text-transform:none;color:var(--muted);">— dipakai bersama ketiga sistem</span></div>
      <div class="grid3">
        ${amhsDinasNamaKolom('Dinas Pagi','pagi')}
        ${amhsDinasNamaKolom('Dinas Siang','siang')}
        ${amhsDinasNamaKolom('Dinas Malam','malam')}
      </div>
    </div>

    <div class="legend" style="margin:16px 0;">
      <span><i class="dot" style="background:var(--ok)"></i> √ Normal</span>
      <span><i class="dot" style="background:var(--fail)"></i> ✕ Tidak Normal</span>
      <span><i class="dot" style="background:var(--muted)"></i> – Belum dicek</span>
      <span style="color:var(--muted);">Tiap sistem (AMHS/AADPS/D-ATIS) diisi, ditandatangani, dan disimpan sendiri-sendiri.</span>
    </div>

    <nav class="subtabs">${subtabBtn}</nav>
    <div id="dcAmhsSubviews">${subviews}</div>`;

  // Daftar petugas dinas (dinamis) — render awal (kosong; "+ Nama" untuk isi).
  ['pagi','siang','malam'].forEach(renderAmhsDinasList);
  amhsPerbaruiManagerVisibility();   // blok Manager tersembunyi sampai dinas malam terisi
  // Papan tanda tangan native — 3 dinas per sistem (9 pad).
  amhsPadIds().forEach(id=>{ if(!sigPads[id]) setupSigCanvas(id); });
  // Pasang tombol "pakai TTD tersimpan" ke pad-pad baru ini. Fungsi itu jalan
  // sekali di init sebelum pad AMHS ada, jadi harus dipanggil ulang (idempoten).
  if(typeof pasangTombolTtdTersimpan === 'function') pasangTombolTtdTersimpan();
  dcAmhsBuilt = true;
}

function pindahDcAmhsSub(nama){
  dcAmhsSubAktif = nama;
  const wrap = document.getElementById('dcAmhsWrap');
  if(!wrap) return;
  wrap.querySelectorAll('.subtab-btn[data-amhs-sub]').forEach(b=>b.classList.toggle('active', b.dataset.amhsSub===nama));
  wrap.querySelectorAll('.amhs-subview').forEach(v=>{ v.style.display = (v.dataset.amhsView===nama) ? 'block' : 'none'; });
  setTimeout(()=>{ if(typeof resizeAllVisibleSigPads==='function') resizeAllVisibleSigPads(); }, 30);
}

/** Dipanggil 07-unit.js saat unit amhsadps aktif: bangun sekali, lalu ukur pad. */
function pastikanDcAmhs(){
  if(!dcAmhsBuilt){
    bangunDcAmhs();
    // Isi pilihan akun TTD manager (select baru ini belum ada saat load awal).
    if(typeof isiPilihanPejabat === 'function') isiPilihanPejabat();
  }
  const t = document.getElementById('dcAmhsTanggal');
  if(t && !t.value && typeof tanggalHariIni==='function') t.value = tanggalHariIni();
  setTimeout(()=>{ amhsPadIds().forEach(id=>{ if(typeof resizeSigCanvas==='function') resizeSigCanvas(id); }); }, 40);
}

/* ================= SIMPAN / RESET ================= */
const dcAmhsAktif = () => (typeof unitAktif !== 'undefined') && unitAktif === 'amhsadps';
const amVal = id => (document.getElementById(id)?.value || '').trim();

/** Officer (pejabat) hanya melihat & menandatangani — tidak menyunting. */
const amhsOfficer = () => typeof pejabatAktif === 'function' && pejabatAktif();
/** Boleh menyunting catatan AMHS? Tidak, kalau sudah di-TTD Manager atau Officer. */
function amhsBolehEdit(r){
  if(r && r.managerTtd) return false;   // terkunci setelah TTD Manager Teknik
  if(amhsOfficer()) return false;       // Officer view-only
  return true;
}

/** Sel checklist SATU sistem (kunci diawali `${sys}|`). status ok/fail saja
    (minus/– default tak disimpan); opt = teks chip; val/note = isi teks. */
function kumpulDcAmhsSel(sys){
  const wrap = document.getElementById('dcAmhsWrap');
  const sel = {};
  if(!wrap) return sel;
  const pfx = sys + '|';
  wrap.querySelectorAll('[data-amk]').forEach(el=>{
    const k = el.getAttribute('data-amk');
    if(k.indexOf(pfx) !== 0) return;
    if(el.classList.contains('status-btn')){
      const v = el.classList.contains('ok') ? 'ok' : el.classList.contains('fail') ? 'fail' : '';
      if(v) sel[k] = v;
    }else if(el.classList.contains('am-opt')){
      const on = el.querySelector('[data-on="1"]');
      if(on) sel[k] = on.textContent.trim();
    }else if(el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'){
      const v = el.value.trim();
      if(v) sel[k] = v;
    }
  });
  return sel;
}

/** Nama petugas dinas (dipakai bersama ketiga sistem) dari state daftar dinamis. */
function bacaDinasNama(){
  const ambil = g => (AMHS_DINAS[g] || []).map(t => (t.nama || '').trim()).filter(Boolean);
  return { pagi: ambil('pagi'), siang: ambil('siang'), malam: ambil('malam') };
}

/** Penginput per dinas. Aturan: dinas yang isinya BERUBAH/ditambah oleh sunting
    ini dicap ke akun yang login sekarang; dinas yang tak tersentuh memakai
    penginput lamanya (dari snapshot saat dimuat). Catatan baru: semua dinas
    berisi otomatis milik pembuatnya. Hasil: {pagi,siang,malam} → {oleh,nama,pada}. */
function hitungPenginputDinas(sys, dinasBaru, editId){
  const u = (typeof userSaatIni !== 'undefined' && userSaatIni) ? userSaatIni : null;
  const nama = u ? (u.nama || u.username || '') : '';
  const oleh = u ? (u.username || '') : '';
  const pada = new Date().toISOString();
  const k = AMHS_KEY[sys];
  const muat = editId ? (dcAmhsMuat[k] || { pin:{}, nama:{} }) : { pin:{}, nama:{} };
  const pinLama = muat.pin || {}, namaLama = muat.nama || {};
  const hasil = {};
  ['pagi','siang','malam'].forEach(g=>{
    const baru = (dinasBaru && dinasBaru[g]) || [];
    const lama = namaLama[g] || [];
    const adaIsi  = baru.some(n => String(n||'').trim());
    const berubah = JSON.stringify(baru) !== JSON.stringify(lama);
    if(!adaIsi){ if(pinLama[g] && !berubah) hasil[g] = pinLama[g]; return; }  // dinas kosong: pertahankan lama bila tak diubah
    hasil[g] = (berubah || !pinLama[g]) ? { oleh, nama, pada } : pinLama[g];
  });
  return hasil;
}

/** State satu sistem untuk disimpan / dicetak. */
function bacaDcAmhsSistem(sys){
  const k = AMHS_KEY[sys];
  const dinas = bacaDinasNama();
  const catEl = document.querySelector(`#dcAmhsWrap [data-amcat="${sys}"]`);
  const state = {
    __format: 'amhs', __sistem: sys,
    jam: { p: amVal('dcAmhsJamP'), s: amVal('dcAmhsJamS'), m: amVal('dcAmhsJamM') },
    dinas,
    dinasTtd: {
      pagi:  getSigDataUrl(`sigAmhs_${k}_pagi`),
      siang: getSigDataUrl(`sigAmhs_${k}_siang`),
      malam: getSigDataUrl(`sigAmhs_${k}_malam`)
    },
    catatan: (catEl && catEl.value.trim()) ? { [sys]: catEl.value.trim() } : {},
    sel: kumpulDcAmhsSel(sys)
  };
  return { state, dinas };
}

/** Kosongkan isian + TTD SATU sistem (tanggal/jam/nama dinas bersama dibiarkan). */
function resetDcAmhsSistem(sys){
  const wrap = document.getElementById('dcAmhsWrap'); if(!wrap) return;
  const k = AMHS_KEY[sys], pfx = sys + '|';
  wrap.querySelectorAll('[data-amk]').forEach(el=>{
    if(el.getAttribute('data-amk').indexOf(pfx) !== 0) return;
    if(el.classList.contains('status-btn')){ el.classList.remove('ok','fail'); el.classList.add('minus'); el.textContent='–'; }
    else if(el.classList.contains('am-opt')){ el.querySelectorAll('button').forEach(amhsChipMati); }
    else if(el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'){ el.value=''; }
  });
  const cat = wrap.querySelector(`[data-amcat="${sys}"]`); if(cat) cat.value='';
  const mgr = document.getElementById(`dcAmhsMgr_${k}`);  if(mgr) mgr.value='';
  const akun = document.getElementById(`dcAmhsAkun_${k}`); if(akun) akun.value='';
  ['pagi','siang','malam'].forEach(g=>{ if(typeof clearSig==='function') clearSig(`sigAmhs_${k}_${g}`); });
}

/** Keluar dari mode sunting satu sistem, kembalikan tombol & kosongkan. */
function batalEditDcAmhs(sys){
  const k = AMHS_KEY[sys];
  dcAmhsEditId[k] = null;
  dcAmhsMuat[k] = null;
  const btn = document.getElementById(`dcAmhsSaveBtn_${k}`); if(btn) btn.innerHTML = `💾 Simpan ${escapeHtml(sys)}`;
  const bat = document.getElementById(`dcAmhsBatal_${k}`); if(bat) bat.style.display = 'none';
  resetDcAmhsSistem(sys);
}

async function saveDcAmhsSistem(sys){
  const tglIso = amVal('dcAmhsTanggal');
  if(!tglIso){ toast('Hari / Tanggal belum diisi.'); return; }
  const k = AMHS_KEY[sys];
  const { state, dinas } = bacaDcAmhsSistem(sys);
  if(Object.keys(state.sel).length === 0){ toast(`${sys}: belum ada isian untuk disimpan.`); return; }
  const teknisiNamaList = [...dinas.pagi, ...dinas.siang, ...dinas.malam];
  const fails = Object.entries(state.sel).filter(([,v]) => v==='fail').map(([kk]) => amhsLabelDariKunci(kk));
  const tanggal = (typeof tanggalPanjang === 'function') ? tanggalPanjang(new Date(tglIso + 'T00:00:00Z')) : tglIso;
  const editId = dcAmhsEditId[k];

  // Penginput per dinas: akun yang login sekarang dicap ke dinas yang dia
  // ubah/isi barusan; dinas lain memakai penginput lamanya. Disimpan di
  // state.dinasInput (detail) + diringkas di remark.pin (kartu riwayat ringan).
  const penginput = hitungPenginputDinas(sys, dinas, editId);
  state.dinasInput = penginput;

  const btn = document.getElementById(`dcAmhsSaveBtn_${k}`); if(btn) btn.disabled = true;
  toast(editId ? `Menyimpan perubahan ${sys}...` : `Menyimpan daily check ${sys}...`);
  try{
    const payload = {
      // Sistem disimpan di kolom `dinas` (ringkasan riwayat) sekaligus di
      // state.__sistem (dipakai detail/cetak). Tanpa TTD Manager (manual di kertas).
      // Nama per-dinas ditaruh ringkas di `remark` (JSON) supaya daftar riwayat
      // bisa menampilkan P/S/M + penginputnya tanpa mengambil state penuh (TTD besar).
      tanggal, tanggalIso: tglIso, dinas: sys, suhu:'',
      remark: JSON.stringify({ p: dinas.pagi, s: dinas.siang, m: dinas.malam, pin: penginput }),
      teknisiNamaList, teknisiNama: teknisiNamaList.join(', '),
      // TTD "utama" = dinas paling akhir yang menandatangani (buat ringkasan).
      teknisiTtd: getSigDataUrl(`sigAmhs_${k}_malam`) || getSigDataUrl(`sigAmhs_${k}_siang`) || getSigDataUrl(`sigAmhs_${k}_pagi`),
      // Manager Teknik: nama + akun tujuan approval (kotak masuk pihak-kedua).
      // Diisi dinas malam. TTD-nya sendiri dibubuhkan Manager dari akunnya.
      managerNama: amVal(`dcAmhsMgr_${k}`),
      ttdUntuk: (typeof ttdUntukTerpilih === 'function') ? ttdUntukTerpilih(`dcAmhsAkun_${k}`, amVal(`dcAmhsMgr_${k}`)) : '',
      state, fails, warns: [], unit: unitAktif
    };
    if(editId){
      const saved = await gsRun('updateDailyCheck', editId, payload);
      const i = dcHistory.findIndex(x=>x.id===editId); if(i!==-1) dcHistory[i] = mapDc(saved);
      renderDcHistory();
      toast(`Perubahan ${sys} tersimpan.`);
      batalEditDcAmhs(sys);
    }else{
      const saved = await gsRun('addDailyCheck', payload);
      dcHistory.unshift(mapDc(saved));
      renderDcHistory();
      toast(`Daily check ${sys} tersimpan. Dinas berikutnya lanjut lewat Riwayat → Edit.`);
      resetDcAmhsSistem(sys);
    }
  }catch(e){ toast('Gagal menyimpan — ' + (e.message || 'coba lagi.')); }
  if(btn) btn.disabled = false;
}

/* ---------- Muat catatan tersimpan ke form untuk dilanjutkan dinas berikutnya ---------- */
/** Gambar TTD tersimpan (data URL) ke kanvas pad supaya tetap ada saat disimpan
    ulang dinas berikutnya, dan terlihat sudah ditandatangani. */
function amhsMuatTtd(padId, url){
  if(!url) return;
  const s = sigPads[padId]; if(!s) return;
  if(typeof resizeSigCanvas === 'function') resizeSigCanvas(padId);
  const rect = s.canvas.getBoundingClientRect();
  if(!rect.width){ setTimeout(()=>amhsMuatTtd(padId, url), 90); return; }  // pad masih tersembunyi
  const img = new Image();
  img.onload = ()=>{ try{ s.ctx.drawImage(img, 0, 0, rect.width, rect.height); s.empty = false; }catch(_){} };
  img.src = url;
}

function amhsIsiDinasNama(dinas){
  ['pagi','siang','malam'].forEach(g=>{
    const arr = (dinas && dinas[g]) || [];
    AMHS_DINAS[g] = arr.map(n => ({ key: 'd' + (amhsTeknisiSeq++), nama: n }));
    renderAmhsDinasList(g);
  });
  amhsPerbaruiManagerVisibility();
}

function amhsIsiSelKeForm(sel, sys){
  const wrap = document.getElementById('dcAmhsWrap'); if(!wrap) return;
  const pfx = sys + '|';
  Object.entries(sel || {}).forEach(([kk, v])=>{
    if(kk.indexOf(pfx) !== 0) return;
    const el = wrap.querySelector(`[data-amk="${kk}"]`);
    if(!el) return;
    if(el.classList.contains('status-btn')){
      el.classList.remove('ok','fail','minus');
      el.classList.add(v==='fail' ? 'fail' : v==='ok' ? 'ok' : 'minus');
      el.textContent = v==='fail' ? '✕' : v==='ok' ? '√' : '–';
    }else if(el.classList.contains('am-opt')){
      el.querySelectorAll('button').forEach(amhsChipMati);
      const b = [...el.querySelectorAll('button')].find(x=>x.textContent.trim() === String(v));
      if(b) amhsChipHidup(b);
    }else if(el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'){
      el.value = v;
    }
  });
}

/** Buka catatan tersimpan untuk dilanjutkan/disunting dinas berikutnya. */
async function openEditDcAmhs(id){
  const r = dcHistory.find(x=>x.id===id);
  if(!r){ toast('Catatan tidak ditemukan.'); return; }
  if(!amhsBolehEdit(r)){
    toast(r.managerTtd ? 'Sudah ditandatangani Manager Teknik — tidak bisa disunting.'
                       : 'Officer hanya bisa melihat & menandatangani, tidak menyunting.');
    return;
  }
  toast('Memuat catatan...');
  let detail = {};
  try{ detail = await gsRun('getDailyCheckDetail', id) || {}; }
  catch(e){ toast('Gagal memuat — ' + (e.message||'coba lagi.')); return; }
  const state = detail.state || {};
  const sys = state.__sistem || r.dinas || 'AMHS';
  const k = AMHS_KEY[sys];

  // Snapshot penginput + nama per dinas SAAT DIMUAT — jadi acuan hitungPenginputDinas
  // menetapkan dinas mana yang benar-benar diubah sunting ini.
  const dinasMuat = state.dinas || {};
  dcAmhsMuat[k] = {
    pin: state.dinasInput || {},
    nama: { pagi: dinasMuat.pagi || [], siang: dinasMuat.siang || [], malam: dinasMuat.malam || [] }
  };

  pindahDcAmhsSub(sys);
  resetDcAmhsSistem(sys);

  // Header bersama
  const tgl = document.getElementById('dcAmhsTanggal'); if(tgl) tgl.value = r.tanggalIso || '';
  const jam = state.jam || {};
  ['P','S','M'].forEach(x=>{ const el=document.getElementById('dcAmhsJam'+x); if(el) el.value = (jam[x.toLowerCase()]||''); });
  amhsIsiDinasNama(state.dinas || {});

  // Isian sistem + catatan
  amhsIsiSelKeForm(state.sel || {}, sys);
  const catEl = document.querySelector(`#dcAmhsWrap [data-amcat="${sys}"]`);
  if(catEl) catEl.value = (state.catatan || {})[sys] || '';
  const mgrEl = document.getElementById(`dcAmhsMgr_${k}`);
  if(mgrEl) mgrEl.value = r.managerNama || '';   // akun tujuan balik ke "Otomatis (dari nama)"

  // TTD dinas yang sudah ada digambar balik ke pad-nya
  const dt = state.dinasTtd || {};
  setTimeout(()=>{ ['pagi','siang','malam'].forEach(g=>{ if(dt[g]) amhsMuatTtd(`sigAmhs_${k}_${g}`, dt[g]); }); }, 120);

  // Masuk mode sunting
  dcAmhsEditId[k] = id;
  const btn = document.getElementById(`dcAmhsSaveBtn_${k}`); if(btn) btn.innerHTML = `💾 Simpan Perubahan ${escapeHtml(sys)}`;
  const bat = document.getElementById(`dcAmhsBatal_${k}`); if(bat) bat.style.display = '';
  // Form AMHS kini tersembunyi sampai diminta — munculkan saat menyunting.
  if(typeof bukaFormAmhs === 'function') bukaFormAmhs();
  else { const wrap = document.getElementById('dcAmhsWrap'); if(wrap){ wrap.style.display=''; wrap.scrollIntoView({ behavior:'smooth', block:'start' }); } }
  toast(`Menyunting ${sys} — ${r.tanggal}. Lengkapi dinas berikutnya lalu Simpan Perubahan.`);
}

/** Terjemahkan kunci sel (sys|blok|baris|shift) ke label terbaca untuk daftar temuan. */
function amhsLabelDariKunci(k){
  const [sys, bi, ri, sh] = String(k).split('|');
  const s = AMHS_SHEETS[sys];
  const baris = s && s.blocks[+bi] && s.blocks[+bi].rows[+ri];
  const nama = baris ? baris.label : k;
  return `${sys} · ${nama} (${sh})`;
}

/* ================= RENDER BACA-SAJA (detail + cetak) ================= */
function amhsReadStatus(v, cetak){
  const sym = v==='ok' ? '√' : (v==='fail' ? '✕' : '–');
  if(cetak){ const c = v==='ok' ? 'p-ok' : (v==='fail' ? 'p-fail' : 'p-minus'); return `<td style="text-align:center;"><span class="${c}">${sym}</span></td>`; }
  const c = v==='ok' ? 'ok' : (v==='fail' ? 'fail' : 'minus');
  return `<td style="text-align:center;"><span class="status-btn ${c}" style="cursor:default;">${sym}</span></td>`;
}
function amhsReadText(v, cetak){
  const t = (v==null || v==='') ? '–' : v;
  return `<td style="text-align:center;font-size:${cetak?'7.5pt':'11px'};white-space:nowrap;">${escapeHtml(t)}</td>`;
}
/** Semua blok satu sub-sistem, read-only. `cetak` menukar gaya untuk kertas. */
function amhsReadSistem(sys, sel, cetak){
  const s = AMHS_SHEETS[sys]; sel = sel || {};
  const t = cetak ? 'td' : 'th';
  return s.blocks.map((b, bi)=>{
    let rows = '';
    b.rows.forEach((r, ri)=>{
      if(r.t==='note'){
        const v = sel[`${sys}|${bi}|${ri}`] || '';
        rows += `<tr><td colspan="4" style="text-align:left;font-size:${cetak?'7.5pt':'11px'};"><b>${escapeHtml(r.label)}</b> ${escapeHtml(v)}</td></tr>`;
        return;
      }
      const cell = sh => {
        const v = sel[`${sys}|${bi}|${ri}|${sh}`];
        return (r.t==='chk' || r.t==='grp') ? amhsReadStatus(v, cetak) : amhsReadText(v, cetak);
      };
      const g = r.t==='grp' ? 'font-weight:bold;' : '';
      rows += `<tr><td style="text-align:left;${g}white-space:nowrap;font-size:${cetak?'7.5pt':'11px'};">${escapeHtml(r.label)}</td>${cell('P')}${cell('S')}${cell('M')}</tr>`;
    });
    const tabel = `<table class="${cetak?'':'dc ds'}" style="${cetak?'':'min-width:0;'}">
      <thead><tr class="${cetak?'p-kepala':''}"><${t} style="text-align:left;">Item</${t}><${t}>P</${t}><${t}>S</${t}><${t}>M</${t}></tr></thead>
      <tbody>${rows}</tbody></table>`;
    // Cetak: tiap blok dibungkus .blk supaya utuh di dalam satu kolom (multi-kolom
    // padat, ~1 halaman per sub-sistem). Layar tetap satu kolom lebar.
    if(cetak) return `<div class="blk"><div class="blkh">${escapeHtml(b.nama)}</div>${tabel}</div>`;
    const judul = `<div style="font-weight:bold;font-size:12px;margin:10px 0 4px;">${escapeHtml(b.nama)}</div>`;
    return judul + `<div class="dc-table-wrap" style="margin-bottom:8px;">${tabel}</div>`;
  }).join('');
}

/* ---------- Detail (modal) — satu catatan = satu sistem ---------- */
function renderDcAmhsDetail(r, detail, state){
  const sys = state.__sistem || 'AMHS';
  const sel = state.sel || {}, jam = state.jam || {};
  const cat = (state.catatan || {})[sys];
  const dinas = state.dinas || {pagi:[],siang:[],malam:[]};
  const dinasTtd = state.dinasTtd || {};
  const daftar = arr => (arr && arr.length) ? arr.map((n,i)=>`${i+1}. ${escapeHtml(n)}`).join('<br>') : '<span style="color:var(--muted)">-</span>';
  const sistemHtml = `<div style="margin-top:14px;">
      <div style="font-family:var(--font-mono);color:var(--accent);font-size:12px;margin-bottom:6px;">${escapeHtml(AMHS_SHEETS[sys].judul)}</div>
      ${amhsReadSistem(sys, sel, false)}
      ${cat ? `<div style="font-size:12px;margin-top:6px;"><b>Catatan:</b> ${escapeHtml(cat)}</div>` : ''}</div>`;
  document.getElementById('dcDetailBody').innerHTML = `
    <div style="font-size:13px;line-height:1.7;margin-bottom:10px;">
      <b>${escapeHtml(r.tanggal)}</b> &middot; <span style="color:var(--accent);font-family:var(--font-mono);">${escapeHtml(sys)}</span><br>
      Jam Pengecekan — P: ${escapeHtml(jam.p||'-')} · S: ${escapeHtml(jam.s||'-')} · M: ${escapeHtml(jam.m||'-')}
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${[['Pagi',dinas.pagi,dinasTtd.pagi],['Siang',dinas.siang,dinasTtd.siang],['Malam',dinas.malam,dinasTtd.malam]].map(([label,arr,ttd])=>`
        <div style="display:flex;align-items:center;gap:10px;border:1px solid var(--line);border-radius:8px;padding:6px 10px;">
          <span class="tag ${(arr&&arr.length)?'ok':'minus'}" style="min-width:56px;text-align:center;">${label}</span>
          <div style="flex:1;font-size:12.5px;">${daftar(arr)}</div>
          <div style="min-width:60px;text-align:right;">${sigThumbHtml(ttd)}</div>
        </div>`).join('')}
    </div>
    ${sistemHtml}
    <div class="detail-ttd" style="margin-top:14px;">
      <div class="sig-block"><b>Mengetahui — Manager Teknik</b>${renderPihakKedua('dc', r.id, r.managerNama, detail.managerTtd || r.managerTtd)}${sigPejabatHtml('dailycheck', r.id, detail.managerTtd || r.managerTtd, r)}</div>
    </div>
    <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line);">${amhsDiinputHtml(r, state)}</div>`;
}

/* ---------- Baris penginput per dinas (urut P → S → M) ---------- */
/** {p,s,m} nama per dinas → baris bertumpuk atas-ke-bawah dengan tag dinas. */
function amhsDinasTagsHtml(d){
  const baris = [['P','Pagi', d.p], ['S','Siang', d.s], ['M','Malam', d.m]];
  return `<div style="display:flex;flex-direction:column;gap:3px;margin:5px 0;">` +
    baris.map(([kode, label, arr])=>{
      const nama = (Array.isArray(arr) && arr.length) ? arr.map(escapeHtml).join(', ') : '';
      const isi = nama
        ? `<b style="color:var(--text);">${nama}</b>`
        : `<span style="color:var(--muted);font-style:italic;">belum diinput</span>`;
      return `<div style="font-size:11.5px;display:flex;align-items:center;gap:6px;">
        <span class="tag ${nama?'ok':'minus'}" style="min-width:52px;text-align:center;">${label}</span>
        <span style="color:var(--muted);">${isi}</span></div>`;
    }).join('') + `</div>`;
}
/** Ambil {p,s,m} dari remark (JSON) — catatan lama tanpa JSON → kosong. */
function amhsDinasDariRemark(remark){
  try{ const o = JSON.parse(remark || '{}'); return { p:o.p||[], s:o.s||[], m:o.m||[] }; }
  catch(_){ return { p:[], s:[], m:[] }; }
}

/** Penginput per dinas {pagi,siang,malam}→{oleh,nama,pada}. Diutamakan dari
    state.dinasInput (detail); kalau tak ada, dari remark.pin (kartu ringkas). */
function amhsPinObj(r, state){
  if(state && state.dinasInput && Object.keys(state.dinasInput).length) return state.dinasInput;
  try{ const o = JSON.parse((r && r.remark) || '{}'); return o.pin || {}; }
  catch(_){ return {}; }
}
/** Baris "Diinput oleh" per dinas (urut P→S→M, lurus dgn dinas di atasnya).
    Catatan lama tanpa penginput per-dinas → jatuh ke baris tunggal lama. */
function amhsDiinputHtml(r, state){
  const pin = amhsPinObj(r, state);
  const ada = ['pagi','siang','malam'].some(g => pin[g] && (pin[g].nama || pin[g].oleh));
  if(!ada) return diinputOlehHtml(r.diinputOleh, r.dibuatPada, String(r.tanggalIso||'').slice(0,10));
  const acuan = String(r.tanggalIso||'').slice(0,10);
  const baris = [['Pagi','pagi'],['Siang','siang'],['Malam','malam']].map(([label,g])=>{
    const p = pin[g];
    const nama = p ? (p.nama || p.oleh || '') : '';
    const isi = nama
      ? `<b style="color:var(--text);">${escapeHtml(nama)}</b>${(typeof jejakInputHtml==='function') ? jejakInputHtml(p.pada, acuan) : ''}`
      : `<span style="color:var(--muted);font-style:italic;">—</span>`;
    return `<div style="font-size:11px;display:flex;align-items:center;gap:6px;margin-top:2px;">
        <span class="tag ${nama?'ok':'minus'}" style="min-width:52px;text-align:center;font-size:9.5px;">${label}</span>
        <span style="color:var(--muted);">${isi}</span></div>`;
  }).join('');
  return `<div class="diinput-oleh" style="display:block;margin-top:6px;">
    <span style="font-family:var(--font-mono);font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;">${T('diinputOleh')}</span>
    ${baris}</div>`;
}

/* ---------- Riwayat ---------- */
function renderDcAmhsHistory(){
  const wrap = document.getElementById('dcHistory');
  if(!wrap) return;
  if(!dcHistory.length){ wrap.innerHTML = '<div class="empty">Belum ada daily check AMHS.</div>'; return; }
  const daftar = (typeof dcHistoryTersaring === 'function') ? dcHistoryTersaring() : dcHistory;
  if(!daftar.length){ wrap.innerHTML = '<div class="empty">' + ((typeof T==='function') ? T('takAdaFilter') : 'Tidak ada hasil') + '</div>'; return; }
  wrap.innerHTML = daftar.map(r=>{
    const sys = r.dinas || 'AMHS';   // sistem disimpan di kolom `dinas`
    const tag = r.fails.length ? `<span class="tag fail">${r.fails.length} temuan</span>` : `<span class="tag ok">semua normal</span>`;
    return `<div class="dc-history-item">
      <div><b>${escapeHtml(r.tanggal)}</b> &middot; <span style="color:var(--accent);font-family:var(--font-mono);">${escapeHtml(sys)}</span></div>
      ${tag}
      ${amhsDinasTagsHtml(amhsDinasDariRemark(r.remark))}
      ${r.managerNama ? `<div style="font-size:11.5px;color:var(--muted);">Manager: <b style="color:var(--text);">${escapeHtml(r.managerNama)}</b> ${r.managerTtd ? '<span class="tag ok" style="font-size:9.5px;">disetujui</span>' : '<span class="tag warn" style="font-size:9.5px;">menunggu TTD</span>'}</div>` : ''}
      ${amhsDiinputHtml(r)}
      <div style="display:flex;gap:4px;">
        <button class="btn ghost" style="padding:6px 10px;" onclick="openDcDetail('${r.id}')">${(typeof T==='function')?T('detail'):'Detail'}</button>
        ${amhsBolehEdit(r) ? `<button class="btn ghost" style="padding:6px 10px;" title="Lanjutkan / edit untuk dinas berikutnya" onclick="openEditDcAmhs('${r.id}')">✎ Edit</button>` : ''}
        <button class="icon-btn" title="Cetak" onclick="printSavedDailyCheck('${r.id}')">🖨</button>
        <button class="icon-btn hanya-admin" title="Hapus" onclick="deleteDcRecord('${r.id}')">✕</button>
      </div>
    </div>`;
  }).join('');
}

/* ---------- Cetak (satu catatan = satu sistem = 1 halaman padat) ---------- */
function buildDcAmhsPrintHtml(r, state){
  const sys = state.__sistem || 'AMHS';
  const sel = state.sel || {}, jam = state.jam || {};
  const cat = (state.catatan || {})[sys];
  const dinas = state.dinas || {}, dinasTtd = state.dinasTtd || {};
  const failTemuan = (r.fails && r.fails.length)
    ? `<div style="font-size:7pt;margin-top:3px;"><b>TEMUAN ✕ :</b> ${escapeHtml(r.fails.join('; '))}</div>` : '';
  // 3 kolom dinas mengisi penuh lebar (tanpa kolom Manager Teknik — TTD manual).
  const dinasBlok = (judul, arr, ttd) => `<td style="width:33.33%;text-align:center;vertical-align:top;">
    <div style="font-weight:bold;margin-bottom:2px;">${judul}</div>
    ${((arr && arr.length) ? arr : ['']).map((n,i)=>`<div>${i+1}. ${ttd ? (escapeHtml(n) || '________') : '________'}</div>`).join('')}
    <div style="height:40px;margin-top:2px;">${ttdImg(ttd, 34)}</div></td>`;

  // Gaya khusus cetak AMHS: font kecil, padding rapat, blok mengalir multi-kolom.
  const gaya = `<style>
    #printArea .amp{font-size:6.6pt;line-height:1.12;}
    #printArea .amp td,#printArea .amp th{padding:0 2px !important;}
    #printArea .amp .cols{column-width:158px;column-gap:6px;}
    #printArea .amp .blk{break-inside:avoid;-webkit-column-break-inside:avoid;margin:0 0 4px;}
    #printArea .amp .blkh{font-weight:bold;font-size:6.9pt;margin:1px 0;}
    #printArea .amp table{width:100%;}
    #printArea .amp .no-border td{padding:0 3px !important;}
  </style>`;

  return gaya + `
    <div class="amp">
      <div style="text-align:center;font-weight:bold;font-size:10pt;">DAILY CHECK FASILITAS OTOMASI — ${escapeHtml(sys)}</div>
      <div style="text-align:center;font-size:7pt;margin-bottom:3px;">${escapeHtml(AMHS_SHEETS[sys].judul)}</div>
      <table class="no-border" style="font-size:7.5pt;margin-bottom:3px;"><tr>
        <td style="width:50%;">HARI/TANGGAL : ${escapeHtml(r.tanggal)}</td>
        <td>JAM P/S/M : ${escapeHtml(jam.p||'-')} / ${escapeHtml(jam.s||'-')} / ${escapeHtml(jam.m||'-')}</td></tr></table>
      <div class="cols">${amhsReadSistem(sys, sel, true)}</div>
      ${cat ? `<div style="font-size:7pt;margin-top:3px;"><b>CATATAN :</b> ${escapeHtml(cat)}</div>` : ''}
      ${failTemuan}
      <div style="font-size:7pt;margin-top:4px;"><b>NB :</b> √ Normal &nbsp;&nbsp; ✕ Tidak Normal &nbsp;&nbsp; – Belum dicek</div>
      <table class="no-border" style="font-size:7.5pt;margin-top:8px;width:100%;"><tr>
        ${dinasBlok('DINAS PAGI', dinas.pagi, dinasTtd.pagi)}
        ${dinasBlok('DINAS SIANG', dinas.siang, dinasTtd.siang)}
        ${dinasBlok('DINAS MALAM', dinas.malam, dinasTtd.malam)}
      </tr></table>
    </div>`;
}

function printCurrentDcAmhsSistem(sys){
  const { state } = bacaDcAmhsSistem(sys);
  const tglIso = amVal('dcAmhsTanggal');
  const r = {
    tanggal: (typeof tanggalPanjang==='function' && tglIso) ? tanggalPanjang(new Date(tglIso + 'T00:00:00Z')) : tglIso,
    fails: Object.entries(state.sel).filter(([,v])=>v==='fail').map(([kk])=>amhsLabelDariKunci(kk))
  };
  doPrint(buildDcAmhsPrintHtml(r, state), 'portrait');
}
