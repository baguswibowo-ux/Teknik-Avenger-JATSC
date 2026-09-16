/**
 * Tautan masuk dari dashboard: pembacaannya, dan bahwa ia SEKALI PAKAI.
 *
 * Yang kedua itu yang pernah lolos ke produksi. init() memanggil
 * bukaTabDariTautan() di ujungnya dan dijalankan lagi setiap kali unit
 * diganti, jadi tanda pagar yang dibiarkan menempel di alamat membuka jendela
 * pengisian berulang-ulang — administrator paling merasakannya karena cuma
 * dia yang punya banyak unit untuk digonta-ganti.
 *
 * Dijalankan di VM dengan DOM tiruan seadanya: yang diperiksa keputusannya
 * (tombol mana ditekan, berapa kali), bukan tampilannya.
 *
 * Jalankan dari akar aplikasi: node tools/uji-tautan-masuk.mjs
 */
import fs from 'node:fs';
import vm from 'node:vm';

const SRC = 'elogbook/public/js/26-init.js';
const src = fs.readFileSync(SRC, 'utf8');
const mulai = src.indexOf('function tautanMasuk()');
const akhir = src.indexOf('Alamat Dashboard Fasilitas Teknik');
if (mulai < 0 || akhir < 0) { console.error('blok tautan tidak ketemu di ' + SRC); process.exit(1); }
// Mundur ke awal komentar milik fungsi sesudahnya.
const kode = src.slice(mulai, src.lastIndexOf('/**', akhir));

let lulus = 0, gagal = 0;
const cek = (nama, benar) => { if (benar) lulus++; else { gagal++; console.log('  GAGAL: ' + nama); } };

/* ---------- DOM tiruan ---------- */
function bikinTombol(sifat = {}) {
  return {
    ditekan: 0,
    style: { display: '' },
    offsetParent: sifat.tersembunyi ? null : {},
    classList: { contains: () => !!sifat.aktif, add() {}, remove() {}, toggle() {} },
    getAttribute: () => sifat.onclick || '',
    closest: () => null,
    click() { this.ditekan++; },
    ...sifat
  };
}

function bikinRuang({ hash, tombolTab, tombolForm }) {
  const panel = {
    querySelector: (sel) => (sel.includes('btn-tambah') ? tombolForm : null),
    querySelectorAll: () => (tombolForm ? [tombolForm] : [])
  };
  const ruang = {
    location: { hash, pathname: '/logbook/', search: '' },
    history: { replaceState(_a, _b, alamat) { ruang.location.hash = ''; ruang.alamatTerakhir = alamat; } },
    document: {
      querySelector: (sel) => (sel.startsWith('.tab-btn') ? tombolTab : null),
      querySelectorAll: () => [],
      getElementById: () => panel
    },
    setTimeout: (fn) => fn(),   // jalankan seketika supaya urutannya terbaca
    console
  };
  vm.createContext(ruang);
  vm.runInContext(kode, ruang);
  return ruang;
}

/* ---------- 1. pembacaan tautan ---------- */
{
  const r = bikinRuang({ hash: '', tombolTab: null, tombolForm: null });
  const baca = (h) => { r.location.hash = h; return r.tautanMasuk(); };
  const t = (tab, unit, isi, lembar) => JSON.stringify({ tab, unit, isi, lembar });

  cek('daily check + gedung', JSON.stringify(baca('#dailycheck:radtel:isi:jatsc')) === t('dailycheck', 'radtel', true, 'jatsc'));
  cek('meter reading bersarang', JSON.stringify(baca('#meter:ppabn:isi:gp-07l')) === t('meter', 'ppabn', true, 'gp-07l'));
  cek('lembar berawalan angka', JSON.stringify(baca('#gcheck:ppabn:isi:07l')) === t('gcheck', 'ppabn', true, '07l'));
  cek('tanpa penanda isi', JSON.stringify(baca('#dstest:radtel')) === t('dstest', 'radtel', false, ''));
  cek('tab bertanda hubung', JSON.stringify(baca('#bk-neptuno:radtel:isi')) === t('bk-neptuno', 'radtel', true, ''));
  cek('kosong', baca('') === null);
  cek('tab huruf besar ditolak', baca('#TAB:radtel') === null);
  cek('nama lembar ngawur dibuang', JSON.stringify(baca("#dstest:radtel:isi:x')>ngaco")) === t('dstest', 'radtel', true, ''));
  cek('unit berspasi dibuang', JSON.stringify(baca('#dstest:RAD TEL:isi')) === t('dstest', '', true, ''));
}

/* ---------- 2. sekali pakai ---------- */
{
  const tab = bikinTombol();
  const form = bikinTombol({ onclick: "openMlModal('grounding')" });
  const r = bikinRuang({ hash: '#ml-grounding:listrikmekanik:isi:grounding', tombolTab: tab, tombolForm: form });

  r.bukaTabDariTautan();
  cek('kunjungan pertama membuka tab', tab.ditekan === 1);
  cek('kunjungan pertama membuka form', form.ditekan === 1);
  cek('tanda pagar dilepas', r.location.hash === '');

  // init() berikutnya — unit diganti, tab dibuka ulang, dan seterusnya.
  r.bukaTabDariTautan();
  r.bukaTabDariTautan();
  cek('pemuatan berikutnya tidak membuka tab lagi', tab.ditekan === 1);
  cek('pemuatan berikutnya tidak membuka form lagi', form.ditekan === 1);
}

/* ---------- 3. tanpa penanda isi, jendela tidak dibuka ---------- */
{
  const tab = bikinTombol();
  const form = bikinTombol({ onclick: "openDsModal()" });
  const r = bikinRuang({ hash: '#dstest:radtel', tombolTab: tab, tombolForm: form });
  r.bukaTabDariTautan();
  cek('tanpa :isi tabnya saja yang dibuka', tab.ditekan === 1 && form.ditekan === 0);
}

/* ---------- 4. tombol tersembunyi tidak ditekan ---------- */
{
  const tab = bikinTombol();
  const form = bikinTombol({ onclick: "openDsModal()", tersembunyi: true });
  const r = bikinRuang({ hash: '#dstest:radtel:isi', tombolTab: tab, tombolForm: form });
  r.bukaTabDariTautan();
  cek('peran baca: tab dibuka, form tidak', tab.ditekan === 1 && form.ditekan === 0);
}

console.log(`\n${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
