/* =======================================================================
   JADWAL DINAS BULANAN — modul milik dashboard ini

   Yang dijanjikan bagian ini: jadwal bulan yang sedang berjalan bisa dilihat
   siapa saja, dan hanya orang yang ditunjuk yang boleh mengisinya.

   DI MANA JADWALNYA TINGGAL
   Di server ini, data/dinas.json — karena "semua orang bisa lihat" tidak
   mungkin dipenuhi oleh sesuatu yang tersimpan di peramban masing-masing.
   Dulu ada tempat kedua, localStorage, untuk jalan tanpa sesi E-Logbook; ia
   ikut pergi bersama data contoh.

   Bentuknya:  { 'YYYY-MM': { <unit>: [ { nama, peran, hari:[...] } ] } }
   hari[] sepanjang jumlah hari bulan itu; isinya kode dinas unit itu, atau ''
   untuk libur.
   ======================================================================= */


const bulanKode = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;

/* =======================================================================
   HARI DINAS — pergantiannya 00:00 UTC (07:00 WIB), bukan tengah malam WIB

   Kolom tanggal di lembar jadwal adalah hari UTC, sama seperti jam shiftnya
   (lihat 02-kode-dinas.js). Malam tanggal 15 berangkat 12:00 UTC dan baru
   selesai 00:00 UTC tanggal 16 — jam 05:00 WIB tanggal 16, yang berdinas
   masih orang dari kolom tanggal 15, dan PS/P tanggal 16 baru mulai pukul
   07:00 WIB.

   Kalau petak dinas memakai tanggal peramban (WIB), setiap hari dari tengah
   malam sampai jam tujuh pagi ia menampilkan kolom yang salah: malam yang
   sedang berjalan hilang, diganti PS yang belum berangkat. Karena itu seluruh
   tampilan "hari ini" di layar dinas memakai tanggal UTC.

   Yang TIDAK ikut: umur peralatan, tanggal dokumen, dan sebagainya — itu
   tanggal kalender biasa, bukan hari dinas. Pengingat dinas di server
   (pengingat-dinas.js) memang sudah menghitung dengan hari UTC sejak awal.
   ======================================================================= */

/** Bulan hari dinas yang sedang berjalan, 'YYYY-MM'. */
const bulanDinasKini = (d = new Date()) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;
/** Tanggal hari dinas yang sedang berjalan, 1–31. */
const hariDinasKini = (d = new Date()) => d.getUTCDate();
/** Hari dinas berjalan sebagai Date tengah malam UTC — untuk label tanggal. */
const tanggalDinasKini = (d = new Date()) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const jumlahHari = (bulan) =>
  new Date(Number(bulan.slice(0,4)), Number(bulan.slice(5,7)), 0).getDate();
const namaBulan = (bulan) => new Date(Number(bulan.slice(0,4)), Number(bulan.slice(5,7))-1, 1)
  .toLocaleDateString(LOKAL(), { month:'long', year:'numeric' });

/* bulanIni dan lihat diisi sejak awal, bukan menunggu jdwMuatAwal(): layar unit
   bisa saja tergambar lebih dulu — sesi yang dipulihkan langsung membuka unit
   terakhir — dan bulan kosong membuat jumlahHari('') jadi NaN. */
const JDW = {
  bulanIni: bulanDinasKini(),        // yang mengisi kartu "berdinas hari ini"
  lihat:    bulanDinasKini(),        // bulan yang sedang dibuka di subtab
  jadwal:   {},      // { unit: [orang] } untuk JDW.bulanIni
  jadwalLihat: {},   // { unit: [orang] } untuk JDW.lihat
  bisaTulis:true,    // server punya penyimpanan tetap?
  sebab:    '',      // kenapa tidak boleh, untuk ditampilkan apa adanya
  sunting:  false,   // subtab sedang dalam mode sunting
  draf:     null,    // salinan yang sedang disunting; null di luar mode sunting
  pola:     null,    // ringkasan draf hasil "Lanjutkan pola"; null kalau drafnya bukan dari sana
  pilih:    null,    // blok sel terpilih di mode sunting: { r0,h0 (jangkar), r1,h1 (ujung) }
  riwayat:  [],      // salinan hari[] tiap baris sebelum tiap perubahan, untuk Urungkan
  riwayatDraf: null  // draf pemilik riwayat; draf baru (pola, impor, sunting ulang) = riwayat baru
};

/* ---------- Ambil dan simpan ---------- */

/** Jadwal satu bulan, dari server dashboard ini. */
async function jdwAmbil(bulan){
  const r = await srvFetch('/dinas/bulan/' + bulan, {}, 10000);
  const j = await r.json().catch(()=>null);
  if(!r.ok) throw new Error((j && j.error) || ('server menjawab ' + r.status));
  const isi = (j && j.jadwal) || {};
  delete isi._diubah;    // catatan siapa-kapan, bukan baris jadwal
  return isi;
}

/** Muat jadwal bulan berjalan. Dipanggil sekali setelah masuk. */
async function jdwMuatAwal(){
  // Bulannya bisa berganti kalau halaman ini terbuka melewati pergantian bulan
  // (00:00 UTC tanggal 1), jadi disetel ulang di sini — bukan hanya saat lahir.
  JDW.bulanIni = bulanDinasKini();
  JDW.lihat = JDW.bulanIni;
  await hakMuat();
  if(!JDW.sebab && !BOLEH.dinas) JDW.sebab = hakSebab('dinas');
  try{
    JDW.jadwal = await jdwAmbil(JDW.bulanIni);
    JDW.jadwalLihat = JDW.jadwal;
  }catch(e){
    console.warn('Jadwal dinas tidak bisa diambil:', e && e.message || e);
    JDW.jadwal = {}; JDW.jadwalLihat = {};
  }
}

async function jdwSimpanUnit(bulan, unit, orang){
  const r = await srvFetch('/dinas/bulan/' + bulan + '/' + unit, {
    method:'PUT', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ orang })
  }, 15000);
  const j = await r.json().catch(()=>null);
  if(!r.ok) throw new Error((j && j.error) || ('server menjawab ' + r.status));
}

/* ---------- Dinas hari ini, diturunkan dari jadwal bulanan ---------- */

/**
 * Kode dinas yang benar-benar dipakai satu unit pada bulan berjalan.
 *
 * Petak dinas dulu dipasang dari daftar kode unit — enam kode, apa pun isi
 * jadwalnya. Unit yang sepanjang bulan hanya memakai PSJ/PSN/MJ/MN jadi
 * membawa dua kartu P dan S yang selamanya bertuliskan "tidak ada personel",
 * dan kotak yang tidak pernah terisi lebih cepat diabaikan daripada dibaca.
 *
 * Yang dikumpulkan seluruh bulan, bukan hari ini saja: kartu yang lenyap dan
 * muncul lagi tiap ganti hari lebih membingungkan daripada satu kartu kosong,
 * dan shift yang hari ini tidak ada orangnya justru perlu terlihat — itu
 * lubang jaga, bukan shift yang tidak dipakai.
 */
function kodeDipakaiUnit(kode){
  const daftar = JDW.jadwal[kode];
  if(!Array.isArray(daftar)) return [];
  const ada = new Set();
  daftar.forEach(o=>(o.hari || []).forEach(h=>{ if(h) ada.add(h); }));
  /* Urutannya menurut jam mulai, bukan menurut daftar kode unit. Daftar itu
     menaruh PS di depan malam, dan begitu unit ini ternyata tidak memakai PS
     sama sekali, sisanya terbaca terbalik — malam dulu, baru pagi. Jam mulai
     yang dipakai jam dasarnya, sebelum malam mundur ke 13:00; kalau tidak,
     urutannya ikut berubah tiap kali ada yang berdinas P.

     Kode di luar daftar unit — salah ketik yang terlanjur tersimpan — tidak
     punya jam, jadi menyusul di belakang. Tetap terlihat, tidak dibuang. */
  const daftarUnit = infoUnit(kode).dinas || KODE_DINAS;
  const dikenal = [...ada].filter(k=>SHIFT[k])
    .sort((a,b)=>(SHIFT[a].mulai - SHIFT[b].mulai) ||
                 (daftarUnit.indexOf(a) - daftarUnit.indexOf(b)) ||
                 a.localeCompare(b));
  return [...dikenal, ...[...ada].filter(k=>!SHIFT[k]).sort()];
}

/** Petak kosong untuk unit yang jadwalnya belum bisa dibaca. */
function petakBaku(kode){
  const daftarUnit = infoUnit(kode).dinas || KODE_DINAS;
  const inti = daftarUnit.filter(k=>KODE_DINAS_INTI.includes(k));
  return (inti.length ? inti : daftarUnit).map(k=>({ k, o:[] }));
}

/**
 * Petak shift hari ini untuk satu unit, dari jadwal bulan berjalan.
 * null berarti unit itu memang belum punya jadwal — pemanggilnya yang
 * memutuskan apa yang ditampilkan sebagai gantinya.
 */
function dinasHariIni(kode){
  const daftar = JDW.jadwal[kode];
  if(!Array.isArray(daftar) || !daftar.length) return null;
  const hari = hariDinasKini();
  const dipakai = kodeDipakaiUnit(kode);
  const petak = (dipakai.length ? dipakai.map(k=>({ k, o:[] })) : petakBaku(kode));
  daftar.forEach(o=>{
    const k = (o.hari || [])[hari-1];
    if(!k) return;
    // Kode yang tidak ada di petak tetap ditampilkan, tidak dibuang. Nyaris
    // tidak pernah terjadi sekarang — petaknya lahir dari isi jadwal yang
    // sama — tetapi murah, dan menutup celah kalau sumbernya berubah.
    let s = petak.find(x=>x.k === k);
    if(!s){ s = { k, o:[] }; petak.push(s); }
    s.o.push({ n:o.nama, p:o.peran || T('Teknisi','Technician') });
  });

  /* Yang SEDANG berjalan jam ini didahulukan — sisanya tetap urut jam mulai.
     Satu hari dinas memuat dua giliran yang jamnya berbeda (PS lalu M, atau P,
     S, lalu M), dan yang dicari orang waktu membuka layar ini adalah giliran
     yang sedang bertugas. Urut jam mulai saja membuat malam yang sedang jaga
     berdiri paling kanan, di belakang PS yang sudah pulang tujuh jam lalu.
     Pita beranda sudah lama berlaku begitu; petak unit menyusul.

     Diurutkan di sini, bukan di kodeDipakaiUnit(): jam malam bergantung pada
     kode yang dipakai HARI INI (aturan `geser`), dan daftar kode di sana
     dikumpulkan dari seluruh bulan. sort() JavaScript stabil, jadi kelompok
     yang tidak sedang berjalan tidak berubah urutannya. */
  const kodeHari = petak.filter(s=>s.o.length).map(s=>s.k);
  const libur  = (k)=> !!(SHIFT[k] && SHIFT[k].libur);
  const sedang = (k)=> !!SHIFT[k] && !libur(k) && sedangShift(jamShift(k, kodeHari));
  /* CUTI/CAP/IJIN/DL selalu paling belakang: mereka bukan giliran, dan berdiri
     di antara dua giliran hanya memotong urutan jamnya. */
  petak.sort((a,b)=>(sedang(b.k) - sedang(a.k)) || (libur(a.k) - libur(b.k)));
  return petak;
}

/* ---------- Lanjutkan pola bulan lalu ---------- */

/*
 * Kebanyakan unit berdinas dengan putaran tetap — PS M L L tiap empat hari,
 * atau P S M L L tiap lima. Bulan depan tinggal lanjutan bulan ini, jadi
 * mengunggah lembar baru tiap bulan cuma untuk menyalin putaran yang sama itu
 * pekerjaan yang tidak perlu. Di sini putarannya dibaca dari jadwal yang sudah
 * ada, lalu diteruskan lurus ke bulan yang dibuka.
 *
 * Hasilnya DRAF di mode sunting, bukan jadwal tersimpan: huruf gedung (J/N)
 * dan SPKL tidak berpola, dan jadwal yang terlanjur tersimpan langsung dipakai
 * pengingat dinas. Yang mengisi tetap memeriksa, membetulkan, lalu Simpan.
 */

/* Hari terakhir yang dibaca untuk menebak panjang putaran. Enam minggu dulu;
   kalau gagal, makin pendek — orang yang gilirannya digeser di tengah bulan
   punya putaran yang rapi lagi sesudah geserannya. */
const POLA_JENDELA = [42, 16, 12];
const POLA_PUTARAN = [2, 10];     // panjang putaran yang dicoba
const POLA_YAKIN = 0.8;           // sebagian kecil tukar dinas masih boleh
const POLA_RAGU  = 0.6;           // di bawah yakin tetap diisi, tapi namanya disebut untuk dicek

/**
 * Bentuk satu kode untuk membaca putaran: 'PS', 'M', 'P', 'S', 'L' (libur),
 * atau null untuk yang tidak ikut putaran (CUTI/CAP/IJIN/DL) — hari-hari itu
 * dilompati, bukan dianggap libur.
 *
 * SPKL selalu jatuh di hari libur putarannya (lembur di luar giliran), jadi
 * bentuknya L. Kode yang tidak dikenal jadi bentuknya sendiri supaya ikut
 * terulang apa adanya.
 */
function polaBentuk(kode){
  if(kode == null) return null;
  const t = String(kode).trim();
  if(!t) return 'L';
  const b = kodeBaku(t);
  if(!b) return t.toUpperCase().replace(/[^A-Z]/g, '') || 'L';
  if(SHIFT[b].libur) return null;
  if(b.startsWith('SPKL')) return 'L';
  return SHIFT[b].pita || 'L';
}

/** Kode yang diteruskan ke bulan baru: SPKL tidak ikut, sisanya apa adanya. */
const polaNilai = (kode) => polaBentuk(kode) === 'L' ? '' : String(kode).trim();

/**
 * Panjang putaran satu riwayat hari (kode berurutan lintas bulan; null = tidak
 * terbaca), dibaca dari `jendela` hari terakhir: { p, r } dengan r bagian hari
 * yang sama bentuknya dengan satu putaran sebelumnya, atau null.
 */
function polaPanjang(riwayat, jendela){
  const bentuk = riwayat.map(polaBentuk);
  const n = bentuk.length;
  const skor = [];
  for(let p = POLA_PUTARAN[0]; p <= POLA_PUTARAN[1]; p++){
    let banding = 0, cocok = 0;
    for(let i = Math.max(p, n - jendela); i < n; i++){
      if(bentuk[i] == null || bentuk[i - p] == null) continue;
      banding++;
      if(bentuk[i] === bentuk[i - p]) cocok++;
    }
    // Minimal dua putaran utuh yang benar-benar terbaca.
    if(banding >= 2 * p) skor.push({ p, r: cocok / banding });
  }
  if(!skor.length) return null;
  const terbaik = Math.max(...skor.map(s=>s.r));
  // Kelipatan putaran (8 untuk putaran 4) nilainya sama baiknya; ambil yang terpendek.
  return skor.find(s=>s.r >= terbaik - 0.05);
}

/**
 * Teruskan riwayat sebanyak `hariN` hari: { hari:[...], ragu } atau null kalau
 * putarannya tidak terbaca atau isinya libur semua.
 *
 * Tiap hari baru melihat hari-hari berfase sama di putaran sebelumnya (tiga
 * yang terakhir, melompati cuti): bentuk terbanyak yang menang — satu tukar
 * dinas tidak ikut terulang sebulan — dan kodenya diambil dari kemunculan
 * bentuk itu yang paling akhir, jadi huruf gedungnya ikut putaran terakhir.
 */
function polaLanjut(riwayat, hariN){
  const n = riwayat.length;
  let pilih = null, jendela = 0;
  for(const j of POLA_JENDELA){
    const s = polaPanjang(riwayat, j);
    if(s && s.r >= POLA_YAKIN){ pilih = s; jendela = j; break; }
    if(s && s.r >= POLA_RAGU && (!pilih || s.r > pilih.r)){ pilih = s; jendela = j; }
  }
  if(!pilih) return null;
  const p = pilih.p;
  // Contoh fase diambil dari jendela yang sama: putaran sebelum geseran tidak ikut bersuara.
  const batas = Math.max(0, n - jendela);
  const hari = [];
  for(let k = 0; k < hariN; k++){
    const calon = [];
    for(let j = n + k - p * Math.ceil((k + 1) / p); j >= batas && calon.length < 3; j -= p){
      const b = polaBentuk(riwayat[j]);
      if(b != null) calon.push({ b, kode: riwayat[j] });
    }
    if(!calon.length){ hari.push(''); continue; }
    const hitung = {};
    calon.forEach(c=>{ hitung[c.b] = (hitung[c.b] || 0) + 1; });
    // Seri: yang paling akhir menang (calon[0] paling akhir).
    const menang = calon.reduce((a, c)=>hitung[c.b] > hitung[a.b] ? c : a, calon[0]).b;
    hari.push(polaNilai(calon.find(c=>c.b === menang).kode));
  }
  return hari.some(Boolean) ? { hari, ragu: pilih.r < POLA_YAKIN } : null;
}

/** Bulan 'YYYY-MM' digeser `n` bulan. */
const bulanGeser = (bulan, n) =>
  bulanKode(new Date(Number(bulan.slice(0,4)), Number(bulan.slice(5,7)) - 1 + n, 1));

/**
 * Draf jadwal `bulan` untuk satu unit, diteruskan dari dua bulan sebelumnya.
 * Orangnya = daftar bulan lalu (urutan, nama, NIK, peran ikut); riwayatnya
 * disambung dengan bulan sebelum itu lewat NIK, atau nama kalau salah satunya
 * belum ber-NIK.
 *
 *   { orang:[...], lanjut:[nama], ragu:[nama], kosong:[nama] }
 *   — atau null kalau bulan lalu belum ada jadwalnya.
 */
function polaDraf(bulan, lalu, sebelumLalu){
  if(!Array.isArray(lalu) || !lalu.length) return null;
  const hariN = jumlahHari(bulan);
  const nLalu = jumlahHari(bulanGeser(bulan, -1)), nSebelum = jumlahHari(bulanGeser(bulan, -2));
  const nik  = (o)=> String(o.nik || '').trim();
  const nama = (o)=> String(o.nama || '').trim().toUpperCase();
  const dulu = (o)=> (sebelumLalu || []).find(x=>nik(o) && nik(x) ? nik(o) === nik(x) : nama(o) === nama(x));
  const hasil = { orang:[], lanjut:[], ragu:[], kosong:[] };
  lalu.filter(nama).forEach(o=>{
    const d = dulu(o);
    // Bulan sebelumnya yang tidak memuat orang ini diisi null: tidak terbaca, bukan libur.
    const riwayat = [
      ...Array.from({length:nSebelum}, (_,i)=> d ? ((d.hari || [])[i] || '') : null),
      ...Array.from({length:nLalu},    (_,i)=> (o.hari || [])[i] || '')
    ];
    const t = polaLanjut(riwayat, hariN);
    hasil[!t ? 'kosong' : t.ragu ? 'ragu' : 'lanjut'].push(o.nama);
    hasil.orang.push({ nama:o.nama, peran:o.peran || '', nik:o.nik || '',
                       hari: t ? t.hari : Array(hariN).fill('') });
  });
  return hasil;
}

/* ---------- Tabel bulanan ---------- */

/** Baris orang untuk unit + bulan yang sedang dibuka. */
const jdwBaris = (unit) => (JDW.jadwalLihat[unit] || []);

/* TOTAL DINAS SEBULAN — kolom di kanan tabel, hanya di mode sunting, supaya
   yang menyusun jadwal langsung tahu jatah tiap orang. Yang dihitung dinas
   sungguhan per jenis (PS, M, P, S) lewat `pita` di SHIFT; J dan N digabung.
   SPKL tidak dihitung (lembur, di luar jatah), begitu juga CUTI/CAP/IJIN/DL
   (tanpa pita) dan kode yang tidak dikenal. */
const jdwPitaDinas = (kode)=>{
  const b = kodeBaku(kode);
  return b && !b.startsWith('SPKL') && SHIFT[b] && SHIFT[b].pita ? SHIFT[b].pita : '';
};

/** Jenis dinas yang dipakai unit ini, urut PS, M, P, S. */
const jdwPitaUnit = (unit)=>{
  const ada = new Set((infoUnit(unit).dinas || []).map(jdwPitaDinas).filter(Boolean));
  return URUT_PITA.filter(p=>ada.has(p));
};

function jdwHitungPita(hari){
  const n = {};
  (hari || []).forEach(k=>{ const p = jdwPitaDinas(k); if(p) n[p] = (n[p] || 0) + 1; });
  return n;
}

/** Sel total satu orang. Kosong di luar mode sunting. */
function jdwSelRekap(i, hari, pita){
  if(!pita.length) return '';
  const n = jdwHitungPita(hari);
  const jml = pita.reduce((s, p)=>s + (n[p] || 0), 0);
  return pita.map((p, k)=>`<td class="jdw-rekap${k ? '' : ' awal'}" data-rekap="${i}" data-pita="${p}">${n[p] || ''}</td>`).join('')
    + `<td class="jdw-rekap jml" data-rekap="${i}" data-pita="jml">${jml || ''}</td>`;
}

/** Perbarui total satu baris sesudah selnya berubah. */
function jdwPerbaruiRekap(kotak, r){
  const n = jdwHitungPita((JDW.draf[r] || {}).hari);
  let jml = 0;
  kotak.querySelectorAll(`td.jdw-rekap[data-rekap="${r}"]`).forEach(td=>{
    if(td.dataset.pita === 'jml') return;
    jml += n[td.dataset.pita] || 0;
    td.textContent = n[td.dataset.pita] || '';
  });
  const tdJml = kotak.querySelector(`td.jdw-rekap[data-rekap="${r}"][data-pita="jml"]`);
  if(tdJml) tdJml.textContent = jml || '';
}

function jdwTabel(unit){
  const bulan = JDW.lihat;
  const hariN = jumlahHari(bulan);
  const baris = JDW.sunting ? JDW.draf : jdwBaris(unit);
  const iniBulanIni = bulan === JDW.bulanIni;
  const hariIni = iniBulanIni ? hariDinasKini() : 0;

  // Total dinas sebulan per orang — hanya di mode sunting (jdwRekapPita).
  const pitaRekap = JDW.sunting ? jdwPitaUnit(unit) : [];
  const kepalaRekap = pitaRekap.map((p, n)=>`<th class="jdw-rekap${n ? '' : ' awal'}" title="${esc(T(
      `Jumlah dinas ${p} bulan ini, J dan N digabung. SPKL, cuti, ijin, dan DL tidak dihitung.`,
      `${p} shifts this month, J and N combined. SPKL, leave, and DL are not counted.`))}">${p}</th>`).join('')
    + (pitaRekap.length ? `<th class="jdw-rekap jml" title="${esc(T('Jumlah dinas bulan ini (tanpa SPKL).',
      'Shifts this month (excluding SPKL).'))}">${T('Jml','Tot')}</th>` : '');
  const kosongRekap = pitaRekap.length ? `<td colspan="${pitaRekap.length + 1}"></td>` : '';

  const kepala = `<tr><th class="jdw-no">${T('No','No')}</th><th class="jdw-nama">${T('Nama','Name')}</th><th class="jdw-nik">NIK</th>` +
    Array.from({length:hariN}, (_,i)=>`<th class="${i+1===hariIni?'jdw-hari-ini':''}">${i+1}</th>`).join('') +
    kepalaRekap + (JDW.sunting ? '<th></th>' : '') + '</tr>';

  /* Baris penanda kegiatan berkala, tepat di bawah tanggalnya. Di sinilah
     "kegiatan mingguan dan bulanan muncul pada jadwal yang sudah dibuat"
     benar-benar terjadi: yang membaca jadwal untuk mencari nama sendiri
     sekaligus melihat tanggal berapa saja yang ada pekerjaan tetapnya. */
  const adaBerkala = bklDaftar(unit).length;
  const barisBerkala = adaBerkala ? `<tr class="jdw-berkala">
    <td class="jdw-no"></td>
    <td class="jdw-nama" colspan="2">${T('Kegiatan berkala','Recurring jobs')}</td>
    ${Array.from({length:hariN}, (_,i)=>{
      const keg = bklPadaHari(unit, bulan, i + 1);
      if(!keg.length) return `<td class="${i+1===hariIni?'jdw-hari-ini':''}"></td>`;
      // Shift ikut disebut di tooltip, bukan digambar sebagai titik terpisah:
      // barisnya cuma setinggi satu sel per tanggal, dan memecahnya jadi dua
      // titik akan membuat tabel sebulan penuh sulit dibaca sekilas.
      const judul = keg.map(k=>k.nama + (bklShift(k) ? ` (${bklShiftNama(bklShift(k))})` : '')).join(' · ');
      const mingguan = keg.some(k=>k.jenis === 'mingguan');
      return `<td class="${i+1===hariIni?'jdw-hari-ini':''}" title="${esc(judul)}">
        <span class="bkl-titik ${mingguan?'mingguan':'bulanan'}">${keg.length > 1 ? keg.length : '●'}</span></td>`;
    }).join('')}
    ${kosongRekap}${JDW.sunting ? '<td></td>' : ''}</tr>` : '';

  if(!baris.length){
    const bolehPola = !JDW.sunting && bolehSuntingDb('dinas') && JDW.bisaTulis;
    return `<table class="jdw"><thead>${kepala}</thead><tbody>${barisBerkala}
      <tr><td colspan="${hariN + 3 + (JDW.sunting?1:0) + (pitaRekap.length ? pitaRekap.length + 1 : 0)}" style="text-align:center;color:var(--muted);padding:22px">
        ${T('Belum ada jadwal untuk bulan ini.','No roster for this month yet.')}
        ${bolehPola ? `<div style="margin-top:10px"><button class="btn kecil" data-jdw-pola>${
          T('Lanjutkan pola ','Continue the pattern of ') + esc(namaBulan(bulanGeser(bulan, -1)))}</button></div>` : ''}
      </td></tr></tbody></table>`;
  }

  const tandaPola = (nama)=> !JDW.sunting || !JDW.pola ? ''
    : JDW.pola.kosong.includes(nama) ? `<span title="${esc(T('Polanya tidak terbaca — isi manual.',
        'Pattern could not be read — fill in by hand.'))}" style="color:var(--fail)"> ●</span>`
    : JDW.pola.ragu.includes(nama) ? `<span title="${esc(T('Polanya kurang rapi — periksa hasilnya.',
        'Irregular pattern — check the result.'))}" style="color:var(--warn)"> ●</span>` : '';

  const isi = baris.map((o,i)=>{
    const sel = (h)=>{
      const nilai = (o.hari || [])[h] || '';
      if(!JDW.sunting){
        return `<td class="${h+1===hariIni?'jdw-hari-ini':''}"${nilai
          ? ` style="color:${warnaShift(nilai, 'var(--text)')}"` : ''}>${esc(nilai) || '·'}</td>`;
      }
      // Sel biasa, bukan dropdown: diblok, ditarik pojoknya, diketik, atau
      // di-paste dari Excel — lihat "SUNTING ALA EXCEL" di bawah.
      return `<td class="jdw-sel${h+1===hariIni?' jdw-hari-ini':''}" data-baris="${i}" data-hari="${h}"${nilai
        ? ` style="color:${warnaShift(nilai, 'var(--text)')}"` : ''}>${esc(nilai)}</td>`;
    };
    return `<tr>
      <td class="jdw-no">${i+1}${tandaPola(o.nama)}</td>
      <td class="jdw-nama">${JDW.sunting
        ? `<input type="text" data-baris="${i}" data-kolom="nama" value="${esc(o.nama || '')}">`
        : esc(o.nama || '')}</td>
      <td class="jdw-nik">${JDW.sunting
        ? `<input type="text" data-baris="${i}" data-kolom="nik" value="${esc(o.nik || '')}" placeholder="${
            T('NIK pegawai','Employee ID')}">`
        : esc(o.nik || '—')}</td>
      ${Array.from({length:hariN}, (_,h)=>sel(h)).join('')}
      ${jdwSelRekap(i, o.hari, pitaRekap)}
      ${JDW.sunting ? `<td><button class="btn garis kecil" data-jdw-buang="${i}">✕</button></td>` : ''}
    </tr>`;
  }).join('');

  return `<table class="jdw${JDW.sunting?' sunting':''}"><thead>${kepala}</thead><tbody>${barisBerkala}${isi}</tbody></table>`;
}

/** Seluruh isi subtab Jadwal Dinas. Digambar terpisah supaya tombol sunting
    tidak perlu menggambar ulang seluruh layar unit. */
function jdwIsi(unit){
  const u = infoUnit(unit);
  const bulan = JDW.lihat;
  /* bolehSuntingDb, bukan BOLEH saja: hak modul berlaku untuk perannya, dan
     jadwal unit lain yang dibuka untuk dilihat tidak boleh menawarkan Sunting
     atau Cetak yang pasti ditolak server. */
  const bolehSunting = bolehSuntingDb('dinas') && JDW.bisaTulis;
  const unitLain = !bolehBuka(unit) && !modulPicSemuaUnit('dinas');

  const kepala = `
    <div class="atur-data">
      <span class="ket">${T('Jadwal','Roster')} ${esc(namaBulan(bulan))} · ${esc(u.nama)}
        ${bulan === JDW.bulanIni ? T('· bulan berjalan','· current month') : ''}</span>
      <span class="tombol">
        <input type="month" id="jdwBulan" value="${esc(bulan)}"${JDW.sunting?' disabled':''}>
        ${JDW.sunting
          ? `<button class="btn garis kecil" id="jdwBatal">${T('Batal','Cancel')}</button>
             <button class="btn garis kecil" data-jdw-pola title="${esc(T(
               'Teruskan putaran dinas tiap orang dari jadwal bulan sebelumnya.',
               'Carry each person\'s shift rotation on from the previous month.'))}">${
               T('Lanjutkan pola bulan lalu','Continue last month\'s pattern')}</button>
             <button class="btn garis kecil" id="jdwImpor">${T('Impor dari berkas','Import from a file')}</button>
             <button class="btn garis kecil" id="jdwTambahOrang">${T('Tambah orang','Add person')}</button>
             <button class="btn kecil" id="jdwSimpan">${T('Simpan jadwal','Save roster')}</button>`
          : `${bolehSunting
              ? `<button class="btn kecil" id="jdwSunting">${T('Sunting jadwal','Edit roster')}</button>`
              : ''}
             ${bolehSuntingDb('dinas-cetak') ? `
             <button class="btn garis kecil" id="jdwCetakPum" title="${
               T('Versi untuk PUM: hanya kode PS/M/P/S; SPKL, cuti, dan lainnya dikosongkan.',
                 'PUM version: only PS/M/P/S codes; SPKL, leave, and others are blanked.')}">${
               T('Cetak PUM','Print (PUM)')}</button>
             <button class="btn garis kecil" id="jdwCetakTeknik" title="${
               T('Versi internal Teknik: seluruh kode ditampilkan apa adanya.',
                 'Internal Teknik version: every code is shown as-is.')}">${
               T('Cetak Teknik','Print (Teknik)')}</button>` : ''}`}
      </span>
    </div>
    ${bolehSunting || JDW.sunting ? '' : `<div class="catatan" style="margin-top:0"><b>${
      T('Anda hanya bisa melihat jadwal ini.','You can only view this roster.')}</b> ${unitLain
        ? esc(T('Unit ini bukan unit akun Anda.','This unit is not assigned to your account.'))
        : esc(JDW.sebab)} ${
      T('Jadwal bulan berjalan sengaja terbuka untuk semua akun; yang boleh mengisinya ditentukan per '
        + 'peran oleh administrator, di panel Siapa Boleh Mengisi Apa pada layar Kelola Akun.',
        'The current month roster is deliberately open to every account; who may fill it in is decided '
        + 'per role by an administrator, in the Who May Fill What panel on the Manage Accounts screen.')}</div>`}`;

  const pola = JDW.sunting && JDW.pola;
  const daftarNama = (xs)=> xs.map(n=>`<b>${esc(n)}</b>`).join(', ');
  const catatanPola = !pola ? '' : `<div class="catatan" style="margin-top:0">
    <b>${T('Draf dari pola ','Draft from the pattern of ') + esc(namaBulan(pola.sumber))}.</b>
    ${T(`${pola.lanjut.length} orang diteruskan lurus.`, `${pola.lanjut.length} people carried straight on.`)}
    ${pola.ragu.length ? T(` Periksa dulu (polanya kurang rapi, tanda kuning): ${daftarNama(pola.ragu)}.`,
                           ` Check first (irregular pattern, yellow mark): ${daftarNama(pola.ragu)}.`) : ''}
    ${pola.kosong.length ? T(` Tidak terbaca, isi manual (tanda merah): ${daftarNama(pola.kosong)}.`,
                             ` Unreadable, fill in by hand (red mark): ${daftarNama(pola.kosong)}.`) : ''}
    ${T(' Huruf gedung J/N ikut putaran terakhir; SPKL, cuti, dan DL tidak ikut. Betulkan yang perlu, '
      + 'lalu tekan <b>Simpan jadwal</b> — sebelum disimpan, belum ada yang berubah.',
        ' The J/N building letter follows the latest rotation; SPKL, leave, and DL are not carried. Fix '
      + 'what is needed, then press <b>Save roster</b> — nothing changes until it is saved.')}</div>`;

  const alat = !JDW.sunting ? '' : `<div class="jdw-alat">
      <span class="ket">${T('Isi sel terpilih:','Fill selected cells:')}</span>
      ${u.dinas.map(k=>`<button class="btn garis kecil" data-jdw-kode="${esc(k)}" style="color:${
        warnaShift(k, 'var(--text)')}">${esc(k)}</button>`).join('')}
      <button class="btn garis kecil" data-jdw-kode="">${T('Kosongkan','Clear')}</button>
      <button class="btn garis kecil" id="jdwUrung" title="Ctrl+Z">↶ ${T('Urungkan','Undo')}</button>
      <span class="ket" id="jdwKetik"></span>
    </div>
    <div class="catatan" style="margin-top:0">${T(
      '<b>Seperti Excel:</b> klik lalu seret untuk memblok beberapa sel (atau Shift+klik). Tarik '
      + '<b>kotak kecil di pojok kanan bawah</b> blok untuk mengulang isinya ke samping atau ke bawah — '
      + 'blok <b>PS M L L</b> lalu tarik sampai akhir bulan, polanya berulang sendiri. Ketik kodenya '
      + 'langsung di keyboard, <b>Delete</b> mengosongkan, panah berpindah sel, <b>Ctrl+C / Ctrl+V</b> '
      + 'menyalin dan menempel (juga dari Excel), <b>Ctrl+Z</b> mengurungkan. Di HP: ketuk sel, tarik '
      + 'kotak pojoknya, atau pakai tombol kode di atas.',
      '<b>Like Excel:</b> click and drag to select several cells (or Shift+click). Drag the <b>small '
      + 'square at the bottom-right corner</b> of the selection to repeat it sideways or down — select '
      + '<b>PS M L L</b> and drag to the end of the month, the pattern repeats itself. Type a code on the '
      + 'keyboard, <b>Delete</b> clears, arrows move, <b>Ctrl+C / Ctrl+V</b> copy and paste (also from '
      + 'Excel), <b>Ctrl+Z</b> undoes. On a phone: tap a cell, drag its corner square, or use the code '
      + 'buttons above.')}</div>`;

  const petak = dinasUnit(unit);
  return kepala + catatanPola + alat
    + `<div class="jdw-gulir"${JDW.sunting ? ' tabindex="0"' : ''}>${jdwTabel(unit)}</div>`
    + `<div class="dinas-baris" style="margin-top:18px">${
        petak.filter(s=>s.o.length).map(s=>kartuShift(s, kodeTerpakai(petak))).join('')}</div>`
    + `<div class="catatan"><b>${T('Kode yang bisa diisi:','Codes you can fill in:')}</b> ${u.dinas.join(' · ')}.
        ${T('Huruf terakhir menyebut gedungnya — <b>J</b> untuk JATSC, <b>N</b> untuk New JATSC — dan jamnya '
          + 'sama untuk keduanya. Jam dinas dihitung UTC: <b>PS</b> 00:00–12:00, <b>M</b> 12:00–00:00, dan '
          + 'kalau hari itu dipecah <b>P</b> 00:00–07:00 dan <b>S</b> 07:00–13:00, malamnya mundur jadi '
          + '13:00–00:00. <b>SPKL</b> (Surat Perintah Kerja Lembur) mengikuti bentuk shift dasarnya — '
          + '<b>SPKLPSJ</b> berarti SPKL untuk shift PS di JATSC, dan seterusnya — jamnya sama, kartunya '
          + 'berwarna beda. <b>CUTI</b>, <b>CAP</b> (Cuti Alasan Penting/sakit), <b>IJIN</b>, dan '
          + '<b>DL</b> (Dinas Luar — bertugas di luar stasiun) tetap '
          + 'memasang orangnya di petak hari itu supaya kelihatan siapa yang tidak di tempat, tetapi tidak '
          + 'dihitung sebagai berdinas. Kartu di atas hanya memuat kode yang benar-benar terisi di '
          + 'jadwal bulan ini; yang tidak dipakai tidak ikut dipasang sebagai kotak kosong.',
            'The last letter names the building — <b>J</b> for JATSC, <b>N</b> for New JATSC — and the hours '
          + 'are the same for both. Shift hours are UTC: <b>PS</b> 00:00–12:00, <b>M</b> 12:00–00:00, and when '
          + 'a day is split into <b>P</b> 00:00–07:00 and <b>S</b> 07:00–13:00, the night moves back to '
          + '13:00–00:00. <b>SPKL</b> (overtime work order) follows its base shift — <b>SPKLPSJ</b> means '
          + 'SPKL during the PS shift at JATSC, and so on — same hours, distinct colour. <b>CUTI</b> (annual '
          + 'leave), <b>CAP</b> (leave for a critical reason / sick), <b>IJIN</b> (permitted absence), and '
          + '<b>DL</b> (external duty — on duty away from the station) '
          + 'still show the person on that day so an absence from the station is visible, but do not count as on-duty. The '
          + 'cards above carry only the codes this month’s roster actually uses; the rest are not laid out '
          + 'as empty slots.')}</div>`
    + `<div class="catatan"><b>${T('Tersimpan di server ini.','Stored on this server.')}</b> ${
        T('Jadwal yang disimpan di sini terlihat oleh semua orang yang membuka dashboard ini — '
          + 'itu memang gunanya. Modulnya milik dashboard ini, bukan E-Logbook: yang ditanyakan ke '
          + 'E-Logbook hanya siapa Anda, untuk menentukan boleh mengisi atau tidak.',
          'A roster saved here is visible to everyone who opens this dashboard — that is the point. '
          + 'The module belongs to this dashboard, not to E-Logbook: the only thing asked of E-Logbook '
          + 'is who you are, to decide whether you may fill it in.')}</div>`;
}

/** Gambar ulang isi subtab saja. */
function jdwGambar(){
  const kotak = el('s-dinas');
  if(!kotak || !unitDibuka) return;
  kotak.innerHTML = jdwIsi(unitDibuka);
  jdwPasang(unitDibuka);
}

/**
 * Isi draf bulan yang dibuka dengan lanjutan pola dua bulan sebelumnya, lalu
 * masuk mode sunting. Tidak menyimpan apa pun.
 */
async function jdwPolaIsi(unit, tombol){
  const bulan = JDW.lihat;
  const ambil = async (b)=> b === JDW.bulanIni ? JDW.jadwal : await jdwAmbil(b);
  const adaIsi = JDW.sunting && (JDW.draf || []).some(o=>String(o.nama || '').trim() || (o.hari || []).some(Boolean));
  if(adaIsi && !confirm(T('Isi tabel yang sedang disunting akan diganti draf dari pola bulan lalu. Lanjutkan?',
      'The table being edited will be replaced by a draft from last month\'s pattern. Continue?'))) return;
  if(tombol) tombol.disabled = true;
  try{
    const sumber = bulanGeser(bulan, -1);
    const [lalu, sebelum] = await Promise.all([ambil(sumber), ambil(bulanGeser(bulan, -2))]);
    const draf = polaDraf(bulan, lalu[unit], sebelum[unit]);
    if(!draf){
      pesan(T(`Jadwal ${namaBulan(sumber)} unit ini belum ada — tidak ada pola yang bisa diteruskan.`,
              `There is no ${namaBulan(sumber)} roster for this unit — no pattern to continue.`));
      return;
    }
    JDW.draf = draf.orang;
    JDW.pola = { sumber, lanjut: draf.lanjut, ragu: draf.ragu, kosong: draf.kosong };
    JDW.sunting = true;
    jdwGambar();
  }catch(e){
    pesan(T('Jadwal bulan sebelumnya tidak bisa diambil: ','The previous roster could not be fetched: ') + (e && e.message || e));
  }finally{
    if(tombol && tombol.isConnected) tombol.disabled = false;
  }
}

/** Pasang pendengar untuk isi yang barusan digambar. */
function jdwPasang(unit){
  const kotak = el('s-dinas');
  if(!kotak) return;

  const bulanEl = kotak.querySelector('#jdwBulan');
  if(bulanEl) bulanEl.addEventListener('change', async ()=>{
    const b = bulanEl.value;
    if(!/^\d{4}-\d{2}$/.test(b)) return;
    JDW.lihat = b;
    try{
      JDW.jadwalLihat = b === JDW.bulanIni ? JDW.jadwal : await jdwAmbil(b);
    }catch(e){
      pesan(T('Jadwal bulan itu tidak bisa diambil: ','That month could not be fetched: ') + (e && e.message || e));
      JDW.jadwalLihat = {};
    }
    jdwGambar();
  });

  const btnSunting = kotak.querySelector('#jdwSunting');
  if(btnSunting) btnSunting.addEventListener('click', ()=>{
    // Salinan dalam, bukan rujukan: Batal harus benar-benar mengembalikan
    // keadaan sebelum disunting, termasuk kalau sudah puluhan sel diubah.
    JDW.draf = jdwBaris(unit).map(o=>({ nama:o.nama, peran:o.peran, nik:o.nik || '', hari:[...(o.hari||[])] }));
    if(!JDW.draf.length) JDW.draf.push({ nama:'', peran:'', nik:'', hari:[] });
    JDW.sunting = true; JDW.pola = null; JDW.pilih = null;
    jdwGambar();
  });

  const btnBatal = kotak.querySelector('#jdwBatal');
  if(btnBatal) btnBatal.addEventListener('click', ()=>{
    JDW.sunting = false; JDW.draf = null; JDW.pola = null; jdwGambar();
  });

  kotak.querySelectorAll('[data-jdw-pola]').forEach(b=>b.addEventListener('click', ()=>jdwPolaIsi(unit, b)));

  const btnImpor = kotak.querySelector('#jdwImpor');
  if(btnImpor) btnImpor.addEventListener('click', ()=>imporBuka(unit));

  const btnCetakPum = kotak.querySelector('#jdwCetakPum');
  if(btnCetakPum) btnCetakPum.addEventListener('click', ()=>cetakBuka('dinas', unit, { formatDinas:'pum' }));
  const btnCetakTeknik = kotak.querySelector('#jdwCetakTeknik');
  if(btnCetakTeknik) btnCetakTeknik.addEventListener('click', ()=>cetakBuka('dinas', unit, { formatDinas:'teknik' }));

  const btnTambah = kotak.querySelector('#jdwTambahOrang');
  if(btnTambah) btnTambah.addEventListener('click', ()=>{
    JDW.draf.push({ nama:'', peran:'', nik:'', hari:[] });
    jdwGambar();
  });

  const btnSimpan = kotak.querySelector('#jdwSimpan');
  if(btnSimpan) btnSimpan.addEventListener('click', async ()=>{
    // hari[] dirapatkan jadi larik penuh sepanjang bulannya. Menyetel satu sel
    // di tengah larik kosong meninggalkan lubang, dan lubang itu jadi null
    // begitu di-JSON — tersimpan sebagai sesuatu yang bukan kode dinas dan
    // bukan pula kosong.
    const hariN = jumlahHari(JDW.lihat);
    const orang = JDW.draf
      .map(o=>({
        nama:  String(o.nama || '').trim(),
        peran: String(o.peran || '').trim(),
        nik:   String(o.nik || '').trim(),
        hari:  Array.from({length:hariN}, (_,i)=>String((o.hari || [])[i] || ''))
      }))
      .filter(o=>o.nama);
    btnSimpan.disabled = true;
    try{
      await jdwSimpanUnit(JDW.lihat, unit, orang);
      JDW.jadwalLihat = { ...JDW.jadwalLihat, [unit]: orang };
      if(JDW.lihat === JDW.bulanIni) JDW.jadwal = JDW.jadwalLihat;
      JDW.sunting = false; JDW.draf = null; JDW.pola = null;
      jdwGambar();
      // Kartu "hari ini" di beranda dan layar Dinas ikut berubah, jadi
      // digambar ulang — bukan menunggu orangnya menyegarkan halaman.
      if(JDW.lihat === JDW.bulanIni) gambarDinas();
      pesan(T('Jadwal tersimpan.','Roster saved.'));
    }catch(e){
      pesan(T('Gagal menyimpan jadwal: ','Could not save the roster: ') + (e && e.message || e));
      btnSimpan.disabled = false;
    }
  });

  if(!JDW.sunting) return;

  // Sel dan isian dalam mode sunting menulis langsung ke draf. Tanpa
  // menggambar ulang: mengetik satu huruf lalu kehilangan kursor membuat
  // tabel selebar 31 kolom ini tidak mungkin diisi.
  jdwPasangExcel(kotak, unit);
  kotak.querySelectorAll('.jdw input[data-kolom]').forEach(i=>{
    i.addEventListener('input', ()=>{
      const b = JDW.draf[Number(i.dataset.baris)];
      if(b) b[i.dataset.kolom] = i.value;
    });
  });
  kotak.querySelectorAll('.jdw button[data-jdw-buang]').forEach(b=>{
    b.addEventListener('click', ()=>{
      JDW.draf.splice(Number(b.dataset.jdwBuang), 1);
      if(!JDW.draf.length) JDW.draf.push({ nama:'', peran:'', nik:'', hari:[] });
      jdwGambar();
    });
  });
}


/* =======================================================================
   SUNTING ALA EXCEL — mode sunting tabel jadwal

   Dulu tiap sel adalah dropdown: sebulan untuk 20 orang = 600 kali memilih.
   Sekarang sel biasa yang diperlakukan seperti lembar Excel:

   - klik lalu seret (atau Shift+klik) memblok beberapa sel;
   - kotak kecil di pojok kanan bawah blok ditarik ke samping/bawah untuk
     MENGULANG isi blok — blok "PS M L L" ditarik sampai tanggal 31 menjadi
     putaran penuh sebulan;
   - kode diketik langsung (tanpa membuka apa pun), Delete mengosongkan,
     panah berpindah, Ctrl+C/Ctrl+V menyalin dan menempel teks bertab — juga
     dari Excel —, Ctrl+Z mengurungkan;
   - di HP: ketuk sel, tarik kotak pojoknya, atau pakai tombol kode.

   Semua perubahan menulis langsung ke JDW.draf dan hanya memperbarui sel
   yang berubah. Tabel tidak digambar ulang (kecuali Urungkan), jadi posisi
   gulir tetap. Belum ada yang tersimpan sampai "Simpan jadwal" ditekan.
   ======================================================================= */

/** Blok terpilih sebagai kotak rapi { r0, r1, h0, h1 }, atau null. */
function jdwRentang(){
  const p = JDW.pilih;
  if(!p || !JDW.draf || !JDW.draf.length) return null;
  const rMaks = JDW.draf.length - 1, hMaks = jumlahHari(JDW.lihat) - 1;
  const jepit = (v, m)=> Math.max(0, Math.min(m, v));
  const r0 = jepit(p.r0, rMaks), r1 = jepit(p.r1, rMaks), h0 = jepit(p.h0, hMaks), h1 = jepit(p.h1, hMaks);
  return { r0:Math.min(r0,r1), r1:Math.max(r0,r1), h0:Math.min(h0,h1), h1:Math.max(h0,h1) };
}

const jdwNilai = (r, h)=> String(((JDW.draf[r] || {}).hari || [])[h] || '');

/** Catat keadaan sebelum perubahan. Draf baru (pola, impor) = riwayat baru. */
function jdwCatatRiwayat(){
  if(JDW.riwayatDraf !== JDW.draf){ JDW.riwayat = []; JDW.riwayatDraf = JDW.draf; }
  JDW.riwayat.push(JDW.draf.map(o=>[...(o.hari || [])]));
  if(JDW.riwayat.length > 60) JDW.riwayat.shift();
}

function jdwUrungkan(){
  if(JDW.riwayatDraf !== JDW.draf || !JDW.riwayat.length){
    pesan(T('Tidak ada yang bisa diurungkan.','Nothing to undo.'));
    return;
  }
  const lama = JDW.riwayat.pop();
  JDW.draf.forEach((o, i)=>{ if(lama[i]) o.hari = lama[i]; });
  jdwGambar();
}

/** Tulis satu sel ke draf dan ke layar. */
function jdwTulisSel(kotak, r, h, nilai){
  const b = JDW.draf[r];
  if(!b) return;
  if(!Array.isArray(b.hari)) b.hari = [];
  b.hari[h] = nilai;
  const td = kotak.querySelector(`td.jdw-sel[data-baris="${r}"][data-hari="${h}"]`);
  if(td){
    td.textContent = nilai;
    td.style.color = nilai ? warnaShift(nilai, 'var(--text)') : '';
  }
  jdwPerbaruiRekap(kotak, r);
}

/** Isi seluruh blok terpilih dengan satu kode ('' = kosongkan). */
function jdwIsiBlok(kotak, kode){
  const g = jdwRentang();
  if(!g) return;
  jdwCatatRiwayat();
  for(let r = g.r0; r <= g.r1; r++) for(let h = g.h0; h <= g.h1; h++) jdwTulisSel(kotak, r, h, kode);
  jdwTandai(kotak);
}

/** Tandai blok terpilih, pratinjau isian, dan pasang kotak pojok. */
function jdwTandai(kotak, pratinjau){
  kotak.querySelectorAll('td.jdw-sel.jdw-pilih, td.jdw-sel.jdw-pratinjau, td.jdw-sel.jdw-jangkar')
    .forEach(td=>td.classList.remove('jdw-pilih','jdw-pratinjau','jdw-jangkar'));
  kotak.querySelectorAll('.jdw-pegangan').forEach(x=>x.remove());
  const g = jdwRentang();
  if(!g) return;
  const tandai = (k, cls)=>{
    for(let r = k.r0; r <= k.r1; r++) for(let h = k.h0; h <= k.h1; h++){
      const td = kotak.querySelector(`td.jdw-sel[data-baris="${r}"][data-hari="${h}"]`);
      if(td) td.classList.add(cls);
    }
  };
  if(pratinjau) tandai(pratinjau, 'jdw-pratinjau');
  tandai(g, 'jdw-pilih');
  const jangkar = kotak.querySelector(`td.jdw-sel[data-baris="${JDW.pilih.r0}"][data-hari="${JDW.pilih.h0}"]`);
  if(jangkar) jangkar.classList.add('jdw-jangkar');
  const pojok = kotak.querySelector(`td.jdw-sel[data-baris="${g.r1}"][data-hari="${g.h1}"]`);
  if(pojok){
    const p = document.createElement('span');
    p.className = 'jdw-pegangan';
    p.title = T('Tarik untuk mengulang isi blok','Drag to repeat the selection');
    pojok.appendChild(p);
  }
}

/** Blok hasil tarikan pojok ke sel (r, h): diperpanjang ke satu arah saja,
    arah yang paling jauh ditarik — sama seperti Excel. */
function jdwTargetIsi(asal, r, h){
  const dh = h > asal.h1 ? h - asal.h1 : h < asal.h0 ? h - asal.h0 : 0;
  const dr = r > asal.r1 ? r - asal.r1 : r < asal.r0 ? r - asal.r0 : 0;
  if(!dh && !dr) return null;
  if(Math.abs(dh) >= Math.abs(dr)){
    return { r0:asal.r0, r1:asal.r1, h0:Math.min(asal.h0, h), h1:Math.max(asal.h1, h) };
  }
  return { r0:Math.min(asal.r0, r), r1:Math.max(asal.r1, r), h0:asal.h0, h1:asal.h1 };
}

/** Ulangi isi blok asal ke seluruh target (pola berulang, termasuk mundur). */
function jdwTerapkanIsi(kotak, asal, target){
  const tinggi = asal.r1 - asal.r0 + 1, lebar = asal.h1 - asal.h0 + 1;
  const mod = (a, n)=> ((a % n) + n) % n;
  const sumber = [];
  for(let r = 0; r < tinggi; r++){
    sumber.push([]);
    for(let h = 0; h < lebar; h++) sumber[r].push(jdwNilai(asal.r0 + r, asal.h0 + h));
  }
  jdwCatatRiwayat();
  for(let r = target.r0; r <= target.r1; r++) for(let h = target.h0; h <= target.h1; h++){
    if(r >= asal.r0 && r <= asal.r1 && h >= asal.h0 && h <= asal.h1) continue;
    jdwTulisSel(kotak, r, h, sumber[mod(r - asal.r0, tinggi)][mod(h - asal.h0, lebar)]);
  }
  JDW.pilih = { r0:target.r0, h0:target.h0, r1:target.r1, h1:target.h1 };
  jdwTandai(kotak);
}

/** Kode unit yang cocok dengan teks bebas (huruf besar-kecil dimaafkan). */
function jdwKodeSah(unit, teks){
  const t = String(teks || '').trim().toUpperCase();
  if(!t) return '';
  return (infoUnit(unit).dinas || []).find(k=>String(k).toUpperCase() === t) || null;
}

function jdwPasangExcel(kotak, unit){
  const gulir = kotak.querySelector('.jdw-gulir');
  const tabel = kotak.querySelector('table.jdw');
  if(!gulir || !tabel) return;
  const kode = infoUnit(unit).dinas || [];
  let ketik = '';
  const ketikEl = kotak.querySelector('#jdwKetik');
  const tampilKetik = ()=>{ if(ketikEl) ketikEl.textContent = ketik ? T('Ketik: ','Typing: ') + ketik + ' ↵' : ''; };

  const selDari = (x, y)=>{
    const t = document.elementFromPoint(x, y);
    const td = t && t.closest && t.closest('td.jdw-sel');
    return td && tabel.contains(td) ? { r:Number(td.dataset.baris), h:Number(td.dataset.hari) } : null;
  };
  const fokus = ()=>{ try{ gulir.focus({ preventScroll:true }); }catch(e){ gulir.focus(); } };

  /* ---- Seret: memblok (mouse) atau menarik kotak pojok (mouse dan sentuh) ---- */
  let mode = null, asal = null, target = null, titik = null, putar = 0;
  const gerak = ()=>{
    if(!mode || !titik) return;
    const s = selDari(titik.x, titik.y);
    if(s){
      if(mode === 'pilih'){
        JDW.pilih.r1 = s.r; JDW.pilih.h1 = s.h; jdwTandai(kotak);
      }else{
        target = jdwTargetIsi(asal, s.r, s.h); jdwTandai(kotak, target);
      }
    }
  };
  // Tabelnya 31 kolom dan lebih lebar dari layar: menyeret ke tepi kotak
  // menggulirnya sendiri, seperti Excel.
  const gulirTepi = ()=>{
    if(!mode) return;
    if(titik){
      const k = gulir.getBoundingClientRect();
      const kiri = k.left + 300;   // kolom No/Nama/NIK membeku di kiri
      if(titik.x > k.right - 40) gulir.scrollLeft += 14;
      else if(titik.x < kiri && gulir.scrollLeft > 0) gulir.scrollLeft -= 14;
      gerak();
    }
    putar = requestAnimationFrame(gulirTepi);
  };
  const selesai = (terapkan)=>{
    if(mode === 'isi' && terapkan && target) jdwTerapkanIsi(kotak, asal, target);
    else if(mode) jdwTandai(kotak);
    mode = null; asal = null; target = null; titik = null;
    cancelAnimationFrame(putar);
  };

  tabel.addEventListener('pointerdown', (e)=>{
    if(e.button !== 0) return;
    if(e.target.classList.contains('jdw-pegangan')){
      e.preventDefault();
      asal = jdwRentang();
      if(!asal) return;
      mode = 'isi'; titik = { x:e.clientX, y:e.clientY };
      try{ tabel.setPointerCapture(e.pointerId); }catch(_){}
      putar = requestAnimationFrame(gulirTepi);
      fokus();
      return;
    }
    const td = e.target.closest('td.jdw-sel');
    if(!td) return;
    const r = Number(td.dataset.baris), h = Number(td.dataset.hari);
    ketik = ''; tampilKetik();
    if(e.shiftKey && JDW.pilih){ JDW.pilih.r1 = r; JDW.pilih.h1 = h; }
    else JDW.pilih = { r0:r, h0:h, r1:r, h1:h };
    jdwTandai(kotak);
    fokus();
    // Sentuhan tidak memblok dengan menyeret: jarinya dipakai menggulir tabel.
    if(e.pointerType === 'mouse'){
      e.preventDefault();
      mode = 'pilih'; titik = { x:e.clientX, y:e.clientY };
      try{ tabel.setPointerCapture(e.pointerId); }catch(_){}
      putar = requestAnimationFrame(gulirTepi);
    }
  });
  tabel.addEventListener('pointermove', (e)=>{
    if(!mode) return;
    titik = { x:e.clientX, y:e.clientY };
    gerak();
  });
  tabel.addEventListener('pointerup', ()=>selesai(true));
  tabel.addEventListener('pointercancel', ()=>selesai(false));

  /* ---- Tombol kode dan Urungkan ---- */
  kotak.querySelectorAll('[data-jdw-kode]').forEach(b=>b.addEventListener('click', ()=>{
    if(!jdwRentang()){ pesan(T('Pilih dulu sel di tabel.','Select cells in the table first.')); return; }
    jdwIsiBlok(kotak, b.dataset.jdwKode);
    fokus();
  }));
  const btnUrung = kotak.querySelector('#jdwUrung');
  if(btnUrung) btnUrung.addEventListener('click', jdwUrungkan);

  /* ---- Keyboard ---- */
  const pindah = (dr, dh, perluas)=>{
    const g = jdwRentang();
    if(!g) return;
    const rMaks = JDW.draf.length - 1, hMaks = jumlahHari(JDW.lihat) - 1;
    const p = JDW.pilih;
    const r = Math.max(0, Math.min(rMaks, (perluas ? p.r1 : p.r0) + dr));
    const h = Math.max(0, Math.min(hMaks, (perluas ? p.h1 : p.h0) + dh));
    JDW.pilih = perluas ? { ...p, r1:r, h1:h } : { r0:r, h0:h, r1:r, h1:h };
    jdwTandai(kotak);
    const td = kotak.querySelector(`td.jdw-sel[data-baris="${r}"][data-hari="${h}"]`);
    if(td) td.scrollIntoView({ block:'nearest', inline:'nearest' });
  };
  // Kode yang sudah pasti (tidak ada kode lain yang diawali ketikan ini)
  // langsung dipakai; yang masih bisa bercabang menunggu Enter.
  const pakaiKetik = (paksa)=>{
    const t = ketik.toUpperCase();
    const calon = kode.filter(k=>String(k).toUpperCase().startsWith(t));
    const pas = kode.find(k=>String(k).toUpperCase() === t);
    const pilihan = pas && (paksa || calon.length === 1) ? pas : (paksa && calon.length === 1 ? calon[0] : null);
    if(!pilihan) return false;
    const g = jdwRentang();
    const tunggal = g && g.r0 === g.r1 && g.h0 === g.h1;
    jdwIsiBlok(kotak, pilihan);
    ketik = ''; tampilKetik();
    // Satu sel: lanjut ke tanggal berikutnya, jadi sebaris bisa diketik terus.
    if(tunggal) pindah(0, 1, false);
    return true;
  };

  gulir.addEventListener('keydown', (e)=>{
    if(e.target !== gulir || !jdwRentang()) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const panah = { ArrowUp:[-1,0], ArrowDown:[1,0], ArrowLeft:[0,-1], ArrowRight:[0,1] }[e.key];
    if(panah){ e.preventDefault(); ketik = ''; tampilKetik(); pindah(panah[0], panah[1], e.shiftKey); return; }
    if(ctrl && (e.key === 'z' || e.key === 'Z')){ e.preventDefault(); jdwUrungkan(); return; }
    if(ctrl) return;   // Ctrl+C / Ctrl+V lewat peristiwa copy/paste di bawah
    if(e.key === 'Delete' || (e.key === 'Backspace' && !ketik)){
      e.preventDefault(); jdwIsiBlok(kotak, ''); return;
    }
    if(e.key === 'Backspace'){ e.preventDefault(); ketik = ketik.slice(0, -1); tampilKetik(); return; }
    if(e.key === 'Escape'){ ketik = ''; tampilKetik(); return; }
    if(e.key === 'Enter' || e.key === 'Tab'){
      if(ketik){
        e.preventDefault();
        if(!pakaiKetik(true)){
          pesan(T(`Kode "${ketik}" tidak ada di unit ini.`, `Code "${ketik}" is not used by this unit.`));
          ketik = ''; tampilKetik();
        }
      }else if(e.key === 'Enter'){ e.preventDefault(); pindah(1, 0, false); }
      return;
    }
    if(e.key.length === 1 && /[A-Za-z0-9]/.test(e.key)){
      e.preventDefault();
      ketik += e.key.toUpperCase();
      // Ketikan yang tak mungkin jadi kode apa pun dimulai ulang dari huruf ini.
      if(!kode.some(k=>String(k).toUpperCase().startsWith(ketik))) ketik = e.key.toUpperCase();
      tampilKetik();
      pakaiKetik(false);
    }
  });

  /* ---- Salin & tempel (teks bertab, sama dengan yang dipakai Excel) ---- */
  gulir.addEventListener('copy', (e)=>{
    const g = jdwRentang();
    if(!g || e.target !== gulir) return;
    const baris = [];
    for(let r = g.r0; r <= g.r1; r++){
      const isi = [];
      for(let h = g.h0; h <= g.h1; h++) isi.push(jdwNilai(r, h));
      baris.push(isi.join('\t'));
    }
    e.clipboardData.setData('text/plain', baris.join('\r\n'));
    e.preventDefault();
    pesan(T('Tersalin.','Copied.'));
  });
  gulir.addEventListener('paste', (e)=>{
    const g = jdwRentang();
    if(!g || e.target !== gulir) return;
    e.preventDefault();
    const teks = (e.clipboardData && e.clipboardData.getData('text/plain')) || '';
    const kisi = teks.replace(/\r/g, '').replace(/\n+$/, '').split('\n').map(b=>b.split('\t'));
    if(!teks) return;
    const rMaks = JDW.draf.length - 1, hMaks = jumlahHari(JDW.lihat) - 1;
    // Satu nilai ke blok besar = isi seluruh blok, seperti Excel.
    const satu = kisi.length === 1 && kisi[0].length === 1;
    const tinggi = satu ? g.r1 - g.r0 + 1 : kisi.length;
    const lebar = satu ? g.h1 - g.h0 + 1 : Math.max(...kisi.map(b=>b.length));
    let lewat = 0;
    jdwCatatRiwayat();
    for(let dr = 0; dr < tinggi; dr++) for(let dh = 0; dh < lebar; dh++){
      const r = g.r0 + dr, h = g.h0 + dh;
      if(r > rMaks || h > hMaks) continue;
      // Baris tempelan yang lebih pendek tidak mengosongkan sel di sebelahnya.
      if(!satu && dh >= (kisi[dr] || []).length) continue;
      const mentah = satu ? kisi[0][0] : kisi[dr][dh];
      const k = jdwKodeSah(unit, mentah);
      if(k === null){ lewat++; continue; }
      jdwTulisSel(kotak, r, h, k);
    }
    JDW.pilih = { r0:g.r0, h0:g.h0, r1:Math.min(rMaks, g.r0 + tinggi - 1), h1:Math.min(hMaks, g.h0 + lebar - 1) };
    jdwTandai(kotak);
    if(lewat) pesan(T(`${lewat} sel dilewati: kodenya tidak dipakai unit ini.`,
                      `${lewat} cells skipped: code not used by this unit.`));
  });

  jdwTandai(kotak);
}
