/* E-Logbook · js/06-keadaan.js — Data yang dipakai bersama seluruh tab dan unit yang sedang dibuka
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh. */

let entries = [];
let dcHistory = [];
let issues = [];

/* Pemuatan layar hanya membawa catatan TERBARU tiap jenis (batas server, 200).
   Unit yang rajin mencatat melewatinya dalam beberapa minggu — Radtel:
   logbook Agustus–September dan daily check 7–14 Agustus tampak hilang padahal
   utuh di database (16 Okt 2026). Pemuat ini mengambil yang lebih lama dari
   server begitu saringan menjangkau ke belakang, lalu menggabungkannya.

   lengkapSejak: semua catatan bertanggal >= nilai ini sudah termuat; '' =
   seluruh riwayat sudah ada. */
function buatPemuatLama({ fungsi, tanggal, ambil, simpan, map, urut }){
  let lengkapSejak = '';
  let janji = null;   // pemuatan yang sedang berjalan
  const perlu = (dari) => !!lengkapSejak && (!dari || dari < lengkapSejak);
  const pastikan = (dari) => {
    if(!perlu(dari)) return Promise.resolve(false);
    if(janji) return janji.then(() => pastikan(dari));
    const unit = unitAktif;
    janji = gsRun(fungsi, { unit, dari: dari || '', sampai: lengkapSejak })
      .then(res => {
        if(unit !== unitAktif) return false;   // sudah pindah unit
        const ada = new Set(ambil().map(x => x.id));
        const baru = (res && res.rows || []).map(map).filter(x => !ada.has(x.id));
        simpan(ambil().concat(baru).sort(urut));
        lengkapSejak = dari || '';
        return true;
      })
      .finally(() => { janji = null; });
    return janji;
  };
  return {
    perlu, pastikan,
    /** Dipanggil 26-init.js sesudah pemuatan layar. Hari tertua di daftar
        mungkin baru sebagian; ia ikut diambil ulang (tanpa ganda) nanti. */
    setTerpotong(terpotong){
      lengkapSejak = '';
      janji = null;
      const arr = ambil();
      if(!terpotong || !arr.length) return;
      lengkapSejak = arr.reduce((m, x) => { const d = tanggal(x); return d && d < m ? d : m; }, '9999-12-31');
    }
  };
}

/* Daftar gedung untuk catatan logbook. Diisi server saat memuat data; nilai di
   bawah hanya penyangga supaya form tetap terisi kalau data belum sampai. */
let lokasiPilihan = ['JATSC', 'New JATSC'];

let users = [];
let monitoring = [];
let ltkList = [];
let bapbList = [];
let dsList = [];
let berkalaList = [];
/* Batas tautan dokumen per catatan logbook. Diganti nilai dari server saat
   memuat (lihat 26-init.js); angka di sini cuma penyelamat kalau server lama
   belum mengirimnya. */
let batasTautan = 10;

/* Akun pejabat/admin aktif — dipakai menunjuk penerima TTD susulan saat
   mengisi formulir. Kotak masuk TTD milik akun yang sedang masuk, kalau
   perannya memang bisa membubuhkan TTD. Lihat js/20-ttd-pejabat.js. */
let pejabatList = [];
let inboxTtd = [];

/* Akun aktif yang boleh masuk ke unit yang sedang dibuka — dipakai sebagai
   saran <datalist> pada isian nama teknisi mulai baris kedua dan seterusnya.
   Baris pertama tetap otomatis diisi nama pengisi dokumen (lihat 11-logbook,
   14-daily-check-umum, 16-monitoring, 17-ds-test, 18b-bapb, 19-berkala).
   Diisi ulang tiap kali pindah unit, karena daftarnya per unit. */
let teknisiUnitList = [];

/* Unit logbook yang sedang dibuka. Diisi server saat memuat data — kalau masih
   kosong, server memilihkan unit pertama yang boleh dibuka akun ini. */
let unitAktif = '';
let unitSaya = [];
const infoUnit = () => unitSaya.find(u=>u.kode===unitAktif) || null;
