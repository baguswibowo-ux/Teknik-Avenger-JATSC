/* E-Logbook · js/02-bahasa.js — Kamus Indonesia/Inggris dan penerapannya ke seluruh layar
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh. */

/* ============== BAHASA — INDONESIA / ENGLISH ==============
   Teks statis ditandai data-t / data-t-html / data-t-ph di HTML.
   Teks yang dibuat JavaScript memakai T('kunci').

   Hasil cetak sengaja TIDAK ikut berganti bahasa: lembar cetak adalah dokumen
   resmi yang bentuk dan istilahnya mengikuti form baku, bukan preferensi
   tampilan orang yang kebetulan sedang membukanya. */

/* Orientasi kertas. "auto" berarti mengikuti bentuk bawaan tiap formulir —
   logbook dan LTK tegak, daily check dan monitoring melebar. Kalau dipilih
   sendiri, pilihan itu berlaku untuk seluruh cetakan. */
const KUNCI_ORIENTASI = 'elogbook_orientasi';
let orientasiCetak = 'auto';

function gantiOrientasi(nilai){
  orientasiCetak = ['auto','portrait','landscape'].includes(nilai) ? nilai : 'auto';
  localStorage.setItem(KUNCI_ORIENTASI, orientasiCetak);
}

const KUNCI_BAHASA = 'elogbook_bahasa';
let bahasa = 'id';

const KAMUS = {
  id: {
    /* chrome */
    orientasiAuto:'Otomatis', orientasiPortrait:'Portrait', orientasiLandscape:'Landscape',
    orientasiJudul:'Orientasi kertas saat mencetak',
    belumPunyaAkun:'Belum punya akun?', buatAkunBaru:'Buat akun',
    sudahPunyaAkun:'Sudah punya akun?', kembaliMasuk:'Masuk',
    daftarJudul:'Buat Akun',
    daftarSub:'Setelah dibuat, akun menunggu konfirmasi administrator sebelum bisa dipakai.',
    kirimPendaftaran:'Kirim Pendaftaran',
    daftarBerhasil:'Pendaftaran terkirim. Akun Anda menunggu konfirmasi administrator — hubungi administrator untuk mempercepat.',
    daftarGagal:'Pendaftaran gagal.',
    namaKosong:'Nama lengkap belum diisi.', usernameKosong:'Username belum diisi.',
    passwordPendek:'Password minimal 6 karakter.', passwordTakSama:'Ulangi password belum sama.',
    peran_admin:'Administrator', peran_pejabat:'Pejabat', peran_teknisi:'Teknisi',
    peran_adminunit:'Admin Unit', peran_pic:'PIC Unit',
    peranPejabat:'Pejabat — melihat semua unit dan menandatangani',
    semuaUnit:'semua unit', menungguKonfirmasi:'menunggu konfirmasi',
    masukSebagai:'masuk sebagai', keluar:'Keluar', masuk:'Masuk',
    kembaliDashboard:'Dashboard Fasilitas Teknik',
    kembaliDashboardKet:'Kembali ke Dashboard Fasilitas Teknik',
    loginJudul:'E-Logbook Fasilitas', loginSub:'Masuk dengan akun teknisi Anda.',
    brandJudul:'E-Logbook Fasilitas Komunikasi Penerbangan',
    metaPenyelenggara:'Penyelenggara Pelayanan', metaKelompok:'Kelompok Fasilitas', metaPeralatan:'Nama Peralatan',
    temaKeTerang:'Ganti ke mode terang', temaKeGelap:'Ganti ke mode gelap',
    gantiBahasa:'Ganti ke Bahasa Inggris',
    gantiBahasaJudul:'Ganti bahasa / change language',
    /* Empat tulisan di layar masuk yang dulu ditulis tetap di js/25-login.js.
       Selama bahasa cuma bisa diganti SETELAH masuk, tidak ada yang pernah
       melihatnya salah. Begitu pemilih bahasa pindah ke layar masuk, tombol
       yang tadinya "Entrar" berubah jadi "Masuk" sendiri sehabis percobaan
       yang gagal — teks tombolnya dikembalikan dengan huruf tetap. */
    memeriksa:'Memeriksa...',
    isiUsernamePassword:'Username dan password harus diisi.',
    takBisaHubungiServer:'Tidak dapat menghubungi server.',
    gagalMasuk:'Gagal masuk.',
    /* Kepanjangan AVENGERS. Sengaja tidak diterjemahkan di kamus mana pun:
       ini akronim dari nama sistemnya, bukan kalimat — menerjemahkannya
       membuat huruf depannya tidak lagi mengeja AVENGERS. */
    avengersArti:'Advanced Engineer Electronic Reporting System',
    /* tab */
    tabLogbook:'📋 LOGBOOK FASILITAS', tabDailyCheck:'🖥 DAILY CHECK GAREX 300',
    tabIsu:'⚠ ISU / UPDATE ISSUE', tabAkun:'👤 KELOLA AKUN',
    /* logbook */
    logbookJudul:'Buku Catatan Fasilitas', logbookSub:'Setiap catatan tersimpan langsung ke database server.',
    tambahCatatan:'+ Tambah Catatan', dariTanggal:'Cetak dari tanggal', sampaiTanggal:'Sampai tanggal',
    lihatSaja:'👁 Lihat Saja', cetakLogbook:'🖨 Cetak Logbook',
    noteCetakLogbook:'Kosongkan tanggal untuk menampilkan seluruh catatan yang termuat. Untuk <b>satu hari saja</b>, isi tanggal "dari" dan "sampai" dengan tanggal yang sama; tambahkan filter Dinas untuk per shift, atau filter Lokasi untuk satu gedung saja. Kalau hasilnya dari satu gedung, gedung itu tertulis di kop; kalau bercampur, tiap baris membawa kolom Lokasi sendiri. <b>Lihat Saja</b> menampilkan hasilnya di layar tanpa membuka dialog cetak.',
    /* daily check */
    dcJudul:'Daily Check VCS Garex 300 — Unit Radtel', dcSub:'Klik status untuk mengubah kondisi: Normal → Alarm → Gangguan.',
    suhuMer:'Suhu MER (°C)', hariTanggal:'Hari / Tanggal', remark:'Remark / Catatan Tambahan',
    lgNormal:'Normal', lgAlarm:'Alarm / Perlu Pantau', lgGangguan:'Gangguan',
    mengetahuiManager:'Mengetahui — Manager Teknik', ttdManager:'TTD Manager Teknik',
    resetForm:'Reset Form', cetakFormIni:'🖨 Cetak Form Ini', simpanDc:'💾 Simpan Daily Check',
    riwayatDc:'Riwayat Daily Check', kolItem:'Item',
    /* isu */
    isuJudul:'Update Issue — GAREX 300 & Neptuno', isuSub:'Daftar isu terbuka yang masih dalam proses penanganan.',
    tambahIsu:'+ Tambah Isu', reportDari:'Report dari tanggal', cetakIsu:'🖨 Cetak Daftar Isu',
    noteCetakIsu:'Kosongkan tanggal untuk menampilkan seluruh isu. Foto dan dokumen lampiran ikut muncul di halaman setelah tabel, dipisah antara bukti saat kejadian dan bukti saat selesai.',
    noteIsuTeknisi:'Isu yang sudah dilaporkan hanya bisa diubah atau dihapus oleh administrator. Kalau ada koreksi, sampaikan ke administrator.',
    jenisIssue:'Jenis Issue', keterangan:'Keterangan', lokasi:'Lokasi', status:'Status',
    kolTglReport:'Tgl Report', kolTglClosed:'Tgl Closed', dilaporkanOleh:'Dilaporkan Oleh',
    kolBukti:'Bukti', kolNo:'No', kolTindakan:'Tindakan',
    modalIsu:'Tambah Isu', tanggalReport:'Tanggal Report', simpanIsu:'💾 Simpan Isu', detailIsu:'Detail Isu',
    labelBuktiOpen:'Foto / Dokumen Saat Kejadian <span style="text-transform:none;letter-spacing:0;">(opsional)</span>',
    labelBuktiClosed:'Foto / Dokumen Saat Selesai <span style="text-transform:none;letter-spacing:0;">(opsional)</span>',
    noteIsuBaru:'Isu baru selalu tercatat berstatus <b>Open</b>. Hanya administrator yang bisa mengubahnya menjadi Proses atau Closed, dan melampirkan bukti saat isu ditutup.',
    /* akun */
    akunJudul:'Kelola Akun', akunSub:'Administrator yang membuat akun teknisi beserta passwordnya.',
    buatAkun:'+ Buat Akun', modalAkun:'Buat Akun Baru', buatAkunSimpan:'💾 Buat Akun',
    username:'Username', password:'Password', namaLengkap:'Nama Lengkap', peran:'Peran',
    peranTeknisi:'Teknisi — hanya bisa input', peranAdmin:'Administrator — kendali penuh',
    ulangiPassword:'Ulangi Password', modalPasswd:'Setel Ulang Password',
    passwordBaru:'Password Baru', ulangiPasswordBaru:'Ulangi Password Baru', simpanPassword:'💾 Simpan Password',
    modalNama:'Ubah Nama Akun', namaBaru:'Nama Baru', simpanNama:'💾 Simpan Nama',
    noteAkun:'Peran <b>administrator</b> memegang seluruh kendali: mengubah, menghapus, dan mengelola akun. Peran <b>pejabat</b> melihat semua unit dan boleh membubuhkan tanda tangannya pada catatan yang belum ditandatangani — selain itu tidak mengubah apa pun. Peran <b>teknisi</b> hanya bisa menambah catatan logbook, daily check, dan isu. Administrator aktif terakhir tidak bisa dinonaktifkan atau diturunkan perannya, supaya sistem tidak pernah kehilangan pengelola. Akun hanya bisa dihapus setelah dinonaktifkan; catatan yang pernah diinputnya tetap tersimpan lengkap dengan namanya.',
    noteAkunBaru:'Sampaikan password ini langsung ke pemiliknya dan minta segera diganti. Password tidak pernah bisa dilihat lagi setelah akun dibuat — kalau lupa, administrator tinggal menyetel ulang.',
    notePasswdTarget:'Password baru untuk <b id="pwNamaTarget">-</b>.',
    noteNamaTarget:'Nama baru untuk akun <b id="namaUsernameTarget">-</b> — dipakai juga untuk mencocokkan penunjukan TTD susulan (lihat catatan di formulir).',
    /* catatan */
    modalCatatan:'Tambah Catatan Logbook', tanggal:'Tanggal', jamUtc:'Jam (UTC)', dinasShift:'Dinas / Shift',
    pjNama:'Penanggung Jawab (nama)', ttdPj:'TTD Penanggung Jawab', ttdTeknisi:'TTD Teknisi',
    namaTeknisiPelaksana:'Nama Teknisi Pelaksana', tambahNama:'+ Nama',
    simpanCatatan:'💾 Simpan Catatan', detailCatatan:'Detail Catatan Logbook', detailDc:'Detail Daily Check',
    labelLampiran:'Lampiran — Hasil Scan / Foto <span style="text-transform:none;letter-spacing:0;">(opsional)</span>',
    hintLampiran:'Maksimal 6 berkas, 8 MB per berkas. JPG, PNG, WEBP, atau PDF.',
    hintLampiranPanjang:'Maksimal 6 berkas, 8 MB per berkas. JPG, PNG, WEBP, atau PDF. Foto berukuran besar dikecilkan otomatis sebelum dikirim.',
    /* umum */
    kategoriDs:'Kategori',
    /* Satu kunci per kategori di ds-site.js — menambah blok di sana cukup
       menambah satu label di sini dan di kamus Inggris. */
    dsKat_domestik:'Domestik', dsKat_internasional:'Internasional',
    'dsKat_sli-gsm':'SLI & GSM', dsKat_pabx:'PABX',
    dsDaftarKosong:'Daftar site untuk kategori ini belum diisi. Kirimkan daftarnya dan formnya langsung bisa dipakai.',
    tabDsTest:'☎ DS TEST', dsJudul:'DS Test',
    dsSub:'Uji sambungan direct speech domestik dan internasional, SLI & GSM, serta PABX.',
    dsModal:'DS Test', tambahDs:'+ Form Baru', simpanDs:'💾 Simpan DS Test',
    belumAdaDs:'Belum ada hasil DS Test.', dsTersimpan:'DS Test tersimpan.',
    siteBermasalah:'site bermasalah', semuaLolos:'semua lolos',
    noteCariDs:'Isi tanggal untuk menampilkan hasil DS Test pada hari itu saja.',

    /* ---------- Pekerjaan berkala ----------
       Satu kunci per jenis di berkala-item.js — menambah jenis di sana berarti
       menambah label tab, judul, dan subjudulnya di sini dan di kamus Inggris. */
    bkJenis_neptuno:'Cek Query Rekaman Neptuno',
    bkJenis_gatevox:'Restart CPU Gatevox',
    'bkJenis_cleaning-cwp':'Cleaning CWP',
    'bkJenis_restart-cwp':'Restart CWP',
    tabBkNeptuno:'🎙 CEK QUERY NEPTUNO', tabBkGatevox:'♻ RESTART CPU GATEVOX',
    tabBkCleaning:'🧹 CLEANING CWP', tabBkRestart:'⟳ RESTART CWP',
    bkJudul_neptuno:'Cek Query Rekaman Neptuno',
    bkSub_neptuno:'SCU 231 channel dan CWP 85 channel.',
    bkJudul_gatevox:'Restart CPU Gatevox',
    bkSub_gatevox:'Sembilan Gatevox, CPU A dan CPU B.',
    'bkJudul_cleaning-cwp':'Cleaning CWP',
    'bkSub_cleaning-cwp':'Pembersihan seluruh 85 channel CWP.',
    'bkJudul_restart-cwp':'Restart CWP',
    'bkSub_restart-cwp':'85 channel CWP, ditambah Neptuno 1–4 dan TMCS 1–2.',
    tambahBk:'+ Form Baru', simpanBk:'💾 Simpan Lembar',
    bkDaftarKosong:'Daftar pekerjaan untuk lembar ini belum diisi. Kirimkan daftarnya dan formnya langsung bisa dipakai.',
    belumAdaBk:'Belum ada lembar untuk pekerjaan ini.', bkTersimpan:'Lembar tersimpan.',
    bkTemuan:'baris bermasalah',
    bkCatatan:'Catatan', phBkCatatan:'Catatan tambahan untuk lembar ini — boleh dikosongkan',
    bkRingkasan:'Ringkasan', bkBaris:'baris', bkTandaiSemua:'tandai semua',
    bkLgBawaan:'Semua baris dimulai dari ✓ — cukup tandai yang tidak beres.',
    bkSemuaNormal:'Seluruh baris normal — tidak ada temuan.',
    bkHanyaTemuan:'Tampilkan temuan saja', bkSeluruhBaris:'Tampilkan seluruh baris',
    lgTidakDikerjakan:'TIDAK DIKERJAKAN',
    noteCariBk:'Isi tanggal untuk menampilkan lembar pada hari itu saja.',
    ttdPersonilTeknik:'TTD Personil Teknik', ttdPersonilOps:'TTD Personil Operasi',
    labelLampiranLtk:'Lampiran — Foto / Dokumen Pendukung <span style="text-transform:none;letter-spacing:0;">(opsional)</span>',
    cariTanggal:'Tanggal', cariKata:'Cari peralatan / modul', dariTanggalSingkat:'Dari tanggal',
    resetCari:'↺ Tampilkan Semua', takAdaHasil:'Tidak ada yang cocok dengan pencarian itu.',
    phCariLtk:'cth. processor, transmitter, VHF',
    noteCariMon:'Isi tanggal untuk menampilkan form monitoring pada hari itu saja.',
    noteCariLtk:'Pencarian kata memeriksa nama peralatan, bagian/modul yang rusak, dan analisa kerusakan. Rentang tanggal memakai Tanggal Pelaporan.',
    noteCariDc:'Isi rentang tanggal untuk memilah riwayat yang mau dihapus.',
    tabMonitoring:'📶 MONITORING FREKUENSI', tabLtk:'🛠 LTK',
    monJudul:'Form Monitoring Frekuensi', monSub:'Hasil pengamatan frekuensi bersama personil operasi.',
    monModal:'Form Monitoring Frekuensi', tambahMon:'+ Form Baru', simpanMon:'💾 Simpan Form',
    personilOps:'Personil Operasi', personilTeknik:'Personil Teknik',
    phPersonilOps:'Nama personil operasi', phPersonilTeknik:'Nama personil teknik',
    barisPengamatan:'Baris Pengamatan', barisPengamatanSingkat:'baris pengamatan', tambahBaris:'+ Baris',
    belumAdaMon:'Belum ada form monitoring.', monKosong:'Belum ada baris pengamatan yang terisi.',
    monTersimpan:'Form monitoring tersimpan.',
    ltkJudul:'LTK — Laporan Terjadinya Kerusakan',
    ltkSub:'Laporan kerusakan dan kegiatan perbaikan fasilitas telekomunikasi penerbangan.',
    ltkModal:'Buat LTK', tambahLtk:'+ Buat LTK', simpanLtk:'💾 Simpan LTK',
    tanggalPelaporan:'Tanggal Pelaporan', kotaLtk:'Kota',
    penyelenggaraLtk:'Penyelenggara Pelayanan', kelompokLtk:'Kelompok Fasilitas',
    peralatanLtk:'Nama Peralatan', modulLtk:'Bagian / Modul yang Rusak',
    analisaLtk:'Analisa Terjadinya Kerusakan', perbaikanLtk:'Kegiatan Perbaikan / Tindak Lanjut',
    tanggalRusak:'Tanggal Terjadi Kerusakan', jamRusak:'Jam Terjadi Kerusakan (UTC)',
    tanggalSelesai:'Tanggal Selesai Perbaikan', jamSelesai:'Jam Selesai Perbaikan (UTC)',
    jamTerputus:'Jumlah Jam Operasional Terputus',
    teknisiTelekom:'Teknisi Telekomunikasi', managerTeknik1:'Mengetahui — Manager Teknik 1',
    phPeralatanLtk:'cth. Transmitter VHF A/G', phModulLtk:'cth. Processor Module',
    phAnalisaLtk:'cth. Kondisi TX1 frekuensi 132.1 MHz display blank dan led nyala semua...',
    phPerbaikanLtk:'Satu tindakan per baris', phJamTerputus:'cth. 3 jam 20 menit',
    phNamaTeknisi:'Nama teknisi',
    belumAdaLtk:'Belum ada LTK.', ltkTersimpan:'LTK tersimpan.',
    ltkPeralatanKosong:'Nama peralatan belum diisi.',
    ltkSelesai:'selesai', ltkBelumSelesai:'belum selesai',
    konfirmasiHapus:'Hapus data ini?',
    tabDcRadkom:'📡 DAILY CHECK RADKOM', lgOk:'OK', lgNotOk:'NOT OK', lgTidakDicek:'TIDAK DICEK',
    lgKlikUbah:'Klik kotak status untuk mengubahnya.',
    dcRadkomJudul:'Daily Check Unit Radkom — New JATSC',
    dcRadkomSub:'Klik kotak TX/RX untuk berganti antara OK dan NOT OK.',
    unitLabel:'Unit', jamMulaiUtc:'Jam Mulai (UTC)', jamSelesaiUtc:'Jam Selesai (UTC)',
    frek:'Frekuensi', phFrek:'cth. 132.900 MHz', namaKecil:'nama',
    lokasiGedung:'Lokasi',
    unitAkses:'Unit Logbook', pilihUnit:'Pilih unit yang boleh dibuka akun ini',
    unitDiganti:'Unit logbook diganti.', dcTakAda:'Unit ini belum punya formulir daily check.',
    /* rekap & matrik */
    tabRekap:'📊 REKAP & MATRIK', rekapJudul:'Rekap & Matrik',
    rekapSub:'Kejadian yang sudah pernah dialami unit ini — apa saja, kapan pertama kali, dan siapa yang sudah pernah menanganinya.',
    cetakRekap:'🖨 Cetak Rekap', periodeLabel:'Periode', perMinggu:'Per minggu', perBulan:'Per bulan',
    bulanIni:'Bulan ini', tigaBulan:'3 bulan', setahun:'1 tahun',
    noteRekap:'Disusun dari catatan Logbook, LTK, dan Isu pada rentang ini — dihitung ulang di server, bukan hanya dari 200 catatan terakhir yang tampil di layar. Daily check dan monitoring tidak ikut: isinya pemeriksaan terjadwal, bukan kejadian yang dialami.',
    rekapMemuat:'Memuat rekap…', rekapGagal:'Rekap gagal dimuat.',
    rekapKosong:'Belum ada catatan pada rentang tanggal ini.', rekapBelumAda:'Rekapnya belum dimuat.',
    totalSingkat:'Total',
    /* kartu ringkasan */
    kejadianTercatat:'Kejadian tercatat', jenisPernahDialami:'Jenis yang pernah dialami',
    catatanTanpaBarisNol:'yang belum pernah terjadi tidak punya baris',
    orangTerlibat:'Orang yang terlibat', jenisBaruPeriodeIni:'Baru muncul periode ini',
    takAdaJenisBaru:'tidak ada jenis baru', belumTergolongLabel:'Belum tergolong',
    belumTergolongCatatan:'uraiannya tidak cocok aturan mana pun — lihat “Aturan penggolongan”',
    semuaTergolong:'seluruh uraian tergolong',
    palingSeringDialami:'paling sering dialami', pertamaPada:'pertama pada',
    /* matriks */
    matriksJenisJudul:'Jenis kejadian per periode',
    matriksJenisKet:'Satu baris = satu jenis kejadian yang benar-benar pernah terjadi. Tanda ▲ menandai periode saat jenis itu pertama kali muncul.',
    matriksOrangJudul:'Siapa sudah pernah menangani apa',
    matriksOrangKet:'Sel kosong berarti orang itu belum pernah tercatat menangani kejadian jenis itu — bukan nol, tapi belum pernah. Ini bukan penilaian kinerja. Tekan sel mana pun untuk melihat catatan aslinya.',
    jenisKejadian:'Jenis kejadian', pelaksanaLabel:'Pelaksana',
    pertamaDialami:'pertama dialami', pertamaMuncul:'pertama kali muncul di rentang ini',
    orangKecil:'orang', catatanKecil:'catatan', jenisKecil:'jenis', dariKecil:'dari',
    belumPernahPada:'belum pernah pada', belumPernah:'belum pernah',
    /* catatan di balik angkanya */
    catatanMendasari:'Catatan yang mendasarinya',
    terbaruDiAtas:'terbaru di atas.', tekanSelUntukSaring:'Tekan salah satu sel di matriks atas untuk mempersempit.',
    yangMengisiSel:'inilah kejadian yang membuat sel itu terisi.',
    tampilkanSemua:'Tampilkan semua', takAdaCatatanPilihan:'Tidak ada catatan pada pilihan ini.',
    catatanTakDitampilkan:'catatan lain tidak ditampilkan di daftar ini — angka di matriks tetap menghitung semuanya.',
    pelaksanaTakTercatat:'pelaksana tidak tercatat',
    /* aturan penggolongan */
    aturanJudul:'Aturan penggolongan — bagaimana jenis kejadian ditebak',
    aturanKet:'Formulir logbook tidak punya kolom “jenis kegiatan”; uraiannya diketik bebas. Jenisnya ditebak dari kata kunci, diperiksa dari atas ke bawah — yang pertama cocok yang dipakai. Karena itu angka di atas perlu dibaca sebagai perkiraan, bukan hitungan pasti.',
    kataKunci:'Kata kunci pada uraian',
    aturanBelumTergolong:'tidak cocok aturan mana pun — tetap ditampilkan apa adanya, tidak dipaksa masuk golongan terdekat',
    kelompokLtk:'Kelompok Fasilitas',
    saringUnit:'Unit', cariAkun:'Cari nama / username', phCariAkun:'cth. dewi, radtel01',
    semuaAkun:'Semua akun', akunSemuaUnit:'Semua unit (admin & pejabat)', akunTanpaUnit:'Belum punya unit',
    akunTakCocok:'Tidak ada akun yang cocok dengan saringan ini.',
    noteFilterAkun:'Menyaring per unit memakai unit yang benar-benar diberikan ke akun itu. Administrator dan pejabat memegang seluruh unit sekaligus, jadi mereka dikumpulkan di pilihan “Semua unit”.',
    dinasSingkat:'Dinas',
    batal:'Batal', tutup:'Tutup', cetak:'🖨 Cetak', semua:'Semua', bersihkan:'bersihkan',
    ttdHintTeknisi:'tanda tangan teknisi', ttdHintUmum:'tanda tangan di sini',
    /* tanda tangan tersimpan milik akun */
    pakaiTtdTersimpan:'✍ pakai TTD tersimpan',
    ttdTersimpanDipakai:'TTD tersimpan Anda dipakai. Tekan "bersihkan" untuk kembali menggambar.',
    ttdTersimpanBelumAda:'Belum ada TTD tersimpan. Buat dulu lewat menu "TTD Saya".',
    ttdTersimpanJudul:'Pakai TTD tersimpan',
    ttdTersimpanKeterangan:'Tanpa menggambar lagi: yang dibubuhkan tanda tangan yang sudah Anda simpan lewat menu “TTD Saya”.',
    ttdTersimpanTombol:'✅ Setujui & Bubuhkan',
    ttdSayaJudul:'TTD Tersimpan Saya', ttdSayaTombol:'✍ TTD Saya',
    ttdSayaTersimpanKini:'Yang tersimpan sekarang', ttdSayaGambarBaru:'Gambar tanda tangan baru',
    ttdTersimpanKosong:'— belum ada TTD tersimpan —',
    ttdSayaSimpan:'💾 Simpan TTD', ttdSayaHapus:'Hapus yang tersimpan',
    ttdSayaCatatan:'Tanda tangan ini milik akun Anda dan hanya bisa dibuat serta dihapus oleh Anda sendiri. Sekali tersimpan, tiap papan tanda tangan di formulir mendapat tombol “pakai TTD tersimpan”. Menyimpan yang baru menggantikan yang lama; tanda tangan yang sudah terlanjur dibubuhkan pada catatan tidak ikut berubah.',
    ttdTersimpanDisimpan:'TTD tersimpan Anda diperbarui.',
    ttdTersimpanDihapus:'TTD tersimpan Anda dihapus.',
    ttdTersimpanHapusTanya:'Hapus tanda tangan tersimpan Anda? Yang sudah dibubuhkan pada catatan tidak ikut terhapus.',
    ttdTersimpanGagal:'Gagal menyimpan TTD.',
    /* tanda tangan susulan oleh pejabat */
    bubuhkanTtd:'✍ Bubuhkan TTD', ttdModalJudul:'Bubuhkan Tanda Tangan',
    ttdSbgKeterangan:'Tanda tangan untuk', ttdDiSini:'Tanda Tangan',
    ttdNamaTetap:'Nama itu ditulis teknisi saat mengisi formulir dan tidak diganti.',
    ttdNamaKosong:'Nama pada formulir masih kosong, jadi diisi nama akun Anda.',
    ttdDicatatSbg:'Dicatat dibubuhkan oleh', namaBelumDiisi:'(belum diisi)',
    ditandatanganiOleh:'dibubuhkan oleh',
    ttdSbgPj:'Penanggung Jawab', ttdSbgManager:'Manager Teknik', ttdSbgOps:'Personil Operasi',
    kirimTtdKe:'Kirim TTD ke akun', kirimTtdOtomatis:'Otomatis (dari nama di atas)',
    ttdSekaliSaja:'Tanda tangan hanya bisa dibubuhkan sekali dan tidak bisa dihapus sendiri.',
    simpanTtd:'💾 Simpan Tanda Tangan', ttdKosong:'Tanda tangannya masih kosong.',
    ttdTersimpan:'Tanda tangan tersimpan.', ttdGagal:'Gagal menyimpan tanda tangan.',
    hapusAkun:'🗑 Hapus Akun',
    /* placeholder */
    phUraian:'cth. Pengecekan peralatan VCS Garex melalui TMCS, ditemukan CWP03 alarm...',
    phSuhu:'cth. 22°C', phRemark:'cth. VR3 partial failure of element, masih dalam remote expert Madrid...',
    phNamaManager:'Nama manager teknik', phNamaPj:'Nama penanggung jawab',
    phJenisIsu:'cth. VR 3 partial failure of element',
    phKeteranganIsu:'cth. Masih dalam penanganan remote expert Madrid, menunggu penggantian modul.',
    phLokasi:'cth. MER Lantai 2', phPelapor:'Nama yang menemukan / melaporkan',
    phUsername:'cth. budi.santoso', phNamaLengkap:'cth. Budi Santoso', phMin6:'minimal 6 karakter',
    /* teks dinamis */
    hari:['MINGGU','SENIN','SELASA','RABU','KAMIS','JUMAT','SABTU'],
    bulan:['JAN','FEB','MAR','APR','MEI','JUN','JUL','AGU','SEP','OKT','NOV','DES'],
    tersambung:'tersambung ke server', menghubungkan:'menghubungkan ke server...',
    memuatData:'memuat data dari server...', serverTakTerhubung:'server tidak dapat dihubungi',
    jamServer:'jam server', jamDariServer:'Waktu diambil dari jam server.',
    jamBelumSelaras:'Belum tersambung ke server — sementara memakai jam komputer ini.',
    belumAdaCatatan:'Belum ada catatan. Klik "Tambah Catatan" untuk memulai.',
    belumAdaDc:'Belum ada riwayat daily check.', belumAdaIsu:'Belum ada isu tercatat.',
    belumAdaAkun:'Belum ada akun.', belumAdaBukti:'belum ada bukti terlampir',
    detail:'👁 Detail', hapus:'Hapus', cetakCatatanIni:'Cetak catatan ini',
    diinputOleh:'diinput oleh', tidakTercatat:'pembuatnya tidak tercatat',
    jejakBaris:'Waktu input', jejakHari:'hari',
    jejakDirekam:'Waktu catatan ini benar-benar masuk ke server. Dicatat server sendiri, bukan diketik pengisi — tanggal dan jam di atas diketik sendiri, angka ini tidak.',
    jejakSusulan:'Diketik setelah waktu yang tertulis — catatan disusulkan.',
    jejakDini:'Diketik SEBELUM waktu yang tertulis di catatan ini. Periksa kembali tanggal/jamnya.',
    uraianPekerjaan:'Uraian Pekerjaan / Kejadian', teknisiPelaksana:'Teknisi Pelaksana',
    penanggungJawab:'Penanggung Jawab', lampiranKe:'Lampiran',
    buktiKejadian:'Bukti Saat Kejadian', buktiSelesai:'Bukti Saat Selesai',
    unggahKeFase:'⬆ Unggah ke fase ini', anda:'(Anda)', aktif:'aktif', nonaktif:'nonaktif',
    aktifkan:'Aktifkan', nonaktifkan:'Nonaktifkan', gantiPassword:'🔑 Password', ubahNama:'✎ Nama',
    tutupPratinjau:'✕ Tutup Pratinjau', pratinjauJudul:'Pratinjau — tidak dicetak',
    /* pesan */
    tersimpanCatatan:'Catatan tersimpan.', tersimpanIsu:'Isu tercatat.',
    menyimpan:'Menyimpan ke server...', mengunggah:'Mengunggah lampiran dan menyimpan...',
    uraianKosong:'Uraian pekerjaan belum diisi.', jenisKosong:'Jenis issue belum diisi.',
    hanyaAdminHapus:'Hanya administrator yang bisa menghapus.',
    hanyaAdminUbah:'Hanya administrator yang bisa mengubah isu.',
    takAdaFilter:'Tidak ada catatan pada filter tanggal/dinas itu.',
    takAdaIsuFilter:'Tidak ada isu pada filter itu.',
    gagalSimpan:'Gagal menyimpan', gagalHapus:'Gagal menghapus', coba:'coba lagi.',
    /* sunting catatan */
    suntingCatatanIni:'Sunting catatan ini', suntingBtn:'✎ Sunting', modalSuntingCatatan:'Sunting Catatan Logbook',
    simpanPerubahan:'💾 Simpan Perubahan', tersimpanPerubahan:'Perubahan tersimpan.',
    suntingTanggalDc:'Ubah tanggal', modalSuntingTanggalDc:'Ubah Tanggal Daily Check',
    /* tunjuk akun & kotak masuk TTD */
    tunjukAkunHint:'Ketik nama yang cocok dengan akun pejabat/manager teknik untuk memunculkan catatan ini di kotak masuk TTD orang itu.',
    inboxJudul:'Menunggu TTD Anda', inboxTombolTitle:'Kotak masuk TTD',
    inboxKosong:'Tidak ada yang menunggu tanda tangan Anda.'
  },

  en: {
    orientasiAuto:'Automatic', orientasiPortrait:'Portrait', orientasiLandscape:'Landscape',
    orientasiJudul:'Paper orientation when printing',
    belumPunyaAkun:'No account yet?', buatAkunBaru:'Create account',
    sudahPunyaAkun:'Already have an account?', kembaliMasuk:'Sign in',
    daftarJudul:'Create Account',
    daftarSub:'Once created, the account waits for administrator approval before it can be used.',
    kirimPendaftaran:'Submit Registration',
    daftarBerhasil:'Registration sent. Your account is waiting for administrator approval — contact an administrator to speed it up.',
    daftarGagal:'Registration failed.',
    namaKosong:'The full name is still empty.', usernameKosong:'The username is still empty.',
    passwordPendek:'Password must be at least 6 characters.', passwordTakSama:'The repeated password does not match.',
    peran_admin:'Administrator', peran_pejabat:'Officer', peran_teknisi:'Technician',
    peran_adminunit:'Unit Admin', peran_pic:'Unit PIC',
    peranPejabat:'Officer — view all units and sign',
    semuaUnit:'all units', menungguKonfirmasi:'awaiting approval',
    masukSebagai:'signed in as', keluar:'Sign out', masuk:'Sign in',
    kembaliDashboard:'Dashboard Fasilitas Teknik',
    kembaliDashboardKet:'Back to Dashboard Fasilitas Teknik',
    // Nama aplikasi tidak diterjemahkan: ini nama resmi unit, bukan keterangan
    // yang boleh berganti mengikuti bahasa layar.
    loginJudul:'E-Logbook Fasilitas', loginSub:'Sign in with your technician account.',
    brandJudul:'E-Logbook Fasilitas Komunikasi Penerbangan',
    metaPenyelenggara:'Service Provider', metaKelompok:'Facility Group', metaPeralatan:'Equipment Name',
    temaKeTerang:'Switch to light mode', temaKeGelap:'Switch to dark mode',
    /* Tombol kepala berputar id → en → es → id, jadi tulisan ini menyebut
       bahasa BERIKUTNYA, bukan bahasa yang sedang tampil. */
    gantiBahasa:'Switch to Spanish / cambiar a español',
    gantiBahasaJudul:'Change language / ganti bahasa',
    memeriksa:'Checking...',
    isiUsernamePassword:'Username and password are both required.',
    takBisaHubungiServer:'Cannot reach the server.',
    gagalMasuk:'Sign-in failed.',
    avengersArti:'Advanced Engineer Electronic Reporting System',
    tabLogbook:'📋 FACILITY LOGBOOK', tabDailyCheck:'🖥 GAREX 300 DAILY CHECK',
    tabIsu:'⚠ ISSUE / UPDATE ISSUE', tabAkun:'👤 MANAGE ACCOUNTS',
    logbookJudul:'Facility Log Book', logbookSub:'Every entry is saved straight to the server database.',
    tambahCatatan:'+ Add Entry', dariTanggal:'From date', sampaiTanggal:'To date',
    lihatSaja:'👁 View Only', cetakLogbook:'🖨 Print Logbook',
    noteCetakLogbook:'Leave the dates empty to show every loaded entry. For <b>a single day</b>, set "from" and "to" to the same date; add the Shift filter for one shift only, or the Location filter for a single building. When the result comes from one building, that building is named in the header; when it is mixed, every row carries its own Location column. <b>View Only</b> shows the result on screen without opening the print dialog.',
    dcJudul:'VCS Garex 300 Daily Check — Radtel Unit', dcSub:'Click a status to change it: Normal → Alarm → Fault.',
    suhuMer:'MER Temperature (°C)', hariTanggal:'Day / Date', remark:'Remark / Additional Notes',
    lgNormal:'Normal', lgAlarm:'Alarm / Watch', lgGangguan:'Fault',
    mengetahuiManager:'Approved by — Technical Manager', ttdManager:'Technical Manager Signature',
    resetForm:'Reset Form', cetakFormIni:'🖨 Print This Form', simpanDc:'💾 Save Daily Check',
    riwayatDc:'Daily Check History', kolItem:'Item',
    isuJudul:'Update Issue — GAREX 300 & Neptuno', isuSub:'Open issues still being worked on.',
    tambahIsu:'+ Add Issue', reportDari:'Reported from', cetakIsu:'🖨 Print Issue List',
    noteCetakIsu:'Leave the dates empty to show every issue. Attached photos and documents appear on the pages after the table, separated into evidence at report time and at closing.',
    noteIsuTeknisi:'Once reported, an issue can only be edited or deleted by an administrator. Pass any correction to your administrator.',
    jenisIssue:'Issue Type', keterangan:'Description', lokasi:'Location', status:'Status',
    kolTglReport:'Reported', kolTglClosed:'Closed', dilaporkanOleh:'Reported By',
    kolBukti:'Evidence', kolNo:'No', kolTindakan:'Actions',
    modalIsu:'Add Issue', tanggalReport:'Report Date', simpanIsu:'💾 Save Issue', detailIsu:'Issue Detail',
    labelBuktiOpen:'Photo / Document at Report <span style="text-transform:none;letter-spacing:0;">(optional)</span>',
    labelBuktiClosed:'Photo / Document at Closing <span style="text-transform:none;letter-spacing:0;">(optional)</span>',
    noteIsuBaru:'A new issue is always recorded as <b>Open</b>. Only an administrator can move it to In Progress or Closed, and attach closing evidence.',
    akunJudul:'Manage Accounts', akunSub:'Administrators create technician accounts and their passwords.',
    buatAkun:'+ Create Account', modalAkun:'Create New Account', buatAkunSimpan:'💾 Create Account',
    username:'Username', password:'Password', namaLengkap:'Full Name', peran:'Role',
    peranTeknisi:'Technician — input only', peranAdmin:'Administrator — full control',
    ulangiPassword:'Repeat Password', modalPasswd:'Reset Password',
    passwordBaru:'New Password', ulangiPasswordBaru:'Repeat New Password', simpanPassword:'💾 Save Password',
    modalNama:'Rename Account', namaBaru:'New Name', simpanNama:'💾 Save Name',
    noteAkun:'The <b>administrator</b> role holds full control: editing, deleting, and managing accounts. The <b>officer</b> role sees every unit and may add their own signature to records that are not signed yet — nothing else. The <b>technician</b> role can only add logbook entries, daily checks, and issues. The last active administrator cannot be deactivated or demoted, so the system is never left without a manager. An account can only be deleted once it is deactivated; the records it entered stay, name included.',
    noteAkunBaru:'Hand this password to its owner directly and ask them to change it. It can never be viewed again once the account is created — if forgotten, an administrator simply resets it.',
    notePasswdTarget:'New password for <b id="pwNamaTarget">-</b>.',
    noteNamaTarget:'New name for account <b id="namaUsernameTarget">-</b> — also used to match follow-up signature assignments (see the note on the form).',
    modalCatatan:'Add Logbook Entry', tanggal:'Date', jamUtc:'Time (UTC)', dinasShift:'Shift',
    pjNama:'Person in Charge (name)', ttdPj:'Person in Charge Signature', ttdTeknisi:'Technician Signature',
    namaTeknisiPelaksana:'Technician on Duty', tambahNama:'+ Name',
    simpanCatatan:'💾 Save Entry', detailCatatan:'Logbook Entry Detail', detailDc:'Daily Check Detail',
    labelLampiran:'Attachments — Scan / Photo <span style="text-transform:none;letter-spacing:0;">(optional)</span>',
    hintLampiran:'Up to 6 files, 8 MB each. JPG, PNG, WEBP, or PDF.',
    hintLampiranPanjang:'Up to 6 files, 8 MB each. JPG, PNG, WEBP, or PDF. Large photos are shrunk automatically before upload.',
    kategoriDs:'Category',
    dsKat_domestik:'Domestic', dsKat_internasional:'International',
    'dsKat_sli-gsm':'SLI & GSM', dsKat_pabx:'PABX',
    dsDaftarKosong:'The site list for this category has not been filled in yet. Send the list and the form is ready to use.',
    tabDsTest:'☎ DS TEST', dsJudul:'DS Test',
    dsSub:'Domestic and international direct speech, SLI & GSM, and PABX link tests.',
    dsModal:'DS Test', tambahDs:'+ New Form', simpanDs:'💾 Save DS Test',
    belumAdaDs:'No DS Test result yet.', dsTersimpan:'DS Test saved.',
    siteBermasalah:'sites with problems', semuaLolos:'all passed',
    noteCariDs:'Set a date to show only the DS Test results from that day.',

    /* ---------- Periodic work ---------- */
    bkJenis_neptuno:'Neptuno Recording Query Check',
    bkJenis_gatevox:'Gatevox CPU Restart',
    'bkJenis_cleaning-cwp':'CWP Cleaning',
    'bkJenis_restart-cwp':'CWP Restart',
    tabBkNeptuno:'🎙 NEPTUNO QUERY CHECK', tabBkGatevox:'♻ GATEVOX CPU RESTART',
    tabBkCleaning:'🧹 CWP CLEANING', tabBkRestart:'⟳ CWP RESTART',
    bkJudul_neptuno:'Neptuno Recording Query Check',
    bkSub_neptuno:'231 SCU channels and 85 CWP channels.',
    bkJudul_gatevox:'Gatevox CPU Restart',
    bkSub_gatevox:'Nine Gatevox units, CPU A and CPU B.',
    'bkJudul_cleaning-cwp':'CWP Cleaning',
    'bkSub_cleaning-cwp':'Cleaning across all 85 CWP channels.',
    'bkJudul_restart-cwp':'CWP Restart',
    'bkSub_restart-cwp':'85 CWP channels, plus Neptuno 1–4 and TMCS 1–2.',
    tambahBk:'+ New Form', simpanBk:'💾 Save Sheet',
    bkDaftarKosong:'The work list for this sheet has not been filled in yet. Send the list and the form is ready to use.',
    belumAdaBk:'No sheet for this work yet.', bkTersimpan:'Sheet saved.',
    bkTemuan:'rows with problems',
    bkCatatan:'Notes', phBkCatatan:'Extra notes for this sheet — may be left empty',
    bkRingkasan:'Summary', bkBaris:'rows', bkTandaiSemua:'mark all',
    bkLgBawaan:'Every row starts at ✓ — just mark the ones that are not right.',
    bkSemuaNormal:'Every row normal — nothing found.',
    bkHanyaTemuan:'Show findings only', bkSeluruhBaris:'Show every row',
    lgTidakDikerjakan:'NOT DONE',
    noteCariBk:'Set a date to show only the sheets from that day.',
    ttdPersonilTeknik:'Technical Personnel Signature', ttdPersonilOps:'Operations Personnel Signature',
    labelLampiranLtk:'Attachments — Supporting Photo / Document <span style="text-transform:none;letter-spacing:0;">(optional)</span>',
    cariTanggal:'Date', cariKata:'Search equipment / module', dariTanggalSingkat:'From date',
    resetCari:'↺ Show All', takAdaHasil:'Nothing matches that search.',
    phCariLtk:'e.g. processor, transmitter, VHF',
    noteCariMon:'Set a date to show only the monitoring forms from that day.',
    noteCariLtk:'The keyword search looks at equipment name, faulty part/module, and fault analysis. The date range uses the Report Date.',
    noteCariDc:'Set a date range to sort out the history you want to delete.',
    tabMonitoring:'📶 FREQUENCY MONITORING', tabLtk:'🛠 FAULT REPORT',
    monJudul:'Frequency Monitoring Form', monSub:'Frequency observation results together with operations personnel.',
    monModal:'Frequency Monitoring Form', tambahMon:'+ New Form', simpanMon:'💾 Save Form',
    personilOps:'Operations Personnel', personilTeknik:'Technical Personnel',
    phPersonilOps:'Operations personnel name', phPersonilTeknik:'Technical personnel name',
    barisPengamatan:'Observation Rows', barisPengamatanSingkat:'observation rows', tambahBaris:'+ Row',
    belumAdaMon:'No monitoring form yet.', monKosong:'No observation row has been filled in.',
    monTersimpan:'Monitoring form saved.',
    ltkJudul:'Fault and Repair Report',
    ltkSub:'Report of faults and repair work on aeronautical telecommunication facilities.',
    ltkModal:'Create Fault Report', tambahLtk:'+ Create Report', simpanLtk:'💾 Save Report',
    tanggalPelaporan:'Report Date', kotaLtk:'City',
    penyelenggaraLtk:'Service Provider', kelompokLtk:'Facility Group',
    peralatanLtk:'Equipment Name', modulLtk:'Faulty Part / Module',
    analisaLtk:'Fault Analysis', perbaikanLtk:'Repair Work / Follow-up',
    tanggalRusak:'Fault Date', jamRusak:'Fault Time (UTC)',
    tanggalSelesai:'Repair Completed Date', jamSelesai:'Repair Completed Time (UTC)',
    jamTerputus:'Total Hours Out of Service',
    teknisiTelekom:'Telecommunication Technician', managerTeknik1:'Approved by — Technical Manager 1',
    phPeralatanLtk:'e.g. VHF A/G Transmitter', phModulLtk:'e.g. Processor Module',
    phAnalisaLtk:'e.g. TX1 on 132.1 MHz shows a blank display with all LEDs lit...',
    phPerbaikanLtk:'One action per line', phJamTerputus:'e.g. 3 hours 20 minutes',
    phNamaTeknisi:'Technician name',
    belumAdaLtk:'No fault report yet.', ltkTersimpan:'Fault report saved.',
    ltkPeralatanKosong:'The equipment name is still empty.',
    ltkSelesai:'completed', ltkBelumSelesai:'in progress',
    konfirmasiHapus:'Delete this record?',
    tabDcRadkom:'📡 RADKOM DAILY CHECK', lgOk:'OK', lgNotOk:'NOT OK', lgTidakDicek:'NOT CHECKED',
    lgKlikUbah:'Click a status box to change it.',
    dcRadkomJudul:'Radkom Unit Daily Check — New JATSC',
    dcRadkomSub:'Click a TX/RX box to toggle between OK and NOT OK.',
    unitLabel:'Unit', jamMulaiUtc:'Start Time (UTC)', jamSelesaiUtc:'End Time (UTC)',
    frek:'Frequency', phFrek:'e.g. 132.900 MHz', namaKecil:'name',
    lokasiGedung:'Location',
    unitAkses:'Logbook Units', pilihUnit:'Choose which units this account may open',
    unitDiganti:'Logbook unit switched.', dcTakAda:'This unit has no daily check form yet.',
    tabRekap:'📊 SUMMARY & MATRIX', rekapJudul:'Summary & Matrix',
    rekapSub:'What this unit has actually run into — which kinds of events, when each was first seen, and who has handled them.',
    cetakRekap:'🖨 Print Summary', periodeLabel:'Period', perMinggu:'Weekly', perBulan:'Monthly',
    bulanIni:'This month', tigaBulan:'3 months', setahun:'1 year',
    noteRekap:'Built from the Logbook, LTK, and Issue records in this range — recomputed on the server, not just from the 200 latest rows shown on screen. Daily checks and monitoring are left out: those are scheduled inspections, not events that were run into.',
    rekapMemuat:'Loading summary…', rekapGagal:'Could not load the summary.',
    rekapKosong:'No records in this date range yet.', rekapBelumAda:'The summary has not been loaded yet.',
    totalSingkat:'Total',
    kejadianTercatat:'Events recorded', jenisPernahDialami:'Kinds seen so far',
    catatanTanpaBarisNol:'what has never happened has no row at all',
    orangTerlibat:'People involved', jenisBaruPeriodeIni:'First seen this period',
    takAdaJenisBaru:'nothing new', belumTergolongLabel:'Unclassified',
    belumTergolongCatatan:'their wording matches no rule — see “Classification rules”',
    semuaTergolong:'every entry classified',
    palingSeringDialami:'is the most frequent', pertamaPada:'first on',
    matriksJenisJudul:'Kinds of event per period',
    matriksJenisKet:'One row = one kind of event that actually happened. ▲ marks the period each kind first appeared in.',
    matriksOrangJudul:'Who has handled what',
    matriksOrangKet:'An empty cell means that person has never been recorded handling that kind of event — not zero, but never. This is not a performance rating. Press any cell to see the records behind it.',
    jenisKejadian:'Kind of event', pelaksanaLabel:'Personnel',
    pertamaDialami:'first seen', pertamaMuncul:'first appearance in this range',
    orangKecil:'people', catatanKecil:'records', jenisKecil:'kinds', dariKecil:'of',
    belumPernahPada:'never yet on', belumPernah:'never yet',
    catatanMendasari:'The records behind these numbers',
    terbaruDiAtas:'newest first.', tekanSelUntukSaring:'Press a cell in the matrix above to narrow this down.',
    yangMengisiSel:'these are the events that filled that cell.',
    tampilkanSemua:'Show all', takAdaCatatanPilihan:'No records for this selection.',
    catatanTakDitampilkan:'further records are not listed here — the matrix figures still count every one of them.',
    pelaksanaTakTercatat:'personnel not recorded',
    aturanJudul:'Classification rules — how the kind of event is guessed',
    aturanKet:'The logbook form has no “kind of work” field; its description is free text. The kind is guessed from keywords, checked top to bottom — first match wins. So the figures above are an estimate, not an exact count.',
    kataKunci:'Keywords in the description',
    aturanBelumTergolong:'matches no rule — shown as it is, never forced into the nearest group',
    kelompokLtk:'Facility Group',
    saringUnit:'Unit', cariAkun:'Search name / username', phCariAkun:'e.g. dewi, radtel01',
    semuaAkun:'All accounts', akunSemuaUnit:'All units (admin & officers)', akunTanpaUnit:'No unit yet',
    akunTakCocok:'No account matches this filter.',
    noteFilterAkun:'Filtering by unit uses the units actually granted to each account. Administrators and officers hold every unit at once, so they are grouped under “All units”.',
    dinasSingkat:'Shift',
    batal:'Cancel', tutup:'Close', cetak:'🖨 Print', semua:'All', bersihkan:'clear',
    ttdHintTeknisi:'technician signature', ttdHintUmum:'sign here',
    pakaiTtdTersimpan:'✍ use my saved signature',
    ttdTersimpanDipakai:'Your saved signature is in use. Press “clear” to draw instead.',
    ttdTersimpanBelumAda:'No saved signature yet. Create one under “My Signature” first.',
    ttdTersimpanJudul:'Use your saved signature',
    ttdTersimpanKeterangan:'No drawing needed: the signature you saved under “My Signature” is stamped instead.',
    ttdTersimpanTombol:'✅ Approve & sign',
    ttdSayaJudul:'My Saved Signature', ttdSayaTombol:'✍ My Signature',
    ttdSayaTersimpanKini:'Currently saved', ttdSayaGambarBaru:'Draw a new signature',
    ttdTersimpanKosong:'— no saved signature —',
    ttdSayaSimpan:'💾 Save signature', ttdSayaHapus:'Delete saved signature',
    ttdSayaCatatan:'This signature belongs to your account and only you can create or delete it. Once saved, every signature pad on the forms gets a “use my saved signature” button. Saving a new one replaces the old; signatures already placed on records are left untouched.',
    ttdTersimpanDisimpan:'Your saved signature has been updated.',
    ttdTersimpanDihapus:'Your saved signature has been deleted.',
    ttdTersimpanHapusTanya:'Delete your saved signature? Signatures already placed on records are not removed.',
    ttdTersimpanGagal:'Could not save the signature.',
    bubuhkanTtd:'✍ Add Signature', ttdModalJudul:'Add Signature',
    ttdSbgKeterangan:'Signature for', ttdDiSini:'Signature',
    ttdNamaTetap:'That name was written by the technician on the form and is left unchanged.',
    ttdNamaKosong:'The name on the form is still empty, so your account name is used.',
    ttdDicatatSbg:'Recorded as added by', namaBelumDiisi:'(not filled in)',
    ditandatanganiOleh:'added by',
    ttdSbgPj:'Person in Charge', ttdSbgManager:'Technical Manager', ttdSbgOps:'Operations Personnel',
    kirimTtdKe:'Send signature to account', kirimTtdOtomatis:'Automatic (from name above)',
    ttdSekaliSaja:'A signature can only be added once and cannot be removed afterwards.',
    simpanTtd:'💾 Save Signature', ttdKosong:'The signature pad is still empty.',
    ttdTersimpan:'Signature saved.', ttdGagal:'Failed to save the signature.',
    hapusAkun:'🗑 Delete Account',
    phUraian:'e.g. Checked VCS Garex equipment via TMCS, found CWP03 in alarm...',
    phSuhu:'e.g. 22°C', phRemark:'e.g. VR3 partial failure of element, still with Madrid remote expert...',
    phNamaManager:'Technical manager name', phNamaPj:'Person in charge name',
    phJenisIsu:'e.g. VR 3 partial failure of element',
    phKeteranganIsu:'e.g. Still handled by Madrid remote expert, awaiting module replacement.',
    phLokasi:'e.g. MER 2nd Floor', phPelapor:'Name of the person who found / reported it',
    phUsername:'e.g. budi.santoso', phNamaLengkap:'e.g. Budi Santoso', phMin6:'at least 6 characters',
    hari:['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'],
    bulan:['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'],
    tersambung:'connected to server', menghubungkan:'connecting to server...',
    memuatData:'loading data from server...', serverTakTerhubung:'cannot reach the server',
    jamServer:'server clock', jamDariServer:'Time is taken from the server clock.',
    jamBelumSelaras:'Not connected yet — temporarily using this computer clock.',
    belumAdaCatatan:'No entries yet. Click "Add Entry" to start.',
    belumAdaDc:'No daily check history yet.', belumAdaIsu:'No issues recorded yet.',
    belumAdaAkun:'No accounts yet.', belumAdaBukti:'no evidence attached yet',
    detail:'👁 Detail', hapus:'Delete', cetakCatatanIni:'Print this entry',
    diinputOleh:'entered by', tidakTercatat:'author not recorded',
    jejakBaris:'Entered at', jejakHari:'d',
    jejakDirekam:'When this entry actually reached the server. Recorded by the server itself, not typed in — the date and time above are typed by hand, this number is not.',
    jejakSusulan:'Typed after the time it states — the entry was filed late.',
    jejakDini:'Typed BEFORE the time this entry states. Check its date/time again.',
    uraianPekerjaan:'Work / Event Description', teknisiPelaksana:'Technician on Duty',
    penanggungJawab:'Person in Charge', lampiranKe:'Attachments',
    buktiKejadian:'Evidence at Report', buktiSelesai:'Evidence at Closing',
    unggahKeFase:'⬆ Upload to this stage', anda:'(You)', aktif:'active', nonaktif:'inactive',
    aktifkan:'Activate', nonaktifkan:'Deactivate', gantiPassword:'🔑 Password', ubahNama:'✎ Name',
    tutupPratinjau:'✕ Close Preview', pratinjauJudul:'Preview — not printed',
    tersimpanCatatan:'Entry saved.', tersimpanIsu:'Issue recorded.',
    menyimpan:'Saving to server...', mengunggah:'Uploading attachments and saving...',
    uraianKosong:'The work description is still empty.', jenisKosong:'The issue type is still empty.',
    hanyaAdminHapus:'Only an administrator can delete.',
    hanyaAdminUbah:'Only an administrator can edit issues.',
    takAdaFilter:'No entries match that date/shift filter.',
    takAdaIsuFilter:'No issues match that filter.',
    gagalSimpan:'Failed to save', gagalHapus:'Failed to delete', coba:'please try again.',
    /* edit entry */
    suntingCatatanIni:'Edit this entry', suntingBtn:'✎ Edit', modalSuntingCatatan:'Edit Logbook Entry',
    simpanPerubahan:'💾 Save Changes', tersimpanPerubahan:'Changes saved.',
    suntingTanggalDc:'Edit date', modalSuntingTanggalDc:'Edit Daily Check Date',
    /* assign account & TTD inbox */
    tunjukAkunHint:'Type a name matching a pejabat/manager teknik account to have this entry show up in that person\'s TTD inbox.',
    inboxJudul:'Awaiting Your Signature', inboxTombolTitle:'TTD inbox',
    inboxKosong:'Nothing is waiting for your signature.'
  },

  /* ============== ESPAÑOL ==============
     Setiap kunci di kamus en harus ada di sini juga. T() memang punya jaring
     pengaman ke kamus id, tapi jaring itu tidak kelihatan: kunci yang lupa
     diterjemahkan muncul sebagai kalimat Indonesia di tengah layar Spanyol,
     dan tidak ada yang melaporkannya karena tidak terlihat seperti galat.

     Nama resmi tidak diterjemahkan — sama seperti di kamus en. "E-Logbook
     Fasilitas", "Dashboard Fasilitas Teknik", dan kepanjangan AVENGERS adalah
     nama unit dan sistemnya sendiri, bukan keterangan yang boleh berganti
     mengikuti bahasa layar. */
  es: {
    /* chrome */
    orientasiAuto:'Automática', orientasiPortrait:'Vertical', orientasiLandscape:'Horizontal',
    orientasiJudul:'Orientación del papel al imprimir',
    belumPunyaAkun:'¿Aún no tiene cuenta?', buatAkunBaru:'Crear cuenta',
    sudahPunyaAkun:'¿Ya tiene una cuenta?', kembaliMasuk:'Iniciar sesión',
    daftarJudul:'Crear Cuenta',
    daftarSub:'Una vez creada, la cuenta espera la aprobación del administrador antes de poder usarse.',
    kirimPendaftaran:'Enviar Solicitud',
    daftarBerhasil:'Solicitud enviada. Su cuenta espera la aprobación del administrador — contacte a un administrador para agilizarlo.',
    daftarGagal:'La solicitud no se pudo enviar.',
    namaKosong:'El nombre completo sigue vacío.', usernameKosong:'El usuario sigue vacío.',
    passwordPendek:'La contraseña debe tener al menos 6 caracteres.', passwordTakSama:'La contraseña repetida no coincide.',
    peran_admin:'Administrador', peran_pejabat:'Directivo', peran_teknisi:'Técnico',
    peran_adminunit:'Administrador de Unidad', peran_pic:'Responsable de Unidad',
    peranPejabat:'Directivo — ve todas las unidades y firma',
    semuaUnit:'todas las unidades', menungguKonfirmasi:'pendiente de aprobación',
    masukSebagai:'sesión iniciada como', keluar:'Cerrar sesión', masuk:'Entrar',
    kembaliDashboard:'Dashboard Fasilitas Teknik',
    kembaliDashboardKet:'Volver al Dashboard Fasilitas Teknik',
    loginJudul:'E-Logbook Fasilitas', loginSub:'Entre con su cuenta de técnico.',
    brandJudul:'E-Logbook Fasilitas Komunikasi Penerbangan',
    metaPenyelenggara:'Proveedor del Servicio', metaKelompok:'Grupo de Instalaciones', metaPeralatan:'Nombre del Equipo',
    temaKeTerang:'Cambiar a modo claro', temaKeGelap:'Cambiar a modo oscuro',
    gantiBahasa:'Volver al indonesio / kembali ke Bahasa Indonesia',
    gantiBahasaJudul:'Cambiar idioma / ganti bahasa',
    memeriksa:'Comprobando...',
    isiUsernamePassword:'El usuario y la contraseña son obligatorios.',
    takBisaHubungiServer:'No se puede contactar el servidor.',
    gagalMasuk:'No se pudo iniciar sesión.',
    avengersArti:'Advanced Engineer Electronic Reporting System',
    /* tab */
    tabLogbook:'📋 BITÁCORA DE INSTALACIONES', tabDailyCheck:'🖥 CHEQUEO DIARIO GAREX 300',
    tabIsu:'⚠ INCIDENCIA / ACTUALIZACIÓN', tabAkun:'👤 GESTIÓN DE CUENTAS',
    /* bitácora */
    logbookJudul:'Bitácora de Instalaciones', logbookSub:'Cada anotación se guarda directamente en la base de datos del servidor.',
    tambahCatatan:'+ Añadir Anotación', dariTanggal:'Desde la fecha', sampaiTanggal:'Hasta la fecha',
    lihatSaja:'👁 Solo Ver', cetakLogbook:'🖨 Imprimir Bitácora',
    noteCetakLogbook:'Deje las fechas vacías para mostrar todas las anotaciones cargadas. Para <b>un solo día</b>, ponga la misma fecha en "desde" y "hasta"; añada el filtro de Turno para un solo turno, o el filtro de Ubicación para un solo edificio. Si el resultado viene de un solo edificio, ese edificio aparece en el encabezado; si está mezclado, cada fila lleva su propia columna de Ubicación. <b>Solo Ver</b> muestra el resultado en pantalla sin abrir el diálogo de impresión.',
    /* chequeo diario */
    dcJudul:'Chequeo Diario VCS Garex 300 — Unidad Radtel', dcSub:'Pulse un estado para cambiarlo: Normal → Alarma → Avería.',
    suhuMer:'Temperatura MER (°C)', hariTanggal:'Día / Fecha', remark:'Observaciones / Notas Adicionales',
    lgNormal:'Normal', lgAlarm:'Alarma / Vigilar', lgGangguan:'Avería',
    mengetahuiManager:'Aprobado por — Gerente Técnico', ttdManager:'Firma del Gerente Técnico',
    resetForm:'Reiniciar Formulario', cetakFormIni:'🖨 Imprimir Este Formulario', simpanDc:'💾 Guardar Chequeo Diario',
    riwayatDc:'Historial de Chequeos Diarios', kolItem:'Elemento',
    /* incidencias */
    isuJudul:'Actualización de Incidencias — GAREX 300 y Neptuno', isuSub:'Incidencias abiertas todavía en tratamiento.',
    tambahIsu:'+ Añadir Incidencia', reportDari:'Reportado desde', cetakIsu:'🖨 Imprimir Lista de Incidencias',
    noteCetakIsu:'Deje las fechas vacías para mostrar todas las incidencias. Las fotos y documentos adjuntos aparecen en las páginas posteriores a la tabla, separados entre evidencia al reportar y evidencia al cerrar.',
    noteIsuTeknisi:'Una vez reportada, la incidencia solo puede editarla o borrarla un administrador. Comunique cualquier corrección a su administrador.',
    jenisIssue:'Tipo de Incidencia', keterangan:'Descripción', lokasi:'Ubicación', status:'Estado',
    kolTglReport:'Reportada', kolTglClosed:'Cerrada', dilaporkanOleh:'Reportada Por',
    kolBukti:'Evidencia', kolNo:'N.º', kolTindakan:'Acciones',
    modalIsu:'Añadir Incidencia', tanggalReport:'Fecha del Reporte', simpanIsu:'💾 Guardar Incidencia', detailIsu:'Detalle de la Incidencia',
    labelBuktiOpen:'Foto / Documento al Reportar <span style="text-transform:none;letter-spacing:0;">(opcional)</span>',
    labelBuktiClosed:'Foto / Documento al Cerrar <span style="text-transform:none;letter-spacing:0;">(opcional)</span>',
    noteIsuBaru:'Una incidencia nueva se registra siempre como <b>Abierta</b>. Solo un administrador puede pasarla a En Proceso o Cerrada, y adjuntar la evidencia del cierre.',
    /* cuentas */
    akunJudul:'Gestión de Cuentas', akunSub:'Los administradores crean las cuentas de los técnicos y sus contraseñas.',
    buatAkun:'+ Crear Cuenta', modalAkun:'Crear Cuenta Nueva', buatAkunSimpan:'💾 Crear Cuenta',
    username:'Usuario', password:'Contraseña', namaLengkap:'Nombre Completo', peran:'Rol',
    peranTeknisi:'Técnico — solo registro', peranAdmin:'Administrador — control total',
    ulangiPassword:'Repetir Contraseña', modalPasswd:'Restablecer Contraseña',
    passwordBaru:'Contraseña Nueva', ulangiPasswordBaru:'Repetir Contraseña Nueva', simpanPassword:'💾 Guardar Contraseña',
    modalNama:'Renombrar Cuenta', namaBaru:'Nombre Nuevo', simpanNama:'💾 Guardar Nombre',
    noteAkun:'El rol <b>administrador</b> tiene control total: editar, borrar y gestionar cuentas. El rol <b>directivo</b> ve todas las unidades y puede añadir su propia firma a los registros que aún no la tienen — nada más. El rol <b>técnico</b> solo puede añadir anotaciones de bitácora, chequeos diarios e incidencias. El último administrador activo no puede desactivarse ni degradarse, para que el sistema nunca quede sin responsable. Una cuenta solo puede borrarse una vez desactivada; los registros que introdujo permanecen, incluido el nombre.',
    noteAkunBaru:'Entregue esta contraseña a su dueño en persona y pídale que la cambie. No podrá volver a verse una vez creada la cuenta — si se olvida, un administrador simplemente la restablece.',
    notePasswdTarget:'Contraseña nueva para <b id="pwNamaTarget">-</b>.',
    noteNamaTarget:'Nombre nuevo para la cuenta <b id="namaUsernameTarget">-</b> — también se usa para emparejar las firmas pendientes (vea la nota del formulario).',
    /* bitácora: formulario */
    modalCatatan:'Añadir Anotación', tanggal:'Fecha', jamUtc:'Hora (UTC)', dinasShift:'Turno',
    pjNama:'Responsable (nombre)', ttdPj:'Firma del Responsable', ttdTeknisi:'Firma del Técnico',
    namaTeknisiPelaksana:'Técnico de Guardia', tambahNama:'+ Nombre',
    simpanCatatan:'💾 Guardar Anotación', detailCatatan:'Detalle de la Anotación', detailDc:'Detalle del Chequeo Diario',
    labelLampiran:'Adjuntos — Escaneo / Foto <span style="text-transform:none;letter-spacing:0;">(opcional)</span>',
    hintLampiran:'Hasta 6 archivos, 8 MB cada uno. JPG, PNG, WEBP o PDF.',
    hintLampiranPanjang:'Hasta 6 archivos, 8 MB cada uno. JPG, PNG, WEBP o PDF. Las fotos grandes se reducen automáticamente antes de subirlas.',
    /* DS test */
    kategoriDs:'Categoría',
    dsKat_domestik:'Nacional', dsKat_internasional:'Internacional',
    'dsKat_sli-gsm':'SLI y GSM', dsKat_pabx:'PABX',
    dsDaftarKosong:'La lista de sitios de esta categoría aún no se ha rellenado. Envíe la lista y el formulario queda listo.',
    tabDsTest:'☎ PRUEBA DS', dsJudul:'Prueba DS',
    dsSub:'Pruebas de enlace de voz directa nacional e internacional, SLI y GSM, y PABX.',
    dsModal:'Prueba DS', tambahDs:'+ Formulario Nuevo', simpanDs:'💾 Guardar Prueba DS',
    belumAdaDs:'Todavía no hay resultados de Prueba DS.', dsTersimpan:'Prueba DS guardada.',
    siteBermasalah:'sitios con problemas', semuaLolos:'todos correctos',
    noteCariDs:'Elija una fecha para ver solo las Pruebas DS de ese día.',
    /* trabajos periódicos */
    bkJenis_neptuno:'Chequeo de Consultas de Grabación Neptuno',
    bkJenis_gatevox:'Reinicio de CPU Gatevox',
    'bkJenis_cleaning-cwp':'Limpieza de CWP',
    'bkJenis_restart-cwp':'Reinicio de CWP',
    tabBkNeptuno:'🎙 CONSULTAS NEPTUNO', tabBkGatevox:'♻ REINICIO CPU GATEVOX',
    tabBkCleaning:'🧹 LIMPIEZA CWP', tabBkRestart:'⟳ REINICIO CWP',
    bkJudul_neptuno:'Chequeo de Consultas de Grabación Neptuno',
    bkSub_neptuno:'231 canales SCU y 85 canales CWP.',
    bkJudul_gatevox:'Reinicio de CPU Gatevox',
    bkSub_gatevox:'Nueve unidades Gatevox, CPU A y CPU B.',
    'bkJudul_cleaning-cwp':'Limpieza de CWP',
    'bkSub_cleaning-cwp':'Limpieza de los 85 canales CWP.',
    'bkJudul_restart-cwp':'Reinicio de CWP',
    'bkSub_restart-cwp':'85 canales CWP, más Neptuno 1–4 y TMCS 1–2.',
    tambahBk:'+ Formulario Nuevo', simpanBk:'💾 Guardar Hoja',
    bkDaftarKosong:'La lista de trabajos de esta hoja aún no se ha rellenado. Envíe la lista y el formulario queda listo.',
    belumAdaBk:'Todavía no hay ninguna hoja de este trabajo.', bkTersimpan:'Hoja guardada.',
    bkTemuan:'filas con problemas',
    bkCatatan:'Notas', phBkCatatan:'Notas adicionales de esta hoja — puede dejarse vacío',
    bkRingkasan:'Resumen', bkBaris:'filas', bkTandaiSemua:'marcar todo',
    bkLgBawaan:'Todas las filas empiezan en ✓ — marque solo las que no estén bien.',
    bkSemuaNormal:'Todas las filas normales — sin hallazgos.',
    bkHanyaTemuan:'Ver solo los hallazgos', bkSeluruhBaris:'Ver todas las filas',
    lgTidakDikerjakan:'NO REALIZADO',
    noteCariBk:'Elija una fecha para ver solo las hojas de ese día.',
    ttdPersonilTeknik:'Firma del Personal Técnico', ttdPersonilOps:'Firma del Personal de Operaciones',
    labelLampiranLtk:'Adjuntos — Foto / Documento de Apoyo <span style="text-transform:none;letter-spacing:0;">(opcional)</span>',
    /* búsqueda */
    cariTanggal:'Fecha', cariKata:'Buscar equipo / módulo', dariTanggalSingkat:'Desde la fecha',
    resetCari:'↺ Ver Todo', takAdaHasil:'Nada coincide con esa búsqueda.',
    phCariLtk:'p. ej. procesador, transmisor, VHF',
    noteCariMon:'Elija una fecha para ver solo los formularios de monitoreo de ese día.',
    noteCariLtk:'La búsqueda por palabra revisa el nombre del equipo, la pieza o módulo averiado y el análisis de la avería. El rango de fechas usa la Fecha del Reporte.',
    noteCariDc:'Elija un rango de fechas para separar el historial que quiere borrar.',
    /* monitoreo y reporte de averías */
    tabMonitoring:'📶 MONITOREO DE FRECUENCIAS', tabLtk:'🛠 REPORTE DE AVERÍAS',
    monJudul:'Formulario de Monitoreo de Frecuencias', monSub:'Resultados de la observación de frecuencias junto al personal de operaciones.',
    monModal:'Formulario de Monitoreo de Frecuencias', tambahMon:'+ Formulario Nuevo', simpanMon:'💾 Guardar Formulario',
    personilOps:'Personal de Operaciones', personilTeknik:'Personal Técnico',
    phPersonilOps:'Nombre del personal de operaciones', phPersonilTeknik:'Nombre del personal técnico',
    barisPengamatan:'Filas de Observación', barisPengamatanSingkat:'filas de observación', tambahBaris:'+ Fila',
    belumAdaMon:'Todavía no hay formularios de monitoreo.', monKosong:'No se ha rellenado ninguna fila de observación.',
    monTersimpan:'Formulario de monitoreo guardado.',
    ltkJudul:'Reporte de Avería y Reparación',
    ltkSub:'Reporte de averías y trabajos de reparación en instalaciones de telecomunicación aeronáutica.',
    ltkModal:'Crear Reporte de Avería', tambahLtk:'+ Crear Reporte', simpanLtk:'💾 Guardar Reporte',
    tanggalPelaporan:'Fecha del Reporte', kotaLtk:'Ciudad',
    penyelenggaraLtk:'Proveedor del Servicio', kelompokLtk:'Grupo de Instalaciones',
    peralatanLtk:'Nombre del Equipo', modulLtk:'Pieza / Módulo Averiado',
    analisaLtk:'Análisis de la Avería', perbaikanLtk:'Reparación / Seguimiento',
    tanggalRusak:'Fecha de la Avería', jamRusak:'Hora de la Avería (UTC)',
    tanggalSelesai:'Fecha de Fin de la Reparación', jamSelesai:'Hora de Fin de la Reparación (UTC)',
    jamTerputus:'Horas Totales Fuera de Servicio',
    teknisiTelekom:'Técnico de Telecomunicaciones', managerTeknik1:'Aprobado por — Gerente Técnico 1',
    phPeralatanLtk:'p. ej. Transmisor VHF A/G', phModulLtk:'p. ej. Módulo Procesador',
    phAnalisaLtk:'p. ej. El TX1 en 132.1 MHz muestra la pantalla en blanco con todos los LED encendidos...',
    phPerbaikanLtk:'Una acción por línea', phJamTerputus:'p. ej. 3 horas 20 minutos',
    phNamaTeknisi:'Nombre del técnico',
    belumAdaLtk:'Todavía no hay reportes de avería.', ltkTersimpan:'Reporte de avería guardado.',
    ltkPeralatanKosong:'El nombre del equipo sigue vacío.',
    ltkSelesai:'terminado', ltkBelumSelesai:'en proceso',
    konfirmasiHapus:'¿Borrar este registro?',
    /* radkom */
    tabDcRadkom:'📡 CHEQUEO DIARIO RADKOM', lgOk:'OK', lgNotOk:'NO OK', lgTidakDicek:'SIN REVISAR',
    lgKlikUbah:'Pulse una casilla de estado para cambiarla.',
    dcRadkomJudul:'Chequeo Diario Unidad Radkom — New JATSC',
    dcRadkomSub:'Pulse una casilla TX/RX para alternar entre OK y NO OK.',
    unitLabel:'Unidad', jamMulaiUtc:'Hora de Inicio (UTC)', jamSelesaiUtc:'Hora de Fin (UTC)',
    frek:'Frecuencia', phFrek:'p. ej. 132.900 MHz', namaKecil:'nombre',
    lokasiGedung:'Ubicación',
    unitAkses:'Unidades de la Bitácora', pilihUnit:'Elija qué unidades puede abrir esta cuenta',
    unitDiganti:'Unidad de bitácora cambiada.', dcTakAda:'Esta unidad todavía no tiene formulario de chequeo diario.',
    /* resumen y matriz */
    tabRekap:'📊 RESUMEN Y MATRIZ', rekapJudul:'Resumen y Matriz',
    rekapSub:'Con qué se ha encontrado realmente esta unidad — qué tipos de suceso, cuándo se vio cada uno por primera vez y quién los ha atendido.',
    cetakRekap:'🖨 Imprimir Resumen', periodeLabel:'Periodo', perMinggu:'Semanal', perBulan:'Mensual',
    bulanIni:'Este mes', tigaBulan:'3 meses', setahun:'1 año',
    noteRekap:'Construido a partir de los registros de Bitácora, LTK e Incidencias de este rango — recalculado en el servidor, no solo con las 200 filas más recientes que se ven en pantalla. Los chequeos diarios y el monitoreo quedan fuera: son inspecciones programadas, no sucesos con los que uno se encuentre.',
    rekapMemuat:'Cargando el resumen…', rekapGagal:'No se pudo cargar el resumen.',
    rekapKosong:'Todavía no hay registros en este rango de fechas.', rekapBelumAda:'El resumen aún no se ha cargado.',
    totalSingkat:'Total',
    kejadianTercatat:'Sucesos registrados', jenisPernahDialami:'Tipos vistos hasta ahora',
    catatanTanpaBarisNol:'lo que nunca ha ocurrido no tiene ninguna fila',
    orangTerlibat:'Personas implicadas', jenisBaruPeriodeIni:'Vistos por primera vez este periodo',
    takAdaJenisBaru:'nada nuevo', belumTergolongLabel:'Sin clasificar',
    belumTergolongCatatan:'su redacción no coincide con ninguna regla — vea “Reglas de clasificación”',
    semuaTergolong:'todas las anotaciones clasificadas',
    palingSeringDialami:'es el más frecuente', pertamaPada:'primero el',
    matriksJenisJudul:'Tipos de suceso por periodo',
    matriksJenisKet:'Una fila = un tipo de suceso que realmente ocurrió. ▲ marca el periodo en que cada tipo apareció por primera vez.',
    matriksOrangJudul:'Quién ha atendido qué',
    matriksOrangKet:'Una celda vacía significa que esa persona nunca ha quedado registrada atendiendo ese tipo de suceso — no es cero, es nunca. Esto no es una evaluación de desempeño. Pulse cualquier celda para ver los registros que hay detrás.',
    jenisKejadian:'Tipo de suceso', pelaksanaLabel:'Personal',
    pertamaDialami:'visto por primera vez', pertamaMuncul:'primera aparición en este rango',
    orangKecil:'personas', catatanKecil:'registros', jenisKecil:'tipos', dariKecil:'de',
    belumPernahPada:'nunca todavía el', belumPernah:'nunca todavía',
    catatanMendasari:'Los registros detrás de estas cifras',
    terbaruDiAtas:'los más recientes primero.', tekanSelUntukSaring:'Pulse una celda de la matriz de arriba para acotar esto.',
    yangMengisiSel:'estos son los sucesos que llenaron esa celda.',
    tampilkanSemua:'Ver todo', takAdaCatatanPilihan:'No hay registros para esta selección.',
    catatanTakDitampilkan:'no se listan aquí más registros — las cifras de la matriz sí los cuentan todos.',
    pelaksanaTakTercatat:'personal no registrado',
    aturanJudul:'Reglas de clasificación — cómo se deduce el tipo de suceso',
    aturanKet:'El formulario de la bitácora no tiene campo de “tipo de trabajo”; su descripción es texto libre. El tipo se deduce por palabras clave, revisadas de arriba abajo — gana la primera que coincide. Por eso las cifras de arriba son una estimación, no un recuento exacto.',
    kataKunci:'Palabras clave en la descripción',
    aturanBelumTergolong:'no coincide con ninguna regla — se muestra tal cual, nunca se fuerza al grupo más cercano',
    /* filtro de cuentas */
    saringUnit:'Unidad', cariAkun:'Buscar nombre / usuario', phCariAkun:'p. ej. dewi, radtel01',
    semuaAkun:'Todas las cuentas', akunSemuaUnit:'Todas las unidades (admin y directivos)', akunTanpaUnit:'Todavía sin unidad',
    akunTakCocok:'Ninguna cuenta coincide con este filtro.',
    noteFilterAkun:'El filtro por unidad usa las unidades realmente concedidas a cada cuenta. Los administradores y directivos tienen todas las unidades a la vez, así que se agrupan bajo “Todas las unidades”.',
    dinasSingkat:'Turno',
    batal:'Cancelar', tutup:'Cerrar', cetak:'🖨 Imprimir', semua:'Todo', bersihkan:'borrar',
    /* firmas */
    ttdHintTeknisi:'firma del técnico', ttdHintUmum:'firme aquí',
    pakaiTtdTersimpan:'✍ usar mi firma guardada',
    ttdTersimpanDipakai:'Se está usando su firma guardada. Pulse “borrar” para dibujarla en su lugar.',
    ttdTersimpanBelumAda:'Todavía no hay firma guardada. Cree una primero en “Mi Firma”.',
    ttdTersimpanJudul:'Usar su firma guardada',
    ttdTersimpanKeterangan:'No hace falta dibujar: se estampa la firma que guardó en “Mi Firma”.',
    ttdTersimpanTombol:'✅ Aprobar y firmar',
    ttdSayaJudul:'Mi Firma Guardada', ttdSayaTombol:'✍ Mi Firma',
    ttdSayaTersimpanKini:'Guardada actualmente', ttdSayaGambarBaru:'Dibujar una firma nueva',
    ttdTersimpanKosong:'— sin firma guardada —',
    ttdSayaSimpan:'💾 Guardar firma', ttdSayaHapus:'Borrar la firma guardada',
    ttdSayaCatatan:'Esta firma pertenece a su cuenta y solo usted puede crearla o borrarla. Una vez guardada, cada panel de firma de los formularios muestra un botón de “usar mi firma guardada”. Guardar una nueva reemplaza a la anterior; las firmas ya puestas en registros quedan intactas.',
    ttdTersimpanDisimpan:'Su firma guardada se ha actualizado.',
    ttdTersimpanDihapus:'Su firma guardada se ha borrado.',
    ttdTersimpanHapusTanya:'¿Borrar su firma guardada? Las firmas ya puestas en registros no se eliminan.',
    ttdTersimpanGagal:'No se pudo guardar la firma.',
    bubuhkanTtd:'✍ Añadir Firma', ttdModalJudul:'Añadir Firma',
    ttdSbgKeterangan:'Firma para', ttdDiSini:'Firma',
    ttdNamaTetap:'Ese nombre lo escribió el técnico en el formulario y se deja sin cambiar.',
    ttdNamaKosong:'El nombre del formulario sigue vacío, así que se usa el nombre de su cuenta.',
    ttdDicatatSbg:'Registrado como añadida por', namaBelumDiisi:'(sin rellenar)',
    ditandatanganiOleh:'añadida por',
    ttdSbgPj:'Responsable', ttdSbgManager:'Gerente Técnico', ttdSbgOps:'Personal de Operaciones',
    kirimTtdKe:'Enviar la firma a la cuenta', kirimTtdOtomatis:'Automático (del nombre de arriba)',
    ttdSekaliSaja:'Una firma solo puede añadirse una vez y después no puede quitarse.',
    simpanTtd:'💾 Guardar Firma', ttdKosong:'El panel de firma sigue vacío.',
    ttdTersimpan:'Firma guardada.', ttdGagal:'No se pudo guardar la firma.',
    hapusAkun:'🗑 Borrar Cuenta',
    /* textos de ejemplo */
    phUraian:'p. ej. Revisado el equipo VCS Garex por TMCS, CWP03 encontrado en alarma...',
    phSuhu:'p. ej. 22°C', phRemark:'p. ej. VR3 fallo parcial de elemento, todavía con el experto remoto de Madrid...',
    phNamaManager:'Nombre del gerente técnico', phNamaPj:'Nombre del responsable',
    phJenisIsu:'p. ej. VR 3 fallo parcial de elemento',
    phKeteranganIsu:'p. ej. Todavía atendido por el experto remoto de Madrid, a la espera del cambio de módulo.',
    phLokasi:'p. ej. MER 2.ª planta', phPelapor:'Nombre de quien lo encontró / reportó',
    phUsername:'p. ej. budi.santoso', phNamaLengkap:'p. ej. Budi Santoso', phMin6:'al menos 6 caracteres',
    hari:['DOMINGO','LUNES','MARTES','MIÉRCOLES','JUEVES','VIERNES','SÁBADO'],
    bulan:['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'],
    /* estado del servidor */
    tersambung:'conectado al servidor', menghubungkan:'conectando al servidor...',
    memuatData:'cargando datos del servidor...', serverTakTerhubung:'no se puede contactar el servidor',
    jamServer:'reloj del servidor', jamDariServer:'La hora se toma del reloj del servidor.',
    jamBelumSelaras:'Todavía sin conexión — usando temporalmente el reloj de este equipo.',
    belumAdaCatatan:'Todavía no hay anotaciones. Pulse "Añadir Anotación" para empezar.',
    belumAdaDc:'Todavía no hay historial de chequeos diarios.', belumAdaIsu:'Todavía no hay incidencias registradas.',
    belumAdaAkun:'Todavía no hay cuentas.', belumAdaBukti:'todavía sin evidencia adjunta',
    detail:'👁 Detalle', hapus:'Borrar', cetakCatatanIni:'Imprimir esta anotación',
    diinputOleh:'introducida por', tidakTercatat:'autor no registrado',
    jejakBaris:'Introducida el', jejakHari:'d',
    jejakDirekam:'Cuando esta anotación llegó realmente al servidor. Lo registra el propio servidor, no se teclea — la fecha y la hora de arriba se escriben a mano, este número no.',
    jejakSusulan:'Tecleada después de la hora que indica — la anotación se registró con retraso.',
    jejakDini:'Tecleada ANTES de la hora que indica esta anotación. Revise otra vez su fecha y hora.',
    uraianPekerjaan:'Descripción del Trabajo / Suceso', teknisiPelaksana:'Técnico de Guardia',
    penanggungJawab:'Responsable', lampiranKe:'Adjuntos',
    buktiKejadian:'Evidencia al Reportar', buktiSelesai:'Evidencia al Cerrar',
    unggahKeFase:'⬆ Subir a esta etapa', anda:'(Usted)', aktif:'activa', nonaktif:'inactiva',
    aktifkan:'Activar', nonaktifkan:'Desactivar', gantiPassword:'🔑 Contraseña', ubahNama:'✎ Nombre',
    tutupPratinjau:'✕ Cerrar Vista Previa', pratinjauJudul:'Vista previa — no se imprime',
    tersimpanCatatan:'Anotación guardada.', tersimpanIsu:'Incidencia registrada.',
    menyimpan:'Guardando en el servidor...', mengunggah:'Subiendo los adjuntos y guardando...',
    uraianKosong:'La descripción del trabajo sigue vacía.', jenisKosong:'El tipo de incidencia sigue vacío.',
    hanyaAdminHapus:'Solo un administrador puede borrar.',
    hanyaAdminUbah:'Solo un administrador puede editar incidencias.',
    takAdaFilter:'Ninguna anotación coincide con ese filtro de fecha/turno.',
    takAdaIsuFilter:'Ninguna incidencia coincide con ese filtro.',
    gagalSimpan:'No se pudo guardar', gagalHapus:'No se pudo borrar', coba:'inténtelo de nuevo.',
    /* editar anotación */
    suntingCatatanIni:'Editar esta anotación', suntingBtn:'✎ Editar', modalSuntingCatatan:'Editar Anotación de la Bitácora',
    simpanPerubahan:'💾 Guardar Cambios', tersimpanPerubahan:'Cambios guardados.',
    suntingTanggalDc:'Editar fecha', modalSuntingTanggalDc:'Editar la Fecha del Chequeo Diario',
    /* asignación de cuenta y bandeja de firmas */
    tunjukAkunHint:'Escriba un nombre que coincida con una cuenta de directivo o gerente técnico para que esta anotación aparezca en la bandeja de firmas de esa persona.',
    inboxJudul:'Pendiente de Su Firma', inboxTombolTitle:'bandeja de firmas',
    inboxKosong:'No hay nada esperando su firma.'
  }
};

/** Ambil teks terjemahan. Kalau kuncinya belum ada, kunci itu sendiri yang tampil
    supaya kelalaian menerjemahkan langsung kelihatan, bukan berubah jadi kosong. */
function T(kunci){
  const k = KAMUS[bahasa] || KAMUS.id;
  return (k[kunci] !== undefined ? k[kunci] : (KAMUS.id[kunci] !== undefined ? KAMUS.id[kunci] : kunci));
}

function terapkanBahasa(){
  document.documentElement.lang = bahasa;
  document.querySelectorAll('[data-t]').forEach(el=>{ el.textContent = T(el.dataset.t); });
  document.querySelectorAll('[data-t-html]').forEach(el=>{ el.innerHTML = T(el.dataset.tHtml); });
  document.querySelectorAll('[data-t-ph]').forEach(el=>{ el.placeholder = T(el.dataset.tPh); });
  document.querySelectorAll('[data-t-title]').forEach(el=>{ el.title = T(el.dataset.tTitle); });

  const po = document.getElementById('pilihOrientasi');
  if(po){
    po.value = orientasiCetak;
    po.options[0].textContent = '⇅ ' + T('orientasiAuto');
    po.options[1].textContent = '▯ ' + T('orientasiPortrait');
    po.options[2].textContent = '▭ ' + T('orientasiLandscape');
    po.title = T('orientasiJudul');
  }
  const bb = document.getElementById('tombolBahasa');
  if(bb){ bb.textContent = bahasa.toUpperCase(); bb.title = T('gantiBahasa'); }
  /* Pemilih di layar masuk. Nilainya diselaraskan, tidak disetel dari nol:
     orang bisa saja sudah memilih lewat tombol di kepala pada kunjungan
     sebelumnya, dan pemilih yang menampilkan bahasa lain daripada yang sedang
     tampil adalah cara tercepat membuat orang mengira layarnya rusak. */
  const pb = document.getElementById('pilihBahasaMasuk');
  if(pb && pb.value !== bahasa) pb.value = bahasa;
  terapkanTema(document.documentElement.getAttribute('data-tema') || temaTersimpan());

  // Bagian yang digambar JavaScript harus digambar ulang agar ikut berganti.
  if(typeof entries !== 'undefined'){
    // renderUsers() dulu ikut di sini; tab Kelola Akun sudah pindah ke Dashboard
    // Fasilitas Teknik. Fungsinya tidak ada lagi, dan satu pemanggilan yang
    // gagal akan menelan tiga render sesudahnya — satu try untuk tujuh baris.
    try{ renderEntries(); renderDcHistory(); renderIssues(); renderMonList(); renderLtkList(); renderDsList(); }catch(e){}
    try{ if(typeof renderInboxBadge === 'function') renderInboxBadge(); }catch(e){}
    // Rekap datanya dari server, jadi cukup digambar ulang — tanpa memintanya lagi.
    try{ if(typeof renderRekap === 'function') renderRekap(); }catch(e){}
  }
  if(typeof unitSaya !== 'undefined' && unitSaya.length){ try{ renderPemilihUnit(); terapkanUnit(); }catch(e){} }
  // Nama harinya ikut berganti bahasa. Yang diperbarui hanya keterangannya —
  // tanggal yang sudah dipilih sendiri tidak boleh ikut disetel ulang.
  if(typeof perbaruiHariDc === 'function' && document.getElementById('dcTanggal')) perbaruiHariDc();
  // Badge sambungan sudah tergambar sebelum bahasa diganti — perbarui juga.
  const badge = document.getElementById('syncBadge');
  if(badge && typeof userSaatIni !== 'undefined' && userSaatIni){
    badge.innerHTML = '<span class="sync-dot"></span> ' + T('tersambung');
  }
  if(typeof tickClock === 'function') tickClock();
  if(typeof userSaatIni !== 'undefined' && userSaatIni) tampilkanUser(userSaatIni);
}

/* Pilih bahasa tertentu, bukan sekadar membalik. Dibuat terpisah karena layar
   masuk memakai <select>, sementara kepala dashboard memakai tombol yang
   berganti-ganti — dan keduanya harus bermuara ke satu tempat.

   Kode yang tidak dikenal diabaikan dan bahasanya dibiarkan seperti semula.
   Menerimanya begitu saja berarti KAMUS[bahasa] undefined, dan T() akan jatuh
   ke kamus id untuk SETIAP kunci: layarnya tetap berbahasa Indonesia, tapi
   pemilihnya menunjuk bahasa lain dan tidak ada yang bisa mengembalikannya
   selain menghapus localStorage. */
function setBahasa(kode){
  if(!KAMUS[kode] || kode === bahasa) return;
  bahasa = kode;
  localStorage.setItem(KUNCI_BAHASA, bahasa);
  terapkanBahasa();
}

/* Tombol di kepala dashboard: satu tombol untuk tiga bahasa, jadi ia berputar
   id → en → es → id. Urutannya diambil dari KAMUS, bukan ditulis ulang di
   sini — daftar kedua yang harus ikut disunting setiap kali ada bahasa baru
   adalah daftar yang suatu saat lupa disunting. */
function gantiBahasa(){
  const daftar = Object.keys(KAMUS);
  setBahasa(daftar[(daftar.indexOf(bahasa) + 1) % daftar.length]);
}

/* Terapkan sedini mungkin supaya tidak ada kedipan tema/bahasa saat halaman dibuka.

   Dulu baris ini berbunyi `=== 'en' ? 'en' : 'id'`. Bentuk itu benar selama
   bahasanya cuma dua, dan diam-diam salah begitu ada yang ketiga: orang yang
   memilih Spanyol akan kembali ke Indonesia setiap kali halaman dibuka, dan
   pilihannya yang tersimpan tidak pernah terbaca. Sekarang yang menentukan
   sah atau tidaknya adalah kamusnya sendiri — menambah bahasa berikutnya
   cukup dengan menambah bloknya, tanpa menyentuh baris ini lagi. */
const bahasaTersimpan = localStorage.getItem(KUNCI_BAHASA);
bahasa = KAMUS[bahasaTersimpan] ? bahasaTersimpan : 'id';
orientasiCetak = localStorage.getItem(KUNCI_ORIENTASI) || 'auto';
document.documentElement.setAttribute('data-tema', temaTersimpan());
