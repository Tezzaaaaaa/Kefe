/* KEFE Visualiser — Fade Up effect */
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

  /* ---------- KEFE motion lyric effects: Rise / Slide / Drop / Drift ---------- */
  const MOTION = {
    rise: {
      label: 'Rise — each word lifts smoothly from below into place',
      font: 'fadeup',
      tracking: -.006
    },
    slide: {
      label: 'Slide — each word glides horizontally into position',
      font: 'fadeup',
      tracking: -.006
    },
    drop: {
      label: 'Drop — each word falls into place with a restrained settle',
      font: 'fadeup',
      tracking: -.006
    },
    drift: {
      label: 'Drift — words float in from alternating directions with soft motion',
      font: 'fadeup',
      tracking: -.006
    }
  };

  function motionWords(ctx, w, style, active) {
    const words = u.wordsFor(active.line, active.next);
    if (!words.length) return null;
    const requested = Number(style.fontSize) || 76;
    const tracking = Number(MOTION[style.effect]?.tracking) || -.006;
    let size = Math.max(34, Math.min(150, requested));
    let rows;
    while (size > 34) {
      u.setContractFont(ctx, 'fadeup', size);
      rows = wrapWords(ctx, words, size, tracking * size, w * .80);
      if (rows.length <= 2) break;
      size -= 2;
    }
    u.setContractFont(ctx, 'fadeup', size);
    rows = wrapWords(ctx, words, size, tracking * size, w * .80);
    return { words, rows, size, trackingPx: tracking * size, gap: Math.max(12, size * .16) };
  }

  function drawMotionBase(ctx, w, h, style, lines, time, mode) {
    const active = u.activeLine(lines, time);
    if (!active) return;
    const prepared = motionWords(ctx, w, style, active);
    if (!prepared) return;

    const { rows, size, trackingPx, gap } = prepared;
    const rowHeight = size * 1.12;
    const top = h * .50 - ((rows.length - 1) * rowHeight) / 2;
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

      row.words.forEach((word, index) => {
        const wp = u.wordProgress(word, time);
        const p = clamp(wp.raw);
        if (p <= 0) {
          x += word.width + gap;
          return;
        }

        const stagger = index * .025;
        const enter = smoother((p - stagger) / .30);
        const settle = smoother((p - stagger - .16) / .42);
        const elapsed = Math.max(0, time - Number(word.time || 0));
        const direction = index % 2 === 0 ? -1 : 1;
        let dx = 0, dy = 0, scale = 1, alpha = enter, rotation = 0;

        if (mode === 'rise') {
          dy = (1 - enter) * size * .34;
          scale = .97 + .03 * settle;
        } else if (mode === 'slide') {
          dx = direction * (1 - enter) * w * .16;
          scale = .985 + .015 * settle;
        } else if (mode === 'drop') {
          dy = -(1 - enter) * size * .42;
          const bounce = Math.sin(Math.min(1, Math.max(0, (p - .22) / .50)) * Math.PI) * size * .035;
          dy += bounce * (1 - settle);
          scale = .98 + .02 * settle;
        } else if (mode === 'drift') {
          const seed = (active.index + 1) * 17 + index * 31;
          const angle = (seed % 8) * Math.PI / 4;
          const distance = size * .28;
          dx = Math.cos(angle) * (1 - enter) * distance;
          dy = Math.sin(angle) * (1 - enter) * distance;
          rotation = Math.sin(angle) * (1 - enter) * .035;
          const float = Math.sin(elapsed * 2.4 + seed) * size * .012 * settle;
          dx += Math.cos(angle + Math.PI / 2) * float;
          dy += Math.sin(angle + Math.PI / 2) * float;
        }

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = colour;
        ctx.shadowColor = accent;
        ctx.shadowBlur = mode === 'drift' ? size * .025 * settle : size * .018 * settle;
        ctx.translate(x + word.width / 2 + dx, y + dy);
        ctx.rotate(rotation);
        ctx.scale(scale, scale);
        u.drawTrackedText(ctx, word.text, 0, 0, trackingPx, 'fillText');
        ctx.restore();

        x += word.width + gap;
      });
    });

    ctx.restore();
  }

  window.kefeEffects.rise = (ctx, w, h, style, lines, time) => drawMotionBase(ctx, w, h, style, lines, time, 'rise');
  window.kefeEffects.slide = (ctx, w, h, style, lines, time) => drawMotionBase(ctx, w, h, style, lines, time, 'slide');
  window.kefeEffects.drop = (ctx, w, h, style, lines, time) => drawMotionBase(ctx, w, h, style, lines, time, 'drop');
  window.kefeEffects.drift = (ctx, w, h, style, lines, time) => drawMotionBase(ctx, w, h, style, lines, time, 'drift');

  /* The main renderer is defined by app.js after this file loads. Patch it after
     DOM ready so the new effects work in both preview and frame-accurate export. */
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

      // Let KEFE draw the complete background/media/title-card stack first,
      // while suppressing the built-in lyric renderer. Then place the motion
      // effect over that exact frame.
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
