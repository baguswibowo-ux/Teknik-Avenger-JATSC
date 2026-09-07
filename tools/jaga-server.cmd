@echo off
rem Dipanggil Task Scheduler tiap 10 menit (lihat pasang-jadwal.cmd): kalau
rem tidak ada yang mendengarkan di port dashboard, nyalakan server.cmd.
rem Kalau sudah ada, keluar diam-diam. Pengganti "restart otomatis" NSSM
rem dengan bawaan Windows saja.
rem
rem Port dibaca dari baris PORT= di .env kalau ada, bawaan 3100 seperti
rem jalankan-semua.js.

cd /d "%~dp0.."
set "PORT=3100"
if exist .env for /f "usebackq tokens=1,* delims==" %%a in (`findstr /b /c:"PORT=" .env`) do set "PORT=%%b"

netstat -ano | findstr /r /c:":%PORT% .*LISTENING" >nul
if not errorlevel 1 exit /b 0

echo [%date% %time%] jaga-server: port %PORT% kosong, menyalakan ulang >> server.log
call "%~dp0server.cmd"
