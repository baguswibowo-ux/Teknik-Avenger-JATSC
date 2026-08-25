/* E-Logbook · js/23-cetak-isu.js — Cetak daftar isu dan isu tunggal
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh. */

/* ---------- CETAK DAFTAR ISU ---------- */
function issuePrintRow(it, i){
  return `
    <tr>
      <td style="text-align:center;width:28px;">${i+1}</td>
      <td style="width:130px;font-size:8.5pt;">${escapeHtml(it.jenis)}</td>
      <td style="font-size:8.5pt;">${escapeHtml(it.keterangan).replace(/\n/g,'<br>')}</td>
      <td style="width:85px;font-size:8.5pt;">${escapeHtml(it.lokasi)}</td>
      <td style="width:78px;font-size:8pt;text-align:center;">${escapeHtml(formatWaktuIsu(it.tglReport))||'-'}</td>
      <td style="width:52px;font-size:8pt;text-align:center;">${escapeHtml(it.status)}</td>
      <td style="width:78px;font-size:8pt;text-align:center;">${escapeHtml(formatWaktuIsu(it.tglClosed))||'-'}</td>
      <td style="width:95px;font-size:8.5pt;">${escapeHtml(it.dilaporkanOleh)||'-'}</td>
    </tr>`;
}

function printIssueList(list, subjudul){
  /* Halaman lampiran dipasang kalau ada bukti ATAU ada catatan penutupan —
     tanpa bukti pun, siapa yang menutup + keterangannya perlu tercetak untuk
     isu tertutup. Kalau semua isu di daftar ini belum ada apa-apanya, halaman
     lampiran ikut absen. */
  const berbukti = list.filter(it=>it.lampiranOpen.length || it.lampiranClosed.length
                                   || (it.status === 'Closed' && (it.ditutupOleh || it.keteranganClosed)));
  const barisPenutup = (it) => {
    if(it.status !== 'Closed' && !it.ditutupOleh && !it.keteranganClosed) return '';
    const rows = [];
    if(it.ditutupOleh){
      rows.push(`<div style="font-size:8.5pt;margin-top:4px;">Ditutup oleh: <b>${escapeHtml(it.ditutupOleh)}</b></div>`);
    }
    if(it.keteranganClosed){
      rows.push(`<div style="font-size:8.5pt;margin-top:2px;white-space:pre-wrap;">Keterangan penutupan: ${escapeHtml(it.keteranganClosed)}</div>`);
    }
    return rows.join('');
  };
  const halamanBukti = berbukti.length ? `
    <div style="page-break-before:always;">
      <div style="text-align:center;font-weight:bold;font-size:12pt;margin-bottom:10px;">
        LAMPIRAN BUKTI ISU
      </div>
      ${berbukti.map(it=>`
        <div style="margin-bottom:16px;">
          <div style="font-size:9.5pt;font-weight:bold;border-bottom:1px solid #999;padding-bottom:2px;">
            ${escapeHtml(it.jenis)||'(tanpa jenis)'}${it.lokasi ? ' — ' + escapeHtml(it.lokasi) : ''}
          </div>
          ${barisPenutup(it)}
          ${lampiranPrintHtml(it.lampiranOpen, `Saat kejadian — dilaporkan ${escapeHtml(formatWaktuIsu(it.tglReport))||'-'}`)}
          ${lampiranPrintHtml(it.lampiranClosed, `Saat selesai — ditutup ${escapeHtml(formatWaktuIsu(it.tglClosed))||'-'}`)}
        </div>`).join('')}
    </div>` : '';

  doPrint(`
    <div style="text-align:center;font-weight:bold;font-size:13pt;margin-bottom:8px;">
      DAFTAR ISU / UPDATE ISSUE
    </div>
    <table class="no-border" style="font-size:9pt;margin-bottom:8px;">
      <tr><td style="width:170px;">Penyelenggara Pelayanan</td><td>: Perum LPPNPI Cabang JATSC</td></tr>
      <tr><td>Kelompok Fasilitas</td><td>: Fasilitas Komunikasi Penerbangan (Radkom &amp; Radtel)</td></tr>
      <tr><td>Nama Peralatan</td><td>: VCS Garex 300, Recording Neptuno</td></tr>
    </table>
    ${subjudul || ''}
    <table style="font-size:9pt;">
      <thead>
        <tr class="p-kepala" style="text-align:center;font-weight:bold;">
          <td>NO.</td><td>JENIS ISSUE</td><td>KETERANGAN</td><td>LOKASI</td>
          <td>TGL<br>REPORT</td><td>STATUS</td><td>TGL<br>CLOSED</td><td>DILAPORKAN<br>OLEH</td>
        </tr>
      </thead>
      <tbody>${list.map(issuePrintRow).join('')}</tbody>
    </table>
    ${halamanBukti}`, 'landscape');
}

function printIssues(){
  // Satu sumber filter dengan tabel di layar — kotak cari dan filter tanggal/
  // status ikut dipakai supaya "Lihat Saja / Cetak" persis mencetak apa yang
  // sedang tampil di daftar.
  const from   = document.getElementById('prIsuFrom').value;
  const to     = document.getElementById('prIsuTo').value;
  const status = document.getElementById('prIsuStatus').value;
  const cari   = String((document.getElementById('prIsuCari') || {}).value || '').trim();

  const list = isuTersaring();
  if(list.length === 0){ toast(T('takAdaIsuFilter')); return; }

  const bagian = [];
  if(from || to) bagian.push(`Periode report: ${from||'awal'} s.d. ${to||'terakhir'}`);
  if(status)     bagian.push('Status: ' + escapeHtml(status));
  if(cari)       bagian.push('Cari: "' + escapeHtml(cari) + '"');
  const periode = bagian.length
    ? `<div style="font-size:9pt;margin-bottom:6px;">${bagian.join(' &middot; ')}</div>` : '';
  printIssueList(list, periode);
}

/* Tombol "Lihat Saja": memakai pembangun halaman yang sama persis, hanya
   menyalakan mode pratinjau lebih dulu supaya berhenti sebelum dialog cetak.
   Bendera dikembalikan di finally: kalau filternya tidak menemukan apa pun,
   printLogbook berhenti lebih awal, dan tanpa ini tombol Cetak berikutnya ikut
   berubah jadi pratinjau. doPrint membaca bendera itu sebelum await pertamanya,
   jadi nilainya sudah tertangkap saat finally berjalan. */
function lihatLogbook(){ modePratinjau = true; try{ printLogbook(); } finally { modePratinjau = false; } }
function lihatIssues(){ modePratinjau = true; try{ printIssues(); } finally { modePratinjau = false; } }

function printSingleIssue(id){
  const it = issues.find(x=>x.id===id);
  if(!it){ toast('Isu tidak ditemukan.'); return; }
  printIssueList([it], `<div style="font-size:9pt;margin-bottom:6px;">Isu tunggal — ${escapeHtml(it.jenis)||'(tanpa jenis)'}</div>`);
}
