/**
 * E-LOGBOOK NEW JATSC — DAFTAR PEKERJAAN BERKALA (UNIT RADTEL)
 *
 * Empat pekerjaan berkala, masing-masing punya tabnya sendiri di layar dan
 * lembar isiannya sendiri. Sumbernya arahan unit Radtel (18 Agustus 2026).
 *
 *   neptuno       Cek query rekaman Neptuno — SCU (231 channel) dan CWP (85)
 *   gatevox       Restart CPU Gatevox — 9 Gatevox, CPU A dan CPU B
 *   cleaning-cwp  Cleaning CWP — memakai daftar channel CWP yang sama
 *   restart-cwp   Restart CWP — daftar CWP, ditambah Neptuno 1–4 dan TMCS 1–2
 *
 * Daftar ini dipakai db.js (SQLite, server kantor) dan db-pg.js (Postgres,
 * Vercel) sekaligus, sama seperti ds-site.js — supaya keduanya tidak mulai
 * berbeda diam-diam. Barisnya DIBANGKITKAN, bukan diketik satu per satu:
 * tiga ratus lebih baris yang ditulis tangan adalah tiga ratus kesempatan
 * salah ketik, dan pola penomorannya memang teratur.
 *
 * Tiap baris disimpan berkunci `kode`, jadi kode adalah satu-satunya bagian
 * yang tidak boleh diubah sembarangan: mengubahnya membuat catatan lama
 * terbaca kosong. Nama boleh diperbaiki kapan saja.
 */

/* ============== SCU ==============
 * Satu SCU berisi tujuh channel: sisi E punya Ambient, sisi P tidak.
 * 33 SCU × 7 = 231 channel. */
const JUMLAH_SCU = 33;
const SCU_CHANNEL = [
  ['E', 'Radio'], ['E', 'Telephone'], ['E', 'Briefing'], ['E', 'Ambient'],
  ['P', 'Radio'], ['P', 'Telephone'], ['P', 'Briefing']
];

/* ============== CWP ==============
 * 23 posisi CWP, masing-masing Radio, Telephone, dan Briefing. Ambient hanya
 * ada pada sebagian posisi — bukan seluruhnya.
 *
 *   23 × 3          = 69
 *   Ambient (12)    = 12   → 81
 *   Channel 82–85   =  4   → 85
 *
 * Empat channel terakhir tidak menempel pada CWP mana pun, jadi ditulis apa
 * adanya sebagai nomor channel. */
const JUMLAH_CWP = 23;
const CWP_DASAR = ['Radio', 'Telephone', 'Briefing'];
const CWP_AMBIENT = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 14, 18]);
const CWP_EKOR = [[82, 'Telp'], [83, 'Briefing'], [84, 'Telp'], [85, 'Briefing']];

/** Kode yang tenang dibaca mesin: huruf kecil, tanpa spasi. */
const kodekan = (teks) => String(teks).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Barisan channel SCU, bernomor 1..231. */
function daftarScu() {
  const out = [];
  for (let i = 1; i <= JUMLAH_SCU; i++) {
    for (const [sisi, channel] of SCU_CHANNEL) {
      out.push({
        no: out.length + 1,
        kode: `scu-${i}-${kodekan(sisi + '-' + channel)}`,
        nama: `SCU ${i} — ${sisi} ${channel}`,
        grup: 'SCU'
      });
    }
  }
  return out;
}

/**
 * Barisan channel CWP, bernomor 1..85.
 *
 * Nomornya berjalan terus dari CWP 1 sampai CWP 23 lalu disambung channel
 * 82–85, jadi nomor baris di sini memang nomor channel yang sebenarnya —
 * bukan sekadar urutan tampil. Itu sebabnya CWP ber-Ambient memakan empat
 * nomor dan yang tidak hanya tiga.
 */
function daftarCwp() {
  const out = [];
  for (let i = 1; i <= JUMLAH_CWP; i++) {
    const channel = CWP_AMBIENT.has(i) ? [...CWP_DASAR, 'Ambient'] : CWP_DASAR;
    for (const c of channel) {
      out.push({
        no: out.length + 1,
        kode: `cwp-${i}-${kodekan(c)}`,
        nama: `CWP ${i} — ${c}`,
        grup: 'CWP'
      });
    }
  }
  for (const [nomor, c] of CWP_EKOR) {
    out.push({
      no: nomor,
      kode: `cwp-ch-${nomor}`,
      nama: `Channel ${nomor} — ${c}`,
      grup: 'CWP'
    });
  }
  return out;
}

/** Baris sederhana bernomor ulang dari satu. */
const bernomor = (daftar) => daftar.map((it, i) => ({ ...it, no: i + 1 }));

/** Restart CPU Gatevox: 9 Gatevox, tiap-tiap CPU A dan CPU B. */
function daftarGatevox() {
  const out = [];
  for (let i = 1; i <= 9; i++) {
    for (const cpu of ['A', 'B']) {
      out.push({
        no: out.length + 1,
        kode: `gv-${i}-cpu-${cpu.toLowerCase()}`,
        nama: `Gatevox ${i} — CPU ${cpu}`,
        grup: 'Gatevox'
      });
    }
  }
  return out;
}

/* Perangkat yang ikut direstart bersama CWP. Ditulis sebagai baris sendiri,
   bukan satu baris "Neptuno & TMCS": satu yang gagal naik tidak boleh
   tertutup oleh lima lainnya yang berhasil. */
const NEPTUNO_TMCS = [
  ...[1, 2, 3, 4].map((i) => ({ kode: `nep-${i}`, nama: `Neptuno ${i}`, grup: 'Neptuno' })),
  ...[1, 2].map((i) => ({ kode: `tmcs-${i}`, nama: `TMCS ${i}`, grup: 'TMCS' }))
];

/**
 * Empat lembar pekerjaan.
 *
 * Daftar CWP dipakai tiga kali — sekali di cek Neptuno, sekali di cleaning,
 * sekali di restart. Sengaja dibangkitkan ulang tiap kali (bukan dipakai
 * bersama satu larik yang sama) supaya penomoran `no` di tiap lembar berdiri
 * sendiri dan tidak ada lembar yang bisa mengubah isi lembar lain.
 */
export const BERKALA_ITEM = {
  neptuno:        [...daftarScu(), ...daftarCwp()],
  gatevox:        daftarGatevox(),
  'cleaning-cwp': daftarCwp(),
  'restart-cwp':  [...daftarCwp(), ...bernomor(NEPTUNO_TMCS).map((it, i) => ({ ...it, no: i + 1 }))]
};

export const JENIS_BERKALA = Object.keys(BERKALA_ITEM);
export const jenisBerkalaSah = (j) => JENIS_BERKALA.includes(j);
export const berkalaItemUntuk = (jenis) => BERKALA_ITEM[jenis] || [];
