# Mengecilkan dua gambar terberat di public/images.
#
# Halaman depan mengunduh 2,79 MB dan 2,44 MB di antaranya cuma dua berkas ini:
#
#   indonesia-orbit-bg.png   2,09 MB   1672x941   latar bumi dari orbit
#   airnav-logo.png          0,29 MB   946x960    tampil 54x54 px saja
#
# Yang pertama foto, tetapi disimpan sebagai PNG - format tanpa rugi, yang
# untuk foto berarti membayar penuh tiap piksel langit yang nyaris sama.
# Sebagai JPEG mutu 85 ia turun ke sekitar sepersepuluh tanpa beda yang
# terlihat di layar, apalagi di balik tint gelap yang menutupinya.
#
# Yang kedua tetap PNG karena latarnya tembus pandang, cuma dikecilkan ke
# 128 px - dua kali lipat ukuran tampilnya, cukup untuk layar padat.
#
# Tidak ada yang perlu dipasang: System.Drawing itu bawaan Windows. Berkas
# aslinya TIDAK dihapus, jadi kalau hasilnya tidak disukai tinggal kembalikan
# rujukannya di CSS.
#
# Jalankan dari akar aplikasi:  powershell -ExecutionPolicy Bypass -File tools\kecilkan-gambar.ps1

Add-Type -AssemblyName System.Drawing

$akar = Split-Path -Parent $PSScriptRoot
$gambar = Join-Path $akar 'public\images'

function Ukuran($berkas) {
    if (Test-Path $berkas) { return [math]::Round((Get-Item $berkas).Length / 1KB, 1) }
    return 0
}

function Simpan-Jpeg($sumber, $tujuan, $mutu) {
    $img = [System.Drawing.Image]::FromFile($sumber)
    try {
        # JPEG tidak mengenal alpha. Digambar dulu di atas warna latar konsol
        # (--bg #0a0e13) supaya piksel tembus pandang tidak jadi putih.
        $rata = New-Object System.Drawing.Bitmap($img.Width, $img.Height, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
        $g = [System.Drawing.Graphics]::FromImage($rata)
        $g.Clear([System.Drawing.Color]::FromArgb(10, 14, 19))
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.DrawImage($img, 0, 0, $img.Width, $img.Height)
        $g.Dispose()

        $enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
        $par = New-Object System.Drawing.Imaging.EncoderParameters(1)
        $par.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]$mutu)
        $rata.Save($tujuan, $enc, $par)
        $par.Dispose()
        $rata.Dispose()
    } finally { $img.Dispose() }
}

function Kecilkan-Png($sumber, $tujuan, $sisiMaks) {
    $img = [System.Drawing.Image]::FromFile($sumber)
    try {
        # Perbandingan sisi dijaga; yang terpanjang yang menyentuh batas.
        $skala = [math]::Min($sisiMaks / $img.Width, $sisiMaks / $img.Height)
        $w = [int][math]::Round($img.Width * $skala)
        $h = [int][math]::Round($img.Height * $skala)

        $bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.Clear([System.Drawing.Color]::Transparent)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.DrawImage($img, 0, 0, $w, $h)
        $g.Dispose()
        $bmp.Save($tujuan, [System.Drawing.Imaging.ImageFormat]::Png)
        $bmp.Dispose()
        return "$w x $h"
    } finally { $img.Dispose() }
}

$latarPng = Join-Path $gambar 'indonesia-orbit-bg.png'
$latarJpg = Join-Path $gambar 'indonesia-orbit-bg.jpg'
$logoPng  = Join-Path $gambar 'airnav-logo.png'
$logoKcl  = Join-Path $gambar 'airnav-logo-128.png'

if (-not (Test-Path $latarPng)) { Write-Host "Tidak ketemu: $latarPng" -ForegroundColor Red; exit 1 }
if (-not (Test-Path $logoPng))  { Write-Host "Tidak ketemu: $logoPng"  -ForegroundColor Red; exit 1 }

$sebelumLatar = Ukuran $latarPng
$sebelumLogo  = Ukuran $logoPng

$latarJpg92 = Join-Path $gambar 'indonesia-orbit-bg-mutu92.jpg'

Write-Host ''
Write-Host 'Mengubah latar orbit ke JPEG - RESOLUSI TIDAK DIUBAH, tetap 1672x941.'
Write-Host 'Dibuat dua versi supaya bisa dibandingkan mata sendiri:'
Write-Host '  mutu 85 - paling hemat'
Write-Host '  mutu 92 - lebih aman untuk gradasi langit, masih jauh lebih kecil dari PNG'
Simpan-Jpeg $latarPng $latarJpg 85
Simpan-Jpeg $latarPng $latarJpg92 92

Write-Host 'Mengecilkan logo AirNav ke 128 px ...'
$ukuranLogo = Kecilkan-Png $logoPng $logoKcl 128

$sesudahLatar   = Ukuran $latarJpg
$sesudahLatar92 = Ukuran $latarJpg92
$sesudahLogo    = Ukuran $logoKcl

Write-Host ''
Write-Host 'Hasil:' -ForegroundColor Cyan
Write-Host ("  indonesia-orbit-bg.png   {0,8:N1} KB   1672x941  (asli, tetap ada)" -f $sebelumLatar)
Write-Host ("    -> mutu 85             {0,8:N1} KB   1672x941" -f $sesudahLatar)
Write-Host ("    -> mutu 92             {0,8:N1} KB   1672x941" -f $sesudahLatar92)
Write-Host ("  airnav-logo.png          {0,8:N1} KB   946x960   (asli, tetap ada)" -f $sebelumLogo)
Write-Host ("    -> 128 px              {0,8:N1} KB   {1}   (tampil 54x54)" -f $sesudahLogo, $ukuranLogo)
Write-Host ''
Write-Host 'Tidak ada yang berubah di halaman. Bandingkan dulu ketiga latar itu:' -ForegroundColor Yellow
Write-Host '  explorer public\images'
Write-Host ''
Write-Host 'Buka bertiga, zoom ke bagian langit yang gradasinya paling halus - di situ'
Write-Host 'beda JPEG paling gampang ketahuan. Kalau mutu 85 sudah tidak terbedakan,'
Write-Host 'pakai itu. Kalau terasa ada belang, pakai yang 92.'
Write-Host ''
