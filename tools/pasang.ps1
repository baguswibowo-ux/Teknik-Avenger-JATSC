<#
  pasang.ps1 - pasang satu cabang ke produksi, sekali perintah.

  Pakai:
      powershell -ExecutionPolicy Bypass -File "D:\Airnav\2026\Teknik JATSC Avenger\tools\pasang.ps1" -Cabang fitur/nama-cabang

    Tanpa restart (perubahan yang cuma menyentuh berkas halaman):
      powershell -ExecutionPolicy Bypass -File "D:\Airnav\2026\Teknik JATSC Avenger\tools\pasang.ps1" -Cabang fitur/nama-cabang -TanpaRestart

  Yang dikerjakan, berurutan:
    1. Memastikan folder produksi tidak punya berkas kode yang sedang diubah.
    2. git merge --ff-only <cabang> - maju lurus saja. Kalau cabangnya tidak
       berangkat dari isi produksi sekarang, berhenti tanpa mengubah apa pun.
    3. Membuat restart.minta, yang dibaca tools\jaga-server.cmd: server
       dinyalakan ulang dalam 10 menit, tanpa perlu hak administrator.

  Coba dulu di server uji (tools\uji.ps1) sebelum memakai skrip ini.

  Skrip ini sengaja ASCII murni. PowerShell 5.1 membaca .ps1 tanpa BOM
  sebagai ANSI, dan satu tanda pisah panjang cukup untuk memutus string.
#>

param(
  [Parameter(Mandatory = $true)][string]$Cabang,
  [switch]$TanpaRestart
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
if ($LASTEXITCODE -ne 0) { Gagal "Cabang '$Cabang' tidak ditemukan." }

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
  Write-Host "Produksi sudah berisi '$Cabang'. Tidak ada yang dipasang."
  exit 0
}

Write-Host ''
Write-Host 'Yang baru terpasang:'
git -C $Produksi log --oneline "$sebelum..$sesudah"

if ($TanpaRestart) {
  Write-Host ''
  Write-Host 'Terpasang TANPA restart (-TanpaRestart). Perubahan kode server belum berlaku.'
} else {
  New-Item -ItemType File -Force -Path (Join-Path $Produksi 'restart.minta') | Out-Null
  Write-Host ''
  Write-Host 'Terpasang. restart.minta dibuat - server menyala ulang dalam 10 menit.'
}
Write-Host "Kalau perlu mundur: git -C `"$Produksi`" reset --hard $sebelum"
