/* =======================================================================
   IMPOR SPAREPART — dari Excel, CSV, PDF, atau tempelan

   Alasannya sama persis dengan impor jadwal dinas, dan itu sebabnya berkas ini
   TIDAK membawa pembaca berkasnya sendiri: daftar sparepart lahir di lembar
   Excel gudang, bukan di layar ini. Mengetik ulang ratusan baris — nama, part
   number, rak, stok, minimum — satu per satu lewat kartu "Tambah sparepart"
   adalah cara paling pasti untuk membuat daftarnya tidak pernah terisi.

   Pembaca berkasnya dipakai bersama dari 22-impor-jadwal.js: xlsxBaca,
   pdfBaca, teksKeBaris, teksTabelBaris. Satu ZIP, satu pengurai XML, satu
   pemungut teks PDF — dan kalau salah satunya diperbaiki, keduanya ikut
   membaik. Karena itu berkas ini WAJIB dimuat sesudah 22.

   BEDANYA DENGAN JADWAL DINAS, dan bedanya besar:

     Jadwal dinas berbentuk matriks — satu baris satu orang, satu kolom satu
     tanggal, dan yang perlu ditebak cuma di mana barisan tanggalnya. Sparepart
     berbentuk tabel biasa: tiap kolom punya arti sendiri, dan judul kolomnya
     ditulis orang dengan kata yang berbeda-beda tiap unit. Jadi yang ditebak
     di sini bukan satu hal melainkan sebelas, dan tiap tebakan bisa dibetulkan
     sendiri lewat pemilih kolom di kartunya.

     Jadwal dinas masuk ke DRAF: yang diimpor masih harus ditekan Simpan sekali
     lagi di tabel jadwal. Sparepart tidak punya draf — kartu Tambah/Ubah pun
     menyimpan langsung ke server. Karena itu pratinjau di sini yang menjadi
     langkah pemeriksaannya, dan tombolnya menyebutkan sendiri apa yang akan
     terjadi: berapa baris ditambah, berapa diperbarui, berapa hilang.
   ======================================================================= */

/* ---------- Mengenali judul kolom ----------

   Satu daftar per kolom yang kita kenal. Ditulis huruf kecil tanpa tanda baca,
   karena judul yang dibaca dinormalkan lebih dulu — 'P/N', 'p / n', dan 'PN'
   semuanya sampai ke sini sebagai 'pn'.

   Urutan medannya adalah urutan prioritas saat dua medan memperebutkan kolom
   yang sama: 'part' cocok untuk nama maupun part number, dan yang lebih pasti
   didahulukan. */
const SPR_JUDUL = {
  nama:   ['nama sparepart','nama barang','nama part','nama','sparepart','spare part',
           'spartpart','barang','item','material','uraian','deskripsi','description'],
  pn:     ['kode material','material code','material number','part number','partnumber',
           'part no','no part','nomor part','kode barang','kode part','pn','p n','partno','kode'],
  // Kolom lembar SAP gudang (Albanav SAP Navigasi.xlsx dan sejenisnya).
  sloc:   ['sloc','storage location','s loc'],
  gudang: ['kode gudang','gudang','warehouse','plant'],
  status: ['status','kondisi','condition'],
  stok:   ['stok','stock','jumlah','qty','quantity','sisa','saldo','on hand','ada'],
  nilai:  ['value','nilai','harga','price','nilai barang'],
  min:    ['stok minimum','minimum','min stok','min','reorder point','reorder','rop',
           'safety stock','batas minimum'],
  satuan: ['satuan','uom','unit','sat'],
  rak:    ['rak','rack','shelf','bin','lokasi rak','lokasi','location','tempat'],
  tambah: ['tanggal ditambahkan','ditambahkan','tanggal masuk','tgl masuk','masuk','date added','added'],
  pakai:  ['tanggal dipakai','dipakai terakhir','pemakaian terakhir','terakhir dipakai','last used',
           'tanggal pakai','tgl pakai','dipakai','terakhir','pemakaian','tanggal','tgl'],
  ket:    ['ket','keterangan','catatan','remark','remarks','note'],
  merk:   ['merk','merek','brand','make','pabrikan','manufacturer'],
  tipe:   ['tipe','type','model','tipe model'],
  sn:     ['serial number','serialnumber','no seri','nomor seri','serial','sn','s n'],
  tahun:  ['tahun pembuatan','tahun','year','thn']
};

/** Medan yang harus ada sebelum sebuah baris pantas disebut kepala tabel. */
const SPR_MEDAN = Object.keys(SPR_JUDUL);

/** 'P/N ' -> 'p n'. Tanda baca jadi spasi, bukan dibuang: 'P/N' tidak boleh
    menyusut jadi 'pn' lewat jalan yang juga menyatukan kata lain tanpa sela. */
const sprRata = (s) => String(s == null ? '' : s)
  .toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
  .replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Seberapa yakin judul `teks` menyebut medan `medan`.
 *   3 — persis sama
 *   2 — salah satu katanya persis, mis. 'stok akhir' untuk 'stok'
 *   1 — tersebut di dalamnya, mis. 'jumlah stok gudang'
 *   0 — tidak menyebut sama sekali
 */
function sprCocok(teks, medan, kamus = SPR_JUDUL){
  const t = sprRata(teks);
  if(!t) return 0;
  const kata = t.split(' ');
  let nilai = 0;
  for(const j of kamus[medan]){
    if(t === j) return 3;
    if(j.includes(' ') ? t.includes(j) : kata.includes(j)) nilai = Math.max(nilai, 2);
    else if(t.includes(j)) nilai = Math.max(nilai, 1);
  }
  return nilai;
}

/**
 * Pasangkan medan dengan kolom dari satu baris judul.
 *
 * Serakah dan dua arah: seluruh pasangan yang mungkin diberi nilai, diurutkan
 * dari yang paling yakin, lalu diambil selama medan DAN kolomnya sama-sama
 * masih bebas. Dengan begitu 'Part Number' mengambil kolomnya lebih dulu
 * daripada 'nama' yang cuma bernilai 1 di kolom yang sama, dan satu kolom
 * tidak pernah dipakai dua medan.
 */
function sprPasangkan(judul, kamus = SPR_JUDUL){
  const MEDAN = Object.keys(kamus);
  const calon = [];
  judul.forEach((sel, k)=>{
    MEDAN.forEach((m, urut)=>{
      const n = sprCocok(sel, m, kamus);
      if(n) calon.push({ m, k, n, urut });
    });
  });
  calon.sort((a,b)=> b.n - a.n || a.urut - b.urut || a.k - b.k);

  const peta = {}, kolomTerpakai = new Set();
  for(const c of calon){
    if(peta[c.m] !== undefined || kolomTerpakai.has(c.k)) continue;
    peta[c.m] = c.k;
    kolomTerpakai.add(c.k);
  }
  for(const m of MEDAN) if(peta[m] === undefined) peta[m] = -1;
  return peta;
}

/**
 * Di baris mana kepala tabelnya, dan kolom mana untuk medan mana.
 *
 * Lembar gudang hampir selalu berkop — nama kantor, judul, tanggal cetak —
 * jadi baris pertama bukan judul kolom. Yang dicari baris yang paling banyak
 * menyebut judul yang kita kenal, dan minimal harus menyebut nama atau part
 * number: tanpa salah satunya, tabel itu bukan tabel sparepart.
 */
function sprTebak(baris){
  let terbaik = null;
  baris.slice(0, 20).forEach((r, i)=>{
    if(!r || !r.length) return;
    const peta = sprPasangkan(r);
    const yakin = SPR_MEDAN.reduce((n, m)=> n + (peta[m] >= 0 ? sprCocok(r[peta[m]], m) : 0), 0);
    const adaPokok = peta.nama >= 0 || peta.pn >= 0;
    const jumlah = SPR_MEDAN.filter(m=>peta[m] >= 0).length;
    if(adaPokok && jumlah >= 2 && (!terbaik || yakin > terbaik.yakin)){
      terbaik = { peta, yakin, kepala: i, mulai: i + 1 };
    }
  });

  // Tanpa kepala yang terbaca — mis. tempelan tanpa baris judul. Bukan alasan
  // untuk menyerah: pemilih kolom di kartunya tetap digambar, dan orangnya
  // menunjuk sendiri kolom mana yang mana.
  if(!terbaik){
    const peta = Object.fromEntries(SPR_MEDAN.map(m=>[m, -1]));
    peta.nama = 0; peta.pn = 1;
    return { peta, kepala: -1, mulai: 0 };
  }
  return terbaik;
}

/* ---------- Membaca nilai satu sel ---------- */

/** Angka bulat dari sel apa pun. '1.000' jadi 1000, '12 pcs' jadi 12, kosong
    jadi bawaan. Pemisah ribuan dibuang tanpa ditanya — stok barang tidak
    pernah pecahan, jadi tidak ada titik desimal yang bisa hilang di situ. */
function sprAngka(nilai, bawaan){
  const t = String(nilai == null ? '' : nilai).replace(/[^\d-]/g, '');
  if(!t || t === '-') return bawaan;
  const n = parseInt(t, 10);
  return Number.isFinite(n) ? Math.min(99999, Math.max(0, n)) : bawaan;
}

/** Rupiah dari sel. Tanpa batas 99999 seperti jumlah — value SAP ratusan juta.
    '313.490.000' dan 'Rp 313490000' sama-sama jadi 313490000. */
function sprRupiah(nilai){
  const asli = String(nilai == null ? '' : nilai).trim();
  // Angka mentah dari sel xlsx boleh berpecahan ('6822045.5') — titiknya desimal.
  if(/^\d+(\.\d+)?(e\+?\d+)?$/i.test(asli)) return Math.min(1e13, Math.round(Number(asli)));
  const t = asli.replace(/[^\d]/g, '');
  return t ? Math.min(1e13, parseInt(t, 10)) : 0;
}

/**
 * Tanggal dari sel Excel, CSV, atau PDF.
 *
 * Yang berbentuk 45231 adalah nomor hari Excel — itulah yang keluar dari sel
 * bertanggal, karena pembacanya membaca nilai sel dan bukan gaya tampilannya.
 * Ditafsirkan sebagai tanggal HANYA di kolom ini dan hanya dalam rentang yang
 * masuk akal (1954–2064); angka di kolom lain tidak pernah lewat sini.
 *
 * Titik pangkalnya 1899-12-30, bukan 1900-01-01: Excel menghitung 1900 sebagai
 * tahun kabisat padahal bukan, dan pangkal yang digeser sehari itulah yang
 * membuat seluruh tanggal sesudah Februari 1900 jatuh pas.
 */
function sprTanggal(nilai){
  const asli = String(nilai == null ? '' : nilai).trim();
  if(!asli) return '';

  const iso = asli.match(/(\d{4})-(\d{2})-(\d{2})/);
  if(iso) return iso[0];

  // 17/08/2026 dan 17-8-26. Hari di depan: itu bentuk yang dipakai di sini,
  // dan lembar yang datang dari Excel berbahasa Inggris sudah keluar sebagai
  // nomor hari, bukan sebagai teks berbulan-di-depan.
  const dmy = asli.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
  if(dmy){
    const [, d, m, y] = dmy;
    const tahun = y.length === 2 ? (Number(y) > 70 ? '19' + y : '20' + y) : y;
    const t = `${tahun}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    return /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(t) ? t : '';
  }

  if(/^\d{4,5}$/.test(asli)){
    const n = Number(asli);
    if(n >= 20000 && n <= 60000){
      const d = new Date(Date.UTC(1899, 11, 30) + n * 86400000);
      return d.toISOString().slice(0, 10);
    }
  }
  return '';
}

/* ---------- Dari baris mentah ke daftar sparepart ---------- */

/**
 * Terapkan peta kolom ke baris mentah.
 *
 * Yang dikembalikan bukan cuma barisnya: baris yang DILEWATI ikut dilaporkan
 * beserta alasannya. Baris yang hilang diam-diam dari sebuah impor adalah
 * kerusakan yang paling lama tidak ketahuan — orang menutup kartunya dengan
 * yakin, dan kekurangannya baru terasa berbulan-bulan kemudian di gudang.
 */
function sprTerap(baris, peta, mulai){
  const isi = [];
  const lewat = [];
  const pnGanda = new Set();
  const pnAda = new Set();

  const sel = (r, k) => k >= 0 ? String(r[k] == null ? '' : r[k]).trim() : '';
  /* Judul VALUE di lembar SAP digabung dua sel: kiri berisi 'IDR', angkanya di
     kanan. Kalau sel di bawah judul tidak berangka, sel kanannya yang dibaca. */
  const selNilai = (r) => {
    const k = peta.nilai;
    if(k < 0) return '';
    const v = sel(r, k);
    return /\d/.test(v) ? v : sel(r, k + 1);
  };

  for(let i = mulai; i < baris.length; i++){
    const r = baris[i] || [];
    if(!r.some(x=>String(x == null ? '' : x).trim())) continue;   // baris kosong

    const nama = sel(r, peta.nama).slice(0, 120);
    const pn   = sel(r, peta.pn).slice(0, 60);

    // Kaki tabel: jumlah, tanda tangan, catatan. Bukan barang. Baris yang
    // nama dan kodenya sama-sama kosong sesudah barang pertama adalah akhir
    // tabelnya — di lembar SAP itu baris SUM, dan di bawahnya daftar Kode
    // Warna / PIC yang bukan barang.
    if(!nama && !pn){ if(isi.length) break; continue; }
    if(/^(jumlah|total|mengetahui|catatan|keterangan|dibuat oleh|diperiksa)\b/i.test(nama)) continue;

    if(!nama){ lewat.push({ no:i + 1, sebab:T('nama kosong','name is empty'), teks:pn || r.join(' ') }); continue; }
    if(!pn){   lewat.push({ no:i + 1, sebab:T('kode material kosong','material code is empty'), teks:nama }); continue; }

    const kunci = pn.toLowerCase();
    if(pnAda.has(kunci)){
      pnGanda.add(pn);
      lewat.push({ no:i + 1, sebab:T('kode material kembar di berkas ini','duplicate material code in this file'), teks:`${nama} · ${pn}` });
      continue;
    }
    pnAda.add(kunci);

    isi.push({
      nama, pn,
      sloc:   sel(r, peta.sloc).slice(0, 12),
      gudang: sel(r, peta.gudang).slice(0, 12),
      status: sel(r, peta.status).toUpperCase().slice(0, 20),
      rak:    sel(r, peta.rak).slice(0, 24),
      stok:   sprAngka(sel(r, peta.stok), 0),
      nilai:  sprRupiah(selNilai(r)),
      min:    sprAngka(sel(r, peta.min), 0),
      satuan: sel(r, peta.satuan).toUpperCase().slice(0, 12) || 'UNT',
      tambah: sprTanggal(sel(r, peta.tambah)),
      pakai:  sprTanggal(sel(r, peta.pakai)),
      ket:    sel(r, peta.ket).slice(0, 200),
      merk:   sel(r, peta.merk).slice(0, 60),
      tipe:   sel(r, peta.tipe).slice(0, 120),
      sn:     sel(r, peta.sn).slice(0, 60),
      tahun:  sel(r, peta.tahun).slice(0, 10)
    });
  }

  return { isi, lewat, pnGanda:[...pnGanda] };
}

/**
 * Baris hasil impor, hanya dengan medan yang kolomnya dipilih (plus nama dan
 * kode material). Dipakai untuk memperbarui baris yang sudah tersimpan: kolom
 * yang tidak ada di berkas tidak boleh mengosongkan isian yang sudah diisi di
 * aplikasi — mis. Tanggal dipakai yang dicatat teknisi, yang tidak dikenal
 * lembar SAP gudang.
 */
function sprMedanTerpilih(x, peta){
  const hasil = { nama: x.nama, pn: x.pn };
  for(const m of SPR_MEDAN) if(peta[m] >= 0 && m in x) hasil[m] = x[m];
  return hasil;
}

/**
 * Apa yang akan terjadi kalau tombolnya ditekan — dihitung sebelum ditekan.
 *
 * Pegangan sebuah baris adalah part numbernya, sama dengan di kartu Tambah/Ubah
 * sparepart. Yang PN-nya sudah ada diperbarui di tempat (idnya tetap, jadi
 * apa pun yang kelak menunjuk baris itu tidak putus); yang belum ada
 * ditambahkan di ekor daftar.
 */
function sprHitungAkibat(hasil, unit, ganti){
  const lama = PART.filter(p=>p.unit === unit);
  const petaLama = new Map(lama.map(p=>[String(p.pn).toLowerCase(), p]));
  const baru = [], perbarui = [];
  for(const x of hasil.isi){
    (petaLama.has(x.pn.toLowerCase()) ? perbarui : baru).push(x);
  }
  const pnBaru = new Set(hasil.isi.map(x=>x.pn.toLowerCase()));
  const hilang = ganti ? lama.filter(p=>!pnBaru.has(String(p.pn).toLowerCase())) : [];
  return { lama, baru, perbarui, hilang, jumlahAkhir: ganti ? hasil.isi.length : lama.length + baru.length };
}

/* ---------- Lembar rekap pemakaian dan pengadaan ----------

   Buku orang sparepart punya lembar "Rekap Pemakaian dan Pengadaan Suku
   Cadang" (Valuated dan Non Valuated): satu baris satu kejadian — TAHUN,
   BULAN, KODE MATERIAL, NAMA ALAT, KELUAR, MASUK, SISA, IDR, UNIT, KET (GI/GR),
   lalu keterangan bebas di kolom tanpa judul sesudahnya. Lembar seperti itu
   tidak masuk daftar sparepart, melainkan riwayat unitnya (PART_RIWAYAT). */
const RWY_JUDUL = {
  tahun:   ['tahun','year','thn'],
  bulan:   ['bulan','month','bln'],
  tanggal: ['tanggal','tgl','date'],
  pn:      ['kode material','material code','part number','kode barang','kode'],
  nama:    ['nama alat','nama barang','nama sparepart','nama','barang','material','item'],
  keluar:  ['keluar','pemakaian','dipakai'],
  masuk:   ['masuk','pengadaan','ditambahkan'],
  sisa:    ['sisa','saldo','stok','stock'],
  nilai:   ['idr','value','nilai','rupiah','harga'],
  unit:    ['unit','unit pengelola'],
  kode:    ['ket','gi gr'],
  ket:     ['keterangan','catatan','remark','remarks','note']
};
const RWY_MEDAN = Object.keys(RWY_JUDUL);

/* Sebutan unit di buku sparepart → kode unit di sini. Dicocokkan utuh sesudah
   dirapikan, bukan sebagian: 'Pengamatan dan FDPS-RDPS' tidak boleh jatuh ke
   salah satunya. */
const SPR_UNIT_SEBUT = {
  radtel:         ['srsj','radtel','radio telekomunikasi','vcs'],
  radkom:         ['radkom','radio komunikasi'],
  ppabn:          ['navigasi','ppabn','alat bantu navigasi'],
  pengamatan:     ['radar','pengamatan'],
  amhsadps:       ['amhs','amss adps','amhs adps','amss'],
  fdpsrdps:       ['rdps','fdps rdps','fdps'],
  listrikmekanik: ['listrik dan mekanik','listrik','mekanik'],
  gedungkeamanan: ['gedung dan keamanan','gedung','keamanan']
};
function sprUnitDari(teks){
  const t = sprRata(teks);
  if(!t) return null;
  for(const [kode, sebut] of Object.entries(SPR_UNIT_SEBUT)){
    if(sebut.includes(t) || t === kode || t === sprRata(namaUnit(kode))) return kode;
  }
  return null;
}

const SPR_BULAN = {
  januari:1, january:1, jan:1, februari:2, february:2, feb:2, pebruari:2, maret:3, march:3, mar:3,
  april:4, apr:4, mei:5, may:5, juni:6, june:6, jun:6, juli:7, july:7, jul:7,
  agustus:8, august:8, agu:8, agt:8, aug:8, september:9, sept:9, sep:9,
  oktober:10, october:10, okt:10, oct:10, november:11, nopember:11, nov:11,
  desember:12, december:12, des:12, dec:12
};

/** Kepala lembar rekap: harus ada KELUAR, MASUK, dan kode material. */
function sprTebakRiwayat(baris){
  for(let i = 0; i < Math.min(baris.length, 20); i++){
    const r = baris[i] || [];
    const peta = sprPasangkan(r, RWY_JUDUL);
    if(peta.pn < 0 || peta.keluar < 0 || peta.masuk < 0) continue;
    if(sprCocok(r[peta.keluar], 'keluar', RWY_JUDUL) < 2 || sprCocok(r[peta.masuk], 'masuk', RWY_JUDUL) < 2) continue;
    // Keterangan bebas ada di kolom tanpa judul tepat sesudah KET.
    if(peta.ket < 0 && peta.kode >= 0 && !String(r[peta.kode + 1] || '').trim()) peta.ket = peta.kode + 1;
    return { peta, mulai: i + 1 };
  }
  return null;
}

function sprTerapRiwayat(baris, peta, mulai, unit){
  const isi = [], lewat = [];
  const unitLain = {};
  let tahunLalu = '', bulanLalu = 0;
  const sel = (r, k) => k >= 0 ? String(r[k] == null ? '' : r[k]).trim() : '';

  for(let i = mulai; i < baris.length; i++){
    const r = baris[i] || [];
    const pn = sel(r, peta.pn).slice(0, 60);
    if(!pn) continue;                       // kaki: "total barang", "value"
    const nama = sel(r, peta.nama).slice(0, 120);
    const keluar = sprAngka(sel(r, peta.keluar), 0);
    const masuk  = sprAngka(sel(r, peta.masuk), 0);
    if(!keluar && !masuk){
      lewat.push({ no:i + 1, sebab:T('keluar dan masuk kosong','out and in are empty'), teks:nama || pn });
      continue;
    }

    /* Bulan yang dikosongkan di rekap berarti "sama dengan baris di atasnya"
       — selama tahunnya sama. Kalau tidak ada yang bisa diwarisi, cukup tahun. */
    const tahunSel = sel(r, peta.tahun);
    const tahun = /^\d{4}$/.test(tahunSel) ? tahunSel : tahunLalu;
    const bulanSel = sprRata(sel(r, peta.bulan));
    let bulan = SPR_BULAN[bulanSel] || (/^\d{1,2}$/.test(bulanSel) && Number(bulanSel) <= 12 ? Number(bulanSel) : 0);
    if(!bulan && !bulanSel && tahun === tahunLalu) bulan = bulanLalu;
    const tanggal = sprTanggal(sel(r, peta.tanggal));
    const tgl = tanggal || (tahun ? (bulan ? `${tahun}-${String(bulan).padStart(2,'0')}` : tahun) : '');
    if(tahun){ tahunLalu = tahun; bulanLalu = bulan; }
    if(!tgl){
      lewat.push({ no:i + 1, sebab:T('tahun/tanggal kosong','year/date is empty'), teks:nama || pn });
      continue;
    }

    if(peta.unit >= 0){
      const sebut = sel(r, peta.unit);
      const kode = sprUnitDari(sebut);
      if(kode !== unit){ const k = sebut || '—'; unitLain[k] = (unitLain[k] || 0) + 1; continue; }
    }

    const sisaSel = sel(r, peta.sisa);
    isi.push({
      tgl, pn, nama, keluar, masuk,
      sisa: sisaSel === '' ? '' : sprAngka(sisaSel, 0),
      nilai: sprRupiah(sel(r, peta.nilai)),
      kode: sel(r, peta.kode).toUpperCase().slice(0, 12),
      ket: sel(r, peta.ket).slice(0, 200)
    });
  }
  return { isi, lewat, unitLain };
}

const rwyKunci = (x) => [x.tgl, x.pn, x.keluar, x.masuk, x.sisa].join('|').toLowerCase();

/** Mana yang baru dan mana yang sudah tercatat. Dihitung sebagai multiset:
    rekap sah memuat dua kejadian kembar di bulan yang sama, jadi yang kembar
    di berkas hanya dianggap "sudah ada" sebanyak yang memang tersimpan. */
function sprAkibatRiwayat(hasil, unit){
  const hitung = new Map();
  for(const r of PART_RIWAYAT[unit] || []) hitung.set(rwyKunci(r), (hitung.get(rwyKunci(r)) || 0) + 1);
  const baru = [], ada = [];
  for(const x of hasil.isi){
    const k = rwyKunci(x), n = hitung.get(k) || 0;
    if(n){ hitung.set(k, n - 1); ada.push(x); } else baru.push(x);
  }
  return { baru, ada };
}

/** Lembar yang dipilih pertama kali: yang namanya menyebut unit ini. */
function sprLembarAwal(lembar, unit){
  const i = lembar.findIndex(l=>sprUnitDari(l.nama) === unit);
  return i >= 0 ? i : 0;
}

/* ---------- Kartu impor ---------- */

/* Batas baris per unit di server (lihat app.put('/unitdb/:modul/:unit') —
   .slice(0, 300)). Diketahui di sini supaya kelebihannya bisa dikatakan
   sebelum tombolnya ditekan, bukan hilang diam-diam sesudahnya. */
const SPR_BATAS_BARIS = 300;

const SPR = {
  baris: [],     // baris mentah hasil urai
  peta:  null,   // { nama, pn, rak, stok, min, satuan, pakai, merk, tipe, sn, tahun }
  mulai: 0,      // baris data pertama
  hasil: null,   // { isi, lewat, pnGanda }
  ganti: false,  // ganti seluruh daftar unit ini, bukan menambah & memperbarui
  asal:  '',
  unit:  null,
  mode:  'daftar',  // 'daftar' (lembar sparepart) | 'riwayat' (lembar rekap keluar/masuk)
  lembar: [],       // semua lembar .xlsx: [{ nama, baris }]
  lembarKe: 0
};

function sprImporBuka(unit){
  SPR.baris = []; SPR.peta = null; SPR.mulai = 0;
  SPR.hasil = null; SPR.ganti = false; SPR.asal = ''; SPR.unit = unit;
  SPR.mode = 'daftar'; SPR.lembar = []; SPR.lembarKe = 0;
  el('ketImporPart').textContent = `${namaUnit(unit)} · ${
    PART.filter(p=>p.unit === unit).length} ${T('baris tersimpan','rows stored')}`;
  sprGambar();
  el('lapisImporPart').classList.add('buka');
}

function sprImporTutup(){
  el('lapisImporPart').classList.remove('buka');
  SPR.baris = []; SPR.hasil = null;
}

/** Nama medan sebagaimana tertulis di layar. */
const sprLabel = () => ({
  nama:   T('Nama barang','Item name'),
  pn:     T('Kode material','Material code'),
  sloc:   'SLOC',
  gudang: T('Kode gudang','Warehouse code'),
  status: 'Status',
  rak:    T('Rak','Rack'),
  stok:   T('Jumlah','Quantity'),
  nilai:  'Value (IDR)',
  min:    T('Minimum','Minimum'),
  satuan: T('Satuan','Unit'),
  tambah: T('Tanggal ditambahkan','Date added'),
  pakai:  T('Tanggal dipakai','Date used'),
  ket:    T('Keterangan','Note'),
  merk:   T('Merk','Make'),
  tipe:   T('Tipe / model','Type / model'),
  sn:     'Serial number',
  tahun:  T('Tahun','Year')
});

function sprGambar(){
  const kotakMasuk = `
    <label class="jatuh rapat" id="sprJatuh">
      <div class="ajak">${T('Taruh berkas sparepart di sini','Drop the spare parts file here')}</div>
      <div class="ket2">${T('atau tekan untuk memilih · .xlsx · .csv · .pdf · .txt',
                            'or press to choose · .xlsx · .csv · .pdf · .txt')}</div>
      <input type="file" id="sprInput" accept=".xlsx,.csv,.txt,.pdf,text/csv,text/plain,application/pdf">
    </label>
    <div class="isian" style="margin-top:13px">
      <label for="sprTempel">${T('Atau tempel tabelnya di sini','Or paste the table here')}</label>
      <textarea id="sprTempel" rows="4" spellcheck="false"
        placeholder="${T('Salin blok dari Excel — sertakan baris judul kolomnya — lalu tempel di sini',
                         'Copy a block from Excel — include the header row — then paste it here')}"></textarea>
      <div class="bantu">${T('Kolom boleh dipisah tab, titik koma, atau koma.',
                             'Columns may be separated by tabs, semicolons, or commas.')}</div>
    </div>
    <div class="bantu" id="sprKabar" style="margin-top:4px">${SPR.asal
      ? T(`Dibaca dari ${esc(SPR.asal)} — ${SPR.baris.length} baris.`,
          `Read from ${esc(SPR.asal)} — ${SPR.baris.length} rows.`)
        + ' ' + (SPR.mode === 'riwayat'
          ? T('<b>Lembar rekap pemakaian & pengadaan</b> — masuk ke riwayat, bukan ke daftar.',
              '<b>Usage & procurement recap sheet</b> — goes into the history, not the list.')
          : T('<b>Lembar daftar sparepart.</b>','<b>Spare parts list sheet.</b>'))
      : T('Belum ada yang dibaca.','Nothing read yet.')}</div>
    ${SPR.lembar.length > 1 ? `
    <div class="isian" style="margin-top:10px;max-width:360px">
      <label for="sprLembar">${T('Lembar','Sheet')}</label>
      <select id="sprLembar">${SPR.lembar.map((l, i)=>
        `<option value="${i}"${i === SPR.lembarKe ? ' selected' : ''}>${esc(l.nama)}</option>`).join('')}</select>
      <div class="bantu">${T('Satu lembar per unit untuk daftar sparepart; lembar Rekap untuk riwayat. '
        + 'Baris rekap unit lain dilewati.',
          'One sheet per unit for the spare parts list; the Recap sheets for the history. '
        + 'Recap rows of other units are skipped.')}</div></div>` : ''}`;

  let pratinjau = `<div class="catatan" style="margin-top:16px">${
    T('Pratinjaunya muncul di sini setelah berkasnya terbaca. Tidak ada satu baris pun yang '
    + 'tersimpan sebelum tombol di kaki kartu ini ditekan.',
      'The preview appears here once the file has been read. Not a single row is saved until the '
    + 'button at the foot of this card is pressed.')}</div>`;

  if(SPR.hasil && SPR.mode === 'riwayat'){
    pratinjau = sprPratinjauRiwayat();
  }else if(SPR.hasil){
    const label = sprLabel();
    const kolomMax = Math.max(0, ...SPR.baris.map(r=>r.length));
    const barisJudul = SPR.baris[Math.max(0, SPR.mulai - 1)] || [];
    const pilihKolom = (m) => `
      <div class="isian" style="margin-bottom:0">
        <label for="spr_${m}">${label[m]}</label>
        <select id="spr_${m}" data-medan="${m}">
          <option value="-1"${SPR.peta[m] < 0 ? ' selected' : ''}>— ${T('tidak ada','none')} —</option>
          ${Array.from({length:kolomMax}, (_,k)=>
            `<option value="${k}"${k === SPR.peta[m] ? ' selected' : ''}>${T('Kolom','Column')} ${k+1}${
              barisJudul[k] ? ' · ' + esc(String(barisJudul[k]).slice(0,18)) : ''}</option>`).join('')}
        </select></div>`;

    const akibat = sprHitungAkibat(SPR.hasil, SPR.unit, SPR.ganti);
    const petaBaru = new Set(akibat.baru.map(x=>x.pn));
    const badan = SPR.hasil.isi.slice(0, 40).map(x=>{
      const w = x.stok === 0 ? 'var(--fail)' : 'var(--text)';
      return `<tr>
        <td><span class="cip ${petaBaru.has(x.pn) ? 'aman' : 'awas'}">${
          petaBaru.has(x.pn) ? T('baru','new') : T('perbarui','update')}</span></td>
        <td><span class="mono">${esc(x.pn)}</span></td>
        <td>${esc(x.nama)}</td>
        <td><span class="rak-kode">${esc(x.sloc || '—')}</span></td>
        <td><span class="rak-kode">${esc(x.gudang || '—')}</span></td>
        <td>${partStatusCip(x.status)}</td>
        <td>${esc(x.satuan)}</td>
        <td class="mono" style="text-align:right;color:${w};font-weight:600">${
          SPR.peta.stok >= 0 ? x.stok : '—'}</td>
        <td class="mono" style="text-align:right">${SPR.peta.nilai >= 0 ? partRupiah(x.nilai) : '—'}</td>
        <td><span class="mono" style="color:var(--muted)">${x.tambah ? esc(tglRingkas(x.tambah)) : '—'}</span></td>
        <td><span class="mono" style="color:var(--muted)">${x.pakai ? esc(tglRingkas(x.pakai)) : '—'}</span></td>
      </tr>`;
    }).join('');

    const catatan = [];
    catatan.push(`<b>${SPR.hasil.isi.length} ${T('baris terbaca','rows read')}${
      SPR.hasil.isi.length > 40 ? T(' · 40 pertama yang ditampilkan',' · showing the first 40') : ''}</b> — ${
      akibat.baru.length} ${T('baru','new')} · ${akibat.perbarui.length} ${T('diperbarui','updated')}${
      akibat.hilang.length ? ` · <span style="color:var(--fail)">${akibat.hilang.length} ${
        T('dihapus','deleted')}</span>` : ''}.`);

    if(SPR.hasil.lewat.length){
      catatan.push(T(
        `<b style="color:var(--warn)">${SPR.hasil.lewat.length} baris dilewati.</b> `
        + 'Nama barang dan kode material keduanya wajib — kode material adalah satu-satunya pegangan untuk '
        + 'menemukan barisnya lagi. Baris yang dilewati: '
        + SPR.hasil.lewat.slice(0, 8).map(l=>`<span class="mono">#${l.no}</span> ${esc(l.teks).slice(0,28)} (${l.sebab})`).join(' · ')
        + (SPR.hasil.lewat.length > 8 ? ` … ${SPR.hasil.lewat.length - 8} lagi.` : ''),
          `<b style="color:var(--warn)">${SPR.hasil.lewat.length} rows skipped.</b> `
        + 'Both item name and material code are required — the material code is the only handle for finding '
        + 'the row again. Skipped rows: '
        + SPR.hasil.lewat.slice(0, 8).map(l=>`<span class="mono">#${l.no}</span> ${esc(l.teks).slice(0,28)} (${l.sebab})`).join(' · ')
        + (SPR.hasil.lewat.length > 8 ? ` … ${SPR.hasil.lewat.length - 8} more.` : '')));
    }

    /* Jumlah di aplikasi bisa sudah lebih baru dari lembar SAP — teknisi
       menurunkannya waktu barangnya dipakai. Disebutkan sebelum tombolnya
       ditekan, beserta jalan keluarnya. */
    if(SPR.peta.stok >= 0){
      const petaLama = new Map(akibat.lama.map(p=>[String(p.pn).toLowerCase(), p]));
      const beda = akibat.perbarui.filter(x=>{
        const l = petaLama.get(x.pn.toLowerCase());
        return l && (Number(l.stok) || 0) !== x.stok;
      });
      if(beda.length){
        catatan.push(T(
          `<b style="color:var(--warn)">${beda.length} barang jumlahnya berbeda dari yang tersimpan</b> — `
          + beda.slice(0, 6).map(x=>{
              const l = petaLama.get(x.pn.toLowerCase());
              return `${esc(x.nama).slice(0,28)} (${Number(l.stok)||0} → ${x.stok})`;
            }).join(' · ')
          + (beda.length > 6 ? ` … ${beda.length - 6} lagi` : '')
          + '. Kalau jumlah di aplikasi yang benar, pilih <i>— tidak ada —</i> pada kolom Jumlah.',
          `<b style="color:var(--warn)">${beda.length} items have a different quantity from the stored one</b> — `
          + beda.slice(0, 6).map(x=>{
              const l = petaLama.get(x.pn.toLowerCase());
              return `${esc(x.nama).slice(0,28)} (${Number(l.stok)||0} → ${x.stok})`;
            }).join(' · ')
          + (beda.length > 6 ? ` … ${beda.length - 6} more` : '')
          + '. If the app’s quantity is the right one, choose <i>— none —</i> for the Quantity column.'));
      }
    }
    if(akibat.perbarui.length){
      catatan.push(T(
        'Barang yang sudah ada hanya diperbarui pada kolom yang dipilih di atas; isian lain '
        + '(mis. Tanggal dipakai) tetap seperti yang tersimpan.',
        'Existing items are only updated in the columns chosen above; other fields '
        + '(e.g. Date used) stay as stored.'));
    }

    if(akibat.jumlahAkhir > SPR_BATAS_BARIS){
      catatan.push(T(
        `<b style="color:var(--fail)">Daftarnya akan berisi ${akibat.jumlahAkhir} baris, dan server `
        + `hanya menyimpan ${SPR_BATAS_BARIS} baris pertama per unit.</b> Sisanya akan hilang tanpa `
        + 'pesan. Pecah berkasnya, atau buang baris yang sudah tidak dipakai lebih dulu.',
        `<b style="color:var(--fail)">The list would hold ${akibat.jumlahAkhir} rows, and the server `
        + `stores only the first ${SPR_BATAS_BARIS} rows per unit.</b> The rest would be dropped with `
        + 'no message. Split the file, or clear out rows you no longer keep first.'));
    }

    if(akibat.hilang.length){
      catatan.push(T(
        `<b style="color:var(--fail)">${akibat.hilang.length} baris yang sekarang tersimpan tidak ada `
        + 'di berkas ini dan akan dihapus:</b> '
        + akibat.hilang.slice(0, 10).map(p=>esc(p.nama)).join(' · ')
        + (akibat.hilang.length > 10 ? ` … ${akibat.hilang.length - 10} lagi.` : ''),
        `<b style="color:var(--fail)">${akibat.hilang.length} rows currently stored are absent from `
        + 'this file and will be deleted:</b> '
        + akibat.hilang.slice(0, 10).map(p=>esc(p.nama)).join(' · ')
        + (akibat.hilang.length > 10 ? ` … ${akibat.hilang.length - 10} more.` : '')));
    }

    /* Kotak "ganti seluruh daftar" hanya untuk yang memang boleh menghapus.
       Alasannya sama dengan kotak Hapus di kartu Tambah/Ubah: menawarkan
       sesuatu yang pasti ditolak server terbaca sebagai izin. */
    const kotakGanti = BOLEH_HAPUS.sparepart ? `
      <label class="imp-centang"><input type="checkbox" id="sprGanti"${SPR.ganti ? ' checked' : ''}>
        ${T('Ganti seluruh daftar unit ini — yang tidak ada di berkas akan dihapus',
            'Replace this unit’s whole list — rows absent from the file get deleted')}</label>` : '';

    pratinjau = `
      <div class="imp-atur">
        ${['pn','nama','sloc','gudang','status','satuan','stok','nilai','tambah','pakai','ket',
           'min','rak','merk','tipe','sn','tahun'].map(pilihKolom).join('')}
        <div class="isian" style="margin-bottom:0">
          <label for="sprMulai">${T('Baris data mulai','Data starts at row')}</label>
          <input type="number" id="sprMulai" min="1" max="${Math.max(1, SPR.baris.length)}"
            value="${SPR.mulai + 1}"></div>
        ${kotakGanti}
      </div>

      <div class="gulir" style="margin-top:14px;max-height:340px">
        <table class="tabel-spr"><thead><tr><th></th><th>${T('Kode Material','Material Code')}</th>
          <th>${T('Nama Barang','Item Name')}</th><th>SLOC</th><th>${T('Kode Gudang','Warehouse')}</th>
          <th>Status</th><th>${T('Satuan','Unit')}</th><th style="text-align:right">${T('Jumlah','Qty')}</th>
          <th style="text-align:right">Value (IDR)</th><th>${T('Ditambahkan','Added')}</th>
          <th>${T('Dipakai','Used')}</th></tr></thead>
          <tbody>${badan || `<tr><td colspan="11" style="text-align:center;color:var(--muted);padding:20px">${
            T('Tidak ada baris yang terbaca sebagai sparepart. Coba ubah kolom nama, kolom kode material, '
            + 'atau baris mulainya.',
              'No row reads as a spare part. Try changing the name column, the material code column, or the '
            + 'starting row.')}</td></tr>`}</tbody></table>
      </div>

      <div class="catatan" style="margin-top:14px">${catatan.join('<br><br>')}</div>`;
  }

  el('badanImporPart').innerHTML = kotakMasuk + pratinjau;

  const tombol = el('btnPakaiImporPart');
  const bisa = !!(SPR.hasil && SPR.hasil.isi.length);
  tombol.disabled = !bisa;
  if(bisa && SPR.mode === 'riwayat'){
    const a = sprAkibatRiwayat(SPR.hasil, SPR.unit);
    tombol.disabled = !a.baru.length;
    tombol.textContent = a.baru.length
      ? T(`Simpan ke riwayat — ${a.baru.length} catatan baru`, `Save to the history — ${a.baru.length} new records`)
      : T('Semua catatan sudah ada di riwayat', 'All records are already in the history');
  }else if(bisa){
    const a = sprHitungAkibat(SPR.hasil, SPR.unit, SPR.ganti);
    // Tombolnya menyebutkan angkanya sendiri: yang ditekan orang adalah
    // kalimat di tombol, bukan catatan panjang di atasnya.
    tombol.textContent = a.hilang.length
      ? T(`Simpan — ${a.baru.length} baru, ${a.perbarui.length} diperbarui, ${a.hilang.length} dihapus`,
          `Save — ${a.baru.length} new, ${a.perbarui.length} updated, ${a.hilang.length} deleted`)
      : T(`Simpan — ${a.baru.length} baru, ${a.perbarui.length} diperbarui`,
          `Save — ${a.baru.length} new, ${a.perbarui.length} updated`);
  }else{
    tombol.textContent = T('Simpan ke daftar sparepart','Save to the spare parts list');
  }
  sprPasang();
}

function sprUlang(){
  SPR.hasil = SPR.mode === 'riwayat'
    ? sprTerapRiwayat(SPR.baris, SPR.peta, SPR.mulai, SPR.unit)
    : sprTerap(SPR.baris, SPR.peta, SPR.mulai);
}

/** Pratinjau lembar rekap: pemilih kolom, tabel, dan apa yang akan terjadi. */
function sprPratinjauRiwayat(){
  const label = {
    tahun: T('Tahun','Year'), bulan: T('Bulan','Month'), tanggal: T('Tanggal','Date'),
    pn: T('Kode material','Material code'), nama: T('Nama barang','Item name'),
    keluar: T('Keluar','Out'), masuk: T('Masuk','In'), sisa: T('Sisa','Left'), nilai: 'IDR',
    unit: 'Unit', kode: 'KET (GI/GR)', ket: T('Keterangan','Note')
  };
  const kolomMax = Math.max(0, ...SPR.baris.map(r=>r.length));
  const barisJudul = SPR.baris[Math.max(0, SPR.mulai - 1)] || [];
  const pilihKolom = (m) => `
    <div class="isian" style="margin-bottom:0">
      <label for="spr_${m}">${label[m]}</label>
      <select id="spr_${m}" data-medan="${m}">
        <option value="-1"${SPR.peta[m] < 0 ? ' selected' : ''}>— ${T('tidak ada','none')} —</option>
        ${Array.from({length:kolomMax}, (_,k)=>
          `<option value="${k}"${k === SPR.peta[m] ? ' selected' : ''}>${T('Kolom','Column')} ${k+1}${
            barisJudul[k] ? ' · ' + esc(String(barisJudul[k]).slice(0,18)) : ''}</option>`).join('')}
      </select></div>`;

  const a = sprAkibatRiwayat(SPR.hasil, SPR.unit);
  const baru = new Set(a.baru);
  const badan = SPR.hasil.isi.slice(0, 60).map(x=>`<tr>
      <td><span class="cip ${baru.has(x) ? 'aman' : ''}">${baru.has(x) ? T('baru','new') : T('sudah ada','exists')}</span></td>
      <td class="mono">${esc(tglRiwayat(x.tgl))}</td>
      <td><span class="mono">${esc(x.pn)}</span></td><td>${esc(x.nama)}</td>
      <td class="mono" style="text-align:right">${x.keluar || '—'}</td>
      <td class="mono" style="text-align:right">${x.masuk || '—'}</td>
      <td class="mono" style="text-align:right">${x.sisa === '' ? '—' : x.sisa}</td>
      <td class="mono" style="text-align:right">${x.nilai ? partRupiah(x.nilai) : '—'}</td>
      <td>${esc(x.kode)}</td><td style="color:var(--muted)">${esc(x.ket)}</td></tr>`).join('');

  const catatan = [`<b>${SPR.hasil.isi.length} ${T('catatan untuk','records for')} ${esc(namaUnit(SPR.unit))}${
    SPR.hasil.isi.length > 60 ? T(' · 60 pertama yang ditampilkan',' · showing the first 60') : ''}</b> — ${
    a.baru.length} ${T('baru','new')} · ${a.ada.length} ${T('sudah ada di riwayat (tidak digandakan)','already in the history (not duplicated)')}.`];
  const lain = Object.entries(SPR.hasil.unitLain);
  if(lain.length){
    catatan.push(T('Baris unit lain dilewati: ','Rows of other units skipped: ')
      + lain.map(([u, n])=>`${esc(u)} ${n}`).join(' · ')
      + T('. Buka impor dari unit itu untuk mengambil bagiannya.',
          '. Open the import from that unit to take its part.'));
  }
  if(SPR.hasil.lewat.length){
    catatan.push(`<b style="color:var(--warn)">${SPR.hasil.lewat.length} ${T('baris dilewati','rows skipped')}:</b> `
      + SPR.hasil.lewat.slice(0, 8).map(l=>`<span class="mono">#${l.no}</span> ${esc(l.teks).slice(0,28)} (${l.sebab})`).join(' · '));
  }
  catatan.push(T('Bulan yang dikosongkan di rekap mengikuti baris di atasnya (tahun yang sama). '
    + 'Tanggal Ditambahkan/Dipakai di daftar sparepart ikut riwayat terbaru.',
      'A blank month in the recap follows the row above it (same year). '
    + 'Date Added/Used in the spare parts list follows the latest history.'));

  return `
    <div class="imp-atur">
      ${RWY_MEDAN.map(pilihKolom).join('')}
      <div class="isian" style="margin-bottom:0">
        <label for="sprMulai">${T('Baris data mulai','Data starts at row')}</label>
        <input type="number" id="sprMulai" min="1" max="${Math.max(1, SPR.baris.length)}"
          value="${SPR.mulai + 1}"></div>
    </div>
    <div class="gulir" style="margin-top:14px;max-height:340px">
      <table class="tabel-spr"><thead><tr><th></th><th>${T('Tanggal','Date')}</th>
        <th>${T('Kode Material','Material Code')}</th><th>${T('Nama Barang','Item Name')}</th>
        <th style="text-align:right">${T('Keluar','Out')}</th><th style="text-align:right">${T('Masuk','In')}</th>
        <th style="text-align:right">${T('Sisa','Left')}</th><th style="text-align:right">IDR</th>
        <th>GI/GR</th><th>${T('Keterangan','Note')}</th></tr></thead>
        <tbody>${badan || `<tr><td colspan="10" style="text-align:center;color:var(--muted);padding:20px">${
          T('Tidak ada catatan untuk unit ini di lembar tersebut.','No records for this unit in that sheet.')}</td></tr>`}</tbody></table>
    </div>
    <div class="catatan" style="margin-top:14px">${catatan.join('<br><br>')}</div>`;
}

async function sprTerima(berkas){
  const kabar = el('sprKabar');
  const nama = berkas.name || '';
  const rendah = nama.toLowerCase();
  kabar.textContent = T('Membaca ' + nama + '...', 'Reading ' + nama + '...');
  try{
    let baris;
    SPR.lembar = []; SPR.lembarKe = 0;
    if(rendah.endsWith('.xlsx')){
      // Buku sparepart berlembar banyak — lembar yang menyebut unit ini dipilih dulu.
      SPR.lembar = await xlsxBacaSemua(berkas);
      SPR.lembarKe = sprLembarAwal(SPR.lembar, SPR.unit);
      baris = SPR.lembar[SPR.lembarKe].baris;
    }
    else if(rendah.endsWith('.pdf'))  baris = teksTabelBaris(await pdfBaca(berkas));
    else if(rendah.endsWith('.xls')){
      throw new Error(T('.xls yang lama tidak bisa dibaca di sini — simpan ulang sebagai .xlsx.',
                        'The old .xls format cannot be read here — save it again as .xlsx.'));
    }
    else                              baris = teksKeBaris(await berkas.text());
    sprPakaiBaris(baris, nama);
  }catch(e){
    kabar.innerHTML = `<span style="color:var(--fail)">${
      T('Gagal membaca: ','Could not read it: ')}${esc(e && e.message || e)}</span>`;
  }
}

function sprPakaiBaris(baris, asal){
  if(!baris.length){
    el('sprKabar').innerHTML = `<span style="color:var(--fail)">${
      T('Tidak ada satu baris pun yang terbaca.','Not a single row could be read.')}</span>`;
    return;
  }
  const rekap = sprTebakRiwayat(baris);
  const tebakan = rekap || sprTebak(baris);
  SPR.mode  = rekap ? 'riwayat' : 'daftar';
  SPR.baris = baris;
  SPR.asal  = asal;
  SPR.peta  = tebakan.peta;
  SPR.mulai = tebakan.mulai;
  sprUlang();
  sprGambar();
}

function sprPasang(){
  const jatuh = el('sprJatuh'); if(!jatuh) return;
  const masuk = el('sprInput');
  masuk.addEventListener('change', ()=>{
    if(masuk.files[0]) sprTerima(masuk.files[0]);
    masuk.value = '';
  });
  ['dragenter','dragover'].forEach(n=>jatuh.addEventListener(n, e=>{
    e.preventDefault(); jatuh.classList.add('siap'); }));
  ['dragleave','drop'].forEach(n=>jatuh.addEventListener(n, e=>{
    e.preventDefault(); jatuh.classList.remove('siap'); }));
  jatuh.addEventListener('drop', e=>{
    if(e.dataTransfer && e.dataTransfer.files[0]) sprTerima(e.dataTransfer.files[0]);
  });

  const tempel = el('sprTempel');
  const bacaTempel = ()=>{
    const t = tempel.value.trim();
    if(t.length > 3) sprPakaiBaris(teksKeBaris(t), T('tempelan','pasted text'));
  };
  tempel.addEventListener('paste', ()=>{ SPR.lembar = []; setTimeout(bacaTempel, 0); });
  tempel.addEventListener('change', ()=>{ SPR.lembar = []; bacaTempel(); });

  const pilihLembar = el('sprLembar');
  if(pilihLembar) pilihLembar.addEventListener('change', ()=>{
    SPR.lembarKe = Number(pilihLembar.value) || 0;
    const l = SPR.lembar[SPR.lembarKe];
    if(l) sprPakaiBaris(l.baris, SPR.asal);
  });

  if(!SPR.peta) return;
  const medanSemua = SPR.mode === 'riwayat' ? RWY_MEDAN : SPR_MEDAN;
  el('badanImporPart').querySelectorAll('select[data-medan]').forEach(s=>{
    s.addEventListener('change', ()=>{
      const medan = s.dataset.medan;
      const nilai = Number(s.value);
      // Satu kolom cuma boleh dipegang satu medan. Yang lama melepasnya
      // sendiri, kalau tidak dua medan diam-diam membaca sel yang sama.
      if(nilai >= 0){
        for(const m of medanSemua) if(m !== medan && SPR.peta[m] === nilai) SPR.peta[m] = -1;
      }
      SPR.peta[medan] = nilai;
      sprUlang(); sprGambar();
    });
  });
  const mulai = el('sprMulai');
  if(mulai) mulai.addEventListener('change', ()=>{
    SPR.mulai = Math.max(0, Number(mulai.value) - 1);
    sprUlang(); sprGambar();
  });
  const ganti = el('sprGanti');
  if(ganti) ganti.addEventListener('change', ()=>{ SPR.ganti = ganti.checked; sprGambar(); });
}

/* Satu pendengar di #isiUnit, alasannya sama dengan yang di 31-gambar-kartu.js:
   seluruh isi layar unit diganti tiap kali unitnya berpindah, dan pendengar
   yang dipasang per tombol mati bersama tombolnya. */
el('isiUnit').addEventListener('click', e=>{
  if(e.target.closest('[data-spr-impor]')) sprImporBuka(unitDibuka);
});

el('btnBatalImporPart').addEventListener('click', sprImporTutup);
el('lapisImporPart').addEventListener('click', e=>{
  if(e.target === el('lapisImporPart')) sprImporTutup();
});
document.addEventListener('keydown', e=>{
  if(e.key === 'Escape' && el('lapisImporPart').classList.contains('buka')) sprImporTutup();
});

el('btnPakaiImporPart').addEventListener('click', async ()=>{
  if(!SPR.hasil || !SPR.hasil.isi.length) return;
  const unit = SPR.unit;

  if(SPR.mode === 'riwayat'){
    const { baru } = sprAkibatRiwayat(SPR.hasil, unit);
    if(!baru.length) return;
    el('btnPakaiImporPart').disabled = true;
    const daftar = PART_RIWAYAT[unit] || (PART_RIWAYAT[unit] = []);
    daftar.push(...baru);
    const ok = await dbSimpanUnit('sparepart-riwayat', unit);
    sprImporTutup();
    gambarUnit(); gambarUbin(); gambarCincin();
    if(ok) pesan(T(`Tersimpan — ${baru.length} catatan riwayat baru.`, `Saved — ${baru.length} new history records.`));
    return;
  }
  const akibat = sprHitungAkibat(SPR.hasil, unit, SPR.ganti);

  const tombol = el('btnPakaiImporPart');
  tombol.disabled = true;

  /* Baris yang sudah ada DIUBAH DI TEMPAT, bukan dibuang lalu dipasang lagi:
     idnya harus bertahan, dan urutan daftarnya pun sebaiknya tidak berputar
     tiap kali seseorang mengimpor lembar yang sama. Yang benar-benar baru
     menyusul di ekornya. */
  const petaLama = new Map(PART.filter(p=>p.unit === unit).map(p=>[String(p.pn).toLowerCase(), p]));
  for(const x of SPR.hasil.isi){
    const lama = petaLama.get(x.pn.toLowerCase());
    if(lama) Object.assign(lama, sprMedanTerpilih(x, SPR.peta), { unit });
    // Tanggal ditambahkan tidak dikarang jadi hari ini: kalau lembarnya tidak
    // menyebut, riwayat masuk (atau cap dibuat) yang dipakai — lihat partTambah.
    else PART.push({ ...x, unit, dibuat: new Date().toISOString() });
  }
  if(akibat.hilang.length){
    const buang = new Set(akibat.hilang);
    for(let i = PART.length - 1; i >= 0; i--) if(buang.has(PART[i])) PART.splice(i, 1);
  }

  if(!(await dbSimpanUnit('sparepart', unit))){
    // dbSimpanUnit sudah menyampaikan pesannya dan sudah membaca ulang isi
    // server, jadi yang di layar kembali seperti sebelum impor.
    sprImporTutup();
    gambarUnit(); gambarUbin(); gambarCincin();
    return;
  }

  sprImporTutup();
  gambarUnit(); gambarUbin(); gambarCincin();
  pesan(akibat.hilang.length
    ? T(`Tersimpan — ${akibat.baru.length} baru, ${akibat.perbarui.length} diperbarui, ${akibat.hilang.length} dihapus.`,
        `Saved — ${akibat.baru.length} new, ${akibat.perbarui.length} updated, ${akibat.hilang.length} deleted.`)
    : T(`Tersimpan — ${akibat.baru.length} baru, ${akibat.perbarui.length} diperbarui.`,
        `Saved — ${akibat.baru.length} new, ${akibat.perbarui.length} updated.`));
});
