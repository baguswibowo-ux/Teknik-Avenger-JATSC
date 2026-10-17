/* Uji pengurai teks sertifikat pelatihan (public/pelatihan-pdf.mjs).
   Jalankan: node tools/uji-pelatihan-pdf.mjs
   Contoh-contoh di sini tiruan bentuk sertifikat yang lazim — tambahkan
   teks dari PDF asli begitu ada, supaya pengurainya tidak mundur. */

import { uraiSertifikat } from '../public/pelatihan-pdf.mjs';

const kasus = [
  {
    nama: 'Indonesia, rentang satu bulan, kota+tanggal',
    orang: 'Bagus Wibowo',
    teks: `PERUM LPPNPI
SERTIFIKAT
Nomor: 123/PLT/AIRNAV/X/2026
Diberikan kepada
BAGUS WIBOWO
Telah mengikuti
Pelatihan Refreshment ATSEP Radar
yang diselenggarakan oleh AirNav Indonesia Training Center
pada tanggal 1 - 3 Oktober 2026
Tangerang, 3 Oktober 2026
General Manager`,
    harap: { nomor:'123/PLT/AIRNAV/X/2026', nama:'Pelatihan Refreshment ATSEP Radar',
             tempat:'AirNav Indonesia Training Center', mulai:'2026-10-01', selesai:'2026-10-03',
             tglSert:'2026-10-03', kategori:'CONTINUATION' }, cocokNama:true
  },
  {
    nama: 'Inggris, rentang lintas bulan',
    orang: 'Bagus Wibowo',
    teks: `CERTIFICATE OF COMPLETION
Certificate No. THL-2026-0457
This is to certify that
Bagus Wibowo
has successfully completed
Advanced Course on ADS-B Ground Station Maintenance
conducted by Thales Air Systems
from 28 September to 2 October 2026
Jakarta, October 2, 2026`,
    harap: { nomor:'THL-2026-0457', nama:'Advanced Course on ADS-B Ground Station Maintenance',
             tempat:'Thales Air Systems', mulai:'2026-09-28', selesai:'2026-10-02',
             tglSert:'2026-10-02', kategori:'ADVANCED' }, cocokNama:true
  },
  {
    nama: 'Webinar satu hari, tanggal angka, tanpa label nomor',
    orang: 'Rika Pratiwi',
    teks: `E-SERTIFIKAT
SRT/045/WEB/VI/2026
Diberikan kepada BUDI SANTOSO
sebagai Peserta dalam
Webinar Keselamatan Penerbangan 2026
Diselenggarakan oleh Direktorat Navigasi Penerbangan
pada 12/06/2026`,
    harap: { nomor:'SRT/045/WEB/VI/2026', nama:'Webinar Keselamatan Penerbangan 2026',
             tempat:'Direktorat Navigasi Penerbangan', mulai:'2026-06-12', selesai:'2026-06-12',
             tglSert:'2026-06-12', kategori:'SEMINAR' }, cocokNama:false
  },
  {
    nama: 'Workshop, s.d., singkatan bulan',
    orang: 'Bagus',
    teks: `PIAGAM PENGHARGAAN
No : 07/WS/DNP/2026
Bagus Wibowo
atas partisipasinya sebagai peserta
Workshop Pemeliharaan VOR/DME
bertempat di Surabaya
tanggal 14 s.d. 16 Okt 2026
Surabaya, 16 Oktober 2026`,
    harap: { nomor:'07/WS/DNP/2026', nama:'Workshop Pemeliharaan VOR/DME', tempat:'Surabaya',
             mulai:'2026-10-14', selesai:'2026-10-16', tglSert:'2026-10-16', kategori:'WORKSHOP' }, cocokNama:true
  },
  {
    nama: 'Penyelenggara "Pusat Pengembangan" tidak membuat kategori DEVELOPMENTAL',
    orang: 'Bagus Wibowo',
    teks: `PERUM LPPNPI
SERTIFIKAT
Nomor: 088/DIKLAT/JATSC/IX/2026
Diberikan kepada
BAGUS WIBOWO
Telah mengikuti
Pelatihan Pemeliharaan Peralatan RADAR MSSR Mode S
yang diselenggarakan oleh Pusat Pengembangan SDM AirNav
pada tanggal 22 s.d. 26 September 2026
Tangerang, 26 September 2026`,
    harap: { nomor:'088/DIKLAT/JATSC/IX/2026', nama:'Pelatihan Pemeliharaan Peralatan RADAR MSSR Mode S',
             tempat:'Pusat Pengembangan SDM AirNav', mulai:'2026-09-22', selesai:'2026-09-26',
             tglSert:'2026-09-26', kategori:'' }, cocokNama:true
  },
  {
    nama: 'Teks kosong (PDF pindaian tanpa OCR)',
    orang: 'Bagus',
    teks: '',
    harap: { nomor:'', nama:'', tempat:'', mulai:'', selesai:'', tglSert:'', kategori:'' }, cocokNama:null
  }
];

let gagal = 0;
for(const k of kasus){
  const { isi, cocokNama } = uraiSertifikat(k.teks, k.orang);
  const salah = Object.entries(k.harap).filter(([kunci, v]) => isi[kunci] !== v)
    .map(([kunci, v]) => `    ${kunci}: dapat ${JSON.stringify(isi[kunci])}, harap ${JSON.stringify(v)}`);
  if(cocokNama !== k.cocokNama) salah.push(`    cocokNama: dapat ${cocokNama}, harap ${k.cocokNama}`);
  if(salah.length){ gagal++; console.log(`GAGAL  ${k.nama}\n${salah.join('\n')}`); }
  else console.log(`lolos  ${k.nama}`);
}
console.log(gagal ? `\n${gagal} dari ${kasus.length} gagal` : `\nSemua ${kasus.length} lolos`);
process.exit(gagal ? 1 : 0);
