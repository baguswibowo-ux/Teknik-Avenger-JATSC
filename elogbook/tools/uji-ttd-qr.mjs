/**
 * UJI TTD QR — node elogbook/tools/uji-ttd-qr.mjs
 *
 * Memakai database kosong di folder sementara: ELOGBOOK_DATA_DIR disetel
 * SEBELUM db.js diimpor, supaya tidak ada yang tertulis ke data sungguhan.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'uji-ttd-qr-'));
process.env.ELOGBOOK_DATA_DIR = path.join(DIR, 'data');
process.env.ELOGBOOK_UPLOAD_DIR = path.join(DIR, 'uploads');
process.env.ELOGBOOK_DB = '';
fs.mkdirSync(process.env.ELOGBOOK_DATA_DIR, { recursive: true });
fs.mkdirSync(process.env.ELOGBOOK_UPLOAD_DIR, { recursive: true });

const db = await import('../db.js');
const { PENANDA_QR, AWALAN_QR, pemanggil, urlTtdQr, bacaUrlTtdQr, teksTtdQr, svgTtdQr } = await import('../ttd-qr.js');
const DATA = db.DATA_DIR;

db.createUser({ username: '10012550', nama: 'Bagus Wibowo', role: 'teknisi', password: 'rahasia-uji' });
db.createUser({ username: 'arya', nama: 'Arya Gunanawan', role: 'pejabat', password: 'rahasia-uji' });
const BAGUS = { username: '10012550', nama: 'Bagus Wibowo' };
const ARYA = { username: 'arya', nama: 'Arya Gunanawan' };
const GORESAN = 'data:image/png;base64,iVBORw0KGgo=';

const logbook = (ttd, lain = {}) => ({
  unit: 'radtel', tanggal: '2026-10-12', jam: '08:00', dinas: 'Pagi', uraian: 'Uji',
  teknisiNama: 'Bagus Wibowo', teknisiNamaList: ['Bagus Wibowo'], teknisiTtd: ttd,
  pjNama: 'Arya Gunanawan', ttdUntuk: 'arya', ...lain
});

test('alamat QR: bolak-balik, dan yang bukan buatan server ditolak', () => {
  const url = urlTtdQr({ unit: 'Radtel', nama: 'Bagus  Wibowo ', nik: '10012550' }, DATA);
  assert.ok(url.startsWith(AWALAN_QR) && url.endsWith('.svg'));
  assert.deepEqual(bacaUrlTtdQr(url, DATA), { unit: 'Radtel', nama: 'Bagus Wibowo', nik: '10012550', jabatan: '' });
  // Isi diganti, segel lama: ditolak.
  const palsu = Buffer.from(JSON.stringify(['Radtel', 'Orang Lain', '1'])).toString('base64url');
  assert.equal(bacaUrlTtdQr(AWALAN_QR + palsu + '.' + url.split('.')[1] + '.svg', DATA), null);
  assert.equal(bacaUrlTtdQr('/uploads/logbook_pj_1.png', DATA), null);
});

test('yang terbaca saat dipindai: kop, unit, nama, NIK — NIK hilang kalau tidak ada', () => {
  assert.equal(teksTtdQr({ unit: 'Radtel', nama: 'Bagus Wibowo', nik: '10012550' }),
    'Perum LPPNPI Cabang JATSC\nUnit: Radtel\nNama: Bagus Wibowo\nNIK: 10012550');
  assert.equal(teksTtdQr({ unit: 'Radkom', nama: 'Personil Ops', nik: '' }),
    'Perum LPPNPI Cabang JATSC\nUnit: Radkom\nNama: Personil Ops');
  const svg = svgTtdQr({ unit: 'Radtel', nama: 'Bagus Wibowo', nik: '10012550' });
  assert.match(svg, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="480" height="480" /);
  assert.match(svg, /<image href="data:image\/png;base64,/);   // lambang di tengah
});

test('teknisi: penanda maupun goresan lama jadi QR akun yang sedang login', () => {
  for (const kiriman of [PENANDA_QR, GORESAN]) {
    const e = pemanggil.run(BAGUS, () => db.insertEntry(logbook(kiriman), BAGUS.username, BAGUS.nama));
    assert.deepEqual(bacaUrlTtdQr(e.TeknisiTTD, DATA), { unit: 'Radtel', nama: 'Bagus Wibowo', nik: '10012550', jabatan: '' });
    assert.equal(e.PJTTD, '');
  }
  // Nama di badan kiriman tidak menentukan siapa penanda tangannya.
  const e = pemanggil.run(BAGUS, () => db.insertEntry(logbook(PENANDA_QR, { teknisiNama: 'Orang Lain' }), BAGUS.username, BAGUS.nama));
  assert.equal(bacaUrlTtdQr(e.TeknisiTTD, DATA).nama, 'Bagus Wibowo');
});

test('tanpa TTD tetap kosong; tanpa akun yang login ditolak; alamat QR karangan ditolak', () => {
  const e = pemanggil.run(BAGUS, () => db.insertEntry(logbook(''), BAGUS.username, BAGUS.nama));
  assert.equal(e.TeknisiTTD, '');
  assert.throws(() => db.insertEntry(logbook(PENANDA_QR), BAGUS.username, BAGUS.nama), /akun yang sedang login/);
  const palsu = AWALAN_QR + Buffer.from('["Radtel","Arya Gunanawan",""]').toString('base64url') + '.AAAAAAAAAAAAAAAA.svg';
  assert.throws(() => pemanggil.run(BAGUS, () => db.insertEntry(logbook(palsu), BAGUS.username, BAGUS.nama)), /tidak sah/);
});

test('pejabat menandatangani: QR akunnya; NIK dari kolom nik kalau username bukan NIK', () => {
  const e = pemanggil.run(BAGUS, () => db.insertEntry(logbook(PENANDA_QR), BAGUS.username, BAGUS.nama));
  const tanda = () => pemanggil.run(ARYA, () => db.tandaTanganiCatatan('logbook', e.ID,
    { nama: ARYA.nama, username: ARYA.username, role: 'pejabat', ttd: PENANDA_QR, wakilDari: [], diwakili: [] }));
  const h = tanda();
  // Akun pejabat adalah Manager Teknik walau jabatannya tidak diisi.
  assert.deepEqual(bacaUrlTtdQr(h.ttd, DATA), { unit: 'Radtel', nama: 'Arya Gunanawan', nik: '', jabatan: 'Manager Teknik' });
  assert.throws(tanda, /sudah ditandatangani/);

  assert.equal(db.setIdentitasTtdAkun('arya', { nik: '10010001' }), true);
  const e2 = pemanggil.run(BAGUS, () => db.insertEntry(logbook(PENANDA_QR), BAGUS.username, BAGUS.nama));
  const h2 = pemanggil.run(ARYA, () => db.tandaTanganiCatatan('logbook', e2.ID,
    { nama: ARYA.nama, username: ARYA.username, role: 'pejabat', ttd: PENANDA_QR, wakilDari: [], diwakili: [] }));
  const arya = bacaUrlTtdQr(h2.ttd, DATA);
  assert.deepEqual({ nik: arya.nik, jabatan: arya.jabatan }, { nik: '10010001', jabatan: 'Manager Teknik' });
  // Jabatan menggantikan baris unit pada yang terbaca.
  assert.equal(teksTtdQr(arya), 'Perum LPPNPI Cabang JATSC\nJabatan: Manager Teknik\nNama: Arya Gunanawan\nNIK: 10010001');
});

test('penanda tangan tanpa akun (Personil Operasi): QR unit + nama, tanpa NIK', () => {
  const m = pemanggil.run(BAGUS, () => db.insertMonitoring({
    unit: 'radkom', tanggal: '2026-10-12', baris: [Object.fromEntries(db.KOLOM_MONITORING.map((k) => [k, 'x']))],
    personilOps: 'Rina Operasi', personilTeknik: 'Bagus Wibowo', teknisiNamaList: ['Bagus Wibowo'],
    personilOpsTtd: PENANDA_QR, teknisiTtd: PENANDA_QR
  }, BAGUS.username, BAGUS.nama));
  const ops = bacaUrlTtdQr(m.PersonilOpsTTD, DATA), tek = bacaUrlTtdQr(m.TeknisiTTD, DATA);
  assert.deepEqual({ nama: ops.nama, nik: ops.nik }, { nama: 'Rina Operasi', nik: '' });
  assert.deepEqual({ nama: tek.nama, nik: tek.nik }, { nama: 'Bagus Wibowo', nik: '10012550' });
});

test('lembar AMHS: petak dinas yang sudah terisi tidak ditandatangani ulang orang berikutnya', () => {
  const dc = pemanggil.run(BAGUS, () => db.insertDailyCheck({
    unit: 'radtel', tanggal: '12 Oktober 2026', tanggalIso: '2026-10-12', dinas: 'Pagi',
    teknisiNama: 'Bagus Wibowo', teknisiNamaList: ['Bagus Wibowo'], teknisiTtd: PENANDA_QR,
    state: { dinas: { pagi: ['Bagus Wibowo'] }, dinasTtd: { pagi: PENANDA_QR, siang: null, malam: null } }
  }, BAGUS.username, BAGUS.nama));
  const pagi = db.getDailyCheckDetailById(dc.ID).state.dinasTtd.pagi;
  assert.equal(bacaUrlTtdQr(pagi, DATA).nama, 'Bagus Wibowo');

  // Dinas siang (akun lain) mengirim balik seluruh state, petak pagi ikut.
  pemanggil.run(ARYA, () => db.updateDailyCheck(dc.ID, {
    state: { dinas: { pagi: ['Bagus Wibowo'], siang: ['Arya Gunanawan'] }, dinasTtd: { pagi: PENANDA_QR, siang: PENANDA_QR, malam: null } }
  }, { username: ARYA.username, admin: true, role: 'admin' }));
  const lanjut = db.getDailyCheckDetailById(dc.ID);
  assert.equal(lanjut.state.dinasTtd.pagi, pagi);
  assert.equal(bacaUrlTtdQr(lanjut.state.dinasTtd.siang, DATA).nama, 'Arya Gunanawan');
});
