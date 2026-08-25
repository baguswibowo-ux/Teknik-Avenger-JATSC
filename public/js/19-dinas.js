/* =======================================================================
   DINAS
   ======================================================================= */
/** Kode yang benar-benar terisi orang pada petak hari ini. Inilah yang
    menentukan apakah malam berangkat pukul 12:00 atau 13:00. */
const kodeTerpakai = (petak) => petak.filter(s=>s.o.length).map(s=>s.k);

function kartuShift(s, kodeHari){
  const jam = jamShift(s.k, kodeHari);
  const warna = warnaShift(s.k);
  const info = SHIFT[s.k] || {};
  const libur = !!info.libur;
  /* Tanpa berdinas — kartu tetap muncul supaya manajer melihat siapa yang cuti,
     tetapi 'SEDANG DINAS' dan jam kerja disembunyikan: keduanya tidak berlaku
     untuk hari libur, dan menampilkan '00:00–00:00' hanya membingungkan. */
  const sedang = !libur && sedangShift(jam);
  const nama = info.nama || '';
  return `<div class="dinas-kartu${libur?' dinas-libur':''}">
    <span class="pita-sisi" style="background:${warna}"></span>
    ${sedang && s.o.length ? `<span class="sedang-dinas">${T('SEDANG DINAS','ON DUTY NOW')}</span>` : ''}
    <div class="kode" style="color:${warna}" title="${esc(nama)}">${esc(s.k)}</div>
    ${libur
      ? `<div class="jam-shift"><span class="jam-lokal">${esc(nama)}</span></div>`
      : `<div class="jam-shift">${labelUtc(jam)}<br><span class="jam-lokal">${labelWib(jam)}</span></div>`}
    ${s.o.length ? s.o.map(o=>`<div class="orang">
        <span class="avatar" style="color:${warna}">${inisial(o.n)}</span>
        <span><span class="nm">${esc(o.n)}</span><br><span class="pr">${esc(o.p)}</span></span>
      </div>`).join('')
      : `<div class="orang"><span class="avatar">—</span><span class="pr">${
          T('tidak ada personel','no personnel')}</span></div>`}
  </div>`;
}

function gambarDinas(){
  const tgl = HARI_INI.toLocaleDateString(LOKAL(),{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  el('ketTanggal').textContent = tgl;
  el('ketTanggal2').textContent = tgl + T(' — seluruh unit, terlihat oleh semua akun.',
                                          ' — all units, visible to every account.');

  // Pita beranda memuat seluruh personel yang berdinas hari ini, lintas unit,
  // dengan yang sedang bertugas jam ini didahulukan. Sempat hanya menampilkan
  // yang sedang bertugas — dan pada jam pergantian panelnya kosong melompong.
  const semua = [];
  const petakUnit = new Map();
  UNIT.forEach(u=>{
    const petak = dinasUnit(u.kode);
    const kodeHari = kodeTerpakai(petak);
    petakUnit.set(u.kode, { petak, kodeHari });
    petak.forEach(s=>{
      const jam = jamShift(s.k, kodeHari);
      const sedang = sedangShift(jam);
      s.o.forEach(o=>semua.push({...o, unit:u.kode, k:s.k, jam, sedang}));
    });
  });
  semua.sort((a,b)=>(b.sedang - a.sedang) || (a.jam.mulai - b.jam.mulai));

  const kartuOrang = semua.map(o=>{
    const w = warnaShift(o.k);
    /* Kode tak-berdinas (CUTI/CAP/IJIN) tidak punya jam — labelnya nama kode
       saja, dan status kanannya bukan "BELUM/SUDAH" melainkan "TIDAK BERDINAS"
       supaya tidak dibaca sebagai giliran yang belum sampai. */
    const libur = !!(SHIFT[o.k] && SHIFT[o.k].libur);
    const namaKode = (SHIFT[o.k] && SHIFT[o.k].nama) || o.k;
    return `<article class="kartu-orang" style="--w:${w}">
      <span class="av3d">${inisial(o.n)}</span>
      <span class="teks"><span class="nm">${esc(o.n)}</span>
        <span class="pr">${esc(namaUnit(o.unit))} · ${esc(o.p)}</span></span>
      <span class="kanan">
        <span class="jam-kecil">${libur
          ? esc(namaKode)
          : `${T('dinas','shift')} ${esc(o.k)} · ${labelUtc(o.jam)}`}</span>
        <span class="nyala ${o.sedang?'':'diam'}">${libur
          ? T('TIDAK BERDINAS','OFF DUTY')
          : (o.sedang ? T('SEDANG DINAS','ON DUTY NOW') : T('BELUM/SUDAH','BEFORE/AFTER'))}</span>
      </span>
    </article>`;
  }).join('');
  isiTiker('tikerDinas', kartuOrang, semua.length * 2.1);

  // Penuh: dikelompokkan per unit
  el('dinasPenuh').innerHTML = UNIT.map(u=>{
    const { petak, kodeHari } = petakUnit.get(u.kode);
    return `<div style="margin-bottom:20px">
      <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:10px">
        <h3 style="font-size:14px">${esc(u.nama)}</h3>
        <span class="mono" style="font-size:10.5px;color:var(--muted)">${
          T('kode dinas','shift codes')}: ${petak.map(s=>s.k).join(' · ')}</span>
      </div>
      <div class="dinas-baris">${petak.map(s=>kartuShift(s, kodeHari)).join('')}</div>
    </div>`;
  }).join('');

  /* Pita cakupan memakai kode polos, bukan PSJ/PSN/MJ/MN — lihat catatan
     `pita` di SHIFT. Yang digambar hanya pita yang benar-benar ada di petak
     hari ini: unit yang sepanjang bulan cuma memakai PS dan malam tidak perlu
     membawa dua pita P dan S yang tidak mewakili siapa pun. Kalau belum ada
     satu jadwal pun yang terbaca, PS dan M dipasang sebagai bentuk bakunya. */
  const pitaDipakai = new Set();
  petakUnit.forEach(({ petak })=>petak.forEach(s=>{
    /* Kode tanpa pita (CUTI/CAP/IJIN) sengaja diabaikan — orang cuti tidak
       mengisi jam cakupan, jadi tidak ada blok yang perlu digambar untuknya. */
    const p = SHIFT[s.k] && SHIFT[s.k].pita;
    if(p) pitaDipakai.add(p);
  }));
  const pita = URUT_PITA.filter(k=>pitaDipakai.has(k));
  const blok = (pita.length ? pita : ['PS','M']).map(k=>{
    const j = SHIFT[k];
    const kiri = j.mulai/24*100, lebar = (j.sampai - j.mulai)/24*100;
    return `<span class="blok-shift" style="left:${kiri}%;width:${Math.min(lebar,100-kiri)}%;
      background:${j.warna};opacity:.22;color:var(--text)">${k}</span>`;
  }).join('');
  const n = new Date();
  el('pitaJam').innerHTML = blok +
    `<span class="sekarang" style="left:${((n.getUTCHours()*60+n.getUTCMinutes())/1440*100).toFixed(2)}%"></span>`;
  el('skalaJam').innerHTML = [0,4,8,12,16,20,24].map(h=>`<span>${jamPad(h)}</span>`).join('');
}

