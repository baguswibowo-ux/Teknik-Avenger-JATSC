/* =======================================================================
   MENYUNTING DATABASE UNIT — peralatan dan sparepart

   Yang bisa disunting hanya dua daftar itu, dan alasannya bukan kemalasan.
   Trouble dan logbook datang dari E-Logbook begitu dashboard tersambung;
   menyuntingnya di sini akan melahirkan salinan lokal yang berbeda dari
   aslinya, tanpa satu pun jalan mengirimkannya kembali. Peralatan dan
   sparepart tidak punya rumah di sana sama sekali, jadi di sinilah tempatnya.

   Penyimpanannya localStorage — lihat catatan di blok SUNTINGAN DATABASE UNIT
   di atas.
   ======================================================================= */

const adeganPilihan = () => [
  ['antena',T('Antena / tiang','Antenna / mast')], ['radar','Radar'], ['ils','ILS'],
  ['server',T('Server / rak','Server / rack')], ['kontrol',T('Ruang kontrol','Control room')],
  ['genset',T('Genset / listrik','Genset / power')], ['gedung',T('Gedung','Building')],
  ['menara',T('Menara ATC','ATC tower')]
];
const ALAT_STATUS = ['Normal','Warning','Down'];
/* Sparepart mengikuti lembar SAP gudang. Satuan hanya saran (SAP menulis UNT,
   PC), bukan batas — yang diketik lain tetap tersimpan apa adanya. */
const PART_SATUAN = ['UNT','PC','SET','ROL','M','L','KG'];
const PART_STATUS = ['NEW','REPAIR'];

/** Tanggal riwayat terakhir satu kode material: jenis 'masuk' atau 'keluar'.
    Tanggal riwayat boleh setengah (YYYY / YYYY-MM) dan urut sebagai teks. */
function partRiwayatTerakhir(unit, pn, jenis){
  const kunci = String(pn || '').toLowerCase();
  let akhir = '';
  for(const r of PART_RIWAYAT[unit] || []){
    if(r[jenis] > 0 && String(r.pn).toLowerCase() === kunci && r.tgl > akhir) akhir = r.tgl;
  }
  return akhir;
}
const tglTerbaru = (a, b) => (a || '') > (b || '') ? a : b;

/** Tanggal barang ditambahkan: yang terbaru antara isian `tambah` dan riwayat
    masuk. Baris lama tanpa keduanya memakai cap kapan barisnya dibuat. */
const partTambah = (p) => {
  if(!p) return '';
  const r = partRiwayatTerakhir(p.unit, p.pn, 'masuk');
  return p.tambah ? tglTerbaru(p.tambah, r) : (r || String(p.dibuat || '').slice(0,10));
};
/** Tanggal barang dipakai: yang terbaru antara isian `pakai` dan riwayat keluar. */
const partPakai = (p) => p ? tglTerbaru(p.pakai, partRiwayatTerakhir(p.unit, p.pn, 'keluar')) : '';

/** '2021' · 'Jul 2021' · '15 Sep 2026' — tanggal riwayat yang boleh setengah. */
const tglRiwayat = (t) => {
  const s = String(t || '');
  if(/^\d{4}$/.test(s)) return s;
  if(/^\d{4}-\d{2}$/.test(s)) return BULAN[BHS][Number(s.slice(5)) - 1] + ' ' + s.slice(0,4);
  return s ? tglRingkas(s) : '—';
};
const partRupiah = (n) => (Number(n) || 0).toLocaleString('id-ID');
const partStatusCip = (s) => !s ? '<span style="color:var(--muted)">—</span>'
  : `<span class="cip ${s === 'NEW' ? 'aman' : s === 'REPAIR' ? 'awas' : ''}">${esc(s)}</span>`;

let dataDibuka = null;   // { jenis, unit, asal } — asal null berarti tambah baru

const alatDaftar = (unit) => PERALATAN[unit] || (PERALATAN[unit] = []);

/**
 * id peralatan dipakai sebagai kunci oleh trouble, sejarah, spek, dan daftar
 * dokumen — jadi harus unik di dalam unitnya dan tidak boleh berubah setelah
 * dibuat. Dirangkai dari namanya supaya masih terbaca saat menengok data
 * mentahnya, dengan angka di belakang kalau bentrok.
 */
function alatIdBaru(unit, nama){
  const pokok = String(nama || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu,'')
    .replace(/[^a-z0-9]+/g,'').slice(0,10) || 'alat';
  const ada = new Set(alatDaftar(unit).map(a=>a.id));
  if(!ada.has(pokok)) return pokok;
  let n = 2; while(ada.has(pokok + n)) n++;
  return pokok + n;
}


/* ---------- Riwayat pemakaian dan pengadaan sparepart ----------

   Panel di bawah daftar sparepart, berkolom lembar "Rekap Pemakaian dan
   Pengadaan Suku Cadang": kapan barang keluar (dipakai, GI) dan kapan masuk
   (ditambahkan, GR). Isinya dari dua jalan: impor lembar rekap, dan kartu Ubah
   sparepart yang mencatat sendiri tiap kali jumlahnya dinaikkan atau
   diturunkan. Terbaru di atas. */
function panelRiwayatPartHtml(unit){
  const semua = (PART_RIWAYAT[unit] || []).map((r, i)=>({ r, i }))
    .sort((a,b)=> (a.r.tgl < b.r.tgl ? 1 : a.r.tgl > b.r.tgl ? -1 : b.i - a.i));
  const bolehHapus = bolehSuntingDb('sparepart') && BOLEH_HAPUS.sparepart;
  const jumlah = (k) => semua.reduce((n, x)=> n + (Number(x.r[k]) || 0), 0);
  return `
    <div class="panel" style="margin-top:18px"><div class="kepala">
      <h3>${T('Riwayat Pemakaian & Pengadaan','Usage & Procurement History')}</h3>
      <span class="ket">${semua.length} ${T('catatan','records')} · ${
        T('keluar','out')} ${jumlah('keluar')} · ${T('masuk','in')} ${jumlah('masuk')}</span></div>
      ${semua.length ? `
      <div class="badan" style="padding-bottom:0">
        <div class="isian" style="max-width:380px;margin-bottom:0">
          <input type="search" data-riwayat-cari aria-label="${T('Cari riwayat','Search history')}" placeholder="${
            T('Cari nama barang, kode material, atau keterangan…','Search item name, material code, or note…')}"
            autocomplete="off" spellcheck="false"></div>
      </div>
      <div class="gulir" style="max-height:460px">
        <table class="tabel-spr"><thead><tr>
          <th style="width:36px;text-align:right">No</th><th>${T('Tanggal','Date')}</th>
          <th>${T('Kode Material','Material Code')}</th><th>${T('Nama Barang','Item Name')}</th>
          <th style="text-align:right">${T('Keluar','Out')}</th><th style="text-align:right">${T('Masuk','In')}</th>
          <th style="text-align:right">${T('Sisa','Left')}</th><th style="text-align:right">IDR</th>
          <th>GI/GR</th><th>${T('Keterangan','Note')}</th><th></th></tr></thead>
        <tbody>${semua.map(({ r }, n)=>`
          <tr data-riwayat-teks="${esc(`${r.pn} ${r.nama} ${r.ket} ${r.kode}`.toLowerCase())}">
            <td class="mono" style="color:var(--muted);text-align:right">${n+1}</td>
            <td class="mono">${esc(tglRiwayat(r.tgl))}</td>
            <td><span class="mono">${esc(r.pn)}</span></td>
            <td>${esc(r.nama)}</td>
            <td class="mono" style="text-align:right;color:${r.keluar ? 'var(--warn)' : 'var(--muted)'}">${r.keluar || '—'}</td>
            <td class="mono" style="text-align:right;color:${r.masuk ? 'var(--ok)' : 'var(--muted)'}">${r.masuk || '—'}</td>
            <td class="mono" style="text-align:right">${r.sisa === '' ? '—' : r.sisa}</td>
            <td class="mono" style="text-align:right">${r.nilai ? partRupiah(r.nilai) : '—'}</td>
            <td>${r.kode ? `<span class="rak-kode">${esc(r.kode)}</span>` : ''}</td>
            <td style="color:var(--muted)">${esc(r.ket)}</td>
            <td style="text-align:right">${bolehHapus
              ? `<button class="btn garis kecil" data-riwayat-hapus="${esc(r.id)}">${T('Hapus','Delete')}</button>` : ''}</td>
          </tr>`).join('')}</tbody></table></div>`
      : `<div class="badan" style="color:var(--muted);font-size:12.5px">${
          T('Belum ada riwayat. Impor lembar Rekap Pemakaian dan Pengadaan lewat “Impor dari berkas”, '
          + 'atau ubah jumlah sebuah sparepart — perubahannya tercatat di sini.',
            'No history yet. Import the Usage and Procurement Recap sheet via “Import from a file”, '
          + 'or change a spare part’s quantity — the change is recorded here.')}</div>`}
    </div>`;
}

el('isiUnit').addEventListener('input', e=>{
  const cari = e.target.closest('[data-riwayat-cari]');
  if(!cari) return;
  const kata = cari.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  cari.closest('.panel').querySelectorAll('tr[data-riwayat-teks]').forEach(tr=>{
    tr.hidden = !kata.every(k=>tr.dataset.riwayatTeks.includes(k));
  });
});

el('isiUnit').addEventListener('click', async e=>{
  const tombol = e.target.closest('[data-riwayat-hapus]');
  if(!tombol) return;
  const unit = unitDibuka;
  const daftar = PART_RIWAYAT[unit] || [];
  const i = daftar.findIndex(r=>r.id === tombol.dataset.riwayatHapus);
  if(i < 0) return;
  const r = daftar[i];
  if(!confirm(T(`Hapus catatan riwayat ${r.nama || r.pn} (${tglRiwayat(r.tgl)})?`,
                `Delete the history record ${r.nama || r.pn} (${tglRiwayat(r.tgl)})?`))) return;
  daftar.splice(i, 1);
  const ok = await dbSimpanUnit('sparepart-riwayat', unit);
  gambarUnit();
  if(ok) pesan(T('Catatan riwayat dihapus.','History record deleted.'));
});
