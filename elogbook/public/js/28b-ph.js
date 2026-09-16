/* E-Logbook · js/28b-ph.js — PH (pelaksana harian) milik pejabat sendiri
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh (setelah
   28-telegram.js karena panelnya menumpang di modal "TTD Saya" yang sama).

   Pejabat yang akan tidak di tempat mencari nama PH-nya — siapa pun kecuali
   pejabat non-operasional — dan mengisi PERIODE-nya: mulai dan sampai tanggal
   berapa. Lembar yang ditujukan ke pejabat tersebut dan BERTANGGAL KEGIATAN
   di dalam periode itu muncul juga di Kotak Masuk TTD milik PH,
   PH ikut menerima notifikasi Telegram "perlu tanda tangan", dan PH bisa
   menandatanganinya dari akunnya sendiri dengan TTD tersimpannya sendiri —
   tanpa meminjam login pejabat. Yang tercetak nama PH berikut keterangannya.
   Pejabat aslinya tetap menerima juga. Setelah tanggalnya lewat, pengalihan
   mati sendiri.

   Untuk yang bukan pejabat, panel ini hanya muncul kalau akunnya sedang
   menjadi PH bagi seseorang, sekadar memberi tahu. */

/** Keadaan terakhir dari server, supaya render tidak perlu memanggil ulang. */
let phInfo = { boleh: false, mewakili: [] };

const PERAN_CALON_PH = { teknisi: 'Teknisi', adminunit: 'Admin unit', pejabat: 'Pejabat', admin: 'Administrator' };

/** "16 Sep 2026 – 18 Sep 2026", atau "s.d. 18 Sep 2026" untuk penunjukan lama
    yang dibuat sebelum tanggal mulai ada. */
function periodePhTampil(mulai, sampai){
  return mulai
    ? `${tanggalPhTampil(mulai)} – ${tanggalPhTampil(sampai)}`
    : `s.d. ${tanggalPhTampil(sampai)}`;
}

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
  // Periodenya ikut disebut: yang masuk ke kotak masuk PH hanya lembar
  // bertanggal kegiatan di dalam periode itu, dan tanpa tahu periodenya PH
  // akan bertanya-tanya kenapa lembar tanggal lain milik pejabat yang sama
  // tidak ada.
  const mewakili = (phInfo.mewakili || [])
    .map(p => `<b>${escapeHtml(p.nama)}</b> (lembar tanggal ${escapeHtml(periodePhTampil(p.mulai, p.sampai))})`)
    .join(', ');
  const catatanMewakili = mewakili
    ? `<div class="subtle-note" style="margin-top:6px;">Anda sedang menjadi PH untuk: ${mewakili}. Dokumennya ada di Kotak Masuk TTD Anda.</div>`
    : '';

  if(!phInfo.boleh){
    status.innerHTML = catatanMewakili;
    aksi.innerHTML = '';
    return;
  }

  if(phInfo.aktif || phInfo.belumMulai){
    // Terjadwal: sudah tersimpan tapi periodenya belum mulai. Terbaca beda dari
    // "Aktif" supaya pejabatnya tidak mengira lembar hari ini sudah tertitip.
    const lencana = phInfo.aktif
      ? '<span class="tg-badge tg-on">Aktif</span>'
      : '<span class="tg-badge tg-off">Terjadwal</span>';
    status.innerHTML = `${lencana} PH: <b>${escapeHtml(phInfo.phNama || phInfo.phUsername)}</b>`
      + ` · lembar tanggal ${escapeHtml(periodePhTampil(phInfo.mulai, phInfo.sampai))}` + catatanMewakili;
    aksi.innerHTML = `<button class="btn ghost" onclick="akhiriPh()">${phInfo.aktif ? 'Akhiri sekarang' : 'Batalkan'}</button>`;
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
      <input type="text" id="phCari" list="phCalonDaftar" autocomplete="off" placeholder="Ketik nama…">
      <datalist id="phCalonDaftar">${opsi}</datalist></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;">
      <div class="field" style="flex:1;min-width:140px;"><label>Mulai tanggal</label>
        <input type="date" id="phMulai" value="${tanggalHariIni()}" min="${tanggalHariIni()}"></div>
      <div class="field" style="flex:1;min-width:140px;"><label>Sampai tanggal</label>
        <input type="date" id="phSampai" min="${tanggalHariIni()}"></div>
    </div>
    <div class="subtle-note" style="margin-top:4px;">Yang dititipkan ke PH hanya lembar yang <b>tanggal kegiatannya</b> di dalam periode ini. Lembar tanggal lain tetap menunggu Anda.</div>
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
  const mulai = document.getElementById('phMulai')?.value || '';
  const sampai = document.getElementById('phSampai')?.value || '';
  if(!pilih){ toast('Pilih nama PH dari daftar yang muncul saat mengetik.'); return; }
  if(!mulai){ toast('Isi tanggal mulai.'); return; }
  if(!sampai){ toast('Isi tanggal selesai.'); return; }
  if(mulai > sampai){ toast('Tanggal mulai tidak boleh sesudah tanggal selesai.'); return; }
  try{
    phInfo = await gsRun('phAtur', { phUsername: pilih.username, mulai, sampai });
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
