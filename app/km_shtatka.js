/* KM_LEGACY_EXCEL_STUB_DISABLED_V1 - Excel import disabled; Unit Archive is the sole staff source */
(function () {
  var g = (typeof window !== 'undefined') ? window : globalThis;
  try { g.kmShtatkaDisabled = true; } catch (e0) {}
  function goUnitArchive() {
    try { if (typeof g.toastMsg === 'function') g.toastMsg('Excel import disabled. Open Unit Archive.', 'warn'); else if (typeof toastMsg === 'function') toastMsg('Excel import disabled. Open Unit Archive.', 'warn'); } catch (e1) {}
    try { if (typeof g.kmOpenUnitArchive === 'function') g.kmOpenUnitArchive(); else if (typeof g.kmOpenPage === 'function') g.kmOpenPage('unitArchive'); } catch (e2) {}
  }
  try { g.kmOpenShtatka = goUnitArchive; } catch (e3) {}
  try { g.kmRefreshShtatka = function () { return Promise.resolve(0); }; } catch (e4) {}
})();
