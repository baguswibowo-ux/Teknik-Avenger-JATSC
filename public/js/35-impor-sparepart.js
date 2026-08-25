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
  pn:     ['part number','partnumber','part no','no part','nomor part','kode barang',
           'kode part','pn','p n','partno','kode'],
  stok:   ['stok','stock','jumlah','qty','quantity','sisa','saldo','on hand','ada'],
  min:    ['stok minimum','minimum','min stok','min','reorder point','reorder','rop',
           'safety stock','batas minimum'],
  satuan: ['satuan','uom','unit','sat'],
  rak:    ['rak','rack','shelf','bin','lokasi rak','lokasi','location','gudang','tempat'],
  pakai:  ['dipakai terakhir','pemakaian terakhir','terakhir dipakai','last used','tanggal pakai',
           'tgl pakai','terakhir','pemakaian','tanggal','tgl'],
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
function sprCocok(teks, medan){
  const t = sprRata(teks);
  if(!t) return 0;
  const kata = t.split(' ');
  let nilai = 0;
  for(const j of SPR_JUDUL[medan]){
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
function sprPasangkan(judul){
  const calon = [];
  judul.forEach((sel, k)=>{
    SPR_MEDAN.forEach((m, urut)=>{
      const n = sprCocok(sel, m);
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
  for(const m of SPR_MEDAN) if(peta[m] === undefined) peta[m] = -1;
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

/* Satuan yang dikenal server ada enam (SATUAN_PART). Yang lain ditulis orang
   dengan kata sendiri, dan server diam-diam menggantinya jadi 'pcs'. Dipetakan
   di sini supaya penggantian itu terjadi di depan mata, bukan di belakang. */
const SPR_SATUAN = {
  pcs:'pcs', pc:'pcs', pieces:'pcs', piece:'pcs', buah:'pcs', bh:'pcs', unit:'pcs',
  ea:'pcs', each:'pcs', lembar:'pcs', batang:'pcs',
  rol:'rol', roll:'rol', rl:'rol',
  drum:'drum',
  set:'set', pasang:'set', pair:'set', kit:'set',
  meter:'meter', m:'meter', mtr:'meter',
  liter:'liter', l:'liter', ltr:'liter'
};

/** Satuan yang bisa disimpan, plus penanda apakah ia hasil terkaan. */
function sprSatuan(nilai){
  const t = sprRata(nilai).replace(/\s+/g, '');
  if(!t) return { satuan:'pcs', ganti:false };
  const cocok = SPR_SATUAN[t];
  return cocok ? { satuan:cocok, ganti:false } : { satuan:'pcs', ganti:true };
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
  const satuanDiganti = new Set();
  const pnGanda = new Set();
  const pnAda = new Set();

  const sel = (r, k) => k >= 0 ? String(r[k] == null ? '' : r[k]).trim() : '';

  for(let i = mulai; i < baris.length; i++){
    const r = baris[i] || [];
    if(!r.some(x=>String(x == null ? '' : x).trim())) continue;   // baris kosong

    const nama = sel(r, peta.nama).slice(0, 120);
    const pn   = sel(r, peta.pn).slice(0, 60);

    // Kaki tabel: jumlah, tanda tangan, catatan. Bukan barang.
    if(/^(jumlah|total|mengetahui|catatan|keterangan|dibuat oleh|diperiksa)\b/i.test(nama)) continue;

    if(!nama){ lewat.push({ no:i + 1, sebab:T('nama kosong','name is empty'), teks:pn || r.join(' ') }); continue; }
    if(!pn){   lewat.push({ no:i + 1, sebab:T('part number kosong','part number is empty'), teks:nama }); continue; }

    const kunci = pn.toLowerCase();
    if(pnAda.has(kunci)){
      pnGanda.add(pn);
      lewat.push({ no:i + 1, sebab:T('part number kembar di berkas ini','duplicate part number in this file'), teks:`${nama} · ${pn}` });
      continue;
    }
    pnAda.add(kunci);

    const s = sprSatuan(sel(r, peta.satuan));
    if(s.ganti) satuanDiganti.add(sel(r, peta.satuan));

    isi.push({
      nama, pn,
      rak:    sel(r, peta.rak).slice(0, 24) || '—',
      stok:   sprAngka(sel(r, peta.stok), 0),
      min:    sprAngka(sel(r, peta.min), 0),
      satuan: s.satuan,
      pakai:  sprTanggal(sel(r, peta.pakai)),
      merk:   sel(r, peta.merk).slice(0, 60),
      tipe:   sel(r, peta.tipe).slice(0, 120),
      sn:     sel(r, peta.sn).slice(0, 60),
      tahun:  sel(r, peta.tahun).slice(0, 10)
    });
  }

  return { isi, lewat, satuanDiganti:[...satuanDiganti], pnGanda:[...pnGanda] };
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

/* ---------- Kartu impor ---------- */

/* Batas baris per unit di server (lihat app.put('/unitdb/:modul/:unit') —
   .slice(0, 300)). Diketahui di sini supaya kelebihannya bisa dikatakan
   sebelum tombolnya ditekan, bukan hilang diam-diam sesudahnya. */
const SPR_BATAS_BARIS = 300;

const SPR = {
  baris: [],     // baris mentah hasil urai
  peta:  null,   // { nama, pn, rak, stok, min, satuan, pakai, merk, tipe, sn, tahun }
  mulai: 0,      // baris data pertama
  hasil: null,   // { isi, lewat, satuanDiganti, pnGanda }
  ganti: false,  // ganti seluruh daftar unit ini, bukan menambah & memperbarui
  asal:  '',
  unit:  null
};

function sprImporBuka(unit){
  SPR.baris = []; SPR.peta = null; SPR.mulai = 0;
  SPR.hasil = null; SPR.ganti = false; SPR.asal = ''; SPR.unit = unit;
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
  nama:   T('Nama sparepart','Spare part name'),
  pn:     'Part number',
  rak:    T('Rak','Rack'),
  stok:   T('Stok','Stock'),
  min:    T('Minimum','Minimum'),
  satuan: T('Satuan','Unit'),
  pakai:  T('Dipakai terakhir','Last used'),
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
      : T('Belum ada yang dibaca.','Nothing read yet.')}</div>`;

  let pratinjau = `<div class="catatan" style="margin-top:16px">${
    T('Pratinjaunya muncul di sini setelah berkasnya terbaca. Tidak ada satu baris pun yang '
    + 'tersimpan sebelum tombol di kaki kartu ini ditekan.',
      'The preview appears here once the file has been read. Not a single row is saved until the '
    + 'button at the foot of this card is pressed.')}</div>`;

  if(SPR.hasil){
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
      const w = x.stok === 0 ? 'var(--fail)' : x.stok < x.min ? 'var(--warn)' : 'var(--ok)';
      return `<tr>
        <td><span class="cip ${petaBaru.has(x.pn) ? 'aman' : 'awas'}">${
          petaBaru.has(x.pn) ? T('baru','new') : T('perbarui','update')}</span></td>
        <td>${esc(x.nama)}</td>
        <td><span class="mono">${esc(x.pn)}</span></td>
        <td><span class="rak-kode">${esc(x.rak)}</span></td>
        <td><span class="mono" style="color:${w};font-weight:600">${x.stok}</span><span
             class="mono" style="color:var(--muted)"> / ${x.min} ${esc(x.satuan)}</span></td>
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
        + 'Nama dan part number keduanya wajib — part number adalah satu-satunya pegangan untuk '
        + 'menemukan barisnya lagi. Baris yang dilewati: '
        + SPR.hasil.lewat.slice(0, 8).map(l=>`<span class="mono">#${l.no}</span> ${esc(l.teks).slice(0,28)} (${l.sebab})`).join(' · ')
        + (SPR.hasil.lewat.length > 8 ? ` … ${SPR.hasil.lewat.length - 8} lagi.` : ''),
          `<b style="color:var(--warn)">${SPR.hasil.lewat.length} rows skipped.</b> `
        + 'Both name and part number are required — the part number is the only handle for finding '
        + 'the row again. Skipped rows: '
        + SPR.hasil.lewat.slice(0, 8).map(l=>`<span class="mono">#${l.no}</span> ${esc(l.teks).slice(0,28)} (${l.sebab})`).join(' · ')
        + (SPR.hasil.lewat.length > 8 ? ` … ${SPR.hasil.lewat.length - 8} more.` : '')));
    }

    if(SPR.hasil.satuanDiganti.length){
      catatan.push(T(
        `Satuan yang tidak dikenal — <b>${esc(SPR.hasil.satuanDiganti.slice(0,8).join(' · '))}</b> — `
        + 'disimpan sebagai <span class="mono">pcs</span>. Yang bisa disimpan cuma enam: '
        + '<span class="mono">pcs · rol · drum · set · meter · liter</span>.',
        `Unrecognised units — <b>${esc(SPR.hasil.satuanDiganti.slice(0,8).join(' · '))}</b> — `
        + 'are stored as <span class="mono">pcs</span>. Only six can be stored: '
        + '<span class="mono">pcs · rol · drum · set · meter · liter</span>.'));
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
        ${['nama','pn','rak','stok','min','satuan','pakai','merk','tipe','sn','tahun'].map(pilihKolom).join('')}
        <div class="isian" style="margin-bottom:0">
          <label for="sprMulai">${T('Baris data mulai','Data starts at row')}</label>
          <input type="number" id="sprMulai" min="1" max="${Math.max(1, SPR.baris.length)}"
            value="${SPR.mulai + 1}"></div>
        ${kotakGanti}
      </div>

      <div class="gulir" style="margin-top:14px;max-height:340px">
        <table><thead><tr><th></th><th>${T('Sparepart','Spare Part')}</th><th>Part Number</th>
          <th>${T('Rak','Rack')}</th><th>${T('Stok / Min','Stock / Min')}</th>
          <th>${T('Dipakai Terakhir','Last Used')}</th></tr></thead>
          <tbody>${badan || `<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:20px">${
            T('Tidak ada baris yang terbaca sebagai sparepart. Coba ubah kolom nama, kolom part number, '
            + 'atau baris mulainya.',
              'No row reads as a spare part. Try changing the name column, the part number column, or the '
            + 'starting row.')}</td></tr>`}</tbody></table>
      </div>

      <div class="catatan" style="margin-top:14px">${catatan.join('<br><br>')}</div>`;
  }

  el('badanImporPart').innerHTML = kotakMasuk + pratinjau;

  const tombol = el('btnPakaiImporPart');
  const bisa = !!(SPR.hasil && SPR.hasil.isi.length);
  tombol.disabled = !bisa;
  if(bisa){
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
  SPR.hasil = sprTerap(SPR.baris, SPR.peta, SPR.mulai);
}

async function sprTerima(berkas){
  const kabar = el('sprKabar');
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
  const tebakan = sprTebak(baris);
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
  tempel.addEventListener('paste', ()=>setTimeout(bacaTempel, 0));
  tempel.addEventListener('change', bacaTempel);

  if(!SPR.peta) return;
  el('badanImporPart').querySelectorAll('select[data-medan]').forEach(s=>{
    s.addEventListener('change', ()=>{
      const medan = s.dataset.medan;
      const nilai = Number(s.value);
      // Satu kolom cuma boleh dipegang satu medan. Yang lama melepasnya
      // sendiri, kalau tidak dua medan diam-diam membaca sel yang sama.
      if(nilai >= 0){
        for(const m of SPR_MEDAN) if(m !== medan && SPR.peta[m] === nilai) SPR.peta[m] = -1;
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
    if(lama) Object.assign(lama, x, { unit });
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
