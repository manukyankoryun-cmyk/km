@echo off
REM ============================================================================
REM KM SETUP BUILD ENTRY (inner project only)
REM Path: ...\KM_1.009.4_SEPARATE_FORMAL_DATA_PER_GRAPH\KM_1.009.4_SEPARATE_FORMAL_DATA_PER_GRAPH\BUILD_SETUP.cmd
REM Output: dist\KM_Setup_x64.exe
REM
REM This release includes (already in app\, sealed by writeIntegrity):
REM   - Admin/super-admin home org picker (hide after corps+unit)
REM   - Menu/home gated until corps+unit selected
REM   - Inventory: subdivision vs service path, Form 26/27/28, remainder
REM   - Position promotion: next-rank only (KM_PROMO_ARCHIVE_NEXT_RANK_V5)
REM   - Troop structure: vacant tab (KM_TROOP_VACANT_TAB_V1)
REM   - Reserve archive + duty types + bak/orphan cleanup
REM   - KM_KILL_SHTATKA_RADICAL_V1: Excel/SHTATKA staff source removed; Unit Archive only
REM   - KM_PURGE_SHTATKA_EXCEL_V1: build purges SHTATKA seeds (scripts\km-purge-shtatka-excel-v1.cjs)
REM   - km_shtatka.js ships as disabled stub (integrity filename kept; no Excel import)
REM   - KM_ACC_PERF_SKIP_NOOP_SYNC_V1: accounting skip no-op people sync / deferred soft sync
REM   - Archive-required banner opens unitArchive page
REM Versions: base=v1.0.0.000  update=v1.0.0.1 (app\km_version.json)
REM KM_AUDIT_BAK_CLEAN_V1 / KM_AUDIT_VERSION_V100400 / KM_RELEASE_MARKERS_V1 / KM_PURGE_SHTATKA_EXCEL_V1
REM ============================================================================
REM KM_AUDIT_BAK_CLEAN_V1: BUILD_SETUP.ps1 strips .bak/_audit_quarantine_bak and old BUILD_SETUP_*.log before pack
REM KM_AUDIT_VERSION_V100400: base=v1.0.0.000 update=v1.0.0.1 (from app\km_version.json; BUILD_SETUP.ps1 syncs package.json + NSIS)
setlocal EnableExtensions
cd /d "%~dp0"
echo ==========================================
echo   KM REAL NSIS OFFLINE SETUP BUILDER V50 (Unit Archive only, no SHTATKA xlsx)
echo ==========================================
echo.

set "PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%PS%" set "PS=%SystemRoot%\SysWOW64\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%PS%" (
  echo ERROR: powershell.exe not found under System32/SysWOW64.
  echo Open this project in Cursor - the agent builds Setup for you.
  echo.
  pause
  exit /b 90
)

echo Using: %PS%
"%PS%" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0BUILD_SETUP.ps1"
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" goto :failed
if not exist "%~dp0dist\KM_Setup_x64.exe" goto :missing
echo ==========================================
echo BUILD SUCCESS
echo dist\KM_Setup_x64.exe
echo ==========================================
for %%F in ("%~dp0dist\KM_Setup_x64.exe") do echo Size: %%~zF bytes
echo.
pause
exit /b 0

:missing
echo BUILD FAILED: dist\KM_Setup_x64.exe was not created.
echo.
pause
exit /b 91

:failed
echo BUILD FAILED. ErrorLevel=%RC%
echo Open BUILD_FAILURE_REPORT.txt and BUILD_SETUP.log
echo.
pause
exit /b %RC%