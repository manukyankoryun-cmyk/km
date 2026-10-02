# Ensures required app/assets files exist (logo, ONE static background, icon).
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$assets = Join-Path $root 'app\assets'
New-Item -ItemType Directory -Force -Path $assets | Out-Null

Add-Type -AssemblyName System.Drawing

function Save-Jpeg([System.Drawing.Bitmap]$bmp, [string]$path, [long]$quality = 92) {
  $enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
    Where-Object { $_.MimeType -eq 'image/jpeg' } | Select-Object -First 1
  $ep = New-Object System.Drawing.Imaging.EncoderParameters 1
  $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
    [System.Drawing.Imaging.Encoder]::Quality, $quality)
  $bmp.Save($path, $enc, $ep)
  $ep.Dispose()
}

function New-LogoJpg([string]$path) {
  $size = 512
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  try {
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $bg = [System.Drawing.Color]::FromArgb(255, 28, 48, 38)
    $gold = [System.Drawing.Color]::FromArgb(255, 198, 166, 72)
    $g.Clear($bg)
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(60, 255, 255, 255))
    $g.FillEllipse($brush, 64, 64, 384, 384)
    $brush.Dispose()
    $shield = New-Object System.Drawing.Drawing2D.GraphicsPath
    $shield.AddPolygon(@(
      (New-Object System.Drawing.Point 256, 96),
      (New-Object System.Drawing.Point 360, 160),
      (New-Object System.Drawing.Point 336, 360),
      (New-Object System.Drawing.Point 256, 416),
      (New-Object System.Drawing.Point 176, 360),
      (New-Object System.Drawing.Point 152, 160)
    ))
    $g.FillPath((New-Object System.Drawing.SolidBrush $bg), $shield)
    $g.DrawPath((New-Object System.Drawing.Pen $gold, 6), $shield)
    $font = New-Object System.Drawing.Font 'Segoe UI', 96, [System.Drawing.FontStyle]::Bold
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
    $g.DrawString('KM', $font, (New-Object System.Drawing.SolidBrush $gold),
      (New-Object System.Drawing.RectangleF 0, 150, $size, 180), $sf)
    $font.Dispose(); $shield.Dispose()
  } finally { $g.Dispose() }
  Save-Jpeg $bmp $path 95
  $bmp.Dispose()
  Write-Host "Created logo: $path"
}

# KM_SINGLE_BG_V2: keep the user-provided background; never regenerate the old slideshow images.
$singleBg = Join-Path $assets 'km_bg.jpg'
if (-not (Test-Path -LiteralPath $singleBg -PathType Leaf)) {
  throw "Required static background is missing: $singleBg"
}

$logo = Join-Path $assets 'km_logo.jpg'
if (-not (Test-Path $logo)) { New-LogoJpg $logo }

$iconScript = Join-Path $root 'scripts\create_km_icon.ps1'
$ico = Join-Path $assets 'km_icon.ico'
$square = Join-Path $assets 'km_logo_square.jpg'
$rebuildIcon = -not (Test-Path $ico) -or -not (Test-Path $square) -or ((Get-Item $logo).LastWriteTimeUtc -gt (Get-Item $ico).LastWriteTimeUtc)
if ($rebuildIcon) {
  & powershell -NoProfile -ExecutionPolicy Bypass -File $iconScript
  if (-not (Test-Path $ico)) { throw "km_icon.ico was not created" }
}

Write-Host 'KM assets OK'

$setupDir = Join-Path $root 'setup'
New-Item -ItemType Directory -Force -Path $setupDir | Out-Null
function New-SetupBmp([string]$srcPath, [string]$outPath, [int]$w, [int]$h, [switch]$Header) {
  $src = [System.Drawing.Image]::FromFile($srcPath)
  try {
    $bmp = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    try {
      $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $g.Clear([System.Drawing.Color]::FromArgb(255, 23, 40, 32))
      if ($Header) {
        $side = [Math]::Min($h - 8, 48)
        $g.DrawImage($src, 8, [int](($h - $side) / 2), $side, $side)
      } else {
        $side = 120
        $x = [int](($w - $side) / 2)
        $g.DrawImage($src, $x, 48, $side, $side)
      }
    } finally { $g.Dispose() }
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Bmp)
    $bmp.Dispose()
  } finally { $src.Dispose() }
  Write-Host "Created $outPath"
}
$sq = Join-Path $assets 'km_logo_square.jpg'
if (-not (Test-Path $sq)) { $sq = $logo }
New-SetupBmp $sq (Join-Path $setupDir 'km_welcome.bmp') 164 314
New-SetupBmp $sq (Join-Path $setupDir 'km_header.bmp') 150 57 -Header

