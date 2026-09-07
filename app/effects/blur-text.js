/* KEFE Visualiser — Blur Text lyric effect.
   Bits-family "Blur Text" animation, ported to canvas: each word drifts
   up from a blurred, low-opacity state into sharp focus, staggered
   left to right. */
(() => {
  'use strict';
  const u = window.kefeEffectUtils;
  window.kefeEffects = window.kefeEffects || {};

  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, Number(v) || 0));
  const smoother = (v) => { const t = clamp(v); return t * t * t * (t * (t * 6 - 15) + 10); };

  function layout(ctx, text, maxWidth) {
    const words = String(text || '').trim().split(/\s+/).filter(Boolean);
    const rows = [[]];
    let width = 0;
    const space = ctx.measureText(' ').width;
    for (const word of words) {
      const wordWidth = ctx.measureText(word).width;
      const proposed = rows[rows.length - 1].length ? width + space + wordWidth : wordWidth;
      if (rows[rows.length - 1].length && proposed > maxWidth) { rows.push([word]); width = wordWidth; }
      else { rows[rows.length - 1].push(word); width = proposed; }
    }
    return rows;
  }

  function fit(ctx, text, requested, maxWidth) {
    let size = Math.max(30, Math.min(140, Number(requested) || 74));
    while (size > 30) {
      u.setContractFont(ctx, 'blur', size);
      const rows = layout(ctx, text, maxWidth);
      if (rows.length <= 3) return { size, rows };
      size -= 2;
    }
    u.setContractFont(ctx, 'blur', size);
    return { size, rows: layout(ctx, text, maxWidth) };
  }

  window.kefeEffects.blur = function(ctx, w, h, style, lines, time) {
    const active = u.activeLine(lines, time);
    if (!active) return;
    const text = String(active.line.text || '').trim();
    if (!text) return;

    const start = Number(active.line.time) || 0;
    const end = Math.max(start + 0.3, Number(active.line.endTime) || start + 3);
    const elapsed = time - start;
    const endFade = clamp((end - time) / 0.22, 0, 1);

    const prepared = fit(ctx, text, style.fontSize, w * 0.8);
    const size = prepared.size;
    const rowHeight = size * (u.contract('blur').lineHeight || 1.14);
    const totalHeight = prepared.rows.length * rowHeight;
    const top = h * 0.5 - totalHeight / 2 + rowHeight / 2;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = style.textColor || '#FFFFFF';
    u.setContractFont(ctx, 'blur', size);
    const space = ctx.measureText(' ').width;

    let globalWordIndex = 0;
    const totalWords = prepared.rows.reduce((sum, row) => sum + row.length, 0) || 1;

    for (let rowIndex = 0; rowIndex < prepared.rows.length; rowIndex++) {
      const row = prepared.rows[rowIndex];
      const rowText = row.join(' ');
      const rowWidth = ctx.measureText(rowText).width;
      const y = top + rowIndex * rowHeight;
      let x = w / 2 - rowWidth / 2;

      for (const word of row) {
        const wordWidth = ctx.measureText(word).width;
        const delay = (globalWordIndex / totalWords) * 0.42;
        const p = smoother(clamp((elapsed - delay) / 0.42));
        const cx = x + wordWidth / 2;

        ctx.save();
        ctx.globalAlpha = p * endFade;
        ctx.filter = `blur(${Math.max(0, (1 - p) * size * 0.16)}px)`;
        ctx.translate(cx, y + (1 - p) * size * 0.28);
        ctx.fillText(word, 0, 0);
        ctx.restore();

        x += wordWidth + space;
        globalWordIndex++;
      }
    }
  };
})();
