# Dua berkas yang belum ada di sini

Layar masuk sudah siap memakai keduanya. Selama belum ada, layar tetap hidup dan
tetap bisa dipakai masuk — yang tampil hanya penggantinya, dan itu memang
kelihatan seperti pengganti.

| Berkas | Dipakai oleh | Kalau belum ada |
|---|---|---|
| `earth-login-background.webp` | `css/11-login-avengers.css` (`background-image` di `#loginBg`) | Gradasi langit malam biru gelap. Layar tetap utuh, cuma tanpa bumi. |
| `avengers-logo.webp` | `index.html` (`<img id="logoAvengers">`) | Tulisan **AVENGERS** biasa, ditukar oleh `onerror` pada `<img>`-nya. |

Begitu kedua berkas ditaruh di folder ini dengan nama persis seperti di atas,
tampilannya jadi tanpa satu baris kode pun berubah.

## Yang perlu diperhatikan waktu membuatnya

**`earth-login-background.webp`** — bumi dilihat dari luar angkasa.

- Ukuran 2400×1350 sudah cukup; lebih besar hanya menambah berat unduhan.
- Melebar (landscape). Dipasang `background-size:cover`, jadi di layar HP yang
  tegak sisi kiri-kanannya akan terpotong — taruh bagian terpenting di tengah.
- **Tidak boleh ada kotak masuk, isian, atau tombol di dalam gambar.** Semua itu
  HTML sungguhan yang digambar di atasnya. Gambar referensi dari WhatsApp sudah
  berisi kotak masuk palsu; kalau yang itu yang dipasang, akan ada dua kotak
  masuk di layar dan yang palsu tidak bisa diklik.
- Sisakan ruang agak gelap di tengah-atas. Di situ logo dan tulisan oranye
  berdiri, dan keduanya hilang di atas awan yang terlalu cerah.

**`avengers-logo.webp`** — tulisan AVENGERS saja.

- **Latarnya harus tembus pandang.** WebP mendukungnya; simpan dengan alpha.
  Logo berlatar kotak hitam akan terlihat sebagai kotak hitam menempel di
  langit.
- Lebar 1300 px kira-kira pas — di layar lebar ia digambar selebar 620 px, jadi
  dua kali lipatnya cukup untuk layar beresolusi tinggi.
- Potong rapat sampai ke tepi huruf. Ruang kosong bawaan gambar ikut terhitung
  saat CSS mengatur letaknya, dan logonya jadi turun sendiri tanpa sebab yang
  kelihatan.
- Bayangan biru dan hitam sudah ditambahkan CSS lewat `filter: drop-shadow`.
  Kalau bayangannya sudah ikut menyatu di dalam gambar, hasilnya bertumpuk dua
  kali — kirim yang polos.

Kalau nanti berkasnya berformat PNG atau JPG, cukup ganti namanya di dua tempat
yang disebut di tabel; tidak ada daftar aset lain yang perlu ikut disunting.
