/* KEFE — Progressive Blur Slider lyric effect.
 * Native canvas translation of an infinite horizontal lyric slider with
 * progressive edge blur. No external UI/animation dependency is required.
 */
(() => {
  'use strict';

  window.kefeEffects = window.kefeEffects || {};

  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, Number(v) || 0));
  const smooth = v => {
    const t = clamp(v);
    return t * t * (3 - 2 * t);
  };

  function textWidth(ctx, text) {
    return ctx.measureText(text).width;
  }

  function fitFont(ctx, text, requested, maxWidth, family, weight) {
    let size = Math.max(24, Math.min(180, Number(requested) || 72));
    ctx.font = `${weight} ${size}px "${family}", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    while (size > 24 && textWidth(ctx, text) > maxWidth) {
      size -= 1;
      ctx.font = `${weight} ${size}px "${family}", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    }
    return size;
  }

  function normaliseLines(lines) {
    return lines
      .map((line, index) => ({
        index,
        text: String(line?.text || '').replace(/\s+/g, ' ').trim(),
        time: Number(line?.time) || 0,
        endTime: Number(line?.endTime) || Number(lines[index + 1]?.time) || (Number(line?.time) || 0) + 3
      }))
      .filter(line => line.text);
  }

  function activeIndexFor(lines, time) {
    let index = -1;
    for (let i = 0; i < lines.length; i++) {
      if (time >= lines[i].time) index = i;
      else break;
    }
    return index;
  }

  function drawText(ctx, text, x, y, align, alpha, fill) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function renderProgressiveBlur(ctx, w, h, style, lines, time) {
    if (!Array.isArray(lines) || !lines.length) return;

    const lyricLines = normaliseLines(lines);
    if (!lyricLines.length) return;

    const activeIndex = activeIndexFor(lyricLines, time);
    if (activeIndex < 0) return;

    const contract = window.KEFE_TYPE?.effects?.progressiveblur || {};
    const family = contract.family || 'Open Sans';
    const weight = contract.weight || 700;
    const requested = Number(style.fontSize) || 76;
    const colour = style.textColor || '#FFFFFF';
    const inactive = style.inactiveColor || 'rgba(255,255,255,.62)';
    const centerY = h * 0.52;
    const gap = Math.max(24, Math.min(w * 0.055, requested * 0.42));
    const velocity = Math.max(22, Math.min(90, w * 0.075));
    const sideFade = Math.max(110, Math.min(w * 0.22, 200));
    const maxTextWidth = w * 0.72;

    ctx.save();
    ctx.textBaseline = 'middle';

    const activeLine = lyricLines[activeIndex];
    const activeProgress = clamp(
      (time - activeLine.time) / Math.max(0.2, activeLine.endTime - activeLine.time)
    );
    const entrance = smooth((time - activeLine.time) / 0.28);
    const exit = smooth((activeLine.endTime - time) / 0.28);
    const activeOpacity = entrance * exit;

    const prepared = [];
    const visibleRadius = Math.min(7, Math.ceil(w / 260));

    for (let offset = -visibleRadius; offset <= visibleRadius; offset++) {
      const index = (activeIndex + offset + lyricLines.length) % lyricLines.length;
      const line = lyricLines[index];
      const isActive = offset === 0;
      const size = fitFont(
        ctx,
        line.text,
        requested * (isActive ? 1 : 0.72),
        isActive ? maxTextWidth : w * 0.58,
        family,
        weight
      );
      ctx.font = `${weight} ${size}px "${family}", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      const width = textWidth(ctx, line.text);
      prepared.push({ line, offset, isActive, size, width });
    }

    const cycleWidth = prepared.reduce((sum, item) => sum + item.width + gap, 0);
    const activeWidth = prepared.find(item => item.isActive)?.width || 0;
    const baseShift = (time * velocity) % Math.max(1, cycleWidth);
    const activeNudge = (activeProgress - 0.5) * Math.min(18, w * 0.018);

    const drawSlider = (filter, clipX, clipW) => {
      ctx.save();
      if (filter) ctx.filter = filter;
      ctx.beginPath();
      ctx.rect(clipX, 0, clipW, h);
      ctx.clip();

      let x = w / 2 - activeWidth / 2 - baseShift + activeNudge;
      for (let pass = 0; pass < 3; pass++) {
        for (const item of prepared) {
          const y = centerY;
          const alpha = item.isActive
            ? activeOpacity
            : 0.18 + 0.10 * Math.max(0, 1 - Math.abs(item.offset) / (visibleRadius + 1));
          const fill = item.isActive ? colour : inactive;

          ctx.font = `${weight} ${item.size}px "${family}", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
          drawText(ctx, item.line.text, x, y, 'left', alpha, fill);
          x += item.width + gap;
        }
        if (cycleWidth <= 0) break;
        x += cycleWidth;
      }
      ctx.restore();
    };

    drawSlider('none', 0, w);

    // Re-draw the outer bands with increasing blur to reproduce the
    // ProgressiveBlur component's soft edge falloff.
    const bands = [
      { width: sideFade, blur: 14, alpha: 0.92 },
      { width: sideFade * 0.62, blur: 8, alpha: 0.72 },
      { width: sideFade * 0.32, blur: 4, alpha: 0.48 }
    ];

    for (const band of bands) {
      const width = Math.min(w / 2, band.width);
      ctx.save();
      ctx.globalAlpha = band.alpha;
      drawSlider(`blur(${band.blur}px)`, 0, width);
      drawSlider(`blur(${band.blur}px)`, w - width, width);
      ctx.restore();
    }

    // Transparent edge masks make the blur fall away progressively rather
    // than ending at a hard clip.
    const leftMask = ctx.createLinearGradient(0, 0, sideFade, 0);
    leftMask.addColorStop(0, 'rgba(0,0,0,.82)');
    leftMask.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = leftMask;
    ctx.fillRect(0, 0, sideFade, h);

    const rightMask = ctx.createLinearGradient(w - sideFade, 0, w, 0);
    rightMask.addColorStop(0, 'rgba(0,0,0,0)');
    rightMask.addColorStop(1, 'rgba(0,0,0,.82)');
    ctx.fillStyle = rightMask;
    ctx.fillRect(w - sideFade, 0, sideFade, h);

    ctx.restore();
  }

  window.kefeEffects.progressiveblur = (ctx, w, h, style, lines, time) =>
    renderProgressiveBlur(ctx, w, h, style, lines, time);
})();
