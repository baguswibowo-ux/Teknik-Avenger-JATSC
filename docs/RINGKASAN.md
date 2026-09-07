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
- **Umur trouble sampai menit** (6 Sep 2026 sore) — "32 hr 10 jam 5 mnt" di
  tabel, "32 hari 10 jam 5 menit" di pita beranda, dihitung dari Tgl & Jam
  Report isu (UTC) dan ditulis ulang tiap menit tanpa menggambar ulang tabel
  (`segarkanUmurTrouble` di `08-bantu.js`). Urutan, warna batang, dan ubin
  "Lewat 14 Hari" ikut memakai menit. Lihat Bagian 13.

## 7. Fitur per tab — E-Logbook

Urutan muat `elogbook/public/js/`: tema, bahasa, waktu (jam server sebagai
satu-satunya acuan), toast/tab, jembatan server (`gsRun`), keadaan bersama,
unit, tanda tangan, peran, lampiran, **Logbook Fasilitas** (`11-`), **Daily
Check per unit** (`12`–`14`, lihat Bagian 8), **Isu** (`15-`; tombol ⚠ di kartu
dan detail catatan logbook membuka form isu yang sudah terisi dari catatan itu —
jenis, keterangan, lokasi, tanggal-jam, plus lampirannya disalin sebagai bukti
saat kejadian; menutup isu tetap manual), **Monitoring
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
- `17h-meter-radkom.js` *(baru, belum tercatat git)* — Preventive Maintenance
  unit Radkom dari "METER READING.xlsx": Mingguan & Bulanan (bertingkat: Radio
  710 / 720 / MER / TER), Radio R&S TX, Radio R&S RX, Battery, TX VHF, Antena
  VHF. Format `mrradkom`, menumpang `dstest`; frekuensi/merk/awalan IP terisi
  dari sheet tapi bisa ditimpa teknisi. Sub-tab `rk-*` hanya untuk unit radkom.

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
  `12g-daily-check-listrik.js`, `17g-maint-listrik.js`, `17h-meter-radkom.js`,
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

## 13. Sesi 6 September 2026 (sore) — Buat Isu dari logbook & umur trouble

Dua permintaan, keduanya selesai di sisi peramban saja — **tidak ada
perubahan server, skema, maupun API**, jadi tidak perlu restart `npm start`
dan tidak menyentuh `db.js`/`db-pg.js`. Belum di-commit, belum ke Vercel.

### 13a. E-Logbook: "Buat Isu" dari catatan Logbook Fasilitas

Masalahnya: gangguan hampir selalu sudah ditulis di logbook, lalu diketik
ulang di form Isu. Sekarang catatannya tinggal diteruskan.

**Di mana tombolnya**

- Tombol ⚠ di setiap kartu catatan (sebelah ✎ Sunting), dan tombol
  "⚠ Buat Isu" di jendela Detail Catatan. Keduanya berkelas `hanya-tulis`,
  jadi pejabat (yang memang tidak boleh menulis isu) tidak melihatnya.

**Apa yang terisi otomatis** (`openIssueDariLogbook` di `15-isu.js`)

| Kolom isu | Sumber |
|---|---|
| Jenis Issue | baris pertama uraian yang berisi, dipotong di batas kata bila > 90 huruf (`jenisDariUraian`) |
| Keterangan | uraian lengkap + baris "Sumber: Logbook Fasilitas \<tanggal\> \<jam mulai–selesai\> UTC · Dinas · Lokasi · Frek" + "Teknisi Pelaksana: A, B" (`keteranganDariLogbook`) |
| Lokasi | lokasi catatan |
| Tanggal & Jam Report | tanggal dan jam mulai catatan |
| Dilaporkan Oleh | tetap akun yang login (tidak berubah) |
| Foto/Dokumen Saat Kejadian | seluruh lampiran catatan, maksimal 6 |

Sebelum mengisi, layar pindah ke tab Isu, lalu `openIssueModal()` dipanggil
seperti biasa — jadi seluruh bawaan form yang lama tetap berlaku, baru
ditimpa isi catatan. Catatan kecil di atas form (`#isDariLogbook`)
menyebutkan catatan asalnya dan mengingatkan bahwa isinya masih bisa
disunting. **Menutup isu tetap manual** seperti sebelumnya.

**Lampiran disalin, bukan dirujuk** (`salinLampiranLogbookKeIsu`)

Tiap lampiran diambil ulang dari `/uploads/...` (di balik login, sesi yang
sama), diubah ke data-URL, dan dimasukkan ke kotak `isLampiranOpen` seolah
dipilih dari pemilih berkas — lalu dikirim lewat `addIssue` yang sudah ada.
Akibatnya:

- jalurnya sama di SQLite (folder `uploads/`) maupun Postgres (Supabase
  Storage), tanpa API baru;
- menghapus lampiran di satu sisi tidak mematikan sisi lainnya (masing-masing
  punya berkasnya sendiri);
- gambar tidak dikecilkan lagi — yang tersimpan sudah dikecilkan saat diunggah.

Selama pengambilan, tombol Simpan dikunci dan hint kotak lampiran menghitung
"(n/total)". Kalau jendela ditutup atau berganti catatan di tengah jalan,
pengambilan berhenti sendiri (`isuSumberLogbook` dicocokkan tiap langkah).
Berkas yang gagal diambil dihitung dan disebut di hint supaya dilampirkan
ulang secara manual.

**Berkas yang disentuh**

- `elogbook/public/index.html` — tombol di footer Detail Catatan, catatan
  info di modal Tambah Isu.
- `elogbook/public/js/11-logbook.js` — tombol ⚠ di kartu, pengait tombol detail.
- `elogbook/public/js/15-isu.js` — `openIssueDariLogbook`, `jenisDariUraian`,
  `keteranganDariLogbook`, `salinLampiranLogbookKeIsu`; `openIssueModal` dan
  `closeIssueModal` ikut melepas kaitan ke catatan.
- `elogbook/public/js/02-bahasa.js` — 9 kunci baru di **ketiga** kamus
  (id/en/es): `buatIsuBtn`, `buatIsuDariCatatan`, `isuDariLogbookKet`,
  `isuDariLogbookSunting`, `sumberLogbook`, `takBolehBuatIsu`,
  `mengambilLampiranLogbook`, `lampiranDariLogbook`, `lampiranLogbookGagal`.
- `elogbook/PETA-BERKAS.md` — baris `15-isu.js` diperbarui.

### 13b. Dashboard Avenger: umur trouble sampai jam dan menit

Sebelumnya kolom Umur hanya "32 hr", dihitung dari tanggal ke tanggal
(`umurHari`, berbasis `HARI_INI` tengah malam lokal). Sekarang:

- `13-unitdb-server.js` — baris `TROUBLE` membawa `waktu`: Tgl Report
  lengkap ("YYYY-MM-DDTHH:MM", UTC) bila ada jamnya; kalau hanya tanggal,
  jatuh ke `DibuatPada` (stempel server, ber-"Z"); kalau itu pun kosong,
  tengah malam UTC tanggalnya.
- `08-bantu.js` — pembantu baru: `waktuMs` (membaca teks tanpa zona sebagai
  UTC, bukan waktu lokal peramban), `umurMenit`, `umurTeks(iso, pendek)`
  → "32 hari 10 jam 5 menit" / "32 hr 10 jam 5 mnt" (nol di depan tidak
  ditulis, menit selalu ada), `waktuRingkas` → "5 Agu 2026 · 09:37 UTC",
  dan `segarkanUmurTrouble()` yang menulis ulang setiap elemen
  `[data-umur]` dari jam sekarang.
- `18-ubin-tabel.js` — tabel Daftar Trouble dan pita beranda memakai
  `umurTeks`; warna, panjang batang, urutan, dan ubin "Lewat 14 Hari"
  memakai menit; `setInterval(segarkanUmurTrouble, 60000)` supaya halaman
  yang dibiarkan terbuka tetap benar menitnya tanpa menyentak animasi pita.
- `28-database-unit.js` — urutan trouble per unit ikut per menit.

`umurHari` dan `HARI_INI` tetap ada (dipakai tempat lain), tidak dihapus.

### 13c. Verifikasi yang dilakukan & yang belum

- Sintaks semua berkas JS yang diubah lolos (`new Function(...)`).
- Fungsi murni diuji dengan node: judul/keterangan otomatis, dan pemformatan
  umur untuk 32 hr 10 jam 5 mnt, 3 jam 12 menit, 7 menit, tanggal tanpa jam,
  dan stempel ber-Z.
- Server lokal (E-Logbook 3000, dashboard 3100) sudah menyajikan kode baru
  dari disk; halaman `/logbook/` memuat tanpa galat JavaScript.
- **Belum**: uji klik penuh dengan akun login (butuh sandi — tidak dilakukan
  Claude). Uji sendiri: buka catatan yang punya lampiran → ⚠ → periksa isi
  form → Simpan; lalu lihat kolom Umur di beranda. Aset di-cache (E-Logbook
  1 jam, dashboard 5 menit) — **Ctrl+F5** kalau masih tampil versi lama.

### 13d. Jebakan yang ditemukan hari ini (sudah dicatat di memori Claude)

- **Akhir baris tidak seragam**: `elogbook/public/index.html`, `db.js`,
  `db-pg.js`, `02-bahasa.js` ber-CRLF; `15-isu.js`, `docs/RINGKASAN.md`,
  dan seluruh `public/js/` dashboard ber-LF. Skrip tambal harus mendeteksi
  per berkas; `git checkout --` menulis ulang berkas menjadi CRLF (autocrlf),
  dan `grep -c $'\r'` di Git Bash tidak bisa dipercaya.
- Skrip node panjang jangan lewat heredoc/`node -e` di Bash (backslash
  `\r\n` hilang) — tulis berkasnya, lalu `node skrip.js`.

### 13e. Langkah berikutnya

1. Uji klik seperti 13c, lalu `git add -A` (kecuali `Claude outputs/`) dan
   commit satu pesan, mis. "Buat Isu dari catatan logbook + umur trouble
   sampai menit".
2. `npx vercel --prod` — tidak ada rute baru, jadi `vercel.json` tidak perlu
   disentuh (rewrite `/logbook/*` dan `/uploads/*` yang ada sudah cukup).
3. Kalau kelak ingin isu **tahu** catatan asalnya secara terstruktur (bukan
   hanya baris "Sumber:" di keterangan), perlu kolom `entry_id` di tabel
   `issues` — dua berkas db, satu perubahan (Bagian 4).

## 14. Sesi 6 September 2026 (malam) — pindah ke PC sendiri, tahap kode

Keputusan: kedua aplikasi pindah dari Vercel ke PC sendiri di rumah, diekspos
lewat Cloudflare Tunnel di domain `avengers-teknik.com` (dibeli 7 Sep 2026).
Vercel tetap hidup sampai server sendiri stabil beberapa hari.

**Data sudah ditarik** dengan `tools/tarik-supabase.js`: 15 tabel E-Logbook
→ `elogbook/data/elogbook.db`, 13 dokumen avenger_state → `data/*.json`,
830 berkas Storage → `elogbook/uploads/` + `public/foto/`. Supabase tidak
diubah; skrip aman diulang. Kredensialnya: `DATABASE_URL` di `elogbook/.env`
(masih valid sejak Agustus) dan `SUPABASE_SERVICE_KEY` di `.env` akar.

**Alamat klien di balik proxy** (`PROXY_TEPERCAYA`, dibaca dashboard dan
E-Logbook): dashboard membuang `X-Forwarded-*` yang datang dari luar dan
mengisinya ulang dari `req.ip`-nya sendiri (`kepalaJejakProxy` di
`server.js`), E-Logbook mempercayai loopback saat dijalankan sendiri. Tanpa
ini semua pengunjung lewat tunnel tampak dari 127.0.0.1 dan penahan login
8 gagal/5 menit jadi jatah bersama. Diuji: 9 gagal dari satu XFF → 429,
XFF lain → 401.

**Cadangan harian** `tools/cadangkan.js`: `VACUUM INTO` untuk SQLite (aman
saat server menulis), `data/` disalin per hari, `uploads/` dan `public/foto/`
dicerminkan (yang sama dilewati, yang terhapus di sumber tidak ikut dihapus).
Folder harian lebih tua dari `CADANGAN_SIMPAN_HARI` (14) dibuang. Sudah
diarahkan ke `E:\2026\Cadangkan` lewat `CADANGAN_DIR` di `.env`: di luar
folder proyek supaya tidak ikut hilang saat folder itu dihapus atau di-clone
ulang, tapi sebelah folder aplikasi supaya semua urusan 2026 terkumpul di
satu tempat. Sedrive dengan aplikasi, jadi ia tidak menolong kalau disk E mati;
yang menutup itu salinan manual ke komputer lain.

**Jadwal Windows** `tools/pasang-jadwal.cmd` (jalankan sebagai administrator):
tiga tugas Task Scheduler — `Avenger\Server` saat boot (`tools/server.cmd`,
log ke `server.log`), `Avenger\Server (jaga)` tiap 10 menit menyalakan ulang
kalau port dashboard kosong (`tools/jaga-server.cmd`), `Avenger\Cadangan
harian` pukul 02.00. Dipilih Task Scheduler, bukan NSSM, karena tidak perlu
mengunduh apa pun. `pasang-jadwal.cmd lepas` menghapus ketiganya.

**Belum:** `ELOGBOOK_SECURE_COOKIE=1` baru dinyalakan begitu diakses lewat
HTTPS; Cloudflare Tunnel (Quick Tunnel dulu untuk bukti, lalu tunnel
bernama) menunggu domain; Telegram di server sendiri pakai `TELEGRAM_POLLING=1`
atau webhook ke domain baru; matikan Vercel setelah stabil.

**Ketiga tugas terbukti jalan (7 Sep 2026 pagi) DI LAPTOP.** Mesin yang dipakai
selama sesi 6-7 Sep adalah laptop tempat ngoprek, bukan PC rumah yang akan jadi
server; pemasangan jadwal, penarikan data Supabase, dan isi `.env` harus
diulang di PC saat migrasi sungguhan. Ketiga tugas dibuat lewat
`tools/pasang-jadwal.cmd` dari Command Prompt administrator. `Avenger\Server`
dijalankan tangan dengan `schtasks /Run` dan servernya hidup sebagai SYSTEM —
`server.log` mencatat penyalaannya, port 3000 dan 3100 mendengarkan, `/_info`
menjawab 200. Dua bug ditemukan dan diperbaiki saat menguji: `VACUUM INTO`
menolak menimpa, jadi cadangan yang jalan dua kali dalam menit yang sama gagal
(sekarang salinan lama untuk stempel yang sama dibuang lebih dulu); dan jalur
`node` di definisi tugas kini ditulis lengkap, supaya pemasangan di komputer
lain tidak bergantung pada isi PATH milik SYSTEM. Di komputer ini nodejs
memang sudah ada di PATH mesin, jadi yang kedua bersifat pengerasan, bukan
perbaikan atas kegagalan yang sungguh terjadi.
Tugas cadangan juga diuji dengan `schtasks /Run`: ia menulis ke
`E:\2026\Cadangkan` sebagai `NT AUTHORITY\SYSTEM` dan salinannya lolos
`integrity_check`, jadi jadwal 02.00 tidak menunggu bukti lagi.
