/* KM network + file transfer UI */
(function () {
  'use strict';

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
  /** Automatic P2P/LAN events: never native Notification (am.km.desktop popup) and no toast storm. */
  var MUTE_AUTO_FILES_RE = /km_app_users\.json|km_settings\.json|database_snapshot\.json|KM_SYNC\.json|km_org_seed\.json|_path_map\.json|(^|__)index\.json$|arch_\d+|_index\.ndjson|soldier_rights\.(pdf|docx|html?)|(^|__)\d+\.html?$/i;
  /* KM_NET_RECV_AUTO_V1 */
  function isSystemRecvName(name) {
    var raw = String(name || '');
    var parts = raw.split('__');
    var base = parts.length ? parts[parts.length - 1] : raw;
    if (MUTE_AUTO_FILES_RE.test(raw) || MUTE_AUTO_FILES_RE.test(base)) return true;
    if (/^[a-z0-9]+__[0-9a-f]{16}__/i.test(raw)) return true;
    if (/^bk\d+__/i.test(base) || /arch_\d+/i.test(raw)) return true;
    if (/unit_(kod|archives)/i.test(raw)) return true;
    return false;
  }
  var kmNetManualSyncUntil = 0;

  function lanLog() {
    try {
      if (!(window.KM_DEBUG || (typeof localStorage !== 'undefined' && localStorage.getItem('KM_DEBUG') === '1'))) return;
      var args = ['[LAN SYNC]'].concat([].slice.call(arguments));
      console.log.apply(console, args);
    } catch (e) {}
  }

  function isMutedAutoFile(name) {
    return isSystemRecvName(name);
  }

  function allowManualToast() {
    return Date.now() < kmNetManualSyncUntil;
  }

  function markManualSync(ms) {
    kmNetManualSyncUntil = Date.now() + (ms == null ? 120000 : ms);
  }

  /** Silent by default. Toast only for FATAL or active manual sync window. Never Notification popups. */
  function pushNotify(title, body, kind, opts) {
    opts = opts || {};
    var fatal = kind === 'error' || kind === 'fatal' || opts.fatal;
    var manual = !!opts.manual || allowManualToast();
    lanLog(title || '', body || '', kind || '', fatal ? 'FATAL' : (manual ? 'manual' : 'silent'));
    if (!fatal && !manual) return;
    toast(body || title, fatal ? 'error' : (kind === 'warn' ? 'warn' : 'ok'));
  }
  function requestPushPerm() {
    /* Native desktop notifications disabled for LAN/P2P — no permission prompts. */
  }
  function errText(e) {
    var s = String((e && e.message) || e || '');
    s = s.replace(/^Error invoking remote method '[^']+':\s*/i, '');
    var parts = s.split(/\s*Error:\s*/);
    s = (parts[parts.length - 1] || s).trim();
    return s || 'Սխալ';
  }
  function canEdit() {
    return typeof window.kmCanEdit !== 'function' || window.kmCanEdit();
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
  function adminToken() {
    try { return localStorage.getItem('km_admin_token') || ''; } catch (e) { return ''; }
  }
  function api() {
    if (!window.kmNative || !window.kmNative.net) throw new Error('Ցանցը հասանելի է միայն KM desktop-ում');
    return window.kmNative.net;
  }
  function fmtSize(n) {
    n = Number(n) || 0;
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    if (n < 1073741824) return (n / 1048576).toFixed(1) + ' MB';
    return (n / 1073741824).toFixed(2) + ' GB';
  }
  function fmtWhen(s) {
    try { return new Date(s).toLocaleString('hy-AM'); } catch (e) { return String(s || ''); }
  }

  var kmNetTab = 'net';
  var kmNetPoll = null;
  var kmNetBound = false;
  var kmNetOpBusy = false;
  var kmNetRenderSeq = 0;
  var kmNetRefreshTimer = null;
  var kmNetLastHtml = '';
  /* KM_NET_NO_REFRESH_LOOP_V1 */
  function kmNetViewActive() {
    if (window.page === 'network') return true;
    if (window.page === 'syssettings' && window._kmSysSettingsSub === 'network') return true;
    if (window.page === 'library' && window.kmLibSection === 'network') return true;
    return !!document.querySelector('.kmNetTabs');
  }
  function kmNetStableHtml(html) {
    return String(html || '')
      .replace(/\d{1,2}:\d{2}(:\d{2})?/g, '#')
      .replace(/lastSeen[^<]*/gi, 'lastSeen')
      .replace(/data-ts="[^"]*"/g, 'data-ts=""')
      .replace(/\b\d+\s*ms\b/g, '#ms')
      .replace(/\b\d+\.\d+\.\d+\.\d+\b/g, function(ip){ return ip; });
  }

  var kmLanBound = false;
  var kmLanLive = { wsState: 'disconnected', syncProgress: {} };

  function lanApi() {
    if (!window.kmNative || !window.kmNative.lanSync) return null;
    return window.kmNative.lanSync;
  }
  function lanApiStatusUrl() {
    return String((kmLanLive && kmLanLive.serverUrl) || '');
  }
  function wsStateLabel(state) {
    if (state === 'connected' || state === 'listening') return 'Միացված է';
    if (state === 'reconnecting') return 'Վերամիացում…';
    if (state === 'idle') return 'Server URL կարգավորված չէ';
    return 'Անջատված է';
  }
  function wsStateClass(state) {
    if (state === 'connected' || state === 'listening') return 'on';
    if (state === 'reconnecting') return 'warn';
    return 'off';
  }
  function syncStatusLabel(sp) {
    sp = sp || {};
    if (sp.label) return sp.label;
    if (sp.botRefresh) return 'BotKnowledge FTS index թարմացում…';
    if (sp.active && sp.currentRel) {
      var name = sp.currentRel.split('/').pop();
      if (sp.pullPct > 0) return 'Ներբեռնվում է ' + name + '… ' + sp.pullPct + '%';
      return 'Ներբեռնվում է ' + name + '…';
    }
    if (Number(sp.pending) > 0) return 'Սպասող ֆայլեր՝ ' + sp.pending;
    if (!sp.active && !sp.botRefresh && (sp.done > 0 || sp.pullPct >= 100)) return 'Ֆայլերը սինխրոնացված են';
    return 'Սինխրոնացում չկա';
  }
  function syncStatusPct(sp) {
    sp = sp || {};
    if (sp.pullPct > 0) return Math.min(100, sp.pullPct);
    var total = Number(sp.total) || 0;
    var done = Number(sp.done) || 0;
    if (total > 0) return Math.min(100, Math.round((done / total) * 100));
    if (sp.active) return 8;
    if (sp.botRefresh) return 15;
    if (!sp.active && !sp.botRefresh && sp.done > 0) return 100;
    return 0;
  }
  function updateLanProgress(sp) {
    sp = sp || kmLanLive.syncProgress || {};
    var bar = document.getElementById('kmLanProgBar');
    var meta = document.getElementById('kmLanProgMeta');
    if (!bar && !meta) return;
    var pct = syncStatusPct(sp);
    if (bar) {
      bar.style.width = pct + '%';
      bar.className = 'kmLanProgBar' + (sp.botRefresh ? ' bot' : '');
    }
    if (meta) meta.textContent = syncStatusLabel(sp);
  }
  function updateLanWsStatus(state) {
    var badge = document.getElementById('kmLanWsBadge');
    var wsEl = document.getElementById('kmLanWsStatus');
    var cls = wsStateClass(state);
    if (badge) badge.className = 'kmLanBadge ' + cls;
    if (wsEl) wsEl.textContent = wsStateLabel(state);
  }
  function updateLanSyncUi(ev) {
    if (!ev || !ev.type) return;
    if (ev.type === 'ws-state') {
      kmLanLive.wsState = ev.wsState;
      updateLanWsStatus(ev.wsState);
    } else if (ev.type === 'connected') {
      kmLanLive.wsState = 'connected';
      updateLanWsStatus('connected');
    } else if (ev.type === 'reconnecting') {
      kmLanLive.wsState = 'reconnecting';
      updateLanWsStatus('reconnecting');
    } else if (ev.type === 'disconnected') {
      kmLanLive.wsState = 'disconnected';
      updateLanWsStatus('disconnected');
    } else if (ev.type === 'sync-progress') {
      kmLanLive.syncProgress = {
        pending: ev.pending,
        active: ev.active,
        currentRel: ev.currentRel,
        done: ev.done,
        total: ev.total,
        botRefresh: ev.botRefresh,
        label: ev.label,
        pullPct: ev.pullPct,
        pullBytes: ev.pullBytes,
        pullTotal: ev.pullTotal
      };
      updateLanProgress(kmLanLive.syncProgress);
    } else if (ev.type === 'bot-knowledge-sync-start') {
      kmLanLive.syncProgress = Object.assign({}, kmLanLive.syncProgress, {
        active: true,
        label: 'Ներբեռնվում է knowledge.db snapshot…',
        pullPct: 0
      });
      updateLanProgress(kmLanLive.syncProgress);
    } else if (ev.type === 'bot-knowledge-sync-done') {
      if (ev.ok) {
        kmLanLive.syncProgress = Object.assign({}, kmLanLive.syncProgress, {
          active: false,
          pullPct: 100,
          label: 'Ֆայլերը սինխրոնացված են'
        });
      }
      updateLanProgress(kmLanLive.syncProgress);
    } else if (ev.type === 'bot-refresh-start') {
      var br = document.getElementById('kmLanBotRefresh');
      if (br) br.textContent = 'BotKnowledge FTS/index թարմացում…';
      kmLanLive.syncProgress = Object.assign({}, kmLanLive.syncProgress, { botRefresh: true });
      updateLanProgress(kmLanLive.syncProgress);
    } else if (ev.type === 'bot-refresh-done') {
      var br2 = document.getElementById('kmLanBotRefresh');
      if (br2) {
        if (ev.ok && ev.after) {
          br2.textContent = 'BotKnowledge FTS պատրաստ · ' + (ev.after.ftsCount || 0) + ' / ' + (ev.after.sqliteCount || 0);
        } else {
          br2.textContent = ev.error ? ('FTS՝ ' + ev.error) : 'FTS թարմացում';
        }
      }
      kmLanLive.syncProgress = Object.assign({}, kmLanLive.syncProgress, { botRefresh: false });
      updateLanProgress(kmLanLive.syncProgress);
    } else if (ev.type === 'adopted-hub') {
      var urlEl = document.getElementById('kmLanServerUrl');
      if (urlEl && ev.serverUrl) urlEl.value = ev.serverUrl;
    }
    if (window.page === 'network' && kmNetTab === 'net' && !kmNetOpBusy) {
      if (ev.type === 'connected' || ev.type === 'disconnected' || ev.type === 'file-pulled' || ev.type === 'adopted-hub') {
        scheduleNetRefresh('net', true, 1200);
      }
    }
  }
  function bindLanEvents() {
    if (kmLanBound || !window.kmNative || !window.kmNative.onLanSyncEvent) return;
    kmLanBound = true;
    window.kmNative.onLanSyncEvent(function (ev) {
      updateLanSyncUi(ev);
    });
  }

  function injectCss() {
    if (document.getElementById('km-net-css')) return;
    var s = document.createElement('style');
    s.id = 'km-net-css';
    s.textContent =
      '.kmNetTabs{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 14px}' +
      '.kmNetTabs button.active{background:#17212b;color:#fff;border-color:#17212b}' +
      '.kmNetDot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px;background:#999}' +
      '.kmNetDot.on{background:#1a7f4b}' +
      '.kmNetDot.off{background:#a43b3b}' +
      '.kmNetIps{font-family:Consolas,monospace;font-size:13px}' +
      '.kmNetIps .in{color:#1a7f4b;font-weight:600}' +
      '.kmNetHist th,.kmNetHist td{font-size:12px}' +
      '.kmNetLock{font-size:12px;color:#7a5a00;margin:0 0 10px}' +
      '.kmNetConfirm{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:8px}' +
      '.kmNetConfirm p{margin:0;flex:1 1 220px}' +
      '.kmNetDot.warn{background:#c07a00;animation:kmLanPulse 1.2s ease-in-out infinite}' +
      '@keyframes kmLanPulse{50%{opacity:.45}}' +
      '.kmLanPanel{border:1px solid #d8dee6;border-radius:8px;padding:12px;margin-top:14px;background:#f8fafc}' +
      '.kmLanWs{font-weight:600;margin:0 0 8px}' +
      '.kmLanProg{height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden;margin:8px 0}' +
      '.kmLanProgBar{height:100%;background:#2563eb;width:0;transition:width .25s}' +
      '.kmLanProgBar.bot{background:#1a7f4b}' +
      '.kmLanMeta{font-size:12px;color:#64748b;margin:0}' +
      '.kmLanMode{display:flex;flex-wrap:wrap;gap:14px;margin:0 0 12px}' +
      '.kmLanMode label{display:flex;gap:8px;align-items:center;font-size:14px;cursor:pointer;margin:0}' +
      '.kmLanBadge{display:inline-block;width:14px;height:14px;border-radius:50%;background:#a43b3b;box-shadow:0 0 0 3px rgba(164,59,59,.2);vertical-align:middle;margin-right:8px}' +
      '.kmLanBadge.on{background:#1a7f4b;box-shadow:0 0 0 3px rgba(26,127,75,.2)}' +
      '.kmLanBadge.warn{background:#c07a00;box-shadow:0 0 0 3px rgba(192,122,0,.2);animation:kmLanPulse 1.2s ease-in-out infinite}' +
      '.kmLanConn{display:flex;align-items:center;gap:8px;margin:8px 0;font-weight:600}' +
      '.kmLanHubRow{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;margin:4px 0;background:#fff;font-size:13px}' +
      '.kmLanHubRow.current{border-color:#1a7f4b;background:#f0fdf4}' +
      '.kmLanHubWarn{color:#9a3412;background:#fff7ed;border:1px solid #fdba74;border-radius:6px;padding:8px;margin:8px 0 0;font-size:13px}';
    document.head.appendChild(s);
  }

  function scheduleNetRefresh(tab, quiet, delayMs) {
    /* KM_NET_NO_REFRESH_LOOP_V1 */
    if (kmNetOpBusy) return;
    if (!kmNetViewActive()) return;
    if (kmNetTab === 'upd' && quiet) return;
    if (kmNetRefreshTimer) clearTimeout(kmNetRefreshTimer);
    var wait = delayMs == null ? (quiet ? 2200 : 700) : delayMs;
    if (quiet && wait < 1500) wait = 1500;
    kmNetRefreshTimer = setTimeout(function () {
      kmNetRefreshTimer = null;
      if (kmNetOpBusy || !kmNetViewActive()) return;
      if (typeof window.kmNetPage === 'function') window.kmNetPage(tab || kmNetTab, true);
    }, wait);
  }

  function bindEvents() {
    bindLanEvents();
    if (kmNetBound || !window.kmNative || !window.kmNative.onNetEvent) return;
    kmNetBound = true;
    requestPushPerm();
    window.kmNative.onNetEvent(function (ev) {
      if (!ev || !ev.type) return;

      if (ev.type === 'receiving') {
        var recvName = ev.fileName || '';
        if (isMutedAutoFile(recvName)) {
          lanLog('receiving muted', recvName);
        } else {
          pushNotify(
            'KM · Ֆայլ է գալիս',
            (ev.peerName || 'Կայան') + ' · ' + (recvName || 'ֆայլ') +
              (ev.size ? ' (' + fmtSize(ev.size) + ')' : '') +
              (ev.purpose === 'oversight' ? ' · hub վերահսկում' :
                ev.purpose === 'redistribute' ? ' · բաշխում բոլորին' : ''),
            'warn'
          );
        }
      } else if (ev.type === 'received') {
        var rec = ev.record || {};
        var purpose = rec.purpose || ev.purpose || '';
        var fname = String(rec.fileName || '');
        var sysRecv = !!(rec.systemPayload || rec.autoRecv || isMutedAutoFile(fname) ||
          /^(sync|redistribute|oversight)$/i.test(String(purpose || '')));
        if (sysRecv) {
          lanLog('received muted/auto', fname, purpose || '');
        } else {
          pushNotify(
            'KM · Ֆայլ ստացվեց',
            (rec.peerName || '') + ' · ' + (fname || 'ֆայլ') +
              (purpose === 'oversight' ? ' · hub' : purpose === 'redistribute' ? ' · ընդհանուր բաշխում' : ''),
            'ok'
          );
        }
        /* KM_SYNC_AUTO_ONLY_V1 + KM_NET_RECV_AUTO_V1 + KM_ADMIN_HANG_V1 */
        if (/^KM_SYNC\.json$/i.test(fname) && typeof window.kmNetApplyInboxSync === 'function' && rec.inboxPath) {
          (async function () {
            try {
              var _n = api();
              var stHub = _n ? await _n.status() : null;
              if (stHub && stHub.updateServer) {
                lanLog('hub skip auto KM_SYNC apply', fname);
                return;
              }
            } catch (_) {}
            window.kmNetApplyInboxSync(rec.inboxPath, { auto: true, quiet: true });
          })();
        }
        if (/km_app_users\.json$/i.test(fname)) { /* KM_GRANTS_CONFIRM_SYNC_V2 */
          try {
            if (typeof window.kmRefreshUserGrants === 'function') window.kmRefreshUserGrants();
            if (typeof window.kmRefreshUsersAdminIfOpen === 'function') window.kmRefreshUsersAdminIfOpen({ type: 'users-grants-updated', from: 'inbox' });
          } catch (_) {}
        }
        if (sysRecv) {
          /* KM_NET_RECV_AUTO_V1: skip refresh */
          return;
        }
      } else if (ev.type === 'sendingWarn' || ev.type === 'reportWarn' || ev.type === 'redistributeWarn') { /* KM_PERF_FAST_V3: fixed extra brace */
        var sendName = ev.fileName || '';
        if (isMutedAutoFile(sendName)) {
          lanLog(ev.type + ' muted', sendName);
        } else {
          pushNotify(
            ev.type === 'redistributeWarn' ? 'KM · Բաշխում կայաններին' : 'KM · Ֆայլի ուղարկում',
            (sendName || 'ֆայլ') + (ev.peerName || ev.host ? ' → ' + (ev.peerName || ev.host) : ' → բոլոր կայաններ'),
            'warn'
          );
        }
      } else if (ev.type === 'peerJoined') {
        lanLog('peerJoined', (ev.peer && ev.peer.name) || (ev.peer && ev.peer.ip) || '');
        if (ev.peer && ev.peer.updateServer && window.kmNative.lanSync && window.kmNative.lanSync.adoptHub) {
          window.kmNative.net.status().then(function (stSelf) {
            if (stSelf && stSelf.updateServer) return;
            window.kmNative.lanSync.adoptHub().catch(function () {});
          }).catch(function () {});
        }
      } else if (ev.type === 'reported') {
        lanLog('reported', ev.file || '');
      } else if (ev.type === 'updateProgress') {
        var pr = ev.phase === 'setup'
          ? ('Ներբեռնվում է Setup… ' + (ev.rel || ''))
          : ('Թարմացում՝ ' + (ev.done || 0) + '/' + (ev.total || 0));
        kmNetSetUpdText(pr);
      } else if (ev.type === 'updateReady') {
        pushNotify('KM · Թարմացում', 'Պատրաստ է՝ ' + (ev.update || '') + '։ Վերագործարկվում է…', 'ok', { fatal: false, manual: true });
      }

      if (!kmNetViewActive()) return;
      if (kmNetTab === 'info') return;
      if (kmNetOpBusy) return;
      if (ev.type === 'setupSilent') {
        toast('Silent Setup started');
        kmNetSetUpdText('Silent Setup running...');
        return;
      }
      if (ev.type === 'updateReady') {
        var out = document.getElementById('kmNetUpdOut');
        if (out) out.textContent = 'Թարմացումը պատրաստ է՝ ' + (ev.update || '') + '։ Վերագործարկեք KM-ը։';
        return;
      }
      if (ev.type === 'received' || ev.type === 'autosent' || ev.type === 'sentAll' || ev.type === 'reported') {
        if (kmNetTab === 'upd') return;
        /* KM_PERF_FAST_V1: coalesce transfer refreshes */
        scheduleNetRefresh(kmNetTab, true, ev.type === 'received' ? 5000 : 6000); /* KM_PERF_FAST_V3 */
      } else if (ev.type === 'peer' || ev.type === 'status' || ev.type === 'sent' || ev.type === 'peerJoined') {
        /* KM_NET_NO_REFRESH_LOOP_V1 + KM_PERF_FAST_V1 */
        if (kmNetTab === 'upd' || kmNetTab === 'hist') return;
        scheduleNetRefresh(kmNetTab, true, 20000); /* KM_PERF_FAST_V3 */
      }
    });
  }

  function startPoll() {
    /* KM_NET_NO_REFRESH_LOOP_V1 */
    stopPoll();
    kmNetPoll = setInterval(function () {
      if (!kmNetViewActive()) { stopPoll(); return; }
      if (document.hidden) return; /* KM_PERF_FAST_V3 */
      if (kmNetOpBusy) return;
      if (kmNetTab !== 'net' && kmNetTab !== 'auto' && kmNetTab !== 'xfer') return;
      var a = document.activeElement;
      if (a && /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(a.tagName)) return;
      scheduleNetRefresh(kmNetTab, true, 12000); /* KM_PERF_FAST_V3 */
    }, 60000); /* KM_PERF_FAST_V3 */
  }
  function stopPoll() {
    if (kmNetPoll) { clearInterval(kmNetPoll); kmNetPoll = null; }
    if (kmNetRefreshTimer) { clearTimeout(kmNetRefreshTimer); kmNetRefreshTimer = null; }
  }

  async function loadAll() {
    var n = api();
    var st = await n.status();
    var inbox = [];
    var hist = [];
    var lan = null;
    try { inbox = await n.inbox(); } catch (e) {}
    /* KM_NET_RECV_AUTO_V1 onload KM_SYNC + KM_ADMIN_HANG_V1: never on Hub */
    try {
      if (!(st && st.updateServer)) {
        var syncHit = (inbox || []).filter(function (f) { return /KM_SYNC\.json$/i.test(String((f && f.name) || '')); })[0];
        if (syncHit && syncHit.path && typeof window.kmNetApplyInboxSync === 'function') {
          window.kmNetApplyInboxSync(syncHit.path, { auto: true, quiet: true });
        }
      } else {
        try { lanLog('hub skip onload KM_SYNC apply'); } catch (_) {}
      }
    } catch (_) {}
    try { hist = await n.history(); } catch (e) {}
    try {
      var la = lanApi();
      if (la) lan = await la.status();
    } catch (e2) {}
    if (lan) {
      kmLanLive.wsState = lan.wsState || (lan.wsConnected ? 'connected' : lan.wsListening ? 'listening' : 'disconnected');
      kmLanLive.syncProgress = lan.syncProgress || {};
      kmLanLive.serverUrl = lan.serverUrl || '';
      kmLanLive.canonicalHub = !!lan.canonicalHub;
      kmLanLive.foreignClient = !!lan.foreignClient;
    }
    return { st: st, inbox: inbox, hist: hist, lan: lan };
  }

  function tabBtn(id, label) {
    return '<button type="button" class="' + (kmNetTab === id ? 'active' : '') + '" onclick="kmNetPage(\'' + id + '\')">' + label + '</button>';
  }

  function rewriteRetiredHubText(s) {
    return String(s || '').split('192.168.11.73').join('192.168.11.87');
  }

  function hostFromLanUrl(u) {
    try {
      var x = rewriteRetiredHubText(String(u || '').trim());
      if (!x) return '';
      if (!/^https?:\/\//i.test(x)) x = 'http://' + x;
      return String(new URL(x).hostname || '').trim();
    } catch (_) {
      return '';
    }
  }

  function renderHubCandidates(lan) {
    lan = lan || {};
    var list = (lan.hubCandidates || []).map(function (h) {
      if (!h) return h;
      return Object.assign({}, h, { ip: rewriteRetiredHubText(h.ip || '') });
    }).filter(function (h) { return h && h.ip && h.ip !== '192.168.11.73'; });
    var currentUrl = rewriteRetiredHubText(String(lan.serverUrl || ''));
    var currentHost = hostFromLanUrl(currentUrl);
    var live = list.filter(function (h) { return h && h.live; });
    var warn = '';
    if (currentHost && live.length && !live.some(function (h) { return h.ip === currentHost; })) {
      warn = '<div class="kmLanHubWarn">Պահված Hub IP-ն <b>' + esc(currentHost) +
        '</b> կենդանի Hub չէ։ Գրանցումը և տվյալները գնում են այս հասցեին, ոչ թե իրական Hub-ին։ Սեղմեք «Միանալ այս Hub-ին» իրական սերվերի վրա։</div>';
    }
    if (!list.length) {
      return '<div class="kmLanHubs" style="margin-top:10px">' +
        '<p class="kmLanMeta" style="margin:0">Կենդանի Hub սերվեր դեռ չի երևում։ Սկսեք լսումը/ավտոմատ փնտրումը կամ մուտքագրեք իրական Hub-ի IP-ն։</p>' +
        (currentHost ? '<p class="kmLanMeta" style="margin:6px 0 0">Հիմա պահված է՝ <b>' + esc(currentHost) + '</b></p>' : '') +
        '</div>';
    }
    var rows = list.map(function (h) {
      var ip = String(h.ip || '');
      var port = Number(h.port) || 18094;
      var url = 'http://' + ip + ':' + port;
      var cur = currentHost && ip === currentHost;
      var tag = h.live ? 'կենդանի' : 'հին';
      return '<div class="kmLanHubRow' + (cur ? ' current' : '') + '">' +
        '<span>' + esc(h.name || ip) + ' · <b>' + esc(ip) + '</b>:' + esc(String(port)) +
        ' · ' + tag + (cur ? ' · ընտրված' : '') + '</span>' +
        (cur
          ? ''
          : '<button type="button" onclick="kmLanPickHub(' + JSON.stringify(url) + ')">Միանալ այս Hub-ին</button>') +
        '</div>';
    }).join('');
    return '<div class="kmLanHubs" style="margin-top:10px">' +
      '<p class="kmLanMeta" style="margin:0 0 6px">Գտնված Hub սերվերներ — միացեք <b>իրական</b> կենտրոնական կայանի IP-ին։ Hub նշանը պետք է միացված լինի միայն այդ մեկ համակարգչում։</p>' +
      rows + warn +
      '</div>';
  }

  function renderLanSync(lan, st) {
    lan = lan || {};
    st = st || {};
    var role = lan.effectiveRole || 'client';
    if (lan.canonicalHub || (st.updateServer && !lan.foreignClient)) role = 'server';
    if (lan.foreignClient) role = 'client';
    var wsState = lan.wsState || kmLanLive.wsState || 'disconnected';
    var sp = lan.syncProgress || kmLanLive.syncProgress || {};
    var isClient = role === 'client';
    var serverUrl = rewriteRetiredHubText(lan.serverUrl || '');
    var wsUrl = rewriteRetiredHubText(lan.wsUrl || '');
    var clientIdle = isClient && (lan.syncIdle || (!String(serverUrl).trim() && !String(wsUrl).trim()));
    if (clientIdle) wsState = 'idle';
    var pct = syncStatusPct(sp);
    var statusText = clientIdle
      ? 'Սերվերի հասցեն կարգավորված չէ — համաժամեցումը անջատված է'
      : syncStatusLabel(sp);
    var syncPaths = (lan.syncPaths || []).slice(0, 8).join(', ');
    return '<div class="kmLanPanel">' +
      '<h4 style="margin:0 0 8px">Անմիջական համաժամեցում (LAN)</h4>' +
      '<p class="muted" style="margin:0 0 10px">BotKnowledge (knowledge.db, qa.jsonl) atomic snapshot + WebSocket իրադարձություններ։ Կենտրոնական կայանում փոփոխության դեպքում հաճախորդ կայանը ավտոմատ ներբեռնում է DB snapshot և FTS ինդեքսը թարմացնում։</p>' +
      '<div class="kmLanMode">' +
        '<label><input type="radio" name="kmLanRoleRadio" value="server"' + (role === 'server' ? ' checked' : '') + ' onchange="kmLanSetRole()"> Կենտրոնական կայան (այս համակարգիչը)</label>' +
        '<label><input type="radio" name="kmLanRoleRadio" value="client"' + (role === 'client' ? ' checked' : '') + ' onchange="kmLanSetRole()"> Հաճախորդ կայան</label>' +
      '</div>' +
      (isClient
        ? '<label>Սերվերի IP / հասցե<input id="kmLanServerUrl" placeholder="http://192.168.1.100:18094" value="' + esc(serverUrl || '') + '"></label>'
        : '<label>WebSocket նավահանգիստ<input id="kmLanWsPort" type="number" value="' + esc(String(lan.wsPort || 18096)) + '" title="WS port"></label>') +
      '<div class="kmLanConn">' +
        '<span id="kmLanWsBadge" class="kmLanBadge ' + wsStateClass(wsState) + '"></span>' +
        '<span id="kmLanWsStatus">' + esc(wsStateLabel(wsState)) + '</span>' +
      '</div>' +
      (wsUrl ? '<p class="kmLanMeta">WS՝ ' + esc(wsUrl) + (role === 'server' && lan.wsClients != null ? ' · clients՝ ' + lan.wsClients : '') + '</p>' : '') +
      '<div class="kmLanProg"><div id="kmLanProgBar" class="kmLanProgBar' + (sp.botRefresh ? ' bot' : '') + '" style="width:' + pct + '%"></div></div>' +
      '<p class="kmLanMeta" id="kmLanProgMeta">' + esc(statusText) + '</p>' +
      '<p class="kmLanMeta" id="kmLanBotRefresh"></p>' +
      '<div class="toolbar" style="margin-top:8px">' +
        (isClient
          ? '<button type="button" class="primary" onclick="kmLanSaveConnect()">Պահպանել և միանալ</button>' +
            '<button type="button" onclick="kmLanAdoptHub()">Գտնել կենդանի Hub</button>'
          : '<button type="button" onclick="kmLanApplyServer()">Կիրառել կենտրոնական կայանը</button>') +
        '<label style="display:flex;gap:6px;align-items:center;font-size:13px;margin:0">' +
          '<input id="kmLanAutoReconnect" type="checkbox"' + (lan.autoReconnect !== false ? ' checked' : '') + '> Ինքնամիացում' +
        '</label>' +
      '</div>' +
      (isClient ? renderHubCandidates(lan) : '') +
      (syncPaths ? '<p class="kmLanMeta" style="margin-top:8px">Համաժամեցվող ուղիներ՝ ' + esc(syncPaths) + '…</p>' : '') +
    '</div>';
  }

  function renderNet(st, lan) {
    var ips = (st.ips || []).map(function (a) {
      return '<div class="in">' + esc(a.ip) + '  (' + esc(a.name) + ')</div>';
    }).join('') || '<div class="muted">IPv4 հասցե չի գտնվել</div>';
    var peers = (st.peers || []).filter(function (p) { return p && p.ip !== '192.168.11.73'; }).map(function (p) {
      return '<tr>' +
        '<td>' + esc(p.name) + (p.updateServer ? ' <b>· Hub</b>' : '') + '</td>' +
        '<td class="kmNetIps">' + esc(p.ip) + ':' + esc(p.port) + '</td>' +
        '<td>' + (p.stale ? 'հին' : 'առցանց') + '</td>' +
        '<td><button type="button" onclick="kmNetSend(' + JSON.stringify(p.ip) + ',' + Number(p.port) + ')">Ուղարկել ֆայլ</button></td>' +
        '</tr>';
    }).join('') || '<tr><td colspan="4" class="muted">Դեռ կայան չի երևում։ Ավելացրեք IP կամ սկանավորեք ենթացանցը։</td></tr>';
    var listen = st.listening
      ? '<span class="kmNetDot on"></span>Լսում է · նավահանգիստ ' + esc(st.port)
      : '<span class="kmNetDot off"></span>Անջատված է';
    var modeHint = st.mode === 'internet'
      ? '<p class="muted"><b>Online</b>՝ այս համակարգիչը Hub սերվեր է (լսում է 0.0.0.0)։ Մյուս կայանները մուտքագրում են այս PC-ի հանրային/VPN IP-ն և <b>նույն մուտքի կոդը</b>։ Ամպ չկա։</p>'
      : '<p class="muted"><b>Local</b>՝ այս համակարգիչը նույնպես Hub սերվեր է տեղական ցանցում։ Մյուս կայանները գտնվում են ավտոմատ կամ IP-ով։</p>';
    return '<div class="card">' +
      '<h3 style="margin-top:0">Ցանց</h3>' +
      '<p>' + listen + ' · ռեժիմ՝ <b>' + (st.mode === 'internet' ? 'Online (Internet)' : 'Local') + '</b>' +
        (st.updateServer ? ' · <b>Hub սերվեր՝ այս PC</b>' : '') + '</p>' +
      modeHint +
      '<p class="muted">Ծրագիրը աշխատում է և՛ Local, և՛ Online։ Երկու դեպքում էլ սերվերի դերը տանում է <b>այս համակարգիչը</b> (Hub)։</p>' +
      '<div class="toolbar">' +
        (st.listening
          ? '<button type="button" onclick="kmNetStop()">Դադարեցնել լսումը</button>'
          : '<button type="button" class="primary" onclick="kmNetStart()">Սկսել լսումը (սերվեր)</button>') +
        '<button type="button" onclick="kmNetScan()">Սկանավորել կայանները</button>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-top:12px">' +
        '<label>Կայանի անուն<input id="kmNetName" value="' + esc(st.name) + '"></label>' +
        '<label>Ռեժիմ<select id="kmNetMode" onchange="kmNetOnModeChange()">' +
          '<option value="local"' + (st.mode === 'local' ? ' selected' : '') + '>Local — ներքին ցանց</option>' +
          '<option value="internet"' + (st.mode === 'internet' ? ' selected' : '') + '>Online — ինտերնետ</option>' +
        '</select></label>' +
        '<label>Մուտքի կոդ<input id="kmNetCode" value="' + esc(st.code) + '" placeholder="Online-ի համար · LAN-ում կայանները ինքն են վերցնում"></label>' +
      '</div>' +
      '<label style="display:flex;gap:8px;align-items:flex-start;margin-top:12px;font-size:13px"' + (isAdmin() ? '' : ' class="km-admin-only"') + '>' +
        '<input id="kmNetUpdateServer" type="checkbox"' + (st.updateServer ? ' checked' : '') + (isAdmin() ? '' : ' disabled data-km-keep-disabled="1"') + '> <span><b>Hub սերվեր (այս համակարգիչ)</b> — Local և Online ռեժիմներում մյուս կայանների տվյալները կենտրոնանում են այստեղ և բաշխվում բոլոր միացվածներին։</span>' +
      '</label>' +
      '<label style="display:flex;gap:8px;align-items:flex-start;margin-top:10px;font-size:13px">' +
        '<input id="kmNetReportToAdmin" type="checkbox"' + (st.reportToAdmin !== false ? ' checked' : '') + '> <span>Պահպանումից հետո ընդհանուր տվյալները / Outbox ֆայլերը ուղարկել Hub կամ բաշխել կայաններին (նախազգուշացում + push)</span>' +
      '</label>' +
      (isAdmin() ? '' : (st.updateServer
        ? '<p class="muted">Այս կայանը Hub է։ Hub նշանը կարգավորում է միայն Administrator։</p>'
        : '<p class="muted">Պահպանելիս տվյալները գնում են Hub, հետո բոլոր կայաններ։ Դիտորդը տեսնում է, բայց արգելված բաժիններում խմբագրումը մնում է արգելված։</p>')) +
      '<div class="toolbar" style="margin-top:10px"><button type="button" onclick="kmNetSaveCfg()">Պահպանել կարգավորումը</button></div>' +
      renderLanSync(lan, st) +
      '<h4>Այս համակարգչի IP</h4>' +
      '<div class="kmNetIps">' + ips + '</div>' +
    '</div>' +
    '<div class="card">' +
      '<h3 style="margin-top:0">Կայաններ</h3>' +
      '<div class="toolbar">' +
        '<input id="kmNetPeerHost" placeholder="' + (st.mode === 'internet' ? 'Սերվերի կամ կայանի IP (օր. 185.x.x.x)' : 'օր. 192.168.1.10 կամ host:18094') + '" style="min-width:220px">' +
        '<button type="button" onclick="kmNetAddPeer()">' + (st.mode === 'internet' ? 'Գտնել սերվեր / կայան' : 'Ավելացնել / ստուգել') + '</button>' +
      '</div>' +
      '<div class="gridwrap" style="margin-top:10px"><table class="grid"><thead><tr><th>Անուն</th><th>IP</th><th>Վիճակ</th><th></th></tr></thead><tbody>' + peers + '</tbody></table></div>' +
      '</div>';
  }

  function renderAuto(st) {
    var live = (st.peers || []).filter(function (p) { return !p.stale; });
    var rows = live.map(function (p) {
      return '<tr><td>' + esc(p.name) + '</td><td class="kmNetIps">' + esc(p.ip) + ':' + esc(p.port) + '</td><td><span class="kmNetDot on"></span>միացված</td>' +
        '<td><button type="button" onclick="kmNetSend(' + JSON.stringify(p.ip) + ',' + Number(p.port) + ')">Ուղարկել ֆայլ</button></td></tr>';
    }).join('') || '<tr><td colspan="4" class="muted">Դեռ միացված կայան չկա։ Սկսեք ավտոմատ փնտրումը։</td></tr>';
    var hint = st.mode === 'internet'
      ? 'Internet-ում KM-ը պահում է գտնված հասցեները և շարունակ պինգ է անում։ Սերվերը տեսնում է օգտատիրոջը, երբ նա մի անգամ կապ է հաստատում։ Նույն մուտքի կոդը պարտադիր է։'
      : 'Local-ում փնտրում է ձեր ենթացանցի միացված KM կայանները։';
    return '<div class="card">' +
      '<h3 style="margin-top:0">Ավտոմատ փնտրում</h3>' +
      '<p>' + (st.autoSearch
        ? '<span class="kmNetDot on"></span>Ավտոմատ փնտրումը միացված է · գտնված միացվածներ՝ <b>' + live.length + '</b>'
        : '<span class="kmNetDot off"></span>Ավտոմատ փնտրումը անջատված է') + '</p>' +
      '<p class="muted">' + hint + ' Գտնված միացված համակարգիչներին կարող եք ֆայլ ուղարկել մեկ սեղմումով։ Եթե նշեք «նոր գտնվածներին էլ», նոր միացած կայաններին ֆայլը կուղարկվի ինքնաբերաբար։</p>' +
      '<div class="toolbar">' +
        (st.autoSearch
          ? '<button type="button" onclick="kmNetAutoStop()">Դադարեցնել փնտրումը</button>'
          : '<button type="button" class="primary" onclick="kmNetAutoStart()">Սկսել ավտոմատ փնտրումը</button>') +
        '<button type="button" class="primary" onclick="kmNetSendAll()">Ուղարկել ֆայլ բոլոր միացվածներին</button>' +
      '</div>' +
      '<label style="display:flex;gap:8px;align-items:flex-start;margin-top:12px;font-size:13px">' +
        '<input id="kmNetKeepAuto" type="checkbox"' + (window.kmNetKeepAutoFlag ? ' checked' : '') + ' onchange="window.kmNetKeepAutoFlag=this.checked"> <span>Նոր գտնված միացված կայաններին էլ ուղարկել նույն ֆայլը</span>' +
      '</label>' +
      (st.autoSendPath ? '<p class="muted" style="margin-top:8px">Ավտոմատ ուղարկվող ֆայլ՝ <b>' + esc(st.autoSendPath.split(/[/\\\\]/).pop()) + '</b></p>' : '') +
    '</div>' +
    '<div class="card">' +
      '<h3 style="margin-top:0">Միացված համակարգիչներ</h3>' +
      '<div class="gridwrap"><table class="grid"><thead><tr><th>Անուն</th><th>Հասցե</th><th>Վիճակ</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
    '</div>';
  }

  function renderXfer(st, inbox) {
    /* KM_NET_RECV_AUTO_V1 filter */
    var visible = (inbox || []).filter(function (f) {
      if (f && f.system) return false;
      return !isSystemRecvName(f && f.name);
    });
    var rows = visible.map(function (f) {
      return '<tr>' +
        '<td>' + esc(f.name) + '</td>' +
        '<td>' + fmtSize(f.size) + '</td>' +
        '<td>' + esc(fmtWhen(f.mtime)) + '</td>' +
        '<td><button type="button" data-km-net-open="' + esc(f.path) + '">Բացել</button>' +
        (/km_sync|\.json$/i.test(f.name || '') ? ' <button type="button" data-km-net-apply="' + esc(f.path) + '">Միացնել բազային</button>' : '') +
        '</td>' +
        '</tr>';
    }).join('') || '<tr><td colspan="4" class="muted">Ստացված ֆայլեր չկան</td></tr>';
    return '<div class="card">' +
      '<h3 style="margin-top:0">Փոխանցել և ստանալ</h3>' +
      '<p class="muted">Սեղմեք «Ընտրել ֆայլ և ուղարկել»։ Hub-ում ստացված ֆայլը ավտոմատ բաշխվում է մյուս կայաններին։ Առավելագույնը 512 MB։</p>' +
      '<div class="toolbar">' +
        '<input id="kmNetSendHost" placeholder="Ստացողի IP (դատարկ = բոլոր միացվածները)" style="min-width:220px">' +
        '<input id="kmNetSendPort" type="number" value="' + esc(st.port) + '" style="width:90px" title="Նավահանգիստ">' +
        '<button type="button" class="primary" onclick="kmNetSend()">Ընտրել ֆայլ և ուղարկել</button>' +
        '<button type="button" onclick="kmNetOpenInbox()">Ստացվածների պանակ</button>' +
        '<button type="button" onclick="kmNetOpenOutbox()">Outbox (կիսվող)</button>' +
        '<button type="button" onclick="kmNetReportNow()">Հիմա կիսել Outbox / բազան</button>' +
      '</div>' +
      '<p class="muted" style="margin-top:8px">Լրացուցիչ ֆայլեր՝ <b>' + esc(st.outboxDir || '') + '</b>։ Պահպանումից հետո KM_SYNC-ը ավտոմատ է դուրս գալիս։</p>' +
    '</div>' +
    '<div class="card">' +
      '<h3 style="margin-top:0">Ստացված ֆայլեր</h3>' +
      '<div class="gridwrap"><table class="grid"><thead><tr><th>Ֆայլ</th><th>Չափ</th><th>Ժամանակ</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
    '</div>';
  }

  function renderUpd(st) {
    var installPlace = esc(st.updateStagingDir || '');
    if (!isAdmin()) {
      return '<div class="card">' +
        '<h3 style="margin-top:0">Թարմացումներ</h3>' +
        '<p>Տարբերակ՝ <b>' + esc(st.version || '') + '</b> · Թարմացում՝ <b>' + esc(st.update || '') + '</b></p>' +
      (installPlace ? '<p class="muted">Թարմացման տեղադրման պանակը՝ <b>' + installPlace + '</b>։ Ներբեռնված թարմացումը կկիրառվի KM-ի վերագործարկման ժամանակ։</p>' : '') +
      (installPlace ? '<div class="toolbar" style="margin-top:8px"><button type="button" onclick="kmNetOpenUpdateStaging()">Բացել տեղադրման պանակը</button></div>' : '') +
        '<p class="muted">Սեղմեք «Թարմացնել» — KM-ը կգտնի Hub-ը, կներբեռնի Setup-ը և ինքնուրույն կտեղադրի, ապա կվերագործարկվի։</p>' +
        '<div class="toolbar">' +
          '<button type="button" class="primary" id="kmNetUserCheckBtn" onclick="kmOneClickUpdate()">Թարմացնել</button>' +
        '</div>' +
        '<div id="kmNetUpdOut" class="muted" style="margin-top:10px"></div>' +
      '</div>';
    }
    var servers = (st.peers || []).filter(function (p) { return p.updateServer && !p.stale; });
    var rows = servers.map(function (p) {
      return '<tr><td>' + esc(p.name) + '</td><td class="kmNetIps">' + esc(p.ip) + '</td><td>' + esc(p.update || p.km || '') + '</td>' +
        '<td><button type="button" class="primary" onclick="kmNetPullUpdate(' + JSON.stringify(p.ip) + ',' + Number(p.port) + ')">Ստանալ թարմացումը</button></td></tr>';
    }).join('') || '<tr><td colspan="4" class="muted">Առցանց թարմացման սերվեր չի երևում։ Սկսեք լսումը և ավտոմատ փնտրումը, կամ մուտքագրեք սերվերի IP-ն։</td></tr>';
    return '<div class="card">' +
      '<h3 style="margin-top:0">Թարմացումներ</h3>' +
      '<p>Տարբերակ՝ <b>' + esc(st.version || '') + '</b> · Թարմացում՝ <b>' + esc(st.update || '') + '</b></p>' +
      (st.updateServer
        ? '<p><span class="kmNetDot on"></span>Այս համակարգիչը <b>հիմնական սերվերն</b> է։ Մյուս KM կայանները այստեղից կստանան նոր թարմացումը։ Ամպ չկա։</p>'
        : '<p class="muted">Այս կայանը սերվեր չէ։ Թարմացումը ստացվում է հիմնական համակարգչից՝ տեղական ցանցով կամ ուղիղ Internet կապով։</p>') +
      '<h3>Թարմացումը տեղադրել</h3>' +
      '<p class="muted">Ստուգեք սերվերը, ապա տեղադրեք։ Կարող եք մուտքագրել սերվերի IP-ն կամ թողնել դատարկ՝ ավտոմատ գտնելու համար։</p>' +
      (installPlace ? '<p class="muted">Թարմացման տեղադրման պանակը՝ <b>' + installPlace + '</b>։ Ներբեռնված թարմացումը կկիրառվի KM-ի վերագործարկման ժամանակ։</p>' : '') +
      (installPlace ? '<div class="toolbar" style="margin-top:8px"><button type="button" onclick="kmNetOpenUpdateStaging()">Բացել տեղադրման պանակը</button></div>' : '') +
      '<div class="toolbar">' +
        '<button type="button" class="primary" id="kmNetUserCheckBtn" onclick="kmOneClickUpdate()">Թարմացնել</button>' +
        '<button type="button" onclick="kmNetPullUpdate()">Ստանալ և տեղադրել</button>' +
      '</div>' +
      '<div class="toolbar" style="margin-top:10px">' +
        '<input id="kmNetUpdHost" placeholder="Սերվերի IP (դատարկ = ավտոմատ)" style="min-width:220px">' +
        '<input id="kmNetUpdPort" type="number" value="' + esc(st.port) + '" style="width:90px">' +
      '</div>' +
      '<div id="kmNetUpdOut" class="muted" style="margin-top:10px"></div>' +
    '</div>' +
    '<div class="card">' +
      '<h3 style="margin-top:0">Գտնված թարմացման սերվերներ</h3>' +
      '<div class="gridwrap"><table class="grid"><thead><tr><th>Անուն</th><th>IP</th><th>Թարմացում</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
    '</div>';
  }
  function renderHist(hist) {
    var rows = (hist || []).map(function (r) {
      var dir = r.direction === 'in' ? 'Ստացված' : 'Ուղարկված';
      var openPath = r.archivePath || r.inboxPath || '';
      var open = openPath
        ? '<button type="button" data-km-net-open="' + esc(openPath) + '">Դիտել</button>'
        : '';
      return '<tr>' +
        '<td>' + esc(fmtWhen(r.at)) + '</td>' +
        '<td>' + dir + '</td>' +
        '<td>' + esc(r.mode === 'internet' ? 'Internet' : 'Local') + '</td>' +
        '<td>' + esc(r.peerName || '') + '<br><span class="muted kmNetIps">' + esc(r.peerIp || '') + '</span></td>' +
        '<td>' + esc(r.fileName) + '</td>' +
        '<td>' + fmtSize(r.size) + '</td>' +
        '<td>' + open + '</td>' +
        '</tr>';
    }).join('') || '<tr><td colspan="7" class="muted">Փոխանցումներ չկան</td></tr>';
    return '<div class="card">' +
      '<h3 style="margin-top:0">Փոխանցումների պատմություն</h3>' +
      '<p class="kmNetLock">Այս արխիվը չի ջնջվում և չի խմբագրվում։ Կարելի է միայն դիտել։ Պահվում է առանձին պանակում՝ UserData\\KM_Net\\archive։</p>' +
      '<div class="toolbar"><button type="button" onclick="kmNetOpenArchive()">Բացել արխիվի պանակը</button></div>' +
      '<div class="gridwrap" style="margin-top:10px"><table class="grid kmNetHist"><thead><tr>' +
        '<th>Ժամանակ</th><th>Ուղղություն</th><th>Ցանց</th><th>Կայան</th><th>Ֆայլ</th><th>Չափ</th><th></th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
    '</div>';
  }

  window.kmNetPage = async function (tab, quiet, hostEl) {
    injectCss();
    bindEvents();
    if (tab) kmNetTab = tab;
    if (!isAdmin() && kmNetTab !== 'xfer' && kmNetTab !== 'upd') kmNetTab = 'xfer';
    if (kmNetTab === 'info') {
      if (typeof window.kmSysSettingsOpen === 'function') window.kmSysSettingsOpen('sysinfo');
      else if (typeof window.kmOpenPage === 'function') window.kmOpenPage('sysinfo');
      return;
    }
    if (kmNetOpBusy && quiet) return;
    var sysMode = window.page === 'syssettings' || window._kmSysSettingsSub === 'network' || !!hostEl;
    var libMode = !sysMode && !!(window.page === 'library' && window.kmLibSection === 'network');
    var backFn = typeof window.kmContextBackOnclick === 'function'
      ? window.kmContextBackOnclick()
      : (sysMode ? 'kmSysSettingsBack()' : (libMode ? 'kmLibShowHub()' : 'kmReportsBack()'));
    if (sysMode) {
      if (typeof page !== 'undefined') page = 'syssettings';
      window.page = 'syssettings';
      window._kmSysSettingsSub = 'network';
      if (typeof kmSetActiveNav === 'function') {
        kmSetActiveNav(document.querySelector('.nav[data-page="syssettings"]'));
      }
    } else if (libMode) {
      page = 'library';
      window.page = 'library';
      if (typeof window.kmSetActiveLibNav === 'function') window.kmSetActiveLibNav('network');
    } else {
      page = 'network';
      window.page = 'network';
      if (typeof kmSetActiveNav === 'function') {
        kmSetActiveNav(document.querySelector('.nav[data-page="syssettings"]') || document.querySelector('.nav[data-page="network"]'));
      }
    }
    var pt = document.getElementById('pageTitle');
    if (pt) pt.textContent = 'Ցանց և ֆայլեր';
    var host = hostEl || document.getElementById('content');
    if (!host) return;
    var seq = ++kmNetRenderSeq;
    try {
      var admin = isAdmin();
      var tabs = admin
        ? tabBtn('net', 'Ցանց') +
          tabBtn('auto', 'Ավտոմատ փնտրում') +
          tabBtn('upd', 'Թարմացումներ') +
          tabBtn('xfer', 'Փոխանցել և ստանալ') +
          tabBtn('hist', 'Փոխանցումների պատմություն')
        : tabBtn('xfer', 'Փոխանցել և ստանալ') +
          tabBtn('upd', 'Թարմացումներ');
      if (!quiet && !host.querySelector('.kmNetTabs')) host.innerHTML = '<div class="card">Բեռնվում է…</div>';
      var data = await loadAll();
      if (seq !== kmNetRenderSeq) return;
      if (sysMode && window.page !== 'syssettings') return;
      if (!sysMode && !libMode && window.page !== 'network') return;
      if (libMode && window.page !== 'library') return;
      if (kmNetOpBusy && quiet) return;
      var prevOut = '';
      var prevOutEl = document.getElementById('kmNetUpdOut');
      if (quiet && prevOutEl) prevOut = prevOutEl.textContent || '';
      var body = kmNetTab === 'upd' ? renderUpd(data.st)
        : kmNetTab === 'hist' ? renderHist(data.hist)
        : kmNetTab === 'auto' ? renderAuto(data.st)
        : kmNetTab === 'net' ? renderNet(data.st, data.lan)
        : (renderXfer(data.st, data.inbox) + (admin ? '' : renderAuto(data.st)));
      var libBack = (sysMode || libMode)
        ? (typeof window.kmBackToolbar === 'function'
          ? window.kmBackToolbar(backFn)
          : '<div class="toolbar" style="margin-bottom:10px"><button type="button" onclick="' + backFn + '">← Վերադարձ</button></div>')
        : '';
      var html = libBack + '<div class="kmNetTabs">' + tabs + '</div>' + body;
      if (quiet && kmNetStableHtml(html) === kmNetStableHtml(kmNetLastHtml)) {
        startPoll();
        return;
      }
      kmNetLastHtml = html;
      host.innerHTML = html;
      host.querySelectorAll('[data-km-net-open]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          window.kmNetOpenFile(btn.getAttribute('data-km-net-open'));
        });
      });
      host.querySelectorAll('[data-km-net-apply]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (typeof window.kmNetApplyInboxSync === 'function') {
            window.kmNetApplyInboxSync(btn.getAttribute('data-km-net-apply'));
          }
        });
      });
      if (quiet && prevOut && kmNetTab === 'upd') {
        var outKeep = document.getElementById('kmNetUpdOut');
        if (outKeep) outKeep.textContent = prevOut;
      }
      startPoll();
      if (typeof kmApplyRoleGuard === 'function') kmApplyRoleGuard();
      if (typeof kmApplyLanguage === 'function') kmApplyLanguage();
    } catch (e) {
      if (seq !== kmNetRenderSeq) return;
      host.innerHTML = (typeof window.kmBackToolbar === 'function' ? window.kmBackToolbar(backFn) : '') +
        '<div class="card"><b>Ցանցի բաժինը չբացվեց։</b><p class="muted">' + esc(e.message || e) + '</p></div>';
      kmNetLastHtml = '';
    }
  };

  window.kmNetStart = async function () {
    if (!canEdit()) { toast('Դիտորդի իրավունք', 'error'); return; }
    try {
      await kmNetSaveCfg(true);
      await api().start();
      toast('Լսումը միացված է');
      kmNetPage(kmNetTab);
    } catch (e) { toast(errText(e), 'error'); }
  };
  window.kmNetStop = async function () {
    if (!canEdit()) { toast('Դիտորդի իրավունք', 'error'); return; }
    try {
      await api().stop();
      toast('Լսումը դադարեցված է');
      kmNetPage(kmNetTab);
    } catch (e) { toast(errText(e), 'error'); }
  };
  window.kmNetSaveCfg = async function (silent) {
    if (!canEdit()) { if (!silent) toast('Դիտորդի իրավունք', 'error'); return; }
    var name = (document.getElementById('kmNetName') || {}).value;
    var mode = (document.getElementById('kmNetMode') || {}).value;
    var code = (document.getElementById('kmNetCode') || {}).value;
    var us = document.getElementById('kmNetUpdateServer');
    var report = document.getElementById('kmNetReportToAdmin');
    var patch = {};
    if (name != null) patch.name = name;
    if (mode) patch.mode = mode;
    if (code != null) patch.code = code;
    if (us && isAdmin()) {
      patch.updateServer = !!us.checked;
      patch.adminToken = adminToken();
    }
    if (report) patch.reportToAdmin = !!report.checked;
    var st = await api().setConfig(patch);
    /* Hub սերվեր՝ ավտոմատ սկսել լսումը (Local և Online) */
    if (isAdmin() && patch.updateServer && st && !st.listening) {
      try { await api().start(); st = await api().status(); } catch (eStart) {}
    }
    if (!silent) {
      toast(st && st.listening ? 'Կարգավորումը պահպանվեց · Hub լսում է' : 'Կարգավորումը պահպանվեց');
      kmNetPage('net');
    }
    return st;
  };
  window.kmLanSetRole = async function () {
    if (!canEdit()) { toast('Դիտորդի իրավունք', 'error'); return; }
    var sel = document.querySelector('input[name="kmLanRoleRadio"]:checked');
    if (!sel) return;
    var role = sel.value;
    var la = lanApi();
    if (!la) { toast('LAN sync հասանելի չէ', 'error'); return; }
    kmNetOpBusy = true;
    try {
      var autoRec = document.getElementById('kmLanAutoReconnect');
      var patch = { role: role, autoReconnect: !autoRec || !!autoRec.checked, realtimeSync: true };
      if (role === 'server') {
        var lanSt = null;
        try { lanSt = await la.status(); } catch (_ls) {}
        if (lanSt && lanSt.foreignClient) {
          toast('Այս PC-ն Hub չէ — serverUrl-ը ուրիշ կայան է։ Hub նշանը միացրեք միայն կենտրոնական համակարգչում։', 'error');
          kmNetPage('net');
          return;
        }
        var us = document.getElementById('kmNetUpdateServer');
        if (isAdmin() && us) us.checked = true;
        await kmNetSaveCfg(true);
        var wsPortEl = document.getElementById('kmLanWsPort');
        if (wsPortEl) patch.wsPort = Number(wsPortEl.value) || 18096;
        patch.serverUrl = '';
        patch.wsUrl = '';
        await la.setConfig(patch);
        try { await api().start(); } catch (eStart) {}
        toast('Կենտրոնական կայանի ռեժիմը միացված է', 'ok');
      } else {
        var usOff = document.getElementById('kmNetUpdateServer');
        if (isAdmin() && usOff) usOff.checked = false;
        try { await api().setConfig({ updateServer: false, adminToken: adminToken() }); } catch (_eOff) {}
        var urlEl = document.getElementById('kmLanServerUrl');
        if (urlEl && urlEl.value.trim()) patch.serverUrl = urlEl.value.trim();
        await la.setConfig(patch);
        toast('Հաճախորդ կայան — մուտքագրեք սերվերի հասցեն և սեղմեք Պահպանել և միանալ', 'ok');
      }
      kmNetPage('net');
    } catch (e) {
      toast(errText(e), 'error');
    } finally {
      kmNetOpBusy = false;
    }
  };
  window.kmLanApplyServer = async function () {
    return window.kmLanSetRole();
  };
  window.kmLanUpdateSyncUi = updateLanSyncUi;
  window.kmLanSaveConnect = async function () {
    if (!canEdit()) { toast('Դիտորդի իրավունք', 'error'); return; }
    var url = rewriteRetiredHubText(((document.getElementById('kmLanServerUrl') || {}).value || '').trim());
    if (!url) { toast('Մուտքագրեք Server IP / URL (օր. http://192.168.11.87:18094)', 'warn'); return; }
    var la = lanApi();
    if (!la) { toast('LAN sync հասանելի չէ', 'error'); return; }
    markManualSync(180000);
    kmNetOpBusy = true;
    try {
      var autoRec = document.getElementById('kmLanAutoReconnect');
      await la.setConfig({
        role: 'client',
        serverUrl: url,
        autoReconnect: !autoRec || !!autoRec.checked,
        realtimeSync: true
      });
      await la.connect();
      toast('Պահպանված և միացված՝ ' + url, 'ok');
      kmNetPage('net');
    } catch (e) {
      toast(errText(e), 'error');
    } finally {
      kmNetOpBusy = false;
    }
  };
  window.kmLanPickHub = async function (url) {
    url = String(url || '').trim();
    if (!url) { toast('Hub հասցեն դատարկ է', 'warn'); return; }
    var el = document.getElementById('kmLanServerUrl');
    if (el) el.value = url;
    return window.kmLanSaveConnect();
  };
  window.kmLanAdoptHub = async function () {
    var la = lanApi();
    if (!la || !la.adoptHub) { toast('LAN sync հասանելի չէ', 'error'); return; }
    kmNetOpBusy = true;
    try {
      var r = await la.adoptHub();
      if (r && r.ok && r.serverUrl) {
        toast((r.switched ? 'Hub-ը փոխվեց՝ ' : 'Hub՝ ') + r.serverUrl, 'ok');
      } else {
        toast((r && r.error) || 'Hub չգտնվեց', 'warn');
      }
      kmNetPage('net');
    } catch (e) {
      toast(errText(e), 'error');
    } finally {
      kmNetOpBusy = false;
    }
  };
  window.kmNetOnModeChange = async function () {
    try {
      var us = document.getElementById('kmNetUpdateServer');
      if (isAdmin() && us && !us.checked) {
        us.checked = true;
      }
      await kmNetSaveCfg(true);
      toast('Ռեժիմը պահպանվեց · այս PC-ն Hub է');
      kmNetPage('net');
    } catch (e) { toast(errText(e), 'error'); }
  };
  window.kmNetScan = async function () {
    toast('Սկանավորում…');
    try {
      var r = await api().scan();
      toast('Ստուգված հասցեներ՝ ' + (r.scanned || 0) + ', կայաններ՝ ' + ((r.peers || []).length));
      kmNetPage('net');
    } catch (e) { toast(errText(e), 'error'); }
  };
  window.kmNetAddPeer = async function () {
    var host = ((document.getElementById('kmNetPeerHost') || {}).value || '').trim();
    if (!host) { toast('Մուտքագրեք IP', 'warn'); return; }
    try {
      await api().addPeer(host);
      if (window.kmNative.lanSync && window.kmNative.lanSync.adoptHub) {
        try { await window.kmNative.lanSync.adoptHub(); } catch (eAd) {}
      }
      var internet = ((document.getElementById('kmNetMode') || {}).value === 'internet');
      toast(internet ? 'Կայանը գտնվեց և պահպանվեց։ Այսուհետ կգտնվի ավտոմատ։' : 'Կայանը գտնվեց');
      kmNetPage('net');
    } catch (e) { toast(errText(e), 'error'); }
  };
  window.kmNetSend = async function (host, port) {
    if (!canEdit()) { toast('Դիտորդի իրավունք', 'error'); return; }
    if (kmNetOpBusy) return;
    host = host || ((document.getElementById('kmNetSendHost') || {}).value || '').trim();
    port = port || Number((document.getElementById('kmNetSendPort') || {}).value);
    if (host && /^\d{1,5}$/.test(host)) {
      toast('«' + host + '»-ը նավահանգիստ է, ոչ IP։ Մուտքագրեք ստացողի IP-ն կամ թողեք դատարկ՝ բոլոր միացվածներին ուղարկելու համար։', 'warn');
      return;
    }
    kmNetOpBusy = true;
    try {
      var path = await kmNetChooseFile();
      if (!path) return;
      toast('Ուղարկվում է…');
      if (host) {
        var r = await api().send({ host: host, port: port, path: path });
        if (r && r.cancelled) return;
        if (r && r.ok === false) { toast(r.error || 'Չուղարկվեց', 'error'); return; }
        toast('Ֆայլը ուղարկվեց');
      } else {
        var all = await api().sendAll({ path: path, keepAuto: !!window.kmNetKeepAutoFlag });
        if (all && all.cancelled) return;
        if (all && all.ok === false) { toast(all.error || 'Միացված կայան չկա', 'error'); return; }
        var ok = (all.results || []).filter(function (x) { return x.ok; }).length;
        toast('Ուղարկվեց միացվածներին՝ ' + ok);
      }
      kmNetOpBusy = false;
      kmNetPage(isAdmin() ? (kmNetTab === 'auto' ? 'auto' : 'hist') : 'xfer');
    } catch (e) { toast(errText(e), 'error'); }
    finally { kmNetOpBusy = false; }
  };
  async function kmNetChooseFile() {
    var native = await api().pickFile();
    if (native && native.path) return native.path;
    return '';
  }
  window.kmNetAutoStart = async function () {
    if (!canEdit()) { toast('Դիտորդի իրավունք', 'error'); return; }
    try {
      await kmNetSaveCfg(true);
      toast('Ավտոմատ փնտրում…');
      await api().autoStart();
      toast('Ավտոմատ փնտրումը միացված է');
      kmNetPage(isAdmin() ? 'auto' : 'xfer');
    } catch (e) { toast(errText(e), 'error'); }
  };
  window.kmNetAutoStop = async function () {
    if (!canEdit()) { toast('Դիտորդի իրավունք', 'error'); return; }
    try {
      await api().autoStop();
      toast('Ավտոմատ փնտրումը դադարեցված է');
      kmNetPage(isAdmin() ? 'auto' : 'xfer');
    } catch (e) { toast(errText(e), 'error'); }
  };
  window.kmNetSendAll = async function () {
    if (!canEdit()) { toast('Դիտորդի իրավունք', 'error'); return; }
    if (kmNetOpBusy) return;
    var keep = !!window.kmNetKeepAutoFlag;
    kmNetOpBusy = true;
    try {
      toast('Ընտրեք ֆայլը…');
      var path = await kmNetChooseFile();
      if (!path) return;
      toast('Ուղարկվում է միացված կայաններին…');
      var r = await api().sendAll({ path: path, keepAuto: keep });
      if (r && r.cancelled) return;
      if (r && r.ok === false) { toast(r.error || 'Միացված կայան չկա', 'error'); return; }
      var ok = (r.results || []).filter(function (x) { return x.ok; }).length;
      var bad = (r.results || []).filter(function (x) { return !x.ok; }).length;
      toast('Ուղարկվեց՝ ' + ok + (bad ? ', սխալ՝ ' + bad : ''));
      kmNetOpBusy = false;
      kmNetPage(isAdmin() ? 'auto' : 'xfer');
    } catch (e) { toast(errText(e), 'error'); }
    finally { kmNetOpBusy = false; }
  };
  window.kmNetOpenInbox = async function () {
    try { await api().openInbox(); } catch (e) { toast(errText(e), 'error'); }
  };
  window.kmNetOpenOutbox = async function () {
    try { await api().openOutbox(); } catch (e) { toast(errText(e), 'error'); }
  };
  window.kmNetReportNow = async function () {
    if (!canEdit()) { toast('Դիտորդի իրավունք', 'error'); return; }
    try {
      toast('Outbox ֆայլերը ուղարկվում են ադմինին…');
      await api().reportNow();
      toast('Ավարտվեց');
    } catch (e) { toast(errText(e), 'error'); }
  };
  window.kmNetOpenArchive = async function () {
    try { await api().openArchive(); } catch (e) { toast(errText(e), 'error'); }
  };
  window.kmNetOpenUpdateStaging = async function () {
    try {
      var r = await api().openUpdateStaging();
      if (!r || !r.ok) toast((r && r.error) || 'Պանակը չբացվեց', 'error');
    } catch (e) { toast(errText(e), 'error'); }
  };
  window.kmNetOpenFile = async function (p) {
    try {
      var r = await api().openFile({ path: p });
      if (!r || !r.ok) toast((r && r.error) || 'Չբացվեց', 'error');
    } catch (e) { toast(errText(e), 'error'); }
  };
  async function kmNetRelaunchNow() {
    try {
      if (window.kmNative && window.kmNative.app && typeof window.kmNative.app.relaunch === 'function') {
        await window.kmNative.app.relaunch();
        return;
      }
    } catch (e) {
      throw e;
    }
    throw new Error('Վերագործարկումը չհաջողվեց։ Փակեք KM-ը և բացեք նորից — թարմացումը կտեղադրվի։');
  }
  function kmNetUpdOutEl() {
    return document.getElementById('kmNetUpdOut');
  }
  function kmNetSetUpdText(msg) {
    var out = kmNetUpdOutEl();
    if (out) out.textContent = msg;
  }
  function kmNetAskUpdateConfirm(verLabel) {
    return new Promise(function (resolve) {
      var out = kmNetUpdOutEl();
      if (!out) {
        resolve(window.confirm('Գտնվել է թարմացում' + (verLabel ? ' (' + verLabel + ')' : '') + '։ Ներբեռնե՞լ և վերագործարկել KM-ը։'));
        return;
      }
      out.innerHTML =
        '<div class="kmNetConfirm">' +
          '<p>Գտնվել է թարմացում' + (verLabel ? ' (<b>' + esc(verLabel) + '</b>)' : '') + '։ Ներբեռնել և վերագործարկե՞լ KM-ը։</p>' +
          '<button type="button" class="primary" id="kmNetUpdYes">Այո, ներբեռնել</button>' +
          '<button type="button" id="kmNetUpdNo">Ոչ</button>' +
        '</div>';
      var yes = document.getElementById('kmNetUpdYes');
      var no = document.getElementById('kmNetUpdNo');
      function done(v) {
        if (yes) yes.onclick = null;
        if (no) no.onclick = null;
        resolve(v);
      }
      if (yes) yes.onclick = function () { done(true); };
      if (no) no.onclick = function () { done(false); };
    });
  }
  async function kmNetEnsureDiscovery() {
    try { await api().autoStart(); } catch (e0) {}
    try {
      if (window.kmNative && window.kmNative.lanSync && typeof window.kmNative.lanSync.ensureHub === 'function') {
        await window.kmNative.lanSync.ensureHub({ scan: true, force: true });
      }
    } catch (e1) {}
    await new Promise(function (r) { setTimeout(r, 300); });
  }
  async function kmNetLanHubHint() {
    var out = { host: '', port: 18094, lanUrl: '' };
    try {
      var la = window.kmNative && window.kmNative.lanSync;
      if (la && typeof la.status === 'function') {
        var ls = await la.status();
        var url = String((ls && ls.serverUrl) || '').trim();
        if (url) {
          if (!/^https?:\/\//i.test(url)) url = 'http://' + url;
          var u = new URL(url);
          out.host = u.hostname || '';
          out.port = Number(u.port) || 18094;
          out.lanUrl = url;
        }
      }
    } catch (_) {}
    try {
      var st = await api().status();
      if ((!out.host) && st && st.lastHub && st.lastHub.ip) {
        out.host = st.lastHub.ip;
        out.port = Number(st.lastHub.port) || 18094;
        out.lanUrl = 'http://' + out.host + ':' + out.port;
      }
      if ((!out.host) && st && Array.isArray(st.peers)) {
        var hub = st.peers.filter(function (p) { return p && p.updateServer && p.ip && !p.stale; })[0];
        if (hub) {
          out.host = hub.ip;
          out.port = Number(hub.port) || 18094;
          out.lanUrl = 'http://' + out.host + ':' + out.port;
        }
      }
    } catch (_) {}
    return out;
  }
  async function kmNetUserCheckAndApply() {
    /* KM_CLIENT_UPDATE_AUTO_V1: one click → find Hub → download Setup/files → relaunch/apply */
    if (kmNetOpBusy) return;
    kmNetOpBusy = true;
    if (kmNetRefreshTimer) { clearTimeout(kmNetRefreshTimer); kmNetRefreshTimer = null; }
    var btn = document.getElementById('kmNetUserCheckBtn') || document.getElementById('kmUpdateBtn');
    if (btn) {
      btn.disabled = true;
      btn.setAttribute('data-km-keep-disabled', '1');
    }
    kmNetSetUpdText('Hub-ը որոնվում է…');
    toast('Թարմացումը ստուգվում է…');
    try {
      try { if (api().clearUpdateStaging) await api().clearUpdateStaging(); } catch (eClr) {}
      await kmNetEnsureDiscovery();
      var hint = await kmNetLanHubHint();
      kmNetSetUpdText('Ստուգվում է թարմացումը…');
      var r = await api().checkUpdate({
        host: hint.host || '',
        port: hint.port,
        lanUrl: hint.lanUrl || ''
      });
      if ((!r || !r.available || !r.server) && hint.host) {
        r = await api().checkUpdate({ lanUrl: hint.lanUrl });
      }
      if (r && r.staged) {
        kmNetSetUpdText('Թարմացումը արդեն ներբեռնված է։ Վերագործարկվում է…');
        toast('Թարմացումը պատրաստ է — KM-ը վերագործարկվում է');
        await kmNetRelaunchNow();
        return;
      }
      if (!r || !r.available || !r.server) {
        var none = r && r.hubSeen
          ? ('Նոր թարմացում չկա։ Այժմ՝ ' + ((r.mine && r.mine.update) || ''))
          : (r && r.lastErr
            ? ('Hub չի պատասխանում։ ' + r.lastErr)
            : 'Hub չի գտնվել ցանցում։ Սեղմեք Թարմացնել նորից, երբ կենտրոնական կայանը միացված է։');
        kmNetSetUpdText(none);
        toast(none, r && r.hubSeen ? 'ok' : 'error');
        return;
      }
      var verLabel = (r.update || (r.server && r.server.update) || '');
      kmNetSetUpdText('Ներբեռնվում է ' + verLabel + '…');
      toast('Ներբեռնվում է թարմացումը՝ ' + verLabel);
      var p = await api().pullUpdate({
        host: r.server.host,
        port: r.server.port,
        lanUrl: hint.lanUrl || ''
      });
      if (p && p.already) {
        var already = 'Արդեն վերջին թարմացումն է։';
        kmNetSetUpdText(already);
        toast(already);
        return;
      }
      /* KM_OTA_RESEAL_RELAUNCH_V1: quit+relaunch so applyPending installs Setup / copies files / reseals */
      if (p && (p.setupPending || (p.setup && p.setup.deferred))) {
        kmNetSetUpdText('Setup պատրաստ է (' + (p.update || verLabel) + ')։ Վերագործարկվում է…');
        toast('Թարմացումը պատրաստ է — KM-ը վերագործարկվում է');
      } else {
        kmNetSetUpdText('Թարմացումը պատրաստ է (' + (p.update || verLabel) + ')։ Վերագործարկվում է…');
        toast('Թարմացումը պատրաստ է — վերագործարկում');
      }
      await kmNetRelaunchNow();
    } catch (e) {
      kmNetSetUpdText(errText(e));
      toast(errText(e), 'error');
    } finally {
      kmNetOpBusy = false;
      btn = document.getElementById('kmNetUserCheckBtn') || document.getElementById('kmUpdateBtn');
      if (btn) {
        btn.removeAttribute('data-km-keep-disabled');
        btn.disabled = false;
      }
    }
  }

  window.kmNetCheckUpdate = async function () {
    if (!isAdmin()) {
      await kmNetUserCheckAndApply();
      return;
    }
    if (kmNetOpBusy) return;
    kmNetOpBusy = true;
    var host = ((document.getElementById('kmNetUpdHost') || {}).value || '').trim();
    var port = Number((document.getElementById('kmNetUpdPort') || {}).value);
    kmNetSetUpdText('Ստուգվում է…');
    try {
      if (!host) await kmNetEnsureDiscovery();
      var r = await api().checkUpdate({ host: host, port: port });
      if (r.available && r.server) {
        var msg = 'Նոր թարմացում՝ ' + r.server.update + ' (' + (r.server.name || r.server.host) + ')։ Այժմ՝ ' + ((r.mine && r.mine.update) || '');
        kmNetSetUpdText(msg);
        toast(msg);
      } else {
        var msg2 = 'Նոր թարմացում չկա։ Տարբերակ՝ ' + ((r.mine && r.mine.version) || '') + ', թարմացում՝ ' + ((r.mine && r.mine.update) || '');
        kmNetSetUpdText(msg2);
        toast(msg2);
      }
    } catch (e) {
      kmNetSetUpdText(e.message || String(e));
      toast(errText(e), 'error');
    } finally {
      kmNetOpBusy = false;
    }
  };
  window.kmNetPullUpdate = async function (host, port) {
    if (!isAdmin()) {
      await kmNetUserCheckAndApply();
      return;
    }
    if (kmNetOpBusy) return;
    kmNetOpBusy = true;
    host = host || ((document.getElementById('kmNetUpdHost') || {}).value || '').trim();
    port = port || Number((document.getElementById('kmNetUpdPort') || {}).value);
    kmNetSetUpdText('Թարմացումը բեռնվում է…');
    try {
      if (!host) await kmNetEnsureDiscovery();
      var r = await api().pullUpdate({ host: host, port: port, adminToken: adminToken() });
      if (r && r.already) {
        toast('Արդեն վերջին թարմացումն է');
        kmNetSetUpdText('Արդեն վերջին թարմացումն է։');
        return;
      }
      kmNetSetUpdText('Ստացվեց ' + (r.update || '') + ' (' + (r.files || 0) + ' ֆայլ)' +
        (r.stagingDir ? ('։ Տեղադրման պանակ՝ ' + r.stagingDir) : '') +
        '։ Վերագործարկեք KM-ը։');
      var out = kmNetUpdOutEl();
      if (out) {
        out.innerHTML =
          '<div class="kmNetConfirm">' +
            '<p>Թարմացումը ստացվեց (<b>' + esc(r.update || '') + '</b>)։ Վերագործարկե՞լ KM-ը հիմա։</p>' +
            '<button type="button" class="primary" id="kmNetUpdRestartYes">Այո, վերագործարկել</button>' +
            '<button type="button" id="kmNetUpdRestartNo">Ոչ</button>' +
          '</div>';
        var y = document.getElementById('kmNetUpdRestartYes');
        var n = document.getElementById('kmNetUpdRestartNo');
        if (y) y.onclick = async function () { await kmNetRelaunchNow(); };
        if (n) n.onclick = function () { kmNetSetUpdText('Թարմացումը պատրաստ է։ Վերագործարկեք KM-ը ձեռքով։'); };
      }
    } catch (e) {
      kmNetSetUpdText(e.message || String(e));
      toast(errText(e), 'error');
    } finally {
      kmNetOpBusy = false;
    }
  };
  window.kmNetKeepAutoFlag = window.kmNetKeepAutoFlag || false;
  window.kmLanMarkManualSync = markManualSync;
  window.kmOneClickUpdate = function () {
    return kmNetUserCheckAndApply();
  };
  function bindHeaderUpdateBtn() {
    var btn = document.getElementById('kmUpdateBtn');
    if (!btn || btn.__kmBound) return;
    btn.__kmBound = true;
    btn.onclick = function () { window.kmOneClickUpdate(); };
  }
  function isSuperAdmin() {
    try {
      if (window.kmSuperAdmin === true) return true;
      if (sessionStorage.getItem('km_auth_super') === '1') return true;
    } catch (e) {}
    return false;
  }
  window.kmOpenHubVault = async function () {
    if (!isSuperAdmin()) {
      toast('Զրույցներն ու պահպանված ֆայլերը տեսնում է միայն սուպեր ադմինը', 'warn');
      return;
    }
    var host = document.getElementById('content');
    if (!host) return;
    var token = adminToken();
    var conv = { rows: [] };
    var vault = { rows: [] };
    try {
      conv = await window.kmNative.conversations.list({ adminToken: token, limit: 200 });
    } catch (e1) {
      conv = { rows: [], error: errText(e1) };
    }
    try {
      vault = await window.kmNative.retention.list({ adminToken: token });
    } catch (e2) {
      vault = { rows: [], error: errText(e2) };
    }
    var convRows = (conv.rows || []).map(function (r) {
      return '<tr><td>' + esc(r.ts || '') + '</td><td>' + esc(r.user || '') +
        '<div class="muted">' + esc(r.station || '') + '</div></td>' +
        '<td>' + esc(r.q || '') + '</td><td>' + esc(String(r.a || '').slice(0, 280)) + '</td></tr>';
    }).join('') || '<tr><td colspan="4" class="muted">Զրույց չկա</td></tr>';
    var fileRows = (vault.rows || []).map(function (r) {
      return '<tr><td>' + esc(r.section || '') + '</td><td>' + esc(r.name || r.id || '') +
        '</td><td>' + esc(r.deletedAt || '') + '</td><td>' + esc(r.keepUntil || '') +
        '</td><td><button type="button" data-km-vault-restore="' + esc(r.id) +
        '" data-section="' + esc(r.section || '') + '">Վերականգնել</button></td></tr>';
    }).join('') || '<tr><td colspan="5" class="muted">Պահպանված ջնջված ֆայլ չկա</td></tr>';
    host.innerHTML =
      '<div class="card" id="kmHubVaultRoot">' +
      (typeof window.kmBackToolbar === 'function' ? window.kmBackToolbar("kmOpenPage('admins')") : '') +
      '<h3 style="margin-top:0">Կենտրոնացված զրույցներ և 6-ամսյա պահոց</h3>' +
      '<p class="muted">Բոլոր կորպուսների զրույցները մեկ կենտրոնական արխիվում են։ Երբ Gemini API-ն միանում է համակարգչին, կատարվում է run և դրանք անցնում են գիտելիքների բազա։ Սովորական օգտատերը չի կարող ջնջել։ Պահպանումը՝ 6 ամիս։</p>' +
      '<div class="toolbar">' +
      '<button type="button" id="kmHubPruneConv">Մաքրել 6 ամսից հին զրույցները</button>' +
      '<button type="button" id="kmHubPruneVault">Մաքրել 6 ամսից հին ֆայլերը</button>' +
      '</div>' +
      (conv.error ? '<p class="muted">' + esc(conv.error) + '</p>' : '') +
      (vault.error ? '<p class="muted">' + esc(vault.error) + '</p>' : '') +
      '<h4>Զրույցներ</h4>' +
      '<div class="gridwrap"><table class="grid"><thead><tr><th>Ժամանակ</th><th>Օգտատեր</th><th>Հարց</th><th>Պատասխան</th></tr></thead><tbody>' +
      convRows + '</tbody></table></div>' +
      '<h4 style="margin-top:16px">Ջնջված ֆայլեր (սերվերի պահոց)</h4>' +
      '<div class="gridwrap"><table class="grid"><thead><tr><th>Բաժին</th><th>Ֆայլ</th><th>Ջնջված</th><th>Մինչև</th><th></th></tr></thead><tbody>' +
      fileRows + '</tbody></table></div></div>';
    var root = document.getElementById('kmHubVaultRoot');
    if (root) {
      var pc = document.getElementById('kmHubPruneConv');
      if (pc) pc.onclick = async function () {
        try {
          var r = await window.kmNative.conversations.prune({ adminToken: token });
          toast('Հեռացվեց ' + (r && r.removed || 0) + ' հին զրույց');
          window.kmOpenHubVault();
        } catch (e) { toast(errText(e), 'error'); }
      };
      var pv = document.getElementById('kmHubPruneVault');
      if (pv) pv.onclick = async function () {
        try {
          var r2 = await window.kmNative.retention.prune({ adminToken: token });
          toast('Հեռացվեց ' + (r2 && r2.removed || 0) + ' հին ֆայլ');
          window.kmOpenHubVault();
        } catch (e) { toast(errText(e), 'error'); }
      };
      root.onclick = async function (ev) {
        var b = ev.target && ev.target.closest && ev.target.closest('[data-km-vault-restore]');
        if (!b) return;
        try {
          await window.kmNative.retention.restore({
            adminToken: token,
            id: b.getAttribute('data-km-vault-restore'),
            section: b.getAttribute('data-section')
          });
          toast('Ֆայլը վերականգնվեց');
          window.kmOpenHubVault();
        } catch (e) { toast(errText(e), 'error'); }
      };
    }
  };
  try { bindEvents(); requestPushPerm(); bindHeaderUpdateBtn(); } catch (e) {}
})();
