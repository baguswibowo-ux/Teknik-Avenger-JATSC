/**
 * E-LOGBOOK — KALIMAT LOG AKTIVITAS
 *
 * Menyusun kolom `rincian` untuk log aktivitas dari keadaan sebelum dan
 * sesudah sebuah perubahan. Pertanyaan yang harus bisa dijawab tanpa membuka
 * apa pun: dokumen MANA yang dihapus, dan peran seseorang diubah DARI apa KE
 * apa. Log yang cuma bilang "deleteEntry" atau "role diubah" tidak menjawab
 * keduanya.
 *
 * Murni — tanpa database — supaya bisa diuji langsung. Pembacaan keadaan
 * sebelum/sesudahnya dikerjakan server.js (PENCATAT_AKTIVITAS).
 *
 * Isi dokumennya tidak disalin: cukup judul dan kepala perihalnya, lewat
 * ringkasDokumen yang sama dengan notifikasi Telegram.
 */

import { ringkasDokumen } from './ringkas-dokumen.js';

/** Sebutan peran untuk manusia — cermin pilihan di Kelola Akun dashboard. */
export const NAMA_PERAN = {
  admin: 'Administrator',
  pejabat: 'Pejabat',
  adminunit: 'Admin Unit',
  teknisi: 'Teknisi',
  'pic-dinas': 'PIC Jadwal Dinas',
  'pic-sparepart': 'PIC Sparepart',
  'pic-isr': 'PIC ISR'
};
export const namaPeran = (r) => NAMA_PERAN[r] || r || '—';

/* Jenis dokumen → nama modul di log. `berkala` E-Logbook (lembar
   Pemeliharaan Berkala) sengaja diberi nama lain: dashboard sudah memakai
   modul `berkala` untuk Kegiatan Berkala, dan keduanya tidak boleh tercampur
   di saringan modul. */
export const MODUL_DOKUMEN = {
  logbook: 'logbook', dailycheck: 'dailycheck', monitoring: 'monitoring',
  dstest: 'dstest', berkala: 'pemeliharaan', ltk: 'ltk', bapb: 'bapb', isu: 'isu'
};

/** Jenis pada updateTtdRouting (RUTE_TTD_META di db.js) → jenis dokumen. */
export const JENIS_RUTE = {
  entry: 'logbook', dc: 'dailycheck', ltk: 'ltk',
  berkala: 'berkala', dstest: 'dstest', bapb: 'bapb'
};

/** Gabungan kode unit, unik, huruf kecil, dipisah koma — bentuk kolom `unit`
    yang disaring per unit oleh listAktivitas. */
export function unitCsv(...daftar) {
  const kode = daftar.flat().map((k) => String(k || '').trim().toLowerCase()).filter(Boolean);
  return [...new Set(kode)].join(',');
}

/**
 * "Logbook — New JATSC · 2026-09-10: CPU B Gatevox 5 kembali restart… (dibuat cipto)"
 *
 * `info` = baris dari infoCatatan (kolom ringkas + tanggal_catatan +
 * dibuat_oleh). Boleh null — dokumennya sudah tidak terbaca — dan yang
 * tersisa tinggal jenisnya. Pembuat disebut hanya kalau bukan pelakunya
 * sendiri: menghapus catatan orang lain itu yang perlu kelihatan.
 */
export function rincianDokumen(jenis, info, { pelaku = '', tambahan = '' } = {}) {
  const { judul, cuplikan } = ringkasDokumen(jenis, info || {});
  const tgl = String(info?.tanggal_catatan || '').trim().replace('T', ' ').slice(0, 25);
  let teks = tgl ? `${judul} · ${tgl}` : judul;
  if (cuplikan) teks += `: ${cuplikan}`;
  const pembuat = String(info?.dibuat_oleh || '').trim();
  if (pembuat && pembuat.toLowerCase() !== String(pelaku || '').toLowerCase()) {
    teks += ` (dibuat ${pembuat})`;
  }
  if (tambahan) teks += ` — ${tambahan}`;
  return teks;
}

/** "Cipto Hadi (cipto)", atau username saja kalau namanya sama/kosong. */
export function sebutAkun(a) {
  if (!a) return '—';
  const u = String(a.username || '').trim();
  const n = String(a.nama || '').trim();
  return n && n.toLowerCase() !== u.toLowerCase() ? `${n} (${u})` : (u || n || '—');
}

const daftarUnit = (kode, namaUnit) =>
  (kode || []).map((k) => namaUnit(k) || k).join(', ') || '—';

/**
 * Rincian perubahan akun. `lama`/`baru` = { username, nama, role, unit: [kode] }
 * sebelum dan sesudah; salah satunya boleh null (tambah → lama null, hapus →
 * baru null). Kata sandi tidak pernah ikut — hanya fakta bahwa ia diganti.
 */
export function rincianAkun(aksi, lama, baru, namaUnit = (k) => k) {
  const akun = baru || lama;
  const siapa = sebutAkun(akun);
  switch (aksi) {
    case 'tambah':
    case 'hapus': {
      const unit = (akun?.unit || []).length ? ` · unit ${daftarUnit(akun.unit, namaUnit)}` : '';
      return `${siapa} · ${namaPeran(akun?.role)}${unit}`;
    }
    case 'peran':
      return `${siapa}: ${namaPeran(lama?.role)} → ${namaPeran(baru?.role)}`;
    case 'unit':
      return `${siapa}: unit ${daftarUnit(lama?.unit, namaUnit)} → ${daftarUnit(baru?.unit, namaUnit)}`;
    case 'nama':
      return `${akun?.username || '—'}: nama "${lama?.nama || ''}" → "${baru?.nama || ''}"`;
    case 'username':
      return `${akun?.nama || '—'}: username ${lama?.username || '—'} → ${baru?.username || '—'}`;
    case 'sandi':
      return `${siapa}: kata sandi diganti`;
    case 'aktifkan':
    case 'nonaktifkan':
      return `${siapa} · ${namaPeran(akun?.role)}`;
    default:
      return siapa;
  }
}
