/* KM_UNIFIED_ARCHIVE_FLOW_V1_POS_DONE */
/* KM_OVERHAUL_V6_EXCEL_GATE */
/* KM_UNIFIED_ARCHIVE_FLOW_V2_POS_DONE */
/* UNIFIED_EXCEL_GATE_SOFT */
/* KM — Պաշտոն (ձեռքով ցուցակ) + Անձնակազմ շտատից ընտրությամբ */
(function () {
  'use strict';

  var state = {
    sectionId: '',
    expanded: Object.create(null),
    q: '',
    onlyVacant: false,
    page: 0,
    pageSize: 80,
    _bootSection: false
  };

  function normSecName(s) {
    return String(s == null ? '' : s)
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/([123])\s*[-–]?\s*(ին|րդ|ԻՆ|ՐԴ)?\s*ՀԳ[Մմ]/gi, '$1ՀԳՄ')
      .replace(/([123])\s+ՀԳ[Մմ]/gi, '$1ՀԳՄ')
      .replace(/\s+/g, ' ')
      .toUpperCase();
  }
  /** Ենթանուն՝ բացատով կամ հայերեն սեռական «ի»-ով (վաշտ → վաշտի) */
  function nameIsChildOf(childNorm, parentNorm) {
    if (!childNorm || !parentNorm || childNorm === parentNorm) return false;
    if (childNorm.indexOf(parentNorm + ' ') === 0) return true;
    if (childNorm.indexOf(parentNorm + 'Ի') === 0) return true;
    return false;
  }
  var VIRTUAL_GROUPS = [
    {
      id: '__g_HPKD',
      name: 'ՀՊԿԴ',
      test: function (norm) {
        return /^ՀՊԿԴ(\s|$)/.test(norm)
          || /^ՀՐԵՏԱՆՈՒ ՊԵՏԻ ԿԱՌԱՎԱՐՄԱՆ ԴԱՍԱԿ/.test(norm);
      }
    },
    {
      id: '__g_HDN',
      name: 'ՀԴՆ',
      test: function (norm) {
        return /^ՀԴՆ(\s|$)/.test(norm)
          || /^ՀՐԵՏԱՆԱՅԻՆ ԴԻՎԻԶԻՈՆ/.test(norm)
          || /^ՀՐԵՏԱՆՈՒ ՇՏԱԲ/.test(norm)
          || /^[123][-–]?(ԻՆ|ՐԴ)\s+Դ-44/.test(norm);
      }
    },
    {
      id: '__g_TPV',
      name: 'ՏՊՎ',
      test: function (norm) {
        return /^ՏՊՎ(\s|$)/.test(norm)
          || /^ՏԵՂԱԿԱՆ ՊԱՇՏՊԱՆՈՒԹՅԱՆ ՎԱՇՏ/.test(norm);
      }
    },
    {
      id: '__g_ZHD',
      name: 'ԶՀԴ',
      test: function (norm) {
        return /^ԶՀԴ(\s|$)/.test(norm) || /^ԶԵՆԻԹԱՅԻՆ/.test(norm);
      }
    }
  ];
  function aliasParentNorm(childNorm) {
    if (!childNorm) return '';
    if (/^ԿՎ(\s|$)/.test(childNorm)) return 'ԿԱՊԻ ՎԱՇՏ';
    if (/^ՆՎ(\s|$)/.test(childNorm)) return 'ՆՈՐՈԳՄԱՆ ՎԱՇՏԻ';
    if (/^ՌՊ(\s|$)/.test(childNorm)) return 'ՌԱԶՄԱԿԱՆԱՑՎԱԾ ՊԱՀԱԿԱԽՈՒՄԲ';
    if (/^ՆԱՎ(\s|$)/.test(childNorm) && childNorm !== 'ՆՅՈՒԹԱԿԱՆ ԱՊԱՀՈՎՄԱՆ ՎԱՇՏ') {
      return 'ՆՅՈՒԹԱԿԱՆ ԱՊԱՀՈՎՄԱՆ ՎԱՇՏ';
    }
    if (/^ԿՇԾ/.test(childNorm)) return 'ԿՈՄՈՒՆԱԼ ՇԱՀԱԳՈՐԾՄԱՆ ԾԱՌԱՅՈՒԹՅՈՒՆ';
    if (/^ԶՈՐԱՎԱՐԺԱԴԱՇՏԻ/.test(childNorm) || /^Զ\/ԴԱՇՏ/.test(childNorm)) {
      return 'ԶՈՐԱՎԱՐԺԱԴԱՇՏ';
    }
    if (/^ԱԿՈՒՄԲԻ ԳՐԱԴԱՐԱՆ/.test(childNorm)) return 'ԱԿՈՒՄԲԻ ՊԵՏ';
    var m = childNorm.match(/^([123])[-–]?(ԻՆ|ՐԴ)\s+Դ-44/);
    if (m) {
      var ord = m[1] === '1' ? '1-ԻՆ' : (m[1] === '2' ? '2-ՐԴ' : '3-ՐԴ');
      return 'ՀԴՆ ' + ord + ' Դ-44 ՀՄ';
    }
    return '';
  }
  function kapChildOrder(name) {
    var n = normSecName(name);
    if (/ՀԵՌԱԽՈՍԱՅԻՆ ԴԱՍԱԿ ԳԾԱՄԱԼՈՒԽԱՅԻՆ/.test(n)) return 10;
    if (/ՀԵՌԱԽՈՍԱՅԻՆ ԴԱՍԱԿԻ ԳԾԱՄԱԼՈՒԽԱՅԻՆ/.test(n)) return 20;
    if (/ՀԵՌԱԽՈՍԱՅԻՆ ԴԱՍԱԿԻ ՀՐԱՄԱՆԱՏԱՐ/.test(n)) return 30;
    if (/ՕՊՏԻԿԱՄԱՆՐԱԹԵԼԱՅԻՆ/.test(n)) return 40;
    return 80;
  }
  function hdnChildOrder(name) {
    var n = normSecName(name);
    if (/^ՀԴՆ ՇՏԱԲ$/.test(n)) return 10;
    if (/^ՀԴՆ ՎԱՐՉԱԿԱԶՄ$/.test(n)) return 20;
    if (/^ՀԴՆ 1-ԻՆ Դ-44 ՀՄ$/.test(n)) return 30;
    if (/1-ԻՆ Դ-44 ՀՄ-ՄԱՍ/.test(n)) return 40;
    if (/^ՀԴՆ 2-ՐԴ Դ-44 ՀՄ$/.test(n)) return 50;
    if (/2-ՐԴ Դ-44 ՀՄ-ՄԱՍ/.test(n)) return 60;
    if (/^ՀԴՆ 3-ՐԴ Դ-44 ՀՄ$/.test(n)) return 70;
    if (/3-ՐԴ Դ-44 ՀՄ-ՄԱՍ/.test(n)) return 80;
    if (/^ՀԴՆ ԲՈՒԺԿԵՏ$/.test(n)) return 90;
    if (/ԴԿԴ-ՀԵՏ/.test(n)) return 100;
    if (/ԿԴ-ՀԵՏ/.test(n)) return 110;
    if (/ՇՏԱԲԻ ՊԵՏԻ ԿԱՌԱՎԱՐՄԱՆ/.test(n)) return 120;
    if (/ՆՅՈՒԹԱՏԵԽՆԻԿԱԿԱՆ ԱՊԱՀՈՎՄԱՆ ԴԱՍԱԿԻ ԱՎՏՈՄՈԲԻԼԱՅԻՆ/.test(n)) return 130;
    if (/ՆՅՈՒԹԱՏԵԽՆԻԿԱԿԱՆ ԱՊԱՀՈՎՄԱՆ ԴԱՍԱԿԻ ՀՐԱՄԱՆԱՏԱՐ/.test(n)) return 140;
    if (/ՏԵԽՆԻԿԱԿԱՆ ՍՊԱՍԱՐԿՄԱՆ/.test(n)) return 150;
    if (/ՏՆՏԵՍԱԿԱՆ ՋՈԿ/.test(n)) return 160;
    return 200;
  }
  function sortChildren(parentNorm, kids) {
    kids.sort(function (a, b) {
      var oa = 0, ob = 0;
      if (parentNorm === 'ԿԱՊԻ ՎԱՇՏ') {
        oa = kapChildOrder(a.name); ob = kapChildOrder(b.name);
      } else if (parentNorm === 'ՀԴՆ') {
        oa = hdnChildOrder(a.name); ob = hdnChildOrder(b.name);
      }
      if (oa !== ob) return oa - ob;
      return a.name.localeCompare(b.name, 'hy');
    });
  }
  function findSectionById(id) {
    if (id && String(id).indexOf('__g_') === 0) {
      for (var g = 0; g < VIRTUAL_GROUPS.length; g++) {
        if (VIRTUAL_GROUPS[g].id === id) {
          return { id: VIRTUAL_GROUPS[g].id, name: VIRTUAL_GROUPS[g].name, virtual: true, norm: normSecName(VIRTUAL_GROUPS[g].name) };
        }
      }
    }
    var list = (_posViewCache.cat && _posViewCache.cat.sections) || catalog().sections || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function buildSectionForest(positions) {
    var sections = catalog().sections || [];
    var nodes = sections.map(function (s) {
      return {
        id: s.id,
        name: s.name,
        norm: s.norm || normSecName(s.name),
        children: [],
        parentId: null,
        _count: 0
      };
    });
    var byNorm = Object.create(null);
    nodes.forEach(function (n) { byNorm[n.norm] = n; });
    var byLen = nodes.slice().sort(function (a, b) {
      return a.norm.length - b.norm.length || a.norm.localeCompare(b.norm, 'hy');
    });
    byLen.forEach(function (node) {
      var parent = null;
      var alias = aliasParentNorm(node.norm);
      if (alias && byNorm[alias] && byNorm[alias] !== node) parent = byNorm[alias];
      for (var i = 0; i < byLen.length; i++) {
        var cand = byLen[i];
        if (cand === node || !cand.norm) continue;
        if (node.norm === cand.norm) continue;
        if (nameIsChildOf(node.norm, cand.norm)) {
          if (!parent || cand.norm.length > parent.norm.length) parent = cand;
        }
      }
      if (parent) {
        node.parentId = parent.id;
        parent.children.push(node);
      }
    });
    var groups = VIRTUAL_GROUPS.map(function (g) {
      return {
        id: g.id,
        name: g.name,
        norm: normSecName(g.name),
        children: [],
        parentId: null,
        virtual: true,
        test: g.test,
        _count: 0
      };
    });
    nodes.forEach(function (n) {
      if (n.parentId) return;
      for (var gi = 0; gi < groups.length; gi++) {
        var g = groups[gi];
        if (!g.test(n.norm) || n.norm === g.norm) continue;
        /* Եթե կա իրական բաժին նույն անունով՝ կցել դրան (ոչ կրկնակի վիրտուալ արմատ) */
        var hub = byNorm[g.norm];
        if (hub && hub !== n) {
          n.parentId = hub.id;
          hub.children.push(n);
        } else {
          n.parentId = g.id;
          g.children.push(n);
        }
        return;
      }
    });
    nodes.concat(groups).forEach(function (n) {
      sortChildren(n.norm, n.children);
    });

    /* Քանակները՝ մեկ անցումով (ոչ O(nodes×positions)) */
    var exact = Object.create(null);
    (positions || []).forEach(function (p) {
      if (!p || !p.sectionId) return;
      exact[p.sectionId] = (exact[p.sectionId] || 0) + 1;
    });
    function rollup(node) {
      var n = exact[node.id] || 0;
      var kids = node.children || [];
      for (var i = 0; i < kids.length; i++) n += rollup(kids[i]);
      node._count = n;
      return n;
    }

    var roots = nodes.filter(function (n) { return !n.parentId; })
      .concat(groups.filter(function (g) { return g.children.length; }));
    roots.forEach(rollup);
    roots.sort(function (a, b) { return a.name.localeCompare(b.name, 'hy'); });
    return roots;
  }
  var _posViewCache = { key: '', cat: null, forest: null, matchFn: null, matchId: '' };

  function positionsCacheKey() {
    var p = (typeof db !== 'undefined' && Array.isArray(db.userPositions)) ? db.userPositions : [];
    return String(p.length) + ':' + String(p._kmMut || 0);
  }
  function bumpPositionsMut() {
    if (typeof db === 'undefined') return;
    if (!Array.isArray(db.userPositions)) db.userPositions = [];
    db.userPositions._kmMut = (Number(db.userPositions._kmMut) || 0) + 1;
    _posViewCache.key = '';
    try {
      if (typeof window.kmHelpBotInvalidateKnowledge === 'function') {
        window.kmHelpBotInvalidateKnowledge('positions');
      }
    } catch (eInv) {}
  }
  function getPositionsView() {
    ensureStore();
    var hasArch = (typeof window.kmUnitHasStaffSource === 'function') ? !!window.kmUnitHasStaffSource() : ((typeof window.kmUnitHasExcelArchive !== 'function') || window.kmUnitHasExcelArchive()); /* KM_UNIFIED_ARCHIVE_FLOW_V1_REDIR */
    var key = positionsCacheKey() + ':' + (hasArch ? '1' : '0');
    if (_posViewCache.key !== key || !_posViewCache.cat) {
      _posViewCache.cat = catalog();
      _posViewCache.forest = buildSectionForest(_posViewCache.cat.positions || []);
      _posViewCache.key = key;
      _posViewCache.matchFn = null;
      _posViewCache.matchId = '';
    }
    return _posViewCache;
  }
  function selectionMatchFn(sectionId) {
    var view = getPositionsView();
    if (view.matchId === sectionId && typeof view.matchFn === 'function') return view.matchFn;
    var fn;
    if (!sectionId) {
      fn = function () { return true; };
    } else if (String(sectionId).indexOf('__g_') === 0) {
      var test = null;
      for (var g = 0; g < VIRTUAL_GROUPS.length; g++) {
        if (VIRTUAL_GROUPS[g].id === sectionId) { test = VIRTUAL_GROUPS[g].test; break; }
      }
      fn = test
        ? function (pos) {
            var cur = pos._secNorm || normSecName(pos.section || pos.unit || '');
            return test(cur);
          }
        : function () { return false; };
    } else {
      var sel = findSectionById(sectionId);
      var pref = sel ? (sel.norm || normSecName(sel.name)) : '';
      var sid = sectionId;
      fn = function (pos) {
        if (pos.sectionId === sid) return true;
        if (!pref) return false;
        var cur = pos._secNorm || normSecName(pos.section || pos.unit || '');
        if (cur === pref || nameIsChildOf(cur, pref)) return true;
        var alias = aliasParentNorm(cur);
        return !!(alias && alias === pref);
      };
    }
    view.matchId = sectionId;
    view.matchFn = fn;
    return fn;
  }
  function sectionMatchesSelection(pos, sectionId) {
    return selectionMatchFn(sectionId)(pos);
  }

  function esc(s) {
    return typeof window.esc === 'function'
      ? window.esc(s)
      : String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
        });
  }
  var PERSONNEL_TITLE = 'Անձնակազմ և Պաշտոն';
  var hubTab = 'people';

  function canEditPersonnel() {
    if (window.kmUserRole === 'viewer') return false;
    if (window.kmUserRole === 'admin') return true;
    if (typeof window.kmIsAppAdmin === 'function' && window.kmIsAppAdmin()) return true;
    try { if (sessionStorage.getItem('km_auth_mode') === 'admin') return true; } catch (eA) {}
    if (typeof window.kmIsOrgAdmin === 'function' && window.kmIsOrgAdmin()) return true;
    if (typeof window.kmCanEditPersonnelOp === 'function' && window.kmCanEditPersonnelOp('card')) return true;
    if (typeof window.kmCanEditPage === 'function') {
      return !!(window.kmCanEditPage('people') || window.kmCanEditPage('positions') || window.kmCanEditPage('unitDossiers') || window.kmCanEditPage('troopStructure') || window.kmCanEditPage('accounting'));
    }
    if (typeof window.kmCanEdit === 'function') {
      return !!(window.kmCanEdit('people') || window.kmCanEdit('positions') || window.kmCanEdit('unitDossiers') || window.kmCanEdit('troopStructure') || window.kmCanEdit('accounting'));
    }
    return window.kmUserRole !== 'viewer';
  }
  function canEdit() {
    return canEditPersonnel();
  }

  function personnelTabsHtml(active) {
    return '<div class="kmPersTabs" role="tablist">' +
      '<button type="button" class="kmPersTab' + (active === 'people' ? ' active' : '') + '" data-km-pers-tab="people">Անձնակազմ</button>' +
      '<button type="button" class="kmPersTab' + (active === 'positions' ? ' active' : '') + '" data-km-pers-tab="positions">Պաշտոն</button>' +
      '</div>';
  }

  function personnelShellStart(active) {
    /* KM_ADMIN_HOME_ORG_PICK_V1: picker on landing only */
    return '<div class="card" id="kmPersonnelHub">' +
      (typeof window.kmBackToolbar === 'function' ? window.kmBackToolbar("kmReportsBack()") : '') +
      '<div style="margin-bottom:8px"><h3 style="margin:0">' + PERSONNEL_TITLE + '</h3></div>' +
      personnelTabsHtml(active);
  }

  function bindPersonnelHubExtras(host) {
    if (!host) return;
    bindPersonnelTabs(host.querySelector('#kmPersonnelHub') || host);
    /* KM_ADMIN_HOME_ORG_PICK_V1: no in-page org picker bind */
  }

  function bindPersonnelTabs(root) {
    if (!root || root.__kmPersTabs) return;
    root.__kmPersTabs = true;
    root.addEventListener('click', function (ev) {
      var t = ev.target;
      var tabBtn = t && t.closest && t.closest('[data-km-pers-tab]');
      if (!tabBtn) return;
      ev.preventDefault();
      window.kmOpenPersonnelHub({ tab: tabBtn.getAttribute('data-km-pers-tab') || 'people' });
    });
  }

  function setPersonnelPage(tab) {
    hubTab = tab === 'positions' ? 'positions' : 'people';
    page = hubTab;
    window.page = hubTab;
    var pt = document.getElementById('pageTitle');
    if (pt) pt.textContent = PERSONNEL_TITLE;
  }
  function toastMsg(m, t) {
    if (typeof toast === 'function') toast(m, t);
  }
  function shtatCatalog() {
    /* KM_UNIFIED_ARCHIVE_FLOW_V2_STAFF_CAT */
    try {
      if (window.kmUnitArchiveStaffSource && window.kmUnitArchiveStaffSource.hasFormal &&
          window.kmUnitArchiveStaffSource.hasFormal()) {
        return { title: "Պաշտոն", sections: [], positions: [], source: "Զորամասի Արխիվ" };
      }
    } catch (eSC) {}
    return window.KM_SHTAT_CATALOG || { title: "Պաշտոն", sections: [], positions: [], source: '' };
  }
  /** Աշխատանքային ցուցակ՝ ձեռքով ավելացված պաշտոններ (Բոլորը սկզբում դատարկ է) */
  function catalog() {
    /* KM_PURE_ACTIVE_NO_ARCHIVE_V1_POS_GATE_CATALOG */
    if (false /* KM_NO_ARCHIVES disabled */) {
      ensureStore();
      return { title: 'Պաշտոն', source: 'active', sections: [], positions: [] };
    }
    /* KM_ARCHIVE_STRICT_SOURCE_V3_POS catalog: formal Unit Archive exclusive when present */
    ensureStore();
    if (typeof window.kmUnitHasStaffSource === 'function' ? !window.kmUnitHasStaffSource() : (typeof window.kmUnitHasExcelArchive === 'function' && !window.kmUnitHasExcelArchive())) {
      return { title: 'Պաշտոն', source: '', sections: [], positions: [] };
    }
    var uid = currentArchiveUnitId();
    var cid = currentArchiveCorpsId();
    var positions = [];
    var useFormal = false;
    try {
      useFormal = !!(window.kmUnitArchiveStaffSource && window.kmUnitArchiveStaffSource.hasFormal &&
        window.kmUnitArchiveStaffSource.hasFormal(uid) &&
        (window.kmUnitArchiveStaffSource.rows(uid) || []).some(function (r) { return r && r.type !== 'section'; }));
    } catch (eF) { useFormal = false; }

    if (!cid || !uid) {
      positions = [];
    } else if (useFormal) {
      try {
        var seenPost = Object.create(null);
        var vi = 0;
        (allArchiveRows(uid) || []).forEach(function (r) {
          if (!r || r.type === 'section') return;
          if (!(r.position || r.code)) return;
          var pk = positionPostKey(r);
          if (pk && pk !== 'post|||' && seenPost[pk] != null) {
            var prev = positions[seenPost[pk]];
            var nNew = personDisplayName(r);
            var nPrev = String((prev && prev.personName) || '').trim();
            if (nNew && !nPrev) {
              prev.personName = nNew;
              prev.vacant = false;
              prev.rankSlot = r.rankSlot || r.rank || prev.rankSlot || '';
              prev.rank = r.rank || prev.rank || '';
            }
            return;
          }
          if (pk && pk !== 'post|||') seenPost[pk] = positions.length;
          positions.push({
            id: 'archv_' + String(r.archId || uid) + '_' + (vi++),
            section: r.unit || r.section || '',
            unit: r.unit || r.section || '',
            position: r.position || '',
            code: r.code || '',
            personName: personDisplayName(r),
            rankSlot: r.rankSlot || r.rank || '',
            rank: r.rank || r.rankSlot || '',
            orgUnitId: uid,
            corpsId: cid,
            fromArchive: true,
            fromFormal: true,
            virtual: true,
            seq: r.seq || ''
          });
        });
      } catch (eVirt) { positions = []; }
    } else {
      positions = (typeof db !== 'undefined' && Array.isArray(db.userPositions)) ? db.userPositions : [];
      positions = positions.filter(function (p) {
        var pu = String((p && p.orgUnitId) || '').trim();
        var pc = String((p && p.corpsId) || '').trim();
        if (pc && pc !== cid) return false;
        if (pu && pu !== uid) return false;
        return !pu || pu === uid;
      });
      if (!positions.length) {
        try {
          var seenPost2 = Object.create(null);
          var vi2 = 0;
          (allArchiveRows(uid) || []).forEach(function (r) {
            if (!r || r.type === 'section') return;
            if (!(r.position || r.code)) return;
            var pk2 = positionPostKey(r);
            if (pk2 && pk2 !== 'post|||' && seenPost2[pk2] != null) {
              var prev2 = positions[seenPost2[pk2]];
              var nNew2 = personDisplayName(r);
              var nPrev2 = String((prev2 && prev2.personName) || '').trim();
              if (nNew2 && !nPrev2) {
                prev2.personName = nNew2;
                prev2.vacant = false;
                prev2.rankSlot = r.rankSlot || r.rank || prev2.rankSlot || '';
              }
              return;
            }
            if (pk2 && pk2 !== 'post|||') seenPost2[pk2] = positions.length;
            positions.push({
              id: 'archv_' + String(r.archId || uid) + '_' + (vi2++),
              section: r.unit || r.section || '',
              unit: r.unit || r.section || '',
              position: r.position || '',
              code: r.code || '',
              personName: personDisplayName(r),
              rankSlot: r.rankSlot || r.rank || '',
              orgUnitId: uid,
              corpsId: cid,
              fromArchive: true,
              virtual: true,
              seq: r.seq || ''
            });
          });
        } catch (eVirt2) {}
      }
    }
    var sectionIndex = Object.create(null);
    var sections = [];
    positions.forEach(function (pos, i) {
      if (!pos || typeof pos !== 'object') return;
      if (!pos.id) pos.id = 'up_' + Date.now() + '_' + i + '_' + Math.random().toString(36).slice(2, 7);
      var rawName = String(pos.section || '').trim() || 'Այլ';
      var key = normSecName(rawName) || rawName;
      if (sectionIndex[key] == null) {
        sectionIndex[key] = sections.length;
        sections.push({ id: 'us' + sections.length, name: rawName, norm: key, order: sections.length });
      } else {
        var prevS = sections[sectionIndex[key]];
        if (prevS && rawName.length < String(prevS.name || '').length) prevS.name = rawName;
      }
      pos.sectionId = sections[sectionIndex[key]].id;
      pos._secNorm = key;
      if (pos.order == null) pos.order = i + 1;
      if (pos.code == null) pos.code = '';
      if (pos.vacant == null) pos.vacant = !String(pos.personName || '').trim();
    });
    return {
      title: 'Պաշտոն',
      source: useFormal ? 'Զորամասի Արխիվ' : 'Ձեռքով',
      sections: sections,
      positions: positions
    };
  }
  function ensureStore() {
    if (typeof db === 'undefined') return;
    if (!db.positionAssignments || typeof db.positionAssignments !== 'object' || Array.isArray(db.positionAssignments)) {
      db.positionAssignments = {};
    }
    if (!Array.isArray(db.userPositions)) db.userPositions = [];
    if (!Array.isArray(db.positionArchives)) db.positionArchives = [];
    if (!db.peopleRemoved || typeof db.peopleRemoved !== 'object' || Array.isArray(db.peopleRemoved)) db.peopleRemoved = {};
    db.positionArchives = db.positionArchives.filter(function (a) { return a && !a.builtin; });
  }
  function peopleRemovedKey(name) {
    return String(name || '').trim().toLowerCase();
  }
  function markPeopleRemoved(name, reason) {
    ensureStore();
    name = String(name || '').trim();
    if (!name) return;
    db.peopleRemoved[peopleRemovedKey(name)] = {
      name: name,
      at: new Date().toISOString(),
      reason: reason || 'remove'
    };
  }
  function clearPeopleRemoved(name) {
    ensureStore();
    name = String(name || '').trim();
    if (!name) return;
    delete db.peopleRemoved[peopleRemovedKey(name)];
  }
  function isPeopleRemoved(name) {
    ensureStore();
    name = String(name || '').trim();
    if (!name) return false;
    return !!db.peopleRemoved[peopleRemovedKey(name)];
  }
  function assignmentIsLiveEdit(asg) {
    return !!(asg && (asg.vacant || asg.manual || asg.userEdited || asg.clearedAt));
  }
  function decodeXmlText(s) {
    return String(s || '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  }
  var STAFF_KEYS = [
    'unit', 'position', 'seq', 'secret', 'vus', 'code', 'rankSlot', 'rank', 'name',
    'posOrder', 'rankOrder', 'contract', 'special', 'contact', 'birth', 'zk', 'address',
    'serviceYear', 'discipline', 'serviceTotal', 'lastAccept', 'idCard', 'blood', 'caseNo',
    'vacation', 'hsk', 'passport', 'family', 'education', 'mandatory', 'voluntary',
    'resubmit', 'nonCombat', 'retrain', 'record', 'attestPeriod', 'attestMarch',
    'attestPhys', 'attestFire', 'attestProf', 'attestTotal', 'medal', 'amb1', 'amb2',
    'amb3', 'amb4', 'caseBrief'
  ];
  var STAFF_COLS = (function () {
    var letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    return letters.concat(letters.map(function (c) { return 'A' + c; })).slice(0, STAFF_KEYS.length);
  })();
  var STAFF_COL_INDEX = {};
  STAFF_COLS.forEach(function (c, i) { STAFF_COL_INDEX[c] = i; });
  function looksLikeStaffCode(s) {
    var t = String(s == null ? '' : s).replace(/\s+/g, '').trim();
    if (!t) return false;
    return /^\d{1,4}([.\-]\d{1,4})?$/.test(t);
  }
  window.kmLooksLikeStaffCode = looksLikeStaffCode;
  function looksLikeLegalOrderText(s) {
    var t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    if (!t) return false;
    if (/հրաման/i.test(t) && (/\bN\s*\d+|№\s*\d+|առ\s+\d{1,2}[./]\d{1,2}[./]\d{2,4}|ՀՀ\s*ԶՈՒ|առաջնորդ/i.test(t) || t.length > 28)) return true;
    if (/^ՀՀ\s*ԶՈՒ/.test(t) && t.length > 20) return true;
    if (/հոգևոր\s+առաջնորդ/i.test(t)) return true;
    if (/\d{1,2}[./]\d{1,2}[./]\d{2,4}/.test(t) && /հրաման|приказ|№|\bN\s*\d+/i.test(t)) return true;
    return false;
  }
  window.kmLooksLikeLegalOrderText = looksLikeLegalOrderText;
  function looksLikePersonName(s) {
    var t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    if (t.length < 2) return false;
    if (/^[\d.\-\/]+$/.test(t)) return false;
    if (looksLikeStaffCode(t)) return false;
    if (looksLikeLegalOrderText(t)) return false;
    if (/Ա\.?\s*Ա\.?\s*Հ|հաստիք|ստորաբաժան|պաշտոնի կոդ|^կոդ$|^կոչում$/i.test(t) && t.length < 28) return false;
    if (!/\s/.test(t) && t.length <= 10 && /[-\/]/.test(t)) return false;
    var k = t.toLowerCase();
    if (k === 'օգտատեր' || k === 'ադմինիստրատոր' || k === 'user' || k === 'пользователь' || k === 'admin' || k === 'administrator') return false;
    if (typeof window.kmPersonNameIsLoginStub === 'function' && window.kmPersonNameIsLoginStub(t)) return false;
    return /[Ա-Ֆա-ֆЁёА-Яа-яA-Za-z]/.test(t);
  }
  window.kmLooksLikePersonName = looksLikePersonName;
  function specialtyFromArchiveRow(r, code) {
    if (!r) return '';
    var vus = String(r.vus || '').trim();
    var spec = String(r.specialty || '').trim();
    var c = String(code || r.code || '').trim();
    var out = vus || '';
    if (c && out && out === c) out = '';
    if (looksLikeStaffCode(out)) out = '';
    if (!out && spec && !(c && spec === c) && !looksLikeStaffCode(spec)) out = spec;
    if (c && out === c) return '';
    if (looksLikeStaffCode(out)) return '';
    return out;
  }
  window.kmSpecialtyFromArchiveRow = specialtyFromArchiveRow;
  function personDisplayName(r) {
    if (!r) return '';
    var cands = [r.sourceName, r.name, r.personName, r.fullName, r.person];
    var i, n;
    for (i = 0; i < cands.length; i++) {
      n = String(cands[i] == null ? '' : cands[i]).replace(/\s+/g, ' ').trim();
      if (!looksLikePersonName(n)) continue;
      if (typeof window.kmPersonNameIsLoginStub === 'function' && window.kmPersonNameIsLoginStub(n)) continue;
      return n;
    }
    return '';
  }
  function maybeRemapNameColumn(rows) {
    var sample = [];
    var i;
    for (i = 0; i < (rows || []).length && sample.length < 80; i++) {
      if (rows[i] && rows[i].type !== 'section') sample.push(rows[i]);
    }
    if (sample.length < 4) return rows;
    var counts = Object.create(null);
    STAFF_KEYS.forEach(function (k) { counts[k] = 0; });
    sample.forEach(function (r) {
      STAFF_KEYS.forEach(function (k) {
        if (looksLikePersonName(r[k])) counts[k]++;
      });
    });
    var best = 'name';
    var bestN = counts.name || 0;
    ['education', 'family', 'address', 'vus', 'contact', 'rank', 'rankSlot'].forEach(function (k) {
      if ((counts[k] || 0) > bestN) {
        best = k;
        bestN = counts[k];
      }
    });
    var minNeed = (counts.name || 0)
      ? Math.max(3, Math.floor(sample.length * 0.18))
      : Math.max(2, Math.floor(sample.length * 0.04));
    if (best === 'name' || bestN < minNeed) return rows;
    (rows || []).forEach(function (r) {
      if (!r || r.type === 'section') return;
      if (!looksLikePersonName(r.name) && looksLikePersonName(r[best])) {
        r.name = String(r[best]).trim();
        r.sourceName = r.name;
        if ((best === 'rank' || best === 'rankSlot') && looksLikePersonName(r.rank) && !looksLikePersonName(r.rankSlot)) {
          r.rank = r.rankSlot || r.rank;
        }
      }
    });
    return rows;
  }
  function maybeFixLegacyFiveCol(rows) {
    var namedI = 0;
    var namedE = 0;
    var n = 0;
    (rows || []).forEach(function (r) {
      if (!r || r.type === 'section') return;
      n++;
      if (looksLikePersonName(r.name || r.sourceName)) namedI++;
      if (looksLikePersonName(r.vus)) namedE++;
    });
    if (!(n && namedI < Math.max(2, n * 0.1) && namedE > namedI && namedE >= Math.max(2, n * 0.2))) return rows;
    (rows || []).forEach(function (r) {
      if (!r || r.type === 'section') return;
      if (!looksLikePersonName(r.name) && looksLikePersonName(r.vus)) {
        r.name = r.vus;
        r.sourceName = r.vus;
        r.vus = '';
      }
    });
    return rows;
  }
  function isStaffSectionTitle(text) {
    var t = String(text || '').trim();
    if (t.length < 3) return false;
    if (!/[Ա-ՖA-Z]/.test(t)) return false;
    if (/[ա-ֆa-z]/.test(t)) return false;
    return /^[Ա-ՖA-Z0-9\s\/\-\.\,«»\(\)]+$/.test(t);
  }
  function bytesToBase64(bytes) {
    var chunk = 0x8000;
    var b64 = '';
    for (var i = 0; i < bytes.length; i += chunk) {
      b64 += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(b64);
  }
  function ensureJsZip() {
    return Promise.resolve().then(function () {
      if (window.JSZip) return window.JSZip;
      if (typeof window.needZip === 'function') {
        return window.needZip().then(function () { return window.JSZip; });
      }
      if (typeof window.loadLib === 'function') {
        return window.loadLib('vendor/jszip.min.js', 'JSZip').then(function () { return window.JSZip; });
      }
      return new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = 'vendor/jszip.min.js';
        s.onload = function () { resolve(window.JSZip); };
        s.onerror = function () { reject(new Error('JSZip load fail')); };
        (document.head || document.documentElement).appendChild(s);
      });
    }).then(function (Zip) {
      if (!Zip) throw new Error('JSZip չկա');
      return Zip;
    });
  }
  var HEADER_HINTS = [
    { key: 'rankSlot', re: /կոչումը\s*ըստ\s*հաստիքի|по\s*штат/i },
    { key: 'posOrder', re: /նշանակման\s*հրաման|приказ.*назнач/i },
    { key: 'vus', re: /զհմ|вус|\bvus\b|մասնագիտ/i },
    { key: 'code', re: /հաստիքի\s*կոդ|պաշտոնի\s*կոդ|^(կոդ|код)$/i },
    { key: 'name', re: /ա\.?\s*ա\.?\s*հ|ազգանուն|фио|\baah\b/i },
    { key: 'unit', re: /ստորաբաժան|подраздел/i },
    { key: 'position', re: /^պաշտոն$|^должность$/i },
    { key: 'seq', re: /հ\s*\/\s*հ|^№$|^n\/n/i },
    { key: 'secret', re: /գաղտնի/i },
    { key: 'rank', re: /^կոչում$|^звание$/i },
    { key: 'contact', re: /կոնտակտ|հեռախոս|телефон/i },
    { key: 'education', re: /կրթութ/i },
    { key: 'family', re: /ընտանիք/i },
    { key: 'address', re: /հասցե/i }
  ];
  function matchStaffHeader(text) {
    var t = String(text || '').replace(/\s+/g, ' ').trim();
    if (!t || t.length > 80) return '';
    var i;
    for (i = 0; i < HEADER_HINTS.length; i++) {
      if (HEADER_HINTS[i].re.test(t)) return HEADER_HINTS[i].key;
    }
    return '';
  }
  function isHeaderValsRow(vals) {
    var blob = (vals || []).slice(0, 12).join(' ');
    var n = 0;
    (vals || []).slice(0, 16).forEach(function (v) { if (matchStaffHeader(v)) n++; });
    if (n >= 3) return true;
    return /Ա\.?\s*Ա\.?\s*Հ|ստորաբաժան|հաստիքի կոդ|զհմ|вус/i.test(blob);
  }
  function detectColMap(headerRows) {
    var map = [];
    var i;
    for (i = 0; i < STAFF_KEYS.length; i++) map[i] = i;
    var found = 0;
    (headerRows || []).forEach(function (vals) {
      var col;
      for (col = 0; col < (vals || []).length; col++) {
        var key = matchStaffHeader(vals[col]);
        if (!key) continue;
        var ki = STAFF_KEYS.indexOf(key);
        if (ki < 0) continue;
        map[ki] = col;
        found++;
      }
    });
    return found >= 3 ? map : null;
  }
  function remapValsByMap(vals, colMap) {
    if (!colMap) return vals;
    var out = new Array(STAFF_KEYS.length);
    var i;
    for (i = 0; i < STAFF_KEYS.length; i++) {
      var src = colMap[i];
      out[i] = (src != null && vals[src] != null) ? vals[src] : '';
    }
    return out;
  }
  function scoreStaffParse(rows) {
    var names = 0;
    var posts = 0;
    var codes = 0;
    (rows || []).forEach(function (r) {
      if (!r || r.type === 'section') return;
      if (personDisplayName(r) || looksLikePersonName(r.name)) names++;
      if (String(r.position || '').trim()) posts++;
      if (String(r.code || '').trim()) codes++;
    });
    return names * 12 + posts + (codes ? 8 : 0) + (rows && rows.length ? 1 : 0);
  }
  function parseStaffSheetXml(sheet, cellValueFn) {
    var autoFilter = '';
    var afm = sheet.match(/<autoFilter ref="([^"]+)"/);
    if (afm) autoFilter = afm[1];
    var raw = [];
    var title = '';
    var emptyStreak = 0;
    var rowRe = /<row[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
    var rm;
    while ((rm = rowRe.exec(sheet))) {
      var rnum = Number(rm[1]);
      if (rnum > 2200) break;
      var cellMap = {};
      var cRe = /<c[^>]*\br="([^"]+)"[^>]*(?:\/>|>([\s\S]*?)<\/c>)/g;
      var cm;
      while ((cm = cRe.exec(rm[2]))) {
        cellMap[cm[1]] = String(cellValueFn(cm[0]) || '').trim();
      }
      var vals = new Array(STAFF_KEYS.length);
      var vi;
      for (vi = 0; vi < STAFF_KEYS.length; vi++) vals[vi] = '';
      var any = false;
      Object.keys(cellMap).forEach(function (ref) {
        var letters = (String(ref).match(/^([A-Z]+)/i) || [])[1];
        if (!letters) return;
        var idx = STAFF_COL_INDEX[letters.toUpperCase()];
        if (idx == null) return;
        var val = cellMap[ref];
        if (val) { vals[idx] = val; any = true; }
      });
      if (!any) {
        emptyStreak++;
        if (rnum > 50 && emptyStreak >= 40) break;
        continue;
      }
      emptyStreak = 0;
      raw.push({ rnum: rnum, vals: vals });
    }
    var headerRows = [];
    raw.forEach(function (item) {
      if (item.rnum <= 12 && isHeaderValsRow(item.vals)) headerRows.push(item.vals);
    });
    var colMap = detectColMap(headerRows);
    var rows = [];
    raw.forEach(function (item) {
      var rnum = item.rnum;
      var vals = remapValsByMap(item.vals, colMap);
      if (rnum === 1) {
        for (var ti = 0; ti < vals.length; ti++) {
          if (vals[ti] && vals[ti].length > 5 && !matchStaffHeader(vals[ti])) { title = vals[ti]; break; }
        }
      }
      if (isHeaderValsRow(vals) && rnum <= 12) return;
      var unit = vals[0];
      var position = vals[1];
      var name = vals[8];
      if (unit && !position && !name && isStaffSectionTitle(unit)) {
        rows.push({ type: 'section', unit: unit, excelRow: rnum });
        return;
      }
      if (!position && !name && !unit) return;
      if (position === 'Պաշտոն' || unit === 'Ստորաբաժանում') return;
      var row = { type: 'row', excelRow: rnum };
      for (var vi2 = 0; vi2 < STAFF_KEYS.length; vi2++) {
        if (vals[vi2]) row[STAFF_KEYS[vi2]] = vals[vi2];
      }
      if (row.vus && row.code && String(row.vus).trim() === String(row.code).trim()) {
        /* keep code; VUS identical to Կոդ is almost always a column bleed */
        row.vus = '';
      }
      row.unit = row.unit || '';
      row.position = row.position || '';
      row.name = row.name || '';
      row.sourceName = row.name;
      rows.push(row);
    });
    maybeFixLegacyFiveCol(rows);
    maybeRemapNameColumn(rows);
    rows._autoFilter = autoFilter || 'A2:AU1899';
    rows._title = title;
    rows._shtatCols = 'A-AU';
    return rows;
  }
  function kmStripArchiveXlsxBlob(a) {
    /* KM_NO_XLSX_STORE_V1 */
    if (!a || typeof a !== 'object') return a;
    if (a.base64) a.base64 = '';
    if (/spreadsheetml|\.xlsx/i.test(String(a.mime || ''))) a.mime = 'application/x-km-unit-archive+json';
    if (typeof a.name === 'string') {
      /* KM_SANITIZE_LEGACY_EXCEL_NAME_ON_READ_V3: any archive item whose stored name still ends
         in .xlsx/.xls came from the old Excel import path (regardless of its original filename)
         and is renamed to the standard Unit Archive label. */
      if (/\.xlsx?$/i.test(a.name)) a.name = 'Զորամասի հաստիքային արխիվ';
      else a.name = a.name.replace(/\.xlsx?$/i, '');
    }
    return a;
  }
  function parseLegacyExcelBuffer() {
    /* KM_UNIFIED_ARCHIVE_FLOW_V1_IMPORT_REDIR */
    try {
      if (typeof toastMsg === 'function') toastMsg("Excel ներմուծումն անջատված է։ Օգտագործեք Զորամասի արխիվը։", 'warn');
      if (typeof window.kmOpenUnitArchive === 'function') window.kmOpenUnitArchive();
      else if (typeof window.kmOpenPage === 'function') window.kmOpenPage('unitArchive');
    } catch (eIR) {}
    return Promise.resolve([]);
  }
  function base64ToArrayBuffer(b64) {
    var bin = atob(String(b64 || ''));
    var out = new Uint8Array(bin.length);
    var i;
    for (i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
  }
  function archiveNeedsReparse(a) {
    if (!a || a.builtin || !a.base64) return false;
    if (a._shtatUserEdited) return false;
    var rows = a.rows || [];
    if (!rows.length) return true;
    var sample = rows.filter(function (r) { return r && r.type !== 'section'; }).slice(0, 20);
    if (!sample.length) return true;
    var withPerson = 0;
    var codeLike = 0;
    var fullRow = 0;
    sample.forEach(function (r) {
      var n = String(r.sourceName || r.name || '').trim();
      if (looksLikePersonName(n)) withPerson++;
      else if (n) codeLike++;
      if (r.vus || r.birth || r.education || r.idCard || r.passport || r.seq || r.contact) fullRow++;
    });
    var specBleed = 0;
    sample.forEach(function (r) {
      var c = String(r.code || '').trim();
      var v = String(r.vus || r.specialty || '').trim();
      if (c && v && c === v) specBleed++;
    });
    if (specBleed >= Math.max(3, Math.floor(sample.length * 0.3))) return true;
    if (withPerson < Math.max(2, Math.floor(sample.length * 0.2))) return true;
    if (a._shtatCols === 'A-AU' && withPerson >= codeLike) return false;
    if (fullRow >= 2 && withPerson >= codeLike) return false;
    return codeLike > withPerson || !withPerson;
  }
  function remapUserPositionsFromArchive(unitId) {
    ensureStore();
    var byKey = Object.create(null);
    allArchiveRows(unitId).forEach(function (r) {
      if (!r || r.type === 'section') return;
      var k = [
        normSecName(r.unit || r.section),
        String(r.position || '').replace(/\s+/g, ' ').trim().toLowerCase(),
        String(r.code == null ? '' : r.code).replace(/\s+/g, '').trim().toLowerCase(),
        String(r.seq || '').trim()
      ].join('|');
      byKey[k] = r;
    });
    var n = 0;
    (db.userPositions || []).forEach(function (p) {
      if (!p) return;
      var k = [
        normSecName(p.section || p.unit),
        String(p.position || '').replace(/\s+/g, ' ').trim().toLowerCase(),
        String(p.code == null ? '' : p.code).replace(/\s+/g, '').trim().toLowerCase(),
        String(p.seq || '').trim()
      ].join('|');
      var r = byKey[k];
      var asg = db.positionAssignments && db.positionAssignments[p.id];
      if (assignmentIsLiveEdit(asg) || p.userEdited) return;
      var name = r ? personDisplayName(r) : '';
      if (name && isPeopleRemoved(name)) {
        persistLivePositionPerson(p, '', { previousName: name });
        n++;
        return;
      }
      if (name) {
        if (p.personName !== name) n++;
        p.personName = name;
        p.sourceName = name;
        p.vacant = false;
        if (asg && !assignmentIsLiveEdit(asg)) {
          asg.personName = name;
          asg.vacant = false;
        }
      } else if (p.personName && !looksLikePersonName(p.personName)) {
        p.personName = '';
        p.vacant = true;
        n++;
        if (db.positionAssignments && db.positionAssignments[p.id] && !db.positionAssignments[p.id].manual) {
          db.positionAssignments[p.id].personName = '';
          db.positionAssignments[p.id].vacant = true;
        }
      }
    });
    return n;
  }
  function scrubCodeLikePeople() {
    if (typeof db === 'undefined' || !Array.isArray(db.people)) return 0;
    var n = 0;
    db.people = db.people.filter(function (p) {
      if (!p) return false;
      if (looksLikePersonName(p.name)) return true;
      n++;
      return false;
    });
    return n;
  }
  window.kmRefreshArchivesFromExcel = async function () {
    /* KM_UNIFIED_ARCHIVE_FLOW_V1_REFRESH — redirect Excel refresh to Unit Archive */
    try {
      if (typeof window.kmOpenUnitArchive === 'function') window.kmOpenUnitArchive();
      else if (typeof window.kmOpenPage === 'function') window.kmOpenPage('unitArchive');
    } catch (eR) {}
    return 0;
  };
  function currentOrgCtx() {
    return typeof window.kmGetOrgContext === 'function' ? window.kmGetOrgContext() : null;
  }
  function currentArchiveUnitId() {
    var forced = String(window._kmArchiveForUnitId || '').trim();
    if (forced) return forced;
    var ctx = currentOrgCtx();
    return String((ctx && ctx.unitId) || '').trim();
  }
  function currentArchiveUnitName() {
    var ctx = currentOrgCtx();
    return String((ctx && ctx.unitName) || '').trim();
  }
  function currentArchiveCorpsId() {
    var forced = String(window._kmArchiveForCorpsId || '').trim();
    if (forced) return forced;
    var ctx = currentOrgCtx();
    return String((ctx && ctx.corpsId) || '').trim();
  }
  function archiveStamp(a) {
    var t = String((a && (a.updatedAt || a.addedAt)) || '');
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) t += 'T00:00:00.000Z';
    var rows = ((a && a.rows) || []).length;
    var b = String((a && a.base64) || '').length;
    return t + '|' + String(1000000 + rows) + '|' + String(100000000 + b) + '|' + String((a && a.id) || '');
  }
  function collapseToLatestPerUnit(list) {
    var best = Object.create(null);
    var builtin = [];
    (list || []).forEach(function (a) {
      if (!a) return;
      if (a.builtin) { builtin.push(a); return; }
      var u = String(a.unitId || '').trim() || '_none';
      var c = String(a.corpsId || '').trim();
      var g = c + '::' + u;
      var prev = best[g];
      if (!prev || archiveStamp(a) > archiveStamp(prev)) best[g] = a;
    });
    var out = builtin.slice();
    Object.keys(best).forEach(function (g) { out.push(best[g]); });
    return out;
  }
  
  /* KM_UNIFIED_ARCHIVE_FLOW_V1_POS */
  function kmPurgeLegacyExcelArchives() {
    ensureStore();
    function kill(list) {
      /* KM_UNIFIED_ARCHIVE_FLOW_V1: unconditionally drop all positionArchives Excel staff
         sources — Unit Archive (korpusId/unitId) is the sole source now, so nothing here is
         ever kept regardless of name. */
      return (list || []).filter(function (a) {
        return false;
      });
    }
    var before = (db.positionArchives || []).length;
    db.positionArchives = kill(db.positionArchives);
    try {
      var cd = db.kmCorpsData;
      if (cd && typeof cd === 'object') {
        Object.keys(cd).forEach(function (k) {
          if (cd[k] && Array.isArray(cd[k].positionArchives)) cd[k].positionArchives = kill(cd[k].positionArchives);
        });
      }
    } catch (eCd) {}
    if (before !== (db.positionArchives || []).length) {
      try { _archRowsCache = { key: '', rows: null }; } catch (eC) {}
      try { _rosterCache = { key: '', list: null }; } catch (eR) {}
    }
    return before;
  }
  window.kmPurgeLegacyExcelArchives = kmPurgeLegacyExcelArchives;

  function purgeDuplicateUnitArchives() {
    ensureStore();
    var before = (db.positionArchives || []).length;
    db.positionArchives = collapseToLatestPerUnit(db.positionArchives);
    try {
      var cd = db.kmCorpsData;
      if (cd && typeof cd === 'object') {
        Object.keys(cd).forEach(function (k) {
          if (cd[k] && Array.isArray(cd[k].positionArchives)) {
            cd[k].positionArchives = collapseToLatestPerUnit(cd[k].positionArchives);
          }
        });
      }
    } catch (eCd) {}
    var after = (db.positionArchives || []).length;
    if (after !== before) {
      _archRowsCache = { key: '', rows: null };
      _rosterCache = { key: '', list: null };
    }
    return Math.max(0, before - after);
  }
  window.kmPurgeDuplicateUnitArchives = purgeDuplicateUnitArchives;
  function replaceUnitExcelArchive(entry) {
    /* KM_UNIFIED_ARCHIVE_FLOW_V1_REDIR */
    try { if (typeof toastMsg === 'function') toastMsg('Excel ներմուծումն անջատված է։ Բացեք Զորամասի արխիվ բաժինը։', 'warn'); } catch (eT) {}
    try { if (typeof window.kmOpenPage === 'function') window.kmOpenPage('unitArchive'); } catch (eO) {}
    return;

    ensureStore();
    if (!entry) return;
    /* KM_NO_XLSX_STORE_V1 */
    try { kmStripArchiveXlsxBlob(entry); } catch (eStrip) {}
    var uid = String(entry.unitId || '').trim();
    var cid = String(entry.corpsId || '').trim();
    if (!Array.isArray(db.positionArchives)) db.positionArchives = [];
    db.positionArchives = (db.positionArchives || []).filter(function (a) {
      if (!a || a.builtin) return !!a;
      if (uid && String(a.unitId || '').trim() === uid) {
        if (!cid || !String(a.corpsId || '').trim() || String(a.corpsId).trim() === cid) return false;
      }
      return true;
    });
    db.positionArchives.push(entry);
    try {
      var cd = db.kmCorpsData;
      if (cd && typeof cd === 'object') {
        Object.keys(cd).forEach(function (k) {
          if (!cd[k] || !Array.isArray(cd[k].positionArchives)) return;
          cd[k].positionArchives = cd[k].positionArchives.filter(function (a) {
            if (!a || a.builtin) return !!a;
            if (uid && String(a.unitId || '').trim() === uid) {
              if (!cid || !String(a.corpsId || '').trim() || String(a.corpsId).trim() === cid) return false;
            }
            return true;
          });
        });
      }
    } catch (eR) {}
    purgeDuplicateUnitArchives();
  }
  /** Շտատկա Excel — ընտրված կորպուս + զորամաս, միայն վերջին ակտիվ ֆայլը */
  function unitArchives(unitId) {
    /* KM_UNIFIED_ARCHIVE_FLOW_V1_UNIT_ARCH — Excel positionArchives disabled; Unit Archive SSOT */
    ensureStore();
    return [];
  }
  var _archRowsCache = { key: '', rows: null };
  var _rosterCache = { key: '', list: null };
  var _rosterRemapTried = Object.create(null);
  function archiveRowsCacheKey(unitId) {
    var uid = unitId != null && String(unitId) !== '' ? String(unitId).trim() : currentArchiveUnitId();
    var cid = currentArchiveCorpsId();
    var list = db.positionArchives || [];
    var sig = String(list.length);
    var i;
    for (i = 0; i < list.length && i < 12; i++) {
      var a = list[i];
      sig += '|' + String((a && a.id) || '') + ':' + String(((a && a.rows) || []).length);
    }
    return cid + '::' + uid + '::' + sig;
  }
  function allArchiveRows(unitId) {
    /* KM_UNIFIED_ARCHIVE_FLOW_V1_ALL_ROWS — formal staff source only */
    try {
      if (window.kmUnitArchiveStaffSource && typeof window.kmUnitArchiveStaffSource.rows === 'function') {
        return window.kmUnitArchiveStaffSource.rows(unitId) || [];
      }
    } catch (eAR) {}
    return [];
  }
  window.kmAllPositionArchiveRows = function () {
    return allArchiveRows();
  };
  function findArchiveRow(person, hints) {
    hints = hints || {};
    var name = String((person && person.name) || hints.name || '').trim();
    var code = String((person && person.postCode) || hints.code || '').trim();
    var post = String((person && person.post) || hints.position || '').trim();
    var unit = String((person && person.unit) || hints.section || '').trim();
    var rows = allArchiveRows();
    var i, r;
    if (name) {
      var nameOnly = null;
      for (i = 0; i < rows.length; i++) {
        r = rows[i];
        if (!r.sourceName || !samePerson(r.sourceName, name)) continue;
        if (post && String(r.position || '').trim() === post) return r;
        if (!nameOnly) nameOnly = r;
      }
      if (nameOnly) return nameOnly;
    }
    if (code) {
      for (i = 0; i < rows.length; i++) {
        r = rows[i];
        if (String(r.code || '').trim() === code) return r;
      }
    }
    if (post) {
      for (i = 0; i < rows.length; i++) {
        r = rows[i];
        if (String(r.position || '').trim() !== post) continue;
        if (!unit || String(r.unit || '').trim() === unit) return r;
      }
    }
    return null;
  }
  /** Excel շտատկա՝ F կոդ, G կոչումը ըստ հաստիքի, H անձնական կոչում */
  function excelStaffFactsFromRow(r) {
    if (!r) return { code: '', rankSlot: '', rank: '', post: '', unit: '', vus: '', specialty: '', contact: '', education: '', posOrder: '', name: '' };
    var code = String(r.code || '').trim();
    return {
      code: code,
      rankSlot: String(r.rankSlot || '').trim(),
      rank: String(r.rank || '').trim(),
      post: String(r.position || r.post || '').trim(),
      unit: String(r.unit || r.section || '').trim(),
      vus: String(r.vus || '').trim(),
      specialty: specialtyFromArchiveRow(r, code),
      contact: String(r.contact || '').trim(),
      education: String(r.education || '').trim(),
      posOrder: String(r.posOrder || '').trim(),
      name: personDisplayName(r) || (looksLikePersonName(String(r.sourceName || r.name || '').trim()) ? String(r.sourceName || r.name || '').trim() : '')
    };
  }
  window.kmExcelStaffFactsForPerson = function (person, hints) {
    /* PC_ARCH_FACTS_IN_EXCEL_HELPER / KM_PERSON_CARD_ARCHIVE_FIELDS_V1 — prefer Unit Archive formal facts */
    hints = hints || {};
    try {
      if (window.kmUnitArchiveStaffSource && typeof window.kmUnitArchiveStaffSource.factsForPerson === 'function') {
        var af = window.kmUnitArchiveStaffSource.factsForPerson(person || hints.name, hints.unitId);
        if (af && af.found) {
          return {
            code: af.postCode || af.code || '',
            post: af.post || '',
            unit: af.section || af.unit || '',
            section: af.section || af.unit || '',
            rankSlot: af.rankSlot || '',
            rank: af.rank || '',
            specialty: af.specialty || '',
            vus: af.vus || '',
            posOrder: af.posOrder || '',
            fromFormal: true
          };
        }
      }
    } catch (eAF) {}
    var facts = excelStaffFactsFromRow(findArchiveRow(person, hints));
    var name = String((person && person.name) || hints.name || '').trim();
    function fillMissing(src) {
      if (!src) return;
      if (!facts.code && src.code) facts.code = String(src.code).trim();
      if (!facts.rankSlot && src.rankSlot) facts.rankSlot = String(src.rankSlot).trim();
      if (!facts.rank && src.rank && src.rank !== src.rankSlot) facts.rank = String(src.rank).trim();
      else if (!facts.rank && src.rank && !src.rankSlot) facts.rank = String(src.rank).trim();
      if (!facts.post && (src.position || src.post)) facts.post = String(src.position || src.post).trim();
      if (!facts.unit && (src.unit || src.section)) facts.unit = String(src.unit || src.section).trim();
      if (!facts.vus && src.vus) facts.vus = String(src.vus).trim();
      if (!facts.specialty) facts.specialty = specialtyFromArchiveRow(src, facts.code);
      if (!facts.contact && src.contact) facts.contact = String(src.contact).trim();
      if (!facts.education && src.education) facts.education = String(src.education).trim();
      if (!facts.posOrder && src.posOrder) facts.posOrder = String(src.posOrder).trim();
    }
    if (name && (!facts.code || !facts.rankSlot || !facts.rank)) {
      try {
        var tRows = ((((typeof db !== 'undefined' && db.troopStructure) || {}).staff) || {}).rows || [];
        for (var ti = 0; ti < tRows.length; ti++) {
          if (tRows[ti] && samePerson(tRows[ti].name, name)) { fillMissing(tRows[ti]); break; }
        }
      } catch (eT) {}
      try {
        (db.userPositions || []).forEach(function (pos) {
          if (pos && samePerson(resolvePositionPerson(pos), name)) fillMissing(pos);
        });
      } catch (eU) {}
    }
    return facts;
  };
  function applyExcelFactsToPerson(p, facts) {
    if (!p || !facts) return false;
    var changed = false;
    if (facts.code) {
      if (p.postCode !== facts.code) { p.postCode = facts.code; changed = true; }
      if (p.posCode !== facts.code) { p.posCode = facts.code; changed = true; }
    }
    if (facts.rankSlot && p.rankSlot !== facts.rankSlot) {
      p.rankSlot = facts.rankSlot;
      changed = true;
    }
    if (facts.rank && p.rank !== facts.rank) {
      p.rank = facts.rank;
      changed = true;
    }
    if (facts.post) {
      if (p.post !== facts.post) { p.post = facts.post; changed = true; }
    }
    if (facts.unit) {
      if (p.unit !== facts.unit) { p.unit = facts.unit; changed = true; }
    }
    var spec = String(facts.specialty || '').trim();
    if (facts.code && spec === facts.code) spec = '';
    if (looksLikeStaffCode(spec)) spec = '';
    if (spec && String(p.specialty || '') !== spec) { p.specialty = spec; changed = true; }
    else if (looksLikeStaffCode(p.specialty) || (facts.code && String(p.specialty || '').trim() === String(facts.code).trim())) {
      p.specialty = '';
      changed = true;
    }
    if (facts.education && p.education !== facts.education) { p.education = facts.education; changed = true; }
    if (facts.posOrder && p.posOrder !== facts.posOrder) { p.posOrder = facts.posOrder; changed = true; }
    if (facts.contact && !String(p.phone || p.contact || '').trim()) {
      p.contact = facts.contact;
      p.phone = facts.contact;
      changed = true;
    }
    return changed;
  }
  /** Լրացնում է քարտի դաշտերը արխիվից (Զորամասի Արխիվ՝ F կոդ, E ԶՀՄ/մասնագիտություն, G հաստիքի կոչում, H կոչում) */
  window.kmApplyPositionArchiveToPerson = function (p, opts) {
    opts = opts || {};
    if (!p || typeof p !== 'object') return false;
    var nm = String(p.name || '').trim();
    if (!opts.force && isPeopleRemoved(nm)) return false;
    ensureStore();
    var facts = window.kmExcelStaffFactsForPerson(p, opts.hints);
    var row = findArchiveRow(p, opts.hints);
    if (!facts.code && !facts.rankSlot && !facts.rank && !row) return false;
    var changed = applyExcelFactsToPerson(p, facts);
    if (row) {
      if (row.unit && String(p.unit || '') !== String(row.unit)) { p.unit = row.unit; changed = true; }
      if (row.position && String(p.post || '') !== String(row.position)) { p.post = row.position; changed = true; }
      if (row.education) {
        var edu = String(row.education).trim();
        if (edu && String(p.education || '') !== edu) { p.education = edu; changed = true; }
      }
      var specRow = specialtyFromArchiveRow(row, facts.code || row.code);
      if (specRow && !looksLikeStaffCode(specRow)) {
        if (String(p.specialty || '') !== String(specRow)) { p.specialty = specRow; changed = true; }
      } else if (looksLikeStaffCode(p.specialty) || (p.specialty && facts.code && String(p.specialty).trim() === String(facts.code).trim())) {
        if (p.specialty) { p.specialty = ''; changed = true; }
      }
      if (row.contact && !String(p.phone || '').trim()) { p.phone = String(row.contact).trim(); changed = true; }
      if (row.posOrder) {
        var po = String(row.posOrder).trim();
        if (po && String(p.posOrder || '') !== po) { p.posOrder = po; changed = true; }
      }
    }
    if (typeof window.kmEnsurePersonProfile === 'function') window.kmEnsurePersonProfile(p);
    return changed;
  };
  function archiveRowCount(arch) {
    if (!arch) return 0;
    if (arch.builtin) return (shtatCatalog().positions || []).length;
    return (arch.rows || []).length;
  }
  function samePerson(a, b) {
    if (typeof window.kmVacationSamePerson === 'function') {
      try { return !!window.kmVacationSamePerson(a, b); } catch (e) {}
    }
    return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  }
  function findPersonIndex(name) {
    name = String(name || '').trim();
    if (!name || typeof db === 'undefined') return -1;
    var list = db.people || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i] && samePerson(list[i].name, name)) return i;
    }
    return -1;
  }
  function applyPosToPerson(p, pos, force) {
    if (!p || !pos) return;
    if (force || !p.post) p.post = pos.position || p.post || '';
    if (force || !p.unit) p.unit = pos.section || pos.unit || p.unit || '';
    if (pos.code != null && String(pos.code).trim()) {
      p.postCode = String(pos.code).trim();
      p.posCode = p.postCode;
    }
    if (pos.rankSlot) p.rankSlot = pos.rankSlot;
    if (typeof window.kmEnsurePersonProfile === 'function') window.kmEnsurePersonProfile(p);
    try {
      window.kmApplyPositionArchiveToPerson(p, {
        force: !!force,
        hints: {
          name: p.name,
          code: pos.code || p.postCode,
          position: pos.position || p.post,
          section: pos.section || pos.unit || p.unit
        }
      });
    } catch (eArch) {}
  }
  function ensurePersonFromName(name, pos, forceApply) {
    name = String(name || '').trim();
    if (!name) return -1;
    var idx = findPersonIndex(name);
    if (idx < 0 && isPeopleRemoved(name) && !forceApply) return -1;
    if (idx >= 0 || forceApply) clearPeopleRemoved(name);
    if (idx < 0) {
      if (!Array.isArray(db.people)) db.people = [];
      db.people.push({
        name: name,
        rank: (pos && (pos.rank || '')) || '',
        rankSlot: (pos && pos.rankSlot) || '',
        unit: (pos && (pos.section || pos.unit)) || '',
        post: (pos && pos.position) || '',
        postCode: (pos && pos.code) || '',
        posCode: (pos && pos.code) || '',
        bad: [],
        phone: '',
        blocked: false
      });
      idx = db.people.length - 1;
      if (typeof window.kmEnsurePersonProfile === 'function') window.kmEnsurePersonProfile(db.people[idx]);
      return idx;
    }
    if (pos) applyPosToPerson(db.people[idx], pos, !!forceApply);
    return idx;
  }
  function assignedName(posId) {
    ensureStore();
    var a = db.positionAssignments[posId];
    if (!a) return '';
    if (a.vacant) return '';
    return a.personName ? String(a.personName).trim() : '';
  }
  /**
   * Անուն՝ Excel շտատից, բացառությամբ ձեռքով կցման կամ «թափուր» նշման։
   * fromShtatPick ավտոկցումները չեն ցուցադրվում որպես առանձին աղբյուր։
   */
  function resolvePositionPerson(pos) {
    if (!pos) return '';
    ensureStore();
    var a = db.positionAssignments && db.positionAssignments[pos.id];
    if (a && a.vacant) return '';
    if (pos.vacant === true && !(a && a.manual && a.personName)) return '';
    function pick(n) {
      n = String(n || '').trim();
      return looksLikePersonName(n) ? n : '';
    }
    if (a && a.manual) return pick(a.personName);
    if (a && a.personName && !a.vacant) return pick(a.personName);
    var own = pick(pos.personName);
    if (own) return own;
    return pick(pos.sourceName);
  }
  function matchRowToPosition(r, pos) {
    if (!r || !pos || r.type === 'section') return false;
    var aid = String(pos.archId || pos.archiveId || '').trim();
    var rid = String(r.archId || r.archiveId || '').trim();
    if (aid && rid && aid === rid && pos.excelRow != null && String(pos.excelRow) !== '' &&
        String(r.excelRow) === String(pos.excelRow)) return true;
    var sameTitle = String(r.position || '').trim().toLowerCase() ===
      String(pos.position || '').trim().toLowerCase();
    if (!sameTitle) return false;
    var codeA = String(r.code || '').replace(/\s+/g, '');
    var codeB = String(pos.code || '').replace(/\s+/g, '');
    if (codeA && codeB && codeA !== codeB) return false;
    var secA = String(r.unit || r.section || '').trim().toLowerCase();
    var secB = String(pos.section || pos.unit || '').trim().toLowerCase();
    if (secA && secB && secA !== secB) return false;
    if (pos.seq && r.seq && String(pos.seq) !== String(r.seq)) return false;
    return true;
  }
  function writeArchivePersonName(r, name) {
    if (!r || typeof r !== 'object') return;
    name = String(name || '').trim();
    if (typeof window.kmPersonNameIsLoginStub === 'function' && window.kmPersonNameIsLoginStub(name)) return;
    r.sourceName = name;
    r.name = name;
    r.personName = name;
    r.vacant = !name;
    r._shtatDirty = true;
  }
  /** Live assignment is source of truth — also write it into Excel/archive rows + troop staff. */
  function persistLivePositionPerson(pos, name, extra) {
    extra = extra || {};
    if (!pos) return;
    ensureStore();
    name = String(name || '').trim();
    if (typeof window.kmPersonNameIsLoginStub === 'function' && window.kmPersonNameIsLoginStub(name)) name = '';
    pos.personName = name;
    pos.sourceName = name;
    pos.vacant = !name;
    pos.userEdited = true;
    var asg = {
      personName: name,
      vacant: !name,
      manual: extra.manual !== false,
      userEdited: true,
      position: pos.position,
      section: pos.section,
      code: pos.code || '',
      previousName: extra.previousName || '',
      updatedAt: new Date().toISOString()
    };
    if (!name) asg.clearedAt = asg.updatedAt;
    db.positionAssignments[pos.id] = asg;
    var lists = [];
    if (Array.isArray(db.positionArchives)) lists.push(db.positionArchives);
    try {
      var cd = db.kmCorpsData;
      if (cd && typeof cd === 'object') {
        Object.keys(cd).forEach(function (sid) {
          if (cd[sid] && Array.isArray(cd[sid].positionArchives)) lists.push(cd[sid].positionArchives);
        });
      }
    } catch (eCd) {}
    lists.forEach(function (arr) {
      arr.forEach(function (arch) {
        if (!arch || arch.builtin || !Array.isArray(arch.rows)) return;
        if (pos.archId && String(arch.id || '') && String(arch.id) !== String(pos.archId)) return;
        var hit = false;
        arch.rows.forEach(function (r) {
          if (!matchRowToPosition(r, pos)) return;
          writeArchivePersonName(r, name);
          hit = true;
        });
        if (hit) {
          arch._shtatUserEdited = true;
          arch._shtatCols = 'A-AU';
          arch.updatedAt = asg.updatedAt;
        }
      });
    });
    try {
      var troopRows = ((((db.troopStructure || {}).staff || {}).rows) || []);
      troopRows.forEach(function (r) {
        if (!matchRowToPosition(r, pos)) return;
        r.name = name;
        r.sourceName = name;
        r.personName = name;
      });
    } catch (eT) {}
    try { bumpPositionsMut(); } catch (eB) {}
  }
  function xmlEscText(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function patchSheetRowCells(sheet, rowNum, cellsByCol) {
    rowNum = Number(rowNum);
    if (!sheet || !rowNum) return sheet;
    var rowRe = new RegExp('<row([^>]*\\br="' + rowNum + '"[^>]*)>([\\s\\S]*?)</row>');
    var m = sheet.match(rowRe);
    if (!m) return sheet;
    var inner = m[2];
    Object.keys(cellsByCol || {}).forEach(function (col) {
      var ref = String(col) + rowNum;
      var val = cellsByCol[col];
      var cellXml = (val == null || String(val).trim() === '')
        ? ('<c r="' + ref + '"/>')
        : ('<c r="' + ref + '" t="inlineStr"><is><t xml:space="preserve">' + xmlEscText(val) + '</t></is></c>');
      var cellRe = new RegExp('<c[^>]*\\br="' + ref + '"[^>]*(?:/>|>[\\s\\S]*?</c>)');
      if (cellRe.test(inner)) inner = inner.replace(cellRe, cellXml);
      else inner += cellXml;
    });
    return sheet.replace(rowRe, '<row' + m[1] + '>' + inner + '</row>');
  }
  async function rewriteArchiveXlsxFromRows(arch) {
    if (!arch || !arch.base64 || !Array.isArray(arch.rows)) return false;
    var dirty = (arch.rows || []).filter(function (r) {
      return r && r.type !== 'section' && r._shtatDirty && r.excelRow != null && String(r.excelRow) !== '';
    });
    if (!dirty.length) return false;
    var Zip = await ensureJsZip();
    var zip = await Zip.loadAsync(base64ToArrayBuffer(arch.base64));
    var sheetFile = zip.file('xl/worksheets/sheet1.xml');
    if (!sheetFile) return false;
    var sheet = await sheetFile.async('string');
    dirty.forEach(function (r) {
      var rowNum = Number(r.excelRow);
      if (!rowNum) return;
      var name = personDisplayName(r) || '';
      var personRank = String(r.rank || '').trim();
      var cells = {
        E: String(r.vus || r.specialty || ''),
        F: String(r.code || ''),
        I: name,
        H: name ? personRank : ''
      };
      STAFF_KEYS.forEach(function (k, i) {
        var col = STAFF_COLS[i];
        if (!col || cells[col] != null) return;
        var val = r[k];
        if (k === 'name') val = name;
        cells[col] = val == null ? '' : String(val);
      });
      sheet = patchSheetRowCells(sheet, rowNum, cells);
      r._shtatDirty = false;
    });
    zip.file('xl/worksheets/sheet1.xml', sheet);
    var out = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    arch.base64 = bytesToBase64(out);
    arch._shtatUserEdited = true;
    arch._shtatCols = 'A-AU';
    arch.updatedAt = new Date().toISOString();
    return true;
  }
  async function promoRewriteTouchedExcel(blob) {
    var seen = Object.create(null);
    var list = [];
    function add(arr) {
      (arr || []).forEach(function (a) {
        if (!a || !a.id || seen[a.id]) return;
        seen[a.id] = 1;
        list.push(a);
      });
    }
    add(blob && blob.positionArchives);
    try { add(typeof db !== 'undefined' && db && db.positionArchives); } catch (e0) {}
    try {
      var cd = typeof db !== 'undefined' && db && db.kmCorpsData;
      if (cd && typeof cd === 'object') {
        Object.keys(cd).forEach(function (k) { add(cd[k] && cd[k].positionArchives); });
      }
    } catch (e1) {}
    for (var i = 0; i < list.length; i++) {
      if (!list[i] || !list[i].base64) continue;
      var hasDirty = (list[i].rows || []).some(function (r) { return r && r._shtatDirty; });
      if (!hasDirty && !list[i]._shtatUserEdited) continue;
      if (!hasDirty) continue;
      try { await rewriteArchiveXlsxFromRows(list[i]); } catch (eX) {}
    }
  }
  async function persistPersonnelNow() {
    try { if (typeof window.kmSyncCorpsSlice === 'function') window.kmSyncCorpsSlice(); } catch (eS) {}
    if (typeof save === 'function') {
      try { await save(true); } catch (eSv) {}
    }
    try {
      if (typeof window.kmPersistOrgArchives === 'function') await window.kmPersistOrgArchives();
    } catch (eP) {}
  }
  function markArchiveDirty(arch) {
    if (!arch) return;
    arch._shtatUserEdited = true;
    arch._shtatCols = 'A-AU';
    arch.updatedAt = new Date().toISOString();
  }
  function forEachLiveArchive(fn) {
    var seen = Object.create(null);
    function walk(arr) {
      (arr || []).forEach(function (a) {
        if (!a || !a.id || seen[a.id]) return;
        seen[a.id] = 1;
        fn(a);
      });
    }
    try { walk(typeof db !== 'undefined' && db && db.positionArchives); } catch (e0) {}
    try {
      var cd = typeof db !== 'undefined' && db && db.kmCorpsData;
      if (cd && typeof cd === 'object') {
        Object.keys(cd).forEach(function (k) { walk(cd[k] && cd[k].positionArchives); });
      }
    } catch (e1) {}
  }
  window.kmWritePersonStaffToArchive = function (person, fields) {
    fields = fields || {};
    var name = String((person && person.name) || '').trim();
    if (!name) return false;
    var code = fields.code != null ? String(fields.code).trim() : String((person && (person.postCode || person.posCode)) || '').trim();
    var spec = fields.specialty != null ? String(fields.specialty).trim() : String((person && person.specialty) || '').trim();
    var post = fields.post != null ? String(fields.post).trim() : String((person && person.post) || '').trim();
    var posOrder = fields.posOrder != null ? String(fields.posOrder).trim() : String((person && person.posOrder) || '').trim();
    if (code && spec === code) spec = '';
    if (looksLikeStaffCode(spec)) spec = '';
    var hit = false;
    forEachLiveArchive(function (arch) {
      if (!arch || !Array.isArray(arch.rows)) return;
      var local = false;
      arch.rows.forEach(function (r) {
        if (!r || r.type === 'section') return;
        var n = personDisplayName(r) || r.sourceName || r.name || '';
        if (!samePerson(n, name)) return;
        if (code !== '') r.code = code;
        r.vus = spec;
        r.specialty = spec;
        if (post) r.position = post;
        if (posOrder) r.posOrder = posOrder;
        r._shtatDirty = true;
        local = true;
        hit = true;
      });
      if (local) markArchiveDirty(arch);
    });
    try {
      (db.userPositions || []).forEach(function (pos) {
        if (!pos || !samePerson(resolvePositionPerson(pos), name)) return;
        if (code !== '') pos.code = code;
        pos.specialty = spec;
        if (post) pos.position = post;
      });
    } catch (ePos) {}
    return hit;
  };
  window.kmSyncTroopStaffToArchive = function () {
    /* KM_TROOP_FORMAL_BIDI_SYNC_V1_POS — troop staff → db.unitFormalArchives (instant bi-di) */
    if (typeof db === 'undefined' || !db) return 0;
    var troopRows = ((((db.troopStructure || {}).staff) || {}).rows) || [];
    if (!troopRows.length) return 0;
    var uid = '';
    try {
      if (typeof window.kmGetOrgContext === 'function') {
        var ctx = window.kmGetOrgContext();
        uid = String((ctx && ctx.unitId) || '').trim();
      }
    } catch (e0) {}
    if (!uid) uid = String(window._kmUnitArchiveActiveUnitId || window._kmArchiveForUnitId || '').trim();
    if (!uid) return 0;
    if (!db.unitFormalArchives || typeof db.unitFormalArchives !== 'object') db.unitFormalArchives = {};
    var sheet = db.unitFormalArchives[uid];
    if (!sheet || !Array.isArray(sheet.rows)) return 0;

    var KEYS = ["unit","position","seq","secret","vus","code","rankSlot","rank","name","posOrder","rankOrder","contract","special","contact","birth","zk","address","serviceYear","discipline","serviceTotal","lastAccept","idCard","blood","caseNo","vacation"];
    function norm(s) { return String(s || '').replace(/\s+/g, ' ').trim().toLowerCase(); }
    function postKey(unit, position, code) {
      return norm(unit) + '|' + norm(position) + '|' + norm(code);
    }
    function cellsOf(r) { return (r && Array.isArray(r.cells)) ? r.cells : null; }

    var byPost = Object.create(null);
    var byNamePos = Object.create(null);
    for (var ti = 0; ti < troopRows.length; ti++) {
      var tr = troopRows[ti];
      if (!tr || tr.type === 'section') continue;
      var pk = postKey(tr.unit, tr.position, tr.code);
      if (pk && pk !== '||') byPost[pk] = tr;
      var nm = norm(tr.name);
      if (nm) byNamePos[nm + '\t' + norm(tr.position)] = tr;
    }

    var n = 0;
    for (var ri = 0; ri < sheet.rows.length; ri++) {
      var row = sheet.rows[ri];
      if (!row || row.type === 'title' || row.type === 'header' || row.type === 'section') continue;
      var cells = cellsOf(row);
      if (!cells) continue;
      while (cells.length < 25) cells.push('');
      var hit = byPost[postKey(cells[0], cells[1], cells[5])] || null;
      if (!hit) {
        var cn = norm(cells[8]);
        if (cn) hit = byNamePos[cn + '\t' + norm(cells[1])] || null;
      }
      if (!hit) continue;
      for (var ki = 0; ki < KEYS.length; ki++) {
        var key = KEYS[ki];
        var val = hit[key];
        if (val == null) continue;
        cells[ki] = String(val);
      }
      row.cells = cells;
      n++;
    }
    sheet.updatedAt = new Date().toISOString();
    sheet.source = String(sheet.source || 'formal') + '+troopSync';
    db.unitFormalArchives[uid] = sheet;
    window._kmUnitArchiveActiveSheet = sheet;
    window._kmUnitArchiveActiveUnitId = uid;
    try {
      if (typeof window.kmSaveDb === 'function') window.kmSaveDb();
      else if (typeof saveDb === 'function') saveDb();
      else if (typeof window.saveDb === 'function') window.saveDb();
    } catch (eSave) {}
    return n;
  };

  window.kmPullFormalArchiveToTroopStaff = function (opts) {
    /* KM_TROOP_FORMAL_BIDI_SYNC_V1_POS — formal archive → troop staff (auto, no import button) */
    opts = opts || {};
    var uid = opts.unitId || '';
    try {
      if (!uid && typeof window.kmGetOrgContext === 'function') {
        var ctx = window.kmGetOrgContext();
        uid = String((ctx && ctx.unitId) || '').trim();
      }
    } catch (e0) {}
    if (!uid) uid = String(window._kmUnitArchiveActiveUnitId || window._kmArchiveForUnitId || '').trim();
    var rows = [];
    try {
      if (window.kmUnitArchiveStaffSource && typeof window.kmUnitArchiveStaffSource.rows === 'function') {
        rows = window.kmUnitArchiveStaffSource.rows(uid) || [];
      }
    } catch (e1) { rows = []; }
    if (!rows.length && typeof window.kmAllPositionArchiveRows === 'function') {
      try { rows = window.kmAllPositionArchiveRows(uid) || []; } catch (e2) { rows = []; }
    }
    // Prefer raw formal sheet so section rows + cells map cleanly
    try {
      if (typeof db !== 'undefined' && db && db.unitFormalArchives && uid && db.unitFormalArchives[uid] && Array.isArray(db.unitFormalArchives[uid].rows)) {
        var sheet = db.unitFormalArchives[uid];
        var mapped = [];
        var KEYS = ["unit","position","seq","secret","vus","code","rankSlot","rank","name","posOrder","rankOrder","contract","special","contact","birth","zk","address","serviceYear","discipline","serviceTotal","lastAccept","idCard","blood","caseNo","vacation"];
        sheet.rows.forEach(function (r, idx) {
          if (!r) return;
          if (r.type === 'title' || r.type === 'header') return;
          if (r.type === 'section') {
            var label = '';
            var cc = r.cells || [];
            for (var si = 0; si < cc.length; si++) { if (String(cc[si] || '').trim()) { label = String(cc[si]).trim(); break; } }
            mapped.push({ type: 'section', unit: label || 'ԲԱԺԻՆ' });
            return;
          }
          var cells = r.cells || [];
          var obj = { type: 'row', excelRow: idx + 1, fromFormal: true };
          for (var ki = 0; ki < KEYS.length; ki++) obj[KEYS[ki]] = cells[ki] != null ? String(cells[ki]) : '';
          obj.sourceName = obj.name || '';
          obj.personName = obj.name || '';
          mapped.push(obj);
        });
        if (mapped.length) rows = mapped;
      }
    } catch (eMap) {}

    if (!rows.length) return { ok: false, slots: 0 };
    if (typeof window.kmApplyArchiveRowsToTroopStaff === 'function') {
      var st = window.kmApplyArchiveRowsToTroopStaff(rows, { silent: true, noOpen: true, clearIfEmpty: false });
      try {
        if (typeof db !== 'undefined' && db && db.troopStructure) {
          var title = '';
          try {
            var c2 = typeof window.kmGetOrgContext === 'function' ? window.kmGetOrgContext() : null;
            title = ((c2 && (c2.unitName || c2.unitLabel)) || '') || 'ՀՀ ՊՆ';
            if (c2 && c2.corpsName) title = c2.corpsName + ' · ' + title;
          } catch (eT) {}
          db.troopStructure.title = title || db.troopStructure.title || 'Զորամասի Արխիվ';
          db.troopStructure._formalBound = 1;
          db.troopStructure._formalUnitId = uid;
        }
      } catch (eTitle) {}
      return st || { ok: true };
    }
    return { ok: false, slots: 0 };
  };
  window.kmFlushDirtyShtatExcel = async function () {
    try { await promoRewriteTouchedExcel(); } catch (eX) {}
    try { await persistPersonnelNow(); } catch (eP) {}
  };
  function resolveShtatPerson(pos) {
    if (!pos) return '';
    return personDisplayName(pos);
  }
  /** Մաքրել ավտոմատ/սխալ կցումները — թափուրները Excel-ից */
  function sanitizePositionAssignments(opts) {
    opts = opts || {};
    ensureStore();
    var changed = 0;
    var ids = Object.keys(db.positionAssignments || {});
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      var a = db.positionAssignments[id];
      var pos = findPos(id);
      if (!a) continue;
      if (!pos) {
        delete db.positionAssignments[id];
        changed++;
        continue;
      }
      if (opts.resetAll) {
        delete db.positionAssignments[id];
        changed++;
        continue;
      }
      if (assignmentIsLiveEdit(a)) continue;
      if (a.fromShtatPick) {
        delete db.positionAssignments[id];
        changed++;
        continue;
      }
      var excelName = String(pos.sourceName || '').trim();
      var asgName = String(a.personName || '').trim();
      /* Excel-ում թափուր է, կցումը ձեռքով չէ → հանել (ավտոլրացում) */
      if (!excelName && asgName && !a.manual && !a.vacant) {
        delete db.positionAssignments[id];
        changed++;
        continue;
      }
      /* կցումը նույնն է ինչ Excel-ը → ավելորդ է */
      if (!a.vacant && asgName && excelName && samePerson(asgName, excelName) && !a.manual) {
        delete db.positionAssignments[id];
        changed++;
      }
    }
    return changed;
  }
  function zeroPersonCard(p) {
    if (!p || typeof p !== 'object') return;
    p.rank = '';
    p.unit = '';
    p.post = '';
    p.phone = '';
    p.note = '';
    p.education = '';
    p.educations = [];
    p.familyStatus = '';
    p.family = '';
    p.contractStart = '';
    p.endDate = '';
    p.contractEnd = '';
    p.region = '';
    p.city = '';
    p.address = '';
    p.commissariat = '';
    p.bloodGroup = '';
    p.illnesses = '';
    p.articles = '';
    p.articleItems = [];
    p.specialty = '';
    p.posOrder = '';
    p.postCode = '';
    p.appointmentDate = '';
    p.appointments = [];
    p.educationGroup = '';
    p.secrecyClearance = '';
    p.idCard = '';
    p.hsk = '';
    p.photo = '';
    p.bad = [];
    if (typeof window.kmEnsurePersonProfile === 'function') window.kmEnsurePersonProfile(p);
  }
  /** Անուններ Պաշտոն բաժնից (համալրված պաշտոններ) */
  window.kmPeopleFromPositions = function () {
    ensureStore();
    if (typeof window.kmUnitHasStaffSource === 'function' ? !window.kmUnitHasStaffSource() : (typeof window.kmUnitHasExcelArchive === 'function' && !window.kmUnitHasExcelArchive())) {
      return [];
    }
    var out = [];
    var seen = Object.create(null);
    (catalog().positions || []).forEach(function (p) {
      var n = resolvePositionPerson(p);
      if (!n) return;
      var k = n.toLowerCase();
      if (seen[k]) return;
      seen[k] = 1;
      out.push({
        name: n,
        rank: p.rank || '',
        rankSlot: p.rankSlot || '',
        unit: p.section || p.unit || '',
        post: p.position || '',
        code: p.code || '',
        postCode: p.code || '',
        education: p.education || '',
        specialty: specialtyFromArchiveRow(p, p.code),
        vus: String(p.vus || '').trim(),
        posId: p.id,
        src: 'Պաշտոն'
      });
    });
    try {
      var arch = allArchiveRows();
      out.forEach(function (x) {
        if (!x || (x.education && x.specialty)) return;
        var hit = null;
        var i, r;
        for (i = 0; i < arch.length; i++) {
          r = arch[i];
          if (!r || !r.sourceName || !samePerson(r.sourceName, x.name)) continue;
          if (x.post && String(r.position || '').trim() === String(x.post || '').trim()) {
            hit = r;
            break;
          }
          if (!hit) hit = r;
        }
        if (!hit) return;
        if (!x.education) x.education = String(hit.education || '').trim();
        x.postCode = String(hit.code || x.postCode || '').trim();
        x.posCode = x.postCode;
        x.code = x.postCode || x.code;
        x.specialty = specialtyFromArchiveRow(hit, x.code);
        x.vus = String(hit.vus || '').trim();
      });
    } catch (eArchFill) {}
    out.sort(function (a, b) { return a.name.localeCompare(b.name, 'hy'); });
    return out;
  };

  /** Օգնական բոտ / որոնում՝ Պաշտոն բաժնի արխիվ (Զորամասի Արխիվ) */
  window.kmPositionArchiveSearch = function (q, opts) {
    ensureStore();
    opts = opts || {};
    var raw = String(q || '').replace(/\s+/g, ' ').trim();
    if (!raw || raw.length < 2) return [];
    var ql = raw.toLowerCase();
    var tokens = ql.split(/\s+/).filter(function (t) { return t.length >= 2; }).slice(0, 8);
    var limit = Math.min(40, Math.max(1, Number(opts.limit) || 12));
    var rows = allArchiveRows();
    var hits = [];
    /* Perf: findPos() rebuilds the whole catalog on every call, so resolving each hit through it was
       O(hits x positions). The catalog is not modified inside this loop, so build an id -> position
       index once (lazily, first match wins - exactly what findPos returns) and reuse it. */
    var posById = null;
    function lookupPos(id) {
      if (typeof id !== 'string') return findPos(id);
      if (!posById) {
        posById = Object.create(null);
        (catalog().positions || []).forEach(function (p) {
          if (p && typeof p.id === 'string' && posById[p.id] === undefined) posById[p.id] = p;
        });
      }
      return posById[id] || null;
    }
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (!r) continue;
      var name = String(r.sourceName || '').trim();
      var unit = String(r.unit || '').trim();
      var position = String(r.position || '').trim();
      var code = String(r.code || '').trim();
      var rank = String(r.rankSlot || '').trim();
      /* KM_SEARCH_HAY_NO_ARCHNAME_V1: archName is an archive LABEL, identical on every row of an archive;
         keeping it in the haystack made any query that matched the label (e.g. "2025", "31", "արխիվ")
         hit ALL rows and inflate every score. Search only the row's own fields. */
      var hay = [name, unit, position, code, rank].join(' ').toLowerCase();
      var score = 0;
      if (name && samePerson(name, raw)) score += 40;
      else if (name && name.toLowerCase().indexOf(ql) >= 0) score += 28;
      else if (ql.length >= 3 && name && name.toLowerCase().indexOf(ql) >= 0) score += 24;
      if (hay.indexOf(ql) >= 0) score += 10;
      tokens.forEach(function (t) {
        if (name && name.toLowerCase().indexOf(t) >= 0) score += 8;
        else if (hay.indexOf(t) >= 0) score += 2;
      });
      if (score < 8) continue;
      var liveName = name;
      var posId = '';
      try {
        if (r.catalogId) {
          var pos = lookupPos(r.catalogId);
          if (pos) {
            posId = pos.id || '';
            var rn = resolvePositionPerson(pos);
            if (rn) liveName = rn;
          }
        }
      } catch (ePos) {}
      hits.push({
        score: score,
        name: liveName || name || '—',
        sourceName: name,
        unit: unit,
        position: position,
        code: code,
        rank: rank,
        archId: r.archId || '',
        archName: r.archName || 'Պաշտոն արխիվ',
        catalogId: r.catalogId || '',
        posId: posId || r.catalogId || '',
        excelRow: r.excelRow,
        seq: r.seq || ''
      });
    }
    hits.sort(function (a, b) { return b.score - a.score; });
    return hits.slice(0, limit);
  };
  window.kmPositionArchiveFindByName = function (name) {
    return window.kmPositionArchiveSearch(name, { limit: 8 });
  };
  /** Շտատի անունները մտցնում է db.people — միայն բացակայողները (արագ) */
  window.kmSyncPeopleFromPositions = function () {
    if (typeof db === 'undefined') return [];
    ensureStore();
    var roster = window.kmPeopleFromPositions();
    var have = Object.create(null);
    (db.people || []).forEach(function (p) {
      if (p && p.name) have[String(p.name).toLowerCase()] = 1;
    });
    roster.forEach(function (x) {
      var k = String(x.name || '').toLowerCase();
      if (!k || have[k]) return;
      var pos = x.posId ? findPos(x.posId) : null;
      ensurePersonFromName(x.name, pos || {
        position: x.post,
        section: x.unit,
        unit: x.unit,
        code: x.code || x.postCode || '',
        rankSlot: x.rankSlot || '',
        rank: x.rank || ''
      });
      have[k] = 1;
    });
    return db.people || [];
  };
  /** Ընտրիչների ցուցակ՝ միայն զորամասի Արխիվի անձինք */
    /* UNIFIED_HAS_FORMAL_OR_EXCEL */
  window.kmUnitHasStaffSource = function (unitId) {
    try {
      if (window.kmUnitArchiveStaffSource && window.kmUnitArchiveStaffSource.hasFormal && window.kmUnitArchiveStaffSource.hasFormal(unitId)) return true;
    } catch (e0) {}
    try {
      if (typeof window.kmUnitHasExcelArchive === 'function' && window.kmUnitHasExcelArchive(unitId)) return true;
    } catch (e1) {}
    return false;
  };

  window.kmPeopleRoster = function () {
    /* UNIFIED_ROSTER_FORMAL */
    /* KM_UNIT_ARCHIVE_UNIFIED_SOURCE_V1 */
    /* KM_UNIT_ARCHIVE_HTML_V7_SSOT_V1 */
    try {
      if (typeof window.kmEnsureHtmlV7UnitArchive === 'function') {
        window.kmEnsureHtmlV7UnitArchive({ noPersist: true });
      }
    } catch (eEns) {}
    try {
      if (window.kmUnitArchiveStaffSource && window.kmUnitArchiveStaffSource.hasFormal && window.kmUnitArchiveStaffSource.hasFormal()) {
        var fp = window.kmUnitArchiveStaffSource.people() || [];
        if (fp.length) {
          _rosterCache = { key: 'formal-people:' + fp.length, list: fp };
          return fp;
        }
      }
    } catch (eRF) {}
    if (typeof window.kmUnitHasStaffSource === 'function' ? !window.kmUnitHasStaffSource() : (typeof window.kmUnitHasExcelArchive === 'function' && !window.kmUnitHasExcelArchive())) {
      // If formal archive exists, do not empty the roster just because Excel is absent
      try {
        if (window.kmUnitArchiveStaffSource && window.kmUnitArchiveStaffSource.hasFormal && window.kmUnitArchiveStaffSource.hasFormal()) {
          /* keep going */
        } else {
          _rosterCache = { key: archiveRowsCacheKey(), list: [] };
          return [];
        }
      } catch (eEx) {
        _rosterCache = { key: archiveRowsCacheKey(), list: [] };
        return [];
      }
    }
    var ck = '';
    try { ck = archiveRowsCacheKey(); } catch (eK) { ck = ''; }
    if (_rosterCache.key && _rosterCache.key === ck && Array.isArray(_rosterCache.list)) {
      return _rosterCache.list;
    }
    var fromArch = [];
    try { fromArch = allArchiveRows() || []; } catch (e0) { fromArch = []; }
    var namedN = 0;
    fromArch.forEach(function (r) { if (personDisplayName(r)) namedN++; });
    if (fromArch.length && namedN < Math.max(2, Math.floor(fromArch.length * 0.05)) && !_rosterRemapTried[ck || '_']) {
      _rosterRemapTried[ck || '_'] = 1;
      try {
        unitArchives().forEach(function (a) {
          if (a && a.rows && a.rows.length) maybeRemapNameColumn(a.rows);
        });
        _archRowsCache = { key: '', rows: null };
        _rosterCache = { key: '', list: null };
        fromArch = allArchiveRows() || [];
        namedN = 0;
        fromArch.forEach(function (r) { if (personDisplayName(r)) namedN++; });
      } catch (eMap) {}
    }
    if (namedN < 2 && fromArch.length && !window._kmRosterKickParse) {
      window._kmRosterKickParse = 1;
      try {
        var formalAlive = false;
        try {
          formalAlive = !!(window.kmUnitArchiveStaffSource && window.kmUnitArchiveStaffSource.hasFormal &&
            window.kmUnitArchiveStaffSource.hasFormal());
        } catch (eFA) { formalAlive = false; }
        if (!formalAlive && typeof window.kmRefreshArchivesFromExcel === 'function') {
          Promise.resolve(window.kmRefreshArchivesFromExcel(null, { force: true, skipApply: true })).catch(function () {});
        }
      } catch (eK) {}
    }
    var seen = Object.create(null);
    var out = [];
    fromArch.forEach(function (r) {
      var n = personDisplayName(r);
      if (!n || isPeopleRemoved(n)) return;
      if (typeof window.kmPersonNameIsLoginStub === 'function' && window.kmPersonNameIsLoginStub(n)) return;
      if (typeof window.kmPersonNameIsVacantStub === 'function' && window.kmPersonNameIsVacantStub(n)) return;
      var k = n.toLowerCase();
      if (seen[k]) return;
      seen[k] = 1;
      var code = String(r.code || '').trim();
      out.push({
        name: n,
        rank: r.rank || r.rankSlot || '',
        rankSlot: r.rankSlot || '',
        unit: r.unit || r.section || '',
        post: r.position || '',
        postCode: code,
        posCode: code,
        code: code,
        contact: r.contact || '',
        phone: r.contact || r.phone || '',
        posOrder: r.posOrder || '',
        education: r.education || '',
        specialty: specialtyFromArchiveRow(r, code),
        vus: String(r.vus || '').trim(),
        src: 'archive'
      });
    });
    _rosterCache = { key: ck, list: out };
    return out;
  };
  window.kmEnsureArchivePersonnel = function () {
    var list = [];
    try {
      if (typeof window.kmEnsureHtmlV7UnitArchive === 'function') {
        window.kmEnsureHtmlV7UnitArchive({ noPersist: true });
      }
    } catch (eEns) {}
    try { list = window.kmPeopleRoster() || []; } catch (e0) { list = []; }
    if (list.length) return Promise.resolve(list);
    try {
      if (window.kmUnitArchiveStaffSource && window.kmUnitArchiveStaffSource.hasFormal &&
          window.kmUnitArchiveStaffSource.hasFormal()) {
        return Promise.resolve(list);
      }
    } catch (eF) {}
    try { purgeDuplicateUnitArchives(); } catch (eP) {}
    var go = (typeof window.kmRefreshArchivesFromExcel === 'function')
      ? window.kmRefreshArchivesFromExcel(null, { force: true, skipApply: true })
      : Promise.resolve();
    return Promise.resolve(go).then(function () {
      _archRowsCache = { key: '', rows: null };
      _rosterCache = { key: '', list: null };
      try { return window.kmPeopleRoster() || []; } catch (e1) { return []; }
    }, function () {
      try { return window.kmPeopleRoster() || []; } catch (e2) { return []; }
    });
  };
  function findPos(id) {
    var list = catalog().positions || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  /* KM_RESERVE_ARCHIVE_V1_FIX: exposed so the separate reserve-archive vacate hook (below,
     its own top-level IIFE with no access to this module's closure) can resolve a bare
     posId string to the actual position + current holder, using the exact same logic
     kmPositionMakeVacant() itself uses — instead of half-reimplementing it. */
  window.kmFindPos = findPos;
  window.kmResolvePositionPerson = resolvePositionPerson;
  function injectCss() {
    var s = document.getElementById('km-positions-css');
    if (!s) {
      s = document.createElement('style');
      s.id = 'km-positions-css';
      (document.head || document.documentElement).appendChild(s);
    }
    s.textContent =
      '.kmPosLayout{display:grid;grid-template-columns:minmax(200px,280px) 1fr;gap:12px;align-items:start}' +
      '@media(max-width:900px){.kmPosLayout{grid-template-columns:1fr}}' +
      '.kmPosTree{border:1px solid #d5e0d9;border-radius:10px;background:#f7faf8;max-height:70vh;overflow:auto;padding:4px}' +
      '.kmPosTreeBtn{display:flex;width:100%;text-align:left;border:0;background:transparent;padding:5px 6px;border-radius:7px;cursor:pointer;font-size:12px;color:#243848;line-height:1.3;align-items:flex-start;gap:4px;box-sizing:border-box}' +
      '.kmPosTreeBtn:hover{background:#e8f0ea}.kmPosTreeBtn.active{background:#d9ebe0;font-weight:700}' +
      '.kmPosTreeBtn .n{margin-left:auto;color:#6a7a88;font-weight:600;flex-shrink:0}' +
      '.kmPosTreeBtn .lab{flex:1;min-width:0}' +
      '.kmPosTreeRow{display:flex;align-items:flex-start;gap:2px;width:100%}' +
      '.kmPosTreeRow .kmPosTreeBtn{flex:1;min-width:0}' +
      '.kmPosTreeTw{width:18px;flex-shrink:0;border:0;background:transparent;cursor:pointer;padding:4px 0;color:#4a6a58;font-size:11px;line-height:1.4}' +
      '.kmPosTreeTw.sp{visibility:hidden}' +
      '.kmPosTreeKids{margin-left:10px;border-left:1px solid #d5e0d9;padding-left:4px}' +
      '.kmPosTools{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 10px}' +
      '.kmPosTools input[type=search]{flex:1;min-width:160px;padding:8px;border:1px solid #c9d5ce;border-radius:8px}' +
      '.kmPosTable{width:100%;border-collapse:collapse;font-size:13px}' +
      '.kmPosTable th,.kmPosTable td{border-bottom:1px solid #e2e8e4;padding:7px 6px;text-align:left;vertical-align:top}' +
      '.kmPosTable th{background:#eaf1ed;position:sticky;top:0;z-index:1}' +
      '.kmPosVacant{color:#9a6b00;font-style:italic}.kmPosFilled{color:#1a5c3a;font-weight:600}' +
      '.kmPosModal{position:fixed;inset:0;z-index:300000;background:rgba(20,30,40,.45);display:flex;align-items:center;justify-content:center;padding:16px}' +
      '.kmPosModalCard{background:#fff;border-radius:12px;max-width:560px;width:100%;max-height:85vh;overflow:auto;padding:16px;box-shadow:0 16px 40px rgba(0,0,0,.25)}' +
      '.kmPosPickList{max-height:50vh;overflow:auto;border:1px solid #d5e0d9;border-radius:8px;padding:6px}' +
      '.kmPosPickRow{display:flex;gap:8px;align-items:flex-start;padding:6px 4px;border-bottom:1px solid #eef2ef;font-size:13px}' +
      '.kmPromoSearch{width:100%;padding:9px 11px;margin-top:4px;box-sizing:border-box;border:1px solid #c9d5ce;border-radius:8px;font-size:14px}' +
      '.kmPromoSearch:focus{outline:none;border-color:#3d8b63;box-shadow:0 0 0 3px rgba(61,139,99,.18)}' +
      '#kmPromoPosList .kmPosPickRow:hover{background:#eef6f1}' +
      '.kmPeopleStruct .kmPosSec{border:1px solid #d5e0d9;border-radius:10px;margin:0 0 8px;overflow:hidden;background:#fff}' +
      '.kmPeopleStruct .kmPosSecHead{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:9px 11px;background:#f3f7f4;cursor:pointer}' +
      '.kmPeopleStruct .kmPosSecBody{padding:0 8px 8px}' +
      '.kmPeopleStruct .kmPosSecBody.kmPosCollapsed{display:none!important}' +
      '.kmPeopleStruct .kmPosSecHead .kmPosChev{display:inline-block;width:1.2em;color:#1a5c3a;font-weight:700}' +
      '.kmPeopleStruct table{width:100%;border-collapse:collapse;font-size:13px}' +
      '.kmPeopleStruct td,.kmPeopleStruct th{border-bottom:1px solid #e8eee9;padding:6px;text-align:left}' +
      '.kmPersTabs{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px;padding:4px;background:#eef3f0;border-radius:10px}' +
      '.kmPersTab{border:0;background:transparent;padding:8px 14px;border-radius:8px;cursor:pointer;font-weight:600;color:#3a4d58}' +
      '.kmPersTab:hover{background:#e0eae4}.kmPersTab.active{background:#fff;color:#1a5c3a;box-shadow:0 1px 3px rgba(0,0,0,.12)}' +
      '.kmPosArchName{color:#c62828;font-weight:700}' +
      '.kmPosArchRow{background:#fff5f5}' +
      '.kmPosArchTitle{color:#c62828;margin:0 0 8px}' +
      '/* KM_ORG_ARCH_BTN_REMOVED_V1 */' +
      '.kmPosTable td{white-space:normal}' +
      '.kmPosActs{display:flex;flex-wrap:wrap;gap:8px;align-items:center}' +
      '.kmPosAct{display:inline-flex;align-items:center;justify-content:center;margin:0!important;' +
        'padding:8px 18px!important;border-radius:999px!important;font-size:14px!important;font-weight:700!important;' +
        'line-height:1.2!important;cursor:pointer;box-shadow:none!important}' +
      '.kmPosActOn,.kmPosTable button.kmPosActOn.primary{' +
        'background:#2f5d75!important;color:#fff!important;-webkit-text-fill-color:#fff!important;' +
        'border:1px solid #2f5d75!important}' +
      '.kmPosActOff,.kmPosTable button.kmPosActOff{' +
        'background:#fff!important;color:#1d2733!important;-webkit-text-fill-color:#1d2733!important;' +
        'border:1px solid #c5d0da!important}' +
      'body.km-mil-bg-on .kmPosTable tr:hover td .kmPosActOn,' +
      'body.km-mil-bg-on .kmPosTable tr:hover .kmPosActOn{' +
        'background:#2f5d75!important;color:#fff!important;-webkit-text-fill-color:#fff!important}' +
      'body.km-mil-bg-on .kmPosTable tr:hover td .kmPosActOff,' +
      'body.km-mil-bg-on .kmPosTable tr:hover .kmPosActOff{' +
        'background:#fff!important;color:#1d2733!important;-webkit-text-fill-color:#1d2733!important}';
    (document.head || document.documentElement).appendChild(s);
  }

  function restoreArchiveSliceIfNeeded() {
    if (!window._kmArchiveModalOpen) return;
    window._kmArchiveModalOpen = false;
    var prev = window._kmArchivePrevSlice;
    window._kmArchivePrevSlice = null;
    window._kmArchiveForCorpsId = '';
    window._kmArchiveForUnitId = '';
    if (prev && typeof window.kmApplyCorpsSlice === 'function') {
      try { window.kmApplyCorpsSlice(prev); } catch (eR) {}
    }
  }

  function closeModal(opts) {
    var m = document.getElementById('kmPosModal');
    if (m) m.remove();
    if (!opts || !opts.keepArchiveCtx) restoreArchiveSliceIfNeeded();
  }

  function openAssignModal(posId) {
    if (!canEdit()) { toastMsg('Դիտորդի իրավունք', 'error'); return; }
    var pos = findPos(posId);
    if (!pos) return;
    ensureStore();
    closeModal();
    var cur = resolvePositionPerson(pos);
    var names = [];
    var seen = Object.create(null);
    (catalog().positions || []).forEach(function (p) {
      var n = resolvePositionPerson(p);
      if (!n) return;
      var k = n.toLowerCase();
      if (seen[k]) return;
      seen[k] = 1;
      names.push(n);
    });
    (db.people || []).forEach(function (p) {
      if (!p || !p.name) return;
      var k = String(p.name).toLowerCase();
      if (seen[k]) return;
      seen[k] = 1;
      names.push(p.name);
    });
    names.sort(function (a, b) { return a.localeCompare(b, 'hy'); });

    var opts = '<option value="">— ընտրել ցուցակից —</option>' +
      names.map(function (n) {
        return '<option value="' + esc(n) + '"' + (samePerson(n, cur) ? ' selected' : '') + '>' + esc(n) + '</option>';
      }).join('');

    var el = document.createElement('div');
    el.id = 'kmPosModal'; /* KM_PROMO_ARCHIVE_LABEL_V1 */
    el.className = 'kmPosModal';
    el.innerHTML =
      '<div class="kmPosModalCard">' +
        '<h3 style="margin:0 0 8px">Կցել անձ պաշտոնին</h3>' +
        '<p class="muted" style="margin:0 0 10px;font-size:12px">' + esc(pos.section) + ' · <b>' + esc(pos.position) + '</b></p>' +
        '<label style="display:block;margin-bottom:8px"><span class="muted">Ցուցակից</span>' +
          '<select id="kmPosAssignSel" style="width:100%;padding:8px;margin-top:4px">' + opts + '</select></label>' +
        '<label style="display:block;margin-bottom:12px"><span class="muted">կամ Ա․Ա․Հ․</span>' +
          '<input id="kmPosAssignName" type="text" value="' + esc(cur) + '" style="width:100%;padding:8px;margin-top:4px;box-sizing:border-box"></label>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
          '<button type="button" class="primary" id="kmPosAssignOk">Կցել և բացել քարտ</button>' +
          '<button type="button" id="kmPosAssignClear">Հանել կցումը</button>' +
          '<button type="button" class="kmBackBtn" id="kmPosAssignCancel">' + ((typeof window.KM_BACK_LABEL === 'string' && window.KM_BACK_LABEL) || '← Վերադարձ') + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);
    el.addEventListener('click', function (ev) { if (ev.target === el) closeModal(); });
    var sel = el.querySelector('#kmPosAssignSel');
    var inp = el.querySelector('#kmPosAssignName');
    if (sel) sel.onchange = function () { if (sel.value) inp.value = sel.value; };
    el.querySelector('#kmPosAssignCancel').onclick = closeModal;
    el.querySelector('#kmPosAssignClear').onclick = async function () {
      var prevName = resolvePositionPerson(pos) || cur || '';
      persistLivePositionPerson(pos, '', { previousName: prevName });
      if (prevName) {
        var stillElsewhere = (catalog().positions || []).some(function (p) {
          if (!p || p.id === posId) return false;
          return samePerson(resolvePositionPerson(p), prevName);
        });
        if (!stillElsewhere) markPeopleRemoved(prevName, 'unassign');
      }
      if (typeof window.kmHishoxutyunLog === 'function') {
        window.kmHishoxutyunLog({
          section: 'positions',
          sectionLabel: 'Պաշտոն',
          action: 'remove',
          detail: 'Հանել կցումը՝ ' + (prevName || '—') + ' · ' + (pos.position || '') +
            (pos.section ? (' · ' + pos.section) : '')
        });
      }
      await persistPersonnelNow();
      closeModal();
      window.kmOpenPositionsPage();
      toastMsg('Կցումը հանվեց', 'ok');
    };
    el.querySelector('#kmPosAssignOk').onclick = async function () {
      var name = String((inp && inp.value) || '').trim();
      if (!name) { toastMsg('Գրեք Ա․Ա․Հ․', 'warn'); return; }
      var idx = ensurePersonFromName(name, pos, true);
      var prevName = cur || '';
      persistLivePositionPerson(pos, name, { previousName: prevName, manual: true });
      if (typeof window.kmHishoxutyunLog === 'function') {
        window.kmHishoxutyunLog({
          section: 'positions',
          sectionLabel: 'Պաշտոն',
          action: 'attach',
          detail: 'Կցել՝ ' + name + ' → ' + (pos.position || '') +
            (pos.section ? (' · ' + pos.section) : '') +
            (pos.code ? (' · կոդ՝ ' + pos.code) : '') +
            (prevName && prevName !== name ? (' (նախկին՝ ' + prevName + ')') : '')
        });
      }
      if (typeof save === 'function') await save(true);
      closeModal();
      toastMsg('Կցվեց · քարտը բացվում է', 'ok');
      window.kmOpenPersonCardSafe(idx, function () { window.kmOpenPositionsPage(); });
    };
  }

  window.kmPositionOpenCard = function (posId) {
    var pos = findPos(posId);
    if (!pos) { toastMsg('Պաշտոնը չգտնվեց', 'warn'); return; }
    var name = resolvePositionPerson(pos);
    if (!name) {
      var isAdmin = typeof window.kmCanAdmin === 'function'
        ? window.kmCanAdmin()
        : (window.kmUserRole === 'admin');
      if (!isAdmin && !canEdit()) {
        toastMsg('Թափուր հաստիքի քարտ — միայն ադմինիստրատոր', 'warn');
        return;
      }
      if (!isAdmin) {
        openAssignModal(posId);
        return;
      }
      openVacantPositionCard(pos);
      return;
    }
    var idx = ensurePersonFromName(name, pos, true);
    if (typeof save === 'function') try { save(true); } catch (e) {}
    window.kmOpenPersonCardSafe(idx, function () { toastMsg('Քարտի մոդուլը բացակայում է', 'error'); });
  };

  function openVacantPositionCard(pos) {
    if (!pos) return;
    if (typeof window.kmUnitHasStaffSource === 'function' ? !window.kmUnitHasStaffSource() : (typeof window.kmUnitHasExcelArchive === 'function' && !window.kmUnitHasExcelArchive())) {
      toastMsg('Այս զորամասի արխիվում ֆայլ չկա', 'warn');
      return;
    }
    ensureStore();
    if (!Array.isArray(db.people)) db.people = [];
    var stub = '';
    for (var i = 0; i < db.people.length; i++) {
      if (db.people[i] && db.people[i]._kmVacantPosId === pos.id) {
        applyPosToPerson(db.people[i], pos, true);
        db.people[i].blocked = true;
        db.people[i].active = false;
        try {
          var sn = String(db.people[i].name || '').trim();
          if (sn && typeof window.kmRemoveFromSelectedPeople === 'function') window.kmRemoveFromSelectedPeople(sn);
          if (sn && typeof window.kmRemovePersonFromAllSchedules === 'function') window.kmRemovePersonFromAllSchedules(sn);
        } catch (eS) {}
        window.kmOpenPersonCardSafe(i);
        return;
      }
    }
    stub = '【թափուր】 ' + String(pos.position || 'պաշտոն').trim();
    if (pos.code) stub += ' · ' + String(pos.code).trim();
    stub += ' · ' + String(pos.id || '').slice(-8);
    db.people.push({
      name: stub,
      rank: pos.rankSlot || '',
      unit: pos.section || '',
      post: pos.position || '',
      postCode: pos.code || '',
      bad: [],
      phone: '',
      blocked: true,
      active: false,
      _kmVacantPosId: pos.id
    });
    var idx = db.people.length - 1;
    try {
      if (typeof window.kmRemoveFromSelectedPeople === 'function') window.kmRemoveFromSelectedPeople(stub);
      if (typeof window.kmRemovePersonFromAllSchedules === 'function') window.kmRemovePersonFromAllSchedules(stub);
    } catch (eR) {}
    if (typeof window.kmEnsurePersonProfile === 'function') {
      try { window.kmEnsurePersonProfile(db.people[idx]); } catch (eE) {}
    }
    window.kmOpenPersonCardSafe(idx, function () { toastMsg('Քարտի մոդուլը բացակայում է', 'error'); });
  }

  window.kmPositionAssign = function (posId) {
    openAssignModal(posId);
  };

  window.kmResetPositionsToShtat = async function () {
    if (!canEdit()) { toastMsg('Դիտորդի իրավունք', 'error'); return; }
    if (!confirm('Մաքրե՞լ Պաշտոնների ամբողջ ցուցակը։\nԲոլոր ձեռքով ավելացված պաշտոնները կջնջվեն։')) return;
    ensureStore();
    var ids = (db.userPositions || []).map(function (p) { return p && p.id; }).filter(Boolean);
    db.userPositions = [];
    bumpPositionsMut();
    ids.forEach(function (id) { delete db.positionAssignments[id]; });
    state.sectionId = '';
    state.page = 0;
    if (typeof save === 'function') await save(true);
    toastMsg('Պաշտոնների ցուցակը մաքրվեց', 'ok');
    window.kmOpenPositionsPage();
  };

  function scopedPositionArchives() {
    ensureStore();
    return unitArchives(String(window._kmArchiveForUnitId || '').trim() || currentArchiveUnitId());
  }

  function latestScopedArchive() {
    var list = scopedPositionArchives().slice().sort(function (a, b) {
      return String(b.addedAt || '').localeCompare(String(a.addedAt || ''));
    });
    return list[0] || null;
  }

  function orgArchiveHint() {
    var fid = String(window._kmArchiveForCorpsId || '').trim();
    var uid = String(window._kmArchiveForUnitId || '').trim();
    var parts = [];
    if (fid && typeof window.kmOrgGroupName === 'function') {
      var gn = window.kmOrgGroupName(fid);
      if (gn) parts.push(gn);
    }
    if (uid && typeof window.kmOrgUnitName === 'function') {
      var un = window.kmOrgUnitName(uid);
      if (un) parts.push(un);
    }
    if (parts.length) return parts.join(' · ');
    if (typeof window.kmOrgContextLabel === 'function') {
      var s = window.kmOrgContextLabel();
      if (s) return s;
    }
    return '';
  }

  function renderArchiveModalBody() {
    ensureStore();
    try { purgeDuplicateUnitArchives(); } catch (eP) {}
    var list = scopedPositionArchives();
    var rows = list.map(function (a) {
      var n = archiveRowCount(a);
      return '<tr class="kmPosArchRow" data-arch-id="' + esc(a.id) + '">' +
        '<td><b class="kmPosArchName">' + esc(a.name || '') + '</b>' +
        '<div class="muted" style="font-size:11px">' + n + ' տող · ' + esc(a.addedAt || '') + '</div></td>' +
        '<td style="white-space:nowrap">' +
        '<button type="button" data-km-arch="dl" data-id="' + esc(a.id) + '">Բացել/ներբեռնել</button> ' +
        (canEdit()
          ? '<button type="button" data-km-arch="del" data-id="' + esc(a.id) + '">Ջնջել</button>'
          : '') +
        '</td></tr>';
    }).join('') || '<tr><td colspan="2" class="muted">' +
      (String(window._kmArchiveForUnitId || '').trim()
        ? 'Այս զորամասի արխիվում ֆայլ չկա'
        : 'Այս կորպուսի արխիվում ֆայլ չկա') +
      '</td></tr>';
    var hint = orgArchiveHint();
    var unitArch = !!String(window._kmArchiveForUnitId || '').trim();
    return '' +
      '<p class="muted" style="margin:0 0 10px;font-size:12px">' +
      (hint ? ('<b>' + esc(hint) + '</b><br>') : '') +
      (unitArch
        ? 'Այս զորամասի հաշվառման արխիվը (Զորամասի Արխիվ)։ Մեկ զորամաս — մեկ ակտիվ ֆայլ։ Նոր Excel-ը փոխարինում է նախորդը։ '
        : 'Այս կորպուսի հաշվառման արխիվը (Զորամասի Արխիվ)։ ') +
      'Մեկանգամյա Excel ներմուծում (wizard)։ Runtime մոդուլները կարդում են Զորամասի Արխիվից։ Բեռնումից հետո լրացվում են Հաշվառում բաժինները։ ' +
      'Զորամասի Արխիվի դաշտերը՝ ստորաբաժանում, պաշտոն, հաստիքի կոդ, կոչում, Ա․Ա․Հ․։</p>' +
      (canEdit()
        ? '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 12px">' +
          '<input id="kmPosArchFile" type="file" accept=".json,.xlsx,.xls,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" data-km-no-xlsx-store="1">' +
          '<button type="button" class="primary" id="kmPosArchAdd">Ներբեռնել / փոխարինել</button></div>'
        : '') +
      '<div class="gridwrap" style="max-height:50vh;overflow:auto;border:1px solid #d5e0d9;border-radius:8px">' +
        '<table class="kmPosTable"><thead><tr><th>Ֆայլ</th><th></th></tr></thead><tbody>' +
        rows + '</tbody></table></div>';
  }

  function bytesFromIpc(raw) {
    if (!raw) return null;
    if (raw instanceof Uint8Array) return raw;
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer && Buffer.isBuffer(raw)) return new Uint8Array(raw);
    if (raw.type === 'Buffer' && Array.isArray(raw.data)) return new Uint8Array(raw.data);
    if (Array.isArray(raw)) return new Uint8Array(raw);
    if (raw.buffer instanceof ArrayBuffer) return new Uint8Array(raw.buffer);
    return null;
  }

  async function downloadArchive(id) {
    ensureStore();
    var a = (db.positionArchives || []).find(function (x) { return x && x.id === id; });
    if (!a) { toastMsg('Արխիվը չգտնվեց', 'warn'); return; }
    try {
      var name = a.name || 'unit-archive.json';
      var bytes = null;
      if (a.builtin && a.path) {
        var openApi = window.kmNative && window.kmNative.file;
        if (openApi && typeof openApi.openBundled === 'function') {
          var opened = await openApi.openBundled(a.path);
          if (opened && opened.ok) {
            toastMsg('Ցուցակը բացվեց', 'ok');
            return;
          }
        }
        var api = window.kmNative && window.kmNative.file;
        if (api && typeof api.readBundled === 'function') {
          var packed = await api.readBundled(a.path);
          if (packed && packed.ok) bytes = bytesFromIpc(packed.bytes);
        }
        if (!bytes) {
          var resp = await fetch(a.path);
          if (!resp.ok) throw new Error('HTTP ' + resp.status);
          bytes = new Uint8Array(await resp.arrayBuffer());
        }
      } else if (a.base64) {
        var bin = atob(a.base64);
        bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      }
      if (!bytes || !bytes.length) { toastMsg('Ֆայլը հասանելի չէ', 'warn'); return; }
      var fileApi = window.kmNative && window.kmNative.file;
      if (fileApi && typeof fileApi.saveDesktop === 'function') {
        var saved = await fileApi.saveDesktop({ name: name, bytes: bytes });
        if (!saved || saved.cancelled) return;
        if (saved.ok && saved.path && window.kmNative.shell && window.kmNative.shell.openPath) {
          try { await window.kmNative.shell.openPath(saved.path); } catch (eOpen) {}
        }
        toastMsg(saved.ok ? ('Պահպանվեց · ' + (saved.path || name)) : 'Պահպանել չհաջողվեց', saved.ok ? 'ok' : 'error');
        return;
      }
      var blob = new Blob([bytes], { type: a.mime || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      toastMsg('Ֆայլը ներբեռնվեց', 'ok');
    } catch (e) {
      toastMsg('Բացել/ներբեռնել չհաջողվեց · ' + ((e && e.message) || e), 'error');
    }
  }

  window.kmPositionOpenList = async function () {
    ensureStore();
    var a = latestScopedArchive();
    if (!a) {
      toastMsg('Այս զորամասի արխիվում ֆայլ չկա', 'warn');
      window.kmPositionArchiveOpen();
      return;
    }
    await downloadArchive(a.id);
  };

  window.kmPositionArchiveOpen = function () {
    try {
      try { injectCss(); } catch (eCss) {}
      ensureStore();
      closeModal({ keepArchiveCtx: true });
      if (String(window._kmArchiveForCorpsId || '').trim()) window._kmArchiveModalOpen = true;
      var el = document.createElement('div');
      el.id = 'kmPosModal';
      el.className = 'kmPosModal';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      el.style.cssText = 'position:fixed;inset:0;z-index:600000;background:rgba(20,30,40,.45);display:flex;align-items:center;justify-content:center;padding:16px';
      var title = 'Արխիվ';
      var hint = orgArchiveHint();
      if (hint) title = 'Արխիվ · ' + hint;
      var bodyHtml = '';
      try {
        bodyHtml = renderArchiveModalBody();
      } catch (eBody) {
        bodyHtml = '<p style="color:#a43">Արխիվի ցուցակը չբացվեց։</p>';
        toastMsg('Արխիվը չբացվեց՝ ' + ((eBody && eBody.message) || eBody), 'error');
      }
      el.innerHTML =
        '<div class="kmPosModalCard" style="max-width:640px;background:#fff;border-radius:12px;width:100%;max-height:85vh;overflow:auto;padding:16px;box-shadow:0 16px 40px rgba(0,0,0,.25)">' +
          '<h3 class="kmPosArchTitle">' + esc(title) + '</h3>' +
          '<div id="kmPosArchBody">' + bodyHtml + '</div>' +
          '<div style="margin-top:12px"><button type="button" class="kmBackBtn" id="kmPosArchClose">' + ((typeof window.KM_BACK_LABEL === 'string' && window.KM_BACK_LABEL) || '← Հետ') + '</button></div>' +
        '</div>';
      document.body.appendChild(el);
      el.addEventListener('click', function (ev) { if (ev.target === el) closeModal(); });

      function rebind() {
        var body = el.querySelector('#kmPosArchBody');
        if (!body) return;
        try { body.innerHTML = renderArchiveModalBody(); } catch (eRe) { return; }
        var closeBtn = el.querySelector('#kmPosArchClose');
        if (closeBtn) closeBtn.onclick = closeModal;
        var addBtn = el.querySelector('#kmPosArchAdd');
        if (addBtn) addBtn.onclick = onAdd;
        body.querySelectorAll('[data-km-arch="dl"]').forEach(function (btn) {
          btn.onclick = function () { downloadArchive(btn.getAttribute('data-id')); };
        });
        body.querySelectorAll('[data-km-arch="del"]').forEach(function (btn) {
          btn.onclick = function () { deleteArchive(btn.getAttribute('data-id')); };
        });
      }

      async function onAdd() {
        if (!canEdit()) { toastMsg('Դիտորդի իրավունք', 'error'); return; }
        var inp = el.querySelector('#kmPosArchFile');
        var file = inp && inp.files && inp.files[0];
        if (!file) { toastMsg('Ընտրեք Excel ֆայլ', 'warn'); return; }
        try {
          toastMsg('Ֆայլը մշակվում է…', 'ok');
          var rows;
          /* KM_NO_XLSX_JSON_IMPORT_V1 */
          if (/\.json$/i.test(file.name) || (file.type && /json/i.test(file.type))) {
            var txt = await file.text();
            var parsed = JSON.parse(txt);
            rows = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.rows) ? parsed.rows : []);
          } else {
            var buf = await file.arrayBuffer();
            rows = await parseLegacyExcelBuffer(buf);
          }
          if (!rows.length) { toastMsg('Excel-ում պաշտոնների տող չգտնվեց', 'warn'); return; }
          var bytes = new Uint8Array(buf);
          var stamp = typeof window.kmOrgScopeStamp === 'function' ? window.kmOrgScopeStamp() : {};
          var forcedUnit = String(window._kmArchiveForUnitId || '').trim();
          var forcedCorps = String(window._kmArchiveForCorpsId || '').trim();
          if (forcedUnit) stamp.unitId = forcedUnit;
          if (forcedCorps) stamp.corpsId = forcedCorps;
          if (!stamp.corpsId || !stamp.unitId) {
            toastMsg('Արխիվը կցվում է միայն ընտրված կորպուսին և զորամասին', 'error');
            return;
          }
          if (!db.positionArchives) db.positionArchives = [];
          replaceUnitExcelArchive({ /* KM_NO_XLSX_STORE_V1 */
            id: 'arch_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
            name: String(file.name || '').replace(/\.xlsx?$/i, '').trim() || 'Զորամասի հաստիքային արխիվ',
            builtin: false,
            mime: 'application/x-km-unit-archive+json',
            base64: '',
            rows: rows,
            addedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            _shtatCols: 'A-AU',
            autoFilter: rows._autoFilter || '',
            title: rows._title || '',
          corpsId: stamp.corpsId || '',
          unitId: stamp.unitId || '',
          archiveRole: '',
          corpsName: stamp.corpsName || '',
          unitName: stamp.unitName || ''
          });
          if (typeof save === 'function') await save(true);
          try {
            if (typeof window.kmPersistOrgArchives === 'function') await window.kmPersistOrgArchives({ replace: true });
          } catch (ePers) {}
          var applied = { positions: 0, troop: 0, rows: rows.length };
          try {
            applied = window.kmApplyArchivesToAccounting({
              stamp: stamp,
              unitId: stamp.unitId || '',
              forceTroop: true
            }) || applied;
          } catch (eApply) {}
          toastMsg(
            'Ավելացվեց · ' + rows.length + ' տող · Հաշվառումը լրացվեց' +
            (applied.positions ? (' · ' + applied.positions + ' պաշտոն') : '') +
            (applied.troop ? (' · ' + applied.troop + ' հաստիք') : ''),
            'ok'
          );
          rebind();
        } catch (e) {
          toastMsg('Չհաջողվեց կարդալ Excel՝ ' + ((e && e.message) || e), 'error');
        }
      }

      async function deleteArchive(id) {
        if (!canEdit()) return;
        var a = (db.positionArchives || []).find(function (x) { return x && x.id === id; });
        if (!a || a.builtin) { toastMsg('Ներկառուցված արխիվը չի ջնջվում', 'warn'); return; }
        if (typeof window.kmArchiveMatchesContext === 'function' && !window.kmArchiveMatchesContext(a)) {
          toastMsg('Այս ֆայլը այս կորպուսի արխիվին չի պատկանում', 'error');
          return;
        }
        if (!confirm('Ջնջե՞լ արխիվի ֆայլը՝ ' + (a.name || '') + '։\nՀաշվառման բոլոր տվյալները այս զորամասի համար կմաքրվեն։')) return;
        db.positionArchives = db.positionArchives.filter(function (x) { return !x || x.id !== id; });
        try {
          if (db.kmCorpsData && typeof db.kmCorpsData === 'object') {
            Object.keys(db.kmCorpsData).forEach(function (k) {
              var sl = db.kmCorpsData[k];
              if (sl && Array.isArray(sl.positionArchives)) {
                sl.positionArchives = sl.positionArchives.filter(function (x) { return !x || x.id !== id; });
              }
            });
          }
        } catch (eSl) {}
        _archRowsCache = { key: '', rows: null };
        _rosterCache = { key: '', list: null };
        try { if (typeof window.kmPurgeAccountingIfNoArchive === 'function') window.kmPurgeAccountingIfNoArchive(); } catch (ePur) {}
        if (typeof save === 'function') await save(true);
        try {
          if (typeof window.kmPersistOrgArchives === 'function') await window.kmPersistOrgArchives({ replace: true });
        } catch (eDelP) {}
        toastMsg('Ջնջվեց · հաշվառման տվյալները մաքրվեցին', 'ok');
        rebind();
      }

      rebind();
    } catch (eOpen) {
      toastMsg('Արխիվը չբացվեց՝ ' + ((eOpen && eOpen.message) || eOpen), 'error');
    }
  };

  function normPosTitle(s) {
    return String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }
  function normPosCode(s) {
    return String(s == null ? '' : s).replace(/\s+/g, '').trim().toLowerCase();
  }
  /**
   * Եզակի բանալիներ պաշտոնի համար։
   * Կարևոր՝ հաստիքի կոդը եզակի չէ (1530 պաշտոն ≈ 43 կոդ), ուստի միայն կոդով չենք համեմատում։
   * catalogId / excelRow / մատնահետք (ստորաբաժանում+պաշտոն+կոդ+Ա․Ա․Հ)։
   */
  
  /* KM_STAFF_DEDUPE_MANNING_V1_POS — unique authorized post ignores Հ/Հ (seq) duplicates */
  function positionPostKey(r) {
    if (!r) return '';
    return [
      'post',
      normSecName(r.unit || r.section),
      normPosTitle(r.position),
      normPosCode(r.code)
    ].join('|');
  }
  function positionFingerprintKey(r) {
    if (!r) return '';
    var person = String(r.sourceName || r.personName || '').replace(/\s+/g, ' ').trim().toLowerCase();
    return [
      'fp',
      normSecName(r.unit || r.section),
      normPosTitle(r.position),
      normPosCode(r.code),
      person,
      String(r.seq || '').trim()
    ].join('|');
  }
  function positionSlotKey(r) {
    if (!r) return '';
    return [
      'slot',
      normSecName(r.unit || r.section),
      normPosTitle(r.position),
      normPosCode(r.code),
      String(r.seq || '').trim(),
      String(r.excelRow != null ? r.excelRow : '').trim(),
      String(r.archId || r.archiveId || '').trim()
    ].join('|');
  }
  function positionIdentityKeys(r) {
    /* KM_STAFF_DEDUPE_MANNING_V1_POS */
    var keys = [];
    if (!r) return keys;
    var cid = String(r.catalogId || '').trim();
    if (cid) keys.push('cid:' + cid);
    var post = positionPostKey(r);
    if (post && post !== 'post|||') keys.push(post);
    var slot = positionSlotKey(r);
    if (slot && slot !== 'slot||||||') keys.push(slot);
    var fp = positionFingerprintKey(r);
    if (fp && fp !== 'fp|||||') keys.push(fp);
    return keys;
  }
  function markIdentityKeys(seen, r) {
    positionIdentityKeys(r).forEach(function (k) { if (k) seen[k] = 1; });
  }
  function isPositionAlreadyAdded(row, list) {
    var keys = positionIdentityKeys(row);
    if (!keys.length) return false;
    list = list || (typeof db !== 'undefined' ? db.userPositions : null) || [];
    for (var i = 0; i < list.length; i++) {
      if (!list[i]) continue;
      var ek = positionIdentityKeys(list[i]);
      for (var j = 0; j < ek.length; j++) {
        for (var t = 0; t < keys.length; t++) {
          if (ek[j] === keys[t]) return true;
        }
      }
    }
    return false;
  }
  function archiveRowsNotYetAdded(unitId) {
    var existing = (typeof db !== 'undefined' && Array.isArray(db.userPositions)) ? db.userPositions : [];
    var seen = Object.create(null);
    existing.forEach(function (p) { markIdentityKeys(seen, p); });
    return allArchiveRows(unitId).filter(function (r) {
      if (!r || !String(r.position || '').trim()) return false;
      var keys = positionIdentityKeys(r);
      for (var i = 0; i < keys.length; i++) {
        if (seen[keys[i]]) return false;
      }
      markIdentityKeys(seen, r);
      return true;
    });
  }
  function buildUserPosFromArchiveRow(r, order) {
    var title = String(r.position || '').trim();
    var section = String(r.unit || '').trim() || 'Այլ';
    var code = r.code != null ? String(r.code).trim() : '';
    var rank = String(r.rankSlot || '').trim();
    var person = personDisplayName(r);
    return {
      id: 'up_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '_' + (order || 0),
      position: title,
      section: section,
      code: code,
      rankSlot: rank,
      personName: person || '',
      vacant: !person,
      order: order || ((db.userPositions || []).length + 1),
      catalogId: r.catalogId || '',
      excelRow: r.excelRow != null ? r.excelRow : '',
      archId: r.archId || '',
      seq: r.seq || '',
      fromArchive: true
    };
  }

  function fillUserPositionsFromArchive(unitId, stamp) {
    ensureStore();
    stamp = stamp || {};
    var missing = archiveRowsNotYetAdded(unitId);
    var added = 0;
    missing.forEach(function (r) {
      var row = buildUserPosFromArchiveRow(r, (db.userPositions || []).length + 1);
      row.orgUnitId = stamp.unitId || r.orgUnitId || '';
      row.orgUnitName = stamp.unitName || '';
      row.corpsId = stamp.corpsId || '';
      db.userPositions.push(row);
      var person = String(row.personName || '').trim();
      if (person && isPeopleRemoved(person)) {
        persistLivePositionPerson(row, '', { previousName: person });
        person = '';
      }
      if (person) {
        db.positionAssignments[row.id] = {
          personName: person,
          position: row.position,
          section: row.section,
          code: row.code || '',
          fromArchive: true,
          updatedAt: new Date().toISOString()
        };
        var idx = ensurePersonFromName(person, row, true);
        if (idx >= 0) {
          try {
            window.kmApplyPositionArchiveToPerson(db.people[idx], {
              force: true,
              hints: { name: person, code: row.code, position: row.position, section: row.section }
            });
          } catch (eP) {}
        }
      }
      added++;
    });
    if (added) bumpPositionsMut();
    return added;
  }

  /* KM_ACC_PERF_SKIP_NOOP_SYNC_V1 */
  function syncPeopleFromArchiveRows(unitId, opts) {
    opts = opts || {};
    var rows = allArchiveRows(unitId);
    var fp = String(unitId || '') + ':' + rows.length;
    if (!opts.force && window._kmPeopleSyncFp === fp && (Date.now() - (window._kmPeopleSyncAt || 0)) < 300000) {
      return 0;
    }
    var n = 0;
    var force = !!opts.force;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (!r || r.type === 'section') continue;
      var name = personDisplayName(r);
      if (!name || isPeopleRemoved(name)) continue;
      var idx = ensurePersonFromName(name, {
        position: r.position,
        section: r.unit,
        unit: r.unit,
        rankSlot: r.rankSlot,
        code: r.code
      }, false);
      if (idx < 0) continue;
      try {
        var changed = window.kmApplyPositionArchiveToPerson(db.people[idx], {
          force: force,
          hints: { name: name, code: r.code, position: r.position, section: r.unit }
        });
        if (changed) n++;
      } catch (eS) {}
    }
    window._kmPeopleSyncFp = fp;
    window._kmPeopleSyncAt = Date.now();
    return n;
  }

  /** KM_UNIT_ARCHIVE_UNIFIED_SOURCE_V1: Unit Archive (formal) նախընտրելի · Excel միայն import wizard */
  /** Արխիվից լրացնում է Պաշտոն, Անձնակազմ, Անձնակազմի հաշվառում, Բուժկետ և Արձակուրդների հերթափոխ */
  window.kmApplyArchivesToAccounting = function (opts) {
    opts = opts || {};
    ensureStore();
    try { purgeDuplicateUnitArchives(); } catch (ePur) {}
    try { kmPurgeLegacyExcelArchives(); } catch (eKill) {}
    var stamp = opts.stamp || (typeof window.kmOrgScopeStamp === 'function' ? window.kmOrgScopeStamp() : {}) || {};
    var unitId = String(opts.unitId != null && String(opts.unitId) !== ''
      ? opts.unitId
      : (stamp.unitId || currentArchiveUnitId() || '')).trim();
    var corpsId = String(stamp.corpsId || currentArchiveCorpsId() || '').trim();
    if (!stamp.unitId && unitId) stamp.unitId = unitId;
    if (!stamp.corpsId && corpsId) stamp.corpsId = corpsId;
    if (!stamp.unitName) stamp.unitName = currentArchiveUnitName();
    if (!unitId) return { ok: false, empty: true, positions: 0, people: 0, troop: 0, scoped: false };
    try {
      if (typeof window.kmEnsureHtmlV7UnitArchive === 'function') {
        window.kmEnsureHtmlV7UnitArchive({ noPersist: true });
      }
    } catch (eEns) {}
    var applyKey = corpsId + '::' + unitId;
    var noArch = (typeof window.kmUnitHasStaffSource === 'function' ? !window.kmUnitHasStaffSource(unitId) : (typeof window.kmUnitHasStaffSource === 'function' ? !window.kmUnitHasStaffSource(unitId) : (typeof window.kmUnitHasExcelArchive === 'function' && !window.kmUnitHasExcelArchive(unitId))));
    var rowsProbe = 0;
    try { rowsProbe = (allArchiveRows(unitId) || []).length; } catch (eRp) { rowsProbe = 0; }
    var applyFp = applyKey + '::' + rowsProbe;
    if (!opts.forceTroop && !opts.forcePeople && !noArch && window._kmAccAppliedFp === applyFp && (Date.now() - (window._kmAccAppliedAt || 0)) < 1800000) {
      return { ok: true, skipped: true, positions: 0, people: 0, troop: 0 };
    }
    var rows = allArchiveRows(unitId);
    if (!rows.length) {
      try { if (typeof window.kmPurgeAccountingIfNoArchive === 'function') window.kmPurgeAccountingIfNoArchive(); } catch (ePur) {}
      window._kmAccAppliedKey = applyKey;
      window._kmAccAppliedFp = applyFp;
      window._kmAccAppliedAt = Date.now();
      return { ok: true, empty: true, purged: true, positions: 0, people: 0, troop: 0 };
    }
    try { remapUserPositionsFromArchive(unitId); } catch (eRem) {}
    var posN = fillUserPositionsFromArchive(unitId, stamp);
        /* KM_ACC_PERF_NO_SOFT_SYNC_V2: never soft-scan thousands of archive rows on open */
    var peopleN = 0;
    var wantForcePeople = !!opts.forceTroop || !!opts.forcePeople;
    if (wantForcePeople || posN) {
      peopleN = syncPeopleFromArchiveRows(unitId, { force: wantForcePeople });
    } else {
      try {
        var peopleHave = (db.people && db.people.length) || 0;
        if (peopleHave < 50) {
          peopleN = syncPeopleFromArchiveRows(unitId, { force: false });
        }
      } catch (eSoftSkip) {}
    }

    var troopN = 0;
    var staffSlots = 0;
    try {
      staffSlots = ((((db.troopStructure || {}).staff || {}).rows || [])).filter(function (r) {
        return r && r.type !== 'section';
      }).length;
    } catch (eSt) { staffSlots = 0; }
    if (typeof window.kmApplyArchiveRowsToTroopStaff === 'function' && (opts.forceTroop || !staffSlots)) {
      try {
        var tr = window.kmApplyArchiveRowsToTroopStaff(rows, { silent: true, noOpen: true });
        troopN = (tr && tr.slots) || 0;
      } catch (eT) {}
    }
    if ((posN || peopleN || troopN) && typeof save === 'function') {
      try {
        if (window._kmAccSaveT) clearTimeout(window._kmAccSaveT);
        window._kmAccSaveT = setTimeout(function () {
          window._kmAccSaveT = 0;
          try { save(true); } catch (eLate) {}
        }, 1200);
      } catch (eSv) {}
    }
    window._kmAccAppliedKey = applyKey;
    window._kmAccAppliedFp = applyFp;
    window._kmAccAppliedAt = Date.now();
    return { ok: true, positions: posN, people: peopleN, troop: troopN, rows: rows.length };
  };

  window.kmPositionAdd = function () {
    if (!canEdit()) { toastMsg('Դիտորդի իրավունք', 'error'); return; }
    ensureStore();
    closeModal();

    function isAlreadyAdded(section, position, code, extra) {
      return isPositionAlreadyAdded({
        section: section,
        unit: section,
        position: position,
        code: code,
        sourceName: (extra && extra.sourceName) || '',
        catalogId: (extra && extra.catalogId) || '',
        excelRow: (extra && extra.excelRow) != null ? extra.excelRow : '',
        archId: (extra && extra.archId) || '',
        seq: (extra && extra.seq) || ''
      });
    }

    function orgUnitOptions() {
      var ctx = typeof window.kmGetOrgContext === 'function' ? window.kmGetOrgContext() : null;
      var superAdm = typeof window.kmIsSuperAdmin === 'function' && window.kmIsSuperAdmin();
      var corpsId = ctx && ctx.corpsId;
      var list = (typeof window.kmListOrgUnits === 'function')
        ? window.kmListOrgUnits(superAdm ? '' : corpsId)
        : [];
      var pref = (ctx && ctx.unitId) || '';
      if (!superAdm && pref) {
        list = list.filter(function (u) { return u && u.id === pref; });
      }
      var cmap = Object.create(null);
      if (superAdm && typeof window.kmListOrgCorps === 'function') {
        (window.kmListOrgCorps() || []).forEach(function (c) { if (c && c.id) cmap[c.id] = c.name; });
      }
      if (typeof window.kmOrgGroupName === 'function' && window.kmCentralOrgId) {
        cmap[window.kmCentralOrgId] = window.kmOrgGroupName(window.kmCentralOrgId);
      }
      if (!list.length) return '<option value="">— զորամաս չկա —</option>';
      return '<option value="">— ընտրեք զորամասը —</option>' + list.map(function (u) {
        var label = (cmap[u.corpsId] ? (cmap[u.corpsId] + ' · ') : '') + (u.name || '');
        return '<option value="' + esc(u.id) + '"' + (u.id === pref ? ' selected' : '') + '>' + esc(label) + '</option>';
      }).join('');
    }

    var units = [];
    var titles = [];
    var codes = [];
    var seenU = Object.create(null);
    var seenT = Object.create(null);
    var seenC = Object.create(null);
    function addUnique(arr, seen, val) {
      val = String(val || '').trim();
      if (!val) return;
      var k = val.toLowerCase();
      if (seen[k]) return;
      seen[k] = 1;
      arr.push(val);
    }
    (db.userPositions || []).forEach(function (p) {
      addUnique(units, seenU, p && p.section);
      addUnique(titles, seenT, p && p.position);
      addUnique(codes, seenC, p && p.code);
    });
    units.sort(function (a, b) { return a.localeCompare(b, 'hy'); });
    titles.sort(function (a, b) { return a.localeCompare(b, 'hy'); });
    codes.sort(function (a, b) { return String(a).localeCompare(String(b), 'hy'); });

    var el = document.createElement('div');
    el.id = 'kmPosModal';
    el.className = 'kmPosModal';
    el.innerHTML =
      '<div class="kmPosModalCard" style="max-width:640px">' +
        '<h3 style="margin:0 0 8px">Ավելացնել պաշտոն</h3>' +
        '<p class="muted" style="margin:0 0 10px;font-size:12px">' +
        'Պաշտոնը վերցվում է միայն այդ զորամասի Արխիվից (Բանակային կորպուսներ)։ Առանց արխիվի տող ընտրելու չի պահպանվում։</p>' +
        '<label style="display:block;margin-bottom:8px"><span class="muted">Զորամաս</span>' +
          '<select id="kmPosAddOrgUnit" style="width:100%;padding:8px;margin-top:4px;box-sizing:border-box">' +
            orgUnitOptions() +
          '</select></label>' +
        '<label style="display:block;margin-bottom:8px"><span class="muted">Փնտրել արխիվից</span>' +
          '<input id="kmPosAddArchQ" type="search" placeholder="պաշտոն / ստորաբաժանում / կոդ / Ա․Ա․Հ…" ' +
          'style="width:100%;padding:8px;margin-top:4px;box-sizing:border-box"></label>' +
        '<div id="kmPosAddArchList" class="kmPosPickList" style="max-height:160px;margin-bottom:12px"></div>' +
        '<label style="display:block;margin-bottom:8px"><span class="muted">Պաշտոն</span>' +
          '<input id="kmPosAddTitle" type="text" list="kmPosAddTitleList" placeholder="օր. զորամասի հրամանատար" ' +
          'style="width:100%;padding:8px;margin-top:4px;box-sizing:border-box">' +
          '<datalist id="kmPosAddTitleList">' +
            titles.map(function (t) { return '<option value="' + esc(t) + '"></option>'; }).join('') +
          '</datalist></label>' +
        '<label style="display:block;margin-bottom:8px"><span class="muted">Ստորաբաժանում</span>' +
          '<input id="kmPosAddSection" type="text" list="kmPosAddSecList" placeholder="ստորաբաժանում" ' +
          'style="width:100%;padding:8px;margin-top:4px;box-sizing:border-box">' +
          '<datalist id="kmPosAddSecList">' +
            units.map(function (u) { return '<option value="' + esc(u) + '"></option>'; }).join('') +
          '</datalist></label>' +
        '<label style="display:block;margin-bottom:8px"><span class="muted">Հաստիքի կոդ</span>' +
          '<input id="kmPosAddCode" type="text" list="kmPosAddCodeList" placeholder="հաստիքի կոդ" ' +
          'style="width:100%;padding:8px;margin-top:4px;box-sizing:border-box">' +
          '<datalist id="kmPosAddCodeList">' +
            codes.map(function (c) { return '<option value="' + esc(c) + '"></option>'; }).join('') +
          '</datalist></label>' +
        '<label style="display:block;margin-bottom:8px"><span class="muted">Կոչում (շտատի տեղ)</span>' +
          '<input id="kmPosAddRank" type="text" placeholder="օր. գ-տ" ' +
          'style="width:100%;padding:8px;margin-top:4px;box-sizing:border-box"></label>' +
        '<label style="display:block;margin-bottom:12px"><span class="muted">Ա․Ա․Հ</span>' +
          '<input id="kmPosAddPerson" type="text" placeholder="թափուր թողնելու համար դատարկ" ' +
          'style="width:100%;padding:8px;margin-top:4px;box-sizing:border-box"></label>' +
        '<div id="kmPosAddHint" class="muted" style="font-size:12px;margin:0 0 10px;min-height:1.2em"></div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
          '<button type="button" class="primary" id="kmPosAddOk">Պահպանել</button>' +
          '<button type="button" class="kmBackBtn" id="kmPosAddCancel">' + ((typeof window.KM_BACK_LABEL === 'string' && window.KM_BACK_LABEL) || '← Հետ') + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);
    el.addEventListener('click', function (ev) { if (ev.target === el) closeModal(); });
    el.querySelector('#kmPosAddCancel').onclick = closeModal;

    var titleEl = el.querySelector('#kmPosAddTitle');
    var sectionEl = el.querySelector('#kmPosAddSection');
    var codeEl = el.querySelector('#kmPosAddCode');
    var rankEl = el.querySelector('#kmPosAddRank');
    var personEl = el.querySelector('#kmPosAddPerson');
    var qEl = el.querySelector('#kmPosAddArchQ');
    var listEl = el.querySelector('#kmPosAddArchList');
    var hintEl = el.querySelector('#kmPosAddHint');
    var picked = null;
    var archRows = [];

    function selectedOrgUnitId() {
      var orgUnitEl0 = el.querySelector('#kmPosAddOrgUnit');
      return orgUnitEl0 ? String(orgUnitEl0.value || '').trim() : '';
    }
    function refreshArchRows() {
      var uid = selectedOrgUnitId();
      archRows = uid ? archiveRowsNotYetAdded(uid) : [];
      picked = null;
      if (hintEl) {
        hintEl.textContent = uid
          ? (archRows.length ? '' : 'Այս զորամասի արխիվում պաշտոն չկա։ բացեք Զորամասի Արխիվ։')
          : 'Նախ ընտրեք զորամասը։';
      }
      renderArchPick();
    }

    function fillFromRow(r) {
      if (!r) return;
      picked = r;
      if (titleEl) titleEl.value = r.position || '';
      if (sectionEl) sectionEl.value = r.unit || '';
      if (codeEl) codeEl.value = r.code != null ? String(r.code) : '';
      if (rankEl) rankEl.value = r.rankSlot || '';
      if (personEl) personEl.value = String(r.sourceName || '').trim();
      if (hintEl) {
        hintEl.textContent = r.sourceName
          ? ('Արխիվից ընտրված · Ա․Ա․Հ՝ ' + r.sourceName)
          : 'Արխիվից ընտրված · թափուր տեղ';
      }
      if (qEl) qEl.value = '';
      renderArchPick();
    }

    function matchRows(q) {
      q = String(q || '').trim().toLowerCase();
      var out = [];
      for (var i = 0; i < archRows.length; i++) {
        var r = archRows[i];
        if (!r) continue;
        if (!q) {
          out.push(r);
        } else {
          var blob = ((r.position || '') + ' ' + (r.unit || '') + ' ' + (r.code || '') + ' ' +
            (r.rankSlot || '') + ' ' + (r.sourceName || '')).toLowerCase();
          if (blob.indexOf(q) >= 0) out.push(r);
        }
        if (out.length >= 40) break;
      }
      return out;
    }

    function renderArchPick() {
      if (!listEl) return;
      if (!selectedOrgUnitId()) {
        listEl.innerHTML = '<p class="muted" style="margin:6px;font-size:12px">Նախ ընտրեք զորամասը։</p>';
        return;
      }
      var rows = matchRows(qEl && qEl.value);
      if (!archRows.length) {
        listEl.innerHTML = '<p class="muted" style="margin:6px;font-size:12px">Այս զորամասի արխիվում պաշտոն չկա։ բացեք Զորամասի Արխիվ (Unit Archive)։</p>';
        return;
      }
      if (!rows.length) {
        listEl.innerHTML = '<p class="muted" style="margin:6px;font-size:12px">Համընկնում չկա</p>';
        return;
      }
      listEl.innerHTML = rows.map(function (r, i) {
        return '<button type="button" class="kmPosPickRow" data-arch-pick="' + i + '" ' +
          'style="width:100%;text-align:left;border:0;background:transparent;cursor:pointer">' +
          '<span><b>' + esc(r.position || '') + '</b>' +
          (r.code ? ' · կոդ ' + esc(String(r.code)) : '') +
          '<br><span class="muted">' + esc(r.unit || '') +
          (r.rankSlot ? ' · ' + esc(r.rankSlot) : '') +
          (r.sourceName ? ' · ' + esc(r.sourceName) : ' · թափուր') +
          '</span></span></button>';
      }).join('');
      listEl.querySelectorAll('[data-arch-pick]').forEach(function (btn) {
        btn.onclick = function () {
          var i = Number(btn.getAttribute('data-arch-pick'));
          fillFromRow(rows[i]);
        };
      });
    }

    function tryAutoFillFromFields() {
      var title = String((titleEl && titleEl.value) || '').trim();
      var code = String((codeEl && codeEl.value) || '').trim();
      var section = String((sectionEl && sectionEl.value) || '').trim();
      var hit = null;
      if (code) {
        for (var i = 0; i < archRows.length; i++) {
          if (String(archRows[i].code || '').trim() === code) { hit = archRows[i]; break; }
        }
      }
      if (!hit && title) {
        for (var j = 0; j < archRows.length; j++) {
          var r = archRows[j];
          if (String(r.position || '').trim() !== title) continue;
          if (!section || String(r.unit || '').trim() === section) { hit = r; break; }
        }
      }
      if (!hit) return;
      fillFromRow(hit);
    }

    if (qEl) {
      qEl.addEventListener('input', renderArchPick);
      setTimeout(function () { try { qEl.focus(); } catch (e) {} }, 30);
    }
    if (titleEl) titleEl.addEventListener('change', tryAutoFillFromFields);
    if (titleEl) titleEl.addEventListener('blur', tryAutoFillFromFields);
    if (codeEl) codeEl.addEventListener('change', tryAutoFillFromFields);
    if (codeEl) codeEl.addEventListener('blur', tryAutoFillFromFields);
    var orgSel = el.querySelector('#kmPosAddOrgUnit');
    if (orgSel) orgSel.addEventListener('change', refreshArchRows);
    refreshArchRows();

    el.querySelector('#kmPosAddOk').onclick = async function () {
      var title = String((titleEl && titleEl.value) || '').trim();
      var section = String((sectionEl && sectionEl.value) || '').trim();
      var code = String((codeEl && codeEl.value) || '').trim();
      var rank = String((rankEl && rankEl.value) || '').trim();
      var person = String((personEl && personEl.value) || '').trim();
      var orgUnitEl = el.querySelector('#kmPosAddOrgUnit');
      var orgUnitId = orgUnitEl ? String(orgUnitEl.value || '').trim() : '';
      var orgUnitName = '';
      var orgCorpsId = '';
      if (typeof window.kmListOrgUnits === 'function') {
        var allU = window.kmListOrgUnits();
        for (var ui = 0; ui < allU.length; ui++) {
          if (allU[ui] && allU[ui].id === orgUnitId) {
            orgUnitName = allU[ui].name || '';
            orgCorpsId = allU[ui].corpsId || '';
            break;
          }
        }
      }
      if (!orgUnitId) { toastMsg('Ընտրեք զորամասը', 'warn'); return; }
      if (!picked) { toastMsg('Ընտրեք պաշտոնը զորամասի արխիվից', 'warn'); return; }
      if (!title) title = String(picked.position || '').trim();
      if (!title) { toastMsg('Գրեք պաշտոնը', 'warn'); return; }
      if (!section) section = orgUnitName;
      if (!section) { toastMsg('Գրեք ստորաբաժանումը', 'warn'); return; }
      if (!rank && picked && picked.rankSlot) rank = String(picked.rankSlot).trim();
      if (!code && picked && picked.code != null) code = String(picked.code).trim();
      if (!person && picked && picked.sourceName) person = String(picked.sourceName).trim();

      if (isAlreadyAdded(section, title, code, picked || { sourceName: person })) {
        toastMsg('Այս պաշտոնն արդեն ավելացված է', 'warn');
        return;
      }

      var row = picked
        ? buildUserPosFromArchiveRow(Object.assign({}, picked, {
            position: title,
            unit: section,
            code: code,
            rankSlot: rank,
            sourceName: person
          }), (db.userPositions || []).length + 1)
        : {
            id: 'up_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
            position: title,
            section: section,
            code: code,
            rankSlot: rank,
            personName: person || '',
            vacant: !person,
            order: (db.userPositions || []).length + 1
          };
      if (!picked) {
        row.personName = person || '';
        row.vacant = !person;
      } else {
        row.position = title;
        row.section = section;
        row.code = code;
        row.rankSlot = rank;
        row.personName = person || '';
        row.vacant = !person;
      }
      row.orgUnitId = orgUnitId;
      row.orgUnitName = orgUnitName;
      row.corpsId = orgCorpsId || ((typeof window.kmGetOrgContext === 'function' && window.kmGetOrgContext()) || {}).corpsId || '';
      db.userPositions.push(row);
      bumpPositionsMut();
      persistLivePositionPerson(row, person || '', { manual: true });

      var personIdx = -1;
      if (person) {
        personIdx = ensurePersonFromName(person, row, true);
        try {
          window.kmApplyPositionArchiveToPerson(db.people[personIdx], {
            force: true,
            hints: { name: person, code: code, position: title, section: section }
          });
        } catch (eA) {}
      }

      if (typeof window.kmHishoxutyunLog === 'function') {
        window.kmHishoxutyunLog({
          section: 'positions',
          sectionLabel: 'Պաշտոն',
          action: 'add',
          detail: 'Ավելացնել պաշտոն՝ ' + (row.position || title || '') +
            (row.section || section ? (' · ' + (row.section || section)) : '') +
            (row.code || code ? (' · կոդ՝ ' + (row.code || code)) : '') +
            (person ? (' · կցված է՝ ' + person) : ' · թափուր')
        });
      }
      if (typeof save === 'function') await save(true);
      closeModal();
      toastMsg(person ? ('Պահպանվեց · ' + person) : 'Պաշտոնը ավելացվեց (թափուր)', 'ok');
      window.kmOpenPositionsPage();
      if (person && personIdx >= 0 && typeof window.kmOpenPersonCard === 'function') {
        setTimeout(function () { window.kmOpenPersonCard(personIdx); }, 60);
      }
    };
  };

  window.kmPositionAddAuto = function () {
    toastMsg('Ավտոմատ ավելացումը հանված է։ Ավելացրեք պաշտոնը մեկ-մեկ։', 'warn');
  };
  window.kmPositionMakeVacant = async function (posId) {
    if (!canEdit()) { toastMsg('Դիտորդի իրավունք', 'error'); return; }
    var pos = findPos(posId);
    if (!pos) { toastMsg('Պաշտոնը չգտնվեց', 'warn'); return; }
    ensureStore();
    var prev = resolvePositionPerson(pos);
    var msg = prev
      ? ('Դարձնե՞լ թափուր՝ «' + prev + '» · ' + (pos.position || '') + '։\nՔարտի տվյալները կզրոյանան։')
      : ('Դարձնե՞լ թափուր՝ ' + (pos.position || '') + '։');
    if (!confirm(msg)) return;
    if (prev) {
      var stillElsewhere = (catalog().positions || []).some(function (p) {
        if (!p || p.id === posId) return false;
        return samePerson(resolvePositionPerson(p), prev);
      });
      if (!stillElsewhere) {
        var idx = findPersonIndex(prev);
        if (idx < 0) {
          ensurePersonFromName(prev, pos, true);
          idx = findPersonIndex(prev);
        }
        if (idx >= 0) zeroPersonCard(db.people[idx]);
        markPeopleRemoved(prev, 'vacant');
      }
    }
    persistLivePositionPerson(pos, '', { previousName: prev || '' });
    if (typeof window.kmHishoxutyunLog === 'function') {
      window.kmHishoxutyunLog({
        section: 'positions',
        sectionLabel: 'Պաշտոն',
        action: 'vacant',
        detail: 'Դարձնել թափուր՝ ' + (pos.position || '') +
          (pos.section ? (' · ' + pos.section) : '') +
          (prev ? (' · հանվել է՝ ' + prev) : '')
      });
    }
    await persistPersonnelNow();
    toastMsg('Անձը տեղափոխվեց պահեստազորային արխիվ, հաստիքը թափուր է', 'ok');
    window.kmOpenPositionsPage();
  };

  function cloneJson(v) {
    try { return JSON.parse(JSON.stringify(v)); } catch (e) { return v; }
  }
  function promoSliceKey(corpsId, unitId) {
    if (typeof window.kmOrgSliceKey === 'function') return window.kmOrgSliceKey(corpsId, unitId) || '';
    return String(corpsId || '') + '::' + String(unitId || '');
  }
  function promoLiveBlob() {
    ensureStore();
    return db;
  }
  function promoBlobFor(corpsId, unitId) {
    var key = promoSliceKey(corpsId, unitId);
    var cur = typeof window.kmActiveCorpsSliceId === 'function' ? window.kmActiveCorpsSliceId() : '';
    if (!key || key === cur) return promoLiveBlob();
    if (typeof db === 'undefined' || !db.kmCorpsData || typeof db.kmCorpsData !== 'object') {
      return { people: [], userPositions: [], positionAssignments: {}, positionArchives: [] };
    }
    return db.kmCorpsData[key] || { people: [], userPositions: [], positionAssignments: {}, positionArchives: [] };
  }
  function promoResolveName(pos, blob) {
    if (!pos) return '';
    var asg = blob && blob.positionAssignments && blob.positionAssignments[pos.id];
    if (asg && asg.vacant) return '';
    if (pos.vacant === true && !(asg && asg.manual && asg.personName)) return '';
    function pick(n) {
      n = String(n || '').trim();
      return looksLikePersonName(n) ? n : '';
    }
    if (asg && asg.manual) return pick(asg.personName);
    if (asg && asg.personName && !asg.vacant) return pick(asg.personName);
    return pick(pos.personName) || pick(pos.sourceName);
  }
  function promoArchivesFor(corpsId, unitId, blob) {
    var cid = String(corpsId || '').trim();
    var uid = String(unitId || '').trim();
    var seen = Object.create(null);
    var out = [];
    function add(list, strictScope) {
      (list || []).forEach(function (a) {
        if (!a || a.builtin || !a.id || seen[a.id]) return;
        var ac = String(a.corpsId || '').trim();
        var au = String(a.unitId || '').trim();
        if (cid && ac && ac !== cid) return;
        if (uid && au && au !== uid) return;
        if (strictScope) {
          if (cid && ac !== cid) return;
          if (uid && au !== uid) return;
        }
        seen[a.id] = 1;
        out.push(a);
      });
    }
    add(blob && blob.positionArchives, false);
    return out;
  }
  function promoIndexUserPos(blob) {
    var byArchRow = Object.create(null);
    var byTitleCode = Object.create(null);
    var list = (blob && blob.userPositions) || [];
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (!p) continue;
      if (p.archId && p.excelRow != null && String(p.excelRow) !== '') {
        byArchRow[String(p.archId) + ':' + String(p.excelRow)] = p;
      }
      var tk = String(p.position || '').trim().toLowerCase() + '|' + String(p.code || '').replace(/\s+/g, '');
      if (tk !== '|' && !byTitleCode[tk]) byTitleCode[tk] = p;
    }
    return { byArchRow: byArchRow, byTitleCode: byTitleCode };
  }
  function promoLookupUserPos(idx, arch, r, rec) {
    if (!idx) return null;
    if (arch && arch.id && rec.excelRow != null && String(rec.excelRow) !== '') {
      var hit = idx.byArchRow[String(arch.id) + ':' + String(rec.excelRow)];
      if (hit) return hit;
    }
    var tk = String(rec.position || '').trim().toLowerCase() + '|' + String(rec.code || '').replace(/\s+/g, '');
    return (tk !== '|') ? (idx.byTitleCode[tk] || null) : null;
  }
  function promoPositionsFromBlob(blob, corpsId, unitId) {
    if (!blob) blob = { userPositions: [], positionArchives: [], positionAssignments: {} };
    var uid = String(unitId || '').trim();
    var cid = String(corpsId || '').trim();
    var seen = Object.create(null);
    var positions = [];
    var idx = promoIndexUserPos(blob);
    function pushRec(rec) {
      var k = String(rec.archId || '') + ':' + String(rec.excelRow || '') + ':' + String(rec.id || rec.position || '');
      if (seen[k]) return;
      seen[k] = 1;
      positions.push(rec);
    }
    promoArchivesFor(cid, uid, blob).forEach(function (arch) {
      (arch.rows || []).forEach(function (r, i) {
        if (!r || r.type === 'section' || !String(r.position || '').trim()) return;
        var pname = personDisplayName(r);
        var rec = {
          id: 'archv_' + String(arch.id || uid) + '_' + (r.excelRow != null ? r.excelRow : i),
          section: r.unit || r.section || '',
          unit: r.unit || r.section || '',
          position: r.position || '',
          code: r.code || '',
          personName: pname,
          sourceName: pname,
          rankSlot: r.rankSlot || '',
          rank: r.rankSlot || r.rank || '', /* V6: rankSlot preferred; rank kept as alt */
          orgUnitId: uid || arch.unitId || '',
          corpsId: cid || arch.corpsId || '',
          fromArchive: true,
          virtual: true,
          archId: arch.id || '',
          excelRow: r.excelRow != null ? r.excelRow : (i + 1),
          seq: r.seq || '',
          catalogId: r.catalogId || r.id || ''
        };
        /* KM_PROMO_ROW_CODE_FROM_VUS_V1 */
        rec.code = (typeof kmRowStaffingCode === 'function' ? kmRowStaffingCode(r) : (r.code || r.vus || rec.code || ''));
        var up = promoLookupUserPos(idx, arch, r, rec);
        if (up) {
          rec.id = up.id;
          rec.virtual = false;
          rec._fromUserPos = true;
          if (up.personName) rec.personName = up.personName;
        }
        pushRec(rec);
      });
    });
    (blob.userPositions || []).forEach(function (p) {
      if (!p) return;
      var pu = String(p.orgUnitId || '').trim();
      var pc = String(p.corpsId || '').trim();
      if (pc && cid && pc !== cid) return;
      if (pu && uid && pu !== uid) return;
      pushRec(Object.assign({}, p, {
        rankSlot: p.rankSlot || p.rank || '',
        orgUnitId: uid || p.orgUnitId || '',
        corpsId: cid || p.corpsId || ''
      }));
    });
    return positions;
  }
  function promoListVacant(corpsId, unitId) {
    var blob = promoBlobFor(corpsId, unitId) || { userPositions: [], positionArchives: [], positionAssignments: {} };
    return promoPositionsFromBlob(blob, corpsId, unitId).filter(function (p) {
      var asg = blob.positionAssignments && blob.positionAssignments[p.id];
      if (asg && asg.vacant) return true;
      if (asg && asg.manual && asg.personName && looksLikePersonName(asg.personName)) return false;
      return !promoResolveName(p, blob);
    });
  }
  function promoFindCurrentPositions(name, blob) {
    blob = blob || promoLiveBlob();
    var out = [];
    (blob.userPositions || []).forEach(function (p) {
      if (p && samePerson(promoResolveName(p, blob), name)) out.push(p);
    });
    return out;
  }
  function promoClearStaffPerson(row) {
    if (!row || row.type === 'section') return;
    row.name = '';
    row.sourceName = '';
    row.personName = '';
    row.contact = '';
    row.idCard = '';
    row.hsk = '';
    row.passport = '';
    row.birth = '';
    row.address = '';
    row.family = '';
    row.education = '';
    row.blood = '';
    row.phone = '';
    row._shtatDirty = true;
  }
  function promoCopyStaffPayload(fromRow, toRow) {
    if (!fromRow || !toRow) return;
    var skip = {
      type: 1, position: 1, unit: 1, section: 1, code: 1, rankSlot: 1, seq: 1,
      excelRow: 1, archId: 1, catalogId: 1, id: 1, vacant: 1, _shtatDirty: 1
    };
    Object.keys(fromRow).forEach(function (k) {
      if (!k || skip[k]) return;
      if (fromRow[k] == null || fromRow[k] === '') return;
      toRow[k] = fromRow[k];
    });
  }
  function promoFillStaffFromPerson(row, person, pos, staffSnap) {
    if (!row || !person) return;
    promoCopyStaffPayload(staffSnap, row);
    if (staffSnap) {
      var oldCode = String(staffSnap.code || '').trim();
      if (oldCode && String(row.vus || '').trim() === oldCode) row.vus = '';
      if (oldCode && String(row.specialty || '').trim() === oldCode) row.specialty = '';
    }
    row.name = person.name || '';
    row.sourceName = person.name || '';
    row.personName = person.name || '';
    if (pos) {
      if (pos.position) row.position = pos.position;
      if (pos.section || pos.unit) row.unit = pos.section || pos.unit;
      if (pos.code != null && String(pos.code).trim()) row.code = String(pos.code).trim();
      if (pos.rankSlot) row.rankSlot = pos.rankSlot;
    }
    if (person.rank) row.rank = person.rank;
    if (person.phone) row.contact = person.phone;
    if (person.education) row.education = person.education;
    if (person.idCard) row.idCard = person.idCard;
    if (person.hsk) row.hsk = person.hsk;
    if (person.address) row.address = person.address;
    if (person.familyStatus || person.family) row.family = person.familyStatus || person.family;
    if (person.bloodGroup) row.blood = person.bloodGroup;
    if (person.secrecyClearance) {
      row.secret = person.secrecyClearance === 'none' ? 'Չունի' : person.secrecyClearance;
    }
    var spec = String(person.specialty || person.vus || '').trim();
    if (looksLikeStaffCode(spec)) spec = '';
    if (person.postCode && spec === String(person.postCode).trim()) spec = '';
    if (pos && pos.code && spec === String(pos.code).trim()) spec = '';
    if (spec) row.vus = spec;
    if (person.postCode && !row.code) row.code = person.postCode;
    var appointed = String(person.appointmentDate || person.rankAppointedAt || '').trim();
    if (appointed) {
      row.lastAccept = appointed;
      row.appointmentDate = appointed;
      if (!String(row.posOrder || '').trim()) row.posOrder = appointed;
    }
    row._shtatDirty = true;
  }
  function promoWalkStaffRows(blob, fn) {
    if (!blob) return;
    (blob.positionArchives || []).forEach(function (arch) {
      (arch && arch.rows || []).forEach(function (r) { fn(r, 'archive', arch); });
    });
    var troopRows = ((((blob.troopStructure || {}).staff || {}).rows) || []);
    troopRows.forEach(function (r) { fn(r, 'troop', null); });
  }
  function promoVacateInBlob(blob, name) {
    if (!blob || !name) return [];
    var vacated = [];
    (blob.userPositions || []).forEach(function (pos) {
      if (!pos) return;
      if (!samePerson(promoResolveName(pos, blob), name) && !samePerson(pos.personName, name)) return;
      pos.personName = '';
      pos.sourceName = '';
      pos.vacant = true;
      if (!blob.positionAssignments || typeof blob.positionAssignments !== 'object') blob.positionAssignments = {};
      blob.positionAssignments[pos.id] = {
        personName: '',
        vacant: true,
        manual: true,
        userEdited: true,
        position: pos.position,
        section: pos.section,
        code: pos.code || '',
        previousName: name,
        clearedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      vacated.push(pos);
    });
    promoWalkStaffRows(blob, function (row, kind, arch) {
      if (!row || row.type === 'section') return;
      if (samePerson(row.name, name) || samePerson(row.sourceName, name) || samePerson(row.personName, name)) {
        promoClearStaffPerson(row);
        if (arch) {
          arch._shtatUserEdited = true;
          arch._shtatCols = 'A-AU';
          arch.updatedAt = new Date().toISOString();
        }
      }
    });
    return vacated;
  }
  function promoMatchStaffRow(row, pos) {
    if (!row || !pos || row.type === 'section') return false;
    if (pos.excelRow != null && String(pos.excelRow) !== '' && String(row.excelRow) === String(pos.excelRow)) {
      if (!pos.archId || !row.archId || String(pos.archId).trim() === String(row.archId).trim()) return true;
    }
    if (String(pos.archId || '').trim() && String(row.archId || '').trim() === String(pos.archId).trim()) {
      if (pos.excelRow != null && String(pos.excelRow) !== '' && String(row.excelRow) === String(pos.excelRow)) return true;
    }
    var sameTitle = String(row.position || '').trim().toLowerCase() ===
      String(pos.position || '').trim().toLowerCase();
    if (!sameTitle) return false;
    var codeA = String(row.code || '').replace(/\s+/g, '');
    var codeB = String(pos.code || '').replace(/\s+/g, '');
    if (codeA && codeB && codeA !== codeB) return false;
    var secA = String(row.unit || row.section || '').trim().toLowerCase();
    var secB = String(pos.section || pos.unit || '').trim().toLowerCase();
    if (secA && secB && secA !== secB) return false;
    return true;
  }
  function promoFillTargetStaff(blob, pos, person, staffSnap) {
    if (!blob || !pos || !person) return;
    var filled = false;
    function applyRow(row, arch, overwrite) {
      if (filled || !promoMatchStaffRow(row, pos)) return;
      if (!overwrite && personDisplayName(row) && !samePerson(row.name, person.name)) return;
      promoFillStaffFromPerson(row, person, pos, staffSnap);
      filled = true;
      filled = true;
      if (arch) {
        arch._shtatUserEdited = true;
        arch._shtatCols = 'A-AU';
        arch.updatedAt = new Date().toISOString();
      }
    }
    promoWalkStaffRows(blob, function (row, kind, arch) { applyRow(row, arch, false); });
    if (filled) return;
    promoWalkStaffRows(blob, function (row, kind, arch) { applyRow(row, arch, true); });
  }
  function promoPullLinked(blob, name) {
    name = String(name || '').trim();
    var out = {
      dossier: null,
      vacations: [],
      medical: [],
      docs: [],
      penalties: [],
      penaltiesArchive: [],
      encouragements: [],
      characteristic: null,
      leavePlan: [],
      examDrafts: [],
      unitExamDrafts: [],
      trialCharDrafts: [],
      unitCharDrafts: [],
      termRanks: [],
      registrations: [],
      unitBadDays: [],
      substitutions: [],
      monthSummaries: []
    };
    if (!blob || !name) return out;
    if (blob.unitDossiers) {
      if (blob.unitDossiers[name]) out.dossier = cloneJson(blob.unitDossiers[name]);
      else {
        Object.keys(blob.unitDossiers).forEach(function (k) {
          if (!out.dossier && samePerson(k, name)) out.dossier = cloneJson(blob.unitDossiers[k]);
        });
      }
    }
    function take(arr, field) {
      return (arr || []).filter(function (r) { return r && samePerson(r[field] || r.personName || r.person, name); }).map(cloneJson);
    }
    out.vacations = take(blob.vacations, 'person');
    out.medical = take(blob.unitMedical, 'person');
    out.docs = take(blob.unitDocs, 'person');
    out.penalties = take(blob.disciplinePenalties, 'personName');
    out.penaltiesArchive = take(blob.disciplinePenaltiesArchive, 'personName');
    out.encouragements = take(blob.personEncouragements, 'personName');
    out.leavePlan = take((blob.unitLeavePlan && blob.unitLeavePlan.rows) || [], 'person');
    out.examDrafts = take(blob.trialExamDrafts, 'person');
    out.unitExamDrafts = take(blob.unitTrialExamDrafts, 'person');
    out.trialCharDrafts = take(blob.trialCharDrafts, 'person');
    out.unitCharDrafts = take(blob.unitCharDrafts, 'person');
    out.termRanks = take((blob.unitTermWatch && blob.unitTermWatch.ranks) || [], 'person');
    out.registrations = take(blob.registrations, 'person');
    out.unitBadDays = take(blob.unitBadDays, 'person');
    out.substitutions = take(blob.substitutions, 'person');
    out.monthSummaries = take(blob.monthSummaries, 'person');
    var chars = blob.personCharacteristics || {};
    Object.keys(chars).forEach(function (k) {
      if (chars[k] && samePerson(chars[k].personName || k, name)) out.characteristic = cloneJson(chars[k]);
    });
    return out;
  }
  function promoDropLinked(blob, name) {
    if (!blob || !name) return;
    if (blob.unitDossiers) {
      Object.keys(blob.unitDossiers).forEach(function (k) {
        if (samePerson(k, name)) delete blob.unitDossiers[k];
      });
    }
    function drop(arr, field) {
      if (!Array.isArray(arr)) return arr;
      return arr.filter(function (r) { return !(r && samePerson(r[field] || r.personName || r.person, name)); });
    }
    blob.vacations = drop(blob.vacations, 'person');
    blob.unitMedical = drop(blob.unitMedical, 'person');
    blob.unitDocs = drop(blob.unitDocs, 'person');
    blob.disciplinePenalties = drop(blob.disciplinePenalties, 'personName');
    blob.disciplinePenaltiesArchive = drop(blob.disciplinePenaltiesArchive, 'personName');
    blob.personEncouragements = drop(blob.personEncouragements, 'personName');
    blob.trialExamDrafts = drop(blob.trialExamDrafts, 'person');
    blob.unitTrialExamDrafts = drop(blob.unitTrialExamDrafts, 'person');
    blob.trialCharDrafts = drop(blob.trialCharDrafts, 'person');
    blob.unitCharDrafts = drop(blob.unitCharDrafts, 'person');
    blob.registrations = drop(blob.registrations, 'person');
    blob.unitBadDays = drop(blob.unitBadDays, 'person');
    blob.substitutions = drop(blob.substitutions, 'person');
    blob.monthSummaries = drop(blob.monthSummaries, 'person');
    if (blob.unitTermWatch && Array.isArray(blob.unitTermWatch.ranks)) {
      blob.unitTermWatch.ranks = drop(blob.unitTermWatch.ranks, 'person');
    }
    if (blob.unitLeavePlan && Array.isArray(blob.unitLeavePlan.rows)) {
      blob.unitLeavePlan.rows = drop(blob.unitLeavePlan.rows, 'person');
    }
    if (blob.personCharacteristics) {
      Object.keys(blob.personCharacteristics).forEach(function (k) {
        if (blob.personCharacteristics[k] && samePerson(blob.personCharacteristics[k].personName, name)) {
          delete blob.personCharacteristics[k];
        }
      });
    }
    if (Array.isArray(blob.people)) {
      blob.people = blob.people.filter(function (p) { return !(p && samePerson(p.name, name)); });
    }
  }
  function promoMergeLinked(blob, name, person, linked) {
    if (!blob || !person) return;
    if (!Array.isArray(blob.people)) blob.people = [];
    var idx = -1;
    for (var i = 0; i < blob.people.length; i++) {
      if (blob.people[i] && samePerson(blob.people[i].name, name)) { idx = i; break; }
    }
    if (idx < 0) blob.people.push(person);
    else blob.people[idx] = person;
    if (!blob.unitDossiers || typeof blob.unitDossiers !== 'object') blob.unitDossiers = {};
    if (linked.dossier) blob.unitDossiers[name] = linked.dossier;
    function mergeArr(key, rows) {
      if (!rows || !rows.length) return;
      if (!Array.isArray(blob[key])) blob[key] = [];
      var have = Object.create(null);
      blob[key].forEach(function (r) { if (r && r.id) have[String(r.id)] = 1; });
      rows.forEach(function (r) {
        if (!r) return;
        if (r.id && have[String(r.id)]) return;
        blob[key].push(r);
        if (r.id) have[String(r.id)] = 1;
      });
    }
    mergeArr('vacations', linked.vacations);
    mergeArr('unitMedical', linked.medical);
    mergeArr('unitDocs', linked.docs);
    mergeArr('disciplinePenalties', linked.penalties);
    mergeArr('disciplinePenaltiesArchive', linked.penaltiesArchive);
    mergeArr('personEncouragements', linked.encouragements);
    mergeArr('trialExamDrafts', linked.examDrafts);
    mergeArr('unitTrialExamDrafts', linked.unitExamDrafts);
    mergeArr('trialCharDrafts', linked.trialCharDrafts);
    mergeArr('unitCharDrafts', linked.unitCharDrafts);
    mergeArr('registrations', linked.registrations);
    mergeArr('unitBadDays', linked.unitBadDays);
    mergeArr('substitutions', linked.substitutions);
    mergeArr('monthSummaries', linked.monthSummaries);
    if (linked.termRanks && linked.termRanks.length) {
      if (!blob.unitTermWatch || typeof blob.unitTermWatch !== 'object') blob.unitTermWatch = { warnDays: 30, ranks: [], dismissed: [] };
      if (!Array.isArray(blob.unitTermWatch.ranks)) blob.unitTermWatch.ranks = [];
      var haveTerm = Object.create(null);
      blob.unitTermWatch.ranks.forEach(function (r) {
        var tk = String((r && (r.id || r.person || '')) || '') + '|' + String((r && r.due) || '') + '|' + String((r && r.rank) || '');
        haveTerm[tk] = 1;
      });
      linked.termRanks.forEach(function (r) {
        if (!r) return;
        var tk = String(r.id || r.person || '') + '|' + String(r.due || '') + '|' + String(r.rank || '');
        if (haveTerm[tk]) return;
        blob.unitTermWatch.ranks.push(r);
        haveTerm[tk] = 1;
      });
    }
    if (linked.leavePlan && linked.leavePlan.length) {
      if (!blob.unitLeavePlan || typeof blob.unitLeavePlan !== 'object') blob.unitLeavePlan = { rows: [] };
      if (!Array.isArray(blob.unitLeavePlan.rows)) blob.unitLeavePlan.rows = [];
      var haveLeave = Object.create(null);
      blob.unitLeavePlan.rows.forEach(function (r) { if (r && r.id) haveLeave[String(r.id)] = 1; });
      linked.leavePlan.forEach(function (r) {
        if (!r) return;
        if (r.id && haveLeave[String(r.id)]) return;
        blob.unitLeavePlan.rows.push(r);
        if (r.id) haveLeave[String(r.id)] = 1;
      });
    }
    if (linked.characteristic) {
      if (!blob.personCharacteristics || typeof blob.personCharacteristics !== 'object') blob.personCharacteristics = {};
      blob.personCharacteristics[String(name).toLowerCase()] = linked.characteristic;
      blob.personCharacteristics[name] = linked.characteristic;
    }
  }
  function promoMaterialize(blob, pos, corpsId, unitId, unitName) {
    if (!blob || !pos) return pos;
    if (!Array.isArray(blob.userPositions)) blob.userPositions = [];
    var existing = blob.userPositions.filter(function (p) { return p && p.id === pos.id; })[0];
    if (existing) return existing;
    var row = {
      id: String(pos.id).indexOf('archv_') === 0
        ? ('up_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8))
        : (pos.id || ('up_' + Date.now())),
      position: pos.position || '',
      section: pos.section || pos.unit || '',
      unit: pos.unit || pos.section || '',
      code: pos.code || '',
      rankSlot: pos.rankSlot || '',
      personName: '',
      vacant: true,
      order: blob.userPositions.length + 1,
      catalogId: pos.catalogId || '',
      excelRow: pos.excelRow != null ? pos.excelRow : '',
      archId: pos.archId || '',
      seq: pos.seq || '',
      fromArchive: !!pos.fromArchive,
      orgUnitId: unitId || pos.orgUnitId || '',
      orgUnitName: unitName || '',
      corpsId: corpsId || pos.corpsId || ''
    };
    blob.userPositions.push(row);
    return row;
  }

  function promoNormRank(v) {
    if (typeof window.kmNormalizeRank === 'function') return window.kmNormalizeRank(v);
    if (typeof kmNormalizeRank === 'function') return kmNormalizeRank(v);
    return String(v || '').trim();
  }
  function promoRankKey(v) {
    return String(promoNormRank(v) || '').replace(/[\s.․·•]/g, '').toLowerCase();
  }
  function promoRankLadder() {
    return ['շ-ն', 'կրտ․ս-տ', 'ս-տ', 'ավ․ս-տ', 'ավագ', 'ենթասպա', 'ավագ ենթասպա', 'լ-տ', 'ավ․լ-տ', 'կ-ն', 'մ-ր', 'փ/գ-տ', 'գ-տ', 'գեներալ'];
  }
  function promoChainCanon(code) {
    var n = promoNormRank(code);
    if (!n) return '';
    if (/^գեներալ/i.test(n) || n === 'գեն.' || n === 'գեն') return 'գեներալ';
    var alias = {
      'հդ ս-տ': 'ենթասպա',
      'հվ ս-տ': 'ավագ ենթասպա',
      'հգմ -ս-տ': 'ավագ ենթասպա',
      'գնդի սերժանտ': 'ավագ ենթասպա',
      'կորպուսի սերժանտ': 'ավագ ենթասպա'
    };
    if (alias[n]) return alias[n];
    return n;
  }
  function promoRankIndex(code) {
    var n = promoChainCanon(code);
    if (!n) return -1;
    var ranks = promoRankLadder();
    var i = ranks.indexOf(n);
    if (i >= 0) return i;
    var key = promoRankKey(n);
    for (var j = 0; j < ranks.length; j++) {
      if (promoRankKey(ranks[j]) === key) return j;
    }
    return -1;
  }
  function promoNextRank(current) {
    var ranks = promoRankLadder();
    var i = promoRankIndex(current);
    if (i < 0 || i >= ranks.length - 1) return '';
    return ranks[i + 1];
  }
  function promoTargetRanksForPerson(personRank) {
    var ranks = promoRankLadder();
    var i = promoRankIndex(personRank);
    if (i < 0) return [];
    var out = [ranks[i]];
    if (i + 1 < ranks.length) out.push(ranks[i + 1]);
    if (i + 2 < ranks.length) out.push(ranks[i + 2]);
    return out;
  }
  function promoPersonFitsPost(personRank, posRank) {
    var pi = promoRankIndex(personRank);
    var ei = promoRankIndex(posRank);
    if (pi < 0 || ei < 0) return promoRankEquals(personRank, posRank);
    if (ei === pi) return true;
    if (ei === pi + 1 || ei === pi + 2) return true;
    return false;
  }
  function promoRankLabel(code) {
    var map = {
      'շ-ն': 'շարքային',
      'կրտ․ս-տ': 'կրտսեր սերժանտ',
      'ս-տ': 'սերժանտ',
      'ավ․ս-տ': 'ավագ սերժանտ',
      'ավագ': 'ավագ',
      'հդ ս-տ': 'ենթասպա',
      'ենթասպա': 'ենթասպա',
      'ավագ ենթասպա': 'ավագ ենթասպա',
      'հվ ս-տ': 'ավագ ենթասպա',
      'հգմ -ս-տ': 'ավագ ենթասպա',
      'գնդի սերժանտ': 'գնդի սերժանտ',
      'կորպուսի սերժանտ': 'կորպուսի սերժանտ',
      'լ-տ': 'լեյտենանտ',
      'ավ․լ-տ': 'ավագ լեյտենանտ',
      'կ-ն': 'կապիտան',
      'մ-ր': 'մայոր',
      'փ/գ-տ': 'փոխգնդապետ',
      'գ-տ': 'գնդապետ',
      'գեներալ': 'գեներալ'
    };
    var n = promoChainCanon(code);
    var idx = promoRankIndex(n);
    if (idx >= 0) n = promoRankLadder()[idx];
    return map[n] || n || '';
  }
  function promoRankEquals(a, b) {
    var ia = promoRankIndex(a);
    var ib = promoRankIndex(b);
    if (ia >= 0 && ib >= 0) return ia === ib;
    var na = promoChainCanon(a);
    var nb = promoChainCanon(b);
    if (!na || !nb) return false;
    if (na === nb) return true;
    return promoRankKey(na) === promoRankKey(nb);
  }
  function promoPosRank(p) {
    if (!p) return '';
    var raw = p.rankSlot || p.rank || '';
    var n = promoChainCanon(raw);
    if (promoRankIndex(n) >= 0) return promoRankLadder()[promoRankIndex(n)];
    return n;
  }
  function promoRowMatchesExcel(r, pos) {
    if (!r || !pos) return false;
    if (pos.excelRow != null && String(pos.excelRow) !== '' && String(r.excelRow) === String(pos.excelRow)) return true;
    var pc = String(pos.code || '').trim();
    var rc = String(r.code || '').trim();
    if (pc && rc && pc === rc) {
      if (!pos.position || String(pos.position).trim() === String(r.position || '').trim()) return true;
    }
    var pp = String(pos.position || '').trim();
    var rp = String(r.position || '').trim();
    if (pp && rp && pp === rp) {
      var pu = String(pos.section || pos.unit || '').trim();
      var ru = String(r.unit || r.section || '').trim();
      if (!pu || !ru || pu === ru) return true;
    }
    return false;
  }
  function promoExcelFacts(pos, corpsId, unitId) {
    var facts = {
      rankSlot: pos ? (pos.rankSlot || pos.rank || '') : '',
      code: pos ? String(pos.code || '').trim() : '',
      position: pos ? String(pos.position || '').trim() : '',
      excelRow: pos && pos.excelRow != null ? pos.excelRow : ''
    };
    if (!pos) return facts;
    try {
      var blob = (corpsId || unitId) ? (promoBlobFor(corpsId, unitId) || promoLiveBlob()) : promoLiveBlob();
      var archives = promoArchivesFor(corpsId || pos.corpsId, unitId || pos.orgUnitId, blob);
      var a, i, arch, rows, r;
      for (a = 0; a < archives.length; a++) {
        arch = archives[a];
        if (pos.archId && arch && arch.id && String(arch.id) !== String(pos.archId)) continue;
        rows = (arch && arch.rows) || [];
        for (i = 0; i < rows.length; i++) {
          r = rows[i];
          if (!r || r.type === 'section') continue;
          if (!promoRowMatchesExcel(r, pos)) continue;
          if (r.rankSlot) facts.rankSlot = r.rankSlot;
          if (r.code) facts.code = String(r.code).trim();
          if (r.position) facts.position = String(r.position).trim();
          if (r.excelRow != null) facts.excelRow = r.excelRow;
          return facts;
        }
      }
    } catch (eXf) {}
    return facts;
  }
  function promoApplyExcelFacts(pos, corpsId, unitId) {
    var f = promoExcelFacts(pos, corpsId, unitId);
    if (!pos) return f;
    if (f.rankSlot) {
      pos.rankSlot = f.rankSlot;
      pos.rank = f.rankSlot;
    }
    if (f.code) pos.code = f.code;
    if (f.position) pos.position = f.position;
    if (f.excelRow != null && String(f.excelRow) !== '') pos.excelRow = f.excelRow;
    return f;
  }
  window.kmPromoExcelFacts = promoExcelFacts;
  window.kmPersonFitsExcelRank = promoPersonFitsPost;
  function promoPersonRank(person) {
    if (!person) return '';
    var r = promoChainCanon(person.rank);
    if (promoRankIndex(r) >= 0) return promoRankLadder()[promoRankIndex(r)];
    if (r) return r;
    try {
      var posts = promoFindCurrentPositions(person.name);
      if (posts && posts[0]) {
        var pr = promoPosRank(posts[0]);
        if (pr) return pr;
      }
    } catch (eR) {}
    return '';
  }
  
/* === KM_PROMO_NEXT_RANK_VACANTS_V1 helpers === */
/* KM_PROMO_ARCHIVE_NEXT_RANK_V6 — formal SSOT rows + archive code→rank map +
   ALL vacants at IMMEDIATE next rank; also same-rank higher staffing code.
   Never skip ranks (12↛23). Dedupe by id. */
function kmPromoNormRank_V1(s) {
  /* KM_PROMO_FORMAL_SSOT_V6b: archive abbrevs + unicode dashes + strip բ/ծ/(Պ) */
  var t = String(s || '').toLowerCase().replace(/և/g, 'եւ').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  t = t.replace(/[․]/g, '.').replace(/[\u2010\u2011\u2012\u2013\u2014\u2212‐‑‒–—−]/g, '-');
  t = t.replace(/^\s*բ\s*\/\s*ծ\s+/i, '').replace(/^\s*բ\/ծ\s*/i, '');
  t = t.replace(/\s*\([^)]*\)\s*$/g, '').replace(/\s+/g, ' ').trim();
  if (t.indexOf('փոխգնդապետ') >= 0 || /^փ\/?գ[\-.]?տ$/.test(t) || t === 'փ/գ-տ' || t === 'փգտ') return 'փոխգնդապետ';
  if ((t.indexOf('գնդապետ') >= 0 || /^գ[\-.]?տ$/.test(t) || t === 'գ-տ') && t.indexOf('փոխ') < 0 && t.indexOf('փ/') < 0) return 'գնդապետ';
  if (t.indexOf('մայոր') >= 0 || t === 'մ-ր' || t === 'մր' || /^մ[\-.]?ր$/.test(t)) return 'մայոր';
  if (t.indexOf('կապիտան') >= 0 || t === 'կ-ն' || t === 'կն' || /^կ[\-.]?ն$/.test(t)) return 'կապիտան';
  if (t.indexOf('ավագ լեյտենանտ') >= 0 || t.indexOf('ավագ լեյտ') >= 0 ||
      t === 'ավ.լ-տ' || t === 'ավ. լ-տ' || t === 'ավ/լ-տ' ||
      /^ավ[\.\/]?\s*լ[\-.]?տ$/.test(t) || /^ավ\/?լ[\-.]?տ$/.test(t)) return 'ավագ լեյտենանտ';
  if ((t.indexOf('լեյտենանտ') >= 0 || t === 'լ-տ' || t === 'լտ' || /^լ[\-.]?տ$/.test(t)) &&
      t.indexOf('ավագ') < 0 && t.indexOf('ավ.') < 0 && t.indexOf('ավ/') < 0) return 'լեյտենանտ';
  if (t.indexOf('ավագ ենթասպա') >= 0 || t === 'ավ.ենթ.' || t === 'ավ/ենթ.' || /^ավ[\.\/]?\s*ենթ/.test(t)) return 'ավագ ենթասպա';
  if ((t.indexOf('ենթասպա') >= 0 || t === 'ենթ.' || t === 'ենթ' || /^ենթ/.test(t)) && t.indexOf('ավագ') < 0 && t.indexOf('ավ.') < 0 && t.indexOf('ավ/') < 0) return 'ենթասպա';
  if (t.indexOf('ավագ սերժանտ') >= 0 || t.indexOf('ավագ սերժ') >= 0 ||
      t === 'ավ/ս-տ' || t === 'ավ.ս-տ' || t === 'ավ. ս-տ' ||
      /^ավ[\.\/]?\s*ս[\-.]?տ/.test(t)) return 'ավագ սերժանտ';
  if (t.indexOf('կրտսեր սերժանտ') >= 0 || t.indexOf('կրտսեր սերժ') >= 0 ||
      t === 'կ/ս-տ' || t === 'կրտ.ս-տ' ||
      /^կրտ[\.\/]?\s*ս[\-.]?տ/.test(t) || /^կ\/?-?ս[\-.]?տ$/.test(t)) return 'կրտսեր սերժանտ';
  if ((t.indexOf('սերժանտ') >= 0 || t === 'ս-տ' || t === 'ստ' || /^ս[\-.]?տ$/.test(t)) &&
      t.indexOf('ավագ') < 0 && t.indexOf('ավ.') < 0 && t.indexOf('ավ/') < 0 && t.indexOf('կրտ') < 0 && t.indexOf('կ/') < 0) return 'սերժանտ';
  if (t === 'ավագ' || (t.indexOf('ավագ') >= 0 && t.indexOf('լեյտ') < 0 && t.indexOf('սերժ') < 0 && t.indexOf('ենթա') < 0 && t.indexOf('լ-տ') < 0 && t.indexOf('ս-տ') < 0)) return 'ավագ';
  if (t.indexOf('եֆր') >= 0) return 'եֆրեյտոր';
  if (t.indexOf('շարք') >= 0 || t === 'շ-ն' || /^շ[\-.]?ն$/.test(t) || /^շարք\.?$/.test(t)) return 'շարքային';
  return t;
}
function kmPromoRankLadder_V1() {
  return [
    'շարքային', 'եֆրեյտոր', 'կրտսեր սերժանտ', 'սերժանտ', 'ավագ սերժանտ', 'ավագ',
    'ենթասպա', 'ավագ ենթասպա',
    'լեյտենանտ', 'ավագ լեյտենանտ', 'կապիտան', 'մայոր', 'փոխգնդապետ', 'գնդապետ'
  ];
}
function kmPromoNextRank_V1(personRank) {
  var r = kmPromoNormRank_V1(personRank);
  var ladder = kmPromoRankLadder_V1();
  var i = ladder.indexOf(r);
  if (i < 0) {
    for (var j = 0; j < ladder.length; j++) {
      if (r && (r.indexOf(ladder[j]) >= 0 || ladder[j].indexOf(r) >= 0)) { i = j; break; }
    }
  }
  if (i < 0 || i >= ladder.length - 1) return '';
  return ladder[i + 1];
}
function kmPromoRankFromCodeHard_V1(wantCode) {
  var g = String(wantCode || '').replace(/\s+/g, '').trim();
  if (!g) return '';
  if (/^3\//.test(g) || g === '3') return 'շարքային';
  if (/^4\//.test(g) || g === '4') return 'եֆրեյտոր';
  if (/^5\//.test(g) || g === '5') return 'սերժանտ';
  if (/^6\//.test(g) || g === '6') return 'ավագ սերժանտ';
  if (/^8\//.test(g) || g === '8') return 'ենթասպա';
  if (/^9\//.test(g) || g === '9' || /^2\//.test(g)) return 'ավագ ենթասպա';
  var n = parseInt(g, 10);
  if (!n || g.indexOf('/') >= 0) return '';
  if (n >= 10 && n <= 14) return 'ավագ լեյտենանտ';
  if (n >= 15 && n <= 17) return 'լեյտենանտ';
  if (n === 18 || n === 19) return 'կապիտան';
  if (n >= 20 && n <= 24) return 'մայոր';
  if (n >= 25 && n <= 39) return 'փոխգնդապետ';
  if (n >= 40) return 'գնդապետ';
  return '';
}
function kmPromoGradeToken_V1(wantCode) {
  if (typeof kmStaffingGradeToken === 'function') {
    try { var g0 = kmStaffingGradeToken(wantCode); if (g0) return String(g0); } catch (e0) {}
  }
  var n = String(wantCode || '').replace(/\s+/g, '').trim();
  if (/^\d{1,3}$/.test(n) || /^\d{1,3}\/\d{1,3}$/.test(n)) return n;
  var m = n.match(/(\d{1,3}\/\d{1,3}|\d{1,3})/);
  return m ? m[1] : '';
}
function kmPromoPersonRank_V1() {
  try {
    var p = window.__kmPromoPersonRef;
    if (p) {
      var r = p.rankSlot || p.rank || p.կոչում || p.grade || '';
      if (r) return String(r);
    }
  } catch (e) {}
  return '';
}
function kmPromoCollectArchiveRows_V1(corpsId, unitId, blob) {
  var uid = String(unitId || '').trim();
  var cid = String(corpsId || '').trim();
  var rows = [];
  var seen = Object.create(null);
  function pushRow(r, archMeta) {
    if (!r || r.type === 'section' || r.type === 'header' || r.type === 'title') return;
    if (!String(r.position || '').trim() && !String(r.code || r.vus || '').trim()) return;
    var k = String((archMeta && archMeta.id) || r.archId || '') + ':' + String(r.excelRow != null ? r.excelRow : '') + ':' + String(r.position || '') + ':' + String(r.code || '');
    if (seen[k]) return;
    seen[k] = 1;
    rows.push({ r: r, arch: archMeta || null });
  }
  try {
    if (uid && window.kmUnitArchiveStaffSource && window.kmUnitArchiveStaffSource.hasFormal &&
        window.kmUnitArchiveStaffSource.hasFormal(uid) &&
        typeof window.kmUnitArchiveStaffSource.rows === 'function') {
      (window.kmUnitArchiveStaffSource.rows(uid) || []).forEach(function (r) {
        pushRow(r, { id: 'formal_' + uid, unitId: uid, corpsId: cid });
      });
    }
  } catch (eF) {}
  try {
    if (typeof allArchiveRows === 'function' && uid && !rows.length) {
      (allArchiveRows(uid) || []).forEach(function (r) {
        pushRow(r, { id: r && r.archId ? r.archId : ('all_' + uid), unitId: uid, corpsId: cid });
      });
    }
  } catch (eA) {}
  try {
    var archList = (typeof promoArchivesFor === 'function')
      ? promoArchivesFor(corpsId, unitId, blob)
      : ((blob && blob.positionArchives) || []);
    (archList || []).forEach(function (arch) {
      (arch.rows || []).forEach(function (r) { pushRow(r, arch); });
    });
  } catch (eP) {}
  return rows;
}
function kmPromoBuildArchiveMaps_V1(corpsId, unitId, blob) {
  var codeFreq = Object.create(null);
  var collected = kmPromoCollectArchiveRows_V1(corpsId, unitId, blob);
  for (var i = 0; i < collected.length; i++) {
    var r = collected[i].r;
    var code = '';
    try {
      code = (typeof kmRowStaffingCode === 'function') ? kmRowStaffingCode(r) : String(r.code || r.vus || '').trim();
    } catch (eC) { code = String(r.code || r.vus || '').trim(); }
    code = kmPromoGradeToken_V1(code) || String(code || '').replace(/\s+/g, '').trim();
    if (!code) continue;
    var rk = kmPromoNormRank_V1(r.rankSlot || r.rank || '');
    if (!rk) continue;
    if (!codeFreq[code]) codeFreq[code] = Object.create(null);
    codeFreq[code][rk] = (codeFreq[code][rk] || 0) + 1;
  }
  var codeToRank = Object.create(null);
  var rankToCodes = Object.create(null);
  Object.keys(codeFreq).forEach(function (code) {
    var best = '', bestN = 0;
    Object.keys(codeFreq[code]).forEach(function (rk) {
      if (codeFreq[code][rk] > bestN) { bestN = codeFreq[code][rk]; best = rk; }
    });
    if (!best) return;
    codeToRank[code] = best;
    if (!rankToCodes[best]) rankToCodes[best] = Object.create(null);
    rankToCodes[best][code] = 1;
  });
  return { codeToRank: codeToRank, rankToCodes: rankToCodes, codeFreq: codeFreq };
}
var __kmPromoArchMapCache = Object.create(null);
function kmPromoArchiveMaps_V1(corpsId, unitId, blob) {
  var k = String(corpsId || '') + '\n' + String(unitId || '');
  if (__kmPromoArchMapCache[k]) return __kmPromoArchMapCache[k];
  var maps = kmPromoBuildArchiveMaps_V1(corpsId, unitId, blob);
  __kmPromoArchMapCache[k] = maps;
  return maps;
}
function kmPromoRankFromCode_V1(wantCode, maps) {
  var g = kmPromoGradeToken_V1(wantCode) || String(wantCode || '').replace(/\s+/g, '').trim();
  if (!g) return '';
  if (maps && maps.codeToRank && maps.codeToRank[g]) return maps.codeToRank[g];
  return kmPromoRankFromCodeHard_V1(g);
}
function kmPromoNextFromCode_V1(wantCode, maps) {
  var cur = kmPromoRankFromCode_V1(wantCode, maps);
  if (!cur) return '';
  return kmPromoNextRank_V1(cur);
}
function kmPromoResolveNextRank_V1(wantCode, maps) {
  var next = kmPromoNextFromCode_V1(wantCode, maps);
  if (next) return next;
  next = kmPromoNextRank_V1(kmPromoPersonRank_V1());
  if (next) return next;
  try {
    if (typeof promoNextRank === 'function' && typeof promoPersonRank === 'function' && window.__kmPromoPersonRef) {
      var ab = promoNextRank(promoPersonRank(window.__kmPromoPersonRef)) || '';
      next = kmPromoNormRank_V1(ab) || kmPromoNormRank_V1(typeof promoRankLabel === 'function' ? promoRankLabel(ab) : ab) || '';
    }
  } catch (eN) {}
  return next || '';
}
function kmPromoSameFamilyHigherCode_V1(fromCode, toCode) {
  var ga = kmPromoGradeToken_V1(fromCode) || String(fromCode || '').replace(/\s+/g, '');
  var gb = kmPromoGradeToken_V1(toCode) || String(toCode || '').replace(/\s+/g, '');
  if (!ga || !gb) return false;
  if (ga.indexOf('/') >= 0 || gb.indexOf('/') >= 0) {
    if (ga.indexOf('/') < 0 || gb.indexOf('/') < 0) return false;
    var pa = ga.split('/');
    var pb = gb.split('/');
    if (String(pa[0]) !== String(pb[0])) return false;
    return (parseInt(pb[1], 10) || 0) > (parseInt(pa[1], 10) || 0);
  }
  var va = parseInt(ga, 10), vb = parseInt(gb, 10);
  if (!va || !vb) return false;
  return vb > va;
}
function kmPromoVacantMatchesNext_V1(rec, wantCode, maps) {
  /* KM_PROMO_ARCHIVE_NEXT_RANK_V6:
     (1) immediate next rank by name OR archive/hard dominant(code)==next
     (2) same rank + strictly higher staffing code (18→19, 5/3→5/5) */
  var cur = kmPromoRankFromCode_V1(wantCode, maps) || kmPromoNormRank_V1(kmPromoPersonRank_V1()) || '';
  var next = kmPromoResolveNextRank_V1(wantCode, maps);
  var rawRank = rec && (rec.rankSlot || rec.rank || '');
  var postRank = kmPromoNormRank_V1(rawRank);
  if (!postRank && typeof promoPosRank === 'function') {
    try { postRank = kmPromoNormRank_V1(promoPosRank(rec)); } catch (e0) {}
  }
  var pc = '';
  try {
    pc = kmPromoGradeToken_V1((rec && rec.code) || '') || String((rec && rec.code) || '').replace(/\s+/g, '').trim();
  } catch (ePc) { pc = String((rec && rec.code) || '').trim(); }
  if (!postRank && pc) postRank = kmPromoRankFromCode_V1(pc, maps);

  if (next) {
    if (postRank && postRank === next) return true;
    if (typeof promoRankEquals === 'function') {
      try {
        if (promoRankEquals(typeof promoPosRank === 'function' ? promoPosRank(rec) : rawRank, next)) return true;
        if (typeof promoRankLabel === 'function' &&
            kmPromoNormRank_V1(promoRankLabel(typeof promoPosRank === 'function' ? promoPosRank(rec) : rawRank)) === next) return true;
      } catch (eR) {}
    }
    if (pc) {
      var pcRank = kmPromoRankFromCode_V1(pc, maps);
      if (pcRank && pcRank === next) return true;
      if (maps && maps.rankToCodes && maps.rankToCodes[next] && maps.rankToCodes[next][pc]) return true;
    }
  }
  if (cur && postRank && postRank === cur && pc && wantCode) {
    if (kmPromoSameFamilyHigherCode_V1(wantCode, pc)) return true;
  }
  return false;
}
function kmPromoHintText_V1(wantCode, maps) {
  var cur = kmPromoRankFromCode_V1(wantCode, maps) || kmPromoNormRank_V1(kmPromoPersonRank_V1()) || '';
  var next = kmPromoResolveNextRank_V1(wantCode, maps) || 'հաջորդ';
  var g = kmPromoGradeToken_V1(wantCode) || String(wantCode || '');
  var codeList = '';
  try {
    if (maps && maps.rankToCodes && maps.rankToCodes[next]) {
      codeList = Object.keys(maps.rankToCodes[next]).sort().join(', ');
    }
  } catch (eL) {}
  if (cur) {
    return 'Հաստիքային կոդ՝ ' + g + ' (' + cur + ') · հաջորդ կոչում՝ ' + next +
      (codeList ? (' · կոդեր՝ ' + codeList) : '') + ' · նաև նույն կոչման ավելի բարձր կոդ';
  }
  return 'Հաստիքային կոդ՝ ' + g + ' · հաջորդ կոչում՝ ' + next;
}
/* === /KM_PROMO_NEXT_RANK_VACANTS_V1 helpers === */


  function promoVacantForPerson(corpsId, unitId, personRank, opts) {
    /* KM_PROMOTION_VACANT_BY_CODE_V1 */
    /* KM_PROMO_FORMAL_SSOT_V6b — formal unit archive is SSOT; Excel fills gaps.
       Example: code 19 → all մայոր vacants incl. «ֆիզ. պատ. և սպորտի պետ» (code 23)
       even when Excel still shows an old name. */
    var code = '';
    try { if (window.__kmPromoPersonRef) code = String(window.__kmPromoPersonRef.postCode || window.__kmPromoPersonRef.code || '').trim(); } catch (eC) {}
    if (!code && window.__kmPromoStaffingCode) code = String(window.__kmPromoStaffingCode || '').trim();
    if (!code) return [];
    var wantCode = (typeof kmNormStaffingCode === 'function' ? kmNormStaffingCode(code) : String(code).replace(/\s+/g, '').toLowerCase());
    var blob = promoBlobFor(corpsId, unitId) || { userPositions: [], positionArchives: [], positionAssignments: {} };
    var maps = (typeof kmPromoArchiveMaps_V1 === 'function') ? kmPromoArchiveMaps_V1(corpsId, unitId, blob) : null;
    var idx = promoIndexUserPos(blob);
    var out = [];
    var seen = Object.create(null);
    var postKeySeen = Object.create(null);
    var formalKeySeen = Object.create(null); /* KM_PROMO_PERF_SKIP_REDUNDANT_SCAN_V1 */

    function looksPerson(nm) {
      nm = String(nm || '').trim();
      if (!nm || nm.length < 3) return false;
      if (/թափուր|ազատ|vacant|—|–|^-$/i.test(nm)) return false;
      if (typeof looksLikePersonName === 'function') {
        try { return !!looksLikePersonName(nm); } catch (eL) {}
      }
      return /[Ա-Ֆա-ֆA-Za-z]{2,}/.test(nm) && /\s/.test(nm);
    }
    function occupied(rec) {
      if (rec && (rec.vacant === true || rec._vacant === true)) return false;
      if (rec && rec.fromFormal && !String(rec.personName || rec.sourceName || rec.name || '').trim()) return false;
      var asg = blob.positionAssignments && blob.positionAssignments[rec.id];
      if (asg && asg.vacant) return false;
      if (asg && asg.manual && asg.personName && looksPerson(asg.personName)) return true;
      var nm = (typeof promoResolveName === 'function') ? promoResolveName(rec, blob) : (rec.personName || rec.sourceName || '');
      if (!nm) return false;
      return looksPerson(nm);
    }
    function postKey(rec) {
      var p = String(rec.position || '').replace(/\s+/g, ' ').trim().toLowerCase();
      var c = String(rec.code || '').replace(/\s+/g, '').trim().toLowerCase();
      return p + '|' + c;
    }
    function pushIf(rec, prefer) {
      if (!rec || !String(rec.position || '').trim()) return;
      var pk = postKey(rec);
      if (pk !== '|' && postKeySeen[pk] && !prefer) return;
      var k = String(rec.id || '') || (String(rec.archId || '') + ':' + String(rec.excelRow || rec.position || ''));
      if (!k) return;
      if (seen[k] && !prefer) return;
      var ok = (typeof kmPromoVacantMatchesNext_V1 === 'function')
        ? kmPromoVacantMatchesNext_V1(rec, wantCode, maps)
        : false;
      if (!ok) return;
      if (occupied(rec)) return;
      if (pk !== '|' && postKeySeen[pk] && prefer) {
        /* replace earlier excel hit with formal */
        for (var i = out.length - 1; i >= 0; i--) {
          if (postKey(out[i]) === pk) { out.splice(i, 1); break; }
        }
      }
      seen[k] = 1;
      if (pk !== '|') postKeySeen[pk] = 1;
      out.push(rec);
    }
    function rowCode(r) {
      try {
        if (typeof kmRowStaffingCode === 'function') {
          var c0 = kmRowStaffingCode(r);
          if (c0) return String(c0).trim();
        }
      } catch (e0) {}
      var code = String((r && (r.code || r.postCode || r.staffingCode)) || '').trim();
      var vus = String((r && (r.vus || r.specialty)) || '').trim();
      if (typeof kmStaffingGradeToken === 'function') {
        try {
          if (kmStaffingGradeToken(code)) return kmStaffingGradeToken(code);
          if (kmStaffingGradeToken(vus)) return kmStaffingGradeToken(vus);
        } catch (e1) {}
      }
      return code || vus;
    }
    function ingestRow(r, arch, i, prefer) {
      if (!r || r.type === 'section' || r.type === 'header' || r.type === 'title') return;
      /* Formal API uses type:'row'; Excel archives often omit type */
      var position = String(r.position || r.title || '').trim();
      if (!position && Array.isArray(r.cells)) {
        position = String(r.cells[1] || '').trim();
      }
      if (!position) return;
      var pname = '';
      if (Array.isArray(r.cells)) pname = String(r.cells[8] || '').trim();
      else pname = String(r.name || r.personName || r.sourceName || '').trim();
      if (typeof personDisplayName === 'function' && !Array.isArray(r.cells)) {
        try { pname = personDisplayName(r) || pname; } catch (eN) {}
      }
      var archId = (arch && arch.id) || r.archId || '';
      var rankSlot = String(r.rankSlot || '').trim();
      var rank = String(r.rank || '').trim();
      if (Array.isArray(r.cells)) {
        if (!rankSlot) rankSlot = String(r.cells[6] || '').trim();
        if (!rank) rank = String(r.cells[7] || '').trim();
      }
      /* Post rank for matching: rankSlot first, then rank text (formal stores «մայոր» in rankSlot) */
      var postRank = rankSlot || rank;
      var codeVal = rowCode(r);
      if (!codeVal && Array.isArray(r.cells)) codeVal = String(r.cells[5] || '').trim();
      var rec = {
        id: String(r.id || ('archv_' + String(archId || unitId) + '_' + (r.excelRow != null ? r.excelRow : i))),
        section: r.unit || r.section || (Array.isArray(r.cells) ? String(r.cells[0] || '') : '') || '',
        unit: r.unit || r.section || '',
        position: position,
        code: codeVal,
        personName: pname,
        sourceName: pname,
        name: pname,
        rankSlot: postRank,
        rank: postRank,
        orgUnitId: unitId || (arch && arch.unitId) || r.orgUnitId || '',
        corpsId: corpsId || (arch && arch.corpsId) || '',
        fromArchive: true,
        fromFormal: !!(prefer || r.fromFormal || (arch && arch.formal)),
        virtual: true,
        archId: archId,
        excelRow: r.excelRow != null ? r.excelRow : (i + 1),
        seq: r.seq || (Array.isArray(r.cells) ? String(r.cells[2] || '') : '') || '',
        catalogId: r.catalogId || r.id || '',
        vacant: !!(r.vacant || !pname)
      };
      if (!prefer) {
        var up = (typeof promoLookupUserPos === 'function') ? promoLookupUserPos(idx, arch || { id: archId }, r, rec) : null;
        if (up) {
          rec.id = up.id;
          rec.virtual = false;
          rec._fromUserPos = true;
          if (up.personName) rec.personName = up.personName;
        }
      } else {
        /* KM_PROMO_PERF_SKIP_REDUNDANT_SCAN_V1: remember every position|code the formal pass
           processed (matched or not) so the later userPositions pass can skip duplicates */
        formalKeySeen[postKey(rec)] = 1;
      }
      pushIf(rec, !!prefer);
    }

    function ingestFormalCells(uid) {
      try {
        if (typeof db === 'undefined' || !db || !db.unitFormalArchives) return 0;
        var sh = db.unitFormalArchives[uid];
        if (!sh || !Array.isArray(sh.rows) || !sh.rows.length) return 0;
        var n = 0;
        sh.rows.forEach(function (r, i) {
          if (!r || r.type === 'title' || r.type === 'header' || r.type === 'section') return;
          if (!Array.isArray(r.cells)) return;
          ingestRow(r, { id: 'formal_cells_' + uid, unitId: uid, corpsId: corpsId, formal: true }, i, true);
          n++;
        });
        return n;
      } catch (eF) { return 0; }
    }

    var formalCount = 0;
    /* KM_PROMO_YIELD_V1: the scan is expressed as resumable STAGES so it can run either
       synchronously (legacy callers: no callback -> returns the array) or time-sliced
       (callback given -> yields to the UI every ~10ms, so a slow unit can never freeze the window).
       Stage order and semantics are unchanged from the previous straight-line version:
       formal rows -> formal-cells fallback -> gap-fill (only when formal produced nothing)
       -> db.userPositions. Per-stage timings are recorded in window.__kmPromoPerf. */
    var perf = { unitId: String(unitId || ''), stages: {}, rows: 0, startedAt: Date.now() };
    var stages = [
      ['formal', function () {
        try {
          if (unitId && window.kmUnitArchiveStaffSource && window.kmUnitArchiveStaffSource.hasFormal &&
              window.kmUnitArchiveStaffSource.hasFormal(unitId) &&
              typeof window.kmUnitArchiveStaffSource.rows === 'function') {
            var frows = window.kmUnitArchiveStaffSource.rows(unitId) || [];
            return {
              items: frows,
              fn: function (r, i) {
                ingestRow(r, { id: 'formal_' + String(unitId), unitId: unitId, corpsId: corpsId, formal: true }, i, true);
                formalCount++;
              }
            };
          }
        } catch (eFormalPromo) {}
        return null;
      }],
      ['formalCells', function () {
        /* Direct cells fallback if API returned nothing usable */
        if (!formalCount) formalCount = ingestFormalCells(unitId);
        return null;
      }],
      ['gapFillAll', function () {
        /* fill-gaps-only fallback: only when the formal source produced nothing */
        if (formalCount) return null;
        try {
          if (typeof allArchiveRows === 'function' && unitId) {
            return {
              items: allArchiveRows(unitId) || [],
              fn: function (r, i) {
                ingestRow(r, { id: r.archId || ('all_' + String(unitId)), unitId: unitId, corpsId: corpsId }, i, false);
              }
            };
          }
        } catch (eAllPromo) {}
        return null;
      }],
      ['gapFillArchives', function () {
        if (formalCount) return null;
        var flat = [];
        (typeof promoArchivesFor === 'function' ? promoArchivesFor(corpsId, unitId, blob) : []).forEach(function (arch) {
          (arch.rows || []).forEach(function (r, i) { flat.push({ arch: arch, r: r, i: i }); });
        });
        return { items: flat, fn: function (it) { ingestRow(it.r, it.arch, it.i, false); } };
      }],
      ['userPositions', function () {
        return {
          items: blob.userPositions || [],
          fn: function (p) {
            if (!p) return;
            /* KM_PROMO_PERF_SKIP_REDUNDANT_SCAN_V1: archive-synced userPositions (fromArchive,
               random up_* ids) duplicate rows the formal pass already ingested. pushIf() would
               reject them anyway via postKeySeen, but only AFTER the costly Object.assign +
               promoApplyExcelFacts (which re-scans every legacy archive row per call). Apply
               the same position|code check first. Manually added positions (no fromArchive
               flag) are always processed as before. */
            if (formalCount && p.fromArchive) {
              var _pk = String(p.position || '').replace(/\s+/g, ' ').trim().toLowerCase() + '|' +
                String(p.code || '').replace(/\s+/g, '').trim().toLowerCase();
              if (_pk !== '|' && formalKeySeen[_pk]) return;
            }
            var rec = Object.assign({}, p, {
              rankSlot: p.rankSlot || p.rank || '',
              rank: p.rankSlot || p.rank || '',
              orgUnitId: unitId || p.orgUnitId || '',
              corpsId: corpsId || p.corpsId || ''
            });
            if (typeof promoApplyExcelFacts === 'function') promoApplyExcelFacts(rec, corpsId, unitId);
            pushIf(rec, false);
          }
        };
      }]
    ];

    function runStages(isAsync, done) {
      var si = 0, cur = null, ii = 0, curName = '', stageT0 = 0;
      function closeStage() {
        if (curName) perf.stages[curName] = (perf.stages[curName] || 0) + (Date.now() - stageT0);
        cur = null; curName = '';
      }
      function step() {
        var t0 = Date.now();
        for (;;) {
          if (!cur) {
            if (si >= stages.length) {
              perf.totalMs = Date.now() - perf.startedAt;
              perf.out = out.length;
              try { window.__kmPromoPerf = perf; } catch (eP) {}
              return done(out);
            }
            curName = stages[si][0];
            stageT0 = Date.now();
            try { cur = stages[si][1](); } catch (eS) { cur = null; }
            si++;
            ii = 0;
            if (!cur) { closeStage(); continue; }
          }
          var items = cur.items || [];
          while (ii < items.length) {
            try { cur.fn(items[ii], ii); } catch (eI) {}
            ii++;
            perf.rows++;
            if (isAsync && (ii & 15) === 0 && Date.now() - t0 > 10) {
              /* yield to the UI; resume this stage on the next tick */
              perf.stages[curName] = (perf.stages[curName] || 0) + (Date.now() - stageT0);
              stageT0 = 0;
              setTimeout(function () { stageT0 = Date.now(); step(); }, 0);
              return;
            }
          }
          closeStage();
        }
      }
      step();
    }

    if (typeof opts === 'function') {
      /* async mode: caller gets the array via callback; this call returns immediately */
      runStages(true, opts);
      return null;
    }
    var result = out;
    runStages(false, function (o) { result = o; });
    return result;
  }

  function promoVacantForNextRank(corpsId, unitId, nextRank) {
    if (!nextRank) return [];
    return promoListVacant(corpsId, unitId).filter(function (p) {
      return promoRankEquals(promoPosRank(p), nextRank);
    });
  }

  window.kmOpenPositionPromotion = function (personIndex) {
    /* KM_PROMOTION_MODAL_BY_CODE_V1 */
    if (!canEdit()) {
      /* KM_PROMOTION_CARD_ACCESS_ALIGN_V1: same grants as person-card promote button */
      var cardEditOk = false;
      try {
        if (typeof window.kmCanEditPersonnelOp === 'function' && window.kmCanEditPersonnelOp('card')) cardEditOk = true;
        if (!cardEditOk && typeof window.kmCanEditPage === 'function' &&
            (window.kmCanEditPage('people') || window.kmCanEditPage('unitDossiers') || window.kmCanEditPage('troopStructure'))) {
          cardEditOk = true;
        }
        if (!cardEditOk && typeof window.kmCanEdit === 'function' &&
            (window.kmCanEdit('people') || window.kmCanEdit('unitDossiers') || window.kmCanEdit('troopStructure'))) {
          cardEditOk = true;
        }
      } catch (eCardEdit) {}
      if (!cardEditOk) { toastMsg('Դիտորդի իրավունք', 'error'); return; }
    }
    ensureStore();
    injectCss();
    var person = (db.people || [])[personIndex];
    if (!person || !person.name) { toastMsg('Անձը չգտնվեց', 'warn'); return; }
    var name = String(person.name).trim();
    var curRank = promoPersonRank(person);
    var eligibleRanks = promoTargetRanksForPerson(curRank);
    var nextRank = eligibleRanks[0] || '';
    var ctx = typeof window.kmGetOrgContext === 'function' ? window.kmGetOrgContext() : null;
    var superAdm = typeof window.kmIsSuperAdmin === 'function' && window.kmIsSuperAdmin();
    var corpsList = (typeof window.kmListOrgCorps === 'function' ? window.kmListOrgCorps() : []) || [];
    if (!superAdm && ctx && ctx.corpsId) {
      corpsList = corpsList.filter(function (c) { return c && c.id === ctx.corpsId; });
    }
    closeModal({ keepArchiveCtx: true });
    /* KM_PROMOTION_ACCESS_STAFFINGCODE_V1: define code + refs before modal (was ReferenceError -> section dead) */
    var staffingCode = '';
    /* KM_PROMO_PERSON_GRADE_V1 */
    try {
      var _rawCode = String((person && (person.postCode || person.posCode || person.code || person.staffCode || person.vus)) || '').trim();
      var _rawVus = String((person && (person.vus || person.specialty || person.postCode)) || '').trim();
      if (typeof kmStaffingGradeToken === 'function') {
        staffingCode = kmStaffingGradeToken(_rawCode) || kmStaffingGradeToken(_rawVus) || _rawCode;
      } else {
        staffingCode = _rawCode;
      }
    } catch (eGrade) { staffingCode = String((person && (person.postCode || person.code || person.vus)) || '').trim(); }
    try {
      window.__kmPromoPersonRef = person;
      window.__kmPromoStaffingCode = staffingCode;
    } catch (ePromoRef) {}
    var eligibleLabels = staffingCode || '—';
    var rankHint = !staffingCode
      ? 'Հաստիքային կոդը բացակայում է, ուստի պաշտոնի բարձրացում չի կարող առաջարկվել կոդով։ Կոչումը չի օգտագործվում։'
      : ('Հաստիքային կոդ՝ <b>' + esc(staffingCode) + '</b> · ' + (typeof kmPromoHintText_V1 === 'function' ? kmPromoHintText_V1(staffingCode) : 'հաջորդ կոչման թափուր հաստիքներ'));
    var el = document.createElement('div');
    el.id = 'kmPosModal';
    el.className = 'kmPosModal';
    el.innerHTML =
      '<div class="kmPosModalCard" style="max-width:640px">' +
        '<h3 style="margin:0 0 8px">Պաշտոնի բարձրացում</h3>' +
        '<p class="muted" style="margin:0 0 8px;font-size:13px">' + esc(name) +
          (person.post ? (' · ներկա՝ <b>' + esc(person.post) + '</b>') : '') +
          (person.unit ? (' · ' + esc(person.unit)) : '') + '</p>' +
        '<p style="margin:0 0 12px;font-size:13px;color:#1d4a63">' + rankHint + '</p>' +
        '<label class="kmPromoField" style="display:block;margin-bottom:10px"><span class="muted">Որոնման տող</span>' +
          '<input id="kmPromoSearch" class="kmPromoSearch" type="search" placeholder="կորպուս, զորամաս կամ պաշտոն…" ' +
          'autocomplete="off"></label>' +
        '<label class="kmPromoField" style="display:block;margin-bottom:10px"><span class="muted">Կորպուս</span>' +
          '<select id="kmPromoCorps" style="width:100%;padding:8px;margin-top:4px"></select></label>' +
        '<label class="kmPromoField" style="display:block;margin-bottom:10px"><span class="muted">Զորամաս</span>' +
          '<select id="kmPromoUnit" style="width:100%;padding:8px;margin-top:4px"></select></label>' +
        '<div class="muted" style="font-size:12px;margin:0 0 6px">Թափուր պաշտոններ այս զորամասում (հաջորդ կոչում կամ բոլոր թափուրները)</div>' +
        '<div id="kmPromoPosList" class="kmPosPickList" style="max-height:240px;margin-bottom:14px;border:1px solid #d5e0d9;border-radius:8px;overflow:auto;background:#f7faf8"></div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
          '<button type="button" class="primary" id="kmPromoOk">Հաստատել տեղափոխումը</button>' +
          '<button type="button" class="kmBackBtn" id="kmPromoCancel">' +
            ((typeof window.KM_BACK_LABEL === 'string' && window.KM_BACK_LABEL) || '← Վերադարձ') + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);
    if (typeof window.kmForceUiPaint === 'function') window.kmForceUiPaint(el);
    el.addEventListener('click', function (ev) { if (ev.target === el) closeModal({ keepArchiveCtx: true }); });
    var corpsSel = el.querySelector('#kmPromoCorps');
    var unitSel = el.querySelector('#kmPromoUnit');
    var searchEl = el.querySelector('#kmPromoSearch');
    var listEl = el.querySelector('#kmPromoPosList');
    var picked = null;
    var shown = [];
    var vacantMemo = Object.create(null);
    var scanToken = 0;
    var MAX_SHOW = 80;

    function qNorm() {
      return String((searchEl && searchEl.value) || '').replace(/\s+/g, ' ').trim().toLowerCase();
    }
    function textHit(s, q) {
      if (!q) return true;
      s = String(s || '').toLowerCase();
      var tokens = q.split(/\s+/).filter(Boolean);
      return tokens.every(function (t) { return s.indexOf(t) >= 0; });
    }
    function posHit(p, q) {
      if (!q) return true;
      return textHit([
        p._promoCorpsName, p._promoUnitName, p.section, p.unit, p.position, p.code,
        p.rankSlot, promoRankLabel(promoPosRank(p))
      ].join(' '), q);
    }
    function listUnitsFor(cid) {
      var units = (typeof window.kmListOrgUnits === 'function' ? window.kmListOrgUnits(cid) : []) || [];
      if (!superAdm && ctx && ctx.unitId && ctx.corpsId === cid) {
        var only = units.filter(function (u) { return u && u.id === ctx.unitId; });
        if (only.length) units = only;
      }
      return units;
    }
    function vacantForUnit(cid, uid) {
      var k = String(cid) + '|' + String(uid);
      if (!vacantMemo[k]) vacantMemo[k] = promoVacantForPerson(cid, uid, curRank);
      return vacantMemo[k];
    }
    /* KM_PROMO_YIELD_V1: non-blocking variant. Memoized -> callback immediately; otherwise the
       unit scan runs time-sliced (never blocks the UI thread for more than ~10ms at a time).
       Concurrent requests for the same unit share one computation. */
    var vacantPending = Object.create(null);
    function vacantForUnitAsync(cid, uid, cb) {
      var k = String(cid) + '|' + String(uid);
      if (vacantMemo[k]) { cb(vacantMemo[k]); return; }
      if (vacantPending[k]) { vacantPending[k].push(cb); return; }
      vacantPending[k] = [cb];
      promoVacantForPerson(cid, uid, curRank, function (res) {
        vacantMemo[k] = res || [];
        var cbs = vacantPending[k] || [];
        delete vacantPending[k];
        cbs.forEach(function (f) { try { f(vacantMemo[k]); } catch (eCb) {} });
      });
    }
    function attachMeta(p, c, u) {
      return Object.assign({}, p, {
        _promoCorpsId: c.id,
        _promoCorpsName: c.name || '',
        _promoUnitId: u.id,
        _promoUnitName: u.name || ''
      });
    }
    function unitJobs(opts) {
      opts = opts || {};
      var wantCid = String(opts.corpsId || '').trim();
      var wantUid = String(opts.unitId || '').trim();
      var jobs = [];
      corpsList.forEach(function (c) {
        if (!c || !c.id) return;
        if (wantCid && c.id !== wantCid) return;
        listUnitsFor(c.id).forEach(function (u) {
          if (!u || !u.id) return;
          if (wantUid && u.id !== wantUid) return;
          jobs.push({ c: c, u: u });
        });
      });
      return jobs;
    }
    function fillCorps() {
      var q = qNorm();
      var pref = String(corpsSel.value || (ctx && ctx.corpsId) || '').trim();
      var list = corpsList.filter(function (c) {
        if (!c || !c.id) return false;
        if (!q) return true;
        return textHit(c.name, q);
      });
      if (q && !list.length) list = corpsList.filter(function (c) { return c && c.id; });
      corpsSel.innerHTML = '<option value="">— ընտրել կորպուս —</option>' + list.map(function (c) {
        return '<option value="' + esc(c.id) + '"' + (c.id === pref ? ' selected' : '') + '>' + esc(c.name) + '</option>';
      }).join('');
      if (pref && !corpsSel.value && list.length === 1) corpsSel.value = list[0].id;
    }
    function fillUnits() {
      var cid = String(corpsSel.value || '').trim();
      var q = qNorm();
      var units = cid ? listUnitsFor(cid) : [];
      if (q) {
        var named = units.filter(function (u) { return textHit(u.name, q); });
        if (named.length) units = named;
      }
      var pref = String(unitSel.value || (ctx && ctx.unitId) || '').trim();
      unitSel.innerHTML = '<option value="">— ընտրել զորամաս —</option>' + units.map(function (u) {
        return '<option value="' + esc(u.id) + '"' + (u.id === pref ? ' selected' : '') + '>' + esc(u.name || '') + '</option>';
      }).join('');
    }
    function renderShown(rows, extraNote) {
      picked = null;
      shown = rows || [];
      if (!listEl) return;
      if (!shown.length) {
        listEl.innerHTML = '<p class="muted" style="margin:10px;font-size:13px">' +
          (extraNote || 'Հաջորդ կոչման թափուր պաշտոն չկա։') + '</p>';
        return;
      }
      var more = shown.length > MAX_SHOW ? shown.length - MAX_SHOW : 0;
      var vis = more ? shown.slice(0, MAX_SHOW) : shown;
      listEl.innerHTML = vis.map(function (p, i) {
        var where = (p._promoCorpsName ? (p._promoCorpsName + ' · ') : '') + (p._promoUnitName || '');
        return '<button type="button" class="kmPosPickRow" data-promo-pick="' + i + '" ' +
          'style="width:100%;text-align:left;border:0;background:transparent;cursor:pointer;padding:8px 10px">' +
          '<span><b>' + esc(p.position || 'պաշտոն') + '</b>' +
          (p.code ? ' · կոդ ' + esc(String(p.code)) : '') +
          (p.rankSlot ? ' · ' + esc(promoRankLabel(promoPosRank(p)) || p.rankSlot) : '') +
          '<br><span class="muted">' + esc(where) +
          (p.section ? ' · ' + esc(p.section) : '') +
          '</span></span></button>';
      }).join('') + (more
        ? '<p class="muted" style="margin:8px 10px;font-size:12px">և ևս ' + more + ' · նեղացրեք որոնումը</p>'
        : '');
      listEl.querySelectorAll('[data-promo-pick]').forEach(function (btn) {
        btn.onclick = function () {
          var i = Number(btn.getAttribute('data-promo-pick'));
          picked = vis[i] || null; /* KM_PROMO_PICK_NO_REFILL_V2 */
          listEl.querySelectorAll('.kmPosPickRow').forEach(function (b) {
            b.style.background = 'transparent';
          });
          btn.style.background = '#d9ebe0';
          /* do NOT write corpsSel/unitSel here — onchange would call fillPos and clear picked */
        };
      });
    }
    function fillPos() {
      scanToken += 1;
      var my = scanToken;
      if (!listEl) return;
      if (!staffingCode) {
        listEl.innerHTML = '<p class="muted" style="margin:10px;font-size:13px">Անձի հաստիքային կոդը բացակայում է։</p>';
        return;
      } /* KM_PROMO_SKIP_ELIGIBLE_RANKS_V1 */
      var cid = String(corpsSel.value || '').trim();
      var uid = String(unitSel.value || '').trim();
      var q = qNorm();
      if (!q && (!cid || !uid)) {
        listEl.innerHTML = '<p class="muted" style="margin:10px;font-size:13px">Ընտրեք զորամասը կամ գրեք որոնման տողում։</p>';
        return;
      }
      if (q && q.length < 2 && (!cid || !uid)) {
        listEl.innerHTML = '<p class="muted" style="margin:10px;font-size:13px">Գրեք առնվազն 2 տառ կամ ընտրեք զորամասը։</p>';
        return;
      }
      var jobOpts = {};
      if (!q || q.length < 2) jobOpts = { corpsId: cid, unitId: uid };
      else if (cid && !uid) jobOpts = { corpsId: cid };
      var jobs = unitJobs(jobOpts);
      listEl.innerHTML = '<p class="muted" style="margin:10px;font-size:13px">Որոնում…</p>';
      var acc = [];
      var i = 0;
      function consume(job, list) {
        (list || []).forEach(function (p) {
          var rec = attachMeta(p, job.c, job.u);
          if (!posHit(rec, q) && !textHit(job.c.name, q) && !textHit(job.u.name, q)) return;
          acc.push(rec);
        });
      }
      function progress() {
        if (my !== scanToken || !listEl.isConnected) return;
        listEl.innerHTML = '<p class="muted" style="margin:10px;font-size:13px">Որոնում… ' + i + '/' + jobs.length + '</p>';
      }
      /* KM_PROMO_YIELD_V1: units already memoized are consumed in a tight time-boxed loop; a unit
         that still has to be computed runs time-sliced (vacantForUnitAsync), so the modal and the
         rest of the app stay responsive during the scan and progress text keeps updating. */
      function step() {
        if (my !== scanToken || !listEl.isConnected) return;
        var t0 = Date.now();
        while (i < jobs.length) {
          var job = jobs[i++];
          var mk = String(job.c.id) + '|' + String(job.u.id);
          if (vacantMemo[mk]) {
            consume(job, vacantMemo[mk]);
            if (i < jobs.length && Date.now() - t0 >= 12) { progress(); setTimeout(step, 0); return; }
            continue;
          }
          progress();
          vacantForUnitAsync(job.c.id, job.u.id, function (list) {
            if (my !== scanToken || !listEl.isConnected) return;
            consume(job, list);
            setTimeout(step, 0);
          });
          return;
        }
        renderShown(acc, q
          ? 'Հաստիքային կոդին համապատասխան թափուր պաշտոն չկա ըստ որոնման։'
          : 'Հաստիքային կոդին համապատասխան թափուր պաշտոն չկա այս զորամասում։');
      }
      setTimeout(step, 0);
    }
    function refreshAll(keepUnit) {
      var uid = keepUnit ? String(unitSel.value || '') : '';
      fillCorps();
      fillUnits();
      if (uid) unitSel.value = uid;
      fillPos();
    }
    fillCorps();
    fillUnits();
    listEl.innerHTML = '<p class="muted" style="margin:10px;font-size:13px">Բեռնվում է…</p>';
    var kick = function () {
      fillPos();
      try { if (searchEl) searchEl.focus(); } catch (eF) {}
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(function () { setTimeout(kick, 0); });
    else setTimeout(kick, 0);
    corpsSel.onchange = function () { fillUnits(); fillPos(); };
    unitSel.onchange = fillPos;
    var searchTimer = 0;
    searchEl.oninput = function () {
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(function () { refreshAll(true); }, 280);
    };
    el.querySelector('#kmPromoCancel').onclick = function () { closeModal({ keepArchiveCtx: true }); };
    el.querySelector('#kmPromoOk').onclick = async function () {
      if (!picked) { toastMsg('Ընտրեք թափուր պաշտոնը', 'warn'); return; }
      var cid = String(picked._promoCorpsId || corpsSel.value || '').trim();
      var uid = String(picked._promoUnitId || unitSel.value || '').trim();
      if (!cid || !uid) { toastMsg('Ընտրեք կորպուսը և զորամասը', 'warn'); return; }
      /* KM_PROMO_CONFIRM_NO_RANK_V1 — promotion by staffing code list; no rank gate */
      var excelRank = promoPosRank(picked);
      var unitName = picked._promoUnitName || '';
      var destRank = excelRank || nextRank;
      var msg = 'Տեղափոխե՞լ «' + name + '» → ' + (unitName || uid) + ' · ' + (picked.position || '') +
        (destRank ? (' · կոչում՝ ' + promoRankLabel(destRank)) : '') +
        '։\nՆերկա պաշտոնը կդառնա թափուր։ զորամասի արխիվը կթարմացվի։';
      if (!confirm(msg)) return;
      try {
        await window.kmApplyPositionPromotion({
          personIndex: personIndex,
          corpsId: cid,
          unitId: uid,
          unitName: unitName,
          target: picked,
          nextRank: destRank
        });
      } catch (eP) {
        toastMsg('Տեղափոխումը չկատարվեց՝ ' + ((eP && eP.message) || eP), 'error');
      }
    };
  };

  window.kmApplyPositionPromotion = async function (opts) {
    opts = opts || {};
    if (!canEdit()) { toastMsg('Դիտորդի իրավունք', 'error'); return { ok: false }; }
    ensureStore();
    var person = (db.people || [])[opts.personIndex];
    if (!person || !person.name) throw new Error('Անձը չգտնվեց');
    var name = String(person.name).trim();
    var oldPost = String(person.post || '').trim();
    var oldUnit = String(person.unit || '').trim();
    var personCopy = cloneJson(person);
    var homeKey = typeof window.kmActiveCorpsSliceId === 'function' ? window.kmActiveCorpsSliceId() : '';
    var targetKey = promoSliceKey(opts.corpsId, opts.unitId);
    var sameSlice = !targetKey || targetKey === homeKey;
    try { if (typeof window.kmSyncCorpsSlice === 'function') window.kmSyncCorpsSlice(); } catch (eSy) {}
    var srcBlob = promoLiveBlob();
    var oldAppointed = '';
    try {
      if (typeof window.kmExtractStaffAppointedAt === 'function') {
        oldAppointed = window.kmExtractStaffAppointedAt(null, personCopy);
      }
      promoWalkStaffRows(srcBlob, function (row) {
        if (!row || oldAppointed) return;
        if (!samePerson(row.name, name) && !samePerson(row.sourceName, name) && !samePerson(row.personName, name)) return;
        if (typeof window.kmExtractStaffAppointedAt === 'function') {
          oldAppointed = window.kmExtractStaffAppointedAt(row, personCopy) || oldAppointed;
        }
      });
    } catch (eDt) {}
    var linked = promoPullLinked(srcBlob, name);
    var staffSnap = null;
    try {
      promoWalkStaffRows(srcBlob, function (row) {
        if (staffSnap || !row || row.type === 'section') return;
        if (samePerson(row.name, name) || samePerson(row.sourceName, name) || samePerson(row.personName, name)) {
          staffSnap = cloneJson(row);
        }
      });
    } catch (eSnap) {}
    var vacated = promoVacateInBlob(srcBlob, name);
    vacated.forEach(function (pos) {
      try { persistLivePositionPerson(pos, '', { previousName: name }); } catch (eV) {}
    });
    if (!Array.isArray(personCopy.appointments)) personCopy.appointments = [];
    if (oldPost) {
      personCopy.appointments.unshift({
        post: oldPost,
        unit: oldUnit,
        date: new Date().toISOString().slice(0, 10),
        note: 'Պաշտոնի բարձրացում'
      });
      if (typeof window.kmPersonDedupeAppointments === 'function') {
        window.kmPersonDedupeAppointments(personCopy, false);
      }
    }
    if (!sameSlice) {
      try { await promoRewriteTouchedExcel(srcBlob); } catch (eXs) {}
      promoDropLinked(srcBlob, name);
      try { if (typeof window.kmSyncCorpsSlice === 'function') window.kmSyncCorpsSlice(); } catch (eS2) {}
      if (typeof window.kmApplyOrgSlice === 'function') {
        window.kmApplyOrgSlice(opts.corpsId, opts.unitId);
      }
    }
    var dstBlob = promoLiveBlob();
    ensureStore();
    var target = promoMaterialize(dstBlob, opts.target, opts.corpsId, opts.unitId, opts.unitName);
    promoApplyExcelFacts(target, opts.corpsId, opts.unitId);
    var personRankNow = promoPersonRank(personCopy);
    var destRank = promoPosRank(target) || opts.nextRank || promoNextRank(personRankNow);
    if (!promoPersonFitsPost(personRankNow, destRank)) {
      throw new Error('Արխիվի հաստիքային կոչումը (' + promoRankLabel(destRank) +
        ') չի համընկնում ներկա կոչմանը (' + promoRankLabel(personRankNow) + ')');
    }
    if (promoResolveName(target, dstBlob) && !samePerson(promoResolveName(target, dstBlob), name)) {
      throw new Error('Ընտրված պաշտոնն արդեն համալրված է');
    }
    if (!sameSlice) promoMergeLinked(dstBlob, name, personCopy, linked);
    else {
      var liveIdx = findPersonIndex(name);
      if (liveIdx >= 0) dstBlob.people[liveIdx] = personCopy;
      promoMergeLinked(dstBlob, name, personCopy, linked);
    }
    var pIdx = findPersonIndex(name);
    if (pIdx < 0) {
      dstBlob.people.push(personCopy);
      pIdx = dstBlob.people.length - 1;
    }
    var livePerson = dstBlob.people[pIdx];
    target.personName = name;
    target.sourceName = name;
    target.vacant = false;
    target.orgUnitId = opts.unitId || target.orgUnitId;
    target.corpsId = opts.corpsId || target.corpsId;
    target.archId = opts.target && opts.target.archId ? opts.target.archId : target.archId;
    if (opts.target && opts.target.excelRow != null) target.excelRow = opts.target.excelRow;
    if (!dstBlob.positionAssignments || typeof dstBlob.positionAssignments !== 'object') dstBlob.positionAssignments = {};
    dstBlob.positionAssignments[target.id] = {
      personName: name,
      vacant: false,
      manual: true,
      userEdited: true,
      promoted: true,
      position: target.position,
      section: target.section,
      code: target.code || '',
      updatedAt: new Date().toISOString()
    };
    applyPosToPerson(livePerson, target, true);
    var skipRestore = {
      post: 1, unit: 1, unitName: 1, postCode: 1, posCode: 1, rankSlot: 1, rank: 1,
      appointmentDate: 1, rankAppointedAt: 1, posOrder: 1, prevAppointmentDate: 1,
      posId: 1, vacant: 1, id: 1
    };
    Object.keys(personCopy).forEach(function (k) {
      if (!k || skipRestore[k]) return;
      if (personCopy[k] == null) return;
      if (k === 'specialty' && looksLikeStaffCode(personCopy[k])) {
        livePerson.specialty = '';
        return;
      }
      if (k === 'specialty' && target.code && String(personCopy[k]).trim() === String(target.code).trim()) {
        livePerson.specialty = '';
        return;
      }
      livePerson[k] = cloneJson(personCopy[k]);
    });
    if (linked && linked.dossier) {
      var dsrc = linked.dossier;
      Object.keys(dsrc).forEach(function (k) {
        if (!k || skipRestore[k]) return;
        if (dsrc[k] == null || dsrc[k] === '') return;
        if (k === 'specialty' && looksLikeStaffCode(dsrc[k])) return;
        if (k === 'specialty' && target.code && String(dsrc[k]).trim() === String(target.code).trim()) return;
        if (livePerson[k] == null || livePerson[k] === '' || (Array.isArray(livePerson[k]) && !livePerson[k].length)) {
          livePerson[k] = cloneJson(dsrc[k]);
        }
      });
      var mergedDossier = Object.assign({}, dsrc, {
        post: target.position || dsrc.post || '',
        postCode: target.code ? String(target.code).trim() : (dsrc.postCode || ''),
        rankSlot: destRank || target.rankSlot || dsrc.rankSlot || '',
        specialty: looksLikeStaffCode(livePerson.specialty) ? '' : (livePerson.specialty || dsrc.specialty || '')
      });
      if (!dstBlob.unitDossiers || typeof dstBlob.unitDossiers !== 'object') dstBlob.unitDossiers = {};
      dstBlob.unitDossiers[name] = mergedDossier;
    }
    if (destRank) livePerson.rank = destRank;
    if (target.code) {
      livePerson.postCode = String(target.code).trim();
      livePerson.posCode = livePerson.postCode;
    }
    if (looksLikeStaffCode(livePerson.specialty) || (livePerson.postCode && String(livePerson.specialty || '').trim() === String(livePerson.postCode).trim())) {
      livePerson.specialty = '';
    }
    if (opts.unitName) livePerson.unitName = opts.unitName;
    var todayIso = new Date().toISOString().slice(0, 10);
    if (oldAppointed) livePerson.prevAppointmentDate = oldAppointed;
    livePerson.appointmentDate = todayIso;
    livePerson.rankAppointedAt = todayIso;
    livePerson.posOrder = (livePerson.posOrder ? (String(livePerson.posOrder) + ' · ') : '') + todayIso;
    promoFillTargetStaff(dstBlob, target, livePerson, staffSnap);
    try { persistLivePositionPerson(target, name, { manual: true, previousName: '' }); } catch (ePt) {}
    try {
      if (typeof window.kmScheduleRankTerm === 'function') {
        window.kmScheduleRankTerm({
          person: name,
          rank: destRank || livePerson.rank,
          nextRank: (typeof window.kmNextOfficerRank === 'function'
            ? window.kmNextOfficerRank(destRank || livePerson.rank)
            : '') || undefined,
          fromDate: todayIso,
          prevDate: oldAppointed,
          post: target.position || '',
          code: target.code || livePerson.postCode || '',
          rankSlot: destRank || target.rankSlot || '',
          unit: opts.unitName || livePerson.unit || '',
          corpsId: opts.corpsId,
          unitId: opts.unitId
        });
      }
    } catch (eTerm) {}
    bumpPositionsMut();
    if (typeof window.kmHishoxutyunLog === 'function') {
      window.kmHishoxutyunLog({
        section: 'positions',
        sectionLabel: 'Պաշտոն',
        action: 'attach',
        detail: 'Պաշտոնի բարձրացում՝ ' + name +
          (oldPost ? (' · էր՝ ' + oldPost) : '') +
          ' → ' + (target.position || '') +
          (target.section ? (' · ' + target.section) : '') +
          (opts.unitName ? (' · ' + opts.unitName) : '') +
          (destRank ? (' · կոչում՝ ' + promoRankLabel(destRank)) : '') +
          (oldAppointed ? (' · նախկին նշանակում՝ ' + oldAppointed) : '') +
          (vacated.length ? (' · թափուր դարձավ՝ ' + vacated.length) : '')
      });
    }
    closeModal({ keepArchiveCtx: true });
    try { await promoRewriteTouchedExcel(dstBlob); } catch (eXd) {}
    if (typeof save === 'function') await save(true);
    try {
      if (typeof window.kmPersistOrgArchives === 'function') await window.kmPersistOrgArchives({ replace: false });
    } catch (eArch) {}
    toastMsg('Տեղափոխվեց նոր պաշտոն · նախկինը թափուր է · զորամասի արխիվը թարմացվեց', 'ok');
    var openIdx = findPersonIndex(name);
    var card = document.getElementById('kmExtModal');
    if (card) card.remove();
    if (openIdx >= 0 && typeof window.kmOpenPersonCard === 'function') {
      window.kmOpenPersonCard(openIdx);
    } else if (typeof window.kmOpenPositionsPage === 'function') {
      window.kmOpenPositionsPage();
    }
    return { ok: true, personIndex: openIdx, positionId: target.id };
  };

  function filteredPositions() {
    var cat = getPositionsView().cat;
    var q = String(state.q || '').trim().toLowerCase();
    var match = selectionMatchFn(state.sectionId);
    var out = [];
    var list = cat.positions || [];
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (!match(p)) continue;
      var person = resolvePositionPerson(p);
      if (state.onlyVacant && person) continue;
      if (q) {
        var blob = (p.position + ' ' + p.section + ' ' + p.unit + ' ' + (p.code || '') + ' ' + (p.rankSlot || '') + ' ' + person).toLowerCase();
        if (blob.indexOf(q) < 0) continue;
      }
      out.push(p);
    }
    return out;
  }

  function bindPosRoot(root) {
    if (!root || root.__kmPosBound) return;
    root.__kmPosBound = true;
    root.addEventListener('click', function (ev) {
      var t = ev.target;
      if (!t || !t.closest) return;
      var tw = t.closest('[data-km-pos="tw"]');
      if (tw) {
        ev.preventDefault();
        ev.stopPropagation();
        var tid = tw.getAttribute('data-id') || '';
        if (state.expanded[tid]) delete state.expanded[tid];
        else state.expanded[tid] = 1;
        window.kmOpenPositionsPage();
        return;
      }
      var btn = t.closest('[data-km-pos]');
      if (!btn) return;
      var act = btn.getAttribute('data-km-pos');
      var id = btn.getAttribute('data-id');
      if (act === 'tw') return;
      if (act === 'sec') {
        state.sectionId = id || '';
        state.page = 0;
        window.kmOpenPositionsPage({ listOnly: true });
      } else if (act === 'card') {
        window.kmPositionOpenCard(id);
      } else if (act === 'assign') {
        window.kmPositionAssign(id);
      } else if (act === 'vacant') {
        window.kmPositionMakeVacant(id);
      } else if (act === 'add') {
        window.kmPositionAdd();
      } else if (act === 'units') {
        if (typeof window.kmShowOrgUnitManager === 'function') window.kmShowOrgUnitManager();
      } else if (act === 'openList') {
        window.kmPositionOpenList();
      } else if (act === 'archive') {
        window.kmPositionArchiveOpen();
      } else if (act === 'refresh') {
        window.kmPositionsRefresh();
      } else if (act === 'resetShtat') {
        window.kmResetPositionsToShtat();
      } else if (act === 'page') {
        state.page = Number(id) || 0;
        window.kmOpenPositionsPage({ listOnly: true });
      }
    });
    root.addEventListener('change', function (ev) {
      var t = ev.target;
      if (!t) return;
      if (t.id === 'kmPosVacant') {
        state.onlyVacant = !!t.checked;
        state.page = 0;
        window.kmOpenPositionsPage({ listOnly: true });
      }
    });
    root.addEventListener('input', function (ev) {
      var t = ev.target;
      if (!t || t.id !== 'kmPosSearch') return;
      state.q = t.value || '';
      state.page = 0;
      state._keepSearchFocus = true;
      clearTimeout(state._searchTimer);
      state._searchTimer = setTimeout(function () { window.kmOpenPositionsPage({ listOnly: true }); }, 180);
    });
  }

  function renderTreeNodes(nodes) {
    var html = '';
    nodes.forEach(function (node) {
      var hasKids = node.children && node.children.length;
      var open = !!state.expanded[node.id];
      var cnt = node._count != null ? node._count : 0;
      var tw = hasKids
        ? ('<button type="button" class="kmPosTreeTw" data-km-pos="tw" data-id="' + esc(node.id) + '" title="Բացել/փակել">' +
          (open ? '▼' : '▶') + '</button>')
        : '<span class="kmPosTreeTw sp">·</span>';
      html += '<div class="kmPosTreeRow">' + tw +
        '<button type="button" class="kmPosTreeBtn' + (state.sectionId === node.id ? ' active' : '') +
        '" data-km-pos="sec" data-id="' + esc(node.id) + '" title="' + esc(node.name) + '">' +
        '<span class="lab">' + esc(node.name) + '</span><span class="n">' + cnt + '</span></button></div>';
      if (hasKids && open) {
        html += '<div class="kmPosTreeKids">' + renderTreeNodes(node.children) + '</div>';
      }
    });
    return html;
  }

  window.kmOpenPositionsPage = function (opts) {
    /* KM_POSITIONS_UNFREEZE_V2 / KM_POSITIONS_MANNING_PCT_V1 / KM_SYSTEM_WIDE_V1 */
    opts = opts || {};
    injectCss();
    ensureStore();
    var host = document.getElementById('content');
    if (!host) return;
    if (!opts.listOnly) {
      var laterPurge = function () {
        try { if (typeof window.kmPurgeAccountingIfNoArchive === 'function') window.kmPurgeAccountingIfNoArchive(); } catch (ePur) {}
      };
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(function () { setTimeout(laterPurge, 0); });
      else setTimeout(laterPurge, 0);
    }

    var view = getPositionsView();
    var cat = view.cat;
    var positions = cat.positions || [];
    var list = filteredPositions();
    var filled = 0;
    for (var fi = 0; fi < list.length; fi++) if (resolvePositionPerson(list[fi])) filled++;
    var vacantN = list.length - filled;
    var pages = Math.max(1, Math.ceil(list.length / state.pageSize) || 1);
    if (!list.length) pages = 1;
    if (state.page >= pages) state.page = pages - 1;
    if (state.page < 0) state.page = 0;
    var start = state.page * state.pageSize;
    var slice = list.slice(start, start + state.pageSize);

    var rows = '';
    for (var i = 0; i < slice.length; i++) {
      var p = slice[i];
      var person = resolvePositionPerson(p);
      rows += '<tr>' +
        '<td><b>' + esc(p.position) + '</b>' +
        '<div class="muted" style="font-size:11px">' + esc(p.section) + '</div>' +
        (p.code ? '<div class="muted" style="font-size:11px">կոդ՝ ' + esc(p.code) + '</div>' : '') +
        (p.rankSlot ? '<div class="muted" style="font-size:11px">' + esc(p.rankSlot) + '</div>' : '') +
        '</td><td>' + (person ? '<span class="kmPosFilled">' + esc(person) + '</span>' : '<span class="kmPosVacant">թափուր</span>') +
        '</td><td class="kmPosActs" style="white-space:nowrap">' +
        '<button type="button" class="kmPosAct kmPosActOn primary" data-km-pos="card" data-id="' + esc(p.id) + '">Քարտ</button>' +
        (canEdit()
          ? '<button type="button" class="kmPosAct kmPosActOff" data-km-pos="assign" data-id="' + esc(p.id) + '">կցել</button>' +
            '<button type="button" class="kmPosAct kmPosActOff" data-km-pos="vacant" data-id="' + esc(p.id) + '" title="Դարձնել թափուր">Դարձնել թափուր</button>'
          : '') +
        '</td></tr>';
    }
    if (!rows) {
      rows = '<tr><td colspan="3" class="muted">' +
        ((typeof window.kmUnitHasStaffSource === 'function' ? !window.kmUnitHasStaffSource() : (typeof window.kmUnitHasExcelArchive === 'function' && !window.kmUnitHasExcelArchive()))
          ? 'Այս զորամասի արխիվում ֆայլ չկա։ Բեռնեք Excel Բանակային կորպուսներ → Արխիվ։'
          : (canEdit()
            ? 'Ցուցակը դատարկ է։ Բեռնեք Excel Բանակային կորպուսներ → Արխիվ։'
            : 'Պաշտոն չկա')) +
        '</td></tr>';
    }

    var pager = pages > 1
      ? ('<div class="toolbar" style="margin-top:8px" id="kmPosPager">' +
        '<button type="button" data-km-pos="page" data-id="' + Math.max(0, state.page - 1) + '"' + (state.page <= 0 ? ' disabled' : '') + '>←</button>' +
        '<span class="muted">Էջ ' + (state.page + 1) + '/' + pages + ' · ' + list.length +
        (state.onlyVacant ? ' թափուր' : (' · թափուր ' + vacantN)) + '</span>' +
        '<button type="button" data-km-pos="page" data-id="' + Math.min(pages - 1, state.page + 1) + '"' + (state.page >= pages - 1 ? ' disabled' : '') + '>→</button></div>')
      : ('<div class="muted" style="margin-top:8px" id="kmPosPager">' + list.length + ' պաշտոն' +
        (state.onlyVacant ? '' : (' · թափուր ' + vacantN)) + '</div>');

    var selLabel = state.sectionId
      ? ((findSectionById(state.sectionId) || {}).name || state.sectionId)
      : 'Բոլորը';

    var root = host.querySelector('#kmPosRoot');
    if (opts.listOnly && root) {
      var meta = root.querySelector('[data-km-pos-meta]');
      if (meta) {
        meta.textContent = (cat.source || '') + ' · ' +
          (cat.sections || []).length + ' ստորաբաժանում · ' + positions.length + ' պաշտոն · ընտրված՝ ' + selLabel +
          ' · համալրված ' + filled + '/' + list.length + (list.length ? (' (' + (Math.round(filled / list.length * 1000) / 10) + '%)') : '');
      }
      root.querySelectorAll('.kmPosTreeBtn').forEach(function (b) {
        var id = b.getAttribute('data-id') || '';
        b.classList.toggle('active', state.sectionId ? id === state.sectionId : !id);
      });
      var tb = root.querySelector('#kmPosTableBody');
      if (tb) tb.innerHTML = rows;
      var pg = root.querySelector('#kmPosPager');
      if (pg) pg.outerHTML = pager;
      else {
        var gw = root.querySelector('.kmPosListPane');
        if (gw) gw.insertAdjacentHTML('beforeend', pager);
      }
      if (state._keepSearchFocus) {
        state._keepSearchFocus = false;
        var se0 = root.querySelector('#kmPosSearch');
        if (se0) {
          se0.focus();
          try { var L0 = se0.value.length; se0.setSelectionRange(L0, L0); } catch (eF0) {}
        }
      }
      setPersonnelPage('positions');
      return;
    }

    var forest = view.forest || buildSectionForest(positions);
    var tree = '<button type="button" class="kmPosTreeBtn' + (!state.sectionId ? ' active' : '') +
      '" data-km-pos="sec" data-id="">Բոլորը <span class="n">' + positions.length + '</span></button>' +
      renderTreeNodes(forest);

    host.innerHTML =
      personnelShellStart('positions') +
      '<div id="kmPosRoot">' +
        '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px">' +
          '<div>' +
          '<div class="muted" style="font-size:12px" data-km-pos-meta="1">' + esc(cat.source || '') + ' · ' +
          (cat.sections || []).length + ' ստորաբաժանում · ' + positions.length + ' պաշտոն · ընտրված՝ ' + esc(selLabel) +
          ' · համալրված ' + filled + '/' + list.length +
          '</div></div>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
            (canEdit()
              ? '<button type="button" data-km-pos="add">Ավելացնել պաշտոն</button>' +
                ((typeof window.kmCanManageOrgUnits === 'function' && window.kmCanManageOrgUnits()) ||
                 (typeof window.kmIsSuperAdmin === 'function' && window.kmIsSuperAdmin())
                  ? '<button type="button" data-km-pos="units">Զորամասեր</button>'
                  : '')
              : '') +
            '<button type="button" data-km-pos="refresh" title="Թարմացնել (F5)">Թարմացնել (F5)</button>' +
            (canEdit()
              ? '<button type="button" data-km-pos="resetShtat" title="Մաքրել ձեռքով ցուցակը">Մաքրել ցուցակը</button>'
              : '') +
          '</div>' +
        '</div>' +
        '<div class="kmPosTools">' +
          '<input id="kmPosSearch" type="search" value="' + esc(state.q) + '" placeholder="Որոնել պաշտոն / Ա․Ա․Հ…">' +
          '<label><input id="kmPosVacant" type="checkbox"' + (state.onlyVacant ? ' checked' : '') + '> Միայն թափուր</label>' +
        '</div>' +
        '<div class="kmPosLayout">' +
          '<div class="kmPosTree">' + tree + '</div>' +
          '<div class="kmPosListPane">' +
            '<div class="gridwrap" style="max-height:66vh;overflow:auto;border:1px solid #d5e0d9;border-radius:10px">' +
              '<table class="kmPosTable"><thead><tr><th>Պաշտոն</th><th>Ա․Ա․Հ</th><th></th></tr></thead>' +
              '<tbody id="kmPosTableBody">' + rows + '</tbody></table></div>' + pager +
          '</div>' +
        '</div></div></div>';

    bindPersonnelHubExtras(host);
    bindPosRoot(host.querySelector('#kmPosRoot'));
    if (state._keepSearchFocus) {
      state._keepSearchFocus = false;
      var se = host.querySelector('#kmPosSearch');
      if (se) {
        se.focus();
        try { var L = se.value.length; se.setSelectionRange(L, L); } catch (eF) {}
      }
    }
    setPersonnelPage('positions');
    if (typeof window.kmApplyRoleGuard === 'function') try { window.kmApplyRoleGuard(); } catch (e) {}
  };

  window.kmPositionsRefresh = function () {
    ensureStore();
    try {
      if (typeof save === 'function') save(true);
    } catch (e) {}
    window.kmOpenPositionsPage();
    toastMsg('Պաշտոն բաժինը թարմացվեց', 'ok');
  };

  /* ---- Անձնակազմ՝ Պաշտոն բաժնի ստորաբաժանումներ + համալրված անձինք ---- */
  var _peopleByUnitMapCache = { at: 0, map: null };
  function peopleByUnitMap() {
    /* KM_PEOPLE_MAP_CACHE_V1 + KM_PEOPLE_COLLAPSE_CACHE_V1 */
    var now = Date.now();
    if (_peopleByUnitMapCache.map && (now - _peopleByUnitMapCache.at) < 3000) return _peopleByUnitMapCache.map;
    /* KM_PURE_ACTIVE_NO_ARCHIVE_V1_POS_GATE_PPL */
    if (false /* KM_NO_ARCHIVES disabled */) {
      var map = Object.create(null);
      try {
        (typeof db !== 'undefined' && Array.isArray(db.people) ? db.people : []).forEach(function (p) {
          if (!p || !p.name) return;
          var u = String(p.unit || p.section || 'Այլ').trim() || 'Այլ';
          if (!map[u]) map[u] = [];
          map[u].push({ name: p.name, post: p.post || '', rank: p.rank || '', fromArchive: false });
        });
      } catch (eM) {}
      return map;
    }
    /* KM_ARCHIVE_STRICT_SOURCE_V3_POS peopleByUnitMap: Unit Archive people only (no Excel sync) */
    var map = Object.create(null);
    if (typeof window.kmUnitHasStaffSource === 'function' ? !window.kmUnitHasStaffSource() : (typeof window.kmUnitHasExcelArchive === 'function' && !window.kmUnitHasExcelArchive())) {
      return map;
    }
    var list = [];
    try {
      if (window.kmUnitArchiveStaffSource && typeof window.kmUnitArchiveStaffSource.people === 'function') {
        list = window.kmUnitArchiveStaffSource.people() || [];
      }
    } catch (eP) { list = []; }
    if (!list.length) {
      try {
        var cat = catalog();
        (cat.positions || []).forEach(function (p) {
          var n = resolvePositionPerson(p);
          if (!n || !looksLikePersonName(n)) return;
          if (typeof window.kmPersonNameIsVacantStub === 'function' && window.kmPersonNameIsVacantStub(n)) return;
          list.push({
            name: n,
            unit: p.section || p.unit || '',
            post: p.position || '',
            rank: p.rank || p.rankSlot || '',
            rankSlot: p.rankSlot || '',
            code: p.code || '',
            fromFormal: !!p.fromFormal
          });
        });
      } catch (eC) {}
    }
    (list || []).forEach(function (p) {
      if (!p) return;
      var n = String(p.name || '').trim();
      if (!n || !looksLikePersonName(n)) return;
      if (typeof window.kmPersonNameIsVacantStub === 'function' && window.kmPersonNameIsVacantStub(n)) return;
      var u = String(p.unit || p.section || '').trim() || 'Այլ';
      if (!map[u]) map[u] = [];
      if (map[u].some(function (x) { return samePerson(x.name, n); })) return;
      map[u].push({
        name: n,
        post: p.post || p.position || '',
        rank: p.rank || p.rankSlot || '',
        rankSlot: p.rankSlot || '',
        posId: p.posId || '',
        code: p.code || p.postCode || '',
        education: p.education || '',
        specialty: p.specialty || '',
        fromArchive: true
      });
    });
    _peopleByUnitMapCache = { at: Date.now(), map: map };
    return map;
  }

  /** db.people = synced from positions (skipped when formal) */
  
  function syncDbPeopleFromUserPositions() {
    /* KM_ARCHIVE_STRICT_SOURCE_V3_POS syncGuard: skip heavy Excel wipe when formal archive drives lists */
    if (typeof db === 'undefined') return;
    try {
      if (window.kmUnitArchiveStaffSource && window.kmUnitArchiveStaffSource.hasFormal && window.kmUnitArchiveStaffSource.hasFormal()) {
        return;
      }
    } catch (eSkip) {}
    ensureStore();
    var keep = Object.create(null);
    var order = [];
    (catalog().positions || []).forEach(function (pos) {
      var n = resolvePositionPerson(pos);
      if (!n) return;
      var k = n.toLowerCase();
      if (keep[k]) return;
      keep[k] = 1;
      var idx = findPersonIndex(n);
      if (idx < 0) {
        ensurePersonFromName(n, pos, true);
        idx = findPersonIndex(n);
      } else {
        applyPosToPerson(db.people[idx], pos, false);
      }
      if (idx >= 0) order.push(db.people[idx]);
    });
    db.people = order;
  }

  /* KM_PROMOTION_BY_STAFFING_CODE_ONLY_V1 */
  function kmNormStaffingCode(c) {
    return String(c == null ? '' : c).replace(/\s+/g, '').trim().toLowerCase();
  }
  /** Structural family of a staffing code: keep prefix before last numeric/segment token. */
  function kmStaffingCodeStructure(c) {
    var n = kmNormStaffingCode(c);
    if (!n) return '';
    // split on common separators; if none, drop trailing digits group
    var parts = n.split(/[-–—\.\/\|]+/).filter(Boolean);
    if (parts.length >= 2) return parts.slice(0, -1).join('-');
    var m = n.match(/^(.*?)(\d+)$/);
    return m ? (m[1] || n) : n;
  }
  function kmStaffingGradeToken(c) {
    /* KM_PROMO_CODE_HIERARCHY_V1 — short grade like 19/20/23 or 3/6; ignore long VUS */
    var n = kmNormStaffingCode(c);
    if (!n) return '';
    if (/^\d{1,3}$/.test(n)) return n;
    if (/^\d{1,3}\/\d{1,3}$/.test(n)) return n;
    return '';
  }
  function kmStaffingGradeValue(c) {
    var g = kmStaffingGradeToken(c);
    if (!g) return null;
    if (g.indexOf('/') >= 0) {
      var parts = g.split('/');
      return (parseInt(parts[0], 10) || 0) * 1000 + (parseInt(parts[1], 10) || 0);
    }
    return parseInt(g, 10);
  }
  function kmRowStaffingCode(r) {
    if (!r || typeof r !== 'object') return '';
    var code = String(r.code || r.postCode || r.staffingCode || '').trim();
    var vus = String(r.vus || r.specialty || '').trim();
    if (kmStaffingGradeToken(code)) return kmStaffingGradeToken(code);
    if (kmStaffingGradeToken(vus)) return kmStaffingGradeToken(vus);
    return kmNormStaffingCode(code || vus);
  }
  function kmStaffingCodesCompatible(a, b) {
    /* KM_PROMO_CODE_HIERARCHY_V1b — equal grade, or higher grade in SAME shape (19→20/23; not 19→3/6) */
    var ga = kmStaffingGradeToken(a);
    var gb = kmStaffingGradeToken(b);
    if (!ga || !gb) {
      var na0 = kmNormStaffingCode(a);
      var nb0 = kmNormStaffingCode(b);
      return !!(na0 && nb0 && na0 === nb0);
    }
    if (ga === gb) return true;
    var slashA = ga.indexOf('/') >= 0;
    var slashB = gb.indexOf('/') >= 0;
    if (slashA !== slashB) return false;
    var va = kmStaffingGradeValue(ga);
    var vb = kmStaffingGradeValue(gb);
    if (va == null || vb == null) return false;
    return vb >= va;
  }
  window.kmNormStaffingCode = kmNormStaffingCode;
  window.kmStaffingCodeStructure = kmStaffingCodeStructure;
  window.kmStaffingCodesCompatible = kmStaffingCodesCompatible;
  window.kmStaffingGradeToken = kmStaffingGradeToken;
  window.kmStaffingGradeValue = kmStaffingGradeValue;
  window.kmRowStaffingCode = kmRowStaffingCode;
  window.kmFindVacantByStaffingCode = function (code, opts) {
    opts = opts || {};
    var want = kmNormStaffingCode(code);
    if (!want) return [];
    ensureStore();
    var out = [];
    var list = (typeof catalog === 'function' ? (catalog().positions || []) : null)
      || (db.userPositions || []);
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (!p) continue;
      var pc = kmNormStaffingCode(p.code);
      if (!pc) continue;
      if (opts.exactOnly) {
        if (pc !== want) continue;
      } else if (!kmStaffingCodesCompatible(want, pc)) continue;
      var occupied = typeof resolvePositionPerson === 'function'
        ? resolvePositionPerson(p)
        : (p.personName || '');
      if (occupied && !opts.includeFilled) continue;
      if (opts.unit) {
        var u = String(p.section || p.unit || '').trim();
        if (u && String(opts.unit).trim() && u !== String(opts.unit).trim()) continue;
      }
      out.push(p);
    }
    return out;
  };
  window.kmSuggestPromotionByStaffingCode = function (personOrCode, opts) {
    var code = typeof personOrCode === 'string'
      ? personOrCode
      : ((personOrCode && (personOrCode.postCode || personOrCode.code)) || '');
    return window.kmFindVacantByStaffingCode(code, opts || {});
  };

  window.kmOnPersonAddedFromPeople = function (person) {
    /* KM_PROMOTION_BY_STAFFING_CODE_ONLY_V1 — place by հաստիքային կոդ only; never first-vacant / never rank. */
    if (!person || !person.name) return;
    ensureStore();
    var unit = String(person.unit || '').trim() || 'Այլ';
    var name = String(person.name).trim();
    var code = String(person.postCode || person.code || '').trim();
    var vacant = null;
    if (code) {
      var byCode = window.kmFindVacantByStaffingCode(code, { unit: unit, exactOnly: true });
      if (byCode && byCode.length) vacant = byCode[0];
      if (!vacant) {
        byCode = window.kmFindVacantByStaffingCode(code, { exactOnly: true });
        if (byCode && byCode.length) vacant = byCode[0];
      }
    }
    if (vacant) {
      vacant.personName = name;
      vacant.vacant = false;
      db.positionAssignments[vacant.id] = {
        personName: name,
        position: vacant.position,
        section: vacant.section,
        code: vacant.code || code || '',
        manual: true,
        updatedAt: new Date().toISOString(),
        byStaffingCode: true
      };
      applyPosToPerson(person, vacant, true);
      try {
        if (window.kmPersonnelSyncBus) window.kmPersonnelSyncBus.syncIdentityFromRow({
          name: name, code: vacant.code || code, position: vacant.position, unit: vacant.section
        });
      } catch (eSync) {}
      return;
    }
    var row = {
      id: 'up_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      position: person.post || 'պաշտոն',
      section: unit,
      code: code || '',
      rankSlot: '',
      personName: name,
      vacant: false,
      order: (db.userPositions || []).length + 1
    };
    db.userPositions.push(row);
    bumpPositionsMut();
    db.positionAssignments[row.id] = {
      personName: name,
      position: row.position,
      section: row.section,
      code: row.code || '',
      manual: true,
      updatedAt: new Date().toISOString(),
      byStaffingCode: true
    };
    applyPosToPerson(person, row, true);
    try {
      if (window.kmPersonnelSyncBus) window.kmPersonnelSyncBus.syncIdentityFromRow({
        name: name, code: row.code, position: row.position, unit: row.section
      });
    } catch (eSync2) {}
  };

  window.kmOnPersonRemovedFromPeople = function (name) {
    name = String(name || '').trim();
    if (!name) return;
    ensureStore();
    markPeopleRemoved(name, 'remove');
    (db.userPositions || []).forEach(function (p) {
      if (!p) return;
      var cur = resolvePositionPerson(p);
      if (!samePerson(cur, name) && !samePerson(p.personName, name)) return;
      persistLivePositionPerson(p, '', { previousName: name });
    });
  };

  window.kmOnPersonEditedFromPeople = function (person, oldName) {
    if (!person) return;
    ensureStore();
    var name = String(person.name || '').trim();
    var prev = String(oldName || name).trim();
    (db.userPositions || []).forEach(function (p) {
      if (!p) return;
      if (!samePerson(p.personName, prev) && !samePerson(resolvePositionPerson(p), prev)) return;
      p.personName = name;
      p.vacant = !name;
      if (person.unit) p.section = String(person.unit).trim();
      if (person.post) p.position = person.post;
      /* KM_PROMOTION_BY_STAFFING_CODE_ONLY_V1: do not copy կոչում into rankSlot */
      if (person.postCode) p.code = person.postCode;
      persistLivePositionPerson(p, name, { previousName: prev, manual: true });
    });
  };

  window.kmPeopleOpenCardByName = function (name) {
    try { window.kmSyncPeopleFromPositions(); } catch (e0) {}
    var idx = ensurePersonFromName(name, null);
    if (idx < 0) return;
    window.kmOpenPersonCardSafe(idx);
  };

  window.kmPeopleAddFromShtat = function () {
    if (!canEdit()) { toastMsg('Դիտորդի իրավունք', 'error'); return; }
    ensureStore();
    var a = latestScopedArchive();
    if (a) {
      downloadArchive(a.id);
      return;
    }
    toastMsg('Այս զորամասի Պաշտոն արխիվում ֆայլ չկա — բացվում է արխիվը', 'warn');
    window.kmPositionArchiveOpen();
  };

  function renderPeopleByStructure() {
    /* KM_PERSONNEL_HUB_LAG_V1: shell first paint + chunked/rAF unit rows (avoid giant sync innerHTML) */
    /* KM_ARCHIVE_FULL_SYNC_V2_POS: no sync on render (was freezing) */
    injectCss();
    ensureStore();
    var host = document.getElementById('content');
    if (!host) return;
    var uidEnsure = currentArchiveUnitId();
    var noArch = typeof window.kmUnitHasStaffSource === 'function'
      ? !window.kmUnitHasStaffSource(uidEnsure)
      : (typeof window.kmUnitHasExcelArchive === 'function' && !window.kmUnitHasExcelArchive(uidEnsure));
    if (noArch) {
      try { if (typeof window.kmPurgeAccountingIfNoArchive === 'function') window.kmPurgeAccountingIfNoArchive(); } catch (ePur) {}
    }
    if (uidEnsure && !noArch && typeof window.kmEnsureUnitArchiveRows === 'function' && !renderPeopleByStructure._ensuring) {
      if (!window._kmPeopleArchiveEnsure) window._kmPeopleArchiveEnsure = {};
      if (!window._kmPeopleArchiveEnsure[uidEnsure]) {
        window._kmPeopleArchiveEnsure[uidEnsure] = true;
        renderPeopleByStructure._ensuring = true;
        Promise.resolve(window.kmEnsureUnitArchiveRows(uidEnsure, { skipNetwork: true })).then(function () {
          renderPeopleByStructure._ensuring = false;
          renderPeopleByStructure();
        }).catch(function () { renderPeopleByStructure._ensuring = false; });
      }
    }

    var gen = (renderPeopleByStructure._gen = (renderPeopleByStructure._gen || 0) + 1);

    host.innerHTML =
      personnelShellStart('people') +
        '<div class="kmPeopleStruct" id="kmPeopleStructRoot">' +
        '<div class="toolbar" style="flex-wrap:wrap;gap:8px;align-items:center">' +
          (canEdit()
            ? '<button type="button" class="primary" id="kmPeopleAddManual">＋ Ավելացնել</button>' +
              '<button type="button" id="kmPeopleRemove">− Հեռացնել</button>'
            : '') +
          '<button type="button" onclick="exportPeopleCSV()">CSV</button>' +
          '<input type="search" id="kmPeopleUnitSearch" placeholder="Փնտրել ստորաբաժանում…" autocomplete="off" style="padding:6px 10px;min-width:200px">' +
          '<span class="muted" id="kmPeopleStructStats" style="margin-left:auto">Բեռնվում է…</span>' +
        '</div>' +
        '<div id="kmPeoplePagerBar" style="display:flex;gap:10px;align-items:center;margin:8px 0"></div>' +
        '<div id="kmPeopleStructList"><p class="muted" style="margin:8px">Բեռնվում է անձնակազմը…</p></div>' +
      '</div></div>';
    bindPersonnelHubExtras(host);

    var root = host.querySelector('#kmPeopleStructRoot');
    if (root && !root.__bound) {
      root.__bound = true;
      root.addEventListener('click', function (ev) {
        var t = ev.target;
        if (!t) return;
        if (t.id === 'kmPeopleAddManual') {
          if (typeof window.__kmAddPersonOrig === 'function') window.__kmAddPersonOrig();
          else if (typeof addPerson === 'function') addPerson();
          return;
        }
        if (t.id === 'kmPeopleRemove') {
          if (typeof removePerson === 'function') removePerson();
          return;
        }
        var tog = t.closest && t.closest('[data-km-toggle]');
        if (tog) {
          var id = tog.getAttribute('data-km-toggle');
          var bodyEl = document.getElementById('kmPsBody_' + id);
          if (bodyEl) {
            /* KM_PEOPLE_LAZY_UNIT_TABLE_V1: build the table only on first expand, not at page open */
            if (bodyEl.dataset.built !== '1' && typeof root.__kmBuildUnitBody === 'function') {
              bodyEl.innerHTML = root.__kmBuildUnitBody(id);
              bodyEl.dataset.built = '1';
            }
            bodyEl.hidden = !bodyEl.hidden;
          }
        }
      });
    }

    setPersonnelPage('people');
    if (typeof window.kmApplyRoleGuard === 'function') try { window.kmApplyRoleGuard(); } catch (e) {}

    /* KM_PEOPLE_LAZY_UNIT_TABLE_V1: department table BODY is no longer built/inserted for
       every unit up front (even chunked-over-frames, that still eventually renders and keeps
       in the DOM every person of every department). Only the header (name + count) is built
       at open time; the actual <table> of people for a department is built and inserted into
       the DOM the first time that department is expanded, and cached after that so re-toggling
       it is instant. This keeps initial render O(units) instead of O(total people) and keeps
       DOM size proportional to what the user has actually opened. */
    var _kmPeopleUnitData = {};
    function buildUnitBodyHtml(sid) {
      var people = _kmPeopleUnitData[sid] || [];
      if (typeof window.kmSortPeopleByRank === 'function') {
        try { people = window.kmSortPeopleByRank(people); } catch (eS) {}
      }
      var body = people.length
        ? people.map(function (x) {
          return '<tr><td>' + esc(x.name) + '</td><td>' + esc(x.rank || '') + '</td><td>' + esc(x.post || '') +
            '</td><td>' + esc(x.education || '') + '</td><td>' + esc(x.specialty || '') + '</td></tr>';
        }).join('')
        : '<tr><td colspan="5" class="muted">Թափուր պաշտոններ · անձ չկա</td></tr>';
      return '<table><thead><tr><th>Ա․Ա․Հ</th><th>Կոչում</th><th>Պաշտոն</th><th>Կրթություն</th><th>Մասնագիտություն</th></tr></thead><tbody>' +
        body + '</tbody></table>';
    }
    if (root) root.__kmBuildUnitBody = buildUnitBodyHtml;

    function buildUnitHtml(u, uiOrName, people) {
      /* KM_PEOPLE_PAGINATION_V1: sid is now derived from the unit NAME (hashed to a safe id),
         not a numeric list index — with pagination + search, the same unit can appear at a
         different index depending on the current page/query, so an index-based id would not
         stay stable (and could collide with a different unit at the same index elsewhere). */
      var sid = 'u' + String(uiOrName).split('').reduce(function (h, ch) { return ((h << 5) - h + ch.charCodeAt(0)) | 0; }, 0);
      _kmPeopleUnitData[sid] = people; /* stashed, not rendered yet */
      return '<div class="kmPosSec">' +
        '<div class="kmPosSecHead" data-km-toggle="' + sid + '"><b>' + esc(u) + '</b><span class="muted">' +
        people.length + ' անձ</span></div>' +
        '<div class="kmPosSecBody" id="kmPsBody_' + sid + '" hidden data-built="0"></div></div>';
    }

    // Defer heavy map + DOM to next frames
    var raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : function (fn) { setTimeout(fn, 16); };
    raf(function () {
      if (gen !== renderPeopleByStructure._gen) return;
      var map = peopleByUnitMap();
      var units = Object.keys(map).sort(function (a, b) { return a.localeCompare(b, 'hy'); });
      var total = 0;
      units.forEach(function (u) { total += (map[u] || []).length; });
      var listEl = document.getElementById('kmPeopleStructList');
      var statsEl = document.getElementById('kmPeopleStructStats');
      var pagerEl = document.getElementById('kmPeoplePagerBar');
      var searchEl = document.getElementById('kmPeopleUnitSearch');
      if (!listEl) return;
      if (!units.length) {
        listEl.innerHTML = noArch
          ? (typeof window.kmArchiveRequiredBanner === 'function' ? window.kmArchiveRequiredBanner() : '<p class="muted">Այս զորամասի արխիվում ֆայլ չկա</p>')
          : '<p class="muted">Դատարկ է — բացեք Զորամասի Արխիվը։ Ցուցակը կլրացվի հաստիքներից (ինչպես Պաշտոն)։';
        if (statsEl) statsEl.textContent = (orgArchiveHint() ? orgArchiveHint() + ' · ' : '') + '0 ստորաբաժանում · 0 անձ';
        return;
      }
      if (statsEl) {
        statsEl.textContent = (orgArchiveHint() ? String(orgArchiveHint()) + ' · ' : '') +
          units.length + ' ստորաբաժանում · ' + total + ' անձ';
      }
      /* KM_PEOPLE_PAGINATION_V1: 20 subdivisions per page instead of rendering (even lazily
         and chunked) every subdivision's header at once. Page index persists across re-renders
         within the same session (renderPeopleByStructure._page), and search bypasses paging —
         it matches across ALL subdivisions and shows only the matching ones. */
      var PAGE_SIZE = 20;
      var pages = Math.max(1, Math.ceil(units.length / PAGE_SIZE));
      if (typeof renderPeopleByStructure._page !== 'number') renderPeopleByStructure._page = 0;
      function renderPager(page) {
        if (!pagerEl) return;
        if (pages <= 1) { pagerEl.innerHTML = ''; return; }
        pagerEl.innerHTML = '<button type="button" id="kmPeoplePagerPrev"' + (page <= 0 ? ' disabled' : '') + '>← Նախորդ</button>' +
          '<span class="muted">Էջ ' + (page + 1) + ' / ' + pages + '</span>' +
          '<button type="button" id="kmPeoplePagerNext"' + (page >= pages - 1 ? ' disabled' : '') + '>Հաջորդ →</button>';
        var prevBtn = document.getElementById('kmPeoplePagerPrev');
        var nextBtn = document.getElementById('kmPeoplePagerNext');
        if (prevBtn) prevBtn.onclick = function () { renderPage(page - 1); };
        if (nextBtn) nextBtn.onclick = function () { renderPage(page + 1); };
      }
      function renderUnitsList(unitList) {
        listEl.innerHTML = '';
        var CHUNK = 4;
        var ui = 0;
        function paintChunk() {
          if (gen !== renderPeopleByStructure._gen) return;
          var end = Math.min(ui + CHUNK, unitList.length);
          var html = '';
          for (; ui < end; ui++) {
            var u = unitList[ui];
            html += buildUnitHtml(u, u, map[u] || []); /* sid keyed by unit name: stable across pages/search */
          }
          if (html) listEl.insertAdjacentHTML('beforeend', html);
          if (ui < unitList.length) raf(paintChunk);
        }
        paintChunk();
      }
      function renderPage(page) {
        page = Math.max(0, Math.min(page, pages - 1));
        renderPeopleByStructure._page = page;
        var start = page * PAGE_SIZE;
        renderUnitsList(units.slice(start, start + PAGE_SIZE));
        renderPager(page);
      }
      if (searchEl && !searchEl.__kmBound) {
        searchEl.__kmBound = true;
        var st = null;
        searchEl.addEventListener('input', function () {
          clearTimeout(st);
          st = setTimeout(function () {
            var q = String(searchEl.value || '').trim().toLowerCase();
            if (!q) { renderPage(renderPeopleByStructure._page || 0); return; }
            if (pagerEl) pagerEl.innerHTML = '';
            var matches = units.filter(function (u) { return u.toLowerCase().indexOf(q) >= 0; });
            if (!matches.length) { listEl.innerHTML = '<p class="muted" style="margin:8px">Ստորաբաժանում չի գտնվել</p>'; return; }
            renderUnitsList(matches);
          }, 150);
        });
      }
      renderPage(renderPeopleByStructure._page || 0);
    });
  }


  window.kmOpenPersonnelHub = function (opts) {
    opts = opts || {};
    try {
      if (typeof window.kmRestoreAdminAccountingOrgView === 'function') window.kmRestoreAdminAccountingOrgView();
    } catch (eRv) {}
    var tab = opts.tab || hubTab || 'people';
    if (tab === 'dossiers' || tab === 'unitDossiers') tab = 'people';
    hubTab = tab === 'positions' ? 'positions' : 'people';
    if (hubTab === 'positions') window.kmOpenPositionsPage(opts);
    else { renderPeopleByStructure._page = 0; renderPeopleByStructure(); }
  };

  function patchPeople() {
    if (window.people && window.people.__kmPosStruct) return;
    if (typeof window.addPerson === 'function' && !window.__kmAddPersonOrig) {
      window.__kmAddPersonOrig = window.addPerson;
    }
    window.people = function () { window.kmOpenPersonnelHub({ tab: 'people' }); };
    window.people.__kmPosStruct = true;
  }

  function patchCollect() {
    if (!window.kmCollectServiceMembers || window.kmCollectServiceMembers.__kmPos) return;
    var prev = window.kmCollectServiceMembers;
    window.kmCollectServiceMembers = function () {
      var list = prev.apply(this, arguments) || [];
      var seen = Object.create(null);
      list.forEach(function (x) {
        if (x && x.name) seen[String(x.name).toLowerCase()] = 1;
      });
      try {
        (window.kmPeopleFromPositions ? window.kmPeopleFromPositions() : []).forEach(function (p) {
          var n = String(p.name || '').trim();
          if (!n || !looksLikePersonName(n)) return;
          var k = n.toLowerCase();
          if (seen[k]) return;
          seen[k] = 1;
          list.push({ name: n, rank: p.rank || '', unit: p.unit || '', src: 'Պաշտոն' });
        });
      } catch (e) {}
      return list;
    };
    window.kmCollectServiceMembers.__kmPos = true;
  }

  function patchVacations() {
    /* Արձակուրդը բացելիս sync չանել — կախում էր առաջացնում */
    if (typeof window.openVacations === 'function') {
      window.openVacations.__kmPos = true;
    }
  }

  function boot() {
    patchPeople();
    patchCollect();
    patchVacations();
    if (!window.__kmPosF5Bound) {
      window.__kmPosF5Bound = true;
      document.addEventListener('keydown', function (ev) {
        if (ev.key !== 'F5') return;
        if (window.page !== 'positions' && window.page !== 'people') return;
        ev.preventDefault();
        ev.stopPropagation();
        if (hubTab === 'positions' || window.page === 'positions') {
          if (typeof window.kmPositionsRefresh === 'function') window.kmPositionsRefresh();
        } else {
          renderPeopleByStructure();
        }
      }, true);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

/* KM_UNIFIED_ARCHIVE_FLOW_V1_EXCEL_PURGED */
(function () {
  var prev = window.kmUnitHasExcelArchive;
  window.__kmUnitHasExcelArchiveLegacy = prev;
  window.kmUnitHasExcelArchive = function (unitId) {
    /* KM_UNIFIED_ARCHIVE_SOURCE_V1_POS */
    try {
      if (window.kmUnitArchiveStaffSource && window.kmUnitArchiveStaffSource.hasFormal && window.kmUnitArchiveStaffSource.hasFormal(unitId)) return true;
    } catch (e0) {}
    try {
      if (typeof db !== 'undefined' && db && db.unitFormalArchives) {
        var uid = String(unitId || '').trim();
        if (!uid) {
          try {
            var ctx = typeof window.kmGetOrgContext === 'function' ? window.kmGetOrgContext() : null;
            uid = String((ctx && ctx.unitId) || window._kmArchiveForUnitId || '').trim();
          } catch (eC) {}
        }
        var sh = uid ? db.unitFormalArchives[uid] : null;
        if (sh && Array.isArray(sh.rows) && sh.rows.length) return true;
        if (!uid) {
          var keys = Object.keys(db.unitFormalArchives);
          for (var i = 0; i < keys.length; i++) {
            var s2 = db.unitFormalArchives[keys[i]];
            if (s2 && Array.isArray(s2.rows) && s2.rows.length) return true;
          }
        }
      }
    } catch (e1) {}
    try {
      if (typeof prev === 'function') return !!prev.apply(this, arguments);
    } catch (e2) {}
    return false;
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
  window.kmUnitHasStaffSource = function (unitId) {
    /* KM_RESTORE_HAS_STAFF_V1 */
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
    try {
      if (typeof db !== 'undefined' && db && Array.isArray(db.positionArchives) &&
          db.positionArchives.some(function (a) { return a && Array.isArray(a.rows) && a.rows.length; })) return true;
    } catch (e2) {}
    try {
      if (typeof db !== 'undefined' && db && Array.isArray(db.people) && db.people.length) return true;
    } catch (e3) {}
    return false;
  };
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



/* === KM_RESERVE_ARCHIVE_V1 vacant→reserve hook === */
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
    } catch (e) { console.warn('KM_RESERVE_ARCHIVE_V1 copy failed', e); }
    return null;
  }
  window.kmReserveCopyBeforeVacant = kmReserveCopyBeforeVacant;

  function wrapVacant(orig) {
    if (typeof orig !== 'function') return orig;
    if (orig.__kmReserveWrapped) return orig;
    var wrapped = function () {
      var args = arguments;
      var posArg = args[0], person = null, pos = null;
      try {
        if (posArg && typeof posArg === 'object') {
          pos = posArg;
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
        } else if (typeof posArg === 'string' && posArg) {
          /* KM_RESERVE_ARCHIVE_V1_FIX: kmPositionMakeVacant(posId) is always called with a
             bare id STRING, never an object — the block above's typeof===object check was
             always false for the real call path, so `person` stayed null, the `if(person...)`
             guard below always failed, and kmReserveCopyBeforeVacant() never actually ran.
             The full card was zeroed with nothing but {name, reason, at} preserved. Resolve
             the position + current holder here using the exact same resolver
             kmPositionMakeVacant() itself uses, so the snapshot is taken with the same
             holder it's about to clear. */
          try {
            pos = (typeof window.kmFindPos === 'function') ? window.kmFindPos(posArg) : null;
            var nm2 = (pos && typeof window.kmResolvePositionPerson === 'function') ? window.kmResolvePositionPerson(pos) : '';
            nm2 = String(nm2 || '').trim();
            if (nm2 && typeof db !== 'undefined' && db && Array.isArray(db.people)) {
              var lname = nm2.toLowerCase();
              person = db.people.find(function (p) { return p && String(p.name || '').trim().toLowerCase() === lname; }) || { name: nm2 };
            }
            if (!pos) pos = { id: posArg };
          } catch (eResolve) { console.warn('KM_RESERVE_ARCHIVE_V1 resolve failed', eResolve); }
        }
        if (person && String(person.name || '').trim()) {
          kmReserveCopyBeforeVacant(person, pos);
          try {
            if (typeof window.kmHishoxutyunLog === 'function') {
              window.kmHishoxutyunLog({ action: 'vacant', detail: 'copied to պահեստազորային արխիվ then cleared', name: person.name, posId: pos && pos.id });
            }
          } catch (eLog) {}
        }
      } catch (ePre) { console.warn('KM_RESERVE_ARCHIVE_V1 pre-vacant', ePre); }
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
/* === /KM_RESERVE_ARCHIVE_V1 vacant→reserve hook === */

/* === KM_CARD_OPEN_SAFE_V1 ===
   kmOpenPersonCard lives in km-extensions.js, which may still be loading (idle "deferred" bundle).
   The Positions/Personnel buttons used a silent typeof-check, so an early click did nothing and
   looked like a dead/laggy Card button. Wait for the deferred modules instead of failing silently;
   onMissing (optional) preserves each call site's original fallback behaviour. */
(function () {
  'use strict';
  if (window.kmOpenPersonCardSafe) return;
  window.kmOpenPersonCardSafe = function (idx, onMissing) {
    if (typeof window.kmOpenPersonCard === 'function') { window.kmOpenPersonCard(idx); return; }
    try { if (typeof toastMsg === 'function') toastMsg('Քարտը բեռնվում է…', 'info'); } catch (eT) {}
    var open = function () {
      if (typeof window.kmOpenPersonCard === 'function') { window.kmOpenPersonCard(idx); return; }
      if (typeof onMissing === 'function') { try { onMissing(); } catch (eM) {} }
    };
    if (typeof window.kmLoadDeferredModules === 'function') window.kmLoadDeferredModules(open);
    else setTimeout(open, 300);
  };
})();
/* === /KM_CARD_OPEN_SAFE_V1 === */
