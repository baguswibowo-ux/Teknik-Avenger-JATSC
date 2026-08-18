/* =======================================================================
   JAM DAN NAVIGASI
   ======================================================================= */
function jalanJam(){
  const n = new Date(), p = (x)=>String(x).padStart(2,'0');
  el('jamUtc').textContent = p(n.getUTCHours())+':'+p(n.getUTCMinutes())+':'+p(n.getUTCSeconds());
  const w = new Date(n.getTime() + (7*60 + n.getTimezoneOffset())*60000);
  el('jamWib').textContent = p(w.getHours())+':'+p(w.getMinutes())+':'+p(w.getSeconds());
  el('tglWib').textContent = w.toLocaleDateString(LOKAL(),{weekday:'short',day:'numeric',month:'short'});
}
setInterval(jalanJam, 1000); jalanJam();


function pindahLayar(nama){
  document.querySelectorAll('.layar').forEach(s=>s.classList.toggle('aktif', s.id === 'l'+'-'+nama));
  document.querySelectorAll('#rel button').forEach(b=>b.classList.toggle('aktif', b.dataset.layar === nama));
  // Cincin baru bisa diukur setelah berandanya benar-benar tampil.
  if(nama === 'beranda') aturCincin();
  // Log yang ditampilkan basi tidak menjawab pertanyaan "barusan siapa", jadi
  // diambil ulang tiap kali layarnya dibuka — bukan sekali saat masuk.
  if(nama === 'aktivitas') aktSegarkan();
  // Isinya bergantung pada tanggal hari ini. Halaman yang dibiarkan terbuka
  // semalaman akan menampilkan "hari ini" untuk kemarin kalau tidak digambar
  // ulang saat layarnya dibuka.
  if(nama === 'kotak') gambarKotakMasuk();
  // Yang unitnya cuma satu tidak perlu disuruh memilih dari daftar berisi satu
  // nama. Layar dibuka langsung pada unitnya. pindahLayar() tidak dipanggil
  // ulang dari sini — layarnya sudah yang ini.
  if(nama === 'unit' && !unitDibuka){
    const boleh = unitBoleh();
    if(boleh.length === 1){
      unitDibuka = boleh[0].kode; subtabAktif = 'peralatan';
      alatDipilih = (PERALATAN[unitDibuka] || [])[0]?.id || null;
      gambarPilihUnit(); gambarUnit();
    }
  }
  window.scrollTo({top:0,behavior:'smooth'});
  simpanSesi();     // menyegarkan halaman kembali ke layar yang sedang dibuka
}
el('rel').addEventListener('click', e=>{
  const b = e.target.closest('button'); if(b) pindahLayar(b.dataset.layar);
});
/**
 * Letakkan panel lonceng tepat di bawah tombolnya.
 *
 * Panelnya position:fixed di akar dokumen — bukan anak tombolnya — jadi
 * letaknya tidak datang sendiri dan harus dihitung: tepi kanannya diluruskan
 * dengan tepi kanan tombol, lalu ditahan supaya tidak keluar layar di kiri
 * maupun di kanan pada layar sempit.
 */
function loncengLetakkan(){
  const panel = el('lonceng'), tombol = el('tombolLonceng');
  if(!panel || !tombol) return;
  const t = tombol.getBoundingClientRect();
  const lebar = panel.offsetWidth || 340;
  const tepi = 10;
  const kiri = Math.max(tepi, Math.min(t.right - lebar, window.innerWidth - lebar - tepi));
  panel.style.left = kiri + 'px';
  panel.style.top  = (t.bottom + 9) + 'px';
}

function loncengTutup(){
  el('lonceng').classList.remove('buka');
  el('tombolLonceng').setAttribute('aria-expanded','false');
}

el('tombolLonceng').addEventListener('click', e=>{
  e.stopPropagation();
  const panel = el('lonceng');
  const buka = !panel.classList.contains('buka');
  // Dihitung ulang tiap kali dibuka, bukan sekali saat halaman lahir: yang
  // berdinas berganti tiap pagi, dan tab ini sering dibiarkan terbuka semalaman.
  if(buka) gambarLonceng();
  panel.classList.toggle('buka', buka);
  el('tombolLonceng').setAttribute('aria-expanded', String(buka));
  if(buka) loncengLetakkan();
});
document.addEventListener('click', e=>{
  const panel = el('lonceng');
  // Klik DI DALAM panelnya bukan klik di luar — sejak panelnya pindah keluar
  // dari bungkus tombol, keduanya harus disebut satu per satu.
  if(panel.classList.contains('buka')
     && !e.target.closest('.lonceng-bungkus') && !e.target.closest('.lonceng')){
    loncengTutup();
  }
});
document.addEventListener('keydown', e=>{
  if(e.key === 'Escape') loncengTutup();
});
/* Kepala halaman ikut bergulir, jadi panel yang berlabuh pada tombolnya harus
   ikut bergerak. Digulir jauh sampai tombolnya hilang dari layar: panelnya
   ditutup, karena panel yang menggantung tanpa asal-usul lebih membingungkan
   daripada panel yang hilang. */
['scroll','resize'].forEach(n=>window.addEventListener(n, ()=>{
  const panel = el('lonceng');
  if(!panel.classList.contains('buka')) return;
  const t = el('tombolLonceng').getBoundingClientRect();
  if(t.bottom < 0) loncengTutup(); else loncengLetakkan();
}, { passive:true }));

el('tombolTema').addEventListener('click', ()=>{
  const h = document.documentElement;
  h.dataset.tema = h.dataset.tema === 'terang' ? 'gelap' : 'terang';
});

el('tombolBahasa').addEventListener('click', ()=>{
  BHS = BHS === 'en' ? 'id' : 'en';
  try{ localStorage.setItem('avenger.bahasa', BHS); }catch(e){ /* seumur tab saja */ }
  terapkanBahasa();
  jalanJam();      // nama hari dan bulan di kepala ikut bahasanya, tanpa menunggu detik berikutnya
  // Teks yang dirangkai JS tidak ikut tersentuh terapkanBahasa(), jadi seluruh
  // isi dashboard digambar ulang. Hanya kalau ada yang sedang masuk: gambarSemua()
  // membaca akun, dan sebelum ada yang masuk isinya memang belum pernah digambar.
  if(akun) gambarSemua();
  // Kedua tombol jeda menyimpan keadaannya di kelas, bukan di teksnya.
  el('btnJeda').textContent = el('orbit').classList.contains('jeda')
    ? T('Jalankan putaran','Resume rotation') : T('Jeda putaran','Pause rotation');
  document.querySelectorAll('[data-jeda]').forEach(b=>{
    b.textContent = el(b.dataset.jeda).classList.contains('jeda')
      ? T('Jalankan','Resume') : T('Jeda','Pause');
  });
});

el('btnJeda').addEventListener('click', ()=>{
  const o = el('orbit'); o.classList.toggle('jeda');
  el('btnJeda').textContent = o.classList.contains('jeda')
    ? T('Jalankan putaran','Resume rotation') : T('Jeda putaran','Pause rotation');
});

