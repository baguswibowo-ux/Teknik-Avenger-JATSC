/* E-Logbook · js/26-init.js — Pemuatan awal: ambil data server lalu render tiap bagian
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh. */

/* ============== INIT ============== */
async function init(){
  initAllSigPads();
  pasangTombolTtdTersimpan();
  initDcState();
  setDcTanggal();
  renderDcTable();
  if(teknisiRows.length === 0) addTeknisi();
  document.getElementById('syncBadge').innerHTML = '<span class="sync-dot"></span> memuat data dari server...';
  let data;
  try{
    // Sengaja TIDAK memakai unitAktif sebagai cadangan: nilainya bertahan di
    // halaman yang sama walau yang masuk sudah orang lain. Yang menentukan
    // hanya ingatan milik akun ini — dan pindahUnit() sudah menuliskannya
    // sebelum memanggil init() lagi.
    // Unit dari tanda pagar didahulukan, dan hanya untuk kunjungan ini — lihat
    // catatan di bukaTabDariTautan(). Tidak ditulis ke ingatan akun: tautan
    // dari dashboard tidak boleh diam-diam memindahkan unit kerja orangnya.
    const tuju = tautanMasuk();
    data = await gsRun('getAllData', (tuju && tuju.unit) || unitTersimpan());
  }catch(e){
    document.getElementById('syncBadge').innerHTML =
      '<span class="sync-dot" style="background:var(--fail);box-shadow:none;"></span> gagal memuat — ' +
      '<a href="#" onclick="init();return false;" style="color:var(--accent);">muat ulang</a>';
    document.getElementById('entryList').innerHTML =
      '<div class="empty">Gagal memuat data.<br><span style="font-size:11px;color:var(--fail);">'+escapeHtml(String(e&&e.message||e))+'</span><br><br>' +
      '<button class="btn" onclick="init()">Coba muat ulang</button></div>';
    return;
  }
  unitAktif = data.unit || unitAktif;
  unitSaya = data.unitSaya || [];
  // Tanda tangan tersimpan milik akun ini. Baru diketahui sekarang, jadi tombol
  // "pakai TTD tersimpan" di tiap papan baru muncul di sini — bukan di atas.
  // Server sekarang mengirim struktur { slots, aktif, maks }; peramban lama yang
  // menerima string polos ditangani lewat setTtdTersimpanSaya di dalam setter.
  if(data.ttdTersimpan && typeof data.ttdTersimpan === 'object' && Array.isArray(data.ttdTersimpan.slots)){
    setTtdTersimpan(data.ttdTersimpan);
  } else {
    setTtdTersimpanSaya(data.ttdTersimpan);
  }
  renderPemilihUnit();
  terapkanUnit();
  // Daftar gedung datang dari server; isi pemilihnya sebelum daftar catatan
  // digambar, supaya bilah cetak langsung lengkap.
  if(Array.isArray(data.lokasi) && data.lokasi.length) lokasiPilihan = data.lokasi;
  isiPilihanLokasi();
  // render tiap bagian terpisah — kalau satu error, yang lain tetap tampil
  try{ entries = (data.entries||[]).map(mapEntry); renderEntries(); }
  catch(e){ document.getElementById('entryList').innerHTML = '<div class="empty">Logbook gagal ditampilkan: '+escapeHtml(String(e.message||e))+'</div>'; }
  try{ dcHistory = (data.dcHistory||[]).map(mapDc); renderDcHistory(); }
  catch(e){ document.getElementById('dcHistory').innerHTML = '<div class="empty">Riwayat daily check gagal ditampilkan: '+escapeHtml(String(e.message||e))+'</div>'; }
  try{ issues = (data.issues||[]).map(mapIssue); renderIssues(); }
  catch(e){ document.getElementById('issuesBody').innerHTML = '<tr><td colspan="10">Isu gagal ditampilkan: '+escapeHtml(String(e.message||e))+'</td></tr>'; }
  // Daftar akun hanya dikirim server kalau yang login administrator.
  try{ monitoring = (data.monitoring||[]).map(mapMon); renderMonList(); }
  catch(e){ document.getElementById('monList').innerHTML = '<div class="empty">Monitoring gagal ditampilkan: '+escapeHtml(String(e.message||e))+'</div>'; }
  try{ ltkList = (data.ltk||[]).map(mapLtk); renderLtkList(); }
  catch(e){ document.getElementById('ltkList').innerHTML = '<div class="empty">LTK gagal ditampilkan: '+escapeHtml(String(e.message||e))+'</div>'; }
  try{ bapbList = (data.bapb||[]).map(mapBapb); renderBapbList(); }
  catch(e){ document.getElementById('bapbList').innerHTML = '<div class="empty">BAPB gagal ditampilkan: '+escapeHtml(String(e.message||e))+'</div>'; }
  // Katalog site/kategori DS lama masih diterima — dipakai renderer catatan
  // lama (dsTabelLamaBaca). Form baru pakai sampling 9 sesi dari DS_PLAN,
  // jadi tidak ada pilihan kategori lagi yang perlu diisi ulang di sini.
  dsSiteSemua = data.dsSite || dsSiteSemua;
  dsKategoriUrut = (data.kategoriDs && data.kategoriDs.length) ? data.kategoriDs : dsKategoriUrut;
  try{ dsList = (data.dstest||[]).map(mapDs); renderDsList(); }
  catch(e){ document.getElementById('dsList').innerHTML = '<div class="empty">DS Test gagal ditampilkan: '+escapeHtml(String(e.message||e))+'</div>'; }
  berkalaItemSemua = data.berkalaItem || berkalaItemSemua;
  berkalaJenisUrut = (data.jenisBerkala && data.jenisBerkala.length) ? data.jenisBerkala : berkalaJenisUrut;
  isiPilihanJenisBerkala();
  try{ berkalaList = (data.berkala||[]).map(mapBerkala); renderBerkalaList(); }
  catch(e){
    // Empat daftar, empat wadah — satu pesan galat di masing-masing.
    berkalaJenisUrut.forEach(j=>{
      const el = document.getElementById(bkListId(j));
      if(el) el.innerHTML = '<div class="empty">Pekerjaan berkala gagal ditampilkan: '+escapeHtml(String(e.message||e))+'</div>';
    });
  }
  // Daftar akun tetap diambil — beberapa bagian lain membacanya — tapi tidak
  // lagi digambar di sini: tab Kelola Akun sudah pindah ke Dashboard Fasilitas
  // Teknik (port 3100). Server tetap yang memutuskan siapa yang boleh melihat
  // daftar ini; untuk peran selain administrator isinya memang kosong.
  users = data.users || [];
  try{
    pejabatList = data.pejabatList || [];
    isiPilihanPejabat();
    // Daftar akun yang boleh masuk ke unit yang sedang dibuka — saran nama pada
    // baris teknisi kedua dst. Baris pertama tetap otomatis nama pengisi.
    teknisiUnitList = data.teknisiUnitList || [];
    isiPilihanTeknisiUnit();
    inboxTtd = data.inboxTtd || [];
    renderInboxBadge();
  }catch(e){ /* kotak masuk TTD sekadar kemudahan — kegagalannya tidak boleh menghentikan pemuatan */ }
  // Rekap diminta terpisah ke server; yang tersimpan milik unit sebelumnya.
  try{ lupakanRekap(); }catch(e){ /* tab rekap belum pernah dibuka */ }
  document.getElementById('syncBadge').innerHTML = '<span class="sync-dot"></span> ' + T('tersambung');
  bukaTabDariTautan();
}

/* ============== TAUTAN MASUK DARI LUAR ==============
 *
 * Dashboard Fasilitas Teknik menautkan pekerjaan berkala langsung ke formulir
 * yang mengerjakannya — "Pengecekan DS" di sana membuka tab DS Test di sini.
 * Sebelum ini tautannya cuma bisa sampai ke halaman depan, dan sisanya urusan
 * orangnya: pilih unit, cari tab, baru mulai.
 *
 * Bentuknya  #<tab>  atau  #<tab>:<unit>
 * Contohnya  #dstest:radtel  dan  #bk-neptuno:radtel
 *
 * Unit ikut disebut karena beberapa tab hanya ada pada unit yang memang punya
 * formulirnya — tanpa itu tautannya mendarat di unit terakhir yang dibuka
 * orangnya, yang belum tentu unit yang dimaksud.
 *
 * Unit dari tautan TIDAK disimpan sebagai ingatan akun ini. Tautan itu satu
 * kunjungan, bukan pindah rumah: setelah halaman ini dimuat ulang tanpa tanda
 * pagar, yang kembali unit yang biasa dipakai orangnya. Yang memutuskan boleh
 * atau tidaknya tetap server — kode unit yang bukan miliknya dijawab dengan
 * unit yang memang boleh.
 */
function tautanMasuk(){
  const isi = String(location.hash || '').replace(/^#/, '').trim();
  if(!isi) return null;
  const [tab, unit] = isi.split(':');
  // Tanda hubung ikut diterima. Empat tab pekerjaan berkala bernama bk-neptuno
  // sampai bk-restart, dan pola yang cuma menerima huruf menolak keempatnya
  // tanpa suara: tautannya mendarat di halaman depan seolah tabnya tidak ada.
  if(!/^[a-z][a-z0-9-]*$/.test(tab || '')) return null;
  return { tab, unit: /^[a-z0-9_-]+$/.test(unit || '') ? unit : '' };
}

function bukaTabDariTautan(){
  const tuju = tautanMasuk();
  if(!tuju || !tuju.tab) return;
  const btn = document.querySelector(`.tab-btn[data-tab="${tuju.tab}"]`);
  // Tab yang tidak ada, atau yang disembunyikan karena unit ini memang tidak
  // punya formulirnya, dibiarkan saja — halaman tetap terbuka di tab biasanya,
  // dan itu lebih baik daripada memaksa masuk ke bagian yang kosong.
  if(!btn || btn.style.display === 'none') return;
  btn.click();
}
/**
 * Alamat Dashboard Fasilitas Teknik, untuk tombol pulang di kepala halaman.
 *
 * Dirangkai dari hostname yang sedang dipakai, bukan ditanam sebagai
 * 127.0.0.1: begitu halaman ini dibuka dari komputer lain di jaringan,
 * 127.0.0.1 di sana adalah komputer itu sendiri. Dashboard merangkai
 * alamat ke sini dengan cara yang persis sama.
 *
 * AVENGER_TAUTAN dipakai kalau dashboardnya memang tidak di port sebelah —
 * misalnya sudah dipasang di belakang nama domain sendiri.
 */
function alamatDashboard(){
  const disetel = (typeof window.AVENGER_TAUTAN === 'string' && window.AVENGER_TAUTAN)
    ? window.AVENGER_TAUTAN : '';
  if(disetel) return disetel;

  /* Tanpa AVENGER_TAUTAN, satu-satunya tebakan yang masuk akal adalah port
     sebelah di komputer yang sama. Itu benar di kantor dan PASTI salah di
     layanan seperti Vercel, yang tidak punya port 3100 sama sekali — tombolnya
     lalu menggantung tanpa pesan apa pun, dan pemakai terjebak di sini.

     Jadi tebakan itu hanya dipakai kalau halaman ini memang sedang disajikan
     dari alamat berport atau alamat lokal. Kalau tidak, jawabannya kosong dan
     yang memanggil memilih menyembunyikan tautannya: tidak ada tombol lebih
     jujur daripada tombol yang dipencet lalu diam. */
  const lokal = !!location.port
    || location.hostname === 'localhost'
    || /^127\.|^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(location.hostname);

  return lokal ? `${location.protocol}//${location.hostname}:3100` : '';
}

/* Dipakai dua tempat, dan itu sebabnya alamatnya dipisah ke fungsi di atas:
   tombol pulang di kepala halaman (di sini) dan tautan di panel pintu tertutup
   (js/25-login.js). Satu jawaban untuk satu pertanyaan. */
function pasangTautanDashboard(){
  const a = document.getElementById('tautanDashboard');
  if(!a) return;

  const alamat = alamatDashboard();
  if(alamat){ a.href = alamat; return; }

  a.hidden = true;
  console.warn('[dashboard] AVENGER_TAUTAN belum diisi, jadi tombol pulang disembunyikan '
             + 'daripada menunjuk port 3100 yang tidak ada di alamat ini.');
}

window.addEventListener('load', ()=>{ terapkanBahasa(); pasangTautanDashboard(); mulai(); });
