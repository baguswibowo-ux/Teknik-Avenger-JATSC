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
export function pesanPerluTtd({ dokumen, unit, tanggal, pembuat, atasNama, sebutan = 'PH', cuplikan }) {
  const baris = ['🔔 <b>Perlu tanda tangan Anda</b>', '', `Dokumen: <b>${esc(dokumen)}</b>`];
  if (cuplikan) baris.push(`Perihal: <i>${esc(cuplikan)}</i>`);
  if (unit) baris.push(`Unit: ${esc(unit)}`);
  if (tanggal) baris.push(`Tanggal: ${esc(tanggal)}`);
  if (pembuat) baris.push(`Dikirim oleh: ${esc(pembuat)}`);
  if (atasNama) baris.push(`Sebagai ${esc(sebutan)} untuk: <b>${esc(atasNama)}</b>`);
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

/** Kabar ke pejabat: TTD tersimpannya diganti administrator lewat Kelola Akun.
    Dikirim supaya tanda tangan seseorang tidak pernah berganti tanpa ia tahu. */
export function pesanTtdDiganti({ oleh }) {
  const baris = ['✍️ <b>TTD tersimpan Anda diganti</b>', ''];
  if (oleh) baris.push(`Diganti oleh: <b>${esc(oleh)}</b> (administrator)`);
  baris.push('', 'TTD inilah yang dipakai saat Anda menyetujui dokumen. Kalau bukan atas permintaan Anda, '
    + 'ganti lewat E-Logbook → <b>TTD Saya</b> dan kabari administrator.');
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

const potong = (xs, maks) => (xs.length <= maks ? xs : xs.slice(0, maks));

/** "14–18" kalau tanggalnya berurutan atau banyak, "14, 20" kalau sedikit dan
    terpisah — rentang 14–20 untuk dua tanggal itu mengesankan seminggu berubah. */
function rentangTgl(tgl) {
  const t = [...new Set(tgl)].sort((a, b) => a - b);
  if (!t.length) return '';
  const akhir = t[t.length - 1];
  if (t.length === 1) return String(t[0]);
  return akhir - t[0] === t.length - 1 || t.length > 3 ? `${t[0]}–${akhir}` : t.join(', ');
}

/** Satu orang di daftar "siapa saja": namanya dan tanggal yang berubah. */
function sebutOrang(s) {
  if (typeof s === 'string') return esc(s);
  const ket = s.jenis === 'tambah' ? 'baru masuk' : s.jenis === 'hapus' ? 'dikeluarkan'
    : 'tgl ' + rentangTgl((s.hari || []).map((h) => h.tgl));
  return `${esc(s.nama)} (${ket})`;
}

/** Kabar ke orang-orang satu unit (dashboard): daftar dinasnya baru disimpan
    dengan perubahan. `milik` baris selisih penerimanya sendiri (lihat
    selisihJadwal di kabar-perubahan.js) atau null; `semua` seluruh baris
    selisihnya — dari situ tanggal yang berubah dan siapa saja orangnya.
    Tanggalnya tanggal lembar (UTC), sama seperti yang tertulis di tabel
    Jadwal Dinas. */
export function pesanDafdinBerubah({ unit, bulan, oleh, milik, semua, lain }) {
  const baris = ['📅 <b>Daftar dinas diperbarui</b>', ''];
  baris.push(`Unit ${esc(unit)} · ${esc(bulan)}`);
  // Orang yang baru masuk atau dikeluarkan tidak ikut menentukan rentangnya:
  // seluruh bulannya "berubah", dan itu menenggelamkan tukar dinas dua hari.
  const tglUbah = [...(semua || []), ...(milik ? [milik] : [])]
    .filter((s) => s.jenis === 'ubah').flatMap((s) => (s.hari || []).map((h) => h.tgl));
  if (tglUbah.length) {
    const awal = Math.min(...tglUbah), akhir = Math.max(...tglUbah);
    baris.push(`Tanggal diubah: <b>${awal === akhir ? awal : `${awal}–${akhir}`}</b>`);
  }
  if (oleh) baris.push(`Diubah oleh: ${esc(oleh)}`);
  const orangLain = (lain || (semua || []).filter((s) => s !== milik)).filter(Boolean);
  const daftarLain = orangLain.length
    ? `${potong(orangLain, 4).map(sebutOrang).join(', ')}${orangLain.length > 4 ? ` +${orangLain.length - 4} lagi` : ''}`
    : '';
  if (milik && milik.jenis === 'hapus') {
    baris.push('<b>Nama Anda tidak lagi ada di daftar bulan ini.</b>');
  } else if (milik) {
    baris.push(milik.jenis === 'tambah' ? '<b>Anda masuk daftar dinas:</b>' : '<b>Jadwal Anda berubah:</b>');
    const terisi = milik.jenis === 'tambah' ? milik.hari.filter((h) => h.ke) : milik.hari;
    for (const h of potong(terisi, 8)) {
      baris.push(milik.jenis === 'tambah'
        ? `Tgl ${h.tgl}: ${esc(h.ke)}`
        : `Tgl ${h.tgl}: ${esc(h.dari || 'kosong')} → ${esc(h.ke || 'kosong')}`);
    }
    if (terisi.length > 8) baris.push(`+${terisi.length - 8} tanggal lagi`);
  } else {
    if (daftarLain) baris.push(`Berubah: ${daftarLain}`);
    baris.push('Jadwal Anda sendiri tidak berubah.');
  }
  if (milik && daftarLain) baris.push(`Juga berubah: ${daftarLain}`);
  return baris.join('\n');
}

/** Kabar ke anggota unit (dashboard): riwayat satu peralatan ditambah, diubah,
    atau dihapus. `selisih` keluaran selisihSejarah() di kabar-perubahan.js. */
export function pesanSejarahBerubah({ unit, alat, oleh, selisih }) {
  const baris = ['🛠️ <b>Riwayat peralatan diperbarui</b>', ''];
  baris.push(`<b>${esc(alat)}</b>${unit ? ' · Unit ' + esc(unit) : ''}`);
  const tulis = (label, daftar) => {
    for (const k of potong(daftar, 3)) baris.push(`${label}: ${k.tgl ? esc(k.tgl) + ' — ' : ''}${esc(k.judul)}`);
    if (daftar.length > 3) baris.push(`+${daftar.length - 3} ${label.toLowerCase()} lagi`);
  };
  tulis('Baru', selisih.tambah || []);
  tulis('Diubah', selisih.ubah || []);
  tulis('Dihapus', selisih.hapus || []);
  if (oleh) baris.push(`Oleh: ${esc(oleh)}`);
  return baris.join('\n');
}
