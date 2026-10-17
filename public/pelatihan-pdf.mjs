/* =======================================================================
   MEMBACA PDF SERTIFIKAT PELATIHAN

   Modul ES yang dimuat 24-personel.js lewat import() saat tombol "Isi dari
   PDF sertifikat" ditekan — bukan bagian dari /js/semua.js, jadi tidak ikut
   dimuat di halaman depan. Sepola dengan isr-pdf.mjs dan memakai pdf.js yang
   sama (public/vendor/pdfjs/).

   Beda dengan ISR: sertifikat pelatihan tidak keluar dari satu cetakan.
   Tiap penyelenggara punya tata letak sendiri, jadi pembacaannya bukan per
   kolom melainkan per pola — nomor, tanggal (Indonesia/Inggris, tunggal
   maupun rentang), kalimat "telah mengikuti ...", "diselenggarakan oleh ...".
   Hasilnya TEBAKAN: ditampilkan bergaris biru di kartu, orangnya memeriksa,
   lalu menekan Simpan.

   PDF hasil pindai tidak berisi teks. Untuk itu pemanggil boleh memberikan
   fungsi OCR (Tesseract yang sudah ada di public/vendor/ocr/); halaman
   pertama digambar ke kanvas lalu dibaca. Semua berjalan di peramban — PDF
   sertifikat tidak dikirim ke mana pun untuk dibaca.

   uraiSertifikat() murni (tanpa DOM) supaya bisa diuji di Node.
   ======================================================================= */

const BULAN = {
  januari:1, jan:1, january:1,
  februari:2, feb:2, pebruari:2, february:2,
  maret:3, mar:3, march:3,
  april:4, apr:4,
  mei:5, may:5,
  juni:6, jun:6, june:6,
  juli:7, jul:7, july:7,
  agustus:8, agu:8, agt:8, ags:8, aug:8, august:8,
  september:9, sep:9, sept:9,
  oktober:10, okt:10, oct:10, october:10,
  november:11, nov:11, nopember:11,
  desember:12, des:12, dec:12, december:12
};
const NAMA_BULAN = Object.keys(BULAN).sort((a,b)=>b.length - a.length).join('|');

const iso = (d, m, y) => {
  d = Number(d); m = Number(m); y = Number(y);
  if(y < 100) y += 2000;
  if(!(d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1990 && y <= 2100)) return '';
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
};
const bln = (s) => BULAN[String(s).toLowerCase().replace(/\.$/,'')] || 0;

/* Kategori eChain: kata kunci -> label. Urutan penting: yang spesifik dulu. */
const KATEGORI = [
  ['WORKSHOP',      /\bworkshop|lokakarya\b/i],
  ['SEMINAR',       /\bseminar|webinar|simposium|symposium|konferensi|conference\b/i],
  ['CONTINUATION',  /\bcontinuation|refreshment|refresher|recurrent|penyegaran\b/i],
  ['ADVANCED',      /\badvance[d]?\b|\blanjut(an)?\b/i],
  ['BASIC',         /\bbasic\b|\bdasar\b/i],
  ['MANAGERIAL',    /\bmanag(erial|ement)|manajerial|kepemimpinan|leadership\b/i],
  ['DEVELOPMENTAL', /\bdevelopmental|pengembangan\b/i],
  ['KURSUS',        /\bkursus|course\b/i],
  ['MANDATORY',     /\bmandatory|wajib\b/i]
];

/* Kalimat pengantar nama pelatihan di badan sertifikat. */
const PEMICU_NAMA = /(telah\s+(?:mengikuti|menyelesaikan|lulus(?:\s+dari)?)|sebagai\s+peserta(?:\s+dalam|\s+pada)?|atas\s+partisipasi(?:nya)?\s+(?:dalam|pada|sebagai\s+peserta)|has\s+(?:successfully\s+)?(?:attended|completed|participated\s+in|passed)|for\s+(?:attending|completing|participating\s+in)|in\s+recognition\s+of\s+(?:attending|completing))\s*[:\-]?\s*/i;
const PEMICU_TEMPAT = /\b(yang\s+diselenggarakan\s+oleh|diselenggarakan\s+oleh|penyelenggara\s*:?|organi[sz]ed\s+by|conducted\s+by|held\s+by|presented\s+by|bertempat\s+di|held\s+(?:at|in))\s*/i;
const PENUTUP_NAMA = /^(yang\s+diselenggarakan|diselenggarakan|pada\s+tanggal|tanggal|held|conducted|organi[sz]ed|on\s+\d|from\s+\d|di\s+[A-Z]|bertempat|sebanyak|selama|with\s+|dengan\s+(?:hasil|predikat|nilai))/i;

const rapi = (s) => String(s || '').replace(/[“”"«»]/g,'').replace(/\s+/g,' ').trim().replace(/^[\s:;,.\-–]+|[\s:;,\-–]+$/g,'');

/** Semua tanggal tunggal di teks, berurutan: [{iso, i}] (i = posisi). */
function semuaTanggal(t){
  const hasil = [];
  const tambah = (v, i) => { if(v && !hasil.some(h=>h.i === i)) hasil.push({ iso:v, i }); };
  let m;
  // 12 Oktober 2026 / 12 Okt. 2026
  const p1 = new RegExp(`\\b(\\d{1,2})\\s+(${NAMA_BULAN})\\.?\\s+(\\d{4})\\b`, 'gi');
  while((m = p1.exec(t))) tambah(iso(m[1], bln(m[2]), m[3]), m.index);
  // October 12, 2026 / Oct 12 2026
  const p2 = new RegExp(`\\b(${NAMA_BULAN})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, 'gi');
  while((m = p2.exec(t))) tambah(iso(m[2], bln(m[1]), m[3]), m.index);
  // 12/10/2026, 12-10-2026, 12.10.2026 (hari dulu, lazim di Indonesia)
  const p3 = /\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})\b/g;
  while((m = p3.exec(t))) tambah(iso(m[1], m[2], m[3]), m.index);
  // 2026-10-12
  const p4 = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
  while((m = p4.exec(t))) tambah(iso(m[3], m[2], m[1]), m.index);
  return hasil.sort((a,b)=>a.i - b.i);
}

const SAMPAI = '(?:-|–|—|s\\.?\\s?d\\.?|s\\/d|sampai(?:\\s+dengan)?|hingga|to|until|through|and)';

/** Rentang tanggal pelaksanaan: {mulai, selesai} atau null. */
function rentang(t){
  let m;
  // 1 - 3 Oktober 2026 / 1 s.d. 3 Oktober 2026
  m = new RegExp(`\\b(\\d{1,2})\\s*${SAMPAI}\\s*(\\d{1,2})\\s+(${NAMA_BULAN})\\.?\\s+(\\d{4})\\b`, 'i').exec(t);
  if(m){ const b = bln(m[3]); return { mulai: iso(m[1], b, m[4]), selesai: iso(m[2], b, m[4]) }; }
  // 28 September - 2 Oktober 2026 / 28 September 2026 s.d. 2 Oktober 2026
  m = new RegExp(`\\b(\\d{1,2})\\s+(${NAMA_BULAN})\\.?(?:\\s+(\\d{4}))?\\s*${SAMPAI}\\s*(\\d{1,2})\\s+(${NAMA_BULAN})\\.?\\s+(\\d{4})\\b`, 'i').exec(t);
  if(m) return { mulai: iso(m[1], bln(m[2]), m[3] || m[6]), selesai: iso(m[4], bln(m[5]), m[6]) };
  // October 1 - 3, 2026
  m = new RegExp(`\\b(${NAMA_BULAN})\\.?\\s+(\\d{1,2})\\s*${SAMPAI}\\s*(\\d{1,2}),?\\s+(\\d{4})\\b`, 'i').exec(t);
  if(m){ const b = bln(m[1]); return { mulai: iso(m[2], b, m[4]), selesai: iso(m[3], b, m[4]) }; }
  // 01/10/2026 - 03/10/2026
  m = new RegExp(`\\b(\\d{1,2})[\\/.\\-](\\d{1,2})[\\/.\\-](\\d{4})\\s*${SAMPAI}\\s*(\\d{1,2})[\\/.\\-](\\d{1,2})[\\/.\\-](\\d{4})\\b`, 'i').exec(t);
  if(m) return { mulai: iso(m[1], m[2], m[3]), selesai: iso(m[4], m[5], m[6]) };
  return null;
}

/** Tanggal tanda tangan: "Jakarta, 3 Oktober 2026" / "Diberikan/Issued ... tanggal". */
function tanggalTerbit(baris){
  const kota = new RegExp(`^[A-Z][A-Za-z .'-]{2,30},\\s*(\\d{1,2}\\s+(?:${NAMA_BULAN})\\.?\\s+\\d{4}|(?:${NAMA_BULAN})\\.?\\s+\\d{1,2},?\\s+\\d{4}|\\d{1,2}[\\/.\\-]\\d{1,2}[\\/.\\-]\\d{4})`, 'i');
  for(let i = baris.length - 1; i >= 0; i--){
    const m = kota.exec(baris[i]);
    if(m){ const t = semuaTanggal(m[1])[0]; if(t) return t.iso; }
  }
  const label = /(diberikan|dikeluarkan|diterbitkan|ditetapkan|issued|given|date\s+of\s+issue|tanggal\s+terbit)/i;
  for(const b of baris){
    if(label.test(b)){ const t = semuaTanggal(b)[0]; if(t) return t.iso; }
  }
  return '';
}

/** Nomor sertifikat. */
function nomor(baris, teks){
  const label = /\b(?:no(?:mor)?|number|nr|cert(?:ificate)?\s*no)\b\.?\s*(?:sertifikat|certificate|seri)?\s*[:.#]?\s*([A-Z0-9][A-Z0-9 .\/\-_]{2,60})/i;
  for(const b of baris){
    const m = label.exec(b);
    if(m){
      const v = m[1].trim().split(/\s{2,}/)[0].replace(/\s+(?:tanggal|date|tgl)\b.*$/i,'').replace(/[.\s]+$/,'');
      if(/\d/.test(v) && v.length >= 3) return v;
    }
  }
  // Tanpa label: kode berpemisah garis miring/strip yang memuat angka.
  const m = /\b([A-Z0-9]{1,12}(?:[\/.\-][A-Z0-9]{1,15}){2,8})\b/.exec(teks);
  if(m && /\d/.test(m[1]) && !semuaTanggal(m[1]).length) return m[1];
  return '';
}

/** Nama pelatihan. */
function namaPelatihan(baris){
  for(let i = 0; i < baris.length; i++){
    const m = PEMICU_NAMA.exec(baris[i]);
    if(!m) continue;
    const ambil = [];
    const sisa = rapi(baris[i].slice(m.index + m[0].length));
    if(sisa) ambil.push(sisa);
    for(let j = i + 1; j < baris.length && ambil.join(' ').length < 140; j++){
      const b = rapi(baris[j]);
      if(!b) continue;
      if(PENUTUP_NAMA.test(b) || semuaTanggal(b).length) break;
      ambil.push(b);
      if(ambil.length >= 3) break;
    }
    let nama = rapi(ambil.join(' ')
      .split(PEMICU_TEMPAT)[0]                 // potong "... diselenggarakan oleh ..."
      .replace(new RegExp(`\\b(pada|tanggal|on|from)\\b.*\\d{4}.*$`, 'i'), ''));
    if(nama.length >= 4) return nama.slice(0, 160);
  }
  // Cadangan: baris terpanjang yang menyebut jenis kegiatan, bukan judul "SERTIFIKAT".
  const kunci = /(pelatihan|training|course|kursus|workshop|seminar|webinar|diklat|bimtek|bimbingan\s+teknis|sosialisasi|refreshment|familiari[sz]ation|ojt|on[\s-]the[\s-]job)/i;
  const calon = baris.map(rapi).filter(b=>kunci.test(b) && !/^(sertifikat|certificate|piagam)\b/i.test(b) && b.length <= 160);
  calon.sort((a,b)=>b.length - a.length);
  return calon[0] || '';
}

/** Tempat / penyelenggara. */
function tempat(baris){
  for(let i = 0; i < baris.length; i++){
    const m = PEMICU_TEMPAT.exec(baris[i]);
    if(!m) continue;
    let v = rapi(baris[i].slice(m.index + m[0].length));
    if(!v && baris[i+1]) v = rapi(baris[i+1]);
    v = rapi(v.replace(new RegExp(`\\b(pada|tanggal|on|from)\\b.*$`, 'i'), '').split(/\s{2,}/)[0]);
    if(v.length >= 3 && !/^\d/.test(v)) return v.slice(0, 160);
  }
  const lembaga = /(perum\s+lppnpi|airnav\s+indonesia|politeknik|akademi|sekolah\s+tinggi|stpi|ppi\s+curug|balai|pusat\s+pengembangan|universitas|institut|\bpt\.?\s+[A-Z]|\bcv\.?\s+[A-Z]|kementerian|direktorat)/i;
  const c = baris.map(rapi).find(b=>lembaga.test(b) && b.length <= 120);
  return c || '';
}

/**
 * Teks sertifikat (baris dipisah \n) -> isian pelatihan.
 * Semua kunci selalu ada; yang tidak terbaca berisi ''.
 */
export function uraiSertifikat(teks, namaOrang){
  const baris = String(teks || '').split(/\r?\n/).map(b=>b.replace(/\s+/g,' ').trim()).filter(Boolean);
  const satu = baris.join('\n');
  const isi = { kategori:'', nama:'', nomor:'', tempat:'', mulai:'', selesai:'', tglSert:'' };
  if(!baris.length) return { isi, cocokNama: null };

  isi.nama   = namaPelatihan(baris);
  isi.nomor  = nomor(baris, satu);
  isi.tempat = tempat(baris);

  const r = rentang(satu.replace(/\n/g,' '));
  isi.tglSert = tanggalTerbit(baris);
  if(r){ isi.mulai = r.mulai; isi.selesai = r.selesai; }
  else {
    // Satu tanggal pelaksanaan: tanggal pertama yang bukan tanggal tanda tangan.
    const tgl = semuaTanggal(satu).map(t=>t.iso).filter(t=>t !== isi.tglSert);
    if(tgl.length){ isi.mulai = tgl[0]; isi.selesai = tgl[0]; }
    else if(isi.tglSert){ isi.mulai = isi.tglSert; isi.selesai = isi.tglSert; }
  }
  if(!isi.tglSert) isi.tglSert = isi.selesai || '';

  // Kategori hanya dari nama pelatihan, lalu judul sertifikat (beberapa baris
  // teratas, sebelum nama penerima). Seluruh teks terlalu lebar: "Pusat
  // Pengembangan SDM" di nama penyelenggara bukan berarti pelatihannya
  // DEVELOPMENTAL. Tidak yakin = kosong, dipilih orangnya.
  const judul = baris.slice(0, Math.max(1, baris.findIndex(b=>/diberikan|kepada|presented\s+to|this\s+is\s+to\s+certify|awarded\s+to/i.test(b)))).join(' ');
  const kat = KATEGORI.find(([, pola]) => pola.test(isi.nama)) || KATEGORI.find(([, pola]) => pola.test(judul));
  isi.kategori = kat ? kat[0] : '';

  // Apakah sertifikat ini atas nama orang yang sedang dibuka? (kata pertama nama)
  let cocokNama = null;
  const kata = String(namaOrang || '').toLowerCase().split(/\s+/)
    .map(k=>k.replace(/[^a-z]/g,'')).filter(k=>k.length >= 3);
  if(kata.length) cocokNama = kata.some(k=>new RegExp(`\\b${k}\\b`, 'i').test(satu));
  return { isi, cocokNama };
}

/* ---------- pdf.js ---------- */

let pdfjsJanji = null;
function muatPdfjs(){
  if(!pdfjsJanji){
    pdfjsJanji = import(new URL('vendor/pdfjs/pdf.min.mjs', import.meta.url).href).then(pdfjs=>{
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
      return pdfjs;
    });
    pdfjsJanji.catch(()=>{ pdfjsJanji = null; });
  }
  return pdfjsJanji;
}

/** Potongan teks satu halaman -> baris, atas ke bawah. */
function keBaris(items){
  const pot = items.filter(it=>'str' in it && it.str.trim())
    .map(it=>({ s: it.str, x: it.transform[4], y: it.transform[5], h: Math.abs(it.transform[3]) || 10 }));
  pot.sort((a,b)=>b.y - a.y || a.x - b.x);
  const baris = [];
  for(const p of pot){
    const b = baris.find(r=>Math.abs(r.y - p.y) <= Math.max(2, p.h * 0.35));
    if(b) b.isi.push(p); else baris.push({ y: p.y, isi: [p] });
  }
  return baris.map(b=>b.isi.sort((a,c)=>a.x - c.x).map(p=>p.s).join(' ').replace(/\s+/g,' ').trim());
}

/**
 * Baca satu File PDF sertifikat.
 * @param {File} berkas
 * @param {object} [opsi] { namaOrang, ocr: async (canvas) => teks }
 * @returns {Promise<{isi, cocokNama, sumber:'teks'|'ocr'|'kosong'}>}
 */
export async function bacaPdfPelatihan(berkas, opsi = {}){
  const pdfjs = await muatPdfjs();
  const data = new Uint8Array(await berkas.arrayBuffer());
  const dok = await pdfjs.getDocument({ data, verbosity: 0, isEvalSupported: false }).promise;
  try{
    const baris = [];
    const n = Math.min(dok.numPages, 3);         // sertifikat jarang lebih dari 1–2 halaman
    for(let i = 1; i <= n; i++){
      baris.push(...keBaris((await (await dok.getPage(i)).getTextContent()).items));
    }
    let teks = baris.join('\n'), sumber = 'teks';

    // Hampir tanpa teks: hasil pindai. Gambar halaman 1 lalu OCR, kalau disediakan.
    if(teks.replace(/\s/g,'').length < 20){
      sumber = 'kosong';
      if(typeof opsi.ocr === 'function'){
        const hal = await dok.getPage(1);
        const vp = hal.getViewport({ scale: 2.2 });
        const kanvas = document.createElement('canvas');
        kanvas.width = Math.ceil(vp.width); kanvas.height = Math.ceil(vp.height);
        const ctx = kanvas.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, kanvas.width, kanvas.height);
        await hal.render({ canvasContext: ctx, viewport: vp }).promise;
        teks = String(await opsi.ocr(kanvas) || '');
        if(teks.replace(/\s/g,'').length >= 20) sumber = 'ocr';
      }
    }
    const { isi, cocokNama } = uraiSertifikat(teks, opsi.namaOrang);
    return { isi, cocokNama, sumber };
  }finally{
    dok.destroy();
  }
}
