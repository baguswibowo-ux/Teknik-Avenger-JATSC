/* E-Logbook · js/19-berkala.js — Empat tab pekerjaan berkala Radtel
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh. */

/* ============== TAB — PEKERJAAN BERKALA ==============
   Empat pekerjaan, empat tab, satu jendela pengisian. Daftar barisnya datang
   dari server (berkala-item.js), jadi menambah channel tidak perlu menyentuh
   berkas ini maupun markup-nya.

     bk-neptuno   Cek Inspection Neptuno — 4 Neptuno × (monit summary + NTP status)
     bk-gatevox   Change Over CPU Gatevox — 9 GateVox × redundansi CPU A/B
     bk-cleaning  Cleaning CWP — 85 channel CWP
     bk-restart   Restart CWP — 85 channel + Neptuno 1–4 + TMCS 1–2

   Empat tab tapi SATU tabel penyimpanan dan SATU jendela: bentuk lembarnya
   sama persis, yang berbeda cuma daftar barisnya. Menggandakan markup empat
   kali berarti empat tempat yang bisa mulai berbeda diam-diam.

   LEMBAR NEPTUNO 316 BARIS. Itu yang menentukan dua keputusan di bawah:
   status ditekan tanpa menggambar ulang tabel (lihat toggleBerkala), dan
   tiap kelompok punya tombol tandai-sekaligus (lihat tandaiGrup). Tanpa
   keduanya, satu lembar berarti ratusan klik dan tabel yang tersentak tiap
   kali salah satunya ditekan. */

let berkalaItemSemua = {};
let berkalaJenisUrut = ['neptuno', 'gatevox', 'cleaning-cwp', 'restart-cwp'];
let berkalaJenis = 'neptuno';
let berkalaState = {};
let berkalaTeknisiRows = [];
let berkalaTeknisiSeq = 0;

/** Tab mana menampilkan jenis mana. Dipakai dua arah. */
const BK_TAB = {
  'neptuno':      'bk-neptuno',
  'gatevox':      'bk-gatevox',
  'cleaning-cwp': 'bk-cleaning',
  'restart-cwp':  'bk-restart'
};
const BK_JENIS_DARI_TAB = Object.fromEntries(Object.entries(BK_TAB).map(([j, t]) => [t, j]));

/** Id wadah daftar riwayat per jenis — satu daftar per tab. */
const bkListId = (jenis) => 'bkList-' + (BK_TAB[jenis] || 'bk-neptuno').replace('bk-', '');

const berkalaItemAktif = () => berkalaItemSemua[berkalaJenis] || [];
const berkalaItemUntuk = (jenis) => berkalaItemSemua[jenis] || [];

/** Label jenis; kunci yang belum punya terjemahan tampil apa adanya. */
const berkalaLabelJenis = (jenis) => T('bkJenis_' + (jenis || 'neptuno'));

const mapBerkala = b => ({ id:b.ID, tanggal:b.Tanggal, jenis:b.Jenis||'neptuno',
                           state:b.State||{}, catatan:b.Catatan||'',
                           managerNama:b.ManagerNama||'', managerTtd:b.ManagerTTD||'',
                           teknisiNama:b.TeknisiNama||'', teknisiNamaList:b.TeknisiNamaListJSON||[],
                           teknisiTtd:b.TeknisiTTD||'', diinputOleh:b.DiinputOleh||'',
                           dibuatPada:b.DibuatPada||'',
                           ttdOleh:b.TtdOleh||'', ttdPada:b.TtdPada||'', ttdUntuk:b.TtdUntuk||'' });

/* ok (dikerjakan, normal) -> fail (dikerjakan, ada temuan) -> minus (tidak
   dikerjakan) -> kembali ke ok. Urutan dan lambangnya sama persis dengan
   DS Test: orang yang sama mengisi keduanya di layar yang sama. */
const BK_STATUS_URUT = { ok:'fail', fail:'minus', minus:'ok' };
const BK_STATUS_SIMBOL = { ok:'✓', fail:'✕', minus:'−' };

/* ============== GATEVOX — CHANGE OVER (bentuknya beda) ==============
   Tiga lembar lain adalah ceklis satu-status per baris. Lembar Change
   Over Gatevox memeriksa PERTUKARAN peran MAIN↔STANDBY antara CPU A/B —
   satu baris per GateVox berisi banyak medan. State per baris disimpan
   sebagai objek yang lebih lebar dari {st, ket}, dan renderer khusus
   di bawah menggambar tabelnya. */
const GV_KOLOM = [
  { k:'no',            lbl:'No',                   w:'34px'  },
  { k:'nama',          lbl:'GateVox',              w:'82px'  },
  { k:'ipA',           lbl:'IP CPU A',             w:'108px' },
  { k:'ipB',           lbl:'IP CPU B',             w:'108px' },
  { k:'mainBefore',    lbl:'CPU MAIN (BEFORE)',    w:'90px'  },
  { k:'standbyBefore', lbl:'CPU STANDBY (BEFORE)', w:'100px' },
  { k:'pingA',         lbl:'Ping CPU A',           w:'90px'  },
  { k:'pingB',         lbl:'Ping CPU B',           w:'90px'  },
  { k:'tmcsBefore',    lbl:'TMCS (BEFORE)',        w:'92px'  },
  { k:'mainAfter',     lbl:'CPU MAIN (AFTER)',     w:'88px'  },
  { k:'standbyAfter',  lbl:'CPU STANDBY (AFTER)',  w:'100px' },
  { k:'tmcsAfter',     lbl:'TMCS (AFTER)',         w:'90px'  },
  { k:'hasil',         lbl:'Hasil Change Over',    w:'118px' },
  { k:'validasi',      lbl:'Validasi Pertukaran',  w:'118px' },
  { k:'alarm',         lbl:'Alarm / Remark',       w:'170px' },
  { k:'waktu',         lbl:'Waktu',                w:'82px'  }
];
const GV_AB = ['', 'A', 'B'];
const GV_OKFAIL = [['', '—'], ['ok', 'OK'], ['fail', 'NOT OK']];
const GV_HASIL  = [['', '—'], ['ok', 'OK'], ['gagal', 'GAGAL']];

function gvStateSeed(){
  return { mainBefore:'', standbyBefore:'', pingA:'', pingB:'',
           mainAfter:'', standbyAfter:'', hasil:'', alarm:'', waktu:'' };
}
/** Sudah pernah disentuh? Baris yang seluruh medannya kosong dianggap
    "belum diisi" — bukan "tidak valid". */
function gvTerisi(b){
  if(!b) return false;
  return !!(b.mainBefore || b.standbyBefore || b.mainAfter || b.standbyAfter
         || b.pingA || b.pingB || b.hasil || b.alarm || b.waktu);
}
/** Pertukaran benar-benar terjadi jika BEFORE MAIN ≠ AFTER MAIN, BEFORE
    STANDBY ≠ AFTER STANDBY, dan setelahnya MAIN ≠ STANDBY (tidak dua-duanya
    di CPU yang sama). */
function gvBertukar(b){
  return b && b.mainBefore && b.mainAfter && b.standbyBefore && b.standbyAfter
      && b.mainBefore !== b.mainAfter
      && b.standbyBefore !== b.standbyAfter
      && b.mainAfter !== b.standbyAfter;
}
function gvValidasi(b){
  if(!gvTerisi(b)) return '';
  if(!gvBertukar(b)) return 'TIDAK VALID';
  if(b.hasil === 'gagal') return 'TIDAK VALID';
  if(b.hasil === 'ok')    return 'VALID';
  return '';
}
function gvHitung(state){
  const n = { valid:0, invalid:0, belum:0 };
  daftarGatevoxItems().forEach(it=>{
    const b = (state || {})[it.kode];
    if(!gvTerisi(b)) n.belum++;
    else if(gvValidasi(b) === 'VALID') n.valid++;
    else n.invalid++;
  });
  return n;
}
function daftarGatevoxItems(){ return berkalaItemUntuk('gatevox'); }

function initBerkalaState(){
  berkalaState = {};
  const gv = (berkalaJenis === 'gatevox');
  const np = (berkalaJenis === 'neptuno');
  berkalaItemAktif().forEach(it=>{
    berkalaState[it.kode] = gv ? gvStateSeed() : (np ? npStateSeed() : { st:'ok', ket:'' });
  });
}

/** Status sebuah baris, apa pun lembarnya. Baris yang belum pernah ada waktu
    lembar itu diisi terbaca '−': channel yang baru ditambahkan bulan ini
    memang tidak pernah dicek bulan lalu. */
function berkalaStatusItem(state, it){
  const b = (state || {})[it.kode];
  return b ? (b.st || 'ok') : 'minus';
}

/**
 * Tekan status satu baris.
 *
 * Tombolnya diubah di tempat, bukan lewat renderBerkalaTable(). Menggambar
 * ulang tabel 316 baris pada tiap klik terasa tersentak, dan lebih buruk lagi:
 * kotak keterangan yang sedang diketik kehilangan fokus dan isinya yang belum
 * sempat memicu onchange ikut hilang.
 */
function toggleBerkala(kode, el){
  const b = berkalaState[kode]; if(!b) return;
  b.st = BK_STATUS_URUT[b.st] || 'ok';
  const btn = el || document.querySelector(`#bkBody button[data-kode="${CSS.escape(kode)}"]`);
  if(btn){
    btn.className = 'status-btn ' + b.st;
    btn.textContent = BK_STATUS_SIMBOL[b.st];
  }
  perbaruiRingkasanBerkala();
}
function setBerkalaKet(kode, nilai){ if(berkalaState[kode]) berkalaState[kode].ket = nilai; }

/**
 * Tandai seluruh baris satu kelompok sekaligus.
 *
 * Kelompok SCU sendirian berisi 231 baris. Kalau sebuah pemeriksaan memang
 * tidak dijalankan sama sekali minggu itu, menandainya satu per satu bukan
 * ketelitian — itu cuma 231 klik menuju jawaban yang sama.
 */
function tandaiGrup(grup, status){
  berkalaItemAktif().forEach(it=>{
    if((it.grup || '') !== grup) return;
    if(berkalaState[it.kode]) berkalaState[it.kode].st = status;
  });
  renderBerkalaTable();
}

/** Isi pilihan jenis pada penyaring tiap tab. */
function isiPilihanJenisBerkala(){
  berkalaJenisUrut.forEach(jenis=>{
    const el = document.getElementById(bkListId(jenis));
    if(el) el.dataset.jenis = jenis;
  });
}

/* Kepala tabel, dipakai bersama oleh form, detail, dan cetakan. */
function berkalaTheadHtml(cetak){
  const t = cetak ? 'td' : 'th';
  const kelas = cetak ? ' class="p-kepala"' : '';
  const lebarNo    = cetak ? '' : ' style="width:44px;"';
  const lebarHasil = cetak ? '' : ' style="width:70px;"';
  const lebarKet   = cetak ? '' : ' style="width:38%;"';
  return `<tr${kelas}><${t}${lebarNo}>CH</${t}><${t}>URAIAN</${t}>
      <${t}${lebarHasil}>HASIL</${t}><${t}${lebarKet}>KETERANGAN</${t}></tr>`;
}

/**
 * Baris judul kelompok — muncul sekali tiap kali nama grup berganti.
 * Pada formulir ia juga membawa tombol tandai-sekaligus untuk kelompok itu.
 */
function berkalaBarisGrup(it, sebelumnya, cetak, adaTombol){
  if(!it.grup || it.grup === sebelumnya) return '';
  const gaya = cetak
    ? 'font-weight:bold;text-align:left;'
    : 'font-weight:600;text-align:left;color:var(--muted);font-size:11px;letter-spacing:.06em;text-transform:uppercase;';
  const g = escapeHtml(it.grup).replace(/'/g, "\\'");
  const tombol = adaTombol
    ? `<span style="float:right;display:flex;gap:4px;text-transform:none;letter-spacing:0;">
         <span style="color:var(--muted);font-size:10.5px;align-self:center;">${T('bkTandaiSemua')}</span>
         ${['ok','fail','minus'].map(st=>
           `<button class="status-btn ${st}" style="width:22px;height:22px;font-size:11px;"
                    title="${T('bkTandaiSemua')} ${BK_STATUS_SIMBOL[st]}"
                    onclick="tandaiGrup('${g}','${st}')">${BK_STATUS_SIMBOL[st]}</button>`).join('')}
       </span>`
    : '';
  return `<tr><td colspan="4" style="${gaya}">${escapeHtml(it.grup)}${tombol}</td></tr>`;
}

/** Hitungan ✓ / ✕ / − pada lembar yang sedang diisi. */
function perbaruiRingkasanBerkala(){
  const el = document.getElementById('bkRingkas');
  if(!el) return;
  if(berkalaJenis === 'gatevox'){
    const n = gvHitung(berkalaState);
    el.innerHTML = `<b>${daftarGatevoxItems().length}</b> GateVox &middot; ` +
      `<span class="status-btn ok"    style="cursor:default;">✓</span> ${n.valid} VALID &nbsp;` +
      `<span class="status-btn fail"  style="cursor:default;">✕</span> ${n.invalid} TIDAK VALID &nbsp;` +
      `<span class="status-btn minus" style="cursor:default;">−</span> ${n.belum} BELUM DIISI`;
    return;
  }
  if(berkalaJenis === 'neptuno'){
    const nUnit = npHitung(berkalaState, npAktif);
    const nAll  = npHitung(berkalaState);
    const total = berkalaItemUntuk('neptuno').length;
    el.innerHTML = `<b>Neptuno ${npAktif}</b>: ` +
      `<span class="status-btn ok"    style="cursor:default;">✓</span> ${nUnit.good} &nbsp;` +
      `<span class="status-btn fail"  style="cursor:default;">✕</span> ${nUnit.notgood} &nbsp;` +
      `<span class="status-btn minus" style="cursor:default;">−</span> ${nUnit.belum} ` +
      `<span style="color:var(--muted);">· TOTAL 4 Neptuno: ${nAll.good} / ${nAll.notgood} / ${nAll.belum} dari ${total}</span>`;
    return;
  }
  const n = { ok:0, fail:0, minus:0 };
  berkalaItemAktif().forEach(it=>{ n[berkalaStatusItem(berkalaState, it)] ++; });
  el.innerHTML = `<b>${berkalaItemAktif().length}</b> ${T('bkBaris')} &middot; ` +
    `<span class="status-btn ok" style="cursor:default;">✓</span> ${n.ok} &nbsp;` +
    `<span class="status-btn fail" style="cursor:default;">✕</span> ${n.fail} &nbsp;` +
    `<span class="status-btn minus" style="cursor:default;">−</span> ${n.minus}`;
}

function renderBerkalaTable(){
  if(berkalaJenis === 'gatevox'){ renderGatevoxTable(); return; }
  if(berkalaJenis === 'neptuno'){ renderNeptunoTable(); return; }
  const body = document.getElementById('bkBody');
  if(!body) return;
  const head = document.getElementById('bkThead');
  if(head) head.innerHTML = berkalaTheadHtml(false);

  let grup = '';
  body.innerHTML = berkalaItemAktif().map(it=>{
    const b = berkalaState[it.kode] || {};
    const st = b.st || 'ok';
    const kepala = berkalaBarisGrup(it, grup, false, true);
    grup = it.grup || '';
    return kepala + `<tr>
      <td class="rk-frek">${it.no}</td>
      <td class="rk-nama">${escapeHtml(it.nama)}</td>
      <td><button class="status-btn ${st}" data-kode="${escapeHtml(it.kode)}"
                  onclick="toggleBerkala('${it.kode}', this)">${BK_STATUS_SIMBOL[st]}</button></td>
      <td><input type="text" class="rk-ket" value="${escapeHtml(b.ket || '')}"
                 onchange="setBerkalaKet('${it.kode}', this.value)"></td>
    </tr>`;
  }).join('');
  perbaruiRingkasanBerkala();
}

/* ============== GATEVOX RENDERER — FORMULIR ==============
   Baris digambar dengan gvBarisHtml(). Sel yang bergantung pada sel lain
   (TMCS BEFORE, TMCS AFTER, VALIDASI) diberi data-cell agar bisa diperbarui
   di tempat tanpa menyentuh sel input yang sedang diketik — supaya fokus
   dan isi kotak Alarm/Waktu tidak hilang saat dropdown lain diubah. */
function renderGatevoxTable(){
  const body = document.getElementById('bkBody');
  const head = document.getElementById('bkThead');
  if(!body || !head) return;
  head.innerHTML = `<tr>${GV_KOLOM.map(k =>
    `<th style="width:${k.w};font-size:10.5px;">${escapeHtml(k.lbl)}</th>`).join('')}</tr>`;
  body.innerHTML = daftarGatevoxItems().map(it => gvBarisHtml(it)).join('');
  perbaruiRingkasanBerkala();
}

/* Selects: pakai gaya yang sama dengan input teks — background panel gelap,
   border --line — supaya tabel tidak berbintik-bintik putih. */
const GV_SELECT_STYLE = 'width:100%;font-size:11.5px;padding:4px 6px;background:var(--panel-2);border:1px solid var(--line);color:var(--text);border-radius:6px;';
function gvSelectHtml(kode, field, nilai, opts){
  return `<select onchange="setGv('${kode}','${field}',this.value)" style="${GV_SELECT_STYLE}">` +
    opts.map(([v,l]) => `<option value="${v}"${v===nilai?' selected':''}>${escapeHtml(l)}</option>`).join('') +
    `</select>`;
}
function gvABHtml(kode, field, nilai){
  return `<select onchange="setGv('${kode}','${field}',this.value)" style="${GV_SELECT_STYLE}">` +
    GV_AB.map(v => `<option value="${v}"${v===nilai?' selected':''}>${v||'—'}</option>`).join('') +
    `</select>`;
}
function gvValidasiClass(v){
  return v === 'VALID' ? 'ok' : (v === 'TIDAK VALID' ? 'fail' : 'minus');
}

function gvBarisHtml(it){
  const b = berkalaState[it.kode] || gvStateSeed();
  const val = gvValidasi(b);
  const kls = gvValidasiClass(val);
  return `<tr data-kode="${escapeHtml(it.kode)}">
    <td style="text-align:center;font-family:var(--font-mono);">${it.no}</td>
    <td style="font-weight:600;">${escapeHtml(it.nama)}</td>
    <td style="font-family:var(--font-mono);font-size:11px;">${escapeHtml(it.ipA||'')}</td>
    <td style="font-family:var(--font-mono);font-size:11px;">${escapeHtml(it.ipB||'')}</td>
    <td>${gvABHtml(it.kode,'mainBefore',b.mainBefore)}</td>
    <td>${gvABHtml(it.kode,'standbyBefore',b.standbyBefore)}</td>
    <td>${gvSelectHtml(it.kode,'pingA',b.pingA,GV_OKFAIL)}</td>
    <td>${gvSelectHtml(it.kode,'pingB',b.pingB,GV_OKFAIL)}</td>
    <td data-cell="tmcsBefore" style="text-align:center;font-weight:600;color:var(--muted);">${escapeHtml(b.mainBefore||'—')}</td>
    <td>${gvABHtml(it.kode,'mainAfter',b.mainAfter)}</td>
    <td>${gvABHtml(it.kode,'standbyAfter',b.standbyAfter)}</td>
    <td data-cell="tmcsAfter" style="text-align:center;font-weight:600;color:var(--muted);">${escapeHtml(b.mainAfter||'—')}</td>
    <td>${gvSelectHtml(it.kode,'hasil',b.hasil,GV_HASIL)}</td>
    <td data-cell="validasi" style="text-align:center;">
      <span class="status-btn ${kls}" style="cursor:default;width:auto;padding:0 8px;font-size:10.5px;">${val||'—'}</span>
    </td>
    <td><input type="text" value="${escapeHtml(b.alarm||'')}"
               oninput="setGvText('${it.kode}','alarm',this.value)"
               style="width:100%;font-size:11.5px;padding:4px 6px;background:var(--panel-2);border:1px solid var(--line);color:var(--text);border-radius:6px;"></td>
    <td><input type="time" value="${escapeHtml(b.waktu||'')}"
               oninput="setGvText('${it.kode}','waktu',this.value)"
               style="width:100%;font-size:11.5px;padding:4px 4px;background:var(--panel-2);border:1px solid var(--line);color:var(--text);border-radius:6px;"></td>
  </tr>`;
}

/** setGv dipakai dropdown — perbarui state, hitung ulang sel turunan
    (TMCS BEFORE/AFTER, Validasi) di baris yang sama, dan perbarui ringkasan. */
function setGv(kode, field, nilai){
  if(!berkalaState[kode]) berkalaState[kode] = gvStateSeed();
  berkalaState[kode][field] = nilai;
  const tr = document.querySelector(`#bkBody tr[data-kode="${CSS.escape(kode)}"]`);
  if(tr){
    if(field === 'mainBefore'){
      const c = tr.querySelector('[data-cell="tmcsBefore"]'); if(c) c.textContent = nilai || '—';
    }
    if(field === 'mainAfter'){
      const c = tr.querySelector('[data-cell="tmcsAfter"]'); if(c) c.textContent = nilai || '—';
    }
    const val = gvValidasi(berkalaState[kode]);
    const kls = gvValidasiClass(val);
    const vc  = tr.querySelector('[data-cell="validasi"]');
    if(vc) vc.innerHTML = `<span class="status-btn ${kls}" style="cursor:default;width:auto;padding:0 8px;font-size:10.5px;">${val||'—'}</span>`;
  }
  perbaruiRingkasanBerkala();
}
/** setGvText untuk input teks (alarm/waktu) — tidak menyentuh DOM sel
    input agar kursor tidak lompat saat mengetik. */
function setGvText(kode, field, nilai){
  if(!berkalaState[kode]) berkalaState[kode] = gvStateSeed();
  berkalaState[kode][field] = nilai;
}

/* ============== NEPTUNO — WEEKLY INSPECTION (bentuknya beda juga) ==============
   Enam kolom: No | Item | Expected | Actual | Status | Remarks.
   Semua dropdown & input teks memakai gaya gelap yang sama dengan
   gatevox — tidak ada select putih bawaan. */
const NP_KOLOM = [
  { k:'no',      lbl:'No',       w:'42px'  },
  { k:'nama',    lbl:'Item Validation', w:'160px' },
  { k:'expected',lbl:'Expected', w:'26%'   },
  { k:'actual',  lbl:'Actual',   w:'22%'   },
  { k:'status',  lbl:'Status',   w:'110px' },
  { k:'remarks', lbl:'Remarks',  w:'22%'   }
];
const NP_STATUS = [['', '—'], ['good', 'Good'], ['notgood', 'Not Good']];

function npStateSeed(){ return { actual:'', status:'', remarks:'' }; }
function npTerisi(b){ return !!(b && (b.actual || b.status || b.remarks)); }

/* Neptuno mana yang sedang ditampilkan di modal (1..4). Filter renderer
   supaya modal cuma memperlihatkan 26 baris satu Neptuno sekaligus —
   satu tab per unit di atas tabel. Data 104 baris tetap tersimpan
   penuh di berkalaState, cuma tampilannya yang disaring. */
let npAktif = 1;
const npItemUnit = (n) => berkalaItemUntuk('neptuno').filter(it => it.kode.startsWith('n' + n + '-'));

function npHitung(state, unit){
  const n = { good:0, notgood:0, belum:0 };
  const item = unit ? npItemUnit(unit) : berkalaItemUntuk('neptuno');
  item.forEach(it=>{
    const b = (state || {})[it.kode];
    if(!npTerisi(b)) n.belum++;
    else if(b.status === 'good') n.good++;
    else if(b.status === 'notgood') n.notgood++;
    else n.belum++;
  });
  return n;
}
function npStatusKls(v){ return v === 'good' ? 'ok' : (v === 'notgood' ? 'fail' : 'minus'); }
function npStatusLbl(v){ return v === 'good' ? 'Good' : (v === 'notgood' ? 'Not Good' : '—'); }

const NP_INPUT_STYLE  = 'width:100%;font-size:11.5px;padding:5px 8px;background:var(--panel-2);border:1px solid var(--line);color:var(--text);border-radius:6px;';
const NP_SELECT_STYLE = NP_INPUT_STYLE;

function npSelectHtml(kode, nilai){
  return `<select onchange="setNp('${kode}','status',this.value)" style="${NP_SELECT_STYLE}">` +
    NP_STATUS.map(([v,l]) => `<option value="${v}"${v===nilai?' selected':''}>${escapeHtml(l)}</option>`).join('') +
    `</select>`;
}

function npBarisHtml(it){
  const b = berkalaState[it.kode] || npStateSeed();
  const kls = npStatusKls(b.status);
  return `<tr data-kode="${escapeHtml(it.kode)}">
    <td style="text-align:center;font-family:var(--font-mono);font-size:11.5px;">${it.no}</td>
    <td style="font-weight:600;font-size:12px;">${escapeHtml(it.nama)}</td>
    <td style="font-family:var(--font-mono);font-size:11.5px;color:var(--muted);">${escapeHtml(it.expected||'')}</td>
    <td><input type="text" value="${escapeHtml(b.actual||'')}"
               oninput="setNpText('${it.kode}','actual',this.value)"
               placeholder="isi hasil pemeriksaan"
               style="${NP_INPUT_STYLE}"></td>
    <td data-cell="statusChip" style="text-align:center;">${npSelectHtml(it.kode, b.status)}
      <div style="margin-top:4px;">
        <span class="status-btn ${kls}" style="cursor:default;width:auto;padding:0 8px;font-size:10.5px;">${npStatusLbl(b.status)}</span>
      </div>
    </td>
    <td><input type="text" value="${escapeHtml(b.remarks||'')}"
               oninput="setNpText('${it.kode}','remarks',this.value)"
               style="${NP_INPUT_STYLE}"></td>
  </tr>`;
}

function npGrupHeaderHtml(grup, cetak){
  const gaya = cetak
    ? 'font-weight:bold;text-align:left;background:#eee;'
    : 'font-weight:600;text-align:left;color:var(--accent);font-size:11.5px;letter-spacing:.05em;text-transform:uppercase;background:var(--panel-2);';
  return `<tr><td colspan="${NP_KOLOM.length}" style="${gaya}padding:6px 8px;">${escapeHtml(grup)}</td></tr>`;
}

/** Tab pemilih Neptuno 1..4 — satu unit tampil sekaligus di modal. Tiap
    tab membawa penunjuk kecil (angka NOT GOOD, atau titik BELUM DIISI)
    supaya teknisi tahu unit mana yang perlu perhatian tanpa harus
    membukanya dulu. */
function npTabsHtml(){
  return `<div style="display:flex;gap:6px;margin:8px 0 10px 0;flex-wrap:wrap;">
    ${[1,2,3,4].map(n=>{
      const h = npHitung(berkalaState, n);
      const aktif = (n === npAktif);
      const tanda = h.notgood ? `<span class="status-btn fail" style="cursor:default;width:auto;padding:0 6px;font-size:10px;margin-left:6px;">${h.notgood}</span>`
                 : (h.good === npItemUnit(n).length ? `<span class="status-btn ok" style="cursor:default;width:auto;padding:0 6px;font-size:10px;margin-left:6px;">✓</span>`
                 : (h.good ? `<span style="color:var(--muted);font-size:10.5px;margin-left:6px;">${h.good}/${npItemUnit(n).length}</span>` : ''));
      return `<button type="button" onclick="pilihNeptuno(${n})"
                style="padding:8px 14px;border-radius:6px;border:1px solid ${aktif?'var(--accent)':'var(--line)'};
                       background:${aktif?'var(--accent-soft, rgba(90,130,255,0.12))':'var(--panel-2)'};
                       color:var(--text);font-size:12px;font-weight:${aktif?'700':'500'};cursor:pointer;
                       display:inline-flex;align-items:center;">
                Neptuno ${n}${tanda}
              </button>`;
    }).join('')}
  </div>`;
}

function pilihNeptuno(n){
  npAktif = n;
  renderNeptunoTable();
}

function renderNeptunoTable(){
  const body = document.getElementById('bkBody');
  const head = document.getElementById('bkThead');
  const top  = document.getElementById('bkExtraTop');
  if(!body || !head) return;
  if(top) top.innerHTML = npTabsHtml();
  head.innerHTML = `<tr>${NP_KOLOM.map(k =>
    `<th style="width:${k.w};font-size:11px;">${escapeHtml(k.lbl)}</th>`).join('')}</tr>`;
  let grup = '';
  body.innerHTML = npItemUnit(npAktif).map(it=>{
    const kepala = (it.grup && it.grup !== grup) ? npGrupHeaderHtml(it.grup, false) : '';
    grup = it.grup || '';
    return kepala + npBarisHtml(it);
  }).join('');
  perbaruiRingkasanBerkala();
}

function setNp(kode, field, nilai){
  if(!berkalaState[kode]) berkalaState[kode] = npStateSeed();
  berkalaState[kode][field] = nilai;
  if(field === 'status'){
    const tr = document.querySelector(`#bkBody tr[data-kode="${CSS.escape(kode)}"]`);
    if(tr){
      const chip = tr.querySelector('[data-cell="statusChip"] .status-btn');
      if(chip){
        chip.className = 'status-btn ' + npStatusKls(nilai);
        chip.textContent = npStatusLbl(nilai);
      }
    }
    /* Badge angka pada tab Neptuno berubah kalau status baris berubah. */
    const top = document.getElementById('bkExtraTop');
    if(top) top.innerHTML = npTabsHtml();
  }
  perbaruiRingkasanBerkala();
}
function setNpText(kode, field, nilai){
  if(!berkalaState[kode]) berkalaState[kode] = npStateSeed();
  berkalaState[kode][field] = nilai;
}

/** Tabel siap-baca untuk detail & cetak. */
/* Lebar kolom Neptuno untuk cetak. Cetakan Neptuno pakai orientasi lanskap
   (lihat printBerkala) → lebar A4 lanskap − margin ≈ 1040px CSS. Kolom yang
   berpotensi panjang isinya (Actual, Remarks) dapat porsi paling besar;
   No/Status/Item cukup ketat supaya tabel tidak boros. */
const NP_KOLOM_CETAK_W = [34, 170, 170, 260, 96, 310];

function npTabelBaca(state, cetak){
  const item = berkalaItemUntuk('neptuno');
  const fs   = cetak ? '8pt' : '11.5px';
  const th   = cetak
    ? '<th style="border:1px solid #000;padding:3px 5px;font-size:7.5pt;text-align:center;background:#eee;">'
    : '<th style="font-size:11px;padding:6px 5px;">';
  const kepala = NP_KOLOM.map(k => `${th}${escapeHtml(k.lbl)}</th>`).join('');
  const kelasCetak = { good:'p-ok', notgood:'p-fail', '':'p-minus' };

  let grup = '';
  const baris = item.map(it=>{
    const b = (state || {})[it.kode] || {};
    const st = b.status || '';
    const stLbl = npStatusLbl(st);
    const stCetak = cetak
      ? `<span class="${kelasCetak[st] || 'p-minus'}" style="white-space:nowrap;">${stLbl}</span>`
      : `<span class="status-btn ${npStatusKls(st)}" style="cursor:default;width:auto;padding:0 8px;font-size:10.5px;">${stLbl}</span>`;
    const td = cetak
      ? 'style="border:1px solid #000;padding:2px 5px;font-size:'+fs+';vertical-align:top;"'
      : 'style="padding:5px 6px;font-size:'+fs+';"';
    const kepalaHtml = (it.grup && it.grup !== grup) ? npGrupHeaderHtml(it.grup, cetak) : '';
    grup = it.grup || '';
    return kepalaHtml + `<tr>
      <td ${td} style="${cetak?'border:1px solid #000;vertical-align:top;':''}padding:2px 5px;text-align:center;font-family:var(--font-mono);font-size:${fs};">${it.no}</td>
      <td ${td} style="${cetak?'border:1px solid #000;vertical-align:top;':''}padding:2px 5px;font-weight:600;font-size:${fs};">${escapeHtml(it.nama)}</td>
      <td ${td} style="${cetak?'border:1px solid #000;vertical-align:top;':''}padding:2px 5px;font-family:var(--font-mono);font-size:${fs};">${escapeHtml(it.expected||'')}</td>
      <td ${td} style="${cetak?'border:1px solid #000;vertical-align:top;':''}padding:2px 5px;font-size:${fs};">${escapeHtml(b.actual||'')}</td>
      <td ${td} style="${cetak?'border:1px solid #000;vertical-align:top;':''}padding:2px 5px;text-align:center;font-size:${fs};">${stCetak}</td>
      <td ${td} style="${cetak?'border:1px solid #000;vertical-align:top;':''}padding:2px 5px;font-size:${fs};">${escapeHtml(b.remarks||'')}</td>
    </tr>`;
  }).join('');

  const tabelStyle = cetak
    ? 'border-collapse:collapse;width:100%;table-layout:fixed;'
    : 'width:100%;';
  const colgroup = cetak
    ? `<colgroup>${NP_KOLOM_CETAK_W.map(w => `<col style="width:${w}px;">`).join('')}</colgroup>`
    : '';
  const tabel = `<table class="${cetak?'':'dc'}" style="${tabelStyle}">
    ${colgroup}
    <thead><tr>${kepala}</tr></thead>
    <tbody>${baris}</tbody></table>`;
  return cetak ? tabel : `<div class="dc-table-wrap">${tabel}</div>`;
}

function renderBerkalaTeknisi(){
  const wrap = document.getElementById('bkTeknisiList');
  wrap.innerHTML = berkalaTeknisiRows.map((t,i)=>`
    <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;">
      <span style="font-family:var(--font-mono);color:var(--accent);font-size:12px;min-width:18px;">${i+1}.</span>
      <input type="text" value="${escapeHtml(t.nama)}" placeholder="${T('namaTeknisiPelaksana')} ${i+1}"
             list="teknisiDatalist"
             oninput="berkalaTeknisiRows[${i}].nama=this.value"
             style="flex:1;background:var(--panel-2);border:1px solid var(--line);color:var(--text);border-radius:6px;padding:9px 10px;font-size:16px;">
      ${berkalaTeknisiRows.length>1 ? `<button class="icon-btn" onclick="hapusBerkalaTeknisi('${t.key}')">✕</button>` : ''}
    </div>`).join('');
}
function addBerkalaTeknisi(){
  const isiAwal = berkalaTeknisiRows.length === 0 && userSaatIni ? (userSaatIni.nama || userSaatIni.username || '') : '';
  berkalaTeknisiRows.push({key:'b'+(berkalaTeknisiSeq++), nama: isiAwal});
  renderBerkalaTeknisi();
}
function hapusBerkalaTeknisi(key){ berkalaTeknisiRows = berkalaTeknisiRows.filter(x=>x.key!==key); renderBerkalaTeknisi(); }

/** Jendela pengisian, selalu untuk satu jenis — tabnya yang menentukan.
    Lembar Change Over Gatevox punya 16 kolom, jadi modalnya dilebarkan
    saat jenis itu yang dibuka; jenis lain kembali ke lebar semula. */
function openBerkalaModal(jenis){
  berkalaJenis = berkalaJenisUrut.includes(jenis) ? jenis : berkalaJenisUrut[0];
  const modal = document.querySelector('#bkModalBg .modal');
  if(modal) modal.style.maxWidth =
    (berkalaJenis === 'gatevox') ? '1240px' :
    (berkalaJenis === 'neptuno') ? '1080px' : '860px';
  /* Kosongkan slot kontrol tambahan; renderer neptuno akan mengisinya
     dengan tab Neptuno 1..4, jenis lain tidak butuh. */
  const bkTop = document.getElementById('bkExtraTop');
  if(bkTop) bkTop.innerHTML = '';
  npAktif = 1;
  document.getElementById('bkModalJudul').textContent = berkalaLabelJenis(berkalaJenis);
  document.getElementById('bkTanggal').value = tanggalHariIni();
  document.getElementById('bkCatatan').value = '';
  document.getElementById('bkManagerNama').value = '';
  document.getElementById('bkManagerAkun').value = '';
  berkalaTeknisiRows = []; berkalaTeknisiSeq = 0; addBerkalaTeknisi();
  ['sigBerkala'].forEach(id=>{ if(!sigPads[id]) setupSigCanvas(id); resizeSigCanvas(id); clearSig(id); });

  initBerkalaState();
  renderBerkalaTable();
  const kosong = berkalaItemAktif().length === 0;
  document.getElementById('bkKosongNote').style.display = kosong ? '' : 'none';
  document.getElementById('bkSaveBtn').disabled = kosong;

  document.getElementById('bkModalBg').classList.add('show');
  setTimeout(()=>['sigBerkala'].forEach(resizeSigCanvas), 60);
}
function closeBerkalaModal(){ document.getElementById('bkModalBg').classList.remove('show'); }

async function saveBerkala(){
  const btn = document.getElementById('bkSaveBtn'); btn.disabled = true;
  try{
    const saved = await gsRun('addBerkala', {
      unit: unitAktif,
      jenis: berkalaJenis,
      tanggal: document.getElementById('bkTanggal').value,
      state: berkalaState,
      catatan: document.getElementById('bkCatatan').value.trim(),
      teknisiNamaList: berkalaTeknisiRows.map(t=>(t.nama||'').trim()).filter(Boolean),
      teknisiTtd: getSigDataUrl('sigBerkala'),
      managerNama: document.getElementById('bkManagerNama').value.trim(),
      ttdUntuk: ttdUntukTerpilih('bkManagerAkun', document.getElementById('bkManagerNama').value)
    });
    berkalaList.unshift(mapBerkala(saved));
    renderBerkalaList();
    closeBerkalaModal();
    toast(T('bkTersimpan'));
  }catch(e){ toast(T('gagalSimpan') + ' — ' + (e.message || T('coba'))); }
  btn.disabled = false;
}

/** Per-jenis: "Tampilkan Semua" melepas batas seminggu untuk tab itu saja. */
let berkalaTampilSemua = {};
function resetCariBerkala(jenis){
  berkalaTampilSemua[jenis] = true;
  const t = (BK_TAB[jenis] || '').replace('bk-', '');
  const el = document.getElementById('cariBkTanggal-' + t);
  if(el) el.value = '';
  renderBerkalaList();
}

/** Baris yang tidak beres pada satu lembar. Yang dihitung cuma yang ✕;
    baris yang memang tidak dikerjakan (−) bukan temuan. Untuk gatevox,
    "tidak beres" = GateVox yang validasinya TIDAK VALID. */
function berkalaTemuan(state, jenis){
  if(jenis === 'gatevox'){
    return berkalaItemUntuk(jenis)
      .filter(it => gvValidasi((state||{})[it.kode]) === 'TIDAK VALID')
      .map(it => it.nama);
  }
  if(jenis === 'neptuno'){
    return berkalaItemUntuk(jenis)
      .filter(it => ((state||{})[it.kode] || {}).status === 'notgood')
      .map(it => it.nama);
  }
  return berkalaItemUntuk(jenis)
    .filter(it => berkalaStatusItem(state, it) === 'fail')
    .map(it => it.nama);
}

/** Empat daftar riwayat digambar sekaligus — tiap tab menyaring jenisnya. */
function renderBerkalaList(){
  berkalaJenisUrut.forEach(jenis=>{
    const wrap = document.getElementById(bkListId(jenis));
    if(!wrap) return;
    const t = (BK_TAB[jenis] || '').replace('bk-', '');
    const tgl = (document.getElementById('cariBkTanggal-' + t) || {}).value || '';
    const semua = berkalaList.filter(b => b.jenis === jenis);
    const daftar = tgl ? semua.filter(b => String(b.tanggal||'').slice(0,10) === tgl)
                       : (berkalaTampilSemua[jenis] ? semua : semua.filter(b => dalamSeminggu(b.tanggal)));

    if(semua.length === 0){ wrap.innerHTML = '<div class="empty">' + T('belumAdaBk') + '</div>'; return; }
    if(daftar.length === 0){ wrap.innerHTML = '<div class="empty">' + T('takAdaHasil') + '</div>'; return; }

    wrap.innerHTML = daftar.map(b=>{
      const gagal = berkalaTemuan(b.state, b.jenis);
      return `<div class="dc-history-item">
        <div><b>${escapeHtml(b.tanggal)}</b></div>
        <span class="tag ${gagal.length ? 'fail' : 'ok'}">${gagal.length ? gagal.length + ' ' + T('bkTemuan') : T('semuaLolos')}</span>
        <div style="font-size:11.5px;color:var(--muted);">${T('teknisiPelaksana')}: ${escapeHtml(b.teknisiNama)||'-'}</div>
        ${diinputOlehHtml(b.diinputOleh, b.dibuatPada, String(b.tanggal||'').slice(0,10))}
        <div style="display:flex;gap:4px;">
          <button class="btn ghost" style="padding:6px 10px;" onclick="openBerkalaDetail('${b.id}')">${T('detail')}</button>
          <button class="icon-btn" title="${T('cetak')}" onclick="printBerkala('${b.id}')">🖨</button>
          <button class="icon-btn hanya-admin" title="${T('hapus')}" onclick="hapusBerkala('${b.id}')">✕</button>
        </div>
      </div>`;
    }).join('');
  });
}

async function hapusBerkala(id){
  if(!adminAktif()){ toast(T('hanyaAdminHapus')); return; }
  const b = berkalaList.find(x=>x.id===id);
  if(!confirm(`${T('konfirmasiHapus')} ${b ? b.tanggal : ''}?`)) return;
  const salinan = berkalaList.slice();
  berkalaList = berkalaList.filter(x=>x.id!==id);
  renderBerkalaList();
  try{ await gsRun('deleteBerkala', id); }
  catch(e){ berkalaList = salinan; renderBerkalaList(); toast(T('gagalHapus') + ' — ' + (e.message||T('coba'))); }
}

/**
 * Tabel siap baca — jendela detail (cetak=false) dan cetakan (true).
 *
 * `ringkas` membuang baris ✓ dan hanya menyisakan yang ✕ dan −. Lembar
 * Neptuno 316 baris yang seluruhnya normal menghabiskan enam halaman untuk
 * mengatakan "tidak ada apa-apa"; yang perlu dibaca orang justru barisan
 * yang tidak normal.
 */
function berkalaTabelBaca(state, cetak, jenis, ringkas){
  if(jenis === 'gatevox') return gvTabelBaca(state, cetak);
  if(jenis === 'neptuno') return npTabelBaca(state, cetak);
  const kelasCetak = { ok:'p-ok', fail:'p-fail', minus:'p-minus' };
  const semua = berkalaItemUntuk(jenis);
  const item = ringkas ? semua.filter(it => berkalaStatusItem(state, it) !== 'ok') : semua;

  if(item.length === 0){
    const pesan = T('bkSemuaNormal');
    return cetak ? `<div style="font-size:9pt;margin:8px 0;">${pesan}</div>`
                 : `<div class="empty">${pesan}</div>`;
  }

  let grup = '';
  const baris = item.map(it=>{
    const b = (state || {})[it.kode] || {};
    const st = berkalaStatusItem(state, it);
    const sym = BK_STATUS_SIMBOL[st] || BK_STATUS_SIMBOL.ok;
    const kepala = berkalaBarisGrup(it, grup, cetak, false);
    grup = it.grup || '';
    const lambang = cetak
      ? `<span class="${kelasCetak[st] || 'p-ok'}">${sym}</span>`
      : `<span class="status-btn ${st === 'fail' || st === 'minus' ? st : 'ok'}" style="cursor:default;">${sym}</span>`;
    return kepala + `<tr>
      <td style="text-align:center;">${it.no}</td>
      <td style="text-align:left;">${escapeHtml(it.nama)}</td>
      <td style="text-align:center;">${lambang}</td>
      <td style="text-align:left;font-size:${cetak?'7.5pt':'11px'};">${escapeHtml(b.ket||'')}</td></tr>`;
  }).join('');

  const tabel = `<table class="${cetak?'':'dc'}" style="font-size:${cetak?'8pt':''};">
    <thead>${berkalaTheadHtml(cetak)}</thead><tbody>${baris}</tbody></table>`;
  return cetak ? tabel : `<div class="dc-table-wrap">${tabel}</div>`;
}

/** Hitungan ✓/✕/− satu lembar tersimpan, untuk kepala detail dan cetakan. */
function berkalaHitung(state, jenis){
  if(jenis === 'gatevox'){
    const g = gvHitung(state);
    return { ok:g.valid, fail:g.invalid, minus:g.belum };
  }
  if(jenis === 'neptuno'){
    const g = npHitung(state);
    return { ok:g.good, fail:g.notgood, minus:g.belum };
  }
  const n = { ok:0, fail:0, minus:0 };
  berkalaItemUntuk(jenis).forEach(it=>{ n[berkalaStatusItem(state, it)] ++; });
  return n;
}

/* ============== GATEVOX — TABEL SIAP-BACA (detail + cetak) ==============
   Tabel yang sama, dua konteks. Detail (cetak=false) memakai style layar dan
   overflow-x — 16 kolom boleh melebar. Cetak (cetak=true) memakai colgroup
   dengan lebar px yang total muat A4 lanskap (≈1040px CSS), dua tingkat
   header (BEFORE/AFTER), dan status tanpa wrap supaya "TIDAK VALID" /
   "BELUM DIISI" tidak pecah baris di kertas. */

/* Lebar kolom cetak (px, sum ≤ 1040 supaya muat A4 lanskap 297mm−2×10mm). */
const GV_KOLOM_CETAK_W = [26, 62, 82, 82, 46, 58, 50, 50, 58, 46, 58, 58, 60, 82, 124, 58];
/* Header pendek khusus cetak: kolom Ping/IP dipangkas 'CPU' karena grup
   BEFORE sudah menjelaskan konteksnya. */
const GV_KOLOM_CETAK_LBL = ['No','GateVox','IP CPU A','IP CPU B',
  'MAIN','STANDBY','Ping A','Ping B','TMCS',
  'MAIN','STANDBY','TMCS',
  'Hasil','Validasi','Alarm / Remark','Waktu'];

function gvTabelBaca(state, cetak){
  const item = daftarGatevoxItems();
  const fs   = cetak ? '7.5pt' : '11px';

  if(cetak) return gvTabelCetak(item, state, fs);

  const th = '<th style="font-size:10.5px;padding:5px 4px;">';
  const kepala = GV_KOLOM.map(k => `${th}${escapeHtml(k.lbl)}</th>`).join('');

  const baris = item.map(it=>{
    const b = (state || {})[it.kode] || {};
    const val = gvValidasi(b);
    const terisi = gvTerisi(b);
    const pingLbl = (v)=> v === 'ok' ? 'OK' : (v === 'fail' ? 'NOT OK' : '—');
    const hasilLbl = (v)=> v === 'ok' ? 'OK' : (v === 'gagal' ? 'GAGAL' : '—');
    const valKls = val === 'VALID' ? 'ok' : (val === 'TIDAK VALID' ? 'fail' : 'minus');
    const valHtml = `<span class="status-btn ${valKls}" style="cursor:default;width:auto;padding:0 8px;font-size:10.5px;">${val || (terisi ? '—' : 'BELUM DIISI')}</span>`;
    const td = 'style="padding:5px 4px;font-size:'+fs+';"';
    const c = (v, extra='')=> `<td ${td} ${extra}>${v}</td>`;
    return `<tr>
      ${c(it.no, 'style="padding:3px 4px;text-align:center;font-family:var(--font-mono);font-size:'+fs+';"')}
      ${c(escapeHtml(it.nama), 'style="padding:3px 4px;font-weight:600;font-size:'+fs+';"')}
      ${c(escapeHtml(it.ipA||'-'), 'style="padding:3px 4px;font-family:var(--font-mono);font-size:'+fs+';"')}
      ${c(escapeHtml(it.ipB||'-'), 'style="padding:3px 4px;font-family:var(--font-mono);font-size:'+fs+';"')}
      ${c(escapeHtml(b.mainBefore||'—'),    'style="padding:3px 4px;text-align:center;font-size:'+fs+';"')}
      ${c(escapeHtml(b.standbyBefore||'—'), 'style="padding:3px 4px;text-align:center;font-size:'+fs+';"')}
      ${c(pingLbl(b.pingA), 'style="padding:3px 4px;text-align:center;font-size:'+fs+';"')}
      ${c(pingLbl(b.pingB), 'style="padding:3px 4px;text-align:center;font-size:'+fs+';"')}
      ${c(escapeHtml(b.mainBefore||'—'),    'style="padding:3px 4px;text-align:center;font-size:'+fs+';color:var(--muted);"')}
      ${c(escapeHtml(b.mainAfter||'—'),     'style="padding:3px 4px;text-align:center;font-size:'+fs+';"')}
      ${c(escapeHtml(b.standbyAfter||'—'),  'style="padding:3px 4px;text-align:center;font-size:'+fs+';"')}
      ${c(escapeHtml(b.mainAfter||'—'),     'style="padding:3px 4px;text-align:center;font-size:'+fs+';color:var(--muted);"')}
      ${c(hasilLbl(b.hasil), 'style="padding:3px 4px;text-align:center;font-size:'+fs+';"')}
      ${c(valHtml,           'style="padding:3px 4px;text-align:center;font-size:'+fs+';"')}
      ${c(escapeHtml(b.alarm||''), 'style="padding:3px 4px;font-size:'+fs+';"')}
      ${c(escapeHtml(b.waktu||''), 'style="padding:3px 4px;text-align:center;font-family:var(--font-mono);font-size:'+fs+';"')}
    </tr>`;
  }).join('');

  const tabel = `<table class="dc" style="width:100%;">
    <thead><tr>${kepala}</tr></thead>
    <tbody>${baris}</tbody></table>`;
  return `<div class="dc-table-wrap" style="overflow-x:auto;">${tabel}</div>`;
}

/* Cetakan GateVox — layout khusus supaya 16 kolom muat A4 lanskap.
   Struktur header:
     Baris 1: No | GateVox | IP CPU A | IP CPU B | BEFORE (5 col) | AFTER (3 col) | Hasil | Validasi | Alarm | Waktu
     Baris 2:                                     | MAIN|STANDBY|Ping A|Ping B|TMCS | MAIN|STANDBY|TMCS |
*/
function gvTabelCetak(item, state, fs){
  const W = GV_KOLOM_CETAK_W;
  const L = GV_KOLOM_CETAK_LBL;
  const kelasCetak = { ok:'p-ok', fail:'p-fail', minus:'p-minus' };

  const colgroup = W.map(w => `<col style="width:${w}px;">`).join('');

  const thTop = (label, span, extra='')=>
    `<th colspan="${span}" rowspan="${extra.rowspan||1}" style="border:1px solid #000;padding:3px 4px;font-size:7pt;text-align:center;background:#eee;line-height:1.15;">${label}</th>`;
  const thSub = (label)=>
    `<th style="border:1px solid #000;padding:3px 4px;font-size:6.8pt;text-align:center;background:#f3f3f3;line-height:1.15;font-weight:600;">${label}</th>`;

  /* IP CPU A/B dijadikan single-row header dengan rowspan=2 supaya sejajar
     dengan grup BEFORE/AFTER di bawahnya. */
  const kepala = `
    <thead>
      <tr>
        <th rowspan="2" style="border:1px solid #000;padding:3px 4px;font-size:7pt;text-align:center;background:#eee;">${L[0]}</th>
        <th rowspan="2" style="border:1px solid #000;padding:3px 4px;font-size:7pt;text-align:center;background:#eee;">${L[1]}</th>
        <th rowspan="2" style="border:1px solid #000;padding:3px 4px;font-size:7pt;text-align:center;background:#eee;">${L[2]}</th>
        <th rowspan="2" style="border:1px solid #000;padding:3px 4px;font-size:7pt;text-align:center;background:#eee;">${L[3]}</th>
        ${thTop('BEFORE — MAIN/STANDBY/PING/TMCS', 5)}
        ${thTop('AFTER — MAIN/STANDBY/TMCS', 3)}
        <th rowspan="2" style="border:1px solid #000;padding:3px 4px;font-size:7pt;text-align:center;background:#eee;">${L[12]}</th>
        <th rowspan="2" style="border:1px solid #000;padding:3px 4px;font-size:7pt;text-align:center;background:#eee;">${L[13]}</th>
        <th rowspan="2" style="border:1px solid #000;padding:3px 4px;font-size:7pt;text-align:center;background:#eee;">${L[14]}</th>
        <th rowspan="2" style="border:1px solid #000;padding:3px 4px;font-size:7pt;text-align:center;background:#eee;">${L[15]}</th>
      </tr>
      <tr>
        ${thSub(L[4])}${thSub(L[5])}${thSub(L[6])}${thSub(L[7])}${thSub(L[8])}
        ${thSub(L[9])}${thSub(L[10])}${thSub(L[11])}
      </tr>
    </thead>`;

  const pingLbl  = (v)=> v === 'ok' ? 'OK' : (v === 'fail' ? 'NOT OK' : '—');
  const hasilLbl = (v)=> v === 'ok' ? 'OK' : (v === 'gagal' ? 'GAGAL' : '—');

  /* helper td cetak — semua sel berborder, opsi align/mono/nowrap/muted. */
  const td = (v, opt={}) => {
    const align  = opt.align || 'left';
    const mono   = opt.mono  ? 'font-family:var(--font-mono);' : '';
    const nowrap = opt.nowrap ? 'white-space:nowrap;overflow:hidden;text-overflow:clip;' : '';
    const muted  = opt.muted ? 'color:#555;' : '';
    const bold   = opt.bold  ? 'font-weight:600;' : '';
    return `<td style="border:1px solid #000;padding:2px 3px;text-align:${align};font-size:${fs};${mono}${nowrap}${muted}${bold}">${v}</td>`;
  };

  const baris = item.map(it=>{
    const b = (state || {})[it.kode] || {};
    const val = gvValidasi(b);
    const terisi = gvTerisi(b);
    const valKls = val === 'VALID' ? 'ok' : (val === 'TIDAK VALID' ? 'fail' : 'minus');
    const valTxt = val || (terisi ? '—' : 'BELUM DIISI');
    const valHtml = `<span class="${kelasCetak[valKls]}" style="white-space:nowrap;">${valTxt}</span>`;

    return `<tr>
      ${td(it.no, {align:'center', mono:true})}
      ${td(escapeHtml(it.nama), {bold:true, nowrap:true})}
      ${td(escapeHtml(it.ipA||'-'), {mono:true, nowrap:true, align:'center'})}
      ${td(escapeHtml(it.ipB||'-'), {mono:true, nowrap:true, align:'center'})}
      ${td(escapeHtml(b.mainBefore||'—'),    {align:'center'})}
      ${td(escapeHtml(b.standbyBefore||'—'), {align:'center'})}
      ${td(pingLbl(b.pingA), {align:'center', nowrap:true})}
      ${td(pingLbl(b.pingB), {align:'center', nowrap:true})}
      ${td(escapeHtml(b.mainBefore||'—'),    {align:'center', muted:true})}
      ${td(escapeHtml(b.mainAfter||'—'),     {align:'center'})}
      ${td(escapeHtml(b.standbyAfter||'—'),  {align:'center'})}
      ${td(escapeHtml(b.mainAfter||'—'),     {align:'center', muted:true})}
      ${td(hasilLbl(b.hasil), {align:'center', nowrap:true})}
      ${td(valHtml,           {align:'center', nowrap:true})}
      ${td(escapeHtml(b.alarm||''))}
      ${td(escapeHtml(b.waktu||''), {align:'center', mono:true, nowrap:true})}
    </tr>`;
  }).join('');

  return `<table style="border-collapse:collapse;width:100%;table-layout:fixed;">
    <colgroup>${colgroup}</colgroup>
    ${kepala}
    <tbody>${baris}</tbody>
  </table>`;
}

/** Detail dibuka ringkas; tombol di bawahnya membuka seluruh baris. */
let berkalaDetailPenuh = false;

function openBerkalaDetail(id, penuh){
  const b = berkalaList.find(x=>x.id===id);
  if(!b) return;
  berkalaDetailPenuh = !!penuh;
  const gv = (b.jenis === 'gatevox');
  const n = berkalaHitung(b.state, b.jenis);
  const total = berkalaItemUntuk(b.jenis).length;
  const catatan = b.catatan
    ? `<div style="margin-top:10px;font-size:12.5px;line-height:1.6;"><b>${T('bkCatatan')}:</b> ${escapeHtml(b.catatan)}</div>`
    : '';
  /* Gatevox 9 baris & Neptuno 104 baris (bergrup) sudah rapi dibaca utuh —
     tombol "seluruh baris" hanya untuk lembar CWP yang bisa panjang. */
  const tombolPenuh = (!gv && !(b.jenis === 'neptuno') && n.ok < total)
    ? `<div style="margin-top:8px;"><button class="btn ghost" style="padding:6px 10px;"
         onclick="openBerkalaDetail('${b.id}', ${berkalaDetailPenuh ? 'false' : 'true'})">${
           berkalaDetailPenuh ? T('bkHanyaTemuan') : T('bkSeluruhBaris')}</button></div>`
    : '';
  const np = (b.jenis === 'neptuno');
  const rekap = gv
    ? `<b>${total}</b> GateVox &middot;
       <span class="status-btn ok" style="cursor:default;">✓</span> ${n.ok} VALID &nbsp;
       <span class="status-btn fail" style="cursor:default;">✕</span> ${n.fail} TIDAK VALID &nbsp;
       <span class="status-btn minus" style="cursor:default;">−</span> ${n.minus} BELUM DIISI`
    : np
    ? `<b>${total}</b> item &middot;
       <span class="status-btn ok" style="cursor:default;">✓</span> ${n.ok} GOOD &nbsp;
       <span class="status-btn fail" style="cursor:default;">✕</span> ${n.fail} NOT GOOD &nbsp;
       <span class="status-btn minus" style="cursor:default;">−</span> ${n.minus} BELUM DIISI`
    : `<b>${total}</b> ${T('bkBaris')} &middot;
       <span class="status-btn ok" style="cursor:default;">✓</span> ${n.ok} &nbsp;
       <span class="status-btn fail" style="cursor:default;">✕</span> ${n.fail} &nbsp;
       <span class="status-btn minus" style="cursor:default;">−</span> ${n.minus}`;

  document.getElementById('formDetailJudul').textContent = berkalaLabelJenis(b.jenis);
  document.getElementById('formDetailBody').innerHTML = `
    <div style="font-size:13px;line-height:1.7;margin-bottom:4px;"><b>${escapeHtml(b.tanggal)}</b></div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:10px;">${rekap}</div>
    ${berkalaTabelBaca(b.state, false, b.jenis, !berkalaDetailPenuh)}
    ${tombolPenuh}
    ${catatan}
    <div class="detail-ttd">
      <div class="sig-block"><b>${T('teknisiPelaksana')}</b>${escapeHtml(b.teknisiNama)||'-'}${sigThumbHtml(b.teknisiTtd)}</div>
      <div class="sig-block"><b>${T('mengetahuiManager')}</b>${renderPihakKedua('berkala', b.id, b.managerNama, b.managerTtd)}${sigPejabatHtml('berkala', b.id, b.managerTtd, b)}</div>
    </div>
    <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line);">${diinputOlehHtml(b.diinputOleh, b.dibuatPada, String(b.tanggal||'').slice(0,10))}</div>`;
  document.getElementById('formDetailPrintBtn').onclick = ()=>{ closeFormDetail(); printBerkala(id); };
  document.getElementById('formDetailBg').classList.add('show');
}

/* Judul cetakan tetap berbahasa lembar kerjanya, berapa pun bahasa antarmuka
   yang sedang aktif — sama seperti DS Test. */
const BK_JUDUL_CETAK = {
  'neptuno':      'WEEKLY INSPECTION RECORDING NEPTUNO',
  'gatevox':      'CHANGE OVER CPU GATEVOX — VCS GAREX 300',
  'cleaning-cwp': 'CLEANING CWP',
  'restart-cwp':  'RESTART CWP'
};

/**
 * Cetakan memuat SELURUH baris, tidak diringkas.
 *
 * Layar boleh meringkas karena pembacanya bisa menekan tombol untuk melihat
 * sisanya. Kertas tidak punya tombol — dan lembar yang tercetak adalah bukti
 * bahwa ketiga ratus channel itu memang diperiksa, bukan cuma yang bermasalah.
 */
function printBerkala(id){
  const b = berkalaList.find(x=>x.id===id);
  if(!b) return;
  if(!tolakCetakBilaBelumTtd(b, 'berkala')) return;
  const gv = (b.jenis === 'gatevox');
  const np = (b.jenis === 'neptuno');
  const judul = BK_JUDUL_CETAK[b.jenis] || BK_JUDUL_CETAK.neptuno;
  const n = berkalaHitung(b.state, b.jenis);
  const catatan = b.catatan
    ? `<div style="font-size:8.5pt;margin-top:8px;"><b>CATATAN :</b> ${escapeHtml(b.catatan)}</div>`
    : '';
  const totalBaris = berkalaItemUntuk(b.jenis).length;
  const rekap = gv
    ? `<div style="font-size:8.5pt;margin-top:8px;">
         <b>REKAP :</b> VALID ${n.ok} &nbsp;&nbsp; TIDAK VALID ${n.fail} &nbsp;&nbsp; BELUM DIISI ${n.minus}
         &nbsp;&nbsp;dari ${totalBaris} GateVox
       </div>
       <div style="font-size:8.5pt;margin-top:4px;"><b>NB :</b> VALID = pertukaran MAIN↔STANDBY berhasil dan role TMCS AFTER benar; TIDAK VALID jika salah satu tidak terpenuhi.</div>`
    : np
    ? `<div style="font-size:8.5pt;margin-top:8px;">
         <b>REKAP :</b> GOOD ${n.ok} &nbsp;&nbsp; NOT GOOD ${n.fail} &nbsp;&nbsp; BELUM DIISI ${n.minus}
         &nbsp;&nbsp;dari ${totalBaris} item (4 Neptuno)
       </div>`
    : `<div style="font-size:8.5pt;margin-top:8px;">
         <b>REKAP :</b> ✓ ${n.ok} &nbsp;&nbsp; ✕ ${n.fail} &nbsp;&nbsp; − ${n.minus}
         &nbsp;&nbsp;dari ${totalBaris} baris
       </div>
       <div style="font-size:8.5pt;margin-top:4px;"><b>NB :</b> ✓ : OK &nbsp;&nbsp; ✕ : NOT OK &nbsp;&nbsp; − : TIDAK DIKERJAKAN</div>`;

  doPrint(`
    ${kopCetak()}
    <div style="text-align:center;font-weight:bold;font-size:12pt;margin-bottom:4px;">${escapeHtml(judul)}</div>
    <div style="text-align:center;font-size:9pt;margin-bottom:10px;">TANGGAL : ${escapeHtml(b.tanggal)}</div>
    ${berkalaTabelBaca(b.state, true, b.jenis, false)}
    ${rekap}
    ${catatan}
    <table class="no-border" style="font-size:9pt;margin-top:14px;">
      <tr>
        <td style="width:55%;text-align:left;vertical-align:top;">
          <div style="margin-bottom:6px;">TEKNISI PELAKSANA :</div>
          ${teknisiPrintBlock(b)}
        </td>
        <td style="text-align:center;vertical-align:top;">
          <div>Mengetahui,</div>
          <div style="margin-bottom:4px;">Manager Teknik</div>
          <div style="height:46px;">${ttdImg(b.managerTtd, 40)}</div>
          <div style="border-top:1px solid #000;display:inline-block;padding:0 24px;">${b.managerTtd ? (escapeHtml(b.managerNama)||'&nbsp;') : '&nbsp;'}</div>
        </td>
      </tr>
    </table>`, (gv || np) ? 'landscape' : 'portrait');
}
