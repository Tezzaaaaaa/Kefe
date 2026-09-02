/* KEFE Visualiser — Aurora lyric effect */
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
    let size = Math.max(38, Math.min(150, Number(requested) || 76));
    const clean = String(text || '').trim();
    while (size > 38) {
      u.setContractFont(ctx, 'aurora', size);
      if (trackedWidth(ctx, clean, tracking * size) <= maxWidth) break;
      size -= 2;
    }
    u.setContractFont(ctx, 'aurora', size);
    return { text: clean, size, width: trackedWidth(ctx, clean, tracking * size) };
  }

  window.kefeEffects.aurora = function(ctx, w, h, style, lines, time) {
    const active = u.activeLine(lines, time);
    if (!active) return;
    const text = String(active.line.text || '').trim();
    if (!text) return;

    const contract = u.contract('aurora');
    const tracking = Number(contract.tracking) || 0;
    const item = fit(ctx, text, style.fontSize, tracking, w * 0.80);
    const purple = style.auroraInkColor || '#A58BFF';
    const glow = clamp(Number(style.auroraGlow) || 1, 0.2, 2);
    const progress = u.lineProgress(active.line, time, 0.10, 0.16);
    const enter = smooth(progress.enter);
    const exit = smooth(progress.exit);
    const opacity = enter * exit;
    if (opacity <= 0.001) return;

    const y = h * 0.60;
    const lift = (1 - enter) * item.size * 0.42;
    const scale = 0.985 + 0.015 * smooth(enter);
    const drift = Math.sin(time * 0.45) * item.size * 0.010;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = purple;
    ctx.shadowColor = purple;
    ctx.shadowBlur = item.size * 0.10 * glow;
    ctx.globalAlpha = opacity;
    ctx.translate(w / 2 + drift, y + lift);
    ctx.scale(scale, scale);
    u.setContractFont(ctx, 'aurora', item.size);
    u.drawTrackedText(ctx, item.text, 0, 0, item.size * tracking, 'fillText');
    ctx.restore();

    // Keep the transition cinematic without introducing a second lyric block
    // that can collide with the active lyric.
    if (active.next && progress.exit < 0.35) {
      const nextText = String(active.next.text || '').trim();
      if (nextText) {
        const nextItem = fit(ctx, nextText, item.size * 0.62, tracking, w * 0.70);
        const nextOpacity = (1 - progress.exit / 0.35) * 0.10;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = nextOpacity;
        ctx.fillStyle = purple;
        ctx.shadowColor = purple;
        ctx.shadowBlur = nextItem.size * 0.05;
        u.setContractFont(ctx, 'aurora', nextItem.size);
        u.drawTrackedText(ctx, nextItem.text, w / 2, y + item.size * 1.45, nextItem.size * tracking, 'fillText');
        ctx.restore();
      }
    }
  };
})();
