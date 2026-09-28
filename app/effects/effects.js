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

  function applyPopoverPicker() {
    var host = document.querySelector('#lyricStyleBlock .effect-buttons');
    if (!host || host.dataset.kefePopoverApplied === '1') return;
    var buttons = Array.from(host.querySelectorAll(':scope > button[data-effect]'));
    if (!buttons.length) return;
    host.dataset.kefePopoverApplied = '1';
    host.innerHTML = '';

    var mainId = 'kefe-lyric-effects-popover';
    var trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'segmented-btn kefe-popover-trigger';
    trigger.setAttribute('popoverTarget', mainId);
    trigger.textContent = 'Choose lyric effect';
    host.appendChild(trigger);

    var menu = document.createElement('div');
    menu.id = mainId;
    menu.setAttribute('popover','auto');
    menu.className = 'kefe-effect-popover';
    menu.innerHTML = '<span class="kefe-popover-active" aria-hidden="true"></span>';
    host.appendChild(menu);

    var groups = [
      ['Core',['apple','pulse','typewriter','fadeup','slide','drop','drift','scrolllines']],
      ['Typography',['brat','eternal','rise','barbie','trailer','fancy','splitflap','chromatica']],
      ['Animated',['aurora','instagram','decrypt','blur','shiny','elasticpop','flipcards','karaoke']],
      ['Signal & FX',['glitch','analogtv','progressiveblur']]
    ];
    groups.forEach(function(group, gi) {
      var groupButtons = group[1].map(function(key) {
        return buttons.find(function(btn){ return btn.dataset.effect === key; });
      }).filter(Boolean);
      if (!groupButtons.length) return;
      var subId = 'kefe-lyric-group-' + gi;
      var cat = document.createElement('button');
      cat.type = 'button';
      cat.className = 'kefe-popover-category';
      cat.setAttribute('popoverTarget', subId);
      cat.textContent = group[0];
      menu.appendChild(cat);

      var sub = document.createElement('div');
      sub.id = subId;
      sub.setAttribute('popover','auto');
      sub.className = 'kefe-effect-subpopover';
      groupButtons.forEach(function(btn) {
        btn.className = 'kefe-effect-option';
        sub.appendChild(btn);
      });
      menu.appendChild(sub);
    });
  }

  var popoverCss = document.createElement('style');
  popoverCss.id = 'kefe-effects-popover-css';
  popoverCss.textContent = [
    '#lyricStyleBlock .effect-buttons{display:block !important}',
    '#lyricStyleBlock .kefe-popover-trigger{width:100%;min-height:44px;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:12px;font-weight:650;text-align:left}',
    '.kefe-effect-popover,.kefe-effect-subpopover{margin:0;padding:8px;min-width:210px;border:1px solid var(--line);border-radius:10px;background:var(--surface-2);color:var(--text);box-shadow:none}',
    '.kefe-effect-popover > .kefe-popover-category,.kefe-effect-option{display:flex;width:100%;align-items:center;justify-content:space-between;gap:12px;padding:9px 10px;border:0;border-radius:7px;background:transparent;color:var(--text);font:600 12px "Inter Tight",sans-serif;text-align:left;cursor:pointer}',
    '.kefe-effect-popover > .kefe-popover-category:hover,.kefe-effect-option:hover{background:var(--surface-3)}',
    '.kefe-effect-option.active-effect{color:var(--red);font-weight:750}',
    '.kefe-effect-subpopover{min-width:220px}',
    '.kefe-popover-active{display:block;height:2px;margin:0 4px 6px;background:var(--red);opacity:.85}'
  ].join('');
  document.head.appendChild(popoverCss);
  applyPopoverPicker();

  console.log('[KEFE effects] picker installed - ' + CATALOGUE.length + ' effects from manifest');
})();
