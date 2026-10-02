$ErrorActionPreference='Stop'
$Project=Split-Path -Parent $MyInvocation.MyCommand.Path
$p=Join-Path $Project 'dist\KM_Setup_x64.exe'
if(-not(Test-Path -LiteralPath $p -PathType Leaf)){
  throw 'dist\KM_Setup_x64.exe not found. BUILD_SETUP.cmd did not create a verified final output.'
}
$size=(Get-Item -LiteralPath $p).Length
if($size -lt 150MB){throw "Setup too small for embedded BotKnowledge: $size bytes (need >= 150MB)"}
$fs=[IO.File]::OpenRead($p)
try{$b0=$fs.ReadByte();$b1=$fs.ReadByte()}finally{$fs.Dispose()}
if($b0 -ne 0x4D -or $b1 -ne 0x5A){throw 'Not a Windows PE executable.'}
$hash=(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash
Write-Host 'PASS: KM_Setup_x64.exe' -ForegroundColor Green
Write-Host "Size: $size bytes"
Write-Host "SHA-256: $hash"
