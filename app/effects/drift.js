/* KEFE — Drift lyric effect: diagonal float with restrained rotation and depth. */
(() => {
  'use strict';
  const M = window.kefeMotion;
  if (!M) throw new Error('KEFE Drift requires effects/motion.js.');

  function render(ctx, w, h, style, lines, time) {
    const active = M.line(lines, time);
    if (!active || !String(active.line.text || '').trim()) return;
    const text = String(active.line.text).trim();
    const size = M.size(ctx, text, style, w);
    const p = M.progress(active, time);
    const distance = Math.max(24, size * 0.38);
    const x = w / 2 + distance * (1 - p.enter);
    const y = h * 0.47 - distance * 0.28 * (1 - p.enter);
    const angle = -0.045 * (1 - p.enter);

    M.drawGhost(ctx, text, x + distance * 0.42, y + distance * 0.12, size, style, 0.09 * (1 - p.enter), size * 0.075, angle);
    M.drawText(ctx, text, x, y, size, style, p.opacity, size * 0.035, angle, 1, 1);
  }

  window.kefeEffects = window.kefeEffects || {};
  window.kefeEffects.drift = render;
})();
