/* KEFE Visualiser — Shiny Text lyric effect.
   Bits-family "Shiny Text" animation, ported to canvas: solid lyric
   text with a diagonal light band that sweeps across it on a loop. */
(() => {
  'use strict';
  const u = window.kefeEffectUtils;
  window.kefeEffects = window.kefeEffects || {};

  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, Number(v) || 0));
  const smoother = (v) => { const t = clamp(v); return t * t * t * (t * (t * 6 - 15) + 10); };

  function wrap(ctx, text, maxWidth) {
    const words = String(text || '').trim().split(/\s+/).filter(Boolean);
    const rows = [];
    let row = '';
    for (const word of words) {
      const proposed = row ? `${row} ${word}` : word;
      if (row && ctx.measureText(proposed).width > maxWidth) { rows.push(row); row = word; }
      else row = proposed;
    }
    if (row) rows.push(row);
    return rows;
  }

  function fit(ctx, text, requested, maxWidth) {
    let size = Math.max(30, Math.min(150, Number(requested) || 78));
    while (size > 30) {
      u.setContractFont(ctx, 'shiny', size);
      const rows = wrap(ctx, text, maxWidth);
      if (rows.length <= 3) return { size, rows };
      size -= 2;
    }
    u.setContractFont(ctx, 'shiny', size);
    return { size, rows: wrap(ctx, text, maxWidth) };
  }

  let bufferCanvas = null, bufferCtx = null;
  function getBuffer(w, h) {
    if (!bufferCanvas) { bufferCanvas = document.createElement('canvas'); bufferCtx = bufferCanvas.getContext('2d'); }
    if (bufferCanvas.width !== w || bufferCanvas.height !== h) { bufferCanvas.width = w; bufferCanvas.height = h; }
    else bufferCtx.clearRect(0, 0, w, h);
    return bufferCtx;
  }

  window.kefeEffects.shiny = function(ctx, w, h, style, lines, time) {
    const active = u.activeLine(lines, time);
    if (!active) return;
    const text = String(active.line.text || '').trim();
    if (!text) return;

    const start = Number(active.line.time) || 0;
    const end = Math.max(start + 0.3, Number(active.line.endTime) || start + 3);
    const elapsed = time - start;
    const enter = smoother(clamp(elapsed / 0.32));
    const exit = clamp((end - time) / 0.22, 0, 1);
    const alpha = enter * exit;
    if (alpha <= 0) return;

    const bctx = getBuffer(w, h);
    bctx.textAlign = 'left';
    bctx.textBaseline = 'middle';

    const prepared = fit(bctx, text, style.fontSize, w * 0.8);
    const size = prepared.size;
    const rowHeight = size * (u.contract('shiny').lineHeight || 1.1);
    const totalHeight = prepared.rows.length * rowHeight;
    const top = h * 0.5 - totalHeight / 2 + rowHeight / 2;
    const rowWidths = prepared.rows.map(row => bctx.measureText(row).width);
    const blockWidth = Math.max(...rowWidths, 1);
    const left = w / 2 - blockWidth / 2;

    bctx.fillStyle = style.textColor || '#FFFFFF';
    u.setContractFont(bctx, 'shiny', size);
    prepared.rows.forEach((row, i) => bctx.fillText(row, left + (blockWidth - rowWidths[i]) / 2, top + i * rowHeight));

    // Sweep a bright diagonal band across the text on a loop, masked to
    // the glyphs already drawn (source-atop, scoped to this offscreen
    // buffer so it never bleeds into the background or other layers).
    const sweepPeriod = 2.1;
    const sweepPhase = ((elapsed % sweepPeriod) + sweepPeriod) % sweepPeriod / sweepPeriod;
    const bandWidth = blockWidth * 0.42;
    const bandX = left - bandWidth + sweepPhase * (blockWidth + bandWidth * 2);

    bctx.globalCompositeOperation = 'source-atop';
    const grad = bctx.createLinearGradient(bandX, top - totalHeight, bandX + bandWidth, top + totalHeight);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.9)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    bctx.fillStyle = grad;
    bctx.fillRect(left - bandWidth, top - totalHeight, blockWidth + bandWidth * 2, totalHeight * 2.2);
    bctx.globalCompositeOperation = 'source-over';

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(bufferCanvas, 0, 0);
    ctx.restore();
  };
})();
