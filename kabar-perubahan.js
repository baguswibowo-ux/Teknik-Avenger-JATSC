/**
 * KABAR PERUBAHAN — "daftar dinas diperbarui", "riwayat peralatan diperbarui"
 *
 * Modul milik dashboard. Bagian yang bisa dihitung tanpa server: apa yang
 * berubah di antara simpanan lama dan baru, dan siapa yang perlu dikabari.
 * Tidak menyentuh simpanan maupun jaringan — kalimatnya disusun pesan-notif.js
 * (pesanDafdinBerubah, pesanSejarahBerubah), server.js yang menyambungkan
 * (kabariDafdin, kabariSejarah), dan pengirimannya dititipkan ke E-Logbook
 * lewat /internal/notif/kirim. Ujinya: tools/uji-kabar-perubahan.mjs.
 *
 * Beda dari aktivitas-selisih.js: di sana cukup LABEL baris untuk log; di sini
 * perlu petak mana yang berubah, karena tiap orang diberi tahu perubahan
 * jadwalnya SENDIRI, bukan cuma "ada yang berubah".
 */
import { usernameUntukPetak } from './pengingat-dinas.js';

const kunciNama = (o) => String(o?.nama || '').trim().toLowerCase().replace(/\s+/g, ' ');
const kodeHari = (o, i) => String((Array.isArray(o?.hari) ? o.hari[i] : '') || '').trim();
const nikBaris = (o) => String(o?.nik || '').trim();

/** Baris jadwal tidak selalu orang: "GROUP 1", "MANTEK 2" adalah judul di atas
    nama-nama grupnya. Yang ditandai tanpa nomor (lihat jdwTanpaNomor di
    02-kode-dinas.js) bukan orang; begitu juga baris tanpa NIK yang petaknya
    kosong semua — tidak ada dinas yang bisa dikabarkan darinya. */
function barisOrang(o) {
  if (typeof o?.tanpaNo === 'boolean') return !o.tanpaNo;
  if (nikBaris(o)) return true;
  return (Array.isArray(o?.hari) ? o.hari : []).some((h) => String(h || '').trim());
}

/**
 * Selisih jadwal satu unit satu bulan, per orang:
 *   [{ nama, nik, jenis: 'tambah' | 'hapus' | 'ubah', hari: [{ tgl, dari, ke }] }]
 *
 * Dikunci nama orangnya, sama seperti log aktivitas — baris jadwal tidak punya
 * id. Yang dihitung hanya isi petaknya: mengganti peran atau melengkapi NIK
 * bukan perubahan dinas, dan tidak ada yang perlu dibangunkan HP-nya untuk itu.
 * Orang yang masuk atau keluar daftar tanpa satu petak pun terisi tetap
 * dihitung: namanya muncul atau hilang dari lembar.
 */
export function selisihJadwal(lama, baru) {
  lama = (Array.isArray(lama) ? lama : []).filter(barisOrang);
  baru = (Array.isArray(baru) ? baru : []).filter(barisOrang);
  const petaLama = new Map();
  const lamaPerNik = new Map();
  for (const o of lama) {
    const k = kunciNama(o);
    if (!k) continue;
    petaLama.set(k, o);
    if (nikBaris(o)) lamaPerNik.set(nikBaris(o), k);
  }
  const namaBaru = new Set(baru.map(kunciNama));
  const keluar = [];
  const dilihat = new Set();
  const petakBeda = (a, b) => {
    const n = Math.max(Array.isArray(a?.hari) ? a.hari.length : 0, Array.isArray(b?.hari) ? b.hari.length : 0);
    const hari = [];
    for (let i = 0; i < n; i++) {
      const dari = kodeHari(a, i), ke = kodeHari(b, i);
      if (dari !== ke) hari.push({ tgl: i + 1, dari, ke });
    }
    return hari;
  };
  for (const o of Array.isArray(baru) ? baru : []) {
    const k = kunciNama(o);
    if (!k || dilihat.has(k)) continue;
    dilihat.add(k);
    let l = petaLama.get(k);
    // Nama dieja ulang ("Sumindak Roy Rafael Gultom" jadi "Sumindak Gultom"):
    // NIK-nya sama, jadi itu orang yang sama — bukan satu keluar dan satu masuk.
    const kLama = l ? '' : lamaPerNik.get(nikBaris(o));
    if (kLama && !namaBaru.has(kLama) && !dilihat.has(kLama)) {
      l = petaLama.get(kLama);
      dilihat.add(kLama);
    }
    const hari = petakBeda(l, o);
    const dasar = { nama: String(o.nama || '').trim(), nik: String(o.nik || (l && l.nik) || '').trim() };
    if (!l) keluar.push({ ...dasar, jenis: 'tambah', hari });
    else if (hari.length) keluar.push({ ...dasar, jenis: 'ubah', hari });
  }
  for (const [k, l] of petaLama) {
    if (dilihat.has(k)) continue;
    keluar.push({
      nama: String(l.nama || '').trim(), nik: String(l.nik || '').trim(),
      jenis: 'hapus', hari: petakBeda(l, null)
    });
  }
  return keluar;
}

/**
 * Siapa dikabari tentang perubahan jadwal → [{ username, milik }].
 * `milik` = baris selisih orang itu sendiri, atau null kalau jadwalnya tidak
 * ikut berubah.
 *
 * Penerimanya: semua orang di lembar itu (lama maupun baru — yang dikeluarkan
 * dari daftar justru paling perlu tahu) ditambah anggota unit di E-Logbook
 * yang tidak tercantum (admin unit, PIC, manajer yang mencentang unit itu).
 * `kecuali` (opsional) satu username yang dilewati; server.js tidak memakainya
 * — penyimpannya sengaja ikut dikabari.
 *
 * Orang → akun memakai aturan pengingat dinas: NIK dulu, nama hanya kalau
 * kenanya tepat satu akun.
 */
export function penerimaDafdin({ lama, baru, selisih, akun, anggota, kecuali }) {
  const lewati = String(kecuali || '').toLowerCase();
  const perUser = new Map();
  const catat = (username, milik) => {
    const u = String(username || '').toLowerCase();
    if (!u || u === lewati) return;
    // Baris selisih tidak boleh tertimpa null oleh kemunculan kedua orang itu.
    if (!perUser.has(u) || milik) perUser.set(u, { username, milik: milik || (perUser.get(u) || {}).milik || null });
  };
  const selisihPerNama = new Map((selisih || []).map((s) => [kunciNama(s), s]));
  for (const o of [...(Array.isArray(baru) ? baru : []), ...(Array.isArray(lama) ? lama : [])]) {
    const username = usernameUntukPetak({ nik: o?.nik, nama: o?.nama }, akun);
    if (username) catat(username, selisihPerNama.get(kunciNama(o)) || null);
  }
  for (const a of Array.isArray(anggota) ? anggota : []) catat(a?.username, null);
  return [...perUser.values()];
}

/* Isi kejadian yang dibaca orang — sama dengan yang membuat tanda tangan
   penanggung jawab kembali 'menunggu' di PUT /sejarah. Status TTD, pencatat,
   dan waktu catat bukan isi. */
const isiKejadianSama = (a, b) => a.tgl === b.tgl && a.judul === b.judul && a.rinci === b.rinci
  && (a.warna || '') === (b.warna || '') && (a.ket || '') === (b.ket || '');

/**
 * Selisih garis waktu satu alat → { tambah: [kejadian], ubah: [kejadian], hapus: [kejadian] }.
 * `sebelum` daftar tersimpan, `sesudah` daftar yang baru disimpan; dikunci id.
 */
export function selisihSejarah(sebelum, sesudah) {
  const petaLama = new Map((Array.isArray(sebelum) ? sebelum : []).map((k) => [k.id, k]));
  const tambah = [], ubah = [];
  const dilihat = new Set();
  for (const k of Array.isArray(sesudah) ? sesudah : []) {
    dilihat.add(k.id);
    const l = petaLama.get(k.id);
    if (!l) tambah.push(k);
    else if (!isiKejadianSama(l, k)) ubah.push(k);
  }
  const hapus = [...petaLama.values()].filter((k) => !dilihat.has(k.id));
  return { tambah, ubah, hapus };
}

const BULAN_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/** "Oktober 2026" dari "2026-10". */
export const namaBulan = (bulan) => {
  const [y, m] = String(bulan || '').split('-').map(Number);
  return BULAN_ID[m - 1] ? `${BULAN_ID[m - 1]} ${y}` : String(bulan || '');
};
