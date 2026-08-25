/**
 * MENJALANKAN SEMUANYA SEKALIGUS
 *
 * Sejak E-Logbook disalin ke dalam folder ini (elogbook/), satu perintah cukup
 * untuk menyalakan keduanya:
 *
 *   node jalankan-semua.js          →  Dashboard  http://localhost:3100
 *                                      (E-Logbook jalan sebagai komponen internal,
 *                                       dibuka pengguna lewat /logbook/ di dashboard)
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

import { spawn, execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Cari lalu matikan proses yang masih memegang salah satu port ini. Dipanggil
 * SEBELUM anak dinyalakan.
 *
 * Kenapa perlu: sesi sebelumnya kadang tidak menutup port dengan bersih —
 * terminal ditutup paksa, mesin di-hibernate, atau anaknya keluar tanpa
 * ke SIGINT. Yang tinggal: satu proses zombie yang memegang port dengan kode
 * LAMA. `node jalankan-semua.js` kemudian melihat port terpakai dan gagal;
 * atau lebih buruk, anaknya berhasil naik di port lain (kalau autoPort aktif
 * di harness dev) dan dashboard mengarah ke sana. Yang terlihat pengguna:
 * fitur baru tidak muncul, dan tidak ada satu pun galat yang menyebutkan
 * kenapa.
 *
 * Hanya Windows yang punya `netstat -ano` + `taskkill` seperti ini. Di POSIX
 * dilewati — pengguna Linux/macOS bisa memakai `lsof -ti :3000 | xargs kill`
 * sendiri kalau perlu.
 */
function bersihkanPortLama(port) {
  if (process.platform !== 'win32') return;
  try {
    const keluaran = execSync(`netstat -ano | findstr "LISTENING" | findstr ":${port} "`,
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const pids = new Set();
    for (const baris of keluaran.split('\n')) {
      const m = baris.trim().match(/\s(\d+)\s*$/);
      if (m) pids.add(m[1]);
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
        console.log(`  ⟲ port ${port}: proses lama (PID ${pid}) dimatikan.`);
      } catch { /* proses sudah mati sendiri di sela ini — abaikan */ }
    }
  } catch { /* tidak ada yang memegang port ini — bagus, itu yang diharapkan */ }
}

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

// Bersihkan lebih dulu — kalau ada zombie di port ini, ia menahan naiknya
// server baru dan pengguna tidak tahu kenapa halamannya tidak berubah.
bersihkanPortLama(PORT_ELOG);
bersihkanPortLama(PORT_DASH);

nyalakan('e-logbook', path.join(ELOG, 'server.js'), ELOG, { PORT: PORT_ELOG });

// Dashboard menyusul sebentar kemudian: pemeriksaan /api/me di kartu masuk
// terjadi saat halaman dibuka, bukan saat server ini menyala, jadi jeda ini
// hanya merapikan urutan barisnya di terminal.
setTimeout(() => {
  nyalakan('dashboard', path.join(ROOT, 'server.js'), ROOT, {
    PORT: PORT_DASH,
    ELOGBOOK_ASAL: process.env.ELOGBOOK_ASAL || `http://127.0.0.1:${PORT_ELOG}`
  });
  // Hanya satu URL yang dicetak: pintu masuk untuk pengguna adalah dashboard.
  // E-Logbook tetap jalan sebagai komponen internal di port ${PORT_ELOG}, tapi
  // menyebutnya di sini cuma bikin orang bingung mana yang harus dibuka.
  console.log(`\n  Buka:  http://localhost:${PORT_DASH}/logbook/\n`);
}, 600);
