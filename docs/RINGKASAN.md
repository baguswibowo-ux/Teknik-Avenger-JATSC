# Ringkasan — Dashboard Fasilitas Teknik JATSC ("Avenger")

Status per 16 Agustus 2026 · 4 commit · branch `utama`

---

## Apa ini

Dashboard fasilitas teknik untuk New JATSC: satu layar yang menyatukan kondisi
peralatan, trouble yang masih menggantung, jadwal dinas, dan catatan logbook
dari delapan unit teknik — sesuatu yang di E-Logbook hanya bisa dilihat satu
unit per satu layar.

Aplikasi ini **berdiri sendiri**: punya server sendiri di port 3100, halaman
sendiri, dan tidak menumpang di proyek mana pun.

## Dari mana asalnya

Halaman ini lahir sebagai prototipe `public/contoh/dashboard-3d.html` di dalam
E-LogBook-Server. Pada 16 Agustus 2026 ia dipindah keluar menjadi proyek
tersendiri di `E:\2026\Teknik JATSC Avenger`.

Salinan aslinya **sengaja tidak dihapus** dari E-Logbook — masih dipakai untuk
uji coba dan sebagai pembanding. Sejak pindah, yang dikembangkan adalah salinan
di proyek ini.

Layar masuknya berasal dari proyek Claude Design "Animasi Bandara Soekarno Hatta
3D". Semua kelas dan id miliknya berawalan `km` supaya tidak bertabrakan dengan
dashboard di bawahnya.

## Hubungan dengan E-Logbook

E-Logbook tetap di tempatnya:

```
D:\Airnav\2025\JATSC\New JATSC\2026\Faskompen\E-LogBook-Server   (port 3000)
```

Berkasnya **tidak pernah disunting dari proyek ini**. Statusnya sumber data
sekaligus tempat uji coba. Yang sudah jadi di sana tidak ditulis ulang di sini.

Ada dua jalur yang menghubungkannya, dan keduanya berbeda maksud:

| Jalur | Untuk apa | Bagaimana |
| --- | --- | --- |
| **Data** | unit, isu, catatan logbook | `server.js` meneruskan `/api/*` dan `/uploads/*` ke E-Logbook |
| **Tautan** | membuka aplikasi E-Logbook | tombol menunjuk `:3000` langsung, di tab baru |

Data harus lewat penerusan karena dashboard di `:3100` dan E-Logbook di `:3000`
adalah dua asal berbeda bagi peramban — fetch lintas asal ditolak dan cookie
sesinya tidak ikut terkirim. Dengan diteruskan, bagi browser semuanya tetap satu
asal, sehingga blok "Jembatan E-Logbook" di halaman jalan apa adanya tanpa satu
baris pun diubah.

Tautan justru **tidak boleh** lewat penerusan: seluruh aset E-Logbook memanggil
`/css/` dan `/js/` dari akar, dan akar di sini milik dashboard.

## Yang sudah jalan

**Aplikasi mandiri.** `server.js` (235 baris) menyajikan `public/` dan
meneruskan permintaan data ke E-Logbook. Port, alamat E-Logbook, dan penerusan
bisa diatur lewat environment variable.

**Utuh tanpa internet.** three.js dan ketiga fontnya (Space Grotesk, IBM Plex
Sans, IBM Plex Mono — subset latin, 18 woff2) ditarik ke `public/vendor/`, total
1 MB. Halaman ini **nol permintaan ke internet**, syarat mutlak untuk jaringan
kantor yang tertutup. Diperiksa lewat
`performance.getEntriesByType('resource')` — hasilnya array kosong.

**Dua sumber data.** Dipilih di kartu masuk: data contoh (semuanya karangan),
atau server E-Logbook dengan akun sungguhan. Kalau servernya mati, pilihan
servernya padam sendiri dan halaman jatuh ke data contoh — pita di puncak layar
menulis `PROTOTIPE` supaya tidak ada yang mengira angkanya nyata.

**Galeri foto per unit.** Tab baru di dashboard unit. Foto diunggah dari layar
(tarik-lepas), tersimpan permanen di `public/foto/<unit>/`, keterangannya di
`public/foto/daftar.json`. Ubin bertanda `BERKAS BELUM ADA` berfungsi sebagai
tombol untuk mengisi slot yang keterangannya sudah ditulis.

**Tiga jalan masuk ke E-Logbook.** Dari kartu masuk, ikon buku di kepala
halaman, dan layar unit.

**Kelola Akun — akun E-Logbook diurus dari depan.** Tab baru di dashboard, hanya
muncul untuk administrator yang masuk lewat server. Isinya daftar seluruh akun
beserta peran dan unitnya, dengan tombol untuk menambah akun, mengganti nama
tampilan, peran, dan unit logbook, mengganti password, menonaktifkan, dan
menghapus.

Yang penting soal batasnya: layar ini **tidak menyimpan akun sendiri, tidak
membuka basis data E-Logbook, dan tidak menyunting satu pun berkasnya.**
Semuanya lewat fungsi administrator yang memang sudah ada di API E-Logbook —
`listUsers`, `addUser`, `setUserNama`, `setUserRole`, `setUserUnit`,
`setUserAktif`, `setUserPassword`, `deleteUser` — dipanggil ke `/api/*` pada asal
yang sama, persis seperti data lainnya. Kalau tab ini dibuang besok, tidak ada
jejaknya yang tertinggal di sana.

Penjagaannya tetap milik server. Tab ini disembunyikan dari yang bukan
administrator, tapi itu cuma kenyamanan: E-Logbook menolak seluruh fungsi di atas
dengan 403 untuk peran lain. Aturan yang ditegakkan server ditiru di layar ini
supaya salahnya ketahuan sebelum permintaannya berangkat — teknisi wajib punya
minimal satu unit, password minimal 6 karakter, administrator aktif terakhir
tidak boleh diturunkan atau dinonaktifkan, akun sendiri tidak bisa diturunkan
sendiri, dan hanya akun nonaktif yang boleh dihapus. Tombol hapus baru hidup
setelah usernamenya diketik ulang persis.

Dengan ini pengelolaan akun tidak perlu lagi dibuka dari dalam E-Logbook.

## Susunan berkas

```
server.js              235 baris  — statis + penerusan + endpoint galeri
package.json                      — express, npm start / npm run dev
jalankan.cmd                      — klik dua kali di Windows
.env.example                      — PORT, ELOGBOOK_ASAL, ELOGBOOK_MATI, ELOGBOOK_TAUTAN
README.md                         — cara jalan, susunan, alasan tiap keputusan
public/
  index.html         3.965 baris  — seluruh dashboard, satu berkas (211 KB)
  foto/daftar.json                — keterangan galeri, ditulis server
  foto/<unit>/                    — berkas fotonya
  vendor/                  1 MB   — three.js + 18 woff2
docs/RINGKASAN.md                 — berkas ini
```

29 berkas terlacak git.

## Yang masih data contoh

Sekalipun sudah tersambung ke E-Logbook, empat hal ini **tetap karangan** karena
modulnya memang belum ada di sana:

- Peralatan (daftar, identitas, spesifikasi)
- Sparepart (stok, batas minimum, pemakaian)
- Jadwal dinas
- Sejarah peralatan

Layarnya menandai ini terang-terangan di tiap tempat yang terpengaruh, jadi
tidak ada angka karangan yang menyamar jadi data nyata.

## Yang belum selesai

**Foto Radtel sudah masuk — tiga dari empat.** `radtel-01`, `radtel-02`, dan
`radtel-04` sudah ada di `public/foto/radtel/`. Slot ketiga, "foto bersama tim
teknik dan vendor di ruang teknik", dicabut dari `daftar.json` karena berkasnya
tidak pernah terunggah; kalau fotonya ketemu, tinggal diunggah lewat tab Galeri
dan entrinya lahir kembali sendiri.

`radtel-02` dikecilkan dari 4032&times;3024 (6,5 MB) jadi 1440&times;1920
(328 KB) sebelum dicommit — sekali masuk riwayat git, ukuran aslinya menetap di
sana selamanya walau fotonya nanti diganti. Pikselnya diputar mengikuti tag
orientasi EXIF-nya lebih dulu, karena proses pengecilannya membuang EXIF dan
tanpa itu fotonya akan tampil rebah 90&deg; di peramban. Berlaku juga untuk
unggahan berikutnya: **foto langsung dari kamera ponsel sebaiknya dikecilkan
dulu sebelum masuk galeri.**

**Login E-Logbook: jalur cookienya sudah terbukti, satu langkah terakhir belum.**
Yang sudah diperiksa langsung terhadap kedua server yang jalan:

| Yang diuji | Hasil |
| --- | --- |
| `GET /api/me` lewat `:3100` tanpa sesi | 401 `{"error":"Belum login."}` — jawaban E-Logbook, bukan halaman 404 |
| `POST /api/login` lewat `:3100` dengan badan JSON | 401 `{"error":"Username atau password salah."}` — badan permintaan sampai utuh |
| Kepala `Set-Cookie` lewat penerusan | **sama persis** dengan yang keluar langsung dari `:3000`, termasuk `HttpOnly` dan `SameSite=Lax` |

Cookie diuji lewat `POST /api/logout`, yang memasang cookie kedaluwarsa tanpa
perlu login — jadi jalur `Set-Cookie` terbukti tanpa menyentuh sesi siapa pun.

Yang **belum** dicoba: masuk dengan akun sungguhan lalu menarik `getAllData` dan
`listUsers` dengan cookie itu. Butuh sekali percobaan masuk oleh pemilik akun;
tinggal buka <http://localhost:3100>, pilih SERVER E-LOGBOOK, dan masuk.

**Penahan tebak-password E-Logbook terhitung satu untuk semua pemakai Avenger.**
E-Logbook membatasi 8 login gagal per alamat IP per 5 menit, dan alamat itu
diambil dari soket (`req.ip`) tanpa `trust proxy`. Karena seluruh permintaan
Avenger datang dari satu proses, bagi E-Logbook semuanya berasal dari
`127.0.0.1` — 8 kali salah password oleh siapa pun lewat dashboard akan menahan
**semua** orang yang masuk lewat dashboard selama 5 menit. Yang masuk langsung ke
`:3000` tidak terpengaruh. Ini bawaan dari cara penerusannya dan tidak bisa
diperbaiki dari sisi Avenger saja: `X-Forwarded-For` pun akan diabaikan selama
E-Logbook belum memasang `trust proxy`.

**Endpoint galeri belum meminta login.** `POST /galeri/:unit` dan
`DELETE /galeri/:unit/:berkas` adalah satu-satunya bagian aplikasi ini yang
menulis ke disk, dan keduanya masih terbuka. Nama berkas sudah disaring ketat
(basename, daftar putih karakter, hanya ekstensi gambar — diuji dengan
`../../../server.js` dan `jahat.js`, keduanya ditolak 400) dan penghapusan hanya
berlaku untuk berkas yang memang terdaftar. Tetap saja: **sebelum server ini
dibuka ke jaringan kantor, kedua endpoint itu wajib diberi pemeriksaan sesi** —
siapa pun yang bisa menjangkau portnya bisa menaruh dan menghapus foto.

**`public/index.html` masih satu berkas 3.965 baris.** Untuk jangka panjang
sebaiknya dipecah ke `css/` dan `js/` bernomor seperti gaya E-Logbook. Dibiarkan
utuh dulu supaya tidak ada risiko rusak sebelum bentuknya mantap.

## Menjalankan

```
npm install
npm start
```

Lalu buka <http://localhost:3100>. Di Windows bisa juga klik dua kali
`jalankan.cmd`.

Untuk memakai data nyata, jalankan dulu E-Logbook (`npm start` di
E-LogBook-Server, port 3000).
