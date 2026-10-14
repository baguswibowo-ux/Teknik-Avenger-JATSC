/**
 * UBAH TANDA TANGAN LAMA (GORESAN) MENJADI QR.
 *
 *   node elogbook/tools/ttd-jadi-qr.mjs                 lihat rencananya saja
 *   node elogbook/tools/ttd-jadi-qr.mjs --terapkan      benar-benar menulis
 *   node elogbook/tools/ttd-jadi-qr.mjs --kembalikan <berkas cadangan>
 *
 * Sejak 12 Oktober 2026 tanda tangan baru disimpan sebagai QR berisi unit,
 * nama, dan NIK (lihat ttd-qr.js). Alat ini menyamakan catatan lama: tiap
 * kolom tanda tangan yang masih menunjuk gambar goresan diganti alamat QR.
 *
 * GORESANNYA TIDAK DIHAPUS. Berkas PNG di uploads/ dibiarkan, dan nilai lama
 * tiap kolom disimpan ke berkas cadangan di samping database — --kembalikan
 * memasangnya lagi persis seperti semula.
 *
 * Siapa yang tertulis di QR sebuah tanda tangan lama:
 *   - Manager Teknik / pihak kedua : akun yang tercatat membubuhkannya
 *     (ttd_oleh); kalau tidak tercatat, nama di formulir dicocokkan ke akun.
 *   - Teknisi : pembuat catatannya kalau namanya memang tercantum sebagai
 *     pelaksana; kalau tidak, pelaksana pertama yang punya akun.
 *   - PH (lembar bertuliskan "PH. Nama", dibubuhkan lewat akun Manager Teknik
 *     semasa PH belum punya jalur sendiri) : QR atas nama si PH, berjabatan
 *     "PH Manager Teknik <nama pejabat yang digantikan>", dengan NIK kalau namanya cocok sebuah akun (lihat
 *     PETA_PH). Tanda tangannya SUDAH ADA sejak dulu — yang berubah hanya
 *     bentuknya; ttd_oleh (akun yang membubuhkan) tidak disentuh.
 *   - Yang tidak cocok akun mana pun (Personil Operasi, Manager Pemakai, nama
 *     panggilan lama) : QR berisi unit dan nama saja, tanpa NIK.
 *
 * Petak yang KOSONG tidak diisi: lembar yang belum ditandatangani tetap harus
 * ditandatangani orangnya sendiri.
 *
 * Database yang dipakai: milik pohon berkas tempat alat ini berada (atau
 * ELOGBOOK_DATA_DIR) — dijalankan dari folder uji ia mengubah data uji.
 */

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { DATA_DIR, UNIT } from '../db.js';
import { AWALAN_QR, urlTtdQr, nikDariUsername, jabatanAkun } from '../ttd-qr.js';

const arg = process.argv.slice(2);
const terapkan = arg.includes('--terapkan');
const iKembali = arg.indexOf('--kembalikan');
const berkasKembali = iKembali >= 0 ? arg[iKembali + 1] : '';
const berkasDb = path.join(DATA_DIR, 'elogbook.db');
console.log('Database : ' + berkasDb);

const db = new DatabaseSync(berkasDb);
const kunci = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
const uraiJson = (s, cadangan) => { try { return JSON.parse(s); } catch { return cadangan; } };

function dalamTransaksi(kerja) {
  db.exec('BEGIN IMMEDIATE');
  try { kerja(); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
}

if (berkasKembali) {
  const lama = JSON.parse(fs.readFileSync(berkasKembali, 'utf8'));
  dalamTransaksi(() => {
    for (const b of lama.baris) {
      db.prepare(`UPDATE ${b.tabel} SET ${b.kolom} = ? WHERE id = ?`).run(b.nilai, b.id);
    }
  });
  console.log(`Dikembalikan: ${lama.baris.length} kolom.`);
  process.exit(0);
}

/* --- Akun --- */
const akun = db.prepare('SELECT username, nama, aktif, nik, jabatan, role FROM users').all();
const akunPerUsername = new Map(akun.map((a) => [String(a.username).toLowerCase(), a]));
const akunPerNama = new Map();   // nama -> akun, atau 'ganda'
for (const a of akun) {
  if (!a.aktif) continue;
  const k = kunci(a.nama);
  akunPerNama.set(k, akunPerNama.has(k) ? 'ganda' : a);
}
const akunDariNama = (nama) => {
  const a = akunPerNama.get(kunci(nama));
  return a && a !== 'ganda' ? a : null;
};
const namaUnit = (kode) => (UNIT.find((u) => u.kode === kode) || {}).nama || String(kode || '');
const dariAkun = (a) => ({
  nama: String(a.nama || a.username).trim(),
  nik: String(a.nik || '').trim() || nikDariUsername(a.username),
  jabatan: jabatanAkun(a.jabatan, a.role)
});

/**
 * nama akun -> ejaan lain nama itu di lembar lama ber-PH. Dicocokkan tanpa
 * membedakan huruf besar-kecil. Usulan dari pencocokan kata demi kata dengan
 * daftar akun (13 Okt 2026) — DIPASTIKAN BAGUS sebelum dijalankan di produksi.
 * Nama PH yang tidak punya akun (Adhayanti, Rika, M Rizka Al Farisi) tidak ada
 * di sini: QR-nya berisi nama saja, tanpa NIK.
 */
const PETA_PH = {
  'Endar Novitasari S.': ['Endar Novitasari', 'Endar Novitasari S'],
  'Muhammad Kaukab': ['M. Kaukab', 'M Kaukab'],
  'Yogi Apriantoro': ['Yogi'],
  'M Firmansyah D': ['M Firmansyah Djambek', 'M. Firmansyah Djambek'],
  'Ika Dewi Lestari': ['Ika Dwi Lestari'],
  'Tony Edi Purnomo': ['Tony Edi P']
};
const ejaanPh = new Map();
for (const [namaAkun, lain] of Object.entries(PETA_PH)) for (const x of lain) ejaanPh.set(kunci(x), namaAkun);

const RE_PH = /^\s*(?:ph|plh|pelaksana harian)\b[\s.:\-]*/i;
const JABATAN_PH = 'PH Manager Teknik';
const laporPh = new Map();   // nama di lembar -> { n, jadi }

/** Identitas PH dari nama tercetak "PH. Nama" — null kalau bukan lembar PH. */
function pihakPh(nama, ttdOleh, ttdUntuk) {
  const n = String(nama || '').trim();
  // Sesudah nama-ph-lengkap.mjs, PH yang dulu diketik berbentuk "Nama (PH
  // Manager Teknik Nama Pejabat)" dan tetap tercatat dibubuhkan akun pejabatnya
  // (PH lewat penunjukan akun dibubuhkan akun PH sendiri — bukan urusan ini).
  const lengkap = /^(.+?)\s*\((?:PH|Plh)\b[^)]*\)\s*$/i.exec(n);
  const olehPejabat = kunci(ttdOleh) === kunci(ttdUntuk || ttdOleh);
  if (!RE_PH.test(n) && !(lengkap && olehPejabat)) return null;
  const bersih = (RE_PH.test(n) ? n.replace(RE_PH, '').replace(/\s*\(.*$/, '') : lengkap[1]).trim();
  if (!bersih) return null;
  const a = akunDariNama(bersih) || akunDariNama(ejaanPh.get(kunci(bersih)) || '');
  // Jabatannya menyebut pejabat yang digantikan: akun yang dituju lembar itu,
  // kalau tidak tercatat akun yang membubuhkannya.
  const pejabat = akunPerUsername.get(String(ttdUntuk || '').toLowerCase())
    || akunPerUsername.get(String(ttdOleh || '').toLowerCase());
  const jabatan = (JABATAN_PH + ' ' + (pejabat ? String(pejabat.nama || '').trim() : '')).trim();
  const orang = a ? { ...dariAkun(a), jabatan } : { nama: bersih, nik: '', jabatan };
  const l = laporPh.get(kunci(bersih)) || { tertulis: bersih, n: 0, jadi: orang.nama + (orang.nik ? ' + NIK' : ' (nama saja, tanpa akun)') };
  l.n++; laporPh.set(kunci(bersih), l);
  return orang;
}

/**
 * Identitas pihak kedua: akun pembubuhnya, kalau nama di formulir memang nama
 * akun itu. Lembar lama sering bertuliskan "PH. Endar Novitasari" tetapi
 * dibubuhkan dari akun Manager Teknik — goresannya milik si PH, jadi QR-nya
 * mengikuti nama yang tercetak, bukan pemilik akunnya.
 */
function pihakKedua(nama, ttdOleh, ttdUntuk) {
  const ph = pihakPh(nama, ttdOleh, ttdUntuk);
  if (ph) return ph;
  const a = akunPerUsername.get(String(ttdOleh || '').toLowerCase());
  if (a && (!kunci(nama) || kunci(nama).startsWith(kunci(a.nama)))) return dariAkun(a);
  const n = String(nama || '').trim();
  if (!n) return null;
  const b = akunDariNama(n);
  return b ? dariAkun(b) : { nama: n, nik: '' };
}

/** Identitas teknisi dari daftar pelaksana dan pembuat catatannya. */
function teknisi(namaList, dibuatOleh) {
  const nama = namaList.map((x) => String(x || '').trim()).filter(Boolean);
  const pembuat = akunPerUsername.get(String(dibuatOleh || '').toLowerCase());
  if (pembuat && (!nama.length || nama.some((n) => kunci(n) === kunci(pembuat.nama)))) return dariAkun(pembuat);
  for (const n of nama) {
    const a = akunDariNama(n);
    if (a) return dariAkun(a);
  }
  if (nama.length) return { nama: nama[0], nik: '' };
  return pembuat ? dariAkun(pembuat) : null;
}

const daftarNama = (list, tunggal) => {
  const d = uraiJson(list || '[]', []);
  return Array.isArray(d) && d.length ? d : String(tunggal || '').split(',');
};

/* tabel -> petak tanda tangannya. `siapa(r)` mengembalikan { nama, nik } atau null. */
const PETAK = {
  entries: {
    teknisi_ttd: (r) => teknisi(daftarNama(r.teknisi_nama_list, r.teknisi_nama), r.dibuat_oleh),
    pj_ttd: (r) => pihakKedua(r.pj_nama, r.ttd_oleh, r.ttd_untuk)
  },
  dailychecks: {
    teknisi_ttd: (r) => teknisi(daftarNama(r.teknisi_nama_list, r.teknisi_nama), r.dibuat_oleh),
    manager_ttd: (r) => pihakKedua(r.manager_nama, r.ttd_oleh, r.ttd_untuk)
  },
  monitoring: {
    teknisi_ttd: (r) => teknisi(daftarNama(r.teknisi_nama_list, r.personil_teknik), r.dibuat_oleh),
    personil_ops_ttd: (r) => pihakKedua(r.personil_ops, r.ttd_oleh, r.ttd_untuk)
  },
  dstest: {
    teknisi_ttd: (r) => teknisi(daftarNama(r.teknisi_nama_list, r.teknisi_nama), r.dibuat_oleh),
    manager_ttd: (r) => pihakKedua(r.manager_nama, r.ttd_oleh, r.ttd_untuk)
  },
  berkala: {
    teknisi_ttd: (r) => teknisi(daftarNama(r.teknisi_nama_list, r.teknisi_nama), r.dibuat_oleh),
    manager_ttd: (r) => pihakKedua(r.manager_nama, r.ttd_oleh, r.ttd_untuk)
  },
  ltk: {
    teknisi_ttd: (r) => teknisi(daftarNama('[]', r.teknisi_nama), r.dibuat_oleh),
    manager_ttd: (r) => pihakKedua(r.manager_nama, r.ttd_oleh, r.ttd_untuk)
  },
  bapb: {
    petugas_ttd: (r) => teknisi(daftarNama(r.petugas_nama_list, r.petugas_nama), r.dibuat_oleh),
    teknik_ttd: (r) => pihakKedua(r.teknik_nama, r.ttd_oleh, r.ttd_untuk),
    pemakai_ttd: (r) => pihakKedua(r.pemakai_nama, '')
  }
};

const cadangan = { dibuat: new Date().toISOString(), db: berkasDb, baris: [] };
const rencana = [];            // [tabel, kolom, nilai baru, id]
const hitung = {};             // "tabel.kolom" -> { qr, tanpaNik, dilewati }
const contohDilewati = [];
const catat = (di, apa) => { (hitung[di] ||= { qr: 0, tanpaNik: 0, dilewati: 0 })[apa]++; };

const perluDiubah = (v) => !!v && !String(v).startsWith(AWALAN_QR);

for (const [tabel, petak] of Object.entries(PETAK)) {
  for (const r of db.prepare(`SELECT * FROM ${tabel}`).all()) {
    for (const [kolom, siapa] of Object.entries(petak)) {
      if (!perluDiubah(r[kolom])) continue;
      const di = `${tabel}.${kolom}`;
      const orang = siapa(r);
      if (!orang || !orang.nama) {
        catat(di, 'dilewati');
        if (contohDilewati.length < 10) contohDilewati.push(`${di} id ${r.id} (tidak ada nama untuk ditulis)`);
        continue;
      }
      catat(di, orang.nik ? 'qr' : 'tanpaNik');
      cadangan.baris.push({ tabel, id: r.id, kolom, nilai: r[kolom] });
      rencana.push([tabel, kolom, urlTtdQr({ unit: namaUnit(r.unit), ...orang }, DATA_DIR), r.id]);
    }

    /* TTD per dinas di lembar AMHS tinggal di dalam state. */
    if (tabel !== 'dailychecks') continue;
    const state = uraiJson(r.state_json || '{}', null);
    const t = state && state.dinasTtd;
    if (!t || typeof t !== 'object') continue;
    let berubah = false;
    for (const k of Object.keys(t)) {
      if (!perluDiubah(t[k])) continue;
      const di = 'dailychecks.state.dinasTtd';
      const orang = teknisi(Array.isArray(state.dinas?.[k]) ? state.dinas[k] : [], '');
      if (!orang || !orang.nama) { catat(di, 'dilewati'); continue; }
      catat(di, orang.nik ? 'qr' : 'tanpaNik');
      t[k] = urlTtdQr({ unit: namaUnit(r.unit), ...orang }, DATA_DIR);
      berubah = true;
    }
    if (berubah) {
      cadangan.baris.push({ tabel, id: r.id, kolom: 'state_json', nilai: r.state_json });
      rencana.push([tabel, 'state_json', JSON.stringify(state), r.id]);
    }
  }
}

console.log('\nPetak tanda tangan'.padEnd(38) + 'QR + NIK   nama saja   dilewati');
for (const [di, h] of Object.entries(hitung)) {
  console.log(di.padEnd(37) + String(h.qr).padStart(9) + String(h.tanpaNik).padStart(12) + String(h.dilewati).padStart(11));
}
for (const c of contohDilewati) console.log('  dilewati: ' + c);
if (laporPh.size) {
  console.log('\nLembar ber-PH -> yang tertulis di QR (jabatan "' + JABATAN_PH + '"):');
  for (const l of [...laporPh.values()].sort((x, y) => y.n - x.n)) {
    console.log('  ' + String(l.n).padStart(4) + 'x  PH ' + l.tertulis.padEnd(28) + '-> ' + l.jadi);
  }
}
console.log(`\nKolom yang berubah: ${rencana.length}.`);

if (!terapkan) {
  console.log('Belum ada yang ditulis. Tambahkan --terapkan untuk menjalankannya.');
  process.exit(0);
}
if (!rencana.length) process.exit(0);

const cap = cadangan.dibuat.replace(/[-:]/g, '').slice(0, 15);
const berkasCadangan = path.join(DATA_DIR, `cadangan-ttd-lama-${cap}.json`);
fs.writeFileSync(berkasCadangan, JSON.stringify(cadangan));
dalamTransaksi(() => {
  for (const [tabel, kolom, nilai, id] of rencana) {
    db.prepare(`UPDATE ${tabel} SET ${kolom} = ? WHERE id = ?`).run(nilai, id);
  }
});
console.log('Tertulis. Nilai lamanya: ' + berkasCadangan);
console.log('Membatalkan: node elogbook/tools/ttd-jadi-qr.mjs --kembalikan "' + berkasCadangan + '"');
