/* =======================================================================
   GALERI FOTO — dokumentasi kegiatan per unit

   BUKAN data contoh: berkasnya foto sungguhan di public/foto/<unit>/, dan
   itu sebabnya blok ini berada di luar CONTOH. Tidak ikut diganti saat
   halaman tersambung ke server — E-Logbook belum punya modul galeri.

   Isinya TIDAK ditulis di berkas ini, melainkan diminta ke server lewat
   /galeri/daftar — indeks yang sama yang ditulis ulang tiap ada foto baru
   diunggah. Kalau daftarnya ikut dikeraskan di sini, unggahan dari layar tidak
   akan pernah terlihat sampai kodenya disunting tangan.

   Dulu jalurnya /foto/daftar.json, dan itu patah di Vercel dengan cara yang
   tidak kelihatan: ada berkas statis bernama persis itu di deployment — ikut
   terunggah dari komputer kantor waktu deploy lewat CLI — dan berkas statis
   diperiksa lebih dulu daripada rewrite. Jadi yang dijawab selalu salinan beku
   dari kantor, bukan indeks yang sungguhan. Lihat blok GALERI FOTO di
   server.js.

   Foto yang berkasnya belum ada tidak merusak apa pun: ubinnya tetap tampil
   sebagai tombol "pilih berkas" (lihat gambarGaleri), jadi daftarnya boleh
   ditulis lebih dulu dan berkasnya menyusul.

   `tgl` boleh dikosongkan kalau tanggalnya belum pasti.
   ======================================================================= */
let FOTO = {};

/** Baca daftar galeri dari server. Gagal = galeri kosong, sisanya tetap jalan. */
async function muatGaleri(){
  try{
    // cache:'no-store' — daftarnya berubah tiap unggahan, dan salinan lama di
    // cache peramban membuat foto yang baru masuk seolah tidak tersimpan.
    const r = await fetch('/galeri/daftar', { cache:'no-store' });
    if(r.ok) FOTO = await r.json();
  }catch(e){
    console.warn('Daftar galeri tidak terbaca:', e && e.message || e);
  }
}

const MODUL = [
  { st:'Sudah jalan', stEn:'Running', jalan:true, nama:'E-Logbook Fasilitas', namaEn:'Facility E-Logbook',
    ket:'Logbook, Daily Check, Isu, Monitoring, DS Test, LTK, TTD QR, Rekap. Delapan unit, dipakai harian.',
    ketEn:'Logbook, Daily Check, Issues, Monitoring, DS Test, LTK, QR signature, Summary. Eight units, in daily use.' },
  { st:'Sudah jalan', stEn:'Running', jalan:true, nama:'Kelola Akun', namaEn:'Manage Accounts',
    ket:'Akun E-Logbook diurus dari depan: tambah, peran, unit, reset password, aktif/nonaktif. Datanya tetap di E-Logbook — yang dipakai API administratornya.',
    ketEn:'E-Logbook accounts handled from the front: add, role, units, password reset, activate/deactivate. The data stays in E-Logbook — only its administrator API is used.' },
  { st:'Sudah jalan', stEn:'Running', jalan:true, nama:'Jadwal Dinas', namaEn:'Duty Roster',
    ket:'Jadwal bulanan per unit, di tab Database Unit → Jadwal Dinas. Bisa diisi tangan atau diimpor dari Excel, PDF, CSV, dan tempelan. Terlihat oleh semua akun; yang boleh mengisi ditentukan per peran di Kelola Akun. Inilah yang mengisi kotak "berdinas hari ini".',
    ketEn:'Monthly roster per unit, under Unit Database → Duty Roster. Filled in by hand or imported from Excel, PDF, CSV, and pasted text. Visible to every account; who may fill it in is decided per role under Manage Accounts. This is what fills the "on duty today" panel.' },
  { st:'Sudah jalan', stEn:'Running', jalan:true, nama:'Kegiatan Berkala', namaEn:'Recurring Jobs',
    ket:'Pekerjaan mingguan, bulanan, triwulan, semesteran, dan tahunan per unit. Tanggalnya ditandai di tabel jadwal dinas, yang lewat jatuh tempo muncul di beranda, dan yang berdinas hari itu diingatkan lewat lonceng di kepala halaman.',
    ketEn:'Weekly and monthly jobs per unit. Their dates are marked on the duty roster table, anything past due appears on the home screen, and whoever is on duty that day is reminded through the bell in the page header.' },
  { st:'Sudah jalan', stEn:'Running', jalan:true, nama:'Personel dan Lisensi', namaEn:'Personnel and Licences',
    ket:'Lisensi, rating, dan sertifikat tiap orang beserta masa berlakunya. Yang tinggal dua bulan atau kurang menyala di beranda dan di lonceng akun orangnya sendiri.',
    ketEn:'Each person’s licences, ratings, and certificates with their validity. Anything with two months or less left lights up on the home screen and in that person’s own notification bell.' },
  { st:'Rencana', stEn:'Planned', nama:'Sparepart', namaEn:'Spare Parts',
    ket:'Persediaan, batas minimum, dan pemakaian yang tersambung ke logbook.',
    ketEn:'Stock, minimum thresholds, and consumption wired into the logbook.' },
  { st:'Rencana', stEn:'Planned', nama:'Sejarah Peralatan', namaEn:'Equipment History',
    ket:'Satu garis waktu per peralatan, dirangkai dari logbook, isu, dan LTK.',
    ketEn:'One timeline per piece of equipment, assembled from the logbook, issues, and LTK.' },
  { st:'Rencana', stEn:'Planned', nama:'Galeri Foto Peralatan', namaEn:'Equipment Photo Gallery',
    ket:'Foto tiap fasilitas beserta lokasinya, dipakai sebagai wajah beranda.',
    ketEn:'A photo of each facility with its location, used as the face of the home screen.' },
  { st:'Rencana', stEn:'Planned', nama:'Dokumen Peralatan', namaEn:'Equipment Documents',
    ket:'Manual, sertifikat kalibrasi, dan berita acara yang menempel pada peralatannya. Alurnya sudah bisa dicoba di tab Dokumen.',
    ketEn:'Manuals, calibration certificates, and handover records attached to their equipment. The flow can already be tried on the Documents tab.' }
];

