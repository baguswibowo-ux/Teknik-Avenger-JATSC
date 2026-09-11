# Status 11 September 2026 — Notifikasi Telegram, PH, dan restart tanpa admin

Catatan serah terima untuk chat baru. Sesi Claude terikat ke folder
`D:\Airnav\2026\Teknik JATSC Avenger`; berkas inilah konteksnya. Lanjutan dari
[STATUS-7-SEP-2026.md](STATUS-7-SEP-2026.md).

## Ringkas

Bot Telegram **@Avengers_Teknik_JATSC_bot** hidup di server PC ini (mode
polling) dan mengirim empat macam notifikasi E-Logbook. **Akan diganti** ke
**@Teknik_Avengers_bot** (nama tampilan "Teknik-Avengers") sebelum pengumuman ke
teknisi — tinggal token baru di `.env` + restart, menunggu Bagus di depan PC.
Yang sudah tertaut ke bot lama harus "Hubungkan" ulang. Sekaligus menunggu uji:
branch `feature/telegram-searah` (tombol Putuskan dihapus → "Ganti akun Telegram"). Pejabat bisa menunjuk
**PH** yang menandatangani dari akunnya sendiri. Server bisa **di-restart tanpa
admin** lewat berkas `restart.minta`. Semua sudah di-commit di branch
`feature/avengers-login-visual` — **8 commit di depan origin, belum di-push**.

## Yang jadi hari ini

| Commit | Isi |
|---|---|
| `43af171` | Jalur `/telegram` diteruskan dashboard (webhook, cadangan); alat `npm --prefix elogbook run telegram -- bot\|info\|pasang\|hapus`. Perintah `bot` kini sungguh bertanya ke Telegram (dulu tertipu username di `.env`). |
| `75869f9` | **Restart tanpa admin**: `New-Item restart.minta` → penjaga (SYSTEM, tiap 10 menit di menit berakhiran 3) mematikan pemilik port 3100/3000 lalu menjalankan tugas `Avenger\Server`. |
| `839b6fc` | **⏰ Pengingat**: logbook yang ditujukan ke pejabat tapi belum di-TTD 30 menit **setelah dinasnya berakhir** → teknisi pembuatnya diberi tahu sekali. |
| `463eb15` | **PH** versi 1 (sesama pejabat). |
| `36837b4` | **PH** versi 2: PH boleh teknisi/admin unit/pejabat, dicari lewat nama, menandatangani dari akunnya sendiri. Aturan hak TTD pindah ke `elogbook/ttd-hak.js`. |
| `7dfd0f8` | **Cuplikan**: pesan menyebut jenis lembar sebenarnya + lokasi dan kepala perihal ±50 karakter. Modul `elogbook/ringkas-dokumen.js`. |

## Cara kerja notifikasi

Tiap orang menautkan akunnya **sekali**, sebaiknya dari HP: E-Logbook → **TTD
Saya** → **🔗 Hubungkan Telegram** → Start. Tidak ada nomor HP yang disimpan —
bot hanya mengenal chat ID. Satu chat Telegram hanya bisa tertaut ke satu akun.

| Pesan | Ke siapa | Kapan |
|---|---|---|
| 🔔 Perlu tanda tangan | pejabat yang dituju **dan** PH-nya (kalau aktif) | saat dokumen disimpan |
| ✅ Sudah ditandatangani | pembuat dokumen | saat TTD dibubuhkan |
| ⏰ Belum ditandatangani | pembuat logbook | 30 menit setelah akhir dinas, sekali |

Contoh isi:

```
🔔 Perlu tanda tangan Anda

Dokumen: Logbook — New JATSC
Perihal: CPU B Gatevox 5 kembali restart dan up kembali…
Unit: Radtel
Tanggal: 2026-09-10
Dikirim oleh: Cipto Hadi P.
```

**Akhir dinas (WIB)** — cermin `SHIFT` di `public/js/02-kode-dinas.js`:
Pagi 14:00, Siang 20:00, PS 19:00, Malam 07:00 esok harinya. Tanggal formulir
UTC. Catatan yang disusulkan setelah dinas selesai dihitung dari waktu simpan.
Jendela 6 jam mencegah banjir: 43 logbook lama tak ber-TTD sejak Agustus tidak
ikut diingatkan. `PENGINGAT_TTD_MENIT` di `.env` mengganti 30 menit (hanya untuk
menguji).

**Jebakan waktu menguji ⏰:** formulir otomatis berisi tanggal hari ini dan dinas
pertama (Pagi). Logbook seperti itu baru diingatkan 14:30 WIB. Untuk uji cepat,
**ganti tanggal ke kemarin** — ⏰ datang 30–35 menit setelah disimpan.

## PH (pelaksana harian)

- Pejabat mengatur sendiri di **TTD Saya → panel 🧑‍💼 PH**: cari nama, isi
  tanggal selesai (maks. 90 hari), Simpan. Mati sendiri setelah tanggalnya lewat.
- Selama aktif: dokumen untuk pejabat itu muncul di Kotak Masuk TTD milik PH
  (bertanda "Sebagai PH untuk …"), PH ikut menerima 🔔, dan PH menandatangani
  dari akunnya sendiri dengan TTD tersimpannya.
- Yang tercetak: **"Nama PH (PH Manager Teknik)"**. Sebelumnya, siapa pun yang
  membubuhkan, yang tercetak tetap nama yang diketik teknisi di formulir.
- PH **tidak boleh** menandatangani dokumen buatannya sendiri. Tidak berantai.
- Menggantikan kebiasaan meminjam login akun pejabat.

## Teruji

- Penautan, 🔔 ke pejabat, 🔔 ke PH, PH menandatangani (tercetak
  "Uji PH (PH Manager Teknik)"), penolakan TTD buatan sendiri — oleh Bagus.
- `ttd-hak.js` 15/15, `ringkas-dokumen.js` 21/21 (dua uraian logbook 10 Sep
  sebagai patokan), SQL PH 12/12 dan calon PH 4/4 pada **salinan** database.
- ⏰ **belum terbukti di Telegram** — lihat Sisa pekerjaan nomor 1.

## Sisa pekerjaan

1. **Buktikan ⏰.** Logbook uji.teknisi jam 08:03 (tanggal 11 Sep, dinas Pagi,
   belum di-TTD) harus memicu ⏰ ±14:30–14:35 WIB, asal Telegram masih tertaut
   ke uji.teknisi. Sesudahnya kolom `entries.pengingat_ttd_pada` baris itu terisi.
2. **Bersihkan data uji**: logbook uji; PH uji.pejabat→uji.ph (berlaku s/d
   12 Sep); Putuskan tautan Telegram; nonaktifkan `uji.teknisi`, `uji.pejabat`,
   `uji.ph` (`npm --prefix elogbook run user -- disable <nama>`), hapus lewat UI admin.
3. **Umumkan ke teknisi dan pejabat** — setelah nomor 1–2. Isinya: tautkan dari
   HP lewat TTD Saya; pejabat bisa atur PH sendiri.
4. **Push** 8 commit ini — tunggu perintah Bagus.
5. **Dashboard ke Telegram**: checklist JATSC / New JATSC ada di dashboard
   (Avenger), belum tersambung ke bot sama sekali. Rencana berikutnya Bagus.
6. **Akses admin dari jauh**: AnyDesk di PC ini portable (bukan service) → UAC
   tidak terjangkau. Pasang AnyDesk sebagai service + Unattended Access; butuh
   satu kali "Yes" di UAC oleh orang di depan PC. TeamViewer sudah service
   (ID `307 372 550`, personal password sudah diatur).
7. Kecil: pesan log "mode polling aktif (dev lokal)" padahal ini produksi;
   komentar `elogbook/public/js/20-ttd-pejabat.js:115` bilang daftar TTD berisi
   "admin + pejabat", padahal kuerinya pejabat saja.
8. Dari status 7 Sep: matikan Vercel 12–13 Sep; Supabase jangan dihapus.

## Keputusan dan alasannya

**Polling, bukan webhook.** PC ini hidup terus, jadi polling cukup dan tidak
butuh alamat publik. Webhook disiapkan (`43af171`) hanya sebagai cadangan.

**Telegram, bukan WhatsApp.** WhatsApp resmi berbayar per pesan, butuh nomor
HP semua orang, template disetujui Meta, dan nomor bisa dibatasi. Jalur tidak
resmi melanggar ketentuan dan nomornya bisa diblokir tanpa peringatan.

**Token bot tiga kali bocor lewat tangkapan layar/chat, dan Revoke sempat
tertekan dua kali** — tiap Revoke mematikan token yang baru disalin. Token yang
sekarang di `.env` sah dan bukan salah satu yang bocor (sudah diperiksa).
Aturannya: nilai token hanya di `.env`; periksa dengan
`npm --prefix elogbook run telegram -- bot`. Token dibaca sekali saat server
menyala, jadi ganti token = restart.

**Restart lewat penjaga, bukan admin.** Server milik SYSTEM; akun biasa tidak
bisa mematikannya dan UAC tak terjangkau lewat AnyDesk. `jaga-server.cmd` sudah
SYSTEM, jadi dia yang mengerjakan. Yang dimatikan hanya pemilik port aplikasi
(lewat `netstat`), bukan semua `node.exe`.

**Aturan hak TTD di satu modul.** `ttd-hak.js` dipakai SQLite dan Postgres
sekaligus supaya keduanya tidak bisa berselisih diam-diam, dan bisa diuji tanpa
database.

**Perubahan tampilan butuh muat ulang keras** (Ctrl+Shift+R): JS/CSS disimpan
peramban 1 jam, Cloudflare 5 menit. `index.html` selalu segar.
