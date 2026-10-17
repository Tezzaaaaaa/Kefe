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

    const background = '#8ACE00';
    const ink = '#FFFFFF';
    const speed = Math.max(0.005, Number(style.bratCharSpeed) || 0.025);
    const blur = Math.max(0, Number(style.bratEntryBlur) || 1.1);
    const side = w * 0.065;
    const usableWidth = Math.max(1, w - side * 2);
    const normalised = lines.map((_, index) => normaliseLine(lines, index)).filter(Boolean);
    let active = -1;
    for (let i = 0; i < normalised.length; i++) {
      if (time >= normalised[i].time) active = i;
      else break;
    }

    // The Brat cover's visual language: one flat acid-green field, lowercase
    // Arial-style condensed lettering, slightly stretched and intentionally soft.
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.filter = 'none';
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, w, h);

    if (active < 0) {
      ctx.restore();
      return;
    }

    const line = normalised[active];
    const lyric = String(line.text || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (!lyric) {
      ctx.restore();
      return;
    }

    const family = '"Arial Narrow", "Liberation Sans Narrow", Arial, "Helvetica Neue", sans-serif';
    const ratio = w / h;
    const baseSize = Math.min(h * (ratio > 1.45 ? 0.17 : ratio < 0.8 ? 0.105 : 0.145), w * 0.15);
    const fontSize = Math.max(20, baseSize);
    const lineHeight = fontSize * 1.12;
    const maxRows = Math.max(1, Math.min(7, Math.floor(h * 0.78 / lineHeight)));
    let shownChars = Math.floor(Math.max(0, time - line.time) / speed);
    const visibleText = lyric.slice(0, Math.min(lyric.length, shownChars));
    const words = visibleText.split(/\s+/).filter(Boolean);
    if (!words.length) {
      ctx.restore();
      return;
    }

    ctx.font = '400 ' + fontSize + 'px ' + family;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const rows = [];
    let row = [];
    let rowWidth = 0;
    const space = ctx.measureText(' ').width;
    words.forEach(word => {
      const wordWidth = ctx.measureText(word).width;
      const nextWidth = row.length ? rowWidth + space + wordWidth : wordWidth;
      if (row.length && nextWidth > usableWidth) {
        rows.push({ words: row, width: rowWidth });
        row = [word];
        rowWidth = wordWidth;
      } else {
        row.push(word);
        rowWidth = nextWidth;
      }
    });
    if (row.length) rows.push({ words: row, width: rowWidth });
    const displayRows = rows.slice(-maxRows);
    const blockHeight = displayRows.length * lineHeight;
    // Slightly imperfect placement and stretched word spacing echo the source cover,
    // while fitting actual lyric phrases instead of forcing them into a square title.
    const firstY = h * 0.5 - blockHeight * 0.5 + lineHeight * 0.5;
    displayRows.forEach((item, rowIndex) => {
      const isLast = rowIndex === displayRows.length - 1;
      const totalWordsWidth = item.words.reduce((sum, word) => sum + ctx.measureText(word).width, 0);
      const gap = !isLast && item.words.length > 1
        ? Math.max(space, (usableWidth - totalWordsWidth) / (item.words.length - 1))
        : space;
      let x = side + (rowIndex % 2 ? w * 0.006 : 0);
      const y = firstY + rowIndex * lineHeight;
      item.words.forEach(word => {
        // Low-resolution softness is subtle and applied only to the white type.
        ctx.save();
        ctx.filter = blur > 0 ? 'blur(' + Math.min(2.5, blur * (w / 1000)) + 'px)' : 'none';
        ctx.fillStyle = ink;
        ctx.fillText(word, x, y);
        ctx.restore();
        x += ctx.measureText(word).width + gap;
      });
    });
    ctx.restore();
  }
  window.kefeEffects = window.kefeEffects || {};
  window.kefeEffects.brat = drawBratEffect;
})();
