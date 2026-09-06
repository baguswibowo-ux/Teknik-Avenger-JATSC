@echo off
cd /d "%~dp0"
rem Tarik kode terbaru dari GitHub ke salinan di komputer ini (PC kantor,
rem laptop, dsb.). Hanya maju-lurus (--ff-only): kalau di sini ada perubahan
rem yang belum di-commit atau riwayatnya bercabang, skrip berhenti dan
rem memberi tahu - tidak pernah menimpa pekerjaan lokal diam-diam.
rem Data (elogbook\data\*.db) tidak ikut git, jadi tidak tersentuh.

git rev-parse --is-inside-work-tree >nul 2>&1 || (
  echo Folder ini bukan salinan git. Clone dulu:
  echo   git clone https://github.com/baguswibowo-ux/Teknik-Avenger-JATSC.git
  pause & exit /b 1
)

for /f "delims=" %%b in ('git branch --show-current') do set CABANG=%%b
echo Cabang: %CABANG%

git diff --quiet && git diff --cached --quiet || (
  echo.
  echo Ada perubahan lokal yang belum di-commit - tarik dibatalkan supaya tidak
  echo tertimpa. Commit atau simpan dulu ^(git stash^), lalu jalankan lagi.
  git status --short
  pause & exit /b 1
)

echo Mengambil dari GitHub...
git pull --ff-only origin %CABANG% || (
  echo.
  echo Tarik gagal - biasanya riwayat bercabang atau belum login GitHub.
  pause & exit /b 1
)

echo.
echo Sudah terbaru:
git log --oneline -1
echo.
echo Kalau yang berubah menyentuh db.js / server.js, jalankan ulang jalankan.cmd.
pause
