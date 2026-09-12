# Status 13 September 2026 — Kartu bergantian, halaman ringan, refresh seketika

Catatan serah terima untuk chat baru. Sesi Claude terikat ke folder
`D:\Airnav\2026\Teknik JATSC Avenger`; berkas inilah konteksnya. Lanjutan dari
[STATUS-12-SEP-2026.md](STATUS-12-SEP-2026.md) dan
[STATUS-12-SEP-2026-BERKALA.md](STATUS-12-SEP-2026-BERKALA.md).

## Ringkas

Dua pekerjaan dalam satu malam, yang kedua lahir dari yang pertama.

1. **Cincin 3D berputar di beranda dilepas.** Delapan kartu unit kini tampil
   **satu per satu di depan**, berganti sendiri tiap 5 detik, dengan panah,
   titik giliran, dan Jeda. Yang belum giliran tidak ada di layar. Bagus
   memilih bentuk ini dari halaman contoh interaktif (tautan di bawah).
2. **"Halaman gantung / berat pas refresh."** Mulanya dicurigai kartu baru;
   pengukuran membuktikan bukan. Sebabnya bertumpuk di **jalur keluar** PC
   produksi — tunnel Cloudflare ~1,6 Mbps dan tidak stabil — dan tiga pola
   yang memboroskan jalur itu: Cloudflare tidak menyimpan apa pun, 55
   permintaan per halaman, dan JSON dinamis dikirim mentah. Semuanya
   dibereskan; hasilnya di tabel bawah.

Enam commit hari ini di `feature/avengers-login-visual`. Bagus akan `git push`
sendiri (cabang **34 commit di depan origin** sebelum push, termasuk seluruh
pekerjaan 11–12 Sep).

## Angka: sebelum dan sesudah

Diukur dari peramban dan `curl`, lewat `https://teknik-avengers.com`.

| Layar masuk (belum login) | Sebelum | Sesudah |
|---|---|---|
| Request per halaman | 55 | **12** |
| Unduhan | 2.788 KB | **609 KB** |
| `domInteractive` | 2.810 ms | **838 ms** |
| `loadEventEnd` | 2.816 ms | **1.005 ms** |
| `cf-cache-status` berkas statis | `EXPIRED` / `REVALIDATED` di semua | **`HIT`** |
| Latar orbit | 2.190.784 B PNG, **1.060 ms** sendirian | 349.481 B JPEG, tersimpan 7 hari di tepi |

| Setelah login, refresh (F5) | Sebelum | Sesudah |
|---|---|---|
| Yang tampak selama data ditarik | layar kosong ~2 s | **dashboard langsung tampil** dari simpanan, lalu diperbarui diam-diam |
| Perjalanan API berurutan | ~14 (getAllData per unit satu-satu + 4 pemuat ekor) | **3 gelombang** paralel |
| JSON getAllData naik lewat tunnel | ~238 KB mentah | ~53 KB gzip |
| `/logbook/` (HTML E-Logbook lewat proksi) | 164.902 B | **27.713 B** gzip, `Vary: Accept-Encoding` |

### Mengapa jalurnya yang salah, bukan kodenya

Berkas yang **sama persis**, dua jalur (sebelum perbaikan):

| Berkas | `localhost:3100` | lewat Cloudflare |
|---|---|---|
| `index.html` 46 KB | 0,21 s | 2,07 s |
| `36-cetak.js` 101 KB | 0,22 s | 0,47 s |
| `01-dasar.css` 2,4 KB | 0,21 s | 0,43 s |
| `indonesia-orbit-bg.png` 2,1 MB | 0,24 s | **10,84 s** |

Server menjawab dalam 66 ms; nol *long task*; `36-cetak.js` dan `01-dasar.css`
tidak pernah disentuh hari itu dan sama lambatnya. 2,19 MB / 10,6 s ≈ **1,6
Mbps** upload — dan dalam tiga percobaan berturut throughput-nya 846 → 871 →
196 KB/s. Tiap berkas JS mengantre ~1.070 ms serempak, menunggu jawaban
240–650 ms, mengunduh 0–1 ms: yang mahal **jumlah bolak-balik**, bukan isi.

## Yang jadi hari ini

| Commit | Isi |
|---|---|
| `3cc142a` | **Kartu peralatan tampil bergantian di depan.** `putarCincin`/`sorot` dilepas. Satu kartu di depan, sisanya `opacity:0; pointer-events:none`. Ganti tiap 5 s; berhenti kalau kursor di atas **kartu** (bukan panggung — panggung selebar layar pernah membuat kursor diam di mana pun ikut menahan), hitungan mulai ulang saat kursor lepas; berhenti saat beranda tidak tampil. Panah ‹ ›, nama unit, titik giliran (lompat langsung), tombol Jeda memakai pola `data-jeda` yang sama dengan pita berjalan. Unit di depan tidak melompat balik saat dashboard digambar ulang. |
| `5c34407` | **Halaman depan 55 → 12 request.** (a) `Cache-Control` di `express.static`: gambar/vendor 7 hari, js/css 60 s, html `no-cache`. (b) Rute `/js/semua.js` + `/css/semua.css`: server menyambung berkas sumber saat diminta (kunci cache = mtime terbaru, tidak ada langkah build), di-gzip sekali di memori — 717 KB → 223 KB. Berkas satuan tetap disajikan. (c) `srvMuat()`: getAllData per unit dan empat pemuat ekor dilepas `Promise.all`. (d) Gambar: latar → JPEG mutu 92 (resolusi tetap 1672×941, beda piksel rata-rata 0,73 %), logo → 128 px (tampil 54×54). `tools/kecilkan-gambar.ps1` (GDI+ bawaan Windows, ASCII). |
| `8cb512e` | **Proxy `/api` men-gzip badan teks** sebelum naik ke Cloudflare (`teruskan()` di `server.js`). Aman karena `accept-encoding` sudah dibuang ke arah E-Logbook dan `content-encoding` upstream dibuang di arah balik. Hanya teks ≥ 1 KB, bukan HEAD; 204/304 tanpa `Content-Length`. **Perlu restart** — lihat Menggantung. |
| `e1c2ba8` | **Refresh seketika dari simpanan.** Jawaban server terakhir disimpan di `sessionStorage` (`avenger.simpanan`). `pulihkanSesi()` menjalankan `srvMuat()` dua kali: pass `'baca'` dari simpanan (nol jaringan, dashboard langsung tampil, keterangan beranda diberi " · memperbarui dari server…"), lalu pass `'tulis'` ke server yang menggambar ulang. Hanya jalur baca (`getAllData`, `/api/me`, `/unitdb`, `/sejarah`, `/dokumen`, `/hak-akun`), hanya 200, hanya akun yang sama; ikut dibuang saat `lupakanSesi()`. 401/403 di pass kedua → kembali ke kartu masuk. `muatHakAkun` pindah ke `srvFetch`. Diuji di Node VM dengan stub. |
| `00fbb49` | **Kartu depan tanpa pembesaran 3D.** `translateZ(60px) scale(1.06)` membuat raster lembut (Bagus melihatnya "burem"; berkas fotonya 1280×960, bukan itu sebabnya). Kartu depan kini `transform:none`, tinggi panggung 344 → 330 px. |

Di luar git: tiga restart server lewat `New-Item restart.minta` (17:53,
05:43, 06:13). Yang terakhir membawa gzip proksi — **terverifikasi 06:13:50**:
`/logbook/` dari localhost 164.902 B → 27.713 B dengan `Content-Encoding:
gzip` dan `Vary: Accept-Encoding`; lewat domain 0,207 s, `cf-cache-status:
DYNAMIC` (benar — dinamis tidak disimpan tepi), gzip ikut; `/api/me` 401
(24 B) tetap **tanpa** gzip.

## Menggantung — kerjakan lebih dulu di chat baru

1. **Uji refresh dua kali oleh Bagus** — F5 pertama mengisi simpanan
   (masih ~2 s), F5 kedua harus seketika. Bagus sudah bilang "nice mantap"
   dan "done sip" di akhir sesi; laporan tegas soal F5 kedua belum ada —
   tanyakan sekali di chat baru.
2. **`git push`** — Bagus mengerjakan sendiri (mungkin sudah). Cek `git
   status -sb`: kalau masih `ahead`, belum. `docs/STATUS-12-SEP-2026-BERKALA.md`
   masih *untracked* (miliknya), tidak disentuh.

## Aturan baru yang harus diikuti

- **Berkas js/css baru WAJIB ditambahkan ke `URUTAN_JS` / `URUTAN_CSS` di
  `server.js`**, di urutan yang benar (`33-mulai.js` tetap terakhir). Yang
  tidak ada di daftar **tidak dimuat**; server memperingatkan di log saat
  nyala: `[gabung] public/js/ punya berkas yang tidak ada di URUTAN_JS…`.
- **Rute baru di `server.js` → restart dulu, baru ubah `index.html`** yang
  merujuknya. Berkas statis langsung tayang, rute belum. (Sudah kejadian
  sekali hari ini; sempat dikembalikan dalam hitungan detik.)
- **Perubahan js/css baru terlihat setelah ≤ 60 s atau Ctrl+F5** — cache
  tepi dan peramban kini menyimpannya.
- **Kalau ada keluhan lambat:** ukur `curl localhost:3100/...` vs `curl
  https://teknik-avengers.com/...` dan `cf-cache-status` **sebelum**
  menyalahkan kode. Payload API diukur dari hasil mapper
  (`rowToDcRingkas`, `rowToEntry`), bukan kolom tabel — `state_json` 941 KB
  di tabel tidak pernah dikirim.
- `Get-ScheduledTask` **tidak menampilkan** tugas penjaga (milik SYSTEM);
  buktikan restart lewat `server.log` ("jaga-server: restart.minta
  ditemukan") dan `CreationDate` proses node.

## Cara kembali kalau ada yang salah

| Gejala | Perintah |
|---|---|
| Dashboard tidak terisi / unit hilang setelah refresh | `git revert --no-edit e1c2ba8` |
| Halaman kosong (gabungan js/css bermasalah) | kembalikan 9 `<link>` + 36 `<script>` di `index.html` dari `git show 3cc142a:public/index.html` — server tidak perlu disentuh |
| Latar/logo aneh | rujukan di `01-dasar.css`, `02-layar-masuk.css`, `index.html` kembali ke `.png`; berkas PNG asli masih di cakram |
| Kartu bergantian tidak disukai | `git revert --no-edit 00fbb49 3cc142a` |

## Ide berikutnya (belum dikerjakan)

- **Satu endpoint gabungan** di server dashboard yang menarik getAllData
  semua unit + `/unitdb` + `/sejarah` + `/dokumen` dalam satu jawaban: tiga
  gelombang RTT jadi satu. Server ke E-Logbook itu localhost, murah.
- Hapus `indonesia-orbit-bg.png` dan `airnav-logo.png` asli dari `public/`
  setelah beberapa hari (2,4 MB di repo).
- `public/js/06-panggung-3d.js` masih menyebut `.png` di komentar — tidak
  dimuat halaman, remeh.
- Simpanan `sessionStorage` bisa diperluas ke `bklMuat`/`psnMuat`/galeri
  (modul yang ditarik `bukaDashboard()`), kalau bagian itu terasa
  terlambat muncul.

## Rujukan

- Halaman contoh bentuk kartu (A/B/C, Bagus memilih A):
  <https://claude.ai/code/artifact/256646c2-9099-40a3-b924-453fdd5a98fd>
- Penjelasan rute gabungan dan `Cache-Control`: kepala blok "SATU BERKAS JS,
  SATU BERKAS CSS" di `server.js`.
- Penjelasan simpanan: blok "SIMPANAN JAWABAN SERVER" di
  `public/js/12-jembatan-elogbook.js`.
