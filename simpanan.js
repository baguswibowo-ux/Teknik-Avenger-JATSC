/**
 * PENYIMPANAN DOKUMEN JSON DAN BERKAS BINER
 *
 * Avenger menyimpan dua belas dokumen JSON: jadwal dinas, petugasnya, hak,
 * aktivitas, kegiatan berkala dan tanda selesainya, personel, peralatan,
 * sparepart, daftar dokumen, unitdb, dan daftar logo. Semuanya kecil —
 * seluruhnya sekitar 20 KB — dan semuanya dibaca serta ditulis UTUH, tidak
 * pernah sebagian.
 *
 * Karena bentuk pemakaiannya seragam begitu, seluruh penyimpanan itu lewat dua
 * fungsi saja: bacaJson dan tulisJson di server.js. Tempatnya data/*.json.
 *
 * Foto galeri, logo unit, dan dokumen unit ikut di sini sebagai berkas biner
 * di disk, dengan kunci yang sama bentuknya: jalur relatif terhadap akar
 * aplikasi.
 *
 * (Sampai September 2026 ada jalur kedua ke tabel avenger_state dan Storage di
 * Supabase untuk Vercel. Sejak semuanya jalan dari PC sendiri, jalur itu
 * dibuang.)
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

/**
 * Kunci satu dokumen: jalurnya relatif terhadap akar aplikasi, selalu dengan
 * garis miring depan, jadi `data/dinas.json` di Windows dan di Linux
 * menghasilkan kunci yang sama.
 */
export const kunciDari = (berkas) => path.relative(ROOT, berkas).split(path.sep).join('/');

/* Dua penjaga yang dipakai server.js ("bisa tidak ini disimpan"). Di PC
   sendiri berkas selalu bisa ditulis; keduanya tetap ada karena seluruh rute
   tulis dan layar (bisaTulis) masih menanyakannya. */
export const BISA_TULIS_JSON = true;
export const BISA_TULIS_BINER = true;

/* ============== DOKUMEN JSON ============== */

/**
 * Baca satu dokumen JSON. Yang belum pernah ada — atau rusak — mengembalikan
 * `bawaan`: dokumen yang belum diisi bukan kesalahan, itu keadaan awal yang
 * wajar.
 */
export async function bacaJson(berkas, bawaan) {
  try {
    return JSON.parse(await fs.readFile(berkas, 'utf8'));
  } catch {
    return bawaan;
  }
}

/**
 * Simpan satu dokumen JSON, seutuhnya — lewat berkas sementara lalu rename.
 * rename di dalam satu volume bersifat atomik, jadi dokumennya tidak pernah
 * tertangkap separuh tertulis kalau prosesnya mati di tengah jalan.
 *
 * Argumen ketiga (`oleh`) dulu mengisi kolom catatan di jalur tabel; pemanggil
 * lama yang masih mengirimnya tidak apa-apa.
 */
export async function tulisJson(berkas, isi) {
  await fs.mkdir(path.dirname(berkas), { recursive: true });
  const sementara = berkas + '.tmp';
  await fs.writeFile(sementara, JSON.stringify(isi, null, 2) + '\n', 'utf8');
  await fs.rename(sementara, berkas);
}

/**
 * Buang satu dokumen JSON seluruhnya.
 *
 * Berbeda dari menulis `{}`: yang dibuang harus benar-benar tidak ada lagi.
 * Dipakai berkas warisan yang isinya sudah dilebur ke dokumen lain — kalau ia
 * cuma dikosongkan dan bukan dibuang, pembacaan berikutnya masih menemukannya
 * dan nama yang baru dicabut bisa muncul kembali.
 */
export async function hapusJson(berkas) {
  await fs.rm(berkas, { force: true });
}

/* ============== BERKAS BINER ============== */

const MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.gif': 'image/gif', '.bmp': 'image/bmp',
  '.tif': 'image/tiff', '.tiff': 'image/tiff', '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf', '.txt': 'text/plain', '.csv': 'text/csv',
  '.md': 'text/markdown', '.rtf': 'application/rtf',
  '.zip': 'application/zip', '.rar': 'application/vnd.rar',
  '.7z': 'application/x-7z-compressed'
};

/** Tipe isi dari ekstensinya. Yang tidak dikenal jadi octet-stream — peramban
    akan mengunduhnya, dan itu jawaban yang benar untuk berkas yang tidak
    diketahui bentuknya, bukan menebak lalu salah. */
export const mimeDari = (nama) => MIME[path.extname(String(nama || '')).toLowerCase()]
  || 'application/octet-stream';

/** Simpan satu berkas biner. Menimpa yang sudah ada dengan nama sama. */
export async function tulisBiner(jalur, buf) {
  await fs.mkdir(path.dirname(jalur), { recursive: true });
  await fs.writeFile(jalur, buf);
}

/** Ambil isi satu berkas biner, atau null kalau tidak ada. */
export async function bacaBiner(jalur) {
  try {
    return { buf: await fs.readFile(jalur), mime: mimeDari(jalur) };
  } catch {
    return null;
  }
}

/** Hapus satu berkas biner. Yang memang sudah tidak ada bukan kegagalan. */
export async function hapusBiner(jalur) {
  await fs.rm(jalur, { force: true });
}
