@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Memasang dependensi...
  call npm install
)
if not exist elogbook\node_modules (
  echo Memasang dependensi E-Logbook...
  pushd elogbook
  call npm install
  popd
)
echo.
echo Buka di peramban       - http://localhost:3100/logbook/
echo Tekan Ctrl+C untuk menghentikan keduanya.
echo.
node jalankan-semua.js
pause
