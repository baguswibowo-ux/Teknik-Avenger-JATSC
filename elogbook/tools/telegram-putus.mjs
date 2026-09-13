/**
 * LEPAS TAUTAN TELEGRAM SATU ATAU BEBERAPA AKUN.
 *
 *   node elogbook/tools/telegram-putus.mjs uji.teknisi uji.pejabat uji.ph
 *
 * Mengosongkan chat_id dan kode taut akun-akun itu di database yang dipakai
 * folder ini (elogbook/data/elogbook.db, atau ELOGBOOK_DATA_DIR). Akunnya
 * sendiri tidak disentuh — hanya sambungan ke Telegram-nya yang dilepas, jadi
 * bot berhenti mengirim apa pun ke chat itu sampai orangnya menautkan lagi.
 *
 * Dibuat untuk akun uji (uji.teknisi dkk.) yang sempat ditautkan ke ponsel
 * sungguhan waktu mencoba bot: tombol Putuskan di Profil sudah dihapus, jadi
 * tidak ada jalan lain dari layar. Aman dijalankan selagi server hidup —
 * SQLite mengantre penulisannya.
 */

import { db, putusTautanTelegram, statusTautanTelegram } from '../db.js';

const daftar = process.argv.slice(2).map((s) => String(s).trim()).filter(Boolean);
if (!daftar.length) {
  console.error('Sebutkan username yang tautannya mau dilepas, misalnya: uji.teknisi uji.pejabat uji.ph');
  process.exit(1);
}

db.exec('PRAGMA busy_timeout = 5000');
for (const u of daftar) {
  const sebelum = statusTautanTelegram(u);
  putusTautanTelegram(u);
  console.log(`${u}: ${sebelum.tertaut ? 'tautan dilepas' : 'memang belum tertaut, tidak ada yang diubah'}`);
}
