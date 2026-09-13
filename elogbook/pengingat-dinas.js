/**
 * PENGINGAT DINAS — "satu jam lagi Anda masuk"
 *
 * Bagian yang bisa dihitung tanpa server: membaca jadwal dinas dashboard
 * (data/dinas.json), menentukan siapa masuk kapan, dan mencocokkan tiap petak
 * dengan akun E-Logbook. Tidak menyentuh database, tidak menyentuh Telegram —
 * server.js yang menyambungkan ketiganya (periksaPengingatDinas), sama seperti
 * pengingat TTD. Karena murni, seluruh aturannya bisa diuji dengan jadwal
 * buatan: lihat tools/uji-pengingat-dinas.mjs.
 *
 * BENTUK JADWALNYA, seperti yang ditulis modul Jadwal Dinas di dashboard:
 *
 *   { "2026-09": { "_diubah": {...},
 *                  "radtel": [ { nama, peran, nik, hari: [kode tgl 1, kode tgl 2, …] }, … ],
 *                  "ppabn":  [ … ] } }
 *
 * `hari[i]` adalah kode dinas tanggal i+1. Tulisannya tidak selalu bersih —
 * pengimpor sengaja menyimpan apa adanya kode yang tidak dikenalinya, jadi
 * "MJ (SPKL)" dan "C  U  T  I" benar-benar ada di jadwal. Pembakunya
 * (kodeBaku) dicerminkan dari public/js/02-kode-dinas.js milik dashboard.
 *
 * JAM MULAI dalam UTC, sama seperti lembar jadwalnya. PS dan Pagi mulai 00
 * (07 WIB), Siang 07 (14 WIB), Malam 12 (19 WIB) — kecuali kalau hari itu
 * dipecah P dan S: siangnya baru selesai pukul 13, malamnya ikut mundur ke 13
 * (20 WIB). Itu aturan `geser` di SHIFT dashboard, dan dicerminkan di sini.
 *
 * SUMBER ASLINYA tetap 02-kode-dinas.js. Tabel di bawah salinannya yang
 * dipangkas (hanya jam mulai dan tiga sifat). Ujinya memuat berkas asli itu
 * dan membandingkan keduanya kode demi kode — kalau ada yang menambah kode di
 * dashboard tanpa menambahkannya di sini, ujinya yang berteriak, bukan
 * teknisinya yang tidak diingatkan.
 */

/* Jam mulai UTC per kunci SHIFT, dengan sifat yang dipakai perhitungan:
   malam  — ikut mundur ke 13 kalau hari itu dipecah P/S
   geser  — kode yang memanjangkan hari (P/S dan turunannya)
   libur  — tidak berdinas: tidak diingatkan */
export const SHIFT_MULAI = {
  PSJ: { mulai: 0, nama: 'PS JATSC' },
  PSN: { mulai: 0, nama: 'PS New JATSC' },
  MJ:  { mulai: 12, nama: 'Malam JATSC', malam: true },
  MN:  { mulai: 12, nama: 'Malam New JATSC', malam: true },
  P:   { mulai: 0, nama: 'Pagi', geser: true },
  S:   { mulai: 7, nama: 'Siang', geser: true },
  PJ:  { mulai: 0, nama: 'Pagi JATSC', geser: true },
  PNJ: { mulai: 0, nama: 'Pagi New JATSC', geser: true },
  SJ:  { mulai: 7, nama: 'Siang JATSC', geser: true },
  SNJ: { mulai: 7, nama: 'Siang New JATSC', geser: true },
  PS:  { mulai: 0, nama: 'Pagi–Siang' },
  M:   { mulai: 12, nama: 'Malam', malam: true },
  Pagi:  { mulai: 0, nama: 'Pagi', geser: true },
  Siang: { mulai: 7, nama: 'Siang', geser: true },
  Malam: { mulai: 12, nama: 'Malam', malam: true },
  SPKLPSJ: { mulai: 0, nama: 'SPKL PS JATSC' },
  SPKLPSN: { mulai: 0, nama: 'SPKL PS New JATSC' },
  SPKLMJ:  { mulai: 12, nama: 'SPKL Malam JATSC', malam: true },
  SPKLMN:  { mulai: 12, nama: 'SPKL Malam New JATSC', malam: true },
  SPKLP:   { mulai: 0, nama: 'SPKL Pagi', geser: true },
  SPKLS:   { mulai: 7, nama: 'SPKL Siang', geser: true },
  SPKLPJ:  { mulai: 0, nama: 'SPKL Pagi JATSC', geser: true },
  SPKLPNJ: { mulai: 0, nama: 'SPKL Pagi New JATSC', geser: true },
  SPKLSJ:  { mulai: 7, nama: 'SPKL Siang JATSC', geser: true },
  SPKLSNJ: { mulai: 7, nama: 'SPKL Siang New JATSC', geser: true },
  CUTI: { mulai: 0, nama: 'Cuti Tahunan', libur: true },
  CAP:  { mulai: 0, nama: 'Cuti Alasan Penting', libur: true },
  IJIN: { mulai: 0, nama: 'Ijin', libur: true },
  DL:   { mulai: 0, nama: 'Dinas Luar', libur: true }
};

/* Cermin ALIAS_SHIFT di 02-kode-dinas.js. */
const ALIAS = {
  PAGI: 'Pagi', SIANG: 'Siang', MALAM: 'Malam',
  CT: 'CUTI', CUTITAHUNAN: 'CUTI',
  CUTIALASANPENTING: 'CAP', SAKIT: 'CAP',
  IZIN: 'IJIN', DINASLUAR: 'DL'
};

/* SHIFT_MULAI berkunci campuran ('Pagi', 'PSJ'); pembaku bekerja dengan huruf
   besar semua, jadi dicari lewat peta huruf besar → kunci aslinya. */
const KUNCI_BESAR = Object.fromEntries(Object.keys(SHIFT_MULAI).map((k) => [k.toUpperCase(), k]));

/** Kunci SHIFT_MULAI untuk satu tulisan kode jadwal, atau '' kalau tak dikenal.
    Aturannya sama persis dengan kodeBaku() dashboard. */
export function kodeBaku(kode) {
  const huruf = String(kode == null ? '' : kode).toUpperCase().replace(/[^A-Z]/g, '');
  if (!huruf) return '';
  if (KUNCI_BESAR[huruf]) return KUNCI_BESAR[huruf];
  if (ALIAS[huruf]) return ALIAS[huruf];
  const tanpa = huruf.replace('SPKL', '');
  if (tanpa !== huruf && tanpa) {
    const dasar = KUNCI_BESAR[tanpa] || ALIAS[tanpa] || '';
    if (dasar) return KUNCI_BESAR['SPKL' + dasar.toUpperCase()] || dasar;
  }
  return '';
}

/** Jam mulai UTC satu kunci, mengingat kode lain yang dipakai unit itu hari itu. */
export function jamMulai(kunci, kunciHari) {
  const s = SHIFT_MULAI[kunci];
  if (!s) return NaN;
  const mundur = s.malam && (kunciHari || []).some((k) => SHIFT_MULAI[k] && SHIFT_MULAI[k].geser);
  return mundur ? 13 : s.mulai;
}

const dua = (n) => String(n).padStart(2, '0');
const bulanDari = (d) => `${d.getUTCFullYear()}-${dua(d.getUTCMonth() + 1)}`;
const tanggalDari = (d) => `${bulanDari(d)}-${dua(d.getUTCDate())}`;

/**
 * Seluruh petak dinas yang MULAI dalam rentang [dariMs, sampaiMs), dari jadwal
 * utuh. Satu baris per orang per petak:
 *   { unit, nama, nik, kode, kunci, namaShift, tanggal, mulaiMs }
 *
 * Yang dilewati: petak kosong, kode libur, dan kode yang tidak dikenal —
 * kode asing tidak punya jam, jadi tidak ada "satu jam sebelumnya" untuknya.
 * (Beda dari lonceng berkala di dashboard yang menganggap kode asing berdinas:
 * di sana tanpa jam pun masih ada gunanya, di sini tidak.)
 *
 * Rentangnya dipakai supaya pemanggil hanya melihat hari yang relevan: hari ini
 * dan besok menurut UTC sudah cukup untuk pengingat sejam sebelumnya, karena
 * dinas paling pagi mulai 00 UTC — pengingatnya 23 UTC hari sebelumnya.
 */
export function dinasDalamRentang(jadwal, dariMs, sampaiMs) {
  const keluar = [];
  if (!jadwal || typeof jadwal !== 'object') return keluar;
  // Hari-hari UTC yang menyentuh rentang, dari sehari sebelum `dari` supaya
  // Malam yang mulainya siang UTC tetap terlihat.
  const hari = [];
  for (let t = dariMs - 86400000; t < sampaiMs + 86400000; t += 86400000) {
    const d = new Date(t);
    const tgl = tanggalDari(d);
    if (!hari.includes(tgl)) hari.push(tgl);
  }
  for (const tanggal of hari) {
    const [y, m, d] = tanggal.split('-').map(Number);
    const bulan = jadwal[`${y}-${dua(m)}`];
    if (!bulan || typeof bulan !== 'object') continue;
    for (const [unit, baris] of Object.entries(bulan)) {
      if (unit.startsWith('_') || !Array.isArray(baris)) continue;
      // Semua kunci yang dipakai unit ini pada tanggal itu — untuk aturan geser.
      const kunciHari = [];
      const petak = [];
      for (const o of baris) {
        const kode = Array.isArray(o?.hari) ? o.hari[d - 1] : '';
        if (!String(kode == null ? '' : kode).trim()) continue;
        const kunci = kodeBaku(kode);
        if (!kunci || SHIFT_MULAI[kunci].libur) continue;
        kunciHari.push(kunci);
        petak.push({ o, kode: String(kode).trim(), kunci });
      }
      for (const { o, kode, kunci } of petak) {
        const jam = jamMulai(kunci, kunciHari);
        const mulaiMs = Date.UTC(y, m - 1, d, jam);
        if (mulaiMs < dariMs || mulaiMs >= sampaiMs) continue;
        keluar.push({
          unit, nama: String(o.nama || '').trim(), nik: String(o.nik || '').trim(),
          kode, kunci, namaShift: SHIFT_MULAI[kunci].nama, tanggal, mulaiMs
        });
      }
    }
  }
  return keluar;
}

/**
 * Username akun untuk satu petak, dari daftar akun aktif [{username, nama}].
 *
 * Urutannya: NIK dulu — username akun memang NIK-nya, dan itu satu-satunya
 * kunci yang tidak bergantung pada ejaan. Kalau NIK-nya kosong (jadwal Agustus
 * dan Oktober 2026 diimpor tanpa kolom itu), nama yang dicoba: cocok persis
 * dulu, lalu longgar dengan aturan yang sama dengan namaSaya() di dashboard
 * (satu memuat yang lain, lebih dari tiga huruf). Yang longgar hanya diterima
 * kalau kenanya TEPAT SATU akun — dua kandidat berarti tidak yakin, dan pesan
 * ke orang yang salah lebih buruk daripada tidak ada pesan.
 */
export function usernameUntukPetak(petak, akunAktif) {
  const daftar = Array.isArray(akunAktif) ? akunAktif : [];
  const nik = String(petak?.nik || '').trim().toLowerCase();
  if (nik) {
    const a = daftar.find((x) => String(x.username || '').toLowerCase() === nik);
    if (a) return a.username;
  }
  const nama = String(petak?.nama || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!nama) return '';
  // Kolom nama yang diisi username-nya langsung (akun uji, atau orang yang
  // menulis NIK-nya di kolom nama) — sama seperti namaSaya() dashboard yang
  // juga membandingkan dengan akun.user.
  const sebagaiUser = daftar.find((x) => String(x.username || '').toLowerCase() === nama);
  if (sebagaiUser) return sebagaiUser.username;
  const persis = daftar.filter((x) => String(x.nama || '').trim().toLowerCase().replace(/\s+/g, ' ') === nama);
  if (persis.length === 1) return persis[0].username;
  if (persis.length > 1) return '';
  if (nama.length <= 3) return '';
  const longgar = daftar.filter((x) => {
    const n = String(x.nama || '').trim().toLowerCase().replace(/\s+/g, ' ');
    return n.length > 3 && (n.includes(nama) || nama.includes(n));
  });
  return longgar.length === 1 ? longgar[0].username : '';
}

/** Kunci "sudah diingatkan" satu petak untuk satu akun — sekali per orang per dinas. */
export const kunciPengingat = (petak, username) =>
  `${petak.tanggal}|${petak.unit}|${petak.kunci}|${String(username || '').toLowerCase()}`;

/** "07:00 WIB" dari milidetik epoch. */
export const jamWib = (ms) => {
  const d = new Date(ms + 7 * 3600 * 1000);
  return `${dua(d.getUTCHours())}:${dua(d.getUTCMinutes())} WIB`;
};

const HARI_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/** "Sabtu, 13 September 2026" menurut WIB, dari milidetik epoch. */
export function tanggalWib(ms) {
  const d = new Date(ms + 7 * 3600 * 1000);
  return `${HARI_ID[d.getUTCDay()]}, ${d.getUTCDate()} ${BULAN_ID[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
