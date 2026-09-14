/**
 * PENGINGAT KEGIATAN BERKALA — "sejam sesudah dinas mulai, ini yang belum dikerjakan"
 *
 * Kembaran pengingat-dinas.js untuk kegiatan berkala, dengan pola yang sama:
 * modul ini MURNI (tidak menyentuh berkas, jaringan, atau Telegram), server.js
 * dashboard yang menyambungkannya (periksaPengingatBerkala), dan ujinya di
 * tools/uji-pengingat-berkala.mjs.
 *
 * Permintaan Bagus, 14 September 2026: tiap orang yang berdinas menerima SATU
 * pesan Telegram satu jam sesudah dinasnya mulai, berisi kegiatan berkala unit
 * itu yang harus dikerjakan. Pengingat saja — pengisiannya tetap di E-Logbook.
 *
 * YANG DISEBUT DI PESAN harus sama dengan yang dibunyikan lonceng dashboard
 * (notifSaya() di public/js/26-perhatian-lonceng.js), dengan satu beda yang
 * disengaja: lonceng juga menyebut yang jatuh tempo BESOK, pesan ini hanya
 * yang jatuh hari ini dan yang sudah lewat — pesan dinas berisi pekerjaan
 * dinas itu. Aturannya:
 *   - kejadian di periode berjalan (bklKejadian) yang tanggalnya ≤ hari ini;
 *   - kegiatan yang menyebut rombongan (PS / M) hanya untuk rombongan itu;
 *   - kegiatan yang menyebut Lokasi (jatsc / new-jatsc) hanya untuk yang kode
 *     dinasnya di gedung itu — PSJ tidak diingatkan Daily Check New JATSC;
 *   - yang sudah dikerjakan dilewati. Sudahnya dijawab LEMBAR E-Logbook untuk
 *     kegiatan bersumber E-Logbook (bklSudahTgl: ada baris lembar bertanggal
 *     sama), dan catatan berkala-selesai.json untuk yang dicentang manual.
 *
 * SUMBER ASLINYA public/js/23-berkala.js. Yang di bawah salinan yang dipangkas:
 * dari registri BERKALA_SUMBER hanya larik mana yang dibaca, saringannya,
 * tanggal barisnya, dan sebutannya. Ujinya memuat berkas asli itu di vm dan
 * membandingkan sumber demi sumber — menambah lembar di dashboard tanpa
 * menambahkannya di sini membuat ujinya gagal, bukan pengingatnya diam.
 *
 * TANGGAL menurut WIB, dihitung dari milidetik epoch — bukan jam setempat
 * mesin. Dashboard menghitung dengan jam peramban yang memang WIB; server
 * yang kebetulan disetel UTC tidak boleh menggeser "hari ini" tujuh jam.
 */

import { SHIFT_MULAI } from './pengingat-dinas.js';

const WIB_MS = 7 * 3600 * 1000;
const HARI_MS = 86400000;
const dua = (n) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' pertama di dalam tulisan apa pun — cermin isoTgl() dashboard. */
export const isoTgl = (x) => { const m = String(x || '').match(/\d{4}-\d{2}-\d{2}/); return m ? m[0] : ''; };

const tglDc = (x) => isoTgl(x.TanggalIso) || isoTgl(x.Tanggal) || isoTgl(x.DibuatPada);
const tglDs = (x) => isoTgl(x.Tanggal) || isoTgl(x.DibuatPada);

/* ---------- Registri bukti: cermin BERKALA_SUMBER di 23-berkala.js ---------- */

const dc = (form, sebutan) => ({
  paket: 'dcHistory', tgl: tglDc,
  saring: form ? (x) => x.Form === form : null,
  sebut: 'lembar Daily Check' + (sebutan ? ' ' + sebutan : '')
});
const pm = (kategori, kunci, form, sebutan) => ({
  paket: 'dstest', tgl: tglDs,
  saring: (x) => x.Kategori === kategori && (!form || ((x.State || {})[kunci] === form)),
  sebut: 'lembar ' + sebutan
});
const bk = (jenis, sebut) => ({
  paket: 'berkala', tgl: tglDs, saring: (x) => x.Jenis === jenis, sebut
});

const LEMBAR_MR = [
  ['llz-07l', 'LLZ 07L'], ['llz-07r', 'LLZ 07R'], ['llz-25l', 'LLZ 25L'], ['llz-25r', 'LLZ 25R'],
  ['gp-07l', 'GP 07L'], ['gp-07r', 'GP 07R'], ['gp-25l', 'GP 25L'], ['gp-25r', 'GP 25R'],
  ['tdme-07l', 'TDME 07L'], ['tdme-07r', 'TDME 07R'], ['tdme-25l', 'TDME 25L'], ['tdme-25r', 'TDME 25R'],
  ['om-25r', 'OM 25R']
];
const LEMBAR_ML = [
  ['paneldist', 'Panel Distribusi'], ['sts', 'STS Tower'], ['ups', 'UPS'],
  ['chiller', 'Chiller & Pompa'], ['ahu', 'AHU'], ['genset', 'Genset'], ['grounding', 'Grounding']
];

export const SUMBER_BUKTI = {
  dstest: { paket: 'dstest', tgl: tglDs, saring: null, sebut: 'lembar DS Test' },
  'dailycheck-newjatsc': {
    paket: 'dcHistory', tgl: tglDc, sebut: 'lembar Daily Check New JATSC',
    saring: (x) => !x.Lokasi || x.Lokasi === 'new-jatsc'
  },
  'dailycheck-jatsc': {
    paket: 'dcHistory', tgl: tglDc, sebut: 'lembar Daily Check JATSC',
    saring: (x) => x.Lokasi === 'jatsc'
  },
  monitoring: { paket: 'monitoring', tgl: tglDs, saring: null, sebut: 'lembar Monitoring Frekuensi' },
  'bk-neptuno': bk('neptuno', 'lembar Cek Inspection Neptuno'),
  'bk-gatevox': bk('gatevox', 'lembar Change Over CPU Gatevox'),
  'bk-cleaning': bk('cleaning-cwp', 'lembar Cleaning CWP'),
  'bk-restart': bk('restart-cwp', 'lembar Restart CWP'),

  dailycheck: dc('', ''),
  'dc-pgm-ckg3': dc('ckg3', 'Radar CKG 3'),
  'dc-pgm-mer': dc('mer', 'Fasilitas Pengamatan'),
  'dc-fgk-toilet': dc('toilet', 'New JATSC'),
  'dc-fgk-jatsc': dc('jatsc', 'JATSC'),
  'dc-lk-sts': dc('sts', 'STS'),
  'dc-lk-mds': dc('mds', 'MDS'),
  'dc-lk-beban': dc('beban', 'Beban Listrik'),
  'dc-lk-ups': dc('ups', 'UPS'),
  'dc-amhs-amhs': dc('amhs', 'AMHS'),
  'dc-amhs-aadps': dc('aadps', 'AADPS'),
  'dc-amhs-datis': dc('d-atis', 'D-ATIS'),

  'pm-radio': pm('radio', '', '', 'Maintenance Radio'),
  'wk-ckg3': pm('pgmweekly', '__wForm', 'ckg3', 'Weekly Check Radar CKG 3'),
  'wk-smrt1': pm('pgmweekly', '__wForm', 'smrt1', 'Weekly Check SMR T1'),
  'wk-smrt3': pm('pgmweekly', '__wForm', 'smrt3', 'Weekly Check SMR T3'),
  ...Object.fromEntries(['07l', '07r', '25r', '25l'].map((k) =>
    ['gc-llz-' + k, pm('llzgc', '__llzForm', k, 'Ground Check LLZ ' + k.toUpperCase())])),
  ...Object.fromEntries(LEMBAR_MR.map(([k, nama]) =>
    ['mr-' + k, pm('mrreading', '__mrForm', k, 'Meter Reading ' + nama)])),
  ...Object.fromEntries(LEMBAR_ML.map(([k, nama]) =>
    ['ml-' + k, pm('maintlistrik', '__mlForm', k, 'Pemeliharaan ' + nama)]))
};

/** Larik lembar E-Logbook yang dibutuhkan untuk menjawab kegiatan-kegiatan ini. */
export const paketDibutuhkan = (kegiatan) =>
  [...new Set((kegiatan || []).map((k) => SUMBER_BUKTI[k?.sumber]?.paket).filter(Boolean))];

/* ---------- Tanggal dan periode: cermin bklKejadian / periodeKini ---------- */

/** Tanggal WIB sebuah saat, sebagai hari UTC-tengah-malam (untuk hitung hari). */
function hariWib(ms) {
  const d = new Date(ms + WIB_MS);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}
const isoDari = (t) => {
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${dua(d.getUTCMonth() + 1)}-${dua(d.getUTCDate())}`;
};

/** Minggu ISO dari hari UTC-tengah-malam — sama dengan pekanIso() dashboard. */
function pekanIso(t) {
  const d = new Date(t);
  const hari = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - hari);
  const awal = Date.UTC(d.getUTCFullYear(), 0, 1);
  const nomor = Math.ceil(((d - awal) / HARI_MS + 1) / 7);
  return `${d.getUTCFullYear()}-W${dua(nomor)}`;
}

function periode(jenis, t) {
  const d = new Date(t);
  const tahun = d.getUTCFullYear(), bulan = d.getUTCMonth();
  switch (jenis) {
    case 'harian': return isoDari(t);
    case 'mingguan': return pekanIso(t);
    case 'triwulan': return `${tahun}-Q${Math.floor(bulan / 3) + 1}`;
    case 'semesteran': return `${tahun}-S${Math.floor(bulan / 6) + 1}`;
    case 'tahunan': return String(tahun);
    default: return `${tahun}-${dua(bulan + 1)}`;
  }
}

function hariDaftar(k) {
  const m = Array.isArray(k.hari) ? k.hari : (k.hari == null ? [] : [k.hari]);
  const d = [...new Set(m.map(Number).filter((h) => Number.isInteger(h) && h >= 1 && h <= 7))];
  return d.length ? d.sort((a, b) => a - b) : [1];
}

/** Tanggal-tanggal kejadian satu kegiatan di periode yang memuat hari `t`. */
export function kejadian(k, t) {
  const d = new Date(t);
  const tahun = d.getUTCFullYear(), bulan = d.getUTCMonth();
  const tanggal = Math.min(28, Math.max(1, Number(k.tanggal) || 1));
  const ke = Math.max(1, Number(k.bulan) || 1) - 1;
  switch (k.jenis) {
    case 'harian': return [t];
    case 'bulanan': return [Date.UTC(tahun, bulan, tanggal)];
    case 'triwulan': return [Date.UTC(tahun, Math.floor(bulan / 3) * 3 + Math.min(2, ke), tanggal)];
    case 'semesteran': return [Date.UTC(tahun, Math.floor(bulan / 6) * 6 + Math.min(5, ke), tanggal)];
    case 'tahunan': return [Date.UTC(tahun, Math.min(11, ke), tanggal)];
  }
  const senin = t - ((d.getUTCDay() || 7) - 1) * HARI_MS;
  return hariDaftar(k).map((h) => senin + (h - 1) * HARI_MS);
}

/** Kunci catatan selesai — sama dengan bklKunciTgl() dashboard dan POST /berkala/selesai. */
export const kunciSelesai = (unit, k, tanggal, t) => (k.jenis === 'mingguan' || k.jenis === 'harian')
  ? `${unit}|${k.id}|${tanggal}`
  : `${unit}|${k.id}|${periode(k.jenis, t)}`;

/** Rombongan PS / M sebuah kunci SHIFT — cermin rombonganShift(). */
export const rombongan = (kunci) => {
  const s = SHIFT_MULAI[kunci];
  return !s || s.libur ? '' : s.malam ? 'M' : 'PS';
};

/** Gedung sebuah kunci SHIFT — cermin gedungShift(): 'jatsc', 'new-jatsc', atau ''. */
export const gedung = (kunci) => {
  const nama = (SHIFT_MULAI[kunci] || {}).nama || '';
  return /New JATSC/.test(nama) ? 'new-jatsc' : /JATSC/.test(nama) ? 'jatsc' : '';
};

/**
 * Kegiatan berkala satu unit yang harus dikerjakan orang yang berdinas dengan
 * kunci SHIFT `kunci`, pada saat `saatMs`.
 *
 *   kegiatan  daftar kegiatan unit itu (berkala.json[unit])
 *   selesai   berkala-selesai.json utuh
 *   bukti     { dcHistory:[…], dstest:[…], … } baris lembar E-Logbook unit itu
 *
 * → [{ k, tanggal, sisa, sebut }] — sisa 0 hari ini, negatif sudah lewat;
 *   diurut dari yang paling lama lewat.
 */
export function kegiatanUntukDinas({ unit, kunci, saatMs, kegiatan, selesai, bukti }) {
  const hari = hariWib(saatMs);
  const punya = rombongan(kunci);
  const gedungSaya = gedung(kunci);
  const keluar = [];
  for (const k of Array.isArray(kegiatan) ? kegiatan : []) {
    if (!k || !k.id) continue;
    const shift = k.shift === 'PS' || k.shift === 'M' ? k.shift : '';
    if (shift && punya && shift !== punya) continue;
    // Kegiatan yang menyebut Lokasi hanya untuk yang berdinas di gedung itu
    // (cermin gedungCocok dashboard); kode tanpa gedung tetap diingatkan.
    if (k.lokasi && gedungSaya && gedungSaya !== k.lokasi) continue;
    const sumber = SUMBER_BUKTI[k.sumber];
    for (const j of kejadian(k, hari)) {
      const sisa = Math.round((j - hari) / HARI_MS);
      if (sisa > 0) continue;
      const tanggal = isoDari(j);
      const sudah = sumber
        ? ((bukti || {})[sumber.paket] || []).some((x) => (!sumber.saring || sumber.saring(x)) && sumber.tgl(x) === tanggal)
        : !!(selesai || {})[kunciSelesai(unit, k, tanggal, hari)];
      if (sudah) continue;
      keluar.push({ k, tanggal, sisa, sebut: sumber ? sumber.sebut : '' });
    }
  }
  return keluar.sort((a, b) => a.sisa - b.sisa);
}

/** Kunci "sudah diingatkan" — sekali per orang per petak dinas. */
export const kunciPengingatBerkala = (petak, username) =>
  `berkala|${petak.tanggal}|${petak.unit}|${petak.kunci}|${String(username || '').toLowerCase()}`;
