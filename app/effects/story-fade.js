/* KEFE — Fade Up lyric renderer. */
(() => {
  'use strict';
  const u = window.kefeEffectUtils;
  window.kefeEffects = window.kefeEffects || {};
  if (!u) return;

  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, Number(v) || 0));
  const smoother = v => { const t = clamp(v); return t * t * t * (t * (t * 6 - 15) + 10); };
  const font = (ctx, family, size) => {
    ctx.font = `700 ${Math.max(18, size)}px "${family || 'Open Sans'}", system-ui, sans-serif`;
  };

  window.kefeEffects.fadeup = function(ctx, w, h, style, lines, time) {
    const active = u.activeLine(lines, time);
    if (!active) return;
    const words = u.wordsFor(active.line, active.next);
    if (!words.length) return;

    const family = style.kefeMotionFont || 'Open Sans';
    let size = Math.max(34, Math.min(150, Number(style.fontSize) || 78));
    const tracking = 0;
    const maxWidth = w * 0.80;
    let rows = [];
    while (size > 34) {
      font(ctx, family, size);
      const gap = Math.max(12, size * 0.16);
      rows = [];
      let row = [], width = 0;
      for (const word of words) {
        const wordWidth = ctx.measureText(word.text).width;
        const proposed = row.length ? width + gap + wordWidth : wordWidth;
        if (row.length && proposed > maxWidth) {
          rows.push({ words: row, width });
          row = []; width = 0;
        }
        row.push({ ...word, width: wordWidth });
        width = row.length === 1 ? wordWidth : width + gap + wordWidth;
      }
      if (row.length) rows.push({ words: row, width });
      if (rows.length <= 2) break;
      size -= 2;
    }

    const gap = Math.max(12, size * 0.16);
    const rowHeight = size * 1.12;
    const top = h * 0.50 - ((rows.length - 1) * rowHeight) / 2;
    const colour = style.textColor || '#FFFFFF';
    const accent = style.accentColor || colour;

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    font(ctx, family, size);

    rows.forEach((row, rowIndex) => {
      let x = (w - row.width) / 2;
      const y = top + rowIndex * rowHeight;
      for (const word of row.words) {
        const p = clamp(u.wordProgress(word, time).raw);
        if (p <= 0) { x += word.width + gap; continue; }
        const enter = smoother(p / 0.28);
        const settle = smoother((p - 0.18) / 0.42);
        const rise = (1 - enter) * size * 0.28;
        const scale = 0.965 + 0.035 * settle;
        ctx.save();
        ctx.globalAlpha = enter;
        ctx.fillStyle = colour;
        ctx.shadowColor = accent;
        ctx.shadowBlur = settle * size * 0.055;
        ctx.translate(x + word.width / 2, y + rise);
        ctx.scale(scale, scale);
        u.drawTrackedText(ctx, word.text, 0, 0, tracking, 'fillText');
        ctx.restore();
        x += word.width + gap;
      }
    });
    ctx.restore();
  };
})();
