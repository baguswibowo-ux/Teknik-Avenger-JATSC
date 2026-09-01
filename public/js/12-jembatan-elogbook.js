/* =======================================================================
   JEMBATAN E-LOGBOOK — mengambil yang sudah jadi di sana

   Halaman ini tetap berdiri sendiri: tidak ada satu berkas pun milik
   E-Logbook yang dimuat ke sini. Yang dipakai cuma API-nya, dipanggil ke
   /api/* pada asal yang sama —
   server.js di akar proyek yang meneruskannya ke E-Logbook. Bagi browser
   semuanya satu asal, jadi tidak ada urusan CORS dan cookie sesinya ikut.
   Dibuka lewat file:// atau server statis lain (tanpa penerusan itu),
   pemeriksaannya gagal dan kartu masuknya mengatakan servernya tidak terjawab.

   Tiga hal yang datang dari E-Logbook: daftar unit, isu (jadi papan trouble),
   dan catatan logbook. Peralatan, sparepart, sejarah peralatan, personel,
   jadwal dinas, kegiatan berkala, dokumen, dan galeri tidak ada di sana —
   modul-modul itu milik dashboard ini dan tersimpan di servernya sendiri.

   Jadwal dinas bukan salah satunya: modul itu milik dashboard ini dan
   tersimpan di servernya sendiri. Yang ditanyakan ke E-Logbook cuma siapa
   pemakainya, untuk menentukan siapa yang boleh mengisi.

   Keluar dari prototipe TIDAK memutus sesi E-Logbook. Cookie sesinya milik
   aplikasi yang sungguhan; memanggil /api/logout dari sini akan menendang
   pemakainya keluar dari tab E-Logbook yang mungkin sedang ia pakai.

   Satu berkas E-Logbook memang disunting demi dashboard ini, dan sampai
   sekarang cuma satu: elogbook/public/js/26-init.js membaca tanda pagar
   #<tab>:<unit> di alamatnya, supaya tautan dalam dari sini (tombol Buka
   DS Test di baris kegiatan berkala) mendarat langsung di tab yang
   mengerjakannya, bukan di halaman depan. Yang berjalan tetap kode
   E-Logbook di halaman E-Logbook; yang berangkat dari sini cuma alamatnya.
   Tanpa suntingan itu tautannya tidak rusak — ia sekadar berhenti di tab
   biasa.
   ======================================================================= */

/* Tidak ada lagi TUJUAN yang dipilih orang. Dulu ada tiga — E-Logbook,
   Dashboard, Data contoh — dan ketiganya jadi pertanyaan yang harus dijawab
   sebelum boleh mengetik username. Sekarang masuk berarti satu hal: mendarat
   di dashboard ini. E-Logbook dibuka dari tombolnya di kepala dashboard.

   Data contoh pun sudah tidak ada. Ia dulu berlaku kalau E-Logbook tidak
   terjawab, dan gunanya memang nyata: etalase di luar jaringan kantor, sebelum
   ada servernya. Sesudah kedua aplikasi hidup di produksi, yang tersisa dari
   kegunaan itu tinggal risikonya — server yang diam dijawab dengan layar penuh
   angka karangan, dan yang membacanya tidak punya cara membedakannya dari yang
   nyata. Sekarang server yang diam terlihat sebagai server yang diam.       */

const SRV = {
  ada:   false,   // server E-Logbook menjawab di alamat yang sama
  sesi:  null,    // { username, nama, role } kalau cookie sesinya masih hidup
  aktif: false,   // data yang sedang tampil benar-benar dari server
  unit:  [],      // kode unit yang berhasil diambil
  jam:   null     // kapan data itu diambil
};

const PERAN_SERVER    = { admin:'Administrator', pejabat:'Pejabat / Manager',
                          adminunit:'Admin Unit', teknisi:'Teknisi' };
const PERAN_SERVER_EN = { admin:'Administrator', pejabat:'Officer / Manager',
                          adminunit:'Unit Admin', teknisi:'Technician' };
/** Urutan peran dari yang paling sempit ke yang paling luas. Dipakai untuk
    mengisi pemilih peran, supaya daftarnya tidak perlu ditulis ulang di tiap
    tempat — dan tidak ada peran yang tertinggal di salah satunya. */
const PERAN_URUT = ['teknisi', 'adminunit', 'pejabat', 'admin'];
/** Sebutan peran menurut bahasa yang sedang dipilih. */
const peranTampil = (role) => (BHS === 'en' ? PERAN_SERVER_EN : PERAN_SERVER)[role] || role;
/** Sebutan peran akun yang sedang masuk. */
const peranAkun = () => (BHS === 'en' && akun && akun.peranEn) ? akun.peranEn : (akun ? akun.peran : '');

/** Ambil bagian tanggal dari apa pun bentuk kiriman server ('2026-08-14', ISO penuh). */
const isoTgl = (x) => { const m = String(x||'').match(/\d{4}-\d{2}-\d{2}/); return m ? m[0] : ''; };
const isoHariIni = () => new Date(Date.now() - new Date().getTimezoneOffset()*60000)
  .toISOString().slice(0,10);

/** fetch dengan batas waktu — server yang menggantung tidak boleh membekukan kartu masuk. */
async function srvFetch(jalur, opsi = {}, ms = 8000){
  const henti = new AbortController();
  const jam = setTimeout(()=>henti.abort(), ms);
  try{ return await fetch(jalur, { credentials:'same-origin', signal:henti.signal, ...opsi }); }
  finally{ clearTimeout(jam); }
}

/** Panggil API E-Logbook. Bentuknya sama persis dengan gsRun di aplikasinya:
    POST /api/<fn> dengan body { args:[...] }. */
async function srvApi(fn, ...args){
  const r = await srvFetch('/api/'+fn, {
    method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ args })
  }, 20000);
  const data = await r.json().catch(()=>null);
  if(!r.ok) throw new Error((data && data.error) || ('server menjawab '+r.status));
  return data ? data.result : null;
}

/* ---------- TTD akun: satu sumber, tinggal ambil ----------
   Dashboard punya SALINAN sendiri berkas TTD tersimpan milik akun dari
   E-Logbook — server dashboard menaruhnya di data/ttd-akun/ dan
   menyajikannya di /ttd-akun/:user (metadata JSON) dan
   /ttd-akun/:user/gambar (berkas PNG). Sumber utamanya tetap tabel users
   di E-Logbook (kolom ttd_tersimpan, lihat simpanTtdTersimpan di
   elogbook/db.js); yang di sini cuma cermin — dan bertahan saat E-Logbook
   lambat/mati sesaat.

   Yang boleh MEMBUAT TTD hanya pemilik akun (simpanTtdSaya) atau
   admin/superadmin untuk pejabat (simpanTtdMilik); keduanya tetap
   berjalan lewat proxy /api/*, jadi dashboard tidak jadi tempat kedua
   untuk menulis TTD. Setelah tulisan berhasil, klien memanggil
   ttdAkunInvalidate — yang membuang salinan lokal di dashboard supaya
   pengambilan berikutnya menyalin ulang dari E-Logbook. */
const TTD_AKUN = new Map();   // username -> { ada, nama, role, url, dibuatPada, jam }

/** Ambil TTD milik satu akun. Dua jalur, urut dari yang terbaik:
      1. /ttd-akun/:user (endpoint dashboard, punya salinan lokal —
         bertahan meski E-Logbook lambat sesaat)
      2. /api/getTtdMilik lewat proxy (langsung ke E-Logbook — cadangan
         kalau endpoint dashboard belum ada, mis. server belum di-restart)
    URL gambarnya:
      - jalur (1) → /ttd-akun/:user/gambar (dari salinan lokal)
      - jalur (2) → /uploads/{nama} (proxied langsung, kalau /ttd-akun
        belum aktif, /uploads tetap diteruskan lewat JALUR_TERUS)
    Menyingahi 5 menit di peramban. Setelah simpanTtdSaya/simpanTtdMilik,
    panggil ttdAkunInvalidate(username) supaya pengambilan berikut
    menembus singgahan sekaligus salinan lokal server. */
async function ttdAkunAmbil(username, opts){
  const paksa = !!(opts && opts.paksa);
  const u = String(username || '').trim();
  if(!u) return { ada:false, nama:'', role:'', url:'', dibuatPada:'' };
  const cache = TTD_AKUN.get(u);
  const segar = cache && (Date.now() - cache.jam) < 5 * 60 * 1000;
  if(cache && segar && !paksa) return cache;

  /* Jalur 1 — endpoint dashboard dengan salinan lokal. */
  try{
    const r = await srvFetch('/ttd-akun/' + encodeURIComponent(u), {}, 15000);
    if(r.ok){
      const j = await r.json();
      const isi = {
        ada:        !!j.ada,
        nama:       j.nama || '',
        role:       j.role || '',
        url:        j.url || '',
        dibuatPada: j.dibuatPada || '',
        dariCache:  !!j.dariCache,
        sumber:     'ttd-akun',
        jam:        Date.now()
      };
      TTD_AKUN.set(u, isi);
      return isi;
    }
    /* 404 → endpoint belum terpasang di server dashboard (belum restart).
       Bukan galat mati — jatuh ke jalur 2. */
    console.warn('[ttd-akun] /ttd-akun/' + u + ' menjawab ' + r.status + ' — coba jalur langsung');
  }catch(e){
    console.warn('[ttd-akun] /ttd-akun/' + u + ' gagal:', e && e.message || e);
  }

  /* Jalur 2 — cadangan langsung ke E-Logbook lewat proxy /api/*. */
  try{
    const meta = await srvApi('getTtdMilik', u);
    if(meta){
      const isi = {
        ada:        !!meta.ada,
        nama:       meta.nama || '',
        role:       meta.role || '',
        url:        meta.ada && meta.path ? meta.path : '',  // "/uploads/xxxx.png" → langsung diproxy
        dibuatPada: meta.dibuatPada || '',
        dariCache:  false,
        sumber:     'api-langsung',
        jam:        Date.now()
      };
      TTD_AKUN.set(u, isi);
      return isi;
    }
  }catch(e){
    console.warn('[ttd-akun] fallback /api/getTtdMilik untuk ' + u + ' gagal:', e && e.message || e);
  }

  /* Dua jalur habis. Kembalikan singgahan lama kalau ada, atau
     "tidak ada" — biar pemanggil menawarkan kanvas gambar. */
  if(cache) return cache;
  return { ada:false, nama:u, role:'', url:'', dibuatPada:'', jam:Date.now() };
}

/** Buang singgahan peramban DAN salinan lokal di server — dipanggil
    setelah simpanTtdSaya/simpanTtdMilik supaya panggilan berikut menyalin
    ulang dari E-Logbook. Kegagalan hapus di server tidak fatal: singgahan
    server disegarkan sendiri kalau metadata dibuatPada berbeda. */
async function ttdAkunInvalidate(username){
  const u = String(username || '').trim();
  if(!u) return;
  TTD_AKUN.delete(u);
  try{
    await srvFetch('/ttd-akun/' + encodeURIComponent(u), { method:'DELETE' }, 8000);
  }catch(e){ /* biarkan — sisi klien sudah dilepas, server akan menyegarkan sendiri */ }
}

/** Panaskan singgahan untuk akun yang sedang masuk — dipanggil sekali
    di akhir srvMuat. Kegagalan diabaikan: kartu cetak tetap bisa muat
    TTD-nya sendiri saat dibuka. */
async function ttdSayaMuat(){
  if(!akun || !akun.user) return;
  try{ await ttdAkunAmbil(akun.user, { paksa:true }); }
  catch(e){ /* biarkan — pemanggilan berikut yang akan mencoba lagi */ }
}

/** Sekali di awal: apakah ada server E-Logbook di alamat ini, dan apakah
    sesinya masih hidup. 401 tetap berarti "servernya ada" — cuma belum masuk. */
async function srvPeriksa(){
  try{
    const r = await srvFetch('/api/me', {}, 5000);
    const j = await r.json().catch(()=>null);
    // Halaman 404 milik server statis lain juga menjawab, tapi bukan JSON —
    // itu sebabnya jawabannya harus benar-benar terbaca sebelum diakui.
    SRV.ada  = (r.status === 200 || r.status === 401) && !!j;
    SRV.sesi = (r.status === 200 && j && j.user) ? j.user : null;
  }catch(e){
    SRV.ada = false; SRV.sesi = null;
  }
  segarkanKartuMasuk();
}

/** Kartu masuk digambar ulang mengikuti keadaan: ada server atau tidak, ada
    sesi yang masih hidup atau tidak. Dulu bernama pilihTujuan() dan menerima
    tujuan sebagai argumen; sekarang tidak ada yang perlu dipilih. */
function segarkanKartuMasuk(){
  el('iUser').placeholder = 'username E-Logbook Anda';
  el('iPass').placeholder = SRV.sesi
    ? 'kosongkan — sesi Anda masih aktif'
    : 'password akun E-Logbook';
  el('btnMasuk').textContent = SRV.sesi
    ? 'Lanjutkan sebagai ' + (SRV.sesi.nama || SRV.sesi.username)
    : 'Masuk';

  /* Kolom username diisikan sendiri dari satu sumber saja: sesi yang memang
     masih hidup. Yang sudah diputus tidak meninggalkan apa-apa — kolomnya
     tetap kosong, dan orang berikutnya di komputer yang sama tidak menemukan
     nama siapa pun di sana. Yang sedang diketik tidak pernah ditimpa. */
  if(!el('iUser').value && !userDiketik && SRV.sesi){
    el('iUser').value = SRV.sesi.username;
  }

  // Pendaftaran menulis ke database E-Logbook; tanpa servernya tidak ada yang
  // bisa didaftarkan. Tautannya dilepas sama sekali, bukan sekadar dimatikan —
  // di salinan yang memang berdiri sendiri, tautan mati cuma menimbulkan
  // pertanyaan yang tidak ada jawabannya.
  el('btnBukaDaftar').hidden = !SRV.ada;
  if(!SRV.ada && KM_TAB === 'daftar') kmSetTab('masuk');

  srvKet();
  kmSegarkanSesi();
}

/** Baris status di bawah pemilih sumber. */
function srvKet(teks, rupa){
  const k = el('ketSumber');
  if(!teks){
    if(!SRV.ada){
      // Tidak ada lagi data contoh untuk dijatuhi, dan itu disengaja: server
      // yang diam adalah kerusakan yang pantas terlihat. Sarannya saja yang
      // berbeda, menurut ada tidaknya E-Logbook yang bisa dinyalakan sendiri.
      teks = KEMAMPUAN.elogbook
        ? 'Server E-Logbook tidak terjawab. Nyalakan servernya (npm start), lalu coba lagi.'
        : 'Server E-Logbook tidak terjawab. Coba lagi sebentar lagi, atau hubungi yang mengurus servernya.';
      rupa = 'km-awas';
    }else if(SRV.sesi){
      teks = 'Sesi E-Logbook aktif sebagai ' + (SRV.sesi.nama || SRV.sesi.username) +
             '. Tekan lanjut tanpa mengisi password.';
      rupa = 'km-baik';
    }else{
      // Kondisi normal (server hidup, belum ada sesi) sengaja tidak menuliskan
      // apa pun di baris ini — kartu login sudah menjelaskan apa yang harus
      // dilakukan. Baris ini disisakan hanya untuk keadaan bermasalah di atas.
      teks = '';
      rupa = 'km-baik';
    }
  }
  k.className = 'km-sumber-ket ' + (rupa || '');
  k.querySelector('span').textContent = teks;
}

async function masukServer(){
  const u = el('iUser').value.trim();
  const p = el('iPass').value;
  const btn = el('btnMasuk');
  const teksAsli = btn.textContent;
  btn.disabled = true;
  try{
    // Sesi yang sudah hidup dipakai apa adanya — password tidak diminta dua
    // kali hanya karena halamannya berbeda.
    const pakaiSesi = !!SRV.sesi && !p && (!u || u.toLowerCase() === SRV.sesi.username.toLowerCase());
    if(!pakaiSesi){
      if(!u || !p){ pesan(T('Isi username dan password akun E-Logbook Anda.',
        'Enter the username and password of your E-Logbook account.')); return; }
      btn.textContent = T('Memeriksa...','Checking...');
      srvKet('Memeriksa akun ke server...', 'km-sibuk');
      const r = await srvFetch('/api/login', {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ username:u, password:p })
      });
      const j = await r.json().catch(()=>({}));
      if(!r.ok){ pesan(j.error || 'Gagal masuk ke server E-Logbook.'); srvKet(); return; }
      SRV.sesi = j.user;
    }
    el('iPass').value = '';

    btn.textContent = T('Mengambil data...','Fetching data...');
    srvKet('Mengambil data dari server...', 'km-sibuk');
    await srvMuat();
    bukaDashboard();
  }catch(e){
    console.error('Sambungan ke E-Logbook gagal:', e);
    pesan(T('Gagal mengambil data dari server: ','Could not fetch data from the server: ') + (e && e.message || e));
    srvKet('Gagal mengambil data: ' + (e && e.message || e), 'km-awas');
  }finally{
    btn.disabled = false;
    btn.textContent = teksAsli;
  }
}

/**
 * Ambil data seluruh unit yang boleh dibuka akun ini.
 *
 * getAllData menjawab satu unit per panggilan — itu bentuk API-nya, dan
 * dashboard ini butuh lintas unit. Panggilan pertama dikirim tanpa unit:
 * jawabannya membawa daftar unit yang boleh dibuka, jadi tidak perlu menebak
 * satu pun kode unit dari sisi ini. Sisanya diambil satu per satu, dan unit
 * yang gagal cukup dilewati — satu unit bermasalah tidak boleh menggagalkan
 * seluruh layar.
 */
async function srvMuat(){
  const awal = await srvApi('getAllData', '');
  // Daftar akun ikut di jawaban pertama, tapi hanya untuk administrator —
  // server yang memutuskan itu, bukan halaman ini. Untuk peran lain isinya
  // memang kosong, dan layar Kelola Akun pun tidak muncul.
  USERS = Array.isArray(awal.users) ? awal.users : [];
  USERS_JAM = USERS.length ? new Date() : null;
  // Overlay hak lanjut per akun (bolehTtd, unitKhusus) — endpoint terpisah
  // di dashboard, tidak ikut awal. Tanpa panggilan ini, membuka kartu pejabat
  // sebelum pernah menekan "Muat ulang" menampilkan seluruh centang bolehTtd
  // dalam keadaan kosong walau data di server sudah ada. muatHakAkun sudah
  // menelan galat 403/error sendiri — non-admin tetap aman.
  if(USERS.length && typeof muatHakAkun === 'function') await muatHakAkun();
  const paket = { [awal.unit]: awal };
  for(const u of (awal.unitSaya || [])){
    if(paket[u.kode]) continue;
    try{ paket[u.kode] = await srvApi('getAllData', u.kode); }
    catch(e){ console.warn('Unit ' + u.kode + ' dilewati:', e && e.message || e); }
  }
  srvPasang(awal.unitSaya || [], paket, awal.unitSemua);
  // Setelah SRV.aktif menyala: database unit diambil dari server ini sendiri,
  // bukan dari E-Logbook. Kegagalannya tidak menggagalkan pemuatan — layarnya
  // tetap hidup, hanya daftarnya yang belum terisi.
  await unitdbMuat();
  await sjrMuat();
  await dokMuat();
  /* TTD tersimpan milik akun ini dipanaskan di singgahan sisi peramban,
     supaya modal cetak yang dibuka pertama kali tidak perlu menunggu
     bolak-balik ke E-Logbook untuk gambarnya sendiri. */
  await ttdSayaMuat();
}

