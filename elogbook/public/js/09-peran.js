/* E-Logbook · js/09-peran.js — Apa yang boleh dilihat dan ditekan tiap peran
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh. */

/* ============== PERAN PEMAKAI ============== */
/* Menyembunyikan tombol hanya membuat layar teknisi rapi — yang benar-benar
   menahan perubahan adalah server, yang menolak fungsi admin dengan 403. */
function adminAktif(){ return userSaatIni?.role === 'admin'; }
/** Pejabat hanya melihat: seluruh unit terbuka, tapi tidak ada tombol menambah. */
function pejabatAktif(){ return userSaatIni?.role === 'pejabat'; }
/* Sepadan dengan PERAN_TULIS di server.js — kalau keduanya berselisih, yang
   kalah adalah layar: tombolnya tampil lalu permintaannya ditolak 403. */
const PERAN_TULIS = new Set(['admin', 'adminunit', 'pic', 'teknisi']);
function bolehMenulis(){ return PERAN_TULIS.has(userSaatIni?.role); }

/** Menyunting catatan yang sudah tersimpan: admin, atau pembuat aslinya
    sendiri — bukan sekadar siapa saja yang boleh menulis di unit itu. */
function bolehSuntingCatatan(dibuatOlehUsername){
  if(adminAktif()) return true;
  if(!bolehMenulis()) return false;
  return !!userSaatIni && !!dibuatOlehUsername && userSaatIni.username === dibuatOlehUsername;
}

function terapkanPeran(){
  document.body.classList.toggle('peran-admin', adminAktif());
  document.body.classList.toggle('peran-teknisi', !!userSaatIni && !adminAktif() && !pejabatAktif());
  document.body.classList.toggle('peran-pejabat', pejabatAktif());
  // Tombol penambah data disembunyikan dari pejabat. Yang menahan sebenarnya
  // tetap server, yang menolak seluruh fungsi tulis dengan 403.
  document.body.classList.toggle('tanpa-tulis', !!userSaatIni && !bolehMenulis());
}

/* ---------- Jejak waktu input sebenarnya (administrator saja) ----------
   Tanggal dan jam di setiap catatan diketik sendiri oleh yang mengisi, jadi
   keduanya belum tentu sama dengan kapan barisnya benar-benar masuk ke server.
   Selisih itu wajar untuk catatan yang memang disusulkan, tapi hanya bisa
   dinilai kalau angkanya kelihatan. Yang berkepentingan menilai adalah
   administrator — teknisi yang sedang mengisi tidak perlu melihatnya, jadi
   seluruh jejak di bawah ini hanya digambar untuk peran admin.

   Angkanya datang dari kolom dibuat_pada di server, bukan dari jam perangkat
   yang mengirim — jadi tidak bisa diatur dari sisi pengisi. */

/* Ambangnya sengaja tidak sama untuk kedua arah, karena kedua arah itu tidak
   sama beratnya. Catatan yang diketik BELAKANGAN memang lumrah — dinas malam
   sering baru sempat diketik pagi harinya — jadi selisih beberapa jam belum
   berarti apa-apa. Sebaliknya, catatan yang diketik SEBELUM waktu yang
   ditulisnya tidak punya penjelasan yang wajar: kejadiannya belum terjadi
   waktu barisnya dikirim. Yang ditoleransi di arah itu hanya selisih jam
   perangkat, bukan selisih kerja. */
const BATAS_SUSULAN_MS = 2 * 60 * 60 * 1000;   // diketik belakangan — wajar
const BATAS_DINI_MS = 5 * 60 * 1000;           // diketik mendahului — nyaris tak wajar

/** "10 Agu 2026 04:54" dari stempel ISO server. Selalu UTC, seperti sisa aplikasi. */
function waktuSingkat(iso){
  const d = new Date(iso);
  if(isNaN(d)) return '';
  const jj = String(d.getUTCHours()).padStart(2,'0');
  const mm = String(d.getUTCMinutes()).padStart(2,'0');
  return `${d.getUTCDate()} ${T('bulan')[d.getUTCMonth()]} ${d.getUTCFullYear()} ${jj}:${mm}`;
}

/** Lama selisih dalam bentuk pendek: "4j 19m", "45m". */
function jamMenitTeks(ms){
  const menit = Math.round(ms / 60000);
  const j = Math.floor(menit / 60), m = menit % 60;
  return j ? `${j}j${m ? ' ' + m + 'm' : ''}` : `${m}m`;
}

/**
 * Lencana selisih antara waktu yang tertulis di catatan dan waktu barisnya
 * masuk. Kosong kalau selisihnya masih wajar — lencana yang selalu muncul
 * cepat berubah jadi hiasan yang tidak dibaca lagi.
 *
 * `acuan` boleh "YYYY-MM-DD" (catatan yang hanya bertanggal) atau
 * "YYYY-MM-DDTHH:MM" (catatan yang juga berjam).
 */
function selisihInputHtml(dibuatPada, acuan){
  if(!acuan) return '';
  const masuk = new Date(dibuatPada);
  const berjam = String(acuan).length > 10;
  const tertulis = new Date(berjam ? acuan + ':00Z' : acuan + 'T00:00:00Z');
  if(isNaN(masuk) || isNaN(tertulis)) return '';

  let arah, teks;
  if(berjam){
    const beda = masuk - tertulis;
    // Positif: diketik setelah waktu yang tertulis. Negatif: mendahuluinya.
    if(beda >= 0 ? beda < BATAS_SUSULAN_MS : -beda < BATAS_DINI_MS) return '';
    arah = beda; teks = jamMenitTeks(Math.abs(beda));
  }else{
    // Tanpa jam, satu-satunya yang bisa dibandingkan adalah tanggalnya.
    const hari = Math.floor((masuk - tertulis) / 86400000);
    if(hari === 0) return '';
    arah = hari; teks = `${Math.abs(hari)} ${T('jejakHari')}`;
  }

  const susulan = arah > 0;
  return `<span class="jejak-selisih ${susulan ? 'susulan' : 'dini'}"
                title="${T(susulan ? 'jejakSusulan' : 'jejakDini')}">${susulan ? '+' : '−'}${teks}</span>`;
}

/** Stempel waktu input, hanya untuk administrator. */
function jejakInputHtml(dibuatPada, acuan){
  if(!adminAktif() || !dibuatPada) return '';
  const teks = waktuSingkat(dibuatPada);
  if(!teks) return '';
  return `<span class="jejak-input" title="${T('jejakDirekam')}">⏱ ${teks} UTC</span>`
       + selisihInputHtml(dibuatPada, acuan);
}

/** Baris "diinput oleh" — jejak siapa yang memasukkan catatan, dan (untuk
    administrator) kapan barisnya benar-benar masuk ke server. */
function diinputOlehHtml(nama, dibuatPada, acuan){
  const jejak = jejakInputHtml(dibuatPada, acuan);
  if(!nama && !jejak) return '';
  const oleh = nama ? `${T('diinputOleh')} <b>${escapeHtml(nama)}</b>` : '';
  return `<div class="diinput-oleh">${oleh}${jejak}</div>`;
}
