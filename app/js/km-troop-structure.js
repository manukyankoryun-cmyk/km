/* KM_UNIFIED_ARCHIVE_FLOW_V1_TROOP_DONE */
/* KM_OVERHAUL_V6_EXCEL_GATE */
/* KM_UNIFIED_ARCHIVE_FLOW_V2_TROOP_DONE */
/* KM — ԱՆձՆԱԿԱԶՄԻ ՀԱՇՎԱՌՈՒՄ · Excel A–AU + սյունակային ֆիլտր (AutoFilter) */
(function () {
  'use strict';

  var DEFAULT_COLS = [
    { key: 'unit', letter: 'A', label: "Ստորաբաժանում", w: 150 },
    { key: 'position', letter: 'B', label: "Պաշտոն", w: 240 },
    { key: 'seq', letter: 'C', label: "Հ/Հ", w: 44 },
    { key: 'secret', letter: 'D', label: "Գաղտնիության կարգ", w: 70 },
    { key: 'vus', letter: 'E', label: "ԶՀՄ(ВУС)", w: 64 },
    { key: 'code', letter: 'F', label: "Հաստիքի կոդ", w: 70 },
    { key: 'rankSlot', letter: 'G', label: "Կոչումը ըստ հաստիքի", w: 100 },
    { key: 'rank', letter: 'H', label: "Կոչում", w: 100 },
    { key: 'name', letter: 'I', label: "Ա․Ա․Հ․", w: 220 },
    { key: 'posOrder', letter: 'J', label: "Պաշտոնի նշանակման հրաման", w: 130 },
    { key: 'rankOrder', letter: 'K', label: "Կոչումի հրաման", w: 120 },
    { key: 'contract', letter: 'L', label: "Պայմանագիր", w: 90 },
    { key: 'special', letter: 'M', label: "Հատուկ նշում", w: 90 },
    { key: 'contact', letter: 'N', label: "Կոնտակտ", w: 100 },
    { key: 'birth', letter: 'O', label: "Ծննդյան թիվ", w: 100 },
    { key: 'zk', letter: 'P', label: "ԶԿ (ՏՍ)", w: 80 },
    { key: 'address', letter: 'Q', label: "Հասցե", w: 130 },
    { key: 'serviceYear', letter: 'R', label: "Ծառայության ընդունվելու (նշանակվելու տարեթիվը)", w: 140 },
    { key: 'discipline', letter: 'S', label: "Կարգ․ Տույժ", w: 90 },
    { key: 'serviceTotal', letter: 'T', label: "Ծառայությունը զինված ուժերում", w: 110 },
    { key: 'lastAccept', letter: 'U', label: "Վերջին ընդունում", w: 100 },
    { key: 'idCard', letter: 'V', label: "Անձնական վկայական", w: 110 },
    { key: 'blood', letter: 'W', label: "Արյան կարգ", w: 70 },
    { key: 'caseNo', letter: 'X', label: "Գործի համար", w: 90 },
    { key: 'vacation', letter: 'Y', label: "Արձակուրդ", w: 90 },
    { key: 'hsk', letter: 'Z', label: "ՀԾՀ", w: 60 },
    { key: 'passport', letter: 'AA', label: "Անձնագիր Նույնականացման քարտ", w: 150 },
    { key: 'family', letter: 'AB', label: "Ընտանիքի կազմը", w: 120 },
    { key: 'education', letter: 'AC', label: "Կրթությունը", w: 120 },
    { key: 'mandatory', letter: 'AD', label: "Պատադիր", w: 80 },
    { key: 'voluntary', letter: 'AE', label: "Կամավոր", w: 80 },
    { key: 'resubmit', letter: 'AF', label: "Վերահանձնում", w: 90 },
    { key: 'nonCombat', letter: 'AG', label: "Ոչ մարտական", w: 90 },
    { key: 'retrain', letter: 'AH', label: "Կրկնակի կամ բարելավում", w: 110 },
    { key: 'record', letter: 'AI', label: "Արձանագրություն", w: 90 },
    { key: 'attestPeriod', letter: 'AJ', label: "Ատեստավորման ժամանակահատվածը", w: 120 },
    { key: 'attestMarch', letter: 'AK', label: "Շարային", w: 55 },
    { key: 'attestPhys', letter: 'AL', label: "Ֆիզիկական", w: 70 },
    { key: 'attestFire', letter: 'AM', label: "Կրակային", w: 70 },
    { key: 'attestProf', letter: 'AN', label: "Մասնագիտական", w: 80 },
    { key: 'attestTotal', letter: 'AO', label: "Ատեստավորման ընդհանուր գնահատական", w: 90 },
    { key: 'medal', letter: 'AP', label: "Մեդալ", w: 80 },
    { key: 'amb1', letter: 'AQ', label: "Ամբասիր 1-ին", w: 70 },
    { key: 'amb2', letter: 'AR', label: "Ամբասիր 2-րդ", w: 70 },
    { key: 'amb3', letter: 'AS', label: "Ամբասիր 3-րդ", w: 70 },
    { key: 'amb4', letter: 'AT', label: "Ամբասիր 4-րդ", w: 70 },
    { key: 'caseBrief', letter: 'AU', label: "Անձնական գործին ծանոթացման", w: 120 }
  ];

  var activeTab = 'staff';
  var filterSearch = '';
  var vacantOnly = false;
  var jumpSection = '';
  var treeQuery = '';
  var pageIndex = 0;
  var PAGE_SIZE = 200; /* KM_TROOP_CLEAN_ARCHIVE_LAYOUT_V2 */
  var TROOP_ROW_H = 38; /* KM_TROOP_VIRTUAL_SCROLL_V1 */
  var TROOP_OVERSCAN = 12;
  var importing = false;
  var editMode = true;
  var fullScreen = false;
  var selectedIdx = -1;

  /** Excel AutoFilter — key → { pick: {val:true}, sort: 'asc'|'desc'|null } */
  var colFilters = {};
  var openFilterKey = '';
  var filterPopupSearch = '';
  var _uniqCache = {};

  /* KM_PERF_HACHVARUM_V1 — filteredStaffRows()/getColumns()/dedupe were being recomputed
     from scratch on every single native 'scroll' event, which is fired dozens of times per
     second and caused the choppy/freezing ("կտրատելով") behavior on large rosters.
     These caches make paintTroopVirtual() do only cheap index math on scroll; the actual
     O(n) recompute only happens when the underlying data or an active filter really changes. */
  var _colsCache = null;
  var _filteredCache = null;
  var _filteredDirty = true;
  var _dedupeDirty = true;
  function invalidateFilteredCache() { _filteredDirty = true; }
  function markStaffRowsChanged() { _dedupeDirty = true; _filteredDirty = true; invalidateUniqCache(); }

  function escAttr(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }
  function esc(s) {
    return typeof window.esc === 'function' ? window.esc(s) : String(s == null ? '' : s);
  }
  function jsStr(s) {
    return String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }
  function canEdit() {
    if (window.kmUserRole === 'viewer') return false;
    if (typeof window.kmIsAppAdmin === 'function' && window.kmIsAppAdmin()) return true;
    if (window.kmUserRole === 'admin') return true;
    try {
      if (sessionStorage.getItem('km_auth_mode') === 'admin') return true;
      if (sessionStorage.getItem('km_auth_role') === 'admin') return true;
    } catch (e0) {}
    if (typeof window.kmCanAdmin === 'function' && window.kmCanAdmin()) return true;
    if (typeof window.kmIsSuperAdmin === 'function' && window.kmIsSuperAdmin()) return true;
    if (typeof window.kmIsOrgAdmin === 'function' && window.kmIsOrgAdmin()) return true;
    if (typeof window.kmCanEditPersonnelOp === 'function' && window.kmCanEditPersonnelOp('card')) return true;
    if (typeof window.kmCanEditPage === 'function') {
      if (window.kmCanEditPage('troopStructure') || window.kmCanEditPage('accounting') || window.kmCanEditPage('people')) return true;
    }
    if (typeof window.kmCanEdit === 'function') {
      if (window.kmCanEdit('troopStructure') || window.kmCanEdit('accounting') || window.kmCanEdit('people')) return true;
    }
    return window.kmUserRole !== 'viewer';
  }
  function toastMsg(msg, kind) {
    if (typeof window.toast === 'function') window.toast(msg, kind);
  }

  function looksLikePersonName(s) {
    var t = String(s || '').trim();
    if (!t || t.length < 5 || !/[ա-ֆ]/.test(t)) return false;
    if (/^(գնդապետ|փոխգնդապետ|մայոր|կապիտան|լեյտենանտ|սերժանտ|ենթասպա|ավագ)/i.test(t)) return false;
    return t.split(/\s+/).length >= 2;
  }

  function personName(row) {
    var n = String(row && row.name || '').trim();
    if (n) return n;
    var r = String(row && row.rank || '').trim();
    return looksLikePersonName(r) ? r : '';
  }

  function displayRank(row) {
    var r = String(row && row.rank || '').trim();
    return looksLikePersonName(r) && !String(row.name || '').trim() ? '' : r;
  }

  function cellVal(row, key) {
    if (!row) return '';
    if (key === 'name') return personName(row);
    if (key === 'rank') return displayRank(row);
    return String(row[key] || '').trim();
  }

  function isVacant(row) {
    return !personName(row);
  }

  function ensureStore() {
    if (typeof db === 'undefined') return;
    if (!db.troopStructure || typeof db.troopStructure !== 'object') {
      db.troopStructure = { title: '', staff: { rows: [], columns: DEFAULT_COLS.slice() }, combat: {}, status: {} };
    }
    var ts = db.troopStructure;
    if (!ts.staff) ts.staff = { rows: [], columns: DEFAULT_COLS.slice() };
    if (!Array.isArray(ts.staff.rows)) ts.staff.rows = [];
    if (!Array.isArray(ts.staff.columns) || !ts.staff.columns.length) ts.staff.columns = DEFAULT_COLS.slice();
    if (!ts.combat) ts.combat = { title: '', subtitle: '', headerRows: [], flatHeaders: [], rows: [] };
    if (!ts.status) ts.status = { headerRows: [], flatHeaders: [], rows: [] };
    if (!ts._nameNorm) {
      normalizeImportedStaff(ts.staff.rows);
      ts._nameNorm = 1;
    }
  }

  function getColumns() {
    /* KM_TROOP_CLEAN_ARCHIVE_LAYOUT_V2: staff grid uses Unit Archive 25-col schema only */
    /* KM_PERF_HACHVARUM_V1: the column list is derived only from the static DEFAULT_COLS
       table, so it never changes at runtime — compute it once instead of re-filtering a
       46-entry array on every row of every render/scroll tick. */
    if (_colsCache) return _colsCache;
    ensureStore();
    var archKeys = {
      unit:1, position:1, seq:1, secret:1, vus:1, code:1, rankSlot:1, rank:1, name:1, /* KM_TROOP_VIRTUAL_SCROLL_V1 keep Կոչումը ըստ հաստիքի + Կոչում */
      posOrder:1, rankOrder:1, contract:1, special:1, contact:1, birth:1, zk:1, address:1,
      serviceYear:1, discipline:1, serviceTotal:1, lastAccept:1, idCard:1, blood:1, caseNo:1, vacation:1
    };
    var cols = DEFAULT_COLS.filter(function (c) { return !!archKeys[c.key]; });
    _colsCache = cols.length ? cols : DEFAULT_COLS.slice(0, 25);
    return _colsCache;
  }

  
  function dedupeTroopStaffRows(rows) {
    /* KM_TROOP_CLEAN_ARCHIVE_LAYOUT_V2 */
    rows = rows || [];
    function norm(s) { return String(s || '').replace(/\s+/g, ' ').trim().toLowerCase(); }
    function keyOf(r) {
      return norm(r.unit) + '|' + norm(r.position) + '|' + norm(r.code);
    }
    function score(r) {
      var n = 0;
      if (personName(r)) n += 10;
      Object.keys(r || {}).forEach(function (k) {
        if (k === 'type') return;
        if (String(r[k] || '').trim()) n += 1;
      });
      return n;
    }
    var best = Object.create(null);
    var meta = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (!r) continue;
      if (r.type === 'section') { meta.push({ kind: 'sec', r: r }); continue; }
      var k = keyOf(r);
      if (!k || k === '||') { meta.push({ kind: 'row', r: r }); continue; }
      if (best[k] == null) {
        best[k] = r;
        meta.push({ kind: 'dedupe', key: k });
      } else if (score(r) > score(best[k])) {
        best[k] = r;
      }
    }
    var out = [];
    for (var j = 0; j < meta.length; j++) {
      var m = meta[j];
      out.push(m.kind === 'dedupe' ? best[m.key] : m.r);
    }
    // drop empty section headers with no following data
    var cleaned = [];
    for (var x = 0; x < out.length; x++) {
      if (out[x].type !== 'section') { cleaned.push(out[x]); continue; }
      var has = false;
      for (var y = x + 1; y < out.length; y++) {
        if (out[y].type === 'section') break;
        has = true; break;
      }
      if (has) cleaned.push(out[x]);
    }
    return cleaned;
  }
  function ensureStaffDeduped() {
    /* KM_PERF_HACHVARUM_V1: dedupeTroopStaffRows() walks the whole roster and normalizes
       every cell — only worth doing again once the rows have actually changed, not on
       every scroll-triggered repaint. */
    if (!_dedupeDirty) return;
    ensureStore();
    var rows = (db.troopStructure.staff && db.troopStructure.staff.rows) || [];
    var next = dedupeTroopStaffRows(rows);
    if (next.length !== rows.length) {
      db.troopStructure.staff.rows = next;
      db.troopStructure.staff.columns = getColumns();
      _filteredDirty = true;
    }
    _dedupeDirty = false;
  }

  function normalizeImportedStaff(rows) {
    (rows || []).forEach(function (r) {
      if (!r || r.type === 'section') return;
      if (!String(r.name || '').trim() && looksLikePersonName(r.rank)) {
        r.name = String(r.rank).trim();
        r.rank = '';
      }
    });
  }

  function staffStats(scopeRows) {
    /* KM_TROOP_MANNING_UI_V3: percent = filled personnel / authorized posts */
    ensureStore();
    if (!scopeRows) {
      try {
        var uid = '';
        if (typeof window.kmGetOrgContext === 'function') {
          var ctx = window.kmGetOrgContext();
          uid = String((ctx && ctx.unitId) || '').trim();
        }
        if (!uid) uid = String(window._kmUnitArchiveActiveUnitId || window._kmArchiveForUnitId || '').trim();
        var man = null;
        if (uid && typeof window.kmUnitManningStats === 'function') man = window.kmUnitManningStats(uid);
        if ((!man || !man.authorized) && typeof window.kmManningStatsFromFormalSheet === 'function' && typeof db !== 'undefined' && db && db.unitFormalArchives) {
          var sheet = uid ? db.unitFormalArchives[uid] : null;
          if (!sheet) {
            var keys = Object.keys(db.unitFormalArchives || {});
            for (var ki = 0; ki < keys.length; ki++) {
              var sh = db.unitFormalArchives[keys[ki]];
              if (sh && Array.isArray(sh.rows) && sh.rows.length) { sheet = sh; break; }
            }
          }
          if (sheet) man = window.kmManningStatsFromFormalSheet(sheet);
        }
        if (man && man.authorized > 0) {
          var sections0 = 0;
          try {
            sections0 = ((db.troopStructure.staff && db.troopStructure.staff.rows) || []).filter(function (r) { return r && r.type === 'section'; }).length;
          } catch (eSec) {}
          return {
            sections: sections0,
            slots: man.authorized,
            filled: man.filled,
            vacant: Math.max(0, man.authorized - man.filled),
            pct: man.percent
          };
        }
      } catch (eMan) {}
    }
    var rows = scopeRows || dedupeTroopStaffRows((db.troopStructure.staff && db.troopStructure.staff.rows) || []);
    var sections = 0, slots = 0, filled = 0, vacant = 0;
    rows.forEach(function (r) {
      if (r.type === 'section') { sections++; return; }
      if (!String(r.position || '').trim() && !String(r.code || '').trim() && !personName(r)) return;
      slots++;
      if (personName(r)) filled++; else vacant++;
    });
    return { sections: sections, slots: slots, filled: filled, vacant: vacant, pct: slots ? Math.round((filled * 1000) / slots) / 10 : 0 };
  }

  function sectionStatsMap() {
    ensureStore();
    var map = {};
    var cur = '';
    (db.troopStructure.staff.rows || []).forEach(function (r) {
      if (r.type === 'section') { cur = String(r.unit || '').trim(); map[cur] = map[cur] || { slots: 0, filled: 0, vacant: 0 }; return; }
      if (!cur) return;
      if (!String(r.position || '').trim() && !personName(r)) return;
      map[cur].slots++;
      if (personName(r)) map[cur].filled++; else map[cur].vacant++;
    });
    return map;
  }

  function sectionList() {
    ensureStore();
    return (db.troopStructure.staff.rows || []).filter(function (r) { return r.type === 'section'; })
      .map(function (r) { return String(r.unit || '').trim(); }).filter(Boolean);
  }

  function colFilterActive(key) {
    var f = colFilters[key];
    return f && ((f.pick && Object.keys(f.pick).length) || f.sort);
  }

  function activeFilterCount() {
    return Object.keys(colFilters).filter(colFilterActive).length;
  }

  function uniqueValuesForCol(key) {
    if (_uniqCache[key]) return _uniqCache[key];
    ensureStore();
    var set = {};
    (db.troopStructure.staff.rows || []).forEach(function (r) {
      if (r.type === 'section') return;
      var v = cellVal(r, key);
      if (v) set[v] = (set[v] || 0) + 1;
      else set['(դատարկ)'] = (set['(դատարկ)'] || 0) + 1;
    });
    var arr = Object.keys(set).sort(function (a, b) { return a.localeCompare(b, 'hy'); });
    _uniqCache[key] = arr;
    return arr;
  }

  function invalidateUniqCache() {
    _uniqCache = {};
  }

  function filteredStaffRows() {
    /* KM_PERF_HACHVARUM_V1: this used to re-scan+re-sort the entire roster (search text,
       every column filter, cellVal() lookups) on every native scroll event. Cache the
       result and only rebuild it when search/filters/jump/data actually change — scroll
       repaint then just re-slices the cached array. */
    if (!_filteredDirty && _filteredCache) return _filteredCache;
    ensureStore();
    var rows = db.troopStructure.staff.rows || [];
    var q = String(filterSearch || '').trim().toLowerCase();
    var out = [];
    var includeFromJump = !jumpSection;

    rows.forEach(function (r, idx) {
      if (r.type === 'section') {
        if (jumpSection) includeFromJump = (String(r.unit || '').trim() === jumpSection);
        if (jumpSection && !includeFromJump) return;
        out.push({ row: r, idx: idx });
        return;
      }
      if (jumpSection && !includeFromJump) return;
      if (vacantOnly && !isVacant(r)) return;
      if (q) {
        var hay = getColumns().map(function (c) { return cellVal(r, c.key); }).join(' ').toLowerCase();
        if (hay.indexOf(q) < 0) return;
      }
      var cols = getColumns();
      for (var ci = 0; ci < cols.length; ci++) {
        var ck = cols[ci].key;
        var cf = colFilters[ck];
        if (!cf || !cf.pick || !Object.keys(cf.pick).length) continue;
        var val = cellVal(r, ck) || '(դատարկ)';
        if (!cf.pick[val]) return;
      }
      out.push({ row: r, idx: idx });
    });

    var sortKey = null;
    var sortDir = null;
    Object.keys(colFilters).forEach(function (k) {
      if (colFilters[k] && colFilters[k].sort) { sortKey = k; sortDir = colFilters[k].sort; }
    });
    if (sortKey) {
      out.sort(function (a, b) {
        if (a.row.type === 'section' && b.row.type !== 'section') return -1;
        if (b.row.type === 'section' && a.row.type !== 'section') return 1;
        if (a.row.type === 'section' && b.row.type === 'section') return 0;
        var va = cellVal(a.row, sortKey);
        var vb = cellVal(b.row, sortKey);
        var cmp = va.localeCompare(vb, 'hy', { numeric: true });
        return sortDir === 'desc' ? -cmp : cmp;
      });
    }

    if (q || vacantOnly || activeFilterCount()) {
      var cleaned = [];
      for (var i = 0; i < out.length; i++) {
        var cur = out[i];
        if (cur.row.type !== 'section') { cleaned.push(cur); continue; }
        var hasChild = false;
        for (var j = i + 1; j < out.length; j++) {
          if (out[j].row.type === 'section') break;
          hasChild = true; break;
        }
        if (hasChild) cleaned.push(cur);
      }
      _filteredCache = cleaned;
      _filteredDirty = false;
      return _filteredCache;
    }
    _filteredCache = out;
    _filteredDirty = false;
    return _filteredCache;
  }

  function injectCss() {
    var old = document.getElementById('km-troop-css');
    if (old) old.remove();
    var s = document.createElement('style');
    s.id = 'km-troop-css';
    /* KM_TROOP_ARCHIVE_LOOK_V1 — Unit Archive visual schema */
    s.textContent =
      '.kmTroopCard.kmUtShell,.kmTroopCard{background:#fff;border:1px solid #d0d7e2;border-radius:12px;padding:14px 16px}' +
      '.kmTroopHead{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;margin:0 0 12px;align-items:flex-start}' +
      '.kmTroopHead h3{margin:0 0 4px;font-size:18px;color:#1a2433;font-weight:700}' +
      '.kmTroopSub{margin:0;font-size:12px;color:#5b6b7c;line-height:1.45}' +
      '.kmTroopStats{display:flex;flex-wrap:wrap;gap:8px}' +
      '.kmTroopStat{background:#eef6f1;border:1px solid #cfe3d7;border-radius:10px;padding:8px 12px;min-width:72px;text-align:center}' +
      '.kmTroopStat b{display:block;font-size:16px;color:#1a2433}.kmTroopStat span{font-size:11px;color:#5b6b7c}' +
      '.kmTroopStat.ok b{color:#16a34a}.kmTroopStat.warn b{color:#b45309}' +
      '.kmTroopTools,.kmTroopFilter,.kmTroopPager{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 10px}' +
      '.kmTroopTools button,.kmTroopPager button{border:1px solid #d0d7e2;background:#f8fafc;border-radius:8px;padding:7px 12px;cursor:pointer;color:#1a2433;font-weight:600}' +
      '.kmTroopTools .primary,.kmTroopTools button.primary{background:#2563eb;color:#fff;border-color:#2563eb;font-weight:700}' +
      '.kmTroopTabs{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}' +
      '.kmTroopTabs button{padding:8px 14px;border-radius:9px;border:1px solid #d0d7e2;background:#f0f4f9;color:#1a2433;font-weight:700;cursor:pointer}' +
      '.kmTroopTabs button.active{background:#2563eb;color:#fff;border-color:#2563eb}' +
      '.kmTroopLayout{display:grid;grid-template-columns:1fr;gap:0;min-height:0}' +
      '.kmTroopTree{display:none!important}' +
      '.kmTroopMainPane{min-width:0}' +
      '/* KM_TROOP_VIRTUAL_SCROLL_V1_CSS */.kmTroopGridWrap{overflow:auto;height:calc(100vh - 280px);border:1px solid #d0d7e2;border-radius:10px;background:#fff;max-width:100%;-webkit-overflow-scrolling:touch}' +
      '.kmTroopGrid{border-collapse:collapse;table-layout:fixed;width:max-content;min-width:100%;font-size:13px}' +
      '.kmTroopGrid th,.kmTroopGrid td{border:1px solid #d0d7e2;padding:0;vertical-align:middle;height:38px}' +
      '.kmTroopGrid thead th{position:sticky;top:0;background:#e8eef6;z-index:3;font-size:12px;font-weight:700;color:#1a2433;padding:10px 12px;text-align:left;white-space:normal;line-height:1.25;vertical-align:bottom}' +
      '.kmTroopThInner{display:flex;align-items:center;gap:6px;max-width:100%}' +
      '.kmTroopThLabel{overflow:hidden;text-overflow:ellipsis;flex:1;font-weight:700}' +
      '.kmTroopThLetter{color:#5b6b7c;font-size:10px;font-weight:600}' +
      '.kmTroopFilterBtn{border:1px solid #d0d7e2;background:#fff;border-radius:4px;width:22px;height:22px;padding:0;cursor:pointer;font-size:10px;line-height:1;flex-shrink:0;color:#1a2433}' +
      '.kmTroopFilterBtn:hover{background:#f0f4f9}' +
      '.kmTroopFilterBtn.active{background:#2563eb;color:#fff;border-color:#2563eb}' +
      '.kmTroopGrid td{background:#ffffff}' +
      '.kmTroopGrid tr:nth-child(even) td{background:#f0f4f9}' +
      '.kmTroopGrid tr.kmTroopSection td{padding:8px 14px;border:1px solid #e0c48a;background:#fff4e0!important;color:#b45309;font-weight:700;letter-spacing:.03em;text-transform:uppercase;pointer-events:none;user-select:none}' +
      '.kmTroopGrid tr.kmTroopVacant td{background:#fffbeb}' +
      '.kmTroopGrid tr.kmTroopRow{cursor:pointer}.kmTroopGrid tr.kmTroopRow:hover td{background:#eef6f1}' +
      '.kmTroopGrid tr.kmTroopSel td{box-shadow:inset 0 0 0 2px #2563eb}' +
      '.kmTroopGrid input,.kmTroopDetail input{width:100%;min-width:100%;height:36px;box-sizing:border-box;border:0;border-radius:0;padding:6px 12px;font:inherit;background:transparent;color:#1a2433;white-space:nowrap}' +
      '.kmTroopGrid td.kmTroopEditTd{padding:0;background:inherit}' +
      '.kmTroopGrid td.kmWrap{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:none}' +
      '.kmTroopBadge{display:inline-block;padding:2px 7px;border-radius:999px;font-size:10px;font-weight:800}' +
      '.kmTroopBadge.ok{background:#dcfce7;color:#166534}.kmTroopBadge.warn{background:#fef3c7;color:#92400e}' +
      '.kmTroopFilterPop{position:fixed;z-index:2000100;background:#fff;border:1px solid #d0d7e2;border-radius:10px;box-shadow:0 12px 32px rgba(26,36,51,.16);width:min(300px,calc(100vw - 24px));max-height:min(420px,70vh);display:flex;flex-direction:column}' +
      '.kmTroopFilterPopHead{padding:10px 12px;border-bottom:1px solid #d0d7e2;font-weight:700;font-size:13px;color:#1a2433}' +
      '.kmTroopFilterPopTools{padding:8px 12px;border-bottom:1px solid #d0d7e2;display:flex;gap:6px;flex-wrap:wrap}' +
      '.kmTroopFilterPopTools button{padding:4px 8px;font-size:11px;border:1px solid #d0d7e2;border-radius:6px;background:#f0f4f9;cursor:pointer}' +
      '.kmTroopFilterPopList{padding:8px 12px;overflow:auto;flex:1}' +
      '.kmTroopFilterPopList label{display:flex;align-items:flex-start;gap:6px;padding:4px 0;font-size:12px;cursor:pointer}' +
      '.kmTroopFilterPopFoot{padding:8px 12px;border-top:1px solid #d0d7e2;display:flex;gap:8px;justify-content:flex-end}' +
      '.kmTroopChip{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:999px;background:#e8eef6;font-size:11px;font-weight:700;color:#1a2433}' +
      '.kmTroopChip button{border:0;background:transparent;cursor:pointer;font-weight:800;color:#1a2433}' +
      '.kmTroopMeta{margin:0;font-size:12px;color:#5b6b7c}' +
      '.kmTroopDetail{margin-top:10px;border:1px solid #d0d7e2;border-radius:10px;background:#f8fafc;padding:12px}' +
      '.kmTroopDetailGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px}' +
      '.kmTroopDetailItem label{display:block;font-size:10px;font-weight:800;color:#5b6b7c;text-transform:uppercase;margin-bottom:2px}' +
      '.kmTroopDetailItem div{font-size:13px;word-break:break-word;line-height:1.35}' +
      '.kmTroopEmpty{padding:24px;text-align:center;color:#5b6b7c}' +
      '.kmTroopSectionJump{display:none!important}' +
      '.kmTroopSectionJump button{border:1px solid #d0d7e2;background:#fff4e0;color:#b45309;border-radius:8px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;text-transform:uppercase}' +
      '.kmTroopSectionJump button.active{background:#b45309;color:#fff;border-color:#b45309}' +
      'body.km-troop-fs{overflow:hidden!important}' +
      'body.km-troop-fs .app,body.km-troop-fs .side,body.km-troop-fs .kmWinChrome,body.km-troop-fs .main,body.km-troop-fs #content{visibility:hidden!important;pointer-events:none!important}' +
      '#kmTroopFS.kmTroopFS{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;z-index:2000000!important;margin:0!important;box-sizing:border-box!important;background:#f4f6fa!important;display:flex!important;flex-direction:column!important;padding:8px 10px!important;overflow:hidden!important}' +
      '#kmTroopFS .kmTroopCard{flex:1 1 auto!important;min-height:0!important;display:flex!important;flex-direction:column!important;margin:0!important;border-radius:12px!important;overflow:hidden!important;background:#fff!important;padding:8px 10px!important;border:1px solid #d0d7e2!important}' +
      '/* KM_TROOP_FS_UI_SCROLL_V2: hide duplicate inner toolbar */#kmTroopFS .kmTroopTools{display:none!important}' +
      '#kmTroopFS #kmTroopBody{flex:1 1 auto!important;min-height:0!important;min-width:0!important;overflow:hidden!important;display:flex!important;flex-direction:column!important}' +
      '#kmTroopFS .kmTroopLayout,#kmTroopFS .kmTroopMainPane{flex:1 1 auto!important;min-height:0!important;min-width:0!important;height:auto!important;display:flex!important;flex-direction:column!important;overflow:hidden!important}' +
      '#kmTroopFS .kmTroopGridWrap{flex:1 1 auto!important;min-height:0!important;min-width:0!important;width:100%!important;max-width:100%!important;overflow-x:auto!important;overflow-y:auto!important;-webkit-overflow-scrolling:touch!important;overscroll-behavior:contain}' +
      '#kmTroopFS .kmTroopFSBar{/* KM_TROOP_FS_UI_SCROLL_V2_BAR */display:flex!important;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;margin:0 0 8px;padding:10px 14px;background:#1a2433;color:#fff;border-radius:10px;flex:0 0 auto}' +
      '#kmTroopFS .kmTroopFSBar button{border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.12);color:#fff;border-radius:8px;padding:7px 12px;cursor:pointer;font-weight:600}' +
      '#kmTroopFS .kmTroopFSBar .primary{background:#2563eb;color:#fff;border-color:#2563eb;font-weight:700}';

    document.head.appendChild(s);
  }

  function layoutTroopFullscreenScroll() {
    /* KM_TROOP_FS_UI_SCROLL_V2_LAYOUT / KM_ARCHIVE_STRICT_SOURCE_V3_TROOP */
    var shell = document.getElementById('kmTroopFS');
    if (!shell) return;
    var wrap = shell.querySelector('.kmTroopGridWrap') || shell.querySelector('#kmTroopVirtScroll');
    if (!wrap) return;
    var tree = shell.querySelector('.kmTroopTree');
    var rect = wrap.getBoundingClientRect();
    var bottomPad = 12;
    var h = Math.max(160, Math.floor(window.innerHeight - rect.top - bottomPad));
    wrap.style.setProperty('height', h + 'px', 'important');
    wrap.style.setProperty('max-height', h + 'px', 'important');
    wrap.style.setProperty('overflow-x', 'auto', 'important');
    wrap.style.setProperty('overflow-y', 'auto', 'important');
    wrap.style.setProperty('min-width', '0', 'important');
    wrap.style.setProperty('width', '100%', 'important');
    if (tree && tree.style) {
      tree.style.setProperty('height', h + 'px', 'important');
      tree.style.setProperty('max-height', h + 'px', 'important');
      tree.style.setProperty('overflow', 'auto', 'important');
    }
    try {
      var body = shell.querySelector('#kmTroopVirtBody');
      if (body) paintTroopVirtual(wrap, body);
    } catch (ePaint) {}
  }

  function pageSize() {
    if (editMode && canEdit() && !fullScreen) return 20;
    return fullScreen ? 80 : PAGE_SIZE;
  }

  function renderTree() {
    var secs = sectionList();
    var smap = sectionStatsMap();
    var tq = String(treeQuery || '').trim().toLowerCase();
    var filtered = tq ? secs.filter(function (s) { return s.toLowerCase().indexOf(tq) >= 0; }) : secs;
    if (!secs.length) return '<div class="kmTroopTree"><h4>Կառուցվածք</h4><p class="kmTroopMeta">Ընտրեք զորամաս · տվյալները՝ Զորամասի Արխիվից (KM_UNIT_ARCHIVE_UNIFIED_SOURCE_V1)</p></div>';
    return '<div class="kmTroopTree"><h4>Բաժիններ (' + secs.length + ')</h4>' +
      '<input class="kmTroopTreeSearch" type="search" placeholder="Փնտրել բաժին…" value="' + escAttr(treeQuery) + '" onkeydown="if(event.key===\'Enter\')kmTroopTreeFilter(this.value)">' +
      '<button type="button" class="kmTroopTreeBtn' + (!jumpSection ? ' active' : '') + '" onclick="kmTroopJumpSection(\'\')">Բոլորը</button>' +
      filtered.map(function (s) {
        var st = smap[s] || { slots: 0, filled: 0, vacant: 0 };
        return '<button type="button" class="kmTroopTreeBtn' + (jumpSection === s ? ' active' : '') + '" onclick="kmTroopJumpSection(\'' + jsStr(s) + '\')">' +
          esc(s) + '<span class="meta">' + st.filled + '/' + st.slots + ' · ' + st.vacant + ' թափուր</span></button>';
      }).join('') + '</div>';
  }

  function renderFilterPopup() {
    if (!openFilterKey) return '';
    var cols = getColumns();
    var col = cols.find(function (c) { return c.key === openFilterKey; });
    if (!col) return '';
    var uniq = uniqueValuesForCol(openFilterKey);
    var q = String(filterPopupSearch || '').trim().toLowerCase();
    var shown = q ? uniq.filter(function (v) { return v.toLowerCase().indexOf(q) >= 0; }) : uniq;
    if (shown.length > 150) shown = shown.slice(0, 150);
    var cf = colFilters[openFilterKey] || { pick: {}, sort: null };
    var checks = shown.map(function (v) {
      var checked = !cf.pick || !Object.keys(cf.pick).length || cf.pick[v];
      return '<label><input type="checkbox" data-fval="' + escAttr(v) + '"' + (checked ? ' checked' : '') + ' onchange="kmTroopFilterToggleVal(\'' + jsStr(openFilterKey) + '\',this)"> ' + esc(v) + '</label>';
    }).join('');
    return '<div class="kmTroopFilterPop" id="kmTroopFilterPop" style="left:50%;top:50%;transform:translate(-50%,-50%)">' +
      '<div class="kmTroopFilterPopHead">' + esc(col.letter) + ' · ' + esc(col.label) + '</div>' +
      '<div class="kmTroopFilterPopTools">' +
      '<button type="button" onclick="kmTroopFilterSort(\'' + jsStr(openFilterKey) + '\',\'asc\')">↑ A→Z</button>' +
      '<button type="button" onclick="kmTroopFilterSort(\'' + jsStr(openFilterKey) + '\',\'desc\')">↓ Z→A</button>' +
      '<button type="button" onclick="kmTroopFilterSelectAll(\'' + jsStr(openFilterKey) + '\')">Բոլորը</button>' +
      '<button type="button" onclick="kmTroopFilterClearCol(\'' + jsStr(openFilterKey) + '\')">Մաքրել</button>' +
      '</div>' +
      '<div style="padding:6px 12px"><input type="search" placeholder="Փնտրել արժեք…" value="' + escAttr(filterPopupSearch) + '" style="width:100%;padding:6px;border:1px solid #c8d0d8;border-radius:6px" oninput="kmTroopFilterPopupSearch(this.value)"></div>' +
      '<div class="kmTroopFilterPopList">' + (checks || '<p class="muted">Արժեք չկա</p>') +
      (uniq.length > 150 ? '<p class="kmTroopMeta">Ցուցադրվում է առաջին 150-ը · ' + uniq.length + ' ընդամենը</p>' : '') +
      '</div>' +
      '<div class="kmTroopFilterPopFoot">' +
      '<button type="button" onclick="kmTroopFilterClose()">Փակել</button>' +
      '<button type="button" class="primary" onclick="kmTroopFilterApply()">Կիրառել</button>' +
      '</div></div>';
  }

    function renderSectionJump() {
    var secs = sectionList();
    if (!secs.length) return '';
    var html = '<div class="kmTroopSectionJump">';
    html += '<button type="button" class="' + (!jumpSection ? 'active' : '') + '" data-km-jump="">Բոլորը</button>';
    secs.forEach(function (s) {
      html += '<button type="button" class="' + (jumpSection === s ? 'active' : '') + '" data-km-jump="' + escAttr(s) + '">' + esc(s) + '</button>';
    });
    html += '</div>';
    return html;
  }

  
  function flushTroopVisibleEdits(bodyEl) {
    /* KM_TROOP_VIRTUAL_SCROLL_V1 */
    if (!editMode || !canEdit() || !bodyEl) return;
    ensureStore();
    var changed = false;
    bodyEl.querySelectorAll('input[data-k][data-i]').forEach(function (inp) {
      var i = Number(inp.getAttribute('data-i'));
      var k = inp.getAttribute('data-k');
      var row = db.troopStructure.staff.rows[i];
      if (!row || row.type === 'section') return;
      if (row[k] === inp.value) return;
      row[k] = inp.value;
      row._shtatDirty = true;
      changed = true;
    });
    /* KM_PERF_HACHVARUM_V1: only invalidate the filtered/sorted cache when a visible cell
       actually changed value — plain scrolling with no pending edits stays on the cache. */
    if (changed) invalidateFilteredCache();
  }

  function paintTroopVirtual(scrollEl, bodyEl) {
    /* KM_TROOP_VIRTUAL_SCROLL_V1 — same engine as Զորամասի Արխիվ paintVirtual */
    if (!scrollEl || !bodyEl) return;
    flushTroopVisibleEdits(bodyEl);
    ensureStaffDeduped();
    var cols = getColumns();
    var list = filteredStaffRows();
    var total = list.length;
    var colN = cols.length || 1;
    var WIDTH = {unit:200,position:260,seq:110,secret:160,vus:140,code:120,rankSlot:180,rank:170,name:280,posOrder:260,rankOrder:220,contract:200,special:170,contact:200,birth:150,zk:170,address:300,serviceYear:250,discipline:140,serviceTotal:220,lastAccept:170,idCard:220,blood:130,caseNo:170,vacation:140};
    if (!total) {
      bodyEl.innerHTML = '<tr><td colspan="' + colN + '" style="padding:24px;text-align:center;color:#5b6b7c">Տվյալ չկա</td></tr>';
      return;
    }
    var viewH = scrollEl.clientHeight || 400;
    var start = Math.max(0, Math.floor(scrollEl.scrollTop / TROOP_ROW_H) - TROOP_OVERSCAN);
    var end = Math.min(total, Math.ceil((scrollEl.scrollTop + viewH) / TROOP_ROW_H) + TROOP_OVERSCAN);
    var parts = [];
    parts.push('<tr style="height:' + (start * TROOP_ROW_H) + 'px"><td colspan="' + colN + '" style="padding:0;border:0"></td></tr>');
    var rowEdit = editMode && canEdit();
    for (var vi = start; vi < end; vi++) {
      var item = list[vi];
      var row = item.row;
      var realIdx = item.idx;
      if (row.type === 'section') {
        parts.push('<tr class="kmTroopSection" data-rtype="section" data-i="' + realIdx + '" style="height:' + TROOP_ROW_H + 'px">' +
          '<td colspan="' + colN + '" style="padding:8px 14px;border:1px solid #e0c48a;background:#fff4e0;font-weight:700;letter-spacing:.03em;text-transform:uppercase">' +
          esc(row.unit || 'ԲԱԺԻՆ') + '</td></tr>');
        continue;
      }
      var vacant = isVacant(row);
      var bg = vacant ? '#fffbeb' : (vi % 2 ? '#f0f4f9' : '#ffffff');
      var tds = cols.map(function (c) {
        var v = cellVal(row, c.key);
        var w = WIDTH[c.key] || c.w || 120;
        var st = 'width:' + w + 'px;min-width:' + w + 'px;max-width:none;padding:0;border:1px solid #d0d7e2;background:' + bg + ';height:' + TROOP_ROW_H + 'px';
        if (rowEdit) {
          var raw = String(row[c.key] != null ? row[c.key] : '');
          return '<td class="kmTroopEditTd" style="' + st + '" title="' + escAttr(v) + '">' +
            '<input data-k="' + c.key + '" data-i="' + realIdx + '" data-km-allow-edit="1" value="' + escAttr(raw) + '" ' +
            'style="width:100%;min-width:100%;height:' + (TROOP_ROW_H - 2) + 'px;border:0;padding:6px 12px;background:transparent;font:inherit;box-sizing:border-box;white-space:nowrap" />' +
            '</td>';
        }
        return '<td style="' + st + ';padding:6px 12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="' + escAttr(v) + '">' + esc(v) + '</td>';
      }).join('');
      parts.push('<tr class="kmTroopRow' + (vacant ? ' kmTroopVacant' : '') + '" data-i="' + realIdx + '" data-rtype="data" style="height:' + TROOP_ROW_H + 'px">' + tds + '</tr>');
    }
    var after = total - end;
    if (after > 0) {
      parts.push('<tr style="height:' + (after * TROOP_ROW_H) + 'px"><td colspan="' + colN + '" style="padding:0;border:0"></td></tr>');
    }
    bodyEl.innerHTML = parts.join('');
  }

  function bindTroopVirtualScroll(root) {
    /* KM_TROOP_VIRTUAL_SCROLL_V1 */
    if (!root) return;
    var wrap = root.querySelector('.kmTroopGridWrap');
    var body = root.querySelector('#kmTroopVirtBody');
    if (!wrap || !body) return;
    /* KM_PERF_HACHVARUM_V1: 'scroll' can fire many times per animation frame (trackpad /
       fast wheel scroll). Coalesce those into a single paintTroopVirtual() per frame
       instead of rebuilding the visible rows on every raw scroll event. */
    var rafPending = false;
    var onScroll = function () {
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(function () {
        rafPending = false;
        paintTroopVirtual(wrap, body);
      });
    };
    if (wrap._kmTroopScrollHandler) {
      try { wrap.removeEventListener('scroll', wrap._kmTroopScrollHandler); } catch (eRm) {}
    }
    wrap._kmTroopScrollHandler = onScroll;
    wrap.addEventListener('scroll', onScroll, { passive: true });
    requestAnimationFrame(function () { requestAnimationFrame(function () { paintTroopVirtual(wrap, body); }); });
  }

  function renderStaffTable() {
    /* KM_TROOP_VIRTUAL_SCROLL_V1 */
    ensureStaffDeduped();
    var cols = getColumns();
    var list = filteredStaffRows();
    var total = list.length;
    var WIDTH = {unit:200,position:260,seq:110,secret:160,vus:140,code:120,rankSlot:180,rank:170,name:280,posOrder:260,rankOrder:220,contract:200,special:170,contact:200,birth:150,zk:170,address:300,serviceYear:250,discipline:140,serviceTotal:220,lastAccept:170,idCard:220,blood:130,caseNo:170,vacation:140};

    if (!total) {
      return '<div class="kmTroopGridWrap"><div class="kmTroopEmpty"><b>Տվյալ չկա</b><br>Բացեք Զորամասի Արխիվը կամ ընտրեք զորամաս</div></div>';
    }

    var head = cols.map(function (c) {
      var active = colFilterActive(c.key);
      var w = WIDTH[c.key] || c.w || 120;
      return '<th style="width:' + w + 'px;min-width:' + w + 'px;max-width:none"><div class="kmTroopThInner">' +
        '<span class="kmTroopThLabel" title="' + escAttr(c.label) + '">' + esc(c.label) + '</span>' +
        '<button type="button" class="kmTroopFilterBtn' + (active ? ' active' : '') + '" title="Ֆիլտր" onclick="event.stopPropagation();kmTroopFilterOpen(\'' + jsStr(c.key) + '\')">▾</button>' +
        '</div></th>';
    }).join('');

    return '<div class="kmTroopMeta" style="margin:0 0 8px;font-size:12px">Virtual scroll · ' + cols.length + ' սյուն · ' + total + ' տող' +
      (vacantOnly ? ' · միայն թափուր' : '') +
      (filterSearch ? (' · որոնում՝ ' + esc(filterSearch)) : '') +
      '</div>' +
      '<div class="kmTroopGridWrap" id="kmTroopVirtScroll">' +
      '<table class="kmTroopGrid"><thead><tr>' + head + '</tr></thead>' +
      '<tbody id="kmTroopVirtBody"></tbody></table></div>' +
      renderFilterPopup();
  }

  function renderDetail(idx) {
    ensureStore();
    var row = db.troopStructure.staff.rows[idx];
    if (!row || row.type === 'section') return '';
    var cols = getColumns();
    var editable = editMode && canEdit();
    var items = cols.map(function (c) {
      var v = cellVal(row, c.key);
      var raw = String(row[c.key] != null ? row[c.key] : '');
      if (editable) {
        return '<div class="kmTroopDetailItem"><label>' + esc(c.letter) + ' · ' + esc(c.label) + '</label>' +
          '<input data-k="' + c.key + '" data-i="' + idx + '" data-km-allow-edit="1" value="' + escAttr(raw) + '"></div>';
      }
      if (!v && c.key !== 'name') return '';
      return '<div class="kmTroopDetailItem"><label>' + esc(c.letter) + ' · ' + esc(c.label) + '</label><div>' + (v ? esc(v) : '—') + '</div></div>';
    }).join('');
    return '<div class="kmTroopDetail" id="kmTroopDetail"><h4>' + esc(row.position || 'Հաստիք') +
      (editable ? ' · խմբագրում' : '') +
      ' <button type="button" style="float:right" onclick="kmTroopSelectRow(-1)">Փակել</button></h4>' +
      '<div class="kmTroopDetailGrid">' + items + '</div>' +
      (editable ? '<div style="margin-top:10px"><button type="button" class="primary" onclick="kmTroopSave()">Պահպանել</button></div>' : '') +
      '</div>';
  }

  function renderMultiHeaderGrid(sheet) {
    var hdrRows = sheet.headerRows || [];
    var flat = sheet.flatHeaders || [];
    var rows = sheet.rows || [];
    if (!flat.length && rows.length && rows[0].values) {
      flat = rows[0].values.map(function (_, i) { return { letter: String(i + 1), label: 'Սյուն ' + (i + 1), index: i }; });
    }
    var headHtml = '';
    if (hdrRows.length >= 2) {
      headHtml += '<tr>' + hdrRows[0].map(function (h) {
        return '<th colspan="' + (h.span || 1) + '">' + esc(h.text) + '</th>';
      }).join('') + '</tr>';
      headHtml += '<tr>' + flat.map(function (h) {
        return '<th title="' + escAttr(h.letter) + '">' + esc(h.label || h.letter) + '</th>';
      }).join('') + '</tr>';
    } else {
      headHtml = '<tr>' + flat.map(function (h) {
        return '<th>' + esc(h.label || h.letter) + '</th>';
      }).join('') + '</tr>';
    }
    var body = rows.map(function (r) {
      var vals = r.values || [];
      return '<tr>' + vals.map(function (v) {
        return '<td class="kmWrap" title="' + escAttr(v) + '">' + esc(v) + '</td>';
      }).join('') + '</tr>';
    }).join('') || '<tr><td class="muted">Դատարկ</td></tr>';
    return '<div class="kmTroopGridWrap"><table class="kmTroopGrid"><thead>' + headHtml + '</thead><tbody>' + body + '</tbody></table></div>';
  }

  function activeFiltersHtml() {
    var chips = [];
    if (jumpSection) chips.push('<span class="kmTroopChip">Բաժին՝ ' + esc(jumpSection) + ' <button type="button" onclick="kmTroopJumpSection(\'\')">×</button></span>');
    if (vacantOnly) chips.push('<span class="kmTroopChip">Միայն թափուր <button type="button" onclick="kmTroopVacantOnly(false)">×</button></span>');
    if (filterSearch) chips.push('<span class="kmTroopChip">Որոնում <button type="button" onclick="kmTroopSearch(\'\')">×</button></span>');
    getColumns().forEach(function (c) {
      if (!colFilterActive(c.key)) return;
      var cf = colFilters[c.key];
      var n = cf.pick ? Object.keys(cf.pick).length : 0;
      var label = cf.sort ? ('Տեսակավորում ' + (cf.sort === 'desc' ? '↓' : '↑')) : (n + ' արժեք');
      chips.push('<span class="kmTroopChip">' + esc(c.letter) + ': ' + esc(label) + ' <button type="button" onclick="kmTroopFilterClearCol(\'' + jsStr(c.key) + '\')">×</button></span>');
    });
    if (!chips.length) return '';
    return '<div class="kmTroopFilter">' + chips.join('') + '<button type="button" onclick="kmTroopClearFilters()">Մաքրել բոլորը</button></div>';
  }

  function bindSectionJump(root) {
    if (!root) return;
    var bar = root.querySelector('.kmTroopSectionJump');
    if (!bar || bar.__kmJumpBound) return;
    bar.__kmJumpBound = true;
    bar.addEventListener('click', function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest('[data-km-jump]') : null;
      if (!btn) return;
      var v = btn.getAttribute('data-km-jump');
      window.kmTroopJumpSection(v == null ? '' : v);
    });
  }
  function bindStaffGrid(root) {
    bindSectionJump(root);
    if (!root || !editMode || !canEdit()) return;
    var pane = root.querySelector('#kmTroopBody') || root;
    if (!pane.__kmTroopEditBound) {
      pane.__kmTroopEditBound = true;
      pane.addEventListener('change', onTroopCell);
      pane.addEventListener('input', onTroopCell);
    }
    pane.querySelectorAll('input[data-k]').forEach(function (inp) {
      inp.readOnly = false;
      inp.disabled = false;
      inp.removeAttribute('readonly');
      inp.removeAttribute('disabled');
    });
  }
  function onTroopCell(ev) {
    /* KM_TROOP_FORMAL_BIDI_SYNC_V1_TROOP live → archive */
    var inp = ev.target;
    if (!inp || !inp.getAttribute || !inp.getAttribute('data-k')) return;
    ensureStore();
    var i = Number(inp.getAttribute('data-i'));
    var k = inp.getAttribute('data-k');
    var row = db.troopStructure.staff.rows[i];
    if (row) {
      row[k] = inp.value;
      row._shtatDirty = true;
    }
    invalidateUniqCache();
    invalidateFilteredCache();
    if (window._kmTroopLiveSyncT) clearTimeout(window._kmTroopLiveSyncT);
    window._kmTroopLiveSyncT = setTimeout(function () {
      window._kmTroopLiveSyncT = 0;
      try { if (typeof window.kmSyncTroopStaffToArchive === 'function') window.kmSyncTroopStaffToArchive(); } catch (eS) {}
    }, 120);
  }

  function renderBody() {
    ensureStore();
    if ((typeof window.kmUnitHasStaffSource === 'function' ? !window.kmUnitHasStaffSource() : (typeof window.kmUnitHasExcelArchive === 'function' && !window.kmUnitHasExcelArchive()))) {
      return typeof window.kmArchiveRequiredBanner === 'function'
        ? window.kmArchiveRequiredBanner()
        : '<div class="card"><b>Այս զորամասի արխիվում տվյալ չկա</b></div>';
    }
    var ts = db.troopStructure;
    if (activeTab === 'staff' || activeTab === 'vacant') {
      /* KM_TROOP_CLEAN_ARCHIVE_LAYOUT_V2 */
      /* KM_TROOP_VACANT_TAB_V1: vacant tab = same staff grid, forced vacant-only */
      if (activeTab === 'vacant') vacantOnly = true;
      ensureStaffDeduped();
      return '<div class="kmTroopMainPane">' + renderStaffTable() + '</div>';
    }
    if (activeTab === 'combat') {
      /* KM_TROOP_MANNING_UI_V3 */
      var combatRows = (ts.combat && ts.combat.rows) || [];
      if (!combatRows.length) {
        var _stC = staffStats();
        return '<div class="kmTroopEmpty"><b>Մարտ. քանակ</b><br>Այս բաժինը դեռ դատարկ է։ Շտատի համալրվածությունը՝ ' + _stC.filled + ' / ' + _stC.slots + ' (' + _stC.pct + '%).</div>';
      }
      return (ts.combat.title ? '<p class="kmTroopMeta"><b>' + esc(ts.combat.title) + '</b>' +
        (ts.combat.subtitle ? ' · ' + esc(ts.combat.subtitle) : '') + '</p>' : '') +
        renderMultiHeaderGrid(ts.combat);
    }
    var statusRows = (ts.status && ts.status.rows) || [];
    if (!statusRows.length) {
      return '<div class="kmTroopEmpty"><b>Վիճակ</b><br>Այս բաժինը դեռ դատարկ է։ Օգտագործեք Շտատ ներդիրը։</div>';
    }
    return '<p class="kmTroopMeta">Վիճակ</p>' + renderMultiHeaderGrid(ts.status);
  }

  window.kmTroopStructureTab = function (tab) {
    activeTab = String(tab || 'staff');
    openFilterKey = '';
    /* KM_TROOP_VACANT_TAB_V1 */
    if (activeTab === 'vacant') vacantOnly = true;
    else if (activeTab === 'staff') { /* keep checkbox state */ }
    else vacantOnly = false;
    invalidateFilteredCache();
    window.kmOpenTroopStructure(activeTab);
  };
  window.kmTroopJumpSection = function (s) {
    jumpSection = String(s || '');
    pageIndex = 0;
    selectedIdx = -1;
    invalidateFilteredCache();
    window.kmOpenTroopStructure('staff');
  };
  window.kmTroopPage = function (n) {
    pageIndex = Math.max(0, Number(n) || 0);
    selectedIdx = -1;
    window.kmOpenTroopStructure(activeTab);
  };
  window.kmTroopSearch = function (val) {
    filterSearch = String(val || '');
    pageIndex = 0;
    invalidateFilteredCache();
    window.kmOpenTroopStructure(activeTab);
  };
  window.kmTroopVacantOnly = function (on) {
    vacantOnly = !!on;
    pageIndex = 0;
    invalidateFilteredCache();
    window.kmOpenTroopStructure(activeTab);
  };
  window.kmTroopClearFilters = function () {
    filterSearch = '';
    vacantOnly = false;
    jumpSection = '';
    colFilters = {};
    pageIndex = 0;
    openFilterKey = '';
    invalidateFilteredCache();
    window.kmOpenTroopStructure('staff');
  };
  window.kmTroopTreeFilter = function (val) {
    treeQuery = String(val || '');
    window.kmOpenTroopStructure('staff');
  };
  window.kmTroopSelectRow = function (idx) {
    selectedIdx = Number(idx);
    if (editMode && canEdit()) return;
    window.kmOpenTroopStructure(activeTab);
  };
  window.kmTroopToggleEdit = function () {
    if (!canEdit()) {
      toastMsg('Դիտորդի իրավունք', 'error');
      return;
    }
    editMode = !editMode;
    window._kmTroopUserChoseView = !editMode;
    if (editMode && selectedIdx < 0) {
      var list = filteredStaffRows();
      for (var i = 0; i < list.length; i++) {
        if (list[i] && list[i].row && list[i].row.type !== 'section') {
          selectedIdx = list[i].idx;
          break;
        }
      }
    }
    window._kmTroopForcePaint = true;
    window.kmOpenTroopStructure(activeTab);
  };
  window.kmTroopFullscreen = function () {
    /* KM_TROOP_FS_EXIT_V1 */
    fullScreen = true;
    if (canEdit()) editMode = true;
    window._kmTroopForcePaint = true;
    try { document.body.classList.add('km-troop-fs'); } catch (e0) {}
    window.kmOpenTroopStructure(activeTab);
  };
  window.kmTroopExitFullscreen = function () {
    /* KM_TROOP_FS_EXIT_V1 / KM_ARCHIVE_STRICT_SOURCE_V3_TROOP exit */
    fullScreen = false;
    window._kmTroopForcePaint = true;
    try { document.body.classList.remove('km-troop-fs'); } catch (e1) {}
    try {
      document.querySelectorAll('#kmTroopFS').forEach(function (el) { el.remove(); });
    } catch (e2) {
      var oldFs = document.getElementById('kmTroopFS');
      if (oldFs) try { oldFs.remove(); } catch (e3) {}
    }
    try {
      document.body.style.removeProperty('overflow');
    } catch (e4) {}
    window.kmOpenTroopStructure(activeTab);
  };

  window.kmTroopFilterOpen = function (key) {
    openFilterKey = String(key || '');
    filterPopupSearch = '';
    if (!colFilters[openFilterKey]) colFilters[openFilterKey] = { pick: {}, sort: null };
    window.kmOpenTroopStructure(activeTab);
  };
  window.kmTroopFilterClose = function () {
    openFilterKey = '';
    var pop = document.getElementById('kmTroopFilterPop');
    if (pop) pop.remove();
  };
  window.kmTroopFilterApply = function () {
    openFilterKey = '';
    pageIndex = 0;
    window.kmOpenTroopStructure(activeTab);
  };
  window.kmTroopFilterPopupSearch = function (val) {
    filterPopupSearch = String(val || '');
    window.kmOpenTroopStructure(activeTab);
  };
  window.kmTroopFilterToggleVal = function (key, inp) {
    if (!colFilters[key]) colFilters[key] = { pick: {}, sort: null };
    var v = inp.getAttribute('data-fval');
    if (inp.checked) colFilters[key].pick[v] = true;
    else delete colFilters[key].pick[v];
    invalidateFilteredCache();
  };
  window.kmTroopFilterSelectAll = function (key) {
    colFilters[key] = { pick: {}, sort: colFilters[key] && colFilters[key].sort || null };
    uniqueValuesForCol(key).forEach(function (v) { colFilters[key].pick[v] = true; });
    invalidateFilteredCache();
    window.kmOpenTroopStructure(activeTab);
  };
  window.kmTroopFilterClearCol = function (key) {
    delete colFilters[key];
    if (openFilterKey === key) openFilterKey = '';
    pageIndex = 0;
    invalidateFilteredCache();
    window.kmOpenTroopStructure(activeTab);
  };
  window.kmTroopFilterSort = function (key, dir) {
    if (!colFilters[key]) colFilters[key] = { pick: {}, sort: null };
    colFilters[key].sort = dir;
    Object.keys(colFilters).forEach(function (k) {
      if (k !== key && colFilters[k]) colFilters[k].sort = null;
    });
    pageIndex = 0;
    openFilterKey = '';
    invalidateFilteredCache();
    window.kmOpenTroopStructure(activeTab);
  };

  window.kmTroopSave = async function (silent) {
    if (!canEdit()) { toastMsg('Դիտորդի իրավունք', 'error'); return; }
    ensureStore();
    db.troopStructure.updatedAt = new Date().toISOString();
    try {
      if (typeof window.kmSyncTroopStaffToArchive === 'function') window.kmSyncTroopStaffToArchive();
    } catch (eSync) {}
    if (typeof save === 'function') await save(!!silent);
    try {
      if (typeof window.kmFlushDirtyShtatExcel === 'function') await window.kmFlushDirtyShtatExcel();
    } catch (eFlush) {}
    if (!silent) toastMsg('Զորակազմի կառուցվածքը պահպանվել է', 'ok');
  };

  function staffToExport() {
    var cols = getColumns();
    var headers = cols.map(function (c) { return c.label; });
    var rows = [headers];
    (db.troopStructure.staff.rows || []).forEach(function (row) {
      if (row.type === 'section') {
        rows.push(cols.map(function (c, i) { return i === 0 ? row.unit : ''; }));
      } else {
        rows.push(cols.map(function (c) { return String(row[c.key] || ''); }));
      }
    });
    return rows;
  }

  function showImportOverlay(on) {
    var old = document.getElementById('kmTroopImportOverlay');
    if (old) old.remove();
    if (!on) return;
    var el = document.createElement('div');
    el.id = 'kmTroopImportOverlay';
    el.style.cssText = 'position:fixed;inset:0;z-index:20000;background:rgba(15,25,35,.55);display:flex;align-items:center;justify-content:center;';
    el.innerHTML = '<div class="card" style="max-width:360px;text-align:center"><h3>Բեռնվում է Զորամասի Արխիվը…</h3><p class="muted">Unit Archive · միակ աղբյուր</p></div>';
    document.body.appendChild(el);
  }

  window.kmApplyArchiveRowsToTroopStaff = function (rows, opts) {
    opts = opts || {};
    var isPerson = typeof window.kmLooksLikePersonName === 'function'
      ? window.kmLooksLikePersonName
      : function (s) { return /[Ա-Ֆա-ֆA-Za-z]/.test(String(s || '')); };
    rows = (rows || []).filter(function (r) {
      if (!r || r.type === 'section') return false;
      return String(r.position || '').trim() || String(r.sourceName || r.name || '').trim();
    });
    if (!rows.length) {
      if (opts.clearIfEmpty !== false) {
        try {
          ensureStore();
          if (db.troopStructure && db.troopStructure.staff) db.troopStructure.staff.rows = [];
          markStaffRowsChanged();
        } catch (eClr) {}
      }
      return { ok: false, slots: 0, cleared: true };
    }
    ensureStore();
    var byKey = Object.create(null);
    var existing = ((db.troopStructure.staff || {}).rows || []).filter(function (r) {
      return r && r.type !== 'section';
    });
    existing.forEach(function (r, idx) {
      var k = String(r.name || '').trim().toLowerCase() + '\t' + String(r.position || '').trim();
      if (k !== '\t') byKey[k] = r;
      byKey['#' + idx] = r;
    });
    var out = [];
    var lastUnit = '';
    var seq = 0;
    var seen = Object.create(null);
    var autoFilter = '';
    rows.forEach(function (r) {
      if (r.autoFilter && !autoFilter) autoFilter = String(r.autoFilter);
      var unit = String(r.unit || '').trim();
      var position = String(r.position || '').trim();
      var rawName = String(r.name || r.sourceName || '').trim();
      var name = isPerson(rawName) ? rawName : '';
      var code = String(r.code || '').trim();
      var vus = '';
      if (typeof window.kmSpecialtyFromArchiveRow === 'function') {
        vus = window.kmSpecialtyFromArchiveRow(r, code);
      } else {
        vus = String(r.vus || '').trim();
        if (code && vus === code) vus = '';
      }
      if (code && vus === code) vus = '';
      var fp = [unit, position, name, String(r.code || ''), String(r.excelRow || r.seq || '')].join('|').toLowerCase();
      if (seen[fp]) return;
      seen[fp] = 1;
      if (unit && unit !== lastUnit) {
        out.push({ type: 'section', unit: unit });
        lastUnit = unit;
        seq = 0;
      }
      seq++;
      var key = name.toLowerCase() + '\t' + position;
      var prev = byKey[key] || {};
      var row = {};
      DEFAULT_COLS.forEach(function (c) { /* KM_SECRET_TROOP_V2_TROOP */
        var k = c.key;
        var from = r[k];
        if (k === 'name') from = name;
        if (k === 'vus' && vus) from = vus;
        if (k === 'secret') {
          if (typeof window.kmNormalizeSecretClass === 'function') from = window.kmNormalizeSecretClass(from);
          var prevSec = prev[k];
          if (typeof window.kmNormalizeSecretClass === 'function') prevSec = window.kmNormalizeSecretClass(prevSec);
          // never keep liter letter (Ղ) as secrecy grade
          if (/^[Ա-ՖA-Za-z]$/u.test(String(prev[k] || '').trim())) prevSec = '';
        }
        if (from != null && String(from).trim() !== '') row[k] = String(from).trim();
        else if (k === 'secret' && prevSec) row[k] = String(prevSec).trim();
        else if (k !== 'secret' && prev[k]) row[k] = prev[k];
        else row[k] = '';
      });
      row.unit = unit || prev.unit || '';
      row.position = position || prev.position || '';
      row.seq = r.seq || prev.seq || String(seq);
      row.code = code || prev.code || '';
      row.rankSlot = r.rankSlot || prev.rankSlot || '';
      if (!row.rank) row.rank = r.rank || r.rankSlot || prev.rank || '';
      row.name = name || '';
      if (vus) row.vus = vus;
      if (r.education) row.education = r.education;
      out.push(row);
    });
    db.troopStructure.staff = db.troopStructure.staff || {};
    db.troopStructure.staff.rows = out;
    db.troopStructure.staff.columns = getColumns();
    db.troopStructure.staff.rows = dedupeTroopStaffRows(db.troopStructure.staff.rows || []);
    db.troopStructure.staff.autoFilter = autoFilter || db.troopStructure.staff.autoFilter || 'A2:AU1899';
    db.troopStructure.updatedAt = new Date().toISOString();
    db.troopStructure._nameNorm = 1;
    colFilters = {};
    markStaffRowsChanged();
    if (!opts.noOpen) window.kmOpenTroopStructure('staff');
    if (!opts.silent && typeof save === 'function') {
      try { save(true); } catch (_) {}
    }
    var st = staffStats();
    return { ok: true, slots: st.slots, filled: st.filled };
  };

  window.kmTroopImportXlsx = async function () {
    toastMsg("Բացեք Զորամասի Արխիվը։ Անձնակազմի ցուցակը գալիս է միայն այդ արխիվից։", 'warn');
  };

  window.kmTroopImportArchive = async function () {
    /* KM_TROOP_FORMAL_BIDI_SYNC_V1_TROOP — import removed; auto-synced from Unit Archive */
    toastMsg('Արխիվից ներմուծումը ավտոմատ է · տվյալները գալիս են Զորամասի Արխիվից', 'ok');
    try {
      if (typeof window.kmPullFormalArchiveToTroopStaff === 'function') window.kmPullFormalArchiveToTroopStaff({});
      window._kmTroopForcePaint = true;
      window.kmOpenTroopStructure(activeTab);
    } catch (e0) {}
  };

  window.kmTroopExportXlsx = async function () {
    ensureStore();
    if (!window.kmNative || !window.kmNative.export || !window.kmNative.export.troopStructureExcel) {
      toastMsg('Excel արտահանումը desktop-ում է', 'error'); return;
    }
    try {
      await window.kmTroopSave(true);
      var ts = db.troopStructure;
      var r = await window.kmNative.export.troopStructureExcel({
        name: 'UNIT_ARCHIVE_' + (ts.title || 'KM').replace(/[^\w\u0531-\u0587]+/g, '_').slice(0, 40),
        title: ts.title || '',
        staffRows: staffToExport(),
        combat: ts.combat || {},
        status: ts.status || {}
      });
      toastMsg('Excel՝ ' + (r.output || ''), 'ok');
      if (r.output && window.kmNative.shell && window.kmNative.shell.showItemInFolder) {
        await window.kmNative.shell.showItemInFolder(r.output);
      }
    } catch (e) {
      toastMsg((e && e.message) || 'Չստեղծվեց', 'error');
    }
  };

  function scheduleTroopArchiveFill() {
    /* KM_TROOP_FORMAL_BIDI_SYNC_V1_TROOP auto-pull from Unit Archive */
    if (window._kmTroopFillT) return;
    window._kmTroopFillT = setTimeout(function () {
      window._kmTroopFillT = 0;
      if (window.page !== 'troopStructure' && !fullScreen) return;
      try {
        if (typeof window.kmPullFormalArchiveToTroopStaff === 'function') {
          window.kmPullFormalArchiveToTroopStaff({ silent: true });
        } else if (typeof window.kmAllPositionArchiveRows === 'function') {
          var rows = window.kmAllPositionArchiveRows() || [];
          if (rows.length && typeof window.kmApplyArchiveRowsToTroopStaff === 'function') {
            window.kmApplyArchiveRowsToTroopStaff(rows, { silent: true, noOpen: true });
          }
        }
        var root = fullScreen ? document.getElementById('kmTroopFS') : document.getElementById('content');
        var body = (root && root.querySelector('#kmTroopBody')) || document.getElementById('kmTroopBody');
        if (body) body.innerHTML = renderBody();
        bindStaffGrid(root || document);
      } catch (e) {}
    }, 40);
  }

  window.kmOpenTroopStructure = function (tab) {
    try{ if(typeof window.kmRefillSecretFromSeedAndTroop==='function') window.kmRefillSecretFromSeedAndTroop(); }catch(_r){} /* KM_SECRET_TROOP_V2_OPEN */
    /* KM_TROOP_MANNING_UI_V3_FORCE_PULL */
    injectCss();
    ensureStore();
    if (tab) activeTab = String(tab);
    var host = document.getElementById('content');
    if (!host) return;
    try { if (typeof window.kmPurgeAccountingIfNoArchive === 'function') window.kmPurgeAccountingIfNoArchive(); } catch (ePur) {}
    if (typeof window.kmUnitHasStaffSource === 'function' ? !window.kmUnitHasStaffSource() : (typeof window.kmUnitHasExcelArchive === 'function' && !window.kmUnitHasExcelArchive())) {
      window._kmTroopForcePaint = true;
    }
    if (canEdit() && !window._kmTroopUserChoseView) {
      if (!editMode) window._kmTroopForcePaint = true;
      editMode = true;
    }
    function finishTroopPaint(root) {
      /* KM_TROOP_VIRTUAL_SCROLL_V1 */
      var body = root && root.querySelector('#kmTroopBody');
      if (body) body.innerHTML = renderBody();
      bindTroopVirtualScroll(root);
      bindStaffGrid(root);
      if (fullScreen) layoutTroopFullscreenScroll();
    }
    function refreshTroopChrome(root) {
      if (!root) return;
      root.querySelectorAll('[onclick="kmTroopToggleEdit()"]').forEach(function (btn) {
        btn.textContent = editMode ? 'Դիտում' : 'Խմբագրում';
      });
      var hint = root.querySelector('.kmTroopSub');
      if (hint && hint.innerHTML.indexOf('Խմբագրման ռեժիմ') >= 0 && !editMode) {
        hint.innerHTML = hint.innerHTML.replace(/<br><span[^>]*>Խմբագրման ռեժիմ<\/span>/, '');
      } else if (hint && editMode && hint.innerHTML.indexOf('Խմբագրման ռեժիմ') < 0) {
        hint.innerHTML += '<br><span style="color:#9a6b00">Խմբագրման ռեժիմ</span>';
      }
    }
    var liveRoot = fullScreen ? document.getElementById('kmTroopFS') : host.querySelector('.kmTroopCard');
    var missingEditBtn = !!(canEdit() && liveRoot && !liveRoot.querySelector('[onclick="kmTroopToggleEdit()"]'));
    if (!window._kmTroopForcePaint && !missingEditBtn && liveRoot && liveRoot.querySelector('#kmTroopBody') && window.page === 'troopStructure') {
      refreshTroopChrome(liveRoot);
      finishTroopPaint(liveRoot);
      page = 'troopStructure';
      window.page = 'troopStructure';
      return;
    }
    window._kmTroopForcePaint = false;
    var ts = db.troopStructure;
    var st = staffStats();
    var titleBits = '';
    try {
      var _ctx = typeof window.kmGetOrgContext === 'function' ? window.kmGetOrgContext() : null;
      var _bits = [];
      if (_ctx && _ctx.corpsName) _bits.push(_ctx.corpsName);
      if (_ctx && (_ctx.unitName || _ctx.unitId)) _bits.push(_ctx.unitName || _ctx.unitId);
      titleBits = _bits.join(' · ');
    } catch (eTB) { titleBits = String(ts.title || ''); }

    var tabs = [
      { id: 'staff', label: 'Շտատ (' + st.slots + ')' }, /* KM_TROOP_MANNING_UI_V3 */
      { id: 'vacant', label: 'Թափուր (' + st.vacant + ')' }, /* KM_TROOP_VACANT_TAB_V1 */
      { id: 'combat', label: 'Մարտ. քանակ' },
      { id: 'status', label: 'Վիճակ' }
    ].map(function (t) {
      return '<button type="button" class="' + (activeTab === t.id ? 'active' : '') + '" onclick="kmTroopStructureTab(\'' + t.id + '\')">' + t.label + '</button>';
    }).join('');

    var statsHtml = '<div class="kmTroopStats">' +
      '<div class="kmTroopStat"><b>' + st.sections + '</b><span>Բաժին</span></div>' +
      '<div class="kmTroopStat"><b>' + st.slots + '</b><span>Հաստիք</span></div>' +
      '<div class="kmTroopStat ok"><b>' + st.filled + '</b><span>Համալրված</span></div>' +
      '<div class="kmTroopStat warn"><b>' + st.vacant + '</b><span>Թափուր</span></div>' +
      '<div class="kmTroopStat"><b>' + st.pct + '%</b><span>%</span></div></div>';

    var cardInner =
      '<div class="kmTroopHead"><div>' +
      '<h3>Անձնակազմի հաշվառում</h3>' +
      '<p class="kmTroopSub"><b>' + esc(ts.title || titleBits || 'Զորամասի Արխիվ') + '</b><br>' +
      'Համալրվածություն = համալրված / հաստիք · ' + st.filled + ' / ' + st.slots + ' (' + st.pct + '%)' +
      (editMode ? '<br><span style="color:#9a6b00">Խմբագրման ռեժիմ</span>' : '') + '</p></div>' + statsHtml + '</div>' +
      (fullScreen ? '' : ('<div class="kmTroopTools">' +
      (canEdit()
        ? '<button type="button" onclick="kmTroopExportXlsx()">Արտահանել</button>' +
          '<button type="button" class="primary" onclick="kmTroopSave()">Պահպանել</button>' +
          '<button type="button" onclick="kmTroopToggleEdit()">' + (editMode ? 'Դիտում' : 'Խմբագրում') + '</button>'
        : '<button type="button" onclick="kmTroopExportXlsx()">Արտահանել</button>') +
      '<button type="button" class="primary" onclick="kmTroopFullscreen()">Ամբողջ էկրան · դիտում/խմբագրում</button>' +
          '<button type="button" onclick="kmReportsBack()">← Վերադարձ</button>' +
      '</div>' )) +
      /* KM_TROOP_FS_UI_SCROLL_V2_NO_INNER_TOOLS */
      '<div class="kmManningPct" style="margin:0 0 12px;padding:10px 12px;border-radius:10px;background:#eef6f1;border:1px solid #cfe3d7;font-size:14px">' +
        '<b>Համալրվածություն՝ ' + st.pct + '%</b>' +
        ' <span class="muted">(' + st.filled + ' / ' + st.slots + ' հաստիք · ' + st.vacant + ' թափուր)</span>' +
      '</div>' +
      '<div class="kmTroopTabs">' + tabs + '</div>' +
      (activeTab === 'staff' || activeTab === 'vacant'
        ? '<div class="kmTroopFilter">' +
          '<input type="search" value="' + escAttr(filterSearch) + '" onchange="kmTroopSearch(this.value)" placeholder="Որոնել…" style="min-width:220px;flex:1;padding:7px;border:1px solid #d0d7e2;border-radius:8px">' +
          (activeTab === 'vacant'
            ? '<label><input type="checkbox" checked disabled> Թափուր տեղեր</label>'
            : '<label><input type="checkbox" onchange="kmTroopVacantOnly(this.checked)"' + (vacantOnly ? ' checked' : '') + '> Միայն թափուր</label>') +
          (activeFilterCount() ? '<button type="button" onclick="kmTroopClearFilters()">Մաքրել ֆիլտրերը</button>' : '') +
          '</div>' + activeFiltersHtml()
        : '') +
      '<div id="kmTroopBody" data-km-i18n-skip></div>';

    // Remove previous body-mounted fullscreen shell
    var oldFs = document.getElementById('kmTroopFS');
    if (oldFs) oldFs.remove();

    if (fullScreen) {
      document.body.classList.add('km-troop-fs');
      var shell = document.createElement('div');
      shell.id = 'kmTroopFS';
      shell.className = 'kmTroopFS';
      shell.setAttribute('style',
        'position:fixed;top:0;left:0;right:0;bottom:0;width:100vw;height:100vh;z-index:2000000;' +
        'margin:0;padding:8px 10px;box-sizing:border-box;background:#e8eee9;' +
        'display:flex;flex-direction:column;overflow:hidden;visibility:visible;pointer-events:auto;'
      );
      shell.innerHTML =
        '<div class="kmTroopFSBar" id="kmTroopFSBar">' +
          '<div><b>Անձնակազմի հաշվառում · ամբողջ էկրան</b></div>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
            '<button type="button" onclick="kmTroopExportXlsx()">Արտահանել</button>' +
            /* KM_TROOP_FS_UI_SCROLL_V2_FS_ACTIONS */
            (canEdit() ? '<button type="button" onclick="kmTroopSave()">Պահպանել</button>' +
              '<button type="button" onclick="kmTroopToggleEdit()">' + (editMode ? 'Դիտում' : 'Խմբագրում') + '</button>' : '') +
            '<button type="button" class="primary" id="kmTroopFsExitBtnBar" onclick="kmTroopExitFullscreen()">✕ Փոքր էկրան</button>' +
          '</div>' +
        '</div>' +
        '<div class="card kmTroopCard kmUtShell" style="flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden">' + cardInner + '</div>';
      document.body.appendChild(shell);
      host.innerHTML = '<div class="card"><p class="kmTroopMeta">Ամբողջ էկրանի ռեժիմ…</p></div>';
      requestAnimationFrame(function () {
        finishTroopPaint(shell);
        requestAnimationFrame(function () {
          layoutTroopFullscreenScroll();
          setTimeout(layoutTroopFullscreenScroll, 50);
          setTimeout(layoutTroopFullscreenScroll, 200);
          setTimeout(function () { layoutTroopFullscreenScroll(); bindTroopVirtualScroll(shell); }, 350);
        });
      });
      if (!window._kmTroopFsResizeBound) {
        window._kmTroopFsResizeBound = true;
        window.addEventListener('resize', function () {
          if (fullScreen) layoutTroopFullscreenScroll();
        });
      }
    } else {
      document.body.classList.remove('km-troop-fs');
      host.innerHTML = '<div class="card kmTroopCard kmUtShell">' + cardInner + '</div>';
      requestAnimationFrame(function () { finishTroopPaint(host); });
    }

    page = 'troopStructure';
    window.page = 'troopStructure';
    var pt = document.getElementById('pageTitle');
    if (pt) pt.textContent = 'Անձնակազմի հաշվառում';
    if (!window._kmTroopEscBound) {
      window._kmTroopEscBound = true;
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && fullScreen /* KM_TROOP_FS_EXIT_V1 */) {
          e.preventDefault();
          window.kmTroopExitFullscreen();
        }
      });
    }
    if (typeof window.kmApplyRoleGuard === 'function') try { window.kmApplyRoleGuard(); } catch (_) {}
    function unlockTroopInputs() {
      try {
        var unlockRoot = fullScreen ? document.getElementById('kmTroopFS') : document.getElementById('content');
        bindStaffGrid(unlockRoot || document);
      } catch (eBind) {}
    }
    unlockTroopInputs();
    setTimeout(unlockTroopInputs, 60);
    try { scheduleTroopArchiveFill(); } catch (eFill) {}
  };
})();


/* KM_PURE_ACTIVE_NO_ARCHIVE_V1 — radical: listed accounting sections use ZERO archives */
(function () {
  if (window.__kmPureActiveNoArchiveV1) return;
  window.__kmPureActiveNoArchiveV1 = true;
  window.KM_NO_ARCHIVES = true;
  window.__kmArchiveRefillDisabled = true;

  function emptyStaffApi() {
    return {
      marker: 'KM_PURE_ACTIVE_NO_ARCHIVE_V1',
      COL: {},
      getSheet: function () { return null; },
      rows: function () { return []; },
      people: function () { return []; },
      posts: function () { return []; },
      codes: function () { return []; },
      hasFormal: function () { return false; },
      activeUnitId: function () { return ''; },
      findRowByName: function () { return null; },
      factsForPerson: function () { return null; },
      applyFactsToPerson: function () { return false; },
      pushPersonToFormal: function () { return 0; },
      ensure: function () { return null; }
    };
  }

  // KM_RESTORE_ARCHIVE_STAFF_V1 — do NOT wipe real kmUnitArchiveStaffSource from km-unit-tools.js
  if (!(window.kmUnitArchiveStaffSource && window.kmUnitArchiveStaffSource.hasFormal && !window.kmUnitArchiveStaffSource.__kmEmptyStub)) {
    var __emptyStaff = emptyStaffApi();
    __emptyStaff.__kmEmptyStub = true;
    window.kmUnitArchiveStaffSource = __emptyStaff;
  }

  // Kill ensure / seed / html v7 refill
  window.kmEnsureHtmlV7UnitArchive = function () { return null; };
  window.kmIsHtmlV7UnitId = function () { return false; };
  window.sheetFrom25836Seed = function () { return null; };
  window.kmEnsureUnitArchiveRows = function () { return Promise.resolve([]); };

  // No archive facts / push for person card from formal archive
  window.kmArchiveFactsForPerson = function () { return null; };
  window.kmApplyUnitArchiveToPerson = function () { return false; };
  window.kmPushPersonCardToUnitArchive = function () { return 0; };
  window.kmExcelStaffFactsForPerson = function () { return null; };

  // KM_PURE_SCOPE_DUTY_SAFE_V1 — sync still killed; staff probe true if active people exist (stops duty purge)
  window.kmUnitHasStaffSource = function (unitId) { /* KM_RESTORE_HAS_STAFF_V1 */ try { if (window.kmUnitArchiveStaffSource && window.kmUnitArchiveStaffSource.hasFormal && window.kmUnitArchiveStaffSource.hasFormal(unitId)) return true; } catch (e) {} try { if (typeof db !== "undefined" && db && Array.isArray(db.positionArchives) && db.positionArchives.some(function(a){ return a && Array.isArray(a.rows) && a.rows.length; })) return true; } catch (e2) {} return false; };
  window.kmUnitFormalActive = function () { return false; };
  window.kmUnitHasExcelArchive = function () { return false; };
  window.__kmUnitHasExcelArchiveLegacy = function () { return false; };

  // Accounting people lists: empty active only (no formal/excel roster)
  window.kmPeopleRoster = function () {
    try {
      if (typeof db !== 'undefined' && db && Array.isArray(db.people)) {
        return db.people.filter(function (p) { return p && p.name; });
      }
    } catch (e) {}
    return [];
  };
  window.kmPeopleFromPositions = function () { return []; };
  window.kmSyncPeopleFromPositions = function () { return []; };
  window.kmSyncAccountingFromUnitArchive = function () { return { ok: true, disabled: true }; };
  window.kmSyncAccountingFromUnitArchiveDebounced = function () {};

  // KM_PURE_SCOPE_DUTY_SAFE_V1 — do not wipe formal bags (subdivision fields)
  function scrubFormal() { /* no-op */ }
  /* scrubFormal disabled */

  // Wrap openers: scrub before render so UI never sees archive bags
  function wrap(name) {
    try {
      var fn = window[name];
      if (typeof fn !== 'function' || fn.__noArch) return;
      window[name] = function () {
        scrubFormal();
        return fn.apply(this, arguments);
      };
      window[name].__noArch = true;
    } catch (e) {}
  }
  [
    'kmOpenPersonnelHub', 'people', 'openVacations', 'kmOpenTroopStructure',
    'kmOpenUnitMedical', 'kmOpenUnitLeavePlan', 'kmOpenUnitTermWatch',
    'kmOpenUnitFormation', 'openUnitMedical', 'openUnitLeavePlan',
    'openUnitTermWatch', 'openTroopStructure', 'kmRenderAccountingHub'
  ].forEach(wrap);
})();
/* KM_PURE_ACTIVE_NO_ARCHIVE_V1_DONE */

