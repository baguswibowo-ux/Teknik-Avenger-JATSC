/**
 * ARAHKAN SEMUA NOTIFIKASI TELEGRAM DI SALINAN UJI KE SATU AKUN.
 *
 *   node elogbook/tools/telegram-ke-satu-akun.mjs --akun 10012550 --dari uji.teknisi --ya
 *   node elogbook/tools/telegram-ke-satu-akun.mjs --akun 10012550 --chat 123456789 --ya
 *
 * Untuk server uji yang memakai salinan database produksi DAN token bot yang
 * sama dengan produksi (mengirim saja, tanpa polling). Salinan itu membawa
 * chat_id semua orang yang sudah menautkan Telegram-nya — kalau dibiarkan,
 * pengingat percobaan sampai ke ponsel teknisi sungguhan.
 *
 * Yang dilakukan pada database di folder tempat alat ini berada
 * (elogbook/data/elogbook.db, jadi worktree tempat ia dijalankan):
 *   1. chat_id semua akun LAIN dikosongkan;
 *   2. akun --akun diberi chat_id dari akun --dari (atau angka --chat).
 * Jadi satu-satunya ponsel yang menerima kiriman server uji adalah yang
 * chat-nya disebut di sini.
 *
 * Wajib --ya, dan jalur databasenya dicetak dulu: alat ini mengubah data, dan
 * kalau dijalankan dari folder produksi ia akan mengosongkan tautan Telegram
 * semua orang di sana. Baca jalurnya sebelum mengetik --ya.
 */

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const DB = path.join(DIR, '..', 'data', 'elogbook.db');

const arg = process.argv.slice(2);
const ambil = (nama) => { const i = arg.indexOf(nama); return i >= 0 ? String(arg[i + 1] || '').trim() : ''; };
const akun = ambil('--akun');
const dari = ambil('--dari');
const chatArg = ambil('--chat');
const ya = arg.includes('--ya');

console.log('Database:', path.resolve(DB));
if (!akun || (!dari && !chatArg)) {
  console.error('Sebutkan --akun <username> dan salah satu dari --dari <username> atau --chat <chat_id>.');
  process.exit(1);
}
if (!fs.existsSync(DB)) { console.error('Database tidak ada di jalur itu.'); process.exit(1); }
if (!ya) {
  console.error('Tidak ada yang diubah. Periksa jalur database di atas — kalau memang salinan uji, ulangi dengan --ya.');
  process.exit(1);
}

const db = new DatabaseSync(DB);
const ada = db.prepare('SELECT username, nama FROM users WHERE username = ?').get(akun);
if (!ada) { console.error(`Akun ${akun} tidak ada.`); process.exit(1); }

let chat = chatArg;
if (!chat) {
  const r = db.prepare('SELECT chat_id FROM telegram_akun WHERE username = ?').get(dari);
  chat = (r && r.chat_id) || '';
  if (!chat) { console.error(`Akun ${dari} belum punya chat_id.`); process.exit(1); }
}

const kini = new Date().toISOString();
db.exec('BEGIN');
const dikosongkan = db.prepare("UPDATE telegram_akun SET chat_id = '' WHERE chat_id <> ''").run().changes;
const punya = db.prepare('SELECT username FROM telegram_akun WHERE username = ?').get(akun);
if (punya) {
  db.prepare("UPDATE telegram_akun SET chat_id = ?, tautan_token = '', ditautkan_pada = ? WHERE username = ?")
    .run(chat, kini, akun);
} else {
  db.prepare(`INSERT INTO telegram_akun (username, chat_id, tautan_token, ditautkan_pada, dibuat_pada)
              VALUES (?, ?, '', ?, ?)`).run(akun, chat, kini, kini);
}
db.exec('COMMIT');
console.log(`${dikosongkan} tautan dikosongkan; ${akun} (${ada.nama}) kini satu-satunya yang menerima kiriman.`);
