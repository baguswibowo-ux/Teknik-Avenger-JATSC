/**
 * E-LOGBOOK NEW JATSC — DAFTAR SITE DS TEST
 *
 * Sumbernya lembar "Alokasi Komunikasi New JATSC.xlsx" (16 Agustus 2026).
 * Dari lima blok di lembar itu, yang dipakai empat: DS DOMESTIC (34 baris),
 * DS INTERNASIONAL (25), SLI & GSM (4), dan PABX (9). Blok KOMUNIKASI GND TO
 * GND tidak dipakai di formulir ini. Tiap baris dinilai INCOMING dan OUTGOING.
 *
 * Daftar ini dipakai db.js (SQLite, server kantor) dan db-pg.js (Postgres,
 * Vercel) sekaligus — dulu keduanya menyimpan salinannya sendiri dan sudah
 * mulai berbeda dari lembar aslinya. Menambah site cukup di berkas ini.
 *
 * Selain DOMESTIC, blok-blok itu di lembar aslinya cuma punya kolom NO dan
 * CODE, tanpa SITE. Barisnya ditulis dengan site kosong, dan formulirnya
 * menyembunyikan kolom SITE untuk kategori yang seluruh site-nya kosong.
 *
 * `alias` berisi kode lama yang pernah dipakai untuk baris yang sama. Catatan
 * DS Test menyimpan hasilnya berkunci kode, jadi tanpa alias hasil lama akan
 * terbaca kosong (dan tampil ✓) begitu kodenya diperbaiki.
 */

/** Blok DS DOMESTIC NEW JATSC — 34 site, dengan kolom SITE. */
const DOMESTIK = [
  { no: 1,  site: 'CURUG',          code: 'BDT' },
  { no: 2,  site: 'HALIM',          code: 'HLM PK' },
  { no: 3,  site: 'HALIM',          code: 'HLM FIC' },
  { no: 4,  site: 'KERTAJATI',      code: 'KTJ FSS' },
  { no: 5,  site: 'KERTAJATI',      code: 'KTJ TMA' },
  { no: 6,  site: 'KERTAJATI',      code: 'KTJ UJOG' },
  { no: 7,  site: 'BANDUNG',        code: 'BDO' },
  { no: 8,  site: 'YOGYAKARTA',     code: 'JOG' },
  { no: 9,  site: 'SEMARANG',       code: 'SRG' },
  { no: 10, site: 'CILACAP',        code: 'CILACAP' },
  { no: 11, site: 'MADIUN',         code: 'IWY' },
  { no: 12, site: 'PONTIANAK',      code: 'PNK 2' },
  { no: 13, site: 'PONTIANAK',      code: 'PNK APP' },
  { no: 14, site: 'PONTIANAK',      code: 'PNK FIC',  alias: ['PNK 3'] },
  { no: 15, site: 'PONTIANAK',      code: 'PNK TMA' },
  { no: 16, site: 'PEKANBARU',      code: 'PKU WEST' },
  { no: 17, site: 'PEKANBARU',      code: 'PKU EAST' },
  { no: 18, site: 'BATAM',          code: 'BTH' },
  { no: 19, site: 'PALEMBANG',      code: 'PLB APP' },
  { no: 20, site: 'PALEMBANG',      code: 'PLB PKP' },
  { no: 21, site: 'MEDAN',          code: 'MDN FIC',  alias: ['MDN 2'] },
  { no: 22, site: 'MEDAN',          code: 'MDN TMA' },
  { no: 23, site: 'PANGKAL PINANG', code: 'PGK TWR',  alias: ['PGK'] },
  { no: 24, site: 'TANJUNG PINANG', code: 'TNJ NORTH' },
  { no: 25, site: 'TANJUNG PINANG', code: 'TNJ SOUTH' },
  { no: 26, site: 'BANDA ACEH',     code: 'BTJ' },
  { no: 27, site: 'MATSC',          code: 'UPG US' },
  { no: 28, site: 'MATSC',          code: 'UPG UK' },
  { no: 29, site: 'MATSC',          code: 'UPG RUPKA' },
  { no: 30, site: 'PANGKALAN BUN',  code: 'PK BUN' },
  { no: 31, site: 'SURABAYA',       code: 'SUB' },
  { no: 32, site: 'BANDAR LAMPUNG', code: 'TKG' },
  { no: 33, site: 'TANJUNG PANDAN', code: 'TJQ' },
  { no: 34, site: 'JAMBI',          code: 'DJB' }
];

/** Blok DS INTERNASIONAL NEW JATSC — 25 sambungan, hanya kolom CODE. */
const INTERNASIONAL = [
  'CHENNAI CRV', 'BNE KIY', 'KBL VPN', 'KBL CRV', 'KCH 1 VPN', 'KCH CRV',
  'KUL ANSAX', 'KUL PUGER', 'KUL SALAX', 'MLB 1 POSOD', 'MLB 2 SAPDA',
  'SZB 1 VPN', 'SIN 5C LUSMO', 'SIN 5P LUSMO', 'SIN 6P ELGOR', 'SIN 6C ELGOR',
  'SIN 6P OSERU', 'SIN 1-4C TOMAN', 'SIN 1-4P TOMAN', 'SIN 1C PARDI',
  'SIN 1P PARDI', 'SIN 2P TAROS', 'SIN TAROS RDR', 'SIN RADIO', 'SIN TAROS CRV'
];

/** Blok SLI & GSM — 4 saluran. */
const SLI_GSM = ['SLI UM', 'SLI UK', 'SLI MWARA', 'GSM'];

/** Blok PABX — 9 ekstensi. */
const PABX = [
  'SLI ARO 6110', 'SLI FIC 6188', 'SLI FDO 6123', 'SLI NOTOF',
  '6165', '6129', '6176', '6103', '5044'
];

/** Blok tanpa kolom SITE: kodenya jadi baris bernomor, site dibiarkan kosong. */
const dariKode = (daftar) => daftar.map((code, i) => ({ no: i + 1, site: '', code }));

/** Blok SAMPLING JATSC — 95 channel (64 Domestik + 31 Internasional) mengikuti
    workbook "Checklist Pengecekan DS" (sheet DATABASE DS). Dipakai form DS Test
    yang baru — sampling 9 sesi selang-seling sesuai lembar fisiknya. */
const SAMPLING_DOM = [
  'ATANG SJY','BTH','BTJ','CILA CAP','HLM PK','JOG','MDN FIC','MDN TMA',
  'PGK TWR','PK.BUN','PKU EAST','PKU WEST','SRG','SUB','TASIK MALAYA','TJQ',
  'UPG RUPKA','UPG UK','UPG US','KALI JATI','KTJ FSS','KTJ TMA','KTJ UJOG',
  'PKU 4','PNK 2','PNK APP','PNK FIC','HLM FIC','PK UTARA','SPV TWR JATSC',
  'SLI UM','SLI UK','SLI MWARA','BDO','BDT','CD1 JATSC','CD2 JATSC',
  'GND1 JATSC','GND2 JATSC','PLB APP','PLB PKP','PNK TMA','TKG',
  'TNJ NORTH','TNJ SOUTH','TWR1 JATSC','TWR2 JATSC','JKCN','JKTS','JKTE',
  'JKTW','6165','SLI 6176','SLI 6129','CD-TWR','6103','ARO_JATSC','6187',
  '5044','NOTOF','GSM','SLI ARO 6110','SLI FIC 6188','SLI FDO 6123'
];
const SAMPLING_INTL = [
  'KUL ANSAX CRV','KUL PUGER CRV','KUL SALAX MDN','KUL SALAX PKU',
  'SIN 5C LUSMO','SIN 5P LUSMO','SIN 6P ELGOR','SIN 6P OSERU',
  'SIN 6C ELGOR','KBL OKADA','KCH AOBA','KCH PAPSA','BNE KIY',
  'CHENNAI CRV','KBL VPN','KUL ANSAX','KUL PUGER','KUL SALAX',
  'MLB1 POSOD','MLB2 SAPDA','SIN1-4C TOMAN','SIN1-4P TOMAN',
  'SIN1C PARDI','SIN1P PARDI','SIN2P TAROS','SIN TAROS CRV',
  'KBL CRV','KCH 1 VPN','KCH CRV','SIN RADIO','SZB 1 VPN'
];
const SAMPLING = [
  ...SAMPLING_DOM.map(code => ({ code, kat:'Domestik' })),
  ...SAMPLING_INTL.map(code => ({ code, kat:'Internasional' }))
].map((x, i) => ({ no: i + 1, site: '', code: x.code, kat: x.kat }));

export const DS_SITE = {
  sampling:      SAMPLING,
  domestik:      DOMESTIK,
  internasional: dariKode(INTERNASIONAL),
  'sli-gsm':     dariKode(SLI_GSM),
  pabx:          dariKode(PABX)
};

export const KATEGORI_DS = Object.keys(DS_SITE);
export const kategoriDsSah = (k) => KATEGORI_DS.includes(k);
export const dsSiteUntuk = (kategori) => DS_SITE[kategori] || [];
