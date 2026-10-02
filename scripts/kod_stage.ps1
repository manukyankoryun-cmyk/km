# KM activation — auto code + connect to installed KM.exe (any kod.cmd / kod3.cmd location)
param(
  [string]$KodRoot = '',
  [ValidateSet('year', 'quarter')]
  [string]$Kind = 'year'
)

$ErrorActionPreference = 'Stop'
if ($env:KM_KOD_KIND -eq 'quarter') { $Kind = 'quarter' }
if ($KodRoot -match '(?i)-Kind\s+quarter') {
  $Kind = 'quarter'
  $KodRoot = ($KodRoot -replace '(?i)\s*-Kind\s+quarter', '').Trim().Trim('"')
}
if ($Kind -ne 'quarter') {
  try {
    $self = Get-CimInstance Win32_Process -Filter "ProcessId=$PID" -ErrorAction SilentlyContinue
    if ($self) {
      $pcmd = (Get-CimInstance Win32_Process -Filter "ProcessId=$($self.ParentProcessId)" -ErrorAction SilentlyContinue).CommandLine
      if ($pcmd -match '(?i)kod3\.cmd') { $Kind = 'quarter' }
    }
  } catch {}
}
if ($KodRoot) {
  try { $KodRoot = [IO.Path]::GetFullPath(($KodRoot + '').Trim().Trim('"')) } catch {}
  $KodRoot = $KodRoot.TrimEnd('\', '/')
}

function Get-KmUserDataRoot {
  if ($env:LOCALAPPDATA) { return Join-Path $env:LOCALAPPDATA 'KM\UserData' }
  return Join-Path $env:USERPROFILE 'AppData\Local\KM\UserData'
}
function Get-KmErrorLogPath { return Join-Path (Get-KmUserDataRoot) 'km_errors.log' }
function Write-KmErrorLog {
  param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Message,
    [string]$Detail = ''
  )
  try {
    $root = Get-KmUserDataRoot
    if (-not (Test-Path $root)) { New-Item -ItemType Directory -Force -Path $root | Out-Null }
    $path = Join-Path $root 'km_errors.log'
    $ts = Get-Date -Format 'o'
    $msg = ($Message + '').Replace("`r", ' ').Replace("`n", ' ')
    $line = "[$ts] [$Source] $msg"
    if ($Detail) {
      $d = ($Detail + '').Replace("`r", ' ').Replace("`n", ' ')
      if ($d.Length -gt 4000) { $d = $d.Substring(0, 4000) }
      $line += " | $d"
    }
    Add-Content -LiteralPath $path -Value $line -Encoding UTF8
    return $path
  } catch { return $null }
}

function Read-JsonFile([string]$path, $default) {
  if (-not (Test-Path $path)) { return $default }
  try {
    $raw = [System.IO.File]::ReadAllText($path)
    if ($raw.Length -gt 0 -and [int][char]$raw[0] -eq 0xFEFF) { $raw = $raw.Substring(1) }
    return ($raw | ConvertFrom-Json)
  } catch { return $default }
}

function Write-JsonFile([string]$path, $obj) {
  $dir = Split-Path $path -Parent
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  $tmp = $path + '.tmp'
  $json = ($obj | ConvertTo-Json -Depth 5)
  $utf8 = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($tmp, $json, $utf8)
  Move-Item -Path $tmp -Destination $path -Force
}

function Resolve-KmPaths([string]$kodRoot) {
  $userRoot = Join-Path $env:LOCALAPPDATA 'KM\UserData'
  $roots = New-Object System.Collections.Generic.List[string]

  if ($kodRoot) {
    $kr = $kodRoot.TrimEnd('\', '/')
    if ($kr) { [void]$roots.Add($kr) }
  }

  try {
    $reg = Get-ItemProperty -Path 'HKCU:\Software\KM' -Name 'InstallLocation' -ErrorAction SilentlyContinue
    if ($reg -and $reg.InstallLocation) {
      [void]$roots.Add([string]$reg.InstallLocation.TrimEnd('\', '/'))
    }
  } catch {}

  $saved = Read-JsonFile (Join-Path $userRoot 'km_install.json') $null
  if ($saved -and $saved.installRoot) {
    [void]$roots.Add([string]$saved.installRoot.TrimEnd('\', '/'))
  }
  if ($saved -and $saved.kmExe -and (Test-Path $saved.kmExe)) {
    $runtimeDir = Split-Path $saved.kmExe -Parent
    $installRoot = Split-Path $runtimeDir -Parent
    return @{
      installRoot = $installRoot
      kmExe       = $saved.kmExe
      kodRoot     = $kodRoot
    }
  }

  Get-Process -Name 'KM' -ErrorAction SilentlyContinue | ForEach-Object {
    if ($_.Path) {
      $runtimeDir = Split-Path $_.Path -Parent
      [void]$roots.Add((Split-Path $runtimeDir -Parent))
    }
  }

  foreach ($extra in @('E:\2\KM', 'C:\KM', 'D:\KM')) {
    [void]$roots.Add($extra)
  }

  $seen = @{}
  foreach ($root in $roots) {
    if (-not $root -or $seen.ContainsKey($root)) { continue }
    $seen[$root] = $true
    $exe = Join-Path $root 'runtime\KM.exe'
    if (Test-Path $exe) {
      return @{
        installRoot = $root
        kmExe       = $exe
        kodRoot     = $kodRoot
      }
    }
  }

  return @{
    installRoot = if ($kodRoot) { $kodRoot.TrimEnd('\', '/') } else { '' }
    kmExe       = ''
    kodRoot     = $kodRoot
  }
}

function Save-KmInstallInfo([hashtable]$paths, [string]$userRoot) {
  if (-not $paths.installRoot) { return }
  $info = @{
    installRoot = $paths.installRoot
    runtimeDir  = Join-Path $paths.installRoot 'runtime'
    kmExe       = $paths.kmExe
    kodCmd      = if ($paths.kodRoot) {
      if ($Kind -eq 'quarter') { Join-Path $paths.kodRoot 'kod3.cmd' } else { Join-Path $paths.kodRoot 'kod.cmd' }
    } elseif ($Kind -eq 'quarter') { Join-Path $paths.installRoot 'kod3.cmd' } else { Join-Path $paths.installRoot 'kod.cmd' }
    appDir      = Join-Path $paths.installRoot 'runtime\resources\app'
    updatedAt   = (Get-Date).ToUniversalTime().ToString('o')
  }
  Write-JsonFile (Join-Path $userRoot 'km_install.json') $info
}

function Focus-KmWindow([string]$kmExePath) {
  $procs = @(Get-Process -Name 'KM' -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $kmExePath })
  if (-not $procs.Count) { return $false }
  Add-Type @"
using System;
using System.Runtime.InteropServices;
public class KmWin32 {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@ -ErrorAction SilentlyContinue | Out-Null
  foreach ($p in $procs) {
    if ($p.MainWindowHandle -and $p.MainWindowHandle -ne [IntPtr]::Zero) {
      [KmWin32]::ShowWindow($p.MainWindowHandle, 9) | Out-Null
      [KmWin32]::SetForegroundWindow($p.MainWindowHandle) | Out-Null
      return $true
    }
  }
  return $false
}

function Start-KmApp([string]$kmExePath) {
  if (-not $kmExePath -or -not (Test-Path $kmExePath)) {
    Write-Host 'License saved. KM.exe not found on this PC.'
    return
  }
  $running = @(Get-Process -Name 'KM' -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $kmExePath })
  if ($running.Count) {
    Write-Host 'KM is already running - license updated.'
    if (Focus-KmWindow $kmExePath) { Write-Host 'KM window focused.' }
    return
  }
  Start-Process -FilePath $kmExePath -WorkingDirectory (Split-Path $kmExePath -Parent)
  Write-Host 'KM started.'
}

try {
  $userRoot = Join-Path $env:LOCALAPPDATA 'KM\UserData'
  $licenseFile = Join-Path $userRoot 'km_license.json'
  $pendingFile = Join-Path $userRoot 'km_pending_activation.json'
  $setupGateFile = Join-Path $userRoot 'km_setup_require_activation'
  if (Test-Path $setupGateFile) { Remove-Item $setupGateFile -Force -ErrorAction SilentlyContinue }
  $paths = Resolve-KmPaths $KodRoot
  $kmExe = $paths.kmExe

  $SuffixMod = [long]0x1000000
  $MaxPrefixIndex = 255
  $MaxCodeIndex = [long]199999999
  $QLetterCount = 21
  $QHalfMax = 44000
  $QHalfSpan = 44001
  $MaxQuarterIndex = [long]199999

  function Get-PrefixIndex([string]$pre) {
    if ($pre.Length -ne 2) { return -1 }
    $a = [int][char]$pre[0]
    $b = [int][char]$pre[1]
    if ($a -lt 65 -or $a -gt 80 -or $b -lt 65 -or $b -gt 80) { return -1 }
    return ($a - 65) * 16 + ($b - 65)
  }

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

  function Normalize-Code([string]$raw) {
    $c = ($raw + '').Trim().ToUpper() -replace '[^A-Z0-9]', ''
    if ($c.Length -ne 8) { return $null }
    $pre = $c.Substring(0, 2)
    $suf = $c.Substring(2)
    if ((Get-PrefixIndex $pre) -lt 0) { return $null }
    if ($suf -notmatch '^[0-9A-F]{6}$') { return $null }
    $idx = [long](Get-PrefixIndex $pre) * $SuffixMod + [Convert]::ToInt64($suf, 16)
    if ($idx -lt 0 -or $idx -gt $MaxCodeIndex) { return $null }
    return (Index-ToCode $idx)
  }

  function Normalize-QuarterCode([string]$raw) {
    $s = ($raw + '').Trim().ToUpper() -replace '\s+', ''
    if ($s -notmatch '^([A-U]{2}[0-9]{2})-([A-U]{2}[0-9]{2})$') { return $null }
    $left = Get-QuarterHalfIndex $Matches[1]
    $right = Get-QuarterHalfIndex $Matches[2]
    if ($left -lt 0 -or $right -lt 0) { return $null }
    $idx = ([long]$left * $QHalfSpan) + [long]$right
    if ($idx -lt 0 -or $idx -gt $MaxQuarterIndex) { return $null }
    return ($Matches[1] + '-' + $Matches[2])
  }

  function Get-QuarterHalfIndex([string]$half) {
    $h = ($half + '').ToUpper()
    if ($h -notmatch '^[A-U]{2}[0-9]{2}$') { return -1 }
    $l1 = [int][char]$h[0] - 65
    $l2 = [int][char]$h[1] - 65
    $dd = [int]$h.Substring(2)
    if ($l1 -lt 0 -or $l1 -ge $QLetterCount -or $l2 -lt 0 -or $l2 -ge $QLetterCount -or $dd -lt 0 -or $dd -gt 99) { return -1 }
    $idx = ($l1 * $QLetterCount + $l2) * 100 + $dd
    if ($idx -lt 0 -or $idx -gt $QHalfMax) { return -1 }
    return $idx
  }

  function Index-ToQuarterHalf([int]$idx) {
    $i = [Math]::Max(0, [Math]::Min($QHalfMax, [int]$idx))
    $dd = $i % 100
    $rest = [int][Math]::Floor($i / 100)
    $l2 = $rest % $QLetterCount
    $l1 = [int][Math]::Floor($rest / $QLetterCount)
    return [char](65 + $l1) + [char](65 + $l2) + ('{0:D2}' -f $dd)
  }

  function Index-ToQuarterCode([long]$idx) {
    if ($idx -lt 0) { $idx = 0 }
    if ($idx -gt $MaxQuarterIndex) { $idx = $MaxQuarterIndex }
    $left = [int][Math]::Floor($idx / $QHalfSpan)
    $right = [int]($idx % $QHalfSpan)
    if ($left -gt $QHalfMax) { return $null }
    return (Index-ToQuarterHalf $left) + '-' + (Index-ToQuarterHalf $right)
  }

  function Get-UsedSet($lic) {
    $used = @{}
    if ($lic -and $lic.usedCodes) {
      foreach ($c in @($lic.usedCodes)) {
        if ($c) {
          $raw = [string]$c
          $used[$raw] = $true
          $n = if ($Kind -eq 'quarter') {
            Normalize-QuarterCode $raw
          } elseif ($raw -match '-') {
            $null
          } else {
            Normalize-Code $raw
          }
          if ($n) { $used[$n] = $true }
        }
      }
    }
    return $used
  }

  function Get-NextUnusedCode($lic) {
    $used = Get-UsedSet $lic
    $span = $MaxCodeIndex + 1
    $start = [long]0
    if ($lic -and $null -ne $lic.nextCodeScanIndex) {
      $start = [Math]::Max([long]0, [Math]::Min($MaxCodeIndex, [long]$lic.nextCodeScanIndex))
    }
    for ($off = [long]0; $off -le $MaxCodeIndex; $off++) {
      $idx = ($start + $off) % $span
      $code = Index-ToCode $idx
      if (-not $used.ContainsKey($code)) {
        return @{ code = $code; index = $idx }
      }
    }
    throw 'No unused activation code left'
  }

  function Get-NextUnusedQuarterCode($lic) {
    $used = Get-UsedSet $lic
    $span = $MaxQuarterIndex + 1
    $start = [long]0
    if ($lic -and $null -ne $lic.nextQuarterScanIndex) {
      $start = [Math]::Max([long]0, [Math]::Min($MaxQuarterIndex, [long]$lic.nextQuarterScanIndex))
    }
    for ($off = [long]0; $off -le $MaxQuarterIndex; $off++) {
      $idx = ($start + $off) % $span
      $code = Index-ToQuarterCode $idx
      if ($code -and -not $used.ContainsKey($code)) {
        return @{ code = $code; index = $idx }
      }
    }
    throw 'No unused activation code left'
  }

  function Get-KmLicenseMac([string]$Canonical) {
    $salt = 'KM-LIC-0lxIgWztG9EsnHpASPjIi3Z3ocQNQyCQ'
    $hmac = New-Object System.Security.Cryptography.HMACSHA256
    $hmac.Key = [Text.Encoding]::UTF8.GetBytes($salt)
    try {
      $bytes = $hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes('KM-LIC1|' + $Canonical))
      $hex = -join ($bytes | ForEach-Object { $_.ToString('X2') })
      return $hex.Substring(0, 8)
    } finally {
      $hmac.Dispose()
    }
  }

  if (-not (Test-Path $userRoot)) {
    New-Item -ItemType Directory -Force -Path $userRoot | Out-Null
  }
  Save-KmInstallInfo $paths $userRoot

  $lic = Read-JsonFile $licenseFile @{ usedCodes = @(); expiresAt = $null; activatedAt = $null }
  $pick = if ($Kind -eq 'quarter') { Get-NextUnusedQuarterCode $lic } else { Get-NextUnusedCode $lic }

  $usedList = New-Object System.Collections.Generic.List[string]
  if ($lic -and $lic.usedCodes) {
    foreach ($c in @($lic.usedCodes)) { if ($c) { $usedList.Add([string]$c) } }
  }
  if ($usedList.Contains($pick.code)) { throw 'Code already used' }
  $usedList.Add($pick.code)

  $now = Get-Date
  $exp = if ($Kind -eq 'quarter') { $now.AddMonths(3) } else { $now.AddDays(365) }
  $sourceName = if ($Kind -eq 'quarter') { 'kod3.cmd' } else { 'kod.cmd' }
  $payload = @{
    usedCodes         = @($usedList.ToArray())
    lastCode          = $pick.code
    lastKind          = $Kind
    activatedAt       = $now.ToUniversalTime().ToString('o')
    expiresAt         = $exp.ToUniversalTime().ToString('o')
  }
  if ($lic -and $null -ne $lic.machineStamp) { $payload.machineStamp = [string]$lic.machineStamp }
  if ($Kind -eq 'quarter') {
    $payload.nextQuarterScanIndex = [long]$pick.index + 1
    if ($lic -and $null -ne $lic.nextCodeScanIndex) { $payload.nextCodeScanIndex = [long]$lic.nextCodeScanIndex }
  } else {
    $payload.nextCodeScanIndex = [long]$pick.index + 1
    if ($lic -and $null -ne $lic.nextQuarterScanIndex) { $payload.nextQuarterScanIndex = [long]$lic.nextQuarterScanIndex }
  }
  Write-JsonFile $licenseFile $payload

  if (Test-Path $pendingFile) { Remove-Item $pendingFile -Force -ErrorAction SilentlyContinue }

  Write-JsonFile (Join-Path $userRoot 'km_auto_user_login.json') @{
    requestedAt = (Get-Date).ToUniversalTime().ToString('o')
    code        = $pick.code
    source      = $sourceName
  }

  Write-Host 'OK: KM activated'
  if ($Kind -eq 'quarter') {
    Write-Host 'Term: 3 months'
    Write-Host ('Code: ' + $pick.code)
  }
  Write-Host ('Valid until: ' + $exp.ToString('yyyy-MM-dd'))
  if ($paths.installRoot) {
    Write-Host ('KM install: ' + $paths.installRoot)
  }

  Start-KmApp $kmExe

  $null = Write-KmErrorLog -Source $sourceName -Message 'OK: KM activated' -Detail ("code=$($pick.code); until=$($exp.ToString('yyyy-MM-dd')); kind=$Kind; km=$kmExe; root=$($paths.installRoot)")
  exit 0
} catch {
  $detail = $_.Exception.Message
  if ($_.ScriptStackTrace) { $detail += ' | ' + $_.ScriptStackTrace }
  $src = if ($Kind -eq 'quarter') { 'kod3.cmd' } else { 'kod.cmd' }
  $null = Write-KmErrorLog -Source $src -Message 'Activation failed' -Detail $detail
  Write-Host ('ERROR: ' + $_.Exception.Message)
  Write-Host ('Log: ' + (Get-KmErrorLogPath))
  exit 1
}
