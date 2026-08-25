/* E-Logbook · js/22-cetak-logbook.js — Cetak logbook: per rentang tanggal maupun satu catatan
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh. */

/* ---------- CETAK LOGBOOK ---------- */

/**
 * Satu baris tabel cetak. Dipakai cetak per rentang tanggal maupun cetak satu
 * catatan. Kolom lokasi hanya ikut kalau cetakannya memang bercampur dua gedung
 * — kalau seluruhnya satu gedung, gedungnya sudah tertulis di kop.
 */
function entryPrintRow(e, i, pakaiKolomLokasi){
  const namaList = teknisiListOf(e);
  // Nama hanya ikut tercetak kalau tanda tangannya sudah dibubuhkan. Bagian yang
  // belum ditandatangani sengaja dikosongkan: form fisik tidak boleh membawa
  // nama seolah-olah orangnya sudah paraf, padahal petak TTD-nya kosong.
  const tekCell = e.teknisiTtd
    ? (namaList.length ? namaList.map((n,k)=>`${k+1}. ${escapeHtml(n)}`).join('<br>') : escapeHtml(e.teknisiNama))
    : '';
  const pjCell = e.pjTtd ? escapeHtml(e.pjNama) : '';
  return `
    <tr>
      <td style="text-align:center;width:28px;">${i+1}</td>
      <td style="width:95px;font-size:8.5pt;">${escapeHtml(e.tanggal)}<br>${escapeHtml(jamTeks(e))} UTC</td>
      <td style="width:50px;font-size:8.5pt;text-align:center;">${escapeHtml(e.dinas || '-')}</td>
      ${pakaiKolomLokasi ? `<td style="width:62px;font-size:8pt;text-align:center;">${escapeHtml(e.lokasi || '-')}</td>` : ''}
      ${infoUnit()?.pakaiFrek ? `<td style="width:62px;font-size:8pt;text-align:center;">${escapeHtml(e.frek || '-')}</td>` : ''}
      <td style="font-size:9pt;">${escapeHtml(e.uraian).replace(/\n/g,'<br>')}</td>
      <td style="width:85px;font-size:8.5pt;">${tekCell}</td>
      <td style="width:80px;">${ttdImg(e.teknisiTtd)}</td>
      <td style="width:85px;font-size:8.5pt;text-align:center;">${pjCell}</td>
      <td style="width:80px;">${ttdImg(e.pjTtd)}</td>
    </tr>`;
}

/**
 * Halaman lampiran untuk cetak. Gambar ditempel langsung; PDF tidak bisa
 * dirender di dalam halaman cetak, jadi didaftar namanya supaya tetap terlacak.
 */
function lampiranPrintHtml(daftar, judul){
  if(!daftar || daftar.length === 0) return '';
  const gambar = daftar.filter(l=>String(l.Mime||'').startsWith('image/'));
  const berkas = daftar.filter(l=>!String(l.Mime||'').startsWith('image/'));

  const petak = gambar.map(l=>`
    <td style="width:50%;vertical-align:top;padding:4px;border:none;">
      <img src="${l.Path}" style="width:100%;max-height:330px;object-fit:contain;border:1px solid #999;">
      <div style="font-size:7.5pt;text-align:center;margin-top:2px;">${escapeHtml(l.Nama)}</div>
    </td>`);
  let baris = '';
  for(let i=0;i<petak.length;i+=2){
    baris += `<tr>${petak[i]}${petak[i+1] || '<td style="border:none;"></td>'}</tr>`;
  }

  const daftarBerkas = berkas.length ? `
    <div style="font-size:8.5pt;margin-top:6px;">
      Dokumen terlampir (tidak ikut tercetak, tersimpan di server):
      ${berkas.map(l=>escapeHtml(l.Nama)).join('; ')}
    </div>` : '';

  return `
    <div style="font-size:9pt;font-weight:bold;margin:8px 0 4px;">${judul}</div>
    ${baris ? `<table class="no-border" style="width:100%;">${baris}</table>` : ''}
    ${daftarBerkas}`;
}

function printEntryList(list, subjudul){
  // Lampiran dipindah ke halaman sendiri supaya tabel logbook tetap sama persis
  // dengan bentuk form fisiknya.
  const denganLampiran = list.filter(e=>e.lampiran && e.lampiran.length);
  const halamanLampiran = denganLampiran.length ? `
    <div style="page-break-before:always;">
      <div style="text-align:center;font-weight:bold;font-size:12pt;margin-bottom:10px;">
        LAMPIRAN BUKU CATATAN FASILITAS
      </div>
      ${denganLampiran.map(e=>`
        <div style="margin-bottom:14px;">
          ${lampiranPrintHtml(e.lampiran,
            `${escapeHtml(e.tanggal)} &middot; ${escapeHtml(e.jam)} UTC${e.dinas ? ' &middot; ' + T('dinasSingkat') + ' ' + escapeHtml(e.dinas) : ''}${e.lokasi ? ' &middot; ' + escapeHtml(e.lokasi) : ''}`)}
        </div>`).join('')}
    </div>` : '';

  // Judul kolom mengikuti form baku unitnya masing-masing.
  const u = infoUnit();
  const kolJam = u?.pakaiJamSelesai ? 'TANGGAL/<br>JAM MULAI–SELESAI' : 'TANGGAL/<br>JAM';
  const kolFrek = u?.pakaiFrek ? '<td rowspan="2">FREK</td>' : '';
  const kolUraian = u?.pakaiFrek ? 'CATATAN / TINDAKAN' : 'PELAKSANAAN PEMELIHARAAN';
  const kolPj = (u?.labelPj || 'Manager Teknik').toUpperCase();

  /* Gedung ditulis sekali di kop kalau seluruh isi cetakan dari gedung yang
     sama. Kalau bercampur, kop tidak menyebut gedung mana pun — menyebut satu
     gedung untuk catatan dua gedung itu keliru — dan gantinya tiap baris
     membawa kolom LOKASI sendiri. Catatan lama yang gedungnya belum pernah
     dicatat tetap memakai kop seperti sebelumnya. */
  const gedung = [...new Set(list.map(e => e.lokasi || ''))];
  const campuran = gedung.length > 1;
  const kop = campuran ? kopCetak('') : (gedung[0] ? kopCetak(gedung[0]) : kopCetak());

  doPrint(`
    ${kop}
    ${subjudul || ''}
    <table style="font-size:9pt;">
      <thead>
        <tr class="p-kepala" style="text-align:center;font-weight:bold;">
          <td rowspan="2">NO.</td>
          <td rowspan="2">${kolJam}</td>
          <td rowspan="2">DINAS</td>
          ${campuran ? '<td rowspan="2">LOKASI</td>' : ''}
          ${kolFrek}
          <td rowspan="2">${kolUraian}</td>
          <td colspan="2">TEKNISI PELAKSANA</td>
          <td colspan="2">${kolPj}</td>
        </tr>
        <tr class="p-kepala" style="text-align:center;font-weight:bold;">
          <td>NAMA</td><td>TTD</td><td>NAMA</td><td>TTD</td>
        </tr>
      </thead>
      <tbody>${list.map((e,i)=>entryPrintRow(e, i, campuran)).join('')}</tbody>
    </table>
    ${halamanLampiran}`, 'landscape');
}

/* Cetak per rentang tanggal / dinas / lokasi.
   Tombol per-catatan sudah dihilangkan; ini satu-satunya jalan mengeluarkan
   lembar logbook di layar. Pratinjau ("Lihat Saja") tetap bebas — supaya
   admin bisa memeriksa isinya — tetapi CETAK ditolak selama ada baris yang
   TTD-nya belum lengkap. Teknisi yang bernama di baris itu sudah dapat
   peringatan lewat lonceng di Dashboard Fasilitas Teknik (TTD_TERLAMBAT). */
function printLogbook(){
  const from  = document.getElementById('prFrom').value;
  const to    = document.getElementById('prTo').value;
  const dinas = document.getElementById('prDinas').value;
  const lokasi = document.getElementById('prLokasi')?.value || '';

  let list = entries.slice().filter(e=>{
    const d = String(e.tanggal || '').slice(0,10);
    if(from && d < from) return false;
    if(to   && d > to)   return false;
    if(dinas && String(e.dinas || '') !== dinas) return false;
    if(lokasi && String(e.lokasi || '') !== lokasi) return false;
    return true;
  });
  if(list.length === 0){ toast(T('takAdaFilter')); return; }

  // urut naik (yang lama di atas), seperti buku fisik
  list = list.reverse();

  // Guard TTD lengkap — HANYA saat benar-benar cetak. Pratinjau lewat "Lihat
  // Saja" menyalakan modePratinjau lebih dulu, jadi tetap boleh menampilkan
  // lembar yang belum ditandatangani (untuk pemeriksaan isi).
  if(!modePratinjau){
    const belum = list.filter(e => !cekTtdLengkap(e, 'entry').ok);
    if(belum.length){
      const contoh = belum.slice(0, 3).map(e=>{
        const c = cekTtdLengkap(e, 'entry');
        return `${escapeHtml(e.tanggal)||'-'} (${c.alasan})`;
      }).join(', ');
      const sisa = belum.length > 3 ? ` dan ${belum.length - 3} lagi` : '';
      toast(`Cetak ditolak — ${belum.length} dari ${list.length} catatan belum lengkap TTD-nya: ${contoh}${sisa}. Peringatan sudah muncul di lonceng dashboard untuk teknisi yang bersangkutan.`);
      return;
    }
  }

  const periode = (from || to || dinas || lokasi)
    ? `<div style="font-size:9pt;margin-bottom:6px;">Periode: ${from||'awal'} s.d. ${to||'terakhir'}${dinas ? ' &middot; Dinas: ' + escapeHtml(dinas) : ''}${lokasi ? ' &middot; Lokasi: ' + escapeHtml(lokasi) : ''}</div>` : '';

  printEntryList(list, periode);
}

/* Cetak per catatan dihilangkan: cetakan hanya lewat "Cetak Logbook" di bilah atas,
   yang menolak selama ada baris yang TTD-nya belum lengkap. Tombolnya sudah dihapus
   dari kartu daftar dan dari modal Detail — printSingleEntry ikut dihapus supaya
   tidak dipanggil dari mana pun secara tak sengaja. */
