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
    // Let the canvas height determine the type scale; width is handled per line below.
    // This keeps the lettering oversized in landscape, square, and portrait exports.
    const requestedSize = Number(style.fontSize) || 76;
    const fontSize = Math.max(requestedSize, h * (w / h > 1.5 ? 0.19 : w / h < 0.8 ? 0.145 : 0.22));
    const font = '400 ' + fontSize + 'px ' + fontFamily;
    const rowHeight = fontSize * 1.02;
    const maxRows = Math.max(1, Math.floor((h - top - bottom) / (rowHeight * stretch)));
    const visibleLines = timed.slice(Math.max(0, active - maxRows + 1), active + 1);

    // Intentionally do not paint a background: the Brat-style type sits over the user's existing video or visualiser.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();
    ctx.fillStyle = ink;
    ctx.font = font;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';

    visibleLines.forEach((entry, rowIndex) => {
      const rowTop = top + rowIndex * rowHeight * stretch;
      const words = entry.words;
      if (!words.length) return;
      const widths = words.map(word => ctx.measureText(word.text).width);
      const totalWidth = widths.reduce((sum, value) => sum + value, 0);
      let gap = fontSize * 0.14;
      if (align === 'justify' && words.length > 1) gap = Math.max(0, (usableWidth - totalWidth) / (words.length - 1));
      const lineWidth = totalWidth + gap * Math.max(0, words.length - 1);
      const lineScale = lineWidth > 0 ? usableWidth / lineWidth : 1;
      const baseline = rowTop + fontSize * 0.82;
      let lineOffset = 0;

      words.forEach((word, wi) => {
        const chars = Array.from(word.text);
        const wordStart = finite(word.time) ? word.time : entry.line.time;
        let charX = side + lineOffset * lineScale;
        for (let ci = 0; ci < chars.length; ci++) {
          const charTime = wordStart + ci * speed;
          if (time >= charTime) {
            const progress = clamp((time - charTime) / 0.42);
            const blurNow = blur * (1 - progress);
            const alpha = clamp((time - charTime) / 0.055);
            ctx.save();
            ctx.globalAlpha = alpha;
            const totalBlur = blurNow + softness;
            ctx.filter = totalBlur > 0.05 ? 'blur(' + totalBlur + 'px)' : 'none';
            // Scale both glyphs and their positions so each lyric line fills the canvas width.
            ctx.translate(charX, baseline);
            ctx.scale((0.88 + 0.12 * progress) * lineScale, stretch);
            ctx.fillText(chars[ci], 0, 0);
            ctx.restore();
          }
          charX += ctx.measureText(chars[ci]).width * lineScale;
        }
        lineOffset += widths[wi] + gap;
      });
    });
    ctx.restore();
  }

  window.kefeEffects = window.kefeEffects || {};
  window.kefeEffects.brat = drawBratEffect;
})();
