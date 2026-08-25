/* E-Logbook · js/06-keadaan.js — Data yang dipakai bersama seluruh tab dan unit yang sedang dibuka
   Dimuat dari index.html sesuai nomor berkas; urutannya berpengaruh. */

let entries = [];
let dcHistory = [];
let issues = [];

/* Daftar gedung untuk catatan logbook. Diisi server saat memuat data; nilai di
   bawah hanya penyangga supaya form tetap terisi kalau data belum sampai. */
let lokasiPilihan = ['JATSC', 'New JATSC'];

let users = [];
let monitoring = [];
let ltkList = [];
let bapbList = [];
let dsList = [];
let berkalaList = [];

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
