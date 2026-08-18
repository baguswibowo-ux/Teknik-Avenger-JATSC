# Runtutan Deploy — Vercel + Supabase

Sasaran: menaikkan E-Logbook versi terakhir ke Vercel dengan database Supabase
yang **sudah ada**, tanpa satu baris pun data lama berubah.

Avenger tetap berjalan di server kantor — diputuskan 18 Agu 2026, alasannya di
Bagian 6. Yang naik ke Vercel hanya E-Logbook.

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

Angka pada 18 Agu 2026: users 24, entries 141, dailychecks 25, monitoring 1,
dstest 1, ltk 1, issues 3, lampiran 24, user_unit 20.

### 0.2 Backup

Supabase → Database → Backups → ambil snapshot manual. Ini jaring pengaman,
bukan karena langkah di bawah berisiko.

---

## Bagian 1 — Buat tabel `berkala` sendiri lebih dulu

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
salah satu diubah, yang lain wajib ikut.

---

## Bagian 2 — Commit dan push

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

## Bagian 3 — Deploy E-Logbook

E-Logbook punya `vercel.json` dan `api/index.js` sendiri di dalam `elogbook/`,
jadi ia jadi **proyek Vercel tersendiri**.

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
| `ELOGBOOK_SECURE_COOKIE` | — | **jangan diisi**, lihat 5.1 |
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

---

## Bagian 4 — Pastikan data lama utuh

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
snapshot Bagian 0.2.

---

## Bagian 5 — Avenger tetap di kantor

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

### 5.1 Jangan pasang `ELOGBOOK_SECURE_COOKIE`

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

## Bagian 6 — Kenapa Avenger tidak ikut naik

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

- **Avenger tetap di kantor** ← **yang dipilih.** Paling cepat, tidak ada yang
  perlu ditulis ulang, dan tidak ada satu pun modul yang berubah perilakunya.
- Naikkan juga penyimpanan Avenger ke Supabase — tujuh modul pindah dari
  `data/*.json` ke tabel. Pekerjaan tersendiri, belum dikerjakan. Ini jalan
  yang benar kalau suatu saat Avenger memang harus bisa dibuka dari luar kantor.
- Avenger di cloud sebagai baca-saja. Ditolak: pemakai akan menyangka
  simpanannya berhasil, dan itu lebih buruk daripada tidak ada sama sekali.

Yang berubah bagi pemakai: **tidak ada.** Avenger tetap di alamat yang sama,
tetap bisa menyimpan, hanya sumber datanya yang sekarang di Vercel.

Yang perlu diingat: **Avenger sekarang bergantung pada internet kantor.** Kalau
sambungan keluar putus, penerus di `server.js:111` gagal dan halaman jatuh ke
data contoh. Di server kantor pasang `DATA_CONTOH=0` supaya keadaan itu terlihat
sebagai kerusakan, bukan angka karangan yang menyamar jadi kenyataan.

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

## Yang belum siap

- `elogbook/elogbook_schema.sql` masih 0 byte. Tidak dipakai saat runtime, jadi
  tidak menghalangi deploy — tapi berarti belum ada satu berkas yang merekam
  skema utuhnya.
- Penyimpanan modul milik Avenger masih di `data/*.json`. Bukan penghalang:
  Avenger sengaja tetap di kantor (Bagian 5 dan 6). Baru jadi pekerjaan kalau
  Avenger suatu saat harus bisa dibuka dari luar kantor.
