@echo off

setlocal EnableExtensions

cd /d "%~dp0"

set "KM_KOD_KIND=quarter"

echo KM 3-month activation...

set "PS1=%~dp0kod_stage.ps1"

if not exist "%PS1%" set "PS1=%~dp0scripts\kod_stage.ps1"

if not exist "%PS1%" (

  echo ERROR: kod_stage.ps1 not found next to kod3.cmd

  pause

  exit /b 1

)

powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -Kind quarter -KodRoot "%~dp0."

if errorlevel 1 (

  echo ERROR: Could not activate KM.

  echo Log: %LOCALAPPDATA%\KM\UserData\km_errors.log

  pause

  exit /b 1

)

echo Done.

exit /b 0

