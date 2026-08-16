@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Memasang dependensi...
  call npm install
)
echo.
echo Dashboard Fasilitas Teknik JATSC - http://localhost:3100
echo Tekan Ctrl+C untuk berhenti.
echo.
node server.js
pause
