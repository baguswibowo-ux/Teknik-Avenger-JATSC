/* E-Logbook · js/21-cetak-dasar.js — Kop cetak per unit, TTD jadi tinta hitam, pratinjau, orientasi kertas
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh. */

/* ============== MODUL CETAK (mengikuti format form asli) ============== */

// Pembagian tabel sesuai form asli: tabel 1 = CWP & SCU, tabel 2 = perangkat pendukung
const TBL1_LEFT  = dcLeftItems.slice(0, dcLeftItems.indexOf('TMCS 1'));
const TBL2_LEFT  = dcLeftItems.slice(dcLeftItems.indexOf('TMCS 1'));
const TBL1_RIGHT = dcRightItems.slice(0, dcRightItems.indexOf('SW 3'));
const TBL2_RIGHT = dcRightItems.slice(dcRightItems.indexOf('SW 3'));

/**
 * Kop cetak mengikuti unit yang sedang dibuka — tiap unit punya form bakunya
 * sendiri.
 *
 * `lokasi` mengisi gedung pada baris Penyelenggara Pelayanan. Formulir selain
 * logbook belum mencatat gedung, jadi bawaannya tetap New JATSC seperti
 * sebelumnya. Cetakan logbook yang isinya dari dua gedung sekaligus mengirim
 * string kosong: gedungnya tidak disebut di kop, melainkan per baris.
 */
function kopCetak(lokasi = 'New JATSC'){
  const u = infoUnit();
  const judul = u?.pakaiFrek
    ? 'BUKU CATATAN FASILITAS DAN KEGIATAN (FACILITY LOG BOOK)'
    : 'BUKU CATATAN FASILITAS (FACILITY LOG BOOK)';
  const gedung = lokasi ? ' — ' + escapeHtml(lokasi) : '';
  return `
  <div style="text-align:center;font-weight:bold;font-size:13pt;margin-bottom:8px;">
    ${judul}
  </div>
  <table class="no-border" style="font-size:9pt;margin-bottom:8px;">
    <tr><td style="width:170px;">Penyelenggara Pelayanan</td><td>: JATSC Bandara Soekarno-Hatta${gedung}</td></tr>
    <tr><td>Kelompok Fasilitas</td><td>: ${escapeHtml(u?.kelompok || 'Fasilitas Komunikasi Penerbangan (Radkom & Radtel)')}</td></tr>
    <tr><td>Nama Peralatan</td><td>: ${escapeHtml(u?.peralatan || 'Radio Komunikasi, VSCS Garex, Recording Neptuno')}</td></tr>
  </table>`;
}

function setPageOrientation(mode){
  document.getElementById('pageStyle').textContent =
    `@media print{ @page{ size:A4 ${mode}; margin:10mm; } }`;
}

/** Ubah goresan TTD putih menjadi hitam (untuk cetak di kertas putih). */
function ttdToBlack(dataUrl){
  return new Promise(resolve=>{
    if(!dataUrl){ resolve(''); return; }
    const img = new Image();
    img.onload = ()=>{
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      try{
        const d = ctx.getImageData(0,0,c.width,c.height);
        const p = d.data;
        // Goresan tangan selalu punya latar tembus pandang. Gambar yang buram
        // seluruhnya berarti stempel siap cetak — mis. TTD QR yang sudah hitam
        // di atas putih. Membalikkannya justru membuatnya jadi kotak hitam pekat.
        let adaTembusPandang = false;
        for(let i=3;i<p.length;i+=4){ if(p[i] < 255){ adaTembusPandang = true; break; } }
        if(!adaTembusPandang){ resolve(dataUrl); return; }
        for(let i=0;i<p.length;i+=4){
          if(p[i+3] > 0){ p[i]=0; p[i+1]=0; p[i+2]=0; } // piksel bergaris -> hitam
        }
        ctx.putImageData(d, 0, 0);
        resolve(c.toDataURL('image/png'));
      }catch(e){ resolve(dataUrl); } // kalau gagal, pakai apa adanya
    };
    img.onerror = ()=> resolve(dataUrl);
    img.src = dataUrl;
  });
}

function ttdImg(url, h, align){
  if(!url) return '';
  const margin = align === 'left' ? '0' : 'auto';
  return `<img class="ttd-print" src="${url}" style="height:${h || 34}px;display:block;margin:${margin};">`;
}

/* ---------- PRATINJAU: hasil yang sama, tapi di layar ----------
   Kadang yang dibutuhkan hanya melihat rekap satu hari, bukan mencetaknya.
   Isi dan tata letaknya persis sama dengan hasil cetak, hanya tidak memanggil
   dialog cetak — jadi apa yang dilihat memang apa yang akan keluar di kertas. */
let modePratinjau = false;

function tutupPratinjau(){
  const area = document.getElementById('printArea');
  // Dipanggil juga saat pindah tab dan pindah unit, jadi harus aman kalau tidak
  // ada pratinjau — tanpa penjaga ini isi yang sedang disiapkan untuk dicetak
  // ikut terhapus.
  if(!area || !area.classList.contains('preview')) return false;
  area.classList.remove('preview');
  area.innerHTML = '';
  modePratinjau = false;
  return true;   // memberitahu pemanggil bahwa memang ada yang ditutup
}

async function tampilkanPratinjau(html){
  modePratinjau = true;
  const area = document.getElementById('printArea');
  area.innerHTML = `
    <div class="pratinjau-bar">
      <span>${T('pratinjauJudul')}</span>
      <button class="btn ghost" onclick="tutupPratinjau()">${T('tutupPratinjau')}</button>
    </div>
    <div id="pratinjauIsi">${html}</div>`;
  area.classList.add('preview');

  // TTD putih tidak terbaca di atas kertas putih — ubah jadi hitam seperti saat cetak.
  const ttds = Array.from(area.querySelectorAll('img.ttd-print'));
  await Promise.all(ttds.map(async img=>{
    if(img.getAttribute('src')) img.src = await ttdToBlack(img.getAttribute('src'));
  }));
  area.scrollIntoView({ behavior:'smooth', block:'start' });
}

async function doPrint(html, orientation){
  if(modePratinjau){ await tampilkanPratinjau(html); return; }
  // Pilihan pemakai menang atas bentuk bawaan formulir.
  if(orientasiCetak !== 'auto') orientation = orientasiCetak;
  setPageOrientation(orientation);
  const area = document.getElementById('printArea');
  area.innerHTML = html;
  // ubah semua TTD putih menjadi hitam agar terbaca di kertas putih
  const ttds = Array.from(area.querySelectorAll('img.ttd-print'));
  await Promise.all(ttds.map(async img=>{
    if(img.getAttribute('src')) img.src = await ttdToBlack(img.getAttribute('src'));
  }));
  // pastikan gambar hasil konversi termuat
  const imgs = Array.from(area.querySelectorAll('img'));
  const waits = imgs.map(img => img.complete ? Promise.resolve() :
    new Promise(res => { img.onload = res; img.onerror = res; setTimeout(res, 2500); }));
  await Promise.all(waits);
  setTimeout(()=> window.print(), 150);
}
