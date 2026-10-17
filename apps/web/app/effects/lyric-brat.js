(() => {
  'use strict';

  /* Brat lyric effect — canvas renderer adapted to KEFE's timed lyric pipeline. */
  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
  const finite = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));

  function normaliseLine(lines, index) {
    const source = lines[index];
    if (!source) return null;
    const start = Number(source.time) || 0;
    const nextStart = finite(lines[index + 1]?.time) ? Number(lines[index + 1].time) : null;
    const end = finite(source.endTime) ? Number(source.endTime) : (nextStart ?? start + 3);
    return { ...source, time: start, endTime: end, nextLineTime: nextStart };
  }

  function lineWords(line) {
    if (Array.isArray(line.words) && line.words.length) {
      return line.words.map(word => ({
        text: String(word.text ?? ''),
        time: finite(word.time) ? Number(word.time) : line.time,
        endTime: finite(word.endTime) ? Number(word.endTime) : line.endTime
      })).filter(word => word.text);
    }
    const tokens = String(line.text || '').trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) return [];
    const duration = Math.max(0.2, Math.min(1.8, (line.endTime - line.time) * 0.72));
    const weights = tokens.map(token => Math.max(1, Array.from(token).length));
    const total = weights.reduce((sum, value) => sum + value, 0);
    let cursor = 0;
    return tokens.map((text, index) => {
      const start = line.time + duration * cursor / total;
      cursor += weights[index];
      return { text, time: start, endTime: line.time + duration * cursor / total };
    });
  }

  function drawBratEffect(ctx, w, h, style, lines, time) {
    if (!Array.isArray(lines) || !lines.length || !(w > 0) || !(h > 0)) return;

    const ink = style.bratTextColor || '#000000';
    const speed = Math.max(0.005, Number(style.bratCharSpeed) || 0.025);
    const pause = Math.max(0, Number(style.bratWordPause) || 0.1);
    const blur = Math.max(0, Number(style.bratEntryBlur) || 14);
    const stretch = Math.max(0.8, Number(style.bratVerticalStretch) || 1.15);
    const softness = Math.max(0, Number(style.bratSoftness) || 0);
    const align = style.bratAlignment || 'justify';
    const side = w * (Number(style.bratSideMargin) || 6) / 100;
    const top = h * 0.08;
    const bottom = h * 0.08;
    const usableWidth = Math.max(1, w - side * 2);
    const normalised = lines.map((_, index) => normaliseLine(lines, index)).filter(Boolean);
    const timed = normalised.map(line => ({
      line: { ...line, text: String(line.text || '').toLowerCase() },
      words: lineWords(line).map(word => ({ ...word, text: String(word.text || '').toLowerCase() }))
    }));
    let active = -1;
    for (let i = 0; i < timed.length; i++) {
      if (time >= timed[i].line.time) active = i;
      else break;
    }
    if (active < 0) return;

    // Brat-inspired fan lyric treatment: lowercase, plain condensed sans-serif,
    // consistent typography, natural word wrapping, and no per-line scaling.
    const fontFamily = '"Arial Narrow", "Liberation Sans Narrow", Arial, "Helvetica Neue", sans-serif';
    const visibleCount = 4;
    const first = Math.max(0, Math.min(active - 1, timed.length - visibleCount));
    const visible = timed.slice(first, first + visibleCount);
    if (!visible.length) return;

    const requestedSize = Number(style.fontSize) || 76;
    const ratio = w / h;
    const ratioScale = ratio > 1.5 ? 0.105 : ratio < 0.8 ? 0.072 : 0.09;
    const fontSize = Math.min(requestedSize, h * ratioScale);
    const gap = fontSize * 0.22;
    const lineHeight = fontSize * 1.42;
    const maxRows = Math.max(1, Math.floor((h * 0.84) / lineHeight));
    const rows = [];
    ctx.font = '400 ' + fontSize + 'px ' + fontFamily;

    // Wrap only at spaces. Every row shares the same font size and natural glyph proportions.
    visible.forEach((entry, entryIndex) => {
      const words = entry.words;
      if (!words.length) return;
      let rowWords = [];
      let rowWidth = 0;
      words.forEach(word => {
        const wordWidth = ctx.measureText(word.text).width;
        const nextWidth = rowWords.length ? rowWidth + gap + wordWidth : wordWidth;
        if (rowWords.length && nextWidth > usableWidth) {
          rows.push({ words: rowWords, width: rowWidth, entryIndex });
          rowWords = [word];
          rowWidth = wordWidth;
        } else {
          rowWords.push(word);
          rowWidth = nextWidth;
        }
      });
      if (rowWords.length) rows.push({ words: rowWords, width: rowWidth, entryIndex });
    });

    // Keep the active lyric visible when wrapping creates more rows than the frame can hold.
    const activeVisibleIndex = Math.max(0, active - first);
    const activeRow = Math.max(0, rows.findIndex(row => row.entryIndex === activeVisibleIndex));
    let rowStart = Math.max(0, activeRow - Math.floor(maxRows / 2));
    if (rowStart + maxRows > rows.length) rowStart = Math.max(0, rows.length - maxRows);
    const displayRows = rows.slice(rowStart, rowStart + maxRows);
    const firstBaseline = (h - displayRows.length * lineHeight) / 2 + lineHeight / 2;

    // Transparent overlay: preserve the user's video or visualiser behind the lyrics.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();
    ctx.fillStyle = ink;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.filter = 'none';
    ctx.globalAlpha = 1;

    displayRows.forEach((row, rowIndex) => {
      let x = Math.max(side, (w - row.width) / 2);
      const baseline = firstBaseline + rowIndex * lineHeight;
      row.words.forEach(word => {
        ctx.fillText(word.text, x, baseline);
        x += ctx.measureText(word.text).width + gap;
      });
    });
    ctx.restore();
  }

  window.kefeEffects = window.kefeEffects || {};
  window.kefeEffects.brat = drawBratEffect;
})();
