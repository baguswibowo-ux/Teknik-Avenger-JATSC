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
