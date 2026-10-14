/* KEFE Visualiser — Typewriter lyric effect.
   Mechanical typing: key-press jitter, cursor, carriage return. */
(() => {
  'use strict';
  const u = window.kefeEffectUtils;
  window.kefeEffects = window.kefeEffects || {};

  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, Number(v) || 0));
  const smooth = v => { const t = clamp(v); return t * t * (3 - 2 * t); };

  function trackedWidth(ctx, text, tracking) {
    const chars = Array.from(String(text));
    if (!chars.length) return 0;
    return chars.reduce((sum, c) => sum + ctx.measureText(c).width, 0)
      + Math.max(0, chars.length - 1) * tracking;
  }

  function wrap(ctx, text, tracking, maxWidth) {
    const words = String(text || '').trim().split(/\s+/).filter(Boolean);
    const rows = [];
    let row = '';
    let width = 0;
    const space = trackedWidth(ctx, ' ', tracking);
    for (const word of words) {
      const ww = trackedWidth(ctx, word, tracking);
      const proposed = row ? width + space + ww : ww;
      if (row && proposed > maxWidth) {
        rows.push({ text: row, width });
        row = word;
        width = ww;
      } else {
        row = row ? row + ' ' + word : word;
        width = proposed;
      }
    }
    if (row) rows.push({ text: row, width });
    return rows;
  }

  function fit(ctx, text, requested, tracking, maxWidth) {
    let size = Math.max(32, Math.min(140, Number(requested) || 76));
    while (size > 32) {
      u.setContractFont(ctx, 'typewriter', size);
      const rows = wrap(ctx, text, tracking * size, maxWidth);
      if (rows.length <= 3) return { size, rows };
      size -= 2;
    }
    u.setContractFont(ctx, 'typewriter', size);
    return { size, rows: wrap(ctx, text, tracking * size, maxWidth) };
  }

  /* Per-character key-press times for the wrapped rows. Characters of a word are typed across the first ~82% of that word's
     sung duration (first key exactly on word.time), spaces are struck as the next word begins. Falls back to a linear spread
     over the vocal span when a very long word had to be broken across rows. */
  function charTimes(rowTexts, tokens, words, text) {
    const out = [];
    let ti = 0, ok = words.length === tokens.length;
    for (let r = 0; r < rowTexts.length && ok; r++) {
      const parts = rowTexts[r].split(' ');
      for (let k = 0; k < parts.length; k++) {
        if (parts[k] !== tokens[ti]) { ok = false; break; }
        const wd = words[ti], chars = Array.from(parts[k]), dur = Math.max(0.06, wd.endTime - wd.time);
        for (let j = 0; j < chars.length; j++) out.push(wd.time + dur * 0.82 * (j / chars.length));
        ti++;
        if (k < parts.length - 1) out.push(words[ti] ? words[ti].time : wd.endTime);
      }
    }
    if (ok) return out;
    const total = rowTexts.reduce((n, r) => n + Array.from(r).length, 0);
    const t0 = words.length ? words[0].time : 0, t1 = words.length ? words[words.length - 1].endTime : t0 + 2;
    const lin = [];
    for (let i = 0; i < total; i++) lin.push(t0 + (t1 - t0) * 0.9 * (i / Math.max(1, total)));
    return lin;
  }

  function drawLine(ctx, w, h, style, line, next, time, phase) {
    const text = String(line.text || '').trim().replace(/\s+/g, ' ');
    if (!text) return;
    const contract = u.contract('typewriter');
    const tracking = Number(contract.tracking) || 0;
    const setF = u.contractFontSetter('typewriter');
    const lay = u.layoutText(ctx, text, { setFont: setF, size: Math.min(140, Number(style.fontSize) || 76), minSize: 18, maxWidth: w * 0.84, maxHeight: h * 0.78, tracking, lineHeight: 1.18, maxLines: 6 });
    const size = lay.size;
    const rows = lay.lines.map(t => ({ text: t, width: trackedWidth(ctx, t, tracking * size) }));
    const trackingPx = tracking * size;
    const rowHeight = size * 1.18;
    const totalH = rows.length * rowHeight;
    const topY = h * 0.50 - totalH / 2 + rowHeight / 2;
    const start = Number(line.time) || 0;
    const end = Math.max(start + 0.30, Number(line.endTime) || start + 3);

    const words = u.wordsFor(line, next);
    const times = charTimes(lay.lines, text.split(' '), words, text);
    // revealCount = number of characters whose key has been struck by `time`; lastType = time of the most recent strike
    let revealCount = 0, lastType = start;
    for (let i = 0; i < times.length; i++) { if (time >= times[i]) { revealCount = i + 1; lastType = times[i]; } else break; }
    const sinceType = Math.max(0, time - lastType);
    const keyJitter = 1.6 * (1 - clamp(sinceType / 0.09));
    const typing = phase.role === 'cur' && revealCount < times.length;

    const colour = style.textColor || '#FFFFFF';
    ctx.save();
    ctx.globalAlpha = clamp(phase.alpha);
    ctx.translate(0, -phase.leave * size * 0.12);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = colour;
    setF(ctx, size);

    let remaining = revealCount;
    let cursorPos = null;
    const baseAlpha = ctx.globalAlpha;

    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      const row = rows[rowIdx];
      const rowChars = Array.from(row.text);
      const shownCount = Math.max(0, Math.min(rowChars.length, remaining));
      const shown = rowChars.slice(0, shownCount).join('');
      const x = (w - row.width) / 2;
      const y = topY + rowIdx * rowHeight;

      // The whole row's eventual text at very low opacity — the ghost impression of the paper waiting for the carriage.
      ctx.globalAlpha = baseAlpha * 0.10;
      u.drawTrackedText(ctx, row.text, x, y, trackingPx, 'fillText');

      // Typed characters, fully opaque.
      ctx.globalAlpha = baseAlpha;
      const shownWidth = trackedWidth(ctx, shown, trackingPx);
      if (shown) u.drawTrackedText(ctx, shown, x, y, trackingPx, 'fillText');

      // Key-press nudge on the character just typed (decays over 90ms from the real strike time).
      if (typing && shown.length > 0 && remaining > 0 && remaining <= rowChars.length && keyJitter > 0.01) {
        const lastChar = shown[shown.length - 1];
        const lastCharWidth = ctx.measureText(lastChar).width;
        ctx.save();
        ctx.globalAlpha = baseAlpha * 0.9;
        ctx.translate(0, -keyJitter);
        u.drawTrackedText(ctx, lastChar, x + shownWidth - lastCharWidth - trackingPx, y, trackingPx, 'fillText');
        ctx.restore();
      }

      // Cursor sits on the typing head: solid while keys are landing, blinking when the singer pauses.
      if (typing && shownCount < rowChars.length && remaining > 0) {
        const blink = sinceType < 0.3 ? 1 : (((sinceType - 0.3) % 0.72) < 0.5 ? 1 : 0.2);
        cursorPos = { x: x + shownWidth + size * 0.02, y, blink };
      }
      // Cursor waiting at the start of the very first row before the first key
      if (typing && revealCount === 0 && rowIdx === 0) cursorPos = { x: x + size * 0.02, y, blink: ((time - start) % 0.72) < 0.5 ? 1 : 0.2 };

      remaining = Math.max(0, remaining - rowChars.length);
    }

    if (cursorPos) {
      ctx.save();
      ctx.globalAlpha = baseAlpha * cursorPos.blink;
      ctx.fillStyle = colour;
      ctx.fillRect(cursorPos.x, cursorPos.y - size * 0.44, Math.max(2, size * 0.018), size * 0.88);
      ctx.restore();
    }
    ctx.restore();
  }

  window.kefeEffects.typewriter = function(ctx, w, h, style, lines, time) {
    const stack = u.lineStack(lines, time, 0.12, 0.14);
    for (const it of stack) drawLine(ctx, w, h, style, it.line, it.next, time, it);
  };
})();
