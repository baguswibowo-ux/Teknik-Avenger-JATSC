/**
 * Kelola akun pengguna dari command line.
 *
 *   npm run user -- list
 *   npm run user -- add budi "Budi Santoso" [teknisi|admin]
 *   npm run user -- passwd budi
 *   npm run user -- disable budi
 *   npm run user -- enable budi
 *
 * Password tidak diketik di baris perintah (supaya tidak tersimpan di history
 * shell) — akan diminta lewat prompt, atau dibuatkan acak dengan --auto.
 */

import readline from 'node:readline';
import crypto from 'node:crypto';
import { createUser, setPassword, setAktif, listUsers, getUserByUsername } from '../db.js';

const [, , perintah, ...arg] = process.argv;
const auto = arg.includes('--auto');
const args = arg.filter(a => a !== '--auto');

function tanyaPassword(label) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(label, (jawab) => { rl.close(); resolve(jawab.trim()); });
  });
}

async function ambilPassword() {
  if (auto) {
    const p = crypto.randomBytes(6).toString('base64url');
    console.log('Password dibuat otomatis: ' + p);
    return p;
  }
  const p1 = await tanyaPassword('Password baru: ');
  if (p1.length < 6) { console.error('Password minimal 6 karakter.'); process.exit(1); }
  const p2 = await tanyaPassword('Ulangi password: ');
  if (p1 !== p2) { console.error('Password tidak sama.'); process.exit(1); }
  return p1;
}

switch (perintah) {
  case 'list': {
    const rows = listUsers();
    if (!rows.length) { console.log('Belum ada pengguna.'); break; }
    console.log('USERNAME'.padEnd(18) + 'NAMA'.padEnd(28) + 'ROLE'.padEnd(10) + 'STATUS');
    for (const u of rows) {
      console.log(
        String(u.username).padEnd(18) +
        String(u.nama || '-').padEnd(28) +
        String(u.role).padEnd(10) +
        (u.aktif ? 'aktif' : 'nonaktif')
      );
    }
    break;
  }

  case 'add': {
    const [username, nama, role] = args;
    if (!username) { console.error('Pemakaian: npm run user -- add <username> "<Nama Lengkap>" [teknisi|admin]'); process.exit(1); }
    if (getUserByUsername(username)) { console.error(`Username "${username}" sudah ada.`); process.exit(1); }
    const password = await ambilPassword();
    createUser({ username, password, nama: nama || '', role: role === 'admin' ? 'admin' : 'teknisi' });
    console.log(`Pengguna "${username}" dibuat.`);
    break;
  }

  case 'passwd': {
    const [username] = args;
    if (!username) { console.error('Pemakaian: npm run user -- passwd <username>'); process.exit(1); }
    if (!getUserByUsername(username)) { console.error(`Username "${username}" tidak ditemukan.`); process.exit(1); }
    const password = await ambilPassword();
    setPassword(username, password);
    console.log(`Password "${username}" diganti.`);
    break;
  }

  case 'disable':
  case 'enable': {
    const [username] = args;
    if (!username) { console.error(`Pemakaian: npm run user -- ${perintah} <username>`); process.exit(1); }
    if (!setAktif(username, perintah === 'enable')) { console.error(`Username "${username}" tidak ditemukan.`); process.exit(1); }
    console.log(`Pengguna "${username}" sekarang ${perintah === 'enable' ? 'aktif' : 'nonaktif'}.`);
    break;
  }

  default:
    console.log(`Perintah tidak dikenal.

  npm run user -- list
  npm run user -- add <username> "<Nama Lengkap>" [teknisi|admin]
  npm run user -- passwd <username>
  npm run user -- disable <username>
  npm run user -- enable <username>

Tambahkan --auto agar password dibuatkan acak, bukan diketik.`);
}
