/* =======================================================================
   MEMBACA PDF IZIN STASIUN RADIO

   Modul ES yang dimuat 37-isr.js lewat import() saat tombol "Isi dari PDF"
   ditekan — bukan bagian dari /js/semua.js. Semua orang membuka dashboard;
   hanya PIC ISR yang mengunggah PDF izin, jadi pembaca PDF-nya (pdf.js,
   ±1,8 MB di public/vendor/pdfjs/) tidak ikut dimuat di halaman depan.

   Seluruhnya berjalan di peramban: PDF izin tidak dikirim ke mana pun untuk
   dibaca. Yang sampai ke server hanya hasil isiannya (lewat Simpan biasa) dan
   berkas PDF-nya sebagai lampiran.

   isrUraiPdf() murni dan teruji: tools/uji-isr-pdf.mjs.
   ======================================================================= */

/* ---------- Membaca PDF ISR (SDPPI / DJID) ----------
   PDF ISR dari Kominfo/Komdigi selalu keluar dari cetakan yang sama: kepala
   izin (No Izin, Tanggal Berlaku ... s/d ...), tabel stasiun (Nama dan Lokasi
   Stasiun · Tanda Panggil · Pemegang izin · Alamat · Kota · Koordinat), lalu
   tabel perangkat (Perangkat · Tipe/No Seri · Daya · Kelas Emisi ·
   Frekuensi). Isinya teks asli, bukan hasil pindai, jadi tiap potongan teks
   datang lengkap dengan posisinya — pembacaannya PER KOLOM, bukan menebak
   dari teks yang sudah teraduk urutannya.
   Fungsi-fungsi di sini murni (tanpa DOM): masukannya potongan {s,x,y,w} per
   halaman, persis bentuk getTextContent() pdf.js. Diuji terhadap 13 PDF ISR
   JATSC terbitan 2022–2026, cetakan SDPPI maupun DJID. */

const ISR_BULAN = ['januari','februari','maret','april','mei','juni','juli',
                   'agustus','september','oktober','november','desember'];
const ISR_POLA_TGL = /(\d{1,2})\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+(\d{4})/gi;

function isrTglIso(d, bln, th){
  const m = ISR_BULAN.indexOf(String(bln).toLowerCase()) + 1;
  return m ? `${th}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}` : '';
}

/** Kumpulkan potongan sebaris (selisih y kecil) jadi teks baris, atas ke bawah. */
function isrBaris(pot, toleransi = 3){
  const urut = [...pot].sort((a,b)=>b.y - a.y || a.x - b.x);
  const baris = [];
  for(const p of urut){
    const b = baris.find(r=>Math.abs(r.y - p.y) <= toleransi);
    if(b) b.isi.push(p); else baris.push({ y: p.y, isi: [p] });
  }
  return baris.map(b=>({ y: b.y, teks: b.isi.sort((a,c)=>a.x - c.x).map(p=>p.s).join(' ').replace(/\s+/g,' ').trim() }));
}

/** Tabel stasiun: judul kolomnya rata tengah dan isinya kurang lebih di
    bawahnya, jadi tiap potongan masuk ke kolom yang titik tengah judulnya
    paling dekat dengan titik tengah potongan itu. */
function isrKeKolom(pot, judul){
  const kolom = {};
  Object.keys(judul).forEach(k=>kolom[k] = []);
  for(const p of pot){
    const tengah = p.x + p.w/2;
    let kunci = null, jarak = Infinity;
    for(const [k,j] of Object.entries(judul)){
      const d = Math.abs(j.x + j.w/2 - tengah);
      if(d < jarak){ jarak = d; kunci = k; }
    }
    kolom[kunci].push(p);
  }
  return kolom;
}

/**
 * halaman: array per halaman berisi potongan {s,x,y,w} (y membesar ke atas,
 * seperti koordinat PDF). judulDok: Title di metadata PDF, kalau ada.
 * Hasilnya bentuk isian kartu ISR, atau null kalau ini bukan cetakan ISR.
 */
export function isrUraiPdf(halaman, judulDok){
  const layak = (p) => p && typeof p.s === 'string' && p.s.trim() && !/^Page \d+ of \d+$/i.test(p.s.trim());
  halaman = halaman.map(h=>h.filter(layak));
  const semua = halaman.flat();
  if(!semua.length) return null;
  const teksSemua = isrBaris(semua).map(b=>b.teks).join('\n');

  const nomorM = teksSemua.match(/\b(\d{1,6})\s*\/\s*DU\s*\/\s*([A-Z]{2,})\s*\/\s*(\d{4})\b/);
  if(!nomorM && !/Nama dan Lokasi Stasiun/i.test(teksSemua)) return null;
  const nomor = nomorM ? `${nomorM[1]}/DU/${nomorM[2]}/${nomorM[3]}` : '';

  // Tanggal ada di baris kepala: "<terbit> s/d <habis>". Tanggalnya kadang
  // terpecah ("05 Oktober" + "2030") — isrBaris menyambungnya lagi.
  let mulai = '', habis = '';
  const sd = teksSemua.match(new RegExp(ISR_POLA_TGL.source + '\\s*s\\s*/\\s*d\\s*' + ISR_POLA_TGL.source, 'i'));
  if(sd){
    mulai = isrTglIso(sd[1], sd[2], sd[3]);
    habis = isrTglIso(sd[4], sd[5], sd[6]);
  }else{
    const h = teksSemua.match(new RegExp('s\\s*/\\s*d\\s*' + ISR_POLA_TGL.source, 'i'));
    if(h) habis = isrTglIso(h[1], h[2], h[3]);
    const t = [...teksSemua.matchAll(ISR_POLA_TGL)].find(m=>isrTglIso(m[1],m[2],m[3]) !== habis);
    if(t) mulai = isrTglIso(t[1], t[2], t[3]);
  }

  // ---- Tabel stasiun & tabel perangkat, per halaman ----
  let stasiun = null;
  const alat = [];
  for(const pot of halaman){
    const cari = (re) => pot.find(p=>re.test(p.s.trim()));
    const jNama = cari(/^Nama dan Lokasi Stasiun/i);
    const jAlat = cari(/^Perangkat$/i) || cari(/^Equipment$/i);
    const jTtd  = pot.filter(p=>/^(a\.?\s?n\.?\s|Untuk menjadi perhatian)/i.test(p.s.trim()))
                     .sort((a,b)=>b.y - a.y)[0];

    if(jNama && !stasiun){
      const sebaris = (re) => pot.find(p=>re.test(p.s.trim()) && Math.abs(p.y - jNama.y) <= 3);
      const judul = { nama: jNama };
      const jp = sebaris(/^Tanda Panggil/i), jpg = sebaris(/^Pemegang izin/i),
            ja = sebaris(/^Alamat$/i), jk = sebaris(/^Kota$/i), jo = sebaris(/^Koordinat$/i);
      if(jp) judul.panggil = jp;
      if(jpg) judul.pemegang = jpg;
      if(ja) judul.alamat = ja;
      if(jk) judul.kota = jk;
      if(jo) judul.koord = jo;
      const bawah = jAlat ? jAlat.y + 12 : -Infinity;
      // Baris kedua judul (versi Inggris) duduk ±7 titik di bawahnya — dilewati.
      const isi = pot.filter(p=>p.y < jNama.y - 10 && p.y > bawah);
      const k = isrKeKolom(isi, judul);
      const garis = (kk) => k[kk] ? isrBaris(k[kk]).map(b=>b.teks).filter(Boolean) : [];
      stasiun = {
        kiri: garis('nama'), panggil: garis('panggil').join(' '),
        koord: garis('koord').map(t=>t.replace(/\s*°\s*/g,'° ')).join(', ')
      };
    }

    if(jAlat){
      const sebaris = (re) => pot.find(p=>re.test(p.s.trim()) && Math.abs(p.y - jAlat.y) <= 3);
      const judul = { perangkat: jAlat };
      const jt = sebaris(/^Tipe\s*\/\s*No Seri|^Type\s*\/\s*Serial/i), jd = sebaris(/^Daya$|^Power/i),
            je = sebaris(/^Kelas Emisi|^Emission$/i), jf = sebaris(/^Frekuensi$|^Frequencies$/i);
      if(jt) judul.tipe = jt;
      if(jd) judul.daya = jd;
      if(je) judul.emisi = je;
      if(jf) judul.frek = jf;
      const batasBawah = jTtd && jTtd.y < jAlat.y ? jTtd.y + 4 : 0;
      // Judul tabel ini sampai tiga baris (Kelas Emisi / Class of / Emission).
      const isi = pot.filter(p=>p.y < jAlat.y - 18 && p.y > batasBawah);
      const k = isrKeKolom(isi, judul);
      // "SN." yang berdiri sendiri (nomor seri kosong) terlalu pendek: titik
      // tengahnya jatuh lebih dekat ke judul Perangkat. Tempatnya di Tipe.
      if(k.tipe){
        k.tipe.push(...k.perangkat.filter(p=>/^S\/?N\b/i.test(p.s.trim())));
        k.perangkat = k.perangkat.filter(p=>!/^S\/?N\b/i.test(p.s.trim()));
      }
      // Tiap baris perangkat berjangkar pada nama perangkatnya; Tipe/No Seri
      // di sebelahnya bisa turun dua-tiga baris.
      const jangkar = isrBaris(k.perangkat).map(b=>b.y);
      jangkar.forEach((y, i)=>{
        const ybawah = i + 1 < jangkar.length ? jangkar[i+1] + 3 : -Infinity;
        const dlm = (kk) => (k[kk] || []).filter(p=>p.y <= y + 3 && p.y > ybawah);
        const teks = (kk) => isrBaris(dlm(kk)).map(b=>b.teks).join(' ').trim();
        // Tipe dulu, lalu "SN. ..." yang bisa bersambung ke baris berikutnya.
        const tipeBaris = isrBaris(dlm('tipe')).map(b=>b.teks);
        const iSn = tipeBaris.findIndex(t=>/^S\/?N\b/i.test(t));
        const tipe = (iSn < 0 ? tipeBaris : tipeBaris.slice(0, iSn)).join(' ').replace(/\s*\/$/,'').trim();
        const sn = iSn < 0 ? '' : tipeBaris.slice(iSn).join('')
                    .replace(/^S\/?N\.?\s*/i,'').replace(/[;:,\s]+$/,'').trim();
        // Kolom Kelas Emisi sempit dan frekuensi ILS/DME/radar tercetak mepet
        // ke kirinya — jadi keduanya dipilah dari ISINYA, bukan dari kolomnya.
        const ef = [teks('emisi'), teks('frek')].join(' ');
        const fm = ef.match(/(\d+(?:[.,]\d+)?)\s*(MHz|kHz|GHz)/i);
        // Nomor kanal bisa berhuruf ("CH :71AA", "CH :69B1") — ikut dibuang.
        const emisi = ef.replace(/CH\s*:\s*[0-9A-Z]+/ig,'')
                        .replace(/\(?\s*\d+(?:[.,]\d+)?\s*(MHz|kHz|GHz)\s*\)?/ig,'')
                        .replace(/\s+/g,' ').trim();
        alat.push({
          perangkat: teks('perangkat'), tipe, sn, daya: teks('daya'), emisi,
          frek: fm ? `${fm[1].replace(',','.')} ${fm[2][0].toUpperCase() === 'K' ? 'kHz' : fm[2][0].toUpperCase() + 'Hz'}` : ''
        });
      });
    }
  }

  // ---- Bentuk isian ----
  // Kolom kiri tabel stasiun: nama stasiun lalu lokasinya, bersambung dalam
  // kolom sempit. Nama berhenti di baris yang tampak seperti awal alamat; kalau
  // tak ada penanda itu, baris pertama saja.
  const kiri = stasiun ? stasiun.kiri : [];
  const awalAlamat = /^(BANDARA|KANTOR|JLN?\b|JL\.|JALAN|GEDUNG|GD\b|GD\.|KOMPLEK|KOMP\b|KAWASAN|KP\b|KAMPUNG|DESA|DS\b|KEL\b|KEL\.|KELURAHAN|DUSUN|AREA|LAPANGAN|MENARA|SHELTER)/i;
  let nNama = kiri.findIndex((t,i)=>i > 0 && awalAlamat.test(t));
  if(nNama < 0) nNama = Math.min(1, kiri.length);
  const namaStasiun = kiri.slice(0, nNama).join(' ').trim();
  const lokasiTeks = kiri.slice(nNama).join(' ').replace(/\s*,\s*/g,', ').trim();

  const unik = (arr) => [...new Set(arr.filter(Boolean))];
  const frek = unik(alat.map(a=>a.frek)).join('; ');
  const lokasi = [lokasiTeks, stasiun && stasiun.koord].filter(Boolean).join(' · ');

  const kelasTeks = teksSemua + '\n' + (judulDok || '');
  const kelas = /DARAT\s*UDARA|GROUND\s*TO\s*AIR|_AE_GA\b/i.test(kelasTeks) ? 'Darat-Udara (Ground to Air)'
    : /MARITIM|MARITIME/i.test(kelasTeks) ? 'Maritim' : '';

  // Perangkat yang sama (tipe, SN, daya, emisi sama) disebut sekali dengan
  // frekuensinya dijejer — satu ISR VHF bisa memuat empat-lima kanal.
  const kelompok = [];
  for(const a of alat){
    const kunci = [a.perangkat, a.tipe, a.sn, a.daya, a.emisi].join('|');
    const g = kelompok.find(x=>x.kunci === kunci);
    if(g){ if(a.frek && !g.frek.includes(a.frek)) g.frek.push(a.frek); }
    else kelompok.push({ ...a, kunci, frek: a.frek ? [a.frek] : [] });
  }
  const ketAlat = kelompok.map(a=>[
      [a.perangkat, a.tipe].filter(Boolean).join(' '),
      a.sn && 'SN ' + a.sn,
      a.daya && a.daya + ' W',
      a.emisi,
      a.frek.join(' / ')
    ].filter(Boolean).join(', '));
  // Tanda panggil sering sama dengan nama stasiun dan terpotong di tengah kata
  // oleh kolomnya yang sempit ("JAKARTA APPROAC H") — disebut hanya bila beda.
  const rapat = (t) => String(t || '').replace(/[^A-Z0-9]/gi,'').toUpperCase();
  const panggil0 = stasiun && stasiun.panggil && !/^-+$/.test(stasiun.panggil) ? stasiun.panggil : '';
  const panggil = panggil0 && rapat(panggil0) !== rapat(namaStasiun) ? panggil0 : '';
  const ket = [panggil && 'Tanda panggil ' + panggil, ...ketAlat].filter(Boolean).join(' | ');

  const jenisAlat = unik(kelompok.map(a=>a.perangkat));
  return {
    nama: [namaStasiun, jenisAlat.join('/')].filter(Boolean).join(' — '),
    nomor, frek, kelas, lokasi, mulai, habis, ket
  };
}

/* ---------- Dari berkas ke potongan teks ---------- */

let pdfjsJanji = null;
function muatPdfjs(){
  if(!pdfjsJanji){
    pdfjsJanji = import(new URL('vendor/pdfjs/pdf.min.mjs', import.meta.url).href).then(pdfjs=>{
      // Alamat penuh: pekerja pdf.js tidak punya halaman untuk acuan alamat relatif.
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
      return pdfjs;
    });
    pdfjsJanji.catch(()=>{ pdfjsJanji = null; });   // gagal muat boleh dicoba lagi
  }
  return pdfjsJanji;
}

/**
 * Baca satu File PDF jadi isian ISR. Melempar galat bila berkasnya bukan PDF
 * yang terbaca; mengembalikan { isi: null, teks } bila PDF-nya terbaca tetapi
 * tidak berisi teks (hasil pindai) atau bukan cetakan ISR.
 */
export async function bacaPdfIsr(berkas){
  const pdfjs = await muatPdfjs();
  const data = new Uint8Array(await berkas.arrayBuffer());
  const dok = await pdfjs.getDocument({ data, verbosity: 0, isEvalSupported: false }).promise;
  try{
    const halaman = [];
    for(let i = 1; i <= dok.numPages; i++){
      const tc = await (await dok.getPage(i)).getTextContent();
      halaman.push(tc.items.filter(it=>'str' in it)
        .map(it=>({ s: it.str, x: it.transform[4], y: it.transform[5], w: it.width })));
    }
    const meta = await dok.getMetadata().catch(()=>null);
    const judulDok = meta && meta.info && meta.info.Title || '';
    const jumlahTeks = halaman.reduce((n,h)=>n + h.filter(p=>p.s.trim()).length, 0);
    return { isi: isrUraiPdf(halaman, judulDok), adaTeks: jumlahTeks > 0 };
  }finally{
    dok.destroy();
  }
}
