/* KEFE — Scroll Lines lyric effect.
 * Editorial multi-line motion inspired by Motion's Scroll Text Lines pattern:
 * several lyric lines travel horizontally at different rates while the active
 * lyric stays visually dominant. No external animation dependency is needed.
 */
(() => {
  'use strict';
  const u = window.kefeEffectUtils;
  window.kefeEffects = window.kefeEffects || {};

  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, Number(v) || 0));
  const smoother = v => {
    const t = clamp(v);
    return t * t * t * (t * (t * 6 - 15) + 10);
  };

  const FONT_KEY = 'kefe-motion-font-v2';
  const fallbackFont = () => {
    try { return localStorage.getItem(FONT_KEY) || 'Open Sans'; } catch (_) { return 'Open Sans'; }
  };
  const setFont = (ctx, family, size, weight = 700) => {
    ctx.font = `${weight} ${Math.max(18, size)}px "${family}", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  };
  const trackedWidth = (ctx, text, tracking) => {
    const chars = Array.from(String(text));
    if (!chars.length) return 0;
    return chars.reduce((sum, char) => sum + ctx.measureText(char).width, 0) + Math.max(0, chars.length - 1) * tracking;
  };
  const __scrollFitCache = new Map();
  const fitText = (ctx, text, requested, tracking, maxWidth, family) => {
    const key = (text || '') + '|' + (requested || 0) + '|' + (tracking || 0) + '|' + (maxWidth | 0) + '|' + (family || '');
    const hit = __scrollFitCache.get(key);
    if (hit) return hit;
    let size = Math.max(28, Math.min(150, Number(requested) || 76));
    setFont(ctx, family, size);
    while (size > 28 && trackedWidth(ctx, text, tracking * size) > maxWidth) {
      size -= 1;
      setFont(ctx, family, size);
    }
    const result = { size, width: trackedWidth(ctx, text, tracking * size) };
    if (__scrollFitCache.size > 800) __scrollFitCache.clear();
    __scrollFitCache.set(key, result);
    return result;
  };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => __scrollFitCache.clear());;

  function drawTracked(ctx, text, x, y, tracking) {
    u.drawTrackedText(ctx, text, x, y, tracking, 'fillText');
  }

  function renderScrollLines(ctx, w, h, style, lines, time) {
    if (!Array.isArray(lines) || !lines.length) return;
    const active = u.activeLine(lines, time);
    if (!active) return;

    const family = style.kefeMotionFont || fallbackFont();
    const colour = style.textColor || '#FFFFFF';
    const accent = style.accentColor || colour;
    const requested = Number(style.fontSize) || 76;
    const tracking = -0.006;
    const centerY = h * 0.54;
    const rowGap = Math.max(58, Math.min(h * 0.145, requested * 0.98));
    const speedBase = Math.max(20, Math.min(95, w * 0.045));

    // Keep a small local window so long lyric files remain inexpensive.
    const first = Math.max(0, active.index - 2);
    const last = Math.min(lines.length - 1, active.index + 2);
    const visible = [];
    for (let i = first; i <= last; i++) {
      const line = lines[i];
      const text = String(line?.text || '').trim();
      if (!text) continue;
      const distance = i - active.index;
      const sizeFactor = distance === 0 ? 1 : Math.abs(distance) === 1 ? .72 : .56;
      const prepared = fitText(ctx, text, requested * sizeFactor, tracking, w * (distance === 0 ? .90 : .82), family);
      visible.push({ line, index: i, distance, text, size: prepared.size, width: prepared.width });
    }

    ctx.save();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';

    visible.forEach(item => {
      const d = item.distance;
      const lineStart = Number(item.line.time) || 0;
      const lineEnd = Number(item.line.endTime) || Number(lines[item.index + 1]?.time) || lineStart + 3;
      const local = clamp((time - lineStart) / Math.max(.2, lineEnd - lineStart));
      const activeLine = d === 0;
      const direction = item.index % 2 === 0 ? 1 : -1;
      const speed = speedBase * (1 + Math.abs(d) * .24);
      const phase = (time - lineStart) * speed * direction;
      const baseX = activeLine ? (w - item.width) / 2 : (w - item.width) / 2;
      const travel = activeLine ? 0 : Math.max(w * 0.18, item.width * 0.12);
      const wrapped = ((phase + travel * 4) % (travel * 4)) - travel * 2;
      const entrance = smoother(Math.min(1, (time - (Number(item.line.time) || 0)) / .34));
      const proximity = activeLine ? 1 : Math.max(.28, 1 - Math.abs(d) * .25);
      const alpha = activeLine ? entrance : .13 + .12 * proximity;
      const y = centerY + d * rowGap;
      const x = baseX + (activeLine ? 0 : wrapped);
      const scale = activeLine ? .985 + .015 * smoother(local) : .98;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = activeLine ? colour : accent;
      ctx.shadowColor = activeLine ? accent : 'transparent';
      ctx.shadowBlur = 0;
      setFont(ctx, family, item.size, 700);
      ctx.translate(x + item.width / 2, y);
      ctx.scale(scale, scale);
      drawTracked(ctx, item.text, 0, 0, tracking * item.size);
      ctx.restore();
    });

    // A restrained active-line emphasis keeps the effect readable over video.
    const activeText = String(active.line?.text || '').trim();
    if (activeText) {
      const prepared = fitText(ctx, activeText, requested, tracking, w * .90, family);
      const start = Number(active.line.time) || 0;
      const end = Number(active.line.endTime) || start + 3;
      const enter = smoother((time - start) / .34);
      const exit = smoother((end - time) / .30);
      const opacity = enter * exit;
      ctx.save();
      ctx.globalAlpha = opacity * .08;
      ctx.fillStyle = accent;
      ctx.filter = 'none';
      setFont(ctx, family, prepared.size, 700);
      ctx.textAlign = 'center';
      drawTracked(ctx, activeText, w / 2, centerY, tracking * prepared.size);
      ctx.restore();
    }
    ctx.restore();
  }

  window.kefeEffects.scrolllines = (ctx, w, h, style, lines, time) => renderScrollLines(ctx, w, h, style, lines, time);

  function install() { window.__kefeScrollLinesInstalled = true; return true; }

  function addButton(){ /* buttons owned by app/effects/effects.js */ }

  function init() {
    install();
    addButton();
    if (!window.__kefeScrollLinesInstalled || !document.querySelector('[data-effect="scrolllines"]')) setTimeout(init, 50);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else setTimeout(init, 0);
})();
