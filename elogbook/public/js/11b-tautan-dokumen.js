/* E-Logbook · js/11b-tautan-dokumen.js — Rujukan dokumen pada catatan logbook
   Dimuat sesudah 11-logbook.js: jendela catatan yang memakainya ada di sana.

   ============== TAUTAN DOKUMEN ==============

   Satu catatan logbook sering lahir dari lembar lain — BAPB penggantian
   barang, LTK perbaikan, atau lembar pekerjaan berkala. Sebelum ini, satu-
   satunya cara menyebutkannya adalah menulis "lihat BAPB kemarin" di dalam
   uraian: tidak bisa diklik, dan hilang pada suntingan pertama yang tidak
   hati-hati.

   Yang disimpan cuma rujukannya. Isi dokumen TIDAK disalin ke uraian —
   uraian tetap kalimat teknisi sendiri, dan menyalin isi cuma melahirkan dua
   versi keterangan yang lama-lama berbeda.

   LABEL DAN TANGGAL DIBEKUKAN saat menautkan, tidak dibaca ulang dari daftar
   tiap kali digambar. Layar hanya memuat 200 baris terakhir per jenis, jadi
   dokumen yang lebih tua sudah tidak ada di memori — chip yang labelnya
   dibaca dari daftar akan tampil kosong justru pada catatan yang paling lama.
   Lihat juga tautan-dokumen.js di sisi server, yang menyimpannya.

   MENAMBAH JENIS SUMBER (DS Test, lembar preventive unit lain) cukup satu
   entri di TAUTAN_SUMBER di bawah, plus satu baris di SUMBER pada
   tautan-dokumen.js. Syaratnya cuma dua: jenisnya dikenal TTD_BUKA_ULANG di
   20-ttd-pejabat.js (itu yang membuka dokumennya waktu chip diklik), dan
   daftarnya sudah ada di memori layar. */

const TAUTAN_SUMBER = {
  ltk: {
    ikon: '🔧',
    label: () => T('tautanJenisLtk'),
    daftar: () => (typeof ltkList !== 'undefined' ? ltkList : []),
    // Peralatan + modul: itu yang dicari orang waktu menengok LTK lama.
    judul: (l) => [l.peralatan, l.modul].filter(Boolean).join(' — '),
    tanggal: (l) => l.tanggalLapor || ''
  },
  bapb: {
    ikon: '📦',
    label: () => T('tautanJenisBapb'),
    daftar: () => (typeof bapbList !== 'undefined' ? bapbList : []),
    // Nomor BA dipakai kalau pekerjaannya tidak diisi — satu di antaranya
    // hampir selalu ada, dan chip tanpa judul tidak menerangkan apa pun.
    judul: (b) => b.untukPekerjaan || (b.nomor ? 'No. ' + b.nomor : ''),
    tanggal: (b) => b.tanggal || ''
  },
  berkala: {
    ikon: '🗓',
    label: () => T('tautanJenisBerkala'),
    daftar: () => (typeof berkalaList !== 'undefined' ? berkalaList : []),
    judul: (b) => (typeof berkalaLabelJenis === 'function' ? berkalaLabelJenis(b.jenis) : (b.jenis || '')),
    tanggal: (b) => b.tanggal || ''
  }
};

const tautanJenisUrut = () => Object.keys(TAUTAN_SUMBER);
const tautanSumberSah = (jenis) => Object.prototype.hasOwnProperty.call(TAUTAN_SUMBER, String(jenis || ''));

/** Bentuk satu tautan dari dokumen yang sedang dipegang di memori. */
function tautanDariDokumen(jenis, dok){
  const cfg = TAUTAN_SUMBER[jenis];
  return {
    jenis,
    id: dok.id,
    unit: dok.unit || unitAktif || '',
    label: String(cfg.judul(dok) || '').slice(0, 120),
    tanggal: String(cfg.tanggal(dok) || '').slice(0, 10)
  };
}

/* ---------- Chip di kartu, jendela detail, dan kedua form ---------- */

/** Tanggal chip: ringkas (12 Sep) supaya chip tidak lebih lebar dari isinya.
    Yang tidak berbentuk ISO ditampilkan apa adanya — data lama kadang begitu. */
function tautanTanggalRingkas(iso){
  const t = String(iso || '').slice(0, 10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const d = new Date(t + 'T00:00:00Z');
  if(isNaN(d)) return t;
  // Nama bulan dari Intl, bukan daftar yang ditanam di sini: layarnya punya
  // tiga bahasa, dan daftar yang ditanam berarti tiga daftar yang harus ikut
  // diubah setiap kali bahasa berikutnya ditambahkan.
  try{ return d.toLocaleDateString(bahasa || 'id', { day:'numeric', month:'short', timeZone:'UTC' }); }
  catch(e){ return t; }
}

function chipTautanHtml(t, i, lepasHandler){
  const cfg = TAUTAN_SUMBER[t.jenis];
  const jenisLabel = cfg ? cfg.label() : t.jenis;
  const ikon = cfg ? cfg.ikon : '📄';
  const ekor = [escapeHtml(t.label), tautanTanggalRingkas(t.tanggal)].filter(Boolean).join(' · ');
  // Chip yang bisa dilepas (di dalam form) tidak sekaligus bisa dibuka:
  // satu kotak kecil dengan dua perbuatan berbeda terlalu gampang salah tekan,
  // dan yang salah tekan di sini berarti kehilangan tautan yang baru dipasang.
  const buka = lepasHandler ? '' : ` onclick="bukaTautanDokumen('${t.jenis}','${escapeHtml(t.unit||'')}','${t.id}')" title="${T('bukaDokumenIni')}"`;
  return `<span class="tautan-chip${lepasHandler ? '' : ' bisa-buka'}"${buka}>
    <span class="tautan-chip-ikon">${ikon}</span>
    <b>${escapeHtml(jenisLabel)}</b>${ekor ? ' · ' + ekor : ''}
    ${lepasHandler ? `<button type="button" class="tautan-chip-lepas" title="${T('lepasTautan')}" onclick="event.stopPropagation();${lepasHandler}(${i})">✕</button>` : ''}
  </span>`;
}

/** Deretan chip untuk kartu dan jendela detail — tanpa tombol lepas. */
function tautanChipsHtml(daftar){
  const arr = Array.isArray(daftar) ? daftar : [];
  if(!arr.length) return '';
  return `<div class="tautan-baris">${arr.map((t,i)=>chipTautanHtml(t,i,'')).join('')}</div>`;
}

/**
 * Buka dokumen yang ditunjuk sebuah chip.
 *
 * Seluruh pekerjaannya sudah dikerjakan bukaInboxItem di 20-ttd-pejabat.js —
 * pindah unit kalau perlu, buka tab dan sub-tabnya, lalu buka jendela
 * detailnya; dokumen yang sudah terlalu lama untuk ikut termuat di layar
 * diambil sendiri dari server. Menyalin logika itu ke sini berarti dua jalur
 * yang harus diperbaiki dua kali setiap ada tab baru.
 */
function bukaTautanDokumen(jenis, unit, id){
  if(!tautanSumberSah(jenis)) return;
  if(typeof bukaInboxItem !== 'function'){ toast(T('dokumenGagalDibuka')); return; }
  if(typeof closeEntryDetail === 'function') closeEntryDetail();
  bukaInboxItem(jenis, unit || unitAktif || '', id);
}

/* ---------- Daftar tautan yang sedang disusun di form ----------
   Dua form memakai pemilih yang sama: jendela tambah catatan dan jendela
   sunting. Sasarannya disimpan supaya pemilihnya tahu daftar mana yang
   sedang diubah. */

let tautanBaru = [];       // form tambah catatan
let tautanSunting = [];    // form sunting catatan
let tautanSasaran = 'baru';

const tautanDaftar = (sasaran) => (sasaran === 'sunting' ? tautanSunting : tautanBaru);
const setTautanDaftar = (sasaran, arr) => { if(sasaran === 'sunting') tautanSunting = arr; else tautanBaru = arr; };

const tautanWadahId = (sasaran) => (sasaran === 'sunting' ? 'feeTautanList' : 'feTautanList');

function renderTautanForm(sasaran){
  const wrap = document.getElementById(tautanWadahId(sasaran));
  if(!wrap) return;
  const arr = tautanDaftar(sasaran);
  const lepas = sasaran === 'sunting' ? 'lepasTautanSunting' : 'lepasTautanBaru';
  wrap.innerHTML = arr.length
    ? arr.map((t,i)=>chipTautanHtml(t,i,lepas)).join('')
    : `<span class="tautan-kosong">${T('belumAdaTautan')}</span>`;
}

function lepasTautanBaru(i){ tautanBaru.splice(i,1); renderTautanForm('baru'); }
function lepasTautanSunting(i){ tautanSunting.splice(i,1); renderTautanForm('sunting'); }

/** Dipanggil openEntryModal / openEntryEditModal saat jendelanya disiapkan. */
function resetTautanForm(sasaran, awal){
  setTautanDaftar(sasaran, Array.isArray(awal) ? awal.map(t=>({...t})) : []);
  renderTautanForm(sasaran);
}

/* ---------- Jendela pemilih dokumen ---------- */

let tautanPilihJenis = 'ltk';

function openTautanPilih(sasaran){
  tautanSasaran = sasaran;
  // Jenis yang dibuka terakhir dipertahankan selama halaman belum dimuat
  // ulang: teknisi yang menautkan beberapa BAPB berturut-turut tidak perlu
  // menekan tombol jenisnya tiap kali.
  if(!tautanSumberSah(tautanPilihJenis)) tautanPilihJenis = tautanJenisUrut()[0];
  const cari = document.getElementById('tautanCari');
  if(cari) cari.value = '';
  renderTautanJenisBtn();
  renderTautanPilih();
  document.getElementById('tautanPilihBg').classList.add('show');
  setTimeout(()=>{ const c = document.getElementById('tautanCari'); if(c) c.focus(); }, 60);
}

function closeTautanPilih(){ document.getElementById('tautanPilihBg').classList.remove('show'); }

function renderTautanJenisBtn(){
  const wrap = document.getElementById('tautanJenisBtn');
  if(!wrap) return;
  wrap.innerHTML = tautanJenisUrut().map(j=>{
    const cfg = TAUTAN_SUMBER[j];
    const aktif = j === tautanPilihJenis ? ' active' : '';
    return `<button type="button" class="tautan-jenis-btn${aktif}" onclick="setTautanPilihJenis('${j}')">${cfg.ikon} ${escapeHtml(cfg.label())}</button>`;
  }).join('');
}

function setTautanPilihJenis(jenis){
  if(!tautanSumberSah(jenis)) return;
  tautanPilihJenis = jenis;
  renderTautanJenisBtn();
  renderTautanPilih();
}

const sudahDitautkan = (jenis, id) => tautanDaftar(tautanSasaran).some(t=>t.jenis===jenis && t.id===id);

function renderTautanPilih(){
  const wrap = document.getElementById('tautanPilihList');
  if(!wrap) return;
  const jenis = tautanPilihJenis;
  const cfg = TAUTAN_SUMBER[jenis];
  const kata = String((document.getElementById('tautanCari')||{}).value || '').trim().toLowerCase();
  const semua = cfg.daftar();
  const hasil = semua.filter(d=>{
    if(!kata) return true;
    const ladang = [cfg.judul(d), cfg.tanggal(d)].join(' ').toLowerCase();
    // Semua kata harus ada, urutannya bebas — pola yang sama dengan saringLtk.
    return kata.split(/\s+/).every(k=>ladang.includes(k));
  });

  if(!semua.length){ wrap.innerHTML = `<div class="empty">${T('tautanBelumAdaDokumen')}</div>`; return; }
  if(!hasil.length){ wrap.innerHTML = `<div class="empty">${T('takAdaHasil')}</div>`; return; }

  wrap.innerHTML = hasil.slice(0, 100).map(d=>{
    const pilih = sudahDitautkan(jenis, d.id);
    const judul = cfg.judul(d) || '-';
    return `<div class="tautan-pilih-item${pilih ? ' terpilih' : ''}" onclick="toggleTautanPilih('${d.id}')">
      <span class="tautan-pilih-tanda">${pilih ? '✓' : '+'}</span>
      <div class="tautan-pilih-teks">
        <div><b>${escapeHtml(judul)}</b></div>
        <div class="tautan-pilih-tanggal">${escapeHtml(cfg.tanggal(d)) || '-'}</div>
      </div>
    </div>`;
  }).join('');
}

function toggleTautanPilih(id){
  const jenis = tautanPilihJenis;
  const arr = tautanDaftar(tautanSasaran);
  const i = arr.findIndex(t=>t.jenis===jenis && t.id===id);
  if(i >= 0){
    arr.splice(i,1);
  } else {
    if(arr.length >= batasTautan){ toast(T('tautanPenuh').replace('{n}', batasTautan)); return; }
    const dok = TAUTAN_SUMBER[jenis].daftar().find(d=>d.id===id);
    if(!dok) return;
    arr.push(tautanDariDokumen(jenis, dok));
  }
  renderTautanPilih();
  renderTautanForm(tautanSasaran);
}

/* ---------- Dari dokumen ke catatan baru ----------
   Arah kebalikannya: teknisi sedang membuka BAPB/LTK/berkala dan ingin
   mencatatnya di logbook. Jendela catatan dibuka seperti biasa — kosong,
   uraiannya tetap dia yang menulis — cuma tautannya sudah terpasang. */

function mulaiCatatanDariDokumen(jenis, id){
  if(!tautanSumberSah(jenis)) return;
  if(typeof bolehMenulis === 'function' && !bolehMenulis()){ toast(T('takBolehTulis')); return; }
  const dok = TAUTAN_SUMBER[jenis].daftar().find(d=>d.id===id);
  if(!dok){ toast(T('dokumenGagalDibuka')); return; }

  // Tutup jendela detail yang sedang terbuka — yang dipakai LTK, BAPB, dan
  // berkala sama-sama formDetailBg.
  const detail = document.getElementById('formDetailBg');
  if(detail) detail.classList.remove('show');
  if(typeof lepasTitipan === 'function') lepasTitipan();

  // Pindah ke tab Logbook dulu, supaya begitu tersimpan catatannya langsung
  // terlihat di daftar — bukan tersembunyi di balik tab dokumennya.
  const tabLog = document.querySelector('.tab-btn[data-tab="logbook"]');
  if(tabLog && !tabLog.classList.contains('active')) tabLog.click();

  openEntryModal();
  resetTautanForm('baru', [tautanDariDokumen(jenis, dok)]);
  const info = document.getElementById('feDariDokumen');
  if(info){
    info.textContent = T('catatanDariDokumenKet');
    info.style.display = '';
  }
  setTimeout(()=>{ const u = document.getElementById('feUraian'); if(u) u.focus(); }, 60);
}

/**
 * Tombol "Buat catatan logbook" di jendela detail LTK/BAPB/berkala. Dipasang
 * oleh masing-masing pembuka detail, karena hanya di sana jenis dan id-nya
 * diketahui.
 *
 * Penampakannya diatur lewat CLASS, bukan style.display. Jendela detail ini
 * dipakai bersama sepuluh lembar lain yang bukan sumber tautan, dan
 * lepasTitipan() mengembalikan tombol-tombol yang disembunyikannya dengan
 * MENGOSONGKAN style inline — tombol yang mengandalkan inline akan menyala
 * kembali di lembar berikutnya, lengkap dengan handler dokumen sebelumnya.
 * Class 'siap' tidak bisa dihidupkan dari sana; yang mencabutnya cuma
 * closeFormDetail.
 */
function pasangTombolCatatanDariDokumen(jenis, id){
  const btn = document.getElementById('formDetailLogbookBtn');
  if(!btn) return;
  btn.classList.add('siap');
  btn.onclick = () => mulaiCatatanDariDokumen(jenis, id);
}

/* ---------- Cetak ----------
   Di kertas tautan tidak bisa diklik, jadi yang tercetak teks rujukannya.
   Dipakai 22-cetak-logbook.js. */
function tautanTeksRujukan(daftar){
  const arr = Array.isArray(daftar) ? daftar : [];
  if(!arr.length) return '';
  return arr.map(t=>{
    const cfg = TAUTAN_SUMBER[t.jenis];
    const jenisLabel = cfg ? cfg.label() : t.jenis;
    return [jenisLabel, t.tanggal, t.label].filter(Boolean).join(' ');
  }).join('; ');
}
