@echo off
setlocal EnableExtensions
cd /d "%~dp0"

where node.exe >nul 2>&1
if not errorlevel 1 (
  node "%~dp0VERIFY_FINAL_SETUP.js"
  set "RC=%ERRORLEVEL%"
  echo.
  pause
  exit /b %RC%
)

set "PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%PS%" set "PS=%SystemRoot%\SysWOW64\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%PS%" (
  echo ERROR: Neither node.exe nor powershell.exe found for verification.
  pause
  exit /b 90
)
"%PS%" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0VERIFY_FINAL_SETUP.ps1"
set "RC=%ERRORLEVEL%"
echo.
pause
exit /b %RC%
