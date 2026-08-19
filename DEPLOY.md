# Runtutan Deploy — Vercel + Supabase

Sasaran: menaikkan E-Logbook versi terakhir ke Vercel dengan database Supabase
yang **sudah ada**, tanpa satu baris pun data lama berubah.

**Diperbarui 19 Agu 2026.** Bagian 0–4 sudah dikerjakan dan terbukti: E-Logbook
hidup di Vercel dengan kode terbaru, data lama tidak bergerak.

Keputusan 18 Agu "Avenger tetap di kantor" **dibatalkan 19 Agu 2026**. Avenger
ikut naik ke Vercel; runtutannya di Bagian 8. Bagian 5 dan 6 ditinggal apa adanya
sebagai catatan sejarah — jangan dikerjakan tanpa membaca Bagian 8 lebih dulu.

Dokumen ini memakai penanda `<ref>`, `<url>`, dan `<kunci>` — jangan pernah
tulis nilai aslinya di sini. Repositori ini publik.

---

## Bagian 0 — Bukti bahwa database lama tidak akan tersentuh

Diperiksa langsung ke Supabase sebelum dokumen ini ditulis:

| Yang diperiksa | Hasil | Artinya |
|---|---|---|
| Tabel `berkala` | belum ada | `CREATE TABLE` jalan sekali, murni menambah |
| Kolom `periode` di mana pun | tidak ada | penjaga `DROP TABLE` tidak akan pernah menyala |
| 18 kolom `KOLOM_SUSULAN` | lengkap semua | **nol** `ALTER TABLE` |
| Bucket storage `elogbook` | ada, privat | tidak perlu dibuat |

Jadi seluruh perubahan skema saat cold start pertama = **satu `CREATE TABLE
berkala` + satu `CREATE INDEX`**. Tidak ada DROP, tidak ada ALTER, tidak ada
UPDATE ke tabel lama.

### 0.1 Catat sidik jari data lama

Jalankan di Supabase → SQL Editor **sebelum** deploy, simpan hasilnya:

```sql
SELECT 'users' t, count(*) n FROM users
UNION ALL SELECT 'entries',     count(*) FROM entries
UNION ALL SELECT 'dailychecks', count(*) FROM dailychecks
UNION ALL SELECT 'monitoring',  count(*) FROM monitoring
UNION ALL SELECT 'dstest',      count(*) FROM dstest
UNION ALL SELECT 'ltk',         count(*) FROM ltk
UNION ALL SELECT 'issues',      count(*) FROM issues
UNION ALL SELECT 'lampiran',    count(*) FROM lampiran
UNION ALL SELECT 'user_unit',   count(*) FROM user_unit
ORDER BY 1;
```

Angka pada 19 Agu 2026: users 24, entries **146**, dailychecks 25, monitoring 1,
dstest 1, ltk 1, issues 3, lampiran 24, user_unit 20.

> Sampai 19 Agu 2026 di sini tertulis `entries 141`, dan angka itu sudah usang
> saat ditulis. Kalau 141 dipakai apa adanya untuk membandingkan sesudah deploy,
> langkah 4.3 akan tampak seperti kerusakan padahal bukan. Kesembilan angka di
> atas dihitung ulang **sesudah** migrasi 19 Agu dan tidak satu pun bergerak.

### 0.2 Backup

**Proyek ini Free plan — menu Database → Backups tidak tersedia.** Yang bisa
dilakukan hanya cadangan manual: `SELECT *` dari tiap tabel, simpan sebagai JSON.
Dikerjakan 19 Agu 2026 untuk 12 tabel (±481 KB), murni baca.

Tiga hal yang menyertainya, dan semuanya penting:

- Isinya sensitif — hash kata sandi di `users`, token sesi aktif di `sessions`.
  **Jangan pernah masuk repositori ini**, yang publik.
- Cadangan itu snapshot **data saja**: tanpa definisi skema, tanpa sequence,
  tanpa berkas di Storage.
- Ia ditaruh di folder sementara. Salin ke tempat yang Anda pegang sendiri kalau
  masih ingin memakainya.

---

## Bagian 1 — Buat tabel `berkala` sendiri lebih dulu — **SELESAI 19 Agu 2026**

Aplikasi bisa membuatnya sendiri saat cold start. Tapi lebih baik Anda yang
membuat, supaya perubahan skema jadi tindakan yang ditinjau — bukan efek samping
deploy. Setelah tabelnya ada, `CREATE TABLE IF NOT EXISTS` di kode berubah jadi
tidak melakukan apa-apa.

Supabase → SQL Editor:

```sql
CREATE TABLE IF NOT EXISTS berkala (
  id                TEXT PRIMARY KEY,
  unit              TEXT NOT NULL DEFAULT 'radtel',
  jenis             TEXT NOT NULL DEFAULT 'neptuno',
  tanggal           TEXT NOT NULL DEFAULT '',
  state_json        TEXT NOT NULL DEFAULT '{}',
  catatan           TEXT NOT NULL DEFAULT '',
  teknisi_nama      TEXT NOT NULL DEFAULT '',
  teknisi_nama_list TEXT NOT NULL DEFAULT '[]',
  teknisi_ttd       TEXT NOT NULL DEFAULT '',
  manager_nama      TEXT NOT NULL DEFAULT '',
  manager_ttd       TEXT NOT NULL DEFAULT '',
  ttd_oleh          TEXT NOT NULL DEFAULT '',
  ttd_pada          TEXT NOT NULL DEFAULT '',
  ttd_untuk         TEXT NOT NULL DEFAULT '',
  dibuat_pada       TEXT NOT NULL,
  dibuat_oleh       TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_berkala_unit ON berkala(unit, jenis, tanggal);
```

Bentuk ini harus sepadan dengan `TABEL_SUSULAN` di `elogbook/db-pg.js`. Kalau
salah satu diubah, yang lain wajib ikut. Diperiksa kolom demi kolom 19 Agu 2026:
cocok. Yang jadi: 16 kolom, `berkala_pkey` + `idx_berkala_unit`, 0 baris.

### 1.1 Tabel `avenger_state` — **SELESAI 19 Agu 2026**

Ini langkah A dari Bagian 8, dikerjakan berbarengan supaya perubahan skema cukup
sekali tinjau.

```sql
CREATE TABLE IF NOT EXISTS avenger_state (
  kunci       TEXT PRIMARY KEY,
  isi         TEXT NOT NULL DEFAULT '{}',
  diubah_pada TEXT NOT NULL DEFAULT '',
  diubah_oleh TEXT NOT NULL DEFAULT ''
);
```

Kenapa satu tabel kunci–nilai dan bukan tabel per modul: kode Avenger memang
membaca dan menulis dokumen JSON **utuh** lewat `bacaJson`/`tulisJson`. Memecahnya
per modul berarti menulis ulang 34 pemanggil demi ±20 KB data. Alasannya di
Bagian 8.

---

## Bagian 2 — Commit dan push — **SELESAI**, commit `0395edd`

Vercel membaca dari git, bukan dari folder di komputer Anda. Selama belum
di-push, yang naik adalah kode lama.

Dua berkas baru **wajib** ikut, kalau tidak deploy-nya rusak:

- `elogbook/berkala-item.js`
- `elogbook/public/js/19-berkala.js`

```bash
git add -A && git status
```

Periksa daftarnya, lalu:

```bash
git commit -m "Empat lembar berkala, tautan dashboard, dan penyaring per unit"
```

```bash
git push origin utama
```

> `data/` dan `.env` sudah diabaikan `.gitignore` — biarkan begitu. Repositori
> ini publik: jangan pernah memasukkan `DATABASE_URL` atau service key ke dalamnya.

---

## Bagian 3 — Deploy E-Logbook — **SELESAI 19 Agu 2026**

E-Logbook punya `vercel.json` dan `api/index.js` sendiri di dalam `elogbook/`,
jadi ia jadi **proyek Vercel tersendiri**.

> **Yang benar-benar terjadi:** proyek `e-log-book-server` sudah ada sebelumnya,
> jadi ia di-**upgrade**, bukan dibuat baru. Alamatnya tetap sama. Yang ternyata
> perlu dibetulkan, dan tidak akan ketahuan tanpa diperiksa: proyek itu tidak
> pernah tertaut ke repositori ini. Buktinya `/js/19-berkala.js` menjawab 404
> sementara `/js/29-rekap.js` menjawab 200 — yang dilayani ke pemakai adalah kode
> **sebelum** commit `0395edd`. Tautan git diarahkan ke repositori ini dan Root
> Directory diisi `elogbook`. Baca 3.1 sebelum mengulang langkah ini.

1. Vercel → **Add New… → Project** → impor repositori ini.
2. **Root Directory: `elogbook`** ← wajib. Repositori ini berisi dua aplikasi;
   tanpa ini yang naik adalah Avenger, yang justru tidak ingin dinaikkan.
3. Framework Preset: **Other**. Build Command dikosongkan.
4. Isi Environment Variables (Production **dan** Preview):

| Nama | Nilai | Wajib |
|---|---|---|
| `ELOGBOOK_DB` | `postgres` | **ya** |
| `DATABASE_URL` | URI pooler Supabase | **ya** |
| `SUPABASE_URL` | `https://<ref>.supabase.co` | ya, untuk unggahan berkas |
| `SUPABASE_SERVICE_KEY` | service_role key | ya, untuk unggahan berkas |
| `ELOGBOOK_BUCKET` | `elogbook` | tidak (ini bawaannya) |
| `ELOGBOOK_SECURE_COOKIE` | lihat 5.1 dan 8.1 | **belum beres**, lihat 3.2 |
| `AVENGER_TAUTAN` | alamat Avenger di Vercel | **ya**, kalau tidak tombol pulang mati |
| `PGSSLMODE` | `require` | dianjurkan |
| `PGPOOL_MAX` | `1` | dianjurkan |

**`ELOGBOOK_DB=postgres` adalah yang paling menentukan.** Tanpa itu server
jatuh ke SQLite — database kosong yang lahir dan mati bersama tiap wadah Vercel.
Data lama Anda tetap utuh di Supabase, tapi aplikasinya tidak akan melihatnya
dan tampak seolah semua hilang.

`DATABASE_URL` diambil dari Supabase → tombol **Connect** → **Transaction
pooler** (port 6543), bukan koneksi langsung port 5432. Vercel menyalakan banyak
wadah kecil; koneksi langsung akan kehabisan jatah.

5. **Deploy.**

### 3.1 Root Directory adalah setelan yang paling menentukan

Dan ia **tidak ikut berubah sendiri** ketika tautan repositori diganti. Kalau
dibiarkan kosong, Vercel membangun akar repositori — yaitu Avenger, dengan
`vercel.json`-nya sendiri yang mengarahkan `/dinas/*`, `/personel`, dan `/hak` ke
`api/index` milik Avenger. Alamat produksi akan terbuka normal tapi menyajikan
aplikasi yang keliru. Jadi sesudah mengganti tautan repositori, periksa lagi
Root Directory sebelum apa pun.

Dua hal lain dari 19 Agu 2026:

- **Branch Tracking belum dibetulkan ke `utama`.** Selama belum, tiap push lahir
  sebagai Preview dan harus dipromosikan manual. Promote sendiri aman: kelima
  environment variable bertanda "Production and Preview", jadi preview memakai
  `DATABASE_URL` yang sama.
- URL deployment seperti `…-kr5ba7g6v-….vercel.app` menjawab **302 ke
  `vercel.com/sso-api`**. Itu Vercel Authentication — pagar login bawaan untuk URL
  deployment, **bukan** build yang gagal. Sempat disangka error. Uji lewat alamat
  produksi, bukan lewat URL deployment.

### 3.2 `ELOGBOOK_SECURE_COOKIE` masih terpasang — belum beres

Nilainya tidak terlihat karena bertanda Sensitive. Kode membacanya `=== '1'`
(`elogbook/server.js:101`), jadi hanya nilai persis `1` yang berbahaya.

Selama Avenger masih di kantor lewat `http://`, nilai `1` akan membuat login
**gagal diam-diam** — terkirim, tanpa pesan salah, tanpa sesi. Hapus variabelnya
atau timpa dengan `0`, lalu redeploy.

Begitu Avenger ikut di Vercel dan keduanya `https://`, arahnya berbalik:
`ELOGBOOK_SECURE_COOKIE=1` justru jadi yang benar, dan wajib dipasang di **kedua**
proyek bersamaan. Lihat 8.1.

---

## Bagian 4 — Pastikan data lama utuh — **SELESAI 19 Agu 2026**

Kerjakan sebelum mengarahkan Avenger di kantor ke alamat baru (Bagian 5).

1. Vercel → Deployments → Runtime Logs. Cold start pertama harus bersih. Kalau
   ada `[db-pg] gagal…`, berhenti dan baca pesannya — jangan lanjut.
2. Buka `https://<elogbook>.vercel.app`, masuk dengan akun lama Anda. Login
   berhasil = tabel `users` terbaca apa adanya.
3. Jalankan lagi kueri sidik jari Bagian 0.1. Kesembilan angkanya harus **sama
   persis**. `sessions` boleh bertambah — itu memang login baru Anda.
4. Buka Logbook, DS Test, Daily Check. Isian lama harus muncul.
5. Baru uji yang baru: empat tab berkala, `#bk-neptuno:radtel`, dan tombol
   "Atur kegiatan".

Kalau langkah 3 menunjukkan angka yang berubah, hentikan dan pulihkan dari
cadangan Bagian 0.2.

### 4.1 Yang terbukti 19 Agu 2026

| Yang diuji | Hasil |
|---|---|
| `/js/19-berkala.js` di produksi | 200, isinya kode baru |
| Empat tab berkala | CEK QUERY NEPTUNO, RESTART CPU GATEVOX, CLEANING CWP, RESTART CWP |
| Bagian "Pekerjaan Berkala" | muncul |
| Judul halaman | tetap "E-Logbook — New JATSC", bukan Avenger |
| Sidik jari Supabase sesudah migrasi | tidak bergerak |
| Bentuk `berkala` vs `TABEL_SUSULAN` | cocok kolom demi kolom |

Sempat dilaporkan bahwa produksi masih menyajikan kode lama. Itu benar saat
diperiksa, dan sudah terlewat oleh keadaan begitu tautan repositori dan Root
Directory dibetulkan.

---

## Bagian 5 — Avenger tetap di kantor — **DIBATALKAN 19 Agu 2026**

> Bagian ini ditinggal sebagai catatan sejarah. Yang berlaku sekarang adalah
> Bagian 8. Isi `.env` di bawah tetap benar selama Avenger **belum** naik, jadi
> ia masih berguna sebagai keadaan sementara — tapi 5.1 sudah berbalik arah.

**Diputuskan 18 Agu 2026: Avenger tidak ikut naik ke Vercel.** Sebabnya ada di
Bagian 6. Yang naik hanya E-Logbook; Avenger tetap berjalan di server kantor
seperti sekarang, dan tinggal diarahkan ke alamat Vercel.

Sunting `.env` di server kantor:

```
ELOGBOOK_ASAL=https://<elogbook>.vercel.app
ELOGBOOK_TAUTAN=https://<elogbook>.vercel.app
```

`ELOGBOOK_ASAL` dipakai server Avenger untuk meneruskan `/api/*`.
`ELOGBOOK_TAUTAN` dipakai halaman untuk tombol "Buka E-Logbook".

**Keduanya wajib diisi, bukan salah satu.** Tanpa `ELOGBOOK_TAUTAN`, halaman
merangkai tautannya sendiri dari `portElogbook`, dan `new URL(ASAL).port` pada
alamat `https://` bernilai kosong sehingga jatuh ke `80` — tombolnya akan
menunjuk ke port yang salah. Dengan `ELOGBOOK_TAUTAN` terisi, angka port itu
tidak pernah dipakai (`public/js/15-tautan-elogbook.js:36`).

Lalu nyalakan ulang Avenger. Jangan pakai `npm start` di server kantor: itu
menyalakan E-Logbook lokal di port 3000 juga, yang sejak sekarang tidak dipakai
siapa pun. Jalankan `node server.js` saja.

### 5.1 Jangan pasang `ELOGBOOK_SECURE_COOKIE` — berlaku hanya selama Avenger di `http://`

Ini konsekuensi langsung dari keputusan di atas, dan satu-satunya hal yang bisa
mematahkan seluruh rangkaian ini tanpa pesan salah.

Peramban pemakai hanya bicara ke Avenger di kantor — alamatnya `http://`, bukan
`https://`. Penerus di `server.js:138` meneruskan `Set-Cookie` apa adanya. Kalau
cookie itu membawa flag `Secure`, peramban **membuangnya** karena halaman yang
menerimanya bukan https. Akibatnya: login tampak terkirim, tidak ada pesan
salah, tapi tidak ada sesi yang tersimpan dan setiap permintaan berikutnya
kembali anonim.

Jadi di Vercel, biarkan `ELOGBOOK_SECURE_COOKIE` **tidak diisi sama sekali**.
Tabel di Bagian 3 sudah disesuaikan.

Harganya jujur saja: cookie sesi lewat di dalam jaringan kantor tanpa terenkripsi.
Itu keadaan yang sama dengan sekarang, bukan kemunduran. Kalau suatu saat Avenger
di kantor sudah di balik https, barulah pasang `ELOGBOOK_SECURE_COOKIE=1` — dan
pasang keduanya bersamaan, jangan salah satu.

### 5.2 Penahan login di serverless

`gagalLogin` di `elogbook/server.js:162` adalah `Map` di memori, dan `req.ip`
dibaca tanpa `trust proxy`. Di Vercel tiap wadah punya `Map` sendiri, jadi
hitungan 8 percobaan gagal per 5 menit **melemah** — tersebar antar wadah, bukan
terkumpul. Ditambah semua permintaan lewat penerus Avenger terlihat sebagai satu
alamat, angka itu tidak lagi berarti "per orang".

Tidak menghalangi deploy, dan tidak berubah dari keadaan sekarang. Dicatat di
sini supaya tidak disangka penahan itu masih seketat namanya.

---

## Bagian 6 — Kenapa Avenger tidak ikut naik — **DIBATALKAN 19 Agu 2026**

> Halangan yang diuraikan di bawah nyata dan tidak dibantah. Yang berubah:
> halangan itu **dibereskan**, bukan dihindari — lihat Bagian 8. Alinea di bawah
> disimpan karena ia yang menjelaskan kenapa Bagian 8 berbentuk seperti itu.

**Modul milik Avenger sendiri tidak akan bisa menyimpan di Vercel.**

Jadwal dinas, kegiatan berkala, personel, hak, dokumen, galeri, dan logo
disimpan Avenger sebagai berkas di `data/` dan `public/foto/`. Dua hal
menghalanginya di Vercel:

1. `data/` ada di `.gitignore`, jadi tidak ikut naik — modul-modul itu mulai
   dari kosong.
2. Berkas sistem di Vercel hanya bisa dibaca. Tiap `writeFile` akan gagal, dan
   apa pun yang sempat ditulis ke `/tmp` hilang saat wadahnya berganti.

Yang lewat E-Logbook (Logbook, Daily Check, Monitoring, DS Test, LTK, isu,
lampiran, lembar berkala) **aman** — semuanya di Supabase.

Tiga pilihan pernah ditimbang:

- **Avenger tetap di kantor** ← dipilih 18 Agu, **dibatalkan 19 Agu.** Paling
  cepat, tidak ada yang perlu ditulis ulang, dan tidak ada satu pun modul yang
  berubah perilakunya.
- Naikkan juga penyimpanan Avenger ke Supabase — tujuh modul pindah dari
  `data/*.json` ke tabel. ← **yang dipilih 19 Agu.** Survei kodenya memperkecil
  pekerjaan ini jauh di bawah perkiraan; angkanya di Bagian 8.
- Avenger di cloud sebagai baca-saja. Ditolak: pemakai akan menyangka
  simpanannya berhasil, dan itu lebih buruk daripada tidak ada sama sekali.

Yang berubah bagi pemakai: **tidak ada.** Avenger tetap di alamat yang sama,
tetap bisa menyimpan, hanya sumber datanya yang sekarang di Vercel.

Yang perlu diingat: **Avenger sekarang bergantung pada internet kantor.** Kalau
sambungan keluar putus, penerus di `server.js:111` gagal dan kartu masuk
mengatakan servernya tidak terjawab. Dulu ia jatuh ke data contoh dan
`DATA_CONTOH=0` yang menahannya; data contohnya sudah dibuang seluruhnya, jadi
kerusakan itu sekarang selalu terlihat sebagai kerusakan.

---

## Bagian 7 — Kalau harus mundur

Kode: Vercel → Deployments → deployment E-Logbook lama → **Promote to Production**.
Avenger tidak perlu disentuh — ia tidak pernah naik. Untuk memutusnya dari
Vercel, kembalikan `ELOGBOOK_ASAL` di `.env` kantor ke `http://127.0.0.1:3000`
dan nyalakan lagi E-Logbook lokal.

Database: tabel `berkala` berdiri sendiri, tidak ada foreign key ke tabel mana
pun, jadi membuangnya tidak menyentuh data lama.

```sql
DROP TABLE IF EXISTS berkala;
```

Tabel lama tidak perlu dipulihkan — tidak ada langkah di atas yang mengubahnya.

---

## Bagian 8 — Avenger ikut naik ke Vercel

Diputuskan 19 Agu 2026, membatalkan Bagian 5 dan 6.

Survei kodenya memperkecil pekerjaan ini jauh di bawah perkiraan Bagian 6.
Empat angka yang menentukan:

- Seluruh penyimpanan JSON lewat **dua fungsi saja** — `bacaJson` (`server.js:348`)
  dan `tulisJson` (`server.js:356`) — dengan ±35 pemanggil yang semuanya cuma
  menyodorkan path. Menukar isi dua fungsi itu menukar semuanya sekaligus.
- **Dua belas dokumen**, total ±20 KB: `dinas`, `dinas-petugas`, `hak`,
  `aktivitas`, `berkala`, `berkala-selesai`, `personel`, `peralatan`,
  `sparepart`, `dokumen/daftar`, `unitdb`, `logo/daftar`.
- Penjaganya **sudah ada**: `GALERI` (`server.js:46`), `DINAS_TULIS`
  (`server.js:344`), `DOK_TULIS` (`server.js:1653`) — 14 titik yang tinggal
  dibalik, bukan ditambahkan.
- Unggahan biner cuma **tiga titik**: foto (`server.js:249`), logo
  (`server.js:1572`), dokumen (`server.js:1772`). E-Logbook sudah punya klien
  Storage yang terbukti di `elogbook/db-pg.js:234`.

### 8.1 Langkah

| | Langkah | Status |
|---|---|---|
| A | Tabel `avenger_state` di Supabase | **selesai** (lihat 1.1) |
| B | `bacaJson`/`tulisJson` menulis ke tabel, bukan berkas | **selesai** (lihat 8.3) |
| C | Bucket privat `avenger` untuk foto, logo, dokumen | **selesai** (lihat 8.4) |
| D | Balikkan `DINAS_TULIS`, `DOK_TULIS`, `GALERI` | **selesai** (lihat 8.5) |
| E | Naikkan JSON yang ada + isi `public/foto/` | **selesai** (lihat 8.6) |
| F | Buat proyek Vercel Avenger + `ELOGBOOK_SECURE_COOKIE=1` di **kedua** proyek | belum, lihat 3.2 dan 8.7 |

Jalur berkas **tetap dipertahankan berdampingan** — jaringan kantor tertutup, dan
Avenger harus tetap bisa jalan di sana tanpa Supabase.

### 8.2 Yang perlu diketahui sebelum mulai

**Modul `pg` sudah terpasang** — ditambahkan ke `package.json` oleh langkah B,
lalu `npm install` di komputer kantor berhasil 19 Agu 2026 (14 paket, `pg` 8.23.0,
0 kerentanan). Jadi kekhawatiran "jaringan kantor mungkin menolak npm install"
tidak terbukti, dan jalan mundur lewat `elogbook/node_modules/pg` tidak jadi
diperlukan.

Yang tetap berlaku: `simpanan.js` meng-import `pg` secara **dinamis**, hanya di
dalam cabang tabel. Jadi kalau suatu saat Avenger dipasang di mesin yang belum
`npm install`, jalur berkasnya tetap start dan jalan penuh.

**Foto pegawai.** `.gitignore` sengaja menahan `public/foto/` karena isinya wajah
pegawai di ruang terbatas. Langkah C memindahkannya ke bucket Supabase privat —
konsisten dengan niat itu, tapi tetap berarti foto-foto itu **tidak lagi hanya di
komputer kantor**. Putuskan itu sadar-sadar, jangan sebagai efek samping.

**Bagian 5.1 berbalik arah.** Begitu Avenger dan E-Logbook sama-sama di `https://`,
`ELOGBOOK_SECURE_COOKIE=1` jadi yang benar — dan wajib dipasang di kedua proyek
**bersamaan**. Memasang di satu proyek saja mematahkan login tanpa pesan salah.

### 8.3 Langkah B — sudah dikerjakan 19 Agu 2026

Isi `bacaJson`/`tulisJson` pindah ke berkas baru `simpanan.js`. Bentuk
panggilannya tidak berubah sedikit pun, jadi **tidak satu pun dari ±35 pemanggil
disunting** — di `server.js` yang berubah hanya satu baris import, dua fungsi
yang jadi komentar penunjuk, dan satu baris log saat start.

Yang menentukan jalurnya satu variabel baru:

| Nama | Nilai | Artinya |
|---|---|---|
| `AVENGER_DB` | `postgres` | simpanan modul Avenger masuk tabel `avenger_state` |
| `AVENGER_DB` | kosong | simpanan tetap `data/*.json` — ini yang berlaku di kantor |

Empat keputusan di dalamnya, semuanya sengaja:

- **Jalurnya dinyatakan, bukan disimpulkan.** Kalau `simpanan.js` menyimpulkan
  dari ada-tidaknya `DATABASE_URL`, satu variabel yang kebetulan terwarisi di
  server kantor akan diam-diam memindahkan seluruh simpanan ke Supabase.
- **`AVENGER_DB=postgres` tanpa `DATABASE_URL` menggagalkan start**, bukan
  diam-diam jatuh ke berkas. Di Vercel berkas bersifat baca-saja, jadi jatuh ke
  berkas berarti kegagalannya baru terlihat waktu orang menekan Simpan.
- **`pg` di-import dinamis**, di dalam cabang tabel saja. Server kantor tanpa
  `pg` tetap start dan tetap jalan penuh — lihat 8.2.
- **Kolam koneksi yang gagal dibuat tidak menempel.** Satu kegagalan jaringan
  saat cold start tidak boleh mematikan penyimpanan sampai wadahnya diganti.

Kuncinya jalur relatif terhadap akar aplikasi dengan garis miring depan —
`data/dinas.json`, `data/dokumen/daftar.json`, `public/foto/_logo/daftar.json` —
supaya Windows dan Linux menghasilkan kunci yang sama, bukan dua baris berbeda
untuk satu dokumen.

Yang sudah dibuktikan:

| Yang diuji | Hasil |
|---|---|
| Jalur berkas: `/berkala`, `/personel`, `/dinas/bulan/2026-08` | 200, isi lama apa adanya |
| Tulis lalu baca balik lewat `simpanan.js` | utuh, tanpa sisa `.tmp` |
| Kunci di Windows | `data/dinas.json`, bukan `data\dinas.json` |
| `AVENGER_DB=postgres` tanpa `DATABASE_URL` | gagal start dengan pesannya |
| Modul termuat saat `pg` belum ter-install | ya; gagal baru saat baca/tulis |
| `INSERT … ON CONFLICT` ke `avenger_state` sungguhan | menimpa, tidak menggandakan — 1 baris, bukan 2 |
| **Jalur tabel dari komputer kantor ke Supabase** | tersambung; kunci yang belum ada mengembalikan bawaannya, ±2,1 detik |

Uji `ON CONFLICT` dijalankan di dalam `BEGIN … ROLLBACK`, dan uji jalur tabel
murni baca. `avenger_state` diperiksa sesudah keduanya: tetap **0 baris**.

Uji jalur tabel itu memakai `DATABASE_URL` dari `elogbook/.env` di komputer
kantor, dan menyambung ke **transaction pooler port 6543** — bukan koneksi
langsung 5432, sesuai Bagian 3. Artinya satu hal yang selama ini cuma
diperkirakan sekarang terbukti: **jaringan kantor bisa menjangkau Supabase.**
Itu yang membuat langkah E nanti bisa dijalankan dari sini, bukan dari Vercel.

**Yang belum berubah perilakunya:** `DINAS_TULIS`, `DOK_TULIS`, dan `GALERI`
masih mematikan penulisan begitu `VERCEL` terpasang. Jadi langkah B baru
memasang pipanya — di Vercel belum ada yang bisa disimpan sampai langkah D
membalikkan ketiga penjaga itu. Itu memang urutan yang diinginkan: pipanya
terbukti dulu, penjaganya dibuka belakangan.

Galeri punya sepasang fungsi sendiri (`bacaDaftar`/`tulisDaftar` untuk
`public/foto/daftar.json`) yang sengaja **tidak** ikut dipindah. Memindahkan
indeksnya saja, sementara fotonya belum bisa ditulis, hanya melahirkan indeks
yang menyebut berkas yang tidak ada. Ia ikut di langkah C bersama fotonya.

### 8.4 Langkah C — bucket `avenger`, dikerjakan 19 Agu 2026

Bucket **`avenger`, privat**, berdiri di sebelah `elogbook` yang tidak tersentuh.
Nama objeknya sama persis dengan kunci dokumen — jalur relatif terhadap akar
aplikasi, misalnya `public/foto/radtel/<nama>.jpg` — jadi satu berkas punya satu
nama di kedua jalur, bukan dua nama yang harus dicocokkan.

Storage dipanggil lewat REST API-nya langsung, seperti yang sudah terbukti di
`elogbook/db-pg.js`. Tidak ada pustaka klien tambahan yang perlu dipasang, jadi
tidak ada yang perlu divendor.

Tujuh titik yang menyentuh berkas biner dipindahkan ke `tulisBiner`/`bacaBiner`/
`hapusBiner`: unggah dan hapus foto, unggah dan hapus logo (termasuk membuang
logo lama berekstensi berbeda), unggah dan hapus dokumen, dan menyajikan
dokumen. Dua `fs.rm(PETUGAS_JSON)` ikut jadi `hapusJson` — di jalur tabel
`fs.rm` tidak menghapus apa pun, dan berkas warisan yang tidak jadi terbuang
membuat nama yang baru dicabut muncul kembali pada pembacaan berikutnya.

Sesudah itu **`server.js` tidak lagi menyentuh berkas sama sekali** — `import fs`
dibuang. Seluruh penyimpanan sekarang lewat satu pintu.

#### Foto sekarang menuntut sesi, dan itu perubahan yang disengaja

Ini bagian yang paling mudah lolos tanpa terlihat, jadi ditulis terang-terangan.

Selama Avenger di kantor, `/foto/` terbuka tanpa masuk — dan itu tidak apa-apa,
karena yang bisa menjangkaunya cuma orang di dalam jaringan kantor. Begitu
Avenger pindah ke Vercel, **rute yang sama terbuka untuk seluruh internet.**
Bucket yang privat tidak menutup itu: privat cuma menghalangi jalan langsung ke
Supabase, sedangkan rute Avenger berdiri di depannya.

Karena isinya wajah pegawai di ruang terbatas, **di jalur tabel foto unit
menuntut sesi.** Logo unit tidak — ia memang lambang untuk dilihat, dan
menutupnya cuma merusak kop halaman bagi yang belum masuk.

**Di jalur berkas tidak ada yang berubah**: rutenya tidak dipasang sama sekali,
dan `express.static` menyajikan foto tanpa login persis seperti selama ini.

Sesi diperiksa **sebelum** daftar foto dibuka, dan urutan itu bukan kebetulan.
Kalau dibalik, yang terdaftar menjawab 401 sementara yang tidak menjawab 404 —
selisih dua angka itu sudah cukup untuk menebak-nebak nama berkas dari luar
sampai ketemu, dan nama foto di sini memuat kode unit serta tanggal.

#### Menambah rute Express saja tidak cukup di Vercel

Ini terlewat waktu langkah C ditulis, dan baru ketahuan di produksi: rute
`/foto/:unit/:berkas` sudah ada di `server.js`, tapi `vercel.json` **tidak punya
rewrite untuknya**. Akibatnya Vercel mencari `/foto/...` sebagai berkas statis di
`public/` — yang kosong, karena `public/foto/` diabaikan `.gitignore` — lalu
menjawab 404. Rutenya tidak pernah dipanggil sama sekali.

Di server kantor ini mustahil terlihat: di sana Express memegang **semua** jalur,
jadi rute apa pun langsung jalan. Di Vercel, daftar `rewrites` di `vercel.json`
adalah penjaga pintunya — apa pun yang tidak tercantum di situ tidak pernah
sampai ke aplikasi.

Jadi aturannya: **setiap kali menambah jalur baru yang dilayani `server.js`,
tambahkan juga sumbernya di `rewrites`.** Yang sekarang tercantum: `/api/*`,
`/uploads`, `/uploads/*`, `/galeri/*`, `/logo/*`, `/foto/*`, `/aktivitas`,
`/hak`, `/personel`, `/personel/*`, `/dinas/*`, `/berkala`, `/berkala/*`,
`/sejarah`, `/sejarah/*`, `/unitdb`, `/unitdb/*`, `/dokumen`, `/dokumen/*`,
`/_info`.

#### Yang sebenarnya terjadi pada galeri: berkas statis mengalahkan rewrite

Diperiksa langsung ke produksi 19 Agu 2026, dan hasilnya membatalkan dugaan di
bawah. `/foto/daftar.json` **tidak** dijawab 404. Ia dijawab **200**, dengan
kepala `X-Vercel-Cache: HIT`, `Accept-Ranges: bytes`, dan `Etag` — kepala
berkas statis, bukan jawaban Express. Isinya indeks galeri tertanggal 17 Agustus
dari komputer kantor.

Sebabnya: **`npx vercel` tidak membaca `.gitignore`.** Deploy dari komputer
kantor karena itu ikut mengunggah `public/foto/` — indeksnya dan fotonya — dan
menaruhnya di deployment sebagai berkas statis. Dan di Vercel **berkas statis
diperiksa lebih dulu daripada `rewrites`**, jadi rute mana pun yang jalurnya
bertabrakan dengan berkas di `public/` tidak akan pernah dipanggil.

Dua akibatnya, dan keduanya sudah berjalan diam-diam:

1. **Galeri produksi beku.** Yang dibaca layar salinan statis dari kantor.
   Unggahan baru berhasil betulan — 200, berkasnya mendarat di Storage,
   indeksnya diperbarui di tabel — tapi tidak ada satu pun yang membaca indeks
   itu. Yang dilaporkan pemakai: "berhasil, tapi fotonya tidak muncul", berulang
   kali, tanpa satu pun galat di mana pun.
2. **Pemeriksaan sesi pada foto terlewati.** `/foto/radtel/radtel-20260816-…jpg`
   menjawab `200 image/jpeg` 8,28 MB tanpa cookie apa pun, sementara nama
   karangan menjawab 401 dari aplikasi. Yang terlanjur terunggah disajikan
   Vercel langsung; rute yang menuntut sesi berdiri di belakangnya dan tidak
   pernah kebagian. Seluruh alasan di 8.4 — "foto unit menuntut sesi" — batal
   untuk berkas-berkas itu.

Dibereskan dua lapis, dan keduanya perlu:

- **`.vercelignore` di akar.** Menutup sebabnya: `public/foto/`, `data/`, dan
  `uploads/` tidak lagi ikut naik. Berkas ini tidak ada sebelumnya, dan
  ketiadaannya yang membuat CLI mengunggah semuanya.
- **Indeks galeri pindah ke `GET /galeri/daftar`.** Menutup kelasnya: di bawah
  `/galeri/` tidak ada dan tidak akan pernah ada berkas di `public/` yang bisa
  membayanginya, apa pun yang terlanjur terunggah nanti. Rute
  `/foto/daftar.json` yang sempat ditambahkan dicabut lagi — jalur itu memang
  tidak pernah bisa diandalkan.

**Foto yang terlanjur terbuka masih terbuka sampai ada deploy berikutnya.**
Menambah `.vercelignore` saja tidak mencabut berkas dari deployment yang sudah
berjalan; yang mencabutnya deployment baru yang tidak lagi memuatnya.

Aturan yang lahir dari sini, dan ia berlaku untuk seluruh proyek Vercel:
**jalur mana pun yang dilayani aplikasi tidak boleh punya berkas senama di
`public/`.** Rewrite bukan penjaga pintu terdepan — sistem berkas yang di depan.

#### Dugaan pertama yang keliru, disimpan supaya tidak diulang

Sebelum produksi diperiksa, sebabnya saya duga begini: `/foto/(.*)` memang ada
di rewrites, tapi `server.js` cuma punya `/foto/:unit/:berkas` (dua ruas),
sedangkan indeksnya diminta di `/foto/daftar.json` (satu ruas) — jadi ia lewat
sampai `express.static`, tidak menemukan apa pun karena `public/foto/`
diabaikan `.gitignore`, lalu 404.

Rangkaiannya masuk akal dan seluruhnya salah. Yang tidak saya periksa satu
anggapan yang terasa terlalu jelas untuk diperiksa: bahwa yang diabaikan
`.gitignore` tidak ada di deployment. Ia ada — CLI tidak membaca berkas itu.
Satu `curl` ke produksi menyelesaikannya dalam satu langkah, dan seharusnya
itu yang pertama dikerjakan, bukan pembacaan kode yang ketiga.

**Kalau gejalanya cuma muncul di produksi, tanya produksi.** Kepala jawabannya
menyebutkan sendiri siapa yang menjawab: `X-Vercel-Cache` dan `Etag` berarti
berkas statis, badan JSON berarti aplikasi, `NOT_FOUND` berarti tidak ada yang
mengaku.

### 8.5 Langkah D — tiga penjaga, dikerjakan 19 Agu 2026

Ketiganya berhenti bertanya "apakah ini Vercel" dan mulai bertanya "apakah ini
benar-benar bisa disimpan". Yang menjawab `simpanan.js`, karena ia yang tahu ke
mana simpanannya pergi.

| Penjaga | Dulu | Sekarang |
|---|---|---|
| `DINAS_TULIS` | `!process.env.VERCEL` | `BISA_TULIS_JSON` — jalur tabel selalu bisa |
| `DOK_TULIS` | `!process.env.VERCEL` | `BISA_TULIS_BINER` — perlu Storage |
| `GALERI` | `… && !process.env.VERCEL` | `… && BISA_TULIS_BINER` |

Jadwal dinas sengaja dipisah dari dua yang lain: ia cuma butuh dokumen JSON,
tidak butuh berkas biner, jadi ia bisa disimpan begitu jalur tabel menyala —
tanpa menunggu Storage. Menyatukan ketiganya di bawah satu penjaga akan
mematikan jadwal dinas hanya karena `SUPABASE_SERVICE_KEY` belum diisi.

`GALERI_MATI=1` tetap bisa mematikan galeri di komputer sendiri.

### 8.6 Langkah E — sembilan berkas naik, 19 Agu 2026

Alatnya `tools/naikkan.js`. **Kering dulu, selalu**: tanpa argumen ia cuma
menyebutkan apa yang akan naik dan berapa besarnya; baru dengan `--gas` ia
menulis. Ia tidak menghapus apa pun, dan tidak menimpa yang sudah ada kecuali
diminta `--timpa` — berkas asli di disk tetap di tempatnya, jadi kalau hasilnya
keliru yang perlu dibereskan cuma yang di Supabase.

```bash
node tools/naikkan.js
```

Yang naik: **7 dokumen JSON** (`aktivitas`, `berkala`, `dinas`, `dokumen/daftar`,
`peralatan`, `sparepart`, `public/foto/daftar`) dan **2 berkas biner** (satu PDF
1,4 MB, satu JPG 7,9 MB). Yang tidak ikut karena memang belum pernah ada:
`hak.json`, `personel.json`, `berkala-selesai.json`, `dinas-petugas.json`, dan
folder `_logo`.

Ukuran `peralatan.json` tercatat 8801 di tabel padahal 6522 di disk. Itu bukan
isi yang berubah, melainkan `JSON.stringify` yang merapikan indentasi. Dibuktikan
tersendiri: ketujuh dokumen **identik isinya** dibandingkan sebagai objek, dan
kedua berkas biner **identik byte demi byte**.

### 8.7 Langkah F — yang tersisa

Bagian 8 belum selesai. Yang belum:

1. **Buat proyek Vercel untuk Avenger** — Root Directory dikosongkan (akar repo),
   karena `vercel.json` dan `api/index.js` Avenger memang ada di situ. Baca 3.1:
   Root Directory adalah setelan yang paling menentukan.
2. Isi environment variable-nya:

| Nama | Nilai | Wajib |
|---|---|---|
| `AVENGER_DB` | `postgres` | **ya** — tanpa ini simpanan jatuh ke berkas baca-saja |
| `DATABASE_URL` | URI pooler Supabase, port 6543 | **ya** |
| `SUPABASE_URL` | `https://<ref>.supabase.co` | ya, untuk foto dan dokumen |
| `SUPABASE_SERVICE_KEY` | service_role key | ya, untuk foto dan dokumen |
| `AVENGER_BUCKET` | `avenger` | tidak (ini bawaannya) |
| `ELOGBOOK_ASAL` | alamat E-Logbook di Vercel | ya |
| `ELOGBOOK_TAUTAN` | alamat yang sama | ya — lihat Bagian 5 |

3. **`ELOGBOOK_SECURE_COOKIE=1` di kedua proyek, bersamaan.** Sampai langkah ini,
   yang berlaku tetap 3.2: hapus atau isi `0`.

### 8.8 Tiga peringatan build, dibereskan 19 Agu 2026

Build lolos, tapi log-nya menyalakan tiga baris kuning. Ketiganya soal
konfigurasi, bukan kode, dan pantas ditutup daripada dibiarkan jadi bising yang
lama-lama tidak dibaca lagi.

**1. `engines.node` berupa rentang.** `">=20.6.0"` berarti Vercel akan
memindahkan produksi ke Node major berikutnya begitu ia keluar — sendiri, tanpa
satu pun baris kode berubah, dan pertama kali ketahuannya lewat galat yang tidak
ada hubungannya dengan yang baru saja di-deploy. Sekarang dipatok `"24.x"`,
bentuk yang memang dianjurkan Vercel. Angkanya bukan asal: Node di komputer
pengembang v24.19.0, jadi patokan ini sekalian menyamakan produksi dengan tempat
kodenya diuji. Menaikkannya nanti disengaja — satu baris, sesudah dicoba lokal
lebih dulu.

**2 dan 3. `memory` di `vercel.json`.** Muncul dua kali karena disebut sekali
per keluaran fungsi. Pada penagihan Active CPU setelan ini diabaikan Vercel, jadi
`"memory": 1024` yang terpasang tidak pernah berlaku — dan yang lebih buruk, ia
membuat seolah ada batas yang sudah diatur padahal tidak ada. Dicabut.
`maxDuration: 30` tetap: yang itu masih dihormati.

**Keduanya ada dua kali: sekali di akar, sekali di `elogbook/`.** Proyek Vercel
E-Logbook dibangun dari repo yang sama dengan Root Directory `elogbook/`, jadi
ia punya `package.json` dan `vercel.json` sendiri — dan keduanya membawa
penyakit yang sama, `">=22.5.0"` dan `"memory": 1024`. Dibereskan dengan cara
yang persis sama. Kalau nanti muncul peringatan serupa, periksa kedua tempat:
membereskan satu tidak menyentuh yang lain sama sekali.

Ikut disamakan: `engines` di kedua `package-lock.json`. npm menyalin medan itu
ke lockfile, jadi kalau cuma `package.json` yang disunting, `npm install`
pertama yang dijalankan orang lain akan menulis ulang lockfile-nya dan
memunculkan diff yang tidak ada yang minta.

---

---

## Yang belum siap

- `ELOGBOOK_SECURE_COOKIE` masih terpasang di proyek E-Logbook dan nilainya tidak
  terlihat. Lihat 3.2 — ini yang paling mendesak.
- Branch Tracking Vercel belum diarahkan ke `utama`. Lihat 3.1.
- `elogbook/elogbook_schema.sql` masih 0 byte. Tidak dipakai saat runtime, jadi
  tidak menghalangi deploy — tapi berarti belum ada satu berkas yang merekam
  skema utuhnya.
- **Langkah F belum**: proyek Vercel untuk Avenger belum dibuat. Sampai itu ada,
  Avenger tetap berjalan di kantor di jalur berkas, dan Bagian 5 masih yang
  berlaku sehari-hari.
- Simpanan di Supabase sekarang punya dua salinan yang **tidak saling menyusul**:
  yang di kantor menulis ke `data/*.json`, yang di Supabase berhenti pada
  keadaan 19 Agu 2026. Selama Avenger belum pindah, tiap suntingan di kantor
  membuat keduanya makin jauh. Jalankan `node tools/naikkan.js --gas --timpa`
  sekali lagi tepat sebelum Avenger dipindahkan.
