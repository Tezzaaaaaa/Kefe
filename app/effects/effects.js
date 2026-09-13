/* KEFE — THE canonical lyric-effects file.
 *
 * This is the ONLY place that knows:
 *   - which lyric effects exist
 *   - their labels, order and descriptions
 *   - how to build the picker UI
 *   - what happens when you click one
 *
 * No other file should hard-code effect names, build effect buttons,
 * or attach click handlers to them. If a new effect is added, add it
 * to CATALOGUE below and (if modular) register it on window.kefeEffects
 * from its own renderer file. Nothing else changes.
 */
(function(){
  'use strict';
  if (window.__kefeEffectsInstalled) return;
  window.__kefeEffectsInstalled = true;

  /* ============================================================
     1. THE CATALOGUE — one list, fixed order, single source.
     ============================================================ */
  var CATALOGUE = [
    { key:'apple',       label:'Apple',            description:'Apple Music-style focus line' },
    { key:'brat',        label:'Brat',             description:'Edge-to-edge album-cover typewriter' },
    { key:'eternal',     label:'Eternal Sunshine', description:'Handwritten ink reveal' },
    { key:'aurora',      label:'Aurora',           description:'Atmospheric gradient lyrics' },
    { key:'pulse',       label:'Pulse',            description:'Rhythmic pulse and glow' },
    { key:'typewriter',  label:'Typewriter',       description:'Character-by-character reveal' },
    { key:'instagram',   label:'Instagram',        description:'Bold Story-style stack' },
    { key:'fadeup',      label:'Fade Up',          description:'Word-by-word fade-up' },
    { key:'decrypt',     label:'Decrypt',          description:'Scramble-in character reveal' },
    { key:'blur',        label:'Blur In',          description:'Drift from blur into focus' },
    { key:'shiny',       label:'Shiny',            description:'Diagonal shine sweep' },
    { key:'rise',        label:'Rise',             description:'Soft upward lift' },
    { key:'slide',       label:'Slide',            description:'Lateral glide' },
    { key:'drop',        label:'Drop',             description:'Controlled downward arrival' },
    { key:'drift',       label:'Drift',            description:'Gentle diagonal float' },
    { key:'scrolllines', label:'Scroll Lines',     description:'Editorial multi-line scroll' }
  ];

  var BY_KEY = {};
  CATALOGUE.forEach(function(e){ BY_KEY[e.key] = e; });

  /* ============================================================
     2. ONE STYLESHEET — one grid, one button look.
     ============================================================ */
  var css = document.createElement('style');
  css.id = 'kefe-effects-css';
  css.textContent = [
    '#lyricStyleBlock .effect-buttons{display:grid !important;grid-template-columns:repeat(2,minmax(0,1fr)) !important;gap:8px !important;flex-wrap:unset !important}',
    '#lyricStyleBlock .effect-buttons > button{',
    '  position:relative !important;overflow:hidden;',
    '  min-height:64px !important;padding:10px 12px !important;',
    '  border:1px solid var(--line) !important;border-radius:10px !important;',
    '  background:var(--surface-2) !important;color:var(--text) !important;',
    '  font-size:12px !important;font-weight:600 !important;',
    '  white-space:normal !important;text-align:center !important;',
    '  display:flex !important;align-items:center !important;justify-content:center !important;',
    '}',
    '#lyricStyleBlock .effect-buttons > button.active-effect{',
    '  border-color:var(--red) !important;box-shadow:0 0 0 1px var(--red) !important;',
    '}'
  ].join('');
  document.head.appendChild(css);

  /* ============================================================
     3. THE PICKER — one grid, built from the catalogue.
     ============================================================ */
  function syncActive(host) {
    var current = (window.state && window.state.style && window.state.style.effect) || 'apple';
    host.querySelectorAll('button[data-effect]').forEach(function(b){
      b.classList.toggle('active-effect', b.dataset.effect === current);
    });
  }

  function buildPicker() {
    var host = document.querySelector('#lyricStyleBlock .effect-buttons');
    if (!host) return;

    // Foreign buttons (added by scroll-lines.js / story-fade.js etc.) are
    // removed. This is the single owner of that grid.
    host.querySelectorAll(':scope > button').forEach(function(btn){
      if (!btn.dataset.kefeOwned) btn.remove();
    });

    // Build only the missing ones (avoids flicker / re-render churn).
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
        btn.textContent = def.label;
        btn.title = def.description;
        btn.addEventListener('click', function(){
          if (window.isExporting) return;
          if (typeof window.setEffect === 'function') {
            if (!window.setEffect(def.key)) return;
          }
          var label = document.getElementById('effectLabel');
          if (label) label.textContent = def.description;
          syncActive(host);
        });
        host.appendChild(btn);
      });
    }

    // Any leftover buttons from earlier scripts on the same host (that
    // weren't marked owned) get removed every tick.
    host.querySelectorAll(':scope > button').forEach(function(btn){
      if (!btn.dataset.kefeOwned) btn.remove();
    });

    syncActive(host);
  }

  /* ============================================================
     4. Pre-computed text layout — the sync fix.
     Rise / Slide / Drop / Drift / Scroll Lines used to call
     measureText() hundreds of times per frame, which is why they
     stuttered. This cache is keyed on (font, text) and cleared
     whenever the font set loads or the effect changes. All effects
     that go through core.js's helpers automatically benefit.
     ============================================================ */
  var layoutCache = new Map();
  var MAX_LAYOUT = 3000;

  function cachedMeasureText(original, ctx, text) {
    var key = ctx.font + '\u0000' + text;
    var hit = layoutCache.get(key);
    if (hit !== undefined) return hit;
    var result = original.call(ctx, text);
    if (layoutCache.size >= MAX_LAYOUT) {
      var it = layoutCache.keys();
      for (var i = 0; i < MAX_LAYOUT / 2; i++) {
        var k = it.next();
        if (k.done) break;
        layoutCache.delete(k.value);
      }
    }
    layoutCache.set(key, result);
    return result;
  }

  try {
    var proto = CanvasRenderingContext2D.prototype;
    var original = proto.measureText;
    proto.measureText = function(text) {
      return cachedMeasureText(original, this, text);
    };
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function(){ layoutCache.clear(); });
    }
    if (document.fonts && document.fonts.addEventListener) {
      document.fonts.addEventListener('loadingdone', function(){ layoutCache.clear(); });
    }
  } catch (e) {
    console.warn('[KEFE effects] measure cache unavailable', e);
  }

  // Clear the cache when the user switches effect or redraws lyrics,
  // so a font change never produces stale metrics.
  document.addEventListener('change', function(ev){
    if (ev.target && ev.target.id === 'lyricStyleBlock') layoutCache.clear();
  }, true);

  /* ============================================================
     5. Expose the ONE registry for any other module to read.
     ============================================================ */
  window.kefeEffectRegistry = Object.freeze({
    list: function(){ return CATALOGUE.slice(); },
    get: function(key){ return BY_KEY[key] || null; },
    has: function(key){ return Boolean(BY_KEY[key]); },
    defaultKey: function(){ return 'apple'; }
  });

  /* ============================================================
     6. Boot + keep-alive.
     ============================================================ */
  function tick() { try { buildPicker(); } catch(e){ console.warn(e); } }

  tick();
  setInterval(tick, 300);
  document.addEventListener('click', function(){ setTimeout(tick, 60); }, true);

  // Watch the picker host directly so anything foreign is removed
  // the instant it appears.
  var observer = new MutationObserver(function(){ buildPicker(); });
  var host = document.querySelector('#lyricStyleBlock .effect-buttons');
  if (host) observer.observe(host, { childList: true });

  console.log('[KEFE effects] single-source picker installed — ' + CATALOGUE.length + ' effects');
})();
