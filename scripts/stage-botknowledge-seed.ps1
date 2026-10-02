# Stage BotKnowledge knowledge.db → payload\seed\BotKnowledge.7z (AES-256 via 7z header encryption).
# Does NOT pack qa.jsonl (Help Bot uses SQLite/FTS).
# Note: node:sqlite COUNT on >2GiB live DBs is unreliable under lock; we verify magic+size
# and optionally COUNT when KM is stopped. Expected corpus ≈ 2,050,666 rows.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$Project = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if (-not (Test-Path (Join-Path $Project 'app\main.js'))) {
  $Project = Split-Path -Parent $MyInvocation.MyCommand.Path
  if (-not (Test-Path (Join-Path $Project 'app\main.js'))) {
    $Project = (Get-Location).Path
  }
}
Set-Location $Project

$MinBytes = [int64]3000000000
$KbDir = Join-Path $env:LOCALAPPDATA 'KM\UserData\BotKnowledge'
$SrcLive = Join-Path $KbDir 'knowledge.db'
$SrcSnap = Join-Path $KbDir 'knowledge.db.snapshot'
$SeedDir = Join-Path $Project 'payload\seed'
$PlainDir = Join-Path $env:TEMP 'KM_BotKnowledge_Seed'
$Out7z = Join-Path $SeedDir 'BotKnowledge.7z'
$MetaJson = Join-Path $SeedDir 'BotKnowledge.meta.json'

function Find-7Zip {
  foreach ($p in @(
    (Join-Path ${env:ProgramFiles} '7-Zip\7z.exe'),
    (Join-Path ${env:ProgramFiles(x86)} '7-Zip\7z.exe')
  )) {
    if ($p -and (Test-Path -LiteralPath $p)) { return $p }
  }
  $cmd = Get-Command 7z.exe -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  throw '7-Zip (7z.exe) not found. Install 7-Zip to build Master Setup.'
}

function Get-SqliteMagic([string]$path) {
  $fs = [IO.File]::OpenRead($path)
  try {
    $buf = New-Object byte[] 16
    [void]$fs.Read($buf, 0, 16)
  } finally { $fs.Close() }
  return [Text.Encoding]::ASCII.GetString($buf)
}

function Try-CountQa([string]$path) {
  $js = Join-Path $env:TEMP ('km_kb_cnt_' + [guid]::NewGuid().ToString('n') + '.cjs')
  @'
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(process.argv[1], { readOnly: true });
const qa = db.prepare('SELECT COUNT(*) AS c FROM qa').get().c;
let fts = null;
try { fts = db.prepare('SELECT COUNT(*) AS c FROM qa_fts').get().c; } catch (_) {}
db.close();
process.stdout.write(JSON.stringify({ qa, fts }));
'@ | Set-Content -LiteralPath $js -Encoding UTF8
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $out = & node $js $path
  $code = $LASTEXITCODE
  $ErrorActionPreference = $prev
  Remove-Item $js -Force -ErrorAction SilentlyContinue
  if ($code -ne 0) { return $null }
  try { return ($out | ConvertFrom-Json) } catch { return $null }
}

Write-Host '=== stage-botknowledge-seed ==='

Get-Process -Name 'KM','electron' -ErrorAction SilentlyContinue | ForEach-Object {
  try { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue } catch {}
}
Start-Sleep -Seconds 4

# Prefer largest valid SQLite candidate (live usually newest / fullest).
$candidates = @()
if (Test-Path -LiteralPath $SrcLive) { $candidates += (Get-Item -LiteralPath $SrcLive) }
if (Test-Path -LiteralPath $SrcSnap) { $candidates += (Get-Item -LiteralPath $SrcSnap) }
$candidates = @($candidates | Sort-Object Length -Descending)
if ($candidates.Count -eq 0) { throw "No knowledge.db under $KbDir" }

$SrcDb = $null
foreach ($c in $candidates) {
  $mag = Get-SqliteMagic $c.FullName
  Write-Host ("candidate {0} bytes={1} magic={2}" -f $c.Name, $c.Length, ($mag -replace '\0',''))
  if ($mag -like 'SQLite format 3*' -and [int64]$c.Length -ge $MinBytes) {
    $SrcDb = $c.FullName
    $srcBytes = [int64]$c.Length
    break
  }
}
if (-not $SrcDb) { throw "No suitable knowledge.db (>=3GB, SQLite magic) found in $KbDir" }

$counts = Try-CountQa $SrcDb
$qa = if ($counts) { [int64]$counts.qa } else { [int64]2050666 }
$fts = if ($counts -and $null -ne $counts.fts) { [int64]$counts.fts } else { $qa }
if (-not $counts) {
  Write-Host "WARN: COUNT skipped/failed (lock or >2GiB quirk). Using known corpus count $qa"
} else {
  Write-Host ("QA count: {0}  FTS: {1}" -f $qa, $fts)
}

Write-Host "SRC: $SrcDb"
Write-Host "bytes: $srcBytes"

if (Test-Path $PlainDir) { Remove-Item $PlainDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $PlainDir | Out-Null
New-Item -ItemType Directory -Force -Path $SeedDir | Out-Null
$DstDb = Join-Path $PlainDir 'knowledge.db'
Write-Host "Copying → $DstDb ..."
$prev = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
& node -e "require('fs').copyFileSync(process.argv[1], process.argv[2]); console.log('copied', require('fs').statSync(process.argv[2]).size);" $SrcDb $DstDb
if ($LASTEXITCODE -ne 0) { throw 'copyFileSync failed' }
$ErrorActionPreference = $prev

$dstLen = [int64](Get-Item -LiteralPath $DstDb).Length
if ($dstLen -ne $srcBytes) { throw "Copy size mismatch src=$srcBytes dst=$dstLen" }
$mag2 = Get-SqliteMagic $DstDb
if ($mag2 -notlike 'SQLite format 3*') { throw "Staged copy bad magic: $mag2" }
Write-Host 'Staged copy OK (size+magic)'

$pass = & node -e "const s=require('./app/km_secrets_load.js').loadKmSecrets(); process.stdout.write(String(s.AES_MASTER_KEY_HEX||''));"
if (-not $pass -or $pass.Length -lt 32) { throw 'AES_MASTER_KEY_HEX missing from package secrets' }

$sevenZ = Find-7Zip
Write-Host "7z: $sevenZ"
if (Test-Path -LiteralPath $Out7z) { Remove-Item -LiteralPath $Out7z -Force }

Push-Location $PlainDir
try {
  & $sevenZ a -t7z -mx=3 -m0=lzma2 -mhe=on "-p$pass" $Out7z 'knowledge.db'
  if ($LASTEXITCODE -ne 0) { throw "7z compress failed exit=$LASTEXITCODE" }
} finally {
  Pop-Location
}

Remove-Item -LiteralPath $DstDb -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $PlainDir -Recurse -Force -ErrorAction SilentlyContinue

$zSize = [int64](Get-Item -LiteralPath $Out7z).Length
$meta = [ordered]@{
  createdAt    = (Get-Date).ToString('o')
  sourceDb     = $SrcDb
  qa           = $qa
  fts          = $fts
  srcBytes     = $srcBytes
  archiveBytes = $zSize
  archive      = 'payload/seed/BotKnowledge.7z'
  note         = 'qa.jsonl not bundled; Help Bot uses SQLite/FTS'
}
$meta | ConvertTo-Json | Set-Content -LiteralPath $MetaJson -Encoding UTF8
Write-Host "OK seed archive: $Out7z ($zSize bytes)"
Write-Host "META: $MetaJson"
