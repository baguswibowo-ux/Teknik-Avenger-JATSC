/**
 * SALIN ASET STATIS E-LOGBOOK KE public/logbook/ — HANYA UNTUK VERCEL
 *
 * Di Vercel, semua /logbook/* diteruskan ke Serverless Function lewat rewrites
 * di vercel.json. Itu berarti 45-an berkas CSS/JS yang dipanggil index.html
 * E-Logbook ikut dilayani fungsi, dan setiap muat halaman yang cache tepinya
 * sudah terbuang membangunkan fungsi 45 kali hanya untuk menyalin berkas.
 * Grafik Fluid Active CPU 6 Sep 2026: 3 jam 29 menit dari jatah 4 jam.
 *
 * Vercel memeriksa filesystem (folder public/) SEBELUM menerapkan rewrites.
 * Jadi kalau salinan elogbook/public/ ada di public/logbook/, permintaan
 * /logbook/js/07-unit.js jatuh ke CDN statis dan tidak pernah menyentuh fungsi.
 * Yang tetap lewat fungsi hanya yang memang dinamis: /logbook/api/*,
 * /logbook/uploads/*, dan /logbook/avenger-tautan.js.
 *
 * Dijalankan sebagai buildCommand di vercel.json. Di komputer sendiri tidak
 * perlu — server.js meneruskan /logbook/* ke proses E-Logbook, dan folder
 * hasil salinan ini diabaikan .gitignore.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SUMBER = path.join(ROOT, 'elogbook', 'public');
const TUJUAN = path.join(ROOT, 'public', 'logbook');

if (!fs.existsSync(SUMBER)) {
  console.error('elogbook/public tidak ditemukan di ' + SUMBER);
  process.exit(1);
}

fs.rmSync(TUJUAN, { recursive: true, force: true });
fs.cpSync(SUMBER, TUJUAN, { recursive: true });

let jumlah = 0;
const hitung = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) e.isDirectory() ? hitung(path.join(d, e.name)) : jumlah++; };
hitung(TUJUAN);
console.log(`Aset statis E-Logbook disalin: ${jumlah} berkas → public/logbook/`);
