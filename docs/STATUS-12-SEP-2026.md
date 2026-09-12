# Status 12 September 2026 — Bot baru, Profil di Dashboard, pengingat semua lembar

Catatan serah terima untuk chat baru. Sesi Claude terikat ke folder
`D:\Airnav\2026\Teknik JATSC Avenger`; berkas inilah konteksnya. Lanjutan dari
[STATUS-11-SEP-2026.md](STATUS-11-SEP-2026.md).

## Ringkas

Bot Telegram berganti menjadi **@Teknik_Avengers_bot** (nama tampilan
"Teknik-Avengers"), menggantikan @Avengers_Teknik_JATSC_bot. Pengaturan
sambungan Telegram **pindah dari E-Logbook ke Dashboard**, di kartu **Profil**
yang dibuka lewat ikon orang di kepala halaman. Notifikasi ✅ dan ⏰ sekarang
sampai ke **semua teknisi yang tercantum** di lembar, bukan cuma yang
menyimpannya. Pengingat ⏰ berlaku untuk **ketujuh jenis lembar**, bukan cuma
logbook. Semua sudah digabung ke `feature/avengers-login-visual`; **27 commit
di depan origin, belum di-push**.

## Yang jadi hari ini

| Commit | Isi |
|---|---|
| `4fe15db` | ✅ dan ⏰ dikirim ke **semua teknisi yang tercantum** di lembar, bukan cuma pembuatnya. Nama teks bebas dicocokkan persis dengan nama akun aktif. |
| `323d471`, `c0478e2` | Alat `elogbook/tools/siapkan-uji.mjs` — menyalin data produksi ke worktree dengan VACUUM INTO (termasuk data dashboard dan galeri). |
| `2ef4c0b`, `2a5b0a8`, `320f2a3` | Tahapan menuju Profil: panel Telegram keluar dari "TTD Saya", tombol **Putuskan** dihapus, tautan taut disiapkan di muka. |
| `d6fba4a` | **Profil pindah ke Dashboard.** E-Logbook tidak lagi punya UI Telegram sama sekali. |
| `0ebaa16` | Pengingat ⏰ untuk **ketujuh jenis lembar**, dengan pangkal hitungan mengikuti sifat lembarnya. |

Di luar git: **token bot produksi diganti** lewat skrip sekali-pakai di
scratchpad. `.env` lama dicadangkan sebagai `.env.bak-2026-09-12T04-39-29`.

## Empat macam notifikasi, siapa penerimanya

| Pesan | Ke siapa | Kapan |
|---|---|---|
| 🔔 Perlu tanda tangan | Pejabat yang dituju, dan PH-nya kalau sedang berlaku | Begitu lembar disimpan |
| ✅ Sudah ditandatangani | Pembuat **dan semua teknisi yang tercantum** | Begitu pihak kedua membubuhkan |
| ⏰ Belum ditandatangani | Pembuat **dan semua teknisi yang tercantum** | 30 menit setelah jatuh tempo, sekali saja |
| ✅ Berhasil terhubung | Yang baru menautkan akun | Saat menekan Start di bot |

**Jatuh tempo ⏰ mengikuti sifat lembarnya:**

| Lembar | Dihitung dari |
|---|---|
| Logbook, Daily Check (punya kolom dinas) | akhir dinas, atau waktu simpan kalau itu lebih akhir |
| Monitoring, DS Test, Berkala, LTK, BAPB | waktu lembarnya disimpan |

Lembar khusus tiap unit tidak punya tabel sendiri — Radio, Weekly Pengamatan,
LLZ Navigasi, Meter Reading, Maintenance Listrik, dan Meter Radkom semuanya
menumpang tabel `dstest`; Daily Check AMHS menumpang `dailychecks`. Karena itu
kedelapan unit ikut tanpa kode tambahan. Label dinas semua unit sudah diuji
dikenali tabel akhir dinas, termasuk Radkom yang memakai `P/S/PS/M` sementara
tujuh unit lain memakai `Pagi/Siang/Malam/PS`.

## Cara nama teknisi dipetakan ke akun

Nama pelaksana di formulir adalah **teks bebas** — tidak ada kolom username di
lembar mana pun. Pemetaannya dikerjakan saat mengirim notifikasi:

| Keadaan | Hasil |
|---|---|
| Nama cocok persis dengan nama akun aktif | Dapat notifikasi |
| Beda huruf besar-kecil atau spasi berlebih | Tetap dapat |
| Salah ketik atau disingkat | Dilewati diam-diam |
| Satu nama dipakai dua akun aktif | Dilewati — salah alamat lebih berbahaya |
| Akun nonaktif, atau belum menautkan Telegram | Dilewati |

Praktisnya: **ambil nama rekan dari daftar saran** yang muncul saat mengetik.
Saran itu memang daftar akun teknisi di unit tersebut.

## Profil akun — sekarang di Dashboard

Ikon orang di kepala halaman Dashboard, di sebelah tombol Keluar. Isinya
identitas (nama, username, peran, unit) dan panel Notifikasi Telegram.

- **Satu tekan langsung ke bot.** Kode taut sudah diminta diam-diam begitu
  kartu Profil terbuka, jadi tombolnya benar-benar tautan `t.me`, bukan tombol
  yang menyuruh menunggu.
- **Tidak ada tombol yang memutus.** `telegramPutus` dicabut dari server, bukan
  sekadar disembunyikan. Sambungan hanya berpindah kalau ada chat lain yang
  benar-benar menekan Start.
- Dashboard tidak punya endpoint baru: panelnya memanggil API E-Logbook apa
  adanya lewat `srvApi` (`telegramStatus`, `telegramTaut`).

## Keadaan produksi saat catatan ini ditulis

- Dashboard 3100 dan E-Logbook 3000 hidup, `/logbook/` menjawab 200.
- `0ebaa16` sudah tergabung, dan **`restart.minta` masih ada** (dibuat 17:44) —
  artinya server belum memuat kode pengingat baru. Penjaganya jalan tiap menit
  berakhiran 3.
- Tertaut Telegram: `uji.teknisi`, `uji.ph`, `uji.pejabat` — ketiganya dari
  akun Telegram yang berbeda, ditautkan siang tadi ke bot baru.
- Menunggu tanda tangan: **50 logbook, 20 daily check**. Jendela 6 jam yang
  menahan banjir pengingat: hanya yang jatuh temponya lewat kurang dari 6 jam
  yang ditagih; sisanya dilewati selamanya.

## Sisa pekerjaan

1. **Tunggu restart lalu buktikan ⏰ daily check.** Sebelum ini ⏰ hanya untuk
   logbook. Setelah server memuat `0ebaa16`, daily check yang dinasnya sudah
   berakhir 30 menit dan belum di-TTD harus menagih pembuatnya.
2. **Hapus bot lama** @Avengers_Teknik_JATSC_bot lewat `/deletebot` di
   BotFather — hanya setelah notifikasi dari bot baru terbukti sampai.
3. **Umumkan ke teknisi dan pejabat.** Isinya: buka Dashboard → ikon orang →
   Hubungkan lewat Telegram, tekan Start. Sekali seumur akun.
4. **Push 27 commit** — tunggu perintah Bagus.
5. **`uji.teknik-avengers.com` belum jadi.** DNS-nya belum ada. Skrip pemasang
   sudah siap (PowerShell admin, ingress → `localhost:3200`, route dns, restart
   layanan Cloudflared), tapi belum dijalankan sampai tuntas, dan Cloudflare
   Access belum dipasang. Tanpa Access, alamat itu terbuka untuk siapa saja
   yang tahu.
6. **Server uji kehilangan botnya.** Tokennya dipindah ke produksi, jadi
   `.env` di worktree `notif-pelaksana` tokennya kosong. Untuk menguji
   notifikasi di server uji lagi, perlu bot **ketiga** dari BotFather.
7. **Pekerjaan sesi lain belum digabung**: `feature/notif-pelaksana` commit
   `286106f` — pekerjaan berkala hanya untuk yang benar-benar berdinas (yang
   CUTI/CAP/IJIN/DL tidak lagi kebagian). Itu perubahan sisi dashboard, lahir
   dari sesi terpisah hari ini. Belum masuk `feature/avengers-login-visual`.
8. Menyusul kalau diminta: **sunting profil** (ganti nama tampilan, ganti kata
   sandi). Tempatnya sudah disiapkan di bawah blok identitas. Catatan penting:
   kalau nama tampilan boleh diubah, username sebaiknya ikut disimpan di lembar
   — pemetaan notifikasi sekarang bergantung pada ejaan nama.

## Keputusan dan alasannya

**Profil di Dashboard, bukan di E-Logbook.** Akunnya memang satu: dashboard
tidak punya daftar akun sendiri, ia menanyakan identitas ke E-Logbook lewat
`/api/me`. Dashboard juga pintu masuk yang sebenarnya — E-Logbook duduk di
dalamnya di `/logbook/`. Mengatur akun dari dalam E-Logbook berarti masuk satu
lapis lebih dalam untuk urusan yang tidak ada hubungannya dengan formulir.

**Tidak ada tombol memutus sambungan.** Notifikasi tanda tangan bukan pilihan
pribadi, dan satu kali salah tekan tidak boleh mematikannya diam-diam. Yang
tersedia hanya "Ganti akun Telegram", yang tidak memutus apa pun sampai chat
baru menekan Start.

**Nama dicocokkan persis, yang meragukan dilewati.** Nama yang dipakai lebih
dari satu akun aktif sengaja tidak ditebak: mengirim dokumen orang ke orang
yang keliru lebih berbahaya daripada tidak terkirim.

**Jendela 6 jam dipertahankan.** Itu yang membuat pemasangan hari ini aman:
enam tabel yang baru sekarang punya kolom pengingat tidak diteriaki sekaligus.

**Bot diganti sekarang, bukan nanti.** Pengumuman belum disebar, jadi yang
tertaut baru tiga akun uji. Setiap hari menunda berarti makin banyak orang
yang harus menekan Start ulang.

## Catatan teknis yang mudah terlupa

- **Skrip `.ps1` harus ASCII murni.** PowerShell 5.1 membaca berkas tanpa BOM
  sebagai ANSI; tanda pisah `—` berubah jadi kutip miring dan memutus string.
  Galatnya menunjuk baris lain sama sekali.
- **Menyunting berkas di folder ini = deploy.** Perubahan JS/CSS/HTML langsung
  hidup; peramban menahannya satu jam (`Ctrl+F5` untuk memaksa). Perubahan
  server butuh `New-Item restart.minta`.
- **Menyalin `elogbook.db` dengan Copy-Item salah** — WAL-nya tertinggal.
  Pakai `elogbook/tools/siapkan-uji.mjs`.
- **Server uji memakai port 3200 (dashboard) dan 3201 (E-Logbook).**
  `jalankan-semua.js` membunuh proses yang memegang port yang disebut di
  `.env`-nya, jadi angka itu tidak boleh 3000 atau 3100.
- **Satu chat Telegram hanya bisa memegang satu akun E-Logbook.** Menautkan
  akun kedua dari chat yang sama melepas akun pertama.
