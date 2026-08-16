/**
 * Pintu masuk untuk Vercel.
 *
 * Vercel tidak menjalankan server yang menyala terus — ia memanggil fungsi tiap
 * permintaan datang. Aplikasi Express-nya sendiri tidak perlu tahu soal itu:
 * server.js menyalakan listen() hanya kalau dijalankan langsung, dan di sini
 * app-nya cukup diserahkan apa adanya.
 *
 * Satu berkas, satu baris berarti. Kalau nanti dashboard ini pindah ke tempat
 * lain, berkas inilah satu-satunya yang dibuang.
 */
export { default } from '../server.js';
