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
    gantiBahasa:'Ganti ke Bahasa Indonesia',
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
  if(bb){ bb.textContent = bahasa === 'id' ? 'ID' : 'EN'; bb.title = T('gantiBahasa'); }
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

function gantiBahasa(){
  bahasa = bahasa === 'id' ? 'en' : 'id';
  localStorage.setItem(KUNCI_BAHASA, bahasa);
  terapkanBahasa();
}

/* Terapkan sedini mungkin supaya tidak ada kedipan tema/bahasa saat halaman dibuka. */
bahasa = localStorage.getItem(KUNCI_BAHASA) === 'en' ? 'en' : 'id';
orientasiCetak = localStorage.getItem(KUNCI_ORIENTASI) || 'auto';
document.documentElement.setAttribute('data-tema', temaTersimpan());
