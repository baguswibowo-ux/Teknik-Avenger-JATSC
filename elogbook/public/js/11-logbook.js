/* E-Logbook · js/11-logbook.js — Tab Logbook Fasilitas: form, daftar, dan detail catatan
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh. */

/* ============== TAB 1 — LOGBOOK ============== */
/* daftar nama teknisi dinamis untuk form logbook (TTD cukup satu) */
let feTeknisiRows = [];
let feTeknisiSeq = 0;
function renderFeTeknisiList(){
  const wrap = document.getElementById('feTeknisiList');
  wrap.innerHTML = feTeknisiRows.map((t,i)=>`
    <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;">
      <span style="font-family:var(--font-mono);color:var(--accent);font-size:12px;min-width:18px;">${i+1}.</span>
      <input type="text" value="${escapeHtml(t.nama)}" placeholder="Nama teknisi ${i+1}"
             list="teknisiDatalist"
             oninput="feTeknisiRows[${i}].nama=this.value" style="flex:1;background:var(--panel-2);border:1px solid var(--line);color:var(--text);border-radius:6px;padding:9px 10px;font-size:16px;">
      ${feTeknisiRows.length>1 ? `<button class="icon-btn" title="Hapus" onclick="removeFeTeknisi('${t.key}')">✕</button>` : ''}
    </div>`).join('');
}
function addFeTeknisi(){
  // Baris pertama pra-isi dengan yang sedang login — dialah teknisi yang lagi
  // berdinas dan yang mengisi. Baris berikutnya kosong; kalau salah orang atau
  // admin yang mengisi atas nama, tinggal diganti. Pola sama seperti BAPB & LTK.
  const isiAwal = feTeknisiRows.length === 0 && userSaatIni ? (userSaatIni.nama || userSaatIni.username || '') : '';
  feTeknisiRows.push({key:'f'+(feTeknisiSeq++), nama: isiAwal});
  renderFeTeknisiList();
}
function removeFeTeknisi(key){ feTeknisiRows = feTeknisiRows.filter(x=>x.key!==key); renderFeTeknisiList(); }
function collectFeTeknisiNama(){ return feTeknisiRows.map(t=>(t.nama||'').trim()).filter(Boolean); }

/* ---------- Lokasi gedung ----------
   Fasilitas satu unit tersebar di dua gedung — JATSC lama dan New JATSC — dan
   lembar catatannya memang dibedakan per gedung. Daftarnya datang dari server
   (lokasiPilihan), jadi menambah gedung ketiga kelak tidak menyentuh berkas ini. */

const KUNCI_LOKASI = 'elogbook_lokasi';

/** Gedung yang dipakai kalau perangkat ini belum pernah memilih sama sekali. */
const LOKASI_BAWAAN = 'New JATSC';

/** Isi kedua pemilih lokasi: di form tambah catatan dan di bilah cetak. */
function isiPilihanLokasi(){
  const opsi = lokasiPilihan.map(l=>`<option>${escapeHtml(l)}</option>`).join('');

  const fe = document.getElementById('feLokasi');
  if(fe){
    const lama = fe.value;
    fe.innerHTML = opsi;
    // Satu dinas biasanya dijalani di gedung yang sama sepanjang hari, jadi
    // pilihan terakhir di perangkat ini dipakai lagi daripada diminta ulang
    // tiap kali menambah catatan.
    const pilih = lama || localStorage.getItem(KUNCI_LOKASI) || LOKASI_BAWAAN;
    if([...fe.options].some(o=>o.value===pilih)) fe.value = pilih;
  }

  const pr = document.getElementById('prLokasi');
  if(pr){
    const lama = pr.value;
    pr.innerHTML = `<option value="" data-t="semua">${T('semua')}</option>` + opsi;
    if([...pr.options].some(o=>o.value===lama)) pr.value = lama;
  }
}

/** Keterangan lokasi di kartu dan jendela detail — kosong kalau catatannya
    memang dibuat sebelum gedung mulai dicatat. */
const lokasiTeks = (e) => e.lokasi ? ' &middot; ' + escapeHtml(e.lokasi) : '';

function openEntryModal(){
  document.getElementById('entryModalBg').classList.add('show');
  document.getElementById('feTanggal').value = tanggalHariIni();
  document.getElementById('feJam').value = jamSekarang();
  document.getElementById('feUraian').value = '';
  document.getElementById('feJamSelesai').value = '';
  document.getElementById('feFrek').value = '';
  terapkanUnit();
  const dOpt = document.getElementById('feDinas').options;
  if(dOpt.length) document.getElementById('feDinas').selectedIndex = 0;
  isiPilihanLokasi();
  document.getElementById('fePjNama').value = '';
  document.getElementById('fePjAkun').value = '';
  resetLampiran('feLampiran');
  feTeknisiRows = []; feTeknisiSeq = 0; addFeTeknisi();  // mulai 1 baris nama
  ['sigFeTeknisi'].forEach(id=>{
    if(!sigPads[id]) setupSigCanvas(id);
    resizeSigCanvas(id);
    clearSig(id);
  });
}
function closeEntryModal(){ document.getElementById('entryModalBg').classList.remove('show'); }

async function saveEntry(){
  const uraian = document.getElementById('feUraian').value.trim();
  if(!uraian){ toast(T('uraianKosong')); return; }
  const btn = document.getElementById('feSaveBtn'); btn.disabled = true;
  const namaList = collectFeTeknisiNama();
  const lokasi = document.getElementById('feLokasi').value;
  const payload = {
    tanggal: document.getElementById('feTanggal').value,
    jam: document.getElementById('feJam').value,
    jamSelesai: document.getElementById('feJamSelesai').value,
    frek: document.getElementById('feFrek').value.trim(),
    dinas: document.getElementById('feDinas').value,
    lokasi,
    uraian,
    teknisiNamaList: namaList,
    teknisiNama: namaList.join(', '),
    teknisiTtd: getSigDataUrl('sigFeTeknisi'),
    pjNama: document.getElementById('fePjNama').value.trim(),
    ttdUntuk: ttdUntukTerpilih('fePjAkun', document.getElementById('fePjNama').value),
    lampiran: kirimLampiran('feLampiran'),
    unit: unitAktif
  };
  toast(kotakLampiran('feLampiran').length ? 'Mengunggah lampiran dan menyimpan...' : 'Menyimpan ke server...');
  try{
    const saved = await gsRun('addEntry', payload);
    if(lokasi) localStorage.setItem(KUNCI_LOKASI, lokasi);   // jadi bawaan catatan berikutnya
    entries.unshift(mapEntry(saved));
    renderEntries();
    closeEntryModal();
    toast(T('tersimpanCatatan'));
  }catch(e){ toast('Gagal menyimpan — ' + (e.message||'coba lagi.')); }
  btn.disabled = false;
}

async function deleteEntry(id){
  if(!adminAktif()){ toast(T('hanyaAdminHapus')); return; }
  const e = entries.find(x=>x.id===id);
  if(!confirm(`Hapus catatan ${e ? (e.tanggal+' '+e.jam+' UTC') : 'ini'}? Lampirannya ikut terhapus dan tidak bisa dikembalikan.`)) return;
  const salinan = entries.slice();
  entries = entries.filter(x=>x.id!==id);
  renderEntries();
  try{ await gsRun('deleteEntry', id); }
  catch(err){ entries = salinan; renderEntries(); toast('Gagal menghapus — ' + (err.message||'coba lagi.')); }
}

/** Waktu yang tertulis di catatan, sebagai pembanding stempel input server
    (lihat jejakInputHtml). Kalau jamnya kosong, tanggalnya saja yang dibanding. */
function acuanWaktuEntry(e){
  const tgl = String(e.tanggal || '').slice(0,10);
  if(!tgl) return '';
  const jam = String(e.jam || '').slice(0,5);
  return jam ? `${tgl}T${jam}` : tgl;
}

/** Seluruh unit kini mencatat jam mulai dan selesai. Yang dibaca tetap
    isinya, bukan setelan unitnya: catatan lama — dan catatan baru yang jam
    selesainya sengaja dikosongkan — tetap tampil sebagai satu jam saja. */
function jamTeks(e){
  const mulai = e.jam || '-';
  return e.jamSelesai ? `${mulai}–${e.jamSelesai}` : mulai;
}

/** Nama teknisi selalu dipakai sebagai daftar; data lama menyimpannya sebagai satu teks dipisah koma. */
function teknisiListOf(r){
  if(r.teknisiNamaList && r.teknisiNamaList.length) return r.teknisiNamaList;
  return r.teknisiNama ? String(r.teknisiNama).split(',').map(s=>s.trim()).filter(Boolean) : [];
}

/** Filter tanggal/dinas/lokasi/teks dari bilah cetak, dipakai juga untuk memilah
    daftar yang tampil — supaya kasus lama yang mirip dengan yang sedang dicari
    langsung terpanggil tanpa menggulir seluruh riwayat. Pencarian teks tidak
    peka huruf besar/kecil dan menelusuri uraian, frekuensi, dinas, lokasi,
    nama teknisi (termasuk daftar), dan nama penanggung jawab. */
function entriesTersaring(){
  const from   = (document.getElementById('prFrom')   || {}).value || '';
  const to     = (document.getElementById('prTo')     || {}).value || '';
  const dinas  = (document.getElementById('prDinas')  || {}).value || '';
  const lokasi = (document.getElementById('prLokasi') || {}).value || '';
  const cari   = String((document.getElementById('prCari') || {}).value || '').trim().toLowerCase();
  if(!from && !to && !dinas && !lokasi && !cari) return entries;
  return entries.filter(e=>{
    const d = String(e.tanggal || '').slice(0,10);
    if(from && d < from) return false;
    if(to   && d > to)   return false;
    if(dinas && String(e.dinas || '') !== dinas) return false;
    if(lokasi && String(e.lokasi || '') !== lokasi) return false;
    if(cari){
      const namaTeknisi = teknisiListOf(e).join(' ');
      const ladang = [
        e.uraian, e.frek, e.dinas, e.lokasi, e.pjNama, e.diinputOleh,
        namaTeknisi, e.teknisiNama, d
      ].map(x => String(x || '').toLowerCase()).join(' \n ');
      if(!ladang.includes(cari)) return false;
    }
    return true;
  });
}
function resetFilterEntries(){
  ['prFrom','prTo','prDinas','prLokasi','prCari'].forEach(id=>{ const el = document.getElementById(id); if(el) el.value = ''; });
  renderEntries();
}
function renderEntries(){
  const wrap = document.getElementById('entryList');
  if(entries.length===0){ wrap.innerHTML = '<div class="empty">' + T('belumAdaCatatan') + '</div>'; return; }
  const daftar = entriesTersaring();
  if(daftar.length===0){ wrap.innerHTML = '<div class="empty">' + T('takAdaFilter') + '</div>'; return; }
  wrap.innerHTML = daftar.map(e=>{
    const namaList = teknisiListOf(e);
    const tekLabel = namaList.length ? namaList.map((n,i)=>`${i+1}. ${escapeHtml(n)}`).join('<br>') : 'Teknisi Pelaksana';
    return `
    <div class="entry">
      <div class="entry-top">
        <span class="entry-time">${e.tanggal || '-'} &middot; ${jamTeks(e)} UTC${e.dinas ? ' &middot; ' + T('dinasSingkat') + ' ' + escapeHtml(e.dinas) : ''}${lokasiTeks(e)}${e.frek ? ' &middot; ' + escapeHtml(e.frek) : ''}${e.lampiran.length ? ` &middot; <span class="tag-lampiran">📎 ${e.lampiran.length}</span>` : ''}</span>
        <div style="display:flex;gap:4px;align-items:center;">
          <button class="btn ghost" style="padding:5px 9px;font-size:12px;" onclick="openEntryDetail('${e.id}')">${T('detail')}</button>
          ${(!e.pjTtd && bolehSuntingCatatan(e.dibuatOlehUsername)) ? `<button class="icon-btn" title="${T('suntingCatatanIni')}" onclick="openEntryEditModal('${e.id}')">✎</button>` : ''}
          <!-- Tombol cetak per baris sudah dihilangkan. Cetakan hanya lewat "Cetak Logbook"
               di bilah atas, dan itu pun menolak selama ada catatan yang TTD-nya belum
               lengkap — teknisi yang bernama di baris itu dapat peringatan lewat lonceng
               di Dashboard Fasilitas Teknik untuk membubuhkan TTD-nya lebih dulu. -->
          <button class="icon-btn hanya-admin" title="Hapus" onclick="deleteEntry('${e.id}')">✕</button>
        </div>
      </div>
      <div class="entry-body">${escapeHtml(e.uraian)}</div>
      <div class="entry-sigs">
        <div class="sig-block"><b>${tekLabel}</b>${sigThumbHtml(e.teknisiTtd)}</div>
        <div class="sig-block"><b>${escapeHtml(e.pjNama)||'Manager Teknik'}</b>${sigThumbHtml(e.pjTtd)}</div>
        <div style="flex:1;display:flex;align-items:flex-end;justify-content:flex-end;">${diinputOlehHtml(e.diinputOleh, e.dibuatPada, acuanWaktuEntry(e))}</div>
      </div>
    </div>`;
  }).join('');
}

/* ---------- Lihat detail satu catatan logbook ---------- */
function closeEntryDetail(){ document.getElementById('entryDetailBg').classList.remove('show'); }

function openEntryDetail(id){
  const e = entries.find(x=>x.id===id);
  if(!e){ toast('Catatan tidak ditemukan.'); return; }

  const namaList = teknisiListOf(e);
  const tekHtml = (namaList.length ? namaList.map((n,i)=>`<div>${i+1}. ${escapeHtml(n)}</div>`).join('')
                                   : '<div style="color:var(--muted);">-</div>')
                + sigThumbHtml(e.teknisiTtd);

  document.getElementById('entryDetailBody').innerHTML = `
    <div class="entry-time" style="font-size:13px;margin-bottom:12px;display:block;">
      ${escapeHtml(e.tanggal)||'-'} &middot; ${escapeHtml(jamTeks(e))} UTC${e.dinas ? ' &middot; ' + T('dinasSingkat') + ' ' + escapeHtml(e.dinas) : ''}${lokasiTeks(e)}${e.frek ? ' &middot; ' + T('frek') + ' ' + escapeHtml(e.frek) : ''}
    </div>
    <div style="font-family:var(--font-mono);font-size:10.5px;color:var(--muted);text-transform:uppercase;margin-bottom:6px;">${T('uraianPekerjaan')}</div>
    <div class="entry-detail-uraian">${escapeHtml(e.uraian)||'-'}</div>
    ${lampiranGaleriHtml(e.lampiran)}
    <div class="detail-ttd">
      <div class="sig-block"><b>${T('teknisiPelaksana')}</b>${tekHtml}</div>
      <div class="sig-block"><b>${T('penanggungJawab')}</b>${
        renderPihakKedua('entry', e.id, e.pjNama, e.pjTtd, 'penanggung jawab')
      }${sigPejabatHtml('logbook', e.id, e.pjTtd, e)}</div>
    </div>
    <div style="margin-top:14px;padding-top:10px;border-top:1px solid var(--line);">${diinputOlehHtml(e.diinputOleh, e.dibuatPada, acuanWaktuEntry(e)) || ('<span class="diinput-oleh">' + T('tidakTercatat') + '</span>')}</div>`;

  // Tombol Cetak per catatan sudah dihilangkan — tidak perlu memasang handler.
  const editBtn = document.getElementById('entryDetailEditBtn');
  editBtn.onclick = ()=>{ closeEntryDetail(); openEntryEditModal(id); };
  // Sudah disetujui penanggung jawab, atau bukan pembuat aslinya (dan bukan
  // admin) — kedua kasus itu tidak boleh menyunting.
  editBtn.style.display = (!e.pjTtd && bolehSuntingCatatan(e.dibuatOlehUsername)) ? '' : 'none';
  document.getElementById('entryDetailBg').classList.add('show');
}

/* ---------- Sunting catatan logbook tersimpan ----------
   Tanggal, jam, dinas, lokasi, uraian, dan lampiran — bukan nama teknisi atau
   tanda tangan. Itu bukti kerja yang sudah dibubuhkan, bukan metadata yang
   boleh ditimpa diam-diam.

   Lampiran ikut bisa disunting karena hasil scan sering baru dipegang setelah
   catatannya tersimpan; jendelanya sama dengan jendela sunting yang lain —
   selama penanggung jawab belum menandatangani. Berkas yang ditandai buang
   tetap ditampilkan sampai Simpan ditekan, supaya salah tekan masih bisa
   dibatalkan. */
let entryEditId = null;

/**
 * Boleh tidaknya papan TTD ditawarkan pada catatan yang sedang dibuka.
 *
 * Dua syarat, dan keduanya perlu:
 *   petaknya memang masih KOSONG — tanda tangan yang sudah dibubuhkan tidak
 *   diganti dari sini, sama seperti aturan TTD susulan pejabat; dan
 *   yang membuka adalah PEMBUAT catatannya sendiri — administrator boleh
 *   membetulkan kalimat orang lain, tapi membubuhkan tanda tangan orang lain
 *   berarti menandatangani atas namanya.
 *
 * Server memutuskan lagi dengan aturan yang sama. Yang di sini cuma soal papan
 * digambar atau tidak.
 */
let entryEditBolehTtd = false;

function siapkanTtdSunting(e){
  const sudahAda = !!e.teknisiTtd;
  const punyaSaya = !!userSaatIni && !!e.dibuatOlehUsername
                    && userSaatIni.username === e.dibuatOlehUsername;
  entryEditBolehTtd = !sudahAda && punyaSaya;

  document.getElementById('feeTtdAda').innerHTML = sudahAda ? sigThumbHtml(e.teknisiTtd) : '';
  document.getElementById('feeTtdPapan').style.display = entryEditBolehTtd ? '' : 'none';
  document.getElementById('feeTtdHint').textContent =
      entryEditBolehTtd ? T('hintTtdSusulan')
    : sudahAda          ? T('hintTtdSudahAda')
                        : T('hintTtdBukanPembuat');

  if(!sigPads['sigFeeTeknisi']) setupSigCanvas('sigFeeTeknisi');
  clearSig('sigFeeTeknisi');
}

/** Lampiran yang sudah tersimpan di catatan yang sedang dibuka, dan mana saja
    yang ditandai untuk dibuang saat perubahan disimpan. */
let entryEditLampiranAda = [];
let entryEditLampiranBuang = [];

function renderEntryEditLampiranAda(){
  const wrap = document.getElementById('feeLampiranAda');
  if(!wrap) return;
  wrap.innerHTML = entryEditLampiranAda.map(l=>{
    const buang = entryEditLampiranBuang.includes(l.ID);
    return `
    <div class="lampiran-item${buang ? ' dibuang' : ''}">
      <span>${String(l.Mime||'').startsWith('image/') ? '🖼' : '📄'}</span>
      <a class="nama" href="${l.Path}" target="_blank" rel="noopener" title="${escapeHtml(l.Nama)}">${escapeHtml(l.Nama)}</a>
      <span class="ukuran">${ukuranTeks(l.Ukuran||0)}</span>
      <button class="icon-btn" title="${buang ? T('batalBuangLampiran') : T('buangLampiran')}" onclick="toggleBuangLampiranEntry('${l.ID}')">${buang ? '↺' : '✕'}</button>
    </div>`;
  }).join('');
}

function toggleBuangLampiranEntry(id){
  entryEditLampiranBuang = entryEditLampiranBuang.includes(id)
    ? entryEditLampiranBuang.filter(x=>x!==id)
    : entryEditLampiranBuang.concat(id);
  renderEntryEditLampiranAda();
}

function openEntryEditModal(id){
  const e = entries.find(x=>x.id===id);
  if(!e){ toast('Catatan tidak ditemukan.'); return; }
  entryEditId = id;

  document.getElementById('feeTanggal').value = e.tanggal || '';
  document.getElementById('feeJam').value = e.jam || '';
  document.getElementById('feeJamSelesai').value = e.jamSelesai || '';
  document.getElementById('feeFrek').value = e.frek || '';
  document.getElementById('feeUraian').value = e.uraian || '';
  isiPilihanLokasiEdit(e.lokasi);

  entryEditLampiranAda = e.lampiran || [];
  entryEditLampiranBuang = [];
  renderEntryEditLampiranAda();
  resetLampiran('feeLampiran');
  siapkanTtdSunting(e);

  const u = infoUnit();
  document.getElementById('feeJamSelesaiWrap').style.display = (u && u.pakaiJamSelesai) ? '' : 'none';
  document.getElementById('feeFrekWrap').style.display = (u && u.pakaiFrek) ? '' : 'none';
  document.getElementById('feeJamLabel').textContent = (u && u.pakaiJamSelesai) ? T('jamMulaiUtc') : T('jamUtc');
  document.getElementById('feeUraianLabel').textContent = (u && u.labelUraian) || T('uraianPekerjaan');

  const dinasSel = document.getElementById('feeDinas');
  dinasSel.innerHTML = (u ? u.dinas : []).map(d=>`<option>${d}</option>`).join('');
  if([...dinasSel.options].some(o=>o.value===e.dinas)) dinasSel.value = e.dinas;

  document.getElementById('entryEditModalBg').classList.add('show');
  // Sesudah jendelanya terlihat, bukan sebelum: kanvas berlebar 0 tidak bisa
  // digambari, dan itulah lebar papan selama modalnya masih tersembunyi.
  if(entryEditBolehTtd) setTimeout(()=>resizeSigCanvas('sigFeeTeknisi'), 60);
}

function isiPilihanLokasiEdit(nilai){
  const el = document.getElementById('feeLokasi');
  el.innerHTML = lokasiPilihan.map(l=>`<option>${escapeHtml(l)}</option>`).join('');
  if([...el.options].some(o=>o.value===nilai)) el.value = nilai;
}

function closeEntryEditModal(){
  document.getElementById('entryEditModalBg').classList.remove('show');
  entryEditId = null;
  entryEditLampiranAda = [];
  entryEditLampiranBuang = [];
  resetLampiran('feeLampiran');
  entryEditBolehTtd = false;
  clearSig('sigFeeTeknisi');
}

async function saveEntryEdit(){
  if(!entryEditId) return;
  const uraian = document.getElementById('feeUraian').value.trim();
  if(!uraian){ toast(T('uraianKosong')); return; }
  const btn = document.getElementById('feeSaveBtn'); btn.disabled = true;
  const patch = {
    tanggal: document.getElementById('feeTanggal').value,
    jam: document.getElementById('feeJam').value,
    jamSelesai: document.getElementById('feeJamSelesai').value,
    frek: document.getElementById('feeFrek').value.trim(),
    dinas: document.getElementById('feeDinas').value,
    lokasi: document.getElementById('feeLokasi').value,
    uraian,
    lampiranBaru: kirimLampiran('feeLampiran'),
    lampiranHapus: entryEditLampiranBuang,
    // Papan kosong menjawab null, dan server membaca itu sebagai "tidak ada
    // yang dibubuhkan" — bukan sebagai perintah mengosongkan.
    teknisiTtd: entryEditBolehTtd ? getSigDataUrl('sigFeeTeknisi') : null
  };
  if(patch.lampiranBaru.length) toast(T('mengunggahLampiran'));
  try{
    const saved = await gsRun('updateEntry', entryEditId, patch);
    const i = entries.findIndex(x=>x.id===entryEditId);
    if(i !== -1) entries[i] = mapEntry(saved);
    renderEntries();
    const adaTtd = !!patch.teknisiTtd;
    closeEntryEditModal();
    toast(adaTtd ? T('ttdSusulanTersimpan') : T('tersimpanPerubahan'));
  }catch(e){ toast('Gagal menyimpan — ' + (e.message||'coba lagi.')); }
  btn.disabled = false;
}
