/**
 * PENYIMPANAN DOKUMEN JSON — BERKAS ATAU TABEL
 *
 * Avenger menyimpan dua belas dokumen JSON: jadwal dinas, petugasnya, hak,
 * aktivitas, kegiatan berkala dan tanda selesainya, personel, peralatan,
 * sparepart, daftar dokumen, unitdb, dan daftar logo. Semuanya kecil —
 * seluruhnya sekitar 20 KB — dan semuanya dibaca serta ditulis UTUH, tidak
 * pernah sebagian.
 *
 * Karena bentuk pemakaiannya seragam begitu, seluruh penyimpanan itu lewat dua
 * fungsi saja: bacaJson dan tulisJson di server.js. Berkas ini yang menentukan
 * ke mana keduanya sebenarnya menulis.
 *
 * DUA JALUR, BUKAN SATU YANG MENGGANTIKAN YANG LAIN
 *
 *   berkas   data/*.json seperti selama ini. Ini yang dipakai di server kantor.
 *   tabel    satu baris per dokumen di tabel avenger_state di Supabase, untuk
 *            Vercel dan di mana pun berkas bersifat baca-saja.
 *
 * Jalur berkas sengaja DIPERTAHANKAN, bukan ditinggalkan. Jaringan kantor
 * tertutup: Avenger harus tetap bisa jalan penuh di sana tanpa bisa menjangkau
 * Supabase sama sekali.
 *
 * KENAPA SATU TABEL KUNCI-NILAI, BUKAN SATU TABEL PER MODUL
 *
 * Kodenya memang membaca dan menulis dokumen utuh. Memecah dua belas dokumen
 * itu jadi dua belas tabel berarti menulis ulang ketiga puluh lima pemanggil
 * bacaJson/tulisJson — demi 20 KB data yang tidak pernah dikueri per baris.
 * Dengan satu tabel kunci-nilai, tidak satu pun pemanggil berubah.
 *
 * Harganya jujur saja: dokumen ini tidak bisa dikueri per isinya dari SQL, dan
 * dua penyimpan yang bersamaan saling menimpa seutuhnya. Keduanya sama persis
 * dengan perilaku berkas sekarang, jadi bukan kemunduran.
 *
 * KENAPA pg DI-IMPORT DINAMIS
 *
 * Modul pg hanya dibutuhkan jalur tabel. Kalau di-import di atas, server kantor
 * yang tidak pernah memakai Supabase tetap gagal start selama pg belum
 * ter-install — padahal jaringan di sana bisa saja menolak npm install. Dengan
 * import dinamis di dalam cabangnya, jalur berkas tidak pernah menyentuh pg.
 *
 * BERKAS BINER IKUT DI SINI
 *
 * Foto galeri, logo unit, dan dokumen unit mengikuti aturan yang sama: berkas
 * di disk kalau jalur berkas, objek di Supabase Storage kalau jalur tabel.
 * Kuncinya pun sama bentuknya — jalur relatif terhadap akar aplikasi — jadi
 * satu berkas punya satu nama di kedua jalur, bukan dua nama yang harus
 * dicocokkan.
 *
 * Setelan lewat environment variable:
 *   AVENGER_DB=postgres    nyalakan jalur tabel. Tanpa ini: jalur berkas.
 *   DATABASE_URL           connection string Supabase, wajib kalau jalur tabel
 *   PGPOOL_MAX             ukuran kolam koneksi (bawaan 4 di serverless, 5 di server)
 *   SUPABASE_URL           https://<ref>.supabase.co, wajib untuk berkas biner
 *   SUPABASE_SERVICE_KEY   service role key. JANGAN pernah dikirim ke peramban.
 *   AVENGER_BUCKET         nama bucket (bawaan: avenger)
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

/* Dinyatakan sendiri, tidak disimpulkan dari ada-tidaknya DATABASE_URL.
   Menyimpulkan berarti satu variabel yang kebetulan terwarisi di server kantor
   diam-diam memindahkan seluruh penyimpanan ke Supabase. */
export const DI_TABEL = process.env.AVENGER_DB === 'postgres';

const DI_SERVERLESS = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

if (DI_TABEL && !process.env.DATABASE_URL) {
  throw new Error(
    'AVENGER_DB=postgres tetapi DATABASE_URL kosong. Dibiarkan jalan, seluruh '
    + 'simpanan akan jatuh ke berkas yang di Vercel bersifat baca-saja — dan '
    + 'kegagalannya baru terlihat waktu orang menekan Simpan.'
  );
}

/**
 * Kunci satu dokumen: jalurnya relatif terhadap akar aplikasi, selalu dengan
 * garis miring depan.
 *
 * Dipakai apa adanya sebagai primary key, jadi `data/dinas.json` di Windows dan
 * di Linux menghasilkan kunci yang sama. Tanpa penyeragaman ini, satu dokumen
 * bisa berdiri dua kali dengan pemisah jalur yang berbeda.
 */
export const kunciDari = (berkas) => path.relative(ROOT, berkas).split(path.sep).join('/');

/* ============== JALUR BERKAS ============== */

async function bacaBerkas(berkas, bawaan) {
  try {
    return JSON.parse(await fs.readFile(berkas, 'utf8'));
  } catch {
    return bawaan;   // belum ada, atau rusak: mulai dari kosong
  }
}

/**
 * Tulis lewat berkas sementara lalu rename. rename di dalam satu volume
 * bersifat atomik, jadi dokumennya tidak pernah tertangkap separuh tertulis
 * kalau prosesnya mati di tengah jalan.
 */
async function tulisBerkas(berkas, isi) {
  await fs.mkdir(path.dirname(berkas), { recursive: true });
  const sementara = berkas + '.tmp';
  await fs.writeFile(sementara, JSON.stringify(isi, null, 2) + '\n', 'utf8');
  await fs.rename(sementara, berkas);
}

/* ============== JALUR TABEL ============== */

let kolamJanji = null;

/**
 * Kolam koneksi, dibuat sekali dan hanya kalau benar-benar dipakai.
 *
 * Janjinya yang disimpan, bukan kolamnya: dua permintaan yang datang bersamaan
 * saat cold start akan menunggu janji yang sama, bukan membuat dua kolam.
 */
function kolam() {
  if (kolamJanji) return kolamJanji;
  const janji = (async () => {
    const { default: pg } = await import('pg');
    const p = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      // Supabase memakai sertifikat yang tidak ada di daftar bawaan Node.
      ssl: { rejectUnauthorized: false },
      max: Number(process.env.PGPOOL_MAX || (DI_SERVERLESS ? 4 : 5)),
      idleTimeoutMillis: DI_SERVERLESS ? 10_000 : 30_000,
      connectionTimeoutMillis: 15_000
    });
    // Koneksi bisa diputus sepihak oleh pooler Supabase saat menganggur. Tanpa
    // penangan ini, Node menganggapnya galat tak tertangani dan mematikan proses.
    p.on('error', (e) => console.error('[simpanan] koneksi menganggur bermasalah:', e.message));

    /* Tabelnya dibuat di luar aplikasi lebih dulu (DEPLOY.md 1.1) supaya
       perubahan skema jadi tindakan yang ditinjau. Baris ini jaring pengaman
       kalau ternyata terlewat; pada tabel yang sudah ada ia tidak mengunci
       apa pun dan tidak mengubah apa pun. */
    await p.query('CREATE TABLE IF NOT EXISTS avenger_state ('
      + 'kunci TEXT PRIMARY KEY, '
      + "isi TEXT NOT NULL DEFAULT '{}', "
      + "diubah_pada TEXT NOT NULL DEFAULT '', "
      + "diubah_oleh TEXT NOT NULL DEFAULT '')");
    return p;
  })();

  /* Kolam yang gagal dibuat tidak boleh jadi janji tertolak yang menempel
     selamanya — satu kegagalan jaringan saat cold start akan mematikan
     penyimpanan sampai prosesnya diganti. Percobaan berikutnya harus boleh
     mencoba lagi dari awal. */
  kolamJanji = janji.catch((e) => { kolamJanji = null; throw e; });
  return kolamJanji;
}

async function bacaTabel(kunci, bawaan) {
  const p = await kolam();
  const baris = (await p.query('SELECT isi FROM avenger_state WHERE kunci = $1', [kunci])).rows[0];
  if (!baris) return bawaan;
  try {
    return JSON.parse(baris.isi);
  } catch {
    /* Berbeda dari berkas rusak, isi tabel yang tidak bisa diurai tidak mungkin
       datang dari proses yang mati di tengah menulis — ia ditulis sekaligus.
       Jadi ini pertanda ada yang menyuntingnya dari luar aplikasi, dan pantas
       terdengar, bukan diam-diam dianggap kosong. */
    console.error('[simpanan] isi "' + kunci + '" bukan JSON yang sah — dianggap kosong.');
    return bawaan;
  }
}

async function tulisTabel(kunci, isi, oleh) {
  const p = await kolam();
  await p.query(
    'INSERT INTO avenger_state (kunci, isi, diubah_pada, diubah_oleh)'
    + ' VALUES ($1, $2, $3, $4)'
    + ' ON CONFLICT (kunci) DO UPDATE'
    + '   SET isi = EXCLUDED.isi,'
    + '       diubah_pada = EXCLUDED.diubah_pada,'
    + '       diubah_oleh = EXCLUDED.diubah_oleh',
    [kunci, JSON.stringify(isi, null, 2) + '\n', new Date().toISOString(), String(oleh || '')]
  );
}

/* ============== YANG DIPAKAI server.js ============== */

/**
 * Baca satu dokumen JSON. Yang belum pernah ada mengembalikan `bawaan` —
 * dokumen yang belum diisi bukan kesalahan, itu keadaan awal yang wajar.
 */
export async function bacaJson(berkas, bawaan) {
  return DI_TABEL ? bacaTabel(kunciDari(berkas), bawaan) : bacaBerkas(berkas, bawaan);
}

/**
 * Simpan satu dokumen JSON, seutuhnya.
 *
 * `oleh` boleh dikosongkan dan memang dikosongkan oleh hampir semua pemanggil:
 * ia hanya mengisi kolom catatan di jalur tabel, tidak pernah dipakai sebagai
 * penjagaan. Yang menjaga siapa boleh menulis apa tetap bolehIsi() di server.js.
 */
export async function tulisJson(berkas, isi, oleh) {
  return DI_TABEL ? tulisTabel(kunciDari(berkas), isi, oleh) : tulisBerkas(berkas, isi);
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
  if (!DI_TABEL) {
    await fs.rm(berkas, { force: true });
    return;
  }
  const p = await kolam();
  await p.query('DELETE FROM avenger_state WHERE kunci = $1', [kunciDari(berkas)]);
}

/* ============== BERKAS BINER ==============
 * Supabase Storage dipanggil lewat REST API-nya langsung, sama seperti yang
 * sudah terbukti di elogbook/db-pg.js — jadi tidak ada pustaka klien tambahan
 * yang perlu dipasang dan divendor.
 */

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const BUCKET = process.env.AVENGER_BUCKET || 'avenger';

/** Bisa tidaknya berkas biner disimpan — dipakai penjaga galeri dan dokumen. */
export const BINER_DI_STORAGE = DI_TABEL && !!SUPABASE_URL && !!SERVICE_KEY;

/* Dua penjaga yang dipakai server.js. Ditulis di sini, bukan di sana, supaya
   pertanyaan "bisa tidak ini disimpan" dijawab oleh yang memang tahu ke mana
   simpanannya pergi — bukan oleh tebakan dari ada-tidaknya variabel VERCEL. */

/** Dokumen JSON: jalur tabel selalu bisa; jalur berkas bisa kecuali di serverless. */
export const BISA_TULIS_JSON = DI_TABEL || !DI_SERVERLESS;

/** Berkas biner: perlu Storage kalau jalur tabel, perlu disk kalau jalur berkas. */
export const BISA_TULIS_BINER = DI_TABEL ? BINER_DI_STORAGE : !DI_SERVERLESS;

const kepalaStorage = () => ({ Authorization: 'Bearer ' + SERVICE_KEY, apikey: SERVICE_KEY });

/* Nama objek di bucket = kunci dokumen = jalur relatif. Garis miringnya
   dibiarkan apa adanya: Storage memang menganggapnya folder, dan itu yang
   membuat isi bucket bisa ditelusuri per unit lewat dasbor Supabase. */
const objek = (jalur) => SUPABASE_URL + '/storage/v1/object/' + BUCKET + '/'
  + kunciDari(jalur).split('/').map(encodeURIComponent).join('/');

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
export async function tulisBiner(jalur, buf, mime) {
  if (!DI_TABEL) {
    await fs.mkdir(path.dirname(jalur), { recursive: true });
    await fs.writeFile(jalur, buf);
    return;
  }
  if (!BINER_DI_STORAGE) {
    throw new Error('SUPABASE_URL dan SUPABASE_SERVICE_KEY belum diisi — berkas tidak bisa disimpan.');
  }
  const res = await fetch(objek(jalur), {
    method: 'POST',
    headers: { ...kepalaStorage(), 'Content-Type': mime || mimeDari(jalur), 'x-upsert': 'true' },
    body: buf
  });
  if (!res.ok) {
    throw new Error('Gagal mengunggah ke storage (' + res.status + '): ' + await res.text());
  }
}

/**
 * Ambil isi satu berkas biner, atau null kalau tidak ada.
 *
 * null dibedakan dari galat sengaja: berkas yang hilang adalah 404 yang wajar
 * dijawab ke pemakai, sedangkan koneksi yang putus adalah 500 yang pantas
 * terdengar. Jadi yang tidak ada mengembalikan null, yang rusak melempar.
 */
export async function bacaBiner(jalur) {
  if (!DI_TABEL) {
    try {
      return { buf: await fs.readFile(jalur), mime: mimeDari(jalur) };
    } catch {
      return null;
    }
  }
  if (!BINER_DI_STORAGE) return null;
  const res = await fetch(objek(jalur), { headers: kepalaStorage() });
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw new Error('Gagal membaca dari storage (' + res.status + ')');
  return {
    buf: Buffer.from(await res.arrayBuffer()),
    // Storage mengembalikan tipe yang dipakai waktu mengunggah; kalau ia
    // kosong atau terlalu umum, ekstensinya jawaban yang lebih baik.
    mime: res.headers.get('content-type') || mimeDari(jalur)
  };
}

/** Hapus satu berkas biner. Yang memang sudah tidak ada bukan kegagalan. */
export async function hapusBiner(jalur) {
  if (!DI_TABEL) {
    await fs.rm(jalur, { force: true });
    return;
  }
  if (!BINER_DI_STORAGE) return;
  try {
    await fetch(objek(jalur), { method: 'DELETE', headers: kepalaStorage() });
  } catch { /* berkasnya mungkin memang sudah tidak ada — abaikan */ }
}
