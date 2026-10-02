/* KM_ACCOUNTING_ARCHIVE_SOURCES_V2_OPS */
/* KM ops UI: today board, substitutions, comments, units, audit, posts, sync apply */
(function () {
  'use strict';

/* KM_DUTY_FROM_ARCHIVE_ONLY_V1 / KM_SYSTEM_WIDE_V1 — REMOVED (KM_DUTY_ARCHIVE_ONLY_V1_FIX).
   This used to override window.kmDutySelectedPeople with a version that ignored its `sch`
   argument entirely and simply returned the full archive/roster for EVERY duty type — that is
   why every duty-planning graph showed the whole unit's personnel no matter what was actually
   selected and saved. The correct implementation (filters by sch.selectedPeople, resolves each
   name only against db.unitFormalArchives) is now defined once in index.html
   (window.kmDutyArchivePersonnel / window.kmDutySelectedPeople) and is left alone here so this
   file, which loads after it, does not shadow it again. */

  function L() { return window.kmOpsLogic || {}; }
  function esc(s) {
    return typeof window.esc === 'function'
      ? window.esc(s)
      : String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
      });
  }
  function toast(msg, type) {
    if (typeof window.kmNotify === 'function') window.kmNotify(msg, type || 'ok');
    else if (typeof window.toast === 'function') window.toast(msg);
  }
  function canEdit() {
    return typeof window.kmCanEdit !== 'function' || window.kmCanEdit();
  }
  function audit(action, detail) {
    try {
      if (window.kmNative && window.kmNative.audit) {
        var who = typeof window.kmActorStamp === 'function' ? window.kmActorStamp() : {};
        var rec = {
          action: action,
          detail: String(detail || ''),
          role: who.role || window.kmUserRole || '',
          user: who.user || '',
          fullName: who.fullName || '',
          userId: who.userId || ''
        };
        window.kmNative.audit.append(rec);
        try {
          if (window.kmNative.lanSync && typeof window.kmNative.lanSync.pushHubAudit === 'function') {
            window.kmNative.lanSync.pushHubAudit(rec);
          }
        } catch (eP) {}
      }
    } catch (e) {}
  }

  function ensureOpsDb() {
    if (typeof db === 'undefined' || !db) return;
    if (!Array.isArray(db.units)) db.units = [];
    if (!db.cellComments || typeof db.cellComments !== 'object') db.cellComments = {};
    if (!Array.isArray(db.substitutions)) db.substitutions = [];
    if (!Array.isArray(db.dutyPosts)) db.dutyPosts = [];
    db.people = db.people || [];
    const types = db.dutyTypes || [];
    while (db.dutyPosts.length < types.length) db.dutyPosts.push({});
    if (db.dutyPosts.length > types.length) db.dutyPosts.length = types.length;
    const fromPeople = {};
    db.people.forEach(function (p) {
      const u = String(p && p.unit || '').trim();
      if (u) fromPeople[u] = 1;
    });
    Object.keys(fromPeople).forEach(function (u) {
      if (!db.units.some(function (x) { return String(x.name || x) === u; })) {
        db.units.push({ name: u });
      }
    });
  }

  window.kmApplyDbSnapshot = function (data, opts) {
    opts = opts || {};
    /* KM_GUARD_EMPTY_SNAPSHOT_APPLY */
    if (!data || typeof data !== 'object') throw new Error('Սխալ ֆայլ');
    var _keys = Object.keys(data||{});
    if (!_keys.length || (_keys.length<=2 && !data.people && !data.schedule && !data.kmCorpsData && !data.dutyTypes)) {
      throw new Error('Դատարկ բազա՝ սինքը մերժվեց');
    }
    if (typeof db === 'undefined' || !db) throw new Error('Բազան բեռնված չէ');
    const incomingAt = Date.parse(data.kmSavedAt || '') || 0;
    const localAt = Date.parse(db.kmSavedAt || '') || 0;
    const merge = opts.merge !== false; // default merge for network; USB can pass merge:false for full replace
    if (incomingAt && localAt && incomingAt < localAt) {
      if (merge) return false;
      if (!opts.force) {
        if (!confirm('Ստացված բազան ավելի հին է (' + (data.kmSavedAt || '') + '), քան ներկան (' + db.kmSavedAt + ')։ Փոխարինե՞լ։')) return false;
      }
    }

    const role = opts.role || window.kmUserRole || 'viewer';
    const protect = typeof window.kmSyncProtectedKeys === 'function' ? window.kmSyncProtectedKeys(role) : {};
    const shareKeys = typeof window.kmSyncShareKeys === 'function' ? window.kmSyncShareKeys() : null;

    if (!merge) {
      Object.keys(db).forEach(function (k) {
        if (protect[k]) return;
        delete db[k];
      });
      Object.keys(data).forEach(function (k) {
        if (protect[k]) return;
        db[k] = data[k];
      });
    } else {
      const keys = shareKeys && shareKeys.length
        ? shareKeys.filter(function (k) { return Object.prototype.hasOwnProperty.call(data, k); })
        : Object.keys(data);
      const incomingCorps = String(data._kmCorpsId || '');
      const localCorps = typeof window.kmActiveCorpsSliceId === 'function' ? String(window.kmActiveCorpsSliceId() || '') : '';
      const skipWorking = !!(incomingCorps && incomingCorps !== localCorps);
      const workingSkip = {
        people: 1, schedule: 1, userPositions: 1, positionAssignments: 1, positionArchives: 1, peopleRemoved: 1,
        vacations: 1, tables: 1, spreadsheets: 1, registrations: 1, notebookNotes: 1, archives: 1,
        futureSchedules: 1, dutyTypes: 1, dutyTypeSchedules: 1, dutyPosts: 1,
        units: 1, cellComments: 1, substitutions: 1, dutyRankRules: 1, dutyGraphTemplates: 1, scheduleTemplates: 1,
        printPresets: 1, orderDraft: 1, troopStructure: 1,
        disciplinePenalties: 1, disciplinePenaltiesArchive: 1, personCharacteristics: 1,
        personEncouragements: 1, monthSummaries: 1,
        unitDocs: 1, unitInventory: 1, unitInventoryServices: 1, unitCharDrafts: 1, unitFuel: 1, unitDayPlans: 1, unitMedical: 1,
        unitLeavePlan: 1, unitBlanks: 1, unitDossiers: 1, unitFormation: 1, unitTermWatch: 1,
        trialExamDrafts: 1, trialCharDrafts: 1, trialMonitorDismissed: 1
      };
      keys.forEach(function (k) {
        if (protect[k]) return;
        if (k === 'kmCorpsData' && data.kmCorpsData && typeof data.kmCorpsData === 'object' && !Array.isArray(data.kmCorpsData)) {
          /* KM_HUB_GRAPH_PERSIST_V1: always store every incoming unit slice; empty cannot wipe non-empty */
          var incomingSlices = data.kmCorpsData;
          db.kmCorpsData = db.kmCorpsData || {};
          Object.keys(incomingSlices).forEach(function (sid) {
            if (!sid) return;
            var prev = db.kmCorpsData[sid];
            var next = incomingSlices[sid];
            if (!next || typeof next !== 'object') { if (next) db.kmCorpsData[sid] = next; return; }
            if (!prev || typeof prev !== 'object') { db.kmCorpsData[sid] = next; return; }
            var out = Object.assign({}, prev);
            Object.keys(next).forEach(function (ck) {
              var a = prev[ck], b = next[ck];
              function empty(v) {
                if (v == null) return true;
                if (Array.isArray(v)) return !v.length;
                if (typeof v === 'object') return !Object.keys(v).length;
                return false;
              }
              /* KM_HUB_ALL_PERSIST_V1: protect all user keys from empty wipe */
              if (empty(b) && !empty(a) && /^(dutyTypes|dutyTypeSchedules|dutyPosts|schedule|positionArchives|people|peopleRemoved|futureSchedules|dutyGraphTemplates|scheduleTemplates|userPositions|positionAssignments|vacations|tables|spreadsheets|registrations|notebookNotes|archives|units|cellComments|substitutions|disciplinePenalties|disciplinePenaltiesArchive|personCharacteristics|personEncouragements|monthSummaries|unitDocs|unitInventory|unitInventoryServices|unitCharDrafts|unitFuel|unitDayPlans|unitMedical|unitLeavePlan|unitBlanks|unitDossiers|unitFormation|unitTermWatch|trialExamDrafts|trialCharDrafts|troopStructure|printPresets|orderDraft|unitFormalArchives)$/.test(ck)) {
                out[ck] = a; return;
              }
              if (ck === 'people' && Array.isArray(a) && Array.isArray(b)) {
                var removed = Object.assign({}, (prev && prev.peopleRemoved) || {}, (next && next.peopleRemoved) || {});
                var by = {};
                a.forEach(function (p, i) { var k = String((p && (p.id || p.name)) || ('a' + i)); by[k] = p; });
                b.forEach(function (p, i) {
                  if (!p) return;
                  var k = String(p.id || p.name || ('b' + i));
                  var nk = String((p && p.name) || '').trim().toLowerCase();
                  if (nk && removed[nk] && !by[k]) return;
                  by[k] = by[k] ? Object.assign({}, by[k], p) : p;
                });
                Object.keys(removed).forEach(function (rk) {
                  Object.keys(by).forEach(function (bk) {
                    var pn = String((by[bk] && by[bk].name) || '').trim().toLowerCase();
                    if (pn === rk && !a.some(function (p) { return p && String(p.name || '').trim().toLowerCase() === rk; })) delete by[bk];
                  });
                });
                out[ck] = Object.keys(by).map(function (k) { return by[k]; });
                return;
              }
              if (ck === 'positionAssignments' && a && b && typeof a === 'object' && typeof b === 'object') {
                var asgOut = Object.assign({}, a);
                Object.keys(b).forEach(function (pid) {
                  var pa = a[pid], pb = b[pid];
                  if (!pb) return;
                  if (!pa) { asgOut[pid] = pb; return; }
                  var ta = Date.parse(pa.updatedAt || pa.clearedAt || '') || 0;
                  var tb = Date.parse(pb.updatedAt || pb.clearedAt || '') || 0;
                  if ((pa.vacant || pa.manual || pa.userEdited) && ta >= tb) asgOut[pid] = pa;
                  else if ((pb.vacant || pb.manual || pb.userEdited) && tb >= ta) asgOut[pid] = pb;
                  else asgOut[pid] = tb >= ta ? Object.assign({}, pa, pb) : Object.assign({}, pb, pa);
                });
                out[ck] = asgOut;
                return;
              }
              if (ck === 'peopleRemoved' && a && b && typeof a === 'object' && typeof b === 'object') {
                out[ck] = Object.assign({}, a, b);
                return;
              }
              if (ck === 'unitDossiers' && a && b && typeof a === 'object' && typeof b === 'object') {
                out[ck] = Object.assign({}, a, b);
                Object.keys(a).forEach(function (nk) { if (empty(b[nk]) && !empty(a[nk])) out[ck][nk] = a[nk]; });
                return;
              }
              if (ck === 'schedule' && a && b && typeof a === 'object' && typeof b === 'object') {
                out[ck] = Object.assign({}, a, b);
                if (empty(b.formalGraph) && !empty(a.formalGraph)) out[ck].formalGraph = a.formalGraph;
                if (empty(b.rows) && !empty(a.rows)) out[ck].rows = a.rows;
                if (empty(b.selectedPeople) && !empty(a.selectedPeople)) out[ck].selectedPeople = a.selectedPeople;
                return;
              }
              if (ck === 'dutyTypeSchedules' && a && b && typeof a === 'object' && typeof b === 'object') {
                out[ck] = Object.assign({}, a, b);
                Object.keys(a).forEach(function (dk) {
                  if (empty(b[dk]) && !empty(a[dk])) out[ck][dk] = a[dk];
                });
                return;
              }
              out[ck] = b;
            });
            db.kmCorpsData[sid] = out;
          });
          return;
        }
        if (k === '_kmCorpsId') return;
        if (skipWorking && workingSkip[k]) return;
        if (k === 'unitFormalArchives') {
          /* KM_UNIT_ARCHIVE_HTML_V7_SSOT_V1 — never let LAN/client restore 2286 DEDUPE over HTML_V7 */
          var locArch = (db.unitFormalArchives && typeof db.unitFormalArchives === 'object' && !Array.isArray(db.unitFormalArchives))
            ? db.unitFormalArchives : {};
          var incArch = (data.unitFormalArchives && typeof data.unitFormalArchives === 'object' && !Array.isArray(data.unitFormalArchives))
            ? data.unitFormalArchives : {};
          var mergedArch = Object.assign({}, locArch, incArch);
          function pickHtmlV7(a, b) {
            var aLeg = (typeof window.kmSheetIsLegacyDedupe === 'function') ? window.kmSheetIsLegacyDedupe(a) : (!a || !a.rows || a.rows.length < 2500);
            var bLeg = (typeof window.kmSheetIsLegacyDedupe === 'function') ? window.kmSheetIsLegacyDedupe(b) : (!b || !b.rows || b.rows.length < 2500);
            if (!aLeg && a && a.rows && a.rows.length >= 2600) return a;
            if (!bLeg && b && b.rows && b.rows.length >= 2600) return b;
            var an = (a && a.rows && a.rows.length) || 0;
            var bn = (b && b.rows && b.rows.length) || 0;
            if (an >= 2600 && an >= bn) return a;
            if (bn >= 2600) return b;
            return an >= bn ? a : b;
          }
          var chosen = pickHtmlV7(locArch.bk2_u1 || locArch['25836'], incArch.bk2_u1 || incArch['25836']);
          if (chosen) mergedArch.bk2_u1 = chosen;
          db.unitFormalArchives = mergedArch;
          try {
            if (typeof window.kmEnsureHtmlV7UnitArchive === 'function') {
              window.kmEnsureHtmlV7UnitArchive({ noPersist: true });
            }
          } catch (eV7m) {}
          return;
        }
        if (k === 'peopleRemoved') {
          db.peopleRemoved = Object.assign({}, db.peopleRemoved || {}, data.peopleRemoved || {});
          return;
        }
        if (k === 'positionAssignments' && db.positionAssignments && data.positionAssignments) {
          var asgTop = Object.assign({}, db.positionAssignments);
          Object.keys(data.positionAssignments).forEach(function (pid) {
            var pa = db.positionAssignments[pid], pb = data.positionAssignments[pid];
            if (!pb) return;
            if (!pa) { asgTop[pid] = pb; return; }
            var ta = Date.parse(pa.updatedAt || pa.clearedAt || '') || 0;
            var tb = Date.parse(pb.updatedAt || pb.clearedAt || '') || 0;
            if ((pa.vacant || pa.manual || pa.userEdited) && ta >= tb) asgTop[pid] = pa;
            else if ((pb.vacant || pb.manual || pb.userEdited) && tb >= ta) asgTop[pid] = pb;
            else asgTop[pid] = tb >= ta ? Object.assign({}, pa, pb) : Object.assign({}, pb, pa);
          });
          db.positionAssignments = asgTop;
          return;
        }
        if (k === 'people' && Array.isArray(db.people) && Array.isArray(data.people)) {
          var rem = Object.assign({}, db.peopleRemoved || {}, data.peopleRemoved || {});
          var byP = {};
          db.people.forEach(function (p, i) { byP[String((p && (p.id || p.name)) || ('a' + i))] = p; });
          data.people.forEach(function (p, i) {
            if (!p) return;
            var pk = String(p.id || p.name || ('b' + i));
            var nk = String(p.name || '').trim().toLowerCase();
            if (nk && rem[nk] && !byP[pk]) return;
            byP[pk] = byP[pk] ? Object.assign({}, byP[pk], p) : p;
          });
          Object.keys(rem).forEach(function (rk) {
            Object.keys(byP).forEach(function (bk) {
              var pn = String((byP[bk] && byP[bk].name) || '').trim().toLowerCase();
              if (pn === rk && !(db.people || []).some(function (p) { return p && String(p.name || '').trim().toLowerCase() === rk; })) delete byP[bk];
            });
          });
          db.people = Object.keys(byP).map(function (x) { return byP[x]; });
          return;
        }
        db[k] = data[k];
      });
      try {
        if (typeof window.kmEnsureHtmlV7UnitArchive === 'function') {
          window.kmEnsureHtmlV7UnitArchive({ noPersist: true });
        }
      } catch (eV7end) {}
      if (localCorps && typeof window.kmApplyCorpsSlice === 'function' && db.kmCorpsData && db.kmCorpsData[localCorps]) {
        try { window.kmApplyCorpsSlice(localCorps); } catch (eSlice) {}
      }
    }
    try {
      if (typeof window.kmEnsureHtmlV7UnitArchive === 'function') {
        window.kmEnsureHtmlV7UnitArchive({ noPersist: true });
      }
    } catch (eV7fin) {}
    return true;
  };

  window.kmAllGraphs = function () {
    return (L().collectGraphs || function () { return []; })(typeof db !== 'undefined' ? db : {});
  };

  window.kmDetectConflicts = function () {
    const now = Date.now();
    if (window._kmConflictCache && now - window._kmConflictCache.t < 1200) return window._kmConflictCache.v;
    const logic = L();
    const v = (!logic.detectConflicts) ? [] : logic.detectConflicts(typeof db !== 'undefined' ? db : {}, {
      isBlocked: function (p) { return typeof kmPersonIsBlocked === 'function' && kmPersonIsBlocked(p); },
      absence: function (name, dt) {
        if (typeof kmPersonAbsence === 'function') return kmPersonAbsence(name, dt);
        if (typeof isPersonOnVacation === 'function' && isPersonOnVacation(name, dt)) return 'vacation';
        return null;
      }
    });
    window._kmConflictCache = { t: now, v: v };
    return v;
  };

  window.kmTodayDutyRows = function (dateObj) {
    const logic = L();
    if (!logic.todayDutyRows) return [];
    const data = typeof db !== 'undefined' ? db : {};
    const opts = {
      absence: function (name, dt) {
        if (typeof window.kmPersonAbsence === 'function') return window.kmPersonAbsence(name, dt);
        if (typeof window.isPersonOnVacation === 'function' && window.isPersonOnVacation(name, dt)) return 'vacation';
        return null;
      }
    };
    const dt = dateObj instanceof Date
      ? dateObj
      : (logic.dashboardAnchorDate ? logic.dashboardAnchorDate(data, new Date(), opts) : new Date());
    return logic.todayDutyRows(data, dt, opts);
  };

  /* ---- Home today board ---- */
  window.kmRenderTodayBoard = function () {
    try {
      if (typeof window.kmHomeOrgSelected === 'function' && !window.kmHomeOrgSelected()) {
        return '<div class="card kmHubCard" id="kmTodayBoard" data-km-home-gated="1">' +
          '<h3 style="margin-top:0">Այսօր</h3>' +
          '<p class="muted" style="margin:8px 0 0;line-height:1.5">Թվերն ու ցուցակները երևում են միայն <b>Հաշվառում</b> → <b>բանակային կորպուս</b> և <b>զորամաս</b> ընտրությունից հետո։</p>' +
          '<div class="toolbar" style="margin-top:12px">' +
            '<button type="button" class="primary" id="kmTodayOpenAccounting">Բացել Հաշվառում</button>' +
          '</div></div>';
      }
    } catch (eGateR) {}
    const rows = window.kmTodayDutyRows();
    const conflicts = typeof kmDetectConflicts === 'function' ? kmDetectConflicts() : [];
    const logic = L();
    const data = typeof db !== 'undefined' ? db : {};
    const boardDate = (logic.dashboardAnchorDate && logic.dashboardAnchorDate(data, new Date(), {
      absence: function (name, dt) {
        if (typeof window.kmPersonAbsence === 'function') return window.kmPersonAbsence(name, dt);
        if (typeof window.isPersonOnVacation === 'function' && window.isPersonOnVacation(name, dt)) return 'vacation';
        return null;
      }
    })) || new Date();
    const todayN = boardDate.getDate();
    const todayConflicts = conflicts.filter(function (c) { return +c.day === todayN; });
    const body = rows.map(function (r) {
      const tel = typeof kmTelHref === 'function' ? kmTelHref(r.phone) : '';
      const call = tel
        ? '<a class="kmCallBtn" href="' + esc(tel) + '">' + esc(r.phone) + '</a>'
        : esc(r.phone || '—');
      return '<tr><td>' + esc(r.graphName) + '</td><td>' + esc(r.rank) + '</td><td class="kmPersonIdentity">' + esc(r.name) +
        '</td><td>' + esc(r.unit) + '</td><td>' + call + '</td><td>' + esc(r.mark) + '</td></tr>';
    }).join('') || '<tr><td colspan="6" class="muted">Այսօր հերթապահ նշանակված չէ</td></tr>';
    const issue = todayConflicts.length
      ? '<ul style="margin:8px 0 0;padding-left:18px">' + todayConflicts.slice(0, 8).map(function (c) {
        return '<li>' + esc(c.msg) + '</li>';
      }).join('') + (todayConflicts.length > 8 ? '<li>… +' + (todayConflicts.length - 8) + '</li>' : '') + '</ul>'
      : '<p class="muted" style="margin:8px 0 0">Այսօր խնդիր չկա։ Ամսվա խնդիրներ՝ ' + conflicts.length + '։</p>';
    return '<div class="card kmHubCard" id="kmTodayBoard">' +
      '<h3 style="margin-top:0">Այսօր</h3>' +
      '<p class="muted">Բոլոր վերակարգերի գրաֆիկները · ' + esc(boardDate.toLocaleDateString('hy-AM')) + '</p>' +
      '<div class="toolbar"><button type="button" onclick="kmPrintTodayDuty()">Տպել այսօր</button>' +
      '<button type="button" onclick="kmOpenUnifiedSubstitutions()">Փոխանակում</button>' +
      (conflicts.length ? '<button type="button" onclick="analytics()">Խնդիրներ (' + conflicts.length + ')</button>' : '') +
      '</div>' +
      '<div class="gridwrap" style="margin-top:10px"><table class="grid"><thead><tr>' +
      '<th>Վերակարգ</th><th>Կոչում</th><th>Անձ</th><th>Ստորաբաժանում</th><th>Հեռախոս</th><th>Նշում</th>' +
      '</tr></thead><tbody>' + body + '</tbody></table></div>' + issue +
      '</div>';
  };

  function patchHomeToday() {
    const orig = window.home;
    if (typeof orig !== 'function' || orig.__kmTodayBoard) return;
    window.home = function () {
      orig.apply(this, arguments);
      const c = document.getElementById('content');
      if (!c) return;
      const old = c.querySelector('#kmTodayBoard');
      if (old) old.remove();
      const hub = c.querySelector('#kmHomeHub');
      /* KM_HOME_TODAY_ORG_GATE_V1 */
      var orgOkToday = false;
      try {
        if (typeof window.kmHomeOrgSelected === 'function') orgOkToday = !!window.kmHomeOrgSelected();
        else {
          var _oc = typeof window.kmGetOrgContext === 'function' ? window.kmGetOrgContext() : null;
          orgOkToday = !!(!_oc ? false : (String(_oc.corpsId || '').trim() && String(_oc.unitId || '').trim()));
        }
      } catch (eOrgT) { orgOkToday = false; }
      var html;
      if (!orgOkToday) {
        html = '<div class="card kmHubCard" id="kmTodayBoard" data-km-home-gated="1">' +
          '<h3 style="margin-top:0">Այսօր</h3>' +
          '<p class="muted" style="margin:8px 0 0;line-height:1.5">Թվերն ու ցուցակները երևում են միայն <b>Հաշվառում</b> → <b>բանակային կորպուս</b> և <b>զորամաս</b> ընտրությունից հետո։</p>' +
          '<div class="toolbar" style="margin-top:12px">' +
            '<button type="button" class="primary" id="kmTodayOpenAccounting">Բացել Հաշվառում</button>' +
          '</div></div>';
      } else {
        html = kmRenderTodayBoard();
      }
      if (hub) hub.insertAdjacentHTML('afterend', html);
      else c.insertAdjacentHTML('afterbegin', html);
      try {
        var btnAcc = c.querySelector('#kmTodayOpenAccounting');
        if (btnAcc) btnAcc.onclick = function () {
          if (typeof kmOpenPage === 'function') kmOpenPage('accounting');
        };
      } catch (eBind) {}
      if (typeof window.kmFinalizeHomeLayout === 'function') window.kmFinalizeHomeLayout();
    };
    window.home.__kmTodayBoard = true;
  }

  /* ---- Work status: single canonical UI ---- */
  window.openWorkStatus = function () {
    const rows = (typeof window.kmTodayDutyRows === 'function') ? (window.kmTodayDutyRows() || []) : [];
    const conflicts = typeof kmDetectConflicts === 'function' ? kmDetectConflicts() : [];
    const p = (db && Array.isArray(db.people)) ? db.people.length : 0;
    const rCount = (db && Array.isArray(db.registrations)) ? db.registrations.length : 0;
    const aCount = (db && Array.isArray(db.archives)) ? db.archives.length : 0;
    const dtypes = (db && Array.isArray(db.dutyTypes)) ? db.dutyTypes.length : 0;
    const sch = (db && db.schedule) || { month: new Date().getMonth() + 1, year: new Date().getFullYear(), name: '\u0540\u056b\u0574\u0576\u0561\u056f\u0561\u0576' };
    const days = new Date(+sch.year, +sch.month, 0).getDate() || 0;
    const old = document.getElementById('workStatusModal');
    if (old) old.remove();
    const body = rows.map(function (row) {
      return '<tr><td>' + esc(row.graphName) + '</td><td>' + esc(row.rank) + '</td><td class="kmPersonIdentity">' + esc(row.name) +
        '</td><td>' + esc(row.phone || '\u2014') + '</td></tr>';
    }).join('') || '<tr><td colspan="4">\u0531\u0575\u057d\u0585\u0580 \u0570\u0565\u0580\u0569\u0561\u057a\u0561\u0570 \u0579\u056f\u0561</td></tr>';
    const wrap = document.createElement('div');
    wrap.id = 'workStatusModal';
    wrap.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:99999;padding:20px';
    wrap.onclick = function (e) { if (e.target === wrap) wrap.remove(); };
    wrap.innerHTML = '<div style="background:#fff;width:min(860px,96vw);max-height:90vh;overflow:auto;border-radius:12px;padding:18px">' +
      '<h3>\u0531\u0577\u056d\u0561\u057f\u0561\u0576\u0584\u0561\u0575\u056b\u0576 \u057e\u056b\u0573\u0561\u056f</h3>' +
      '<div class="stat"><b>' + p + '</b><br><span class="muted">\u0531\u0576\u0571\u0576\u0561\u056f\u0561\u0566\u0574</span></div>' +
      '<div class="stat"><b>' + rCount + '</b><br><span class="muted">\u0533\u0580\u0561\u0576\u0581\u0578\u0582\u0574\u0576\u0565\u0580</span></div>' +
      '<div class="stat"><b>' + aCount + '</b><br><span class="muted">\u0531\u0580\u056d\u056b\u057e\u0576\u0565\u0580</span></div>' +
      '<div class="stat"><b>' + dtypes + '</b><br><span class="muted">\u054e\u0565\u0580\u0561\u056f\u0561\u0580\u0563\u0565\u0580</span></div>' +
      '<div class="stat"><b>' + rows.length + '</b><br><span class="muted">\u0531\u0575\u057d\u0585\u0580 \u0570\u0565\u0580\u0569\u0561\u057a\u0561\u0570</span></div>' +
      '<div class="stat"><b>' + conflicts.length + '</b><br><span class="muted">\u053d\u0576\u0564\u056b\u0580\u0576\u0565\u0580</span></div>' +
      '<div class="card" style="margin:14px 0 0">' +
        '<h3>\u0538\u0576\u0569\u0561\u0581\u056b\u056f \u0563\u0580\u0561\u0586\u056b\u056f</h3>' +
        '<p>\u0531\u0576\u057e\u0561\u0576\u0578\u0582\u0574\u055d <b>' + esc(sch.name || '\u0540\u056b\u0574\u0576\u0561\u056f\u0561\u0576') + '</b></p>' +
        '<p>\u0531\u0574\u056b\u057d\u055d <b>' + sch.month + '</b> / \u054f\u0561\u0580\u056b\u055d <b>' + sch.year + '</b> \u00b7 \u0555\u0580\u0565\u0580\u055d <b>' + days + '</b></p>' +
      '</div>' +
      '<div class="gridwrap" style="margin-top:12px"><table class="grid"><thead><tr><th>\u054e\u0565\u0580\u0561\u056f\u0561\u0580\u0563</th><th>\u053f\u0578\u0579\u0578\u0582\u0574</th><th>\u0531\u0576\u0571</th><th>\u0540\u0565\u057c\u0561\u056d\u0578\u057d</th></tr></thead><tbody>' +
      body + '</tbody></table></div>' +
      '<div style="text-align:right;margin-top:15px">' + (typeof window.kmModalBackHtml === 'function' ? window.kmModalBackHtml("document.getElementById('workStatusModal')?.remove()") : '<button type="button" onclick="document.getElementById(\'workStatusModal\').remove()">← Վերադարձ</button>') + '</div></div>';
    document.body.appendChild(wrap);
    if (typeof kmApplyLanguage === 'function') kmApplyLanguage();
  };
  window.openWorkStatus.__kmOpsCanonical = true;

  /* ---- Monthly report across graphs (does not overwrite page opener) ---- */
  window.kmPrintMonthlyReportAllGraphs = function () {
    const graphs = window.kmAllGraphs();
    const people = db.people || [];
    const s = db.schedule || {};
    const y = +s.year, m = +s.month, days = new Date(y, m, 0).getDate();
    const rows = people.map(function (p) {
      let duty = 0, vac = 0, sick = 0, trip = 0, study = 0;
      graphs.forEach(function (g) {
        if (+g.year !== y || +g.month !== m) return;
        for (let d = 1; d <= days; d++) {
          const v = (L().cellValue || function () { return ''; })(g.rows, p.name, d);
          if (L().occupied && L().occupied(v)) duty++;
        }
      });
      for (let d = 1; d <= days; d++) {
        const k = typeof kmPersonAbsence === 'function' ? kmPersonAbsence(p.name, new Date(y, m - 1, d, 12, 0, 0)) : null;
        if (k === 'sick') sick++;
        else if (k === 'trip') trip++;
        else if (k === 'study') study++;
        else if (k) vac++;
      }
      const rank = typeof kmRankText === 'function' ? kmRankText(p.rank) : (p.rank || '');
      return '<tr><td>' + esc(rank) + '</td><td>' + esc(p.name) + '</td><td>' + duty + '</td><td>' + vac +
        '</td><td>' + sick + '</td><td>' + trip + '</td><td>' + study + '</td></tr>';
    }).join('');
    const title = 'Ամսական հաշվետվություն — ' + m + '/' + y;
    const body = '<p class="meta">Բոլոր վերակարգերի գրաֆիկները</p><table><thead><tr><th>Կոչում</th><th>Անուն</th><th>Հերթապահ</th><th>Արձակուրդ</th><th>Հիվանդ</th><th>Գործուղում</th><th>Ուսում</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="7">Տվյալ չկա</td></tr>') + '</tbody></table>';
    const html = '<!doctype html><html lang="hy"><head><meta charset="utf-8"><title>' + esc(title) + '</title>' +
      '<style>body{font-family:Arial,sans-serif;padding:14mm}table{border-collapse:collapse;width:100%}th,td{border:1px solid #333;padding:6px 8px;font-size:12px}th{background:#e9eef2}</style></head><body><h1>' +
      esc(title) + '</h1>' + body + '<p class="meta">KM</p></body></html>';
    if (typeof window.kmPrintNativeFromHtml === 'function') window.kmPrintNativeFromHtml(title, html);
    else {
      const w = window.open('', '_blank');
      if (w) { w.document.write(html); w.document.close(); }
    }
  };
  // Keep alias only if extensions page opener is missing
  if (typeof window.kmPrintMonthlyReport !== 'function') {
    window.kmPrintMonthlyReport = window.kmPrintMonthlyReportAllGraphs;
  }

  /* ---- Unified substitutions ---- */
  window.kmOpenUnifiedSubstitutions = function () {
    ensureOpsDb();
    const graphs = window.kmAllGraphs();
    const gopts = graphs.map(function (g) {
      return '<option value="' + esc(g.key) + '">' + esc(g.name) + '</option>';
    }).join('');
    const people = (db.people || []).filter(function (p) {
      return !(typeof kmPersonNotPlannable === 'function' ? kmPersonNotPlannable(p) : (typeof kmPersonIsBlocked === 'function' && kmPersonIsBlocked(p)));
    });
    const popts = people.map(function (p) {
      return '<option value="' + esc(p.name) + '">' + esc(p.name) + '</option>';
    }).join('');
    const log = (db.substitutions || []).slice().reverse().map(function (s) {
      const range = (s.toDay && s.toDay !== s.day) ? (s.day + '–' + s.toDay) : String(s.day || '');
      const pair = s.kind === 'cover' ? (esc(s.from) + ' → ' + esc(s.to)) : (esc(s.from) + ' ↔ ' + esc(s.to));
      return '<tr><td>' + esc(s.at || '') + '</td><td>' + esc((s.graphName || '') + ' ' + range + '/' + (s.month || '') + '/' + (s.year || '')) +
        '</td><td>' + pair + '</td></tr>';
    }).join('') || '<tr><td colspan="3">Դատարկ</td></tr>';
    const todayN = new Date().getDate();
    const host = document.getElementById('content');
    if (!host) return;
    host.innerHTML = '<div class="card"><h3>Փոխանակում</h3>' +
      '<p class="muted">Երկու անձը փոխում են նշված օրերի նշումը ընտրված գրաֆիկում։ Կարող եք նշել մեկ օր կամ միջակայք։</p>' +
      (canEdit() ? '<label>Գրաֆիկ <select id="kmSwGraph">' + gopts + '</select></label> ' +
        '<label>Անձ A <select id="kmSwA">' + popts + '</select></label> ' +
        '<label>Անձ B <select id="kmSwB">' + popts + '</select></label> ' +
        '<label>Սկիզբ <input id="kmSwFrom" type="number" min="1" max="31" value="' + todayN + '" style="width:80px"></label> ' +
        '<label>Ավարտ <input id="kmSwTo" type="number" min="1" max="31" value="' + todayN + '" style="width:80px"></label>' +
        '<div class="toolbar" style="margin-top:12px"><button type="button" class="primary" onclick="kmDoUnifiedSwap()">Հաստատել փոխանակումը</button></div>' +
        '<h3 style="margin-top:18px">Փոխարինում բացակայության համար</h3>' +
        '<p class="muted">Բացակա անձի հերթապահությունը տեղափոխվում է փոխարինողին՝ նշված օրերին, եթե փոխարինողը այդ օրը ազատ է։</p>' +
        '<label>Գրաֆիկ <select id="kmCvGraph">' + gopts + '</select></label> ' +
        '<label>Բացակա <select id="kmCvFrom">' + popts + '</select></label> ' +
        '<label>Փոխարինող <select id="kmCvTo">' + popts + '</select></label> ' +
        '<label>Սկիզբ <input id="kmCvFromDay" type="number" min="1" max="31" value="' + todayN + '" style="width:80px"></label> ' +
        '<label>Ավարտ <input id="kmCvToDay" type="number" min="1" max="31" value="' + todayN + '" style="width:80px"></label>' +
        '<div class="toolbar" style="margin-top:12px"><button type="button" class="primary" onclick="kmDoUnifiedCover()">Հաստատել փոխարինումը</button></div>' : '') +
      '<h3 style="margin-top:18px">Մատյան</h3>' +
      '<div class="gridwrap"><table class="grid"><thead><tr><th>Ժամանակ</th><th>Գրաֆիկ / օր</th><th>Անձինք</th></tr></thead><tbody>' +
      log + '</tbody></table></div>' +
      '<div class="toolbar" style="margin-top:10px"><button type="button" onclick="kmReportsBack()">← Վերադարձ</button></div></div>';
    page = 'substitutions';
    window.page = 'substitutions';
    const pt = document.getElementById('pageTitle');
    if (pt) pt.textContent = 'Փոխանակումներ';
  };
  window.kmOpenDutySwap = function () { kmOpenUnifiedSubstitutions(); };
  window.kmOpenSubstitutionLog = function () { kmOpenUnifiedSubstitutions(); };
  window.kmListSubstitutions = function () { kmOpenUnifiedSubstitutions(); };

  function graphRowsFor(g) {
    if (!g) return null;
    if (g.key === 'main') {
      db.schedule.rows = db.schedule.rows || {};
      return db.schedule.rows;
    }
    const sch = (db.dutyTypeSchedules || {})[g.key];
    if (!sch) return null;
    sch.assignments = sch.assignments || sch.rows || {};
    sch.rows = sch.assignments;
    return sch.assignments;
  }
  function daySpan(fromId, toId) {
    const from = Number((document.getElementById(fromId) || {}).value);
    const to = Number((document.getElementById(toId) || {}).value || from);
    if (!from || !to) return null;
    return { from: Math.min(from, to), to: Math.max(from, to) };
  }

  window.kmDoUnifiedSwap = async function () {
    if (!canEdit()) { toast('Դիտորդի իրավունք', 'error'); return; }
    const key = (document.getElementById('kmSwGraph') || {}).value;
    const a = (document.getElementById('kmSwA') || {}).value;
    const b = (document.getElementById('kmSwB') || {}).value;
    const span = daySpan('kmSwFrom', 'kmSwTo');
    if (!key || !a || !b || a === b || !span) { toast('Ընտրեք տարբեր անձանց և օրեր', 'warn'); return; }
    const label = span.from === span.to ? String(span.from) : (span.from + '–' + span.to);
    if (!confirm('Փոխե՞լ ' + a + ' և ' + b + ' նշումը ' + label + ' օրերին։')) return;
    const graphs = window.kmAllGraphs();
    const g = graphs.find(function (x) { return x.key === key; });
    if (!g) return;
    if (typeof archiveCurrentSchedule === 'function') archiveCurrentSchedule('Մինչև փոխանակում');
    const rows = graphRowsFor(g);
    if (!rows) return;
    if (L().swapCellsRange) L().swapCellsRange(rows, a, b, span.from, span.to);
    else {
      for (let d = span.from; d <= span.to; d++) (L().swapCells || function () {})(rows, a, rows, b, d);
    }
    db.substitutions = db.substitutions || [];
    db.substitutions.push({
      year: g.year, month: g.month, day: span.from, toDay: span.to, from: a, to: b,
      graph: key, graphName: g.name, kind: 'swap', at: new Date().toISOString()
    });
    audit('swap', g.name + ' ' + a + ' ↔ ' + b + ' օր ' + label);
    if (typeof save === 'function') await save(true);
    toast('Փոխանակումը կատարվեց');
    kmOpenUnifiedSubstitutions();
  };

  window.kmDoUnifiedCover = async function () {
    if (!canEdit()) { toast('Դիտորդի իրավունք', 'error'); return; }
    const key = (document.getElementById('kmCvGraph') || {}).value;
    const a = (document.getElementById('kmCvFrom') || {}).value;
    const b = (document.getElementById('kmCvTo') || {}).value;
    const span = daySpan('kmCvFromDay', 'kmCvToDay');
    if (!key || !a || !b || a === b || !span) { toast('Ընտրեք բացակային, փոխարինողին և օրեր', 'warn'); return; }
    const label = span.from === span.to ? String(span.from) : (span.from + '–' + span.to);
    if (!confirm('Տեղափոխե՞լ ' + a + '-ի հերթապահությունը ' + b + '-ին ' + label + ' օրերին։')) return;
    const graphs = window.kmAllGraphs();
    const g = graphs.find(function (x) { return x.key === key; });
    if (!g) return;
    if (typeof archiveCurrentSchedule === 'function') archiveCurrentSchedule('Մինչև փոխարինում');
    const rows = graphRowsFor(g);
    if (!rows) return;
    const r = (L().coverAbsence || function () { return { moved: [], skipped: [] }; })(rows, a, b, span.from, span.to);
    db.substitutions = db.substitutions || [];
    db.substitutions.push({
      year: g.year, month: g.month, day: span.from, toDay: span.to, from: a, to: b,
      graph: key, graphName: g.name, kind: 'cover', moved: r.moved || [], skipped: r.skipped || [],
      at: new Date().toISOString()
    });
    audit('cover', g.name + ' ' + a + ' → ' + b + ' օր ' + label);
    if (typeof save === 'function') await save(true);
    const movedN = (r.moved || []).length;
    const skipN = (r.skipped || []).length;
    toast('Փոխարինում՝ ' + movedN + ' օր' + (skipN ? ' · բաց թողնված՝ ' + skipN : ''));
    kmOpenUnifiedSubstitutions();
  };

  /* ---- Cell comments + audit on graph cells ---- */
  function commentKey(graph, person, day) {
    return String(graph || 'main') + '|' + String(person || '') + '|' + String(day || '');
  }
  window.kmSetCellComment = async function (graph, person, day, text) {
    if (!canEdit()) return;
    ensureOpsDb();
    const k = commentKey(graph, person, day);
    if (text) db.cellComments[k] = String(text); else delete db.cellComments[k];
    audit('cell-comment', k + ' ' + (text || '(ջնջված)'));
    if (typeof save === 'function') await save(true);
  };

  function bindCellExtras() {
    document.querySelectorAll('td[data-s][data-d], td[data-dtype-person][data-dtype-day]').forEach(function (td) {
      if (td.__kmOpsBound) return;
      td.__kmOpsBound = true;
      td.addEventListener('contextmenu', function (ev) {
        ev.preventDefault();
        let person = '', day = '', graph = 'main';
        if (td.dataset.dtypePerson != null) {
          const sch = window.kmFormalContext && window.kmFormalContext.owner;
          graph = typeof kmFormalGraphKey === 'function' ? kmFormalGraphKey(sch) : 'duty';
          person = td.getAttribute('data-km-person') || '';
          day = td.dataset.dtypeDay || td.dataset.day;
        } else {
          const selected = typeof kmMainSelectedPeople === 'function' ? kmMainSelectedPeople() : (db.people || []);
          const p = selected[+td.dataset.s];
          person = p && p.name || '';
          day = td.dataset.d;
          graph = 'main';
        }
        if (!person || !day) return;
        ensureOpsDb();
        const cur = db.cellComments[commentKey(graph, person, day)] || '';
        const t = prompt('Նշում — ' + person + ', օր ' + day, cur);
        if (t == null) return;
        kmSetCellComment(graph, person, day, t.trim());
        toast(t.trim() ? 'Նշումը պահպանվեց' : 'Նշումը ջնջվեց');
      });
    });
  }

  function wrapCellClickAudit() {
    const origS = window.schedule;
    if (typeof origS === 'function' && !origS.__kmOpsAudit) {
      window.schedule = function () {
        origS.apply(this, arguments);
        const tb = document.querySelector('#content .card .toolbar');
        if (tb && !tb.querySelector('[data-km-ops-print]')) {
          const span = document.createElement('span');
          span.setAttribute('data-km-ops-print', '1');
          span.style.cssText = 'display:contents';
          span.innerHTML = '<button type="button" onclick="kmOpenPrintPresetManager()">Տպման նախադրանք</button>' +
            '<button type="button" onclick="kmOpenTemplateManager()">Formal ձևանմուշ</button>';
          tb.appendChild(span);
        }
        bindCellExtras();
        document.querySelectorAll('#content td[data-s][data-d]').forEach(function (td) {
          const prev = td.onclick;
          td.onclick = async function (ev) {
            if (!canEdit()) return;
            const selected = typeof kmMainSelectedPeople === 'function' ? kmMainSelectedPeople() : [];
            const person = selected[+td.dataset.s];
            const day = td.dataset.d;
            const name = person && person.name;
            const before = name && db.schedule && db.schedule.rows && db.schedule.rows[name]
              ? db.schedule.rows[name][day] : '';
            if (typeof prev === 'function') await prev.call(td, ev);
            const after = name && db.schedule && db.schedule.rows && db.schedule.rows[name]
              ? db.schedule.rows[name][day] : '';
            if (String(before || '') !== String(after || '')) {
              audit('cell', 'Հիմնական · ' + name + ' օր ' + day + '՝ ' + (after || 'դատարկ'));
            }
          };
        });
      };
      window.schedule.__kmOpsAudit = true;
    }
    const origD = window.renderDutyTypePlanning;
    if (typeof origD === 'function' && !origD.__kmOpsAudit) {
      window.renderDutyTypePlanning = function (index) {
        origD.apply(this, arguments);
        const sch = (db.dutyTypeSchedules || {})['duty_' + Number(index)];
        const list = sch && typeof window.kmDutySelectedPeople === 'function' ? window.kmDutySelectedPeople(sch) : [];
        document.querySelectorAll('#dutyTypePlanningBody [data-dtype-person]').forEach(function (cell) {
          const p = list[+cell.dataset.dtypePerson];
          if (p && p.name) cell.setAttribute('data-km-person', p.name);
          const prev = cell.onclick;
          cell.onclick = async function (ev) {
            if (!canEdit()) return;
            const typeName = (db.dutyTypes || [])[index] || ('duty_' + index);
            const who = cell.getAttribute('data-km-person') || '';
            if (typeof prev === 'function') await prev.call(cell, ev);
            audit('cell', typeName + ' · ' + who + ' օր ' + (cell.dataset.dtypeDay || ''));
          };
        });
        bindCellExtras();
      };
      window.renderDutyTypePlanning.__kmOpsAudit = true;
    }
  }

  /* ---- Units + CSV on people ---- */
  function unitOptions(selected) {
    ensureOpsDb();
    const names = db.units.map(function (u) { return String(u.name || u).trim(); }).filter(Boolean);
    const cur = String(selected || '');
    if (cur && names.indexOf(cur) < 0) names.unshift(cur);
    return '<option value=""></option>' + names.map(function (n) {
      return '<option value="' + esc(n) + '"' + (n === cur ? ' selected' : '') + '>' + esc(n) + '</option>';
    }).join('');
  }

  function patchPeople() {
    const orig = window.people;
    if (typeof orig !== 'function' || orig.__kmOpsUnits) return;
    window.people = function () {
      orig.apply(this, arguments);
      ensureOpsDb();
      const tb = document.querySelector('#content .card .toolbar');
      if (tb && !tb.querySelector('[data-km-ops-people]')) {
        const span = document.createElement('span');
        span.setAttribute('data-km-ops-people', '1');
        span.style.cssText = 'display:contents';
        span.innerHTML = '<button type="button" onclick="kmImportPeopleCsv()">CSV ներմուծում</button>' +
          '<button type="button" onclick="kmOpenUnitsManager()">Ստորաբաժանումներ</button>';
        tb.appendChild(span);
      }
      document.querySelectorAll('.peopleGrid input[data-k="unit"]').forEach(function (inp) {
        const i = inp.getAttribute('data-p');
        const sel = document.createElement('select');
        sel.setAttribute('data-p', i);
        sel.setAttribute('data-k', 'unit');
        sel.innerHTML = unitOptions(inp.value);
        inp.replaceWith(sel);
      });
      if (typeof bindPeople === 'function') bindPeople();
    };
    window.people.__kmOpsUnits = true;
  }

  window.kmOpenUnitsManager = function () {
    ensureOpsDb();
    const host = document.getElementById('content');
    if (!host) return;
    const rows = db.units.map(function (u, i) {
      const n = String(u.name || u);
      const count = (db.people || []).filter(function (p) { return String(p.unit || '') === n; }).length;
      return '<tr><td>' + esc(n) + '</td><td>' + count + '</td>' +
        '<td><button type="button" onclick="kmFilterPeopleUnit(' + i + ')">Անձնակազմ</button>' +
        (canEdit() ? ' <button type="button" onclick="kmRenameUnit(' + i + ')">Անվանափոխել</button>' : '') +
        '</td></tr>';
    }).join('') || '<tr><td colspan="3">Դատարկ</td></tr>';
    host.innerHTML = '<div class="card"><h3>Ստորաբաժանումներ</h3>' +
      '<div class="toolbar"><button type="button" onclick="kmReportsBack()">← Վերադարձ</button>' + (canEdit() ? '<button type="button" onclick="kmAddUnit()">+ Ավելացնել</button>' : '') +
      '<button type="button" onclick="people()">Անձնակազմ</button></div>' +
      '<div class="gridwrap"><table class="grid"><thead><tr><th>Անուն</th><th>Անձինք</th><th></th></tr></thead><tbody>' +
      rows + '</tbody></table></div></div>';
    page = 'units';
    const pt = document.getElementById('pageTitle');
    if (pt) pt.textContent = 'Ստորաբաժանումներ';
  };
  window.kmAddUnit = function () {
    if (!canEdit()) { toast('Դիտորդի իրավունք', 'error'); return; }
    const n = prompt('Ստորաբաժանման անուն');
    if (!n || !n.trim()) return;
    ensureOpsDb();
    if (db.units.some(function (u) { return String(u.name || u) === n.trim(); })) {
      toast('Արդեն կա', 'warn'); return;
    }
    db.units.push({ name: n.trim() });
    save(true); kmOpenUnitsManager();
  };
  window.kmRenameUnit = function (i) {
    if (!canEdit()) { toast('Դիտորդի իրավունք', 'error'); return; }
    ensureOpsDb();
    const u = db.units[i];
    if (!u) return;
    const old = String(u.name || u);
    const n = prompt('Նոր անուն', old);
    if (!n || !n.trim() || n.trim() === old) return;
    u.name = n.trim();
    (db.people || []).forEach(function (p) { if (p.unit === old) p.unit = n.trim(); });
    save(true); kmOpenUnitsManager();
  };

  window.kmFilterPeopleUnit = function (i) {
    ensureOpsDb();
    const u = db.units[i];
    if (!u) return;
    const name = String(u.name || u);
    page = 'people';
    if (typeof people === 'function') people();
    else if (typeof render === 'function') render();
    setTimeout(function () {
      document.querySelectorAll('.peopleGrid tbody tr').forEach(function (tr) {
        const inp = tr.querySelector('[data-k="unit"]');
        const val = inp ? String(inp.value || '') : '';
        tr.style.display = val === name ? '' : 'none';
      });
    }, 50);
  };

  /* ---- Duty post cards ---- */
  function patchDutyTypes() {
    const orig = window.openDutyTypesSection;
    if (typeof orig !== 'function' || orig.__kmOpsPost) return;
    window.openDutyTypesSection = function () {
      orig.apply(this, arguments);
      ensureOpsDb();
      const cards = document.querySelectorAll('#content .card button[onclick*="openDutyTypePlanning"]');
      cards.forEach(function (btn, i) {
        const wrap = btn.parentElement;
        if (!wrap || wrap.querySelector('[data-km-post]')) return;
        const post = db.dutyPosts[i] || {};
        const parts = [];
        if (post.place) parts.push('Վայր՝ ' + esc(post.place));
        if (post.minRank) parts.push('Նվազագույն կոչում՝ ' + esc(post.minRank));
        if (post.minPeople || post.maxPeople) parts.push('Հերթապահներ՝ ' + esc(post.minPeople || '—') + '–' + esc(post.maxPeople || '—'));
        if (post.sop) parts.push(esc(post.sop));
        if (!parts.length) return;
        const info = document.createElement('div');
        info.setAttribute('data-km-post', '1');
        info.className = 'muted';
        info.style.cssText = 'font-size:12px;margin-top:8px';
        info.innerHTML = parts.join('<br>');
        wrap.appendChild(info);
      });
    };
    window.openDutyTypesSection.__kmOpsPost = true;
  }
  window.kmEditDutyPost = function (i) {
    if (!canEdit()) return;
    ensureOpsDb();
    const post = db.dutyPosts[i] || {};
    const name = (db.dutyTypes || [])[i] || '';
    const html = '<label>Վայր <input id="kmPostPlace" value="' + esc(post.place || '') + '"></label><br><br>' +
      '<label>Նվազագույն կոչում <input id="kmPostRank" value="' + esc(post.minRank || '') + '"></label><br><br>' +
      '<label>Նվազ. հերթապահ <input id="kmPostMin" type="number" min="0" value="' + esc(post.minPeople || 0) + '" style="width:80px"></label> ' +
      '<label>Առավ. <input id="kmPostMax" type="number" min="0" value="' + esc(post.maxPeople || 0) + '" style="width:80px"></label><br><br>' +
      '<label>SOP / նշում<br><textarea id="kmPostSop" rows="3" style="width:100%">' + esc(post.sop || '') + '</textarea></label>';
    if (typeof kmOpenDialog === 'function') {
      kmOpenDialog('Պաշտոն — ' + name, html, async function (box) {
        db.dutyPosts[i] = {
          place: box.querySelector('#kmPostPlace').value.trim(),
          minRank: box.querySelector('#kmPostRank').value.trim(),
          minPeople: Number(box.querySelector('#kmPostMin').value) || 0,
          maxPeople: Number(box.querySelector('#kmPostMax').value) || 0,
          sop: box.querySelector('#kmPostSop').value.trim()
        };
        await save(true);
        openDutyTypesSection();
      }, 'Պահպանել');
    }
  };

  /* ---- Settings Armenian + print/template buttons ---- */
  function patchSettingsHy() {
    const orig = window.kmOpenSettings;
    if (typeof orig !== 'function' || orig.__kmOpsHy) return;
    window.kmOpenSettings = async function () {
      await orig.apply(this, arguments);
      const c = document.getElementById('content');
      if (!c) return;
      c.innerHTML = c.innerHTML
        .replace('Auto-backup (ժամ)', 'Ավտոպահուստ (ժամ)')
        .replace('Auto-lock (րոպե, 0=off)', 'Ավտոկողպում (րոպե, 0 = անջատված)')
        .replace('Smart plan min gap', 'Խելացի պլան՝ նվազագույն բաց')
        .replace('Smart plan max/month', 'Խելացի պլան՝ առավելագույնը ամսում')
        .replace('Dark mode', 'Մուգ ռեժիմ')
        .replace('Software render (GPU off)', 'Ծրագրային նկարում (GPU անջատված)')
        .replace('Backup reminder (օր)', 'Պահուստի հիշեցում (օր)')
        .replace('Encrypted backup', 'Գաղտնագրված պահուստ')
        .replace('Import encrypted', 'Ներմուծել գաղտնագրվածը')
        .replace('Preview dark', 'Նախադիտել մուգը')
        .replace(">Watermark տպման", '>Ջրանիշ տպման');
      const tb = c.querySelector('.toolbar');
      if (tb && !tb.querySelector('[data-km-enc-mgmt]') && !/Գաղտնագրված պահուստ/.test(tb.textContent || '')) {
        const b1 = document.createElement('button');
        b1.type = 'button';
        b1.setAttribute('data-km-enc-mgmt', '1');
        b1.textContent = 'Գաղտնագրված պահուստ';
        b1.onclick = function () { kmEncryptedBackupExport(); };
        tb.appendChild(b1);
        const b2 = document.createElement('button');
        b2.type = 'button';
        b2.textContent = 'Ներմուծել գաղտնագրվածը';
        b2.onclick = function () { kmEncryptedBackupImport(); };
        tb.appendChild(b2);
      }
    };
    window.kmOpenSettings.__kmOpsHy = true;
  }

  function patchManagementEnc() {
    const orig = window.management;
    if (typeof orig !== 'function' || orig.__kmOpsEnc) return;
    window.management = function () {
      orig.apply(this, arguments);
      const tb = document.querySelector('#content .card .toolbar');
      if (!tb || tb.querySelector('[data-km-ops-mgmt]')) return;
      const span = document.createElement('span');
      span.setAttribute('data-km-ops-mgmt', '1');
      span.style.cssText = 'display:contents';
      span.innerHTML = '<button type="button" onclick="kmEncryptedBackupExport()">Գաղտնագրված պահուստ</button>' +
        '<button type="button" onclick="kmEncryptedBackupImport()">Ներմուծել գաղտնագրվածը</button>' +
        (typeof window.kmCanAdmin === 'function' && window.kmCanAdmin()
          ? '<button type="button" onclick="kmOpenSettings()">Կարգավորումներ</button>'
          : '');
      tb.appendChild(span);
    };
    window.management.__kmOpsEnc = true;
  }

  /* ---- Auto-fix all graphs ---- */
  window.kmAutoFixConflicts = async function () {
    if (!canEdit()) { toast('Դիտորդի իրավունք', 'error'); return; }
    const list = kmDetectConflicts();
    if (!list.length) { toast('Խնդիր չի հայտնաբերվել'); return; }
    if (!confirm('Ավտոմատ ուղղե՞լ ' + list.length + ' խնդիր(ներ)ը բոլոր գրաֆիկներում։')) return;
    if (typeof kmPushUndo === 'function' && typeof clone === 'function') kmPushUndo('մինչ conflict fix', clone(db));
    let fixed = 0;
    const graphs = window.kmAllGraphs();
    graphs.forEach(function (g) {
      const y = g.year, m = g.month;
      if (!y || !m) return;
      const days = new Date(y, m, 0).getDate();
      const rows = g.rows;
      const cap = (L().graphCap || function () { return g.key === 'main' ? 1 : 0; })(db, g);
      /* Perf (same result): the name set only depends on selectedPeople + the row keys, and day loops
         only delete cells (never row keys), so build it once per graph instead of once per day. */
      const names = {};
      (Array.isArray(g.selectedPeople) ? g.selectedPeople : []).forEach(function (n) {
        const t = String(n || '').trim();
        if (t) names[t] = 1;
      });
      Object.keys(rows || {}).forEach(function (n) {
        const t = String(n || '').trim();
        if (t) names[t] = 1;
      });
      const nameList = Object.keys(names);
      /* db.people is not modified here: first person per trimmed name, same as Array.find(). */
      const personByName = Object.create(null);
      (db.people || []).forEach(function (p) {
        if (!p) return;
        const k = String(p.name || '').trim();
        if (personByName[k] === undefined) personByName[k] = p;
      });
      for (let d = 1; d <= days; d++) {
        const onDuty = [];
        nameList.forEach(function (name) {
          const row = rows[name];
          if (!row || typeof row !== 'object') return;
          const v = String(row[d] || row[String(d)] || '').trim();
          if (!v) return;
          const dt = new Date(y, m - 1, d, 12, 0, 0);
          const abs = typeof kmPersonAbsence === 'function' ? kmPersonAbsence(name, dt) : null;
          const person = personByName[name] || { name: name };
          const bad = typeof kmPersonHasInconvenientDay === 'function'
            ? kmPersonHasInconvenientDay(person, d)
            : (person.bad || []).map(Number).includes(d);
          if (abs || bad) { delete row[d]; delete row[String(d)]; fixed++; return; }
          onDuty.push(name);
        });
        if (cap > 0 && onDuty.length > cap) {
          onDuty.slice(cap).forEach(function (name) {
            if (rows[name]) { delete rows[name][d]; fixed++; }
          });
        }
      }
    });
    if (typeof save === 'function') await save(true);
    toast('Ուղղվել է ' + fixed + ' նշում');
    if (typeof kmShowConflictBanner === 'function') kmShowConflictBanner();
  };

  /* ---- Inbox KM_SYNC ---- */
  var _kmNetShareTimer = null;
  var _kmNetApplyingSync = false;
  window.kmNetShareDbAfterSave = function () {
    if (_kmNetApplyingSync) return;
    if (!window.kmNative || !window.kmNative.net || !window.kmNative.net.putOutbox) return;
    if (typeof window.kmCanEdit === 'function' && !window.kmCanEdit()) return;
    if (_kmNetShareTimer) clearTimeout(_kmNetShareTimer);
    _kmNetShareTimer = setTimeout(async function () {
      _kmNetShareTimer = null;
      if (_kmNetApplyingSync) return;
      try {
        var st = await window.kmNative.net.status();
        if (!st || (!st.listening && !st.autoSearch)) return;
        if (!st.updateServer && st.reportToAdmin === false) return;
        /* KM_ADMIN_HANG_V1: Hub uses LAN realtime sync — do not rebuild/broadcast
           full KM_SYNC.json on every admin save (17MB renderer freeze loop). */
        if (st.updateServer) {
          try { console.log('[LAN SYNC] hub skip KM_SYNC outbox share'); } catch (_) {}
          return;
        }
        try {
          if (window.kmNative.lanSync && typeof window.kmNative.lanSync.status === 'function') {
            var lst = await window.kmNative.lanSync.status();
            if (lst && (lst.wsState === 'connected' || lst.connected)) {
              try { console.log('[LAN SYNC] client skip KM_SYNC outbox — WS connected'); } catch (_) {}
              return;
            }
          }
        } catch (_eWs) {}
        var payload = typeof window.kmBuildSharePayload === 'function'
          ? window.kmBuildSharePayload(db)
          : db;
        await window.kmNative.net.putOutbox({
          name: 'KM_SYNC.json',
          json: JSON.stringify(payload)
        });
        await window.kmNative.net.reportNow();
      } catch (e) {
        console.warn('kmNetShareDbAfterSave', e);
      }
    }, 12000);
  };

  window.kmNetApplyInboxSync = async function (filePath, opts) {
    opts = opts || {};
    if (!window.kmNative || !window.kmNative.net || !window.kmNative.net.readText) {
      toast('Միայն desktop KM', 'error'); return;
    }
    /* KM_ADMIN_HANG_V1: hub/server must never auto-apply inbound KM_SYNC */
    if (opts.auto) {
      try {
        var _hubSt = await window.kmNative.net.status();
        if (_hubSt && _hubSt.updateServer) {
          try { console.log('[LAN SYNC] hub skip auto KM_SYNC apply'); } catch (_) {}
          return;
        }
      } catch (_eHs) {}
      try {
        var _fp = String(filePath || '');
        var _now = Date.now();
        if (window.__kmLastAutoSyncPath === _fp && (_now - (window.__kmLastAutoSyncAt || 0)) < 120000) {
          try { console.log('[LAN SYNC] skip duplicate auto KM_SYNC'); } catch (_) {}
          return;
        }
        window.__kmLastAutoSyncPath = _fp;
        window.__kmLastAutoSyncAt = _now;
      } catch (_eDup) {}
    }

    if (!opts.auto && !confirm('Միացնե՞լ ստացված KM բազան։ Ընդհանուր բաժինները կթարմացվեն։ Արգելված բաժիններում խմբագրման արգելքը կպահպանվի։')) return;
    _kmNetApplyingSync = true;
    try {
      const r = await window.kmNative.net.readText({ path: filePath });
      if (!r || !r.ok) throw new Error(r && r.error || 'Չհաջողվեց կարդալ');
      /* KM_SYNC_PARSE_GUARD_V1 */
      var rawTxt = String(r.text || '');
      var baseName = String((r.name || filePath || '').split(/[/\\]/).pop() || '');
      if (/^KMJS1/i.test(rawTxt) || /km_app_users\.json$/i.test(baseName) || /km_settings\.json$/i.test(baseName)) {
        throw new Error('Սա KM_SYNC.json չէ');
      }
      if (!/^KM_SYNC\.json$/i.test(baseName) && opts.auto) {
        throw new Error('Սա KM_SYNC.json չէ');
      }
      var data;
      try { data = JSON.parse(rawTxt); }
      catch (pe) { throw new Error('Սա KM_SYNC.json չէ'); }
      if (!data || typeof data !== 'object' || (!data.people && !data.schedule)) {
        throw new Error('Սա KM_SYNC.json չէ');
      }
      if (typeof window.kmApplyDbSnapshot === 'function') {
        if (!window.kmApplyDbSnapshot(data, {
          merge: true,
          force: !!opts.auto,
          role: window.kmUserRole || 'viewer'
        })) return;
      } else {
        Object.assign(db, data);
      }
      if (typeof normalize === 'function') normalize();
      if (typeof save === 'function') await save(true);
      if (typeof window.kmApplyRoleGuard === 'function') window.kmApplyRoleGuard();
      audit('sync-import', r.name || filePath);
      /* KM_NET_RECV_AUTO_V1: after auto KM_SYNC apply, schedule inbox sweep via next listInbox */
      if (opts.auto) {
        try {
          if (window.kmNative && window.kmNative.net && typeof window.kmNative.net.inbox === 'function') {
            setTimeout(function () { window.kmNative.net.inbox().catch(function () {}); }, 1500);
          }
        } catch (_) {}
      }
      if (opts.quiet || opts.auto) {
        try { console.log('[LAN SYNC] inbox applied', r.name || filePath); } catch (_) {}
      } else {
        toast(window.kmUserRole === 'viewer'
          ? 'Բազան թարմացվեց դիտման համար։ Խմբագրումն արգելված է մնում։'
          : 'Բազան միացվեց ցանցից');
      }
      if (!opts.auto && typeof kmOpenPage === 'function') kmOpenPage('home');
      else if (typeof render === 'function') try { render(); } catch (_) {}
    } catch (e) {
      if (opts.auto || opts.quiet) {
        try { console.warn('[LAN SYNC] inbox skip', e && e.message ? e.message : e); } catch (_) {}
      } else {
        toast(e.message || String(e), 'error');
      }
    }
    finally {
      setTimeout(function () { _kmNetApplyingSync = false; }, 4000);
    }
  };

  /* ---- First password change ---- */
  window.kmPromptFirstPasswordChange = function () {
    return new Promise(function (resolve) {
      const old = document.getElementById('kmPwChangeOverlay');
      if (old) old.remove();
      const wrap = document.createElement('div');
      wrap.id = 'kmPwChangeOverlay';
      wrap.style.cssText = 'position:fixed;inset:0;z-index:400000;background:rgba(15,23,42,.8);display:flex;align-items:center;justify-content:center;padding:20px';
      wrap.innerHTML = '<div style="background:#fff;border-radius:12px;padding:24px;min-width:320px;max-width:420px;width:100%">' +
        '<h3 style="margin:0 0 8px">Փոխեք գաղտնաբառը</h3>' +
        '<p class="muted" style="margin:0 0 12px">Վերականգնման կոդը և հին գործարանային գաղտնաբառը չեն կարող մնալ։ Գրեք <b>նոր</b> գաղտնաբառ՝ առնվազն 12 նիշ, մեծատառ, փոքրատառ, թիվ և հատուկ նշան (օր. <code>KmHub-1992ab</code>)։</p>' +
        '<label>Նոր գաղտնաբառ <input id="kmPwNew" type="password" autocomplete="new-password" style="width:100%;margin:6px 0;padding:8px"></label>' +
        '<label>Կրկնել <input id="kmPwNew2" type="password" autocomplete="new-password" style="width:100%;margin:6px 0 12px;padding:8px"></label>' +
        '<div id="kmPwErr" style="color:#a43b3b;min-height:18px"></div>' +
        '<button type="button" class="primary" id="kmPwGo" style="width:100%">Պահպանել</button></div>';
      document.body.appendChild(wrap);
      wrap.querySelector('#kmPwGo').onclick = async function () {
        const a = wrap.querySelector('#kmPwNew').value;
        const b = wrap.querySelector('#kmPwNew2').value;
        const err = wrap.querySelector('#kmPwErr');
        function cleanErr(e){
          var msg = String((e && e.message) || e || '');
          return msg.replace(/^Error invoking remote method '[^']+':\s*/i,'').replace(/^Error:\s*/i,'').trim() || 'Սխալ';
        }
        if (!a || a.length < 12) { err.textContent = 'Առնվազն 12 նիշ'; return; }
        if (!/[a-z]/.test(a) || !/[A-Z]/.test(a) || !/[0-9]/.test(a) || !/[^A-Za-z0-9]/.test(a)) {
          err.textContent = 'Պետք է լինեն մեծատառ, փոքրատառ, թիվ և հատուկ նշան';
          return;
        }
        if (a !== b) { err.textContent = 'Գաղտնաբառերը չեն համընկնում'; return; }
        try {
          const r = await window.kmNative.security.set({
            password: a,
            mustChangePassword: false,
            adminToken: (function () { try { return localStorage.getItem('km_admin_token') || ''; } catch (eT) { return ''; } })()
          });
          if (r && r.token) {
            try {
              localStorage.setItem('km_admin_token', r.token);
              if (r.expiresAt) localStorage.setItem('km_admin_expires', r.expiresAt);
            } catch (e2) {}
          }
          wrap.remove();
          toast('Գաղտնաբառը փոխվեց');
          resolve(true);
        } catch (e) { err.textContent = cleanErr(e); }
      };
    });
  };

  function patchAnalyticsGraphs() {
    const orig = window.analytics;
    if (typeof orig !== 'function' || orig.__kmOpsAn) return;
    window.analytics = function () {
      orig.apply(this, arguments);
      const graphs = window.kmAllGraphs();
      const s = db.schedule || {};
      const y = +s.year, m = +s.month, days = new Date(y, m, 0).getDate() || 0;
      const tbody = document.querySelector('#content .card .grid tbody');
      if (!tbody) return;
      const people = db.people || [];
      const rows = people.map(function (p) {
        let duty = 0;
        graphs.forEach(function (g) {
          if (+g.year !== y || +g.month !== m) return;
          for (let d = 1; d <= days; d++) {
            const v = (L().cellValue || function () { return ''; })(g.rows, p.name, d);
            if (L().occupied && L().occupied(v)) duty++;
          }
        });
        return { name: p.name, duty: duty };
      });
      tbody.querySelectorAll('tr').forEach(function (tr) {
        const name = (tr.children[0] && tr.children[0].textContent) || '';
        const rec = rows.find(function (r) { return r.name === name; });
        if (!rec) return;
        const td = tr.children[1];
        if (td) td.textContent = String(rec.duty);
      });
    };
    window.analytics.__kmOpsAn = true;
  }

  function bootOps() {
    ensureOpsDb();
    patchHomeToday();
    patchPeople();
    patchDutyTypes();
    patchSettingsHy();
    patchManagementEnc();
    patchAnalyticsGraphs();
    wrapCellClickAudit();
    if (typeof window.normalize === 'function' && !window.normalize.__kmOps) {
      const n = window.normalize;
      window.normalize = function () { n(); ensureOpsDb(); };
      window.normalize.__kmOps = true;
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootOps);
  else bootOps();
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

  // Staff source probe: never claim archive/excel staff
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

  // KM_DUTY_ARCHIVE_ONLY_V1_FIX — this used to wipe db.unitFormalArchives / db.positionArchives
  // (immediately, then again at +1s and +4s, and again before several section openers ran).
  // That is the actual reason the unit archive was never available as a personnel source: it
  // was being deleted from memory within a few seconds of every app start. The duty-planning
  // flow's single source of truth must be db.unitFormalArchives, so this now does nothing.
  function scrubFormal() {}
  // (left uncalled on purpose — was: scrubFormal(); setTimeout(scrubFormal,1000); setTimeout(scrubFormal,4000);)

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

﻿/* KM_DUTY_COMPOSITION_V1 — roster band gate + civilian exclude + unit graph rows */
(function () {
  'use strict';
  if (window.__kmDutyCompositionV1) return;
  window.__kmDutyCompositionV1 = true;

  var BAND_KEY = 'kmDutyRosterBand';
  var LABEL = {
    nco: 'Շարքային և ենթասպայական (կոդ ≤ 10)',
    officer: 'Սպայական (կոդ > 10)'
  };

  function dbRef() {
    try { return window.db || (typeof db !== 'undefined' ? db : null); } catch (e) { return null; }
  }

  function getBand() {
    try {
      var s = sessionStorage.getItem(BAND_KEY);
      if (s === 'nco' || s === 'officer') return s;
    } catch (e0) {}
    try {
      var d = dbRef();
      var b = d && d.kmDutyRosterBand;
      if (b === 'nco' || b === 'officer') return b;
    } catch (e1) {}
    return '';
  }

  function setBand(band) {
    band = band === 'officer' ? 'officer' : band === 'nco' ? 'nco' : '';
    try { sessionStorage.setItem(BAND_KEY, band); } catch (e0) {}
    try {
      var d = dbRef();
      if (d) {
        d.kmDutyRosterBand = band;
        if (typeof window.save === 'function') { try { window.save(true); } catch (eS) {} }
        else if (typeof save === 'function') { try { save(true); } catch (eS2) {} }
      }
    } catch (e1) {}
  }

  function clearBand() {
    setBand('');
    try { sessionStorage.removeItem(BAND_KEY); } catch (e) {}
  }

  window.kmDutyIsCivilian = function (p) {
    if (!p) return false;
    var blob = [
      p.rank, p.rankSlot, p.post, p.position, p.category, p.serviceType, p.type,
      p.role, p.staffType, p.extra && p.extra.post, p.extra && p.extra.rankSlot
    ].map(function (x) { return String(x || ''); }).join(' ');
    return /քաղծառայող|քաղ\.?\s*ծառայ|ք\/ծ|ք․ծ|ք\.ծ|ծ-ղ|ծ․ղ|ծ\/ղ|гражданск|civ(?:il)?(?:ian)?\s*serv/i.test(blob);
  };

  window.kmDutyStaffCodeNum = function (p) {
    if (!p) return 0;
    var raw = p.postCode || p.posCode || p.code || p.staffCode || p.staffingCode ||
      (p.extra && (p.extra.postCode || p.extra.posCode || p.extra.code)) || '';
    var vus = p.vus || p.specialty || (p.extra && p.extra.specialty) || '';
    var token = '';
    try {
      if (typeof window.kmStaffingGradeToken === 'function') {
        token = window.kmStaffingGradeToken(raw) || window.kmStaffingGradeToken(vus) || '';
      }
    } catch (eT) {}
    if (!token) {
      var m = String(raw || vus).match(/\b(\d{1,3})\b/);
      token = m ? m[1] : '';
    }
    if (!token) return 0;
    var n = parseInt(String(token).split('/')[0], 10);
    return n > 0 ? n : 0;
  };

  function rankLooksNco(r) {
    return /շ-ն|շարք|եֆր|ս-տ|սերժ|ենթ|ավագ(?!\s*լ)|կ\/ս|կրտ|կ\-ս/i.test(String(r || ''));
  }
  function rankLooksOfficer(r) {
    return /լ-տ|լեյտ|կ-ն|կապիտ|մ-ր|մայոր|գ-տ|գնդ|գեներ|փ\/գ|փոխգնդ/i.test(String(r || ''));
  }

  window.kmDutyInRosterBand = function (p, band) {
    if (!p) return false;
    if (window.kmDutyIsCivilian(p)) return false;
    band = band || getBand();
    if (!band) return !window.kmDutyIsCivilian(p);
    var c = window.kmDutyStaffCodeNum(p);
    if (c > 0) {
      if (band === 'nco') return c <= 10;
      if (band === 'officer') return c > 10;
    }
    var r = p.rank || p.rankSlot || '';
    if (band === 'nco') return rankLooksNco(r) && !rankLooksOfficer(r);
    if (band === 'officer') return rankLooksOfficer(r);
    return true;
  };

  window.kmDutyFilterRoster = function (list, band) {
    band = band || getBand();
    return (Array.isArray(list) ? list : []).filter(function (p) {
      return window.kmDutyInRosterBand(p, band);
    });
  };

  /* Keep raw archive accessor before wrap */
  if (typeof window.kmDutyArchivePersonnel === 'function' && !window.kmDutyArchivePersonnelAll) {
    window.kmDutyArchivePersonnelAll = window.kmDutyArchivePersonnel;
  }

  function wrapArchive() {
    if (typeof window.kmDutyArchivePersonnel !== 'function') return;
    if (window.kmDutyArchivePersonnel.__kmCompV1) return;
    if (!window.kmDutyArchivePersonnelAll) window.kmDutyArchivePersonnelAll = window.kmDutyArchivePersonnel;
    var orig = window.kmDutyArchivePersonnelAll;
    window.kmDutyArchivePersonnel = function () {
      var all = [];
      try { all = orig.apply(this, arguments) || []; } catch (e) { all = []; }
      return window.kmDutyFilterRoster(all, getBand());
    };
    window.kmDutyArchivePersonnel.__kmCompV1 = true;
  }

  window.kmDutyListUnitsForGraph = function () {
    var src = typeof window.kmDutyArchivePersonnelAll === 'function'
      ? window.kmDutyArchivePersonnelAll()
      : (typeof window.kmDutyArchivePersonnel === 'function' ? window.kmDutyArchivePersonnel() : []);
    var band = getBand();
    var map = Object.create(null);
    (src || []).forEach(function (p) {
      if (!window.kmDutyInRosterBand(p, band)) return;
      var u = String((p && (p.unit || p.section)) || '').replace(/\s+/g, ' ').trim();
      if (u) map[u] = 1;
    });
    try {
      var d = dbRef();
      (d && Array.isArray(d.units) ? d.units : []).forEach(function (u) {
        var n = String((u && (u.name || u.title || u)) || '').trim();
        if (n) map[n] = map[n] || 1;
      });
    } catch (eU) {}
    return Object.keys(map).sort(function (a, b) {
      return a.localeCompare(b, 'hy');
    });
  };

  function esc(s) {
    return typeof window.esc === 'function'
      ? window.esc(s)
      : String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
      });
  }

  function contentHost() {
    return document.getElementById('content') || document.getElementById('pageContent') || null;
  }

  function showBandChooser() {
    var host = contentHost();
    if (!host) return;
    try {
      document.body.classList.remove('km-boot-idle');
      window.page = 'dutyTypes';
      if (typeof page !== 'undefined') page = 'dutyTypes';
      var nav = document.getElementById('dutyTypesNavBtn');
      if (typeof window.kmSetActiveNav === 'function') window.kmSetActiveNav(nav);
      var pt = document.getElementById('pageTitle');
      if (pt) pt.textContent = 'Վերակարգ'; /* KM_MENU_REORG_V1 */
    } catch (eN) {}

    host.innerHTML =
      '<div class="card">' +
      '<h2 style="margin-top:0" data-km-i18n-ctx="section">Վերակարգ</h2>' + /* KM_MENU_REORG_V1 */ /* KM_RENAME_LEFTOVERS_V1 */
      '<p class="muted" style="line-height:1.5">Սկզբում ընտրեք ցուցակը։ Քաղծառայողները ցուցակներում և գրաֆիկներում չեն երևում։</p>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin-top:14px">' +
      '<button type="button" class="card" data-km-duty-band="nco" style="padding:18px;text-align:left;cursor:pointer">' +
      '<b>Շարքային և ենթասպայական</b><br><span class="muted">Հաստիքի կոդ ≤ 10</span></button>' +
      '<button type="button" class="card" data-km-duty-band="officer" style="padding:18px;text-align:left;cursor:pointer">' +
      '<b>Սպայական</b><br><span class="muted">Հաստիքի կոդ > 10</span></button>' +
      '</div></div>';

    host.querySelectorAll('[data-km-duty-band]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var band = btn.getAttribute('data-km-duty-band');
        setBand(band);
        if (typeof window.openDutyTypesSection === 'function') window.openDutyTypesSection();
      });
    });
    if (typeof window.kmKickUiPaint === 'function') window.kmKickUiPaint(host);
  }

  function injectBandBanner(host) {
    if (!host || host.querySelector('#kmDutyBandBanner')) return;
    var band = getBand();
    if (!band) return;
    var bar = document.createElement('div');
    bar.id = 'kmDutyBandBanner';
    bar.className = 'card';
    bar.style.cssText = 'margin:0 0 10px;padding:10px 12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap';
    bar.innerHTML =
      '<span style="flex:1"><b>Ցուցակ՝</b> ' + esc(LABEL[band] || band) + '</span>' +
      '<button type="button" id="kmDutyBandChangeBtn">Փոխել ցուցակը</button>';
    host.insertBefore(bar, host.firstChild);
    var b = document.getElementById('kmDutyBandChangeBtn');
    if (b) {
      b.onclick = function () {
        clearBand();
        showBandChooser();
      };
    }
  }

  function wrapOpenSection() {
    var orig = window.openDutyTypesSection;
    if (typeof orig !== 'function' || orig.__kmCompV1) return;
    window.openDutyTypesSection = function () {
      wrapArchive();
      if (!getBand()) {
        showBandChooser();
        return;
      }
      var ret = orig.apply(this, arguments);
      try {
        var host = contentHost();
        injectBandBanner(host);
      } catch (eB) {}
      return ret;
    };
    window.openDutyTypesSection.__kmCompV1 = true;
  }

  /* Unit-composition graph mode */
  function schGraphKind(sch) {
    return sch && sch.graphKind === 'units' ? 'units' : 'people';
  }

  window.kmDutySetGraphKind = function (index, kind) {
    try {
      var d = dbRef();
      if (!d) return;
      d.dutyTypeSchedules = d.dutyTypeSchedules || {};
      var key = 'duty_' + Number(index);
      var sch = d.dutyTypeSchedules[key] || (d.dutyTypeSchedules[key] = { assignments: {} });
      sch.graphKind = kind === 'units' ? 'units' : 'people';
      if (typeof window.save === 'function') window.save(true);
      else if (typeof save === 'function') save(true);
      if (typeof window.renderDutyTypePlanning === 'function') window.renderDutyTypePlanning(Number(index));
      else if (typeof window.openDutyTypePlanning === 'function') window.openDutyTypePlanning(Number(index));
    } catch (e) {
      console.error('kmDutySetGraphKind', e);
    }
  };

  window.kmOpenDutyUnitPicker = function (index) {
    try {
      var d = dbRef();
      var key = 'duty_' + Number(index);
      d.dutyTypeSchedules = d.dutyTypeSchedules || {};
      var sch = d.dutyTypeSchedules[key] || (d.dutyTypeSchedules[key] = { assignments: {} });
      sch.assignments = sch.assignments || {};
      var all = window.kmDutyListUnitsForGraph();
      var selected = new Set(Array.isArray(sch.selectedUnits) ? sch.selectedUnits.map(String) : []);
      var typeName = String((d.dutyTypes || [])[index] || 'Վերակարգ');
      var rows = all.map(function (u) {
        var on = selected.has(u);
        return '<label style="display:flex;gap:8px;align-items:center;padding:6px 4px;border-bottom:1px solid #eee">' +
          '<input type="checkbox" data-km-unit="' + esc(u) + '"' + (on ? ' checked' : '') + '> ' +
          '<span>' + esc(u) + '</span></label>';
      }).join('') || '<p class="muted">Ստորաբաժանումներ չեն գտնվել այս ցուցակի համար։</p>';

      var dlg = window.kmOpenDialog
        ? window.kmOpenDialog(
          'Ստորաբաժանումներ — ' + typeName,
          '<div style="max-height:60vh;overflow:auto">' + rows + '</div>',
          async function () {
            var names = [];
            dlg.querySelectorAll('input[data-km-unit]:checked').forEach(function (inp) {
              names.push(inp.getAttribute('data-km-unit'));
            });
            sch.selectedUnits = names;
            sch.graphKind = 'units';
            Object.keys(sch.assignments || {}).forEach(function (k) {
              if (names.indexOf(k) < 0 && !(Array.isArray(sch.selectedPeople) && sch.selectedPeople.indexOf(k) >= 0)) {
                /* keep person assignments if mixed; drop only unit keys not selected when in unit mode */
              }
            });
            names.forEach(function (n) { sch.assignments[n] = sch.assignments[n] || {}; });
            if (typeof window.save === 'function') await window.save(true);
            else if (typeof save === 'function') await save(true);
            if (typeof window.renderDutyTypePlanning === 'function') window.renderDutyTypePlanning(Number(index));
            if (typeof toast === 'function') toast('Ստորաբաժանումները պահպանվեցին՝ ' + names.length, 'ok');
            return true;
          },
          'Պահպանել'
        )
        : null;
      if (!dlg) {
        if (typeof toast === 'function') toast('Ընտրության պատուհանը հասանելի չէ', 'error');
      }
      return dlg;
    } catch (e) {
      console.error('kmOpenDutyUnitPicker', e);
      if (typeof toast === 'function') toast('Ստորաբաժանումների ընտրությունը չբացվեց', 'error');
      return null;
    }
  };

  function wrapRenderPlanning() {
    var orig = window.renderDutyTypePlanning;
    if (typeof orig !== 'function' || orig.__kmCompV1) return;
    window.renderDutyTypePlanning = function (index) {
      wrapArchive();
      var d = dbRef();
      var key = 'duty_' + Number(index);
      var sch = d && d.dutyTypeSchedules && d.dutyTypeSchedules[key];
      var kind = schGraphKind(sch);

      /* Temporarily swap selected people for unit rows when needed */
      var backupSelected = null;
      var backupPeopleFn = null;
      if (kind === 'units' && sch) {
        backupSelected = sch.selectedPeople;
        var units = Array.isArray(sch.selectedUnits) ? sch.selectedUnits.slice() : [];
        sch.selectedPeople = units.slice();
        if (typeof window.kmDutySelectedPeople === 'function') {
          backupPeopleFn = window.kmDutySelectedPeople;
          window.kmDutySelectedPeople = function (s) {
            var list = Array.isArray((s || sch).selectedUnits) ? (s || sch).selectedUnits : units;
            return list.map(function (u) {
              return { name: u, rank: '', unit: u, __kmUnitRow: true };
            });
          };
        }
      }

      var ret;
      try {
        ret = orig.apply(this, arguments);
      } finally {
        if (kind === 'units' && sch) {
          sch.selectedPeople = backupSelected;
          if (backupPeopleFn) window.kmDutySelectedPeople = backupPeopleFn;
        }
      }

      try {
        var body = document.getElementById('dutyTypePlanningBody');
        if (!body) return ret;
        var tb = body.querySelector('.toolbar');
        if (tb && !tb.querySelector('#kmDutyGraphKindBar')) {
          var bar = document.createElement('div');
          bar.id = 'kmDutyGraphKindBar';
          bar.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0';
          bar.innerHTML =
            '<span class="muted">Գրաֆիկի ձև՝</span>' +
            '<button type="button" id="kmDutyKindPeople"' + (kind === 'people' ? ' disabled' : '') + '>Անձնակազմ</button>' +
            '<button type="button" id="kmDutyKindUnits"' + (kind === 'units' ? ' disabled' : '') + '>Ստորաբաժանումների կազմ</button>' +
            (kind === 'units'
              ? '<button type="button" id="kmDutyPickUnits">🏛 Ստորաբաժանումներ (' +
                (Array.isArray(sch && sch.selectedUnits) ? sch.selectedUnits.length : 0) + ')</button>'
              : '');
          tb.appendChild(bar);
          var bp = document.getElementById('kmDutyKindPeople');
          var bu = document.getElementById('kmDutyKindUnits');
          var pu = document.getElementById('kmDutyPickUnits');
          if (bp) bp.onclick = function () { window.kmDutySetGraphKind(index, 'people'); };
          if (bu) bu.onclick = function () { window.kmDutySetGraphKind(index, 'units'); };
          if (pu) pu.onclick = function () { window.kmOpenDutyUnitPicker(index); };
        }
        if (kind === 'units') {
          try { /* KM_DUTY_KIND_BAR_FIX_V1: empty-table hint for units mode */
            body.querySelectorAll('tbody td[colspan]').forEach(function (td) {
              if (/^\s*Անձնակազմ/.test(td.textContent || '')) td.textContent = 'Ստորաբաժանում չի ընտրվել։ Սեղմեք «🏛 Ստորաբաժանումներ»։';
            });
          } catch (eHint) {}
          body.querySelectorAll('.a4RankCol').forEach(function (el, i) {
            if (el.tagName === 'TH' && i === 0) el.textContent = 'Ձև';
          });
          body.querySelectorAll('tbody .a4RankCol').forEach(function (el) {
            el.textContent = 'ստորաբաժանում';
          });
          var aah = document.getElementById('kmDutyAAHBtn');
          if (aah) {
            aah.textContent = 'Ստորաբաժանում';
            aah.title = 'Ընտրել ստորաբաժանումներ';
            aah.onclick = function (ev) {
              ev.preventDefault();
              window.kmOpenDutyUnitPicker(index);
            };
          }
          var peopleBtn = body.querySelector('button[onclick*="kmOpenDutyPeoplePicker"],button[onclick*="kmOpenDutyPeoplePicker"]');
          /* also rewrite Անձնակազմ button if present */
          body.querySelectorAll('.toolbar button').forEach(function (btn) {
            /* KM_DUTY_KIND_BAR_FIX_V1: never rewrite the graph-kind switch buttons */
            if (btn.closest && btn.closest('#kmDutyGraphKindBar')) return;
            if (/Անձնակազմ/.test(btn.textContent || '')) {
              btn.textContent = '🏛 Ստորաբաժանումներ';
              btn.onclick = function (ev) {
                ev.preventDefault();
                window.kmOpenDutyUnitPicker(index);
              };
            }
          });
        }
      } catch (eUI) {
        console.error('duty composition UI', eUI);
      }
      return ret;
    };
    window.renderDutyTypePlanning.__kmCompV1 = true;
  }

  function boot() {
    try { window.kmDutyShowBandChooser = showBandChooser; } catch (eAlias) {}
    wrapArchive();
    wrapOpenSection();
    wrapRenderPlanning();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 0); });
  } else {
    setTimeout(boot, 0);
  }
  window.kmDutyEnsureRosterBand = function () {
    var b = (function(){ try { return sessionStorage.getItem('kmDutyRosterBand') || ''; } catch(e){ return ''; } })();
    if (b === 'nco' || b === 'officer') return true;
    try {
      var d = window.db || (typeof db !== 'undefined' ? db : null);
      if (d && (d.kmDutyRosterBand === 'nco' || d.kmDutyRosterBand === 'officer')) return true;
    } catch (e2) {}
    try {
      if (typeof window.kmDutyShowBandChooser === "function") window.kmDutyShowBandChooser();
      else if (typeof window.kmDutyShowBandChooser === 'function') window.kmDutyShowBandChooser();
    } catch (e3) {}
    return false;
  };
  window.kmDutyCompositionBoot = boot;
})();

