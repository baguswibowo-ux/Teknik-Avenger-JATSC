@echo off
cd /d "%~dp0"

REM Launcher ini sengaja cerewet. Versi sebelumnya langsung memanggil npm dan
REM node; kalau salah satunya tidak ada atau terlalu tua, jendelanya menutup
REM sebelum pesan salahnya sempat dibaca, dan yang tersisa cuma "kok tidak
REM bisa". Tiap syarat sekarang diperiksa lebih dulu, satu per satu, dengan
REM pesan yang menyebut apa yang kurang dan apa yang harus dilakukan.

echo ============================================================
echo   Teknik JATSC Avenger
echo ============================================================
echo.

REM --- 1. Berada di folder yang benar? -----------------------------------
REM cd /d "%~dp0" di atas sudah memastikan ini, tapi kalau berkasnya disalin
REM keluar dari folder proyek, package.json-lah yang hilang lebih dulu.
if not exist package.json (
  echo GAGAL: package.json tidak ada di folder ini.
  echo.
  echo   Folder sekarang: %CD%
  echo.
  echo   jalankan.cmd harus berada di dalam folder proyek, bersama
  echo   package.json dan server.js. Pindahkan berkas ini ke sana.
  echo.
  pause
  exit /b 1
)

REM --- 2. Node terpasang? ------------------------------------------------
where node >nul 2>&1
if errorlevel 1 (
  echo GAGAL: perintah "node" tidak dikenali.
  echo.
  echo   Node.js belum terpasang, atau belum masuk PATH.
  echo   Pasang Node.js 24 LTS dari https://nodejs.org lalu tutup dan
  echo   buka lagi jendela ini.
  echo.
  pause
  exit /b 1
)

REM --- 3. Node cukup baru? -----------------------------------------------
REM E-Logbook memakai SQLite bawaan Node (import dari 'node:sqlite' di
REM elogbook/db.js). Modul itu baru ada sejak Node 22.5. Di Node yang lebih
REM tua E-Logbook mati saat menyala, dan jalankan-semua.js sengaja ikut
REM mematikan dashboard-nya — jadi seluruh perintah gagal tanpa sebab yang
REM kelihatan. Lebih baik ketahuan di sini.
for /f "tokens=1 delims=." %%v in ('node -v') do set NODE_MAYOR=%%v
set NODE_MAYOR=%NODE_MAYOR:v=%
if %NODE_MAYOR% LSS 22 (
  echo GAGAL: Node terlalu tua.
  echo.
  node -v
  echo   Yang dibutuhkan: Node 22.5 ke atas ^(disarankan 24 LTS^).
  echo.
  echo   E-Logbook memakai SQLite bawaan Node, yang belum ada di versi ini.
  echo   Pasang Node 24 LTS dari https://nodejs.org lalu coba lagi.
  echo.
  pause
  exit /b 1
)

echo Node: 
node -v
echo.

REM --- 4. Dependensi terpasang? ------------------------------------------
if not exist node_modules (
  echo Memasang dependensi dashboard...
  call npm install
  if errorlevel 1 (
    echo.
    echo GAGAL: npm install untuk dashboard tidak selesai.
    echo   Periksa sambungan internet atau setelan proxy kantor,
    echo   lalu jalankan lagi berkas ini.
    echo.
    pause
    exit /b 1
  )
  echo.
)

if not exist elogbook\server.js (
  echo GAGAL: folder elogbook\ tidak ada di sini.
  echo.
  echo   Dashboard mengambil datanya dari E-Logbook. Salin E-LogBook-Server
  echo   ke %CD%\elogbook lebih dulu — lihat README.
  echo.
  echo   Kalau hanya ingin membuka dashboard-nya saja tanpa data E-Logbook,
  echo   jalankan: jalankan-dashboard-saja.cmd
  echo.
  pause
  exit /b 1
)

if not exist elogbook\node_modules (
  echo Memasang dependensi E-Logbook...
  pushd elogbook
  call npm install
  if errorlevel 1 (
    popd
    echo.
    echo GAGAL: npm install untuk E-Logbook tidak selesai.
    echo   Periksa sambungan internet atau setelan proxy kantor,
    echo   lalu jalankan lagi berkas ini.
    echo.
    pause
    exit /b 1
  )
  popd
  echo.
)

REM --- 5. Nyalakan -------------------------------------------------------
echo E-Logbook              - http://localhost:3000
echo Dashboard Fasilitas    - http://localhost:3100
echo Tekan Ctrl+C untuk menghentikan keduanya.
echo.
node jalankan-semua.js

echo.
echo Server berhenti.
pause
