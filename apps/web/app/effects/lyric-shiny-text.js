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

  /* The shine band travels WITH the vocal: per row, its head sits at the sung position (sum of char widths x char progress), so the
     light moves across the words exactly as they are sung. Unsung text rests dim and brightens as it is reached. */
  function drawShiny(ctx, w, h, style, line, next, time, phase) {
    const text = String(line.text || '').trim().replace(/\s+/g, ' ');
    if (!text) return;
    const alpha = clamp(phase.alpha);
    if (alpha <= 0.002) return;

    const bctx = getBuffer(w, h);
    bctx.textAlign = 'left';
    bctx.textBaseline = 'middle';

    const setF = u.contractFontSetter('shiny');
    const lh = u.contract('shiny').lineHeight || 1.1;
    const lay = u.layoutText(bctx, text, { setFont: setF, size: Math.min(150, Number(style.fontSize) || 78), minSize: 18, maxWidth: w * 0.84, maxHeight: h * 0.8, lineHeight: lh, maxLines: 6 });
    const size = lay.size;
    const rows = lay.lines;
    const rowHeight = size * lh;
    const totalHeight = rows.length * rowHeight;
    const top = h * 0.5 - totalHeight / 2 + rowHeight / 2 - phase.leave * size * 0.10;
    const rowWidths = rows.map(row => bctx.measureText(row).width);
    const blockWidth = Math.max(...rowWidths, 1);
    const left = w / 2 - blockWidth / 2;
    const map = u.charMap(rows, u.wordsFor(line, next));
    const DIM = 0.5;

    setF(bctx, size);
    const heads = [];
    rows.forEach((row, i) => {
      const chars = Array.from(row), cells = map[i] || [];
      const x0 = left + (blockWidth - rowWidths[i]) / 2, y = top + i * rowHeight;
      let x = x0, acc = 0, lastP = 0;
      chars.forEach((ch, k) => {
        const cw = bctx.measureText(ch).width, cell = cells[k];
        const p = cell && !cell.space ? u.charProgress(cell.word, cell.j, cell.n, time, 0.9, 0.3) : lastP;
        lastP = p;
        acc += cw * p;
        bctx.globalAlpha = DIM + (1 - DIM) * p;
        bctx.fillStyle = style.textColor || '#FFFFFF';
        bctx.fillText(ch, x, y);
        x += cw;
      });
      bctx.globalAlpha = 1;
      heads.push({ x: x0 + acc, frac: acc / Math.max(1, rowWidths[i]), y, x0 });
    });

    // Diagonal shine band at each row's sung head, masked to the glyphs (source-atop inside the offscreen buffer only).
    bctx.globalCompositeOperation = 'source-atop';
    const bandWidth = Math.max(size * 1.6, blockWidth * 0.18);
    heads.forEach(hd => {
      const intensity = u.smoother(hd.frac / 0.06) * u.smoother((1 - hd.frac) / 0.10);
      if (intensity <= 0.01) return;
      const grad = bctx.createLinearGradient(hd.x - bandWidth * 0.5, hd.y - rowHeight, hd.x + bandWidth * 0.5, hd.y + rowHeight);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.5, 'rgba(255,255,255,' + (0.95 * intensity).toFixed(3) + ')');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      bctx.fillStyle = grad;
      bctx.fillRect(hd.x - bandWidth, hd.y - rowHeight * 0.75, bandWidth * 2, rowHeight * 1.5);
    });
    bctx.globalCompositeOperation = 'source-over';

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(bufferCanvas, 0, 0);
    ctx.restore();
  }

  window.kefeEffects.shiny = function(ctx, w, h, style, lines, time) {
    const stack = u.lineStack(lines, time, 0.22, 0.20);
    for (const it of stack) drawShiny(ctx, w, h, style, it.line, it.next, time, it);
  };
})();
