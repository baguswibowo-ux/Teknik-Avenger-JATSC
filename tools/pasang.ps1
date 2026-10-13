<#
  pasang.ps1 - pasang satu cabang ke produksi, sekali perintah.

  PERINTAH TETAP (tidak pernah berubah):
      powershell -ExecutionPolicy Bypass -File "D:\Airnav\2026\Teknik JATSC Avenger\tools\pasang.ps1"

    Tanpa -Cabang, yang dipasang adalah cabang penunjuk 'siap-produksi'. Yang
    menyiapkan rilis (Claude) memindahkan penunjuk itu ke isi yang sudah diuji
    dan disetujui; Bagus cukup menjalankan perintah yang sama tiap kali.
    Perlu-tidaknya restart diputuskan sendiri dari berkas yang berubah.

  Cara lama tetap bisa:
      ... pasang.ps1 -Cabang fitur/nama-cabang
      ... pasang.ps1 -Cabang fitur/nama-cabang -TanpaRestart

  Yang dikerjakan, berurutan:
    1. Memastikan folder produksi tidak punya berkas kode yang sedang diubah.
    2. git merge --ff-only <cabang> - maju lurus saja. Kalau cabangnya tidak
       berangkat dari isi produksi sekarang, berhenti tanpa mengubah apa pun.
    3. Kalau perubahannya menyentuh kode server (atau menambah berkas js/css
       halaman, yang daftarnya dibaca server saat menyala): membuat
       restart.minta, yang dibaca tools\jaga-server.cmd - server dinyalakan
       ulang dalam 10 menit, tanpa perlu hak administrator. Kalau hanya berkas
       halaman yang sudah ada, dokumen, atau alat: tanpa restart.
       -Restart memaksa restart, -TanpaRestart memaksa tidak.

  Coba dulu di server uji (tools\uji.ps1) sebelum memakai skrip ini.

  Skrip ini sengaja ASCII murni. PowerShell 5.1 membaca .ps1 tanpa BOM
  sebagai ANSI, dan satu tanda pisah panjang cukup untuk memutus string.
#>

param(
  [string]$Cabang = 'siap-produksi',
  [switch]$TanpaRestart,
  [switch]$Restart
)

# Bukan 'Stop': git menulis keterangan biasa ke stderr, dan di PowerShell 5.1
# itu bisa terbaca sebagai galat. Keberhasilan git diperiksa lewat
# $LASTEXITCODE di tiap langkah.
$ErrorActionPreference = 'Continue'

$Produksi = 'D:\Airnav\2026\Teknik JATSC Avenger'

function Gagal([string]$pesan) {
  Write-Host ''
  Write-Host ('GAGAL: ' + $pesan) -ForegroundColor Red
  exit 1
}

git -C $Produksi rev-parse --verify --quiet "$Cabang^{commit}" | Out-Null
if ($LASTEXITCODE -ne 0) {
  if ($Cabang -eq 'siap-produksi') { Gagal "Belum ada yang disiapkan (cabang penunjuk 'siap-produksi' belum dibuat)." }
  Gagal "Cabang '$Cabang' tidak ditemukan."
}

# Berkas baru yang belum dilacak tidak menghalangi; yang dilacak dan berubah iya.
$kotor = git -C $Produksi status --porcelain --untracked-files=no
if ($kotor) {
  Gagal 'Folder produksi punya berkas kode yang sedang diubah. Bereskan dulu, baru pasang.'
}

$sebelum = (git -C $Produksi rev-parse --short HEAD)
Write-Host "Produksi sekarang: $(git -C $Produksi log --oneline -1)"

git -C $Produksi merge --ff-only $Cabang
if ($LASTEXITCODE -ne 0) {
  Gagal "Cabang '$Cabang' tidak bisa dipasang maju lurus. Tidak ada yang berubah."
}

$sesudah = (git -C $Produksi rev-parse --short HEAD)
if ($sebelum -eq $sesudah) {
  Write-Host ''
  if ($Cabang -eq 'siap-produksi') { Write-Host 'Tidak ada yang baru: produksi sudah berisi rilis terakhir yang disiapkan.' }
  else { Write-Host "Produksi sudah berisi '$Cabang'. Tidak ada yang dipasang." }
  exit 0
}

# Perlu restart? Ya kalau ada berkas di luar halaman/dokumen/alat yang berubah,
# atau ada berkas js/css halaman yang BARU (daftarnya dibaca server saat menyala).
$perluRestart = $false
$alasan = ''
foreach ($baris in (git -C $Produksi diff --name-status "$sebelum..$sesudah")) {
  $bagian = $baris -split "`t"
  $status = $bagian[0]
  $berkas = $bagian[$bagian.Length - 1]
  $halaman = ($berkas -like 'public/*') -or ($berkas -like 'elogbook/public/*')
  $bukanKode = ($berkas -like 'docs/*') -or ($berkas -like 'tools/*') -or ($berkas -like 'elogbook/tools/*') -or ($berkas -like '*.md')
  if ($halaman) {
    if (($status -ne 'M') -and (($berkas -like '*.js') -or ($berkas -like '*.css'))) { $perluRestart = $true; $alasan = $berkas; break }
  } elseif (-not $bukanKode) { $perluRestart = $true; $alasan = $berkas; break }
}
if ($Restart) { $perluRestart = $true; $alasan = 'diminta lewat -Restart' }
if ($TanpaRestart) { $perluRestart = $false }

Write-Host ''
Write-Host 'Yang baru terpasang:'
git -C $Produksi log --oneline "$sebelum..$sesudah"

Write-Host ''
if ($perluRestart) {
  New-Item -ItemType File -Force -Path (Join-Path $Produksi 'restart.minta') | Out-Null
  Write-Host "Terpasang. Perlu restart ($alasan) - restart.minta dibuat, server menyala ulang dalam 10 menit."
} elseif ($TanpaRestart) {
  Write-Host 'Terpasang TANPA restart (-TanpaRestart). Kalau ada perubahan kode server, itu belum berlaku.'
} else {
  Write-Host 'Terpasang. Hanya berkas halaman/dokumen/alat yang berubah - tidak perlu restart, cukup muat ulang halamannya.'
}
Write-Host "Kalau perlu mundur: git -C `"$Produksi`" reset --hard $sebelum"
