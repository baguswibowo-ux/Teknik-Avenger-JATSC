/**
 * Titik masuk untuk Vercel.
 *
 * Vercel tidak menjalankan server yang hidup terus-menerus. Ia memanggil
 * fungsi ini untuk tiap permintaan, jadi yang dibutuhkan cuma handler —
 * bukan proses yang memanggil app.listen().
 *
 * server.js sudah tahu bedanya: ia hanya menyalakan port kalau memang
 * dijalankan langsung. Diimpor dari sini, ia cukup mengembalikan app-nya.
 */
export { default } from '../server.js';
