# Generate scripts/kod_codes.txt and payload/kod_codes.txt for kod.cmd
# Shipped pool: 20,000,000 codes (AA000000 …). Full range supports up to 200,000,000 via algorithm.
param(
  [int]$Count = 20000000
)
$ErrorActionPreference = 'Stop'
$MaxCount = 200000000
$ShipDefault = 20000000
if ($Count -lt 1) { $Count = 1 }
if ($Count -gt $MaxCount) { $Count = $MaxCount }

$root = Split-Path $PSScriptRoot -Parent
$SuffixMod = [long]0x1000000
$MaxPrefixIndex = 255
$RangeMaxCode = 'ALEBC1FF'
$MaxCodeIndex = [long]199999999

function Get-IndexPrefix([int]$pi) {
  $p = [Math]::Max(0, [Math]::Min($MaxPrefixIndex, [int]$pi))
  $hi = [int][Math]::Floor($p / 16)
  $lo = [int]($p % 16)
  return [char](65 + $hi) + [char](65 + $lo)
}

function Index-ToCode([long]$idx) {
  if ($idx -lt 0) { $idx = 0 }
  if ($idx -gt $MaxCodeIndex) { $idx = $MaxCodeIndex }
  $suf = [int][long]($idx % $SuffixMod)
  $pi = [int](($idx - $suf) / $SuffixMod)
  return (Get-IndexPrefix $pi) + ('{0:X6}' -f $suf)
}

$lastCode = $RangeMaxCode
$header = @(
  "# KM activation codes: AA000000 - $RangeMaxCode ($Count of max 200000000; shipped default $ShipDefault)"
  '# kod.cmd uses fast algorithm; this file is the 20M code pool for backup/distribution.'
  '# Regenerate: generate_kod_codes.ps1 -Count 20000000'
  '#'
)

$paths = @(
  (Join-Path $root 'scripts\kod_codes.txt')
  (Join-Path $root 'payload\kod_codes.txt')
)

Write-Host "Generating $Count codes ($lastCode max)..."

foreach ($out in $paths) {
  New-Item -ItemType Directory -Force -Path (Split-Path $out) | Out-Null
  $sw = New-Object System.IO.StreamWriter($out, $false, [System.Text.UTF8Encoding]::new($false))
  try {
    foreach ($h in $header) { $sw.WriteLine($h) }
    for ($i = 0; $i -lt $Count; $i++) {
      $sw.WriteLine((Index-ToCode $i))
      if ($i -gt 0 -and $i % 1000000 -eq 0) { Write-Host "  $i..." }
    }
  } finally {
    $sw.Close()
  }
  $size = (Get-Item $out).Length
  Write-Host "Created $out ($size bytes, ~$([Math]::Round($size/1GB,2)) GB)"
}
