# Status 13 September 2026 — Pengingat Telegram sejam sebelum dinas

Catatan serah terima untuk chat baru. Pendahulunya
[STATUS-13-SEP-2026-PERFORMA.md](STATUS-13-SEP-2026-PERFORMA.md) (performa
halaman depan) dan [STATUS-12-SEP-2026-BERKALA.md](STATUS-12-SEP-2026-BERKALA.md)
(temuan NIK sebagai kunci orang).

## Ringkas

Bagus bertanya apakah pengingat bot Telegram sejam sebelum dinas sudah aktif.
**Belum pernah ada** — satu-satunya pengingat sebelum ini adalah "belum
di-TTD" 30 menit *sesudah* dinas. Diminta dibuat "sesuai daftar dinasnya".

Sekarang jadi: tiap orang yang tercantum di **jadwal dinas dashboard**
(`data/dinas.json`) menerima pesan Telegram **satu jam sebelum** dinasnya
mulai, sekali per orang per petak dinas. Selesai, teruji (9 uji lulus,
dicoba dengan data produksi salinan), **belum dipasang** — butuh restart
E-Logbook, dan sesuai kebiasaan dicoba dulu di server uji.

## Yang jadi

Bagus memutuskan: **dashboard induknya, E-Logbook komponen** — tautan Telegram
pun dibuat dari Profil di dashboard, dan pengingat berikutnya (kegiatan
berkala) datanya juga milik dashboard. Maka hitungannya di server dashboard;
E-Logbook hanya menyediakan dua pintu internal untuk hal yang memang tinggal
di sana (daftar akun/unit, dan pengiriman ke chat_id). Versi pertama sempat
seluruhnya di E-Logbook (commit `33f6364`, `f059216`) dan sempat berjalan di
produksi 07:40–; dipindahkan di commit berikutnya.

| Berkas | Isi |
|---|---|
| `pengingat-dinas.js` (akar) | **Murni.** Cermin tabel jam `SHIFT` dan pembaku `kodeBaku()` dashboard; `dinasDalamRentang()` mengubah jadwal jadi daftar petak `{unit, nama, nik, kunci, mulaiMs}`; `usernameUntukPetak()` mencocokkan petak ke akun (NIK → username di kolom nama → nama persis → nama longgar tunggal); `kunciPengingat()`, `jamWib()`, `tanggalWib()`, `pesanDinasMendatang()`. |
| `server.js` (dashboard) | Bagian **PENGINGAT DINAS** sebelum START: `periksaPengingatDinas()` baca `data/dinas.json`, ambil petak yang mulai dalam 60 menit, tanya `/internal/daftar`, kirim lewat `/internal/telegram/kirim`, tandai di `data/pengingat-terkirim.json`. Dijadwalkan di blok `dijalankanLangsung`: 30 detik setelah menyala, lalu tiap 5 menit. Hanya kalau penerusan E-Logbook hidup (`TERUS`). |
| `elogbook/server.js` | Pintu internal `GET /internal/daftar` → `{akun:[{username,nama}], unit:[{kode,nama}]}` dan `POST /internal/telegram/kirim` `{username, teks}` → `{aktif, tertaut, terkirim}`. Penjaga `hanyaInternal`: alamat socket loopback DAN tanpa kepala `x-diteruskan-avenger` (`/logbook/internal/…` yang diteruskan dashboard membawa kepala itu → 404). |
| `tools/uji-pengingat-dinas.mjs` (akar) | 9 uji `node --test`, termasuk pembanding dengan `02-kode-dinas.js` asli di `vm`. |
| `elogbook/tools/telegram-ke-satu-akun.mjs` | Alat server uji: arahkan semua chat Telegram di salinan DB ke satu akun. |
| `elogbook/tools/telegram-putus.mjs` | Lepas tautan Telegram akun (dipakai untuk akun uji). |
| `.env.example` | `PENGINGAT_DINAS_MENIT` (dibaca dashboard). |
| `telegram.js` (akar, **dipindah dari `elogbook/`**) | Lapisan transport Bot API + seluruh penyusun teks, termasuk `pesanDinasMendatang()`. Permintaan Bagus: satu bot untuk semuanya, jadi berkasnya milik bersama di akar. Diimpor `elogbook/server.js` (`../telegram.js`), `elogbook/tools/telegram-webhook.js`, dan `server.js` dashboard. |

Tabel `pengingat_dinas` yang sempat dibuat versi pertama di `elogbook.db`
produksi dibiarkan; kosong dan tidak dipakai lagi.

### Aturan yang dipakai

- **Jam mulai UTC**, cermin SHIFT dashboard: PS/Pagi 00 (07 WIB), Siang 07
  (14 WIB), Malam 12 (19 WIB), **Malam mundur ke 13 (20 WIB) kalau hari itu
  dipecah P/S** di unit yang sama. SPKL ikut diingatkan (jamnya sama dengan
  dasarnya). CUTI/CAP/IJIN/DL tidak. Kode asing tidak — tidak punya jam.
- **Orang → akun: NIK dulu** (`dinas.json .nik` = `users.username`), lalu nama
  persis, lalu nama longgar (aturan `namaSaya()` dashboard) **hanya kalau
  kena tepat satu akun**. Tidak menebak.
- **Jendela** = 60 menit penuh sebelum mulai: kirim begitu `kini ≥ mulai − 60
  menit`, tidak lagi setelah dinas mulai. Server mati 20 menit tetap kirim.
- **Sekali** per `tanggal|unit|kode|username`, disimpan di `data/pengingat-terkirim.json` supaya
  restart tidak mengirim ulang. Yang belum tautkan Telegram / tidak ketemu
  akun dilewati **tanpa ditandai** — kalau ia tautkan di dalam jendela,
  pesannya tetap sampai. Gagal kirim tidak ditandai, dicoba lagi 5 menit lagi.
- Jadwal dibaca ulang tiap putaran: tukar dinas hari itu langsung berlaku.
- Cermin SHIFT **dijaga uji**: `tools/uji-pengingat-dinas.mjs` memuat
  `public/js/02-kode-dinas.js` asli di `vm` dan membandingkan kode demi kode.
  Kode baru di dashboard tanpa padanan di sini = uji gagal.

### Contoh pesan

```
🕖 Pengingat dinas

Bagus Wibowo, Anda dijadwalkan dinas PS JATSC di unit Radtel.
Tanggal: Senin, 14 September 2026
Mulai: 07:00 WIB

Dinas dimulai 58 menit lagi.
```

## Bukti

- `node --test tools/uji-pengingat-dinas.mjs` — **9 lulus**.
- **Ujung ke ujung di scratchpad**: salinan `server.js` dashboard dijalankan
  dengan `data/dinas.json` produksi dan `ELOGBOOK_ASAL` diarahkan ke E-Logbook
  tiruan yang mencatat panggilannya. Dengan jendela 1440 menit: 30 detik
  setelah menyala, tiruan menerima pesan untuk Fakhrizal (Malam New JATSC,
  Minggu 13 Sep 19:00 WIB) dan Bagus (PS JATSC, Senin 14 Sep 07:00 WIB);
  `pengingat-terkirim.json` terisi dua kunci; `uji.teknisi` yang tiruannya
  jawab "belum tertaut" tidak ditandai. Nol galat di keluaran server.
- Versi pertama (di E-Logbook) sempat dicoba dengan salinan DB produksi: 7
  hari ke depan **56 petak dinas, 56 cocok akun** (NIK September lengkap).
- Produksi dipastikan **tidak** mode watch (`tools/server.cmd` → `node
  jalankan-semua.js` tanpa `--watch`), jadi suntingan di folder ini belum
  hidup sampai restart.

## Temuan

1. **Tautan Telegram** per 13 Sep pagi: Bagus (`10012550`), Fakhrizal
   (`10013272`), dan `uji.teknisi` (chat lain milik Bagus, untuk mencoba).
   `uji.pejabat`/`uji.ph` sudah dilepas dengan `telegram-putus.mjs`. Teknisi
   lain belum menautkan (Dashboard → ikon orang → Hubungkan lewat Telegram).
2. **Oktober tanpa NIK**: lewat nama hanya **9 dari 17** ketemu akun.
   September 16/16 lewat NIK. Isi NIK Oktober lewat Jadwal Dinas → Sunting
   (sisa pekerjaan lama nomor 3 di dokumen BERKALA), atau 8 orang tidak
   diingatkan mulai 1 Oktober.
3. Produksi memakai **polling** Telegram. Server uji yang memakai token yang
   sama **wajib** `TELEGRAM_POLLING=` kosong — dua pemoll satu bot saling
   tendang (409).

## Cara mencoba di server uji (kalau perlu lagi)

Bagus memilih **tidak** menguji versi pertama di server uji; langsung produksi.
Kalau versi dashboard ini mau dicoba dulu: worktree `notif-pelaksana` (port
3910/3900), `checkout --detach feature/avengers-login-visual`, `siapkan-uji.mjs
--timpa`, di `.env` worktree isi token produksi, **`TELEGRAM_POLLING=`
kosong** (produksi sedang polling; dua pemoll satu bot saling tendang), dan
`PENGINGAT_DINAS_MENIT=1440`. Batasi penerimanya dengan
`telegram-ke-satu-akun.mjs` kalau tidak mau teknisi lain kena pesan uji.

## Memasang ke produksi

Kodenya sudah di folder produksi (`feature/avengers-login-visual`). Restart
**kedua** proses (dashboard dan E-Logbook — `restart.minta` memang mematikan
keduanya), tanpa admin:

```powershell
New-Item "D:\Airnav\2026\Teknik JATSC Avenger\restart.minta"
```

Penjaga memeriksa tiap 10 menit (menit berakhiran 3). Buktinya di
`server.log`: baris `jaga-server: restart.minta ditemukan`, dan tidak ada
`[pengingat dinas]` bergalat. Kalau Bagus menyalakan sendiri lewat
`schtasks /Run /TN "AvengerServer"`, hapus `restart.minta` sesudahnya. `PENGINGAT_DINAS_MENIT` **jangan**
diisi di `.env` produksi — bawaannya 60.

## Sisa pekerjaan

1. **Restart produksi** supaya versi dashboard ini yang jalan (yang hidup
   sekarang masih versi E-Logbook dari `f059216`; hasil di Telegram sama,
   tapi kodenya sudah tidak ada di branch).
2. Isi **NIK Oktober** (dan Agustus kalau mau rapi) di Jadwal Dinas.
3. Umumkan cara menautkan Telegram — baru 2 teknisi sungguhan yang tertaut.
4. Pengingat **kegiatan berkala** menyusul dengan pola yang sama; menunggu
   keputusan Bagus: kapan dikirim, ke siapa (semua yang berdinas atau hanya
   rombongan yang disebut), dan yang lewat tempo diulang tiap hari atau tidak.
5. Push, kalau diminta. `docs/STATUS-12-SEP-2026-BERKALA.md` masih untracked
   dari sesi lain, tidak disentuh sesi ini.
