/* KEFE Visualiser — Eternal Sunshine handwritten ink effect */
(() => {
  'use strict';
  const u = window.kefeEffectUtils;
  window.kefeEffects = window.kefeEffects || {};

  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, Number(v) || 0));
  const smooth = v => { const t = clamp(v); return t * t * (3 - 2 * t); };

  function trackedWidth(ctx, text, tracking) {
    const chars = Array.from(String(text));
    if (!chars.length) return 0;
    return chars.reduce((sum, char) => sum + ctx.measureText(char).width, 0) + Math.max(0, chars.length - 1) * tracking;
  }

  function fit(ctx, text, requested, tracking, maxWidth) {
    let size = Math.max(34, Math.min(150, Number(requested) || 76));
    while (size > 34) {
      u.setContractFont(ctx, 'eternal', size);
      if (trackedWidth(ctx, text, tracking * size) <= maxWidth) break;
      size -= 2;
    }
    u.setContractFont(ctx, 'eternal', size);
    return { size, width: trackedWidth(ctx, text, tracking * size) };
  }

  function wordAlpha(word, time) {
    const p = u.wordProgress(word, time).raw;
    // A soft word-level envelope replaces the old per-letter positional motion.
    // Letters now stay locked to the same baseline and simply resolve into the ink.
    return smooth(p / 0.34);
  }

  window.kefeEffects.eternal = function(ctx, w, h, style, lines, time) {
    const active = u.activeLine(lines, time);
    if (!active) return;
    const text = String(active.line.text || '').trim();
    if (!text) return;

    const contract = u.contract('eternal');
    const tracking = Number(contract.tracking) || 0;
    const prepared = fit(ctx, text, style.fontSize, tracking, w * 0.78);
    const size = prepared.size;
    const colour = style.eternalInkColor || style.textColor || '#FFFFFF';
    const start = Number(active.line.time) || 0;
    const end = Math.max(start + 0.20, Number(active.line.endTime) || start + 3);
    const duration = end - start;
    const words = u.wordsFor(active.line, active.next);

    // The whole phrase settles into position as one object. This keeps the
    // organic handwritten character while eliminating the distracting letter-by-letter jumping.
    const enter = smooth((time - start) / Math.min(0.48, Math.max(0.28, duration * 0.16)));
    const exit = 1 - smooth((time - (end - Math.min(0.38, Math.max(0.24, duration * 0.12)))) / Math.min(0.38, Math.max(0.24, duration * 0.12)));
    const opacity = clamp(enter * exit);
    const y = h * 0.58 + (1 - enter) * size * 0.055;
    const trackingPx = tracking * size;

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = colour;
    ctx.globalAlpha = opacity;
    u.setContractFont(ctx, 'eternal', size);

    const chars = Array.from(text);
    const charWidths = chars.map(char => ctx.measureText(char).width);
    const totalWidth = charWidths.reduce((sum, value) => sum + value, 0) + trackingPx * Math.max(0, chars.length - 1);
    let x = (w - totalWidth) / 2;
    let charCursor = 0;

    // Keep the handwritten phrase continuous. Word timestamps control the ink
    // strength, but individual letters never translate or scale independently.
    let wordIndex = 0;
    let word = words[wordIndex] || null;
    let wordCharsRemaining = word ? Array.from(word.text).length : chars.length;
    let wordCharSeen = 0;

    for (const char of chars) {
      if (char === ' ') {
        ctx.globalAlpha = opacity * 0.72;
        ctx.fillText(char, x, y);
        x += ctx.measureText(char).width + trackingPx;
        charCursor += 1;
        continue;
      }

      while (word && wordCharSeen >= wordCharsRemaining) {
        wordIndex += 1;
        word = words[wordIndex] || null;
        wordCharsRemaining = word ? Array.from(word.text).length : chars.length;
        wordCharSeen = 0;
      }

      const alpha = word ? wordAlpha(word, time) : enter;
      // A tiny overlap between adjacent character envelopes keeps the word
      // from appearing as a sequence of discrete pops.
      ctx.globalAlpha = opacity * (0.10 + 0.90 * smooth(alpha * 1.08));
      ctx.fillText(char, x, y);
      x += charWidths[charCursor] + trackingPx;
      charCursor += 1;
      wordCharSeen += 1;
    }

    // A restrained handwritten bloom gives the line a continuous ink presence
    // without reintroducing the old jumpy per-letter glow.
    if (opacity > 0.01) {
      ctx.globalAlpha = opacity * 0.10;
      ctx.shadowColor = colour;
      ctx.shadowBlur = size * 0.055;
      u.drawTrackedText(ctx, text, w / 2, y, trackingPx, 'fillText');
    }

    ctx.restore();
  };
})();
