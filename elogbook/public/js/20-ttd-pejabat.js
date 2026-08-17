/* E-Logbook · js/20-ttd-pejabat.js — Tanda tangan susulan oleh pejabat / manager teknik
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh. */

/* ============== TANDA TANGAN SUSULAN ==============
   Teknisi mengisi formulirnya saat dinas; tanda tangan pihak kedua sering baru
   dibubuhkan berhari-hari kemudian. Di jendela detail, petak tanda tangan yang
   masih kosong berubah menjadi tombol bagi yang berhak — sisanya tetap membaca
   "belum TTD" seperti biasa.

   NAMA PADA FORMULIR TIDAK BERUBAH. Nama penanggung jawab atau manager teknik
   sudah ditulis teknisi waktu mengisi, dan itulah nama yang tercetak. Akun yang
   membubuhkan hanya tercatat sebagai keterangan status di layar detail.

   Yang menahan sebenarnya tetap server: ia menolak permintaan dari peran lain,
   dan menolak menimpa petak yang sudah terisi.

   Kalau catatan menunjuk akun tertentu (ttdUntuk — lihat ttdUntukDariNama),
   tombolnya hanya muncul untuk akun itu sendiri atau admin. Nama pada
   formulir bisa saja sekadar sebutan jabatan ("PH", dsb.), bukan nama asli
   pemegang akun, jadi yang menentukan siapa berhak adalah akun yang
   ditunjuk — bukan kecocokan nama. Kalau catatan tidak menunjuk siapa pun
   (ttdUntuk kosong), pejabat mana pun tetap boleh membubuhkan seperti
   sebelum fitur penunjukan ini ada. */

function bolehTtdSusulan(ttdUntuk){
  if(!userSaatIni) return false;
  if(userSaatIni.role === 'admin') return true;
  if(userSaatIni.role !== 'pejabat') return false;
  return !ttdUntuk || userSaatIni.username === ttdUntuk;
}

/** "2026-08-07T09:12:33.000Z" → "2026-08-07 09:12 UTC". Sesuai aturan seluruh
    aplikasi: waktu selalu UTC, tidak pernah zona waktu perangkat. */
function waktuTtdTeks(iso){
  const s = String(iso || '');
  return s.length >= 16 ? `${s.slice(0,10)} ${s.slice(11,16)} UTC` : '';
}

/** Keterangan siapa yang membubuhkan — status, bukan nama pada formulir. */
function statusTtdHtml(rec){
  if(!rec || !rec.ttdOleh) return '';
  const kapan = waktuTtdTeks(rec.ttdPada);
  return `<div class="ttd-status">${T('ditandatanganiOleh')} ${escapeHtml(rec.ttdOleh)}${kapan ? ' &middot; ' + kapan : ''}</div>`;
}

/**
 * Petak tanda tangan pihak kedua di jendela detail.
 * Sudah ada TTD  → gambarnya, ditambah keterangan siapa yang membubuhkan.
 * Masih kosong   → tombol, kalau yang membuka memang berhak.
 */
function sigPejabatHtml(jenis, id, ttdUrl, rec){
  if(ttdUrl) return sigThumbHtml(ttdUrl) + statusTtdHtml(rec);
  if(!bolehTtdSusulan(rec?.ttdUntuk)) return sigThumbHtml('');
  return `<button class="btn btn-ttd" onclick="openTtdModal('${jenis}','${id}')">${T('bubuhkanTtd')}</button>`;
}

/* ---------- Jendela pembubuhan ---------- */

let ttdTarget = null;   // { jenis, id }

const TTD_JUDUL = {
  logbook:'ttdSbgPj', dailycheck:'ttdSbgManager', monitoring:'ttdSbgOps',
  dstest:'ttdSbgManager', ltk:'ttdSbgManager'
};

/** Nama yang sudah tertulis pada formulir, dari catatan yang ada di memori. */
function namaPadaFormulir(jenis, id){
  switch(jenis){
    case 'logbook':    return entries.find(x=>x.id===id)?.pjNama || '';
    case 'dailycheck': return dcHistory.find(x=>x.id===id)?.managerNama || '';
    case 'monitoring': return monitoring.find(x=>x.id===id)?.personilOps || '';
    case 'dstest':     return dsList.find(x=>x.id===id)?.managerNama || '';
    case 'ltk':        return ltkList.find(x=>x.id===id)?.managerNama || '';
    default:           return '';
  }
}

function openTtdModal(jenis, id){
  ttdTarget = { jenis, id };
  document.getElementById('ttdSbgPeran').textContent = T(TTD_JUDUL[jenis] || 'ttdSbgManager');

  // Nama pada formulir ditulis teknisi dan tidak diganti. Yang ditampilkan di
  // sini nama itu, bukan nama akun — supaya jelas paraf ini untuk siapa.
  const namaForm = namaPadaFormulir(jenis, id);
  document.getElementById('ttdSbgNama').textContent = namaForm || T('namaBelumDiisi');
  document.getElementById('ttdSbgNama').classList.toggle('kosong', !namaForm);
  document.getElementById('ttdCatatanNama').textContent =
    namaForm ? T('ttdNamaTetap') : T('ttdNamaKosong');
  document.getElementById('ttdSbgAkun').textContent =
    (userSaatIni && (userSaatIni.nama || userSaatIni.username)) || '-';
  // Papan tanda tangan disiapkan init(); kalau jendela ini sempat dibuka lebih
  // dulu, siapkan sekarang daripada memberi kanvas mati yang tak bisa digambari.
  if(!sigPads['sigTtdPejabat']) setupSigCanvas('sigTtdPejabat');
  clearSig('sigTtdPejabat');
  document.getElementById('ttdModalBg').classList.add('show');
  // Kanvas baru saja terlihat: lebarnya masih 0 sampai modal tergambar.
  setTimeout(()=>resizeSigCanvas('sigTtdPejabat'), 60);
}

function closeTtdModal(){
  document.getElementById('ttdModalBg').classList.remove('show');
  ttdTarget = null;
}

/**
 * Setelah server menyimpan, catatan di memori ikut diperbarui lalu daftarnya
 * digambar ulang — tanpa memuat ulang seluruh data dari server.
 */
/* r.nama datang dari server: nama pada formulir apa adanya, hanya terisi
   sendiri kalau tadinya memang kosong. */
const TTD_TERAP = {
  logbook: (r)=>{
    const e = entries.find(x=>x.id===r.id);
    if(e){ e.pjNama = r.nama; e.pjTtd = r.ttd; e.ttdOleh = r.ttdOleh; e.ttdPada = r.ttdPada; }
    renderEntries();
  },
  dailycheck: (r)=>{
    const d = dcHistory.find(x=>x.id===r.id);
    if(d){ d.managerNama = r.nama; d.managerTtd = r.ttd; d.ttdOleh = r.ttdOleh; d.ttdPada = r.ttdPada; }
    renderDcHistory();
  },
  monitoring: (r)=>{
    const m = monitoring.find(x=>x.id===r.id);
    if(m){ m.personilOps = r.nama; m.personilOpsTtd = r.ttd; m.ttdOleh = r.ttdOleh; m.ttdPada = r.ttdPada; }
    renderMonList();
  },
  dstest: (r)=>{
    const d = dsList.find(x=>x.id===r.id);
    if(d){ d.managerNama = r.nama; d.managerTtd = r.ttd; d.ttdOleh = r.ttdOleh; d.ttdPada = r.ttdPada; }
    renderDsList();
  },
  ltk: (r)=>{
    const l = ltkList.find(x=>x.id===r.id);
    if(l){ l.managerNama = r.nama; l.managerTtd = r.ttd; l.ttdOleh = r.ttdOleh; l.ttdPada = r.ttdPada; }
    renderLtkList();
  }
};

/** Jendela detail mana yang harus dibuka ulang supaya TTD-nya langsung terlihat. */
const TTD_BUKA_ULANG = {
  logbook: (id)=>openEntryDetail(id),
  dailycheck: (id)=>openDcDetail(id),
  monitoring: (id)=>openMonDetail(id),
  dstest: (id)=>openDsDetail(id),
  ltk: (id)=>openLtkDetail(id)
};

async function simpanTtdPejabat(){
  if(!ttdTarget) return;
  const data = getSigDataUrl('sigTtdPejabat');
  if(!data){ toast(T('ttdKosong')); return; }
  await kirimTtdPejabat(data, 'ttdSaveBtn');
}

/** Jalur simpan yang sama untuk goresan tangan maupun tanda tangan tersimpan
    milik akun (27-ttd-tersimpan.js) — keduanya sekadar gambar PNG. */
async function kirimTtdPejabat(data, btnId){
  if(!ttdTarget) return;
  const { jenis, id } = ttdTarget;
  const btn = document.getElementById(btnId);
  if(btn) btn.disabled = true;
  try{
    const hasil = await gsRun('tandaTangani', jenis, id, data);
    if(hasil && TTD_TERAP[jenis]) TTD_TERAP[jenis](hasil);
    hapusDariInboxTtd(jenis, id);
    closeTtdModal();
    tutupSemuaDetail();
    toast(T('ttdTersimpan'));
    // Buka lagi jendela detailnya, supaya hasilnya langsung kelihatan di tempat
    // yang sama — bukan sekadar pesan bahwa katanya tersimpan.
    if(TTD_BUKA_ULANG[jenis]) TTD_BUKA_ULANG[jenis](id);
  }catch(e){
    toast(e.message || T('ttdGagal'));
  }
  if(btn) btn.disabled = false;
}

/** Jendela detail dipakai bergantian antar tab, jadi semuanya ditutup dulu. */
function tutupSemuaDetail(){
  ['entryDetailBg','dcDetailBg','formDetailBg'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.classList.remove('show');
  });
}

/* ============== TUNJUK AKUN UNTUK TTD SUSULAN ==============
   Isian nama penanggung jawab / manager teknik / personil operasi tetap teks
   bebas seperti sebelumnya — supaya catatan lama dan cara mengisi yang sudah
   terbiasa tidak berubah. <datalist> menyarankan nama akun pejabat/admin yang
   dikenal server saat mengetik, dan begitu yang diketik PERSIS sama dengan
   nama salah satu akun itu, id akunnya ikut terkirim sebagai ttdUntuk.

   Kecocokan nama saja kadang tidak cukup: nama yang tercetak pada formulir
   bisa jadi sebutan sang PH ("PH Bagus", dsb.), sementara TTD-nya tetap harus
   sampai ke kotak masuk akun pejabat yang sebenarnya, yang namanya berbeda
   dari yang tercetak. Untuk itu tiap isian nama ini didampingi <select>
   pilihan akun eksplisit — kalau dipilih, itu yang menang; kalau dibiarkan
   "Otomatis", baru kecocokan nama seperti sebelumnya yang dipakai. Mengetik
   nama yang tidak cocok sama sekali dan tidak memilih akun pun tidak apa-apa,
   sama seperti sebelum fitur ini ada: sekadar tidak ada yang diberi tahu. */

/** Tiap <select> pilihan akun TTD susulan, satu per formulir yang punya isian nama pejabat. */
const AKUN_TTD_SELECT_ID = ['fePjAkun','dcManagerAkun','monOpsAkun','dsManagerAkun','ltkManagerAkun'];

/** Isi <datalist> saran nama akun dan tiap <select> pilihan akun eksplisit —
    dipanggil sekali saat data dimuat. */
function isiPilihanPejabat(){
  const dl = document.getElementById('pejabatDatalist');
  if(dl) dl.innerHTML = pejabatList.map(p=>`<option value="${escapeHtml(p.nama)}">`).join('');

  const opsi = `<option value="" data-t="kirimTtdOtomatis">${T('kirimTtdOtomatis')}</option>` +
    pejabatList.map(p=>`<option value="${escapeHtml(p.username)}">${escapeHtml(p.nama)}</option>`).join('');
  AKUN_TTD_SELECT_ID.forEach(id=>{
    const el = document.getElementById(id);
    if(!el) return;
    const lama = el.value;
    el.innerHTML = opsi;
    if([...el.options].some(o=>o.value===lama)) el.value = lama;
  });
}

/** Nama yang diketik teknisi -> username akun, kalau memang cocok persis. */
function ttdUntukDariNama(nama){
  const n = String(nama||'').trim();
  if(!n) return '';
  const p = pejabatList.find(x=>x.nama===n);
  return p ? p.username : '';
}

/** Akun TTD susulan untuk satu formulir: pilihan eksplisit dari <select>
    menang, baru kalau dibiarkan "Otomatis" jatuh ke kecocokan nama. */
function ttdUntukTerpilih(selectId, nama){
  const el = document.getElementById(selectId);
  return (el && el.value) || ttdUntukDariNama(nama);
}

/* ============== KOTAK MASUK TTD ==============
   Daftar catatan yang menunjuk akun yang sedang masuk dan belum ditandatangani
   siapa pun — lintas unit, karena pejabat dan admin memang berhak atas semua
   unit. Server sudah menyaring ini (getInboxTtd); di sini cuma menampilkannya
   dan membukakan jalan ke jendela detail yang sesuai. */

/** Tab mana yang harus aktif untuk tiap jenis catatan — sama dengan nama jenisnya. */
const INBOX_TAB = { logbook:'logbook', dailycheck:'dailycheck', monitoring:'monitoring', dstest:'dstest', ltk:'ltk' };

function renderInboxBadge(){
  const badge = document.getElementById('inboxCount');
  if(!badge) return;
  const n = inboxTtd.length;
  badge.textContent = n > 99 ? '99+' : String(n);
  badge.style.display = n > 0 ? '' : 'none';
}

function renderInboxBody(){
  const wrap = document.getElementById('inboxBody');
  if(!wrap) return;
  if(inboxTtd.length === 0){ wrap.innerHTML = '<div class="empty">' + T('inboxKosong') + '</div>'; return; }
  wrap.innerHTML = inboxTtd.map(it=>`
    <div class="dc-history-item" style="cursor:pointer;" onclick="bukaInboxItem('${it.jenis}','${it.unit}','${it.id}')">
      <div><b>${escapeHtml(it.label)}</b> &middot; ${escapeHtml(it.tanggal)||'-'}</div>
      <div style="font-size:11.5px;color:var(--muted);">${escapeHtml(it.nama)||'-'}</div>
    </div>`).join('');
}

/** Sekali dibubuhkan, catatan itu tak lagi menunggu siapa pun — hilangkan
    dari daftar dan angka kotak masuk di layar tanpa perlu memuat ulang. */
function hapusDariInboxTtd(jenis, id){
  const sebelum = inboxTtd.length;
  inboxTtd = inboxTtd.filter(it => !(it.jenis === jenis && it.id === id));
  if(inboxTtd.length !== sebelum){
    renderInboxBadge();
    renderInboxBody();
  }
}

function openInboxModal(){
  renderInboxBody();
  document.getElementById('inboxModalBg').classList.add('show');
}
function closeInboxModal(){ document.getElementById('inboxModalBg').classList.remove('show'); }

/** Klik satu baris kotak masuk: pindah ke unit dan tab catatan itu kalau
    perlu, lalu buka jendela detailnya — tempat yang sama untuk membubuhkan TTD. */
async function bukaInboxItem(jenis, unit, id){
  closeInboxModal();
  if(unit && unit !== unitAktif){
    unitAktif = unit;
    simpanUnit(unit);
    tutupPratinjau();
    await init();
  }
  const tab = INBOX_TAB[jenis];
  if(tab) pilihTab(tab);
  if(TTD_BUKA_ULANG[jenis]) TTD_BUKA_ULANG[jenis](id);
}
