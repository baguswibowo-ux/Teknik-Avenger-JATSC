/* E-Logbook · js/28b-ph.js — PH (pelaksana harian) milik pejabat sendiri
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh (setelah
   28-telegram.js karena panelnya menumpang di modal "TTD Saya" yang sama).

   Pejabat yang akan tidak di tempat menunjuk PH-nya dan sampai tanggal berapa.
   Selama itu, dokumen yang ditujukan ke pejabat tersebut juga muncul di Kotak
   Masuk TTD milik PH dan PH ikut menerima notifikasi Telegram "perlu tanda
   tangan". Pejabat aslinya tetap menerima juga. Setelah tanggalnya lewat,
   pengalihan mati sendiri — tidak ada yang perlu diingat untuk dimatikan.

   Panel ini menyembunyikan dirinya untuk peran yang tidak bisa menandatangani
   (server menjawab boleh:false), sama seperti panel Notifikasi Telegram. */

/** Keadaan terakhir dari server, supaya render tidak perlu memanggil ulang. */
let phInfo = { boleh: false };

/** Dipanggil saat modal "TTD Saya" dibuka (js/27-ttd-tersimpan.js). */
async function muatPh(){
  const panel = document.getElementById('phPanel');
  if(!panel) return;
  try{
    phInfo = await gsRun('phStatus') || { boleh:false };
  }catch(e){
    phInfo = { boleh:false };
  }
  if(!phInfo.boleh){
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

function renderPh(){
  const status = document.getElementById('phStatus');
  const aksi = document.getElementById('phAksi');
  if(!status || !aksi) return;

  // Kebalikannya juga ditampilkan: kalau akun ini sedang menjadi PH untuk
  // orang lain, pemiliknya perlu tahu kenapa kotak masuknya berisi dokumen
  // yang tidak ditujukan kepadanya.
  const mewakili = (phInfo.mewakili || []).map(p => escapeHtml(p.nama)).join(', ');
  const catatanMewakili = mewakili
    ? `<div class="subtle-note" style="margin-top:6px;">Anda sedang menjadi PH untuk: <b>${mewakili}</b>.</div>`
    : '';

  if(phInfo.aktif){
    status.innerHTML = `<span class="tg-badge tg-on">Aktif</span> PH: <b>${escapeHtml(phInfo.phNama || phInfo.phUsername)}</b>`
      + ` sampai ${escapeHtml(tanggalPhTampil(phInfo.sampai))}` + catatanMewakili;
    aksi.innerHTML = '<button class="btn ghost" onclick="akhiriPh()">Akhiri sekarang</button>';
    return;
  }

  const saya = String(userSaatIni?.username || '').toLowerCase();
  const pilihan = (typeof pejabatList !== 'undefined' && Array.isArray(pejabatList) ? pejabatList : [])
    .filter(p => String(p.username || '').toLowerCase() !== saya)
    .map(p => `<option value="${escapeHtml(p.username)}">${escapeHtml(p.nama || p.username)}</option>`)
    .join('');

  status.innerHTML = '<span class="tg-badge tg-off">Tidak ada PH</span>' + catatanMewakili;
  if(!pilihan){
    aksi.innerHTML = '<div class="subtle-note">Belum ada akun pejabat lain yang bisa ditunjuk.</div>';
    return;
  }
  aksi.innerHTML = `
    <div class="field"><label>PH</label>
      <select id="phPilih"><option value="">— pilih pejabat —</option>${pilihan}</select></div>
    <div class="field" style="margin-top:6px;"><label>Sampai tanggal</label>
      <input type="date" id="phSampai" min="${tanggalHariIni()}"></div>
    <button class="btn" style="margin-top:8px;" onclick="simpanPh()">Simpan PH</button>`;
}

async function simpanPh(){
  const phUsername = document.getElementById('phPilih')?.value || '';
  const sampai = document.getElementById('phSampai')?.value || '';
  if(!phUsername){ toast('Pilih dulu siapa PH-nya.'); return; }
  if(!sampai){ toast('Isi tanggal selesai.'); return; }
  try{
    phInfo = await gsRun('phAtur', { phUsername, sampai });
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
