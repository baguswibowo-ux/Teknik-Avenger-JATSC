/* E-Logbook · js/10-lampiran.js — Unggah, pratinjau, dan galeri lampiran berkas
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh. */

/* ============== LAMPIRAN ============== */
const LAMPIRAN_MAKS_JUMLAH = 6;
const LAMPIRAN_MAKS_BYTE = 8 * 1024 * 1024;
const LAMPIRAN_JENIS = ['image/jpeg','image/png','image/webp','application/pdf'];

function ukuranTeks(n){
  if(n < 1024) return n + ' B';
  if(n < 1024*1024) return (n/1024).toFixed(0) + ' KB';
  return (n/1024/1024).toFixed(1) + ' MB';
}

function bacaSebagaiDataUrl(file){
  return new Promise((resolve, reject)=>{
    const fr = new FileReader();
    fr.onload = ()=>resolve(fr.result);
    fr.onerror = ()=>reject(new Error('Berkas gagal dibaca.'));
    fr.readAsDataURL(file);
  });
}

/**
 * Foto dari HP sering 4–12 MB padahal yang dibutuhkan hanya keterbacaan.
 * Gambar dikecilkan ke sisi terpanjang 1600px dan disimpan sebagai JPEG.
 * PDF tidak disentuh karena hasil scan dokumen harus tetap utuh.
 */
async function siapkanBerkas(file){
  if(file.type === 'application/pdf') return await bacaSebagaiDataUrl(file);

  const dataUrl = await bacaSebagaiDataUrl(file);
  const img = await new Promise((resolve, reject)=>{
    const i = new Image();
    i.onload = ()=>resolve(i);
    i.onerror = ()=>reject(new Error('Gambar gagal dibuka.'));
    i.src = dataUrl;
  });

  const maks = 1600;
  const skala = Math.min(1, maks / Math.max(img.width, img.height));
  if(skala === 1 && dataUrl.length < 1.6 * LAMPIRAN_MAKS_BYTE) return dataUrl;

  const c = document.createElement('canvas');
  c.width = Math.round(img.width * skala);
  c.height = Math.round(img.height * skala);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.82);
}

/* Beberapa form memakai pemilih lampiran sekaligus (catatan logbook, isu fase
   open, isu fase closed), jadi pilihannya disimpan per kotak, bukan satu global.
   Tiap kotak butuh tiga elemen: <input id="<kotak>">, hint, dan list. */
const PESAN_LAMPIRAN = 'Maksimal 6 berkas, 8 MB per berkas. JPG, PNG, WEBP, atau PDF. Foto berukuran besar dikecilkan otomatis sebelum dikirim.';
const lampiranPilihan = {};

function kotakLampiran(kotak){
  if(!lampiranPilihan[kotak]) lampiranPilihan[kotak] = [];
  return lampiranPilihan[kotak];
}

function resetLampiran(kotak){
  lampiranPilihan[kotak] = [];
  const hint = document.getElementById(kotak + 'Hint');
  if(hint) hint.textContent = PESAN_LAMPIRAN;
  renderLampiranPilihan(kotak);
}

async function pilihLampiran(input, kotak){
  const daftar = kotakLampiran(kotak);
  const hint = document.getElementById(kotak + 'Hint');
  const pesan = t => { if(hint) hint.textContent = t; };
  const berkas = Array.from(input.files || []);
  input.value = '';   // supaya berkas yang sama bisa dipilih lagi setelah dihapus
  if(berkas.length === 0) return;

  for(const f of berkas){
    if(daftar.length >= LAMPIRAN_MAKS_JUMLAH){
      pesan(`Maksimal ${LAMPIRAN_MAKS_JUMLAH} berkas. Sisanya tidak ditambahkan.`);
      break;
    }
    if(!LAMPIRAN_JENIS.includes(f.type)){
      pesan(`"${f.name}" dilewati — hanya JPG, PNG, WEBP, dan PDF yang bisa dilampirkan.`);
      continue;
    }
    if(f.size > LAMPIRAN_MAKS_BYTE && f.type === 'application/pdf'){
      pesan(`"${f.name}" dilewati — PDF lebih dari 8 MB.`);
      continue;
    }
    try{
      const data = await siapkanBerkas(f);
      const perkiraan = Math.round((data.length - data.indexOf(',') - 1) * 0.75);
      if(perkiraan > LAMPIRAN_MAKS_BYTE){
        pesan(`"${f.name}" dilewati — masih lebih dari 8 MB setelah dikecilkan.`);
        continue;
      }
      daftar.push({ nama: f.name, data, ukuran: perkiraan });
    }catch(e){
      pesan(`"${f.name}" dilewati — ${e.message}`);
    }
  }
  renderLampiranPilihan(kotak);
}

function hapusLampiranPilihan(kotak, i){ kotakLampiran(kotak).splice(i, 1); renderLampiranPilihan(kotak); }

function renderLampiranPilihan(kotak){
  const wrap = document.getElementById(kotak + 'List');
  if(!wrap) return;
  wrap.innerHTML = kotakLampiran(kotak).map((f, i)=>`
    <div class="lampiran-item">
      <span>${f.data.startsWith('data:application/pdf') ? '📄' : '🖼'}</span>
      <span class="nama">${escapeHtml(f.nama)}</span>
      <span class="ukuran">${ukuranTeks(f.ukuran)}</span>
      <button class="icon-btn" title="Buang lampiran ini" onclick="hapusLampiranPilihan('${kotak}', ${i})">✕</button>
    </div>`).join('');
}

const kirimLampiran = kotak => kotakLampiran(kotak).map(f=>({ nama:f.nama, data:f.data }));

/** Galeri lampiran pada modal detail. Berkasnya sendiri tetap di balik login. */
function lampiranGaleriHtml(daftar){
  if(!daftar || daftar.length === 0) return '';
  const kartu = daftar.map(l=>{
    const gambar = String(l.Mime||'').startsWith('image/');
    const isi = gambar
      ? `<img src="${l.Path}" alt="${escapeHtml(l.Nama)}" loading="lazy">`
      : `<div class="berkas">📄</div>`;
    return `<a class="lampiran-kartu" href="${l.Path}" target="_blank" rel="noopener" title="${escapeHtml(l.Nama)} — ${ukuranTeks(l.Ukuran||0)}">
      ${isi}<span class="label">${escapeHtml(l.Nama)}</span></a>`;
  }).join('');
  return `
    <div style="font-family:var(--font-mono);font-size:10.5px;color:var(--muted);text-transform:uppercase;margin-top:16px;">Lampiran (${daftar.length})</div>
    <div class="lampiran-galeri">${kartu}</div>`;
}
function escapeHtml(s){ if(!s) return ''; return String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

/* ============== LAMPIRAN LEMBAR DAILY CHECK & PREVENTIVE ==============
   Dokumen pendukung yang ditempel ke lembar yang sudah tersimpan — dari jendela
   detailnya. Tiap jendela detail menyisipkan lampiranCatatanHtml(jenis, id);
   isinya diambil belakangan (getLampiranCatatan) supaya daftar lembar tidak
   perlu membawa lampirannya. jenis = 'dailycheck' | 'dstest' | 'berkala'.
   Menambah: siapa saja yang boleh menulis di unit itu. Membuang: pengunggahnya
   sendiri atau admin/admin unit. Server menjaga keduanya (suntingLampiranCatatan). */
const LC = { cache: {}, jenis: '', id: '', buang: [] };
const lcKunci = (jenis, id) => jenis + ':' + id;

function lampiranCatatanHtml(jenis, id){
  setTimeout(()=>muatLampiranCatatan(jenis, id), 0);
  return `<div class="lampiran-catatan" data-lc="${escapeHtml(lcKunci(jenis, id))}"
      style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line);">
    <b>📎 ${T('lcJudul')}</b>
    <div class="lc-isi"><div class="subtle-note">${T('lcMemuat')}</div></div>
  </div>`;
}

async function muatLampiranCatatan(jenis, id){
  let gagal = false;
  try{ LC.cache[lcKunci(jenis, id)] = await gsRun('getLampiranCatatan', jenis, id) || []; }
  catch(e){ gagal = true; }
  gambarLampiranCatatan(jenis, id, gagal);
}

function gambarLampiranCatatan(jenis, id, gagal){
  const kunci = lcKunci(jenis, id);
  const daftar = LC.cache[kunci] || [];
  const boleh = typeof bolehMenulis === 'function' && bolehMenulis();
  document.querySelectorAll('.lampiran-catatan').forEach(w=>{
    if(w.dataset.lc !== kunci) return;
    const isi = w.querySelector('.lc-isi');
    if(!isi) return;
    isi.innerHTML = (gagal ? `<div class="subtle-note">${T('lcGagal')}</div>`
        : daftar.length ? lampiranGaleriHtml(daftar)
        : `<div class="subtle-note">${T('bapbLampiranKosong')}</div>`)
      + (boleh && !gagal ? `<div style="margin-top:8px;"><button class="btn ghost" style="padding:6px 10px;"
          onclick="bukaLampiranCatatan('${jenis}','${id}')">${T('bapbKelolaLampiran')}</button></div>` : '');
  });
}

function gambarLcAda(){
  const wrap = document.getElementById('lcAda');
  if(!wrap) return;
  const daftar = LC.cache[lcKunci(LC.jenis, LC.id)] || [];
  if(!daftar.length){ wrap.innerHTML = `<div class="subtle-note">${T('bapbLampiranKosong')}</div>`; return; }
  const admin = typeof kelolaUnitAktif === 'function' && kelolaUnitAktif();
  const saya = (userSaatIni && userSaatIni.username) || '';
  wrap.innerHTML = daftar.map(l=>{
    const buang = LC.buang.includes(l.ID);
    const bolehBuang = admin || (saya && l.Oleh === saya);
    return `
    <div class="lampiran-item${buang ? ' dibuang' : ''}">
      <span>${String(l.Mime||'').startsWith('image/') ? '🖼' : '📄'}</span>
      <a class="nama" href="${l.Path}" target="_blank" rel="noopener" title="${escapeHtml(l.Nama)}">${escapeHtml(l.Nama)}</a>
      <span class="ukuran">${ukuranTeks(l.Ukuran||0)}</span>
      ${bolehBuang ? `<button class="icon-btn" title="${buang ? T('batalBuangLampiran') : T('buangLampiran')}"
        onclick="toggleBuangLc('${l.ID}')">${buang ? '↺' : '✕'}</button>` : ''}
    </div>`;
  }).join('');
}

function toggleBuangLc(id){
  LC.buang = LC.buang.includes(id) ? LC.buang.filter(x=>x !== id) : LC.buang.concat(id);
  gambarLcAda();
}

function bukaLampiranCatatan(jenis, id){
  LC.jenis = jenis; LC.id = id; LC.buang = [];
  resetLampiran('lcBaru');
  gambarLcAda();
  document.getElementById('lcBg').classList.add('show');
}

function tutupLampiranCatatan(){
  document.getElementById('lcBg').classList.remove('show');
  LC.buang = [];
  resetLampiran('lcBaru');
}

async function simpanLampiranCatatan(){
  if(!LC.jenis || !LC.id) return;
  const jenis = LC.jenis, id = LC.id;
  const tambah = kirimLampiran('lcBaru');
  const buang = LC.buang.slice();
  if(!tambah.length && !buang.length){ toast(T('bapbLampiranTakBerubah')); return; }
  const btn = document.getElementById('lcSaveBtn'); btn.disabled = true;
  if(tambah.length) toast(T('mengunggahLampiran'));
  try{
    LC.cache[lcKunci(jenis, id)] = await gsRun('suntingLampiranCatatan', jenis, id, tambah, buang) || [];
    tutupLampiranCatatan();
    gambarLampiranCatatan(jenis, id, false);
    toast(T('lcTersimpan'));
  }catch(e){
    toast(T('gagalSimpan') + ' — ' + (e.message || T('coba')));
  }
  btn.disabled = false;
}
