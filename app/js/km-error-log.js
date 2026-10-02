/* Capture UI errors into %LOCALAPPDATA%\KM\UserData\km_errors.log */
/* KM_PERF_FAST_V2: throttle so error storms do not freeze the UI */
(function () {
  'use strict';
  var _q = 0;
  var _win = 0;
  function logErr(source, message, detail) {
    try {
      var now = Date.now();
      if (now - _win > 2000) { _win = now; _q = 0; }
      _q++;
      if (_q > 6) return;
      if (window.kmNative && window.kmNative.errorLog) {
        window.kmNative.errorLog.append({ source: source || 'ui', message: String(message || '').slice(0, 500), detail: String(detail || '').slice(0, 1500) });
      }
    } catch (e) {}
  }

  window.addEventListener('error', (e) => {
    logErr('ui', e.message || 'error', (e.filename || '') + ':' + (e.lineno || 0) + (e.error && e.error.stack ? ' ' + e.error.stack : ''));
  });

  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    logErr('ui', 'unhandledrejection', r && (r.stack || r.message || String(r)));
  });

  window.kmLogError = logErr;
})();