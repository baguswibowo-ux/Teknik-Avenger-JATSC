/**
 * Pembacaan PDF Izin Stasiun Radio (public/isr-pdf.mjs).
 *
 * Isian yang ditebak dari PDF langsung menentukan peringatan masa berlaku di
 * beranda dan lonceng, jadi tanggal dan nomornya tidak boleh bergeser tanpa
 * ketahuan. Datanya potongan teks (beserta posisinya) dari PDF ISR JATSC asli
 * — paragraf hukum dibuang dan nomor seri perangkat disamarkan — mewakili
 * cetakan SDPPI 2022–2024 dan DJID 2025, satu dan dua halaman, VHF, GP/DME,
 * dan radar.
 *
 * Jalankan dari akar aplikasi: node tools/uji-isr-pdf.mjs
 */
import fs from 'node:fs';
import { isrUraiPdf } from '../public/isr-pdf.mjs';

const data = JSON.parse(fs.readFileSync(new URL('./data-uji-isr-pdf.json', import.meta.url), 'utf8'));
const urai = (nama) => isrUraiPdf(
  data[nama].halaman.map(h=>h.map(([s,x,y,w])=>({ s, x, y, w }))), data[nama].judul);

let lulus = 0, gagal = 0;
const cek = (nama, dapat, harap) => {
  if (dapat === harap) lulus++;
  else { gagal++; console.log(`  GAGAL ${nama}\n    dapat "${dapat}"\n    harap "${harap}"`); }
};

// Cetakan SDPPI lama: satu perangkat VHF, dua kanal — jadi satu baris keterangan.
let r = urai('sdppi-2022-vhf-dua-kanal');
cek('2022 nama',   r.nama,   'SOETTA TOWER — VHF');
cek('2022 nomor',  r.nomor,  '283/DU/SDPPI/2022');
cek('2022 frek',   r.frek,   '118.2 MHz; 118.75 MHz');
cek('2022 mulai',  r.mulai,  '2022-12-12');
cek('2022 habis',  r.habis,  '2027-12-12');
cek('2022 kelas',  r.kelas,  'Darat-Udara (Ground to Air)');
cek('2022 lokasi', r.lokasi, "BANDARA SOEKARNO - HATTA GEDUNG 710, KOTA TANGERANG, BENDA, BANTEN · 6° 7' 57.3'' LS, 106° 38' 4.6'' BT");
cek('2022 ket',    r.ket,    'VHF SELEX OTE DTR100, SN X0001;X0002;X0003;X0004, 12 W, A3E, 118.2 MHz / 118.75 MHz');

// Cetakan DJID 2025: tanggal terpecah dua potongan ("05 Oktober" + "2030"),
// frekuensi ILS/DME tercetak mepet ke kolom emisi, tanda panggil beda dari nama.
r = urai('djid-2025-gp-dme');
cek('2025 nama',  r.nama,  'GP & T-DME 07R — TDME/ILS');
cek('2025 nomor', r.nomor, '2097/DU/DJID/2025');
cek('2025 frek',  r.frek,  '1003 MHz; 329.6 MHz');
cek('2025 mulai', r.mulai, '2025-10-06');
cek('2025 habis', r.habis, '2030-10-05');
cek('2025 ket',   r.ket,
  'Tanda panggil ICHR | TDME ILS SELEX TDME 1118 A, SN X0101 (D), 100 W, A3E, 1003 MHz | ILS ILS SELEX GP 2110, SN X0102 (REV D), 5 W, A3E, 329.6 MHz');

// Radar: tanpa kelas emisi, tipe perangkat turun dua baris.
r = urai('sdppi-2024-radar');
cek('radar nama', r.nama, 'RADAR CKG3 — MSSR');
cek('radar frek', r.frek, '1030 MHz; 1090 MHz');
cek('radar ket',  r.ket,  'MSSR Indra IRS20-MP/S 2 NA Integrator / Transmitter, SN X0005;X0006, 2500 W, 1030 MHz / 1090 MHz');
cek('radar lokasi awal', r.lokasi.startsWith('KANTOR PUSAT PERUM LPPNPI (AIRNAV) JL. IR. H JUANDA'), true);

// Dua halaman: "Page 1 of 2" tidak boleh ikut jadi nama perangkat; SN bersambung.
r = urai('sdppi-2023-dua-halaman');
cek('2hal nama',  r.nama,  'JAKARTA APPROACH — VHF');
cek('2hal frek',  r.frek,  '127.9 MHz; 119.75 MHz; 124.35 MHz; 125.45 MHz; 125.55 MHz');
cek('2hal habis', r.habis, '2028-07-09');
cek('2hal tanpa Page', /Page/i.test(r.ket), false);

// Nomor kanal berhuruf ("CH :71AA") bukan kelas emisi.
r = urai('sdppi-2024-kanal-berhuruf');
cek('kanal ket', r.ket.includes('A3E, 132.2 MHz / 125.75 MHz / 123.75 MHz / 124.15 MHz'), true);
cek('kanal tanpa AA', /A3E A/.test(r.ket), false);

// "SN." tanpa nomor: tetap di kolom Tipe, bukan jadi perangkat kedua.
r = urai('sdppi-2023-sn-kosong');
cek('sn kosong nama', r.nama, 'JAKARTA TOWER — VHF');
cek('sn kosong ket',  r.ket,  'VHF PAE T6T, 14 W, 0H00XXX, 119.3 MHz / 120.25 MHz');

// Bukan ISR / tanpa teks.
cek('kosong', isrUraiPdf([[]]), null);
cek('bukan isr', isrUraiPdf([[{ s: 'Berita Acara Pemeriksaan Barang', x: 50, y: 700, w: 200 }]]), null);

console.log(`${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
