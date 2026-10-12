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
import { svgQr } from '../qr-kode/svg.js';

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

/** Yang terbaca saat QR-nya dipindai. */
export function teksTtdQr({ unit, nama, nik }) {
  const baris = [];
  if (unit) baris.push('Unit: ' + unit);
  baris.push('Nama: ' + nama);
  if (nik) baris.push('NIK: ' + nik);
  return baris.join('\n');
}

/**
 * Gambar QR-nya. Lebar dan tinggi ditulis terang: lembar cetak menggambar TTD
 * ke kanvas untuk menghitamkan goresan (ttdToBlack), dan SVG tanpa ukuran
 * digambar peramban ke kotak 300x150 yang sebagiannya tembus pandang — QR-nya
 * lalu dikira goresan dan dihitamkan seluruhnya.
 */
export function svgTtdQr(identitas) {
  return svgQr(teksTtdQr(identitas), 'M').replace('<svg ', '<svg width="240" height="240" ');
}

/** NIK sebuah akun: username-nya, kalau memang berbentuk nomor pegawai. Akun
    uji dan akun bersama ("uji.teknisi") tidak punya NIK untuk dicantumkan. */
export const nikDariUsername = (username) => (/^\d{5,}$/.test(String(username || '').trim()) ? String(username).trim() : '');
