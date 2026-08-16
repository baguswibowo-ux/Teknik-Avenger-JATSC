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

## Susunan berkas

```
server.js              235 baris  — statis + penerusan + endpoint galeri
package.json                      — express, npm start / npm run dev
jalankan.cmd                      — klik dua kali di Windows
.env.example                      — PORT, ELOGBOOK_ASAL, ELOGBOOK_MATI, ELOGBOOK_TAUTAN
README.md                         — cara jalan, susunan, alasan tiap keputusan
public/
  index.html         3.237 baris  — seluruh dashboard, satu berkas (189 KB)
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

**Foto Radtel belum masuk.** Empat slot sudah disiapkan lengkap dengan
keterangannya, tapi `public/foto/radtel/` masih kosong. Berkasnya perlu diunggah
lewat tab Galeri.

**Login E-Logbook belum diuji ujung ke ujung.** `POST /api/login` sudah terbukti
sampai ke E-Logbook dan jawabannya diteruskan apa adanya, tapi jalur
`Set-Cookie` dan `getAllData` belum dicoba dengan akun sungguhan — belum ada
kredensial untuk mengujinya. Perlu sekali percobaan masuk untuk memastikan.

**Endpoint galeri belum meminta login.** `POST /galeri/:unit` dan
`DELETE /galeri/:unit/:berkas` adalah satu-satunya bagian aplikasi ini yang
menulis ke disk, dan keduanya masih terbuka. Nama berkas sudah disaring ketat
(basename, daftar putih karakter, hanya ekstensi gambar — diuji dengan
`../../../server.js` dan `jahat.js`, keduanya ditolak 400) dan penghapusan hanya
berlaku untuk berkas yang memang terdaftar. Tetap saja: **sebelum server ini
dibuka ke jaringan kantor, kedua endpoint itu wajib diberi pemeriksaan sesi** —
siapa pun yang bisa menjangkau portnya bisa menaruh dan menghapus foto.

**`public/index.html` masih satu berkas 3.237 baris.** Untuk jangka panjang
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
