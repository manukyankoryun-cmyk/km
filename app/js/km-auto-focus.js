/* Restore typing focus only after Windows/Electron steals the window. */
(function () {
  'use strict';

  var lastField = null;
  var lastSel = null;
  var windowLost = false;
  var restoreTimer = 0;

  function isTypingField(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.disabled || el.readOnly) return false;
    var tag = String(el.tagName || '').toUpperCase();
    if (tag === 'TEXTAREA') return true;
    if (tag === 'INPUT') {
      var t = String(el.type || 'text').toLowerCase();
      return t !== 'button' && t !== 'submit' && t !== 'reset' &&
        t !== 'checkbox' && t !== 'radio' && t !== 'file' &&
        t !== 'hidden' && t !== 'range' && t !== 'color';
    }
    return !!el.isContentEditable;
  }

  function skip() {
    if (document.hidden || !document.body) return true;
    if (document.body.classList.contains('km-boot-idle')) return true;
    if (document.body.classList.contains('km-license-blocked')) return true;
    if (document.getElementById('kmLoginOverlay')) return true;
    return false;
  }

  function remember(el) {
    if (!isTypingField(el)) return;
    lastField = el;
    try { lastSel = { start: el.selectionStart, end: el.selectionEnd }; }
    catch (e) { lastSel = null; }
  }

  function restore() {
    if (skip() || !windowLost) return;
    if (!lastField || !lastField.isConnected || lastField.disabled || lastField.readOnly) return;
    var ae = document.activeElement;
    if (isTypingField(ae)) { windowLost = false; return; }
    if (ae && ae !== document.body && ae !== document.documentElement) return;
    try {
      lastField.focus({ preventScroll: true });
      if (lastSel && typeof lastField.setSelectionRange === 'function' &&
          lastField.type !== 'number' && lastField.type !== 'date') {
        lastField.setSelectionRange(lastSel.start, lastSel.end);
      }
    } catch (e1) {}
    windowLost = false;
  }

  document.addEventListener('focusin', function (e) {
    if (isTypingField(e.target)) remember(e.target);
  }, true);

  window.addEventListener('blur', function () { windowLost = true; });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) windowLost = true;
  });
  window.addEventListener('focus', function () {
    clearTimeout(restoreTimer);
    restoreTimer = setTimeout(restore, 180);
  });

  function injectUnlockCss() {
    if (document.getElementById('km-auto-focus-css')) return;
    var s = document.createElement('style');
    s.id = 'km-auto-focus-css';
    s.textContent =
      '#content input:not([disabled]):not([readonly]),' +
      '#content textarea:not([disabled]):not([readonly]),' +
      '.kmDlgCard input:not([disabled]):not([readonly]),' +
      '.kmDlgCard textarea:not([disabled]):not([readonly]){' +
      'pointer-events:auto!important;user-select:text!important;-webkit-user-select:text!important}' +
      '.kmArchiveReadonlyCard input,.kmArchiveReadonlyCard select,.kmArchiveReadonlyCard textarea,' +
      '.vacationCell{pointer-events:none}' +
      'body.km-role-viewer #content td[data-s],' +
      'body.km-role-viewer #content td[data-dtype-person]{pointer-events:none}';
    document.head.appendChild(s);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectUnlockCss);
  } else {
    injectUnlockCss();
  }

  window.kmRestoreTypingFocus = restore;
})();
