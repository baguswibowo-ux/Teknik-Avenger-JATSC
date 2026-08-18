/* E-Logbook · js/19-berkala.js — Empat tab pekerjaan berkala Radtel
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh. */

/* ============== TAB — PEKERJAAN BERKALA ==============
   Empat pekerjaan, empat tab, satu jendela pengisian. Daftar barisnya datang
   dari server (berkala-item.js), jadi menambah channel tidak perlu menyentuh
   berkas ini maupun markup-nya.

     bk-neptuno   Cek Query Rekaman Neptuno — SCU 231 channel + CWP 85
     bk-gatevox   Restart CPU Gatevox — 9 Gatevox × CPU A/B
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

function initBerkalaState(){
  berkalaState = {};
  berkalaItemAktif().forEach(it=>{ berkalaState[it.kode] = { st:'ok', ket:'' }; });
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
  const n = { ok:0, fail:0, minus:0 };
  berkalaItemAktif().forEach(it=>{ n[berkalaStatusItem(berkalaState, it)] ++; });
  el.innerHTML = `<b>${berkalaItemAktif().length}</b> ${T('bkBaris')} &middot; ` +
    `<span class="status-btn ok" style="cursor:default;">✓</span> ${n.ok} &nbsp;` +
    `<span class="status-btn fail" style="cursor:default;">✕</span> ${n.fail} &nbsp;` +
    `<span class="status-btn minus" style="cursor:default;">−</span> ${n.minus}`;
}

function renderBerkalaTable(){
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

function renderBerkalaTeknisi(){
  const wrap = document.getElementById('bkTeknisiList');
  wrap.innerHTML = berkalaTeknisiRows.map((t,i)=>`
    <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;">
      <span style="font-family:var(--font-mono);color:var(--accent);font-size:12px;min-width:18px;">${i+1}.</span>
      <input type="text" value="${escapeHtml(t.nama)}" placeholder="${T('namaTeknisiPelaksana')} ${i+1}"
             oninput="berkalaTeknisiRows[${i}].nama=this.value"
             style="flex:1;background:var(--panel-2);border:1px solid var(--line);color:var(--text);border-radius:6px;padding:9px 10px;font-size:16px;">
      ${berkalaTeknisiRows.length>1 ? `<button class="icon-btn" onclick="hapusBerkalaTeknisi('${t.key}')">✕</button>` : ''}
    </div>`).join('');
}
function addBerkalaTeknisi(){ berkalaTeknisiRows.push({key:'b'+(berkalaTeknisiSeq++), nama:''}); renderBerkalaTeknisi(); }
function hapusBerkalaTeknisi(key){ berkalaTeknisiRows = berkalaTeknisiRows.filter(x=>x.key!==key); renderBerkalaTeknisi(); }

/** Jendela pengisian, selalu untuk satu jenis — tabnya yang menentukan. */
function openBerkalaModal(jenis){
  berkalaJenis = berkalaJenisUrut.includes(jenis) ? jenis : berkalaJenisUrut[0];
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

function resetCariBerkala(jenis){
  const t = (BK_TAB[jenis] || '').replace('bk-', '');
  const el = document.getElementById('cariBkTanggal-' + t);
  if(el) el.value = '';
  renderBerkalaList();
}

/** Baris yang tidak beres pada satu lembar. Yang dihitung cuma yang ✕;
    baris yang memang tidak dikerjakan (−) bukan temuan. */
function berkalaTemuan(state, jenis){
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
    const daftar = tgl ? semua.filter(b => String(b.tanggal||'').slice(0,10) === tgl) : semua;

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
  const n = { ok:0, fail:0, minus:0 };
  berkalaItemUntuk(jenis).forEach(it=>{ n[berkalaStatusItem(state, it)] ++; });
  return n;
}

/** Detail dibuka ringkas; tombol di bawahnya membuka seluruh baris. */
let berkalaDetailPenuh = false;

function openBerkalaDetail(id, penuh){
  const b = berkalaList.find(x=>x.id===id);
  if(!b) return;
  berkalaDetailPenuh = !!penuh;
  const n = berkalaHitung(b.state, b.jenis);
  const total = berkalaItemUntuk(b.jenis).length;
  const catatan = b.catatan
    ? `<div style="margin-top:10px;font-size:12.5px;line-height:1.6;"><b>${T('bkCatatan')}:</b> ${escapeHtml(b.catatan)}</div>`
    : '';
  const tombolPenuh = (n.ok < total)
    ? `<div style="margin-top:8px;"><button class="btn ghost" style="padding:6px 10px;"
         onclick="openBerkalaDetail('${b.id}', ${berkalaDetailPenuh ? 'false' : 'true'})">${
           berkalaDetailPenuh ? T('bkHanyaTemuan') : T('bkSeluruhBaris')}</button></div>`
    : '';

  document.getElementById('formDetailJudul').textContent = berkalaLabelJenis(b.jenis);
  document.getElementById('formDetailBody').innerHTML = `
    <div style="font-size:13px;line-height:1.7;margin-bottom:4px;"><b>${escapeHtml(b.tanggal)}</b></div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:10px;">
      <b>${total}</b> ${T('bkBaris')} &middot;
      <span class="status-btn ok" style="cursor:default;">✓</span> ${n.ok} &nbsp;
      <span class="status-btn fail" style="cursor:default;">✕</span> ${n.fail} &nbsp;
      <span class="status-btn minus" style="cursor:default;">−</span> ${n.minus}
    </div>
    ${berkalaTabelBaca(b.state, false, b.jenis, !berkalaDetailPenuh)}
    ${tombolPenuh}
    ${catatan}
    <div class="detail-ttd">
      <div class="sig-block"><b>${T('teknisiPelaksana')}</b>${escapeHtml(b.teknisiNama)||'-'}${sigThumbHtml(b.teknisiTtd)}</div>
      <div class="sig-block"><b>${T('mengetahuiManager')}</b>${escapeHtml(b.managerNama)||'-'}${sigPejabatHtml('berkala', b.id, b.managerTtd, b)}</div>
    </div>
    <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line);">${diinputOlehHtml(b.diinputOleh, b.dibuatPada, String(b.tanggal||'').slice(0,10))}</div>`;
  document.getElementById('formDetailPrintBtn').onclick = ()=>{ closeFormDetail(); printBerkala(id); };
  document.getElementById('formDetailBg').classList.add('show');
}

/* Judul cetakan tetap berbahasa lembar kerjanya, berapa pun bahasa antarmuka
   yang sedang aktif — sama seperti DS Test. */
const BK_JUDUL_CETAK = {
  'neptuno':      'CEK QUERY REKAMAN NEPTUNO',
  'gatevox':      'RESTART CPU GATEVOX',
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
  const nama = (b.teknisiNamaList && b.teknisiNamaList.length) ? b.teknisiNamaList : [b.teknisiNama || ''];
  const judul = BK_JUDUL_CETAK[b.jenis] || BK_JUDUL_CETAK.neptuno;
  const n = berkalaHitung(b.state, b.jenis);
  const catatan = b.catatan
    ? `<div style="font-size:8.5pt;margin-top:8px;"><b>CATATAN :</b> ${escapeHtml(b.catatan)}</div>`
    : '';
  doPrint(`
    ${kopCetak()}
    <div style="text-align:center;font-weight:bold;font-size:12pt;margin-bottom:4px;">${escapeHtml(judul)}</div>
    <div style="text-align:center;font-size:9pt;margin-bottom:10px;">TANGGAL : ${escapeHtml(b.tanggal)}</div>
    ${berkalaTabelBaca(b.state, true, b.jenis, false)}
    <div style="font-size:8.5pt;margin-top:8px;">
      <b>REKAP :</b> ✓ ${n.ok} &nbsp;&nbsp; ✕ ${n.fail} &nbsp;&nbsp; − ${n.minus}
      &nbsp;&nbsp;dari ${berkalaItemUntuk(b.jenis).length} baris
    </div>
    ${catatan}
    <div style="font-size:8.5pt;margin-top:4px;"><b>NB :</b> ✓ : OK &nbsp;&nbsp; ✕ : NOT OK &nbsp;&nbsp; − : TIDAK DIKERJAKAN</div>
    <table class="no-border" style="font-size:9pt;margin-top:14px;">
      <tr>
        <td style="width:55%;text-align:center;vertical-align:top;">
          <div style="margin-bottom:6px;">TEKNISI PELAKSANA :</div>
          ${nama.map((n,i)=>`<div>${i+1}. ${escapeHtml(n) || '______________________'}</div>`).join('')}
          <div style="height:40px;margin-top:4px;">${ttdImg(b.teknisiTtd, 34)}</div>
        </td>
        <td style="text-align:center;vertical-align:top;">
          <div>Mengetahui,</div>
          <div style="margin-bottom:4px;">Manager Teknik</div>
          <div style="height:46px;">${ttdImg(b.managerTtd, 40)}</div>
          <div style="border-top:1px solid #000;display:inline-block;padding:0 24px;">${escapeHtml(b.managerNama)||'&nbsp;'}</div>
        </td>
      </tr>
    </table>`, 'portrait');
}
