/**
 * TTD SEBAGAI QR — tanda tangan tidak lagi digambar.
 *
 * Permintaan Bagus 12 Oktober 2026: tanda tangan di seluruh formulir menjadi
 * kode QR yang, kalau dipindai, terbaca tiga baris: unit, nama lengkap, NIK.
 * Menandatangani = menekan tombol saat login; identitasnya diambil server dari
 * sesi, bukan dari apa pun yang dikirim layar.
 *
 * QR-nya TIDAK disimpan sebagai berkas. Yang masuk ke kolom *_ttd adalah
 * alamat gambarnya:
 *
 *     /uploads/qr-ttd/<isi>.<segel>.svg
 *
 * `isi` = [unit, nama, nik] (JSON, base64url); gambarnya dibuat ulang tiap
 * diminta. Bentuknya alamat gambar biasa supaya seluruh layar dan lembar cetak
 * yang sudah ada — yang menampilkan TTD sebagai <img> — tidak perlu tahu
 * bedanya. Di bawah /uploads karena hanya jalur itu (dan /api) yang
 * diteruskan dashboard ke E-Logbook.
 *
 * `segel` = HMAC isi dengan kunci milik server. Tanpa segel, siapa pun yang
 * tahu bentuk alamatnya bisa mengirim "TTD" atas nama orang lain; dengan
 * segel, alamat yang bukan buatan server ditolak saveSignature dan tidak
 * digambar.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { AsyncLocalStorage } from 'node:async_hooks';
import { fileURLToPath } from 'node:url';
import { matriksQr } from '../qr-kode/svg.js';

/** Yang dikirim layar sebagai pengganti goresan: "bubuhkan TTD akun ini". */
export const PENANDA_QR = 'qr:akun';
export const AWALAN_QR = '/uploads/qr-ttd/';

/** Siapa yang sedang memanggil API — diisi dispatcher server.js per permintaan,
    dibaca saveSignature di db.js. Lewat sini supaya identitas penanda tangan
    tidak perlu dioper lewat belasan fungsi simpan, dan tidak bisa datang dari
    badan permintaan. */
export const pemanggil = new AsyncLocalStorage();

let kunci = null;
/** Kunci segel: dibuat sekali, disimpan di folder data. Menggantinya membuat
    seluruh TTD QR yang sudah tersimpan tidak tergambar — jangan dihapus. */
function kunciSegel(dataDir) {
  if (kunci) return kunci;
  const berkas = path.join(dataDir, 'ttd-qr-kunci.txt');
  try {
    kunci = fs.readFileSync(berkas, 'utf8').trim();
  } catch { kunci = ''; }
  if (!kunci) {
    kunci = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(berkas, kunci + '\n', { flag: 'wx' });
  }
  return kunci;
}

const segel = (isi, dataDir) =>
  crypto.createHmac('sha256', kunciSegel(dataDir)).update(isi).digest('base64url').slice(0, 16);

const rapi = (s) => String(s || '').trim().replace(/\s+/g, ' ');

/** Alamat gambar QR untuk satu identitas. NIK boleh kosong (penanda tangan
    tanpa akun): QR-nya lalu hanya memuat unit dan nama. */
export function urlTtdQr({ unit, nama, nik }, dataDir) {
  const isi = Buffer.from(JSON.stringify([rapi(unit), rapi(nama), rapi(nik)])).toString('base64url');
  return `${AWALAN_QR}${isi}.${segel(isi, dataDir)}.svg`;
}

/** { unit, nama, nik } dari alamat buatan urlTtdQr; null kalau bukan, atau
    segelnya tidak cocok. */
export function bacaUrlTtdQr(url, dataDir) {
  const s = String(url || '');
  if (!s.startsWith(AWALAN_QR)) return null;
  const m = /^([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]{16})\.svg$/.exec(s.slice(AWALAN_QR.length));
  if (!m) return null;
  const benar = segel(m[1], dataDir);
  if (!crypto.timingSafeEqual(Buffer.from(m[2]), Buffer.from(benar))) return null;
  try {
    const [unit, nama, nik] = JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8'));
    return { unit: rapi(unit), nama: rapi(nama), nik: rapi(nik) };
  } catch { return null; }
}

/** Baris pertama tiap TTD QR: lembaga yang menerbitkannya. */
export const KOP_QR = 'Perum LPPNPI Cabang JATSC';

/** Yang terbaca saat QR-nya dipindai. */
export function teksTtdQr({ unit, nama, nik }) {
  const baris = [KOP_QR];
  if (unit) baris.push('Unit: ' + unit);
  baris.push('Nama: ' + nama);
  if (nik) baris.push('NIK: ' + nik);
  return baris.join('\n');
}

/* Lambang Avengers di tengah QR — ikon aplikasinya sendiri. Ditanam sebagai
   data URI: SVG yang ditampilkan lewat <img> tidak boleh memuat berkas lain.
   Kalau berkasnya tidak ada, QR-nya tetap jadi, hanya tanpa lambang. */
let lambang = null;
function lambangAvengers() {
  if (lambang !== null) return lambang;
  try {
    const berkas = fileURLToPath(new URL('../public/images/pwa/ikon-192.png', import.meta.url));
    lambang = 'data:image/png;base64,' + fs.readFileSync(berkas).toString('base64');
  } catch { lambang = ''; }
  return lambang;
}

/**
 * Gambar QR-nya, dengan lambang Avengers di tengah.
 *
 * Tingkat koreksi M: lambang menutupi sebagian kotak di tengah, dan M masih
 * terbaca walau ±15% kodenya hilang. Lambang berikut alas putihnya memakan
 * 20% lebar (4% luas) — di bawah batas itu. Bukan Q atau H: untuk empat baris
 * teks yang sama keduanya butuh kotak jauh lebih banyak dan lebih kecil, dan
 * justru ukuran kotak itulah yang menentukan terbaca-tidaknya dari kertas
 * atau layar (dicoba Bagus 12 Oktober 2026: versi H tidak terbaca kamera HP).
 *
 * Lebar dan tinggi ditulis terang: lembar cetak menggambar TTD ke kanvas
 * untuk menghitamkan goresan (ttdToBlack), dan SVG tanpa ukuran digambar
 * peramban ke kotak 300x150 yang sebagiannya tembus pandang — QR-nya lalu
 * dikira goresan dan dihitamkan seluruhnya.
 */
export function svgTtdQr(identitas) {
  const m = matriksQr(teksTtdQr(identitas), 'M');
  const n = m.length, tepi = 4, sisi = n + tepi * 2;
  let d = '';
  m.forEach((baris, r) => baris.forEach((hitam, c) => {
    if (hitam) d += `M${c + tepi} ${r + tepi}h1v1h-1z`;
  }));
  const logo = lambangAvengers();
  const alas = Math.round(sisi * 0.2), gambar = alas - 2;
  const a0 = (sisi - alas) / 2, g0 = (sisi - gambar) / 2;
  const tengah = !logo ? '' :
    `<rect x="${a0}" y="${a0}" width="${alas}" height="${alas}" rx="${alas * 0.2}" fill="#fff"/>`
    + `<clipPath id="k"><rect x="${g0}" y="${g0}" width="${gambar}" height="${gambar}" rx="${gambar * 0.2}"/></clipPath>`
    + `<image href="${logo}" x="${g0}" y="${g0}" width="${gambar}" height="${gambar}" clip-path="url(#k)"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 ${sisi} ${sisi}">`
    + `<rect width="${sisi}" height="${sisi}" fill="#fff"/>`
    + `<path d="${d}" fill="#000" shape-rendering="crispEdges"/>${tengah}</svg>`;
}

/** NIK sebuah akun: username-nya, kalau memang berbentuk nomor pegawai. Akun
    uji dan akun bersama ("uji.teknisi") tidak punya NIK untuk dicantumkan. */
export const nikDariUsername = (username) => (/^\d{5,}$/.test(String(username || '').trim()) ? String(username).trim() : '');
