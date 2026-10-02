# Square logo with content-aware crop (crest centered, no stretch)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$assets = Join-Path $root 'app\assets'
$src = Join-Path $assets 'km_logo.jpg'
$dst = Join-Path $assets 'km_logo_square.jpg'
if (-not (Test-Path $src)) { throw "Missing logo: $src" }

Add-Type -AssemblyName System.Drawing

function Save-Jpeg([System.Drawing.Bitmap]$bmp, [string]$path, [long]$quality = 95) {
  $enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
    Where-Object { $_.MimeType -eq 'image/jpeg' } | Select-Object -First 1
  $ep = New-Object System.Drawing.Imaging.EncoderParameters 1
  $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
    [System.Drawing.Imaging.Encoder]::Quality, $quality)
  $bmp.Save($path, $enc, $ep)
  $ep.Dispose()
}

function Get-ContentBounds([System.Drawing.Bitmap]$bmp, [int]$step, [int]$threshold) {
  $w = $bmp.Width; $h = $bmp.Height
  $minX = $w; $minY = $h; $maxX = 0; $maxY = 0
  for ($y = 0; $y -lt $h; $y += $step) {
    for ($x = 0; $x -lt $w; $x += $step) {
      $c = $bmp.GetPixel($x, $y)
      $lum = [int](0.299 * $c.R + 0.587 * $c.G + 0.114 * $c.B)
      if ($lum -gt $threshold -or $c.A -gt 24) {
        if ($x -lt $minX) { $minX = $x }
        if ($y -lt $minY) { $minY = $y }
        if ($x -gt $maxX) { $maxX = $x }
        if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }
  if ($maxX -le $minX -or $maxY -le $minY) {
    return @{ X = 0; Y = 0; W = $w; H = $h; Cx = [int]($w / 2); Cy = [int]($h / 2) }
  }
  @{ X = $minX; Y = $minY; W = ($maxX - $minX + 1); H = ($maxY - $minY + 1); Cx = [int](($minX + $maxX) / 2); Cy = [int](($minY + $maxY) / 2) }
}

function Clamp([int]$v, [int]$min, [int]$max) {
  if ($v -lt $min) { return $min }
  if ($v -gt $max) { return $max }
  return $v
}

$size = 512
$img = [System.Drawing.Image]::FromFile($src)
try {
  $srcBmp = New-Object System.Drawing.Bitmap $img
  try {
    $b = Get-ContentBounds $srcBmp 2 28
    $pad = [int][Math]::Max(8, [Math]::Round([Math]::Max($b.W, $b.H) * 0.06))
    $need = [Math]::Max($b.W, $b.H) + (2 * $pad)
    $maxSide = [Math]::Min($srcBmp.Width, $srcBmp.Height)
    $side = [int][Math]::Min($need, $maxSide)
    if ($side -lt 32) { $side = [int]$maxSide }

    $cropX = Clamp ([int]($b.Cx - ($side / 2))) 0 ([int]($srcBmp.Width - $side))
    $cropY = Clamp ([int]($b.Cy - ($side / 2))) 0 ([int]($srcBmp.Height - $side))

    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    try {
      $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
      $g.Clear([System.Drawing.Color]::FromArgb(255, 24, 28, 32))
      $srcRect = New-Object System.Drawing.Rectangle $cropX, $cropY, $side, $side
      $destRect = New-Object System.Drawing.Rectangle 0, 0, $size, $size
      $g.DrawImage($srcBmp, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
    } finally { $g.Dispose() }
    Save-Jpeg $bmp $dst 96
    $bmp.Dispose()
  } finally { $srcBmp.Dispose() }
} finally { $img.Dispose() }

Write-Host "Created square logo: $dst (${size}x${size}, crop ${side}x${side} @ ${cropX},${cropY})"
