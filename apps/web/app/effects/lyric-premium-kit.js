/* KEFE — premium lyric rendering kit (window.kefeFx).
   Shared building blocks for the Signature LyricFX pack: real multi-radius bloom,
   masked gradient / texture fills, additive RGB splits, film grain, damped springs,
   per-word soft-edged karaoke sweeps and user colour overrides.

   Rules the kit keeps so every effect stays export-safe:
   - Deterministic: no Math.random or Date; everything is a function of `time`.
   - Defensive: when offscreen canvases are unavailable (tests, very old browsers)
     every helper degrades to a plain draw on the main context, never throws.
   - Filter-free fallback: blur works without ctx.filter (Safari) via ring taps. */
(() => {
  'use strict';
  const U = window.kefeEffectUtils;
  if (!U) { console.error('[premium-kit] effects/core.js is required'); return; }
  const Fx = window.kefeFx = window.kefeFx || {};
  const clamp = U.clamp;
  const TAU = Math.PI * 2;
  Fx.TAU = TAU;
  Fx.clamp = clamp;

  /* ------------------------------------------------------------------ */
  /* maths + easing                                                     */
  /* ------------------------------------------------------------------ */
  Fx.lerp = (a, b, t) => a + (b - a) * t;
  Fx.hash = seed => {
    const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return value - Math.floor(value);
  };
  /* Smooth 1-D value noise, 0..1. Continuous in x, deterministic. */
  Fx.noise = (x, seed = 0) => {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return Fx.lerp(Fx.hash(i + seed * 57.3), Fx.hash(i + 1 + seed * 57.3), u);
  };
  Fx.ease = {
    outCubic: x => 1 - Math.pow(1 - clamp(x), 3),
    outQuart: x => 1 - Math.pow(1 - clamp(x), 4),
    outExpo: x => { const t = clamp(x); return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); },
    inCubic: x => Math.pow(clamp(x), 3),
    inOut: x => { const t = clamp(x); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    outBack: (x, s = 1.70158) => { const t = clamp(x) - 1; return 1 + (s + 1) * t * t * t + s * t * t; },
  };
  /* Damped spring step response 0 -> 1 (overshoots when zeta < 1). t in seconds. */
  Fx.spring = (t, freq = 2.2, zeta = .5) => {
    if (!(t > 0)) return 0;
    const w0 = TAU * freq;
    if (zeta >= 1) return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + (zeta * w0 / wd) * Math.sin(wd * t));
  };

  /* ------------------------------------------------------------------ */
  /* colour                                                             */
  /* ------------------------------------------------------------------ */
  Fx.rgb = hex => {
    const value = String(hex || '').replace('#', '');
    const full = value.length === 3 ? value.split('').map(c => c + c).join('') : value;
    const int = Number.parseInt(full.slice(0, 6), 16);
    return Number.isFinite(int) ? [(int >> 16) & 255, (int >> 8) & 255, int & 255] : [255, 255, 255];
  };
  Fx.rgba = (hex, alpha) => {
    const [r, g, b] = Fx.rgb(hex);
    return `rgba(${r},${g},${b},${clamp(alpha)})`;
  };
  Fx.mix = (a, b, t) => {
    const A = Fx.rgb(a), B = Fx.rgb(b);
    return `rgb(${Math.round(Fx.lerp(A[0], B[0], t))},${Math.round(Fx.lerp(A[1], B[1], t))},${Math.round(Fx.lerp(A[2], B[2], t))})`;
  };
  Fx.hsl = (h, s, l, a = 1) => `hsla(${((h % 360) + 360) % 360},${s}%,${l}%,${clamp(a)})`;

  /* The style layer stores empty strings for "use the effect's own colour".
     Read the user's explicit overrides straight from it so an effect can honour
     them without mistaking its default white for a choice. */
  const validHex = value => /^#[0-9a-f]{6}$/i.test(String(value || ''));
  Fx.palette = defaults => {
    let state = null;
    try { state = window.kefeStyle && window.kefeStyle.state ? window.kefeStyle.state() : null; } catch (_) { state = null; }
    const pick = (key, fallback) => (state && validHex(state[key]) ? state[key] : fallback);
    return {
      text: pick('textColor', defaults.text),
      accent: pick('accentColor', defaults.accent),
      inactive: pick('inactiveColor', defaults.inactive),
      textSet: !!(state && validHex(state.textColor)),
      accentSet: !!(state && validHex(state.accentColor)),
      inactiveSet: !!(state && validHex(state.inactiveColor)),
    };
  };

  /* ------------------------------------------------------------------ */
  /* scratch canvases                                                   */
  /* ------------------------------------------------------------------ */
  const pool = new Map();
  Fx.scratch = (name, w, h) => {
    if (typeof document === 'undefined' || !document || typeof document.createElement !== 'function') return null;
    let entry = pool.get(name);
    if (!entry) {
      const canvas = document.createElement('canvas');
      if (!canvas || typeof canvas.getContext !== 'function') return null;
      const g = canvas.getContext('2d');
      if (!g) return null;
      entry = { c: canvas, g };
      pool.set(name, entry);
    }
    const width = Math.max(1, Math.round(w)), height = Math.max(1, Math.round(h));
    if (entry.c.width !== width || entry.c.height !== height) { entry.c.width = width; entry.c.height = height; }
    const g = entry.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.shadowColor = 'transparent';
    g.shadowBlur = 0;
    if ('filter' in g) g.filter = 'none';
    g.clearRect(0, 0, width, height);
    return entry;
  };

  /* Blur `src` into `g` at (0,0,dw,dh). Uses ctx.filter when it exists, otherwise ring taps. */
  function blurDraw(g, src, px, dw, dh) {
    if (!(px > .35)) { g.drawImage(src, 0, 0, dw, dh); return; }
    if ('filter' in g) {
      g.save();
      g.filter = `blur(${px}px)`;
      g.drawImage(src, 0, 0, dw, dh);
      g.restore();
      return;
    }
    const taps = 10, prev = g.globalAlpha;
    g.globalAlpha = prev * .34;
    g.drawImage(src, 0, 0, dw, dh);
    g.globalAlpha = prev * .66 / taps * 1.7;
    for (let ring = 1; ring <= 2; ring += 1) {
      const r = px * ring * .62;
      for (let i = 0; i < taps; i += 1) {
        const a = i / taps * TAU + ring * .3;
        g.drawImage(src, Math.cos(a) * r, Math.sin(a) * r, dw, dh);
      }
    }
    g.globalAlpha = prev;
  }

  /* ------------------------------------------------------------------ */
  /* bloom                                                              */
  /* ------------------------------------------------------------------ */
  /* Additive halo around whatever `paint(g)` draws (coordinates in main space).
     Two radii (tight core + wide atmosphere) composited with `lighter`, like a
     real lens bloom. Draws ONLY the halo; the caller draws crisp type after. */
  Fx.bloom = (ctx, w, h, paint, o = {}) => {
    const scale = o.scale || .5;
    const A = Fx.scratch('kfx-bloom-a', w * scale, h * scale);
    if (!A) return false;
    Fx.syncText(A.g, ctx);
    A.g.save();
    A.g.scale(scale, scale);
    paint(A.g);
    A.g.restore();
    const radius = Math.max(2, o.radius || 24) * scale;
    const strength = (o.strength == null ? 1 : o.strength) * ctx.globalAlpha;
    const tight = Fx.scratch('kfx-bloom-b', w * scale, h * scale);
    const wide = Fx.scratch('kfx-bloom-c', w * scale * .5, h * scale * .5);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (tight) {
      blurDraw(tight.g, A.c, radius * .45, tight.c.width, tight.c.height);
      ctx.globalAlpha = clamp(strength * (o.tight == null ? .95 : o.tight));
      ctx.drawImage(tight.c, 0, 0, w, h);
    }
    if (wide) {
      blurDraw(wide.g, A.c, radius * 1.05 * .5, wide.c.width, wide.c.height);
      ctx.globalAlpha = clamp(strength * (o.wide == null ? .7 : o.wide));
      ctx.drawImage(wide.c, 0, 0, w, h);
      if (o.haze) {
        ctx.globalAlpha = clamp(strength * o.haze);
        ctx.drawImage(wide.c, -w * .02, -h * .02, w * 1.04, h * 1.04);
      }
    }
    ctx.restore();
    return true;
  };

  /* ------------------------------------------------------------------ */
  /* masked fills                                                       */
  /* ------------------------------------------------------------------ */
  /* Draw type with `drawMask(g)`, then paint gradients / texture / light with
     `paintFill(g)` ONLY where the glyphs are (source-atop), then composite.
     This is how metals, gems and foils get real surface shading. */
  Fx.masked = (ctx, w, h, drawMask, paintFill, o = {}) => {
    const A = Fx.scratch('kfx-mask', w, h);
    if (!A) { drawMask(ctx); return false; }
    Fx.syncText(A.g, ctx);
    if (o.setup) o.setup(A.g);
    drawMask(A.g);
    A.g.save();
    A.g.globalCompositeOperation = 'source-atop';
    paintFill(A.g);
    A.g.restore();
    ctx.save();
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    if (o.composite) ctx.globalCompositeOperation = o.composite;
    ctx.drawImage(A.c, 0, 0);
    ctx.restore();
    return true;
  };

  /* ------------------------------------------------------------------ */
  /* additive RGB split                                                 */
  /* ------------------------------------------------------------------ */
  /* True chromatic aberration: three pure-channel copies summed with `lighter`
     so the overlap is white and the fringes are real R / B. `drawAt(g, dx, dy, colour)`
     must draw the type once in `colour`. */
  Fx.chroma = (ctx, drawAt, o = {}) => {
    const dx = o.dx == null ? 2 : o.dx, dy = o.dy || 0;
    const strength = o.strength == null ? 1 : o.strength;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha *= clamp(strength);
    drawAt(ctx, -dx, -dy, o.r || '#ff2a3a');
    drawAt(ctx, 0, 0, o.g || '#22ff88');
    drawAt(ctx, dx, dy, o.b || '#2a6bff');
    ctx.restore();
  };

  /* ------------------------------------------------------------------ */
  /* film grain                                                         */
  /* ------------------------------------------------------------------ */
  let grainPattern;
  function grainTile() {
    if (grainPattern !== undefined) return grainPattern;
    grainPattern = null;
    try {
      const tile = Fx.scratch('kfx-grain-tile', 160, 160);
      if (!tile || typeof tile.g.createImageData !== 'function') return grainPattern;
      const img = tile.g.createImageData(160, 160);
      for (let i = 0; i < 160 * 160; i += 1) {
        const v = Math.floor(Fx.hash(i * .37) * 255);
        img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
      }
      tile.g.putImageData(img, 0, 0);
      /* the pool canvas is reused by name, so keep a private copy */
      const keep = document.createElement('canvas');
      keep.width = 160; keep.height = 160;
      keep.getContext('2d').drawImage(tile.c, 0, 0);
      grainPattern = keep;
    } catch (_) { grainPattern = null; }
    return grainPattern;
  }
  /* Animated grain over a rect; 24 steps/second so it reads as film, not noise. */
  Fx.grain = (ctx, x, y, w, h, time, alpha = .08, blend = 'overlay') => {
    const tile = grainTile();
    if (!tile || !(alpha > 0)) return;
    const pattern = ctx.createPattern ? ctx.createPattern(tile, 'repeat') : null;
    if (!pattern) return;
    const step = Math.floor(time * 24);
    const ox = Math.floor(Fx.hash(step * 1.7) * 160), oy = Math.floor(Fx.hash(step * 2.9 + 4) * 160);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.globalCompositeOperation = blend;
    ctx.globalAlpha *= clamp(alpha);
    ctx.translate(-ox, -oy);
    ctx.fillStyle = pattern;
    ctx.fillRect(x + ox, y + oy, w, h);
    ctx.restore();
  };

  /* ------------------------------------------------------------------ */
  /* text geometry                                                      */
  /* ------------------------------------------------------------------ */
  /* Row boxes for a laid-out block. Call after the effect font is set. */
  Fx.rows = (ctx, lay, w, h, dy = 0) => lay.lines.map((text, index) => {
    const width = ctx.measureText(text).width;
    return { text, width, x: w / 2 - width / 2, y: (h - lay.blockH) / 2 + lay.lineH * (index + .5) + dy, ri: index };
  });
  Fx.bounds = (rows, lay, pad = 0) => {
    const left = Math.min(...rows.map(row => row.x)) - pad;
    const right = Math.max(...rows.map(row => row.x + row.width)) + pad;
    const top = rows[0].y - lay.lineH * .5 - pad;
    const bottom = rows[rows.length - 1].y + lay.lineH * .5 + pad;
    return { x: left, y: top, w: right - left, h: bottom - top, cx: (left + right) / 2, cy: (top + bottom) / 2 };
  };

  /* Redistribute word timing over `tokenCount` tokens when the shown text was
     re-cased / re-split by the lyric studio and no longer matches 1:1. */
  function fitWordCount(words, tokens) {
    if (words.length === tokens.length) return words;
    const t0 = words.length ? words[0].time : 0;
    const t1 = words.length ? words[words.length - 1].endTime : t0 + 2;
    const weight = tokens.map(token => Math.max(1, Array.from(token).length));
    const total = weight.reduce((a, b) => a + b, 0) || 1;
    let cursor = 0;
    return tokens.map((text, index) => {
      const time = t0 + (t1 - t0) * cursor / total;
      cursor += weight[index];
      return { text, time, endTime: Math.max(time + .06, t0 + (t1 - t0) * cursor / total) };
    });
  }

  /* Every word of a laid-out block with exact kerning-aware x, width and timing. */
  Fx.words = (ctx, rows, words) => {
    const tokens = rows.flatMap(row => row.text.split(' ').filter(Boolean));
    const timed = fitWordCount(words || [], tokens);
    const items = [];
    let index = 0;
    rows.forEach(row => {
      let offset = 0;
      row.text.split(' ').forEach(part => {
        if (!part) { offset += 1; return; }
        const before = row.text.slice(0, offset);
        const x = row.x + (before ? ctx.measureText(before).width : 0);
        const width = ctx.measureText(part).width;
        items.push({ text: part, word: timed[index] || { time: 0, endTime: .1 }, x, width, cx: x + width / 2, y: row.y, ri: row.ri, index });
        index += 1;
        offset += part.length + 1;
      });
    });
    return items;
  };

  /* Every glyph of every word with kerning-aware x / width (prefix measuring). */
  Fx.chars = (ctx, items) => {
    const out = [];
    items.forEach(item => {
      const chars = Array.from(item.text);
      let acc = '';
      chars.forEach((ch, j) => {
        const a = acc ? ctx.measureText(acc).width : 0;
        acc += ch;
        const b = ctx.measureText(acc).width;
        out.push({ ch, x: item.x + a, w: b - a, cx: item.x + (a + b) / 2, y: item.y, j, n: chars.length, item });
      });
    });
    return out;
  };

  /* ------------------------------------------------------------------ */
  /* karaoke                                                            */
  /* ------------------------------------------------------------------ */
  /* Per-word soft-edged colour sweep with plain colours: one fillText per word,
     the lit colour travels across exactly word.time..word.endTime. */
  Fx.sung = (ctx, items, time, lit, dim, edge = .3, dy = 0) => {
    items.forEach(item => {
      const p = U.wordProgress(item.word, time, .06).sweep;
      ctx.fillStyle = U.sweepFill(ctx, item.x, item.width, p, lit, dim, edge);
      ctx.fillText(item.text, item.x, item.y + (typeof dy === 'function' ? dy(item) : dy));
    });
  };

  /* Soft per-word reveal for ARBITRARY lit paint (gradients, textures, metals):
     the lit layer is drawn by `paintLit(g)` and revealed word by word through a
     soft horizontal alpha edge. */
  Fx.softReveal = (ctx, w, h, items, time, paintLit, o = {}) => {
    const edge = o.edge == null ? .3 : o.edge;
    const lit = Fx.scratch('kfx-reveal-lit', w, h);
    const matte = Fx.scratch('kfx-reveal-matte', w, h);
    if (!lit || !matte) { paintLit(ctx); return false; }
    Fx.syncText(lit.g, ctx);
    paintLit(lit.g);
    const band = o.band || 1.4;
    items.forEach(item => {
      const p = U.wordProgress(item.word, time, .06).sweep;
      if (p <= 0) return;
      const size = (o.size || 80) * band;
      const g = matte.g;
      if (p >= 1) {
        g.fillStyle = '#000';
        g.fillRect(item.x - size * .1, item.y - size * .6, item.width + size * .2, size * 1.2);
        return;
      }
      const head = item.x + (item.width + item.width * edge) * p;
      const grad = g.createLinearGradient(item.x, 0, item.x + item.width, 0);
      const stop = v => clamp((v - item.x) / Math.max(1, item.width));
      grad.addColorStop(0, '#000');
      grad.addColorStop(stop(head - item.width * edge), '#000');
      grad.addColorStop(stop(head), 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(item.x - size * .1, item.y - size * .6, item.width + size * .2, size * 1.2);
    });
    lit.g.globalCompositeOperation = 'destination-in';
    lit.g.drawImage(matte.c, 0, 0);
    lit.g.globalCompositeOperation = 'source-over';
    ctx.drawImage(lit.c, 0, 0);
    return true;
  };

  /* ------------------------------------------------------------------ */
  /* small drawing helpers                                              */
  /* ------------------------------------------------------------------ */
  /* Copy the text state of the main context onto an offscreen one so paint
     callbacks can draw type with exactly the same font and spacing. */
  Fx.syncText = (to, from) => {
    to.font = from.font;
    to.textAlign = 'left';
    to.textBaseline = 'middle';
    if ('letterSpacing' in from) to.letterSpacing = from.letterSpacing;
    if ('textRendering' in from) to.textRendering = from.textRendering;
    if ('fontKerning' in from) to.fontKerning = from.fontKerning;
  };
  Fx.letterSpacing = (ctx, px) => {
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${px || 0}px`;
  };
  Fx.typeQuality = ctx => {
    if ('textRendering' in ctx) ctx.textRendering = 'geometricPrecision';
    if ('fontKerning' in ctx) ctx.fontKerning = 'normal';
  };
  /* Nearest weight the family really ships. Asking a single-weight display face
     (Anton, Baloo 2, AuraSerif...) for 900 makes the browser fake-bold it, which
     smears counters and ruins hairlines; the real cut always looks better. */
  const weightCache = new Map();
  Fx.fontWeight = (family, wanted) => {
    const key = `${family}|${wanted}`;
    if (weightCache.has(key)) return weightCache.get(key);
    let out = wanted;
    const faces = (window.KEFE_TYPE && window.KEFE_TYPE.fontFaces) || [];
    const weights = Array.from(new Set(faces.filter(f => f.family === family && f.style !== 'italic').map(f => Number(f.weight))));
    if (weights.length) out = weights.reduce((best, value) => (Math.abs(value - wanted) < Math.abs(best - wanted) ? value : best), weights[0]);
    weightCache.set(key, out);
    return out;
  };
  Fx.lineGradient = (ctx, x0, y0, x1, y1, stops) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(([at, color]) => g.addColorStop(clamp(at), color));
    return g;
  };
  Fx.radial = (ctx, x, y, r0, r1, stops) => {
    const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
    stops.forEach(([at, color]) => g.addColorStop(clamp(at), color));
    return g;
  };
})();
