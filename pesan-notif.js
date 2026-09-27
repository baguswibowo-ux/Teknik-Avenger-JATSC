/**
 * PENYUSUN TEKS NOTIFIKASI — milik seluruh aplikasi
 *
 * Kalimat tiap kabar (perlu TTD, sudah TTD, belum TTD, pengingat dinas,
 * kegiatan berkala) disusun di sini sebagai HTML sederhana (<b>, <i>, baris
 * baru). webpush.js (pesanUntukPush) mengubahnya menjadi judul + isi
 * notifikasi HP. Modul murni: tidak menyentuh jaringan maupun database.
 *
 * Ditaruh di akar karena pemakainya dua: E-Logbook (kabar TTD) dan dashboard
 * (pengingat dinas dan berkala).
 */

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Notifikasi ke akun yang dituju: ada dokumen menunggu tanda tangannya. */
export function pesanPerluTtd({ dokumen, unit, tanggal, pembuat, atasNama, cuplikan }) {
  const baris = ['🔔 <b>Perlu tanda tangan Anda</b>', '', `Dokumen: <b>${esc(dokumen)}</b>`];
  if (cuplikan) baris.push(`Perihal: <i>${esc(cuplikan)}</i>`);
  if (unit) baris.push(`Unit: ${esc(unit)}`);
  if (tanggal) baris.push(`Tanggal: ${esc(tanggal)}`);
  if (pembuat) baris.push(`Dikirim oleh: ${esc(pembuat)}`);
  if (atasNama) baris.push(`Sebagai PH untuk: <b>${esc(atasNama)}</b>`);
  baris.push('', 'Buka E-Logbook → <b>Kotak Masuk TTD</b> untuk menandatangani.');
  return baris.join('\n');
}

/** Notifikasi balik ke pembuat/pelaksana: dokumennya sudah ditandatangani. */
export function pesanSudahTtd({ dokumen, unit, tanggal, penanda, cuplikan }) {
  const baris = ['✅ <b>Dokumen Anda sudah ditandatangani</b>', '', `Dokumen: <b>${esc(dokumen)}</b>`];
  if (cuplikan) baris.push(`Perihal: <i>${esc(cuplikan)}</i>`);
  if (unit) baris.push(`Unit: ${esc(unit)}`);
  if (tanggal) baris.push(`Tanggal: ${esc(tanggal)}`);
  if (penanda) baris.push(`Ditandatangani oleh: <b>${esc(penanda)}</b>`);
  return baris.join('\n');
}

/** Pengingat ke pembuat logbook: dinasnya sudah lewat, tanda tangan belum ada. */
export function pesanBelumTtd({ dokumen, unit, tanggal, dinas, menunggu, menit, cuplikan }) {
  const baris = ['⏰ <b>Dokumen Anda belum ditandatangani</b>', '', `Dokumen: <b>${esc(dokumen)}</b>`];
  if (cuplikan) baris.push(`Perihal: <i>${esc(cuplikan)}</i>`);
  if (unit) baris.push(`Unit: ${esc(unit)}`);
  if (tanggal) baris.push(`Tanggal: ${esc(tanggal)}${dinas ? ' · Dinas ' + esc(dinas) : ''}`);
  if (menunggu) baris.push(`Menunggu tanda tangan: <b>${esc(menunggu)}</b>`);
  baris.push('', `Dinasnya sudah berakhir lebih dari ${esc(menit)} menit. Silakan ingatkan penanda tangannya.`);
  return baris.join('\n');
}

/** Pengingat ke teknisi (dashboard): dinasnya mulai sebentar lagi. Jam dan
    tanggal sudah dalam WIB — pesan dibaca sambil melihat jam dinding, bukan
    lembar UTC. Penghitungnya di pengingat-dinas.js. */
export function pesanDinasMendatang({ nama, unit, namaShift, kode, tanggal, jam, menit }) {
  const baris = ['🕖 <b>Pengingat dinas</b>', ''];
  baris.push(`${nama ? esc(nama) + ', ' : ''}Anda dijadwalkan dinas <b>${esc(namaShift || kode)}</b>`
    + (unit ? ` di unit ${esc(unit)}` : '') + '.');
  if (tanggal) baris.push(`Tanggal: ${esc(tanggal)}`);
  if (jam) baris.push(`Mulai: <b>${esc(jam)}</b>`);
  baris.push('', `Dinas dimulai ${esc(menit)} menit lagi.`);
  return baris.join('\n');
}

const JENIS_BERKALA_NAMA = {
  harian: 'harian', mingguan: 'mingguan', bulanan: 'bulanan',
  triwulan: 'triwulan', semesteran: 'semesteran', tahunan: 'tahunan'
};

/** Pengingat ke teknisi (dashboard): sejam sesudah dinasnya mulai, kegiatan
    berkala unitnya yang belum dikerjakan. `daftar` keluaran
    kegiatanUntukDinas() di pengingat-berkala.js. */
export function pesanBerkalaDinas({ nama, unit, namaShift, kode, tanggal, jam, daftar }) {
  const baris = ['📋 <b>Kegiatan berkala dinas Anda</b>', ''];
  baris.push(`${nama ? esc(nama) + ', ' : ''}Anda sedang dinas <b>${esc(namaShift || kode)}</b>`
    + (unit ? ` di unit ${esc(unit)}` : '') + (jam ? ` (mulai ${esc(jam)})` : '') + '.');
  if (tanggal) baris.push(`Tanggal: ${esc(tanggal)}`);
  baris.push('', 'Yang belum dikerjakan:');
  (daftar || []).forEach(({ k, sisa, sebut }, i) => {
    const ket = [JENIS_BERKALA_NAMA[k.jenis] || k.jenis || ''];
    if (sisa < 0) ket.push(`<b>lewat ${-sisa} hari</b>`);
    if (k.shift === 'PS' || k.shift === 'M') ket.push(k.shift === 'M' ? 'rombongan Malam' : 'rombongan PS');
    baris.push(`${i + 1}. <b>${esc(k.nama || k.id)}</b> — ${ket.filter(Boolean).join(' · ')}`
      + (sebut ? `\n    isi ${esc(sebut)} di E-Logbook` : ''));
  });
  baris.push('', 'Mohon dikerjakan selama dinas ini.');
  return baris.join('\n');
}
