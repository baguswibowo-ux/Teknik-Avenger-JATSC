/* E-Logbook · js/28b-ph.js — PH (pelaksana harian) milik pejabat sendiri
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh (setelah
   28-telegram.js karena panelnya menumpang di modal "TTD Saya" yang sama).

   Pejabat yang akan tidak di tempat mencari nama PH-nya — teknisi, admin unit,
   atau pejabat lain — dan mengisi sampai tanggal berapa. Selama itu, dokumen
   yang ditujukan ke pejabat tersebut juga muncul di Kotak Masuk TTD milik PH,
   PH ikut menerima notifikasi Telegram "perlu tanda tangan", dan PH bisa
   menandatanganinya dari akunnya sendiri dengan TTD tersimpannya sendiri —
   tanpa meminjam login pejabat. Yang tercetak nama PH berikut keterangannya.
   Pejabat aslinya tetap menerima juga. Setelah tanggalnya lewat, pengalihan
   mati sendiri.

   Untuk yang bukan pejabat, panel ini hanya muncul kalau akunnya sedang
   menjadi PH bagi seseorang, sekadar memberi tahu. */

/** Keadaan terakhir dari server, supaya render tidak perlu memanggil ulang. */
let phInfo = { boleh: false, mewakili: [] };

const PERAN_CALON_PH = { teknisi: 'Teknisi', adminunit: 'Admin unit', pejabat: 'Pejabat' };

/** Dipanggil saat modal "TTD Saya" dibuka (js/27-ttd-tersimpan.js). */
async function muatPh(){
  const panel = document.getElementById('phPanel');
  if(!panel) return;
  try{
    phInfo = await gsRun('phStatus') || { boleh:false, mewakili:[] };
  }catch(e){
    phInfo = { boleh:false, mewakili:[] };
  }
  const adaYangDiwakili = (phInfo.mewakili || []).length > 0;
  if(!phInfo.boleh && !adaYangDiwakili){
    panel.style.display = 'none';
    return;
  }
  panel.style.display = '';
  renderPh();
}

/** '2026-09-20' → '20 Sep 2026'. Tanggalnya UTC, sama dengan yang disimpan. */
function tanggalPhTampil(iso){
  const t = new Date(String(iso || '') + 'T00:00:00Z');
  if(isNaN(t)) return String(iso || '');
  return t.toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric', timeZone:'UTC' });
}

/** Teks satu pilihan di kolom cari: "Nama (username)". Username ikut supaya
    dua orang bernama sama tetap bisa dibedakan. */
const labelCalonPh = (c) => `${c.nama} (${c.username})`;

function renderPh(){
  const status = document.getElementById('phStatus');
  const aksi = document.getElementById('phAksi');
  if(!status || !aksi) return;

  // Kebalikannya juga ditampilkan: kalau akun ini sedang menjadi PH untuk
  // orang lain, pemiliknya perlu tahu kenapa kotak masuknya berisi dokumen
  // yang tidak ditujukan kepadanya.
  const mewakili = (phInfo.mewakili || []).map(p => escapeHtml(p.nama)).join(', ');
  const catatanMewakili = mewakili
    ? `<div class="subtle-note" style="margin-top:6px;">Anda sedang menjadi PH untuk: <b>${mewakili}</b>. Dokumennya ada di Kotak Masuk TTD Anda.</div>`
    : '';

  if(!phInfo.boleh){
    status.innerHTML = catatanMewakili;
    aksi.innerHTML = '';
    return;
  }

  if(phInfo.aktif){
    status.innerHTML = `<span class="tg-badge tg-on">Aktif</span> PH: <b>${escapeHtml(phInfo.phNama || phInfo.phUsername)}</b>`
      + ` sampai ${escapeHtml(tanggalPhTampil(phInfo.sampai))}` + catatanMewakili;
    aksi.innerHTML = '<button class="btn ghost" onclick="akhiriPh()">Akhiri sekarang</button>';
    return;
  }

  const calon = Array.isArray(phInfo.calon) ? phInfo.calon : [];
  status.innerHTML = '<span class="tg-badge tg-off">Tidak ada PH</span>' + catatanMewakili;
  if(!calon.length){
    aksi.innerHTML = '<div class="subtle-note">Belum ada akun lain yang bisa ditunjuk.</div>';
    return;
  }
  const opsi = calon.map(c =>
    `<option value="${escapeHtml(labelCalonPh(c))}">${escapeHtml(PERAN_CALON_PH[c.role] || c.role)}</option>`).join('');
  aksi.innerHTML = `
    <div class="field"><label>Cari nama PH</label>
      <input type="text" id="phCari" list="phCalonDaftar" autocomplete="off" placeholder="Ketik nama teknisi atau pejabat…">
      <datalist id="phCalonDaftar">${opsi}</datalist></div>
    <div class="field" style="margin-top:6px;"><label>Sampai tanggal</label>
      <input type="date" id="phSampai" min="${tanggalHariIni()}"></div>
    <button class="btn" style="margin-top:8px;" onclick="simpanPh()">Simpan PH</button>`;
}

/** Cocokkan isian kolom cari dengan satu calon: persis label pilihannya,
    "(username)" di ujungnya, atau nama yang hanya dimiliki satu orang. */
function calonPhDariIsian(isian){
  const calon = Array.isArray(phInfo.calon) ? phInfo.calon : [];
  const t = String(isian || '').trim();
  if(!t) return null;
  const persis = calon.find(c => labelCalonPh(c) === t);
  if(persis) return persis;
  const m = t.match(/\(([^()]+)\)\s*$/);
  if(m){
    const u = calon.find(c => c.username.toLowerCase() === m[1].trim().toLowerCase());
    if(u) return u;
  }
  const senama = calon.filter(c => c.nama.toLowerCase() === t.toLowerCase());
  return senama.length === 1 ? senama[0] : null;
}

async function simpanPh(){
  const pilih = calonPhDariIsian(document.getElementById('phCari')?.value);
  const sampai = document.getElementById('phSampai')?.value || '';
  if(!pilih){ toast('Pilih nama PH dari daftar yang muncul saat mengetik.'); return; }
  if(!sampai){ toast('Isi tanggal selesai.'); return; }
  try{
    phInfo = await gsRun('phAtur', { phUsername: pilih.username, sampai });
    toast('PH disimpan.');
  }catch(e){
    toast(e?.message || 'Gagal menyimpan PH.');
  }
  renderPh();
}

async function akhiriPh(){
  try{
    phInfo = await gsRun('phHapus');
    toast('PH diakhiri.');
  }catch(e){
    toast(e?.message || 'Gagal mengakhiri PH.');
  }
  renderPh();
}
