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

/* ============== PERIKSA KELENGKAPAN TTD SEBELUM CETAK ==============
 * Kalau catatan belum bertanda tangan lengkap — teknisi ATAU manager/PJ belum —
 * tombol Cetak menolak dengan pesan yang menyebut siapa yang belum. Ini yang
 * mencegah cetakan resmi lolos tanpa paraf, dan yang meminta pembuatnya
 * membubuhkan TTD-nya sebelum lembarnya keluar untuk manager.
 *
 * Aturan per jenis catatan:
 *   entry (logbook)  → teknisiTtd + pjTtd
 *   dailycheck       → teknisiTtd + managerTtd
 *   ltk              → teknisiTtd + managerTtd
 *   berkala          → teknisiTtd + managerTtd
 *   dstest           → teknisiTtd + managerTtd
 *   monitoring       → teknisiTtd + personilOpsTtd
 */
const TTD_LENGKAP_META = {
  entry:      [['teknisiTtd','teknisi'],       ['pjTtd','penanggung jawab']],
  logbook:    [['teknisiTtd','teknisi'],       ['pjTtd','penanggung jawab']],
  dailycheck: [['teknisiTtd','teknisi'],       ['managerTtd','manager teknik']],
  dc:         [['teknisiTtd','teknisi'],       ['managerTtd','manager teknik']],
  ltk:        [['teknisiTtd','teknisi'],       ['managerTtd','manager teknik']],
  berkala:    [['teknisiTtd','teknisi'],       ['managerTtd','manager teknik']],
  dstest:     [['teknisiTtd','teknisi'],       ['managerTtd','manager teknik']],
  monitoring: [['teknisiTtd','teknisi'],       ['personilOpsTtd','personil ops']]
};

/** { ok, alasan }. Lengkap → { ok:true }. Belum → { ok:false, alasan:'…' }. */
function cekTtdLengkap(rec, kind){
  const meta = TTD_LENGKAP_META[String(kind || '').toLowerCase()];
  if(!meta || !rec) return { ok: true };
  const kurang = meta.filter(([k]) => !rec[k]).map(([,label]) => label);
  if(!kurang.length) return { ok: true };
  return { ok: false, alasan: kurang.join(' & ') };
}

/**
 * Guard sebelum memanggil doPrint: kalau catatan belum lengkap TTD-nya, tolak
 * dengan toast yang menyebut siapa yang belum. Kembali true kalau boleh
 * dicetak. Berlaku untuk semua peran — dokumen tanpa TTD tidak boleh keluar.
 */
function tolakCetakBilaBelumTtd(rec, kind){
  const c = cekTtdLengkap(rec, kind);
  if(c.ok) return true;
  toast(`Belum ditandatangani oleh ${c.alasan} — cetak ditolak.`);
  return false;
}

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

/* ---------- Ubah nama pihak-kedua dan akun tujuan TTD ----------
   Selama pihak keduanya BELUM membubuhkan tanda tangan, admin bisa mengoreksi
   nama yang salah tunjuk atau memindahkan tujuan TTD ke akun yang benar. Ini
   yang menutup jalur "salah tunjuk MT → hapus catatan → ulang" — nama pada
   formulir jadi bisa dibetulkan sampai batas terakhirnya, yaitu saat MT/PJ
   membubuhkan paraf.

   Kalau MT/PJ sudah tanda tangan, kolomnya beku — mengganti nama di bawah
   tanda tangan yang tercetak sama dengan memalsu arsip; server juga menolak
   (lihat updateTtdRouting di db.js dan db-pg.js). */

/** Daftar akun kandidat untuk kirim TTD — dipakai bersama dengan create-form.
    pejabatList sudah dihimpun listPejabatAktif dari server — admin + pejabat
    yang aktif. Sumber yang sama membuat pilihan di layar edit rute cocok
    persis dengan pilihan di layar pengisian awal. */
function kandidatTtdUntuk(){
  return (typeof pejabatList !== 'undefined' && Array.isArray(pejabatList)) ? pejabatList : [];
}

/**
 * Tampilkan nama pihak kedua di jendela detail. Untuk admin dan belum ada TTD,
 * berikan tombol kecil untuk mengganti nama & akun tujuan — modalnya sederhana,
 * satu isian nama dan satu pemilih akun tujuan.
 */
function renderPihakKedua(kind, id, nama, ttdUrl, sebutan = 'manager teknik'){
  const teks = escapeHtml(nama) || '<span style="color:var(--muted);">-</span>';
  if(ttdUrl) return teks;
  if(!adminAktif()) return teks;
  return `${teks} <button class="btn ghost" style="padding:2px 6px;font-size:11px;vertical-align:middle;"
    title="Ubah nama ${escapeHtml(sebutan)} atau akun tujuan TTD"
    onclick="bukaEditRuteTtd('${kind}','${id}', ${JSON.stringify(String(nama||'')).replace(/'/g,'&#39;')})">${T('ubah','edit')}</button>`;
}

/** Modal ubah rute TTD: dibangun sekali, isinya diisi setiap kali dibuka. */
let ruteTtdTarget = null;
function bukaEditRuteTtd(kind, id, namaLama){
  ruteTtdTarget = { kind, id };
  let lapis = document.getElementById('ruteTtdBg');
  if(!lapis){
    lapis = document.createElement('div');
    lapis.id = 'ruteTtdBg';
    lapis.className = 'modal-bg';
    lapis.innerHTML = `<div class="modal" style="max-width:420px;">
      <div style="font-weight:bold;font-size:15px;margin-bottom:10px;">Ubah rute TTD</div>
      <div class="field" style="margin-bottom:10px;">
        <label style="display:block;font-size:11px;color:var(--muted);margin-bottom:4px;">Nama pihak kedua</label>
        <input id="ruteTtdNama" type="text" style="width:100%;padding:6px 8px;background:var(--panel-2);
          color:var(--text);border:1px solid var(--line);border-radius:5px;box-sizing:border-box;">
      </div>
      <div class="field" style="margin-bottom:10px;">
        <label style="display:block;font-size:11px;color:var(--muted);margin-bottom:4px;">Kirim TTD ke akun</label>
        <select id="ruteTtdAkun" style="width:100%;padding:6px 8px;background:var(--panel-2);
          color:var(--text);border:1px solid var(--line);border-radius:5px;box-sizing:border-box;">
          <option value="">Otomatis (dari nama di atas)</option>
        </select>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;">
        <button class="btn ghost" onclick="tutupEditRuteTtd()">Batal</button>
        <button class="btn" onclick="simpanRuteTtd()">Simpan</button>
      </div>
    </div>`;
    document.body.appendChild(lapis);
    lapis.addEventListener('click', e=>{ if(e.target === lapis) tutupEditRuteTtd(); });
  }
  document.getElementById('ruteTtdNama').value = namaLama || '';
  const sel = document.getElementById('ruteTtdAkun');
  const kandidat = kandidatTtdUntuk();
  sel.innerHTML = '<option value="">Otomatis (dari nama di atas)</option>' +
    kandidat.map(u=>`<option value="${escapeHtml(u.username)}">${escapeHtml(u.nama||u.username)} (${escapeHtml(u.username)})</option>`).join('');
  lapis.classList.add('show');
}

function tutupEditRuteTtd(){
  const l = document.getElementById('ruteTtdBg');
  if(l) l.classList.remove('show');
  ruteTtdTarget = null;
}

async function simpanRuteTtd(){
  if(!ruteTtdTarget) return;
  const { kind, id } = ruteTtdTarget;
  const nama = document.getElementById('ruteTtdNama').value.trim();
  const akun = document.getElementById('ruteTtdAkun').value.trim();
  const patch = { ttdUntuk: akun };
  /* Nama field beda per kind: entry pakai pjNama, lainnya managerNama. Server
     menerima keduanya dan memetakannya ke kolom yang benar. */
  if(kind === 'entry') patch.pjNama = nama;
  else                 patch.managerNama = nama;
  try{
    await gsRun('updateTtdRouting', kind, id, patch);
    /* Perbarui data di memori supaya tampilan segera memantulkan perubahan
       tanpa menunggu muat ulang. Tiap kind punya arraynya sendiri. */
    const arr = kind === 'entry' ? entries
              : kind === 'dc' ? (typeof dcHistory !== 'undefined' ? dcHistory : null)
              : kind === 'ltk' ? (typeof ltkList !== 'undefined' ? ltkList : null)
              : kind === 'berkala' ? (typeof berkalaList !== 'undefined' ? berkalaList : null)
              : kind === 'dstest' ? (typeof dsList !== 'undefined' ? dsList : null)
              : kind === 'bapb' ? (typeof bapbList !== 'undefined' ? bapbList : null)
              : null;
    if(Array.isArray(arr)){
      const rec = arr.find(x=>x.id===id);
      if(rec){
        if(kind === 'entry'){ rec.pjNama = nama; }
        else if(kind === 'bapb'){ rec.teknikNama = nama; }
        else                { rec.managerNama = nama; }
        rec.ttdUntuk = akun;
      }
    }
    tutupEditRuteTtd();
    toast('Rute TTD tersimpan.');
    /* Panggil ulang render dari layar yang membuka detail. Jenis detail
       menentukan renderer mana yang dipakai. */
    if(kind === 'entry' && typeof renderEntries === 'function') renderEntries();
    if(kind === 'dc' && typeof renderDcHistory === 'function') renderDcHistory();
    if(kind === 'ltk' && typeof renderLtkList === 'function') renderLtkList();
    if(kind === 'berkala' && typeof renderBerkalaList === 'function') renderBerkalaList();
    if(kind === 'dstest') segarkanSemuaDaftarDstest();
    if(kind === 'bapb' && typeof renderBapbList === 'function') renderBapbList();
  }catch(e){
    toast('Gagal menyimpan rute TTD — ' + (e.message || 'coba lagi.'));
  }
}

/* ---------- Jendela pembubuhan ---------- */

let ttdTarget = null;   // { jenis, id }

const TTD_JUDUL = {
  logbook:'ttdSbgPj', dailycheck:'ttdSbgManager', monitoring:'ttdSbgOps',
  dstest:'ttdSbgManager', berkala:'ttdSbgManager', ltk:'ttdSbgManager', bapb:'ttdSbgManager'
};

/** Nama yang sudah tertulis pada formulir, dari catatan yang ada di memori. */
function namaPadaFormulir(jenis, id){
  switch(jenis){
    case 'logbook':    return entries.find(x=>x.id===id)?.pjNama || '';
    case 'dailycheck': return dcHistory.find(x=>x.id===id)?.managerNama || '';
    case 'monitoring': return monitoring.find(x=>x.id===id)?.personilOps || '';
    case 'dstest':     return dsList.find(x=>x.id===id)?.managerNama || '';
    case 'berkala':    return berkalaList.find(x=>x.id===id)?.managerNama || '';
    case 'ltk':        return ltkList.find(x=>x.id===id)?.managerNama || '';
    case 'bapb':       return bapbList.find(x=>x.id===id)?.teknikNama || '';
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
/** Semua daftar yang membaca dsList — DS Test, Maintenance Radio, Weekly Check
    Pengamatan, Ground Check LLZ, Meter Reading, dan Pemeliharaan Listrik.
    Tiap daftar menyaring jenisnya sendiri, jadi menyegarkan semuanya aman;
    yang tidak ada di halaman (unit lain) cukup dilewati. */
function segarkanSemuaDaftarDstest(){
  ['renderDsList','renderRadioList','renderSemuaWkList','renderSemuaLlzList',
   'renderSemuaMrList','renderSemuaMlList'].forEach(nama=>{
    if(typeof window[nama] === 'function') window[nama]();
  });
}

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
    // Lima jenis lembar berbagi kind 'dstest' (radio, weekly check, ground
    // check, meter reading, pemeliharaan listrik); segarkan semua daftarnya
    // biar yang mana pun jenisnya langsung memantulkan TTD baru.
    segarkanSemuaDaftarDstest();
  },
  berkala: (r)=>{
    const b = berkalaList.find(x=>x.id===r.id);
    if(b){ b.managerNama = r.nama; b.managerTtd = r.ttd; b.ttdOleh = r.ttdOleh; b.ttdPada = r.ttdPada; }
    renderBerkalaList();
  },
  ltk: (r)=>{
    const l = ltkList.find(x=>x.id===r.id);
    if(l){ l.managerNama = r.nama; l.managerTtd = r.ttd; l.ttdOleh = r.ttdOleh; l.ttdPada = r.ttdPada; }
    renderLtkList();
  },
  bapb: (r)=>{
    // Slot yang dirutekan di BAPB adalah Manager Teknik (teknik_nama/teknik_ttd).
    const b = bapbList.find(x=>x.id===r.id);
    if(b){ b.teknikNama = r.nama; b.teknikTtd = r.ttd; b.ttdOleh = r.ttdOleh; b.ttdPada = r.ttdPada; }
    if(typeof renderBapbList === 'function') renderBapbList();
  }
};

/** Jendela detail mana yang harus dibuka ulang supaya TTD-nya langsung terlihat. */
const TTD_BUKA_ULANG = {
  logbook: (id)=>openEntryDetail(id),
  dailycheck: (id)=>openDcDetail(id),
  monitoring: (id)=>openMonDetail(id),
  dstest: (id)=>openDsDetail(id),
  berkala: (id)=>openBerkalaDetail(id),
  ltk: (id)=>openLtkDetail(id),
  bapb: (id)=>openBapbDetail(id)
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
/* Daftar ini HARUS ditambah setiap kali ada modal baru ber-<select> akun —
   kalau terlewat, pilihannya cuma "Otomatis" dan nama pejabat tidak muncul
   (itu yang terjadi pada mlManagerAkun sebelum masuk daftar ini). */
const AKUN_TTD_SELECT_ID = ['fePjAkun','dcManagerAkun','dcAmhsAkun_amhs','dcAmhsAkun_aadps','dcAmhsAkun_datis','monOpsAkun','dsManagerAkun','radioManagerAkun','wkManagerAkun','llzManagerAkun','mrManagerAkun','mlManagerAkun','bkManagerAkun','ltkManagerAkun','bapbTeknikAkun'];

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

/** Isi <datalist> saran nama teknisi — dipakai baris kedua dst pada semua
    formulir yang punya daftar nama teknisi. Baris pertama tetap otomatis
    nama pengisi dokumen; ini cuma menyarankan nama rekan sedinas yang sudah
    terdaftar di unit yang sedang dibuka, supaya salah eja dan salah singkatan
    tidak lagi tersimpan sebagai salinan berbeda dari orang yang sama. */
function isiPilihanTeknisiUnit(){
  const dl = document.getElementById('teknisiDatalist');
  if(!dl) return;
  const daftar = (typeof teknisiUnitList !== 'undefined' && Array.isArray(teknisiUnitList)) ? teknisiUnitList : [];
  dl.innerHTML = daftar.map(t=>`<option value="${escapeHtml(t.nama || t.username)}">`).join('');
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
/* Pekerjaan berkala punya empat tab tapi satu jenis catatan, jadi tab
   tujuannya baru diketahui dari lembarnya sendiri — lihat tabInbox(). */
const INBOX_TAB = { logbook:'logbook', dailycheck:'dailycheck', monitoring:'monitoring', dstest:'dstest',
                    ltk:'ltk', bapb:'bapb' };

/** Tab yang harus dibuka untuk satu baris kotak masuk. */
function tabInbox(jenis, id){
  if(jenis === 'dstest') return subtabDstest(id);
  if(jenis !== 'berkala') return INBOX_TAB[jenis];
  const b = berkalaList.find(x=>x.id===id);
  return BK_TAB[b ? b.jenis : 'neptuno'] || 'bk-neptuno';
}

/* LTK dan BAPB duduk sebagai sub-tab di dalam satu tab wadah "FORM".
   pilihTab hanya mengenal tab tingkat-atas, jadi keduanya butuh dua langkah:
   buka tab wadahnya dulu, baru klik sub-tabnya. */
/* DS Test & berkala pun sub-tab — di dalam wadah "PREVENTIVE MAINTENANCE".
   Dulu keduanya diserahkan ke pilihTab dengan nama sub-tabnya dan tidak ada
   tombol tingkat-atas yang cocok, jadi kotak masuk membuka detailnya di atas
   tab yang kebetulan sedang aktif. */
const INBOX_SUBTAB = { ltk:'form', bapb:'form', dstest:'preventive', berkala:'preventive' };

/* Lembar-lembar yang menumpang kind 'dstest' masing-masing punya sub-tabnya
   sendiri; yang berlembar banyak (weekly check, pemeliharaan listrik) juga
   menyimpan lembarnya di state, jadi sub-tab tujuannya bisa ditunjuk persis. */
function subtabDstest(id){
  const d = (typeof dsList !== 'undefined' ? dsList : []).find(x=>x.id===id);
  const st = (d && d.state) || {};
  switch(st.__format){
    case 'radio':        return 'radio';
    case 'pgmweekly':    return 'wk-' + (st.__wForm || 'ckg3');
    case 'llzgc':        return 'gcheck';
    case 'mrreading':    return 'meter';
    case 'maintlistrik': return 'ml-' + (st.__mlForm || 'paneldist');
    default:             return 'dstest';
  }
}
function bukaTabInbox(jenis, id){
  const wadah = INBOX_SUBTAB[jenis];
  if(wadah){
    pilihTab(wadah);
    const sub = document.querySelector(`.subtab-btn[data-subtab="${tabInbox(jenis, id)}"]`);
    if(sub) sub.click();
    return;
  }
  const tab = tabInbox(jenis, id);
  if(tab) pilihTab(tab);
}

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
  bukaTabInbox(jenis, id);
  if(TTD_BUKA_ULANG[jenis]) TTD_BUKA_ULANG[jenis](id);
}
