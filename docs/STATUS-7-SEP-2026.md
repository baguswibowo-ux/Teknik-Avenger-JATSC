# Status 7 September 2026 — Avenger & E-Logbook di PC sendiri

Catatan serah terima sesi di PC (`D:\Airnav\2026\Teknik JATSC Avenger`).
Ditulis supaya bisa dirujuk di chat baru: sesi Claude terikat ke jalur folder,
jadi sesi di komputer atau folder lain tidak tahu apa pun tentang percakapan
ini. Berkas inilah konteksnya.

## Ringkas

**Pemindahan selesai.** Sejak 7 Sep 2026 sore, `teknik-avengers.com` dilayani
PC sendiri lewat Cloudflare Tunnel. Supabase tidak menerima tulisan baru lagi;
Vercel menganggur.

Yang tersisa cuma dua: matikan Vercel akhir pekan ini, dan kerjakan notifikasi
Telegram.

## Keadaan sekarang

| Bagian | Keadaan |
|---|---|
| `teknik-avengers.com` | **PC ini**, lewat tunnel — dipakai teknisi |
| `pc.teknik-avengers.com` | PC ini juga, pintu diagnosis. Jangan dibagikan |
| Vercel | menganggur, dimatikan Sabtu/Minggu 12–13 Sep |
| Supabase | beku sejak 14:43. **Jangan dihapus** — salinan gratis |
| Aplikasi | Task Scheduler saat boot + penjaga tiap 10 menit |
| Tunnel | layanan Windows `Cloudflared`, Automatic |
| Cadangan | 02.00 dan 14.00, ke `D:`, ke `E:`, lalu Drive menyusul |
| Git | `feature/avengers-login-visual`, terdorong ke GitHub |

## Yang harus diingat sekarang

**Jalan pulang ke Vercel sudah tidak gratis lagi.** Sejak apex pindah, catatan
teknisi hanya masuk ke SQLite di PC. Mengembalikan CNAME ke Vercel berarti
mereka melihat data yang beku sejak 7 Sep 14:43 — catatan sesudah itu tidak
akan terlihat, dan **tidak ada skrip yang mendorongnya balik ke Supabase**
(`tarik-supabase.js` satu arah, semua kuerinya `SELECT`). Kalau ada masalah,
jalannya diperbaiki di tempat, bukan mundur.

**Tidak ada failover otomatis, dan itu disengaja.** Kalau DNS berpindah sendiri
ke Vercel saat PC mati, teknisi akan dilayani data beku tanpa tanda apa pun,
lalu menulis ke Supabase — data terbelah di dua tempat tanpa ada yang sadar.
Itu jauh lebih sulit dibereskan daripada aplikasi yang mati beberapa jam dan
semua orang tahu.

**Belum ada yang memberitahumu kalau rusak.** Penjaganya bekerja diam-diam,
berhasil maupun gagal. Itu lubang yang ditutup notifikasi Telegram.

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

502 selama sekitar 50 detik itu bukan kerusakan: cloudflared menyala lebih dulu
karena dia layanan Windows, aplikasi menunggu giliran Task Scheduler. Hanya
terjadi saat boot.

Catatan cara memeriksa: tugas berakun SYSTEM **tidak terlihat** oleh
`schtasks /Query` maupun `Get-ScheduledTask` tanpa admin — jawabannya "tidak
ada", padahal ada. Sesi ini sempat tertipu. Bukti yang sah: telusuri induk
prosesnya (`svchost` yang menghosting layanan `Schedule`), atau baca baris
`server.cmd menyalakan jalankan-semua.js` di `server.log`.

## Data

Ditarik ulang tepat sebelum apex dipindah, jadi tidak ada yang tertinggal di
Supabase. 15 tabel cocok persis: 319 entri, 84 lampiran, 32 akun, 87 daily
check, 4 isu. Storage 840 berkas. Tanda tangan tersimpan 16 akun, 20 berkas
PNG. Galeri foto 11 berkas.

Sudah dicek langsung di layar HP lewat data seluler: catatan logbook, foto, dan
TTD Saya semuanya tampil.

## Cadangan

Dua kali sehari, **02.00 dan 14.00**, satu tugas `HOURLY /MO 12` — bukan dua
tugas terpisah, karena dua tugas gampang berbeda diam-diam waktu salah satunya
disunting. Retensi 14 hari, di kedua salinan lokal.

Tiga tujuan, masing-masing menjaga dari hal yang berbeda:

- `D:\Airnav\2026\Cadangkan` — dari salah hapus dan salah ubah.
- `E:\Airnav\Cadangan Avenger` — dari disk D: rusak. E: (Seagate) disk
  fisik yang berbeda dari WD tempat D: berada, dan itulah satu-satunya syarat
  yang penting. Terbukti: 1343 berkas, 182,3 MB.
- Google Drive — dari PC-nya sendiri hilang, terbakar, atau kena ransomware.
  **Bukan lewat huruf drive.** Di setelan Google Drive for Desktop, menu
  "Folders from your computer", folder `D:\Airnav\2026\Cadangkan`
  ditambahkan untuk disinkronkan. Drive mengunggahnya sebagai penggunamu.

Isinya: potret harian (`elogbook.db` 1,2 MB + `data/` 17 MB, dibuat baru tiap
kali) dan cermin (lampiran, TTD, foto — hanya menambah yang baru). Sekitar
550 MB di keadaan mapan dengan retensi 14 hari.

**Jangan pernah mengarahkan cadangan ke F:.** Di komputer ini D: dan F:
kelihatan dua drive padahal satu disk fisik (WD 2TB), jadi sisanya yang 540 GB
sama sekali tidak menolong. Yang benar-benar terpisah cuma C: dan E:.

Kalau `CADANGAN_LUAR` tidak terjangkau, `cadangkan.js` gagal dengan kode keluar
1 — sengaja berisik. Cadangan luar yang berhenti diam-diam adalah cadangan yang
tidak ada, dan baru ketahuan persis di hari kamu membutuhkannya.

## Sisa langkah

1. **Sabtu/Minggu 12–13 Sep: matikan Vercel.** Supabase tetap dibiarkan.
2. **Notifikasi Telegram.** Kodenya lengkap dan bug-nya sudah diperbaiki,
   tinggal token bot dari BotFather.
3. Nanti kalau mau: `sc.exe failure Cloudflared reset= 86400 actions= restart/20000/restart/60000/restart/120000`
   supaya kegagalan kedua dan seterusnya juga dinyalakan ulang, bukan cuma yang
   pertama.

## Keputusan dan alasannya

**Domain diarahkan ke Vercel dulu, baru dipindah ke PC.** Teknisi cukup sekali
berganti alamat, dan selama masa uji, satu catatan DNS bisa dikembalikan tanpa
mengumumkan alamat cadangan ke siapa pun.

**Beli domain di Cloudflare, bukan Domainesia.** Rp 184.418 lawan Rp 155.289 di
tahun pertama. Yang lebih mahal dipilih karena nameserver-nya sudah di
Cloudflare sejak menit pertama — langkah ganti nameserver hilang total — dan
Registrar menjual seharga modal, jadi perpanjangannya tidak naik.

**Subdomain `pc.` sebagai ruang uji.** Panduan aslinya menyuruh menguji tunnel
sebelum menyentuh DNS, padahal tanpa catatan DNS tidak ada alamat yang bisa
dibuka. Dibiarkan hidup setelah apex pindah sebagai pintu diagnosis langsung ke
PC. Jangan dibagikan ke teknisi — bukan karena rahasia, tapi supaya tetap ada
satu alamat yang pasti bersih untuk melacak masalah.

**Cadangan dua kali sehari, bukan sekali.** Yang menentukan bukan besar
berkasnya — cadangan kedua hampir gratis karena cermin cuma menyalin yang baru
— melainkan berapa banyak pekerjaan teknisi yang rela hilang kalau disk mati
tepat sebelum cadangan berikutnya.

## Jebakan yang sudah ketemu

**Layanan cloudflared, dua sekaligus.** Layanannya berjalan sebagai SYSTEM dan
membaca `config.yml` dari profil SYSTEM, bukan profilmu. Dan
`cloudflared service install` versi 2026.8.3 mendaftarkan layanan dengan
`BINARY_PATH_NAME` **tanpa satu argumen pun** — bentuk untuk tunnel yang
dikelola lewat token dashboard. Windows menjalankan exe polos, yang mencetak
bantuan lalu keluar. Keduanya bergejala sama dan sama-sama bisu.
`tools\pasang-cloudflared.cmd` mengurus keduanya.

**Cloudflare tidak memaksa HTTPS sendiri.** Vercel dulu menjawab 308 untuk
`http://`. Cloudflare menjawab 200 apa adanya. Digabung dengan
`ELOGBOOK_SECURE_COOKIE=1`, siapa pun yang membuka lewat `http://` tidak akan
bisa login — sandinya benar, halamannya menerima, tapi mereka tetap di halaman
masuk tanpa pesan galat. Ditutup dengan **Always Use HTTPS** di SSL/TLS → Edge
Certificates. Sekarang `http://` menjawab 301.

**Cache Cloudflare tidak pernah dibersihkan sendiri.** `s-maxage=31536000`
ditulis untuk Vercel, yang purge otomatis tiap deploy. Di server sendiri tidak
ada deploy, jadi aset lama disajikan setahun penuh walau berkasnya sudah
diubah. Diturunkan ke 300 detik, cache lama di-purge sekali, dan Browser Cache
TTL diubah ke Respect Existing Headers.

**Tiga handler Telegram bertanda tangan salah.** `telegramStatus`,
`telegramTaut`, `telegramPutus` ditulis `(_payload, user)`, padahal dispatcher
memanggil `handler(...args, req.user)` — identitas ditempel sebagai argumen
TERAKHIR. Klien memanggil ketiganya tanpa argumen, jadi user jatuh ke parameter
pertama dan `user.username` melempar TypeError. Lolos lama karena klien menelan
galat 500-nya dan UI menyembunyikan dirinya sendiri, yang kebetulan benar
selama fitur mati. Baru akan menggigit persis saat token bot dipasang. Sudah
diperbaiki.

**Huruf drive Google Drive tidak terlihat oleh SYSTEM.** Cadangan sempat
diarahkan ke `G:\My Drive\...`. Dijalankan dengan tangan berhasil — 1083
berkas naik. Dijalankan Task Scheduler sebagai SYSTEM selalu gagal, karena
huruf drive yang dipasang Google Drive for Desktop cuma hidup di sesi login
penggunanya. Obatnya bukan memaksa SYSTEM melihat G:, tapi membalik arahnya:
skrip menulis ke disk biasa, dan Drive yang menyusul lewat "Folders from your
computer". Ketahuan hanya karena skripnya sengaja gagal dengan berisik.

**Ada dua salinan proyek di PC ini.** Yang dipakai `D:\Airnav\2026\Teknik JATSC
Avenger`; ada juga `D:\Airnav\2026\file dari Drive E laptop\test\...` yang
tidak dipakai. Waktu ragu server menunjuk yang mana: buka `/_info` — PC
menjawab `simpanan: berkas`, Vercel menjawab `simpanan: tabel`.

**Proses yang dinyalakan sesi Claude tidak bisa di-`taskkill`,** harus lewat
Task Manager. Dan jangan mengandalkannya: Claude tidak berjaga dan tidak akan
membetulkan apa pun saat kamu di luar. Yang menjaga adalah Task Scheduler dan
layanan Windows.

**Git sempat gagal push berulang** padahal curl, `Invoke-WebRequest`, dan TCP
ke github.com semuanya sukses. Berhasil setelah beberapa kali coba tanpa
mengubah apa pun. Kalau terulang, coba lagi saja.

## Angka dan jalur penting

- Aplikasi: `D:\Airnav\2026\Teknik JATSC Avenger`, Node v24.19.0, port 3100
  (E-Logbook internal 3000, sengaja tidak diekspos)
- Cadangan lokal: `D:\Airnav\2026\Cadangkan`
- Cadangan luar: `E:\Airnav\Cadangan Avenger` (disk fisik lain)
- Tunnel: `avenger`, `e96f595a-5062-4aea-ba38-287a7b7ef241`
- Kredensial tunnel: `%USERPROFILE%\.cloudflared\<uuid>.json` — **berkas itulah
  tunnelnya**, memindahkannya ke server lain berarti memindahkan tunnel yang
  sama tanpa mengubah DNS
- Salinan konfigurasi layanan:
  `C:\Windows\System32\config\systemprofile\.cloudflared\`
- Tugas: `Avenger\Server` (saat boot), `Avenger\Server (jaga)` (tiap 10 menit),
  `Avenger\Cadangan` (tiap 12 jam dari 02.00)
- Domain: dibeli 7 Sep 2026 di Cloudflare Registrar, 10,46 dolar per tahun,
  perpanjangan otomatis. Nameserver `ainsley` dan `morgan.ns.cloudflare.com`.
- Disk: D: dan F: satu disk fisik (WD 2TB). C: NVMe (drive sistem, sengaja
  dibiarkan lega), E: Seagate — dua ini yang benar-benar terpisah dari D:.
- Proyek Vercel: `teknik-avenger-jatsc`
- Repo: `github.com/baguswibowo-ux/Teknik-Avenger-JATSC`, cabang
  `feature/avengers-login-visual` (utama = `utama`)

## Kalau membuka chat baru

Sebut berkas ini di pesan pertama. Kalau ingin ingatan Claude ikut pindah,
salin folder `memory` dari profil Claude di laptop ke profil Claude di PC —
ingatannya terikat ke jalur folder, bukan ke akun.
