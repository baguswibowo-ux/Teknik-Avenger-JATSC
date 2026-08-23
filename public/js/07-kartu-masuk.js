/* =======================================================================
   DUA ISI KARTU MASUK: MASUK DAN DAFTAR AKUN

   Pendaftaran mandiri dulu ada di layar login E-Logbook. Sejak Kelola Akun
   pindah ke sini, layar itu tidak lagi dipakai, dan pintu masuk akun baru
   ikut pindah — formulirnya di sini, endpoint-nya tetap /api/daftar milik
   E-Logbook. Yang dibuatnya akun NONAKTIF tanpa unit; aturan itu milik
   server dan tidak ditiru di sini.

   Perpindahannya lewat satu tautan di kaki kartu, bukan deret tombol sendiri.
   Deret itu pernah ada, tepat di atas pemilih TUJUAN, dan dua baris tombol
   sebentuk yang artinya berbeda membuat keduanya harus dibaca dulu sebelum
   bisa dipakai. Yang tersisa satu deret: E-LOGBOOK, DASHBOARD, DATA CONTOH.
   ======================================================================= */
let KM_TAB = 'masuk';
let KM_SUB_MASUK = '';   // kalimat pembuka aslinya, diambil dari markup sekali

/** Kalimat di bawah judul kartu ikut isinya — satu-satunya baris yang
    menjelaskan apa yang sedang diisi orangnya. */
function kmSetTab(tab, fokus){
  if(tab === 'daftar' && !SRV.ada) tab = 'masuk';
  KM_TAB = tab;
  const daftar = tab === 'daftar';
  // hidden, bukan sekadar disamarkan: kolom password yang tak terlihat tapi
  // masih bisa dihampiri Tab adalah jebakan bagi yang berpindah kolom dengan
  // papan ketik.
  el('kmPanelMasuk').hidden  = daftar;
  el('kmPanelDaftar').hidden = !daftar;
  el('kmSubTeks').textContent = daftar
    ? 'Buat akun E-Logbook baru dari sini. Akunnya langsung terbentuk tetapi masih '
      + 'nonaktif — administrator yang mengaktifkannya, lalu menentukan peran dan unitnya.'
    : KM_SUB_MASUK;
  if(daftar) ketDaftar();
  if(fokus) (daftar ? el('dfNama') : el('iUser')).focus();
}

/** Baris status di bawah tombol Kirim pendaftaran. Kembarannya srvKet(). */
function ketDaftar(teks, rupa){
  const k = el('ketDaftar');
  if(!teks){
    teks = SRV.ada
      ? 'Akun baru lahir sebagai teknisi, tanpa unit, dan nonaktif. Membuka pendaftaran '
        + 'tidak sama dengan membuka pintu — administrator yang mengaktifkannya.'
      : 'Pendaftaran menulis ke database E-Logbook, dan servernya tidak terjawab dari sini.';
    rupa = SRV.ada ? '' : 'km-awas';
  }
  k.className = 'km-sumber-ket ' + (rupa || '');
  k.querySelector('span').textContent = teks;
}

async function daftarKirim(){
  if(!SRV.ada){ ketDaftar(); return; }
  const nama     = el('dfNama').value.trim();
  const username = el('dfUser').value.trim().toLowerCase();
  const p1 = el('dfPass').value, p2 = el('dfPass2').value;

  // Diperiksa di sini juga, bukan cuma di server: yang salah ketik pantas tahu
  // sebelum permintaannya berangkat. Aturannya tetap milik server — ia
  // memeriksa ulang semuanya, dan halaman ini tidak menjaga apa pun.
  if(!nama){ ketDaftar('Nama lengkap belum diisi.', 'km-awas'); return; }
  if(!/^[a-z0-9._-]{3,32}$/.test(username)){
    ketDaftar('Username 3–32 karakter: huruf kecil, angka, titik, garis bawah, atau strip.', 'km-awas');
    return;
  }
  if(p1.length < 6){ ketDaftar('Password minimal 6 karakter.', 'km-awas'); return; }
  if(p1 !== p2){ ketDaftar('Ulangan passwordnya belum sama.', 'km-awas'); return; }

  const btn = el('btnDaftar'), teksAsli = btn.textContent;
  btn.disabled = true; btn.textContent = 'Mengirim...';
  ketDaftar('Mengirim pendaftaran ke server...', 'km-sibuk');
  try{
    const r = await srvFetch('/api/daftar', {
      method:'POST', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ nama, username, password:p1 })
    });
    const j = await r.json().catch(()=>({}));
    if(!r.ok){ ketDaftar(j.error || 'Pendaftaran ditolak server.', 'km-awas'); return; }
    ['dfNama','dfUser','dfPass','dfPass2'].forEach(id=>{ el(id).value = ''; });
    ketDaftar('Akun ' + username + ' terdaftar dan menunggu diaktifkan administrator. '
      + 'Setelah aktif, masuk lewat tab MASUK dengan akun itu.', 'km-baik');
  }catch(e){
    ketDaftar('Server tidak terjawab: ' + (e && e.message || e), 'km-awas');
  }finally{
    btn.disabled = false; btn.textContent = teksAsli;
  }
}

/* =======================================================================
   NAMA YANG MENEMPEL DI KARTU MASUK

   Kartu ini menawarkan "Lanjutkan sebagai X" selama cookie E-Logbook masih
   hidup, dan kolom username ikut terisi sendiri. Itu benar selama sesinya
   memang masih ada — masalahnya SRV.sesi cuma ditanyakan sekali, waktu
   halaman dibuka. Sesi yang sesudah itu habis, atau diputus dari tab
   E-Logbook, tetap terpampang di sini sampai halaman disegarkan.

   Dua jalan keluarnya, dan keduanya dipasang:
     - ditanyakan ulang tiap kartu masuk dibuka dan tiap orang keluar dari
       dashboard, jadi nama yang sudah tidak berlaku hilang sendiri;
     - tombol Keluar di dashboard memutus sesinya sungguhan, jadi tidak ada
       nama yang bisa menempel sesudahnya.

   Sempat ada tombol ketiga, "Bukan Anda? Ganti akun", untuk komputer yang
   dipakai bergantian. Ia dibuang setelah Keluar benar-benar memutus sesi.

   Sempat ada juga ingatan username di localStorage, supaya sesudah keluar
   kolomnya sudah terisi dan yang tersisa mengetik password. Itu pun dibuang:
   sesi yang sudah diputus tidak pantas meninggalkan siapa pun di layar. Kartu
   masuk sekarang selalu mulai kosong, dan nama pemakai sebelumnya tidak
   tertinggal di peramban komputer yang dipakai bergantian.
   ======================================================================= */

/* Ingatan username yang dulu disimpan di sini dibuang, tapi nilainya bisa
   masih tertinggal di peramban orang yang sudah memakai versi sebelumnya.
   Dihapus sekali saat halaman dimuat — kalau tidak, ia diam di sana tanpa ada
   satu baris pun yang akan membacanya lagi. */
try{ localStorage.removeItem('avenger.user.terakhir'); }catch(e){ /* localStorage ditutup */ }

/** Sudah ada yang menyentuh kolom username? Kalau ya, isinya tidak boleh
    ditimpa sesi mana pun — juga tidak dikosongkan saat sesinya ternyata mati. */
let userDiketik = false;

async function srvSegarkanSesi(){
  if(!SRV.ada) return;
  let baru = null;
  try{
    const r = await srvFetch('/api/me', {}, 5000);
    const j = await r.json().catch(()=>null);
    // Jawaban yang tidak jelas tidak dipakai menyimpulkan apa-apa: yang
    // menghapus nama hanya jawaban yang benar-benar datang dan terbaca.
    if(!j || (r.status !== 200 && r.status !== 401)) return;
    baru = (r.status === 200 && j.user) ? j.user : null;
  }catch(e){ return; }

  if((baru && baru.username) === (SRV.sesi && SRV.sesi.username)) return;
  SRV.sesi = baru;
  // Sesinya habis: nama yang menempel dilepas, lalu segarkanKartuMasuk()
  // mengisinya kembali dengan username yang terakhir dipakai — bukan
  // dibiarkan kosong seperti dulu.
  if(!baru && !userDiketik) el('iUser').value = '';
  segarkanKartuMasuk();
}

/* Satu-satunya tempat di halaman ini yang memanggil /api/logout, dan sekarang
   ia dipanggil tombol Keluar.

   Dulu tidak: Keluar sengaja tidak memutus sesi E-Logbook, alasannya orangnya
   mungkin masih memakai tab E-Logbook di sebelah dan tidak pantas ikut
   tertendang. Yang memutus cuma tombol "Ganti akun" di kartu masuk.

   Itu dibalik atas permintaan, dan alasannya lebih kuat: keluar yang tidak
   benar-benar mengeluarkan adalah janji yang tidak ditepati. Di komputer yang
   dipakai bergantian, orang berikutnya menemukan "Lanjutkan sebagai <nama
   orang sebelumnya>" dan bisa menekannya tanpa password sama sekali. Tab
   E-Logbook yang ikut tertutup itu harga yang jauh lebih murah. */
async function putusSesiServer(){
  if(!SRV.ada) return;
  try{ await srvFetch('/api/logout', { method:'POST' }, 5000); }
  catch(e){ console.warn('Logout E-Logbook gagal:', e && e.message || e); }
  SRV.sesi = null;
}

function kmMulai(){
  const jam = () => {
    const n = new Date(), p = (x)=>String(x).padStart(2,'0');
    el('kmJam').textContent = p(n.getUTCHours())+':'+p(n.getUTCMinutes())+':'+p(n.getUTCSeconds());
  };
  jam(); setInterval(jam, 1000);

  el('kmSesi').addEventListener('click', ()=>kmSetMasuk(true));
  el('kmPicuMasuk').addEventListener('click', ()=>kmSetMasuk(true));
  el('kmTutupMasuk').addEventListener('click', ()=>kmSetMasuk(false));
  /* Esc menutup kartu, tapi hanya selama layar masuk yang di depan — kalau
     dashboardnya sudah terbuka, Esc di sana bukan urusan layar ini. */
  document.addEventListener('keydown', e=>{
    if(e.key === 'Escape' && !el('layarMasuk').classList.contains('pergi')) kmSetMasuk(false);
  });
  el('iUser').addEventListener('input', ()=>{ userDiketik = true; kmSegarkanSesi(); });
  kmSegarkanSesi();

  // Kalimat pembuka aslinya diambil dari markup, bukan ditulis ulang di JS —
  // satu kalimat di dua tempat pasti berbeda cepat atau lambat.
  KM_SUB_MASUK = el('kmSubTeks').textContent.replace(/\s+/g, ' ').trim();
  el('btnBukaDaftar').addEventListener('click',   ()=>kmSetTab('daftar', true));
  el('btnKembaliMasuk').addEventListener('click', ()=>kmSetTab('masuk',  true));
  el('btnDaftar').addEventListener('click', daftarKirim);
  // Enter di kolom mana pun mengirim pendaftarannya, sama seperti di kartu masuk.
  ['dfNama','dfUser','dfPass','dfPass2'].forEach(id=>{
    el(id).addEventListener('keydown', e=>{ if(e.key === 'Enter') daftarKirim(); });
  });

  /* Panggung dijeda begitu layar masuk pergi dan jalan lagi kalau pemakai
     keluar dari dashboard. MutationObserver, bukan tambalan di masuk() dan
     tombolKeluar — supaya kedua fungsi itu tidak perlu tahu soal panggung. */
  const layar = el('layarMasuk');
  new MutationObserver(()=>{
    if(!kmPanggung) return;
    if(layar.classList.contains('pergi')) kmPanggung.jeda();
    else kmPanggung.jalankan();
  }).observe(layar, { attributes:true, attributeFilter:['class'] });

  el('kmUlangi').addEventListener('click', ()=>{ if(kmPanggung) kmPanggung.ulangi(); });

  /* three.js datang dari CDN. Kalau dalam 8 detik belum ada, panggungnya
     dilewatkan — kisi radar di CSS yang tersisa, kartu masuk tetap jalan. */
  (function tunggu(sisa){
    if(window.THREE){
      try{
        kmPanggung = kmBangunPanggung();
        kmPanggung.jalankan();
        el('kmUlangi').hidden = false;   // baru ada gunanya sekarang
      }
      catch(e){ console.error('Panggung layar masuk gagal dibangun:', e); }
      return;
    }
    if(sisa <= 0){ console.warn('three.js tidak sampai — panggung 3D dilewatkan.'); return; }
    setTimeout(()=>tunggu(sisa - 120), 120);
  })(8000);
}

