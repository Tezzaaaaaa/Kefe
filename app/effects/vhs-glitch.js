/* KEFE Visualiser — VHS Glitch lyric effect.
   Retro CRT/VHS misтrack look: bold red monospace caps with a cyan/red
   channel split, occasional horizontal tear bands, and faint scanline
   streaks across the frame. Settles into a clean read within its first
   ~0.3s, then glitches only occasionally so the lyric stays legible. */
(() => {
  'use strict';
  const u = window.kefeEffectUtils;
  window.kefeEffects = window.kefeEffects || {};

  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, Number(v) || 0));
  // Deterministic per-frame pseudo-random: same (seed, n) always gives the
  // same value, so glitch pattern is stable within a rendered frame but
  // still reads as noisy from frame to frame.
  const rand = (n, seed) => { const x = Math.sin(n * 12.9898 + seed * 78.233) * 43758.5453; return x - Math.floor(x); };

  function wrap(ctx, text, maxWidth) {
    const words = String(text || '').trim().split(/\s+/).filter(Boolean);
    const rows = [];
    let row = '';
    for (const word of words) {
      const proposed = row ? `${row} ${word}` : word;
      if (row && ctx.measureText(proposed).width > maxWidth) { rows.push(row); row = word; }
      else row = proposed;
    }
    if (row) rows.push(row);
    return rows;
  }

  function fit(ctx, text, requested, maxWidth) {
    let size = Math.max(28, Math.min(140, Number(requested) || 72));
    while (size > 28) {
      u.setContractFont(ctx, 'vhsglitch', size);
      const rows = wrap(ctx, text, maxWidth);
      if (rows.length <= 3) return { size, rows };
      size -= 2;
    }
    u.setContractFont(ctx, 'vhsglitch', size);
    return { size, rows: wrap(ctx, text, maxWidth) };
  }

  window.kefeEffects.vhsglitch = function(ctx, w, h, style, lines, time) {
    const active = u.activeLine(lines, time);
    if (!active) return;
    const text = String(active.line.text || '').trim().toUpperCase();
    if (!text) return;

    const start = Number(active.line.time) || 0;
    const end = Math.max(start + 0.3, Number(active.line.endTime) || start + 3);
    const elapsed = time - start;
    const endFade = clamp((end - time) / 0.2);
    const settleIn = clamp(elapsed / 0.32);
    // A few extra unsettled bursts through the hold, not just on entry.
    const seed = Math.floor(time * 9);
    const burst = settleIn >= 1 && rand(1.7, seed) > 0.88;
    const unsettled = settleIn < 1 || burst;

    const prepared = fit(ctx, text, style.fontSize, w * 0.82);
    const size = prepared.size;
    const rowHeight = size * (u.contract('vhsglitch').lineHeight || 1.15);
    const totalHeight = prepared.rows.length * rowHeight;
    const top = h * 0.5 - totalHeight / 2 + rowHeight / 2;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    u.setContractFont(ctx, 'vhsglitch', size);
    ctx.globalAlpha = endFade * clamp(elapsed / 0.06, 0, 1);

    const redColor = style.vhsglitchColor || '#FF2A2A';
    const cyanColor = style.vhsglitchAccent || '#20E0FF';

    prepared.rows.forEach((row, i) => {
      const y = top + i * rowHeight;
      const jitterX = unsettled ? (rand(i * 7.7 + 1, seed) - 0.5) * size * 0.16 : 0;
      const split = unsettled ? size * 0.03 : size * 0.008;

      // Cyan channel, offset left — classic VHS colour-bleed.
      ctx.fillStyle = cyanColor;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillText(row, w / 2 + jitterX - split, y);

      // Red channel on top, slightly right.
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = redColor;
      ctx.fillText(row, w / 2 + jitterX + split, y);

      // Occasional torn slice: a thin band of this row redrawn with its
      // own horizontal shift, clipped to a strip.
      if (unsettled && rand(i * 5.3 + 2, seed) > 0.45) {
        const bandH = Math.max(3, rowHeight * 0.2);
        const bandY = y - rowHeight / 2 + rand(i * 2.2, seed) * (rowHeight - bandH);
        const shift = (rand(i * 9.9, seed) - 0.5) * size * 0.3;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, bandY, w, bandH);
        ctx.clip();
        ctx.fillStyle = redColor;
        ctx.fillText(row, w / 2 + jitterX + shift, y);
        ctx.restore();
      }
    });

    // Faint full-width scanline streaks, sparse and low-opacity so they
    // read as background static rather than obscuring the lyric.
    for (let s = 0; s < 4; s++) {
      if (rand(s * 13.7 + 0.5, seed) > 0.72) {
        const sy = rand(s * 4.4 + 3, seed) * h;
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = endFade * (0.06 + rand(s, seed) * 0.1);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, sy);
        ctx.lineTo(w, sy);
        ctx.stroke();
      }
    }

    ctx.restore();
  };
})();
