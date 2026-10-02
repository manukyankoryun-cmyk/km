@echo off
setlocal EnableExtensions
echo Closing KM...
taskkill /F /IM KM.exe /T >nul 2>&1
if errorlevel 1 (
  echo KM was not running.
) else (
  echo KM closed.
)
timeout /t 2 /nobreak >nul
exit /b 0
