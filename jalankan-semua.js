/**
 * MENJALANKAN SEMUANYA SEKALIGUS
 *
 * Sejak E-Logbook disalin ke dalam folder ini (elogbook/), satu perintah cukup
 * untuk menyalakan keduanya:
 *
 *   node jalankan-semua.js          →  E-Logbook  http://localhost:3000
 *                                      Dashboard  http://localhost:3100
 *
 * Kenapa dua proses, bukan satu app Express yang memuat keduanya:
 * E-Logbook menyajikan halamannya sendiri di akar ("/") dan API-nya di "/api",
 * persis seperti dashboard ini. Menumpuk keduanya dalam satu proses berarti
 * salah satu harus pindah alamat, dan itu menyunting E-Logbook untuk alasan
 * yang bukan permintaan siapa pun. Dua port, dua proses, penerusan /api/* di
 * server.js tetap berlaku apa adanya — bentuk yang sudah terbukti jalan.
 *
 * Anaknya diikat ke induknya: Ctrl+C sekali mematikan keduanya, dan kalau
 * E-Logbook mati duluan, dashboard ikut berhenti daripada meninggalkan layar
 * yang setiap permintaannya 502.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// .env dibaca di sini juga, bukan hanya di server.js: port yang dipakai
// ditentukan sebelum anaknya menyala, jadi .env harus sudah terbaca lebih dulu.
try { process.loadEnvFile?.(); } catch { /* tidak ada .env: pakai bawaan */ }

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const ELOG = path.join(ROOT, 'elogbook');

const PORT_ELOG = process.env.ELOGBOOK_PORT || '3000';
const PORT_DASH = process.env.PORT || '3100';

if (!fs.existsSync(path.join(ELOG, 'server.js'))) {
  console.error('Folder elogbook/ tidak ada di sini.');
  console.error('Salin E-LogBook-Server ke ' + ELOG + ' lebih dulu — lihat README.');
  process.exit(1);
}

/** Semua anak yang sudah dinyalakan, supaya bisa dimatikan bersama-sama. */
const anak = [];
let berhenti = false;

function nyalakan(nama, berkas, cwd, env) {
  const p = spawn(process.execPath, [berkas], {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  // Barisnya diberi awalan supaya jelas keluaran ini milik siapa — dua server
  // yang menulis ke satu terminal tanpa penanda hanya membingungkan.
  const tandai = (aliran, tujuan) => {
    let sisa = '';
    aliran.on('data', (b) => {
      const baris = (sisa + b.toString()).split('\n');
      sisa = baris.pop();
      for (const l of baris) tujuan.write(`[${nama}] ${l}\n`);
    });
  };
  tandai(p.stdout, process.stdout);
  tandai(p.stderr, process.stderr);

  p.on('exit', (kode, sinyal) => {
    if (berhenti) return;
    console.error(`\n[${nama}] berhenti (${sinyal || 'kode ' + kode}). Mematikan sisanya.`);
    matikan(kode === 0 ? 1 : (kode ?? 1));
  });

  anak.push(p);
  return p;
}

function matikan(kode = 0) {
  if (berhenti) return;
  berhenti = true;
  for (const p of anak) { try { p.kill(); } catch { /* sudah mati */ } }
  // Beri jeda supaya anaknya sempat menutup port sebelum prosesnya hilang.
  setTimeout(() => process.exit(kode), 300);
}

process.on('SIGINT', () => matikan(0));
process.on('SIGTERM', () => matikan(0));

console.log('Menyalakan E-Logbook dan Dashboard sekaligus. Ctrl+C untuk berhenti keduanya.\n');

nyalakan('e-logbook', path.join(ELOG, 'server.js'), ELOG, { PORT: PORT_ELOG });

// Dashboard menyusul sebentar kemudian: pemeriksaan /api/me di kartu masuk
// terjadi saat halaman dibuka, bukan saat server ini menyala, jadi jeda ini
// hanya merapikan urutan barisnya di terminal.
setTimeout(() => {
  nyalakan('dashboard', path.join(ROOT, 'server.js'), ROOT, {
    PORT: PORT_DASH,
    ELOGBOOK_ASAL: process.env.ELOGBOOK_ASAL || `http://127.0.0.1:${PORT_ELOG}`
  });
  console.log(`\n  E-Logbook  →  http://localhost:${PORT_ELOG}`);
  console.log(`  Dashboard  →  http://localhost:${PORT_DASH}\n`);
}, 600);
