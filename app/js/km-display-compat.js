/* Display / DPI / multi-monitor compatibility (Win7–11, any resolution) */
(function(){
  'use strict';

  function applyDisplayCompat(){
    try{
      const dpr=window.devicePixelRatio||1;
      const sw=window.screen&&window.screen.width?window.screen.width:window.innerWidth;
      const sh=window.screen&&window.screen.height?window.screen.height:window.innerHeight;
      const root=document.documentElement;
      root.style.setProperty('--km-dpr',String(dpr));
      root.style.setProperty('--km-screen-w',sw+'px');
      root.style.setProperty('--km-screen-h',sh+'px');
      root.classList.toggle('km-hidpi',dpr>=1.25);
      root.classList.toggle('km-uhd',sw>=2560);
      root.classList.toggle('km-small-screen',window.innerWidth<900);
      root.classList.toggle('km-short-screen',window.innerHeight<720);
      if(typeof window.kmFitPreview==='function')window.kmFitPreview();
    }catch(e){console.error('km-display-compat',e);}
  }

  window.kmApplyDisplayCompat=applyDisplayCompat;

  window.addEventListener('resize',function(){
    requestAnimationFrame(applyDisplayCompat);
  });
  window.addEventListener('orientationchange',function(){
    setTimeout(applyDisplayCompat,120);
  });

  if(window.matchMedia){
    try{
      window.matchMedia('(min-resolution: 120dpi)').addEventListener('change',applyDisplayCompat);
    }catch(e){
      try{window.matchMedia('(-webkit-min-device-pixel-ratio: 1.25)').addListener(applyDisplayCompat);}catch(_e){}
    }
  }

  document.addEventListener('DOMContentLoaded',function(){
    applyDisplayCompat();
    setTimeout(applyDisplayCompat,300);
    if(window.kmNative&&window.kmNative.onDisplayChanged){
      window.kmNative.onDisplayChanged(applyDisplayCompat);
    }
  });
})();
