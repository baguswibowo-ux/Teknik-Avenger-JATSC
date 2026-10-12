/**
 * UJI KABAR PERUBAHAN — jalankan dengan:
 *
 *   node --test tools/uji-kabar-perubahan.mjs
 *
 * Yang dijaga:
 *   1. selisihJadwal: hanya isi petak yang dihitung (peran/NIK tidak), orang
 *      masuk dan keluar daftar tercatat, simpan tanpa perubahan = kosong.
 *   2. penerimaDafdin: semua orang di lembar + anggota unit, penyimpannya
 *      sendiri tidak, tiap orang membawa selisih MILIKNYA.
 *   3. selisihSejarah: status TTD bukan perubahan isi.
 *   4. Kalimatnya lolos pesanUntukPush dengan judul yang benar.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { selisihJadwal, penerimaDafdin, selisihSejarah, namaBulan } from '../kabar-perubahan.js';
import { pesanDafdinBerubah, pesanSejarahBerubah } from '../pesan-notif.js';
import { pesanUntukPush } from '../webpush.js';

const orang = (nama, nik, hari, peran = 'Teknisi') => ({ nama, peran, nik, hari });

const LAMA = [
  orang('Andi Saputra', '1001', ['PSJ', 'MJ', '', 'PSJ']),
  orang('Budi Santoso', '1002', ['MJ', '', 'PSJ', 'MJ']),
  orang('Cici Lestari', '1003', ['', 'PSJ', 'MJ', ''])
];
const AKUN = [
  { username: '1001', nama: 'Andi Saputra' }, { username: '1002', nama: 'Budi Santoso' },
  { username: '1003', nama: 'Cici Lestari' }, { username: '1004', nama: 'Dedi Kurnia' },
  { username: '2001', nama: 'Manajer Radtel' }
];

test('simpan tanpa perubahan, atau hanya peran/NIK, tidak menghasilkan selisih', () => {
  assert.deepEqual(selisihJadwal(LAMA, structuredClone(LAMA)), []);
  const baru = structuredClone(LAMA);
  baru[0].peran = 'Supervisor';
  baru[1].nik = '';
  assert.deepEqual(selisihJadwal(LAMA, baru), []);
});

test('judul grup bukan orang, dan nama yang dieja ulang tetap orang yang sama', () => {
  const lama = [orang('MANTEK 1', '', ['', '', '', '']), ...structuredClone(LAMA)];
  const baru = [{ ...orang('GROUP 1', '', ['', '', '', '']), tanpaNo: true }, ...structuredClone(LAMA)];
  assert.deepEqual(selisihJadwal(lama, baru), []);          // judul diganti: tak ada yang dikabari
  baru[1].nama = 'Andi S.';                                 // NIK 1001 tetap
  assert.deepEqual(selisihJadwal(lama, baru), []);
  baru[1].hari[2] = 'MJ';
  assert.deepEqual(selisihJadwal(lama, baru),
    [{ nama: 'Andi S.', nik: '1001', jenis: 'ubah', hari: [{ tgl: 3, dari: '', ke: 'MJ' }] }]);
});

test('tukar dinas dua orang: dua baris ubah, petaknya tepat', () => {
  const baru = structuredClone(LAMA);
  baru[0].hari[1] = '';      // Andi tgl 2: MJ → kosong
  baru[1].hari[1] = 'MJ';    // Budi tgl 2: kosong → MJ
  const s = selisihJadwal(LAMA, baru);
  assert.deepEqual(s, [
    { nama: 'Andi Saputra', nik: '1001', jenis: 'ubah', hari: [{ tgl: 2, dari: 'MJ', ke: '' }] },
    { nama: 'Budi Santoso', nik: '1002', jenis: 'ubah', hari: [{ tgl: 2, dari: '', ke: 'MJ' }] }
  ]);
});

test('orang masuk dan keluar daftar; nama dicocokkan tanpa peduli huruf dan spasi', () => {
  const baru = [
    orang('andi  saputra', '1001', ['PSJ', 'MJ', '', 'PSJ']),
    orang('Budi Santoso', '1002', ['MJ', '', 'PSJ', 'MJ']),
    orang('Dedi Kurnia', '1004', ['', 'CUTI', '', ''])
  ];
  const s = selisihJadwal(LAMA, baru);
  assert.deepEqual(s.map((x) => [x.nama, x.jenis]), [['Dedi Kurnia', 'tambah'], ['Cici Lestari', 'hapus']]);
  assert.deepEqual(s[0].hari, [{ tgl: 2, dari: '', ke: 'CUTI' }]);
  assert.deepEqual(s[1].hari.map((h) => h.tgl), [2, 3]);
});

test('jadwal pertama kali diisi: semua orang "tambah"', () => {
  const s = selisihJadwal([], LAMA);
  assert.equal(s.length, 3);
  assert.ok(s.every((x) => x.jenis === 'tambah'));
});

test('penerima: seisi lembar + anggota unit, tanpa penyimpannya, selisih milik sendiri', () => {
  const baru = structuredClone(LAMA).slice(0, 2);   // Cici dikeluarkan
  baru[0].hari[0] = 'MJ';                           // Andi berubah
  const selisih = selisihJadwal(LAMA, baru);
  const p = penerimaDafdin({
    lama: LAMA, baru, selisih, akun: AKUN,
    anggota: [{ username: '1002', nama: 'Budi Santoso' }, { username: '2001', nama: 'Manajer Radtel' }],
    kecuali: '1002'                                  // Budi yang menyimpan
  });
  const peta = new Map(p.map((x) => [x.username, x.milik]));
  assert.deepEqual([...peta.keys()].sort(), ['1001', '1003', '2001']);
  assert.equal(peta.get('1001').jenis, 'ubah');
  assert.equal(peta.get('1003').jenis, 'hapus');
  assert.equal(peta.get('2001'), null);
});

test('penerima: baris tanpa NIK dicari lewat nama; yang tak ketemu akun dilewati', () => {
  const baru = [orang('Dedi Kurnia', '', ['PSJ']), orang('Orang Tanpa Akun', '', ['MJ'])];
  const p = penerimaDafdin({ lama: [], baru, selisih: selisihJadwal([], baru), akun: AKUN, anggota: [], kecuali: '' });
  assert.deepEqual(p.map((x) => x.username), ['1004']);
});

test('selisihSejarah: tambah, ubah, hapus; ganti status TTD bukan perubahan', () => {
  const k = (id, judul, lain = {}) => ({ id, tgl: '2026-10-01', warna: '', judul, rinci: '', ket: '', ...lain });
  const sebelum = [k('h1', 'Ganti PSU'), k('h2', 'Kalibrasi'), k('h3', 'Bersih filter')];
  const sesudah = [
    k('h4', 'Modul TX mati', { warna: 'merah' }),
    k('h1', 'Ganti PSU', { pjStatus: 'disetujui', pjPada: '2026-10-12T01:00:00.000Z' }),
    k('h2', 'Kalibrasi ulang')
  ];
  const s = selisihSejarah(sebelum, sesudah);
  assert.deepEqual(s.tambah.map((x) => x.id), ['h4']);
  assert.deepEqual(s.ubah.map((x) => x.id), ['h2']);
  assert.deepEqual(s.hapus.map((x) => x.id), ['h3']);
  const kosong = selisihSejarah(sebelum, structuredClone(sebelum));
  assert.equal(kosong.tambah.length + kosong.ubah.length + kosong.hapus.length, 0);
});

test('kalimat dafdin: milik sendiri, tidak berubah, dan dikeluarkan', () => {
  const dasar = { unit: 'Radtel', bulan: namaBulan('2026-10'), oleh: 'Budi <PIC>' };
  const ubah = pesanUntukPush(pesanDafdinBerubah({
    ...dasar, milik: { jenis: 'ubah', hari: [{ tgl: 14, dari: 'PSJ', ke: 'MJ' }, { tgl: 15, dari: 'MJ', ke: '' }] }
  }));
  assert.equal(ubah.judul, '📅 Daftar dinas diperbarui');
  assert.match(ubah.isi, /Unit Radtel · Oktober 2026/);
  assert.match(ubah.isi, /Diubah oleh: Budi <PIC>/);
  assert.match(ubah.isi, /Tgl 14: PSJ → MJ\nTgl 15: MJ → kosong/);

  const tetap = pesanUntukPush(pesanDafdinBerubah({ ...dasar, milik: null, lain: ['A', 'B', 'C', 'D', 'E', 'F'] }));
  assert.match(tetap.isi, /Berubah: A, B, C, D \+2 lagi\nJadwal Anda sendiri tidak berubah\./);

  // Tanggal yang berubah dan siapa saja orangnya ikut tertulis.
  const aku = { nama: 'Andi', jenis: 'ubah', hari: [{ tgl: 14, dari: 'PSJ', ke: 'MJ' }, { tgl: 15, dari: 'MJ', ke: 'PSJ' }] };
  const semua = [
    aku,
    { nama: 'Budi', jenis: 'ubah', hari: [{ tgl: 14, dari: 'MJ', ke: 'PSJ' }, { tgl: 20, dari: '', ke: 'MJ' }] },
    { nama: 'Cici', jenis: 'tambah', hari: [{ tgl: 1, dari: '', ke: 'PSJ' }] },
    { nama: 'Dedi', jenis: 'hapus', hari: [] }
  ];
  const rinci = pesanUntukPush(pesanDafdinBerubah({ ...dasar, milik: null, semua }));
  assert.match(rinci.isi, /Tanggal diubah: 14–20\n/);
  assert.match(rinci.isi, /Berubah: Andi \(tgl 14–15\), Budi \(tgl 14, 20\), Cici \(baru masuk\), Dedi \(dikeluarkan\)/);
  const rinciAku = pesanUntukPush(pesanDafdinBerubah({ ...dasar, milik: aku, semua }));
  assert.match(rinciAku.isi, /Tgl 15: MJ → PSJ\nJuga berubah: Budi \(tgl 14, 20\), Cici/);
  assert.doesNotMatch(rinciAku.isi, /Juga berubah: Andi/);

  const keluar = pesanUntukPush(pesanDafdinBerubah({ ...dasar, milik: { jenis: 'hapus', hari: [] } }));
  assert.match(keluar.isi, /tidak lagi ada di daftar/);

  const banyak = pesanUntukPush(pesanDafdinBerubah({
    ...dasar, milik: { jenis: 'tambah', hari: Array.from({ length: 31 }, (_, i) => ({ tgl: i + 1, dari: '', ke: i % 3 ? 'PSJ' : '' })) }
  }));
  assert.match(banyak.isi, /Anda masuk daftar dinas:\nTgl 2: PSJ/);
  assert.match(banyak.isi, /\+12 tanggal lagi/);
  assert.ok(banyak.isi.length < 700);
});

test('kalimat sejarah', () => {
  const p = pesanUntukPush(pesanSejarahBerubah({
    unit: 'Radtel', alat: 'VHF TX — Modul 1', oleh: 'Andi',
    selisih: { tambah: [{ tgl: '2026-10-12', judul: 'Modul mati' }], ubah: [{ tgl: '', judul: 'Kalibrasi' }], hapus: [] }
  }));
  assert.equal(p.judul, '🛠️ Riwayat peralatan diperbarui');
  assert.equal(p.isi, 'VHF TX — Modul 1 · Unit Radtel\nBaru: 2026-10-12 — Modul mati\nDiubah: Kalibrasi\nOleh: Andi');
});
