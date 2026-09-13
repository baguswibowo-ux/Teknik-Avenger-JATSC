# Untuk pendev — cara mulai dan cara kirim perubahan

Ditulis 13 September 2026. Repositori ini **publik** dan kodenya jalan di
produksi (teknik-avengers.com) langsung dari branch `utama`. Semua yang ada
di sini dibaca sebelum menyentuh apa pun.

## 1. Menjalankan di komputer sendiri

Butuh Node 24.

```bash
git clone https://github.com/baguswibowo-ux/Teknik-Avenger-JATSC.git
cd Teknik-Avenger-JATSC
npm install
npm --prefix elogbook install
npm --prefix elogbook run user -- add admin "Nama Anda" admin
npm start
```

`npm start` menyalakan dua server sekaligus: **dashboard** di
<http://localhost:3100> dan **E-Logbook** di <http://localhost:3000>. Masuk
lewat dashboard dengan akun admin yang barusan dibuat. Basis datanya SQLite,
dibuat sendiri saat pertama jalan, kosong. Tidak perlu `.env` sama sekali.

`npm run dev` sama seperti `npm start` tapi menyalakan ulang server dashboard
tiap berkasnya berubah.

Penjelasan lengkap tiap modul ada di [`../README.md`](../README.md).

## 2. Alur kirim perubahan

Branch `utama` **terkunci**: tidak bisa di-push langsung, tidak bisa dihapus,
tidak bisa force push. Satu-satunya jalan masuk adalah Pull Request.

1. Buat branch dari `utama` yang terbaru: `git switch -c feature/nama-kerjaan`.
2. Commit seperti biasa. Pesan commit dalam bahasa Indonesia, seperti riwayat
   yang sudah ada (`git log --oneline` menunjukkan gayanya).
3. `git push -u origin feature/nama-kerjaan`, lalu buka PR ke `utama`.
4. Di isi PR tulis: apa yang berubah dan kenapa, berkas mana saja, tangkapan
   layar sebelum/sesudah untuk perubahan tampilan, dan **apakah `server.js`
   atau folder `api` ikut berubah** (kalau ya, produksi perlu restart).
5. Perubahan dicoba dulu di server uji, baru digabung. Yang menggabung Bagus.

Jangan kirim zip, jangan kirim salinan folder, jangan kirim berkas lewat chat.
Semuanya lewat commit.

## 3. Peta singkat

| Di mana | Isi |
|---|---|
| `server.js`, `api/`, `public/` | Dashboard. Halaman depan, jadwal dinas, personel, dokumen, kegiatan berkala. |
| `elogbook/server.js`, `elogbook/public/` | E-Logbook. Disajikan lewat dashboard di `/logbook/`, bukan dibuka sendiri. |
| `telegram.js`, `pengingat-dinas.js` | Bot Telegram dan pengingat. Mati kalau token kosong, jadi aman di komputer sendiri. |
| `docs/` | Catatan serah terima per tanggal. `RINGKASAN.md` untuk gambaran, `CATATAN.md` untuk temuan. |
| `data/`, `.env` | Tidak ada di repo dan jangan pernah dimasukkan. |

## 4. Jebakan yang sudah pernah memakan korban

- **Berkas js/css baru di dashboard tidak otomatis termuat.** Halaman memuat
  satu bundel gabungan; daftarnya ada di konstanta `URUTAN_JS` dan `URUTAN_CSS`
  di `server.js`. Berkas baru wajib ditambahkan ke sana, di urutan yang benar.
- **Aset E-Logbook harus dipanggil relatif.** `css/05-tabel.css`, bukan
  `/css/05-tabel.css`. E-Logbook hidup di bawah `/logbook/`; jalur mutlak
  akan jatuh ke aset milik dashboard, dan gejalanya bukan galat, melainkan
  halaman E-Logbook berkulit dashboard.
- **Sambungan ke internet sempit**, sekitar 1,6 Mbps dari server ke luar.
  Font sudah disimpan lokal di `public/vendor/font`. Jangan tambah pustaka
  besar dari CDN, jangan tambah gambar besar. Halaman depan sekarang 12
  request; jangan naik.
- **Tema gelap.** Warna kotak isian dan teks ditulis eksplisit, jangan
  mengandalkan bawaan peramban.
- **Skrip `.cmd` dan `.ps1` harus ASCII murni.** PowerShell 5.1 di server
  membaca UTF-8 sebagai ANSI; satu em dash memutus string.
- **Perubahan di `server.js` atau `api/` berarti restart produksi.** Sebut di
  PR. Perubahan yang hanya js/css/html cukup ditarik, tanpa restart.
- **Jangan ubah struktur data yang sudah tersimpan** (kunci JSON di `data/`,
  tabel SQLite) tanpa membicarakannya dulu. Datanya hidup dan tidak ada
  migrasi otomatis.

## 5. Kalau menemukan yang aneh

Tulis di [`CATATAN.md`](CATATAN.md) bagian Temuan tim, atau buka issue di
GitHub. Jangan berhenti di chat.
