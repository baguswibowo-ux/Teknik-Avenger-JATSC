# Catatan untuk Tim — yang perlu dikoreksi

Status per 20 Agustus 2026 · branch `utama`

Berkas ini tempat mengumpulkan koreksi. Kalau menemukan sesuatu yang salah,
kurang, atau berbeda dari kenyataan di lapangan, **tambahkan barisnya di bagian
[Temuan tim](#temuan-tim)** lalu commit — atau buka issue di GitHub kalau lebih
enak. Yang penting jangan berhenti di chat.

Ringkasan lengkap keadaan aplikasi ada di [`RINGKASAN.md`](RINGKASAN.md).
Resep deploy dan jebakannya ada di [`../DEPLOY.md`](../DEPLOY.md).

---

## Keadaan yang sedang berjalan

| Di mana | Keadaan |
| --- | --- |
| Laptop | pohon kerja bersih |
| GitHub · `origin/utama` | sejajar dengan laptop |
| Avenger · produksi | menjalankan commit yang sama |
| E-Logbook · produksi | Ready sejak 20 Agu 06:50 UTC |

Nomor commit yang sedang berjalan dilihat dengan `git log --oneline -1`; menuliskannya
di sini hanya membuat berkas ini basi satu hari sesudah dibuat.

## Yang baru berubah, supaya tidak salah paham saat memeriksa

**E-Logbook tidak lagi punya alamat sendiri bagi peramban.** Ia disajikan lewat
dashboard di `/logbook/` — satu asal, satu cookie, satu sesi. Peran dan unit yang
berlaku di dashboard adalah yang berlaku juga di dalam E-Logbook.

Sebelumnya dua host berarti dua toples cookie: teknisi yang di dashboard cuma
pegang satu unit bisa mendarat di E-Logbook memakai sesi lama yang tertinggal di
sana dan membuka seluruh unit. Yang lebih berbahaya, penulis catatan diambil dari
sesi — selama tab itu memakai sesi orang lain, catatan tercatat atas nama orang
itu. Salah catat pada dokumen operasional, bukan sekadar salah tampil.

Tiga pelengkapnya:

- **Pintu belakang ditutup.** Permintaan halaman yang datang langsung ke alamat
  E-Logbook dipantulkan ke `/logbook/`. Hanya halaman — `/api/` dan aset tetap
  lewat.
- **Keluar punya arah.** Keluar di dalam E-Logbook mengantar ke layar masuk
  dashboard, bukan ke layar masuk kedua.
- **Cookie sesi ber-`Secure`.** Hanya lewat HTTPS.

> **Yang paling rapuh dan perlu diawasi:** aset E-Logbook dipanggil secara
> **relatif**, itu sebabnya di `/logbook/` semuanya jatuh ke `/logbook/css/…`
> tanpa menyentuh `/css/` milik dashboard. Kalau suatu saat ada aset yang ditulis
> dengan jalur mutlak, pintu ini yang pertama patah — dan patahnya terlihat
> sebagai halaman E-Logbook berkulit dashboard, bukan sebagai galat.

## Yang paling perlu dicoba lebih dulu

**Melampirkan bukti sertifikat saat menambah personel baru.** Sejak 20 Agustus
2026, berkas bisa dipilih sejak dialog Tambah personel — ia ditahan di kartu
sebagai cip miring, lalu berangkat sendiri tepat sesudah Simpan berhasil. Batal
membuangnya tanpa menyisakan apa pun di server.

Jalur ini baru dan **belum pernah dijalankan sungguhan oleh siapa pun**. Yang
perlu dipastikan: tambah orang → lampirkan satu PDF → Simpan → buka lagi
orangnya, dan PDF-nya sudah jadi tautan yang bisa dibuka. Kalau tidak, catat di
Temuan tim.

Batasnya 25 MB per berkas. Jenis yang diterima: PDF, Word, Excel, PowerPoint,
OpenDocument, gambar, arsip, DWG/DXF.

## Pemeriksaan produksi yang sudah hijau

Dijalankan pada 20 Agustus 2026 sesudah deploy terakhir. Kalau tim menemukan
salah satunya tidak lagi benar, itu regresi — catat di Temuan tim.

| Yang diperiksa | Jawaban |
| --- | --- |
| dashboard `/` | 200 |
| tombol Buka E-Logbook menunjuk | `/logbook/` |
| `/logbook` tanpa garis miring | 302 → `/logbook/` |
| `/logbook/` halaman E-Logbook | E-Logbook — New JATSC |
| aset E-Logbook di bawah `/logbook/` | 200 |
| aset dashboard tidak tertimpa | 200 |
| bendera pintu — lewat `/logbook/` | `true` |
| bendera pintu — langsung | `false` |
| pintu belakang dipantulkan | 302 → `/logbook/` |
| `/api` tidak ikut dipantulkan | 401 |
| basis data tidak ikut naik | 404 |

Pagar unit, diuji dengan akun teknisi satu unit (`radtel`):

| Percobaan | Hasil |
| --- | --- |
| `getAllData` tanpa unit | mendarat di `radtel` |
| `getAllData` memaksa `radkom` | tetap dijawab `radtel` |
| `getAllData` unit karangan `../admin` | tetap dijawab `radtel` |
| `addEntry` ke `radkom` | ditolak |
| daftar akun di jawabannya | kosong |

## Environment variable yang berubah

| | Proyek | Variabel | Kenapa |
| --- | --- | --- | --- |
| + | E-Logbook | `ELOGBOOK_SECURE_COOKIE` | cookie sesi hanya lewat HTTPS |
| + | E-Logbook | `ELOGBOOK_PINTU` | pintu masuk sah, tujuan pantulan |
| − | Avenger | `ELOGBOOK_TAUTAN` | kalau ada, ia menang atas bawaan `/logbook/` dan mengembalikan sesi yang terbelah |
| − | Avenger | `DATA_CONTOH` | fiturnya sudah dicabut, tidak ada lagi yang membacanya |

---

## Yang tersisa

Perlu tindakan orang, bukan kode.

- [ ] **Production Branch → `utama` di kedua proyek Vercel**, lewat Settings → Git.
      Tidak bisa lewat CLI. Selama belum, push hanya menghasilkan preview dan
      produksi selalu perlu `vercel --prod`.
- [ ] **Alamat `e-log-book-server.vercel.app` berhenti diedarkan.** Jalan masuk
      lewat peramban sudah tertutup, tapi alamatnya masih hidup — jangan lagi
      dibagikan ke pengguna.

Menunggu, belum menghalangi apa pun.

- [ ] **`avenger-teknik.com` belum dipakai.** Kalau nanti dipasang, ia
      *menggantikan* pintu tunggal, bukan menambahinya. Apex-nya masih terdaftar
      di proyek E-Logbook — perlu dirapikan sebelum DNS diarahkan.
- [ ] **Lampiran E-Logbook masih kena batas unggah 4,5 MB.** Polanya tinggal
      ditiru dari jalur dokumen yang sudah jalan.
- [ ] **Simpanan kantor dan Supabase masih berpisah.** Jalankan
      `node tools/naikkan.js --gas --timpa` sebelum orang beralih.
- [ ] **`elogbook/elogbook_schema.sql` masih 0 byte.** Tidak dipakai saat runtime.

---

## Temuan tim

Tambahkan baris di bawah ini. Isi tanggal, siapa yang menemukan, dan apa yang
dilihat — sedapat mungkin dengan langkah untuk mengulanginya.

| Tanggal | Penemu | Di mana | Yang dilihat | Status |
| --- | --- | --- | --- | --- |
| | | | | |
