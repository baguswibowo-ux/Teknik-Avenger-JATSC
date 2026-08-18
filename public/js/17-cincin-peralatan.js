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
    return `<article class="kartu-orbit ${buka?'':'terkunci'}" data-unit="${u.kode}"
              style="animation-delay:${fasa}s">
      <div class="bingkai">
        <span class="lampu ${lampu}"></span>
        ${adegan(u.adegan)}
        ${buka ? '' : `<span class="gembok" title="${
          T('Akun ini tidak berhak membuka unit tersebut','This account may not open that unit')}">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></span>`}
        <span class="tanda-ilus">${T('ILUSTRASI · SLOT FOTO','ILLUSTRATION · PHOTO SLOT')}</span>
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
   kartunya keluar dari bingkai; terlalu kecil dan kartunya saling tindih. */
function aturCincin(){
  const lebar = el('orbit').clientWidth;
  // Lebar 0 berarti beranda sedang tidak tampil. Mengukur di keadaan itu
  // menghasilkan jari-jari asal-asalan yang tidak pernah dibetulkan lagi saat
  // beranda dibuka kembali — jadi lebih baik ditunda sampai ada yang bisa diukur.
  if(!lebar) return;
  const jari = Math.max(210, Math.min(360, lebar * 0.34));
  const langkah = 360/UNIT.length;
  el('cincin').querySelectorAll('.kartu-orbit').forEach((k,i)=>{
    k.style.transform = `rotateY(${i*langkah}deg) translateZ(${jari}px)`;
  });
}
addEventListener('resize', aturCincin);

