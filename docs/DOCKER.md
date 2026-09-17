# Menjalankan Avenger di Docker

Status: **siap dicoba di uji, belum dipakai produksi.**
Berkasnya: `Dockerfile`, `docker-compose.yml`, `docker-compose.uji.yml`,
`.dockerignore`, `tools/docker-data.ps1`.

---

## 1. Kenapa ini masuk akal untuk aplikasi ini

Tidak ada satu pun modul native di sini. SQLite yang dipakai E-Logbook adalah
`node:sqlite`, modul **bawaan Node 24**, dan dependensinya cuma `express` dan
`pg`. Artinya image-nya tipis, build-nya cepat, dan tidak ada risiko "jalan di
Windows, gagal di Linux" yang biasanya datang dari `better-sqlite3` atau
`sharp`.

Yang didapat:

| Sekarang (Windows) | Di Docker |
|---|---|
| `tools/server.cmd` + Task Scheduler `Avenger\Server` | `restart: unless-stopped` |
| `tools/jaga-server.cmd` tiap 10 menit + `restart.minta` | `docker compose restart` (langsung, tanpa admin, tanpa nunggu 10 menit) |
| `jalankan-semua.js` mengasuh dua anak | compose mengasuh dua container |
| `bersihkanPortLama()` netstat/taskkill | tidak perlu: tiap container punya port sendiri |
| pindah ke mesin lain = pasang Node, atur jadwal, dsb | `docker compose up -d` |

Cloudflare tunnel **tidak perlu diubah**: dashboard tetap didengarkan di port
3100 di mesin ini.

---

## 2. Tiga hal yang berubah, dan harus dimengerti sebelum pindah

### a. Data pindah dari `D:\...` ke volume Docker

`elogbook.db` jalan dengan WAL. WAL butuh berkas shared-memory (`-shm`) dan
penguncian berkas sungguhan; jembatan berkas Windows ke container tidak
menyediakan itu dengan andal. Menaruh database di bind mount `D:\` adalah cara
paling cepat mendapat `database is locked` di jam sibuk.

Jadi empat folder ini pindah ke volume Docker:

| Folder sekarang | Volume | Isi |
|---|---|---|
| `data\` | `avenger_data` | JSON dashboard, dokumen, berkas personel, ttd akun |
| `public\foto\` | `avenger_foto` | galeri wajah pegawai |
| `elogbook\data\` | `avenger_elogbook-data` | `elogbook.db`, `push-vapid.json` |
| `elogbook\uploads\` | `avenger_elogbook-uploads` | tanda tangan, foto BAPB |

Isinya tetap bisa dilihat dan dikeluarkan kapan saja lewat
`tools/docker-data.ps1 -Aksi keluarkan`.

**Konsekuensi yang paling gampang bikin panik:** sesudah pindah, menjalankan
`node jalankan-semua.js` di Windows akan membuka data LAMA yang masih tertinggal
di `D:\`, bukan data yang dipakai container. Satu jalan pada satu waktu. Kalau
mau balik ke cara lama, keluarkan dulu datanya (langkah 4).

### b. Zona waktu harus disetel, dan sudah disetel

Beberapa perhitungan memakai waktu lokal mesin (periode berkala, "hari ini" di
jadwal dinas). Container Linux bawaannya UTC. Tanpa `TZ=Asia/Jakarta`, jam
00:00-07:00 WIB terhitung sebagai hari kemarin. Sudah dipasang di `Dockerfile`
dan diulang di compose.

### c. Log tidak lagi menumpuk di `server.log`

Keluaran dua server jadi log container: `docker compose logs -f`. Rotasinya
diurus Docker. `server.log` di folder ini berhenti bertambah.

---

## 3. Mencoba dulu di server uji (produksi tidak disentuh)

Pakai nama proyek `avenger-uji`, port 3900/3910 - sama seperti `tools/uji.ps1`,
jadi `uji.teknik-avengers.com` yang sudah ada langsung terpakai. Volume-nya
berbeda dari produksi, token Telegram dikosongkan, dan `push-vapid.json` tidak
ikut disalin.

Isi volume uji dengan salinan data produksi:

```bash
powershell -ExecutionPolicy Bypass -File "D:\Airnav\2026\Teknik JATSC Avenger\tools\docker-data.ps1" -Uji
```

Nyalakan:

```bash
docker compose -p avenger-uji -f docker-compose.yml -f docker-compose.uji.yml up -d --build
```

Buka `http://localhost:3910/` atau `https://uji.teknik-avengers.com`.
Produksi yang jalan di 3100 sama sekali tidak tersentuh selama ini.

Melihat keluarannya:

```bash
docker compose -p avenger-uji -f docker-compose.yml -f docker-compose.uji.yml logs -f
```

Mematikannya:

```bash
docker compose -p avenger-uji -f docker-compose.yml -f docker-compose.uji.yml down
```

Yang layak diperiksa saat mencoba: masuk dengan akun, buka `/logbook/`, unggah
satu tanda tangan (uji tulis ke volume uploads), lihat galeri foto, dan cek
jadwal dinas menampilkan hari yang benar - yang terakhir itu yang membuktikan
zona waktunya betul.

---

## 4. Pindah produksi ke Docker

Dikerjakan saat sepi, dan urutannya penting.

**Langkah 1.** Matikan server Windows dan penjaganya supaya tidak menyalakan
ulang di tengah jalan (Command Prompt **sebagai administrator**):

```bash
schtasks /End /TN "Avenger\Server"
```

```bash
schtasks /Change /TN "Avenger\Server (jaga)" /DISABLE
```

```bash
schtasks /Change /TN "Avenger\Server" /DISABLE
```

```bash
schtasks /Change /TN "Avenger\Cadangan" /DISABLE
```

**Langkah 2.** Pastikan tidak ada lagi yang memegang port 3100:

```bash
netstat -ano | findstr ":3100 "
```

**Langkah 3.** Salin data ke volume produksi:

```bash
powershell -ExecutionPolicy Bypass -File "D:\Airnav\2026\Teknik JATSC Avenger\tools\docker-data.ps1"
```

**Langkah 4.** Nyalakan, lalu periksa `http://localhost:3100/` dan
`https://teknik-avengers.com`:

```bash
docker compose up -d --build
```

**Langkah 5.** Cadangan, gantinya tugas `Avenger\Cadangan`:

```bash
docker compose --profile alat run --rm cadangan
```

Hasilnya mendarat di `.\cadangan` seperti biasa, dengan rotasi dan `VACUUM
INTO` yang sama - `tools/cadangkan.js` yang dipakai, bukan skrip baru.

Yang tidak ikut: salinan kedua ke `CADANGAN_LUAR` (`C:\Airnav\Cadangan...`).
Folder itu tidak ada di dalam container, jadi langkah itu dikosongkan di
compose dan tetap dikerjakan mesin ini. Satu baris `robocopy` sesudah perintah
di atas sudah cukup:

```bash
robocopy "D:\Airnav\2026\Teknik JATSC Avenger\cadangan" "C:\Airnav\Cadangan" /MIR /R:1 /W:1
```

Ganti tugas terjadwal `Avenger\Cadangan` dengan satu file `.cmd` berisi dua
baris itu, tiap 12 jam seperti sekarang.

### Kalau ada yang tidak beres: balik ke cara lama

Data lama masih utuh di `D:\` selama belum ditimpa, jadi baliknya cepat:

```bash
docker compose down
```

```bash
schtasks /Change /TN "Avenger\Server" /ENABLE
```

```bash
schtasks /Change /TN "Avenger\Server (jaga)" /ENABLE
```

```bash
schtasks /Run /TN "Avenger\Server"
```

Catatan jujur: perubahan yang dibuat pengguna **selama** container jalan ada di
volume, bukan di `D:\`. Kalau sudah ada isian baru dan mau balik ke cara lama,
keluarkan dulu:

```bash
powershell -ExecutionPolicy Bypass -File "D:\Airnav\2026\Teknik JATSC Avenger\tools\docker-data.ps1" -Aksi keluarkan -Tujuan "D:\Airnav\2026\keluar-docker"
```

lalu salin isinya menimpa `data\`, `public\foto\`, `elogbook\data\`, dan
`elogbook\uploads\`.

---

## 5. Perintah sehari-hari

```bash
docker compose up -d --build
```

```bash
docker compose restart dashboard
```

```bash
docker compose logs -f dashboard
```

```bash
docker compose ps
```

```bash
docker compose down
```

Memasang kode baru sesudah `git pull`: `docker compose up -d --build`. Ini
sekaligus menjawab masalah "js baru tapi server belum dinyalakan ulang" -
container selalu naik dengan kode yang baru saja dibangun.

---

## 6. Mengangkat ke VPS Linux nanti

Yang perlu dibawa cuma tiga: kode (git), `.env`, dan isi keempat volume.

1. Di VPS: pasang Docker, `git clone`, taruh `.env`.
2. Keluarkan volume di mesin ini dengan `-Aksi keluarkan`, kirim foldernya
   (rsync/scp/hard disk), lalu isi volume di sana dengan `docker run --rm -v ...`
   yang sama seperti di dalam skrip.
3. `docker compose up -d --build`.
4. Arahkan Cloudflare tunnel ke VPS.

Tidak ada langkah khusus Windows yang tertinggal: yang dipakai container cuma
Node, dan berkas `.cmd`/`.ps1` sudah dikeluarkan dari image lewat
`.dockerignore`.

---

## 7. Yang sengaja TIDAK dimasukkan ke container

- **cloudflared** - tetap di host. Menaruhnya di compose berarti kredensial
  tunnel ikut hidup-mati bersama aplikasi, padahal tunnel justru yang harus
  tetap berdiri saat aplikasi dinyalakan ulang.
- **Salinan ke Google Drive** - klien Drive-nya di Windows. Container cuma
  menulis ke folder cadangan; yang mengangkatnya ke Drive tetap mesin ini.
- **`tools/uji.ps1`** - dibiarkan apa adanya. Selama Docker belum dipercaya
  penuh, dua jalan uji boleh hidup berdampingan.
