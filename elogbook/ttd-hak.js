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

import { isoDariTanggalPanjang } from './tanggal-lama.js';

const kecil = (s) => String(s || '').trim().toLowerCase();

/**
 * Tanggal kegiatan sebuah lembar sebagai YYYY-MM-DD.
 *
 * Kebanyakan lembar menyimpan tanggalnya sudah ISO, tapi Daily Check
 * menyimpannya sebagai teks panjang ("KAMIS / 6 AGU 2026") supaya catatan lama
 * dan baru sebentuk di formulir cetak. Yang tidak bisa dibaca sama sekali
 * dijawab '' — dan '' tidak pernah dianggap masuk periode PH mana pun.
 */
export function tanggalDokumenIso(teks) {
  const t = String(teks || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  return isoDariTanggalPanjang(t);
}

/**
 * Apakah lembar bertanggal kegiatan ini termasuk tugas PH berperiode
 * [mulai, sampai].
 *
 * YANG DIBANDINGKAN TANGGAL KEGIATAN DI LEMBAR, bukan kapan lembarnya diinput.
 * Manager Teknik yang cuti 16-18 Sep menitipkan lembar dinas 16-18 Sep; lembar
 * tanggal 14 yang baru sempat diisi teknisi tanggal 17 tetap menunggu dia —
 * itu bukan hari yang ia titipkan.
 *
 * Tanggal yang tidak terbaca dijawab TIDAK. Hak tanda tangan yang meragukan
 * dikembalikan ke pejabatnya sendiri, bukan diberikan ke PH.
 *
 * 'mulai' kosong berarti tanpa batas bawah: penunjukan PH yang dibuat sebelum
 * tanggal mulai ada tidak punya nilainya, dan menebaknya sama saja mengarang.
 */
export function dalamPeriodePh(tanggalDokumen, mulai, sampai) {
  const tgl = tanggalDokumenIso(tanggalDokumen);
  if (!tgl) return false;
  if (sampai && tgl > String(sampai)) return false;
  if (mulai && tgl < String(mulai)) return false;
  return true;
}

/** Saring daftar pejabat yang diwakili ({ username, nama, mulai, sampai })
    menjadi yang periodenya mencakup tanggal kegiatan lembar ini saja. */
export function diwakiliUntukTanggal(diwakili, tanggalDokumen) {
  return (diwakili || []).filter((p) => dalamPeriodePh(tanggalDokumen, p && p.mulai, p && p.sampai));
}

/** Lempar galat kalau tidak berhak. Kalau berhak: { sebagaiPh }. */
export function hakTtd({ role, username, ttdUntuk, dibuatOleh, wakilDari }) {
  const untuk = kecil(ttdUntuk);
  const saya = kecil(username);
  // PH lebih dulu dari hak langsung. Administrator memang boleh menandatangani
  // apa saja secara langsung, tapi kalau ia sedang PH untuk pejabat yang dituju
  // lembar ini, yang terjadi adalah penandatanganan SEBAGAI PH — dan harus
  // tercetak begitu. Diperiksa sebaliknya, administrator yang ditunjuk PH
  // tidak pernah tercatat sebagai PH.
  const sebagaiPh = !!untuk && untuk !== saya && (wakilDari || []).some((w) => kecil(w) === untuk);
  const langsung = !sebagaiPh && (role === 'admin' || (untuk ? untuk === saya : role === 'pejabat'));
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
