# Status 7 September 2026 — Avenger & E-Logbook pindah ke PC sendiri

Catatan serah terima sesi di PC (`D:\Airnav\2026\Teknik JATSC Avenger`).
Ditulis supaya bisa dirujuk di chat baru: sesi Claude terikat ke jalur folder,
jadi sesi di komputer atau folder lain tidak tahu apa pun tentang percakapan
ini. Berkas inilah konteksnya.

## Ringkas

Avenger dan E-Logbook pindah dari Vercel ke PC sendiri, dibuka lewat Cloudflare
Tunnel. Keduanya satu aplikasi Node, bukan frontend dan backend terpisah.
Vercel tetap dipertahankan seminggu sebagai jalan pulang.

Hari ini pemindahan datanya selesai dan terverifikasi, domain dibeli dan sudah
melayani, tunnel sudah jadi layanan Windows. Yang tersisa: jadwal Windows untuk
aplikasi dan cadangan, uji restart, lalu pemindahan apex dari Vercel ke tunnel.

## Keadaan sekarang

| Bagian | Keadaan |
|---|---|
| `teknik-avengers.com` | Vercel, melayani teknisi |
| `pc.teknik-avengers.com` | PC ini lewat tunnel, ruang uji |
| Aplikasi (port 3100) | jalan, tapi **belum** dijadwalkan — mati kalau PC restart |
| Tunnel | layanan Windows `Cloudflared`, Automatic, Running |
| Cadangan | skrip jalan dan terbukti, **jadwalnya belum dipasang** |
| Git | cabang `feature/avengers-login-visual`, terdorong ke GitHub |

## Yang sudah selesai dan terbukti hari ini

**Data lengkap di PC.** 318 entri logbook (6 Agu–6 Sep, radtel 315, ppabn 3),
87 daily check, 4 isu, 32 akun. Lampiran 84 di entri + 7 di isu = 91 berkas,
semuanya ada di disk dan **ukurannya cocok sampai byte terakhir** dengan yang
tercatat di database. Tanda tangan tersimpan: 16 akun, 20 berkas PNG, semuanya
ada. Galeri foto 7 berkas (6 tercatat di `daftar.json`, 1 yatim — sudah begitu
sejak di laptop).

**Domain.** `teknik-avengers.com` dibeli 7 Sep 2026 di Cloudflare Registrar,
$10,46/tahun, perpanjangan otomatis di harga sama. Nameserver `ainsley` dan
`morgan.ns.cloudflare.com`. Apex `CNAME` ke `cname.vercel-dns.com`, DNS only.
HTTPS aktif, sertifikat sah, `http://` dialihkan 308.

**Tunnel.** Tunnel bernama `avenger`, ID `e96f595a-5062-4aea-ba38-287a7b7ef241`.
Dua hostname di ingress: `pc.` untuk ruang uji, apex disiapkan untuk nanti.
Hanya port 3100 yang dipetakan; E-Logbook di 3000 sengaja tidak diekspos.
Sudah jadi layanan Windows lewat `tools\pasang-cloudflared.cmd`.

**Cadangan.** `CADANGAN_DIR` diperbaiki dari `E:\2026\Cadangkan` (warisan
laptop) menjadi `D:\Airnav\2026\Cadangkan`. Cadangan pertama dibuat: 65 MB,
dan potret DB-nya sudah dibuka untuk memastikan bukan berkas rusak — 318 entri,
84 lampiran, 32 akun, sama persis dengan yang hidup.

**Cache.** `s-maxage` aset statis diturunkan dari 31536000 (setahun) jadi 300
detik. Browser Cache TTL di Cloudflare diubah ke Respect Existing Headers.
Cache lama sudah di-purge sekali dengan tangan.

## Sisa langkah, berurutan

1. `tools\pasang-jadwal.cmd` dari Command Prompt admin — tiga tugas SYSTEM:
   server saat Windows menyala, penjaga tiap 10 menit, cadangan harian 02.00.
   **Tutup dulu `npm start` yang sedang jalan**, kalau tidak bentrok port.
2. **Restart PC** dan jangan nyalakan apa pun dengan tangan. Ini uji yang
   sebenarnya. Sekarang saat paling aman untuk gagal, karena teknisi masih
   dilayani Vercel.
3. Nyalakan `ELOGBOOK_SECURE_COOKIE=1` di `.env`.
4. Pindahkan apex: hapus `CNAME` ke `cname.vercel-dns.com`, lalu
   `cloudflared tunnel route dns avenger teknik-avengers.com`. Kali ini awan
   oranye, dan itu diatur sendiri oleh perintahnya.
5. Seminggu kemudian, matikan Vercel.

Belum tersentuh sama sekali: notifikasi Telegram. Kodenya lengkap, tinggal
token bot dari BotFather. Inilah yang menutup lubang "tidak ada yang
memberitahu kalau rusak saat sedang di luar".

## Keputusan dan alasannya

**Domain diarahkan ke Vercel dulu, bukan langsung ke PC.** Alasannya bukan
alamat, melainkan jalan pulang: teknisi cukup sekali berganti alamat, dan kalau
PC bermasalah, satu catatan DNS dikembalikan tanpa perlu mengumumkan alamat
cadangan ke siapa pun.

**Beli domain di Cloudflare, bukan Domainesia.** Domainesia Rp 155.289 vs
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

**Layanan cloudflared, dua jebakan sekaligus.** Layanannya berjalan sebagai
SYSTEM dan membaca `config.yml` dari profil SYSTEM, bukan profilmu. Dan
`cloudflared service install` versi 2026.8.3 mendaftarkan layanan dengan
`BINARY_PATH_NAME` **tanpa satu argumen pun** — bentuk untuk tunnel yang
dikelola lewat token dashboard, bukan `config.yml`. Windows menjalankan exe
polos, yang mencetak bantuan lalu keluar. Keduanya bergejala sama dan sama-sama
bisu. `tools\pasang-cloudflared.cmd` sekarang mengurus keduanya.

**Cache Cloudflare tidak pernah dibersihkan sendiri.** `s-maxage=31536000`
ditulis untuk Vercel, yang purge otomatis tiap deploy. Di server sendiri tidak
ada deploy, jadi aset lama disajikan setahun penuh walau berkasnya sudah
diubah. Gejalanya menyesatkan: kelihatan seperti kode tidak jalan.

**Ada dua salinan proyek di PC ini.** Yang dipakai `D:\Airnav\2026\Teknik JATSC
Avenger`; ada juga `D:\Airnav\2026\file dari Drive E laptop\test\...` yang
tidak dipakai. Waktu ragu server menunjuk yang mana, caranya: minta berkas yang
hanya ada di salinan benar, lalu bandingkan ukurannya. Atau buka `/_info` —
PC menjawab `simpanan: berkas`, Vercel menjawab `simpanan: tabel`.

**Proses yang dinyalakan sesi Claude tidak bisa di-`taskkill`.** Harus lewat
Task Manager. Dan jangan mengandalkannya: itu hidup selama sesi Claude hidup,
bukan selama PC hidup. Claude tidak berjaga dan tidak akan membetulkan apa pun
saat kamu di luar — yang menjaga adalah Task Scheduler dan layanan Windows.

**Git sempat gagal push berulang** padahal curl, `Invoke-WebRequest`, dan TCP
ke github.com semuanya sukses. Berhasil di percobaan keempat tanpa mengubah
apa pun. Kalau terulang, coba lagi saja.

## Angka dan jalur penting

- Aplikasi: `D:\Airnav\2026\Teknik JATSC Avenger`, Node v24.19.0, port 3100
  (E-Logbook internal 3000)
- Cadangan: `D:\Airnav\2026\Cadangkan` — **satu drive dengan aplikasi**, jadi
  belum aman dari disk rusak. Salin `cermin\` ke drive lain atau cloud.
- Tunnel: `avenger`, `e96f595a-5062-4aea-ba38-287a7b7ef241`
- Kredensial tunnel: `%USERPROFILE%\.cloudflared\<uuid>.json` — **berkas itulah
  tunnelnya**, memindahkannya ke server lain berarti memindahkan tunnel yang
  sama tanpa mengubah DNS
- Salinan konfigurasi layanan:
  `C:\Windows\System32\config\systemprofile\.cloudflared\`
- Proyek Vercel: `teknik-avenger-jatsc`
- Repo: `github.com/baguswibowo-ux/Teknik-Avenger-JATSC`, cabang
  `feature/avengers-login-visual` (utama = `utama`)

## Kalau membuka chat baru

Sebut berkas ini di pesan pertama. Kalau ingin ingatan Claude ikut pindah,
salin folder `memory` dari profil Claude di laptop ke profil Claude di PC —
ingatannya terikat ke jalur folder, bukan ke akun.
