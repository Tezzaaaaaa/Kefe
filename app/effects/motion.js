/* KEFE — Rise, Slide, Drop and Drift lyric renderers. */
(() => {
  'use strict';
  const u = window.kefeEffectUtils;
  window.kefeEffects = window.kefeEffects || {};
  if (!u) return;

  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, Number(v) || 0));
  const smoother = v => { const t = clamp(v); return t * t * t * (t * (t * 6 - 15) + 10); };
  const modes = {
    rise:   { direction: 'up',       distance: .72, rotation: 0,     overshoot: .018 },
    slide:  { direction: 'left',     distance: .76, rotation: 0,     overshoot: .012 },
    drop:   { direction: 'down',     distance: .70, rotation: 0,     overshoot: .024 },
    drift:  { direction: 'diagonal', distance: .66, rotation: .020, overshoot: .010 }
  };
  const font = (ctx, family, size) => {
    ctx.font = `700 ${Math.max(18, size)}px "${family || 'Open Sans'}", system-ui, sans-serif`;
  };

  function draw(ctx, w, h, style, active, time, mode) {
    const line = String(active?.line?.text || '').trim();
    if (!line) return;
    const meta = modes[mode];
    const family = style.kefeMotionFont || 'Open Sans';
    const tracking = -.006;
    let size = Math.max(34, Math.min(150, Number(style.fontSize) || 76));
    font(ctx, family, size);
    while (size > 34 && ctx.measureText(line).width > w * .88) { size -= 1; font(ctx, family, size); }

    const start = Number(active.line.time) || 0;
    const end = Math.max(start + .35, Number(active.line.endTime) || start + 3);
    const duration = end - start;
    const enterDuration = Math.min(.46, Math.max(.20, duration * .19));
    const exitDuration = Math.min(.34, Math.max(.18, duration * .14));
    const enter = smoother((time - start) / enterDuration);
    const exit = smoother((end - time) / exitDuration);
    const opacity = enter * exit;
    const settle = smoother((time - start - enterDuration * .48) / Math.max(.16, enterDuration * .68));
    const anticipation = 1 - smoother((time - start) / Math.max(.08, enterDuration * .22));
    const distance = Math.min(w * .20, size * meta.distance);
    let dx = 0, dy = 0, rotation = 0;
    if (meta.direction === 'up') dy = (1 - enter) * distance - anticipation * size * .035;
    else if (meta.direction === 'left') dx = (1 - enter) * distance - anticipation * size * .035;
    else if (meta.direction === 'down') dy = -(1 - enter) * distance + anticipation * size * .035;
    else { dx = (1 - enter) * distance * .72 - anticipation * size * .025; dy = (1 - enter) * distance * .28 - anticipation * size * .018; rotation = (1 - enter) * meta.rotation; }
    const wave = Math.sin(clamp((time - start) / Math.max(.01, enterDuration)) * Math.PI) * (1 - enter) * meta.overshoot * size;
    if (meta.direction === 'up') dy -= wave;
    else if (meta.direction === 'down') dy += wave;
    else dx -= wave * (meta.direction === 'left' ? 1 : .55);

    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
    font(ctx, family, size);
    ctx.globalAlpha = opacity;
    ctx.fillStyle = style.textColor || '#FFFFFF';
    ctx.shadowColor = style.accentColor || style.textColor || '#FFFFFF';
    ctx.shadowBlur = size * (.010 + .014 * settle);
    ctx.translate(w / 2 + dx, h * .76 + dy);
    ctx.rotate(rotation);
    ctx.scale(.985 + .015 * settle, .985 + .015 * settle);
    u.drawTrackedText(ctx, line, 0, 0, tracking * size, 'fillText');
    ctx.restore();
  }

  for (const mode of Object.keys(modes)) {
    window.kefeEffects[mode] = function(ctx, w, h, style, lines, time) {
      const active = u.activeLine(lines, time);
      if (active) draw(ctx, w, h, style, active, time, mode);
    };
  }
})();
