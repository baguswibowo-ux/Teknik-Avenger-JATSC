# Ringkasan — Dashboard Fasilitas Teknik JATSC ("Avenger") + E-Logbook

Ditulis ulang dari pembacaan langsung repositori (bukan dari ingatan
percakapan) pada 6 September 2026 · branch `feature/avengers-login-visual` ·
165 berkas terlacak git, dengan sejumlah perubahan belum di-commit.

Berkas ini menggantikan versi lama (status 16 Agustus 2026, 4 commit) yang
masih menggambarkan Avenger dan E-Logbook sebagai dua deploy Vercel terpisah
yang berbicara lewat jaringan. Keadaan sekarang sudah jauh berbeda — lihat
Bagian 1 dan 2.

---

## 1. Apa ini

Dua aplikasi, satu repositori, dan sejak akhir Agustus **satu deploy**:

- **Dashboard Avenger** (root: `server.js`, `public/`) — satu layar yang
  menyatukan kondisi peralatan, jadwal dinas, kegiatan berkala, personel, dan
  ringkasan trouble dari delapan unit teknik.
- **E-Logbook** (`elogbook/` — salinan `E-LogBook-Server`) — pencatatan
  operasional harian per unit: logbook fasilitas, daily check, isu, LTK, dan
  seterusnya. Tetap app Express-nya sendiri (halaman di `/`, API di `/api`),
  tidak dipindah alamatnya.

Sejak commit "Satu deploy: dispatch E-Logbook in-process" (lihat Bagian 2),
E-Logbook disajikan dashboard lewat `/logbook/` — **satu asal, satu cookie,
satu sesi**. Peran dan unit yang berlaku di dashboard adalah yang berlaku juga
di dalam E-Logbook. Membuka alamat E-Logbook langsung (bukan lewat
`/logbook/`) memantulkan halaman kembali ke `/logbook/`; hanya halaman yang
dipantulkan, `/api/` dan aset tetap lewat apa adanya.

Repo publik: <https://github.com/baguswibowo-ux/Teknik-Avenger-JATSC>.

## 2. Menjalankan & deploy

**Di komputer sendiri:**

```
npm install
npm start        # = node jalankan-semua.js → E-Logbook :3000 + Dashboard :3100
```

`jalankan-semua.js` menyalakan dua proses (bukan satu app yang memuat
keduanya, karena E-Logbook menyajikan halamannya sendiri di `/` dan itu akan
bentrok dengan akar dashboard), mengikat anak ke induk (Ctrl+C sekali
mematikan keduanya), membersihkan proses zombie yang masih memegang port
lama di Windows, dan punya mode `--watch` untuk auto-restart saat menyunting
kode server. Buka `http://localhost:3100`, atau klik dua kali `jalankan.cmd`
di Windows.

**Di Vercel — satu fungsi, bukan dua proyek.** Sampai pertengahan Agustus ada
dua proyek Vercel dari repo ini (`teknik-avenger-jatsc` dan
`e-log-book-server`, saling meneruskan HTTP lintas domain — sumber seluruh
kerumitan cookie lintas-subdomain). Sekarang `api/index.js` mengimpor
`elogbook/server.js` sebagai app Express biasa, lalu **mencegat `fetch()`**
ke satu alamat internal (`http://elog.internal`) dan menjalankannya sebagai
**pemanggilan fungsi langsung** — `req`/`res` buatan sendiri, tanpa socket
tanpa jaringan — mengembalikan `Response` standar persis seperti `fetch()`
asli.

Tiga transport bersocket sudah dicoba dan gagal di Vercel sebelum bentuk ini
dipakai, dicatat di kepala `api/index.js` dan `DEPLOY.md` Bagian 9 supaya
tidak diulang:

1. **Loopback TCP** (`listen(0,'127.0.0.1')`) — `fetch()` ke alamat sendiri
   dari dalam fungsi yang sama tidak pernah tersambung; menggantung 30 detik
   lalu 500.
2. **Socket domain Unix** (`listen('/tmp/*.sock')`) — sama persis. Kesimpulan:
   runtime Vercel melarang fungsi menyambung ke socket yang didengarnya
   sendiri, TCP maupun Unix.
3. **`light-my-request`** (alat baku Fastify untuk mock request) — ~seperempat
   permintaan 500: response palsunya melempar galat tak tertangkap kalau ada
   yang menulis ke sana setelah ia usai, dan Express memang kadang menulis
   lagi lewat `finalhandler`/`on-finished` sesudah respons selesai.

`req`/`res` buatan sendiri kebal soal itu — `write()`/`end()` setelah selesai
jadi no-op aman, bukan galat — dan karena murni pemanggilan fungsi,
perilakunya sama persis di komputer dan di Vercel.

**Jebakan yang wajib diingat kalau mengutak-atik dispatch ini:**

- **Content-Length wajib dipasang manual** di `req` mock. Tanpa fetch yang
  memasangnya otomatis, body-parser E-Logbook menganggap permintaan tak
  berbadan (`hasbody()` → false) dan `req.body` kosong — gejalanya persis
  "login berhasil di versi lama, gagal di gabungan".
- **IP asli harus dibawa ke dispatch** lewat `x-forwarded-for`/`x-real-ip` dan
  dipasang ke `soket.remoteAddress`. Tanpa ini seluruh pemakai Avenger tampak
  sebagai satu IP (`127.0.0.1`) bagi penahan tebak-password E-Logbook (8 gagal
  per 5 menit) — delapan kesalahan siapa pun mengunci **semua** orang.
- `vercel.json` → `functions["api/index.js"].includeFiles:
  "elogbook/public/**"`, karena Vercel menelusuri `import`, bukan berkas yang
  disajikan `express.static`.

**Environment variable produksi** (disalin dari proyek `e-log-book-server`
lama ke proyek Avenger): `ELOGBOOK_DB=postgres`, `DATABASE_URL` (pooler
Supabase, port 6543 — bukan koneksi langsung), `SUPABASE_URL`,
`SUPABASE_SERVICE_KEY`, `ELOGBOOK_BUCKET`, `ELOGBOOK_SECURE_COOKIE=1`. Untuk
sisi Avenger sendiri: `AVENGER_DB=postgres` menyalakan jalur tabel (tanpa ini,
`data/*.json` dipakai — benar untuk server kantor, tapi di Vercel berkas
baca-saja dan `data/` diabaikan `.gitignore`, jadi tanpa `AVENGER_DB=postgres`
aplikasi menjawab 200 dengan isi **kosong** tanpa pesan salah). `/_info`
menyebutkan simpanan mana yang sedang dipakai ("tabel" atau "berkas").

## 3. Struktur berkas

```
server.js                Express Avenger: statis + penerusan /api/* + jadwal
                          dinas, berkala, personel, dokumen, cetak, dll.
jalankan-semua.js         menyalakan E-Logbook + dashboard dalam satu perintah
api/index.js              pintu masuk Vercel — dispatch in-process (Bagian 2)
vercel.json               rewrite /api,/logbook,/personel,/dinas,/berkala, dll
package.json              express 5, pg 8, node 24.x
data/                     (di luar git — data pegawai, repo ini publik)
  dinas.json, hak.json, hak-akun.json, berkala.json, personel.json,
  peralatan.json, sparepart.json, aktivitas.json, sejarah.json,
  cetak-antrian.json, dokumen/, personel-berkas/, ttd-akun/
public/
  index.html              seluruh dashboard, satu berkas
  css/01…09-*.css          9 berkas, nomor = urutan muat
  js/01…37-*.js            37 berkas, nomor = urutan muat (lihat Bagian 6)
  vendor/                  three.js, font (Space Grotesk/IBM Plex), OCR Tesseract 5
elogbook/                 salinan E-LogBook-Server — kodenya ikut git, datanya tidak
  server.js, db.js (SQLite), db-pg.js (Postgres), api/index.js, vercel.json
  public/index.html, public/css/01…10-*.css, public/js/01…29(+huruf)-*.js
docs/                     RINGKASAN.md (berkas ini), CATATAN.md, rencana/
DEPLOY.md                 kronologi deploy per bagian, tiap bagian bertanggal
README.md                 dokumentasi fitur Avenger, per tab
```

Konvensi yang wajib dipahami sebelum menyunting apa pun:

- **Berkas `js/`/`css` bernomor menentukan urutan muat**, dan urutan itu
  berarti: aturan CSS belakangan menimpa yang duluan, dan kode yang bergantung
  pada kode lain harus dimuat sesudahnya. Menukar urutan `<link>`/`<script>`
  di `index.html` bisa merusak tampilan atau membuat kode gagal jalan diam-diam.
- **Bukan ES module** — baik di Avenger maupun E-Logbook. Fungsi yang dipanggil
  dari `onclick="..."` di HTML harus tetap global; jangan menambahkan
  `export`/`import` di berkas `js/`.
- **Kode dan komentar berbahasa Indonesia** di seluruh basis kode, termasuk
  nama variabel dan fungsi (`teruskan`, `dispatchElog`, `bersihkanPortLama`).
  Teks yang tampil di layar butuh pasangan Indonesia **dan** Inggris —
  `T('...','...')` di Avenger, kunci kamus di `js/02-bahasa.js` untuk
  E-Logbook.

## 4. Data

**Avenger:** bawaannya berkas JSON di `data/*.json` (di luar git). Dengan
`AVENGER_DB=postgres` + `DATABASE_URL`, jalur tabel Supabase dipakai —
`GALERI_MATI=1` mematikan unggah/hapus galeri secara sengaja, dan galeri juga
mati sendiri kalau simpanannya memang tak bisa ditulis.

**E-Logbook:** dua berkas basis data yang **wajib berubah bersama** —
`elogbook/db.js` (SQLite, dipakai di server kantor) dan `elogbook/db-pg.js`
(Postgres, dipakai di Vercel/Supabase). Tabelnya: `users`, `sessions`,
`entries`, `dailychecks`, `issues`, `lampiran`, `lampiran_isu`, `monitoring`,
`ltk`, `lampiran_ltk`, `bapb`, `dstest`, `berkala`, `user_unit`,
`telegram_akun`. Aturan dari `docs/rencana/2026-08-17-tujuh-permintaan.md`
yang masih berlaku: apa pun yang menyentuh skema E-Logbook dikerjakan di
**kedua** berkas — salah satu tertinggal berarti Vercel dan server kantor
menyimpan bentuk yang berbeda. `elogbook/elogbook_schema.sql` tidak dipakai
saat runtime (0 byte, tertinggal dari versi lama).

**Hak bawaan disalin, bukan diambil dari satu sumber.** `HAK_BAWAAN` di
`server.js` dan `hakBawaan()` di `public/index.html` sengaja dua salinan
supaya data contoh tetap jalan tanpa server sama sekali — keduanya harus
diubah bersama. Begitu juga bentuk kunci periode: `periodeSekarang()` di
`server.js` dan `periodeKini()` di `public/index.html` harus merangkai kunci
yang sama persis, atau tanda "selesai" pada kegiatan berkala tidak pernah
ketemu pasangannya.

## 5. Unit & peran

**Delapan unit** didefinisikan di `elogbook/db.js`/`db-pg.js` (`export const
UNIT`), masing-masing dengan lima kemampuan yang bisa menyala independen:

| Kode | Nama | Daily Check | Monitoring | DS Test | Berkala | LTK |
|---|---|:---:|:---:|:---:|:---:|:---:|
| `radtel` | Radtel (VCS Garex, Neptuno) | ✓ | – | ✓ | ✓ | ✓ |
| `radkom` | Radkom (VHF/HF A/G) | ✓ | ✓ | – | – | ✓ |
| `ppabn` | Pendaratan Presisi & Nav (ILS, DVOR/DME, NDB) | ✓ | – | – | – | ✓ |
| `pengamatan` | Pengamatan (Radar) | ✓ | – | – | – | ✓ |
| `amhsadps` | AMHS-ADPS (AMHS, AADPS, D-ATIS) | ✓ | – | – | – | ✓ |
| `fdpsrdps` | FDPS-RDPS | – | – | – | – | ✓ |
| `listrikmekanik` | Listrik & Mekanik | ✓ | – | – | – | ✓ |
| `gedungkeamanan` | Gedung & Keamanan | ✓ | – | – | – | ✓ |

Unit tanpa Daily Check (`fdpsrdps`) menunggu bentuk
formulirnya — yang tersedia baru Logbook Fasilitas, Isu, dan LTK yang memang
berlaku umum. Setiap unit juga membawa bentuk barisnya sendiri: daftar dinas
(`Pagi/Siang/Malam/PS` vs `P/S/PS/M` di Radkom), apakah pakai kolom frekuensi
(`pakaiFrek`, hanya Radkom), label penanggung jawab, dan judul Daily Check.

**Peran E-Logbook** — tiga peran tegas (dari `elogbook/README.md`):

| | Administrator | Pejabat | Teknisi |
|---|:---:|:---:|:---:|
| Lihat seluruh unit | ✓ | ✓ | hanya unitnya |
| Tambah catatan/daily check/isu | ✓ | – | ✓ |
| Bubuhkan TTD susulan | ✓ | ✓ | – |
| Ubah/hapus catatan, kelola akun | ✓ | – | – |

`SEMUA_UNIT = ['admin', 'pejabat', ...PIC_ROLE]` — peran ini melihat seluruh
unit tanpa baris `user_unit`.

**Peran Avenger** — matriks per modul di tab **Kelola Akun** / `data/hak.json`:
Administrator, Pejabat, Admin Unit, Teknisi, plus kolom **Ditunjuk** untuk
memberi hak ke satu orang di luar perannya. Bawaan per modul: Jadwal Dinas
sampai Admin Unit, Kegiatan Berkala & Sparepart & Dokumen & Galeri sampai
Teknisi, Data Personel sampai Teknisi (unitnya sendiri), **Daftar Peralatan
hanya Administrator** (baris lain — trouble, sejarah, dokumen — menunjuk
`id`-nya, jadi ganti nama sembarangan menggeser layar orang lain). Administrator
selalu boleh di semua modul dan itu tidak bisa dimatikan dari layar ini.

## 6. Fitur per tab — Dashboard Avenger

Urutan memuat `public/js/` (nomor = urutan `<script>`, lihat Bagian 3):
unit & dinas, kode dinas, galeri, ilustrasi, panggung 3D layar masuk, kartu
masuk, bahasa, layar masuk, sesi, **jembatan E-Logbook** (`12-`), database
unit server (`13-`), kelola akun (`14-`), tautan E-Logbook, jam navigasi,
cincin peralatan, ubin tabel, **jadwal dinas** (`19-21-`, + impor Excel),
**kegiatan berkala** (`23-`), **personel** (`24-`, + OCR papan nama untuk
lisensi), **log aktivitas** (`25-`), **Kotak Masuk** (`27-`), **database
unit** (`28-29-`), papan nama & gambar kartu (`30-31-`), **dokumen unit**
(`32-`), mulai (`33-`), **sejarah alat** (`34-`), **impor sparepart** (`35-`,
+ OCR label + impor Excel), **cetak** (`36-`), ISR (`37-`).

Sorotan yang paling banyak berubah belakangan:

- **Kotak Masuk** — seluruh kejadian kegiatan berkala periode berjalan,
  dikelompokkan per tanggal, tujuannya dibaca dari **jadwal dinas pada
  tanggal kejadian** (bukan jadwal hari ini). Tidak menyimpan apa pun sendiri
  — murni turunan dari kegiatan berkala + jadwal dinas + catatan selesai.
- **Personel & lisensi** — satu daftar per unit, peringatan menyala 2 bulan
  sebelum lisensi habis (`SERT_AWAS`), muncul di beranda dan lonceng akun
  pemiliknya. Nomor lisensi disamarkan untuk yang belum login.
- **OCR papan nama** (Tesseract 5, `public/vendor/ocr/`, ~10 MB, dimuat saat
  dipakai — bukan saat halaman dibuka, nol permintaan internet) — membaca
  merk/tipe/serial/part number/tahun dari foto papan nama peralatan atau
  label sparepart, mengisi kolom dengan bingkai biru sebagai penanda "hasil
  baca, perlu diperiksa", tidak menimpa yang sudah diketik manual.
- **Impor sparepart dari Excel/CSV/PDF/tempelan** — deteksi baris kepala di
  20 baris pertama, pemetaan kolom otomatis (bisa dikoreksi manual), part
  number sebagai kunci baris, bawaannya tambah+perbarui (opsi ganti-seluruh
  untuk yang berhak hapus), batas 300 baris per unit.
- **Cetak — dua jalur**: langsung, atau lewat **antrian persetujuan**
  (`cetak-antrian`: ajukan → setujui/teruskan/tolak) untuk dokumen yang perlu
  tanda tangan berjenjang.

## 7. Fitur per tab — E-Logbook

Urutan muat `elogbook/public/js/`: tema, bahasa, waktu (jam server sebagai
satu-satunya acuan), toast/tab, jembatan server (`gsRun`), keadaan bersama,
unit, tanda tangan, peran, lampiran, **Logbook Fasilitas** (`11-`), **Daily
Check per unit** (`12`–`14`, lihat Bagian 8), **Isu** (`15-`), **Monitoring
Frekuensi** (`16-`, khusus Radkom), **DS Test** (`17-`, + tegangan
standby/pakai), varian preventive (`17c`–`17f`, baru), **LTK** (`18-`, +
BAPB `18b-`), **Kegiatan Berkala** (`19-`), **TTD susulan pejabat** (`20-`) —
pejabat membubuhkan tanda tangan pada petak kosong di lima formulir (Logbook,
Daily Check, Monitoring, DS Test, LTK) tanpa menghapus dan mengetik ulang
catatan teknisi — **cetak** (`21`–`24-`), **login/sesi** (`25`–`26-`), **TTD
tersimpan** (`27-`, digambar sekali lalu dipakai ulang di papan mana pun),
**Telegram** (`28-`, baru/belum tercatat git), **Rekap & Matrik** (`29-`) —
kejadian yang sudah pernah dialami, jenis × periode dan pelaksana × jenis,
dengan catatan di balik tiap sel dan cetaknya.

## 8. Daily Check & Preventive Maintenance — per unit

| Unit | Berkas | Judul (`dcJudul`) |
|---|---|---|
| Radtel | `12-daily-check-radtel.js` | Daily Check VCS Garex 300 |
| Radtel/JATSC | `12b-daily-check-radtel-jatsc.js` | (lembar tambahan Radtel) |
| PPABN/Navigasi | `12c-daily-check-navigasi.js` | ILS 4 runway + DVOR/DME 2 site |
| AMHS-ADPS | `12d-daily-check-amhs.js` | AMHS · AADPS · D-ATIS |
| Pengamatan | `12e-daily-check-pengamatan.js` | Radar CKG 3 · Fasilitas Pengamatan (sub-tab) |
| Gedung & Keamanan | `12f-daily-check-fgk.js` *(baru)* | Toilet & Mushalla · lift/CCTV/akses (sub-tab) |
| Listrik & Mekanik | `12g-daily-check-listrik.js` *(baru)* | STS · MDS · Beban Listrik · UPS (sub-tab) |
| Radkom | `13-daily-check-radkom.js` | Daily Check Unit Radkom — New JATSC |
| — | `14-daily-check-umum.js` | daftar teknisi, pemilihan bentuk per unit, riwayat |
| Cetak | `24-cetak-daily-check.js` | cetak semua bentuk di atas |

Unit dengan lebih dari satu lembar (Pengamatan, Gedung & Keamanan, Listrik &
Mekanik) memakai
**pola sub-tab pemilih lembar** di dalam satu tab Daily Check.

**Preventive Maintenance** — checklist terpisah dari Daily Check harian,
ditambahkan lewat commit-commit terbaru dan sebagian belum ter-commit:

- `17c-radio.js` *(baru)* — Maintenance Radio, sampling 7 sesi.
- `17d-weekly-pengamatan.js` *(baru)* — Weekly Check Pengamatan.
- `17e-llz-navigasi.js` *(baru)* — Ground Check LLZ (Navigasi).
- `17f-meter-reading.js` *(baru, belum tercatat git)*.
- `17g-maint-listrik.js` *(baru, belum tercatat git)* — tujuh lembar
  pemeliharaan Listrik & Mekanik: Panel Distribusi, STS, UPS (dengan tabel
  tambahan tegangan sel baterai), Chiller, AHU, Genset, Grounding & Petir.
  Satu sub-tab per kegiatan supaya jadwal berkalanya berdiri sendiri-sendiri.
  Lembarnya bisa DISUNTING lewat tombol ✎ selama belum di-TTD Manager
  Teknik — jalurnya `updateDsTest` yang baru (db.js + db-pg.js + server.js),
  dan berlaku untuk seluruh form yang menumpang tabel `dstest`.

## 8b. Daftar cek setiap menambah form / modal baru di E-Logbook

Tiap butir pernah menimbulkan bug nyata (6 September 2026); jalankan sebelum
menyatakan form baru selesai — di PC mana pun, karena catatan ini ikut repo.

1. Daftarkan id `<select>` akun TTD ke `AKUN_TTD_SELECT_ID` di
   `js/20-ttd-pejabat.js`. Kalau terlewat, pilihannya cuma "Otomatis" dan nama
   officer tidak muncul.
2. Kamus bahasa di `js/02-bahasa.js` ada **tiga**: `id`, `en`, `es` — setiap
   kunci baru harus ada di ketiganya (Bagian 9 di bawah menyebut dua; yang
   berlaku tiga).
3. Setiap `<input>/<textarea>/<select>` diwarnai sendiri
   (`background:var(--panel-2); border:1px solid var(--line); color:var(--text)`).
   Bawaan peramban putih dan terlihat bercak di tema gelap.
4. Halaman cetak jangan membawa kelas tabel layar (berlatar gelap) — pakai
   `.p-kepala` + gaya inline. Orientasi ikut `<pageSetup>` Excel aslinya.
5. Form yang menumpang tabel `dstest` didaftarkan di empat tempat:
   `isKhusus`/`kategori` di `insertDsTest` (db.js + db-pg.js), `DS_PENUMPANG`
   di `js/17-ds-test.js`, `subtabDstest` dan `segarkanSemuaDaftarDstest` di
   `js/20-ttd-pejabat.js`.
6. `index.html`, `db.js`, `db-pg.js`, `02-bahasa.js` ber-CRLF — anchor untuk
   patch otomatis harus memakai `
`.
7. Perubahan `db.js` / `db-pg.js` / `server.js` butuh restart `npm start`;
   aset JS di-cache peramban 1 jam (`max-age=3600`).

## 9. Ketentuan kerja yang berlaku di seluruh proyek

Dari `docs/rencana/2026-08-17-tujuh-permintaan.md` ("Ketentuan yang berlaku
di seluruh tugas") — masih relevan untuk pekerjaan berikutnya:

- **Tidak ada kerangka tes.** Kedua `package.json` tanpa skrip `test`, tanpa
  `tests/`. Verifikasi memakai `node --check` (sintaks), `curl` ke server
  yang sedang jalan (API), dan pemeriksaan manual di peramban (tampilan).
  Jangan memasang kerangka tes baru tanpa diminta.
- **Skema E-Logbook: dua berkas db, satu perubahan** (Bagian 4).
- **Bentuk kunci periode dan hak bawaan: dua tempat, harus sinkron** (Bagian 4).
- **`js/` E-Logbook bukan ES module** — jangan tambah `export`/`import`.
- **Setiap teks baru butuh dua bahasa** — Indonesia dan Inggris.
- **Commit per tugas**, pesan berbahasa Indonesia mengikuti gaya riwayat yang
  sudah ada.

## 10. Status repositori saat ini

- Branch aktif: **`feature/avengers-login-visual`** (bukan `utama`) — belum
  dipastikan sudah/belum digabung.
- **Banyak perubahan belum di-commit**: `server.js`, `elogbook/server.js`,
  `elogbook/db.js`/`db-pg.js`, sejumlah `public/js`/`css` di kedua aplikasi,
  plus berkas baru yang belum `git add` (`12f-daily-check-fgk.js`,
  `12g-daily-check-listrik.js`, `17g-maint-listrik.js`,
  `17f-meter-reading.js`, `28-telegram.js`, `telegram.js`,
  dua logo ATSEP baru).
- 20 commit terakhir seluruhnya soal: checklist preventive per unit (LLZ,
  Weekly Pengamatan, Maintenance Radio), perbaikan dispatch in-process
  (Content-Length, IP asli untuk throttle, buang `light-my-request`, ganti
  socket Unix → req/res buatan), dan retry query Postgres basi.
- `docs/RINGKASAN.md` (lama) berstatus 16 Agustus; `docs/CATATAN.md`
  berstatus 20 Agustus dan sudah menggambarkan penggabungan login di
  `/logbook/` — keduanya lebih baru dari RINGKASAN lama tapi lebih usang dari
  keadaan kode sekarang (branch fitur ini berjalan di atas keduanya).

## 11. Catatan yang masih terbuka (dari DEPLOY.md & CATATAN.md)

- **Production Branch di Vercel belum diarahkan ke `utama`** di kedua
  proyek (perlu lewat Settings → Git, tidak bisa via CLI) — selama belum,
  push hanya menghasilkan preview.
- **Alamat lama `e-log-book-server.vercel.app` masih hidup**, sudah tidak
  boleh diedarkan.
- **`avenger-teknik.com` belum dipasang**; apex domainnya masih terdaftar di
  proyek E-Logbook lama, perlu dirapikan dulu.
- **Lampiran E-Logbook masih kena batas unggah 4,5 MB** — pola dari jalur
  dokumen Avenger tinggal ditiru.
- **Simpanan kantor dan Supabase masih berpisah** — jalankan
  `node tools/naikkan.js --gas --timpa` sebelum orang beralih penuh ke tabel.
- **Foto Radtel di `public/foto/radtel/` sengaja tidak ikut git** (repo
  publik, foto memuat wajah pegawai di ruang terbatas) — hasil clone datang
  dengan galeri kosong.

## 12. Menambah unit/lembar Daily Check baru — titik yang harus disentuh

Berdasarkan pola `12d`/`12e`/`12f` yang sudah ada:

1. Tambahkan entri unit di `UNIT` — **dua tempat**: `elogbook/db.js` dan
   `elogbook/db-pg.js` — dengan flag `adaDailyCheck`, `dcJudul`, dan flag
   kemampuan lain (Bagian 5).
2. Buat `js/12x-daily-check-<unit>.js` baru, daftarkan `<script>`-nya di
   `elogbook/public/index.html` **sebelum** `25-login.js` (urutan muat,
   Bagian 3).
3. Markup formulirnya di `elogbook/public/index.html`, ikuti pola
   `<!-- ===== TAB: ... ===== -->`.
4. Kalau unit itu butuh lebih dari satu lembar, pakai pola sub-tab pemilih
   lembar (seperti Pengamatan / Gedung & Keamanan) di dalam satu tab.
5. Tambahkan kolomnya ke `elogbook/db.js` **dan** `db-pg.js` kalau ada medan
   baru (mis. tegangan standby/pakai di DS Test).
6. Daftarkan label dua bahasa di `js/02-bahasa.js`.
7. Sambungkan cetaknya di `24-cetak-daily-check.js`.
8. Kalau unit ini juga perlu tampil di Daftar Peralatan/Sparepart Avenger,
   pastikan `data/peralatan.json`/`sparepart.json` sudah punya baris berkunci
   kode unit yang sama.
