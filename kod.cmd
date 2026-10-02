@echo off
setlocal EnableExtensions
cd /d "%~dp0"
echo KM activation...
set "PS1=%~dp0kod_stage.ps1"
if not exist "%PS1%" set "PS1=%~dp0scripts\kod_stage.ps1"
if not exist "%PS1%" (
  echo ERROR: kod_stage.ps1 not found next to kod.cmd
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -KodRoot "%~dp0"
if errorlevel 1 (
  echo ERROR: Could not activate KM.
  echo Log: %LOCALAPPDATA%\KM\UserData\km_errors.log
  pause
  exit /b 1
)
echo Done.
exit /b 0
