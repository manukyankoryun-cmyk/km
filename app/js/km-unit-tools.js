/* KM_UNIFIED_ARCHIVE_FLOW_V1_UT_DONE */
/* KM_OVERHAUL_V6_EXCEL_GATE */
/* KM_UNIFIED_ARCHIVE_FLOW_V2_UT_DONE */
/* KM — ԱՇԽԱՏԱՆՔԻ ԳՈՐԾԻՔՆԵՐ (11 մոդուլ, Phase 1 MVP) */
(function () {
  'use strict';

  var PAGES = {
    unitDocs: 'Փաստաթղթերի գեներատոր',
    unitInventory: 'Գույքի հաշվառում',
    unitCharDrafts: 'Բնութագրի օգնական',
    unitFuel: 'ՎՔՆ հաշվիչ',
    unitDayPlans: 'Օրվա կարգացուցակ',
    unitMedical: 'Բուժկետ',
    unitLeavePlan: 'Արձակուրդների հերթափոխ',
    unitArchive: 'Զորամասի Արխիվ',
    unitBlanks: 'Ձևաթղթերի պորտալ',
    unitDossiers: 'Էլեկտրոնային քարտադարան',
    unitFormation: 'Շարային տեղեկագիր',
    unitTermWatch: 'Կոչումներ և ժամկետներ',
    unitBadDays: 'Անհարմար օրեր',
    unitReserve: 'Պահեստազոր', /* KM_RESERVE_ARCHIVE_V1 */
    unitHamalr: 'Համալրվածության վերաբերյալ հաշվետվություն' /* KM_HAMALR_MOVE_V1 */
  };

  var DOC_TEMPLATES = [
    { id: 'leave', title: 'Արձակուրդի զեկուցագիր' },
    { id: 'medical', title: 'Բուժման զեկուցագիր' },
    { id: 'report', title: 'Ծառայողական զեկուցագիր' },
    { id: 'transfer', title: 'Տեղափոխման զեկուցագիր' },
    { id: 'discharge', title: 'Զորացրման զեկուցագիր' }
  ];

  var INV_CATS = ['զենք', 'հանդերձանք', 'վառելիք', 'այլ'];
  var DAY_THEMES = [
    'Մարտավարական պարապմունք',
    'Ֆիզիկական պատրաստություն',
    'Կրակային պատրաստություն',
    'Շարային պատրաստություն',
    'Տեխնիկական սպասարկում',
    'Կանոնադրական ժամ',
    'Սպորտային միջոցառում',
    'Զորավարժություն'
  ];

  function esc(s) {
    return typeof window.esc === 'function' ? window.esc(s) : String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function canEdit() {
    var pg = String(window.page || '').trim();
    if (pg && typeof window.kmCanEditPage === 'function') {
      return !!window.kmCanEditPage(pg);
    }
    if (pg && typeof window.kmCanEdit === 'function') {
      return !!window.kmCanEdit(pg);
    }
    return typeof window.kmCanEdit === 'function' ? window.kmCanEdit() : true;
  }
  function host() {
    return document.getElementById('content');
  }
  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }
  function todayIso() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function addDaysIso(iso, n) {
    var d = new Date(String(iso || todayIso()) + 'T12:00:00');
    if (isNaN(d.getTime())) d = new Date();
    d.setDate(d.getDate() + (n || 0));
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function daysBetween(a, b) {
    var x = new Date(String(a) + 'T12:00:00');
    var y = new Date(String(b) + 'T12:00:00');
    if (isNaN(x.getTime()) || isNaN(y.getTime())) return 0;
    return Math.round((y - x) / 86400000);
  }
  function fmtDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(String(iso) + 'T12:00:00').toLocaleDateString('hy-AM');
    } catch (e) {
      return String(iso).slice(0, 10);
    }
  }
  var _peopleListCache = { at: 0, list: null };
  window.kmInvalidateArchivePeopleCache = function () {
    _peopleListCache = { at: 0, list: null };
  };

  /* KM_UNIT_ARCHIVE_HTML_V7_SSOT_V1
     25836 / bk2_u1 is ALWAYS the packaged HTML_V7 seed (~2636 rows, first named
     Հայրապետյան Ահարոն Աղաբեկի). Never keep the 2286-row DEDUPE cache (Dallakyan). */
  window.KM_HTML_V7_UNIT_IDS = { bk2_u1: 1, '25836': 1 };
  window.kmIsHtmlV7UnitId = function (unitId) {
    var uid = String(unitId || '').trim();
    if (!uid) return false;
    if (window.KM_HTML_V7_UNIT_IDS[uid]) return true;
    return /25836/.test(uid);
  };
  window.kmLoadHtmlV7SeedSync = function () {
    if (window.__kmUnit25836Seed && Array.isArray(window.__kmUnit25836Seed.roster) && window.__kmUnit25836Seed.roster.length) {
      return window.__kmUnit25836Seed;
    }
    function accept(data) {
      if (data && Array.isArray(data.roster) && data.roster.length) {
        window.__kmUnit25836Seed = data;
        return data;
      }
      return null;
    }
    function xhrGet(url) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.send(null);
      if (xhr.status === 0 || (xhr.status >= 200 && xhr.status < 300)) return xhr.responseText || '';
      return '';
    }
    try {
      var jsonTxt = xhrGet('data/km_unit_archive_25836.json');
      if (jsonTxt) {
        var fromJson = accept(JSON.parse(jsonTxt));
        if (fromJson) return fromJson;
      }
    } catch (eJ) {}
    /* KM_NO_HTML_ARCHIVE_FALLBACK_V1: JSON seed only; do not XHR obsolete HTML */
    return window.__kmUnit25836Seed || null;
  };
  window.kmHtmlV7FirstNamed = function (rows) {
    if (!Array.isArray(rows)) return '';
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (!r || r.type === 'title' || r.type === 'header' || r.type === 'section') continue;
      var cells = r.cells || [];
      var n = String(cells[8] || r.sourceName || r.name || r.personName || '').trim();
      if (n) return n;
    }
    return '';
  };
  window.kmSheetIsLegacyDedupe = function (sheet) {
    if (!sheet || !Array.isArray(sheet.rows) || !sheet.rows.length) return true;
    var src = String(sheet.source || '');
    if (sheet.forceHtmlV7 && src.indexOf('HTML_V7') >= 0 && sheet.rows.length >= 2600) return false;
    if (/DEDUPE/i.test(src)) return true;
    if (sheet.rows.length === 2286) return true;
    if (sheet.rows.length >= 2600) return false;
    if (sheet.rows.length < 2500) return true;
    var first = window.kmHtmlV7FirstNamed(sheet.rows);
    if (/դալլաքյան/i.test(first) || /dallakyan/i.test(first)) return true;
    return false;
  };
  window.kmBuildHtmlV7Sheet = function (unitId) {
    var seed = window.kmLoadHtmlV7SeedSync();
    if (!seed || !Array.isArray(seed.roster) || !seed.roster.length) return null;
    var headers = (seed.headers && seed.headers.length) ? seed.headers.slice() : null;
    var colN = (headers && headers.length) ? headers.length : 25;
    var rows = seed.roster.map(function (r) {
      var cells = new Array(colN);
      var src = (r && Array.isArray(r.cells)) ? r.cells : [];
      var c;
      for (c = 0; c < colN; c++) cells[c] = src[c] != null ? String(src[c]) : '';
      return { type: (r && r.type) || 'data', cells: cells };
    });
    return {
      unitId: String(unitId || 'bk2_u1').trim() || 'bk2_u1',
      headers: headers || [],
      rows: rows,
      source: 'html-25836-HTML_V7',
      preserve25836: true,
      noExcel: true,
      forceHtmlV7: true,
      updatedAt: new Date().toISOString()
    };
  };
  /* KM_BG_SAVE_V1: one coalesced, idle-time save for non-user-initiated rebuilds. */
  window.kmScheduleBackgroundSave = function (delayMs) {
    if (window.__kmBgSaveT) return;
    window.__kmBgSaveT = setTimeout(function () {
      window.__kmBgSaveT = 0;
      var run = function () {
        try {
          if (typeof window.kmSaveDb === 'function') window.kmSaveDb();
          else if (typeof save === 'function') save(true);
        } catch (eBg) {}
      };
      if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 5000 });
      else run();
    }, typeof delayMs === 'number' ? delayMs : 1200);
  };
  window.kmEnsureHtmlV7UnitArchive = function (opts) {
    opts = opts || {};
    if (typeof db === 'undefined' || !db) return null;
    if (!db.unitFormalArchives || typeof db.unitFormalArchives !== 'object' || Array.isArray(db.unitFormalArchives)) {
      db.unitFormalArchives = {};
    }
    var store = db.unitFormalArchives;
    var existing = store.bk2_u1 || store['25836'] || null;
    if (!opts.force && window.__kmHtmlV7Ready && existing && Array.isArray(existing.rows) && existing.rows.length >= 2600) {
      return existing;
    }
    if (existing && !window.kmSheetIsLegacyDedupe(existing) && existing.forceHtmlV7 &&
        Array.isArray(existing.rows) && existing.rows.length >= 2600) {
      store.bk2_u1 = existing;
      window.__kmHtmlV7Ready = true;
      return existing;
    }
    var built = window.kmBuildHtmlV7Sheet('bk2_u1');
    if (!built) {
      /* Never keep the 2286 DEDUPE cache even if the packaged seed failed to load. */
      if (existing && !window.kmSheetIsLegacyDedupe(existing)) return existing;
      return null;
    }
    store.bk2_u1 = built;
    window.__kmHtmlV7Ready = true;
    try { if (store['25836'] && store['25836'] !== built) delete store['25836']; } catch (eDel) {}
    try {
      if (typeof window.kmInvalidateArchivePeopleCache === 'function') window.kmInvalidateArchivePeopleCache();
    } catch (eC) {}
    try {
      window._kmAccAppliedKey = '';
      window._kmAccAppliedAt = 0;
    } catch (eAcc) {}
    if (!opts.noPersist) {
      /* Perf: a full save() (normalize + slim + IndexedDB + snapshot of the whole db) used to run right here, inline,
         during start-up / first section open. Same save, but coalesced and run when the UI is idle. */
      window.kmScheduleBackgroundSave();
    }
    return built;
  };

  /* KM_UNIT_ARCHIVE_UNIFIED_SOURCE_V1 — shared adapter: Unit Archive (db.unitFormalArchives) as runtime staff source */
  window.kmUnitArchiveStaffSource = (function () {
    var COL = {
      unit: 0, position: 1, seq: 2, secret: 3, vus: 4, code: 5,
      rankSlot: 6, rank: 7, name: 8, posOrder: 9, rankOrder: 10,
      contract: 11, special: 12, contact: 13, birth: 14, zk: 15,
      address: 16, serviceYear: 17, discipline: 18, serviceTotal: 19,
      lastAccept: 20, idCard: 21, blood: 22, caseNo: 23, vacation: 24
    };
    function cell(row, i) {
      return String(((row && row.cells) || [])[i] || '').trim();
    }
    function activeUnitId(unitId) {
      var uid = String(unitId != null && String(unitId) !== '' ? unitId : '').trim();
      if (uid) return uid;
      var forced = String(window._kmArchiveForUnitId || '').trim();
      if (forced) return forced;
      try {
        var ctx = typeof window.kmGetOrgContext === 'function' ? window.kmGetOrgContext() : null;
        return String((ctx && ctx.unitId) || '').trim();
      } catch (e0) { return ''; }
    }
    
    function pickPositionArchive(unitId) {
      /* KM_POSITION_ARCHIVE_STAFF_FALLBACK_V1 */
      if (typeof db === 'undefined' || !db) return null;
      var uid = activeUnitId(unitId);
      var lists = [];
      if (Array.isArray(db.positionArchives)) lists.push(db.positionArchives);
      try {
        var cd = db.kmCorpsData;
        if (cd && typeof cd === 'object') {
          Object.keys(cd).forEach(function (k) {
            if (cd[k] && Array.isArray(cd[k].positionArchives)) lists.push(cd[k].positionArchives);
          });
        }
      } catch (eCd) {}
      var best = null;
      lists.forEach(function (list) {
        (list || []).forEach(function (a) {
          if (!a || a.builtin || !Array.isArray(a.rows) || !a.rows.length) return;
          if (uid) {
            var au = String(a.unitId || '').trim();
            if (au && au !== uid) return;
          }
          if (!best || a.rows.length > best.rows.length) best = a;
        });
      });
      return best;
    }
    function rowsFromPositionArchive(unitId) {
      /* KM_POSITION_ARCHIVE_STAFF_FALLBACK_V1 */
      var arch = pickPositionArchive(unitId);
      if (!arch) return [];
      var uid = activeUnitId(unitId);
      var out = [];
      arch.rows.forEach(function (r, ri) {
        if (!r) return;
        if (r.type === 'section' || r.type === 'header' || r.type === 'title') {
          out.push({
            type: 'section',
            unit: r.unit || r.section || r.position || '',
            archId: String(arch.id || ''),
            archName: arch.name || 'UnitArchive',
            excelRow: r.excelRow != null ? r.excelRow : (ri + 1),
            fromFormal: true,
            fromPositionArchive: true
          });
          return;
        }
        if (r.type && r.type !== 'row') return;
        var name = String(r.name || r.sourceName || r.personName || '').trim();
        if (name && !looksName(name)) name = '';
        var position = String(r.position || '').trim();
        var code = String(r.code || r.postCode || r.vus || '').trim();
        var unit = String(r.unit || r.section || '').trim();
        if (!name && !code && !position && !unit) return;
        out.push({
          type: 'row',
          unit: unit,
          position: position,
          seq: r.seq || '',
          secret: r.secret || '',
          vus: r.vus || '',
          code: code,
          rankSlot: r.rankSlot || '',
          rank: r.rank || '',
          sourceName: name,
          name: name,
          personName: name,
          education: r.education || '',
          specialty: r.specialty || r.vus || '',
          birth: r.birth || '',
          idCard: r.idCard || '',
          contact: r.contact || r.phone || '',
          address: r.address || '',
          vacation: r.vacation || '',
          vacant: !!r.vacant || !name,
          archId: String(arch.id || ''),
          archName: arch.name || 'UnitArchive',
          excelRow: r.excelRow != null ? r.excelRow : (ri + 1),
          fromFormal: true,
          fromPositionArchive: true
        });
      });
      return out;
    }
    function getSheet(unitId) {
      if (typeof db === 'undefined' || !db) return null;
      var uid = activeUnitId(unitId);
      if (uid && window.kmIsHtmlV7UnitId && window.kmIsHtmlV7UnitId(uid) && !window.__kmHtmlV7Ready) {
        try {
          if (typeof window.kmEnsureHtmlV7UnitArchive === 'function') {
            window.kmEnsureHtmlV7UnitArchive({ noPersist: true });
          }
        } catch (eV7) {}
      }
      if (!db.unitFormalArchives || typeof db.unitFormalArchives !== 'object' || Array.isArray(db.unitFormalArchives)) {
        return null;
      }
      if (!uid) return null;
      var sheet = db.unitFormalArchives[uid] || ((window.kmIsHtmlV7UnitId && window.kmIsHtmlV7UnitId(uid)) ? db.unitFormalArchives.bk2_u1 : null);
      return sheet && Array.isArray(sheet.rows) ? sheet : null;
    }
    function looksName(s) {
      if (typeof window.kmLooksLikePersonName === 'function') {
        try { return !!window.kmLooksLikePersonName(s); } catch (e1) {}
      }
      var t = String(s || '').replace(/\s+/g, ' ').trim();
      if (t.length < 2) return false;
      if (/^[\d.\-\/]+$/.test(t)) return false;
      return /[Ա-Ֆա-ֆЁёА-Яа-яA-Za-z]/.test(t);
    }
    function rows(unitId) {
      var sheet = getSheet(unitId);
      /* KM_UNIFIED_ARCHIVE_FLOW_V1_UT no excel fallback */ if (!sheet) return [];
      var uid = activeUnitId(unitId);
      var cacheKey = uid + ':' + sheet.rows.length + ':' + String(sheet.updatedAt || sheet.source || '');
      if (this && false) {}
      if (window.__kmStaffRowsCache && window.__kmStaffRowsCache.key === cacheKey && Array.isArray(window.__kmStaffRowsCache.list)) {
        return window.__kmStaffRowsCache.list;
      }
      var out = [];
      sheet.rows.forEach(function (r, ri) {
        if (!r) return;
        if (r.type === 'header' || r.type === 'title') return;
        if (r.type === 'section') {
          out.push({
            type: 'section',
            unit: cell(r, COL.unit) || cell(r, COL.seq) || cell(r, COL.position),
            archId: 'formal:' + uid,
            archName: 'UnitArchive',
            excelRow: ri + 1,
            fromFormal: true
          });
          return;
        }
        var name = cell(r, COL.name);
        var code = cell(r, COL.code);
        var position = cell(r, COL.position);
        var unit = cell(r, COL.unit);
        if (!name && !code && !position && !unit) return;
        if (name && !looksName(name)) name = '';
        out.push({
          type: 'row',
          unit: unit,
          position: position,
          seq: cell(r, COL.seq),
          secret: (typeof kmNormalizeSecretClass==='function'?kmNormalizeSecretClass(cell(r, COL.secret)):cell(r, COL.secret)), /* KM_SECRET_NO_LITER_V1_CELL */
          vus: cell(r, COL.vus),
          code: code,
          rankSlot: cell(r, COL.rankSlot),
          /* KM_TERMWATCH_UNIT_ARCHIVE_FLOW_V2: personal rank must not fall back to post rankSlot */
          rank: cell(r, COL.rank),
          lastAccept: cell(r, COL.lastAccept),
          sourceName: name,
          name: name,
          personName: name,
          education: '',
          specialty: cell(r, COL.vus),
          birth: cell(r, COL.birth),
          idCard: cell(r, COL.idCard),
          contact: cell(r, COL.contact),
          address: cell(r, COL.address),
          vacation: cell(r, COL.vacation),
          archId: 'formal:' + uid,
          archName: 'UnitArchive',
          excelRow: ri + 1,
          fromFormal: true
        });
      });
      /* KM_UNIT_ARCHIVE_HTML_V7_SSOT_V1 — keep full HTML_V7 rows; never collapse to DEDUPE */
      if (!(sheet.forceHtmlV7 || String(sheet.source || '').indexOf('HTML_V7') >= 0)) {
        out = dedupeStaffRows(out);
      }
      window.__kmStaffRowsCache = { key: uid + ':' + sheet.rows.length + ':' + String(sheet.updatedAt || sheet.source || ''), list: out };
      return out;
    }
    
    /* KM_STAFF_DEDUPE_MANNING_V1_UT — unique post = unit + position + code (seq ignored) */
    function normPostPart(s) {
      return String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
    }
    function postDedupeKey(r) {
      if (!r || r.type === 'section') return '';
      var u = normPostPart(r.unit || r.section);
      var p = normPostPart(r.position);
      var c = normPostPart(r.code);
      if (!p && !c) return '';
      return u + '|' + p + '|' + c;
    }
    function rowFillScore(r) {
      if (!r) return 0;
      var n = 0;
      var name = String(r.sourceName || r.name || r.personName || '').trim();
      if (name && looksName(name)) n += 10;
      ['vus', 'rank', 'rankSlot', 'contact', 'birth', 'contract', 'address', 'idCard'].forEach(function (k) {
        if (String(r[k] || '').trim()) n += 1;
      });
      return n;
    }
    function dedupeStaffRows(list) {
      if (!list || !list.length) return list || [];
      var best = Object.create(null);
      var firstIdx = Object.create(null);
      var outMeta = [];
      for (var i = 0; i < list.length; i++) {
        var r = list[i];
        if (!r) continue;
        if (r.type === 'section') {
          outMeta.push({ kind: 'section', r: r });
          continue;
        }
        var k = postDedupeKey(r);
        if (!k) {
          outMeta.push({ kind: 'row', r: r });
          continue;
        }
        if (firstIdx[k] == null) {
          firstIdx[k] = outMeta.length;
          best[k] = r;
          outMeta.push({ kind: 'dedupe', key: k });
        } else if (rowFillScore(r) > rowFillScore(best[k])) {
          best[k] = r;
        }
      }
      var out = [];
      for (var j = 0; j < outMeta.length; j++) {
        var m = outMeta[j];
        if (m.kind === 'dedupe') out.push(best[m.key]);
        else out.push(m.r);
      }
      return out;
    }
function people(unitId) {
      var seen = Object.create(null);
      var out = [];
      rows(unitId).forEach(function (r) {
        if (!r || r.type === 'section') return;
        var n = String(r.sourceName || '').trim();
        if (!n || !looksName(n)) return;
        var k = n.toLowerCase();
        if (seen[k]) return;
        seen[k] = 1;
        out.push({
          /* PC_ARCH_PEOPLE_ENRICH */
          name: n,
          rank: r.rank || '',
          rankSlot: r.rankSlot || '',
          unit: r.unit || '',
          section: r.unit || '',
          post: r.position || '',
          postCode: r.code || '',
          code: r.code || '',
          education: r.education || '',
          specialty: r.specialty || r.vus || '',
          vus: r.vus || '',
          idCard: r.idCard || '',
          contact: r.contact || '',
          address: r.address || '',
          birth: r.birth || '',
          fromFormal: true
        });
      });
      return out;
    }
    function posts(unitId) {
      return rows(unitId).filter(function (r) {
        return r && r.type !== 'section' && (r.position || r.code);
      });
    }
    function codes(unitId) {
      var seen = Object.create(null);
      var out = [];
      rows(unitId).forEach(function (r) {
        var c = String((r && r.code) || '').trim();
        if (!c || seen[c]) return;
        seen[c] = 1;
        out.push(c);
      });
      return out;
    }
    function hasFormal(unitId) {
      /* KM_UNIFIED_ARCHIVE_FLOW_V1_UT formal-only */
      var sheet = getSheet(unitId);
      return !!(sheet && sheet.rows && sheet.rows.length);
    }

    function samePersonName(a, b) {
      if (typeof window.kmVacationSamePerson === 'function') {
        try { return !!window.kmVacationSamePerson(a, b); } catch (e0) {}
      }
      return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
    }
    /** KM_PERSON_CARD_ARCHIVE_FIELDS_V1 — single archive fact map for Person Card (no duplicate Excel path). */
    function findRowByName(name, unitId) {
      name = String(name || '').trim();
      if (!name) return null;
      var list = rows(unitId) || [];
      for (var i = 0; i < list.length; i++) {
        var r = list[i];
        if (!r || r.type === 'section') continue;
        if (samePersonName(r.sourceName || r.name || r.personName, name)) return r;
      }
      return null;
    }
    function factsForPerson(personOrName, unitId) {
      var name = typeof personOrName === 'string'
        ? personOrName
        : String((personOrName && personOrName.name) || '').trim();
      var row = findRowByName(name, unitId);
      if (!row) {
        return {
          name: name,
          found: false,
          fromFormal: false,
          post: '',
          postCode: '',
          code: '',
          unit: '',
          section: '',
          seq: '',
          secret: '',
          rankSlot: '',
          rank: '',
          specialty: '',
          vus: '',
          idCard: '',
          contact: '',
          address: '',
          birth: '',
          vacation: '',
          contract: '',
          blood: '',
          serviceYear: '',
          lastAccept: '',
          zk: '',
          posOrder: ''
        };
      }
      return {
        name: name,
        found: true,
        fromFormal: true,
        post: row.position || '',
        postCode: row.code || '',
        code: row.code || '',
        unit: row.unit || '',
        section: row.unit || '',
        seq: row.seq || '',
        secret: row.secret || '',
        rankSlot: row.rankSlot || '',
        rank: row.rank || '',
        specialty: row.specialty || row.vus || '',
        vus: row.vus || '',
        idCard: row.idCard || '',
        contact: row.contact || '',
        address: row.address || '',
        birth: row.birth || '',
        vacation: row.vacation || '',
        contract: row.contract || '',
        blood: row.blood || '',
        serviceYear: row.serviceYear || '',
        lastAccept: row.lastAccept || '',
        zk: row.zk || '',
        posOrder: row.posOrder || row.seq || ''
      };
    }
    function applyFactsToPerson(person, opts) {
      opts = opts || {};
      if (!person || !person.name) return false;
      var facts = factsForPerson(person, opts.unitId);
      if (!facts.found) return false;
      var force = !!opts.force;
      if (facts.post && (force || !String(person.post || '').trim())) person.post = facts.post;
      if (facts.postCode && (force || !String(person.postCode || person.code || '').trim())) {
        person.postCode = facts.postCode;
        person.code = facts.postCode;
      }
      if (facts.section && (force || !String(person.unit || '').trim())) person.unit = facts.section;
      if (facts.rankSlot && (force || !String(person.rankSlot || '').trim())) person.rankSlot = facts.rankSlot;
      // Do not overwrite living rank from rankSlot unless empty — promotion is by staffing code
      if (facts.rank && (force || !String(person.rank || '').trim())) person.rank = facts.rank;
      if (facts.specialty && (force || !String(person.specialty || '').trim())) {
        if (!(typeof window.kmLooksLikeStaffCode === 'function' && window.kmLooksLikeStaffCode(facts.specialty))) {
          person.specialty = facts.specialty;
        }
      }
      if (facts.idCard && (force || !String(person.idCard || '').trim())) person.idCard = facts.idCard;
      if (facts.contact && (force || !String(person.phone || person.contact || '').trim())) {
        if (!person.phone) person.phone = facts.contact;
      }
      if (facts.address && (force || !String(person.address || '').trim())) person.address = facts.address;
      if (facts.birth && (force || !String(person.birth || person.birthDate || '').trim())) person.birth = facts.birth;
      if (facts.seq && (force || !String(person.seq || '').trim())) person.seq = facts.seq;
      if (facts.secret && (force || !String(person.secret || '').trim())) person.secret = (typeof kmNormalizeSecretClass==='function'?kmNormalizeSecretClass(facts.secret):facts.secret); /* KM_SECRET_NO_LITER_V1_FACT */
      if (facts.vus && (force || !String(person.vus || '').trim())) person.vus = facts.vus;
      if (facts.vacation && (force || !String(person.vacation || '').trim())) person.vacation = facts.vacation;
      if (facts.contract && (force || !String(person.contract || '').trim())) person.contract = facts.contract;
      if (facts.blood && (force || !String(person.bloodGroup || person.blood || '').trim())) {
        if (!person.bloodGroup) person.bloodGroup = facts.blood;
      }
      if (facts.serviceYear && (force || !String(person.serviceYear || '').trim())) person.serviceYear = facts.serviceYear;
      if (facts.lastAccept && (force || !String(person.lastAccept || '').trim())) person.lastAccept = facts.lastAccept;
      if (facts.zk && (force || !String(person.zk || '').trim())) person.zk = facts.zk;
      if (facts.posOrder && (force || !String(person.posOrder || '').trim())) person.posOrder = facts.posOrder;
      person._fromUnitArchive = true;
      try {
        if (window.kmPersonnelSyncBus) {
          window.kmPersonnelSyncBus.syncIdentityFromRow({
            name: person.name,
            code: person.postCode || facts.postCode,
            position: person.post || facts.post,
            unit: person.unit || facts.section
          });
        }
      } catch (eSync) {}
      return true;
    }
    
    function pushPersonToFormal(person, opts) {
      /* KM_PERSON_CARD_ARCHIVE_BIDI_V1_UT two-way: Person Card → formal sheet + troop */
      opts = opts || {};
      if (!person || !person.name || typeof db === 'undefined' || !db) return 0;
      var uid = activeUnitId(opts.unitId);
      if (!uid) return 0;
      var sheet = getSheet(uid);
      if (!sheet || !Array.isArray(sheet.rows)) return 0;
      var name = String(person.name || '').trim();
      var n = 0;
      var target = null;
      var targetRi = -1;
      for (var i = 0; i < sheet.rows.length; i++) {
        var r = sheet.rows[i];
        if (!r || r.type === 'title' || r.type === 'header' || r.type === 'section') continue;
        var cells = r.cells || [];
        var nm = String(cells[COL.name] || '').trim();
        if (!nm) continue;
        if (samePersonName(nm, name)) { target = r; targetRi = i; break; }
      }
      if (!target) return 0;
      if (!Array.isArray(target.cells)) target.cells = [];
      while (target.cells.length < 25) target.cells.push('');
      function setCell(ci, val) {
        if (val == null) return;
        var s = String(val).trim();
        if (!s && !opts.clearEmpty) return;
        target.cells[ci] = s;
        n++;
      }
      if (person.unit != null) setCell(COL.unit, person.unit);
      if (person.post != null) setCell(COL.position, person.post);
      if (person.seq != null) setCell(COL.seq, person.seq);
      if (person.secret != null) setCell(COL.secret, (typeof kmNormalizeSecretClass==='function'?kmNormalizeSecretClass(person.secret):person.secret)); /* KM_SECRET_NO_LITER_V1_SET */
      if (person.vus != null) setCell(COL.vus, person.vus);
      if (person.postCode != null || person.code != null) setCell(COL.code, person.postCode || person.code);
      if (person.rankSlot != null) setCell(COL.rankSlot, person.rankSlot);
      if (person.rank != null) setCell(COL.rank, person.rank);
      setCell(COL.name, name);
      if (person.phone != null || person.contact != null) setCell(COL.contact, person.phone || person.contact);
      if (person.birth != null) setCell(COL.birth, person.birth);
      if (person.address != null) setCell(COL.address, person.address);
      if (person.idCard != null) setCell(COL.idCard, person.idCard);
      if (person.bloodGroup != null || person.blood != null) setCell(COL.blood, person.bloodGroup || person.blood);
      if (person.vacation != null) setCell(COL.vacation, person.vacation);
      if (person.contract != null) setCell(COL.contract, person.contract);
      if (person.zk != null) setCell(COL.zk, person.zk);
      if (person.serviceYear != null) setCell(COL.serviceYear, person.serviceYear);
      if (person.lastAccept != null) setCell(COL.lastAccept, person.lastAccept);
      sheet.updatedAt = new Date().toISOString();
      try {
        if (!db.troopStructure) db.troopStructure = { staff: { rows: [] } };
        if (!db.troopStructure.staff) db.troopStructure.staff = { rows: [] };
        var trows = db.troopStructure.staff.rows || [];
        trows.forEach(function (tr) {
          if (!tr || tr.type === 'section') return;
          if (!samePersonName(tr.name, name)) return;
          if (person.unit != null) tr.unit = person.unit;
          if (person.post != null) tr.position = person.post;
          if (person.seq != null) tr.seq = person.seq;
          if (person.secret != null) tr.secret = person.secret;
          if (person.vus != null) tr.vus = person.vus;
          if (person.postCode != null || person.code != null) tr.code = person.postCode || person.code;
          if (person.rankSlot != null) tr.rankSlot = person.rankSlot;
          if (person.rank != null) tr.rank = person.rank;
          if (person.phone != null) tr.contact = person.phone;
          if (person.birth != null) tr.birth = person.birth;
          if (person.address != null) tr.address = person.address;
          if (person.idCard != null) tr.idCard = person.idCard;
          if (person.bloodGroup != null) tr.blood = person.bloodGroup;
          if (person.vacation != null) tr.vacation = person.vacation;
          if (person.contract != null) tr.contract = person.contract;
          tr._shtatDirty = true;
        });
      } catch (eT) {}
      try {
        if (typeof window.kmSyncTroopStaffToArchive === 'function') {
          /* troop already updated; formal is source — optional reverse not needed */
        }
      } catch (eS) {}
      try {
        if (window._kmUnitArchiveActiveSheet && String(window._kmUnitArchiveActiveUnitId || '') === String(uid)) {
          window._kmUnitArchiveActiveSheet = sheet;
        }
      } catch (eA) {}
      return n;
    }
return {
      marker: 'KM_UNIT_ARCHIVE_UNIFIED_SOURCE_V1',
      /* KM_PERSON_CARD_ARCHIVE_FIELDS_V1 / KM_PERSON_CARD_ARCHIVE_BIDI_V1_UT */
      COL: COL,
      getSheet: getSheet,
      rows: rows,
      people: people,
      posts: posts,
      codes: codes,
      hasFormal: hasFormal,
      activeUnitId: activeUnitId,
      findRowByName: findRowByName,
      factsForPerson: factsForPerson,
      applyFactsToPerson: applyFactsToPerson,
      pushPersonToFormal: pushPersonToFormal,
      ensure: function (unitId) {
        try {
          if (typeof window.kmEnsureHtmlV7UnitArchive === 'function') {
            return window.kmEnsureHtmlV7UnitArchive({ unitId: unitId });
          }
        } catch (eEns) {}
        return getSheet(unitId);
      }
    };
  })();
  
  
  /* KM_UNIFIED_ARCHIVE_FLOW_V1_HAS_STAFF — formal Unit Archive only (corps+unit via kmGetOrgContext / active unit) */
  window.kmUnitHasStaffSource = function (unitId) {
    try {
      if (window.kmUnitArchiveStaffSource && window.kmUnitArchiveStaffSource.hasFormal &&
          window.kmUnitArchiveStaffSource.hasFormal(unitId)) return true;
    } catch (e0) {}
    try {
      if (typeof db !== 'undefined' && db && db.unitFormalArchives) {
        var uid = String(unitId != null && String(unitId) !== '' ? unitId : '').trim();
        if (!uid) {
          try {
            var ctx = typeof window.kmGetOrgContext === 'function' ? window.kmGetOrgContext() : null;
            uid = String((ctx && ctx.unitId) || window._kmArchiveForUnitId || '').trim();
          } catch (eC) {}
        }
        var sh = uid ? db.unitFormalArchives[uid] : null;
        if (sh && Array.isArray(sh.rows) && sh.rows.length) return true;
      }
    } catch (e1) {}
    return false;
  };
  window.kmUnitFormalActive = function (unitId) {
    try {
      return !!(window.kmUnitArchiveStaffSource && window.kmUnitArchiveStaffSource.hasFormal &&
        window.kmUnitArchiveStaffSource.hasFormal(unitId));
    } catch (e) { return false; }
  };
  window.__kmUnitHasExcelArchiveLegacy = function () { return false; };
  try { window.kmUnitHasExcelArchive = function () { return false; }; } catch (eX) {}

/* KM_UNIFIED_ARCHIVE_FLOW_V2_HAS_STAFF */
  window.kmUnitHasExcelArchive = function () { /* KM_UNIFIED_ARCHIVE_FLOW_V1_UT excel disabled */ return false; };
  window.__kmUnitHasExcelArchiveLegacy = function () { return false; };
  window.kmUnitHasStaffSource = function (unitId) {
    try {
      if (window.kmUnitArchiveStaffSource && window.kmUnitArchiveStaffSource.hasFormal &&
          window.kmUnitArchiveStaffSource.hasFormal(unitId)) return true;
    } catch (e0) {}
    try {
      if (typeof db !== 'undefined' && db && db.unitFormalArchives) {
        var uid = String(unitId != null && String(unitId) !== '' ? unitId : '').trim();
        if (!uid) {
          try {
            var ctx = typeof window.kmGetOrgContext === 'function' ? window.kmGetOrgContext() : null;
            uid = String((ctx && ctx.unitId) || window._kmArchiveForUnitId || '').trim();
          } catch (eC) {}
        }
        var sh = uid ? db.unitFormalArchives[uid] : null;
        if (sh && Array.isArray(sh.rows) && sh.rows.length) return true;
      }
    } catch (e1) {}
    /* KM_UNIFIED_ARCHIVE_FLOW_V1_UT no excel staff */
    return false;
  };
  window.kmUnitFormalActive = function (unitId) {
    try {
      return !!(window.kmUnitArchiveStaffSource && window.kmUnitArchiveStaffSource.hasFormal &&
        window.kmUnitArchiveStaffSource.hasFormal(unitId));
    } catch (e) { return false; }
  };

/* KM_PERSON_CARD_ARCHIVE_FIELDS_V1 */
  window.kmArchiveFactsForPerson = function (personOrName, unitId) {
    try {
      return window.kmUnitArchiveStaffSource.factsForPerson(personOrName, unitId);
    } catch (e) { return null; }
  };
  window.kmApplyUnitArchiveToPerson = function (person, opts) {
    try {
      return window.kmUnitArchiveStaffSource.applyFactsToPerson(person, opts || {});
    } catch (e2) { return false; }
  };
  window.kmPushPersonCardToUnitArchive = function (person, opts) {
    /* KM_PERSON_CARD_ARCHIVE_BIDI_V1_UT */
    try {
      return window.kmUnitArchiveStaffSource.pushPersonToFormal(person, opts || {});
    } catch (e3) { return 0; }
  };


      function scopedArchivePeople() {
    /* KM_UNIFIED_ARCHIVE_FLOW_V1_SCOPED */
    try {
      if (window.kmUnitArchiveStaffSource && window.kmUnitArchiveStaffSource.hasFormal &&
          window.kmUnitArchiveStaffSource.hasFormal()) {
        return window.kmUnitArchiveStaffSource.people() || [];
      }
    } catch (eUF) {}
    try {
      if (typeof window.kmPeopleRoster === 'function') {
        var roster = window.kmPeopleRoster() || [];
        if (roster.length) return roster;
      }
    } catch (eR) {}
    return [];
  }
  function peopleList() {
    var now = Date.now();
    if (_peopleListCache.list && (now - (_peopleListCache.at || 0)) < 700) return _peopleListCache.list;
    var list = scopedArchivePeople().filter(function (p) {
      var n = String((p && p.name) || '').trim();
      if (!n) return false;
      if (typeof window.kmLooksLikePersonName === 'function') return window.kmLooksLikePersonName(n);
      return /[Ա-Ֆա-ֆA-Za-z]/.test(n);
    });
    _peopleListCache = { at: now, list: list };
    return list;
  }
  function applyUnitArchivesToAccounting() {
    /* KM_UI_UNFREEZE_V1: never block the hub paint — apply after first frame */
    try {
      var go = function () {
        if (typeof window.kmApplyArchivesToAccounting === 'function') {
          window.kmApplyArchivesToAccounting({ forceTroop: false });
        }
      };
      var start = function () {
        var uid = '';
        try {
          var ctx = typeof window.kmGetOrgContext === 'function' ? window.kmGetOrgContext() : null;
          uid = String((ctx && ctx.unitId) || '').trim();
        } catch (eC) {}
        if (uid && typeof window.kmEnsureUnitArchiveRows === 'function') {
          Promise.resolve(window.kmEnsureUnitArchiveRows(uid, { skipNetwork: true })).then(go).catch(go);
        } else go();
      };
      if (typeof requestIdleCallback === 'function') requestIdleCallback(start, { timeout: 1200 });
      else setTimeout(start, 0);
    } catch (eA) {}
  }
  function archiveSourceMuted() {
    return 'Ա․Ա․Հ-ները վերցվում են <b style="color:#c62828">Զորամասի Արխիվ</b>-ից (Unit Archive · առանց Excel)';
  }
  function findPerson(name) {
    var n = String(name || '').trim();
    var p = peopleList().find(function (x) { return String(x.name || '').trim() === n; });
    return p || { name: n, rank: '', unit: '', endDate: '', phone: '', note: '', post: '' };
  }
  /** Պաշտոն արխիվից ավտոլրացում էլ. քարտադարանի դատարկ դաշտերի համար */
  function samePersonName(a, b) {
    if (typeof window.kmVacationSamePerson === 'function') {
      try { return !!window.kmVacationSamePerson(a, b); } catch (e0) {}
    }
    return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  }
  function troopRowByName(name, post) {
    name = String(name || '').trim();
    post = String(post || '').trim();
    if (!name) return null;
    try {
      var rows = (((typeof db !== 'undefined' && db.troopStructure) || {}).staff || {}).rows || [];
      var nameOnly = null;
      var i, r;
      for (i = 0; i < rows.length; i++) {
        r = rows[i];
        if (!r || !samePersonName(r.name, name)) continue;
        if (post && String(r.position || '').trim() === post) return r;
        if (!nameOnly) nameOnly = r;
      }
      return nameOnly;
    } catch (e) {
      return null;
    }
  }
  function archiveEduSpecFor(name, post) {
    name = String(name || '').trim();
    post = String(post || '').trim();
    var out = { education: '', specialty: '', post: '' };
    if (!name) return out;
    try {
      var rows = typeof window.kmAllPositionArchiveRows === 'function'
        ? (window.kmAllPositionArchiveRows() || [])
        : [];
      var nameOnly = null;
      var both = null;
      rows.forEach(function (r) {
        if (!r || !r.sourceName || !samePersonName(r.sourceName, name)) return;
        var postOk = !post || String(r.position || '').trim() === post;
        if (postOk) both = r;
        if (!nameOnly) nameOnly = r;
      });
      var hit = both || nameOnly;
      if (hit) {
        out.education = String(hit.education || '').trim();
        out.specialty = (typeof window.kmSpecialtyFromArchiveRow === 'function')
          ? window.kmSpecialtyFromArchiveRow(hit, hit.code)
          : String(hit.vus || '').trim();
        if (out.specialty && hit.code && out.specialty === String(hit.code).trim()) out.specialty = '';
        out.post = String(hit.position || '').trim();
      }
    } catch (e1) {}
    return out;
  }
  function posByNameMap() {
    var map = Object.create(null);
    try {
      if (typeof window.kmPeopleFromPositions === 'function') {
        (window.kmPeopleFromPositions() || []).forEach(function (x) {
          var n = String((x && x.name) || '').trim();
          if (!n) return;
          map[n.toLowerCase()] = x;
        });
      }
    } catch (e) {}
    return map;
  }
  function dossierFromPositions(name, person, posMap) {
    window.kmUnitEnsureStores();
    try{ if(typeof window.kmRefillSecretFromSeedAndTroop==='function') window.kmRefillSecretFromSeedAndTroop(); }catch(_sw){} /* KM_SECRET_TROOP_V2_CALL */
    name = String(name || '').trim();
    var d = (db.unitDossiers && db.unitDossiers[name]) || {};
    var p = person || findPerson(name) || {};
    var post = String(d.post || '').trim();
    var edu = String(d.education || '').trim();
    var spec = '';
    var fam = String(d.family || '').trim() || String(p.familyStatus || p.family || '').trim();
    var code = '';
    var rankSlot = '';
    var hit = null;
    if (posMap) {
      hit = posMap[name.toLowerCase()] || null;
    } else if (typeof window.kmPeopleFromPositions === 'function') {
      try {
        hit = (window.kmPeopleFromPositions() || []).find(function (x) {
          return String(x.name || '').trim() === name;
        }) || null;
      } catch (e) {}
    }
    if (hit) {
      if (!post) post = String(hit.post || '').trim();
      if (!p.rank && hit.rank) p.rank = hit.rank;
      if (!p.unit && hit.unit) p.unit = hit.unit;
      if (hit.rankSlot) rankSlot = String(hit.rankSlot || '').trim();
      if (hit.code || hit.postCode) code = String(hit.code || hit.postCode || '').trim();
      if (hit.posId && !d.posId) d.posId = hit.posId;
      if (!edu) edu = String(hit.education || '').trim();
      spec = String(hit.specialty || hit.vus || '').trim();
    }
    var archHit = archiveEduSpecFor(name, post);
    if (archHit) {
      if (archHit.education) edu = archHit.education;
      if (archHit.specialty) spec = archHit.specialty;
      if (archHit.post) post = archHit.post;
    }
    var tRow = troopRowByName(name, post);
    if (tRow) {
      if (!post) post = String(tRow.position || '').trim();
      if (!edu) edu = String(tRow.education || '').trim();
      if (!spec) spec = (typeof window.kmSpecialtyFromArchiveRow === 'function')
        ? window.kmSpecialtyFromArchiveRow(tRow, tRow.code)
        : String(tRow.vus || '').trim();
      if (!code) code = String(tRow.code || '').trim();
      if (!rankSlot) rankSlot = String(tRow.rankSlot || '').trim();
      if (!p.rank && tRow.rank) p.rank = tRow.rank;
      if (!p.unit && tRow.unit) p.unit = tRow.unit;
    }
    if (!post) post = String(p.post || '').trim();
    if (!edu) edu = String(p.education || '').trim();
    if (!spec) spec = String(p.specialty || '').trim();
    if (!code) code = String(d.postCode || p.postCode || '').trim();
    if (!rankSlot) rankSlot = String(d.rankSlot || '').trim();
    if (code && spec === code) spec = '';
    var next = {
      education: edu || '',
      specialty: spec || '',
      post: post || '',
      postCode: code || '',
      rankSlot: rankSlot || '',
      posId: d.posId || (hit && hit.posId) || '',
      family: fam || d.family || '',
      note: d.note || ''
    };
    return next;
  }
  function applyDossierAutoFill(name, next, person) {
    if (!name || !next) return null;
    window.kmUnitEnsureStores();
    var d = db.unitDossiers[name] || {};
    var changed = !db.unitDossiers[name];
    var merged = {
      education: next.education || String(d.education || '').trim() || '',
      specialty: next.specialty || '',
      post: next.post || String(d.post || '').trim() || '',
      postCode: next.postCode || '',
      rankSlot: next.rankSlot || String(d.rankSlot || '').trim() || '',
      posId: d.posId || next.posId || '',
      family: String(d.family || '').trim() || next.family || '',
      note: d.note || ''
    };
    if (merged.postCode && merged.specialty === merged.postCode) merged.specialty = '';
    ['education', 'specialty', 'post', 'postCode', 'rankSlot', 'posId', 'family'].forEach(function (k) {
      if (String(d[k] || '') !== String(merged[k] || '')) changed = true;
    });
    if (changed) db.unitDossiers[name] = merged;
    if (person) {
      if (merged.education) person.education = merged.education;
      person.specialty = merged.specialty || '';
      if (merged.post) person.post = merged.post;
      if (merged.postCode) {
        person.postCode = merged.postCode;
        person.posCode = merged.postCode;
      }
    }
    merged.__changed = changed;
    return merged;
  }
  function peopleSelect(id, selected, extraAttr) {
    /* KM_UNIFIED_ARCHIVE_SOURCE_V1_UT datalist from Unit Archive posts */
    var listId = id + 'List';
    var list = peopleList();
    if (list.length > 800) list = list.slice(0, 800);
    var opts = list.map(function (p) {
      var name = String(p.name || '').trim();
      if (!name) return '';
      var post = String(p.post || p.position || '').trim();
      var code = String(p.postCode || p.code || '').trim();
      var label = post ? (name + ' — ' + post + (code ? (' (' + code + ')') : '')) : name;
      return '<option value="' + esc(name) + '" label="' + esc(label) + '">' + esc(label) + '</option>';
    }).join('');
    return '<input id="' + id + '" class="kmAahInput" data-km-allow-edit="1" type="text" list="' + listId +
      '" value="' + esc(selected || '') +
      '" placeholder="գրեք Ա․Ա․Հ" autocomplete="off" spellcheck="false" ' +
      'style="min-width:280px;pointer-events:auto" ' + (extraAttr || '') + '>' +
      '<datalist id="' + listId + '" data-km-i18n-skip>' + opts + '</datalist>';
  }
  function formalMeta() {
    var s = (typeof db !== 'undefined' && db.settings && typeof db.settings === 'object') ? db.settings : {};
    return {
      unitCode: String(s.unitCode || s.unitShort || 'ՀՀՊՆ 25836').trim() || 'ՀՀՊՆ 25836',
      unitName: String(s.unitName || 'ՀՀ ՊՆ 25836 զորամաս').trim() || 'ՀՀ ՊՆ 25836 զորամաս',
      cmdRank: String(s.commanderRank || 'գ-տ').trim() || 'գ-տ',
      cmdName: String(s.commanderName || 'Գ.Դալլաքյան').trim() || 'Գ.Դալլաքյան',
      cmdDative: String(s.commanderDative || (s.commanderName ? (String(s.commanderName).replace(/ին$/, '') + 'ին') : 'Գ.Դալլաքյանին')).trim()
    };
  }
  function shortSignName(full) {
    var parts = String(full || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '____________';
    if (parts.length === 1) return parts[0];
    var last = parts[parts.length - 1];
    var first = parts[0];
    return (first.charAt(0) + '.' + last).replace(/\.\./g, '.');
  }
  function dossierBits(person) {
    var name = String((person && person.name) || '').trim();
    var d = {};
    try {
      d = (typeof db !== 'undefined' && db.unitDossiers && db.unitDossiers[name]) || {};
    } catch (e) {}
    return {
      post: String((person && person.post) || d.post || '').trim(),
      education: String((person && person.education) || d.education || '').trim(),
      family: String((person && (person.familyStatus || person.family)) || d.family || '').trim(),
      birth: String((person && (person.birthDate || person.born)) || d.birth || '').trim(),
      nation: String((person && person.nation) || d.nation || 'հայ').trim(),
      party: String((person && person.party) || d.party || 'անկուսակցական').trim()
    };
  }
  function unitsFromPeople() {
    var set = {};
    peopleList().forEach(function (p) {
      var u = String(p.unit || '').trim() || 'Անհայտ';
      set[u] = true;
    });
    return Object.keys(set).sort();
  }
  async function persist(silent) {
    if (typeof save === 'function') await save(!!silent);
  }
  function toastOk(msg) {
    if (typeof window.kmNotify === 'function') window.kmNotify(msg, 'ok');
    else if (typeof toast === 'function') toast(msg);
  }
  function toastErr(msg) {
    if (typeof window.kmNotify === 'function') window.kmNotify(msg, 'error');
    else if (typeof toast === 'function') toast(msg, 'error');
  }

  window.kmUnitEnsureStores = function () {
    if (typeof db === 'undefined') return;
    if (!Array.isArray(db.unitReserveArchive)) db.unitReserveArchive = []; /* KM_RESERVE_ARCHIVE_V1 */
    if (!Array.isArray(db.unitDocs)) db.unitDocs = [];
    if (!Array.isArray(db.unitInventory)) db.unitInventory = [];
    if (!Array.isArray(db.unitInventoryServices)) db.unitInventoryServices = []; /* KM_INV_SERVICES_V1 */
    if (!Array.isArray(db.unitInventoryDocs)) db.unitInventoryDocs = []; /* KM_INV_DOCS_V1 */
    if (!Array.isArray(db.unitInventorySubdivisions)) db.unitInventorySubdivisions = []; /* KM_INV_SUB_MANUAL_V1 */
    if (!Array.isArray(db.unitCharDrafts)) db.unitCharDrafts = [];
    if (!Array.isArray(db.unitFuel)) db.unitFuel = [];
    if (!Array.isArray(db.unitDayPlans)) db.unitDayPlans = [];
    if (!Array.isArray(db.unitMedical)) db.unitMedical = [];
    if (!db.unitLeavePlan || typeof db.unitLeavePlan !== 'object') {
      db.unitLeavePlan = { maxAbsentPct: 20, rows: [] };
    }
    if (!Array.isArray(db.unitLeavePlan.rows)) db.unitLeavePlan.rows = [];
    if (db.unitLeavePlan.maxAbsentPct == null) db.unitLeavePlan.maxAbsentPct = 20;
    if (!Array.isArray(db.unitBlanks)) db.unitBlanks = [];
    if (!db.unitDossiers || typeof db.unitDossiers !== 'object' || Array.isArray(db.unitDossiers)) {
      db.unitDossiers = {};
    }
    if (!Array.isArray(db.unitFormation)) db.unitFormation = [];
    if (!db.unitTermWatch || typeof db.unitTermWatch !== 'object') {
      db.unitTermWatch = { warnDays: 30, ranks: [], dismissed: [] };
    }
    if (!Array.isArray(db.unitTermWatch.ranks)) db.unitTermWatch.ranks = [];
    if (!Array.isArray(db.unitTermWatch.dismissed)) db.unitTermWatch.dismissed = [];
    if (db.unitTermWatch.warnDays == null) db.unitTermWatch.warnDays = 30;
  };

  function injectCss() {
    if (document.getElementById('km-unit-tools-css')) return;
    var s = document.createElement('style');
    s.id = 'km-unit-tools-css';
    s.textContent =
      '.kmUtShell{display:flex;flex-direction:column;gap:12px}' +
      '.kmUtBar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between}' +
      '.kmUtForm{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;padding:12px;background:#f4f7f9;border:1px solid #d7e0e7;border-radius:10px}' +
      '.kmUtForm label{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700;color:#334}' +
      '.kmUtForm input,.kmUtForm select,.kmUtForm textarea{padding:8px 10px;border:1px solid #c5d0da;border-radius:7px;min-width:140px;background:#fff;font:inherit}' +
      '.kmUtForm textarea{min-width:220px;min-height:70px}' +
      '.kmUtTable{width:100%;border-collapse:collapse;font-size:13px}' +
      '.kmUtTable th,.kmUtTable td{border:1px solid #d5dee6;padding:7px 8px;text-align:left;vertical-align:top}' +
      '.kmUtTable th{background:#e8eef3;font-weight:700}' +
      '.kmUtTable tr.warn{background:#fff4e5}' +
      '.kmUtTable tr.danger{background:#fde8e8}' +
      '.kmUtTable tr.kmUtSec{background:#eef4f8}.kmUtTable tr.kmUtFormDataRow.is-selected{outline:2px solid #1a8fa0;background:#f0fafb}' +
      '.kmUtTable tr.kmUtSec td{border-top:2px solid #c5d0da;font-size:12.5px}' +
      '.kmUtActions{display:flex;flex-wrap:wrap;gap:6px}' +
      '.kmUtMuted{color:#667788;font-size:12px}' +
      '.kmUtAlert{padding:10px 12px;border-radius:8px;background:#fff4e5;border:1px solid #f0c36d;margin:0 0 10px}' +
      '.kmUtAlert.danger{background:#fde8e8;border-color:#e8a0a0}' +
      '.kmUtAlert.ok{background:#e8f6ee;border-color:#9dceb0}' +
      '.kmUtGantt{overflow:auto;border:1px solid #d5dee6;border-radius:8px;background:#fff}' +
      '.kmUtGanttRow{display:grid;grid-template-columns:160px 1fr;min-height:28px;border-bottom:1px solid #eef2f5}' +
      '.kmUtGanttName{padding:4px 8px;font-size:12px;background:#f7fafc;border-right:1px solid #e2e8ef;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.kmUtGanttTrack{position:relative;height:28px;background:repeating-linear-gradient(90deg,#fafcfd 0,#fafcfd calc(100%/30 - 1px),#e8eef3 calc(100%/30 - 1px),#e8eef3 calc(100%/30))}' +
      '.kmUtGanttBar{position:absolute;top:4px;height:20px;border-radius:4px;background:#3d6b7a;color:#fff;font-size:10px;line-height:20px;padding:0 4px;overflow:hidden;white-space:nowrap}' +
      '.kmUtGanttBar.over{background:#a33}' +
      '.kmUtPrint{position:fixed;inset:0;z-index:700000;background:rgba(15,23,42,.55);display:flex;align-items:stretch;justify-content:center;padding:12px}' +
      '.kmUtPrintCard{flex:1;max-width:900px;background:#fff;border-radius:12px;display:flex;flex-direction:column;overflow:hidden}' +
      '.kmUtPrintTop{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid #e2e8ef;background:#f8fafc}' +
      '.kmUtPrintBody{padding:18px 22px;overflow:auto;flex:1;font-size:14px;line-height:1.45}' +
      '.kmUtPrintBody h2{margin:0 0 12px;text-align:center}' +
      '.kmUtPrintBody table{width:100%;border-collapse:collapse;margin-top:10px}' +
      '.kmUtPrintBody th,.kmUtPrintBody td{border:1px solid #333;padding:6px}' +
      '@media print{' +'body.kmPrintingUnit>*:not(#kmUtPrint){display:none!important}' +'body.kmPrintingUnit #kmUtPrint{position:static!important;inset:auto!important;background:none!important;padding:0!important;display:block!important}' +'body.kmPrintingUnit .kmUtPrintTop{display:none!important}' +'body.kmPrintingUnit .kmUtPrintCard{box-shadow:none!important;max-width:none!important;border-radius:0!important;overflow:visible!important}' +'body.kmPrintingUnit .kmUtPrintBody{padding:0!important;overflow:visible!important;font-size:11px!important}' +'body.kmPrintingUnit table.kmUtFormPrint{table-layout:fixed!important;width:100%!important;border-collapse:collapse!important;font-size:10.5px!important}' +'body.kmPrintingUnit table.kmUtFormPrint th,body.kmPrintingUnit table.kmUtFormPrint td{' +'border:0.4pt solid #222!important;padding:3px 2px!important;vertical-align:middle!important;text-align:center!important;' +'word-wrap:break-word!important;overflow-wrap:anywhere!important;line-height:1.15!important;font-weight:600!important}' +'body.kmPrintingUnit table.kmUtFormPrint th:first-child,body.kmPrintingUnit table.kmUtFormPrint td:first-child{text-align:left!important;width:16%!important}' +'body.kmPrintingUnit .kmUtFormPrintTitle{font-size:16px!important;margin:0 0 6px!important;text-align:center!important}' +'@page{size:A4 landscape;margin:8mm}' +'}' +'.kmUtPrintBody table.kmUtFormPrint{table-layout:fixed;width:100%;border-collapse:collapse;font-size:12px}' +'.kmUtPrintBody table.kmUtFormPrint th,.kmUtPrintBody table.kmUtFormPrint td{' +'border:1px solid #333;padding:5px 4px;vertical-align:middle;text-align:center;' +'word-wrap:break-word;overflow-wrap:anywhere;line-height:1.2;hyphens:auto}' +'.kmUtPrintBody table.kmUtFormPrint th:first-child,.kmUtPrintBody table.kmUtFormPrint td:first-child{text-align:left;width:16%}' +'.kmUtTable th{word-wrap:break-word;overflow-wrap:anywhere;line-height:1.2;vertical-align:middle}' +
      '.kmUtHomeAlerts{margin:0 0 12px}' +
      '.kmUtHomeAlerts .kmUtAlert{cursor:pointer}';
    document.head.appendChild(s);
  }

  function shell(title, bodyHtml, extraBar, mutedHtml) {
    injectCss();
    return '<div class="card kmUtShell">' +
      '<div class="kmUtBar">' +
        '<div><h3 style="margin:0">' + esc(title) + '</h3>' +
        '<div class="kmUtMuted">' + (mutedHtml || 'Քիչ դաշտ · անձնակազմից ընտրություն · տպում') + '</div></div>' +
        '<div class="kmUtActions">' +
          (extraBar || '') +
          '<button type="button" class="kmBackBtn" onclick="' + (title === PAGES.unitInventory ? 'kmUnitInvHeaderBack()' : (title === PAGES.unitHamalr ? 'kmUnitHamHeaderBack()' : 'kmReportsBack()')) /* KM_BACK_AUDIT_V1 */ /* KM_HAMALR_MOVE_V1 */ + '">' + ((typeof window.KM_BACK_LABEL === 'string' && window.KM_BACK_LABEL) || '← Վերադարձ') + '</button>' +
        '</div>' +
      '</div>' + bodyHtml + '</div>';
  }

  function openPrint(title, htmlBody) {
    injectCss();
    var old = document.getElementById('kmUtPrint');
    if (old) old.remove();
    document.body.classList.remove('kmPrintingUnit');
    var wrap = document.createElement('div');
    wrap.id = 'kmUtPrint';
    wrap.className = 'kmUtPrint';
    wrap.innerHTML =
      '<div class="kmUtPrintCard">' +
        '<div class="kmUtPrintTop">' +
          '<b>' + esc(title) + '</b>' +
          '<div class="kmUtActions">' +
            '<button type="button" class="primary" id="kmUtDoPrint">Տպել</button>' +
            '<button type="button" id="kmUtDlDoc">Word (.doc)</button>' +
            '<button type="button" class="kmBackBtn" id="kmUtClosePrint">' + ((typeof window.KM_BACK_LABEL === 'string' && window.KM_BACK_LABEL) || '← Վերադարձ') + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="kmUtPrintBody" id="kmUtPrintBody">' + htmlBody + '</div>' +
      '</div>';
    document.body.appendChild(wrap);
    var clearPrintMode = function () {
      document.body.classList.remove('kmPrintingUnit');
      window.removeEventListener('afterprint', clearPrintMode);
    };
    wrap.querySelector('#kmUtClosePrint').onclick = function () {
      clearPrintMode();
      wrap.remove();
    };
    wrap.querySelector('#kmUtDoPrint').onclick = function () {
      document.body.classList.add('kmPrintingUnit');
      window.addEventListener('afterprint', clearPrintMode);
      try { window.print(); } catch (e) {
        clearPrintMode();
        toastErr('Տպել չհաջողվեց');
      }
      setTimeout(clearPrintMode, 1500);
    };
    wrap.querySelector('#kmUtDlDoc').onclick = function () {
      downloadDoc(title, document.getElementById('kmUtPrintBody').innerHTML);
    };
  }

  function downloadDoc(name, htmlInner) {
    var html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>' +
      esc(name) + '</title></head><body>' + htmlInner + '</body></html>';
    var blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = String(name || 'KM').replace(/[^\w\u0531-\u0556\u0561-\u0587\-]+/g, '_') + '.doc';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 800);
    toastOk('Word ֆայլը պատրաստ է');
  }

  window.kmUnitPages = PAGES;
  window.kmUnitOpen = function (page) {
    page = String(page || '');
    if (page === 'unitDossiers') {
      if (typeof window.kmOpenPersonnelHub === 'function') {
        window.kmOpenPersonnelHub({ tab: 'people' });
        return;
      }
      if (typeof window.kmOpenPage === 'function') {
        window.kmOpenPage('people');
        return;
      }
    }
    if (window.kmUserRole === 'editor' && Array.isArray(window.kmEditSections) && typeof window.kmCanAccessPage === 'function') {
      if (!window.kmCanAccessPage(page)) {
        if (typeof toast === 'function') toast('Այս բաժինը ձեզ թույլատրված չէ', 'error');
        else if (typeof window.kmNotify === 'function') window.kmNotify('Այս բաժինը ձեզ թույլատրված չէ', 'warn');
        return;
      }
    }
    try { window.page = page; } catch (eP) {}
    window.kmUnitEnsureStores();
    injectCss();
    var h = host();
    if (!h) return;
    try { if (typeof window.kmPurgeAccountingIfNoArchive === 'function') window.kmPurgeAccountingIfNoArchive(); } catch (ePur) {}
    /* KM_UNIFIED_ARCHIVE_SOURCE_V1_UT page gate */
    var __hasStaff = false;
    try {
      if (typeof window.kmUnitHasStaffSource === 'function') __hasStaff = !!window.kmUnitHasStaffSource();
      else if (window.kmUnitArchiveStaffSource && window.kmUnitArchiveStaffSource.hasFormal && window.kmUnitArchiveStaffSource.hasFormal()) __hasStaff = true;
      else if (typeof window.kmUnitHasExcelArchive === 'function') __hasStaff = !!window.kmUnitHasExcelArchive();
    } catch (eHS) { __hasStaff = false; }
    if (!__hasStaff &&
        (page === 'unitMedical' || page === 'unitLeavePlan' || page === 'unitFormation' || page === 'unitTermWatch' || page === 'unitDossiers' || page === 'unitDocs' || page === 'unitCharDrafts' || page === 'unitBlanks')) {
      h.innerHTML = (typeof window.kmBackToolbar === 'function' ? window.kmBackToolbar("kmReportsBack()") : '') +
        (typeof window.kmArchiveRequiredBanner === 'function' ? window.kmArchiveRequiredBanner() : '<div class="card"><b>Այս զորամասի արխիվում տվյալ չկա</b></div>');
      return;
    }
    var map = {
      unitDocs: renderDocs,
      unitInventory: renderInventory,
      unitHamalr: renderHamalr, /* KM_HAMALR_MOVE_V1 */
      unitCharDrafts: renderChar,
      unitFuel: renderFuel,
      unitDayPlans: renderDayPlans,
      unitMedical: renderMedical,
      unitLeavePlan: renderLeavePlan,
      unitBlanks: renderBlanks,
      unitDossiers: renderDossiers,
      unitFormation: renderFormation,
      unitTermWatch: renderTerms,
      unitBadDays: renderBadDays,
    unitReserve: function (root) { if (window.kmRenderUnitReserve) window.kmRenderUnitReserve(root); } /* KM_RESERVE_ARCHIVE_V1 */
    };
    var fn = map[page];
    if (fn) fn(h);
    else toastErr('Անհայտ բաժին');
    if (typeof window.kmApplyRoleGuard === 'function') window.kmApplyRoleGuard();
    try {
      h.querySelectorAll('.kmAahInput,[data-km-allow-edit="1"]').forEach(function (el) {
        if (canEdit()) {
          el.disabled = false;
          el.readOnly = false;
          el.removeAttribute('readonly');
          el.removeAttribute('disabled');
        }
      });
    } catch (eU) {}
  };

  /* ——— 1 Docs ——— */
  function buildDocText(t, person, post, reason, from, to) {
    var meta = formalMeta();
    var rank = String(person.rank || '').trim();
    var name = String(person.name || '').trim();
    var unit = String(person.unit || '').trim();
    var postLine = String(post || person.post || '').trim();
    var posBlock = [meta.unitName + (postLine ? 'ի ' + postLine : (unit ? 'ի ' + unit : '')), rank, shortSignName(name)]
      .filter(Boolean);
    var footer =
      '\n\t\t\t' + fmtDate(todayIso()) + 'թ\t' + (posBlock[0] || meta.unitName) +
      '\n                                                          ' + (rank || '________') +
      '                              ' + shortSignName(name);
    var head =
      meta.unitCode + ' Զ/Մ հրամանատար\n' +
      '                                                                                              ' + meta.cmdRank + '    ' + meta.cmdDative +
      '\n\n\nԶեկուցագիր\n\n';
    var whoFull = [rank, name].filter(Boolean).join(' ');
    var bodyCore = '';
    if (t === 'leave') {
      bodyCore = 'Զեկուցում եմ Ձեզ այն մասին, որ ես՝ ' + whoFull +
        (postLine ? ', ' + postLine : '') +
        ', խնդրում եմ տրամադրել արձակուրդ ' + fmtDate(from) + '–' + fmtDate(to) +
        ' ժամանակահատվածում' + (reason ? '՝ ' + reason : '') + '։';
    } else if (t === 'medical') {
      bodyCore = 'Զեկուցում եմ Ձեզ այն մասին, որ ես՝ ' + whoFull +
        ', անհրաժեշտություն ունեմ բուժման / բուժկետ դիմելու ' +
        fmtDate(from) + '–' + fmtDate(to) + ' ժամանակահատվածում' +
        (reason ? '։ Պատճառ / ախտորոշում՝ ' + reason : '') + '։';
    } else if (t === 'transfer') {
      bodyCore = 'Զեկուցում եմ Ձեզ այն մասին, որ ես՝ ' + whoFull +
        ', խնդրում եմ տեղափոխում' + (reason ? '՝ ' + reason : '') +
        (from ? '։ Նշված ժամկետ՝ ' + fmtDate(from) + (to ? '–' + fmtDate(to) : '') : '') + '։';
    } else if (t === 'discharge') {
      bodyCore = 'Զեկուցում եմ Ձեզ այն մասին, որ ' +
        (reason ||
          'ծառայության եմ անցել ՀՀ ԶՈՒ-ում, ծառայության հետ կապված խնդիրներ չունեմ, առաջադրված խնդիրները կատարել եմ բարեխղճորեն, ուստի խնդրում եմ Ձեր միջնորդությունը վերադաս հրամանատարությանը արձակել ինձ ՀՀ ԶՈՒ պահեստազոր') +
        '։';
    } else {
      bodyCore = 'Զեկուցում եմ Ձեզ այն մասին, որ ' + (reason || '—') + '։';
    }
    return head + bodyCore + footer;
  }

  function renderDocs(h) {
    var rows = db.unitDocs.slice().reverse().map(function (d) {
      return '<tr><td>' + esc(d.templateTitle || d.template) + '</td><td>' + esc(d.person) + '</td><td>' +
        esc(fmtDate(d.createdAt)) + '</td><td class="kmUtActions">' +
        '<button type="button" onclick="kmUnitDocPrint(\'' + esc(d.id) + '\')">Տպել</button>' +
        (canEdit() ? '<button type="button" class="danger" onclick="kmUnitDocDel(\'' + esc(d.id) + '\')">Ջնջել</button>' : '') +
        '</td></tr>';
    }).join('') || '<tr><td colspan="4" class="kmUtMuted">Դեռ փաստաթուղթ չկա</td></tr>';
    h.innerHTML = shell(PAGES.unitDocs,
      (canEdit() ? '<div class="kmUtForm">' +
        '<label>Կաղապար<select id="kmUtDocTpl">' + DOC_TEMPLATES.map(function (t) {
          return '<option value="' + t.id + '">' + esc(t.title) + '</option>';
        }).join('') + '</select></label>' +
        '<label>Ա․Ա․Հ' + peopleSelect('kmUtDocPerson') + '</label>' +
        '<label>Պաշտոն<input id="kmUtDocPost" placeholder="պաշտոն"></label>' +
        '<label>Սկիզբ<input id="kmUtDocFrom" type="date" value="' + todayIso() + '"></label>' +
        '<label>Ավարտ<input id="kmUtDocTo" type="date" value="' + addDaysIso(todayIso(), 15) + '"></label>' +
        '<label>Պատճառ<textarea id="kmUtDocReason" placeholder="պատճառ / հիմք"></textarea></label>' +
        '<button type="button" class="primary" onclick="kmUnitDocSave()">Ստեղծել</button>' +
      '</div>' : '<p class="kmUtMuted">Դիտորդ՝ միայն տպում</p>') +
      '<div class="gridwrap"><table class="kmUtTable"><thead><tr><th>Տեսակ</th><th>Ա․Ա․Հ</th><th>Ամսաթիվ</th><th></th></tr></thead><tbody>' +
      rows + '</tbody></table></div>');
  }

  window.kmUnitDocSave = async function () {
    if (!canEdit()) return;
    window.kmUnitEnsureStores();
    var tpl = document.getElementById('kmUtDocTpl').value;
    var name = String(document.getElementById('kmUtDocPerson').value || '').trim();
    if (!name) { toastErr('Գրեք Ա․Ա․Հ'); return; }
    var meta = DOC_TEMPLATES.find(function (t) { return t.id === tpl; }) || DOC_TEMPLATES[0];
    var person = findPerson(name);
    var post = document.getElementById('kmUtDocPost').value.trim();
    var reason = document.getElementById('kmUtDocReason').value.trim();
    var from = document.getElementById('kmUtDocFrom').value;
    var to = document.getElementById('kmUtDocTo').value;
    var text = buildDocText(tpl, person, post, reason, from, to);
    db.unitDocs.push({
      id: uid('doc'), template: tpl, templateTitle: meta.title, person: name, rank: person.rank || '',
      unit: person.unit || '', post: post, reason: reason, from: from, to: to, text: text, createdAt: todayIso()
    });
    await persist(true);
    toastOk('Փաստաթուղթը ստեղծվեց');
    window.kmUnitOpen('unitDocs');
  };
  window.kmUnitDocDel = async function (id) {
    if (!canEdit()) return;
    if (!confirm('Ջնջե՞լ')) return;
    db.unitDocs = db.unitDocs.filter(function (d) { return d.id !== id; });
    await persist(true);
    window.kmUnitOpen('unitDocs');
  };
  window.kmUnitDocPrint = function (id) {
    var d = db.unitDocs.find(function (x) { return x.id === id; });
    if (!d) return;
    openPrint(d.templateTitle || 'Զեկուցագիր',
      '<h2>' + esc(d.templateTitle || '') + '</h2><pre style="white-space:pre-wrap;font:inherit">' + esc(d.text) + '</pre>');
  };

  /* ——— 2 Inventory ——— */
  /* KM_INV_SERVICES_V1 */
  var INV_DEFAULT_SERVICES = [
    { id: 'svc_comm', name: 'Կապի ծառայություն' },
    { id: 'svc_eng', name: 'Ինժեներական ծառայություն' },
    { id: 'svc_vknk', name: 'ՎՔՆԿ ծառայություն' },
    { id: 'svc_food', name: 'Պարենային ծառայություն' },
    { id: 'svc_other', name: 'Այլ' }
  ];

  function invCanManageServices() {
    try {
      if (typeof window.kmIsSuperAdmin === 'function' && window.kmIsSuperAdmin()) return true;
      if (window.kmSuperAdmin === true) return true;
      if (typeof window.kmCanAdmin === 'function' && window.kmCanAdmin()) return true;
    } catch (_a) {}
    try { var __ms = invPathWholeEdit('service'); if (__ms !== null) return __ms; } catch (eMS) {} /* KM_INV_SCOPE_GRANTS_V1 */
    return canEdit();
  }

  function invEnsureServices() {
    window.kmUnitEnsureStores();
    if (!Array.isArray(db.unitInventoryServices) || !db.unitInventoryServices.length) {
      db.unitInventoryServices = INV_DEFAULT_SERVICES.map(function (s) {
        return { id: s.id, name: s.name };
      });
    } else {
      // ensure default ids exist once (non-destructive)
      var have = Object.create(null);
      db.unitInventoryServices.forEach(function (s) {
        if (s && s.id) have[String(s.id)] = 1;
      });
      INV_DEFAULT_SERVICES.forEach(function (d) {
        if (!have[d.id]) db.unitInventoryServices.push({ id: d.id, name: d.name });
      });
    }
    return db.unitInventoryServices;
  }

  function invServiceById(id) {
    id = String(id || '').trim();
    var list = invEnsureServices();
    for (var i = 0; i < list.length; i++) {
      if (list[i] && String(list[i].id) === id) return list[i];
    }
    return null;
  }

  function invItemsForService(serviceId) {
    serviceId = String(serviceId || '').trim();
    var list = db.unitInventory || [];
    if (!serviceId) return list;
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (!m) continue;
      var sid = String(m.serviceId || '').trim() || 'svc_other';
      if (sid === serviceId) out.push(m);
    }
    return out;
  }

  function invBalance(serviceId) {
    var map = {};
    invItemsForService(serviceId).forEach(function (m) {
      var key = [m.category, m.name, m.unit || ''].join('|');
      if (!map[key]) map[key] = { category: m.category, name: m.name, unit: m.unit || '', qty: 0 };
      var q = Number(m.qty) || 0;
      if (m.kind === 'out') map[key].qty -= q;
      else map[key].qty += q;
    });
    return Object.keys(map).map(function (k) { return map[k]; });
  }

  function invServiceCounts() {
    var counts = Object.create(null);
    (db.unitInventory || []).forEach(function (m) {
      if (!m) return;
      var sid = String(m.serviceId || '').trim() || 'svc_other';
      counts[sid] = (counts[sid] || 0) + 1;
    });
    return counts;
  }


  /* KM_INV_PATH_ARCHIVE_V1 */
  function invNormHy(s) {
    return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toUpperCase();
  }
  function invActiveUnitId() {
    try {
      var c = typeof window.kmGetOrgContext === 'function' ? window.kmGetOrgContext() : null;
      if (c && c.unitId) return String(c.unitId).trim();
    } catch (e) {}
    try { if (window._kmArchiveForUnitId) return String(window._kmArchiveForUnitId).trim(); } catch (e2) {}
    return '';
  }
  function invArchiveSectionNames() { /* KM_INV_PATH_ARCHIVE_V2 */
    var names = [];
    var seen = Object.create(null);
    function add(n) {
      n = String(n == null ? '' : n).replace(/\s+/g, ' ').trim();
      if (!n || n.length < 2) return;
      if (/^\d+[.)]?$/.test(n)) return;
      var k = invNormHy(n);
      if (seen[k]) return;
      seen[k] = 1;
      names.push(n);
    }
    function cell0(r) {
      try {
        if (!r) return '';
        if (Array.isArray(r.cells)) return String(r.cells[0] || '').trim();
        if (Array.isArray(r)) return String(r[0] || '').trim();
        return '';
      } catch (eC) { return ''; }
    }
    var unitId = invActiveUnitId();
    try {
      var bags = (db && db.unitFormalArchives) || {};
      var sheet = unitId ? bags[unitId] : null;
      if (!sheet && unitId && window.kmIsHtmlV7UnitId && window.kmIsHtmlV7UnitId(unitId)) {
        sheet = bags.bk2_u1 || bags['25836'] || null;
      }
      if (!sheet) {
        var keys = Object.keys(bags || {});
        if (keys.length === 1) sheet = bags[keys[0]];
      }
      var rows = (sheet && Array.isArray(sheet.rows)) ? sheet.rows : [];
      rows.forEach(function (r) {
        if (!r) return;
        if (r.type === 'header' || r.type === 'title') return;
        if (r.type === 'section') {
          add(cell0(r) || r.unit || r.section || r.title || r.name);
          return;
        }
        if (Array.isArray(r)) {
          add(r[0]);
          return;
        }
        if (typeof r === 'object') {
          add(cell0(r));
          add(r.section || r.unit || r.subunit || r.subdivision || r.dept || r.service || '');
        }
      });
    } catch (eA) {}
    try {
      var src = window.kmUnitArchiveStaffSource;
      if (src && typeof src.rows === 'function') {
        (src.rows(unitId) || []).forEach(function (r) {
          if (!r) return;
          add(r.unit || r.section || '');
          if (r.type === 'section') add(r.unit || r.section || r.title || '');
        });
      }
      if (src && typeof src.people === 'function') {
        (src.people(unitId) || []).forEach(function (p) {
          if (p) add(p.unit || p.section || '');
        });
      }
    } catch (eS) {}
    return names;
  }
  function invMatchSubdivision(name) {
    var n = invNormHy(name);
    if (!n) return '';
    if (/ՎԱՇՏ/.test(n)) return 'վաշտ';
    if (/ԳՈՒՄԱՐՏԱԿ/.test(n)) return 'գումարտակ';
    if (/ԴԶՀՀ/.test(n) || /Դ\.?Զ\.?Հ\.?Հ/.test(n)) return 'դզհհ';
    if (/ՄԱՐՏԿՈՑ/.test(n)) return 'մարտկոց';
    if (/ԴԱՍԱԿ/.test(n)) return 'դասակ';
    if (/ԶՀԴ/.test(n) || /Զ\.?Հ\.?Դ/.test(n) || /ԶԵՆԻԹ/.test(n)) return 'զհդ';
    return '';
  }
  /* KM_UI6_FILTER_SVC_HEADERS_V1: archive section titles that are category headers, not real services */
  function invIsServiceCategoryHeader(name) {
    var n = invNormHy(name);
    if (!n) return false;
    if (n === 'ԾԱՌԱՅՈՒԹՅՈՒՆՆԵՐ') return true; /* plural group header */
    /* և → ԵՒ under toUpperCase; also allow ԵՎ / & */
    if (/^ՎԱՀ\s*(ԵՒ|ԵՎ|&)\s*ԾԱՌԱՅՈՒԹՅՈՒՆ\.?$/.test(n)) return true; /* «ՎԱՀ և ծառայություն» */
    return false;
  }
  function invMatchServiceName(name) {
    var n = invNormHy(name);
    if (!n) return false;
    if (invIsServiceCategoryHeader(name)) return false;
    if (/ԾԱՌԱՅՈՒԹՅՈՒՆ/.test(n)) return true;
    if (/ԿԱՊԻ/.test(n) || /ԻՆԺԵՆԵՐ/.test(n) || /ՊԱՐԵՆ/.test(n) || /ՎՔՆԿ/.test(n)) return true;
    return false;
  }
  function invListSubdivisionsFromArchive() {
    var out = [], seen = Object.create(null);
    invArchiveSectionNames().forEach(function (name) {
      var kind = invMatchSubdivision(name);
      if (!kind) return;
      var k = invNormHy(name);
      if (seen[k]) return;
      seen[k] = 1;
      out.push({ id: 'sub_' + k.replace(/[^\w\u0531-\u0556\u0561-\u05870-9]+/gi, '_').slice(0, 64), name: name, kind: kind });
    });
    return out;
  }
  function invListServicesFromArchive() {
    var out = [], seen = Object.create(null);
    invArchiveSectionNames().forEach(function (name) {
      if (!invMatchServiceName(name)) return;
      var k = invNormHy(name);
      if (seen[k]) return;
      seen[k] = 1;
      out.push({ id: 'svc_arch_' + k.replace(/[^\w\u0531-\u0556\u0561-\u05870-9]+/gi, '_').slice(0, 64), name: name });
    });
    try {
      (db.unitInventoryServices || []).forEach(function (s) {
        if (!s || !s.id) return;
        if (String(s.id) === 'svc_other') return; /* KM_INV_SUB_MANUAL_V1: «Այլ» stays for legacy records, hidden from the list */
        if (invIsServiceCategoryHeader(s.name || s.id)) return; /* KM_UI6_FILTER_SVC_HEADERS_V1 */
        var k = invNormHy(s.name || s.id);
        if (seen[k]) return;
        seen[k] = 1;
        out.push({ id: String(s.id), name: s.name || s.id });
      });
    } catch (eM) {}
    return out;
  }
  /* === KM_INV_SUB_MANUAL_V1 === manually managed subdivisions («Ստորաբաժանում» path), per unit.
     Stored in db.unitInventorySubdivisions — a per-unit slice key (CORPS_DATA_KEYS in km-org-context.js), like
     db.unitInventoryServices. Each entry is also stamped with corpsId/unitId and filtered by the current org,
     so the list stays per unit even if km-org-context.js is older than this file. Removing only hides the entry. */
  function invEnsureSubdivisions() {
    if (!Array.isArray(db.unitInventorySubdivisions)) db.unitInventorySubdivisions = [];
    return db.unitInventorySubdivisions;
  }
  function invSubOwned(s) {
    try {
      if (!s) return false;
      var sc = s.corpsId == null ? '' : String(s.corpsId), su = s.unitId == null ? '' : String(s.unitId);
      if (!sc && !su) return true;
      var o = invOrgParts();
      return sc === String(o.corpsId) && su === String(o.unitId);
    } catch (e) { return true; }
  }
  function invListManualSubdivisions() {
    var out = [];
    try {
      invEnsureSubdivisions().forEach(function (s) {
        if (s && s.id && invSubOwned(s)) out.push({ id: String(s.id), name: String(s.name || s.id) });
      });
    } catch (e) {}
    return out;
  }
  function invCanManageSubdivisions() {
    try {
      if (typeof window.kmIsSuperAdmin === 'function' && window.kmIsSuperAdmin()) return true;
      if (window.kmSuperAdmin === true) return true;
      if (typeof window.kmCanAdmin === 'function' && window.kmCanAdmin()) return true;
    } catch (_a) {}
    try { var __ms = invPathWholeEdit('subdivision'); if (__ms !== null) return __ms; } catch (eMS) {}
    return canEdit();
  }
  function invSubAdminBar() {
    try {
      if (!invCanManageSubdivisions()) return '';
      var opts = invListManualSubdivisions().map(function (s) {
        return '<option value="' + esc(s.id) + '">' + esc(s.name) + '</option>';
      }).join('');
      return '<div class="kmUtForm" style="margin-bottom:10px;align-items:flex-end">' +
          '<label style="flex:1;min-width:200px">Նոր ստորաբաժանում' +
            '<input id="kmUtInvSubName" type="text" placeholder="օր. 1-ին վաշտ" maxlength="120">' +
          '</label>' +
          '<button type="button" class="primary" onclick="kmUnitInvSubAdd()">Ավելացնել ստորաբաժանում</button>' +
          '<label style="flex:1;min-width:200px">Հեռացնել ստորաբաժանում' +
            '<select id="kmUtInvSubRemove">' +
              '<option value="">— ընտրել —</option>' + opts +
            '</select>' +
          '</label>' +
          '<button type="button" class="danger" onclick="kmUnitInvSubRemoveSelected()">Հեռացնել ստորաբաժանում</button>' +
        '</div>';
    } catch (e) { return ''; }
  }
  window.kmUnitInvSubAdd = async function () {
    if (!invCanManageSubdivisions()) { toastErr('Փոփոխության իրավունք չունեք'); return; }
    window.kmUnitEnsureStores();
    var list = invEnsureSubdivisions();
    var el = document.getElementById('kmUtInvSubName');
    var name = el ? String(el.value || '').replace(/\s+/g, ' ').trim() : '';
    if (!name) { toastErr('Գրեք ստորաբաժանման անունը'); return; }
    if (name.length > 120) { toastErr('Անունը շատ երկար է'); return; }
    var low = invNormHy(name).toLowerCase();
    var dup = invListManualSubdivisions().some(function (s) { return invNormHy(s.name).toLowerCase() === low; });
    if (dup) { toastErr('Այդ ստորաբաժանումն արդեն կա'); return; }
    var o = invOrgParts();
    list.push({
      id: 'sub_m_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: name,
      corpsId: o.corpsId,
      unitId: o.unitId,
      createdAt: new Date().toISOString()
    });
    try { if (el) el.value = ''; } catch (_e) {}
    await persist(true);
    toastOk('Ստորաբաժանումը ավելացվեց');
    window.kmUnitOpen('unitInventory');
  };
  window.kmUnitInvSubRemoveSelected = async function () {
    if (!invCanManageSubdivisions()) { toastErr('Փոփոխության իրավունք չունեք'); return; }
    var el = document.getElementById('kmUtInvSubRemove');
    var id = el ? String(el.value || '').trim() : '';
    if (!id) { toastErr('Ընտրեք հեռացվող ստորաբաժանումը'); return; }
    var item = invListManualSubdivisions().filter(function (s) { return s.id === id; })[0];
    if (!item) { toastErr('Ստորաբաժանումը չգտնվեց'); return; }
    if (!confirm('Հեռացնե՞լ «' + item.name + '» ստորաբաժանումը ցուցակից։\nՆրա փաստաթղթերը չեն ջնջվի։')) return;
    window.kmUnitEnsureStores();
    db.unitInventorySubdivisions = invEnsureSubdivisions().filter(function (s) {
      return !(s && String(s.id) === id && invSubOwned(s));
    });
    if (window._kmUtInvFilter) {
      if (window._kmUtInvFilter.serviceId === id) window._kmUtInvFilter.serviceId = '';
      if (window._kmUtInvFilter.targetId === id) window._kmUtInvFilter.targetId = '';
    }
    await persist(true);
    toastOk('Հեռացվեց');
    window.kmUnitOpen('unitInventory');
  };
  /* === /KM_INV_SUB_MANUAL_V1 === */
  function invEnsurePathFilter() {
    if (!window._kmUtInvFilter || typeof window._kmUtInvFilter !== 'object') {
      window._kmUtInvFilter = { path: '', targetId: '', serviceId: '' };
    }
    if (window._kmUtInvFilter.path == null) window._kmUtInvFilter.path = '';
    if (window._kmUtInvFilter.targetId == null) window._kmUtInvFilter.targetId = '';
    if (window._kmUtInvFilter.serviceId == null) window._kmUtInvFilter.serviceId = '';
    return window._kmUtInvFilter;
  }
  window.kmUnitInvPathChoose = function (pathName) {
    try { if (!invPathVisible(String(pathName || '').trim())) { toastErr('Այս բաժինը ձեզ թույլատրված չէ'); return; } } catch (ePc) {} /* KM_INV_SCOPE_GRANTS_V1 */
    var f = invEnsurePathFilter();
    f.path = String(pathName || '').trim();
    f.targetId = '';
    f.serviceId = '';
    window._kmUtInvDocTab = '';
    window.kmUnitOpen('unitInventory');
  };
  window.kmUnitInvPathBack = function () {
    var f = invEnsurePathFilter();
    f.path = '';
    f.targetId = '';
    f.serviceId = '';
    window._kmUtInvDocTab = '';
    window.kmUnitOpen('unitInventory');
  };
  window.kmUnitInvTargetOpen = function (id, name) {
    var f = invEnsurePathFilter();
    id = String(id || '').trim();
    f.targetId = id;
    f.serviceId = id;
    window._kmUtInvDocTab = '';
    window._kmUtInvTargetName = String(name || id);
    window.kmUnitOpen('unitInventory');
  };
  /* KM_FORM27_BLOB_EMBED_V1 */
  var KM_FORM27_LEDGER_GZ_B64 = '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';
  /* === KM_APRANQ_V1 === incoming/outgoing invoices (replicas of the PDFs), per service/subdivision */
  var KM_APRANQ_MUTQ_GZ_B64 = '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';
  var KM_APRANQ_ELQ_GZ_B64 = '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';
  function kmApranqBlobUrl(kind, scopeId, scopeName, __kmInvOpts) { /* KM_INV_SCOPE_GRANTS_V1 */
    try {
      var b64 = kind === 'elq' ? KM_APRANQ_ELQ_GZ_B64 : KM_APRANQ_MUTQ_GZ_B64;
      var bin = atob(b64);
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      var hash = '#scopeId=' + encodeURIComponent(scopeId || 'default') + '&scopeName=' + encodeURIComponent(scopeName || '') + ((__kmInvOpts && __kmInvOpts.ro) ? '&ro=1' : ''); /* KM_INV_SCOPE_GRANTS_V1 */
      var placeholder = '<html><body style="font:14px sans-serif;padding:16px">Բեռնվում է…</body></html>';
      var url0 = URL.createObjectURL(new Blob([placeholder], { type: 'text/html;charset=utf-8' }));
      if (typeof DecompressionStream === 'function') {
        new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text().then(function (text) {
          try { if (__kmInvOpts && __kmInvOpts.ro) text = invRoInjectHtml(text); } catch (eRo) {} /* KM_INV_SCOPE_GRANTS_V1 */
          var fr = document.getElementById('kmApranqFrame');
          if (fr) fr.src = URL.createObjectURL(new Blob([text], { type: 'text/html;charset=utf-8' })) + hash;
        }).catch(function () {});
      }
      return url0;
    } catch (e) { return 'about:blank'; }
  }
  if (!window.__kmApranqFsMsg_V1) {
    window.__kmApranqFsMsg_V1 = true;
    window.addEventListener('message', function (ev) {
      try {
        var d = ev && ev.data;
        if (!d || typeof d.kmApranqFullscreen === 'undefined') return;
        var fr = document.getElementById('kmApranqFrame');
        if (!fr) return;
        if (d.kmApranqFullscreen) {
          if (fr.getAttribute('data-km-fs') !== '1') fr.setAttribute('data-km-style', fr.getAttribute('style') || '');
          fr.setAttribute('data-km-fs', '1');
          fr.setAttribute('style', 'position:fixed;left:0;top:0;width:100vw;height:100vh;min-height:0;z-index:2147483000;border:0;border-radius:0;background:#fff');
          try { fr.contentWindow.postMessage({ kmApranqFullscreenState: 1 }, '*'); } catch (e2) {}
        } else if (fr.getAttribute('data-km-fs') === '1') {
          fr.setAttribute('style', fr.getAttribute('data-km-style') || '');
          fr.removeAttribute('data-km-fs');
          try { fr.contentWindow.postMessage({ kmApranqFullscreenState: 0 }, '*'); } catch (e3) {}
        }
      } catch (e) {}
    });
  }
  /* === /KM_APRANQ_V1 === */
  /* === KM_HAMALR_REPORT_V1 === staffing report (same look/functions as the PDF), per service/subdivision */
  var KM_HAMALR_GZ_B64 = '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';
  function kmHamalrReportBlobUrl(scopeId, scopeName, __kmInvOpts) { /* KM_INV_SCOPE_GRANTS_V1 */
    try {
      var bin = atob(KM_HAMALR_GZ_B64);
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      var hash = '#scopeId=' + encodeURIComponent(scopeId || 'default') + '&scopeName=' + encodeURIComponent(scopeName || '') + ((__kmInvOpts && __kmInvOpts.ro) ? '&ro=1' : ''); /* KM_INV_SCOPE_GRANTS_V1 */
      var placeholder = '<html><body style="font:14px sans-serif;padding:16px">Բեռնվում է…</body></html>';
      var url0 = URL.createObjectURL(new Blob([placeholder], { type: 'text/html;charset=utf-8' }));
      if (typeof DecompressionStream === 'function') {
        new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text().then(function (text) {
          try { if (__kmInvOpts && __kmInvOpts.ro) text = invRoInjectHtml(text); } catch (eRo) {} /* KM_INV_SCOPE_GRANTS_V1 */
          var fr = document.getElementById('kmHamalrFrame');
          if (fr && (!fr.getAttribute('src') || fr.getAttribute('src') === url0)) fr.src = URL.createObjectURL(new Blob([text], { type: 'text/html;charset=utf-8' })) + hash; /* KM_HAMALR_MOVE_V1: a late decode never overwrites a newer frame (other scope) */
        }).catch(function () {});
      }
      return url0;
    } catch (e) { return 'about:blank'; }
  }
  if (!window.__kmHamalrFsMsg_V1) {
    window.__kmHamalrFsMsg_V1 = true;
    window.addEventListener('message', function (ev) {
      try {
        var d = ev && ev.data;
        if (!d || typeof d.kmHamalrFullscreen === 'undefined') return;
        var fr = document.getElementById('kmHamalrFrame');
        if (!fr) return;
        if (d.kmHamalrFullscreen) {
          if (fr.getAttribute('data-km-fs') !== '1') fr.setAttribute('data-km-style', fr.getAttribute('style') || '');
          fr.setAttribute('data-km-fs', '1');
          fr.setAttribute('style', 'position:fixed;left:0;top:0;width:100vw;height:100vh;min-height:0;z-index:2147483000;border:0;border-radius:0;background:#fff');
        } else if (fr.getAttribute('data-km-fs') === '1') {
          fr.setAttribute('style', fr.getAttribute('data-km-style') || '');
          fr.removeAttribute('data-km-fs');
        }
      } catch (e) {}
    });
  }
  /* === /KM_HAMALR_REPORT_V1 === */
  /* === KM_F27_ZOOM_V2 === Form 27: zoom down to 20% and Ctrl + mouse wheel zoom */
  function kmF27PatchZoom_V2(text) {
    try {
      if (!text || text.indexOf('KM_F27_ZOOM_V2') >= 0) return text;
      text = text.replace(/var min = 0\.5;/, 'var min = 0.2; /* KM_F27_ZOOM_V2 */');
      var anchor = "  document.addEventListener('keydown', function(ev){\n    if (!(ev.ctrlKey || ev.metaKey)) return;";
      var i = text.indexOf(anchor);
      if (i < 0) return text;
      var wheel = "  /* KM_F27_ZOOM_V2 wheel */\n" +
        "  window.addEventListener('wheel', function(ev){\n" +
        "    if (!(ev.ctrlKey || ev.metaKey)) return;\n" +
        "    ev.preventDefault();\n" +
        "    var d = ev.deltaY || ev.deltaX || 0;\n" +
        "    if (!d) return;\n" +
        "    zoom = d < 0 ? Math.min(max, zoom + step) : Math.max(min, zoom - step);\n" +
        "    apply();\n" +
        "  }, { passive: false, capture: true });\n";
      return text.slice(0, i) + wheel + text.slice(i);
    } catch (e) { return text; }
  }
  /* === /KM_F27_ZOOM_V2 === */
  /* === KM_F27_FULLSCREEN_V1 === full-screen button beside the zoom "+" in the Form 27 ledger */
  function kmF27InjectFullscreen_V1(text) {
    try {
      if (!text || text.indexOf('kmF27FsBtn') >= 0) return text;
      var icoOn = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
      var btn = '<button type="button" class="kmFsBtn" id="kmF27FsBtn" title="Ամբողջ էկրան" aria-label="Ամբողջ էկրան">' + icoOn + '</button>';
      var re = /(<button[^>]*id="zoomIn"[^>]*>[\s\S]*?<\/button>)/i;
      if (!re.test(text)) return text;
      text = text.replace(re, function (m) { return m + '\n    ' + btn; });
      var css = '<style>.zoomBar .kmFsBtn{display:inline-flex;align-items:center;justify-content:center;padding:0}' +
        'html.kmF27Fs,html.kmF27Fs body{width:100%;height:100%}</style>';
      var js = '<script>(function(){' +
        'var ON=' + JSON.stringify(icoOn) + ';' +
        'var OFF=' + JSON.stringify('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>') + ';' +
        'var b=document.getElementById("kmF27FsBtn");if(!b)return;var css=false;' +
        'function fs(){return !!document.fullscreenElement||css;}' +
        'function paint(){var on=fs();b.innerHTML=on?OFF:ON;b.title=on?"Դուրս գալ ամբողջ էկրանից":"Ամբողջ էկրան";b.setAttribute("aria-label",b.title);document.documentElement.classList.toggle("kmF27Fs",on);}' +
        'function par(on){css=on;try{parent.postMessage({kmF27Fullscreen:on?1:0},"*");}catch(e){}paint();}' +
        'b.onclick=function(){' +
          'if(document.fullscreenElement){document.exitFullscreen().catch(function(){});return;}' +
          'if(css){par(false);return;}' +
          'var el=document.documentElement;var p=null;try{p=el.requestFullscreen?el.requestFullscreen():null;}catch(e){p=null;}' +
          'if(p&&p.then){p.catch(function(){par(true);});}else{par(true);}' +
        '};' +
        'document.addEventListener("fullscreenchange",paint);' +
        'document.addEventListener("keydown",function(ev){if(ev.key==="Escape"&&css)par(false);});' +
        '})();<\/script>';
      if (/<\/head>/i.test(text)) text = text.replace(/<\/head>/i, function (m) { return css + m; });
      if (/<\/body>/i.test(text)) text = text.replace(/<\/body>(?![\s\S]*<\/body>)/i, function (m) { return js + m; });
      else text += js;
      return text;
    } catch (e) { return text; }
  }
  if (!window.__kmF27FsMsg_V1) {
    window.__kmF27FsMsg_V1 = true;
    window.addEventListener('message', function (ev) {
      try {
        var d = ev && ev.data;
        if (!d || typeof d.kmF27Fullscreen === 'undefined') return;
        var fr = document.getElementById('kmF27LedgerFrame');
        if (!fr) return;
        if (d.kmF27Fullscreen) {
          if (fr.getAttribute('data-km-fs') !== '1') fr.setAttribute('data-km-style', fr.getAttribute('style') || '');
          fr.setAttribute('data-km-fs', '1');
          fr.setAttribute('style', 'position:fixed;left:0;top:0;width:100vw;height:100vh;min-height:0;z-index:2147483000;border:0;border-radius:0;background:#fff');
        } else if (fr.getAttribute('data-km-fs') === '1') {
          fr.setAttribute('style', fr.getAttribute('data-km-style') || '');
          fr.removeAttribute('data-km-fs');
        }
      } catch (e) {}
    });
  }
  /* === /KM_F27_FULLSCREEN_V1 === */
  function kmForm27LedgerBlobUrl(sid, title, __kmInvOpts) { /* KM_INV_SCOPE_GRANTS_V1 */
    try {
      var bin = atob(KM_FORM27_LEDGER_GZ_B64);
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      var placeholder = '<html><body style="font:14px sans-serif;padding:16px">Բեռնվում է Ձև 27…</body></html>';
      var url0 = URL.createObjectURL(new Blob([placeholder], { type: 'text/html;charset=utf-8' }));
      if (typeof DecompressionStream === 'function') {
        var ds = new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')));
        ds.text().then(function (text) {
          var q = 'serviceId=' + encodeURIComponent((__kmInvOpts && __kmInvOpts.svcKey) || sid || '') + '&serviceName=' + encodeURIComponent(title || '') + ((__kmInvOpts && __kmInvOpts.ro) ? '&ro=1' : ''); /* KM_INV_SCOPE_GRANTS_V1 */
          if (/<head/i.test(text)) {
            text = text.replace(/<head[^>]*>/i, function (m) {
              return m + '<script>try{if(!location.search||location.search==="?")history.replaceState(null,"","?' + q.replace(/"/g, '') + '");}catch(e){}</script>';
            });
          }
          /* KM_F27_FULLSCREEN_V1 */
          text = kmF27InjectFullscreen_V1(text);
          text = kmF27PatchZoom_V2(text); /* KM_F27_ZOOM_V2 */
          try { if (__kmInvOpts && __kmInvOpts.ro) text = invRoInjectHtml(text); } catch (eRo) {} /* KM_INV_SCOPE_GRANTS_V1 */
          var __kmSetSrc = function () {
            var fr = document.getElementById('kmF27LedgerFrame');
            if (fr) fr.src = URL.createObjectURL(new Blob([text], { type: 'text/html;charset=utf-8' })) + ((__kmInvOpts && __kmInvOpts.ro) ? '#ro=1' : '');
          };
          var __kmMig = null; /* KM_INV_SCOPE_GRANTS_V1: copy legacy IndexedDB before the ledger opens it */
          try { __kmMig = (__kmInvOpts && typeof __kmInvOpts.migrate === 'function') ? __kmInvOpts.migrate() : null; } catch (eMg) { __kmMig = null; }
          if (__kmMig && typeof __kmMig.then === 'function') __kmMig.then(__kmSetSrc, __kmSetSrc); else __kmSetSrc();
        }).catch(function () {});
      }
      return url0;
    } catch (e) { return 'about:blank'; }
  }

  /* === KM_INV_SCOPE_GRANTS_V1 === per corps+unit+path+target isolation and per-section view/edit grants for «Գույքի հաշվառում» */
  var INV_SEC_KINDS = { /* KM_INV_SCOPE_GRANTS_V1 */
    subdivision: ['f26', 'f28', 'apranq_mutq', 'apranq_elq', 'receipt'], /* KM_HAMALR_MOVE_V1: hamalr moved to the Հաշվառում hub */
    service: ['f27', 'f28', 'apranq_mutq', 'apranq_elq', 'receipt']
  };
  function invOrgParts() { /* KM_INV_SCOPE_GRANTS_V1 */
    var c = '', u = '';
    try {
      var ctx = typeof window.kmGetOrgContext === 'function' ? window.kmGetOrgContext() : null;
      if (ctx) { c = String(ctx.corpsId || '').trim(); u = String(ctx.unitId || '').trim(); }
    } catch (e) {}
    return { corpsId: c || 'nocorps', unitId: u || 'nounit', real: !!(c && u) };
  }
  function invOrgScope() { /* KM_INV_SCOPE_GRANTS_V1 */
    var o = invOrgParts();
    return o.corpsId + '|' + o.unitId;
  }
  function invScopeId(path, sid) { /* KM_INV_SCOPE_GRANTS_V1: corpsId|unitId|path:sid */
    return invOrgScope() + '|' + String(path || 'service') + ':' + String(sid || '');
  }
  function invHash32(str, seed) { /* KM_INV_SCOPE_GRANTS_V1: FNV-1a */
    var h = (seed >>> 0) || 0x811c9dc5;
    str = String(str == null ? '' : str);
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return ('0000000' + h.toString(16)).slice(-8);
  }
  function invAsciiKey(s) { return String(s == null ? '' : s).replace(/[^\w\-]+/g, '_'); }
  /* Form 27 HTML keys IndexedDB/localStorage by serviceId sanitized with /[^\w\-]+/ -> '_' and cut to 80 chars,
     so the org prefix cannot be passed verbatim: pass an ASCII key derived from the full org scope instead. */
  function invF27LegacySvc(sid) { /* KM_INV_SCOPE_GRANTS_V1: exactly what the embedded Form 27 HTML derived before */
    return String(sid || 'default').replace(/[^\w\-]+/g, '_').slice(0, 80) || 'default';
  }
  function invF27SvcKey(path, sid) { /* KM_INV_SCOPE_GRANTS_V1 */
    var full = invScopeId(path, sid);
    var o = invOrgParts();
    return ('km' + invHash32(full, 0x811c9dc5) + invHash32(full, 0x9747b28c) + '_' + invAsciiKey(o.unitId).slice(0, 16) +
      '_' + (String(path) === 'subdivision' ? 'sub' : 'svc') + '_' + invAsciiKey(sid).slice(0, 24)).slice(0, 80);
  }
  /* copy old localStorage scope -> new scope once (first org that opens it inherits it) */
  function invLsMigrate(oldKey, newKey) { /* KM_INV_SCOPE_GRANTS_V1 */
    try {
      var ls = window.localStorage;
      oldKey = String(oldKey || ''); newKey = String(newKey || '');
      if (!ls || !oldKey || !newKey || oldKey === newKey) return 0;
      var mk = oldKey + '::migrated';
      if (ls.getItem(mk) === '1') return 0;
      var oldKeys = [], i, k, hasNew = false;
      for (i = 0; i < ls.length; i++) {
        k = ls.key(i);
        if (k == null) continue;
        if (k === newKey || k.indexOf(newKey + '::') === 0) hasNew = true;
        if (k === mk) continue;
        if (k === oldKey || k.indexOf(oldKey + '::') === 0) oldKeys.push(k);
      }
      if (hasNew || !oldKeys.length) return 0;
      oldKeys.forEach(function (ok) {
        var v = ls.getItem(ok);
        if (v != null) ls.setItem(newKey + ok.slice(oldKey.length), v);
      });
      ls.setItem(mk, '1');
      return oldKeys.length;
    } catch (e) { return 0; }
  }
  function invScopedIframeId(storePrefix, path, sid) { /* KM_INV_SCOPE_GRANTS_V1: new scopeId (+ one-time migration) */
    var legacy = String(path || 'service') + ':' + String(sid || '');
    try {
      var nid = invScopeId(path, sid);
      if (invOrgParts().real) invLsMigrate(String(storePrefix) + legacy, String(storePrefix) + nid);
      return nid;
    } catch (e) { return legacy; }
  }
  /* Form 27: IndexedDB km_goyq_sheets_v2_<svc> (stores sheets{id,order}, trash{id}) + a few localStorage keys */
  var INV_F27_LS_PREFIXES = ['km_goyq_activeSheetId_v2_', 'km_goyq_zoom_', 'km_goyq_layoutVer_v2_', 'km_goyq_lastSave_'];
  function invF27Migrate(oldSvc, newSvc) { /* KM_INV_SCOPE_GRANTS_V1 */
    return new Promise(function (resolve) {
      var done = false;
      function fin(n) { if (!done) { done = true; resolve(n || 0); } }
      try {
        setTimeout(function () { fin(0); }, 5000);
        var idb = window.indexedDB;
        oldSvc = String(oldSvc || ''); newSvc = String(newSvc || '');
        if (!idb || !oldSvc || !newSvc || oldSvc === newSvc) return fin(0);
        var oldName = 'km_goyq_sheets_v2_' + oldSvc, newName = 'km_goyq_sheets_v2_' + newSvc, mk = oldName + '::migrated';
        try { if (window.localStorage.getItem(mk) === '1') return fin(0); } catch (eM) {}
        var openDb = function (name) {
          return new Promise(function (res, rej) {
            var r = idb.open(name, 1);
            r.onupgradeneeded = function (ev) {
              var db0 = ev.target.result;
              if (!db0.objectStoreNames.contains('sheets')) db0.createObjectStore('sheets', { keyPath: 'id' }).createIndex('order', 'order', { unique: false });
              if (!db0.objectStoreNames.contains('trash')) db0.createObjectStore('trash', { keyPath: 'id' });
            };
            r.onsuccess = function () { res(r.result); };
            r.onerror = function () { rej(r.error); };
            r.onblocked = function () { rej(new Error('blocked')); };
          });
        };
        var getAll = function (db0, store) {
          return new Promise(function (res) {
            try {
              if (!db0.objectStoreNames.contains(store)) return res([]);
              var q = db0.transaction(store, 'readonly').objectStore(store).getAll();
              q.onsuccess = function () { res(q.result || []); };
              q.onerror = function () { res([]); };
            } catch (e) { res([]); }
          });
        };
        var exists = (typeof idb.databases === 'function')
          ? idb.databases().then(function (l) { return (l || []).some(function (x) { return x && x.name === oldName; }); }, function () { return true; })
          : Promise.resolve(true);
        exists.then(function (ex) {
          if (!ex) return fin(0);
          return openDb(newName).then(function (ndb) {
            return Promise.all([getAll(ndb, 'sheets'), getAll(ndb, 'trash')]).then(function (nv) {
              if (nv[0].length || nv[1].length) { ndb.close(); return fin(0); }
              return openDb(oldName).then(function (odb) {
                return Promise.all([getAll(odb, 'sheets'), getAll(odb, 'trash')]).then(function (ov) {
                  try { odb.close(); } catch (eC) {}
                  if (!ov[0].length && !ov[1].length) { ndb.close(); return fin(0); }
                  var tx = ndb.transaction(['sheets', 'trash'], 'readwrite');
                  ov[0].forEach(function (r) { tx.objectStore('sheets').put(r); });
                  ov[1].forEach(function (r) { tx.objectStore('trash').put(r); });
                  tx.oncomplete = function () {
                    try { ndb.close(); } catch (eC2) {}
                    try {
                      var ls = window.localStorage;
                      INV_F27_LS_PREFIXES.forEach(function (p) {
                        var v = ls.getItem(p + oldSvc);
                        if (v != null && ls.getItem(p + newSvc) == null) ls.setItem(p + newSvc, v);
                      });
                      ls.setItem(mk, '1');
                    } catch (eL) {}
                    fin(ov[0].length + ov[1].length);
                  };
                  tx.onerror = tx.onabort = function () { try { ndb.close(); } catch (eC3) {} fin(0); };
                });
              }, function () { try { ndb.close(); } catch (eC4) {} fin(0); });
            });
          });
        }).catch(function () { fin(0); });
      } catch (e) { fin(0); }
    });
  }
  /* ---- per-section grants: unitInventory > unitInventory:sub|svc > unitInventory:sub|svc:<kind> ---- */
  function invIsAdminUser() { /* KM_INV_SCOPE_GRANTS_V1 */
    try {
      if (window.kmUserRole === 'viewer') return false;
      if (window.kmUserRole === 'admin') return true;
      if (typeof window.kmIsSuperAdmin === 'function' && window.kmIsSuperAdmin()) return true;
      if (typeof window.kmIsAppAdmin === 'function' && window.kmIsAppAdmin()) return true;
    } catch (e) {}
    return false;
  }
  function invPathKey(path) { return String(path) === 'subdivision' ? 'sub' : 'svc'; }
  function invSecAccess(path, kind) { /* KM_INV_SCOPE_GRANTS_V1 -> {view, edit} */
    var fb = { view: true, edit: false };
    try { fb.edit = !!canEdit(); } catch (e0) {}
    try {
      if (window.kmUserRole === 'viewer') return { view: true, edit: false };
      if (invIsAdminUser()) return { view: true, edit: true };
      if (typeof window.kmUserHasFullAccess === 'function' && window.kmUserHasFullAccess()) return { view: true, edit: true };
      if (typeof window.kmCanEdit !== 'function' || typeof window.kmSectionGranted !== 'function') return fb;
      var pk = invPathKey(path);
      var ids = ['unitInventory', 'unitInventory:' + pk];
      if (kind) ids.push('unitInventory:' + pk + ':' + String(kind));
      var e = false, v = false;
      for (var i = 0; i < ids.length; i++) {
        if (window.kmCanEdit(ids[i])) e = true;
        if (window.kmSectionGranted(ids[i])) v = true;
      }
      return { view: !!(v || e), edit: !!e };
    } catch (e1) { return fb; }
  }
  function invPathAccess(path) { /* KM_INV_SCOPE_GRANTS_V1 */
    var kinds = INV_SEC_KINDS[String(path) === 'subdivision' ? 'subdivision' : 'service'];
    var r = { view: false, edit: false };
    for (var i = 0; i < kinds.length; i++) {
      var a = invSecAccess(path, kinds[i]);
      if (a.view) r.view = true;
      if (a.edit) r.edit = true;
    }
    return r;
  }
  function invPathVisible(path) { try { return !!invPathAccess(path).view; } catch (e) { return true; } }
  function invPathWholeEdit(path) { /* KM_INV_SCOPE_GRANTS_V1: null = undecided (caller falls back) */
    try {
      if (window.kmUserRole === 'viewer') return false;
      if (invIsAdminUser()) return true;
      if (typeof window.kmUserHasFullAccess === 'function' && window.kmUserHasFullAccess()) return true;
      if (typeof window.kmCanEdit !== 'function') return null;
      return !!(window.kmCanEdit('unitInventory') || window.kmCanEdit('unitInventory:' + invPathKey(path)));
    } catch (e) { return null; }
  }
  function invCurPath() {
    try { return String((window._kmUtInvFilter && window._kmUtInvFilter.path) || '').trim() || 'service'; } catch (e) { return 'service'; }
  }
  function invDocEditAllowed(kind, path) { /* KM_INV_SCOPE_GRANTS_V1 */
    try { return !!invSecAccess(path || invCurPath(), kind).edit; } catch (e) { return canEdit(); }
  }
  function invRoHintHtml(path, kind) { /* KM_INV_SCOPE_GRANTS_V1 */
    try {
      var a = invSecAccess(path, kind);
      if (a.view && !a.edit) return '<small class="kmInvRoHint" style="display:block;font-size:11px;line-height:1.1;font-weight:500;opacity:.75;margin-top:2px">👁 միայն դիտում</small>';
    } catch (e) {}
    return '';
  }
  function invRoBannerHtml() { /* KM_INV_SCOPE_GRANTS_V1 */
    return '<div class="kmInvRoBanner" style="margin:0 0 8px;padding:8px 12px;border-radius:8px;background:#fff8e1;border:1px solid #f0d58c;color:#6d5200;font-weight:600">👁 Միայն դիտում՝ փոփոխության իրավունք չունեք</div>';
  }
  /* ---- db.unitInventoryDocs ownership: corpsId + unitId (+ path); legacy records are stamped on first view ---- */
  function invDocOwned(d, o, path) { /* KM_INV_SCOPE_GRANTS_V1 */
    if (!d) return false;
    if (!o) return true;
    var dc = d.corpsId == null ? '' : String(d.corpsId), du = d.unitId == null ? '' : String(d.unitId);
    if (!dc && !du) {
      if (o.real) {
        d.corpsId = o.corpsId;
        d.unitId = o.unitId;
        if (!d.path && path) d.path = String(path);
      }
      return true;
    }
    if (dc !== String(o.corpsId) || du !== String(o.unitId)) return false;
    if (path && d.path && String(d.path) !== String(path)) return false;
    return true;
  }
  /* ---- read-only enforcement inside same-origin blob iframes (Form 27, hamalr, apranq) ---- */
  var INV_RO_CFG = {
    ids: ['zoomIn', 'zoomOut', 'zoomReset', 'kmF27FsBtn', 'kmTrashClose', 'btnFs', 'btnPrint', 'zIn', 'zOut', 'zPct',
      'btnSheetContents', 'kmCtClose', 'kmCtPrintBtn'], /* KM_F27_CONTENTS_V1: Form 27 «Ցուցակ» */
    cls: ['sheetTab', 'kmF27ContentsBtn'],
    sel: ['docSel'],
    lsAllow: ['km_goyq_zoom'],
    within: ['#kmCtOverlay', '[data-km-ro-allow="1"]'] /* KM_F27_CONTENTS_V1: view-only panels stay usable (search input, rows) */
  };
  /* serialized with toString() and executed INSIDE the iframe: must stay self-contained */
  function invRoGuardFn(cfg) {
    try {
      var w = window, d = document;
      if (w.__kmInvRoGuard) { try { w.__kmInvRoGuard.apply(); } catch (e0) {} return; }
      cfg = cfg || {};
      var allowIds = cfg.ids || [], allowCls = cfg.cls || [], allowSel = cfg.sel || [], lsAllow = cfg.lsAllow || [];
      var allowWithin = cfg.within || []; /* KM_F27_CONTENTS_V1 */
      var inAllowed = function (el) {
        try {
          if (!allowWithin.length || !el) return false;
          if (el.nodeType === 3) el = el.parentNode;
          return !!(el && el.closest && el.closest(allowWithin.join(',')));
        } catch (e) { return false; }
      };
      var inList = function (a, v) { return a.indexOf(v) >= 0; };
      /* write guards: this iframe realm's own Storage / IndexedDB prototypes only (the host window is untouched) */
      try {
        var SP = w.Storage && w.Storage.prototype;
        if (SP && !SP.__kmInvRo) {
          var oSet = SP.setItem;
          SP.setItem = function (k, v) {
            var ks = String(k);
            for (var i = 0; i < lsAllow.length; i++) { if (ks.indexOf(lsAllow[i]) === 0) return oSet.call(this, k, v); }
          };
          SP.removeItem = function () {};
          SP.clear = function () {};
          SP.__kmInvRo = 1;
        }
      } catch (e1) {}
      try {
        var fakeReq = function () {
          var r = { result: undefined, error: null, readyState: 'done', onsuccess: null, onerror: null, _l: [] };
          r.addEventListener = function (t, f) { if (t === 'success' && typeof f === 'function') r._l.push(f); };
          r.removeEventListener = function () {};
          setTimeout(function () {
            var ev = { type: 'success', target: r };
            try { if (typeof r.onsuccess === 'function') r.onsuccess(ev); } catch (e) {}
            for (var i = 0; i < r._l.length; i++) { try { r._l[i](ev); } catch (e2) {} }
          }, 0);
          return r;
        };
        var OP = w.IDBObjectStore && w.IDBObjectStore.prototype;
        if (OP && !OP.__kmInvRo) {
          ['put', 'add', 'delete', 'clear'].forEach(function (m) { if (typeof OP[m] === 'function') OP[m] = function () { return fakeReq(); }; });
          OP.__kmInvRo = 1;
        }
        var CP = w.IDBCursor && w.IDBCursor.prototype;
        if (CP && !CP.__kmInvRo) {
          ['update', 'delete'].forEach(function (m) { if (typeof CP[m] === 'function') CP[m] = function () { return fakeReq(); }; });
          CP.__kmInvRo = 1;
        }
      } catch (e2) {}
      var btnOk = function (el) {
        if (el.id && inList(allowIds, el.id)) return true;
        var cl = el.classList;
        if (cl) { for (var i = 0; i < allowCls.length; i++) { if (cl.contains(allowCls[i])) return true; } }
        return false;
      };
      var roEl = function (el) {
        if (!el || el.nodeType !== 1) return;
        if (inAllowed(el)) return; /* KM_F27_CONTENTS_V1 */
        var tg = el.tagName;
        if (tg === 'INPUT' || tg === 'TEXTAREA') {
          var t = String(el.type || '').toLowerCase();
          if (tg === 'INPUT' && /^(checkbox|radio|file|range|color|button|submit|reset|image)$/.test(t)) {
            if (!el.disabled && !btnOk(el)) el.disabled = true;
          } else if (!el.readOnly) {
            el.readOnly = true;
          }
        } else if (tg === 'SELECT') {
          if (!el.disabled && !(el.id && inList(allowSel, el.id))) el.disabled = true;
        } else if (tg === 'BUTTON') {
          if (!el.disabled && !btnOk(el)) el.disabled = true;
        }
        var ce = el.getAttribute('contenteditable');
        if (ce != null && ce !== 'false') el.setAttribute('contenteditable', 'false');
      };
      var scan = function (root) {
        if (!root) return;
        if (root.nodeType === 1) roEl(root);
        if (root.querySelectorAll) {
          var l = root.querySelectorAll('input,textarea,select,button,[contenteditable]');
          for (var i = 0; i < l.length; i++) roEl(l[i]);
        }
      };
      var stop = function (ev) { try { ev.preventDefault(); ev.stopImmediatePropagation(); } catch (e) {} };
      w.addEventListener('beforeinput', function (ev) { if (inAllowed(ev.target)) return; stop(ev); }, true); /* KM_F27_CONTENTS_V1 */
      ['paste', 'cut', 'drop'].forEach(function (t) { w.addEventListener(t, function (ev) { if (inAllowed(ev.target)) return; stop(ev); }, true); }); /* KM_F27_CONTENTS_V1 */
      w.addEventListener('keydown', function (ev) {
        if (inAllowed(ev.target)) return; /* KM_F27_CONTENTS_V1 */
        var k = String(ev.key || '').toLowerCase();
        var ctrl = ev.ctrlKey || ev.metaKey;
        if (ctrl && (k === 's' || ev.code === 'KeyS' || k === 'z' || k === 'y' || k === 'x' || k === 'v')) stop(ev);
        else if (!ctrl && (k === 'delete' || k === 'backspace')) stop(ev);
      }, true);
      w.addEventListener('dblclick', function (ev) {
        var t = ev.target;
        if (t && t.closest && t.closest('.sheetTab')) stop(ev);
      }, true);
      var style = function () {
        if (d.getElementById('kmInvRoStyle')) return;
        var s = d.createElement('style');
        s.id = 'kmInvRoStyle';
        s.textContent = 'html.kmInvRO button:disabled,html.kmInvRO select:disabled,html.kmInvRO input:disabled{opacity:.45;cursor:not-allowed}' +
          'html.kmInvRO [contenteditable],html.kmInvRO input[readonly],html.kmInvRO textarea[readonly]{caret-color:transparent;cursor:default}';
        (d.head || d.documentElement).appendChild(s);
      };
      var hooks = function () {
        ['kmApranq', 'kmHamalr'].forEach(function (n) {
          try {
            var o = w[n];
            if (o && typeof o === 'object' && !o.__kmInvRo) {
              o.save = function () { return false; };
              o.addRow = function () {};
              o.delRow = function () {};
              o.__kmInvRo = 1;
            }
          } catch (e) {}
        });
      };
      var mo = null;
      var observe = function () {
        if (mo || !w.MutationObserver || !d.documentElement) return;
        mo = new w.MutationObserver(function (recs) {
          for (var i = 0; i < recs.length; i++) {
            var r = recs[i];
            if (r.type === 'attributes') roEl(r.target);
            else { for (var j = 0; j < r.addedNodes.length; j++) scan(r.addedNodes[j]); }
          }
        });
        mo.observe(d.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['contenteditable', 'disabled', 'readonly'] });
      };
      var apply = function () {
        try { if (d.head || d.body) style(); } catch (e) {}
        try { d.documentElement.classList.add('kmInvRO'); } catch (e2) {}
        if (d.body) scan(d.body);
        hooks();
        observe();
      };
      w.__kmInvRoGuard = { apply: apply };
      apply();
      d.addEventListener('DOMContentLoaded', apply);
      w.addEventListener('load', apply);
    } catch (eAll) {}
  }
  function invRoGuardSrc() { /* KM_INV_SCOPE_GRANTS_V1 */
    return '(' + invRoGuardFn.toString() + ')(' + JSON.stringify(INV_RO_CFG) + ');';
  }
  function invRoInjectHtml(text) { /* KM_INV_SCOPE_GRANTS_V1: guard runs before the page's own scripts */
    try {
      text = String(text == null ? '' : text);
      var tag = '<script id="kmInvRoGuardTag">' + invRoGuardSrc() + '<\/script>';
      var head = text.slice(0, 8192).toLowerCase();
      var from = 0;
      while (true) {
        var i = head.indexOf('<head', from);
        if (i < 0) break;
        var ch = head.charAt(i + 5);
        if (ch === '>' || ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
          var j = text.indexOf('>', i);
          if (j > i) return text.slice(0, j + 1) + tag + text.slice(j + 1);
          break;
        }
        from = i + 5;
      }
      return tag + text;
    } catch (e) { return text; }
  }
  function invRoAttach(frameId) { /* KM_INV_SCOPE_GRANTS_V1: parent-side enforcement on every iframe load */
    try {
      var fr = document.getElementById(frameId);
      if (!fr || fr.getAttribute('data-km-ro-hook') === '1') return;
      fr.setAttribute('data-km-ro-hook', '1');
      fr.addEventListener('load', function () {
        try {
          var cw = fr.contentWindow, cd = fr.contentDocument;
          if (!cw || !cd) return;
          if (cw.__kmInvRoGuard && typeof cw.__kmInvRoGuard.apply === 'function') { cw.__kmInvRoGuard.apply(); return; }
          var s = cd.createElement('script');
          s.textContent = invRoGuardSrc();
          (cd.head || cd.documentElement).appendChild(s);
        } catch (e) {}
      });
    } catch (e0) {}
  }
  /* === /KM_INV_SCOPE_GRANTS_V1 === */

  /* === KM_HAMALR_MOVE_V1 === «Համալրվածության վերաբերյալ հաշվետվություն» lives in the Հաշվառում hub.
     Flow: path chooser (Ստորաբաժանում / Ծառայություն) -> that unit's list (same lists as Գույքի հաշվառում) -> report.
     Storage is unchanged: localStorage 'km_hamalr_v1::<corps>|<unit>|<path>:<sid>' (invScopedIframeId, as before).
     Grants are unchanged too: invSecAccess(path, 'hamalr') = unitInventory | unitInventory:sub|svc | unitInventory:sub|svc:hamalr
     (plus every parent, e.g. accounting, through kmGrantParents). */
  function hamFilter() {
    if (!window._kmUtHamFilter || typeof window._kmUtHamFilter !== 'object') window._kmUtHamFilter = { path: '', sid: '', name: '', scope: '' };
    var f = window._kmUtHamFilter;
    if (f.path == null) f.path = '';
    if (f.sid == null) f.sid = '';
    if (f.name == null) f.name = '';
    return f;
  }
  function hamAccess(path) {
    try { return invSecAccess(String(path) === 'subdivision' ? 'subdivision' : 'service', 'hamalr'); } catch (e) { return { view: true, edit: canEdit() }; }
  }
  function hamPathVisible(path) { try { return !!hamAccess(path).view; } catch (e) { return true; } }
  function hamList(path) {
    try { return String(path) === 'subdivision' ? invListManualSubdivisions() : invListServicesFromArchive(); } catch (e) { return []; }
  }
  window.kmUnitHamPathChoose = function (pathName) {
    var p = String(pathName || '').trim();
    if (p !== 'subdivision' && p !== 'service') return;
    if (!hamPathVisible(p)) { toastErr('Այս բաժինը ձեզ թույլատրված չէ'); return; }
    var f = hamFilter();
    f.path = p; f.sid = ''; f.name = '';
    window.kmUnitOpen('unitHamalr');
  };
  window.kmUnitHamOpen = function (id, name) {
    var f = hamFilter();
    if (!f.path) return;
    f.sid = String(id || '').trim();
    f.name = String(name || f.sid);
    window.kmUnitOpen('unitHamalr');
  };
  window.kmUnitHamListBack = function () {
    var f = hamFilter();
    f.sid = ''; f.name = '';
    window.kmUnitOpen('unitHamalr');
  };
  window.kmUnitHamPathBack = function () {
    var f = hamFilter();
    f.path = ''; f.sid = ''; f.name = '';
    window.kmUnitOpen('unitHamalr');
  };
  /* header «← Վերադարձ»: report -> list -> paths -> Հաշվառում */
  window.kmUnitHamHeaderBack = function () {
    try {
      var f = hamFilter();
      if (f.path && f.sid) { window.kmUnitHamListBack(); return; }
      if (f.path) { window.kmUnitHamPathBack(); return; }
      f.sid = ''; f.name = '';
    } catch (eHb) {}
    if (typeof window.kmBackToPage === 'function') window.kmBackToPage('accounting');
    else if (typeof window.kmReportsBack === 'function') window.kmReportsBack();
  };
  function renderHamalr(h) {
    var T = PAGES.unitHamalr;
    try { var __pt = document.getElementById('pageTitle'); if (__pt) __pt.textContent = T; } catch (ePt) {}
    try { window.kmUnitEnsureStores(); invEnsureServices(); } catch (eEs) {}
    var f = hamFilter(); /* corps + unit come from the org context (menus stay locked until both are chosen) */
    var scNow = invOrgScope();
    if (f.scope && f.scope !== scNow) { f.path = ''; f.sid = ''; f.name = ''; } /* another unit -> path chooser */
    if (f.path && !hamPathVisible(f.path)) { f.path = ''; f.sid = ''; f.name = ''; }
    f.scope = f.path ? scNow : '';
    var cardHtml = function (onclick, text, icon) {
      return '<button type="button" class="kmLawCard" onclick="' + onclick + '"><span class="kmLawCardText">' + text + '</span><span class="kmLawCardIcon">' + icon + '</span></button>';
    };
    if (!f.path) {
      var subV = hamPathVisible('subdivision'), svcV = hamPathVisible('service');
      h.innerHTML = shell(T,
        '<p class="kmUtMuted" style="margin:0 0 12px">Ընտրեք ուղին՝ հաշվետվությունը պահվում է առանձին ըստ զորամասի և ստորաբաժանման / ծառայության։</p>' +
        '<div class="kmLawsGrid" data-km-cards="1">' +
          (subV ? cardHtml("kmUnitHamPathChoose('subdivision')", 'Ստորաբաժանում' + invRoHintHtml('subdivision', 'hamalr'), '🏢') : '') +
          (svcV ? cardHtml("kmUnitHamPathChoose('service')", 'Ծառայություն' + invRoHintHtml('service', 'hamalr'), '🛡️') : '') +
        '</div>' +
        ((subV || svcV) ? '' : '<p class="kmUtMuted">Այս հաշվետվությունը Ձեզ հասանելի չէ։</p>'));
      return;
    }
    var isSub = f.path === 'subdivision';
    var items = hamList(f.path);
    if (!f.sid) {
      var cards = items.map(function (s) {
        if (!s || !s.id) return '';
        var nm = String(s.name || s.id);
        return cardHtml("kmUnitHamOpen('" + esc(s.id) + "', '" + esc(nm.replace(/['\\]/g, '')) + "')", esc(nm), isSub ? '🏢' : '🛡️');
      }).join('');
      var empty = isSub
        ? 'Ստորաբաժանում չկա։ Ավելացրեք ստորաբաժանումները <b>Գույքի հաշվառում</b> → <b>Ստորաբաժանում</b> բաժնում։'
        : 'Ծառայություններ չգտնվեցին։';
      h.innerHTML = shell(T,
        '<div class="kmUtActions" style="margin-bottom:8px"><button type="button" onclick="kmUnitHamPathBack()">← Ուղիներ</button> <b>' + (isSub ? 'Ստորաբաժանում' : 'Ծառայություն') + '</b></div>' +
        (cards ? '<div class="kmLawsGrid" data-km-cards="1">' + cards + '</div>' : '<p class="kmUtMuted">' + empty + '</p>'));
      return;
    }
    var title = '';
    for (var i = 0; i < items.length; i++) { if (items[i] && String(items[i].id) === f.sid) { title = String(items[i].name || ''); break; } }
    if (!title) { try { var sv = invServiceById(f.sid); if (sv && sv.name) title = String(sv.name); } catch (eSv) {} }
    if (!title) title = f.name && f.name !== f.sid ? f.name : String(f.sid).replace(/^(svc_arch_|sub_m_|sub_)/, '').replace(/_+/g, ' ').trim();
    var acc = hamAccess(f.path);
    var hScope = f.path + ':' + f.sid;
    try { hScope = invScopedIframeId('km_hamalr_v1::', f.path, f.sid); } catch (eSh) {} /* same key as before the move */
    h.innerHTML = shell(T,
      '<div class="kmUtActions" style="margin-bottom:8px"><button type="button" onclick="kmUnitHamListBack()">' + (isSub ? '← Ստորաբաժանումներ' : '← Ծառայություններ') + '</button> <b>' + esc(title) + '</b></div>' +
      (acc.edit ? '' : invRoBannerHtml()) +
      '<iframe id="kmHamalrFrame" allow="fullscreen" allowfullscreen title="' + esc(T) + '" src="' + kmHamalrReportBlobUrl(hScope, title, { ro: !acc.edit }) + '" ' +
        'style="width:100%;height:78vh;min-height:560px;border:1px solid #c5d0da;border-radius:10px;background:#fff"></iframe>');
    try { if (!acc.edit) invRoAttach('kmHamalrFrame'); } catch (eRo) {}
  }
  /* === /KM_HAMALR_MOVE_V1 === */
  function renderInventory(h) { /* KM_INV_SERVICES_V1 */
    window.kmUnitEnsureStores();
    invEnsureServices();
    var __f = invEnsurePathFilter(); /* KM_INV_PATH_CHOOSER_V1 */ /* KM_INV_PATH_ARCHIVE_V1 */
    try { var __scNow = invOrgScope(); if (__f.scope && __f.scope !== __scNow) { __f.path = ''; __f.targetId = ''; __f.serviceId = ''; window._kmUtInvDocTab = ''; } __f.scope = __f.path ? __scNow : ''; } catch (eScB) {} /* KM_BACK_AUDIT_V1: another unit selected -> start at the path chooser */
    var pathMode = String(__f.path || '').trim();
    try { if (pathMode && !invPathVisible(pathMode)) { pathMode = ''; __f.path = ''; __f.targetId = ''; __f.serviceId = ''; window._kmUtInvDocTab = ''; } } catch (ePV) {} /* KM_INV_SCOPE_GRANTS_V1 */
    var sid = String(__f.targetId || __f.serviceId || '').trim();
    if (sid && !__f.serviceId) __f.serviceId = sid;
    if (sid && !__f.targetId) __f.targetId = sid;
    var services = db.unitInventoryServices || [];
    var counts = invServiceCounts();

    var adminBar = '';
    if (invCanManageServices()) {
      invEnsureServices();
      var remOpts = (db.unitInventoryServices || []).filter(function (s) {
        return s && s.id && String(s.id) !== 'svc_other' && !invIsServiceCategoryHeader(s.name || s.id); /* KM_UI6_FILTER_SVC_HEADERS_V1 */
      }).map(function (s) {
        return '<option value="' + esc(s.id) + '">' + esc(s.name || s.id) + '</option>';
      }).join('');
      adminBar =
        '<div class="kmUtForm" style="margin-bottom:10px;align-items:flex-end">' +
          '<label style="flex:1;min-width:200px">Նոր ծառայություն' +
            '<input id="kmUtInvSvcName" type="text" placeholder="օր. Կապի ծառայություն" maxlength="120">' +
          '</label>' +
          '<button type="button" class="primary" onclick="kmUnitInvServiceAdd()">Ավելացնել ծառայություն</button>' +
          '<label style="flex:1;min-width:200px">Հեռացնել ծառայություն' +
            '<select id="kmUtInvSvcRemove">' +
              '<option value="">— ընտրել —</option>' + remOpts +
            '</select>' +
          '</label>' +
          '<button type="button" class="danger" onclick="kmUnitInvServiceRemoveSelected()">Հեռացնել ծառայություն</button>' +
        '</div>';
    }


    if (!pathMode) {
      h.innerHTML = shell(PAGES.unitInventory,
        '<p class="kmUtMuted" style="margin:0 0 12px">Ընտրեք հաշվառման ուղին՝ ըստ <b>Զորամասի արխիվի</b>։</p>' +
        '<div class="kmLawsGrid" data-km-cards="1">' + /* KM_INV_CARDS_UNIFORM_V1 */
          (invPathVisible('subdivision') ? '<button type="button" class="kmLawCard" onclick="kmUnitInvPathChoose(\'subdivision\')"><span class="kmLawCardText">Ստորաբաժանում</span><span class="kmLawCardIcon">🏢</span></button>' : '') + /* KM_INV_SCOPE_GRANTS_V1 */
          (invPathVisible('service') ? '<button type="button" class="kmLawCard" onclick="kmUnitInvPathChoose(\'service\')"><span class="kmLawCardText">Ծառայություն</span><span class="kmLawCardIcon">🛡️</span></button>' : '') +
        '</div>' +
        ((invPathVisible('subdivision') || invPathVisible('service')) ? '' : '<p class="kmUtMuted">Գույքի հաշվառման բաժիններ Ձեզ հասանելի չեն։</p>')); /* KM_INV_SCOPE_GRANTS_V1 */
      return;
    }
    if (!sid) {
      var listItems = (pathMode === 'subdivision') ? invListManualSubdivisions() : invListServicesFromArchive(); /* KM_INV_SUB_MANUAL_V1: subdivisions are manual only */
      var headLabel = pathMode === 'subdivision' ? 'Ստորաբաժանում' : 'Ծառայություն';
      var emptyMsg = pathMode === 'subdivision'
        ? 'Ստորաբաժանում չկա։ Ավելացրեք վերևի դաշտով։' /* KM_INV_SUB_MANUAL_V1 */
        : 'Արխիվում ծառայություններ չգտնվեցին։';
      var rowsPath = listItems.map(function (s) {
        if (!s || !s.id) return '';
        var n = counts[s.id] || 0;
        return '<tr><td><b>' + esc(s.name || s.id) + '</b>' +
          (s.kind ? (' <span class="muted">(' + esc(s.kind) + ')</span>') : '') +
          '</td><td class="muted">' + n + ' գրառում</td>' +
          '<td class="kmUtActions">' +
            '<button type="button" class="primary" onclick="kmUnitInvTargetOpen(\'' + esc(s.id) + '\', \'' + esc(String(s.name || s.id).replace(/['\\]/g, '')) /* KM_INV_SUB_MANUAL_V1 */ + '\')">Բացել</button>' +
          '</td></tr>';
      }).join('') || ('<tr><td colspan="3" class="kmUtMuted">' + emptyMsg + '</td></tr>');
      h.innerHTML = shell(PAGES.unitInventory,
        '<div class="kmUtActions" style="margin-bottom:8px">' +
          '<button type="button" onclick="kmUnitInvPathBack()">← Ուղիներ</button> <b>' + esc(headLabel) + '</b></div>' +
        (pathMode === 'subdivision' /* KM_INV_SUB_MANUAL_V1 */
          ? '<p class="kmUtMuted" style="margin:0 0 10px">Ստորաբաժանումները ավելացվում են ձեռքով՝ ընտրված զորամասի համար։</p>'
          : '<p class="kmUtMuted" style="margin:0 0 10px">Ցուցակը կազմված է ընտրված զորամասի <b>Զորամասի արխիվ</b>ից։</p>') +
        (pathMode === 'service' ? adminBar : invSubAdminBar()) +
        '<div class="gridwrap"><table class="kmUtTable"><thead><tr><th>' + esc(headLabel) + '</th><th>Գրառումներ</th><th></th></tr></thead><tbody>' +
        rowsPath + '</tbody></table></div>');
      return;
    }

    if (false && !sid) { /* legacy list disabled */
      var rows = services.map(function (s) {
        if (!s || !s.id) return '';
        var n = counts[s.id] || 0;
        var delBtn = (invCanManageServices() && String(s.id) !== 'svc_other')
          ? ('<button type="button" class="danger" onclick="kmUnitInvServiceDel(\'' + esc(s.id) + '\')">Ջնջել</button>')
          : '';
        return '<tr><td><b>' + esc(s.name || s.id) + '</b></td><td class="muted">' + n + ' գրառում</td>' +
          '<td class="kmUtActions">' +
            '<button type="button" class="primary" onclick="kmUnitInvServiceOpen(\'' + esc(s.id) + '\')">Բացել</button> ' +
            delBtn +
          '</td></tr>';
      }).join('') || '<tr><td colspan="3" class="kmUtMuted">Ծառայություն չկա</td></tr>';

      h.innerHTML = shell(PAGES.unitInventory,
        '<p class="kmUtMuted" style="margin:0 0 10px">Գույքը բաժանված է ծառայություններով։ Ընտրեք ծառայությունը։</p>' +
        adminBar +
        '<div class="gridwrap"><table class="kmUtTable"><thead><tr><th>Ծառայություն</th><th>Գրառումներ</th><th></th></tr></thead><tbody>' +
        rows + '</tbody></table></div>');
      return;
    }

    var svc = invServiceById(sid);
    var title = (svc && svc.name) ? svc.name : ''; /* KM_INV_TITLE_NO_ID_V1 */
    if (!title) { try { var __all = invListServicesFromArchive().concat(invListManualSubdivisions(), invListSubdivisionsFromArchive()); /* KM_INV_SUB_MANUAL_V1 */ for (var __i = 0; __i < __all.length; __i++) { if (__all[__i] && String(__all[__i].id) === sid) { title = __all[__i].name; break; } } } catch (eT) {} }
    if (!title && window._kmUtInvTargetName && window._kmUtInvTargetName !== sid) title = String(window._kmUtInvTargetName);
    if (!title) title = String(sid || '').replace(/^(svc_arch_|sub_)/, '').replace(/_+/g, ' ').trim();
    /* KM_INV_DOC_ENTER_V1: content only after entering a section */
    if (window._kmUtInvDocTab == null) window._kmUtInvDocTab = '';
    var tab = String(window._kmUtInvDocTab || '').trim();
    /* KM_INV_FORM_BY_PATH_V1: Form 27 only for services, Form 26 only for subdivisions */
    if ((tab === 'f27' && pathMode !== 'service') || (tab === 'f26' && pathMode !== 'subdivision') || tab === 'hamalr' /* KM_HAMALR_MOVE_V1 */) { tab = ''; window._kmUtInvDocTab = ''; }
    var __invAcc = { view: true, edit: canEdit() }; /* KM_INV_SCOPE_GRANTS_V1 */
    try {
      if (tab) {
        __invAcc = invSecAccess(pathMode, tab);
        if (!__invAcc.view) { toastErr('Այս բաժինը ձեզ թույլատրված չէ'); tab = ''; window._kmUtInvDocTab = ''; __invAcc = { view: true, edit: false }; }
      }
    } catch (eAcc) { __invAcc = { view: true, edit: canEdit() }; }
    var bal = invBalance(sid).map(function (b) {
      return '<tr class="' + (b.qty <= 0 ? 'danger' : '') + '"><td>' + esc(b.category) + '</td><td>' + esc(b.name) +
        '</td><td>' + esc(b.unit) + '</td><td><b>' + esc(String(b.qty)) + '</b></td></tr>';
    }).join('') || '<tr><td colspan="4" class="kmUtMuted">Մնացորդ չկա</td></tr>';
    function invDocTabBtn(id, label) {
      var on = tab === id;
      return '<button type="button" class="' + (on ? 'primary' : '') + '" style="margin:0 6px 6px 0"' +
        ' onclick="kmUnitInvDocTab(\'' + id + '\')">' + label + '</button>';
    }
    invEnsureDocs();
    var docs = invDocsForService(sid, tab);
    var docRows = docs.slice().reverse().slice(0, 120).map(function (d) {
      return '<tr><td>' + esc(fmtDate(d.date)) + '</td><td>' + esc(d.number || '') + '</td><td>' + esc(d.title || '') +
        '</td><td>' + esc(d.person || '') + '</td><td>' + esc(d.note || '') + '</td><td class="kmUtActions">' +
        (__invAcc.edit /* KM_INV_SCOPE_GRANTS_V1 */ ? '<button type="button" class="danger" onclick="kmUnitInvDocDel(\'' + esc(d.id) + '\')">Ջնջել</button>' : '') +
        '</td></tr>';
    }).join('') || '<tr><td colspan="6" class="kmUtMuted">Գրառում չկա</td></tr>';
    var tabLabels = { apranq_mutq: 'Մուտքի ապրանքագիր', apranq_elq: 'Ելքի ապրանքագիր', hamalr: 'Համալրվածության վերաբերյալ հաշվետվություն', f27: 'Ձև 27 մատյան', f28: 'Ձև 28 մատյան', f26: 'Ձև 26 մատյան', invoice: 'ապրանքագիր', receipt: 'Ստացական' }; /* KM_INV_SCOPE_GRANTS_V1 */
    var tabTitle = tab ? (tabLabels[tab] || tab) : '';
    /* KM_FORM27_LEDGER_IFRAME_V1: each service has its own Form 27 ledger */
    var ledgerHtml = '';
    var hamalrHtml = ''; /* KM_HAMALR_REPORT_V1 */
    var apranqHtml = ''; /* KM_APRANQ_V1 */
    if (tab === 'apranq_mutq' || tab === 'apranq_elq') {
      var aScope = String(pathMode || 'service') + ':' + String(sid || '');
      try { aScope = invScopedIframeId('km_apranq_' + (tab === 'apranq_elq' ? 'elq' : 'mutq') + '_v1::', pathMode || 'service', sid); } catch (eSa) {} /* KM_INV_SCOPE_GRANTS_V1 */
      var aKind = tab === 'apranq_elq' ? 'elq' : 'mutq';
      var aTitle = tab === 'apranq_elq' ? 'Ելքի ապրանքագիր' : 'Մուտքի ապրանքագիր';
      apranqHtml = (__invAcc.edit ? '' : invRoBannerHtml()) + /* KM_INV_SCOPE_GRANTS_V1 */ '<iframe id="kmApranqFrame" allow="fullscreen" allowfullscreen title="' + aTitle + '" src="' + kmApranqBlobUrl(aKind, aScope, title, { ro: !__invAcc.edit }) + '" ' +
        'style="width:100%;height:78vh;min-height:560px;border:1px solid #c5d0da;border-radius:10px;background:#fff"></iframe>';
    }
    if (tab === 'hamalr') {
      var hScope = String(pathMode || 'service') + ':' + String(sid || '');
      try { hScope = invScopedIframeId('km_hamalr_v1::', pathMode || 'service', sid); } catch (eSh) {} /* KM_INV_SCOPE_GRANTS_V1 */
      hamalrHtml = (__invAcc.edit ? '' : invRoBannerHtml()) + /* KM_INV_SCOPE_GRANTS_V1 */ '<iframe id="kmHamalrFrame" allow="fullscreen" allowfullscreen title="' + 'Համալրվածության վերաբերյալ հաշվետվություն' + '" src="' + kmHamalrReportBlobUrl(hScope, title, { ro: !__invAcc.edit }) + '" ' +
        'style="width:100%;height:78vh;min-height:560px;border:1px solid #c5d0da;border-radius:10px;background:#fff"></iframe>';
    }
    if (tab === 'f27') {
      var __f27Opts = null; /* KM_INV_SCOPE_GRANTS_V1 */
      try {
        var __f27New = invF27SvcKey(pathMode || 'service', sid), __f27Old = invF27LegacySvc(sid);
        __f27Opts = { svcKey: __f27New, ro: !__invAcc.edit, migrate: invOrgParts().real ? function () { return invF27Migrate(__f27Old, __f27New); } : null };
      } catch (eF27) { __f27Opts = null; }
      var ledgerSrc = kmForm27LedgerBlobUrl(sid, title, __f27Opts); /* KM_FORM27_BLOB_EMBED_V1 */
      ledgerHtml =
        '<p class="kmUtMuted" style="margin:0 0 8px">Այս ծառայության <b>Ձև 27 մատյան</b>ը՝ լիստեր, պահպանում, աղբարկղ, մասշտաբ։</p>' +
        (__invAcc.edit ? '' : invRoBannerHtml()) + /* KM_INV_SCOPE_GRANTS_V1 */ '<iframe id="kmF27LedgerFrame" allow="fullscreen" allowfullscreen title="Ձև 27 մատյան" src="' + ledgerSrc + '" ' +
          'style="width:100%;height:72vh;min-height:520px;border:1px solid #c5d0da;border-radius:10px;background:#fff"></iframe>';
    }

    h.innerHTML = shell(PAGES.unitInventory,
      '<div class="kmUtActions" style="margin-bottom:8px">' +
        '<button type="button" onclick="kmUnitInvServiceBack()">' + (pathMode === 'subdivision' ? '← Ստորաբաժանումներ' : '← Ծառայություններ') + '</button> ' + /* KM_BACK_AUDIT_V1 */
        '<b>' + esc(title) + '</b> ' +
        '<button type="button" class="primary" onclick="kmUnitInvPrint()">Տպել մնացորդ</button>' +
      '</div>' +
      '<h4>Մնացորդ — ' + esc(title) + '</h4><div class="gridwrap"><table class="kmUtTable"><thead><tr><th>Կատեգորիա</th><th>Անվանում</th><th>Միավոր</th><th>Քանակ</th></tr></thead><tbody>' +
      bal + '</tbody></table></div>' +
      (function () {
        /* KM_INV_DOC_ENTER_V1 */
        var sections = [
          ['f27', 'Ձև 27 մատյան'],
          ['f28', 'Ձև 28 մատյան'],
          ['f26', 'Ձև 26 մատյան'],
          ['apranq_mutq', 'Մուտքի ապրանքագիր'], /* KM_APRANQ_V1 */
          ['apranq_elq', 'Ելքի ապրանքագիր'],
          ['receipt', 'Ստացական'] /* KM_INV_SCOPE_GRANTS_V1 */
          /* KM_HAMALR_MOVE_V1: hamalr card moved to Հաշվառում → «Համալրվածության վերաբերյալ հաշվետվություն» */
        ].filter(function (s) { /* KM_INV_FORM_BY_PATH_V1 */
          if (s[0] === 'f27') return pathMode === 'service';
          if (s[0] === 'f26') return pathMode === 'subdivision';
          return true;
        }).filter(function (s) { /* KM_INV_SCOPE_GRANTS_V1 */
          try { return invSecAccess(pathMode, s[0]).view; } catch (eSv) { return true; }
        });
        if (!tab) {
          return '<h4 style="margin:14px 0 8px">Բաժիններ</h4>' +
            '<p class="kmUtMuted" style="margin:0 0 10px">Մտեք բաժին՝ պարունակությունը տեսնելու համար։</p>' +
            '<div class="kmLawsGrid" data-km-cards="1">' + /* KM_INV_CARDS_UNIFORM_V1 */
            sections.map(function (s) {
              var ic = { f27: '📒', f28: '📗', f26: '📘', apranq_mutq: '📥', apranq_elq: '📤', receipt: '🧾', hamalr: '📊' }[s[0]] || '📄';
              return '<button type="button" class="kmLawCard" onclick="kmUnitInvDocEnter(\'' +
                s[0] + '\')"><span class="kmLawCardText">' + s[1] + invRoHintHtml(pathMode, s[0]) /* KM_INV_SCOPE_GRANTS_V1 */ + '</span><span class="kmLawCardIcon">' + ic + '</span></button>';
            }).join('') + '</div>' +
            (sections.length ? '' : '<p class="kmUtMuted">Այստեղ Ձեզ հասանելի բաժիններ չկան։</p>'); /* KM_INV_SCOPE_GRANTS_V1 */
        }
        var body = '';
        if (tab === 'f27') {
          body = ledgerHtml;
        } else if (tab === 'hamalr') { /* KM_HAMALR_REPORT_V1 */
          body = hamalrHtml;
        } else if (tab === 'apranq_mutq' || tab === 'apranq_elq') { /* KM_APRANQ_V1 */
          body = apranqHtml;
        } else {
          body = '<h4 style="margin:0 0 8px">' + esc(tabTitle) + '</h4>' +
            (__invAcc.edit ? '' : invRoBannerHtml()) + /* KM_INV_SCOPE_GRANTS_V1 */
            (__invAcc.edit /* KM_INV_SCOPE_GRANTS_V1 */ ? '<div class="kmUtForm">' +
              '<input type="hidden" id="kmUtInvServiceId" value="' + esc(sid) + '">' +
              '<input type="hidden" id="kmUtInvDocKind" value="' + esc(tab) + '">' +
              '<label>Համար<input id="kmUtInvDocNo" placeholder="օր. 12/27"></label>' +
              '<label>Անվանում / բովանդակություն<input id="kmUtInvDocTitle" placeholder="փաստաթղթի անվանում"></label>' +
              '<label>Ա․Ա․Հ' + peopleSelect('kmUtInvDocPerson') + '</label>' +
              '<label>Ամսաթիվ<input id="kmUtInvDocDate" type="date" value="' + todayIso() + '"></label>' +
              '<label>Նշում<input id="kmUtInvDocNote" placeholder="նշում"></label>' +
              '<button type="button" class="primary" onclick="kmUnitInvDocSave()">Ավելացնել</button></div>' : '') +
            '<div class="gridwrap"><table class="kmUtTable"><thead><tr><th>Ամսաթիվ</th><th>Համար</th><th>Անվանում</th><th>Ա․Ա․Հ</th><th>Նշում</th><th></th></tr></thead><tbody>' +
            docRows + '</tbody></table></div>';
        }
        return '<div style="margin:14px 0 8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
          '<button type="button" onclick="kmUnitInvDocBack()">← Բաժիններ</button> ' +
          '<b>' + esc(tabTitle) + '</b></div>' + body;
      })() );
    try { if (tab && !__invAcc.edit) { invRoAttach('kmF27LedgerFrame'); invRoAttach('kmHamalrFrame'); invRoAttach('kmApranqFrame'); } } catch (eRoA) {} /* KM_INV_SCOPE_GRANTS_V1 */
  }

    /* KM_INV_DOCS_V1 */
  function invEnsureDocs() {
    if (!Array.isArray(db.unitInventoryDocs)) db.unitInventoryDocs = [];
    return db.unitInventoryDocs;
  }
  function invDocsForService(serviceId, kind) {
    invEnsureDocs();
    serviceId = String(serviceId || '').trim();
    kind = String(kind || '').trim();
    var __o = null, __p = ''; /* KM_INV_SCOPE_GRANTS_V1 */
    try { __o = invOrgParts(); __p = String((window._kmUtInvFilter && window._kmUtInvFilter.path) || '').trim(); } catch (eO) { __o = null; }
    return (db.unitInventoryDocs || []).filter(function (d) {
      if (!(d && String(d.serviceId || '') === serviceId && String(d.kind || '') === kind)) return false;
      try { return invDocOwned(d, __o, __p); } catch (eF) { return true; } /* KM_INV_SCOPE_GRANTS_V1 */
    });
  }
  window.kmUnitInvDocTab = function (id) {
    window._kmUtInvDocTab = String(id || '').trim();
    window.kmUnitOpen('unitInventory');
  };
  window.kmUnitInvDocEnter = function (id) {
    try { var __k = String(id || '').trim(); if (__k && !invSecAccess(invCurPath(), __k).view) { toastErr('Այս բաժինը ձեզ թույլատրված չէ'); return; } } catch (eEn) {} /* KM_INV_SCOPE_GRANTS_V1 */
    window._kmUtInvDocTab = String(id || '').trim();
    window.kmUnitOpen('unitInventory');
  };
  window.kmUnitInvDocBack = function () {
    window._kmUtInvDocTab = '';
    window.kmUnitOpen('unitInventory');
  };
  window.kmUnitInvDocSave = async function () {
    var __ke = document.getElementById('kmUtInvDocKind'); /* KM_INV_SCOPE_GRANTS_V1: section edit grant, not just canEdit() */
    if (!invDocEditAllowed(__ke ? String(__ke.value || '').trim() : String(window._kmUtInvDocTab || ''), invCurPath())) { toastErr('Փոփոխության իրավունք չունեք'); return; }
    window.kmUnitEnsureStores();
    invEnsureDocs();
    var kindEl = document.getElementById('kmUtInvDocKind');
    var kind = kindEl ? String(kindEl.value || '').trim() : String(window._kmUtInvDocTab || 'f27');
    var svcEl = document.getElementById('kmUtInvServiceId');
    var serviceId = svcEl ? String(svcEl.value || '').trim() : String((window._kmUtInvFilter && window._kmUtInvFilter.serviceId) || '').trim();
    if (!serviceId) { toastErr('Ծառայություն ընտրված չէ'); return; }
    var titleEl = document.getElementById('kmUtInvDocTitle');
    var title = titleEl ? String(titleEl.value || '').trim() : '';
    if (!title) { toastErr('Գրեք անվանումը'); return; }
    var noEl = document.getElementById('kmUtInvDocNo');
    var personEl = document.getElementById('kmUtInvDocPerson');
    var dateEl = document.getElementById('kmUtInvDocDate');
    var noteEl = document.getElementById('kmUtInvDocNote');
    db.unitInventoryDocs.push({
      id: uid('invdoc'),
      kind: kind,
      serviceId: serviceId,
      number: noEl ? String(noEl.value || '').trim() : '',
      title: title,
      person: personEl ? String(personEl.value || '').trim() : '',
      date: dateEl ? String(dateEl.value || todayIso()) : todayIso(),
      note: noteEl ? String(noteEl.value || '').trim() : '',
      corpsId: invOrgParts().corpsId, /* KM_INV_SCOPE_GRANTS_V1 */
      unitId: invOrgParts().unitId,
      path: invCurPath()
    });
    await persist(true);
    toastOk('Գրանցվեց');
    window.kmUnitOpen('unitInventory');
  };
  window.kmUnitInvDocDel = async function (id) {
    var __okDel = false; /* KM_INV_SCOPE_GRANTS_V1: section edit grant of that document */
    try {
      var __dd = (db.unitInventoryDocs || []).filter(function (x) { return x && String(x.id) === String(id || ''); })[0];
      __okDel = __dd ? invDocEditAllowed(String(__dd.kind || ''), String(__dd.path || '') || invCurPath()) : false;
    } catch (eDd) { __okDel = canEdit(); }
    if (!__okDel) { toastErr('Փոփոխության իրավունք չունեք'); return; }
    if (!confirm('Ջնջե՞լ')) return;
    invEnsureDocs();
    id = String(id || '');
    db.unitInventoryDocs = (db.unitInventoryDocs || []).filter(function (x) { return x && String(x.id) !== id; });
    await persist(true);
    window.kmUnitOpen('unitInventory');
  };

  window.kmUnitInvServiceOpen = function (id) { /* KM_INV_PATH_ARCHIVE_V1 */
    var f = invEnsurePathFilter();
    id = String(id || '').trim();
    f.serviceId = id;
    f.targetId = id;
    if (!f.path) f.path = 'service';
    window._kmUtInvDocTab = '';
    window.kmUnitOpen('unitInventory');
  };
  window.kmUnitInvServiceBack = function () { /* KM_INV_PATH_ARCHIVE_V1 */
    var f = invEnsurePathFilter();
    f.targetId = '';
    f.serviceId = '';
    window._kmUtInvDocTab = '';
    window.kmUnitOpen('unitInventory');
  };
  /* KM_BACK_AUDIT_V1: header «← Վերադարձ» of Գույքի հաշվառում steps back one level (section -> sections -> list -> paths -> leave) */
  window.kmUnitInvHeaderBack = function () {
    try {
      var f = invEnsurePathFilter();
      var sid = String(f.targetId || f.serviceId || '').trim();
      if (f.path && sid && window._kmUtInvDocTab) { window.kmUnitInvDocBack(); return; }
      if (f.path && sid) { window.kmUnitInvServiceBack(); return; }
      if (f.path) { window.kmUnitInvPathBack(); return; }
      f.targetId = ''; f.serviceId = ''; window._kmUtInvDocTab = '';
    } catch (eHb) {}
    if (typeof window.kmReportsBack === 'function') window.kmReportsBack();
  };
  window.kmUnitInvServiceAdd = async function () {
    if (!invCanManageServices()) return;
    window.kmUnitEnsureStores();
    invEnsureServices();
    var el = document.getElementById('kmUtInvSvcName');
    var name = el ? String(el.value || '').trim() : '';
    if (!name) { toastErr('Գրեք ծառայության անունը'); return; }
    if (name.length > 120) { toastErr('Անունը շատ երկար է'); return; }
    var low = name.toLowerCase();
    var exists = (db.unitInventoryServices || []).some(function (s) {
      return s && String(s.name || '').trim().toLowerCase() === low;
    });
    if (exists) { toastErr('Այդ ծառայությունն արդեն կա'); return; }
    var id = 'svc_' + String(Date.now()) + '_' + Math.floor(Math.random() * 1000);
    db.unitInventoryServices.push({ id: id, name: name });
    try { if (el) el.value = ''; } catch (_e) {}
    await persist(true);
    toastOk('Ծառայությունը ավելացվեց');
    window.kmUnitOpen('unitInventory');
  };
  window.kmUnitInvServiceRemoveSelected = async function () {
    if (!invCanManageServices()) return;
    var el = document.getElementById('kmUtInvSvcRemove');
    var id = el ? String(el.value || '').trim() : '';
    if (!id) { toastErr('Ընտրեք հեռացվող ծառայությունը'); return; }
    return window.kmUnitInvServiceDel(id);
  };
  window.kmUnitInvServiceDel = async function (id) {
    if (!invCanManageServices()) return;
    id = String(id || '').trim();
    if (!id || id === 'svc_other') return;
    if (!confirm('Ջնջե՞լ ծառայությունը։ Գրառումները կտեղափոխվեն «Այլ»։')) return;
    window.kmUnitEnsureStores();
    invEnsureServices();
    db.unitInventoryServices = (db.unitInventoryServices || []).filter(function (s) {
      return s && String(s.id) !== id;
    });
    (db.unitInventory || []).forEach(function (m) {
      if (m && String(m.serviceId || '') === id) m.serviceId = 'svc_other';
    });
    if (window._kmUtInvFilter) {
      if (window._kmUtInvFilter.serviceId === id) window._kmUtInvFilter.serviceId = '';
      if (window._kmUtInvFilter.targetId === id) window._kmUtInvFilter.targetId = '';
    }
    await persist(true);
    toastOk('Ջնջվեց');
    window.kmUnitOpen('unitInventory');
  };
  window.kmUnitInvSave = async function () {
    if (!canEdit()) return;
    window.kmUnitEnsureStores();
    invEnsureServices();
    var name = document.getElementById('kmUtInvName').value.trim();
    var qty = Number(document.getElementById('kmUtInvQty').value);
    if (!name || !(qty > 0)) { toastErr('Անվանում և քանակ'); return; }
    var svcEl = document.getElementById('kmUtInvServiceId');
    var serviceId = svcEl ? String(svcEl.value || '').trim() : String((window._kmUtInvFilter && window._kmUtInvFilter.serviceId) || '').trim();
    if (!serviceId) serviceId = 'svc_other';
    db.unitInventory.push({
      id: uid('inv'), kind: document.getElementById('kmUtInvKind').value,
      serviceId: serviceId,
      category: document.getElementById('kmUtInvCat').value,
      name: name, unit: document.getElementById('kmUtInvUnit').value.trim(),
      qty: qty, person: String(document.getElementById('kmUtInvPerson').value || '').trim(),
      date: document.getElementById('kmUtInvDate').value || todayIso(),
      note: document.getElementById('kmUtInvNote').value.trim()
    });
    await persist(true);
    toastOk('Գրանցվեց');
    window.kmUnitOpen('unitInventory');
  };
  window.kmUnitInvDel = async function (id) {
    if (!canEdit() || !confirm('Ջնջե՞լ')) return;
    db.unitInventory = db.unitInventory.filter(function (x) { return x.id !== id; });
    await persist(true);
    window.kmUnitOpen('unitInventory');
  };
  window.kmUnitInvPrint = function () {
    var sid = String((window._kmUtInvFilter && window._kmUtInvFilter.serviceId) || '').trim();
    var svc = sid ? invServiceById(sid) : null;
    var head = svc ? (' — ' + (svc.name || '')) : '';
    var rows = invBalance(sid).map(function (b) {
      return '<tr><td>' + esc(b.category) + '</td><td>' + esc(b.name) + '</td><td>' + esc(b.unit) +
        '</td><td>' + esc(String(b.qty)) + '</td></tr>';
    }).join('');
    openPrint('Գույքի մնացորդ',
      '<h2>Գույքի և տեխնիկական միջոցների մնացորդ' + esc(head) + '</h2><p>Ամսաթիվ՝ ' + esc(fmtDate(todayIso())) +
      '</p><table><thead><tr><th>Կատեգորիա</th><th>Անվանում</th><th>Միավոր</th><th>Քանակ</th></tr></thead><tbody>' +
      rows + '</tbody></table>');
  };

  /* ——— 3 Characteristic ——— */
  function charPhrase(score, good, mid, bad) {
    if (score >= 4) return good;
    if (score >= 3) return mid;
    return bad;
  }
  function generateCharText(person, d, f, s, note) {
    var meta = formalMeta();
    var bits = dossierBits(person);
    var rank = String(person.rank || '').trim();
    var name = String(person.name || '').trim();
    var who = [rank, name].filter(Boolean).join(' ');
    var post = bits.post || String(person.post || '').trim();
    var unitLine = post
      ? (meta.unitName + 'ի ' + post)
      : (person.unit ? (meta.unitName + 'ի ' + person.unit) : meta.unitName);
    var headBlock =
      '                                               ' + who + 'ին\n' +
      '                                               ' + unitLine + ',\n' +
      (bits.birth ? ('                                               Ծնված ' + bits.birth + '\n') : '') +
      '                                               Ազգությունը՝ ' + (bits.nation || 'հայ') + ', ' + (bits.party || 'անկուսակցական') + '\n' +
      (bits.education ? ('                                               Կրթությունը՝ ' + bits.education + '\n') : '') +
      (bits.family ? ('                                               ' + bits.family + '\n') : '');
    var disc = charPhrase(d,
      'իրեն դրսևորում է որպես կարգապահ, պարտաճանաչ, գրագետ զինծառայողի, իր վրա դրված ծառայողական պարտականությունները կատարում է ժամանակին և անթերի',
      'ընդհանուր առմամբ կարգապահ է, ծառայողական պարտականությունները կատարում է բավարար մակարդակով',
      'կարգապահության մակարդակը բավարար չէ և պահանջում է լրացուցիչ վերահսկողություն');
    var fit = charPhrase(f,
      'ֆիզիկապես պատրաստ է, դիմացկուն է ծանրաբեռնվածություններին',
      'ֆիզիկական պատրաստությունը միջին մակարդակի է',
      'ֆիզիկական պատրաստությունը թույլ է և պահանջում է բարելավում');
    var shoot = charPhrase(s,
      'ունի կանոնադրությունների և ուղեցույց փաստաթղթերի կայուն իմացություն և ճշտորեն կիրառում է դրանք, վստահ է զենքի և տեխնիկայի հետ աշխատելիս',
      'կրակային և մասնագիտական պատրաստությունը բավարար է',
      'կրակային պատրաստությունը պահանջում է լրացուցիչ պարապմունքներ');
    var body =
      '            ' + who + ' ' + disc +
      ', կարողանում է պահել զինվորական գաղտնիքը, վայելում է հրամանատարության և ենթակաների վստահությունն ու հարգանքը։ ' +
      'Նա հեշտությամբ իրագործում է կազմակերպչական ունակություններ պահանջող խնդիրները։ ' +
      'Դժվարությունների առջև չի կանգնում, ' + shoot + '։ ' +
      'Կարողանում է աշխատել անձնակազմի հետ, տարբերել առաջնային խնդիրները երկրորդականներից։ ' +
      fit + '։\n' +
      (note ? (note + '\n') : '') +
      'Բնութագրվում է ' + (d + f + s >= 12 ? 'դրական' : (d + f + s >= 9 ? 'ընդհանուր առմամբ դրական' : 'պայմանական դրական')) + '։\n\n\n';
    var signs =
      meta.unitCode.toUpperCase().replace(/^ՀՀՊՆ/, 'ՀՀ ՊՆ') + ' ԶՈՐԱՄԱՍԻ ՀՐԱՄԱՆԱՏԱՐ\n' +
      'գնդապետ                                        ' + meta.cmdName.toUpperCase().replace(/\./g, '. ') + '\n\n' +
      meta.unitCode.toUpperCase().replace(/^ՀՀՊՆ/, 'ՀՀ ՊՆ') + ' ԶՈՐԱՄԱՍԻ ԿԱՊԻ ԲԱԺԱՆՄՈՒՆՔԻ ՊԵՏ\n' +
      'մայոր                     ________________';
    return 'ԾԱՌԱՅՈՂԱԿԱՆ ԲՆՈՒԹԱԳԻՐ\n\n' + headBlock + '\n\n' + body + signs;
  }

  function renderChar(h) {
    var rows = db.unitCharDrafts.slice().reverse().map(function (c) {
      return '<tr><td>' + esc(c.person) + '</td><td>' + esc(c.discipline + '/' + c.fitness + '/' + c.shooting) +
        '</td><td>' + esc(fmtDate(c.createdAt)) + '</td><td class="kmUtActions">' +
        '<button type="button" onclick="kmUnitCharPrint(\'' + esc(c.id) + '\')">Տպել</button>' +
        (canEdit() ? '<button type="button" class="danger" onclick="kmUnitCharDel(\'' + esc(c.id) + '\')">Ջնջել</button>' : '') +
        '</td></tr>';
    }).join('') || '<tr><td colspan="4" class="kmUtMuted">Դեռ բնութագիր չկա</td></tr>';
    h.innerHTML = shell(PAGES.unitCharDrafts,
      (canEdit() ? '<div class="kmUtForm">' +
        '<label>Ա․Ա․Հ' + peopleSelect('kmUtCharPerson') + '</label>' +
        '<label>Կարգապահություն<input id="kmUtCharD" type="range" min="1" max="5" value="4" oninput="kmUnitCharPreview()"></label>' +
        '<label>Ֆիզպատրաստություն<input id="kmUtCharF" type="range" min="1" max="5" value="4" oninput="kmUnitCharPreview()"></label>' +
        '<label>Կրակային<input id="kmUtCharS" type="range" min="1" max="5" value="4" oninput="kmUnitCharPreview()"></label>' +
        '<label>Նշում<textarea id="kmUtCharNote" oninput="kmUnitCharPreview()"></textarea></label>' +
        '<button type="button" class="primary" onclick="kmUnitCharSave()">Պահպանել</button></div>' +
        '<label style="display:block;font-weight:700;margin:8px 0 4px">Նախադիտում</label>' +
        '<textarea id="kmUtCharOut" style="width:100%;min-height:180px"></textarea>' : '') +
      '<div class="gridwrap" style="margin-top:12px"><table class="kmUtTable"><thead><tr><th>Ա․Ա․Հ</th><th>Գնահատականներ</th><th>Ամսաթիվ</th><th></th></tr></thead><tbody>' +
      rows + '</tbody></table></div>');
    if (canEdit()) window.kmUnitCharPreview();
  }
  window.kmUnitCharPreview = function () {
    var name = String((document.getElementById('kmUtCharPerson') || {}).value || '').trim();
    var d = Number((document.getElementById('kmUtCharD') || {}).value || 3);
    var f = Number((document.getElementById('kmUtCharF') || {}).value || 3);
    var s = Number((document.getElementById('kmUtCharS') || {}).value || 3);
    var note = (document.getElementById('kmUtCharNote') || {}).value || '';
    var out = document.getElementById('kmUtCharOut');
    if (!out) return;
    out.value = generateCharText(findPerson(name), d, f, s, note);
  };
  window.kmUnitCharSave = async function () {
    if (!canEdit()) return;
    window.kmUnitEnsureStores();
    var name = String(document.getElementById('kmUtCharPerson').value || '').trim();
    if (!name) { toastErr('Գրեք Ա․Ա․Հ'); return; }
    window.kmUnitCharPreview();
    var text = document.getElementById('kmUtCharOut').value;
    db.unitCharDrafts.push({
      id: uid('char'), person: name,
      discipline: Number(document.getElementById('kmUtCharD').value),
      fitness: Number(document.getElementById('kmUtCharF').value),
      shooting: Number(document.getElementById('kmUtCharS').value),
      note: document.getElementById('kmUtCharNote').value.trim(),
      text: text, createdAt: todayIso()
    });
    await persist(true);
    toastOk('Բնութագիրը պահպանվեց');
    window.kmUnitOpen('unitCharDrafts');
  };
  window.kmUnitCharDel = async function (id) {
    if (!canEdit() || !confirm('Ջնջե՞լ')) return;
    db.unitCharDrafts = db.unitCharDrafts.filter(function (x) { return x.id !== id; });
    await persist(true);
    window.kmUnitOpen('unitCharDrafts');
  };
  window.kmUnitCharPrint = function (id) {
    var c = db.unitCharDrafts.find(function (x) { return x.id === id; });
    if (!c) return;
    openPrint('Բնութագիր', '<h2>Ծառայողական բնութագիր</h2><pre style="white-space:pre-wrap;font:inherit">' + esc(c.text) + '</pre>');
  };

  /* ——— 4 Fuel ——— */
  function calcFuel(mode, norm, start, end) {
    var delta = Number(end) - Number(start);
    if (!(delta >= 0) || !(Number(norm) > 0)) return { delta: 0, liters: 0 };
    var liters = mode === 'hour' ? delta * Number(norm) : (delta * Number(norm)) / 100;
    return { delta: delta, liters: Math.round(liters * 100) / 100 };
  }
  function renderFuel(h) {
    var rows = db.unitFuel.slice().reverse().map(function (f) {
      return '<tr><td>' + esc(f.model) + '</td><td>' + esc(f.mode === 'hour' ? 'ժամ' : 'կմ') +
        '</td><td>' + esc(String(f.start)) + '→' + esc(String(f.end)) + '</td><td><b>' + esc(String(f.liters)) +
        ' լ</b></td><td>' + esc(fmtDate(f.date)) + '</td><td class="kmUtActions">' +
        '<button type="button" onclick="kmUnitFuelPrint(\'' + esc(f.id) + '\')">Տպել</button>' +
        (canEdit() ? '<button type="button" class="danger" onclick="kmUnitFuelDel(\'' + esc(f.id) + '\')">Ջնջել</button>' : '') +
        '</td></tr>';
    }).join('') || '<tr><td colspan="6" class="kmUtMuted">Գրառում չկա</td></tr>';
    h.innerHTML = shell(PAGES.unitFuel,
      (canEdit() ? '<div class="kmUtForm">' +
        '<label>Մոդել<input id="kmUtFuelModel" placeholder="օր. Ural-4320"></label>' +
        '<label>Չափ<select id="kmUtFuelMode" onchange="kmUnitFuelPreview()"><option value="km">լ/100կմ</option><option value="hour">լ/ժամ</option></select></label>' +
        '<label>Նորմա<input id="kmUtFuelNorm" type="number" min="0" step="0.1" value="35" oninput="kmUnitFuelPreview()"></label>' +
        '<label>Սկիզբ<input id="kmUtFuelStart" type="number" min="0" step="0.1" value="0" oninput="kmUnitFuelPreview()"></label>' +
        '<label>Վերջ<input id="kmUtFuelEnd" type="number" min="0" step="0.1" value="100" oninput="kmUnitFuelPreview()"></label>' +
        '<label>Վարորդ' + peopleSelect('kmUtFuelDriver') + '</label>' +
        '<label>Ամսաթիվ<input id="kmUtFuelDate" type="date" value="' + todayIso() + '"></label>' +
        '<label>Ծախս (լ)<input id="kmUtFuelLiters" readonly></label>' +
        '<button type="button" class="primary" onclick="kmUnitFuelSave()">Պահպանել</button></div>' : '') +
      '<div class="gridwrap"><table class="kmUtTable"><thead><tr><th>Մոդել</th><th>Տեսակ</th><th>Վազք/ժամ</th><th>Ծախս</th><th>Ամսաթիվ</th><th></th></tr></thead><tbody>' +
      rows + '</tbody></table></div>');
    if (canEdit()) window.kmUnitFuelPreview();
  }
  window.kmUnitFuelPreview = function () {
    var r = calcFuel(
      document.getElementById('kmUtFuelMode').value,
      document.getElementById('kmUtFuelNorm').value,
      document.getElementById('kmUtFuelStart').value,
      document.getElementById('kmUtFuelEnd').value
    );
    var el = document.getElementById('kmUtFuelLiters');
    if (el) el.value = String(r.liters);
  };
  window.kmUnitFuelSave = async function () {
    if (!canEdit()) return;
    window.kmUnitEnsureStores();
    var model = document.getElementById('kmUtFuelModel').value.trim();
    if (!model) { toastErr('Մուտքագրեք մոդել'); return; }
    window.kmUnitFuelPreview();
    var mode = document.getElementById('kmUtFuelMode').value;
    var norm = Number(document.getElementById('kmUtFuelNorm').value);
    var start = Number(document.getElementById('kmUtFuelStart').value);
    var end = Number(document.getElementById('kmUtFuelEnd').value);
    var r = calcFuel(mode, norm, start, end);
    if (r.delta < 0) { toastErr('Վերջը պետք է ≥ սկիզբ'); return; }
    db.unitFuel.push({
      id: uid('fuel'), model: model, mode: mode, norm: norm, start: start, end: end,
      delta: r.delta, liters: r.liters, driver: String(document.getElementById('kmUtFuelDriver').value || '').trim(),
      date: document.getElementById('kmUtFuelDate').value || todayIso()
    });
    await persist(true);
    toastOk('ՎՔՆ գրանցվեց');
    window.kmUnitOpen('unitFuel');
  };
  window.kmUnitFuelDel = async function (id) {
    if (!canEdit() || !confirm('Ջնջե՞լ')) return;
    db.unitFuel = db.unitFuel.filter(function (x) { return x.id !== id; });
    await persist(true);
    window.kmUnitOpen('unitFuel');
  };
  window.kmUnitFuelPrint = function (id) {
    var f = db.unitFuel.find(function (x) { return x.id === id; });
    if (!f) return;
    openPrint('Ուղեգիր / ՎՔՆ',
      '<h2>Վառելիքի և քսայուղերի հաշվարկ (ուղեգիր)</h2>' +
      '<p><b>Ամսաթիվ՝</b> ' + esc(fmtDate(f.date)) + '</p>' +
      '<p><b>Տեխնիկա՝</b> ' + esc(f.model) + '</p>' +
      '<p><b>Վարորդ՝</b> ' + esc(f.driver || '—') + '</p>' +
      '<table><tr><th>Ցուցիչ</th><th>Արժեք</th></tr>' +
      '<tr><td>Չափ</td><td>' + esc(f.mode === 'hour' ? 'ժամ' : 'կմ') + '</td></tr>' +
      '<tr><td>Նորմա</td><td>' + esc(String(f.norm)) + (f.mode === 'hour' ? ' լ/ժ' : ' լ/100կմ') + '</td></tr>' +
      '<tr><td>Սկիզբ / Վերջ</td><td>' + esc(String(f.start)) + ' / ' + esc(String(f.end)) + '</td></tr>' +
      '<tr><td>Տարբերություն</td><td>' + esc(String(f.delta)) + '</td></tr>' +
      '<tr><td><b>Ծախս</b></td><td><b>' + esc(String(f.liters)) + ' լ</b></td></tr></table>' +
      '<p style="margin-top:24px">Ստորագրություն՝ ____________</p>');
  };

  /* ——— 5 Day plans ——— */
  function renderDayPlans(h) {
    var rows = db.unitDayPlans.slice().reverse().map(function (p) {
      return '<tr><td>' + esc(fmtDate(p.date)) + '</td><td>' + esc((p.items || []).join(' · ')) +
        '</td><td class="kmUtActions">' +
        '<button type="button" onclick="kmUnitDayPrint(\'' + esc(p.id) + '\')">Տպել</button>' +
        (canEdit() ? '<button type="button" class="danger" onclick="kmUnitDayDel(\'' + esc(p.id) + '\')">Ջնջել</button>' : '') +
        '</td></tr>';
    }).join('') || '<tr><td colspan="3" class="kmUtMuted">Պլան չկա</td></tr>';
    var chips = DAY_THEMES.map(function (t, i) {
      return '<label style="font-weight:600;display:inline-flex;gap:6px;align-items:center;margin:4px 8px 4px 0">' +
        '<input type="checkbox" class="kmUtDayTheme" value="' + esc(t) + '"> ' + esc(t) + '</label>';
    }).join('');
    h.innerHTML = shell(PAGES.unitDayPlans,
      (canEdit() ? '<div class="kmUtForm">' +
        '<label>Ամսաթիվ<input id="kmUtDayDate" type="date" value="' + todayIso() + '"></label>' +
        '<label>Լրացուցիչ թեմա<input id="kmUtDayExtra" placeholder="այլ թեմա"></label>' +
        '<button type="button" class="primary" onclick="kmUnitDaySave()">Կազմել պլան</button></div>' +
        '<div style="margin:8px 0 12px">' + chips + '</div>' : '') +
      '<div class="gridwrap"><table class="kmUtTable"><thead><tr><th>Ամսաթիվ</th><th>Թեմաներ</th><th></th></tr></thead><tbody>' +
      rows + '</tbody></table></div>');
  }
  window.kmUnitDaySave = async function () {
    if (!canEdit()) return;
    window.kmUnitEnsureStores();
    var items = [].slice.call(document.querySelectorAll('.kmUtDayTheme:checked')).map(function (el) { return el.value; });
    var extra = document.getElementById('kmUtDayExtra').value.trim();
    if (extra) items.push(extra);
    if (!items.length) { toastErr('Ընտրեք թեմա'); return; }
    db.unitDayPlans.push({
      id: uid('day'), date: document.getElementById('kmUtDayDate').value || todayIso(), items: items
    });
    await persist(true);
    toastOk('Կարգացուցակը պատրաստ է');
    window.kmUnitOpen('unitDayPlans');
  };
  window.kmUnitDayDel = async function (id) {
    if (!canEdit() || !confirm('Ջնջե՞լ')) return;
    db.unitDayPlans = db.unitDayPlans.filter(function (x) { return x.id !== id; });
    await persist(true);
    window.kmUnitOpen('unitDayPlans');
  };
  window.kmUnitDayPrint = function (id) {
    var p = db.unitDayPlans.find(function (x) { return x.id === id; });
    if (!p) return;
    var lis = (p.items || []).map(function (t, i) {
      return '<tr><td>' + (i + 1) + '</td><td>' + esc(t) + '</td><td></td></tr>';
    }).join('');
    openPrint('Կարգացուցակ',
      '<h2>Օրվա կարգացուցակ</h2><p><b>Ամսաթիվ՝</b> ' + esc(fmtDate(p.date)) +
      '</p><table><thead><tr><th>№</th><th>Թեմա / միջոցառում</th><th>Ժամ</th></tr></thead><tbody>' +
      lis + '</tbody></table>');
  };

  /* ——— 6 Medical ——— */
  function medicalAlerts() {
    var today = todayIso();
    return (db.unitMedical || []).filter(function (m) {
      return m.kind === 'exemption' && m.to && m.to < today;
    });
  }
  function renderMedical(h) {
    /* KM_ACCOUNTING_ARCHIVE_SOURCES_V2_UT med */
    try { _peopleListCache = { at: 0, list: null }; } catch (eC) {}
    var overdue = medicalAlerts();
    var alertHtml = overdue.length
      ? '<div class="kmUtAlert danger"><b>Ժամկետանց ազատումներ՝ ' + overdue.length + '</b> · ' +
        overdue.slice(0, 5).map(function (m) { return esc(m.person); }).join(', ') + '</div>'
      : '<div class="kmUtAlert ok">Ժամկետանց ազատում չկա</div>';
    var rows = db.unitMedical.slice().reverse().map(function (m) {
      var cls = (m.kind === 'exemption' && m.to && m.to < todayIso()) ? 'danger' : '';
      return '<tr class="' + cls + '"><td>' + esc(m.person) + '</td><td>' + esc(
        m.kind === 'visit' ? 'Դիմում' : m.kind === 'inpatient' ? 'Ստացիոնար' : 'Ազատում'
      ) + '</td><td>' + esc(fmtDate(m.from)) + '–' + esc(fmtDate(m.to)) + '</td><td>' + esc(m.note || '') +
        '</td><td class="kmUtActions">' +
        (canEdit() ? '<button type="button" class="danger" onclick="kmUnitMedDel(\'' + esc(m.id) + '\')">Ջնջել</button>' : '') +
        '</td></tr>';
    }).join('') || '<tr><td colspan="5" class="kmUtMuted">Գրառում չկա</td></tr>';
    h.innerHTML = shell(PAGES.unitMedical, alertHtml +
      (canEdit() ? '<div class="kmUtForm">' +
        '<label>Ա․Ա․Հ' + peopleSelect('kmUtMedPerson') + '</label>' +
        '<label>Տեսակ<select id="kmUtMedKind"><option value="visit">Դիմում</option><option value="inpatient">Ստացիոնար</option><option value="exemption">Ազատում</option></select></label>' +
        '<label>Սկիզբ<input id="kmUtMedFrom" type="date" value="' + todayIso() + '"></label>' +
        '<label>Ավարտ<input id="kmUtMedTo" type="date" value="' + addDaysIso(todayIso(), 3) + '"></label>' +
        '<label>Նշում<input id="kmUtMedNote" placeholder="ախտորոշում / նշում"></label>' +
        '<button type="button" class="primary" onclick="kmUnitMedSave()">Ավելացնել</button></div>' : '') +
      '<div class="kmUtActions" style="margin-bottom:8px"><button type="button" onclick="kmUnitMedPrint()">Տպել ցուցակ</button></div>' +
      '<div class="gridwrap"><table class="kmUtTable"><thead><tr><th>Ա․Ա․Հ</th><th>Տեսակ</th><th>Ժամկետ</th><th>Նշում</th><th></th></tr></thead><tbody>' +
      rows + '</tbody></table></div>', '', archiveSourceMuted());
  }
  window.kmUnitMedSave = async function () {
    if (!canEdit()) return;
    window.kmUnitEnsureStores();
    var name = String(document.getElementById('kmUtMedPerson').value || '').trim();
    if (!name) { toastErr('Գրեք Ա․Ա․Հ'); return; }
    db.unitMedical.push({
      id: uid('med'), person: name, kind: document.getElementById('kmUtMedKind').value,
      from: document.getElementById('kmUtMedFrom').value, to: document.getElementById('kmUtMedTo').value,
      note: document.getElementById('kmUtMedNote').value.trim()
    });
    await persist(true);
    toastOk('Գրանցվեց բուժկետում');
    window.kmUnitOpen('unitMedical');
  };
  window.kmUnitMedDel = async function (id) {
    if (!canEdit() || !confirm('Ջնջե՞լ')) return;
    db.unitMedical = db.unitMedical.filter(function (x) { return x.id !== id; });
    await persist(true);
    window.kmUnitOpen('unitMedical');
  };
  window.kmUnitMedPrint = function () {
    var rows = (db.unitMedical || []).map(function (m) {
      return '<tr><td>' + esc(m.person) + '</td><td>' + esc(m.kind) + '</td><td>' +
        esc(fmtDate(m.from)) + '–' + esc(fmtDate(m.to)) + '</td><td>' + esc(m.note || '') + '</td></tr>';
    }).join('');
    openPrint('Բուժկետ', '<h2>Բուժկետի մատյան</h2><table><thead><tr><th>Ա․Ա․Հ</th><th>Տեսակ</th><th>Ժամկետ</th><th>Նշում</th></tr></thead><tbody>' +
      rows + '</tbody></table>');
  };

  /* ——— 7 Leave Gantt ——— */
  function leaveOverloadDays(planStart, days, maxPct) {
    /* KM_UNIFIED_ARCHIVE_SOURCE_V1_LEAVE_N: denominator = Unit Archive authorized named posts */
    var peopleN = Math.max((peopleList() || []).length || 0, 1);
    var maxAbs = Math.max(1, Math.floor(peopleN * (Number(maxPct) || 20) / 100));
    var bad = [];
    for (var i = 0; i < days; i++) {
      var day = addDaysIso(planStart, i);
      var count = 0;
      (db.unitLeavePlan.rows || []).forEach(function (r) {
        if (r.from <= day && day <= r.to) count++;
      });
      (db.vacations || []).forEach(function (v) {
        var kind = String(v.kind || 'vacation');
        if (kind !== 'vacation' && kind !== '') return;
        var a = String(v.from || '').slice(0, 10);
        var b = String(v.to || '').slice(0, 10);
        if (a && b && a <= day && day <= b) count++;
      });
      if (count > maxAbs) bad.push({ day: day, count: count, max: maxAbs });
    }
    return bad;
  }

  function renderLeavePlan(h) {
    /* KM_ACCOUNTING_ARCHIVE_SOURCES_V2_UT leave */
    try { _peopleListCache = { at: 0, list: null }; } catch (eC2) {}
    window.kmUnitEnsureStores();
    var start = todayIso();
    var days = 30;
    var maxPct = db.unitLeavePlan.maxAbsentPct || 20;
    var overload = leaveOverloadDays(start, days, maxPct);
    var alertHtml = overload.length
      ? '<div class="kmUtAlert danger"><b>Գերբեռնված օրեր՝ ' + overload.length + '</b> (նորմա ≤ ' +
        maxPct + '%). Օր.՝ ' + overload.slice(0, 4).map(function (o) {
          return esc(fmtDate(o.day)) + ' (' + o.count + ')';
        }).join(', ') + '</div>'
      : '<div class="kmUtAlert ok">Առաջիկա 30 օրում գերբեռնվածություն չկա (նորմա ' + maxPct + '%)</div>';

    var gantt = '<div class="kmUtGantt">' + (db.unitLeavePlan.rows || []).map(function (r) {
      var offset = Math.max(0, daysBetween(start, r.from));
      var len = Math.max(1, daysBetween(r.from, r.to) + 1);
      if (r.to < start) return '';
      var left = (offset / days) * 100;
      var width = (len / days) * 100;
      var isOver = overload.some(function (o) { return o.day >= r.from && o.day <= r.to; });
      return '<div class="kmUtGanttRow"><div class="kmUtGanttName" title="' + esc(r.person) + '">' +
        esc(r.person) + ' (' + esc(String(r.days || len)) + 'օր)</div>' +
        '<div class="kmUtGanttTrack"><div class="kmUtGanttBar' + (isOver ? ' over' : '') +
        '" style="left:' + left + '%;width:' + Math.min(width, 100 - left) + '%">' +
        esc(fmtDate(r.from)) + '</div></div></div>';
    }).join('') + '</div>';

    var rows = (db.unitLeavePlan.rows || []).map(function (r) {
      return '<tr><td>' + esc(r.person) + '</td><td>' + esc(String(r.days)) + '</td><td>' +
        esc(fmtDate(r.from)) + '–' + esc(fmtDate(r.to)) + '</td><td class="kmUtActions">' +
        (canEdit() ? '<button type="button" class="danger" onclick="kmUnitLeaveDel(\'' + esc(r.id) + '\')">Ջնջել</button>' : '') +
        '</td></tr>';
    }).join('') || '<tr><td colspan="4" class="kmUtMuted">Պլան չկա</td></tr>';

    h.innerHTML = shell(PAGES.unitLeavePlan, alertHtml +
      (canEdit() ? '<div class="kmUtForm">' +
        '<label>Ա․Ա․Հ' + peopleSelect('kmUtLeavePerson') + '</label>' +
        '<label>Օրեր<select id="kmUtLeaveDays"><option value="15">15</option><option value="30">30</option></select></label>' +
        '<label>Սկիզբ<input id="kmUtLeaveFrom" type="date" value="' + todayIso() + '"></label>' +
        '<label>Մաքս. բացակա %<input id="kmUtLeaveMax" type="number" min="1" max="100" value="' + esc(String(maxPct)) + '"></label>' +
        '<button type="button" class="primary" onclick="kmUnitLeaveSave()">Ավելացնել պլան</button></div>' : '') +
      '<h4>Ժամանակացույց (30 օր)</h4>' + gantt +
      '<div class="gridwrap" style="margin-top:12px"><table class="kmUtTable"><thead><tr><th>Ա․Ա․Հ</th><th>Օր</th><th>Ժամկետ</th><th></th></tr></thead><tbody>' +
      rows + '</tbody></table></div>', '', archiveSourceMuted());
  }
  window.kmUnitLeaveSave = async function () {
    if (!canEdit()) return;
    window.kmUnitEnsureStores();
    var name = String(document.getElementById('kmUtLeavePerson').value || '').trim();
    if (!name) { toastErr('Գրեք Ա․Ա․Հ'); return; }
    var days = Number(document.getElementById('kmUtLeaveDays').value) || 15;
    var from = document.getElementById('kmUtLeaveFrom').value || todayIso();
    var to = addDaysIso(from, days - 1);
    db.unitLeavePlan.maxAbsentPct = Number(document.getElementById('kmUtLeaveMax').value) || 20;
    db.unitLeavePlan.rows.push({ id: uid('leave'), person: name, days: days, from: from, to: to });
    await persist(true);
    toastOk('Ավելացվեց արձակուրդային պլան');
    window.kmUnitOpen('unitLeavePlan');
  };
  window.kmUnitLeaveDel = async function (id) {
    if (!canEdit() || !confirm('Ջնջե՞լ')) return;
    db.unitLeavePlan.rows = db.unitLeavePlan.rows.filter(function (x) { return x.id !== id; });
    await persist(true);
    window.kmUnitOpen('unitLeavePlan');
  };

  /* ——— 8 Blanks ——— */
  function renderBlanks(h) {
    var rows = db.unitBlanks.slice().reverse().map(function (b) {
      return '<tr><td>' + esc(b.title) + '</td><td>' + esc(b.type || '') + '</td><td>' +
        esc(fmtDate(b.createdAt)) + '</td><td class="kmUtActions">' +
        '<button type="button" onclick="kmUnitBlankOpen(\'' + esc(b.id) + '\')">Բացել</button>' +
        (canEdit() ? '<button type="button" class="danger" onclick="kmUnitBlankDel(\'' + esc(b.id) + '\')">Ջնջել</button>' : '') +
        '</td></tr>';
    }).join('') || '<tr><td colspan="4" class="kmUtMuted">Ձևաթուղթ չկա — ավելացրեք Word/Excel/PDF</td></tr>';
    h.innerHTML = shell(PAGES.unitBlanks,
      '<p class="kmUtMuted">Լոկալ կատալոգ՝ թղթաբանության ձևանմուշներ։ LAN sync-ը տարածում է բազան մյուս կայաններին։</p>' +
      (canEdit() ? '<div class="kmUtForm">' +
        '<label>Վերնագիր<input id="kmUtBlankTitle" placeholder="օր. Զեկուցագրի ձև"></label>' +
        '<label>Ֆայլ<input id="kmUtBlankFile" type="file" accept=".doc,.docx,.xls,.xlsx,.pdf,application/pdf"></label>' +
        '<button type="button" class="primary" onclick="kmUnitBlankSave()">Ավելացնել</button></div>' : '') +
      '<div class="gridwrap"><table class="kmUtTable"><thead><tr><th>Անուն</th><th>Տեսակ</th><th>Ամսաթիվ</th><th></th></tr></thead><tbody>' +
      rows + '</tbody></table></div>');
  }
  window.kmUnitBlankSave = async function () {
    if (!canEdit()) return;
    window.kmUnitEnsureStores();
    var title = document.getElementById('kmUtBlankTitle').value.trim();
    var fileEl = document.getElementById('kmUtBlankFile');
    var file = fileEl && fileEl.files && fileEl.files[0];
    if (!file) { toastErr('Ընտրեք ֆայլ'); return; }
    if (!title) title = file.name;
    var buf = await file.arrayBuffer();
    var bytes = new Uint8Array(buf);
    var chunk = 0x8000;
    var b64 = '';
    for (var i = 0; i < bytes.length; i += chunk) {
      b64 += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    b64 = btoa(b64);
    var ext = (file.name.split('.').pop() || '').toLowerCase();
    db.unitBlanks.push({
      id: uid('blank'), title: title, type: ext || file.type, name: file.name,
      mime: file.type || 'application/octet-stream', base64: b64, createdAt: todayIso()
    });
    await persist(true);
    toastOk('Ձևաթուղթը ավելացվեց');
    window.kmUnitOpen('unitBlanks');
  };
  window.kmUnitBlankDel = async function (id) {
    if (!canEdit() || !confirm('Ջնջե՞լ')) return;
    db.unitBlanks = db.unitBlanks.filter(function (x) { return x.id !== id; });
    await persist(true);
    window.kmUnitOpen('unitBlanks');
  };
  window.kmUnitBlankOpen = function (id) {
    var b = db.unitBlanks.find(function (x) { return x.id === id; });
    if (!b || !b.base64) return;
    try {
      var bin = atob(b.base64);
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      var blob = new Blob([bytes], { type: b.mime || 'application/octet-stream' });
      var url = URL.createObjectURL(blob);
      if (/pdf/i.test(b.type || b.mime || '') && typeof window.kmLawsShowDocViewer === 'function') {
        window.kmLawsShowDocViewer(b.title || b.name, 'application/pdf', { base64: b.base64 });
      } else {
        var a = document.createElement('a');
        a.href = url;
        a.download = b.name || (b.title + '.' + (b.type || 'bin'));
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    } catch (e) {
      toastErr('Բացել չհաջողվեց');
    }
  };

  /* ——— 9 Dossiers ——— */
  /** Դասավորություն՝ ինչպես Պաշտոն արխիվի/userPositions հերթականությունը (ստորաբաժանում → order) */
  function peopleListLikePositionsArchive() {
    try {
      if (window.kmUnitArchiveStaffSource && window.kmUnitArchiveStaffSource.hasFormal &&
          window.kmUnitArchiveStaffSource.hasFormal()) {
        var formalPeople = peopleList();
        if (formalPeople && formalPeople.length) return formalPeople;
      }
    } catch (eFormalFirst) {}
    var out = [];
    var seen = Object.create(null);
    var byName = Object.create(null);
    peopleList().forEach(function (p) {
      if (!p || !p.name) return;
      byName[String(p.name).toLowerCase()] = p;
    });
    function add(p) {
      if (!p) return;
      var name = String(p.name || '').trim();
      if (!name) return;
      if (typeof window.kmLooksLikePersonName === 'function' && !window.kmLooksLikePersonName(name)) return;
      var k = name.toLowerCase();
      if (seen[k]) return;
      seen[k] = 1;
      out.push(p);
    }
    try {
      var ups = (typeof db !== 'undefined' && Array.isArray(db.userPositions)) ? db.userPositions.slice() : [];
      var secOrder = [];
      ups.forEach(function (pos) {
        var sec = String((pos && (pos.section || pos.unit)) || '').trim() || 'Այլ';
        if (secOrder.indexOf(sec) < 0) secOrder.push(sec);
      });
      ups.sort(function (a, b) {
        var sa = String((a && (a.section || a.unit)) || '').trim() || 'Այլ';
        var sb = String((b && (b.section || b.unit)) || '').trim() || 'Այլ';
        var ia = secOrder.indexOf(sa);
        var ib = secOrder.indexOf(sb);
        if (ia !== ib) return ia - ib;
        return (Number(a && a.order) || 0) - (Number(b && b.order) || 0);
      });
      ups.forEach(function (pos) {
        if (!pos) return;
        var n = String(pos.personName || pos.name || '').trim();
        if (!n || pos.vacant) return;
        if (typeof window.kmLooksLikePersonName === 'function' && !window.kmLooksLikePersonName(n)) return;
        var k = n.toLowerCase();
        add(byName[k] || {
          name: n,
          rank: pos.rankSlot || pos.rank || '',
          unit: pos.section || pos.unit || '',
          post: pos.position || pos.post || '',
          postCode: pos.code || ''
        });
      });
    } catch (e0) {}
    try {
      if (typeof window.kmPeopleFromPositions === 'function') {
        (window.kmPeopleFromPositions() || []).forEach(function (x) {
          if (!x || !x.name) return;
          var k = String(x.name).toLowerCase();
          add(byName[k] || { name: x.name, rank: x.rank || '', unit: x.unit || '', post: x.post || '' });
        });
      }
    } catch (e1) {}
    peopleList().forEach(add);
    return out;
  }
  function renderDossiers(h) {
    window.kmUnitEnsureStores();
    var fEdu = (window._kmUtDosFilter && window._kmUtDosFilter.edu) || '';
    var fSpec = (window._kmUtDosFilter && window._kmUtDosFilter.spec) || '';
    var fUnit = (window._kmUtDosFilter && window._kmUtDosFilter.unit) || '';
    var list = peopleListLikePositionsArchive();
    var posMap = posByNameMap();
    var pendingWrite = false;
    var rows = list.map(function (p) {
      var name = String(p.name || '').trim();
      if (!name) return '';
      var d = dossierFromPositions(name, p, posMap);
      var merged = applyDossierAutoFill(name, d, p) || d;
      if (merged && merged.__changed) pendingWrite = true;
      var edu = merged.education || '';
      var spec = merged.specialty || '';
      var post = merged.post || p.post || '';
      if (fEdu && edu.toLowerCase().indexOf(fEdu.toLowerCase()) < 0) return '';
      if (fSpec && spec.toLowerCase().indexOf(fSpec.toLowerCase()) < 0) return '';
      if (fUnit && String(p.unit || '') !== fUnit) return '';
      var idx = personIndexInDb(p);
      var openFn = idx >= 0
        ? 'kmUnitDosOpenCard(' + idx + ')'
        : 'kmUnitDosOpenCardByName(decodeURIComponent(\'' + encodeURIComponent(name) + '\'))';
      return '<tr><td>' + esc(p.rank || '') + '</td><td><b>' + esc(name) + '</b></td><td>' + esc(p.unit || '') +
        '</td><td>' + esc(edu) + '</td><td>' + esc(spec) + '</td><td>' + esc(post) + '</td><td class="kmUtActions">' +
        '<button type="button" onclick="' + openFn + '">Քարտ</button>' +
        '<button type="button" onclick="kmUnitDosPrint(decodeURIComponent(\'' + encodeURIComponent(name) + '\'))">Տպել</button>' +
        (canEdit() ? '<button type="button" class="danger" onclick="kmUnitDosClear(decodeURIComponent(\'' + encodeURIComponent(name) + '\'))">Մաքրել</button>' : '') +
        '</td></tr>';
    }).join('') || '<tr><td colspan="7" class="kmUtMuted">Արդյունք չկա</td></tr>';

    var unitOpts = '<option value="">Բոլոր ստորաբաժանումները</option>' + unitsFromPeople().map(function (u) {
      return '<option value="' + esc(u) + '"' + (u === fUnit ? ' selected' : '') + '>' + esc(u) + '</option>';
    }).join('');

    h.innerHTML = shell(PAGES.unitDossiers,
      '<p class="kmUtMuted">Դասավորությունը համապատասխանում է <b>Պաշտոն</b> արխիվի հերթականությանը։ Կրթություն/մասնագիտություն/պաշտոն՝ արխիվից։ <b>Քարտ</b>՝ նույն անձի քարտը։</p>' +
      '<div class="kmUtForm">' +
        '<label>Կրթություն<input id="kmUtDosFEdu" value="' + esc(fEdu) + '" placeholder="օր. բարձրագույն"></label>' +
        '<label>Մասնագիտություն<input id="kmUtDosFSpec" value="' + esc(fSpec) + '" placeholder="օր. վարորդ"></label>' +
        '<label>Ստորաբաժանում<select id="kmUtDosFUnit">' + unitOpts + '</select></label>' +
        '<button type="button" class="primary" onclick="kmUnitDosFilter()">Ֆիլտրել</button>' +
        '<button type="button" onclick="kmUnitDosFilterClear()">Մաքրել ֆիլտրը</button></div>' +
      '<div class="gridwrap"><table class="kmUtTable"><thead><tr><th>Կոչում</th><th>Ա․Ա․Հ</th><th>Ստոր.</th><th>Կրթություն</th><th>Մասնագիտություն</th><th>Պաշտոն</th><th></th></tr></thead><tbody>' +
      rows + '</tbody></table></div>');
    if (pendingWrite && canEdit()) {
      persist(true).catch(function () {});
    }
  }
  window.kmUnitDosOpenCard = function (idx) {
    idx = Number(idx);
    if (!(idx >= 0)) return;
    if (typeof window.kmOpenPersonCard === 'function') window.kmOpenPersonCard(idx);
  };
  window.kmUnitDosOpenCardByName = function (name) {
    name = String(name || '').trim();
    if (!name) return;
    var list = (typeof db !== 'undefined' && Array.isArray(db.people)) ? db.people : [];
    var idx = list.findIndex(function (p) { return p && String(p.name || '').trim() === name; });
    if (idx < 0) {
      var p0 = findPerson(name);
      var d0 = applyDossierAutoFill(name, dossierFromPositions(name, p0, posByNameMap()), p0);
      if (typeof db !== 'undefined' && Array.isArray(db.people)) {
        db.people.push({
          name: name,
          rank: p0.rank || '',
          unit: p0.unit || '',
          post: (d0 && d0.post) || p0.post || '',
          education: (d0 && d0.education) || '',
          specialty: (d0 && d0.specialty) || '',
          postCode: (d0 && d0.postCode) || '',
          bad: []
        });
        idx = db.people.length - 1;
      }
    } else {
      applyDossierAutoFill(name, dossierFromPositions(name, list[idx], posByNameMap()), list[idx]);
    }
    if (idx >= 0 && typeof window.kmOpenPersonCard === 'function') window.kmOpenPersonCard(idx);
  };
  window.kmUnitDosFilter = function () {
    var eduEl = document.getElementById('kmUtDosFEdu');
    var specEl = document.getElementById('kmUtDosFSpec');
    var unitEl = document.getElementById('kmUtDosFUnit');
    window._kmUtDosFilter = {
      edu: eduEl ? eduEl.value.trim() : '',
      spec: specEl ? specEl.value.trim() : '',
      unit: unitEl ? unitEl.value : ''
    };
    window.kmUnitOpen('unitDossiers');
  };
  window.kmUnitDosFilterClear = function () {
    window._kmUtDosFilter = { edu: '', spec: '', unit: '' };
    var eduEl = document.getElementById('kmUtDosFEdu');
    var specEl = document.getElementById('kmUtDosFSpec');
    var unitEl = document.getElementById('kmUtDosFUnit');
    if (eduEl) eduEl.value = '';
    if (specEl) specEl.value = '';
    if (unitEl) unitEl.value = '';
    window.kmUnitOpen('unitDossiers');
  };
  window.kmUnitDosClear = async function (name) {
    if (!canEdit()) return;
    name = String(name || '').trim();
    if (!name) return;
    if (!confirm('Մաքրե՞լ քարտի տվյալները (Կրթություն, Մասնագիտություն, Պաշտոն)՝ ' + name + '։')) return;
    window.kmUnitEnsureStores();
    db.unitDossiers[name] = {
      education: '',
      specialty: '',
      post: '',
      postCode: '',
      rankSlot: '',
      posId: '',
      family: '',
      note: ''
    };
    await persist(true);
    toastOk('Քարտը մաքրվեց');
    window.kmUnitOpen('unitDossiers');
  };
  window.kmUnitDosEdit = function (name) {
    window.kmUnitDosOpenCardByName(name);
  };
  window.kmUnitDosPrint = function (name) {
    var p = findPerson(name);
    var d = applyDossierAutoFill(name, dossierFromPositions(name, p, posByNameMap()), p) || {};
    openPrint('Անձնական քարտ',
      '<h2>Էլեկտրոնային անձնական քարտ</h2>' +
      '<table><tr><th>Ա․Ա․Հ</th><td>' + esc(name) + '</td></tr>' +
      '<tr><th>Կոչում</th><td>' + esc(p.rank || '') + '</td></tr>' +
      '<tr><th>Ստորաբաժանում</th><td>' + esc(p.unit || '') + '</td></tr>' +
      '<tr><th>Պաշտոն</th><td>' + esc(d.post || p.post || '') + '</td></tr>' +
      '<tr><th>Կոդ</th><td>' + esc(d.postCode || '') + '</td></tr>' +
      '<tr><th>Կրթություն</th><td>' + esc(d.education || '') + '</td></tr>' +
      '<tr><th>Մասնագիտություն</th><td>' + esc(d.specialty || '') + '</td></tr>' +
      '<tr><th>Ընտանիք</th><td>' + esc(d.family || '') + '</td></tr>' +
      '<tr><th>Հեռախոս</th><td>' + esc(p.phone || '') + '</td></tr>' +
      '<tr><th>Նշում</th><td>' + esc(d.note || p.note || '') + '</td></tr></table>');
  };

  /* ——— 10 Formation ——— */
  var SHARQYUM = '\u0547\u0561\u0580\u0584\u0578\u0582\u0574'; // Շարքում
  function formationRowSharqum(r) {
    // Շարքում = Ցուցակով - Արձակուրդ - Բուժկետ - Գործուղում - Մարտական հերթապահություն - Կարգապահական վաշտ
    // Վերակարգը համարվում է շարքում (դուրս չի հանվում):
    var listed = Number(r.listed) || 0;
    return listed
      - (Number(r.leave) || 0)
      - (Number(r.sick) || 0)
      - (Number(r.trip) || 0)
      - (Number(r.battleDuty) || 0)
      - (Number(r.discCompany) || 0);
  }
  function formationTotals(rows) {
    var t = { present: 0, leave: 0, sick: 0, trip: 0, duty: 0, listed: 0, battleDuty: 0, discCompany: 0, sharqum: 0 };
    (rows || []).forEach(function (r) {
      t.present += Number(r.present) || 0;
      t.leave += Number(r.leave) || 0;
      t.sick += Number(r.sick) || 0;
      t.trip += Number(r.trip) || 0;
      t.duty += Number(r.duty) || 0;
      t.listed += Number(r.listed) || 0;
      t.battleDuty += Number(r.battleDuty) || 0;
      t.discCompany += Number(r.discCompany) || 0;
      t.sharqum += formationRowSharqum(r);
    });
    return t;
  }
  function formationMathStatus(rows) {
    var totals = formationTotals(rows);
    var peopleCount = peopleList().length;
    var issues = [];
    (rows || []).forEach(function (r) {
      var unit = String(r.unit || '—').trim() || '—';
      var listed = Number(r.listed) || 0;
      var abs = (Number(r.leave) || 0) + (Number(r.sick) || 0) + (Number(r.trip) || 0) + (Number(r.battleDuty) || 0) + (Number(r.discCompany) || 0);
      var sh = formationRowSharqum(r);
      if (sh < 0) issues.push(unit + '՝ Շարքում բացասական է');
      if (abs > listed) issues.push(unit + '՝ բացակայությունները գերազանցում են ցուցակը');
      var duty = Number(r.duty) || 0;
      if (duty > sh && sh >= 0) issues.push(unit + '՝ վերակարգը գերազանցում է շարքը');
    });
    if (peopleCount && totals.listed !== peopleCount) {
      issues.push('Ցուցակով ընդամենը (' + totals.listed + ') ≠ անձնակազմ (' + peopleCount + ')');
    }
    return { ok: !issues.length, issues: issues, totals: totals, peopleCount: peopleCount };
  }
  function formationFindByDate(date) {
    var d = String(date || '').slice(0, 10);
    var list = (db.unitFormation || []).slice().sort(function (a, b) {
      return String(b.date).localeCompare(String(a.date));
    });
    if (!d) return list[0] || null;
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].date || '').slice(0, 10) === d) return list[i];
    }
    return null;
  }
  function unitsFromPositionsArchive() {
    var names = [];
    var seen = Object.create(null);
    function add(name) {
      name = String(name || '').trim();
      if (!name) return;
      var k = name.toLowerCase();
      if (seen[k]) return;
      seen[k] = 1;
      names.push(name);
    }
    try {
      var ups = (typeof db !== 'undefined' && Array.isArray(db.userPositions)) ? db.userPositions : [];
      ups.forEach(function (pos) {
        add((pos && (pos.section || pos.unit)) || '');
      });
    } catch (e0) {}
    return names;
  }
  function listedCountForUnit(unit) {
    var u = String(unit || '').trim();
    var seen = Object.create(null);
    var n = 0;
    function addName(name) {
      name = String(name || '').trim();
      if (!name) return;
      var k = name.toLowerCase();
      if (seen[k]) return;
      seen[k] = 1;
      n++;
    }
    try {
      ((typeof db !== "undefined" && db.userPositions) || []).forEach(function (pos) {
        var sec = String((pos && (pos.section || pos.unit)) || '').trim();
        if (sec !== u) return;
        if (pos && pos.vacant) return;
        addName(pos.personName || pos.name);
      });
    } catch (e1) {}
    peopleList().forEach(function (p) {
      if ((String(p.unit || '').trim() || '') === u) addName(p.name);
    });
    return n;
  }
  function formationUnitSelectHtml(i, current, disabled) {
    var cur = String(current || '').trim();
    return '<input type="text" data-i="' + i + '" data-f="unit" value="' + esc(cur) + '" list="kmUtFormUnitList" ' +
      'placeholder="ստորաբաժանում" style="min-width:160px;width:100%"' +
      (disabled ? ' disabled' : '') + '>';
  }
  function unusedArchiveUnits() {
    var used = {};
    document.querySelectorAll('#kmUtFormTable [data-f="unit"]').forEach(function (el) {
      var v = String(el.value || '').trim();
      if (v) used[v.toLocaleLowerCase("hy-AM")] = 1;
    });
    return unitsFromPositionsArchive().filter(function (u) {
      return !used[u.toLocaleLowerCase("hy-AM")];
    });
  }
  function refreshFormationUnitPick() {
    var sel = document.getElementById('kmUtFormUnitPick');
    if (!sel) return;
    var unused = unusedArchiveUnits();
    sel.innerHTML = unused.map(function (u) { return '<option value="' + esc(u) + '">' + esc(u) + '</option>'; }).join('') ||
      '<option value="">Պաշտոն արխիվում ազատ են</option>';
    sel.disabled = !unused.length;
  }
  function formationRowHtml(r, i, editable) {
    return '<tr class="kmUtFormDataRow">' +
      '<td>' + formationUnitSelectHtml(i, r.unit, !editable) + '</td>' +
      '<td><input type="number" min="0" data-i="' + i + '" data-f="listed" value="' +
      esc(String(r.listed || 0)) + '" style="width:70px" ' + (editable ? 'oninput="kmUnitFormRecalc()"' : 'disabled') + '></td>' +
      '<td><input type="number" min="0" data-i="' + i + '" data-f="leave" value="' +
      esc(String(r.leave || 0)) + '" style="width:70px" ' + (editable ? 'oninput="kmUnitFormRecalc()"' : 'disabled') + '></td>' +
      '<td><input type="number" min="0" data-i="' + i + '" data-f="sick" value="' +
      esc(String(r.sick || 0)) + '" style="width:70px" ' + (editable ? 'oninput="kmUnitFormRecalc()"' : 'disabled') + '></td>' +
      '<td><input type="number" min="0" data-i="' + i + '" data-f="trip" value="' +
      esc(String(r.trip || 0)) + '" style="width:70px" ' + (editable ? 'oninput="kmUnitFormRecalc()"' : 'disabled') + '></td>' +
      '<td><input type="number" min="0" data-i="' + i + '" data-f="battleDuty" value="' +
      esc(String(r.battleDuty || 0)) + '" style="width:70px" ' + (editable ? 'oninput="kmUnitFormRecalc()"' : 'disabled') + '></td>' +
      '<td><input type="number" min="0" data-i="' + i + '" data-f="duty" value="' +
      esc(String(r.duty || 0)) + '" style="width:70px" ' + (editable ? 'oninput="kmUnitFormRecalc()"' : 'disabled') + '></td>' +
      '<td><input type="number" min="0" data-i="' + i + '" data-f="discCompany" value="' +
      esc(String(r.discCompany || 0)) + '" style="width:70px" ' + (editable ? 'oninput="kmUnitFormRecalc()"' : 'disabled') + '></td>' +
      '<td class="kmUtRowSharqum">' + esc(String(formationRowSharqum(r))) + '</td>' +
      (editable
        ? '<td><button type="button" class="danger" data-km-form-del="' + i + '" onclick="kmUnitFormRemoveOne(this)">Հանել</button></td>'
        : '<td></td>') +
      '</tr>';
  }
  function formationSeedRows() {
    return [];
  }
  function formationUnitDatalistHtml() {
    var names = unitsFromPositionsArchive();
    return '<datalist id="kmUtFormUnitList">' +
      names.map(function (u) { return '<option value="' + esc(u) + '"></option>'; }).join('') +
      '</datalist>';
  }
  function renderFormation(h) {
    var pref = window._kmUtFormDatePref || '';
    var latest = formationFindByDate(pref) || formationFindByDate('') || null;
    var date = pref || (latest && latest.date) || todayIso();
    window._kmUtFormDatePref = date;
    var rows = (latest && String(latest.date).slice(0, 10) === String(date).slice(0, 10) && latest.rows)
      ? latest.rows
      : formationSeedRows();
    var math = formationMathStatus(rows);
    var alertClass = math.ok ? 'ok' : 'danger';
    var alertText = math.ok
      ? 'Մաթեմատիկան համընկնում է' + (math.peopleCount ? ' · անձնակազմ՝ ' + math.peopleCount : '')
      : ('Ստուգեք՝ ' + math.issues.slice(0, 3).join(' · '));
    var totals = math.totals;
    var bodyRows = rows.map(function (r, i) {
      return formationRowHtml(r, i, canEdit());
    }).join('');

    h.innerHTML = shell(PAGES.unitFormation,
      '<div class="kmUtAlert ' + alertClass + '" id="kmUtFormMath">' + esc(alertText) + '</div>' +
      '<div class="kmUtForm">' +
        '<label>Ամսաթիվ<input id="kmUtFormDate" type="date" value="' + esc(date) + '"' +
        (canEdit() ? ' onchange="kmUnitFormDateChange()"' : ' disabled') + '></label>' +
        (canEdit() ? '<label>Ստորաբաժանում<input id="kmUtFormUnitName" type="text" list="kmUtFormUnitList" style="min-width:180px"></label>' +
          '<button type="button" onclick="kmUnitFormAddRow()">Ավելացնել</button>' +
          '<button type="button" onclick="kmUnitFormRemoveAll()">Հեռացնել բոլորը</button>' +
          '<button type="button" class="primary" onclick="kmUnitFormSave()">Պահպանել</button>' : '') +
        '<button type="button" onclick="kmUnitFormPrint()">Տպել</button></div>' +
      '<div class="gridwrap"><table class="kmUtTable" id="kmUtFormTable"><thead><tr>' +
      '<th>Ստորաբաժանում</th>' +
      '<th>Ցուցակով</th>' +
      '<th>Արձակուրդ</th>' +
      '<th>Բուժկետ</th>' +
      '<th>Գործուղում</th>' +
      '<th>Մարտական հերթապահություն</th>' +
      '<th>Վերակարգ</th>' +
      '<th>Կարգապահական վաշտ</th>' +
      '<th>' + SHARQYUM + '</th>' +
      '<th></th>' +
      '</tr></thead><tbody>' + bodyRows + '</tbody>' +
      '<tfoot><tr class="kmUtTotalRow">' +
      '<th>Ընդամենը</th>' +
      '<th id="kmUtTlisted">' + totals.listed + '</th>' +
      '<th id="kmUtTleave">' + totals.leave + '</th>' +
      '<th id="kmUtTsick">' + totals.sick + '</th>' +
      '<th id="kmUtTtrip">' + totals.trip + '</th>' +
      '<th id="kmUtTbattleDuty">' + totals.battleDuty + '</th>' +
      '<th id="kmUtTduty">' + totals.duty + '</th>' +
      '<th id="kmUtTdiscCompany">' + totals.discCompany + '</th>' +
      '<th id="kmUtTsharqum">' + totals.sharqum + '</th>' +
      '<th></th>' +
      '</tr></tfoot></table></div>');
    try {
      if (!document.getElementById('kmUtFormUnitList')) {
        var tbl = document.getElementById('kmUtFormTable');
        if (tbl) tbl.insertAdjacentHTML('beforebegin', formationUnitDatalistHtml());
      }
    } catch (ePick) {}
  }
  function readFormationRows() {
    var map = {};
    document.querySelectorAll('#kmUtFormTable tbody [data-i][data-f]').forEach(function (inp) {
      var i = Number(inp.getAttribute('data-i'));
      var f = inp.getAttribute('data-f');
      if (!map[i]) map[i] = { unit: '', present: 0, leave: 0, sick: 0, trip: 0, duty: 0, battleDuty: 0, discCompany: 0, listed: 0 };
      if (f === 'unit') map[i].unit = inp.value.trim();
      else map[i][f] = Number(inp.value) || 0;
    });
    return Object.keys(map).sort(function (a, b) { return Number(a) - Number(b); }).map(function (k) { return map[k]; });
  }
  window.kmUnitFormDateChange = function () {
    var el = document.getElementById('kmUtFormDate');
    window._kmUtFormDatePref = el ? el.value : '';
    window.kmUnitOpen('unitFormation');
  };
  window.kmUnitFormRecalc = function () {
    var rows = readFormationRows();
    document.querySelectorAll('#kmUtFormTable tbody tr.kmUtFormDataRow').forEach(function (tr, i) {
      var r = rows[i];
      if (!r) return;
      var sharqumCell = tr.querySelector('.kmUtRowSharqum');
      if (sharqumCell) sharqumCell.textContent = String(formationRowSharqum(r));
    });
    var math = formationMathStatus(rows);
    var totals = math.totals;
    var el = function (id) { return document.getElementById(id); };
    if (el('kmUtTsharqum')) el('kmUtTsharqum').textContent = String(totals.sharqum);
    if (el('kmUtTleave')) el('kmUtTleave').textContent = String(totals.leave);
    if (el('kmUtTsick')) el('kmUtTsick').textContent = String(totals.sick);
    if (el('kmUtTtrip')) el('kmUtTtrip').textContent = String(totals.trip);
    if (el('kmUtTbattleDuty')) el('kmUtTbattleDuty').textContent = String(totals.battleDuty);
    if (el('kmUtTduty')) el('kmUtTduty').textContent = String(totals.duty);
    if (el('kmUtTdiscCompany')) el('kmUtTdiscCompany').textContent = String(totals.discCompany);
    if (el('kmUtTlisted')) el('kmUtTlisted').textContent = String(totals.listed);
    var banner = el('kmUtFormMath');
    if (banner) {
      banner.className = 'kmUtAlert ' + (math.ok ? 'ok' : 'danger');
      banner.textContent = math.ok
        ? ('Մաթեմատիկան համընկնում է' + (math.peopleCount ? ' · անձնակազմ՝ ' + math.peopleCount : ''))
        : ('Ստուգեք՝ ' + math.issues.slice(0, 3).join(' · '));
    }
  };
  window.kmUnitFormAddRow = function () {
    var tbody = document.querySelector('#kmUtFormTable tbody');
    if (!tbody) return;
    var nameEl = document.getElementById('kmUtFormUnitName');
    var unit = String((nameEl && nameEl.value) || '').trim();
    if (!unit) { toastErr('\u0533\u0580\u0565\u0584 \u057d\u057f\u0578\u0580\u0561\u0562\u0561\u056a\u0561\u0576\u0574\u0561\u0576 \u0561\u0576\u0578\u0582\u0576\u0568'); return; }
    var dup = false;
    var uk = unit.toLowerCase();
    document.querySelectorAll('#kmUtFormTable [data-f="unit"]').forEach(function (el) {
      if (String(el.value || '').trim().toLowerCase() === uk) dup = true;
    });
    if (dup) { toastErr('\u0531\u0575\u057d \u057d\u057f\u0578\u0580\u0561\u0562\u0561\u056a\u0561\u0576\u0578\u0582\u0574\u0576 \u0561\u0580\u0564\u0565\u0576 \u0561\u0572\u0575\u0578\u0582\u057d\u0561\u056f\u0578\u0582\u0574 \u0567'); return; }
    var i = tbody.querySelectorAll('tr.kmUtFormDataRow').length;
    var tr = document.createElement('tr');
    tr.className = 'kmUtFormDataRow';
    tr.innerHTML = formationRowHtml({ unit: unit, present: 0, leave: 0, sick: 0, trip: 0, duty: 0, battleDuty: 0, discCompany: 0, listed: listedCountForUnit(unit) }, i, true);
    tbody.appendChild(tr);
    if (nameEl) nameEl.value = '';
    try { window.kmUnitFormRecalc(); } catch (e) {}
  };
  window.kmUnitFormRemoveOne = function (btn) {
    var tr = btn && btn.closest ? btn.closest('tr.kmUtFormDataRow') : null;
    if (!tr) return;
    tr.parentNode.removeChild(tr);
    try { window.kmUnitFormRecalc(); } catch (e) {}
  };
  window.kmUnitFormRemoveAll = async function () {
    if (!canEdit()) return;
    var tbody = document.querySelector('#kmUtFormTable tbody');
    if (!tbody) return;
    var rows = tbody.querySelectorAll('tr.kmUtFormDataRow');
    if (!rows.length) { toastErr('Հեռացնելու տող չկա'); return; }
    window.kmUnitEnsureStores();
    var date = (document.getElementById('kmUtFormDate') || {}).value || todayIso();
    window._kmUtFormDatePref = date;
    var kept = (db.unitFormation || []).filter(function (x) { return x && x.date !== date; });
    var prev = (db.unitFormation || []).find(function (x) { return x && x.date === date; });
    kept.push({
      id: (prev && prev.id) || uid('form'),
      date: date,
      rows: [],
      totals: formationTotals([])
    });
    db.unitFormation = kept;
    await persist(true);
    toastOk('Բոլոր տողերը հեռացվեցին և պահպանվեցին');
    window.kmUnitOpen('unitFormation');
  };
  window.kmUnitFormRemoveRow = window.kmUnitFormRemoveAll;
  document.addEventListener('click', function (ev) {
    var tr = ev.target && ev.target.closest && ev.target.closest('#kmUtFormTable tbody tr.kmUtFormDataRow');
    if (!tr) return;
    if (ev.target.closest('input,select,button,label')) return;
    var tbody = tr.parentNode;
    tbody.querySelectorAll('tr.kmUtFormDataRow').forEach(function (x) { x.classList.toggle('is-selected', x === tr); });
  });
  window.kmUnitFormSave = async function () {
    if (!canEdit()) return;
    window.kmUnitEnsureStores();
    var date = document.getElementById('kmUtFormDate').value || todayIso();
    window._kmUtFormDatePref = date;
    var rows = readFormationRows();
    rows.forEach(function (r) {
      var sh = formationRowSharqum(r);
      var duty = Number(r.duty) || 0;
      var present = sh - duty;
      r.present = present < 0 ? 0 : present;
    });
    db.unitFormation = (db.unitFormation || []).filter(function (x) { return x.date !== date; });
    db.unitFormation.push({ id: uid('form'), date: date, rows: rows, totals: formationTotals(rows) });
    await persist(true);
    toastOk('Տեղեկագիրը պահպանվեց');
    window.kmUnitOpen('unitFormation');
  };
  window.kmUnitFormPrint = function () {
    var date = (document.getElementById('kmUtFormDate') || {}).value || todayIso();
    var rows = readFormationRows();
    var totals = formationTotals(rows);
    var body = rows.map(function (r) {
      return '<tr>' +
        '<td>' + esc(r.unit) + '</td>' +
        '<td>' + (r.listed || 0) + '</td>' +
        '<td>' + r.leave + '</td>' +
        '<td>' + r.sick + '</td>' +
        '<td>' + r.trip + '</td>' +
        '<td>' + (r.battleDuty || 0) + '</td>' +
        '<td>' + r.duty + '</td>' +
        '<td>' + (r.discCompany || 0) + '</td>' +
        '<td>' + formationRowSharqum(r) + '</td>' +
        '</tr>';
    }).join('');
    openPrint('Շարային տեղեկագիր',
      '<h2 class="kmUtFormPrintTitle">Շարային տեղեկագիր</h2><p><b>Ամսաթիվ՝</b> ' + esc(fmtDate(date)) +
      '</p><table class="kmUtFormPrint"><thead><tr>' +
      '<th>Ստորաբաժանում</th>' +
      '<th>Ցուցակով</th>' +
      '<th>Արձակուրդ</th>' +
      '<th>Բուժկետ</th>' +
      '<th>Գործուղում</th>' +
      '<th>Մարտական հերթապահություն</th>' +
      '<th>Վերակարգ</th>' +
      '<th>Կարգապահական վաշտ</th>' +
      '<th>' + SHARQYUM + '</th>' +
      '</tr></thead><tbody>' +
      body +
      '</tbody><tfoot><tr class="kmUtTotalRow"><th>Ընդամենը</th>' +
      '<td>' + totals.listed + '</td>' +
      '<td>' + totals.leave + '</td>' +
      '<td>' + totals.sick + '</td>' +
      '<td>' + totals.trip + '</td>' +
      '<td>' + totals.battleDuty + '</td>' +
      '<td>' + totals.duty + '</td>' +
      '<td>' + (totals.discCompany || 0) + '</td>' +
      '<td>' + totals.sharqum + '</td>' +
      '</tr></tfoot></table>');
  };

  /* ——— 11 Terms ——— */
  var TERM_POS_RULES = [
    { re: /դասակի\s*հրամանատար/i, allow: ['լ-տ', 'ավ․լ-տ'], label: 'դասակի հրամանատար' },
    { re: /վաշտի\s*հրամանատար/i, allow: ['կ-ն'], label: 'վաշտի հրամանատար' },
    { re: /գնդի\s*հրամանատարի\s*տեղակալ/i, allow: ['փ/գ-տ'], label: 'գնդի հրամանատարի տեղակալ' },
    { re: /գումարտակի\s*հրամանատարի\s*տեղակալ/i, allow: ['մ-ր'], label: 'գումարտակի հրամանատարի տեղակալ' },
    { re: /(ծառայության|զորատեսակի).{0,24}պետ/i, allow: ['մ-ր'], label: 'ծառայության/զորատեսակի պետ' },
    { re: /(ծառայության|զորատեսակի).{0,24}սպա/i, allow: ['կ-ն'], label: 'ծառայության/զորատեսակի սպա' }
  ];
  function normRankLocal(r) {
    return typeof window.kmNormalizeRank === 'function' ? window.kmNormalizeRank(r) : String(r || '').trim();
  }
  function rankIdxLocal(r) {
    return typeof window.kmRankSortIndex === 'function' ? window.kmRankSortIndex(r) : 0;
  }
  function requiredRanksForPost(postTitle, rankSlot) {
    var slot = normRankLocal(rankSlot);
    if (slot) {
      return { allow: [slot], ruleLabel: 'Արխիվի հաստիք', slot: slot };
    }
    var title = String(postTitle || '').trim();
    var fromRule = null;
    for (var i = 0; i < TERM_POS_RULES.length; i++) {
      if (TERM_POS_RULES[i].re.test(title)) {
        fromRule = TERM_POS_RULES[i];
        break;
      }
    }
    var allow = fromRule ? fromRule.allow.slice() : [];
    return {
      allow: allow,
      ruleLabel: fromRule ? fromRule.label : '',
      slot: slot
    };
  }
  
  /* KM_RESTORE_TERM_HELPERS_V1 */
  var RANK_LADDER_LOCAL = ['շ-ն', 'կրտ․ս-տ', 'ս-տ', 'ավ․ս-տ', 'ավագ', 'ենթասպա', 'ավագ ենթասպա', 'լ-տ', 'ավ․լ-տ', 'կ-ն', 'մ-ր', 'փ/գ-տ', 'գ-տ', 'գեներալ'];
  var RANK_TERM_YEARS = {
    'կրտ․ս-տ': 1, 'կրտսեր սերժանտ': 1,
    'ս-տ': 2, 'սերժանտ': 2,
    'ավ․ս-տ': 2, 'ավագ սերժանտ': 2,
    'ավագ': 2,
    'ենթասպա': 3, 'հդ ս-տ': 3,
    'լ-տ': 2, 'լեյտենանտ': 2,
    'ավ․լ-տ': 2, 'ավագ լեյտենանտ': 2,
    'կ-ն': 3, 'կապիտան': 3,
    'մ-ր': 3, 'մայոր': 3,
    'փ/գ-տ': 4, 'փոխգնդապետ': 4
  };
  var RANK_NO_TERM = {
    'շ-ն': 1, 'շարքային': 1, 'եֆրեյտոր': 1,
    'ավագ ենթասպա': 1, 'հվ ս-տ': 1,
    'գ-տ': 1, 'գնդապետ': 1, 'գեներալ': 1
  };
  function canonExcelRank(rank) {
    var n = String(rank || '').trim().toLowerCase().replace(/և/g, 'եւ').replace(/\s+/g, ' ');
    n = n.replace(/\./g, '․');
    if (!n) return '';
    if (typeof normRankLocal === 'function') {
      try { var nn = normRankLocal(n); if (nn) n = String(nn).trim().toLowerCase().replace(/\./g, '․'); } catch (e0) {}
    }
    if (/^գեներալ/.test(n) || n === 'գեն․' || n === 'գեն') return 'գեներալ';
    var alias = {
      'շարքային': 'շ-ն', 'շ-ն': 'շ-ն', 'շն': 'շ-ն', 'եֆրեյտոր': 'շ-ն',
      'կրտսեր սերժանտ': 'կրտ․ս-տ', 'կրտ․ս-տ': 'կրտ․ս-տ', 'կրտ.ս-տ': 'կրտ․ս-տ',
      'սերժանտ': 'ս-տ', 'ս-տ': 'ս-տ',
      'ավագ սերժանտ': 'ավ․ս-տ', 'ավ․ս-տ': 'ավ․ս-տ', 'ավ.ս-տ': 'ավ․ս-տ',
      'ավագ': 'ավագ',
      'ենթասպա': 'ենթասպա', 'հդ ս-տ': 'ենթասպա',
      'ավագ ենթասպա': 'ավագ ենթասպա', 'հվ ս-տ': 'ավագ ենթասպա',
      'լեյտենանտ': 'լ-տ', 'լ-տ': 'լ-տ',
      'ավագ լեյտենանտ': 'ավ․լ-տ', 'ավ․լ-տ': 'ավ․լ-տ', 'ավ.լ-տ': 'ավ․լ-տ',
      'կապիտան': 'կ-ն', 'կ-ն': 'կ-ն',
      'մայոր': 'մ-ր', 'մ-ր': 'մ-ր',
      'փոխգնդապետ': 'փ/գ-տ', 'փ/գ-տ': 'փ/գ-տ',
      'գնդապետ': 'գ-տ', 'գ-տ': 'գ-տ'
    };
    if (alias[n]) return alias[n];
    var soft = n.replace(/\s*\/\s*/g, '/');
    return alias[soft] || n;
  }
  function rankTermYears(rank) {
    var n = canonExcelRank(rank);
    if (!n) return null;
    if (Object.prototype.hasOwnProperty.call(RANK_TERM_YEARS, n)) return RANK_TERM_YEARS[n];
    var low = String(rank || '').trim().toLowerCase();
    if (Object.prototype.hasOwnProperty.call(RANK_TERM_YEARS, low)) return RANK_TERM_YEARS[low];
    if (RANK_NO_TERM[n] || RANK_NO_TERM[low]) return 0;
    return null;
  }
  function nextRankAfter(rank) {
    var n = canonExcelRank(rank);
    var i = RANK_LADDER_LOCAL.indexOf(n);
    if (i < 0 || i >= RANK_LADDER_LOCAL.length - 1) return '';
    return RANK_LADDER_LOCAL[i + 1];
  }
  function parseStaffDate(raw) {
    var s = String(raw == null ? '' : raw).replace(/\u00a0/g, ' ').trim();
    if (!s) return '';
    var iso = s.match(/(19|20)\d{2}-\d{2}-\d{2}/);
    if (iso) return iso[0];
    var dmy = s.match(/(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{2,4})/);
    if (dmy) {
      var y = dmy[3].length === 2 ? ('20' + dmy[3]) : dmy[3];
      var m = Number(dmy[2]);
      var d = Number(dmy[1]);
      if (m > 12 && d <= 12) { var tmp = m; m = d; d = tmp; }
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && Number(y) >= 1990) {
        return y + '-' + ('0' + m).slice(-2) + '-' + ('0' + d).slice(-2);
      }
    }
    return '';
  }
  function extractStaffAppointedAt(row, person) {
    var parts = [];
    if (person) parts.push(person.appointmentDate, person.rankAppointedAt, person.lastAccept);
    if (row) parts.push(row.appointmentDate, row.lastAccept, row.posOrder, row.rankOrder, row.appointedAt);
    for (var i = 0; i < parts.length; i++) {
      var got = parseStaffDate(parts[i]);
      if (got) return got;
    }
    return '';
  }
  function addYearsIso(iso, years) {
    years = Number(years) || 0;
    var d = new Date(String(iso || '') + 'T12:00:00');
    if (isNaN(d.getTime())) d = new Date();
    d.setFullYear(d.getFullYear() + years);
    return d.toISOString().slice(0, 10);
  }
  function isTermDismissed(person, rank) {
    try {
      var key = String(person || '').trim().toLowerCase() + '|' + String(rank || '').trim().toLowerCase();
      var list = (db.unitTermWatch && db.unitTermWatch.dismissed) || [];
      return list.indexOf(key) >= 0;
    } catch (e) { return false; }
  }

    /* KM_RESTORE_TERM_HELPERS_FROM_BAK_V1 */

  function collectTermArchiveRows() {
    /* KM_UNIFIED_ARCHIVE_FLOW_V1_COLLECT_GUARD */
    try {
      if (window.kmUnitArchiveStaffSource && window.kmUnitArchiveStaffSource.hasFormal &&
          window.kmUnitArchiveStaffSource.hasFormal()) {
        var byNameF = Object.create(null);
        (window.kmUnitArchiveStaffSource.rows() || []).forEach(function (r) {
          if (!r || r.type === 'section') return;
          var name = String(r.sourceName || r.name || r.personName || '').trim();
          if (!name) return;
          if (typeof window.kmLooksLikePersonName === 'function' && !window.kmLooksLikePersonName(name)) return;
          var k = name.toLowerCase();
          if (!byNameF[k]) byNameF[k] = {
            name: name, post: r.position || '', code: r.code || '', rankSlot: r.rankSlot || '',
            personRank: r.rank || '', unit: r.unit || r.section || '',
            posOrder: r.seq || r.posOrder || '', rankOrder: r.rankOrder || '',
            lastAccept: r.lastAccept || '', serviceYear: r.serviceYear || '',
            appointmentDate: r.appointmentDate || r.posOrder || ''
          };
        });
        return Object.keys(byNameF).map(function (k) { return byNameF[k]; });
      }
    } catch (eCG) {}
    return [];
  }
  function syncTermRanksFromArchive() {
    /* KM_TERMWATCH_UNIT_ARCHIVE_FLOW_V2_DONE — հոսքը միայն 🗄 Զորամասի Արխիվ */
    window.kmUnitEnsureStores();
    try {
      if (typeof window.kmEnsureHtmlV7UnitArchive === 'function') {
        window.kmEnsureHtmlV7UnitArchive({ noPersist: true });
      }
    } catch (eEns) {}
    var manual = (db.unitTermWatch.ranks || []).filter(function (r) { return r && !r.autoFromPos; });
    var auto = [];
    var seen = Object.create(null);
    function pushAuto(row, target, years, fromDate, kind, extraNote, currentCanon) {
      if (!target || isTermDismissed(row.name, target)) return;
      var key = row.name.toLowerCase() + '|' + (typeof normRankLocal === 'function' ? normRankLocal(target) : String(target));
      if (seen[key]) return;
      seen[key] = 1;
      if (!(years && years > 0 && fromDate)) return;
      auto.push({
        id: uid('rankAuto'),
        person: row.name,
        rank: target,
        date: addYearsIso(fromDate, years),
        autoFromPos: true,
        post: row.post || '',
        code: row.code || '',
        rankSlot: row.rankSlot || '',
        currentRank: currentCanon || row.rankSlot || '',
        personRank: row.personRank || '',
        termYears: years,
        appointedAt: fromDate || '',
        unit: row.unit || '',
        kind: kind || 'time',
        note: extraNote || '',
        fromUnitArchive: true
      });
    }
    var rows = [];
    try { rows = collectTermArchiveRows() || []; } catch (eR) { rows = []; }
    rows.forEach(function (row) {
      var postCanon = canonExcelRank(row.rankSlot || '');
      var personCanon = canonExcelRank(row.personRank || '');
      if (!postCanon && !personCanon) return;
      var fromDate = extractStaffAppointedAt(row, null);
      if (!fromDate) fromDate = parseStaffDate(row.lastAccept || row.appointmentDate || row.posOrder || row.rankOrder || '');
      var postIdx = RANK_LADDER_LOCAL.indexOf(postCanon);
      var personIdx = RANK_LADDER_LOCAL.indexOf(personCanon);
      /* Համեմատել՝ Կոչում ըստ հաստիքի vs Կոչում */
      if (postIdx >= 0 && personIdx >= 0 && personIdx < postIdx) {
        var step = RANK_LADDER_LOCAL[personIdx + 1] || postCanon;
        var yearsA = rankTermYears(personCanon);
        if (!(yearsA && yearsA > 0)) yearsA = rankTermYears(postCanon) || 2;
        pushAuto(row, step, yearsA, fromDate, 'rankGap',
          '🗄 Արխիվ · հաստիքի կոչում՝ ' + (row.rankSlot || postCanon) +
          ' · Կոչում՝ ' + (row.personRank || personCanon) +
          (fromDate ? (' · նշանակում՝ ' + fromDate) : '') +
          ' · կրում՝ ' + yearsA + 'տ',
          personCanon);
        return;
      }
      var base = postCanon || personCanon;
      var next = nextRankAfter(base);
      var years = rankTermYears(base);
      if (next && years && years > 0) {
        pushAuto(row, next, years, fromDate, 'time',
          '🗄 Արխիվ · հաստիքի կոչում՝ ' + (row.rankSlot || base) +
          (row.personRank ? (' · Կոչում՝ ' + row.personRank) : '') +
          (fromDate ? (' · նշանակում՝ ' + fromDate) : ' · ամսաթիվ չկա') +
          ' · կրում՝ ' + years + 'տ',
          base);
      }
    });
    db.unitTermWatch.ranks = manual.concat(auto);
    (function purgeFakeJan1Autos() {
      var cy = (new Date()).getFullYear();
      function badIso(iso) {
        iso = String(iso || '').slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
        if (iso.slice(5) !== '01-01') return false;
        var y = Number(iso.slice(0, 4));
        return y >= 1950 && y <= (cy - 2);
      }
      db.unitTermWatch.ranks = (db.unitTermWatch.ranks || []).filter(function (r) {
        if (!r || !r.autoFromPos) return true;
        if (badIso(r.appointedAt) || badIso(r.date)) return false;
        var dy = Number(String(r.date || '').slice(0, 4));
        if (dy && dy < (cy - 5)) return false;
        return true;
      });
    })();
    return (db.unitTermWatch.ranks || []).filter(function (r) { return r && r.autoFromPos; }).length;
  }
  window.kmScheduleRankTerm = function (opts) {
    opts = opts || {};
    window.kmUnitEnsureStores();
    var person = String(opts.person || '').trim();
    var excelRank = canonExcelRank(opts.rankSlot || opts.rank || '');
    if (!person || !excelRank) return null;
    var next = String(opts.nextRank || nextRankAfter(excelRank) || '').trim();
    if (!next) return null;
    var fromDate = parseStaffDate(opts.fromDate) || todayIso();
    var years = rankTermYears(excelRank);
    var due = (years && years > 0) ? addYearsIso(fromDate, years) : addDaysIso(fromDate, Number(db.unitTermWatch.warnDays) || 30);
    var dk = termDismissKey(person, next);
    db.unitTermWatch.dismissed = (db.unitTermWatch.dismissed || []).filter(function (x) { return x !== dk; });
    db.unitTermWatch.ranks = (db.unitTermWatch.ranks || []).filter(function (r) {
      return !(r && r.autoFromPos && samePersonLocal(r.person, person) && normRankLocal(r.rank) === normRankLocal(next));
    });
    var rec = {
      id: uid('rankPromo'),
      person: person,
      rank: next,
      date: due,
      autoFromPos: true,
      post: opts.post || '',
      code: opts.code || '',
      rankSlot: opts.rankSlot || excelRank,
      currentRank: excelRank,
      termYears: years,
      appointedAt: fromDate,
      prevAppointedAt: parseStaffDate(opts.prevDate) || '',
      unit: opts.unit || opts.unitName || '',
      corpsId: opts.corpsId || '',
      unitId: opts.unitId || '',
      kind: 'promo',
      note: 'բարձրացում · Արխիվի հաստիքի կոչում՝ ' + excelRank + ' · նշանակում՝ ' + fromDate + (years > 0 ? (' · հաջորդը ' + years + 'տ հետո') : '')
    };
    db.unitTermWatch.ranks.push(rec);
    return rec;
  };
  function samePersonLocal(a, b) {
    return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  }
  function notifyRankTermsDue() {
    window.kmUnitEnsureStores();
    if (!Array.isArray(db.unitTermWatch.sent)) db.unitTermWatch.sent = [];
    var today = todayIso();
    var warn = Number(db.unitTermWatch.warnDays) || 30;
    var ctx = null;
    try { ctx = typeof window.kmGetOrgContext === 'function' ? window.kmGetOrgContext() : null; } catch (eC) { ctx = null; }
    var unitName = (ctx && (ctx.unitName || ctx.unitId)) || '';
    var n = 0;
    (db.unitTermWatch.ranks || []).forEach(function (r) {
      if (!r || !r.person || !r.date) return;
      var left = daysBetween(today, r.date);
      if (left > 0 && left > warn) return;
      var key = String(r.person).toLowerCase() + '|' + normRankLocal(r.rank) + '|' + String(r.date).slice(0, 10) + '|' + today.slice(0, 7);
      if (db.unitTermWatch.sent.indexOf(key) >= 0) return;
      db.unitTermWatch.sent.push(key);
      if (db.unitTermWatch.sent.length > 400) db.unitTermWatch.sent = db.unitTermWatch.sent.slice(-200);
      n++;
      var dept = r.unit || unitName || 'զորամաս';
      var msg = (left < 0 ? 'Ժամկետանց կոչում · ' : 'Կոչման ժամկետը լրացել է · ') +
        r.person + ' → ' + (r.rank || '') +
        (r.appointedAt ? (' · նշանակում՝ ' + r.appointedAt) : '') +
        ' · ' + dept;
      try {
        if (typeof window.kmHishoxutyunLog === 'function') {
          window.kmHishoxutyunLog({
            section: 'unitTermWatch',
            sectionLabel: 'Կոչումներ և ժամկետներ',
            action: 'warn',
            detail: msg
          });
        }
      } catch (eH) {}
      if (n <= 4) {
        try {
          if (typeof window.kmNotify === 'function') window.kmNotify(msg, left < 0 ? 'error' : 'warn');
          else if (typeof toast === 'function') toast(msg, 'warn');
        } catch (eN) {}
      }
    });
    return n;
  }
  window.kmScanOfficerRankTerms = function () {
    var n = 0;
    try { n = syncTermRanksFromArchive(); } catch (eS) {}
    try { notifyRankTermsDue(); } catch (eN) {}
    return n;
  };
  function termItems() {
    /* KM_RANK_DUE_STATUS_V1 */
    window.kmUnitEnsureStores();
    var warn = Number(db.unitTermWatch.warnDays) || 30;
    var today = todayIso();
    var items = [];
    peopleList().forEach(function (p) {
      var name = String(p.name || '').trim();
      if (!name) return;
      var end = String(p.endDate || p.contractEnd || '').slice(0, 10);
      if (end) {
        var left = daysBetween(today, end);
        if (left <= warn) {
          items.push({
            person: name, rank: p.rank || '', unit: p.unit || '', type: 'պայմանագիր/ծառայություն',
            date: end, left: left, danger: left < 0,
            statusLabel: left <= 0 ? 'ժամանակն է' : 'ժամանակը չէ'
          });
        }
      }
    });
    (db.unitTermWatch.ranks || []).forEach(function (r) {
      if (!r) return;
      if (typeof window.kmLooksLikePersonName === 'function' && !window.kmLooksLikePersonName(r.person)) return;
      var left = daysBetween(today, r.date);
      if (left <= warn) {
        items.push({
          person: r.person, rank: r.rank || '', unit: r.unit || '',
          type: r.kind === 'promo' ? 'կոչում (բարձրացում)' : (r.autoFromPos ? 'կոչում (պաշտոն)' : 'կոչում'),
          date: r.date, left: left, danger: left < 0, statusLabel: left <= 0 ? 'ժամանակն է' : 'ժամանակը չէ', id: r.id,
          appointedAt: r.appointedAt || ''
        });
      }
    });
    items.sort(function (a, b) { return a.left - b.left; });
    return items;
  }

  function rankTermTableHtml() {
    var rows = [
      ['շարքային կազմ', 'շարքային, եֆրեյտոր (շ-ն)', 'ժամկետ չի սահմանվում'],
      ['կրտսեր ենթասպայական', 'կրտսեր սերժանտ (կրտ․ս-տ)', '1 տարի'],
      ['կրտսեր ենթասպայական', 'սերժանտ, ավագ սերժանտ, ավագ', '2 տարի'],
      ['ավագ ենթասպայական', 'ենթասպա (հդ ս-տ)', '3 տարի'],
      ['ավագ ենթասպայական', 'ավագ ենթասպա', 'ժամկետ չի սահմանվում'],
      ['կրտսեր սպայական', 'լեյտենանտ (լ-տ), ավագ լեյտենանտ (ավ․լ-տ)', '2 տարի'],
      ['կրտսեր սպայական', 'կապիտան (կ-ն)', '3 տարի'],
      ['ավագ սպայական', 'մայոր (մ-ր)', '3 տարի'],
      ['ավագ սպայական', 'փոխգնդապետ (փ/գ-տ)', '4 տարի'],
      ['ավագ սպայական', 'գնդապետ (գ-տ) և բարձր', 'ժամկետ չի սահմանվում']
    ].map(function (r) {
      return '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td><td>' + esc(r[2]) + '</td></tr>';
    }).join('');
    return '<details class="kmUtDetails" style="margin:10px 0"><summary>Կոչումների կարգ և կրման ժամկետներ (Հոդված 10)</summary>' +
      '<p class="kmUtMuted" style="margin:8px 0">Հերթական կոչումը՝ նախորդը կրելու ժամկետը լրանալուց հետո (Հոդված 15)։ Ստուգեք գործող օրենքի խմբագրությունը։</p>' +
      '<div class="gridwrap"><table class="kmUtTable"><thead><tr><th>Կազմ</th><th>Կոչումներ</th><th>Կրման ժամկետ</th></tr></thead><tbody>' +
      rows + '</tbody></table></div></details>';
  }
  function renderTerms(h) {
    /* KM_ACCOUNTING_ARCHIVE_SOURCES_V2_UT terms */
    try { _peopleListCache = { at: 0, list: null }; } catch (eC3) {}
    window.kmUnitEnsureStores();
    var synced = 0;
    try { synced = syncTermRanksFromArchive(); } catch (eSync) {}
    try { notifyRankTermsDue(); } catch (eN) {}
    var warn = db.unitTermWatch.warnDays || 30;
    var items = termItems();
    var rows = items.map(function (it) {
      return '<tr class="' + (it.danger ? 'danger' : 'warn') + '"><td>' + esc(it.person) + '</td><td>' +
        esc(it.type) + '</td><td>' + esc(fmtDate(it.date)) + '</td><td><b>' +
        esc(it.statusLabel || (it.left <= 0 ? 'ժամանակն է' : 'ժամանակը չէ')) + '</b></td><td>' +
        (it.left < 0 ? ('ժամկետանց ' + Math.abs(it.left) + ' օր') : (it.left + ' օր')) + '</td></tr>';
    }).join('') || '<tr><td colspan="5" class="kmUtMuted">Մոտեցող ժամկետ չկա</td></tr>';
    var rankRows = (db.unitTermWatch.ranks || []).filter(function (r) {
      if (!r) return false;
      if (typeof window.kmLooksLikePersonName === 'function' && !window.kmLooksLikePersonName(r.person)) return false;
      return true;
    }).map(function (r) {
      var delId = encodeURIComponent(String(r.id || ''));
      return '<tr class="' + (r.autoFromPos ? 'warn' : '') + '"><td>' + esc(r.person) + '</td><td>' + esc(r.rank || '') +
        '</td><td>' + esc(fmtDate(r.date)) + '</td><td class="muted" style="font-size:12px">' +
        esc(r.autoFromPos
          ? ((r.currentRank ? ('պաշտոնի կոչում՝ ' + r.currentRank + ' · ') : '') + (r.note || r.post || 'Արխիվի հաստիք'))
          : 'ձեռքով') +
        '</td><td class="kmUtActions">' +
        (canEdit() ? '<button type="button" class="danger" onclick="kmUnitTermDel(decodeURIComponent(\'' + delId + '\'))">Ջնջել</button>' : '') +
        '</td></tr>';
    }).join('') || '<tr><td colspan="5" class="kmUtMuted">Կոչման հերթ չկա</td></tr>';

    h.innerHTML = shell(PAGES.unitTermWatch,
      '<p class="kmUtMuted">Հոսքը՝ 🗄 Զորամասի Արխիվ։ Համեմատում է Կոչում ըստ հաստիքի և Կոչում դաշտերը, ապա նշանակման ամսաթիվը՝ կրման ժամկետների հետ (Հոդված 10/15)։ Սերժանտը ավագ սերժանտի հաստիքում ստուգվում է զորամասի արխիվի պաշտոնի կոչումով։ Ավտո տողեր՝ ' + synced + '։ Ջնջված ավտո տողերը չեն վերադառնում մինչև «Համեմատել»-ից հետո նորից չառաջանան (dismiss)։</p>' +
      rankTermTableHtml() +
      (canEdit() ? '<div class="kmUtForm">' +
        '<label>Նախազգուշացում (օր)<input id="kmUtTermWarn" type="number" min="1" max="365" value="' + esc(String(warn)) + '"></label>' +
        '<label>Ա․Ա․Հ' + peopleSelect('kmUtTermPerson') + '</label>' +
        '<label>Նոր կոչում<input id="kmUtTermRank" placeholder="կոչում"></label>' +
        '<label>Ժամկետ<input id="kmUtTermDate" type="date" value="' + addDaysIso(todayIso(), 30) + '"></label>' +
        '<button type="button" class="primary" onclick="kmUnitTermSave()">Ավելացնել / պահպանել</button>' +
        '<button type="button" onclick="kmUnitTermResync()">Համեմատել Արխիվից</button></div>' : '') +
      '<h4>Մոտեցող / ժամկետանց</h4>' +
      '<div class="gridwrap"><table class="kmUtTable"><thead><tr><th>Ա․Ա․Հ</th><th>Տեսակ</th><th>Ամսաթիվ</th><th>Կարգավիճակ</th><th>Մնացել</th></tr></thead><tbody>' +
      rows + '</tbody></table></div>' +
      '<h4>Կոչման հերթ</h4>' +
      '<div class="gridwrap"><table class="kmUtTable"><thead><tr><th>Ա․Ա․Հ</th><th>Կոչում</th><th>Ժամկետ</th><th>Աղբյուր</th><th></th></tr></thead><tbody>' +
      rankRows + '</tbody></table></div>');
  }
  window.kmUnitTermResync = async function () {
    window.kmUnitEnsureStores();
    var n = syncTermRanksFromArchive();
    await persist(true);
    toastOk('Համեմատվեց՝ ' + n + ' տող');
    window.kmUnitOpen('unitTermWatch');
  };
  window.kmUnitTermSave = async function () {
    if (!canEdit()) return;
    window.kmUnitEnsureStores();
    db.unitTermWatch.warnDays = Number(document.getElementById('kmUtTermWarn').value) || 30;
    var name = String(document.getElementById('kmUtTermPerson').value || '').trim();
    var rank = document.getElementById('kmUtTermRank').value.trim();
    var date = document.getElementById('kmUtTermDate').value;
    if (name && rank && date) {
      db.unitTermWatch.ranks.push({ id: uid('rank'), person: name, rank: rank, date: date });
      var dk = termDismissKey(name, rank);
      db.unitTermWatch.dismissed = (db.unitTermWatch.dismissed || []).filter(function (x) { return x !== dk; });
    }
    await persist(true);
    toastOk('Պահպանվեց');
    window.kmUnitOpen('unitTermWatch');
  };
  window.kmUnitTermDel = async function (id) {
    if (!canEdit() || !confirm('Ջնջե՞լ այս տողը հերթից։')) return;
    window.kmUnitEnsureStores();
    id = String(id || '');
    var row = (db.unitTermWatch.ranks || []).find(function (x) { return x && String(x.id) === id; });
    if (row) {
      var key = termDismissKey(row.person, row.rank);
      if (!Array.isArray(db.unitTermWatch.dismissed)) db.unitTermWatch.dismissed = [];
      if (db.unitTermWatch.dismissed.indexOf(key) < 0) db.unitTermWatch.dismissed.push(key);
    }
    db.unitTermWatch.ranks = (db.unitTermWatch.ranks || []).filter(function (x) { return !x || String(x.id) !== id; });
    await persist(true);
    toastOk('Ջնջվեց');
    window.kmUnitOpen('unitTermWatch');
  };

      function kmNormalizeSecretClass(v){ /* KM_SECRET_TROOP_V2_NORM */
    var s0=String(v==null?'':v).trim();
    if(!s0) return '';
    if(s0==='Գաղտնիության կարգ') return '';
    if(/^(none|չունի|Չունի)$/i.test(s0)) return (/չունի/i.test(s0)?'Չունի':'none');
    if(/^\d{1,2}$/.test(s0)) return s0;
    // only strip true liter codes (Ղ, Բ, Բ-2) — never wipe real digits
    if(/^[Ա-ՖA-Za-z]$/u.test(s0)) return '';
    if(/^[Ա-ՖA-Za-z][\-–]\d{1,2}$/u.test(s0)) return '';
    var m=s0.match(/^\s*(\d{1,2})\s*$/);
    if(m) return m[1];
    return s0;
  }
  window.kmNormalizeSecretClass = kmNormalizeSecretClass;

    
  
  window.kmLoadUnitArchiveSeed25836=function(){ /* KM_SECRET_TROOP_V2_SEEDLOAD */
    try{
      if(window.__kmSeed25836Cache && window.__kmSeed25836CacheVer==='v3-by-pos') return window.__kmSeed25836Cache;
      var xhr=new XMLHttpRequest();
      xhr.open('GET','data/km_unit_archive_25836.json',false);
      xhr.send(null);
      if(xhr.status===0||(xhr.status>=200&&xhr.status<300)){
        var j=JSON.parse(xhr.responseText||'null');
        window.__kmSeed25836Cache=j;
        window.__kmSeed25836CacheVer='v3-by-pos';
        return j;
      }
    }catch(e){ console.warn('kmLoadUnitArchiveSeed25836',e); }
    return null;
  };

  
  window.kmForceSecretIntoUnitArchive = function (unitId) { /* KM_SECRET_FORCE_INTO_ARCHIVE_V1 */
    try {
      if (window.__kmSecretForceDone && !window.__kmSecretForceAgain) return 0;
      if (typeof db === 'undefined' || !db) return 0;
      if (!db.unitFormalArchives || typeof db.unitFormalArchives !== 'object') return 0;
      var uid = String(unitId || '').trim();
      if (!uid) {
        try {
          var ctx = typeof window.kmGetOrgContext === 'function' ? window.kmGetOrgContext() : null;
          uid = String((ctx && ctx.unitId) || window._kmUnitArchiveActiveUnitId || window._kmArchiveForUnitId || '').trim();
        } catch (_c) {}
      }
      // 25836 aliases
      var ids = [];
      if (uid) ids.push(uid);
      if (window.kmIsHtmlV7UnitId && window.kmIsHtmlV7UnitId(uid)) ids.push('bk2_u1');
      if (/25836/.test(uid)) ids.push('bk2_u1');
      if (window.kmIsHtmlV7UnitId && window.kmIsHtmlV7UnitId(uid)) ids.push('bk2_u1');
      if (/25836/.test(uid)) ids.push('bk2_u1');
      /* KM_MANNING_PER_UNIT_V2: never inject 25836 sheet ids when editing another unit */
      try{ if(/25836/.test(uid) || (window.kmIsHtmlV7UnitId && window.kmIsHtmlV7UnitId(uid))) Object.keys(db.unitFormalArchives||{}).forEach(function(k){ if(/25836|bk2_u1/i.test(k) || (db.unitFormalArchives[k]&&db.unitFormalArchives[k].preserve25836)) ids.push(k); }); }catch(_k){} /* KM_SECRET_FORCE_ONLY_25836_V2 */
      // unique
      var seenId = Object.create(null);
      ids = ids.filter(function (x) { if (!x || seenId[x]) return false; seenId[x] = 1; return true; });

      window.__kmSeed25836Cache = null;
      window.__kmSeed25836CacheVer = '';
      var seed = typeof window.kmLoadUnitArchiveSeed25836 === 'function' ? window.kmLoadUnitArchiveSeed25836() : null;
      if (!seed || !Array.isArray(seed.roster) || !seed.roster.length) return 0;

      function nk(s) { return String(s || '').replace(/\s+/g, ' ').trim().toLowerCase(); }
      function normSec(v) {
        if (typeof window.kmNormalizeSecretClass === 'function') return window.kmNormalizeSecretClass(v);
        var t = String(v == null ? '' : v).trim();
        return /^\d{1,2}$/.test(t) ? t : '';
      }
      var byUPS = Object.create(null);
      var byIdx = [];
      seed.roster.forEach(function (r, idx) {
        var c = (r && r.cells) || [];
        var sec = normSec(c[3]);
        byIdx[idx] = sec;
        if (!sec) return;
        var key = nk(c[0]) + '|' + nk(c[1]) + '|' + nk(c[2]);
        byUPS[key] = sec;
        // also without seq
        var up = nk(c[0]) + '|' + nk(c[1]);
        if (!byUPS[up]) byUPS[up] = sec;
      });

      var n = 0;
      ids.forEach(function (id) {
        var sheet = db.unitFormalArchives[id];
        if (!sheet || !Array.isArray(sheet.rows) || !sheet.rows.length) return;
        for (var i = 0; i < sheet.rows.length; i++) {
          var row = sheet.rows[i];
          if (!row || !Array.isArray(row.cells)) continue;
          var typ = String(row.type || 'data');
          if (typ === 'title' || typ === 'header' || typ === 'section') continue;
          while (row.cells.length < 25) row.cells.push('');
          var unit = String(row.cells[0] || '').trim();
          var pos = String(row.cells[1] || '').trim();
          var seq = String(row.cells[2] || '').trim();
          var want = byUPS[nk(unit) + '|' + nk(pos) + '|' + nk(seq)] || byUPS[nk(unit) + '|' + nk(pos)] || '';
          // same-length roster: index fallback (25836 HTML skel)
          if (!want && seed.roster.length === sheet.rows.length) want = byIdx[i] || '';
          if (!want) continue;
          var cur = String(row.cells[3] == null ? '' : row.cells[3]).trim();
          if (cur !== want) { row.cells[3] = want; n++; }
        }
        // keep active sheet pointer in sync
        if (window._kmUnitArchiveActiveSheet && String(window._kmUnitArchiveActiveUnitId || '') === String(id)) {
          window._kmUnitArchiveActiveSheet = sheet;
        }
      });
      window.__kmSecretForceDone = true;
      if (n > 0) {
        try {
          if (window._kmSecretSaveT) clearTimeout(window._kmSecretSaveT);
          window._kmSecretSaveT = setTimeout(function () {
            window._kmSecretSaveT = 0;
            try {
              if (typeof save === 'function') save(true);
              else if (typeof window.save === 'function') window.save(true);
              else if (typeof window.kmSaveDb === 'function') window.kmSaveDb();
            } catch (_s) {}
          }, 900);
        } catch (_s) {}
      }
      return n;
    } catch (e) {
      console.error('kmForceSecretIntoUnitArchive', e);
      return 0;
    }
  };

  function kmRefillSecretFromSeedAndTroop(){ /* KM_SECRET_BY_POS_V1 */
    try{ if(typeof window.kmForceSecretIntoUnitArchive==='function') window.kmForceSecretIntoUnitArchive(); }catch(_f){} /* KM_SECRET_FORCE_INTO_ARCHIVE_V1_CALL_REFILL */
    try{
      var norm=typeof kmNormalizeSecretClass==='function'?kmNormalizeSecretClass:function(v){return String(v||'').trim();};
      function isLiter(s){ s=String(s||'').trim(); return /^[Ա-ՖA-Za-z]$/u.test(s) || /^[Ա-ՖA-Za-z][\-–]\d{1,2}$/u.test(s); }
      function nk(s){ return String(s||'').replace(/\s+/g,' ').trim().toLowerCase(); }
      var byUPS=Object.create(null);
      var byUP=Object.create(null);
      var byName=Object.create(null);
      function addMaps(unit,pos,seq,name,sec){
        sec=norm(sec);
        if(!sec || !/^\d{1,2}$/.test(sec)) return;
        if(pos){
          byUPS[nk(unit)+'|'+nk(pos)+'|'+nk(seq)]=sec;
          var up=nk(unit)+'|'+nk(pos);
          if(!byUP[up]) byUP[up]=sec;
          else if(byUP[up]!==sec) byUP[up]='*';
        }
        if(name) byName[nk(name)]=sec;
      }
      function pick(unit,pos,seq,name){
        var a=byUPS[nk(unit)+'|'+nk(pos)+'|'+nk(seq)];
        if(a) return a;
        var b=byUP[nk(unit)+'|'+nk(pos)];
        if(b && b!=='*') return b;
        if(name && byName[nk(name)]) return byName[nk(name)];
        return '';
      }
      try{
        window.__kmSeed25836Cache=null; window.__kmSeed25836CacheVer='';
        if(typeof window.kmLoadUnitArchiveSeed25836==='function'){
          var seed=window.kmLoadUnitArchiveSeed25836();
          (seed && seed.roster || []).forEach(function(r){
            var c=r && r.cells; if(!c||!c.length) return;
            addMaps(c[0],c[1],c[2],c[8],c[3]);
          });
        }
      }catch(_s){}
      var n=0;
      var store=(typeof db!=='undefined' && db.unitFormalArchives)?db.unitFormalArchives:null;
      if(store){
        Object.keys(store).forEach(function(uid){
          var sheet=store[uid];
          var rows=sheet && sheet.rows; if(!Array.isArray(rows)) return;
          // only touch 25836 / sheets that look like unit archive with secrecy col
          var is25836=/25836/.test(String(uid)) || !!(sheet && (sheet.preserve25836 || /25836/.test(String(sheet.source||'')) || /25836/.test(String(sheet.unitId||''))));
          rows.forEach(function(row){
            if(!row||!Array.isArray(row.cells)) return;
            var unit=String(row.cells[0]||'').trim();
            var pos=String(row.cells[1]||'').trim();
            var seq=String(row.cells[2]||'').trim();
            var name=String(row.cells[8]||'').trim();
            var cur=String(row.cells[3]==null?'':row.cells[3]).trim();
            if(isLiter(cur) || cur==='Գաղտնիության կարգ'){ row.cells[3]=''; cur=''; n++; }
            // always build maps from existing numeric archive values too
            if(/^\d{1,2}$/.test(cur)) addMaps(unit,pos,seq,name,cur);
            var want=pick(unit,pos,seq,name);
            if(!want && is25836) want=pick(unit,pos,seq,name);
            if(want && cur!==want){ row.cells[3]=want; n++; }
          });
        });
      }
      if(typeof db!=='undefined' && db.troopStructure && db.troopStructure.staff && Array.isArray(db.troopStructure.staff.rows)){
        db.troopStructure.staff.rows.forEach(function(tr){
          if(!tr || tr.type==='section') return;
          var unit=String(tr.unit||'').trim();
          var pos=String(tr.position||'').trim();
          var seq=String(tr.seq||'').trim();
          var name=String(tr.name||'').trim();
          var cur=String(tr.secret||'').trim();
          if(isLiter(cur)){ tr.secret=''; cur=''; n++; }
          var want=pick(unit,pos,seq,name);
          if(want && cur!==want){ tr.secret=want; n++; }
        });
      }
      if(typeof db!=='undefined' && Array.isArray(db.people)){
        db.people.forEach(function(p){
          if(!p) return;
          var cur=String(p.secret||'').trim();
          if(isLiter(cur)){ p.secret=''; n++; }
          var unit=String(p.unit||p.section||'').trim();
          var pos=String(p.post||p.position||'').trim();
          var name=(typeof window.kmPersonDisplayName==='function'?window.kmPersonDisplayName(p):'')||String(p.name||'').trim();
          var want=pick(unit,pos,String(p.seq||''),name);
          if(want){ p.secret=want; n++; }
        });
      }
      return n;
    }catch(e){ console.error(e); return 0; }
  }
  window.kmRefillSecretFromSeedAndTroop = kmRefillSecretFromSeedAndTroop;
  window.kmSweepSecretLiterFromStores = kmRefillSecretFromSeedAndTroop; /* KM_SECRET_TROOP_V2_ALIAS */


  function personIndexInDb(person) {
    var list = (typeof db !== 'undefined' && Array.isArray(db.people)) ? db.people : [];
    var idx = list.indexOf(person);
    if (idx >= 0) return idx;
    var name = '';
    if (typeof window.kmPersonDisplayName === 'function') name = window.kmPersonDisplayName(person) || '';
    if (!name) name = String((person && person.name) || '').trim();
    if (!name) return -1;
    var low = name.toLowerCase();
    return list.findIndex(function (x) {
      if (!x) return false;
      var xn = (typeof window.kmPersonDisplayName === 'function' ? window.kmPersonDisplayName(x) : '') || String(x.name || '').trim();
      return xn.toLowerCase() === low || String(x.name || '').trim() === name;
    });
  }

  function personBadDays(p, live) {
    var src = live || p || {};
    var arr = Array.isArray(src.bad) ? src.bad
      : Array.isArray(src.badDays) ? src.badDays
      : Array.isArray(src.inconvenientDays) ? src.inconvenientDays
      : Array.isArray(p && p.bad) ? p.bad
      : [];
    return arr.map(Number).filter(function (n) { return n >= 1 && n <= 31; });
  }

  function compositionUnits() {
    var set = {};
    unitsFromPeople().forEach(function (u) { set[u] = true; });
    try {
      ((typeof db !== 'undefined' && Array.isArray(db.userPositions)) ? db.userPositions : []).forEach(function (pos) {
        if (!pos || pos.vacant) return;
        var u = String(pos.section || pos.unit || '').trim();
        if (u) set[u] = true;
      });
    } catch (e0) {}
    try {
      if (typeof window.kmPeopleFromPositions === 'function') {
        (window.kmPeopleFromPositions() || []).forEach(function (p) {
          var u = String((p && p.unit) || '').trim();
          if (u) set[u] = true;
        });
      }
    } catch (e1) {}
    return Object.keys(set).sort(function (a, b) {
      return a.localeCompare(b, 'hy');
    });
  }

  function renderBadDays(h) { /* KM_BAD_DAYS_FAST_V2 */
    if (!window._kmUtBadFilter) window._kmUtBadFilter = { unit: '', q: '' };
    var fUnit = String(window._kmUtBadFilter.unit || '');
    var fQ = String(window._kmUtBadFilter.q || '').trim().toLowerCase();

    function badListCached() {
      var gen = 0;
      try {
        if (typeof db !== 'undefined' && Array.isArray(db.people)) gen += db.people.length;
        if (typeof db !== 'undefined' && db.unitFormalArchives) gen += Object.keys(db.unitFormalArchives).length;
      } catch (_g) {}
      if (window._kmUtBadListCache && window._kmUtBadListGen === gen && Array.isArray(window._kmUtBadListCache)) {
        return window._kmUtBadListCache;
      }
      var list = peopleListLikePositionsArchive() || [];
      window._kmUtBadListCache = list;
      window._kmUtBadListGen = gen;
      return list;
    }

    function badNameIdxCached() {
      var gen = 0;
      try { if (typeof db !== 'undefined' && Array.isArray(db.people)) gen = db.people.length; } catch (_g) {}
      if (window._kmUtBadNameIdx && window._kmUtBadNameIdxGen === gen) return window._kmUtBadNameIdx;
      var nameToIdx = Object.create(null);
      try {
        var plist = (typeof db !== 'undefined' && Array.isArray(db.people)) ? db.people : [];
        for (var ii = 0; ii < plist.length; ii++) {
          var xp = plist[ii];
          if (!xp) continue;
          var rn = String(xp.name || '').trim();
          if (rn) {
            var rk = rn.toLowerCase();
            if (nameToIdx[rk] == null) nameToIdx[rk] = ii;
          }
          var xn = '';
          try {
            if (typeof window.kmPersonDisplayName === 'function') xn = window.kmPersonDisplayName(xp) || '';
          } catch (_dn) {}
          xn = String(xn || '').trim();
          if (xn) {
            var lk = xn.toLowerCase();
            if (nameToIdx[lk] == null) nameToIdx[lk] = ii;
          }
        }
      } catch (_m) {}
      window._kmUtBadNameIdx = nameToIdx;
      window._kmUtBadNameIdxGen = gen;
      return nameToIdx;
    }

    function idxOf(p, nameToIdx) {
      if (!p) return -1;
      var name = String(p.name || '').trim();
      if (!name && typeof window.kmPersonDisplayName === 'function') {
        try { name = window.kmPersonDisplayName(p) || ''; } catch (_n) {}
      }
      if (!name) return -1;
      var hit = nameToIdx[name.toLowerCase()];
      return hit == null ? -1 : hit;
    }

    /* KM_BAD_DAYS_FAST_V2: one list pass — skip compositionUnits() second full walk */
    var listAll = badListCached();
    var unitSet = Object.create(null);
    for (var ui = 0; ui < listAll.length; ui++) {
      var uu = String((listAll[ui] && listAll[ui].unit) || '').trim();
      if (uu) unitSet[uu] = 1;
    }
    var unitOpts = '<option value="">— Ընտրեք ստորաբաժանումը —</option>' + Object.keys(unitSet).sort(function (a, b) {
      return a.localeCompare(b, 'hy');
    }).map(function (u) {
      return '<option value="' + esc(u) + '"' + (u === fUnit ? ' selected' : '') + '>' + esc(u) + '</option>';
    }).join('');

    var filterBar =
      '<p class="kmUtMuted" style="margin:0 0 10px">Կազմը՝ <b>Պաշտոն / անձնակազմ</b>։ Նախ ընտրեք ստորաբաժանումը (ամբողջ ցուցակը միանգամից չի բեռնվում)։</p>' +
      '<div class="kmUtForm">' +
        '<label>Ստորաբաժանում<select id="kmUtBadUnit" onchange="kmUnitBadFilterApply()">' + unitOpts + '</select></label>' +
        '<label>Որոնում<input id="kmUtBadQ" type="search" value="' + esc(window._kmUtBadFilter.q || '') +
          '" placeholder="Ա․Ա․Հ / կոչում" onkeydown="if(event.key===\'Enter\'){event.preventDefault();kmUnitBadFilterApply()}"></label>' +
        '<button type="button" class="primary" onclick="kmUnitBadFilterApply()">Ֆիլտր</button>' +
        '<button type="button" onclick="kmUnitBadFilterClear()">Մաքրել ֆիլտրը</button>' +
        (canEdit()
          ? '<button type="button" onclick="kmUnitBadSyncFromPositions()">Համաժամեցնել Պաշտոնից</button>' +
            '<label>Զանգվածային օր<input id="kmUtBadBulkDay" type="number" min="1" max="31" placeholder="օր 1–31" style="min-width:90px"></label>' +
            '<button type="button" onclick="kmUnitBadBulkAdd()">Ավելացնել երևացողներին</button>'
          : '') +
      '</div>';

    /* Summary: unit picker only — no name index, no row paint */
    if (!fUnit && !fQ) {
      var list0 = listAll;
      var byU = Object.create(null);
      for (var li = 0; li < list0.length; li++) {
        var p0 = list0[li];
        var u0 = String((p0 && p0.unit) || '').trim() || 'Անհայտ';
        byU[u0] = (byU[u0] || 0) + 1;
      }
      var sumRows = Object.keys(byU).sort(function (a, b) { return a.localeCompare(b, 'hy'); }).map(function (u) {
        return '<tr><td colspan="4"><b>' + esc(u) + '</b></td><td class="kmUtActions">' +
          '<button type="button" data-km-bad-unit="' + esc(u) + '" onclick="window._kmUtBadFilter=window._kmUtBadFilter||{};window._kmUtBadFilter.unit=this.getAttribute(\'data-km-bad-unit\')||\'\';window.kmUnitOpen(\'unitBadDays\')">Բացել (' + byU[u] + ')</button></td></tr>';
      }).join('');
      if (!sumRows) sumRows = '<tr><td colspan="5" class="kmUtMuted">Անձնակազմ չկա</td></tr>';
      h.innerHTML = shell(PAGES.unitBadDays, filterBar +
        '<div class="gridwrap"><table class="kmUtTable"><thead><tr><th colspan="4">Ստորաբաժանում</th><th></th></tr></thead><tbody>' +
        sumRows + '</tbody></table></div>', '');
      return;
    }

    var list = listAll.slice();
    if (fUnit) {
      list = list.filter(function (p) { return String((p && p.unit) || '').trim() === fUnit; });
    }
    if (fQ) {
      list = list.filter(function (p) {
        var blob = [p.rank, p.name, p.unit, p.post].join(' ').toLowerCase();
        return blob.indexOf(fQ) >= 0;
      });
    }

    var nameToIdx = badNameIdxCached();
    var groups = [];
    var byUnit = Object.create(null);
    for (var gi = 0; gi < list.length; gi++) {
      var pg = list[gi];
      var ug = String((pg && pg.unit) || '').trim() || 'Անհայտ';
      if (!byUnit[ug]) { byUnit[ug] = []; groups.push(ug); }
      byUnit[ug].push(pg);
    }

    var rows = '';
    var MAX = 300;
    var painted = 0;
    for (var gxi = 0; gxi < groups.length; gxi++) {
      if (painted >= MAX) break;
      var u = groups[gxi];
      var members = byUnit[u];
      var withBad = 0;
      for (var wi = 0; wi < members.length; wi++) {
        var idx0 = idxOf(members[wi], nameToIdx);
        var live0 = (idx0 >= 0 && typeof db !== 'undefined' && db.people) ? db.people[idx0] : null;
        if (personBadDays(members[wi], live0).length > 0) withBad++;
      }
      rows += '<tr class="kmUtSec"><td colspan="5"><b>' + esc(u) + '</b>' +
        ' <span class="kmUtMuted">(' + members.length + ' անձ' +
        (withBad ? ', անհարմար՝ ' + withBad : '') + ')</span></td></tr>';
      var sorted = members;
      try {
        if (typeof window.kmSortPeopleByRank === 'function' && members.length <= 400) {
          sorted = window.kmSortPeopleByRank(members.slice());
        }
      } catch (_srt) { sorted = members; }
      for (var si = 0; si < sorted.length; si++) {
        if (painted >= MAX) break;
        var p = sorted[si];
        var idx = idxOf(p, nameToIdx);
        var live = (idx >= 0 && typeof db !== 'undefined' && db.people) ? db.people[idx] : null;
        var bad = personBadDays(p, live);
        var daysTxt = bad.length ? bad.join(', ') : '—';
        var rankSrc = live || p;
        var rank = typeof window.kmRankText === 'function' ? window.kmRankText(rankSrc.rank) : (rankSrc.rank || '');
        var name = String((live && live.name) || p.name || '').trim();
        try {
          if (typeof window.kmPersonDisplayName === 'function') {
            var dn = window.kmPersonDisplayName(live || p) || window.kmPersonDisplayName(p) || '';
            if (dn) name = dn;
          }
        } catch (_dn2) {}
        if (typeof window.kmLooksLikePersonName === 'function' && !window.kmLooksLikePersonName(name)) continue;
        var action = idx >= 0
          ? '<button type="button" onclick="openBadDays(' + idx + ')">Ընտրել (' + bad.length + '/31)</button>'
          : '<button type="button" onclick="kmUnitBadEnsureAndOpen(decodeURIComponent(\'' +
            encodeURIComponent(name) + '\'))">Ավելացնել և նշել</button>';
        rows += '<tr data-km-bad-idx="' + (idx >= 0 ? idx : '') + '"><td>' + esc(rank) + '</td><td>' + esc(name) + '</td><td>' + esc((live && live.unit) || p.unit || '') +
          '</td><td class="muted" data-km-bad-days>' + esc(daysTxt) + '</td><td class="kmUtActions">' + action + '</td></tr>';
        painted++;
      }
    }
    if (!rows) rows = '<tr><td colspan="5" class="kmUtMuted">Արդյունք չկա այս ֆիլտրով</td></tr>';
    else if (painted >= MAX) rows += '<tr><td colspan="5" class="kmUtMuted">Ցուցադրված է առաջին ' + MAX + '-ը — նեղացրեք ֆիլտրը</td></tr>';

    h.innerHTML = shell(PAGES.unitBadDays, filterBar +
      '<div class="gridwrap"><table class="kmUtTable"><thead><tr><th>Կոչում</th><th>Ա․Ա․Հ</th><th>Ստորաբաժանում</th><th>Անհարմար օրեր</th><th></th></tr></thead><tbody>' +
      rows + '</tbody></table></div>', '');
  }

  window.kmUnitBadFilterApply = function () {
    var u = document.getElementById('kmUtBadUnit');
    var q = document.getElementById('kmUtBadQ');
    window._kmUtBadFilter = {
      unit: u ? String(u.value || '') : '',
      q: q ? String(q.value || '') : ''
    };
    window.kmUnitOpen('unitBadDays');
  };
  window.kmUnitBadFilterClear = function () {
    window._kmUtBadFilter = { unit: '', q: '' };
    window.kmUnitOpen('unitBadDays');
  };
  window.kmUnitBadSyncFromPositions = function () {
    if (typeof window.kmSyncPeopleFromPositions === 'function') {
      try { window.kmSyncPeopleFromPositions(); } catch (e) {}
    }
    toastOk('Համաժամեցվեց Պաշտոնից');
    window.kmUnitOpen('unitBadDays');
  };
  window.kmUnitBadEnsureAndOpen = async function (name) {
    name = String(name || '').trim();
    if (!name) return;
    if (typeof window.kmLooksLikePersonName === 'function' && !window.kmLooksLikePersonName(name)) {
      toastErr('Ա․Ա․Հ դաշտում անձի անուն չէ');
      return;
    }
    if (typeof window.kmSyncPeopleFromPositions === 'function') {
      try { window.kmSyncPeopleFromPositions(); } catch (e0) {}
    }
    var idx = -1;
    if (typeof db !== 'undefined' && Array.isArray(db.people)) {
      idx = db.people.findIndex(function (x) {
        return x && String(x.name || '').trim() === name;
      });
      if (idx < 0) {
        var src = peopleListLikePositionsArchive().find(function (p) {
          return p && String(p.name || '').trim() === name;
        }) || { name: name };
        db.people.push({
          name: name,
          rank: src.rank || '',
          unit: src.unit || '',
          bad: [],
          phone: '',
          note: '',
          endDate: ''
        });
        await persist(true);
        idx = db.people.length - 1;
      }
    }
    if (idx >= 0 && typeof window.openBadDays === 'function') window.openBadDays(idx);
    else toastErr('Անձը չգտնվեց');
  };
  window.kmUnitBadBulkAdd = async function () { /* KM_BAD_DAYS_FAST_V2 */
    if (!canEdit()) return;
    var dayEl = document.getElementById('kmUtBadBulkDay');
    var day = Number(dayEl && dayEl.value);
    if (!(day >= 1 && day <= 31)) {
      toastErr('Նշեք օր 1–31');
      return;
    }
    if (!window._kmUtBadFilter) window._kmUtBadFilter = { unit: '', q: '' };
    var fUnit = String(window._kmUtBadFilter.unit || '');
    var fQ = String(window._kmUtBadFilter.q || '').trim().toLowerCase();
    if (!fUnit && !fQ) {
      if (!confirm('Ֆիլտր չկա։ Ավելացնե՞լ օրը բոլոր երևացողներին։')) return;
    }
    var list = (window._kmUtBadListCache && Array.isArray(window._kmUtBadListCache))
      ? window._kmUtBadListCache.slice()
      : (peopleListLikePositionsArchive() || []);
    if (fUnit) list = list.filter(function (p) { return String((p && p.unit) || '').trim() === fUnit; });
    if (fQ) {
      list = list.filter(function (p) {
        var blob = [p.rank, p.name, p.unit].join(' ').toLowerCase();
        return blob.indexOf(fQ) >= 0;
      });
    }
    var nameToIdx = Object.create(null);
    try {
      var plist = (typeof db !== 'undefined' && Array.isArray(db.people)) ? db.people : [];
      for (var ii = 0; ii < plist.length; ii++) {
        var xp = plist[ii];
        if (!xp) continue;
        var rn = String(xp.name || '').trim();
        if (rn && nameToIdx[rn.toLowerCase()] == null) nameToIdx[rn.toLowerCase()] = ii;
      }
    } catch (_m) {}
    var n = 0;
    for (var bi = 0; bi < list.length; bi++) {
      var p = list[bi];
      var nm = String((p && p.name) || '').trim();
      if (!nm) continue;
      var idx = nameToIdx[nm.toLowerCase()];
      if (idx == null || idx < 0) continue;
      var person = db.people[idx];
      if (!person) continue;
      if (!Array.isArray(person.bad)) person.bad = [];
      if (person.bad.indexOf(day) < 0) {
        person.bad.push(day);
        person.bad.sort(function (a, b) { return a - b; });
        n += 1;
      }
    }
    window._kmUtBadNameIdx = null;
    window._kmUtBadListCache = null;
    try { window.__kmSaveLight = true; } catch (_l) {}
    await persist(true);
    toastOk('Ավելացվեց ' + n + ' անձի');
    window.kmUnitOpen('unitBadDays');
  };

  

  /* ——— Home alerts ——— */
  window.kmUnitCollectAlerts = function () {
    window.kmUnitEnsureStores();
    var out = [];
    var med = medicalAlerts();
    if (med.length) {
      out.push({
        level: 'danger', page: 'unitMedical',
        text: 'Ժամկետանց ազատումներ՝ ' + med.length + ' (' + med.slice(0, 3).map(function (m) { return m.person; }).join(', ') + ')'
      });
    }
    var over = leaveOverloadDays(todayIso(), 14, (db.unitLeavePlan && db.unitLeavePlan.maxAbsentPct) || 20);
    if (over.length) {
      out.push({
        level: 'danger', page: 'unitLeavePlan',
        text: 'Արձակուրդի գերբեռնված օրեր՝ ' + over.length
      });
    }
    var terms = termItems().filter(function (t) { return t.left <= 14; });
    if (terms.length) {
      out.push({
        level: terms.some(function (t) { return t.danger; }) ? 'danger' : 'warn',
        page: 'unitTermWatch',
        text: 'Կոչման ժամկետներ՝ ' + terms.length +
          (terms[0] && terms[0].person ? (' · ' + terms.slice(0, 2).map(function (t) { return t.person; }).join(', ')) : '')
      });
    }
    return out;
  };

  window.kmUnitHomeAlertsHtml = function () {
    var alerts = window.kmUnitCollectAlerts();
    if (!alerts.length) return '';
    injectCss();
    return '<div class="kmUtHomeAlerts">' +
      alerts.map(function (a) {
        return '<div class="kmUtAlert ' + (a.level === 'danger' ? 'danger' : '') +
          '" onclick="kmOpenPage(\'' + a.page + '\')">' + esc(a.text) + ' →</div>';
      }).join('') + '</div>';
  };


  
  /* KM_UNIT_ARCHIVE_UNDER_ACCOUNTING_V1 */
  /* KM_UNIT_ARCHIVE_NATIVE_SHEET_V1 */
  /* KM_UNIT_ARCHIVE_KEEP_ORG_PICKER_V1 */
  /* KM_UNIT_ARCHIVE_GRANT_EDIT_V1 */
  /* KM_UNIT_ARCHIVE_VIRTUAL_GRID_V1 */
  /* KM_UNIT_ARCHIVE_PRESERVE_25836_V1 */
  
  /* KM_ARCHIVE_UI_DEDUPE_MANNING_V2 */
  window.kmDedupeFormalArchiveRows = function (rows) {
    if (!Array.isArray(rows) || !rows.length) return rows || [];
    function norm(s) {
      return String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
    }
    function keyOf(cells) {
      cells = cells || [];
      var u = norm(cells[0]);
      var p = norm(cells[1]);
      var c = norm(cells[5]);
      if (!p && !c) return '';
      return u + '|' + p + '|' + c;
    }
    function score(cells) {
      cells = cells || [];
      var n = 0;
      var name = String(cells[8] || '').trim();
      if (name) n += 10;
      for (var i = 0; i < cells.length; i++) if (String(cells[i] || '').trim()) n += 1;
      return n;
    }
    var best = Object.create(null);
    var meta = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (!r) continue;
      var typ = String(r.type || 'data');
      if (typ === 'title' || typ === 'header' || typ === 'section') {
        meta.push({ kind: 'keep', r: r });
        continue;
      }
      var cells = Array.isArray(r.cells) ? r.cells.slice() : [];
      while (cells.length < 25) cells.push('');
      var k = keyOf(cells);
      if (!k) {
        meta.push({ kind: 'keep', r: { type: typ, cells: cells } });
        continue;
      }
      if (best[k] == null) {
        best[k] = { type: 'data', cells: cells };
        meta.push({ kind: 'dedupe', key: k });
      } else if (score(cells) > score(best[k].cells)) {
        best[k] = { type: 'data', cells: cells };
      }
    }
    var out = [];
    for (var j = 0; j < meta.length; j++) {
      var m = meta[j];
      out.push(m.kind === 'dedupe' ? best[m.key] : m.r);
    }
    return out;
  };

  window.kmManningStatsFromFormalSheet = function (sheet) { /* KM_MANNING_REAL_PER_UNIT_V1 + KM_MANNING_PER_UNIT_V2 */
    /* Real manning: unique posts from THIS unit archive only.
       authorized = unique հաստիք (unit|position|code), filled = real Ա.Ա.Հ, vacant = authorized-filled */
    var authorized = 0, filled = 0;
    if (!sheet || !Array.isArray(sheet.rows)) return { authorized: 0, filled: 0, vacant: 0, percent: 0 };
    function norm(s) { return String(s || '').replace(/\s+/g, ' ').trim().toLowerCase(); }
    function isVacantName(n) {
      n = String(n || '').trim();
      if (!n) return true;
      if (/^[【\[]\s*թափուր/i.test(n)) return true;
      if (/^թափուր\b/i.test(n)) return true;
      if (n === 'Ա․Ա․Հ․' || n === 'Ա.Ա.Հ.' || n === 'Ա․Ա․Հ') return true;
      return false;
    }
    function isPerson(n) {
      if (isVacantName(n)) return false;
      if (typeof window.kmLooksLikePersonName === 'function') {
        try { return !!window.kmLooksLikePersonName(n); } catch (e0) { return /[Ա-Ֆա-ֆA-Za-z]/.test(n) && n.length > 2; }
      }
      return /[Ա-Ֆա-ֆA-Za-z]/.test(n) && n.length > 2;
    }
    function score(cells) {
      cells = cells || [];
      var n = 0;
      if (isPerson(cells[8])) n += 10;
      for (var i = 0; i < cells.length; i++) if (String(cells[i] || '').trim()) n += 1;
      return n;
    }
    // ALWAYS dedupe for manning (even HTML_V7 skel) — duplicates inflate %
    var best = Object.create(null);
    var rows = sheet.rows;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (!r) continue;
      var typ = String(r.type || 'data');
      if (typ === 'title' || typ === 'header' || typ === 'section') continue;
      var cells = Array.isArray(r.cells) ? r.cells : [];
      var pos = String(cells[1] || '').trim();
      var code = String(cells[5] || '').trim();
      if (!pos && !code) continue;
      if (pos === 'Պաշտոն') continue;
      var unit = String(cells[0] || '').trim();
      var k = norm(unit) + '|' + norm(pos) + '|' + norm(code);
      if (!k || k === '||') continue;
      var prev = best[k];
      if (!prev || score(cells) > score(prev)) best[k] = cells;
    }
    var keys = Object.keys(best);
    for (var j = 0; j < keys.length; j++) {
      authorized++;
      var name = String(best[keys[j]][8] || '').trim();
      if (isPerson(name)) filled++;
    }
    var vacant = Math.max(0, authorized - filled);
    var percent = authorized > 0 ? Math.round((filled / authorized) * 1000) / 10 : 0;
    return { authorized: authorized, filled: filled, vacant: vacant, percent: percent, rows: rows.length };
  };

window.kmRenderUnitArchivePage = function () {
    try{ if(typeof window.kmForceSecretIntoUnitArchive==='function') window.kmForceSecretIntoUnitArchive(); }catch(_fs){} /* KM_SECRET_FORCE_INTO_ARCHIVE_V1_CALL_ARCH */
    window.kmUnitEnsureStores();
    injectCss();
    var h = host();
    if (!h) return;

    var ARCHIVE_HEADERS = ["Ստորաբաժանում", "Պաշտոն", "Հ/Հ", "Գաղտնիության կարգ", "ԶՀՄ(ВУС)", "Կոդ", "Կոչումը ըստ հաստիքի", "Կոչում", "Ա․Ա․Հ․", "Պաշտոնի նշանակման հրաման", "Կոչումի հրաման", "Պայմանագիր", "Հատուկ նշում", "Կոնտակտ", "Ծննդյան թիվ", "ԶԿ (ՏՍ)", "Հասցե", "Ծառայության ընդունվելու (նշանակվելու տարեթիվը)", "Կարգ․ Տույժ", "Ծառայությունը զինված ուժերում", "Վերջին ընդունում", "Անձնական վկայական", "Արյան կարգ", "Գործի համար", "Արձակուրդ"];
    var ARCHIVE_ROW_SKEL = "thsdddddddddsddddddddddddddddddddddddddddsdddsddddsddddsddddddddsdddddddsddddsdddddddsddsdddddddsdsddddddddsddddddddsddddddddsdsddddddddsddddddddsddddddddsdsddddddddsddddddddsddddddddsddsddddddddsddddsddddsdddsddsdddddddsdsddddddddsddddddddsddddddddsdsddddddddsddddddddsddddddddsdsddddddddsddddddddsddddddddsddsddddddddsddddsddddsdddsddsdddddddsdsddddddddsddddddddsddddddddsdsddddddddsddddddddsddddddddsdsddddddddsddddddddsddddddddsddsddddddddsddddsddddsdddsddsdddddddsdsddddddddsddddddddsddddddddsdsddddddddsddddddddsddddddddsdsddddddddsddddddddsddddddddsddsddddddddsddddsddddsdddsdddsdddsdddsddsdddddddddddsdddddddddddsdddddddddddddddsddsddsddddsddddsddsddddddsddddddsddddsdddsddddsdsddddsddddsddddsdddddsdsddsddddddsddsddddddsdddddddsddsdddddddsdsddddddddsddddddddsddddddddsdsddddddddsddddddddsddddddddsdsddddddddsddddddddsddddddddsddsddddddddsddddsddddsdddsddsdddddddsdsddddddddsddddddddsddddddddsdsddddddddsddddddddsddddddddsdsddddddddsddddddddsddddddddsddsddddddddsddddsddddsdddsddsdddddddsdsddddddddsddddddddsddddddddsdsddddddddsddddddddsddddddddsddsddddddddsddddsddddsdddsddsddddddsdsdsddddddddsddddddddsddddddddsdsddddddddsddddddddsddddddddsddsddddddddsddddsddddsdddsdddsdddsdddsddsdddddddddddsdddddddddddsdddddddddddddddsddsdddsddddsddddsddddddsddsddddddsddddddsddddsdddsddddsdddddsdsddddsddddsddddsdsddsddddddsddsddddddsdddddddsddsdddddddsdsddddddddsddddddddsddddddddsdsddddddddsddddddddsddddddddsdsddddddddsddddddddsddddddddsddsddddddddsddddsddddsdddsddsdddddddsdsddddddddsddddddddsddddddddsdsddddddddsddddddddsddddddddsdsddddddddsddddddddsddddddddsddsddddddddsddddsddddsdddsddsdddddddsdsddddddddsddddddddsddddddddsdsddddddddsddddddddsddddddddsdsddddddddsddddddddsddddddddsddsddddddddsddddsddddsdddsddsdddddddsdsddddddddsddddddddsddddddddsdsddddddddsddddddddsdsdddsdsddsdsdsddddddddsddddddddsddddddddsddsddddddddsddddsddddsdddsdddsdddsdddsddsdddddddddddsdddddddddddsdddddddddddddddsddsdsddddsdsddddsddsddddddsddddddsddddsdddsddddsdsddddsddddsddddsdddddsdsddddddddsddsddddddsdddddsddsdsdddddddsddddddsdsdsdddddddsddddsdddddddddddsdddddddddddsddsdsdsdddddddsddddsdddddddddddsdddddddddddsddsdsddddddddsddddsdddddddddddsdddddddddddsddsdsdddddsddsdddsdddsddsdddsddddddddddddddsddddddddddddddsdsdsdddddddsdddsdddddddsdddddddsdddddddddsddsdddddsddddddsdddddsdddddsdddddsdddddsdddsddddsddddsdddsdddsdddsddsddddsdsddddddsddddddsdsddddddsddddddsddsdddsddddsdddddsdddddsdsdsdddsdddsdddsdsddddsdddddsdddsdddsddddsdddsddddddddsdddddsdsdddddsdddddsdddddsdddddsdsdddddddddsddddsddddsdsdsddddsdddddddsdddddsdddddddddsddddsdsdddsdddddddddddsddddddddddddsddddddsdddddsdsddddsddddsddddsddddsdsdddsdsddsddsdddddddddddddddddddsddsddddddddddddsdd"; /* KM_UNIT_ARCHIVE_25836_HTML_V7 */ /* KM_UNIT_ARCHIVE_25836_HTML_V7 */ /* KM_UNIT_ARCHIVE_25836_HTML_V6 */ /* KM_UNIT_ARCHIVE_25836_HTML_V5 */ /* KM_UNIT_ARCHIVE_25836_HTML_V4_FULL */ /* KM_UNIT_ARCHIVE_25836_HTML_V4_FULL */ /* KM_UNIT_ARCHIVE_25836_HTML_V4_FULL */ /* KM_UNIT_ARCHIVE_25836_HTML_V3 */ /* KM_ARCHIVE_UI_DEDUPE_MANNING_V2_SKEL */ /* KM_UNIT_ARCHIVE_25836_NEW_HTML_V2 */
    var ARCHIVE_COL_COUNT = ARCHIVE_HEADERS.length;
    var ROW_H = 38;
    var OVERSCAN = 12;
    /* KM_UNIT_ARCHIVE_WIDE_COLS_V1 */
    var ARCHIVE_COL_WIDTHS = [200,260,110,160,140,120,180,170,280,260,220,200,170,200,150,170,300,250,140,220,170,220,130,170,140];
    function colWidth(ci) {
      var w = ARCHIVE_COL_WIDTHS[ci];
      return (w == null ? 160 : w);
    }
    function colStyle(ci) {
      var w = colWidth(ci);
      return 'width:' + w + 'px;min-width:' + w + 'px;max-width:none';
    }
    /* KM_UNIT_ARCHIVE_UI_CLEAN_V1 */
    /* KM_UNIT_ARCHIVE_UI_CLEAN_V2 */
    function isDuplicateHeaderRow(row) {
      if (!row) return true;
      if (row.type === 'header') return true;
      var cells = row.cells || [];
      var hits = 0;
      for (var i = 0; i < Math.min(ARCHIVE_HEADERS.length, cells.length); i++) {
        var a = String(ARCHIVE_HEADERS[i] || '').trim();
        var b = String(cells[i] || '').trim();
        if (a && b && a === b) hits++;
      }
      return hits >= 8;
    }
    function buildVisibleIndexMap(rows) {
      var map = [];
      for (var i = 0; i < rows.length; i++) {
        if (isDuplicateHeaderRow(rows[i])) continue;
        map.push(i);
      }
      return map;
    }

    var UNIT_25836_IDS = { bk2_u1: 1 };


    function isSuper() {
      try {
        if (window.kmSuperAdmin === true) return true;
        if (typeof window.kmIsSuperAdmin === 'function' && window.kmIsSuperAdmin()) return true;
        if (sessionStorage.getItem('km_auth_super') === '1') return true;
      } catch (e) {}
      return false;
    }

    function canUseArchive() {
      if (isSuper()) return true;
      try { if (typeof window.kmCanAccessPage === 'function' && window.kmCanAccessPage('unitArchive')) return true; } catch (e1) {}
      try { if (typeof window.kmUserHasGrant === 'function' && window.kmUserHasGrant('unitArchive')) return true; } catch (e2) {}
      try { if (typeof window.kmHasGrant === 'function' && window.kmHasGrant('unitArchive')) return true; } catch (e3) {}
      return false;
    }

    if (!canUseArchive()) {
      h.innerHTML =
        '<div class="card kmUtShell">' +
          '<div class="kmUtBar">' +
            '<div><h3 style="margin:0">Զորամասի Արխիվ</h3>' +
            '<div class="kmUtMuted">Հասանելի է սուպեր ադմինին կամ ադմինի տված թույլտվությամբ</div></div>' +
            '<div class="kmUtActions">' +
              '<button type="button" class="kmBackBtn" onclick="(window.kmBackToPage||window.kmOpenPage)(\'accounting\')" data-km-back="KM_BACK_AUDIT_V1">' +
                ((typeof window.KM_BACK_LABEL === 'string' && window.KM_BACK_LABEL) || '← Վերադարձ') +
              '</button>' +
            '</div>' +
          '</div>' +
          '<div class="kmUtAlert danger" style="margin-top:12px">Այս բաժինը բացելու / լրացնելու համար պետք է սուպեր ադմին լինել կամ ադմինիստրատորից ստանալ «Զորամասի Արխիվ» թույլտվությունը։</div>' +
        '</div>';
      if (typeof window.kmApplyRoleGuard === 'function') window.kmApplyRoleGuard();
      return;
    }

    function ensureStore() {
      if (typeof db === 'undefined' || !db) return null;
      if (!db.unitFormalArchives || typeof db.unitFormalArchives !== 'object' || Array.isArray(db.unitFormalArchives)) {
        db.unitFormalArchives = {};
      }
      return db.unitFormalArchives;
    }

    function typeFromSkel(ch) {
      if (ch === 't') return 'title';
      if (ch === 'h') return 'header';
      if (ch === 's') return 'section';
      return 'data';
    }

    function emptyCells() {
      var a = new Array(ARCHIVE_COL_COUNT);
      for (var i = 0; i < ARCHIVE_COL_COUNT; i++) a[i] = '';
      return a;
    }

    function buildEmptyRows() {
      var rows = new Array(ARCHIVE_ROW_SKEL.length);
      for (var i = 0; i < ARCHIVE_ROW_SKEL.length; i++) {
        rows[i] = { type: typeFromSkel(ARCHIVE_ROW_SKEL.charAt(i)), cells: emptyCells() };
      }
      return rows;
    }

    function isUnit25836(unitId, unitName) {
      var id = String(unitId || '').trim();
      var name = String(unitName || '').trim();
      if (UNIT_25836_IDS[id]) return true;
      if (/25836/.test(id) || /25836/.test(name)) return true;
      return false;
    }

    function countNonEmpty(rows) {
      var n = 0;
      if (!rows) return 0;
      for (var i = 0; i < rows.length; i++) {
        var cells = rows[i] && rows[i].cells;
        if (!cells) continue;
        for (var c = 0; c < cells.length; c++) {
          if (String(cells[c] || '').trim()) n++;
        }
      }
      return n;
    }

    function load25836SeedSync() {
      if (typeof window.kmLoadHtmlV7SeedSync === 'function') {
        try {
          var seedG = window.kmLoadHtmlV7SeedSync();
          if (seedG && Array.isArray(seedG.roster) && seedG.roster.length) return seedG;
        } catch (eG) {}
      }
      if (window.__kmUnit25836Seed && window.__kmUnit25836Seed.roster) return window.__kmUnit25836Seed;
      try {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', 'data/km_unit_archive_25836.json', false);
        xhr.send(null);
        if (xhr.status === 0 || (xhr.status >= 200 && xhr.status < 300)) {
          window.__kmUnit25836Seed = JSON.parse(xhr.responseText);
          return window.__kmUnit25836Seed;
        }
      } catch (eX) {}
      return null;
    }

    function sheetFrom25836Seed /* KM_UNIT_ARCHIVE_25836_HTML_V4_FULL_SEED_ALL_CELLS */(unitId) {
      if (typeof window.kmBuildHtmlV7Sheet === 'function') {
        try {
          var built = window.kmBuildHtmlV7Sheet(unitId || 'bk2_u1');
          if (built && Array.isArray(built.rows) && built.rows.length) return built;
        } catch (eB) {}
      }
      var seed = load25836SeedSync();
      if (!seed || !Array.isArray(seed.roster) || !seed.roster.length) {
        return null;
      }
      var rows = seed.roster.map(function (r, idx) {
        var cells = emptyCells();
        var src = (r && Array.isArray(r.cells)) ? r.cells : [];
        for (var c = 0; c < ARCHIVE_COL_COUNT; c++) cells[c] = src[c] != null ? String(src[c]) : '';
        return { type: (r && r.type) || typeFromSkel(ARCHIVE_ROW_SKEL.charAt(idx)), cells: cells };
      });
      return {
        unitId: String(unitId || '').trim(),
        headers: (seed.headers && seed.headers.length === ARCHIVE_COL_COUNT) ? seed.headers.slice() : ARCHIVE_HEADERS.slice(),
        rows: rows,
        source: 'html-25836-preserved',
        preserve25836: true,
        noExcel: true,
        updatedAt: new Date().toISOString()
      };
    }

    function normalizeEmptySheet(unitId) {
      return {
        unitId: String(unitId || '').trim(),
        headers: ARCHIVE_HEADERS.slice(),
        rows: buildEmptyRows(),
        source: 'native-empty',
        noExcel: true,
        updatedAt: new Date().toISOString()
      };
    }

    function persist() {
      try {
        if (typeof window.kmSaveDb === 'function') window.kmSaveDb();
        else if (typeof saveDb === 'function') saveDb();
        else if (typeof window.saveDb === 'function') window.saveDb();
      } catch (eSave) {}
    }

    /* KM_UNIT_ARCHIVE_DATA_LOGIC_STRICT_V1
         25836 = full original forever; other units = same 25x1899 skel, listed fill cols empty for entry */
    var FILL_COL_INDEXES = [7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 21, 23];
    // 7 Կոչում, 8 Ա․Ա․Հ․, 9 Պաշտոնի նշանակման հրաման, 10 Կոչումի հրաման, 11 Պայմանագիր,
    // 13 Կոնտակտ, 14 Ծննդյան թիվ, 15 ԶԿ (ՏՍ), 16 Հասցե, 17 Ծառայության ընդունվելու,
    // 21 Անձնական վկայական, 23 Գործի համար

    function clearFillCols(rows) {
      if (!rows) return rows;
      for (var i = 0; i < rows.length; i++) {
        if (!rows[i] || !Array.isArray(rows[i].cells)) continue;
        for (var f = 0; f < FILL_COL_INDEXES.length; f++) {
          var ci = FILL_COL_INDEXES[f];
          if (ci >= 0 && ci < ARCHIVE_COL_COUNT) rows[i].cells[ci] = '';
        }
      }
      return rows;
    }

    /* KM_UNIT_ARCHIVE_SELECTIVE_CLEAR_ONLY_V1 */
    function cloneTemplateKeepingStructure(unitId) {
      // Use 25836 HTML snapshot as layout/structure template, then clear ONLY fill columns.
      // Do NOT wipe structural cells (ստորաբաժանում, պաշտոն, Հ/Հ, կոդ, sections, etc.).
      var seeded = sheetFrom25836Seed(unitId);
      if (seeded && Array.isArray(seeded.rows) && seeded.rows.length === ARCHIVE_ROW_SKEL.length) {
        seeded.unitId = String(unitId || '').trim();
        seeded.preserve25836 = false;
        seeded.source = 'template-structure-fill-cols-empty';
        seeded.noExcel = true;
        clearFillCols(seeded.rows);
        return seeded;
      }
      // Fallback if seed missing: typed empty skel (should rarely happen)
      var sheet = normalizeEmptySheet(unitId);
      sheet.source = 'native-empty-other-unit-fallback';
      sheet.preserve25836 = false;
      clearFillCols(sheet.rows);
      return sheet;
    }

    function buildOtherUnitSheet(unitId) {
      return cloneTemplateKeepingStructure(unitId);
    }

    function getSheet(unitId, unitName) {
      var store = ensureStore();
      var uid = String(unitId || '').trim();
      var uname = String(unitName || '').trim();
      if (!store || !uid) return buildOtherUnitSheet(uid);

      var existing = store[uid];
      var preserve = isUnit25836(uid, uname);

      if (preserve) {
        /* KM_UNIT_ARCHIVE_HTML_V7_SSOT_V1: ALWAYS rebuild 25836 from packaged HTML_V7 */
        try {
          if (typeof window.kmEnsureHtmlV7UnitArchive === 'function') {
            var __ens = window.kmEnsureHtmlV7UnitArchive({ noPersist: false });
            if (__ens && Array.isArray(__ens.rows) && __ens.rows.length) {
              store['bk2_u1'] = __ens;
              return __ens;
            }
          }
        } catch (eEns) {}
        if (String(uid) === 'bk2_u1' || String(uid) === '25836') {
          var __seedV7 = null;
          try { __seedV7 = sheetFrom25836Seed('bk2_u1'); } catch (eSeed) { __seedV7 = null; }
          if (__seedV7 && __seedV7.rows && __seedV7.rows.length) {
            __seedV7.source = 'html-25836-HTML_V7';
            __seedV7.preserve25836 = true;
            __seedV7.noExcel = true;
            __seedV7.forceHtmlV7 = true;
            store['bk2_u1'] = __seedV7;
            try { persist(); } catch (eP) {}
            return __seedV7;
          }
        }
        /* stripped prior force by V7 */
        /* stripped prior force by V7 */
        /* stripped prior force by V6 */
        // CRITICAL: never wipe/clear/delete 25836 historical data.
        if (existing && existing.preserve25836 === false && countNonEmpty(existing.rows || []) === 0) {
          existing = null; // discard accidental empty overwrite marker
        }
        if (existing && Array.isArray(existing.rows) && existing.rows.length === ARCHIVE_ROW_SKEL.length && countNonEmpty(existing.rows) > 0) {
          existing.preserve25836 = true;
          if (!existing.source || existing.source.indexOf('25836') < 0) existing.source = 'html-25836-preserved';
          store[uid] = existing;
          return existing;
        }
        var seeded = sheetFrom25836Seed(uid);
        if (seeded && countNonEmpty(seeded.rows) > 0) {
          store[uid] = seeded;
          persist();
          return seeded;
        }
        if (existing && Array.isArray(existing.rows) && existing.rows.length === ARCHIVE_ROW_SKEL.length) {
          existing.preserve25836 = true;
          return existing;
        }
        var emptyPreserved = normalizeEmptySheet(uid);
        emptyPreserved.preserve25836 = true;
        emptyPreserved.source = 'html-25836-awaiting-seed';
        store[uid] = emptyPreserved;
        return emptyPreserved;
      }

      // ALL OTHER units: keep full structural template; clear ONLY fill columns.
      // Never treat as 25836 preserved store.
      if (existing && existing.preserve25836) {
        existing = null;
      }
      var needsStructureRebuild = !existing || !Array.isArray(existing.rows) || existing.rows.length !== ARCHIVE_ROW_SKEL.length;
      if (!needsStructureRebuild) {
        // Detect previous "wipe everything" sheets (all/nearly all empty) and restore structure.
        var non = countNonEmpty(existing.rows);
        var src = String(existing.source || '');
        if (non < 50 && (src.indexOf('native-empty') >= 0 || src === '' || src.indexOf('fallback') >= 0)) {
          needsStructureRebuild = true;
        }
      }
      if (needsStructureRebuild) {
        existing = buildOtherUnitSheet(uid);
        store[uid] = existing;
        persist();
      } else {
        // Keep structural cells; ensure listed fill columns stay empty unless user already saved edits
        // in those columns after selective-clear era.
        var userEditedFills = existing.source === 'template-structure-fill-cols-empty' && existing._userEditedFills === true;
        if (!userEditedFills) {
          clearFillCols(existing.rows);
          existing.source = 'template-structure-fill-cols-empty';
        }
        existing.headers = ARCHIVE_HEADERS.slice();
        existing.noExcel = true;
        existing.preserve25836 = false;
        store[uid] = existing;
      }
      return existing;
    }

    function notify(msg, kind) {
      if (typeof toast === 'function') toast(msg, kind || 'ok');
      else if (typeof window.kmNotify === 'function') window.kmNotify(msg, kind || 'ok');
    }

    function readCtx() {
      var orgCtx = typeof window.kmGetOrgContext === 'function' ? window.kmGetOrgContext() : null;
      return {
        unitId: String((orgCtx && orgCtx.unitId) || '').trim(),
        unitName: String((orgCtx && (orgCtx.unitName || orgCtx.unitLabel)) || '').trim(),
        corpsId: String((orgCtx && orgCtx.corpsId) || '').trim(),
        corpsName: String((orgCtx && orgCtx.corpsName) || '').trim()
      };
    }

    function rowBg(type, idx) {
      if (type === 'title') return '#dbeafe';
      if (type === 'header') return '#e8eef6';
      if (type === 'section') return '#fff4e0';
      return (idx % 2 ? '#f0f4f9' : '#ffffff');
    }

    function flushVisibleEdits(sheet, hostEl) {
      if (!sheet || !hostEl) return;
      hostEl.querySelectorAll('tr[data-ri]').forEach(function (tr) {
        var ri = Number(tr.getAttribute('data-ri') || -1);
        if (ri < 0 || !sheet.rows[ri]) return;
        tr.querySelectorAll('input[data-ci]').forEach(function (el) {
          var ci = Number(el.getAttribute('data-ci') || -1);
          if (ci < 0 || ci >= ARCHIVE_COL_COUNT) return;
          sheet.rows[ri].cells[ci] = String(el.value || '');
        });
      });
    }

    function saveSheet(unitId, sheet, unitName) {
      var store = ensureStore();
      var uid = String(unitId || '').trim();
      if (!store || !uid || !sheet) {
        notify('Ընտրեք զորամաս', 'warn');
        return false;
      }
      if (isUnit25836(uid, unitName)) {
        sheet.preserve25836 = true;
        sheet.source = 'html-25836-preserved';
      } else {
        sheet.preserve25836 = false;
        sheet.source = 'template-structure-fill-cols-empty';
        sheet._userEditedFills = true;
      }
      sheet.updatedAt = new Date().toISOString();
      sheet.noExcel = true;
      store[uid] = sheet;
      persist();
      notify('Արխիվը պահվեց (' + sheet.rows.length + '×' + ARCHIVE_COL_COUNT + ')', 'ok');
      try {
        if (typeof window.kmPullFormalArchiveToTroopStaff === 'function') window.kmPullFormalArchiveToTroopStaff({ silent: true });
        if (window.page === 'troopStructure' && typeof window.kmOpenTroopStructure === 'function') {
          window._kmTroopForcePaint = true;
          window.kmOpenTroopStructure();
        }
      } catch (ePull) {}
      return true;
    }

    function paintVirtual(sheet, scrollEl, bodyEl) { /* KM_SECRET_FORCE_BEFORE_PAINT_V1_PV */
      try{
        if(sheet && Array.isArray(sheet.rows) && typeof window.kmForceSecretIntoUnitArchive==='function'){
          var emptySec=0, dataN=0;
          for(var __i=0;__i<Math.min(sheet.rows.length,80);__i++){
            var __r=sheet.rows[__i]; if(!__r||!__r.cells) continue;
            var __t=String(__r.type||'data'); if(__t==='title'||__t==='header'||__t==='section') continue;
            dataN++; if(!String(__r.cells[3]||'').trim()) emptySec++;
          }
          if(dataN>10 && emptySec>dataN*0.8){
            window.kmForceSecretIntoUnitArchive(window._kmUnitArchiveActiveUnitId);
            var __uid=String(window._kmUnitArchiveActiveUnitId||'');
            if(typeof db!=='undefined' && db && db.unitFormalArchives){
              /* KM_MANNING_PER_UNIT_V2 */ sheet = db.unitFormalArchives[__uid] || ((__uid && ((window.kmIsHtmlV7UnitId && window.kmIsHtmlV7UnitId(__uid)) || /25836/.test(__uid))) ? db.unitFormalArchives.bk2_u1 : null) || sheet;
              window._kmUnitArchiveActiveSheet = sheet;
            }
          }
        }
      }catch(_pv){}
      if (!sheet || !scrollEl || !bodyEl) return;
      flushVisibleEdits(sheet, bodyEl);
      var vis = buildVisibleIndexMap(sheet.rows || []);
      var total = vis.length;
      var viewH = scrollEl.clientHeight || 400;
      var start = Math.max(0, Math.floor(scrollEl.scrollTop / ROW_H) - OVERSCAN);
      var end = Math.min(total, Math.ceil((scrollEl.scrollTop + viewH) / ROW_H) + OVERSCAN);
      var parts = [];
      parts.push('<tr style="height:' + (start * ROW_H) + 'px"><td colspan="' + ARCHIVE_COL_COUNT + '" style="padding:0;border:0"></td></tr>');
      for (var vi = start; vi < end; vi++) {
        var ri = vis[vi];
        var row = sheet.rows[ri];
        var bg = rowBg(row.type, ri);

        var rtype = String(row.type || 'data');
        if (rtype === 'section' || rtype === 'title') {
          var sepLabel = '';
          try {
            var cc = row.cells || [];
            for (var si = 0; si < cc.length; si++) {
              var sv = String(cc[si] || '').trim();
              if (sv) { sepLabel = sv; break; }
            }
          } catch (eSep) {}
          if (!sepLabel) sepLabel = rtype === 'title' ? '—' : 'ԲԱԺԻՆ';
          parts.push('<tr data-ri="' + ri + '" data-rtype="' + esc(rtype) + '" class="kmArchSepRow" style="height:' + ROW_H + 'px">' +
            '<td colspan="' + ARCHIVE_COL_COUNT + '" style="padding:8px 14px;border:1px solid #e0c48a;background:' + (rtype === 'title' ? '#dbeafe' : '#fff4e0') + ';' +
            'font-weight:700;letter-spacing:.03em;text-transform:uppercase;pointer-events:none;user-select:none">' + esc(sepLabel) + '</td></tr>');
          continue;
        }
        var tds = '';
        for (var ci = 0; ci < ARCHIVE_COL_COUNT; ci++) {
          var val = row.cells[ci] || '';
          tds += '<td style="padding:0;border:1px solid #d0d7e2;background:' + bg + ';height:' + ROW_H + 'px;' + colStyle(ci) + '">' +
            '<input data-ci="' + ci + '" value="' + esc(val) + '" title="' + esc(val) + '" ' +
            'style="width:100%;min-width:100%;height:' + (ROW_H - 2) + 'px;border:0;padding:6px 12px;background:transparent;font:inherit;box-sizing:border-box;white-space:nowrap" />' +
            '</td>';
        }
        parts.push('<tr data-ri="' + ri + '" data-rtype="' + esc(row.type) + '" style="height:' + ROW_H + 'px">' + tds + '</tr>');
      }
      var after = total - end;
      if (after > 0) {
        parts.push('<tr style="height:' + (after * ROW_H) + 'px"><td colspan="' + ARCHIVE_COL_COUNT + '" style="padding:0;border:0"></td></tr>');
      }
      bodyEl.innerHTML = parts.join('');
      /* KM_TROOP_FORMAL_BIDI_SYNC_V1_UT archive cell → troop live */
      if (!bodyEl.__kmFormalLiveBound) {
        bodyEl.__kmFormalLiveBound = true;
        var syncFormalToTroop = function () {
          try {
            flushVisibleEdits(sheet, bodyEl);
            if (typeof window.kmPullFormalArchiveToTroopStaff === 'function') {
              window.kmPullFormalArchiveToTroopStaff({ silent: true });
            }
            try {
              if (typeof window.kmSaveDb === 'function') window.kmSaveDb();
              else if (typeof saveDb === 'function') saveDb();
            } catch (eSv) {}
          } catch (eLive) {}
        };
        bodyEl.addEventListener('change', function () {
          if (window._kmFormalLiveT) clearTimeout(window._kmFormalLiveT);
          window._kmFormalLiveT = setTimeout(syncFormalToTroop, 100);
        });
        bodyEl.addEventListener('input', function () {
          if (window._kmFormalLiveT) clearTimeout(window._kmFormalLiveT);
          window._kmFormalLiveT = setTimeout(syncFormalToTroop, 180);
        });
      }
    }

    function renderSheetOnly(sheetHost, ctx) {
      try { if (ctx && ctx.sheet) window.kmSyncArchiveSheetIdentities(ctx.sheet); } catch (eId) {}
      if (!sheetHost) return;
      if (!ctx.unitId) {
        sheetHost.innerHTML = '<div class="kmUtAlert" style="margin:12px 0 0">Ընտրեք զորամասը (կորպուս + զորամաս) նույն բնօրինակ ընտրիչով։</div>';
        return;
      }
      var sheet = getSheet(ctx.unitId, ctx.unitName);
      /* KM_UNIT_ARCHIVE_HTML_V7_SSOT_V1: never persist DEDUPE onto 25836 / HTML_V7 */
      if (sheet && Array.isArray(sheet.rows)) {
        var skipDedupePersist = !!(sheet.forceHtmlV7 ||
          String(sheet.source || '').indexOf('HTML_V7') >= 0 ||
          isUnit25836(ctx.unitId, ctx.unitName));
        if (!skipDedupePersist) {
          var beforeN = sheet.rows.length;
          var deduped = window.kmDedupeFormalArchiveRows(sheet.rows);
          if (deduped.length !== beforeN) {
            sheet.rows = deduped;
            sheet.source = String(sheet.source || '') + '+DEDUPE_V2';
            sheet.updatedAt = new Date().toISOString();
            try {
              var storeD = ensureStore();
              if (storeD && ctx.unitId) {
                storeD[ctx.unitId] = sheet;
                persist();
              }
            } catch (eDedupePersist) {}
          }
        }
      }
      try{ if(typeof window.kmForceSecretIntoUnitArchive==='function'){ window.kmForceSecretIntoUnitArchive(ctx && ctx.unitId); if(db && db.unitFormalArchives){ var __uid=String((ctx&&ctx.unitId)||''); /* KM_MANNING_PER_UNIT_V2 */ sheet = db.unitFormalArchives[__uid] || ((__uid && ((window.kmIsHtmlV7UnitId && window.kmIsHtmlV7UnitId(__uid)) || /25836/.test(__uid))) ? db.unitFormalArchives.bk2_u1 : null) || sheet; } } }catch(_fp){} /* KM_SECRET_FORCE_BEFORE_PAINT_V1 */
      window._kmUnitArchiveActiveSheet = sheet; window._kmUnitArchiveActiveUnitId = ctx.unitId;
      /* KM_MANNING_PER_UNIT_V2 */
      try {
        var __uidPaint = String((ctx && ctx.unitId) || '').trim();
        var __is25836 = !!(__uidPaint && ((window.kmIsHtmlV7UnitId && window.kmIsHtmlV7UnitId(__uidPaint)) || /25836/.test(__uidPaint) || isUnit25836(__uidPaint, ctx && ctx.unitName)));
        if (sheet && !__is25836) {
          var __srcP = String(sheet.source || '');
          if (sheet.preserve25836 || sheet.forceHtmlV7 || __srcP.indexOf('HTML_V7') >= 0 || __srcP.indexOf('html-25836') >= 0 || String(sheet.unitId || '') === 'bk2_u1') {
            sheet = getSheet(ctx.unitId, ctx.unitName);
            window._kmUnitArchiveActiveSheet = sheet;
          }
        }
        if ((!sheet || !sheet.rows) && __uidPaint && !__is25836) {
          sheet = getSheet(ctx.unitId, ctx.unitName);
          window._kmUnitArchiveActiveSheet = sheet;
        }
      } catch (_mp) {}
      var manStats = window.kmManningStatsFromFormalSheet(sheet);
      var filled = countNonEmpty(sheet.rows);
      var note25836 = isUnit25836(ctx.unitId, ctx.unitName)
        ? (' · 25836 · համալրված ' + manStats.filled + '/' + manStats.authorized + ' (' + manStats.percent + '%) · ' + filled + ' լցված բջիջ · ' + (sheet.rows || []).length + ' տող')
        : (' · կառուցվածքը պահված է · համալրված ' + manStats.filled + '/' + manStats.authorized + ' (' + manStats.percent + '%)');
      var head = ARCHIVE_HEADERS.map(function (label, ci) {
        return '<th style="position:sticky;top:0;background:#e8eef6;z-index:3;' + colStyle(ci) + ';padding:10px 12px;border:1px solid #d0d7e2;text-align:left;font-weight:700;white-space:normal;line-height:1.25;vertical-align:bottom">' + esc(label) + '</th>';
      }).join('');
      sheetHost.innerHTML =
        '<div class="kmUtMuted" style="margin:12px 0;font-size:12px">Virtual scroll · ' + ARCHIVE_COL_COUNT + '×' + ARCHIVE_ROW_SKEL.length + note25836 + '։ Կորպուս/զորամասի ընտրիչը բնօրինակն է։</div>' +
        '<div id="kmUnitArchScroll" style="overflow:auto;overflow-x:auto;overflow-y:auto;-webkit-overflow-scrolling:touch;height:calc(100vh - 280px);border:1px solid #d0d7e2;border-radius:10px;background:#fff;max-width:100%">' +
          '<table style="border-collapse:collapse;table-layout:fixed;width:max-content;min-width:100%;font-size:13px">' +
            '<thead><tr>' + head + '</tr></thead>' +
            '<tbody id="kmUnitArchBody"></tbody>' +
          '</table>' +
        '</div>';
      var scrollEl = sheetHost.querySelector('#kmUnitArchScroll');
      var bodyEl = sheetHost.querySelector('#kmUnitArchBody');
      var onScroll = function () { paintVirtual(sheet, scrollEl, bodyEl); };
      if (scrollEl._kmArchScrollHandler) {
        try { scrollEl.removeEventListener('scroll', scrollEl._kmArchScrollHandler); } catch (eRm) {}
      }
      scrollEl._kmArchScrollHandler = onScroll;
      scrollEl.addEventListener('scroll', onScroll, { passive: true });
      requestAnimationFrame(function () { requestAnimationFrame(onScroll); });
    }

    function render() {
      var ctx = readCtx();
      var existing = h.querySelector('#kmUnitFormalArchive');
      /* KM_ADMIN_HOME_ORG_PICK_V1: no in-page picker gate */
      if (existing && h.querySelector('#kmUnitArchSheetHost')) {
        var titleEl = existing.querySelector('[data-km-arch-title]');
        if (titleEl) {
          var bits = [];
          if (ctx.corpsName) bits.push(ctx.corpsName);
          if (ctx.unitName || ctx.unitId) bits.push(ctx.unitName || ctx.unitId);
          titleEl.textContent = bits.length ? (' · ' + bits.join(' · ')) : '';
        }
        renderSheetOnly(h.querySelector('#kmUnitArchSheetHost'), ctx);
        try {
          var mh2 = h.querySelector('#kmUnitArchManningHost');
          if (mh2) {
            var st2 = (typeof window.kmUnitManningStats === 'function' ? window.kmUnitManningStats(window._kmUnitArchiveActiveUnitId) : window.kmManningStatsFromFormalSheet(window._kmUnitArchiveActiveSheet));
            mh2.innerHTML = '<div class="kmManningPct" style="margin:8px 0 12px;padding:10px 12px;border-radius:10px;background:#eef6f1;border:1px solid #cfe3d7;font-size:14px">' +
              '<b>Համալրվածություն՝ ' + st2.percent + '%</b>' +
              ' <span class="muted">(' + st2.filled + ' / ' + st2.authorized + ' հաստիք · ' + (st2.vacant != null ? st2.vacant : Math.max(0,st2.authorized-st2.filled)) + ' թափուր)</span></div>';
          }
        } catch (eMan2) {}
        return;
      }

      /* KM_ADMIN_HOME_ORG_PICK_V1: org picker on landing only */
      var titleBits = [];
      if (ctx.corpsName) titleBits.push(ctx.corpsName);
      if (ctx.unitName || ctx.unitId) titleBits.push(ctx.unitName || ctx.unitId);

      h.innerHTML =
        '<div class="card kmUtShell" id="kmUnitFormalArchive">' +
          '<div class="kmUtBar">' +
            '<div><h3 style="margin:0">Զորամասի Արխիվ</h3>' +
            '<div class="kmUtMuted">Ներկառուցված · առանց Excel · ' + ARCHIVE_COL_COUNT + '×' + ARCHIVE_ROW_SKEL.length +
              '<span data-km-arch-title>' + (titleBits.length ? (' · ' + esc(titleBits.join(' · '))) : '') + '</span>' +
            '</div></div>' +
            '<div class="kmUtActions">' +
              '<button type="button" class="primary" id="kmUnitArchSaveBtn">Պահել</button>' +
              '<button type="button" class="kmBackBtn" onclick="(window.kmBackToPage||window.kmOpenPage)(\'accounting\')" data-km-back="KM_BACK_AUDIT_V1">' +
                ((typeof window.KM_BACK_LABEL === 'string' && window.KM_BACK_LABEL) || '← Վերադարձ') +
              '</button>' +
            '</div>' +
          '</div>' +
          (typeof window.kmUnitManningPercentHtml === 'function' ? window.kmUnitManningPercentHtml() : '') + 
          '<div id="kmUnitArchSheetHost"></div>' +
        '</div>';

      /* KM_ADMIN_HOME_ORG_PICK_V1: no in-page org picker */

      var saveBtn = h.querySelector('#kmUnitArchSaveBtn');
      if (saveBtn) {
        saveBtn.addEventListener('click', function () {
          var c = readCtx();
          var sheet = window._kmUnitArchiveActiveSheet || (c.unitId ? getSheet(c.unitId, c.unitName) : null);
          var bodyEl = h.querySelector('#kmUnitArchBody');
          flushVisibleEdits(sheet, bodyEl);
          saveSheet(c.unitId, sheet, c.unitName);
        });
      }

      renderSheetOnly(h.querySelector('#kmUnitArchSheetHost'), ctx);
      try {
        var mh = h.querySelector('#kmUnitArchManningHost');
        if (mh) {
          var st = (typeof window.kmUnitManningStats === 'function' ? window.kmUnitManningStats(window._kmUnitArchiveActiveUnitId) : window.kmManningStatsFromFormalSheet(window._kmUnitArchiveActiveSheet));
          mh.innerHTML = '<div class="kmManningPct" style="margin:8px 0 12px;padding:10px 12px;border-radius:10px;background:#eef6f1;border:1px solid #cfe3d7;font-size:14px">' +
            '<b>Համալրվածություն՝ ' + st.percent + '%</b>' +
            ' <span class="muted">(' + st.filled + ' / ' + st.authorized + ' հաստիք · ' + (st.vacant != null ? st.vacant : Math.max(0,st.authorized-st.filled)) + ' թափուր)</span></div>';
        }
      } catch (eMan) {}
      if (typeof window.kmApplyRoleGuard === 'function') window.kmApplyRoleGuard();
    }

    render();
  };




  window.kmAccountingCardsHtml = function () {
    var card = typeof window.kmUiLawCard === 'function' ? window.kmUiLawCard : null;
    if (!card) return '';
    var items = [
      ['Անձնակազմ և Պաշտոն', "kmRememberAndOpen({kind:'page',value:'people'},()=>kmOpenPage('people'))", '👥'],
      ['Արձակուրդ', "kmRememberAndOpen({kind:'vacations',value:''},()=>openVacations())", '🏖'],
      ['Անձնակազմի հաշվառում', "kmRememberAndOpen({kind:'page',value:'troopStructure'},()=>kmOpenPage('troopStructure'))", '🏛'],
      [PAGES.unitFormation, "kmRememberAndOpen({kind:'page',value:'unitFormation'},()=>kmOpenPage('unitFormation'))", '📋'],
      [PAGES.unitMedical, "kmRememberAndOpen({kind:'page',value:'unitMedical'},()=>kmOpenPage('unitMedical'))", '🩺'],
      [PAGES.unitTermWatch, "kmRememberAndOpen({kind:'page',value:'unitTermWatch'},()=>kmOpenPage('unitTermWatch'))", '⏱'],
      [PAGES.unitLeavePlan, "kmRememberAndOpen({kind:'page',value:'unitLeavePlan'},()=>kmOpenPage('unitLeavePlan'))", '📅'],
            /* KM_INV_UNDER_ACCOUNTING_V1 */
      [PAGES.unitInventory, "kmRememberAndOpen({kind:'page',value:'unitInventory'},()=>kmOpenPage('unitInventory'))", '📦'],
      /* KM_HAMALR_MOVE_V1 */
      [PAGES.unitHamalr, "kmRememberAndOpen({kind:'page',value:'unitHamalr'},()=>{(typeof kmUnitOpen==='function'?kmUnitOpen:window.kmUnitOpen)('unitHamalr')})", '📊'],
      /* KM_RESERVE_CARD_IN_ACCOUNTING_V1 */
      [PAGES.unitReserve || 'Պահեստազոր', "kmRememberAndOpen({kind:'page',value:'unitReserve'},()=>{(typeof kmUnitOpen==='function'?kmUnitOpen:window.kmUnitOpen)('unitReserve')})", '🏛'], /* KM_RESERVE_ROUTE_VIA_UNITOPEN_V1 */
      /* KM_MENU_REORG_V1: moved from Աշխատանքային գործիքներ */
      ['Կոչումների կանոններ', "kmRememberAndOpen({kind:'page',value:'rankRules'},()=>kmOpenPage('rankRules'))", '⭐']
    ];
    var admin = (typeof window.kmCanAdmin === 'function' && window.kmCanAdmin()) ||
      (typeof window.kmIsSuperAdmin === 'function' && window.kmIsSuperAdmin());
    /* KM_UNIT_ARCHIVE_CARD_GRANT_OR_SUPER_V1 */
    var showUnitArch = (typeof window.kmIsSuperAdmin === 'function' && window.kmIsSuperAdmin()) || window.kmSuperAdmin === true;
    try { if (!showUnitArch && sessionStorage.getItem('km_auth_super') === '1') showUnitArch = true; } catch (eSup) {}
    try { if (!showUnitArch && typeof window.kmCanAccessPage === 'function' && window.kmCanAccessPage('unitArchive')) showUnitArch = true; } catch (eG) {}
    if (showUnitArch) {
      items.push([PAGES.unitArchive, "kmRememberAndOpen({kind:'page',value:'unitArchive'},()=>kmOpenPage('unitArchive'))", '🗄']);
    }
    if (admin) {
      items.push(
        ['Բանակային կորպուսներ', "kmRememberAndOpen({kind:'page',value:'orgCorps'},()=>kmOpenPage('orgCorps'))", '🏛']
      );
    }
    return items.map(function (it) { return card(it[0], it[1], it[2]); }).join('');
  };

  
  /* KM_MANNING_PERCENT_V1 / KM_SYSTEM_WIDE_V1 */
  window.kmUnitManningStats = function (unitId) { /* KM_MANNING_REAL_PER_UNIT_V1 */
    try {
      var uid = unitId;
      if (uid == null || String(uid).trim() === '') {
        try {
          var ctx = typeof window.kmGetOrgContext === 'function' ? window.kmGetOrgContext() : null;
          uid = (ctx && ctx.unitId) || window._kmArchiveForUnitId || window._kmUnitArchiveActiveUnitId || '';
        } catch (eCtx) {
          uid = window._kmArchiveForUnitId || window._kmUnitArchiveActiveUnitId || '';
        }
      }
      uid = String(uid || '').trim();
      var sheet = null;
      // Prefer the formal archive for THIS unit only — never another unit's sheet
      if (typeof db !== 'undefined' && db && db.unitFormalArchives && uid) {
        sheet = db.unitFormalArchives[uid] || null;
        // alias only for 25836 itself
        if (!sheet && ((window.kmIsHtmlV7UnitId && window.kmIsHtmlV7UnitId(uid)) || /25836/.test(uid))) {
          sheet = db.unitFormalArchives.bk2_u1 || db.unitFormalArchives['25836'] || null;
        }
      }
      if (!sheet && window._kmUnitArchiveActiveSheet && String(window._kmUnitArchiveActiveUnitId || '') === uid) {
        sheet = window._kmUnitArchiveActiveSheet;
      }
      /* KM_MANNING_PER_UNIT_V2: reject 25836 HTML sheet when asking another unit */
      if (sheet && sheet.rows && uid && !(/25836/.test(uid) || (window.kmIsHtmlV7UnitId && window.kmIsHtmlV7UnitId(uid)))) {
        var srcM = String(sheet.source || '');
        if (sheet.preserve25836 || sheet.forceHtmlV7 || srcM.indexOf('HTML_V7') >= 0 || srcM.indexOf('html-25836') >= 0 || String(sheet.unitId || '') === 'bk2_u1') {
          sheet = null;
        }
      }
      if (sheet && Array.isArray(sheet.rows) && sheet.rows.length) {
        var st = window.kmManningStatsFromFormalSheet(sheet);
        st.unitId = uid;
        return st;
      }
    } catch (eSheet) {}
    var authorized = 0, filled = 0;
    try {
      var list = [];
      if (window.kmUnitArchiveStaffSource && typeof window.kmUnitArchiveStaffSource.posts === 'function') {
        list = window.kmUnitArchiveStaffSource.posts(unitId) || [];
      }
      var seen = Object.create(null);
      (list || []).forEach(function (r) {
        if (!r || r.type === 'section') return;
        if (!(r.position || r.code)) return;
        var k = [String(r.unit || '').trim(), String(r.position || '').trim(), String(r.code || '').trim()].join('|').toLowerCase();
        if (seen[k]) return;
        seen[k] = 1;
        authorized++;
        var n = String(r.sourceName || r.name || r.personName || '').trim();
        if (n && (!(typeof window.kmLooksLikePersonName === 'function') || window.kmLooksLikePersonName(n))) filled++;
      });
    } catch (e0) {}
    var vacant = Math.max(0, authorized - filled);
    var pct = authorized > 0 ? Math.round((filled / authorized) * 1000) / 10 : 0;
    return { authorized: authorized, filled: filled, vacant: vacant, percent: pct, unitId: String(unitId || '') };
  };
  window.kmUnitManningPercentHtml = function (unitId) {
    var s = window.kmUnitManningStats(unitId);
    return '<div class="kmManningPct" style="margin:8px 0 12px;padding:10px 12px;border-radius:10px;background:#eef6f1;border:1px solid #cfe3d7;font-size:14px">' +
      '<b>Համալրվածություն՝ ' + s.percent + '%</b>' +
      ' <span class="muted">(' + s.filled + ' / ' + s.authorized + ' հաստիք · ' + (s.vacant != null ? s.vacant : Math.max(0,(s.authorized||0)-(s.filled||0))) + ' թափուր)</span></div>'; /* KM_MANNING_REAL_PER_UNIT_V1_HTML */
  };

window.kmRenderAccountingHub = function () {
    window.kmUnitEnsureStores();
    injectCss();
    /* KM_UI_UNFREEZE_V1: paint cards now; load positions.js after first frame (sub-pages apply archives) */
    if (typeof window.kmApplyArchivesToAccounting !== 'function' &&
        typeof window.kmLoadPageModules === 'function' && !window.kmRenderAccountingHub._archWait) {
      window.kmRenderAccountingHub._archWait = true;
      var laterPos = function () {
        window.kmLoadPageModules('positions', function () {
          window.kmRenderAccountingHub._archWait = false;
        });
      };
      if (typeof requestIdleCallback === 'function') requestIdleCallback(laterPos, { timeout: 2500 });
      else setTimeout(laterPos, 80);
    }
    /* KM_ADMIN_ACCOUNTING_ORG_VIEW_V1 */
    var adminAccView = typeof window.kmAdminCanAccountingOrgView === 'function' && window.kmAdminCanAccountingOrgView();
    if (adminAccView && typeof window.kmRestoreAdminAccountingOrgView === 'function') {
      try { window.kmRestoreAdminAccountingOrgView(); } catch (eRv) {}
    }
    var orgCtx = typeof window.kmGetOrgContext === 'function' ? window.kmGetOrgContext() : null;
    var hasUnit = !!(orgCtx && orgCtx.corpsId && orgCtx.unitId);
    /* KM_ADMIN_HOME_ORG_PICK_V1: picker moved to landing brand; not shown here */
    var needPickNote = '';
    if (adminAccView && !hasUnit) {
      needPickNote =
        '<div class="kmUtAlert" style="margin:0 0 12px">Ադմինիստրատոր՝ նախ գլխավոր էկրանի ձախ կողմում ընտրեք բանակային կորպուսը և զորամասը։</div>';
    }
    var h = host();
    if (!h) return;
    try { if (h && h.setAttribute) h.setAttribute('data-km-no-page-back', '1'); } catch (eNb) {} /* KM_UI9_NO_ACCT_BACK_V1 */
    h.innerHTML =
      '<div class="card kmUtShell" data-km-accounting-hub="1">' +
        '<div class="kmUtBar">' +
          '<div><h3 style="margin:0">Հաշվառում</h3>' +
          '<div class="kmUtMuted">Անձնակազմը գալիս է միայն <b style="color:#c62828">Զորամասի Արխիվ</b>-ից · Excel ներմուծումը հեռացված է · Անձնակազմ և Պաշտոն, Անձնակազմի հաշվառում, Բուժկետ/Մուշկետ, Արձակուրդների հերթափոխ, գույք</div></div>' +
          /* KM_UI9_NO_ACCT_BACK_V1: no ← Վերադարձ on top hub */
        '</div>' +
        needPickNote +
        '<div id="kmAccAlerts"></div>' +
        '<div class="kmLawsGrid" data-km-cards="1">' + window.kmAccountingCardsHtml() + '</div>' +
      '</div>';
    try { h.querySelectorAll('.kmBackBtn,.kmBackToolbar').forEach(function (el) { el.remove(); }); } catch (eStrip) {}
    if (typeof window.kmFilterGrantCards === 'function') {
      try { window.kmFilterGrantCards(h); } catch (eG) {}
    }
    if (typeof window.kmApplyRoleGuard === 'function') window.kmApplyRoleGuard();
    var box = h.querySelector('#kmAccAlerts');
    var fillAlerts = function () {
      if (!box || !box.isConnected) return;
      var html = '';
      try { html = window.kmUnitHomeAlertsHtml() || ''; } catch (eA) {}
      if (html) box.outerHTML = html;
    };
    var paint = function () {
      fillAlerts();
      try {
        if (typeof window.kmScanOfficerRankTerms === 'function') {
          window.kmScanOfficerRankTerms();
          var box2 = h.querySelector('#kmAccAlerts') || h.querySelector('.kmUtHomeAlerts');
          if (box2) {
            box = box2.id === 'kmAccAlerts' ? box2 : null;
            if (box) fillAlerts();
          }
        }
      } catch (eScan) {}
    };
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(function () { setTimeout(paint, 0); });
    } else {
      setTimeout(paint, 0);
    }
  };

  window.kmUnitHomeCardsHtml = function () {
    var card = typeof window.kmUiLawCard === 'function' ? window.kmUiLawCard : null;
    if (!card) return '';
    var order = [
      ['unitDocs', '✍'], ['unitCharDrafts', '📄'],
      ['unitFuel', '⛽'], ['unitDayPlans', '🗒'],
      ['unitBlanks', '📁']
    ];
    var html = order.map(function (pair) {
      var key = pair[0];
      return card(PAGES[key], "kmRememberAndOpen({kind:'page',value:'" + key + "'},()=>kmOpenPage('" + key + "'))", pair[1]);
    }).join('');
    /* KM_MENU15_V1: unitBadDays / freePeople -> Վերակարգի գործիքներ; USB / docsPack from deleted reports hub */
    html += card(
      'USB',
      "typeof kmOpenUsbHub==='function'?kmOpenUsbHub():kmHomeReportsOpen('usb')",
      '💾'
    );
    html += card(
      'Փաստաթղթերի փաթեթ',
      "kmRememberAndOpen({kind:'page',value:'docsPack'},()=>kmOpenDocsPack())",
      '📦'
    );
    html += card(
      'Հրամանի նախագիծ',
      "kmRememberAndOpen({kind:'page',value:'orderDraft'},()=>kmOpenPage('orderDraft'))",
      '✍'
    );
    if (typeof window.kmTrialHomeCardHtml === 'function') html += window.kmTrialHomeCardHtml();
    return html;
  };

  window.kmRenderUnitToolsHub = function () {
    window.kmUnitEnsureStores();
    injectCss();
    var h = host();
    if (!h) return;
    var __kmToolsViewer = window.kmUserRole === 'viewer'; /* KM_MENU_REORG_V1 */
    h.innerHTML =
      '<div class="card kmUtShell">' +
        '<div class="kmUtBar">' +
          '<div><h3 style="margin:0">Աշխատանքային գործիքներ</h3>' + /* KM_MENU_REORG_V1 */
          '<div class="kmUtMuted">Փաստաթղթեր, բնութագիր, ՎՔՆ, կարգացուցակ, ձևաթղթեր, USB, փաստաթղթերի փաթեթ, փորձաշրջան, նշումներ, ֆայլեր և այլ գործիքներ</div></div>' + /* KM_MENU15_V1 */
          '<div class="kmUtActions"><button type="button" class="kmBackBtn" onclick="kmReportsBack()">' + ((typeof window.KM_BACK_LABEL === 'string' && window.KM_BACK_LABEL) || '← Վերադարձ') + '</button></div>' +
        '</div>' +
        (window.kmUnitHomeAlertsHtml() || '') +
        (__kmToolsViewer ? '' : /* KM_MENU_REORG_V1: viewers never had the tool cards (menu was admin-only); they keep only the moved library cards */
        '<div class="kmLawsGrid" data-km-cards="1" data-km-unit-tools="1">' +
          (typeof window.kmUnitHomeCardsHtml === 'function' ? window.kmUnitHomeCardsHtml() : '') +
        '</div>') +
        /* KM_MENU_REORG_V1: former Գրադարան sections (same cards/size, separate row so kmFillUnitToolsSlots never overwrites them) */
        '<div class="kmLawsGrid" data-km-cards="1" data-km-tools-lib-grid="1" id="kmToolsLibSections" style="margin-top:10px">' +
          (typeof window.kmToolsLibCardsHtml === 'function' ? window.kmToolsLibCardsHtml() : '') +
        '</div>' +
      '</div>';
    try { if (typeof window.kmToolsSetNav === 'function') window.kmToolsSetNav(); } catch (eNv) {}
    if (typeof window.kmFilterGrantCards === 'function') {
      try { window.kmFilterGrantCards(h); } catch (eG) {}
    }
    if (typeof window.kmApplyRoleGuard === 'function') window.kmApplyRoleGuard();
  };

  function fillUnitToolsSlots() {
    try {
      var cards = typeof window.kmUnitHomeCardsHtml === 'function' ? window.kmUnitHomeCardsHtml() : '';
      if (!cards) return;
      document.querySelectorAll('[data-km-unit-tools="1"]').forEach(function (slot) {
        slot.innerHTML = cards;
      });
      if (typeof window.kmApplyRoleGuard === 'function') window.kmApplyRoleGuard();
    } catch (e) {
      console.warn('km-unit-tools fill slots', e);
    }
  }
  window.kmFillUnitToolsSlots = fillUnitToolsSlots;

  function patchHome() {
    if (window._kmUnitHomePatched) return;
    window._kmUnitHomePatched = true;
    var prev = window.home;
    if (typeof prev !== 'function') return;
    window.home = function () {
      prev.apply(this, arguments);
      fillUnitToolsSlots();
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchHome);
  } else {
    patchHome();
  }

  /* KM_ARCHIVE_IDENTITY_SYNC_V1 */
  window.kmSyncArchiveSheetIdentities = function (sheet) {
    try {
      if (!sheet || !Array.isArray(sheet.rows) || !window.kmPersonnelSyncBus) return 0;
      var headers = sheet.headers || [];
      var iName = -1, iCode = -1, iPost = -1;
      for (var h = 0; h < headers.length; h++) {
        var lab = String(headers[h] || '');
        if (iName < 0 && /Ա\s*[\.․]?\s*Ա\s*[\.․]?\s*Հ/i.test(lab)) iName = h;
        if (iCode < 0 && /(հաստիք|կոդ|code)/i.test(lab)) iCode = h;
        if (iPost < 0 && /պաշտոն/i.test(lab)) iPost = h;
      }
      if (iName < 0) iName = 8;
      if (iCode < 0) iCode = 3;
      var n = 0;
      sheet.rows.forEach(function (r) {
        if (!r || (r.type && r.type !== 'data' && r.type !== 'entry')) return;
        if (typeof isDuplicateHeaderRow === 'function' && isDuplicateHeaderRow(r)) return;
        var cells = r.cells || [];
        var name = String(cells[iName] || '').trim();
        if (!name || name.length < 3) return;
        window.kmPersonnelSyncBus.syncIdentityFromRow({
          name: name,
          code: iCode >= 0 ? cells[iCode] : '',
          position: iPost >= 0 ? cells[iPost] : '',
          unit: sheet.unitId || sheet.unitName || ''
        });
        n++;
      });
      return n;
    } catch (e) { return 0; }
  };

})();


/* KM_UNIT_ARCHIVE_25836_HTML_V7_REASSERT */
(function(){
  function kmForce25836V7(){
    try{
      if (typeof window.kmEnsureHtmlV7UnitArchive === 'function') window.kmEnsureHtmlV7UnitArchive();
      else if (window.kmUnitArchiveStaffSource && typeof window.kmUnitArchiveStaffSource.ensure === 'function')
        window.kmUnitArchiveStaffSource.ensure('bk2_u1');
    }catch(e){}
  }
  function arm(){
    try{ kmForce25836V7(); }catch(e0){}
    setTimeout(kmForce25836V7, 1500);
    setTimeout(kmForce25836V7, 4000);
    setTimeout(kmForce25836V7, 8000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arm);
  else arm();
})();

/* === KM_RESERVE_ARCHIVE_V1 helpers === */
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
    var ln = String(opts.lastName || opts.azganun || '').trim().toLowerCase();
    var fn = String(opts.firstName || opts.anun || '').trim().toLowerCase();
    var pn = String(opts.patronymic || opts.hayranun || '').trim().toLowerCase();
    var free = String(opts.q || opts.text || '').trim().toLowerCase();
    var uid = String(opts.unitId || '').trim();
    function hit(e) {
      if (!e) return false;
      if (uid && String(e.unitId || '') !== uid) return false;
      var last = String(e.lastName || '').toLowerCase();
      var first = String(e.firstName || '').toLowerCase();
      var pat = String(e.patronymic || '').toLowerCase();
      var full = String(e.name || (last + ' ' + first + ' ' + pat)).toLowerCase();
      if (ln && last.indexOf(ln) < 0 && full.indexOf(ln) < 0) return false;
      if (fn && first.indexOf(fn) < 0 && full.indexOf(fn) < 0) return false;
      if (pn && pat.indexOf(pn) < 0 && full.indexOf(pn) < 0) return false;
      if (free) {
        var blob = [e.name, e.lastName, e.firstName, e.patronymic, e.rank, e.post, e.code, e.vus].join(' ').toLowerCase();
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
/* === /KM_RESERVE_ARCHIVE_V1 helpers === */
/* === KM_RESERVE_ARCHIVE_V1 unitReserve page === */
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
  window.kmRenderUnitReserve = window.kmRenderUnitReserve = function /* KM_RESERVE_RENDER_ALIAS_V1 */ (root) {
    try { if (typeof window.kmReserveArchiveEnsure === 'function') window.kmReserveArchiveEnsure(); } catch (e0) {}
    var host = root || document.getElementById('content') || document.getElementById('page') || document.body;
    var html = '' +
      '<div class="card" id="kmUnitReservePage">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:10px">' +
      '<div><div class="title" style="margin:0">Պահեստազոր</div>' +
      '<div class="muted" style="margin-top:4px">պահեստազորային արխիվ · որոնում ըստ ԱԱՀ</div></div>' +
      '<button type="button" class="kmBackBtn" onclick="(window.kmBackToPage||window.kmOpenPage)(\'accounting\')" data-km-back="KM_BACK_AUDIT_V1">← Վերադարձ</button></div>' +
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
/* === /KM_RESERVE_ARCHIVE_V1 unitReserve page === */


/* KM_OPENPAGE_UNITRESERVE_HOOK_V2 */
(function () {
  function install() {
    if (typeof window.kmOpenPage !== 'function') return false;
    if (window.kmOpenPage.__kmUnitReserveHook) return true;
    var orig = window.kmOpenPage;
    var wrapped = function (page) {
      var id = String(page || '');
      /* KM_OPENPAGE_UNITRESERVE_HOOK_V2: only unitReserve — unitArchive uses kmRenderUnitArchivePage via kmOpenPage */
      if (id === 'unitReserve' || id === 'unitHamalr' /* KM_HAMALR_MOVE_V1 */) {
        if (typeof window.kmUnitOpen === 'function') {
          try { return window.kmUnitOpen(id); } catch (eU) { console.warn(eU); }
        }
      }
      return orig.apply(this, arguments);
    };
    wrapped.__kmUnitReserveHook = true;
    try { wrapped.toString = function () { return orig.toString(); }; } catch (eT) {}
    window.kmOpenPage = wrapped;
    return true;
  }
  if (!install()) {
    var n = 0;
    var t = setInterval(function () {
      if (install() || ++n > 40) clearInterval(t);
    }, 250);
  }
})();

