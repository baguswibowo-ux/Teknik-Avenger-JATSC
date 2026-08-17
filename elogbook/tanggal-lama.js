/**
 * E-LOGBOOK NEW JATSC — TAFSIR TANGGAL PANJANG LAMA
 *
 * Daily check menyimpan tanggalnya sebagai teks panjang seperti
 * "KAMIS / 6 AGU 2026" (lihat komentar di public/js/14-daily-check-umum.js),
 * sengaja begitu supaya catatan lama dan baru sebentuk di formulir cetak.
 * Teks itu tidak bisa diurutkan langsung, jadi setiap baris juga menyimpan
 * kolom tanggal_urut (YYYY-MM-DD) khusus untuk ORDER BY.
 *
 * Fungsi di sini menafsir teks lama itu balik jadi ISO, dipakai saat mengisi
 * tanggal_urut untuk catatan yang dibuat sebelum kolom ini ada. Bahasa
 * antarmuka bisa Indonesia atau Inggris tergantung yang aktif saat
 * disimpan, jadi kedua daftar bulan diperiksa.
 */

const BULAN_ID = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES'];
const BULAN_EN = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** "KAMIS / 6 AGU 2026" -> "2026-08-06". Balikan '' kalau tidak dikenali. */
export function isoDariTanggalPanjang(teks) {
  const cocok = /\/\s*(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})\s*$/.exec(String(teks || '').trim());
  if (!cocok) return '';
  const [, hari, bulanTeks, tahun] = cocok;
  const bulan = bulanTeks.toUpperCase();
  const idx = BULAN_ID.indexOf(bulan);
  const bulanKe1 = idx >= 0 ? idx : BULAN_EN.indexOf(bulan);
  if (bulanKe1 < 0) return '';
  const d = Number(hari), y = Number(tahun);
  if (!(d >= 1 && d <= 31)) return '';
  return `${y}-${String(bulanKe1 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
