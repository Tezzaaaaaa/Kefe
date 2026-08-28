/* KEFE Visualiser — Fade Up effect */
(() => {
  'use strict';
  const u = window.kefeEffectUtils;
  window.kefeEffects = window.kefeEffects || {};

  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, Number(v) || 0));
  const smooth = v => { const t = clamp(v); return t * t * (3 - 2 * t); };
  const smoother = v => { const t = clamp(v); return t * t * t * (t * (t * 6 - 15) + 10); };

  function trackedWidth(ctx, text, tracking) {
    const chars = Array.from(String(text));
    if (!chars.length) return 0;
    return chars.reduce((sum, char) => sum + ctx.measureText(char).width, 0) + Math.max(0, chars.length - 1) * tracking;
  }

  function wrapWords(ctx, words, size, tracking, maxWidth) {
    const gap = Math.max(12, size * 0.16);
    const rows = [];
    let row = [];
    let width = 0;
    for (const word of words) {
      const wordWidth = trackedWidth(ctx, word.text, tracking);
      const proposed = row.length ? width + gap + wordWidth : wordWidth;
      if (row.length && proposed > maxWidth) {
        rows.push({ words: row, width });
        row = [];
        width = 0;
      }
      row.push({ ...word, width: wordWidth });
      width = row.length === 1 ? wordWidth : width + gap + wordWidth;
    }
    if (row.length) rows.push({ words: row, width });
    return rows;
  }

  function fit(ctx, words, requested, tracking, maxWidth) {
    let size = Math.max(34, Math.min(150, Number(requested) || 78));
    while (size > 34) {
      u.setContractFont(ctx, 'fadeup', size);
      const rows = wrapWords(ctx, words, size, tracking * size, maxWidth);
      if (rows.length <= 2) return { size, rows };
      size -= 2;
    }
    u.setContractFont(ctx, 'fadeup', size);
    return { size, rows: wrapWords(ctx, words, size, tracking * size, maxWidth) };
  }

  window.kefeEffects.fadeup = function(ctx, w, h, style, lines, time) {
    const active = u.activeLine(lines, time);
    if (!active) return;
    const words = u.wordsFor(active.line, active.next);
    if (!words.length) return;

    const contract = u.contract('fadeup');
    const tracking = Number(contract.tracking) || 0;
    const prepared = fit(ctx, words, style.fontSize, tracking, w * 0.80);
    const size = prepared.size;
    const rows = prepared.rows;
    const trackingPx = tracking * size;
    const rowHeight = size * 1.12;
    const top = h * 0.50 - ((rows.length - 1) * rowHeight) / 2;
    const gap = Math.max(12, size * 0.16);
    const colour = style.textColor || '#FFFFFF';
    const accent = style.accentColor || colour;

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';

    rows.forEach((row, rowIndex) => {
      let x = (w - row.width) / 2;
      const y = top + rowIndex * rowHeight;

      for (const word of row.words) {
        const wp = u.wordProgress(word, time);
        const p = clamp(wp.raw);
        if (p <= 0) {
          x += word.width + gap;
          continue;
        }

        // One clean rise per word. The word moves only while entering, then
        // settles completely, so consecutive words never wobble or reflow.
        const enter = smoother(p / 0.28);
        const settle = smoother((p - 0.18) / 0.42);
        const rise = (1 - enter) * size * 0.28;
        const scale = 0.965 + 0.035 * settle;
        const alpha = enter;
        const glow = settle * size * 0.055;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = colour;
        ctx.shadowColor = accent;
        ctx.shadowBlur = glow;
        ctx.translate(x + word.width / 2, y + rise);
        ctx.scale(scale, scale);
        u.drawTrackedText(ctx, word.text, 0, 0, trackingPx, 'fillText');
        ctx.restore();

        x += word.width + gap;
      }
    });

    ctx.restore();
  };
})();
