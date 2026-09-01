/* E-Logbook · js/17-ds-test.js — Tab DS Test: sampling 9 sesi (95 channel)
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh.

   Form-nya mengikuti workbook "Checklist Pengecekan DS compatible.xlsx":
   sampling 10-11 channel per pengecekan dari 95 total (64 Domestik + 31
   Internasional). Sembilan sesi selang-seling menutupi semuanya tanpa
   duplikat — sesi ganjil 8 Dom + 3 Intl (11 baris), sesi genap 6 Dom + 4
   Intl (10 baris). Konstanta DS_DOM, DS_INTL, DS_PLAN dan helper dsKunci
   sudah didefinisikan di 12b-daily-check-radtel-jatsc.js — berkas ini
   memakai ulang supaya daftar channel dan pembagian sesi cuma ada satu
   sumber.

   Kolom baris — ikut lembar upload:
     No · Channel DS Sampling · Kategori (otomatis) · Test Incoming ·
     Test Outgoing · Voltage Off Hook (VDC) · Voltage On Hook (VDC) ·
     Indikasi Tegangan (otomatis) · Remark

   Ambang tegangan (dari sheet PANDUAN di workbook): Off Hook 40–60 VDC,
   On Hook 0–15 VDC. Indikasi "Normal" hanya kalau kedua pembacaan ada
   dan di dalam ambang; kalau salah satu di luar → "Abnormal"; kalau
   salah satunya kosong → "—". Ambang dipatok di berkas ini; kalau
   standar berubah, ubah DS_VOLT_AMBANG. */

/* ---------- Konstanta ---------- */

/** Batas tegangan sesuai sheet PANDUAN. */
const DS_VOLT_AMBANG = { offMin:40, offMax:60, onMin:0, onMax:15 };

/** Cycle status baris: klik memutar ok → notok → noans → ok. Beda dari
    format lama (ok/fail/minus) karena Excel-nya memakai NO ANSWER, bukan
    "tidak dicek". Format lama tetap dirender untuk catatan lama. */
const DS_STAT_URUT   = { ok:'notok', notok:'noans', noans:'ok' };
const DS_STAT_SIMBOL = { ok:'✓', notok:'✕', noans:'?' };
const DS_STAT_LABEL  = { ok:'OK', notok:'NOT OK', noans:'NO ANSWER' };

/* ---------- Katalog channel (lookup kategori & datalist) ----------
   Diambil dari DS_DOM/DS_INTL di 12b-daily-check-radtel-jatsc.js. */
const DS_CHANNEL_KAT = (function(){
  const m = {};
  (typeof DS_DOM  === 'object' ? DS_DOM  : []).forEach(c => { m[c] = 'Domestik'; });
  (typeof DS_INTL === 'object' ? DS_INTL : []).forEach(c => { m[c] = 'Internasional'; });
  return m;
})();
const dsCariKategori = (code) => DS_CHANNEL_KAT[String(code || '').trim()] || '';

/* ---------- State form ---------- */

let dsSiteSemua = {};
let dsKategoriUrut = ['sampling', 'domestik', 'internasional', 'sli-gsm', 'pabx'];

/** Kategori untuk catatan baru selalu 'sampling'. Kategori lain hanya dipakai
    untuk membaca/mencetak catatan lama. */
const DS_KATEGORI_BARU = 'sampling';
let dsKategori = DS_KATEGORI_BARU;

/** Sesi yang sedang diisi (1..9). Auto-advance ke sesi berikut yang belum
    tersimpan; siklus balik ke 1 setelah sesi 9 disimpan. */
let dsSesi = 1;
const DS_TEST_SESI_KEY = 'elogbook.dsTest.sesiTerakhir';
function dsSesiBerikutTest(){
  let terakhir = 0;
  try{ terakhir = +localStorage.getItem(DS_TEST_SESI_KEY) || 0; }catch(_){}
  return (terakhir >= 1 && terakhir <= 9) ? (terakhir % 9) + 1 : 1;
}
function dsCatatSesiTest(sesi){ try{ localStorage.setItem(DS_TEST_SESI_KEY, String(sesi)); }catch(_){} }

/** Baris form: array of {kat, code, in, out, voff, von, remark}. kat sudah
    ditentukan berdasarkan posisi (baris Dom dulu, lalu baris Intl) — user
    hanya memilih code-nya, tidak boleh menyeberang kategori. code kosong
    saat baris pertama kali dibuat. */
let dsRows = [];

/** Kunci LocalStorage untuk daftar channel yang SUDAH dipakai dalam siklus
    9-sesi yang sedang berjalan. Bertambah setiap simpan; direset otomatis
    setelah 95 channel penuh, atau bisa direset manual lewat resetDsCycle(). */
const DS_TEST_DIPAKAI_KEY = 'elogbook.dsTest.dipakaiCycle';
function dsDipakai(){
  try{ const v = JSON.parse(localStorage.getItem(DS_TEST_DIPAKAI_KEY) || '[]');
       return Array.isArray(v) ? v : []; }catch(_){ return []; }
}
function dsCatatDipakai(codes){
  const set = new Set(dsDipakai());
  (codes || []).forEach(c => { if(c) set.add(String(c).trim().toUpperCase()); });
  // Kalau siklus habis (semua 95 channel tersentuh), langsung reset supaya
  // pengisian berikutnya mulai bersih dari sesi 1 lagi.
  if(set.size >= 95){
    try{ localStorage.removeItem(DS_TEST_DIPAKAI_KEY); }catch(_){}
  }else{
    try{ localStorage.setItem(DS_TEST_DIPAKAI_KEY, JSON.stringify([...set])); }catch(_){}
  }
}
function dsResetCycle(){
  if(!confirm('Reset daftar channel yang sudah dicek di siklus ini? Sesi berikutnya akan kembali menawarkan semua channel.')) return;
  try{ localStorage.removeItem(DS_TEST_DIPAKAI_KEY); }catch(_){}
  try{ localStorage.removeItem(DS_TEST_SESI_KEY); }catch(_){}
  dsSesi = 1;
  dsRows = dsBangunBarisSesi(dsSesi);
  const selSesi = document.getElementById('dsSesi');
  if(selSesi){ selSesi.innerHTML = dsSesiPilihanHtml(); selSesi.value = String(dsSesi); }
  renderDsTable();
  toast('Siklus DS Test direset — mulai lagi dari sesi 1.');
}

let dsTeknisiRows = [];
let dsTeknisiSeq = 0;

/* ---------- Backwards-compat: helper untuk catatan lama ---------- */

const dsSiteUntuk = (kategori) => dsSiteSemua[kategori || 'domestik'] || [];
const dsPakaiSite = (kategori) => dsSiteUntuk(kategori).some(s => s.site);
const dsLabelKategori = (kategori) => T('dsKat_' + (kategori || 'domestik'));

/* Kode site pernah berubah nama (PNK 3 → PNK FIC dst). Catatan lama memakai
   kunci lama; tanpa alias nilainya terbaca kosong. */
function dsAmbilState(state, s){
  if(!state) return {};
  if(state[s.code]) return state[s.code];
  for(const lama of (s.alias || [])) if(state[lama]) return state[lama];
  return {};
}

/** True jika `state` sudah pakai format baru (sampling). Yang lama tetap
    dibiarkan seperti aslinya supaya cetakan lama tidak berubah bentuk. */
const dsFormatBaru = (state) => !!(state && state.__format === 'sampling');

/* ---------- Map catatan dari server ---------- */
const mapDs = d => ({
  id:d.ID, tanggal:d.Tanggal, state:d.State||{}, kategori:d.Kategori||'domestik',
  managerNama:d.ManagerNama||'', managerTtd:d.ManagerTTD||'',
  teknisiNama:d.TeknisiNama||'', teknisiNamaList:d.TeknisiNamaListJSON||[],
  teknisiTtd:d.TeknisiTTD||'', diinputOleh:d.DiinputOleh||'', dibuatPada:d.DibuatPada||'',
  ttdOleh:d.TtdOleh||'', ttdPada:d.TtdPada||'', ttdUntuk:d.TtdUntuk||''
});

/* ---------- Bangun baris dari sesi ---------- */

/** Baris kosong untuk sesi tertentu. Kategori per baris ditetapkan dari
    kuota sesi (Domestik dulu, lalu Internasional) — user memilih code-nya
    sendiri lewat dropdown yang sudah dibatasi per-kategori & minus channel
    yang sudah dipakai di siklus ini. */
function dsBangunBarisSesi(sesi){
  const rencana = DS_PLAN[Math.max(1, Math.min(9, sesi)) - 1];
  const kats = [
    ...rencana.dom.map(()=> 'Domestik'),
    ...rencana.intl.map(()=> 'Internasional')
  ];
  return kats.map(kat => ({ kat, code:'', in:'ok', out:'ok', voff:'', von:'', remark:'' }));
}

function initDsBaruUntukSesi(sesi){
  dsSesi = Math.max(1, Math.min(9, sesi || 1));
  dsRows = dsBangunBarisSesi(dsSesi);
}

/** Channel yang boleh dipilih pada baris `idx`. Sumbernya:
    - kategori baris (Dom atau Intl) — user tidak boleh menyeberang
    - MINUS channel yang tersimpan sebagai "dipakai" di siklus ini
    - MINUS pilihan baris lain di form yang sedang diisi
    - PLUS pilihan baris ini sendiri (supaya <option> tetap valid ketika
      dropdown baris ini kebetulan memilih channel yang sudah "dipakai"
      -- misal saat catatan lama dibuka atau siklus tanpa sengaja dihitung dua kali). */
function dsOpsiUntukBaris(idx){
  const r = dsRows[idx];
  if(!r) return [];
  const semua = r.kat === 'Internasional' ? DS_INTL : DS_DOM;
  const tabu = new Set(dsDipakai());
  dsRows.forEach((rr, i) => { if(i !== idx && rr.code) tabu.add(rr.code); });
  return semua.filter(c => !tabu.has(c) || c === r.code);
}

/* ---------- Indikasi tegangan (otomatis) ---------- */

/** Tafsir status voltage per baris. Return 'normal' / 'abnormal' / 'kosong'. */
function dsIndikasi(voff, von){
  const off = parseFloat(voff), on = parseFloat(von);
  const punyaOff = !isNaN(off), punyaOn = !isNaN(on);
  if(!punyaOff && !punyaOn) return 'kosong';
  if(!punyaOff || !punyaOn)  return 'kosong';
  const a = DS_VOLT_AMBANG;
  const okOff = off >= a.offMin && off <= a.offMax;
  const okOn  = on  >= a.onMin  && on  <= a.onMax;
  return (okOff && okOn) ? 'normal' : 'abnormal';
}
const DS_INDIKASI_LABEL = { normal:'Normal', abnormal:'Abnormal', kosong:'—' };
const DS_INDIKASI_KELAS = { normal:'ok', abnormal:'fail', kosong:'minus' };

/* ---------- Interaksi baris ---------- */

function toggleDsBaru(idx, kolom){
  const r = dsRows[idx]; if(!r) return;
  r[kolom] = DS_STAT_URUT[r[kolom]] || 'ok';
  renderDsTable();
}
function setDsRowCode(idx, nilai){
  const r = dsRows[idx]; if(!r) return;
  r.code = String(nilai || '').trim().toUpperCase();
  // Kategorinya ikut ter-refresh karena dihitung ulang saat render.
  renderDsTable();
}
function setDsRowVolt(idx, kolom, nilai){
  const r = dsRows[idx]; if(!r) return;
  r[kolom] = String(nilai || '');
  // Indikasi tegangan bergantung padanya — perlu render ulang sel indikasi.
  renderDsTable();
}
function setDsRowRemark(idx, nilai){
  const r = dsRows[idx]; if(!r) return;
  r.remark = String(nilai || '');
}

function gantiDsSesi(nilai){
  const s = Math.max(1, Math.min(9, parseInt(nilai, 10) || 1));
  if(s === dsSesi) return;
  // Baris di sesi baru selalu mulai kosong — sesi berbeda punya kuota Dom/Intl
  // yang berbeda, jadi mempertahankan isian antar-sesi bisa menyalahi kuota.
  const ada = dsRows.some(r => r.code || (r.voff||'') || (r.von||'') || (r.remark||'') || r.in!=='ok' || r.out!=='ok');
  if(ada && !confirm('Isian sesi ini belum disimpan — pindah sesi akan mengosongkannya. Lanjut?')){
    // Kembalikan dropdown ke sesi lama.
    const sel = document.getElementById('dsSesi'); if(sel) sel.value = String(dsSesi);
    return;
  }
  dsSesi = s;
  dsRows = dsBangunBarisSesi(s);
  renderDsTable();
}

/* ---------- Render form ---------- */

function dsSesiPilihanHtml(){
  return DS_PLAN.map(p => {
    const total = p.dom.length + p.intl.length;
    return `<option value="${p.sesi}"${p.sesi===dsSesi?' selected':''}>Sesi ${p.sesi} — ${p.dom.length} Dom + ${p.intl.length} Intl (${total})</option>`;
  }).join('');
}

function renderDsTable(){
  const head = document.getElementById('dsThead');
  const body = document.getElementById('dsBody');
  if(!body) return;

  if(head){
    head.innerHTML = `<tr>
      <th style="width:34px;">No</th>
      <th style="width:180px;">Channel DS Sampling</th>
      <th style="width:96px;">Kategori</th>
      <th style="width:82px;">Test Incoming</th>
      <th style="width:82px;">Test Outgoing</th>
      <th style="width:96px;">Off Hook (VDC)</th>
      <th style="width:96px;">On Hook (VDC)</th>
      <th style="width:96px;">Indikasi</th>
      <th>Remark</th>
    </tr>`;
  }

  const sel = (idx, kolom) => {
    const s = (dsRows[idx] || {})[kolom] || 'ok';
    const cls = s === 'notok' ? 'fail' : (s === 'noans' ? 'minus' : 'ok');
    return `<td><button class="status-btn ${cls}" title="${DS_STAT_LABEL[s]||'OK'}"
              onclick="toggleDsBaru(${idx},'${kolom}')">${DS_STAT_SIMBOL[s]||'✓'}</button></td>`;
  };
  const volt = (idx, kolom) => `<td>
    <input type="number" step="any" class="rk-ket" style="text-align:right;"
           value="${escapeHtml((dsRows[idx]||{})[kolom]||'')}" placeholder="–"
           oninput="setDsRowVolt(${idx},'${kolom}', this.value)"></td>`;

  const rows = dsRows.map((r, idx)=>{
    const ind = dsIndikasi(r.voff, r.von);
    const indKelas = DS_INDIKASI_KELAS[ind];
    const indLabel = DS_INDIKASI_LABEL[ind];
    // Opsi channel per baris: hanya kategori baris, minus yang sudah dipakai
    // di siklus & minus yang sedang dipilih baris lain.
    const opsi = dsOpsiUntukBaris(idx);
    const opsiHtml = [
      `<option value="">— pilih —</option>`,
      ...opsi.map(c => `<option value="${escapeHtml(c)}"${c===r.code?' selected':''}>${escapeHtml(c)}</option>`)
    ].join('');
    return `<tr>
      <td>${idx + 1}</td>
      <td><select class="rk-ket" style="width:100%;background:var(--panel-2);border:1px solid var(--line);color:var(--text);border-radius:6px;padding:6px 8px;"
                  onchange="setDsRowCode(${idx}, this.value)">${opsiHtml}</select></td>
      <td class="rk-frek" style="white-space:nowrap;">
        <span class="tag ok" style="font-size:10.5px;">${escapeHtml(r.kat)}</span>
      </td>
      ${sel(idx,'in')}${sel(idx,'out')}
      ${volt(idx,'voff')}${volt(idx,'von')}
      <td style="text-align:center;">
        <span class="tag ${indKelas}" style="font-size:10.5px;">${escapeHtml(indLabel)}</span>
      </td>
      <td><input type="text" class="rk-ket" value="${escapeHtml(r.remark||'')}"
                 oninput="setDsRowRemark(${idx}, this.value)"></td>
    </tr>`;
  }).join('');
  body.innerHTML = rows;

  // Info sesi & progres siklus. Angka "dipakai" dihitung dari daftar
  // dsDipakai() (channel yang sudah masuk catatan tersimpan) + baris yang
  // sedang dipilih di form ini (belum tersimpan, tapi sudah tidak bisa
  // dipilih baris lain).
  const info = document.getElementById('dsSesiInfo');
  if(info){
    const rencana = DS_PLAN[dsSesi - 1];
    const dipakai = new Set(dsDipakai());
    const sedang  = new Set();
    dsRows.forEach(r => { if(r.code) sedang.add(r.code); });
    const dom = rencana.dom.length, intl = rencana.intl.length;
    info.innerHTML =
      `<b>Sesi ${dsSesi}/9</b> — kuota ${dom} Dom + ${intl} Intl.` +
      ` Siklus: <b>${dipakai.size}/95</b> tersimpan, ${sedang.size} sedang dipilih, sisa <b>${95 - dipakai.size - sedang.size}</b>.`;
  }
}

/* ---------- Teknisi ---------- */

function renderDsTeknisi(){
  const wrap = document.getElementById('dsTeknisiList');
  wrap.innerHTML = dsTeknisiRows.map((t,i)=>`
    <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;">
      <span style="font-family:var(--font-mono);color:var(--accent);font-size:12px;min-width:18px;">${i+1}.</span>
      <input type="text" value="${escapeHtml(t.nama)}" placeholder="${T('namaTeknisiPelaksana')} ${i+1}"
             list="teknisiDatalist"
             oninput="dsTeknisiRows[${i}].nama=this.value"
             style="flex:1;background:var(--panel-2);border:1px solid var(--line);color:var(--text);border-radius:6px;padding:9px 10px;font-size:16px;">
      ${dsTeknisiRows.length>1 ? `<button class="icon-btn" onclick="hapusDsTeknisi('${t.key}')">✕</button>` : ''}
    </div>`).join('');
}
function addDsTeknisi(){
  const isiAwal = dsTeknisiRows.length === 0 && userSaatIni ? (userSaatIni.nama || userSaatIni.username || '') : '';
  dsTeknisiRows.push({key:'d'+(dsTeknisiSeq++), nama: isiAwal});
  renderDsTeknisi();
}
function hapusDsTeknisi(key){ dsTeknisiRows = dsTeknisiRows.filter(x=>x.key!==key); renderDsTeknisi(); }

/* ---------- Modal (buka / tutup / simpan) ---------- */

function openDsModal(){
  document.getElementById('dsTanggal').value = tanggalHariIni();
  document.getElementById('dsManagerNama').value = '';
  document.getElementById('dsManagerAkun').value = '';
  dsTeknisiRows = []; dsTeknisiSeq = 0; addDsTeknisi();
  ['sigDs'].forEach(id=>{ if(!sigPads[id]) setupSigCanvas(id); resizeSigCanvas(id); clearSig(id); });

  dsKategori = DS_KATEGORI_BARU;
  initDsBaruUntukSesi(dsSesiBerikutTest());
  // Sinkronkan pemilih sesi.
  const selSesi = document.getElementById('dsSesi');
  if(selSesi){ selSesi.innerHTML = dsSesiPilihanHtml(); selSesi.value = String(dsSesi); }
  renderDsTable();

  document.getElementById('dsModalBg').classList.add('show');
  setTimeout(()=>['sigDs'].forEach(resizeSigCanvas), 60);
}
function closeDsModal(){ document.getElementById('dsModalBg').classList.remove('show'); }

async function saveDs(){
  // Semua baris wajib punya channel — kalau ada yang kosong, kuota sesi tidak
  // terpenuhi dan channel yang belum kepilih akan menumpuk ke sesi belakang.
  const kosong = dsRows.map((r,i)=> r.code ? null : (i+1)).filter(Boolean);
  if(kosong.length){
    toast(`Baris ${kosong.join(', ')} belum dipilih channel-nya.`);
    return;
  }
  const btn = document.getElementById('dsSaveBtn'); btn.disabled = true;
  try{
    const state = {
      __format: 'sampling',
      __sesiDs: dsSesi,
      rows: dsRows.map(r => ({
        code:   String(r.code||'').trim().toUpperCase(),
        kat:    r.kat || dsCariKategori(r.code),
        in:     r.in || 'ok',
        out:    r.out || 'ok',
        voff:   String(r.voff || ''),
        von:    String(r.von  || ''),
        remark: String(r.remark || '')
      }))
    };
    const saved = await gsRun('addDsTest', {
      unit: unitAktif,
      kategori: DS_KATEGORI_BARU,
      tanggal: document.getElementById('dsTanggal').value,
      state,
      teknisiNamaList: dsTeknisiRows.map(t=>(t.nama||'').trim()).filter(Boolean),
      teknisiTtd: getSigDataUrl('sigDs'),
      managerNama: document.getElementById('dsManagerNama').value.trim(),
      ttdUntuk: ttdUntukTerpilih('dsManagerAkun', document.getElementById('dsManagerNama').value)
    });
    dsList.unshift(mapDs(saved));
    renderDsList();
    // Ingat sesi yang barusan tersimpan (untuk auto-advance form berikutnya)
    // dan tambahkan seluruh channel-nya ke daftar "sudah dipakai di siklus"
    // — supaya form berikutnya tidak menawarkan channel yang sama.
    dsCatatSesiTest(dsSesi);
    dsCatatDipakai(state.rows.map(r => r.code));
    closeDsModal();
    toast(T('dsTersimpan'));
  }catch(e){ toast(T('gagalSimpan') + ' — ' + (e.message || T('coba'))); }
  btn.disabled = false;
}

function resetCariDs(){ document.getElementById('cariDsTanggal').value = ''; renderDsList(); }

/* ---------- Ringkasan temuan ---------- */

/** Untuk catatan format baru: yang dihitung = baris ber-status NOT OK atau
    baris dengan indikasi tegangan Abnormal. Baris NO ANSWER bukan gangguan
    channel (bisa jadi remote memang tidak menjawab), tetap dicatat terpisah. */
function dsTemuanBaru(state){
  const gagal = [];
  (state.rows || []).forEach(r=>{
    const buruk = r.in === 'notok' || r.out === 'notok';
    const abnormal = dsIndikasi(r.voff, r.von) === 'abnormal';
    if(buruk || abnormal) gagal.push(r.code || '?');
  });
  return gagal;
}

/** Format lama tetap seperti sebelumnya. */
function dsTemuanLama(state, kategori){
  return dsSiteUntuk(kategori).filter(s=>{
    const b = dsAmbilState(state, s);
    return b.in === 'fail' || b.out === 'fail';
  }).map(s=>s.code);
}

function dsTemuan(state, kategori){
  return dsFormatBaru(state) ? dsTemuanBaru(state) : dsTemuanLama(state, kategori);
}

/* ---------- Daftar riwayat ---------- */

function renderDsList(){
  const wrap = document.getElementById('dsList');
  if(!wrap) return;
  const tgl = (document.getElementById('cariDsTanggal') || {}).value || '';
  const daftar = tgl ? dsList.filter(d=>String(d.tanggal||'').slice(0,10) === tgl) : dsList;

  if(dsList.length === 0){ wrap.innerHTML = '<div class="empty">' + T('belumAdaDs') + '</div>'; return; }
  if(daftar.length === 0){ wrap.innerHTML = '<div class="empty">' + T('takAdaHasil') + '</div>'; return; }

  wrap.innerHTML = daftar.map(d=>{
    const gagal = dsTemuan(d.state, d.kategori);
    const baru = dsFormatBaru(d.state);
    const jenis = baru
      ? `Sampling · Sesi ${+d.state.__sesiDs || '?'}/9`
      : escapeHtml(dsLabelKategori(d.kategori));
    return `<div class="dc-history-item">
      <div><b>${escapeHtml(d.tanggal)}</b> &middot; ${jenis}</div>
      <span class="tag ${gagal.length ? 'fail' : 'ok'}">${gagal.length ? gagal.length + ' ' + T('siteBermasalah') : T('semuaLolos')}</span>
      <div style="font-size:11.5px;color:var(--muted);">${T('teknisiPelaksana')}: ${escapeHtml(d.teknisiNama)||'-'}</div>
      ${diinputOlehHtml(d.diinputOleh, d.dibuatPada, String(d.tanggal||'').slice(0,10))}
      <div style="display:flex;gap:4px;">
        <button class="btn ghost" style="padding:6px 10px;" onclick="openDsDetail('${d.id}')">${T('detail')}</button>
        <button class="icon-btn" title="${T('cetak')}" onclick="printDs('${d.id}')">🖨</button>
        <button class="icon-btn hanya-admin" title="${T('hapus')}" onclick="hapusDs('${d.id}')">✕</button>
      </div>
    </div>`;
  }).join('');
}

async function hapusDs(id){
  if(!adminAktif()){ toast(T('hanyaAdminHapus')); return; }
  const d = dsList.find(x=>x.id===id);
  if(!confirm(`${T('konfirmasiHapus')} ${d ? d.tanggal : ''}?`)) return;
  const salinan = dsList.slice();
  dsList = dsList.filter(x=>x.id!==id);
  renderDsList();
  try{ await gsRun('deleteDsTest', id); }
  catch(e){ dsList = salinan; renderDsList(); toast(T('gagalHapus') + ' — ' + (e.message||T('coba'))); }
}

/* ---------- Baca-saja: format baru (sampling) ---------- */

function dsTabelSamplingBaca(state, cetak){
  const sesi = +state.__sesiDs || 0;
  const rows = Array.isArray(state.rows) ? state.rows : [];
  const kelasCetakSt = { ok:'p-ok', notok:'p-fail', noans:'p-minus' };
  const kelasCetakInd = { normal:'p-ok', abnormal:'p-fail', kosong:'p-minus' };

  const selSt = s => cetak
    ? `<td style="text-align:center;"><span class="${kelasCetakSt[s]||'p-ok'}">${DS_STAT_SIMBOL[s]||'✓'}</span></td>`
    : `<td><span class="status-btn ${s==='notok'?'fail':(s==='noans'?'minus':'ok')}" style="cursor:default;">${DS_STAT_SIMBOL[s]||'✓'}</span></td>`;

  const volt = v => `<td style="text-align:right;white-space:nowrap;">${escapeHtml(String(v ?? '').trim() || '–')}</td>`;

  const barisHtml = rows.map((r, i)=>{
    const kat = r.kat || dsCariKategori(r.code) || '—';
    const ind = dsIndikasi(r.voff, r.von);
    const indLabel = DS_INDIKASI_LABEL[ind];
    const indHtml = cetak
      ? `<td style="text-align:center;"><span class="${kelasCetakInd[ind]||'p-minus'}">${escapeHtml(indLabel)}</span></td>`
      : `<td style="text-align:center;"><span class="tag ${DS_INDIKASI_KELAS[ind]}" style="font-size:10.5px;">${escapeHtml(indLabel)}</span></td>`;
    return `<tr>
      <td style="text-align:center;">${i+1}</td>
      <td style="text-align:left;">${escapeHtml(r.code||'')}</td>
      <td style="text-align:left;">${escapeHtml(kat)}</td>
      ${selSt(r.in||'ok')}${selSt(r.out||'ok')}
      ${volt(r.voff)}${volt(r.von)}
      ${indHtml}
      <td style="text-align:left;font-size:${cetak?'7.5pt':'11px'};">${escapeHtml(r.remark||'')}</td>
    </tr>`;
  }).join('');

  const t = cetak ? 'td' : 'th';
  const kelas = cetak ? ' class="p-kepala"' : '';
  const thead = `<tr${kelas}>
    <${t}>NO</${t}><${t}>CHANNEL DS SAMPLING</${t}><${t}>KATEGORI</${t}>
    <${t}>TEST INCOMING</${t}><${t}>TEST OUTGOING</${t}>
    <${t}>OFF HOOK (VDC)</${t}><${t}>ON HOOK (VDC)</${t}>
    <${t}>INDIKASI TEGANGAN</${t}><${t}>REMARK</${t}></tr>`;
  const tabel = `<table class="${cetak?'':'dc ds'}" style="font-size:${cetak?'8pt':''};">
    <thead>${thead}</thead><tbody>${barisHtml}</tbody></table>`;
  const kepala = cetak
    ? `<div style="font-size:9pt;margin-bottom:4px;">SAMPLING SESI ${sesi}/9 — ${rows.length} channel</div>`
    : `<div style="font-size:12px;color:var(--muted);margin-bottom:6px;">Sampling Sesi ${sesi}/9 — ${rows.length} channel</div>`;
  return kepala + (cetak ? tabel : `<div class="dc-table-wrap">${tabel}</div>`);
}

/* ---------- Baca-saja: format lama (per-kategori) — dipertahankan
   supaya catatan lama tetap bisa dibuka & dicetak apa adanya. ---------- */

/** Kepala tabel format lama. */
function dsTheadHtml(kategori, cetak){
  const t = cetak ? 'td' : 'th';
  const kelas = cetak ? ' class="p-kepala"' : '';
  const lebarNo  = cetak ? '' : ' style="width:34px;"';
  const lebarKet = cetak ? '' : ' style="width:26%;"';
  const lebarSt  = cetak ? '' : ' style="width:82px;"';
  const lebarV   = cetak ? '' : ' style="width:76px;"';
  const site = dsPakaiSite(kategori) ? `<${t} rowspan="2">SITE</${t}>` : '';
  return `<tr${kelas}><${t} rowspan="2"${lebarNo}>NO</${t}>${site}<${t} rowspan="2">CODE</${t}>
      <${t} colspan="2">NEW JATSC</${t}><${t} colspan="2">VOLTAGE</${t}><${t} rowspan="2"${lebarKet}>KETERANGAN</${t}></tr>
    <tr${kelas}><${t}${lebarSt}>INCOMING</${t}><${t}${lebarSt}>OUTGOING</${t}>
      <${t}${lebarV}>INCOMING</${t}><${t}${lebarV}>OUTGOING</${t}></tr>`;
}

function dsTabelLamaBaca(state, cetak, kategori){
  const SYM = { ok:'✓', fail:'✕', minus:'−' };
  const kelasCetak = { ok:'p-ok', fail:'p-fail', minus:'p-minus' };
  const sel = s => cetak
    ? `<td style="text-align:center;"><span class="${kelasCetak[s]||'p-ok'}">${SYM[s]||'✓'}</span></td>`
    : `<td><span class="status-btn ${s==='fail'||s==='minus'?s:'ok'}" style="cursor:default;">${SYM[s]||'✓'}</span></td>`;
  const pakaiSite = dsPakaiSite(kategori);
  const volt = (nilai) => `<td style="text-align:right;white-space:nowrap;">${escapeHtml(String(nilai ?? '').trim() || '–')}</td>`;
  const baris = dsSiteUntuk(kategori).map(s=>{
    const b = dsAmbilState(state, s);
    return `<tr><td style="text-align:center;">${s.no}</td>
      ${pakaiSite ? `<td style="text-align:left;">${escapeHtml(s.site)}</td>` : ''}
      <td style="text-align:left;">${escapeHtml(s.code)}</td>
      ${sel(b.in||'ok')}${sel(b.out||'ok')}
      ${volt(b.vin)}${volt(b.vout)}
      <td style="text-align:left;font-size:${cetak?'7.5pt':'11px'};">${escapeHtml(b.ket||'')}</td></tr>`;
  }).join('');
  const tabel = `<table class="${cetak?'':'dc ds'}" style="font-size:${cetak?'8pt':''};">
    <thead>${dsTheadHtml(kategori, cetak)}</thead><tbody>${baris}</tbody></table>`;
  return cetak ? tabel : `<div class="dc-table-wrap">${tabel}</div>`;
}

function dsTabelBaca(state, cetak, kategori){
  return dsFormatBaru(state)
    ? dsTabelSamplingBaca(state, cetak)
    : dsTabelLamaBaca(state, cetak, kategori);
}

/* ---------- Detail & cetak ---------- */

function openDsDetail(id){
  const d = dsList.find(x=>x.id===id);
  if(!d) return;
  const baru = dsFormatBaru(d.state);
  const jenis = baru
    ? `Sampling · Sesi ${+d.state.__sesiDs || '?'}/9`
    : escapeHtml(dsLabelKategori(d.kategori));
  document.getElementById('formDetailJudul').textContent = T('dsModal');
  document.getElementById('formDetailBody').innerHTML = `
    <div style="font-size:13px;line-height:1.7;margin-bottom:10px;"><b>${escapeHtml(d.tanggal)}</b> &middot; ${jenis}</div>
    ${dsTabelBaca(d.state, false, d.kategori)}
    <div class="detail-ttd">
      <div class="sig-block"><b>${T('teknisiPelaksana')}</b>${escapeHtml(d.teknisiNama)||'-'}${sigThumbHtml(d.teknisiTtd)}</div>
      <div class="sig-block"><b>${T('mengetahuiManager')}</b>${renderPihakKedua('dstest', d.id, d.managerNama, d.managerTtd)}${sigPejabatHtml('dstest', d.id, d.managerTtd, d)}</div>
    </div>
    <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line);">${diinputOlehHtml(d.diinputOleh, d.dibuatPada, String(d.tanggal||'').slice(0,10))}</div>`;
  document.getElementById('formDetailPrintBtn').onclick = ()=>{ closeFormDetail(); printDs(id); };
  document.getElementById('formDetailBg').classList.add('show');
}

/* Judul cetakan format lama. */
const DS_JUDUL_CETAK = {
  domestik:      'DS DOMESTIC NEW JATSC',
  internasional: 'DS INTERNATIONAL NEW JATSC',
  'sli-gsm':     'SLI & GSM NEW JATSC',
  pabx:          'PABX NEW JATSC',
  sampling:      'CHECKLIST PENGECEKAN DIRECT SPEECH (DS)'
};

function printDs(id){
  const d = dsList.find(x=>x.id===id);
  if(!d) return;
  if(!tolakCetakBilaBelumTtd(d, 'dstest')) return;
  const nama = (d.teknisiNamaList && d.teknisiNamaList.length) ? d.teknisiNamaList : [d.teknisiNama || ''];
  const baru = dsFormatBaru(d.state);
  const judul = baru
    ? 'CHECKLIST PENGECEKAN DIRECT SPEECH (DS)'
    : (DS_JUDUL_CETAK[d.kategori] || DS_JUDUL_CETAK.domestik);
  const legend = baru
    ? '<b>NB :</b> ✓ : OK &nbsp;&nbsp; ✕ : NOT OK &nbsp;&nbsp; ? : NO ANSWER &nbsp;&nbsp; · Indikasi tegangan: Off Hook 40–60 VDC, On Hook 0–15 VDC.'
    : '<b>NB :</b> ✓ : OK &nbsp;&nbsp; ✕ : NOT OK &nbsp;&nbsp; − : TIDAK DICEK';
  doPrint(`
    <div style="text-align:center;font-weight:bold;font-size:12pt;margin-bottom:4px;">${escapeHtml(judul)}</div>
    <div style="text-align:center;font-size:9pt;margin-bottom:10px;">TANGGAL : ${escapeHtml(d.tanggal)}</div>
    ${dsTabelBaca(d.state, true, d.kategori)}
    <div style="font-size:8.5pt;margin-top:8px;">${legend}</div>
    <table class="no-border" style="font-size:9pt;margin-top:14px;">
      <tr>
        <td style="width:55%;text-align:center;vertical-align:top;">
          <div style="margin-bottom:6px;">TEKNISI PELAKSANA :</div>
          ${nama.map((n,i)=>`<div>${i+1}. ${d.teknisiTtd ? (escapeHtml(n) || '______________________') : '______________________'}</div>`).join('')}
          <div style="height:40px;margin-top:4px;">${ttdImg(d.teknisiTtd, 34)}</div>
        </td>
        <td style="text-align:center;vertical-align:top;">
          <div>Mengetahui,</div>
          <div style="margin-bottom:4px;">Manager Teknik</div>
          <div style="height:46px;">${ttdImg(d.managerTtd, 40)}</div>
          <div style="border-top:1px solid #000;display:inline-block;padding:0 24px;">${d.managerTtd ? (escapeHtml(d.managerNama)||'&nbsp;') : '&nbsp;'}</div>
        </td>
      </tr>
    </table>`, 'landscape');
}
