@echo off
REM Jalankan server E-Logbook New JATSC.
REM Klik dua kali berkas ini, atau pakai sebagai Action di Task Scheduler
REM (isi "Start in" dengan folder berkas ini berada).

cd /d "%~dp0"

if not exist node_modules (
  echo Memasang dependensi untuk pertama kali...
  call npm install || goto :gagal
)

set PORT=3000
node server.js
goto :eof

:gagal
echo.
echo Gagal memasang dependensi. Pastikan Node.js sudah terpasang ^(node -v^).
pause
