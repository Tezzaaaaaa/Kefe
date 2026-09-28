/* KEFE — the single owner of the lyric-effect picker.
 * Reads its catalogue from window.KEFE_EFFECTS (manifest.js). */
(function(){
  'use strict';
  if (window.__kefeEffectsInstalled) return;
  window.__kefeEffectsInstalled = true;

  var CATALOGUE = (window.KEFE_EFFECTS && Array.isArray(window.KEFE_EFFECTS) && window.KEFE_EFFECTS.length)
    ? window.KEFE_EFFECTS.slice()
    : [{ key:'apple', label:'Apple', description:'Apple Music-style focus line' }];

  var BY_KEY = {};
  CATALOGUE.forEach(function(e){ BY_KEY[e.key] = e; });

  var css = document.createElement('style');
  css.id = 'kefe-effects-css';
  css.textContent = [
    '#lyricStyleBlock .effect-buttons{display:grid !important;grid-template-columns:repeat(2,minmax(0,1fr)) !important;gap:8px !important;flex-wrap:unset !important}',
    '#lyricStyleBlock .effect-buttons > button{position:relative !important;overflow:hidden;min-height:64px !important;padding:10px 12px !important;border:1px solid var(--line) !important;border-radius:10px !important;background:var(--surface-2) !important;color:var(--text) !important;font-size:12px !important;font-weight:600 !important;white-space:normal !important;text-align:center !important;display:flex !important;align-items:center !important;justify-content:center !important}',
    '#lyricStyleBlock .effect-buttons > button.active-effect{border-color:var(--red) !important;box-shadow:0 0 0 1px var(--red) !important}'
  ].join('');
  document.head.appendChild(css);

  function syncActive(host) {
    var current = (window.state && window.state.style && window.state.style.effect) || 'apple';
    host.querySelectorAll('button[data-effect]').forEach(function(b){
      b.classList.toggle('active-effect', b.dataset.effect === current);
    });
  }

  function buildPicker() {
    var host = document.querySelector('#lyricStyleBlock .effect-buttons');
    if (!host) return;

    host.querySelectorAll(':scope > button').forEach(function(btn){
      if (!btn.dataset.kefeOwned) btn.remove();
    });

    var wanted = CATALOGUE.map(function(e){ return e.key; });
    var existing = Array.from(host.querySelectorAll('button[data-kefe-owned]')).map(function(b){ return b.dataset.effect; });
    var matches = existing.length === wanted.length && existing.every(function(v,i){ return v === wanted[i]; });

    if (!matches) {
      host.innerHTML = '';
      CATALOGUE.forEach(function(def){
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'segmented-btn';
        btn.dataset.effect = def.key;
        btn.dataset.kefeOwned = '1';
        btn.textContent = def.label || def.key;
        btn.title = def.description || '';
        btn.addEventListener('click', function(){
          if (window.isExporting) return;
          if (typeof window.setEffect === 'function') {
            if (!window.setEffect(def.key)) return;
          }
          var label = document.getElementById('effectLabel');
          if (label) label.textContent = def.description || '';
          syncActive(host);
        });
        host.appendChild(btn);
      });
    }

    host.querySelectorAll(':scope > button').forEach(function(btn){
      if (!btn.dataset.kefeOwned) btn.remove();
    });

    syncActive(host);
  }

  window.kefeEffectRegistry = Object.freeze({
    list: function(){ return CATALOGUE.slice(); },
    get: function(key){ return BY_KEY[key] || null; },
    has: function(key){ return Boolean(BY_KEY[key]); },
    defaultKey: function(){ return CATALOGUE[0] ? CATALOGUE[0].key : 'apple'; }
  });

  function tick() { try { buildPicker(); } catch(e){ console.warn(e); } }
  tick();

  console.log('[KEFE effects] picker installed - ' + CATALOGUE.length + ' effects from manifest');
})();
