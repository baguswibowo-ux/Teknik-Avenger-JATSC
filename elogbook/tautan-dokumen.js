/**
 * E-LOGBOOK — TAUTAN DOKUMEN PADA CATATAN LOGBOOK
 *
 * Satu catatan logbook boleh menunjuk ke lembar lain yang jadi dasarnya: BAPB
 * penggantian barang, LTK perbaikan, atau lembar pekerjaan berkala. Uraiannya
 * tetap ditulis teknisi sendiri — yang disimpan di sini cuma rujukannya.
 *
 * KENAPA RUJUKANNYA TIDAK DITULIS DI DALAM URAIAN. Uraian itu teks yang
 * tercetak apa adanya di lembar resmi, dan teknisi masih boleh menyuntingnya
 * selama Manager Teknik belum membubuhkan tanda tangan. Rujukan yang menumpang
 * di kalimat akan ikut terhapus pada suntingan pertama yang tidak hati-hati,
 * tanpa ada yang menyadarinya.
 *
 * LABEL DAN TANGGAL DIBEKUKAN SAAT MENAUTKAN, tidak dibaca ulang dari dokumen
 * sumbernya tiap kali catatan ditampilkan. Dokumen bisa terhapus, bisa jatuh di
 * luar batas baris yang dikirim ke layar, atau pindah unit — dan kalau salah
 * satu terjadi, chip yang kosong sama saja dengan tidak ada rujukan. Yang beku
 * tetap terbaca dan tetap benar saat dicetak; yang hilang cuma kemampuan
 * mengkliknya.
 *
 * MENAMBAH JENIS SUMBER BARU cukup satu baris di SUMBER di bawah, plus satu
 * baris di TAUTAN_SUMBER pada js/11-logbook.js (sisi layar: dari mana daftar
 * pilihannya diambil dan kolom mana yang jadi labelnya).
 */

/**
 * Jenis lembar yang boleh ditautkan, dan tabel tempat keberadaannya diperiksa.
 *
 * `jenis` di sini memakai kata yang sama dengan TTD_BUKA_ULANG di
 * js/20-ttd-pejabat.js — itu yang dipakai chip untuk membuka dokumennya, jadi
 * jenis yang tidak dikenal di sana tidak akan bisa diklik.
 */
export const SUMBER = {
  ltk:     { tabel: 'ltk',     label: 'LTK' },
  bapb:    { tabel: 'bapb',    label: 'BAPB' },
  berkala: { tabel: 'berkala', label: 'Berkala' }
};

export const TAUTAN_JENIS = Object.keys(SUMBER);
export const jenisTautanSah = (j) => Object.prototype.hasOwnProperty.call(SUMBER, String(j || ''));

/** Batas per catatan. Satu dinas yang menyentuh lebih dari sepuluh lembar
    lebih tepat dipecah jadi beberapa catatan daripada ditumpuk jadi satu. */
export const TAUTAN_MAKS = 10;

/** Label beku dipotong supaya satu tautan tidak bisa dipakai menitipkan
    karangan panjang ke dalam baris catatan. */
const LABEL_MAKS = 120;

const teks = (v, maks) => String(v == null ? '' : v).trim().slice(0, maks);

/**
 * Bersihkan daftar tautan kiriman klien jadi bentuk yang boleh disimpan.
 *
 * Yang jenisnya tidak dikenal atau tanpa id dibuang diam-diam, bukan
 * dilemparkan sebagai galat: satu baris rusak tidak sepadan dengan membatalkan
 * penyimpanan seluruh catatan yang sudah diketik. Yang melanggar batas jumlah
 * ditolak keras — itu kiriman yang memang tidak wajar, bukan kecelakaan.
 *
 * Tautan kembar (jenis + id sama) dilebur jadi satu; menempel dokumen yang itu
 * juga dua kali tidak menambah keterangan apa pun.
 */
export function normalkanTautan(daftar) {
  if (!Array.isArray(daftar)) return [];
  const hasil = [];
  const sudah = new Set();
  for (const t of daftar) {
    if (!t || typeof t !== 'object') continue;
    const jenis = String(t.jenis || '');
    const id = teks(t.id, 64);
    if (!jenisTautanSah(jenis) || !id) continue;
    const kunci = jenis + ':' + id;
    if (sudah.has(kunci)) continue;
    sudah.add(kunci);
    hasil.push({
      jenis,
      id,
      // Unit dipakai chip untuk berpindah unit sebelum membuka dokumennya.
      // Pola dibatasi karena nilainya masuk ke pemilih CSS di sisi layar.
      unit: /^[a-z0-9_-]{1,32}$/.test(String(t.unit || '')) ? String(t.unit) : '',
      label: teks(t.label, LABEL_MAKS),
      tanggal: teks(t.tanggal, 10)
    });
  }
  if (hasil.length > TAUTAN_MAKS) {
    throw new Error(`Maksimal ${TAUTAN_MAKS} tautan dokumen per catatan.`);
  }
  return hasil;
}
