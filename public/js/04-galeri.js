/* =======================================================================
   GALERI FOTO — dokumentasi kegiatan per unit

   Fotonya sungguhan, di public/foto/<unit>/. Galerinya milik dashboard ini,
   bukan E-Logbook — di sana modulnya memang belum ada.

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

