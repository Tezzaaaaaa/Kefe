/* KEFE Visualiser — Decrypted Text lyric effect.
   Bits-family "Decrypted Text" text animation, ported to canvas: each
   character cycles through random glyphs before locking into place,
   left to right. */
(() => {
  'use strict';
  const u = window.kefeEffectUtils;
  window.kefeEffects = window.kefeEffects || {};

  const GLYPHS = '!<>-_\\/[]{}—=+*^?#$%&@ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, Number(v) || 0));
  const glyphFor = (seed) => GLYPHS[Math.floor(Math.abs(Math.sin(seed) * 10000) % GLYPHS.length)];

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
      u.setContractFont(ctx, 'decrypt', size);
      const rows = wrap(ctx, text, maxWidth);
      if (rows.length <= 3) return { size, rows };
      size -= 2;
    }
    u.setContractFont(ctx, 'decrypt', size);
    return { size, rows: wrap(ctx, text, maxWidth) };
  }

  window.kefeEffects.decrypt = function(ctx, w, h, style, lines, time) {
    const active = u.activeLine(lines, time);
    if (!active) return;
    const text = String(active.line.text || '').trim();
    if (!text) return;

    const start = Number(active.line.time) || 0;
    const end = Math.max(start + 0.3, Number(active.line.endTime) || start + 3);
    const scrambleDuration = clamp(Math.min(0.9, (end - start) * 0.5), 0, 1) || 0.55;
    const elapsed = time - start;

    const prepared = fit(ctx, text, style.fontSize, w * 0.8);
    const size = prepared.size;
    const rowHeight = size * (u.contract('decrypt').lineHeight || 1.1);
    const totalHeight = prepared.rows.length * rowHeight;
    const top = h * 0.5 - totalHeight / 2 + rowHeight / 2;

    const endFade = clamp((end - time) / 0.22, 0, 1);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    u.setContractFont(ctx, 'decrypt', size);

    let globalCharIndex = 0;
    for (let rowIndex = 0; rowIndex < prepared.rows.length; rowIndex++) {
      const row = prepared.rows[rowIndex];
      const chars = Array.from(row);
      const y = top + rowIndex * rowHeight;
      const rowWidth = ctx.measureText(row).width;
      let x = w / 2 - rowWidth / 2;

      for (let i = 0; i < chars.length; i++) {
        const char = chars[i];
        const charWidth = ctx.measureText(char).width;
        const charCx = x + charWidth / 2;
        // Stagger lock-in left to right across the whole line.
        const totalChars = Math.max(1, text.length);
        const charDelay = (globalCharIndex / totalChars) * scrambleDuration * 0.7;
        const localProgress = clamp((elapsed - charDelay) / (scrambleDuration * 0.3));
        const settled = localProgress >= 1 || char === ' ';

        ctx.globalAlpha = clamp(elapsed / 0.08, 0, 1) * endFade;
        if (settled) {
          ctx.fillStyle = style.textColor || '#FFFFFF';
          ctx.fillText(char, charCx, y);
        } else if (elapsed > 0) {
          ctx.fillStyle = style.accentColor || '#7CFFB2';
          ctx.fillText(glyphFor(time * 34 + globalCharIndex * 7.13), charCx, y);
        }

        x += charWidth;
        globalCharIndex++;
      }
    }

    ctx.restore();
  };
})();
