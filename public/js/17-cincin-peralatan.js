/* =======================================================================
   CINCIN PERALATAN — putarannya animasi CSS, JS hanya menaruh kartunya
   ======================================================================= */
function gambarCincin(){
  const n = UNIT.length, langkah = 360/n, durasi = 36;
  el('cincin').innerHTML = UNIT.map((u,i)=>{
    const t = TROUBLE.filter(x=>x.unit === u.kode);
    const open = t.filter(x=>x.status === 'Open').length;
    const lampu = open ? 'merah' : t.length ? 'kuning' : 'hijau';
    const cip = open ? `<span class="cip bahaya">${open} open</span>`
              : t.length ? `<span class="cip awas">${t.length} ${T('proses','in progress')}</span>`
              : `<span class="cip aman">normal</span>`;
    const minim = PART.filter(p=>p.unit === u.kode && p.stok < p.min).length;
    const buka = bolehBuka(u.kode);
    // Kartu i berada tepat di depan pada detik ke i*(durasi/n); geser fasa
    // sorotnya ke sana supaya redup-terangnya cocok dengan posisi sebenarnya.
    const fasa = (i*durasi/n - durasi).toFixed(2);
    /* Gambar pengenal unit — yang dipilih admin di kepala layar Database Unit
       (LOGO, lihat ikonUnitHtml) — dipakai di sini juga, supaya kartu orbit
       memperlihatkan unit yang sebenarnya, bukan menara karangan. Ilustrasinya
       tetap digambar di bawah foto: kalau berkas fotonya gagal dimuat, img
       melepas dirinya dan ilustrasi yang tampak, bukan bingkai kosong. Tanda
       ILUSTRASI · SLOT FOTO hanya untuk yang belum punya foto.

       Semua kartu SERAGAM: bingkainya tetap 4:3 (230×172), foto maupun
       ilustrasi mengisinya penuh. Foto kamera/HP umumnya 4:3, jadi tidak ada
       yang terpangkas; rasio lain dipangkas tipis di tepi, bukan dibiarkan
       mengubah tinggi kartu — tinggi yang berbeda-beda membuat cincin
       bergeser dan kartu terpangkas panggung saat di depan. */
    const logo = LOGO[u.kode];
    const srcFoto = (logo && logo.berkas)
      ? `/foto/_logo/${esc(logo.berkas)}?v=${esc(String(logo.jam || '').replace(/\D/g, ''))}`
      : '';
    const foto = srcFoto
      ? `<img class="foto-unit" src="${srcFoto}" alt="${esc(u.nama)}" loading="lazy" onerror="this.remove()">`
      : '';
    return `<article class="kartu-orbit ${buka?'':'terkunci'}" data-unit="${u.kode}"
              style="animation-delay:${fasa}s">
      <div class="bingkai">
        <span class="lampu ${lampu}"></span>
        ${adegan(u.adegan)}${foto}
        ${buka ? '' : `<span class="gembok" title="${
          T('Akun ini tidak berhak membuka unit tersebut','This account may not open that unit')}">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></span>`}
        ${foto ? '' : `<span class="tanda-ilus">${T('ILUSTRASI · SLOT FOTO','ILLUSTRATION · PHOTO SLOT')}</span>`}
      </div>
      <div class="isi">
        <div class="nama">${esc(u.nama)}</div>
        <div class="alat">${esc(u.alat)}</div>
        <div class="kaki">${cip}${minim?`<span class="cip awas">${minim} ${
          T('part minim','parts low')}</span>`:''}</div>
      </div>
    </article>`;
  }).join('');

  aturCincin();
  el('cincin').querySelectorAll('.kartu-orbit').forEach(k=>{
    k.addEventListener('click', ()=>{
      const kode = k.dataset.unit;
      if(!bolehBuka(kode)){ pesan(T('Akun '+akun.user+' tidak berhak membuka unit '+namaUnit(kode)+'.',
    'Account '+akun.user+' may not open the '+namaUnit(kode)+' unit.')); return; }
      bukaUnit(kode);
    });
  });
}

/* Jari-jari cincin mengikuti lebar layar. Terlalu besar di layar sempit dan
   kartunya keluar dari bingkai; terlalu kecil dan kartunya saling tindih.

   Batas atasnya 300px, dan itu terikat dengan perspective 2000px di CSS:
   kartu paling depan tampak diperbesar perspective/(perspective − jari), jadi
   paling besar 2000/1700 ≈ 1,18× dan paling kecil (jari 210) ≈ 1,12×. Tinggi
   panggung .orbit dihitung dari angka 1,18 itu supaya kartu depan tidak
   pernah terpangkas. Dulu jari sampai 360 dengan perspective 1150 → 1,46×,
   dan di layar lebar kaki kartu depan hilang di bawah panggung. */
function aturCincin(){
  const lebar = el('orbit').clientWidth;
  // Lebar 0 berarti beranda sedang tidak tampil. Mengukur di keadaan itu
  // menghasilkan jari-jari asal-asalan yang tidak pernah dibetulkan lagi saat
  // beranda dibuka kembali — jadi lebih baik ditunda sampai ada yang bisa diukur.
  if(!lebar) return;
  const jari = Math.max(210, Math.min(300, lebar * 0.34));
  const langkah = 360/UNIT.length;
  el('cincin').querySelectorAll('.kartu-orbit').forEach((k,i)=>{
    k.style.transform = `rotateY(${i*langkah}deg) translateZ(${jari}px)`;
  });
}
addEventListener('resize', aturCincin);

