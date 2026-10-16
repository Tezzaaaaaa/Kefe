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

    const fontFamily = '"Arial Narrow", "Liberation Sans Narrow", Arial, "Helvetica Neue", sans-serif';
    // Keep four consecutive lyric lines visible, with the active line near the visual centre.
    const visibleCount = 4;
    const first = Math.max(0, Math.min(active - 1, timed.length - visibleCount));
    const visible = timed.slice(first, first + visibleCount);
    if (!visible.length) return;
    const gapForSize = size => size * 0.22;
    const requestedSize = Number(style.fontSize) || 76;
    const baseSize = Math.min(requestedSize, h * (w / h > 1.5 ? 0.105 : w / h < 0.8 ? 0.072 : 0.09));
    const lineHeight = Math.min(h * 0.205, baseSize * 1.55);
    const blockHeight = lineHeight * visible.length;
    const firstBaseline = (h - blockHeight) / 2 + lineHeight / 2;

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

    visible.forEach((entry, row) => {
      const words = entry.words;
      if (!words.length) return;
      let fontSize = baseSize;
      ctx.font = '400 ' + fontSize + 'px ' + fontFamily;
      let gap = gapForSize(fontSize);
      let lineWidth = words.reduce((sum, word) => sum + ctx.measureText(word.text).width, 0) + gap * Math.max(0, words.length - 1);
      if (lineWidth > usableWidth) {
        fontSize *= usableWidth / lineWidth;
        ctx.font = '400 ' + fontSize + 'px ' + fontFamily;
        gap = gapForSize(fontSize);
        lineWidth = words.reduce((sum, word) => sum + ctx.measureText(word.text).width, 0) + gap * Math.max(0, words.length - 1);
      }
      let x = Math.max(side, (w - lineWidth) / 2);
      const baseline = firstBaseline + row * lineHeight;
      words.forEach(word => {
        ctx.fillText(word.text, x, baseline);
        x += ctx.measureText(word.text).width + gap;
      });
    });
    ctx.restore();
  }

  window.kefeEffects = window.kefeEffects || {};
  window.kefeEffects.brat = drawBratEffect;
})();
