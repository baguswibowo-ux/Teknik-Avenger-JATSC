/**
 * PANDUAN — buku manual, video tutorial, dan tutorial pasang di HP
 *
 * Disajikan di /panduan/, hanya untuk yang sudah masuk: isinya tampilan
 * aplikasi internal, dan rekan teknisi tidak punya akun di tempat lain untuk
 * membukanya. Berkas bawaannya ikut repo di folder panduan/ (BUKAN public/,
 * yang disajikan tanpa login).
 *
 * Administrator bisa menyunting tanpa menyentuh kode (permintaan Bagus,
 * 15 Okt 2026): teks manual, teks tiap langkah video, gambar sisipan, dan
 * logo. Suntingannya disimpan di data/panduan/ — di luar git — jadi
 * memperbarui kode tidak menimpanya, dan "Kembalikan bawaan" cukup membuang
 * berkas suntingannya.
 *
 *   data/panduan/manual.html   isi <main> manual hasil suntingan
 *   data/panduan/video.json    teks langkah/bab video yang diubah + gambar per langkah
 *   data/panduan/logo.json     berkas logo yang sedang dipakai
 *   data/panduan/gambar/       gambar sisipan dan logo
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import express from 'express';
import { bacaJson, tulisJson, hapusJson, tulisBiner, bacaBiner, hapusBiner } from './simpanan.js';

const HALAMAN = {
  'index.html':          'index.html',
  'manual-teknisi.html': 'manual-teknisi.html',
  'video-tutorial.html': 'video-tutorial.html',
  'tutorial-hp.html':    'tutorial-hp.html',
  'sunting.js':          'sunting.js'
};
const GAMBAR_EXT  = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const LOGO_EXT    = new Set(['.png', '.jpg', '.jpeg', '.webp']);   // tanpa .svg: svg bisa membawa skrip
const GAMBAR_BATAS = 6 * 1024 * 1024;
const LOGO_BATAS   = 2 * 1024 * 1024;
const MANUAL_BATAS = 3 * 1024 * 1024;
const namaGambarSah = (n) => /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(String(n || ''))
  && GAMBAR_EXT.has(path.extname(String(n)).toLowerCase());

/** Penyunting: administrator (dan super-admin). Sengaja tidak lewat hak.json —
    panduan dibaca seluruh kantor, dan satu centang yang keliru di matriks hak
    cukup untuk mengubah buku semua orang. */
const bolehSunting = (u) => !!u && (u.role === 'admin' || u.superadmin === true);

/**
 * Pembersih HTML suntingan. Yang menyunting memang administrator, tetapi isi
 * ini dibuka semua akun: skrip, bingkai, dan pengendali peristiwa tidak punya
 * tempat di buku manual, jadi dibuang apa pun asalnya.
 */
export function bersihkanHtml(html) {
  return String(html || '')
    .replace(/<\s*(script|iframe|object|embed|link|meta|base|form)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|iframe|object|embed|link|meta|base|form|input|button|textarea|select)\b[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*("|')\s*(javascript|vbscript|data:text)[^"']*\2/gi, '$1=$2#$2')
    .replace(/\scontenteditable\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
}

/** Rapikan kiriman teks video: hanya kunci dan isian yang dikenal. */
export function rapikanVideo(x) {
  const teks = (v, n) => String(v ?? '').replace(/[<>]/g, '').slice(0, n);
  const gbr = (v) => /^\/panduan\/gambar\/[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(String(v || '')) ? String(v) : '';
  const hasil = { bab: {}, langkah: {} };
  for (const [k, v] of Object.entries(x?.bab || {})) {
    if (!/^\d{1,2}$/.test(k) || !v) continue;
    const b = {};
    if (v.judul != null) b.judul = teks(v.judul, 80);
    if (v.ringkas != null) b.ringkas = teks(v.ringkas, 120);
    if (Object.keys(b).length) hasil.bab[k] = b;
  }
  for (const [k, v] of Object.entries(x?.langkah || {})) {
    if (!/^\d{1,2}-\d{1,2}$/.test(k) || !v) continue;
    const l = {};
    if (v.j != null) l.j = teks(v.j, 120);
    if (v.n != null) l.n = teks(v.n, 900);
    if (v.tip != null) l.tip = teks(v.tip, 600);
    if (v.gambar != null) l.gambar = gbr(v.gambar);
    if (Object.keys(l).length) hasil.langkah[k] = l;
  }
  return hasil;
}

/**
 * @param app      aplikasi express dashboard
 * @param opsi     { ROOT, DATA_DIR, siapa, catat }
 */
export function pasangPanduan(app, { ROOT, DATA_DIR, siapa, catat }) {
  const DIR_BAWAAN = path.join(ROOT, 'panduan');
  const DIR_DATA   = path.join(DATA_DIR, 'panduan');
  const DIR_GAMBAR = path.join(DIR_DATA, 'gambar');
  const MANUAL_UBAH = path.join(DIR_DATA, 'manual.html');
  const VIDEO_JSON  = path.join(DIR_DATA, 'video.json');
  const LOGO_JSON   = path.join(DIR_DATA, 'logo.json');
  const badan = express.json({ limit: '12mb' });

  /* Satu halaman manual memuat belasan gambar, dan tiap gambar menanyakan sesi
     ke E-Logbook. Jawabannya disimpan sebentar per cookie supaya satu kunjungan
     tidak menjadi dua puluh pertanyaan yang sama. */
  const singgah = new Map();
  async function pemakai(req) {
    const kunci = req.headers.cookie || '';
    if (!kunci) return null;
    const ada = singgah.get(kunci);
    if (ada && ada.sampai > Date.now()) return ada.user;
    const user = await siapa(req);
    singgah.set(kunci, { user, sampai: Date.now() + 30_000 });
    if (singgah.size > 500) singgah.delete(singgah.keys().next().value);
    return user;
  }

  const halamanMasuk = `<!doctype html><html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Panduan Avengers</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f3f6fa;color:#14213a;font:16px/1.5 system-ui,sans-serif;padding:16px}
div{max-width:420px;background:#fff;border:1px solid #d6deea;border-radius:12px;padding:22px}h1{font-size:22px;margin:0 0 8px}
a{display:inline-block;margin-top:10px;background:#0b1b33;color:#fff;padding:9px 16px;border-radius:8px;text-decoration:none;font-weight:600}</style></head>
<body><div><h1>Masuk dulu</h1><p>Panduan Avengers hanya bisa dibuka sesudah masuk dengan akun Avengers Anda. Masuk di halaman utama, lalu buka lagi alamat panduan ini.</p>
<a href="/">Ke halaman masuk</a></div></body></html>`;

  /** Halaman HTML: bawaan dari repo, isi manual diganti suntingan kalau ada,
      dan skrip penyunting disisipkan untuk semua (ia sendiri yang bertanya
      apakah akun ini boleh menyunting). */
  async function kirimHalaman(req, res, nama) {
    const user = await pemakai(req);
    if (!user) return res.status(401).type('html').set('Cache-Control', 'no-store').send(halamanMasuk);
    let html;
    try { html = await fs.readFile(path.join(DIR_BAWAAN, HALAMAN[nama]), 'utf8'); }
    catch { return res.status(404).send('Halaman panduan tidak ditemukan.'); }
    if (nama === 'manual-teknisi.html') {
      const ubah = await bacaBiner(MANUAL_UBAH);
      if (ubah) {
        const isi = ubah.buf.toString('utf8');
        html = html.replace(/<main>[\s\S]*<\/main>/, () => '<main>' + isi + '</main>');
      }
    }
    if (nama === 'manual-teknisi.html' || nama === 'video-tutorial.html') {
      html = html.replace('</body>', '<script src="/panduan/sunting.js" defer></script>\n</body>');
    }
    res.type('html').set('Cache-Control', 'no-cache').send(html);
  }

  // Express tidak membedakan /panduan dan /panduan/ — satu rute untuk keduanya.
  // Tanpa garis miring akhir, tautan relatif di halamannya meleset ke akar situs.
  app.get('/panduan', (req, res) => {
    const [jalur, tanya] = req.originalUrl.split('?');
    if (!jalur.endsWith('/')) return res.redirect(301, '/panduan/' + (tanya ? '?' + tanya : ''));
    return kirimHalaman(req, res, 'index.html');
  });
  app.get(['/panduan/manual-teknisi.html', '/panduan/video-tutorial.html', '/panduan/tutorial-hp.html', '/panduan/index.html'],
    (req, res) => kirimHalaman(req, res, path.basename(req.path)));

  app.get('/panduan/sunting.js', async (_req, res) => {
    try {
      const isi = await fs.readFile(path.join(DIR_BAWAAN, 'sunting.js'), 'utf8');
      res.type('application/javascript; charset=utf-8').set('Cache-Control', 'no-cache').send(isi);
    } catch { res.status(404).end(); }
  });

  /* Gambar: sisipan dari data/ dulu, lalu bawaan dari repo. */
  app.get('/panduan/gambar/:nama', async (req, res) => {
    if (!(await pemakai(req))) return res.status(401).end();
    const nama = req.params.nama;
    if (!namaGambarSah(nama)) return res.status(404).end();
    const g = (await bacaBiner(path.join(DIR_GAMBAR, nama))) || (await bacaBiner(path.join(DIR_BAWAAN, 'gambar', nama)));
    if (!g) return res.status(404).end();
    res.type(g.mime).set('Cache-Control', 'private, max-age=86400').send(g.buf);
  });

  app.get('/panduan/logo', async (req, res) => {
    if (!(await pemakai(req))) return res.status(401).end();
    const meta = await bacaJson(LOGO_JSON, null);
    const g = meta?.berkas && (await bacaBiner(path.join(DIR_GAMBAR, meta.berkas)));
    if (!g) return res.status(404).end();
    res.type(g.mime).set('Cache-Control', 'no-cache').send(g.buf);
  });

  app.get('/panduan/api/saya', async (req, res) => {
    const user = await pemakai(req);
    res.set('Cache-Control', 'no-store').json({ masuk: !!user, bolehSunting: bolehSunting(user),
      adaSuntinganManual: !!(await bacaBiner(MANUAL_UBAH)) });
  });

  app.get('/panduan/api/video', async (req, res) => {
    if (!(await pemakai(req))) return res.status(401).json({ error: 'Masuk dulu.' });
    res.set('Cache-Control', 'no-store').json(await bacaJson(VIDEO_JSON, { bab: {}, langkah: {} }));
  });

  /** Penjaga untuk semua yang menulis. */
  async function penyunting(req, res) {
    const user = await siapa(req);
    if (!user) { res.status(401).json({ error: 'Masuk dengan akun Avengers Anda dulu.' }); return null; }
    if (!bolehSunting(user)) { res.status(403).json({ error: 'Hanya administrator yang bisa menyunting panduan.' }); return null; }
    return user;
  }

  app.put('/panduan/api/manual', badan, async (req, res) => {
    const user = await penyunting(req, res); if (!user) return;
    const html = bersihkanHtml(req.body?.html);
    if (!html.trim()) return res.status(400).json({ error: 'Isi manual kosong. Tidak disimpan.' });
    if (Buffer.byteLength(html) > MANUAL_BATAS) return res.status(413).json({ error: 'Isi manual terlalu besar.' });
    await tulisBiner(MANUAL_UBAH, Buffer.from(html, 'utf8'));
    await catat(user, { modul: 'panduan', aksi: 'ubah', rincian: 'manual teknisi' });
    res.json({ ok: true });
  });

  app.delete('/panduan/api/manual', async (req, res) => {
    const user = await penyunting(req, res); if (!user) return;
    await hapusBiner(MANUAL_UBAH);
    await catat(user, { modul: 'panduan', aksi: 'kembalikan', rincian: 'manual teknisi ke bawaan' });
    res.json({ ok: true });
  });

  app.put('/panduan/api/video', badan, async (req, res) => {
    const user = await penyunting(req, res); if (!user) return;
    await tulisJson(VIDEO_JSON, rapikanVideo(req.body));
    await catat(user, { modul: 'panduan', aksi: 'ubah', rincian: 'teks video tutorial' });
    res.json({ ok: true });
  });

  app.delete('/panduan/api/video', async (req, res) => {
    const user = await penyunting(req, res); if (!user) return;
    await hapusJson(VIDEO_JSON);
    await catat(user, { modul: 'panduan', aksi: 'kembalikan', rincian: 'video tutorial ke bawaan' });
    res.json({ ok: true });
  });

  /** Unggah gambar sisipan: { berkas: nama asli, isi: base64 }. Nama di disk
      dibuat di sini; dari kiriman cuma ekstensinya yang dipakai. */
  app.post('/panduan/api/gambar', badan, async (req, res) => {
    const user = await penyunting(req, res); if (!user) return;
    const ext = path.extname(String(req.body?.berkas || '')).toLowerCase();
    if (!GAMBAR_EXT.has(ext)) return res.status(400).json({ error: 'Gambar harus .jpg, .png, .webp, atau .gif.' });
    const isi = Buffer.from(String(req.body?.isi || ''), 'base64');
    if (!isi.length) return res.status(400).json({ error: 'Isi gambar kosong.' });
    if (isi.length > GAMBAR_BATAS) return res.status(413).json({ error: 'Gambar lebih dari 6 MB.' });
    const nama = 'sisip-' + Date.now().toString(36) + '-' + crypto.randomBytes(3).toString('hex') + ext;
    await tulisBiner(path.join(DIR_GAMBAR, nama), isi);
    await catat(user, { modul: 'panduan', aksi: 'unggah', rincian: 'gambar ' + nama });
    res.json({ ok: true, url: '/panduan/gambar/' + nama });
  });

  app.post('/panduan/api/logo', badan, async (req, res) => {
    const user = await penyunting(req, res); if (!user) return;
    const ext = path.extname(String(req.body?.berkas || '')).toLowerCase();
    if (!LOGO_EXT.has(ext)) return res.status(400).json({ error: 'Logo harus .png, .jpg, atau .webp.' });
    const isi = Buffer.from(String(req.body?.isi || ''), 'base64');
    if (!isi.length) return res.status(400).json({ error: 'Isi logo kosong.' });
    if (isi.length > LOGO_BATAS) return res.status(413).json({ error: 'Logo lebih dari 2 MB.' });
    const lama = await bacaJson(LOGO_JSON, null);
    const nama = 'logo' + ext;
    if (lama?.berkas && lama.berkas !== nama) await hapusBiner(path.join(DIR_GAMBAR, lama.berkas));
    await tulisBiner(path.join(DIR_GAMBAR, nama), isi);
    await tulisJson(LOGO_JSON, { berkas: nama, jam: new Date().toISOString() });
    await catat(user, { modul: 'panduan', aksi: 'ganti', rincian: 'logo panduan' });
    res.json({ ok: true, url: '/panduan/logo?v=' + Date.now() });
  });

  app.delete('/panduan/api/logo', async (req, res) => {
    const user = await penyunting(req, res); if (!user) return;
    const lama = await bacaJson(LOGO_JSON, null);
    if (lama?.berkas) await hapusBiner(path.join(DIR_GAMBAR, lama.berkas));
    await hapusJson(LOGO_JSON);
    await catat(user, { modul: 'panduan', aksi: 'hapus', rincian: 'logo panduan' });
    res.json({ ok: true });
  });
}

