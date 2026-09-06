/**
 * E-LOGBOOK — NOTIFIKASI TELEGRAM (lapisan transport)
 *
 * Modul kecil yang berdiri sendiri: hanya mengurus bicara dengan Bot API
 * Telegram (kirim pesan, pasang webhook, baca update) dan menyusun teks
 * notifikasi. TIDAK menyentuh database — pemetaan akun ↔ chat_id ada di db.js /
 * db-pg.js, dan server.js yang menjembatani keduanya.
 *
 * FEATURE-FLAG. Tanpa TELEGRAM_BOT_TOKEN, telegramAktif() bernilai false dan
 * seluruh fungsi menjadi no-op yang aman — aplikasi berjalan persis seperti
 * sebelum fitur ini ada. Token diisi lewat env, tidak pernah ditanam di kode:
 *   TELEGRAM_BOT_TOKEN      token dari @BotFather (rahasia)
 *   TELEGRAM_BOT_USERNAME   username bot tanpa @ (untuk tautan t.me/…)
 *   TELEGRAM_WEBHOOK_SECRET string acak; dicocokkan dengan header webhook
 *
 * Semua panggilan jaringan dibungkus try/catch dan mengembalikan null/false
 * saat gagal — notifikasi bersifat "kirim kalau bisa", tidak boleh menjatuhkan
 * alur penyimpanan formulir hanya karena Telegram sedang tidak terjangkau.
 */

const TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
const WEBHOOK_SECRET = String(process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();
const BOT_USERNAME_ENV = String(process.env.TELEGRAM_BOT_USERNAME || '').trim().replace(/^@/, '');

const API_BASE = TOKEN ? `https://api.telegram.org/bot${TOKEN}` : '';

/** Diisi sekali dari getMe kalau env tidak menyebut username bot. */
let botUsernameCache = BOT_USERNAME_ENV;

export const telegramAktif = () => !!TOKEN;
export const telegramWebhookSecret = () => WEBHOOK_SECRET;

/** Panggilan mentah ke Bot API. Mengembalikan `result` bila ok, else null. */
async function panggil(method, payload) {
  if (!TOKEN) return null;
  try {
    const res = await fetch(`${API_BASE}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {})
    });
    const data = await res.json().catch(() => null);
    if (!data || data.ok !== true) {
      console.error('[telegram]', method, data?.description || ('HTTP ' + res.status));
      return null;
    }
    return data.result;
  } catch (err) {
    console.error('[telegram]', method, err?.message || err);
    return null;
  }
}

/** Kirim satu pesan HTML ke sebuah chat. false kalau fitur mati / gagal. */
export async function kirimPesan(chatId, teks) {
  if (!TOKEN || !chatId || !teks) return false;
  const r = await panggil('sendMessage', {
    chat_id: String(chatId),
    text: String(teks),
    parse_mode: 'HTML',
    disable_web_page_preview: true
  });
  return !!r;
}

/** Username bot (untuk tautan t.me/<bot>?start=…). Dari env, atau getMe sekali. */
export async function botUsername() {
  if (botUsernameCache) return botUsernameCache;
  if (!TOKEN) return '';
  const me = await panggil('getMe', {});
  botUsernameCache = String(me?.username || '');
  return botUsernameCache;
}

/** Daftarkan webhook ke Telegram. url = alamat publik penuh /telegram/webhook. */
export async function pasangWebhook(url) {
  if (!TOKEN) return { ok: false, pesan: 'Token bot belum diatur.' };
  const payload = { url: String(url), allowed_updates: ['message'] };
  if (WEBHOOK_SECRET) payload.secret_token = WEBHOOK_SECRET;
  const r = await panggil('setWebhook', payload);
  return { ok: !!r, pesan: r ? 'Webhook terpasang: ' + url : 'Gagal memasang webhook (lihat log server).' };
}

/** Keadaan webhook sekarang — untuk tombol diagnosa admin. */
export async function infoWebhook() {
  return await panggil('getWebhookInfo', {});
}

/** Lepas webhook. Wajib sebelum getUpdates — keduanya saling meniadakan. */
export async function hapusWebhook() {
  return await panggil('deleteWebhook', { drop_pending_updates: false });
}

/* ============== MODE POLLING (khusus DEV LOKAL) ==============
 * Webhook butuh alamat publik HTTPS yang tidak dimiliki localhost. Untuk uji di
 * laptop, server MENARIK update dari Telegram (getUpdates long-poll) alih-alih
 * menunggu ditembak. Dinyalakan dengan env TELEGRAM_POLLING=1, dan HANYA pada
 * proses yang hidup terus (npm start) — jangan sekali-kali di serverless Vercel,
 * yang tidak punya proses latar untuk menampungnya. */

export function telegramModePolling() {
  return String(process.env.TELEGRAM_POLLING || '').trim() === '1';
}

/** Satu getUpdates long-poll. null saat gagal/putus — pemanggil menjeda lalu ulang. */
async function ambilUpdates(offset) {
  if (!TOKEN) return null;
  try {
    const res = await fetch(`${API_BASE}/getUpdates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offset, timeout: 30, allowed_updates: ['message'] }),
      // Sedikit di atas timeout long-poll 30 dtk supaya koneksi yang benar-benar
      // menggantung diputus, bukan menahan loop selamanya.
      signal: AbortSignal.timeout(40000)
    });
    const data = await res.json().catch(() => null);
    if (!data || data.ok !== true) return null;
    return data.result;
  } catch (err) {
    return null;
  }
}

/** Jaga agar loop tidak dobel kalau start terpanggil dua kali. */
let pollingJalan = false;

/** Loop polling. onUpdate(update) dipanggil per update; galatnya ditelan supaya
    satu pesan rusak tidak menghentikan loop. Tidak pernah kembali. */
export async function mulaiPolling(onUpdate) {
  if (!TOKEN || pollingJalan) return;
  pollingJalan = true;
  await hapusWebhook();
  console.log('[telegram] mode polling aktif (dev lokal) — menunggu pesan bot.');
  let offset = 0;
  for (;;) {
    const hasil = await ambilUpdates(offset);
    if (hasil === null) {
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }
    for (const up of hasil) {
      offset = up.update_id + 1;
      try { await onUpdate(up); }
      catch (err) { console.error('[telegram polling]', err?.message || err); }
    }
  }
}

/**
 * Ambil inti dari satu update Telegram. Mengembalikan { chatId, teks, token,
 * perintahStart, nama } atau null kalau bukan pesan. `token` adalah argumen di
 * belakang /start (kode taut sekali-pakai) bila ada.
 */
export function bacaUpdate(update) {
  const msg = update?.message || update?.edited_message;
  if (!msg || !msg.chat) return null;
  const teks = String(msg.text || '').trim();
  const m = teks.match(/^\/start(?:@\w+)?\s+(\S+)/i);
  return {
    chatId: msg.chat.id,
    teks,
    token: m ? m[1] : '',
    perintahStart: /^\/start(?:@\w+)?(\s|$)/i.test(teks),
    nama: msg.from?.first_name || ''
  };
}

/* ============== PENYUSUN TEKS ============== */

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Notifikasi ke akun yang dituju: ada dokumen menunggu tanda tangannya. */
export function pesanPerluTtd({ dokumen, unit, tanggal, pembuat }) {
  const baris = ['🔔 <b>Perlu tanda tangan Anda</b>', '', `Dokumen: <b>${esc(dokumen)}</b>`];
  if (unit) baris.push(`Unit: ${esc(unit)}`);
  if (tanggal) baris.push(`Tanggal: ${esc(tanggal)}`);
  if (pembuat) baris.push(`Dikirim oleh: ${esc(pembuat)}`);
  baris.push('', 'Buka E-Logbook → <b>Kotak Masuk TTD</b> untuk menandatangani.');
  return baris.join('\n');
}

/** Notifikasi balik ke pembuat/pelaksana: dokumennya sudah ditandatangani. */
export function pesanSudahTtd({ dokumen, unit, tanggal, penanda }) {
  const baris = ['✅ <b>Dokumen Anda sudah ditandatangani</b>', '', `Dokumen: <b>${esc(dokumen)}</b>`];
  if (unit) baris.push(`Unit: ${esc(unit)}`);
  if (tanggal) baris.push(`Tanggal: ${esc(tanggal)}`);
  if (penanda) baris.push(`Ditandatangani oleh: <b>${esc(penanda)}</b>`);
  return baris.join('\n');
}

/** Balasan saat akun berhasil ditautkan dari dalam Telegram. */
export function pesanTautBerhasil(nama) {
  return `✅ Akun E-Logbook <b>${esc(nama)}</b> berhasil terhubung.\n\n`
    + 'Mulai sekarang notifikasi tanda tangan akan dikirim ke chat ini. '
    + 'Untuk memutus, buka menu Notifikasi Telegram di E-Logbook.';
}

/** Balasan saat /start dibuka tanpa kode taut yang sah. */
export function pesanPerluTaut() {
  return 'Halo! Bot ini mengirim notifikasi tanda tangan E-Logbook.\n\n'
    + 'Untuk menghubungkan akun Anda, buka E-Logbook → tombol <b>TTD Saya</b> → '
    + 'bagian <b>Notifikasi Telegram</b> → <b>Hubungkan</b>, lalu tekan tombol yang muncul di sana.';
}
