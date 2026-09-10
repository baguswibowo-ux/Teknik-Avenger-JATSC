@echo off
rem Dipanggil Task Scheduler tiap 10 menit (lihat pasang-jadwal.cmd): kalau
rem tidak ada yang mendengarkan di port dashboard, nyalakan server.cmd.
rem Kalau sudah ada, keluar diam-diam. Pengganti "restart otomatis" NSSM
rem dengan bawaan Windows saja.
rem
rem Port dibaca dari baris PORT= di .env kalau ada, bawaan 3100 seperti
rem jalankan-semua.js.
rem
rem RESTART TANPA ADMIN. Server berjalan sebagai SYSTEM, jadi akun biasa tidak
rem bisa mematikannya, dan UAC tidak terjangkau lewat AnyDesk yang tidak
rem terpasang sebagai service. Penjaga ini sudah SYSTEM, maka dialah yang
rem mengerjakannya: buat berkas kosong restart.minta di akar aplikasi
rem (New-Item restart.minta), dan dalam 10 menit server dimatikan lalu
rem dinyalakan ulang lewat tugas "Avenger\Server" - .env ikut terbaca ulang.
rem Berkasnya dihapus LEBIH DULU, supaya kegagalan di tengah jalan tidak
rem berubah jadi restart berulang tiap 10 menit.

cd /d "%~dp0.."
set "PORT=3100"
set "PORT_ELOG=3000"
if exist .env for /f "usebackq tokens=1,* delims==" %%a in (`findstr /b /c:"PORT=" .env`) do set "PORT=%%b"
if exist .env for /f "usebackq tokens=1,* delims==" %%a in (`findstr /b /c:"ELOGBOOK_PORT=" .env`) do set "PORT_ELOG=%%b"

if exist restart.minta goto restart

netstat -ano | findstr /r /c:":%PORT% .*LISTENING" >nul
if not errorlevel 1 exit /b 0

echo [%date% %time%] jaga-server: port %PORT% kosong, menyalakan ulang >> server.log
call "%~dp0server.cmd"
exit /b

:restart
del /f /q restart.minta
rem Yang dimatikan hanya pemilik dua port aplikasi ini (dashboard dan
rem e-logbook), dicari lewat netstat - bukan "taskkill /im node.exe" yang ikut
rem membunuh node lain di mesin ini. Induknya, jalankan-semua.js, tidak perlu
rem disentuh: begitu satu anaknya mati ia mematikan sisanya lalu keluar
rem sendiri, dan server.cmd yang menunggunya ikut selesai.
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:":%PORT% .*LISTENING"') do taskkill /f /pid %%p >nul 2>&1
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:":%PORT_ELOG% .*LISTENING"') do taskkill /f /pid %%p >nul 2>&1
rem Jeda sampai server.cmd yang lama selesai dan melepas server.log - selama
rem ia hidup, berkas itu terkunci dan echo di bawah akan gagal. ping dipakai
rem sebagai jeda karena timeout menolak jalan tanpa konsol (Task Scheduler).
ping -n 6 127.0.0.1 >nul
echo [%date% %time%] jaga-server: restart.minta ditemukan, server dinyalakan ulang >> server.log
schtasks /Run /TN "Avenger\Server" >nul 2>&1
if errorlevel 1 call "%~dp0server.cmd"
exit /b 0
