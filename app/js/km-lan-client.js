/**
 * KM LAN client — auto-reconnect, BotKnowledge snapshot sync UI hooks.
 * Automatic LAN events are SILENT (console only). Toasts only for FATAL or manual actions.
 */
(function () {
  'use strict';

  function api() {
    if (!window.kmNative || !window.kmNative.lanSync) {
      throw new Error('LAN sync հասանելի է միայն KM desktop-ում');
    }
    return window.kmNative.lanSync;
  }

  function toast(msg, type) {
    if (typeof window.kmNotify === 'function') window.kmNotify(msg, type || 'ok');
    else if (typeof window.toast === 'function') window.toast(msg);
  }

  function lanLog() {
    try {
      if (!(window.KM_DEBUG || (typeof localStorage !== 'undefined' && localStorage.getItem('KM_DEBUG') === '1'))) return;
      var args = ['[LAN SYNC]'].concat([].slice.call(arguments));
      console.log.apply(console, args);
    } catch (_) {}
  }

  var bound = false;
  var lastStatus = null;
  var manualUntil = 0;
  var pendingArchives = false;
  var bootIdleWatch = false;
  var CONFIG_IDLE_RE = /SERVER_URL not configured|no_server_url|no_ws_url/i;
  var TRANSIENT_LAN_RE = /ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|EHOSTUNREACH|ENETUNREACH|EHOSTDOWN|ENETDOWN|EPIPE|ping timeout|capacity|peer_cap|EADDRINUSE|socket hang up|closed|disconnected|ECONNABORTED/i;
  var MUTE_FILES_RE = /km_app_users\.json|km_settings\.json|database_snapshot\.json|KM_SYNC\.json/i;

  function isConfigIdleError(err) {
    return CONFIG_IDLE_RE.test(String(err || ''));
  }

  function isTransientLanError(err) {
    return TRANSIENT_LAN_RE.test(String(err || ''));
  }

  function isBootIdle() {
    try {
      return !!(document.body && document.body.classList.contains('km-boot-idle'));
    } catch (_) {
      return false;
    }
  }

  function flushBootIdlePending() {
    if (isBootIdle()) return;
    if (pendingArchives) {
      pendingArchives = false;
      applyFileChanged({ relPath: 'unit_archives/' }).catch(function () {});
    }
  }

  function watchBootIdle() {
    if (bootIdleWatch || !document.body || typeof MutationObserver !== 'function') return;
    bootIdleWatch = true;
    try {
      new MutationObserver(function () {
        flushBootIdlePending();
      }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    } catch (_) {}
  }

  function isClientConfigured(st) {
    if (!st) return false;
    if (st.syncIdle) return false;
    if (st.clientConfigured === false) return false;
    return !!(String(st.serverUrl || '').trim() || String(st.wsUrl || '').trim());
  }

  function markManual(ms) {
    manualUntil = Date.now() + (ms == null ? 120000 : ms);
    if (typeof window.kmLanMarkManualSync === 'function') {
      try {
        window.kmLanMarkManualSync(ms);
      } catch (_) {}
    }
  }

  function allowToast(opts) {
    opts = opts || {};
    if (opts.fatal) return true;
    if (opts.manual) return true;
    if (Date.now() < manualUntil) return true;
    return false;
  }

  function notify(msg, type, opts) {
    opts = opts || {};
    lanLog(msg, type || '', opts.fatal ? 'FATAL' : (opts.manual ? 'manual' : 'auto'));
    if (!allowToast(opts) && type !== 'error' && !opts.fatal) return;
    if (type === 'error' || opts.fatal) toast(msg, 'error');
    else if (allowToast(opts)) toast(msg, type || 'ok');
  }

  async function refreshStatus() {
    try {
      lastStatus = await api().status();
      return lastStatus;
    } catch (e) {
      return null;
    }
  }

  function forwardToUi(ev) {
    if (typeof window.kmLanUpdateSyncUi === 'function') {
      try {
        window.kmLanUpdateSyncUi(ev);
      } catch (_) {}
    }
  }

  async function applyFileChanged(ev) {
    if (!ev || !ev.relPath) return;
    var rel = String(ev.relPath);
    var base = rel.split('/').pop() || rel;
    if (MUTE_FILES_RE.test(rel) || MUTE_FILES_RE.test(base)) {
      lanLog('file muted (auto)', rel);
      if (/km_app_users\.json/i.test(rel) || /km_app_users\.json/i.test(base)) {
        try {
          if (typeof window.kmRefreshUsersAdminIfOpen === 'function') window.kmRefreshUsersAdminIfOpen(ev);
          if (typeof window.kmRefreshUserGrants === 'function') window.kmRefreshUserGrants();
        } catch (_) {}
      }
      if (/database_snapshot\.json|KM_SYNC\.json/i.test(rel)) {
        /* Working km-desktop-main applied snapshot on clients. Skip only huge files
           (17MB JSON.parse froze renderer). Hub still never self-applies. */
        try {
          var persist = window.kmNative && (window.kmNative.persistence || window.kmNative.persist);
          if (!persist || typeof persist.readSnapshot !== 'function') {
            lanLog('snapshot apply: readSnapshot missing');
            return;
          }
          var rr = await persist.readSnapshot();
          if (!rr || !rr.ok || !rr.json) {
            lanLog('snapshot apply: empty/missing', rr && rr.error);
            return;
          }
          if (rr.size && rr.size > 2 * 1024 * 1024) {
            lanLog('snapshot apply skipped (too large)', rr.size);
            return;
          }
          var data = typeof rr.json === 'string' ? JSON.parse(rr.json) : rr.json;
          if (!data || typeof data !== 'object') return;
          if (typeof window.kmApplyDbSnapshot !== 'function') {
            lanLog('snapshot apply: kmApplyDbSnapshot missing');
            return;
          }
          try {
            var _isHub = false;
            if (window.kmNative && window.kmNative.net && typeof window.kmNative.net.status === 'function') {
              var _nst = await window.kmNative.net.status();
              if (_nst && _nst.updateServer) _isHub = true;
            }
            if (!_isHub && window.kmNative && window.kmNative.lanSync && typeof window.kmNative.lanSync.status === 'function') {
              var _lst = await window.kmNative.lanSync.status();
              var _role = (_lst && (_lst.effectiveRole || _lst.role)) || '';
              if (_role === 'server' || _role === 'hub' || (_lst && _lst.isServer)) _isHub = true;
            }
            if (_isHub) {
              lanLog('snapshot apply skipped on hub/server role');
              return;
            }
          } catch (_eRole) {}
          var ok = window.kmApplyDbSnapshot(data, { merge: true, force: true, role: window.kmUserRole || 'admin' });
          if (ok === false) return;
          if (typeof window.save === 'function') { try { await window.save(true); } catch (_) {} }
          if (typeof window.render === 'function') { try { window.render(); } catch (_) {} }
          lanLog('snapshot applied from disk', rel);
        } catch (eApply) {
          lanLog('snapshot apply failed', eApply && eApply.message ? eApply.message : eApply);
        }
        return;
      }
      return;
    }
    if (/^Library\//i.test(rel) && typeof window.kmLibraryRefresh === 'function') {
      try {
        window.kmLibraryRefresh();
      } catch (_) {}
      lanLog('library refreshed', rel);
      return;
    }
    if (/^unit_kod(\/|$)/i.test(rel)) {
      lanLog('unit kod synced', rel);
      return;
    }
    if (/^unit_archives(\/|$)/i.test(rel)) {
      /* KM_ADMIN_HANG_V1b */
      (async function () {
        try {
          var _isHubA = false;
          if (window.kmNative && window.kmNative.net && window.kmNative.net.status) {
            var _a = await window.kmNative.net.status();
            if (_a && _a.updateServer) _isHubA = true;
          }
          if (_isHubA) { lanLog('archives refresh skipped on hub'); return; }
        } catch (_ea) {}
        try {
          if (isBootIdle()) {
            pendingArchives = true;
            watchBootIdle();
            lanLog('archives refresh deferred (boot idle)');
            return;
          }
        } catch (_eIdleA) {}
        if (typeof window.kmRefreshOrgArchives === 'function') {
          window.kmRefreshOrgArchives().catch(function () {});
        }
      })();
      return;
    }
    if (/km_org_seed\.json$/i.test(rel)) {
      /* KM_ADMIN_HANG_V1b */
      (async function () {
        try {
          var _isHubS = false;
          if (window.kmNative && window.kmNative.net && window.kmNative.net.status) {
            var _s = await window.kmNative.net.status();
            if (_s && _s.updateServer) _isHubS = true;
          }
          if (_isHubS) { lanLog('org seed refresh skipped on hub'); return; }
        } catch (_es) {}
        if (typeof window.kmRefreshOrgSeed === 'function') {
          window.kmRefreshOrgSeed().catch(function () {});
        }
      })();
      return;
    }
    if (/^BotKnowledge\//i.test(rel) || rel === 'BotKnowledge') {
      lanLog('BotKnowledge synced', rel);
      return;
    }
    lanLog('file synced', base);
  }

  function onLanEvent(ev) {
    if (!ev || !ev.type) return;
    forwardToUi(ev);

    if (ev.type === 'adopted-hub') {
      if (typeof window.kmRefreshOrgHubField === 'function') {
        try { window.kmRefreshOrgHubField(ev); } catch (_) {}
      }
      if (ev.previousUrl && ev.serverUrl && ev.previousUrl !== ev.serverUrl) {
        notify('Hub սերվերի IP-ն փոխվեց՝ ' + ev.serverUrl, 'ok', { manual: true });
      }
      return;
    }
    if (ev.type === 'connected') {
      notify('LAN սերվերին միացված', 'ok', { manual: true });
      return;
    }
    if (ev.type === 'disconnected') {
      lanLog('disconnected');
      if (!isClientConfigured(lastStatus)) return;
      /* auto-reconnect — silent */
      return;
    }
    if (ev.type === 'reconnecting') {
      lanLog('reconnecting');
      return;
    }
    if (ev.type === 'bot-knowledge-updated' || ev.type === 'bot-knowledge-sync-start') {
      lanLog(ev.type, ev.relPath || '');
      return;
    }
    if (ev.type === 'bot-knowledge-sync-done') {
      if (ev.ok) lanLog('BotKnowledge snapshot installed');
      else notify('BotKnowledge sync՝ ' + String(ev.error || 'սխալ'), 'error', { fatal: true });
      return;
    }
    if (ev.type === 'bot-refresh-done') {
      if (ev.ok) {
        lanLog('FTS refreshed', (ev.after && ev.after.ftsCount) || 0);
        if (typeof window.kmHelpBotInvalidateKnowledge === 'function') {
          try {
            window.kmHelpBotInvalidateKnowledge('lan-sync');
          } catch (_) {}
        }
      } else {
        notify('BotKnowledge FTS՝ ' + String(ev.error || 'սխալ'), 'error', { fatal: true });
      }
      return;
    }
    if (ev.type === 'users-grants-updated') { /* KM_GRANTS_CONFIRM_SYNC_V2 */
      setTimeout(function () {
        try {
          if (typeof window.kmRefreshUserGrants === 'function') window.kmRefreshUserGrants();
          if (typeof window.kmRefreshUsersAdminIfOpen === 'function') window.kmRefreshUsersAdminIfOpen(ev);
        } catch (_) {}
      }, 400);
      return;
    }
    if (ev.type === 'file-changed' || ev.type === 'file-pulled') {
      applyFileChanged(ev);
      return;
    }
    if (ev.type === 'error') {
      if (isConfigIdleError(ev.error) || isTransientLanError(ev.error)) {
        lanLog('idle/transient', ev.error);
        return;
      }
      var errMsg = String(ev.error || 'սխալ');
      if (/401|403|forbidden|մուտքի կոդ/i.test(errMsg)) {
        notify('LAN մուտքի կոդը սխալ է։ Hub-ի «Մուտքի կոդը» գրեք այստեղ նույնը, ապա Պահպանել։', 'error', { fatal: true });
        return;
      }
      notify('LAN՝ ' + errMsg, 'error', { fatal: true });
    }
  }

  function bindEvents() {
    if (bound || !window.kmNative || !window.kmNative.onLanSyncEvent) return;
    bound = true;
    window.kmNative.onLanSyncEvent(onLanEvent);
  }

  async function configureClient(serverUrl, opts) {
    opts = opts || {};
    markManual(180000);
    var patch = {
      role: opts.role || 'client',
      serverUrl: String(serverUrl || '').trim(),
      autoReconnect: opts.autoReconnect !== false,
      realtimeSync: opts.realtimeSync !== false
    };
    if (opts.wsPort) patch.wsPort = opts.wsPort;
    var r = await api().setConfig(patch);
    notify('LAN կլիենտ կարգավորված՝ ' + patch.serverUrl, 'ok', { manual: true });
    return r;
  }

  async function saveAndConnect(serverUrl) {
    serverUrl = String(serverUrl || '').trim();
    if (!serverUrl) throw new Error('Server URL պարտադիր է');
    markManual(180000);
    await configureClient(serverUrl);
    return api().connect();
  }

  async function ensureStarted() {
    bindEvents();
    if (window.kmNative && window.kmNative.net && window.kmNative.net.start) {
      try {
        await window.kmNative.net.start();
      } catch (_) {}
    }
    try {
      await api().start();
    } catch (e) {
      if (!isConfigIdleError(e && e.message)) {
        notify('LAN start՝ ' + (e.message || e), 'error', { fatal: true });
      } else {
        lanLog('start idle (no SERVER_URL)');
      }
    }
    try {
      if (api().ensureHub) await api().ensureHub();
      else if (api().adoptHub) await api().adoptHub();
    } catch (_) {}
    return refreshStatus();
  }

  window.kmLanClient = {
    configureClient: configureClient,
    saveAndConnect: saveAndConnect,
    ensureStarted: ensureStarted,
    refreshStatus: refreshStatus,
    markManual: markManual,
    getStatus: function () {
      return lastStatus;
    }
  };

  bindEvents();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      watchBootIdle();
      ensureStarted().catch(function () {});
    });
  } else {
    watchBootIdle();
    setTimeout(function () {
      ensureStarted().catch(function () {});
    }, 3000);
  }
})();
