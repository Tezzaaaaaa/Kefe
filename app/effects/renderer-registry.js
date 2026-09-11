/* KEFE — single lyric-effect renderer registry. */
(() => {
  'use strict';

  const keys = [
    'apple', 'brat', 'eternal', 'aurora', 'pulse', 'typewriter', 'instagram',
    'fadeup', 'storyfade', 'decrypt', 'blur', 'shiny', 'scrolllines',
    'rise', 'slide', 'drop', 'drift'
  ];

  const registry = Object.create(null);
  for (const key of keys) {
    registry[key] = (ctx, w, h, style, lines, time) => {
      if (key === 'apple') return window.drawAppleEffect?.(ctx, w, h, style, lines, time);
      if (key === 'pulse') return window.drawPulseEffect?.(ctx, w, h, style, lines, time);
      const renderer = window.kefeEffects?.[key];
      if (typeof renderer === 'function') return renderer(ctx, w, h, style, lines, time);
    };
  }

  window.kefeRendererRegistry = Object.freeze(registry);
  window.kefeEffectRendererKeys = Object.freeze(keys);
})();
