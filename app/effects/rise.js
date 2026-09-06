/* KEFE — Rise lyric effect: upward lift with a soft settling trail. */
(() => {
  'use strict';
  const M = window.kefeMotion;
  if (!M) throw new Error('KEFE Rise requires effects/motion.js.');

  function render(ctx, w, h, style, lines, time) {
    const active = M.line(lines, time);
    if (!active || !String(active.line.text || '').trim()) return;
    const text = String(active.line.text).trim();
    const size = M.size(ctx, text, style, w);
    const p = M.progress(active, time);
    const lift = Math.max(18, size * 0.34);
    const settle = 1 + 0.035 * Math.sin((1 - p.enter) * Math.PI);
    const y = h * 0.47 + lift * (1 - p.enter);

    M.drawGhost(ctx, text, w / 2, y + lift * 0.42, size, style, 0.12 * (1 - p.enter), size * 0.08);
    M.drawText(ctx, text, w / 2, y, size, style, p.opacity, size * 0.035, 0, 1, settle);
  }

  window.kefeEffects = window.kefeEffects || {};
  window.kefeEffects.rise = render;
})();
