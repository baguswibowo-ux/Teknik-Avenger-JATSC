/**
 * Tiap sumber kegiatan berkala di dashboard menunjuk satu lembar di E-Logbook.
 * Uji ini memastikan tujuannya BENAR-BENAR ADA di sana: tabnya, dan tombol
 * yang akan ditekan bukaLembar() — entah "+ Form Baru" milik lembar itu
 * (Preventive) atau sub-tab pemilih di dalam form (Daily Check).
 *
 * Tanpa uji ini, lembar yang salah nama baru ketahuan waktu teknisi menekan
 * cipnya dan tidak terjadi apa-apa.
 */
import fs from 'node:fs';
import vm from 'node:vm';

const DASH = 'public/js/23-berkala.js';
const HTML = 'elogbook/public/index.html';
const JS_DIR = 'elogbook/public/js';

/* ---- ambil BERKALA_SUMBER dari berkas dashboard ---- */
const src = fs.readFileSync(DASH, 'utf8');
const mulai = src.indexOf('const BERKALA_SUMBER = {');
const akhir = src.indexOf('\n});', src.indexOf('Object.assign(BERKALA_SUMBER, {')) + 4;
const potong = src.slice(mulai, akhir);

const ruang = {
  T: (id) => id,
  isoTgl: () => '',
  console,
};
vm.createContext(ruang);
vm.runInContext(potong.replace('const BERKALA_SUMBER = {', 'var BERKALA_SUMBER = {'), ruang);
const SUMBER = ruang.BERKALA_SUMBER;

/* ---- kumpulkan tombol yang ada di E-Logbook ---- */
let markup = fs.readFileSync(HTML, 'utf8');
// Sebagian tombol menulis kutipnya sebagai entity (&#39;). Peramban sudah
// memecahkannya sebelum getAttribute('onclick') dibaca, jadi di sini pun
// disamakan dulu — kalau tidak, lembar Maintenance Listrik terbaca "tidak ada"
// padahal tombolnya ada.
markup = markup.split('&#39;').join("'").split('&apos;').join("'");
// Sub-tab AMHS dibangun dari JS, bukan ditulis di index.html.
for (const f of fs.readdirSync(JS_DIR)) markup += '\n' + fs.readFileSync(JS_DIR + '/' + f, 'utf8');

const panelAda = (tab) =>
  markup.includes('id="view-' + tab + '"') || markup.includes('data-subtab="' + tab + '"');

/** Argumen tiap tombol yang bisa ditekan bukaLembar(), apa adanya. */
const argTombol = new Set();
const pola = /class="[^"]*\b(?:btn-tambah|subtab-btn)\b[^"]*"[^>]*onclick="[a-zA-Z]+\(\s*'([^']*)'\s*\)"/g;
for (const m of markup.matchAll(pola)) argTombol.add(m[1].toLowerCase());
// Bentuk terbalik (onclick lebih dulu, class menyusul) dan yang dirakit di JS.
const pola2 = /onclick="[a-zA-Z]+\(\s*'([^']*)'\s*\)"/g;
const polaKelas = /class="[^"]*\b(?:btn-tambah|subtab-btn)\b/;
for (const m of markup.matchAll(pola2)) {
  const awal = Math.max(0, m.index - 260);
  if (polaKelas.test(markup.slice(awal, m.index))) argTombol.add(m[1].toLowerCase());
}

/* Sub-tab AMHS dirakit di JS dari sebuah daftar, jadi argumennya tidak pernah
   tertulis utuh di sumber. Daftarnya dibaca langsung supaya uji ini tetap ikut
   berubah kalau lembar AMHS bertambah. */
const amhs = /const AMHS_SUB = \[([^\]]*)\]/.exec(fs.readFileSync(JS_DIR + '/12d-daily-check-amhs.js', 'utf8'));
if (!amhs) { console.error('AMHS_SUB tidak ketemu — ujinya yang perlu disesuaikan'); process.exit(1); }
for (const m of amhs[1].matchAll(/'([^']+)'/g)) argTombol.add(m[1].toLowerCase());

let lulus = 0, gagal = 0;
const laporGagal = [];

for (const [kunci, f] of Object.entries(SUMBER)) {
  if (!f.tab) continue;                       // ditandai di dashboard sendiri
  if (!panelAda(f.tab)) {
    gagal++; laporGagal.push(`${kunci}: tab/sub-tab "${f.tab}" tidak ada di E-Logbook`);
    continue;
  }
  if (f.lembar && !argTombol.has(String(f.lembar).toLowerCase())) {
    gagal++; laporGagal.push(`${kunci}: tidak ada tombol beragumen '${f.lembar}'`);
    continue;
  }
  lulus++;
}

console.log(`Sumber berkala yang menunjuk E-Logbook: ${lulus + gagal}`);
for (const g of laporGagal) console.log('  GAGAL ' + g);
console.log(`\n${lulus} lulus, ${gagal} gagal`);

/* NAMA YANG DIPAKAI LEBIH DARI SATU TOMBOL. 'jatsc' adalah gedung di Radtel
   dan juga di Gedung & Keamanan; 'sts' adalah lembar Daily Check Listrik dan
   juga lembar Pemeliharaan Listrik. Itu bukan kesalahan — yang membedakannya
   unit yang sedang dibuka, dan hanya milik unit itu yang terlihat di layar.
   Dicetak sebagai pengingat: bukaLembar() wajib menyaring "yang terlihat", dan
   yang kelak menghapus penyaringan itu akan membuat lembar-lembar inilah yang
   pertama mendarat di tombol unit lain. */
const dipakai = new Set(
  Object.values(SUMBER).filter(f => f.tab && f.lembar).map(f => String(f.lembar).toLowerCase())
);
const hitung = new Map();
for (const m of markup.matchAll(pola2)) {
  const awal = Math.max(0, m.index - 260);
  if (!polaKelas.test(markup.slice(awal, m.index))) continue;
  const k = m[1].toLowerCase();
  hitung.set(k, (hitung.get(k) || 0) + 1);
}
const kembar = [...hitung].filter(([k, n]) => n > 1 && dipakai.has(k));
if (kembar.length) {
  console.log('\nnama yang dipakai lebih dari satu tombol (wajib disaring "yang terlihat"):');
  for (const [k, n] of kembar) console.log(`  '${k}' — ${n} tombol`);
}

/* Berapa yang sudah menunjuk lembar spesifik, bukan cuma tab. */
const berlembar = Object.values(SUMBER).filter(f => f.tab && f.lembar).length;
const tanpa = Object.values(SUMBER).filter(f => f.tab && !f.lembar).length;
console.log(`menunjuk lembar spesifik: ${berlembar} · cuma tab: ${tanpa}`);
for (const [k, f] of Object.entries(SUMBER)) if (f.tab && !f.lembar) console.log('  cuma tab: ' + k + ' -> ' + f.tab);

process.exit(gagal ? 1 : 0);
