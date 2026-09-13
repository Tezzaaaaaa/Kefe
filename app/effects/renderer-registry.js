/* KEFE — single lyric-effect renderer registry. */
(() => {
  'use strict';

  const keys = Object.freeze([
    'apple', 'brat', 'eternal', 'aurora', 'pulse', 'typewriter', 'instagram',
    'fadeup', 'storyfade', 'decrypt', 'blur', 'shiny', 'scrolllines',
    'rise', 'slide', 'drop', 'drift', 'vhsglitch'
  ]);

  // Capture the existing native implementations once. The registry then becomes
  // the only place that decides which renderer owns each effect key.
  const native = {
    apple: window.drawAppleEffect,
    brat: window.drawBratEffect,
    eternal: window.drawEternalSunshineEffect,
    aurora: window.drawAuroraEffect,
    pulse: window.drawPulseEffect
  };

  const registry = Object.create(null);

  registry.apple = (ctx, w, h, style, lines, time) => native.apple?.(ctx, w, h, style, lines, time);
  registry.pulse = (ctx, w, h, style, lines, time) => native.pulse?.(ctx, w, h, style, lines, time);

  for (const key of ['brat', 'eternal', 'aurora']) {
    registry[key] = (ctx, w, h, style, lines, time) => {
      const renderer = window.kefeEffects?.[key];
      if (typeof renderer === 'function') return renderer(ctx, w, h, style, lines, time);
      return native[key]?.(ctx, w, h, style, lines, time);
    };
  }

  for (const key of ['typewriter', 'instagram', 'fadeup', 'storyfade', 'decrypt', 'blur', 'shiny', 'scrolllines', 'rise', 'slide', 'drop', 'drift', 'vhsglitch']) {
    registry[key] = (ctx, w, h, style, lines, time) => {
      const renderer = window.kefeEffects?.[key];
      if (typeof renderer === 'function') return renderer(ctx, w, h, style, lines, time);
      console.error(`[KEFE] Missing lyric renderer: ${key}`);
    };
  }

  // app.js contains the legacy switch, so replace the legacy renderer function
  // bindings with the canonical registry functions. No second implementation is
  // created; these are the same single renderer functions exposed above.
  window.drawAppleEffect = registry.apple;
  window.drawBratEffect = registry.brat;
  window.drawEternalSunshineEffect = registry.eternal;
  window.drawAuroraEffect = registry.aurora;
  window.drawPulseEffect = registry.pulse;

  window.kefeRendererRegistry = Object.freeze(registry);
  window.kefeEffectRendererKeys = keys;
})();
