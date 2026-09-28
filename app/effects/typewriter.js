/* KEFE Visualiser — Typewriter lyric effect.
   Mechanical typing: key-press jitter, cursor, carriage return. */
(() => {
  'use strict';
  const u = window.kefeEffectUtils;
  window.kefeEffects = window.kefeEffects || {};

  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, Number(v) || 0));
  const smooth = v => { const t = clamp(v); return t * t * (3 - 2 * t); };

  function trackedWidth(ctx, text, tracking) {
    const chars = Array.from(String(text));
    if (!chars.length) return 0;
    return chars.reduce((sum, c) => sum + ctx.measureText(c).width, 0)
      + Math.max(0, chars.length - 1) * tracking;
  }

  function wrap(ctx, text, tracking, maxWidth) {
    const words = String(text || '').trim().split(/\s+/).filter(Boolean);
    const rows = [];
    let row = '';
    let width = 0;
    const space = trackedWidth(ctx, ' ', tracking);
    for (const word of words) {
      const ww = trackedWidth(ctx, word, tracking);
      const proposed = row ? width + space + ww : ww;
      if (row && proposed > maxWidth) {
        rows.push({ text: row, width });
        row = word;
        width = ww;
      } else {
        row = row ? row + ' ' + word : word;
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
      const rows = wrap(ctx, text, tracking * size, maxWidth);
      if (rows.length <= 3) return { size, rows };
      size -= 2;
    }
    u.setContractFont(ctx, 'typewriter', size);
    return { size, rows: wrap(ctx, text, tracking * size, maxWidth) };
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
    const rowHeight = size * 1.18;
    const totalH = rows.length * rowHeight;
    const topY = h * 0.50 - totalH / 2 + rowHeight / 2;

    const start = Number(active.line.time) || 0;
    const end = Math.max(start + 0.30, Number(active.line.endTime) || start + 3);
    const duration = end - start;
    const chars = Array.from(text);

    // Reveal in 60% of the line's duration — the reader gets the rest to read.
    const revealDuration = Math.max(0.32, Math.min(1.45, duration * 0.60));
    const progress = clamp((time - start) / revealDuration);
    const revealCount = Math.min(chars.length, Math.floor(smooth(progress) * chars.length + 0.999));

    const colour = style.textColor || '#FFFFFF';
    const msSinceType = ((time - start) * 1000) % 90;
    const keyJitter = 1.6 * (1 - clamp(msSinceType / 90));

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = colour;
    u.setContractFont(ctx, 'typewriter', size);

    let remaining = revealCount;
    let cursorPos = null;

    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      const row = rows[rowIdx];
      const rowChars = Array.from(row.text);
      const shownCount = Math.max(0, Math.min(rowChars.length, remaining));
      const shown = rowChars.slice(0, shownCount).join('');
      const x = (w - row.width) / 2;
      const y = topY + rowIdx * rowHeight;

      // The whole row's eventual text at very low opacity — the ghost
      // impression of the paper waiting for the carriage.
      ctx.globalAlpha = 0.10;
      u.drawTrackedText(ctx, row.text, x, y, trackingPx, 'fillText');

      // Typed characters, fully opaque.
      ctx.globalAlpha = 1;
      const shownWidth = trackedWidth(ctx, shown, trackingPx);
      if (shown) u.drawTrackedText(ctx, shown, x, y, trackingPx, 'fillText');

      // Key-press nudge on the character just typed.
      if (shown.length > 0 && remaining > 0 && remaining <= rowChars.length) {
        const lastChar = shown[shown.length - 1];
        const lastCharWidth = ctx.measureText(lastChar).width;
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.translate(0, -keyJitter);
        u.drawTrackedText(
          ctx,
          lastChar,
          x + shownWidth - lastCharWidth - trackingPx,
          y,
          trackingPx,
          'fillText'
        );
        ctx.restore();
      }

      // Cursor: follows the typing head, blinks on a slow cycle.
      if (time >= start && time < end && shownCount < rowChars.length && remaining > 0) {
        const blinkPhase = ((time - start) % 0.72);
        const blink = blinkPhase < 0.58 ? 1 : 0.2;
        cursorPos = { x: x + shownWidth + size * 0.02, y, blink };
      }

      remaining = Math.max(0, remaining - rowChars.length);
    }

    if (cursorPos) {
      ctx.save();
      ctx.globalAlpha = cursorPos.blink;
      ctx.fillStyle = colour;
      ctx.fillRect(
        Math.round(cursorPos.x),
        cursorPos.y - size * 0.44,
        Math.max(2, size * 0.018),
        size * 0.88
      );
      ctx.restore();
    }

    ctx.restore();
  };
})();
