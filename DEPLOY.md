# Runtutan Deploy — Vercel + Supabase

Sasaran: menaikkan E-Logbook versi terakhir ke Vercel dengan database Supabase
yang **sudah ada**, tanpa satu baris pun data lama berubah.

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
2. **Root Directory: `elogbook`** ← ini yang membedakannya dari proyek Avenger.
3. Framework Preset: **Other**. Build Command dikosongkan.
4. Isi Environment Variables (Production **dan** Preview):

| Nama | Nilai | Wajib |
|---|---|---|
| `ELOGBOOK_DB` | `postgres` | **ya** |
| `DATABASE_URL` | URI pooler Supabase | **ya** |
| `SUPABASE_URL` | `https://<ref>.supabase.co` | ya, untuk unggahan berkas |
| `SUPABASE_SERVICE_KEY` | service_role key | ya, untuk unggahan berkas |
| `ELOGBOOK_BUCKET` | `elogbook` | tidak (ini bawaannya) |
| `ELOGBOOK_SECURE_COOKIE` | `1` | ya, karena HTTPS |
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

Kerjakan sebelum menyentuh Avenger.

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

## Bagian 5 — Deploy Avenger

1. Vercel → **Add New… → Project** → impor repositori yang **sama**.
2. **Root Directory: `.`** (biarkan di akar).
3. Environment Variables:

| Nama | Nilai |
|---|---|
| `ELOGBOOK_ASAL` | `https://<elogbook>.vercel.app` |
| `ELOGBOOK_TAUTAN` | `https://<elogbook>.vercel.app` |

`ELOGBOOK_ASAL` dipakai server Avenger untuk meneruskan `/api/*`.
`ELOGBOOK_TAUTAN` dipakai halaman untuk menaruh tautan "buka E-Logbook".

4. **Deploy.**

Cookie sesi ikut terbawa: peramban hanya bicara ke domain Avenger, dan penerus
di `server.js` sudah meneruskan `Set-Cookie` lewat `getSetCookie()`.

---

## Bagian 6 — Yang harus Anda tahu tentang Avenger di cloud

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

Tiga pilihan, tinggal dipilih:

- **Avenger tetap di kantor**, E-Logbook di Vercel. Paling cepat, tidak ada yang
  perlu ditulis ulang. Avenger di kantor menunjuk `ELOGBOOK_ASAL` ke alamat Vercel.
- **Naikkan juga penyimpanan Avenger ke Supabase** — tujuh modul pindah dari
  `data/*.json` ke tabel. Pekerjaan tersendiri, belum dikerjakan.
- **Avenger di cloud sebagai baca-saja** untuk sementara, penyuntingan tetap di
  kantor. Perlu diberitahukan ke pemakai, kalau tidak mereka akan menyangka
  simpanannya berhasil.

---

## Bagian 7 — Kalau harus mundur

Kode: Vercel → Deployments → deployment lama → **Promote to Production**.

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
- Modul milik Avenger, lihat Bagian 6.
