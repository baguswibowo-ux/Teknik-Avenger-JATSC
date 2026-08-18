/* =======================================================================
   ILUSTRASI PERALATAN
   Bukan foto: gambar vektor yang dibangkitkan di sini. Tiap adegan memakai
   bingkai dan rasio yang sama dengan slot foto nanti, jadi menukarnya dengan
   <img src="foto-peralatan/…"> tidak menggeser tata letak sama sekali.
   ======================================================================= */
let nomorAdegan = 0;
/* Langit tiap adegan. Subjeknya digambar nyaris hitam, jadi langitnya harus
   cukup terang — kalau tidak, siluetnya menyatu dengan latar dan kartunya
   hanya terlihat seperti kotak gelap, terutama saat diredupkan di sisi jauh
   cincin. Adegan dalam ruangan (server, kontrol) memang gelap; di sana yang
   memberi bentuk adalah lampu indikator dan layarnya. */
const LANGIT = {
  menara:['#16283d','#31536f','#cd7f4e'], antena:['#152740','#33546e','#9c6d5c'],
  ils:['#1a2c40','#38566e','#d08a52'],    radar:['#152742','#2e4c68','#7d92a8'],
  server:['#0a1119','#101a26','#16232f'], kontrol:['#0b131c','#12202c','#1a2c3a'],
  genset:['#1d2732','#2c3a49','#3d4d5f'], gedung:['#101c2c','#26405a','#587090']
};

/** Pesawat — dipakai di adegan langit dan di layar masuk. */
function pesawatSvg(warna){
  return `<g fill="${warna}">
    <path d="M4 9 C4 6.4 8 5.2 22 5.2 L58 5.2 C68 5.2 76 6.6 80 9 C76 11.4 68 12.8 58 12.8 L22 12.8 C8 12.8 4 11.6 4 9 Z"/>
    <path d="M36 9 L20 20 L29 20 L46 10.6 Z"/><path d="M36 9 L22 -2 L31 -2 L47 7.4 Z"/>
    <path d="M9 9 L1 1 L7 1 L20 7.6 Z"/><path d="M9 9 L1 17 L7 17 L20 10.4 Z"/></g>`;
}

function adegan(jenis, opsi){
  const id = 'a' + (++nomorAdegan);
  const [l1,l2,l3] = LANGIT[jenis] || LANGIT.menara;
  const gelap = `url(#s${id})`;
  const isi = {
    /* Menara ATC dengan kabin miring, suar merah, dan pesawat lewat */
    menara:`
      <path d="M0 118 L60 108 L120 116 L190 106 L240 114 L240 140 L0 140 Z" fill="#0c1219" opacity=".85"/>
      <g fill="${gelap}">
        <path d="M104 140 L110 76 L146 76 L152 140 Z"/>
        <path d="M100 76 L107 58 L149 58 L156 76 Z"/>
        <rect x="126" y="26" width="4" height="32"/>
        <path d="M118 26 h20 v3 h-20 z"/>
      </g>
      <path d="M109 74 L114 61 L142 61 L147 74 Z" fill="#ffd08a" opacity=".55"/>
      <circle class="kedip" cx="128" cy="23" r="3" fill="#ff5f5f"/>
      <g transform="translate(24,34) scale(.42)">${pesawatSvg('#0a0f16')}</g>`,
    /* Tiang antena kisi dengan dipole */
    antena:`
      <path d="M0 122 L70 114 L150 120 L240 112 L240 140 L0 140 Z" fill="#0c1219" opacity=".85"/>
      <g stroke="${gelap}" stroke-width="2.6" fill="none" stroke-linecap="round">
        <path d="M104 140 L118 28 M148 140 L134 28"/>
        <path d="M107 116 L145 106 M107 106 L145 116 M110 92 L142 84 M110 84 L142 92
                 M113 70 L139 64 M113 64 L139 70 M116 50 L136 46 M116 46 L136 50"/>
        <path d="M118 34 h16"/>
      </g>
      <g stroke="${gelap}" stroke-width="2.2" stroke-linecap="round">
        <path d="M118 44 L96 40 M134 44 L156 40 M118 62 L94 58 M134 62 L158 58"/>
        <path d="M96 34 v12 M156 34 v12 M94 52 v12 M158 52 v12"/>
      </g>
      <path d="M126 28 L126 16" stroke="${gelap}" stroke-width="2.6"/>
      <circle class="kedip" cx="126" cy="14" r="2.8" fill="#ff5f5f"/>`,
    /* Deret antena localizer di tepi runway, lampu pendekat menyala */
    ils:`
      <path d="M0 104 L240 96 L240 140 L0 140 Z" fill="#1d2b1e" opacity=".8"/>
      <path d="M62 140 L104 100 L140 100 L196 140 Z" fill="#0e141a" opacity=".9"/>
      <path d="M116 140 L122 100 L126 100 L136 140 Z" fill="#e8eef4" opacity=".22"/>
      <g fill="${gelap}">
        <rect x="34" y="88" width="172" height="3"/>
        ${Array.from({length:13},(_,i)=>`<rect x="${38+i*13}" y="72" width="2.6" height="17"/>`).join('')}
        ${Array.from({length:13},(_,i)=>`<rect x="${34+i*13}" y="70" width="11" height="2.4"/>`).join('')}
      </g>
      <g fill="#ffe9b5">${Array.from({length:5},(_,i)=>
        `<circle class="kedip" cx="${104+i*8}" cy="${132-i*7}" r="1.7" style="animation-delay:${i*.16}s"/>`).join('')}</g>
      <g transform="translate(150,26) scale(.34)">${pesawatSvg('#0a0f16')}</g>`,
    /* Radome di atas menara kisi, sapuan radar berputar di dalamnya */
    radar:`
      <path d="M0 120 L80 112 L160 118 L240 110 L240 140 L0 140 Z" fill="#0c1219" opacity=".85"/>
      <g stroke="${gelap}" stroke-width="2.8" fill="none">
        <path d="M100 140 L112 74 M152 140 L140 74"/>
        <path d="M104 118 L148 108 M104 108 L148 118 M108 92 L144 84 M108 84 L144 92"/>
      </g>
      <circle cx="126" cy="52" r="26" fill="${gelap}"/>
      <circle cx="126" cy="52" r="26" fill="none" stroke="#4d6f8a" stroke-width="1.2" opacity=".5"/>
      <g clip-path="circle(24px at 126px 52px)">
        <g class="sapuan" style="transform-origin:126px 52px">
          <path d="M126 52 L126 26 A26 26 0 0 1 148 40 Z" fill="#5ff2c8" opacity=".3"/>
        </g>
      </g>
      <path d="M112 74 h28 v4 h-28 z" fill="${gelap}"/>`,
    /* Ruang server: dua rak dengan deret LED yang berkedip tak serempak */
    server:`
      <rect width="240" height="140" fill="#080d13"/>
      <path d="M0 108 L240 92 L240 140 L0 140 Z" fill="#0d151d"/>
      <g fill="#111c26" stroke="#1c2c3a" stroke-width="1">
        <rect x="30" y="26" width="56" height="92" rx="3"/>
        <rect x="98" y="20" width="60" height="100" rx="3"/>
        <rect x="170" y="30" width="46" height="86" rx="3"/>
      </g>
      ${[[38,34,6],[106,28,7],[178,38,6]].map(([x,y,n],r)=>
        Array.from({length:n},(_,i)=>
          `<g><rect x="${x}" y="${y+i*12}" width="${r===1?44:34}" height="7" rx="1.5" fill="#16232f"/>
             <circle class="kedip" cx="${x+3}" cy="${y+3.5+i*12}" r="1.5" fill="#4ade80" style="animation-delay:${(i*.31+r*.7).toFixed(2)}s"/>
             <circle class="kedip" cx="${x+7}" cy="${y+3.5+i*12}" r="1.5" fill="#38bdf8" style="animation-delay:${(i*.47+r*.4).toFixed(2)}s"/></g>`
        ).join('')).join('')}
      <rect width="240" height="140" fill="url(#k${id})"/>`,
    /* Ruang kontrol: konsol melengkung dengan layar menyala */
    kontrol:`
      <rect width="240" height="140" fill="#08101a"/>
      <g fill="#0f1d29" stroke="#1d3040" stroke-width="1">
        <path d="M18 92 Q120 74 222 92 L222 140 L18 140 Z"/>
      </g>
      ${Array.from({length:5},(_,i)=>{
        const x = 26 + i*42, y = 44 + Math.abs(i-2)*4;
        return `<g><rect x="${x}" y="${y}" width="34" height="24" rx="2.5" fill="#0d2233" stroke="#24455c"/>
          <rect x="${x+2}" y="${y+2}" width="30" height="20" fill="#123449" opacity=".9"/>
          <path d="M${x+4} ${y+18} l6 -7 l5 4 l7 -9 l6 6" stroke="#3ad4b0" stroke-width="1.1" fill="none" opacity=".85"/>
          <circle class="kedip" cx="${x+29}" cy="${y+5}" r="1.4" fill="#ffb300" style="animation-delay:${(i*.53).toFixed(2)}s"/>
          <rect x="${x+6}" y="${y+26}" width="22" height="3" rx="1.5" fill="#16283a"/></g>`;
      }).join('')}
      <rect width="240" height="140" fill="url(#k${id})"/>`,
    /* Rumah genset: blok mesin, cerobong, pipa, garis peringatan */
    genset:`
      <path d="M0 112 L240 104 L240 140 L0 140 Z" fill="#161d24"/>
      <g fill="${gelap}">
        <rect x="34" y="58" width="118" height="54" rx="4"/>
        <rect x="152" y="72" width="30" height="40" rx="3"/>
        <rect x="60" y="30" width="11" height="28"/><path d="M55 26 h21 v5 h-21 z"/>
        <rect x="182" y="80" width="26" height="32" rx="3"/>
      </g>
      <g fill="#2b3742"><rect x="44" y="68" width="98" height="8" rx="2"/>
        <rect x="44" y="82" width="60" height="6" rx="2"/></g>
      <g stroke="#ffb300" stroke-width="4" opacity=".55">
        <path d="M34 108 h118" stroke-dasharray="8 8"/></g>
      <circle class="kedip" cx="146" cy="64" r="2.6" fill="#4ade80"/>
      <g stroke="#3a4855" stroke-width="3" fill="none"><path d="M152 90 h30 M152 100 h30"/></g>`,
    /* Gedung JATSC: siluet bertingkat dengan jendela menyala dan tiang CCTV */
    gedung:`
      <path d="M0 124 L240 116 L240 140 L0 140 Z" fill="#0c1219"/>
      <g fill="${gelap}">
        <path d="M52 140 L52 52 L112 38 L112 140 Z"/>
        <path d="M112 140 L112 62 L172 52 L172 140 Z"/>
        <rect x="172" y="76" width="34" height="64"/>
        <rect x="78" y="18" width="4" height="22"/>
      </g>
      <g fill="#ffd9a0" opacity=".62">
        ${Array.from({length:20},(_,i)=>{
          const c=i%4, r=Math.floor(i/4);
          return `<rect x="${60+c*13}" y="${62+r*13}" width="8" height="8" opacity="${(0.3+((i*7)%10)/12).toFixed(2)}"/>`;
        }).join('')}
        ${Array.from({length:12},(_,i)=>{
          const c=i%3, r=Math.floor(i/3);
          return `<rect x="${122+c*15}" y="${76+r*14}" width="9" height="9" opacity="${(0.25+((i*5)%10)/12).toFixed(2)}"/>`;
        }).join('')}
      </g>
      <circle class="kedip" cx="80" cy="16" r="2.6" fill="#ff5f5f"/>
      <g stroke="${gelap}" stroke-width="2.6" fill="none"><path d="M216 140 L216 84"/></g>
      <path d="M208 80 h16 l-3 7 h-10 z" fill="${gelap}"/>
      <circle class="kedip-cepat" cx="212" cy="83" r="1.5" fill="#4ade80"/>`
  }[jenis] || '';

  return `<svg class="adegan" viewBox="0 0 240 140" preserveAspectRatio="xMidYMid slice"
    role="img" aria-label="Ilustrasi ${jenis}">
    <defs>
      <linearGradient id="l${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${l1}"/><stop offset=".58" stop-color="${l2}"/><stop offset="1" stop-color="${l3}"/>
      </linearGradient>
      <linearGradient id="s${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#0b1016"/><stop offset="1" stop-color="#04070a"/>
      </linearGradient>
      <radialGradient id="k${id}" cx=".5" cy=".42" r=".78">
        <stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".62"/>
      </radialGradient>
    </defs>
    <rect width="240" height="140" fill="url(#l${id})"/>
    ${['server','kontrol'].includes(jenis) ? '' :
      `<circle cx="196" cy="46" r="17" fill="#ffcf8d" opacity=".28"/>
       <circle cx="196" cy="46" r="9" fill="#ffe3b6" opacity=".5"/>`}
    ${isi}
  </svg>`;
}

