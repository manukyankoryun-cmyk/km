/* KM_UNIFIED_ARCHIVE_FLOW_V1_ORG_DONE */
/* KM_UNIFIED_ARCHIVE_FLOW_V2_ORG_DONE */
/* KM — բանակային կորպուս / զորամաս ընտրություն + արխիվների բաժանում */
(function () {
  'use strict';

  var SS_KEY = 'km_org_context';
  var LAST_KEY = 'km_org_last_pick';
  var GATE_KEY = 'km_org_entry_ok';
  var ADMIN_VIEW_KEY = 'km_admin_acc_org_view';

  var CENTRAL_ID = '_central';
  var CENTRAL_NAME = 'Կենտրոնական ենթակայություն';

  var DEFAULT_CORPS = [
    { id: 'bk1', name: '1-ին բանակային կորպուս', ord: 1 },
    { id: 'bk2', name: '2-րդ բանակային կորպուս', ord: 2 },
    { id: 'bk3', name: '3-րդ բանակային կորպուս', ord: 3 },
    { id: 'bk4', name: '4-րդ բանակային կորպուս', ord: 4 },
    { id: 'bk5', name: '5-րդ բանակային կորպուս', ord: 5 }
  ];

  function injectOrgArchCss() {
    var prev = document.getElementById('km-org-arch-css');
    if (prev && prev.getAttribute('data-km-home-pick') === 'v4') return;
    if (prev && prev.parentNode) prev.parentNode.removeChild(prev);
    var s = document.createElement('style');
    s.id = 'km-org-arch-css';
    s.setAttribute('data-km-home-pick', 'v4');
    s.textContent =
      '/* KM_ORG_ARCH_BTN_REMOVED_V1 */' +
      '.kmAdminOrgPick{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;margin:0 0 12px;padding:10px 12px;background:#f4f7fa;border:1px solid #d5e0e8;border-radius:10px}' +
      '.kmAdminOrgPick label{flex:1;min-width:200px;font-size:12px;font-weight:700}' +
      '.kmAdminOrgPick select{width:100%;margin-top:4px;padding:8px 10px;box-sizing:border-box;font:inherit}' +
      /* KM_ADMIN_HOME_ORG_PICK_V2 top-center */ +
      '#kmAdminHomeOrgPick{position:fixed!important;top:22px!important;left:0!important;right:0!important;margin:0 auto!important;z-index:2147483000!important;width:min(560px,calc(100vw - 40px))!important;box-sizing:border-box;padding:0 12px;pointer-events:none;display:flex!important;justify-content:center;visibility:visible!important;opacity:1!important}' +
      '#kmAdminHomeOrgPick .kmAdminOrgPick{pointer-events:auto;display:flex;flex-direction:row;flex-wrap:nowrap;align-items:flex-end;gap:12px;margin:0;padding:14px 16px;width:100%;max-width:560px;background:rgba(255,255,255,.96);border:1px solid rgba(15,35,60,.16);border-radius:14px;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);box-shadow:0 12px 36px rgba(0,0,0,.32)}' +
      '#kmAdminHomeOrgPick .kmAdminOrgPick label{flex:1 1 220px;min-width:220px;max-width:100%;color:#1a2b3c;font-size:12px;font-weight:700;letter-spacing:.01em}' +
      '#kmAdminHomeOrgPick .kmAdminOrgPick select{width:100%;margin-top:4px;padding:8px 10px;box-sizing:border-box;font:inherit;background:#fff;color:#111;border:1px solid #c9d4e0;border-radius:8px;outline:none}' +
      '#kmAdminHomeOrgPick .kmAdminOrgPick select:disabled{opacity:.45}' +
      '#kmAdminHomeOrgPick .kmAdminOrgPick select option{color:#111;background:#fff}';
    (document.head || document.documentElement).appendChild(s);
  }

  var HUB_LS_KEY = 'km_last_hub_ip';
  var RETIRED_HUB = { '192.168.11.73': '192.168.11.87' };
  var CANONICAL_HUB = '192.168.11.87:18094';

  function sanitizeHubHost(hostStr) {
    var p = parseHubHostPort(hostStr);
    if (!p || !p.host) return '';
    var next = RETIRED_HUB[p.host] || p.host;
    if (RETIRED_HUB[p.host]) return next + ':18094';
    return formatHubHost({ host: next, port: p.port });
  }

  function parseHubHostPort(raw) {
    var s = String(raw || '').trim();
    if (!s) return null;
    if (!/^https?:\/\//i.test(s)) s = 'http://' + s;
    try {
      var u = new URL(s);
      if (!u.hostname) return null;
      return { host: u.hostname, port: Number(u.port) || 18094 };
    } catch (e) {
      return null;
    }
  }

  function formatHubHost(p) {
    if (!p || !p.host) return '';
    return p.host + ':' + (Number(p.port) || 18094);
  }

  function hubHttpUrl(p) {
    if (!p || !p.host) return '';
    return 'http://' + p.host + ':' + (Number(p.port) || 18094);
  }

  function readSavedHubHost() {
    var raw = '';
    try { raw = String(localStorage.getItem(HUB_LS_KEY) || '').trim(); } catch (e) { raw = ''; }
    var clean = sanitizeHubHost(raw);
    if (clean !== raw) writeSavedHubHost(clean);
    return clean;
  }

  function writeSavedHubHost(hostStr) {
    var s = sanitizeHubHost(hostStr);
    if (!s) return;
    try { localStorage.setItem(HUB_LS_KEY, s); } catch (e) {}
  }
  try { readSavedHubHost(); } catch (eWipe) {}

  function sameHubHost(a, b) {
    var pa = parseHubHostPort(a);
    var pb = parseHubHostPort(b);
    return !!(pa && pb && pa.host === pb.host);
  }

  function fillOrgHubInput(wrap, hostStr) {
    if (!wrap) wrap = document.getElementById('kmOrgPickerOverlay');
    var inp = wrap && wrap.querySelector('#kmOrgHubHost');
    if (!inp || !hostStr) return;
    hostStr = sanitizeHubHost(hostStr);
    inp.value = hostStr;
    inp.setAttribute('data-prefill', hostStr);
    writeSavedHubHost(hostStr);
  }

  function renderHubChips(live, currentHost) {
    live = live || [];
    if (!live.length) {
      return '<p class="muted" style="margin:8px 0 0;font-size:11px">Կենդանի Hub դեռ չի երևում։ Մուտքագրեք ադմինի IP-ն (օր. 192.168.11.87:18094)։</p>';
    }
    var cur = parseHubHostPort(currentHost);
    var html = '<p class="muted" style="margin:8px 0 4px;font-size:11px">Կենդանի Hub սերվերներ — սեղմեք իրական ադմինի հասցեն։</p>';
    live.forEach(function (h) {
      var hostStr = formatHubHost({ host: h.ip, port: h.port });
      var url = hubHttpUrl({ host: h.ip, port: h.port });
      var on = cur && cur.host === h.ip;
      html += '<button type="button" data-hub-pick="' + esc(url) + '" style="width:100%;text-align:left;margin:3px 0;padding:8px 10px;' +
        (on ? 'border:2px solid #1a7f4b;background:#f0fdf4;font-weight:700' : '') + '">' +
        esc((h.name && h.name !== h.ip ? h.name + ' · ' : '') + hostStr) +
        (h.live ? ' · կենդանի' : '') + (on ? ' · ընտրված' : '') + '</button>';
    });
    if (live.length > 1) {
      html += '<p style="margin:6px 0 0;font-size:11px;color:#9a3412">Մի քանի Hub է երևում։ Hub նշանը թողեք միայն ադմինի համակարգչում և ընտրեք այդ IP-ն։</p>';
    }
    return html;
  }

  async function refreshOrgHubFromNet(wrap, opts) {
    opts = opts || {};
    if (!wrap) wrap = document.getElementById('kmOrgPickerOverlay');
    if (!wrap) return null;
    var lan = window.kmNative && window.kmNative.lanSync;
    var net = window.kmNative && window.kmNative.net;
    if (opts.ensure && lan && lan.ensureHub) {
      try { await lan.ensureHub({ scan: !!opts.scan, preferIp: opts.preferIp || '' }); } catch (eE) {}
    }
    var lanSt = null;
    try { if (lan && lan.status) lanSt = await lan.status(); } catch (eS) {}
    var live = ((lanSt && lanSt.hubCandidates) || []).filter(function (h) {
      if (!h || !h.live || !h.ip) return false;
      if (RETIRED_HUB[h.ip]) {
        h.ip = RETIRED_HUB[h.ip];
        h.port = 18094;
      }
      return !!h.ip && !RETIRED_HUB[h.ip];
    });
    var saved = readSavedHubHost() || (lanSt && lanSt.serverUrl) || '';
    var picked = null;
    if (live.length === 1) {
      picked = live[0];
    } else if (live.length > 1) {
      var savedP = parseHubHostPort(saved);
      var savedLive = savedP && live.filter(function (h) { return h.ip === savedP.host; })[0];
      picked = savedLive || live[0];
    } else {
      var fromLan = parseHubHostPort(lanSt && lanSt.serverUrl);
      if (fromLan) picked = { ip: fromLan.host, port: fromLan.port };
    }
    var hostStr = picked ? formatHubHost({ host: picked.ip, port: picked.port }) : (saved || '');
    if (hostStr) fillOrgHubInput(wrap, hostStr);
    var list = wrap.querySelector('#kmOrgHubList');
    if (list) list.innerHTML = renderHubChips(live, hostStr);
    return { host: hostStr, live: live, serverUrl: (lanSt && lanSt.serverUrl) || '' };
  }

  window.kmRefreshOrgHubField = function (ev) {
    var wrap = document.getElementById('kmOrgPickerOverlay');
    if (!wrap) return;
    if (ev && ev.serverUrl) {
      var p = parseHubHostPort(ev.serverUrl);
      if (p) fillOrgHubInput(wrap, formatHubHost(p));
    }
    refreshOrgHubFromNet(wrap, {}).catch(function () {});
  };

  function hyOrdinalUnit(n) {
    return n === 1 ? '1-ին զորամաս' : (n + '-րդ զորամաս');
  }

  function hyOrdinalCorps(n) {
    n = Number(n) || 0;
    return n === 1 ? '1-ին բանակային կորպուս' : (n + '-րդ բանակային կորպուս');
  }

  function parseNameOrd(name) {
    var m = String(name || '').match(/(\d+)\s*[-–]?\s*(ին|րդ)/i);
    return m ? Number(m[1]) : 0;
  }

  function parseCorpsOrd(c) {
    if (!c) return 0;
    var o = Number(c.ord);
    if (o > 0) return o;
    var idm = String(c.id || '').match(/^bk(\d+)$/i);
    if (idm) return Number(idm[1]);
    return parseNameOrd(c.name);
  }

  function nextCorpsOrd(existing) {
    var used = Object.create(null);
    (existing || []).forEach(function (c) {
      var o = parseCorpsOrd(c);
      if (o > 0) used[o] = 1;
    });
    var i;
    for (i = 1; i <= 99; i++) {
      if (!used[i]) return i;
    }
    return ((existing && existing.length) || 0) + 1;
  }

  function ensureCorpsOrd(store) {
    if (!store || !Array.isArray(store.corps)) return;
    var army = store.corps.filter(function (c) {
      return c && c.id && c.id !== CENTRAL_ID && c.kind !== 'central';
    });
    army.forEach(function (c) {
      if (!(Number(c.ord) > 0)) {
        var o = parseCorpsOrd(c);
        if (o > 0) c.ord = o;
      }
    });
    var used = Object.create(null);
    army.forEach(function (c) {
      var o = Number(c.ord) || 0;
      if (o > 0 && !used[o]) {
        used[o] = 1;
        return;
      }
      c.ord = 0;
    });
    army.forEach(function (c) {
      if (Number(c.ord) > 0) return;
      var i;
      for (i = 1; i <= 99; i++) {
        if (!used[i]) {
          c.ord = i;
          used[i] = 1;
          return;
        }
      }
      c.ord = army.length;
    });
  }

  function defaultUnitsForCorps(corpsId) {
    var out = [{ id: corpsId + '_hq', corpsId: corpsId, name: 'Կորպուսի շտաբ' }];
    var i;
    for (i = 1; i <= 6; i++) {
      out.push({ id: corpsId + '_u' + i, corpsId: corpsId, name: hyOrdinalUnit(i) });
    }
    return out;
  }

  function ensureDefaultUnitsForCorps(store, corpsId) {
    if (!store || !corpsId) return;
    if (!Array.isArray(store.units)) store.units = [];
    var have = store.units.some(function (u) { return u && u.corpsId === corpsId; });
    if (have) return;
    store.units = store.units.concat(defaultUnitsForCorps(corpsId));
  }

  function defaultUnits() {
    var out = [];
    DEFAULT_CORPS.forEach(function (c) {
      out.push({ id: c.id + '_hq', corpsId: c.id, name: 'Կորպուսի շտաբ' });
      var i;
      for (i = 1; i <= 6; i++) {
        out.push({ id: c.id + '_u' + i, corpsId: c.id, name: hyOrdinalUnit(i) });
      }
    });
    return out;
  }

  function esc(s) {
    return typeof window.esc === 'function'
      ? window.esc(s)
      : String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
        });
  }

  function isSuperAdmin() {
    if (window.kmSuperAdmin === true) return true;
    if (typeof window.kmIsSuperAdmin === 'function' && window.kmIsSuperAdmin()) return true;
    try {
      if (sessionStorage.getItem('km_auth_super') === '1') return true;
      if (String(window.kmAuthUsername || '') === 'Koryun1992') return true;
    } catch (e) {}
    return false;
  }

  function isAdmin() {
    if (isSuperAdmin()) return true;
    if (window.kmUserRole === 'admin') return true;
    if (typeof window.kmCanAdmin === 'function' && window.kmCanAdmin()) return true;
    try {
      if (sessionStorage.getItem('km_auth_mode') === 'admin') return true;
    } catch (e) {}
    return false;
  }

  /* Who may pick corps/unit on the landing screen */
  function canPickHomeOrg() {
    try { if (window.kmSuperAdmin === true) return true; } catch (e0) {}
    try { if (typeof window.kmIsSuperAdmin === 'function' && window.kmIsSuperAdmin()) return true; } catch (e1) {}
    if (isSuperAdmin()) return true;
    if (isAdmin()) return true;
    try {
      if (typeof window.kmAdminCanAccountingOrgView === 'function' && window.kmAdminCanAccountingOrgView()) return true;
    } catch (e2) {}
    try {
      var mode = sessionStorage.getItem('km_auth_mode') || '';
      try { mode = mode || localStorage.getItem('km_auth_mode') || ''; } catch (eL) {}
      if (mode === 'admin' || mode === 'super' || mode === 'superadmin') return true;
      if (sessionStorage.getItem('km_auth_super') === '1') return true;
      if (sessionStorage.getItem('km_auth_ok') === '1' && (window.kmUserRole === 'admin' || window.kmAuthRole === 'admin')) return true;
    } catch (e3) {}
    try {
      var bt = document.querySelector('.kmBrandText');
      if (bt && /Ադմինիստրատոր|Administrator|админ/i.test(String(bt.textContent || ''))) return true;
    } catch (e4) {}
    return false;
  }
  window.kmCanPickHomeOrg = canPickHomeOrg;

  function archiveRole() {
    return isAdmin() ? 'admin' : 'user';
  }

  function orgAdminToken() {
    try { return localStorage.getItem('km_admin_token') || ''; } catch (e) { return ''; }
  }

  function roleLabel(role) {
    return role === 'admin' ? 'ադմինիստրատորի արխիվ' : 'օգտատիրոջ արխիվ';
  }

  function notify(msg, kind) {
    if (typeof window.kmNotify === 'function') window.kmNotify(msg, kind || 'ok');
    else if (typeof toast === 'function') toast(msg, kind);
  }

  function lastPickKey() {
    var u = String(window.kmAuthUsername || '').trim() || '_';
    return LAST_KEY + ':' + u;
  }

  function readLastPick() {
    try {
      var raw = localStorage.getItem(lastPickKey());
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function writeLastPick(ctx) {
    try {
      localStorage.setItem(lastPickKey(), JSON.stringify({
        corpsId: ctx.corpsId,
        unitId: ctx.unitId
      }));
    } catch (e) {}
  }

  function ensureOrgStore() {
    if (typeof db === 'undefined' || !db) return null;
    if (!db.kmOrg || typeof db.kmOrg !== 'object' || Array.isArray(db.kmOrg)) db.kmOrg = {};
    if (!Array.isArray(db.kmOrg.corps) || !db.kmOrg.corps.length) {
      db.kmOrg.corps = DEFAULT_CORPS.map(function (c) {
        return { id: c.id, name: c.name, kind: 'corps', ord: c.ord };
      });
    }
    ensureCorpsOrd(db.kmOrg);
    if (!Array.isArray(db.kmOrg.units) || !db.kmOrg.units.length) {
      db.kmOrg.units = defaultUnits();
    }
    if (window.__kmOrgSeed) applyOrgSeedToStore(db.kmOrg, window.__kmOrgSeed);
    return db.kmOrg;
  }

  function applyOrgSeedToStore(store, seed) {
    if (!store || !seed) return;
    var i, j;
    var seedCorps = Array.isArray(seed.corps) ? seed.corps : [];
    var seedUnits = Array.isArray(seed.units) ? seed.units : [];
    if (!Array.isArray(store.corps)) store.corps = [];
    if (!Array.isArray(store.units)) store.units = [];
    for (i = 0; i < seedCorps.length; i++) {
      var sc = seedCorps[i];
      if (!sc || !sc.id) continue;
      var foundC = null;
      for (j = 0; j < store.corps.length; j++) {
        if (store.corps[j] && store.corps[j].id === sc.id) { foundC = store.corps[j]; break; }
      }
      if (foundC) {
        if (sc.name) foundC.name = sc.name;
        if (Number(sc.ord) > 0) foundC.ord = Number(sc.ord);
      } else {
        store.corps.push({ id: sc.id, name: sc.name || sc.id, kind: sc.kind || 'corps', ord: Number(sc.ord) || 0 });
      }
    }
    for (i = 0; i < seedUnits.length; i++) {
      var su = seedUnits[i];
      if (!su || !su.id) continue;
      var foundU = null;
      for (j = 0; j < store.units.length; j++) {
        if (store.units[j] && store.units[j].id === su.id) { foundU = store.units[j]; break; }
      }
      if (foundU) {
        if (su.name) foundU.name = su.name;
        if (su.corpsId) foundU.corpsId = su.corpsId;
      } else {
        store.units.push({ id: su.id, corpsId: su.corpsId || '', name: su.name || su.id });
      }
    }
    ensureCorpsOrd(store);
  }

  function collectAllPositionArchives() {
    if (typeof db === 'undefined' || !db) return [];
    try {
      if (typeof window.kmSyncCorpsSlice === 'function') window.kmSyncCorpsSlice();
    } catch (eS) {}
    var map = Object.create(null);
    function addList(list) {
      (list || []).forEach(function (a) {
        if (!a || a.builtin || !a.id) return;
        if (!a.corpsId || !a.unitId) return;
        if (!a.base64 && !(a.rows && a.rows.length)) return;
        var prev = map[a.id];
        if (!prev || String(a.base64 || '').length > String(prev.base64 || '').length) map[a.id] = a;
      });
    }
    addList(db.positionArchives);
    var cd = db.kmCorpsData && typeof db.kmCorpsData === 'object' ? db.kmCorpsData : {};
    Object.keys(cd).forEach(function (k) {
      var parsed = parseSliceKey(k);
      (cd[k] && cd[k].positionArchives || []).forEach(function (a) {
        if (!a || a.builtin || !a.id) return;
        var rec = a;
        if ((!a.corpsId || !a.unitId) && parsed.corpsId && parsed.unitId) {
          if (!a.corpsId) a.corpsId = parsed.corpsId;
          if (!a.unitId) a.unitId = parsed.unitId;
        }
        addList([a]);
      });
    });
    var list = Object.keys(map).map(function (id) { return map[id]; });
    var byUnit = Object.create(null);
    var leftover = [];
    list.forEach(function (a) {
      var u = String((a && a.unitId) || '').trim();
      if (!u) { leftover.push(a); return; }
      var g = String(a.corpsId || '').trim() + '::' + u;
      var prev = byUnit[g];
      var stamp = String(a.updatedAt || a.addedAt || '') + '|' + String(((a.rows) || []).length) + '|' + String(a.base64 || '').length;
      if (!prev) { byUnit[g] = a; return; }
      var ps = String(prev.updatedAt || prev.addedAt || '') + '|' + String(((prev.rows) || []).length) + '|' + String(prev.base64 || '').length;
      if (stamp >= ps) byUnit[g] = a;
    });
    return leftover.concat(Object.keys(byUnit).map(function (g) { return byUnit[g]; }));
  }

  function applyOrgArchivesToStore(archives) {
    if (typeof db === 'undefined' || !db || !archives || !archives.length) return 0;
    migrateCorpsSlicesToUnits();
    if (!db.kmCorpsData || typeof db.kmCorpsData !== 'object' || Array.isArray(db.kmCorpsData)) db.kmCorpsData = {};
    var added = 0;
    archives.forEach(function (a) {
      if (!a || a.builtin || !a.id || !a.corpsId || !a.unitId) return;
      if (!a.base64 && !(a.rows && a.rows.length)) return;
      var key = orgSliceKey(a.corpsId, a.unitId);
      if (!key) return;
      if (!db.kmCorpsData[key]) db.kmCorpsData[key] = emptySlice();
      var sl = db.kmCorpsData[key];
      if (!Array.isArray(sl.positionArchives)) sl.positionArchives = [];
      var ix = -1;
      for (var ai = 0; ai < sl.positionArchives.length; ai++) {
        if (sl.positionArchives[ai] && sl.positionArchives[ai].id === a.id) { ix = ai; break; }
      }
        if (ix < 0) {
        sl.positionArchives.push(a);
        added++;
      } else {
        var prevA = sl.positionArchives[ix];
        if (prevA && prevA._shtatUserEdited && !a._shtatUserEdited) {
          if (!prevA.base64 && a.base64) prevA.base64 = a.base64;
        } else {
        var inRows = (a.rows && a.rows.length) || 0;
        var oldRows = (prevA.rows && prevA.rows.length) || 0;
        var inB = String(a.base64 || '').length;
        var oldB = String(prevA.base64 || '').length;
        if (inRows > oldRows || inB > oldB) {
          if (!a.base64 && prevA && prevA.base64) a.base64 = prevA.base64;
          if (prevA && prevA._shtatUserEdited) {
            a.rows = prevA.rows;
            a._shtatUserEdited = true;
          }
          sl.positionArchives[ix] = a;
          added++;
        }
        }
      }
      if (activeSliceId === key) {
        if (!Array.isArray(db.positionArchives)) db.positionArchives = [];
        if (db.positionArchives === sl.positionArchives) {
          /* working list is the same array */
        } else {
        var dix = -1;
        for (var di = 0; di < db.positionArchives.length; di++) {
          if (db.positionArchives[di] && db.positionArchives[di].id === a.id) { dix = di; break; }
        }
        if (dix < 0) {
          db.positionArchives.push(a);
        } else {
          var prevW = db.positionArchives[dix];
          if (prevW && prevW._shtatUserEdited && !a._shtatUserEdited) {
            if (!prevW.base64 && a.base64) prevW.base64 = a.base64;
          } else {
          var wr = (a.rows && a.rows.length) || 0;
          var orw = (prevW.rows && prevW.rows.length) || 0;
          if (wr > orw || String(a.base64 || '').length > String(prevW.base64 || '').length) {
            if (!a.base64 && prevW && prevW.base64) a.base64 = prevW.base64;
            if (prevW && prevW._shtatUserEdited) {
              a.rows = prevW.rows;
              a._shtatUserEdited = true;
            }
            db.positionArchives[dix] = a;
          }
          }
        }
        }
      }
    });
    try { window.kmPurgeDuplicateUnitArchives && window.kmPurgeDuplicateUnitArchives(); } catch (eCol) {}
    return added;
  }

  window.kmPersistOrgArchives = async function (opts) {
    try {
      var api = window.kmNative && window.kmNative.orgEntry;
      if (!api || typeof api.archivesWrite !== 'function') return null;
      var list = collectAllPositionArchives();
      if (typeof window.kmPurgeDuplicateUnitArchives === 'function') {
        try { window.kmPurgeDuplicateUnitArchives(); } catch (eC) {}
        list = collectAllPositionArchives();
      }
      if (!list.length && !(opts && opts.replace)) return null;
      return await api.archivesWrite({
        archives: list,
        replace: !!(opts && opts.replace),
        adminToken: orgAdminToken()
      });
    } catch (eP) {
      return null;
    }
  };

  window.kmRefreshOrgArchives = async function (opts) {
    try {
      var api = window.kmNative && window.kmNative.orgEntry;
      if (!api || typeof api.archivesGet !== 'function') return null;
      var q = opts && typeof opts === 'object' ? opts : {};
      var s = await api.archivesGet({
        unitId: q.unitId || '',
        corpsId: q.corpsId || '',
        includeBinary: !!q.includeBinary
      });
      if (!s || s.ok === false || !Array.isArray(s.archives)) return s;
      if (typeof db === 'undefined' || !db) return s;
      if (!s.archives.length) {
        var uidGone = String(q.unitId || '').trim();
        var cidGone = String(q.corpsId || '').trim();
        if (uidGone) {
          try {
            db.positionArchives = (db.positionArchives || []).filter(function (a) {
              if (!a) return false;
              if (String(a.unitId || '').trim() !== uidGone) return true;
              if (cidGone && String(a.corpsId || '').trim() && String(a.corpsId || '').trim() !== cidGone) return true;
              return false;
            });
            var goneKey = orgSliceKey(cidGone, uidGone);
            var slGone = goneKey && db.kmCorpsData ? db.kmCorpsData[goneKey] : null;
            if (slGone && Array.isArray(slGone.positionArchives)) {
              slGone.positionArchives = slGone.positionArchives.filter(function (a) {
                if (!a) return false;
                if (String(a.unitId || '').trim() !== uidGone) return true;
                if (cidGone && String(a.corpsId || '').trim() && String(a.corpsId || '').trim() !== cidGone) return true;
                return false;
              });
            }
          } catch (eStrip) {}
          try { window.kmPurgeAccountingIfNoArchive(); } catch (ePur) {}
        }
        return s;
      }
      var added = applyOrgArchivesToStore(s.archives);
      return s;
    } catch (eA) {
      return null;
    }
  };

  function listCorps() {
    var store = ensureOrgStore();
    var list = (store && store.corps) || DEFAULT_CORPS;
    return list.filter(function (c) {
      return c && c.id && c.name && c.id !== CENTRAL_ID && c.kind !== 'central';
    }).sort(function (a, b) {
      var oa = parseCorpsOrd(a) || 9999;
      var ob = parseCorpsOrd(b) || 9999;
      if (oa !== ob) return oa - ob;
      return String(a.name || '').localeCompare(String(b.name || ''), 'hy');
    });
  }

  function listUnits(corpsId) {
    var store = ensureOrgStore();
    var list = (store && Array.isArray(store.units) && store.units.length) ? store.units : defaultUnits();
    return list.filter(function (u) {
      return u && u.id && u.name && (!corpsId || String(u.corpsId || '') === String(corpsId || ''));
    });
  }

  function findCorps(id) {
    if (id === CENTRAL_ID) return { id: CENTRAL_ID, name: CENTRAL_NAME, kind: 'central' };
    return corpsIdIndex()[id] || null;
  }

  function findUnit(id) {
    return unitIdIndex()[id] || null;
  }

  /* KM_PERF_HACHVARUM_V3: findCorps()/findUnit() used to rebuild a filtered+sorted copy of the
     whole corps/units store (listCorps()/listUnits()) and linearly scan it on every single call.
     With 26+ call sites — several inside per-row rendering loops — this made corps/unit lookups
     effectively O(n) to O(n log n) each, compounding into O(n^2) across a render. These are exactly
     the korpusId/unitId lookups the accounting/archive data flow depends on, so they're indexed
     into a true O(1) id -> object map, rebuilt only when the underlying store array reference or
     length actually changes (in-place field edits like renameCorps/renameUnit stay live since the
     map holds the same object references, not copies). */
  var _corpsIdIdx = null; /* {srcRef, srcLen, map} */
  function corpsIdIndex() {
    var store = ensureOrgStore();
    var src = (store && store.corps) || DEFAULT_CORPS;
    if (_corpsIdIdx && _corpsIdIdx.srcRef === src && _corpsIdIdx.srcLen === src.length) return _corpsIdIdx.map;
    var map = Object.create(null);
    for (var i = 0; i < src.length; i++) {
      var c = src[i];
      if (c && c.id && c.name && c.id !== CENTRAL_ID && c.kind !== 'central') map[c.id] = c;
    }
    _corpsIdIdx = { srcRef: src, srcLen: src.length, map: map };
    return map;
  }
  var _unitIdIdx = null; /* {srcRef, srcLen, map} */
  function unitIdIndex() {
    var store = ensureOrgStore();
    var src = (store && Array.isArray(store.units) && store.units.length) ? store.units : defaultUnits();
    if (_unitIdIdx && _unitIdIdx.srcRef === src && _unitIdIdx.srcLen === src.length) return _unitIdIdx.map;
    var map = Object.create(null);
    for (var i = 0; i < src.length; i++) {
      var u = src[i];
      if (u && u.id && u.name) map[u.id] = u;
    }
    _unitIdIdx = { srcRef: src, srcLen: src.length, map: map };
    return map;
  }

  function persistOrgStore() {
    if (typeof save === 'function') {
      try { save(true); } catch (e) {}
    }
    try {
      if (window.kmNative && window.kmNative.orgEntry && typeof window.kmNative.orgEntry.seedWrite === 'function' && db && db.kmOrg) {
        window.kmNative.orgEntry.seedWrite({ corps: db.kmOrg.corps, units: db.kmOrg.units });
      }
    } catch (eS) {}
  }

  var CORPS_DATA_KEYS = [
    'people', 'schedule', 'userPositions', 'positionAssignments', 'positionArchives', 'peopleRemoved',
    'vacations', 'tables', 'spreadsheets', 'registrations', 'notebookNotes', 'archives',
    'futureSchedules', 'dutyTypes', 'dutyTypeSchedules', 'dutyPosts',
    'units', 'cellComments', 'substitutions', 'dutyRankRules', 'dutyGraphTemplates', 'scheduleTemplates',
    'printPresets', 'orderDraft', 'troopStructure',
    'disciplinePenalties', 'disciplinePenaltiesArchive', 'personCharacteristics',
    'personEncouragements', 'monthSummaries',
    'unitDocs', 'unitInventory', 'unitInventoryServices', 'unitInventorySubdivisions' /* KM_INV_SUB_MANUAL_V1 */, 'unitCharDrafts', 'unitFuel', 'unitDayPlans', 'unitMedical',
    'unitLeavePlan', 'unitBlanks', 'unitDossiers', 'unitFormation', 'unitTermWatch',
    'trialExamDrafts', 'trialCharDrafts', 'trialMonitorDismissed'
  ];
  var activeSliceId = null;
  var UNIT_SLICE_SEP = '::';

  function cloneArchiveLite(a) {
    if (!a || typeof a !== 'object') return a;
    var o = {};
    var k;
    for (k in a) {
      if (!Object.prototype.hasOwnProperty.call(a, k) || k === 'base64') continue;
      o[k] = a[k];
    }
    if (a.base64) {
      o._excelKept = true;
      o._excelBytes = String(a.base64).length;
    }
    return o;
  }
  function cloneVal(v) {
    if (v == null || typeof v !== 'object') return v;
    if (Array.isArray(v)) {
      if (v.length && v[0] && typeof v[0] === 'object' && (v[0].base64 || v[0].rows)) {
        return v.map(cloneArchiveLite);
      }
      try { return JSON.parse(JSON.stringify(v)); } catch (eArr) { return v; }
    }
    if (v.base64 && (v.rows || v.mime || v.name)) return cloneArchiveLite(v);
    if (Array.isArray(v.positionArchives)) {
      var copy = {};
      var key;
      for (key in v) {
        if (!Object.prototype.hasOwnProperty.call(v, key)) continue;
        if (key === 'positionArchives') copy[key] = (v[key] || []).map(cloneArchiveLite);
        else {
          try { copy[key] = JSON.parse(JSON.stringify(v[key])); }
          catch (eK) { copy[key] = v[key]; }
        }
      }
      return copy;
    }
    try { return JSON.parse(JSON.stringify(v)); } catch (e) { return v; }
  }

  function isReservedSlice(id) {
    id = String(id || '');
    return id === '_super' || id === '_legacy';
  }

  function isUnitSliceKey(id) {
    return String(id || '').indexOf(UNIT_SLICE_SEP) > 0;
  }

  function orgSliceKey(corpsId, unitId) {
    var c = String(corpsId || '').trim();
    var u = String(unitId || '').trim();
    if (isReservedSlice(c) && !u) return c;
    if (!c || !u || isReservedSlice(c)) return '';
    return c + UNIT_SLICE_SEP + u;
  }

  function parseSliceKey(id) {
    id = String(id || '');
    if (isReservedSlice(id)) return { corpsId: id, unitId: '' };
    var i = id.indexOf(UNIT_SLICE_SEP);
    if (i < 1) return { corpsId: id, unitId: '' };
    return { corpsId: id.slice(0, i), unitId: id.slice(i + UNIT_SLICE_SEP.length) };
  }

  window.kmOrgSliceKey = orgSliceKey;
  window.kmParseOrgSliceKey = parseSliceKey;

  function emptySlice() {
    var d = new Date();
    return {
      people: [],
      schedule: { name: 'Հիմնական', month: d.getMonth() + 1, year: d.getFullYear(), rows: {}, selectedPeople: [] },
      userPositions: [],
      positionAssignments: {},
      peopleRemoved: {},
      positionArchives: [],
      vacations: [],
      tables: [],
      spreadsheets: [],
      registrations: [],
      notebookNotes: [],
      archives: [],
      futureSchedules: [],
      dutyTypes: [],
      dutyTypeSchedules: {},
      dutyPosts: [],
      units: [],
      cellComments: {},
      substitutions: [],
      dutyRankRules: [],
      dutyGraphTemplates: [],
      scheduleTemplates: [],
      printPresets: [],
      orderDraft: null,
      troopStructure: null,
      disciplinePenalties: [],
      disciplinePenaltiesArchive: [],
      personCharacteristics: {},
      personEncouragements: [],
      monthSummaries: [],
      unitDocs: [],
      unitInventory: [],
      unitInventoryServices: [],
      unitInventorySubdivisions: [], /* KM_INV_SUB_MANUAL_V1 */
      unitCharDrafts: [],
      unitFuel: [],
      unitDayPlans: [],
      unitMedical: [],
      unitLeavePlan: { maxAbsentPct: 20, rows: [] },
      unitBlanks: [],
      unitDossiers: {},
      unitFormation: [],
      unitTermWatch: { warnDays: 30, ranks: [], dismissed: [] },
      trialExamDrafts: [],
      trialCharDrafts: [],
      trialMonitorDismissed: []
    };
  }

  window.kmUnitHasExcelArchive = function (unitId) {
    var uid = String(unitId || '').trim();
    var cid = '';
    try {
      var ctx = typeof window.kmGetOrgContext === 'function' ? window.kmGetOrgContext() : null;
      if (!uid) uid = String((ctx && ctx.unitId) || window._kmArchiveForUnitId || '').trim();
      cid = String((ctx && ctx.corpsId) || window._kmArchiveForCorpsId || '').trim();
    } catch (eC) {}
    if (!uid || typeof db === 'undefined' || !db) return false;
    function isLive(a) {
      if (!a || a.builtin) return false;
      if (String(a.unitId || '').trim() !== uid) return false;
      if (cid && String(a.corpsId || '').trim() && String(a.corpsId || '').trim() !== cid) return false;
      return !!(a.base64 || (a.rows && a.rows.length));
    }
    try {
      if (Array.isArray(db.positionArchives) && db.positionArchives.some(isLive)) return true;
    } catch (e0) {}
    try {
      var key = orgSliceKey(cid, uid);
      var sl = db.kmCorpsData && key ? db.kmCorpsData[key] : null;
      if (sl && Array.isArray(sl.positionArchives) && sl.positionArchives.some(isLive)) return true;
    } catch (e1) {}
    return false;
  };

  window.kmArchiveRequiredBanner = function () {
    /* KM_UNIFIED_ARCHIVE_FLOW_V1_BANNER */
    var back = (typeof window.kmBackToolbar === 'function' ? window.kmBackToolbar("kmReportsBack()") : '');
    return back +
      '<div class="card" style="max-width:520px">' +
        '<b style="color:#b71c1c">Զորամասի արխիվը դեռ ընտրված/լրացված չէ</b>' +
        '<p class="muted" style="margin:8px 0 12px">Անձնակազմի և Հաշվառման տվյալները գալիս են միայն <b>Զորամասի արխիվ</b> բաժնից։ Excel-ից ներմուծումն այլևս չի օգտագործվում։</p>' +
        '<button type="button" class="primary" onclick="try{if(typeof kmOpenPage===\'function\')kmOpenPage(\'unitArchive\');}catch(e){}">Բացել Զորամասի արխիվ</button>' +
      '</div>';
  };

  var ARCHIVE_DERIVED_KEYS = [
    'people', 'userPositions', 'positionAssignments', 'peopleRemoved',
    'vacations', 'troopStructure', 'unitMedical', 'unitLeavePlan', 'unitDossiers',
    'unitTermWatch', 'unitDocs', 'disciplinePenalties', 'disciplinePenaltiesArchive',
    'personCharacteristics', 'personEncouragements', 'monthSummaries',
    'trialExamDrafts', 'trialCharDrafts', 'unitCharDrafts',
    'registrations', 'substitutions'
  ];

  window.kmPurgeAccountingIfNoArchive = function () {
    /* KM_UNIFIED_ARCHIVE_SOURCE_V1_ORG */
    var uid = '';
    try {
      var ctx = typeof window.kmGetOrgContext === 'function' ? window.kmGetOrgContext() : null;
      uid = String((ctx && ctx.unitId) || window._kmArchiveForUnitId || '').trim();
    } catch (eC) { uid = ''; }
    if (!uid) return false;
    try {
      if (typeof window.kmUnitHasStaffSource === 'function' && window.kmUnitHasStaffSource(uid)) return false;
    } catch (eS) {}
    try {
      if (window.kmUnitArchiveStaffSource && window.kmUnitArchiveStaffSource.hasFormal && window.kmUnitArchiveStaffSource.hasFormal(uid)) return false;
    } catch (eF) {}
    try {
      if (typeof db !== 'undefined' && db && db.unitFormalArchives && db.unitFormalArchives[uid] &&
          Array.isArray(db.unitFormalArchives[uid].rows) && db.unitFormalArchives[uid].rows.length) return false;
    } catch (eU) {}
    if (typeof window.kmUnitHasExcelArchive === 'function' && window.kmUnitHasExcelArchive(uid)) return false;
    if (typeof db === 'undefined' || !db) return false;
    var empty = emptySlice();
    ARCHIVE_DERIVED_KEYS.forEach(function (k) {
      if (Object.prototype.hasOwnProperty.call(empty, k)) {
        try { db[k] = cloneVal(empty[k]); } catch (eK) { db[k] = empty[k]; }
      }
    });
    /* KM_DUTY_PURGE_KEEP_V1 — keep main/duty graph selections even when archive probe is false */
    if (db.schedule && typeof db.schedule === 'object') {
      /* keep selectedPeople / rows */
    }
    if (db.dutyTypeSchedules && typeof db.dutyTypeSchedules === 'object') {
      /* keep duty graph selections */
    }
    if (Array.isArray(db.people)) {
      db.people = db.people.filter(function (p) {
        var n = String((p && p.name) || '');
        if (p && p._kmVacantPosId) return false;
        if (typeof window.kmPersonNameIsVacantStub === 'function' && window.kmPersonNameIsVacantStub(n)) return false;
        return !(p && (/^[【\[]\s*թափուր/i.test(n)));
      });
    }
    try {
      window._kmAccAppliedKey = '';
      window._kmAvailPersRef = null;
      window._kmAvailPersList = null;
      window._kmRosterNameMap = null;
      window._kmRosterNameMapRef = null;
    } catch (eX) {}
    try { if (typeof window.kmInvalidateArchivePeopleCache === 'function') window.kmInvalidateArchivePeopleCache(); } catch (eInv) {}
    try {
      if (Array.isArray(db.userPositions)) db.userPositions._kmMut = Date.now();
    } catch (eMut) {}
    try { if (typeof window.kmSyncCorpsSlice === 'function') window.kmSyncCorpsSlice(); } catch (eSy) {}
    try {
      if (typeof save === 'function') {
        if (window._kmPurgeSaveT) clearTimeout(window._kmPurgeSaveT);
        window._kmPurgeSaveT = setTimeout(function () {
          window._kmPurgeSaveT = 0;
          try { save(true); } catch (eSv) {}
        }, 600);
      }
    } catch (eSv0) {}
    return true;
  };

  function snapshotWorkingKeys() {
    if (typeof db === 'undefined' || !db) return emptySlice();
    var slice = (activeSliceId && db.kmCorpsData && db.kmCorpsData[activeSliceId]) || emptySlice();
    CORPS_DATA_KEYS.forEach(function (k) {
      if (Object.prototype.hasOwnProperty.call(db, k)) slice[k] = db[k];
    });
    return slice;
  }

  function ensureCorpsMigration() {
    if (typeof db === 'undefined' || !db) return;
    if (!db.kmCorpsData || typeof db.kmCorpsData !== 'object' || Array.isArray(db.kmCorpsData)) db.kmCorpsData = {};
    if (db._kmCorpsMigrated) return;
    var hasData = (Array.isArray(db.people) && db.people.length) ||
      (Array.isArray(db.userPositions) && db.userPositions.length) ||
      (Array.isArray(db.positionArchives) && db.positionArchives.some(function (a) { return a && !a.builtin; }));
    if (hasData && !Object.keys(db.kmCorpsData).length) {
      db.kmCorpsData._legacy = snapshotWorkingKeys();
    }
    db._kmCorpsMigrated = '006.5.76';
  }

  function unitBelongsToCorps(units, uid, corpsId) {
    return (units || []).some(function (u) {
      return u && u.id === uid && (!corpsId || u.corpsId === corpsId);
    });
  }

  function migrateCorpsSlicesToUnits() {
    if (typeof db === 'undefined' || !db) return;
    ensureCorpsMigration();
    if (db._kmUnitSliceMigrated === '006.5.88') return;
    var data = db.kmCorpsData;
    if (!data || typeof data !== 'object') {
      db._kmUnitSliceMigrated = '006.5.88';
      return;
    }
    var oldKeys = Object.keys(data).filter(function (k) {
      return k && !isReservedSlice(k) && !isUnitSliceKey(k);
    });
    oldKeys.forEach(function (corpsId) {
      var blob = data[corpsId];
      if (!blob || typeof blob !== 'object') {
        delete data[corpsId];
        return;
      }
      var units = listUnits(corpsId);
      if (!units.length) {
        units = [{ id: corpsId + '_hq', corpsId: corpsId, name: 'Կորպուսի շտաբ' }];
      }
      var hqId = (units[0] && units[0].id) || (corpsId + '_hq');
      function unitSlice(uid) {
        var key = orgSliceKey(corpsId, uid);
        if (!key) return null;
        if (!data[key]) data[key] = emptySlice();
        return data[key];
      }
      units.forEach(function (u) { unitSlice(u.id); });
      (blob.positionArchives || []).forEach(function (a) {
        if (!a || a.builtin) return;
        var uid = String(a.unitId || '').trim();
        var target = unitBelongsToCorps(units, uid, corpsId) ? uid : hqId;
        var sl = unitSlice(target);
        if (!sl) return;
        if (!Array.isArray(sl.positionArchives)) sl.positionArchives = [];
        sl.positionArchives.push(cloneVal(a));
      });
      (blob.userPositions || []).forEach(function (p) {
        if (!p) return;
        var uid = String(p.orgUnitId || '').trim();
        var target = unitBelongsToCorps(units, uid, corpsId) ? uid : hqId;
        var sl = unitSlice(target);
        if (!sl) return;
        if (!Array.isArray(sl.userPositions)) sl.userPositions = [];
        sl.userPositions.push(cloneVal(p));
      });
      var assigned = Object.create(null);
      units.forEach(function (u) {
        var sl = unitSlice(u.id);
        if (!sl) return;
        var names = Object.create(null);
        (sl.userPositions || []).forEach(function (p) {
          var n = String((p && p.personName) || '').trim().toLowerCase();
          if (n) names[n] = 1;
        });
        (sl.positionArchives || []).forEach(function (a) {
          (a && a.rows || []).forEach(function (r) {
            var n = String((r && (r.sourceName || r.name)) || '').trim().toLowerCase();
            if (n) names[n] = 1;
          });
        });
        sl.people = (blob.people || []).filter(function (p) {
          var n = String((p && p.name) || '').trim().toLowerCase();
          return n && names[n];
        }).map(cloneVal);
        sl.people.forEach(function (p) {
          var n = String((p && p.name) || '').trim().toLowerCase();
          if (n) assigned[n] = 1;
        });
        sl.vacations = (blob.vacations || []).filter(function (v) {
          var n = String((v && v.person) || '').trim().toLowerCase();
          return n && names[n];
        }).map(cloneVal);
      });
      var hqSl = unitSlice(hqId);
      if (hqSl) {
        (blob.people || []).forEach(function (p) {
          var n = String((p && p.name) || '').trim().toLowerCase();
          if (!n || assigned[n]) return;
          if (!Array.isArray(hqSl.people)) hqSl.people = [];
          hqSl.people.push(cloneVal(p));
        });
        CORPS_DATA_KEYS.forEach(function (k) {
          if (k === 'people' || k === 'userPositions' || k === 'positionArchives' || k === 'vacations') return;
          if (blob[k] !== undefined) hqSl[k] = cloneVal(blob[k]);
        });
      }
      delete data[corpsId];
    });
    db._kmUnitSliceMigrated = '006.5.88';
  }

  function applySliceToWorking(slice) {
    if (typeof db === 'undefined' || !db || !slice) return;
    var base = emptySlice();
    CORPS_DATA_KEYS.forEach(function (k) {
      if (slice[k] === undefined) slice[k] = base[k];
      db[k] = slice[k];
    });
    if (typeof normalize === 'function') {
      try { normalize(); } catch (eN) {}
    }
  }

  window.kmSyncCorpsSlice = function () {
    if (typeof db === 'undefined' || !db || !activeSliceId) return;
    migrateCorpsSlicesToUnits();
    db.kmCorpsData[activeSliceId] = snapshotWorkingKeys();
  };

  window.kmActiveCorpsSliceId = function () {
    return activeSliceId;
  };

  window.kmApplyCorpsSlice = function (id) {
    if (typeof db === 'undefined' || !db || !id) return false;
    migrateCorpsSlicesToUnits();
    id = String(id || '').trim();
    if (!id) return false;
    if (!isReservedSlice(id) && !isUnitSliceKey(id)) return false;
    if (activeSliceId && activeSliceId !== id) {
      db.kmCorpsData[activeSliceId] = snapshotWorkingKeys();
    }
    if (!db.kmCorpsData[id]) db.kmCorpsData[id] = emptySlice();
    applySliceToWorking(db.kmCorpsData[id]);
    activeSliceId = id;
    try { window.kmPurgeAccountingIfNoArchive(); } catch (ePur) {}
    return true;
  };

  window.kmApplyOrgSlice = function (corpsId, unitId) {
    var key = orgSliceKey(corpsId, unitId);
    if (!key) return false;
    return window.kmApplyCorpsSlice(key);
  };

  function readSessionCtx() {
    try {
      var raw = sessionStorage.getItem(SS_KEY);
      if (!raw) return null;
      var c = JSON.parse(raw);
      if (c && c.corpsId && c.unitId && c.archiveRole) return c;
    } catch (e) {}
    return null;
  }

  function writeSessionCtx(ctx) {
    window.kmOrgContext = ctx;
    try { sessionStorage.setItem(SS_KEY, JSON.stringify(ctx)); } catch (e) {}
  }

  function applyBrandHint(ctx) {
    try {
      var brandText = document.querySelector('.kmBrandText');
      if (!brandText) return;
      var user = String(window.kmAuthFullName || '').trim() || (isAdmin() ? 'Ադմինիստրատոր' : 'Օգտատեր');
      if (ctx && ctx.unitName) {
        brandText.textContent = user;
        brandText.title = user + ' · ' + (ctx.corpsName || '') + ' · ' + ctx.unitName + ' · ' + roleLabel(ctx.archiveRole);
        brandText.classList.add('kmBrandMenuLabel');
      }
    } catch (e) {}
    try { if (typeof window.kmMountAdminHomeOrgPicker === 'function') setTimeout(function () { window.kmMountAdminHomeOrgPicker(); }, 0); } catch (eM) {}
  }

  window.kmApplyBoundUserOrg = function (org) {
    if (!org || !org.corpsId || !org.unitId) return false;
    var c = findCorps(org.corpsId);
    var u = findUnit(org.unitId);
    var ctx = {
      corpsId: org.corpsId,
      corpsName: (c && c.name) || org.corpsName || '',
      unitId: org.unitId,
      unitName: (u && u.name) || org.unitName || '',
      archiveRole: archiveRole(),
      pickedAt: Date.now(),
      boundUser: true
    };
    writeSessionCtx(ctx);
    try { sessionStorage.setItem(GATE_KEY, '1'); } catch (eG) {}
    try { if (typeof window.kmSyncOrgMenuGate === 'function') window.kmSyncOrgMenuGate(); /* GATE_AFTER_BOUND */ } catch (eMG) {}
    if (typeof window.kmApplyOrgSlice === 'function') window.kmApplyOrgSlice(ctx.corpsId, ctx.unitId);
    else if (typeof window.kmApplyCorpsSlice === 'function') window.kmApplyCorpsSlice(orgSliceKey(ctx.corpsId, ctx.unitId));
    applyBrandHint(ctx);
    closePicker();
    return true;
  };

  window.kmOrgArchiveRole = archiveRole;
  window.kmIsOrgAdmin = isAdmin;
  window.kmCanManageOrgUnits = isSuperAdmin;
  window.kmListOrgCorps = listCorps;
  window.kmListOrgUnits = listUnits;

  window.kmGetOrgContext = function () {
    if (isSuperAdmin()) {
      var live = window.kmOrgContext;
      if (live && live.corpsId && live.unitId) return live;
      try {
        var savedView = JSON.parse(sessionStorage.getItem(ADMIN_VIEW_KEY) || 'null');
        if (savedView && savedView.corpsId && savedView.unitId) {
          var c0 = findCorps(savedView.corpsId);
          var u0 = findUnit(savedView.unitId);
          if (c0 && u0) {
            var ctx0 = {
              corpsId: c0.id,
              corpsName: c0.name,
              unitId: u0.id,
              unitName: u0.name,
              archiveRole: 'admin',
              adminView: true
            };
            window.kmOrgContext = ctx0;
            return ctx0;
          }
        }
      } catch (eV) {}
      return live || { super: true, corpsId: '', unitId: '', archiveRole: 'admin' };
    }
    if (window.kmOrgContext && window.kmOrgContext.corpsId && window.kmOrgContext.unitId) {
      return window.kmOrgContext;
    }
    var s = readSessionCtx();
    if (s) {
      window.kmOrgContext = s;
      return s;
    }
    return null;
  };

  function hasOrgEntryGate() {
    try { return sessionStorage.getItem(GATE_KEY) === '1'; } catch (e) { return false; }
  }

  /* KM_HOME_ORG_SELECTED_V1 */
  window.kmHomeOrgSelected = function () {
    try {
      var c = typeof window.kmGetOrgContext === 'function' ? window.kmGetOrgContext() : null;
      return !!(c && String(c.corpsId || '').trim() && String(c.unitId || '').trim());
    } catch (e) { return false; }
  };

  /* KM_ORG_MENU_GATE_TIGHT_V1 */
  window.kmOrgNavAllowedPage = function (page) { /* KM_ADMIN_HOME_ORG_PICK_V1 */
    page = String(page || '').trim();
    if (!page || page === 'home' || page === 'about' || page === 'login') return true;
    try { if (typeof window.kmHomeOrgSelected === 'function') return !!window.kmHomeOrgSelected(); } catch (e) {}
    return !!(window.kmOrgReady && window.kmOrgReady());
  };
  window.kmSyncOrgMenuGate = function () {
    try {
      var ready = (typeof window.kmHomeOrgSelected === 'function') ? !!window.kmHomeOrgSelected() : !!(window.kmOrgReady && window.kmOrgReady());
      /* KM_PERF_STARTUP_TIMER_THROTTLE_V1: remember last full scan (used by the timer below) */
      window.__kmGateLastReady = ready;
      window.__kmGateLastAt = Date.now();
      var nodes = document.querySelectorAll('[data-page], button.nav, aside .nav, .kmNavCard, .side-nav [onclick], .nav-item, .km-side button, #sideNav button, #kmSideNav [data-page]');
      nodes.forEach(function (btn) {
        var page = String(btn.getAttribute('data-page') || '').trim();
        if (!page) {
          var oc = String(btn.getAttribute('onclick') || '');
          var m = oc.match(/kmOpenPage\(['"]([\w]+)['"]\)/);
          if (m) page = m[1];
        }
        var allow = !page || page === 'home' || page === 'about' || ready; /* KM_ADMIN_HOME_ORG_PICK_V1 */
        btn.classList.toggle('km-org-nav-locked', !allow);
        btn.style.opacity = allow ? '' : '0.45';
        btn.style.pointerEvents = allow ? '' : 'none';
        try { btn.disabled = !allow; } catch (eD) {}
      });
      if (!document.getElementById('km-org-menu-gate-css')) {
        var st = document.createElement('style');
        st.id = 'km-org-menu-gate-css';
        st.textContent = '.km-org-nav-locked{filter:grayscale(.35);cursor:not-allowed!important}';
        (document.head || document.documentElement).appendChild(st);
      }
    } catch (eGate) {}
  };
  (function wrapKmOpenPageOrgGate() {
    function install() {
      var orig = window.kmOpenPage;
      if (typeof orig !== 'function' || orig.__kmOrgMenuGate) return;
      window.kmOpenPage = function (page) {
        page = String(page || '').trim();
        var allow = true;
        try { if (typeof window.kmOrgNavAllowedPage === 'function') allow = window.kmOrgNavAllowedPage(page); } catch (eA) {}
        if (!allow) {
          try {
            if (typeof toast === 'function') toast('Նախ ընտրեք բանակային կորպուս և զորամաս', 'warn');
            else if (typeof window.kmToast === 'function') window.kmToast('Նախ ընտրեք բանակային կորպուս և զորամաս', 'warn');
          } catch (eT) {}
          try { return orig.call(this, 'home'); } catch (eO) {}
          return;
        }
        return orig.apply(this, arguments);
      };
      window.kmOpenPage.__kmOrgMenuGate = true;
    }
    install();
    setTimeout(install, 0);
    setTimeout(install, 800);
    setTimeout(install, 2500);
    document.addEventListener('DOMContentLoaded', function () {
      install();
      try { window.kmSyncOrgMenuGate(); } catch (eS) {}
    });
    /* KM_PERF_STARTUP_TIMER_THROTTLE_V1: this used to re-run a whole-document querySelectorAll +
       per-node style writes every 1.6s forever (visible as periodic jank on heavy grids).
       Explicit calls (GATE_AFTER_BOUND etc.) still always run a full scan; the timer now only
       rescans when the org-ready state flipped or every 10s (to catch rebuilt menus), and not
       at all while the window is hidden. */
    setInterval(function () {
      try {
        if (typeof document !== 'undefined' && document.hidden) return;
        var rdy = (typeof window.kmHomeOrgSelected === 'function') ? !!window.kmHomeOrgSelected() : !!(window.kmOrgReady && window.kmOrgReady());
        if (rdy === window.__kmGateLastReady && (Date.now() - (window.__kmGateLastAt || 0)) < 10000) return;
        window.kmSyncOrgMenuGate();
      } catch (eI) {}
    }, 1600);
  })();


  window.kmOrgReady = function () { /* KM_ORG_MENU_GATE_TIGHT_V1 */
    try {
      if (typeof window.kmHomeOrgSelected === 'function') return !!window.kmHomeOrgSelected();
    } catch (e0) {}
    var c = typeof window.kmGetOrgContext === 'function' ? window.kmGetOrgContext() : null;
    return !!(c && String(c.corpsId || '').trim() && String(c.unitId || '').trim());
  };

  window.kmOrgMustPick = function () { /* KM_ORG_MENU_GATE_TIGHT_V1 */
    if (!window.kmRoleUnlocked) return false;
    try {
      if (document.getElementById('kmLoginOverlay')) return false;
    } catch (e) {}
    return !window.kmOrgReady();
  };

  window.kmOrgArchiveScope = function () {
    var c = window.kmGetOrgContext();
    if (!c || !c.corpsId || !c.unitId) return null;
    return {
      corpsId: c.corpsId,
      unitId: c.unitId,
      archiveRole: c.archiveRole || archiveRole(),
      corpsName: c.corpsName || '',
      unitName: c.unitName || ''
    };
  };

  window.kmOrgScopeStamp = function () {
    var forced = String(window._kmArchiveForCorpsId || '').trim();
    var uid = String(window._kmArchiveForUnitId || '').trim();
    if (forced && uid) {
      var fc = findCorps(forced);
      var fu = findUnit(uid);
      return {
        corpsId: forced,
        unitId: uid,
        archiveRole: archiveRole(),
        corpsName: (fc && fc.name) || '',
        unitName: (fu && fu.name) || ''
      };
    }
    var s = window.kmOrgArchiveScope();
    if (!s || !s.corpsId || !s.unitId) return {};
    return {
      corpsId: s.corpsId,
      unitId: s.unitId,
      archiveRole: s.archiveRole,
      corpsName: s.corpsName,
      unitName: s.unitName
    };
  };

  window.kmArchiveMatchesContext = function (item) {
    if (!item) return false;
    if (item.builtin) return false;
    /* KM_UNIFIED_ARCHIVE_FLOW_V1: raw imported data blobs (legacy items carrying base64/rows
       instead of a formal Unit Archive record) must match BOTH korpusId and unitId strictly —
       no partial/corps-only match is allowed for them. */
    var isRawImportedBlob = !!(item.base64 || (item.rows && Array.isArray(item.rows)));
    var forced = String(window._kmArchiveForCorpsId || '').trim();
    var forcedUnit = String(window._kmArchiveForUnitId || '').trim();
    var ctx = window.kmGetOrgContext();
    if (isRawImportedBlob) {
      var cid = forced || String((ctx && ctx.corpsId) || '').trim();
      var uid = forcedUnit || String((ctx && ctx.unitId) || '').trim();
      if (!cid || !uid) return false;
      return String(item.corpsId || '').trim() === cid && String(item.unitId || '').trim() === uid;
    }
    if (forced) {
      if (String(item.corpsId || '') !== String(forced)) return false;
      return true;
    }
    if (isSuperAdmin()) return true;
    if (!ctx || !ctx.corpsId || !ctx.unitId) return false;
    var role = ctx.archiveRole || archiveRole();
    if (!item.corpsId && !item.archiveRole) return false;
    if (String(item.corpsId || '') !== String(ctx.corpsId)) return false;
    if (item.unitId && String(item.unitId) !== String(ctx.unitId)) return false;
    if (item.archiveRole && String(item.archiveRole) !== String(role)) return false;
    return true;
  };

  window.kmFilterArchivesForContext = function (list) {
    return (list || []).filter(function (a) { return window.kmArchiveMatchesContext(a); });
  };

  window.kmOrgContextLabel = function () {
    var c = window.kmGetOrgContext();
    if (c && c.corpsId && c.unitId) {
      return (c.corpsName || '') + ' · ' + (c.unitName || '') +
        (isSuperAdmin() ? ' · ադմինիստրատոր' : (' · ' + roleLabel(c.archiveRole)));
    }
    if (isSuperAdmin()) return 'Սուպեր ադմինիստրատոր';
    if (!c) return '';
    return (c.corpsName || '') + ' · ' + (c.unitName || '') + ' · ' + roleLabel(c.archiveRole);
  };

  window.kmClearOrgContext = function () {
    window.kmOrgContext = null;
    try { sessionStorage.removeItem(SS_KEY); } catch (e) {}
    try { sessionStorage.removeItem(GATE_KEY); } catch (eG) {}
    var el = document.getElementById('kmOrgPickerOverlay');
    if (el) el.remove();
  };

  function closePicker() {
    var el = document.getElementById('kmOrgPickerOverlay');
    if (el) el.remove();
  }

  function applyPickedUnitStaff(ctx, immediate) {
    if (!ctx || !ctx.unitId) return;
    function run() {
      try {
        if (typeof window.kmEnsureHtmlV7UnitArchive === 'function') {
          window.kmEnsureHtmlV7UnitArchive({ noPersist: true });
        }
      } catch (eV7) {}
      if (typeof window.kmApplyArchivesToAccounting !== 'function') return;
      try {
        /* KM_ACC_PERF_NO_SOFT_SYNC_V2 */
        try {
          var __prevUnit = String((window._kmAccAppliedKey || '').split('::')[1] || '');
          var __nextUnit = String((ctx && ctx.unitId) || '');
          if (!(__prevUnit && __nextUnit && __prevUnit === __nextUnit)) {
            window._kmAccAppliedKey = '';
            window._kmAccAppliedFp = '';
            window._kmPeopleSyncFp = '';
            window._kmPeopleSoftFp = '';
          }
        } catch (eInv) {
          window._kmAccAppliedKey = '';
          window._kmAccAppliedFp = '';
          window._kmPeopleSyncFp = '';
          window._kmPeopleSoftFp = '';
        }
        window.kmApplyArchivesToAccounting({
          stamp: {
            corpsId: ctx.corpsId || '',
            unitId: ctx.unitId || '',
            unitName: ctx.unitName || '',
            corpsName: ctx.corpsName || ''
          },
          unitId: ctx.unitId,
          forceTroop: false
        });
      } catch (eA) {}
    }
    var later = function () {
      if (typeof window.kmApplyArchivesToAccounting === 'function') {
        run();
        return;
      }
      if (typeof window.kmLoadPageModules === 'function') {
        window.kmLoadPageModules('positions', run);
      }
    };
    if (immediate) {
      later();
      return;
    }
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(later, { timeout: 4000 });
    } else {
      setTimeout(later, 600);
    }
  }

  function rerenderAdminOrgView() {
    var p = '';
    try { p = String(window.page || (typeof page !== 'undefined' ? page : '') || ''); } catch (eP) { p = ''; }
    try {
      if ((p === 'people' || p === 'positions') && typeof window.kmOpenPersonnelHub === 'function') {
        window.kmOpenPersonnelHub({ tab: p });
        return;
      }
      if (p === 'accounting' && typeof window.kmRenderAccountingHub === 'function') {
        window.kmRenderAccountingHub();
        return;
      }
      if (p && typeof window.kmOpenPage === 'function') window.kmOpenPage(p);
    } catch (eR) {}
  }

  function applyAdminOrgView(corpsId, unitId) {
    var c = findCorps(corpsId);
    var u = findUnit(unitId);
    if (!c || !u) return false;
    var ctx = {
      corpsId: c.id,
      corpsName: c.name,
      unitId: u.id,
      unitName: u.name,
      archiveRole: 'admin',
      adminView: true,
      pickedAt: Date.now()
    };
    writeSessionCtx(ctx);
    try { sessionStorage.setItem(ADMIN_VIEW_KEY, JSON.stringify({ corpsId: c.id, unitId: u.id })); } catch (eS) {}
    try { sessionStorage.setItem(GATE_KEY, '1'); } catch (eG) {}
    try { if (typeof window.kmSyncOrgMenuGate === 'function') window.kmSyncOrgMenuGate(); /* GATE_AFTER_BOUND */ } catch (eMG) {}
    try { window._kmAccAppliedKey = ''; window._kmPeopleArchiveEnsure = {}; } catch (eK) {}
    if (typeof window.kmApplyOrgSlice === 'function') window.kmApplyOrgSlice(c.id, u.id);
    applyBrandHint(ctx);
    try { if (typeof window.kmMountAdminHomeOrgPicker === 'function') window.kmMountAdminHomeOrgPicker(); } catch (eMh) {}
    return true;
  }

  window.kmAdminCanAccountingOrgView = function () {
    /* KM_ARCHIVE_ORG_SCOPE_CHECK_V1 / KM_SYSTEM_WIDE_V1 */
    if (isSuperAdmin()) return true;
    try {
      if (typeof window.kmCanAccessPage === 'function' && window.kmCanAccessPage('unitArchive')) return true;
    } catch (e0) {}
    return false;
  };
  window.kmCanEditArchiveOrg = function (corpsId, unitId) {
    if (isSuperAdmin()) return true;
    try {
      var u = window.kmCurrentUser || window.kmAuthUser || null;
      if (!u) { try { u = JSON.parse(sessionStorage.getItem('km_auth_user') || 'null'); } catch (e1) { u = null; } }
      var corpsIds = (u && (u.archiveCorpsIds || (u.org && u.org.archiveCorpsIds))) || [];
      var unitIds = (u && (u.archiveUnitIds || (u.org && u.org.archiveUnitIds))) || [];
      if (unitId && unitIds.length) return unitIds.map(String).indexOf(String(unitId)) >= 0;
      if (corpsId && corpsIds.length) return corpsIds.map(String).indexOf(String(corpsId)) >= 0;
      var ou = u && (u.unitId || (u.org && u.org.unitId));
      if (unitId && ou && String(ou) === String(unitId)) return true;
      return typeof window.kmCanAccessPage === 'function' && window.kmCanAccessPage('unitArchive');
    } catch (e2) { return false; }
  };

  window.kmRestoreAdminAccountingOrgView = function () {
    if (!isSuperAdmin()) return false;
    var live = window.kmOrgContext;
    if (live && live.adminView && live.corpsId && live.unitId) return true;
    var saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(ADMIN_VIEW_KEY) || 'null'); } catch (e) { saved = null; }
    if (!saved || !saved.corpsId || !saved.unitId) return false;
    return applyAdminOrgView(saved.corpsId, saved.unitId);
  };

  window.kmAdminAccountingOrgPickerHtml = function () {
    if (!canPickHomeOrg()) return '';
    try { injectOrgArchCss(); } catch (eCss) {}
    var ctx = {};
    try { ctx = window.kmGetOrgContext() || {}; } catch (eCtx) { ctx = {}; }
    var corps = [];
    try { corps = listCorps() || []; } catch (eC) { corps = []; }
    var selC = String(ctx.corpsId || '');
    var units = [];
    try { units = listUnits(selC) || []; } catch (eU) { units = []; }
    var selU = String(ctx.unitId || '');
    var corpsOpts = '<option value="">— բանակային կորպուս —</option>' + corps.map(function (c) {
      return '<option value="' + esc(c.id) + '"' + (c.id === selC ? ' selected' : '') + '>' + esc(c.name) + '</option>';
    }).join('');
    var unitOpts = '<option value="">— զորամաս —</option>' + units.map(function (u) {
      return '<option value="' + esc(u.id) + '"' + (u.id === selU ? ' selected' : '') + '>' + esc(u.name) + '</option>';
    }).join('');
    return '<div class="kmAdminOrgPick" id="kmAdminOrgPick" style="display:flex;flex-direction:row;flex-wrap:wrap;gap:12px;align-items:flex-end;margin:0;padding:14px 16px;width:100%;box-sizing:border-box;background:rgba(255,255,255,.96);border:1px solid rgba(15,35,60,.18);border-radius:14px;box-shadow:0 12px 36px rgba(0,0,0,.35)">' +
      '<label style="flex:1 1 220px;min-width:200px;color:#1a2b3c;font-size:12px;font-weight:700">Բանակային կորպուս<select id="kmAdminPickCorps" style="display:block;width:100%;margin-top:4px;padding:8px 10px;box-sizing:border-box;font:inherit;background:#fff;color:#111;border:1px solid #c9d4e0;border-radius:8px">' + corpsOpts + '</select></label>' +
      '<label style="flex:1 1 220px;min-width:200px;color:#1a2b3c;font-size:12px;font-weight:700">Զորամաս<select id="kmAdminPickUnit" style="display:block;width:100%;margin-top:4px;padding:8px 10px;box-sizing:border-box;font:inherit;background:#fff;color:#111;border:1px solid #c9d4e0;border-radius:8px"' + (selC ? '' : ' disabled') + '>' + unitOpts + '</select></label>' +
      '</div>';
  };

  window.kmBindAdminAccountingOrgPicker = function (root) {
    if (!root) return;
    var wrap = root.querySelector('#kmAdminOrgPick') || (root.id === 'kmAdminOrgPick' ? root : null);
    if (!wrap) return;
    var corpsSel = wrap.querySelector('#kmAdminPickCorps');
    var unitSel = wrap.querySelector('#kmAdminPickUnit');
    if (!corpsSel || !unitSel || corpsSel.__kmBound) return;
    corpsSel.__kmBound = true;
    corpsSel.addEventListener('change', function () {
      var cid = String(corpsSel.value || '');
      var units = listUnits(cid);
      unitSel.innerHTML = '<option value="">— զորամաս —</option>' + units.map(function (u) {
        return '<option value="' + esc(u.id) + '">' + esc(u.name) + '</option>';
      }).join('');
      unitSel.disabled = !cid;
      if (!cid) {
        window.kmOrgContext = { super: true, corpsId: '', unitId: '', archiveRole: 'admin' };
        try { sessionStorage.removeItem(ADMIN_VIEW_KEY); } catch (eC) {}
        try { sessionStorage.removeItem(GATE_KEY); } catch (eG2) {}
        if (typeof window.kmApplyCorpsSlice === 'function') window.kmApplyCorpsSlice('_super');
        applyBrandHint({ unitName: '', corpsName: 'Սուպեր ադմինիստրատոր' });
        try { if (typeof window.kmSyncOrgMenuGate === 'function') window.kmSyncOrgMenuGate(); } catch (eSg) {}
        try { if (typeof window.kmMountAdminHomeOrgPicker === 'function') window.kmMountAdminHomeOrgPicker(); } catch (eMh2) {}
        rerenderAdminOrgView();
      }
    });
    unitSel.addEventListener('change', function () {
      var cid = String(corpsSel.value || '').trim();
      var uid = String(unitSel.value || '').trim();
      if (!cid || !uid) return;
      applyAdminOrgView(cid, uid);
      var kick = function () {
        try { if (typeof window.kmMountAdminHomeOrgPicker === 'function') window.kmMountAdminHomeOrgPicker(); } catch (eMh3) {}
        rerenderAdminOrgView();
        try {
          if (typeof window.kmEnsureUnitArchiveRows === 'function') {
            Promise.resolve(window.kmEnsureUnitArchiveRows(uid)).then(function (st) {
              if (st === 'loaded') rerenderAdminOrgView();
            }).catch(function () {});
          }
        } catch (eEns) {}
      };
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(function () { setTimeout(kick, 0); });
      else setTimeout(kick, 0);
    });
  };

  /* KM_ADMIN_HOME_ORG_PICK_V1 — admin corps/unit on landing brand, not accounting */
  window.kmMountAdminHomeOrgPicker = function () {
    try {
      function removeHomePickHost() {
        try {
          var h = document.getElementById('kmAdminHomeOrgPick');
          if (h && h.parentNode) h.parentNode.removeChild(h);
        } catch (eRm) {}
      }
      if (!canPickHomeOrg()) {
        removeHomePickHost();
        return false;
      }
      /* Hide once corps+unit chosen — otherwise it covers the main UI */
      try {
        if (typeof window.kmHomeOrgSelected === 'function' && window.kmHomeOrgSelected()) {
          removeHomePickHost();
          return false;
        }
      } catch (eSel) {}
      try { injectOrgArchCss(); } catch (eCss) {}
      var html = '';
      try {
        html = (typeof window.kmAdminAccountingOrgPickerHtml === 'function' && window.kmAdminAccountingOrgPickerHtml()) || '';
      } catch (eH) { html = ''; }
      if (!html) {
        html = '<div class="kmAdminOrgPick" id="kmAdminOrgPick" style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;padding:14px 16px;background:rgba(255,255,255,.96);border:1px solid rgba(15,35,60,.18);border-radius:14px;box-shadow:0 12px 36px rgba(0,0,0,.35)">' +
          '<label style="flex:1 1 220px;min-width:200px;color:#1a2b3c;font-size:12px;font-weight:700">Բանակային կորպուս' +
          '<select id="kmAdminPickCorps" style="display:block;width:100%;margin-top:4px;padding:8px 10px;box-sizing:border-box;font:inherit;background:#fff;color:#111;border:1px solid #c9d4e0;border-radius:8px"><option value="">— բանակային կորպուս —</option></select></label>' +
          '<label style="flex:1 1 220px;min-width:200px;color:#1a2b3c;font-size:12px;font-weight:700">Զորամաս' +
          '<select id="kmAdminPickUnit" disabled style="display:block;width:100%;margin-top:4px;padding:8px 10px;box-sizing:border-box;font:inherit;background:#fff;color:#111;border:1px solid #c9d4e0;border-radius:8px"><option value="">— զորամաս —</option></select></label></div>';
      }
      var host = document.getElementById('kmAdminHomeOrgPick');
      if (!host) {
        host = document.createElement('div');
        host.id = 'kmAdminHomeOrgPick';
      }
      host.style.cssText = 'position:fixed !important;top:22px !important;left:0 !important;right:0 !important;margin:0 auto !important;z-index:2147483646 !important;width:min(560px, calc(100vw - 40px)) !important;box-sizing:border-box;padding:0 12px;pointer-events:none;display:flex !important;justify-content:center;visibility:visible !important;opacity:1 !important';
      var anchor = document.body || document.documentElement;
      if (!host.parentNode) anchor.appendChild(host);
      else if (document.body && host.parentNode !== document.body) {
        try { document.body.appendChild(host); } catch (eMv) {}
      }
      /* avoid wiping user selection every tick */
      if (host.getAttribute('data-km-html') === html && host.querySelector('#kmAdminPickCorps')) {
        try {
          var card0 = host.querySelector('#kmAdminOrgPick');
          if (card0) card0.style.pointerEvents = 'auto';
        } catch (e0) {}
        return true;
      }
      host.setAttribute('data-km-html', html);
      host.innerHTML = html;
      try {
        var card = host.querySelector('#kmAdminOrgPick');
        if (card) card.style.pointerEvents = 'auto';
        var cs = host.querySelector('#kmAdminPickCorps');
        var us = host.querySelector('#kmAdminPickUnit');
        if (cs) try { delete cs.__kmBound; } catch (e1) { cs.__kmBound = false; }
        if (us) try { delete us.__kmBound; } catch (e2) { us.__kmBound = false; }
      } catch (ePe) {}
      if (typeof window.kmBindAdminAccountingOrgPicker === 'function') {
        try { window.kmBindAdminAccountingOrgPicker(host); } catch (eBind) {}
      }
      return true;
    } catch (eM) {
      try { console.warn('kmMountAdminHomeOrgPicker', eM); } catch (eW) {}
      return false;
    }
  };
  (function bootAdminHomeOrgPick() {
    function go() { try { window.kmMountAdminHomeOrgPicker(); } catch (e) {} }
    go();
    [0, 200, 500, 1000, 2000, 4000, 8000].forEach(function (ms) { setTimeout(go, ms); });
    document.addEventListener('DOMContentLoaded', go);
    window.addEventListener('focus', go);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) go(); });
    try {
      ['kmApplyAuth', 'kmEnsureOrgPicker', 'kmApplyRoleGuard'].forEach(function (name) {
        var fn = window[name];
        if (typeof fn === 'function' && !fn.__kmHomeOrgPick) {
          window[name] = function () {
            var r = fn.apply(this, arguments);
            setTimeout(go, 0);
            setTimeout(go, 250);
            setTimeout(go, 1000);
            return r;
          };
          window[name].__kmHomeOrgPick = true;
        }
      });
      /* kmApplyAuth is not always on window — patch local if exposed later */
      try {
        if (typeof window.kmApplyAuth !== 'function') {
          Object.defineProperty(window, 'kmApplyAuth', {
            configurable: true,
            set: function (fn) {
              if (typeof fn === 'function' && !fn.__kmHomeOrgPick) {
                var wrapped = function () {
                  var r = fn.apply(this, arguments);
                  setTimeout(go, 0);
                  setTimeout(go, 300);
                  return r;
                };
                wrapped.__kmHomeOrgPick = true;
                Object.defineProperty(window, 'kmApplyAuth', { value: wrapped, writable: true, configurable: true });
              } else {
                Object.defineProperty(window, 'kmApplyAuth', { value: fn, writable: true, configurable: true });
              }
            },
            get: function () { return undefined; }
          });
        }
      } catch (eDef) {}
    } catch (eW) {}
    function rehookAuth() {
      try {
        /* km-auth-ui exposes apply via closure; hook ensure + role guard again */
        ['kmEnsureOrgPicker', 'kmApplyRoleGuard', 'kmShowDualLogin'].forEach(function (name) {
          var fn = window[name];
          if (typeof fn === 'function' && !fn.__kmHomeOrgPick) {
            window[name] = function () {
              var r = fn.apply(this, arguments);
              setTimeout(go, 0);
              setTimeout(go, 400);
              return r;
            };
            window[name].__kmHomeOrgPick = true;
          }
        });
      } catch (eR) {}
    }
    rehookAuth();
    setTimeout(rehookAuth, 500);
    setTimeout(rehookAuth, 2000);
    setInterval(function () {
      try {
        if (typeof document !== 'undefined' && document.hidden) return; /* KM_PERF_STARTUP_TIMER_THROTTLE_V1 */
        rehookAuth();
        if (!canPickHomeOrg()) {
          try {
            var hx = document.getElementById('kmAdminHomeOrgPick');
            if (hx && hx.parentNode) hx.parentNode.removeChild(hx);
          } catch (eHx) {}
          return;
        }
        if (typeof window.kmHomeOrgSelected === 'function' && window.kmHomeOrgSelected()) {
          try {
            var hy = document.getElementById('kmAdminHomeOrgPick');
            if (hy && hy.parentNode) hy.parentNode.removeChild(hy);
          } catch (eHy) {}
          return;
        }
        var host = document.getElementById('kmAdminHomeOrgPick');
        if (!host || !host.querySelector('#kmAdminPickCorps') || !host.querySelector('#kmAdminPickUnit')) go();
      } catch (eI) {}
    }, 1200);
  })();

  window.kmEnsureUnitArchiveRows = async function (unitId, opts) {
    opts = opts || {};
    var uid = String(unitId || '').trim();
    try {
      if (typeof window.kmEnsureHtmlV7UnitArchive === 'function') {
        window.kmEnsureHtmlV7UnitArchive({ noPersist: true });
      }
    } catch (eV7) {}
    try {
      if (window.kmUnitArchiveStaffSource && window.kmUnitArchiveStaffSource.hasFormal &&
          window.kmUnitArchiveStaffSource.hasFormal(uid)) {
        return 'ready';
      }
    } catch (eF) {}
    var ctx = null;
    try { ctx = window.kmGetOrgContext(); } catch (eC) { ctx = null; }
    var cid = String((ctx && ctx.corpsId) || '').trim();
    var already = 0;
    try {
      if (typeof db !== 'undefined' && db && Array.isArray(db.positionArchives)) {
        already = db.positionArchives.filter(function (a) {
          if (!a || a.builtin) return false;
          if (uid && String(a.unitId || '').trim() !== uid) return false;
          return !!(a.rows && a.rows.length);
        }).length;
      }
    } catch (eHave) { already = 0; }
    if (already) return 'ready';
    if (!opts.skipNetwork) {
      try {
        var lan = window.kmNative && window.kmNative.lanSync;
        if (lan && typeof lan.pullPrefix === 'function') {
          var st = null;
          try { st = await lan.status(); } catch (eSt) { st = null; }
          var role = String((st && (st.effectiveRole || st.role)) || '');
          if (role !== 'server' && role !== 'hub' && !(st && st.isServer)) {
            await lan.pullPrefix('unit_archives', { timeoutMs: 4000 });
          }
        }
      } catch (e0) {}
    }
    try {
      await window.kmRefreshOrgArchives({ unitId: uid, corpsId: cid });
    } catch (e1) {}
    var cur = '';
    try { cur = typeof window.kmActiveCorpsSliceId === 'function' ? window.kmActiveCorpsSliceId() : ''; } catch (eCur) { cur = ''; }
    var want = (cid && uid) ? orgSliceKey(cid, uid) : '';
    if (want && cur !== want && typeof window.kmApplyOrgSlice === 'function') {
      try { window.kmApplyOrgSlice(cid, uid); } catch (eSl) {}
    }
    return 'loaded';
  };

  function afterOrgPicked() {
    closePicker();
    var ctx = window.kmGetOrgContext();
    applyBrandHint(ctx);
    /* KM_HOME_REFRESH_AFTER_ORG_V1 */
    try {
      if ((window.page === 'home' || (typeof page !== 'undefined' && page === 'home')) && typeof window.home === 'function') {
        window.home();
      }
    } catch (eHomeRef) {}

    try {
      var side = document.querySelector('aside.side');
      if (side) side.classList.remove('km-side-open');
      var brand = document.getElementById('kmBrandHomeBtn');
      if (brand) brand.setAttribute('aria-expanded', 'false');
    } catch (eS) {}
    if (typeof window.kmUserGrantsLocked === 'function' && window.kmUserGrantsLocked() &&
        typeof window.kmRenderGrantsLockedHome === 'function') {
      try {
        document.body.classList.remove('km-boot-idle');
        if (typeof page !== 'undefined') page = 'home';
        window.page = 'home';
        window.kmRenderGrantsLockedHome();
      } catch (eG) {}
      return;
    }
    try {
      document.body.classList.add('km-boot-idle');
      if (typeof page !== 'undefined') page = '';
      window.page = '';
      var host = document.getElementById('content');
      if (host) host.innerHTML = '';
      var pt = document.getElementById('pageTitle');
      if (pt) pt.textContent = '';
    } catch (eI) {}
  }

  function confirmPick(corps, unit) {
    if (!corps || !unit) return;
    var ctx = {
      corpsId: corps.id,
      corpsName: corps.name,
      unitId: unit.id,
      unitName: unit.name,
      archiveRole: archiveRole(),
      pickedAt: Date.now()
    };
    writeSessionCtx(ctx);
    writeLastPick(ctx);
    try { sessionStorage.setItem(GATE_KEY, '1'); } catch (eG) {}
    try { if (typeof window.kmSyncOrgMenuGate === 'function') window.kmSyncOrgMenuGate(); /* GATE_AFTER_BOUND */ } catch (eMG) {}
    if (typeof window.kmApplyOrgSlice === 'function') window.kmApplyOrgSlice(corps.id, unit.id);
    else if (typeof window.kmApplyCorpsSlice === 'function') window.kmApplyCorpsSlice(orgSliceKey(corps.id, unit.id));
    notify(ctx.corpsName + ' · ' + ctx.unitName, 'ok');
    afterOrgPicked();
    applyPickedUnitStaff(ctx);
    if (typeof window.kmLoadPageModules === 'function') {
      setTimeout(function () {
        try { window.kmLoadPageModules('accounting'); } catch (eAcc) {}
      }, 700);
    }
  }

  function addCorps(name) {
    if (!isAdmin()) return { ok: false, error: 'Կորպուս ավելացնում է ադմինիստրատորը' };
    var store = ensureOrgStore();
    if (!store) return { ok: false, error: 'Բազան դեռ պատրաստ չէ' };
    var existing = listCorps();
    var n = String(name || '').replace(/\s+/g, ' ').trim();
    var used = Object.create(null);
    existing.forEach(function (c) {
      var o = parseCorpsOrd(c);
      if (o > 0) used[o] = 1;
    });
    var wanted = parseNameOrd(n);
    var ord = (wanted > 0 && !used[wanted]) ? wanted : nextCorpsOrd(existing);
    if (!n) n = hyOrdinalCorps(ord);
    var exists = existing.some(function (c) {
      return String(c.name).toLowerCase() === n.toLowerCase();
    });
    if (exists) return { ok: false, error: 'Այդ կորպուսն արդեն կա' };
    var slotId = 'bk' + ord;
    var idTaken = (store.corps || []).some(function (x) { return x && x.id === slotId; });
    var row = {
      id: idTaken ? ('bk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)) : slotId,
      name: n,
      kind: 'corps',
      ord: ord
    };
    store.corps.push(row);
    ensureDefaultUnitsForCorps(store, row.id);
    persistOrgStore();
    return { ok: true, corps: row };
  }

  function removeCorps(corpsId) {
    if (!isAdmin()) return { ok: false, error: 'Միայն ադմինիստրատոր' };
    if (!corpsId || corpsId === CENTRAL_ID) return { ok: false, error: 'Այս բաժինը չի հեռացվում' };
    var store = ensureOrgStore();
    var c = findCorps(corpsId);
    if (!c || !store) return { ok: false, error: 'Կորպուսը չգտնվեց' };
    store.corps = store.corps.filter(function (x) { return !x || x.id !== corpsId; });
    store.units = (store.units || []).filter(function (x) { return !x || x.corpsId !== corpsId; });
    persistOrgStore();
    return { ok: true };
  }

  function renameCorps(corpsId, name) {
    if (!isAdmin()) return { ok: false, error: 'Միայն ադմինիստրատոր' };
    if (!corpsId || corpsId === CENTRAL_ID) return { ok: false, error: 'Այս բաժինը չի վերանվանվում' };
    var n = String(name || '').replace(/\s+/g, ' ').trim();
    if (!n) return { ok: false, error: 'Դատարկ անուն' };
    var store = ensureOrgStore();
    var c = findCorps(corpsId);
    if (!c || !store) return { ok: false, error: 'Կորպուսը չգտնվեց' };
    var clash = listCorps().some(function (x) {
      return x && x.id !== corpsId && String(x.name).toLowerCase() === n.toLowerCase();
    });
    if (clash) return { ok: false, error: 'Այդ անունով կորպուս արդեն կա' };
    var i;
    for (i = 0; i < (store.corps || []).length; i++) {
      if (store.corps[i] && store.corps[i].id === corpsId) {
        store.corps[i].name = n;
        break;
      }
    }
    persistOrgStore();
    return { ok: true };
  }

  function addUnit(corpsId, name) {
    var n = String(name || '').replace(/\s+/g, ' ').trim();
    if (!n) return { ok: false, error: 'Գրեք զորամասի անունը' };
    if (!isAdmin()) return { ok: false, error: 'Զորամաս ավելացնում է ադմինիստրատորը' };
    var store = ensureOrgStore();
    if (!store) return { ok: false, error: 'Բազան դեռ պատրաստ չէ' };
    if (!corpsId) return { ok: false, error: 'Ընտրեք կորպուսը' };
    if (corpsId !== CENTRAL_ID && !findCorps(corpsId)) return { ok: false, error: 'Ընտրեք կորպուսը' };
    var exists = listUnits(corpsId).some(function (u) {
      return String(u.name).toLowerCase() === n.toLowerCase();
    });
    if (exists) return { ok: false, error: 'Այդ զորամասն արդեն կա' };
    var row = {
      id: 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      corpsId: corpsId,
      name: n
    };
    if (corpsId === CENTRAL_ID) row.kind = 'central';
    store.units.push(row);
    persistOrgStore();
    return { ok: true, unit: row };
  }

  function removeUnit(unitId) {
    if (!isAdmin()) return { ok: false, error: 'Զորամաս հեռացնում է ադմինիստրատորը' };
    var store = ensureOrgStore();
    var u = findUnit(unitId);
    if (!u || !store) return { ok: false, error: 'Զորամասը չգտնվեց' };
    store.units = store.units.filter(function (x) { return !x || x.id !== unitId; });
    persistOrgStore();
    return { ok: true };
  }

  function renameUnit(unitId, name) {
    if (!isAdmin()) return { ok: false, error: 'Միայն ադմինիստրատոր' };
    var n = String(name || '').replace(/\s+/g, ' ').trim();
    if (!n) return { ok: false, error: 'Դատարկ անուն' };
    var store = ensureOrgStore();
    var u = findUnit(unitId);
    if (!u || !store) return { ok: false, error: 'Զորամասը չգտնվեց' };
    var i;
    for (i = 0; i < (store.units || []).length; i++) {
      if (store.units[i] && store.units[i].id === unitId) {
        store.units[i].name = n;
        break;
      }
    }
    persistOrgStore();
    return { ok: true };
  }

  function renderPicker(el, step, selectedCorpsId) {
    var last = readLastPick() || {};
    var corpsList = listCorps();
    var head = '<div style="text-align:center;margin:0 0 14px">' +
      '<img src="assets/km_logo_square.jpg?v=006.5.113" alt="KM" style="width:72px;height:72px;object-fit:cover;border-radius:50%;background:#0b1a33">' +
      '</div>' +
      '<h3 style="margin:0 0 6px">Ընտրել կառուցվածքային ստորաբաժանում</h3>' +
      '<p class="muted" style="margin:0 0 14px;font-size:12px">' +
      'Մենյուից առաջ ընտրեք բանակային կորպուսը, ապա ենթակա զորամասը։ ' +
      'Հաշվառման տվյալները և ֆայլերը պատկանում են ամբողջ կորպուսին (զորամասերը փոխկապակցված են)։ ' +
      'Օրենքները, կանոնադրությունները և ծրագրի մասին բաժինը նույնն են բոլոր կորպուսների համար։</p>';

    var html = '';
    if (step === 'code') {
      var corpsC = findCorps(selectedCorpsId) || findCorps(el.getAttribute('data-corps'));
      var unitC = findUnit(el.getAttribute('data-unit'));
      html = '<div style="text-align:center;margin:0 0 16px">' +
        '<div style="width:72px;height:72px;margin:0 auto 12px;border-radius:50%;background:#0b1a33;border:2px solid #c9a227;display:flex;align-items:center;justify-content:center;font-size:30px;line-height:1">🔒</div>' +
        '<h3 style="margin:0 0 4px;letter-spacing:.06em">Անվտանգություն</h3>' +
        '<p class="muted" style="margin:0;font-size:12px">Մուտքը թույլատրվում է միայն այս զորամասի կոդով</p>' +
        '</div>' +
        '<p style="margin:0 0 10px"><button type="button" id="kmOrgBackUnits" class="kmBackBtn">← Զորամաս</button></p>' +
        '<p style="margin:0 0 14px;padding:10px 12px;background:#f4f7fb;border-radius:8px;border:1px solid #d8e0ea">' +
        '<span class="muted" style="font-size:11px">Բանակային կորպուս</span><br><b>' + esc((corpsC && corpsC.name) || '') + '</b><br>' +
        '<span class="muted" style="font-size:11px">Զորամաս</span><br><b>' + esc((unitC && unitC.name) || '') + '</b></p>' +
        '<label for="kmOrgUnitCode" style="display:block;font-size:12px;margin:0 0 6px">Կոդ</label>' +
        '<input id="kmOrgUnitCode" type="password" autocomplete="off" spellcheck="false" placeholder="Մուտքագրեք կոդը" ' +
        'style="width:100%;box-sizing:border-box;padding:10px 12px;letter-spacing:.12em;margin:0 0 10px">' +
        '<button type="button" class="primary" id="kmOrgCodeGo" style="width:100%">Հաստատել</button>';
      html +=
        '<label for="kmOrgHubHost" style="display:block;font-size:12px;margin:12px 0 6px">Հաբ սերվերի IP</label>' +
        '<input id="kmOrgHubHost" type="text" autocomplete="off" spellcheck="false" placeholder="Hub IP:18094" value="" ' +
        'style="width:100%;box-sizing:border-box;padding:8px 12px;margin:0 0 4px">' +
        '<p class="muted" style="margin:0;font-size:11px">Մուտքագրեք ադմինի համակարգչի IP-ն, եթե ցանկում սխալ հասցե է։ Գրանցումը գնում է այս Hub-ին։</p>' +
        '<div id="kmOrgHubList"></div>';
    } else if (step === 'unit') {
      var corps = findCorps(selectedCorpsId) || findCorps(last.corpsId);
      var units = listUnits(corps && corps.id);
      html = head +
        '<p style="margin:0 0 10px"><button type="button" id="kmOrgBackCorps" class="kmBackBtn">← Ստորաբաժանում</button></p>' +
        '<p style="margin:0 0 10px"><b>' + esc((corps && corps.name) || '') + '</b></p>' +
        '<div id="kmOrgUnitList" style="display:flex;flex-direction:column;gap:8px;max-height:40vh;overflow:auto">';
      if (!units.length) {
        html += '<p class="muted">Այս բաժնում զորամաս չկա։ Ադմինիստրատորը կարող է ավելացնել Հաշվառում բաժնից։</p>';
      }
      units.forEach(function (u) {
        var hi = last.unitId === u.id;
        html += '<button type="button" class="kmOrgPickBtn' + (hi ? ' primary' : '') + '" data-unit="' + esc(u.id) + '" style="width:100%;text-align:left;padding:12px 14px">' +
          esc(u.name) + '</button>';
      });
      html += '</div>';
    } else {
      html = head + '<div id="kmOrgCorpsList" style="display:flex;flex-direction:column;gap:8px;max-height:48vh;overflow:auto">';
      corpsList.forEach(function (c) {
        var hi = last.corpsId === c.id;
        html += '<button type="button" class="kmOrgPickBtn' + (hi ? ' primary' : '') + '" data-corps="' + esc(c.id) + '" style="width:100%;text-align:left;padding:12px 14px">' +
          esc(c.name) + '</button>';
      });
      html += '</div>';
    }
    html += '<p id="kmOrgPickErr" style="color:#a43b3b;min-height:18px;margin:10px 0 0"></p>' +
      '<button type="button" id="kmOrgExit" style="width:100%;margin-top:8px">Ելք համակարգից</button>';
    var cardEl = el.querySelector('.kmOrgPickerCard');
    if (cardEl) {
      cardEl.style.border = step === 'code' ? '2px solid #c9a227' : '';
      cardEl.innerHTML = html;
    }
    if (step === 'code') {
      var inp = el.querySelector('#kmOrgUnitCode');
      if (inp) {
        try { inp.focus(); } catch (eF) {}
      }
      var saved = readSavedHubHost();
      if (saved) fillOrgHubInput(el, saved);
      refreshOrgHubFromNet(el, { ensure: true, scan: true }).catch(function () {});
    }
  }

  function bindPicker(wrap) {
    var card = wrap.querySelector('.kmOrgPickerCard');
    if (!card) return;
    var err = function (t) {
      var p = wrap.querySelector('#kmOrgPickErr');
      if (p) p.textContent = t || '';
    };
    card.onclick = function (ev) {
      var t = ev.target;
      if (!t) return;
      if (t.id === 'kmOrgExit') {
        if (typeof window.kmExitSystem === 'function') window.kmExitSystem();
        return;
      }
      if (t.id === 'kmOrgBackCorps') {
        renderPicker(wrap, 'corps', '');
        return;
      }
      if (t.id === 'kmOrgBackUnits') {
        renderPicker(wrap, 'unit', wrap.getAttribute('data-corps'));
        return;
      }
      if (t.id === 'kmOrgCodeGo') {
        submitUnitCode();
        return;
      }
      var hubPick = t.getAttribute && t.getAttribute('data-hub-pick');
      if (!hubPick && t.closest) {
        var hpEl = t.closest('[data-hub-pick]');
        if (hpEl) hubPick = hpEl.getAttribute('data-hub-pick');
      }
      if (hubPick) {
        pickOrgHub(hubPick);
        return;
      }
      var corpsId = t.getAttribute && t.getAttribute('data-corps');
      if (corpsId) {
        wrap.setAttribute('data-corps', corpsId);
        renderPicker(wrap, 'unit', corpsId);
        return;
      }
      var unitId = t.getAttribute && t.getAttribute('data-unit');
      if (unitId) {
        var corps = findCorps(wrap.getAttribute('data-corps'));
        var unit = findUnit(unitId);
        if (!corps || !unit) { err('Ընտրությունը անավարտ է'); return; }
        wrap.setAttribute('data-unit', unitId);
        renderPicker(wrap, 'code', corps.id);
      }
    };
    card.addEventListener('keydown', function (ev) {
      if (ev && ev.key === 'Enter' && ev.target && ev.target.id === 'kmOrgUnitCode') {
        ev.preventDefault();
        submitUnitCode();
      }
    });
    function pickOrgHub(url) {
      var parsed = parseHubHostPort(url);
      if (!parsed) { err('Սխալ Hub հասցե'); return; }
      var hostStr = formatHubHost(parsed);
      fillOrgHubInput(wrap, hostStr);
      err('');
      var lan = window.kmNative && window.kmNative.lanSync;
      var net = window.kmNative && window.kmNative.net;
      var prep = Promise.resolve();
      if (net && net.addPeer) prep = net.addPeer(hostStr).catch(function () { return null; });
      prep.then(function () {
        if (lan && lan.setConfig) {
          return lan.setConfig({
            role: 'client',
            serverUrl: hubHttpUrl(parsed),
            autoReconnect: true,
            realtimeSync: true
          });
        }
      }).then(function () {
        return refreshOrgHubFromNet(wrap, { ensure: true, preferIp: parsed.host });
      }).catch(function () {});
    }
    function submitUnitCode() {
      var corps = findCorps(wrap.getAttribute('data-corps'));
      var unit = findUnit(wrap.getAttribute('data-unit'));
      if (!corps || !unit) { err('Ընտրությունը անավարտ է'); return; }
      var inp = wrap.querySelector('#kmOrgUnitCode');
      var code = inp ? String(inp.value || '').trim() : '';
      if (!code) { err('Մուտքագրեք կոդը'); return; }
      var api = window.kmNative && window.kmNative.orgEntry;
      if (!api || typeof api.verify !== 'function') { err('Կոդի ստուգումը հասանելի է desktop KM-ում'); return; }
      err('');
      var btn = wrap.querySelector('#kmOrgCodeGo');
      if (btn) btn.disabled = true;
      var hubHost = wrap.querySelector('#kmOrgHubHost');
      var typed = hubHost ? String(hubHost.value || '').trim() : '';
      var prefill = hubHost ? String(hubHost.getAttribute('data-prefill') || '') : '';
      var userEdited = !!(typed && !sameHubHost(typed, prefill));
      var parsed = parseHubHostPort(typed);
      if (parsed) writeSavedHubHost(formatHubHost(parsed));
      err('Hub սերվեր է որոնվում…');
      var lan = window.kmNative && window.kmNative.lanSync;
      var net = window.kmNative && window.kmNative.net;
      var prep = Promise.resolve();
      if (userEdited && parsed && net && net.addPeer) {
        prep = net.addPeer(formatHubHost(parsed)).catch(function () { return null; });
        if (lan && lan.setConfig) {
          prep = prep.then(function () {
            return lan.setConfig({
              role: 'client',
              serverUrl: hubHttpUrl(parsed),
              autoReconnect: true,
              realtimeSync: true
            });
          });
        }
      }
      prep = prep.then(function () {
        return refreshOrgHubFromNet(wrap, {
          ensure: true,
          scan: true,
          preferIp: (userEdited && parsed) ? parsed.host : ''
        });
      });
      prep.then(function () {
        err('Սերվերից բեռնվում է զորամասի կոդը…');
        return api.verify({ code: code, corpsId: corps.id, unitId: unit.id });
      }).then(function (r) {
        if (btn) btn.disabled = false;
        if (r && r.ok) confirmPick(corps, unit);
        else err((r && r.error) || 'Սխալ կոդ');
      }).catch(function (e) {
        if (btn) btn.disabled = false;
        err((e && e.message) || 'Սխալ կոդ');
      });
    }
  }

  window.kmShowOrgPicker = function () {
    if (isSuperAdmin()) return;
    if (document.getElementById('kmLoginOverlay')) return;
    if (!window.kmRoleUnlocked) return;
    var existing = document.getElementById('kmOrgPickerOverlay');
    if (existing && window.kmOrgReady()) {
      existing.style.display = 'flex';
      return;
    }
    if (existing) existing.remove();
    ensureOrgStore();
    var wrap = document.createElement('div');
    wrap.id = 'kmOrgPickerOverlay';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:250000;background:rgba(15,23,42,.75);display:flex;align-items:center;justify-content:center;padding:20px';
    wrap.innerHTML = '<div class="kmOrgPickerCard" style="background:#fff;border-radius:12px;padding:24px;min-width:320px;max-width:480px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,.35);color:#172334"></div>';
    document.body.appendChild(wrap);
    wrap.setAttribute('data-corps', '');
    wrap.setAttribute('data-unit', '');
    renderPicker(wrap, 'corps', '');
    bindPicker(wrap);
  };

  window.kmEnsureOrgPicker = function () {
    if (!window.kmRoleUnlocked) return false;
    try {
      if (document.getElementById('kmLoginOverlay')) return false;
    } catch (e) {}
    function mountHomePick() {
      try {
        if (typeof window.kmMountAdminHomeOrgPicker === 'function') {
          window.kmMountAdminHomeOrgPicker();
          setTimeout(function () { try { window.kmMountAdminHomeOrgPicker(); } catch (e2) {} }, 200);
          setTimeout(function () { try { window.kmMountAdminHomeOrgPicker(); } catch (e3) {} }, 800);
        }
      } catch (eM) {}
    }
    if (isSuperAdmin() || isAdmin()) {
      closePicker();
      var restored = false;
      try { restored = !!window.kmRestoreAdminAccountingOrgView(); } catch (eR) { restored = false; }
      if (isSuperAdmin() && !restored) {
        if (typeof window.kmApplyCorpsSlice === 'function') window.kmApplyCorpsSlice('_super');
        applyBrandHint({ unitName: '', corpsName: 'Սուպեր ադմինիստրատոր' });
        try {
          var brandText = document.querySelector('.kmBrandText');
          if (brandText) {
            var user = String(window.kmAuthFullName || sessionStorage.getItem('km_auth_full_name') || '').trim() || 'Ադմինիստրատոր';
            brandText.textContent = user;
            brandText.title = user + ' · սուպեր ադմինիստրատոր';
            brandText.classList.add('kmBrandMenuLabel');
          }
        } catch (eB) {}
      }
      mountHomePick();
      /* Admins pick corps/unit on home; do not force modal overlay */
      if (isAdmin() || isSuperAdmin()) {
        var ctxA = null;
        try { ctxA = window.kmGetOrgContext(); } catch (eC) {}
        if (ctxA && ctxA.corpsId && ctxA.unitId) {
          try { applyBrandHint(ctxA); } catch (eH) {}
        }
        return false;
      }
    }
    var boundOrg = window.kmAuthUserOrg;
    if (!boundOrg) {
      try { boundOrg = JSON.parse(sessionStorage.getItem('km_auth_org') || 'null'); } catch (eBound) { boundOrg = null; }
    }
    if (boundOrg && boundOrg.corpsId && boundOrg.unitId) {
      if (typeof window.kmApplyBoundUserOrg === 'function' && window.kmApplyBoundUserOrg(boundOrg)) {
        return false;
      }
    }
    var ctx = window.kmGetOrgContext();
    if (ctx && ctx.corpsId && ctx.unitId && hasOrgEntryGate()) {
      if (typeof window.kmApplyOrgSlice === 'function') window.kmApplyOrgSlice(ctx.corpsId, ctx.unitId);
      applyBrandHint(ctx);
      return false;
    }
    try { sessionStorage.removeItem(SS_KEY); } catch (eS) {}
    try { sessionStorage.removeItem(GATE_KEY); } catch (eG) {}
    window.kmOrgContext = null;
    window.kmShowOrgPicker();
    return true;
  };

  /* KM_HOME_ORG_PICK_AFTER_ENSURE_V1 */
  (function wrapEnsureForHomePick() {
    function go() { try { if (typeof window.kmMountAdminHomeOrgPicker === 'function') window.kmMountAdminHomeOrgPicker(); } catch (e) {} }
    var fn = window.kmEnsureOrgPicker;
    if (typeof fn === 'function' && !fn.__kmHomeOrgPick) {
      window.kmEnsureOrgPicker = function () {
        var r = fn.apply(this, arguments);
        setTimeout(go, 0);
        setTimeout(go, 300);
        setTimeout(go, 1200);
        return r;
      };
      window.kmEnsureOrgPicker.__kmHomeOrgPick = true;
    }
    go();
  })();

  window.kmAddOrgUnit = addUnit;
  window.kmRemoveOrgUnit = removeUnit;
  window.kmRenameOrgUnit = renameUnit;
  window.kmAddOrgCorps = addCorps;
  window.kmRemoveOrgCorps = removeCorps;
  window.kmRenameOrgCorps = renameCorps;
  function openOrgArchive(/* corpsId, unitId */) {
    /* KM_ORG_ARCH_BTN_REMOVED_V1: corps-page Արխիվ button retired; use Հաշվառում → Զորամասի Արխիվ */
    notify('Զորամասի արխիվը բացեք Հաշվառում → Զորամասի Արխիվ բաժնից', 'warn');
  }

  window.kmOpenOrgCorpsArchive = function () {
    notify('Արխիվը բացվում է միայն զորամասի համար։ Բացեք կորպուսը և սեղմեք զորամասի Արխիվը։', 'warn');
  };
  window.kmOpenOrgUnitArchive = function (/* unitId */) {
    /* KM_ORG_ARCH_BTN_REMOVED_V1 */
    notify('Զորամասի արխիվը բացեք Հաշվառում → Զորամասի Արխիվ բաժնից', 'warn');
  };
  window.kmOpenOrgUnitKod = function (unitId) {
    if (!isSuperAdmin()) {
      notify('Կոդի ֆայլը տեղադրում է միայն սուպեր ադմինը', 'warn');
      return;
    }
    unitId = String(unitId || '').trim();
    if (!unitId) {
      notify('Ընտրեք զորամաս', 'warn');
      return;
    }
    var u = findUnit(unitId);
    if (!u || !u.corpsId) {
      notify('Զորամասը չգտնվեց', 'warn');
      return;
    }
    window.kmRenderOrgUnitKodPage(u.id);
  };
  window.kmRenderOrgUnitKodPage = async function (unitId) {
    if (!isSuperAdmin()) {
      notify('Կոդի ֆայլը տեղադրում է միայն սուպեր ադմինը', 'warn');
      return;
    }
    if (!requireOrgAdmin()) return;
    ensureOrgStore();
    var host = orgPageHost();
    if (!host) return;
    var u = findUnit(unitId);
    if (!u || !u.corpsId) {
      notify('Զորամասը չգտնվեց', 'warn');
      return;
    }
    var corps = findCorps(u.corpsId);
    if (corps) corpsPageSel = corps.id;
    var api = window.kmNative && window.kmNative.orgEntry;
    var st = { installed: false, name: '', count: 0 };
    if (api && typeof api.kodStatus === 'function') {
      try {
        var r = await api.kodStatus({
          adminToken: orgAdminToken(),
          corpsId: u.corpsId,
          unitId: u.id
        });
        if (r && r.ok) st = r;
      } catch (eS) {
        st.error = (eS && eS.message) || String(eS);
      }
    }
    var statusLine = st.installed
      ? ('Տեղադրված է՝ <b>' + esc(st.name || 'codes.txt') + '</b> · ' + esc(String(st.count || 0)) + ' կոդ')
      : 'txt ֆայլ դեռ տեղադրված չէ։ Առանց ֆայլի այս զորամաս մուտք չի լինի։';
    host.innerHTML =
      '<div class="card" id="kmOrgUnitKodPage">' +
      (typeof window.kmBackToolbar === 'function' ? window.kmBackToolbar('kmRenderOrgCorpsStructPage()') : '') +
      '<h3 style="margin:0 0 6px">Կոդ · ' + esc(u.name) + '</h3>' +
      '<p class="muted" style="margin:0 0 12px;font-size:13px">' +
      esc((corps && corps.name) || '') +
      '։ Այստեղ տեղադրվում է միայն այս զորամասի txt-ը։ Այլ զորամասի կոդեր այստեղ չեն գործում։</p>' +
      '<p style="margin:0 0 14px">' + statusLine + '</p>' +
      (st.error ? ('<p style="color:#a43">' + esc(st.error) + '</p>') : '') +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:0 0 10px">' +
      '<button type="button" class="primary" id="kmOrgKodPick">Տեղադրել txt</button>' +
      (st.installed ? '<button type="button" id="kmOrgKodClear">Հեռացնել ֆայլը</button>' : '') +
      '</div>' +
      '<p id="kmOrgKodErr" style="color:#a43;min-height:18px;margin:0"></p></div>';
    var err = function (m) {
      var p = host.querySelector('#kmOrgKodErr');
      if (p) p.textContent = m || '';
    };
    function bytesToUtf8(bytes) {
      if (bytes == null) return '';
      if (typeof bytes === 'string') return bytes;
      try {
        var u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes.data || bytes);
        if (typeof TextDecoder !== 'undefined') return new TextDecoder('utf-8').decode(u8);
      } catch (eD) {}
      return '';
    }
    orgBindClicks(host.querySelector('#kmOrgUnitKodPage'), {
      kmOrgKodPick: async function () {
        err('');
        var pick = window.kmNative && window.kmNative.file && window.kmNative.file.pickOpen;
        if (!pick) { err('Ֆայլի ընտրությունը հասանելի է desktop KM-ում'); return; }
        var f;
        try {
          f = await pick({
            title: 'Ընտրել զորամասի կոդերի txt',
            filters: [{ name: 'Text', extensions: ['txt'] }, { name: 'All', extensions: ['*'] }]
          });
        } catch (eP) {
          err((eP && eP.message) || String(eP));
          return;
        }
        if (!f || f.cancelled || !f.ok) return;
        var text = bytesToUtf8(f.bytes);
        if (!String(text || '').trim()) { err('Ֆայլը դատարկ է'); return; }
        if (!api || typeof api.kodSet !== 'function') { err('Պահպանումը հասանելի չէ'); return; }
        try {
          var saved = await api.kodSet({
            adminToken: orgAdminToken(),
            corpsId: u.corpsId,
            unitId: u.id,
            name: f.name || 'codes.txt',
            text: text
          });
          if (!saved || !saved.ok) {
            err((saved && saved.error) || 'Չպահպանվեց');
            return;
          }
          notify('Տեղադրվեց · ' + (saved.name || '') + ' · ' + (saved.count || 0) + ' կոդ', 'ok');
          window.kmRenderOrgUnitKodPage(u.id);
        } catch (eSave) {
          err((eSave && eSave.message) || String(eSave));
        }
      },
      kmOrgKodClear: async function () {
        if (!confirm('Հեռացնե՞լ այս զորամասի կոդերի ֆայլը։')) return;
        err('');
        if (!api || typeof api.kodClear !== 'function') { err('Հեռացումը հասանելի չէ'); return; }
        try {
          var clr = await api.kodClear({
            adminToken: orgAdminToken(),
            corpsId: u.corpsId,
            unitId: u.id
          });
          if (!clr || !clr.ok) {
            err((clr && clr.error) || 'Չհեռացվեց');
            return;
          }
          notify('Ֆայլը հեռացվեց', 'ok');
          window.kmRenderOrgUnitKodPage(u.id);
        } catch (eC) {
          err((eC && eC.message) || String(eC));
        }
      }
    });
  };
  window.kmCentralOrgId = CENTRAL_ID;
  window.kmOrgGroupName = function (id) {
    if (id === CENTRAL_ID) return CENTRAL_NAME;
    var c = findCorps(id);
    return (c && c.name) || '';
  };
  window.kmOrgUnitName = function (id) {
    var u = findUnit(id);
    return (u && u.name) || '';
  };

  function requireOrgAdmin() {
    if (isAdmin()) return true;
    notify('Միայն ադմինիստրատոր', 'warn');
    if (typeof window.kmOpenPage === 'function') window.kmOpenPage('accounting');
    return false;
  }

  function orgPageHost() {
    return document.getElementById('content');
  }

  var corpsPageSel = '';

  function orgAskName(title, current, onDone) {
    current = current || '';
    if (typeof window.kmOpenDialog === 'function') {
      window.kmOpenDialog(
        title,
        '<label class="kmDlgField"><span>Անուն</span><input id="kmOrgRenameInp" type="text" value="' +
          esc(current) + '" style="width:100%;padding:8px;margin-top:4px;box-sizing:border-box"></label>',
        function (o) {
          var inp = o.querySelector('#kmOrgRenameInp');
          var n = inp ? inp.value : '';
          var r = onDone(n);
          if (r && r.ok === false) throw new Error(r.error || 'Սխալ');
        },
        'Պահպանել'
      );
      setTimeout(function () {
        var inp = document.querySelector('#kmCoreDialog #kmOrgRenameInp');
        if (inp) {
          try { inp.focus(); inp.select(); } catch (eF) {}
        }
      }, 40);
      return;
    }
    var nn = window.prompt(title, current);
    if (nn == null) return;
    var rr = onDone(nn);
    if (rr && rr.ok === false) notify(rr.error, 'warn');
  }

  function orgBindClicks(root, handlers) {
    if (!root) return;
    root.onclick = function (ev) {
      var t = ev.target;
      if (!t) return;
      var btn = (t.closest && t.closest('button')) || t;
      if (!btn || btn.tagName !== 'BUTTON') return;
      var id;
      if (btn.id && handlers[btn.id]) {
        ev.preventDefault();
        handlers[btn.id](btn);
        return;
      }
      var keys = Object.keys(handlers);
      var i;
      for (i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (k.indexOf('data:') !== 0) continue;
        var attr = k.slice(5);
        id = btn.getAttribute(attr);
        if (id) {
          ev.preventDefault();
          ev.stopPropagation();
          handlers[k](id, btn);
          return;
        }
      }
    };
  }

  window.kmRenderOrgCorpsPage = function () {
    if (!requireOrgAdmin()) return;
    ensureOrgStore();
    var host = orgPageHost();
    if (!host) return;
    corpsPageSel = '';
    var corpsList = listCorps();
    var corpsRows = corpsList.map(function (c) {
      return '<tr>' +
        '<td><button type="button" class="primary" data-open-corps="' + esc(c.id) +
        '" style="width:100%;text-align:left;padding:10px 12px">' + esc(c.name) + '</button></td>' +
        '<td style="white-space:nowrap">' +
        '<button type="button" data-ren-corps="' + esc(c.id) + '">Վերանվանել</button> ' +
        '<button type="button" data-del-corps="' + esc(c.id) + '">Հեռացնել</button></td></tr>';
    }).join('') || '<tr><td colspan="2" class="muted">Կորպուս չկա</td></tr>';
    var nextOrd = nextCorpsOrd(corpsList);
    host.innerHTML =
      '<div class="card" id="kmOrgCorpsPage">' +
      (typeof window.kmBackToolbar === 'function' ? window.kmBackToolbar("(window.kmBackToPage||window.kmOpenPage)('accounting')") /* KM_BACK_AUDIT_V1 */ : '') +
      '<h3 class="kmLawsHubTitle" style="margin:0 0 6px">Բանակային կորպուսներ</h3>' +
      '<p class="kmLawsHubLead" style="margin:0 0 14px">Կորպուսները դասավորվում են 1–5 հերթականությամբ։ Ջնջելուց հետո նոր ավելացումը զբաղեցնում է ազատ համարը (օր. 2-րդ) և վերադարձնում նույն հաշվառման տվյալները։ Անվան վրա սեղմելով բացվում է կառուցվածքը՝ զորամասեր և սուպեր ադմինի <b>Կոդ</b> կոճակը։ Արխիվը՝ Հաշվառում → Զորամասի Արխիվ։</p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:0 0 10px">' +
      '<input id="kmOrgCorpsNew" type="text" placeholder="' + esc(hyOrdinalCorps(nextOrd)) + '" style="flex:1;min-width:180px;padding:8px">' +
      '<button type="button" class="primary" id="kmOrgCorpsAdd">Ավելացնել կորպուս</button></div>' +
      '<div class="gridwrap"><table class="grid"><thead><tr><th>Կորպուս</th><th></th></tr></thead><tbody>' +
      corpsRows + '</tbody></table></div>' +
      '<p id="kmOrgCorpsErr" style="color:#a43;min-height:18px;margin:10px 0 0"></p></div>';
    var err = function (m) {
      var p = host.querySelector('#kmOrgCorpsErr');
      if (p) p.textContent = m || '';
    };
    orgBindClicks(host.querySelector('#kmOrgCorpsPage'), {
      kmOrgCorpsAdd: function () {
        var inp = host.querySelector('#kmOrgCorpsNew');
        var r = addCorps(inp && inp.value);
        if (!r.ok) { err(r.error); return; }
        window.kmRenderOrgCorpsPage();
      },
      'data:data-open-corps': function (id) {
        corpsPageSel = id;
        window.kmRenderOrgCorpsStructPage();
      },
      'data:data-ren-corps': function (id) {
        var curC = findCorps(id);
        orgAskName('Վերանվանել կորպուսը', (curC && curC.name) || '', function (n) {
          var rr = renameCorps(id, n);
          if (rr && rr.ok) window.kmRenderOrgCorpsPage();
          return rr;
        });
      },
      'data:data-del-corps': function (id) {
        var cdel = findCorps(id);
        if (!confirm('Հեռացնե՞լ կորպուսը և նրա զորամասերը՝ ' + ((cdel && cdel.name) || '') + '։')) return;
        var rd = removeCorps(id);
        if (!rd.ok) { err(rd.error); return; }
        window.kmRenderOrgCorpsPage();
      }
    });
  };

  window.kmRenderOrgCorpsStructPage = async function () {
    if (!requireOrgAdmin()) return;
    injectOrgArchCss();
    ensureOrgStore();
    var host = orgPageHost();
    if (!host) return;
    var corps = findCorps(corpsPageSel);
    if (!corps || corps.id === CENTRAL_ID) {
      window.kmRenderOrgCorpsPage();
      return;
    }
    var units = listUnits(corps.id);
    var kodMap = {};
    if (isSuperAdmin()) {
      try {
        var api = window.kmNative && window.kmNative.orgEntry;
        if (api && typeof api.kodList === 'function') {
          var kr = await api.kodList({ adminToken: orgAdminToken() });
          kodMap = (kr && kr.map) || {};
        }
      } catch (eK) {}
    }
    var superAdm = isSuperAdmin();
    var unitRows = units.map(function (u) {
      var hasKod = !!(kodMap[String(corps.id) + '::' + String(u.id)]);
      var kodBtn = superAdm
        ? ('<button type="button" data-kod-unit="' + esc(u.id) + '">Կոդ' + (hasKod ? ' ✓' : '') + '</button> ')
        : '';
      return '<tr><td>' + esc(u.name) + '</td><td style="white-space:nowrap">' +
        kodBtn +
        '<button type="button" data-ren-unit="' + esc(u.id) + '">Վերանվանել</button> ' +
        '<button type="button" data-del-unit="' + esc(u.id) + '">Հեռացնել</button></td></tr>';
    }).join('') || '<tr><td colspan="2" class="muted">Ենթակա զորամաս չկա</td></tr>';
    host.innerHTML =
      '<div class="card" id="kmOrgCorpsStructPage">' +
      (typeof window.kmBackToolbar === 'function' ? window.kmBackToolbar("kmRenderOrgCorpsPage()") : '') +
      '<h3 style="margin:0 0 6px">' + esc(corps.name) + '</h3>' +
      '<p class="muted" style="margin:0 0 14px;font-size:13px">Այս կորպուսի կառուցվածքը՝ ենթակա զորամասեր։ Յուրաքանչյուր զորամասի արխիվը բացվում է <b>Հաշվառում → Զորամասի Արխիվ</b> բաժնից (ոչ այս էջից)։ Հաշվառման մյուս բաժինները կապված են այդ արխիվին · KM_ORG_ARCH_BTN_REMOVED_V1։ <b>Կոդ</b> բաժնում սուպեր ադմինը տեղադրում է այդ զորամասի txt ֆայլը — այլ զորամասի կոդեր չեն գործում։</p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:0 0 10px">' +
      '<input id="kmOrgUnitNew" type="text" placeholder="օր. 25836 զորամաս" style="flex:1;min-width:180px;padding:8px">' +
      '<button type="button" class="primary" id="kmOrgUnitAdd">Ավելացնել զորամաս</button></div>' +
      '<div class="gridwrap"><table class="grid"><thead><tr><th>Զորամաս</th><th></th></tr></thead><tbody>' +
      unitRows + '</tbody></table></div>' +
      '<p id="kmOrgCorpsErr" style="color:#a43;min-height:18px;margin:10px 0 0"></p></div>';
    var err = function (m) {
      var p = host.querySelector('#kmOrgCorpsErr');
      if (p) p.textContent = m || '';
    };
    orgBindClicks(host.querySelector('#kmOrgCorpsStructPage'), {
      kmOrgUnitAdd: function () {
        var uinp = host.querySelector('#kmOrgUnitNew');
        var ur = addUnit(corps.id, uinp && uinp.value);
        if (!ur.ok) { err(ur.error); return; }
        window.kmRenderOrgCorpsStructPage();
      },
      'data:data-kod-unit': function (id) {
        window.kmOpenOrgUnitKod(id);
      },
      'data:data-ren-unit': function (id) {
        var curU = findUnit(id);
        orgAskName('Վերանվանել զորամասը', (curU && curU.name) || '', function (n) {
          var rru = renameUnit(id, n);
          if (rru && rru.ok) window.kmRenderOrgCorpsStructPage();
          return rru;
        });
      },
      'data:data-del-unit': function (id) {
        var udel = findUnit(id);
        if (!confirm('Հեռացնե՞լ զորամասը՝ ' + ((udel && udel.name) || '') + '։')) return;
        var rdu = removeUnit(id);
        if (!rdu.ok) { err(rdu.error); return; }
        window.kmRenderOrgCorpsStructPage();
      }
    });
  };

  window.kmShowOrgUnitManager = function () {
    if (!isSuperAdmin()) {
      notify('Զորամաս ավելացնել/հեռացնել կարող է միայն սուպեր ադմինը', 'warn');
      return;
    }
    ensureOrgStore();
    var existing = document.getElementById('kmOrgUnitMgr');
    if (existing) existing.remove();
    var wrap = document.createElement('div');
    wrap.id = 'kmOrgUnitMgr';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:260000;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:20px';
    function draw() {
      var corpsList = listCorps();
      var sel = wrap.getAttribute('data-corps') || (corpsList[0] && corpsList[0].id) || '';
      wrap.setAttribute('data-corps', sel);
      var units = listUnits(sel);
      var opts = corpsList.map(function (c) {
        return '<option value="' + esc(c.id) + '"' + (c.id === sel ? ' selected' : '') + '>' + esc(c.name) + '</option>';
      }).join('');
      var rows = units.map(function (u) {
        return '<tr><td>' + esc(u.name) + '</td><td style="white-space:nowrap">' +
          '<button type="button" data-rename="' + esc(u.id) + '">Վերանվանել</button> ' +
          '<button type="button" data-del="' + esc(u.id) + '">Հեռացնել</button></td></tr>';
      }).join('') || '<tr><td colspan="2" class="muted">Զորամաս չկա</td></tr>';
      wrap.querySelector('.kmOrgPickerCard').innerHTML =
        '<h3 style="margin:0 0 8px">Զորամասեր</h3>' +
        '<p class="muted" style="margin:0 0 10px;font-size:12px">Ավելացնել և հեռացնել կարող է միայն սուպեր ադմինը։</p>' +
        '<label style="display:block;margin:0 0 10px">Կորպուս' +
        '<select id="kmOrgMgrCorps" style="width:100%;margin-top:4px;padding:8px">' + opts + '</select></label>' +
        '<div class="gridwrap" style="max-height:40vh;overflow:auto;margin-bottom:10px"><table class="grid"><thead><tr><th>Զորամաս</th><th></th></tr></thead><tbody>' +
        rows + '</tbody></table></div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">' +
        '<input id="kmOrgMgrNew" type="text" placeholder="օր. 25836 զորամաս" style="flex:1;min-width:140px;padding:8px">' +
        '<button type="button" class="primary" id="kmOrgMgrAdd">Ավելացնել զորամաս</button></div>' +
        '<p id="kmOrgMgrErr" style="color:#a43;min-height:18px;margin:0 0 8px"></p>' +
        '<button type="button" class="kmBackBtn" id="kmOrgMgrClose">' + ((typeof window.KM_BACK_LABEL === 'string' && window.KM_BACK_LABEL) || '← Հետ') + '</button>';
    }
    wrap.innerHTML = '<div class="kmOrgPickerCard" style="background:#fff;border-radius:12px;padding:24px;min-width:320px;max-width:560px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,.35);color:#172334"></div>';
    document.body.appendChild(wrap);
    draw();
    wrap.addEventListener('click', function (ev) {
      if (ev.target === wrap) wrap.remove();
    });
    wrap.addEventListener('change', function (ev) {
      if (ev.target && ev.target.id === 'kmOrgMgrCorps') {
        wrap.setAttribute('data-corps', ev.target.value || '');
        draw();
      }
    });
    wrap.addEventListener('click', function (ev) {
      var t = ev.target;
      if (!t) return;
      var err = function (m) {
        var p = wrap.querySelector('#kmOrgMgrErr');
        if (p) p.textContent = m || '';
      };
      if (t.id === 'kmOrgMgrClose') { wrap.remove(); return; }
      if (t.id === 'kmOrgMgrAdd') {
        var inp = wrap.querySelector('#kmOrgMgrNew');
        var r = addUnit(wrap.getAttribute('data-corps'), inp && inp.value);
        if (!r.ok) { err(r.error); return; }
        draw();
        return;
      }
      var rid = t.getAttribute && t.getAttribute('data-rename');
      if (rid) {
        var cur = findUnit(rid);
        orgAskName('Վերանվանել զորամասը', (cur && cur.name) || '', function (n) {
          var rr = renameUnit(rid, n);
          if (rr && rr.ok) draw();
          return rr;
        });
        return;
      }
      var did = t.getAttribute && t.getAttribute('data-del');
      if (did) {
        var u = findUnit(did);
        if (!confirm('Հեռացնե՞լ զորամասը՝ ' + ((u && u.name) || '') + '։')) return;
        var rd = removeUnit(did);
        if (!rd.ok) { err(rd.error); return; }
        draw();
      }
    });
  };

  try {
    var restored = readSessionCtx();
    if (restored) {
      window.kmOrgContext = restored;
      applyBrandHint(restored);
    }
  } catch (eR) {}

  window.kmRefreshOrgSeed = async function () {
    try {
      var api = window.kmNative && window.kmNative.orgEntry;
      if (!api || typeof api.seedGet !== 'function') return null;
      var s = await api.seedGet();
      if (!s || s.ok === false) return null;
      window.__kmOrgSeed = s;
      if (typeof db === 'undefined' || !db) return s;
      var before = '';
      try { before = JSON.stringify({ corps: (db.kmOrg && db.kmOrg.corps) || [], units: (db.kmOrg && db.kmOrg.units) || [] }); } catch (eB) {}
      ensureOrgStore();
      var after = '';
      try { after = JSON.stringify({ corps: (db.kmOrg && db.kmOrg.corps) || [], units: (db.kmOrg && db.kmOrg.units) || [] }); } catch (eA) {}
      if (dbReady && before !== after && ((s.units && s.units.length) || (s.corps && s.corps.length))) {
        persistOrgStore();
        if (typeof save === 'function') {
          try { await save(true); } catch (eSv) {}
        }
      }
      if (typeof window.kmRefreshOrgArchives === 'function') {
        try { await window.kmRefreshOrgArchives(); } catch (eAr) {}
      }
      return s;
    } catch (eSeed) {
      return null;
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { window.kmRefreshOrgSeed(); });
  } else {
    window.kmRefreshOrgSeed();
  }
})();
