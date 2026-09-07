@echo off
rem PASANG / LEPAS JADWAL WINDOWS UNTUK SERVER SENDIRI
rem
rem   tools\pasang-jadwal.cmd          pasang dua tugas Task Scheduler
rem   tools\pasang-jadwal.cmd lepas    hapus keduanya lagi
rem
rem Jalankan dari Command Prompt yang dibuka "Run as administrator" — schtasks
rem menolak membuat tugas berakun SYSTEM tanpa itu.
rem
rem Dua tugas yang dipasang (keduanya di folder "Avenger" di Task Scheduler):
rem   Avenger\Server            saat Windows menyala  → tools\server.cmd
rem   Avenger\Cadangan harian   tiap hari 02.00       → node tools\cadangkan.js
rem
rem Dipakai Task Scheduler, bukan NSSM: bawaan Windows, tidak perlu mengunduh
rem apa pun di jaringan kantor yang tertutup, dan hasilnya bisa dilihat/diubah
rem di Task Scheduler biasa. Kekurangannya: kalau prosesnya mati sendiri ia
rem tidak dinyalakan ulang otomatis sampai Windows dinyalakan ulang — untuk
rem itu ada tugas ketiga yang mengecek tiap 10 menit dan menyalakan kalau
rem port dashboard tidak ada yang mendengar.

setlocal
cd /d "%~dp0.."
set "AKAR=%CD%"

rem Node ditulis sebagai jalur lengkap di dalam definisi tugas, bukan "node".
rem Tugasnya berjalan sebagai SYSTEM, dan PATH milik SYSTEM tidak selalu memuat
rem folder nodejs — pemasang Node bisa menambahkannya ke PATH pengguna saja.
rem Kalau itu terjadi, tugasnya gagal seketika tanpa satu baris pun di
rem server.log maupun cadangkan.log, karena yang gagal adalah Windows waktu
rem mencari programnya, sebelum skrip kita sempat jalan. Di komputer ini
rem nodejs memang ada di PATH mesin, jadi "node" pun sebenarnya cukup; jalur
rem lengkap dipakai supaya pemasangan di komputer lain tidak bergantung nasib.
set "NODE="
for /f "delims=" %%p in ('where node 2^>nul') do if not defined NODE set "NODE=%%p"
if not defined NODE if exist "C:\Program Files\nodejs\node.exe" set "NODE=C:\Program Files\nodejs\node.exe"
if not defined NODE if exist "C:\Program Files (x86)\nodejs\node.exe" set "NODE=C:\Program Files (x86)\nodejs\node.exe"
if not defined NODE (
  echo GAGAL: node.exe tidak ditemukan. Pasang Node.js lebih dulu, atau sunting
  echo baris NODE= di berkas ini dengan jalur lengkap node.exe.
  exit /b 1
)
echo Node yang dipakai tugas: %NODE%

if /i "%~1"=="lepas" goto lepas

echo Memasang tugas untuk %AKAR% ...
schtasks /Create /F /RU SYSTEM /RL HIGHEST /SC ONSTART /TN "Avenger\Server" ^
  /TR "\"%AKAR%\tools\server.cmd\"" || goto gagal

schtasks /Create /F /RU SYSTEM /RL HIGHEST /SC MINUTE /MO 10 /TN "Avenger\Server (jaga)" ^
  /TR "\"%AKAR%\tools\jaga-server.cmd\"" || goto gagal

schtasks /Create /F /RU SYSTEM /RL HIGHEST /SC DAILY /ST 02:00 /TN "Avenger\Cadangan harian" ^
  /TR "\"%NODE%\" \"%AKAR%\tools\cadangkan.js\"" || goto gagal

echo.
echo Terpasang. Cek di Task Scheduler ^> Task Scheduler Library ^> Avenger.
echo Nyalakan servernya sekarang tanpa menunggu restart:
echo   schtasks /Run /TN "Avenger\Server"
echo Uji cadangannya sekarang:
echo   schtasks /Run /TN "Avenger\Cadangan harian"
goto :eof

:lepas
schtasks /Delete /F /TN "Avenger\Server"
schtasks /Delete /F /TN "Avenger\Server (jaga)"
schtasks /Delete /F /TN "Avenger\Cadangan harian"
echo Tugas dilepas. Proses server yang sedang jalan tidak dimatikan.
goto :eof

:gagal
echo.
echo GAGAL. Pastikan Command Prompt dibuka "Run as administrator".
exit /b 1
