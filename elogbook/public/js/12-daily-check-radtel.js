/* E-Logbook · js/12-daily-check-radtel.js — Daily check Garex 300 (Radtel): daftar item dan tabelnya
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh. */

/* ============== TAB 2 — DAILY CHECK ============== */
const dcLeftItems = ["CWP 1 (SPV UNTA)","CWP 2 (SPV UNOSOF)","CWP 3 (SPV USS)","CWP 4 (SPV UNTA 1)","CWP 5 (SPV UKA)","CWP 6 (SPV UJAWA)","CWP 7 (SPV LE-LC)","CWP 8 (SPV LN)","CWP 9 (SPV TW)","CWP 10 (SPV TS-TE)","CWP 11 (SPV ARR)","CWP 12","CWP 13","CWP 14 (SPV MAN OPS 1)","CWP 15","CWP 16 (FIC 1)","CWP 17 (FIC 2)","CWP 18 (GP 129.9)","CWP 19 (TECH 1)","CWP 20 (TECH 2)","CWP 21 (FDO 1)","CWP 22 (FDO 2)","CWP 23 (MILITARY)","SCU 1 E","SCU 1 P","SCU 2 E","SCU 2 P","SCU 3 E","SCU 3 P","SCU 4 E (UIOS)","SCU 4 P (UIOS)","SCU 5 E (UBAC)","SCU 5 P (UBAC)","SCU 6 E (UMDN)","SCU 6 P (UMDN)","SCU 7 E (UPKU)","SCU 7 P (UPKU)","SCU 8 E (UPLB)","SCU 8 P (UPLB)","SCU 9 E (UJKT)","SCU 9 P (UJKT)","SCU 10 E (UPKP)","SCU 10 P (UPKP)","SCU 11 E (UBTE)","SCU 11 P (UBTE)","TMCS 1","TMCS 2","PROXY 1","PROXY 2","CF 1","CF 2","IPRN 1","IPRN 2","IPRN 3","IPRN 4","IPRN 5","IPRN 6","IPRN 7","IPRN 8","SW 1","SW 2","PC STAT"];
const dcRightItems = ["SCU 12 E (UTPG)","SCU 12 P (UTPG)","SCU 13 E (UNTA)","SCU 13 P (UNTA)","SCU 14 E (UPNK)","SCU 14 P (UPNK)","SCU 15 E (UTPN)","SCU 15 P (UTPN)","SCU 16 E (USMG)","SCU 16 P (USMG)","SCU 17 E (UJOG)","SCU 17 P (UJOG)","SCU 18 E (UBND)","SCU 18 P (UBND)","SCU 19 E","SCU 19 P","SCU 20 E (LE)","SCU 20 P (LE)","SCU 21 E","SCU 21 P","SCU 22 E (LC)","SCU 22 P (LC)","SCU 23 E (LN)","SCU 23 P (LN)","SCU 24 E","SCU 24 P","SCU 25 E","SCU 25 P","SCU 26 E","SCU 26 P","SCU 27 E (TW)","SCU 27 P (TW)","SCU 28 E (AN)","SCU 28 P (AN)","SCU 29 E (AE)","SCU 29 P (AE)","SCU 30 E (TE)","SCU 30 P (TE)","SCU 31 E","SCU 31 P","SCU 32 E","SCU 32 P","SCU 33 E (TS)","SCU 33 P (TS)","SW 3","GATEVOX 1","GATEVOX 2","GATEVOX 3","GATEVOX 4","GATEVOX 5","GATEVOX 6","GATEVOX 7","GATEVOX 8","GATEVOX 9","VR 1","VR 2","VR 3","VR 4","NTP 1","NTP 2"];
const dcCols = ['netA','netB','appA','appB','eqp'];
let dcState = {};

/** Item yang membawa selektor CPU Main/Standby (Gatevox punya dua CPU: A dan B).
 *  Peran (Main atau Standby) disimpan di dcState[item].mainCpu = 'A' | 'B'. */
function itemPunyaMainCpu(item){ return /^GATEVOX [1-9]$/.test(item); }
/** Baris pasangan TMCS 1/2. Selektor Main/standby dipasang di BAWAH tiap TMCS
 *  (satu tombol saja per baris) — begitu satunya jadi Main, satunya lagi
 *  otomatis Standby. Nilai disimpan di dcState['TMCS 1'].mainTmcs = 1 | 2
 *  (satu tempat, tidak ganda), jadi klik dari sisi mana pun konsisten. */
function itemPunyaMainTmcs(item){ return item === 'TMCS 1' || item === 'TMCS 2'; }

function initDcState(){
  dcState = {};
  [...dcLeftItems, ...dcRightItems].forEach(name=>{
    dcState[name] = {netA:'ok', netB:'ok', appA:'ok', appB:'ok', eqp:'ok'};
    if(itemPunyaMainCpu(name)) dcState[name].mainCpu = 'A';
  });
  if(dcState['TMCS 1']) dcState['TMCS 1'].mainTmcs = 1;
}
function cycleStatus(s){ return s==='ok' ? 'warn' : (s==='warn' ? 'fail' : 'ok'); }
function statusSymbol(s){ return s==='ok' ? '✓' : (s==='warn' ? '!' : '✕'); }
function toggleDcStatus(item, col){ dcState[item][col] = cycleStatus(dcState[item][col]); renderDcTable(); }

function setGatevoxMain(item, cpu){
  if(!dcState[item]) return;
  dcState[item].mainCpu = (cpu === 'B') ? 'B' : 'A';
  renderDcTable();
}
function setTmcsMain(n){
  if(!dcState['TMCS 1']) return;
  dcState['TMCS 1'].mainTmcs = (Number(n) === 2) ? 2 : 1;
  renderDcTable();
}
/** Membalik pasangan TMCS: yang tadinya Main jadi Standby, sebaliknya juga.
 *  Dipanggil dari tombol di bawah TMCS 1 maupun TMCS 2 — hasilnya sama. */
function toggleTmcsMain(){
  if(!dcState['TMCS 1']) return;
  const kini = Number(dcState['TMCS 1'].mainTmcs) || 1;
  dcState['TMCS 1'].mainTmcs = kini === 1 ? 2 : 1;
  renderDcTable();
}

/** Sub-baris di bawah item khusus (Gatevox / pasangan TMCS). Balikan berupa
 *  HTML enam sel (Item + 5 status) supaya menyisip mulus di tabel utama —
 *  sisi kiri/kanan yang tidak berselektor mengisi dengan sel kosong. */
function subRowSelForItem(item){
  if(!item) return null;
  if(itemPunyaMainCpu(item)){
    const cpu = (dcState[item] && dcState[item].mainCpu) || 'A';
    const chip = (huruf, dipilih)=>{
      const kelas = dipilih ? 'ok' : 'minus';
      const label = dipilih ? `${huruf} · Main` : `${huruf} · Standby`;
      return `<button class="status-btn ${kelas}" style="width:auto;padding:0 10px;font-size:11.5px;"
                onclick="setGatevoxMain('${item.replace(/'/g,"\\'")}','${huruf}')">${label}</button>`;
    };
    return `<td class="name" style="padding-left:22px;color:var(--muted);font-size:12px;">CPU Main:</td>` +
      `<td colspan="5" style="text-align:left;">${chip('A', cpu==='A')} ${chip('B', cpu==='B')}</td>`;
  }
  if(itemPunyaMainTmcs(item)){
    const n = (dcState['TMCS 1'] && Number(dcState['TMCS 1'].mainTmcs)) || 1;
    const angka = item === 'TMCS 1' ? 1 : 2;
    const iniMain = n === angka;
    const kelas = iniMain ? 'ok' : 'minus';
    const label = iniMain ? 'Main' : 'Standby';
    return `<td class="name" style="padding-left:22px;color:var(--muted);font-size:12px;">Main/standby:</td>` +
      `<td colspan="5" style="text-align:left;">` +
      `<button class="status-btn ${kelas}" style="width:auto;padding:0 14px;font-size:11.5px;"
         onclick="toggleTmcsMain()">${label}</button></td>`;
  }
  return null;
}

function renderDcTable(){
  const body = document.getElementById('dcBody');
  const maxLen = Math.max(dcLeftItems.length, dcRightItems.length);
  const kosong6 = '<td class="name"></td>'+'<td></td>'.repeat(5);
  let rows = '';
  for(let i=0;i<maxLen;i++){
    const l = dcLeftItems[i], r = dcRightItems[i];
    rows += '<tr>';
    rows += l ? cellsForItem(l) : kosong6;
    rows += r ? cellsForItem(r) : kosong6;
    rows += '</tr>';
    const lSub = subRowSelForItem(l);
    const rSub = subRowSelForItem(r);
    if(lSub || rSub){
      rows += '<tr class="dc-sub">';
      rows += lSub || kosong6;
      rows += rSub || kosong6;
      rows += '</tr>';
    }
  }
  body.innerHTML = rows;
}
function cellsForItem(item){
  const st = dcState[item];
  let html = `<td class="name">${item}</td>`;
  dcCols.forEach(col=>{
    const s = st[col];
    html += `<td><button class="status-btn ${s}" onclick="toggleDcStatus('${item.replace(/'/g,"\\'")}','${col}')">${statusSymbol(s)}</button></td>`;
  });
  return html;
}
