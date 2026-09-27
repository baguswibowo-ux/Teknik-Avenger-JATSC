/**
 * CETAK KE PDF — lembar cetak yang sama persis, lewat Edge/Chrome headless
 *
 * Dipakai tombol "Kirim PDF" di dashboard dan E-Logbook: halaman mengirim isi
 * #printArea yang sudah jadi (TTD sudah dihitamkan, gambar sudah jadi data:)
 * beserta seluruh CSS-nya, lalu server ini "mencetak" HTML itu ke PDF dengan
 * mesin cetak peramban sungguhan. Karena mesinnya sama dengan dialog cetak,
 * aturan @media print dan @page (lanskap Jadwal Dinas, kop, kotak TTD) ikut
 * berlaku persis — tidak seperti pustaka html2canvas yang menggambar tampilan
 * layar dan mengabaikan aturan cetak.
 *
 * PENGAMAN. HTML-nya datang dari peramban, jadi diperlakukan sebagai tidak
 * tepercaya:
 *   - Content-Security-Policy di dalam dokumen: tanpa skrip, tanpa jaringan;
 *     gambar dan font hanya dari data:. (Mematikan JavaScript lewat flag
 *     peramban justru membuat --print-to-pdf gagal diam-diam — sudah dicoba.)
 *   - <script>, <iframe>, <object>, <embed>, <link>, <meta>, <base> dan atribut
 *     on*= dibuang lebih dulu, sebagai lapis kedua.
 *   - --proxy-server ke port mati: kalaupun ada yang lolos, tidak ada
 *     permintaan jaringan yang sampai ke mana pun.
 *   - Satu proses sekaligus (antrean), dan batas waktu 45 detik.
 *
 * Peramban dicari di PDF_PERAMBAN (env) lalu di lokasi baku Windows dan Linux.
 * Tidak ketemu → pdfTersedia() false dan tombolnya menjawab dengan jelas.
 */

import { execFile } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const CALON_PERAMBAN = [
  process.env.PDF_PERAMBAN,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'
].filter(Boolean);

let perambanDitemukan;   // undefined = belum dicari, '' = tidak ada
function peramban() {
  if (perambanDitemukan === undefined) {
    perambanDitemukan = CALON_PERAMBAN.find((p) => { try { return fs.statSync(p).isFile(); } catch { return false; } }) || '';
  }
  return perambanDitemukan;
}

export const pdfTersedia = () => !!peramban();

const DIR_KERJA = path.join(os.tmpdir(), 'avenger-pdf');
const PROFIL = path.join(DIR_KERJA, 'profil');   // dipakai ulang — start berikutnya lebih cepat

/** Buang unsur yang bisa menjalankan kode atau memanggil jaringan. CSP di
    dokumen sudah menutupnya; ini lapis kedua. */
export function bersihkanHtml(html) {
  return String(html || '')
    .replace(/<\s*(script|iframe|object|embed|noscript|template)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*\/?\s*(script|iframe|object|embed|link|meta|base|form|frame|frameset)\b[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1=$2#$2');
}

/** CSS tidak boleh menutup <style> lalu membuka tag sendiri. */
const bersihkanCss = (css) => String(css || '').replace(/<\s*\/\s*style/gi, '<\\/style');

/**
 * Susun dokumen lengkap: CSP, seluruh CSS halaman asal, lalu #printArea
 * dengan kelas yang sama (mis. "lanskap") supaya aturan cetaknya kena.
 */
export function susunDokumen({ html, css, kelas, judul, akar, badan }) {
  const kelasAman = String(kelas || '').replace(/[^\w\s-]/g, '').slice(0, 200);
  const badanAman = String(badan || '').replace(/[^\w\s-]/g, '').slice(0, 200);
  const judulAman = String(judul || 'Dokumen').replace(/[<>&"]/g, '').slice(0, 200);
  // Atribut data-* milik <html> halaman asal (tema terang/gelap, dsb.).
  const atributAkar = Object.entries(akar && typeof akar === 'object' ? akar : {})
    .filter(([k]) => /^data-[\w-]{1,40}$/.test(k)).slice(0, 10)
    .map(([k, v]) => ` ${k}="${String(v).replace(/[<>&"]/g, '').slice(0, 100)}"`).join('');
  return `<!doctype html><html lang="id"${atributAkar}><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:">
<title>${judulAman}</title>
<style>${bersihkanCss(css)}</style>
<style>html,body{background:#fff !important;margin:0;padding:0;}
#printArea{display:block !important;}
/* Hiasan latar layar (foto orbit, gradasi). Dialog cetak biasa tidak
   mencetaknya karena "grafis latar" mati; mesin PDF ini mencetak latar. */
body::before,body::after{content:none !important;display:none !important;background:none !important;}</style>
</head><body class="${badanAman}"><div id="printArea" class="${kelasAman}">${bersihkanHtml(html)}</div></body></html>`;
}

let antrean = Promise.resolve();

/** HTML → Buffer PDF. Satu per satu; yang datang bersamaan menunggu giliran. */
export function htmlKePdf(dokumen) {
  const kerja = antrean.then(() => jalankan(dokumen));
  antrean = kerja.catch(() => {});
  return kerja;
}

async function jalankan(dokumen) {
  const exe = peramban();
  if (!exe) throw new Error('Peramban untuk membuat PDF (Edge/Chrome) tidak ditemukan di server.');
  const id = crypto.randomBytes(8).toString('hex');
  const dir = path.join(DIR_KERJA, id);
  await fs.promises.mkdir(dir, { recursive: true });
  const masuk = path.join(dir, 'lembar.html');
  const keluar = path.join(dir, 'lembar.pdf');
  try {
    await fs.promises.writeFile(masuk, dokumen, 'utf8');
    await new Promise((selesai, gagal) => {
      execFile(exe, [
        '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
        '--disable-extensions', '--user-data-dir=' + PROFIL, '--proxy-server=127.0.0.1:9',
        '--no-pdf-header-footer', '--print-to-pdf=' + keluar, pathToFileURL(masuk).href
      ], { timeout: 45000, windowsHide: true }, (err) => {
        // Edge sering keluar dengan kode bukan-nol walau PDF-nya jadi; yang
        // menentukan adalah berkasnya.
        if (fs.existsSync(keluar)) return selesai();
        gagal(new Error('Peramban tidak menghasilkan PDF' + (err ? ` (${err.code || err.message})` : '') + '.'));
      });
    });
    return await fs.promises.readFile(keluar);
  } finally {
    fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
