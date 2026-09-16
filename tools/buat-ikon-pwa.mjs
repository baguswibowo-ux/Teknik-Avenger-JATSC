/**
 * Ikon aplikasi Avengers untuk HP (manifest, layar utama iPhone, lencana
 * notifikasi Android) — digambar dari lambang yang sama dengan presentasi
 * konsep: huruf A emas-jingga di dalam cincin radar sian dengan satu titik.
 *
 *   node tools/buat-ikon-pwa.mjs
 *
 * Menulis public/images/pwa/*.png. Tanpa pustaka gambar: bentuknya cuma
 * poligon, cincin, dan lingkaran, jadi digambar titik demi titik dengan
 * 4×4 sampel per piksel (tepinya halus), lalu dibungkus PNG lewat zlib.
 * Lambangnya asli buatan sendiri — bukan logo Avengers milik Marvel.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const AKAR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TUJUAN = path.join(AKAR, 'public', 'images', 'pwa');

/* ---------- lambang, koordinat kotak 48×48 (sama dengan SVG konsep) ---------- */
const A_LUAR = [[27, 3.5], [39.5, 42], [31.5, 42], [29.2, 34.4], [19.2, 34.4], [16, 42], [8.5, 42]];
const A_LUBANG = [[21, 28.6], [27.4, 28.6], [24.5, 18.8]];
const CINCIN = { cx: 24, cy: 24, r: 18, tebal: 2.6 };
const deg = (x, y) => Math.atan2(y - CINCIN.cy, x - CINCIN.cx) * 180 / Math.PI;
const SUDUT_AWAL = deg(40.5, 17.5);   // titik radar
const SUDUT_AKHIR = deg(30, 7.2);     // ujung dekat puncak A
const RENTANG = (SUDUT_AKHIR + 360) - SUDUT_AWAL;
const TITIK = { x: 40.5, y: 17.5, r: 2.6 };

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const SIAN = hex('#35e0c4'), SIAN_TERANG = hex('#6ef0da');
const EMAS = [[0, hex('#ffd257')], [0.55, hex('#f6971d')], [1, hex('#d9700c')]];

function dalamPoligon(x, y, p) {
  let dalam = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i], [xj, yj] = p[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) dalam = !dalam;
  }
  return dalam;
}

function diCincin(x, y) {
  let d = ((deg(x, y) - SUDUT_AWAL) % 360 + 360) % 360;
  const setengah = CINCIN.tebal / 2;
  if (d <= RENTANG) return Math.abs(Math.hypot(x - CINCIN.cx, y - CINCIN.cy) - CINCIN.r) <= setengah;
  // Ujung bulat
  const ujung = (s) => [CINCIN.cx + CINCIN.r * Math.cos(s * Math.PI / 180), CINCIN.cy + CINCIN.r * Math.sin(s * Math.PI / 180)];
  return [SUDUT_AWAL, SUDUT_AKHIR].some((s) => { const [ux, uy] = ujung(s); return Math.hypot(x - ux, y - uy) <= setengah; });
}

function warnaEmas(y) {
  const t = Math.min(1, Math.max(0, (y - 3.5) / 38.5));
  for (let i = 1; i < EMAS.length; i++) {
    const [t0, c0] = EMAS[i - 1], [t1, c1] = EMAS[i];
    if (t <= t1) { const k = (t - t0) / (t1 - t0); return c0.map((v, n) => v + (c1[n] - v) * k); }
  }
  return EMAS[EMAS.length - 1][1];
}

/** Warna lambang di satu titik, atau null kalau kosong. */
function lambang(x, y) {
  if (Math.hypot(x - TITIK.x, y - TITIK.y) <= TITIK.r) return SIAN_TERANG;
  if (dalamPoligon(x, y, A_LUAR) && !dalamPoligon(x, y, A_LUBANG)) return warnaEmas(y);
  if (diCincin(x, y)) return SIAN;
  return null;
}

/* ---------- gambar ---------- */
function gambar(ukuran, { skala, latar, putih = false }) {
  const piksel = Buffer.alloc(ukuran * ukuran * 4);
  const s = ukuran * skala / 48, geser = (ukuran - 48 * s) / 2;
  const N = 4;
  for (let py = 0; py < ukuran; py++) {
    for (let px = 0; px < ukuran; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < N; sy++) {
        for (let sx = 0; sx < N; sx++) {
          const X = px + (sx + 0.5) / N, Y = py + (sy + 0.5) / N;
          const w = lambang((X - geser) / s, (Y - geser) / s);
          let c;
          if (w) c = putih ? [255, 255, 255, 255] : [...w, 255];
          else if (latar) {
            // Gradien diagonal gelap, sama dengan kotak ikon di presentasi.
            const t = (X + Y) / (2 * ukuran);
            c = [18 + (5 - 18) * t, 32 + (10 - 32) * t, 58 + (20 - 58) * t, 255];
          } else c = [0, 0, 0, 0];
          r += c[0] * c[3]; g += c[1] * c[3]; b += c[2] * c[3]; a += c[3];
        }
      }
      const i = (py * ukuran + px) * 4;
      if (a) { piksel[i] = Math.round(r / a); piksel[i + 1] = Math.round(g / a); piksel[i + 2] = Math.round(b / a); }
      piksel[i + 3] = Math.round(a / (N * N));
    }
  }
  return png(ukuran, ukuran, piksel);
}

function png(w, h, rgba) {
  const baris = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy(baris, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  const potong = (jenis, data) => {
    const pj = Buffer.alloc(4); pj.writeUInt32BE(data.length);
    const isi = Buffer.concat([Buffer.from(jenis, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(isi) >>> 0);
    return Buffer.concat([pj, isi, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;   // 8 bit, RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    potong('IHDR', ihdr), potong('IDAT', zlib.deflateSync(baris, { level: 9 })), potong('IEND', Buffer.alloc(0))
  ]);
}

const DAFTAR = [
  ['ikon-192.png', 192, { skala: 0.78, latar: true }],
  ['ikon-512.png', 512, { skala: 0.78, latar: true }],
  // Maskable: Android memotongnya jadi lingkaran/kotak membulat — lambang
  // harus di dalam 80% tengah.
  ['ikon-maskable-512.png', 512, { skala: 0.58, latar: true }],
  ['apple-touch-icon.png', 180, { skala: 0.72, latar: true }],
  // Lencana bilah status Android: putih di atas transparan, warnanya diabaikan.
  ['lencana-96.png', 96, { skala: 0.94, latar: false, putih: true }]
];

fs.mkdirSync(TUJUAN, { recursive: true });
for (const [nama, ukuran, opsi] of DAFTAR) {
  const data = gambar(ukuran, opsi);
  fs.writeFileSync(path.join(TUJUAN, nama), data);
  console.log(`${nama.padEnd(24)} ${ukuran}×${ukuran}  ${(data.length / 1024).toFixed(1)} KB`);
}
