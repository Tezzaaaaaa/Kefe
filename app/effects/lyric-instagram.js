/* KEFE Visualiser — Instagram Lyrics sticker.
   Matches the actual Instagram music-sticker lyric look:
   - Left-aligned block, sits mid-frame, no bounding box
   - Heavy bold uppercase sans
   - Per-row font sizing: each row fills the same horizontal width
   - Word-by-word grey→white reveal at the timing, no pop, no scale
   - Block replaces on line-group change, doesn't scroll */
(() => {
  'use strict';
  const u = window.kefeEffectUtils;
  window.kefeEffects = window.kefeEffects || {};

  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, Number(v) || 0));

  function setFont(ctx, size, weight) {
    const family = '"Inter Tight", "Helvetica Neue", Arial, sans-serif';
    ctx.font = `${weight || 800} ${Math.max(16, size)}px ${family}`;
  }

  // Word-level timing. If words[] is present and matches token count, use it.
  // Otherwise split the line evenly.
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
    const end = Number.isFinite(Number(line.endTime))
      ? Number(line.endTime)
      : (Number.isFinite(Number(line.nextLineTime)) ? Number(line.nextLineTime) : start + 3);
    const span = Math.max(0.4, end - start);
    const per = span / tokens.length;
    return tokens.map((t, i) => ({
      text: t,
      start: start + i * per,
      end: start + (i + 1) * per
    }));
  }

  // Greedy wrap into up to N rows.
  function wrapWords(ctx, words, maxWidth, maxRows) {
    if (!words.length) return [[]];
    const spaceW = ctx.measureText(' ').width;
    const widths = words.map(w => ctx.measureText(w.text).width);

    let best = null;
    for (let rowCount = 1; rowCount <= Math.min(maxRows, words.length); rowCount++) {
      const rows = [];
      let cursor = 0;
      let widest = 0;
      let valid = true;

      for (let r = 0; r < rowCount; r++) {
        const remainingRows = rowCount - r;
        const remainingWords = words.length - cursor;
        const minTake = 1;
        const maxTake = remainingWords - (remainingRows - 1);
        if (maxTake < minTake) { valid = false; break; }

        let take = 0;
        let rowW = 0;
        while (take < maxTake) {
          const w = widths[cursor + take];
          const add = take === 0 ? w : spaceW + w;
          if (rowW + add > maxWidth && take >= minTake) break;
          rowW += add;
          take++;
        }
        if (take < minTake) { valid = false; break; }

        const rowWords = words.slice(cursor, cursor + take);
        rows.push(rowWords);
        if (rowW > widest) widest = rowW;
        cursor += take;
      }

      if (!valid || cursor !== words.length) continue;
      if (!best || widest < best.widest) best = { rows, widest };
    }

    return best ? best.rows : [words];
  }

  window.kefeEffects.instagram = function(ctx, w, h, style, lines, time) {
    if (!Array.isArray(lines) || !lines.length || !Number.isFinite(time)) return;
    const active = u.activeLine(lines, time);
    if (!active || !active.line) return;

    const line = active.line;
    const words = wordTimings(line);
    if (!words.length) return;

    const upperWords = words.map(w => ({ ...w, upper: w.text.toUpperCase() }));

    // Fixed left margin. Frame width minus margin on both sides is the
    // usable column. Instagram's column is roughly 76% of the frame.
    const marginLeft = w * 0.12;
    const marginRight = w * 0.12;
    const usableW = w - marginLeft - marginRight;

    const userMax = Number(style.instagramFontSize ?? style.fontSize);
    const sizeCap = (Number.isFinite(userMax) && userMax > 0 ? userMax : 96) * 1.4;
    const sizeFloor = 26;

    // Choose the font size for the whole line: the largest size at which
    // the line still wraps into at most 3 rows within the column.
    let lo = sizeFloor;
    let hi = sizeCap;
    let chosenRows = null;
    let chosenSize = sizeFloor;

    for (let iter = 0; iter < 12; iter++) {
      const mid = (lo + hi) / 2;
      setFont(ctx, mid, 800);
      const candidate = wrapWords(ctx, upperWords, usableW, 3);
      const spaceW = ctx.measureText(' ').width;
      const widest = candidate.reduce((max, row) => {
        let rowW = 0;
        for (let j = 0; j < row.length; j++) {
          rowW += ctx.measureText(row[j].upper).width;
          if (j < row.length - 1) rowW += spaceW;
        }
        return Math.max(max, rowW);
      }, 0);
      if (candidate.length <= 3 && widest <= usableW) {
        lo = mid;
        chosenRows = candidate;
        chosenSize = mid;
      } else {
        hi = mid;
      }
    }

    if (!chosenRows) {
      setFont(ctx, sizeFloor, 800);
      chosenRows = wrapWords(ctx, upperWords, usableW, 3);
      chosenSize = sizeFloor;
    }

    const fontSize = chosenSize;
    setFont(ctx, fontSize, 800);
    const lineHeight = fontSize * 1.14;
    const blockH = chosenRows.length * lineHeight;

    // Instagram places the block roughly at 45% of vertical height.
    const blockTop = h * 0.5 - blockH * 0.5;
    const baselineOffset = fontSize * 0.86;

    const whiteColour = style.instagramTextColor || style.textColor || '#FFFFFF';
    const greyColour = 'rgba(255,255,255,0.36)';

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(0,0,0,0.28)';
    ctx.shadowBlur = fontSize * 0.05;
    ctx.shadowOffsetY = 1;

    const spaceW = ctx.measureText(' ').width;

    // Compute row widths first so we can nudge-shorten them.
    const rowWidths = chosenRows.map(row => {
      let sum = 0;
      for (let j = 0; j < row.length; j++) {
        sum += ctx.measureText(row[j].upper).width;
        if (j < row.length - 1) sum += spaceW;
      }
      return sum;
    });

    for (let rowIdx = 0; rowIdx < chosenRows.length; rowIdx++) {
      const rowWords = chosenRows[rowIdx];
      const baseline = blockTop + rowIdx * lineHeight + baselineOffset;

      let x = marginLeft;
      for (let wi = 0; wi < rowWords.length; wi++) {
        const word = rowWords[wi];
        const wWidth = ctx.measureText(word.upper).width;

        // Grey → white based on whether the word has started being sung.
        // Instagram snaps to white at word start with a very short ramp.
        const sinceStart = time - word.start;
        let mix;
        if (sinceStart <= 0) mix = 0;
        else if (sinceStart >= 0.08) mix = 1;
        else mix = sinceStart / 0.08;

        ctx.globalAlpha = 1;
        ctx.fillStyle = mix >= 1 ? whiteColour : greyColour;
        if (mix > 0 && mix < 1) {
          // Blend the two opacities by drawing the white word over the grey one.
          ctx.fillStyle = greyColour;
          ctx.fillText(word.upper, x, baseline);
          ctx.save();
          ctx.globalAlpha = mix;
          ctx.fillStyle = whiteColour;
          ctx.fillText(word.upper, x, baseline);
          ctx.restore();
        } else {
          ctx.fillText(word.upper, x, baseline);
        }

        x += wWidth + spaceW;
      }
    }

    ctx.restore();
  };
})();
