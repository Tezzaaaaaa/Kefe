/* KEFE — Brat lyric effect
 * Reference language: Charli XCX / Brat anti-design typography.
 * Deliberately abrupt word cuts, condensed Archivo Narrow typography, loose/awkward
 * composition, low-resolution softness, and no Apple-style interpolation.
 */
(() => {
  'use strict';
  window.kefeEffects = window.kefeEffects || {};
  const U = window.kefeEffectUtils;
  if (!U) throw new Error('KEFE Brat effect requires effects/core.js.');

  function setBratFont(ctx, size) {
    const c=U.contract('brat');
    ctx.font = `${c.weight} ${Math.max(c.min, size)}px "${c.family}", sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  function flattenWords(lines) {
    const out = [];
    for (let i = 0; i < (lines || []).length; i++) {
      const line = lines[i] || {};
      const words = U.wordsFor(line, lines[i + 1] || null);
      for (const word of words) {
        if (!word.text) continue;
        out.push({ ...word, text: String(word.text).toLowerCase(), globalIndex: out.length });
      }
    }
    return out;
  }

  function buildRows(ctx, words, w, h, style) {
    const base = Number(style.fontSize) || 76;
    const side = w * (Number(style.bratSideMargin) || 4.5) / 100;
    const top = h * (Number(style.bratTopMargin) || 4.5) / 100;
    const bottom = h * 0.05;
    const slotHeight = (h - top - bottom) / 5;
    const sizePattern = [1.18, 0.92, 1.12, 0.96, 1.22];
    const wordPattern = [3, 3, 2, 2, 3];
    const rows = [];
    let cursor = 0;
    let rowNumber = 0;

    while (cursor < words.length) {
      const slot = rowNumber % 5;
      const count = wordPattern[slot];
      const rowWords = words.slice(cursor, cursor + count);
      if (!rowWords.length) break;
      let size = Math.max(34, Math.min(slotHeight * 0.74, base * 1.78 * sizePattern[slot]));
      const usableWidth = w - side * 2;
      while (size > 32) {
        setBratFont(ctx, size);
        const total = rowWords.reduce((sum, word) => sum + ctx.measureText(word.text).width, 0);
        const minimumGap = size * 0.08 * Math.max(0, rowWords.length - 1);
        if (total + minimumGap <= usableWidth) break;
        size -= 2;
      }
      setBratFont(ctx, size);
      const widths = rowWords.map(word => ctx.measureText(word.text).width);
      const totalWidth = widths.reduce((sum, value) => sum + value, 0);
      const gap = rowWords.length > 1 ? Math.max(size * 0.025, (usableWidth - totalWidth) / (rowWords.length - 1)) : 0;
      rows.push({ words: rowWords, widths, size, gap, side, page: Math.floor(rowNumber / 5) });
      cursor += rowWords.length;
      rowNumber++;
    }
    return rows;
  }

  function drawWord(ctx, text, x, baseline, size, style, active) {
    setBratFont(ctx, size);
    const colour = style.bratTextColor || style.textColor || '#FFFFFF';
    ctx.save();
    ctx.fillStyle = colour;
    ctx.globalAlpha = 1;
    ctx.filter = 'blur(0.65px)';
    ctx.fillText(text, x, baseline);
    ctx.restore();
    if (active) {
      ctx.save();
      ctx.fillStyle = colour;
      ctx.globalAlpha = 0.22;
      ctx.filter = 'blur(1.2px)';
      ctx.fillText(text, x + 0.35, baseline);
      ctx.restore();
    }
  }

  function render(ctx, w, h, style, lines, time) {
    const words = flattenWords(lines);
    if (!words.length) return;
    const rows = buildRows(ctx, words, w, h, style);
    const currentIndex = words.reduce((last, word, index) => time >= Number(word.time) ? index : last, -1);
    if (currentIndex < 0) return;
    const page = Math.floor(currentIndex / 13);
    const pageRows = rows.filter(row => row.page === page);
    if (!pageRows.length) return;
    const top = h * (Number(style.bratTopMargin) || 4.5) / 100;
    const rowPitch = (h - top - h * 0.05) / 5;
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    for (let i = 0; i < pageRows.length; i++) {
      const row = pageRows[i];
      const baseline = top + rowPitch * i + rowPitch * 0.70;
      let x = row.side;
      for (let wi = 0; wi < row.words.length; wi++) {
        const word = row.words[wi];
        if (word.globalIndex > currentIndex) break;
        drawWord(ctx, word.text, x, baseline, row.size, style, word.globalIndex === currentIndex);
        x += row.widths[wi] + row.gap;
      }
    }
    ctx.restore();
  }
  window.kefeEffects.brat = render;
})();
