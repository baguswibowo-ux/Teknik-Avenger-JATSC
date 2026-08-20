/* =======================================================================
   TAUTAN KE E-LOGBOOK

   Alamat tombol "Buka E-Logbook" datang dari /_info, dan sekarang bawaannya
   /logbook/ — di dalam asal ini, bukan host E-Logbook yang sungguhan.

   Di sini pernah tertulis bahwa itu tidak bisa dilakukan, alasannya "seluruh
   aset E-Logbook memanggil /css/ dan /js/ dari akar". Itu sudah tidak benar:
   index.html E-Logbook memanggil asetnya secara relatif, jadi dibuka di
   /logbook/ semuanya jatuh di /logbook/css/… dan /logbook/js/… tanpa menyentuh
   /css/ dan /js/ milik dashboard. Penjelasan lengkapnya di server.js, di atas
   JALUR_LOGBOOK.

   Kenapa ini penting, bukan sekadar rapi: tombol yang menyeberang ke host lain
   menyeberangkan pemakainya ke toples cookie yang lain, dan di sana ia bisa
   jadi orang lain — teknisi satu unit di sini, administrator di sana. Menunjuk
   ke dalam asal sendiri berarti sesinya cuma satu, jadi peran dan unitnya
   tidak punya kesempatan untuk berbeda.

   Tetap lewat /_info, bukan ditulis mati di sini: pemasangan yang sengaja
   memisahkan kedua aplikasi mengisi ELOGBOOK_TAUTAN, dan halaman ini tidak
   perlu tahu yang mana yang sedang berlaku.
   ======================================================================= */
let TAUTAN_ELOGBOOK = '';

/* Kemampuan yang tidak selalu ada, dijawab server lewat /_info. Keduanya tidak
   bisa ditebak dari sisi peramban — gagalnya baru ketahuan setelah tombolnya
   terlanjur ditekan, dan itu terlambat. Bawaannya "ada", supaya server lama
   yang belum menjawab kedua kolom ini tetap berperilaku seperti sebelumnya. */
const KEMAMPUAN = { galeriTulis:true, dokumenTulis:true, elogbook:true };

async function muatTautanElogbook(){
  let port = 3000;
  try{
    const r = await fetch('/_info', { cache:'no-store' });
    if(r.ok){
      const j = await r.json();
      if(typeof j.galeriBisaTulis === 'boolean')    KEMAMPUAN.galeriTulis = j.galeriBisaTulis;
      if(typeof j.dokumenBisaTulis === 'boolean')   KEMAMPUAN.dokumenTulis = j.dokumenBisaTulis;
      if(typeof j.elogbookTerjangkau === 'boolean') KEMAMPUAN.elogbook    = j.elogbookTerjangkau;
      // /_info datang setelah srvPeriksa() sempat menulis baris statusnya, jadi
      // barisnya digambar ulang di sini — kalau tidak, saran "jalankan servernya"
      // tertinggal di layar yang memang tidak punya server untuk dijalankan.
      if(!SRV.ada) srvKet();
      if(j.tautanElogbook){ pasangTautanElogbook(j.tautanElogbook); return; }
      if(j.portElogbook) port = j.portElogbook;
    }
  }catch(e){
    console.warn('Info server tidak terbaca, alamat E-Logbook ditebak:', e && e.message || e);
  }
  // hostname yang sedang dipakai, bukan 127.0.0.1: kalau dashboard ini dibuka
  // dari komputer lain, 127.0.0.1 di sana menunjuk komputer itu sendiri.
  pasangTautanElogbook(`${location.protocol}//${location.hostname}:${port}`);
}

function pasangTautanElogbook(alamat){
  TAUTAN_ELOGBOOK = alamat;
  document.querySelectorAll('[data-elogbook]').forEach(a=>{
    a.href = alamat;
    /* Tab yang sama, bukan tab baru. Dulu tab baru, alasannya supaya dashboard
       yang sedang dibaca tidak hilang — tapi jalan pulangnya sekarang ada:
       tombol di kepala E-Logbook kembali ke sini dan sesinya ikut, jadi yang
       ditinggalkan cuma satu ketukan, bukan pekerjaan. Yang tersisa dari tab
       baru cuma tumpukan tab yang tidak pernah ditutup siapa pun.

       target dan rel dilepas, bukan sekadar tidak dipasang: fungsi ini bisa
       dipanggil dua kali pada tautan yang sama (/_info datang belakangan), dan
       atribut dari panggilan pertama akan bertahan kalau tidak dibuang. */
    a.removeAttribute('target');
    a.removeAttribute('rel');
    a.title = 'Membuka ' + alamat;
  });
}

