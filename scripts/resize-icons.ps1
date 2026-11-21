Add-Type -AssemblyName System.Drawing

function Resize-Image($srcPath, $destPath, $width, $height) {
    $src = [System.Drawing.Bitmap]::FromFile((Resolve-Path $srcPath).Path)
    $dest = New-Object System.Drawing.Bitmap($width, $height)
    $graphics = [System.Drawing.Graphics]::FromImage($dest)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.DrawImage($src, 0, 0, $width, $height)
    $dest.Save((Join-Path (Get-Location) $destPath), [System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose()
    $dest.Dispose()
    $src.Dispose()
}

$logo512 = "src/icons/youtube-auto-resumer-robot-logo.png"
$logo128 = "src/icons/youtube-auto-resumer-robot-logo-128.png"

Resize-Image $logo512 "src/icons/icon-16.png" 16 16
Resize-Image $logo512 "src/icons/icon-32.png" 32 32
Resize-Image $logo512 "src/icons/icon-48.png" 48 48
Copy-Item $logo128 "src/icons/icon-128.png" -Force

Write-Host "Icons successfully resized and replaced."
