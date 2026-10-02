# Shared KM error log — %LOCALAPPDATA%\KM\UserData\km_errors.log
function Get-KmUserDataRoot {
  if ($env:LOCALAPPDATA) {
    return Join-Path $env:LOCALAPPDATA 'KM\UserData'
  }
  return Join-Path $env:USERPROFILE 'AppData\Local\KM\UserData'
}

function Get-KmErrorLogPath {
  return Join-Path (Get-KmUserDataRoot) 'km_errors.log'
}

function Write-KmErrorLog {
  param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Message,
    [string]$Detail = ''
  )
  try {
    $root = Get-KmUserDataRoot
    if (-not (Test-Path $root)) {
      New-Item -ItemType Directory -Force -Path $root | Out-Null
    }
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
  } catch {
    return $null
  }
}
