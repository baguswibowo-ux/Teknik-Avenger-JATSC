/**
 * SELISIH DAFTAR — untuk kolom rincian log aktivitas
 *
 * Jadwal dinas, kegiatan berkala, personel, peralatan, sparepart, dan ISR
 * semuanya disimpan dengan cara yang sama: halaman mengirim daftarnya UTUH.
 * Akibatnya log hanya bisa bilang "42 baris disimpan" — tidak ada yang tahu
 * baris mana yang baru, mana yang dibuang, mana yang disunting.
 *
 * Di sini daftar sebelum dan sesudah dibandingkan per kunci (biasanya id).
 * Yang keluar hanya LABEL barisnya (nama alat, nama orang) — bukan isinya.
 * Log aktivitas tidak boleh jadi salinan kedua dari data yang dicatatnya,
 * dan nomor lisensi personel tidak boleh bocor lewat sini.
 *
 * Murni, tanpa berkas atau jaringan — bisa diuji langsung.
 */

/**
 * { tambah: [label], hapus: [label], ubah: [label] }
 *
 * Baris dianggap berubah kalau bentuk JSON-nya berbeda. Pemanggil sebaiknya
 * merapikan daftar LAMA lewat fungsi rapikan yang sama dengan daftar baru,
 * supaya data lama yang tersimpan dengan bentuk versi terdahulu tidak
 * seluruhnya terbaca "diubah".
 */
export function selisihDaftar(lama, baru, { kunci = (x) => x?.id, label = (x) => x?.nama } = {}) {
  const namaDari = (x) => String(label(x) ?? '').trim() || '(tanpa nama)';
  const petaLama = new Map();
  for (const x of Array.isArray(lama) ? lama : []) {
    const k = String(kunci(x) ?? '');
    if (k) petaLama.set(k, x);
  }
  const tambah = [], ubah = [], hapus = [];
  const dilihat = new Set();
  for (const x of Array.isArray(baru) ? baru : []) {
    const k = String(kunci(x) ?? '');
    dilihat.add(k);
    const l = k ? petaLama.get(k) : undefined;
    if (!l) tambah.push(namaDari(x));
    else if (JSON.stringify(l) !== JSON.stringify(x)) ubah.push(namaDari(x));
  }
  for (const [k, x] of petaLama) if (!dilihat.has(k)) hapus.push(namaDari(x));
  return { tambah, ubah, hapus };
}

export const adaSelisih = (s) => !!s && (s.tambah.length + s.ubah.length + s.hapus.length) > 0;

/** Satu kata aksi untuk log: tambah/hapus/ubah kalau hanya satu macam
    perubahan, simpan kalau campuran, null kalau tidak ada yang berubah. */
export function aksiSelisih(s) {
  if (!adaSelisih(s)) return null;
  const macam = [s.tambah, s.ubah, s.hapus].filter((x) => x.length).length;
  if (macam > 1) return 'simpan';
  return s.tambah.length ? 'tambah' : s.hapus.length ? 'hapus' : 'ubah';
}

const potongDaftar = (xs, maks) =>
  xs.length <= maks ? xs.join(', ') : `${xs.slice(0, maks).join(', ')} +${xs.length - maks} lagi`;

/** "+ Budi, Andi · − Cici · diubah: Dedi" — kosong kalau tidak ada selisih. */
export function ringkasSelisih(s, maks = 6) {
  if (!adaSelisih(s)) return '';
  return [
    s.tambah.length ? `+ ${potongDaftar(s.tambah, maks)}` : '',
    s.hapus.length ? `− ${potongDaftar(s.hapus, maks)}` : '',
    s.ubah.length ? `diubah: ${potongDaftar(s.ubah, maks)}` : ''
  ].filter(Boolean).join(' · ');
}
