# Dashboard Fasilitas Teknik JATSC — "Avenger"

Dashboard fasilitas teknik untuk New JATSC. Aplikasi ini **berdiri sendiri**:
punya server sendiri, halaman sendiri, dan tidak menumpang di proyek mana pun.

Data yang **sudah jadi** di E-Logbook — daftar unit, isu, catatan logbook —
tidak ditulis ulang di sini. Diambil dari servernya yang sudah jalan.

## Menjalankan

```bash
npm install
npm start
```

Lalu buka <http://localhost:3100>.

Di Windows bisa juga klik dua kali `jalankan.cmd` — ia memasang dependensi kalau
belum ada, lalu menyalakan servernya.

Untuk mengembangkan, `npm run dev` menyalakan ulang server tiap berkasnya
berubah.

## Susunan berkas

```
server.js            Express: menyajikan public/ dan meneruskan /api/* ke E-Logbook
public/
  index.html         seluruh dashboard — satu berkas, 3.100+ baris
  foto/<unit>/       foto dokumentasi kegiatan, tampil di tab Galeri
  vendor/
    three.min.js     panggung 3D layar masuk (three 0.147.0)
    font/            Space Grotesk, IBM Plex Sans, IBM Plex Mono (subset latin)
docs/                catatan proyek
```

Tidak ada satu pun permintaan ke internet. three.js dan fontnya ikut dibawa di
`public/vendor/`, jadi build ini utuh di jaringan kantor yang tertutup.

## Sambungan ke E-Logbook

E-Logbook tetap di tempatnya:

```
D:\Airnav\2025\JATSC\New JATSC\2026\Faskompen\E-LogBook-Server
```

Berkasnya **tidak pernah disunting dari proyek ini** — statusnya sumber data dan
tempat uji coba. Jalankan `npm start` di sana (port 3000) sebelum menyalakan
dashboard ini kalau mau memakai data nyata.

### Kenapa lewat penerusan, bukan panggilan langsung

Dashboard disajikan dari `localhost:3100`, E-Logbook hidup di `localhost:3000`.
Bagi browser itu dua asal berbeda: fetch lintas asal ditolak dan cookie sesinya
tidak ikut terkirim. Karena diteruskan lewat `server.js`, bagi browser semuanya
tetap satu asal — blok "Jembatan E-Logbook" di `public/index.html` jalan apa
adanya, tanpa satu baris pun diubah dari bentuk aslinya.

Jalur yang diteruskan: `/api/*` dan `/uploads/*`.

### Masuk dan membuka E-Logbook

**Pilih tujuan lebih dulu.** Paling atas di kartu masuk ada dua pilihan:
**Dashboard Teknik** atau **E-Logbook**. Dua aplikasi berbeda, satu akun, dan
sekarang satu pintu — yang datang mencari logbook harian tidak perlu tahu alamat
E-Logbook, cukup memilihnya di sini.

Memilih E-Logbook melepas kolom username dan password dari halaman, bukan sekadar
meredupkannya. Selama kolom itu masih kelihatan, akan selalu ada yang mengetikkan
passwordnya di sana padahal yang dituju aplikasi sebelah, lalu mengira akunnya
bermasalah.

**Masuk dengan akun E-Logbook.** Dengan tujuan **Dashboard Teknik**, pilih sumber
**Server E-Logbook** lalu isi username dan password E-Logbook Anda. Kalau di
peramban itu sesi E-Logbook masih hidup, tombolnya berubah jadi "Lanjutkan
sebagai …" dan password tidak diminta lagi.

**Membuka aplikasi E-Logbook.** Selain lewat pilihan tujuan di kartu masuk,
tombol **Buka E-Logbook** ada di ikon buku pada kepala halaman dan di layar unit.
Semuanya membuka E-Logbook di tab baru.

Tombol itu menunjuk E-Logbook **langsung**, bukan lewat penerusan — seluruh aset
E-Logbook memanggil `/css/` dan `/js/` dari akar, dan akar di sini milik
dashboard. Alamatnya dirangkai dari hostname yang sedang dipakai peramban
ditambah port E-Logbook, jadi ikut benar walau dashboard dibuka dari komputer
lain. Kalau E-Logbook ada di alamat yang lain sendiri, isi `ELOGBOOK_TAUTAN`.

E-Logbook tidak membaca satu pun parameter URL dan unit aktifnya hanya ada di
memori, jadi tidak ada cara menunjuk unit tertentu dari luar — tombolnya membuka
aplikasinya saja, unitnya dipilih di sana.

### Kelola Akun

Administrator yang masuk lewat server E-Logbook mendapat tab **Kelola Akun**.
Dari situ akun E-Logbook bisa ditambah, diganti nama tampilan, peran, dan unit
logbooknya, diganti passwordnya, dinonaktifkan, dan dihapus — tanpa perlu
membuka E-Logbook.

Akunnya tetap milik E-Logbook. Dashboard ini tidak menyimpan akun sendiri, tidak
membuka basis datanya, dan tidak menyunting satu pun berkasnya: yang dipakai
hanya fungsi administrator yang sudah ada di API-nya (`listUsers`, `addUser`,
`setUserNama`, `setUserRole`, `setUserUnit`, `setUserAktif`, `setUserPassword`,
`deleteUser`), lewat penerusan `/api/*` yang sama dengan data lainnya.

Tab ini disembunyikan dari peran selain administrator, tapi itu **cuma
kenyamanan** — yang benar-benar menjaga adalah E-Logbook, yang menolak seluruh
fungsi di atas dengan 403 untuk peran lain. Menyembunyikan tombol tidak pernah
jadi pengaman.

Dua hal yang sengaja dibuat merepotkan, karena keduanya tidak bisa dibatalkan:
menghapus akun hanya boleh setelah akunnya nonaktif, dan tombolnya baru hidup
setelah usernamenya diketik ulang persis. Catatan logbook yang pernah diinput
akun itu tetap tinggal, bahkan setelah akunnya hilang.

Password lama tidak bisa dilihat dari mana pun, termasuk dari sini — yang
tersimpan di E-Logbook hanya sidik acaknya. Yang tersedia cuma menggantinya.

### Kalau E-Logbook mati

Pemeriksaan `/api/me` gagal, pilihan sumber "server" padam sendiri, dan halaman
jatuh ke **data contoh** — semuanya karangan, dan pita di puncak layar menulis
`PROTOTIPE` supaya tidak ada yang mengira angkanya nyata.

### Yang belum nyata walau sudah tersambung

Peralatan, sparepart, jadwal dinas, dan sejarah peralatan **masih data contoh**
sekalipun sudah tersambung — modulnya memang belum ada di E-Logbook. Layarnya
menandai ini terang-terangan di tiap tempat yang terpengaruh.

## Menambah foto galeri

Tab **Galeri** di dashboard unit menampilkan foto dokumentasi kegiatan. Ini foto
sungguhan, bukan ilustrasi — dan bukan pula lewat E-Logbook, karena modul galeri
belum ada di sana.

Menambah foto dilakukan **dari layar, tanpa menyentuh kode**: isi keterangan dan
tanggal di kotak "Tambah foto", lalu tarik fotonya ke sana. Berkasnya tersimpan
permanen di `public/foto/<kode unit>/` dan keterangannya ditulis ke
`public/foto/daftar.json` oleh server.

Ada dua cara foto masuk:

- **Slot yang menunggu.** Ubin bertanda `BERKAS BELUM ADA` adalah entri yang
  keterangannya sudah ditulis tapi berkasnya belum masuk. Tekan ubinnya, pilih
  berkasnya — nama dan keterangan slot itu yang dipakai, bukan nama berkas asal.
  Berguna kalau daftar fotonya disiapkan lebih dulu.
- **Foto baru.** Tarik ke kotak "Tambah foto". Namanya dirapikan otomatis jadi
  `<unit>-<tanggal>-<nama-berkas>.jpg`.

Batas 15 MB per berkas, hanya `.jpg`, `.png`, dan `.webp`.

Klik foto untuk membukanya besar; `Esc` atau klik di luar untuk menutup. Tombol
**Hapus** muncul di pojok ubin saat disentuh tetikus — berkasnya ikut terhapus
dari server, jadi ia bertanya dulu.

**Foto tidak ikut masuk git, dan itu disengaja.** `public/foto/<unit>/` dan
`public/foto/daftar.json` keduanya ada di `.gitignore`. Repositori proyek ini
publik, sementara isi galeri adalah wajah pegawai di dalam ruang terbatas —
ruang kontrol, CWP, ruang playback. Sekali sesuatu terdorong ke repositori
publik, ia bisa di-clone dan terindeks, dan menghapusnya belakangan tidak
menariknya kembali.

Akibatnya yang perlu diketahui: **hasil clone datang dengan galeri kosong.**
Server membuat `daftar.json` sendiri saat pertama ada foto diunggah, jadi tidak
ada yang perlu disiapkan — tapi foto di satu komputer tidak menyeberang ke
komputer lain lewat git. Kalau memang perlu dipindah, salin foldernya langsung.

### Catatan keamanan

`POST /galeri/:unit` dan `DELETE /galeri/:unit/:berkas` adalah **satu-satunya
bagian aplikasi ini yang menulis ke disk**, dan keduanya belum meminta login.
Nama berkas disaring ketat (basename, daftar putih karakter, hanya ekstensi
gambar) sehingga tidak bisa dipakai menulis ke luar `public/foto/`, dan
penghapusan hanya berlaku untuk berkas yang memang terdaftar. Tetap saja:
sebelum server ini dibuka ke jaringan kantor, kedua endpoint itu perlu diberi
pemeriksaan sesi.

## Setelan

Lewat environment variable, atau salin `.env.example` jadi `.env`:

| Nama            | Bawaan                  | Guna                                        |
| --------------- | ----------------------- | ------------------------------------------- |
| `PORT`          | `3100`                  | port aplikasi ini                           |
| `HOST`          | `0.0.0.0`               | alamat bind                                 |
| `ELOGBOOK_ASAL` | `http://127.0.0.1:3000` | alamat server E-Logbook                     |
| `ELOGBOOK_MATI` | —                       | set `1` untuk memutus penerusan             |
| `ELOGBOOK_TAUTAN` | —                     | alamat E-Logbook untuk tombol "Buka E-Logbook", kalau bukan hostname yang sama |
| `GALERI_MATI`   | —                       | set `1` untuk mematikan unggah dan hapus foto |

`GALERI_MATI` menyala sendiri kalau `VERCEL` terdeteksi — di sana berkas
aplikasi baca-saja dan yang tertulis ke `/tmp` hilang begitu fungsinya selesai.

`GET /_info` menjawab setelan yang sedang dipakai — berguna untuk memastikan
servernya menunjuk ke E-Logbook yang benar. Dua kolomnya, `galeriBisaTulis` dan
`elogbookTerjangkau`, dipakai halaman untuk tidak menawarkan tombol yang pasti
gagal: keduanya tidak bisa ditebak dari sisi peramban, gagalnya baru ketahuan
setelah tombolnya terlanjur ditekan.

## Deploy ke Vercel

Yang naik ke Vercel adalah **etalase**: seluruh isinya data contoh. Bukan pilihan
gaya — E-Logbook hidup di jaringan kantor yang tertutup, dan dari Vercel
`127.0.0.1:3000` menunjuk ke kontainer Vercel itu sendiri. Selama E-Logbook belum
diganti Supabase sebagai sumber data, versi yang ter-deploy tidak akan pernah
punya data nyata.

Berkas yang mengurus itu:

- `api/index.js` — satu baris, menyerahkan app Express ke Vercel. Vercel
  memanggil fungsi tiap permintaan, bukan menyalakan server; `server.js` karena
  itu hanya memanggil `listen()` kalau dijalankan langsung.
- `vercel.json` — `/api/*`, `/galeri/*`, dan `/_info` diarahkan ke fungsinya.
  Sisanya berkas statis dari `public/`, disajikan Vercel langsung.

Setel `ELOGBOOK_MATI=1` di environment variable proyek Vercel-nya. Tanpa itu tiap
panggilan data menunggu 30 detik sampai batas waktu penerusan habis, baru gagal.
Galeri mati dengan sendirinya di sana lewat deteksi `VERCEL`.

Halaman menyesuaikan diri tanpa perlu diberi tahu: sumber "Server E-Logbook"
padam sendiri, tujuan **E-Logbook** di kartu masuk ikut padam karena tidak ada
alamat yang masuk akal untuk dituju, kotak unggah foto diganti keterangan, dan
tombol hapus tidak digambar. Yang tersisa berjalan penuh dengan data contoh.

**Belum pernah benar-benar di-deploy.** Kedua keadaan di atas diuji dengan
menjalankan `GALERI_MATI=1 ELOGBOOK_MATI=1 npm start` di komputer sendiri, bukan
di Vercel.

## Asal-usul

Halaman ini lahir sebagai prototipe `public/contoh/dashboard-3d.html` di dalam
E-LogBook-Server. Salinan aslinya sengaja **tidak dihapus** dari sana: masih
dipakai untuk uji coba dan sebagai pembanding. Sejak dipindah ke sini, yang
dikembangkan adalah salinan di proyek ini.

Layar masuknya berasal dari proyek Claude Design "Animasi Bandara Soekarno Hatta
3D". Semua kelas dan id miliknya berawalan `km` supaya tidak bertabrakan dengan
dashboard di bawahnya.
