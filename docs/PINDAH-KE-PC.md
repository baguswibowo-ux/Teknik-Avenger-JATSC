# Pindah ke PC sendiri + Cloudflare Tunnel

Panduan sekali jalan untuk memindahkan Avenger dan E-Logbook dari Vercel ke PC
sendiri, lalu membukanya ke internet lewat Cloudflare Tunnel. Ditulis 7 Sep 2026
dari laptop; yang dikerjakan di PC ditandai jelas.

Perkiraan waktu kerja: **1,5 sampai 2 jam**, di luar waktu menunggu nameserver
berpindah ke Cloudflare (bisa 15 menit, bisa sampai sehari, dan itu di luar
kendali siapa pun). Menunggu itu tidak memblokir apa-apa: langkah 1 sampai 4
bisa diselesaikan lebih dulu, bahkan sebelum domainnya aktif.

---

## 0. Sebelum mulai: data di Vercel masih hidup

Selama Vercel belum dimatikan, teknisi masih mengisi logbook di sana. Salinan
yang dibawa dari laptop akan **basi** sejak menit itu juga.

Jadi urutannya: pasang dulu semuanya di PC dengan data salinan, buktikan jalan,
lalu **tepat sebelum berpindah sungguhan** jalankan ulang penarikan data supaya
yang terbaru ikut:

```
node tools/tarik-supabase.js
```

Skrip itu aman diulang. Data lokal yang lama dipindah ke `_cadangan-lokal-<waktu>/`
lebih dulu, bukan ditimpa. Butuh `DATABASE_URL` dan `SUPABASE_SERVICE_KEY`, yang
sudah ada di berkas `.env` yang ikut disalin.

---

## 1. Salin dari laptop ke PC

Salin seluruh folder `E:\2026\Teknik JATSC Avenger`, **kecuali dua folder ini**:

| Folder | Ukuran | Kenapa dilewati |
|---|---|---|
| `.vercel` | 63 MB | Cache build Vercel, tidak dipakai di server sendiri |
| `node_modules` | 2,5 MB | Dipasang ulang di langkah 2, biar cocok dengan Node di sana |

Sisanya sekitar 90 MB dan **harus ikut semua**, karena inilah yang tidak ada di
GitHub (sengaja, sebab repositorinya publik):

- `.env` dan `elogbook/.env` berisi kunci Supabase dan alamat basis data
- `elogbook/data/elogbook.db` seluruh isi E-Logbook
- `elogbook/uploads/` tanda tangan dan lampiran, 914 berkas
- `data/` jadwal dinas, personel, hak akses
- `public/foto/` foto pegawai dan logo unit

Folder cadangan `E:\2026\Cadangkan` tidak perlu ikut. Di PC ia akan terisi
sendiri.

## 2. Pasang Node dan pustaka

Di PC, pasang **Node.js 24** dari nodejs.org. Versinya dipatok di `package.json`,
dan basis data SQLite memakai modul bawaan Node yang belum ada di versi lama.

Lalu dari dalam folder aplikasi:

```
npm install
```

## 3. Uji di PC dulu, sebelum menyentuh internet

```
npm start
```

Buka http://localhost:3100 dan masuk dengan akun produksimu. Kalau logbook,
foto, dan tanda tangan tampil, berarti salinan datanya utuh. Selesaikan ini
sebelum lanjut, karena kalau ada yang kurang, jauh lebih mudah dicari sekarang.

## 4. Bukti cepat: Quick Tunnel, tanpa domain

Bisa dicoba kapan saja, tidak perlu menunggu domain aktif. Unduh `cloudflared`
untuk Windows dari halaman rilis Cloudflare, lalu:

```
cloudflared tunnel --url http://localhost:3100
```

Ia mencetak alamat acak berakhiran `trycloudflare.com`. Buka dari HP dengan data
seluler, bukan wifi rumah, supaya benar-benar lewat internet. Kalau halaman
masuk muncul, seluruh rantainya sudah terbukti: aplikasi, tunnel, dan jalan
keluar dari rumah tanpa membuka port router sama sekali.

Hentikan dengan Ctrl+C. Alamat acak itu hilang setiap kali dijalankan, jadi
memang cuma untuk pembuktian.

## 5. Domain: pindahkan nameserver ke Cloudflare

Di dash.cloudflare.com, tambahkan `avengers-teknik.com`, pilih paket gratis.
Cloudflare memberi dua nameserver. Masukkan keduanya di panel Domainesia,
menggantikan nameserver bawaan.

Setelah itu tunggu sampai Cloudflare menandai domainnya aktif. Langkah 6 belum
bisa dikerjakan sebelum itu.

## 6. Tunnel bernama

```
cloudflared tunnel login
```

Browser terbuka, pilih domainnya. Lalu:

```
cloudflared tunnel create avenger
```

Perintah itu menghasilkan berkas kredensial `.json` di `%USERPROFILE%\.cloudflared\`.
**Berkas itulah tunnelnya.** Simpan baik-baik: memindahkannya ke server lain
nanti berarti memindahkan tunnel yang sama, tanpa perlu mengubah DNS lagi.

Buat `%USERPROFILE%\.cloudflared\config.yml`:

```yaml
tunnel: avenger
credentials-file: C:\Users\<NAMA>\.cloudflared\<UUID>.json

ingress:
  - hostname: avengers-teknik.com
    service: http://localhost:3100
  - service: http_status:404
```

Ganti `<NAMA>` dan `<UUID>` sesuai berkas yang tadi dibuat. Hanya port 3100 yang
dipetakan; E-Logbook di port 3000 memang tidak boleh terbuka sendiri, sebab
seluruh aksesnya lewat Avenger di `/logbook/`.

Arahkan DNS-nya:

```
cloudflared tunnel route dns avenger avengers-teknik.com
```

Uji di depan mata dulu sebelum dijadikan layanan:

```
cloudflared tunnel run avenger
```

## 7. Jadikan layanan Windows

```
cloudflared service install
```

Perhatikan satu jebakan: layanan berjalan sebagai SYSTEM, dan ia membaca
konfigurasi dari folder profil SYSTEM, bukan dari folder profilmu. Kalau
layanannya hidup tapi situsnya tidak terbuka, salin `config.yml` beserta berkas
`.json` kredensialnya ke
`C:\Windows\System32\config\systemprofile\.cloudflared\`, lalu jalankan ulang
layanannya lewat services.msc.

## 8. Nyalakan cookie aman

Baru setelah situsnya benar-benar terbuka lewat `https://`, buka `.env` dan
hilangkan tanda pagar pada baris:

```
ELOGBOOK_SECURE_COOKIE=1
```

Jangan dinyalakan lebih awal. Selama masih diuji lewat `http://` dengan alamat
LAN, peramban akan menolak cookienya dan login tampak gagal tanpa pesan apa pun.
`http://localhost` tetap boleh, karena peramban menganggapnya aman.

Baris `PROXY_TEPERCAYA=loopback` sudah benar apa adanya: cloudflared berjalan di
komputer yang sama, dan itu yang membuat penahan login tetap dihitung per orang,
bukan satu jatah untuk semua.

Nyalakan ulang servernya supaya `.env` yang baru terbaca.

## 9. Layanan Windows untuk aplikasinya

Dari Command Prompt yang dibuka **Run as administrator**:

```
tools\pasang-jadwal.cmd
```

Memasang tiga tugas: server saat Windows menyala, penjaga tiap 10 menit yang
menyalakan ulang kalau port dashboard kosong, dan cadangan harian pukul 02.00.
`tools\pasang-jadwal.cmd lepas` menghapus ketiganya.

Periksa `CADANGAN_DIR` di `.env` menunjuk ke folder yang benar di PC.

## 10. Matikan Vercel, tapi jangan buru-buru

Biarkan Vercel hidup beberapa hari sesudah PC melayani semua orang. Kalau ada
yang terlewat, jalan kembalinya masih terbuka. Sesudah yakin, hapus domain
kustomnya di Vercel supaya tidak ada dua tempat yang menjawab.

---

## Kalau nanti pindah ke server Linux kantor

Yang berpindah cuma tiga hal: folder aplikasi, berkas kredensial tunnel, dan
`config.yml`. DNS tidak disentuh sama sekali, karena ia menunjuk ke tunnel, bukan
ke alamat mesin. Domainnya ikut sendiri.

Yang tidak ikut: berkas `.cmd` di `tools/`. Task Scheduler tidak ada di Linux,
jadi di sana pakai systemd, atau Docker dengan kebijakan restart. Docker baru
benar-benar menguntungkan di Linux, sebab tidak ada lapisan penerjemah yang
membuat penguncian berkas SQLite jadi tidak andal seperti di Windows.
