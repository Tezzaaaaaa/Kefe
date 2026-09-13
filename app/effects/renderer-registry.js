/* KEFE — single source of truth for lyric-effect renderers. */
(() => {
  'use strict';

  // Every selectable lyric effect belongs here. Individual renderer files only
  // implement their effect; this manifest owns identity, loading expectations,
  // and dispatch. Do not create another effect-name map elsewhere.
  const definitions = Object.freeze({
    apple:      { kind: 'native', source: 'app/app.js' },
    brat:       { kind: 'module', source: 'app/effects/brat.js' },
    eternal:    { kind: 'module', source: 'app/effects/eternal-sunshine.js' },
    aurora:     { kind: 'module', source: 'app/effects/aurora.js' },
    pulse:      { kind: 'native', source: 'app/app.js' },
    typewriter: { kind: 'module', source: 'app/effects/typewriter.js' },
    instagram:  { kind: 'module', source: 'app/effects/instagram-lyrics.js' },
    fadeup:     { kind: 'module', source: 'app/effects/story-fade.js' },
    storyfade:  { kind: 'module', source: 'app/effects/story-fade.js' },
    decrypt:    { kind: 'module', source: 'app/effects/decrypt-text.js' },
    blur:       { kind: 'module', source: 'app/effects/blur-text.js' },
    shiny:      { kind: 'module', source: 'app/effects/shiny-text.js' },
    scrolllines:{ kind: 'module', source: 'app/effects/scroll-lines.js' },
    rise:       { kind: 'module', source: 'app/effects/motion.js' },
    slide:      { kind: 'module', source: 'app/effects/motion.js' },
    drop:       { kind: 'module', source: 'app/effects/motion.js' },
    drift:      { kind: 'module', source: 'app/effects/motion.js' },
    vhsglitch:  { kind: 'module', source: 'app/effects/vhs-glitch.js' }
  });

  const keys = Object.freeze(Object.keys(definitions));
  const native = {
    apple: window.drawAppleEffect,
    pulse: window.drawPulseEffect
  };

  const registry = Object.create(null);

  // Native renderers are still implemented in app.js for now. They are exposed
  // through this registry so the rest of KEFE has one dispatch point.
  registry.apple = (ctx, w, h, style, lines, time) => native.apple?.(ctx, w, h, style, lines, time);
  registry.pulse = (ctx, w, h, style, lines, time) => native.pulse?.(ctx, w, h, style, lines, time);

  // Modular renderers register themselves in window.kefeEffects.
  for (const key of keys) {
    if (definitions[key].kind !== 'module') continue;
    registry[key] = (ctx, w, h, style, lines, time) => {
      const renderer = window.kefeEffects?.[key];
      if (typeof renderer === 'function') return renderer(ctx, w, h, style, lines, time);
      console.error(`[KEFE] Missing lyric renderer: ${key} (${definitions[key].source})`);
      // Never leave the canvas blank because one optional renderer failed to load.
      // Fall back to the canonical Apple renderer while preserving the error above.
      if (typeof registry.apple === 'function') return registry.apple(ctx, w, h, style, lines, time);
    };
  }

  // Preserve the legacy global entry points used by existing native code, but
  // make them point at the canonical registry functions rather than competing
  // implementations.
  window.drawAppleEffect = registry.apple;
  window.drawBratEffect = registry.brat;
  window.drawEternalSunshineEffect = registry.eternal;
  window.drawAuroraEffect = registry.aurora;
  window.drawPulseEffect = registry.pulse;

  window.kefeRendererRegistry = Object.freeze(registry);
  window.kefeEffectRendererKeys = keys;
  window.kefeEffectDefinitions = definitions;
})();
