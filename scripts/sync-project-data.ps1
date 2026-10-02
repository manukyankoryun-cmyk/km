# Sync KM runtime UserData into project-data\UserData\ (dev backup / portable copy)
# Does NOT delete AppData originals. Safe to re-run.

param(
  [string]$ProjectRoot = (Split-Path $PSScriptRoot -Parent),
  [switch]$BotKnowledgeOnly,
  [switch]$WhatIf
)

$ErrorActionPreference = 'Stop'
if (-not $ProjectRoot) { $ProjectRoot = Split-Path $PSScriptRoot -Parent }

$src = Join-Path $env:LOCALAPPDATA 'KM\UserData'
$dstRoot = Join-Path $ProjectRoot 'project-data\UserData'

if (-not (Test-Path $src)) {
  Write-Host "UserData not found: $src" -ForegroundColor Yellow
  Write-Host "Run KM Desktop once, then retry."
  exit 1
}

New-Item -ItemType Directory -Force -Path $dstRoot | Out-Null

function Copy-Tree($rel) {
  $from = Join-Path $src $rel
  $to = Join-Path $dstRoot $rel
  if (-not (Test-Path $from)) {
    Write-Host "Skip (missing): $rel"
    return
  }
  if ($WhatIf) {
    Write-Host "Would copy: $from -> $to"
    return
  }
  New-Item -ItemType Directory -Force -Path (Split-Path $to -Parent) | Out-Null
  if (Test-Path $from -PathType Container) {
    robocopy $from $to /MIR /R:1 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy failed for $rel (exit $LASTEXITCODE)" }
  } else {
    Copy-Item -Force $from $to
  }
  Write-Host "Copied: $rel"
}

Write-Host "Source: $src"
Write-Host "Target: $dstRoot"
Write-Host ""

if ($BotKnowledgeOnly) {
  Copy-Tree 'BotKnowledge'
} else {
  @(
    'BotKnowledge',
    'km_settings.json',
    'km_lan_config.json',
    'database_snapshot.json',
    'Backups'
  ) | ForEach-Object { Copy-Tree $_ }
}

Write-Host ""
Write-Host "Done. project-data mirror updated under:"
Write-Host "  $dstRoot"
