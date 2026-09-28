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
 *   - Sandbox peramban dicoba dulu; tanpa sandbox hanya kalau proses server
 *     berhak tinggi (SYSTEM / administrator) dan sandbox-nya menolak jalan.
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

/* SEMUA peramban yang terpasang, bukan cuma yang pertama: Edge menolak jalan
   sebagai SYSTEM (server produksi) dan keluar dengan kode 1002, sedangkan
   Chrome di mesin yang sama mau. Dicoba berurutan sampai ada yang jadi. */
let perambanDitemukan;   // undefined = belum dicari
function daftarPeramban() {
  if (perambanDitemukan === undefined) {
    perambanDitemukan = [...new Set(CALON_PERAMBAN)]
      .filter((p) => { try { return fs.statSync(p).isFile(); } catch { return false; } });
  }
  return perambanDitemukan;
}
/** Peramban yang terakhir berhasil — dicoba lebih dulu berikutnya. */
let perambanJitu = '';

export const pdfTersedia = () => daftarPeramban().length > 0;

const DIR_KERJA = path.join(os.tmpdir(), 'avenger-pdf');
/* Profil peramban dipakai ulang (start berikutnya lebih cepat), tapi satu per
   server: server uji dan server lain yang jalan di akun Windows yang sama
   punya %TEMP% yang sama, dan dua peramban yang berebut satu profil membuat
   yang kedua keluar diam-diam tanpa PDF. */
const PROFIL = path.join(DIR_KERJA, 'profil-' + String(process.env.PORT || 'bawaan').replace(/\W/g, ''));

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
  const semua = daftarPeramban();
  if (!semua.length) throw new Error('Peramban untuk membuat PDF (Edge/Chrome) tidak ditemukan di server.');
  const urutan = perambanJitu ? [perambanJitu, ...semua.filter((p) => p !== perambanJitu)] : semua;
  const id = crypto.randomBytes(8).toString('hex');
  const dir = path.join(DIR_KERJA, id);
  await fs.promises.mkdir(dir, { recursive: true });
  const masuk = path.join(dir, 'lembar.html');
  const keluar = path.join(dir, 'lembar.pdf');
  try {
    await fs.promises.writeFile(masuk, dokumen, 'utf8');
    const coba = (exe, ekstra) => new Promise((selesai) => {
      // Profil sendiri per peramban: Edge dan Chrome tidak boleh berbagi satu.
      const profil = PROFIL + (/chrome/i.test(exe) ? '-chrome' : '');
      execFile(exe, [
        '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
        '--disable-extensions', '--user-data-dir=' + profil, '--proxy-server=127.0.0.1:9',
        /* Edge/Chrome yang dijalankan dari proses administrator menjalankan
           ULANG dirinya sebagai pengguna biasa lewat Explorer, lalu yang asli
           keluar dengan kode 21 sebelum PDF-nya ditulis. Flag ini
           mematikan perilaku itu. */
        '--do-not-de-elevate',
        ...ekstra, '--no-pdf-header-footer', '--print-to-pdf=' + keluar, pathToFileURL(masuk).href
      ], { timeout: 45000, windowsHide: true }, async (err, _keluaran, galat) => {
        // Edge sering keluar dengan kode bukan-nol walau PDF-nya jadi; yang
        // menentukan adalah berkasnya. Kode 21 = tugasnya diserahkan ke
        // proses lain: beri waktu proses itu menulis PDF-nya.
        if (err && err.code === 21) {
          for (let i = 0; i < 40 && !fs.existsSync(keluar); i++) await new Promise((r) => setTimeout(r, 500));
          await new Promise((r) => setTimeout(r, 300));   // biar selesai ditulis
        }
        selesai({ jadi: fs.existsSync(keluar), err, galat: String(galat || '') });
      });
    });
    /* Proses yang berhak tinggi — server produksi jalan sebagai SYSTEM, dan
       server uji dari PowerShell "Run as administrator" — tidak bisa
       menyalakan sandbox peramban, dan peramban lalu keluar diam-diam tanpa
       PDF. Percobaan kedua tanpa sandbox. Dokumennya tetap terkunci CSP:
       tidak ada skrip yang jalan dan tidak ada jaringan. */
    const catatan = [];
    for (const exe of urutan) {
      for (const ekstra of [[], ['--no-sandbox']]) {
        const hasil = await coba(exe, ekstra);
        if (hasil.jadi) {
          perambanJitu = exe;
          return await fs.promises.readFile(keluar);
        }
        const ekor = hasil.galat.split(/\r?\n/)
          .filter((b) => b && !/language_detection|Extensions\\|vbs_encoder|get_updates_processor|task_manager/.test(b))
          .slice(-1).join('').slice(0, 160);
        catatan.push(`${path.basename(exe, '.exe')}${ekstra.length ? ' tanpa sandbox' : ''}: `
          + (hasil.err ? String(hasil.err.code || hasil.err.message) : 'tanpa PDF') + (ekor ? ` ${ekor}` : ''));
      }
    }
    throw new Error('Peramban tidak menghasilkan PDF (' + catatan.join('; ') + ').');
  } finally {
    fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
