/* KEFE — shared motion lyric helpers for Rise / Slide / Drop / Drift. */
(() => {
  'use strict';
  const U = window.kefeEffectUtils;
  if (!U) throw new Error('KEFE motion effects require effects/core.js.');

  function size(ctx, text, style, w) {
    return U.fitText(ctx, 'Open Sans', text, Number(style.fontSize) || 76, w * 0.84, 800);
  }

  function drawText(ctx, text, x, y, fontSize, style, alpha = 1, blur = 0, angle = 0, scaleX = 1, scaleY = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scaleX, scaleY);
    U.setFont(ctx, 'Open Sans', fontSize, 800);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = style.textColor || '#FFFFFF';
    ctx.shadowColor = 'rgba(0,0,0,.42)';
    ctx.shadowBlur = Math.max(0, blur || fontSize * .045);
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  function drawGhost(ctx, text, x, y, fontSize, style, alpha, blur, angle = 0) {
    drawText(ctx, text, x, y, fontSize, style, alpha, blur, angle);
  }

  window.kefeMotion = Object.freeze({
    U,
    size,
    drawText,
    drawGhost,
    line: (lines, time) => U.activeLine(lines, time),
    progress: (active, time) => active ? U.lineProgress(active.line, time, .10, .16) : null,
    clamp: U.clamp,
    smooth: U.smooth,
    smoother: U.smoother
  });
})();
