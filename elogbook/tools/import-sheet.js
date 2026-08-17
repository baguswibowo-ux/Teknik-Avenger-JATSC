/**
 * Pindahkan data lama dari Google Spreadsheet ke database server ini.
 *
 * LANGKAH:
 *   1. Buka spreadsheet lama. Untuk TIAP tab, pilih
 *        File > Download > Comma Separated Values (.csv)
 *   2. Simpan berkasnya ke folder  import/  dengan nama:
 *        import/Logbook_Entries.csv
 *        import/DailyCheck_Records.csv
 *        import/Issues.csv
 *      (tab yang tidak ada berkasnya akan dilewati)
 *   3. Jalankan:  npm run import
 *
 * Gambar tanda tangan di kolom TTD berupa tautan Google Drive. Skrip akan
 * mencoba mengunduhnya ke folder uploads/ supaya aplikasi tidak lagi bergantung
 * pada Drive. Kalau gagal diunduh (misalnya server tanpa akses internet),
 * tautannya disimpan apa adanya sehingga tidak ada data yang hilang.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { db, nowIso, newId, UPLOAD_DIR } from '../db.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const IMPORT_DIR = process.env.ELOGBOOK_IMPORT_DIR || path.join(ROOT, 'import');

/* ---------- Pembaca CSV (menangani tanda kutip dan baris baru di dalam sel) ---------- */
function parseCsv(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // buang BOM
  const rows = [];
  let row = [], field = '', inQuote = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuote) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuote = false;
      } else field += c;
      continue;
    }
    if (c === '"') { inQuote = true; continue; }
    if (c === ',') { row.push(field); field = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(v => String(v).trim() !== ''));
}

function bacaTabel(namaBerkas) {
  const file = path.join(IMPORT_DIR, namaBerkas);
  if (!fs.existsSync(file)) return null;
  const rows = parseCsv(fs.readFileSync(file, 'utf8'));
  if (rows.length < 2) return [];
  const header = rows[0].map(h => String(h).trim());
  return rows.slice(1).map(r => {
    const o = {};
    header.forEach((h, i) => { o[h] = r[i] === undefined ? '' : String(r[i]).trim(); });
    return o;
  });
}

/* ---------- Unduh gambar TTD dari Drive ---------- */
const cacheTtd = new Map();
let gagalUnduh = 0;

async function ambilTtd(url) {
  if (!url) return '';
  if (url.startsWith('/uploads/')) return url;
  if (!/^https?:\/\//i.test(url)) return url;
  if (cacheTtd.has(url)) return cacheTtd.get(url);

  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const tipe = res.headers.get('content-type') || '';
    if (!tipe.startsWith('image/')) throw new Error('bukan gambar (' + tipe + ')');

    const buf = Buffer.from(await res.arrayBuffer());
    const ext = tipe.includes('jpeg') ? 'jpg' : 'png';
    const nama = `impor_${crypto.randomBytes(6).toString('hex')}.${ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, nama), buf);
    const web = '/uploads/' + nama;
    cacheTtd.set(url, web);
    return web;
  } catch (e) {
    gagalUnduh++;
    cacheTtd.set(url, url); // simpan tautan aslinya
    return url;
  }
}

const asJsonArray = (v) => {
  if (!v) return [];
  try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; }
};

const asJsonObject = (v) => {
  if (!v) return {};
  try { const p = JSON.parse(v); return p && typeof p === 'object' ? p : {}; } catch { return {}; }
};

/* ---------- Impor per tabel ---------- */

async function imporLogbook() {
  const rows = bacaTabel('Logbook_Entries.csv');
  if (rows === null) { console.log('- Logbook_Entries.csv tidak ada, dilewati.'); return; }

  const ada = db.prepare('SELECT 1 FROM entries WHERE id = ?');
  const ins = db.prepare(`INSERT INTO entries
    (id, tanggal, jam, dinas, uraian, teknisi_nama, teknisi_ttd, pj_nama, pj_ttd, teknisi_nama_list, dibuat_pada, dibuat_oleh)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  let masuk = 0, lewat = 0;
  for (const r of rows) {
    const id = r.ID || newId();
    if (ada.get(id)) { lewat++; continue; }
    ins.run(
      id, r.Tanggal || '', r.Jam || '', r.Dinas || '', r.Uraian || '',
      r.TeknisiNama || '', await ambilTtd(r.TeknisiTTD),
      r.PJNama || '', await ambilTtd(r.PJTTD),
      JSON.stringify(asJsonArray(r.TeknisiNamaListJSON)),
      r.DibuatPada || nowIso(), 'impor'
    );
    masuk++;
  }
  console.log(`- Logbook          : ${masuk} masuk, ${lewat} dilewati (sudah ada)`);
}

async function imporDailyCheck() {
  const rows = bacaTabel('DailyCheck_Records.csv');
  if (rows === null) { console.log('- DailyCheck_Records.csv tidak ada, dilewati.'); return; }

  const ada = db.prepare('SELECT 1 FROM dailychecks WHERE id = ?');
  const ins = db.prepare(`INSERT INTO dailychecks
    (id, tanggal, dinas, suhu, remark, teknisi_nama, teknisi_ttd, manager_nama, manager_ttd,
     state_json, fails_json, warns_json, teknisi_nama_list, dibuat_pada, dibuat_oleh)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  let masuk = 0, lewat = 0;
  for (const r of rows) {
    const id = r.ID || newId();
    if (ada.get(id)) { lewat++; continue; }
    ins.run(
      id, r.Tanggal || '', r.Dinas || '', r.Suhu || '', r.Remark || '',
      r.TeknisiNama || '', await ambilTtd(r.TeknisiTTD),
      r.ManagerNama || '', await ambilTtd(r.ManagerTTD),
      JSON.stringify(asJsonObject(r.StateJSON)),
      JSON.stringify(asJsonArray(r.FailsJSON)),
      JSON.stringify(asJsonArray(r.WarnsJSON)),
      JSON.stringify(asJsonArray(r.TeknisiNamaListJSON)),
      r.DibuatPada || nowIso(), 'impor'
    );
    masuk++;
  }
  console.log(`- Daily Check      : ${masuk} masuk, ${lewat} dilewati (sudah ada)`);
}

function imporIssues() {
  const rows = bacaTabel('Issues.csv');
  if (rows === null) { console.log('- Issues.csv tidak ada, dilewati.'); return; }

  const ada = db.prepare('SELECT 1 FROM issues WHERE id = ?');
  const ins = db.prepare(`INSERT INTO issues (id, jenis, keterangan, lokasi, status, tanggal_report, tanggal_closed, dibuat_pada)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

  let masuk = 0, lewat = 0;
  for (const r of rows) {
    const id = r.ID || newId();
    if (ada.get(id)) { lewat++; continue; }
    const dibuatPada = r.DibuatPada || nowIso();
    // Spreadsheet lama belum punya kolom tanggal — pakai waktu pembuatan barisnya.
    const tglReport = r.TanggalReport || String(dibuatPada).slice(0, 10);
    ins.run(id, r.Jenis || '', r.Keterangan || '', r.Lokasi || '', r.Status || 'Open',
            tglReport, r.TanggalClosed || '', dibuatPada);
    masuk++;
  }
  console.log(`- Isu / Update Issue: ${masuk} masuk, ${lewat} dilewati (sudah ada)`);
}

/* ---------- Jalan ---------- */

if (!fs.existsSync(IMPORT_DIR)) {
  fs.mkdirSync(IMPORT_DIR, { recursive: true });
  console.error(`Folder "import" baru saja dibuat dan masih kosong.
Unduh tiap tab spreadsheet sebagai CSV, taruh di:
  ${IMPORT_DIR}
dengan nama Logbook_Entries.csv, DailyCheck_Records.csv, Issues.csv — lalu jalankan lagi.`);
  process.exit(1);
}

console.log('Mengimpor dari: ' + IMPORT_DIR + '\n');
await imporLogbook();
await imporDailyCheck();
imporIssues();

if (gagalUnduh > 0) {
  console.log(`\nCatatan: ${gagalUnduh} tanda tangan gagal diunduh dari Google Drive dan
tetap disimpan sebagai tautan. Gambar itu hanya akan tampil selama berkasnya
masih ada di Drive dan komputer pembuka punya akses internet.`);
}
console.log('\nSelesai. Jalankan "npm start" lalu periksa riwayat di aplikasi.');
