/* E-Logbook · js/25-login.js — Layar login, pendaftaran mandiri, dan pemeriksaan sesi
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh. */

/* ============== LOGIN ============== */
let userSaatIni = null;

function showLogin(pesan){
  document.getElementById('loginBg').classList.add('show');
  bukaLogin();
  document.getElementById('userChip').style.display = 'none';
  const err = document.getElementById('loginErr');
  if(pesan){ err.textContent = pesan; err.classList.add('show'); }
  else { err.textContent = ''; err.classList.remove('show'); }
  document.getElementById('loginPass').value = '';
  setTimeout(()=>{
    const u = document.getElementById('loginUser');
    (u.value ? document.getElementById('loginPass') : u).focus();
  }, 60);
}

function hideLogin(){
  document.getElementById('loginBg').classList.remove('show');
  document.getElementById('loginErr').classList.remove('show');
}

function tampilkanUser(user){
  userSaatIni = user;
  // Sisa unit milik akun sebelumnya dibuang. Tanpa ini, kalau sesi habis lalu
  // orang lain masuk di halaman yang sama, layarnya masih memakai unit orang
  // yang tadi sampai data baru datang.
  unitAktif = '';
  unitSaya = [];
  document.getElementById('userChipNama').textContent =
    (user.nama || user.username) + ' · ' + T('peran_' + user.role);
  document.getElementById('userChip').style.display = '';
  terapkanPeran();
}

function bukaDaftar(){
  document.getElementById('loginBox').style.display = 'none';
  document.getElementById('daftarBox').style.display = '';
  document.getElementById('daftarErr').classList.remove('show','sukses');
  ['dfNama','dfUsername','dfPassword','dfPassword2'].forEach(id=>document.getElementById(id).value='');
}
function bukaLogin(){
  document.getElementById('daftarBox').style.display = 'none';
  document.getElementById('loginBox').style.display = '';
}

async function doDaftar(){
  const v = id => document.getElementById(id).value;
  const err = document.getElementById('daftarErr');
  const tampil = (pesan, sukses) => {
    err.textContent = pesan;
    err.classList.add('show');
    err.classList.toggle('sukses', !!sukses);
  };

  const nama = v('dfNama').trim(), username = v('dfUsername').trim().toLowerCase();
  const p1 = v('dfPassword'), p2 = v('dfPassword2');
  if(!nama){ tampil(T('namaKosong')); return; }
  if(!username){ tampil(T('usernameKosong')); return; }
  if(p1.length < 6){ tampil(T('passwordPendek')); return; }
  if(p1 !== p2){ tampil(T('passwordTakSama')); return; }

  const btn = document.getElementById('dfBtn');
  btn.disabled = true;
  try{
    const res = await fetch('/api/daftar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ nama, username, password: p1 })
    });
    const data = await res.json().catch(()=>({}));
    if(!res.ok){ tampil(data.error || T('daftarGagal')); return; }
    tampil(T('daftarBerhasil'), true);
    ['dfNama','dfUsername','dfPassword','dfPassword2'].forEach(id=>document.getElementById(id).value='');
  }catch(e){
    tampil(T('serverTakTerhubung'));
  }finally{ btn.disabled = false; }
}

async function doLogin(){
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;
  if(!username || !password){ showLogin('Username dan password harus diisi.'); return; }

  const btn = document.getElementById('loginBtn');
  btn.disabled = true; btn.textContent = 'Memeriksa...';
  try{
    let data;
    // Hanya bagian ini yang boleh berakhir di layar login: selama sesi belum
    // terbentuk, kegagalan memang soal kredensial atau sambungan.
    try{
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ username, password })
      });
      catatWaktuServer(res);
      data = await res.json().catch(()=>({}));
      if(!res.ok){ showLogin(data.error || 'Gagal masuk.'); return; }
    }catch(e){
      showLogin('Tidak dapat menghubungi server.');
      return;
    }

    // Sesi sudah jadi. Mulai dari sini kegagalan bukan lagi soal password, jadi
    // jangan dilempar balik ke layar login: dulu galat kecil saat menggambar
    // layar terbaca sebagai "tidak dapat menghubungi server", dan orang mengira
    // passwordnya yang salah padahal sudah benar.
    tampilkanUser(data.user);
    hideLogin();
    document.getElementById('loginPass').value = '';
    try{
      await init();
    }catch(e){
      console.error('init() gagal setelah login:', e);
      toast('Masuk berhasil, tetapi sebagian layar gagal dimuat: ' + (e.message || e));
    }
  }finally{
    btn.disabled = false; btn.textContent = 'Masuk';
  }
}

async function doLogout(){
  try{ await fetch('/api/logout', { method:'POST', credentials:'same-origin' }); }catch(e){}
  userSaatIni = null;

  /* Dibuka lewat pintu dashboard, Keluar mengantar ke layar masuk DASHBOARD,
     bukan ke layar masuk halaman ini.

     Sesinya cuma satu sejak kedua aplikasi satu asal, jadi menekan Keluar di
     sini juga mengeluarkan orang itu dari dashboard. Memuat ulang halaman ini
     akan menampilkan layar masuk E-Logbook — layar masuk kedua untuk sesi yang
     cuma satu. Yang mengisinya lalu kembali ke sini, sementara dashboard yang
     ia tinggalkan di belakang sudah kosong: dua pintu masuk untuk satu kunci,
     dan tidak ada yang menerangkan mana yang sedang berlaku.

     '/' bukan window.AVENGER_TAUTAN: begitu halaman ini berada di balik pintu,
     akar asal ini MEMANG dashboard. Memakai alamat dari variabel hanya
     menambah satu cara untuk salah — variabel yang menunjuk host lain akan
     melempar orang keluar dari asal yang baru saja disatukan.

     replace, bukan href: layar yang sudah keluar tidak pantas bisa didatangi
     lagi dengan tombol Back. */
  if(window.LEWAT_PINTU_AVENGER){ location.replace('/'); return; }

  // Dibuka langsung di alamat aplikasi ini: muat ulang, supaya tidak ada sisa
  // data di layar setelah keluar.
  location.reload();
}

document.addEventListener('keydown', e=>{
  if(e.key === 'Enter' && document.getElementById('loginBg').classList.contains('show')) doLogin();
});

/** Dipanggil saat halaman dibuka: cek apakah cookie sesi masih berlaku. */
async function mulai(){
  try{
    const res = await fetch('/api/me', { credentials:'same-origin' });
    catatWaktuServer(res);   // selaraskan jam sedini mungkin, bahkan sebelum login
    tickClock();
    if(res.ok){
      const data = await res.json();
      tampilkanUser(data.user);
      hideLogin();
      await init();
      return;
    }
  }catch(e){
    document.getElementById('syncBadge').innerHTML =
      '<span class="sync-dot" style="background:var(--fail);box-shadow:none;"></span> server tidak dapat dihubungi';
  }
  showLogin();
}
