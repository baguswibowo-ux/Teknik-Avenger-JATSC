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
echo E-Logbook              - http://localhost:3000
echo Dashboard Fasilitas    - http://localhost:3100
echo Tekan Ctrl+C untuk menghentikan keduanya.
echo.
node jalankan-semua.js
pause
