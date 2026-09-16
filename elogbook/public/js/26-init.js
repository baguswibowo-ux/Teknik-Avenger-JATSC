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
  if(Number.isFinite(data.batasTautan) && data.batasTautan > 0) batasTautan = data.batasTautan;
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
  // dsList memuat DS Test + Maintenance Radio (satu tabel dstest). Tiap sub-tab
  // menyaring jenisnya sendiri: renderDsList() membuang catatan radio,
  // renderRadioList() hanya menampilkan yang radio.
  try{ dsList = (data.dstest||[]).map(mapDs); renderDsList(); if(typeof renderRadioList === 'function') renderRadioList(); if(typeof renderSemuaWkList === 'function') renderSemuaWkList(); if(typeof renderSemuaLlzList === 'function') renderSemuaLlzList(); if(typeof renderSemuaMrList === 'function') renderSemuaMrList(); if(typeof renderSemuaMlList === 'function') renderSemuaMlList(); if(typeof renderSemuaRkList === 'function') renderSemuaRkList(); }
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
    // Teknisi yang sedang jadi PH: tampilkan tombol kotak masuk (06-peran-lampiran.css).
    document.body.classList.toggle('sedang-ph', inboxTtd.some(it => it.atasNama));
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
  // Bagian ketiga opsional: ':isi' berarti jendela pengisiannya ikut dibuka,
  // bukan cuma tabnya. Dipakai cip kegiatan berkala dan tombol Kotak Masuk di
  // dashboard — dari sana orang memang berangkat untuk MENGISI, dan berhenti
  // di tab berarti masih harus mencari tombol Form Baru sendiri.
  // Bagian keempat opsional: LEMBAR mana di dalam tab itu. Satu tab sering
  // memuat banyak lembar, dan cara memilihnya berbeda-beda — lihat bukaLembar().
  const [tab, unit, mau, lembar] = isi.split(':');
  // Tanda hubung ikut diterima. Empat tab pekerjaan berkala bernama bk-neptuno
  // sampai bk-restart, dan pola yang cuma menerima huruf menolak keempatnya
  // tanpa suara: tautannya mendarat di halaman depan seolah tabnya tidak ada.
  if(!/^[a-z][a-z0-9-]*$/.test(tab || '')) return null;
  return {
    tab,
    unit: /^[a-z0-9_-]+$/.test(unit || '') ? unit : '',
    isi: mau === 'isi',
    // Angka boleh di depan: lembar Ground Check bernama 07l, 25r, dan
    // seterusnya. Pola yang mengharuskan huruf menolak keempatnya tanpa suara.
    lembar: /^[a-z0-9][a-z0-9-]*$/.test(lembar || '') ? lembar : ''
  };
}

/**
 * Tombol pemilih yang memanggil fungsinya dengan nama lembar ini sebagai
 * argumen — openMrModal('gp-07l'), setDcLkForm('sts'), pindahDcAmhsSub('AMHS').
 *
 * Argumennya dicocokkan UTUH, bukan sebagai potongan teks: 'sts' tidak boleh
 * ikut memilih lembar bernama 'sts-lama' kalau kelak ada. Dan tidak peka huruf
 * besar-kecil — lembar AMHS disebut 'amhs' di dashboard (itu nilai yang
 * tersimpan di kolom Form) tapi 'AMHS' di tombolnya.
 *
 * SATU NAMA BISA DIPAKAI BEBERAPA UNIT. 'jatsc' adalah gedung di Radtel dan
 * juga di Gedung & Keamanan; 'sts' adalah lembar Daily Check Listrik dan juga
 * lembar Pemeliharaan Listrik. Yang membedakan mana yang berlaku: hanya milik
 * unit yang sedang dibuka yang terlihat — 07-unit.js menyembunyikan nav unit
 * lain. Karena itu `tampak` ada, dan pemanggil yang mencari di seluruh
 * halaman wajib menyalakannya; mengambil yang pertama ketemu berarti mendarat
 * di tombol unit lain yang tidak akan pernah bisa ditekan.
 */
function tombolBertanda(akar, kelas, nama, tampak) {
  const cari = String(nama).toLowerCase();
  const daftar = [...akar.querySelectorAll(kelas)];
  return daftar.find(b => {
    if (tampak && b.offsetParent === null) return false;
    const cocok = /\(\s*'([^']*)'\s*\)/.exec(b.getAttribute('onclick') || '');
    return cocok && cocok[1].toLowerCase() === cari;
  }) || null;
}

/**
 * Buka tingkat-tingkat tab yang menyembunyikan sebuah elemen.
 *
 * Lembar Meter Reading dan Ground Check duduk di dalam tab bertingkat
 * (.lvl-panel), dan tombol di panel yang tidak aktif tidak bisa ditekan. Tiap
 * tingkat dibuka lewat tombolnya sendiri; urutannya tidak berpengaruh karena
 * satu .lvl-btn hanya menukar anak langsung tingkatnya.
 */
function bukaTingkat(el) {
  let panel = el.closest('.lvl-panel');
  while (panel) {
    if (!panel.classList.contains('active')) {
      const tombol = document.querySelector('.lvl-btn[data-target="' + panel.id + '"]');
      if (tombol) tombol.click();
    }
    panel = panel.parentElement ? panel.parentElement.closest('.lvl-panel') : null;
  }
}

/**
 * Buka jendela pengisian lembar yang ditunjuk tautan.
 *
 * Satu tab hampir selalu memuat banyak lembar, dan cara memilihnya ada dua —
 * keduanya dituju dari dashboard, jadi keduanya dilayani di sini:
 *
 *   TOMBOL SENDIRI-SENDIRI — lembar Preventive Maintenance. Tiap lembar punya
 *   "+ Form Baru" sendiri lengkap dengan argumennya di markup, kadang terkubur
 *   di tab bertingkat. Tombolnya dicari langsung, tingkatnya dibuka, ditekan.
 *
 *   PEMILIH DI DALAM FORM — Daily Check tiap unit. Tombolnya cuma satu, dan
 *   lembarnya dipilih sesudah jendelanya terbuka lewat sub-tab di dalam form:
 *   gedung untuk Radtel dan Gedung & Keamanan, nama lembar untuk Listrik &
 *   Mekanik, sistem untuk AMHS. Dipilih SESUDAH formnya terbuka, bukan
 *   sebelum — "+ Form Baru" memanggil reset yang menimpa apa pun yang
 *   disetel duluan.
 *
 * Keduanya menekan TOMBOLNYA, bukan memanggil fungsinya. Tombol itu yang tahu
 * nilai apa yang dikirimnya, jadi lembar baru di E-Logbook ikut jalan tanpa
 * berkas ini disentuh — tidak ada daftar kedua yang harus dijaga sinkron.
 *
 * Yang tersembunyi tidak ditekan. Peran yang cuma boleh membaca memang tidak
 * dipasangi "+ Form Baru", dan pemilih yang disembunyikan untuk unit ini
 * bukan milik unit ini.
 *
 * Nama lembar yang tidak dikenali jatuh ke tombol pertama panel itu — lembar
 * pertama tab yang benar masih jauh lebih dekat ke tujuan daripada tidak
 * terjadi apa-apa.
 */
function bukaLembar(panel, nama) {
  if (!panel) return;
  const tepat = nama ? tombolBertanda(panel, '.btn-tambah', nama) : null;
  const btn = tepat || panel.querySelector('.btn-tambah[onclick^="open"]');
  if (!btn) return;
  if (tepat) bukaTingkat(tepat);
  if (btn.offsetParent === null) return;
  // Sesudah tabnya benar-benar tergambar: papan tanda tangan di dalam jendela
  // diukur ulang saat terbuka, dan kanvas selebar 0 tidak bisa digambari.
  setTimeout(() => {
    btn.click();
    if (nama && !tepat) setTimeout(() => pilihLembarDiForm(nama), 60);
  }, 80);
}

/** Sub-tab pemilih lembar di dalam jendela form yang baru terbuka. Dicari di
    seluruh halaman, jadi wajib menyaring yang terlihat — lihat tombolBertanda. */
function pilihLembarDiForm(nama) {
  const tombol = tombolBertanda(document, '.subtab-btn', nama, true);
  if (tombol) tombol.click();
}

function bukaTabDariTautan(){
  const tuju = tautanMasuk();
  if(!tuju || !tuju.tab) return;
  const btn = document.querySelector(`.tab-btn[data-tab="${tuju.tab}"]`);
  // Tab yang tidak ada, atau yang disembunyikan karena unit ini memang tidak
  // punya formulirnya, dibiarkan saja — halaman tetap terbuka di tab biasanya,
  // dan itu lebih baik daripada memaksa masuk ke bagian yang kosong.
  if(btn){
    if(btn.style.display === 'none') return;
    btn.click();
    if(tuju.isi) bukaLembar(document.getElementById('view-' + tuju.tab), tuju.lembar);
    return;
  }
  /* Nama SUB-TAB (dstest, radio, bk-neptuno, wk-ckg3, gcheck, meter, ml-sts, …):
     tautan dari kegiatan berkala dashboard menyebut lembar, bukan tab utama.
     Tab induknya (.view yang mewadahinya) dibuka dulu, baru sub-tabnya —
     dengan syarat yang sama: keduanya tidak sedang disembunyikan untuk unit ini. */
  const sub = document.querySelector(`.subtab-btn[data-subtab="${tuju.tab}"]`);
  if(!sub || sub.style.display === 'none') return;
  const wadah = sub.closest('.view');
  const induk = wadah && document.querySelector(`.tab-btn[data-tab="${wadah.id.replace(/^view-/, '')}"]`);
  if(!induk || induk.style.display === 'none') return;
  induk.click();
  sub.click();
  // Panelnya sub-view, bukan tab induknya: satu tab bisa memuat belasan
  // lembar, dan yang dicari tombol milik lembar yang ditunjuk tautannya.
  if(tuju.isi) bukaLembar(document.getElementById('view-' + tuju.tab), tuju.lembar);
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

  /* Disajikan lewat pintu dashboard (/logbook/) berarti dashboardnya ada di
     ASAL YANG SAMA — halaman ini memang halaman dashboard yang diteruskan, jadi
     akar asal ini sudah menunjuk dashboard. Berlaku di produksi satu-deploy
     (E-Logbook jadi komponen internal) maupun dua-proyek lama: saat lewat pintu,
     peramban selalu di domain dashboard. Ini yang membuat tombol pulang muncul
     di Vercel tanpa perlu AVENGER_TAUTAN. */
  if(window.LEWAT_PINTU_AVENGER) return location.origin + '/';

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
