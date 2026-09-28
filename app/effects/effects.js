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

  function setEffect(key) {
    var def = BY_KEY[key];
    if (!def || !window.state || !window.state.style) return false;
    window.state.style.effect = def.key;
    try {
      if (typeof window.saveLinaPrefs === 'function') window.saveLinaPrefs();
    } catch (_) {}
    return true;
  }

  window.setEffect = setEffect;

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

  applyPopoverPicker();

  console.log('[KEFE effects] picker installed - ' + CATALOGUE.length + ' effects from manifest');
})();
