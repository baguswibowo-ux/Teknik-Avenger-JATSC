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

`npm start` menyalakan **keduanya sekaligus** — E-Logbook di
<http://localhost:3000> dan dashboard ini di <http://localhost:3100>. Ctrl+C
sekali menghentikan keduanya.

Di Windows bisa juga klik dua kali `jalankan.cmd` — ia memasang dependensi
kedua proyek kalau belum ada, lalu menyalakan keduanya.

Kalau hanya salah satu yang diperlukan:

```bash
npm run dashboard    # dashboard saja, port 3100
npm run elogbook     # E-Logbook saja, port 3000
```

Untuk mengembangkan, `npm run dev` menyalakan ulang server dashboard tiap
berkasnya berubah.

## Susunan berkas

```
server.js            Express: menyajikan public/, meneruskan /api/* ke E-Logbook,
                     dan menyimpan jadwal dinas, kegiatan berkala, dan data personel
jalankan-semua.js    menyalakan E-Logbook + dashboard dalam satu perintah
elogbook/            salinan E-LogBook-Server, supaya semuanya jalan dari satu folder
data/                (di luar git — isinya nama pegawai, repositori ini publik)
  dinas.json         jadwal dinas bulanan per unit
  hak.json           peran dan nama yang boleh mengisi tiap modul
  berkala.json       daftar pekerjaan berulang per unit — mingguan sampai tahunan
  berkala-selesai.json  catatan sudah-dikerjakan, satu baris per periode
  personel.json      lisensi, rating, sertifikat, dan masa berlakunya
  aktivitas.json     log siapa mengubah apa, 400 baris terakhir
public/
  index.html         seluruh dashboard — satu berkas
  foto/<unit>/       foto dokumentasi, tampil di tab Galeri (di luar git)
  vendor/
    three.min.js     panggung 3D layar masuk (three 0.147.0)
    font/            Space Grotesk, IBM Plex Sans, IBM Plex Mono (subset latin)
    ocr/             Tesseract 5 — pembaca papan nama peralatan, ±10 MB
docs/                catatan proyek
```

Tidak ada satu pun permintaan ke internet. three.js, fontnya, dan mesin
pembaca teksnya ikut dibawa di `public/vendor/`, jadi build ini utuh di
jaringan kantor yang tertutup.

### E-Logbook di dalam folder ini

`elogbook/` adalah salinan `E-LogBook-Server`, ditaruh di sini supaya seluruh
sistem bisa dijalankan dari satu tempat dengan satu perintah. **Kodenya** ikut
git; **datanya tidak** — `elogbook/data/`, `elogbook/uploads/`, dan
`elogbook/.env` semuanya terjaring `.gitignore` karena repositori ini publik dan
isinya data pegawai. Hasil clone datang dengan basis data kosong.

Dua proses, dua port, bukan satu server yang memuat keduanya: E-Logbook
menyajikan halamannya di akar `/` dan API-nya di `/api`, persis seperti
dashboard ini. Menumpuknya jadi satu berarti salah satu harus pindah alamat,
dan penerusan `/api/*` yang sudah terbukti jalan harus dibongkar.

## Sambungan ke E-Logbook

E-Logbook sekarang ikut di dalam folder ini (`elogbook/`), dan `npm start`
menyalakannya bersama dashboard. Aslinya tetap ada di

```
D:\Airnav\2025\JATSC\New JATSC\2026\Faskompen\E-LogBook-Server
```

dan kalau yang itu yang mau dipakai, jalankan sendiri di sana lalu nyalakan
dashboard ini dengan `npm run dashboard`.

Dua perubahan sengaja dibuat pada salinan di `elogbook/`, keduanya atas
permintaan:

- **Tab Kelola Akun dicabut** dari E-Logbook. Pengelolaan akun kini satu pintu,
  di dashboard ini. API administratornya tetap utuh di sana — dashboard yang
  memanggilnya, dan penjagaan 403 per peran ditegakkan di situ.
- **`GET /api/akun-daftar`** ditambahkan: daftar akun aktif (username dan nama
  saja) yang dijawab sebelum login, untuk pemilih akun di kartu masuk. Lihat
  catatan keamanannya di bawah.

### Kenapa lewat penerusan, bukan panggilan langsung

Dashboard disajikan dari `localhost:3100`, E-Logbook hidup di `localhost:3000`.
Bagi browser itu dua asal berbeda: fetch lintas asal ditolak dan cookie sesinya
tidak ikut terkirim. Karena diteruskan lewat `server.js`, bagi browser semuanya
tetap satu asal — blok "Jembatan E-Logbook" di `public/index.html` jalan apa
adanya, tanpa satu baris pun diubah dari bentuk aslinya.

Jalur yang diteruskan: `/api/*` dan `/uploads/*`.

### Masuk dan membuka E-Logbook

**Pilih tujuan lebih dulu.** Di kartu masuk ada tiga pilihan, dan yang dipilih
benar-benar menentukan ke mana Anda mendarat:

| Tujuan | Setelah akun diperiksa |
|---|---|
| **E-Logbook** | peramban langsung dibawa ke E-Logbook — tidak lewat dashboard |
| **Dashboard** | dashboard ini, dengan data nyata dari E-Logbook |
| **Data contoh** | dashboard ini, dengan data karangan yang menyatu di halaman |

Baris status di bawah pemilih mengatakan apa yang sedang berlaku. Dua pilihan
pertama padam sendiri kalau tidak ada server E-Logbook yang terjangkau.

**Daftar akun ada di kartu masuknya.** Nama-nama akun yang sedang aktif
ditampilkan; tekan salah satu untuk mengisi kolom username, lalu isi
passwordnya. Kalau daftarnya panjang, kotak cari muncul sendiri — mencari nama
lengkap juga bisa, bukan hanya usernamenya.

> **Yang dikorbankan dengan membuka daftar itu.** `/api/login` di E-Logbook
> sengaja menyamakan pesan salahnya supaya tidak ketahuan username mana yang
> terdaftar. Daftar akun pra-login membatalkan penjagaan itu: yang tersisa
> hanya password, plus penahan 8 percobaan gagal per 5 menit. Karena itu isinya
> ditipiskan sampai username dan nama saja — peran, unit, dan status aktif
> tidak ikut, dan akun nonaktif tidak dikirim sama sekali. Kalau servernya
> suatu saat terbuka lebih luas dari jaringan kantor, matikan dengan
> `ELOGBOOK_DAFTAR_AKUN=0`.

**Masuk dengan akun E-Logbook.** Kalau di peramban itu sesi E-Logbook masih
hidup, tombolnya berubah jadi "Lanjutkan sebagai …" dan password tidak diminta
lagi.

**Sesi bertahan saat halaman disegarkan.** Menekan F5 tidak melempar siapa pun
kembali ke layar masuk: layar yang sedang dibuka dan unit yang sedang dilihat
ikut kembali. Penandanya di `sessionStorage`, jadi menutup tab tetap berarti
keluar. Dalam mode server yang menjaga pintu tetap cookie sesi E-Logbook —
sesi yang sudah mati di sana tetap berakhir di layar masuk.

**Membuka aplikasi E-Logbook.** Tombol **Buka E-Logbook** ada di ikon buku pada
kepala halaman, di layar unit, dan di Peta Modul. Semuanya membuka E-Logbook di
tab baru.

Tombol itu menunjuk E-Logbook **langsung**, bukan lewat penerusan — seluruh aset
E-Logbook memanggil `/css/` dan `/js/` dari akar, dan akar di sini milik
dashboard. Alamatnya dirangkai dari hostname yang sedang dipakai peramban
ditambah port E-Logbook, jadi ikut benar walau dashboard dibuka dari komputer
lain. Kalau E-Logbook ada di alamat yang lain sendiri, isi `ELOGBOOK_TAUTAN`.

E-Logbook tidak membaca satu pun parameter URL dan unit aktifnya hanya ada di
memori, jadi tidak ada cara menunjuk unit tertentu dari luar — tombolnya membuka
aplikasinya saja, unitnya dipilih di sana.

### Kelola Akun

Administrator mendapat tab **Kelola Akun**. Dari situ akun bisa ditambah,
diganti nama tampilan, peran, dan unit logbooknya, diganti passwordnya,
dinonaktifkan, dan dihapus — tanpa perlu membuka E-Logbook. Halaman kelola akun
di dalam E-Logbook sendiri sudah dicabut, jadi pintunya benar-benar satu.

**Saringan.** Daftarnya bisa disaring per unit, per peran, dan dicari menurut
nama atau username. Petak di atas tabel menunjukkan berapa teknisi di tiap unit;
menekan satu petak menyaring ke unit itu, menekannya lagi melepasnya.
Administrator dan pejabat tidak pernah punya daftar unit — perannya sudah
memberi seluruh unit sekaligus — jadi mereka dikumpulkan di pilihan **Akun semua
unit**, bukan diulang di tiap unit.

Dengan tujuan **Data contoh**, tab ini bekerja atas daftar **akun contoh**
yang tersimpan di peramban (`localStorage`), bukan akun sungguhan, supaya
alurnya bisa dicoba penuh tanpa server. Aturannya sengaja ditiru persis dari
yang ditegakkan server, jadi yang dicoba bukan versi yang lebih longgar.
Password tidak disimpan sama sekali di jalur ini: pada data contoh sandinya
memang tidak pernah diperiksa. Sisa bagian ini berlaku untuk tujuan
**E-Logbook**.

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

Pemeriksaan `/api/me` gagal, tujuan **E-Logbook** padam sendiri, dan halaman
jatuh ke **data contoh** — semuanya karangan, dan pita di puncak layar menulis
`PROTOTIPE` supaya tidak ada yang mengira angkanya nyata.

### Yang belum nyata walau sudah tersambung

Peralatan, sparepart, dan sejarah peralatan **masih data contoh** sekalipun
sudah tersambung — modulnya memang belum ada di E-Logbook. Layarnya menandai
ini terang-terangan di tiap tempat yang terpengaruh.

Jadwal dinas, kegiatan berkala, dan data personel **bukan** termasuk: ketiganya
milik dashboard ini sendiri dan tersimpan di servernya, jadi nyata baik
tersambung maupun tidak. Yang ditanyakan ke E-Logbook hanya siapa Anda, untuk
menentukan boleh mengisi atau tidak.

## Jadwal dinas

Tab **Jadwal Dinas** di dalam Database Unit. Satu matriks per unit per bulan:
baris orang, kolom tanggal, isi tiap sel kode dinas unit itu (`Pagi / Siang /
Malam / PS`, atau `P / S / PS / M` untuk Radkom). Kolom hari ini ditandai, dan
dua kolom pertama tetap di tempat saat tabelnya digulir mendatar.

**Siapa yang melihat, siapa yang mengisi.** Melihat: semua orang, dan itu
memang tujuannya — siapa pun yang masuk dinas bisa membuka jadwal bulan
berjalan seluruh unit. Mengisi: ditentukan **per peran** di panel *Siapa Boleh
Mengisi Apa* pada tab Kelola Akun (lihat di bawah).

Penjagaannya ada di server, bukan di layar. Setiap penyimpanan menanyakan
identitas pemanggilnya balik ke E-Logbook dengan cookie yang dibawa
permintaannya — jadi yang berlaku tetap sesi E-Logbook yang sungguhan, dan
menyembunyikan tombolnya di halaman cuma kenyamanan.

**Di mana tersimpan.** `data/dinas.json` di server dashboard ini — bukan di
E-Logbook, yang memang tidak punya modul ini.

Dalam **data contoh** tidak ada sesi E-Logbook yang bisa ditanyai, jadi hak per
perannya dihitung di peramban itu sendiri dan hasilnya tinggal di
`localStorage`. Layarnya mengatakan ini apa adanya.

Unit yang belum punya jadwal tampil **kosong** saat tersambung, bukan diisi nama
karangan — sama seperti cuplikan logbook yang kosong.

### Impor dari Excel, PDF, CSV, atau tempelan

Jadwal dinas tidak lahir di dashboard ini: ia lahir di lembar Excel yang dibuat
tiap akhir bulan, lalu dicetak jadi PDF. Mengetik ulang 31 kolom kali dua belas
orang adalah cara paling pasti membuat modulnya tidak dipakai — jadi ada tombol
**Impor dari berkas** di dalam mode sunting jadwal.

Empat pintu masuk, tanpa satu pun pustaka dari internet:

| Bentuk | Cara dibacanya |
| --- | --- |
| `.xlsx` | ZIP-nya dibuka sendiri dengan `DecompressionStream`, XML-nya diurai `DOMParser` bawaan peramban |
| `.csv` / `.txt` | teks berpemisah; pemisahnya (tab, `;`, `,`, `\|`) ditebak dari isinya |
| `.pdf` | aliran teksnya dikembangkan, lalu operator `Tj`/`TJ`-nya dipungut |
| tempel | kotak teks — salin blok dari Excel atau dari PDF yang terbuka, lalu tempel |

Sesudah dibaca, jalurnya satu: barisan tanggal `1 2 3 …` dicari untuk menemukan
kepala tabelnya, kolom nama dan peran ditebak dari isinya, dan hasilnya
ditunjukkan sebagai **pratinjau** yang bisa dibetulkan — kolom nama, kolom
peran, dan baris data mulai dari mana semuanya bisa diganti sebelum apa pun
masuk. Kode dinas di lembar Excel (`P`, `S`, `M`, `-`, `OFF`) disamakan dengan
kode unitnya (`Pagi`, `Siang`, `Malam`, kosong); yang tidak dikenali **tidak
dibuang**, melainkan dibawa apa adanya dan dilaporkan, supaya salah ketik di
lembar aslinya kelihatan alih-alih hilang diam-diam.

Yang ditekan di kartu impor mengisi **draf suntingan**, bukan yang tersimpan.
Tombol *Simpan jadwal* yang menuliskannya, dan *Batal* masih membatalkan
semuanya.

`.xls` yang lama tidak bisa dibaca — simpan ulang sebagai `.xlsx`. PDF hasil
**pindaian** juga tidak: hurufnya sudah berupa gambar, dan halaman ini
mengatakannya alih-alih diam.

## Siapa boleh mengisi apa

Panel di tab **Kelola Akun**, matriks tiga baris: Jadwal Dinas, Kegiatan
Berkala, Data Personel. Kolomnya peran — Administrator, Pejabat, Teknisi —
ditambah kolom **Ditunjuk** untuk memberi hak kepada satu orang di luar
perannya.

Administrator selalu boleh, di semua modul, dan itu tidak bisa dimatikan dari
layar ini: kalau bisa, satu centang yang salah cukup untuk mengunci orang yang
seharusnya membetulkannya.

Bawaannya: jadwal dinas dan kegiatan berkala terbuka sampai pejabat, data
personel berhenti di administrator — isinya nomor lisensi orang.

Tersimpan di `data/hak.json`. Berkas `data/dinas-petugas.json` dari versi
sebelumnya masih ikut dibaca dan dilebur sekali, jadi penunjukan yang sudah
terlanjur dibuat tidak hilang.

## Kegiatan berkala

Tab **Kegiatan Berkala** di dalam Database Unit: pekerjaan yang berulang —
“periksa daya pancar tiap Selasa”, “ganti filter genset tiap tanggal 5”.

Lima putaran yang bisa dipilih:

| Ulangan | Yang ditentukan | Kunci periodenya |
| --- | --- | --- |
| Mingguan | hari (Senin–Minggu) | `2026-W34` |
| Bulanan | tanggal 1–28 | `2026-08` |
| Triwulan | bulan ke-1..3 di dalam triwulan + tanggal | `2026-Q3` |
| Semesteran | bulan ke-1..6 di dalam semester + tanggal | `2026-S2` |
| Tahunan | bulan kalender + tanggal | `2026` |

Untuk triwulan dan semesteran, **bulan ke-** dihitung dari awal putarannya,
bukan dari Januari: pekerjaan triwulan bulan ke-2 jatuh di Februari untuk
triwulan pertama, Mei untuk triwulan kedua, dan seterusnya — jadi ia benar-benar
berulang tiap tiga bulan. Kunci periodenya dihitung ulang di server saat
menandai selesai, tidak diterima dari peramban.

Muncul di tiga tempat, dan itu memang gunanya:

- **tabel jadwal dinas** — baris penanda di atas nama-nama, jadi tanggal yang
  ada pekerjaannya terlihat sambil mencari nama sendiri
- **beranda** — panel *Perlu Perhatian*, yang lewat jatuh tempo lebih dulu
- **lonceng tiap akun** — hanya untuk yang namanya tercantum di dinas hari itu,
  di unit tempat pekerjaannya jatuh tempo

**Menandai selesai** boleh dilakukan siapa saja yang sudah masuk — yang
mengerjakan pekerjaan mingguan adalah teknisi yang kebetulan berdinas, dan
merekalah yang paling berhak mengatakannya. Yang mengatur *daftar*-nya tetap
terbatas menurut panel hak di atas. Tandanya berlaku untuk periode berjalan
saja: minggu depan ia kembali kosong dengan sendirinya.

Tanggal 29, 30, dan 31 sengaja tidak bisa dipilih untuk pekerjaan bulanan —
Februari tidak punya ketiganya, dan pekerjaan yang jatuh pada tanggal yang tidak
ada tidak akan pernah muncul sama sekali.

## Personel, lisensi, dan masa berlaku

Tab **Personel** di dalam Database Unit: orang unit itu beserta lisensi, rating,
sertifikat, dan nomornya, dengan tanggal terbit dan tanggal habis. Satu unit
satu daftar — yang mengurus lisensi Radtel adalah orang Radtel, dan daftar
lintas unit membuat tiap pencarian dimulai dengan menyaring.

Baris yang kolom unitnya masih kosong muncul di panel **Belum ditetapkan
unitnya** di setiap unit, dan hanya kepada yang berhak mengubah — supaya ada
yang membereskannya, bukan hilang dari layar mana pun.

Peringatannya menyala **dua bulan** sebelum habis, bukan pada hari habisnya —
perpanjangan lisensi ATSEP bukan pekerjaan sehari. Angkanya berdiri di satu
tempat (`SERT_AWAS` di `public/index.html`) supaya bisa digeser tanpa
mencari-cari.

Yang mendekati masa habis muncul di **beranda** (papan bersama, supaya yang
mengatur dinas ikut melihatnya) dan di **lonceng akun orangnya sendiri** — itu
sebabnya tiap baris personel punya kolom akun E-Logbook. Baris tanpa akun tetap
terhitung di beranda, tapi tidak ada yang bisa diberi tahu secara pribadi.

**Nomor lisensinya disamarkan** untuk yang belum masuk. Nama, jenis, dan tanggal
berlakunya tetap terlihat: peringatan yang cuma terlihat oleh administrator
tidak menolong siapa pun, sedangkan nomor lisensi adalah identitas orang dan
tidak ada gunanya ditampilkan pada layar yang terbuka.

### Menyunting peralatan dan sparepart

Tab **Peralatan** dan **Sparepart** di Database Unit bisa ditambah, diubah, dan
dihapus dari layar. Karena kedua daftar itu tidak punya rumah di E-Logbook,
tidak ada tempat mengirimkan perubahannya: yang disunting tersimpan di
`localStorage` peramban yang sedang dipakai, per komputer, tidak terlihat orang
lain. Tombol **Kembalikan ke bawaan** di tab Peralatan membuang seluruh
suntingan sekaligus.

#### Foto sebagai ganti ilustrasi

Kartu peralatan memakai gambar vektor yang dibangkitkan halaman ini, bertanda
**ILUSTRASI** di pojoknya supaya tidak ada yang mengiranya foto alat yang
sebenarnya. Kotak **Gambar di kartu** di kartu ubah menawarkan foto unit ini —
yang tertambat di baris itu lebih dulu, lalu sisa galeri unitnya — untuk dipakai
sebagai gantinya. Yang tersimpan di barisnya cuma nama berkasnya, sama seperti
foto dokumentasi. Begitu fotonya dipakai, tanda ILUSTRASI dilepas; tombol
**Pakai ilustrasi** mengembalikannya. Foto yang baru diunggah lewat kotak
dokumentasi di bawahnya langsung ikut jadi pilihan, tanpa perlu menutup
kartunya.

#### Mengisi dari foto papan nama

Kartu tambah/ubah peralatan dan sparepart punya kotak **Papan nama** (untuk
peralatan) atau **Label sparepart** di puncaknya. Taruh fotonya di situ, dan
**merk, tipe, serial number, part number, dan tahun pembuatan** dibaca dari
fotonya lalu diisikan ke kolom di bawahnya. Isian yang sudah Anda ketik tidak
ditimpa, teks mentah hasil pembacaan ikut ditampilkan supaya yang salah baca
bisa diperbaiki, dan semua kolomnya tetap bisa disunting tangan.

Isian yang datang **dari foto** diberi bingkai biru, jadi yang perlu diperiksa
terlihat tanpa harus mengingat mana yang diketik sendiri. Tombol **Baca ulang
foto ini** mengulang pembacaan pada foto yang sama: yang bertanda biru ditulis
ulang, yang Anda ketik sendiri tidak disentuh.

Dua bentuk papan nama yang dulu salah baca dan sekarang tidak lagi:

- **nilainya di baris berikutnya** — `SERIAL NO.` sendirian lalu nomornya di
  bawahnya, bentuk yang biasa pada papan berkolom. Dulu tidak terbaca sama
  sekali karena polanya mengharuskan keduanya sebaris.
- **nilainya kebablasan** — pada `S/N 4471120 TYPE T6-B`, seluruh sisa barisnya
  ikut tersedot jadi nomor seri. Yang tersimpan lalu terlihat masuk akal, dan
  itu yang membuatnya sulit ketahuan. Sekarang nilainya dipotong di kata yang
  jelas milik label berikutnya, dan di dua spasi berturut-turut.

Sebelum dibaca, fotonya **disiapkan lebih dulu**: dibesarkan sampai hurufnya
cukup tinggi untuk dikenali, dijadikan abu-abu, dan kontrasnya diregangkan pada
persentil 2% — logam kelabu di atas logam kelabu jadi hitam di atas putih.
Putaran dari EXIF ikut dipakai, karena foto HP yang terbaca miring 90° bagi
Tesseract sama dengan foto kosong. Pembacaannya memakai tata letak “satu blok
teks” yang memang bentuk papan nama; kalau hasilnya tetap tipis, tata letak
kedua dicoba sekali lagi dan yang lebih banyak isinya yang dipakai.

Pembacaannya berjalan **di dalam peramban**, dengan Tesseract 5 yang dibawa utuh
di `public/vendor/ocr/` (±10 MB, dimuat saat tombolnya dipakai pertama kali —
bukan saat halaman dibuka). Tidak ada satu pun permintaan keluar: jaringan
kantor tertutup, dan foto papan nama peralatan navigasi juga bukan sesuatu yang
pantas dikirim ke layanan di luar.

Label yang dikenali: `S/N`, `SERIAL NO`, `P/N`, `PART NO`, `ARTICLE NO`,
`CATALOGUE NO`, `ITEM NO`, `REF`, `MODEL`, `TYPE`, `MFG`, `MFD`,
`YEAR OF MANUFACTURE`, dan salah-bacanya yang lazim di papan logam (garis miring
pada `S/N` dan `P/N` kerap terbaca jadi `SIN` dan `PIN` — keduanya ikut
diterima). Merk dicocokkan ke daftar pabrikan yang memang dipakai di sini lebih
dulu, baru ditebak dari baris pertama yang bentuknya seperti nama perusahaan.

**Label sparepart dibaca berbeda dari papan nama peralatan**, dan itu yang dulu
membuat pembacaan sparepart hampir selalu gagal. Papan nama peralatan menyebut
pabrikan dan model dengan huruf besar; label sparepart isinya kode, dan nomor
partnya sering dicetak sendirian tanpa label sama sekali di bawah kode batang.
Karena part number wajib diisi sebelum barisnya bisa disimpan, label seperti itu
membuat kartunya buntu. Jadi untuk sparepart ada satu langkah tambahan: kalau
tidak ada satu pun label yang cocok, kode yang **paling berbentuk nomor part**
(paling padat angka dan tanda hubung) dipakai sebagai tebakan — dan dikatakan
sebagai tebakan. Jumlah pada label (`QTY`, `ISI`) disebut tapi **tidak**
diisikan ke kolom Stok: angka di kardus adalah isi satu kemasan, stok adalah
berapa yang ada di rak.

Pembacaan papan nama logam yang tergores dan miring **tidak pernah pasti**.
Karena itu hasilnya selalu disodorkan sebagai tebakan yang harus diperiksa,
bukan sebagai isian yang sudah jadi.

**Tahun** dicatat dua-duanya, karena keduanya memang beda: `Tahun pembuatan`
dari papan namanya, dan `Dicatat` — tanggal baris itu masuk ke daftar, diisi
sendiri saat disimpan.

**Foto dokumentasi** bisa ditambahkan di kartu yang sama, lebih dari satu
sekaligus. Fotonya tersimpan di galeri unit itu (`public/foto/<unit>/`) dan yang
menempel di baris peralatannya hanya nama berkasnya — satu foto 3 MB dalam
bentuk base64 akan menghabiskan seluruh jatah `localStorage` dalam sekali
simpan. Melepas foto dari kartu hanya memutus tautannya; fotonya tetap di
galeri.

Trouble dan logbook sengaja **tidak** ikut bisa disunting: keduanya datang dari
E-Logbook begitu tersambung, dan salinan lokal yang berbeda dari aslinya tanpa
jalan mengirim balik hanya akan jadi kabar palsu.

## Log aktivitas

Layar **Aktivitas** di rel navigasi menjawab pertanyaan yang selalu datang
sesudah sebuah data berubah: ini siapa yang mengisi.

Sumbernya dua, dan bedanya penting:

- **server** — jadwal dinas, kegiatan berkala, personel, hak, dan galeri.
  Ditulis `server.js` ke `data/aktivitas.json` dengan identitas dari sesi
  E-Logbook yang sungguhan, jadi berlaku untuk semua orang dan tidak bisa
  dikarang dari peramban. Terbaca hanya oleh yang sudah masuk.
- **peramban ini** — peralatan dan sparepart. Keduanya memang cuma hidup di
  `localStorage`, jadi catatannya pun tidak bisa lebih jauh dari itu; barisnya
  diberi tanda supaya tidak disangka berlaku bersama.

Yang dicatat hanya **perbuatannya** — modul, unit, dan sepotong keterangan —
bukan isi datanya. Nomor lisensi tidak pernah ikut masuk ke sini. Berkasnya
tinggal di `data/`, yang di luar git.

### Bahasa

Tombol **EN / ID** di kepala dashboard mengganti bahasanya. Pilihannya tersimpan
di `localStorage`. Yang diterjemahkan isi dashboard; layar masuk tetap seperti
apa adanya — konsol operasionalnya memang sudah berbahasa Inggris. Nama unit
(“Listrik dan Mekanik”, “Gedung dan Keamanan”) tidak diterjemahkan: itu nama
organisasi, bukan istilah.

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
| `ELOGBOOK_PORT` | `3000`                  | port E-Logbook yang dinyalakan `npm start`  |
| `GALERI_MATI`   | —                       | set `1` untuk mematikan unggah dan hapus foto |

Satu lagi milik E-Logbook, dipasang di `elogbook/.env`:

| Nama                     | Bawaan | Guna                                              |
| ------------------------ | ------ | ------------------------------------------------- |
| `ELOGBOOK_DAFTAR_AKUN`   | `1`    | set `0` untuk menutup daftar akun pra-login        |

`GALERI_MATI` menyala sendiri kalau `VERCEL` terdeteksi — di sana berkas
aplikasi baca-saja dan yang tertulis ke `/tmp` hilang begitu fungsinya selesai.
Jadwal dinas ikut aturan yang sama: bisa dibaca di sana, tidak bisa disimpan.

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

Halaman menyesuaikan diri tanpa perlu diberi tahu: tujuan **E-Logbook** di kartu
masuk padam sendiri karena tidak ada alamat yang masuk akal untuk dituju, kotak
unggah foto diganti keterangan, dan tombol hapus tidak digambar. Yang tersisa
berjalan penuh dengan data contoh — termasuk tab Kelola Akun, suntingan
peralatan dan sparepart, dan sakelar bahasa, karena ketiganya hidup di peramban
pengunjung dan tidak menuntut apa pun dari server.

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
