# Creates app/assets/km_icon.ico — multi-size square PNGs, no stretch
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$script = Join-Path $PSScriptRoot 'create_km_icon.mjs'
$assets = Join-Path $root 'app\assets'
$square = Join-Path $assets 'km_logo_square.jpg'
$icoPath = Join-Path $assets 'km_icon.ico'
$tmpDir = Join-Path $env:TEMP ('km_icon_png_' + [Guid]::NewGuid().ToString('N'))

& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'normalize_km_logo.ps1')
if (-not (Test-Path $square)) { throw "Missing square logo: $square" }

Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null

$img = [System.Drawing.Image]::FromFile($square)
try {
  $srcBmp = New-Object System.Drawing.Bitmap $img
  try {
    $sizes = @(16, 24, 32, 48, 64, 128, 256)
    $pngPaths = @()
    foreach ($s in $sizes) {
      $bmp = New-Object System.Drawing.Bitmap $s, $s
      $g = [System.Drawing.Graphics]::FromImage($bmp)
      try {
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.Clear([System.Drawing.Color]::Transparent)
        $dest = New-Object System.Drawing.Rectangle 0, 0, $s, $s
        $g.DrawImage($srcBmp, $dest, 0, 0, $srcBmp.Width, $srcBmp.Height, [System.Drawing.GraphicsUnit]::Pixel)
      } finally { $g.Dispose() }
      $p = Join-Path $tmpDir ("km_$s.png")
      $bmp.Save($p, [System.Drawing.Imaging.ImageFormat]::Png)
      $bmp.Dispose()
      $pngPaths += $p
    }
  } finally { $srcBmp.Dispose() }
} finally { $img.Dispose() }

$node = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $node) { throw 'node.exe is required to build km_icon.ico' }
& $node.Source $script @pngPaths $icoPath
if ($LASTEXITCODE -ne 0) { throw "create_km_icon.mjs failed with exit code $LASTEXITCODE" }
if (-not (Test-Path $icoPath)) { throw "Icon was not created: $icoPath" }

Remove-Item $tmpDir -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "Created $icoPath ($((Get-Item $icoPath).Length) bytes)"
