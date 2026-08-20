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
  peralatan.json     daftar peralatan per unit
  sparepart.json     stok sparepart per unit
  aktivitas.json     log siapa mengubah apa, 400 baris terakhir
  dokumen/           berkas dokumen unit + daftar.json keterangannya
public/
  index.html         seluruh dashboard — satu berkas
  foto/<unit>/       foto dokumentasi, tampil di tab Galeri (di luar git)
  foto/_logo/        gambar pengenal tiap unit, kalau ilustrasinya diganti
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

Tiga perubahan sengaja dibuat pada salinan di `elogbook/`, ketiganya atas
permintaan:

- **Tab Kelola Akun dicabut** dari E-Logbook. Pengelolaan akun kini satu pintu,
  di dashboard ini. API administratornya tetap utuh di sana — dashboard yang
  memanggilnya, dan penjagaan 403 per peran ditegakkan di situ.
- **`GET /api/akun-daftar`** ditambahkan: daftar akun aktif (username dan nama
  saja) yang dijawab sebelum login, dulu untuk pemilih akun di kartu masuk.
  Pemilih itu sudah dibuang dan endpointnya tidak dipanggil lagi — biarkan
  mati dengan `ELOGBOOK_DAFTAR_AKUN=0`.
- **Tanda pagar di alamat dibaca**, di `elogbook/public/js/26-init.js`:
  `#<tab>` atau `#<tab>:<unit>` membuka tab itu langsung. Dipakai tombol
  **Buka DS Test** di dashboard. Rinciannya di *Menunjuk tab tertentu* di bawah.

Itu satu-satunya berkas E-Logbook yang disunting demi dashboard ini. Sisanya
tetap lewat API.

### Kenapa lewat penerusan, bukan panggilan langsung

Dashboard disajikan dari `localhost:3100`, E-Logbook hidup di `localhost:3000`.
Bagi browser itu dua asal berbeda: fetch lintas asal ditolak dan cookie sesinya
tidak ikut terkirim. Karena diteruskan lewat `server.js`, bagi browser semuanya
tetap satu asal — blok "Jembatan E-Logbook" di `public/index.html` jalan apa
adanya, tanpa satu baris pun diubah dari bentuk aslinya.

Jalur yang diteruskan: `/api/*`, `/uploads/*`, dan `/logbook/*`.

`/logbook/*` yang terakhir menyusul, dan ia menutup celah yang tersisa. Selama
tombol **Buka E-Logbook** menunjuk host E-Logbook yang sungguhan, data memang
lewat penerusan tapi HALAMANNYA tidak — pemakainya berpindah asal, dan dengan
begitu berpindah sesi. Sekarang halamannya ikut diteruskan: prefiks `/logbook`
dipotong sebelum dikirim ke sana, dan bagi browser tidak pernah ada asal kedua.

### Masuk dan membuka E-Logbook

**Tidak ada yang perlu dipilih — isi username dan password, selesai.** Masuk
berarti satu hal: mendarat di dashboard ini. E-Logbook tetap sejauh satu tombol,
tapi tombolnya ada di kepala dashboard, tempat orang mencarinya setelah masuk.

Kartu masuk pernah punya deret **E-LOGBOOK · DASHBOARD · DATA CONTOH** di
atasnya. Deret itu dibuang: ia menjadikan "ke mana Anda mau mendarat" pertanyaan
yang harus dijawab sebelum boleh mengetik username, padahal jawabannya hampir
selalu sama. Yang tersisa satu baris status yang mengatakan apa yang sedang
berlaku — server terjawab atau tidak, sesi masih hidup atau tidak.

**Data contoh sudah tidak ada sama sekali.** Dulu ia berlaku kalau E-Logbook
tidak terjawab, dan sempat pula ada saklarnya (`DATA_CONTOH=0`) untuk mematikan
jatuhan itu di server kantor. Keduanya sudah dibuang bersama datanya. Server
yang diam sekarang selalu terlihat sebagai server yang diam — bukan sebagai
layar penuh angka karangan yang tidak bisa dibedakan dari yang nyata.

**Tidak ada daftar akun di kartu masuk.** Pernah ada — deret tombol berisi
seluruh username yang sedang aktif, tinggal ditekan untuk mengisi kolom — dan
sudah dibuang. Yang tersisa dua kolom yang diketik sendiri.

> **Yang kembali dengan dibuangnya daftar itu.** `/api/login` di E-Logbook
> sengaja menyamakan pesan salahnya — "username atau password salah", tidak
> pernah menyebut yang mana — supaya tidak ketahuan username mana yang
> terdaftar. Daftar akun pra-login membatalkan penjagaan itu seluruhnya: yang
> tersisa untuk ditebak cuma password. Sekarang keduanya harus ditebak lagi,
> di atas penahan 8 percobaan gagal per 5 menit.
>
> `GET /api/akun-daftar` di E-Logbook karena itu **tidak dipanggil dari mana
> pun lagi**. Endpointnya masih hidup di sana; matikan sekalian dengan
> `ELOGBOOK_DAFTAR_AKUN=0`.

Yang menggantikan gunanya: username yang terakhir berhasil masuk diingat di
peramban itu sendiri. Satu nama, milik orang yang memang memakai komputer itu —
bukan daftar seisi kantor.

**Masuk dengan akun E-Logbook.** Kalau di peramban itu sesi E-Logbook masih
hidup, tombolnya berubah jadi "Lanjutkan sebagai …" dan password tidak diminta
lagi.

**Username yang terakhir dipakai diingat.** Sesudah keluar, kolomnya sudah
terisi dan yang tersisa mengetik password. Yang disimpan hanya usernamenya, di
`localStorage` peramban itu — password tidak pernah, dan tidak akan. Ia baru
disimpan setelah server benar-benar menerima akunnya, jadi salah ketik tidak
ikut menyambut Anda besok, dan ia tidak pernah menimpa username yang sedang
diketik.

**Sesi bertahan saat halaman disegarkan.** Menekan F5 tidak melempar siapa pun
kembali ke layar masuk: layar yang sedang dibuka dan unit yang sedang dilihat
ikut kembali. Penandanya di `sessionStorage`, jadi menutup tab tetap berarti
keluar. Dalam mode server yang menjaga pintu tetap cookie sesi E-Logbook —
sesi yang sudah mati di sana tetap berakhir di layar masuk.

**Nama di kartu masuk tidak nyangkut.** Dulu sesinya ditanyakan sekali saja,
waktu halaman dibuka — sesi yang habis sesudah itu, atau yang diputus dari tab
E-Logbook sebelah, tetap terpampang sampai halaman disegarkan. Sekarang
`/api/me` ditanyakan ulang tiap kartu masuk terbuka dan tiap orang keluar dari
dashboard. Gagal jaringan tidak dipakai menyimpulkan apa-apa: yang tidak
terjawab dibiarkan seperti sebelumnya, tidak dianggap sudah keluar. Username
yang terlanjur diketik tidak pernah ditimpa maupun dikosongkan oleh sesi mana
pun.

**Keluar berarti keluar.** Tombol **Keluar** di dashboard memutus sesi
E-Logbook-nya sungguhan (`/api/logout`), bukan sekadar kembali ke kartu masuk.
Dulu tidak begitu: alasannya orangnya mungkin masih memakai tab E-Logbook di
sebelah dan tidak pantas ikut tertendang. Itu dibalik atas permintaan, dan
alasannya lebih kuat — keluar yang tidak mengeluarkan adalah janji yang tidak
ditepati, dan di komputer yang dipakai bergantian orang berikutnya akan
menemukan "Lanjutkan sebagai *nama orang sebelumnya*" lalu bisa menekannya
tanpa password sama sekali.

Karena itu tulisan **"Bukan Anda? Ganti akun"** di kaki kartu ikut dibuang. Ia
ada untuk kasus sesi-yang-menempel, dan kasus itu sudah tidak ada. Yang tersisa
sesudah keluar cuma username yang sengaja diingat, dan itu tinggal ditimpa
dengan mengetik.

**Membuka aplikasi E-Logbook.** Tombol **Buka E-Logbook** ada di ikon buku pada
kepala halaman, di layar unit, dan di Peta Modul. Semuanya berpindah **di tab
yang sama** — dulu tab baru, dan yang tertinggal dari kebiasaan itu cuma
tumpukan tab yang tidak pernah ditutup siapa pun. Jalan pulangnya ada: tombol
**Dashboard Teknik** di kepala E-Logbook kembali ke sini, dan cookie sesinya
tetap yang sama.

Tombol itu menunjuk **`/logbook/`** — E-Logbook disajikan lewat server ini, di
dalam asal yang sama. Itu yang membuat kalimat "cookie sesinya tetap yang sama"
di atas benar: menyeberang ke host lain berarti menyeberang ke toples cookie
yang lain, dan di sana pemakainya bisa jadi orang lain — teknisi satu unit di
dashboard, administrator yang membuka semua unit di E-Logbook. Satu asal
membuat pertanyaan itu tidak pernah muncul.

Yang membuatnya bisa: aset E-Logbook dipanggil relatif, jadi di `/logbook/`
semuanya jatuh ke `/logbook/css/…` dan `/logbook/js/…` tanpa menyentuh `/css/`
dan `/js/` milik dashboard. Penjelasan lengkapnya di `server.js`, di atas
`JALUR_LOGBOOK`.

**Menunjuk tab tertentu.** Tombol biasa membuka E-Logbook di halaman depannya:
unit yang terakhir dipakai, tab Logbook. Yang perlu menunjuk lebih jauh memakai
tanda pagar — `#<tab>` atau `#<tab>:<unit>`, dibaca `26-init.js` di sana.
Yang memakainya sekarang tombol di baris kegiatan berkala yang tandanya datang
dari E-Logbook: **Buka DS Test** berangkat ke `#dstest:radtel`, **Buka Daily
Check** ke `#dailycheck:<unit>`, **Buka Monitoring Frekuensi** ke
`#monitoring:<unit>`. Tabnya tidak ditulis di tombolnya — ia datang dari
registri sumber di `public/index.html`, jadi sumber baru mendapat tombolnya
tanpa satu baris pun ditambahkan.

Unitnya ikut disebut karena beberapa tab hanya ada pada unit yang memang punya
formulirnya; tanpa itu tautannya mendarat di unit terakhir yang dibuka orangnya,
yang belum tentu unit yang dimaksud. Unit dari tautan **tidak** disimpan sebagai
ingatan akun — sekali dimuat ulang tanpa tanda pagar, yang kembali unit yang
biasa dipakai. Tautan itu satu kunjungan, bukan pindah rumah. Yang memutuskan
boleh atau tidaknya unit itu tetap server, dan tab yang tidak ada atau sedang
disembunyikan dibiarkan saja — halaman terbuka di tab biasanya, dan itu lebih
baik daripada memaksa masuk ke bagian yang kosong.

### Daftar akun baru

Pendaftaran mandiri sekarang ada di kartu masuk dashboard, di **kaki kartu** —
bukan deret tombol tersendiri. Kartu itu sudah dua kali dibersihkan dari deret
tombol: pertama barisan tab MASUK / DAFTAR AKUN, lalu pemilih tujuan
E-LOGBOOK · DASHBOARD · DATA CONTOH. Sekarang isinya username, password, tombol
Masuk, dan satu tautan pendaftaran di kakinya.

Formulirnya minta nama lengkap, username, dan password dua kali. Endpointnya
tetap milik E-Logbook (`POST /api/daftar`), dipanggil lewat penerusan yang sama
dengan data lainnya; tidak ada berkas E-Logbook yang disunting untuk ini.

**Akun baru lahir teknisi, tanpa unit, dan nonaktif.** Aturan itu milik server
dan tidak ditiru di sini — membuka pendaftaran tidak sama dengan membuka pintu,
dan yang mengaktifkan tetap administrator lewat *Kelola Akun*. Sampai
diaktifkan, login dengan akun itu dijawab 401.

Lima hal diperiksa di layar sebelum permintaannya berangkat, supaya yang salah
ketik tahu lebih cepat: nama tidak boleh kosong, username 3–32 karakter huruf
kecil/angka/`.`/`_`/`-`, password minimal 6 karakter, ulangannya harus sama,
dan servernya harus terjawab. Semuanya diperiksa **ulang** di server — yang di
layar cuma kenyamanan, termasuk pesan "username itu sudah dipakai" yang memang
datang dari sana.

Tanpa server E-Logbook terjangkau, tautan pendaftarannya dilepas sama sekali —
bukan sekadar dimatikan. Pendaftaran menulis ke basis data E-Logbook, dan
tautan mati cuma menimbulkan pertanyaan yang tidak ada jawabannya.

### Panggung 3D di kartu masuk

Bandara di belakang kartu masuk berputar sendiri sampai disentuh. **Menggeser**
atau **menggulir** panggungnya mematikan putaran otomatis — dulu satu klik biasa
sudah cukup, dan itu salah: menekan tombol di atas panggung bukan tanda orangnya
mau mengambil alih kamera.

Tombol **PUTAR ULANG** mengembalikan semuanya ke keadaan sesaat setelah halaman
dibuka: kamera di sudut awal, putaran otomatis hidup lagi, kedatangan GIA 652
dimulai ulang dari *final approach*. Yang diatur ulang cuma angka — geometri,
cahaya, dan renderernya tidak dibangun ulang, dan itu yang membuatnya tidak
perlu menyegarkan halaman. Dalam mode hemat gerak panggungnya digambar sekali
lalu berhenti lagi, sama seperti waktu dibuka.

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

Akunnya milik E-Logbook. Dashboard ini tidak menyimpan akun sendiri dan
tidak membuka basis datanya; untuk urusan akun tidak ada satu pun berkas
E-Logbook yang disunting. Yang dipakai hanya fungsi administrator yang sudah
ada di API-nya (`listUsers`, `addUser`,
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

Pemeriksaan `/api/me` gagal, kartu masuk mengatakan servernya tidak terjawab,
dan berhenti di situ. Tidak ada ke mana-mana untuk dijatuhi.

Dulu ada: halaman jatuh ke data contoh, dengan pita `PROTOTIPE` di puncak layar
sebagai penandanya, dan `DATA_CONTOH=0` untuk mematikan jatuhan itu di server
kantor. Data contohnya sudah dibuang seluruhnya, jadi perilaku yang dulu harus
dinyalakan dengan saklar itu sekarang satu-satunya yang ada.

### Modul yang milik dashboard ini, bukan E-Logbook

Jadwal dinas, kegiatan berkala, personel, **daftar peralatan**, sparepart,
sejarah peralatan, dokumen, dan galeri semuanya tersimpan di server dashboard
ini. Yang ditanyakan ke E-Logbook hanya siapa Anda, untuk menentukan boleh
mengisi atau tidak.

Dari E-Logbook sendiri datang tiga hal: daftar unit, isu (jadi papan trouble),
dan catatan logbook.

**Daftar unitnya seluruhnya milik E-Logbook**, termasuk nama dan peralatan unit
yang tidak boleh dibuka akun yang sedang masuk — `getAllData` menjawabnya di
`unitSemua`, di samping `unitSaya` yang jadi pagarnya. Dashboard ini dulu
memegang salinannya sendiri untuk unit-unit bergembok itu, dan salinan itu
sempat meleset: `ppabn` tertulis "Pendaratan Presisi & Navigasi" di sini dan
"Pendaratan Presisi & Alat Bantu Navigasi" di sana, jadi nama yang tampil
bergantung pada peran yang membuka. Yang tersisa di dashboard tinggal
ilustrasi tiap unit (`ADEGAN_UNIT`), satu-satunya kolom yang memang tidak
dijawab E-Logbook.

## Jadwal dinas

Tab **Jadwal Dinas** di dalam Database Unit. Satu matriks per unit per bulan:
baris orang, kolom tanggal, isi tiap sel kode dinas. Kolom hari ini ditandai, dan
dua kolom pertama tetap di tempat saat tabelnya digulir mendatar.

### Kode dinas dan jamnya

Satu daftar untuk semua unit — pembagian JATSC / New JATSC itu pembagian gedung,
dan gedungnya sama untuk seluruh teknik. Huruf terakhir menyebut gedungnya:
**J** = JATSC, **N** = New JATSC. Jamnya sama untuk keduanya.

| Kode | Artinya | Jam (UTC) | Jam (WIB) |
| --- | --- | --- | --- |
| `PSJ` | PS di JATSC | 00:00–12:00 | 07:00–19:00 |
| `PSN` | PS di New JATSC | 00:00–12:00 | 07:00–19:00 |
| `MJ` | Malam di JATSC | 12:00–00:00 | 19:00–07:00 |
| `MN` | Malam di New JATSC | 12:00–00:00 | 19:00–07:00 |
| `P` | Pagi | 00:00–07:00 | 07:00–14:00 |
| `S` | Siang | 07:00–13:00 | 14:00–20:00 |

Jamnya **UTC** — itu yang tertulis di lembar jadwal yang diedarkan tiap bulan,
dan di penerbangan UTC yang jadi patokan. Kartu dinas menyebut keduanya, UTC di
atas dan WIB di bawahnya; hitungan *SEDANG DINAS* dan pita Cakupan 24 Jam
memakai jam UTC, jadi tetap benar walau dashboard dibuka dari zona waktu lain.

`P` dan `S` adalah pecahan `PS` untuk hari yang dibagi dua orang. Kalau hari itu
memakai keduanya, siangnya baru selesai pukul 13:00 dan **malam hari itu mundur
menjadi 13:00–00:00**, bukan 12:00. Pergeserannya dihitung per hari per unit,
dari kode yang benar-benar terisi orang pada hari itu — bukan disimpan di
berkas, jadi memperbaiki satu sel jadwal langsung membetulkan jam malamnya.

**Jangan tertukar dengan `dinas` pada daftar unit E-Logbook.** Nama medannya
sama, isinya bukan: di sana ia pilihan shift untuk lembar logbook — `Pagi`,
`Siang`, `Malam`, `PS`, bentuk lama dari sebelum kode gedung dipakai, dan Radkom
malah memakai daftarnya sendiri. Tabel di atas milik modul Jadwal Dinas dan
tinggal di `KODE_DINAS`.

Keduanya pernah tertukar: `srvPasang()` menimpa `dinas` unit dengan yang dari
E-Logbook, dan hanya untuk unit yang dipegang akun itu. Yang terbaca di layar
jadi *"Kode yang bisa diisi: Pagi · Siang · Malam · PS"* tepat di atas kalimat
yang menerangkan arti huruf `J` dan `N` — kode yang tidak ada di daftarnya
sendiri. Karena itu `unitSemua` yang dikirim E-Logbook sengaja dipangkas jadi
`kode`, `nama`, dan `peralatan` saja.

`PS` dan `M` polos — tanpa huruf gedung — tetap dikenali jamnya kalau terlanjur
terisi, tetapi sengaja tidak ditawarkan di daftar pilihan dan dilaporkan sebagai
kode asing waktu impor: keduanya belum menyebut JATSC atau New JATSC, dan
menebak gedung tempat orang berdinas bukan urusan pengimpor.

**Kartu yang dipasang mengikuti jadwal, bukan daftar kode.** Petak dinas satu
unit hanya memuat kode yang benar-benar terisi di jadwal bulan berjalan unit
itu. Unit yang sepanjang bulan cuma memakai `PSJ/PSN/MJ/MN` tidak membawa dua
kartu `P` dan `S` yang selamanya bertuliskan "tidak ada personel"; begitu ada
satu sel diisi `P`, kartunya muncul sendiri. Yang dikumpulkan seluruh bulan,
bukan hari ini saja — shift yang hari ini kebetulan tidak ada orangnya justru
perlu terlihat, karena itu lubang jaga, bukan shift yang tidak dipakai.
Urutannya menurut jam mulai, jadi pagi selalu di kiri malam.

Daftar pilihan di mode sunting tetap berisi keenam kode — kalau tidak, `P` dan
`S` tidak akan pernah bisa diisi untuk pertama kalinya. Unit yang belum punya
jadwal sama sekali dipasangi empat petak kosong `PSJ/PSN/MJ/MN`. Kode di luar
daftar — salah ketik yang terlanjur tersimpan — tetap ditampilkan di belakang,
tidak dibuang diam-diam.

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

Unit yang belum punya jadwal tampil **kosong**, bukan diisi nama karangan —
sama seperti cuplikan logbook yang kosong.

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
masuk. Kode dinas di lembar Excel disamakan dengan daftar kode di atas: `PSJ`,
`PSN`, `MJ`, `MN`, `P`, `S` apa adanya (huruf besar-kecil diabaikan), `Pagi` dan
`Siang` sebagai nama panjang `P` dan `S`, dan `-`, `L`, `OFF`, `X`, `CUTI`
sebagai libur. Yang tidak dikenali **tidak dibuang**, melainkan dibawa apa
adanya dan dilaporkan, supaya salah ketik di lembar aslinya kelihatan alih-alih
hilang diam-diam. `PS` dan `M` polos ikut dilaporkan dengan alasan yang sama —
keduanya belum menyebut gedung.

Yang ditekan di kartu impor mengisi **draf suntingan**, bukan yang tersimpan.
Tombol *Simpan jadwal* yang menuliskannya, dan *Batal* masih membatalkan
semuanya.

`.xls` yang lama tidak bisa dibaca — simpan ulang sebagai `.xlsx`. PDF hasil
**pindaian** juga tidak: hurufnya sudah berupa gambar, dan halaman ini
mengatakannya alih-alih diam.

## Siapa boleh mengisi apa

Panel di tab **Kelola Akun**, satu baris per modul: Jadwal Dinas, Kegiatan
Berkala, Data Personel, Daftar Peralatan, Sparepart, Dokumen, Galeri Foto.
Kolomnya peran — Administrator, Pejabat, Admin Unit, PIC, Teknisi — ditambah
kolom **Ditunjuk** untuk memberi hak kepada satu orang di luar perannya.

Administrator selalu boleh, di semua modul, dan itu tidak bisa dimatikan dari
layar ini: kalau bisa, satu centang yang salah cukup untuk mengunci orang yang
seharusnya membetulkannya.

Bawaannya:

| Modul | Terbuka sampai | Kenapa berhenti di situ |
| --- | --- | --- |
| Jadwal Dinas | Admin Unit (pejabat ikut) | mengatur orang, bukan mencatat pekerjaan |
| Kegiatan Berkala | Teknisi (pejabat ikut) | yang mengerjakan yang mencentang |
| Data Personel | Teknisi | personel satu unit diurus dari dalam unit itu |
| **Daftar Peralatan** | **Administrator** | daftar induk: trouble, sejarah, dan dokumen menunjuk id-nya, jadi satu baris yang diganti nama menggeser layar orang lain |
| Sparepart | Teknisi | dipakai dan dicatat sehari-hari |
| Dokumen, Galeri Foto | Teknisi | lampiran pekerjaan |

Menghapus baris terpisah dari mengisi, dan tidak ikut matriks ini: hanya
administrator dan admin unit, di unitnya masing-masing.

Semuanya bawaan, bukan aturan mati — matriksnya bisa membuka ulang modul mana
pun, termasuk daftar peralatan.

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

### Shift yang mengerjakan

Selain harinya, tiap kegiatan boleh menyebut **shift**: kolom *Shift* dengan
tiga pilihan.

| Shift | Yang diberi tahu | Kode dinas yang terhitung |
| --- | --- | --- |
| *(Semua shift)* | siapa pun yang berdinas hari itu | semua |
| PS | rombongan pagi–siang | `PSJ`, `PSN`, `PS`, dan hari yang dipecah `P` + `S` |
| Malam | rombongan malam | `MJ`, `MN`, `M` |

Alasannya: “berdinas hari Senin” masih menyebut dua rombongan yang tidak pernah
bertemu. Pekerjaan yang hanya bisa dikerjakan saat lalu lintas sepi — restart
terjadwal, misalnya — tidak ada gunanya dibunyikan ke yang pulang jam satu
siang.

Huruf gedungnya sengaja tidak ikut. Pekerjaan berkala melekat pada peralatan di
unitnya, bukan pada gedung tempat orangnya duduk; memisahkan `PSJ` dari `PSN`
hanya akan membuat satu pekerjaan yang sama harus ditulis dua kali. Hari yang
dipecah `P` (00–07) dan `S` (07–13) tetap dihitung PS — orangnya sama, cuma
dibagi dua.

Yang disaring **hanya loncengnya**. Menandai selesai tetap terbuka untuk siapa
pun yang sudah masuk, sama seperti sebelumnya. Kalau kode dinas di lembar
jadwal tidak dikenal sama sekali, penyaringnya dilewati dan loncengnya tetap
berbunyi: diam gara-gara kode asing jauh lebih buruk daripada bunyi yang salah
alamat.

Kegiatan yang tersimpan sebelum kolom ini ada terbaca sebagai *Semua shift*,
jadi tidak ada yang berubah sampai ada yang mengisinya.

Muncul di empat tempat, dan itu memang gunanya:

- **tabel jadwal dinas** — baris penanda di atas nama-nama, jadi tanggal yang
  ada pekerjaannya terlihat sambil mencari nama sendiri; shiftnya disebut di
  tooltip petaknya
- **beranda** — panel *Perlu Perhatian*, yang lewat jatuh tempo lebih dulu
- **lonceng tiap akun** — hanya untuk yang namanya tercantum di dinas hari itu,
  di unit tempat pekerjaannya jatuh tempo, dan hanya kalau shiftnya cocok
- **Kotak Masuk** — seluruh kejadian periode berjalan beserta tujuannya, lihat
  bagian di bawah

**Menandai selesai** boleh dilakukan siapa saja yang sudah masuk — yang
mengerjakan pekerjaan mingguan adalah teknisi yang kebetulan berdinas, dan
merekalah yang paling berhak mengatakannya. Yang mengatur *daftar*-nya tetap
terbatas menurut panel hak di atas. Tandanya berlaku untuk periode berjalan
saja: minggu depan ia kembali kosong dengan sendirinya.

Tanggal 29, 30, dan 31 sengaja tidak bisa dipilih untuk pekerjaan bulanan —
Februari tidak punya ketiganya, dan pekerjaan yang jatuh pada tanggal yang tidak
ada tidak akan pernah muncul sama sekali.

### Tanda yang datang dari E-Logbook

Sebagian pekerjaan sudah punya bukti yang lebih baik daripada centang: lembar
kerjanya sendiri. Karena itu tiap kegiatan menyebut **sumber tandanya**, kolom
*Sumber* di daftar kegiatan:

| Sumber | Yang menandai selesai | Unit yang punya formulirnya |
| --- | --- | --- |
| *(kosong)* | ditandai di dashboard ini, seperti biasa | semua |
| `dstest` | lembar **DS Test** di E-Logbook pada tanggal itu | Radtel |
| `dailycheck` | lembar **Daily Check** pada tanggal itu | Radtel, Radkom |
| `monitoring` | lembar **Monitoring Frekuensi** pada tanggal itu | Radkom |

Kolom terakhir bukan setelan dashboard: ia dibaca dari penanda `adaDsTest`,
`adaDailyCheck`, dan `adaMonitoring` pada daftar unit E-Logbook. Unit yang
tidak punya formulirnya tidak dipasangi tombol tautannya — di sana tabnya
memang disembunyikan. Kalau sebuah kegiatan terlanjur menyebut formulir yang
unitnya tidak punya, kartunya mengatakan begitu terang-terangan: tandanya tidak
akan pernah datang, dan kartu merah tanpa sebab lebih buruk daripada teguran.

Yang sudah terpasang di data: **Pengecekan DS (DS Test)** di unit **Radtel** —
mingguan, hari 1, 3, dan 6 (Senin, Rabu, Sabtu). Begitu lembar DS Test tanggal
itu ada di E-Logbook, barisnya berubah jadi sudah dikerjakan sendiri, hilang
dari jatuh tempo, dan lonceng berhenti menyebutnya. Isi lembarnya tetap tinggal
di sana; yang dibaca dashboard cuma tanggalnya. Yang membedakan dua lembar di
hari yang sama ikut disebut — kategori pada DS Test, dinas pada Daily Check.

**Menyambungkan formulir berikutnya.** DS Test cuma ada di satu unit, jadi
sambungan yang berhenti di situ tidak berarti banyak. Karena itu daftar sumber
dibuat sebagai registri, bukan sederet perbandingan yang tersebar: satu baris di
`BERKALA_SUMBER` pada `public/index.html` menyebut sebutannya, larik mana yang
dibaca dari `getAllData`, tab mana yang dituju tautannya, dan penanda per unit
mana yang menentukan tombolnya dipasang. Cip di kartu, pemilih di mode sunting,
tombol tautan, dan Kotak Masuk ikut sendiri. Satu baris lagi ditambahkan di
`server.js` — sumber yang tidak terdaftar di sana tidak akan pernah bisa
disimpan, dan itu memang yang diinginkan.

**LTK sengaja tidak ikut** walau tabnya ada di semua unit: LTK dibuat waktu ada
kerusakan, bukan menurut putaran waktu. Memakainya sebagai bukti kegiatan
berkala berarti pekerjaan rutin baru terhitung selesai kalau ada yang rusak.

Alasannya: dua catatan untuk satu pekerjaan bisa berselisih, dan yang dipercaya
orang justru yang lebih mudah ditekan, bukan yang berisi hasilnya. Karena itu
kegiatan yang bersumber lembar **tidak bisa** ditandai manual — juga oleh yang
berhak. Layar menyembunyikan tombolnya, dan server menolak permintaannya dengan
**409** beserta alasannya, karena menyembunyikan tombol tidak pernah menghalangi
siapa pun memanggil endpointnya langsung.

**Cipnya sekaligus pintunya.** Di kartu kegiatan, menekan cip **DS TEST** (atau
DAILY CHECK, MONITORING) membuka tab itu di E-Logbook langsung — tidak lewat
halaman depan, tidak perlu memilih unit di sana. Itu jalan terpendek dari
"kartunya bilang belum" ke "lembarnya diisi", dan cip memang tempat orang
mencari: di situ nama formulirnya tertulis. Cip yang bisa ditekan berpanah ↗ dan
berubah warna saat disentuh; cip keterangan biasa seperti MINGGUAN tidak.

Di **Kotak Masuk** jalannya lewat tombol bernama di kolom kanan — *Buka DS Test*
dan seterusnya — karena di sana kolom itu memang kolom tindakan.

Keduanya jatuh kembali jadi keterangan biasa dalam tiga keadaan, dan ketiganya
sama sebabnya: pintu yang tidak menuju ke mana-mana lebih buruk daripada tidak
ada pintu. Yaitu kalau kegiatannya tidak bersumber lembar, kalau alamat
E-Logbook belum diketahui, atau kalau unit itu memang tidak punya formulirnya —
di sana tabnya disembunyikan, dan tautannya cuma akan mendarat di tab biasa.

Tanpa server, kegiatan ini jatuh kembali ke tanda manual — dan kartunya
mengatakan begitu, bukan diam-diam.

## Kotak Masuk

Layar **Kotak Masuk** di rel kiri: seluruh kejadian kegiatan berkala di periode
berjalan, dikelompokkan per tanggal, dan tiap baris menyebut **siapa yang kena**.

Tujuannya dibaca dari **jadwal dinas pada tanggal kejadian** — bukan dari daftar
akun, dan bukan dari siapa yang kebetulan berdinas hari ini. DS Test yang jatuh
Sabtu adalah pekerjaan orang yang jadwalnya Sabtu; memberitahukannya kepada yang
berdinas Senin cuma melahirkan pertanyaan, bukan pekerjaan yang selesai.

Dua saringan: **tertuju ke saya** dan **semua**. Lencana di rel menghitung yang
tertuju ke Anda dan belum beres saja — lencana yang tidak bisa dikosongkan siapa
pun akan berhenti dibaca dalam sepekan.

Nama di jadwal diketik tangan, jadi dicocokkan longgar dengan nama akun. Baris
yang tidak cocok dengan siapa pun tetap ditampilkan beserta nama penerimanya,
supaya tidak ada pekerjaan yang diam-diam tidak jadi milik siapa-siapa. Kalau
jadwalnya memang belum bisa dibaca — bulan lain yang belum dimuat, atau unit
yang belum punya jadwal bulan ini — yang disebut sebabnya, bukan daftar kosong.

Loncengnya tetap ada dan tugasnya memang berbeda:

| | Yang dijawab |
| --- | --- |
| **lonceng** | apa yang perlu **saya** kerjakan **hari ini** — pendek, dan pergi begitu beres |
| **Kotak Masuk** | seluruh kejadian **periode ini** beserta tujuannya, termasuk milik orang lain |

**Tidak ada penyimpanan baru.** Kotak ini seluruhnya diturunkan dari kegiatan
berkala + jadwal dinas + catatan selesai yang sudah ada. Tidak ada butir yang
bisa "dibaca" atau "diarsipkan": yang mengosongkan satu baris cuma pekerjaannya
benar-benar dikerjakan.

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
dihapus dari layar. Saat tersambung keduanya tersimpan di server ini —
`data/peralatan.json` dan `data/sparepart.json`, berkunci kode unit — jadi
suntingan satu orang terlihat oleh unitnya. Tanpa server, keduanya jatuh ke
`localStorage` peramban yang sedang dipakai dan tombol **Kembalikan ke bawaan**
di tab Peralatan membuang seluruh suntingan sekaligus.

Siapa yang boleh menyunting berbeda di antara keduanya, dan itu disengaja.
**Sparepart** terbuka sampai teknisi: ia dipakai dan dicatat sehari-hari.
**Daftar peralatan** hanya administrator — trouble, sejarah, dan dokumen
menunjuk barisnya lewat `id`, jadi satu baris yang diganti nama atau dibuang
menggeser layar orang lain. Bawaan itu bisa dibuka lagi dari matriks hak.

`data/peralatan.json` di pemasangan yang baru berisi daftar awal untuk kedelapan
unit — Garex dan Neptuno di Radtel, ILS dan DVOR di PPABN, dan seterusnya —
supaya layar peralatan tidak dijumpai kosong sama sekali di hari pertama. Ganti
isinya dengan alat yang sebenarnya begitu datanya siap; `data/` tidak ikut git,
jadi tiap pemasangan memegang isinya sendiri.

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

## Dokumen unit

Tab **Dokumen** di dalam Database Unit: SOP, manual, sertifikat kalibrasi,
berita acara, foto papan nama. Tarik berkasnya ke kotak, atau tekan kotaknya
untuk memilih dari komputer. Dua kotak di atasnya — *Kaitkan ke peralatan* dan
*Kategori* — berlaku untuk berkas yang ditambahkan berikutnya; kategori yang
dibiarkan kosong ditebak dari nama berkasnya.

**Berkasnya tersimpan di server dashboard ini**, dan menyegarkan halaman tidak
menghilangkannya lagi. Dulu memang hilang: yang disimpan cuma object URL di
memori tab, karena waktu itu belum ada keputusan berkasnya mau ditaruh di mana.

**Tempatnya `data/dokumen/`, bukan `public/`.** Itu bedanya dengan galeri foto.
Galeri berisi foto yang memang untuk dipandang siapa saja yang membuka
dashboard, jadi ia disajikan sebagai berkas statis. Dokumen tidak — di dalamnya
ada SOP, sertifikat, dan berita acara bertanda tangan. `data/` tidak pernah
disajikan `express.static`, jadi satu-satunya jalan mengambilnya lewat
`GET /dokumen/:unit/:id`, yang **menuntut sesi E-Logbook**. Tanpa masuk,
jawabannya 401 — termasuk kalau alamatnya ditempel langsung di peramban.

Daftarnya sendiri terbuka seperti jadwal dinas dan kegiatan berkala: yang
berdinas perlu tahu ada dokumen apa tanpa harus masuk. Yang menuntut sesi cuma
isi berkasnya.

**Nama di disk bukan nama aslinya.** Yang tersimpan `<id>.<ekstensi>` dengan id
acak 16 heksadesimal; nama yang Anda lihat tinggal di `daftar.json` dan ikut
turun lagi saat berkasnya dibuka. Tiga hal sekaligus beres: tidak ada jalan
tembus lewat `../` di nama berkas, dua berkas bernama sama tidak saling
menimpa, dan nama berspasi atau bertanda kurung tidak perlu dipotong supaya
aman di disk.

| | |
| --- | --- |
| Paling besar | 25 MB per berkas |
| Yang diterima | PDF · DOC/DOCX · XLS/XLSX · PPT/PPTX · ODT/ODS/ODP · RTF/TXT/CSV/MD · JPG/PNG/WEBP/GIF/BMP/TIF · ZIP/RAR/7Z · DWG/DXF |
| Yang ditolak | apa pun di luar daftar itu — termasuk `.exe`, `.bat`, `.ps1`, `.js`, `.html`, `.svg` |

Daftar putih, bukan daftar hitam: yang tidak disebut ditolak. Berkas yang bisa
dijalankan atau bisa membawa skrip tidak punya urusan di rak dokumen — sekali
ada di sana, ia menunggu ditekan orang.

**Siapa boleh apa.** Menambah dan mengganti kategori: menurut panel *Siapa Boleh
Mengisi Apa* untuk modul `dokumen`, dan hanya pada unit yang dipegang akun itu.
Mengeluarkan: administrator saja, dan berkasnya ikut terhapus dari server.
Membuka: siapa pun yang sudah masuk. Penjagaannya di server; kotak unggahnya
memang padam sendiri kalau akun itu tidak berhak, tapi itu cuma kenyamanan.

Di Vercel dan sejenisnya penyimpanannya tidak permanen, jadi unggahnya
dimatikan dengan sebabnya — bukan 500 dari `fs.writeFile` yang tidak berarti
apa-apa bagi pemakai. Sama seperti galeri dan jadwal dinas.

## Log aktivitas

Layar **Aktivitas** di rel navigasi menjawab pertanyaan yang selalu datang
sesudah sebuah data berubah: ini siapa yang mengisi.

Sumbernya dua, dan bedanya penting:

- **server** — jadwal dinas, kegiatan berkala, personel, peralatan, sparepart,
  hak, logo, dan galeri. Ditulis `server.js` ke `data/aktivitas.json` dengan
  identitas dari sesi E-Logbook yang sungguhan, jadi berlaku untuk semua orang
  dan tidak bisa dikarang dari peramban. Terbaca hanya oleh yang sudah masuk.
- **peramban ini** — modul yang belum dicatat server. Catatannya tinggal di
  `localStorage`, dan barisnya diberi tanda supaya tidak disangka berlaku
  bersama.

Yang dicatat hanya **perbuatannya** — modul, unit, dan sepotong keterangan —
bukan isi datanya. Nomor lisensi tidak pernah ikut masuk ke sini. Berkasnya
tinggal di `data/`, yang di luar git.

### Bahasa

Tombol **EN / ID** di kepala dashboard mengganti bahasanya. Pilihannya tersimpan
di `localStorage`. Yang diterjemahkan isi dashboard; layar masuk tetap seperti
apa adanya — konsol operasionalnya memang sudah berbahasa Inggris. Nama unit
(“Listrik dan Mekanik”, “Gedung dan Keamanan”) tidak diterjemahkan: itu nama
organisasi, bukan istilah.

## Gambar pengenal unit

Kotak di kiri nama unit, di kepala Database Unit. Bawaannya **ilustrasi vektor**
yang dibangkitkan halaman ini sendiri menurut jenis unitnya — menara untuk
Radtel, antena untuk Radkom, dan seterusnya. Cukup sebagai penanda, tapi ia
bukan gambar unit yang sebenarnya.

**Administrator bisa menggantinya dari layar.** Tekan kotaknya (tulisan *Pilih
gambar* muncul saat kursor lewat), pilih berkasnya, selesai — gambarnya
langsung berlaku untuk semua orang. Tombol **Pakai ilustrasi** di sebelah
kanan kepala mengembalikannya ke ilustrasi bawaan dan menghapus berkasnya.

Batas 2 MB, `.png`, `.webp`, `.jpg`, atau `.svg`. Berkasnya tersimpan di
`public/foto/_logo/<kode unit>.<ext>` dengan daftarnya di
`public/foto/_logo/daftar.json`; awalan garis bawah membuatnya tidak mungkin
bentrok dengan folder galeri unit, yang kodenya hanya huruf dan angka. Gambar
dipotong ke bingkai 96×60, bukan diperas, jadi logo persegi dan foto lanskap
sama-sama utuh bentuknya.

**Hanya administrator, dan itu tidak ikut matriks hak.** Mengganti gambar unit
mengubah layar semua orang sekaligus, dan tidak ada centang di layar hak yang
pantas membukanya tanpa sengaja. Servernya yang memutuskan; layar cuma tidak
menggambar tombolnya untuk yang pasti ditolak.

Ikut `.gitignore` bersama galeri, dengan alasan yang sama — hasil clone datang
dengan ilustrasi bawaan sampai gambarnya dipasang lagi.

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

`POST /galeri/:unit`, `DELETE /galeri/:unit/:berkas`, dan `POST|DELETE
/logo/:unit` adalah bagian yang menulis **berkas gambar** ke disk. Keempatnya
sekarang meminta sesi E-Logbook: galeri dipagari per unit seperti modul lain,
logo hanya administrator. Nama berkas disaring ketat (basename, daftar putih
karakter, hanya ekstensi gambar) sehingga tidak bisa dipakai menulis ke luar
`public/foto/`, dan penghapusan galeri hanya berlaku untuk berkas yang memang
terdaftar.

## Setelan

Lewat environment variable, atau salin `.env.example` jadi `.env`:

| Nama            | Bawaan                  | Guna                                        |
| --------------- | ----------------------- | ------------------------------------------- |
| `PORT`          | `3100`                  | port aplikasi ini                           |
| `HOST`          | `0.0.0.0`               | alamat bind                                 |
| `ELOGBOOK_ASAL` | `http://127.0.0.1:3000` | alamat server E-Logbook                     |
| `ELOGBOOK_MATI` | —                       | set `1` untuk memutus penerusan             |
| `ELOGBOOK_TAUTAN` | `/logbook/`           | alamat tombol "Buka E-Logbook". Biarkan kosong — mengisinya memindahkan tombol ke host E-Logbook, berikut sesi yang terbelah |
| `ELOGBOOK_PORT` | `3000`                  | port E-Logbook yang dinyalakan `npm start`  |
| `GALERI_MATI`   | —                       | set `1` untuk mematikan unggah dan hapus foto |

Satu lagi milik E-Logbook, dipasang di `elogbook/.env`:

| Nama                     | Bawaan | Guna                                              |
| ------------------------ | ------ | ------------------------------------------------- |
| `ELOGBOOK_DAFTAR_AKUN`   | `1`    | set `0` untuk menutup daftar akun pra-login — dashboard sudah tidak memakainya |

`GALERI_MATI` menyala sendiri kalau `VERCEL` terdeteksi — di sana berkas
aplikasi baca-saja dan yang tertulis ke `/tmp` hilang begitu fungsinya selesai.
Jadwal dinas ikut aturan yang sama: bisa dibaca di sana, tidak bisa disimpan.

`DATA_CONTOH` pernah ada di tabel ini — set `0` supaya halaman tidak pernah
jatuh ke data contoh. Data contohnya sudah dibuang, jadi tidak ada lagi yang
membacanya; variabel yang terlanjur terpasang boleh dibiarkan.

`GET /_info` menjawab setelan yang sedang dipakai — berguna untuk memastikan
servernya menunjuk ke E-Logbook yang benar. Tiga kolomnya — `galeriBisaTulis`,
`dokumenBisaTulis`, dan `elogbookTerjangkau` — dipakai halaman untuk tidak
menawarkan sesuatu yang pasti gagal: ketiganya tidak bisa ditebak dari sisi
peramban, gagalnya baru ketahuan setelah tombolnya terlanjur ditekan.

## Deploy ke Vercel

Bagian ini sudah dilewati keadaan, dan yang berlaku sekarang ada di
[DEPLOY.md](DEPLOY.md). Ringkasnya: sejak 19 Agustus 2026 kedua aplikasi hidup
di Vercel dengan Supabase sebagai simpanannya, jadi yang ter-deploy memegang
data yang sungguhan — bukan etalase. Yang tertulis di bawah ini berasal dari
masa sebelum itu dan dibiarkan sebagai catatan sejarah.

Berkas yang mengurus itu:

- `api/index.js` — satu baris, menyerahkan app Express ke Vercel. Vercel
  memanggil fungsi tiap permintaan, bukan menyalakan server; `server.js` karena
  itu hanya memanggil `listen()` kalau dijalankan langsung.
- `vercel.json` — `/api/*`, `/galeri/*`, dan `/_info` diarahkan ke fungsinya.
  Sisanya berkas statis dari `public/`, disajikan Vercel langsung.

Setel `ELOGBOOK_MATI=1` di environment variable proyek Vercel-nya. Tanpa itu tiap
panggilan data menunggu 30 detik sampai batas waktu penerusan habis, baru gagal.
Galeri mati dengan sendirinya di sana lewat deteksi `VERCEL`.

Halaman menyesuaikan diri tanpa perlu diberi tahu: tombol **Buka E-Logbook**
tidak dipasang kalau tidak ada alamat yang masuk akal untuk dituju, kotak unggah
foto dan dokumen diganti keterangan kalau simpanannya tidak permanen, dan tombol
hapus tidak digambar untuk yang tidak berhak.

## Asal-usul

Halaman ini lahir sebagai prototipe `public/contoh/dashboard-3d.html` di dalam
E-LogBook-Server. Salinan aslinya sengaja **tidak dihapus** dari sana: masih
dipakai untuk uji coba dan sebagai pembanding. Sejak dipindah ke sini, yang
dikembangkan adalah salinan di proyek ini.

Layar masuknya berasal dari proyek Claude Design "Animasi Bandara Soekarno Hatta
3D". Semua kelas dan id miliknya berawalan `km` supaya tidak bertabrakan dengan
dashboard di bawahnya.
