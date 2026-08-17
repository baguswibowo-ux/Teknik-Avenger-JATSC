# E-Logbook New JATSC — Server Mandiri

Pengganti versi Google Apps Script + Spreadsheet. Semua data disimpan di server
sendiri, tidak lagi bergantung pada akun Google.

- **Aplikasi**: Node.js + Express
- **Database**: SQLite, satu berkas di `data/elogbook.db`
- **Tanda tangan**: berkas PNG di `uploads/`
- **Tampilan**: `public/index.html` (kerangka halaman) + `public/css/` (gaya)
  + `public/js/` (kode) — peta lengkapnya di `PETA-BERKAS.md`

---

## 1. Syarat

**Node.js versi 22.5 atau lebih baru** (dites di v24). Cek dengan:

```bash
node -v
```

Kalau belum ada, unduh installer LTS dari nodejs.org, pasang di server, lalu
buka Command Prompt baru.

Tidak ada modul yang perlu dikompilasi — SQLite-nya bawaan Node — jadi server
kantor tanpa Visual Studio Build Tools pun tetap bisa memasangnya.

## 2. Pemasangan pertama

Dari folder ini:

```bash
npm install
```

Lalu jalankan:

```bash
npm start
```

Karena database masih kosong, server otomatis membuat akun awal dan
**mencetak passwordnya sekali saja di layar**:

```
username : admin
password : xxxxxxxx
```

Catat password itu, lalu buka `http://localhost:3000` dan masuk.

Segera ganti passwordnya:

```bash
npm run user -- passwd admin
```

## 3. Peran dan akun

Ada tiga peran, dan pembagiannya tegas:

| | Administrator | Pejabat | Teknisi |
|---|---|---|---|
| Lihat seluruh unit | ya | ya | hanya unit yang diberikan |
| Tambah catatan logbook, daily check, isu | ya | **tidak** | ya |
| Lampirkan hasil scan / foto | ya | **tidak** | ya |
| Bubuhkan tanda tangan susulan | ya | **ya** | **tidak** |
| Ubah isu (termasuk status dan tanggal) | ya | **tidak** | **tidak** |
| Hapus catatan, daily check, isu | ya | **tidak** | **tidak** |
| Buat, hapus, dan setel akun | ya | **tidak** | **tidak** |

Administrator adalah pengelola sistem, bukan teknisi yang berdinas. Teknisi
hanya memasukkan data — begitu tersimpan, hanya administrator yang bisa
mengubah atau menghapusnya. Pejabat (manager teknik dan setingkatnya) membaca
seluruh unit; satu-satunya perubahan yang boleh dilakukannya adalah
menandatangani, dan itu pun hanya pada petak yang masih kosong.

Penjagaannya ada di server: tombolnya memang disembunyikan dari layar teknisi,
tetapi yang benar-benar menahan adalah API, yang menjawab **403** untuk setiap
fungsi administrator yang dipanggil akun teknisi.

### Tanda tangan susulan oleh pejabat

Teknisi mengisi formulir saat dinas, sementara tanda tangan pihak kedua sering
baru dibubuhkan berhari-hari kemudian. Sebelumnya satu-satunya jalan adalah
menghapus catatannya lalu mengetik ulang seluruh isinya.

Sekarang: pejabat membuka catatannya lewat tombol **👁 Detail**, dan pada petak
tanda tangan yang masih kosong ada tombol **✍ Bubuhkan TTD**. Berlaku di lima
formulir, masing-masing pada petak pihak keduanya:

| Formulir | Petak yang bisa ditandatangani |
|---|---|
| Logbook Fasilitas | Penanggung Jawab |
| Daily Check | Mengetahui — Manager Teknik |
| Form Monitoring Frekuensi | Personil Operasi |
| DS Test | Mengetahui — Manager Teknik |
| LTK | Mengetahui — Manager Teknik |

**Nama pada formulir tidak berubah.** Nama penanggung jawab atau manager teknik
sudah ditulis teknisi waktu mengisi formulirnya, dan itulah nama yang sah di
lembar cetak — membubuhkan tanda tangan tidak menggesernya. Akun yang
membubuhkan dicatat terpisah dan tampil sebagai keterangan kecil di bawah tanda
tangan pada jendela detail (*dibubuhkan oleh … · tanggal jam UTC*); keterangan
itu **tidak ikut tercetak**, karena bukan bagian dari formulir bakunya.

Satu perkecualian: kalau nama pada formulir memang masih kosong, nama akun
penandatangan yang dipakai — supaya petaknya tidak tercetak bertanda tangan
tanpa nama sama sekali. Jendela pembubuhan menyebutkan yang mana yang berlaku
sebelum tanda tangannya disimpan.

Tiga hal yang dijaga server, bukan sekadar disembunyikan di layar:

- Identitas penandatangan diambil dari akun yang sedang masuk, tidak bisa
  diketik sendiri.
- Petak yang **sudah** ditandatangani tidak pernah ditimpa — administrator pun
  ditolak. Mengganti tanda tangan yang sudah ada bukan melengkapi, itu menghapus
  paraf orang lain.
- Selain petak tanda tangan dan catatan siapa yang membubuhkannya, tidak ada
  kolom lain yang bisa disentuh lewat jalur ini.

Setiap catatan menyimpan siapa yang menginputnya, dan namanya ditampilkan di
kartu logbook, riwayat daily check, serta kolom "Dilaporkan Oleh" pada tabel isu.

### Lewat aplikasi (cara biasa)

Masuk sebagai administrator, buka tab **👤 KELOLA AKUN**. Dari situ bisa membuat
akun baru beserta passwordnya, mengganti peran, menyetel ulang password,
menonaktifkan akun, dan menghapusnya. Tab ini tidak muncul untuk teknisi.

Administrator aktif terakhir tidak bisa dinonaktifkan atau diturunkan perannya,
supaya sistem tidak pernah kehilangan pengelola.

**Unit mana yang terbuka saat masuk.** Tidak ada kotak unit yang tercentang
lebih dulu waktu membuat akun — memilihnya harus disengaja, karena unit yang
tercentang menentukan logbook mana yang dibuka orang itu setiap kali masuk.
Sesudahnya, akun membuka unit yang **terakhir dia pilih sendiri di perangkat
itu**; kalau belum pernah memilih, yang terbuka unit pertama yang boleh dibukanya.
Ingatan itu melekat pada akun, bukan pada komputernya, jadi satu komputer yang
dipakai bergantian tidak membawa unit orang sebelumnya. Kalau haknya berubah
dan unit yang diingat sudah tidak boleh dibuka, layarnya pindah sendiri ke unit
yang sah — bukan gagal memuat.

**Menghapus akun.** Tombol Hapus hanya muncul pada akun yang sudah dinonaktifkan
— jadi urutannya selalu Nonaktifkan dulu, baru Hapus. Menonaktifkan sudah memutus
seluruh sesinya, sementara penghapusan tidak bisa dibatalkan, jadi jeda itu
disengaja. Yang ikut terhapus hanya akunnya: sesi dan daftar unitnya. Catatan
yang pernah diinput akun itu **tetap tersimpan** lengkap dengan namanya, karena
kolom "diinput oleh" menyimpan nama sebagai teks, bukan sambungan ke akun. Akun
sendiri tidak bisa dihapus oleh pemiliknya.

### Lewat command line (cadangan)

Berguna kalau semua administrator terkunci di luar:

```bash
npm run user -- list
npm run user -- add bagus "Bagus Wibowo"
npm run user -- add supervisor "Supervisor Teknik" admin
npm run user -- passwd bagus
npm run user -- disable bagus
npm run user -- enable bagus
```

Password diminta lewat prompt (tidak tersimpan di riwayat perintah). Tambahkan
`--auto` kalau ingin dibuatkan password acak.

Menonaktifkan akun langsung memutus sesi login orang itu di semua perangkat.

## 3b. Lampiran hasil scan dan foto

Saat menambah catatan logbook bisa dilampirkan berita acara hasil scan atau foto
kondisi peralatan.

- Maksimal **6 berkas** per catatan, **8 MB** per berkas
- Jenis yang diterima: **JPG, PNG, WEBP, PDF** — ditolak server kalau lain
- Foto besar dikecilkan otomatis di browser (sisi terpanjang 1600 px) sebelum
  dikirim, jadi foto HP 8 MB biasanya menyusut jadi ratusan KB
- PDF tidak disentuh supaya hasil scan dokumen tetap utuh
- Nama berkas di disk ditentukan server, bukan mengikuti nama dari pengirim
- Berkasnya ikut terhapus saat catatannya dihapus administrator
- Sama seperti tanda tangan, lampiran hanya bisa dibuka setelah login

Lampiran tersimpan di `uploads/` bersama tanda tangan — **ikut wajib dibackup**.

Isu juga bisa dilampiri bukti, dipisah dua fase:

- **Saat kejadian** — dilampirkan teknisi ketika melaporkan isu
- **Saat selesai** — dilampirkan administrator ketika isu ditutup

Batas 6 berkas dihitung terpisah untuk tiap fase, jadi bukti open dan closed
masing-masing punya jatah sendiri. Menempelkan bukti ke isu yang sudah tersimpan
berarti mengubah isu itu, jadi hanya administrator yang bisa — teknisi
melampirkan buktinya sekaligus saat mengisi form isu.

Isu punya kolom **Dilaporkan Oleh** yang diketik bebas, karena yang menemukan
gangguan sering bukan orang yang mengetikkannya ke sistem. Nama penginput tetap
tercatat terpisah dan muncul sebagai keterangan saat kursor diarahkan ke sel itu.

## 3b-2. Waktu selalu UTC dan selalu dari server

Seluruh waktu di aplikasi memakai **UTC**, dan sumbernya **jam server**, bukan
jam PC atau laptop yang membuka aplikasi.

Alasannya: memakai UTC saja hanya membuang selisih zona waktu. Kalau jam laptop
teknisi sendiri meleset — dan itu sering terjadi pada PC yang tidak tersinkron
NTP — catatan logbooknya ikut meleset. Karena itu setiap jawaban dari server
membawa header `Date`, dan selisihnya terhadap jam lokal dipakai mengoreksi
seluruh waktu di layar. Penyelarasan terjadi otomatis di tiap panggilan, tanpa
permintaan tambahan.

Yang mengikuti jam server:

- Jam dinding di kanan atas
- Tanggal dan jam yang terisi otomatis di form Tambah Catatan
- Tanggal pada form Daily Check
- Tanggal Report yang terisi otomatis pada form Isu
- Tanggal Report dan Tanggal Closed yang diisi server saat isu dibuat/ditutup
- Nama folder backup (berakhiran `Z` sebagai penanda UTC)

Kalau jam komputer meleset lebih dari dua menit, di bawah jam muncul keterangan
`· jam server`, dan mengarahkan kursor ke situ menampilkan berapa menit
selisihnya. Yang dipakai aplikasi tetap jam server.

Sebelum aplikasi berhasil menghubungi server, jam sementara memakai jam komputer
dan keterangannya menyebutkan hal itu — begitu tersambung, langsung terkoreksi.

### Jejak waktu input (administrator saja)

Tanggal dan jam di setiap catatan **diketik sendiri** oleh yang mengisi, jadi
keduanya belum tentu sama dengan kapan catatannya benar-benar masuk. Di samping
"diinput oleh", administrator melihat stempel waktu aslinya:

```
diinput oleh Dewi Larasati   ⏱ 10 AGU 2026 00:19 UTC   −1j 59m
```

Angka itu dicatat server sendiri saat baris masuk, bukan dikirim dari perangkat
pengisi — jadi tidak bisa diatur dari sisi teknisi. Ini yang dipakai memilah
catatan sebelum menghapus: mana yang memang sesuai, mana yang perlu ditanyakan.

Lencana selisih hanya muncul kalau selisihnya di luar kewajaran, dan ambangnya
sengaja **tidak sama untuk kedua arah**:

| Lencana | Artinya | Muncul kalau |
|---|---|---|
| `+4j 30m` (kuning) | diketik setelah waktu yang tertulis — catatan disusulkan | lewat 2 jam |
| `−1j 59m` (merah) | diketik **sebelum** waktu yang tertulis | lewat 5 menit |

Catatan yang disusulkan itu lumrah — dinas malam sering baru sempat diketik pagi
harinya. Sebaliknya, catatan yang diketik mendahului waktu yang ditulisnya tidak
punya penjelasan wajar: kejadiannya belum terjadi waktu barisnya dikirim. Karena
itu arah yang kedua hanya diberi toleransi selisih jam perangkat.

Untuk catatan yang hanya bertanggal tanpa jam (daily check, monitoring, DS test,
LTK), yang dibandingkan tanggalnya saja, dan lencananya berbunyi `+1 hari`.

Seluruh jejak ini **tidak dikirim sama sekali** ke peran selain administrator —
bukan cuma disembunyikan di layar — dan tidak ikut tercetak di formulir.

## 3b-3. Lokasi gedung pada catatan logbook

Fasilitas satu unit tersebar di dua gedung, dan lembar catatannya memang
dibedakan per gedung. Karena itu form **Tambah Catatan** punya pilihan
**Lokasi**: `JATSC` atau `New JATSC`.

Pilihan terakhir diingat per perangkat — satu dinas biasanya dijalani di gedung
yang sama sepanjang hari, jadi tidak perlu dipilih ulang tiap kali menambah
catatan. Kalau perangkat itu belum pernah memilih, bawaannya `New JATSC`.

Pada hasil cetak, gedung muncul di salah satu dari dua tempat — tidak pernah
keduanya:

- **Kalau seluruh isi cetakan dari gedung yang sama** (termasuk saat disaring
  lewat filter Lokasi), gedungnya tertulis sekali di baris *Penyelenggara
  Pelayanan* pada kop, dan tabelnya sama persis dengan bentuk form fisik.
- **Kalau bercampur dua gedung**, kop tidak menyebut gedung mana pun — menyebut
  satu gedung untuk catatan dari dua gedung itu keliru — dan sebagai gantinya
  muncul kolom **LOKASI** pada tiap baris.

Catatan yang dibuat sebelum fitur ini ada tidak punya lokasi, dan memang
dibiarkan kosong: gedungnya tidak pernah dicatat waktu itu, jadi menebaknya
sekarang sama saja dengan mengarang isi buku catatan. Cetakannya tetap seperti
sebelumnya.

Formulir lain (daily check, monitoring, DS test, LTK) belum mencatat gedung.

Daftar gedungnya ada di satu tempat — `LOKASI` di `db.js` dan `db-pg.js` —
jadi menambah gedung ketiga kelak cukup di baris itu; form dan filternya
menyesuaikan sendiri.

## 3c. Cetak

| Tombol | Isi |
|---|---|
| **🖨 Cetak Logbook** | Tabel logbook per rentang tanggal, dinas, dan lokasi |
| **🖨** pada kartu catatan | Satu catatan saja |
| **🖨 Cetak Daftar Isu** | Tabel isu per rentang tanggal report dan status |
| **🖨 Cetak** pada detail isu | Satu isu saja |
| **🖨** pada riwayat daily check | Form daily check tersimpan |

Lampiran ikut tercetak di halaman terpisah setelah tabel, supaya tabel utamanya
tetap sama persis dengan bentuk form fisik. Gambar ditempel dua per baris; PDF
tidak bisa dirender di halaman cetak sehingga hanya didaftar namanya. Pada
cetakan isu, bukti saat kejadian dan bukti saat selesai dipisah dengan judul
masing-masing.

## 4. Memindahkan data lama dari spreadsheet

1. Buka spreadsheet lama. Untuk **tiap tab**, pilih
   `File > Download > Comma Separated Values (.csv)`.
2. Taruh hasilnya di folder `import/` dengan nama:
   - `import/Logbook_Entries.csv`
   - `import/DailyCheck_Records.csv`
   - `import/Issues.csv`
3. Jalankan:

```bash
npm run import
```

Aman dijalankan berulang: baris yang sudah masuk akan dilewati, bukan diduplikasi.

Gambar tanda tangan di spreadsheet berupa tautan Google Drive. Skrip mencoba
mengunduhnya ke `uploads/` supaya aplikasi lepas sepenuhnya dari Drive. Kalau
server tidak punya akses internet, tautannya disimpan apa adanya — datanya tidak
hilang, tapi gambar TTD lama hanya tampil selama berkasnya masih ada di Drive.
Kalau ingin gambar itu ikut pindah, jalankan `npm run import` dari komputer yang
punya internet, lalu salin `data/` dan `uploads/` ke server.

## 5. Menjalankan di server kantor

Agar bisa dibuka dari komputer lain, server harus dijalankan di mesin yang
menyala terus. Secara bawaan aplikasi mendengarkan di semua antarmuka jaringan,
jadi dari komputer lain cukup buka:

```
http://<alamat-IP-server>:3000
```

Cari alamat IP server dengan `ipconfig`.

**Firewall Windows** perlu diberi izin sekali (jalankan sebagai Administrator):

```bash
netsh advfirewall firewall add rule name="E-Logbook 3000" dir=in action=allow protocol=TCP localport=3000
```

### Supaya jalan otomatis saat server dinyalakan

Cara paling sederhana lewat **Task Scheduler**:

1. Buka Task Scheduler > Create Task.
2. Tab General: centang **Run whether user is logged on or not**.
3. Tab Triggers: New > Begin the task: **At startup**.
4. Tab Actions: New > Program/script: `jalankan.cmd`, dan
   Start in: folder ini (`...\E-LogBook-Server`).
5. Tab Settings: centang **If the task fails, restart every 1 minute**.

### Pengaturan opsional

Diatur lewat environment variable:

| Variable | Arti | Bawaan |
|---|---|---|
| `PORT` | port HTTP | `3000` |
| `HOST` | alamat bind | `0.0.0.0` (semua antarmuka) |
| `ELOGBOOK_SESSION_DAYS` | umur sesi login | `30` hari |
| `ELOGBOOK_SECURE_COOKIE` | set `1` kalau diakses lewat HTTPS | kosong |
| `PGPOOL_MAX` | jumlah koneksi Postgres sekaligus | `4` di serverless, `5` di server kantor |
| `ELOGBOOK_CACHE_NAMA_MS` | umur simpanan peta nama pengguna | `15000` (15 detik) |

## 5b. Kalau dijalankan di Vercel

Di server kantor database ada di mesin yang sama, jadi tiap kueri praktis tanpa
biaya. Di Vercel tidak: databasenya di Supabase, dan **satu kueri berarti satu
perjalanan pulang-pergi lewat internet**. Yang menentukan lamanya memuat layar
bukan berat kuerinya, melainkan berapa kali perjalanan itu dilakukan dan sejauh
apa jaraknya.

**Region harus sama.** Database Supabase proyek ini ada di Singapura
(`aws-0-ap-southeast-1`). Kalau fungsi Vercel dibiarkan di region bawaan
(`iad1`, Washington DC), tiap kueri menyeberang setengah dunia — sekitar 230 ms
sekali jalan, dan sekali memuat layar butuh belasan kueri. Karena itu
`vercel.json` mengunci `"regions": ["sin1"]`. **Kalau databasenya dipindah,
baris itu harus ikut diganti.**

**Halaman depan tidak lewat fungsi.** Berkas di `public/` sudah disajikan CDN,
tetapi alamat `/` tanpa nama berkas dulu jatuh ke aturan tangkap-semua dan
dilayani fungsi — artinya orang yang baru membuka aplikasi menunggu fungsi
dinyalakan dulu hanya untuk menerima `index.html`. Karena itu ada satu aturan
tersendiri untuk `/` di atas aturan tangkap-semua; urutannya berpengaruh.

Sambungannya juga memakai **transaction pooler** Supabase (port `6543`), bukan
sambungan langsung ke port `5432`. Di serverless wadahnya datang dan pergi terus,
dan sambungan langsung sebanyak itu akan menghabiskan jatah koneksi database.

Databasenya disiapkan sekali di luar aplikasi (`npm run migrasi`). Berbeda dari
server kantor, permintaan HTTP di Vercel **tidak** membuat akun admin awal kalau
databasenya kosong — jangan menunggu itu terjadi.

## 6. Backup

**Ini tanggung jawab sendiri sekarang** — tidak ada lagi Google yang menyimpankan
salinan otomatis.

```bash
npm run backup
```

Hasilnya di `backup/YYYY-MM-DD_HHmm/`. Aman dijalankan selagi server hidup.
Backup lebih tua dari 30 hari dihapus otomatis.

Jadwalkan lewat Task Scheduler (harian, misalnya pukul 01:00), dan **salin
hasilnya ke media lain** — share folder unit atau hard disk terpisah. Backup yang
tersimpan di mesin yang sama tidak menolong kalau mesinnya rusak.

Untuk mengembalikan: hentikan server, salin `elogbook.db` dan folder `uploads`
dari folder backup ke `data/` dan `uploads/`, lalu jalankan lagi.

## 7. Nanti kalau pakai domain sendiri

Selama masih di jaringan kantor, alamat IP sudah cukup. Kalau nanti ingin nama
domain dan HTTPS:

1. Minta ke pengelola jaringan agar nama (misalnya `elogbook.jatsc.local`)
   diarahkan ke IP server ini.
2. Pasang reverse proxy di depan aplikasi — **Caddy** paling ringkas karena
   sertifikatnya diurus otomatis. Isi `Caddyfile`:

   ```
   elogbook.jatsc.local {
       reverse_proxy localhost:3000
   }
   ```

3. Setelah HTTPS aktif, jalankan aplikasi dengan `ELOGBOOK_SECURE_COOKIE=1`
   supaya cookie sesi hanya dikirim lewat koneksi terenkripsi.

Untuk domain publik (bisa diakses dari luar kantor), aturan keamanan internal
AirNav soal data operasional perlu dicek dulu ke bagian IT — itu keputusan
kebijakan, bukan teknis.

## 8. Struktur berkas

```
server.js              API (umum + khusus admin), login, penyajian halaman
db.js                  skema SQLite, query, penyimpanan tanda tangan & lampiran
db-pg.js               versi Postgres/Supabase dari db.js, dipakai di Vercel
public/index.html      kerangka halaman: markup tiap tab, tanpa gaya & kode
public/css/            gaya tampilan, dipecah 10 berkas menurut bagian layar
public/js/             kode aplikasi, dipecah 26 berkas menurut tab dan fungsinya
PETA-BERKAS.md         daftar isi kedua folder di atas — mulai baca dari sini
tools/user.js          kelola akun lewat command line (cadangan)
tools/import-sheet.js  impor data lama dari CSV spreadsheet
tools/backup.js        backup database + tanda tangan
data/elogbook.db       DATABASE — ini yang wajib dibackup
uploads/               tanda tangan + lampiran scan/foto — ini juga wajib dibackup
```

Folder `data/` dan `uploads/` dibuat otomatis saat pertama dijalankan.

Berkas di `public/css/` dan `public/js/` bernomor, dan **nomornya adalah urutan
muat** — sama persis dengan urutan aslinya waktu semuanya masih menumpuk di
dalam `index.html`. Menukar urutan `<link>` atau `<script>` di `index.html` bisa
mengubah tampilan (aturan CSS yang belakangan menimpa yang duluan) atau membuat
kode gagal jalan. Menambah berkas baru: taruh nomor berikutnya, lalu daftarkan
di `index.html`.
