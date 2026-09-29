/**
 * QR SEBAGAI SVG — dipakai server.js untuk stiker QR sejarah peralatan.
 *
 * Pembuat QR-nya (*.cjs di folder ini) adalah "QRCode for JavaScript" karya
 * Kazuhiko Arase (MIT), dalam bentuk yang dirapikan paket npm qrcode-terminal
 * 0.12.0 (Apache-2.0) — disalin dari salinan yang terpasang bersama npm di PC
 * ini, bukan diunduh. Perubahan kita cuma nama berkas .js → .cjs (proyek ini
 * ESM) beserta require-nya. Lisensinya di LICENSE.
 *
 * Tingkat koreksi M: stiker di ruang peralatan bisa tergores atau berdebu,
 * dan M masih bisa dibaca walau ±15% kodenya rusak.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const QRCode = require('./index.cjs');
const LEVEL = require('./QRErrorCorrectLevel.cjs');

/** Matriks modul (true = hitam) untuk teks. */
export function matriksQr(teks, level = 'M') {
  const qr = new QRCode(-1, LEVEL[level] ?? LEVEL.M);
  qr.addData(String(teks));
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

/** SVG hitam-putih, tepi kosong 4 modul (syarat standar QR). */
export function svgQr(teks, level = 'M') {
  const m = matriksQr(teks, level);
  const n = m.length, tepi = 4, sisi = n + tepi * 2;
  let d = '';
  m.forEach((baris, r) => baris.forEach((hitam, c) => {
    if (hitam) d += `M${c + tepi} ${r + tepi}h1v1h-1z`;
  }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sisi} ${sisi}" shape-rendering="crispEdges">`
    + `<rect width="${sisi}" height="${sisi}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
