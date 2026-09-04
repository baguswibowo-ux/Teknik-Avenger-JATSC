/* E-Logbook · js/18b-bapb.js — Sub-tab BAPB — Berita Acara Pemasangan Barang
   Dimuat dari index.html sesuai nomor berkas; duduk berdampingan dengan
   18-ltk.js karena keduanya penghuni tab wadah "📄 FORM". */

/* ============== SUB-TAB — BAPB ============== */

/* Kolom baris item mengikuti berkas Excel resminya:
     no · namaBarang · ukuran · banyaknya · tanggalPemasangan · keterangan
   Nomor barisnya di-render otomatis dari urutan array, jadi tidak diketik
   ulang oleh pengisi — kalau baris di tengah dihapus, penomorannya rapi
   kembali tanpa perlu menyunting satu per satu. */
const KOLOM_BAPB_ITEM = ['namaBarang','ukuran','banyaknya','tanggalPemasangan','keterangan'];

let bapbItems = [];
let bapbItemSeq = 0;

/* Daftar teknisi pelaksana — nama saja, bisa lebih dari satu. Tanda tangannya
   tetap satu (sig-pad bersama), sama polanya dengan Monitoring/DS Test/Berkala. */
let bapbPetugasRows = [];
let bapbPetugasSeq = 0;

const mapBapb = b => ({
  id: b.ID,
  nomor: b.Nomor || '',
  tanggal: b.Tanggal || '',
  untukPekerjaan: b.UntukPekerjaan || '',
  lokasi: b.Lokasi || '',
  items: Array.isArray(b.Items) ? b.Items : [],
  pemakaiNama: b.PemakaiNama || '', pemakaiTtd: b.PemakaiTTD || '',
  teknikNama: b.TeknikNama || '',  teknikTtd: b.TeknikTTD || '',
  // `petugasNama` versi rangkuman (koma), `petugasNamaList` versi larik untuk
  // ditampilkan per-baris di detail.
  petugasNama: b.PetugasNama || '',
  petugasNamaList: Array.isArray(b.PetugasNamaList) ? b.PetugasNamaList : [],
  petugasTtd: b.PetugasTTD || '',
  diinputOleh: b.DiinputOleh || '', dibuatPada: b.DibuatPada || ''
});

/* ---------- Baris item dinamis ---------- */

function barisBapbKosong(){
  const o = { key: 'bi' + (bapbItemSeq++) };
  KOLOM_BAPB_ITEM.forEach(k => o[k] = '');
  return o;
}

function tambahBarisBapb(){ bapbItems.push(barisBapbKosong()); renderBarisBapb(); }

function hapusBarisBapb(key){
  bapbItems = bapbItems.filter(b => b.key !== key);
  if (bapbItems.length === 0) tambahBarisBapb(); else renderBarisBapb();
}

function setBapbItem(key, kolom, nilai){
  const b = bapbItems.find(x => x.key === key);
  if (b) b[kolom] = nilai;
}

function renderBarisBapb(){
  const body = document.getElementById('bapbItemsBody');
  if (!body) return;
  body.innerHTML = bapbItems.map((b, i) => `
    <tr>
      <td style="text-align:center;">${i + 1}</td>
      <td><input type="text" class="mon-in" value="${escapeHtml(b.namaBarang)}"
           oninput="setBapbItem('${b.key}','namaBarang',this.value)"></td>
      <td><input type="text" class="mon-in" value="${escapeHtml(b.ukuran)}"
           oninput="setBapbItem('${b.key}','ukuran',this.value)"></td>
      <td><input type="text" class="mon-in" value="${escapeHtml(b.banyaknya)}"
           oninput="setBapbItem('${b.key}','banyaknya',this.value)"></td>
      <td><input type="date" class="mon-in" value="${escapeHtml(b.tanggalPemasangan)}"
           oninput="setBapbItem('${b.key}','tanggalPemasangan',this.value)"></td>
      <td><input type="text" class="mon-in" value="${escapeHtml(b.keterangan)}"
           oninput="setBapbItem('${b.key}','keterangan',this.value)"></td>
      <td><button class="icon-btn" title="${T('hapus')}" onclick="hapusBarisBapb('${b.key}')">✕</button></td>
    </tr>`).join('');
}

/* ---------- Daftar teknisi pelaksana (dinamis) ---------- */

function renderBapbPetugas(){
  const wrap = document.getElementById('bapbPetugasList');
  if (!wrap) return;
  wrap.innerHTML = bapbPetugasRows.map((t, i) => `
    <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;">
      <span style="font-family:var(--font-mono);color:var(--accent);font-size:12px;min-width:18px;">${i + 1}.</span>
      <input type="text" value="${escapeHtml(t.nama)}" placeholder="${T('namaTeknisiPelaksana')} ${i + 1}"
             list="teknisiDatalist"
             oninput="bapbPetugasRows[${i}].nama = this.value"
             style="flex:1;background:var(--panel-2);border:1px solid var(--line);color:var(--text);border-radius:6px;padding:9px 10px;font-size:16px;">
      ${bapbPetugasRows.length > 1 ? `<button class="icon-btn" onclick="hapusBapbPetugas('${t.key}')">✕</button>` : ''}
    </div>`).join('');
}

function addBapbPetugas(){
  bapbPetugasRows.push({ key: 'bp' + (bapbPetugasSeq++), nama: '' });
  renderBapbPetugas();
}

function hapusBapbPetugas(key){
  bapbPetugasRows = bapbPetugasRows.filter(x => x.key !== key);
  renderBapbPetugas();
}

/* ---------- Modal isian ---------- */

function openBapbModal(){
  document.getElementById('bapbNomor').value = '';
  document.getElementById('bapbTanggal').value = tanggalHariIni();
  document.getElementById('bapbUntukPekerjaan').value = '';
  document.getElementById('bapbLokasi').value = '';
  document.getElementById('bapbPemakaiNama').value = '';
  document.getElementById('bapbTeknikNama').value = '';

  bapbItems = []; bapbItemSeq = 0;
  for (let i = 0; i < 2; i++) tambahBarisBapb();

  // Satu baris pra-isi dengan yang sedang login — dialah pengisi & teknisi
  // pelaksananya. Sisanya ditambah lewat tombol "+ Nama".
  bapbPetugasRows = []; bapbPetugasSeq = 0;
  addBapbPetugas();
  if (bapbPetugasRows[0]) {
    bapbPetugasRows[0].nama = userSaatIni ? (userSaatIni.nama || userSaatIni.username) : '';
  }
  renderBapbPetugas();

  ['sigBapbPemakai','sigBapbTeknik','sigBapbPetugas'].forEach(id => {
    if (!sigPads[id]) setupSigCanvas(id);
    resizeSigCanvas(id); clearSig(id);
  });
  document.getElementById('bapbModalBg').classList.add('show');
  setTimeout(() => ['sigBapbPemakai','sigBapbTeknik','sigBapbPetugas'].forEach(resizeSigCanvas), 60);
}

function closeBapbModal(){ document.getElementById('bapbModalBg').classList.remove('show'); }

async function saveBapb(){
  const v = id => document.getElementById(id).value.trim();

  // Item dibersihkan lalu disaring: baris yang seluruh kolomnya kosong
  // dibuang, jadi baris pra-isi yang tidak diketik tidak ikut tersimpan.
  const items = bapbItems
    .map(b => { const o = {}; KOLOM_BAPB_ITEM.forEach(k => o[k] = (b[k] || '').trim()); return o; })
    .filter(b => KOLOM_BAPB_ITEM.some(k => b[k] !== ''));

  if (items.length === 0) { toast(T('bapbItemsKosong')); return; }

  const btn = document.getElementById('bapbSaveBtn'); btn.disabled = true;
  try {
    const saved = await gsRun('addBapb', {
      unit: unitAktif,
      nomor: v('bapbNomor'),
      tanggal: v('bapbTanggal'),
      untukPekerjaan: v('bapbUntukPekerjaan'),
      lokasi: v('bapbLokasi'),
      items,
      pemakaiNama: v('bapbPemakaiNama'), pemakaiTtd: getSigDataUrl('sigBapbPemakai'),
      teknikNama: v('bapbTeknikNama'),   teknikTtd: getSigDataUrl('sigBapbTeknik'),
      // Daftar nama teknisi pelaksana dibersihkan dan dikirim sebagai larik;
      // server yang merangkumnya menjadi kolom `petugas_nama` versi koma.
      petugasNamaList: bapbPetugasRows.map(t => (t.nama || '').trim()).filter(Boolean),
      petugasTtd: getSigDataUrl('sigBapbPetugas')
    });
    bapbList.unshift(mapBapb(saved));
    renderBapbList();
    closeBapbModal();
    toast(T('bapbTersimpan'));
  } catch (e) {
    toast(T('gagalSimpan') + ' — ' + (e.message || T('coba')));
  }
  btn.disabled = false;
}

/* ---------- Daftar riwayat ---------- */

let bapbTampilSemua = false;
function resetCariBapb(){ bapbTampilSemua = true; const el = document.getElementById('cariBapbTanggal'); if(el) el.value = ''; renderBapbList(); }
function renderBapbList(){
  const wrap = document.getElementById('bapbList');
  if (!wrap) return;
  if (bapbList.length === 0) {
    wrap.innerHTML = '<div class="empty">' + T('belumAdaBapb') + '</div>';
    return;
  }
  const tgl = (document.getElementById('cariBapbTanggal') || {}).value || '';
  const daftar = tgl ? bapbList.filter(b => String(b.tanggal||'').slice(0,10) === tgl)
                     : (bapbTampilSemua ? bapbList : bapbList.filter(b => (typeof dalamSeminggu==='function') ? dalamSeminggu(b.tanggal) : true));
  if (daftar.length === 0) { wrap.innerHTML = '<div class="empty">' + T('takAdaHasil') + '</div>'; return; }
  wrap.innerHTML = daftar.map(b => `
    <div class="dc-history-item">
      <div><b>${escapeHtml(b.nomor) || T('bapbTanpaNomor')}</b>
        &middot; ${escapeHtml(b.tanggal) || '-'}
        &middot; ${b.items.length} ${T('bapbBarangSingkat')}</div>
      <div style="font-size:11.5px;color:var(--muted);">
        ${T('bapbUntukPekerjaan')}: ${escapeHtml(b.untukPekerjaan) || '-'}
        ${b.lokasi ? ' &middot; ' + T('bapbLokasi') + ': ' + escapeHtml(b.lokasi) : ''}
      </div>
      ${diinputOlehHtml(b.diinputOleh, b.dibuatPada, String(b.tanggal || '').slice(0, 10))}
      <div style="display:flex;gap:4px;">
        <button class="btn ghost" style="padding:6px 10px;" onclick="openBapbDetail('${b.id}')">${T('detail')}</button>
        <button class="icon-btn hanya-admin" title="${T('hapus')}" onclick="hapusBapb('${b.id}')">✕</button>
      </div>
    </div>`).join('');
}

/* ---------- Detail (pratinjau, cetakan menyusul di langkah 4) ---------- */

function openBapbDetail(id){
  const b = bapbList.find(x => x.id === id);
  if (!b) return;
  const itemsHtml = b.items.length === 0
    ? `<div class="empty">${T('bapbTanpaBarang')}</div>`
    : `<table style="width:100%;font-size:13px;">
         <thead><tr class="p-kepala">
           <td style="width:34px;text-align:center;"><b>No</b></td>
           <td><b>${T('bapbNamaBarang')}</b></td>
           <td><b>${T('bapbUkuran')}</b></td>
           <td><b>${T('bapbBanyaknya')}</b></td>
           <td><b>${T('bapbTanggalPemasangan')}</b></td>
           <td><b>${T('bapbKeteranganKol')}</b></td>
         </tr></thead>
         <tbody>${b.items.map((it, i) => `
           <tr>
             <td style="text-align:center;">${i + 1}</td>
             <td>${escapeHtml(it.namaBarang) || '-'}</td>
             <td>${escapeHtml(it.ukuran) || '-'}</td>
             <td>${escapeHtml(it.banyaknya) || '-'}</td>
             <td>${escapeHtml(it.tanggalPemasangan) || '-'}</td>
             <td>${escapeHtml(it.keterangan) || '-'}</td>
           </tr>`).join('')}
         </tbody>
       </table>`;

  document.getElementById('formDetailJudul').textContent = T('bapbModal');
  document.getElementById('formDetailBody').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;font-size:13px;margin-bottom:12px;">
      <div><span style="color:var(--muted);">${T('bapbNomor')}:</span> <b>${escapeHtml(b.nomor) || '-'}</b></div>
      <div><span style="color:var(--muted);">${T('tanggal')}:</span> <b>${escapeHtml(b.tanggal) || '-'}</b></div>
      <div style="grid-column:1/-1;"><span style="color:var(--muted);">${T('bapbUntukPekerjaan')}:</span> <b>${escapeHtml(b.untukPekerjaan) || '-'}</b></div>
      <div style="grid-column:1/-1;"><span style="color:var(--muted);">${T('bapbLokasi')}:</span> <b>${escapeHtml(b.lokasi) || '-'}</b></div>
    </div>
    ${itemsHtml}
    <div class="detail-ttd" style="margin-top:14px;">
      <div class="sig-block"><b>${T('bapbPemakai')}</b>${escapeHtml(b.pemakaiNama) || '-'}${sigThumbHtml(b.pemakaiTtd)}</div>
      <div class="sig-block"><b>${T('bapbTeknik')}</b>${escapeHtml(b.teknikNama) || '-'}${sigThumbHtml(b.teknikTtd)}</div>
      <div class="sig-block"><b>${T('namaTeknisiPelaksana')}</b>${
        (b.petugasNamaList && b.petugasNamaList.length)
          ? b.petugasNamaList.map((n, i) => `${i + 1}. ${escapeHtml(n)}`).join('<br>')
          : (escapeHtml(b.petugasNama) || '-')
      }${sigThumbHtml(b.petugasTtd)}</div>
    </div>
    <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line);">${diinputOlehHtml(b.diinputOleh, b.dibuatPada, String(b.tanggal || '').slice(0, 10))}</div>`;
  // Cetakan resmi masih di langkah 4 — tombol print disembunyikan dulu.
  const pb = document.getElementById('formDetailPrintBtn');
  if (pb) { pb.style.display = 'none'; pb.onclick = null; }
  document.getElementById('formDetailBg').classList.add('show');
}

/* ---------- Hapus ---------- */

async function hapusBapb(id){
  if (!adminAktif()) { toast(T('hanyaAdminHapus')); return; }
  const b = bapbList.find(x => x.id === id);
  const nama = b ? (b.nomor || b.untukPekerjaan || '') : '';
  if (!confirm(`${T('konfirmasiHapus')} ${nama}?`)) return;
  const salinan = bapbList.slice();
  bapbList = bapbList.filter(x => x.id !== id);
  renderBapbList();
  try { await gsRun('deleteBapb', id); }
  catch (e) {
    bapbList = salinan; renderBapbList();
    toast(T('gagalHapus') + ' — ' + (e.message || T('coba')));
  }
}
