$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$Project = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Project

$Tools   = Join-Path $Project '_tools'
$Cache   = Join-Path $Project '_cache'
$Payload = Join-Path $Project 'payload'
$Dist    = Join-Path $Project 'dist'
$Log     = Join-Path $Project 'BUILD_SETUP.log'
$LogAlt  = Join-Path $Project ("BUILD_SETUP_{0}.log" -f $PID)

New-Item -ItemType Directory -Force -Path $Tools,$Cache,$Payload,$Dist | Out-Null
try{
  "=== KM build started $(Get-Date -Format o) ===" | Set-Content -LiteralPath $Log -Encoding UTF8
}catch{
  $Log = $LogAlt
  "=== KM build started $(Get-Date -Format o) ===" | Set-Content -LiteralPath $Log -Encoding UTF8
  Write-Host "BUILD_SETUP.log locked, fallback log: $Log"
}

function Log([string]$s) {
  Write-Host $s
  try{
    Add-Content -LiteralPath $Log -Value $s -Encoding UTF8
  }catch{
    if($Log -ne $LogAlt){
      $Log = $LogAlt
      Add-Content -LiteralPath $Log -Value $s -Encoding UTF8
      Write-Host "Switched to fallback log: $Log"
    }
  }
}

# Retry delete so a locked electron.exe / bmp / staging folder does not fail the build.
function Remove-ItemSafe([string]$Path) {
  if(-not $Path){ return }
  if(-not (Test-Path -LiteralPath $Path)){ return }
  for($i = 1; $i -le 3; $i++){
    try {
      Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop
      return
    } catch {
      if($i -eq 3){ throw }
      Start-Sleep -Seconds 1
    }
  }
}

# Close leftover Electron/NSIS (and KM-related node) so payload electron.exe and setup bitmaps are not locked.
function Stop-KmLockedProcesses {
  Write-Host "Cleaning up locked processes and files..." -ForegroundColor Cyan
  $keep = New-Object 'System.Collections.Generic.HashSet[int]'
  try { [void]$keep.Add([int]$PID) } catch {}
  try {
    $cur = Get-CimInstance Win32_Process -Filter "ProcessId=$PID" -ErrorAction SilentlyContinue
    $guard = 0
    while($cur -and $cur.ParentProcessId -and $guard -lt 12){
      [void]$keep.Add([int]$cur.ParentProcessId)
      $cur = Get-CimInstance Win32_Process -Filter ("ProcessId=" + [int]$cur.ParentProcessId) -ErrorAction SilentlyContinue
      $guard++
    }
  } catch {}
  try {
    Get-Process -Name "electron","makensis" -ErrorAction SilentlyContinue |
      Where-Object { -not $keep.Contains([int]$_.Id) } |
      Stop-Process -Force -ErrorAction SilentlyContinue
  } catch {}
  try {
    Get-Process -Name "node" -ErrorAction SilentlyContinue | ForEach-Object {
      if($keep.Contains([int]$_.Id)){ return }
      $exe = ''
      try { $exe = [string]$_.Path } catch {}
      if($exe -match '(?i)\\Cursor\\'){ return }
      $cmd = ''
      try {
        $wmi = Get-CimInstance Win32_Process -Filter ("ProcessId=" + $_.Id) -ErrorAction SilentlyContinue
        $cmd = [string]$wmi.CommandLine
      } catch {}
      $hay = ($exe + ' ' + $cmd)
      if($hay -match '(?i)\\Cursor\\'){ return }
      $inProject = $Project -and ($hay.IndexOf($Project, [System.StringComparison]::OrdinalIgnoreCase) -ge 0)
      $kmNode = $hay -match '(?i)electron\.exe|compile-bytecode|rcedit|KM_NSIS_BUILD'
      if($inProject -or $kmNode){
        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
      }
    }
  } catch {}
  Start-Sleep -Seconds 2
}

Stop-KmLockedProcesses

# KM_NO_SHTATKA_XLSX_IN_SETUP_V1 / KM_PURGE_SHTATKA_EXCEL_V1 / KM_KILL_SHTATKA_RADICAL_V1 - SHTATKA xlsx removed; Unit Archive only; km_shtatka.js stub
function Assert-File([string]$Path,[string]$Label) {
  if(-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "$Label missing: $Path" }
  if((Get-Item -LiteralPath $Path).Length -le 0) { throw "$Label empty: $Path" }
}

function Test-Zip([string]$Path) {
  try {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $z=[IO.Compression.ZipFile]::OpenRead($Path)
    $count=$z.Entries.Count
    $z.Dispose()
    return ($count -gt 0)
  } catch { return $false }
}

# Copy every runtime app file into the NSIS stage (not a hand-maintained whitelist).
# Excludes: node_modules (except bytenode + ws), data\bulk-import, KM_UPDATE_ORIGIN.
function Copy-KmAppRuntime([string]$FromApp, [string]$ToApp) {
  if(-not (Test-Path -LiteralPath $FromApp -PathType Container)){
    throw "APP SOURCE MISSING: $FromApp"
  }
  New-Item -ItemType Directory -Force -Path $ToApp | Out-Null

  Get-ChildItem -LiteralPath $FromApp -File | Where-Object {
    $_.Name -ne 'KM_UPDATE_ORIGIN' -and $_.Name -ne 'package-lock.json' -and
    $_.Extension -match '\.(js|html|json|jsc)$'
  } | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $ToApp $_.Name) -Force
  }

  foreach($dir in @('js','vendor','assets')){
    if($dir -eq 'kodmutq'){ continue }
    $src = Join-Path $FromApp $dir
    if(Test-Path -LiteralPath $src){
      Copy-Item -LiteralPath $src -Destination (Join-Path $ToApp $dir) -Recurse -Force
    }
  }
  # KM_SINGLE_BG_V1: the app now uses ONE background (assets\km_bg.jpg); the old rotating photos are never packaged
  Get-ChildItem -LiteralPath (Join-Path $ToApp 'assets') -Filter 'military_bg_*.jpg' -File -ErrorAction SilentlyContinue | ForEach-Object { Remove-ItemSafe $_.FullName }
  # KM_AUDIT_BAK_CLEAN_V1: strip .bak / quarantine / orphan build logs from staged app before pack
  foreach($junkName in @('1.png','desktop.ini','Thumbs.db','_audit_quarantine_bak')){
    $junk = Join-Path $ToApp ('assets\' + $junkName)
    if(Test-Path -LiteralPath $junk -PathType Leaf){ Remove-ItemSafe $junk }
  }

  # KM_AUDIT_BAK_CLEAN_V1
  Get-ChildItem -LiteralPath $ToApp -Recurse -Force -ErrorAction SilentlyContinue |
    Where-Object {
      -not $_.PSIsContainer -and (
        $_.Name -like '*.bak' -or $_.Name -like '*.bak_*' -or $_.Name -like '*.bak*' -or
        $_.FullName -match '[\\/]_audit_quarantine_bak[\\/]'
      )
    } |
    ForEach-Object { Remove-ItemSafe $_.FullName }
  Get-ChildItem -LiteralPath $Project -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like 'BUILD_SETUP_*.log' -or $_.Name -like 'BUILD_SETUP_*.err.log' -or $_.Name -like 'BUILD_SETUP_*.pid' } |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-7) } |
    ForEach-Object { Remove-ItemSafe $_.FullName }


  # KM_CORE_NO_TEST_SCRIPTS_V1 / PR#7: never stage scripts/test-* into client Setup.
  # Leftovers on old clients are stripped by km_guard.stripLeftoverTestHarness on verify.
  $scriptDst = Join-Path $ToApp 'scripts'
  New-Item -ItemType Directory -Force -Path $scriptDst | Out-Null
  if(Test-Path -LiteralPath (Join-Path $FromApp 'scripts\strip-client-orphans.cjs')){
    # km_guard.jsc contains Electron V8 bytecode: running this hook under system Node yields cachedDataRejected.
    Invoke-KmElectronNode -NodeArgs @((Join-Path $FromApp 'scripts\strip-client-orphans.cjs'), $ToApp)
  }

  # KM_RETIRED_FILES_V1: retired modules must never be staged (GUARD reports unsealed files as foreign/old)
  foreach($retired in @('js\km-person-card-archive.js','km-soldier-card-archive-main.cjs')){
    $rp = Join-Path $ToApp $retired
    if(Test-Path -LiteralPath $rp){ Remove-Item -LiteralPath $rp -Force -ErrorAction SilentlyContinue; Log "retired file removed from stage: $retired" }
  }

  $dataSrc = Join-Path $FromApp 'data'
  $dataDst = Join-Path $ToApp 'data'
  $dataSkip = @('bulk-import','curriculum34-seed-data.js')
  if(Test-Path -LiteralPath $dataSrc -PathType Container){
    New-Item -ItemType Directory -Force -Path $dataDst | Out-Null
    Get-ChildItem -LiteralPath $dataSrc -Force | Where-Object {
      $dataSkip -notcontains $_.Name -and $_.Name -notmatch '^KM_.+_V1\.json$'
    } | ForEach-Object {
      Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $dataDst $_.Name) -Recurse -Force
    }
  }

  $nmDst = Join-Path $ToApp 'node_modules'
  foreach($mod in @('bytenode','ws')){
    $src = Join-Path $FromApp ('node_modules\' + $mod)
    if(Test-Path -LiteralPath $src){
      New-Item -ItemType Directory -Force -Path $nmDst | Out-Null
      Copy-Item -LiteralPath $src -Destination (Join-Path $nmDst $mod) -Recurse -Force
    }
  }

  $copied = @(Get-ChildItem -LiteralPath $ToApp -Recurse -File -ErrorAction SilentlyContinue).Count
  Get-ChildItem -LiteralPath $ToApp -Recurse -File -Force -ErrorAction SilentlyContinue | Where-Object {
    $_.Name -match '\.bak' -or $_.Name -like '_fix_*' -or $_.Name -like '_test_*' -or $_.Name -like '_reseal_*' -or $_.Name -like '_recover_*'
  } | ForEach-Object { Remove-ItemSafe $_.FullName }
  Log "APP RUNTIME STAGED: $copied files (bulk-import excluded)"
}

# Owner-only activation tools -- never pack into KM_Setup_x64.exe.
function Remove-KmActivationFromStage([string]$Root) {
  $names = @('kod.cmd','kod3.cmd','kod_codes.txt')
  $removed = 0
  Get-ChildItem -LiteralPath $Root -Recurse -File -Force -ErrorAction SilentlyContinue | Where-Object {
    $names -contains $_.Name
  } | ForEach-Object {
    Remove-ItemSafe $_.FullName
    $removed++
    Log ("EXCLUDED FROM SETUP: " + $_.FullName.Substring($Root.Length).TrimStart('\','/'))
  }
  Get-ChildItem -LiteralPath $Root -Recurse -Directory -Force -ErrorAction SilentlyContinue | Where-Object {
    $_.Name -eq 'kodmutq'
  } | Sort-Object FullName -Descending | ForEach-Object {
    Remove-ItemSafe $_.FullName
    $removed++
    Log ("EXCLUDED FROM SETUP: kodmutq " + $_.FullName)
  }
  Log "ACTIVATION FILES EXCLUDED: $removed"
}

function Download-Retry([string[]]$Urls,[string]$Out,[string]$Label) {
  if((Test-Path $Out) -and (Test-Zip $Out)) {
    Log "CACHE OK: $Label"
    return
  }
  Remove-Item $Out -Force -ErrorAction SilentlyContinue
  try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

  $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
  $last = $null

  foreach($url in $Urls) {
    for($attempt=1;$attempt -le 3;$attempt++) {
      try {
        Log "DOWNLOAD: $Label attempt $attempt"
        Remove-Item $Out -Force -ErrorAction SilentlyContinue

        if($curl) {
          # curl follows SourceForge/GitHub redirects correctly and avoids saving
          # the SourceForge HTML download page as the ZIP.
          & $curl.Source -L --fail --silent --show-error --retry 2 --retry-delay 2 `
            -A "Mozilla/5.0 KM-Build/5.0" -o $Out $url
          if($LASTEXITCODE -ne 0){ throw "curl.exe exit code $LASTEXITCODE" }
        } else {
          $wc=New-Object System.Net.WebClient
          $wc.Headers.Add('User-Agent','Mozilla/5.0 KM-Build/5.0')
          $wc.DownloadFile($url,$Out)
        }

        if(-not (Test-Path $Out)){ throw "Download did not create a file." }
        $size=(Get-Item $Out).Length
        Log "DOWNLOADED BYTES: $size"
        if($size -lt 100000){ throw "Downloaded file is unexpectedly small ($size bytes)." }
        if(-not (Test-Zip $Out)){ throw "Downloaded file is not a valid ZIP." }

        Log "DOWNLOAD OK: $Label"
        return
      } catch {
        $last=$_
        Log "DOWNLOAD FAILED: $($_.Exception.Message)"
        Remove-Item $Out -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds ([Math]::Min(6,$attempt*2))
      }
    }
  }
  Log "AUTOMATIC DOWNLOAD FAILED: $Label"
  Log "You can place the official ZIP manually in _cache and rerun the build."
  throw "Unable to download $Label. Last error: $last"
}

function Expand-ZipFresh([string]$Zip,[string]$Dst) {
  if(Test-Path $Dst){ Remove-ItemSafe $Dst }
  New-Item -ItemType Directory -Force -Path $Dst | Out-Null
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [IO.Compression.ZipFile]::ExtractToDirectory($Zip,$Dst)
}

function Assert-ElectronRuntime([string]$Dir,[string]$Arch) {
  foreach($rel in @('electron.exe','icudtl.dat','resources')) {
    $p=Join-Path $Dir $rel
    if(-not (Test-Path $p)) { throw "Electron $Arch runtime validation failed: $p" }
  }
  $exe=Join-Path $Dir 'electron.exe'
  if((Get-Item $exe).Length -lt 1000000) { throw "Electron $Arch electron.exe looks invalid/small." }
  Log "RUNTIME OK: Electron $Arch"
}

# KM_PROMOTION_ACCESS_STAFFINGCODE_V1 - ensure kmOpenPositionPromotion defines staffingCode
# (missing var caused ReferenceError; promotion section would not open)

# KM_RESERVE_ARCHIVE_V1 — keep reserve archive / vacant copy / unitReserve page on rebuild
function Repair-KmReserveArchiveV1([string]$AppJsDir) {
  $unit = Join-Path $AppJsDir 'km-unit-tools.js'
  $pos = Join-Path $AppJsDir 'km-positions.js'
  $users = Join-Path $AppJsDir 'km-users-ui.js'
  $core = Join-Path $AppJsDir 'km-v3-core.js'
  $idx = Join-Path (Split-Path -Parent $AppJsDir) 'index.html'
  $projApp = Join-Path $Project 'app'
  $projJs = Join-Path $projApp 'js'
  foreach ($pair in @(
    @{ dst = $unit; src = Join-Path $projJs 'km-unit-tools.js' },
    @{ dst = $pos; src = Join-Path $projJs 'km-positions.js' },
    @{ dst = $users; src = Join-Path $projJs 'km-users-ui.js' },
    @{ dst = $core; src = Join-Path $projJs 'km-v3-core.js' },
    @{ dst = $idx; src = Join-Path $projApp 'index.html' }
  )) {
    if ((Test-Path -LiteralPath $pair.src) -and (Test-Path -LiteralPath (Split-Path -Parent $pair.dst))) {
      $srcFull = [IO.Path]::GetFullPath($pair.src)
      $dstFull = [IO.Path]::GetFullPath($pair.dst)
      if ($srcFull -ieq $dstFull) { continue }
      Copy-Item -LiteralPath $pair.src -Destination $pair.dst -Force
      Log ('KM_RESERVE_ARCHIVE_V1 synced ' + [IO.Path]::GetFileName($pair.dst))
    }
  }
  if (Test-Path -LiteralPath $unit) {
    $txt = [IO.File]::ReadAllText($unit)
    if ($txt -notmatch 'unitReserve') { Log 'WARN KM_RESERVE_ARCHIVE_V1 unitReserve missing after sync' }
    else { Log 'KM_RESERVE_ARCHIVE_V1 unitReserve OK' }
  }
}
function Repair-KmPromotionAccessStaffingCode([string]$PositionsJs) {
  if (-not (Test-Path -LiteralPath $PositionsJs -PathType Leaf)) {
    throw ("KM_PROMOTION_ACCESS_STAFFINGCODE_V1 missing: " + $PositionsJs)
  }
  $enc = New-Object System.Text.UTF8Encoding $false
  $txt = [IO.File]::ReadAllText($PositionsJs, $enc)
  if ($txt -match 'KM_PROMOTION_ACCESS_STAFFINGCODE_V1') {
    Log 'KM_PROMOTION_ACCESS_STAFFINGCODE_V1 already present in km-positions.js'
    return
  }
  $rx = [regex]'closeModal\(\{\s*keepArchiveCtx:\s*true\s*\}\);\r?\n    var eligibleLabels = staffingCode \|\|'
  $m = $rx.Match($txt)
  if (-not $m.Success) { throw 'KM_PROMOTION_ACCESS_STAFFINGCODE_V1: anchor not found in km-positions.js' }
  $idx = $m.Index
  $nlPos = $txt.IndexOf([char]10, $idx)
  if ($nlPos -lt 0) { throw 'KM_PROMOTION_ACCESS_STAFFINGCODE_V1: anchor line end not found' }
  $before = $txt.Substring(0, $idx)
  $after = $txt.Substring($nlPos + 1)
  $dash = [char]0x2014
  $block = @(
    '    closeModal({ keepArchiveCtx: true });'
    '    /* KM_PROMOTION_ACCESS_STAFFINGCODE_V1: define code + refs before modal (was ReferenceError -> section dead) */'
    '    var staffingCode = String('
    "      (person && (person.postCode || person.posCode || person.code || person.staffCode || person.vus)) || ''"
    '    ).trim();'
    '    try {'
    '      window.__kmPromoPersonRef = person;'
    '      window.__kmPromoStaffingCode = staffingCode;'
    '    } catch (ePromoRef) {}'
    ('    var eligibleLabels = staffingCode || ''' + $dash + ''';')
  ) -join [char]10
  $block = $block + [char]10
  $newTxt = $before + $block + $after
  if ($newTxt -notmatch 'KM_PROMOTION_ACCESS_STAFFINGCODE_V1') { throw 'KM_PROMOTION_ACCESS_STAFFINGCODE_V1 patch failed' }
  [IO.File]::WriteAllText($PositionsJs, $newTxt, $enc)
  Log 'KM_PROMOTION_ACCESS_STAFFINGCODE_V1 applied to km-positions.js'
}

function Repair-KmPersonCardPromoEnsurePositions([string]$ExtJs) {
  if (-not (Test-Path -LiteralPath $ExtJs -PathType Leaf)) { throw ("KM_PERSON_CARD_PROMO_ENSURE_POSITIONS_V1 missing: " + $ExtJs) }
  $enc = New-Object System.Text.UTF8Encoding $false
  $txt = [IO.File]::ReadAllText($ExtJs, $enc)
  if ($txt -match 'KM_PERSON_CARD_PROMO_ENSURE_POSITIONS_V1') { Log 'KM_PERSON_CARD_PROMO_ENSURE_POSITIONS_V1 already present in km-extensions.js'; return }
  $rx = [regex]"var promoBtn = box\.querySelector\('#kmPersonCardPromote'\);[\s\S]{0,500}?var hishBtn = box\.querySelector\('#kmPersonCardHish'\);"
  $m = $rx.Match($txt)
  if (-not $m.Success) { throw 'KM_PERSON_CARD_PROMO_ENSURE_POSITIONS_V1: handler anchor not found' }
  $nl = [char]10
  $parts = New-Object System.Collections.Generic.List[string]
  $parts.Add("var promoBtn = box.querySelector('#kmPersonCardPromote');")
  $parts.Add("        if (promoBtn && canEdit) {")
  $parts.Add("          promoBtn.onclick = function () {")
  $parts.Add("            /* KM_PERSON_CARD_PROMO_ENSURE_POSITIONS_V1 */")
  $parts.Add("            var runPromo = function () {")
  $parts.Add("              try {")
  $parts.Add("                if (typeof window.kmOpenPositionPromotion === 'function') {")
  $parts.Add("                  window.kmOpenPositionPromotion(idx);")
  $parts.Add("                } else if (typeof toast === 'function') {")
  $parts.Add("                  toast('PROMOTION_UNAVAILABLE', 'warn');")
  $parts.Add("                }")
  $parts.Add("              } catch (ePromoOpen) {")
  $parts.Add("                if (typeof toast === 'function') {")
  $parts.Add("                  toast('PROMOTION_ERROR: ' + (ePromoOpen && ePromoOpen.message ? ePromoOpen.message : ePromoOpen), 'error');")
  $parts.Add("                }")
  $parts.Add("              }")
  $parts.Add("            };")
  $parts.Add("            if (typeof window.kmOpenPositionPromotion === 'function') {")
  $parts.Add("              runPromo();")
  $parts.Add("            } else if (typeof window.kmLoadPageModules === 'function') {")
  $parts.Add("              window.kmLoadPageModules('positions', runPromo);")
  $parts.Add("            } else if (typeof window.kmEnsureModule === 'function') {")
  $parts.Add("              try { window.kmEnsureModule('positions'); } catch (eEns) {}")
  $parts.Add("              setTimeout(runPromo, 120);")
  $parts.Add("            } else {")
  $parts.Add("              runPromo();")
  $parts.Add("            }")
  $parts.Add("          };")
  $parts.Add("        }")
  $parts.Add("        var hishBtn = box.querySelector('#kmPersonCardHish');")
  $block = ($parts -join $nl)
  $newTxt = $txt.Remove($m.Index, $m.Length).Insert($m.Index, $block)
  if ($newTxt -notmatch 'KM_PERSON_CARD_PROMO_ENSURE_POSITIONS_V1') { throw 'KM_PERSON_CARD_PROMO_ENSURE_POSITIONS_V1 patch failed' }
  [IO.File]::WriteAllText($ExtJs, $newTxt, $enc)
  Log 'KM_PERSON_CARD_PROMO_ENSURE_POSITIONS_V1 applied to km-extensions.js'
}

function Repair-KmPromotionCardAccessAlign([string]$PositionsJs) {
  if (-not (Test-Path -LiteralPath $PositionsJs -PathType Leaf)) { throw ("KM_PROMOTION_CARD_ACCESS_ALIGN_V1 missing: " + $PositionsJs) }
  $enc = New-Object System.Text.UTF8Encoding $false
  $txt = [IO.File]::ReadAllText($PositionsJs, $enc)
  if ($txt -match 'KM_PROMOTION_CARD_ACCESS_ALIGN_V1') { Log 'KM_PROMOTION_CARD_ACCESS_ALIGN_V1 already present in km-positions.js'; return }
  $oi = $txt.IndexOf('window.kmOpenPositionPromotion = function')
  if ($oi -lt 0) { throw 'KM_PROMOTION_CARD_ACCESS_ALIGN_V1: open fn not found' }
  $slice = $txt.Substring($oi, [Math]::Min(500, $txt.Length - $oi))
  $rx = [regex]'if\s*\(\s*!canEdit\(\)\s*\)\s*\{\s*toastMsg\([^)]+\);\s*return;\s*\}'
  $m = $rx.Match($slice)
  if (-not $m.Success) { throw 'KM_PROMOTION_CARD_ACCESS_ALIGN_V1: canEdit gate not found' }
  $abs = $oi + $m.Index
  $nl = [char]10
  $g = New-Object System.Collections.Generic.List[string]
  $g.Add("if (!canEdit()) {")
  $g.Add("      /* KM_PROMOTION_CARD_ACCESS_ALIGN_V1: same grants as person-card promote button */")
  $g.Add("      var cardEditOk = false;")
  $g.Add("      try {")
  $g.Add("        if (typeof window.kmCanEditPersonnelOp === 'function' && window.kmCanEditPersonnelOp('card')) cardEditOk = true;")
  $g.Add("        if (!cardEditOk && typeof window.kmCanEditPage === 'function' &&")
  $g.Add("            (window.kmCanEditPage('people') || window.kmCanEditPage('unitDossiers') || window.kmCanEditPage('troopStructure'))) {")
  $g.Add("          cardEditOk = true;")
  $g.Add("        }")
  $g.Add("        if (!cardEditOk && typeof window.kmCanEdit === 'function' &&")
  $g.Add("            (window.kmCanEdit('people') || window.kmCanEdit('unitDossiers') || window.kmCanEdit('troopStructure'))) {")
  $g.Add("          cardEditOk = true;")
  $g.Add("        }")
  $g.Add("      } catch (eCardEdit) {}")
  $g.Add("      if (!cardEditOk) { toastMsg('VIEW_ONLY', 'error'); return; }")
  $g.Add("    }")
  $gate = ($g -join $nl)
  $newTxt = $txt.Remove($abs, $m.Length).Insert($abs, $gate)
  if ($newTxt -notmatch 'KM_PROMOTION_CARD_ACCESS_ALIGN_V1') { throw 'KM_PROMOTION_CARD_ACCESS_ALIGN_V1 patch failed' }
  [IO.File]::WriteAllText($PositionsJs, $newTxt, $enc)
  Log 'KM_PROMOTION_CARD_ACCESS_ALIGN_V1 applied to km-positions.js'
}

function Assert-AppSource {
  $required=@(
    'app\index.html',
    'app\main.js',
    'app\preload.js',
    'app\package.json',
    'app\office_backend.js',
    'app\km_shtatka.js',
    'app\km_backend.js',
    'app\km_app_users_sync.js',
    'app\km_gemini_config.js',
    'app\km_license.js',
    'app\km_owner_vault.js',
    'app\km_library.js',
    'app\km_bot_rag.js',
    'app\km_bot_knowledge.js',
    'app\km_help_bot_core.js',
    'app\km_domain_router.js',
    'app\km_text_clean.js',
    'app\km_sqlite_bridge.js',
    'app\km_sqlite_worker.js',
    'app\km_edge_tts.js',
    'app\km_pdf_translate.js',
    'app\km_pdf_text.js',
    'app\km_fonts.js',
    'app\km_guard.js',
    'app\km_net.js',
    'app\km_lan_sync.js',
    'app\km_conversations.js',
    'app\km_retention.js',
    'app\km_crypto_store.js',
    'app\km_secrets_load.js',
    'app\km_security_secrets.js',
    'app\km_version.js',
    'app\km_version.json',
    'app\km_integrity.json',
    'app\js\km-services.js',
    'app\js\km-error-log.js',
    'app\js\km-features.js',
    'app\js\km-display-compat.js',
    'app\js\km-auto-focus.js',
    'app\js\km-v3-core.js',
    'app\js\km-v3-ext.js',
    'app\js\km-v3-tools.js',
    'app\js\km-license-ui.js',
    'app\js\km-auth-ui.js',
    'app\js\km-org-context.js',
    'app\js\km-users-ui.js',
    'app\js\km-discipline-penalties.js',
    'app\js\km-person-dossiers.js',
    'app\js\km-library-ui.js',
    'app\js\km-soldier-rights.js',
    'app\js\km-help-bot-shield.js',
    'app\js\km-help-bot-llm.js',
    'app\js\km-help-bot.js',
    'app\js\km-bg-slideshow.js',
    'app\js\km-formal.js',
    'app\js\km-i18n-extra.js',
    'app\js\km-notes-calendar.js',
    'app\js\km-spreadsheet.js',
    'app\js\km-extensions.js',
    'app\js\km-net-ui.js',
    'app\js\km-lan-client.js',
    'app\js\km-ops.js',
    'app\js\km-extra-tools.js',
    'app\js\km-troop-structure.js',
    'app\js\km-unit-tools.js',
    'app\js\km-trial-lab.js',
    'app\js\km-person-linked.js',
    'app\js\km-shtat-catalog-data.js',
    'app\js\km-positions.js',
    'app\data\km_shtat_catalog.json',
    'app\data\km_soldier_rights.json',
    'app\data\km_arlis_military_catalog.json',
    'app\data\km_help_bot.json',
    'app\data\km_help_bot_online.json',
    'app\data\km_order_templates.json',
    'app\data\km_usum_books_catalog.json',
    'app\data\km_unit_archive_25836.json',
    'app\js\km-section-upgrades.js',
    'app\js\km-sysinfo-ui.js',
    'app\km_ops_logic.js',
    'app\vendor\jszip.min.js',
    'KM_Setup_x64.nsi'
  )
  foreach($rel in $required){Assert-File (Join-Path $Project $rel) $rel}
  $docsDir = Join-Path $Project 'app\data\soldier_rights_docs'
  if(-not (Test-Path -LiteralPath $docsDir -PathType Container)){ throw 'app\data\soldier_rights_docs missing' }
  $docsCount = @(Get-ChildItem -LiteralPath $docsDir -Recurse -File -Include *.docx,*.pdf).Count
  if($docsCount -lt 20){ throw "soldier_rights_docs incomplete: $docsCount office files" }

  $allText=''
  foreach($rel in @('app\index.html','app\main.js','app\preload.js','app\office_backend.js','KM_Setup_x64.nsi')){
    $allText += [IO.File]::ReadAllText((Join-Path $Project $rel))
  }
  $forbiddenToken = ([char]75)+([char]68)+([char]87)+([char]105)+([char]110)
  if($allText -match [regex]::Escape($forbiddenToken)){
    throw 'Forbidden legacy keyboard reference found. Build stopped.'
  }
  $indexHtml=[IO.File]::ReadAllText((Join-Path $Project 'app\index.html'))
  # KM_OFFLINE_URL_AUDIT_V2:
  # WhatsApp links are intentionally allowed in the offline build.
  # The previous check only matched href="https://wa.me/<digits>", so
  # links with a path/query/message code were falsely detected as Web URLs.
  $indexScan=$indexHtml -replace '(?i)https?://wa\.me/[^"''\s<>]+','wa.me/'
  # KM_OFFLINE_URL_AUDIT_V3:
  # ARLIS legal-reference links are intentional: the application uses them
  # as references to Armenian legislation. They do not make the installer
  # itself dependent on the web, so they are excluded from this audit.
  $indexScan=$indexScan -replace '(?i)https?://(?:www\.)?arlis\.am/[^"''\s<>]+','arlis.am/'
  if($indexScan -match '(?i)https?://'){
    $urlMatches=[regex]::Matches($indexScan,'(?i)https?://[^"''\s<>]+') | ForEach-Object { $_.Value } | Select-Object -Unique
    $urlList=($urlMatches -join ', ')
    throw "Web URL found in app\index.html. Build stopped. URLs: $urlList"
  }
  # KM_LEGAL_RICH_V2: never build a reader without its offline source records.
  $legalIndexPath = Join-Path $Project 'app\data\legal-reader\index.json'
  Assert-File $legalIndexPath 'legal reader index'
  $legalIndex = [IO.File]::ReadAllText($legalIndexPath) | ConvertFrom-Json
  foreach($property in $legalIndex.records.PSObject.Properties){
    $record = $property.Value
    Assert-File (Join-Path $Project ('app\data\legal-reader\' + [string]$record.file)) ('legal text ' + $property.Name)
    if($record.formatted){
      Assert-File (Join-Path $Project ('app\data\legal-source-records\' + [string]$record.actId + '.json')) ('legal source ' + $property.Name)
    }
  }
  Assert-File (Join-Path $Project 'app\data\LEGAL_SOURCE_AUDIT.json') 'legal source audit'
  Log 'APP SOURCE AUDIT OK'
}


# KM_RELEASE_MARKERS_V1 (2026-09-22): refuse to pack without current product fixes.
function Assert-KmReleaseMarkers_V1 {
  $checks = @(
    @{ Rel = 'app\js\km-positions.js';       Needle = 'KM_PROMO_ARCHIVE_NEXT_RANK_V6'; Label = 'promo next-rank V6' },
    @{ Rel = 'app\js\km-troop-structure.js'; Needle = 'KM_TROOP_VACANT_TAB_V1';         Label = 'troop vacant tab' },
    @{ Rel = 'app\js\km-org-context.js';     Needle = 'kmEnsureOrgPicker';              Label = 'admin org picker' },
    @{ Rel = 'app\js\km-unit-tools.js';      Needle = 'KM_INV_PATH';                     Label = 'inventory path' },
    @{ Rel = 'app\js\km-unit-tools.js';      Needle = 'KM_INV_FORM_BY_PATH_V1';          Label = 'form 26/27 by path' },
    @{ Rel = 'app\js\km-unit-tools.js';      Needle = 'KM_F27_FULLSCREEN_V1';            Label = 'form 27 fullscreen' },
    @{ Rel = 'app\js\km-unit-tools.js';      Needle = 'KM_HAMALR_REPORT_V1';             Label = 'staffing report' },
    @{ Rel = 'app\js\km-unit-tools.js';      Needle = 'KM_APRANQ_V1';                    Label = 'incoming/outgoing invoices' },
    @{ Rel = 'app\index.html';               Needle = 'KM_COMPACT_CARDS_V2';             Label = 'compact cards + menu' },
    @{ Rel = 'app\js\km-help-bot.js';        Needle = 'KM_LEGAL_RENAME_V1';              Label = 'legal corner rename' },
    @{ Rel = 'app\js\km-auth-ui.js';         Needle = 'kmEnsureOrgPicker';              Label = 'auth org picker hook' },
        @{ Rel = 'app\js\km-unit-tools.js';      Needle = 'KM_UNIFIED_ARCHIVE_FLOW_V1_UT'; Label = 'unified archive flow UT' },
    @{ Rel = 'app\js\km-positions.js';       Needle = 'KM_ACC_PERF_SKIP_NOOP_SYNC_V1'; Label = 'accounting perf skip' },
    @{ Rel = 'app\js\km-positions.js';       Needle = 'KM_UNIFIED_ARCHIVE_FLOW_V1_POS'; Label = 'unified archive flow POS' },
    @{ Rel = 'app\js\km-org-context.js';     Needle = 'KM_UNIFIED_ARCHIVE_FLOW_V1_BANNER'; Label = 'archive banner unitArchive' },
    @{ Rel = 'app\km_shtatka.js';            Needle = 'KM_LEGACY_EXCEL_STUB_DISABLED_V1'; Label = 'legacy excel stub' },
    @{ Rel = 'scripts\km-purge-shtatka-excel-v1.cjs'; Needle = 'KM_PURGE_SHTATKA_EXCEL_V1'; Label = 'build purge script' },
    @{ Rel = 'app\km_version.json';          Needle = 'v1.0.1';                     Label = 'update version 1' }
  )
  foreach ($c in $checks) {
    $path = Join-Path $Project $c.Rel
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
      throw ("RELEASE MARKER missing file [{0}]: {1}" -f $c.Label, $c.Rel)
    }
    $txt = [IO.File]::ReadAllText($path)
    if ($txt.IndexOf($c.Needle, [StringComparison]::Ordinal) -lt 0) {
      throw ("RELEASE MARKER not found [{0}]: need '{1}' in {2}" -f $c.Label, $c.Needle, $c.Rel)
    }
  }
  # Scratch probe folders must never sit inside the inner project (would risk pack confusion).
  foreach ($bad in @('_km_extract', '_km_apply_inv_v1')) {
    $inside = Join-Path $Project $bad
    if (Test-Path -LiteralPath $inside) {
      throw ("Scratch folder must not be inside project: {0}" -f $inside)
    }
  }
  Log 'KM RELEASE MARKERS OK (promo V6, vacant tab, org picker, inv path, v1.0.1)'
}
Assert-AppSource
Assert-KmReleaseMarkers_V1
Repair-KmPromotionAccessStaffingCode (Join-Path $Project 'app\js\km-positions.js')
Repair-KmReserveArchiveV1 (Join-Path $Project 'app\js')
Repair-KmPromotionCardAccessAlign (Join-Path $Project 'app\js\km-positions.js')
Repair-KmPersonCardPromoEnsurePositions (Join-Path $Project 'app\js\km-extensions.js')
# KM_BYTECODE_NODE_V1: km_guard.jsc is Electron V8 bytecode — system Node rejects it (cachedDataRejected).
function Get-KmElectronNode {
  $cands = @()
  if($script:X64){ $cands += (Join-Path $script:X64 'electron.exe') }
  $cands += (Join-Path $Project 'payload\runtime\x64\electron.exe')
  if($env:KM_ELECTRON_PATH){ $cands += $env:KM_ELECTRON_PATH }
  foreach($c in $cands){
    if($c -and (Test-Path -LiteralPath $c -PathType Leaf)){ return (Resolve-Path -LiteralPath $c).Path }
  }
  throw 'Electron runtime missing for writeIntegrity (need payload\runtime\x64\electron.exe)'
}
function Invoke-KmElectronNode {
  param([Parameter(Mandatory=$true)][string[]]$NodeArgs)
  $ele = Get-KmElectronNode
  $prev = $env:ELECTRON_RUN_AS_NODE
  $env:ELECTRON_RUN_AS_NODE = '1'
  try {
    Log "KM_NODE(Electron): $ele $($NodeArgs -join ' ')"
    # Merge stderr into output without turning ErrorRecords into terminating errors
    $out = & $ele @NodeArgs 2>&1 | ForEach-Object {
      if ($_ -is [System.Management.Automation.ErrorRecord]) { $_.ToString() } else { "$_" }
    }
    $code = $LASTEXITCODE
    if($out){ foreach($line in @($out)){ if($line){ Log ("KM_NODE_OUT: " + $line) } } }
    if($code -ne 0){
      $tail = if($out){ (@($out) | Select-Object -Last 20) -join " | " } else { '(no output)' }
      throw ("KM Electron-node failed exit=$code :: $tail")
    }
  } finally {
    if($null -eq $prev){ Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue }
    else { $env:ELECTRON_RUN_AS_NODE = $prev }
  }
}

# KM_WRITE_INTEGRITY_CLI_V1 — never use electron -e for integrity (Windows quoting breaks it)
function Invoke-KmWriteIntegrity {
  param([Parameter(Mandatory=$true)][string]$AppDir)
  $script = Join-Path $Project 'scripts\km_write_integrity.cjs'
  if(-not (Test-Path -LiteralPath $script -PathType Leaf)){
    throw "km_write_integrity.cjs missing: $script"
  }
  if(-not (Test-Path -LiteralPath $AppDir -PathType Container)){
    throw "writeIntegrity appDir missing: $AppDir"
  }
  Invoke-KmElectronNode -NodeArgs @($script, $AppDir)
}


function Find-MakeNSIS {
  $candidates = New-Object System.Collections.Generic.List[string]

  # Normal installed locations.
  foreach($root in @(
    $env:ProgramFiles,
    ${env:ProgramFiles(x86)},
    $env:LOCALAPPDATA,
    $env:USERPROFILE
  )){
    if($root){
      $candidates.Add((Join-Path $root 'NSIS\makensis.exe'))
    }
  }

  # PATH.
  $cmd=Get-Command makensis.exe -ErrorAction SilentlyContinue
  if($cmd){$candidates.Add($cmd.Source)}

  # NSIS registry install path (32/64-bit views where available).
  foreach($regPath in @(
    'HKLM:\SOFTWARE\NSIS',
    'HKLM:\SOFTWARE\WOW6432Node\NSIS',
    'HKCU:\SOFTWARE\NSIS'
  )){
    try{
      $rp=(Get-ItemProperty -Path $regPath -ErrorAction Stop).'(default)'
      if(-not $rp){$rp=(Get-ItemProperty -Path $regPath -ErrorAction Stop).InstallDir}
      if($rp){$candidates.Add((Join-Path $rp 'makensis.exe'))}
    }catch{}
  }

  # Common non-default locations, including OneDrive/Desktop extraction.
  foreach($searchRoot in @(
    $env:ProgramFiles,
    ${env:ProgramFiles(x86)},
    (Join-Path $env:LOCALAPPDATA 'Programs'),
    (Join-Path $env:USERPROFILE 'Desktop'),
    (Join-Path $env:USERPROFILE 'OneDrive\Desktop'),
    (Join-Path $env:USERPROFILE 'Downloads')
  )){
    if($searchRoot -and (Test-Path $searchRoot)){
      try{
        Get-ChildItem -LiteralPath $searchRoot -Filter makensis.exe -File -Recurse -ErrorAction SilentlyContinue |
          Select-Object -First 5 | ForEach-Object {$candidates.Add($_.FullName)}
      }catch{}
    }
  }

  foreach($c in ($candidates | Select-Object -Unique)){
    if($c -and (Test-Path -LiteralPath $c -PathType Leaf)){
      try{
        $ver=(Get-Item -LiteralPath $c).VersionInfo.FileVersion
        Log "FOUND MAKENSIS: $c ; version=$ver"
      }catch{Log "FOUND MAKENSIS: $c"}
      return $c
    }
  }
  return $null
}

$MakeNSIS=Find-MakeNSIS
if(-not $MakeNSIS){
  Log ''
  Log 'NSIS compiler was not found.'
  $winget=Get-Command winget.exe -ErrorAction SilentlyContinue
  if($winget){
    Log "WinGet found: $($winget.Source)"
    Log 'Trying automatic NSIS installation with Windows Package Manager...'

    $ids=@('NSIS.NSIS','Nullsoft.NSIS')
    foreach($id in $ids){
      Log "WINGET TRY: $id"
      & $winget.Source install --id $id -e --source winget `
        --accept-package-agreements --accept-source-agreements --silent
      Log "winget exit code: $LASTEXITCODE"
      Start-Sleep -Seconds 3
      $MakeNSIS=Find-MakeNSIS
      if($MakeNSIS){break}
    }
  }else{
    Log 'winget.exe was not found.'
  }

  if(-not $MakeNSIS){
    Log ''
    Log 'Automatic NSIS installation did not succeed.'
    Log 'Opening the official NSIS project page as a manual fallback.'
    Start-Process 'https://sourceforge.net/projects/nsis/files/NSIS%203/3.12/'
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Yellow
    Write-Host 'Եթե browser-ը բացվեց, ընտրեք nsis-3.12-setup.exe,' -ForegroundColor Yellow
    Write-Host 'տեղադրեք այն, ապա պարզապես նորից գործարկեք BUILD_SETUP.cmd։' -ForegroundColor Yellow
    Write-Host 'Builder-ը հաջորդ մեկնարկին ավտոմատ կգտնի makensis.exe-ը։' -ForegroundColor Yellow
    Write-Host '============================================================' -ForegroundColor Yellow
    throw 'NSIS automatic installation failed. Install NSIS manually, then rerun BUILD_SETUP.cmd.'
  }
}
Log "NSIS OK: $MakeNSIS"


# ===== LOCAL ELECTRON RUNTIME REUSE =====
# Before any network download, reuse the already downloaded/extracted official
# Electron 22.3.27 runtime from older KM build folders on this same PC.
function Find-ExistingElectronZip([string]$Name){
  $roots=@(
    (Join-Path $env:USERPROFILE 'Desktop'),
    (Join-Path $env:USERPROFILE 'OneDrive\Desktop'),
    (Join-Path $env:USERPROFILE 'Downloads')
  )
  foreach($r in $roots){
    if(-not $r -or -not(Test-Path $r)){continue}
    try{
      $hit=Get-ChildItem -LiteralPath $r -Filter $Name -File -Recurse -ErrorAction SilentlyContinue |
        Where-Object {$_.FullName -ne (Join-Path $Cache $Name)} |
        Select-Object -First 1
      if($hit){return $hit.FullName}
    }catch{}
  }
  return $null
}

function Test-ElectronFolder([string]$Dir){
  if(-not $Dir -or -not(Test-Path $Dir)){return $false}
  return (
    (Test-Path (Join-Path $Dir 'electron.exe')) -and
    (Test-Path (Join-Path $Dir 'icudtl.dat')) -and
    (Test-Path (Join-Path $Dir 'resources'))
  )
}

function Find-ExistingElectronFolder([string]$Arch){
  $roots=@(
    (Join-Path $env:USERPROFILE 'Desktop'),
    (Join-Path $env:USERPROFILE 'OneDrive\Desktop')
  )
  foreach($r in $roots){
    if(-not $r -or -not(Test-Path $r)){continue}
    try{
      $candidates=Get-ChildItem -LiteralPath $r -Directory -Recurse -ErrorAction SilentlyContinue |
        Where-Object {
          $_.FullName -match ('payload\\runtime\\'+[regex]::Escape($Arch)+'$')
        } | Select-Object -First 20
      foreach($c in $candidates){
        if(Test-ElectronFolder $c.FullName){return $c.FullName}
      }
    }catch{}
  }
  return $null
}

function Reuse-ElectronCache([string]$Name,[string]$Out,[string]$Arch){
  if((Test-Path $Out) -and (Test-Zip $Out)){
    Log "CACHE OK: Electron $Arch"
    return $true
  }

  $existingZip=Find-ExistingElectronZip $Name
  if($existingZip){
    Log "FOUND EXISTING ELECTRON ZIP: $existingZip"
    Copy-Item -LiteralPath $existingZip -Destination $Out -Force
    if(Test-Zip $Out){
      Log "REUSED ELECTRON ZIP: $Arch"
      return $true
    }
    Remove-Item $Out -Force -ErrorAction SilentlyContinue
  }

  return $false
}
# ===== END LOCAL REUSE =====

# Electron 22.3.27 runtime ZIPs. Keep local cache so later rebuilds are offline.
$EVersion='22.3.27'
$X64=Join-Path $Payload 'runtime\x64'

function Test-ElectronFolder([string]$Dir){
  return (
    $Dir -and (Test-Path -LiteralPath $Dir -PathType Container) -and
    (Test-Path (Join-Path $Dir 'electron.exe')) -and
    (Test-Path (Join-Path $Dir 'icudtl.dat')) -and
    (Test-Path (Join-Path $Dir 'resources'))
  )
}

function Find-Npm {
  $cmd=Get-Command npm.cmd -ErrorAction SilentlyContinue
  if($cmd){return $cmd.Source}
  foreach($p in @(
    (Join-Path $env:ProgramFiles 'nodejs\npm.cmd'),
    (Join-Path ${env:ProgramFiles(x86)} 'nodejs\npm.cmd'),
    (Join-Path $env:LOCALAPPDATA 'Programs\nodejs\npm.cmd')
  )){
    if($p -and (Test-Path $p)){return $p}
  }
  return $null
}

function Ensure-Node {
  $npm=Find-Npm
  if($npm){Log "NPM OK: $npm"; return $npm}

  $winget=Get-Command winget.exe -ErrorAction SilentlyContinue
  if(-not $winget){throw 'Neither npm nor winget is available.'}

  Log 'Node.js/npm not found. Installing Node.js LTS with WinGet...'
  & $winget.Source install --id OpenJS.NodeJS.LTS -e --source winget `
    --accept-package-agreements --accept-source-agreements --silent
  Log "Node install exit code: $LASTEXITCODE"

  # Refresh PATH for common Node location.
  $env:Path="$env:ProgramFiles\nodejs;$env:Path"
  $npm=Find-Npm
  if(-not $npm){throw 'Node.js installation completed but npm.cmd was not found.'}
  Log "NPM OK AFTER INSTALL: $npm"
  return $npm
}

# First reuse a previously prepared runtime inside this project, if any.
if(Test-ElectronFolder $X64){
  Log "PAYLOAD RUNTIME OK: $X64"
}else{
  $Npm=Ensure-Node
  $NpmWork=Join-Path $env:TEMP 'KM_ELECTRON_NPM_V16'
  if(Test-Path $NpmWork){ Remove-ItemSafe $NpmWork }
  New-Item -ItemType Directory -Force -Path $NpmWork | Out-Null

  Log "PREPARING ELECTRON $EVersion THROUGH NPM..."
  Push-Location $NpmWork
  try{
    & $Npm init -y 2>&1 | Tee-Object -FilePath $Log -Append | Out-Host

    # Electron documentation explicitly supports a mirror via ELECTRON_MIRROR.
    # Use it first to avoid the GitHub path that stalled in previous builders.
    $env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
    $env:npm_config_cache=(Join-Path $env:LOCALAPPDATA 'KM\ElectronNpmCache')
    New-Item -ItemType Directory -Force -Path $env:npm_config_cache | Out-Null

    Log "NPM INSTALL: electron@$EVersion using npm + Electron mirrors"

    # Mirror both layers:
    # 1) npm package metadata/tarball
    # 2) Electron binary downloaded by electron/install.js
    $env:npm_config_registry='https://registry.npmmirror.com'
    $env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'

    # Do not hang forever on a blocked endpoint.
    $env:npm_config_fetch_retries='2'
    $env:npm_config_fetch_retry_mintimeout='2000'
    $env:npm_config_fetch_retry_maxtimeout='8000'
    $env:npm_config_fetch_timeout='30000'

    Log "NPM REGISTRY: $env:npm_config_registry"
    Log "ELECTRON MIRROR: $env:ELECTRON_MIRROR"

    $npmArgs=@(
      'install',
      "electron@$EVersion",
      '--save-exact',
      '--no-audit',
      '--no-fund',
      '--foreground-scripts',
      '--loglevel=verbose',
      '--registry=https://registry.npmmirror.com',
      '--fetch-timeout=30000',
      '--fetch-retries=2'
    )

    $proc=Start-Process -FilePath $Npm -ArgumentList $npmArgs `
      -WorkingDirectory $NpmWork -NoNewWindow -PassThru `
      -RedirectStandardOutput (Join-Path $NpmWork 'npm_stdout.log') `
      -RedirectStandardError  (Join-Path $NpmWork 'npm_stderr.log')

    $deadline=(Get-Date).AddMinutes(5)
    while(-not $proc.HasExited -and (Get-Date) -lt $deadline){
      Start-Sleep -Seconds 5
      Log "NPM STILL RUNNING... PID=$($proc.Id)"
    }

    if(-not $proc.HasExited){
      try{$proc.Kill()}catch{}
      throw "npm electron install exceeded 5 minutes and was stopped. See $NpmWork
pm_stdout.log and npm_stderr.log"
    }

    # Refresh process state before reading ExitCode.


    $proc.WaitForExit()


    $proc.Refresh()


    $npmRc=[int]$proc.ExitCode
    if(Test-Path (Join-Path $NpmWork 'npm_stdout.log')){
      Get-Content (Join-Path $NpmWork 'npm_stdout.log') | Tee-Object -FilePath $Log -Append | Out-Host
    }
    if(Test-Path (Join-Path $NpmWork 'npm_stderr.log')){
      Get-Content (Join-Path $NpmWork 'npm_stderr.log') | Tee-Object -FilePath $Log -Append | Out-Host
    }
  }finally{
    Pop-Location
  }
  Log "NPM EXIT CODE: $npmRc"
  $dist=Join-Path $NpmWork 'node_modules\electron\dist'

  # A complete Electron dist is the authoritative success check.
  if(Test-ElectronFolder $dist){
    Log "ELECTRON DIST VERIFIED: $dist"
  }else{
    if($npmRc -ne 0){throw "npm electron install failed with exit code $npmRc"}
    throw "npm exited but Electron dist is incomplete: $dist"
  }

  if(Test-Path $X64){ Remove-ItemSafe $X64 }
  New-Item -ItemType Directory -Force -Path $X64 | Out-Null
  Copy-Item (Join-Path $dist '*') $X64 -Recurse -Force
}

Assert-ElectronRuntime $X64 'x64'

function Ensure-KmIcon {
  $assetsScript = Join-Path $Project 'scripts\ensure_km_assets.ps1'
  Log 'ENSURING app/assets (logo, backgrounds, icon)...'
  & powershell -NoProfile -ExecutionPolicy Bypass -File $assetsScript
  $ico = Join-Path $Project 'app\assets\km_icon.ico'
  if(-not (Test-Path $ico)) { throw "km_icon.ico was not created: $ico" }
  Log "ICON OK: $ico"
}

function Set-PeIcon([string]$Exe) {
  $ico = Join-Path $Project 'app\assets\km_icon.ico'
  if(-not (Test-Path -LiteralPath $Exe -PathType Leaf)) { Log "SKIP EXE ICON: missing $Exe"; return }
  if(-not (Test-Path $ico)) { Log 'SKIP EXE ICON: km_icon.ico not found.'; return }

  $Npm = Find-Npm
  if(-not $Npm) { Log 'SKIP EXE ICON: npm not available.'; return }

  $RceditWork = Join-Path $env:TEMP 'KM_RCEDIT'
  New-Item -ItemType Directory -Force -Path $RceditWork | Out-Null
  $pkg = Join-Path $RceditWork 'node_modules\rcedit'
  $setIconJs = Join-Path $RceditWork 'set_icon.cjs'
  @"
const rcedit = require('rcedit');
rcedit(process.argv[2], { icon: process.argv[3] }).then(() => {
  console.log('EXE ICON OK');
}).catch(err => {
  console.error(err && err.message ? err.message : err);
  process.exit(1);
});
"@ | Set-Content -LiteralPath $setIconJs -Encoding UTF8

  Log "SETTING ICON: $Exe"
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  Push-Location $RceditWork
  try {
    if(-not (Test-Path $pkg)) {
      & $Npm init -y *> $null
      & $Npm install rcedit@4.0.1 --no-audit --no-fund --silent *> $null
      if($LASTEXITCODE -ne 0){ throw "npm install rcedit failed with exit code $LASTEXITCODE" }
    }
    $before = (Get-Item -LiteralPath $Exe).Length
    $tmp = Join-Path $env:TEMP ('km_ico_' + [guid]::NewGuid().ToString('N') + '.exe')
    Copy-Item -LiteralPath $Exe -Destination $tmp -Force
    & node $setIconJs $tmp $ico 2>&1 | ForEach-Object { Log $_ }
    if($LASTEXITCODE -ne 0){ throw "rcedit node script exit code $LASTEXITCODE" }
    $after = (Get-Item -LiteralPath $tmp).Length
    # rcedit rewrites the PE and drops NSIS/appended overlay (Setup 151MB -> ~399KB header).
    if($after -lt [Math]::Max(1MB, [int64]($before * 0.95))) {
      Log "SKIP EXE ICON: rcedit stripped overlay ($before -> $after bytes). Keeping original."
      Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
      return
    }
    Copy-Item -LiteralPath $tmp -Destination $Exe -Force
    Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
    Log 'EXE ICON OK'
  } finally {
    Pop-Location
    $ErrorActionPreference = $prevEap
  }
}




# KM_VERSION_JSON_NO_BOM_V1: km_version.json must be UTF-8 without BOM (BOM breaks JSON.parse in readKmVersion)
$kmVerPathBom = Join-Path $Project 'app\km_version.json'
if(Test-Path -LiteralPath $kmVerPathBom){
  $rawBom = [IO.File]::ReadAllText($kmVerPathBom)
  if($rawBom.Length -gt 0 -and [int][char]$rawBom[0] -eq 0xFEFF){
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [IO.File]::WriteAllText($kmVerPathBom, $rawBom.TrimStart([char]0xFEFF), $utf8NoBom)
    Log 'KM_VERSION_JSON_NO_BOM_V1: stripped BOM from km_version.json'
  }
}
# KM_AUDIT_VERSION_V100400: expected km_version.json version=v1.0.0. update=v1.0.1
# KM_PKG_VERSION_SYNC_V1: keep package.json version in sync with km_version.json update
$kmVerPath = Join-Path $Project 'app\km_version.json'
$pkgPath = Join-Path $Project 'app\package.json'
if((Test-Path -LiteralPath $kmVerPath) -and (Test-Path -LiteralPath $pkgPath)){
  $kmj = Get-Content -LiteralPath $kmVerPath -Raw -Encoding UTF8 | ConvertFrom-Json
  $upd = [string]$kmj.update
  if(-not [string]::IsNullOrWhiteSpace($upd)){
    $pkg = Get-Content -LiteralPath $pkgPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if([string]$pkg.version -ne $upd){
      $pkg.version = $upd
      ($pkg | ConvertTo-Json -Depth 20) + "`n" | Set-Content -LiteralPath $pkgPath -Encoding UTF8 -NoNewline
      Log "KM_PKG_VERSION_SYNC_V1: package.json version -> $upd"
    }
  }
}
# KM_WIN_VERSION_V1: keep NSIS DisplayVersion + PE FileVersion/ProductVersion in sync with app\km_version.json
function Get-KmAppVersion {
  $p = Join-Path $Project 'app\km_version.json'
  if(-not (Test-Path -LiteralPath $p)){ throw "km_version.json missing: $p" }
  $j = Get-Content -LiteralPath $p -Raw | ConvertFrom-Json
  $v = [string]$j.update
  if([string]::IsNullOrWhiteSpace($v)){ $v = [string]$j.version }
  if([string]::IsNullOrWhiteSpace($v)){ throw 'km_version.json.version/update empty' }
  $parts = @($v -split '[^\d]+' | Where-Object { $_ -ne '' })
  while($parts.Count -lt 4){ $parts += '0' }
  $pe = ($parts[0..3] | ForEach-Object { [int]$_ }) -join '.'
  return [pscustomobject]@{ Display=$v; Pe=$pe }
}

function Set-NsiProductVersion([string]$NsiPath, $Ver) {
  if(-not (Test-Path -LiteralPath $NsiPath)){ throw "NSI missing: $NsiPath" }
  $utf8bom = New-Object System.Text.UTF8Encoding $true
  $nsi = [System.IO.File]::ReadAllText($NsiPath, $utf8bom)
  $nsi = [regex]::Replace($nsi, '!define PRODUCT_VERSION "[^"]*"', "!define PRODUCT_VERSION `"$($Ver.Display)`"")
  $nsi = [regex]::Replace($nsi, 'VIProductVersion "[^"]*"', "VIProductVersion `"$($Ver.Pe)`"")
  $nsi = [regex]::Replace($nsi, 'VIAddVersionKey /LANG=1033 "FileVersion" "[^"]*"', "VIAddVersionKey /LANG=1033 `"FileVersion`" `"$($Ver.Display)`"")
  $nsi = [regex]::Replace($nsi, 'VIAddVersionKey /LANG=1033 "ProductVersion" "[^"]*"', "VIAddVersionKey /LANG=1033 `"ProductVersion`" `"$($Ver.Display)`"")
  if($nsi -notmatch [regex]::Escape("!define PRODUCT_VERSION `"$($Ver.Display)`"")){ throw 'Set-NsiProductVersion failed PRODUCT_VERSION' }
  [System.IO.File]::WriteAllText($NsiPath, $nsi, $utf8bom)
  Log "KM_WIN_VERSION_V1 NSI DisplayVersion=$($Ver.Display) VIProductVersion=$($Ver.Pe) path=$NsiPath"
}

function Set-PeFileVersion([string]$Exe, $Ver) {
  if(-not (Test-Path -LiteralPath $Exe -PathType Leaf)){ Log "SKIP PE VERSION: missing $Exe"; return }
  $Npm = Find-Npm
  if(-not $Npm){ Log 'SKIP PE VERSION: npm not available.'; return }
  $RceditWork = Join-Path $env:TEMP 'KM_RCEDIT'
  New-Item -ItemType Directory -Force -Path $RceditWork | Out-Null
  $pkg = Join-Path $RceditWork 'node_modules\rcedit'
  $setVerJs = Join-Path $RceditWork 'set_version.cjs'
  @"
const rcedit = require('rcedit');
const exe = process.argv[2];
const pe = process.argv[3];
const display = process.argv[4];
rcedit(exe, {
  'file-version': pe,
  'product-version': pe,
  'version-string': {
    FileVersion: display,
    ProductVersion: display,
    ProductName: 'KM',
    CompanyName: 'KM',
    FileDescription: 'KM',
    LegalCopyright: 'KM'
  }
}).then(() => console.log('PE VERSION OK ' + display + ' / ' + pe))
  .catch(err => { console.error(err && err.message ? err.message : err); process.exit(1); });
"@ | Set-Content -LiteralPath $setVerJs -Encoding UTF8
  Log "SETTING PE VERSION: $Exe => $($Ver.Display) / $($Ver.Pe)"
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  Push-Location $RceditWork
  try {
    if(-not (Test-Path $pkg)){
      & $Npm init -y *> $null
      & $Npm install rcedit@4.0.1 --no-audit --no-fund --silent *> $null
      if($LASTEXITCODE -ne 0){ throw "npm install rcedit failed with exit code $LASTEXITCODE" }
    }
    $before = (Get-Item -LiteralPath $Exe).Length
    $tmp = Join-Path $env:TEMP ('km_ver_' + [guid]::NewGuid().ToString('N') + '.exe')
    Copy-Item -LiteralPath $Exe -Destination $tmp -Force
    & node $setVerJs $tmp $Ver.Pe $Ver.Display 2>&1 | ForEach-Object { Log $_ }
    if($LASTEXITCODE -ne 0){ throw "rcedit version script exit code $LASTEXITCODE" }
    $after = (Get-Item -LiteralPath $tmp).Length
    if($after -lt [Math]::Max(1MB, [int64]($before * 0.95))) {
      Log "SKIP PE VERSION: rcedit stripped overlay ($before -> $after bytes). Keeping original."
      Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
      return
    }
    Copy-Item -LiteralPath $tmp -Destination $Exe -Force
    Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
    Log 'PE VERSION OK'
  } finally {
    Pop-Location
    $ErrorActionPreference = $prevEap
  }
}

Ensure-KmIcon
Stop-KmLockedProcesses
Set-PeIcon (Join-Path $X64 'electron.exe')
$__kmWinVer = Get-KmAppVersion
Set-PeFileVersion (Join-Path $X64 'electron.exe') $__kmWinVer
Set-NsiProductVersion (Join-Path $Project 'KM_Setup_x64.nsi') $__kmWinVer
Log 'ELECTRON RUNTIME READY THROUGH NPM/CACHE.'

Log 'OFFLINE RUNTIME READY. No Electron download was attempted.'


# Save hashes used by the build.
$hashes=@()
$hashes | Format-Table -AutoSize | Out-String | Set-Content (Join-Path $Dist 'BUILD_INPUT_HASHES.txt') -Encoding UTF8

# Compile in a local TEMP staging folder, not inside OneDrive/Desktop.
$StageRoot = Join-Path $env:TEMP 'KM_NSIS_BUILD_V12'
$FailureReport = Join-Path $Project 'BUILD_FAILURE_REPORT.txt'

try {
  Remove-Item $FailureReport -Force -ErrorAction SilentlyContinue

  Stop-KmLockedProcesses
  if(Test-Path $StageRoot){ Remove-ItemSafe $StageRoot }
  New-Item -ItemType Directory -Force -Path $StageRoot | Out-Null
  Log "STAGING BUILD TO: $StageRoot"

  Log '=== Staging org names + unit_kod seed from live UserData ==='
  & node (Join-Path $Project 'scripts\stage-org-seed.cjs')
  if($LASTEXITCODE -ne 0){ throw "stage-org-seed failed exit=$LASTEXITCODE" }
  $orgSeedSrc = Join-Path $Project 'payload\seed\org'
  if(-not (Test-Path -LiteralPath (Join-Path $orgSeedSrc 'km_org_seed.json') -PathType Leaf)){
    throw 'stage-org-seed did not write payload\seed\org\km_org_seed.json'
  }
  $kodIdx = Join-Path $orgSeedSrc 'unit_kod\index.json'
  if(-not (Test-Path -LiteralPath $kodIdx -PathType Leaf)){
    throw 'stage-org-seed did not write payload\seed\org\unit_kod\index.json'
  }
  $archIdx = Join-Path $orgSeedSrc 'unit_archives\index.json'

  # KM_PURGE_SHTATKA_EXCEL_V1 - drop SHTATKA/Excel staff seeds; keep km_shtatka.js stub
  Log '=== Purging SHTATKA/Excel archives (Unit Archive only) ==='
  & node (Join-Path $Project 'scripts\km-purge-shtatka-excel-v1.cjs') $Project
  if($LASTEXITCODE -ne 0){ throw "km-purge-shtatka-excel-v1 failed exit=$LASTEXITCODE" }

  # KM_NO_XLSX_ARCHIVE_V1 - strip stored xlsx base64 from unit archives before packaging; rows-only JSON remains
  Log '=== Stripping xlsx blobs from unit archives (rows only) ==='
  & node (Join-Path $Project 'scripts\strip-xlsx-from-archives.cjs') (Join-Path $Project 'app\data\unit_archives_seed') (Join-Path $Project 'payload\seed\org\unit_archives')
  if($LASTEXITCODE -ne 0){ throw "strip-xlsx-from-archives failed exit=$LASTEXITCODE" }
  if(-not (Test-Path -LiteralPath $archIdx -PathType Leaf)){
    throw 'stage-org-seed did not write payload\seed\org\unit_archives\index.json'
  }

  Log '=== Staging Library / legal files from live UserData ==='
  & node (Join-Path $Project 'scripts\stage-library-seed.cjs')
  if($LASTEXITCODE -ne 0){ throw "stage-library-seed failed exit=$LASTEXITCODE" }
  $libSeedSrc = Join-Path $Project 'payload\seed\Library'
  if(-not (Test-Path -LiteralPath $libSeedSrc -PathType Container)){
    throw 'stage-library-seed did not write payload\seed\Library'
  }
  $libN = (Get-ChildItem -LiteralPath $libSeedSrc -Recurse -File -ErrorAction SilentlyContinue | Measure-Object).Count
  if($libN -lt 20){ throw "Library seed incomplete: $libN files" }
  Log "LIBRARY SEED OK: $libN files"

  Log 'WRITING km_integrity.json...'
  Invoke-KmWriteIntegrity -AppDir (Join-Path $Project 'app')
  if($LASTEXITCODE -ne 0){ throw 'writeIntegrity failed' }

  Log 'COPYING FULL APP RUNTIME (all js/data/assets, not a file whitelist)...'
  Copy-KmAppRuntime (Join-Path $Project 'app') (Join-Path $StageRoot 'app')
  Copy-Item (Join-Path $Project 'kod_stage.ps1') (Join-Path $StageRoot 'kod_stage.ps1') -Force
  New-Item -ItemType Directory -Force -Path (Join-Path $StageRoot 'scripts') | Out-Null
  Copy-Item (Join-Path $Project 'scripts\kod_apply.cjs') (Join-Path $StageRoot 'scripts\kod_apply.cjs') -Force
  Copy-Item (Join-Path $Project 'scripts\kod_stage.ps1') (Join-Path $StageRoot 'scripts\kod_stage.ps1') -Force
  Copy-Item (Join-Path $Project 'scripts\km_error_log.ps1') (Join-Path $StageRoot 'scripts\km_error_log.ps1') -Force
  Copy-Item (Join-Path $Project 'app\js\km-formal.js') (Join-Path $StageRoot 'app\js\km-formal.js') -Force
  Copy-Item (Join-Path $Project 'app\vendor\jszip.min.js') (Join-Path $StageRoot 'app\vendor\jszip.min.js') -Force
  Copy-Item (Join-Path $Project 'app\assets') (Join-Path $StageRoot 'app\assets') -Recurse -Force

  New-Item -ItemType Directory -Force -Path (Join-Path $StageRoot 'payload\runtime') | Out-Null
  Copy-Item $X64 (Join-Path $StageRoot 'payload\runtime\x64') -Recurse -Force

  Copy-Item (Join-Path $Project 'KM_Setup_x64.nsi') (Join-Path $StageRoot 'KM_Setup_x64.nsi') -Force
  New-Item -ItemType Directory -Force -Path (Join-Path $StageRoot 'setup') | Out-Null
  Copy-Item (Join-Path $Project 'setup\km_welcome.bmp') (Join-Path $StageRoot 'setup\km_welcome.bmp') -Force
  Copy-Item (Join-Path $Project 'setup\km_header.bmp') (Join-Path $StageRoot 'setup\km_header.bmp') -Force
  New-Item -ItemType Directory -Force -Path (Join-Path $StageRoot 'dist') | Out-Null

  $orgSeedDst = Join-Path $StageRoot 'payload\seed\org'
  New-Item -ItemType Directory -Force -Path $orgSeedDst | Out-Null
  Get-ChildItem -LiteralPath (Join-Path $Project 'payload\seed\org') -Force | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $orgSeedDst $_.Name) -Recurse -Force
  }
  $libSeedDst = Join-Path $StageRoot 'payload\seed\Library'
  if(Test-Path -LiteralPath $libSeedDst){ Remove-ItemSafe $libSeedDst }
  Copy-Item -LiteralPath (Join-Path $Project 'payload\seed\Library') -Destination $libSeedDst -Recurse -Force
  $fontsSeedSrc = Join-Path $Project 'payload\seed\Fonts'
  $fontsSeedDst = Join-Path $StageRoot 'payload\seed\Fonts'
  if(Test-Path -LiteralPath $fontsSeedSrc -PathType Container){
    if(Test-Path -LiteralPath $fontsSeedDst){ Remove-ItemSafe $fontsSeedDst }
    Copy-Item -LiteralPath $fontsSeedSrc -Destination $fontsSeedDst -Recurse -Force
  }
  Log "LIBRARY SEED STAGED: $libSeedDst"
  $stageAppData = Join-Path $StageRoot 'app\data'
  New-Item -ItemType Directory -Force -Path $stageAppData | Out-Null
  Copy-Item -LiteralPath (Join-Path $Project 'app\data\km_org_seed.json') -Destination (Join-Path $stageAppData 'km_org_seed.json') -Force
  $stageKodSeed = Join-Path $stageAppData 'unit_kod_seed'
  if(Test-Path -LiteralPath $stageKodSeed){ Remove-ItemSafe $stageKodSeed }
  Copy-Item -LiteralPath (Join-Path $Project 'app\data\unit_kod_seed') -Destination $stageKodSeed -Recurse -Force
  $stageArchSeed = Join-Path $stageAppData 'unit_archives_seed'
  if(Test-Path -LiteralPath $stageArchSeed){ Remove-ItemSafe $stageArchSeed }
  Copy-Item -LiteralPath (Join-Path $Project 'app\data\unit_archives_seed') -Destination $stageArchSeed -Recurse -Force
  if(Test-Path -LiteralPath (Join-Path $orgSeedDst 'kodmutq')){ throw 'ORG SEED must not contain kodmutq' }
  Log "ORG SEED STAGED: $orgSeedDst + app\data\unit_kod_seed + app\data\unit_archives_seed"

  # Keep plaintext km_net.js for Hub OTA so older stations can pull Setup after one Թարմացնել.
  $updateSrc = Join-Path $StageRoot 'update_src'
  New-Item -ItemType Directory -Force -Path $updateSrc | Out-Null
  Copy-Item -LiteralPath (Join-Path $StageRoot 'app\km_net.js') -Destination (Join-Path $updateSrc 'km_net.js') -Force
  Log "UPDATE SRC staged: $updateSrc"

  # KM_BYTECODE_COPY_FROM_PROJECT_V1: skip recompile (stub .js recompile yields tiny broken .jsc)
Log "COPYING BYTECODE from project app (skip compile-bytecode)..."
$projAppBc = Join-Path $Project 'app'
$stageAppBc = Join-Path $StageRoot 'app'
$mainSrc = Join-Path $projAppBc 'main.jsc'
if (-not (Test-Path -LiteralPath $mainSrc)) { throw 'project app\\main.jsc missing' }
if ((Get-Item -LiteralPath $mainSrc).Length -lt 50000) { throw ('project main.jsc too small: ' + (Get-Item -LiteralPath $mainSrc).Length) }
Get-ChildItem -LiteralPath $projAppBc -Filter '*.jsc' -File | ForEach-Object {
  Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $stageAppBc $_.Name) -Force
}
$jscCount = @(Get-ChildItem -LiteralPath $stageAppBc -Filter '*.jsc' -File).Count
Log "BYTECODE COPIED OK: $jscCount .jsc files from project"
Log "BYTECODE OK: $jscCount .jsc files in stage (Electron V8)"
# KM_JSC_SIZE_GUARD_V1: never ship stub-recompiled tiny .jsc (restore real bytecode from project app)
$projAppJsc = Join-Path $Project 'app'
$stageAppJsc = Join-Path $StageRoot 'app'
Get-ChildItem -LiteralPath $projAppJsc -Filter '*.jsc' -File | ForEach-Object {
  $dst = Join-Path $stageAppJsc $_.Name
  $projLen = $_.Length
  $stageLen = 0
  if (Test-Path -LiteralPath $dst) { $stageLen = (Get-Item -LiteralPath $dst).Length }
  $isMain = ($_.Name -eq 'main.jsc')
  # stub-recompile typically yields ~700-900 bytes; real modules are larger (except a few tiny ones)
  $looksStub = ($stageLen -gt 0 -and $stageLen -lt 1500 -and $projLen -gt ($stageLen + 500))
  $mainBad = ($isMain -and $stageLen -lt 50000)
  if ($looksStub -or $mainBad -or $stageLen -eq 0) {
    if ($isMain -and $projLen -lt 50000) { throw ('project main.jsc too small: ' + $projLen) }
    Copy-Item -LiteralPath $_.FullName -Destination $dst -Force
    Log ('KM_JSC_SIZE_GUARD_V1 restored ' + $_.Name + ' -> ' + $projLen + ' (was ' + $stageLen + ')')
  }
}
$mainJsc = Join-Path $stageAppJsc 'main.jsc'
if (-not (Test-Path -LiteralPath $mainJsc)) { throw 'main.jsc missing after bytecode guard' }
if ((Get-Item -LiteralPath $mainJsc).Length -lt 50000) { throw ('main.jsc still too small: ' + (Get-Item -LiteralPath $mainJsc).Length) }
Log ('KM_JSC_SIZE_GUARD_V1 OK main.jsc=' + (Get-Item -LiteralPath $mainJsc).Length)

# KM_PROMOTION_ACCESS_STAFFINGCODE_V1 on staged tree (defense in depth)
$stagePosJs = Join-Path $StageRoot 'app\js\km-positions.js'
if (Test-Path -LiteralPath $stagePosJs -PathType Leaf) {
  Repair-KmPromotionAccessStaffingCode $stagePosJs
  Repair-KmReserveArchiveV1 (Split-Path -Parent $stagePosJs)
  Repair-KmPromotionCardAccessAlign $stagePosJs
  $stageExtJs = Join-Path $StageRoot 'app\js\km-extensions.js'
  if (Test-Path -LiteralPath $stageExtJs -PathType Leaf) { Repair-KmPersonCardPromoEnsurePositions $stageExtJs }
}
# KM_STRIP_GOYQI_FROM_CLIENT_V1
$goyqiShip = Join-Path $StageRoot 'app\data\forms\goyqi_hashvark.html'
if (Test-Path -LiteralPath $goyqiShip) {
  Remove-Item -LiteralPath $goyqiShip -Force
  Log 'KM_STRIP_GOYQI_FROM_CLIENT_V1 removed goyqi_hashvark.html from stage'
}
  Log 'VERIFYING staged core is bytecode stubs (no plaintext core in Setup)...'
  $metaPath = Join-Path $StageRoot 'app\km_bytecode_meta.json'
  if(-not (Test-Path -LiteralPath $metaPath -PathType Leaf)){ throw 'km_bytecode_meta.json missing' }
  $compiledList = @((Get-Content -LiteralPath $metaPath -Raw | ConvertFrom-Json).compiled)
  if(-not $compiledList -or $compiledList.Count -lt 20){ throw "bytecode compiled list too small: $($compiledList.Count)" }
  foreach($rel in $compiledList){
    $js = Join-Path $StageRoot ('app\' + $rel)
    $jsc = [IO.Path]::ChangeExtension($js, '.jsc')
    if(-not (Test-Path -LiteralPath $jsc -PathType Leaf)){ throw "BYTECODE MISSING .jsc: $rel" }
    if(-not (Test-Path -LiteralPath $js -PathType Leaf)){ throw "BYTECODE MISSING stub: $rel" }
    $txt = Get-Content -LiteralPath $js -Raw -Encoding UTF8
    if($txt -notmatch "require\('bytenode'\)"){ throw "PLAINTEXT CORE IN SETUP: $rel" }
  }
  foreach($n in @('.cursor','BUILD_SETUP.ps1','BUILD_SETUP_X86.ps1','AGENTS.md','KM_UPDATE_ORIGIN','.cursorignore')){
    $marker = Join-Path $StageRoot ('app\' + $n)
    if(Test-Path -LiteralPath $marker){ throw "STAGE CONTAINS DEV/AI MARKER: $n" }
  }
  Log ("BYTECODE STUBS OK: {0} core modules locked" -f $compiledList.Count)

  # compile-bytecode.cjs is only needed during this build -- do not ship it (GUARD extra).
  $keepScripts = @()  # KM_CORE_NO_TEST_SCRIPTS_V1: ship no scripts/test-*
  $stageScripts = Join-Path $StageRoot 'app\scripts'
  if(Test-Path -LiteralPath $stageScripts){
    Get-ChildItem -LiteralPath $stageScripts -Recurse -File -Force -ErrorAction SilentlyContinue |
      Where-Object { $keepScripts -notcontains $_.Name } |
      ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force; Log "STRIPPED FROM SETUP: scripts\$($_.Name)" }
    Get-ChildItem -LiteralPath $stageScripts -Recurse -Directory -Force -ErrorAction SilentlyContinue |
      Sort-Object FullName -Descending |
      ForEach-Object {
        if(-not (Get-ChildItem -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue)){
          Remove-Item -LiteralPath $_.FullName -Force
        }
      }
  }
  Remove-Item -LiteralPath (Join-Path $StageRoot 'app\data\curriculum34-seed-data.js') -Force -ErrorAction SilentlyContinue

  # Integrity must match staged (stubbed) tree shipped in Setup.
  Log 'WRITING km_integrity.json for staged app...'
  Invoke-KmWriteIntegrity -AppDir (Join-Path $StageRoot 'app')
  if($LASTEXITCODE -ne 0){ throw 'stage writeIntegrity failed' }
  # Refresh project integrity (plaintext sources) for SYNC/dev.
  Invoke-KmWriteIntegrity -AppDir (Join-Path $Project 'app')
  if($LASTEXITCODE -ne 0){ throw 'project writeIntegrity failed' }

  # Pre-compile stage audit.
  $mustExist=@(
    'app\index.html',
    'app\main.js',
    'app\preload.js',
    'app\package.json',
    'app\office_backend.js',
    'app\km_shtatka.js',
    'app\vendor\jszip.min.js',
    'app\km_backend.js',
    'app\km_app_users_sync.js',
    'app\km_gemini_config.js',
    'app\km_license.js',
    'app\km_owner_vault.js',
    'app\km_library.js',
    'app\km_bot_rag.js',
    'app\km_bot_knowledge.js',
    'app\km_help_bot_core.js',
    'app\km_domain_router.js',
    'app\km_text_clean.js',
    'app\km_sqlite_bridge.js',
    'app\km_sqlite_worker.js',
    'app\km_edge_tts.js',
    'app\km_pdf_translate.js',
    'app\km_pdf_text.js',
    'app\km_fonts.js',
    'app\km_guard.js',
    'app\km_net.js',
    'app\km_lan_sync.js',
    'app\km_conversations.js',
    'app\km_retention.js',
    'app\km_crypto_store.js',
    'app\km_secrets_load.js',
    'app\km_security_secrets.js',
    'app\km_version.js',
    'app\km_version.json',
    'app\km_integrity.json',
    'app\js\km-services.js',
    'app\js\km-error-log.js',
    'app\js\km-features.js',
    'app\js\km-display-compat.js',
    'app\js\km-auto-focus.js',
    'app\js\km-v3-core.js',
    'app\js\km-v3-ext.js',
    'app\js\km-v3-tools.js',
    'app\js\km-license-ui.js',
    'app\js\km-auth-ui.js',
    'app\js\km-org-context.js',
    'app\js\km-users-ui.js',
    'app\js\km-discipline-penalties.js',
    'app\js\km-person-dossiers.js',
    'app\js\km-library-ui.js',
    'app\js\km-soldier-rights.js',
    'app\js\km-help-bot-shield.js',
    'app\js\km-help-bot-llm.js',
    'app\js\km-help-bot.js',
    'app\js\km-bg-slideshow.js',
    'app\js\km-formal.js',
    'app\js\km-i18n-extra.js',
    'app\js\km-notes-calendar.js',
    'app\js\km-spreadsheet.js',
    'app\js\km-extensions.js',
    'app\js\km-net-ui.js',
    'app\js\km-lan-client.js',
    'app\js\km-ops.js',
    'app\js\km-extra-tools.js',
    'app\js\km-troop-structure.js',
    'app\js\km-unit-tools.js',
    'app\js\km-trial-lab.js',
    'app\js\km-person-linked.js',
    'app\js\km-shtat-catalog-data.js',
    'app\js\km-positions.js',
    'app\data\km_shtat_catalog.json',
    'app\data\km_soldier_rights.json',
    'app\data\km_arlis_military_catalog.json',
    'app\data\km_help_bot.json',
    'app\data\km_help_bot_online.json',
    'app\data\km_order_templates.json',
    'app\data\km_usum_books_catalog.json',
    'app\data\km_unit_archive_25836.json',
    'app\js\km-section-upgrades.js',
    'app\js\km-sysinfo-ui.js',
    'app\km_ops_logic.js',
    'app\assets\km_logo.jpg',
    'app\assets\km_logo_square.jpg',
    'app\assets\km_icon.ico',
    'payload\runtime\x64\electron.exe',
    'payload\runtime\x64\icudtl.dat',
    'payload\runtime\x64\resources',
    'setup\km_welcome.bmp',
    'setup\km_header.bmp',
    'KM_Setup_x64.nsi'
  )
  $mustExist += 'app\assets\km_bg.jpg' # KM_SINGLE_BG_V1
  Remove-Item (Join-Path $StageRoot 'app\KM_UPDATE_ORIGIN') -Force -ErrorAction SilentlyContinue
  foreach($rel in $mustExist){
    $p=Join-Path $StageRoot $rel
    if(-not(Test-Path $p)){throw "STAGE INPUT MISSING: $p"}
  }
  if(-not(Test-Path -LiteralPath (Join-Path $StageRoot 'app\data\soldier_rights_docs') -PathType Container)){
    throw 'STAGE INPUT MISSING: app\data\soldier_rights_docs'
  }
  if(-not(Test-Path -LiteralPath (Join-Path $StageRoot 'app\data\arlis_military_docs') -PathType Container)){
    throw 'STAGE INPUT MISSING: app\data\arlis_military_docs'
  }
  $arlisN = (Get-ChildItem -LiteralPath (Join-Path $StageRoot 'app\data\arlis_military_docs') -Recurse -File -ErrorAction SilentlyContinue | Measure-Object).Count
  if($arlisN -lt 10){ throw "arlis_military_docs incomplete: $arlisN files" }
  Log 'PASS: all staged input files exist.'

  # ---- Embed BotKnowledge + 7-Zip CLI inside KM_Setup_x64.exe (single clean deliverable) ----
  $skipKb = $env:KM_SKIP_BOTKNOWLEDGE -eq '1'
  $seedSrc = Join-Path $Project 'payload\seed\BotKnowledge.7z'
  $nsisDefines = @('/V2', '/INPUTCHARSET', 'UTF8')
  if(Test-Path -LiteralPath (Join-Path $StageRoot 'payload\seed\org\km_org_seed.json') -PathType Leaf){
    $nsisDefines = @('/DKM_EMBED_ORG=1') + $nsisDefines
    Log 'NSIS KM_EMBED_ORG=1 (unit names + unit_kod + unit archives)'
  } else {
    throw 'Staged org seed missing — refuse to compile Setup without unit names/kod'
  }
  $stageLib = Join-Path $StageRoot 'payload\seed\Library'
  $stageLibN = 0
  if(Test-Path -LiteralPath $stageLib -PathType Container){
    $stageLibN = (Get-ChildItem -LiteralPath $stageLib -Recurse -File -ErrorAction SilentlyContinue | Measure-Object).Count
  }
  if($stageLibN -lt 20){ throw "Staged Library seed missing/incomplete: $stageLibN files" }
  $nsisDefines = @('/DKM_EMBED_LIBRARY=1') + $nsisDefines
  Log "NSIS KM_EMBED_LIBRARY=1 ($stageLibN files)"
  if(Test-Path -LiteralPath (Join-Path $StageRoot 'payload\seed\Fonts') -PathType Container){
    $nsisDefines = @('/DKM_EMBED_FONTS=1') + $nsisDefines
    Log 'NSIS KM_EMBED_FONTS=1'
  }
  if(-not $skipKb){
    Log '=== Staging BotKnowledge seed for NSIS embed ==='
    $liveKb = Join-Path $env:LOCALAPPDATA 'KM\UserData\BotKnowledge\knowledge.db'
    $liveSnap = Join-Path $env:LOCALAPPDATA 'KM\UserData\BotKnowledge\knowledge.db.snapshot'
    $metaPath = Join-Path $Project 'payload\seed\BotKnowledge.meta.json'
    $needRestage = $false
    if(-not (Test-Path -LiteralPath $seedSrc -PathType Leaf) -or ((Get-Item -LiteralPath $seedSrc).Length -lt 10MB)){
      $needRestage = $true
      Log 'BotKnowledge.7z missing/small -- will restage from live knowledge.db'
    } elseif($env:KM_RESTAGE_BOTKNOWLEDGE -eq '1'){
      $needRestage = $true
      Log 'KM_RESTAGE_BOTKNOWLEDGE=1 -- restaging live knowledge.db into Setup'
    } else {
      $liveBytes = [int64]0
      if(Test-Path -LiteralPath $liveKb){ $liveBytes = [int64](Get-Item -LiteralPath $liveKb).Length }
      if($liveBytes -lt 3000000000 -and (Test-Path -LiteralPath $liveSnap)){
        $liveBytes = [int64](Get-Item -LiteralPath $liveSnap).Length
      }
      $metaBytes = [int64]0
      if(Test-Path -LiteralPath $metaPath){
        try{ $metaBytes = [int64]((Get-Content -LiteralPath $metaPath -Raw | ConvertFrom-Json).srcBytes) }catch{}
      }
      if($liveBytes -ge 3000000000 -and $metaBytes -gt 0 -and [Math]::Abs($liveBytes - $metaBytes) -gt 8MB){
        $needRestage = $true
        Log "Live knowledge.db ($liveBytes) differs from seed meta ($metaBytes) -- restaging"
      }
    }
    if($needRestage){
      & powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Project 'scripts\stage-botknowledge-seed.ps1')
      if($LASTEXITCODE -ne 0){ throw "stage-botknowledge-seed failed exit=$LASTEXITCODE" }
    }
    if(-not (Test-Path -LiteralPath $seedSrc -PathType Leaf)){ throw "Seed still missing: $seedSrc" }

    $sevenCandidates = @()
    if($env:ProgramFiles){
      $sevenCandidates += Join-Path $env:ProgramFiles '7-Zip\7z.exe'
    }
    if(${env:ProgramFiles(x86)}){
      $sevenCandidates += Join-Path ${env:ProgramFiles(x86)} '7-Zip\7z.exe'
    }
    if($env:LOCALAPPDATA){
      $sevenCandidates += Join-Path $env:LOCALAPPDATA 'Programs\KM\tools\7z\7z.exe'
    }
    $sevenCandidates += Join-Path $Project 'tools\7z\7z.exe'
    $sevenZ = $sevenCandidates | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
    if(-not $sevenZ){
      $cmd7 = Get-Command 7z.exe -ErrorAction SilentlyContinue
      if($cmd7 -and $cmd7.Source){ $sevenZ = $cmd7.Source }
    }
    if(-not $sevenZ){ throw '7z.exe not found -- required to embed BotKnowledge extractor in Setup' }
    $sevenDll = Join-Path (Split-Path $sevenZ -Parent) '7z.dll'
    if(-not (Test-Path -LiteralPath $sevenDll)){ throw "7z.dll missing next to $sevenZ" }

    $seedStage = Join-Path $StageRoot 'payload\seed'
    $tools7z = Join-Path $StageRoot 'tools\7z'
    New-Item -ItemType Directory -Force -Path $seedStage | Out-Null
    New-Item -ItemType Directory -Force -Path $tools7z | Out-Null
    Copy-Item -LiteralPath $seedSrc -Destination (Join-Path $seedStage 'BotKnowledge.7z') -Force
    Copy-Item -LiteralPath $sevenZ -Destination (Join-Path $tools7z '7z.exe') -Force
    Copy-Item -LiteralPath $sevenDll -Destination (Join-Path $tools7z '7z.dll') -Force

    $pass = $null
  $elePassArgs = @('-e', "const s=require('./app/km_secrets_load.js').loadKmSecrets(); process.stdout.write(String(s.AES_MASTER_KEY_HEX||''));")
  $ele = Get-KmElectronNode
  $prev = $env:ELECTRON_RUN_AS_NODE
  $env:ELECTRON_RUN_AS_NODE = '1'
  try {
    Log "KM_NODE(Electron secrets): $ele"
    $pass = (& $ele @elePassArgs | Out-String).Trim()
    if($LASTEXITCODE -ne 0){ throw "secrets load via Electron failed exit=$LASTEXITCODE" }
  } finally {
    if($null -eq $prev){ Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue }
    else { $env:ELECTRON_RUN_AS_NODE = $prev }
  }
    if(-not $pass -or $pass.Length -lt 32){ throw 'AES_MASTER_KEY_HEX missing for BotKnowledge seed password' }
    $passNsh = Join-Path $seedStage 'km_seed_pass.nsh'
    $nshBody = "; auto-generated" + [Environment]::NewLine + '!define KM_BOTKNOWLEDGE_PASS "' + $pass + '"' + [Environment]::NewLine
    [System.IO.File]::WriteAllText($passNsh, $nshBody, [System.Text.Encoding]::ASCII)
    Log 'TESTING BotKnowledge.7z archive...'
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    & $sevenZ t "-p$pass" (Join-Path $seedStage 'BotKnowledge.7z') | ForEach-Object { Log $_ }
    $testRc = $LASTEXITCODE
    $ErrorActionPreference = $prevEap
    if($testRc -ne 0){ throw "BotKnowledge.7z test failed exit=$testRc (password or archive corrupt)" }
    Log "SEED EMBED OK: $((Get-Item (Join-Path $seedStage 'BotKnowledge.7z')).Length) bytes + 7z tools"
    $nsisDefines = @('/DKM_EMBED_BOTKNOWLEDGE=1') + $nsisDefines
  } else {
    Log 'KM_SKIP_BOTKNOWLEDGE=1 -- Setup will NOT embed BotKnowledge seed'
  }

  Remove-KmActivationFromStage $StageRoot
  # KM_WIN_VERSION_V1: force staged NSI DisplayVersion from km_version.json
  $__kmWinVer2 = Get-KmAppVersion
  Set-NsiProductVersion (Join-Path $StageRoot 'KM_Setup_x64.nsi') $__kmWinVer2
  $nsiText = Get-Content -LiteralPath (Join-Path $StageRoot 'KM_Setup_x64.nsi') -Raw
  if($nsiText -match '(?i)File\s+"(kod\.cmd|kod3\.cmd|[^"]*kod_codes\.txt)"'){
    throw 'KM_Setup_x64.nsi still packs kod.cmd / kod3.cmd / kod_codes.txt -- refuse to compile.'
  }
  if($nsiText -match '(?i)File[^\r\n]*kodmutq'){
    throw 'KM_Setup_x64.nsi still packs kodmutq -- refuse to compile.'
  }
  foreach($bad in @((Join-Path $StageRoot 'kodmutq'),(Join-Path $StageRoot 'app\kodmutq'))){
    if(Test-Path -LiteralPath $bad){ throw "STAGED KODMUTQ MUST NOT SHIP: $bad" }
  }

  Log 'COMPILING x64 WITH ZLIB...'
  Push-Location $StageRoot
  try{
    & $MakeNSIS @nsisDefines (Join-Path $StageRoot 'KM_Setup_x64.nsi') 2>&1 |
      Tee-Object -FilePath $Log -Append
    $rc=$LASTEXITCODE
  }finally{
    Pop-Location
  }

  Log "MAKENSIS EXIT CODE: $rc"
  if($rc -ne 0){throw "makensis x64 failed with exit code $rc"}

  $stageSetup=Join-Path $StageRoot 'dist\KM_Setup_x64.exe'
  if(-not(Test-Path -LiteralPath $stageSetup -PathType Leaf)){
    throw "makensis returned success but staged output does not exist: $stageSetup"
  }

  $stageSize=(Get-Item -LiteralPath $stageSetup).Length
  Log "STAGED SETUP SIZE: $stageSize bytes"
  if($stageSize -lt 5MB){throw "Staged setup unexpectedly small: $stageSize bytes"}

  $fs=[IO.File]::OpenRead($stageSetup)
  try{$b0=$fs.ReadByte();$b1=$fs.ReadByte()}finally{$fs.Dispose()}
  if($b0 -ne 0x4D -or $b1 -ne 0x5A){throw 'Staged setup has no MZ PE header.'}

  New-Item -ItemType Directory -Force -Path (Join-Path $Project 'dist') | Out-Null
  $final=Join-Path $Project 'dist\KM_Setup_x64.exe'
  Remove-ItemSafe $final
  Copy-Item -LiteralPath $stageSetup -Destination $final -Force

  if(-not(Test-Path -LiteralPath $final -PathType Leaf)){
    throw "FINAL COPY FAILED: $final"
  }

  # Do not rcedit the NSIS Setup: it strips the appended install payload.
  # The Setup file icon comes from NSI Icon / MUI_ICON.
  Log 'SETUP ICON: NSIS Icon/MUI_ICON (rcedit skipped to preserve overlay).'

  $finalSize=(Get-Item -LiteralPath $final).Length
  if($finalSize -lt 5MB){throw "Final setup unexpectedly small: $finalSize bytes"}
  if((-not $skipKb) -and $finalSize -lt 150MB){
    throw "Final setup too small for embedded BotKnowledge ($finalSize bytes). Expected >= 150MB."
  }

  $hash=(Get-FileHash -LiteralPath $final -Algorithm SHA256).Hash
  $seedBytes = 0
  if(Test-Path -LiteralPath $seedSrc -PathType Leaf){ $seedBytes = (Get-Item -LiteralPath $seedSrc).Length }
  $ready = Join-Path $Project 'dist\KM_Setup_x64.READY.txt'
  @(
    'KM Desktop -- single installer with BotKnowledge inside',
    "PATH=$final",
    "SIZE_BYTES=$finalSize",
    "SHA256=$hash",
    "LIBRARY_SEED_FILES=$stageLibN",
    'EXTRACT_TO=%LOCALAPPDATA%\KM\UserData\BotKnowledge\knowledge.db',
    'ALSO_INSTALLED=$INSTDIR\payload\seed\BotKnowledge.7z',
    "BUILT=$(Get-Date -Format o)"
  ) | Set-Content -LiteralPath $ready -Encoding UTF8
  "$hash  KM_Setup_x64.exe" | Set-Content -LiteralPath (Join-Path $Project 'dist\KM_Setup_x64.sha256') -Encoding ASCII

  Log ''
  Log '========================================'
  Log 'SUCCESS: X64 SETUP CREATED AND VERIFIED'
  Log $final
  Log "SIZE: $finalSize bytes"
  Log "SHA-256: $hash"
  Log "BOTKNOWLEDGE.7Z: $seedBytes bytes"
  Log '========================================'

  Write-Host ''
  Write-Host 'SUCCESS: X64 SETUP CREATED AND VERIFIED' -ForegroundColor Green
  Write-Host $final -ForegroundColor Green
  Write-Host "BotKnowledge.7z embedded: $seedBytes bytes" -ForegroundColor Green
  exit 0
}
catch {
  $err=$_.Exception.ToString()
  Log "FATAL BUILD ERROR: $err"

  $lines=@()
  $lines += "KM V12 BUILD FAILURE"
  $lines += "Date: $(Get-Date -Format o)"
  $lines += "Project: $Project"
  $lines += "StageRoot: $StageRoot"
  $lines += ""
  $lines += "ERROR:"
  $lines += $err
  $lines += ""
  $lines += "STAGE CONTENTS:"
  if(Test-Path $StageRoot){
    $lines += (Get-ChildItem $StageRoot -Recurse -Force -ErrorAction SilentlyContinue |
      Select-Object FullName,Length |
      Format-Table -AutoSize | Out-String)
  } else {
    $lines += "StageRoot does not exist."
  }
  $lines | Set-Content -LiteralPath $FailureReport -Encoding UTF8

  Write-Host ''
  Write-Host 'BUILD FAILED.' -ForegroundColor Red
  Write-Host "Detailed report: $FailureReport" -ForegroundColor Yellow
  Write-Host "Build log: $Log" -ForegroundColor Yellow
  exit 1
}
