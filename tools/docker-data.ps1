<#
  DATA UNTUK CONTAINER - mengisi volume Docker dari folder di mesin ini, atau
  mengeluarkannya kembali.
  ========================================================================

  Kenapa perlu skrip: database E-Logbook dan unggahan tidak tinggal di D:\
  lagi begitu aplikasi jalan di Docker, melainkan di volume Docker (lihat
  catatan di docker-compose.yml). Memindahkannya bukan sekadar copy: pemilik
  berkas harus uid 1000, karena di dalam container prosesnya jalan sebagai
  pengguna "node", bukan root.

  Cara pakai (PowerShell biasa, tidak perlu admin):

    Isi volume UJI dengan salinan data produksi (aman, produksi cuma dibaca):
      powershell -ExecutionPolicy Bypass -File "D:\Airnav\2026\Teknik JATSC Avenger\tools\docker-data.ps1" -Uji

    Isi volume PRODUKSI, saat mau benar-benar pindah ke Docker:
      powershell -ExecutionPolicy Bypass -File "D:\Airnav\2026\Teknik JATSC Avenger\tools\docker-data.ps1"

    Keluarkan isi volume ke folder biasa (memeriksa, atau balik ke cara lama):
      powershell -ExecutionPolicy Bypass -File "D:\Airnav\2026\Teknik JATSC Avenger\tools\docker-data.ps1" -Aksi keluarkan -Tujuan "D:\Airnav\2026\keluar-docker"

  PENTING: server harus MATI saat memuat data. Menyalin elogbook.db yang
  sedang dipakai bisa menghasilkan salinan setengah jadi. Skrip ini menolak
  jalan kalau containernya masih hidup, kecuali dipaksa dengan -Paksa.

  Skrip ini sengaja ASCII murni. PowerShell 5.1 membaca .ps1 tanpa BOM sebagai
  ANSI, dan satu tanda pisah panjang cukup untuk memutus string.
#>

param(
  [ValidateSet('muat','keluarkan')]
  [string]$Aksi = 'muat',
  [string]$Proyek = '',
  [switch]$Uji,
  [string]$Tujuan = '',
  [switch]$Paksa
)

$ErrorActionPreference = 'Continue'

$Akar = Split-Path -Parent $PSScriptRoot
if (-not $Proyek) {
  if ($Uji) { $Proyek = 'avenger-uji' } else { $Proyek = 'avenger' }
}

# Pasangan: folder di mesin ini <-> volume Docker. Nama volume dibentuk
# compose sebagai "<nama proyek>_<nama volume>".
$Pasangan = @(
  @{ nama = 'data';              host = (Join-Path $Akar 'data') },
  @{ nama = 'foto';              host = (Join-Path $Akar 'public\foto') },
  @{ nama = 'elogbook-data';     host = (Join-Path $Akar 'elogbook\data') },
  @{ nama = 'elogbook-uploads';  host = (Join-Path $Akar 'elogbook\uploads') }
)

function Ada-Docker {
  docker version --format '{{.Server.Version}}' 2>$null | Out-Null
  return ($LASTEXITCODE -eq 0)
}

if (-not (Ada-Docker)) {
  Write-Host "Docker tidak menyahut. Nyalakan Docker Desktop lebih dulu." -ForegroundColor Red
  exit 1
}

# Container yang masih hidup di proyek ini menahan berkas yang mau ditimpa.
$hidup = docker ps -q --filter "label=com.docker.compose.project=$Proyek"
if ($hidup -and -not $Paksa) {
  Write-Host "Container proyek '$Proyek' masih jalan." -ForegroundColor Yellow
  Write-Host "Matikan dulu:" -ForegroundColor Yellow
  if ($Proyek -eq 'avenger') {
    Write-Host "  docker compose down"
  } else {
    Write-Host "  docker compose -p $Proyek -f docker-compose.yml -f docker-compose.uji.yml down"
  }
  Write-Host "Atau ulangi dengan -Paksa kalau memang tahu risikonya."
  exit 1
}

Write-Host ""
Write-Host "Proyek : $Proyek"
Write-Host "Aksi   : $Aksi"
Write-Host ""

if ($Aksi -eq 'muat') {

  foreach ($p in $Pasangan) {
    $vol = "$($Proyek)_$($p.nama)"
    $sumber = $p.host
    if (-not (Test-Path $sumber)) {
      Write-Host "  lewat  $($p.nama): folder $sumber tidak ada" -ForegroundColor DarkGray
      continue
    }
    docker volume create $vol | Out-Null
    # rm dulu supaya sisa percobaan sebelumnya tidak bercampur dengan salinan
    # baru; chown 1000 supaya pengguna "node" di dalam container bisa menulis.
    docker run --rm -v "$($sumber):/sumber:ro" -v "$($vol):/tujuan" alpine:3 sh -c "rm -rf /tujuan/* /tujuan/.[!.]* 2>/dev/null; cp -a /sumber/. /tujuan/; chown -R 1000:1000 /tujuan"
    if ($LASTEXITCODE -eq 0) {
      Write-Host "  isi    $($p.nama)  <-  $sumber" -ForegroundColor Green
    } else {
      Write-Host "  GAGAL  $($p.nama)  <-  $sumber" -ForegroundColor Red
    }
  }

  if ($Uji) {
    # Kunci push produksi dibuang dari salinan uji. HP yang berlangganan di
    # produksi terikat kunci produksi dan tidak bisa dikirimi kunci lain -
    # server uji membuat kuncinya sendiri saat menyala.
    docker run --rm -v "$($Proyek)_elogbook-data:/d" alpine:3 sh -c "rm -f /d/push-vapid.json" | Out-Null
    Write-Host "  buang  push-vapid.json dari volume uji (notif produksi aman)" -ForegroundColor Green
  }

  Write-Host ""
  Write-Host "Selesai. Nyalakan:" -ForegroundColor Cyan
  if ($Proyek -eq 'avenger') {
    Write-Host "  docker compose up -d --build"
    Write-Host "  buka http://localhost:3100/"
  } else {
    Write-Host "  docker compose -p $Proyek -f docker-compose.yml -f docker-compose.uji.yml up -d --build"
    Write-Host "  buka http://localhost:3910/"
  }
  Write-Host ""

} else {

  if (-not $Tujuan) {
    Write-Host "Sebutkan -Tujuan, mis. -Tujuan `"D:\Airnav\2026\keluar-docker`"" -ForegroundColor Red
    exit 1
  }
  if (-not (Test-Path $Tujuan)) { New-Item -ItemType Directory -Path $Tujuan -Force | Out-Null }
  $Tujuan = (Resolve-Path $Tujuan).Path

  foreach ($p in $Pasangan) {
    $vol = "$($Proyek)_$($p.nama)"
    $ada = docker volume ls -q --filter "name=^$vol$"
    if (-not $ada) {
      Write-Host "  lewat  $($p.nama): volume $vol belum ada" -ForegroundColor DarkGray
      continue
    }
    $ke = Join-Path $Tujuan $p.nama
    if (-not (Test-Path $ke)) { New-Item -ItemType Directory -Path $ke -Force | Out-Null }
    docker run --rm -v "$($vol):/sumber:ro" -v "$($ke):/tujuan" alpine:3 sh -c "cp -a /sumber/. /tujuan/"
    if ($LASTEXITCODE -eq 0) {
      Write-Host "  keluar $($p.nama)  ->  $ke" -ForegroundColor Green
    } else {
      Write-Host "  GAGAL  $($p.nama)  ->  $ke" -ForegroundColor Red
    }
  }
  Write-Host ""
}
