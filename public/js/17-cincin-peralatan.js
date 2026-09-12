/* =======================================================================
   KARTU PERALATAN — satu unit di depan, bergantian sendiri

   Dulu berkas ini menaruh kartu melingkar dan menyerahkan putarannya ke
   animasi CSS. Sekarang kartunya tidak melingkar lagi: satu di depan,
   sisanya disingkirkan ke kedalaman dan disembunyikan, dan JS yang memegang
   gilirannya. Alasannya ada di kepala 04-cincin-peralatan.css.

   Giliran berhenti sendiri kalau:
     - kursor sedang di atas panggung (orang sedang membaca kartu itu)
     - tombol Jeda ditekan (kelas `jeda` di #orbit, dipasang 18-ubin-tabel.js)
     - berandanya sedang tidak tampil (tidak ada gunanya bergilir di balik layar)
   ======================================================================= */

/* Indeks unit yang sedang di depan. Sengaja di luar gambarCincin(): berkas ini
   digambar ulang cukup sering — ganti bahasa, foto unit baru, data dari server
   — dan kartu yang sedang dibaca orang tidak boleh melompat balik ke unit
   pertama tiap kali itu terjadi. */
let cincinDepan = 0;
let cincinJam = null;      // setInterval giliran
let cincinTahan = false;   // kursor sedang di atas panggung

const CINCIN_JEDA = 5000;  // lama satu unit memegang layar

function gambarCincin(){
  el('cincin').innerHTML = UNIT.map((u,i)=>{
    const t = TROUBLE.filter(x=>x.unit === u.kode);
    const open = t.filter(x=>x.status === 'Open').length;
    const lampu = open ? 'merah' : t.length ? 'kuning' : 'hijau';
    const cip = open ? `<span class="cip bahaya">${open} open</span>`
              : t.length ? `<span class="cip awas">${t.length} ${T('proses','in progress')}</span>`
              : `<span class="cip aman">normal</span>`;
    const minim = PART.filter(p=>p.unit === u.kode && p.stok < p.min).length;
    const buka = bolehBuka(u.kode);
    /* Gambar pengenal unit — yang dipilih admin di kepala layar Database Unit
       (LOGO, lihat ikonUnitHtml) — dipakai di sini juga, supaya kartunya
       memperlihatkan unit yang sebenarnya, bukan menara karangan. Ilustrasinya
       tetap digambar di bawah foto: kalau berkas fotonya gagal dimuat, img
       melepas dirinya dan ilustrasi yang tampak, bukan bingkai kosong. Tanda
       ILUSTRASI · SLOT FOTO hanya untuk yang belum punya foto.

       Semua kartu SERAGAM: bingkainya tetap 4:3 (230×172), foto maupun
       ilustrasi mengisinya penuh. Foto kamera/HP umumnya 4:3, jadi tidak ada
       yang terpangkas; rasio lain dipangkas tipis di tepi, bukan dibiarkan
       mengubah tinggi kartu — tinggi yang berbeda-beda membuat kartu depan
       bergeser tiap kali gilirannya berganti. */
    const logo = LOGO[u.kode];
    const srcFoto = (logo && logo.berkas)
      ? `/foto/_logo/${esc(logo.berkas)}?v=${esc(String(logo.jam || '').replace(/\D/g, ''))}`
      : '';
    const foto = srcFoto
      ? `<img class="foto-unit" src="${srcFoto}" alt="${esc(u.nama)}" loading="lazy" onerror="this.remove()">`
      : '';
    return `<article class="kartu-orbit ${buka?'':'terkunci'}" data-unit="${u.kode}" data-ke="${i}">
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

  /* Titik giliran digambar ulang bersama kartunya: banyaknya unit bisa berubah
     begitu jawaban E-Logbook datang, dan titik yang tidak menunjuk ke mana-mana
     lebih buruk daripada tidak ada titik sama sekali. */
  el('titikGiliran').innerHTML = UNIT.map((u,i)=>
    `<button data-ke="${i}" aria-label="${T('Tampilkan','Show')} ${esc(u.nama)}"></button>`).join('');
  el('titikGiliran').querySelectorAll('button').forEach(b=>
    b.addEventListener('click', ()=>cincinKe(+b.dataset.ke)));

  el('cincin').querySelectorAll('.kartu-orbit').forEach(k=>{
    /* Penahan giliran menempel di KARTUNYA, bukan di panggung. Panggung itu
       selebar layar dan setinggi 344px, sedangkan kartunya 230px di tengah —
       penahan di panggung berarti kursor yang diam jauh dari kartu pun ikut
       menghentikan giliran, tanpa ada yang terlihat sebagai sebabnya. Kartu
       yang belum giliran tidak ikut menahan: pointer-events-nya sudah dilepas
       di CSS, jadi hanya kartu depan yang benar-benar menerima ini. */
    k.addEventListener('pointerenter', ()=>{ cincinTahan = true; });
    k.addEventListener('pointerleave', ()=>{
      cincinTahan = false;
      // Hitung ulang dari nol. Kalau tidak, sisa detak yang tadi terlewat
      // membuat kartunya berganti pada jarak yang tidak bisa ditebak — kadang
      // langsung, kadang lima detik lagi.
      cincinJalan();
    });
    k.addEventListener('click', ()=>{
      const kode = k.dataset.unit;
      if(!bolehBuka(kode)){ pesan(T('Akun '+akun.user+' tidak berhak membuka unit '+namaUnit(kode)+'.',
    'Account '+akun.user+' may not open the '+namaUnit(kode)+' unit.')); return; }
      bukaUnit(kode);
    });
  });

  aturCincin();
  cincinJalan();
}

/**
 * Menaruh tiap kartu menurut jaraknya dari yang sedang di depan.
 *
 * Namanya tetap aturCincin() karena pemanggilnya ada di tempat lain
 * (pindahLayar di 16-jam-navigasi.js, dan resize di bawah) — dan pekerjaannya
 * masih sama: menghitung ulang letak kartu. Yang berubah cuma letaknya.
 */
function aturCincin(){
  const n = UNIT.length;
  if(!n) return;
  cincinDepan = ((cincinDepan % n) + n) % n;
  el('cincin').querySelectorAll('.kartu-orbit').forEach((k,i)=>{
    const depan = i === cincinDepan;
    k.dataset.sembunyi = depan ? '0' : '1';
    k.style.zIndex = depan ? 3 : 1;
    /* Kartu yang sudah lewat mundur ke bawah, yang belum giliran menunggu di
       atas — arah yang berbeda supaya pergantiannya terbaca sebagai maju,
       bukan sekadar timbul-tenggelam di tempat yang sama. */
    const lewat = i < cincinDepan;
    k.style.transform = depan
      ? 'translateZ(60px) scale(1.06)'
      : `translateZ(-220px) translateY(${lewat ? 26 : -26}px) scale(.86)`;
  });
  el('titikGiliran').querySelectorAll('button').forEach((b,i)=>
    b.setAttribute('aria-current', i === cincinDepan ? 'true' : 'false'));
  el('namaDepan').textContent = UNIT[cincinDepan] ? UNIT[cincinDepan].nama : '';
}

/** Pindah ke unit tertentu, lalu hitung ulang jedanya dari nol — kalau tidak,
    unit yang baru saja dipilih orang bisa langsung berganti setengah detik
    kemudian karena giliran sebelumnya sudah hampir habis. */
function cincinKe(i){
  cincinDepan = i;
  aturCincin();
  cincinJalan();
}

function cincinJalan(){
  clearInterval(cincinJam);
  cincinJam = setInterval(()=>{
    if(cincinTahan) return;
    if(el('orbit').classList.contains('jeda')) return;
    // offsetParent null = berandanya sedang tidak tampil.
    if(!el('orbit').offsetParent) return;
    cincinDepan++;
    aturCincin();
  }, CINCIN_JEDA);
}

el('btnMundur').addEventListener('click', ()=>cincinKe(cincinDepan - 1));
el('btnMaju').addEventListener('click',   ()=>cincinKe(cincinDepan + 1));

addEventListener('resize', aturCincin);
