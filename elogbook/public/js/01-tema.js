/* E-Logbook · js/01-tema.js — Mode gelap/terang dan penyimpanan pilihannya
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh. */

/* ============== TEMA GELAP / TERANG ==============
   Bawaannya TERANG untuk semua orang (permintaan Bagus, Okt 2026). Pilihan
   gelap/terang disimpan PER AKUN di perangkat itu, dengan kunci yang sama
   dengan dashboard (kunciTema di public/js/09-bahasa.js) — memilih gelap di
   salah satunya berlaku di keduanya, dan komputer yang dipakai bergantian
   tidak membawa pilihan orang sebelumnya. Kunci lama 'elogbook_tema' (satu
   untuk seluruh perangkat) tidak dibaca lagi. */

const kunciTemaAkun = (username) => 'avenger.tema:' + String(username || '').trim().toLowerCase();
/** Username akun yang sedang masuk, atau '' — userSaatIni baru lahir di
    25-login.js, jadi sebelum itu jawabannya kosong (tema terang). */
function userTema(){
  return (typeof userSaatIni !== 'undefined' && userSaatIni && userSaatIni.username) || '';
}

function temaTersimpan(){
  const u = userTema();
  if(!u) return 'terang';
  try{ return localStorage.getItem(kunciTemaAkun(u)) === 'gelap' ? 'gelap' : 'terang'; }
  catch(e){ return 'terang'; }
}

function terapkanTema(tema){
  document.documentElement.setAttribute('data-tema', tema);
  /* Tinggal satu tombol. Yang kedua dulu berdiri di layar masuk milik aplikasi
     ini, dan layar itu sudah dibuang — masuknya lewat dashboard, dan tema di
     sana punya tombolnya sendiri. Tetap dijaga dengan if: terapkanTema()
     dipanggil juga sebelum kepala halaman selesai digambar. */
  const b = document.getElementById('tombolTema');
  if(b){
    b.textContent = tema === 'terang' ? '☀' : '🌙';
    b.title = tema === 'terang' ? T('temaKeGelap') : T('temaKeTerang');
  }
  // Warna bilah alamat di HP ikut menyesuaikan.
  const meta = document.getElementById('metaTema');
  if(meta) meta.setAttribute('content', tema === 'terang' ? '#eef2f6' : '#0a0e13');
}

function gantiTema(){
  const baru = document.documentElement.getAttribute('data-tema') === 'terang' ? 'gelap' : 'terang';
  const u = userTema();
  if(u){ try{ localStorage.setItem(kunciTemaAkun(u), baru); }catch(e){ /* seumur tab saja */ } }
  terapkanTema(baru);
}
