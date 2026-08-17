/* E-Logbook · js/13-daily-check-radkom.js — Daily check Radkom: VHF A/G, ACC, CWP FIC & ATMCP
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh. */

/* ============== DAILY CHECK UNIT RADKOM ==============
   Bentuknya beda sama sekali dari Garex 300. Tiap sektor punya frekuensi
   primary dan secondary, masing-masing dinilai TX dan RX. Sektor yang punya
   beberapa lokasi radio dinilai per lokasi, bukan sekali untuk seluruh sektor —
   itu sebabnya ada sub-baris. `sek` pada sub-baris berarti lokasi itu juga
   melayani sisi secondary, dengan label tersebut.
   Status hanya dua: OK dan NOT OK, sesuai keterangan ✅/❌ di form aslinya. */

const DC_RK_VHF = [
  { no:1, nama:'TERMINAL WEST (TW)',   p:'119,750 Mhz', s:'125,050 Mhz' },
  { no:2, nama:'TERMINAL EAST (TE)',   p:'127,900 Mhz', s:'124,950 Mhz',
    sub:[{nama:'710/720 (MAIN)', sek:'710/720'}, {nama:'MER/TER (BUP/RCU)'}] },
  { no:3, nama:'LOWER CENTER (LC)',    p:'127,950 Mhz', s:'126,450 Mhz' },
  { no:4, nama:'ARRIVAL NORTH (AN)',   p:'125,450 Mhz', s:'124,200 Mhz',
    sub:[{nama:'710/720 (MAIN)', sek:'TER'}, {nama:'MER/TER (BUP/RCU)'}] },
  { no:5, nama:'LOWER NORTH (LN)',     p:'124,350 Mhz', s:'125,350 Mhz',
    sub:[{nama:'710/720 (MAIN)', sek:'710/720'}, {nama:'MER (BUP/RCU)'}] },
  { no:6, nama:'LOWER EAST (LE)',      p:'130,100 Mhz', s:'124,150 Mhz',
    sub:[{nama:'BSH', sek:'BSH'}, {nama:'CIREBON'}] },
  { no:7, nama:'TERMINAL SOUTH (TS)',  p:'123,750 Mhz', s:'124,550 Mhz' },
  { no:8, nama:'DEPARTURE WEST (DW)',  p:'125,750 Mhz', s:'132,200 Mhz' },
  { no:9, nama:'ARRIVAL EAST (AE)',    p:'125,550 Mhz', s:'' }
];

const DC_RK_TAMBAHAN = [
  { no:1, nama:'EMERGENCY FREKUENSI', p:'121,500 Mhz', s:'-' },
  { no:2, nama:'ATIS',                p:'126,850 Mhz', s:'-' }
];

const DC_RK_ACC = [
  { no:1,  nama:'UPPER BANDA ACEH',      p:'128,300 Mhz', s:'132,200 Mhz',
    sub:[{nama:'MEULABOH', sek:'MEULABOH'}, {nama:'GN. LINTEUNG'}] },
  { no:2,  nama:'UPPER MEDAN',           p:'133,200 Mhz', s:'133,450 Mhz',
    sub:[{nama:'SILANGIT', sek:'SILANGIT'}, {nama:'SIBIRU-BIRU'}] },
  { no:3,  nama:'UPPER PEKANBARU',       p:'132,300 Mhz', s:'135,850 Mhz',
    sub:[{nama:'PEKANBARU', sek:'PEKANBARU'}, {nama:'JAMBI'}, {nama:'PADANG'}] },
  { no:4,  nama:'UPPER PALEMBANG',       p:'132,700 Mhz', s:'133,100 Mhz',
    sub:[{nama:'PALEMBANG', sek:'PALEMBANG'}, {nama:'BSH'}] },
  { no:5,  nama:'UPPER JAKARTA',         p:'135,900 Mhz', s:'132,150 Mhz',
    sub:[{nama:'LAMPUNG', sek:'LAMPUNG'}, {nama:'BSH'}] },
  { no:6,  nama:'UPPER PANGKAL PINANG',  p:'132,900 Mhz', s:'128,700 Mhz',
    sub:[{nama:'PANGKAL PINANG', sek:'PKP'}, {nama:'JAMBI'}] },
  { no:7,  nama:'UPPER BANDUNG',         p:'132,100 Mhz', s:'134,500 Mhz',
    sub:[{nama:'KULONPROGO', sek:'KULONPROGO'}, {nama:'TANGKUBAN PERAHU'}, {nama:'BSH'}] },
  { no:8,  nama:'UPPER SEMARANG',        p:'120,900 Mhz', s:'134,000 Mhz',
    sub:[{nama:'CIREBON', sek:'CIREBON'}, {nama:'TANGKUBAN PERAHU'}] },
  { no:9,  nama:'UPPER JOGJA',           p:'125,200 Mhz', s:'134,300 Mhz',
    sub:[{nama:'CIREBON', sek:'CIREBON'}, {nama:'PANGANDARAN'}] },
  { no:10, nama:'UPPER PONTIANAK',       p:'133,500 Mhz', s:'134,450 Mhz',
    sub:[{nama:'PONTIANAK', sek:'PONTIANAK'}, {nama:'KETAPANG'}] },
  { no:11, nama:'UPPER TANJUNG PANDAN',  p:'125,700 Mhz', s:'133,900 Mhz',
    sub:[{nama:'TANJUNG PANDAN', sek:'TPD'}, {nama:'TANGKUBAN PERAHU'}] },
  { no:12, nama:'UPPER IOS',             p:'132,85 MHz',  s:'',
    sub:[{nama:'BENGKULU'}, {nama:'PADANG'}, {nama:'NIAS'}] },
  { no:13, nama:'UPPER TANJUNG PINANG',  p:'133,325 MHz', s:'',
    sub:[{nama:'TANJUNG PINANG'}, {nama:'NATUNA'}] },
  { no:14, nama:'UPPER NATUNA',          p:'134,025 MHz', s:'',
    sub:[{nama:'NATUNA'}, {nama:'MATAK'}, {nama:'BATAM'}] },
  { no:15, nama:'GENERAL PURPOSE (GP)',  p:'129,9 MHz',   s:'',
    sub:[{nama:'CIREBON'}, {nama:'BSH (710/720)'}, {nama:'BSH (TER/TER)'}] }
];

const DC_RK_CWP = [
  { no:1, nama:'CWP FIC' },
  { no:2, nama:'CWP ATM CP' }
];
const DC_RK_CWP_KOLOM = [
  { kunci:'ls1', judul:'LINK STATE 1' },
  { kunci:'ls2', judul:'LINK STATE 2' },
  { kunci:'td',  judul:'Touchscreen Display' },
  { kunci:'hs',  judul:'Headset & Speaker' }
];

const DC_RK_GRUP = [
  { kode:'vhf',  judul:'I. VHF A/G',           data:DC_RK_VHF },
  { kode:'tbh',  judul:'',                     data:DC_RK_TAMBAHAN },
  { kode:'acc',  judul:'ACC',                  data:DC_RK_ACC }
];

let dcRkState = {};

/** Kunci baris: grup:nomor untuk sektor, grup:nomor:i untuk sub-baris. */
const rkKunci = (grup, no, i) => i === undefined ? `${grup}:${no}` : `${grup}:${no}:${i}`;

/** Baris mana saja yang benar-benar dinilai — sektor tanpa sub dinilai sendiri. */
function rkBarisNilai(){
  const hasil = [];
  for(const g of DC_RK_GRUP){
    for(const s of g.data){
      if(s.sub && s.sub.length){
        s.sub.forEach((sb,i)=>hasil.push({ kunci:rkKunci(g.kode,s.no,i), adaS: !!sb.sek }));
      }else{
        hasil.push({ kunci:rkKunci(g.kode,s.no), adaS: !!(s.s && s.s !== '-') });
      }
    }
  }
  return hasil;
}

function initDcRkState(){
  dcRkState = {};
  for(const b of rkBarisNilai()){
    dcRkState[b.kunci] = { pTx:'ok', pRx:'ok', sTx:'ok', sRx:'ok' };
  }
  for(const c of DC_RK_CWP){
    dcRkState[rkKunci('cwp', c.no)] = { ls1:'ok', ls2:'ok', td:'ok', hs:'ok' };
  }
  dcRkState.ket = {};      // keterangan bebas per sektor
}

function toggleRk(kunci, kolom){
  const b = dcRkState[kunci];
  if(!b) return;
  b[kolom] = b[kolom] === 'ok' ? 'fail' : 'ok';
  renderDcRkTable();
}
function setRkKet(kunci, nilai){ dcRkState.ket[kunci] = nilai; }

const rkSimbol = s => s === 'ok' ? '✓' : '✕';

function rkTombol(kunci, kolom){
  const b = dcRkState[kunci];
  if(!b) return '<td></td>';
  const s = b[kolom];
  return `<td><button class="status-btn ${s}" onclick="toggleRk('${kunci}','${kolom}')">${rkSimbol(s)}</button></td>`;
}

/** Satu blok tabel sektor (VHF, tambahan, atau ACC). */
function rkTabelSektor(grup){
  let baris = '';
  for(const s of grup.data){
    const punyaSub = !!(s.sub && s.sub.length);
    const kunciKet = rkKunci(grup.kode, s.no);
    const ket = `<td rowspan="${punyaSub ? s.sub.length + 1 : 1}">
      <input type="text" class="rk-ket" value="${escapeHtml(dcRkState.ket[kunciKet] || '')}"
             onchange="setRkKet('${kunciKet}', this.value)"></td>`;

    if(punyaSub){
      // Baris sektor hanya membawa frekuensi; penilaiannya ada di sub-baris.
      baris += `<tr class="rk-sektor">
        <td>${s.no}</td><td class="rk-nama">${escapeHtml(s.nama)}</td>
        <td class="rk-frek">${escapeHtml(s.p)}</td><td></td><td></td>
        <td class="rk-frek">${escapeHtml(s.s)}</td><td></td><td></td>
        ${ket}</tr>`;
      s.sub.forEach((sb,i)=>{
        const k = rkKunci(grup.kode, s.no, i);
        baris += `<tr class="rk-sub">
          <td></td><td class="rk-nama">${escapeHtml(sb.nama)}</td>
          <td></td>${rkTombol(k,'pTx')}${rkTombol(k,'pRx')}
          <td class="rk-frek">${escapeHtml(sb.sek || '')}</td>
          ${sb.sek ? rkTombol(k,'sTx') + rkTombol(k,'sRx') : '<td></td><td></td>'}
        </tr>`;
      });
    }else{
      const k = rkKunci(grup.kode, s.no);
      const adaS = !!(s.s && s.s !== '-');
      baris += `<tr class="rk-sektor">
        <td>${s.no}</td><td class="rk-nama">${escapeHtml(s.nama)}</td>
        <td class="rk-frek">${escapeHtml(s.p)}</td>${rkTombol(k,'pTx')}${rkTombol(k,'pRx')}
        <td class="rk-frek">${escapeHtml(s.s)}</td>
        ${adaS ? rkTombol(k,'sTx') + rkTombol(k,'sRx') : '<td></td><td></td>'}
        ${ket}</tr>`;
    }
  }

  return `
    ${grup.judul ? `<div class="rk-judul">${grup.judul}</div>` : ''}
    <div class="dc-table-wrap" style="margin-bottom:12px;">
      <table class="dc rk">
        <thead>
          <tr>
            <th rowspan="2" style="width:34px;">NO</th><th rowspan="2">SEKTOR</th>
            <th colspan="3">FREKUENSI PRIMARY</th>
            <th colspan="3">FREKUENSI SECONDARY</th>
            <th rowspan="2" style="width:150px;">KETERANGAN</th>
          </tr>
          <tr><th>FREK</th><th>TX</th><th>RX</th><th>FREK</th><th>TX</th><th>RX</th></tr>
        </thead>
        <tbody>${baris}</tbody>
      </table>
    </div>`;
}

function rkTabelCwp(){
  const baris = DC_RK_CWP.map(c=>{
    const k = rkKunci('cwp', c.no);
    return `<tr class="rk-sektor">
      <td>${c.no}</td><td class="rk-nama">${escapeHtml(c.nama)}</td>
      ${DC_RK_CWP_KOLOM.map(kol=>rkTombol(k, kol.kunci)).join('')}
      <td><input type="text" class="rk-ket" value="${escapeHtml(dcRkState.ket[k] || '')}"
                 onchange="setRkKet('${k}', this.value)"></td>
    </tr>`;
  }).join('');

  return `
    <div class="rk-judul">II. CWP FIC &amp; ATMCP</div>
    <div class="dc-table-wrap">
      <table class="dc rk">
        <thead><tr>
          <th style="width:34px;">NO</th><th>FIC JAKARTA SECTOR</th>
          ${DC_RK_CWP_KOLOM.map(k=>`<th>${k.judul}</th>`).join('')}
          <th style="width:150px;">KETERANGAN</th>
        </tr></thead>
        <tbody>${baris}</tbody>
      </table>
    </div>`;
}

function renderDcRkTable(){
  const wrap = document.getElementById('dcRadkomWrap');
  if(!wrap) return;
  wrap.innerHTML = DC_RK_GRUP.map(rkTabelSektor).join('') + rkTabelCwp();
}

/** Daftar temuan NOT OK, dipakai untuk penanda di riwayat dan catatan cetak. */
function rkTemuan(state){
  const hasil = [];
  const cekBaris = (grup, s, sb, i) => {
    const k = sb ? rkKunci(grup.kode, s.no, i) : rkKunci(grup.kode, s.no);
    const b = state[k];
    if(!b) return;
    const label = sb ? `${s.nama} — ${sb.nama}` : s.nama;
    const adaS = sb ? !!sb.sek : !!(s.s && s.s !== '-');
    if(b.pTx === 'fail') hasil.push(`${label} (primary TX)`);
    if(b.pRx === 'fail') hasil.push(`${label} (primary RX)`);
    if(adaS && b.sTx === 'fail') hasil.push(`${label} (secondary TX)`);
    if(adaS && b.sRx === 'fail') hasil.push(`${label} (secondary RX)`);
  };
  for(const g of DC_RK_GRUP){
    for(const s of g.data){
      if(s.sub && s.sub.length) s.sub.forEach((sb,i)=>cekBaris(g,s,sb,i));
      else cekBaris(g,s);
    }
  }
  for(const c of DC_RK_CWP){
    const b = state[rkKunci('cwp', c.no)];
    if(!b) continue;
    for(const kol of DC_RK_CWP_KOLOM){
      if(b[kol.kunci] === 'fail') hasil.push(`${c.nama} (${kol.judul})`);
    }
  }
  return hasil;
}
