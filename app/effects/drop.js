/* KEFE — Drop lyric effect: downward entrance with a brief weighty settle. */
(() => {
  'use strict';
  const M = window.kefeMotion;
  if (!M) throw new Error('KEFE Drop requires effects/motion.js.');

  function render(ctx, w, h, style, lines, time) {
    const active = M.line(lines, time);
    if (!active || !String(active.line.text || '').trim()) return;
    const text = String(active.line.text).trim();
    const size = M.size(ctx, text, style, w);
    const p = M.progress(active, time);
    const distance = Math.max(26, size * 0.42);
    const y = h * 0.47 - distance * (1 - p.enter);
    const impact = Math.sin(p.enter * Math.PI);
    const scaleY = 1 + 0.045 * impact;
    const scaleX = 1 - 0.025 * impact;

    M.drawGhost(ctx, text, w / 2, y - distance * 0.42, size, style, 0.10 * (1 - p.enter), size * 0.07);
    M.drawText(ctx, text, w / 2, y, size, style, p.opacity, size * 0.04, 0, scaleX, scaleY);
  }

  window.kefeEffects = window.kefeEffects || {};
  window.kefeEffects.drop = render;
})();
