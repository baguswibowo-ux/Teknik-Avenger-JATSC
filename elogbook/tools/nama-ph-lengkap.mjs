/**
 * LENGKAPI NAMA PH YANG DIKETIK: SEBUTKAN MANAGER TEKNIK YANG DIGANTIKAN.
 *
 *   node elogbook/tools/nama-ph-lengkap.mjs                 lihat rencananya saja
 *   node elogbook/tools/nama-ph-lengkap.mjs --terapkan      benar-benar menulis
 *   node elogbook/tools/nama-ph-lengkap.mjs --kembalikan <berkas cadangan>
 *
 * Lembar lama sering bertuliskan "PH Hendra Septa Nugroho" saja di bawah tanda
 * tangan pihak kedua — tidak terbaca Manager Teknik mana yang ia gantikan.
 * Alat ini menulis ulang nama itu menjadi bentuk yang sama dengan PH lewat
 * penunjukan akun (namaCetakPh di ttd-hak.js):
 *
 *     Hendra Septa Nugroho (PH Manager Teknik Trianto Aditya Putra)
 *
 * Siapa yang digantikan: akun yang dituju lembar itu (ttd_untuk); kalau tidak
 * tercatat, akun yang membubuhkan tanda tangannya (ttd_oleh) — semasa PH belum
 * punya jalur sendiri, TTD-nya memang dibubuhkan lewat akun Manager Teknik yang
 * sedang ia gantikan.
 *
 * Nama PH-nya: yang tertulis di QR tanda tangannya (sudah dicocokkan ke akun
 * oleh ttd-jadi-qr.mjs, mis. "M. Kaukab" -> "Muhammad Kaukab"); kalau TTD-nya
 * bukan QR ber-PH, nama yang diketik apa adanya.
 *
 * Yang TIDAK disentuh:
 *   - lembar yang BELUM ditandatangani — namanya dilengkapi sendiri saat
 *     ditandatangani (tandaTanganiCatatan di db.js);
 *   - lembar yang pejabatnya tidak bisa diketahui (tanpa tujuan dan tanpa
 *     pembubuh tercatat);
 *   - tanda tangannya sendiri, ttd_oleh, dan ttd_untuk.
 *
 * Database yang dipakai: milik pohon berkas tempat alat ini berada (atau
 * ELOGBOOK_DATA_DIR) — dijalankan dari folder uji ia mengubah data uji.
 */

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { DATA_DIR, JENIS_TTD } from '../db.js';
import { bacaUrlTtdQr } from '../ttd-qr.js';
import { phDiketik, namaPhDiketikLengkap } from '../ttd-hak.js';

const arg = process.argv.slice(2);
const terapkan = arg.includes('--terapkan');
const iKembali = arg.indexOf('--kembalikan');
const berkasKembali = iKembali >= 0 ? arg[iKembali + 1] : '';
const berkasDb = path.join(DATA_DIR, 'elogbook.db');
console.log('Database : ' + berkasDb);

const db = new DatabaseSync(berkasDb);

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
  console.log(`Dikembalikan: ${lama.baris.length} nama.`);
  process.exit(0);
}

const akun = new Map(db.prepare('SELECT username, nama FROM users').all()
  .map((a) => [String(a.username).toLowerCase(), String(a.nama || a.username).trim()]));
const namaAkun = (username) => akun.get(String(username || '').toLowerCase()) || '';

const cadangan = { dibuat: new Date().toISOString(), db: berkasDb, baris: [] };
const rencana = [];            // [tabel, kolom, nama baru, id]
const lapor = new Map();       // "lama -> baru" -> jumlah
const dilewati = new Map();    // "nama | sebab" -> jumlah
const hitung = (peta, k) => peta.set(k, (peta.get(k) || 0) + 1);

for (const t of Object.values(JENIS_TTD)) {
  const baris = db.prepare(`SELECT id, ${t.nama} AS nama, ${t.ttd} AS ttd, ttd_untuk, ttd_oleh FROM ${t.tabel}`).all();
  for (const r of baris) {
    const ph = phDiketik(r.nama);
    if (!ph) continue;
    if (!r.ttd) { hitung(dilewati, `${r.nama} | belum ditandatangani`); continue; }
    const pejabat = namaAkun(r.ttd_untuk) || namaAkun(r.ttd_oleh);
    if (!pejabat) { hitung(dilewati, `${r.nama} | pejabatnya tidak tercatat`); continue; }
    const qr = bacaUrlTtdQr(r.ttd, DATA_DIR);
    const namaPh = qr && /^PH\b/i.test(qr.jabatan) && qr.nama ? qr.nama : ph.nama;
    const baru = namaPhDiketikLengkap(`${ph.sebutan} ${namaPh}`, pejabat, t.label);
    if (!baru || baru === r.nama) continue;
    cadangan.baris.push({ tabel: t.tabel, id: r.id, kolom: t.nama, nilai: r.nama });
    rencana.push([t.tabel, t.nama, baru, r.id]);
    hitung(lapor, `${r.nama}  ->  ${baru}`);
  }
}

console.log('\nNama yang dilengkapi:');
for (const [k, n] of [...lapor].sort()) console.log('  ' + String(n).padStart(4) + 'x  ' + k);
if (dilewati.size) {
  console.log('\nDibiarkan:');
  for (const [k, n] of [...dilewati].sort()) console.log('  ' + String(n).padStart(4) + 'x  ' + k);
}
console.log(`\nLembar yang berubah: ${rencana.length}.`);

if (!terapkan) {
  console.log('Belum ada yang ditulis. Tambahkan --terapkan untuk menjalankannya.');
  process.exit(0);
}
if (!rencana.length) process.exit(0);

const cap = cadangan.dibuat.replace(/[-:]/g, '').slice(0, 15);
const berkasCadangan = path.join(DATA_DIR, `cadangan-nama-ph-${cap}.json`);
fs.writeFileSync(berkasCadangan, JSON.stringify(cadangan));
dalamTransaksi(() => {
  for (const [tabel, kolom, nilai, id] of rencana) {
    db.prepare(`UPDATE ${tabel} SET ${kolom} = ? WHERE id = ?`).run(nilai, id);
  }
});
console.log('Tertulis. Nama lamanya: ' + berkasCadangan);
console.log('Membatalkan: node elogbook/tools/nama-ph-lengkap.mjs --kembalikan "' + berkasCadangan + '"');
