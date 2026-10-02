/* KM background: ONE static picture (assets/km_bg.jpg).
   Replaces the rotating 30-photo slideshow: no timer, no cross-fade, no preloading of other photos, no repeated
   decode / re-blur of a full-screen image. File name and window.kmStartBgSlideshow are kept so nothing else changes. */
(function () {
  'use strict';

  var BG_PATH = 'assets/km_bg.jpg';
  var host = null, started = false;

  function injectCss() {
    var s = document.getElementById('km-mil-bg-css');
    if (!s) {
      s = document.createElement('style');
      s.id = 'km-mil-bg-css';
      document.head.appendChild(s);
    }
    s.textContent = [
      'body.km-mil-bg-on::before,body.km-mil-bg-on::after{content:none!important;display:none!important;opacity:0!important;background:none!important;background-image:none!important}',
      'body.km-mil-bg-on,body.km-mil-bg-on .app{background:#0b1220!important;position:relative!important}',
      'body.km-boot-idle .main,body.km-mil-bg-on.km-boot-idle .main,body.km-dark.km-mil-bg-on.km-boot-idle .main{background:transparent!important;background-color:transparent!important;position:relative!important;z-index:1}',
      'body.km-mil-bg-on:not(.km-boot-idle) .main,body.km-dark.km-mil-bg-on:not(.km-boot-idle) .main{background:#f3f6f9!important;background-color:#f3f6f9!important;position:relative!important;z-index:1}',
      'body.km-mil-bg-on .side,body.km-mil-bg-on aside.side,body.km-dark.km-mil-bg-on .side,body.km-dark.km-mil-bg-on aside.side{background:transparent!important;background-color:transparent!important;background-image:none!important;position:relative!important;z-index:2}',
      'body.km-boot-idle.km-mil-bg-on #content,body.km-boot-idle #content,body.km-mil-bg-on #content:empty{background:transparent!important;background-color:transparent!important;min-height:0!important}',
      '.kmMilHost{position:absolute;inset:0;z-index:0;overflow:hidden;pointer-events:none}',
      '.kmMilHost img{position:absolute;inset:0;width:100%;height:100%;max-width:none!important;object-fit:cover;object-position:center center;border:0;opacity:1;pointer-events:none;transform:translateZ(0);backface-visibility:hidden}',
      '.kmMilVeil{display:none!important}',
      'body.km-boot-idle .main::before{content:none!important;display:none!important;background:none!important}',
      'body.km-mil-bg-on .main .top{position:relative;z-index:1}',
      'body.km-boot-idle.km-mil-bg-on #content,body.km-mil-bg-on #content:empty{position:relative;z-index:1;background:transparent!important}',
      'body.km-mil-bg-on:not(.km-boot-idle) #content:not(:empty),body.km-dark.km-mil-bg-on:not(.km-boot-idle) #content:not(:empty){position:relative;z-index:1;background:#f3f6f9!important;color:#182433!important}',
      '@media print{.kmMilHost{display:none!important}}'
    ].join('');
  }

  function start() {
    if (started || host) return;
    var app = document.querySelector('.app');
    if (!app) return;
    started = true;
    injectCss();
    document.body.classList.add('km-mil-bg-on');
    host = document.createElement('div');
    host.className = 'kmMilHost';
    host.setAttribute('aria-hidden', 'true');
    var img = document.createElement('img');
    img.alt = '';
    img.decoding = 'async';
    img.src = BG_PATH;
    var veil = document.createElement('div');
    veil.className = 'kmMilVeil';
    host.appendChild(img);
    host.appendChild(veil);
    app.insertBefore(host, app.firstChild);
  }

  window.kmStartBgSlideshow = function () {
    if (started) return;
    start();
  };

  function boot() {
    function tryStart() {
      if (document.getElementById('kmLoginOverlay')) {
        setTimeout(tryStart, 600);
        return;
      }
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(function () { start(); }, { timeout: 2500 });
      } else {
        setTimeout(start, 400);
      }
    }
    tryStart();
  }

  if (document.readyState === 'complete') boot();
  else window.addEventListener('load', boot);
})();
