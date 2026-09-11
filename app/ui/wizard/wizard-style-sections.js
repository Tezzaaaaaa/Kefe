/* KEFE wizard — pathway helpers are loaded once; Background remains its own step. */
(() => {
  'use strict';

  function load(src, marker) {
    if (document.querySelector(`script[data-kefe-${marker}]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.dataset.kefePathway = marker;
    document.head.appendChild(script);
  }

  function init() {
    load('./app/ui/wizard/lyric-pathway.js', 'lyric-pathway');
    load('./app/ui/wizard/lyric-pathway-hardening.js', 'lyric-pathway-hardening');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
