/* KM system information page — admin only. Each tab loads and renders in isolation. */
(function () {
  'use strict';

  var TABS = [
    { id: 'usb', label: 'USB' },
    { id: 'internet', label: 'Ինտերնետ' },
    { id: 'wifi', label: 'WiFi' },
    { id: 'bluetooth', label: 'Bluetooth' },
    { id: 'computer', label: 'Համակարգ' },
  ];
  var CHANNEL = {
    usb: 'usbHistory',
    internet: 'internetHistory',
    wifi: 'wifiHistory',
    bluetooth: 'bluetoothHistory',
    computer: 'computerInfo'
  };
  var PAGE = 80;
  var PREF = 'km_sysinfo_prefs';
  var VIRT = /vEthernet|Hyper-V|VPN|Virtual|Loopback|Teredo|isatap|VMware|VirtualBox|Npcap|TAP-|Wintun|Bluetooth Network|Pseudo|Wi-Fi Direct|Microsoft Hosted/i;

  var currentTab = 'usb';
  var cached = {};
  var loadGen = {};
  var inflight = {};
  var query = {};
  var mode = {};
  var refreshedAt = {};
  var sortState = {};
  var shownN = {};
  var expanded = {};
  var usbKind = 'all';
  var searchAll = false;
  var notes = {};
  var snaps = [];
  var auditRows = [];
  var lastExportPath = '';
  var pdfMode = false;
  var histMenuOpen = false;
  var histBusy = false;
  var pdfBusy = false;
  var pdfCancel = false;
  var pageHost = null;
  var boundHost = null;
  var prefsReady = false;

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
  function errText(e) {
    var s = String((e && e.message) || e || '');
    s = s.replace(/^Error invoking remote method '[^']+':\s*/i, '');
    var parts = s.split(/\s*Error:\s*/);
    s = (parts[parts.length - 1] || s).trim();
    return s || 'Սխալ';
  }
  function isAdmin() {
    try {
      if (window.kmUserRole === 'admin') return true;
      if (typeof window.kmCanAdmin === 'function' && window.kmCanAdmin()) return true;
      if (sessionStorage.getItem('km_auth_mode') === 'admin') return true;
      if (sessionStorage.getItem('km_auth_role') === 'admin') return true;
    } catch (e) {}
    return false;
  }
  function api() {
    if (!window.kmNative || !window.kmNative.sysinfo) throw new Error('Համակարգի տեղեկությունը հասանելի է միայն KM desktop-ում');
    return window.kmNative.sysinfo;
  }
  function asArray(data) {
    if (data == null || data === '') return [];
    if (Array.isArray(data)) return data;
    if (typeof data === 'string') {
      try { return asArray(JSON.parse(data)); } catch (e) { return []; }
    }
    if (typeof data === 'object') return [data];
    return [];
  }
  function asObj(data) {
    if (!data || typeof data !== 'object') return {};
    if (Array.isArray(data)) return data[0] && typeof data[0] === 'object' && !Array.isArray(data[0]) ? data[0] : {};
    return data;
  }
  function cellVal(v) {
    if (v == null || v === '') return '\u2014';
    if (typeof v === 'object') {
      try { return JSON.stringify(v); } catch (e) { return String(v); }
    }
    return String(v);
  }
  function hostLive() {
    return !!(pageHost && pageHost.isConnected && document.getElementById('kmSysInfoHost'));
  }
  function contentEl() {
    if (!hostLive()) return null;
    return pageHost.querySelector('#kmSysInfoContent');
  }
  function loadPrefs() {
    if (prefsReady) return;
    prefsReady = true;
    try {
      var p = JSON.parse(localStorage.getItem(PREF) || '{}');
      if (p.tab && CHANNEL[p.tab]) currentTab = p.tab;
      if (p.query && typeof p.query === 'object') query = p.query;
      if (p.mode && typeof p.mode === 'object') mode = p.mode;
      if (p.usbKind) usbKind = p.usbKind;
      if (p.searchAll) searchAll = !!p.searchAll;
      if (p.sort && typeof p.sort === 'object') sortState = p.sort;
    } catch (e) {}
  }
  function savePrefs() {
    try {
      localStorage.setItem(PREF, JSON.stringify({
        tab: currentTab, query: query, mode: mode, usbKind: usbKind, searchAll: searchAll, sort: sortState
      }));
    } catch (e) {}
  }
  function fmtDate(s) {
    if (s == null || s === '') return '\u2014';
    var t = String(s).trim();
    if (!t) return '\u2014';
    var d = new Date(t.replace(' ', 'T'));
    if (!isNaN(d.getTime()) && d.getFullYear() > 1980 && d.getFullYear() < 2100) {
      try {
        return d.toLocaleString('hy-AM', {
          year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
        });
      } catch (e) {}
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 16).replace('T', ' ');
    return t;
  }
  function fmtUptime(sec) {
    sec = Math.floor(Number(sec) || 0);
    if (sec <= 0) return '\u2014';
    var d = Math.floor(sec / 86400); sec %= 86400;
    var h = Math.floor(sec / 3600); sec %= 3600;
    var m = Math.floor(sec / 60);
    return (d ? d + ' \u0585\u0580 ' : '') + h + ' \u056a ' + m + ' \u0580';
  }
  function graphLabel() {
    try {
      if (typeof window.kmFormalGraphLabel === 'function' && typeof window.kmCurrentFormalOwner === 'function') {
        return String(window.kmFormalGraphLabel(window.kmCurrentFormalOwner()) || '');
      }
    } catch (e) {}
    try { return String((window.db && window.db.schedule && window.db.schedule.name) || ''); } catch (e2) {}
    return '';
  }
  function hostName() {
    var c = cached.computer;
    if (c && !c.error) {
      if (c.os && c.os.Hostname) return String(c.os.Hostname);
      if (c.system && c.system.Name) return String(c.system.Name);
    }
    return '';
  }
  function kmVer() {
    var c = cached.computer;
    if (c && c.km && c.km.update) return String(c.km.update);
    try {
      if (window.KM_UPDATE) return String(window.KM_UPDATE);
    } catch (e) {}
    return '';
  }
  function kmProductVer() {
    var c = cached.computer;
    if (c && c.km && c.km.version) return String(c.km.version);
    try {
      if (window.KM_VERSION) return String(window.KM_VERSION);
    } catch (e) {}
    return '';
  }
  function exportBaseName() {
    var host = (hostName() || 'KM').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
    var d = new Date();
    var p = function (n) { return String(n).padStart(2, '0'); };
    return host + '_' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '_' + p(d.getHours()) + p(d.getMinutes());
  }
  function isPresent(d) { return !!(d && (d.Present === 1 || d.Present === true || d.Present === '1')); }
  function hay(d, tab) {
    var parts = [];
    Object.keys(d || {}).forEach(function (k) {
      var v = d[k];
      if (v == null || typeof v === 'object') return;
      parts.push(String(v));
    });
    var key = rowKey(tab || currentTab, d);
    if (notes[key]) parts.push(notes[key]);
    return parts.join(' ').toLowerCase();
  }
  function queryFor(tab) {
    if (searchAll) return String(query._all || query[currentTab] || '').trim().toLowerCase();
    return String(query[tab] || '').trim().toLowerCase();
  }
  function isStorage(d) {
    var k = String((d && d.Kind) || '').toLowerCase();
    return k === 'storage' || k === 'portable';
  }
  function isVirtualAdapter(n) {
    return VIRT.test(String((n && (n.Name || n.InterfaceAlias)) || ''));
  }
  function btKind(name) {
    var s = String(name || '').toLowerCase();
    if (/headphone|headset|airpod|earbuds|ականջ|հեռախոսակալ/.test(s)) return '\u0531\u056f\u0561\u0576\u057b\u0561\u056f\u0561\u056c';
    if (/mouse|մկնիկ/.test(s)) return '\u0544\u056f\u0576\u056b\u056f';
    if (/keyboard|ստեղն/.test(s)) return '\u054d\u057f\u0565\u0572\u0576\u0561\u0577\u0561\u0580';
    if (/phone|iphone|galaxy|pixel|հեռախոս/.test(s)) return '\u0540\u0565\u057c\u0561\u056d\u0578\u057d';
    if (/speaker|audio|sound|բարձրախոս/.test(s)) return '\u0532\u0561\u0580\u0571\u0580\u0561\u056d\u0578\u057d';
    return '\u0531\u0575\u056c';
  }
  function rowKey(tab, d) {
    d = d || {};
    if (tab === 'usb') return 'usb|' + String(d.Serial || d.FriendlyName || '').toUpperCase();
    if (tab === 'wifi') return 'wifi|' + String(d.name || '');
    if (tab === 'bluetooth') return 'bt|' + String(d.MAC || d.Name || '');
    if (tab === 'internet') return 'net|' + String(d.ProfileName || '');
    return tab;
  }
  function matchesFilter(d, tab) {
    if (pdfMode) return true;
    var q = queryFor(tab);
    if (q && hay(d, tab).indexOf(q) < 0) return false;
    var m = mode[tab] || 'all';
    if (m === 'now' && !isPresent(d)) return false;
    if (m === 'past' && isPresent(d)) return false;
    if (tab === 'usb' && usbKind === 'storage' && !isStorage(d)) return false;
    if (tab === 'usb' && usbKind === 'other' && isStorage(d)) return false;
    return true;
  }
  function sortKeyOf(d, tab, key) {
    if (key === 'status') return isPresent(d) ? 1 : 0;
    if (key === 'name') return String(d.FriendlyName || d.DeviceDesc || d.Name || d.name || d.ProfileName || '').toLowerCase();
    if (key === 'serial') return String(d.Serial || d.MAC || d.PSChildName || '').toLowerCase();
    if (key === 'first') return String(d.FirstSeen || d.DateCreated || '');
    if (key === 'last') return String(d.LastSeen || d.DateLastConnected || d.FirstSeen || '');
    if (key === 'kind') return String(d.Kind || d.Category || btKind(d.Name) || '');
    return String(d[key] || '');
  }
  function sortHist(rows, tab) {
    var st = sortState[tab] || { key: 'status', dir: -1 };
    var key = st.key || 'status';
    var dir = st.dir || -1;
    rows.sort(function (a, b) {
      var va = sortKeyOf(a, tab, key);
      var vb = sortKeyOf(b, tab, key);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return String((b && (b.LastSeen || b.DateLastConnected)) || '').localeCompare(String((a && (a.LastSeen || a.DateLastConnected)) || ''));
    });
    return rows;
  }
  function tabRows(tab) {
    var d = cached[tab];
    if (d == null || d.error) return [];
    if (tab === 'usb' || tab === 'wifi') return asArray(d);
    if (tab === 'bluetooth') return asArray(d.devices || d);
    if (tab === 'internet') return asArray(d.profiles);
    return [];
  }
  function filteredRows(tab) {
    return sortHist(tabRows(tab).filter(function (d) { return matchesFilter(d, tab); }), tab);
  }
  function emptyReason(tab, data) {
    if (data && data.error) {
      var e = String(data.error);
      if (/ժամանակը սպառեց|timeout/i.test(e)) {
        return 'Հավաքումը ժամանակը սպառեց (timeout)։ Սեղմեք Թարմացնել։ Win7-ում որոշ հարցումներ կարող են չաշխատել։';
      }
      if (/access|իրավունք|denied|Administrator/i.test(e)) {
        return 'Բավարար իրավունք չկա այս ցանկը կարդալու համար։ Գործարկեք KM-ը Windows Administrator-ով։';
      }
      return e;
    }
    if (tab === 'usb') return 'USB միացումների պատմություն չկա։ Windows-ը այս համակարգչում USBSTOR գրառում չի պահել, կամ հավաքումը չհասավ registry-ին։';
    if (tab === 'wifi') return 'WiFi պրոֆիլներ չկան։ Այս համակարգիչը երբևէ չի միացել WiFi-ի, կամ անլար ադապտեր չկա։';
    if (tab === 'internet') return 'Ցանցային պրոֆիլներ չկան։';
    if (tab === 'bluetooth') return 'Bluetooth սարքեր չկան, կամ Bluetooth անջատված է։';
    return 'Տվյալներ չկան։';
  }

  function injectCss() {
    var s = document.getElementById('km-sysinfo-css');
    if (!s) {
      s = document.createElement('style');
      s.id = 'km-sysinfo-css';
      document.head.appendChild(s);
    }
    s.textContent =
      '#kmSysInfoHost{min-height:240px}' +
      '.kmSysTabs{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}' +
      '.kmSysTab.sel{background:#17212b;color:#fff;border-color:#17212b}' +
      '.kmSysTab .kmSysTabN{opacity:.7;font-weight:600}' +
      '.kmSysToolbar{display:flex;flex-wrap:wrap;gap:7px;align-items:center;margin-bottom:8px}' +
      '.kmSysSearch{flex:1 1 220px;min-width:180px;padding:8px 10px;border:1px solid #c8d0d8;border-radius:7px}' +
      '.kmSysChips{display:inline-flex;flex-wrap:wrap;gap:4px}' +
      '.kmSysChips button{padding:6px 10px;font-size:12px}' +
      '.kmSysChips button.sel{background:#17212b;color:#fff;border-color:#17212b}' +
      '.kmSysSummary{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px}' +
      '.kmSysStat{padding:7px 11px;border:1px solid #e2e8ef;border-radius:8px;background:#f7fafc;font-size:13px}' +
      '.kmSysStat b{font-weight:700}' +
      '.kmSysBadge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700}' +
      '.kmSysBadgeOn{background:#e5f6ec;color:#146c3a}' +
      '.kmSysBadgeOff{background:#eef1f4;color:#5b6773}' +
      '.kmSysBadgeDup{background:#fde8e8;color:#9b1c1c;margin-left:6px}' +
      '.kmSysRowNow td{background:#f3fbf6}' +
      '.kmSysRowNew td{background:#fff4e5}' +
      '.kmSysCopy{border:0;background:transparent;padding:0;color:inherit;font:inherit;text-align:left;cursor:pointer;text-decoration:underline dotted}' +
      '.kmSysCopy:hover{color:#1a4d72}' +
      '.kmSysHero{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;margin:0 0 14px}' +
      '.kmSysHeroItem{padding:10px 12px;border:1px solid #e2e8ef;border-radius:10px;background:#fff}' +
      '.kmSysHeroItem span{display:block;font-size:11px;color:#6a7a8a;margin-bottom:4px}' +
      '.kmSysHeroItem b{font-size:14px;line-height:1.3}' +
      '.kmSysHeroWarn{border-color:#e2a14b;background:#fff8ee}' +
      '.kmSysHint{font-size:12px;color:#6a7a8a;margin:0 0 10px}' +
      '.kmSysTh{cursor:pointer;user-select:none}' +
      '.kmSysExpand td{background:#f7fafc;font-size:12px}' +
      '.kmSysNote{width:100%;max-width:420px;padding:6px 8px}' +
      '.kmSysAudit{font-size:12px;color:#5b6773;margin:14px 0 0}' +
      '.kmSysBanner{padding:8px 10px;border-radius:8px;background:#eef6ff;border:1px solid #c5d8ee;margin:0 0 10px}' +
      '#kmSysClearSlot{flex:1 1 100%;display:block;order:-1}' +
      '.kmSysHistWrap{display:flex;flex-wrap:wrap;align-items:center;gap:6px}' +
      '.kmSysHistMenu{display:none;flex-wrap:wrap;gap:6px;align-items:center}' +
      '.kmSysHistWrap.kmSysHistOpen .kmSysHistMenu{display:flex}' +
      '.kmSysHistMenu button{white-space:nowrap}' +
      '@media print{.kmSysToolbar,.kmSysTabs,.kmSysSummary,#kmSysPdfStatus,.kmSysExtra,.kmSysHistWrap{display:none!important}}';
  }

  function statusHtml(present) {
    return present
      ? '<span class="kmSysBadge kmSysBadgeOn">Միացված է</span>'
      : '<span class="kmSysBadge kmSysBadgeOff">Եղել է միացված</span>';
  }
  function histCard(intro, inner) {
    return '<div class="card"><p class="kmSysHint">' + esc(intro) + '</p>' + inner + '</div>';
  }
  function th(label, key, tab) {
    var st = sortState[tab] || {};
    var mark = st.key === key ? (st.dir < 0 ? ' \u25BC' : ' \u25B2') : '';
    return '<th class="kmSysTh" data-km-sys-sort="' + esc(key) + '">' + esc(label) + mark + '</th>';
  }
  function histTable(headersHtml, rowsHtml, emptyText) {
    if (!rowsHtml) return '<p class="muted">' + esc(emptyText || 'Տվյալներ չկան։') + '</p>';
    return '<div class="gridwrap"><table class="grid"><thead><tr>' + headersHtml + '</tr></thead><tbody>' + rowsHtml + '</tbody></table></div>';
  }
  function td(v) { return '<td style="padding:6px 8px">' + esc(v || '\u2014') + '</td>'; }
  function tdCopy(v) {
    v = String(v || '').trim();
    if (!v || v === '\u2014') return td(v);
    return '<td style="padding:6px 8px"><button type="button" class="kmSysCopy" data-km-sys-act="copy" data-km-copy="' + esc(v) + '" title="Պատճենել">' + esc(v) + '</button></td>';
  }
  function moreBtn(tab, total, shown) {
    if (pdfMode || shown >= total) return '';
    return '<p class="muted" style="margin:10px 0 0">Ցուցադրվում է ' + shown + ' / ' + total +
      ' <button type="button" data-km-sys-act="more">Ցույց տալ ևս</button></p>';
  }
  function expandHtml(tab, d) {
    var key = rowKey(tab, d);
    var note = notes[key] || '';
    var extra = '';
    if (tab === 'usb') {
      extra = '<div>Hardware ID՝ ' + esc(d.HardwareId || '\u2014') + '</div>' +
        '<div>VID/PID՝ ' + esc(d.VidPid || '\u2014') + '</div>' +
        '<div>Ամբողջական անուն՝ ' + esc(d.FriendlyName || d.DeviceDesc || '\u2014') + '</div>';
    } else {
      extra = '<div>Ամբողջական անուն՝ ' + esc(d.FriendlyName || d.Name || d.name || d.ProfileName || '\u2014') + '</div>';
    }
    return '<tr class="kmSysExpand"><td colspan="8">' + extra +
      '<div style="margin-top:8px">Նշում՝ <input class="kmSysNote" data-km-note="' + esc(key) + '" value="' + esc(note) + '" placeholder="օր. այս ֆլեշկան հերթապահին է">' +
      ' <button type="button" data-km-sys-act="savenote" data-km-key="' + esc(key) + '">Պահել նշումը</button>' +
      ' <button type="button" data-km-sys-act="copyrow" data-km-key="' + esc(key) + '">Պատճենել տողը</button></div></td></tr>';
  }
  function pageSlice(tab, rows) {
    var n = shownN[tab] || PAGE;
    if (pdfMode) return { rows: rows, shown: rows.length, total: rows.length };
    return { rows: rows.slice(0, n), shown: Math.min(n, rows.length), total: rows.length };
  }

  function renderUsbTable(data) {
    var all = asArray(data);
    if (!all.length) return '<div class="card"><p class="muted">' + esc(emptyReason('usb', data)) + '</p></div>';
    var rows = filteredRows('usb');
    if (!rows.length) return '<div class="card"><p class="muted">Որոնմանը համապատասխան USB սարք չկա։</p></div>';
    var counts = {};
    all.forEach(function (d) {
      var s = String((d && d.Serial) || '').trim().toUpperCase();
      if (s) counts[s] = (counts[s] || 0) + 1;
    });
    var slice = pageSlice('usb', rows);
    var body = '';
    for (var i = 0; i < slice.rows.length; i++) {
      var d = slice.rows[i] || {};
      var serial = String(d.Serial || '').trim();
      var dup = serial && counts[serial.toUpperCase()] > 1;
      var key = rowKey('usb', d);
      body += '<tr class="' + (isPresent(d) ? 'kmSysRowNow' : '') + '" data-km-sys-act="expand" data-km-key="' + esc(key) + '">' +
        td(d.FriendlyName || d.DeviceDesc) + td(d.Mfg) +
        tdCopy(serial || d.PSChildName) +
        td(fmtDate(d.FirstSeen)) + td(fmtDate(d.LastSeen || d.FirstSeen)) +
        '<td style="padding:6px 8px">' + statusHtml(isPresent(d)) +
        (dup ? '<span class="kmSysBadge kmSysBadgeDup">կրկնվող serial</span>' : '') +
        (isStorage(d) ? ' <span class="kmSysBadge">Կրիչ</span>' : '') +
        '</td></tr>';
      if (expanded.usb === key) body += expandHtml('usb', d);
    }
    return histCard('Համակարգչին երբևէ միացված USB սարքերի պատմություն։ Կանաչը հիմա միացված է։ Սեղմեք տողը՝ մանրամասների և նշման համար։',
      histTable(
        th('Անուն', 'name', 'usb') + th('Արտադրող', 'mfg', 'usb') + th('Serial', 'serial', 'usb') +
        th('Առաջին միացում', 'first', 'usb') + th('Վերջին միացում', 'last', 'usb') + th('Կարգավիճակ', 'status', 'usb'),
        body
      ) + moreBtn('usb', slice.total, slice.shown)
    );
  }

  function renderWifiTable(data) {
    var all = asArray(data);
    if (!all.length) return '<div class="card"><p class="muted">' + esc(emptyReason('wifi', data)) + '</p></div>';
    var rows = filteredRows('wifi');
    var cur = '';
    for (var c = 0; c < all.length; c++) if (isPresent(all[c])) cur = all[c].name || '';
    if (!rows.length) return '<div class="card"><p class="muted">Որոնմանը համապատասխան WiFi ցանց չկա։</p></div>';
    var slice = pageSlice('wifi', rows);
    var body = '';
    for (var i = 0; i < slice.rows.length; i++) {
      var d = slice.rows[i] || {};
      var key = rowKey('wifi', d);
      body += '<tr class="' + (isPresent(d) ? 'kmSysRowNow' : '') + '" data-km-sys-act="expand" data-km-key="' + esc(key) + '">' +
        td(d.name) + td(fmtDate(d.LastSeen)) +
        '<td style="padding:6px 8px">' + statusHtml(isPresent(d)) + '</td></tr>';
      if (expanded.wifi === key) body += expandHtml('wifi', d);
    }
    var banner = cur ? '<div class="kmSysBanner">Հիմա միացված WiFi՝ <b>' + esc(cur) + '</b></div>' : '';
    return histCard('Համակարգչին երբևէ միացված WiFi ցանցերի պատմություն։',
      banner + histTable(th('SSID', 'name', 'wifi') + th('Վերջին միացում', 'last', 'wifi') + th('Կարգավիճակ', 'status', 'wifi'), body) +
      moreBtn('wifi', slice.total, slice.shown)
    );
  }

  function renderInternetInfo(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return '<div class="card"><p class="muted">' + esc(emptyReason('internet', data)) + '</p></div>';
    }
    var profiles = filteredRows('internet');
    var adapters = asArray(data.adapters || data.ipConfig).filter(function (n) { return !isVirtualAdapter(n); });
    var inner = '';
    if (data.currentSsid) inner += '<div class="kmSysBanner">Ակտիվ WiFi պրոֆիլ՝ <b>' + esc(data.currentSsid) + '</b></div>';
    var slice = pageSlice('internet', profiles);
    var pbody = '';
    for (var i = 0; i < slice.rows.length; i++) {
      var p = slice.rows[i] || {};
      var key = rowKey('internet', p);
      pbody += '<tr class="' + (isPresent(p) ? 'kmSysRowNow' : '') + '" data-km-sys-act="expand" data-km-key="' + esc(key) + '">' +
        td(p.ProfileName) + td(p.Kind || p.Category) + td(fmtDate(p.DateLastConnected || p.DateCreated)) +
        '<td style="padding:6px 8px">' + statusHtml(isPresent(p)) + '</td></tr>';
      if (expanded.internet === key) pbody += expandHtml('internet', p);
    }
    inner += '<h3 style="margin:0 0 8px">Ցանցերի պատմություն</h3>' +
      histTable(th('Անուն', 'name', 'internet') + th('Տեսակ', 'kind', 'internet') + th('Վերջին միացում', 'last', 'internet') + th('Կարգավիճակ', 'status', 'internet'),
        pbody, asArray(data.profiles).length ? 'Որոնմանը համապատասխան ցանց չկա։' : emptyReason('internet', data)) +
      moreBtn('internet', slice.total, slice.shown);
    var abody = '';
    for (var a = 0; a < adapters.length && a < 80; a++) {
      var n = adapters[a] || {};
      abody += '<tr>' + td(n.Name || n.InterfaceAlias) + tdCopy(n.IPAddress) + tdCopy(n.MAC) + td(n.Gateway || n.DNS) + '</tr>';
    }
    inner += '<h3 style="margin:16px 0 8px">Այժմյան հասցեներ</h3>' +
      histTable('<th>Ադապտեր</th><th>IP</th><th>MAC</th><th>Gateway / DNS</th>', abody, 'Ակտիվ հասցեներ չկան (վիրտուալ ադապտերները թաքցված են)։');
    return histCard('Համակարգչին երբևէ միացված ցանցերի պատմություն և այժմյան ինտերնետ հասցեները։', inner);
  }

  function renderBluetoothTable(data) {
    var devices = [];
    if (Array.isArray(data)) devices = data;
    else if (data && typeof data === 'object') devices = asArray(data.devices);
    if (!devices.length) return '<div class="card"><p class="muted">' + esc(emptyReason('bluetooth', data)) + '</p></div>';
    var rows = filteredRows('bluetooth');
    if (!rows.length) return '<div class="card"><p class="muted">Որոնմանը համապատասխան Bluetooth սարք չկա։</p></div>';
    var slice = pageSlice('bluetooth', rows);
    var body = '';
    for (var i = 0; i < slice.rows.length; i++) {
      var d = slice.rows[i] || {};
      var key = rowKey('bluetooth', d);
      body += '<tr class="' + (isPresent(d) ? 'kmSysRowNow' : '') + '" data-km-sys-act="expand" data-km-key="' + esc(key) + '">' +
        td(d.Name) + td(btKind(d.Name)) + tdCopy(d.MAC || d.PSChildName) + td(fmtDate(d.LastSeen)) +
        '<td style="padding:6px 8px">' + statusHtml(isPresent(d)) + '</td></tr>';
      if (expanded.bluetooth === key) body += expandHtml('bluetooth', d);
    }
    return histCard('Համակարգչին երբևէ միացված Bluetooth սարքերի պատմություն։',
      histTable(th('Անուն', 'name', 'bluetooth') + th('Տեսակ', 'kind', 'bluetooth') + th('MAC', 'serial', 'bluetooth') +
        th('Վերջին միացում', 'last', 'bluetooth') + th('Կարգավիճակ', 'status', 'bluetooth'), body) +
      moreBtn('bluetooth', slice.total, slice.shown)
    );
  }

  var COMP_LABELS = {
    Name: 'Անուն', Manufacturer: 'Արտադրող', Model: 'Մոդել', RAM_GB: 'RAM (GB)', Caption: 'ՕՀ',
    Version: 'Տարբերակ', Build: 'Build', Arch: 'Ճարտարապետություն', InstallDate: 'Տեղադրման օր',
    Hostname: 'Հոսթ', Platform: 'Հարթակ', Release: 'Թողարկում', Cores: 'Միջուկներ', Threads: 'Հոսքեր',
    MHz: 'Հաճախականություն (MHz)', DriverVersion: 'Դրայվեր', DeviceID: 'Սկավառակ', Size_GB: 'Ծավալ (GB)',
    Free_GB: 'Ազատ (GB)', Total: 'Ընդամենը', Free: 'Ազատ', Product: 'Մոդել', SerialNumber: 'Serial',
    ReleaseDate: 'Ամսաթիվ', Primary: 'Չափս', Scale: 'Մասշտաբ', Displays: 'Էկրաններ', Address: 'Հասցե',
    MAC: 'MAC', Family: 'Տեսակ', SMBIOSBIOSVersion: 'BIOS', Domain: 'Դոմեն', Workgroup: 'Workgroup',
    UserName: 'Windows օգտատեր', PartOfDomain: 'Դոմենում է', LastBoot: 'Վերջին միացում'
  };
  var COMP_MAIN = { Name: 1, Manufacturer: 1, Model: 1, RAM_GB: 1, Caption: 1, Version: 1, Hostname: 1, Cores: 1, Threads: 1, Total: 1, Free: 1, DeviceID: 1, Size_GB: 1, Free_GB: 1, Domain: 1, UserName: 1, LastBoot: 1, Product: 1 };

  function diskWarn(disk) {
    var free = Number(disk && disk.Free_GB);
    var size = Number(disk && disk.Size_GB);
    if (!(free >= 0) || !(size > 0)) return false;
    return free < 5 || (free / size) < 0.1;
  }

  function renderComputerInfo(data) {
    if (!data) return '<div class="card"><p class="muted">Բեռնվում է…</p></div>';
    var sys = asObj(data.system);
    var osInfo = asObj(data.os);
    var cpu0 = asArray(data.cpu)[0] || asObj(data.cpu);
    var ram = asObj(data.ram);
    var disks = asArray(data.disks);
    var folder = asObj(data.dataFolder);
    var heroItems =
      '<div class="kmSysHeroItem"><span>Համակարգիչ</span><b>' + esc(sys.Name || osInfo.Hostname || '\u2014') + '</b></div>' +
      '<div class="kmSysHeroItem"><span>ՕՀ</span><b>' + esc(osInfo.Caption || osInfo.Release || '\u2014') + '</b></div>' +
      '<div class="kmSysHeroItem"><span>Պրոցեսոր</span><b>' + esc(cpu0.Name || '\u2014') + '</b></div>' +
      '<div class="kmSysHeroItem"><span>RAM</span><b>' + esc(ram.Total || (sys.RAM_GB ? sys.RAM_GB + ' GB' : '\u2014')) + '</b></div>' +
      '<div class="kmSysHeroItem"><span>KM տարբերակ</span><b>' + esc((data.km && data.km.version) || kmProductVer() || '\u2014') + '</b></div>' +
      '<div class="kmSysHeroItem"><span>KM թարմացում</span><b>' + esc((data.km && data.km.update) || kmVer() || '\u2014') + '</b></div>' +
      '<div class="kmSysHeroItem"><span>Գրաֆիկ</span><b>' + esc(graphLabel() || '\u2014') + '</b></div>' +
      '<div class="kmSysHeroItem"><span>Windows օգտատեր</span><b>' + esc(data.windowsUser || sys.UserName || '\u2014') + '</b></div>' +
      '<div class="kmSysHeroItem"><span>Աշխատում է</span><b>' + esc(fmtUptime(data.uptimeSec)) + '</b></div>' +
      '<div class="kmSysHeroItem"><span>Դոմեն / խումբ</span><b>' + esc(sys.PartOfDomain === 'True' || sys.PartOfDomain === true ? (sys.Domain || '\u2014') : (sys.Workgroup || sys.Domain || '\u2014')) + '</b></div>';
    for (var w = 0; w < disks.length; w++) {
      if (diskWarn(disks[w])) {
        heroItems += '<div class="kmSysHeroItem kmSysHeroWarn"><span>Սկավառակ ' + esc(disks[w].DeviceID || '') + '</span><b>Ազատ է ' +
          esc(String(disks[w].Free_GB)) + ' GB / ' + esc(String(disks[w].Size_GB)) + ' GB — տեղը քիչ է</b></div>';
      } else if (disks[w].DeviceID) {
        heroItems += '<div class="kmSysHeroItem"><span>Սկավառակ ' + esc(disks[w].DeviceID) + '</span><b>' +
          esc(String(disks[w].Free_GB || '\u2014') + ' / ' + String(disks[w].Size_GB || '\u2014') + ' GB ազատ') + '</b></div>';
      }
    }
    var hero = '<div class="kmSysHero">' + heroItems + '</div>';
    if (data.quick) {
      return '<div class="card">' + hero + '<p class="muted">Ամփոփումը պատրաստ է։ Մանրամասները հավաքվում են…</p></div>';
    }
    var h = '<p class="kmSysHint">Այս համակարգչի հիմնական տվյալները վերևում են։ KM տվյալների պանակ՝ <b>' +
      esc(folder.path || '\u2014') + '</b>' + (folder.sizeText ? ' · ' + esc(folder.sizeText) : '') +
      (folder.files ? ' · ' + folder.files + ' ֆայլ' : '') +
      (folder.skipped ? ' (մոտավոր)' : '') + '։</p>' + hero;
    function kvTable(items, mainOnly) {
      items = asObj(items);
      var keys = Object.keys(items).filter(function (k) {
        if (!k || k.charAt(0) === '_' || k === 'PSComputerName' || k === 'CimClass' || k === 'CimInstanceProperties' || k === 'CimSystemProperties') return false;
        if (mainOnly === true && !COMP_MAIN[k]) return false;
        if (mainOnly === false && COMP_MAIN[k]) return false;
        var v = items[k];
        return !(v == null || v === '');
      });
      if (!keys.length) return '';
      var html = '<div class="gridwrap"><table class="grid"><tbody>';
      for (var i = 0; i < keys.length; i++) {
        html += '<tr>' + td(COMP_LABELS[keys[i]] || keys[i]) + td(cellVal(items[keys[i]])) + '</tr>';
      }
      return html + '</tbody></table></div>';
    }
    function section(title, items) {
      var main = kvTable(items, true);
      var extra = kvTable(items, false);
      if (!main && !extra) return;
      h += '<h3 style="margin-top:14px">' + esc(title) + '</h3>' + (main || extra);
      if (main && extra) {
        h += '<details><summary>Մանրամասն</summary>' + extra + '</details>';
      }
    }
    if (data.system) section('Համակարգ', data.system);
    if (data.os) section('ՕՀ', data.os);
    if (data.cpu) {
      var cpus = asArray(data.cpu);
      if (cpus.length && typeof cpus[0] === 'object' && (cpus[0].Name || cpus.length > 1)) {
        for (var c = 0; c < cpus.length; c++) section('CPU ' + (c + 1), cpus[c]);
      } else section('CPU', data.cpu);
    }
    if (data.ram) section('RAM', data.ram);
    if (data.gpu && data.gpu.length) for (var g = 0; g < data.gpu.length; g++) section('GPU ' + (g + 1), data.gpu[g]);
    if (disks.length) for (var d = 0; d < disks.length; d++) section('Սկավառակ ' + (d + 1), disks[d]);
    if (data.network && data.network.length) {
      var nets = asArray(data.network).filter(function (n) { return !isVirtualAdapter(n); });
      for (var n = 0; n < nets.length; n++) section('Ցանց ' + (n + 1), nets[n]);
    }
    h += '<details class="kmSysExtra" style="margin-top:12px"><summary>BIOS, մայր սալիկ, էկրան, .NET</summary>';
    var saved = h;
    h = '';
    if (data.bios) section('BIOS', data.bios);
    if (data.motherboard) section('Մայր սալիկ', data.motherboard);
    if (data.screen) section('Էկրան', data.screen);
    if (data.dotnet) section('.NET', typeof data.dotnet === 'object' ? data.dotnet : { '\u054f\u0561\u0580\u0562\u0565\u0580\u0561\u056f\u0576\u0565\u0580': data.dotnet });
    var details = h;
    h = saved + details + '</details>';
    return '<div class="card">' + h + '</div>';
  }

  function renderTabBody(tab) {
    try {
      var d = cached[tab];
      if (d === undefined) return '<div class="card"><p class="muted">Բեռնվում է…</p></div>';
      if (d && d.error) return '<div class="card"><p class="danger">' + esc(emptyReason(tab, d)) + '</p></div>';
      switch (tab) {
        case 'usb': return renderUsbTable(d);
        case 'internet': return renderInternetInfo(d);
        case 'wifi': return renderWifiTable(d);
        case 'bluetooth': return renderBluetoothTable(d);
        case 'computer': return renderComputerInfo(d);
        default: return '';
      }
    } catch (e) {
      return '<div class="card"><p class="danger">' + esc(errText(e)) + '</p></div>';
    }
  }

  function tabCountLabel(id) {
    var d = cached[id];
    if (d === undefined || (d && d.error)) return '';
    var n = filteredRows(id).length;
    var all = tabRows(id).length;
    if (!all) return '';
    if (n !== all) return ' <span class="kmSysTabN">(' + n + '/' + all + ')</span>';
    return ' <span class="kmSysTabN">(' + n + ')</span>';
  }

  function searchHitsHtml() {
    if (!searchAll) return '';
    var q = queryFor(currentTab);
    if (!q) return '';
    var bits = [];
    for (var i = 0; i < TABS.length; i++) {
      var id = TABS[i].id;
      if (id === 'computer') continue;
      if (cached[id] === undefined) bits.push(esc(TABS[i].label) + '…');
      else bits.push(esc(TABS[i].label) + ': ' + filteredRows(id).length);
    }
    return '<div class="kmSysBanner">Որոնում բոլոր ներդիրներում՝ ' + bits.join(' · ') + '</div>';
  }

  function extraPanelHtml() {
    var opts = snaps.map(function (s) {
      return '<option value="' + esc(s.id) + '">' + esc(fmtDate(s.at) + ' · ' + (s.host || '') + (s.graph ? ' · ' + s.graph : '')) + '</option>';
    }).join('');
    var audit = '';
    if (auditRows.length) {
      audit = '<div class="kmSysAudit"><b>Վերջին արտահանումներ՝</b> ' +
        auditRows.slice(0, 5).map(function (x) {
          return esc(fmtDate(x.ts) + ' · ' + (x.action || '') + ' · ' + (x.detail || '') + (x.role ? ' · ' + x.role : ''));
        }).join('<br>') + '</div>';
    }
    return '<div class="card kmSysExtra" style="margin-top:12px">' +
      '<h3 style="margin-top:0">KM պատճեններ</h3>' +
      '<p class="muted">Պահում է այս համակարգչի այժմյան USB/WiFi/Bluetooth/ցանց/համակարգ վիճակը։ Հետո կարելի է համեմատել երկու օր։</p>' +
      '<div class="toolbar">' +
        '<button type="button" data-km-sys-act="snap">Պահել այս համակարգչի վիճակը</button>' +
        '<select id="kmSysSnapA"><option value="">Պատճեն A</option>' + opts + '</select>' +
        '<select id="kmSysSnapB"><option value="">Պատճեն B</option>' + opts + '</select>' +
        '<button type="button" data-km-sys-act="compare">Համեմատել</button>' +
        '<button type="button" data-km-sys-act="formal">Լցնել Formal ձևանմուշ</button>' +
      '</div>' +
      '<div id="kmSysCompare"></div>' + audit +
    '</div>';
  }

  function paintChrome() {
    if (!hostLive()) return;
    var search = pageHost.querySelector('[data-km-sys-search]');
    var chips = pageHost.querySelector('#kmSysChips');
    var usb = pageHost.querySelector('#kmSysUsbKind');
    var sum = pageHost.querySelector('#kmSysSummary');
    var clearSlot = pageHost.querySelector('#kmSysClearSlot');
    var isComp = currentTab === 'computer';
    if (search) {
      search.style.display = isComp ? 'none' : '';
      if (document.activeElement !== search) search.value = searchAll ? (query._all || '') : (query[currentTab] || '');
    }
    var allBtn = pageHost.querySelector('[data-km-sys-act="searchall"]');
    if (allBtn) allBtn.classList.toggle('sel', searchAll);
    if (chips) {
      chips.style.display = isComp ? 'none' : 'inline-flex';
      var m = mode[currentTab] || 'all';
      var btns = chips.querySelectorAll('[data-km-sys-mode]');
      for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('sel', btns[i].getAttribute('data-km-sys-mode') === m);
    }
    if (usb) {
      usb.style.display = currentTab === 'usb' ? 'inline-flex' : 'none';
      var kb = usb.querySelectorAll('[data-km-sys-kind]');
      for (var k = 0; k < kb.length; k++) kb[k].classList.toggle('sel', kb[k].getAttribute('data-km-sys-kind') === usbKind);
    }
    if (clearSlot) {
      clearSlot.innerHTML =
        '<div class="kmSysHistWrap' + (histMenuOpen ? ' kmSysHistOpen' : '') + '">' +
          '<button type="button" class="primary" data-km-sys-act="histmenu"' + (histBusy ? ' disabled' : '') + '>Մաքրել պատմությունը</button>' +
          '<span class="kmSysHistMenu">' +
            '<button type="button" class="danger" data-km-sys-act="clearusb"' + (histBusy ? ' disabled' : '') + '>մաքրել USB պատմությունը</button>' +
            '<button type="button" class="danger" data-km-sys-act="clearinternet"' + (histBusy ? ' disabled' : '') + '>մաքրել internet պատմությունը</button>' +
            '<button type="button" class="danger" data-km-sys-act="clearwifi"' + (histBusy ? ' disabled' : '') + '>մաքրել wifi պատմությունը</button>' +
            '<button type="button" class="danger" data-km-sys-act="clearbluetooth"' + (histBusy ? ' disabled' : '') + '>մաքրել Bluetooth պատմությունը</button>' +
          '</span>' +
        '</div>';
    }
    var cancel = pageHost.querySelector('[data-km-sys-act="pdfcancel"]');
    if (cancel) cancel.style.display = pdfBusy ? '' : 'none';
    if (sum) {
      if (isComp) {
        var c = cached.computer;
        sum.innerHTML = c && c.quick
          ? '<span class="kmSysStat">Ամփոփում պատրաստ է, մանրամասները հավաքվում են…</span>'
          : (refreshedAt.computer ? '<span class="kmSysStat">Թարմացվել է <b>' + esc(refreshedAt.computer) + '</b></span>' : '');
      } else {
        var rows = tabRows(currentTab);
        var now = 0;
        for (var r = 0; r < rows.length; r++) if (isPresent(rows[r])) now++;
        var shown = filteredRows(currentTab).length;
        sum.innerHTML =
          '<span class="kmSysStat">Ընդամենը <b>' + rows.length + '</b></span>' +
          '<span class="kmSysStat">Հիմա միացված <b>' + now + '</b></span>' +
          (shown !== rows.length ? '<span class="kmSysStat">Ցուցադրվում է <b>' + shown + '</b></span>' : '') +
          (refreshedAt[currentTab] ? '<span class="kmSysStat">Թարմացվել է <b>' + esc(refreshedAt[currentTab]) + '</b></span>' : '');
      }
    }
  }

  function paintTabs() {
    if (!hostLive()) return;
    var buttons = pageHost.querySelectorAll('[data-km-sys-tab]');
    for (var i = 0; i < buttons.length; i++) {
      var id = buttons[i].getAttribute('data-km-sys-tab');
      var meta = TABS.filter(function (t) { return t.id === id; })[0];
      buttons[i].innerHTML = esc((meta && meta.label) || id) + tabCountLabel(id);
      if (id === currentTab) buttons[i].classList.add('sel');
      else buttons[i].classList.remove('sel');
    }
    try { pageHost.setAttribute('data-km-sys-current', currentTab); } catch (e) {}
    paintChrome();
    i18nRefresh();
  }

  function showPanels() {
    if (!hostLive()) return;
    var root = contentEl();
    if (!root) return;
    var all = root.querySelectorAll('[data-km-sys-panel]');
    for (var i = 0; i < all.length; i++) {
      all[i].style.display = all[i].getAttribute('data-km-sys-panel') === currentTab ? 'block' : 'none';
    }
  }

  function panelEl(tab) {
    var root = contentEl();
    if (!root) return null;
    var panel = root.querySelector('[data-km-sys-panel="' + tab + '"]');
    if (panel) return panel;
    panel = document.createElement('div');
    panel.className = 'kmSysPanel';
    panel.setAttribute('data-km-sys-panel', tab);
    panel.style.display = tab === currentTab ? 'block' : 'none';
    root.appendChild(panel);
    return panel;
  }

  function i18nRefresh() {
    if (typeof window.kmApplyLanguageTo === 'function' && pageHost) {
      try { window.kmApplyLanguageTo(pageHost); } catch (e) {}
    } else if (typeof window.kmApplyLanguage === 'function') {
      try { window.kmApplyLanguage(); } catch (e) {}
    }
  }

  function paintContent(tab) {
    if (!hostLive()) return;
    tab = tab || currentTab;
    if (!CHANNEL[tab]) return;
    var panel = panelEl(tab);
    if (!panel) return;
    try { panel.innerHTML = searchHitsHtml() + renderTabBody(tab); }
    catch (e) { panel.innerHTML = '<div class="card"><p class="danger">' + esc(errText(e)) + '</p></div>'; }
    var extra = pageHost.querySelector('#kmSysExtraHost');
    if (extra) extra.innerHTML = extraPanelHtml();
    showPanels();
    paintTabs();
    i18nRefresh();
  }

  function shellHtml() {
    var i, tabs = '<div class="tabs kmSysTabs" style="margin-bottom:10px">';
    for (i = 0; i < TABS.length; i++) {
      var t = TABS[i];
      tabs += '<button type="button" class="tab kmSysTab' + (currentTab === t.id ? ' sel' : '') + '" data-km-sys-tab="' + t.id + '">' + esc(t.label) + '</button>';
    }
    tabs += '</div>';
    var panels = '';
    for (i = 0; i < TABS.length; i++) {
      var id = TABS[i].id;
      var body = '';
      try { body = renderTabBody(id); }
      catch (e) { body = '<div class="card"><p class="danger">' + esc(errText(e)) + '</p></div>'; }
      panels += '<div class="kmSysPanel" data-km-sys-panel="' + id + '" style="display:' + (id === currentTab ? 'block' : 'none') + '">' +
        body + '</div>';
    }
    var histBtns =
      '<span id="kmSysClearSlot">' +
        '<div class="kmSysHistWrap' + (histMenuOpen ? ' kmSysHistOpen' : '') + '">' +
          '<button type="button" class="primary" data-km-sys-act="histmenu">Մաքրել պատմությունը</button>' +
          '<span class="kmSysHistMenu">' +
            '<button type="button" class="danger" data-km-sys-act="clearusb">մաքրել USB պատմությունը</button>' +
            '<button type="button" class="danger" data-km-sys-act="clearinternet">մաքրել internet պատմությունը</button>' +
            '<button type="button" class="danger" data-km-sys-act="clearwifi">մաքրել wifi պատմությունը</button>' +
            '<button type="button" class="danger" data-km-sys-act="clearbluetooth">մաքրել Bluetooth պատմությունը</button>' +
          '</span>' +
        '</div>' +
      '</span>';
    return tabs +
      (typeof window.kmBackToolbar === 'function' ? window.kmBackToolbar(typeof window.kmContextBackOnclick === 'function' ? window.kmContextBackOnclick() : 'kmSysSettingsBack()') : '') +
      '<div class="toolbar kmSysToolbar">' +
        histBtns +
        '<input type="search" class="kmSysSearch" data-km-sys-search placeholder="Որոնել անուն, serial, MAC, SSID…">' +
        '<button type="button" data-km-sys-act="searchall">Բոլոր ներդիրներում</button>' +
        '<span class="kmSysChips" id="kmSysChips">' +
          '<button type="button" data-km-sys-mode="all" class="sel">Բոլորը</button>' +
          '<button type="button" data-km-sys-mode="now">Հիմա միացված</button>' +
          '<button type="button" data-km-sys-mode="past">Եղել է միացված</button>' +
        '</span>' +
        '<span class="kmSysChips" id="kmSysUsbKind">' +
          '<button type="button" data-km-sys-kind="all" class="sel">Բոլոր USB</button>' +
          '<button type="button" data-km-sys-kind="storage">Միայն կրիչներ</button>' +
          '<button type="button" data-km-sys-kind="other">Այլ սարքեր</button>' +
        '</span>' +
        '<button type="button" data-km-sys-act="refresh">\u21BB Թարմացնել</button>' +
        '<button type="button" class="primary" data-km-sys-act="pdfthis">Հանել այս ներդիրը</button>' +
        '<button type="button" data-km-sys-act="pdfall">Հանել բոլորը PDF</button>' +
        '<button type="button" data-km-sys-act="pdfcancel" style="display:none">Չեղարկել</button>' +
        '<button type="button" data-km-sys-act="csv">CSV</button>' +
        '<button type="button" data-km-sys-act="json">JSON</button>' +
        '<button type="button" data-km-sys-act="print">Տպել աղյուսակը</button>' +
        '<button type="button" data-km-sys-act="openfolder">Բացել պանակը</button>' +
      '</div>' +
      '<div class="kmSysSummary" id="kmSysSummary"></div>' +
      '<p class="muted" id="kmSysPdfStatus" style="margin:0 0 10px">Բեռնվում է միայն ընտրված բաժինը։ PDF-ը կարող է հանել այս ներդիրը կամ բոլորը։</p>' +
      '<div id="kmSysInfoContent">' + panels + '</div>' +
      '<div id="kmSysExtraHost">' + extraPanelHtml() + '</div>';
  }

  function copyText(t) {
    t = String(t || '');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(function () { toast('Պատճենվեց', 'ok'); }).catch(function () { toast(t, 'ok'); });
    } else toast(t || 'Դատարկ է', 'ok');
  }

  function bindHost(host) {
    if (!host) return;
    if (boundHost && boundHost._kmSysClick) {
      try { boundHost.removeEventListener('click', boundHost._kmSysClick, true); } catch (e) {}
    }
    if (boundHost && boundHost._kmSysInput) {
      try { boundHost.removeEventListener('input', boundHost._kmSysInput); } catch (e) {}
    }
    boundHost = host;
    var onClick = function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest('[data-km-sys-tab],[data-km-sys-act],[data-km-sys-mode],[data-km-sys-kind],[data-km-sys-sort]') : null;
      if (!btn || !host.contains(btn)) return;
      if (btn.tagName === 'INPUT' || btn.tagName === 'SELECT') return;
      ev.preventDefault();
      if (ev.stopPropagation) ev.stopPropagation();
      try {
        var act = btn.getAttribute('data-km-sys-act');
        var tab = btn.getAttribute('data-km-sys-tab');
        var md = btn.getAttribute('data-km-sys-mode');
        var kd = btn.getAttribute('data-km-sys-kind');
        var sk = btn.getAttribute('data-km-sys-sort');
        if (sk) {
          var st = sortState[currentTab] || { key: 'status', dir: -1 };
          if (st.key === sk) st.dir = -st.dir;
          else { st.key = sk; st.dir = sk === 'name' || sk === 'serial' ? 1 : -1; }
          sortState[currentTab] = st;
          savePrefs();
          paintContent(currentTab);
        } else if (act === 'refresh') window._kmSysRefresh();
        else if (act === 'histmenu') {
          histMenuOpen = !histMenuOpen;
          paintChrome();
        } else if (act === 'clear' || act === 'clearusb' || act === 'clearinternet' || act === 'clearwifi' || act === 'clearbluetooth') {
          window._kmSysClear(act === 'clear' ? '' : act.replace('clear', ''));
        } else if (act === 'pdfthis') window._kmSysPdfExport(false);
        else if (act === 'pdfall') window._kmSysPdfExport(true);
        else if (act === 'pdfcancel') { pdfCancel = true; toast('Չեղարկվում է…', 'warn'); }
        else if (act === 'csv') exportTable('csv');
        else if (act === 'json') exportTable('json');
        else if (act === 'print') printVisible();
        else if (act === 'openfolder') openLastFolder();
        else if (act === 'searchall') {
          searchAll = !searchAll;
          query._all = query[currentTab] || query._all || '';
          savePrefs();
          if (searchAll) loadAllForSearch();
          paintContent(currentTab);
        } else if (act === 'more') {
          shownN[currentTab] = (shownN[currentTab] || PAGE) + PAGE;
          paintContent(currentTab);
        } else if (act === 'copy') copyText(btn.getAttribute('data-km-copy') || '');
        else if (act === 'expand') {
          var key = btn.getAttribute('data-km-key') || '';
          expanded[currentTab] = expanded[currentTab] === key ? '' : key;
          paintContent(currentTab);
        } else if (act === 'savenote') saveNote(btn.getAttribute('data-km-key'));
        else if (act === 'copyrow') copyRow(btn.getAttribute('data-km-key'));
        else if (act === 'snap') saveSnapshot();
        else if (act === 'compare') compareSnaps();
        else if (act === 'formal') fillFormal();
        else if (md) { mode[currentTab] = md; savePrefs(); paintContent(currentTab); }
        else if (kd) { usbKind = kd; savePrefs(); paintContent('usb'); }
        else if (tab) window._kmSysTab(tab);
      } catch (e) {
        toast(errText(e), 'err');
      }
    };
    var onInput = function (ev) {
      var inp = ev.target && ev.target.closest ? ev.target.closest('[data-km-sys-search]') : null;
      if (!inp || !host.contains(inp)) return;
      if (searchAll) query._all = inp.value || '';
      else query[currentTab] = inp.value || '';
      savePrefs();
      paintContent(currentTab);
      if (searchAll) loadAllForSearch();
    };
    host._kmSysClick = onClick;
    host._kmSysInput = onInput;
    host.addEventListener('click', onClick, true);
    host.addEventListener('input', onInput);
  }

  function loadTab(tab, force) {
    if (!CHANNEL[tab]) return Promise.resolve();
    if (!force && cached[tab] !== undefined && !inflight[tab] && !(cached[tab] && cached[tab].quick)) {
      paintContent(tab);
      return Promise.resolve(cached[tab]);
    }
    var gen = (loadGen[tab] || 0) + 1;
    loadGen[tab] = gen;
    inflight[tab] = true;
    if (cached[tab] === undefined) paintContent(tab);
    return Promise.resolve()
      .then(function () {
        var n = api();
        if (tab === 'computer' && n && typeof n.computerQuick === 'function') {
          n.computerQuick().then(function (q) {
            if (loadGen[tab] !== gen) return;
            if (cached[tab] === undefined || cached[tab].quick) {
              cached[tab] = q;
              if (hostLive()) paintContent(tab);
            }
          }).catch(function () {});
        }
        if (!n || typeof n[CHANNEL[tab]] !== 'function') throw new Error('Այս բաժինը հասանելի չէ');
        return n[CHANNEL[tab]]();
      })
      .then(function (result) {
        if (loadGen[tab] !== gen) return;
        inflight[tab] = false;
        cached[tab] = result;
        refreshedAt[tab] = new Date().toLocaleString('hy-AM');
        if (hostLive()) paintContent(tab);
        return result;
      })
      .catch(function (e) {
        if (loadGen[tab] !== gen) return;
        inflight[tab] = false;
        if (cached[tab] && cached[tab].quick) return;
        cached[tab] = { error: errText(e) };
        if (hostLive()) paintContent(tab);
      });
  }

  function loadAllForSearch() {
    var i = 0;
    function next() {
      if (!searchAll || i >= TABS.length) { if (hostLive()) paintTabs(); return; }
      var id = TABS[i++].id;
      if (id === 'computer' || cached[id] !== undefined) return next();
      loadTab(id, false).then(next);
    }
    next();
  }

  window._kmSysTab = function (tab) {
    if (!CHANNEL[tab]) return;
    currentTab = tab;
    savePrefs();
    paintTabs();
    showPanels();
    if (cached[tab] === undefined) loadTab(tab, false);
    else paintContent(tab);
  };

  window._kmSysRefresh = function () {
    var tab = currentTab;
    if (!CHANNEL[tab]) return;
    shownN[tab] = PAGE;
    loadTab(tab, true);
  };

  window._kmSysClear = async function (kind) {
    kind = String(kind || '').toLowerCase();
    if (kind === 'usb' || kind === 'internet' || kind === 'wifi' || kind === 'bluetooth') {
      /* keep */
    } else if (currentTab === 'usb' || currentTab === 'internet' || currentTab === 'wifi' || currentTab === 'bluetooth') {
      kind = currentTab;
    } else {
      histMenuOpen = true;
      paintChrome();
      toast('Ընտրեք մաքրման տեսակը', 'warn');
      return;
    }
    var asks = {
      usb: 'USB պատմությունը կջնջվի Windows համակարգից (registry)։ Հիմա միացված սարքերը կմնան։ Windows-ը կհարցնի թույլտվություն — սեղմեք Այո։',
      internet: 'Ինտերնետ/ցանցային պատմությունը կջնջվի Windows համակարգից։ Հիմա միացված ցանցը կմնա։ Windows-ը կհարցնի թույլտվություն — սեղմեք Այո։',
      wifi: 'WiFi պահված ցանցերը կջնջվեն Windows համակարգից (netsh + registry)։ Հիմա միացված WiFi-ը կմնա։ Windows-ը կհարցնի թույլտվություն — սեղմեք Այո։',
      bluetooth: 'Bluetooth պատմությունը կջնջվի Windows համակարգից։ Հիմա միացված սարքերը կմնան։ Windows-ը կհարցնի թույլտվություն — սեղմեք Այո։'
    };
    var fns = { usb: 'clearUsb', internet: 'clearInternet', wifi: 'clearWifi', bluetooth: 'clearBluetooth' };
    var okMsg = {
      usb: 'USB պատմությունը ջնջվեց Windows-ից',
      internet: 'Internet պատմությունը ջնջվեց Windows-ից',
      wifi: 'WiFi պատմությունը ջնջվեց Windows-ից',
      bluetooth: 'Bluetooth պատմությունը ջնջվեց Windows-ից'
    };
    if (!confirm(asks[kind])) return;
    if (histBusy) return;
    histBusy = true;
    histMenuOpen = true;
    paintChrome();
    try {
      var n = api();
      var fn = fns[kind];
      if (!n || typeof n[fn] !== 'function') throw new Error('Այս գործողությունը հասանելի չէ');
      var r = await n[fn]();
      if (r && r.error) { toast(r.error, 'err'); return; }
      if (!r || r.ok !== true) { toast((r && r.error) || 'Չմաքրվեց', 'err'); return; }
      if (Number(r.still) > 0 || Number(r.remaining) > 0) {
        toast('Պատմությունը չմաքրվեց։ Մնացել է ' + (Number(r.still) || Number(r.remaining) || 0) + ' գրառում համակարգչում։', 'err');
        loadTab(kind, true);
        return;
      }
      var extra = '';
      if (r && (r.removed || r.kept)) extra = ' · հեռացված՝ ' + (r.removed || 0) + ' · մնացած (միացված)՝ ' + (r.kept || 0);
      toast(okMsg[kind] + extra, 'ok');
      if (window.kmNative && window.kmNative.audit) {
        window.kmNative.audit.append({ action: 'sysinfo-clear', detail: kind });
      }
      cached[kind] = null;
      loadTab(kind, true);
      loadAudit();
    } catch (e) {
      toast(errText(e), 'err');
    } finally {
      histBusy = false;
      paintChrome();
    }
  };

  function setPdfStatus(msg) {
    var el = hostLive() ? pageHost.querySelector('#kmSysPdfStatus') : null;
    if (el) el.textContent = msg || '';
  }

  async function collectTabs(ids, ignoreFilters) {
    var n = api();
    pdfCancel = false;
    for (var i = 0; i < ids.length; i++) {
      if (pdfCancel) return { cancelled: true };
      var id = ids[i];
      var meta = TABS.filter(function (t) { return t.id === id; })[0];
      setPdfStatus('Հավաքվում է՝ ' + ((meta && meta.label) || id) + '…');
      try {
        cached[id] = await n[CHANNEL[id]]();
        refreshedAt[id] = new Date().toLocaleString('hy-AM');
      } catch (e) {
        cached[id] = { error: errText(e) };
      }
      if (hostLive()) paintContent(id);
    }
    return { cancelled: false };
  }

  function buildPdfHtml(ids, ignoreFilters) {
    function strip(html) {
      return String(html || '')
        .replace(/max-height:\s*\d+px;?/gi, '')
        .replace(/overflow:\s*auto;?/gi, '');
    }
    var when = new Date().toLocaleString('hy-AM');
    var parts = [];
    var prev = pdfMode;
    pdfMode = !!ignoreFilters;
    try {
      for (var i = 0; i < ids.length; i++) {
        var meta = TABS.filter(function (t) { return t.id === ids[i]; })[0];
        parts.push('<h2>' + esc((meta && meta.label) || ids[i]) + '</h2>' + strip(renderTabBody(ids[i])));
      }
    } finally { pdfMode = prev; }
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>KM Տեղեկություն</title><style>' +
      '@page{size:A4;margin:12mm}' +
      'body{font-family:"Segoe UI",Arial,sans-serif;font-size:11px;color:#1d2733;margin:0}' +
      'h1{font-size:18px;margin:0 0 6px}' +
      'h2{font-size:14px;margin:16px 0 8px;border-bottom:1px solid #9aa8b5;padding-bottom:4px;page-break-after:avoid}' +
      'h3{font-size:12px;margin:10px 0 6px}' +
      '.meta{color:#4a5a6a;margin:0 0 14px}' +
      'table{width:100%;border-collapse:collapse;margin:0 0 8px}' +
      'th,td{border:1px solid #c8d0d8;padding:4px 6px;text-align:left;vertical-align:top}' +
      'th{background:#eef3f7}' +
      '.card{border:none;padding:0;margin:0}' +
      '.muted{color:#6a7a8a}' +
      '.danger{color:#a43b3b}' +
      '.kmSysBadge{display:inline-block;padding:2px 6px;border-radius:8px}' +
      '.kmSysBadgeOn{background:#e5f6ec}' +
      '.kmSysBadgeOff{background:#eef1f4}' +
      '.kmSysHero{display:none}' +
      '.kmSysExtra,details{display:none}' +
      '</style></head><body>' +
      '<h1>KM — Համակարգի տեղեկություն</h1>' +
      '<p class="meta">Համակարգիչ՝ ' + esc(hostName() || '\u2014') +
      ' · Գրաֆիկ / ստորաբաժանում՝ ' + esc(graphLabel() || '\u2014') +
      ' · KM՝ ' + esc(kmVer() || '\u2014') +
      ' · Ամսաթիվ՝ ' + esc(when) + '</p>' +
      parts.join('') +
      '</body></html>';
  }

  async function saveBytes(name, text) {
    if (!window.kmNative || !window.kmNative.file || typeof window.kmNative.file.saveDesktop !== 'function') {
      throw new Error('Պահպանումը հասանելի է միայն KM desktop-ում');
    }
    var bytes = Array.from(new TextEncoder().encode(text));
    var r = await window.kmNative.file.saveDesktop({ name: name, bytes: bytes });
    if (r && r.cancelled) return r;
    if (!r || !r.ok) throw new Error((r && r.error) || 'Չպահվեց');
    lastExportPath = r.path || '';
    if (lastExportPath && window.kmNative.shell && window.kmNative.shell.showItemInFolder) {
      try { await window.kmNative.shell.showItemInFolder(lastExportPath); } catch (e) {}
    }
    return r;
  }

  function csvEscape(v) {
    return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  }
  function tableCsv(tab) {
    var rows = filteredRows(tab);
    var lines = [];
    if (tab === 'usb') {
      lines.push(['Անուն', 'Արտադրող', 'Serial', 'Առաջին', 'Վերջին', 'Կարգավիճակ', 'Նշում'].map(csvEscape).join(','));
      rows.forEach(function (d) {
        lines.push([d.FriendlyName || d.DeviceDesc, d.Mfg, d.Serial, d.FirstSeen, d.LastSeen, isPresent(d) ? 'Միացված է' : 'Եղել է միացված', notes[rowKey('usb', d)] || ''].map(csvEscape).join(','));
      });
    } else if (tab === 'wifi') {
      lines.push(['SSID', 'Վերջին', 'Կարգավիճակ'].map(csvEscape).join(','));
      rows.forEach(function (d) {
        lines.push([d.name, d.LastSeen, isPresent(d) ? 'Միացված է' : 'Եղել է միացված'].map(csvEscape).join(','));
      });
    } else if (tab === 'bluetooth') {
      lines.push(['Անուն', 'Տեսակ', 'MAC', 'Վերջին', 'Կարգավիճակ'].map(csvEscape).join(','));
      rows.forEach(function (d) {
        lines.push([d.Name, btKind(d.Name), d.MAC, d.LastSeen, isPresent(d) ? 'Միացված է' : 'Եղել է միացված'].map(csvEscape).join(','));
      });
    } else if (tab === 'internet') {
      lines.push(['Անուն', 'Տեսակ', 'Վերջին', 'Կարգավիճակ'].map(csvEscape).join(','));
      rows.forEach(function (d) {
        lines.push([d.ProfileName, d.Kind || d.Category, d.DateLastConnected, isPresent(d) ? 'Միացված է' : 'Եղել է միացված'].map(csvEscape).join(','));
      });
    } else {
      lines.push([csvEscape('դաշտ'), csvEscape('արժեք')].join(','));
      var c = cached.computer || {};
      [['Համակարգիչ', hostName()], ['KM', kmVer()], ['Գրաֆիկ', graphLabel()]].forEach(function (p) {
        lines.push(p.map(csvEscape).join(','));
      });
    }
    return '\ufeff' + lines.join('\r\n');
  }

  async function exportTable(kind) {
    try {
      var name = exportBaseName() + '_' + currentTab + (kind === 'csv' ? '.csv' : '.json');
      var text;
      if (kind === 'csv') text = tableCsv(currentTab);
      else {
        var dump = { at: new Date().toISOString(), host: hostName(), graph: graphLabel(), km: kmVer(), tab: currentTab, data: cached[currentTab], notes: notes };
        text = JSON.stringify(dump, null, 2);
      }
      var r = await saveBytes(name, text);
      if (r && r.cancelled) { toast('Չեղարկվեց', 'warn'); return; }
      toast((kind === 'csv' ? 'CSV' : 'JSON') + ' հանվեց՝ ' + (r.path || ''), 'ok');
      if (window.kmNative.audit) window.kmNative.audit.append({ action: 'sysinfo-' + kind + '-export', detail: r.path || currentTab });
      loadAudit();
    } catch (e) { toast(errText(e), 'err'); }
  }

  function printVisible() {
    var html = buildPdfHtml([currentTab], false);
    var w = window.open('', '_blank');
    if (!w) { toast('Տպման պատուհանը չբացվեց', 'err'); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  }

  async function openLastFolder() {
    var p = lastExportPath;
    if (!p) { toast('Դեռ ֆայլ չի հանվել այս անգամ', 'warn'); return; }
    try {
      if (window.kmNative && window.kmNative.shell && window.kmNative.shell.showItemInFolder) {
        await window.kmNative.shell.showItemInFolder(p);
      } else if (window.kmNative && window.kmNative.shell && window.kmNative.shell.openPath) {
        await window.kmNative.shell.openPath(p.replace(/[\\/][^\\/]+$/, ''));
      }
    } catch (e) { toast(errText(e), 'err'); }
  }

  window._kmSysPdfExport = async function (all) {
    if (!isAdmin()) { toast('Միայն ադմինիստրատոր', 'err'); return; }
    if (pdfBusy) return;
    if (!window.kmNative || !window.kmNative.sysinfo || typeof window.kmNative.sysinfo.exportPdf !== 'function') {
      toast('PDF հանելը հասանելի է միայն KM desktop-ում', 'err');
      return;
    }
    var ids = all ? TABS.map(function (t) { return t.id; }) : [currentTab];
    pdfBusy = true;
    paintChrome();
    try {
      setPdfStatus(all ? 'Հավաքվում են բոլոր տեղեկությունները…' : 'Հավաքվում է ընտրված ներդիրը…');
      var col = await collectTabs(ids, all);
      if (col.cancelled) { setPdfStatus('Չեղարկվեց։'); toast('Չեղարկվեց', 'warn'); return; }
      setPdfStatus('PDF է կազմվում…');
      var html = buildPdfHtml(ids, all);
      setPdfStatus('Ընտրեք որտեղ հանել PDF ֆայլը…');
      var r = await window.kmNative.sysinfo.exportPdf({ html: html, title: 'KM_SysInfo', defaultName: exportBaseName() + '.pdf' });
      if (r && r.cancelled) {
        setPdfStatus('Ադմինիստրատորը կարող է հանել ընտրված ներդիրը կամ բոլորը PDF։');
        toast('Չեղարկվեց', 'warn');
        return;
      }
      if (!r || !r.ok) {
        toast((r && r.error) || 'PDF-ը չհանվեց', 'err');
        setPdfStatus('PDF-ը չհանվեց։');
        return;
      }
      lastExportPath = r.path || '';
      var msg = 'PDF-ը հանվեց՝ ' + lastExportPath;
      setPdfStatus(msg);
      toast(msg, 'ok');
      if (window.kmNative.audit) window.kmNative.audit.append({ action: 'sysinfo-pdf-export', detail: lastExportPath });
      loadAudit();
    } catch (e) {
      toast(errText(e), 'err');
      setPdfStatus(errText(e));
    } finally {
      pdfBusy = false;
      paintChrome();
    }
  };

  function rowByKey(tab, key) {
    var rows = tabRows(tab);
    for (var i = 0; i < rows.length; i++) if (rowKey(tab, rows[i]) === key) return rows[i];
    return null;
  }
  async function saveNote(key) {
    if (!key) return;
    var inp = hostLive() ? pageHost.querySelector('input.kmSysNote[data-km-note="' + key + '"]') : null;
    if (!inp && hostLive()) inp = pageHost.querySelector('input.kmSysNote');
    var text = inp ? String(inp.value || '') : '';
    try {
      await api().notesSet({ key: key, text: text });
      if (text) notes[key] = text; else delete notes[key];
      toast('Նշումը պահվեց', 'ok');
    } catch (e) { toast(errText(e), 'err'); }
  }
  function copyRow(key) {
    var d = rowByKey(currentTab, key);
    if (!d) { toast('Տող չգտնվեց', 'warn'); return; }
    var parts = [];
    Object.keys(d).forEach(function (k) {
      if (d[k] != null && typeof d[k] !== 'object') parts.push(k + ': ' + d[k]);
    });
    if (notes[key]) parts.push('Նշում: ' + notes[key]);
    copyText(parts.join('\n'));
  }

  async function saveSnapshot() {
    try {
      setPdfStatus('Վիճակը պահվում է…');
      await collectTabs(TABS.map(function (t) { return t.id; }), true);
      if (pdfCancel) { toast('Չեղարկվեց', 'warn'); return; }
      var r = await api().snapshotSave({
        host: hostName(),
        graph: graphLabel(),
        km: (cached.computer && cached.computer.km) || { update: kmVer() },
        tabs: {
          usb: cached.usb, wifi: cached.wifi, bluetooth: cached.bluetooth,
          internet: cached.internet, computer: cached.computer
        }
      });
      if (!r || !r.ok) throw new Error((r && r.error) || 'Չպահվեց');
      toast('Վիճակը պահվեց', 'ok');
      if (window.kmNative.audit) window.kmNative.audit.append({ action: 'sysinfo-snapshot', detail: r.id || '' });
      await loadSnaps();
      paintContent(currentTab);
    } catch (e) { toast(errText(e), 'err'); }
  }

  function idsOf(tab, data) {
    var rows = [];
    if (tab === 'usb') rows = asArray(data);
    else if (tab === 'wifi') rows = asArray(data);
    else if (tab === 'bluetooth') rows = asArray((data && data.devices) || data);
    else if (tab === 'internet') rows = asArray((data && data.profiles) || data);
    return rows.map(function (d) { return rowKey(tab, d); }).filter(Boolean);
  }
  function diffList(a, b) {
    var sa = {};
    a.forEach(function (x) { sa[x] = 1; });
    var added = [];
    b.forEach(function (x) { if (!sa[x]) added.push(x); });
    var sb = {};
    b.forEach(function (x) { sb[x] = 1; });
    var removed = [];
    a.forEach(function (x) { if (!sb[x]) removed.push(x); });
    return { added: added, removed: removed };
  }
  async function compareSnaps() {
    var a = hostLive() ? pageHost.querySelector('#kmSysSnapA') : null;
    var b = hostLive() ? pageHost.querySelector('#kmSysSnapB') : null;
    var box = hostLive() ? pageHost.querySelector('#kmSysCompare') : null;
    if (!a || !b || !box) return;
    if (!a.value || !b.value) { toast('Ընտրեք երկու պատճեն', 'warn'); return; }
    try {
      var A = await api().snapshotGet(a.value);
      var B = await api().snapshotGet(b.value);
      if (A && A.error) throw new Error(A.error);
      if (B && B.error) throw new Error(B.error);
      var html = '<p class="muted">A՝ ' + esc(fmtDate(A.at) + ' · ' + (A.host || '')) +
        '<br>B՝ ' + esc(fmtDate(B.at) + ' · ' + (B.host || '')) + ' · նորերը B-ում կարմիր նշումով են համեմատության մեջ։</p>';
      ['usb', 'wifi', 'bluetooth', 'internet'].forEach(function (tab) {
        var d = diffList(idsOf(tab, (A.tabs || {})[tab]), idsOf(tab, (B.tabs || {})[tab]));
        html += '<h4 style="margin:10px 0 4px">' + esc(tab) + '</h4>';
        html += '<p>Նոր B-ում՝ <span class="kmSysBadge kmSysBadgeDup">' + d.added.length + '</span> · ' +
          (d.added.slice(0, 12).map(function (x) { return esc(x.split('|').slice(1).join('|') || x); }).join(', ') || 'չկա') + '</p>';
        html += '<p>Չկա B-ում՝ ' + d.removed.length + ' · ' +
          (d.removed.slice(0, 12).map(function (x) { return esc(x.split('|').slice(1).join('|') || x); }).join(', ') || 'չկա') + '</p>';
      });
      box.innerHTML = html;
    } catch (e) { toast(errText(e), 'err'); }
  }

  function computerIdentityText() {
    var c = cached.computer || {};
    var sys = asObj(c.system);
    var osInfo = asObj(c.os);
    return [
      'Համակարգիչ՝ ' + (sys.Name || osInfo.Hostname || ''),
      'ՕՀ՝ ' + (osInfo.Caption || osInfo.Release || ''),
      'KM տարբերակ՝ ' + ((c.km && c.km.version) || kmProductVer() || ''),
      'KM թարմացում՝ ' + ((c.km && c.km.update) || kmVer() || ''),
      'Գրաֆիկ՝ ' + (graphLabel() || ''),
      'Windows օգտատեր՝ ' + (c.windowsUser || sys.UserName || ''),
      'Ամսաթիվ՝ ' + new Date().toLocaleString('hy-AM')
    ].filter(Boolean).join('\n');
  }

  async function fillFormal() {
    try {
      if (!cached.computer) await loadTab('computer', false);
      var ident = computerIdentityText();
      copyText(ident);
      var owner = typeof window.kmCurrentFormalOwner === 'function' ? window.kmCurrentFormalOwner() : (window.db && window.db.schedule);
      var f = typeof window.kmFormalData === 'function' ? window.kmFormalData(owner) : {};
      if (f && typeof f === 'object' && !f.bottomTitle) {
        f.bottomTitle = (hostName() || 'KM') + ' · ' + (kmVer() || '');
        if (typeof window.save === 'function') window.save(true);
      }
      if (!window.kmNative || !window.kmNative.templates) {
        toast('Formal տեքստը պատճենվեց։ Ձևանմուշը հասանելի է desktop KM-ում։', 'ok');
        return;
      }
      var graphKey = typeof window.kmFormalGraphKey === 'function' ? window.kmFormalGraphKey(owner) : 'main';
      var gl = graphLabel() || 'Հիմնական';
      var list = await window.kmNative.templates.get();
      if (!Array.isArray(list)) list = [];
      list.push({
        name: 'Տեղեկություն — ' + (hostName() || 'KM') + ' — ' + new Date().toLocaleDateString('hy-AM'),
        graphKey: graphKey,
        graphLabel: gl,
        formalGraph: f && typeof f === 'object' ? JSON.parse(JSON.stringify(f)) : {},
        sysinfo: ident,
        savedAt: new Date().toISOString()
      });
      await window.kmNative.templates.save(list);
      toast('Formal ձևանմուշը պահվեց, տեքստը պատճենվեց', 'ok');
      if (window.kmNative.audit) window.kmNative.audit.append({ action: 'sysinfo-formal', detail: gl });
      loadAudit();
    } catch (e) { toast(errText(e), 'err'); }
  }

  async function loadSnaps() {
    try {
      if (window.kmNative && window.kmNative.sysinfo && window.kmNative.sysinfo.snapshotList) {
        snaps = await api().snapshotList() || [];
      }
    } catch (e) { snaps = []; }
  }
  async function loadNotes() {
    try {
      if (window.kmNative && window.kmNative.sysinfo && window.kmNative.sysinfo.notesGet) {
        notes = await api().notesGet() || {};
      }
    } catch (e) { notes = {}; }
  }
  async function loadAudit() {
    try {
      if (window.kmNative && window.kmNative.audit && window.kmNative.audit.list) {
        var list = await window.kmNative.audit.list(80, 'sysinfo');
        auditRows = (list || []).filter(function (x) { return /sysinfo/i.test(String((x && x.action) || '') + ' ' + String((x && x.detail) || '')); });
      }
    } catch (e) { auditRows = []; }
    if (hostLive()) {
      var extra = pageHost.querySelector('#kmSysExtraHost');
      if (extra) extra.innerHTML = extraPanelHtml();
    }
  }

  function ensureOwnHost(hostEl) {
    // Գրադարան / ներդրված host — միայն այստեղ տեղադրել, #content-ը չքանդել
    if (hostEl && hostEl.nodeType === 1) {
      if (hostEl.id === 'kmSysInfoHost') return hostEl;
      var nested = null;
      try { nested = hostEl.querySelector('#kmSysInfoHost'); } catch (e) {}
      if (nested) return nested;
      try {
        hostEl.innerHTML = '<div id="kmSysInfoHost"></div>';
        return hostEl.querySelector('#kmSysInfoHost') || hostEl;
      } catch (e2) {
        return hostEl;
      }
    }
    var content = document.getElementById('content');
    if (!content) return document.getElementById('kmSysInfoHost');
    var keep = document.getElementById('kmSysInfoHost');
    // Եթե նախկին host-ը Գրադարանի ներսում է մնացել՝ չօգտագործել որպես ամբողջ էջ
    if (keep && content.contains(keep) && keep.closest && keep.closest('#kmLibSectionRoot')) {
      keep = null;
    }
    if (keep && content.contains(keep)) return keep;
    content.innerHTML = '<div id="kmSysInfoHost"></div>';
    return document.getElementById('kmSysInfoHost');
  }

  function mount(hostEl, reset) {
    loadPrefs();
    pageHost = ensureOwnHost(hostEl);
    if (!pageHost) return;
    injectCss();
    try { pageHost.removeAttribute('data-km-i18n-skip'); } catch (e) {}
    if (!isAdmin()) {
      pageHost.innerHTML = '<div class="card">' +
        (typeof window.kmBackToolbar === 'function' ? window.kmBackToolbar(typeof window.kmContextBackOnclick === 'function' ? window.kmContextBackOnclick() : 'kmSysSettingsBack()') : '') +
        '<p class="danger">Տեղեկությունը հասանելի է միայն ադմինիստրատորին։</p></div>';
      i18nRefresh();
      return;
    }
    if (boundHost && !boundHost.isConnected) boundHost = null;
    bindHost(pageHost);
    var already = pageHost.querySelector('#kmSysInfoContent');
    if (already && pageHost.querySelector('[data-km-sys-panel]') && !reset) {
      paintTabs();
      showPanels();
      if (cached[currentTab] === undefined) loadTab(currentTab, false);
      else paintContent(currentTab);
      return;
    }
    if (reset) {
      cached = {};
      loadGen = {};
      inflight = {};
      query = query || {};
      mode = mode || {};
      refreshedAt = {};
    }
    if (!CHANNEL[currentTab]) currentTab = 'usb';
    try {
      pageHost.innerHTML = shellHtml();
    } catch (e) {
      pageHost.innerHTML = '<div class="card"><p class="danger">' + esc(errText(e)) + '</p></div>' +
        '<div class="toolbar kmSysToolbar"><span id="kmSysClearSlot"></span></div>';
    }
    paintChrome();
    i18nRefresh();
    loadNotes().then(function () { loadSnaps().then(function () { loadAudit(); paintContent(currentTab); }); });
    loadTab(currentTab, cached[currentTab] === undefined);
  }

  window.kmSysInfoPage = function (hostEl) {
    mount(hostEl, false);
  };
  window.kmSysInfoEnsure = function (hostEl) {
    mount(hostEl, false);
  };
})();
