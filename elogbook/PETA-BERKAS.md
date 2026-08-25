# Peta berkas tampilan

Dulu seluruh tampilan menumpuk di satu berkas `index.html` sepanjang 4.194
baris. Sekarang isinya dipisah menurut jenis dan bagiannya:

| Berkas | Isi |
|---|---|
| `index.html` | kerangka halaman saja — markup tiap tab, modal, dan formulir |
| `css/` | gaya tampilan, 10 berkas |
| `js/` | kode aplikasi, 28 berkas |

**Nomor berkas adalah urutan muat.** Urutannya sama persis dengan urutan aslinya
waktu masih satu blok `<style>` dan satu blok `<script>`, jadi tidak ada satu pun
perilaku yang berubah. Menukar urutan `<link>`/`<script>` di `index.html` bisa
merusak tampilan (aturan CSS belakangan menimpa yang duluan) atau membuat kode
gagal jalan.

Berkas `js/` sengaja **bukan** ES module: fungsi di dalamnya harus tetap bisa
dipanggil dari atribut `onclick="..."` di `index.html`, dan itu hanya berlaku
untuk fungsi global.

---

## `css/` — gaya tampilan

| Berkas | Isi |
|---|---|
| `01-token-tema.css` | Warna dasar (`--bg`, `--accent`, dsb), mode gelap & terang, reset |
| `02-kepala-tab.css` | Kepala halaman bergaya konsol, jam, meta, deretan tab, kerangka isi |
| `03-tombol-formulir.css` | Tombol, kartu, isian formulir, papan tanda tangan |
| `04-catatan.css` | Daftar catatan logbook dan blok tanda tangan di jendela detail |
| `05-tabel.css` | Tabel daily check (Radtel & Radkom), monitoring, dan isu |
| `06-peran-lampiran.css` | Tampil-sembunyi menurut peran, jejak penginput, lampiran |
| `07-modal-toast.css` | Jendela modal dan pesan sekilas |
| `08-layar-kecil.css` | Penyesuaian HP dan tablet (`max-width` 600px dan 360px) |
| `09-cetak.css` | Area cetak, warna hasil cetak, pratinjau di layar, bilah cetak |
| `10-login-identitas.css` | Panel pintu tertutup, identitas pemakai, pemilih unit, tombol tema/bahasa |

Mencari sesuatu: **warna** → `01`. **Sesuatu yang salah di HP** → `08`.
**Hasil cetak** → `09`.

## `js/` — kode aplikasi

### Dasar — dipakai seluruh tab

| Berkas | Isi |
|---|---|
| `01-tema.js` | Mode gelap/terang dan penyimpanan pilihannya per perangkat |
| `02-bahasa.js` | Kamus Indonesia/Inggris dan penerapannya ke seluruh layar |
| `03-waktu.js` | Jam server sebagai satu-satunya acuan waktu |
| `04-toast-tab.js` | Pesan sekilas dan perpindahan antar tab |
| `05-jembatan-server.js` | `gsRun` — pemanggilan API, percobaan ulang, penanganan sesi habis |
| `06-keadaan.js` | Data yang dipakai bersama seluruh tab, dan unit yang sedang dibuka |
| `07-unit.js` | Bentuk formulir dan isi layar mengikuti unit yang dibuka |
| `08-tanda-tangan.js` | Papan tanda tangan: menggambar, ukur ulang, hasil PNG |
| `09-peran.js` | Apa yang boleh dilihat dan ditekan tiap peran; jejak waktu input untuk administrator |
| `10-lampiran.js` | Unggah, pratinjau, dan galeri lampiran berkas |

### Per tab

| Berkas | Isi |
|---|---|
| `11-logbook.js` | Logbook Fasilitas: form, daftar, detail catatan |
| `12-daily-check-radtel.js` | Daily check Garex 300 — daftar item dan tabelnya |
| `13-daily-check-radkom.js` | Daily check Radkom — VHF A/G, ACC, CWP FIC & ATMCP |
| `14-daily-check-umum.js` | Daftar teknisi, pemilihan bentuk per unit, simpan, riwayat, detail |
| `15-isu.js` | Isu / Update Issue, dengan bukti saat dibuka dan saat ditutup |
| `16-monitoring.js` | Form Monitoring Frekuensi |
| `17-ds-test.js` | DS Test: site domestik/internasional, incoming & outgoing |
| `18-ltk.js` | LTK — Laporan Kerusakan, pencarian, dan lampirannya |
| `19-kelola-akun.js` | Kelola Akun (administrator saja), dengan saringan per unit |
| `29-rekap.js` | Rekap & Matrik: kejadian yang sudah pernah dialami — jenis × periode, pelaksana × jenis, catatan di balik tiap sel, plus cetaknya |

### Lintas tab

| Berkas | Isi |
|---|---|
| `20-ttd-pejabat.js` | Tanda tangan susulan: pejabat membubuhkan TTD pada catatan yang belum ditandatangani, di kelima jendela detail |
| `27-ttd-tersimpan.js` | TTD tersimpan milik tiap akun: digambar sekali di "TTD Saya", lalu dipakai ulang di papan mana pun |

### Cetak

| Berkas | Isi |
|---|---|
| `21-cetak-dasar.js` | Kop per unit, TTD jadi tinta hitam, pratinjau, orientasi kertas |
| `22-cetak-logbook.js` | Cetak logbook: per rentang tanggal maupun satu catatan |
| `23-cetak-isu.js` | Cetak daftar isu dan isu tunggal |
| `24-cetak-daily-check.js` | Cetak daily check Radtel & Radkom, form berjalan maupun tersimpan |

Cetak untuk Monitoring, DS Test, dan LTK menyatu dengan tab masing-masing
(`16`, `17`, `18`), karena tata letaknya hanya dipakai di situ.

### Masuk dan mulai

| Berkas | Isi |
|---|---|
| `25-login.js` | Sesi pemakai: identitas di kepala halaman, tombol Keluar, panel pintu tertutup. Tidak ada layar masuk di sini — masuknya di dashboard |
| `26-init.js` | Pemuatan awal: ambil data server lalu render tiap bagian |

---

## Menambah tab atau unit baru

1. Markup tabnya di `index.html` (ikuti pola `<!-- ===== TAB: ... ===== -->`).
2. Kodenya di berkas `js/` baru dengan nomor berikutnya, lalu daftarkan
   `<script src="...">`-nya di `index.html` **sebelum** `25-login.js`. Nomornya
   melanjutkan urutan, tetapi urutan muatnya tetap sebelum `25`/`26` — itu
   sebabnya `27`–`29` terdaftar di antara `24` dan `25`.
3. Bentuk unit (tab mana yang muncul, kolom apa saja) datang dari daftar `UNIT`
   di `db.js` / `db-pg.js` — bukan dari sini.
