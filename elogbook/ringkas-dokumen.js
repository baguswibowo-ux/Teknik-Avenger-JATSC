/**
 * E-LOGBOOK — RINGKASAN DOKUMEN UNTUK NOTIFIKASI
 *
 * Dari satu baris database (kolom snake_case, dibaca ringkasCatatan di db.js /
 * db-pg.js) menyusun dua hal untuk pesan Telegram:
 *   judul    — jenis lembar yang sebenarnya, berikut lokasinya kalau ada
 *              ("Logbook — New JATSC"). Tabel dstest menampung sebelas lembar
 *              berbeda, dari DS Test Domestik sampai Maintenance Radio;
 *              penerima perlu tahu yang mana.
 *   cuplikan — kepala perihalnya saja, sekitar PANJANG karakter dipotong di
 *              batas kata: "CPU B Gatevox 5 kembali restart dan up kembali…".
 *              Cukup untuk mengenali dokumen mana tanpa membukanya; isi
 *              lengkapnya tetap di E-Logbook.
 *
 * Kolom yang dibaca per jenis ditentukan di sini juga (KOLOM_RINGKAS),
 * berdampingan dengan kode yang memakainya. Murni — tanpa database — jadi bisa
 * diuji langsung. Pengamanan HTML dikerjakan telegram.js saat menyusun pesan.
 */

/** Nama jenis dokumen, dipakai juga kalau ringkasan tidak bisa dibaca. */
export const NAMA_DOKUMEN = {
  logbook: 'Logbook', dailycheck: 'Daily Check', monitoring: 'Monitoring',
  dstest: 'DS Test', berkala: 'Pemeliharaan Berkala',
  ltk: 'Laporan Kerusakan (LTK)', bapb: 'BAPB'
};

/** Kolom perihal per jenis — dibaca ringkasCatatan. */
export const KOLOM_RINGKAS = {
  logbook: 'uraian, lokasi',
  dailycheck: 'remark, fails_json, warns_json',
  monitoring: 'baris_json',
  dstest: 'kategori',
  berkala: 'jenis, catatan',
  ltk: 'peralatan, modul, analisa',
  bapb: 'nomor, untuk_pekerjaan, lokasi'
};

/* Lembar yang menumpang tabel dstest — cermin catatan di insertDsTest (db.js)
   dan label dsKat_* di public/js/02-bahasa.js. */
const LEMBAR_DSTEST = {
  radio: 'Maintenance Radio',
  pgmweekly: 'Weekly Check Pengamatan',
  llzgc: 'Ground Check LLZ',
  mrreading: 'Meter Reading ILS',
  maintlistrik: 'Pemeliharaan Listrik & Mekanik',
  mrradkom: 'Meter Reading Radkom',
  sampling: 'DS Test Sampling',
  domestik: 'DS Test Domestik',
  internasional: 'DS Test Internasional',
  'sli-gsm': 'DS Test SLI & GSM',
  pabx: 'DS Test PABX'
};

/* Jenis pemeliharaan berkala (preventive) — cermin bkJenis_* di 02-bahasa.js. */
const JENIS_BERKALA = {
  neptuno: 'Cek Inspection Neptuno',
  gatevox: 'Change Over CPU Gatevox',
  'cleaning-cwp': 'Cleaning CWP',
  'restart-cwp': 'Restart CWP'
};

export const PANJANG = 50;

/** Rapatkan spasi/baris baru, lalu ambil kepalanya: dipotong di batas kata,
    tanda baca di ujung potongan dibuang, diberi elipsis. Satu kata yang
    sangat panjang (tanpa spasi dekat batas) dipotong apa adanya. */
export function potong(teks, maks = PANJANG) {
  const t = String(teks ?? '').replace(/\s+/g, ' ').trim();
  if (t.length <= maks) return t;
  const kepala = t.slice(0, maks);
  const spasi = kepala.lastIndexOf(' ');
  const dasar = spasi > maks * 0.5 ? kepala.slice(0, spasi) : kepala.slice(0, maks - 1);
  return dasar.replace(/[\s,.;:·\-–—]+$/, '') + '…';
}

/** JSON larik dari kolom teks; apa pun yang rusak dianggap kosong. */
function larik(json) {
  try {
    const v = JSON.parse(json || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

const gabung = (...bagian) => bagian.map((b) => String(b ?? '').trim()).filter(Boolean).join(' · ');
const denganLokasi = (judul, lokasi) => (String(lokasi || '').trim() ? `${judul} — ${String(lokasi).trim()}` : judul);

/** { judul, cuplikan } untuk satu catatan. cuplikan boleh kosong. */
export function ringkasDokumen(jenis, row) {
  const r = row || {};
  switch (jenis) {
    case 'logbook':
      return { judul: denganLokasi(NAMA_DOKUMEN.logbook, r.lokasi), cuplikan: potong(r.uraian) };

    case 'dailycheck': {
      const gagal = larik(r.fails_json).map(String);
      const awas = larik(r.warns_json);
      const status = gagal.length
        ? `${gagal.length} item gagal: ${gagal.slice(0, 3).join(', ')}${gagal.length > 3 ? ', …' : ''}`
        : awas.length ? `${awas.length} item perlu perhatian` : 'Semua item normal';
      return { judul: NAMA_DOKUMEN.dailycheck, cuplikan: potong(gabung(status, r.remark)) };
    }

    case 'monitoring': {
      const baris = larik(r.baris_json);
      const sektor = [...new Set(baris.map((b) => b && b.sector).filter(Boolean))].slice(0, 3).join(', ');
      return {
        judul: NAMA_DOKUMEN.monitoring,
        cuplikan: baris.length ? potong(`${baris.length} baris pemantauan${sektor ? ' · sektor ' + sektor : ''}`) : ''
      };
    }

    case 'dstest':
      return {
        judul: LEMBAR_DSTEST[r.kategori] || (r.kategori ? `${NAMA_DOKUMEN.dstest} ${r.kategori}` : NAMA_DOKUMEN.dstest),
        cuplikan: ''
      };

    case 'berkala':
      return {
        judul: NAMA_DOKUMEN.berkala + (JENIS_BERKALA[r.jenis] ? ` — ${JENIS_BERKALA[r.jenis]}` : ''),
        cuplikan: potong(r.catatan)
      };

    case 'ltk':
      return { judul: NAMA_DOKUMEN.ltk, cuplikan: potong(gabung(r.peralatan, r.modul, r.analisa)) };

    case 'bapb':
      return {
        judul: denganLokasi(NAMA_DOKUMEN.bapb + (r.nomor ? ` No. ${r.nomor}` : ''), r.lokasi),
        cuplikan: potong(r.untuk_pekerjaan)
      };

    default:
      return { judul: NAMA_DOKUMEN[jenis] || 'Dokumen', cuplikan: '' };
  }
}
