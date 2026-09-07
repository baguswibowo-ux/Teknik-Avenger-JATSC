# Status 7 September 2026 — Avenger & E-Logbook di PC sendiri

Catatan serah terima sesi di PC (`D:\Airnav\2026\Teknik JATSC Avenger`).
Ditulis supaya bisa dirujuk di chat baru: sesi Claude terikat ke jalur folder,
jadi sesi di komputer atau folder lain tidak tahu apa pun tentang percakapan
ini. Berkas inilah konteksnya.

## Ringkas

Avenger dan E-Logbook pindah dari Vercel ke PC sendiri, dibuka lewat Cloudflare
Tunnel. Keduanya satu aplikasi Node, bukan frontend dan backend terpisah.

Pemindahan datanya **selesai dan terverifikasi**, termasuk dari HP lewat data
seluler. Domain sudah dibeli dan melayani. Tunnel dan aplikasi sudah bangun
sendiri setelah PC di-restart — **PC ini sudah jadi server**.

Yang tersisa: pindahkan apex dari Vercel ke tunnel, lalu matikan Vercel
seminggu kemudian. Ditambah satu pekerjaan yang belum pernah disentuh:
notifikasi Telegram.

## Keadaan sekarang

| Bagian | Keadaan |
|---|---|
| `teknik-avengers.com` | masih Vercel, melayani teknisi |
| `pc.teknik-avengers.com` | PC ini lewat tunnel, ruang uji |
| Aplikasi | dijalankan Task Scheduler saat boot, terbukti |
| Tunnel | layanan Windows `Cloudflared`, Automatic, Running |
| Cadangan | skrip terbukti; tugas harian 02.00 terpasang |
| Git | cabang `feature/avengers-login-visual`, terdorong ke GitHub |

## Uji restart — lulus

PC di-restart 7 Sep 2026 tanpa menyalakan apa pun dengan tangan.

| Jam | Kejadian |
|---|---|
| 12:28:12 | Windows menyala |
| 12:28:23 | Task Scheduler menjalankan `tools\server.cmd` |
| 12:28:39 | HP membuka, dapat **502** — aplikasi belum sempat mendengar |
| 12:28:55 | `server.cmd` mulai (tercatat di `server.log`) |
| 12:29:04 | port 3000 dan 3100 terisi |
| 12:29:20 | HP membuka, jalan, sudah masuk sebagai Administrator |

502 selama sekitar 50 detik itu **bukan kerusakan**: cloudflared menyala lebih
dulu karena dia layanan Windows, sementara aplikasi menunggu giliran Task
Scheduler. Hanya terjadi saat boot.

Catatan cara memeriksa: tugas berakun SYSTEM **tidak terlihat** oleh
`schtasks /Query` maupun `Get-ScheduledTask` tanpa admin — jawabannya "tidak
ada", padahal ada. Jangan tertipu seperti sesi ini sempat tertipu. Bukti yang
sah: telusuri induk prosesnya (`svchost` yang menghosting layanan `Schedule`),
atau baca baris `server.cmd menyalakan jalankan-semua.js` di `server.log`.

## Data yang sudah terverifikasi

318 entri logbook (6 Agu sampai 6 Sep; radtel 315, ppabn 3), 87 daily check,
4 isu, 32 akun. Lampiran 84 di entri ditambah 7 di isu, total 91 berkas,
semuanya ada dan **ukurannya cocok sampai byte terakhir** dengan yang tercatat
di database. Tanda tangan tersimpan: 16 akun, 20 berkas PNG, semuanya ada.
Galeri foto 7 berkas (6 tercatat di `daftar.json`, 1 yatim — sudah begitu sejak
di laptop).

Sudah dicek langsung di layar HP lewat data seluler: catatan logbook, foto, dan
TTD Saya semuanya tampil.

## Sisa langkah, berurutan

1. **Restart aplikasi** supaya dua perubahan terbaru terbaca:
   `ELOGBOOK_SECURE_COOKIE=1` di `.env`, dan perbaikan handler Telegram.
   Dari PowerShell admin:
   `schtasks /End /TN "Avenger\Server"` lalu `schtasks /Run /TN "Avenger\Server"`
2. **Pindahkan apex.** Hapus catatan `CNAME` ke `cname.vercel-dns.com` di
   Cloudflare, lalu `cloudflared tunnel route dns avenger teknik-avengers.com`.
   Kali ini awan oranye, dan itu diatur sendiri oleh perintahnya.
3. **Seminggu kemudian, matikan Vercel.**
4. **Notifikasi Telegram.** Belum pernah disentuh. Kodenya lengkap, tinggal
   token bot dari BotFather. Inilah yang menutup lubang "tidak ada yang
   memberitahu kalau rusak saat sedang di luar" — penjaganya menyalakan ulang
   diam-diam, dan kalau gagal pun tetap diam.

## Keputusan dan alasannya

**Domain diarahkan ke Vercel dulu, bukan langsung ke PC.** Alasannya bukan
alamat, melainkan jalan pulang: teknisi cukup sekali berganti alamat, dan kalau
PC bermasalah, satu catatan DNS dikembalikan tanpa perlu mengumumkan alamat
cadangan ke siapa pun.

**Beli domain di Cloudflare, bukan Domainesia.** Domainesia Rp 155.289 lawan
Cloudflare Rp 184.418 di tahun pertama. Dipilih yang lebih mahal karena
nameserver-nya sudah di Cloudflare sejak menit pertama — langkah ganti
nameserver hilang total — dan Registrar menjual seharga modal, jadi
perpanjangannya tidak naik.

**Subdomain `pc.` sebagai ruang uji.** Panduan aslinya menyuruh menguji tunnel
sebelum menyentuh DNS, padahal tanpa catatan DNS tidak ada alamat yang bisa
dibuka. `pc.` memecahkan itu, dan sengaja dibiarkan hidup setelah apex pindah
sebagai pintu diagnosis langsung ke PC. Jangan dibagikan ke teknisi — bukan
karena rahasia, tapi supaya tetap ada satu alamat yang pasti bersih untuk
melacak masalah.

## Jebakan yang sudah ketemu

**Layanan cloudflared, dua sekaligus.** Layanannya berjalan sebagai SYSTEM dan
membaca `config.yml` dari profil SYSTEM, bukan profilmu. Dan
`cloudflared service install` versi 2026.8.3 mendaftarkan layanan dengan
`BINARY_PATH_NAME` **tanpa satu argumen pun** — bentuk untuk tunnel yang
dikelola lewat token dashboard, bukan `config.yml`. Windows menjalankan exe
polos, yang mencetak bantuan lalu keluar. Keduanya bergejala sama dan sama-sama
bisu. `tools\pasang-cloudflared.cmd` sekarang mengurus keduanya.

**Cache Cloudflare tidak pernah dibersihkan sendiri.** `s-maxage=31536000`
ditulis untuk Vercel, yang purge otomatis tiap deploy. Di server sendiri tidak
ada deploy, jadi aset lama disajikan setahun penuh walau berkasnya sudah
diubah. Sudah diturunkan ke 300 detik, cache lama di-purge sekali dengan
tangan, dan Browser Cache TTL diubah ke Respect Existing Headers.

**Tiga handler Telegram bertanda tangan salah.** `telegramStatus`,
`telegramTaut`, `telegramPutus` ditulis `(_payload, user)`, padahal dispatcher
memanggil `handler(...args, req.user)` — identitas ditempel sebagai argumen
TERAKHIR. Klien memanggil ketiganya tanpa argumen, jadi user jatuh ke parameter
pertama dan `user.username` melempar TypeError. Lolos lama karena klien
menelan galat 500-nya dan UI menyembunyikan dirinya sendiri, yang kebetulan
benar selama fitur mati. **Baru akan menggigit persis saat token bot
dipasang.** Sudah diperbaiki.

**Ada dua salinan proyek di PC ini.** Yang dipakai `D:\Airnav\2026\Teknik JATSC
Avenger`; ada juga `D:\Airnav\2026\file dari Drive E laptop\test\...` yang
tidak dipakai. Waktu ragu server menunjuk yang mana: buka `/_info` — PC
menjawab `simpanan: berkas`, Vercel menjawab `simpanan: tabel`.

**Proses yang dinyalakan sesi Claude tidak bisa di-`taskkill`,** harus lewat
Task Manager. Dan jangan mengandalkannya: Claude tidak berjaga dan tidak akan
membetulkan apa pun saat kamu di luar. Yang menjaga adalah Task Scheduler dan
layanan Windows.

**Git sempat gagal push berulang** padahal curl, `Invoke-WebRequest`, dan TCP
ke github.com semuanya sukses. Berhasil di percobaan keempat tanpa mengubah apa
pun. Kalau terulang, coba lagi saja.

## Angka dan jalur penting

- Aplikasi: `D:\Airnav\2026\Teknik JATSC Avenger`, Node v24.19.0, port 3100
  (E-Logbook internal 3000, sengaja tidak diekspos)
- Cadangan: `D:\Airnav\2026\Cadangkan` — **satu drive dengan aplikasi**, jadi
  belum aman dari disk rusak. Salin `cermin\` ke drive lain atau cloud.
- Tunnel: `avenger`, `e96f595a-5062-4aea-ba38-287a7b7ef241`
- Kredensial tunnel: `%USERPROFILE%\.cloudflared\<uuid>.json` — **berkas itulah
  tunnelnya**, memindahkannya ke server lain berarti memindahkan tunnel yang
  sama tanpa mengubah DNS
- Salinan konfigurasi layanan:
  `C:\Windows\System32\config\systemprofile\.cloudflared\`
- Domain: dibeli 7 Sep 2026 di Cloudflare Registrar, 10,46 dolar per tahun,
  perpanjangan otomatis. Nameserver `ainsley` dan `morgan.ns.cloudflare.com`.
- Proyek Vercel: `teknik-avenger-jatsc`
- Repo: `github.com/baguswibowo-ux/Teknik-Avenger-JATSC`, cabang
  `feature/avengers-login-visual` (utama = `utama`)

## Kalau membuka chat baru

Sebut berkas ini di pesan pertama. Kalau ingin ingatan Claude ikut pindah,
salin folder `memory` dari profil Claude di laptop ke profil Claude di PC —
ingatannya terikat ke jalur folder, bukan ke akun.
