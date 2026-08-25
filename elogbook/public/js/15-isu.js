/* E-Logbook · js/15-isu.js — Tab Isu / Update Issue beserta bukti saat dibuka dan ditutup
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh. */

/* ============== TAB 3 — ISSUES ============== */

/* Isu dibuat lewat form yang sudah terisi, bukan baris kosong yang lalu diketik.
   Dengan begitu teknisi tetap bisa melapor lengkap tanpa perlu hak mengubah baris. */
function openIssueModal(){
  document.getElementById('isJenis').value = '';
  document.getElementById('isKeterangan').value = '';
  document.getElementById('isLokasi').value = '';
  // Tanggal + jam dibagi dua isian mengikuti pola form Logbook (Tanggal +
  // Jam UTC), bukan datetime-local bawaan browser. Nilai gabungannya baru
  // disusun saat disimpan; server tetap menerima "YYYY-MM-DDTHH:MM".
  document.getElementById('isTanggalReport').value = tanggalHariIni();
  document.getElementById('isJamReport').value = jamSekarang();
  // Isian awal nama pelapor: yang sedang login. Bisa diganti kalau yang menemukan orang lain.
  document.getElementById('isDilaporkanOleh').value = userSaatIni ? (userSaatIni.nama || userSaatIni.username) : '';
  document.getElementById('isStatus').value = 'Open';
  resetLampiran('isLampiranOpen');
  resetLampiran('isLampiranClosed');
  toggleLampiranClosed();
  document.getElementById('issueModalBg').classList.add('show');
}
function closeIssueModal(){ document.getElementById('issueModalBg').classList.remove('show'); }

/** Bukti "saat selesai" hanya masuk akal kalau isunya memang ditutup. */
function toggleLampiranClosed(){
  const wrap = document.getElementById('isLampiranClosedWrap');
  const closed = adminAktif() && document.getElementById('isStatus').value === 'Closed';
  wrap.style.display = closed ? '' : 'none';
  if(!closed) resetLampiran('isLampiranClosed');
}

async function saveIssue(){
  const jenis = document.getElementById('isJenis').value.trim();
  if(!jenis){ toast(T('jenisKosong')); return; }
  const btn = document.getElementById('isSaveBtn'); btn.disabled = true;
  // Gabungan tanggal + jam menjadi bentuk yang disimpan server. Kalau jamnya
  // kosong, kirim tanggal saja — jangan membuat "2026-08-24T" yang tidak sah.
  const tglIs = document.getElementById('isTanggalReport').value;
  const jamIs = document.getElementById('isJamReport').value;
  const tglGabung = tglIs && jamIs ? `${tglIs}T${jamIs}` : (tglIs || '');
  const payload = {
    jenis,
    keterangan: document.getElementById('isKeterangan').value.trim(),
    lokasi: document.getElementById('isLokasi').value.trim(),
    tanggalReport: tglGabung,
    dilaporkanOleh: document.getElementById('isDilaporkanOleh').value.trim(),
    // Status hanya dikirim admin; server tetap memaksa isu baru dari teknisi jadi Open.
    status: adminAktif() ? document.getElementById('isStatus').value : 'Open',
    lampiranOpen: kirimLampiran('isLampiranOpen'),
    lampiranClosed: kirimLampiran('isLampiranClosed'),
    unit: unitAktif
  };
  toast(payload.lampiranOpen.length || payload.lampiranClosed.length ? 'Mengunggah lampiran dan menyimpan...' : 'Menyimpan isu...');
  try{
    const dibuat = await gsRun('addIssue', payload);
    issues.push(mapIssue(dibuat));
    renderIssues();
    closeIssueModal();
    toast(T('tersimpanIsu'));
  }catch(e){ toast('Gagal menyimpan isu — ' + (e.message||'coba lagi.')); }
  btn.disabled = false;
}

/* ---------- Detail isu: bukti saat kejadian dan saat selesai ---------- */
let isuDetailId = '';
function closeIssueDetail(){ document.getElementById('issueDetailBg').classList.remove('show'); isuDetailId = ''; }

function openIssueDetail(id){
  const it = issues.find(x=>x.id===id);
  if(!it){ toast('Isu tidak ditemukan.'); return; }
  isuDetailId = id;
  document.getElementById('issueDetailPrintBtn').onclick = ()=>{ closeIssueDetail(); printSingleIssue(id); };
  document.getElementById('issueDetailBg').classList.add('show');
  renderIssueDetail();
}

function renderIssueDetail(){
  const it = issues.find(x=>x.id===isuDetailId);
  if(!it) return;
  const baris = (label, isi) =>
    `<tr><td style="padding:3px 12px 3px 0;color:var(--muted);white-space:nowrap;">${label}</td><td style="padding:3px 0;">${isi}</td></tr>`;
  const kosong = '<span style="color:var(--muted);">—</span>';
  const closed = it.status === 'Closed';

  /* Keterangan penutupan: admin bisa mengetik langsung di sini, tersimpan begitu
     kolomnya ditinggalkan. Peran lain hanya membaca. Ditampilkan hanya saat isu
     memang tertutup — mengetik alasan menutup untuk isu yang masih terbuka cuma
     membingungkan (belum ada yang menutup). */
  const ketArea = closed && adminAktif()
    ? `<textarea id="isDetailKetClosed" rows="3"
         style="width:100%;background:var(--panel-2);color:var(--text);border:1px solid var(--line);
                border-radius:5px;padding:6px 8px;font-family:var(--font-body);font-size:13px;
                resize:vertical;box-sizing:border-box;"
         placeholder="Keterangan penutupan (mis. akar penyebab, tindakan yang dilakukan)"
         onchange="simpanKetClosed(this.value)">${escapeHtml(it.keteranganClosed||'')}</textarea>`
    : (it.keteranganClosed
        ? `<span style="white-space:pre-wrap;">${escapeHtml(it.keteranganClosed)}</span>`
        : kosong);

  document.getElementById('issueDetailBody').innerHTML = `
    <table style="font-size:13px;line-height:1.6;margin-bottom:4px;">
      ${baris('Jenis Issue', '<b>'+(escapeHtml(it.jenis)||kosong)+'</b>')}
      ${baris('Keterangan', '<span style="white-space:pre-wrap;">'+(escapeHtml(it.keterangan)||kosong)+'</span>')}
      ${baris('Lokasi', escapeHtml(it.lokasi)||kosong)}
      ${baris('Status', '<span class="tag '+(it.status==='Closed'?'ok':it.status==='Proses'?'warn':'fail')+'">'+escapeHtml(it.status)+'</span>')}
      ${baris('Tgl &amp; Jam Report', escapeHtml(formatWaktuIsu(it.tglReport))||kosong)}
      ${baris('Tgl &amp; Jam Closed', escapeHtml(formatWaktuIsu(it.tglClosed))||kosong)}
      ${closed || it.ditutupOleh ? baris('Ditutup oleh', escapeHtml(it.ditutupOleh)||kosong) : ''}
      ${closed || it.keteranganClosed ? baris('Keterangan penutupan', ketArea) : ''}
      ${baris('Dilaporkan oleh', escapeHtml(it.dilaporkanOleh)||kosong)}
      ${baris('Diinput oleh', escapeHtml(it.diinputOleh)||kosong)}
      ${adminAktif() && it.dibuatPada
          ? baris(T('jejakBaris'), jejakInputHtml(it.dibuatPada, String(it.tglReport||'').slice(0,10)) || kosong)
          : ''}
    </table>
    ${bagianBuktiHtml(it, 'open', T('buktiKejadian'))}
    ${bagianBuktiHtml(it, 'closed', T('buktiSelesai'))}`;
}

/** Simpan keterangan penutupan dari textarea di jendela detail. Dijalankan
    onchange (bukan input) supaya server tidak dihubungi setiap ketikan. */
async function simpanKetClosed(nilai){
  if(!isuDetailId) return;
  const it = issues.find(x=>x.id===isuDetailId);
  if(!it) return;
  const baru = String(nilai || '').trim();
  if(baru === (it.keteranganClosed||'')) return;
  try{
    const terbaru = await gsRun('updateIssueField', isuDetailId, ISSUE_HEADER.keteranganClosed, baru);
    if(terbaru) gantiIsuDiDaftar(terbaru);
    it.keteranganClosed = baru;
    renderIssues();
  }catch(e){ toast('Gagal menyimpan keterangan — ' + (e.message||'coba lagi.')); }
}

function bagianBuktiHtml(it, fase, judul){
  const daftar = fase === 'open' ? it.lampiranOpen : it.lampiranClosed;
  const kotak = fase === 'open' ? 'idLampiranOpen' : 'idLampiranClosed';

  const kartu = daftar.length ? daftar.map(l=>{
    const gambar = String(l.Mime||'').startsWith('image/');
    const isi = gambar ? `<img src="${l.Path}" alt="${escapeHtml(l.Nama)}" loading="lazy">` : `<div class="berkas">📄</div>`;
    const hapus = adminAktif()
      ? `<button class="icon-btn" style="position:absolute;top:2px;right:2px;background:var(--tirai);border-radius:4px;"
                 title="Hapus lampiran ini" onclick="event.preventDefault();hapusBuktiIsu('${l.ID}')">✕</button>` : '';
    return `<div style="position:relative;">
      <a class="lampiran-kartu" href="${l.Path}" target="_blank" rel="noopener" title="${escapeHtml(l.Nama)} — ${ukuranTeks(l.Ukuran||0)}">
        ${isi}<span class="label">${escapeHtml(l.Nama)}</span></a>${hapus}</div>`;
  }).join('') : '<span class="diinput-oleh">' + T('belumAdaBukti') + '</span>';

  // Menempel bukti ke isu yang sudah tersimpan sama dengan mengubahnya — admin saja.
  const unggah = adminAktif() ? `
    <div style="margin-top:8px;">
      <input type="file" id="${kotak}" multiple accept="image/jpeg,image/png,image/webp,application/pdf" onchange="pilihLampiran(this, '${kotak}')">
      <div class="lampiran-hint" id="${kotak}Hint">${PESAN_LAMPIRAN}</div>
      <div id="${kotak}List"></div>
      <button class="btn ghost" style="padding:5px 10px;font-size:12px;margin-top:6px;" onclick="unggahBuktiIsu('${fase}')">${T('unggahKeFase')}</button>
    </div>` : '';

  return `
    <div style="font-family:var(--font-mono);font-size:10.5px;color:var(--muted);text-transform:uppercase;margin-top:16px;">${judul} (${daftar.length})</div>
    <div class="lampiran-galeri">${kartu}</div>
    ${unggah}`;
}

async function unggahBuktiIsu(fase){
  const kotak = fase === 'open' ? 'idLampiranOpen' : 'idLampiranClosed';
  if(kotakLampiran(kotak).length === 0){ toast('Belum ada berkas yang dipilih.'); return; }
  toast('Mengunggah bukti...');
  try{
    const terbaru = await gsRun('addIssueLampiran', isuDetailId, fase, kirimLampiran(kotak));
    gantiIsuDiDaftar(terbaru);
    resetLampiran(kotak);
    renderIssueDetail();
    renderIssues();
    toast('Bukti tersimpan.');
  }catch(e){ toast('Gagal mengunggah — ' + (e.message||'coba lagi.')); }
}

async function hapusBuktiIsu(lampiranId){
  if(!confirm('Hapus lampiran ini? Berkasnya ikut terhapus dan tidak bisa dikembalikan.')) return;
  try{
    const terbaru = await gsRun('deleteIssueLampiran', isuDetailId, lampiranId);
    gantiIsuDiDaftar(terbaru);
    renderIssueDetail();
    renderIssues();
    toast('Lampiran dihapus.');
  }catch(e){ toast('Gagal menghapus — ' + (e.message||'coba lagi.')); }
}

function gantiIsuDiDaftar(dariServer){
  if(!dariServer) return;
  const idx = issues.findIndex(i=>i.id===dariServer.ID);
  if(idx >= 0) issues[idx] = mapIssue(dariServer);
}

async function deleteIssue(id){
  if(!adminAktif()){ toast(T('hanyaAdminHapus')); return; }
  const it = issues.find(i=>i.id===id);
  if(!confirm(`Hapus isu "${it ? (it.jenis||'tanpa jenis') : 'ini'}"? Tindakan ini tidak bisa dibatalkan.`)) return;
  const salinan = issues.slice();
  issues = issues.filter(i=>i.id!==id);
  renderIssues();
  try{ await gsRun('deleteIssue', id); }
  catch(e){ issues = salinan; renderIssues(); toast('Gagal menghapus — ' + (e.message||'coba lagi.')); }
}
async function updateIssueField(id, field, value){
  if(!adminAktif()){ toast(T('hanyaAdminUbah')); renderIssues(); return; }
  const it = issues.find(i=>i.id===id);
  if(it) it[field] = value;
  try{
    const terbaru = await gsRun('updateIssueField', id, ISSUE_HEADER[field], value);
    if(!terbaru) return;
    const idx = issues.findIndex(i=>i.id===id);
    if(idx < 0) return;
    issues[idx] = mapIssue(terbaru);
    // Mengubah status ikut mengisi/mengosongkan tanggal closed di server —
    // gambar ulang supaya tanggalnya kelihatan. Field lain sengaja tidak
    // digambar ulang agar kursor tidak lompat saat teknisi masih mengetik.
    if(field === 'status') renderIssues();
  }catch(e){ toast('Gagal menyimpan perubahan.'); }
}
function renderIssues(){
  const body = document.getElementById('issuesBody');
  if(issues.length===0){
    body.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--muted);padding:20px;">' + T('belumAdaIsu') + '</td></tr>';
    return;
  }
  body.innerHTML = issues.map((it,idx)=> adminAktif() ? barisIsuAdmin(it, idx) : barisIsuBaca(it, idx)).join('');
}

/** Baris admin dua isian (Tanggal + Jam UTC) untuk kolom Tgl Report / Tgl
 *  Closed. Nilainya digabung "YYYY-MM-DDTHH:MM" saat dikirim ke server —
 *  kalau salah satunya kosong, kirim tanggal saja (jangan bentuk cacat). */
function bagiTglJamHtml(it, field, disabled){
  const v = String(it[field] || '');
  const tgl = v.slice(0, 10);
  const jam = v.length >= 16 ? v.slice(11, 16) : '';
  const off = disabled ? 'disabled' : '';
  const gaya = 'background:var(--panel-2);color:var(--text);border:1px solid var(--line);border-radius:5px;padding:4px 6px;font-family:var(--font-mono);font-size:11px;';
  return `<div style="display:flex;gap:4px;">
    <input type="date" ${off} value="${escapeHtml(tgl)}" style="${gaya}width:110px;"
           onchange="updateIssueTglJam('${it.id}','${field}',this.value, this.parentElement.querySelector('input[type=time]').value)">
    <input type="time" ${off} value="${escapeHtml(jam)}" style="${gaya}width:78px;"
           onchange="updateIssueTglJam('${it.id}','${field}', this.parentElement.querySelector('input[type=date]').value, this.value)">
  </div>`;
}
function updateIssueTglJam(id, field, tgl, jam){
  const gabung = tgl && jam ? `${tgl}T${jam}` : (tgl || '');
  updateIssueField(id, field, gabung);
}

/** Ringkasan jumlah bukti per fase, dipakai di kolom "Bukti". */
function selBuktiHtml(it){
  const bagian = [];
  if(it.lampiranOpen.length)   bagian.push(`<span title="bukti saat kejadian">📎 open ${it.lampiranOpen.length}</span>`);
  if(it.lampiranClosed.length) bagian.push(`<span title="bukti saat selesai">📎 closed ${it.lampiranClosed.length}</span>`);
  return `<td class="diinput-oleh">${bagian.length ? bagian.join('<br>') : '—'}</td>`;
}

const selDetailIsu = it =>
  `<button class="btn ghost" style="padding:5px 9px;font-size:12px;" onclick="openIssueDetail('${it.id}')">${T('detail')}</button>`;

/* Administrator: seluruh kolom bisa diubah langsung di tabel. */
function barisIsuAdmin(it, idx){
  return `
    <tr>
      <td>${idx+1}</td>
      <td><input type="text" value="${escapeHtml(it.jenis)}" style="width:100%;background:transparent;border:none;color:var(--text);font-size:13px;" onchange="updateIssueField('${it.id}','jenis',this.value)"></td>
      <td><textarea style="width:100%;background:transparent;border:none;color:var(--text);font-size:13px;resize:vertical;" onchange="updateIssueField('${it.id}','keterangan',this.value)">${escapeHtml(it.keterangan)}</textarea></td>
      <td><input type="text" value="${escapeHtml(it.lokasi)}" style="width:100%;background:transparent;border:none;color:var(--text);font-size:13px;" onchange="updateIssueField('${it.id}','lokasi',this.value)"></td>
      <td>${bagiTglJamHtml(it, 'tglReport', false)}</td>
      <td><select class="status-select" onchange="updateIssueField('${it.id}','status',this.value)">
        <option ${it.status==='Open'?'selected':''}>Open</option>
        <option ${it.status==='Proses'?'selected':''}>Proses</option>
        <option ${it.status==='Closed'?'selected':''}>Closed</option>
      </select></td>
      <td>${bagiTglJamHtml(it, 'tglClosed', it.status !== 'Closed')}</td>
      <td><input type="text" value="${escapeHtml(it.dilaporkanOleh)}" title="Diinput oleh ${escapeHtml(it.diinputOleh)||'-'}"
                 style="width:100%;background:transparent;border:none;color:var(--text);font-size:13px;"
                 onchange="updateIssueField('${it.id}','dilaporkanOleh',this.value)"></td>
      ${selBuktiHtml(it)}
      <td style="display:flex;gap:4px;align-items:center;">
        ${selDetailIsu(it)}
        <button class="icon-btn" title="Hapus isu" onclick="deleteIssue('${it.id}')">✕</button>
      </td>
    </tr>`;
}

/* Teknisi: baca saja. Tidak ada kolom yang bisa disunting dan tidak ada tombol hapus. */
function barisIsuBaca(it, idx){
  const tanggal = t => escapeHtml(t) || '<span style="color:var(--muted);">—</span>';
  return `
    <tr>
      <td>${idx+1}</td>
      <td>${escapeHtml(it.jenis)||'-'}</td>
      <td style="white-space:pre-wrap;">${escapeHtml(it.keterangan)||'-'}</td>
      <td>${escapeHtml(it.lokasi)||'-'}</td>
      <td class="diinput-oleh">${tanggal(formatWaktuIsu(it.tglReport))}</td>
      <td><span class="status-select" style="display:inline-block;">${escapeHtml(it.status)}</span></td>
      <td class="diinput-oleh">${tanggal(formatWaktuIsu(it.tglClosed))}</td>
      <td class="diinput-oleh" title="Diinput oleh ${escapeHtml(it.diinputOleh)||'-'}">${escapeHtml(it.dilaporkanOleh)||'-'}</td>
      ${selBuktiHtml(it)}
      <td>${selDetailIsu(it)}</td>
    </tr>`;
}
