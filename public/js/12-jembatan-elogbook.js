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
                          adminunit:'Admin Unit', pic:'PIC Unit', teknisi:'Teknisi' };
const PERAN_SERVER_EN = { admin:'Administrator', pejabat:'Officer / Manager',
                          adminunit:'Unit Admin', pic:'Unit PIC', teknisi:'Technician' };
/** Urutan peran dari yang paling sempit ke yang paling luas. Dipakai untuk
    mengisi pemilih peran, supaya daftarnya tidak perlu ditulis ulang di tiap
    tempat — dan tidak ada peran yang tertinggal di salah satunya. */
const PERAN_URUT = ['teknisi', 'pic', 'adminunit', 'pejabat', 'admin'];
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
      teks = 'Server terjawab. Masuk dengan akun E-Logbook Anda untuk memakai data nyata.';
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
}

