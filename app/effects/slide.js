/* KEFE — Slide lyric effect: horizontal entrance with a clean editorial sweep. */
(() => {
  'use strict';
  const M = window.kefeMotion;
  if (!M) throw new Error('KEFE Slide requires effects/motion.js.');

  function render(ctx, w, h, style, lines, time) {
    const active = M.line(lines, time);
    if (!active || !String(active.line.text || '').trim()) return;
    const text = String(active.line.text).trim();
    const size = M.size(ctx, text, style, w);
    const p = M.progress(active, time);
    const distance = Math.max(28, size * 0.48);
    const x = w / 2 - distance * (1 - p.enter);

    M.drawGhost(ctx, text, x - distance * 0.48, h * 0.47, size, style, 0.10 * (1 - p.enter), size * 0.06);
    M.drawText(ctx, text, x, h * 0.47, size, style, p.opacity, size * 0.028);
  }

  window.kefeEffects = window.kefeEffects || {};
  window.kefeEffects.slide = render;
})();
