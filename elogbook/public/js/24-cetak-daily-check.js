/* E-Logbook · js/24-cetak-daily-check.js — Cetak daily check Radtel dan Radkom, form berjalan maupun tersimpan
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh. */

/* ---------- CETAK DAILY CHECK ---------- */
function dcPrintTable(leftItems, rightItems, state){
  const head = `
    <tr class="p-kepala" style="text-align:center;font-weight:bold;font-size:7.5pt;">
      <td rowspan="2">ITEM</td><td colspan="2">NETWORK</td><td colspan="2">APLICATION</td><td rowspan="2">EQUIPMENT</td>
      <td rowspan="2">ITEM</td><td colspan="2">NETWORK</td><td colspan="2">APLICATION</td><td rowspan="2">EQUIPMENT</td>
    </tr>
    <tr class="p-kepala" style="text-align:center;font-weight:bold;font-size:7.5pt;">
      <td>A</td><td>B</td><td>A</td><td>B</td><td>A</td><td>B</td><td>A</td><td>B</td>
    </tr>`;

  // Tanda diberi warna, bukan sekadar huruf: hijau normal, jingga alarm,
  // merah gangguan — supaya sekali lihat langsung ketahuan mana yang bermasalah.
  const mark = (item, col)=>{
    const st = (state[item] || {})[col] || 'ok';
    const kelas = st === 'ok' ? 'p-ok' : (st === 'warn' ? 'p-warn' : 'p-fail');
    const simbol = st === 'ok' ? '✓' : (st === 'warn' ? '!' : 'X');
    return `<span class="${kelas}">${simbol}</span>`;
  };
  const cells = item => item
    ? `<td style="font-size:7.5pt;white-space:nowrap;">${item}</td>` +
      dcCols.map(c=>`<td style="text-align:center;font-size:8pt;">${mark(item,c)}</td>`).join('')
    : '<td></td>'.repeat(6);

  // Sub-baris tercetak: peran Main/Standby untuk Gatevox (A/B) & pasangan TMCS.
  // Ditulis eksplisit "· Main" / "· Standby" supaya lembar cetakan berdiri
  // sendiri tanpa harus melihat aturan tabelnya.
  const subCells = item => {
    if(!item) return null;
    if(/^GATEVOX [1-9]$/.test(item)){
      const cpu = ((state[item] || {}).mainCpu) || 'A';
      const teks = `CPU: A · ${cpu==='A'?'Main':'Standby'}, B · ${cpu==='B'?'Main':'Standby'}`;
      return `<td colspan="6" style="font-size:7.5pt;font-style:italic;padding-left:14px;">${teks}</td>`;
    }
    if(item === 'TMCS 1' || item === 'TMCS 2'){
      const n = (state['TMCS 1'] && Number(state['TMCS 1'].mainTmcs)) || 1;
      const angka = item === 'TMCS 1' ? 1 : 2;
      const teks = `Main/standby: ${n===angka ? 'Main' : 'Standby'}`;
      return `<td colspan="6" style="font-size:7.5pt;font-style:italic;padding-left:14px;">${teks}</td>`;
    }
    return null;
  };

  const n = Math.max(leftItems.length, rightItems.length);
  let rows = '';
  for(let i=0;i<n;i++){
    rows += `<tr>${cells(leftItems[i])}${cells(rightItems[i])}</tr>`;
    const lSub = subCells(leftItems[i]);
    const rSub = subCells(rightItems[i]);
    if(lSub || rSub){
      rows += `<tr>${lSub || '<td colspan="6"></td>'}${rSub || '<td colspan="6"></td>'}</tr>`;
    }
  }

  return `<table style="font-size:8pt;margin-bottom:10px;"><thead>${head}</thead><tbody>${rows}</tbody></table>`;
}

/** Halaman cetak daily check Radkom, mengikuti bentuk form aslinya. */
function buildDcRkPrintHtml(r, state){
  const temuan = rkTemuan(state);
  const petugas = (r.teknisiNamaList && r.teknisiNamaList.length)
    ? r.teknisiNamaList.join(', ') : (r.teknisiNama || '-');

  return `
    <div style="text-align:center;font-weight:bold;font-size:12pt;margin-bottom:8px;">
      DAILY CHECK UNIT RADKOM DI NEW JATSC
    </div>
    <table class="no-border" style="font-size:9pt;margin-bottom:8px;">
      <tr>
        <td style="width:30%;">LOKASI : NEW JATSC</td>
        <td style="width:40%;">TANGGAL / JAM : ${escapeHtml(r.tanggal)} ${escapeHtml(r.dinas ? '/ ' + r.dinas : '')}</td>
        <td>PETUGAS : ${escapeHtml(petugas)}</td>
      </tr>
    </table>

    ${dcRkTabelBaca(state, true)}

    <div style="font-size:8.5pt;margin-top:8px;">
      <b>NB :</b> ✓ : OK &nbsp;&nbsp; ✕ : NOT OK
    </div>
    ${temuan.length ? `<div style="font-size:8.5pt;margin-top:4px;"><b>TEMUAN NOT OK :</b> ${escapeHtml(temuan.join('; '))}</div>` : ''}
    ${r.remark ? `<div style="font-size:8.5pt;margin-top:4px;"><b>CATATAN :</b> ${escapeHtml(r.remark).replace(/\n/g,'<br>')}</div>` : ''}

    <table class="no-border" style="font-size:9pt;margin-top:14px;">
      <tr>
        <td style="width:55%;text-align:left;vertical-align:top;">
          <div style="margin-bottom:6px;">PETUGAS :</div>
          ${teknisiPrintBlock(r)}
        </td>
        <td style="text-align:center;vertical-align:top;">
          <div style="margin-bottom:4px;">PH MANAGER TEKNIK</div>
          <div style="height:46px;">${ttdImg(r.managerTtd, 40)}</div>
          <div style="border-top:1px solid #000;display:inline-block;padding:0 24px;">
            ${r.managerTtd ? (escapeHtml(r.managerNama) || '&nbsp;') : '&nbsp;'}
          </div>
        </td>
      </tr>
    </table>`;
}

/** Halaman cetak daily check JATSC (Frequentis 3020X) — pakai render baca-saja
    dcJatscTabelBaca yang sama dengan modal detail, dengan gaya cetak.
    Bilah meta atas sengaja disamakan bentuknya dengan cetakan Garex 300:
    tiga kolom, tanpa PETUGAS di atas — nama petugas sudah muncul lengkap
    di blok TTD di bawah, jadi menaruhnya dua kali cuma menyempitkan ruang
    HARI/TANGGAL. Kolom pertama diisi LOKASI (bukan SUHU MER) karena
    Frequentis di JATSC tidak mengukur suhu MER. */
function buildDcJatscPrintHtml(r, state){
  return `
    <div style="text-align:center;font-weight:bold;font-size:12pt;margin-bottom:2px;">
      CHECKLIST PERAWATAN HARIAN RADTEL
    </div>
    <div style="text-align:center;font-weight:bold;font-size:10pt;margin-bottom:8px;">
      VCS FREQUENTIS 3020X — JATSC
    </div>
    <table class="no-border" style="font-size:9pt;margin-bottom:8px;">
      <tr>
        <td style="width:33%;">LOKASI : JATSC</td>
        <td style="width:33%;">DINAS : ${escapeHtml(r.dinas)||'________'}</td>
        <td>HARI/TANGGAL : ${escapeHtml(r.tanggal)||'________'}</td>
      </tr>
    </table>

    ${dcJatscTabelBaca(state, true)}

    <div style="font-size:8.5pt;margin-top:6px;">
      <b>NB :</b> ✓ : Normal &nbsp;&nbsp; ! : Alarm &nbsp;&nbsp; ✕ : Gangguan
    </div>
    ${r.remark ? `<div style="font-size:8.5pt;margin-top:4px;"><b>KETERANGAN :</b> ${escapeHtml(r.remark).replace(/\n/g,'<br>')}</div>` : ''}

    <table class="no-border" style="font-size:9pt;margin-top:14px;">
      <tr>
        <td style="width:55%;text-align:left;vertical-align:top;">
          <div style="margin-bottom:6px;">PETUGAS :</div>
          ${teknisiPrintBlock(r)}
        </td>
        <td style="text-align:center;vertical-align:top;">
          <div>Mengetahui,</div>
          <div style="margin-bottom:4px;">Manager Teknik</div>
          <div style="height:46px;">${ttdImg(r.managerTtd, 40)}</div>
          <div style="border-top:1px solid #000;display:inline-block;padding:0 24px;">
            ${r.managerTtd ? (escapeHtml(r.managerNama) || '&nbsp;') : '&nbsp;'}
          </div>
        </td>
      </tr>
    </table>`;
}

/** Halaman cetak daily check Navigasi (unit ppabn) — sama pola dengan JATSC:
    kepala judul, tiga kolom meta tanpa PETUGAS (nama petugas sudah muncul di
    blok TTD), tabel per-fasilitas dari dcNavTabelBaca, catatan legenda
    NB, keterangan/remark opsional, lalu blok TTD teknisi dan manager. */
function buildDcNavPrintHtml(r, state){
  return `
    <div style="text-align:center;font-weight:bold;font-size:12pt;margin-bottom:2px;">
      DAILY CHECK FASILITAS PENDARATAN PRESISI &amp; ALAT BANTU NAVIGASI
    </div>
    <div style="text-align:center;font-weight:bold;font-size:10pt;margin-bottom:8px;">
      ILS, DVOR/DME — JATSC
    </div>
    <table class="no-border" style="font-size:9pt;margin-bottom:8px;">
      <tr>
        <td style="width:33%;">LOKASI : JATSC</td>
        <td style="width:33%;">DINAS : ${escapeHtml(r.dinas)||'________'}</td>
        <td>HARI/TANGGAL : ${escapeHtml(r.tanggal)||'________'}</td>
      </tr>
    </table>

    ${dcNavTabelBaca(state, true)}

    <div style="font-size:8.5pt;margin-top:6px;">
      <b>NB :</b> ✓ : Normal / Serviceable &nbsp;&nbsp; ! : Alarm &nbsp;&nbsp; ✕ : Gangguan / Unserviceable
    </div>
    ${r.remark ? `<div style="font-size:8.5pt;margin-top:4px;"><b>KETERANGAN :</b> ${escapeHtml(r.remark).replace(/\n/g,'<br>')}</div>` : ''}

    <table class="no-border" style="font-size:9pt;margin-top:14px;">
      <tr>
        <td style="width:55%;text-align:left;vertical-align:top;">
          <div style="margin-bottom:6px;">PETUGAS :</div>
          ${teknisiPrintBlock(r)}
        </td>
        <td style="text-align:center;vertical-align:top;">
          <div>Mengetahui,</div>
          <div style="margin-bottom:4px;">Manager Teknik</div>
          <div style="height:46px;">${ttdImg(r.managerTtd, 40)}</div>
          <div style="border-top:1px solid #000;display:inline-block;padding:0 24px;">
            ${r.managerTtd ? (escapeHtml(r.managerNama) || '&nbsp;') : '&nbsp;'}
          </div>
        </td>
      </tr>
    </table>`;
}

/** Halaman cetak daily check Pengamatan (unit pengamatan) — dua lembar
    (Radar CKG 3 / Fasilitas Pengamatan) yang dipilih dari __pgmForm. Sama pola
    dengan JATSC/Navigasi: kepala judul, tiga kolom meta, tabel baca-saja,
    legenda NB, keterangan opsional, lalu blok TTD teknisi & manager. */
function buildDcPgmPrintHtml(r, state){
  const form = (state && state.__pgmForm === 'mer') ? 'mer' : 'ckg3';
  const label = (typeof DC_PGM_LABEL !== 'undefined' && DC_PGM_LABEL[form]) || 'Radar CKG 3';
  return `
    <style>
      /* Rapatkan sel khusus lembar pengamatan supaya muat satu halaman. */
      #printArea .pgm-print td{padding:0 3px;line-height:1.1;}
      #printArea .pgm-print .p-kepala td{font-size:6pt;}
    </style>
    <div style="text-align:center;font-weight:bold;font-size:12pt;margin-bottom:2px;">
      DAILY CHECK FASILITAS PENGAMATAN
    </div>
    <div style="text-align:center;font-weight:bold;font-size:10pt;margin-bottom:8px;">
      ${escapeHtml(label.toUpperCase())} — JATSC
    </div>
    <table class="no-border" style="font-size:9pt;margin-bottom:8px;">
      <tr>
        <td style="width:33%;">LOKASI : JATSC</td>
        <td style="width:33%;">DINAS : ${escapeHtml(r.dinas)||'________'}</td>
        <td>HARI/TANGGAL : ${escapeHtml(r.tanggal)||'________'}</td>
      </tr>
    </table>

    ${dcPgmTabelBaca(form, state, true)}

    <div style="font-size:8.5pt;margin-top:6px;">
      <b>NB :</b> ✓ : Normal &nbsp;&nbsp; ! : Alarm &nbsp;&nbsp; ✕ : Gangguan
    </div>
    ${r.remark ? `<div style="font-size:8.5pt;margin-top:4px;"><b>KETERANGAN :</b> ${escapeHtml(r.remark).replace(/\n/g,'<br>')}</div>` : ''}

    <table class="no-border" style="font-size:9pt;margin-top:14px;">
      <tr>
        <td style="width:55%;text-align:left;vertical-align:top;">
          <div style="margin-bottom:6px;">PETUGAS :</div>
          ${teknisiPrintBlock(r)}
        </td>
        <td style="text-align:center;vertical-align:top;">
          <div>Mengetahui,</div>
          <div style="margin-bottom:4px;">Manager Teknik</div>
          <div style="height:46px;">${ttdImg(r.managerTtd, 40)}</div>
          <div style="border-top:1px solid #000;display:inline-block;padding:0 24px;">
            ${r.managerTtd ? (escapeHtml(r.managerNama) || '&nbsp;') : '&nbsp;'}
          </div>
        </td>
      </tr>
    </table>`;
}

/** Halaman cetak daily check Gedung & Keamanan — dua lembar (New JATSC /
    JATSC) yang dipilih dari __fgkForm. Sama pola dengan Pengamatan:
    kepala judul, tiga kolom meta, tabel baca-saja, legenda NB, keterangan
    opsional, lalu blok TTD teknisi & manager. Legendanya memakai istilah
    lembar ini (Baik / Perlu Perhatian / Rusak), bukan Normal/Alarm/Gangguan. */
function buildDcFgkPrintHtml(r, state){
  const form = (state && state.__fgkForm === 'jatsc') ? 'jatsc' : 'toilet';
  const sub = (typeof DC_FGK_SUBJUDUL !== 'undefined' && DC_FGK_SUBJUDUL[form]) || '';
  // Lokasi IKUT lembarnya — kedua lembar milik gedung yang berbeda, jadi tidak
  // boleh dipatok 'JATSC' seperti cetakan unit lain yang cuma punya satu gedung.
  const lokasi = (typeof DC_FGK_LABEL !== 'undefined' && DC_FGK_LABEL[form]) || 'New JATSC';
  return `
    <style>
      /* Rapatkan sel khusus lembar gedung & keamanan supaya muat satu halaman.
         .pgm-print = lembar New JATSC (dialirkan ke kolom), .fgk-cetak =
         lembar JATSC (seksi A lebar penuh, B & C berdampingan). */
      #printArea .pgm-print td, #printArea .fgk-cetak td{padding:0 3px;line-height:1.1;}
      #printArea .pgm-print .p-kepala td, #printArea .fgk-cetak .p-kepala td{font-size:6pt;}
      #printArea .fgk-cetak .fgk-sel{display:block;}
    </style>
    <div style="text-align:center;font-weight:bold;font-size:12pt;margin-bottom:2px;">
      PENGECEKAN HARIAN FASILITAS GEDUNG DAN KEAMANAN
    </div>
    <div style="text-align:center;font-weight:bold;font-size:10pt;margin-bottom:8px;">
      ${escapeHtml(sub)}
    </div>
    <table class="no-border" style="font-size:9pt;margin-bottom:8px;">
      <tr>
        <td style="width:33%;">LOKASI : ${escapeHtml(lokasi.toUpperCase())}</td>
        <td style="width:33%;">DINAS : ${escapeHtml(r.dinas)||'________'}</td>
        <td>HARI/TANGGAL : ${escapeHtml(r.tanggal)||'________'}</td>
      </tr>
    </table>

    ${dcFgkTabelBaca(form, state, true)}

    <div style="font-size:8.5pt;margin-top:6px;">
      <b>NB :</b> ✓ : Baik &nbsp;&nbsp; ! : Perlu Perhatian &nbsp;&nbsp; ✕ : Rusak / Tidak Berfungsi
    </div>
    ${r.remark ? `<div style="font-size:8.5pt;margin-top:4px;"><b>KETERANGAN :</b> ${escapeHtml(r.remark).replace(/\n/g,'<br>')}</div>` : ''}

    <table class="no-border" style="font-size:9pt;margin-top:14px;">
      <tr>
        <td style="width:55%;text-align:left;vertical-align:top;">
          <div style="margin-bottom:6px;">PETUGAS :</div>
          ${teknisiPrintBlock(r)}
        </td>
        <td style="text-align:center;vertical-align:top;">
          <div>Mengetahui,</div>
          <div style="margin-bottom:4px;">Manager Teknik</div>
          <div style="height:46px;">${ttdImg(r.managerTtd, 40)}</div>
          <div style="border-top:1px solid #000;display:inline-block;padding:0 24px;">
            ${r.managerTtd ? (escapeHtml(r.managerNama) || '&nbsp;') : '&nbsp;'}
          </div>
        </td>
      </tr>
    </table>`;
}

/** Halaman cetak daily check Listrik & Mekanik — empat lembar (STS / MDS /
    Beban Listrik / UPS) yang dipilih dari __lkForm. Judul kepalanya memakai
    judul lembar aslinya apa adanya, dengan baris kedua nama bandara — persis
    dua baris kepala di berkas Excel-nya.

    Tanpa legenda ✓/!/✕: lembar ini isinya angka ukur. Satu-satunya sandi yang
    perlu diterangkan ada di kolom KONDISI, dan itu pun sudah dicetak sebagai
    kata penuh (ON / STANDBY / OFF), bukan simbol.

    PORTRAIT, mengikuti keempat sheet di berkas aslinya (A4, orientation
    portrait, diperkecil 64–95%). Lembarnya memang lebar — MDS enam belas
    kolom — jadi hurufnya dikecilkan dan lebar kolom angka dibagi rata
    (lkColgroupCetak di 12g) supaya tetap muat selebar kertas berdiri. */
function buildDcLkPrintHtml(r, state){
  const form = (typeof lkFormTersimpan === 'function') ? lkFormTersimpan(state) : 'sts';
  const judul = (typeof DC_LK_SUBJUDUL !== 'undefined' && DC_LK_SUBJUDUL[form]) || 'PENGECEKAN HARIAN';
  return `
    <style>
      /* Rapatkan sel supaya lembar yang tinggi (STS 40-an baris) tetap muat. */
      #printArea .lk-print td{padding:0 3px;line-height:1.15;}
    </style>
    <div style="text-align:center;font-weight:bold;font-size:12pt;margin-bottom:2px;">
      ${escapeHtml(judul)}
    </div>
    <div style="text-align:center;font-weight:bold;font-size:10pt;margin-bottom:8px;">
      BANDARA INTERNASIONAL SOEKARNO — HATTA
    </div>
    <table class="no-border" style="font-size:9pt;margin-bottom:8px;">
      <tr>
        <td style="width:33%;">LEMBAR : ${escapeHtml(((typeof DC_LK_LABEL !== 'undefined' && DC_LK_LABEL[form]) || 'STS').toUpperCase())}</td>
        <td style="width:33%;">DINAS : ${escapeHtml(r.dinas)||'________'}</td>
        <td>HARI/TANGGAL : ${escapeHtml(r.tanggal)||'________'}</td>
      </tr>
    </table>

    ${dcLkTabelBaca(form, state, true)}

    ${r.remark ? `<div style="font-size:8.5pt;margin-top:4px;"><b>CATATAN :</b> ${escapeHtml(r.remark).replace(/\n/g,'<br>')}</div>` : ''}

    <table class="no-border" style="font-size:9pt;margin-top:14px;">
      <tr>
        <td style="width:55%;text-align:left;vertical-align:top;">
          <div style="margin-bottom:6px;">PELAKSANA TEKNISI :</div>
          ${teknisiPrintBlock(r)}
        </td>
        <td style="text-align:center;vertical-align:top;">
          <div>Mengetahui,</div>
          <div style="margin-bottom:4px;">Manager Teknik</div>
          <div style="height:46px;">${ttdImg(r.managerTtd, 40)}</div>
          <div style="border-top:1px solid #000;display:inline-block;padding:0 24px;">
            ${r.managerTtd ? (escapeHtml(r.managerNama) || '&nbsp;') : '&nbsp;'}
          </div>
        </td>
      </tr>
    </table>`;
}

function buildDcPrintHtml(r, state){
  if(state && state.__format === 'amhs') return buildDcAmhsPrintHtml(r, state);
  if(state && state.__format === 'pengamatan') return buildDcPgmPrintHtml(r, state);
  if(state && state.__format === 'fgk') return buildDcFgkPrintHtml(r, state);
  if(state && state.__format === 'listrik') return buildDcLkPrintHtml(r, state);
  if(dcRadkomAktif()) return buildDcRkPrintHtml(r, state);
  if(state && state.__lokasi === 'navigasi') return buildDcNavPrintHtml(r, state);
  if(state && state.__lokasi === 'jatsc') return buildDcJatscPrintHtml(r, state);
  const remarkLines = (r.remark || '').split('\n')
    .filter(s=>s.trim()).map((s,i)=>`<div>${i+1}. ${escapeHtml(s)}</div>`).join('') || '<div>&nbsp;</div>';

  return `
    <div style="text-align:center;font-weight:bold;font-size:12pt;">DAILY CHECK VCS GAREX 300 NEW JATSC</div>
    <div style="text-align:center;font-weight:bold;font-size:10pt;margin-bottom:8px;">UNIT RADTEL</div>

    <table class="no-border" style="font-size:9pt;margin-bottom:8px;">
      <tr>
        <td style="width:33%;">SUHU MER : ${escapeHtml(r.suhu) || '________'}</td>
        <td style="width:33%;">DINAS : ${escapeHtml(r.dinas) || '________'}</td>
        <td>HARI/TANGGAL : ${escapeHtml(r.tanggal)}</td>
      </tr>
    </table>

    ${dcPrintTable(TBL1_LEFT, TBL1_RIGHT, state)}
    ${dcPrintTable(TBL2_LEFT, TBL2_RIGHT, state)}

    <div style="font-size:9pt;margin-top:6px;"><b>REMARK :</b></div>
    <div style="font-size:9pt;"><b>Note :</b></div>
    <div style="font-size:9pt;margin-bottom:14px;">${remarkLines}</div>

    <table class="no-border" style="font-size:9pt;">
      <tr>
        <td style="width:55%;text-align:left;vertical-align:top;">
          <div style="margin-bottom:6px;">TEKNISI :</div>
          ${teknisiPrintBlock(r)}
        </td>
        <td style="text-align:center;vertical-align:top;">
          <div>Mengetahui,</div>
          <div style="margin-bottom:4px;">Manager Teknik</div>
          <div style="height:46px;">${ttdImg(r.managerTtd, 40)}</div>
          <div style="border-top:1px solid #000;display:inline-block;padding:0 24px;">
            ${r.managerTtd ? (escapeHtml(r.managerNama) || '&nbsp;') : '&nbsp;'}
          </div>
        </td>
      </tr>
    </table>`;
}

/** Blok teknisi untuk cetak: daftar nama bernomor di kiri, satu TTD tepat
    menempel di sampingnya (bukan di bawah daftar) — supaya tingginya tidak
    ikut berubah kalau nama teknisi yang dinas lebih dari satu, dan sejajar
    dengan TTD manager teknik di kolom sebelah. Tabelnya sengaja tidak dibuat
    lebar penuh, supaya kolom TTD tidak terdorong jauh ke kanan meninggalkan
    celah kosong dari nama. */
function teknisiPrintBlock(r){
  let namaList = r.teknisiNamaList && r.teknisiNamaList.length ? r.teknisiNamaList
               : (r.teknisiNama ? String(r.teknisiNama).split(',').map(s=>s.trim()).filter(Boolean) : []);
  if(namaList.length === 0) namaList = [''];
  // Daftar nama tidak ikut ke cetakan kalau petak TTD teknisinya masih kosong —
  // hanya penomorannya yang tersisa, supaya bentuk baris tetap sama tinggi.
  const names = r.teknisiTtd
    ? namaList.map((n,i)=>`<div>${i+1}. ${escapeHtml(n) || '______________________'}</div>`).join('')
    : namaList.map((_,i)=>`<div>${i+1}. ______________________</div>`).join('');
  return `<table class="no-border" style="width:auto;border-collapse:collapse;"><tr>
      <td style="text-align:left;vertical-align:middle;white-space:nowrap;">${names}</td>
      <td style="width:60px;text-align:left;vertical-align:middle;padding-left:10px;">${ttdImg(r.teknisiTtd, 34, 'left')}</td>
    </tr></table>`;
}

/** Cetak form daily check yang sedang diisi (belum disimpan). */
function printCurrentDailyCheck(){
  const jatsc = dcRadtelJatscAktif();
  const nav   = (typeof dcNavAktif === 'function') && dcNavAktif();
  const pgm   = (typeof dcPengamatanAktif === 'function') && dcPengamatanAktif();
  const fgk   = (typeof dcGedungKeamananAktif === 'function') && dcGedungKeamananAktif();
  const lk    = (typeof dcListrikAktif === 'function') && dcListrikAktif();
  const r = {
    tanggal: tanggalDcTersimpan(),
    dinas: document.getElementById('dcDinas').value,
    suhu: (jatsc || nav || pgm || fgk || lk) ? '' : document.getElementById('dcSuhu').value.trim(),
    remark: document.getElementById('dcRemark').value.trim(),
    teknisiNamaList: collectTeknisiNama(),
    teknisiTtd: getSigDataUrl('sigDcTeknisi'),
    managerNama: document.getElementById('dcManagerNama').value.trim()
  };
  const state = pgm   ? { ...dcPgmState[dcPgmForm], __format:'pengamatan', __pgmForm:dcPgmForm }
              : fgk   ? { ...dcFgkState[dcFgkForm], __format:'fgk', __fgkForm:dcFgkForm }
              : lk    ? { ...dcLkState[dcLkForm], __format:'listrik', __lkForm:dcLkForm }
              : nav   ? { ...dcNState, __lokasi:'navigasi' }
              : jatsc ? { ...dcJState, __lokasi:'jatsc' }
                      : dcState;
  // Pengamatan, Gedung & Keamanan, dan Listrik & Mekanik mengikuti lembar
  // Excel-nya yang portrait; unit lain landscape.
  doPrint(buildDcPrintHtml(r, state), (pgm || fgk || lk) ? 'portrait' : 'landscape');
}

/** Cetak daily check yang sudah tersimpan di database. Detailnya dulu diambil
    baru dicek — teknisiTtd/managerTtd yang berlaku bisa saja bukan yang ada di
    ringkasannya (mis. TTD susulan yang barusan dibubuhkan pejabat). */
async function printSavedDailyCheck(id){
  const r = dcHistory.find(x=>x.id===id);
  if(!r) return;
  toast('Menyiapkan halaman cetak...');
  try{
    const detail = await gsRun('getDailyCheckDetail', id) || {};
    const rPrint = Object.assign({}, r, {
      teknisiTtd: detail.teknisiTtd || r.teknisiTtd,
      managerTtd: detail.managerTtd || r.managerTtd
    });
    // AMHS (Fasilitas Otomasi) tak memakai TTD Manager digital — TTD manager
    // manual di kertas — jadi gerbang "harus sudah TTD" tidak berlaku, dan
    // lembarnya portrait (1 halaman/sistem).
    const fmt = (detail.state || {}).__format;
    const isAmhs = fmt === 'amhs';
    const isPgm  = fmt === 'pengamatan';
    const isFgk  = fmt === 'fgk';
    const isLk   = fmt === 'listrik';
    if(!isAmhs && !tolakCetakBilaBelumTtd(rPrint, 'dc')) return;
    // AMHS, Pengamatan, Gedung-Keamanan, & Listrik-Mekanik mengikuti lembar
    // aslinya yang portrait; sisanya landscape.
    doPrint(buildDcPrintHtml(rPrint, detail.state || {}), (isAmhs || isPgm || isFgk || isLk) ? 'portrait' : 'landscape');
  }catch(e){ toast('Gagal mengambil detail daily check.'); }
}
