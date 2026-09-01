/**
 * E-LOGBOOK NEW JATSC — DAFTAR PEKERJAAN BERKALA (UNIT RADTEL)
 *
 * Empat pekerjaan berkala, masing-masing punya tabnya sendiri di layar dan
 * lembar isiannya sendiri. Sumbernya arahan unit Radtel (18 Agustus 2026).
 *
 *   neptuno       Cek Inspection Neptuno — 4 Neptuno × (monit summary + NTP status)
 *   gatevox       Change Over CPU Gatevox — 9 GateVox, redundansi CPU A/B
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

/* ============== NEPTUNO — WEEKLY INSPECTION ==============
 * Lembar mingguan per unit Neptuno (recording): dua seksi.
 *
 *   Monit summary  — 19 item, salinan output `monit summary`
 *   NTP status     — 7 item, salinan output `chronyc sources`
 *
 * Empat Neptuno (neprec1..neprec4), jadi 4 × (19 + 7) = 104 baris.
 * Kolom Expected dipakai renderer sebagai referensi (nilai patokan);
 * teknisi mengisi Actual, Status (Good/Not Good), dan Remarks di layar.
 */
const NEPTUNO_MONIT = [
  { kode:'date',         nama:'date',         expected:'Tanggal sesuai hari pemeriksaan' },
  { kode:'hostname',     nama:'hostname',     expected:'neprec{N}' },
  { kode:'snmpd',        nama:'snmpd',        expected:'OK' },
  { kode:'postmaster',   nama:'postmaster',   expected:'OK' },
  { kode:'nepTmcsSrv',   nama:'nepTmcsSrv',   expected:'OK' },
  { kode:'nepStatusSrv', nama:'nepStatusSrv', expected:'OK' },
  { kode:'nepSnmpSrv',   nama:'nepSnmpSrv',   expected:'OK' },
  { kode:'nepRecSrv',    nama:'nepRecSrv',    expected:'OK' },
  { kode:'nepNtpSrv',    nama:'nepNtpSrv',    expected:'OK' },
  { kode:'nepLinkSrv',   nama:'nepLinkSrv',   expected:'OK' },
  { kode:'nepEurocaeSrv',nama:'nepEurocaeSrv',expected:'OK' },
  { kode:'nepCheckSrv',  nama:'nepCheckSrv',  expected:'OK' },
  { kode:'nepChannelSrv',nama:'nepChannelSrv',expected:'OK' },
  { kode:'nepBiteSrv',   nama:'nepBiteSrv',   expected:'OK' },
  { kode:'nepBeepSrv',   nama:'nepBeepSrv',   expected:'OK' },
  { kode:'nepAirCmdSrv', nama:'nepAirCmdSrv', expected:'OK' },
  { kode:'mediamtx',     nama:'mediamtx',     expected:'OK' },
  { kode:'chronyd',      nama:'chronyd',      expected:'OK' },
  { kode:'tomcat',       nama:'tomcat',       expected:'OK' }
];
const NEPTUNO_NTP = [
  { kode:'ntp-name',    nama:'Nama/IP Address', expected:'nepntp1/nepntp2' },
  { kode:'ntp-mode',    nama:'Mode Status',     expected:'^*, ^+, ^-, ^?, ^X' },
  { kode:'ntp-stratum', nama:'Stratum',         expected:'1' },
  { kode:'ntp-poll',    nama:'Poll',            expected:'10 (2^10)/1040s' },
  { kode:'ntp-reach',   nama:'Reach',           expected:'377' },
  { kode:'ntp-lastrx',  nama:'LastRx',          expected:'≤ 1040' },
  { kode:'ntp-sample',  nama:'Last Sample',     expected:'[+35µs]' }
];
function daftarNeptuno() {
  const out = [];
  let no = 0;
  for (let i = 1; i <= 4; i++) {
    for (const it of NEPTUNO_MONIT) {
      out.push({
        no:  ++no,
        kode:`n${i}-${it.kode}`,
        nama:it.nama,
        grup:`Neptuno ${i} — Monit Summary`,
        expected: it.expected.replace('{N}', String(i))
      });
    }
    for (const it of NEPTUNO_NTP) {
      out.push({
        no:  ++no,
        kode:`n${i}-${it.kode}`,
        nama:it.nama,
        grup:`Neptuno ${i} — NTP Status (chronyc sources)`,
        expected: it.expected
      });
    }
  }
  return out;
}

/**
 * Change Over CPU Gatevox — 9 GateVox, satu baris per GateVox.
 *
 * Bukan lagi 18 baris per CPU: lembar Change Over memeriksa PERTUKARAN
 * peran MAIN↔STANDBY antara CPU A dan CPU B, jadi satu-satuannya
 * GateVox, bukan CPU. IP CPU A/B menempel sebagai metadata baris agar
 * teknisi tidak perlu mencari lagi di dokumen lain.
 */
const IP_GATEVOX = [
  { ipA: '172.31.50.201', ipB: '172.31.50.202' },
  { ipA: '172.31.50.204', ipB: '172.31.50.205' },
  { ipA: '172.31.50.207', ipB: '172.31.50.208' },
  { ipA: '172.31.50.210', ipB: '172.31.50.211' },
  { ipA: '172.31.50.213', ipB: '172.31.50.214' },
  { ipA: '172.31.50.216', ipB: '172.31.50.217' },
  { ipA: '172.31.50.219', ipB: '172.31.50.220' },
  { ipA: '172.31.50.222', ipB: '172.31.50.223' },
  { ipA: '172.31.50.225', ipB: '172.31.50.226' }
];
function daftarGatevox() {
  return IP_GATEVOX.map((ip, i) => ({
    no:   i + 1,
    kode: `gv-${i + 1}`,
    nama: `GateVox ${i + 1}`,
    grup: 'GateVox',
    ipA:  ip.ipA,
    ipB:  ip.ipB
  }));
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
  neptuno:        daftarNeptuno(),
  gatevox:        daftarGatevox(),
  'cleaning-cwp': daftarCwp(),
  'restart-cwp':  [...daftarCwp(), ...bernomor(NEPTUNO_TMCS).map((it, i) => ({ ...it, no: i + 1 }))]
};

export const JENIS_BERKALA = Object.keys(BERKALA_ITEM);
export const jenisBerkalaSah = (j) => JENIS_BERKALA.includes(j);
export const berkalaItemUntuk = (jenis) => BERKALA_ITEM[jenis] || [];
