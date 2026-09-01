/* =======================================================================
   MEMBACA PAPAN NAMA DARI FOTO

   Yang dikerjakan: foto papan nama (nameplate) dibaca hurufnya di dalam
   peramban, lalu merk, tipe, S/N, P/N, dan tahun pembuatannya ditebak dari
   teks itu dan dituangkan ke isian di atasnya. Hasilnya SELALU boleh
   diperbaiki tangan, dan teks mentahnya ikut ditampilkan — pembacaan papan
   nama logam yang tergores dan miring tidak pernah sempurna, dan menyembunyikan
   tebakan yang salah jauh lebih berbahaya daripada menunjukkannya.

   KENAPA DI PERAMBAN, BUKAN LAYANAN DI INTERNET
   Jaringan kantor tertutup. Tidak ada layanan OCR atau model penglihatan yang
   bisa dipanggil dari sini, dan foto papan nama peralatan navigasi juga bukan
   sesuatu yang pantas dikirim ke luar. Karena itu mesinnya — Tesseract —
   ditaruh utuh di public/vendor/ocr/ dan berjalan di dalam peramban: 12 MB
   sekali muat, sesudah itu tidak ada satu pun permintaan keluar.

   Berkasnya sengaja BARU dimuat saat tombolnya ditekan pertama kali. Semua
   orang membuka dashboard ini; hanya sebagian kecil yang mendaftarkan
   peralatan baru.
   ======================================================================= */

const OCR = {
  jalan:  null,    // janji pemuatan mesin, supaya dua klik tidak memuat dua kali
  pekerja:null,
  teks:   '',      // hasil bacaan terakhir, ditampilkan apa adanya
  berkas: null     // File papan nama yang sedang dipegang kartu
};

/** Muat tesseract.min.js dari vendor. Sekali saja seumur halaman. */
function ocrMuatPustaka(){
  if(window.Tesseract) return Promise.resolve();
  return new Promise((selesai, gagal)=>{
    const s = document.createElement('script');
    s.src = 'vendor/ocr/tesseract.min.js';
    s.onload = ()=>selesai();
    s.onerror = ()=>gagal(new Error(T('Mesin pembaca teks tidak ada di vendor/ocr/.',
      'The text-reading engine is missing from vendor/ocr/.')));
    document.head.appendChild(s);
  });
}

/**
 * Siapkan pekerja Tesseract. Seluruh jalurnya menunjuk ke dalam folder ini —
 * kalau satu saja dibiarkan pada bawaannya, ia akan mencoba CDN dan menggantung
 * sampai batas waktu di jaringan yang tidak punya jalan keluar.
 */
async function ocrSiapkan(lapor){
  if(OCR.pekerja) return OCR.pekerja;
  if(OCR.jalan) return OCR.jalan;
  OCR.jalan = (async ()=>{
    lapor(T('Memuat mesin pembaca teks (sekali saja, ±12 MB)...',
            'Loading the text-reading engine (once only, ~12 MB)...'));
    await ocrMuatPustaka();
    // Alamat penuh, bukan relatif: jalur ini dipakai dari dalam Web Worker,
    // dan di sana alamat relatif tidak punya halaman untuk jadi acuannya —
    // importScripts('vendor/...') langsung ditolak sebagai URL tidak sah.
    const asal = new URL('vendor/ocr/', location.href).href;
    const p = await window.Tesseract.createWorker('eng', 1, {
      workerPath: asal + 'worker.min.js',
      corePath:   asal,
      langPath:   asal,
      // Bahasa sudah ter-gzip di folder itu; tanpa ini ia mencari yang mentah.
      gzip: true,
      logger: (m)=>{
        if(m.status === 'recognizing text'){
          lapor(T('Membaca huruf... ','Reading text... ') + Math.round((m.progress || 0) * 100) + '%');
        }
      }
    });
    // DPI dinyatakan sendiri: foto papan nama tidak membawa keterangan dpi, dan
    // tanpa ini Tesseract menebaknya kelewat rendah lalu menganggap hurufnya
    // terlalu kecil untuk dibaca. Spasi antar kata dipertahankan supaya
    // "PART NO" tidak menyatu jadi "PARTNO" dan luput dari polanya.
    await p.setParameters({ user_defined_dpi:'300', preserve_interword_spaces:'1' });
    OCR.pekerja = p;
    return p;
  })().catch(e=>{ OCR.jalan = null; throw e; });
  return OCR.jalan;
}

/* ---------- Menyiapkan gambarnya sebelum dibaca ----------

   Ini bagian yang paling menentukan hasilnya, dan sempat tidak ada sama sekali:
   fotonya dikirim apa adanya ke Tesseract. Foto papan nama dan label sparepart
   diambil pakai HP, di dalam shelter yang remang, sering dari jarak dekat
   dengan sebagian bidang gelap dan sebagian memantulkan lampu. Tesseract
   dilatih pada halaman cetak hitam-putih yang rata — jarak antara dua hal itu
   yang membuat bacaannya sering kosong.

   Tiga hal yang dikerjakan, dan cuma tiga: dibesarkan sampai hurufnya cukup
   tinggi untuk dikenali, dijadikan abu-abu, lalu kontrasnya diregangkan pada
   persentil 2% supaya logam kelabu di atas logam kelabu jadi hitam di atas
   putih. Tidak sampai dijadikan hitam-putih murni — papan nama yang tergores
   kehilangan potongan hurufnya kalau diambangkan sekali untuk seluruh bidang. */
async function ocrGambarSiap(berkas){
  let gambar;
  try{
    // from-image: foto HP membawa penanda putaran di EXIF, dan tanpa ini
    // papan namanya terbaca miring 90° — yang bagi Tesseract berarti kosong.
    gambar = await createImageBitmap(berkas, { imageOrientation:'from-image' });
  }catch(e){
    return berkas;      // peramban tidak bisa membukanya: biar Tesseract yang coba
  }

  const LEBAR_TUJU = 1700;
  const skala = Math.min(3, Math.max(1, LEBAR_TUJU / (gambar.width || LEBAR_TUJU)));
  const w = Math.round(gambar.width * skala);
  const h = Math.round(gambar.height * skala);

  const kanvas = document.createElement('canvas');
  kanvas.width = w; kanvas.height = h;
  const g = kanvas.getContext('2d', { willReadFrequently:true });
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(gambar, 0, 0, w, h);
  if(gambar.close) gambar.close();

  const petak = g.getImageData(0, 0, w, h);
  const p = petak.data;
  const sebaran = new Uint32Array(256);
  for(let i = 0; i < p.length; i += 4){
    const y = (p[i]*0.299 + p[i+1]*0.587 + p[i+2]*0.114) | 0;
    p[i] = p[i+1] = p[i+2] = y;
    sebaran[y]++;
  }

  const total = w * h;
  let bawah = 0, atas = 255, n = 0;
  for(let v = 0; v < 256; v++){ n += sebaran[v]; if(n > total*0.02){ bawah = v; break; } }
  n = 0;
  for(let v = 255; v >= 0; v--){ n += sebaran[v]; if(n > total*0.02){ atas = v; break; } }
  // Rentang minimum menahan foto yang nyaris satu warna: meregangkan beda tiga
  // tingkat abu jadi 0–255 hanya melahirkan bintik, bukan huruf.
  const rentang = Math.max(28, atas - bawah);
  for(let i = 0; i < p.length; i += 4){
    let y = (p[i] - bawah) * 255 / rentang;
    y = y < 0 ? 0 : y > 255 ? 255 : y;
    p[i] = p[i+1] = p[i+2] = y;
  }
  g.putImageData(petak, 0, 0);
  return kanvas;
}

/**
 * Baca satu foto, dua kali kalau perlu.
 *
 * Sekali baca memakai PSM 6 — "satu blok teks yang rata" — karena itulah bentuk
 * papan nama dan label sparepart: baris-baris pendek berlabel, bukan halaman
 * berkolom. Bawaan Tesseract (PSM 3) mencoba menemukan tata letak halaman di
 * dalamnya, dan pada papan berisi enam baris ia sering menyerah dengan tangan
 * kosong.
 *
 * Kalau hasilnya tetap tipis, PSM 4 dicoba sekali lagi dan yang lebih banyak
 * hurufnya yang dipakai. Dua kali baca memakan waktu dua kali lipat, jadi
 * hanya dijalankan kalau yang pertama memang gagal.
 */
async function ocrBaca(berkas, lapor, jenis){
  const p = await ocrSiapkan(lapor);
  lapor(T('Menyiapkan gambar...','Preparing the image...'));
  const gambar = await ocrGambarSiap(berkas);

  const sekali = async (psm)=>{
    await p.setParameters({ tessedit_pageseg_mode: psm });
    const hasil = await p.recognize(gambar);
    return (hasil && hasil.data && hasil.data.text) || '';
  };

  lapor(T('Membaca huruf...','Reading text...'));
  let teks = await sekali('6');
  let hasil = ocrUrai(teks, jenis);
  if(Object.values(hasil).filter(Boolean).length < 2){
    lapor(T('Percobaan kedua dengan tata letak lain...','Second attempt with a different layout...'));
    const lagi = await sekali('4');
    if(Object.values(ocrUrai(lagi, jenis)).filter(Boolean).length
       > Object.values(hasil).filter(Boolean).length){
      teks = lagi;
    }else if(lagi.replace(/\s/g,'').length > teks.replace(/\s/g,'').length){
      // Sama-sama tidak mengenali apa pun: yang lebih banyak hurufnya lebih
      // berguna untuk dibaca sendiri di kotak teks mentah.
      teks = lagi;
    }
  }
  return teks;
}

/* ---------- Menebak isi papan nama dari teks mentah ----------

   Papan nama peralatan hampir selalu berlabel, dan labelnyalah yang dicari —
   bukan posisi barisnya, yang berubah-ubah tiap pabrikan. Yang tidak berlabel
   (merk) ditebak dari daftar pabrikan yang memang dipakai di sini, baru
   setelah itu dari baris pertama yang bentuknya seperti nama pabrikan. */

const OCR_MERK = [
  'Thales','Indra','Leonardo','Selex','Rohde & Schwarz','Rohde&Schwarz','Park Air','Frequentis',
  'Garex','Jotron','Becker','Moog','Schmid','Telerad','Airsys','Intelcan','Nautel','Comrod',
  'Siemens','Schneider','ABB','Eaton','APC','Vertiv','Emerson','Delta','Socomec',
  'Caterpillar','Cummins','Perkins','Deutz','FG Wilson','Daikin','Mitsubishi','Panasonic',
  'Yokogawa','Anritsu','Keysight','Agilent','Fluke','Tektronix','Cisco','Dell','HP','Hewlett',
  'Lenovo','Supermicro','Hikvision','Dahua','Bosch','Axis'
];

/** Buang karakter yang biasa salah dibaca dari label bercetak logam. */
const ocrRapi = (s) => String(s || '').replace(/\s+/g,' ').trim().replace(/[.,;:_-]+$/,'');

/* ---------- Mengambil nilai yang berlabel ----------

   Dua hal di bawah ini yang dulu membuat S/N dan P/N sering salah, dan
   keduanya bukan soal mesin OCR-nya melainkan soal cara mengurai hasilnya.

   1. NILAINYA DI BARIS BERIKUTNYA. Papan nama berkolom mencetak labelnya
      sendirian — "SERIAL NO." lalu baris baru lalu nomornya. Pola lama
      mengharuskan keduanya sebaris (kelas karakternya menolak \n), jadi bentuk
      itu tidak pernah terbaca sama sekali.

   2. NILAINYA KEBABLASAN. Kelas karakter nilainya memuat spasi, jadi pada
      baris "S/N 4471120 TYPE T6-B" seluruh sisanya ikut tersedot menjadi
      nomor seri. Yang tersimpan lalu terlihat masuk akal — dan itu yang
      membuatnya sulit ketahuan.
*/

/** Kata yang jelas milik label berikutnya, dipakai untuk memotong nilai. */
const OCR_LABEL_LAIN = /\b(MODEL|MODELL|TYPE|TIPE|PRODUCT|SERIAL|SER|PART|ORDER|ARTICLE|CATALOG|CATALOGUE|ITEM|REF|MADE|YEAR|TAHUN|MFG|MFD|VOLT|VOLTAGE|INPUT|OUTPUT|POWER|FREQ|QTY|QUANTITY|LOT|REV|WEIGHT|CLASS)\b/i;

/** Sumber pola label, tanpa pembungkusnya — dipakai dua kali per kolom:
    sekali untuk nilai sebaris, sekali untuk nilai di baris berikutnya. */
const OCR_LABEL = {
  sn: 'S\\s*[\\/.|!I]?\\s*N|SIN|SER(?:IAL)?(?:\\s*(?:NO|NUM|NUMBER))?|SERIENNR',
  pn: 'P\\s*[\\/.|!I]?\\s*N|PIN|PART\\s*(?:NO|NUM|NUMBER)?|MAT(?:ERIAL)?\\.?\\s*(?:NO|NUMBER)'
    + '|ORDER\\s*(?:NO|CODE)|ART(?:ICLE|\\.)?\\s*(?:NO|NR)?|CAT(?:ALOG(?:UE)?)?\\.?\\s*(?:NO|NR)'
    + '|ITEM\\s*(?:NO|CODE)|REF(?:ERENCE)?\\.?\\s*(?:NO)?',
  tipe: 'MODEL|MODELL|TYPE|TIPE|PRODUCT'
};

/** Potong nilai yang menyeberang ke kolom sebelahnya. */
function ocrPotongNilai(mentah){
  // Dua spasi berturut-turut pada cetakan papan nama hampir selalu berarti
  // kolom berikutnya, bukan bagian dari satu nomor. Dipotong sebelum ocrRapi,
  // yang justru meratakan semua spasi jadi satu.
  let s = String(mentah || '').split(/\s{2,}/)[0];
  const m = s.match(OCR_LABEL_LAIN);
  // index 0 bukan sisa label melainkan nilainya sendiri yang kebetulan
  // berbunyi seperti label — yang dipotong hanya yang datang sesudah ada isi.
  if(m && m.index > 0) s = s.slice(0, m.index);
  return ocrRapi(s);
}

/**
 * Nilai untuk satu label. Dicoba sebaris dulu, baru baris berikutnya —
 * urutannya sengaja begitu: kalau labelnya membawa nilai di sebelahnya, itu
 * yang paling mungkin benar.
 */
function ocrAmbilLabel(teks, label, minimal){
  const nilai = `([A-Z0-9][A-Z0-9 .\\/#-]{${Math.max(0, (minimal || 4) - 1)},30})`;
  const coba = [
    new RegExp(`(?:^|\\s)(?:${label})\\b[^A-Za-z0-9\\n]{0,6}${nilai}`, 'i'),
    new RegExp(`(?:^|\\s)(?:${label})\\b[^A-Za-z0-9\\n]{0,6}\\n[^A-Za-z0-9\\n]{0,4}${nilai}`, 'i')
  ];
  for(const pola of coba){
    const m = teks.match(pola);
    if(!m) continue;
    const v = ocrPotongNilai(m[1]);
    if(v.length >= (minimal || 4)) return v;
  }
  return '';
}

/**
 * Papan nama peralatan dan label sparepart tidak sama bentuknya, dan itulah
 * yang dulu membuat pembacaan sparepart hampir selalu gagal.
 *
 * Papan nama peralatan menyebut pabrikan dan model dengan huruf besar-besar;
 * yang dicari darinya merk dan tipe. Label sparepart isinya kode: nomor part,
 * nomor katalog, kadang jumlah per kemasan — dan nomor partnya sering TIDAK
 * berlabel sama sekali, cuma dicetak sendirian di bawah kode batang. Karena
 * part number wajib diisi sebelum barisnya bisa disimpan, label tanpa nomor
 * part yang terbaca berarti kartunya buntu.
 *
 * Jadi untuk sparepart ada satu langkah tambahan: kalau tidak ada satu pun
 * label yang cocok, baris yang PALING BERBENTUK kode part dipakai sebagai
 * tebakan. Tebakan tetap tebakan — ia diisikan ke kolom yang bisa diperbaiki,
 * dan teks mentahnya tetap ditampilkan di bawahnya.
 */
function ocrUrai(teks, jenis){
  const T_ = String(teks || '');
  const baris = T_.split('\n').map(b=>b.trim()).filter(Boolean);
  const part = jenis === 'sparepart';
  const hasil = { merk:'', tipe:'', sn:'', pn:'', tahun:'', jumlah:'' };

  const ambil = (pola) => { const m = T_.match(pola); return m ? ocrRapi(m[1]) : ''; };

  /* "S/N" dan "P/N" jarang terbaca utuh dari papan logam: garis miringnya
     sering jadi I, |, atau titik, sehingga keluar sebagai SIN, S|N, PIN, P.N.
     Bentuk-bentuk itu ikut diterima — di papan nama, sesuatu berbunyi "PIN"
     yang diikuti kode hampir selalu P/N yang salah baca.

     Daftar label part number sengaja panjang: tiap pabrikan punya sebutan
     sendiri, dan yang dipesan lewat gudang bisa jadi "article no" di kardusnya
     dan "catalogue no" di lembar pesanannya. */
  hasil.sn   = ocrAmbilLabel(T_, OCR_LABEL.sn, 4);
  hasil.pn   = ocrAmbilLabel(T_, OCR_LABEL.pn, 4);
  // Tipe boleh pendek: "T6" dan "M3" adalah nama model yang sungguhan.
  hasil.tipe = ocrAmbilLabel(T_, OCR_LABEL.tipe, 2);

  /* Jumlah per kemasan, hanya berguna untuk sparepart. Diambil dengan
     satuannya kalau tercetak — "10 PCS" lebih menolong daripada "10". */
  if(part){
    const m = T_.match(/(?:QTY|QUANTITY|JUMLAH|ISI|CONTENTS?)\b[^0-9\n]{0,6}(\d{1,5})\s*([A-Za-z]{2,6})?/i);
    if(m) hasil.jumlah = ocrRapi(m[1] + (m[2] ? ' ' + m[2] : ''));
  }

  // Tahun: yang berlabel dulu (MFG, MFD, YEAR, DATE OF MANUFACTURE, TAHUN),
  // baru tahun apa pun yang berdiri sendiri di dalam teks.
  hasil.tahun = ambil(/(?:MFG|MFD|MANUFACTUR\w*|YEAR|TAHUN|DATE\s*OF\s*MANUF\w*|BUILT)\b[^0-9\n]{0,14}((?:19|20)\d{2})/i)
             || ambil(/(?:^|[^0-9])((?:19|20)\d{2})(?:[^0-9]|$)/);

  const naik = T_.toUpperCase();
  const merkDikenal = OCR_MERK.find(m=>naik.includes(m.toUpperCase()));
  if(merkDikenal){
    // Kalau merk yang dikenal itu ternyata bagian dari satu baris nama
    // perusahaan yang utuh ("PARK AIR SYSTEMS"), baris itulah yang dipakai —
    // penggalannya saja terasa seperti salah salin.
    const penuh = baris.find(b=>b.toUpperCase().includes(merkDikenal.toUpperCase())
      && b.length <= 34 && !/[0-9]/.test(b));
    hasil.merk = penuh ? ocrRapi(penuh) : merkDikenal;
  }else{
    // Baris pertama yang bentuknya seperti nama pabrikan: dua sampai tiga puluh
    // huruf, boleh berspasi dan '&', tanpa angka dan tanpa tanda baca label.
    const calon = baris.find(b=>/^[A-Za-z][A-Za-z&.\- ]{2,29}$/.test(b)
      && !/^(model|type|tipe|serial|part|made|year|voltage|input|output|power|no)\b/i.test(b));
    hasil.merk = calon ? ocrRapi(calon) : '';
  }

  /* Baris yang berdiri sendiri dan berbentuk kode — dipakai dua kali di bawah,
     jadi disaring sekali di sini. Yang dibuang: baris berlabel (sudah terambil
     di atas), tahun, dan yang sudah dipakai sebagai S/N atau P/N. */
  const kodeCalon = baris.filter(b=>{
    const r = ocrRapi(b);
    if(r.length < 4 || r.length > 26) return false;
    if(!/^[A-Z0-9][A-Z0-9 .\/-]*$/i.test(r)) return false;
    if(!/[0-9]/.test(r)) return false;
    if(/^(19|20)\d{2}$/.test(r)) return false;
    if(r === hasil.sn || r === hasil.pn) return false;
    if(/^(MODEL|TYPE|TIPE|SERIAL|PART|MADE|YEAR|VOLT|INPUT|OUTPUT|POWER|QTY|LOT|REV)\b/i.test(r)) return false;
    return true;
  }).map(ocrRapi);

  /* Part number sparepart yang tidak berlabel. Yang dipilih bukan yang pertama
     melainkan yang paling padat tanda hubung dan angka: nomor part hampir
     selalu lebih berpola daripada kode lot atau nomor revisi yang tercetak di
     sebelahnya. Hanya untuk sparepart — pada peralatan, tebakan P/N yang
     meleset tidak menghalangi apa pun, jadi lebih baik dibiarkan kosong. */
  if(part && !hasil.pn && kodeCalon.length){
    const nilai = (k)=> (k.match(/\d/g) || []).length + (k.match(/[-.\/]/g) || []).length * 2
                      + (/^[A-Z]{1,4}[-\s]?\d/i.test(k) ? 3 : 0);
    hasil.pn = [...kodeCalon].sort((a,b)=>nilai(b) - nilai(a))[0];
  }

  // Tipe yang tidak berlabel: sisa kode setelah P/N diambil.
  if(!hasil.tipe){
    hasil.tipe = kodeCalon.find(k=>k !== hasil.pn && k.length <= 24) || '';
  }
  return hasil;
}

/* ---------- Kotak papan nama di dalam kartu ---------- */

function kotakPapanNama(alatIni){
  return `
  <div class="isian pn-kotak">
    <label>${alatIni ? T('Papan nama peralatan','Equipment nameplate')
                     : T('Label sparepart','Spare part label')}</label>
    <label class="jatuh rapat" id="pnJatuh">
      <div class="ajak">${alatIni
        ? T('Taruh foto papan nama di sini','Drop a nameplate photo here')
        : T('Taruh foto label sparepart di sini','Drop a spare part label photo here')}</div>
      <div class="ket2">${T('atau tekan untuk memilih · .jpg, .png, .webp',
                            'or press to choose · .jpg, .png, .webp')}</div>
      <input type="file" id="pnInput" accept="image/jpeg,image/png,image/webp">
    </label>
    <div id="pnPratinjau"></div>
    <!-- Baca ulang: pembacaan yang meleset lebih sering diperbaiki dengan
         mencoba lagi daripada dengan mengetik ulang semuanya, dan memilih
         berkas yang sama untuk kedua kalinya bukan hal yang terpikir. -->
    <div class="gambar-atur" id="pnUlangBaris" hidden style="margin-top:9px">
      <button type="button" class="btn garis kecil" id="btnPnUlang">${
        T('Baca ulang foto ini','Read this photo again')}</button>
      <span class="bantu" style="margin:0;flex:1;min-width:150px">${
        T('Isian yang tadi diisi dari foto ditulis ulang; yang Anda ketik sendiri tidak disentuh.',
          'Fields filled from the photo are rewritten; anything you typed yourself is left alone.')}</span>
    </div>
    <div class="bantu" id="pnKabar">${alatIni
      ? T('Merk, tipe, S/N, P/N, dan tahunnya dibaca dari foto lalu diisikan ke bawah — dan tetap bisa '
        + 'Anda perbaiki. Pembacaannya berjalan di dalam peramban ini; tidak ada yang dikirim ke luar.',
          'The make, type, S/N, P/N, and year are read from the photo and filled in below — and remain '
        + 'yours to correct. The reading runs inside this browser; nothing is sent outside.')
      : T('Part number, merk, tipe, dan S/N dibaca dari foto lalu diisikan ke bawah. Kalau nomor partnya '
        + 'tercetak tanpa label, kode yang paling berbentuk nomor part yang ditebak — periksa lagi '
        + 'sebelum disimpan. Pembacaannya berjalan di dalam peramban ini.',
          'The part number, make, type, and S/N are read from the photo and filled in below. When the part '
        + 'number is printed without a label, the most part-number-shaped code is guessed — check it '
        + 'before saving. The reading runs inside this browser.')}</div>
    <div id="pnMentah"></div>
  </div>`;
}

function kotakDokumentasi(asal){
  const foto = (asal && Array.isArray(asal.foto)) ? asal.foto : [];
  return `
  <div class="isian">
    <label>${T('Foto dokumentasi','Documentation photos')}</label>
    <div class="foto-lampir" id="dokDaftar">${foto.map(f=>
      `<span class="foto-cip" data-dok="${esc(f)}"><img src="foto/${esc(dataDibuka.unit)}/${esc(f)}" alt="">
        ${esc(f)}<button type="button" title="${T('Lepas','Remove')}">✕</button></span>`).join('')}</div>
    <label class="jatuh" id="dokJatuh">
      <div class="ajak">${T('Tambah foto dokumentasi','Add documentation photos')}</div>
      <div class="ket2">${T('boleh lebih dari satu · tersimpan di galeri unit ini',
                            'more than one is fine · saved into this unit’s gallery')}</div>
      <input type="file" id="dokInput" accept="image/jpeg,image/png,image/webp" multiple>
    </label>
    <div class="bantu" id="dokKabar"></div>
  </div>`;
}


/** Pendengar untuk kotak papan nama. Dipanggil tiap kali kartunya dibuka. */
function papanNamaPasang(){
  const jatuh = el('pnJatuh'); if(!jatuh) return;
  const masuk = el('pnInput');
  const kabar = el('pnKabar');
  OCR.berkas = null; OCR.teks = '';
  el('pnMentah').innerHTML = '';

  /** Baca satu berkas dan tuangkan hasilnya ke isian di bawahnya. */
  const bacaBerkas = async (b)=>{
    OCR.berkas = b;
    el('pnPratinjau').innerHTML = `<div class="pn-pratinjau"><img src="${URL.createObjectURL(b)}" alt="">
      <span>${esc(b.name)}</span></div>`;
    el('pnUlangBaris').hidden = false;

    const lapor = (t)=>{ kabar.textContent = t; };
    const jenis = dataDibuka.jenis;
    try{
      const teks = await ocrBaca(b, lapor, jenis);
      OCR.teks = teks;
      const t = ocrUrai(teks, jenis);
      /* Isian yang sudah ada isinya tidak ditimpa: yang diketik tangan lebih
         dipercaya daripada yang ditebak dari foto. Yang datang DARI foto
         ditandai — dua gunanya sekaligus: yang perlu diperiksa jadi terlihat,
         dan Baca ulang tahu mana yang boleh ditulis ulang. */
      const isi = (id, nilai)=>{
        const e = el(id);
        if(e && nilai && !e.value.trim()){ e.value = nilai; e.classList.add('dari-foto'); }
      };
      isi('dMerk', t.merk); isi('dTipe', t.tipe); isi('dSn', t.sn);
      isi(jenis === 'peralatan' ? 'dPnAlat' : 'dPn', t.pn);
      isi('dTahun', t.tahun);
      if(!el('dNama').value.trim() && (t.merk || t.tipe)){
        el('dNama').value = [t.merk, t.tipe].filter(Boolean).join(' ');
        el('dNama').classList.add('dari-foto');
      }

      const ketemu = Object.entries(t).filter(([,v])=>v).map(([k])=>k.toUpperCase());
      /* Jumlah yang tercetak di label TIDAK diisikan ke kolom Stok, hanya
         disebut. Angka di kardus adalah isi satu kemasan; stok adalah berapa
         yang ada di rak. Mengisikan yang satu ke tempat yang lain akan
         terlihat benar sampai suatu hari ada yang memesan berdasarkan itu. */
      const jumlahKet = t.jumlah
        ? ` ${T(`Di label tertulis jumlah <b>${esc(t.jumlah)}</b> — itu isi kemasannya, `
              + 'jadi tidak diisikan ke kolom Stok.',
                `The label reads a quantity of <b>${esc(t.jumlah)}</b> — that is what is in the pack, `
              + 'so it is not filled into the Stock box.')}` : '';
      kabar.innerHTML = ketemu.length
        ? `<b>${T('Terbaca','Read')}: ${ketemu.join(' · ')}.</b> ${
            T('Periksa dan perbaiki di isian bawah — pembacaan papan nama tidak pernah pasti.',
              'Check and correct the fields below — nameplate reading is never certain.')}${jumlahKet}`
        : `<b>${T('Tidak ada yang bisa dikenali dari foto itu.','Nothing recognisable in that photo.')}</b> ${
            T('Coba foto yang lebih dekat dan lurus, dengan labelnya memenuhi bingkai dan tanpa '
              + 'pantulan lampu — atau isi sendiri di bawah.',
              'Try a closer, straighter photo with the label filling the frame and no glare — '
              + 'or fill the fields in by hand.')}`;
      el('pnMentah').innerHTML = teks.trim()
        ? `<details class="pn-mentah"><summary>${T('Teks mentah hasil pembacaan','Raw text from the reading')}</summary>
            <pre>${esc(teks.trim())}</pre></details>`
        : '';
    }catch(e){
      console.error('OCR gagal:', e);
      kabar.innerHTML = `<span style="color:var(--fail)">${
        T('Gagal membaca foto: ','Could not read the photo: ')}${esc(e && e.message || e)}</span>`;
    }
  };

  /** Berkas yang dijatuhkan atau dipilih: disaring dulu, baru dibaca. */
  const terima = (daftar)=>{
    const b = [...(daftar || [])].find(x=>FOTO_EXT_SAH.test(x.name));
    if(!b){
      kabar.innerHTML = `<span style="color:var(--fail)">${
        T('Hanya .jpg, .png, dan .webp yang bisa dibaca.','Only .jpg, .png, and .webp can be read.')}</span>`;
      return;
    }
    return bacaBerkas(b);
  };

  masuk.addEventListener('change', ()=>{ terima(masuk.files); masuk.value = ''; });
  ['dragenter','dragover'].forEach(n=>jatuh.addEventListener(n, e=>{
    e.preventDefault(); jatuh.classList.add('siap'); }));
  ['dragleave','drop'].forEach(n=>jatuh.addEventListener(n, e=>{
    e.preventDefault(); jatuh.classList.remove('siap'); }));
  jatuh.addEventListener('drop', e=>{
    if(e.dataTransfer && e.dataTransfer.files.length) terima(e.dataTransfer.files);
  });

  /* Baca ulang: yang dikosongkan hanya isian bertanda .dari-foto, yaitu yang
     memang datang dari pembacaan sebelumnya. Yang diketik tangan dibiarkan,
     dan isi() di atas sudah menolak menimpanya. */
  el('btnPnUlang').addEventListener('click', ()=>{
    if(!OCR.berkas) return;
    document.querySelectorAll('#badanKartuData .dari-foto').forEach(e=>{
      e.value = ''; e.classList.remove('dari-foto');
    });
    bacaBerkas(OCR.berkas);
  });
}

/** Foto dokumentasi: diunggah ke galeri unit, yang disimpan di baris ini hanya
    nama berkasnya. Tanpa itu, satu foto 3 MB dalam bentuk base64 akan memakan
    seluruh jatah localStorage dalam sekali simpan. */
function dokumentasiPasang(asal){
  const jatuh = el('dokJatuh'); if(!jatuh) return;
  const masuk = el('dokInput');
  const kabar = el('dokKabar');
  const unit  = dataDibuka.unit;

  if(!KEMAMPUAN.galeriTulis){
    jatuh.style.opacity = '.45';
    jatuh.style.pointerEvents = 'none';
    kabar.textContent = T('Unggah foto dimatikan di lingkungan ini — penyimpanannya tidak permanen.',
                          'Photo upload is off in this environment — its storage is not permanent.');
    return;
  }

  const terima = async (daftar)=>{
    const berkas = [...daftar].filter(b=>FOTO_EXT_SAH.test(b.name));
    if(!berkas.length){
      kabar.textContent = T('Hanya .jpg, .png, dan .webp.','Only .jpg, .png, and .webp.');
      return;
    }
    const nama = el('dNama').value.trim() || T('peralatan','equipment');
    let sudah = 0; const gagal = [];
    for(const b of berkas){
      kabar.textContent = T(`Mengunggah ${b.name} — ${sudah+1} dari ${berkas.length}...`,
                            `Uploading ${b.name} — ${sudah+1} of ${berkas.length}...`);
      try{
        const nm = namaFotoBaru(unit, b.name, isoHariIni());
        await kirimFoto(unit, b, nm, T('Dokumentasi ','Documentation ') + nama, isoHariIni());
        tambahCipDok(unit, nm);
        sudah++;
      }catch(e){ gagal.push(`${b.name}: ${e && e.message || e}`); }
    }
    kabar.innerHTML = `<b>${sudah} ${T('foto tertambat.','photos attached.')}</b>`
      + (gagal.length ? ` <span style="color:var(--fail)">${esc(gagal.join('; '))}</span>` : '');
    muatGaleri().catch(()=>{});
  };

  masuk.addEventListener('change', ()=>{ terima(masuk.files); masuk.value = ''; });
  ['dragenter','dragover'].forEach(n=>jatuh.addEventListener(n, e=>{
    e.preventDefault(); jatuh.classList.add('siap'); }));
  ['dragleave','drop'].forEach(n=>jatuh.addEventListener(n, e=>{
    e.preventDefault(); jatuh.classList.remove('siap'); }));
  jatuh.addEventListener('drop', e=>{
    if(e.dataTransfer && e.dataTransfer.files.length) terima(e.dataTransfer.files);
  });

  el('dokDaftar').addEventListener('click', e=>{
    const b = e.target.closest('button'); if(!b) return;
    // Hanya melepas tautannya dari baris ini. Fotonya tetap di galeri unit —
    // menghapus berkas orang lain dari kartu ini terlalu jauh jangkauannya.
    b.closest('.foto-cip').remove();
  });
}

function tambahCipDok(unit, nama){
  el('dokDaftar').insertAdjacentHTML('beforeend',
    `<span class="foto-cip" data-dok="${esc(nama)}"><img src="foto/${esc(unit)}/${esc(nama)}" alt="">
      ${esc(nama)}<button type="button" title="Lepas">✕</button></span>`);

  // Foto yang baru diunggah langsung ikut jadi calon gambar kartu. Tanpa ini,
  // yang baru saja memotret alatnya harus menutup kartunya dan membukanya lagi
  // untuk bisa memakai fotonya — dan itu tempat paling gampang kehilangan
  // isian yang sudah diketik.
  const pilih = el('dGambarPilih');
  if(pilih && !pilih.querySelector(`[data-gambar="${CSS.escape(nama)}"]`)){
    pilih.querySelectorAll('.bantu').forEach(x=>x.remove());
    pilih.insertAdjacentHTML('beforeend',
      `<button type="button" class="gambar-cip" data-gambar="${esc(nama)}" title="${esc(nama)}">
        <img src="foto/${esc(unit)}/${esc(nama)}" alt="" loading="lazy"></button>`);
  }
}

/** Nama berkas foto dokumentasi yang sedang tertambat di kartu. */
const dokTerpasang = () =>
  [...(el('dokDaftar') ? el('dokDaftar').querySelectorAll('.foto-cip') : [])].map(c=>c.dataset.dok);

/* `penuh` membuat isiannya memakan kedua lajur di dalam .isian-grid. Dipakai
   untuk yang isinya panjang — nama peralatan — dan untuk kotak yang memang
   bukan isian pendek. */
const dIsian = (id, label, nilai, bantu, jenis, penuh) => `
  <div class="isian${penuh ? ' penuh' : ''}"><label for="${id}">${esc(label)}</label>
    <input type="${jenis || 'text'}" id="${id}" value="${esc(nilai == null ? '' : nilai)}"
      autocomplete="off" spellcheck="false">
    ${bantu ? `<div class="bantu">${bantu}</div>` : ''}</div>`;

const dPilih = (id, label, daftar, terpilih, bantu, penuh) => `
  <div class="isian${penuh ? ' penuh' : ''}"><label for="${id}">${esc(label)}</label>
    <select id="${id}">${daftar.map(o=>{
      const [nilai, teks] = Array.isArray(o) ? o : [o, o];
      return `<option value="${esc(nilai)}"${nilai === terpilih ? ' selected' : ''}>${esc(teks)}</option>`;
    }).join('')}</select>
    ${bantu ? `<div class="bantu">${bantu}</div>` : ''}</div>`;

