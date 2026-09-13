/**
 * UJI PENGINGAT DINAS — jalankan dengan:
 *
 *   node --test elogbook/tools/uji-pengingat-dinas.mjs
 *
 * Tiga hal yang dijaga:
 *   1. Tabel jam di pengingat-dinas.js SAMA dengan SHIFT di
 *      public/js/02-kode-dinas.js milik dashboard — berkas aslinya dimuat di
 *      dalam vm, lalu dibandingkan kode demi kode, termasuk pembaku kodeBaku()
 *      untuk tulisan kotor seperti "MJ (SPKL)" dan "C  U  T  I".
 *   2. Perhitungan jam mulai: PS 00 UTC, Malam 12 UTC, Malam mundur ke 13 kalau
 *      harinya dipecah P/S, libur tidak ikut, rentang hari dan bulan benar.
 *   3. Pencocokan petak → akun: NIK dulu, nama persis, nama longgar hanya kalau
 *      kenanya tepat satu.
 * Ditambah satu uji dengan jadwal produksi (data/dinas.json) kalau ada — hanya
 * memastikan tidak ada yang meledak dan bentuk keluarannya benar.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import {
  SHIFT_MULAI, kodeBaku, jamMulai, dinasDalamRentang, usernameUntukPetak,
  kunciPengingat, jamWib, tanggalWib
} from '../pengingat-dinas.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const AKAR = path.resolve(DIR, '..', '..');

/** SHIFT, kodeBaku, jamShift asli milik dashboard, dimuat dari berkasnya. */
function muatKodeDinasDashboard() {
  const sumber = fs.readFileSync(path.join(AKAR, 'public', 'js', '02-kode-dinas.js'), 'utf8');
  const ctx = vm.createContext({ console });
  vm.runInContext(sumber + '\n;({ SHIFT, kodeBaku, jamShift, berdinasShift })', ctx);
  return vm.runInContext('({ SHIFT, kodeBaku, jamShift, berdinasShift })', ctx);
}

test('tabel jam cermin SHIFT dashboard, kode demi kode', () => {
  const { SHIFT } = muatKodeDinasDashboard();
  const kunciDash = Object.keys(SHIFT).sort();
  const kunciSini = Object.keys(SHIFT_MULAI).sort();
  assert.deepEqual(kunciSini, kunciDash, 'daftar kode harus sama persis');
  for (const k of kunciDash) {
    assert.equal(SHIFT_MULAI[k].mulai, SHIFT[k].mulai, `jam mulai ${k}`);
    assert.equal(!!SHIFT_MULAI[k].malam, !!SHIFT[k].malam, `sifat malam ${k}`);
    assert.equal(!!SHIFT_MULAI[k].geser, !!SHIFT[k].geser, `sifat geser ${k}`);
    assert.equal(!!SHIFT_MULAI[k].libur, !!SHIFT[k].libur, `sifat libur ${k}`);
    assert.equal(SHIFT_MULAI[k].nama, SHIFT[k].nama, `nama ${k}`);
  }
});

test('kodeBaku sama dengan milik dashboard untuk tulisan bersih dan kotor', () => {
  const dash = muatKodeDinasDashboard();
  const contoh = [
    ...Object.keys(SHIFT_MULAI), 'psj', ' MN ', 'MJ (SPKL)', 'PSJ (SPKL)', 'C  U  T  I',
    'pagi', 'SIANG', 'Malam', 'ct', 'Cuti Tahunan', 'Izin', 'Dinas Luar', 'SAKIT',
    'PAGI (SPKL)', 'SPKL', 'XYZ', '', null, undefined, '  ', 'P (SPKL)', 'S(SPKL)'
  ];
  for (const c of contoh) assert.equal(kodeBaku(c), dash.kodeBaku(c), `kodeBaku(${JSON.stringify(c)})`);
  assert.equal(kodeBaku('MJ (SPKL)'), 'SPKLMJ');
  assert.equal(kodeBaku('C  U  T  I'), 'CUTI');
  assert.equal(kodeBaku('XYZ'), '');
});

test('jamMulai sama dengan jamShift dashboard, termasuk aturan geser', () => {
  const dash = muatKodeDinasDashboard();
  const semua = Object.keys(SHIFT_MULAI);
  for (const k of semua) {
    for (const hari of [[], ['PSJ', 'MJ'], ['P', 'S', 'MJ'], ['SPKLP', 'MN'], ['Pagi', 'Siang', 'Malam']]) {
      assert.equal(jamMulai(k, hari), dash.jamShift(k, hari).mulai, `jamMulai(${k}, ${hari})`);
    }
  }
  assert.equal(jamMulai('MJ', ['PSJ', 'MJ']), 12);
  assert.equal(jamMulai('MJ', ['PJ', 'SJ', 'MJ']), 13);
  assert.equal(jamMulai('PSJ', ['PJ', 'SJ', 'MJ']), 0, 'geser hanya memundurkan malam');
  assert.ok(Number.isNaN(jamMulai('XYZ', [])));
});

/* Jadwal buatan: September 2026, unit radtel. Tanggal 5 dipecah P/S/M,
   tanggal 6 pola PS/M biasa, tanggal 7 ada cuti dan kode kotor. */
function jadwalContoh() {
  const hari = (isi) => { const h = Array(30).fill(''); Object.assign(h, isi); return h; };
  return {
    '2026-09': {
      _diubah: { radtel: { oleh: 'bagus', jam: '2026-09-01T00:00:00Z' } },
      radtel: [
        { nama: 'BAGUS WIBOWO', nik: '10012550', hari: hari({ 4: 'PJ', 5: 'PSJ', 6: 'MJ (SPKL)' }) },
        { nama: 'DWINTA AGISTA', nik: '10083560', hari: hari({ 4: 'SJ', 5: 'MN' }) },
        { nama: 'TONY EDY PURNOMO', nik: '', hari: hari({ 4: 'MJ', 5: 'C  U  T  I', 6: 'PSN' }) },
        { nama: 'ORANG ASING', nik: '', hari: hari({ 5: 'XYZ' }) }
      ],
      ppabn: [
        { nama: 'YUKI NOVISASORI', nik: '10099001', hari: hari({ 5: 'MJ' }) }
      ]
    }
  };
}

const utc = (d, h, mnt = 0) => Date.UTC(2026, 8, d, h, mnt);

test('dinasDalamRentang: jam mulai per petak, Malam mundur saat hari dipecah', () => {
  const semua = dinasDalamRentang(jadwalContoh(), utc(4, 0), utc(8, 0));
  const cari = (nama, tanggal) => semua.find((p) => p.nama === nama && p.tanggal === tanggal);

  // Tanggal 5 dipecah PJ/SJ/MJ → Malam mulai 13 UTC.
  assert.equal(cari('BAGUS WIBOWO', '2026-09-05').mulaiMs, utc(5, 0));
  assert.equal(cari('DWINTA AGISTA', '2026-09-05').mulaiMs, utc(5, 7));
  assert.equal(cari('TONY EDY PURNOMO', '2026-09-05').mulaiMs, utc(5, 13), 'malam mundur ke 13 UTC');
  // Unit lain di tanggal yang sama tidak ikut mundur — polanya per unit.
  assert.equal(cari('YUKI NOVISASORI', '2026-09-06').mulaiMs, utc(6, 12));
  // Tanggal 6 pola biasa → Malam 12 UTC.
  assert.equal(cari('DWINTA AGISTA', '2026-09-06').mulaiMs, utc(6, 12));
  assert.equal(cari('BAGUS WIBOWO', '2026-09-06').mulaiMs, utc(6, 0));
  // Kode kotor dibakukan; kode libur dan kode asing tidak ikut.
  const spkl = cari('BAGUS WIBOWO', '2026-09-07');
  assert.equal(spkl.kunci, 'SPKLMJ');
  assert.equal(spkl.namaShift, 'SPKL Malam JATSC');
  assert.equal(spkl.kode, 'MJ (SPKL)');
  assert.equal(cari('TONY EDY PURNOMO', '2026-09-06'), undefined, 'cuti tidak diingatkan');
  assert.equal(cari('ORANG ASING', '2026-09-06'), undefined, 'kode asing tidak punya jam');
  assert.equal(semua.length, 8);
  for (const p of semua) {
    assert.ok(['radtel', 'ppabn'].includes(p.unit));
    assert.match(p.tanggal, /^2026-09-\d\d$/);
  }
});

test('dinasDalamRentang: batas rentang, pergantian hari, dan bulan yang tidak ada', () => {
  const j = jadwalContoh();
  // Jendela sejam sebelum 00 UTC tanggal 6 = 23:00 UTC tanggal 5: petak PSJ
  // tanggal 6 harus terlihat dari "hari sebelumnya".
  const kini = utc(5, 23, 5);
  const dalam = dinasDalamRentang(j, kini + 1, kini + 3600000 + 1);
  assert.deepEqual(dalam.map((p) => [p.nama, p.tanggal, p.kunci]).sort(),
    [['BAGUS WIBOWO', '2026-09-06', 'PSJ']]);
  // Tepat di batas: mulai == dari ikut, mulai == sampai tidak.
  assert.equal(dinasDalamRentang(j, utc(6, 0), utc(6, 0) + 1).length, 1);
  assert.equal(dinasDalamRentang(j, utc(5, 23), utc(6, 0)).length, 0);
  // Bulan yang tidak ada di jadwal: kosong, tidak meledak.
  assert.deepEqual(dinasDalamRentang(j, Date.UTC(2026, 10, 1), Date.UTC(2026, 10, 3)), []);
  assert.deepEqual(dinasDalamRentang(null, 0, 1), []);
  assert.deepEqual(dinasDalamRentang({ '2026-09': { radtel: 'bukan array' } }, utc(1, 0), utc(30, 0)), []);
});

test('usernameUntukPetak: NIK dulu, nama persis, nama longgar hanya kalau tunggal', () => {
  const akun = [
    { username: '10012550', nama: 'Bagus Wibowo' },
    { username: '10083560', nama: 'Dwinta Agista Audiyari Ismail' },
    { username: '10011111', nama: 'Tony Edi Purnomo' },
    { username: '10022222', nama: 'Berry Poedjolaksono' },
    { username: '10033333', nama: 'Yoga Noer' },
    { username: '10044444', nama: 'Yoga Noer Pratama' },
    { username: 'admin', nama: 'Administrator' }
  ];
  // NIK menang, walau namanya beda ejaan.
  assert.equal(usernameUntukPetak({ nik: '10012550', nama: 'B. WIBOWO' }, akun), '10012550');
  // NIK yang tidak ada akunnya jatuh ke nama.
  assert.equal(usernameUntukPetak({ nik: '99999999', nama: 'bagus wibowo' }, akun), '10012550');
  // Kolom nama berisi username (akun uji di jadwal, NIK ditulis di kolom nama).
  assert.equal(usernameUntukPetak({ nik: '', nama: 'uji.teknisi' }, [...akun, { username: 'uji.teknisi', nama: 'Uji Teknisi' }]), 'uji.teknisi');
  assert.equal(usernameUntukPetak({ nik: '', nama: '10012550' }, akun), '10012550');
  // Nama persis, beda huruf besar dan spasi ganda.
  assert.equal(usernameUntukPetak({ nik: '', nama: 'TONY  EDI   PURNOMO' }, akun), '10011111');
  // Longgar: yang satu memuat yang lain.
  assert.equal(usernameUntukPetak({ nik: '', nama: 'DWINTA AGISTA' }, akun), '10083560');
  // Longgar tapi dua akun kena → tidak yakin → kosong.
  assert.equal(usernameUntukPetak({ nik: '', nama: 'YOGA NOER' }, akun), '10033333', 'persis menang atas longgar');
  assert.equal(usernameUntukPetak({ nik: '', nama: 'YOGA' }, akun), '', 'dua kandidat longgar → kosong');
  // Ejaan beda yang tidak saling memuat: tidak ketemu, jangan menebak.
  assert.equal(usernameUntukPetak({ nik: '', nama: 'TONY EDY PURNOMO' }, akun), '');
  assert.equal(usernameUntukPetak({ nik: '', nama: 'BERRY POEDJO L.' }, akun), '');
  // Nama pendek tidak dicocokkan longgar.
  assert.equal(usernameUntukPetak({ nik: '', nama: 'ADM' }, akun), '');
  assert.equal(usernameUntukPetak({ nik: '', nama: '' }, akun), '');
  assert.equal(usernameUntukPetak(null, akun), '');
});

test('kunci pengingat, jam dan tanggal WIB', () => {
  const p = { tanggal: '2026-09-06', unit: 'radtel', kunci: 'PSJ', mulaiMs: utc(6, 0) };
  assert.equal(kunciPengingat(p, '10012550'), '2026-09-06|radtel|PSJ|10012550');
  assert.equal(kunciPengingat(p, 'ADMIN'), kunciPengingat(p, 'admin'));
  assert.equal(jamWib(utc(6, 0)), '07:00 WIB');
  assert.equal(jamWib(utc(6, 12)), '19:00 WIB');
  assert.equal(jamWib(utc(6, 13)), '20:00 WIB');
  assert.equal(tanggalWib(utc(6, 0)), 'Minggu, 6 September 2026');
  assert.equal(tanggalWib(utc(6, 13)), 'Minggu, 6 September 2026');
  // 23:30 UTC = 06:30 WIB esok harinya.
  assert.equal(tanggalWib(utc(5, 23, 30)), 'Minggu, 6 September 2026');
});

test('jadwal produksi (kalau ada) terbaca tanpa meledak', (t) => {
  const berkas = path.join(AKAR, 'data', 'dinas.json');
  if (!fs.existsSync(berkas)) return t.skip('data/dinas.json tidak ada');
  const jadwal = JSON.parse(fs.readFileSync(berkas, 'utf8'));
  const bulan = Object.keys(jadwal).filter((b) => /^\d{4}-\d{2}$/.test(b)).sort();
  if (!bulan.length) return t.skip('jadwal kosong');
  const [y, m] = bulan[0].split('-').map(Number);
  const [y2, m2] = bulan[bulan.length - 1].split('-').map(Number);
  const semua = dinasDalamRentang(jadwal, Date.UTC(y, m - 1, 1), Date.UTC(y2, m2, 1));
  assert.ok(semua.length > 0);
  for (const p of semua) {
    assert.ok(SHIFT_MULAI[p.kunci] && !SHIFT_MULAI[p.kunci].libur);
    assert.ok(Number.isFinite(p.mulaiMs));
    assert.ok([0, 7, 12, 13].includes(new Date(p.mulaiMs).getUTCHours()));
  }
});
