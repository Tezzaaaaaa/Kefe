/* KEFE Visualiser — Typewriter lyric effect */
(() => {
  'use strict';
  const u = window.kefeEffectUtils;
  window.kefeEffects = window.kefeEffects || {};

  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, Number(v) || 0));
  const smooth = v => { const t = clamp(v); return t * t * (3 - 2 * t); };

  function trackedWidth(ctx, text, tracking) {
    const chars = Array.from(String(text));
    if (!chars.length) return 0;
    return chars.reduce((sum, char) => sum + ctx.measureText(char).width, 0) + Math.max(0, chars.length - 1) * tracking;
  }

  function wrap(ctx, text, size, tracking, maxWidth) {
    const words = String(text || '').trim().split(/\s+/).filter(Boolean);
    const rows = [];
    let row = '';
    let width = 0;
    const space = trackedWidth(ctx, ' ', tracking);
    for (const word of words) {
      const wordWidth = trackedWidth(ctx, word, tracking);
      const proposed = row ? width + space + wordWidth : wordWidth;
      if (row && proposed > maxWidth) {
        rows.push({ text: row, width });
        row = word;
        width = wordWidth;
      } else {
        row = row ? `${row} ${word}` : word;
        width = proposed;
      }
    }
    if (row) rows.push({ text: row, width });
    return rows;
  }

  function fit(ctx, text, requested, tracking, maxWidth) {
    let size = Math.max(32, Math.min(140, Number(requested) || 76));
    while (size > 32) {
      u.setContractFont(ctx, 'typewriter', size);
      const rows = wrap(ctx, text, size, tracking * size, maxWidth);
      if (rows.length <= 2) return { size, rows };
      size -= 2;
    }
    u.setContractFont(ctx, 'typewriter', size);
    return { size, rows: wrap(ctx, text, size, tracking * size, maxWidth) };
  }

  window.kefeEffects.typewriter = function(ctx, w, h, style, lines, time) {
    const active = u.activeLine(lines, time);
    if (!active) return;
    const text = String(active.line.text || '').trim();
    if (!text) return;

    const contract = u.contract('typewriter');
    const tracking = Number(contract.tracking) || 0;
    const prepared = fit(ctx, text, style.fontSize, tracking, w * 0.78);
    const size = prepared.size;
    const rows = prepared.rows;
    const trackingPx = tracking * size;
    const rowHeight = size * 1.12;
    const totalHeight = rows.length * rowHeight;
    const top = h * 0.50 - totalHeight / 2 + rowHeight / 2;

    const start = Number(active.line.time) || 0;
    const end = Math.max(start + 0.30, Number(active.line.endTime) || start + 3);
    const duration = end - start;
    const chars = Array.from(text);
    const revealDuration = Math.min(Math.max(0.72, duration * 0.76), Math.max(0.72, duration - 0.10));
    const progress = clamp((time - start) / revealDuration);
    const revealCount = Math.min(chars.length, Math.floor(smooth(progress) * chars.length + 0.999));

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = style.textColor || '#FFFFFF';
    ctx.globalAlpha = 1;
    u.setContractFont(ctx, 'typewriter', size);

    let remaining = revealCount;
    let caret = null;

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      const rowChars = Array.from(row.text);
      const shownCount = Math.max(0, Math.min(rowChars.length, remaining));
      const shown = rowChars.slice(0, shownCount).join('');
      const x = (w - row.width) / 2;
      const y = top + rowIndex * rowHeight;
      if (shown) u.drawTrackedText(ctx, shown, x, y, trackingPx, 'fillText');

      if (time >= start && time < end && rowIndex === rows.length - 1) {
        caret = { x: x + trackedWidth(ctx, shown, trackingPx), y };
      }

      remaining = Math.max(0, remaining - rowChars.length);
    }

    if (caret) {
      const blink = 0.58 + 0.42 * (0.5 + 0.5 * Math.sin((time - start) * Math.PI * 5.0));
      ctx.save();
      ctx.globalAlpha = blink;
      ctx.fillRect(Math.round(caret.x + size * 0.025), caret.y - size * 0.42, Math.max(1.5, size * 0.014), size * 0.84);
      ctx.restore();
    }

    if (active.next && time >= Number(active.next.time) - 0.12 && time < Number(active.next.time)) {
      const incoming = smooth((time - (Number(active.next.time) - 0.12)) / 0.12);
      const nextText = String(active.next.text || '').trim();
      if (nextText) {
        const nextFit = fit(ctx, nextText, size * 0.72, tracking, w * 0.72);
        ctx.globalAlpha = incoming * 0.10;
        u.setContractFont(ctx, 'typewriter', nextFit.size);
        u.drawTrackedText(ctx, nextFit.text || nextText, w / 2, h * 0.50 + totalHeight * 0.62, tracking * nextFit.size, 'fillText');
      }
    }

    ctx.restore();
  };
})();
