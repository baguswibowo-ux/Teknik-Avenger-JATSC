/**
 * Tiap jendela E-Logbook harus punya tombol tutup di kepalanya.
 *
 * Formulirnya panjang-panjang — lembar Neptuno 316 baris — dan sebelum ini
 * satu-satunya jalan keluar tombol Batal di kaki jendela: yang salah buka
 * harus menggulir sampai habis dulu.
 *
 * Yang diperiksa dua hal, dan yang kedua yang sering luput: tombolnya ada, dan
 * fungsi yang dipanggilnya benar-benar ADA di berkas js. Tombol tutup yang
 * memanggil fungsi salah ketik tidak melakukan apa-apa, dan tidak ada yang
 * tahu sampai ada yang menekannya.
 *
 * Jalankan dari akar aplikasi: node tools/uji-tombol-tutup.mjs
 */
import fs from 'node:fs';

const HTML = 'elogbook/public/index.html';
const JS_DIR = 'elogbook/public/js';

const s = fs.readFileSync(HTML, 'utf8');
let js = '';
for (const f of fs.readdirSync(JS_DIR)) js += '\n' + fs.readFileSync(JS_DIR + '/' + f, 'utf8');

const modal = [...s.matchAll(/<div class="modal-bg" id="([A-Za-z0-9_]+)"/g)];
let lulus = 0;
const gagal = [];

for (const m of modal) {
  const id = m[1];
  // Kepala jendela ada di awal isinya; 700 aksara sudah lewat dari cukup.
  const kepala = s.slice(m.index, m.index + 700);

  const punyaKepala = kepala.includes('class="modal-kepala"');
  if (!punyaKepala) { gagal.push(`${id}: kepalanya tidak memakai .modal-kepala`); continue; }

  const tombol = /<button class="icon-btn"[^>]*onclick="([A-Za-z0-9_]+)\(\)"/.exec(kepala);
  if (!tombol) { gagal.push(`${id}: tidak ada tombol tutup di kepalanya`); continue; }

  const fn = tombol[1];
  const ada = new RegExp('function\\s+' + fn + '\\s*\\(').test(js)
           || new RegExp('(const|let|var)\\s+' + fn + '\\s*=').test(js);
  if (!ada) { gagal.push(`${id}: fungsi ${fn}() tidak ada di js`); continue; }

  lulus++;
}

console.log(`Jendela diperiksa: ${modal.length}`);
for (const g of gagal) console.log('  GAGAL ' + g);
console.log(`\n${lulus} lulus, ${gagal.length} gagal`);
process.exit(gagal.length ? 1 : 0);
