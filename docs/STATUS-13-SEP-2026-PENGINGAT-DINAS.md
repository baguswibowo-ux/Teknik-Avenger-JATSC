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
mulai, sekali per orang per petak dinas. Selesai, teruji (8 uji lulus,
dicoba dengan data produksi salinan), **belum dipasang** — butuh restart
E-Logbook, dan sesuai kebiasaan dicoba dulu di server uji.

## Yang jadi

| Berkas | Isi |
|---|---|
| `elogbook/pengingat-dinas.js` | **Baru, murni.** Cermin tabel jam `SHIFT` dan pembaku `kodeBaku()` dashboard; `dinasDalamRentang()` mengubah jadwal jadi daftar petak `{unit, nama, nik, kunci, mulaiMs}`; `usernameUntukPetak()` mencocokkan petak ke akun; `kunciPengingat()`, `jamWib()`, `tanggalWib()`. |
| `elogbook/server.js` | `periksaPengingatDinas()`: baca jadwal, ambil petak yang mulai dalam 60 menit ke depan, cari akun dan chat-nya, kirim, tandai. Dijadwalkan di bagian START bersama pengingat TTD: 30 detik setelah menyala, lalu tiap 5 menit. |
| `elogbook/telegram.js` | `pesanDinasMendatang()` — teks pesannya. |
| `elogbook/db.js`, `db-pg.js` | Tabel baru `pengingat_dinas (kunci, dikirim_pada)` + `pengingatDinasTerkirim()`, `tandaiPengingatDinas()`. Baris lebih tua dari 7 hari dibuang sendiri. |
| `elogbook/tools/uji-pengingat-dinas.mjs` | 8 uji `node --test`. |
| `elogbook/tools/telegram-ke-satu-akun.mjs` | Alat server uji: arahkan semua chat Telegram di salinan DB ke satu akun. |
| `.env.example` | `PENGINGAT_DINAS_MENIT`, `DINAS_JSON`. |

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
- **Sekali** per `tanggal|unit|kode|username`, disimpan di tabel supaya
  restart tidak mengirim ulang. Yang belum tautkan Telegram / tidak ketemu
  akun dilewati **tanpa ditandai** — kalau ia tautkan di dalam jendela,
  pesannya tetap sampai. Gagal kirim tidak ditandai, dicoba lagi 5 menit lagi.
- Jadwal dibaca ulang tiap putaran: tukar dinas hari itu langsung berlaku.
- Cermin SHIFT **dijaga uji**: `uji-pengingat-dinas.mjs` memuat
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

- `node --test elogbook/tools/uji-pengingat-dinas.mjs` — **8 lulus**.
- Dicoba dengan **salinan DB produksi** (VACUUM INTO ke scratchpad, produksi
  hanya dibaca) + `data/dinas.json` produksi: 7 hari ke depan **56 petak
  dinas, 56 cocok akun** (NIK September lengkap), tabel baru tulis/baca beres.
- Produksi dipastikan **tidak** mode watch (`tools/server.cmd` → `node
  jalankan-semua.js` tanpa `--watch`), jadi suntingan di folder ini belum
  hidup sampai restart.

## Temuan

1. **Yang tautkan Telegram cuma 4 akun**: `uji.teknisi`, `uji.pejabat`,
   `uji.ph`, dan **Fakhrizal Ahmad (10013272)**. Akun Bagus sendiri
   (`10012550`) **belum** tertaut. Setelah dipasang, hanya Fakhrizal yang
   benar-benar akan menerima sampai yang lain menautkan (Dashboard → ikon
   orang → Hubungkan lewat Telegram).
2. **Oktober tanpa NIK**: lewat nama hanya **9 dari 17** ketemu akun.
   September 16/16 lewat NIK. Isi NIK Oktober lewat Jadwal Dinas → Sunting
   (sisa pekerjaan lama nomor 3 di dokumen BERKALA), atau 8 orang tidak
   diingatkan mulai 1 Oktober.
3. Produksi memakai **polling** Telegram. Server uji yang memakai token yang
   sama **wajib** `TELEGRAM_POLLING=` kosong — dua pemoll satu bot saling
   tendang (409).

## Cara mencoba di server uji (worktree `notif-pelaksana`, port 3910/3900)

Worktree itu sedang di `feature/pengingat-semua` (`0ebaa16`). Pindahkan ke
commit ini tanpa mengganggu branch mana pun:

```bash
git -C "D:/Airnav/2026/Teknik JATSC Avenger/.claude/worktrees/notif-pelaksana" checkout --detach feature/avengers-login-visual
```

Salin data produksi (produksi hanya dibaca), dari dalam worktree:

```bash
node elogbook/tools/siapkan-uji.mjs --dari "D:\Airnav\2026\Teknik JATSC Avenger" --timpa
```

Arahkan semua chat Telegram salinan itu ke akun Bagus, memakai chat yang
sekarang menempel di `uji.teknisi` (dari dalam worktree; alat mencetak jalur
DB-nya dulu — pastikan itu jalur worktree):

```bash
node elogbook/tools/telegram-ke-satu-akun.mjs --akun 10012550 --dari uji.teknisi --ya
```

Di `.env` worktree: `TELEGRAM_BOT_TOKEN` = token produksi, **`TELEGRAM_POLLING=`
kosong**, `PENGINGAT_DINAS_MENIT=1440` (supaya dinas Bagus berikutnya — Senin
14 Sep 07:00 WIB — masuk jendela tanpa menunggu pukul 06:00). Nyalakan:

```bash
node jalankan-semua.js
```

Setengah menit kemudian pesan pengingat masuk ke Telegram Bagus. Putaran
berikutnya tidak mengirim lagi (sudah ditandai). Untuk menguji ulang, hapus
tandanya:

```bash
node -e "const {DatabaseSync}=require('node:sqlite');new DatabaseSync('elogbook/data/elogbook.db').exec('DELETE FROM pengingat_dinas')"
```

Setelah oke, kembalikan `.env` worktree (token dikosongkan, menit dihapus).

## Memasang ke produksi

Kodenya sudah di folder produksi (`feature/avengers-login-visual`). Tinggal
restart E-Logbook, tanpa admin:

```powershell
New-Item "D:\Airnav\2026\Teknik JATSC Avenger\restart.minta"
```

Penjaga memeriksa tiap 10 menit (menit berakhiran 3). Buktinya di
`server.log`: baris `jaga-server: restart.minta ditemukan`, dan tidak ada
`[telegram pengingat dinas]` bergalat. `PENGINGAT_DINAS_MENIT` **jangan**
diisi di `.env` produksi — bawaannya 60.

## Sisa pekerjaan

1. Bagus mencoba di server uji, lalu restart produksi (di atas).
2. Isi **NIK Oktober** (dan Agustus kalau mau rapi) di Jadwal Dinas.
3. Umumkan cara menautkan Telegram — baru 1 teknisi sungguhan yang tertaut.
4. Push, kalau diminta. `docs/STATUS-12-SEP-2026-BERKALA.md` masih untracked
   dari sesi lain, tidak disentuh sesi ini.
