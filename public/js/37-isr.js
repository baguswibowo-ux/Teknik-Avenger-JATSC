/* =======================================================================
   IZIN STASIUN RADIO (ISR)

   Modul Database Unit yang keempat, sepola dengan Peralatan dan Sparepart:
   satu daftar per unit, tersimpan di server dashboard ini (/unitdb/isr/:unit),
   dijaga hak per peran (lihat HAK_BAWAAN.isr di server.js). Bukan di E-Logbook —
   ISR adalah dokumen administrasi frekuensi, bukan catatan operasional.

   Yang membedakannya dari Sparepart: ISR punya MASA BERLAKU. Izin yang mendekati
   atau lewat tanggal habisnya ikut muncul di beranda "Perlu Perhatian" dan di
   lonceng, persis seperti sertifikat personel — supaya pembaruannya tidak
   kelewat. Hitungan harinya di isrSisa(); ambangnya ISR_AWAS.
   ======================================================================= */

const ISR_AWAS = 60;    // hari sebelum habis, saat peringatannya menyala

/** Sisa hari sampai habis. null kalau tanggal habisnya memang belum diisi —
    izin tanpa tanggal tidak pernah jadi peringatan. */
function isrSisa(row){
  if(!row || !row.habis) return null;
  const kini = new Date(); kini.setHours(0,0,0,0);
  return Math.round((new Date(row.habis + 'T00:00:00') - kini) / 86400000);
}
const isrRupa = (sisa) => sisa == null ? '' : sisa < 0 ? 'bahaya' : sisa <= ISR_AWAS ? 'awas' : 'aman';

/** Berapa izin di unit ini yang perlu diperhatikan (mendekati/lewat habis) —
    dipakai lencana angka di tab ISR. */
function isrAwasUnit(unit){
  return (ISR[unit] || []).filter(r=>{ const s = isrSisa(r); return s != null && s <= ISR_AWAS; }).length;
}

/** Teks status yang tampil di kolom Status dan di kartu peringatan. */
function isrStatusTeks(sisa){
  if(sisa == null) return T('tanpa tanggal','no date');
  if(sisa < 0)  return T(`kadaluarsa ${-sisa} hari`, `lapsed ${-sisa} days`);
  if(sisa === 0) return T('habis hari ini','expires today');
  if(sisa <= ISR_AWAS) return T(`tinggal ${sisa} hari`, `${sisa} days left`);
  return T('aktif','active');
}

/** Seluruh ISR yang perlu diperhatikan, lintas unit yang boleh dibuka akun ini —
    dipakai gambarPerhatian() di beranda. Terdesak di atas. */
function isrPerhatian(){
  const keluar = [];
  Object.entries(ISR).forEach(([unit, baris])=>{
    if(!bolehBuka(unit)) return;
    (Array.isArray(baris) ? baris : []).forEach(row=>{
      const sisa = isrSisa(row);
      if(sisa == null || sisa > ISR_AWAS) return;
      keluar.push({ unit, row, sisa });
    });
  });
  return keluar.sort((a,b)=>a.sisa - b.sisa);
}

/* ---------- Lampiran berkas ----------
   Berkasnya tidak disimpan di dalam baris ISR, melainkan di rak Dokumen unit
   (data/dokumen/, di luar public/, hanya bisa dibuka setelah masuk) dan
   dikaitkan ke baris ISR lewat field `isr` — pola sama dengan kaitan `alat`
   milik peralatan. Satu rak berkas untuk unit, satu jalan mengunggah dan
   menjaganya. */
function isrLampiran(isrId){
  if(!isrId) return [];
  return (BERKAS[unitDibuka] || []).filter(b=>b.isr === isrId);
}

/** Ukuran berkas jadi teks pendek. */
function isrUkuran(n){
  n = Number(n) || 0;
  if(n < 1024) return n + ' B';
  if(n < 1024*1024) return (n/1024).toFixed(0) + ' KB';
  return (n/1024/1024).toFixed(1) + ' MB';
}

/* ---------- Panel subtab ---------- */

function panelIsrHtml(unit){
  const daftar = [...(ISR[unit] || [])].sort((a,b)=>{
    // Yang mendekati/lewat habis di atas; sisanya menurut nama.
    const sa = isrSisa(a), sb = isrSisa(b);
    const pa = sa == null ? Infinity : sa, pb = sb == null ? Infinity : sb;
    if(pa !== pb) return pa - pb;
    return String(a.nama||'').localeCompare(String(b.nama||''), LOKAL());
  });
  const boleh = bolehSuntingDb('isr');
  const awas = isrAwasUnit(unit);

  const kepala = `<div class="atur-data">
    <span class="ket">${daftar.length} ${T('izin terdaftar','licences registered')}${
      awas ? ` · <b style="color:var(--warn)">${awas} ${T('perlu diperhatikan','need attention')}</b>` : ''}</span>
    <span class="tombol">${boleh
      ? `<button class="btn kecil" data-isr-tambah>${T('Tambah ISR','Add licence')}</button>` : ''}</span>
  </div>`;

  if(!daftar.length){
    return kepala + `<div class="panel"><div class="badan" style="color:var(--muted);font-size:12.5px;line-height:1.7">
      ${T('Belum ada Izin Stasiun Radio terdaftar untuk unit ini.',
          'No Radio Station Licence registered for this unit yet.')}
      ${boleh ? T('Tekan <b style="color:var(--text)">Tambah ISR</b> di atas untuk mengisinya.',
                  'Press <b style="color:var(--text)">Add licence</b> above to fill it in.') : ''}</div></div>`;
  }

  const baris = daftar.map((r,i)=>{
    const sisa = isrSisa(r);
    const w = isrRupa(sisa);
    const cip = w === 'bahaya' ? 'bahaya' : w === 'awas' ? 'awas' : 'aman';
    const masa = (r.mulai || r.habis)
      ? `${r.mulai ? tglRingkas(r.mulai) : '—'} – ${r.habis ? tglRingkas(r.habis) : '—'}`
      : '—';
    const nL = isrLampiran(r.id).length;
    return `<tr>
      <td class="mono" style="color:var(--muted);text-align:right">${i+1}</td>
      <td>${esc(r.nama || '—')}${nL
        ? ` <span class="mono" style="color:var(--muted);font-size:11px" title="${
            T('berkas lampiran','attached files')}">📎${nL}</span>` : ''}</td>
      <td><span class="mono">${esc(r.nomor || '—')}</span></td>
      <td><span class="mono">${esc(r.frek || '—')}</span></td>
      <td>${esc(r.kelas || '—')}</td>
      <td>${esc(r.lokasi || '—')}</td>
      <td><span class="mono" style="font-size:11px">${masa}</span></td>
      <td><span class="cip ${cip}">${esc(isrStatusTeks(sisa))}</span></td>
      <td style="text-align:right">${boleh
        ? `<button class="btn garis kecil" data-isr-ubah="${esc(r.id)}">${T('Ubah','Edit')}</button>` : ''}</td>
    </tr>`;
  }).join('');

  return kepala + `<div class="panel">
    <div class="kepala"><h3>${T('Izin Stasiun Radio','Radio Station Licence')} — ${esc(namaUnit(unit))}</h3>
      <span class="ket">${T('masa berlaku yang mendekati habis muncul di beranda dan lonceng',
        'expiries nearing their date appear on the home screen and the bell')}</span></div>
    <div class="gulir" style="max-height:none"><table>
      <thead><tr><th style="width:36px;text-align:right">${T('No','No')}</th>
        <th>${T('Nama Stasiun / Perangkat','Station / Device')}</th>
        <th>${T('No. ISR','Licence No.')}</th>
        <th>${T('Frekuensi','Frequency')}</th>
        <th>${T('Kelas','Class')}</th>
        <th>${T('Lokasi','Location')}</th>
        <th>${T('Masa Berlaku','Validity')}</th>
        <th>Status</th><th></th></tr></thead>
      <tbody>${baris}</tbody></table></div>
  </div>`;
}

/* ---------- Kartu tambah / ubah ---------- */

let isrDibuka = null;   // salinan baris yang sedang disunting; null = tambah baru
/* Berkas yang dipilih untuk ISR yang BELUM tersimpan. Baris baru belum punya id
   di server, jadi berkasnya ditahan di sini dulu — pola sama dengan PSN.tunda
   pada sertifikat personel — lalu diunggah begitu barisnya disimpan dan id-nya
   pasti ada. Untuk baris yang sudah ada, berkas diunggah seketika. */
let isrTunda = [];

function isrIsian(id, label, nilai, tipe, bantu){
  return `<div class="isian">
    <label for="${id}">${label}</label>
    <input id="${id}" type="${tipe||'text'}" autocomplete="off" value="${esc(nilai||'')}">
    ${bantu ? `<div class="bantu">${bantu}</div>` : ''}</div>`;
}

function bukaIsr(row){
  isrDibuka = row ? { ...row } : null;
  isrTunda = [];
  const baru = !row;
  el('judulIsr').textContent = baru ? T('Tambah ISR','Add licence') : T('Ubah ISR','Edit licence');
  el('ketIsr').textContent = namaUnit(unitDibuka);
  el('btnSimpanIsr').textContent = baru ? T('Tambahkan','Add') : T('Simpan perubahan','Save changes');

  const bolehHapus = !baru && BOLEH_HAPUS.isr;
  const kotakHapus = bolehHapus ? `
    <div class="bahaya">
      <div class="jdl">${T('Hapus izin ini','Delete this licence')}</div>
      <p>${T('Terhapus dari server untuk semua orang. Tidak bisa dibatalkan.',
             'Deleted from the server for everyone. This cannot be undone.')}</p>
      <button class="btn bahaya-tombol" id="btnHapusIsr">${T('Hapus','Delete')}</button>
    </div>` : '';

  el('badanIsr').innerHTML = `
    ${isrIsian('iNama', T('Nama Stasiun / Perangkat','Station / Device'), row && row.nama,
        'text', T('Nama stasiun radio atau perangkatnya, mis. <span class="mono">VHF A/G 118.75</span>.',
                  'The radio station or device name, e.g. <span class="mono">VHF A/G 118.75</span>.'))}
    <div class="isian-grid">
      ${isrIsian('iNomor', T('No. ISR','Licence No.'), row && row.nomor)}
      ${isrIsian('iFrek', T('Frekuensi','Frequency'), row && row.frek, 'text',
        T('Boleh beberapa, mis. <span class="mono">118.75 MHz</span>.','Several is fine, e.g. <span class="mono">118.75 MHz</span>.'))}
      ${isrIsian('iKelas', T('Kelas Stasiun','Station class'), row && row.kelas)}
      ${isrIsian('iLokasi', T('Lokasi','Location'), row && row.lokasi)}
      ${isrIsian('iMulai', T('Tgl Berlaku','Valid from'), row && row.mulai, 'date')}
      ${isrIsian('iHabis', T('Tgl Habis','Valid until'), row && row.habis, 'date',
        T('Yang menentukan peringatan di beranda dan lonceng. Kosong = tidak pernah diperingatkan.',
          'Drives the home-screen and bell warnings. Empty = never warned.'))}
    </div>
    <div class="isian">
      <label for="iKet">${T('Keterangan','Notes')}</label>
      <input id="iKet" type="text" autocomplete="off" value="${esc((row && row.ket) || '')}">
    </div>
    ${isrKotakLampiran(baru)}
    ${kotakHapus}`;

  el('btnHapusIsr')?.addEventListener('click', hapusIsr);
  isrGambarLampiran();
  el('isrTambahBerkas')?.addEventListener('change', isrUnggahLampiran);
  el('lapisIsr').classList.add('buka');
  el('iNama').focus();
}

/* Kotak lampiran di kartu ISR — ada di mode tambah maupun ubah. Untuk baris
   yang sudah tersimpan, berkas diunggah SEKETIKA (menulis ke rak Dokumen).
   Untuk baris baru yang belum punya id, berkas ditahan di isrTunda dan diunggah
   begitu tombol Simpan menyimpan barisnya. */
function isrKotakLampiran(baru){
  const bolehTulis = KEMAMPUAN.dokumenTulis && bolehSuntingDb('dokumen');
  return `<div class="isian" style="border-top:1px dashed var(--line);padding-top:12px">
    <label>${T('Lampiran berkas','Attachments')}</label>
    <div id="isrLampiranDaftar"></div>
    ${bolehTulis
      ? `<label class="btn garis kecil" style="margin-top:8px;display:inline-block;cursor:pointer">
          ${T('Tambah berkas','Add file')}
          <input type="file" id="isrTambahBerkas" multiple hidden
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.tif,.tiff,.zip">
        </label>
        <div class="bantu" style="margin-top:6px">${T('PDF, gambar, atau dokumen · paling besar 25 MB per berkas. '
          + 'Tersimpan di rak Dokumen unit, hanya bisa dibuka setelah masuk.',
            'PDF, image, or document · at most 25 MB each. Kept in the unit document store, only openable '
          + 'after signing in.')}${baru ? ' ' + T('Berkasnya diunggah saat kartu ini disimpan.',
            'The files are uploaded when this card is saved.') : ''}</div>`
      : `<div class="bantu">${T('Peran akun Anda tidak diberi hak menambah berkas dokumen unit.',
          'Your role is not granted the right to add unit document files.')}</div>`}
  </div>`;
}

/** Gambar ulang HANYA daftar lampiran di kartu — dipanggil setelah unggah/hapus,
    tanpa menyentuh isian lain (jadi editan yang belum disimpan tidak hilang).
    Baris baru (isrDibuka null) menampilkan antrean isrTunda; baris tersimpan
    menampilkan berkas yang benar-benar ada di rak Dokumen. */
function isrGambarLampiran(){
  const kotak = el('isrLampiranDaftar');
  if(!kotak) return;

  // Mode tambah: tampilkan berkas yang masih ditahan (belum diunggah).
  if(!isrDibuka){
    if(!isrTunda.length){
      kotak.innerHTML = `<div class="bantu" style="color:var(--muted)">${
        T('Belum ada berkas dipilih.','No files chosen yet.')}</div>`;
      return;
    }
    kotak.innerHTML = `<div style="display:flex;flex-direction:column;gap:6px">${
      isrTunda.map((f,i)=>`<div style="display:flex;align-items:center;gap:8px">
        <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          📎 ${esc(f.name)} <span class="mono" style="color:var(--warn);font-size:11px">${
            T('(belum diunggah)','(pending)')}</span></span>
        <span class="mono" style="color:var(--muted);font-size:11px">${isrUkuran(f.size)}</span>
        <button type="button" class="btn garis kecil bahaya-garis" data-isr-tunda-buang="${i}">${
          T('Batal','Remove')}</button>
      </div>`).join('')}</div>`;
    kotak.querySelectorAll('[data-isr-tunda-buang]').forEach(b=>{
      b.addEventListener('click', ()=>{ isrTunda.splice(Number(b.dataset.isrTundaBuang), 1); isrGambarLampiran(); });
    });
    return;
  }

  // Mode ubah: berkas yang sudah ada di rak Dokumen, dikaitkan ke id ISR ini.
  const daftar = isrLampiran(isrDibuka.id);
  const bolehHapus = KEMAMPUAN.dokumenTulis && BOLEH_HAPUS.dokumen;
  if(!daftar.length){
    kotak.innerHTML = `<div class="bantu" style="color:var(--muted)">${
      T('Belum ada berkas dilampirkan.','No files attached yet.')}</div>`;
    return;
  }
  kotak.innerHTML = `<div style="display:flex;flex-direction:column;gap:6px">${
    daftar.map(b=>`<div style="display:flex;align-items:center;gap:8px">
      <a href="/dokumen/${esc(unitDibuka)}/${esc(b.id)}" target="_blank" rel="noopener"
        style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
        📄 ${esc(b.nama)}</a>
      <span class="mono" style="color:var(--muted);font-size:11px">${isrUkuran(b.ukuran)}</span>
      ${bolehHapus ? `<button type="button" class="btn garis kecil bahaya-garis"
        data-isr-hapus-berkas="${esc(b.id)}">${T('Hapus','Delete')}</button>` : ''}
    </div>`).join('')}</div>`;

  kotak.querySelectorAll('[data-isr-hapus-berkas]').forEach(b=>{
    b.addEventListener('click', ()=>isrHapusLampiran(b.dataset.isrHapusBerkas, b));
  });
}

async function isrUnggahLampiran(e){
  const input = e.target;
  const berkas = [...(input.files || [])];
  if(!berkas.length) return;

  // Baris baru: tahan dulu, unggah saat kartu disimpan (id-nya belum ada).
  if(!isrDibuka){
    for(const f of berkas){
      if(f.size > BRK_BATAS){ pesan(T(`"${f.name}" lebih dari 25 MB — dilewati.`, `"${f.name}" is over 25 MB — skipped.`)); continue; }
      isrTunda.push(f);
    }
    input.value = '';
    isrGambarLampiran();
    return;
  }

  input.disabled = true;
  let sukses = 0;
  for(const f of berkas){
    if(f.size > BRK_BATAS){
      pesan(T(`"${f.name}" lebih dari 25 MB — dilewati.`, `"${f.name}" is over 25 MB — skipped.`));
      continue;
    }
    try{
      await dokKirim(unitDibuka, f, 'Sertifikat', '', isrDibuka.id);
      sukses++;
    }catch(err){
      pesan(T(`Gagal mengunggah "${f.name}": `, `Could not upload "${f.name}": `) + (err && err.message || err));
    }
  }
  input.value = ''; input.disabled = false;
  if(sukses){
    await dokMuat();
    isrGambarLampiran();
    gambarUnit();       // segarkan lencana 📎 di tabel di belakang kartu
    // kartu ISR digambar ulang oleh gambarUnit? tidak — kartu terpisah dari #isiUnit.
    pesan(T(`${sukses} berkas dilampirkan.`, `${sukses} file(s) attached.`));
  }
}

async function isrHapusLampiran(id, btn){
  if(!confirm(T('Keluarkan berkas ini dari lampiran ISR?\n\nBerkasnya ikut dihapus dari server.',
                'Remove this file from the ISR attachments?\n\nThe file is deleted from the server too.'))) return;
  if(btn) btn.disabled = true;
  try{
    const r = await srvFetch(`/dokumen/${encodeURIComponent(unitDibuka)}/${encodeURIComponent(id)}`,
      { method:'DELETE' }, 15000);
    const j = await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(j.error || 'server menjawab ' + r.status);
    await dokMuat();
    isrGambarLampiran();
    gambarUnit();
    pesan(T('Berkas dihapus.','File deleted.'));
  }catch(err){
    if(btn) btn.disabled = false;
    pesan(T('Gagal menghapus: ','Could not delete: ') + (err && err.message || err));
  }
}

function tutupIsr(){
  el('lapisIsr').classList.remove('buka');
  isrDibuka = null;
  isrTunda = [];
}

async function simpanIsr(){
  const unit = unitDibuka;
  const nilai = (id) => el(id).value.trim();
  const nama = nilai('iNama');
  if(!nama){ pesan(T('Nama stasiun/perangkat belum diisi.','The station/device name is empty.')); return; }

  const mulai = el('iMulai').value, habis = el('iHabis').value;
  if(mulai && habis && habis < mulai){
    pesan(T('Tanggal habis lebih awal daripada tanggal berlaku.','The expiry date is earlier than the start date.'));
    return;
  }

  const isi = {
    nama,
    nomor:  nilai('iNomor'),
    frek:   nilai('iFrek'),
    kelas:  nilai('iKelas'),
    lokasi: nilai('iLokasi'),
    mulai, habis,
    ket:    nilai('iKet')
  };

  const daftar = ISR[unit] = Array.isArray(ISR[unit]) ? ISR[unit] : [];
  const adaSebelum = !!isrDibuka;
  // id barisnya — untuk baris baru dibuat di sini supaya berkas tunda bisa
  // dikaitkan ke id yang sama. rapikanIsr di server mempertahankan id klien
  // selama sah dan unik, jadi id ini tetap berlaku sesudah unitdbMuat().
  let idBaris;
  if(isrDibuka){
    idBaris = isrDibuka.id;
    const a = daftar.find(x=>x.id === idBaris);
    if(!a){ pesan(T('Izin itu sudah tidak ada di daftar.','That licence is no longer in the list.')); return; }
    Object.assign(a, isi);
  }else{
    idBaris = 'i' + Math.random().toString(36).slice(2,8);
    daftar.push({ id: idBaris, ...isi, dibuat: new Date().toISOString() });
  }

  el('btnSimpanIsr').disabled = true;
  try{
    if(!(await dbSimpanUnit('isr', unit))){
      tutupIsr(); gambarUnit(); return;   // dbSimpanUnit sudah membaca ulang dari server
    }

    // Berkas yang ditahan untuk baris baru diunggah sekarang — barisnya sudah
    // tersimpan dengan idBaris, jadi kaitannya pasti sampai.
    const tunda = isrTunda.slice();
    let gagal = 0;
    for(const f of tunda){
      try{ await dokKirim(unit, f, 'Sertifikat', '', idBaris); }
      catch(err){ gagal++; console.warn('[isr] lampiran gagal diunggah:', err && err.message || err); }
    }

    await unitdbMuat();                    // ambil id resmi + bentuk rapi dari server
    await dokMuat();
    tutupIsr();
    gambarUnit(); gambarPerhatian(); gambarLonceng();
    if(gagal){
      pesan(T(`Izin tersimpan, tetapi ${gagal} berkas gagal diunggah.`,
              `Licence saved, but ${gagal} file(s) failed to upload.`));
    }else{
      pesan(adaSebelum ? T('Perubahan tersimpan.','Changes saved.')
        : (tunda.length ? T(`Ditambahkan dengan ${tunda.length} lampiran.`, `Added with ${tunda.length} attachment(s).`)
                        : T('Ditambahkan ke daftar.','Added to the list.')));
    }
  }finally{
    el('btnSimpanIsr').disabled = false;
  }
}

async function hapusIsr(){
  const unit = unitDibuka;
  if(!isrDibuka) return;
  const idIsr = isrDibuka.id;

  // Berkas lampiran ikut dibuang — daftar ISR yang kosong sementara berkasnya
  // menumpuk cuma menyisakan sampah tak terlihat di rak Dokumen. Gagal di sini
  // tidak membatalkan penghapusan ISR-nya; berkas yatim jauh lebih ringan
  // daripada baris ISR yang gagal hilang.
  for(const b of isrLampiran(idIsr)){
    try{ await srvFetch(`/dokumen/${encodeURIComponent(unit)}/${encodeURIComponent(b.id)}`, { method:'DELETE' }, 15000); }
    catch(e){ console.warn('[isr] lampiran gagal dihapus:', e && e.message || e); }
  }

  const daftar = ISR[unit] || [];
  const i = daftar.findIndex(x=>x.id === idIsr);
  if(i >= 0) daftar.splice(i, 1);
  if(!(await dbSimpanUnit('isr', unit))){ tutupIsr(); gambarUnit(); return; }
  await unitdbMuat(); await dokMuat();
  tutupIsr();
  gambarUnit(); gambarPerhatian(); gambarLonceng();
  pesan(T('Dihapus dari daftar.','Deleted from the list.'));
}

/* Satu pendengar di #isiUnit, alasannya sama dengan modul lain: isi layar unit
   diganti tiap kali unitnya berpindah, jadi pendengar per-tombol akan mati
   bersama tombolnya. */
el('isiUnit').addEventListener('click', e=>{
  const tambah = e.target.closest('[data-isr-tambah]');
  if(tambah){ bukaIsr(null); return; }
  const ubah = e.target.closest('[data-isr-ubah]');
  if(ubah){
    const row = (ISR[unitDibuka] || []).find(x=>x.id === ubah.dataset.isrUbah);
    if(row) bukaIsr(row);
  }
});

el('btnBatalIsr').addEventListener('click', tutupIsr);
el('btnSimpanIsr').addEventListener('click', simpanIsr);
el('lapisIsr').addEventListener('click', e=>{ if(e.target === el('lapisIsr')) tutupIsr(); });
document.addEventListener('keydown', e=>{
  if(e.key === 'Escape' && el('lapisIsr').classList.contains('buka')) tutupIsr();
});
