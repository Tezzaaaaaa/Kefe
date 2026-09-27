/* KEFE Visualiser — Instagram Reels lyric takeover.
   - Full-frame, centered, bold uppercase type
   - Active line fills the width; wraps into up to 3 balanced rows
   - Karaoke-lit: past words solid, active word scaled + accent, upcoming words muted
   - No bounding box, no left-aligned column, no sticker
   Supports line-level and word-level LRC timing. */
(() => {
  'use strict';
  const u = window.kefeEffectUtils;
  window.kefeEffects = window.kefeEffects || {};

  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, Number(v) || 0));
  const smoother = v => { const t = clamp(v); return t * t * t * (t * (t * 6 - 15) + 10); };

  function setFont(ctx, size, weight) {
    const family = '"Inter Tight", "Helvetica Neue", "Arial Narrow", Impact, sans-serif';
    ctx.font = `${weight || 900} ${Math.max(18, size)}px ${family}`;
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
      if (!best || widest < best.widest) {
        best = { rows, widest };
      }
    }

    return best ? best.rows : [words];
  }

  function hexToRgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '#FFFFFF');
    if (!m) return [255, 255, 255];
    return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
  }
  function blendHex(a, b, t) {
    const ra = hexToRgb(a), rb = hexToRgb(b);
    const r = Math.round(ra[0] + (rb[0] - ra[0]) * t);
    const g = Math.round(ra[1] + (rb[1] - ra[1]) * t);
    const bl = Math.round(ra[2] + (rb[2] - ra[2]) * t);
    return `rgb(${r},${g},${bl})`;
  }

  window.kefeEffects.instagram = function(ctx, w, h, style, lines, time) {
    if (!Array.isArray(lines) || !lines.length || !Number.isFinite(time)) return;
    const active = u.activeLine(lines, time);
    if (!active || !active.line) return;

    const line = active.line;
    const words = wordTimings(line);
    if (!words.length) return;

    const upperWords = words.map(w => ({ ...w, upper: w.text.toUpperCase() }));

    const margin = w * 0.06;
    const usableW = w - margin * 2;
    const userMax = Number(style.instagramFontSize ?? style.fontSize);
    const sizeCap = (Number.isFinite(userMax) && userMax > 0 ? userMax : 96) * 2.2;

    let lo = 28;
    let hi = sizeCap;
    let rows = [];
    for (let i = 0; i < 10; i++) {
      const mid = (lo + hi) / 2;
      setFont(ctx, mid, 900);
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
      if (widest <= usableW && candidate.length <= 3) { lo = mid; rows = candidate; }
      else hi = mid;
    }
    const fontSize = lo;

    setFont(ctx, fontSize, 900);
    const lineHeight = fontSize * 1.12;
    const blockH = rows.length * lineHeight;
    const blockTop = h * 0.5 - blockH * 0.5;
    const baselineOffset = fontSize * 0.86;

    const primary = style.instagramTextColor || style.textColor || '#FFFFFF';
    const accent = style.accentColor || '#FFFFFF';
    const upcoming = 0.22;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = fontSize * 0.09;
    ctx.shadowOffsetY = Math.max(2, fontSize * 0.012);

    const spaceW = ctx.measureText(' ').width;

    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      const rowWords = rows[rowIdx];
      const rowBaseline = blockTop + rowIdx * lineHeight + baselineOffset;

      const widths = rowWords.map(w => ctx.measureText(w.upper).width);
      let rowW = 0;
      for (let j = 0; j < widths.length; j++) {
        rowW += widths[j];
        if (j < widths.length - 1) rowW += spaceW;
      }

      let x = w * 0.5 - rowW * 0.5;

      for (let wi = 0; wi < rowWords.length; wi++) {
        const word = rowWords[wi];
        const wWidth = widths[wi];

        const sinceStart = time - word.start;
        const untilEnd = word.end - time;

        let alpha;
        let colour;
        let scale = 1;

        if (sinceStart <= 0) {
          alpha = upcoming;
          colour = primary;
        } else if (sinceStart < 0.14) {
          const t = smoother(sinceStart / 0.14);
          alpha = upcoming + (1 - upcoming) * t;
          colour = accent;
          scale = 1 + 0.12 * (1 - t) * Math.sin(t * Math.PI);
        } else if (untilEnd > 0) {
          alpha = 1;
          colour = accent;
        } else {
          const sincePast = -untilEnd;
          const t = smoother(clamp(sincePast / 0.18));
          alpha = 1;
          colour = t >= 1 ? primary : blendHex(accent, primary, t);
        }

        const cx = x + wWidth * 0.5;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = colour;
        ctx.translate(cx, rowBaseline);
        ctx.scale(scale, scale);
        ctx.fillText(word.upper, -wWidth * 0.5, 0);
        ctx.restore();

        x += wWidth + spaceW;
      }
    }

    ctx.restore();
  };
})();
