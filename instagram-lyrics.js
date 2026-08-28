/* KEFE Visualiser — Instagram Lyrics effect */
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

  function prepare(ctx, text, requested, tracking, maxWidth) {
    let size = Math.max(46, Math.min(150, Number(requested) || 88));
    const upper = String(text || '').trim().toUpperCase();
    while (size > 46) {
      u.setContractFont(ctx, 'instagram', size);
      if (trackedWidth(ctx, upper, tracking * size) <= maxWidth) break;
      size -= 2;
    }
    u.setContractFont(ctx, 'instagram', size);
    return { text: upper, size, width: trackedWidth(ctx, upper, tracking * size) };
  }

  function drawItem(ctx, item, x, y, alpha, scale, tracking, colour) {
    if (!item || alpha <= 0.001) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = colour;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    u.setContractFont(ctx, 'instagram', item.size);
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    u.drawTrackedText(ctx, item.text, 0, 0, tracking * item.size, 'fillText');
    ctx.restore();
  }

  window.kefeEffects.instagram = function(ctx, w, h, style, lines, time) {
    if (!Array.isArray(lines) || !lines.length || !Number.isFinite(time)) return;
    const active = u.activeLine(lines, time);
    if (!active) return;

    const baseSize = Number(style.instagramFontSize ?? style.fontSize) || 88;
    const activeScale = Number(style.instagramActiveScale) || 1.14;
    const inactiveScale = Number(style.instagramInactiveScale) || 0.74;
    const inactiveOpacity = Number(style.instagramInactiveOpacity) || 0.28;
    const transition = clamp(Number(style.instagramTransition) || 0.18, 0.10, 0.40);
    const y = h * clamp(Number(style.instagramY) || 0.50, 0.30, 0.70);
    const maxWidth = w * clamp(Number(style.instagramMaxWidth) || 0.86, 0.62, 0.92);
    const tracking = Number.isFinite(Number(style.instagramTracking)) ? Number(style.instagramTracking) : -0.035;
    const colour = style.instagramTextColor || '#FFFFFF';

    const current = prepare(ctx, active.line.text, baseSize, tracking, maxWidth);
    if (!current.text) return;

    const lineGap = Math.max(14, current.size * 0.16);
    const previous = [];
    const next = [];
    for (let i = 1; i <= 2; i++) {
      if (active.index - i >= 0) previous.unshift(prepare(ctx, lines[active.index - i]?.text, baseSize * inactiveScale, tracking, maxWidth));
      if (active.index + i < lines.length) next.push(prepare(ctx, lines[active.index + i]?.text, baseSize * inactiveScale, tracking, maxWidth));
    }

    const stack = [
      ...previous.map((item, i) => ({ item, distance: -(previous.length - i) })),
      { item: current, distance: 0 },
      ...next.map((item, i) => ({ item, distance: i + 1 }))
    ];

    const nextStart = Number(lines[active.index + 1]?.time);
    const incoming = Number.isFinite(nextStart) ? smooth((time - (nextStart - transition)) / transition) : 0;

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.shadowBlur = 0;
    ctx.filter = 'none';

    const pitch = current.size * 0.72 + lineGap;
    for (const entry of stack) {
      const distance = entry.distance;
      const item = entry.item;
      if (!item) continue;

      let offsetY = distance * pitch;
      let alpha = distance === 0 ? 1 : inactiveOpacity / (Math.abs(distance) === 1 ? 1 : 1.18);
      let scale = distance === 0 ? activeScale : 1;

      if (distance === 0) {
        offsetY -= incoming * pitch * 0.82;
        scale = activeScale * (1 - incoming * 0.08);
        alpha = 1 - incoming * 0.16;
      } else if (distance === 1) {
        offsetY -= incoming * pitch;
        scale = 1 + incoming * (activeScale - 1) * 0.82;
        alpha = inactiveOpacity + incoming * (0.82 - inactiveOpacity);
      }

      drawItem(ctx, item, w / 2, y + offsetY, alpha, scale, tracking, colour);
    }

    ctx.restore();
  };
})();
