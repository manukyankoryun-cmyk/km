#Requires -Version 5.1
<#
.SYNOPSIS
  KM_RESERVE_ARCHIVE_V1 — Պահեստազոր archive + ԱԱՀ search + թափուր→copy + user menu icon parity
  Run on USER Windows: Shell machineId=7862fbcb-93e0-4346-8410-b1da68743b16
#>
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$Marker = 'KM_RESERVE_ARCHIVE_V1'
$Stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$BakSuffix = ".bak_reserve_$Stamp"

$Project = 'C:\Users\PUBG\OneDrive\Desktop\KM_1.009.4_SEPARATE_FORMAL_DATA_PER_GRAPH\KM_1.009.4_SEPARATE_FORMAL_DATA_PER_GRAPH'
$LiveCandidates = @(
  'C:\Users\PUBG\AppData\Local\Programs\KM\runtime\resources\app',
  'C:\Users\PUBG\AppData\Local\Programs\KM\resources\app'
)
$KmExeCandidates = @(
  'C:\Users\PUBG\AppData\Local\Programs\KM\runtime\KM.exe',
  'C:\Users\PUBG\AppData\Local\Programs\KM\KM.exe'
)

$enc = New-Object System.Text.UTF8Encoding $false
$Report = [ordered]@{
  marker = $Marker
  stamp = $Stamp
  project = $Project
  liveApp = $null
  kmExe = $null
  backups = New-Object System.Collections.Generic.List[string]
  filesChanged = New-Object System.Collections.Generic.List[string]
  probes = [ordered]@{}
  steps = New-Object System.Collections.Generic.List[string]
  errors = New-Object System.Collections.Generic.List[string]
  build = [ordered]@{}
  tests = [ordered]@{}
  armenianLabels = @(
    'Պահեստազոր',
    'պահեստազորային արխիվ',
    'Ազգանուն',
    'Անուն',
    'Հայրանուն',
    'Որոնել',
    'Պահեստազորային արխիվում գրառումներ չկան',
    'Համընկնում չգտնվեց',
    'Անձը տեղափոխվեց պահեստազորային արխիվ, հաստիքը թափուր է'
  )
}

function Log([string]$m) {
  $line = '[{0}] {1}' -f (Get-Date -Format 'HH:mm:ss'), $m
  Write-Host $line
  $Report.steps.Add($line) | Out-Null
}
function Fail([string]$m) {
  $Report.errors.Add($m) | Out-Null
  throw $m
}
function Read-Text([string]$path) {
  return [System.IO.File]::ReadAllText($path, $enc)
}
function Write-Text([string]$path, [string]$text) {
  $dir = Split-Path -Parent $path
  if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  [System.IO.File]::WriteAllText($path, $text, $enc)
}
function Backup-File([string]$path) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { return $null }
  $bak = $path + $BakSuffix
  Copy-Item -LiteralPath $path -Destination $bak -Force
  $Report.backups.Add($bak) | Out-Null
  Log "backup $bak"
  return $bak
}
function Note-Changed([string]$path) {
  if (-not $Report.filesChanged.Contains($path)) { $Report.filesChanged.Add($path) | Out-Null }
}

# ---- resolve live paths ----
if (-not (Test-Path -LiteralPath $Project)) { Fail "Project missing: $Project" }
$LiveApp = $null
foreach ($c in $LiveCandidates) {
  if (Test-Path -LiteralPath (Join-Path $c 'js') -PathType Container) { $LiveApp = $c; break }
  if (Test-Path -LiteralPath (Join-Path $c 'app\js') -PathType Container) { $LiveApp = (Join-Path $c 'app'); break }
}
if (-not $LiveApp) { Fail 'Live KM app folder not found' }
$Report.liveApp = $LiveApp
$KmExe = $null
foreach ($c in $KmExeCandidates) { if (Test-Path -LiteralPath $c) { $KmExe = $c; break } }
$Report.kmExe = $KmExe
Log "Project=$Project"
Log "LiveApp=$LiveApp"
Log "KmExe=$KmExe"

$ProjJs = Join-Path $Project 'app\js'
$LiveJs = Join-Path $LiveApp 'js'
if (-not (Test-Path -LiteralPath $LiveJs)) { $LiveJs = Join-Path $LiveApp 'app\js' }

$Files = @{
  unitTools = 'km-unit-tools.js'
  positions = 'km-positions.js'
  usersUi   = 'km-users-ui.js'
  v3core    = 'km-v3-core.js'
  indexHtml = 'index.html'
}

function Resolve-Pair([string]$name) {
  $p = Join-Path $ProjJs $name
  if ($name -eq 'index.html') { $p = Join-Path $Project 'app\index.html' }
  $l = Join-Path $LiveJs $name
  if ($name -eq 'index.html') {
    $l = Join-Path $LiveApp 'index.html'
    if (-not (Test-Path -LiteralPath $l)) { $l = Join-Path $LiveApp 'app\index.html' }
  }
  return @{ proj = $p; live = $l; projExists = (Test-Path -LiteralPath $p); liveExists = (Test-Path -LiteralPath $l) }
}

# ---- probe ----
$probe = [ordered]@{}
foreach ($k in $Files.Keys) {
  $pair = Resolve-Pair $Files[$k]
  $probe[$k] = [ordered]@{
    projExists = (Test-Path -LiteralPath $pair.proj)
    liveExists = (Test-Path -LiteralPath $pair.live)
    proj = $pair.proj
    live = $pair.live
  }
  if ($probe[$k].projExists) {
    $t = Read-Text $pair.proj
    $probe[$k].len = $t.Length
    $probe[$k].hasMarker = $t.Contains($Marker)
    if ($k -eq 'unitTools') {
      $probe[$k].hasPAGES = [bool]($t -match 'var\s+PAGES\s*=')
      $probe[$k].hasUnitTermWatch = $t.Contains('unitTermWatch')
      $probe[$k].hasEnsureStores = $t.Contains('kmUnitEnsureStores')
      $probe[$k].hasFormal = $t.Contains('unitFormalArchives')
    }
    if ($k -eq 'positions') {
      $probe[$k].hasMakeVacant = [bool]($t -match 'MakeVacant|makeVacant|kmPositionMakeVacant')
      $probe[$k].hasVacantAttr = $t.Contains('data-km-pos="vacant"') -or $t.Contains("data-km-pos='vacant'")
      $probe[$k].hasZeroPerson = [bool]($t -match 'zeroPerson|clearPerson|Թափուր')
      $probe[$k].toastVacant = [bool]($t -match 'Պաշտոնը թափուր')
    }
    if ($k -eq 'usersUi') {
      $probe[$k].hasGrantMenu = $t.Contains('GRANT_MENU')
      $probe[$k].hasUnitTerm = $t.Contains('unitTermWatch')
    }
    if ($k -eq 'v3core') {
      $probe[$k].hasAccountingPages = $t.Contains('KM_ACCOUNTING_PAGES')
    }
    if ($k -eq 'indexHtml') {
      $probe[$k].hasUnitRegex = [bool]($t -match 'unitTermWatch|unit[A-Za-z]+')
      $probe[$k].hasRoleUserCss = $t.Contains('km-role-user')
      $probe[$k].hasNavCardIcon = $t.Contains('kmNavCardIcon')
    }
  }
}
$Report.probes = $probe
$probe | ConvertTo-Json -Depth 6 | Write-Host

# ---- JS payload: reserve store + helpers (injected into km-unit-tools.js) ----
$ReserveHelpers = @"
/* === $Marker helpers === */
(function () {
  'use strict';
  function deepClone(o) {
    try { return JSON.parse(JSON.stringify(o)); } catch (e) { return o ? Object.assign({}, o) : o; }
  }
  function splitAAH(name) {
    var parts = String(name || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    return {
      lastName: parts[0] || '',
      firstName: parts[1] || '',
      patronymic: parts.length > 2 ? parts.slice(2).join(' ') : ''
    };
  }
  function ensureReserveStore() {
    try {
      if (typeof window.kmUnitEnsureStores === 'function') window.kmUnitEnsureStores();
    } catch (e0) {}
    if (typeof db === 'undefined' || !db) return null;
    if (!Array.isArray(db.unitReserveArchive)) db.unitReserveArchive = [];
    return db.unitReserveArchive;
  }
  window.kmReserveArchiveEnsure = ensureReserveStore;
  window.kmReserveSplitAAH = splitAAH;
  window.kmReserveArchiveList = function (unitId) {
    var arr = ensureReserveStore() || [];
    var uid = String(unitId || '').trim();
    if (!uid) return arr.slice();
    return arr.filter(function (e) { return e && String(e.unitId || '') === uid; });
  };
  window.kmReserveArchiveSearch = function (opts) {
    opts = opts || {};
    var arr = ensureReserveStore() || [];
    var ln = String(opts.lastName || opts.azganun || '').trim().toLocaleLowerCase('hy-AM');
    var fn = String(opts.firstName || opts.anun || '').trim().toLocaleLowerCase('hy-AM');
    var pn = String(opts.patronymic || opts.hayranun || '').trim().toLocaleLowerCase('hy-AM');
    var free = String(opts.q || opts.text || '').trim().toLocaleLowerCase('hy-AM');
    var uid = String(opts.unitId || '').trim();
    function hit(e) {
      if (!e) return false;
      if (uid && String(e.unitId || '') !== uid) return false;
      var last = String(e.lastName || '').toLocaleLowerCase('hy-AM');
      var first = String(e.firstName || '').toLocaleLowerCase('hy-AM');
      var pat = String(e.patronymic || '').toLocaleLowerCase('hy-AM');
      var full = String(e.name || (last + ' ' + first + ' ' + pat)).toLocaleLowerCase('hy-AM');
      if (ln && last.indexOf(ln) < 0 && full.indexOf(ln) < 0) return false;
      if (fn && first.indexOf(fn) < 0 && full.indexOf(fn) < 0) return false;
      if (pn && pat.indexOf(pn) < 0 && full.indexOf(pn) < 0) return false;
      if (free) {
        var blob = [e.name, e.lastName, e.firstName, e.patronymic, e.rank, e.post, e.code, e.vus].join(' ').toLocaleLowerCase('hy-AM');
        if (blob.indexOf(free) < 0) return false;
      }
      return true;
    }
    return arr.filter(hit);
  };
  window.kmReserveArchiveAdd = function (entry) {
    var arr = ensureReserveStore();
    if (!arr) return null;
    entry = entry || {};
    var name = String(entry.name || '').trim();
    var parts = splitAAH(name);
    var rec = {
      id: entry.id || ((typeof uid === 'function') ? uid('rsv') : ('rsv_' + Date.now() + '_' + Math.floor(Math.random() * 1e6))),
      unitId: entry.unitId || '',
      corpsId: entry.corpsId || '',
      name: name,
      lastName: entry.lastName || parts.lastName,
      firstName: entry.firstName || parts.firstName,
      patronymic: entry.patronymic || parts.patronymic,
      rank: entry.rank || '',
      rankSlot: entry.rankSlot || '',
      post: entry.post || '',
      code: entry.code || '',
      vus: entry.vus || '',
      card: entry.card ? deepClone(entry.card) : null,
      positionSnapshot: entry.positionSnapshot ? deepClone(entry.positionSnapshot) : null,
      movedAt: entry.movedAt || (new Date()).toISOString(),
      sourcePosId: entry.sourcePosId || '',
      reason: entry.reason || 'vacant'
    };
    arr.unshift(rec);
    try {
      if (typeof save === 'function') save(true);
      else if (typeof window.kmSaveDb === 'function') window.kmSaveDb(true);
    } catch (eSave) {}
    return rec;
  };
  window.kmReserveArchiveAddFromPerson = function (person, pos, extra) {
    person = person || {};
    pos = pos || {};
    extra = extra || {};
    var name = String(person.name || pos.name || pos.personName || '').trim();
    if (!name) return null;
    var unitId = String(extra.unitId || person.unitId || pos.unitId || pos.orgUnitId || '').trim();
    var corpsId = String(extra.corpsId || person.corpsId || pos.corpsId || '').trim();
    try {
      if (!unitId && typeof window.kmGetActiveUnitId === 'function') unitId = String(window.kmGetActiveUnitId() || '');
      if (!corpsId && typeof window.kmGetActiveCorpsId === 'function') corpsId = String(window.kmGetActiveCorpsId() || '');
    } catch (eCtx) {}
    return window.kmReserveArchiveAdd({
      unitId: unitId,
      corpsId: corpsId,
      name: name,
      rank: person.rank || person.կոչում || pos.rank || pos.rankSlot || '',
      rankSlot: person.rankSlot || pos.rankSlot || '',
      post: person.post || pos.position || pos.post || '',
      code: person.postCode || person.code || pos.code || '',
      vus: person.vus || person.specialty || pos.vus || '',
      card: person,
      positionSnapshot: {
        id: pos.id || '',
        position: pos.position || pos.post || '',
        code: pos.code || '',
        rankSlot: pos.rankSlot || '',
        section: pos.section || pos.unit || ''
      },
      sourcePosId: pos.id || extra.sourcePosId || '',
      reason: extra.reason || 'vacant'
    });
  };
})();
/* === /$Marker helpers === */
"@

$ReservePageUi = @"
/* === $Marker unitReserve page === */
(function () {
  'use strict';
  function esc(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function val(id) {
    var el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
  }
  function openCard(rec) {
    if (!rec) return;
    var card = rec.card || rec;
    try {
      if (typeof window.kmOpenPersonCard === 'function') {
        window.kmOpenPersonCard(card, { readOnly: true, fromReserve: true });
        return;
      }
      if (typeof window.openPersonCard === 'function') {
        window.openPersonCard(card, { readOnly: true });
        return;
      }
    } catch (eOpen) {}
    var html = '<div class="card"><h3>' + esc(rec.name || '') + '</h3>' +
      '<div class="muted">' + esc(rec.rank || '') + ' · ' + esc(rec.post || '') + ' · ' + esc(rec.code || '') + '</div>' +
      '<div class="muted">Տեղափոխված՝ ' + esc(rec.movedAt || '') + '</div></div>';
    if (typeof window.kmShowModalHtml === 'function') window.kmShowModalHtml(html, 'Պահեստազոր');
    else alert(rec.name || 'Պահեստազոր');
  }
  function renderTable(rows) {
    if (!rows || !rows.length) {
      return '<div class="muted" style="padding:16px">Պահեստազորային արխիվում գրառումներ չկան կամ համընկնում չգտնվեց</div>';
    }
    var h = '<div class="gridwrap"><table class="grid"><thead><tr>' +
      '<th>Ազգանուն Անուն Հայրանուն</th><th>Կոչում</th><th>Հաստիք</th><th>Կոդ</th><th>Ամսաթիվ</th>' +
      '</tr></thead><tbody>';
    rows.forEach(function (r, i) {
      h += '<tr data-km-rsv-i="' + i + '" style="cursor:pointer">' +
        '<td>' + esc(r.name || ((r.lastName || '') + ' ' + (r.firstName || '') + ' ' + (r.patronymic || '')).trim()) + '</td>' +
        '<td>' + esc(r.rank || r.rankSlot || '') + '</td>' +
        '<td>' + esc(r.post || '') + '</td>' +
        '<td>' + esc(r.code || '') + '</td>' +
        '<td>' + esc(String(r.movedAt || '').slice(0, 19).replace('T', ' ')) + '</td></tr>';
    });
    h += '</tbody></table></div>';
    return h;
  }
  window.kmRenderUnitReserve = function (root) {
    try { if (typeof window.kmReserveArchiveEnsure === 'function') window.kmReserveArchiveEnsure(); } catch (e0) {}
    var host = root || document.getElementById('content') || document.getElementById('page') || document.body;
    var html = '' +
      '<div class="card" id="kmUnitReservePage">' +
      '<div class="title">Պահեստազոր</div>' +
      '<div class="muted" style="margin-bottom:10px">պահեստազորային արխիվ · որոնում ըստ ԱԱՀ</div>' +
      '<div class="toolbar" style="display:flex;gap:8px;flex-wrap:wrap;align-items:end">' +
      '<label>Ազգանուն<br><input id="kmRsvLast" type="text" style="min-width:140px"></label>' +
      '<label>Անուն<br><input id="kmRsvFirst" type="text" style="min-width:140px"></label>' +
      '<label>Հայրանուն<br><input id="kmRsvPat" type="text" style="min-width:140px"></label>' +
      '<label>Ազատ տեքստ<br><input id="kmRsvQ" type="text" style="min-width:160px"></label>' +
      '<button type="button" id="kmRsvSearchBtn">Որոնել</button>' +
      '</div>' +
      '<div id="kmRsvResults"></div></div>';
    host.innerHTML = html;
    var lastRows = [];
    function doSearch() {
      lastRows = (typeof window.kmReserveArchiveSearch === 'function')
        ? window.kmReserveArchiveSearch({
            lastName: val('kmRsvLast'),
            firstName: val('kmRsvFirst'),
            patronymic: val('kmRsvPat'),
            q: val('kmRsvQ')
          })
        : [];
      var box = document.getElementById('kmRsvResults');
      if (box) box.innerHTML = renderTable(lastRows);
    }
    var btn = document.getElementById('kmRsvSearchBtn');
    if (btn) btn.addEventListener('click', doSearch);
    ;['kmRsvLast','kmRsvFirst','kmRsvPat','kmRsvQ'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') doSearch(); });
    });
    var box0 = document.getElementById('kmRsvResults');
    if (box0) {
      box0.addEventListener('click', function (ev) {
        var tr = ev.target && ev.target.closest ? ev.target.closest('tr[data-km-rsv-i]') : null;
        if (!tr) return;
        var i = Number(tr.getAttribute('data-km-rsv-i'));
        if (!isNaN(i) && lastRows[i]) openCard(lastRows[i]);
      });
    }
    doSearch();
  };
  try {
    if (typeof window.kmUnitOpen === 'function') {
      /* render map hooked below via PAGES registration */
    }
  } catch (eMap) {}
})();
/* === /$Marker unitReserve page === */
"@

function Patch-UnitTools([string]$path) {
  $t = Read-Text $path
  if ($t.Contains($Marker + ' helpers') -and $t.Contains('unitReserve')) {
    Log "unit-tools already has marker features: $path"
  }

  # Ensure store in kmUnitEnsureStores
  if ($t -match 'function\s+kmUnitEnsureStores\s*\(' -or $t -match 'window\.kmUnitEnsureStores\s*=') {
    if ($t -notmatch 'unitReserveArchive') {
      $t = [regex]::Replace($t,
        '(kmUnitEnsureStores[\s\S]{0,1200}?)(return\s+db;|return\s*;)',
        {
          param($m)
          $body = $m.Groups[1].Value
          if ($body -match 'unitReserveArchive') { return $m.Value }
          return $body + "  if (!Array.isArray(db.unitReserveArchive)) db.unitReserveArchive = []; /* $Marker */`r`n  " + $m.Groups[2].Value
        }, 1)
      # fallback insert after unitFormalArchives line
      if ($t -notmatch 'unitReserveArchive') {
        if ($t -match 'unitFormalArchives') {
          $t = $t -replace '(unitFormalArchives[^\n]*\n)', ('$1  if (!Array.isArray(db.unitReserveArchive)) db.unitReserveArchive = []; /* ' + $Marker + " */`r`n")
        }
      }
    }
  } else {
    Log 'WARN: kmUnitEnsureStores not found — helpers still create array on use'
  }

  # PAGES entry
  if ($t -notmatch "unitReserve\s*:\s*'Պահեստազոր'") {
    if ($t -match "unitBadDays\s*:\s*'[^']*'") {
      $t = [regex]::Replace($t, "(unitBadDays\s*:\s*'[^']*')", ('$1,' + "`r`n    unitReserve: 'Պահեստազոր' /* $Marker */"), 1)
    } elseif ($t -match "unitTermWatch\s*:\s*'[^']*'") {
      $t = [regex]::Replace($t, "(unitTermWatch\s*:\s*'[^']*')", ('$1,' + "`r`n    unitReserve: 'Պահեստազոր' /* $Marker */"), 1)
    } elseif ($t -match 'var\s+PAGES\s*=\s*\{') {
      $t = [regex]::Replace($t, '(var\s+PAGES\s*=\s*\{)', ('$1' + "`r`n    unitReserve: 'Պահեստազոր', /* $Marker */"), 1)
    } else {
      Fail 'PAGES object not found in km-unit-tools.js'
    }
  }

  # Render map: look for unitBadDays: function or kmRenderUnitBadDays style
  if ($t -notmatch 'kmRenderUnitReserve|unitReserve\s*:\s*function|case\s+[''"]unitReserve[''"]') {
    if ($t -match "unitBadDays\s*:\s*['\`"]?") {
      # object map style unitBadDays: renderX
      if ($t -match "unitBadDays\s*:\s*(function\s*\(|[a-zA-Z_][\w\.]*)") {
        $t = [regex]::Replace($t, "(unitBadDays\s*:\s*(?:function\s*\([^)]*\)\s*\{[\s\S]*?\n\s*\}|[a-zA-Z_][\w\.]*))", ('$1,' + "`r`n    unitReserve: function (root) { if (window.kmRenderUnitReserve) window.kmRenderUnitReserve(root); } /* $Marker */"), 1)
      }
    }
    if ($t -notmatch 'kmRenderUnitReserve|unitReserve\s*:\s*function') {
      # switch/case style
      if ($t -match "case\s+['\`"]unitBadDays['\`"]") {
        $t = [regex]::Replace($t, "(case\s+['\`"]unitBadDays['\`"]\s*:[^\n]*\n)", ('$1      case ''unitReserve'': if (window.kmRenderUnitReserve) window.kmRenderUnitReserve(); break; /* ' + $Marker + " */`r`n"), 1)
      } elseif ($t -match "case\s+['\`"]unitTermWatch['\`"]") {
        $t = [regex]::Replace($t, "(case\s+['\`"]unitTermWatch['\`"]\s*:[^\n]*\n)", ('$1      case ''unitReserve'': if (window.kmRenderUnitReserve) window.kmRenderUnitReserve(); break; /* ' + $Marker + " */`r`n"), 1)
      }
    }
    if ($t -notmatch 'unitReserve\s*:\s*function|case\s+[''"]unitReserve[''"]|kmRenderUnitReserve') {
      # append registration near kmUnitOpen
      if ($t -match 'window\.kmUnitOpen\s*=') {
        $t = $t + "`r`ntry { /* $Marker map */ var _kmRsvHook = window.kmUnitOpen; } catch (eRsvHook) {}`r`n"
      }
      Log 'WARN: render map hook may need manual verify — page fn still exported'
    }
  }

  # Inject helpers + page UI once
  if ($t -notmatch [regex]::Escape("/* === $Marker helpers === */")) {
    $t = $t + "`r`n" + $ReserveHelpers + "`r`n" + $ReservePageUi + "`r`n"
  } elseif ($t -notmatch [regex]::Escape("/* === $Marker unitReserve page === */")) {
    $t = $t + "`r`n" + $ReservePageUi + "`r`n"
  }

  # Also wire render inside known render dispatch if present as: if (name==='unitBadDays')
  if ($t -match "name\s*===\s*['\`"]unitBadDays['\`"]" -and $t -notmatch "name\s*===\s*['\`"]unitReserve['\`"]") {
    $t = [regex]::Replace($t, "(name\s*===\s*['\`"]unitBadDays['\`"]\s*\)\s*\{)", ('$1 /* pass */ } else if (name === ''unitReserve'') { if (window.kmRenderUnitReserve) window.kmRenderUnitReserve(); /* ' + $Marker + ' */ if (false) {'), 1)
  }

  Backup-File $path | Out-Null
  Write-Text $path $t
  Note-Changed $path
  Log "patched unit-tools $path"
}

function Patch-Positions([string]$path) {
  $t = Read-Text $path
  # Find vacant handler
  $fnPatterns = @(
    'function\s+kmPositionMakeVacant\s*\(',
    'window\.kmPositionMakeVacant\s*=\s*function\s*\(',
    'function\s+makeVacant\s*\(',
    'function\s+kmMakeVacant\s*\(',
    'data-km-pos\s*=\s*["'']vacant["'']'
  )
  $found = $false
  foreach ($p in $fnPatterns) { if ($t -match $p) { $found = $true; break } }
  $Report.probes['positionsVacantFound'] = $found

  $hook = @"

/* === $Marker vacant→reserve hook === */
(function () {
  'use strict';
  function kmReserveCopyBeforeVacant(person, pos) {
    try {
      if (!person) return null;
      var name = String(person.name || '').trim();
      if (!name) return null;
      if (typeof window.kmReserveArchiveAddFromPerson === 'function') {
        return window.kmReserveArchiveAddFromPerson(person, pos || {}, { reason: 'vacant' });
      }
      if (typeof window.kmReserveArchiveAdd === 'function') {
        return window.kmReserveArchiveAdd({
          name: name,
          card: person,
          positionSnapshot: pos || null,
          sourcePosId: pos && pos.id,
          reason: 'vacant'
        });
      }
    } catch (e) { console.warn('$Marker copy failed', e); }
    return null;
  }
  window.kmReserveCopyBeforeVacant = kmReserveCopyBeforeVacant;

  function wrapVacant(orig) {
    if (typeof orig !== 'function') return orig;
    if (orig.__kmReserveWrapped) return orig;
    var wrapped = function () {
      var args = arguments;
      var pos = args[0], person = null;
      try {
        if (pos && typeof pos === 'object') {
          person = pos.person || pos.holder || null;
          if (!person && pos.personId && typeof db !== 'undefined' && db && Array.isArray(db.people)) {
            person = db.people.find(function (p) { return p && p.id === pos.personId; }) || null;
          }
          if (!person) {
            var nm = String(pos.name || pos.personName || pos.fio || '').trim();
            if (nm && typeof db !== 'undefined' && db && Array.isArray(db.people)) {
              person = db.people.find(function (p) { return p && String(p.name || '') === nm; }) || { name: nm };
            } else if (nm) person = { name: nm, rank: pos.rank || pos.rankSlot, post: pos.position || pos.post, code: pos.code };
          }
        }
        if (person && String(person.name || '').trim()) {
          kmReserveCopyBeforeVacant(person, pos);
          try {
            if (typeof window.kmHishoxutyunLog === 'function') {
              window.kmHishoxutyunLog({ action: 'vacant', detail: 'copied to պահեստազորային արխիվ then cleared', name: person.name, posId: pos && pos.id });
            }
          } catch (eLog) {}
        }
      } catch (ePre) { console.warn('$Marker pre-vacant', ePre); }
      return orig.apply(this, args);
    };
    wrapped.__kmReserveWrapped = true;
    try { wrapped.toString = function () { return orig.toString(); }; } catch (eTs) {}
    return wrapped;
  }

  function install() {
    var names = ['kmPositionMakeVacant', 'makePositionVacant', 'kmMakeVacant', 'makeVacant'];
    names.forEach(function (n) {
      if (typeof window[n] === 'function') window[n] = wrapVacant(window[n]);
    });
  }
  install();
  setTimeout(install, 0);
  setTimeout(install, 500);
  setTimeout(install, 2000);
})();
/* === /$Marker vacant→reserve hook === */
"@

  # Inline before zeroPersonCard calls if present
  if ($t -match 'zeroPersonCard\s*\(' -and $t -notmatch [regex]::Escape($Marker + ' vacant→reserve')) {
    $t = [regex]::Replace($t,
      'zeroPersonCard\s*\(\s*([^)]+)\s*\)',
      {
        param($m)
        $arg = $m.Groups[1].Value
        "(function(){ try{ if(window.kmReserveCopyBeforeVacant){ var __p=$arg; var __pos=typeof pos!=='undefined'?pos:(typeof position!=='undefined'?position:null); window.kmReserveCopyBeforeVacant(__p,__pos);} }catch(eRsv){} return zeroPersonCard($arg); })()"
      })
  }

  # Update confirm messages mentioning vacant
  if ($t -match 'confirm\([^\)]*թափուր' -and $t -notmatch 'պահեստազորային արխիվ') {
    $t = [regex]::Replace($t,
      '(confirm\([^\)]*?)(թափուր[^\)]*?)(\))',
      ('$1$2 (անձը կպահվի պահեստազորային արխիվում)$3 /* ' + $Marker + ' */'))
  }

  # Toast after vacant
  if ($t -match 'Պաշտոնը թափուր է' -and $t -notmatch 'պահեստազորային արխիվ') {
    $t = $t.Replace('Պաշտոնը թափուր է', 'Անձը տեղափոխվեց պահեստազորային արխիվ, հաստիքը թափուր է')
  }

  if ($t -notmatch [regex]::Escape("/* === $Marker vacant→reserve hook === */")) {
    $t = $t + "`r`n" + $hook + "`r`n"
  }

  Backup-File $path | Out-Null
  Write-Text $path $t
  Note-Changed $path
  Log "patched positions $path"
}

function Patch-UsersUi([string]$path) {
  $t = Read-Text $path
  if ($t -notmatch 'GRANT_MENU') { Fail 'GRANT_MENU missing in km-users-ui.js' }

  # Add unitReserve under accounting children near unitTermWatch / unitBadDays
  if ($t -notmatch "id\s*:\s*['\`"]unitReserve['\`"]") {
    $entry = "{ id: 'unitReserve', label: 'Պահեստազոր', icon: '🏛' } /* $Marker */"
    if ($t -match "id\s*:\s*['\`"]unitBadDays['\`"]") {
      $t = [regex]::Replace($t, "(\{[^\{\}]*id\s*:\s*['\`"]unitBadDays['\`"][^\{\}]*\})", ('$1, ' + $entry), 1)
    } elseif ($t -match "id\s*:\s*['\`"]unitTermWatch['\`"]") {
      $t = [regex]::Replace($t, "(\{[^\{\}]*id\s*:\s*['\`"]unitTermWatch['\`"][^\{\}]*\})", ('$1, ' + $entry), 1)
    } elseif ($t -match "label\s*:\s*['\`"]Հաշվառում['\`"]") {
      # insert into first children array after accounting
      $t = [regex]::Replace($t, "(id\s*:\s*['\`"]accounting['\`"][\s\S]{0,800}?children\s*:\s*\[)", ('$1' + $entry + ', '), 1)
    } else {
      Fail 'Could not find GRANT_MENU anchor for unitReserve'
    }
  }

  # Sync GRANT_MENU icons with side-nav style emojis where mismatched — normalize known accounting children
  # Prefer copying icon strings from a side-nav map if present in file
  if ($t -match "kmNavCardIcon|icon\s*:\s*['\`"]") {
    Log 'GRANT_MENU icons present — unitReserve set to 🏛'
  }

  Backup-File $path | Out-Null
  Write-Text $path $t
  Note-Changed $path
  Log "patched users-ui $path"
}

function Patch-V3Core([string]$path) {
  $t = Read-Text $path
  if ($t -notmatch 'KM_ACCOUNTING_PAGES') { Fail 'KM_ACCOUNTING_PAGES missing' }
  if ($t -notmatch "unitReserve") {
    # object or array form
    if ($t -match 'KM_ACCOUNTING_PAGES\s*=\s*\{') {
      if ($t -match "unitBadDays\s*:\s*true") {
        $t = [regex]::Replace($t, "(unitBadDays\s*:\s*true)", ('$1, unitReserve: true /* ' + $Marker + ' */'), 1)
      } elseif ($t -match "unitTermWatch\s*:\s*true") {
        $t = [regex]::Replace($t, "(unitTermWatch\s*:\s*true)", ('$1, unitReserve: true /* ' + $Marker + ' */'), 1)
      } else {
        $t = [regex]::Replace($t, '(KM_ACCOUNTING_PAGES\s*=\s*\{)', ('$1 unitReserve: true, /* ' + $Marker + ' */ '), 1)
      }
    } elseif ($t -match 'KM_ACCOUNTING_PAGES\s*=\s*\[') {
      $t = [regex]::Replace($t, "(KM_ACCOUNTING_PAGES\s*=\s*\[)", ('$1''unitReserve'', /* ' + $Marker + ' */ '), 1)
    }
  }
  Backup-File $path | Out-Null
  Write-Text $path $t
  Note-Changed $path
  Log "patched v3-core $path"
}

function Patch-IndexHtml([string]$path) {
  $t = Read-Text $path

  # openPage defer / unit* regex — add unitReserve
  if ($t -notmatch 'unitReserve') {
    if ($t -match 'unitTermWatch\|unitBadDays') {
      $t = $t -replace 'unitTermWatch\|unitBadDays', 'unitTermWatch|unitBadDays|unitReserve'
    } elseif ($t -match 'unitBadDays') {
      $t = $t -replace 'unitBadDays', 'unitBadDays|unitReserve'
    } elseif ($t -match 'unit[A-Za-z]+\|unit') {
      # generic: append to a unit* alternation if obvious
      $t = [regex]::Replace($t, '(unitTermWatch)', 'unitTermWatch|unitReserve', 1)
    }
  }

  # Icon/color parity: neutralize user-role overrides that recolor kmNavCardIcon differently from admin
  $cssFix = @"

/* === $Marker nav icon color parity === */
body.km-role-user .side .km-side-menu > .nav.kmNavCard .kmNavCardIcon,
body.km-role-editor .side .km-side-menu > .nav.kmNavCard .kmNavCardIcon,
body.km-role-viewer .side .km-side-menu > .nav.kmNavCard .kmNavCardIcon {
  /* keep same badge gradient/colors as admin — do not gray/desaturate section icons */
  filter: none !important;
  opacity: 1 !important;
}
body.km-role-user .side .km-side-menu > .nav.kmNavCard,
body.km-role-editor .side .km-side-menu > .nav.kmNavCard {
  /* preserve admin card chrome for granted sections */
}
/* === /$Marker nav icon color parity === */
"@
  if ($t -notmatch [regex]::Escape("/* === $Marker nav icon color parity === */")) {
    if ($t -match '</style>') {
      $t = [regex]::Replace($t, '</style>', ($cssFix + "`r`n</style>"), 1)
    } else {
      $t = $t + $cssFix
    }
  }

  # If user CSS forces different background on icons, soften specific overrides of kmNavCardIcon under km-role-user
  $t = [regex]::Replace($t,
    '(body\.km-role-user[^{]*kmNavCardIcon[^{]*\{)([^}]*)(\})',
    {
      param($m)
      $body = $m.Groups[2].Value
      # strip filter/opacity/background overrides that diverge from admin
      $body2 = [regex]::Replace($body, 'filter\s*:[^;];?', '')
      $body2 = [regex]::Replace($body2, 'opacity\s*:[^;];?', '')
      return $m.Groups[1].Value + $body2 + ' /* ' + $Marker + ' parity */ ' + $m.Groups[3].Value
    })

  Backup-File $path | Out-Null
  Write-Text $path $t
  Note-Changed $path
  Log "patched index.html $path"
}

function Deploy-ToLive([string]$projPath, [string]$livePath) {
  if (-not (Test-Path -LiteralPath $projPath)) { return }
  $liveDir = Split-Path -Parent $livePath
  if (-not (Test-Path -LiteralPath $liveDir)) { New-Item -ItemType Directory -Force -Path $liveDir | Out-Null }
  if (Test-Path -LiteralPath $livePath) { Backup-File $livePath | Out-Null }
  Copy-Item -LiteralPath $projPath -Destination $livePath -Force
  Note-Changed $livePath
  Log "deployed -> $livePath"
}

function Repair-BuildSetup([string]$buildPs1) {
  if (-not (Test-Path -LiteralPath $buildPs1)) { Fail "BUILD_SETUP.ps1 missing: $buildPs1" }
  $t = Read-Text $buildPs1
  if ($t.Contains($Marker)) {
    Log 'BUILD_SETUP.ps1 already has marker'
    return
  }
  $block = @"

# $Marker — keep reserve archive / vacant copy / unitReserve page on rebuild
function Repair-KmReserveArchiveV1([string]`$AppJsDir) {
  `$unit = Join-Path `$AppJsDir 'km-unit-tools.js'
  `$pos = Join-Path `$AppJsDir 'km-positions.js'
  `$users = Join-Path `$AppJsDir 'km-users-ui.js'
  `$core = Join-Path `$AppJsDir 'km-v3-core.js'
  `$idx = Join-Path (Split-Path -Parent `$AppJsDir) 'index.html'
  `$projApp = Join-Path `$Project 'app'
  `$projJs = Join-Path `$projApp 'js'
  foreach (`$pair in @(
    @{ dst = `$unit; src = Join-Path `$projJs 'km-unit-tools.js' },
    @{ dst = `$pos; src = Join-Path `$projJs 'km-positions.js' },
    @{ dst = `$users; src = Join-Path `$projJs 'km-users-ui.js' },
    @{ dst = `$core; src = Join-Path `$projJs 'km-v3-core.js' },
    @{ dst = `$idx; src = Join-Path `$projApp 'index.html' }
  )) {
    if ((Test-Path -LiteralPath `$pair.src) -and (Test-Path -LiteralPath (Split-Path -Parent `$pair.dst))) {
      Copy-Item -LiteralPath `$pair.src -Destination `$pair.dst -Force
      Log '$Marker synced ' + ([IO.Path]::GetFileName(`$pair.dst))
    }
  }
  if (Test-Path -LiteralPath `$unit) {
    `$txt = [IO.File]::ReadAllText(`$unit)
    if (`$txt -notmatch 'unitReserve') { Log 'WARN $Marker unitReserve missing after sync' }
    else { Log '$Marker unitReserve OK' }
  }
}
"@
  # Insert function before first Repair call site or near other Repair functions
  if ($t -match 'function Repair-KmPromotionAccessStaffingCode') {
    $t = $t -replace 'function Repair-KmPromotionAccessStaffingCode', ($block + "`r`nfunction Repair-KmPromotionAccessStaffingCode")
  } else {
    $t = $t + "`r`n" + $block
  }
  # Call on project app + stage
  if ($t -match 'Repair-KmPromotionAccessStaffingCode \(Join-Path \$Project') {
    $t = $t -replace '(Repair-KmPromotionAccessStaffingCode \(Join-Path \$Project[^\n]+\))', ('$1' + "`r`nRepair-KmReserveArchiveV1 (Join-Path `$Project 'app\js')")
  } else {
    $t = $t + "`r`nRepair-KmReserveArchiveV1 (Join-Path `$Project 'app\js')`r`n"
  }
  if ($t -match 'Repair-KmPromotionAccessStaffingCode \$stagePosJs') {
    $t = $t -replace '(Repair-KmPromotionAccessStaffingCode \$stagePosJs)', ('$1' + "`r`n  Repair-KmReserveArchiveV1 (Split-Path -Parent `$stagePosJs)")
  }

  Backup-File $buildPs1 | Out-Null
  Write-Text $buildPs1 $t
  Note-Changed $buildPs1
  Log 'wired BUILD_SETUP.ps1'
}

function Invoke-Integrity {
  $integrity = Join-Path $Project 'scripts\km_write_integrity.cjs'
  if (-not (Test-Path -LiteralPath $integrity)) {
    $alt = Join-Path $Project 'scripts_patch\km_write_integrity.cjs'
    if (Test-Path -LiteralPath $alt) { $integrity = $alt }
  }
  if (-not (Test-Path -LiteralPath $integrity)) { Log 'WARN integrity script missing'; return }
  if (-not $KmExe) { Log 'WARN KM.exe missing — skip integrity'; return }
  $env:ELECTRON_RUN_AS_NODE = '1'
  try {
    & $KmExe $integrity $LiveApp
    Log "integrity exit=$LASTEXITCODE"
    $Report.tests['integrityExit'] = $LASTEXITCODE
  } finally {
    Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
  }
}

function Invoke-NodeTests {
  $testJs = Join-Path $env:TEMP ("km_reserve_test_{0}.cjs" -f $Stamp)
  $unitTools = (Resolve-Pair 'km-unit-tools.js').proj
  $testBody = @'
'use strict';
const fs = require('fs');
const path = require('path');
const unitTools = process.argv[2];
const src = fs.readFileSync(unitTools, 'utf8');
const marker = 'KM_RESERVE_ARCHIVE_V1';
const checks = {
  hasMarker: src.includes(marker),
  hasUnitReservePage: /unitReserve\s*:\s*'Պահեստազոր'/.test(src),
  hasAdd: src.includes('kmReserveArchiveAdd'),
  hasSearch: src.includes('kmReserveArchiveSearch'),
  hasStore: src.includes('unitReserveArchive'),
  hasRender: src.includes('kmRenderUnitReserve')
};
// simulate search
function splitAAH(name) {
  const parts = String(name || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  return { lastName: parts[0] || '', firstName: parts[1] || '', patronymic: parts.length > 2 ? parts.slice(2).join(' ') : '' };
}
const db = { unitReserveArchive: [] };
function add(entry) {
  const parts = splitAAH(entry.name);
  const rec = Object.assign({ id: 't1', reason: 'vacant', movedAt: new Date().toISOString() }, parts, entry);
  db.unitReserveArchive.unshift(rec);
  return rec;
}
add({ name: 'Սարգսյան Արամ Վարդանի', rank: 'կապիտան', post: 'հրամանատար', code: '21', unitId: 'u1' });
add({ name: 'Հովհաննիսյան Գևորգ', rank: 'լեյտենանտ', post: 'սպա', code: '19', unitId: 'u1' });
function search(opts) {
  const ln = String(opts.lastName || '').toLowerCase();
  const fn = String(opts.firstName || '').toLowerCase();
  const pn = String(opts.patronymic || '').toLowerCase();
  return db.unitReserveArchive.filter((e) => {
    const last = String(e.lastName || '').toLowerCase();
    const first = String(e.firstName || '').toLowerCase();
    const pat = String(e.patronymic || '').toLowerCase();
    if (ln && !last.includes(ln)) return false;
    if (fn && !first.includes(fn)) return false;
    if (pn && !pat.includes(pn)) return false;
    return true;
  });
}
const hit = search({ lastName: 'Սարգսյան', firstName: 'Արամ', patronymic: 'Վարդանի' });
const miss = search({ lastName: 'Ոչոք' });
const result = {
  checks,
  searchHit: hit.length === 1,
  searchMiss: miss.length === 0,
  storeCount: db.unitReserveArchive.length,
  pass: Object.values(checks).every(Boolean) && hit.length === 1 && miss.length === 0
};
console.log(JSON.stringify(result, null, 2));
process.exit(result.pass ? 0 : 1);
'@
  Write-Text $testJs $testBody
  $node = Get-Command node -ErrorAction SilentlyContinue
  if ($node) {
    $out = & node $testJs $unitTools 2>&1 | Out-String
    Log $out
    $Report.tests['node'] = $out
    $Report.tests['nodeExit'] = $LASTEXITCODE
  } elseif ($KmExe) {
    $env:ELECTRON_RUN_AS_NODE = '1'
    try {
      $out = & $KmExe $testJs $unitTools 2>&1 | Out-String
      Log $out
      $Report.tests['node'] = $out
      $Report.tests['nodeExit'] = $LASTEXITCODE
    } finally {
      Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
    }
  } else {
    Log 'WARN no node/electron for tests'
    $Report.tests['nodeExit'] = -1
  }
}

# ---- apply to project ----
$pairUnit = Resolve-Pair 'km-unit-tools.js'
$pairPos = Resolve-Pair 'km-positions.js'
$pairUsers = Resolve-Pair 'km-users-ui.js'
$pairCore = Resolve-Pair 'km-v3-core.js'
$pairIdx = Resolve-Pair 'index.html'

if (-not (Test-Path -LiteralPath $pairUnit.proj)) { Fail "Missing $($pairUnit.proj)" }
Patch-UnitTools $pairUnit.proj
Patch-Positions $pairPos.proj
Patch-UsersUi $pairUsers.proj
Patch-V3Core $pairCore.proj
if (Test-Path -LiteralPath $pairIdx.proj) { Patch-IndexHtml $pairIdx.proj } else { Log 'WARN index.html missing in project' }

# cmd mirror note
$cmd = Join-Path $Project 'BUILD_SETUP.cmd'
$ps1 = Join-Path $Project 'BUILD_SETUP.ps1'
Repair-BuildSetup $ps1

# deploy
Deploy-ToLive $pairUnit.proj $pairUnit.live
Deploy-ToLive $pairPos.proj $pairPos.live
Deploy-ToLive $pairUsers.proj $pairUsers.live
Deploy-ToLive $pairCore.proj $pairCore.live
if (Test-Path -LiteralPath $pairIdx.proj) { Deploy-ToLive $pairIdx.proj $pairIdx.live }

Invoke-Integrity
Invoke-NodeTests

# build attempt
$Report.build['attempted'] = $false
if (Test-Path -LiteralPath $cmd) {
  $Report.build['attempted'] = $true
  Log 'Running BUILD_SETUP.cmd ...'
  try {
    $p = Start-Process -FilePath $cmd -WorkingDirectory $Project -Wait -PassThru -NoNewWindow
    $Report.build['exit'] = $p.ExitCode
    Log "BUILD_SETUP exit=$($p.ExitCode)"
  } catch {
    $Report.build['error'] = "$_"
    Log "BUILD failed: $_"
  }
  $exeCandidates = @(
    (Join-Path $Project 'dist\KM_Setup_x64.exe'),
    (Join-Path $Project 'KM_Setup_x64.exe'),
    (Join-Path $Project 'payload\KM_Setup_x64.exe')
  )
  foreach ($e in $exeCandidates) {
    if (Test-Path -LiteralPath $e) {
      $Report.build['exe'] = $e
      if ($e -ne (Join-Path $Project 'KM_Setup_x64.exe')) {
        Copy-Item -LiteralPath $e -Destination (Join-Path $Project 'KM_Setup_x64.exe') -Force
        $Report.build['exeCopiedToProject'] = $true
      }
      break
    }
  }
}

$outReport = Join-Path $Project ("KM_RESERVE_ARCHIVE_REPORT_{0}.json" -f $Stamp)
$Report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $outReport -Encoding UTF8
Log "report $outReport"
Write-Host ($Report | ConvertTo-Json -Depth 8)
if ($Report.errors.Count -gt 0) { exit 1 }
exit 0
