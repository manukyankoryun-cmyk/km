# Move entire KM_1.009.4_SEPARATE_FORMAL_DATA_PER_GRAPH folder to a new parent directory.
# Example: from d:\cragrer 2025\Գրաֆիկ\  ->  d:\cragrer 2025\

param(
  [Parameter(Mandatory = $true)]
  [string]$TargetParent,
  [switch]$WhatIf
)

$ErrorActionPreference = 'Stop'
$folderName = 'KM_1.009.4_SEPARATE_FORMAL_DATA_PER_GRAPH'
$current = Split-Path $PSScriptRoot -Parent
$target = Join-Path $TargetParent $folderName

if ($current -eq $target) {
  Write-Host "Already at target: $target"
  exit 0
}

if (Test-Path $target) {
  Write-Error "Target already exists: $target`nRemove or rename it first."
}

Write-Host "Move:"
Write-Host "  FROM: $current"
Write-Host "  TO:   $target"

if ($WhatIf) {
  Write-Host "(WhatIf — no changes made)"
  exit 0
}

$confirm = Read-Host "Continue? (yes/no)"
if ($confirm -ne 'yes') { exit 0 }

New-Item -ItemType Directory -Force -Path $TargetParent | Out-Null
Move-Item -LiteralPath $current -Destination $target
Write-Host "Moved. Re-open Cursor workspace at:"
Write-Host "  $target"
