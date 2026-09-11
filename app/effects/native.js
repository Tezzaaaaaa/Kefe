/* KEFE — canonical renderer registry for the built-in effects. */
(() => {
  'use strict';

  window.kefeEffects = window.kefeEffects || {};

  // Apple and Pulse remain implemented in app.js because they use the editor's
  // native rendering helpers. Register those existing renderers here instead
  // of maintaining a second dispatch path.
  if (typeof window.drawAppleEffect === 'function') window.kefeEffects.apple = window.drawAppleEffect;
  if (typeof window.drawPulseEffect === 'function') window.kefeEffects.pulse = window.drawPulseEffect;

  const required = [
    'apple', 'brat', 'eternal', 'aurora', 'pulse', 'typewriter', 'instagram',
    'fadeup', 'storyfade', 'decrypt', 'blur', 'shiny', 'scrolllines',
    'rise', 'slide', 'drop', 'drift'
  ];

  // Replace the legacy switch in app.js with one registry lookup. This keeps
  // render() as the sole rendering owner while every effect has one key.
  window.renderLyricsEffect = function renderLyricsEffect(ctx, w, h, style, lines, time) {
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    ctx.shadowBlur = 0;
    try {
      const key = style?.effect || 'apple';
      const renderer = window.kefeEffects[key];
      if (typeof renderer === 'function') {
        renderer(ctx, w, h, style || {}, lines || [], time);
        return;
      }
      const fallback = window.kefeEffects.apple;
      if (typeof fallback === 'function') fallback(ctx, w, h, style || {}, lines || [], time);
    } finally {
      ctx.restore();
    }
  };

  window.kefeEffectRendererKeys = required;
})();
