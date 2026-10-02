/* KM — load Պաշտոն catalog only when needed (no boot-time network) */
(function () {
'use strict';
  window.KM_SHTAT_CATALOG = window.KM_SHTAT_CATALOG || {
    title: 'Պաշտոն',
    source: '',
    sections: [],
    positions: [],
    loading: false
  };
  var started = false;
  function apply(data) {
    if (!data || typeof data !== 'object') return;
    window.KM_SHTAT_CATALOG = data;
    window.KM_SHTAT_CATALOG.loading = false;
  }
  function fail(err) {
    window.KM_SHTAT_CATALOG.loading = false;
    window.KM_SHTAT_CATALOG.loadError = String((err && err.message) || err || 'load fail');
    console.warn('KM_SHTAT_CATALOG', err);
  }
  function startLoad() {
    if (started) return;
    started = true;
    window.KM_SHTAT_CATALOG.loading = true;
    try {
      fetch('data/km_shtat_catalog.json')
        .then(function (r) {
          if (!r.ok) throw new Error('catalog HTTP ' + r.status);
          return r.json();
        })
        .then(apply)
        .catch(fail);
    } catch (e) {
      fail(e);
    }
  }
  window.kmEnsureShtatCatalog = startLoad;
})();
