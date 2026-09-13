/* KEFE — single source of truth for lyric-effect renderers. */
(() => {
  'use strict';

  const definitions = Object.freeze({
    apple:       { kind: 'native', source: 'app/app.js' },
    brat:        { kind: 'module', source: 'app/effects/brat.js' },
    eternal:     { kind: 'module', source: 'app/effects/eternal-sunshine.js' },
    aurora:      { kind: 'module', source: 'app/effects/aurora.js' },
    pulse:       { kind: 'native', source: 'app/app.js' },
    typewriter:  { kind: 'module', source: 'app/effects/typewriter.js' },
    instagram:   { kind: 'module', source: 'app/effects/instagram-lyrics.js' },
    fadeup:      { kind: 'module', source: 'app/effects/story-fade.js' },
    storyfade:   { kind: 'module', source: 'app/effects/story-fade.js' },
    decrypt:     { kind: 'module', source: 'app/effects/decrypt-text.js' },
    blur:        { kind: 'module', source: 'app/effects/blur-text.js' },
    shiny:       { kind: 'module', source: 'app/effects/shiny-text.js' },
    scrolllines: { kind: 'module', source: 'app/effects/scroll-lines.js' },
    rise:        { kind: 'module', source: 'app/effects/motion.js' },
    slide:       { kind: 'module', source: 'app/effects/motion.js' },
    drop:        { kind: 'module', source: 'app/effects/motion.js' },
    drift:       { kind: 'module', source: 'app/effects/motion.js' },
    vhsglitch:   { kind: 'module', source: 'app/effects/vhs-glitch.js' }
  });

  const keys = Object.freeze(Object.keys(definitions));
  const native = {
    apple: window.drawAppleEffect,
    pulse: window.drawPulseEffect
  };
  const moduleNative = Object.create(null);
  window.kefeEffects = window.kefeEffects || {};
  const registry = Object.create(null);

  registry.apple = (ctx, w, h, style, lines, time) => native.apple?.(ctx, w, h, style, lines, time);
  registry.pulse = (ctx, w, h, style, lines, time) => native.pulse?.(ctx, w, h, style, lines, time);

  // Capture each modular implementation once, then replace its public entry
  // point with the canonical registry wrapper. Existing app.js code therefore
  // cannot bypass the registry.
  for (const key of keys) {
    if (definitions[key].kind !== 'module') continue;
    moduleNative[key] = window.kefeEffects[key];
    registry[key] = (ctx, w, h, style, lines, time) => {
      const renderer = moduleNative[key];
      if (typeof renderer === 'function') return renderer(ctx, w, h, style, lines, time);
      console.error(`[KEFE] Missing lyric renderer: ${key} (${definitions[key].source})`);
      if (typeof registry.apple === 'function') return registry.apple(ctx, w, h, style, lines, time);
    };
    window.kefeEffects[key] = registry[key];
  }

  window.drawAppleEffect = registry.apple;
  window.drawBratEffect = registry.brat;
  window.drawEternalSunshineEffect = registry.eternal;
  window.drawAuroraEffect = registry.aurora;
  window.drawPulseEffect = registry.pulse;

  window.kefeRendererRegistry = Object.freeze(registry);
  window.kefeEffectRendererKeys = keys;
  window.kefeEffectDefinitions = definitions;
})();
