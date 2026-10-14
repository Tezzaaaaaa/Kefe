/* KEFE Visualiser — Instagram Lyrics (stacked).
   The Instagram music-sticker "stack" look:
   - Heavy uppercase sans, left aligned, sitting mid-frame with no box
   - Lyric lines STACK: each new line is added under the previous ones and they stay on screen
   - Every lyric line is sized so it fills the same column width (short lines come out huge,
     long lines smaller), giving the justified poster-stack silhouette
   - Words go grey -> white as they are sung; sung lines stay white, upcoming words stay grey
   - When the stack is full (or after a long instrumental gap) the page clears and a fresh stack starts */
(() => {
  'use strict';
  const u = window.kefeEffectUtils;
  window.kefeEffects = window.kefeEffects || {};

  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, Number.isFinite(Number(v)) ? Number(v) : a));
  const smooth = v => { const t = clamp(v); return t * t * (3 - 2 * t); };
  const FAMILY = '"Inter Tight", "Helvetica Neue", Arial, sans-serif';
  const MAX_LINES = 4;           // lyric lines per stack
  const GAP_NEW_PAGE = 3.5;      // seconds of silence that clear the stack
  const BASE = 100;              // measurement size; widths scale linearly with font size

  function setFont(ctx, size) { ctx.font = `800 ${Math.max(8, size)}px ${FAMILY}`; }

  function wordTimings(line, next) {
    const text = String(line.text || '').trim();
    const tokens = text.split(/\s+/).filter(Boolean);
    if (!tokens.length) return [];
    let ws = u.wordsFor(line, next);
    if (ws.length !== tokens.length) {
      const model = window.kefeLyricModel, start = Number(line.time) || 0, end = Number(line.endTime) || start + 3;
      ws = model ? model.estimateWords(text, start, end, true) : tokens.map((t, i) => ({ time: start + i * (end - start) / tokens.length, endTime: start + (i + 1) * (end - start) / tokens.length }));
    }
    return tokens.map((t, i) => ({ upper: t.toUpperCase(), start: Number(ws[i].time), end: Number(ws[i].endTime) }));
  }

  /* Split words into `n` rows with the widest row as narrow as possible (balanced greedy by width). */
  function balance(widths, space, n) {
    const total = widths.reduce((a, b) => a + b, 0) + space * (widths.length - 1);
    const target = total / n;
    const rows = [];
    let cur = [], curW = 0;
    widths.forEach((wd, i) => {
      const add = cur.length ? space + wd : wd;
      const remainingWords = widths.length - i, remainingRows = n - rows.length;
      if (cur.length && curW + add > target * 1.08 && rows.length < n - 1 && remainingWords >= remainingRows - 0) {
        rows.push(cur); cur = []; curW = 0;
      }
      cur.push(i); curW += cur.length > 1 ? space + wd : wd;
    });
    if (cur.length) rows.push(cur);
    return rows;
  }

  /* Lay out one lyric line: its own font size so the widest row fills the column. */
  function layoutLine(ctx, line, next, colW, minSize, maxSize) {
    const words = wordTimings(line, next);
    if (!words.length) return null;
    setFont(ctx, BASE);
    const space = ctx.measureText(' ').width;
    const widths = words.map(wd => ctx.measureText(wd.upper).width);
    let best = null;
    for (let n = 1; n <= Math.min(3, words.length); n++) {
      const idx = balance(widths, space, n);
      const widest = Math.max(...idx.map(r => r.reduce((a, i, k) => a + widths[i] + (k ? space : 0), 0)));
      const size = clamp(BASE * colW / widest, 1, maxSize);
      best = { idx, size, widest };
      if (size >= minSize) break;          // fewest rows that still reads big enough
    }
    const size = Math.max(Math.min(best.size, maxSize), 8);
    return {
      words, size, widths: widths.map(wd => wd * size / BASE), space: space * size / BASE,
      rows: best.idx, rowH: size * 1.04, h: best.idx.length * size * 1.04,
      start: Number(line.time) || 0,
      vocalEnd: words[words.length - 1].end
    };
  }

  const pageCache = new WeakMap();
  function buildPages(ctx, lines, w, h, style) {
    const first = Number(lines[0]?.time), last = Number(lines[lines.length - 1]?.time);
    const userMax = Number(style.instagramFontSize ?? style.fontSize);
    const key = [lines.length, first, last, w, h, userMax].join('|');
    const hit = pageCache.get(lines);
    if (hit && hit.key === key) return hit.pages;

    const marginLeft = w * 0.11, colW = w * 0.78;
    const minSize = Math.max(18, Math.min(w, h) * 0.07);
    const maxSize = Math.min(Number.isFinite(userMax) && userMax > 0 ? userMax * 2.2 : Infinity, h * 0.2);
    const maxH = h * 0.74;

    const pages = [];
    let page = null;
    for (let i = 0; i < lines.length; i++) {
      const lay = layoutLine(ctx, lines[i], lines[i + 1], colW, minSize, maxSize);
      if (!lay) continue;
      lay.index = i;
      const prev = page && page.items[page.items.length - 1];
      const gap = prev ? lay.start - prev.vocalEnd : 0;
      if (!page || page.items.length >= MAX_LINES || page.h + lay.h * 1.0 > maxH || gap > GAP_NEW_PAGE) {
        page = { items: [], h: 0, marginLeft };
        pages.push(page);
      }
      lay.y = page.h; page.h += lay.h + lay.size * 0.06;
      page.items.push(lay);
    }
    pages.forEach((pg, k) => {
      const lastItem = pg.items[pg.items.length - 1];
      const nextPage = pages[k + 1];
      pg.first = pg.items[0].start;
      pg.outEnd = nextPage ? Math.min(nextPage.items[0].start - 0.15, lastItem.vocalEnd + 1.6) : lastItem.vocalEnd + 1.6;
      pg.outEnd = Math.max(pg.outEnd, lastItem.start + 0.5);
      pg.outStart = pg.outEnd - 0.25;
      pg.top = h * 0.5 - pg.h / 2;
    });
    pageCache.set(lines, { key, pages });
    return pages;
  }

  function drawItem(ctx, it, page, time, alpha, white) {
    const appear = smooth((time - (it.start - (it === page.items[0] ? 0.16 : 0.24))) / 0.24);
    const a = alpha * appear;
    if (a <= 0.003) return;
    const slide = (1 - appear) * it.size * 0.22;
    setFont(ctx, it.size);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.shadowColor = 'rgba(0,0,0,0.28)';
    ctx.shadowBlur = it.size * 0.05;
    ctx.shadowOffsetY = 1;
    it.rows.forEach((row, ri) => {
      const baseline = page.top + it.y + ri * it.rowH + it.size * 0.84 + slide;
      let x = page.marginLeft;
      row.forEach((wi) => {
        const wd = it.words[wi];
        const mix = smooth((time - (wd.start - 0.03)) / 0.12);
        ctx.globalAlpha = a;
        ctx.fillStyle = 'rgba(255,255,255,0.36)';
        ctx.fillText(wd.upper, x, baseline);
        if (mix > 0) {
          ctx.globalAlpha = a * mix;
          ctx.fillStyle = white;
          ctx.fillText(wd.upper, x, baseline);
        }
        x += it.widths[wi] + it.space;
      });
    });
  }

  window.kefeEffects.instagram = function (ctx, w, h, style, lines, time) {
    if (!Array.isArray(lines) || !lines.length || !Number.isFinite(time)) return;
    const pages = buildPages(ctx, lines, w, h, style);
    const white = style.instagramTextColor || style.textColor || '#FFFFFF';
    ctx.save();
    for (const pg of pages) {
      if (time < pg.first - 0.5 || time > pg.outEnd) continue;
      const alpha = 1 - smooth((time - pg.outStart) / 0.25);
      if (alpha <= 0.003) continue;
      for (const it of pg.items) drawItem(ctx, it, pg, time, alpha, white);
    }
    ctx.restore();
  };
})();
