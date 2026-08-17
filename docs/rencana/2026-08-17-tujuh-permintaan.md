# Tujuh Permintaan — Rencana Pengerjaan

> **Untuk yang mengerjakan:** langkah ditulis sebagai kotak centang (`- [ ]`).
> Kerjakan satu tugas sampai selesai — termasuk verifikasi dan commit-nya —
> sebelum pindah ke tugas berikutnya.

**Tujuan:** Menutup tujuh permintaan yang diminta 17 Agustus 2026: jadwal DS Test
tiga hari sepekan beserta uji tegangan, sambungannya ke kegiatan berkala di
dashboard, pulang ke dashboard tanpa masuk lagi, daftar dinas yang hanya
menampilkan yang benar-benar diisi, personel yang bisa mengurus datanya sendiri,
sparepart yang terbuka untuk teknisi, dan nama unit yang bisa disunting.

**Cara kerjanya:** Empat dari tujuh permintaan itu bertemu di satu tempat —
kegiatan berkala di dashboard. Model kegiatannya karena itu dibongkar lebih dulu
(hari jamak, tanda selesai per kejadian), baru sambungannya ke DS Test dipasang
di atasnya. Tiga sisanya berdiri sendiri dan boleh dikerjakan kapan saja.

**Tumpukan teknologi:** Node 20+ / 22+, Express 5, JavaScript polos tanpa modul
di sisi peramban, SQLite (`better-sqlite3`) di kantor dan Postgres di Vercel,
data dashboard sebagai berkas JSON di `data/`.

**Spesifikasinya** tujuh kalimat yang diminta, disalin apa adanya:

1. *"seperti di E-Logbook bagian DS Test itu akan dilakukan tiap minggu setiap
   senin, rabu dan sabtu dan diberikan juga test Tegangan berapa volt ketika
   standby atau dipakai, nanti akan ada lebih lanjut untuk bulanan seperti
   restart CWP dan bersihkan CWP"*
2. *"fitur kembali ke Dashboard teknik lgsg login tidak perlu log in ulang karena
   dia hanya ingin melihat data yg ada di dashboard"*
3. *"point 1 nanti koneksikan dengan kegiatan yg ada di dashboard"*
4. *"daftar dinas ditampikan sesuai yg sudah di input, jikalau di input tidak ada
   dinas P dan S jangan di tampilkan"*
5. *"setiap personel bisa memasukkan atau edit data personel masing2 akun"*
6. *"setiap personel bisa menginput atau mengedit data sparepart"*
7. *"untuk samping gambar tulisan radtel agar bisa di edit, bukan radtel doank
   semua unit"*

## Ketentuan yang berlaku di seluruh tugas

- **Tidak ada kerangka tes di proyek ini.** Kedua `package.json` tidak punya
  skrip `test` dan tidak ada direktori `tests/`. Verifikasi karena itu memakai
  cara yang memang dipakai proyek ini: `node --check` untuk sintaks, `curl` ke
  server yang sedang jalan untuk API, dan pemeriksaan di peramban untuk tampilan.
  **Jangan** memasang kerangka tes baru sebagai bagian dari rencana ini.
- **Dua sisi basis data harus berubah bersama.** Apa pun yang menyentuh skema
  E-Logbook wajib dikerjakan di `elogbook/db.js` (SQLite) **dan**
  `elogbook/db-pg.js` (Postgres). Salah satu tertinggal berarti Vercel dan server
  kantor menyimpan bentuk yang berbeda.
- **Bentuk periode harus sama persis di dua tempat.** `periodeSekarang()` di
  `server.js` dan `periodeKini()` di `public/index.html` merangkai kunci yang
  sama dan dicocokkan satu sama lain. Mengubah salah satu tanpa yang lain
  membuat tanda selesai tidak pernah ketemu.
- **Hak bawaan juga dua tempat.** `HAK_BAWAAN` di `server.js` dan `hakBawaan()`
  di `public/index.html` sengaja disalin, bukan diambil dari satu sumber — data
  contoh jalan tanpa server sama sekali. Keduanya harus berubah bersama.
- **Berkas `js/` E-Logbook bukan ES module.** Fungsi yang dipanggil dari
  `onclick="..."` harus global. Jangan menambahkan `export`/`import` di sana.
- **Bahasa.** Setiap teks baru yang tampil di layar butuh pasangan Indonesia dan
  Inggris — `T('...','...')` di Avenger, kunci di `02-bahasa.js` untuk E-Logbook.
- **Commit per tugas**, dengan pesan berbahasa Indonesia seperti riwayat yang
  sudah ada (lihat `git log --oneline`).

---

## Susunan berkas

Yang disentuh rencana ini, dan tanggung jawab masing-masing:

| Berkas | Yang berubah |
|---|---|
| `server.js` (Avenger) | `rapikanKegiatan` hari jamak + `sumber`; `/berkala/selesai` per kejadian; modul hak `unit`; endpoint `/unitnama`; jalan pintas baris sendiri di `PUT /personel` |
| `public/index.html` (Avenger) | model & editor kegiatan berkala, kartu per kejadian, `dinasHariIni`, kepala unit yang bisa disunting, masuk otomatis dari tautan E-Logbook, `HAK_MODUL`/`HAK_NAMA`/`hakBawaan` |
| `data/berkala.json` | isi awal: DS Test Sen/Rab/Sab, Restart CWP, Bersihkan CWP |
| `data/unit-nama.json` | **baru** — nama dan keterangan unit yang ditimpa dari dashboard |
| `elogbook/db.js` | kolom `volt_standby`, `volt_pakai` di `dstest` (SQLite) |
| `elogbook/db-pg.js` | kolom yang sama (Postgres) |
| `elogbook/public/index.html` | dua isian tegangan di modal DS Test |
| `elogbook/public/js/17-ds-test.js` | simpan, tampilkan, dan cetak tegangan |
| `elogbook/public/js/02-bahasa.js` | label tegangan, dua bahasa |
| `elogbook/public/js/26-init.js` | penanda `#dashboard` pada tautan pulang |

`elogbook/server.js` **tidak** perlu disentuh untuk tegangan: `addDsTest`
menyebar `rec` apa adanya ke `insertDsTest` (`elogbook/server.js:683`), jadi
kolom baru mengalir sendiri begitu kedua berkas db mengenalnya.

---

## Keputusan yang diambil di muka

Tiga hal yang tidak disebut eksplisit dalam permintaan, diputuskan begini —
kalau salah, ini yang perlu dibalik:

**Tanda selesai kegiatan mingguan dihitung per kejadian, bukan per pekan.**
Sekarang satu kegiatan mingguan punya satu tanda per minggu ISO. Kalau DS Test
jatuh Senin, Rabu, dan Sabtu sementara tandanya cuma satu, mencentang hari Senin
akan membuat Rabu dan Sabtu ikut tampak beres — dan justru itu yang perlu
terlihat belum dikerjakan. Karena itu kunci selesai untuk jenis mingguan berubah
dari `unit|id|2026-W34` menjadi `unit|id|2026-08-17`. Jenis lain tidak berubah.
Ini aman dilakukan sekarang karena `data/berkala.json` masih `{}` dan
`data/berkala-selesai.json` belum ada sama sekali — tidak ada catatan lama yang
kehilangan pasangannya.

**`data/berkala.json` diisi sungguhan, bukan cuma data contoh.** Ketiga pekerjaan
yang disebut — DS Test Sen/Rab/Sab, Restart CWP, Bersihkan CWP — dimasukkan ke
data unit radtel yang sebenarnya. Berkasnya sekarang kosong, dan isi ini persis
yang diminta. Kalau ternyata tidak dikehendaki, cukup kosongkan berkasnya lagi.

**Permintaan 7 mencakup nama unit dan baris keterangan di bawahnya.** Yang
disebut cuma "tulisan radtel", tapi tepat di bawahnya ada baris peralatan
(`u.alat`) yang sama-sama datang dari E-Logbook dan sama-sama tidak bisa
disunting. Membuka satu tanpa yang lain meninggalkan kepala unit yang setengah
bisa disunting. Keduanya dibuka.

---

## Yang ternyata sudah jadi

Sebelum mengerjakan apa pun, ini perlu diketahui supaya tidak ada yang dibangun
dua kali:

**Permintaan 6 (sparepart untuk setiap personel) sudah berlaku.** `HAK_BAWAAN`
di `server.js:441` dan `hakBawaan()` di `public/index.html:5041` keduanya sudah
memuat `sparepart: { peran: ['admin','adminunit','pic','teknisi'] }`. Tombolnya
digambar lewat `bolehSuntingDb('sparepart')` (`public/index.html:5074`), yang
berbunyi "modulnya terbuka untuk peran ini **dan** unitnya memang dipegang akun
ini" — persis yang diminta. Tugas 8 memverifikasinya, bukan membangunnya.

**Permintaan 5 sudah berlaku sebagian.** `personel` juga sudah terbuka sampai
`teknisi` di kedua berkas itu, jadi seorang teknisi sudah bisa menyunting baris
personel **di unitnya**. Yang belum: baris milik akunnya sendiri kalau akun itu
tidak memegang unit mana pun, atau kalau barisnya terdaftar di unit lain. Tugas 8
menutup celah itu saja.

---

## Tugas 1 — Kegiatan berkala: hari jamak

**Berkas:**
- Ubah: `server.js:908-937` (`rapikanKegiatan`)
- Ubah: `public/index.html:6327-6350` (`bklJatuh`), `:6355-6376` (`bklKapan`),
  `:6478-6488` (`bklPadaHari`), `:6515-6545` (editor), `:6680-6700` (simpan draf)

**Antarmuka:**
- Menghasilkan: `k.hari` berupa `number[]` berisi 1..7 terurut unik untuk jenis
  `mingguan`, `null` untuk jenis lain. Fungsi baru `bklHariDaftar(k)` →
  `number[]` yang membaca bentuk lama (angka tunggal) maupun baru.

- [ ] **Langkah 1: Longgarkan `rapikanKegiatan` di server**

Di `server.js`, ganti perhitungan `hari:` di dalam objek yang dikembalikan
`rapikanKegiatan` dengan pembacaan yang menerima angka tunggal maupun daftar:

```js
  /* Dulu satu angka, sekarang daftar: DS Test jatuh Senin, Rabu, dan Sabtu, dan
     "sekali seminggu" tidak bisa menampung itu. Angka tunggal dari data lama
     tetap dibaca — ia cuma daftar sepanjang satu. Kosong berarti belum dipilih,
     dan yang belum dipilih diperlakukan sebagai Senin supaya kegiatannya tidak
     hilang dari kalender sama sekali. */
  const hariMentah = Array.isArray(k?.hari) ? k.hari : (k?.hari == null ? [] : [k.hari]);
  const hari = [...new Set(hariMentah
    .map((h) => Math.min(7, Math.max(1, Number(h) || 0)))
    .filter((h) => h >= 1))].sort((a, b) => a - b);
```

lalu pakai di objeknya:

```js
    hari: jenis === 'mingguan' ? (hari.length ? hari : [1]) : null,
```

- [ ] **Langkah 2: Periksa sintaksnya**

```bash
node --check server.js
```

Diharapkan: tidak ada keluaran sama sekali.

- [ ] **Langkah 3: Tambahkan pembaca hari di sisi peramban**

Di `public/index.html`, tepat di atas `bklJatuh`, tambahkan:

```js
/** Hari-hari kegiatan mingguan sebagai daftar angka 1..7 (Senin..Minggu).
    Bentuk lama menyimpan satu angka; dibaca di sini supaya kegiatan yang
    sudah terlanjur tersimpan tidak perlu disentuh. */
function bklHariDaftar(k){
  const m = Array.isArray(k.hari) ? k.hari : (k.hari == null ? [] : [k.hari]);
  const d = [...new Set(m.map(h=>Math.min(7, Math.max(1, Number(h) || 0))).filter(h=>h >= 1))];
  return d.length ? d.sort((a,b)=>a-b) : [1];
}
```

- [ ] **Langkah 4: Jadikan `bklJatuh` menjawab kejadian terdekat**

Ganti cabang mingguan di ujung `bklJatuh` (baris yang sekarang memakai
`k.hari || 1`) dengan:

```js
  // Mingguan: kejadian PERTAMA pada minggu yang memuat acuan. Kejadian yang
  // lain dibaca lewat bklKejadian() — fungsi ini menjawab satu tanggal karena
  // pemanggil lamanya (kartu, lencana) memang menanyakan satu.
  const kini = acuan.getDay() || 7;
  const senin = new Date(acuan);
  senin.setDate(acuan.getDate() - (kini - 1));
  senin.setHours(0,0,0,0);
  const jatuh = new Date(senin);
  jatuh.setDate(senin.getDate() + (bklHariDaftar(k)[0] - 1));
  return jatuh;
```

- [ ] **Langkah 5: Tambahkan `bklKejadian` — seluruh tanggal sepekan**

Tepat di bawah `bklJatuh`, tambahkan:

```js
/** Seluruh tanggal kejadian kegiatan mingguan pada minggu yang memuat `acuan`.
    Untuk jenis lain jawabannya satu tanggal — jatuh temponya sendiri. */
function bklKejadian(k, acuan = new Date()){
  if(k.jenis !== 'mingguan') return [bklJatuh(k, acuan)];
  const kini = acuan.getDay() || 7;
  const senin = new Date(acuan);
  senin.setDate(acuan.getDate() - (kini - 1));
  senin.setHours(0,0,0,0);
  return bklHariDaftar(k).map(h=>{
    const t = new Date(senin);
    t.setDate(senin.getDate() + (h - 1));
    return t;
  });
}
```

- [ ] **Langkah 6: Perbaiki kalimat "kapan"**

Di `bklKapan`, ganti cabang `default:` menjadi:

```js
    default: {
      const nama = bklHariDaftar(k).map(hariNama);
      return T(`tiap ${nama.join(', ')}`, `every ${nama.join(', ')}`);
    }
```

- [ ] **Langkah 7: Perbaiki penanda di tabel jadwal**

`bklPadaHari` membandingkan `bklJatuh(k, tgl)` dengan tanggalnya, jadi kegiatan
tiga hari hanya tertandai sekali. Ganti isi `filter`-nya:

```js
  return bklDaftar(unit).filter(k=>bklKejadian(k, tgl).some(j=>
    j.getFullYear() === tgl.getFullYear()
    && j.getMonth() === tgl.getMonth()
    && j.getDate()  === tgl.getDate()));
```

- [ ] **Langkah 8: Ganti pemilih hari di editor jadi centang jamak**

Di `bklIsi`, ganti `<select data-bkl="${i}" data-kolom="hari">` beserta isinya
dengan deretan centang:

```js
            ? `<div style="display:flex;gap:7px;flex-wrap:wrap;padding:7px 0">${
                HARI_NAMA.map((_,h)=>{
                  const aktif = bklHariDaftar(k).includes(h + 1);
                  return `<label style="display:inline-flex;align-items:center;gap:4px;font-size:11.5px">
                    <input type="checkbox" data-bkl-hari="${i}" value="${h+1}"${aktif?' checked':''}>
                    ${esc(hariNama(h+1).slice(0,3))}</label>`;
                }).join('')}</div>`
```

Lebar kotaknya ikut naik — ganti `min-width:120px` pada `.isian` pembungkusnya
menjadi `min-width:230px`.

- [ ] **Langkah 9: Sambungkan centangnya ke draf**

Di `bklPasang`, tambahkan sesudah blok `kotak.querySelectorAll('[data-bkl]')`:

```js
  kotak.querySelectorAll('[data-bkl-hari]').forEach(c=>{
    c.addEventListener('change', ()=>{
      const k = BKL.draf && BKL.draf[Number(c.dataset.bklHari)];
      if(!k) return;
      const punya = new Set(bklHariDaftar(k));
      // Hari terakhir tidak boleh ikut dilepas: kegiatan mingguan tanpa satu
      // hari pun tidak akan pernah muncul di kalender, dan yang melepasnya
      // tidak akan pernah tahu kenapa.
      if(c.checked) punya.add(Number(c.value));
      else if(punya.size > 1) punya.delete(Number(c.value));
      else { c.checked = true; return; }
      k.hari = [...punya].sort((a,b)=>a-b);
    });
  });
```

- [ ] **Langkah 10: Rapikan draf sebelum dikirim**

Di penangan tombol `#bklSimpan`, ganti baris `hari:` menjadi:

```js
        hari: k.jenis === 'mingguan' ? bklHariDaftar(k) : null,
```

Dan di ketiga tempat yang membuat baris draf baru (`#bklSunting`, `#bklTambah`,
dan `[data-bkl-buang]`), ganti `hari:1` menjadi `hari:[1]`.

- [ ] **Langkah 11: Jalankan dan periksa di peramban**

Nyalakan keduanya:

```bash
npm start
```

Buka `http://localhost:3100`, masuk sebagai administrator, buka Database Unit →
sebuah unit → Kegiatan Berkala → **Atur kegiatan**. Diharapkan: pemilih harinya
sekarang tujuh centang, bisa dicentang lebih dari satu, dan hari terakhir tidak
bisa dilepas. Simpan, lalu periksa isinya benar-benar tersimpan sebagai daftar:

```bash
curl -s http://localhost:3100/berkala
```

Diharapkan: `"hari": [1,3,6]` (atau apa pun yang dicentang), bukan angka tunggal.

- [ ] **Langkah 12: Commit**

```bash
git add server.js public/index.html
git commit -m "Kegiatan mingguan boleh lebih dari satu hari"
```

---

## Tugas 2 — Kegiatan berkala: tanda selesai per kejadian

**Berkas:**
- Ubah: `server.js:887-897` (`periodeSekarang`), `:1010-1080` (`/berkala/selesai`)
- Ubah: `public/index.html:6300-6313` (`periodeKini`, `bklKunci`),
  `:6430-6449` (`bklTandai`), `:6461-6474` (`bklJatuhTempo`), `:6570-6620` (kartu)

**Antarmuka:**
- Mengonsumsi: `bklKejadian(k, acuan)` dan `bklHariDaftar(k)` dari Tugas 1.
- Menghasilkan: `bklKunciTgl(unit, k, tanggal)` → `string`, dan `bklTandai(unit,
  k, batal, tanggal)` dengan parameter keempat `tanggal` berbentuk `YYYY-MM-DD`
  (diabaikan untuk jenis selain mingguan).

- [x] **Langkah 1: Terima tanggal kejadian di server**

Dikerjakan dengan satu perubahan dari cuplikan di bawah: daftar hari diambil
lewat `hariDaftar(keg)` yang baru, bukan `keg.hari` apa adanya. Sisi peramban
menormalkan hari yang kosong atau tidak sah menjadi `[1]`; kalau server tidak
ikut menormalkan, kegiatan mingguan tanpa `hari` tergambar hari Senin di layar
tapi ditolak servernya saat dicentang.

Di `server.js`, di dalam `app.post('/berkala/selesai', ...)`, ganti baris
`const periode = periodeSekarang(keg.jenis);` dengan:

```js
  /* Kegiatan mingguan sekarang bisa jatuh beberapa hari dalam sepekan, jadi
     satu tanda per pekan tidak cukup lagi: mencentang hari Senin akan membuat
     Rabu dan Sabtu ikut tampak beres. Untuk jenis ini yang jadi kunci adalah
     TANGGAL kejadiannya.

     Tanggalnya datang dari peramban, dan karena itu diperiksa di sini: harus
     salah satu hari yang memang dijadwalkan, dan harus di minggu yang sedang
     berjalan. Tanpa syarat kedua, satu permintaan bisa menandai selesai
     pekerjaan bulan depan. */
  let periode;
  if (keg.jenis === 'mingguan') {
    const tgl = String(req.body?.tanggal || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tgl)) {
      return res.status(400).json({ error: 'Tanggal kejadian tidak sah.' });
    }
    const d = new Date(tgl + 'T00:00:00');
    if (isNaN(d)) return res.status(400).json({ error: 'Tanggal kejadian tidak sah.' });
    const hariDijadwalkan = Array.isArray(keg.hari) ? keg.hari : [keg.hari];
    if (!hariDijadwalkan.includes(d.getDay() || 7)) {
      return res.status(400).json({ error: 'Kegiatan ini tidak dijadwalkan pada hari itu.' });
    }
    if (pekanIso(d) !== pekanIso(new Date())) {
      return res.status(400).json({
        error: 'Hanya kejadian di minggu yang sedang berjalan yang bisa ditandai.'
      });
    }
    periode = tgl;
  } else {
    periode = periodeSekarang(keg.jenis);
  }
```

- [x] **Langkah 2: Periksa sintaksnya**

```bash
node --check server.js
```

Diharapkan: tidak ada keluaran.

- [x] **Langkah 3: Kunci bertanggal di sisi peramban**

Di `public/index.html`, tepat di bawah `bklKunci`, tambahkan:

```js
/** Tanggal sebagai 'YYYY-MM-DD' menurut jam setempat — bukan toISOString(),
    yang menggeser tanggal ke UTC dan membuat kejadian sebelum jam 07.00 WIB
    tercatat sebagai hari sebelumnya. */
const bklTgl = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${
  String(d.getDate()).padStart(2,'0')}`;

/** Kunci selesai untuk satu kejadian. Mingguan berkunci tanggal, sisanya tetap
    berkunci periode — bentuknya harus sama persis dengan server.js. */
const bklKunciTgl = (unit, k, tanggal) => k.jenis === 'mingguan'
  ? `${unit}|${k.id}|${tanggal}`
  : `${unit}|${k.id}|${periodeKini(k.jenis)}`;
const bklSudahTgl = (unit, k, tanggal) => BKL.selesai[bklKunciTgl(unit, k, tanggal)] || null;
```

- [x] **Langkah 4: Kirim tanggalnya saat menandai**

Ganti tanda tangan dan isi `bklTandai`:

```js
async function bklTandai(unit, k, batal, tanggal){
  const kunci = bklKunciTgl(unit, k, tanggal);
  if(!SRV.aktif){
    if(batal) delete BKL.selesai[kunci];
    else BKL.selesai[kunci] = {
      oleh: akun ? akun.user : '—', nama: akun ? akun.nama : '—', jam: new Date().toISOString()
    };
    bklLokalSimpan();
    aktCatat('berkala', batal ? 'batal-selesai' : 'selesai', unit, k.nama);
    return;
  }
  const r = await srvFetch('/berkala/selesai', {
    method:'POST', headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ unit, id:k.id, batal: !!batal, tanggal })
  }, 10000);
  const j = await r.json().catch(()=>null);
  if(!r.ok) throw new Error((j && j.error) || ('server menjawab ' + r.status));
  if(batal) delete BKL.selesai[kunci];
  else BKL.selesai[kunci] = (j && j.selesai) || { oleh: akun.user, nama: akun.nama, jam:new Date().toISOString() };
}
```

- [x] **Langkah 5: Hitung jatuh tempo per kejadian**

Ganti isi perulangan di `bklJatuhTempo`:

```js
    (daftar || []).forEach(k=>{
      const kini = new Date(); kini.setHours(0,0,0,0);
      bklKejadian(k).forEach(j=>{
        const tanggal = bklTgl(j);
        if(bklSudahTgl(unit, k, tanggal)) return;
        keluar.push({ unit, k, tanggal, sisa: Math.round((j - kini) / 86400000) });
      });
    });
```

- [x] **Langkah 6: Kartu menampilkan tiap kejadian**

Dikerjakan dengan dua tambahan di luar cuplikan: nama hari hanya disebut kalau
kejadiannya lebih dari satu — pada kegiatan bulanan "Rabu ·" tidak menambah apa
pun — dan tanggal pengerjaan tetap ditampilkan pada baris yang sudah beres,
seperti sebelumnya. Tiga pembantu yang jadi tidak terpakai lagi dibuang:
`bklKunci`, `bklSudah`, dan `bklSisa`. Ketiganya mengunci model lama satu tanda
per periode; membiarkannya hidup mengundang orang memakainya kembali.

Di `bklIsi`, ganti blok `const kartu = daftar.map(k=>{ ... })` bagian kakinya:
alih-alih satu status dan satu tombol, gambar satu baris per kejadian.

```js
  const kartu = daftar.map(k=>{
    const kini = new Date(); kini.setHours(0,0,0,0);
    const kejadian = bklKejadian(k).map(j=>({
      tanggal: bklTgl(j),
      sisa: Math.round((j - kini) / 86400000),
      sudah: bklSudahTgl(unit, k, bklTgl(j))
    }));
    // Warna kartunya diambil dari kejadian paling mendesak yang belum beres.
    const belum = kejadian.filter(x=>!x.sudah).sort((a,b)=>a.sisa - b.sisa)[0];
    const rupa = !belum ? 'aman' : belum.sisa < 0 ? 'bahaya' : belum.sisa <= 1 ? 'awas' : '';
    return `<article class="bkl-kartu ${rupa}">
      <div class="bkl-atas">
        <span class="cip ${bklRupaJenis(k.jenis)}">${esc(bklJenisNama(k.jenis).toUpperCase())}</span>
        <span class="mono bkl-kapan">${esc(bklKapan(k))}</span>
      </div>
      <h4>${esc(k.nama)}</h4>
      ${k.ket ? `<p>${esc(k.ket)}</p>` : ''}
      ${kejadian.map(x=>`<div class="bkl-kaki">
        ${x.sudah
          ? `<span class="bkl-status aman">${esc(hariNama(new Date(x.tanggal + 'T00:00:00').getDay() || 7))}
              · ${T('sudah','done')} · ${esc(x.sudah.nama || x.sudah.oleh)}</span>`
          : `<span class="bkl-status ${x.sisa < 0 ? 'bahaya' : x.sisa <= 1 ? 'awas' : ''}">${
              esc(hariNama(new Date(x.tanggal + 'T00:00:00').getDay() || 7))} · ${
              x.sisa < 0 ? T(`lewat ${-x.sisa} hari`, `${-x.sisa} days overdue`)
              : x.sisa === 0 ? T('hari ini','today')
              : T(`${x.sisa} hari lagi`, `in ${x.sisa} days`)}</span>`}
        <button class="btn ${x.sudah ? 'garis ' : ''}kecil" data-bkl-tandai="${esc(k.id)}"
          data-tanggal="${esc(x.tanggal)}" data-batal="${x.sudah ? '1' : ''}">${x.sudah
            ? T('Batalkan','Undo') : T('Tandai selesai','Mark done')}</button>
      </div>`).join('')}
    </article>`;
  }).join('');
```

- [x] **Langkah 7: Teruskan tanggalnya dari tombol**

Di `bklPasang`, ganti pemanggilan `bklTandai` di penangan `[data-bkl-tandai]`:

```js
        await bklTandai(unit, k, !!b.dataset.batal, b.dataset.tanggal);
```

- [x] **Langkah 8: Periksa di peramban**

Muat ulang `http://localhost:3100`, buka Kegiatan Berkala pada unit yang tadi
diisi. Diharapkan: kegiatan mingguan tiga hari menampilkan tiga baris — Senin,
Rabu, Sabtu — masing-masing dengan tombolnya sendiri. Centang salah satu;
diharapkan hanya baris itu yang berubah jadi "sudah", dua lainnya tetap.

Periksa juga penolakan servernya bekerja:

```bash
curl -s -X POST http://localhost:3100/berkala/selesai -H 'Content-Type: application/json' -d '{"unit":"radtel","id":"k1","tanggal":"2020-01-01"}'
```

Diharapkan: pesan galat tentang minggu yang sedang berjalan (atau 401 kalau
dipanggil tanpa cookie sesi — jalankan dari konsol peramban supaya cookie ikut).

**Yang sudah diperiksa dan yang belum.** Masuk dengan akun sungguhan tidak
dilakukan, jadi pemeriksaannya lewat dua jalan lain.

Di peramban, dengan dashboard dinyalakan sendiri di port lain: `bklKejadian`
untuk kegiatan Senin/Rabu/Sabtu menjawab tiga tanggal yang benar; menandai satu
kejadian tidak menyentuh dua lainnya; kegiatan bulanan tetap berkunci periode
(`radtel|k2|2026-08`), bukan tanggal; kegiatan mingguan tanpa `hari` jatuh ke
Senin. `bklIsi` untuk satu unit berisi kegiatan mingguan tiga hari dan satu
kegiatan bulanan menggambar empat baris — "Senin · Sudah dikerjakan · …
Batalkan tanda", "Rabu · 2 hari lagi", "Sabtu · 5 hari lagi", dan satu baris
bulanan tanpa nama hari — masing-masing dengan `data-tanggal` sendiri. Tidak
ada galat di konsol maupun di log server.

`hariDaftar` dan `pekanIso` diuji terpisah, teksnya diambil apa adanya dari
`server.js`: sepuluh perkara lolos, termasuk hari berupa teks, hari di luar
1..7, dan 1 Januari 2027 yang masih terhitung pekan 53 tahun 2026.

Yang belum terbukti: penjagaan di dalam rute `/berkala/selesai` itu sendiri —
penolakan tanggal yang bukan hari terjadwal dan yang di luar minggu berjalan.
Tanpa sesi, permintaannya berhenti di 401 sebelum sampai ke sana. Perlu sekali
coba dengan akun sungguhan.

- [ ] **Langkah 9: Commit**

```bash
git add server.js public/index.html
git commit -m "Tanda selesai kegiatan mingguan dihitung per kejadian"
```

---

## Tugas 3 — DS Test: uji tegangan standby dan terpakai

**Berkas:**
- Ubah: `elogbook/db.js:176-187` (skema), `:255-257` (kolom susulan),
  `:1407-1458` (`rowToDsTest`, `insertDsTest`)
- Ubah: `elogbook/db-pg.js:98-113` (`KOLOM_SUSULAN`), `:1274-1327`
- Ubah: `elogbook/public/index.html:454-500` (modal DS Test)
- Ubah: `elogbook/public/js/17-ds-test.js` (`openDsModal`, `saveDs`,
  `openDsDetail`, `printDs`)
- Ubah: `elogbook/public/js/02-bahasa.js` (dua blok bahasa)

**Antarmuka:**
- Menghasilkan: catatan DS Test membawa `VoltStandby` dan `VoltPakai` (keduanya
  `string`), dan `mapDs` menyalinnya ke `voltStandby` / `voltPakai`.

- [ ] **Langkah 1: Tambahkan kolomnya di SQLite**

Di `elogbook/db.js`, tambahkan dua baris di dekat `tambahKolom('dstest', ...)`
yang sudah ada:

```js
/* Uji tegangan menyertai DS Test: berapa volt saat perangkat standby dan
   berapa saat dipakai. Disimpan sebagai teks, bukan angka — yang ditulis di
   lembar aslinya kadang "48,2" dan kadang "48.2 V", dan memaksanya jadi angka
   berarti membuang keterangan yang sengaja ditulis orangnya. */
tambahKolom('dstest', 'volt_standby', "TEXT NOT NULL DEFAULT ''");
tambahKolom('dstest', 'volt_pakai',   "TEXT NOT NULL DEFAULT ''");
```

Tambahkan juga kedua kolom itu ke `CREATE TABLE IF NOT EXISTS dstest (...)`
supaya pemasangan baru langsung punya, sesudah baris `state_json`:

```sql
  volt_standby      TEXT NOT NULL DEFAULT '',
  volt_pakai        TEXT NOT NULL DEFAULT '',
```

- [ ] **Langkah 2: Tambahkan kolom yang sama di Postgres**

Di `elogbook/db-pg.js`, tambahkan ke `KOLOM_SUSULAN`:

```js
  ['dstest', 'volt_standby', "TEXT NOT NULL DEFAULT ''"],
  ['dstest', 'volt_pakai',   "TEXT NOT NULL DEFAULT ''"],
```

- [ ] **Langkah 3: Bawa kolomnya keluar-masuk di kedua berkas db**

Di `elogbook/db.js` **dan** `elogbook/db-pg.js`, tambahkan ke `rowToDsTest`:

```js
  VoltStandby: r.volt_standby || '', VoltPakai: r.volt_pakai || '',
```

Di kedua `insertDsTest`, tambahkan ke objek `row`:

```js
    volt_standby: String(rec.voltStandby || '').trim().slice(0, 40),
    volt_pakai:   String(rec.voltPakai   || '').trim().slice(0, 40),
```

lalu masukkan keduanya ke daftar kolom dan nilai `INSERT`. Di SQLite tambahkan
`volt_standby, volt_pakai` sesudah `state_json` pada daftar kolom, dua `?` pada
`VALUES`, dan `row.volt_standby, row.volt_pakai` pada `.run(...)` di posisi yang
sama. Di Postgres lakukan hal yang sama, dan **nomori ulang** `$n` sesudahnya —
daftarnya jadi `$1..$15`.

- [ ] **Langkah 4: Periksa sintaks kedua berkas**

```bash
node --check elogbook/db.js && node --check elogbook/db-pg.js
```

Diharapkan: tidak ada keluaran.

- [ ] **Langkah 5: Tambahkan isiannya di modal**

Di `elogbook/public/index.html`, sesudah `<div class="dc-table-wrap">...</div>`
milik tabel DS dan sebelum `<div class="grid2" style="margin-top:14px;">`,
sisipkan:

```html
    <div class="grid2" style="margin-top:14px;">
      <div class="field"><label data-t="voltStandby">Tegangan saat standby (V)</label>
        <input type="text" id="dsVoltStandby" data-t-ph="phVolt" placeholder="mis. 48,2"></div>
      <div class="field"><label data-t="voltPakai">Tegangan saat dipakai (V)</label>
        <input type="text" id="dsVoltPakai" data-t-ph="phVolt" placeholder="mis. 47,6"></div>
    </div>
```

- [ ] **Langkah 6: Tambahkan labelnya di kedua bahasa**

Di `elogbook/public/js/02-bahasa.js`, di blok Indonesia dekat kunci `dsModal`:

```js
    voltStandby:'Tegangan saat standby (V)', voltPakai:'Tegangan saat dipakai (V)',
    phVolt:'mis. 48,2', teganganUji:'Uji tegangan',
    lgStandby:'standby', lgDipakai:'dipakai',
```

dan di blok Inggris, di tempat yang bersesuaian:

```js
    voltStandby:'Voltage on standby (V)', voltPakai:'Voltage in use (V)',
    phVolt:'e.g. 48.2', teganganUji:'Voltage test',
    lgStandby:'on standby', lgDipakai:'in use',
```

Kelimanya dipakai di Langkah 7 — `T()` mengembalikan kuncinya apa adanya kalau
terjemahannya tidak ada, jadi kunci yang terlewat akan tampil sebagai
`lgStandby` di layar, bukan gagal dengan bunyi.

- [ ] **Langkah 7: Kosongkan, simpan, dan tampilkan**

Di `elogbook/public/js/17-ds-test.js`:

Di `openDsModal`, sesudah baris `document.getElementById('dsManagerAkun').value = '';`

```js
  document.getElementById('dsVoltStandby').value = '';
  document.getElementById('dsVoltPakai').value = '';
```

Di `mapDs`, tambahkan sesudah `kategori:`:

```js
                      voltStandby:d.VoltStandby||'', voltPakai:d.VoltPakai||'',
```

Di `saveDs`, tambahkan ke objek yang dikirim `gsRun('addDsTest', {...})`:

```js
      voltStandby: document.getElementById('dsVoltStandby').value.trim(),
      voltPakai: document.getElementById('dsVoltPakai').value.trim(),
```

Di `openDsDetail`, sesudah baris tanggal dan sebelum `dsTabelBaca(...)`:

```js
    ${(d.voltStandby || d.voltPakai) ? `<div style="font-size:12.5px;margin-bottom:10px;color:var(--muted);">
      ${T('teganganUji')}: <b>${escapeHtml(d.voltStandby)||'-'}</b> V ${T('lgStandby')}
      &middot; <b>${escapeHtml(d.voltPakai)||'-'}</b> V ${T('lgDipakai')}</div>` : ''}
```

Di `printDs`, sesudah baris `TANGGAL :`:

```js
    ${(d.voltStandby || d.voltPakai) ? `<div style="text-align:center;font-size:9pt;margin-bottom:10px;">
      TEGANGAN — STANDBY : ${escapeHtml(d.voltStandby)||'-'} V &nbsp;&nbsp;
      DIPAKAI : ${escapeHtml(d.voltPakai)||'-'} V</div>` : ''}
```

- [ ] **Langkah 8: Jalankan dan periksa dari ujung ke ujung**

```bash
npm start
```

Buka `http://localhost:3000`, masuk, buka tab DS TEST → Form Baru. Diharapkan:
dua isian tegangan muncul di bawah tabel site. Isi keduanya, simpan, lalu buka
**Detail** catatan yang baru tersimpan — diharapkan angkanya tampil. Tekan cetak;
diharapkan barisnya ikut di kepala cetakan.

Periksa juga kolomnya benar-benar ada di basis data:

```bash
sqlite3 elogbook/data/elogbook.db "PRAGMA table_info(dstest);"
```

Diharapkan: daftar kolom memuat `volt_standby` dan `volt_pakai`. Kalau `sqlite3`
tidak terpasang, muat ulang halaman E-Logbook lalu buka lagi detail catatan yang
barusan disimpan — angkanya yang masih tampil sesudah muat ulang membuktikan ia
pulang dari basis data, bukan cuma bertahan di memori.

- [ ] **Langkah 9: Commit**

```bash
git add elogbook/db.js elogbook/db-pg.js elogbook/public/index.html elogbook/public/js/17-ds-test.js elogbook/public/js/02-bahasa.js
git commit -m "DS Test mencatat tegangan standby dan terpakai"
```

---

## Tugas 4 — Kegiatan berkala bersumber DS Test

**Berkas:**
- Ubah: `server.js:908-937` (`rapikanKegiatan` — tambah `sumber`)
- Ubah: `public/index.html:3634-3660` (`srvPasang`), berkala (kartu & editor)

**Antarmuka:**
- Mengonsumsi: `bklKejadian`, `bklTgl`, `bklSudahTgl` dari Tugas 1 dan 2.
- Menghasilkan: `DSTEST` — `{ [kodeUnit]: Set<'YYYY-MM-DD'> }`, dan
  `bklDariElogbook(unit, k, tanggal)` → `boolean`.

- [ ] **Langkah 1: Simpan `sumber` di server**

Di `server.js`, dalam objek yang dikembalikan `rapikanKegiatan`, tambahkan:

```js
    /* Kegiatan yang buktinya sudah ada di E-Logbook tidak perlu dicentang dua
       kali. Kosong berarti pekerjaan biasa yang ditandai tangan; 'dstest'
       berarti dashboard mencarikan buktinya sendiri. Daftarnya sengaja tertutup
       — sumber yang tidak dikenal diperlakukan sebagai kosong, bukan ditolak,
       supaya salinan halaman yang lebih baru tidak menjatuhkan penyimpanan. */
    sumber: k?.sumber === 'dstest' ? 'dstest' : '',
```

- [ ] **Langkah 2: Periksa sintaksnya**

```bash
node --check server.js
```

- [ ] **Langkah 3: Kumpulkan tanggal DS Test di dashboard**

Di `public/index.html`, di dekat `const LOGO = {};`, tambahkan:

```js
/* Tanggal DS Test yang sudah tercatat di E-Logbook, per unit. Dipakai kegiatan
   berkala bersumber 'dstest' untuk menandai dirinya sendiri selesai — buktinya
   sudah ada di sana, dan meminta orang mencentangnya lagi di sini cuma
   menghasilkan dua catatan tentang satu pekerjaan. */
const DSTEST = {};
```

Di dalam `srvPasang`, di dalam `Object.entries(paket).forEach(([kode, d])=>{`,
tambahkan:

```js
    DSTEST[kode] = new Set((d.dstest || [])
      .map(x=>String(x.Tanggal || '').slice(0,10)).filter(Boolean));
```

- [ ] **Langkah 4: Jawab "sudah ada buktinya?"**

Di dekat `bklSudahTgl`, tambahkan:

```js
/** Kegiatan bersumber E-Logbook yang buktinya sudah ada pada tanggal itu. */
const bklDariElogbook = (unit, k, tanggal) =>
  k.sumber === 'dstest' && !!(DSTEST[unit] && DSTEST[unit].has(tanggal));
```

- [ ] **Langkah 5: Gabungkan ke perhitungan kartu**

Di `bklIsi`, ganti perhitungan `kejadian` (dari Tugas 2) menjadi:

```js
    const kejadian = bklKejadian(k).map(j=>{
      const tanggal = bklTgl(j);
      const dari = bklDariElogbook(unit, k, tanggal);
      return {
        tanggal, dari,
        sisa: Math.round((j - kini) / 86400000),
        sudah: bklSudahTgl(unit, k, tanggal) || (dari ? { nama: 'E-Logbook' } : null)
      };
    });
```

Dan di baris kejadiannya, ganti tombolnya supaya yang berasal dari E-Logbook
tidak bisa dibatalkan tangan:

```js
        ${x.dari
          ? `<span class="cip aman">${T('dari E-Logbook','from E-Logbook')}</span>`
          : `<button class="btn ${x.sudah ? 'garis ' : ''}kecil" data-bkl-tandai="${esc(k.id)}"
              data-tanggal="${esc(x.tanggal)}" data-batal="${x.sudah ? '1' : ''}">${x.sudah
                ? T('Batalkan','Undo') : T('Tandai selesai','Mark done')}</button>`}
```

- [ ] **Langkah 6: Ikutkan di perhitungan jatuh tempo**

Di `bklJatuhTempo` (Tugas 2, Langkah 5), ganti barisnya:

```js
        if(bklSudahTgl(unit, k, tanggal) || bklDariElogbook(unit, k, tanggal)) return;
```

- [ ] **Langkah 7: Beri pemilih sumber di editor**

Di `bklIsi`, di dalam baris editor sesudah kotak Catatan, tambahkan:

```js
        <div class="isian" style="margin-bottom:0;min-width:150px">
          <label>${T('Buktinya dari','Evidence from')}</label>
          <select data-bkl="${i}" data-kolom="sumber">
            <option value=""${k.sumber ? '' : ' selected'}>${T('Dicentang tangan','Ticked by hand')}</option>
            <option value="dstest"${k.sumber === 'dstest' ? ' selected' : ''}>DS Test (E-Logbook)</option>
          </select></div>
```

Dan di penangan `#bklSimpan`, tambahkan ke objek yang dibersihkan:

```js
        sumber: k.sumber === 'dstest' ? 'dstest' : '',
```

- [ ] **Langkah 8: Periksa di peramban**

Muat ulang dashboard, buka Kegiatan Berkala unit radtel, **Atur kegiatan**, buat
satu kegiatan mingguan Senin/Rabu/Sabtu dengan **Buktinya dari: DS Test**.
Simpan. Lalu buka E-Logbook, simpan satu DS Test bertanggal hari ini. Kembali ke
dashboard dan muat ulang.

Diharapkan: baris kejadian hari ini berubah jadi "dari E-Logbook" tanpa
dicentang siapa pun, dan lencana jatuh tempo di subtab ikut berkurang satu.

- [ ] **Langkah 9: Commit**

```bash
git add server.js public/index.html
git commit -m "Kegiatan berkala bisa mengambil buktinya dari DS Test"
```

---

## Tugas 5 — Isi awal kegiatan radtel

**Berkas:**
- Ubah: `data/berkala.json`
- Ubah: `public/index.html:6252-6280` (`BERKALA_CONTOH`)

- [ ] **Langkah 1: Isi data sungguhannya**

Tulis `data/berkala.json`:

```json
{
  "radtel": [
    {
      "id": "dstest",
      "nama": "DS Test",
      "jenis": "mingguan",
      "hari": [1, 3, 6],
      "bulan": null,
      "tanggal": null,
      "alat": "",
      "ket": "Uji sambungan direct speech seluruh site, beserta tegangan standby dan terpakai. Diisi di E-Logbook — tandanya di sini ikut sendiri.",
      "sumber": "dstest"
    },
    {
      "id": "cwprestart",
      "nama": "Restart CWP",
      "jenis": "bulanan",
      "hari": null,
      "bulan": null,
      "tanggal": 5,
      "alat": "",
      "ket": "",
      "sumber": ""
    },
    {
      "id": "cwpbersih",
      "nama": "Bersihkan CWP",
      "jenis": "bulanan",
      "hari": null,
      "bulan": null,
      "tanggal": 5,
      "alat": "",
      "ket": "",
      "sumber": ""
    }
  ]
}
```

- [ ] **Langkah 2: Samakan data contohnya**

Di `public/index.html`, ganti isi `BERKALA_CONTOH.radtel` dengan ketiga kegiatan
yang sama (bentuk objek JavaScript, `hari:[1,3,6]`), supaya orang yang membuka
data contoh melihat bentuk yang sama dengan yang sungguhan. Kegiatan contoh
`radkom` dan `listrikmekanik` disesuaikan `hari`-nya jadi daftar:
`hari:[1]` dan `hari:[5]`.

- [ ] **Langkah 3: Periksa**

```bash
node -e "JSON.parse(require('node:fs').readFileSync('data/berkala.json','utf8'));console.log('sah')"
```

Diharapkan: `sah`.

Muat ulang dashboard, buka Database Unit → Radtel → Kegiatan Berkala.
Diharapkan: tiga kegiatan, DS Test dengan tiga baris hari, dua CWP bulanan.

- [ ] **Langkah 4: Commit**

```bash
git add data/berkala.json public/index.html
git commit -m "Kegiatan radtel: DS Test tiga hari sepekan, dua pekerjaan CWP bulanan"
```

---

## Tugas 6 — Pulang ke dashboard tanpa masuk lagi

**Berkas:**
- Ubah: `elogbook/public/js/26-init.js:73-90` (`pasangTautanDashboard`)
- Ubah: `public/index.html:4536` (pemanggilan awal), `:3262` (`pulihkanSesi`)

**Latar:** cookie sesinya sebenarnya sudah ikut — cookie tidak dibedakan menurut
port, jadi `localhost:3000` dan `localhost:3100` berbagi cookie yang sama, dan
`srvPeriksa()` memang sudah menemukan sesinya (`SRV.sesi` terisi). Yang berdiri
di jalan cuma kartu masuknya, yang tetap minta ditekan sekali.

- [ ] **Langkah 1: Beri penanda pada tautan pulang**

Di `elogbook/public/js/26-init.js`, di ujung `pasangTautanDashboard`, ganti
`a.href = alamat;` dengan:

```js
  /* #dashboard memberi tahu dashboard bahwa yang datang memang mau langsung
     masuk, bukan sedang membuka halamannya dari awal. Sesinya tetap yang
     memutuskan — penanda ini tidak memberi hak apa pun, cuma menghemat satu
     ketukan bagi orang yang cuma ingin melihat datanya. */
  a.href = alamat + '#dashboard';
```

- [ ] **Langkah 2: Masuk sendiri kalau sesinya hidup**

Di `public/index.html`, ganti baris `srvPeriksa().then(pulihkanSesi);` dengan:

```js
srvPeriksa().then(pulihkanSesi).then(masukLangsung);
```

Dan tambahkan fungsinya tepat di bawah `pulihkanSesi`:

```js
/**
 * Datang dari tautan "kembali ke Dashboard" di E-Logbook, dengan sesi yang
 * masih hidup: langsung masuk, tanpa kartu masuk sama sekali.
 *
 * Dijalankan sesudah pulihkanSesi(), bukan sebelumnya — kalau tab ini memang
 * punya sesi yang tersimpan, yang itu yang berlaku, dan fungsi ini tidak
 * punya apa-apa untuk dikerjakan.
 *
 * Yang menjaga pintu tetap cookie E-Logbook: tanpa SRV.sesi, penanda di alamat
 * tidak berarti apa-apa dan kartu masuknya tetap yang tampil.
 */
async function masukLangsung(){
  if(location.hash !== '#dashboard') return;
  if(akun) return;                       // pulihkanSesi() sudah menanganinya
  if(!SRV.ada || !SRV.sesi) return;
  // Penandanya dilepas supaya menyegarkan halaman tidak mengulang jalan pintas
  // ini diam-diam — sesudah masuk, yang berlaku sesi tab seperti biasa.
  history.replaceState(null, '', location.pathname + location.search);
  pilihTujuan('dashboard');
  try{
    await srvMuat();
    akun = akunDariServer(SRV.sesi);
    bukaDashboard();
  }catch(e){
    console.warn('Tidak bisa langsung masuk:', e && e.message || e);
    pilihTujuan(SRV.ada ? 'elogbook' : 'contoh');
  }
}
```

- [ ] **Langkah 3: Pastikan `akunDariServer` memang ada**

Cari fungsi yang merangkai objek `akun` dari `SRV.sesi` — kartu masuk sudah
melakukannya saat tombol "Lanjutkan sebagai …" ditekan:

```bash
grep -n "akunDariServer\|function akunDari" public/index.html
```

Kalau namanya berbeda, pakai nama yang ada. Kalau perangkaian itu tertanam di
dalam penangan tombol masuk dan belum berupa fungsi tersendiri, keluarkan
menjadi fungsi `akunDariServer(sesi)` lebih dulu dan panggil dari kedua tempat —
menyalin logikanya akan membuat dua jalan masuk yang lambat laun berbeda.

- [ ] **Langkah 4: Periksa dari ujung ke ujung**

```bash
npm start
```

Masuk ke E-Logbook di `http://localhost:3000`. Tekan tombol pulang ke Dashboard
Teknik di kepala halaman. Diharapkan: dashboard terbuka langsung di Beranda
dengan nama Anda di pojok kanan atas — tanpa kartu masuk sama sekali.

Lalu periksa penjagaannya masih berdiri: keluar dari E-Logbook, buka
`http://localhost:3100/#dashboard` langsung. Diharapkan: kartu masuk tetap
tampil, karena sesinya sudah mati.

- [ ] **Langkah 5: Commit**

```bash
git add elogbook/public/js/26-init.js public/index.html
git commit -m "Pulang dari E-Logbook langsung masuk dashboard"
```

---

## Tugas 7 — Daftar dinas hanya menampilkan yang diisi

**Berkas:**
- Ubah: `public/index.html:5295-5311` (`dinasHariIni`), `:3050-3055` (`dinasUnit`),
  `:4977-4987` (blok per unit di `gambarDinas`)

- [ ] **Langkah 1: Berhenti menyiapkan petak kosong**

Di `dinasHariIni`, ganti baris `const petak = (infoUnit(kode).dinas || []).map(k=>({ k, o:[] }));`
dengan:

```js
  /* Dulu seluruh kode dinas unit disiapkan lebih dulu sebagai petak kosong,
     jadi unit yang jadwalnya cuma diisi Malam tetap menampilkan Pagi dan Siang
     dengan tulisan "tidak ada personel". Yang begitu terbaca seperti kelalaian
     mengisi, padahal memang tidak ada dinasnya. Sekarang petaknya lahir dari
     yang benar-benar tertulis di jadwal. */
  const petak = [];
```

Dan supaya urutannya tetap mengikuti urutan kode unit (Pagi, Siang, Malam, PS)
alih-alih urutan orang di daftar, tambahkan sebelum `return petak;`:

```js
  const urut = infoUnit(kode).dinas || [];
  petak.sort((a,b)=>{
    const ia = urut.indexOf(a.k), ib = urut.indexOf(b.k);
    // Kode di luar daftar unit ditaruh di belakang, bukan dibuang — alasannya
    // sama dengan waktu ia diterima masuk beberapa baris di atas.
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
```

- [ ] **Langkah 2: Jangan mengarang petak kosong saat jadwalnya belum ada**

Di `dinasUnit`, ganti `const kosong = () => (infoUnit(kode).dinas || []).map(k=>({ k, o:[] }));`
dan barisnya di bawah dengan:

```js
  // Belum ada jadwal sama sekali: yang benar kosong, bukan empat kartu kosong.
  // Data contoh tetap punya isinya sendiri.
  return SRV.aktif ? [] : (DINAS[kode] || []);
```

- [ ] **Langkah 3: Beri kalimat untuk unit yang kosong**

Di `gambarDinas`, ganti isi `el('dinasPenuh').innerHTML = UNIT.map(u=>...)`
sehingga baris kartunya berbunyi:

```js
      <div class="dinas-baris">${
        dinasUnit(u.kode).length
          ? dinasUnit(u.kode).map(s=>kartuShift(s,u.kode)).join('')
          : `<div style="color:var(--muted);font-size:12.5px;padding:6px 2px">${
              T('Belum ada dinas yang diinput untuk unit ini hari ini.',
                'No shift has been entered for this unit today.')}</div>`}</div>`;
```

- [ ] **Langkah 4: Periksa di peramban**

Muat ulang dashboard, buka **Dinas Hari Ini**. Diharapkan: unit yang jadwal hari
ini hanya diisi Malam menampilkan satu kartu saja, bukan empat; unit yang belum
ada jadwalnya sama sekali menampilkan satu kalimat, bukan deretan kartu kosong.

Buka juga tabel Jadwal Dinas bulanan pada salah satu unit dan pastikan
pengisiannya tidak berubah — perubahan ini soal menampilkan, bukan menyimpan.

- [ ] **Langkah 5: Commit**

```bash
git add public/index.html
git commit -m "Daftar dinas hanya menampilkan shift yang memang diisi"
```

---

## Tugas 8 — Personel mengurus barisnya sendiri

**Berkas:**
- Ubah: `server.js:1138-1200` (`PUT /personel`)
- Ubah: `public/index.html` (subtab personel — penjagaan tombol)

**Latar:** `personel` sudah terbuka sampai `teknisi`, jadi menyunting baris di
unit sendiri sudah bisa. Yang ditutup di sini cuma sisanya: baris milik akun
sendiri harus bisa disunting pemiliknya walau perannya tidak diberi hak modul
itu, atau barisnya terdaftar di unit lain.

- [ ] **Langkah 1: Beri jalan untuk baris sendiri di server**

Di `server.js`, di dalam `app.put('/personel', ...)`, ganti penolakan haknya:

```js
  const bolehModul = await bolehIsi(user, 'personel');
```

dan hapus `return res.status(403)` yang lama, ganti dengan pemeriksaan yang
ditunda sampai sesudah daftar kirimannya dirapikan:

```js
  /* Data diri sendiri selalu boleh diurus pemiliknya. Nomor lisensi dan masa
     berlakunya adalah miliknya; yang paling tahu kapan berubah juga dia, dan
     menyuruhnya menunggu administrator untuk membetulkan tanggal di barisnya
     sendiri cuma membuat datanya basi. Yang dibuka SEBATAS barisnya: baris
     orang lain tetap lewat hak modul dan pagar unit seperti biasa. */
  const saya = String(user.username || '').toLowerCase();
  const milikSaya = (p) => String(p.username || '').toLowerCase() === saya && !!saya;
```

lalu, sesudah `daftar` dirapikan, tolak kalau ada yang di luar barisnya sendiri:

```js
  if (!bolehModul && daftar.some((p) => !milikSaya(p))) {
    return res.status(403).json({
      error: 'Peran akun Anda hanya diberi hak mengubah data personel atas nama Anda sendiri.'
    });
  }
```

Blok `if (punya !== null)` sudah punya penolong bernama `milikSaya` yang artinya
"milik wilayah unit saya" — namanya sekarang bertabrakan dengan `milikSaya` yang
baru diperkenalkan di atas ("baris atas nama saya"). Ganti nama yang lama jadi
`bolehSentuh`, dan sekalian masukkan baris sendiri ke dalamnya:

```js
    const bolehSentuh = (p) => wilayah.has(String(p.unit || '').toLowerCase()) || milikSaya(p);
```

Lalu pakai `bolehSentuh` di ketiga tempat `milikSaya` lama dipanggil di blok itu:
`dikirimSaya`, `hilang`, dan `unitLain`. Efeknya dua: baris atas nama sendiri
ikut lolos pagar unit walau terdaftar di unit lain, dan baris yang bukan
keduanya tetap diambil dari yang tersimpan alih-alih dari kiriman — jadi tidak
ada yang terhapus karena tidak ikut terkirim.

- [ ] **Langkah 2: Periksa sintaksnya**

```bash
node --check server.js
```

- [ ] **Langkah 3: Sebutkan haknya di jawaban `GET /personel`**

Di `app.get('/personel', ...)`, tambahkan ke objek jawabannya:

```js
    // Username akun ini, supaya halaman tahu baris mana yang boleh disunting
    // pemiliknya walau hak modulnya tidak diberikan.
    saya: user ? String(user.username || '').toLowerCase() : '',
```

- [ ] **Langkah 4: Buka tombolnya di halaman untuk baris sendiri**

Di `public/index.html`, di `psnMuat`, simpan `PSN.saya = j.saya || '';`. Lalu di
tempat tombol sunting digambar (`PSN.boleh ? ... : ''` di sekitar baris 6932),
ganti syaratnya menjadi:

```js
        ${(PSN.boleh || (PSN.saya && String(p.username||'').toLowerCase() === PSN.saya))
```

- [ ] **Langkah 5: Periksa dengan dua akun**

Jalankan, lalu masuk sebagai **teknisi** yang punya baris personel atas namanya.
Diharapkan: baris atas namanya bisa disunting dan tersimpan.

Lalu masuk sebagai akun yang perannya **tidak** diberi hak personel (cabut
centang `teknisi` untuk modul personel lewat Kelola Akun sebagai administrator
dulu). Diharapkan: hanya barisnya sendiri yang punya tombol sunting, dan mencoba
menyimpan baris orang lain ditolak server dengan pesan yang jelas.

- [ ] **Langkah 6: Verifikasi permintaan 6 — sparepart**

Tidak ada yang perlu diubah; ini pemeriksaan bahwa yang sudah ada memang jalan.
Masuk sebagai teknisi, buka Database Unit → unit yang dipegangnya → **Sparepart**.

Diharapkan: tombol **Tambah sparepart** tampil, barisnya bisa disunting dan
tersimpan, dan tombol hapus **tidak** tampil (menghapus memang hanya untuk
administrator dan admin unit). Buka unit yang **tidak** dipegangnya —
diharapkan tombolnya hilang.

Catat hasilnya. Kalau ternyata tombolnya tidak muncul untuk teknisi di unitnya
sendiri, berhenti dan laporkan — berarti ada yang salah di `bolehBuka` atau di
unit yang dikirim `/api/me`, dan itu perbaikan yang berbeda dari rencana ini.

- [ ] **Langkah 7: Commit**

```bash
git add server.js public/index.html
git commit -m "Tiap orang boleh mengurus baris personelnya sendiri"
```

---

## Tugas 9 — Nama unit bisa disunting

**Berkas:**
- Ubah: `server.js:411-452` (`MODUL_HAK`, `MODUL_PER_UNIT`, `HAK_BAWAAN`),
  tambah endpoint `/unitnama` di dekat `/unitdb`
- Buat: `data/unit-nama.json` (dibuat sendiri saat pertama disimpan)
- Ubah: `public/index.html:5021-5049` (`HAK_MODUL`, `HAK_NAMA`, `hakBawaan`),
  `:3570-3594` (`unitdbMuat`), `:7740-7752` (kepala unit)

**Antarmuka:**
- Menghasilkan: `GET /unitnama` → `{ nama: { [unit]: { nama, alat } } }`;
  `PUT /unitnama/:unit` menerima `{ nama, alat }`.
- Menghasilkan: `NAMA_UNIT` di peramban — `{ [unit]: { nama, alat } }`, dipakai
  `namaUnit()` dan kepala unit.

- [ ] **Langkah 1: Daftarkan modul haknya**

Di `server.js`:

```js
const MODUL_HAK = ['dinas', 'berkala', 'personel',
                   'peralatan', 'sparepart', 'dokumen', 'galeri', 'unit'];
```

```js
const MODUL_PER_UNIT = new Set(['dinas', 'berkala', 'peralatan', 'sparepart',
                                'dokumen', 'galeri', 'unit']);
```

Dan di `HAK_BAWAAN`, tambahkan:

```js
  /* Nama unit berhenti di pic: ia mengubah apa yang terbaca semua orang di
     kepala layar dan di seluruh daftar, jadi ia lebih dekat ke logo daripada
     ke sparepart. Tapi tidak sesempit logo — yang tahu unitnya berganti nama
     adalah orang unit itu, bukan administrator. */
  unit:      { peran: ['admin', 'adminunit', 'pic'],                   petugas: [] }
```

- [ ] **Langkah 2: Tambahkan endpointnya**

Di `server.js`, sesudah blok `/unitdb`, tambahkan:

```js
/* =====================================================================
   NAMA UNIT — sebutan yang dipakai di layar

   Nama dan baris peralatan tiap unit datang dari E-Logbook, dan di sana ia
   ikut daftar UNIT yang tidak bisa disunting dari mana pun kecuali kode.
   Yang disimpan di sini penimpanya: kalau ada, itu yang dipakai; kalau tidak,
   yang dari E-Logbook tetap berlaku. Bukan salinan — unit yang tidak pernah
   diganti namanya tidak punya baris di sini sama sekali.
   ===================================================================== */

const UNITNAMA_JSON = path.join(DATA_DIR, 'unit-nama.json');

app.get('/unitnama', async (_req, res) => {
  res.json({ nama: await bacaJson(UNITNAMA_JSON, {}) });
});

app.put('/unitnama/:unit', badanDinas, async (req, res) => {
  const unit = String(req.params.unit || '').toLowerCase();
  if (!unitSah(unit)) return res.status(400).json({ error: 'Kode unit tidak sah.' });
  if (!DINAS_TULIS) {
    return res.status(503).json({
      error: 'Nama unit tidak bisa disimpan di lingkungan ini: penyimpanannya tidak permanen.'
    });
  }

  const user = await siapa(req);
  if (!user) return res.status(401).json({ error: 'Masuk dengan akun E-Logbook Anda dulu.' });
  if (!(await bolehIsi(user, 'unit', unit))) {
    return res.status(403).json({
      error: bolehUnit(user, unit)
        ? 'Peran akun Anda tidak diberi hak mengubah nama unit.'
        : 'Akun Anda tidak memegang unit ini, jadi namanya tidak bisa Anda ubah.'
    });
  }

  const nama = String(req.body?.nama || '').trim().slice(0, 80);
  const alat = String(req.body?.alat || '').trim().slice(0, 200);

  try {
    const semua = await bacaJson(UNITNAMA_JSON, {});
    /* Dikosongkan berarti kembali ke sebutan dari E-Logbook, bukan unit tanpa
       nama. Barisnya dibuang supaya keadaan "tidak pernah diganti" dan
       "diganti jadi kosong" tidak jadi dua hal yang tampak sama tapi
       tersimpan berbeda. */
    if (nama || alat) semua[unit] = { nama, alat }; else delete semua[unit];
    await tulisJson(UNITNAMA_JSON, semua);
    await catat(user, { modul: 'unit', aksi: nama || alat ? 'ubah' : 'kosongkan', unit,
                        rincian: nama || '—' });
    res.json({ ok: true, nama, alat });
  } catch (e) {
    console.error('[unitnama] gagal menyimpan:', e);
    res.status(500).json({ error: 'Gagal menyimpan nama unit: ' + (e?.message || e) });
  }
});
```

- [ ] **Langkah 3: Periksa sintaksnya**

```bash
node --check server.js
```

- [ ] **Langkah 4: Daftarkan modulnya di halaman**

Di `public/index.html`:

```js
const HAK_MODUL = ['dinas','berkala','personel','peralatan','sparepart','dokumen','galeri','unit'];
```

Di `HAK_NAMA`, tambahkan `unit: ['Nama Unit','Unit Name']`.
Di `hakBawaan()`, tambahkan `unit: { peran:['admin','adminunit','pic'], petugas:[] }`.
Di `AKT_MODUL_NAMA` (sekitar baris 7277), tambahkan `unit: ['Nama unit','Unit name']`,
dan masukkan `'unit'` ke `AKT_SERVER`.

- [ ] **Langkah 5: Ambil penimpanya bersama database unit**

Di `unitdbMuat`, tambahkan di dekat pemuatan `LOGO`:

```js
    try{
      const rn = await srvFetch('/unitnama', {}, 8000);
      const jn = await rn.json().catch(()=>null);
      Object.keys(NAMA_UNIT).forEach(k=>delete NAMA_UNIT[k]);
      if(rn.ok && jn) Object.assign(NAMA_UNIT, jn.nama || {});
    }catch(e){ /* nama bawaan dari E-Logbook tetap berlaku */ }
```

Dan di dekat `const LOGO = {};`:

```js
/* Nama unit yang ditimpa dari dashboard ini. Kosong berarti pakai sebutan dari
   E-Logbook — lihat namaUnit() dan kepala layar unit. */
const NAMA_UNIT = {};
```

- [ ] **Langkah 6: Pakai penimpanya di seluruh layar**

Cari `namaUnit`:

```bash
grep -n "const namaUnit\|function namaUnit" public/index.html
```

Sisipkan penimpanya di awal fungsi itu:

```js
  const timpa = NAMA_UNIT[kode];
  if(timpa && timpa.nama) return timpa.nama;
```

- [ ] **Langkah 7: Buat kepala unit bisa disunting**

Di `public/index.html`, ganti blok `<div style="flex:1;min-width:200px">` di
dalam `.kepala-unit` menjadi:

```js
      <div style="flex:1;min-width:200px" id="kepalaUnitTeks">
        <h2>${esc((NAMA_UNIT[unitDibuka] && NAMA_UNIT[unitDibuka].nama) || u.nama)}</h2>
        <div class="sub">${esc((NAMA_UNIT[unitDibuka] && NAMA_UNIT[unitDibuka].alat) || u.alat)}</div>
        <div class="mono" style="font-size:10.5px;color:var(--muted);margin-top:5px">
          ${T('kode dinas','shift codes')} ${u.dinas.join(' · ')} · ${alat.length}
          ${T('peralatan terdaftar','equipment registered')}</div>
      </div>
      ${bolehSuntingDb('unit') ? `<button class="btn garis kecil" id="btnUbahNamaUnit">${
        T('Ubah nama','Rename')}</button>` : ''}
```

Lalu di `gambarUnit` (tempat penangan `.kepala-unit` dipasang), tambahkan:

```js
  const ubahNama = el('btnUbahNamaUnit');
  if(ubahNama) ubahNama.addEventListener('click', async ()=>{
    const kini = NAMA_UNIT[unitDibuka] || {};
    const u = infoUnit(unitDibuka);
    const nama = prompt(T('Nama unit yang tampil di layar:','Unit name shown on screen:'),
                        kini.nama || u.nama || '');
    if(nama === null) return;
    const alat = prompt(T('Baris peralatan di bawahnya:','The equipment line beneath it:'),
                        kini.alat || u.alat || '');
    if(alat === null) return;
    try{
      const r = await srvFetch('/unitnama/' + encodeURIComponent(unitDibuka), {
        method:'PUT', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ nama:nama.trim(), alat:alat.trim() })
      }, 10000);
      const j = await r.json().catch(()=>null);
      if(!r.ok) throw new Error((j && j.error) || ('server menjawab ' + r.status));
      if(nama.trim() || alat.trim()) NAMA_UNIT[unitDibuka] = { nama:nama.trim(), alat:alat.trim() };
      else delete NAMA_UNIT[unitDibuka];
      gambarSemua();
      pesan(T('Nama unit tersimpan.','Unit name saved.'));
    }catch(e){
      pesan(T('Gagal menyimpan: ','Could not save: ') + (e && e.message || e));
    }
  });
```

- [ ] **Langkah 8: Periksa di peramban**

Muat ulang dashboard, buka Database Unit → Radtel. Diharapkan: tombol **Ubah
nama** di kepala unit (untuk admin, admin unit, atau pic). Tekan, ganti namanya,
simpan. Diharapkan: judulnya berganti, dan sebutannya ikut berganti di papan
Trouble, Dinas Hari Ini, dan pemilih unit — karena semuanya lewat `namaUnit()`.

Periksa juga unit lain punya tombol yang sama (permintaannya "bukan radtel
doank"), dan bahwa mengosongkan namanya mengembalikan sebutan dari E-Logbook:

```bash
curl -s http://localhost:3100/unitnama
```

Diharapkan: hanya unit yang benar-benar diganti yang punya baris.

- [ ] **Langkah 9: Commit**

```bash
git add server.js public/index.html
git commit -m "Nama unit dan baris peralatannya bisa disunting per unit"
```

---

## Sesudah semuanya

- [ ] Perbarui `README.md`: modul hak bertambah satu (`unit`), kegiatan berkala
      sekarang berhari jamak dan tanda selesainya per kejadian, DS Test membawa
      tegangan.
- [ ] Perbarui `docs/RINGKASAN.md` kalau ia menyebut daftar modul hak.
- [ ] Jalankan sekali penuh dengan `npm start` dan telusuri ketujuh permintaan
      satu per satu memakai akun teknisi sungguhan, bukan administrator —
      administrator lolos semua pagar dan karena itu tidak membuktikan apa pun
      tentang hak.
