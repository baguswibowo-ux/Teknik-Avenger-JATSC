/**
 * UJI PENGINGAT KEGIATAN BERKALA — jalankan dengan:
 *
 *   node --test tools/uji-pengingat-berkala.mjs
 *
 * Yang dijaga:
 *   1. Registri bukti di pengingat-berkala.js SAMA dengan BERKALA_SUMBER di
 *      public/js/23-berkala.js — berkas aslinya dimuat di vm, lalu sumber demi
 *      sumber dibandingkan: larik yang dibaca, sebutan, saringan, dan tanggal
 *      baris pada deretan baris buatan. Juga: tiap sumbernya dikenal server.js.
 *   2. Kejadian, kunci selesai, dan rombongan sama dengan bklKejadian(),
 *      bklKunciTgl(), dan rombonganShift() dashboard.
 *   3. Pemilihan kegiatan untuk satu dinas: rombongan, bukti lembar, catatan
 *      manual, yang lewat, yang belum waktunya.
 *   4. Teks pesan.
 */

process.env.TZ = 'Asia/Jakarta';   // fungsi dashboard memakai jam setempat peramban (WIB)

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import {
  SUMBER_BUKTI, paketDibutuhkan, kejadian, kunciSelesai, rombongan, gedung,
  kegiatanUntukDinas, kunciPengingatBerkala
} from '../pengingat-berkala.js';
import { SHIFT_MULAI } from '../pengingat-dinas.js';
import { pesanBerkalaDinas } from '../telegram.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const AKAR = path.resolve(DIR, '..');
const baca = (...p) => fs.readFileSync(path.join(AKAR, ...p), 'utf8');

/** Registri dan fungsi kalender asli milik dashboard. */
function muatDashboard() {
  const ctx = vm.createContext({
    console,
    T: (id) => id,
    isoTgl: (x) => { const m = String(x || '').match(/\d{4}-\d{2}-\d{2}/); return m ? m[0] : ''; },
    bulanKode: (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  });
  const kode = baca('public', 'js', '02-kode-dinas.js') + '\n;' + baca('public', 'js', '23-berkala.js');
  vm.runInContext(kode, ctx);
  return vm.runInContext('({ BERKALA_SUMBER, bklKejadian, bklKunciTgl, bklTgl, rombonganShift, gedungShift, SHIFT })', ctx);
}

/* Baris buatan yang menyentuh semua cabang saringan. */
const BARIS = (() => {
  const keluar = [];
  const tanggal = [
    { Tanggal: '2026-09-14', DibuatPada: '2026-09-14T02:00:00Z' },
    { Tanggal: 'Senin, 14 September 2026', TanggalIso: '2026-09-13', DibuatPada: '2026-09-15T01:00:00Z' },
    { Tanggal: '', DibuatPada: '2026-09-12T23:00:00Z' },
    { Tanggal: '', DibuatPada: '' }
  ];
  const lokasi = ['', 'jatsc', 'new-jatsc'];
  const form = ['', 'ckg3', 'mer', 'toilet', 'jatsc', 'sts', 'mds', 'beban', 'ups', 'amhs', 'aadps', 'd-atis'];
  const kategori = ['radio', 'pgmweekly', 'llzgc', 'mrreading', 'maintlistrik', 'domestik'];
  const state = [{}, { __wForm: 'ckg3' }, { __wForm: 'smrt1' }, { __wForm: 'smrt3' },
    { __llzForm: '07l' }, { __llzForm: '25r' }, { __mrForm: 'gp-07r' }, { __mrForm: 'om-25r' },
    { __mlForm: 'genset' }, { __mlForm: 'ahu' }];
  const jenis = ['neptuno', 'gatevox', 'cleaning-cwp', 'restart-cwp', 'lain'];
  for (const t of tanggal) {
    for (const l of lokasi) for (const f of form) keluar.push({ ...t, Lokasi: l, Form: f });
    for (const k of kategori) for (const s of state) keluar.push({ ...t, Kategori: k, State: s });
    for (const j of jenis) keluar.push({ ...t, Jenis: j });
  }
  return keluar;
})();

test('registri bukti cermin BERKALA_SUMBER dashboard, sumber demi sumber', () => {
  const { BERKALA_SUMBER } = muatDashboard();
  const dash = Object.entries(BERKALA_SUMBER).filter(([, f]) => f.paket);
  assert.deepEqual(Object.keys(SUMBER_BUKTI).sort(), dash.map(([k]) => k).sort(), 'daftar sumber harus sama persis');
  for (const [kunci, f] of dash) {
    const s = SUMBER_BUKTI[kunci];
    assert.equal(s.paket, f.paket, `paket ${kunci}`);
    assert.equal(s.sebut, f.sebut[0], `sebutan ${kunci}`);
    for (const x of BARIS) {
      assert.equal(!s.saring || s.saring(x), !f.saring || !!f.saring(x), `saring ${kunci} ${JSON.stringify(x)}`);
      assert.equal(s.tgl(x), f.tgl(x) || '', `tgl ${kunci} ${JSON.stringify(x)}`);
    }
  }
});

test('setiap sumber bukti boleh disimpan server.js', () => {
  const server = baca('server.js');
  const blok = server.slice(server.indexOf('const BERKALA_SUMBER = new Map(['));
  const sahDitulis = new Set([...blok.slice(0, blok.indexOf(']);')).matchAll(/\['([^']+)'/g)].map((m) => m[1]));
  for (const kunci of Object.keys(SUMBER_BUKTI)) {
    if (sahDitulis.has(kunci)) continue;
    // Sebagian dibangun dari daftar (mr-*, ml-*, gc-llz-*): cukup awalannya disebut.
    const awalan = kunci.replace(/-[^-]+$/, '');
    assert.ok(new RegExp(`['\`]${awalan}-`).test(blok), `${kunci} tidak dikenal server.js`);
  }
});

test('kejadian dan kunci selesai sama dengan bklKejadian / bklKunciTgl', () => {
  const dash = muatDashboard();
  const kegiatan = [
    { id: 'h', jenis: 'harian' },
    { id: 'w1', jenis: 'mingguan', hari: null },
    { id: 'w3', jenis: 'mingguan', hari: [1, 3, 6] },
    { id: 'w7', jenis: 'mingguan', hari: 7 },
    { id: 'b', jenis: 'bulanan', tanggal: 5 },
    { id: 'b31', jenis: 'bulanan', tanggal: 31 },
    { id: 'q', jenis: 'triwulan', bulan: 2, tanggal: 10 },
    { id: 's', jenis: 'semesteran', bulan: 6, tanggal: 1 },
    { id: 't', jenis: 'tahunan', bulan: 12, tanggal: 28 },
    { id: 'x', jenis: 'mingguan', hari: ['2', 9, 0] }
  ];
  const hari = [];
  for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2027, 1, 1); t += 86400000 * 3) hari.push(t);
  hari.push(Date.UTC(2026, 11, 31), Date.UTC(2027, 0, 1), Date.UTC(2026, 8, 13), Date.UTC(2026, 8, 14));
  const iso = (t) => new Date(t).toISOString().slice(0, 10);
  for (const k of kegiatan) {
    for (const t of hari) {
      const [y, m, d] = iso(t).split('-').map(Number);
      const lokal = new Date(y, m - 1, d, 10);
      // Array.from: larik dari realm vm tidak lolos deepStrictEqual walau isinya sama.
      const dariDash = Array.from(dash.bklKejadian(k, lokal), (j) => dash.bklTgl(j));
      assert.deepEqual(kejadian(k, t).map(iso), dariDash, `kejadian ${k.id} ${iso(t)}`);
    }
  }
  // bklKunciTgl memakai periode HARI INI — dibandingkan pada hari ini.
  const kini = new Date();
  const hariIni = Date.UTC(kini.getFullYear(), kini.getMonth(), kini.getDate());
  for (const k of kegiatan) {
    assert.equal(kunciSelesai('radtel', k, '2026-09-14', hariIni), dash.bklKunciTgl('radtel', k, '2026-09-14'), `kunci ${k.id}`);
  }
});

test('rombongan sama dengan rombonganShift dashboard', () => {
  const dash = muatDashboard();
  for (const k of Object.keys(SHIFT_MULAI)) assert.equal(rombongan(k), dash.rombonganShift(k), k);
});

test('gedung sama dengan gedungShift dashboard', () => {
  const dash = muatDashboard();
  for (const k of Object.keys(SHIFT_MULAI)) assert.equal(gedung(k), dash.gedungShift(k), k);
  assert.equal(gedung('PSJ'), 'jatsc');
  assert.equal(gedung('PNJ'), 'new-jatsc');
  assert.equal(gedung('SPKLMN'), 'new-jatsc');
  assert.equal(gedung('P'), '');
  assert.equal(gedung('IJIN'), '');
});

/* Senin 14 September 2026, 08:00 WIB. */
const SENIN_08 = Date.UTC(2026, 8, 14, 1);

test('kegiatanUntukDinas: bukti lembar, catatan manual, rombongan, lewat, belum waktunya', () => {
  const kegiatan = [
    { id: 'dc', nama: 'Daily Check', jenis: 'harian', sumber: 'dailycheck-jatsc', shift: '', lokasi: 'jatsc' },
    { id: 'dcN', nama: 'Daily Check New', jenis: 'harian', sumber: 'dailycheck-newjatsc', shift: '', lokasi: 'new-jatsc' },
    { id: 'nep', nama: 'Neptuno', jenis: 'mingguan', hari: [1], sumber: 'bk-neptuno', shift: 'PS' },
    { id: 'mlm', nama: 'Malam saja', jenis: 'mingguan', hari: [1], sumber: '', shift: 'M' },
    { id: 'rab', nama: 'Tiap Rabu', jenis: 'mingguan', hari: [3], sumber: '', shift: '' },
    { id: 'blt', nama: 'Bulanan lewat', jenis: 'bulanan', tanggal: 10, sumber: 'gc-llz-07l', shift: '' },
    { id: 'bld', nama: 'Bulanan nanti', jenis: 'bulanan', tanggal: 20, sumber: '', shift: '' },
    { id: 'man', nama: 'Manual dicentang', jenis: 'bulanan', tanggal: 1, sumber: '', shift: '' },
    { id: 'aneh', nama: 'Sumber tak dikenal', jenis: 'harian', sumber: 'entah', shift: '' }
  ];
  const bukti = {
    dcHistory: [
      { TanggalIso: '2026-09-14', Lokasi: 'jatsc', Form: '' },        // JATSC sudah
      { TanggalIso: '2026-09-13', Lokasi: 'new-jatsc', Form: '' }     // New JATSC kemarin, bukan hari ini
    ],
    dstest: [{ Tanggal: '2026-09-11', Kategori: 'llzgc', State: { __llzForm: '07l' } }],  // bukan tgl 10
    berkala: []
  };
  const selesai = { 'radtel|man|2026-09': { oleh: 'x' } };
  const pilih = (kunci) => kegiatanUntukDinas({ unit: 'radtel', kunci, saatMs: SENIN_08, kegiatan, selesai, bukti })
    .map((x) => [x.k.id, x.sisa]);

  // PSJ di JATSC: Daily Check New JATSC bukan pekerjaannya (laporan Bagus 14 Sep).
  assert.deepEqual(pilih('PSJ'), [['blt', -4], ['nep', 0], ['aneh', 0]]);
  assert.deepEqual(pilih('MN'), [['blt', -4], ['dcN', 0], ['mlm', 0], ['aneh', 0]]);
  // Kode tanpa gedung tetap diingatkan kegiatan berlokasi.
  assert.deepEqual(pilih('P'), [['blt', -4], ['dcN', 0], ['nep', 0], ['aneh', 0]]);

  // Rabu sudah lewat pekan lalu tidak ikut: kejadian hanya di pekan berjalan.
  const rabu = kegiatanUntukDinas({ unit: 'radtel', kunci: 'PSJ', saatMs: Date.UTC(2026, 8, 18, 1), kegiatan, selesai, bukti });
  assert.ok(rabu.some((x) => x.k.id === 'rab' && x.sisa === -2));
  assert.equal(pilih('PSJ').length, 3);

  // Sebutan lembar ikut untuk yang bersumber E-Logbook, kosong untuk manual.
  const semua = kegiatanUntukDinas({ unit: 'radtel', kunci: 'MJ', saatMs: SENIN_08, kegiatan, selesai, bukti });
  assert.equal(semua.find((x) => x.k.id === 'blt').sebut, 'lembar Ground Check LLZ 07L');
  assert.equal(semua.find((x) => x.k.id === 'mlm').sebut, '');

  // Malam dinas mulai 20:00 WIB → pengingat 21:00 WIB = 14:00 UTC, masih Senin.
  assert.deepEqual(
    kegiatanUntukDinas({ unit: 'radtel', kunci: 'MJ', saatMs: Date.UTC(2026, 8, 14, 14), kegiatan, selesai, bukti }).map((x) => x.k.id),
    semua.map((x) => x.k.id));

  assert.deepEqual(kegiatanUntukDinas({ unit: 'radtel', kunci: 'PSJ', saatMs: SENIN_08, kegiatan: null }), []);
  assert.deepEqual(paketDibutuhkan(kegiatan).sort(), ['dcHistory', 'berkala', 'dstest'].sort());
  assert.deepEqual(paketDibutuhkan([{ id: 'a', sumber: '' }]), []);
});

test('kunci pengingat berkala berbeda dari kunci pengingat dinas', () => {
  const p = { tanggal: '2026-09-14', unit: 'radtel', kunci: 'PSJ' };
  assert.equal(kunciPengingatBerkala(p, 'ADMIN'), 'berkala|2026-09-14|radtel|PSJ|admin');
});

test('teks pesan: HTML aman, lewat dan rombongan disebut', () => {
  const teks = pesanBerkalaDinas({
    nama: 'Bagus <W>', unit: 'Radtel', namaShift: 'PS JATSC', kode: 'PSJ',
    tanggal: 'Senin, 14 September 2026', jam: '07:00 WIB',
    daftar: [
      { k: { id: 'a', nama: 'Ground Check <LLZ>', jenis: 'bulanan' }, sisa: -4, sebut: 'lembar Ground Check LLZ 07L' },
      { k: { id: 'b', nama: 'Neptuno', jenis: 'mingguan', shift: 'PS' }, sisa: 0, sebut: '' }
    ]
  });
  assert.match(teks, /^📋 <b>Kegiatan berkala dinas Anda<\/b>/);
  assert.match(teks, /Bagus &lt;W&gt;, Anda sedang dinas <b>PS JATSC<\/b> di unit Radtel \(mulai 07:00 WIB\)\./);
  assert.match(teks, /1\. <b>Ground Check &lt;LLZ&gt;<\/b> — bulanan · <b>lewat 4 hari<\/b>\n {4}isi lembar Ground Check LLZ 07L di E-Logbook/);
  assert.match(teks, /2\. <b>Neptuno<\/b> — mingguan · rombongan PS$/m);
  assert.ok(!teks.includes('<W>'));
});

test('kegiatan berkala produksi (kalau ada) terbaca tanpa meledak', { skip: !fs.existsSync(path.join(AKAR, 'data', 'berkala.json')) }, () => {
  const semua = JSON.parse(baca('data', 'berkala.json'));
  for (const [unit, kegiatan] of Object.entries(semua)) {
    for (const k of kegiatan) {
      assert.ok(!k.sumber || SUMBER_BUKTI[k.sumber], `sumber ${k.sumber} (${unit}/${k.id}) tidak dikenal registri`);
    }
    const hasil = kegiatanUntukDinas({ unit, kunci: 'PSJ', saatMs: SENIN_08, kegiatan, selesai: {}, bukti: {} });
    for (const x of hasil) assert.ok(x.sisa <= 0 && /^\d{4}-\d{2}-\d{2}$/.test(x.tanggal));
  }
});
