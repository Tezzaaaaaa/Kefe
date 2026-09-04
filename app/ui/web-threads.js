/* KEFE — compatibility loader for the adjusted Prism landing effect. */
(() => {
  'use strict';
  const script = document.createElement('script');
  script.src = './app/ui/prism.js?v=20260905-2';
  script.async = false;
  script.onload = () => {
    window.KefeWebThreads = window.KefePrism;
    window.dispatchEvent(new CustomEvent('kefe-prism-ready'));
  };
  script.onerror = () => console.error('KEFE Prism failed to load.');
  (document.currentScript?.after(script)) || document.head.appendChild(script);
})();
