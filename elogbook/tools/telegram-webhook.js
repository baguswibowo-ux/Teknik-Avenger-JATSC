/**
 * Pasang / periksa / lepas WEBHOOK Telegram dari command line.
 *
 *   node elogbook/tools/telegram-webhook.js bot
 *   node elogbook/tools/telegram-webhook.js info
 *   node elogbook/tools/telegram-webhook.js pasang https://alamat-produksi
 *   node elogbook/tools/telegram-webhook.js hapus
 *
 * Kenapa ada alat ini. Webhook cuma perlu didaftarkan SEKALI per bot, dan
 * pendaftarannya menempel di sisi Telegram — bukan di kode, bukan di env. Di
 * dev lokal ia malah harus TIDAK terpasang: TELEGRAM_POLLING=1 memakai
 * getUpdates, dan Telegram menolak keduanya hidup bersamaan. Jadi urusannya
 * sekali-jalan, tidak pantas jadi tombol di halaman, dan `curl` panjang dengan
 * token di baris perintah akan tersimpan di riwayat shell.
 *
 * `pasang` menambahkan sendiri "/telegram/webhook" di belakang alamat yang
 * diberikan — isi alamat pangkalnya saja (https://…vercel.app). Jalur itu
 * diteruskan dashboard ke E-Logbook lewat JALUR_TERUS di server.js dan lewat
 * rewrites di vercel.json; keduanya harus ada, atau Telegram menembak 404 dan
 * mendiamkannya.
 *
 * TELEGRAM_WEBHOOK_SECRET dibaca dari env yang sama dan ikut didaftarkan.
 * Wajib diisi di produksi: tanpa itu route webhook menerima kiriman siapa pun
 * yang menebak alamatnya.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* env dimuat SEBELUM telegram.js diimpor — modul itu membaca TELEGRAM_BOT_TOKEN
   sekali waktu dimuat, jadi import statis biasa akan menangkap token kosong.
   Dua berkas dicoba supaya alat ini jalan dari mana pun ia dipanggil: .env akar
   (tempat TELEGRAM_* berada, diwariskan jalankan-semua.js) dan elogbook/.env. */
const DIR = path.dirname(fileURLToPath(import.meta.url));
for (const berkas of [
  path.join(DIR, '..', '..', '.env'),
  path.join(DIR, '..', '.env')
]) {
  try { process.loadEnvFile(berkas); } catch { /* tidak ada: lewati */ }
}

const {
  telegramAktif, cekToken, pasangWebhook, infoWebhook, hapusWebhook
} = await import('../../telegram.js');

const [, , perintah, alamat] = process.argv;

if (!telegramAktif()) {
  console.error('TELEGRAM_BOT_TOKEN belum diisi di .env — tidak ada yang bisa diatur.');
  process.exit(1);
}

/** getWebhookInfo dicetak apa adanya; last_error_message di situlah yang
    menjelaskan kalau Telegram gagal menembak alamat kita. */
async function cetakInfo() {
  const info = await infoWebhook();
  if (!info) { console.error('Gagal membaca keadaan webhook (lihat pesan di atas).'); process.exit(1); }
  console.log('Alamat webhook   : ' + (info.url || '(tidak terpasang)'));
  console.log('Menunggu diproses: ' + (info.pending_update_count ?? 0));
  console.log('Secret token     : ' + (info.has_custom_certificate ? '(sertifikat sendiri) ' : '')
    + (info.url ? (process.env.TELEGRAM_WEBHOOK_SECRET ? 'diatur di env' : 'KOSONG — isi di produksi') : '-'));
  if (info.last_error_message) {
    const kapan = info.last_error_date ? new Date(info.last_error_date * 1000).toLocaleString('id-ID') : '';
    console.log('Galat terakhir   : ' + info.last_error_message + (kapan ? ' (' + kapan + ')' : ''));
  }
}

switch (perintah) {
  case 'bot': {
    /* cekToken, bukan botUsername: yang terakhir pulang dari env tanpa
       bertanya ke Telegram, sehingga token yang sudah dicabut ikut dinyatakan
       sah. Pernah kejadian — lihat catatan di telegram.js. */
    const nama = await cekToken();
    if (!nama) { console.error('Token ditolak Telegram — periksa TELEGRAM_BOT_TOKEN.'); process.exit(1); }
    console.log('Token sah. Bot: @' + nama);
    console.log('Tautan taut akan berbentuk: https://t.me/' + nama + '?start=<kode>');
    break;
  }

  case 'info':
    await cetakInfo();
    break;

  case 'pasang': {
    if (!alamat) { console.error('Sebutkan alamat pangkalnya, mis. https://teknik-jatsc.vercel.app'); process.exit(1); }
    const dasar = String(alamat).trim().replace(/\/+$/, '');
    if (!/^https:\/\//i.test(dasar)) { console.error('Alamat harus diawali https:// — Telegram menolak http biasa.'); process.exit(1); }
    if (!process.env.TELEGRAM_WEBHOOK_SECRET) {
      console.warn('Peringatan: TELEGRAM_WEBHOOK_SECRET kosong. Route webhook akan menerima');
      console.warn('kiriman siapa pun yang menebak alamatnya. Isi di env produksi, lalu ulangi.');
    }
    const hasil = await pasangWebhook(dasar + '/telegram/webhook');
    console.log(hasil.pesan);
    if (!hasil.ok) process.exit(1);
    await cetakInfo();
    break;
  }

  case 'hapus': {
    const ok = await hapusWebhook();
    console.log(ok ? 'Webhook dilepas. Mode polling (TELEGRAM_POLLING=1) sekarang boleh dipakai.'
                   : 'Gagal melepas webhook (lihat pesan di atas).');
    if (!ok) process.exit(1);
    break;
  }

  default:
    console.log('Perintah: bot | info | pasang <https://alamat> | hapus');
    console.log('Contoh  : node elogbook/tools/telegram-webhook.js pasang https://teknik-jatsc.vercel.app');
}
