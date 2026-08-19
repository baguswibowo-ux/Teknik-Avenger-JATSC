/* =======================================================================
   TAUTAN KE E-LOGBOOK

   Dashboard ini di port 3100, E-Logbook di 3000 — dua alamat berbeda bagi
   peramban. Data memang lewat penerusan di server.js, tapi tombol "Buka
   E-Logbook" harus menunjuk aplikasi E-Logbook yang sungguhan, dan itu tidak
   bisa lewat penerusan: seluruh aset E-Logbook memanggil /css/ dan /js/ dari
   akar, yang di sini milik dashboard.

   Dulu tombolnya cukup href="/" karena halaman ini memang disajikan DARI
   E-Logbook. Setelah pindah, "/" berarti dashboard ini sendiri — tombolnya
   hanya memuat ulang halaman yang sedang dibuka.
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

