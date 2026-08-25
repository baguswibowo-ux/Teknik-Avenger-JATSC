/* E-Logbook · js/01-tema.js — Mode gelap/terang dan penyimpanan pilihannya
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh. */

/* ============== TEMA GELAP / TERANG ==============
   Pilihannya disimpan di perangkat masing-masing. Kalau belum pernah dipilih,
   ikut setelan sistem operasi — jadi HP yang sudah mode gelap langsung gelap. */

const KUNCI_TEMA = 'elogbook_tema';

/* Bawaannya gelap. Layar logbook dipakai di ruangan remang saat dinas malam,
   dan mode terang menyilaukan di sana. Yang sudah memilih sendiri tetap
   dihormati pilihannya. */
function temaTersimpan(){
  const t = localStorage.getItem(KUNCI_TEMA);
  if(t === 'terang' || t === 'gelap') return t;
  return 'gelap';
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
  localStorage.setItem(KUNCI_TEMA, baru);
  terapkanTema(baru);
}
