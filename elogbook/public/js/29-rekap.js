/* E-Logbook · js/29-rekap.js — Tab Rekap & Matrik
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh.

   Berbeda dari tab lain, isi tab ini TIDAK diambil dari data yang sudah ada di
   memori: daftar di layar dibatasi 200 catatan terakhir, sedangkan rekap sebulan
   penuh justru butuh semuanya. Karena itu angkanya diminta terpisah ke server
   (getRekap), yang menjumlahkannya langsung dari database.

   Yang dijawab tab ini bukan "berapa formulir terisi", melainkan APA SAJA YANG
   SUDAH PERNAH DIALAMI unit ini. Karena itu tidak ada satu pun baris di layar
   yang ditulis lebih dulu di berkas ini: seluruh jenis kejadian dan seluruh nama
   pelaksana datang dari catatan yang sudah masuk. Yang belum pernah terjadi
   tidak muncul sebagai baris bernilai nol — memang tidak punya baris.

   Penggolongan jenisnya dikerjakan server (ATURAN_JENIS di server.js), termasuk
   daftar kata kuncinya yang ikut dikirim untuk ditampilkan apa adanya. */

let rekapData = null;
let rekapSedangMuat = false;

/** Sel matriks yang sedang ditekan: { orang, jenis }. Menentukan daftar catatan
 *  di bawahnya. Dibuang tiap rekap dimuat ulang — selnya sudah tidak ada. */
let rekapSaring = null;

const BULAN_SINGKAT = ['JAN','FEB','MAR','APR','MEI','JUN','JUL','AGU','SEP','OKT','NOV','DES'];

/** "2026-08-03" → "3 AGU"; "2026-08" → "AGU 2026". */
function labelPeriode(kunci, mode){
  if(mode === 'bulan'){
    const [th, bl] = kunci.split('-');
    return `${BULAN_SINGKAT[Number(bl) - 1] || bl} ${th}`;
  }
  const [, bl, tg] = kunci.split('-');
  return `${Number(tg)} ${BULAN_SINGKAT[Number(bl) - 1] || bl}`;
}

/** Kunci pekan menandai hari Senin — sebutkan sekalian minggu keberapa dalam bulannya. */
function judulPeriode(kunci, mode){
  if(mode === 'bulan') return kunci;
  const d = new Date(kunci + 'T00:00:00Z');
  const akhir = new Date(d); akhir.setUTCDate(akhir.getUTCDate() + 6);
  return `${kunci} s/d ${akhir.toISOString().slice(0,10)}`;
}

/** "2026-08-13" → "13 AGU 2026". */
function tglRekap(iso){
  const [th, bl, tg] = String(iso || '').split('-');
  return tg ? `${Number(tg)} ${BULAN_SINGKAT[Number(bl) - 1] || bl} ${th}` : (iso || '—');
}

/** Rentang cepat: n bulan terakhir sampai hari ini. Acuan waktunya jam server. */
function rentangRekapCepat(bulan){
  const akhir = sekarang();
  const awal = new Date(akhir);
  awal.setUTCMonth(awal.getUTCMonth() - (bulan - 1));
  awal.setUTCDate(1);
  document.getElementById('rekapDari').value = awal.toISOString().slice(0,10);
  document.getElementById('rekapSampai').value = akhir.toISOString().slice(0,10);
  // Rentang panjang jadi tidak terbaca kalau dipecah per minggu.
  document.getElementById('rekapMode').value = bulan >= 3 ? 'bulan' : 'pekan';
  muatRekap();
}

function gantiModeRekap(){ muatRekap(); }

/** Dipanggil saat tab Rekap dibuka: muat sekali, lalu biarkan sampai unitnya pindah. */
function muatRekapKalauPerlu(){ if(!rekapData) muatRekap(); }

/** Pindah unit berarti angka rekapnya milik unit lain — buang, jangan tampilkan. */
function lupakanRekap(){
  rekapData = null;
  rekapSaring = null;
  const isi = document.getElementById('rekapIsi');
  if(isi && document.getElementById('view-rekap')?.classList.contains('active')) muatRekap();
  else if(isi) isi.innerHTML = `<div class="empty">${T('rekapMemuat')}</div>`;
}

async function muatRekap(){
  const isi = document.getElementById('rekapIsi');
  if(!isi || rekapSedangMuat) return;
  if(!document.getElementById('rekapDari').value){ rentangRekapCepat(3); return; }

  rekapSedangMuat = true;
  rekapSaring = null;
  isi.innerHTML = `<div class="empty">${T('rekapMemuat')}</div>`;
  try{
    rekapData = await gsRun('getRekap', {
      unit: unitAktif,
      mode: document.getElementById('rekapMode').value,
      dari: document.getElementById('rekapDari').value,
      sampai: document.getElementById('rekapSampai').value
    });
    renderRekap();
  }catch(e){
    isi.innerHTML = `<div class="empty">${T('rekapGagal')}<br><span style="font-size:11px;color:var(--fail);">${escapeHtml(String(e.message||e))}</span></div>`;
  }
  rekapSedangMuat = false;
}

function renderRekap(){
  const isi = document.getElementById('rekapIsi');
  if(!isi || !rekapData) return;
  const r = rekapData;
  if(r.totalSemua === 0){
    isi.innerHTML = `<div class="empty">${T('rekapKosong')}</div>`;
    return;
  }
  isi.innerHTML = kartuRekapHtml(r) + matriksJenisHtml(r) + matriksOrangHtml(r)
                + catatanRekapHtml(r) + aturanRekapHtml(r);
  // Kerangkanya sudah masuk DOM — baru sekarang selnya bisa dipasangi listener
  // dan daftar catatannya diisi.
  pasangSelMatriks();
  gambarCatatanRekap();
}

/* ---------- Kartu ringkasan ---------- */

function kartuRekapHtml(r){
  const terbanyak = r.jenis[0];
  const akhir = r.periode[r.periode.length - 1];
  const baru = r.jenis.filter(j => j.periodePertama === akhir);
  const kartu = (label, nilai, catatan, kelas = '') => `
    <div class="rekap-kartu${kelas ? ' ' + kelas : ''}">
      <span class="rekap-kartu-label">${label}</span>
      <b>${nilai}</b>
      <span class="rekap-kartu-catatan">${catatan}</span>
    </div>`;

  return `<div class="card"><div class="rekap-kartu-baris">
    ${kartu(T('kejadianTercatat'), r.totalSemua,
        `${escapeHtml(r.dari)} → ${escapeHtml(r.sampai)}`, 'utama')}
    ${kartu(T('jenisPernahDialami'), r.jenis.length, T('catatanTanpaBarisNol'))}
    ${kartu(T('orangTerlibat'), r.orang.length,
        r.orang.length ? `${escapeHtml(r.orang[0].nama)} — ${r.orang[0].total}×` : '—')}
    ${kartu(T('jenisBaruPeriodeIni'), baru.length,
        baru.length ? escapeHtml(baru.map(j => j.nama).join(', ')) : T('takAdaJenisBaru'))}
    ${kartu(T('belumTergolongLabel'), r.belumTergolong,
        r.belumTergolong ? T('belumTergolongCatatan') : T('semuaTergolong'))}
  </div>
  <div class="rekap-sorot">
    <b>${escapeHtml(terbanyak.nama)}</b> ${T('palingSeringDialami')} —
    ${terbanyak.total}×, ${T('pertamaPada')} ${escapeHtml(tglRekap(terbanyak.pertama))}.
  </div></div>`;
}

/* ---------- Matriks jenis kejadian × periode ---------- */

function matriksJenisHtml(r){
  const kepala = r.periode.map(k =>
    `<th title="${escapeHtml(judulPeriode(k, r.mode))}">${escapeHtml(labelPeriode(k, r.mode))}</th>`).join('');
  const isi = r.jenis.map(j => `
    <tr>
      <td class="rekap-nama">${escapeHtml(j.nama)}
        <span class="rekap-nama-ket">${T('pertamaDialami')} ${escapeHtml(tglRekap(j.pertama))} · ${j.orang} ${T('orangKecil')}</span></td>
      ${r.periode.map(k => {
        const n = j.perPeriode[k] || 0;
        const awal = j.periodePertama === k;
        return `<td class="rekap-sel ${kelasPekat(n)}">${n || '·'}${awal ? '<i class="rekap-awal" title="' + T('pertamaMuncul') + '">▲</i>' : ''}</td>`;
      }).join('')}
      <td class="rekap-total">${j.total}</td>
    </tr>`).join('');
  const totalKolom = r.periode.map(k => r.jenis.reduce((s, j) => s + (j.perPeriode[k] || 0), 0));

  return `<div class="card">
    <h3 class="rekap-judul">${T('matriksJenisJudul')}</h3>
    <p class="rekap-ket">${T('matriksJenisKet')}</p>
    <div class="rekap-gulir">
      <table class="issues rekap-matriks">
        <thead><tr><th>${T('jenisKejadian')}</th>${kepala}<th>${T('totalSingkat')}</th></tr></thead>
        <tbody>${isi}</tbody>
        <tfoot><tr>
          <td class="rekap-nama">${T('totalSingkat')}</td>
          ${totalKolom.map(n => `<td class="rekap-sel">${n || '·'}</td>`).join('')}
          <td class="rekap-total">${totalKolom.reduce((a,b) => a+b, 0)}</td>
        </tr></tfoot>
      </table>
    </div>
  </div>`;
}

/* ---------- Matriks pelaksana × jenis kejadian ---------- */

/** Judul kolom dipendekkan supaya matriksnya masih terbaca; nama utuhnya tetap
 *  di title. Dipotong di " & " atau " / " dulu — memotong per kata saja
 *  meninggalkan ekor "Alarm &" yang justru lebih sulit dibaca. */
function ringkasJenis(nama){
  return nama.split(/ [&/] /)[0].split(' ').slice(0, 2).join(' ');
}

/** Pekat sel mengikuti seberapa sering, bukan seberapa besar angkanya. */
function kelasPekat(n){
  if(!n) return 'nol';
  if(n === 1) return 'p1';
  if(n <= 3) return 'p2';
  if(n <= 6) return 'p3';
  return 'p4';
}

function matriksOrangHtml(r){
  if(!r.orang.length) return '';
  const kepala = r.jenis.map(j =>
    `<th title="${escapeHtml(j.nama)}">${escapeHtml(ringkasJenis(j.nama))}</th>`).join('');
  const isi = r.orang.map(o => {
    const belum = r.jenis.filter(j => !(o.perJenis[j.nama] > 0)).length;
    return `<tr>
      <td class="rekap-nama">${escapeHtml(o.nama)}
        <span class="rekap-nama-ket">${o.total} ${T('catatanKecil')} · ${T('belumPernahPada')} ${belum} ${T('dariKecil')} ${r.jenis.length} ${T('jenisKecil')}</span></td>
      ${r.jenis.map(j => {
        const n = o.perJenis[j.nama] || 0;
        const ket = n ? `${n}×` : T('belumPernah');
        return `<td class="rekap-sel ${kelasPekat(n)}"${n ? ' data-orang="' + escapeHtml(o.nama) + '" data-jenis="' + escapeHtml(j.nama) + '"' : ''}
                    title="${escapeHtml(o.nama)} — ${escapeHtml(j.nama)}: ${ket}">${n || '·'}</td>`;
      }).join('')}
      <td class="rekap-total">${o.total}</td>
    </tr>`;
  }).join('');

  return `<div class="card">
    <h3 class="rekap-judul">${T('matriksOrangJudul')}</h3>
    <p class="rekap-ket">${T('matriksOrangKet')}</p>
    <div class="rekap-gulir">
      <table class="issues rekap-matriks rekap-orang">
        <thead><tr><th>${T('pelaksanaLabel')}</th>${kepala}<th>${T('totalSingkat')}</th></tr></thead>
        <tbody>${isi}</tbody>
      </table>
    </div>
    <div class="rekap-legenda">
      <span><i class="nol"></i>${T('belumPernah')}</span>
      <span><i class="p1"></i>1×</span>
      <span><i class="p2"></i>2–3×</span>
      <span><i class="p3"></i>4–6×</span>
      <span><i class="p4"></i>7×+</span>
    </div>
  </div>`;
}

/** Sel yang berisi angka bisa ditekan untuk membuka catatan di baliknya.
 *  Dipasang sebagai listener, bukan onclick di markup: nama orang dan jenis
 *  kejadian ikut ke dalam atribut, dan tanda kutip di dalamnya akan merusak
 *  atribut onclick yang dirangkai sebagai teks. */
function pasangSelMatriks(){
  document.querySelectorAll('#rekapIsi .rekap-orang td.rekap-sel[data-orang]').forEach((sel) => {
    sel.classList.add('bisa-tekan');
    sel.addEventListener('click', () => {
      const sama = rekapSaring && rekapSaring.orang === sel.dataset.orang
                                && rekapSaring.jenis === sel.dataset.jenis;
      rekapSaring = sama ? null : { orang: sel.dataset.orang, jenis: sel.dataset.jenis };
      document.querySelectorAll('#rekapIsi .rekap-sel.pilih').forEach(x => x.classList.remove('pilih'));
      if(rekapSaring) sel.classList.add('pilih');
      gambarCatatanRekap();
      document.getElementById('rekapCatatan')?.scrollIntoView({ behavior:'smooth', block:'nearest' });
    });
  });
}

/* ---------- Catatan di balik angkanya ---------- */

function catatanRekapHtml(r){
  return `<div class="card" id="rekapCatatan">
    <div class="rekap-catatan-kepala">
      <div>
        <h3 class="rekap-judul" id="rekapCatatanJudul">${T('catatanMendasari')}</h3>
        <p class="rekap-ket" id="rekapCatatanKet"></p>
      </div>
      <button class="btn ghost" id="rekapCatatanSemua" onclick="hapusSaringRekap()" style="display:none;">${T('tampilkanSemua')}</button>
    </div>
    <div id="rekapCatatanIsi"></div>
  </div>`;
}

function hapusSaringRekap(){
  rekapSaring = null;
  document.querySelectorAll('#rekapIsi .rekap-sel.pilih').forEach(x => x.classList.remove('pilih'));
  gambarCatatanRekap();
}

function gambarCatatanRekap(){
  const isi = document.getElementById('rekapCatatanIsi');
  if(!isi || !rekapData) return;
  const r = rekapData;

  let pakai = r.catatan;
  if(rekapSaring){
    pakai = r.catatan.filter(c => c.jenis === rekapSaring.jenis && c.orang.includes(rekapSaring.orang));
    document.getElementById('rekapCatatanJudul').textContent =
      `${rekapSaring.orang} — ${rekapSaring.jenis}`;
    document.getElementById('rekapCatatanKet').textContent =
      `${pakai.length} ${T('catatanKecil')} — ${T('yangMengisiSel')}`;
  }else{
    document.getElementById('rekapCatatanJudul').textContent = T('catatanMendasari');
    document.getElementById('rekapCatatanKet').textContent =
      `${pakai.length} ${T('catatanKecil')}, ${T('terbaruDiAtas')} ${T('tekanSelUntukSaring')}`;
  }
  document.getElementById('rekapCatatanSemua').style.display = rekapSaring ? '' : 'none';

  if(!pakai.length){
    isi.innerHTML = `<div class="empty">${T('takAdaCatatanPilihan')}</div>`;
    return;
  }

  isi.innerHTML = pakai.map(c => `
    <div class="rekap-kejadian">
      <div class="rekap-kejadian-atas">
        <span>${escapeHtml(tglRekap(c.tanggal))}</span>
        <span class="rekap-asal">${escapeHtml(c.asal)}</span>
        <span class="rekap-golongan">${escapeHtml(c.jenis)}</span>
      </div>
      <p class="rekap-kejadian-isi">${escapeHtml(c.uraian) || '<span class="muted">—</span>'}</p>
      <div class="rekap-kejadian-kaki">${c.orang.length ? escapeHtml(c.orang.join(', ')) : T('pelaksanaTakTercatat')}</div>
    </div>`).join('')
    + (!rekapSaring && r.catatanDipotong
        ? `<div class="empty">${r.catatanDipotong} ${T('catatanTakDitampilkan')}</div>` : '');
}

/* ---------- Aturan penggolongan ---------- */

/** Sengaja bisa dibuka pemakai, bukan disembunyikan: angka di matriks di atas
 *  hasil tebakan kata kunci, dan yang membaca berhak tahu tebakannya bagaimana. */
function aturanRekapHtml(r){
  const hitung = {};
  for(const c of r.catatan) hitung[c.jenis] = (hitung[c.jenis] || 0) + 1;
  const baris = r.aturan.map((a, i) => `
    <tr>
      <td class="rekap-total">${i + 1}</td>
      <td class="rekap-nama">${escapeHtml(a.jenis)}</td>
      <td class="rekap-kata">${a.kata.map(k => escapeHtml(k.trim())).join(' · ')}</td>
    </tr>`).join('');

  return `<div class="card">
    <details class="rekap-aturan">
      <summary>${T('aturanJudul')}</summary>
      <p class="rekap-ket">${T('aturanKet')}</p>
      <div class="rekap-gulir">
        <table class="issues rekap-matriks">
          <thead><tr><th>#</th><th>${T('jenisKejadian')}</th><th>${T('kataKunci')}</th></tr></thead>
          <tbody>${baris}
            <tr><td class="rekap-total">—</td>
              <td class="rekap-nama">${T('belumTergolongLabel')}</td>
              <td class="rekap-kata">${T('aturanBelumTergolong')}</td></tr>
          </tbody>
        </table>
      </div>
    </details>
  </div>`;
}

/* ---------- Cetak ---------- */

function cetakRekap(){
  if(!rekapData){ toast(T('rekapBelumAda')); return; }
  const r = rekapData;
  const u = infoUnit();

  const tabelJenis = `
    <h3 style="margin:14px 0 6px;font-size:13px;">Jenis kejadian yang pernah dialami</h3>
    <table style="width:100%;font-size:9pt;">
      <thead><tr><th>Jenis kejadian</th><th>Pertama</th>${
        r.periode.map(k => `<th>${escapeHtml(labelPeriode(k, r.mode))}</th>`).join('')}<th>Total</th></tr></thead>
      <tbody>${r.jenis.map(j => `<tr>
        <td style="text-align:left;">${escapeHtml(j.nama)}</td>
        <td>${escapeHtml(tglRekap(j.pertama))}</td>
        ${r.periode.map(k => `<td>${j.perPeriode[k] || ''}</td>`).join('')}
        <td><b>${j.total}</b></td></tr>`).join('')}</tbody>
    </table>`;

  // Matriks orang × jenis dicetak dengan tanda, bukan angka: di atas kertas yang
  // dicari "sudah pernah atau belum", dan deretan angka kecil justru mengaburkannya.
  const tabelOrang = !r.orang.length ? '' : `
    <h3 style="margin:14px 0 6px;font-size:13px;">Siapa sudah pernah menangani apa</h3>
    <table style="width:100%;font-size:8.5pt;">
      <thead><tr><th>Pelaksana</th>${
        r.jenis.map(j => `<th>${escapeHtml(ringkasJenis(j.nama))}</th>`).join('')}<th>Total</th></tr></thead>
      <tbody>${r.orang.map(o => `<tr>
        <td style="text-align:left;">${escapeHtml(o.nama)}</td>
        ${r.jenis.map(j => `<td>${o.perJenis[j.nama] ? '●' : '·'}</td>`).join('')}
        <td><b>${o.total}</b></td></tr>`).join('')}</tbody>
    </table>
    <div style="font-size:8pt;margin-top:4px;">● sudah pernah · · belum pernah</div>`;

  const html = `
    ${kopCetak()}
    <h2 style="text-align:center;font-size:15px;margin:10px 0 2px;">REKAP &amp; MATRIK ${escapeHtml((u?.peralatan || '').toUpperCase())}</h2>
    <div style="text-align:center;font-size:11px;margin-bottom:10px;">
      Periode ${escapeHtml(r.dari)} s/d ${escapeHtml(r.sampai)} — ${r.mode === 'bulan' ? 'per bulan' : 'per minggu'}
    </div>
    <table style="width:60%;font-size:9pt;">
      <tbody>
        <tr><td style="text-align:left;">Kejadian tercatat</td><td><b>${r.totalSemua}</b></td></tr>
        <tr><td style="text-align:left;">Jenis yang pernah dialami</td><td><b>${r.jenis.length}</b></td></tr>
        <tr><td style="text-align:left;">Orang yang terlibat</td><td><b>${r.orang.length}</b></td></tr>
        ${r.belumTergolong ? `<tr><td style="text-align:left;">Belum tergolong</td><td><b>${r.belumTergolong}</b></td></tr>` : ''}
      </tbody>
    </table>
    ${tabelJenis}
    ${tabelOrang}
    <div style="font-size:8pt;margin-top:10px;">
      Jenis kejadian dikenali dari kata kunci pada uraian yang diketik teknisi — bukan dari kolom
      pilihan. Angka pada matriks pelaksana bukan penilaian kinerja: sel kosong berarti belum pernah
      kebagian, bukan tidak bisa.
    </div>`;
  doPrint(html, 'landscape');
}
