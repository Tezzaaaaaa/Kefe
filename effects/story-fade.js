/* KEFE Visualiser — Fade Up + Rise / Slide / Drop / Drift lyric effects */
(() => {
  'use strict';
  const u = window.kefeEffectUtils;
  window.kefeEffects = window.kefeEffects || {};

  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, Number(v) || 0));
  const smooth = v => { const t = clamp(v); return t * t * (3 - 2 * t); };
  const smoother = v => { const t = clamp(v); return t * t * t * (t * (t * 6 - 15) + 10); };

  function trackedWidth(ctx, text, tracking) {
    const chars = Array.from(String(text));
    if (!chars.length) return 0;
    return chars.reduce((sum, char) => sum + ctx.measureText(char).width, 0) + Math.max(0, chars.length - 1) * tracking;
  }

  function wrapWords(ctx, words, size, tracking, maxWidth) {
    const gap = Math.max(12, size * 0.16);
    const rows = [];
    let row = [];
    let width = 0;
    for (const word of words) {
      const wordWidth = trackedWidth(ctx, word.text, tracking);
      const proposed = row.length ? width + gap + wordWidth : wordWidth;
      if (row.length && proposed > maxWidth) {
        rows.push({ words: row, width });
        row = [];
        width = 0;
      }
      row.push({ ...word, width: wordWidth });
      width = row.length === 1 ? wordWidth : width + gap + wordWidth;
    }
    if (row.length) rows.push({ words: row, width });
    return rows;
  }

  function fit(ctx, words, requested, tracking, maxWidth) {
    let size = Math.max(34, Math.min(150, Number(requested) || 78));
    while (size > 34) {
      u.setContractFont(ctx, 'fadeup', size);
      const rows = wrapWords(ctx, words, size, tracking * size, maxWidth);
      if (rows.length <= 2) return { size, rows };
      size -= 2;
    }
    u.setContractFont(ctx, 'fadeup', size);
    return { size, rows: wrapWords(ctx, words, size, tracking * size, maxWidth) };
  }

  window.kefeEffects.fadeup = function(ctx, w, h, style, lines, time) {
    const active = u.activeLine(lines, time);
    if (!active) return;
    const words = u.wordsFor(active.line, active.next);
    if (!words.length) return;

    const contract = u.contract('fadeup');
    const tracking = Number(contract.tracking) || 0;
    const prepared = fit(ctx, words, style.fontSize, tracking, w * 0.80);
    const size = prepared.size;
    const rows = prepared.rows;
    const trackingPx = tracking * size;
    const rowHeight = size * 1.12;
    const top = h * 0.50 - ((rows.length - 1) * rowHeight) / 2;
    const gap = Math.max(12, size * 0.16);
    const colour = style.textColor || '#FFFFFF';
    const accent = style.accentColor || colour;

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';

    rows.forEach((row, rowIndex) => {
      let x = (w - row.width) / 2;
      const y = top + rowIndex * rowHeight;
      for (const word of row.words) {
        const wp = u.wordProgress(word, time);
        const p = clamp(wp.raw);
        if (p <= 0) {
          x += word.width + gap;
          continue;
        }
        const enter = smoother(p / 0.28);
        const settle = smoother((p - 0.18) / 0.42);
        const rise = (1 - enter) * size * 0.28;
        const scale = 0.965 + 0.035 * settle;
        const alpha = enter;
        const glow = settle * size * 0.055;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = colour;
        ctx.shadowColor = accent;
        ctx.shadowBlur = glow;
        ctx.translate(x + word.width / 2, y + rise);
        ctx.scale(scale, scale);
        u.drawTrackedText(ctx, word.text, 0, 0, trackingPx, 'fillText');
        ctx.restore();
        x += word.width + gap;
      }
    });
    ctx.restore();
  };

  /* ---------- KEFE basic motion lyric effects: Rise / Slide / Drop / Drift ---------- */
  const MOTION = {
    rise: {
      label: 'Rise — soft upward lift with a clean cinematic settle',
      tracking: -.006,
      distance: .72,
      direction: 'up',
      rotation: 0,
      overshoot: .018,
      ghost: .06
    },
    slide: {
      label: 'Slide — smooth lateral glide with a precise stop',
      tracking: -.006,
      distance: .76,
      direction: 'left',
      rotation: 0,
      overshoot: .012,
      ghost: .055
    },
    drop: {
      label: 'Drop — controlled downward arrival with a subtle weighty settle',
      tracking: -.006,
      distance: .70,
      direction: 'down',
      rotation: 0,
      overshoot: .024,
      ghost: .045
    },
    drift: {
      label: 'Drift — gentle diagonal float with barely-there rotation',
      tracking: -.006,
      distance: .66,
      direction: 'diagonal',
      rotation: .020,
      overshoot: .010,
      ghost: .075
    }
  };

  function motionLine(ctx, w, h, style, active, time, mode) {
    const line = String(active?.line?.text || '').trim();
    if (!line) return;

    const meta = MOTION[mode];
    const contract = u.contract('fadeup');
    const tracking = Number(meta?.tracking ?? contract.tracking) || 0;
    const requested = Math.max(34, Math.min(150, Number(style.fontSize) || 76));
    const maxWidth = w * .88;

    let size = requested;
    u.setContractFont(ctx, 'fadeup', size);
    while (size > 34 && trackedWidth(ctx, line, tracking * size) > maxWidth) {
      size -= 1;
      u.setContractFont(ctx, 'fadeup', size);
    }

    const start = Number(active.line.time) || 0;
    const end = Math.max(start + .35, Number(active.line.endTime) || start + 3);
    const duration = end - start;

    /* The motion is front-loaded, then settles quickly. This keeps rapid lyrics
       readable instead of making every transition feel like a long animation. */
    const enterDuration = Math.min(.46, Math.max(.20, duration * .19));
    const exitDuration = Math.min(.34, Math.max(.18, duration * .14));
    const enter = smoother((time - start) / enterDuration);
    const exit = smoother((end - time) / exitDuration);
    const opacity = enter * exit;
    const settle = smoother((time - start - enterDuration * .48) / Math.max(.16, enterDuration * .68));
    const pre = smoother((time - start) / Math.max(.08, enterDuration * .22));

    /* A tiny anticipation phase gives the animation a physical point of origin
       without delaying the lyric or creating a cartoon bounce. */
    const anticipation = 1 - pre;
    const distance = Math.min(w * .20, size * meta.distance);
    let dx = 0;
    let dy = 0;
    let rotation = 0;

    if (meta.direction === 'up') {
      dy = (1 - enter) * distance - anticipation * size * .035;
    } else if (meta.direction === 'left') {
      dx = (1 - enter) * distance - anticipation * size * .035;
    } else if (meta.direction === 'down') {
      dy = -(1 - enter) * distance + anticipation * size * .035;
    } else {
      dx = (1 - enter) * distance * .72 - anticipation * size * .025;
      dy = (1 - enter) * distance * .28 - anticipation * size * .018;
      rotation = (1 - enter) * meta.rotation;
    }

    /* Micro-settle: the line travels a fraction beyond its resting point and
       returns once. It is intentionally tiny so the typography remains premium. */
    const settleWave = Math.sin(clamp((time - start) / Math.max(.01, enterDuration)) * Math.PI) * (1 - enter) * meta.overshoot * size;
    if (meta.direction === 'up') dy -= settleWave;
    else if (meta.direction === 'down') dy += settleWave;
    else dx -= settleWave * (meta.direction === 'left' ? 1 : .55);

    const scale = .985 + .015 * settle;
    const colour = style.textColor || '#FFFFFF';
    const accent = style.accentColor || colour;
    const glow = size * (.010 + .014 * settle);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';

    /* Very light directional echo during the first frames adds continuity at
       30/60 fps without producing a visible duplicate lyric. */
    if (meta.ghost > 0 && enter < .92 && opacity > .01) {
      ctx.save();
      ctx.globalAlpha = opacity * meta.ghost * (1 - enter);
      ctx.fillStyle = accent;
      ctx.shadowColor = accent;
      ctx.shadowBlur = size * .035;
      const echoX = dx * .35;
      const echoY = dy * .35;
      ctx.translate(w / 2 + echoX, h * .76 + echoY);
      ctx.rotate(rotation * .35);
      ctx.scale(scale, scale);
      u.drawTrackedText(ctx, line, 0, 0, tracking * size, 'fillText');
      ctx.restore();
    }

    ctx.globalAlpha = opacity;
    ctx.fillStyle = colour;
    ctx.shadowColor = accent;
    ctx.shadowBlur = glow;
    ctx.translate(w / 2 + dx, h * .76 + dy);
    ctx.rotate(rotation);
    ctx.scale(scale, scale);
    u.drawTrackedText(ctx, line, 0, 0, tracking * size, 'fillText');
    ctx.restore();
  }

  window.kefeEffects.rise = (ctx, w, h, style, lines, time) => {
    const active = u.activeLine(lines, time);
    if (active) motionLine(ctx, w, h, style, active, time, 'rise');
  };
  window.kefeEffects.slide = (ctx, w, h, style, lines, time) => {
    const active = u.activeLine(lines, time);
    if (active) motionLine(ctx, w, h, style, active, time, 'slide');
  };
  window.kefeEffects.drop = (ctx, w, h, style, lines, time) => {
    const active = u.activeLine(lines, time);
    if (active) motionLine(ctx, w, h, style, active, time, 'drop');
  };
  window.kefeEffects.drift = (ctx, w, h, style, lines, time) => {
    const active = u.activeLine(lines, time);
    if (active) motionLine(ctx, w, h, style, active, time, 'drift');
  };

  /* Register the four effects after app.js creates the renderer. The wrapper
     preserves the existing background/media/title-card pipeline and replaces
     only the lyric layer for these four effect IDs. */
  function installMotionEffects() {
    if (window.__kefeMotionEffectsInstalled) return true;
    if (typeof window.render !== 'function') return false;

    const originalRender = window.render;
    const extra = new Set(Object.keys(MOTION));

    window.render = function(ctx, w, h, appState, mediaCache) {
      const effect = appState?.style?.effect;
      if (!extra.has(effect)) return originalRender(ctx, w, h, appState, mediaCache);

      const style = appState.style;
      const lines = appState.captions?.mode === 'captions' && Array.isArray(appState.captions.lines) && appState.captions.lines.length
        ? appState.captions.lines
        : (Array.isArray(appState.lyrics?.lines) ? appState.lyrics.lines : []);
      const time = Number(appState.playback?.currentTime) || 0;

      const originalEffect = style.effect;
      const originalText = style.textColor;
      const originalAccent = style.accentColor;
      const originalOpacity = style.appleInactiveOpacity;
      try {
        style.effect = 'apple';
        style.textColor = 'rgba(0,0,0,0)';
        style.accentColor = 'rgba(0,0,0,0)';
        style.appleInactiveOpacity = 0;
        originalRender(ctx, w, h, appState, mediaCache);
      } finally {
        style.effect = originalEffect;
        style.textColor = originalText;
        style.accentColor = originalAccent;
        style.appleInactiveOpacity = originalOpacity;
      }

      if (lines.length) window.kefeEffects[effect](ctx, w, h, style, lines, time);
    };

    window.__kefeMotionEffectsInstalled = true;
    return true;
  }

  function addMotionButtons() {
    const host = document.querySelector('#lyricStyleBlock .effect-buttons');
    if (!host || host.querySelector('[data-effect="rise"]')) return;

    const fragment = document.createDocumentFragment();
    for (const [name, meta] of Object.entries(MOTION)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'segmented-btn';
      button.dataset.effect = name;
      button.textContent = name[0].toUpperCase() + name.slice(1);
      button.title = meta.label;
      button.addEventListener('click', () => {
        if (typeof window.setEffect === 'function') window.setEffect(name);
        const label = document.getElementById('effectLabel');
        if (label) label.textContent = meta.label;
        document.querySelectorAll('[data-effect]').forEach(b => b.classList.toggle('active-effect', b.dataset.effect === name));
        window.redrawCurrentPreviewFrame?.();
      });
      fragment.appendChild(button);
    }
    host.appendChild(fragment);
  }

  function initExtras() {
    installMotionEffects();
    addMotionButtons();
    if (!window.__kefeMotionEffectsInstalled || !document.querySelector('[data-effect="rise"]')) {
      setTimeout(initExtras, 50);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(initExtras, 0), { once: true });
  } else {
    setTimeout(initExtras, 0);
  }
})();
