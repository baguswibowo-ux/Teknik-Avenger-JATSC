@echo off
rem PASANG / LEPAS CLOUDFLARED SEBAGAI LAYANAN WINDOWS
rem
rem   tools\pasang-cloudflared.cmd          pasang layanan, nyalakan sekarang
rem   tools\pasang-cloudflared.cmd lepas    hentikan dan copot layanannya
rem
rem Jalankan dari Command Prompt yang dibuka "Run as administrator" —
rem memasang layanan Windows dan menulis ke profil SYSTEM sama-sama menolak
rem tanpa itu.
rem
rem Kenapa perlu jadi layanan: `cloudflared tunnel run` biasa mati begitu
rem jendelanya ditutup, kamu logout, atau Windows restart untuk update. Selama
rem masih begitu, PC ini melayani tapi belum bisa disebut server.
rem
rem JEBAKAN YANG DIURUS SKRIP INI. Layanannya berjalan sebagai SYSTEM, dan
rem cloudflared mencari config.yml di profil pengguna yang menjalankannya —
rem yaitu profil SYSTEM, bukan profilmu. Gejalanya menyesatkan: layanannya
rem "Running" dengan tenang, tapi situsnya tidak terbuka sama sekali, dan tidak
rem ada pesan galat di mana pun. Karena itu berkasnya disalin lebih dulu ke
rem   %SystemRoot%\System32\config\systemprofile\.cloudflared\
rem
rem Berkas kredensial <uuid>.json ITULAH tunnelnya. Menyalinnya ke komputer
rem lain berarti memindahkan tunnel yang sama, tanpa mengubah DNS lagi. Jaga
rem baik-baik; kalau bocor, cabut dengan menghapus tunnelnya di Cloudflare.

setlocal
cd /d "%~dp0.."

net session >nul 2>&1
if errorlevel 1 (
  echo GAGAL: buka Command Prompt dengan "Run as administrator".
  exit /b 1
)

rem cloudflared dipasang winget ke Program Files, tapi PATH belum tentu sudah
rem menyegarkan diri di jendela yang sedang terbuka. Karena itu dicari manual.
set "CF="
for /f "delims=" %%p in ('where cloudflared 2^>nul') do if not defined CF set "CF=%%p"
if not defined CF if exist "C:\Program Files (x86)\cloudflared\cloudflared.exe" set "CF=C:\Program Files (x86)\cloudflared\cloudflared.exe"
if not defined CF if exist "C:\Program Files\cloudflared\cloudflared.exe" set "CF=C:\Program Files\cloudflared\cloudflared.exe"
if not defined CF (
  echo GAGAL: cloudflared.exe tidak ditemukan.
  echo Pasang dulu:  winget install --id Cloudflare.cloudflared
  exit /b 1
)
echo cloudflared yang dipakai: %CF%

set "ASAL=%USERPROFILE%\.cloudflared"
set "TUJUAN=%SystemRoot%\System32\config\systemprofile\.cloudflared"

if /i "%~1"=="lepas" goto lepas

if not exist "%ASAL%\config.yml" (
  echo GAGAL: %ASAL%\config.yml tidak ada.
  echo Buat tunnelnya lebih dulu; lihat docs\PINDAH-KE-PC.md langkah 6.
  exit /b 1
)

rem Tunnel yang sedang jalan sebagai proses biasa dimatikan dulu. Kalau tidak,
rem dua instansi tunnel yang sama sama-sama tersambung dan Cloudflare membagi
rem permintaan ke keduanya — tidak rusak, tapi membingungkan waktu melacak
rem masalah karena log yang kamu baca belum tentu yang melayani.
echo Menghentikan cloudflared yang jalan sebagai proses biasa (kalau ada) ...
taskkill /IM cloudflared.exe /F >nul 2>&1

echo Menyalin konfigurasi ke profil SYSTEM ...
if not exist "%TUJUAN%" mkdir "%TUJUAN%" || goto gagal
copy /y "%ASAL%\config.yml" "%TUJUAN%\" >nul || goto gagal
copy /y "%ASAL%\*.json" "%TUJUAN%\" >nul || goto gagal
if exist "%ASAL%\cert.pem" copy /y "%ASAL%\cert.pem" "%TUJUAN%\" >nul

echo Memasang layanan ...
"%CF%" service install || goto gagal

rem JEBAKAN KEDUA, dan ini bawaan pemasangnya. "service install" mendaftarkan
rem layanan dengan BINARY_PATH_NAME berisi cloudflared.exe TANPA argumen apa
rem pun. Bentuk itu untuk tunnel yang dikelola lewat token dari dashboard; kalau
rem tunnelnya dikelola config.yml seperti di sini, Windows menjalankan exe
rem polos, yang cuma mencetak bantuan lalu keluar. Hasilnya layanan gagal start
rem dengan pesan yang tidak menyebut sebabnya sama sekali. Karena itu jalur
rem programnya ditulis ulang lengkap dengan --config dan "tunnel run".
echo Menambahkan argumen ke definisi layanan ...
sc config Cloudflared binPath= "\"%CF%\" --config \"%TUJUAN%\config.yml\" tunnel run avenger" || goto gagal
sc config Cloudflared start= auto >nul 2>&1
net start Cloudflared

echo.
sc query cloudflared | findstr /i "STATE"
echo.
echo Terpasang. Layanan menyala sendiri tiap Windows dinyalakan.
echo Cek dari luar:   curl -I https://pc.teknik-avengers.com
echo Lihat lognya:    Event Viewer ^> Windows Logs ^> Application
echo Copot lagi:      tools\pasang-cloudflared.cmd lepas
goto :eof

:lepas
echo Menghentikan dan mencopot layanan ...
net stop cloudflared >nul 2>&1
"%CF%" service uninstall
echo.
echo Layanan dicopot. Berkas di profil SYSTEM sengaja TIDAK dihapus — kalau
echo dipasang lagi nanti, konfigurasinya sudah di tempatnya. Hapus manual di
echo %TUJUAN% kalau memang mau bersih.
goto :eof

:gagal
echo.
echo GAGAL. Pastikan Command Prompt dibuka "Run as administrator".
exit /b 1
