/* =======================================================================
   DOKUMEN UNIT

   Dulu berkasnya tidak dikirim ke mana pun: yang disimpan cuma object URL di
   memori tab, jadi menyegarkan halaman mengosongkan seluruh daftarnya. Itu
   memang disengaja selama belum ada keputusan berkasnya mau ditaruh di mana.
   Sekarang ada, dan berkasnya tersimpan di server dashboard ini —
   data/dokumen/, di luar public/, hanya bisa diambil setelah masuk. Lihat blok
   DOKUMEN UNIT di server.js.

   Berkas yang masuk diunggah ke server, tinggal di sana, dan kembali sendiri
   waktu halaman dibuka lagi. Dulu ada jalan kedua di sebelahnya — object URL
   di memori tab, untuk data contoh — dan barisnya ditandai .lokal. Data
   contohnya sudah dibuang, jadi jalan itu ikut pergi: sekarang tiap baris di
   daftar ini benar-benar ada di server.

   Berkas yang masuk lewat layar ini tetap tidak pernah sampai ke E-Logbook —
   bukan ke basis datanya, bukan ke uploads/ miliknya, bukan pula ke servernya.
   ======================================================================= */
const BERKAS = {};                       // kode unit -> array berkas, terbaru di atas
const BRK_BATAS = 25 * 1024 * 1024;      // 25 MB; sama dengan batas di server

/** Kenapa berkas tidak bisa diunggah, dalam satu kalimat — atau '' kalau bisa.
    Diperiksa di layar supaya penolakannya datang sebelum berkasnya terlanjur
    dibaca jadi base64; yang menolak sungguhan tetap server. */
function dokSebabTolak(){
  if(!KEMAMPUAN.dokumenTulis){
    return T('Menyimpan dokumen dimatikan di lingkungan ini — penyimpanannya tidak permanen.',
             'Saving documents is off in this environment — its storage is not permanent.');
  }
  if(!bolehSuntingDb('dokumen')){
    return bolehBuka(unitDibuka)
      ? T('Peran akun Anda tidak diberi hak mengisi dokumen unit.',
          'Your role is not granted the right to fill in unit documents.')
      : T('Akun Anda tidak memegang unit ini, jadi dokumennya tidak bisa Anda isi.',
          'Your account does not hold this unit, so you cannot fill in its documents.');
  }
  return '';
}

/** Minta izin unggah langsung. Jawabannya menentukan jalan mana yang dipakai. */
async function dokSiap(unit, f){
  const r = await srvFetch('/dokumen/' + encodeURIComponent(unit) + '/siap', {
    method:'POST', headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ nama:f.name, ukuran:f.size })
  }, 15000);
  const j = await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(j.error || 'server menjawab ' + r.status);
  return j;
}

/**
 * Unggah satu berkas ke server.
 *
 * Ada dua jalan, dan yang dipakai ditentukan server — bukan ditebak di sini
 * dari alamat halaman. Kalau '/siap' menjawab { langsung:true }, berkasnya
 * pergi langsung ke simpanan tanpa melewati server sama sekali; itu satu-satunya
 * cara melewati batas 4.500.000 byte yang Vercel pasang pada badan permintaan,
 * dan tanpanya janji 25 MB di layar mustahil ditepati. Kalau ia menjawab
 * { langsung:false } — begitulah di kantor — berkasnya dikirim base64 seperti
 * dulu, yang di sana memang tidak berbatas.
 *
 * Batas waktunya panjang: 25 MB lewat jaringan kantor bisa memakan lebih dari
 * delapan detik yang jadi bawaan srvFetch.
 */
async function dokKirim(unit, f, kategori, alat){
  const siap = await dokSiap(unit, f);

  if(siap && siap.langsung){
    // Sengaja fetch polos, bukan srvFetch: berkas 25 MB lewat jaringan lambat
    // bisa melampaui batas waktu apa pun yang pantas dipasang untuk API biasa.
    const taruh = await fetch(siap.url, {
      method:'PUT',
      headers:{ 'Content-Type': f.type || 'application/octet-stream' },
      body: f
    });
    if(!taruh.ok) throw new Error('gagal menaruh berkas di simpanan (' + taruh.status + ')');

    const r = await srvFetch('/dokumen/' + encodeURIComponent(unit) + '/catat', {
      method:'POST', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ id:siap.id, nama:f.name, jenis:f.type || '', kategori, alat })
    }, 30000);
    const j = await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(j.error || 'server menjawab ' + r.status);
    return j.baris;
  }

  const isi = await berkasBase64(f);
  const r = await srvFetch('/dokumen/' + encodeURIComponent(unit), {
    method:'POST', headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ nama:f.name, jenis:f.type || '', kategori, alat, isi })
  }, 120000);
  const j = await r.json().catch(()=>({}));
  // 413 dari Vercel berbadan teks biasa, jadi j.error kosong dan pesannya akan
  // jatuh jadi "server menjawab 413" — angka telanjang yang tidak memberi tahu
  // pemakai apa pun tentang apa yang harus ia lakukan.
  if(r.status === 413 && !j.error){
    throw new Error(T('terlalu besar untuk dikirim lewat jalur ini',
                      'too large for this upload path'));
  }
  if(!r.ok) throw new Error(j.error || 'server menjawab ' + r.status);
  return j.baris;
}

/** Ambil daftar dokumen seluruh unit dari server. Kegagalannya tidak
    menjatuhkan apa pun — tabnya cuma kosong, sama seperti sebelum ada isinya. */
async function dokMuat(){
  try{
    const r = await srvFetch('/dokumen', {}, 10000);
    if(!r.ok) throw new Error('server menjawab ' + r.status);
    const j = await r.json();
    Object.keys(BERKAS).forEach(k=>delete BERKAS[k]);
    Object.entries(j.dokumen || {}).forEach(([unit, daftar])=>{
      BERKAS[unit] = (Array.isArray(daftar) ? daftar : []).map(b=>({
        ...b,
        // Satu-satunya yang dirangkai di sini: jalan mengambil berkasnya.
        // Servernya yang menjaga, bukan tautan ini — tanpa sesi, 401.
        url: '/dokumen/' + encodeURIComponent(unit) + '/' + encodeURIComponent(b.id)
      }));
    });
    if(typeof j.bisaTulis === 'boolean') KEMAMPUAN.dokumenTulis = j.bisaTulis;
  }catch(e){
    console.warn('Daftar dokumen tidak terbaca dari server:', e && e.message || e);
  }
}

/* Nilainya tetap Indonesia — itu yang tersimpan di tiap baris berkas, dan
   mengubahnya saat bahasa berganti akan membuat baris lama tidak cocok dengan
   pilihan mana pun di daftarnya. Yang diterjemahkan cuma yang terbaca. */
const BRK_KATEGORI = ['SOP','Manual','Topologi','Block Diagram','Sertifikat','Berita Acara','Foto','Lainnya'];
const BRK_KATEGORI_EN = { 'SOP':'SOP', 'Manual':'Manual',
  'Topologi':'Topology', 'Block Diagram':'Block Diagram',
  'Sertifikat':'Certificate',
  'Berita Acara':'Handover Record', 'Foto':'Photo', 'Lainnya':'Other' };
const brkKategoriNama = (k) => BHS === 'en' ? (BRK_KATEGORI_EN[k] || k) : k;

const brkUkuran = (b) => b < 1024 ? b + ' B'
  : b < 1048576 ? (b/1024).toFixed(b < 10240 ? 1 : 0) + ' KB'
  : (b/1048576).toFixed(b < 10485760 ? 1 : 0) + ' MB';

const brkEkstensi = (nama) => {
  const t = nama.lastIndexOf('.');
  return t > 0 ? nama.slice(t+1).toUpperCase().slice(0,4) : 'BIN';
};

/* MIME Office panjangnya 70 karakter lebih. Dicetak apa adanya, satu baris
   .docx melebarkan kolom Berkas sampai menghimpit lima kolom sisanya. */
const BRK_JENIS = {
  'application/pdf':'Dokumen PDF', 'application/zip':'Arsip ZIP',
  'application/msword':'Dokumen Word', 'application/vnd.ms-excel':'Lembar Excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'Dokumen Word',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'Lembar Excel',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':'Salindia PowerPoint',
  'text/plain':'Teks', 'text/csv':'Tabel CSV'
};
const brkJenis = (jenis) => {
  if(!jenis) return 'jenis tidak dikenal';
  if(BRK_JENIS[jenis]) return BRK_JENIS[jenis];
  if(jenis.startsWith('image/')) return 'Gambar ' + jenis.slice(6).toUpperCase();
  if(jenis.startsWith('video/')) return 'Video ' + jenis.slice(6).toUpperCase();
  const sub = jenis.split('/')[1] || jenis;
  return sub.length > 22 ? sub.slice(0,21) + '…' : sub;
};

/* Tebakan kategori dari nama berkas. Sengaja hanya tebakan: hasilnya selalu
   bisa diganti lewat kolom Kategori di barisnya, karena penamaan berkas di
   tiap unit tidak seragam. */
function brkTebakKategori(nama, jenis){
  if(jenis.startsWith('image/')) return 'Foto';
  const n = nama.toLowerCase();
  /* SOP diperiksa sebelum Manual, dan bukan sekadar urutan: berkas prosedur
     hampir selalu bernama "SOP ... Manual Operasi", jadi yang diperiksa
     belakangan tidak akan pernah kebagian. "sop" dibatasi tepi kata supaya
     nama seperti "gudang-sopir.pdf" tidak ikut tertarik ke sini. */
  if(/(^|[^a-z])sop([^a-z]|$)|standar.?operasi|standard.?operating|prosedur|procedure|instruksi.?kerja/.test(n))
    return 'SOP';
  if(/manual|handbook|panduan|instruction/.test(n))           return 'Manual';
  /* Diperiksa sebelum "diagram" umum agar "block diagram" tidak jatuh ke tebakan
     yang lebih longgar. Nama gambar teknis biasanya "block-diagram-...", "bd_...",
     "diagram-blok...", atau kombinasi "skematik/skema". */
  if(/block.?diagram|diagram.?blok|(^|[^a-z])bd[-_ ]|skema(tik)?|schematic/.test(n))
    return 'Block Diagram';
  if(/topologi|topology|jaringan|network.?diagram/.test(n))    return 'Topologi';
  if(/sertifik|certificate|kalibrasi|calib/.test(n))          return 'Sertifikat';
  if(/berita.?acara|\bba[-_ ]|laporan|report/.test(n))         return 'Berita Acara';
  return 'Lainnya';
}

/* Saringan rak dokumen.

   Rak yang tersimpan di server tidak berhenti tumbuh: SOP, manual, sertifikat
   kalibrasi, dan berita acara satu unit menumpuk bertahun-tahun di satu tabel
   yang urutannya cuma "terbaru di atas". Yang dicari orang hampir selalu satu
   jenis — "mana SOP-nya", "mana manual alat ini" — dan tanpa saringan
   pencariannya dimulai dengan menggulir.

   Kategorinya sudah ada sejak awal di tiap baris, ditebak dari nama berkas dan
   bisa diganti lewat kolomnya. Yang belum ada cuma cara membacanya balik, dan
   itu yang ditambahkan di sini. Tidak ada bentuk data baru.

   Disimpan di luar gambarBerkas() supaya pilihan saringan tidak hilang tiap
   kali daftarnya digambar ulang — dan digambar ulang terjadi tiap satu berkas
   selesai diunggah. */
const BRK_SARING = { kat:'', alat:'', cari:'' };

const brkDaftar = () => BERKAS[unitDibuka] || (BERKAS[unitDibuka] = []);

/** Lolos saringan yang sedang dipasang? */
function brkLolos(b){
  if(BRK_SARING.kat && (b.kategori || 'Lainnya') !== BRK_SARING.kat) return false;
  if(BRK_SARING.alat){
    // '-' berarti "yang tidak dikaitkan ke peralatan mana pun" — kotak yang
    // paling sering dicari sesudah kategori, karena ke situlah berkas yang
    // masuk buru-buru mendarat.
    if(BRK_SARING.alat === '-' ? b.alat : b.alat !== BRK_SARING.alat) return false;
  }
  if(BRK_SARING.cari){
    const q = BRK_SARING.cari.toLowerCase();
    const isi = [b.nama, b.kategori, b.olehNama, b.oleh].filter(Boolean).join(' ').toLowerCase();
    if(!isi.includes(q)) return false;
  }
  return true;
}

async function brkTambah(daftarFile){
  if(!unitDibuka || !daftarFile || !daftarFile.length) return;

  // Ditolak di muka, bukan setelah berkasnya dibaca: membaca 25 MB jadi base64
  // lalu membuangnya karena 403 cuma membuat layarnya diam beberapa detik.
  const tolak = dokSebabTolak();
  if(tolak){ pesan(tolak); return; }

  const pAlat  = el('brkAlat');
  const pKat   = el('brkKat');
  const alat   = pAlat && pAlat.value ? pAlat.value : '';
  const paksa  = pKat && pKat.value ? pKat.value : '';
  let masuk = 0; const gemuk = [], gagal = [];

  for(const f of daftarFile){
    if(f.size > BRK_BATAS){ gemuk.push(f.name); continue; }
    const kategori = paksa || brkTebakKategori(f.name, f.type || '');
    try{ await dokKirim(unitDibuka, f, kategori, alat); masuk++; }
    catch(e){ gagal.push(f.name + ': ' + (e && e.message || e)); }
  }

  // Satu kali baca ulang untuk seluruh kiriman, bukan sekali per berkas:
  // yang dijawab server daftar seluruh unit, dan mengambilnya berulang kali
  // tidak menambah apa pun selain perjalanan.
  if(masuk) await dokMuat();
  gambarBerkas(); brkLencana();

  if(gagal.length)      pesan(T('Gagal mengunggah: ','Upload failed: ') + gagal.join('; '));
  else if(gemuk.length) pesan(T(`${gemuk.length} berkas dilewati — lebih dari ${brkUkuran(BRK_BATAS)}.`,
                                `${gemuk.length} files skipped — larger than ${brkUkuran(BRK_BATAS)}.`));
  else if(masuk)        pesan(
    T(`${masuk} berkas tersimpan di dokumen ${namaUnit(unitDibuka)}.`,
      `${masuk} files saved to ${namaUnit(unitDibuka)} documents.`));
}

async function brkBuang(id){
  const kotak = brkDaftar();
  const i = kotak.findIndex(b => b.id === id); if(i < 0) return;
  const b = kotak[i];

  // Berkasnya dihapus sungguhan dari server, jadi ditanya dulu.
  if(!confirm(T(`Keluarkan "${b.nama}" dari dokumen unit ini?\n\nBerkasnya ikut dihapus dari server.`,
                `Remove "${b.nama}" from this unit's documents?\n\nThe file is deleted from the server too.`))) return;
  try{
    const r = await srvFetch(`/dokumen/${encodeURIComponent(unitDibuka)}/${encodeURIComponent(id)}`,
      { method:'DELETE' }, 15000);
    const j = await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(j.error || 'server menjawab ' + r.status);
    await dokMuat();
    gambarBerkas(); brkLencana();
    pesan(T(`"${b.nama}" dihapus dari server.`, `"${b.nama}" deleted from the server.`));
  }catch(e){
    pesan(T('Gagal menghapus: ','Could not delete: ') + (e && e.message || e));
  }
}

/** Angka di label subtab. Dipatch langsung supaya menambah berkas tidak perlu
    membangun ulang seluruh layar unit dan memantulkan subtab yang sedang buka. */
function brkLencana(){
  const tab = document.querySelector('#subtab button[data-sub="dokumen"]'); if(!tab) return;
  const n = (BERKAS[unitDibuka] || []).length;
  tab.innerHTML = T('Dokumen','Documents') + (n ? ` <span class="mono" style="opacity:.75">(${n})</span>` : '');
}

function gambarBerkas(){
  const kotak = el('daftarBerkas'); if(!kotak) return;
  const semua = BERKAS[unitDibuka] || [];
  const isi = semua.filter(brkLolos);
  if(!semua.length){
    kotak.innerHTML = `<div class="badan" style="color:var(--muted);font-size:12.5px;line-height:1.7">
      ${T('Belum ada berkas di unit ini. Tarik berkas ke kotak di atas, atau tekan kotaknya '
          + 'untuk memilih dari komputer.',
          'No files in this unit yet. Drag files onto the box above, or press it to choose from '
          + 'your computer.')}</div>`;
    return;
  }
  const alatUnit = PERALATAN[unitDibuka] || [];

  /* Angka di tiap pilihan kategori dihitung dari SELURUH rak, bukan dari yang
     sedang tampil: pilihan yang menunjukkan "(0)" memberi tahu bahwa tidak ada
     gunanya ditekan, dan itu tidak akan terlihat kalau angkanya ikut menyusut
     bersama saringannya sendiri. */
  const hitung = (k) => semua.filter(b => (b.kategori || 'Lainnya') === k).length;
  const saring = `<div class="badan" style="padding-bottom:0">
    <div class="saring">
      <div class="isian"><label for="fKatBerkas">${T('Kategori','Category')}</label>
        <select id="fKatBerkas">
          <option value="">${T('Semua','All')} (${semua.length})</option>
          ${BRK_KATEGORI.map(k=>`<option value="${esc(k)}"${
            k===BRK_SARING.kat?' selected':''}>${esc(brkKategoriNama(k))} (${hitung(k)})</option>`).join('')}
        </select></div>
      <div class="isian"><label for="fAlatBerkas">${T('Peralatan','Equipment')}</label>
        <select id="fAlatBerkas">
          <option value="">${T('Semua','All')}</option>
          <option value="-"${BRK_SARING.alat==='-'?' selected':''}>${
            T('— tidak dikaitkan —','— not linked —')}</option>
          ${alatUnit.map(a=>`<option value="${esc(a.id)}"${
            a.id===BRK_SARING.alat?' selected':''}>${esc(a.nama)}</option>`).join('')}
        </select></div>
      <div class="isian lebar"><label for="fCariBerkas">${T('Cari nama berkas','Search file name')}</label>
        <input type="text" id="fCariBerkas" autocomplete="off" spellcheck="false"
          value="${esc(BRK_SARING.cari || '')}" placeholder="${
          T('mis. kalibrasi, 2026, Santoso','e.g. calibration, 2026, Santoso')}"></div>
    </div>
    <div style="font-size:11.5px;color:var(--muted);padding:0 0 10px">${
      isi.length === semua.length
        ? T(`${semua.length} berkas`, `${semua.length} files`)
        : T(`${isi.length} dari ${semua.length} berkas tampil`,
            `${isi.length} of ${semua.length} files shown`)}</div>
  </div>`;

  if(!isi.length){
    kotak.innerHTML = saring + `<div class="badan" style="color:var(--muted);font-size:12.5px">${
      T('Tidak ada berkas yang cocok dengan saringan itu.',
        'No files match that filter.')}</div>`;
    brkPasangSaring();
    return;
  }

  // Mengubah kategori berkas yang sudah masuk sengaja dibatasi ke administrator.
  // Kategori adalah bagaimana berkas dicari orang lain — SOP, Manual, Sertifikat —
  // dan salah kategori bisa membuat dokumen "hilang" tanpa terhapus. Yang boleh
  // menghapus juga administrator, jadi keputusan mengelolanya berhenti di satu
  // peran. Server juga menolak PATCH kategori dari non-admin; ini hanya supaya
  // dropdown-nya tidak terlihat aktif untuk peran yang pasti ditolak.
  const bolehUbahKat = !!(akun && akun.role === 'admin');
  const katTitle = bolehUbahKat ? ''
    : ` disabled title="${T('Hanya administrator yang boleh mengubah kategori.',
                            'Only an administrator may change the category.')}"`;

  // Pembungkus yang bisa digulir: enam kolom tidak muat di lebar HP, dan .panel
  // memotong apa pun yang lewat. Tanpa ini kolom Keluarkan hilang di layar kecil.
  kotak.innerHTML = saring + `<div class="gulir" style="max-height:none">
    <table><thead><tr><th>${T('Berkas','File')}</th><th>${T('Kategori','Category')}</th>
      <th>${T('Peralatan','Equipment')}</th><th>${T('Ukuran','Size')}</th>
      <th>${T('Ditambahkan','Added')}</th><th></th></tr></thead><tbody>${isi.map(b=>{
    const nmAlat = (alatUnit.find(a => a.id === b.alat) || {}).nama;
    // Tanggalnya ikut disebut, bukan cuma jam: daftar yang tinggal di server
    // akan berisi berkas dari bulan-bulan sebelumnya, dan "09:40" saja tidak
    // memberi tahu apa pun tentang yang diunggah tiga minggu lalu.
    const saat = new Date(b.waktu);
    const jam = isNaN(saat) ? '—' : saat.toLocaleString(LOKAL(),
      { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
    return `<tr>
      <td><div class="brk-nama">
        <span class="brk-rupa">${b.jenis.startsWith('image/')
          ? `<img src="${b.url}" alt="">` : `<span>${esc(brkEkstensi(b.nama))}</span>`}</span>
        <span><span class="n">${esc(b.nama)}</span>
          <span class="j">${esc(brkJenis(b.jenis))}</span></span>
      </div></td>
      <td><select class="brk-kat" data-kat="${b.id}"${katTitle}>${BRK_KATEGORI.map(k=>
        `<option value="${esc(k)}"${k===b.kategori?' selected':''}>${esc(brkKategoriNama(k))}</option>`).join('')}</select></td>
      <td>${nmAlat ? esc(nmAlat)
        : '<span class="mono" style="color:var(--muted)">—</span>'}</td>
      <td><span class="mono">${brkUkuran(b.ukuran)}</span></td>
      <td><span class="mono" style="color:var(--muted)">${jam} · ${esc(b.olehNama || b.oleh)}</span></td>
      <td><div style="display:flex;gap:6px;justify-content:flex-end">
        <a class="btn garis kecil" href="${b.url}" target="_blank" rel="noopener">${T('Buka','Open')}</a>
        ${BOLEH_HAPUS.dokumen
          ? `<button class="brk-buang" data-buang="${b.id}">${T('Keluarkan','Remove')}</button>`
          : ''}
      </div></td></tr>`;
  }).join('')}</tbody></table></div>`;

  brkPasangSaring();

  kotak.querySelectorAll('[data-buang]').forEach(t =>
    t.addEventListener('click', () => brkBuang(t.dataset.buang)));
  kotak.querySelectorAll('[data-kat]').forEach(s =>
    s.addEventListener('change', async () => {
      const b = (BERKAS[unitDibuka] || []).find(x => x.id === s.dataset.kat);
      if(!b) return;
      const lama = b.kategori;
      b.kategori = s.value;
      /* Yang tersimpan di server ikut diubah di sana. Kalau ditolak, pilihannya
         dikembalikan ke yang lama — kotak yang menunjukkan sesuatu yang tidak
         tersimpan akan membuat orang mengira pekerjaannya sudah aman. */
      try{
        const r = await srvFetch(`/dokumen/${encodeURIComponent(unitDibuka)}/${encodeURIComponent(b.id)}`, {
          method:'PATCH', headers:{ 'Content-Type':'application/json' },
          body: JSON.stringify({ kategori: s.value })
        }, 15000);
        const j = await r.json().catch(()=>({}));
        if(!r.ok) throw new Error(j.error || 'server menjawab ' + r.status);
      }catch(e){
        b.kategori = lama; s.value = lama;
        pesan(T('Kategori gagal disimpan: ','Category could not be saved: ') + (e && e.message || e));
      }
    }));
}

/** Pendengar tiga kotak saringan. Dipasang ulang tiap gambarBerkas(),
    karena ketiganya ikut lahir dan mati bersama isinya. */
function brkPasangSaring(){
  const kat = el('fKatBerkas');
  if(kat) kat.addEventListener('change', ()=>{ BRK_SARING.kat = kat.value; gambarBerkas(); });
  const alat = el('fAlatBerkas');
  if(alat) alat.addEventListener('change', ()=>{ BRK_SARING.alat = alat.value; gambarBerkas(); });
  const cari = el('fCariBerkas');
  if(cari) cari.addEventListener('input', ()=>{
    BRK_SARING.cari = cari.value.trim();
    gambarBerkas();
    // Menggambar ulang mengganti kotaknya, jadi kursornya harus dikembalikan —
    // tanpa ini mengetik huruf kedua sudah tidak mungkin.
    const baru = el('fCariBerkas');
    if(baru){ baru.focus(); baru.setSelectionRange(baru.value.length, baru.value.length); }
  });
}

/** Dipanggil sekali tiap gambarUnit(), setelah innerHTML-nya diganti. */
function brkPasang(){
  const jatuh = el('brkJatuh'); if(!jatuh) return;

  /* Kotak yang bisa ditarik berkas tapi selalu menolaknya adalah janji palsu.
     Kalau sebabnya sudah diketahui sekarang, kotaknya dipadamkan dan sebabnya
     ditulis di tempat ajakannya. */
  const tolak = dokSebabTolak();
  if(tolak){
    jatuh.style.opacity = '.45';
    jatuh.style.pointerEvents = 'none';
    const ajak = jatuh.querySelector('.ajak');
    if(ajak) ajak.textContent = tolak;
    gambarBerkas();
    return;
  }

  el('brkInput').addEventListener('change', e => {
    brkTambah(e.target.files);
    e.target.value = '';        // supaya berkas yang sama bisa dipilih dua kali
  });
  ['dragenter','dragover'].forEach(n => jatuh.addEventListener(n, e => {
    e.preventDefault(); jatuh.classList.add('siap');
  }));
  ['dragleave','dragend'].forEach(n => jatuh.addEventListener(n, () => jatuh.classList.remove('siap')));
  jatuh.addEventListener('drop', e => {
    e.preventDefault(); jatuh.classList.remove('siap');
    brkTambah(e.dataTransfer.files);
  });
  gambarBerkas();
}

/* Berkas yang meleset dari kotak jatuh akan dibuka peramban sebagai halaman
   baru, dan seluruh sesi prototipe ini hilang tanpa peringatan. Dua baris ini
   menahannya: di luar kotak jatuh, berkas yang dilepas tidak terjadi apa-apa. */
window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('drop',     e => e.preventDefault());

