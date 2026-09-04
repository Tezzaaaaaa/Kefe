/* Compatibility bridge: the KEFE landing renderer now uses the adjusted Prism effect. */
(() => {
  'use strict';
  const script = document.createElement('script');
  script.src = './app/ui/prism.js?v=20260905-1';
  script.async = false;
  document.currentScript?.after(script) || document.head.appendChild(script);
})();
