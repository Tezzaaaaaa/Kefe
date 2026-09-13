/* KEFE Visualiser — Instagram Story lyric sticker.
   - Heavy condensed uppercase type
   - Each line's font size adapts to fit the column (short lines go huge)
   - Left-aligned within a centred rectangular block
   - Word-by-word colour fade as sung (smooth ~220ms per word)
   - Block is bounded by a rectangular area so it doesn't fill the frame
   Supports line-level and word-level LRC timing. */
(() => {
  'use strict';
  const u = window.kefeEffectUtils;
  window.kefeEffects = window.kefeEffects || {};

  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, Number(v) || 0));
  const smooth = v => { const t = clamp(v); return t * t * (3 - 2 * t); };
  const smoother = v => { const t = clamp(v); return t * t * t * (t * (t * 6 - 15) + 10); };

  // The bounding rectangle of the lyric block, as fractions of the frame.
  // Anything outside this box is off-limits — the effect never spills over.
  const BOX = { x: 0.16, y: 0.12, w: 0.68, h: 0.76 };  // narrow vertical column

  function boxRect(w, h) {
    return {
      left:   Math.round(w * BOX.x),
      top:    Math.round(h * BOX.y),
      width:  Math.round(w * BOX.w),
      height: Math.round(h * BOX.h)
    };
  }

  // Heavy condensed face; user override via style.instagramFontFamily.
  function setInstagramFont(ctx, size, weight) {
    const family = '"Inter Tight", "Helvetica Neue Condensed", "Arial Narrow", Impact, sans-serif';
    ctx.font = `${weight || 900} ${Math.max(20, size)}px ${family}`;
  }

  // Fit one line so its width fills the column — the signature Instagram move.
  function sizeForLine(ctx, text, columnW, maxSize, minSize) {
    const upper = String(text || '').trim().toUpperCase();
    if (!upper) return minSize;
    setInstagramFont(ctx, 100, 900);
    const baseWidth = ctx.measureText(upper).width;
    if (!baseWidth) return minSize;
    let target = Math.floor((columnW / baseWidth) * 100);
    if (target > maxSize) target = maxSize;
    if (target < minSize) target = minSize;
    return target;
  }

  function wordTimings(line) {
    const text = String(line.text || '').trim();
    const tokens = text.split(/\s+/).filter(Boolean);
    if (!tokens.length) return [];
    if (Array.isArray(line.words) && line.words.length === tokens.length) {
      return line.words.map((w, i) => ({
        text: tokens[i],
        start: Number(w.time) || 0,
        end: Number(w.endTime) || Number(w.time) + 0.5
      }));
    }
    const start = Number(line.time) || 0;
    const next = Number(line.nextLineTime);
    const end = Number.isFinite(Number(line.endTime))
      ? Number(line.endTime)
      : (Number.isFinite(next) ? next : start + 3);
    const span = Math.max(0.4, end - start);
    const per = span / tokens.length;
    return tokens.map((t, i) => ({
      text: t,
      start: start + i * per,
      end: start + (i + 1) * per
    }));
  }

  window.kefeEffects.instagram = function(ctx, w, h, style, lines, time) {
    if (!Array.isArray(lines) || !lines.length || !Number.isFinite(time)) return;
    const active = u.activeLine(lines, time);
    if (!active || !active.line) return;

    const rect = boxRect(w, h);
    const columnW = rect.width;
    const leftX = rect.left;

    const userMax = Number(style.instagramFontSize ?? style.fontSize);
    const maxSize = (Number.isFinite(userMax) && userMax > 0 ? userMax : 96) * 1.85;
    const minSize = 30;
    const gap = 0.02;

    // Visible lines: one before, current, and enough after to fill the box.
    const before = 1;
    const after = 8;
    const entries = [];
    for (let i = Math.max(0, active.index - before); i <= active.index + after && i < lines.length; i++) {
      if (!lines[i]) continue;
      entries.push({ line: lines[i], index: i });
    }
    if (!entries.length) return;

    // Build rows with per-line size + measured widths.
    const rows = [];
    for (const entry of entries) {
      const upperText = String(entry.line.text || '').trim().toUpperCase();
      if (!upperText) continue;
      const size = sizeForLine(ctx, upperText, columnW, maxSize, minSize);
      const rowHeight = size * (1 + gap);
      const words = wordTimings(entry.line).map(w => ({ ...w, upper: w.text.toUpperCase() }));
      setInstagramFont(ctx, size, 900);
      const widths = words.map(wd => ctx.measureText(wd.upper).width);
      const space = ctx.measureText(' ').width;
      const rowWidth = widths.reduce((a, b) => a + b, 0) + space * Math.max(0, widths.length - 1);
      rows.push({ lineIndex: entry.index, size, rowHeight, words, widths, space, rowWidth });
    }
    if (!rows.length) return;

    // If the total height exceeds the box, scroll so the active row is visible
    // but never draw outside the box. We clip in that case.
    const totalH = rows.reduce((s, r) => s + r.rowHeight, 0);
    const activeRowIdx = Math.max(0, rows.findIndex(r => r.lineIndex === active.index));
    let offsetY;
    if (totalH <= rect.height) {
      // Fits — anchor at top of the box.
      offsetY = rect.top;
    } else {
      // Scroll so active row is around 35% down the box.
      const rowsAbove = rows.slice(0, activeRowIdx).reduce((s, r) => s + r.rowHeight, 0);
      const desired = rect.top + rect.height * 0.35 - rowsAbove;
      const minY = rect.top - (totalH - rect.height);
      offsetY = clamp(desired, minY, rect.top);
    }

    const primary = style.instagramTextColor || '#FFFFFF';
    const mutedAlpha = 0.32;
    // Word fade duration. Instagram uses a soft crossfade rather than a
    // hard switch — 220ms reads as a smooth glow-in, not a pop.
    const FADE = 0.22;

    ctx.save();
    // Clip to the box so scrolling rows never spill outside.
    ctx.beginPath();
    ctx.rect(rect.left, rect.top, rect.width, rect.height);
    ctx.clip();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    let y = offsetY;
    for (const row of rows) {
      const baseline = y + row.size * 0.86;
      let x = leftX;
      setInstagramFont(ctx, row.size, 900);
      ctx.shadowColor = 'rgba(0,0,0,0.38)';
      ctx.shadowBlur = row.size * 0.08;
      ctx.shadowOffsetY = Math.max(1, row.size * 0.01);

      for (let wi = 0; wi < row.words.length; wi++) {
        const word = row.words[wi];
        const sinceStart = time - word.start;
        let t;
        if (sinceStart <= 0) t = 0;
        else if (sinceStart >= FADE) t = 1;
        else t = smoother(sinceStart / FADE);

        ctx.globalAlpha = mutedAlpha + (1 - mutedAlpha) * t;
        ctx.fillStyle = primary;
        setInstagramFont(ctx, row.size, 900);
        ctx.fillText(word.upper, x, baseline);
        x += row.widths[wi] + row.space;
      }

      y += row.rowHeight;
    }

    ctx.restore();
  };
})();
