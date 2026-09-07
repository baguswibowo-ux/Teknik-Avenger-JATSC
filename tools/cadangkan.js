/**
 * CADANGKAN DATA SERVER SENDIRI
 *
 *   node tools/cadangkan.js              cadangkan sekarang
 *   node tools/cadangkan.js --hanya-cek  tampilkan yang akan dikerjakan, tidak menulis
 *
 * Bagian dari pindah hosting Vercel → PC sendiri (Sep 2026). Di Vercel data
 * hidup di Supabase yang punya cadangan sendiri; di PC sendiri tidak ada yang
 * mencadangkan apa pun kecuali skrip ini. Dijadwalkan tiap malam lewat
 * tools/pasang-jadwal.cmd (Task Scheduler), atau dijalankan tangan kapan saja.
 *
 * Yang dicadangkan, dan caranya:
 *   1. elogbook/data/elogbook.db  → salinan utuh per hari lewat `VACUUM INTO`.
 *      Bukan fs.copyFile: server boleh sedang menulis, dan menyalin berkas
 *      SQLite yang sedang dipakai bisa menghasilkan salinan yang setengah
 *      jadi. VACUUM INTO membuat potret yang konsisten dari dalam SQLite
 *      sendiri, tanpa menghentikan server.
 *   2. data/*.json (modul Avenger: dinas, personel, hak, dsb.)  → salinan per hari.
 *      Kecil, jadi disalin utuh tiap kali.
 *   3. elogbook/uploads/ dan public/foto/  → CERMIN, bukan salinan per hari.
 *      Isinya puluhan MB dan hampir hanya bertambah (TTD, lampiran, foto);
 *      menyalinnya utuh tiap malam memboroskan disk tanpa menambah keamanan.
 *      Berkas yang sudah ada di cermin dengan ukuran dan waktu ubah yang sama
 *      dilewati. Yang dihapus dari sumber TIDAK dihapus dari cermin — cermin
 *      ini justru tempat mengambilnya kembali kalau terhapus tak sengaja.
 *
 * Susunan di CADANGAN_DIR:
 *   harian/2026-09-07_0200/elogbook.db
 *   harian/2026-09-07_0200/data/…
 *   cermin/elogbook-uploads/…
 *   cermin/public-foto/…
 *   cadangkan.log
 *
 * Folder harian yang lebih tua dari CADANGAN_SIMPAN_HARI dihapus — hanya
 * folder yang namanya berpola tanggal buatan skrip ini, di dalam harian/.
 *
 * Pengaturan (di .env akar):
 *   CADANGAN_DIR          bawaan <akar>/cadangan. Sebaiknya di drive LAIN dari
 *                         drive aplikasi, atau folder yang disinkronkan ke
 *                         cloud — cadangan yang ikut mati bersama disknya
 *                         bukan cadangan.
 *   CADANGAN_SIMPAN_HARI  bawaan 14.
 *   CADANGAN_LUAR         salinan kedua ke folder yang tidak ikut mati bersama
 *                         PC ini: Google Drive for Desktop, OneDrive, atau
 *                         disk fisik lain. Kosong = fitur mati.
 *
 * Kode keluar 0 kalau semua beres, 1 kalau ada bagian yang gagal (bagian lain
 * tetap dikerjakan, jadi satu berkas yang macet tidak membatalkan cadangan DB).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HANYA_CEK = process.argv.includes('--hanya-cek');

try { process.loadEnvFile(path.join(ROOT, '.env')); } catch { /* tidak ada: pakai bawaan */ }

const CADANGAN_DIR = path.resolve(ROOT, (process.env.CADANGAN_DIR || '').trim() || 'cadangan');
const SIMPAN_HARI = Math.max(1, Number(process.env.CADANGAN_SIMPAN_HARI) || 14);
const CADANGAN_LUAR = (process.env.CADANGAN_LUAR || '').trim();

const SUMBER_DB = path.join(ROOT, 'elogbook', 'data', 'elogbook.db');
const SUMBER_DATA = path.join(ROOT, 'data');
const CERMIN = [
  { nama: 'elogbook-uploads', dari: path.join(ROOT, 'elogbook', 'uploads') },
  { nama: 'public-foto', dari: path.join(ROOT, 'public', 'foto') }
];

/* ---------- alat kecil ---------- */

const d2 = (n) => String(n).padStart(2, '0');
function stempel(t = new Date()) {
  return `${t.getFullYear()}-${d2(t.getMonth() + 1)}-${d2(t.getDate())}_${d2(t.getHours())}${d2(t.getMinutes())}`;
}
const POLA_HARIAN = /^(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})$/;

function mb(b) { return (b / 1048576).toFixed(1) + ' MB'; }

const barisLog = [];
let adaGagal = false;
function log(pesan) { barisLog.push(pesan); console.log(pesan); }
function gagal(pesan) { adaGagal = true; log('✗ ' + pesan); }

function ukuranFolder(dir) {
  let total = 0, n = 0;
  if (!fs.existsSync(dir)) return { total, n };
  for (const ent of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (!ent.isFile()) continue;
    total += fs.statSync(path.join(ent.parentPath ?? ent.path, ent.name)).size;
    n += 1;
  }
  return { total, n };
}

/* ---------- 1. SQLite lewat VACUUM INTO ---------- */

function cadangkanDb(tujuanDir) {
  if (!fs.existsSync(SUMBER_DB)) {
    return gagal(`elogbook.db tidak ada di ${SUMBER_DB} — E-Logbook belum pernah jalan di sini?`);
  }
  const tujuan = path.join(tujuanDir, 'elogbook.db');
  const ukuran = fs.statSync(SUMBER_DB).size;
  if (HANYA_CEK) return log(`  akan: VACUUM INTO ${tujuan}  (sumber ${mb(ukuran)})`);

  let db;
  try {
    /* VACUUM INTO menolak menulis ke berkas yang sudah ada ("output file
       already exists") — dan itu terjadi setiap kali skrip ini jalan dua kali
       dalam menit yang sama, karena nama foldernya berstempel sampai menit.
       Salinan lama untuk stempel yang sama tidak berharga (isinya dari
       beberapa detik lalu), jadi dibuang lebih dulu. */
    fs.rmSync(tujuan, { force: true });
    db = new DatabaseSync(SUMBER_DB, { readOnly: true });
    // Jalur diapit kutip tunggal SQL; kutip tunggal di dalamnya (tidak lazim di
    // Windows, tapi mungkin) digandakan. Garis miring biasa aman untuk SQLite.
    const sql = tujuan.replace(/\\/g, '/').replace(/'/g, "''");
    db.exec(`VACUUM INTO '${sql}'`);
    log(`✓ elogbook.db → ${tujuan}  (${mb(fs.statSync(tujuan).size)})`);
  } catch (e) {
    gagal(`elogbook.db: ${e?.message || e}`);
  } finally {
    try { db?.close(); } catch { /* sudah tertutup */ }
  }
}

/* ---------- 2. data/*.json ---------- */

function cadangkanData(tujuanDir) {
  if (!fs.existsSync(SUMBER_DATA)) return gagal(`folder data/ tidak ada di ${SUMBER_DATA}`);
  const { total, n } = ukuranFolder(SUMBER_DATA);
  const tujuan = path.join(tujuanDir, 'data');
  if (HANYA_CEK) return log(`  akan: salin data/ (${n} berkas, ${mb(total)}) → ${tujuan}`);
  try {
    fs.cpSync(SUMBER_DATA, tujuan, { recursive: true });
    log(`✓ data/ → ${tujuan}  (${n} berkas, ${mb(total)})`);
  } catch (e) {
    gagal(`data/: ${e?.message || e}`);
  }
}

/* ---------- 3. cermin uploads & foto ---------- */

function cerminkan(dari, ke) {
  let disalin = 0, dilewati = 0, byteDisalin = 0;
  const jalan = (srcDir, dstDir) => {
    if (!HANYA_CEK) fs.mkdirSync(dstDir, { recursive: true });
    for (const ent of fs.readdirSync(srcDir, { withFileTypes: true })) {
      const src = path.join(srcDir, ent.name);
      const dst = path.join(dstDir, ent.name);
      if (ent.isDirectory()) { jalan(src, dst); continue; }
      if (!ent.isFile()) continue;
      const s = fs.statSync(src);
      let sama = false;
      try {
        const t = fs.statSync(dst);
        sama = t.size === s.size && Math.abs(t.mtimeMs - s.mtimeMs) < 2000;
      } catch { /* belum ada di cermin */ }
      if (sama) { dilewati += 1; continue; }
      if (!HANYA_CEK) {
        try {
          fs.copyFileSync(src, dst);
          fs.utimesSync(dst, s.atime, s.mtime);
        } catch (e) {
          gagal(`cermin ${path.relative(ROOT, src)}: ${e?.message || e}`);
          continue;
        }
      }
      disalin += 1;
      byteDisalin += s.size;
    }
  };
  jalan(dari, ke);
  return { disalin, dilewati, byteDisalin };
}

function cadangkanCermin() {
  for (const { nama, dari } of CERMIN) {
    if (!fs.existsSync(dari)) { log(`  (lewat) ${path.relative(ROOT, dari)} tidak ada`); continue; }
    const ke = path.join(CADANGAN_DIR, 'cermin', nama);
    const r = cerminkan(dari, ke);
    log(`${HANYA_CEK ? '  akan:' : '✓'} cermin ${nama}: ${r.disalin} baru (${mb(r.byteDisalin)}), ${r.dilewati} sudah sama`);
  }
}

/* ---------- 4. buang harian yang tua ---------- */

function buangYangTua(base = CADANGAN_DIR) {
  const dirHarian = path.join(base, 'harian');
  if (!fs.existsSync(dirHarian)) return;
  const batas = Date.now() - SIMPAN_HARI * 86400_000;
  let dibuang = 0;
  for (const ent of fs.readdirSync(dirHarian, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const m = POLA_HARIAN.exec(ent.name);
    if (!m) continue;   // bukan buatan skrip ini: jangan disentuh
    const waktu = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime();
    if (waktu >= batas) continue;
    const p = path.join(dirHarian, ent.name);
    if (HANYA_CEK) { log(`  akan: hapus ${p} (lebih tua dari ${SIMPAN_HARI} hari)`); dibuang += 1; continue; }
    try { fs.rmSync(p, { recursive: true, force: true }); dibuang += 1; }
    catch (e) { gagal(`hapus ${p}: ${e?.message || e}`); }
  }
  if (dibuang) log(`${HANYA_CEK ? '  akan:' : '✓'} ${dibuang} cadangan harian lebih tua dari ${SIMPAN_HARI} hari dibuang`);
}

/* ---------- 5. salinan ke luar (Google Drive, OneDrive, atau disk lain) ----------

   CADANGAN_DIR ada di drive yang sama dengan aplikasinya. Itu menjaga dari
   salah hapus dan salah ubah — dua hal yang jauh lebih sering terjadi — tapi
   TIDAK dari disk yang rusak, PC yang hilang atau terbakar, maupun ransomware
   yang mengenkripsi semua drive lokal sekaligus.

   CADANGAN_LUAR menyalin hasilnya sekali lagi ke tempat yang tidak ikut mati
   bersama komputer ini. Isi yang cocok: folder Google Drive for Desktop,
   OneDrive, atau — kalau tidak ada internet — setidaknya disk FISIK yang lain.
   Perhatikan kata fisik: di komputer ini D: dan F: kelihatan dua drive padahal
   satu disk, jadi F: sama sekali tidak menolong.

   Kalau CADANGAN_LUAR diisi tapi tujuannya tidak terjangkau, itu dilaporkan
   sebagai KEGAGALAN, bukan dilewati diam-diam. Folder Drive gampang menghilang
   sendiri — aplikasinya belum login, drive-nya belum sempat terpasang saat
   tugas jalan, atau kuotanya penuh. Dan cadangan luar yang berhenti diam-diam
   adalah cadangan yang tidak ada: baru ketahuan persis pada hari kamu
   membutuhkannya. */

function cadangkanLuar() {
  if (!CADANGAN_LUAR) return;

  const luar = path.resolve(CADANGAN_LUAR);
  if (luar.toLowerCase().startsWith(path.resolve(CADANGAN_DIR).toLowerCase() + path.sep)) {
    gagal('CADANGAN_LUAR ada di dalam CADANGAN_DIR — itu akan menyalin dirinya sendiri tanpa henti. Arahkan ke luar.');
    return;
  }

  // Induknya yang dicek, bukan foldernya: folder tujuan boleh belum dibuat,
  // tapi kalau induknya pun tidak ada berarti drive-nya memang tidak terpasang.
  const induk = path.dirname(luar);
  if (!fs.existsSync(induk)) {
    gagal(`salinan luar dilewati: ${induk} tidak ada. Google Drive belum login, atau drive-nya belum terpasang saat tugas ini jalan.`);
    return;
  }

  if (!HANYA_CEK) {
    try { fs.mkdirSync(luar, { recursive: true }); }
    catch (e) { gagal(`buat ${luar}: ${e?.message || e}`); return; }
  }

  const r = cerminkan(CADANGAN_DIR, luar);
  log(`${HANYA_CEK ? '  akan:' : '✓'} salinan luar → ${luar}: ${r.disalin} baru (${mb(r.byteDisalin)}), ${r.dilewati} sudah sama`);

  // Retensi yang sama diterapkan di luar. Tanpa ini folder harian menumpuk
  // selamanya di Drive dan kuotanya habis pelan-pelan tanpa ada yang sadar.
  buangYangTua(luar);
}

/* ---------- jalan ---------- */

const mulai = Date.now();
log(`— cadangkan ${new Date().toLocaleString('id-ID')}${HANYA_CEK ? ' (hanya cek)' : ''} → ${CADANGAN_DIR}`);

if (path.resolve(CADANGAN_DIR).toLowerCase().startsWith(path.resolve(ROOT).toLowerCase() + path.sep)) {
  log('  peringatan: CADANGAN_DIR ada di dalam folder aplikasi — kalau disk atau folder ini hilang, cadangannya ikut hilang. Atur CADANGAN_DIR di .env ke drive lain.');
}

const tujuanHarian = path.join(CADANGAN_DIR, 'harian', stempel());
if (!HANYA_CEK) fs.mkdirSync(tujuanHarian, { recursive: true });

cadangkanDb(tujuanHarian);
cadangkanData(tujuanHarian);
cadangkanCermin();
buangYangTua();
cadangkanLuar();

const detik = ((Date.now() - mulai) / 1000).toFixed(1);
log(`${adaGagal ? '✗ selesai DENGAN KEGAGALAN' : '✓ selesai'} dalam ${detik} dtk`);

if (!HANYA_CEK) {
  try {
    fs.mkdirSync(CADANGAN_DIR, { recursive: true });
    fs.appendFileSync(path.join(CADANGAN_DIR, 'cadangkan.log'), barisLog.join('\n') + '\n\n');
  } catch { /* log gagal ditulis: keluarannya sudah ada di stdout */ }
}
process.exit(adaGagal ? 1 : 0);
