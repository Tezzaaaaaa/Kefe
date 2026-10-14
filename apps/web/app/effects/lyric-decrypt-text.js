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

  function drawLine(ctx, w, h, style, line, next, time, phase) {
    const text = String(line.text || '').trim().replace(/\s+/g, ' ');
    if (!text) return;
    const setF = u.contractFontSetter('decrypt');
    const lh = u.contract('decrypt').lineHeight || 1.1;
    const lay = u.layoutText(ctx, text, { setFont: setF, size: Math.min(140, Number(style.fontSize) || 72), minSize: 18, maxWidth: w * 0.84, maxHeight: h * 0.8, lineHeight: lh, maxLines: 6 });
    const size = lay.size;
    const rowHeight = size * lh;
    const top = h * 0.5 - lay.lines.length * rowHeight / 2 + rowHeight / 2;
    const map = u.charMap(lay.lines, u.wordsFor(line, next));
    const text0 = style.textColor || '#FFFFFF', accent = style.accentColor || '#7CFFB2';
    // glyph flicker runs on a fixed 28 Hz grid so the scramble reads the same at preview and export frame rates
    const tick = Math.floor(time * 28);

    ctx.save();
    ctx.globalAlpha = clamp(phase.alpha);
    ctx.translate(0, -phase.leave * size * 0.10);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    setF(ctx, size);

    let gi = 0;
    for (let rowIndex = 0; rowIndex < lay.lines.length; rowIndex++) {
      const row = lay.lines[rowIndex];
      const y = top + rowIndex * rowHeight;
      const rowWidth = ctx.measureText(row).width;
      let x = w / 2 - rowWidth / 2;
      const cells = map[rowIndex];
      let k = 0;
      for (const ch of Array.from(row)) {
        const cell = cells[k++] || { word: { time: 0, endTime: 0 }, j: 0, n: 1, space: ch === ' ' };
        const charWidth = ctx.measureText(ch).width;
        const cx = x + charWidth / 2;
        x += charWidth;
        const idx = gi++;
        if (ch === ' ') continue;
        const wd = cell.word, dur = Math.max(0.06, wd.endTime - wd.time);
        // each character scrambles from its word's start and locks in left-to-right, the last one landing before the word ends
        const scr = clamp(dur * 0.35, 0.08, 0.24);
        const lockAt = wd.time + scr + (dur - scr) * 0.85 * (cell.j / Math.max(1, cell.n));
        if (time < wd.time - 0.02) continue;                                   // not sung yet
        const appear = clamp((time - (wd.time - 0.02)) / 0.06);
        if (time < lockAt) {
          ctx.globalAlpha = clamp(phase.alpha) * appear;
          ctx.fillStyle = accent;
          ctx.fillText(glyphFor(tick * 13.7 + idx * 7.13), cx, y);
        } else {
          const settle = clamp((time - lockAt) / 0.14);                        // quick pop as the real letter locks in
          const pop = 1 + 0.10 * (1 - u.smoother(settle));
          ctx.globalAlpha = clamp(phase.alpha);
          ctx.fillStyle = text0;
          if (pop > 1.001) { ctx.save(); ctx.translate(cx, y); ctx.scale(pop, pop); ctx.fillText(ch, 0, 0); ctx.restore(); }
          else ctx.fillText(ch, cx, y);
        }
      }
    }
    ctx.restore();
  }

  window.kefeEffects.decrypt = function(ctx, w, h, style, lines, time) {
    const stack = u.lineStack(lines, time, 0.10, 0.16);
    for (const it of stack) drawLine(ctx, w, h, style, it.line, it.next, time, it);
  };
})();
