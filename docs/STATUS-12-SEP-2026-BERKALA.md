# Status 12 September 2026 — Kegiatan berkala hanya untuk yang berdinas

Catatan serah terima untuk chat baru, dari sesi yang berjalan **berbarengan**
dengan [STATUS-12-SEP-2026.md](STATUS-12-SEP-2026.md) (bot baru, Profil di
Dashboard, pengingat TTD). Dokumen itu menyebut pekerjaan ini di Sisa
Pekerjaan nomor 7; berkas inilah rinciannya.

## Ringkas

Pekerjaan berkala sekarang hanya jadi tanggungan orang yang **benar-benar
berdinas** — PS, P, S, M, mau JATSC mau New JATSC, **termasuk yang masuk
dengan SPKL**. Kode `DL`, `CUTI`, `CAP`, dan `IJIN` diperlakukan seperti
libur. Selesai, teruji, **belum dipasang**: commit `286106f` di branch
`feature/notif-pelaksana`, lahir dari `d6fba4a`.

Di luar yang diminta, sesi ini menemukan dua hal yang lebih besar daripada
perubahannya sendiri:

1. Jadwal yang sudah tersimpan berisi **kode bertulisan tidak bersih**
   (`"C  U  T  I"`, `"MJ (SPKL)"`) yang membuat aturan apa pun bocor diam-diam.
2. **NIK sudah menyambungkan jadwal dinas ke akun E-Logbook dan ke Telegram**,
   sementara kode masih menebak lewat ejaan nama — dan tebakannya hanya kena
   9 dari 16 orang. Ini jawaban yang lebih kuat untuk Sisa Pekerjaan nomor 8
   di dokumen sebelah ("username sebaiknya ikut disimpan di lembar").

## Yang jadi — commit `286106f`

| Berkas | Isi |
|---|---|
| `public/js/02-kode-dinas.js` | `berdinasShift()` dan `kodeBaku()` baru, plus `ALIAS_SHIFT`. `rombonganShift()` ikut memakai `kodeBaku()`. |
| `public/js/26-perhatian-lonceng.js` | `unitDinasSaya()` tidak lagi menghitung petak libur — lonceng berhenti berbunyi ke yang cuti. |
| `public/js/27-kotak-masuk.js` | `dinasPadaTanggal()` menyaring petak libur — baris "Berdinas" dan lencana "untuk saya" ikut benar. |
| `public/js/36-cetak.js` | `dinasKodePUM()` ikut memakai `kodeBaku()`. |

Semuanya `public/js`, **tidak ada berkas server**, jadi pemasangannya tidak
perlu restart — cukup muat ulang halaman.

### Kenapa ada `kodeBaku()`

Bukan kemewahan. Pengimpor jadwal sengaja **menyimpan apa adanya** kode yang
tidak dikenalinya (lihat `imporKode` di `22-impor-jadwal.js`), supaya salah
ketik kelihatan alih-alih hilang. Akibatnya jadwal yang sudah masuk berisi:

| Tulisan di jadwal | Jumlah petak | Akibatnya sebelum diperbaiki |
|---|---|---|
| `"C  U  T  I"` | 5 (Agustus 2, Oktober 3) | terhitung **berdinas**, jadi aturan cuti bocor |
| `"MJ (SPKL)"` | 9 (Agustus 5, Oktober 4) | tidak punya rombongan → saringan PS/Malam tidak pernah berlaku |
| `"PSJ (SPKL)"` | 6 (Agustus 3, Oktober 3) | sama |

Tanpa pembakuan, memeriksa `libur` saja tidak cukup.

### Keputusan Bagus, 12 September 2026

- **SPKL tetap dikosongkan di lembar PUM** — lembur urusan internal Teknik.
  Tapi itu **tidak** berarti lepas dari pekerjaan berkala: yang SPKL tetap
  terhitung berdinas di dashboard. Dua hal terpisah, dan sekarang keduanya
  tertulis di komentar kodenya.
- **Ubin beranda "Personel Dinas" dibiarkan** ikut menghitung yang
  CUTI/CAP/IJIN/DL, karena keterangan kodenya sudah tertera di kartunya.

## Bukti

- **117 uji** kode dinas (`kodeBaku`, `berdinasShift`, `rombonganShift`,
  `dinasKodePUM`) + **21 uji fungsional** yang memuat berkas aslinya di dalam
  `vm` dengan data `dinas.json`/`berkala.json` salinan uji. Semua lulus.
- Harness yang sama dijalankan ke **kode produksi** untuk memastikan ujinya
  memang menangkap keadaan lama: **10 gagal di sana, 0 di cabang ini**.
- Lembar PUM dibandingkan petak demi petak dengan peta kode yang lama:
  **1503 petak Agustus–Oktober, tidak satu pun berubah.**
- Dicoba di server uji (dashboard 3910 + E-Logbook 3900, worktree
  `notif-pelaksana`, data salinan, Telegram mati) dan diperiksa di peramban
  sungguhan.

Dampak nyatanya, dihitung hanya untuk orang yang namanya memang ketemu akun:
**Agustus 2 petak** (Nidya, Dhody) · **September 15 petak** (Bagus, Dwinta) ·
**Oktober 2 petak** (Nidya, Dhody).

## Temuan besar: NIK sudah jadi kuncinya, kodenya belum memakainya

Username akun E-Logbook itu sendiri NIK (`10012550`, `10083560`, …), dan tabel
jadwal dinas **sudah punya kolom NIK**. Rantainya utuh sampai bot:

```
data/dinas.json .nik  →  users.username  →  telegram_akun.chat_id
```

`telegram_akun` memang berkunci `username`. Hasil pengukuran 12 September:

| Cara mencocokkan | September (16 orang) |
|---|---|
| Lewat **nama** (`namaSaya()`, longgar dua arah) | **9** cocok, 7 lepas |
| Lewat **NIK** | **16 — semuanya** |

Yang lepas antara lain `BERRY POEDJO L.` vs akun "Berry Poedjolaksono",
`TONY EDY PURNOMO` vs "Tony Edi Purnomo", `MUH DEA AHPI A` vs "Muhamad Dea
Ahpi Ahdiat". Tujuh orang itu **tidak pernah menerima pemberitahuan berkala
apa pun**, cuti atau tidak — dan itu sudah begitu sejak sebelum perubahan hari
ini.

Yang menghalangi pemakaian NIK: `dinasHariIni()` (`21-jadwal-dinas.js`) dan
`dinasPadaTanggal()` (`27-kotak-masuk.js`) **membuang** `nik` waktu menyusun
petak dinas, jadi pencocokan terpaksa jatuh ke nama.

Keadaan datanya: **September NIK lengkap 16/16**, **Agustus dan Oktober NIK
kosong semua** (16 dan 17 orang). Kolomnya sudah tersedia — tabel jadwal punya
isian NIK saat Sunting, dan pengimpor sudah bisa membaca kolom NIK/NIP/NRP
dari lembar Excel. Dua bulan itu kebetulan diimpor tanpa kolom itu.

Baru **4 orang** yang sudah menautkan Telegram-nya.

## Keadaan saat catatan ini ditulis

| Hal | Keadaan |
|---|---|
| Produksi (folder utama) | `0ebaa16` di `feature/avengers-login-visual`, working tree **bersih** |
| Perubahan ini | `286106f` di `feature/notif-pelaksana`, **tidak** di-checkout di worktree mana pun |
| Bentrokan | tidak ada — `0ebaa16` tidak menyentuh keempat berkas itu |
| Worktree `notif-pelaksana` | sudah **dipakai branch lain** (`feature/pengingat-semua`) |
| Server produksi | hidup di 3000/3100, tidak tersentuh |
| Server uji 3900/3910 | sudah dimatikan (worktree-nya berpindah branch, jadi yang disajikannya bukan lagi kode yang diuji) |
| Akun uji `uji.dinas`/`uji.cuti`/`uji.malam` | **hanya** di salinan `elogbook.db` dalam worktree; database produksi bersih (35 akun) |
| Push | belum, menunggu perintah |

## Sisa pekerjaan

1. **Pasang `286106f`.** Satu perintah, tanpa restart:
   `git -C "D:/Airnav/2026/Teknik JATSC Avenger" cherry-pick 286106f`
   Sesudahnya **Ctrl+Shift+R** — berkas JS ketahan cache peramban ±1 jam.
   Ceknya: Kotak Masuk 6–8 September, nama Bagus (DL) hilang dari baris
   "Berdinas".
2. **Cocokkan lewat NIK.** Bawa `nik` ikut ke petak dinas di `dinasHariIni()`
   dan `dinasPadaTanggal()`, cocokkan NIK dulu, nama sebagai cadangan untuk
   bulan yang NIK-nya kosong. September langsung 9 → 16 orang.
3. **Isi NIK Agustus & Oktober.** Tanpa ini, bulan-bulan berikutnya balik ke
   tebak-tebakan nama dan bot akan salah alamat dengan cara yang sulit
   ketahuan. Tidak butuh fitur baru.
4. **Notifikasi berkala lewat Telegram belum ada sama sekali.** Server belum
   pernah membaca jadwal dinas untuk kegiatan berkala — lonceng dan Kotak
   Masuk selama ini dihitung di peramban. Untuk bot, hitungannya harus pindah
   ke server plus penjadwal "jam berapa dikirim". Pekerjaan tersendiri, bukan
   tempelan.
5. **Kotak Masuk belum menyaring rombongan** PS vs Malam, padahal lonceng
   sudah (`bklShift` dipakai di `26-perhatian-lonceng.js`, tidak di
   `27-kotak-masuk.js`). Di luar permintaan hari ini, tapi keduanya jadi tidak
   sama tentang pekerjaan yang sama.

## Jebakan yang ditemukan

- **Jangan menguji pencocokan orang dengan akun asli.** Ujinya bisa lulus
  karena namanya tidak cocok, bukan karena aturannya benar. Buat akun uji yang
  `nama`-nya disalin **persis** dari jadwal.
- **Berkas `public/js` bukan modul**, jadi `const` antar-berkas tidak saling
  terlihat kalau dimuat satu-satu di `vm`. Gabungkan seluruh berkas jadi
  **satu** skrip `vm`, baru `const`-nya berbagi lingkup seperti di peramban.
  Yang tidak ikut dimuat (`T`, `el`, `akun`, `dinasUnit`, `infoUnit`) dipasang
  sebagai `var` di awal gabungan itu.
- **Repo digarap dua sesi sekaligus hari ini.** Perintah `cp` yang sudah
  disiapkan jadi basi dalam hitungan menit karena worktree `notif-pelaksana`
  dipindah ke branch lain. Cek `git worktree list` dan `git log -1` sebelum
  memasang apa pun yang disiapkan lebih awal.
- **Folder produksi itu situs yang sedang hidup.** Perubahan `public/js` di
  situ langsung tersaji; tidak ada langkah build yang menahannya.
- `data/dinas.json` berubah pukul 17:40 hari ini dari pemakaian normal lewat
  situs. Angka audit di atas dihitung sebelum itu; kalau ada nama baru masuk
  jadwal, hitungannya bisa bergeser sedikit.

## Alat yang dipakai

Skrip ujinya ada di scratchpad sesi ini —
`uji-berdinas.mjs` (117 uji), `uji-kotak-lonceng.mjs` (21 uji fungsional),
`luncur-dashboard-uji.mjs` dan `luncur-elogbook-uji.mjs` (peluncur server uji,
port 3910/3900). Folder scratchpad **ikut terhapus** bersama sesinya; kalau
ujinya mau dipertahankan, pindahkan ke `tools/` lebih dulu.

## Cara kerja yang dipakai

- **Tunjukkan di uji dulu** — dikerjakan di worktree, diuji pada salinan data,
  dipasang ke produksi hanya setelah Bagus bilang oke.
- **Bagus yang eksekusi** perintah di PC ini; push hanya atas perintahnya.
