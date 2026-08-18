/* =======================================================================
   UBIN DAN TABEL UMUM
   ======================================================================= */
const ubin = (w,label,angka,sub)=>`<div class="ubin ${w}">
  <span class="label">${label}</span><div class="angka">${angka}</div><div class="sub">${sub}</div></div>`;

function gambarUbin(){
  const open = TROUBLE.filter(t=>t.status === 'Open').length;
  const proses = TROUBLE.filter(t=>t.status === 'Proses').length;
  const tua = TROUBLE.filter(t=>umurHari(t.tgl) > 14).length;
  const minim = PART.filter(p=>p.stok < p.min).length;
  const orang = UNIT.reduce((n,u)=>n + dinasUnit(u.kode).reduce((m,x)=>m+x.o.length,0), 0);
  const berkala = bklJatuhTempo().filter(x=>x.sisa <= 0).length;
  const lisensi = sertPerhatian().length;

  el('ubin').innerHTML =
    ubin('merah',T('Trouble Open','Open Trouble'),open,T('belum ditangani','not yet handled')) +
    ubin('kuning',T('Sedang Proses','In Progress'),proses,T('sudah ada penanganan','work has started')) +
    ubin('kuning',T('Lewat 14 Hari','Past 14 Days'),tua,T('menggantung terlalu lama','hanging too long')) +
    ubin('biru',T('Personel Dinas','Personnel On Duty'),orang,T('di seluruh unit hari ini','across all units today')) +
    ubin(minim?'merah':'hijau',T('Sparepart Minim','Low Spare Parts'),minim,T('stok di bawah batas','stock below minimum')) +
    ubin(berkala?'merah':'hijau',T('Kegiatan Jatuh Tempo','Jobs Due'),berkala,
      T('mingguan dan bulanan belum dikerjakan','weekly and monthly not yet done')) +
    ubin(lisensi?'kuning':'hijau',T('Lisensi Perlu Diurus','Licences To Renew'),lisensi,
      T('habis dalam 2 bulan atau sudah lewat','expiring within 2 months, or already past'));

  el('ubinTrouble').innerHTML =
    ubin('merah',T('Open','Open'),open,T('belum ditangani','not yet handled')) +
    ubin('kuning',T('Proses','In Progress'),proses,T('sudah dikerjakan','being worked on')) +
    ubin('kuning',T('Lewat 14 Hari','Past 14 Days'),tua,T('perlu didorong','needs a push')) +
    ubin('biru',T('Unit Terdampak','Units Affected'),new Set(TROUBLE.map(t=>t.unit)).size,
      T('dari '+UNIT.length+' unit','of '+UNIT.length+' units'));

  el('lencanaTrouble').textContent = open + proses;
}

function barisTrouble(t, tanpaUnit){
  const h = umurHari(t.tgl);
  const warna = h>14 ? 'var(--fail)' : h>7 ? 'var(--warn)' : 'var(--accent)';
  return `<tr>
    ${tanpaUnit ? '' : `<td><span class="mono" style="color:var(--accent)">${esc(namaUnit(t.unit))}</span><br>
        <span class="mono" style="color:var(--muted);font-size:10.5px">${esc(t.jenis)}</span></td>`}
    <td>${esc(t.ket)}<br><span class="mono" style="color:var(--muted);font-size:10.5px">${esc(t.lokasi)} · ${esc(t.pic)}</span></td>
    <td><span class="tag ${t.status.toLowerCase()}">${esc(t.status)}</span></td>
    <td><div class="umur"><span class="batang"><i style="width:${Math.min(100,h/21*100)}%;background:${warna}"></i></span>
        <span class="mono" style="color:${warna}">${h} ${T('hr','d')}</span></div>
        <span class="mono" style="color:var(--muted);font-size:10px">${tglRingkas(t.tgl)}</span></td>
  </tr>`;
}
/* Dulu kolom Unit dipotong dengan .replace() pada teks kepalanya. Begitu
   kepalanya bisa berbahasa Inggris, potongan yang dicari tidak ada lagi dan
   kolomnya diam-diam ikut tercetak — jadi sekarang dinyatakan lewat argumen. */
const kepalaTrouble = (tanpaUnit) => `<thead><tr>${
  tanpaUnit ? '' : `<th>${T('Unit / Peralatan','Unit / Equipment')}</th>`}
  <th>${T('Uraian','Description')}</th><th>${T('Status','Status')}</th><th>${T('Umur','Age')}</th></tr></thead>`;

function gambarTrouble(){
  const urut = [...TROUBLE].sort((a,b)=>umurHari(b.tgl)-umurHari(a.tgl));
  el('tblTrouble').innerHTML = kepalaTrouble() + `<tbody>${urut.map(t=>barisTrouble(t)).join('')}</tbody>`;

  // Versi beranda bukan tabel melainkan pita berjalan. Tabel tidak bisa
  // digandakan mulus untuk perulangan — barisnya terikat pada satu <tbody>,
  // dan tinggi barisnya ikut menyesuaikan isi kolom, jadi titik sambungnya
  // tidak pernah pas. Daftar kartu bisa.
  const kartu = urut.map(t=>{
    const h = umurHari(t.tgl);
    const w = h>14 ? 'var(--fail)' : h>7 ? 'var(--warn)' : 'var(--accent)';
    return `<article class="trouble-baris ${t.status.toLowerCase()}" data-unit="${t.unit}"
              title="${T('Buka database unit','Open the unit database for')} ${esc(namaUnit(t.unit))}">
      <span class="pita-status"></span>
      <div class="atas">
        <span class="unit">${esc(namaUnit(t.unit))} · ${esc(t.jenis)}</span>
        <span class="tag ${t.status.toLowerCase()}">${esc(t.status)}</span>
      </div>
      <div class="ket-isi">${esc(t.ket)}</div>
      <div class="bawah">
        <span class="jejak">${esc(t.lokasi)} · ${esc(t.pic)} · ${T('sejak','since')} ${tglRingkas(t.tgl)}</span>
        <span class="lencana-umur" style="color:${w}">${h} ${T('hari','days')}</span>
      </div>
    </article>`;
  }).join('');

  isiTiker('tikerTrouble', kartu, urut.length * 2.7);
}

/* Pendengar dipasang sekali di sini, bukan di dalam gambarTrouble. Kotak
   pitanya tidak ikut diganti saat isinya digambar ulang, jadi memasangnya di
   sana akan menumpuk satu pendengar tiap kali ada yang masuk kembali. */
el('tikerTrouble').addEventListener('click', e=>{
  const b = e.target.closest('.trouble-baris'); if(!b) return;
  const kode = b.dataset.unit;
  if(!bolehBuka(kode)){ pesan(T('Akun '+akun.user+' tidak berhak membuka unit '+namaUnit(kode)+'.',
    'Account '+akun.user+' may not open the '+namaUnit(kode)+' unit.')); return; }
  bukaUnit(kode);
});

// Tombol jeda tiap pita
document.querySelectorAll('[data-jeda]').forEach(b=>{
  b.addEventListener('click', ()=>{
    const kotak = el(b.dataset.jeda);
    kotak.classList.toggle('jeda');
    b.textContent = kotak.classList.contains('jeda') ? T('Jalankan','Resume') : T('Jeda','Pause');
  });
});

/** Isi satu pita dengan daftarnya dicetak dua kali, lalu samakan lama satu
    putaran dengan banyaknya isi supaya kecepatannya tetap sama di mana pun. */
function isiTiker(idKotak, isi, detik){
  el(idKotak).innerHTML = `<div class="jalur" style="animation-duration:${detik.toFixed(1)}s"
    >${isi}${isi}</div>`;
}

