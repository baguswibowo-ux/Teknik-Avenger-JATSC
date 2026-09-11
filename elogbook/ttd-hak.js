/**
 * E-LOGBOOK — HAK TANDA TANGAN SUSULAN
 *
 * Satu-satunya tempat aturan "siapa boleh membubuhkan TTD pada catatan ini"
 * ditulis. Dipakai tandaTanganiCatatan di db.js dan db-pg.js, supaya dua
 * lapisan database tidak bisa berselisih diam-diam. Murni — tidak menyentuh
 * database — jadi bisa diuji langsung.
 *
 * Aturannya:
 *   - admin: selalu boleh.
 *   - catatan ditunjuk ke sebuah akun (ttd_untuk): akun itu sendiri, atau PH
 *     yang sedang mewakili akun itu (wakilDari, disusun server.js dari
 *     pengalihan PH yang masih berlaku).
 *   - catatan tidak ditunjuk ke siapa pun: pejabat. PH yang bukan pejabat
 *     hanya memegang hak pejabat yang ia wakili, tidak lebih.
 *   - lewat PH, pembuat catatan tidak boleh menandatangani catatannya sendiri:
 *     pembuat dan penyetuju tidak boleh orang yang sama.
 *
 * Nama pada formulir sengaja tidak dipakai untuk menentukan hak: ia bisa
 * sekadar sebutan jabatan ("PH", dsb.).
 */

const kecil = (s) => String(s || '').trim().toLowerCase();

/** Lempar galat kalau tidak berhak. Kalau berhak: { sebagaiPh }. */
export function hakTtd({ role, username, ttdUntuk, dibuatOleh, wakilDari }) {
  const untuk = kecil(ttdUntuk);
  const saya = kecil(username);
  const langsung = role === 'admin' || (untuk ? untuk === saya : role === 'pejabat');
  const sebagaiPh = !langsung && !!untuk && (wakilDari || []).some((w) => kecil(w) === untuk);
  if (!langsung && !sebagaiPh) {
    throw new Error(untuk
      ? 'Catatan ini ditujukan untuk akun lain — hanya akun yang ditunjuk, PH-nya, atau admin yang dapat menandatangani.'
      : 'Hanya pejabat dan administrator yang dapat menandatangani catatan ini.');
  }
  if (sebagaiPh && kecil(dibuatOleh) === saya) {
    throw new Error('Sebagai PH, Anda tidak bisa menandatangani dokumen yang Anda buat sendiri.');
  }
  return { sebagaiPh };
}

/** Nama yang tercetak di bawah TTD kalau PH yang membubuhkan:
    "Budi Santoso (PH Manager Teknik)". */
export function namaCetakPh(nama, label) {
  return `${String(nama || '').trim()} (PH ${String(label || '').trim()})`;
}
