<#
  SERVER UJI - salinan terpisah dari produksi
  ===========================================

  Menyalakan dashboard + E-Logbook dari cabang yang mau dicoba, dengan DATA
  SALINAN, di port yang berbeda dari produksi. Apa pun yang diubah, diisi,
  diunggah, atau dihapus di server uji TIDAK PERNAH sampai ke produksi.

  Cara pakai (dari PowerShell biasa, tidak perlu admin):

    Coba cabang tertentu, data disalin baru dari produksi:
      powershell -ExecutionPolicy Bypass -File "D:\Airnav\2026\Teknik JATSC Avenger\tools\uji.ps1" -Cabang perbaikan/tautan-sekali-pakai

    Nyalakan ulang tanpa menimpa data uji (hasil coba-coba tadi tetap ada):
      powershell -ExecutionPolicy Bypass -File "D:\Airnav\2026\Teknik JATSC Avenger\tools\uji.ps1" -Cabang perbaikan/tautan-sekali-pakai -TanpaSalinData

    Matikan server uji:
      powershell -ExecutionPolicy Bypass -File "D:\Airnav\2026\Teknik JATSC Avenger\tools\uji.ps1" -Matikan

  Buka di: https://uji.teknik-avengers.com  (atau http://localhost:3910)
  Akun uji di data salinan: uji.teknisi / uji1234

  KENAPA PRODUKSI AMAN - lima pagar, semuanya diperiksa di bawah:
    1. KODE   : folder terpisah (worktree git), bukan folder produksi.
                Folder produksi tidak pernah di-checkout ke cabang lain -
                folder itu yang disajikan teknik-avengers.com.
    2. DATA   : DISALIN dari produksi ke folder uji, tidak disambung.
                Arah salin hanya produksi -> uji, tidak pernah sebaliknya.
    3. LOKASI : ELOGBOOK_DATA_DIR dan ELOGBOOK_UPLOAD_DIR disetel ke folder
                uji secara eksplisit, dan ELOGBOOK_DB dikosongkan, supaya
                tidak ada setelan yang bisa membelokkan ke data produksi.
    4. PORT   : 3900 (E-Logbook) dan 3910 (dashboard). Produksi 3000/3100
                tidak disentuh, termasuk waktu mematikan.
    5. NOTIF  : token Telegram dikosongkan dan folder uji tidak punya .env,
                jadi uji tidak mengirim pesan ke grup sungguhan.
                Notifikasi HP: kunci push-vapid.json dari produksi DIHAPUS
                dari salinan, jadi server uji membuat kuncinya sendiri. HP
                yang berlangganan di produksi terikat kunci produksi dan
                tidak bisa dikirimi oleh kunci lain - hanya HP yang menekan
                Aktifkan di uji.teknik-avengers.com yang menerima notif uji.
                Sesudah data disalin ulang, HP uji perlu menekan Aktifkan lagi.

  Skrip ini sengaja ASCII murni. PowerShell 5.1 membaca .ps1 tanpa BOM
  sebagai ANSI, dan satu tanda pisah panjang cukup untuk memutus string.
#>

param(
  [string]$Cabang = 'utama',
  [switch]$TanpaSalinData,
  [switch]$Matikan
)

# Bukan 'Stop': git menulis keterangan biasa ke stderr, dan di PowerShell 5.1
# itu bisa terbaca sebagai galat. Keberhasilan git diperiksa lewat
# $LASTEXITCODE di tiap langkah.
$ErrorActionPreference = 'Continue'

$Produksi = 'D:\Airnav\2026\Teknik JATSC Avenger'
$Uji      = 'D:\Airnav\2026\server-uji'
$PortElog = 3900
$PortDash = 3910
$Alamat   = 'https://uji.teknik-avengers.com'

function Gagal([string]$pesan) {
  Write-Host ''
  Write-Host ('GAGAL: ' + $pesan) -ForegroundColor Red
  exit 1
}

function Matikan-Port([int]$port) {
  $pemegang = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
              Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($p in $pemegang) {
    try {
      Stop-Process -Id $p -Force -ErrorAction Stop
      Write-Host ("  port {0}: proses {1} dimatikan" -f $port, $p)
    } catch {
      Write-Host ("  port {0}: proses {1} tidak bisa dimatikan dari akun ini." -f $port, $p) -ForegroundColor Yellow
      Write-Host  "  Kemungkinan dinyalakan dari PowerShell admin. Buat berkas matikan-uji.minta"
      Write-Host  "  di folder produksi, tunggu paling lama 10 menit, lalu jalankan skrip ini lagi."
    }
  }
}

# ---------------------------------------------------------------- pagar dasar

if (-not (Test-Path (Join-Path $Produksi 'elogbook\data\elogbook.db'))) {
  Gagal "Folder produksi tidak ditemukan di $Produksi. Kalau foldernya pindah, ubah `$Produksi di awal skrip ini."
}
if ((Resolve-Path $Produksi).Path.TrimEnd('\') -ieq $Uji.TrimEnd('\')) {
  Gagal 'Folder uji sama dengan folder produksi. Skrip dihentikan sebelum menyentuh apa pun.'
}

# ---------------------------------------------------------------- matikan

Write-Host ''
Write-Host "Mematikan server uji lama (port $PortElog dan $PortDash saja)..."
Matikan-Port $PortElog
Matikan-Port $PortDash

if ($Matikan) {
  Write-Host ''
  Write-Host 'Server uji dimatikan. Produksi tidak disentuh.' -ForegroundColor Green
  exit 0
}

# ---------------------------------------------------------------- kode

Write-Host ''
Write-Host "Menyiapkan kode cabang '$Cabang' di $Uji ..."

git -C $Produksi rev-parse --verify --quiet "$Cabang^{commit}" | Out-Null
if ($LASTEXITCODE -ne 0) { Gagal "Cabang '$Cabang' tidak ada." }

if (-not (Test-Path $Uji)) {
  # --detach: cabang 'utama' sedang dipegang folder produksi, dan git menolak
  # satu cabang di-checkout di dua tempat. Yang dibutuhkan uji cuma isinya.
  git -C $Produksi worktree add --detach $Uji $Cabang
  if ($LASTEXITCODE -ne 0) { Gagal 'Tidak bisa membuat folder uji (git worktree add).' }
} else {
  $kotor = git -C $Uji status --porcelain
  if ($kotor) {
    Gagal "Ada berkas kode yang diubah langsung di $Uji. Folder itu cuma untuk menjalankan uji - kerjakan perubahan di cabang, lalu jalankan skrip ini lagi."
  }
  git -C $Uji checkout --detach $Cabang
  if ($LASTEXITCODE -ne 0) { Gagal "Tidak bisa berpindah ke cabang '$Cabang'." }
}
$commit = (git -C $Uji log --oneline -1)
Write-Host "  kode: $commit"

# node_modules disambung (junction), bukan disalin: isinya tidak pernah
# ditulis waktu server berjalan, dan menyalinnya tiap kali cuma makan waktu.
foreach ($nm in @('node_modules', 'elogbook\node_modules')) {
  $tuju = Join-Path $Uji $nm
  if (-not (Test-Path $tuju)) {
    New-Item -ItemType Junction -Path $tuju -Target (Join-Path $Produksi $nm) | Out-Null
    Write-Host "  $nm disambungkan"
  }
}

# ---------------------------------------------------------------- data

if ($TanpaSalinData) {
  Write-Host ''
  Write-Host 'Data uji dipakai apa adanya (-TanpaSalinData).'
  if (-not (Test-Path (Join-Path $Uji 'elogbook\data\elogbook.db'))) {
    Gagal 'Folder uji belum punya data. Jalankan sekali tanpa -TanpaSalinData.'
  }
} else {
  Write-Host ''
  Write-Host 'Menyalin data produksi ke folder uji (arah produksi -> uji saja)...'
  foreach ($d in @('data', 'elogbook\data', 'elogbook\uploads')) {
    $asal = Join-Path $Produksi $d
    $tuju = Join-Path $Uji $d
    # Pagar terakhir sebelum /MIR, yang menghapus isi tujuan yang tidak ada di
    # asal: tujuannya WAJIB berada di dalam folder uji.
    if (-not $tuju.StartsWith($Uji + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
      Gagal "Tujuan salin $tuju berada di luar folder uji. Dihentikan."
    }
    robocopy $asal $tuju /MIR /R:2 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) { Gagal "Salin $d gagal (kode robocopy $LASTEXITCODE)." }
    Write-Host "  $d"
  }
  # Kunci notifikasi HP produksi tidak boleh ikut: dengan kunci itu server uji
  # bisa mengirim notif ke HP orang sungguhan. Tanpanya uji membuat kunci
  # sendiri yang tidak dikenali langganan produksi.
  $kunciPush = Join-Path $Uji 'elogbook\data\push-vapid.json'
  if (-not $kunciPush.StartsWith($Uji + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
    Gagal "Letak kunci notifikasi $kunciPush di luar folder uji. Dihentikan."
  }
  if (Test-Path $kunciPush) {
    Remove-Item -LiteralPath $kunciPush -Force
    Write-Host '  kunci notifikasi HP produksi dibuang dari salinan'
  }
}
if (-not (Test-Path (Join-Path $Uji 'elogbook\data\push-vapid.json'))) {
  Write-Host '  notifikasi HP uji: kunci baru akan dibuat - tekan Aktifkan notifikasi lagi di tiap HP'
}

if (Test-Path (Join-Path $Uji '.env')) {
  Gagal "Folder uji punya berkas .env. Hapus berkas itu dulu - isinya bisa menyalakan Telegram atau membelokkan data ke produksi."
}

# ---------------------------------------------------------------- jalankan

# Disetel eksplisit walau bawaannya sudah benar: setelan lingkungan yang
# kebetulan menunjuk folder produksi akan membuat uji menulis ke data sungguhan
# tanpa ada tanda apa pun di layar.
$env:ELOGBOOK_DATA_DIR       = Join-Path $Uji 'elogbook\data'
$env:ELOGBOOK_UPLOAD_DIR     = Join-Path $Uji 'elogbook\uploads'
$env:ELOGBOOK_DB             = ''
$env:TELEGRAM_BOT_TOKEN      = ''
$env:TELEGRAM_BOT_USERNAME   = ''
$env:TELEGRAM_POLLING        = ''
$env:TELEGRAM_WEBHOOK_SECRET = ''
# Kunci notifikasi HP tidak boleh datang dari lingkungan (bisa kunci produksi).
$env:VAPID_PUBLIK            = ''
$env:VAPID_PRIVAT            = ''
$env:PUSH_MATI               = ''
$env:ELOGBOOK_PORT           = "$PortElog"
$env:PORT                    = "$PortDash"
# 0.0.0.0, bukan 127.0.0.1: cloudflared menghubungi localhost lewat ::1, dan
# yang cuma mendengar di 127.0.0.1 dijawab 502 lewat alamat uji.
$env:HOST                    = '0.0.0.0'
$env:ELOGBOOK_PINTU          = "$Alamat/logbook/"

$log   = Join-Path $Uji 'uji.log'
$galat = Join-Path $Uji 'uji-galat.log'

Write-Host ''
Write-Host 'Menyalakan server uji...'
# Tersembunyi dan lepas dari jendela ini: proses yang dinyalakan langsung dari
# terminal ikut mati begitu terminalnya ditutup.
Start-Process -FilePath (Get-Command node).Source -ArgumentList 'jalankan-semua.js' `
  -WorkingDirectory $Uji -WindowStyle Hidden `
  -RedirectStandardOutput $log -RedirectStandardError $galat

$hidup = $false
for ($i = 0; $i -lt 60; $i++) {
  if (Get-NetTCPConnection -LocalPort $PortDash -State Listen -ErrorAction SilentlyContinue) { $hidup = $true; break }
  Start-Sleep -Milliseconds 500
}
if (-not $hidup) {
  Write-Host ''
  Write-Host "Server uji tidak menyala dalam 30 detik. Lihat catatannya:" -ForegroundColor Red
  Write-Host "  $log"
  Write-Host "  $galat"
  exit 1
}

Write-Host ''
Write-Host '========================================================' -ForegroundColor Green
Write-Host ' SERVER UJI HIDUP' -ForegroundColor Green
Write-Host '========================================================' -ForegroundColor Green
Write-Host "  kode   : $commit"
Write-Host "  alamat : $Alamat"
Write-Host "           http://localhost:$PortDash"
Write-Host "  data   : $Uji (salinan - produksi tidak tersentuh)"
Write-Host '  akun   : uji.teknisi / uji1234'
Write-Host "  catatan: $log"
Write-Host ''
Write-Host '  Sesudah mengubah js: tunggu 5 menit (cache Cloudflare) lalu Ctrl+F5.'
Write-Host ''
