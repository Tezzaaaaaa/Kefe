/* KEFE — single lyric-effect renderer registry. */
(() => {
  'use strict';

  const keys = Object.freeze([
    'apple', 'brat', 'eternal', 'aurora', 'pulse', 'typewriter', 'instagram',
    'fadeup', 'storyfade', 'decrypt', 'blur', 'shiny', 'scrolllines',
    'rise', 'slide', 'drop', 'drift', 'vhsglitch'
  ]);

  const native = {
    apple: window.drawAppleEffect,
    pulse: window.drawPulseEffect
  };

  const registry = Object.create(null);

  registry.apple = (ctx, w, h, style, lines, time) => native.apple?.(ctx, w, h, style, lines, time);
  registry.pulse = (ctx, w, h, style, lines, time) => native.pulse?.(ctx, w, h, style, lines, time);

  for (const key of ['brat', 'eternal', 'aurora', 'typewriter', 'instagram', 'fadeup', 'storyfade', 'decrypt', 'blur', 'shiny', 'scrolllines', 'rise', 'slide', 'drop', 'drift', 'vhsglitch']) {
    registry[key] = (ctx, w, h, style, lines, time) => {
      const renderer = window.kefeEffects?.[key];
      if (typeof renderer === 'function') return renderer(ctx, w, h, style, lines, time);
      console.error(`[KEFE] Missing lyric renderer: ${key}`);
    };
  }

  window.drawAppleEffect = registry.apple;
  window.drawPulseEffect = registry.pulse;
  window.drawBratEffect = registry.brat;
  window.drawEternalSunshineEffect = registry.eternal;
  window.drawAuroraEffect = registry.aurora;

  window.kefeRendererRegistry = Object.freeze(registry);
  window.kefeEffectRendererKeys = keys;
})();
