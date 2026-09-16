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

/**
 * Nama yang tercetak di bawah TTD kalau PH yang membubuhkan: nama PH sendiri,
 * berikut KEDUDUKAN dan nama pejabat yang ia wakili —
 * "Uji Teknisi (PH Manager Teknik Uus Susanto)".
 *
 * Kedudukannya ikut disebut karena yang membaca lembar ini belum tentu kenal
 * siapa yang diwakili; yang perlu dipastikannya lembar itu ditandatangani pada
 * kedudukan yang benar. Kedudukan datang dari SLOT TTD yang dibubuhkan
 * (JENIS_TTD di db.js), bukan dari jabatan orangnya — satu orang bisa mewakili
 * kedudukan yang berbeda di lembar yang berbeda, dan pada lembar Monitoring
 * slotnya memang Personil Operasi, bukan Manager Teknik.
 *
 * Keterangan dalam kurung pada label slot dibuang: "Manager Teknik (BAPB)" ada
 * untuk membedakan slot di kotak masuk, dan membawanya ke bawah tanda tangan
 * menghasilkan "PH Manager Teknik (BAPB) Uus Susanto".
 *
 * Tanpa kedudukan, bentuknya kembali seperti semula — "Budi Santoso (PH Arya
 * Gunawan)" — supaya pemanggil yang belum menyebutkannya tidak ikut berubah.
 *
 * 'diwakili' = [{ username, nama }] pengalihan PH yang masih berlaku (disusun
 * server.js); pejabatnya dicari lewat 'ttdUntuk' catatan. Nama kosong jatuh ke
 * username-nya.
 */
export function namaCetakPh(nama, ttdUntuk, diwakili, kedudukan = '') {
  const p = (diwakili || []).find((w) => kecil(w && w.username) === kecil(ttdUntuk));
  const atas = (p && String(p.nama || '').trim()) || String(ttdUntuk || '').trim();
  const jabatan = String(kedudukan || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
  return `${String(nama || '').trim()} (PH ${jabatan ? jabatan + ' ' : ''}${atas})`;
}
