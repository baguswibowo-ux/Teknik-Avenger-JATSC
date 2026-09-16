/**
 * PH berperiode: siapa yang boleh ditunjuk, dan lembar mana yang dititipkan.
 *
 * Yang diuji di sini hak TANDA TANGAN — sesuatu yang masuk ke arsip resmi.
 * Karena itu diuji sampai ke database sungguhan (SQLite), bukan cuma
 * aturannya: saringan periode dipasang di tandaTanganiCatatan, dan yang perlu
 * dibuktikan justru bahwa jalan menuju tanda tangan itu sendiri yang menolak,
 * bukan sekadar kotak masuknya yang tidak menampilkan.
 *
 * Databasenya SEMENTARA, dibuat di folder sistem sementara dan dihapus di
 * akhir. Folder data produksi tidak pernah disentuh: lokasinya disetel
 * eksplisit sebelum db.js dimuat.
 *
 * Skenario yang dijaga, persis permintaannya:
 *   Manager Teknik cuti 16-18 Sep, menunjuk PH.
 *   - lembar bertanggal 17 Sep       -> PH boleh, tercetak "(PH Manager Teknik ...)"
 *   - lembar bertanggal 14 Sep       -> PH ditolak, tetap menunggu managernya
 *   - lembar Daily Check teks panjang -> dibaca tanggalnya dengan benar
 *   - sebelum 16 / sesudah 18 Sep    -> PH tidak mewakili siapa pun
 *   - administrator yang ditunjuk PH -> tercatat SEBAGAI PH
 *   - pejabat non-operasional        -> tidak bisa ditunjuk
 *
 * Jalankan dari akar aplikasi: node tools/uji-ph-periode.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const sementara = fs.mkdtempSync(path.join(os.tmpdir(), 'uji-ph-'));
process.env.ELOGBOOK_DATA_DIR = path.join(sementara, 'data');
process.env.ELOGBOOK_UPLOAD_DIR = path.join(sementara, 'uploads');

let lulus = 0, gagal = 0;
const cek = (nama, benar, keterangan = '') => {
  if (benar) lulus++;
  else { gagal++; console.log('  GAGAL: ' + nama + (keterangan ? '\n         ' + keterangan : '')); }
};
const ditolak = (nama, fn) => {
  try { fn(); cek(nama, false, 'seharusnya ditolak, ternyata lolos'); }
  catch { cek(nama, true); }
};

try {
  const ttdHak = await import('../elogbook/ttd-hak.js');
  const db = await import('../elogbook/db.js');

  /* ---------------- aturan murni ---------------- */
  const { tanggalDokumenIso: iso, dalamPeriodePh: dalam } = ttdHak;
  cek('tanggal ISO', iso('2026-09-17') === '2026-09-17');
  cek('tanggal ISO berjam', iso('2026-09-17T08:00:00Z') === '2026-09-17');
  cek('tanggal Daily Check (Indonesia)', iso('KAMIS / 17 SEP 2026') === '2026-09-17');
  cek('tanggal Daily Check (Inggris)', iso('THURSDAY / 6 AUG 2026') === '2026-08-06');
  cek('tanggal tak terbaca jadi kosong', iso('besok') === '');

  cek('di dalam periode', dalam('2026-09-17', '2026-09-16', '2026-09-18'));
  cek('tepat hari mulai', dalam('2026-09-16', '2026-09-16', '2026-09-18'));
  cek('tepat hari selesai', dalam('2026-09-18', '2026-09-16', '2026-09-18'));
  cek('sebelum periode ditolak', !dalam('2026-09-14', '2026-09-16', '2026-09-18'));
  cek('sesudah periode ditolak', !dalam('2026-09-19', '2026-09-16', '2026-09-18'));
  cek('tanggal tak terbaca TIDAK dianggap masuk', !dalam('besok', '2026-09-16', '2026-09-18'));
  cek('penunjukan lama tanpa mulai: tanpa batas bawah', dalam('2026-01-01', '', '2026-09-18'));

  /* ---------------- data sungguhan ---------------- */
  const buat = (username, nama, role) =>
    db.createUser({ username, password: 'uji-rahasia-123', nama, role, unit: ['radtel'] });
  buat('uus', 'Uus Susanto', 'pejabat');
  buat('uji.teknisi', 'Uji Teknisi', 'teknisi');
  buat('pembuat', 'Pembuat Lembar', 'teknisi');
  buat('admin1', 'Admin Satu', 'admin');
  buat('au1', 'Admin Unit Satu', 'adminunit');
  buat('nonop1', 'Pejabat Nonop', 'pejabatnonop');

  const calon = db.listCalonPh().map((c) => c.username);
  cek('administrator bisa ditunjuk PH', calon.includes('admin1'));
  cek('admin unit bisa ditunjuk PH', calon.includes('au1'));
  cek('teknisi bisa ditunjuk PH', calon.includes('uji.teknisi'));
  cek('pejabat bisa ditunjuk PH', calon.includes('uus'));
  cek('pejabat non-operasional TIDAK bisa ditunjuk PH', !calon.includes('nonop1'));

  // Manager Teknik cuti 16-18 Sep, PH-nya Uji Teknisi.
  db.setPh('uus', 'uji.teknisi', '2026-09-18', '2026-09-16');
  const ph = db.getPh('uus');
  cek('periode tersimpan', ph.mulai === '2026-09-16' && ph.sampai === '2026-09-18');

  const pada = (hari) => db.listDiwakiliOleh('uji.teknisi', hari);
  cek('sebelum mulai: belum mewakili', pada('2026-09-15').length === 0);
  cek('hari pertama: mewakili', pada('2026-09-16').length === 1);
  cek('di tengah: mewakili', pada('2026-09-17').length === 1);
  cek('hari terakhir: mewakili', pada('2026-09-18').length === 1);
  cek('sesudah selesai: kembali ke manager', pada('2026-09-19').length === 0);
  const d17 = pada('2026-09-17')[0] || {};
  cek('periode ikut dikembalikan', d17.mulai === '2026-09-16' && d17.sampai === '2026-09-18');

  // Lembar yang ditujukan ke Uus, dibuat teknisi lain.
  const lembar = (tanggal) => db.insertEntry({
    tanggal, jam: '08:00', dinas: 'Pagi', uraian: 'uji ' + tanggal, unit: 'radtel',
    ttdUntuk: 'uus', teknisiNamaList: ['Pembuat Lembar']
  }, 'pembuat', 'Pembuat Lembar').ID;
  const id17 = lembar('2026-09-17');
  const id14 = lembar('2026-09-14');
  const id18 = lembar('2026-09-18');

  const TTD = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=';
  const tandatangani = (id, username, role, nama) => {
    const diwakili = db.listDiwakiliOleh(username, '2026-09-17');
    return db.tandaTanganiCatatan('logbook', id, {
      nama, username, role, ttd: TTD,
      wakilDari: diwakili.map((p) => p.username), diwakili
    });
  };

  const hasil17 = tandatangani(id17, 'uji.teknisi', 'teknisi', 'Uji Teknisi');
  cek('PH boleh TTD lembar di dalam periode', !!hasil17 && !!hasil17.ttd);
  cek('nama tercetak sebagai PH berkedudukan',
    hasil17 && hasil17.nama === 'Uji Teknisi (PH Manager Teknik Uus Susanto)',
    'dapat: ' + (hasil17 && hasil17.nama));

  ditolak('PH DITOLAK TTD lembar di luar periode (14 Sep)',
    () => tandatangani(id14, 'uji.teknisi', 'teknisi', 'Uji Teknisi'));

  // Lembar di luar periode tetap bisa ditandatangani managernya sendiri.
  const olehManager = tandatangani(id14, 'uus', 'pejabat', 'Uus Susanto');
  cek('manager tetap bisa TTD lembarnya sendiri', !!olehManager && olehManager.nama !== '' &&
    !String(olehManager.nama).includes('PH'));

  // Administrator yang ditunjuk PH tercatat SEBAGAI PH, bukan tanda tangan langsung.
  db.setPh('uus', 'admin1', '2026-09-18', '2026-09-16');
  const olehAdmin = tandatangani(id18, 'admin1', 'admin', 'Admin Satu');
  cek('administrator yang ditunjuk PH tercatat sebagai PH',
    olehAdmin && olehAdmin.nama === 'Admin Satu (PH Manager Teknik Uus Susanto)',
    'dapat: ' + (olehAdmin && olehAdmin.nama));

  // PH tidak boleh menandatangani lembar buatannya sendiri.
  db.setPh('uus', 'pembuat', '2026-09-18', '2026-09-16');
  const idSendiri = lembar('2026-09-17');
  ditolak('PH ditolak TTD lembar buatannya sendiri',
    () => tandatangani(idSendiri, 'pembuat', 'teknisi', 'Pembuat Lembar'));

  /* Daily Check menyimpan tanggalnya sebagai teks panjang — aturan periode
     harus membacanya, bukan menganggapnya tak terbaca lalu menolak semuanya. */
  const rowTeks = { tanggal: 'KAMIS / 17 SEP 2026' };
  cek('lembar Daily Check (teks panjang) terbaca masuk periode',
    ttdHak.diwakiliUntukTanggal([{ username: 'uus', mulai: '2026-09-16', sampai: '2026-09-18' }], rowTeks.tanggal).length === 1);
} catch (err) {
  gagal++;
  console.log('  GAGAL: uji berhenti karena galat —', err && err.stack || err);
} finally {
  try { fs.rmSync(sementara, { recursive: true, force: true }); } catch { /* biarkan */ }
}

console.log(`\n${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
