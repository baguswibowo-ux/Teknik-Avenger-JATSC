/* =======================================================================
   NOTAM TEKNIK

   Catatan NOTAM yang terbit karena peralatan unit — alat off, maintenance,
   uji terbang. Bukan penarik NOTAM resmi dari AIS: yang tercatat di sini
   diisi sendiri oleh yang berdinas, supaya seluruh unit tahu NOTAM teknik apa
   yang sedang berlaku dan kapan harus dicabut.

   Penyimpanannya modul Database Unit sepola ISR (/unitdb/notam/:unit, dijaga
   HAK_BAWAAN.notam di server.js). Dua pintu, satu data:
     · layar "NOTAM" di rel — seluruh unit, hanya membaca;
     · subtab NOTAM di Database Unit — tempat menambah dan menyunting.

   Semua jam UTC berbentuk "YYYY-MM-DDTHH:MM". Status TIDAK disimpan; dihitung
   dari jam sekarang di notamStatus(), jadi tidak pernah basi.
   ======================================================================= */

/** Jam UTC "YYYY-MM-DDTHH:MM" jadi milidetik, atau null kalau kosong/tidak sah. */
function notamMs(t){
  if(!t) return null;
  const ms = Date.parse(t + ':00Z');
  return isNaN(ms) ? null : ms;
}

/** Jam UTC jadi teks pendek "14 Sep 2026 08:30". */
function notamJamTeks(t){
  const ms = notamMs(t);
  if(ms == null) return '—';
  const d = new Date(ms), p = (x)=>String(x).padStart(2,'0');
  return `${d.getUTCDate()} ${d.toLocaleDateString(LOKAL(),{month:'short',timeZone:'UTC'})} `
       + `${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

/** Jam sekarang dalam bentuk isian datetime-local UTC — bawaan kolom Mulai. */
function notamJamKini(){
  return new Date().toISOString().slice(0, 16);
}

/**
 * Status satu NOTAM saat ini:
 *   'diganti'   — sudah diganti NOTAM lain (NOTAMR)
 *   'dicabut'   — dicabut (NOTAMC)
 *   'terjadwal' — belum mulai
 *   'estlewat'  — jam perkiraan selesai (EST) sudah lewat, tapi belum dicabut
 *                 atau diganti: masih dianggap berlaku dan perlu ditindaklanjuti
 *   'berakhir'  — jam selesai pasti sudah lewat
 *   'aktif'     — sedang berlaku
 */
function notamStatus(r, kini = Date.now()){
  if(r.gantiOleh) return 'diganti';
  const cabut = notamMs(r.dicabut);
  if(cabut != null && cabut <= kini) return 'dicabut';
  const mulai = notamMs(r.mulai);
  if(mulai != null && kini < mulai) return 'terjadwal';
  if(r.selesaiJenis === 'perm') return 'aktif';
  const selesai = notamMs(r.selesai);
  if(selesai != null && kini >= selesai) return r.selesaiJenis === 'est' ? 'estlewat' : 'berakhir';
  return 'aktif';
}

/** Masih berlaku (dihitung di lencana): aktif atau EST-nya lewat. */
const notamBerlaku = (s) => s === 'aktif' || s === 'estlewat';

const NOTAM_STATUS = {
  aktif:     { cip:'bahaya', id:'Aktif',      en:'Active' },
  estlewat:  { cip:'awas',   id:'EST lewat',  en:'EST passed' },
  terjadwal: { cip:'',       id:'Terjadwal',  en:'Scheduled' },
  berakhir:  { cip:'aman',   id:'Berakhir',   en:'Ended' },
  dicabut:   { cip:'aman',   id:'Dicabut',    en:'Cancelled' },
  diganti:   { cip:'aman',   id:'Diganti',    en:'Replaced' }
};
const notamCip = (s) => `<span class="cip ${NOTAM_STATUS[s].cip}">${esc(T(NOTAM_STATUS[s].id, NOTAM_STATUS[s].en))}</span>`;

/** Urutan tampil: yang berlaku di atas, lalu terjadwal, lalu sisanya; di dalam
    kelompok, yang mulai paling baru dulu. */
const NOTAM_URUT = { estlewat:0, aktif:1, terjadwal:2, berakhir:3, dicabut:4, diganti:5 };
function notamUrut(a, b){
  const sa = NOTAM_URUT[a.status], sb = NOTAM_URUT[b.status];
  if(sa !== sb) return sa - sb;
  return String(b.mulai || '').localeCompare(String(a.mulai || ''));
}

/** Jumlah NOTAM yang masih berlaku di satu unit — lencana subtab. */
function notamAktifUnit(unit){
  return (NOTAM[unit] || []).filter(r=>notamBerlaku(notamStatus(r))).length;
}

/** Nama alat untuk ditampilkan: dari Daftar Peralatan kalau masih ada, kalau
    tidak dari nama yang ikut tersimpan di baris NOTAM. */
function notamNamaAlat(unit, r){
  const a = (PERALATAN[unit] || []).find(x=>x.id === r.alat);
  return (a && a.nama) || r.alatNama || '';
}

/** Teks kolom selesai, dengan penanda EST / PERM. */
function notamSelesaiTeks(r){
  if(r.selesaiJenis === 'perm') return 'PERM';
  const jam = notamJamTeks(r.selesai);
  return r.selesaiJenis === 'est' && r.selesai ? `${jam} EST` : jam;
}

/** Keterangan tambahan kolom status: kapan dicabut / diganti oleh apa. */
function notamStatusRinci(r, s){
  if(s === 'diganti') return `→ ${esc(r.gantiOleh)}`;
  if(s === 'dicabut') return notamJamTeks(r.dicabut);
  return '';
}

/* ---------- Layar rel: seluruh unit ---------- */

let notamSaringUnit = '';          // '' = semua unit
let notamSaringStatus = 'berlaku'; // 'berlaku' (aktif+EST lewat+terjadwal) | 'semua' | kode status

function gambarNotam(){
  const kini = Date.now();
  const semua = [];
  Object.entries(NOTAM).forEach(([unit, baris])=>{
    (Array.isArray(baris) ? baris : []).forEach(r=>semua.push({ ...r, unit, status: notamStatus(r, kini) }));
  });

  const hitung = (s) => semua.filter(r=>r.status === s).length;
  const berlaku = semua.filter(r=>notamBerlaku(r.status)).length;
  // Lencana hanya tampil kalau ada NOTAM berlaku — angka 0 cuma bikin ramai.
  const lencana = el('lencanaNotam');
  if(lencana){ lencana.textContent = berlaku; lencana.hidden = !berlaku; }
  if(!el('tblNotam')) return;

  el('ubinNotam').innerHTML =
      ubin(hitung('aktif') ? 'merah' : '', T('Aktif','Active'), hitung('aktif'), T('sedang berlaku','in force'))
    + ubin(hitung('estlewat') ? 'kuning' : '', T('EST lewat','EST passed'), hitung('estlewat'),
        T('perlu dicabut / diganti','needs cancelling / replacing'))
    + ubin('biru', T('Terjadwal','Scheduled'), hitung('terjadwal'), T('belum mulai','not started yet'))
    + ubin('', T('Selesai','Closed'), hitung('berakhir') + hitung('dicabut') + hitung('diganti'),
        T('berakhir, dicabut, diganti','ended, cancelled, replaced'));

  const pilihanUnit = [['', T('Semua unit','All units')], ...UNIT.map(u=>[u.kode, u.nama])];
  const pilihanStatus = [
    ['berlaku', T('Berlaku & terjadwal','In force & scheduled')],
    ['semua', T('Semua status','All statuses')],
    ...Object.keys(NOTAM_STATUS).map(k=>[k, T(NOTAM_STATUS[k].id, NOTAM_STATUS[k].en)])
  ];
  const pilih = (id, daftar, nilai) => `<select id="${id}" style="background:var(--panel-2);color:var(--text);
      border:1px solid var(--line);border-radius:8px;padding:4px 8px;font-size:12px">${
    daftar.map(([v,t])=>`<option value="${esc(v)}" ${v===nilai?'selected':''}>${esc(t)}</option>`).join('')}</select>`;
  el('saringNotam').innerHTML = `<span style="display:inline-flex;gap:8px;flex-wrap:wrap">${
    pilih('notamPilihUnit', pilihanUnit, notamSaringUnit)}${pilih('notamPilihStatus', pilihanStatus, notamSaringStatus)}</span>`;
  el('notamPilihUnit').addEventListener('change', e=>{ notamSaringUnit = e.target.value; gambarNotam(); });
  el('notamPilihStatus').addEventListener('change', e=>{ notamSaringStatus = e.target.value; gambarNotam(); });

  const tampil = semua.filter(r=>{
    if(notamSaringUnit && r.unit !== notamSaringUnit) return false;
    if(notamSaringStatus === 'semua') return true;
    if(notamSaringStatus === 'berlaku') return notamBerlaku(r.status) || r.status === 'terjadwal';
    return r.status === notamSaringStatus;
  }).sort(notamUrut);

  const kepala = `<thead><tr><th>${T('Unit','Unit')}</th><th>${T('No. NOTAM','NOTAM No.')}</th>
    <th>${T('Peralatan','Equipment')}</th><th>${T('Mulai (UTC)','Start (UTC)')}</th>
    <th>${T('Selesai (UTC)','End (UTC)')}</th><th>Status</th><th>${T('Isi NOTAM','NOTAM text')}</th></tr></thead>`;

  if(!tampil.length){
    el('tblNotam').innerHTML = kepala + `<tbody><tr><td colspan="7" style="text-align:center;color:var(--muted);padding:22px">${
      semua.length ? T('Tidak ada NOTAM yang cocok dengan saringan ini.','No NOTAM matches this filter.')
                   : T('Belum ada NOTAM teknik tercatat.','No technical NOTAM recorded yet.')}</td></tr></tbody>`;
    return;
  }

  el('tblNotam').innerHTML = kepala + `<tbody>${tampil.map(r=>{
    // Baris bisa diklik hanya kalau unitnya memang terbuka penuh untuk akun
    // ini — subtab NOTAM tidak tampil di unit yang cuma dibuka lewat peran PIC.
    const buka = bolehBuka(r.unit);
    const rinci = notamStatusRinci(r, r.status);
    return `<tr ${buka ? `data-notam-unit="${esc(r.unit)}" style="cursor:pointer" title="${
        T('Buka NOTAM unit ini','Open this unit\'s NOTAM')}"` : ''}>
      <td><span class="mono" style="color:var(--accent)">${esc(namaUnit(r.unit))}</span></td>
      <td><span class="mono">${esc(r.nomor)}</span></td>
      <td>${esc(notamNamaAlat(r.unit, r) || '—')}</td>
      <td><span class="mono" style="font-size:11px;white-space:nowrap">${notamJamTeks(r.mulai)}</span></td>
      <td><span class="mono" style="font-size:11px;white-space:nowrap">${esc(notamSelesaiTeks(r))}</span></td>
      <td>${notamCip(r.status)}${rinci ? `<br><span class="mono" style="color:var(--muted);font-size:10.5px">${rinci}</span>` : ''}</td>
      <td style="white-space:pre-wrap;min-width:220px">${esc(r.isi || '—')}</td>
    </tr>`;
  }).join('')}</tbody>`;
}

el('tblNotam').addEventListener('click', e=>{
  const tr = e.target.closest('[data-notam-unit]');
  if(!tr) return;
  bukaUnit(tr.dataset.notamUnit);
  subtabAktif = 'notam';
  gambarUnit();
});

/* ---------- Subtab unit ---------- */

function panelNotamHtml(unit){
  const kini = Date.now();
  const daftar = (NOTAM[unit] || []).map(r=>({ ...r, status: notamStatus(r, kini) })).sort(notamUrut);
  const boleh = bolehSuntingDb('notam');
  const berlaku = daftar.filter(r=>notamBerlaku(r.status)).length;

  const kepala = `<div class="atur-data">
    <span class="ket">${daftar.length} ${T('NOTAM tercatat','NOTAMs recorded')}${
      berlaku ? ` · <b style="color:var(--fail)">${berlaku} ${T('sedang berlaku','in force')}</b>` : ''}</span>
    <span class="tombol">${boleh
      ? `<button class="btn kecil" data-notam-tambah>${T('Tambah NOTAM','Add NOTAM')}</button>` : ''}</span>
  </div>`;

  if(!daftar.length){
    return kepala + `<div class="panel"><div class="badan" style="color:var(--muted);font-size:12.5px;line-height:1.7">
      ${T('Belum ada NOTAM teknik tercatat untuk unit ini.','No technical NOTAM recorded for this unit yet.')}
      ${boleh ? T('Tekan <b style="color:var(--text)">Tambah NOTAM</b> di atas untuk mencatatnya.',
                  'Press <b style="color:var(--text)">Add NOTAM</b> above to record one.') : ''}</div></div>`;
  }

  const baris = daftar.map(r=>{
    const nL = notamLampiran(r.id).length;
    const rinci = notamStatusRinci(r, r.status);
    return `<tr>
      <td><span class="mono">${esc(r.nomor)}</span>${nL
        ? ` <span class="mono" style="color:var(--muted);font-size:11px" title="${
            T('berkas lampiran','attached files')}">📎${nL}</span>` : ''}</td>
      <td>${esc(notamNamaAlat(unit, r) || '—')}</td>
      <td><span class="mono" style="font-size:11px;white-space:nowrap">${notamJamTeks(r.mulai)}</span></td>
      <td><span class="mono" style="font-size:11px;white-space:nowrap">${esc(notamSelesaiTeks(r))}</span></td>
      <td>${notamCip(r.status)}${rinci ? `<br><span class="mono" style="color:var(--muted);font-size:10.5px">${rinci}</span>` : ''}</td>
      <td style="white-space:pre-wrap;min-width:200px">${esc(r.isi || '—')}</td>
      <td style="text-align:right">${boleh
        ? `<button class="btn garis kecil" data-notam-ubah="${esc(r.id)}">${T('Ubah','Edit')}</button>` : ''}</td>
    </tr>`;
  }).join('');

  return kepala + `<div class="panel">
    <div class="kepala"><h3>${T('NOTAM Teknik','Technical NOTAM')} — ${esc(namaUnit(unit))}</h3>
      <span class="ket">${T('semua jam UTC','all times UTC')}</span></div>
    <div class="gulir" style="max-height:none"><table>
      <thead><tr><th>${T('No. NOTAM','NOTAM No.')}</th><th>${T('Peralatan','Equipment')}</th>
        <th>${T('Mulai','Start')}</th><th>${T('Selesai','End')}</th><th>Status</th>
        <th>${T('Isi NOTAM','NOTAM text')}</th><th></th></tr></thead>
      <tbody>${baris}</tbody></table></div>
  </div>`;
}

/* ---------- Lampiran ----------
   Sama dengan ISR: berkasnya tinggal di rak Dokumen unit dan dikaitkan lewat
   field `notam` (id NOTAM). */
function notamLampiran(id){
  if(!id) return [];
  return (BERKAS[unitDibuka] || []).filter(b=>b.notam === id);
}

/* ---------- Kartu tambah / ubah ---------- */

let notamDibuka = null;   // salinan baris yang sedang disunting; null = tambah baru
let notamTunda = [];      // berkas untuk NOTAM yang belum tersimpan

function notamIsian(id, label, nilai, tipe, bantu){
  return `<div class="isian">
    <label for="${id}">${label}</label>
    <input id="${id}" type="${tipe||'text'}" autocomplete="off" value="${esc(nilai||'')}">
    ${bantu ? `<div class="bantu">${bantu}</div>` : ''}</div>`;
}

function bukaNotam(row){
  notamDibuka = row ? { ...row } : null;
  notamTunda = [];
  const baru = !row;
  const unit = unitDibuka;
  el('judulNotam').textContent = baru ? T('Tambah NOTAM','Add NOTAM') : T('Ubah NOTAM','Edit NOTAM');
  el('ketNotam').textContent = namaUnit(unit) + ' · UTC';
  el('btnSimpanNotam').textContent = baru ? T('Tambahkan','Add') : T('Simpan perubahan','Save changes');

  const alat = PERALATAN[unit] || [];
  const alatDipilih = row ? row.alat : '';
  // Alat yang sudah dibuang dari Daftar Peralatan tetap jadi pilihan supaya
  // menyunting NOTAM lama tidak diam-diam mengosongkan alatnya.
  const alatHilang = alatDipilih && !alat.some(a=>a.id === alatDipilih);
  const pilihanAlat = `<option value="">${T('— tidak terkait alat tertentu —','— not tied to a specific item —')}</option>`
    + alat.map(a=>`<option value="${esc(a.id)}" ${a.id===alatDipilih?'selected':''}>${esc(a.nama)}</option>`).join('')
    + (alatHilang ? `<option value="${esc(alatDipilih)}" selected>${esc(row.alatNama || alatDipilih)}</option>` : '');

  const jenis = (row && row.selesaiJenis) || 'pasti';
  const bolehHapus = !baru && BOLEH_HAPUS.notam;

  el('badanNotam').innerHTML = `
    <div class="isian-grid">
      ${notamIsian('nNomor', T('No. NOTAM','NOTAM No.'), row && row.nomor, 'text',
        T('Mis. <span class="mono">A1234/26</span>.','E.g. <span class="mono">A1234/26</span>.'))}
      <div class="isian">
        <label for="nAlat">${T('Peralatan','Equipment')}</label>
        <select id="nAlat">${pilihanAlat}</select>
      </div>
      ${notamIsian('nMulai', T('Mulai (UTC)','Start (UTC)'), row ? row.mulai : notamJamKini(), 'datetime-local')}
      <div class="isian">
        <label for="nSelesaiJenis">${T('Jenis selesai','End type')}</label>
        <select id="nSelesaiJenis">
          <option value="pasti" ${jenis==='pasti'?'selected':''}>${T('Pasti','Fixed')}</option>
          <option value="est" ${jenis==='est'?'selected':''}>${T('EST — perkiraan','EST — estimated')}</option>
          <option value="perm" ${jenis==='perm'?'selected':''}>${T('PERM — permanen','PERM — permanent')}</option>
        </select>
      </div>
      ${notamIsian('nSelesai', T('Selesai (UTC)','End (UTC)'), row && row.selesai, 'datetime-local')}
    </div>
    <div class="isian">
      <label for="nIsi">${T('Isi NOTAM (item E)','NOTAM text (item E)')}</label>
      <textarea id="nIsi" rows="4" style="font-family:var(--font-mono);font-size:12px">${esc((row && row.isi) || '')}</textarea>
    </div>
    <div class="isian-grid">
      ${notamIsian('nDicabut', T('Dicabut (UTC) — NOTAMC','Cancelled (UTC) — NOTAMC'), row && row.dicabut, 'datetime-local',
        T('Isi kalau NOTAM dicabut sebelum waktunya.','Fill in if the NOTAM was cancelled early.'))}
      ${notamIsian('nGanti', T('Diganti oleh — NOTAMR','Replaced by — NOTAMR'), row && row.gantiOleh, 'text',
        T('Nomor NOTAM pengganti.','The replacing NOTAM number.'))}
    </div>
    ${notamKotakLampiran(baru)}
    ${bolehHapus ? `
    <div class="bahaya">
      <div class="jdl">${T('Hapus catatan NOTAM ini','Delete this NOTAM record')}</div>
      <p>${T('Terhapus dari server untuk semua orang, beserta lampirannya. Tidak bisa dibatalkan. '
           + 'NOTAM yang dicabut cukup diisi kolom Dicabut, tidak perlu dihapus.',
             'Deleted from the server for everyone, with its attachments. This cannot be undone. '
           + 'A cancelled NOTAM only needs the Cancelled field, not deletion.')}</p>
      <button class="btn bahaya-tombol" id="btnHapusNotam">${T('Hapus','Delete')}</button>
    </div>` : ''}`;

  const aturPerm = () => {
    const perm = el('nSelesaiJenis').value === 'perm';
    el('nSelesai').disabled = perm;
    if(perm) el('nSelesai').value = '';
  };
  el('nSelesaiJenis').addEventListener('change', aturPerm);
  aturPerm();
  el('btnHapusNotam')?.addEventListener('click', hapusNotam);
  notamGambarLampiran();
  el('notamTambahBerkas')?.addEventListener('change', notamUnggahLampiran);
  el('lapisNotam').classList.add('buka');
  el('nNomor').focus();
}

function notamKotakLampiran(baru){
  const bolehTulis = KEMAMPUAN.dokumenTulis && bolehSuntingDb('dokumen');
  return `<div class="isian" style="border-top:1px dashed var(--line);padding-top:12px">
    <label>${T('Lampiran berkas','Attachments')}</label>
    <div id="notamLampiranDaftar"></div>
    ${bolehTulis
      ? `<label class="btn garis kecil" style="margin-top:8px;display:inline-block;cursor:pointer">
          ${T('Tambah berkas','Add file')}
          <input type="file" id="notamTambahBerkas" multiple hidden
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.txt">
        </label>
        <div class="bantu" style="margin-top:6px">${T('PDF atau foto NOTAM yang terbit · paling besar 25 MB per berkas. '
          + 'Tersimpan di rak Dokumen unit.',
            'PDF or photo of the issued NOTAM · at most 25 MB each. Kept in the unit document store.')}${
          baru ? ' ' + T('Berkasnya diunggah saat kartu ini disimpan.','The files are uploaded when this card is saved.') : ''}</div>`
      : `<div class="bantu">${T('Peran akun Anda tidak diberi hak menambah berkas dokumen unit.',
          'Your role is not granted the right to add unit document files.')}</div>`}
  </div>`;
}

function notamGambarLampiran(){
  const kotak = el('notamLampiranDaftar');
  if(!kotak) return;

  if(!notamDibuka){
    if(!notamTunda.length){
      kotak.innerHTML = `<div class="bantu" style="color:var(--muted)">${T('Belum ada berkas dipilih.','No files chosen yet.')}</div>`;
      return;
    }
    kotak.innerHTML = `<div style="display:flex;flex-direction:column;gap:6px">${
      notamTunda.map((f,i)=>`<div style="display:flex;align-items:center;gap:8px">
        <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          📎 ${esc(f.name)} <span class="mono" style="color:var(--warn);font-size:11px">${T('(belum diunggah)','(pending)')}</span></span>
        <span class="mono" style="color:var(--muted);font-size:11px">${isrUkuran(f.size)}</span>
        <button type="button" class="btn garis kecil bahaya-garis" data-notam-tunda-buang="${i}">${T('Batal','Remove')}</button>
      </div>`).join('')}</div>`;
    kotak.querySelectorAll('[data-notam-tunda-buang]').forEach(b=>{
      b.addEventListener('click', ()=>{ notamTunda.splice(Number(b.dataset.notamTundaBuang), 1); notamGambarLampiran(); });
    });
    return;
  }

  const daftar = notamLampiran(notamDibuka.id);
  const bolehHapus = KEMAMPUAN.dokumenTulis && BOLEH_HAPUS.dokumen;
  if(!daftar.length){
    kotak.innerHTML = `<div class="bantu" style="color:var(--muted)">${T('Belum ada berkas dilampirkan.','No files attached yet.')}</div>`;
    return;
  }
  kotak.innerHTML = `<div style="display:flex;flex-direction:column;gap:6px">${
    daftar.map(b=>`<div style="display:flex;align-items:center;gap:8px">
      <a href="/dokumen/${esc(unitDibuka)}/${esc(b.id)}" target="_blank" rel="noopener"
        style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">📄 ${esc(b.nama)}</a>
      <span class="mono" style="color:var(--muted);font-size:11px">${isrUkuran(b.ukuran)}</span>
      ${bolehHapus ? `<button type="button" class="btn garis kecil bahaya-garis" data-notam-hapus-berkas="${esc(b.id)}">${
        T('Hapus','Delete')}</button>` : ''}
    </div>`).join('')}</div>`;
  kotak.querySelectorAll('[data-notam-hapus-berkas]').forEach(b=>{
    b.addEventListener('click', ()=>notamHapusLampiran(b.dataset.notamHapusBerkas, b));
  });
}

async function notamUnggahLampiran(e){
  const input = e.target;
  const berkas = [...(input.files || [])];
  if(!berkas.length) return;
  const terlaluBesar = (f) => {
    if(f.size <= BRK_BATAS) return false;
    pesan(T(`"${f.name}" lebih dari 25 MB — dilewati.`, `"${f.name}" is over 25 MB — skipped.`));
    return true;
  };

  if(!notamDibuka){
    berkas.filter(f=>!terlaluBesar(f)).forEach(f=>notamTunda.push(f));
    input.value = '';
    notamGambarLampiran();
    return;
  }

  input.disabled = true;
  let sukses = 0;
  for(const f of berkas){
    if(terlaluBesar(f)) continue;
    try{ await dokKirim(unitDibuka, f, 'Lainnya', '', '', notamDibuka.id); sukses++; }
    catch(err){ pesan(T(`Gagal mengunggah "${f.name}": `, `Could not upload "${f.name}": `) + (err && err.message || err)); }
  }
  input.value = ''; input.disabled = false;
  if(sukses){
    await dokMuat();
    notamGambarLampiran();
    gambarUnit();
    pesan(T(`${sukses} berkas dilampirkan.`, `${sukses} file(s) attached.`));
  }
}

async function notamHapusLampiran(id, btn){
  if(!confirm(T('Keluarkan berkas ini dari lampiran NOTAM?\n\nBerkasnya ikut dihapus dari server.',
                'Remove this file from the NOTAM attachments?\n\nThe file is deleted from the server too.'))) return;
  if(btn) btn.disabled = true;
  try{
    const r = await srvFetch(`/dokumen/${encodeURIComponent(unitDibuka)}/${encodeURIComponent(id)}`, { method:'DELETE' }, 15000);
    const j = await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(j.error || 'server menjawab ' + r.status);
    await dokMuat();
    notamGambarLampiran();
    gambarUnit();
    pesan(T('Berkas dihapus.','File deleted.'));
  }catch(err){
    if(btn) btn.disabled = false;
    pesan(T('Gagal menghapus: ','Could not delete: ') + (err && err.message || err));
  }
}

function tutupNotam(){
  el('lapisNotam').classList.remove('buka');
  notamDibuka = null;
  notamTunda = [];
}

async function simpanNotam(){
  const unit = unitDibuka;
  const nilai = (id) => el(id).value.trim();
  const nomor = nilai('nNomor').toUpperCase();
  if(!nomor){ pesan(T('Nomor NOTAM belum diisi.','The NOTAM number is empty.')); return; }
  const mulai = el('nMulai').value;
  if(!mulai){ pesan(T('Jam mulai belum diisi.','The start time is empty.')); return; }
  const selesaiJenis = el('nSelesaiJenis').value;
  const selesai = selesaiJenis === 'perm' ? '' : el('nSelesai').value;
  if(selesaiJenis !== 'perm' && !selesai){
    pesan(T('Jam selesai belum diisi — pilih PERM kalau memang permanen.',
            'The end time is empty — choose PERM if it is permanent.'));
    return;
  }
  if(selesai && selesai <= mulai){
    pesan(T('Jam selesai harus sesudah jam mulai.','The end time must be after the start time.'));
    return;
  }

  const daftar = NOTAM[unit] = Array.isArray(NOTAM[unit]) ? NOTAM[unit] : [];
  // Nomor yang sama di unit yang sama hampir pasti salah ketik atau dobel isi.
  const kembar = daftar.find(x=>x.nomor === nomor && (!notamDibuka || x.id !== notamDibuka.id));
  if(kembar){ pesan(T(`NOTAM ${nomor} sudah tercatat di unit ini.`, `NOTAM ${nomor} is already recorded for this unit.`)); return; }

  const alatId = el('nAlat').value;
  const alat = (PERALATAN[unit] || []).find(a=>a.id === alatId);
  const isi = {
    nomor,
    alat: alatId,
    alatNama: alat ? alat.nama : (alatId && notamDibuka ? notamDibuka.alatNama || '' : ''),
    mulai, selesai, selesaiJenis,
    isi: el('nIsi').value.trim(),
    dicabut: el('nDicabut').value,
    gantiOleh: nilai('nGanti').toUpperCase()
  };

  const adaSebelum = !!notamDibuka;
  let idBaris;
  if(notamDibuka){
    idBaris = notamDibuka.id;
    const a = daftar.find(x=>x.id === idBaris);
    if(!a){ pesan(T('NOTAM itu sudah tidak ada di daftar.','That NOTAM is no longer in the list.')); return; }
    Object.assign(a, isi);
  }else{
    idBaris = 'n' + Math.random().toString(36).slice(2,8);
    daftar.push({ id: idBaris, ...isi, dibuat: new Date().toISOString() });
  }

  el('btnSimpanNotam').disabled = true;
  try{
    if(!(await dbSimpanUnit('notam', unit))){ tutupNotam(); gambarUnit(); gambarNotam(); return; }

    const tunda = notamTunda.slice();
    let gagal = 0;
    for(const f of tunda){
      try{ await dokKirim(unit, f, 'Lainnya', '', '', idBaris); }
      catch(err){ gagal++; console.warn('[notam] lampiran gagal diunggah:', err && err.message || err); }
    }

    await unitdbMuat();
    await dokMuat();
    tutupNotam();
    gambarUnit(); gambarNotam();
    if(gagal){
      pesan(T(`NOTAM tersimpan, tetapi ${gagal} berkas gagal diunggah.`, `NOTAM saved, but ${gagal} file(s) failed to upload.`));
    }else{
      pesan(adaSebelum ? T('Perubahan tersimpan.','Changes saved.')
        : T('NOTAM dicatat.','NOTAM recorded.'));
    }
  }finally{
    el('btnSimpanNotam').disabled = false;
  }
}

async function hapusNotam(){
  const unit = unitDibuka;
  if(!notamDibuka) return;
  if(!confirm(T(`Hapus catatan NOTAM ${notamDibuka.nomor}?`, `Delete NOTAM record ${notamDibuka.nomor}?`))) return;
  const id = notamDibuka.id;

  for(const b of notamLampiran(id)){
    try{ await srvFetch(`/dokumen/${encodeURIComponent(unit)}/${encodeURIComponent(b.id)}`, { method:'DELETE' }, 15000); }
    catch(e){ console.warn('[notam] lampiran gagal dihapus:', e && e.message || e); }
  }

  const daftar = NOTAM[unit] || [];
  const i = daftar.findIndex(x=>x.id === id);
  if(i >= 0) daftar.splice(i, 1);
  if(!(await dbSimpanUnit('notam', unit))){ tutupNotam(); gambarUnit(); gambarNotam(); return; }
  await unitdbMuat(); await dokMuat();
  tutupNotam();
  gambarUnit(); gambarNotam();
  pesan(T('Catatan NOTAM dihapus.','NOTAM record deleted.'));
}

el('isiUnit').addEventListener('click', e=>{
  if(e.target.closest('[data-notam-tambah]')){ bukaNotam(null); return; }
  const ubah = e.target.closest('[data-notam-ubah]');
  if(ubah){
    const row = (NOTAM[unitDibuka] || []).find(x=>x.id === ubah.dataset.notamUbah);
    if(row) bukaNotam(row);
  }
});

el('btnBatalNotam').addEventListener('click', tutupNotam);
el('btnSimpanNotam').addEventListener('click', simpanNotam);
el('lapisNotam').addEventListener('click', e=>{ if(e.target === el('lapisNotam')) tutupNotam(); });
document.addEventListener('keydown', e=>{
  if(e.key === 'Escape' && el('lapisNotam').classList.contains('buka')) tutupNotam();
});

/* Status berganti sendiri seiring jam (terjadwal → aktif → berakhir). Halaman
   yang dibiarkan terbuka di ruang kontrol digambar ulang tiap menit — cukup
   layar NOTAM dan lencananya, bukan seluruh dashboard. */
setInterval(()=>{
  // Jangan menggambar ulang saringan yang sedang dibuka orang — pilihannya tertutup sendiri.
  const fokus = document.activeElement;
  if(fokus && fokus.closest && fokus.closest('#saringNotam')) return;
  if(akun) gambarNotam();
}, 60000);
