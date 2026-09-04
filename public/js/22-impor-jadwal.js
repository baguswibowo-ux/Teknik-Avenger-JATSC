/* =======================================================================
   IMPOR JADWAL DINAS — dari Excel, PDF, CSV, atau tempelan

   Jadwal dinas tidak lahir di dashboard ini. Ia lahir di lembar Excel yang
   dibuat satu orang tiap akhir bulan, lalu dicetak jadi PDF dan ditempel di
   dinding. Mengetik ulang tiga puluh satu kolom kali dua belas orang ke dalam
   layar ini adalah cara paling pasti untuk membuat modulnya tidak dipakai.

   EMPAT PINTU MASUK, dan tidak satu pun menarik pustaka dari internet:
     .xlsx  — ZIP berisi XML. ZIP-nya dibuka sendiri di bawah ini dan XML-nya
              diurai DOMParser bawaan peramban. Tidak ada SheetJS di sini.
     .csv   — teks berpemisah; pemisahnya ditebak dari isinya.
     .pdf   — aliran teksnya dikembangkan lalu operator teksnya dipungut.
              Ini yang paling rapuh: PDF yang hurufnya sudah jadi gambar, atau
              yang memakai font dengan peta huruf sendiri, akan keluar sebagai
              sampah. Itu dikatakan di layar, bukan disembunyikan.
     tempel — kotak teks. Menyalin blok dari Excel atau dari PDF yang terbuka
              di peramban selalu berhasil, dan itulah jalan keluar kalau tiga
              yang di atas gagal.

   Yang keluar dari keempatnya bentuknya sama: larik baris berisi larik sel.
   Sesudah itu jalurnya satu — tebak mana kolom nama dan mana kolom tanggal,
   tunjukkan hasilnya, dan biarkan orangnya membetulkan tebakan itu sebelum
   apa pun masuk ke jadwal.
   ======================================================================= */

/* ---------- ZIP, secukupnya untuk membuka .xlsx ---------- */

/** Kembangkan data yang dimampatkan. deflate-raw untuk isi ZIP (tanpa bungkus),
    deflate untuk aliran PDF (berbungkus zlib). */
async function kembangkan(padat, rupa){
  if(typeof DecompressionStream !== 'function'){
    throw new Error(T('peramban ini tidak bisa membuka berkas terkompresi',
                      'this browser cannot open compressed files'));
  }
  const aliran = new Blob([padat]).stream().pipeThrough(new DecompressionStream(rupa));
  return new Uint8Array(await new Response(aliran).arrayBuffer());
}

/**
 * Isi berkas ZIP yang namanya lolos saringan `mau`.
 *
 * Dibaca dari direktori pusat di ekornya, bukan dengan menyusuri header lokal
 * dari depan: header lokal boleh menyatakan ukuran nol dan menaruh ukuran
 * sebenarnya di belakang datanya, dan penyusur yang mempercayainya akan
 * tersesat di berkas pertama.
 */
async function zipBuka(buf, mau){
  const d = new DataView(buf);
  const b = new Uint8Array(buf);
  let eocd = -1;
  const batas = Math.max(0, b.length - 66000);       // 64 kB komentar + 22 B rekamannya
  for(let i = b.length - 22; i >= batas; i--){
    if(d.getUint32(i, true) === 0x06054b50){ eocd = i; break; }
  }
  if(eocd < 0) throw new Error(T('berkasnya bukan ZIP/XLSX yang utuh',
                                 'the file is not a complete ZIP/XLSX'));

  const jumlah = d.getUint16(eocd + 10, true);
  let p = d.getUint32(eocd + 16, true);
  const hasil = {};
  const namaUtf = new TextDecoder('utf-8');

  for(let n = 0; n < jumlah && p + 46 <= b.length; n++){
    if(d.getUint32(p, true) !== 0x02014b50) break;
    const metode      = d.getUint16(p + 10, true);
    const ukuranPadat = d.getUint32(p + 20, true);
    const panjangNama = d.getUint16(p + 28, true);
    const panjangTambahan = d.getUint16(p + 30, true);
    const panjangKet  = d.getUint16(p + 32, true);
    const awalLokal   = d.getUint32(p + 42, true);
    const nama = namaUtf.decode(b.subarray(p + 46, p + 46 + panjangNama));
    p += 46 + panjangNama + panjangTambahan + panjangKet;
    if(!mau(nama)) continue;

    const nl = d.getUint16(awalLokal + 26, true);
    const tl = d.getUint16(awalLokal + 28, true);
    const awalData = awalLokal + 30 + nl + tl;
    const padat = b.subarray(awalData, awalData + ukuranPadat);
    hasil[nama] = metode === 0 ? padat : await kembangkan(padat, 'deflate-raw');
  }
  return hasil;
}

/** "BC" -> 54. Dipakai supaya sel kosong di tengah baris tidak menggeser
    kolom sesudahnya — di jadwal dinas, libur memang tampil sebagai sel kosong. */
const kolomIndeks = (ref) => {
  const m = String(ref || '').match(/^([A-Z]+)/i);
  if(!m) return -1;
  let n = 0;
  for(const c of m[1].toUpperCase()) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
};

async function xlsxBaca(berkas){
  const isi = await zipBuka(await berkas.arrayBuffer(), (n)=>
    n === 'xl/sharedStrings.xml' || /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
  const teks = (n)=> isi[n] ? new TextDecoder().decode(isi[n]) : '';
  const urai = (s)=> new DOMParser().parseFromString(s, 'application/xml');

  /* Excel menyimpan tiap teks sekali saja di sharedStrings dan menaruh
     nomornya di selnya. Tanpa tabel ini, seluruh lembar terbaca sebagai angka. */
  const berbagi = [];
  if(isi['xl/sharedStrings.xml']){
    urai(teks('xl/sharedStrings.xml')).querySelectorAll('si').forEach(si=>{
      berbagi.push([...si.querySelectorAll('t')].map(t=>t.textContent).join(''));
    });
  }

  // Lembar pertama saja. Jadwal dinas yang dikirim orang selalu di lembar
  // pertama; menanyakan yang mana hanya menambah satu pertanyaan yang
  // jawabannya sudah pasti.
  const lembar = Object.keys(isi).filter(n=>n.includes('worksheets')).sort();
  if(!lembar.length) throw new Error(T('tidak ada lembar kerja di dalam berkas itu',
                                       'there is no worksheet inside that file'));

  const baris = [];
  urai(teks(lembar[0])).querySelectorAll('row').forEach(r=>{
    const sel = [];
    r.querySelectorAll('c').forEach(c=>{
      const jenis = c.getAttribute('t');
      let v = '';
      if(jenis === 'inlineStr'){
        v = [...c.querySelectorAll('t')].map(x=>x.textContent).join('');
      }else{
        const vn = c.querySelector('v');
        v = vn ? vn.textContent : '';
        if(jenis === 's') v = berbagi[Number(v)] || '';
      }
      const k = kolomIndeks(c.getAttribute('r'));
      sel[k >= 0 ? k : sel.length] = String(v).trim();
    });
    for(let i = 0; i < sel.length; i++) if(sel[i] == null) sel[i] = '';
    baris.push(sel);
  });
  return baris;
}

/* ---------- Teks berpemisah ---------- */

function csvUrai(teks){
  const contoh = String(teks).split(/\r?\n/).slice(0, 6).join('\n');
  // Pemisah ditebak dari yang paling sering muncul. Tab didahulukan karena
  // itulah yang keluar saat blok Excel disalin lewat papan klip, dan nama
  // orang sering mengandung koma.
  const pemisah = ['\t', ';', ',', '|']
    .map(p=>({ p, n: contoh.split(p).length }))
    .sort((a,b)=>b.n - a.n)[0].p;

  const baris = [];
  let sel = [], nilai = '', dalamKutip = false;
  for(let i = 0; i < teks.length; i++){
    const c = teks[i];
    if(dalamKutip){
      if(c === '"'){
        if(teks[i+1] === '"'){ nilai += '"'; i++; } else dalamKutip = false;
      }else nilai += c;
      continue;
    }
    if(c === '"'){ dalamKutip = true; continue; }
    if(c === pemisah){ sel.push(nilai.trim()); nilai = ''; continue; }
    if(c === '\n'){ sel.push(nilai.trim()); baris.push(sel); sel = []; nilai = ''; continue; }
    if(c === '\r') continue;
    nilai += c;
  }
  if(nilai || sel.length){ sel.push(nilai.trim()); baris.push(sel); }
  return baris.filter(r=>r.some(x=>x));
}

/* ---------- PDF ----------

   Yang dikerjakan cuma satu: memungut apa yang diperintahkan dicetak. Setiap
   halaman PDF adalah daftar perintah gambar, dan teksnya muncul sebagai
   `(...) Tj` atau `[...] TJ`. Perintah pemindah posisi (Td, TD, T*) dipakai
   sebagai penanda ganti baris — itu tebakan, tapi tebakan yang benar untuk
   tabel yang dicetak baris per baris.

   Yang TIDAK dikerjakan: menerjemahkan font yang membawa peta hurufnya sendiri.
   PDF dari Word dan Excel biasanya masih memakai peta baku dan terbaca; PDF
   hasil pindaian tidak berisi teks sama sekali. Keduanya ketahuan dari
   hasilnya, dan halaman ini mengatakannya. */

const pdfLepas = (s) => String(s)
  .replace(/\\([nrtbf])/g, (_,c)=>({ n:'\n', r:'\n', t:'\t', b:'', f:'\n' }[c]))
  .replace(/\\([0-7]{1,3})/g, (_,o)=>String.fromCharCode(parseInt(o, 8)))
  .replace(/\\(.)/g, '$1');

const pdfHeks = (s) => {
  const h = String(s).replace(/\s+/g, '');
  let keluar = '';
  for(let i = 0; i + 1 < h.length; i += 2) keluar += String.fromCharCode(parseInt(h.substr(i, 2), 16));
  return keluar;
};

function pdfDariAliran(isi){
  const baris = [];
  let sedang = '', tunda = '';
  const tutup = ()=>{
    sedang += tunda; tunda = '';
    if(sedang.trim()) baris.push(sedang.replace(/[ \t]+/g,' ').trim());
    sedang = '';
  };
  /* T* dipisahkan dari Td dan TD, dan itu bukan kerapian belaka: `\b` sesudah
     `T\*` tidak pernah cocok — bintang dan ganti baris sama-sama bukan huruf,
     jadi tidak ada tepi kata di antaranya. Digabung, seluruh perintah ganti
     baris terlewat dan satu halaman keluar sebagai satu baris panjang. */
  const pola = /\(((?:\\.|[^\\()])*)\)|<([0-9A-Fa-f\s]+)>|(-?\d+(?:\.\d+)?)|\b(TJ|Tj)\b|\b(Td|TD|T\*)|(['"])/g;
  let m;
  while((m = pola.exec(isi))){
    if(m[1] !== undefined)      tunda += pdfLepas(m[1]);
    else if(m[2] !== undefined) tunda += pdfHeks(m[2]);
    else if(m[3] !== undefined){
      // Angka di dalam larik TJ adalah geseran huruf dalam 1/1000 em. Yang
      // sangat negatif berarti lompatan lebar — di situlah spasi yang tidak
      // pernah ditulis sebagai huruf berada.
      if(tunda && Number(m[3]) <= -120) tunda += ' ';
    }
    else if(m[4]){ sedang += tunda; tunda = ''; }   // Tj / TJ: cetak
    else if(m[5]) tutup();                          // Td / TD / T*: pindah baris
    else if(m[6]) tutup();                          // ' dan " selalu ganti baris
  }
  tutup();
  return baris.join('\n');
}

/**
 * Baris teks polos jadi baris bersel — untuk PDF dan tempelan yang kolomnya
 * dipisah spasi, bukan tab.
 *
 * Masalahnya: memecah pada tiap spasi akan membelah "B. Santoso" jadi dua sel,
 * dan seluruh kolom sesudahnya bergeser. Yang menyelamatkan bentuknya satu
 * pengamatan: kode dinas dan angka tanggal SELALU pendek dan tanpa suku kata —
 * 'P', 'PS', '17', '-'. Jadi baris dibaca dari BELAKANG sampai bertemu kata
 * pertama yang benar-benar kata, dan segala sesuatu di depan titik itu adalah
 * nama beserta jabatannya, yang dirakit kembali jadi dua sel.
 */
function teksTabelBaris(teks){
  return String(teks).split('\n').map(b=>b.trim()).filter(Boolean).map(b=>{
    const bagian = b.split(/\s+/);
    let i = bagian.length;
    while(i > 0 && bagian[i-1].length <= 3 && !/[A-Za-z]{3,}/.test(bagian[i-1])) i--;
    const ekor = bagian.slice(i);
    if(!ekor.length) return bagian;      // bukan baris tabel: biarkan apa adanya
    const depan = bagian.slice(0, i);
    return depan.length > 1
      ? [depan.slice(0, -1).join(' '), depan[depan.length - 1], ...ekor]
      : [depan[0] || '', '', ...ekor];
  });
}

/** Teks apa pun jadi baris bersel: berpemisah kalau memang berpemisah, dipecah
    spasi kalau ternyata tidak. */
function teksKeBaris(teks){
  const baris = csvUrai(teks);
  const rata = baris.reduce((n,r)=>n + r.length, 0) / Math.max(1, baris.length);
  return rata >= 3 ? baris : teksTabelBaris(teks);
}

async function pdfBaca(berkas){
  const b = new Uint8Array(await berkas.arrayBuffer());
  const latin = new TextDecoder('latin1').decode(b);
  const potong = [];
  const pola = /stream\r?\n?/g;
  let m;
  while((m = pola.exec(latin))){
    const awal = m.index + m[0].length;
    const akhir = latin.indexOf('endstream', awal);
    if(akhir < 0) break;
    /* Ganti baris tepat sebelum `endstream` adalah pemisah menurut aturan PDF,
       bukan bagian datanya. Ikut terbawa, dan pengembangnya berhenti dengan
       kesalahan "ada sisa di belakang aliran" — seluruh halaman lalu terlewat
       tanpa satu huruf pun. */
    let ujung = akhir;
    while(ujung > awal && (b[ujung-1] === 10 || b[ujung-1] === 13)) ujung--;

    let isi = '';
    try{
      isi = new TextDecoder('latin1').decode(await kembangkan(b.subarray(awal, ujung), 'deflate'));
    }catch(e){
      isi = latin.slice(awal, ujung);    // aliran yang memang tidak dimampatkan
    }
    if(/\bTJ\b|\bTj\b/.test(isi)) potong.push(pdfDariAliran(isi));
    // Lewati 'endstream' itu sendiri: kata "stream" di dalamnya akan terjaring
    // lagi oleh pola yang sama dan melahirkan aliran hantu.
    pola.lastIndex = akhir + 9;
  }
  const teks = potong.join('\n').trim();
  if(!teks){
    throw new Error(T('tidak ada teks yang bisa dipungut dari PDF itu — kemungkinan hasil pindaian, '
                    + 'yang hurufnya sudah berupa gambar',
                      'no text could be picked out of that PDF — it is probably a scan, whose letters are '
                    + 'already images'));
  }
  return teks;
}

/* ---------- Menebak bentuk tabelnya ---------- */

/* Kode dinas di lembar Excel jarang sama persis dengan kode unitnya di sini.
   Yang libur bisa kosong, '-', 'L', 'OFF', atau 'X'. Dipetakan, dan yang tidak
   dikenali TIDAK dibuang — ia disimpan apa adanya dan dilaporkan, supaya salah
   ketik di lembar aslinya kelihatan alih-alih hilang diam-diam.

   'PS' dan 'M' polos ikut dilaporkan, bukan ditebak: keduanya belum menyebut
   JATSC atau New JATSC, dan menebak gedung tempat orang berdinas adalah hal
   terakhir yang boleh dilakukan diam-diam oleh pengimpor. */
/* 'CUTI' pergi dari daftar ini: sekarang ia kode dinas tersendiri (lihat
   KODE_DINAS di 01-unit-dan-dinas.js), bukan sinonim libur. Sel kosong betulan
   dan tanda pemisah '-'/'.' tetap dibaca sebagai libur — cuti berbeda dari
   libur karena orangnya sedang mengambil hak, bukan sedang di hari kosongnya. */
const IMPOR_LIBUR = new Set(['', '-', '—', '.', 'L', 'LIBUR', 'OFF', 'X', 'O']);

/* Nama panjang yang sudah pasti kodenya. Untuk yang tidak punya pasangan
   JATSC/New JATSC — 'MALAM' sengaja tidak ada di sini, karena ia belum
   menyebut gedung. Cuti/sakit/ijin ditulis panjang di lembar aslinya dan
   dipetakan ke kodenya yang pendek. */
const IMPOR_ALIAS = {
  'PAGI':'P', 'SIANG':'S',
  'CUTI TAHUNAN':'CUTI', 'CT':'CUTI',
  'CUTI ALASAN PENTING':'CAP', 'SAKIT':'CAP',
  'IZIN':'IJIN',
  'DINAS LUAR':'DL', 'DL':'DL'
};

function imporKode(nilai, kodeUnit){
  const asli = String(nilai == null ? '' : nilai).trim();
  const naik = asli.toUpperCase();
  if(IMPOR_LIBUR.has(naik)) return '';
  const cocok = kodeUnit.find(k=>k.toUpperCase() === naik);
  if(cocok) return cocok;
  // Nama panjang yang sudah pasti, mis. 'Pagi' pada lembar lama.
  const alias = kodeUnit.find(k=>k.toUpperCase() === IMPOR_ALIAS[naik]);
  if(alias) return alias;
  /* Singkatan yang lebih pendek daripada kodenya, mis. 'PS' pada unit yang
     satu-satunya kode PS-nya 'PSJ'. Hanya diambil kalau ia berpangkal pada
     tepat satu kode; begitu ada dua yang berawal sama — 'M' berawal sama
     dengan 'MJ' DAN 'MN' — ia memang kabur, dan nilainya dibiarkan apa adanya
     untuk dilaporkan. Menebak antara JATSC dan New JATSC bukan urusan
     pengimpor. */
  const awal = kodeUnit.filter(k=>k.toUpperCase().startsWith(naik));
  if(naik.length <= 2 && awal.length === 1) return awal[0];
  return asli;
}

/**
 * Di mana barisan tanggal berada.
 *
 * Yang dicari deretan sel berisi 1, 2, 3, ... yang panjangnya paling tidak
 * seminggu. Itu tanda kepala tabel, dan tidak ada yang lain di lembar jadwal
 * dinas yang berbentuk seperti itu — nomor urut orang berhenti di belasan, dan
 * ia menurun ke bawah, bukan melintang ke samping.
 */
function imporCariKepala(baris){
  let terbaik = null;
  baris.forEach((r, i)=>{
    const kolom = [];
    r.forEach((sel, k)=>{
      const n = Number(String(sel).trim());
      if(Number.isInteger(n) && n >= 1 && n <= 31) kolom.push({ k, n });
    });
    // Harus menaik: baris berisi angka acak (nomor telepon, jumlah jam) tidak
    // ikut terjaring.
    let panjang = 1;
    for(let x = 1; x < kolom.length; x++){
      if(kolom[x].n === kolom[x-1].n + 1) panjang++; else panjang = 1;
      if(panjang >= 7) break;
    }
    if(kolom.length >= 7 && panjang >= 7 && (!terbaik || kolom.length > terbaik.kolom.length)){
      terbaik = { indeks: i, kolom };
    }
  });
  return terbaik;
}

/** Dari larik baris mentah ke { peta, orang } yang siap ditunjukkan. */
function imporTebak(baris, hariN){
  const kepala = imporCariKepala(baris);
  let kolomHari, mulai, namaKol = 0, peranKol = -1, nikKol = -1;

  if(kepala){
    kolomHari = kepala.kolom.slice(0, hariN).map(x=>x.k);
    mulai = kepala.indeks + 1;
  }else{
    // Tanpa kepala tanggal: dianggap kolom pertama nama, kedua peran, sisanya
    // hari berurutan. Itu bentuk yang paling sering ditempel dari papan klip.
    kolomHari = Array.from({ length: hariN }, (_, i)=>i + 2);
    peranKol = 1;
    // Baris judul kolom tetap harus dilewati, kalau tidak ia masuk sebagai
    // orang bernama "NAMA" yang berdinas pada kode "1", "2", "3".
    const pertama = String((baris[0] || [])[0] || '').trim();
    mulai = /^(no\.?|nama|name|nip|nrp|nik)$/i.test(pertama) ? 1 : 0;
  }

  const hariMulai = Math.min(...kolomHari);
  const sebelum = [];
  for(let k = 0; k < hariMulai; k++) sebelum.push(k);

  /* Kolom NIK. Diambil dari sel judul kolom, bukan ditebak dari isi barisnya:
     NIK terkadang berupa digit murni dan terkadang berupa huruf+digit — mencari
     berdasar isi akan salah menuduh kolom apa pun yang kebetulan berisi angka.
     Judul kolom biasanya persis di baris kepala tanggal (satu baris dengan
     "1 2 3 ...") atau satu baris di atasnya. Kalau tidak ketemu, dibiarkan -1
     dan pemakai bisa menunjuknya sendiri lewat pemilih "Kolom NIK". */
  const kepalaCari = kepala
    ? [baris[kepala.indeks] || [], kepala.indeks > 0 ? (baris[kepala.indeks - 1] || []) : []]
    : [baris[0] || []];
  for(const kb of kepalaCari){
    for(let k = 0; k < hariMulai; k++){
      const teks = String(kb[k] || '').trim().toUpperCase();
      if(/\b(NIK|NIP|NRP)\b/.test(teks)){ nikKol = k; break; }
    }
    if(nikKol >= 0) break;
  }

  if(sebelum.length){
    // Kolom nama: yang paling sering berisi huruf di baris-baris datanya.
    // Kolom NIK dikecualikan supaya tidak salah ditunjuk sebagai nama waktu
    // NIK-nya ditulis dengan awalan huruf.
    const nilai = sebelum.map(k=>({
      k, n: baris.slice(mulai).filter(r=>/[A-Za-z]{3,}/.test(String(r[k] || ''))).length
    })).sort((a,b)=>b.n - a.n);
    const nama0 = nilai.find(x=>x.k !== nikKol);
    namaKol = nama0 ? nama0.k : (nilai[0] ? nilai[0].k : 0);
    if(peranKol < 0){
      const lain = nilai.find(x=>x.k !== namaKol && x.k !== nikKol && x.n > 0);
      peranKol = lain ? lain.k : -1;
    }
  }

  return { kolomHari, mulai, namaKol, peranKol, nikKol };
}

/** Terapkan peta kolom ke baris mentah. Dipanggil ulang tiap kali petanya diubah. */
function imporTerap(baris, peta, hariN, kodeUnit, normalkan){
  const orang = [];
  const asing = new Set();
  for(let i = peta.mulai; i < baris.length; i++){
    const r = baris[i] || [];
    const nama = String(r[peta.namaKol] || '').trim();
    // Baris tanpa nama adalah pemisah, jumlah, atau tanda tangan di kaki tabel.
    if(!nama || /^(jumlah|total|mengetahui|catatan|keterangan)\b/i.test(nama)) continue;
    if(!isNaN(Number(nama))) continue;              // nomor urut yang berdiri sendiri
    const hari = peta.kolomHari.slice(0, hariN).map(k=>{
      const mentah = String(r[k] == null ? '' : r[k]).trim();
      const nilai = normalkan ? imporKode(mentah, kodeUnit) : mentah;
      if(nilai && !kodeUnit.includes(nilai)) asing.add(nilai);
      return nilai;
    });
    while(hari.length < hariN) hari.push('');
    orang.push({
      nama: nama.slice(0, 80),
      peran: peta.peranKol >= 0 ? String(r[peta.peranKol] || '').trim().slice(0, 60) : '',
      nik:   peta.nikKol   >= 0 ? String(r[peta.nikKol]   || '').trim().slice(0, 30) : '',
      hari
    });
  }
  return { orang, asing:[...asing] };
}

/* ---------- Kartu impor ---------- */

const IMP = {
  baris: [],       // baris mentah hasil urai
  peta:  null,     // { kolomHari, mulai, namaKol, peranKol }
  orang: [],       // hasil terap, yang akan masuk ke draf
  asing: [],       // kode yang tidak dikenali unit ini
  normal: true,    // samakan kode dinas dengan kode unit?
  asal:  '',       // nama berkas atau 'tempelan', untuk keterangan
  unit:  null
};

function imporBuka(unit){
  IMP.baris = []; IMP.peta = null; IMP.orang = []; IMP.asing = [];
  IMP.normal = true; IMP.asal = ''; IMP.unit = unit;
  el('ketImpor').textContent = `${namaUnit(unit)} · ${namaBulan(JDW.lihat)}`;
  imporGambar();
  el('lapisImpor').classList.add('buka');
}

function imporTutup(){
  el('lapisImpor').classList.remove('buka');
  IMP.baris = []; IMP.orang = [];
}

function imporGambar(){
  const hariN = jumlahHari(JDW.lihat);
  const kodeUnit = infoUnit(IMP.unit).dinas || [];

  const kotakMasuk = `
    <label class="jatuh rapat" id="impJatuh">
      <div class="ajak">${T('Taruh berkas jadwal di sini','Drop the roster file here')}</div>
      <div class="ket2">${T('atau tekan untuk memilih · .xlsx · .csv · .pdf · .txt',
                            'or press to choose · .xlsx · .csv · .pdf · .txt')}</div>
      <input type="file" id="impInput" accept=".xlsx,.csv,.txt,.pdf,text/csv,text/plain,application/pdf">
    </label>
    <div class="isian" style="margin-top:13px">
      <label for="impTempel">${T('Atau tempel tabelnya di sini','Or paste the table here')}</label>
      <textarea id="impTempel" rows="4" spellcheck="false"
        placeholder="${T('Salin blok dari Excel atau dari PDF yang terbuka, lalu tempel di sini',
                         'Copy a block from Excel or from an open PDF, then paste it here')}"></textarea>
      <div class="bantu">${T('Kolom boleh dipisah tab, titik koma, atau koma.',
                             'Columns may be separated by tabs, semicolons, or commas.')}</div>
    </div>
    <div class="bantu" id="impKabar" style="margin-top:4px">${IMP.asal
      ? T(`Dibaca dari ${esc(IMP.asal)} — ${IMP.baris.length} baris.`,
          `Read from ${esc(IMP.asal)} — ${IMP.baris.length} rows.`)
      : T('Belum ada yang dibaca.','Nothing read yet.')}</div>`;

  let pratinjau = `<div class="catatan" style="margin-top:16px">${
    T('Pratinjaunya muncul di sini setelah berkasnya terbaca. Tidak ada yang masuk ke jadwal sebelum '
    + 'tombol di kaki kartu ini ditekan.',
      'The preview appears here once the file has been read. Nothing enters the roster until the button '
    + 'at the foot of this card is pressed.')}</div>`;

  if(IMP.peta){
    const kolomMax = Math.max(0, ...IMP.baris.map(r=>r.length));
    const pilihKolom = (id, label, terpilih, bolehKosong) => `
      <div class="isian" style="margin-bottom:0">
        <label for="${id}">${label}</label>
        <select id="${id}">
          ${bolehKosong ? `<option value="-1"${terpilih < 0 ? ' selected' : ''}>— ${
            T('tidak ada','none')} —</option>` : ''}
          ${Array.from({length:kolomMax}, (_,k)=>
            `<option value="${k}"${k === terpilih ? ' selected' : ''}>${T('Kolom','Column')} ${
              k + 1}${(IMP.baris[IMP.peta.mulai] || [])[k]
                ? ' · ' + esc(String((IMP.baris[IMP.peta.mulai] || [])[k]).slice(0,18)) : ''}</option>`).join('')}
        </select></div>`;

    const kepalaHari = Array.from({length:hariN}, (_,i)=>`<th>${i+1}</th>`).join('');
    const badan = IMP.orang.slice(0, 40).map(o=>`<tr>
      <td class="jdw-nama">${esc(o.nama)}</td>
      <td class="jdw-nik">${esc(o.nik || '—')}</td>
      <td class="jdw-peran">${esc(o.peran || '—')}</td>
      ${o.hari.map(h=>`<td${h && !kodeUnit.includes(h)
        ? ' style="color:var(--warn)"' : h ? ` style="color:${warnaShift(h, 'var(--text)')}"` : ''
        }>${esc(h) || '·'}</td>`).join('')}</tr>`).join('');

    pratinjau = `
      <div class="imp-atur">
        ${pilihKolom('impNama', T('Kolom nama','Name column'), IMP.peta.namaKol, false)}
        ${pilihKolom('impNik', T('Kolom NIK','ID column'), IMP.peta.nikKol, true)}
        ${pilihKolom('impPeran', T('Kolom peran','Role column'), IMP.peta.peranKol, true)}
        <div class="isian" style="margin-bottom:0">
          <label for="impMulai">${T('Baris data mulai','Data starts at row')}</label>
          <input type="number" id="impMulai" min="1" max="${Math.max(1, IMP.baris.length)}"
            value="${IMP.peta.mulai + 1}"></div>
        <label class="imp-centang"><input type="checkbox" id="impNormal"${IMP.normal ? ' checked' : ''}>
          ${T('Samakan kode dinas dengan kode unit ini','Match shift codes to this unit’s codes')}</label>
      </div>

      <div class="jdw-gulir" style="margin-top:14px">
        <table class="jdw"><thead><tr><th class="jdw-nama">${T('Nama','Name')}</th>
          <th class="jdw-nik">NIK</th>
          <th class="jdw-peran">${T('Peran','Role')}</th>${kepalaHari}</tr></thead>
          <tbody>${badan || `<tr><td colspan="${hariN+3}" style="text-align:center;color:var(--muted);padding:20px">${
            T('Tidak ada baris yang terbaca sebagai orang. Coba ubah kolom nama atau baris mulainya.',
              'No row reads as a person. Try changing the name column or the starting row.')}</td></tr>`}</tbody></table>
      </div>

      <div class="catatan" style="margin-top:14px">
        <b>${IMP.orang.length} ${T('orang terbaca','people read')}${
          IMP.orang.length > 40 ? T(' · 40 pertama yang ditampilkan',' · showing the first 40') : ''}.</b>
        ${IMP.asing.length
          ? T(`Kode yang tidak dikenal unit ini: <b>${esc(IMP.asing.slice(0,12).join(' · '))}</b>. `
            + 'Kode itu tetap dimasukkan apa adanya — tidak dibuang — supaya salah ketik di lembar '
            + 'aslinya kelihatan dan bisa dibetulkan di tabel jadwal.',
              `Codes this unit does not know: <b>${esc(IMP.asing.slice(0,12).join(' · '))}</b>. `
            + 'They are brought in as they are rather than dropped, so a typo in the original sheet stays '
            + 'visible and can be corrected in the roster table.')
          : T(`Semua kodenya dikenali unit ini (${esc(kodeUnit.join(' · '))}).`,
              `Every code is one this unit knows (${esc(kodeUnit.join(' · '))}).`)}
        ${T('Yang masuk ke jadwal adalah seluruh baris, bukan hanya yang tampil di atas.',
            'Every row goes into the roster, not only the ones shown above.')}
      </div>`;
  }

  el('badanImpor').innerHTML = kotakMasuk + pratinjau;
  el('btnPakaiImpor').disabled = !IMP.orang.length;
  imporPasang();
}

function imporUlang(){
  const hariN = jumlahHari(JDW.lihat);
  const kodeUnit = infoUnit(IMP.unit).dinas || [];
  const { orang, asing } = imporTerap(IMP.baris, IMP.peta, hariN, kodeUnit, IMP.normal);
  IMP.orang = orang; IMP.asing = asing;
}

async function imporTerima(berkas){
  const kabar = el('impKabar');
  const nama = berkas.name || '';
  const rendah = nama.toLowerCase();
  kabar.textContent = T('Membaca ' + nama + '...', 'Reading ' + nama + '...');
  try{
    let baris;
    if(rendah.endsWith('.xlsx'))      baris = await xlsxBaca(berkas);
    else if(rendah.endsWith('.pdf'))  baris = teksTabelBaris(await pdfBaca(berkas));
    else if(rendah.endsWith('.xls')){
      throw new Error(T('.xls yang lama tidak bisa dibaca di sini — simpan ulang sebagai .xlsx.',
                        'The old .xls format cannot be read here — save it again as .xlsx.'));
    }
    else                              baris = teksKeBaris(await berkas.text());
    imporPakaiBaris(baris, nama);
  }catch(e){
    kabar.innerHTML = `<span style="color:var(--fail)">${
      T('Gagal membaca: ','Could not read it: ')}${esc(e && e.message || e)}</span>`;
  }
}

function imporPakaiBaris(baris, asal){
  if(!baris.length){
    el('impKabar').innerHTML = `<span style="color:var(--fail)">${
      T('Tidak ada satu baris pun yang terbaca.','Not a single row could be read.')}</span>`;
    return;
  }
  IMP.baris = baris;
  IMP.asal  = asal;
  IMP.peta  = imporTebak(baris, jumlahHari(JDW.lihat));
  imporUlang();
  imporGambar();
}

function imporPasang(){
  const jatuh = el('impJatuh'); if(!jatuh) return;
  const masuk = el('impInput');
  masuk.addEventListener('change', ()=>{
    if(masuk.files[0]) imporTerima(masuk.files[0]);
    masuk.value = '';
  });
  ['dragenter','dragover'].forEach(n=>jatuh.addEventListener(n, e=>{
    e.preventDefault(); jatuh.classList.add('siap'); }));
  ['dragleave','drop'].forEach(n=>jatuh.addEventListener(n, e=>{
    e.preventDefault(); jatuh.classList.remove('siap'); }));
  jatuh.addEventListener('drop', e=>{
    if(e.dataTransfer && e.dataTransfer.files[0]) imporTerima(e.dataTransfer.files[0]);
  });

  // Tempelan diurai begitu ditempel, tanpa tombol: satu langkah lebih sedikit,
  // dan hasilnya langsung terlihat di pratinjau di bawahnya.
  const tempel = el('impTempel');
  const bacaTempel = ()=>{
    const t = tempel.value.trim();
    if(t.length > 3) imporPakaiBaris(teksKeBaris(t), T('tempelan','pasted text'));
  };
  tempel.addEventListener('paste', ()=>setTimeout(bacaTempel, 0));
  tempel.addEventListener('change', bacaTempel);

  if(!IMP.peta) return;
  const ubahPeta = (id, kunci)=>{
    const e = el(id); if(!e) return;
    e.addEventListener('change', ()=>{
      IMP.peta[kunci] = Number(e.value);
      imporUlang(); imporGambar();
    });
  };
  ubahPeta('impNama', 'namaKol');
  ubahPeta('impNik', 'nikKol');
  ubahPeta('impPeran', 'peranKol');
  const mulai = el('impMulai');
  if(mulai) mulai.addEventListener('change', ()=>{
    IMP.peta.mulai = Math.max(0, Number(mulai.value) - 1);
    imporUlang(); imporGambar();
  });
  const normal = el('impNormal');
  if(normal) normal.addEventListener('change', ()=>{
    IMP.normal = normal.checked; imporUlang(); imporGambar();
  });
}

el('btnBatalImpor').addEventListener('click', imporTutup);
el('lapisImpor').addEventListener('click', e=>{ if(e.target === el('lapisImpor')) imporTutup(); });
document.addEventListener('keydown', e=>{
  if(e.key === 'Escape' && el('lapisImpor').classList.contains('buka')) imporTutup();
});

el('btnPakaiImpor').addEventListener('click', ()=>{
  if(!IMP.orang.length) return;
  const jumlah = IMP.orang.length;
  // Ke draf, bukan ke yang tersimpan: yang diimpor masih harus dilihat sekali
  // lagi di tabel jadwal yang sebenarnya, dan Batal di sana masih membatalkan
  // seluruhnya. Tombol Simpan jadwal yang menuliskannya.
  JDW.draf = IMP.orang.map(o=>({ nama:o.nama, peran:o.peran, nik:o.nik || '', hari:[...o.hari] }));
  JDW.sunting = true;
  imporTutup();
  jdwGambar();
  pesan(T(`${jumlah} orang masuk ke jadwal — periksa, lalu tekan Simpan jadwal.`,
          `${jumlah} people brought into the roster — check it, then press Save roster.`));
});

