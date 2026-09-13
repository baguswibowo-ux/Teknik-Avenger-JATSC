# Status 13 September 2026 — Kolom Suhu di Daily Check Navigasi

Catatan serah terima untuk chat baru. Pendahulunya
[STATUS-13-SEP-2026-PENGINGAT-DINAS.md](STATUS-13-SEP-2026-PENGINGAT-DINAS.md).

## Ringkas

Bagus minta kolom **Suhu** di ujung kanan tabel Daily Check Navigasi (unit
`ppabn`), karena tiap shelter punya suhunya sendiri. Sudah jadi di commit
`e92e27a` branch **`feature/nav-suhu`** (di-checkout di worktree
`.claude/worktrees/notif-pelaksana`). **Belum dipasang** ke produksi —
menunggu Bagus mencoba di server uji.

## Yang berubah

| Berkas | Isi |
|---|---|
| `elogbook/public/js/12c-daily-check-navigasi.js` | Kolom `Suhu (°C)` per baris item (LLZ, GP, DME, MM, OM, DVOR, DME). Kotak isian teks, disimpan di state dengan kunci `A\|0\|0\|Suhu` — kolom `'Suhu'` sengaja di luar `DC_NAV_KOLOM_STD` supaya `navTemuan()`/`cycle` tidak menyentuhnya. `setDcNSuhu()` menyimpan tanpa menggambar ulang (kursor tidak lompat). `navSuhu()` membaca; catatan lama tanpa kunci → kosong. Tampil di modal detail dan halaman cetak sebagai `23.5 °C` atau `–`. |
| `elogbook/public/css/05-tabel.css` | `table.dc.dc-j input.nav-suhu` — kotak 56px berwarna eksplisit (tema gelap), monospace, rata tengah. |

Tidak ada perubahan server/database: state daily check memang JSON bebas
(pola yang sama dengan isian angka di lembar Gedung & Keamanan).

## Bukti

- Uji render di Node (`vm` memuat berkas asli): 6 tabel masing-masing punya
  kepala `Suhu (°C)` di ujung kanan, 18 kotak isian (5+3+3+3+2+2), temuan tidak
  ikut menghitung suhu, detail & cetak menampilkan `23.5 °C`, catatan lama
  tanpa kunci suhu tetap terbaca.
- Server uji E-Logbook dari worktree ini di `http://localhost:3900` (data
  salinan, Telegram mati) sudah menyajikan js/css baru. Akun uji di salinan DB:
  `uji.teknisi` / `uji1234`, unit `ppabn` + `radtel` — hanya ada di salinan.
- Browser pane Claude tidak bisa membuka localhost di sesi ini; tangkapan layar
  belum ada.

## Memasang ke produksi

Hanya berkas statis — tidak perlu restart. Di folder utama:

```powershell
git merge --ff-only feature/nav-suhu
```

Halaman yang sudah terbuka baru ikut sesudah cache JS 1 jam habis atau Ctrl+F5.

## Catatan

- Suhu dicatat **per baris item**, bukan per fasilitas. Kalau GP dan DME
  berbagi shelter, salah satu dibiarkan kosong — atau ubah jadi per seksi
  kalau Bagus mau.

## Tambahan: Meter Reading DVOR/DME (commit berikutnya di branch ini)

Empat lembar baru di `17f-meter-reading.js` dari "METER READING DVOR-DME-NDB.xlsx":
`dvor-ckg` (SELEX), `dme-ckg` (SELEX), `dvor-dki` (AWA VRB-52D), `dme-dki` (AWA).
Sheet NDB (Jacotron, SAC) dan GC DVOR **tidak** dibuat, sesuai permintaan Bagus.
Pohon di index.html: METER READING → DVOR / DME → CKG | DKI → DVOR · DME.
Penyimpanan sama dengan ILS (tabel `dstest`, `__format:'mrreading'`, `__mrForm`),
jadi TTD manager, kotak masuk, hapus, dan cetak sudah jalan tanpa perubahan server.
Judul cetak & merk kini per lembar (`def.cetak`, `def.merk`); ILS tetap seperti semula.

Server uji: `https://uji.teknik-avengers.com` (dashboard uji 3910 → E-Logbook uji
3900, keduanya dari worktree ini; peluncur di scratchpad sesi, dinyalakan Bagus
dengan `Start-Process`). Ingress tunnel `uji.teknik-avengers.com → localhost:3910`
sudah dipasang di config systemprofile. Dashboard uji WAJIB mendengar di
`0.0.0.0`: cloudflared menghubungi `localhost` lewat `::1`.

## Rapi tabel Meter Reading (commit `d69ba51`, `b44593c`)

Keluhan Bagus dari cetak DME DKI: kepala info dan tabel direntang selebar
kertas landscape, nilai jauh dari parameter. Perbaikan di `17f`:
- Tabel dengan kolom nilai <= 4 ("rapat") memakai `<colgroup>` +
  `table-layout:fixed`: NO 7%, nilai 20% per kolom (maks. 56% total), UNIT/LIMIT
  16%, sisanya PARAMETER — sama untuk semua seksi, tepi kanan lurus.
  Berlaku juga ke tabel kecil di lembar ILS; tabel besar ILS tidak berubah.
- Kepala info cetak `width:auto`.
- Lembar yang seluruh tabelnya rapat (DVOR/DME) dicetak portrait; ILS landscape.
  Pilihan orientasi pemakai (`orientasiCetak`) tetap menang.
Catatan cache: `/logbook/js/*.js` di-cache edge Cloudflare 5 menit
(`s-maxage=300`) dan peramban 1 jam — sesudah deploy, tunggu 5 menit lalu
Ctrl+F5 di halaman `/logbook/`.

Bagus sudah mencoba di server uji dan bilang beres (13 Sep 2026). Siap
dipasang: `git merge --ff-only feature/nav-suhu` di folder utama, tanpa restart.
