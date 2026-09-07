@echo off
rem Menyalakan Avenger + E-Logbook sebagai proses latar (dipanggil Task
rem Scheduler saat Windows menyala, lihat pasang-jadwal.cmd). Sama dengan
rem `npm start`, tapi tanpa npm — akun SYSTEM belum tentu punya npm di PATH —
rem dan keluarannya ditulis ke server.log di akar aplikasi.
rem
rem Boleh dijalankan tangan juga: klik dua kali, jendelanya tetap terbuka.

cd /d "%~dp0.."

rem Dicari saat menyala, bukan saat dipasang: yang menjalankan ini SYSTEM, dan
rem PATH miliknya belum tentu sama dengan PATH orang yang memasang. Lihat
rem catatan di pasang-jadwal.cmd.
set "NODE="
for /f "delims=" %%p in ('where node 2^>nul') do if not defined NODE set "NODE=%%p"
if not defined NODE if exist "C:\Program Files\nodejs\node.exe" set "NODE=C:\Program Files\nodejs\node.exe"
if not defined NODE if exist "C:\Program Files (x86)\nodejs\node.exe" set "NODE=C:\Program Files (x86)\nodejs\node.exe"
if not defined NODE (
  echo [%date% %time%] server.cmd GAGAL: node.exe tidak ditemukan >> server.log
  exit /b 1
)

echo [%date% %time%] server.cmd menyalakan jalankan-semua.js >> server.log
"%NODE%" jalankan-semua.js >> server.log 2>&1
echo [%date% %time%] jalankan-semua.js berhenti (kode %errorlevel%) >> server.log
