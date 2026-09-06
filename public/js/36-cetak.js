/* =======================================================================
   CETAK — lembar Sparepart, Peralatan, dan Jadwal Dinas untuk kertas

   Tiga tab di Database Unit sekarang punya tombol Cetak. Yang keluar
   dari sini bukan tangkapan layar bertema gelap, melainkan lembar
   hitam-putih A4 dengan kop unit dan dua kolom tanda tangan di kaki:
   Dibuat oleh (pengisi dashboard sekarang) dan Mengetahui (Manajer
   Teknik bidang itu).

   TTD SIAPA yang dipakai
   ----------------------
   Sumbernya E-Logbook — akun yang sama punya slot TTD tersimpan di
   sana, dan dashboard cuma memintanya lewat getTtdMilik. Yang aktif
   itu yang dipasang; kalau pemiliknya sudah mengganti pilihannya,
   yang tercetak ikut berganti tanpa dashboard perlu tahu apa-apa.

   Kalau pejabatnya BELUM PERNAH menyimpan TTD di E-Logbook, akun
   admin atau super-admin boleh membubuhkannya dari sini. Endpoint
   simpanTtdMilik di E-Logbook menaruhnya di slot 0 pejabat itu,
   pejabatnya sendiri tetap bisa mengubahnya nanti — jalur ini bukan
   pintu penulisan tetap, cuma penambal supaya lembar hari ini bisa
   keluar dengan tanda tangannya.

   Mengapa pejabat, dan bukan sembarang orang
   ------------------------------------------
   simpanTtdMilik menolak target selain berperan pejabat, sengaja.
   Teknisi punya jalannya sendiri di E-Logbook (satu slot per akun),
   admin lain punya slot multi. Yang tersisa cuma pejabat — pengesah
   yang jarang membuka E-Logbook sendiri tetapi sering dibutuhkan
   tanda tangannya di kertas.

   Warna goresan
   -------------
   TTD tersimpan sering digambar putih di kanvas gelap. Sebelum
   dipasang ke lembar cetak, tiap piksel bergaris dibalik jadi hitam
   (lihat ttdKeHitam) supaya terbaca di kertas putih. Cara yang sama
   dipakai E-Logbook di 21-cetak-dasar.js.
   ======================================================================= */

/* ---------- Keadaan ringan yang dipakai satu kali sesi cetak ---------- */
const CETAK = {
  mode:   null,     // 'sparepart' | 'peralatan' | 'dinas'
  unit:   null,
  // Grup lokasi peralatan yang sedang jadi tab aktif di layar Peralatan.
  // Diambil dari grupDipilih waktu cetakBuka() dipanggil, dan dibekukan di
  // sini supaya lembar yang dikirim ke pejabat tetap berisi peralatan yang
  // sama walau di layar admin pindah tab. '' = semua peralatan unit.
  grup:   '',
  /* Ragam cetakan Jadwal Dinas: 'teknik' (bawaan; seluruh kode apa adanya
     — PSJ, PSN, MJ, MN, SPKL*, CUTI, CAP, IJIN, DL) atau 'pum' (hanya PS/M/P/S
     yang tampil, sisanya dikosongkan). Dua tombol terpisah di baris pengatur
     Jadwal Dinas menentukan nilainya waktu tombolnya ditekan. */
  formatDinas: 'teknik',
  pejabat: [],      // hasil listPejabatUnit — [{username,nama}]
  picSaran: [],     // hasil /pic-cetak-dinas/:unit — irisan akun terdaftar di unit
                    // ini dan ditunjuk di hak modul `dinas` (Jadwal Dinas); jadi
                    // saran dropdown PIC 1/PIC 2 di modal Jadwal Dinas
  pejabatDipilih: null,   // username yang dipilih di dropdown
  ttdPejabat: null,       // { ada, nama, path, ... } untuk yang terpilih
  ttdSaya:    null,       // idem untuk pengguna dashboard sekarang
  /* Deputy Manager Teknik — pihak "Mengetahui" untuk Jadwal Dinas. Dipilih
     oleh pengirim di modal cetak (lihat tugas 3c). Sampai #3d aktif, kotak
     TTD-nya bertuliskan "Menunggu TTD" di lembar cetak. */
  deputyDipilih: null,
  ttdDeputy:  null,
  /* Isian footer Jadwal Dinas — diisi PIC (pembuat) di modal kirim.
     picNama1/picNama2  = dua PIC unit yang tercantum di kepala footer.
     tanggalCetak       = tanggal "Tangerang, __ Agustus 2026" di atas kanan;
                          bawaannya hari ini, boleh disunting. */
  picNama1: '',
  picNama2: '',
  tanggalCetak: '',
  kanvas:     { el:null, ctx:null, ada:false },  // kanvas TTD pejabat
  kanvasSaya: { el:null, ctx:null, ada:false },  // kanvas TTD saya (kalau saya belum punya)
  /* Kalau pejabat belum punya TTD, jalur utamanya SERAHKAN ke akun
     pejabat — TTD tersimpan dipakai kalau ada, kalau belum ada pejabat
     yang membuatnya sendiri (di E-Logbook TTD Saya atau di modal cetak
     dashboard, jalur "diri sendiri"). Menggambarkan atas nama pejabat
     tetap ada sebagai pilihan cadangan untuk admin/super-admin, tapi
     bukan bawaan. */
  serahkanKePejabat: true
};

const CETAK_JUDUL = {
  sparepart: () => T('Daftar Sparepart',      'Spare Parts List'),
  peralatan: () => T('Daftar Peralatan',      'Equipment List'),
  dinas:     () => T('Jadwal Dinas Bulanan',  'Monthly Duty Roster')
};

/* Peran yang boleh membubuhkan TTD atas nama pejabat lain. Sepadan
   dengan pemeriksaan di server E-Logbook (simpanTtdMilik) — kalau
   keduanya berselisih, yang menahan tetap server, dan tombol yang
   tampil di sini cuma jatuh dengan 403. */
const bolehBubuhkanTtdOrang = () =>
  !!akun && (akun.role === 'admin' || akun.superadmin);

/* Peran yang boleh mencetak LANGSUNG tanpa antrian pejabat. Hanya
   pengesah (pejabat) yang termasuk — merekalah yang membubuhkan TTD
   di lembar final. Peran lain — termasuk admin dan super-admin —
   wajib mengirim lewat antrian ke pejabat supaya lembar final tetap
   ditandatangani pengesah, bukan pembuatnya. */
const bolehCetakLangsung = () =>
  !!akun && akun.role === 'pejabat';

/* ---------- Titik masuk: dipanggil tombol Cetak di ketiga tab ---------- */
async function cetakBuka(mode, unit, opts){
  if(!akun){ pesan(T('Masuk dulu untuk mencetak.','Sign in first to print.')); return; }
  CETAK.mode = mode;
  CETAK.unit = unit || unitDibuka;
  // Cetak peralatan mengikuti tab grup yang sedang menyala di layar. Jenis
  // cetak lain (sparepart, dinas) tidak punya tab grup — grupnya dikosongkan.
  CETAK.grup = (mode === 'peralatan') ? (typeof grupDipilih === 'string' ? grupDipilih : '') : '';
  /* Ragam cetakan Jadwal Dinas — dibawa lewat opts.formatDinas dari tombol
     Cetak PUM / Cetak Teknik. Mode non-dinas tetap set ke 'teknik' sebagai
     bawaan yang aman (tidak dipakai, tapi tidak boleh undefined). */
  CETAK.formatDinas = (mode === 'dinas' && opts && opts.formatDinas === 'pum') ? 'pum' : 'teknik';
  CETAK.pejabatDipilih = null;
  CETAK.ttdPejabat = null;
  CETAK.ttdSaya = null;
  CETAK.deputyDipilih = null;
  CETAK.ttdDeputy = null;
  CETAK.kanvas = { el:null, ctx:null, ada:false };
  CETAK.kanvasSaya = { el:null, ctx:null, ada:false };
  CETAK.serahkanKePejabat = true;   // bawaan: TTD pejabat diserahkan ke akun mereka
  /* PIC & tanggal — reset tiap buka modal. Tanggal default hari ini
     (YYYY-MM-DD). PIC boleh kosong; kalau tetap kosong, footer menampilkan
     "—" untuk PIC-nya. */
  CETAK.picNama1 = '';
  CETAK.picNama2 = '';
  CETAK.picSaran = [];
  CETAK.pejabatTanpaHak = false;
  CETAK.tanggalCetak = new Date().toISOString().slice(0, 10);

  /* Kartu digambar dulu dengan status "memuat" supaya orangnya lihat
     ada yang bergerak; daftar pejabat dan TTD-nya menyusul lewat
     panggilan async di bawah. Peralatan sekarang ikut jalur ini —
     lembar Sejarah Peralatan perlu disetujui oleh Kepala/Manajer
     (sesuai form fisiknya), jadi jalur "langsung cetak" yang dulu
     ada dilepas: hanya pejabat yang boleh mengeluarkan lembar akhir.  */
  cetakKartuGambar();
  el('lapisCetak').classList.add('buka');

  try{
    const [pejabat, ttdSaya, hakCetak, teknisiUnit] = await Promise.all([
      /* Galat listPejabatUnit tidak dibungkam — cukup diubah jadi larik
         kosong supaya UI tetap hidup, tapi tetap ke console.warn supaya
         jelas kalau endpointnya belum terpasang (E-Logbook belum di-restart). */
      srvApi('listPejabatUnit', CETAK.unit).catch(e=>{
        console.warn('[cetak] listPejabatUnit gagal:', e && e.message || e);
        return [];
      }),
      /* Lewat singgahan bersama — jembatan-elogbook.js sudah memuat TTD
         akun ini di bootstrap srvMuat, jadi panggilan pertama di sini
         langsung terjawab dari singgahan tanpa menyentuh jaringan. */
      ttdAkunAmbil(akun.user),
      /* Data filter dropdown pejabat: whitelist per jenis (`ditunjuk`) +
         bolehTtd per akun. Endpoint publik-terbatas — teknisi/adminunit
         yang mencetak boleh baca supaya dropdown-nya tidak jadi mubadzir
         menampilkan pejabat yang tidak berhak. */
      srvFetch('/pejabat-hak-cetak', {}, 8000)
        .then(r=>r.ok ? r.json() : null)
        .catch(e=>{ console.warn('[cetak] /pejabat-hak-cetak gagal:', e && e.message || e); return null; }),
      /* Saran nama PIC 1/PIC 2 di footer Jadwal Dinas — nama akun yang
         terdaftar di unit ini DAN yang ditunjuk di hak modul `dinas`
         (Jadwal Dinas). Pemfilteran dilakukan di server (dashboard) karena
         hak.json tidak diekspos ke non-admin. Hanya dipetik untuk mode
         'dinas' — footer PIC cuma dipakai di lembar dinas. */
      mode === 'dinas'
        ? srvFetch('/pic-cetak-dinas/' + encodeURIComponent(CETAK.unit), {}, 8000)
            .then(r=>r.ok ? r.json() : [])
            .catch(e=>{ console.warn('[cetak] /pic-cetak-dinas gagal:', e && e.message || e); return []; })
        : Promise.resolve([])
    ]);
    CETAK.picSaran = Array.isArray(teknisiUnit) ? teknisiUnit : [];
    CETAK.pejabat = Array.isArray(pejabat) ? pejabat : [];
    CETAK.ttdSaya = ttdSaya || { ada:false };
    /* Kalau unit itu tidak punya pejabat yang opt-in, jatuh balik ke
       daftar pejabat aktif keseluruhan — supaya lembar tetap bisa
       ditandatangani tanpa memaksa admin mengubah user_unit pejabat
       satu per satu dulu. */
    if(!CETAK.pejabat.length){
      const semua = await srvApi('listPejabatAktif').catch(e=>{
        console.warn('[cetak] listPejabatAktif gagal:', e && e.message || e);
        return [];
      });
      CETAK.pejabat = Array.isArray(semua) ? semua : [];
    }
    /* Saring dropdown pejabat berdasarkan jenis yang sedang dicetak. Dua
       lapis, dan urutannya penting — whitelist per jenis dulu (baru bolehTtd
       per akun), supaya kalau whitelist sudah menyaring habis, tidak
       terpangkas lagi jadi kosong oleh saringan kedua. Setiap saringan
       menyisakan minimal satu; kalau habis, dilewati (fallback ke daftar
       sebelumnya) supaya alur cetak tidak macet karena setup admin belum
       lengkap. */
    if(hakCetak){
      const modeKeModulTtd = { dinas:'dinas-ttd', sparepart:'sparepart-ttd', peralatan:'sejarah-ttd' };
      const modulTtd = modeKeModulTtd[CETAK.mode];
      const ditunjuk = (modulTtd && Array.isArray(hakCetak.ditunjuk?.[modulTtd])) ? hakCetak.ditunjuk[modulTtd] : [];
      if(ditunjuk.length){
        const set = new Set(ditunjuk.map(n=>String(n).toLowerCase()));
        const saring = CETAK.pejabat.filter(p=>set.has(String(p.username).toLowerCase()));
        if(saring.length) CETAK.pejabat = saring;
        else console.warn(`[cetak] Whitelist ${modulTtd} tidak menghasilkan pejabat aktif di unit ini — memakai daftar penuh.`);
      }
      /* Lapis kedua: bolehTtd per-akun, aturan KETAT — pejabat hanya lolos
         kalau jenis ini dicentang untuknya di Kelola Akun. Tanpa entri =
         tidak boleh. Kalau tidak ada satu pun yang lolos, daftar sengaja
         dibiarkan kosong (bukan jatuh ke daftar penuh): server toh akan
         menolak pengiriman ke pejabat tanpa hak, jadi lebih jujur memberi
         tahu di sini bahwa admin belum mencentang siapa pun. */
      const petaBoleh = (hakCetak.pejabatTtd && typeof hakCetak.pejabatTtd === 'object') ? hakCetak.pejabatTtd : {};
      CETAK.pejabat = CETAK.pejabat.filter(p=>{
        const b = petaBoleh[String(p.username).toLowerCase()];
        return Array.isArray(b) && b.includes(CETAK.mode);
      });
      CETAK.pejabatTanpaHak = !CETAK.pejabat.length;
      if(CETAK.pejabatTanpaHak) console.warn(`[cetak] belum ada pejabat yang dicentang boleh TTD jenis ${CETAK.mode}.`);
    }
    /* Kalau hasilnya tinggal satu pejabat, ia otomatis terpilih tanpa perlu
       diklik — mengirim langsung ke satu-satunya penerima yang boleh. */
    if(CETAK.pejabat.length) CETAK.pejabatDipilih = CETAK.pejabat[0].username;
    if(CETAK.pejabatDipilih) await cetakMuatTtdPejabat();
    cetakKartuGambar();
  }catch(e){
    console.warn('[cetak] kartu cetak gagal memuat:', e && e.message || e);
    cetakKartuGambar();
  }
}

async function cetakMuatTtdPejabat(){
  if(!CETAK.pejabatDipilih){ CETAK.ttdPejabat = null; return; }
  /* Lewat singgahan yang sama seperti TTD saya. Pejabat yang sudah
     pernah dilihat di sesi ini tidak perlu diambil ulang; yang belum
     akan disingahkan setelah pemanggilan pertama. */
  CETAK.ttdPejabat = await ttdAkunAmbil(CETAK.pejabatDipilih);
}

/* ---------- Kartu pilih pejabat + kanvas TTD kalau perlu ----------
   Bentuknya dijaga tetap sederhana dan mengikuti pola E-Logbook: TTD
   tersimpan langsung dipakai apa adanya (preview kecil di baris pejabat
   dan diri sendiri), dan kalau salah satunya belum punya, kanvas kecil
   muncul di tempatnya. Menekan Cetak sekaligus menyimpan goresannya ke
   E-Logbook — jadi sekali gambar, dipakai lagi untuk approve berikutnya
   tanpa perlu tombol "Simpan" tersendiri. */
/* Blok TTD satu orang: preview kalau sudah ada, kanvas kalau belum.
   "untukDiri" menandai bahwa kanvas ini akan disimpan lewat
   simpanTtdSaya (bukan simpanTtdMilik). Dipakai oleh cetakKartuGambar
   (kartu cetak biasa) DAN cetakKartuReviewGambar (kartu review pejabat)
   — jadi lingkupnya file, bukan lokal. */
function blokTtdOrang(ttd, opts){
  if(!ttd){
    return `<div class="cetak-ket">${T('Memuat TTD…','Loading signature…')}</div>`;
  }
  if(ttd.ada){
    /* URL dari server dashboard — /ttd-akun/:user/gambar — bukan
       /uploads/... di E-Logbook. Berkas fisiknya ada di
       data/ttd-akun/ pada server dashboard, disalin dari E-Logbook.

       Bentuk kartu meniru E-Logbook: kotak berlatar gelap (goresan
       digambar putih di E-Logbook, jadi harus di atas gelap supaya
       terlihat) plus baris meta kecil "dibubuhkan oleh · waktu". */
    const namaTampil = ttd.nama || (opts.untukDiri ? (akun.nama || akun.user) : '');
    const waktu = ttd.dibuatPada ? cetakWaktuRingkas(ttd.dibuatPada) : '';
    return `
      <div class="cetak-ttd-bing">
        <img class="cetak-ttd-pratinjau" src="${esc(ttd.url)}" alt="">
      </div>
      <div class="cetak-ttd-meta">${T('dibubuhkan oleh','signed by')} <b>${esc(namaTampil)}</b>${
        waktu ? ` · ${esc(waktu)}` : ''}</div>`;
  }
  /* Belum ada — kalau boleh menggambar, tawarkan kanvas.
     - Untuk diri sendiri: selalu boleh (simpanTtdSaya adalah endpoint milik akun).
     - Untuk pejabat lain: hanya admin/superadmin yang boleh (simpanTtdMilik). */
  if(!opts.bolehGambar){
    return `<div class="cetak-ket awas">${T(
      'Belum ada TTD tersimpan di E-Logbook untuk akun ini.',
      'No signature saved in E-Logbook for this account yet.')}</div>`;
  }

  /* Untuk PEJABAT (bukan diri sendiri): jalur utamanya SERAHKAN — TTD
     yang tersimpan di akun pejabat dipakai apa adanya, dan kalau belum
     ada, pejabatnya sendiri yang membuat. Menggambarkan atas nama
     pejabat tetap ada sebagai jalur cadangan, tapi bukan bawaan.
     Untuk diri sendiri hanya satu jalan — memang cuma pemiliknya yang
     bisa menyimpan. */
  const pilihanCara = opts.untukDiri ? '' : `
    <div class="cetak-cara-ttd" role="radiogroup"
      aria-label="${T('Cara memasang TTD pejabat','How to attach the officer signature')}">
      <button type="button" class="cetak-cara-btn ${CETAK.serahkanKePejabat ? 'aktif' : ''}"
        data-cetak-cara="serahkan" role="radio"
        aria-checked="${CETAK.serahkanKePejabat ? 'true' : 'false'}">${
        T('Serahkan ke pejabat','Leave for officer')}</button>
      <button type="button" class="cetak-cara-btn ${CETAK.serahkanKePejabat ? '' : 'aktif'}"
        data-cetak-cara="gambar" role="radio"
        aria-checked="${CETAK.serahkanKePejabat ? 'false' : 'true'}">${
        T('Gambar atas nama pejabat','Draw on their behalf')}</button>
    </div>`;

  /* Serahkan ke pejabat (bawaan): sembunyikan kanvas, tampilkan
     keterangan bagaimana pejabatnya bisa membuat TTD sendiri — dua
     jalur, mana pun bekerja:
       - E-Logbook → menu TTD Saya
       - Dashboard → modal cetak, jalur "Anda belum punya TTD"
     Sekali tersimpan, TTD itu jadi milik akunnya untuk selanjutnya. */
  if(!opts.untukDiri && CETAK.serahkanKePejabat){
    return `
      ${pilihanCara}
      <div class="cetak-ket awas">${T(
        'Pejabat ini belum punya TTD tersimpan.',
        'This officer has no saved signature yet.')}</div>
      <div class="cetak-ket">${T(
        'Lembar tercetak dengan kotak TTD pejabat kosong berketerangan "Menunggu TTD". Pejabat bisa menyimpan TTD-nya sendiri lewat E-Logbook (menu TTD Saya) atau lewat modal cetak di dashboard ini — sekali tersimpan, dipakai untuk semua cetak dan pengesahan berikutnya tanpa perlu digambar ulang.',
        'The sheet prints with an empty officer signature box labelled "Awaiting signature". The officer can save their own signature via E-Logbook (My Signature menu) or via this dashboard\'s print modal — once saved, it is used for every subsequent print and approval without redrawing.')}</div>`;
  }

  return `
    ${pilihanCara}
    <div class="cetak-ket">${opts.untukDiri
      ? T('Anda belum punya TTD tersimpan. Gambar sekali di kotak di bawah — Cetak akan menyimpannya ke E-Logbook (TTD Saya) sekaligus mencetak.',
          'You have no saved signature yet. Draw once in the box below — Print will save it to E-Logbook (My Signature) and print in one go.')
      : T('Cadangan: gambar TTD atas nama pejabat di sini. Cetak akan menyimpannya ke E-Logbook (slot 0 pejabat) sekaligus mencetak; pejabatnya sendiri tetap bisa menggantinya kapan saja lewat TTD Saya.',
          'Fallback: draw the officer signature here. Print will save it to E-Logbook (officer slot 0) and print in one go; the officer may still replace it any time via My Signature.')}</div>
    <canvas class="cetak-ttd-kanvas" id="${esc(opts.idKanvas)}"></canvas>
    <div class="cetak-ttd-alat">
      <button class="btn garis kecil" data-cetak-bersih="${esc(opts.idKanvas)}" type="button">${
        T('Bersihkan','Clear')}</button>
    </div>`;
}

function cetakKartuGambar(){
  const u = infoUnit(CETAK.unit);
  const badan = el('badanKartuCetak');
  const kepJudul = el('judulKartuCetak');
  if(kepJudul){
    // Modal judul mencantumkan ragam PUM/Teknik supaya pemakai yakin ia
    // menekan tombol yang benar sebelum dikirim ke pejabat.
    const ragam = CETAK.mode === 'dinas'
      ? ' — ' + (CETAK.formatDinas === 'pum' ? T('PUM','PUM') : T('Teknik','Teknik'))
      : '';
    kepJudul.textContent = T('Cetak: ','Print: ') + (CETAK_JUDUL[CETAK.mode]?.() || CETAK.mode) +
      (u && u.nama ? ' — ' + u.nama : '') + ragam;
  }

  const pilihanPejabat = CETAK.pejabat.length
    ? `<select id="cetakPilihPejabat">${CETAK.pejabat.map(p=>
        `<option value="${esc(p.username)}"${p.username===CETAK.pejabatDipilih?' selected':''}
          >${esc(p.nama || p.username)}</option>`).join('')}</select>`
    : `<span class="mono" style="color:var(--muted);font-size:12px">${
        CETAK.pejabatTanpaHak
          ? T('Belum ada pejabat yang diberi hak menandatangani jenis dokumen ini. Minta administrator mencentangnya di Kelola Akun → akun pejabat → "Boleh menandatangani dokumen jenis".',
              'No officer has been granted the right to sign this document type yet. Ask an administrator to tick it under Manage Accounts → officer account → "May sign document types".')
          : T('Belum ada pejabat terdaftar.','No signing officer registered yet.')}</span>`;

  /* Semua jenis cetak (peralatan, sparepart, dinas) sekarang lewat pejabat.
     Peralatan dulu langsung cetak — sudah tidak lagi: lembar Sejarah
     Peralatan menuntut tanda tangan Mengetahui sesuai form docx-nya, jadi
     harus lewat officer juga. Cabang "tidak perlu TTD" dilepas dari sini
     supaya kartu tidak jatuh ke keterangan "Lembar peralatan tidak
     memerlukan tanda tangan" — yang sudah tidak berlaku lagi. */
  const kirimSaja = !bolehCetakLangsung();

  /* Kartu Cetak dipersempit: pembuat tidak menandatangani lembar cetak
     — teknisi memilih tujuan, pejabat yang menyetujui, unit mengambil
     PDF-nya dari Kotak Masuk setelahnya. Blok Pembuat + kanvas TTD saya
     yang dulu ada di sini dilepas: kolom Dibuat oleh yang selalu kosong
     di tangan pejabat cuma menambah ruang tanpa menambah informasi. */
  /* Isian tambahan untuk Jadwal Dinas: dua PIC (nama personel yang
     bertanggung jawab menyusun jadwal) + tanggal pembuatan lembar. Ketiganya
     tampil di kaki lembar cetak, jadi PIC yang mengirim mengisinya di sini.
     Tanggal bawaannya hari ini — bisa disunting.

     Nama PIC memakai <select> — daftar akun auto-generate dari
     /pic-cetak-dinas/:unit (irisan akun terdaftar di unit ini dan yang
     dipilih di hak `dinas-cetak`). Tidak ada isian bebas: PIC harus
     salah satu nama yang tercantum, supaya lembar cetak konsisten dengan
     daftar akun yang berhak. */
  const opsiPic = (nilai) => {
    const nama = Array.from(new Set((CETAK.picSaran || [])
      .map(u => String(u && u.nama || u && u.username || '').trim())
      .filter(Boolean))).sort((a,b)=>a.localeCompare(b,'id'));
    return nama.map(n=>`<option value="${esc(n)}"${
      n === (nilai || '') ? ' selected' : ''}>${esc(n)}</option>`).join('');
  };
  const isianDinas = (kirimSaja && CETAK.mode === 'dinas') ? `
    <div class="cetak-baris" style="margin-top:10px">
      <label>${T('PIC 1 (nama)','PIC 1 (name)')}</label>
      <select id="cetakPic1" style="flex:1;min-width:0">
        <option value="">${T('— pilih nama PIC 1 —','— pick PIC 1 name —')}</option>
        ${opsiPic(CETAK.picNama1)}
      </select>
    </div>
    <div class="cetak-baris" style="margin-top:8px">
      <label>${T('PIC 2 (nama)','PIC 2 (name)')}</label>
      <select id="cetakPic2" style="flex:1;min-width:0">
        <option value="">${T('— pilih nama PIC 2 —','— pick PIC 2 name —')}</option>
        ${opsiPic(CETAK.picNama2)}
      </select>
    </div>
    <div class="cetak-baris" style="margin-top:8px">
      <label>${T('Tanggal (Tangerang)','Date (Tangerang)')}</label>
      <input type="date" id="cetakTanggal" style="flex:1;min-width:0"
        value="${esc(CETAK.tanggalCetak || '')}">
    </div>
    <div class="cetak-ket" style="margin-top:6px">${T(
      'PIC 1 & 2 dan tanggal ini tampil di kaki lembar cetak. Daftar auto-generate: akun yang ditunjuk di Hak Akses → Jadwal Dinas → Ditunjuk DAN terdaftar di unit ini (UNIT LOGBOOK di Daftar Akun). Tanggal boleh disunting; bawaannya hari ini.',
      'PIC 1 & 2 and this date appear at the foot of the printed sheet. Auto-generated: accounts named under Access Rights → Duty Roster → Named AND registered to this unit (UNIT LOGBOOK column in Account List). Date is editable; defaults to today.')}</div>
  ` : '';

  const badanHtml = kirimSaja ? `
    <div class="cetak-baris">
      <label>${T('Kirim untuk disetujui oleh','Send for approval by')}</label>
      ${pilihanPejabat}
    </div>
    <div class="cetak-ket">${T(
      'Anda mengirim salinan data saat ini ke Kotak Masuk pejabat yang dipilih. Pejabat akan meninjau, menandatangani, dan file PDF akhirnya muncul di Kotak Masuk unit ini untuk dicetak.',
      'You are sending a copy of the current data to the selected officer\'s Inbox. The officer will review, sign, and the final PDF appears in this unit\'s Inbox for printing.')}</div>
    ${isianDinas}
    ${(CETAK.mode === 'peralatan' || CETAK.mode === 'dinas') ? '' : `
    <div class="cetak-baris" style="margin-top:10px">
      <label>${T('Catatan (opsional)','Note (optional)')}</label>
      <textarea id="cetakCatatan" rows="2" style="flex:1;min-width:0" maxlength="500"
        placeholder="${T(`mis. rekap sparepart bulan ini, mohon disetujui`,
                         `e.g. this month's spare-part recap, please approve`)}"></textarea>
    </div>`}
  ` : `
    <div class="cetak-baris">
      <label>${T('Mengetahui','Approved by')}</label>
      ${pilihanPejabat}
    </div>
    ${CETAK.pejabatDipilih ? blokTtdOrang(CETAK.ttdPejabat, {
      untukDiri: false,
      bolehGambar: bolehBubuhkanTtdOrang(),
      idKanvas: 'cetakTtdKanvas'
    }) : ''}
  `;

  /* Label tombol utama berubah mengikuti mode. Teknisi kirim → "Kirim
     ke pejabat"; pengesah/admin → "Cetak" seperti biasa. */
  const btnCetak = el('btnLakukanCetak');
  if(btnCetak){
    btnCetak.textContent = kirimSaja
      ? T('Kirim untuk disetujui','Send for approval')
      : T('Cetak','Print');
  }
  /* Tombol "Setujui & Kirim" hanya untuk kartu review pejabat — di kartu
     kirim ini disembunyikan supaya tidak tampak sebagai kotak kosong di
     samping Batal. cetakKartuReviewGambar() yang menampilkannya kembali
     saat memang giliran Manager Teknik menandatangani. */
  const btnKirim = el('btnSetujuiKirim');
  if(btnKirim){ btnKirim.hidden = true; btnKirim.onclick = null; }

  if(badan) badan.innerHTML = badanHtml;
  cetakPasangKartu();
}

/* Format waktu ringkas untuk meta TTD — mengikuti pola E-Logbook:
   "10 AGU 2026 04:55 UTC". Yang datang biasanya ISO ('2026-08-10T04:55:00Z'). */
function cetakWaktuRingkas(iso){
  const s = String(iso || '');
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
  if(!m) return s;
  const bln = ['JAN','FEB','MAR','APR','MEI','JUN','JUL','AGU','SEP','OKT','NOV','DES'][Number(m[2])-1] || m[2];
  return `${Number(m[3])} ${bln} ${m[1]} ${m[4]}:${m[5]} UTC`;
}

function cetakPasangKartu(){
  const pilih = el('cetakPilihPejabat');
  if(pilih) pilih.addEventListener('change', async ()=>{
    CETAK.pejabatDipilih = pilih.value;
    CETAK.ttdPejabat = null;
    /* Kanvas pejabat lama (kalau ada) tidak lagi berlaku untuk pejabat baru. */
    CETAK.kanvas = { el:null, ctx:null, ada:false };
    cetakKartuGambar();
    await cetakMuatTtdPejabat();
    cetakKartuGambar();
  });

  /* Isian footer Jadwal Dinas — dua PIC (dropdown <select>) + tanggal.
     Ditulis langsung ke state supaya cetakSnapshot() dan htmlDinas() bisa
     membacanya waktu tombol kirim/cetak ditekan. */
  const pic1 = el('cetakPic1');
  if(pic1) pic1.addEventListener('change', ()=>{ CETAK.picNama1 = pic1.value; });
  const pic2 = el('cetakPic2');
  if(pic2) pic2.addEventListener('change', ()=>{ CETAK.picNama2 = pic2.value; });
  const tgl = el('cetakTanggal');
  if(tgl) tgl.addEventListener('change', ()=>{ CETAK.tanggalCetak = tgl.value; });

  /* Kanvas pejabat dan kanvas saya masing-masing dipasang kalau ada di DOM.
     Ada/tidaknya ditentukan cetakKartuGambar berdasar keberadaan TTD tersimpan. */
  const kanvasPejabat = el('cetakTtdKanvas');
  if(kanvasPejabat) cetakPasangKanvas(kanvasPejabat, 'kanvas');

  const kanvasSaya = el('cetakTtdKanvasSaya');
  if(kanvasSaya) cetakPasangKanvas(kanvasSaya, 'kanvasSaya');

  /* Tombol Bersihkan bekerja atas kanvas yang namanya ditulis di data-cetak-bersih. */
  document.querySelectorAll('[data-cetak-bersih]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const id = btn.dataset.cetakBersih;
      const k = (id === 'cetakTtdKanvasSaya') ? CETAK.kanvasSaya : CETAK.kanvas;
      if(!k || !k.ctx) return;
      k.ctx.fillStyle = '#fff';
      k.ctx.fillRect(0, 0, k.el.width, k.el.height);
      k.ada = false;
    });
  });

  /* Segmented: gambar di sini vs serahkan ke pejabat. Kanvas ikut hilang
     atau kembali ketika pilihannya berubah — kalau dulu sudah ada
     goresan lalu berpindah ke "serahkan", goresan itu dibuang: keputusan
     admin sudah bergeser ke jalur lain, memasangnya diam-diam akan
     membingungkan. */
  document.querySelectorAll('[data-cetak-cara]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const baru = btn.dataset.cetakCara === 'serahkan';
      if(baru === CETAK.serahkanKePejabat) return;
      CETAK.serahkanKePejabat = baru;
      CETAK.kanvas = { el:null, ctx:null, ada:false };
      cetakKartuGambar();
    });
  });
}

/* Kanvas TTD ringan: dukung mouse dan sentuh. Ukurannya diset kali
   pertama dilihat (canvas.width butuh piksel nyata, bukan CSS), bukan
   dari CSS — supaya goresannya tetap tajam. Parameter slot menentukan
   ke mana kanvas ini dilaporkan: CETAK.kanvas (pejabat) atau
   CETAK.kanvasSaya (diri sendiri). */
function cetakPasangKanvas(kanvas, slot){
  const rect = kanvas.getBoundingClientRect();
  kanvas.width = Math.round(rect.width);
  kanvas.height = Math.round(rect.height);
  const ctx = kanvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, kanvas.width, kanvas.height);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  CETAK[slot] = { el:kanvas, ctx, ada:false };

  let menggambar = false;
  const posisi = (ev)=>{
    const t = ev.touches ? ev.touches[0] : ev;
    const r = kanvas.getBoundingClientRect();
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  };
  const mulai = (ev)=>{
    ev.preventDefault();
    menggambar = true;
    const p = posisi(ev);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };
  const gerak = (ev)=>{
    if(!menggambar) return;
    ev.preventDefault();
    const p = posisi(ev);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    if(!CETAK[slot].ada) CETAK[slot].ada = true;
  };
  const selesai = ()=>{ menggambar = false; };

  kanvas.addEventListener('mousedown', mulai);
  kanvas.addEventListener('mousemove', gerak);
  window.addEventListener('mouseup',   selesai);
  kanvas.addEventListener('touchstart', mulai,  { passive:false });
  kanvas.addEventListener('touchmove',  gerak,  { passive:false });
  kanvas.addEventListener('touchend',   selesai);
}

/* ---------- Batal & Cetak ---------- */

function cetakBatal(){
  el('lapisCetak').classList.remove('buka');
  const badan = el('badanKartuCetak');
  if(badan) badan.innerHTML = '';
}

async function cetakLakukan(){
  /* Jalur teknisi (bukan pengesah): kirim permintaan ke pejabat, tidak
     mencetak di sini. Pejabat yang mencetak setelah menyetujui — lembar
     final harus keluar dengan tanda tangan pengesah. Peralatan pun ikut
     jalur ini sekarang; form Sejarah Peralatan (docx) menuntut tanda
     tangan Mengetahui, jadi tidak bisa keluar tanpa lewat pejabat dulu. */
  if(!bolehCetakLangsung()){
    await cetakKirimKePejabat();
    return;
  }

  /* Simpan dulu goresan yang ada ke E-Logbook — dua kanvas mungkin: TTD
     pejabat lewat simpanTtdMilik dan TTD saya lewat simpanTtdSaya. Sekali
     tersimpan, cetak berikutnya (dan pengesahan berikutnya di formulir
     E-Logbook) sudah pakai TTD ini tanpa perlu digambar lagi. */
  const tombolCetak = el('btnLakukanCetak');
  if(tombolCetak) tombolCetak.disabled = true;
  try{
    const antrean = [];
    if(CETAK.kanvasSaya && CETAK.kanvasSaya.ada){
      antrean.push(srvApi('simpanTtdSaya', {
        dataUrl: CETAK.kanvasSaya.el.toDataURL('image/png'),
        slotIdx: 0
      }));
    }
    /* Kalau admin memilih "Serahkan ke pejabat", kanvas pejabat sengaja
       dilewati — TTD-nya akan disimpan sendiri oleh pejabat lewat menu
       TTD Saya di E-Logbook. */
    if(!CETAK.serahkanKePejabat
       && CETAK.kanvas && CETAK.kanvas.ada && CETAK.pejabatDipilih){
      antrean.push(srvApi('simpanTtdMilik', {
        username: CETAK.pejabatDipilih,
        dataUrl: CETAK.kanvas.el.toDataURL('image/png')
      }));
    }
    if(antrean.length){
      await Promise.all(antrean);
      /* Singgahan lama untuk pemilik goresannya tidak lagi berlaku —
         panaskan ulang dari E-Logbook supaya lembar cetak memakai jalur
         /uploads/... yang baru, bukan dataURL kanvas yang barusan digambar. */
      if(CETAK.kanvasSaya && CETAK.kanvasSaya.ada) ttdAkunInvalidate(akun.user);
      if(CETAK.kanvas && CETAK.kanvas.ada && CETAK.pejabatDipilih){
        ttdAkunInvalidate(CETAK.pejabatDipilih);
      }
      const [ttdSayaBaru] = await Promise.all([
        ttdAkunAmbil(akun.user, { paksa:true }).catch(()=>CETAK.ttdSaya || { ada:false }),
        CETAK.pejabatDipilih ? cetakMuatTtdPejabat() : null
      ]);
      CETAK.ttdSaya = ttdSayaBaru || CETAK.ttdSaya;
    }
  }catch(e){
    if(tombolCetak) tombolCetak.disabled = false;
    pesan(T('Gagal menyimpan TTD sebelum mencetak: ',
            'Could not save signature before printing: ') + (e && e.message || e));
    return;
  }
  if(tombolCetak) tombolCetak.disabled = false;

  const html = await cetakLembarHtml();
  const area = el('printArea');
  area.innerHTML = html;
  /* Jadwal Dinas dicetak lanskap satu halaman — kolom 31 hari + Nama + NIK
     tidak muat di potret. Kelas .lanskap menyala di #printArea untuk
     memicu aturan CSS yang mengecilkan tabel; sekaligus @page landscape
     disuntik lewat <style id="pageOrientasi"> supaya orientasi kertas ikut
     berubah — sengaja lewat JS karena `page: name` di CSS tidak konsisten
     bekerja untuk element ber-position:absolute+visibility seperti ini.
     Mode lain (peralatan, sparepart) tetap potret bawaan. */
  area.classList.toggle('lanskap', CETAK.mode === 'dinas');
  pasangOrientasiCetak(CETAK.mode === 'dinas' ? 'landscape' : null);
  /* Kalau TTD-nya digambar putih di E-Logbook, ubah jadi hitam untuk
     kertas putih. Piksel bergaris (alpha > 0) dipaksa hitam pekat. */
  const imgs = Array.from(area.querySelectorAll('img[data-perlu-hitam]'));
  await Promise.all(imgs.map(async img=>{
    try{
      await new Promise((res, rej)=>{
        if(img.complete && img.naturalWidth) return res();
        img.onload = res; img.onerror = rej;
        setTimeout(res, 3000);
      });
      const baru = ttdKeHitam(img);
      if(baru) img.src = baru;
    }catch{ /* biarkan apa adanya kalau gagal */ }
  }));
  /* Bunyi cetak dari dialog cetak peramban belum tentu langsung; sedikit
     jeda supaya gambar hasil konversi sempat termuat. Dan tutup kartu
     pilih pejabat dulu, supaya tidak menutupi kertas di layar preview
     peramban. */
  el('lapisCetak').classList.remove('buka');
  setTimeout(()=>{
    window.print();
    /* Setelah dialog cetak selesai (fokus kembali), bersihkan area cetak
       supaya isinya tidak menempel di background layar dashboard. */
    setTimeout(()=>{
      area.innerHTML = '';
      area.classList.remove('lanskap');
      pasangOrientasiCetak(null);   // kembalikan @page ke bawaan potret
    }, 500);
  }, 200);
}

/**
 * Sisipkan atau cabut aturan @page yang mengubah orientasi kertas untuk
 * proses window.print() berikutnya.
 *
 * Chrome tidak konsisten menerapkan named-page (`@page nama { size: ... }`
 * + `page: nama` di selector) waktu element target ber-position:absolute
 * dan sedang di-visibility:visible dari dalam @media print. Cara yang
 * dapat diandalkan: sisipkan style tag di <head> tepat sebelum print, dan
 * cabut setelahnya. Karena aturan @page yang terakhir menang, ini menimpa
 * @page bawaan (potret) di 09-cetak.css.
 *
 * mode: 'landscape' | 'portrait' | null (null = cabut, kembali ke bawaan).
 */
function pasangOrientasiCetak(mode){
  const ID = 'pageOrientasi';
  const lama = document.getElementById(ID);
  if(lama) lama.remove();
  if(!mode) return;
  const style = document.createElement('style');
  style.id = ID;
  style.setAttribute('media', 'print');
  style.textContent = mode === 'landscape'
    ? '@page { size: A4 landscape; margin: 8mm; }'
    : '@page { size: A4 portrait; margin: 14mm 12mm; }';
  document.head.appendChild(style);
}

/* Menerima <img> yang sudah termuat; kembalikan dataURL versi hitam.
   Kalau gambarnya sudah pekat (mis. dijepret dari cap yang siap cetak),
   dikembalikan apa adanya. Sepadan dengan ttdToBlack di E-Logbook
   (21-cetak-dasar.js). */
function ttdKeHitam(img){
  if(!img || !img.naturalWidth) return '';
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  try{
    const d = x.getImageData(0, 0, c.width, c.height);
    const p = d.data;
    let adaTembusPandang = false;
    for(let i = 3; i < p.length; i += 4){ if(p[i] < 255){ adaTembusPandang = true; break; } }
    if(!adaTembusPandang) return img.src;
    for(let i = 0; i < p.length; i += 4){
      if(p[i+3] > 0){ p[i]=0; p[i+1]=0; p[i+2]=0; }
    }
    x.putImageData(d, 0, 0);
    return c.toDataURL('image/png');
  }catch(e){ return img.src; }
}

/* ---------- Kop, blok TTD, dan tiga builder lembar ---------- */

function kopLembar(){
  const u = infoUnit(CETAK.unit);
  const judul = CETAK_JUDUL[CETAK.mode]?.() || '';
  const bulan = CETAK.mode === 'dinas' ? ` — ${namaBulan(JDW.lihat || bulanKode(new Date()))}` : '';
  /* Ragam PUM/Teknik SENGAJA tidak ditulis di kop kertas — pengguna
     memintanya jadi penanda internal saja (di modal cetak), bukan pada
     dokumen yang diserahkan. Modal Cetak tetap menampilkan ragam di
     judulnya lewat cetakKartuGambar(). */
  // Blok kop-tabel (Penyelenggara/Kelompok Fasilitas/Tanggal Cetak/Dicetak
  // Oleh) dilepas — informasi itu tumpang tindih dengan blok identitas
  // per-alat di badan (yang sudah memuat Penyelenggara + Kelompok Fasilitas),
  // dan tanggal + pencetak tidak diminta di form docx aslinya.
  return `
    <h1>${esc(judul)}${esc(bulan)}</h1>
    <h2>${esc(u.nama || CETAK.unit)}</h2>
  `;
}

function blokTtd(){
  /* URL & nama TTD Manager Teknik yang akan menandatangani lembar ini. */
  const mengertUrl = CETAK.ttdPejabat && CETAK.ttdPejabat.ada ? CETAK.ttdPejabat.url : '';
  const mengertNama = CETAK.ttdPejabat ? (CETAK.ttdPejabat.nama || CETAK.pejabatDipilih || '') : '';
  /* Kalau admin memilih "Serahkan ke pejabat" dan TTD-nya belum ada,
     kotak diisi keterangan "Menunggu TTD" — bukan sekadar "(belum ada
     TTD tersimpan)". Bedanya kentara di tangan pejabat: yang pertama
     memberitahu bahwa lembar ini menunggu tanda tangan mereka; yang
     kedua terbaca sebagai keluhan sistem. */
  const menungguPejabat = CETAK.serahkanKePejabat
                       && CETAK.ttdPejabat && !CETAK.ttdPejabat.ada;
  const kosongTeks = menungguPejabat
    ? T('Menunggu TTD','Awaiting signature')
    : T('(belum ada TTD tersimpan)','(no saved signature)');

  /* Jadwal Dinas TIDAK memakai blokTtd standar — footernya penuh, meliputi
     PIC, tabel cuti/SAP, note lima poin, tanggal, dan dua kolom TTD di
     kanan. Yang menyusunnya dinasFooterHtml(); jalur ini cuma dilewati oleh
     mode lain (peralatan, sparepart). */

  return `
    <table class="ttd-blok ttd-blok-tunggal">
      <tr>
        <td>
          <div class="peran-ttd">${T('Mengetahui,','Approved by,')}</div>
          <div class="kotak-ttd">${mengertUrl
            ? `<img src="${mengertUrl}" data-perlu-hitam alt="">`
            : `<span class="kosong-ket">${esc(kosongTeks)}</span>`}</div>
          <div class="nama-ttd">${esc(mengertNama || '—')}</div>
          <div class="jabatan-ttd">${esc(T('Manajer Teknik','Technical Manager'))}</div>
        </td>
      </tr>
    </table>
  `;
}

async function cetakLembarHtml(){
  let isi = '';
  if(CETAK.mode === 'sparepart')      isi = htmlSparepart();
  else if(CETAK.mode === 'peralatan') isi = htmlPeralatan();
  else if(CETAK.mode === 'dinas')     isi = htmlDinas();

  if(CETAK.mode === 'dinas'){
    /* Footer Dinas mengganti blokTtd standar — memuat PIC + tabel cuti +
       note 5 poin + tanggal + dua kolom TTD (di mode PUM, PIC dan note
       dibuang — lihat dinasFooterHtml). Data untuk footer dikumpulkan
       dari state CETAK yang di-set modal kirim (pic1/pic2/tanggalCetak)
       dan JDW live (untuk daftar cuti). */
    const bulan = JDW.lihat || JDW.bulanIni || bulanKode(new Date());
    const orang = (JDW.jadwalLihat && JDW.jadwalLihat[CETAK.unit]) || [];
    const foot = dinasFooterHtml({
      pum: CETAK.formatDinas === 'pum',
      pic1: CETAK.picNama1 || '',
      pic2: CETAK.picNama2 || '',
      tanggalIso: CETAK.tanggalCetak || '',
      cutiRows: dinasBarisCuti(orang, bulan),
      ttdMengertUrl:  (CETAK.ttdDeputy  && CETAK.ttdDeputy.ada)  ? CETAK.ttdDeputy.url  : '',
      ttdMengertNama: (CETAK.ttdDeputy  && (CETAK.ttdDeputy.nama || CETAK.deputyDipilih)) || '',
      ttdManagerUrl:  (CETAK.ttdPejabat && CETAK.ttdPejabat.ada) ? CETAK.ttdPejabat.url : '',
      ttdManagerNama: (CETAK.ttdPejabat && (CETAK.ttdPejabat.nama || CETAK.pejabatDipilih)) || ''
    });
    return `<div class="cetak-lembar">${kopLembar()}${isi}${foot}</div>`;
  }
  return `<div class="cetak-lembar">${kopLembar()}${isi}${blokTtd()}</div>`;
}

function htmlSparepart(){
  const rows = PART.filter(p=>p.unit === CETAK.unit)
                   .sort((a,b)=>(a.nama||'').localeCompare(b.nama||''));
  if(!rows.length){
    return `<div style="text-align:center;font-style:italic;padding:12pt 0">${
      T('Belum ada sparepart terdaftar untuk unit ini.',
        'No spare parts registered for this unit yet.')}</div>`;
  }
  return `
    <table class="data">
      <thead><tr>
        <th style="width:32px">${T('No','No')}</th>
        <th>${T('Sparepart','Spare Part')}</th>
        <th style="width:32%">Part Number</th>
        <th style="width:70px">${T('Rak','Rack')}</th>
        <th style="width:60px" class="tengah">${T('Stok','Stock')}</th>
        <th style="width:52px" class="tengah">${T('Min','Min')}</th>
        <th style="width:60px">${T('Satuan','Unit')}</th>
        <th style="width:82px">${T('Dipakai','Last used')}</th>
      </tr></thead>
      <tbody>${rows.map((p,i)=>`
        <tr>
          <td class="tengah mono">${i+1}</td>
          <td>${esc(p.nama || '')}</td>
          <td class="mono">${esc(p.pn || '')}</td>
          <td class="mono">${esc(p.rak || '')}</td>
          <td class="tengah mono">${Number(p.stok)||0}</td>
          <td class="tengah mono">${Number(p.min)||0}</td>
          <td>${esc(p.satuan || '')}</td>
          <td class="mono">${esc(tglRingkas(p.pakai) || '—')}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
}

function htmlPeralatan(){
  // Tab grup lokasi menyaring lembar cetak — kalau tab "Semua" yang aktif
  // (CETAK.grup = ''), seluruh peralatan ikut; kalau tab lain, hanya baris
  // dengan kolom `grup` yang cocok. Nilainya sudah dibekukan di CETAK waktu
  // tombol Print ditekan, jadi pindah tab setelah itu tidak mengubah hasil.
  const semua = (PERALATAN[CETAK.unit] || []).slice()
                  .sort((a,b)=>(a.nama||'').localeCompare(b.nama||''));
  const rows = CETAK.grup
    ? semua.filter(a=>(a.grup || '') === CETAK.grup)
    : semua;

  // Judul kecil di atas tabel: mengumumkan grup mana yang dicetak. Waktu
  // kosong (tab Semua), keterangannya "Seluruh grup" supaya orang yang
  // memegang cetakan tahu bahwa memang lengkap, bukan potongan.
  const subJudul = `<div style="text-align:center;font-size:10pt;margin:-6pt 0 10pt;color:#555">${
    CETAK.grup
      ? `${T('Grup lokasi','Location group')}: <b>${esc(CETAK.grup)}</b> · ${rows.length} ${
          T('peralatan dari','equipment of')} ${semua.length}`
      : `${T('Seluruh grup lokasi','All location groups')} · ${rows.length} ${
          T('peralatan','equipment')}`}</div>`;

  if(!rows.length){
    return subJudul + `<div style="text-align:center;font-style:italic;padding:12pt 0">${
      CETAK.grup
        ? T('Tidak ada peralatan di grup ','No equipment in group ') + `"${esc(CETAK.grup)}".`
        : T('Belum ada peralatan terdaftar untuk unit ini.',
            'No equipment registered for this unit yet.')}</div>`;
  }

  /* Kop identitas peralatan — meniru form docx "Sejarah Peralatan":
     lima baris penyelenggara/kelompok/nama/merek+tipe/S/N, plus baris
     tambahan (P/N, Tahun, Lokasi, Status) hanya kalau isinya ada. Yang
     kosong dilewati supaya "S/N : —" tidak menyita tempat. "Dicatat"
     tidak dicetak — tanggal pencatatan tidak diminta di lembar aslinya.

     `alat` bisa berupa alat induk maupun sub-unit — keduanya berbagi
     bentuk data yang sama (nama/merk/tipe/sn/pn/tahun/lokasi/status).
     Untuk kop unit-level (Penyelenggara, Kelompok Fasilitas) mengambil
     dari infoUnit; nilai defaultnya sudah dipakai kopLembar di atas. */
  const u = infoUnit(CETAK.unit);
  const kelompok = u.alat || u.nama || '';
  const spek = (a)=>{
    const pokok = [
      [T('Penyelenggara Pelayanan','Service Provider'),  'Perum LPPNPI'],
      [T('Kelompok Fasilitas','Facility Group'),          kelompok],
      [T('Nama Peralatan','Equipment Name'),              a.nama || ''],
      [T('Merek dan Tipe Peralatan','Make and Type'),
        [a.merk, a.tipe].filter(x=>x && x !== '—').join(' — ')],
      [T('Nomor Seri Peralatan','Serial Number'),         a.sn || '']
    ];
    const tambahan = [
      ['Part Number (P/N)',                               a.pn],
      [T('Tahun Pembuatan','Year of Manufacture'),        a.tahun],
      [T('Lokasi','Location'),                            a.lokasi],
      [T('Status','Status'),                              a.status || '']
    ].filter(([,v])=>v && v !== '—');
    return `<table class="spek-cetak">${
      pokok.concat(tambahan).map(([k,v])=>
        `<tr><td>${esc(k)}</td><td>: ${esc(v || '—')}</td></tr>`).join('')
    }</table>`;
  };

  /* Tabel sejarah — kolom mengikuti docx: No / Tanggal / Uraian /
     Keterangan / Paraf. Uraian menampung judul (utama, tebal) plus
     rincian di bawahnya; Keterangan menyimpan label tingkat (Biasa/
     Perlu diperhatikan/Gangguan) supaya cetak hitam putih tetap
     membawa artinya. Paraf diisi nama pencatat — tanda tangan sungguhan
     ada di blok Mengetahui di kaki lembar, bukan per baris. Waktu kosong,
     tabel tetap digambar dengan sepuluh baris kosong siap ditulis tangan. */
  const sejarah = (a)=>{
    const daftar = (typeof sjrUntuk === 'function')
      ? sjrUntuk(CETAK.unit, a.id) : [];
    const labelTingkat = (w)=>{
      const p = (typeof SJR_WARNA !== 'undefined')
        ? SJR_WARNA.find(x=>x[0]===(w||'')) : null;
      const n = p ? p[1] : ['','—'];
      return T(n[0], n[1]);
    };
    const kepala = `<table class="data sjr-tabel">
      <thead><tr>
        <th style="width:28px" class="tengah">${T('No','No')}</th>
        <th style="width:78px" class="tengah">${T('Tanggal','Date')}</th>
        <th>${T('Uraian','Description')}</th>
        <th style="width:22%">${T('Keterangan','Note')}</th>
        <th style="width:110px">${T('Paraf','Signed')}</th>
      </tr></thead>`;
    if(!daftar.length){
      // Sepuluh baris kosong: form yang bisa dicetak dan ditulis tangan
      // — sesuai kebiasaan form dokumen fisik yang ada sekarang.
      const kosong = Array.from({length:10}, (_,i)=>`
        <tr>
          <td class="tengah mono">${i+1}</td>
          <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
        </tr>`).join('');
      return kepala + `<tbody>${kosong}</tbody></table>`;
    }
    return kepala + `<tbody>${daftar.map((k,i)=>`
      <tr>
        <td class="tengah mono">${i+1}</td>
        <td class="mono tengah">${esc(k.tgl ? tglRingkas(k.tgl) : '—')}</td>
        <td><b>${esc(k.judul || '')}</b>${k.rinci ? `<br>${esc(k.rinci)}` : ''}</td>
        <td>${esc(labelTingkat(k.warna))}</td>
        <td>${esc(k.olehNama || '—')}</td>
      </tr>`).join('')}</tbody></table>`;
  };

  /* Satu section per identitas: parent dulu, lalu tiap sub-unitnya
     (kalau ada) — masing-masing dengan identity + tabel sejarahnya
     sendiri, karena sejarah disimpan per-id (alat.id atau sub.id) di
     server. Sub yang belum punya nama sengaja dilewati. */
  const seksiAlat = (a, i, judulTambahan)=>`
    <section class="alat-cetak">
      <h3>${i+1}. ${esc(a.nama || '')}${judulTambahan ? ` — ${esc(judulTambahan)}` : ''}</h3>
      ${spek(a)}
      <div class="alat-cetak-sub">${T('Riwayat Kegiatan','Activity History')}</div>
      ${sejarah(a)}
    </section>`;

  return subJudul + rows.map((a,i)=>{
    const seksi = [seksiAlat(a, i, '')];
    const subs = Array.isArray(a.sub) ? a.sub.filter(s=>s && s.nama) : [];
    subs.forEach((s, si)=>{
      // Nomor sub memakai bentuk "1.1", "1.2", dst — supaya jelas siapa
      // parent-nya waktu satu cetakan berisi banyak alat.
      seksi.push(`
        <section class="alat-cetak sub-cetak">
          <h3>${i+1}.${si+1}. ${esc(a.nama)} — ${esc(s.nama)}</h3>
          ${spek(s)}
          <div class="alat-cetak-sub">${T('Riwayat Kegiatan','Activity History')}</div>
          ${sejarah(s)}
        </section>`);
    });
    return seksi.join('');
  }).join('');
}

/* =======================================================================
   KIRIM KE PEJABAT — jalur teknisi/PIC/adminunit
   ======================================================================= */

/** Bangun snapshot data supaya pejabat melihat lembar persis yang dikirim,
    walau data di database berubah setelahnya. */
function cetakSnapshot(){
  if(CETAK.mode === 'sparepart'){
    const rows = PART.filter(p=>p.unit === CETAK.unit)
                     .sort((a,b)=>(a.nama||'').localeCompare(b.nama||''));
    return { jenis:'sparepart', unit:CETAK.unit, rows };
  }
  if(CETAK.mode === 'dinas'){
    const bulan = JDW.lihat || JDW.bulanIni || bulanKode(new Date());
    const orang = (JDW.jadwalLihat && JDW.jadwalLihat[CETAK.unit]) || [];
    /* format, PIC, tanggal ikut dibekukan supaya lembar yang dibuka
       pejabat dari Kotak Masuk tampil persis seperti yang dikirim.
       Perubahan PIC/tanggal setelah kirim tidak boleh mengubah lembar
       yang sudah antre — itu bagian dari "snapshot", bukan draf. */
    return {
      jenis:  'dinas',
      unit:   CETAK.unit,
      bulan, orang,
      format: CETAK.formatDinas || 'teknik',
      pic1:   CETAK.picNama1 || '',
      pic2:   CETAK.picNama2 || '',
      tanggalCetak: CETAK.tanggalCetak || ''
    };
  }
  if(CETAK.mode === 'peralatan'){
    // Kunci beberapa hal ke waktu tombol Print ditekan supaya lembar yang
    // dilihat pejabat tidak berubah walau daftar dan sejarahnya diubah setelah
    // dikirim: (1) daftar peralatan yang tersaring per grup, (2) seluruh
    // sejarah tiap alat + sub-nya. Bentuk barisnya persis seperti struktur
    // di PERALATAN/SJR — cetakIsiSnapshotHtml membacanya apa adanya.
    const semua = (PERALATAN[CETAK.unit] || []).slice()
                    .sort((a,b)=>(a.nama||'').localeCompare(b.nama||''));
    const rows = (CETAK.grup ? semua.filter(a=>(a.grup || '') === CETAK.grup) : semua)
      .map(a=>({
        ...a,
        sejarah: (typeof sjrUntuk === 'function') ? sjrUntuk(CETAK.unit, a.id) : [],
        sub: (Array.isArray(a.sub) ? a.sub : []).map(s=>({
          ...s,
          sejarah: (typeof sjrUntuk === 'function') ? sjrUntuk(CETAK.unit, s.id) : []
        }))
      }));
    return {
      jenis:      'peralatan',
      unit:       CETAK.unit,
      grup:       CETAK.grup || '',
      totalSemua: semua.length,
      rows
    };
  }
  return { jenis:CETAK.mode, unit:CETAK.unit };
}

async function cetakKirimKePejabat(){
  if(!CETAK.pejabatDipilih){
    pesan(T('Pilih pejabat penerima dulu sebelum mengirim.',
            'Pick the receiving officer first.'));
    return;
  }
  const tombol = el('btnLakukanCetak');
  if(tombol){ tombol.disabled = true; tombol.textContent = T('Mengirim…','Sending…'); }

  try{
    /* Kalau pembuat baru saja menggambar TTD-nya sendiri (belum
       tersimpan), simpan dulu ke E-Logbook supaya lembar yang dilihat
       pejabat sudah membawa TTD pembuat. Kanvas pejabat tidak ada di
       jalur ini — sengaja: menggambar atas nama pejabat bukan hak
       teknisi. */
    if(CETAK.kanvasSaya && CETAK.kanvasSaya.ada){
      await srvApi('simpanTtdSaya', {
        dataUrl: CETAK.kanvasSaya.el.toDataURL('image/png'), slotIdx: 0
      });
      ttdAkunInvalidate(akun.user);
      CETAK.ttdSaya = await ttdAkunAmbil(akun.user, { paksa:true }).catch(()=>CETAK.ttdSaya);
    }

    const pejabat = CETAK.pejabat.find(p=>p.username === CETAK.pejabatDipilih) || {};
    const catatan = (el('cetakCatatan')?.value || '').trim();
    const badan = {
      jenis:       CETAK.mode,
      unit:        CETAK.unit,
      bulan:       CETAK.mode === 'dinas' ? (JDW.lihat || JDW.bulanIni || bulanKode(new Date())) : '',
      pejabatUser: CETAK.pejabatDipilih,
      pejabatNama: pejabat.nama || CETAK.pejabatDipilih,
      snapshot:    cetakSnapshot(),
      catatan
    };

    const jawab = await fetch('/cetak-antrian', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(badan)
    });
    const j = await jawab.json().catch(()=>({}));
    if(!jawab.ok) throw new Error(j.error || `HTTP ${jawab.status}`);

    el('lapisCetak').classList.remove('buka');
    pesan(T(`Permintaan cetak dikirim ke ${badan.pejabatNama}. Pantau statusnya di Kotak Masuk.`,
            `Print request sent to ${badan.pejabatNama}. Track its status in the Inbox.`));
    // Refresh badge kotak masuk kalau ada.
    if(typeof muatAntrianCetak === 'function') muatAntrianCetak().then(()=>gambarKotakMasuk?.());
  }catch(e){
    console.error('[cetak] gagal kirim:', e);
    pesan(T('Gagal mengirim permintaan: ','Failed to send request: ') + (e && e.message || e));
  }finally{
    if(tombol){ tombol.disabled = false; tombol.textContent = T('Kirim untuk disetujui','Send for approval'); }
  }
}

/* =======================================================================
   REVIEW PEJABAT — dipanggil dari kotak masuk saat pejabat klik permintaan
   ======================================================================= */

/** Pasang keadaan CETAK dari permintaan tersimpan lalu bangun kartu
    setuju/tolak. Dipanggil 27-kotak-masuk.js saat pejabat membuka baris. */
async function cetakBukaPermintaan(permintaan){
  if(!permintaan) return;
  CETAK.mode = permintaan.jenis;
  CETAK.unit = permintaan.unit;
  CETAK.pejabatDipilih = permintaan.pejabatUser;
  CETAK.serahkanKePejabat = false;   // pejabat SEDANG membuka — tidak perlu serah lagi
  CETAK._permintaan = permintaan;    // dipakai cetakSetujui / cetakTolak
  CETAK._snapshot = permintaan.snapshot || null;

  /* TTD tiga pihak yang mungkin tampil di lembar Dinas:
       · ttdPejabat  — Manager Teknik (kiri, "Menyetujui")
       · ttdDeputy   — Deputy Manager Teknik (kanan, "Mengetahui")
       · ttdSaya     — akun yang sedang menandatangani saat ini (untuk panel
                       canvas TTD). Boleh MT atau Deputy, tergantung status. */
  CETAK.ttdPejabat = null;
  CETAK.ttdDeputy = null;
  CETAK.ttdSaya = null;
  CETAK.deputyDipilih = permintaan.deputyUser || null;
  CETAK.pejabat = [];   // dimuat di bawah — dipakai dropdown pilih Deputy

  /* Buka modal DULU, baru gambar isinya — kalau builder isi crash
     (mis. snapshot rusak), modalnya tetap muncul dengan pesan error,
     bukan menghilang tanpa jejak. */
  el('lapisCetak').classList.add('buka');
  try{
    cetakKartuReviewGambar();
  }catch(e){
    console.error('[cetak] gagal menggambar kartu review:', e);
    const badan = el('badanKartuCetak');
    if(badan) badan.innerHTML = `<div class="cetak-ket awas">${
      esc(T('Gagal menampilkan permintaan: ','Failed to show request: ') + (e && e.message || e))}</div>`;
  }

  try{
    const [ttdPejabat, ttdDeputy, ttdSaya, pejabatList, hakCetak] = await Promise.all([
      ttdAkunAmbil(permintaan.pejabatUser).catch(()=>({ada:false})),
      permintaan.deputyUser
        ? ttdAkunAmbil(permintaan.deputyUser).catch(()=>({ada:false}))
        : Promise.resolve(null),
      ttdAkunAmbil(akun.user).catch(()=>({ada:false})),
      /* Daftar pejabat unit — dipakai dropdown Deputy MT saat Manager
         Teknik akan meneruskan permintaan. Kegagalannya tidak menggagalkan
         apa-apa, hanya membuat dropdown kosong. */
      srvApi('listPejabatUnit', permintaan.unit).catch(e=>{
        console.warn('[cetak] listPejabatUnit gagal:', e && e.message || e);
        return [];
      }),
      /* Whitelist per jenis (`ditunjuk`) + bolehTtd per akun — sama seperti
         di cetakBuka, supaya dropdown Deputy MT hanya berisi pejabat yang
         berhak menandatangani jenis dokumen ini. Tanpa penyaringan ini
         seluruh pejabat unit muncul, padahal admin sudah menunjuk hanya
         satu-dua orang di layar Hak Akses. */
      srvFetch('/pejabat-hak-cetak', {}, 8000)
        .then(r=>r.ok ? r.json() : null)
        .catch(e=>{ console.warn('[cetak] /pejabat-hak-cetak gagal:', e && e.message || e); return null; })
    ]);
    CETAK.ttdPejabat = ttdPejabat;
    CETAK.ttdDeputy = ttdDeputy;
    CETAK.ttdSaya = ttdSaya;
    CETAK.pejabat = Array.isArray(pejabatList) ? pejabatList : [];
    if(!CETAK.pejabat.length){
      const semua = await srvApi('listPejabatAktif').catch(()=>[]);
      CETAK.pejabat = Array.isArray(semua) ? semua : [];
    }
    /* Saring CETAK.pejabat dengan pola yang sama seperti cetakBuka:
       whitelist per jenis dulu, lalu bolehTtd per akun (aturan ketat).
       Kalau tidak ada Deputy yang berhak, dropdown Deputy hanya berisi
       "belum dipilih" — MT masih bisa finalisasi tanpa Deputy. */
    if(hakCetak){
      const modeKeModulTtd = { dinas:'dinas-ttd', sparepart:'sparepart-ttd', peralatan:'sejarah-ttd' };
      const modulTtd = modeKeModulTtd[permintaan.jenis];
      const ditunjuk = (modulTtd && Array.isArray(hakCetak.ditunjuk?.[modulTtd])) ? hakCetak.ditunjuk[modulTtd] : [];
      if(ditunjuk.length){
        const set = new Set(ditunjuk.map(n=>String(n).toLowerCase()));
        const saring = CETAK.pejabat.filter(p=>set.has(String(p.username).toLowerCase()));
        if(saring.length) CETAK.pejabat = saring;
        else console.warn(`[cetak] Whitelist ${modulTtd} tidak menyisakan pejabat aktif di unit ini — memakai daftar penuh.`);
      }
      const petaBoleh = (hakCetak.pejabatTtd && typeof hakCetak.pejabatTtd === 'object') ? hakCetak.pejabatTtd : {};
      CETAK.pejabat = CETAK.pejabat.filter(p=>{
        const b = petaBoleh[String(p.username).toLowerCase()];
        return Array.isArray(b) && b.includes(permintaan.jenis);
      });
    }
    cetakKartuReviewGambar();
  }catch(e){ console.warn('[cetak] gagal memuat TTD review:', e); }
}

function cetakKartuReviewGambar(){
  const p = CETAK._permintaan; if(!p) return;
  const u = infoUnit(p.unit);
  const kepJudul = el('judulKartuCetak');
  if(kepJudul){
    kepJudul.textContent = T('Detail Permintaan Cetak','Print Request Detail');
  }
  const saya = String(akun.user || '').toLowerCase();
  /* Dua peran penandatangan yang mungkin — Manager Teknik (yang menerima
     permintaan awal) dan Deputy MT (yang menerima setelah MT meneruskan,
     khusus jenis 'dinas'). Yang ada di tangan saya sekarang menentukan
     tombol dan panel TTD yang tampil. */
  const sayaMT = saya === p.pejabatUser;
  const sayaDeputy = !!p.deputyUser && saya === p.deputyUser;
  const menungguMT = p.status === 'menunggu';
  const menungguDeputy = p.status === 'menunggu-deputy';
  const giliranSaya = (sayaMT && menungguMT) || (sayaDeputy && menungguDeputy);

  const jenisNama = CETAK_JUDUL[p.jenis]?.() || p.jenis;
  const bulanTag = p.jenis === 'dinas' && p.bulan ? ' · ' + namaBulan(p.bulan) : '';
  const statusRupa = p.status === 'disetujui' ? 'aman'
                   : p.status === 'ditolak' ? 'bahaya' : 'awas';
  const statusTeks = p.status === 'disetujui' ? T('Sudah Disetujui','Approved')
                   : p.status === 'ditolak' ? T('Ditolak','Rejected')
                   : menungguDeputy ? T('Menunggu TTD Deputy','Awaiting Deputy Signature')
                   : T('Menunggu TTD Anda','Awaiting Your Signature');

  const badan = el('badanKartuCetak');
  const badanHtml = `
    <div class="cetak-review-cip">
      <span class="cip ${statusRupa}">${esc(statusTeks.toUpperCase())}</span>
      <span class="cip">${esc(jenisNama.toUpperCase())}</span>
      <span class="cip">${esc((u && u.nama || p.unit).toUpperCase())}${esc(bulanTag.toUpperCase())}</span>
      <span class="cip">${esc(cetakWaktuRingkas(p.tanggalKirim))}</span>
    </div>

    <div class="cetak-review-sek">
      <div class="cetak-review-lab">${T('ISI LEMBAR YANG AKAN DI-TTD','SHEET CONTENT TO BE SIGNED')}</div>
      <div class="cetak-pratinjau">
        <div class="cetak-lembar${p.jenis === 'dinas' ? ' lanskap' : ''}">${cetakIsiSnapshotHtml(p, CETAK._snapshot || {})}</div>
      </div>
    </div>

    ${p.catatan ? `<div class="cetak-review-sek">
      <div class="cetak-review-lab">${T('CATATAN DARI PEMBUAT','NOTE FROM SUBMITTER')}</div>
      <div class="cetak-review-catatan">${esc(p.catatan)}</div>
    </div>` : ''}

    <div class="cetak-review-orang">
      <div>
        <div class="cetak-review-lab">${T('PEMBUAT','SUBMITTED BY')}</div>
        <div class="cetak-review-nama">${esc(p.pembuatNama || p.pembuatUser)}</div>
        <div class="cetak-review-sub">${esc(p.pembuatUser)}</div>
      </div>
      <div>
        <div class="cetak-review-lab">${p.jenis === 'dinas' ? T('MANAGER TEKNIK','TECHNICAL MANAGER') : T('MENGETAHUI','APPROVED BY')}</div>
        <div class="cetak-review-nama">${esc(p.pejabatNama || p.pejabatUser)}</div>
        <div class="cetak-review-sub">${esc(p.pejabatUser)}</div>
        ${sayaMT && menungguMT ? `<div class="cetak-review-sub" style="color:var(--accent);margin-top:4px">${
          T('— Anda pengesahnya','— You are the approver')}</div>` : ''}
        ${p.tanggalTtd && p.status !== 'menunggu' ? `<div class="cetak-review-sub" style="color:var(--ok);margin-top:4px">${
          T('✓ ditandatangani ','✓ signed ') + esc(cetakWaktuRingkas(p.tanggalTtd))}</div>` : ''}
      </div>
      ${p.jenis === 'dinas' && (p.deputyUser || menungguMT) ? `<div>
        <div class="cetak-review-lab">${T('MENGETAHUI (DEPUTY MT)','ACKNOWLEDGED (DEPUTY MT)')}</div>
        <div class="cetak-review-nama">${esc(p.deputyNama || p.deputyUser || '—')}</div>
        ${p.deputyUser ? `<div class="cetak-review-sub">${esc(p.deputyUser)}</div>` : `<div class="cetak-review-sub" style="font-style:italic;color:var(--muted)">${
          T('(dipilih MT saat menandatangani)','(chosen by MT when signing)')}</div>`}
        ${sayaDeputy && menungguDeputy ? `<div class="cetak-review-sub" style="color:var(--accent);margin-top:4px">${
          T('— Anda pengesahnya','— You are the approver')}</div>` : ''}
        ${p.tanggalTtdDeputy ? `<div class="cetak-review-sub" style="color:var(--ok);margin-top:4px">${
          T('✓ ditandatangani ','✓ signed ') + esc(cetakWaktuRingkas(p.tanggalTtdDeputy))}</div>` : ''}
      </div>` : ''}
    </div>

    ${sayaMT && menungguMT && p.jenis === 'dinas' ? `
      <div class="cetak-review-sek" style="margin-top:16px">
        <div class="cetak-review-lab">${T('PILIH DEPUTY MANAGER TEKNIK','PICK DEPUTY MANAGER TEKNIK')}</div>
        <div class="cetak-ket">${T(
          'Untuk "Setujui & Kirim": setelah TTD Anda dibubuhkan, permintaan diteruskan ke akun ini untuk tanda tangan Mengetahui. Kosongkan kalau mau finalisasi tanpa Deputy — pakai "Setujui & Cetak".',
          'For "Approve & Send": after your signature is stamped, the request is forwarded to this account for the Acknowledged signature. Leave empty to finalize without Deputy — use "Approve & Print".')}</div>
        <select id="cetakPilihDeputy" style="width:100%;background:var(--panel-2);color:var(--text);border:1px solid var(--line);border-radius:8px;padding:8px 10px;font-size:12.5px;margin-top:8px">
          <option value="">— ${T('belum dipilih','not chosen')} —</option>
          ${(CETAK.pejabat || []).filter(x=>x.username !== p.pejabatUser).map(x=>
            `<option value="${esc(x.username)}" data-nama="${esc(x.nama || x.username)}">${
              esc(x.nama || x.username)} · ${esc(x.username)}</option>`).join('')}
        </select>
      </div>
    ` : ''}

    ${giliranSaya ? `
      <div class="cetak-review-sek" style="margin-top:16px">
        <div class="cetak-review-lab">${T('TANDA TANGAN ANDA','YOUR SIGNATURE')}</div>
        <div class="cetak-ket">${T(
          'Setujui akan memasang TTD tersimpan Anda pada lembar di atas. Kalau belum punya TTD tersimpan, gambar sekali di kotak di bawah — tersimpan permanen di E-Logbook.',
          'Approving stamps your saved signature onto the sheet above. No saved signature yet? Draw once below — kept permanently in E-Logbook.')}</div>
        ${blokTtdOrang(CETAK.ttdSaya || {ada:false}, {
          untukDiri: true, bolehGambar: true, idKanvas: 'cetakTtdKanvasSaya'
        })}
      </div>
    ` : ''}
  `;
  if(badan) badan.innerHTML = badanHtml;

  const btnCetak = el('btnLakukanCetak');
  const btnKirim = el('btnSetujuiKirim');
  if(btnCetak){
    btnCetak.disabled = false;
    if(giliranSaya){
      /* MT atau Deputy sedang bertanda tangan → tombol utama "Setujui &
         Cetak" langsung memfinalisasi + cetak. Untuk MT di dinas ini
         berarti melewati Deputy (mis. urgensi); tombol "Setujui & Kirim"
         di sampingnya untuk alur normal yang meneruskan ke Deputy. */
      btnCetak.textContent = T('Setujui & Cetak','Approve & Print');
      btnCetak.onclick = cetakSetujuiLaluCetak;
    }else if(p.status === 'disetujui'){
      btnCetak.textContent = T('Cetak / Simpan PDF','Print / Save PDF');
      btnCetak.onclick = ()=>cetakDariPermintaan(p);
    }else{
      btnCetak.disabled = true;
      btnCetak.textContent = T('Cetak','Print');
    }
  }
  if(btnKirim){
    /* Tombol Setujui & Kirim tampil HANYA di kartu review MT untuk dinas
       menunggu — meneruskan permintaan ke Deputy MT untuk tanda tangan
       "Mengetahui". */
    const tampil = sayaMT && menungguMT && p.jenis === 'dinas';
    btnKirim.hidden = !tampil;
    if(tampil){
      btnKirim.textContent = T('Setujui & Kirim','Approve & Send');
      btnKirim.onclick = cetakTeruskanKeDeputy;
    }else{
      btnKirim.onclick = null;
    }
  }
  cetakPasangKartu();
}

/**
 * Manager Teknik menandatangani lalu meneruskan Jadwal Dinas ke Deputy MT.
 *
 * Alur:
 *   1. Baca Deputy yang dipilih dari dropdown #cetakPilihDeputy — kosong
 *      berarti MT lupa memilih; hentikan dengan pesan.
 *   2. Kalau MT baru saja menggambar TTD di canvas (belum tersimpan),
 *      simpan dulu ke E-Logbook (jalur yang sama dengan cetakSetujuiLaluCetak).
 *   3. POST /cetak-antrian/:id/teruskan — server menyimpan TTD MT +
 *      mengatur Deputy sebagai penerima berikut + status='menunggu-deputy'.
 *   4. Modal ditutup; refresh kotak masuk.
 */
async function cetakTeruskanKeDeputy(){
  const p = CETAK._permintaan; if(!p) return;
  const dropdown = el('cetakPilihDeputy');
  const deputyUser = dropdown ? String(dropdown.value || '').trim() : '';
  if(!deputyUser){
    pesan(T('Pilih dulu Deputy Manager Teknik yang menerima permintaan ini.',
            'Pick the Deputy Manager Teknik receiving this request first.'));
    if(dropdown) dropdown.focus();
    return;
  }
  const opt = dropdown.querySelector(`option[value="${deputyUser.replace(/"/g,'\\"')}"]`);
  const deputyNama = opt ? (opt.dataset.nama || opt.textContent) : deputyUser;

  const tombol = el('btnSetujuiKirim');
  if(tombol){ tombol.disabled = true; tombol.textContent = T('Mengirim…','Sending…'); }
  try{
    /* TTD MT yang baru digambar (belum tersimpan) — simpan dulu ke E-Logbook. */
    if(CETAK.kanvasSaya && CETAK.kanvasSaya.ada){
      await srvApi('simpanTtdSaya', {
        dataUrl: CETAK.kanvasSaya.el.toDataURL('image/png'), slotIdx: 0
      });
      ttdAkunInvalidate(akun.user);
      CETAK.ttdSaya = await ttdAkunAmbil(akun.user, { paksa:true }).catch(()=>CETAK.ttdSaya);
    }
    const jawab = await fetch(`/cetak-antrian/${encodeURIComponent(p.id)}/teruskan`, {
      method:'POST', credentials:'include',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ deputyUser, deputyNama })
    });
    const j = await jawab.json().catch(()=>({}));
    if(!jawab.ok) throw new Error(j.error || `HTTP ${jawab.status}`);

    el('lapisCetak').classList.remove('buka');
    pesan(T(`TTD Anda dibubuhkan. Permintaan diteruskan ke ${deputyNama} sebagai Mengetahui.`,
            `Your signature was stamped. Request forwarded to ${deputyNama} as Acknowledged.`));
    if(typeof muatAntrianCetak === 'function') muatAntrianCetak().then(()=>gambarKotakMasuk?.());
  }catch(e){
    console.error('[cetak] teruskan gagal:', e);
    pesan(T('Gagal meneruskan: ','Forward failed: ') + (e && e.message || e));
    if(tombol){ tombol.disabled = false; tombol.textContent = T('Setujui & Kirim','Approve & Send'); }
  }
}

async function cetakSetujuiLaluCetak(){
  const p = CETAK._permintaan; if(!p) return;
  const tombol = el('btnLakukanCetak');
  if(tombol){ tombol.disabled = true; tombol.textContent = T('Menyetujui…','Approving…'); }
  try{
    /* Kalau pejabat baru gambar TTD-nya sekarang — simpan dulu ke
       E-Logbook, lalu panaskan singgahannya. Yang menyetel bisa MT
       (menunggu) atau Deputy (menunggu-deputy) — sama-sama akun.user. */
    if(CETAK.kanvasSaya && CETAK.kanvasSaya.ada){
      await srvApi('simpanTtdSaya', {
        dataUrl: CETAK.kanvasSaya.el.toDataURL('image/png'), slotIdx: 0
      });
      ttdAkunInvalidate(akun.user);
      CETAK.ttdSaya = await ttdAkunAmbil(akun.user, { paksa:true }).catch(()=>CETAK.ttdSaya);
      /* Kalau saya MT dan menandatangani sekarang, TTD MT untuk lembar
         cetak juga jadi TTD tersimpan yang barusan dibuat. */
      if(String(akun.user).toLowerCase() === p.pejabatUser) CETAK.ttdPejabat = CETAK.ttdSaya;
      if(p.deputyUser && String(akun.user).toLowerCase() === p.deputyUser) CETAK.ttdDeputy = CETAK.ttdSaya;
    }
    const jawab = await fetch(`/cetak-antrian/${encodeURIComponent(p.id)}/setujui`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const j = await jawab.json().catch(()=>({}));
    if(!jawab.ok) throw new Error(j.error || `HTTP ${jawab.status}`);

    CETAK._permintaan = j.permintaan;
    pesan(T('Disetujui. Lembar akan dicetak.','Approved. The sheet will be printed.'));
    await cetakDariPermintaan(j.permintaan);
    if(typeof muatAntrianCetak === 'function') muatAntrianCetak().then(()=>gambarKotakMasuk?.());
    // Kalau lembar yang barusan diteken adalah Sejarah Peralatan, arsip
    // untuk unitnya perlu ditarik ulang — supaya kalau officer juga
    // sedang membuka layar Peralatan unit itu, panel Arsip di bawahnya
    // langsung memasukkan baris baru tanpa reload.
    if(j.permintaan && j.permintaan.jenis === 'peralatan'
       && j.permintaan.unit === unitDibuka){
      muatArsipCetak(j.permintaan.unit);
    }
  }catch(e){
    console.error('[cetak] setujui gagal:', e);
    pesan(T('Gagal menyetujui: ','Approval failed: ') + (e && e.message || e));
    if(tombol){ tombol.disabled = false; tombol.textContent = T('Setujui & Cetak','Approve & Print'); }
  }
}

/* ---------- Arsip lembar cetak Sejarah Peralatan per unit ----------
   Kotak di bawah kartu peralatan yang menampilkan lembar-lembar yang sudah
   diteken officer. Isinya dibaca dari /cetak-arsip/:unit; setiap barisnya
   punya tombol Cetak yang memakai jalur cetakDariPermintaan() yang sama
   dengan tombol Cetak officer di kotak masuknya — jadi hasil di kertas
   sama persis dengan yang di-approve.

   Panelnya dibiarkan kosong sampai jawaban server datang. Kalau akun ini
   tidak boleh melihat unit itu, server jawab 403 dan panel tetap kosong
   diam-diam (tidak ada informasi yang lolos). */
const ARSIP_CETAK = {};   // unit -> [permintaan disetujui]

async function muatArsipCetak(unit){
  try{
    const r = await srvFetch(`/cetak-arsip/${encodeURIComponent(unit)}`, {}, 10000);
    const j = await r.json().catch(()=>null);
    if(r.ok && j && Array.isArray(j.arsip)){
      ARSIP_CETAK[unit] = j.arsip;
    }else{
      ARSIP_CETAK[unit] = [];
    }
  }catch(e){
    ARSIP_CETAK[unit] = [];
  }
  gambarArsipCetak(unit);
}

function gambarArsipCetak(unit){
  const kotak = el('arsipCetak'); if(!kotak) return;
  const arsip = ARSIP_CETAK[unit] || [];
  if(!arsip.length){
    // Panel kosong dilempar dengan kalimat pendek supaya orang tahu
    // "tempat ini memang ada, tapi belum ada isinya" — bukan area rusak.
    kotak.innerHTML = `<div class="panel"><div class="kepala"><h3>${
      T('Arsip Lembar Cetak','Approved Print Archive')}</h3></div>
      <div class="badan" style="color:var(--muted);font-size:12.5px;line-height:1.7">${T(
        'Belum ada lembar Sejarah Peralatan yang sudah ditandatangani officer di unit ini. Lembar akan muncul di sini setelah pejabat menyetujui permintaan cetak dari Kotak Masuk.',
        'No signed Equipment History sheets yet in this unit. Sheets appear here after an officer approves a print request in their Inbox.')}
      </div></div>`;
    return;
  }
  kotak.innerHTML = `<div class="panel"><div class="kepala"><h3>${
    T('Arsip Lembar Cetak','Approved Print Archive')}</h3>
    <span class="ket">${arsip.length} ${T('lembar tersedia · terbaru di atas',
                                          'sheets available · newest first')}</span></div>
    <div class="badan"><table class="arsip-cetak">
      <thead><tr>
        <th style="width:110px">${T('Diteken','Signed on')}</th>
        <th>${T('Catatan pembuat','Requester note')}</th>
        <th style="width:170px">${T('Diminta oleh','Requested by')}</th>
        <th style="width:170px">${T('Diteken oleh','Signed by')}</th>
        <th style="width:90px;text-align:right">${T('Aksi','Action')}</th>
      </tr></thead>
      <tbody>${arsip.map(p=>{
        const tgl = p.tanggalTtd
          ? new Date(p.tanggalTtd).toLocaleString(LOKAL(), {
              day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'
            })
          : '—';
        const grup = p.snapshot && p.snapshot.grup;
        const catatan = p.catatan
          ? esc(p.catatan)
          : `<span style="color:var(--muted);font-style:italic">${T('(tanpa catatan)','(no note)')}</span>`;
        return `<tr>
          <td class="mono">${esc(tgl)}</td>
          <td>${catatan}${grup ? ` <span class="mono" style="color:var(--muted);font-size:10.5px">· ${T('grup','group')} ${esc(grup)}</span>` : ''}</td>
          <td>${esc(p.pembuatNama || p.pembuatUser || '—')}</td>
          <td>${esc(p.ttdPejabatNama || p.pejabatNama || p.pejabatUser || '—')}</td>
          <td style="text-align:right">
            <button class="btn garis kecil" data-arsip-cetak="${esc(p.id)}">${T('Cetak','Print')}</button>
          </td>
        </tr>`;
      }).join('')}</tbody>
    </table></div></div>`;

  // Pendengar tombol Cetak — pakai delegasi supaya tidak menumpuk saat
  // panel digambar ulang.
  kotak.querySelectorAll('[data-arsip-cetak]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const p = arsip.find(x=>x.id === b.dataset.arsipCetak);
      if(p) cetakDariPermintaan(p);
    });
  });
}

async function cetakDariPermintaan(p){
  /* Snapshot dipasang sebagai keadaan cetak SEMENTARA, lalu HTML lembar
     dibangun dari builder yang sama seperti cetak langsung. Setelah
     dialog cetak selesai, keadaan aslinya (bulan yang sedang dibuka)
     tidak berubah karena kita tidak menyentuh PART/JDW. */
  const asal = { mode:CETAK.mode, unit:CETAK.unit, ttdSaya:CETAK.ttdSaya, ttdPejabat:CETAK.ttdPejabat };
  CETAK.mode = p.jenis;
  CETAK.unit = p.unit;
  const snap = p.snapshot || {};

  /* Untuk lembar cetak: "Dibuat oleh" = pembuat, "Mengetahui" = pejabat.
     Kedua TTD diambil dari E-Logbook (salinan lokal /ttd-akun/:user/gambar). */
  CETAK.ttdSaya    = await ttdAkunAmbil(p.pembuatUser).catch(()=>({ada:false}));
  CETAK.ttdPejabat = await ttdAkunAmbil(p.pejabatUser).catch(()=>({ada:false}));

  /* Nama pembuat & pejabat khusus untuk lembar ini — bukan akun login. */
  const akunAsli = akun;
  akun = { ...akun, _lembar: true };   // penanda supaya tak salah pakai di tempat lain
  const html = await cetakLembarPermintaanHtml(p, snap);
  akun = akunAsli;

  const area = el('printArea');
  area.innerHTML = html;
  // Snapshot dinas juga lanskap satu halaman — sepadan dengan cetak
  // langsung (lakukanCetak). Snapshot lain (peralatan/sparepart) tetap potret.
  area.classList.toggle('lanskap', p.jenis === 'dinas');
  pasangOrientasiCetak(p.jenis === 'dinas' ? 'landscape' : null);
  const imgs = Array.from(area.querySelectorAll('img[data-perlu-hitam]'));
  await Promise.all(imgs.map(async img=>{
    try{
      await new Promise((res, rej)=>{
        if(img.complete && img.naturalWidth) return res();
        img.onload = res; img.onerror = rej;
        setTimeout(res, 3000);
      });
      const baru = ttdKeHitam(img);
      if(baru) img.src = baru;
    }catch{ /* biarkan */ }
  }));
  el('lapisCetak').classList.remove('buka');
  setTimeout(()=>{
    window.print();
    setTimeout(()=>{
      area.innerHTML = '';
      area.classList.remove('lanskap');
      pasangOrientasiCetak(null);
      Object.assign(CETAK, asal);
    }, 500);
  }, 200);
}

/** Bangun bagian isi lembar (tabel sparepart / matriks dinas) dari
    snapshot. Dipakai baik oleh lembar cetak final maupun pratinjau di
    kartu review pejabat — supaya keduanya menampilkan tabel yang persis
    sama, dan pejabat tahu apa yang mereka TTD-i. */
function cetakIsiSnapshotHtml(p, snap){
  if(p.jenis === 'sparepart'){
    const rows = Array.isArray(snap.rows) ? snap.rows : [];
    return rows.length ? `
      <table class="data">
        <thead><tr>
          <th style="width:32px">${T('No','No')}</th>
          <th>${T('Sparepart','Spare Part')}</th>
          <th style="width:32%">Part Number</th>
          <th style="width:70px">${T('Rak','Rack')}</th>
          <th style="width:60px" class="tengah">${T('Stok','Stock')}</th>
          <th style="width:52px" class="tengah">${T('Min','Min')}</th>
          <th style="width:60px">${T('Satuan','Unit')}</th>
          <th style="width:82px">${T('Dipakai','Last used')}</th>
        </tr></thead>
        <tbody>${rows.map((r,i)=>`
          <tr>
            <td class="tengah mono">${i+1}</td>
            <td>${esc(r.nama || '')}</td>
            <td class="mono">${esc(r.pn || '')}</td>
            <td class="mono">${esc(r.rak || '')}</td>
            <td class="tengah mono">${Number(r.stok)||0}</td>
            <td class="tengah mono">${Number(r.min)||0}</td>
            <td>${esc(r.satuan || '')}</td>
            <td class="mono">${esc(tglRingkas(r.pakai) || '—')}</td>
          </tr>`).join('')}</tbody></table>`
      : `<div style="text-align:center;font-style:italic;padding:12pt 0">${
        T('Belum ada sparepart terdaftar.','No spare parts registered.')}</div>`;
  }
  if(p.jenis === 'dinas'){
    const bulan = snap.bulan || p.bulan;
    const orang = Array.isArray(snap.orang) ? snap.orang : [];
    if(!bulan || !/^\d{4}-\d{2}$/.test(String(bulan))){
      return `<div style="text-align:center;font-style:italic;padding:12pt 0">${
        T('Snapshot bulan tidak sah — permintaan ini mungkin dibuat versi lama.',
          'Snapshot month is invalid — this request may have been created by an older version.')}</div>`;
    }
    const hariN = jumlahHari(bulan);
    const hariMinggu = (h)=>{
      const d = new Date(Number(bulan.slice(0,4)), Number(bulan.slice(5,7))-1, h);
      return d.getDay();
    };
    const kepalaHari = Array.from({length:hariN}, (_,i)=>{
      const h = i + 1;
      const libur = hariMinggu(h) === 0;
      return `<th class="${libur?'hari-libur':''}">${h}</th>`;
    }).join('');
    /* Format dibawa oleh snapshot supaya lembar yang dilihat pejabat sama
       dengan yang dikirim teknisi — bukan diambil dari CETAK.formatDinas
       (yang sudah kosong sekali kotak masuk ditutup). Kalau tidak ada,
       jatuh ke 'teknik' (kode apa adanya) — itu perilaku lama. */
    const pum = snap.format === 'pum';
    const barisOrang = orang.length ? orang.map((o,idx)=>`
      <tr>
        <td class="no">${idx + 1}</td>
        <td class="nama">${esc(o.nama || '')}</td>
        <td class="nik">${esc(o.nik || '—')}</td>
        ${Array.from({length:hariN}, (_,i)=>{
          const asli = (o.hari || [])[i] || '';
          const nilai = pum ? dinasKodePUM(asli) : asli;
          const libur = hariMinggu(i+1) === 0;
          return `<td class="${libur?'hari-libur':''}">${esc(nilai) || '·'}</td>`;
        }).join('')}
      </tr>`).join('') : `
      <tr><td colspan="${hariN + 3}" style="text-align:center;padding:8pt;font-style:italic">${
        T('Belum ada jadwal.','No roster.')}</td></tr>`;
    return `
      <table class="data jdw">
        <thead><tr>
          <th style="width:26px">${T('No','No')}</th>
          <th style="width:130px">${T('Nama','Name')}</th>
          <th style="width:90px">NIK</th>
          ${kepalaHari}
        </tr></thead>
        <tbody>${barisOrang}</tbody></table>`;
  }
  if(p.jenis === 'peralatan'){
    // Lembar Peralatan dari snapshot — bentuknya sepadan dengan htmlPeralatan
    // yang dipakai pejabat saat mencetak langsung. Bedanya: sejarah datang
    // dari snapshot (row.sejarah / sub.sejarah), bukan SJR yang terbaca live,
    // supaya lembar yang dilihat pejabat persis sama dengan yang dikirim
    // teknisi. Layoutnya mengikuti form docx Sejarah Peralatan.
    const rows = Array.isArray(snap.rows) ? snap.rows : [];
    const u = infoUnit(p.unit);
    const kelompok = u.alat || u.nama || '';
    const subJudul = `<div style="text-align:center;font-size:10pt;margin:-6pt 0 10pt;color:#555">${
      snap.grup
        ? `${T('Grup lokasi','Location group')}: <b>${esc(snap.grup)}</b> · ${rows.length} ${
            T('peralatan dari','equipment of')} ${snap.totalSemua || rows.length}`
        : `${T('Seluruh grup lokasi','All location groups')} · ${rows.length} ${
            T('peralatan','equipment')}`}</div>`;

    const spek = (a)=>{
      const pokok = [
        [T('Penyelenggara Pelayanan','Service Provider'),  'Perum LPPNPI'],
        [T('Kelompok Fasilitas','Facility Group'),          kelompok],
        [T('Nama Peralatan','Equipment Name'),              a.nama || ''],
        [T('Merek dan Tipe Peralatan','Make and Type'),
          [a.merk, a.tipe].filter(x=>x && x !== '—').join(' — ')],
        [T('Nomor Seri Peralatan','Serial Number'),         a.sn || '']
      ];
      const tambahan = [
        ['Part Number (P/N)',                               a.pn],
        [T('Tahun Pembuatan','Year of Manufacture'),        a.tahun],
        [T('Lokasi','Location'),                            a.lokasi],
        [T('Status','Status'),                              a.status || '']
      ].filter(([,v])=>v && v !== '—');
      return `<table class="spek-cetak">${
        pokok.concat(tambahan).map(([k,v])=>
          `<tr><td>${esc(k)}</td><td>: ${esc(v || '—')}</td></tr>`).join('')
      }</table>`;
    };

    const labelTingkat = (w)=>{
      const pw = (typeof SJR_WARNA !== 'undefined')
        ? SJR_WARNA.find(x=>x[0]===(w||'')) : null;
      const n = pw ? pw[1] : ['','—'];
      return T(n[0], n[1]);
    };
    const sejarahTabel = (daftar)=>{
      const kepala = `<table class="data sjr-tabel">
        <thead><tr>
          <th style="width:28px" class="tengah">${T('No','No')}</th>
          <th style="width:78px" class="tengah">${T('Tanggal','Date')}</th>
          <th>${T('Uraian','Description')}</th>
          <th style="width:22%">${T('Keterangan','Note')}</th>
          <th style="width:110px">${T('Paraf','Signed')}</th>
        </tr></thead>`;
      if(!Array.isArray(daftar) || !daftar.length){
        const kosong = Array.from({length:10}, (_,i)=>`
          <tr>
            <td class="tengah mono">${i+1}</td>
            <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
          </tr>`).join('');
        return kepala + `<tbody>${kosong}</tbody></table>`;
      }
      return kepala + `<tbody>${daftar.map((k,i)=>`
        <tr>
          <td class="tengah mono">${i+1}</td>
          <td class="mono tengah">${esc(k.tgl ? tglRingkas(k.tgl) : '—')}</td>
          <td><b>${esc(k.judul || '')}</b>${k.rinci ? `<br>${esc(k.rinci)}` : ''}</td>
          <td>${esc(labelTingkat(k.warna))}</td>
          <td>${esc(k.olehNama || '—')}</td>
        </tr>`).join('')}</tbody></table>`;
    };

    if(!rows.length){
      return subJudul + `<div style="text-align:center;font-style:italic;padding:12pt 0">${
        snap.grup
          ? T('Tidak ada peralatan di grup ','No equipment in group ') + `"${esc(snap.grup)}".`
          : T('Belum ada peralatan terdaftar.','No equipment registered.')}</div>`;
    }

    return subJudul + rows.map((a,i)=>{
      const seksi = [`
        <section class="alat-cetak">
          <h3>${i+1}. ${esc(a.nama || '')}</h3>
          ${spek(a)}
          <div class="alat-cetak-sub">${T('Riwayat Kegiatan','Activity History')}</div>
          ${sejarahTabel(a.sejarah)}
        </section>`];
      const subs = Array.isArray(a.sub) ? a.sub.filter(s=>s && s.nama) : [];
      subs.forEach((s, si)=>{
        seksi.push(`
          <section class="alat-cetak sub-cetak">
            <h3>${i+1}.${si+1}. ${esc(a.nama)} — ${esc(s.nama)}</h3>
            ${spek(s)}
            <div class="alat-cetak-sub">${T('Riwayat Kegiatan','Activity History')}</div>
            ${sejarahTabel(s.sejarah)}
          </section>`);
      });
      return seksi.join('');
    }).join('');
  }
  return '';
}

/** Bangun lembar cetak dari SNAPSHOT + identitas pembuat/pejabat, bukan
    dari keadaan sekarang. */
async function cetakLembarPermintaanHtml(p, snap){
  const u = infoUnit(p.unit);
  const judul = CETAK_JUDUL[p.jenis]?.() || '';
  const bulan = p.jenis === 'dinas' ? ` — ${namaBulan(snap.bulan || p.bulan)}` : '';
  /* Ragam PUM/Teknik SENGAJA tidak ditulis di kop kertas — sama dengan
     kopLembar() live. Ragamnya tetap ada di snapshot (untuk memilih
     rendering kode dinas), tetapi tidak dijadikan judul dokumen yang
     diserahkan. */

  // Blok kop-tabel di sini juga dilepas — sama alasannya dengan kopLembar()
  // langsung: informasi Penyelenggara + Kelompok Fasilitas sudah muncul di
  // blok identitas per-alat; Tanggal Cetak & Dicetak Oleh tidak diminta form.
  const kop = `
    <h1>${esc(judul)}${esc(bulan)}</h1>
    <h2>${esc(u.nama || p.unit)}</h2>`;

  const isi = cetakIsiSnapshotHtml(p, snap);

  const mengertUrl = CETAK.ttdPejabat && CETAK.ttdPejabat.ada ? CETAK.ttdPejabat.url : '';
  let blok;
  if(p.jenis === 'dinas'){
    /* Snapshot Dinas: footer penuh (PIC + cuti + note + TTD); mode PUM
       (snap.format === 'pum') membuang PIC dan note. Data tambahan
       (pic1/pic2/tanggalCetak/format) datang dari snap yang dibekukan
       waktu pengirim menekan tombol Kirim. */
    const bulan = snap.bulan || p.bulan;
    const orang = Array.isArray(snap.orang) ? snap.orang : [];
    const deputyUrl = CETAK.ttdDeputy && CETAK.ttdDeputy.ada ? CETAK.ttdDeputy.url : '';
    blok = dinasFooterHtml({
      pum: snap.format === 'pum',
      pic1: snap.pic1 || '',
      pic2: snap.pic2 || '',
      tanggalIso: snap.tanggalCetak || '',
      cutiRows: dinasBarisCuti(orang, bulan),
      ttdMengertUrl:  deputyUrl,
      ttdMengertNama: (CETAK.ttdDeputy && CETAK.ttdDeputy.nama) || p.deputyNama || p.deputyUser || '',
      ttdManagerUrl:  mengertUrl,
      ttdManagerNama: (CETAK.ttdPejabat && CETAK.ttdPejabat.nama) || p.pejabatNama || p.pejabatUser || ''
    });
  }else{
    blok = `
      <table class="ttd-blok ttd-blok-tunggal">
        <tr>
          <td>
            <div class="peran-ttd">${T('Mengetahui,','Approved by,')}</div>
            <div class="kotak-ttd">${mengertUrl
              ? `<img src="${mengertUrl}" data-perlu-hitam alt="">`
              : `<span class="kosong-ket">${esc(T('(belum ada TTD tersimpan)','(no saved signature)'))}</span>`}</div>
            <div class="nama-ttd">${esc(p.pejabatNama || p.pejabatUser || '—')}</div>
            <div class="jabatan-ttd">${esc(T('Manajer Teknik','Technical Manager'))}</div>
          </td>
        </tr></table>`;
  }

  return `<div class="cetak-lembar">${kop}${isi}${blok}</div>`;
}

/**
 * Peta kode dinas untuk versi PUM.
 *
 * Yang tampil di lembar PUM hanya empat kode dasar: PS, M, P, S. Semua kode
 * lain — SPKL apa pun bentuknya, CUTI, CAP, IJIN, DL, dan kode yang tidak
 * dikenali — dikosongkan supaya lembar yang diserahkan ke PUM hanya berisi ritme jaga
 * pokok, tanpa lembur dan tanpa keterangan absen yang bukan urusan mereka.
 *
 * Tetap satu tempat, bukan disebar di dua fungsi (live htmlDinas + snapshot
 * cetakIsiSnapshotHtml): kalau daftarnya berubah, satu titik yang disunting.
 */
function dinasKodePUM(kode){
  const k = String(kode || '').trim().toUpperCase();
  if(!k) return '';
  if(k === 'PSJ' || k === 'PSN' || k === 'PS') return 'PS';
  if(k === 'MJ'  || k === 'MN'  || k === 'M')  return 'M';
  if(k === 'PJ'  || k === 'PNJ' || k === 'P')  return 'P';
  if(k === 'SJ'  || k === 'SNJ' || k === 'S')  return 'S';
  // SPKL apa pun, CUTI, CAP, IJIN, DL, dan sisanya: sengaja dikosongkan.
  return '';
}

/* Nama bulan Bahasa Indonesia — dipakai untuk baris "Tangerang, 15 Agustus
   2026" di kaki lembar Dinas dan judul kolom keterangan cuti "01 Agustus -
   10 Agustus 2026". Bahasa Inggris disediakan jalur T() untuk kop; footer
   yang dokumennya ke Deputy General MT selalu Indonesia — ia bagian dari
   form dinas resmi. */
const BULAN_ID = ['Januari','Februari','Maret','April','Mei','Juni',
                  'Juli','Agustus','September','Oktober','November','Desember'];

/** Ubah 'YYYY-MM-DD' → '15 Agustus 2026'. Kalau gagal, kembalikan '' — bukan
    string mentahnya, supaya kaki lembar tidak menampilkan format ISO. */
function tanggalPanjangID(iso){
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m) return '';
  const b = BULAN_ID[Number(m[2]) - 1] || m[2];
  return `${Number(m[3])} ${b} ${m[1]}`;
}

/**
 * Ekstrak baris tabel cuti/SAP/ijin dari daftar orang + bulan.
 *
 * Yang jadi baris: rentang berturut-turut yang kodenya CUTI, CAP, IJIN,
 * atau DL. Rentang yang terputus (misal cuti hari 1-3, masuk hari 4, cuti
 * lagi hari 5) jadi DUA baris — lembar aslinya juga begitu, dan
 * menggabungkannya menyembunyikan hari di antaranya.
 *
 * Keterangan lampiran:
 *   CUTI → "Cuti Tahunan"     (bentuk paling umum di lembar aslinya)
 *   CAP  → "SAP"              (Surat Alasan Penting / Cuti Alasan Penting)
 *   IJIN → "Ijin"
 *   DL   → "Dinas Luar"       (bertugas di luar stasiun)
 * Kode lain tidak masuk daftar ini — mereka bagian dari giliran jaga.
 */
function dinasBarisCuti(orang, bulan){
  if(!Array.isArray(orang) || !orang.length) return [];
  const KODE_CUTI = { CUTI: 'Cuti Tahunan', CAP: 'SAP', IJIN: 'Ijin', DL: 'Dinas Luar' };
  const hariN = jumlahHari(bulan);
  const bulanIdx = Number(bulan.slice(5, 7));
  const bulanNama = BULAN_ID[bulanIdx - 1] || '';
  const tahun = bulan.slice(0, 4);
  const rentang = (a, b) => a === b
    ? `${String(a).padStart(2,'0')} ${bulanNama} ${tahun}`
    : `${String(a).padStart(2,'0')} ${bulanNama} - ${String(b).padStart(2,'0')} ${bulanNama} ${tahun}`;

  const rows = [];
  orang.forEach(o=>{
    let mulai = null, kodeAktif = '';
    const flush = (akhirIdx)=>{
      if(mulai === null) return;
      rows.push({
        nama: o.nama || '',
        nik:  o.nik || '',
        keterangan: KODE_CUTI[kodeAktif] || kodeAktif,
        tanggal: rentang(mulai, akhirIdx)
      });
      mulai = null; kodeAktif = '';
    };
    for(let i = 0; i < hariN; i++){
      const k = String((o.hari || [])[i] || '').trim().toUpperCase();
      const isCuti = KODE_CUTI.hasOwnProperty(k);
      if(isCuti){
        if(mulai === null){ mulai = i + 1; kodeAktif = k; }
        else if(k !== kodeAktif){ flush(i); mulai = i + 1; kodeAktif = k; }
      }else{
        flush(i);
      }
    }
    flush(hariN);
  });
  return rows;
}

/* Butir catatan tetap di kaki lembar Dinas — sama seperti di lembar
   aslinya. Diletakkan di satu tempat supaya kalau nanti butir tambahan
   perlu ditulis, hanya di sini yang disunting. */
const DINAS_NOTE = [
  'Masing – Masing personil yang berdinas sudah disesuaikan dengan rating dan kompetensi yang dimiliki',
  'Pemenuhan jam harian 12 jam maksimal terpenuhi',
  'Pemenuhan jam mingguan 40 jam maksimal terpenuhi',
  'Pemenuhan 30 jam istirahat terpenuhi',
  'Pemenuhan jeda antar shifting 11 jam terpenuhi'
];

/**
 * Bangun footer lembar Dinas: PIC di kiri atas, tanggal di kanan atas,
 * tabel cuti/SAP di tengah, note 5 poin di kiri bawah, dua blok TTD di
 * kanan bawah (Mengetahui Deputy General Manager Teknik + Dibuat Oleh
 * Manager Teknik). Semua data yang berbeda per lembar diterima lewat
 * ctx supaya fungsi ini bisa dipanggil dari htmlDinas() maupun
 * cetakLembarPermintaanHtml().
 *
 * Kalau ctx.pum true, blok PIC dan daftar Note dibuang — lembar PUM tinggal
 * tabel cuti bulan itu + tanggal + dua blok TTD.
 *
 * ctx: {
 *   pum, pic1, pic2, tanggalIso, cutiRows,
 *   ttdMengertUrl, ttdMengertNama, ttdManagerUrl, ttdManagerNama
 * }
 */
function dinasFooterHtml(ctx){
  /* Lembar PUM disederhanakan: blok PIC dan daftar Note dibuang, menyisakan
     tabel cuti/SAP/ijin/DL bulan itu plus tanggal dan dua kolom TTD. Note
     lima poin (rating, pemenuhan jam) urusan internal Teknik, bukan hal yang
     perlu ikut ke lembar PUM. */
  const pum = !!ctx.pum;
  const kotaTgl = ctx.tanggalIso
    ? `Tangerang, ${esc(tanggalPanjangID(ctx.tanggalIso))}`
    : `Tangerang, __________________`;
  const cutiBaris = ctx.cutiRows.length
    ? ctx.cutiRows.map((r,i)=>`
        <tr>
          <td class="cuti-no">${i+1}</td>
          <td class="cuti-nama">${esc(r.nama)}</td>
          <td class="cuti-nik">${esc(r.nik || '—')}</td>
          <td class="cuti-ket">${esc(r.keterangan)}</td>
          <td class="cuti-tgl">${esc(r.tanggal)}</td>
        </tr>`).join('')
    : `<tr><td colspan="5" class="cuti-kosong">${
        esc('Tidak ada cuti/SAP/ijin pada bulan ini.')}</td></tr>`;

  const noteLi = DINAS_NOTE.map((s,i)=>
    `<div class="dinas-note-butir"><span class="dinas-note-no">${i+1}.</span> ${esc(s)}</div>`).join('');

  /* Urutan blok TTD dari atas ke bawah:
       · peran        Menyetujui, / Mengetahui,
       · jabatan      DEPUTY GENERAL MANAGER TEKNIK / MANAGER TEKNIK
       · kotak-ttd    ruang tanda tangan (gambar atau "Menunggu TTD")
       · nama-ttd     nama officer, dipisah garis tanda tangan tradisional
                      (border-top yang tetap dipertahankan)
     Beda dari lembar peralatan/sparepart yang menaruh jabatan di paling
     bawah — lembar dinas mengikuti pola form Airnav yang jabatannya
     mengikat peran di atas TTD. */
  const kotakTtd = (peran, url, nama, jabatan)=>`
    <td>
      <div class="peran-ttd">${esc(peran)}</div>
      <div class="jabatan-ttd">${esc(jabatan)}</div>
      <div class="kotak-ttd">${url
        ? `<img src="${url}" data-perlu-hitam alt="">`
        : `<span class="kosong-ket">${esc('Menunggu TTD')}</span>`}</div>
      <div class="nama-ttd">${esc(nama || '—')}</div>
    </td>`;

  const picBlok = pum ? '' : `
      <table class="dinas-pic">
        <tr>
          <td class="pic-lab">PIC</td>
          <td class="pic-nama">${esc(ctx.pic1 || '—')}${ctx.pic2 ? `<br>${esc(ctx.pic2)}` : ''}</td>
        </tr>
      </table>`;

  const noteBlok = pum ? '' : `
        <div class="dinas-note">
          <div class="dinas-note-jd">Note :</div>
          ${noteLi}
        </div>`;

  return `
    <div class="dinas-footer">
      ${picBlok}

      <table class="data dinas-cuti">
        <thead>
          <tr>
            <th style="width:32px">No.</th>
            <th style="width:24%">NAMA</th>
            <th style="width:16%">NIK</th>
            <th style="width:22%">KETERANGAN</th>
            <th>TANGGAL</th>
          </tr>
        </thead>
        <tbody>${cutiBaris}</tbody>
      </table>

      <div class="dinas-bawah">
        ${noteBlok}
        <div class="dinas-ttd-kanan">
          <div class="dinas-ttd-tanggal">${kotaTgl}</div>
          <table class="ttd-blok">
            <tr>
              ${kotakTtd('Mengetahui,', ctx.ttdMengertUrl, ctx.ttdMengertNama, 'DEPUTY GENERAL MANAGER TEKNIK')}
              ${kotakTtd('Dibuat Oleh,', ctx.ttdManagerUrl, ctx.ttdManagerNama, 'MANAGER TEKNIK')}
            </tr>
          </table>
        </div>
      </div>
    </div>
  `;
}

function htmlDinas(){
  const unit = CETAK.unit;
  /* JDW.lihat mengikuti bulan yang sedang dibuka di layar Dinas. Kalau
     seseorang menekan Cetak dari layar Peralatan (bulannya belum
     pernah dipilih), pakai bulan berjalan sebagai bawaan. */
  const bulan = JDW.lihat || JDW.bulanIni || bulanKode(new Date());
  const hariN = jumlahHari(bulan);
  const orang = (JDW.jadwalLihat && JDW.jadwalLihat[unit]) || [];
  const pum = CETAK.formatDinas === 'pum';

  const hariMinggu = (h)=>{
    const d = new Date(Number(bulan.slice(0,4)), Number(bulan.slice(5,7))-1, h);
    return d.getDay();  // 0 = Minggu
  };

  const kepalaHari = Array.from({length:hariN}, (_,i)=>{
    const h = i + 1;
    const libur = hariMinggu(h) === 0;
    return `<th class="${libur?'hari-libur':''}">${h}</th>`;
  }).join('');

  const barisOrang = orang.length ? orang.map((o,idx)=>`
    <tr>
      <td class="no">${idx + 1}</td>
      <td class="nama">${esc(o.nama || '')}</td>
      <td class="nik">${esc(o.nik || '—')}</td>
      ${Array.from({length:hariN}, (_,i)=>{
        const asli = (o.hari || [])[i] || '';
        const nilai = pum ? dinasKodePUM(asli) : asli;
        const libur = hariMinggu(i+1) === 0;
        return `<td class="${libur?'hari-libur':''}">${esc(nilai) || '·'}</td>`;
      }).join('')}
    </tr>`).join('') : `
    <tr><td colspan="${hariN + 3}" style="text-align:center;padding:8pt;font-style:italic">${
      T('Belum ada jadwal untuk bulan ini.','No roster for this month yet.')}</td></tr>`;

  return `
    <table class="data jdw">
      <thead><tr>
        <th style="width:26px">${T('No','No')}</th>
        <th style="width:130px">${T('Nama','Name')}</th>
        <th style="width:90px">NIK</th>
        ${kepalaHari}
      </tr></thead>
      <tbody>${barisOrang}</tbody>
    </table>`;
}
