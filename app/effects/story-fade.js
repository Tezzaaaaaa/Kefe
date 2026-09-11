/* KEFE — Fade Up lyric renderer. */
(() => {
  'use strict';
  const u = window.kefeEffectUtils;
  window.kefeEffects = window.kefeEffects || {};
  if (!u) return;

  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, Number(v) || 0));
  const smoother = v => { const t = clamp(v); return t * t * t * (t * (t * 6 - 15) + 10); };
  const font = (ctx, family, size) => { ctx.font = `700 ${Math.max(18, size)}px "${family || 'Open Sans'}", system-ui, sans-serif`; };

  function drawLine(ctx, w, h, style, text, time, start, end) {
    const family = style.kefeMotionFont || 'Open Sans';
    let size = Math.max(34, Math.min(150, Number(style.fontSize) || 78));
    font(ctx, family, size);
    while (size > 34 && ctx.measureText(text).width > w * .82) { size -= 1; font(ctx, family, size); }
    const duration = Math.max(.5, end - start);
    const p = clamp((time - start) / duration);
    const enter = smoother(p / Math.min(.30, Math.max(.18, duration * .16)));
    const hold = smoother((p - .10) / .42);
    const fadeOut = smoother((end - time) / Math.min(.36, Math.max(.20, duration * .14)));
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
    ctx.globalAlpha = enter * fadeOut;
    ctx.fillStyle = style.textColor || '#FFFFFF';
    ctx.shadowColor = style.accentColor || style.textColor || '#FFFFFF';
    ctx.shadowBlur = size * (.025 + .02 * hold);
    ctx.translate(w / 2, h * .50 + (1 - enter) * size * .16);
    ctx.scale(.94 + .06 * hold, .94 + .06 * hold);
    u.drawTrackedText(ctx, text, 0, 0, 0, 'fillText');
    ctx.restore();
  }

  window.kefeEffects.fadeup = function(ctx, w, h, style, lines, time) {
    const active = u.activeLine(lines, time);
    if (!active) return;
    const words = u.wordsFor(active.line, active.next);
    if (!words.length) return;
    const family = style.kefeMotionFont || 'Open Sans';
    let size = Math.max(34, Math.min(150, Number(style.fontSize) || 78));
    const maxWidth = w * .80; let rows = [];
    while (size > 34) {
      font(ctx, family, size); const gap = Math.max(12, size * .16); rows = []; let row = [], width = 0;
      for (const word of words) { const wordWidth = ctx.measureText(word.text).width; const proposed = row.length ? width + gap + wordWidth : wordWidth; if (row.length && proposed > maxWidth) { rows.push({ words: row, width }); row = []; width = 0; } row.push({ ...word, width: wordWidth }); width = row.length === 1 ? wordWidth : width + gap + wordWidth; }
      if (row.length) rows.push({ words: row, width }); if (rows.length <= 2) break; size -= 2;
    }
    const gap = Math.max(12, size * .16), rowHeight = size * 1.12, top = h * .50 - ((rows.length - 1) * rowHeight) / 2;
    ctx.save(); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none'; font(ctx, family, size);
    rows.forEach((row, rowIndex) => { let x = (w - row.width) / 2; const y = top + rowIndex * rowHeight; for (const word of row.words) { const p = clamp(u.wordProgress(word, time).raw); if (p <= 0) { x += word.width + gap; continue; } const enter = smoother(p / .28), settle = smoother((p - .18) / .42); ctx.save(); ctx.globalAlpha = enter; ctx.fillStyle = style.textColor || '#FFFFFF'; ctx.shadowColor = style.accentColor || style.textColor || '#FFFFFF'; ctx.shadowBlur = settle * size * .055; ctx.translate(x + word.width / 2, y + (1 - enter) * size * .28); ctx.scale(.965 + .035 * settle, .965 + .035 * settle); u.drawTrackedText(ctx, word.text, 0, 0, 0, 'fillText'); ctx.restore(); x += word.width + gap; } });
    ctx.restore();
  };

  window.kefeEffects.storyfade = function(ctx, w, h, style, lines, time) {
    const active = u.activeLine(lines, time);
    if (!active) return;
    const text = String(active.line?.text || '').trim();
    if (!text) return;
    const start = Number(active.line.time) || 0;
    const end = Math.max(start + .5, Number(active.line.endTime) || start + 3);
    drawLine(ctx, w, h, style, text, time, start, end);
  };
})();
