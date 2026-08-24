@echo off
cd /d "%~dp0"

REM Dashboard saja, tanpa E-Logbook: hanya server.js di port 3100.
REM
REM Gunanya waktu E-Logbook tidak mau menyala — Node terlalu tua untuk
REM node:sqlite, port 3000 dipakai orang lain, atau folder elogbook\ memang
REM tidak ada. jalankan.cmd sengaja mematikan keduanya kalau salah satu
REM tumbang, jadi tanpa jalan pintas ini halaman dashboard ikut tidak
REM terbuka padahal ia sendiri tidak bermasalah.
REM
REM Yang hilang: semua data yang datang dari E-Logbook. Halamannya terbuka
REM dan bisa dilihat, bagian yang mengambil data dari sana akan kosong.

echo ============================================================
echo   Dashboard Fasilitas saja - http://localhost:3100
echo   (tanpa E-Logbook: data dari E-Logbook akan kosong)
echo ============================================================
echo.

if not exist package.json (
  echo GAGAL: package.json tidak ada di folder ini.
  echo   Folder sekarang: %CD%
  echo.
  pause
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  echo GAGAL: perintah "node" tidak dikenali.
  echo   Pasang Node.js 24 LTS dari https://nodejs.org lalu buka lagi.
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Memasang dependensi dashboard...
  call npm install
  if errorlevel 1 (
    echo.
    echo GAGAL: npm install tidak selesai.
    echo.
    pause
    exit /b 1
  )
  echo.
)

REM ELOGBOOK_MATI=1 memutus penerusan ke E-Logbook, jadi server.js tidak
REM menunggu jawaban dari port 3000 yang memang tidak ada isinya.
set ELOGBOOK_MATI=1

echo Tekan Ctrl+C untuk berhenti.
echo.
node server.js

echo.
echo Server berhenti.
pause
