Unicode true
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"
!include "WinVer.nsh"

!define PRODUCT_NAME "KM"
!define PRODUCT_VERSION "v1.0.1"
!define PRODUCT_PUBLISHER "KM"
!define PRODUCT_REGKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\KM"

Name "${PRODUCT_NAME}"
Caption "KM Setup"
Icon "app\assets\km_icon.ico"
UninstallIcon "app\assets\km_icon.ico"
OutFile "dist\KM_Setup_x64.exe"
InstallDir "$LOCALAPPDATA\Programs\KM"
InstallDirRegKey HKCU "Software\KM" "InstallLocation"
RequestExecutionLevel user

; Standard NSIS-generated application manifest.
ManifestSupportedOS Win7 Win8 Win8.1 Win10
ManifestDPIAware true

SetCompressor zlib
CRCCheck force
ShowInstDetails show
ShowUninstDetails show
; KM_UPDATE_AUTO_SETUP_V1: /S completes without wizard; auto-close when silent
AutoCloseWindow true
BrandingText "KM"

VIProductVersion "1.0.1.0"
VIAddVersionKey /LANG=1033 "ProductName" "KM"
VIAddVersionKey /LANG=1033 "CompanyName" "KM"
VIAddVersionKey /LANG=1033 "FileDescription" "KM Setup"
VIAddVersionKey /LANG=1033 "FileVersion" "v1.0.1"
VIAddVersionKey /LANG=1033 "ProductVersion" "v1.0.1"
VIAddVersionKey /LANG=1033 "LegalCopyright" "KM"

!define MUI_ICON "app\assets\km_icon.ico"
!define MUI_UNICON "app\assets\km_icon.ico"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP "setup\km_header.bmp"
!define MUI_HEADERIMAGE_RIGHT
!define MUI_WELCOMEFINISHPAGE_BITMAP "setup\km_welcome.bmp"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "KM ծրագրի տեղադրում"
!define MUI_WELCOMEPAGE_TEXT "KM desktop ծրագրի ամբողջական offline տեղադրիչ այլ համակարգիչների համար։$\r$\n$\r$\n• Windows 7 / 8 / 8.1 / 10 / 11 (64-bit)$\r$\n• Electron runtime-ը ներառված է$\r$\n• Իրավաբանական անկյունի և գրադարանի ֆայլերը ներառված են$\r$\n• Ասիստենտի ամբողջ գիտելիքների բազան (~3.2 GB, ~2 րոպե հարց-պատասխան)$\r$\n• Պահանջվում է մոտ 4 GB ազատ տեղ$\r$\n• UserData-ն պահվում է առանձին$\r$\n• Տեղադրումից հետո պարտադիր է մեկանգամյա ակտիվացման կոդը"
!define MUI_FINISHPAGE_RUN "$INSTDIR\runtime\KM.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Գործարկել KM-ը"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH
!insertmacro MUI_LANGUAGE "English"

Function .onInit
  SetShellVarContext current
  ; KM_UPDATE_AUTO_SETUP_V1: honor /S (no UI hang on MessageBox)
  ${IfNot} ${RunningX64}
    IfSilent 0 +3
      SetErrorLevel 1610
      Quit
    MessageBox MB_ICONSTOP|MB_OK "KM x64 Setup requires 64-bit Windows."
    Quit
  ${EndIf}
  ${IfNot} ${AtLeastWin7}
    IfSilent 0 +3
      SetErrorLevel 1610
      Quit
    MessageBox MB_ICONSTOP|MB_OK "KM requires Windows 7 or newer."
    Quit
  ${EndIf}
  IfSilent 0 +2
    SetAutoClose true
FunctionEnd

; NSIS ${GetSize}/FileSeek is 32-bit and returns empty for files > 2GB.
; knowledge.db is ~3.2GB — read size via cmd %~zI (64-bit safe).
Function KmGetFileBytes
  Exch $0
  Push $1
  Push $2
  Push $3
  IfFileExists "$0" 0 km_gb_zero
  nsExec::ExecToStack '"$SYSDIR\cmd.exe" /c @for %I in ("$0") do @echo %~zI'
  Pop $1
  Pop $2
  StrCmp $1 "0" 0 km_gb_zero
  StrCmp $2 "" km_gb_zero
km_gb_trim:
  StrCpy $3 $2 1 -1
  StrCmp $3 "$\r" km_gb_chop
  StrCmp $3 "$\n" km_gb_chop
  StrCmp $3 " " km_gb_chop
  goto km_gb_ok
km_gb_chop:
  StrCpy $2 $2 -1
  goto km_gb_trim
km_gb_ok:
  StrCpy $0 $2
  goto km_gb_done
km_gb_zero:
  StrCpy $0 "0"
km_gb_done:
  Pop $3
  Pop $2
  Pop $1
  Exch $0
FunctionEnd

; Stack: byte-size string -> "1" if >= 1.8e9 bytes, else "0"
Function KmBytesGe1_8GB
  Exch $0
  Push $1
  Push $2
  StrLen $1 $0
  IntCmp $1 10 km_ge_ten km_ge_no km_ge_yes
km_ge_ten:
  StrCpy $2 $0 2
  IntCmp $2 18 km_ge_yes km_ge_no km_ge_yes
km_ge_yes:
  StrCpy $0 "1"
  goto km_ge_done
km_ge_no:
  StrCpy $0 "0"
km_ge_done:
  Pop $2
  Pop $1
  Exch $0
FunctionEnd

Section "KM" SEC_MAIN
  SetShellVarContext current
  CreateDirectory "$INSTDIR"
  CreateDirectory "$LOCALAPPDATA\KM\UserData"


  ; ===== CLEAN LEGACY INSTALLATION ARTIFACTS =====
  ; Preserve: $LOCALAPPDATA\KM\UserData
  ; Remove only obsolete program/runtime/diagnostic artifacts from earlier builds.
  DetailPrint "Cleaning obsolete KM program artifacts..."

  ; Stop every old executable name that was used in previous experiments.
  nsExec::ExecToLog 'taskkill /IM KM.exe /F'
  nsExec::ExecToLog 'taskkill /IM KM_Launcher.exe /F'
  nsExec::ExecToLog 'taskkill /IM KMServer.exe /F'
  nsExec::ExecToLog 'taskkill /IM electron.exe /F'

  ; Old desktop/start-menu shortcuts and stray Start Menu exe (not a .lnk).
  Delete "$DESKTOP\KM.lnk"
  Delete "$DESKTOP\Grafik.lnk"
  Delete "$SMPROGRAMS\KM.lnk"
  Delete "$SMPROGRAMS\KM.exe"
  Delete "$SMPROGRAMS\KM\KM.lnk"
  Delete "$SMPROGRAMS\KM\Հեռացնել KM-ը.lnk"
  Delete "$SMPROGRAMS\KM\ХЂХҐХјХЎЦЃХ¶ХҐХ¬ KM-ХЁ.lnk"
  RMDir /r "$SMPROGRAMS\KM"

  ; Old launcher/server/bootstrap files if present.
  Delete "$INSTDIR\KM_Launcher.exe"
  Delete "$INSTDIR\KMServer.exe"
  Delete "$INSTDIR\launcher.exe"
  Delete "$INSTDIR\setup.log"
  RMDir /r "$INSTDIR\launcher"
  RMDir /r "$INSTDIR\diagnostic"

  ; Remove old runtime/application only.
  RMDir /r "$INSTDIR\runtime"

  ; Old Aug-13 layout installed Electron at $INSTDIR root (not runtime\).
  ; Keep $INSTDIR\UserData, data, docs.
  Delete "$INSTDIR\KM.exe"
  Delete "$INSTDIR\electron.exe"
  Delete "$INSTDIR\index.html"
  Delete "$INSTDIR\Uninstall KM.exe"
  Delete "$INSTDIR\Uninstall.exe"
  Delete "$INSTDIR\chrome_100_percent.pak"
  Delete "$INSTDIR\chrome_200_percent.pak"
  Delete "$INSTDIR\d3dcompiler_47.dll"
  Delete "$INSTDIR\ffmpeg.dll"
  Delete "$INSTDIR\icudtl.dat"
  Delete "$INSTDIR\libEGL.dll"
  Delete "$INSTDIR\libGLESv2.dll"
  Delete "$INSTDIR\LICENSE"
  Delete "$INSTDIR\LICENSE.electron.txt"
  Delete "$INSTDIR\LICENSES.chromium.html"
  Delete "$INSTDIR\resources.pak"
  Delete "$INSTDIR\snapshot_blob.bin"
  Delete "$INSTDIR\v8_context_snapshot.bin"
  Delete "$INSTDIR\vk_swiftshader.dll"
  Delete "$INSTDIR\vk_swiftshader_icd.json"
  Delete "$INSTDIR\vulkan-1.dll"
  Delete "$INSTDIR\AUDIT_REPORT.txt"
  Delete "$INSTDIR\FULL_TEST_REPORT.txt"
  Delete "$INSTDIR\README.txt"
  Delete "$INSTDIR\START-HERE.cmd"
  RMDir /r "$INSTDIR\locales"
  RMDir /r "$INSTDIR\resources"

  ; Experimental binaries next to UserData (never delete UserData).
  Delete "$LOCALAPPDATA\KM\KM.exe"
  Delete "$LOCALAPPDATA\KM\KMBackend.exe"
  Delete "$LOCALAPPDATA\KM\KMDesktop.exe"
  Delete "$LOCALAPPDATA\KM\Uninstall KM.exe"
  Delete "$LOCALAPPDATA\KM\KMHost.cs"
  Delete "$LOCALAPPDATA\KM\Microsoft.Web.WebView2.Core.dll"
  Delete "$LOCALAPPDATA\KM\Microsoft.Web.WebView2.WinForms.dll"
  Delete "$LOCALAPPDATA\KM\WebView2Loader.dll"
  Delete "$LOCALAPPDATA\KM\AUDIT_REPORT.txt"
  Delete "$LOCALAPPDATA\KM\FULL_TEST_REPORT.txt"
  Delete "$LOCALAPPDATA\KM\README.txt"
  Delete "$LOCALAPPDATA\KM\KM_startup_log.txt"
  RMDir /r "$LOCALAPPDATA\KM\app"
  RMDir /r "$LOCALAPPDATA\KM\ElectronNpmCache"

  ; Remove diagnostic folders created by old experimental builds.
  RMDir /r "$LOCALAPPDATA\KM\Diagnostic"
  RMDir /r "$LOCALAPPDATA\KM\Launcher"
  RMDir /r "$LOCALAPPDATA\KM\Installer"

  ; Remove old temporary setup extraction folders.
  RMDir /r "$TEMP\KM_Setup_Files"
  RMDir /r "$TEMP\KM_NSIS_BUILD_V11"
  Delete "$TEMP\KM_Setup_x64_test.exe"
  Delete "$TEMP\km_logo_for_ico.png"

  ; IMPORTANT: never remove $LOCALAPPDATA\KM\UserData
  CreateDirectory "$LOCALAPPDATA\KM\UserData"
  ; ===== END CLEANUP =====

  CreateDirectory "$INSTDIR\runtime"

  DetailPrint "Installing bundled Electron 22 x64 runtime..."
  SetOutPath "$INSTDIR\runtime"
  File /r "payload\runtime\x64\*.*"

  ; Validate the runtime before renaming electron.exe.
  IfFileExists "$INSTDIR\runtime\electron.exe" runtime_exe_ok 0
    MessageBox MB_ICONSTOP|MB_OK "Electron runtime-ը չի գտնվել։"
    Abort
runtime_exe_ok:
  IfFileExists "$INSTDIR\runtime\icudtl.dat" runtime_icu_ok 0
    MessageBox MB_ICONSTOP|MB_OK "Electron runtime-ը թերի է՝ icudtl.dat չկա։"
    Abort
runtime_icu_ok:
  IfFileExists "$INSTDIR\runtime\resources\*.*" runtime_res_ok 0
    MessageBox MB_ICONSTOP|MB_OK "Electron resources պանակը չկա։"
    Abort
runtime_res_ok:

  Delete "$INSTDIR\runtime\KM.exe"
  Rename "$INSTDIR\runtime\electron.exe" "$INSTDIR\runtime\KM.exe"
  IfFileExists "$INSTDIR\runtime\KM.exe" renamed_ok 0
    MessageBox MB_ICONSTOP|MB_OK "KM.exe ստեղծել չհաջողվեց։"
    Abort
renamed_ok:
  SetOutPath "$INSTDIR\runtime"
  File "/oname=km_icon.ico" "app\assets\km_icon.ico"

  ; Application files — full staged app tree (js, data, assets, vendor, scripts, bytenode, ws).
  ; BUILD_SETUP.ps1 already excluded node_modules (except bytenode/ws) and data\bulk-import.
  DetailPrint "Installing KM application files..."
  SetOutPath "$INSTDIR\runtime\resources\app"
  File /r "app\*.*"
  CreateDirectory "$INSTDIR\update_src"
  SetOutPath "$INSTDIR\update_src"
  File /r "update_src\*.*"
  CreateDirectory "$INSTDIR\dist"
  CopyFiles /SILENT "$EXEPATH" "$INSTDIR\dist\KM_Setup_x64.exe"
  Delete "$INSTDIR\runtime\resources\app\km_hub_addr.js"
  Delete "$INSTDIR\runtime\resources\app\km_hub_addr.jsc"
  Delete "$INSTDIR\runtime\resources\app\assets\1.png"
  RMDir /r "$INSTDIR\runtime\resources\app\data\bulk-import"
  Delete "$INSTDIR\runtime\resources\app\data\curriculum34-seed-data.js"

  ; KM_ORPHAN_25836_HTML_DELETE_V1 — foreign/old Unit Archive HTML (GUARD extra); keep km_unit_archive_25836.json
  Delete "$INSTDIR\runtime\resources\app\data\25836_unit_archive.html"
  Delete "$INSTDIR\resources\app\data\25836_unit_archive.html"
  ; KM_RETIRED_FILES_V1 - retired modules are not sealed in km_integrity.json (GUARD "foreign/old file")
  Delete "$INSTDIR\runtime\resources\app\js\km-person-card-archive.js"
  Delete "$INSTDIR\resources\app\js\km-person-card-archive.js"
  Delete "$INSTDIR\runtime\resources\app\km-soldier-card-archive-main.cjs"
  Delete "$INSTDIR\resources\app\km-soldier-card-archive-main.cjs"
  Delete "$INSTDIR\runtime\resources\app\KM_UPDATE_ORIGIN"
  RMDir /r "$INSTDIR\kodmutq"
  RMDir /r "$INSTDIR\runtime\resources\app\kodmutq"
  ; Strip leftover build scripts from older Setups (GUARD extra-file warning).
  RMDir /r "$INSTDIR\runtime\resources\app\scripts"
  CreateDirectory "$INSTDIR\runtime\resources\app\scripts"
  SetOutPath "$INSTDIR\runtime\resources\app\scripts"

  ; Verify every required app file.
  IfFileExists "$INSTDIR\runtime\resources\app\index.html" +2 0
    Abort "index.html missing"
  IfFileExists "$INSTDIR\runtime\resources\app\main.js" +2 0
    Abort "main.js missing"
  IfFileExists "$INSTDIR\runtime\resources\app\preload.js" +2 0
    Abort "preload.js missing"
  IfFileExists "$INSTDIR\runtime\resources\app\package.json" +2 0
    Abort "package.json missing"
  IfFileExists "$INSTDIR\runtime\resources\app\office_backend.js" +2 0
    Abort "office_backend.js missing"
  IfFileExists "$INSTDIR\runtime\resources\app\km_shtatka.js" +2 0
    Abort "km_shtatka.js missing"
  IfFileExists "$INSTDIR\runtime\resources\app\km_guard.js" +2 0
    Abort "km_guard.js missing"
  IfFileExists "$INSTDIR\runtime\resources\app\km_net.js" +2 0
    Abort "km_net.js missing"
  IfFileExists "$INSTDIR\runtime\resources\app\km_lan_sync.js" +2 0
    Abort "km_lan_sync.js missing"
  IfFileExists "$INSTDIR\runtime\resources\app\km_crypto_store.js" +2 0
    Abort "km_crypto_store.js missing"
  IfFileExists "$INSTDIR\runtime\resources\app\km_secrets_load.js" +2 0
    Abort "km_secrets_load.js missing"
  IfFileExists "$INSTDIR\runtime\resources\app\km_security_secrets.js" +2 0
    Abort "km_security_secrets.js missing"
  IfFileExists "$INSTDIR\runtime\resources\app\km_version.js" +2 0
    Abort "km_version.js missing"
  IfFileExists "$INSTDIR\runtime\resources\app\km_version.json" +2 0
    Abort "km_version.json missing"
  IfFileExists "$INSTDIR\runtime\resources\app\km_integrity.json" +2 0
    Abort "km_integrity.json missing"
  IfFileExists "$INSTDIR\runtime\resources\app\km_license.js" +2 0
    Abort "km_license.js missing"
  IfFileExists "$INSTDIR\runtime\resources\app\km_owner_vault.js" +2 0
    Abort "km_owner_vault.js missing"
  IfFileExists "$INSTDIR\runtime\resources\app\km_bot_rag.js" +2 0
    Abort "km_bot_rag.js missing"
  IfFileExists "$INSTDIR\runtime\resources\app\km_bot_knowledge.js" +2 0
    Abort "km_bot_knowledge.js missing"
  IfFileExists "$INSTDIR\runtime\resources\app\km_help_bot_core.js" +2 0
    Abort "km_help_bot_core.js missing"
  IfFileExists "$INSTDIR\runtime\resources\app\node_modules\ws\package.json" +2 0
    Abort "ws module missing"
  IfFileExists "$INSTDIR\runtime\resources\app\km_domain_router.js" +2 0
    Abort "km_domain_router.js missing"
  IfFileExists "$INSTDIR\runtime\resources\app\km_text_clean.js" +2 0
    Abort "km_text_clean.js missing"
  IfFileExists "$INSTDIR\runtime\resources\app\km_sqlite_bridge.js" +2 0
    Abort "km_sqlite_bridge.js missing"
  IfFileExists "$INSTDIR\runtime\resources\app\km_sqlite_worker.js" +2 0
    Abort "km_sqlite_worker.js missing"
  IfFileExists "$INSTDIR\runtime\resources\app\km_edge_tts.js" +2 0
    Abort "km_edge_tts.js missing"
  IfFileExists "$INSTDIR\runtime\resources\app\js\km-error-log.js" +2 0
    Abort "km-error-log.js missing"
  IfFileExists "$INSTDIR\runtime\resources\app\js\km-notes-calendar.js" +2 0
    Abort "km-notes-calendar.js missing"
  IfFileExists "$INSTDIR\runtime\resources\app\js\km-extensions.js" +2 0
    Abort "km-extensions.js missing"
  IfFileExists "$INSTDIR\runtime\resources\app\js\km-net-ui.js" +2 0
    Abort "km-net-ui.js missing"
  IfFileExists "$INSTDIR\runtime\resources\app\js\km-ops.js" +2 0
    Abort "km-ops.js missing"
  IfFileExists "$INSTDIR\runtime\resources\app\js\km-extra-tools.js" +2 0
    Abort "km-extra-tools.js missing"
  IfFileExists "$INSTDIR\runtime\resources\app\js\km-troop-structure.js" +2 0
    Abort "km-troop-structure.js missing"
  IfFileExists "$INSTDIR\runtime\resources\app\js\km-unit-tools.js" +2 0
    Abort "km-unit-tools.js missing"
  IfFileExists "$INSTDIR\runtime\resources\app\js\km-trial-lab.js" +2 0
    Abort "km-trial-lab.js missing"
  IfFileExists "$INSTDIR\runtime\resources\app\js\km-person-linked.js" +2 0
    Abort "km-person-linked.js missing"
  IfFileExists "$INSTDIR\runtime\resources\app\js\km-shtat-catalog-data.js" +2 0
    Abort "km-shtat-catalog-data.js missing"
  IfFileExists "$INSTDIR\runtime\resources\app\js\km-positions.js" +2 0
    Abort "km-positions.js missing"
  IfFileExists "$INSTDIR\runtime\resources\app\data\km_shtat_catalog.json" +2 0
    Abort "km_shtat_catalog.json missing"
  IfFileExists "$INSTDIR\runtime\resources\app\data\km_soldier_rights.json" +2 0
    Abort "km_soldier_rights.json missing"
  IfFileExists "$INSTDIR\runtime\resources\app\data\km_arlis_military_catalog.json" +2 0
    Abort "km_arlis_military_catalog.json missing"
  IfFileExists "$INSTDIR\runtime\resources\app\data\arlis_military_docs" +2 0
    Abort "arlis_military_docs missing"
  IfFileExists "$INSTDIR\runtime\resources\app\data\km_help_bot.json" +2 0
    Abort "km_help_bot.json missing"
  IfFileExists "$INSTDIR\runtime\resources\app\data\km_usum_books_catalog.json" +2 0
    Abort "km_usum_books_catalog.json missing"
  IfFileExists "$INSTDIR\runtime\resources\app\data\km_order_templates.json" +2 0
    Abort "km_order_templates.json missing"
  IfFileExists "$INSTDIR\runtime\resources\app\data\soldier_rights_docs" +2 0
    Abort "soldier_rights_docs missing"
  ; KM_NO_SHTATKA_XLSX_IN_SETUP_V1 — Excel shtatka removed; Unit Archive JSON is the source
  IfFileExists "$INSTDIR\runtime\resources\app\data\km_unit_archive_25836.json" +2 0
    Abort "km_unit_archive_25836.json missing"
  IfFileExists "$INSTDIR\runtime\resources\app\js\km-soldier-rights.js" +2 0
    Abort "km-soldier-rights.js missing"
  IfFileExists "$INSTDIR\runtime\resources\app\js\km-help-bot-shield.js" +2 0
    Abort "km-help-bot-shield.js missing"
  IfFileExists "$INSTDIR\runtime\resources\app\js\km-help-bot-llm.js" +2 0
    Abort "km-help-bot-llm.js missing"
  IfFileExists "$INSTDIR\runtime\resources\app\js\km-help-bot.js" +2 0
    Abort "km-help-bot.js missing"
  IfFileExists "$INSTDIR\runtime\resources\app\js\km-section-upgrades.js" +2 0
    Abort "km-section-upgrades.js missing"
  IfFileExists "$INSTDIR\runtime\resources\app\js\km-person-dossiers.js" +2 0
    Abort "km-person-dossiers.js missing"
  IfFileExists "$INSTDIR\runtime\resources\app\km_ops_logic.js" +2 0
    Abort "km_ops_logic.js missing"
  IfFileExists "$INSTDIR\runtime\resources\app\assets\km_icon.ico" +2 0
    Abort "km_icon.ico missing"
  IfFileExists "$INSTDIR\runtime\resources\app\assets\km_bg.jpg" +2 0
    Abort "km_bg.jpg missing"
  IfFileExists "$INSTDIR\runtime\resources\app\vendor\jszip.min.js" +2 0
    Abort "jszip.min.js missing"

  ; Owner-only: never ship kod.cmd / kod3.cmd / kod_codes.txt.
  ; Helpers stay in the install so admin can apply a code from another machine.
  Delete "$INSTDIR\kod.cmd"
  Delete "$INSTDIR\kod3.cmd"
  Delete "$INSTDIR\scripts\kod_codes.txt"
  Delete "$INSTDIR\payload\kod_codes.txt"
  RMDir /r "$INSTDIR\kodmutq"
  RMDir /r "$INSTDIR\runtime\resources\app\kodmutq"
  SetOutPath "$INSTDIR"
  File "kod_stage.ps1"
  CreateDirectory "$INSTDIR\scripts"
  SetOutPath "$INSTDIR\scripts"
  File "scripts\kod_apply.cjs"
  File "scripts\kod_stage.ps1"
  File "scripts\km_error_log.ps1"

  ; Shortcuts point directly to the completely installed runtime.
  CreateShortcut "$DESKTOP\KM.lnk" "$INSTDIR\runtime\KM.exe" "" "$INSTDIR\runtime\km_icon.ico" 0 SW_SHOWNORMAL
  CreateDirectory "$SMPROGRAMS\KM"
  CreateShortcut "$SMPROGRAMS\KM\KM.lnk" "$INSTDIR\runtime\KM.exe" "" "$INSTDIR\runtime\km_icon.ico" 0 SW_SHOWNORMAL

  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateShortcut "$SMPROGRAMS\KM\Հեռացնել KM-ը.lnk" "$INSTDIR\Uninstall.exe"

  WriteRegStr HKCU "Software\KM" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${PRODUCT_REGKEY}" "DisplayName" "${PRODUCT_NAME}"
  WriteRegStr HKCU "${PRODUCT_REGKEY}" "DisplayVersion" "${PRODUCT_VERSION}"
  WriteRegStr HKCU "${PRODUCT_REGKEY}" "Publisher" "${PRODUCT_PUBLISHER}"
  WriteRegStr HKCU "${PRODUCT_REGKEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${PRODUCT_REGKEY}" "DisplayIcon" "$INSTDIR\runtime\km_icon.ico"
  WriteRegStr HKCU "${PRODUCT_REGKEY}" "UninstallString" '$\"$INSTDIR\Uninstall.exe$\"'
  WriteRegStr HKCU "${PRODUCT_REGKEY}" "QuietUninstallString" '$\"$INSTDIR\Uninstall.exe$\" /S'
  WriteRegDWORD HKCU "${PRODUCT_REGKEY}" "NoModify" 1
  WriteRegDWORD HKCU "${PRODUCT_REGKEY}" "NoRepair" 1

  ; After Setup — new activation code required. Registered users and this PC username stay.
  CreateDirectory "$LOCALAPPDATA\KM\UserData"
  Delete "$LOCALAPPDATA\KM\UserData\km_auto_user_login.json"
  Delete "$LOCALAPPDATA\KM\UserData\km_pending_activation.json"
  Delete "$LOCALAPPDATA\KM\UserData\km_admin_session.json"
  FileOpen $0 "$LOCALAPPDATA\KM\UserData\km_setup_require_activation" w
  FileWrite $0 "1"
  FileClose $0

  ; ===== Org names + unit kod + unit Excel archives (never kodmutq) =====
!ifdef KM_EMBED_ORG
  DetailPrint "Installing unit names, unit kod, and unit archives..."
  CreateDirectory "$LOCALAPPDATA\KM\UserData"
  SetOutPath "$LOCALAPPDATA\KM\UserData"
  File "payload\seed\org\km_org_seed.json"
  CreateDirectory "$LOCALAPPDATA\KM\UserData\unit_kod"
  SetOutPath "$LOCALAPPDATA\KM\UserData\unit_kod"
  File /r "payload\seed\org\unit_kod\*.*"
  CreateDirectory "$LOCALAPPDATA\KM\UserData\unit_archives"
  SetOutPath "$LOCALAPPDATA\KM\UserData\unit_archives"
  File /r "payload\seed\org\unit_archives\*.*"
!endif

  ; ===== BotKnowledge seed — always packed inside this Setup =====
!ifndef KM_EMBED_BOTKNOWLEDGE
  MessageBox MB_ICONSTOP|MB_OK "Այս Setup-ում BotKnowledge seed չկա։ Կառուցեք BUILD_SETUP.cmd առանց KM_SKIP_BOTKNOWLEDGE։"
  Abort
!endif
  DetailPrint "Installing BotKnowledge archive..."
  CreateDirectory "$INSTDIR\payload\seed"
  SetOutPath "$INSTDIR\payload\seed"
  File "payload\seed\BotKnowledge.7z"
  IfFileExists "$INSTDIR\payload\seed\BotKnowledge.7z" 0 kb_seed_fail
  InitPluginsDir
  CreateDirectory "$PLUGINSDIR\km_seed"
  SetOutPath "$PLUGINSDIR\km_seed"
  File "tools\7z\7z.exe"
  File "tools\7z\7z.dll"
  CreateDirectory "$INSTDIR\tools\7z"
  SetOutPath "$INSTDIR\tools\7z"
  File "tools\7z\7z.exe"
  File "tools\7z\7z.dll"
  !include "payload\seed\km_seed_pass.nsh"
  CreateDirectory "$LOCALAPPDATA\KM\UserData\BotKnowledge"
  Push "$LOCALAPPDATA\KM\UserData\BotKnowledge\knowledge.db"
  Call KmGetFileBytes
  Pop $R6
  DetailPrint "Existing knowledge.db bytes=$R6"
  Push $R6
  Call KmBytesGe1_8GB
  Pop $R5
  StrCmp $R5 "1" kb_seed_skip 0
  Delete "$LOCALAPPDATA\KM\UserData\BotKnowledge\knowledge.db-wal"
  Delete "$LOCALAPPDATA\KM\UserData\BotKnowledge\knowledge.db-shm"
  Delete "$LOCALAPPDATA\KM\UserData\BotKnowledge\knowledge.db-journal"
  IfFileExists "$LOCALAPPDATA\KM\UserData\BotKnowledge\knowledge.db" 0 kb_extract_go
    Delete "$LOCALAPPDATA\KM\UserData\BotKnowledge\knowledge.db"
  kb_extract_go:
  DetailPrint "Extracting BotKnowledge knowledge.db (this can take several minutes)..."
  nsExec::ExecToLog '"$PLUGINSDIR\km_seed\7z.exe" x -y "-p${KM_BOTKNOWLEDGE_PASS}" "-o$LOCALAPPDATA\KM\UserData\BotKnowledge" "$INSTDIR\payload\seed\BotKnowledge.7z"'
  Pop $0
  DetailPrint "BotKnowledge extract code=$0"
  Delete "$PLUGINSDIR\km_seed\7z.exe"
  Delete "$PLUGINSDIR\km_seed\7z.dll"
  RMDir "$PLUGINSDIR\km_seed"
  StrCmp $0 "0" 0 kb_seed_fail
  IfFileExists "$LOCALAPPDATA\KM\UserData\BotKnowledge\knowledge.db" 0 kb_seed_fail
  Push "$LOCALAPPDATA\KM\UserData\BotKnowledge\knowledge.db"
  Call KmGetFileBytes
  Pop $R6
  DetailPrint "Extracted knowledge.db bytes=$R6"
  Push $R6
  Call KmBytesGe1_8GB
  Pop $R5
  StrCmp $R5 "1" kb_seed_ok kb_seed_fail
  kb_seed_fail:
    IfSilent 0 +3
      SetErrorLevel 1603
      Abort
    MessageBox MB_ICONSTOP|MB_OK "BotKnowledge գիտելիքների բազան չտեղադրվեց։$\r$\n$\r$\nSetup-ը պետք է դուրս բերի knowledge.db (>=1.8 GB)։ Կրկին տեղադրեք կամ կառուցեք Setup-ը նորից։"
    Abort
  kb_seed_ok:
    DetailPrint "BotKnowledge seed extracted OK."
    Goto kb_seed_mark
  kb_seed_skip:
    DetailPrint "BotKnowledge already present and complete — left unchanged."
  kb_seed_mark:
  FileOpen $0 "$INSTDIR\payload\seed\BotKnowledge.READY.txt" w
  FileWrite $0 "knowledge.db=$LOCALAPPDATA\KM\UserData\BotKnowledge\knowledge.db$\r$\n"
  FileWrite $0 "archive=$INSTDIR\payload\seed\BotKnowledge.7z$\r$\n"
  FileClose $0

  DetailPrint "Opening LAN firewall ports 18094/18095/18096"
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="KM LAN HTTP" dir=in action=allow protocol=TCP localport=18094 profile=any enable=yes'
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="KM LAN WS" dir=in action=allow protocol=TCP localport=18096 profile=any enable=yes'
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="KM LAN UDP" dir=in action=allow protocol=UDP localport=18095 profile=any enable=yes'

  DetailPrint "KM installation completed."
  ; KM_UPDATE_AUTO_SETUP_V1 silent launch (Finish page skipped under /S)
  IfSilent 0 km_after_silent_launch
    SetAutoClose true
    Exec "$INSTDIR\runtime\KM.exe"
  km_after_silent_launch:
SectionEnd

Section "Uninstall"
  SetShellVarContext current
  nsExec::ExecToLog 'taskkill /IM KM.exe /F'
  IfSilent no_userdata 0
  MessageBox MB_YESNO|MB_ICONQUESTION "Ցանկանո՞ւմ եք ջնջել նաև օգտատիրոջ տվյալները (UserData)?$\r$\n$\r$\nՍա կմաքրի զրույցներ, LAN sync, cache և այլ UserData ֆայլեր։$\r$\nԳրաֆիկի տվյալները և BotKnowledge-ը նույնպես կջնջվեն, եթե պահված են UserData-ում։" IDNO no_userdata
  RMDir /r "$LOCALAPPDATA\KM\UserData"
  no_userdata:
  Delete "$DESKTOP\KM.lnk"
  Delete "$SMPROGRAMS\KM\KM.lnk"
  Delete "$SMPROGRAMS\KM\Հեռացնել KM-ը.lnk"
  Delete "$SMPROGRAMS\KM\ХЂХҐХјХЎЦЃХ¶ХҐХ¬ KM-ХЁ.lnk"
  RMDir "$SMPROGRAMS\KM"
  RMDir /r "$INSTDIR\runtime"
  RMDir /r "$INSTDIR\tools"
  Delete "$INSTDIR\kod.cmd"
  Delete "$INSTDIR\kod3.cmd"
  Delete "$INSTDIR\kod_stage.ps1"
  RMDir /r "$INSTDIR\scripts"
  RMDir /r "$INSTDIR\payload"
  Delete "$INSTDIR\Uninstall.exe"
  DeleteRegKey HKCU "${PRODUCT_REGKEY}"
  DeleteRegKey HKCU "Software\KM"
  RMDir "$INSTDIR"
  ; UserData preserved unless user chose Yes above.
SectionEnd
