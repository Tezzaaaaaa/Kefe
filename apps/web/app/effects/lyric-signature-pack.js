/* KEFE — Signature LyricFX pack.
   50 effects translated from the supplied KEFE Studio CSS showcase to KEFE's
   shared canvas lyric timeline. Every renderer receives the same
   (ctx, w, h, style, lines, time) contract as the rest of the effect library,
   reads word timing from kefeEffectUtils and therefore stays in sync with the
   preview, export and karaoke timing. */
(() => {
  'use strict';
  const U = window.kefeEffectUtils;
  const E = window.kefeEffects = window.kefeEffects || {};
  if (!U) { console.error('[signature-effects] effects/core.js is required'); return; }

  const clamp = U.clamp;
  const TAU = Math.PI * 2;
  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOutCubic = x => 1 - Math.pow(1 - x, 3);
  const easeInOut = x => x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  const easeOutBack = x => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  };
  const hash = seed => {
    const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return value - Math.floor(value);
  };
  const rgb = hex => {
    const value = String(hex || '').replace('#', '');
    const full = value.length === 3 ? value.split('').map(c => c + c).join('') : value;
    const int = Number.parseInt(full.slice(0, 6), 16);
    return Number.isFinite(int) ? [(int >> 16) & 255, (int >> 8) & 255, int & 255] : [255, 255, 255];
  };
  const rgba = (hex, alpha) => {
    const [r, g, b] = rgb(hex);
    return `rgba(${r},${g},${b},${clamp(alpha)})`;
  };
  const mix = (a, b, t) => {
    const A = rgb(a), B = rgb(b);
    return `rgb(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))})`;
  };
  const contract = key => (window.KEFE_TYPE && window.KEFE_TYPE.effects && window.KEFE_TYPE.effects[key]) || {};
  const setFont = (ctx, key, size, style) => {
    const c = contract(key);
    U.setFont(ctx, c.family || style?.kefeMotionFont || 'Open Sans', size, c.weight || 800);
  };
  const blur = (ctx, px) => {
    try { if ('filter' in ctx) ctx.filter = px > 0 ? `blur(${px}px)` : 'none'; } catch (_) {}
  };
  const glow = (ctx, color, px) => {
    ctx.shadowColor = color;
    ctx.shadowBlur = px;
  };
  const noGlow = ctx => { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; };

  /* ------------------------------------------------------------------ */
  /* layout + timing helpers                                            */
  /* ------------------------------------------------------------------ */

  function makeLayout(ctx, style, text, w, h, opt = {}) {
    const key = style.effect;
    const c = contract(key);
    const family = c.family || style.kefeMotionFont || 'Open Sans';
    const set = (target, size) => U.setFont(target, family, size, c.weight || 800);
    const lay = U.layoutText(ctx, text, {
      setFont: set,
      size: Number(style.fontSize) || 90,
      minSize: opt.minSize || 18,
      maxWidth: w * (opt.width || .88),
      maxHeight: h * (opt.height || .76),
      lineHeight: c.lineHeight || 1.06,
      maxLines: opt.maxLines || 3,
      tracking: c.tracking || 0,
      upper: !!opt.upper,
    });
    set(ctx, lay.size);
    return lay;
  }

  function rowsOf(ctx, lay, w, h) {
    return lay.lines.map((text, index) => {
      const width = ctx.measureText(text).width;
      return { text, width, x: w / 2 - width / 2, y: (h - lay.blockH) / 2 + lay.lineH * (index + .5) };
    });
  }

  function glyphs(ctx, lay, map, time, w, h, opt, fn) {
    lay.lines.forEach((row, ri) => {
      const width = ctx.measureText(row).width;
      const x0 = w / 2 - width / 2;
      const y = (h - lay.blockH) / 2 + lay.lineH * (ri + .5);
      const cells = map[ri] || [];
      if (opt.clipRow) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x0 - lay.size * .12, y - lay.size * .64, width + lay.size * .24, lay.size * 1.28);
        ctx.clip();
      }
      U.eachChar(ctx, row, x0, (ch, ci, x, cw) => {
        if (ch === ' ') return;
        const cell = cells[ci];
        const p = cell ? U.charProgress(cell.word, cell.j, cell.n, time, opt.stagger == null ? .9 : opt.stagger, opt.soft == null ? .33 : opt.soft) : 1;
        const pulse = cell ? U.wordProgress(cell.word, time, .06).pulse : 0;
        fn(ch, x, cw, y, ri, p, cell, pulse);
      });
      if (opt.clipRow) ctx.restore();
    });
  }

  function glyph(ctx, ch, x, width, y, o = {}) {
    ctx.save();
    ctx.globalAlpha *= o.alpha == null ? 1 : o.alpha;
    ctx.translate(x + width / 2 + (o.dx || 0), y + (o.dy || 0));
    if (o.rotate) ctx.rotate(o.rotate);
    ctx.scale(o.scaleX == null ? 1 : o.scaleX, o.scaleY == null ? 1 : o.scaleY);
    if (o.fill) ctx.fillStyle = o.fill;
    if (o.shadow) glow(ctx, o.shadow.color || 'transparent', o.shadow.blur || 0);
    if (o.blurPx) blur(ctx, o.blurPx);
    ctx.fillText(ch, -width / 2, 0);
    ctx.restore();
  }

  function wordsRows(ctx, lay, words, w, h, fn) {
    let wi = 0;
    lay.lines.forEach((row, ri) => {
      const parts = row.split(' ');
      let cursor = w / 2 - ctx.measureText(row).width / 2;
      const y = (h - lay.blockH) / 2 + lay.lineH * (ri + .5);
      parts.forEach((part, pi) => {
        const word = words[wi] || { time: 0, endTime: 0 };
        const width = ctx.measureText(part).width;
        fn({ text: part, word, x: cursor, width, cx: cursor + width / 2, y, ri, index: wi });
        cursor += width + ctx.measureText(' ').width;
        wi += 1;
      });
    });
  }

  function pulseOf(words, time) {
    return (words || []).reduce((max, word) => Math.max(max, U.wordProgress(word, time, .06).pulse), 0);
  }

  function lineScene(ctx, style, lines, time, opt, draw) {
    const stack = U.lineStack(lines, time, .18, .22);
    stack.forEach(item => {
      if (!(item.alpha > .004)) return;
      const text = clean(item.line.text);
      if (!text) return;
      const words = U.wordsFor(item.line, item.next);
      const lay = makeLayout(ctx, style, text, ctx.canvas.width, ctx.canvas.height, opt);
      const map = U.charMap(lay.lines, words);
      ctx.save();
      ctx.globalAlpha *= item.alpha;
      draw({ line: item.line, next: item.next, text, words, lay, map, index: item.index });
      ctx.restore();
    });
  }

  function karaokeRows(ctx, lay, rows, w, h, words, paint, dim) {
    rows.forEach(row => {
      ctx.save();
      ctx.fillStyle = dim || 'rgba(255,255,255,.34)';
      ctx.fillText(row.text, row.x, row.y);
      ctx.restore();
    });
    const p = U.sungProgress(words, timeNow);
    if (p <= 0) return;
    const widest = Math.max(...rows.map(row => row.width));
    const left = w / 2 - widest / 2 - lay.size * .08;
    const top = (h - lay.blockH) / 2 - lay.size * .35;
    const height = lay.blockH + lay.size * .7;
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, (widest + lay.size * .16) * p, height);
    ctx.clip();
    rows.forEach(row => {
      ctx.save();
      ctx.fillStyle = typeof paint === 'function' ? paint(ctx, left, left + widest) : paint;
      ctx.fillText(row.text, row.x, row.y);
      ctx.restore();
    });
    ctx.restore();
  }
  /* karaokeRows needs the current playback time; kept module-local so the
     helper signature stays short. */
  let timeNow = 0;

  function withTime(fn) {
    return (ctx, w, h, style, lines, time) => {
      timeNow = Number(time) || 0;
      noGlow(ctx);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      fn(ctx, w, h, style, lines || [], timeNow);
    };
  }

  const lineLoop = drawLine => withTime((ctx, w, h, style, lines, time) => {
    lineScene(ctx, style, lines, time, {}, drawLine(ctx, w, h, style, time));
  });

  /* ------------------------------------------------------------------ */
  /* 01–09  Kinetic Dynamics                                            */
  /* ------------------------------------------------------------------ */

  E.sigkineticpunch = lineLoop((ctx, w, h, style, time) => ({ words, lay, map }) => {
    const pulse = pulseOf(words, time);
    setFont(ctx, style.effect, lay.size, style);
    glyphs(ctx, lay, map, time, w, h, {}, (ch, x, cw, y, ri, p) => {
      const spread = (x + cw / 2 - w / 2) / Math.max(1, w * .5) * lay.size * .13 * pulse;
      glyph(ctx, ch, x, cw, y, {
        dx: spread, dy: -pulse * lay.size * .05,
        scaleX: 1 + .14 * pulse, scaleY: 1 + .14 * pulse,
        alpha: .38 + .62 * p, fill: '#fff',
        shadow: { color: rgba('#ffffff', .35 * pulse), blur: lay.size * .3 * pulse },
      });
    });
  });

  E.sigelasticslam = lineLoop((ctx, w, h, style, time) => ({ words, lay, map }) => {
    setFont(ctx, style.effect, lay.size, style);
    glyphs(ctx, lay, map, time, w, h, { stagger: 1, soft: .42 }, (ch, x, cw, y, ri, p, cell) => {
      const start = cell ? cell.word.time : 0;
      const local = clamp((time - start) / .42 - (x / Math.max(1, w)) * .12);
      const e = easeOutBack(local);
      glyph(ctx, ch, x, cw, y, {
        dy: -(1 - e) * lay.size * .9, scaleX: 1 + (1 - e) * .2, scaleY: 1 - (1 - e) * .2,
        alpha: (local > 0 ? 1 : .3) * (.42 + .58 * p), fill: '#fff',
      });
    });
  });

  E.siggravitylanding = lineLoop((ctx, w, h, style, time) => ({ words, lay, map }) => {
    setFont(ctx, style.effect, lay.size, style);
    const first = words[0] ? words[0].time : 0;
    const p = clamp((time - first) / .7);
    const e = easeOutCubic(p);
    const landing = pulseOf(words, time);
    const rows = rowsOf(ctx, lay, w, h);
    const squashY = 1 - .24 * landing * (1 - landing) * 4;
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(1 + .1 * landing, squashY);
    ctx.translate(-w / 2, -h / 2 - (1 - e) * h * .34);
    rows.forEach(row => {
      ctx.fillStyle = 'rgba(255,255,255,.42)';
      ctx.fillText(row.text, w / 2 - row.width / 2, row.y);
    });
    ctx.save();
    ctx.beginPath();
    ctx.rect(w / 2 - Math.max(...rows.map(r => r.width)) / 2, (h - lay.blockH) / 2 - lay.size, Math.max(...rows.map(r => r.width)) * U.sungProgress(words, time), lay.blockH + lay.size * 2);
    ctx.clip();
    const paint = ctx.createLinearGradient(0, (h - lay.blockH) / 2, 0, (h + lay.blockH) / 2);
    paint.addColorStop(0, '#fff');
    paint.addColorStop(1, '#c7d2fe');
    rows.forEach(row => { ctx.fillStyle = paint; ctx.fillText(row.text, w / 2 - row.width / 2, row.y); });
    ctx.restore();
    ctx.restore();
  });

  E.sigmagnetrepulse = lineLoop((ctx, w, h, style, time) => ({ words, lay, map }) => {
    setFont(ctx, style.effect, lay.size, style);
    const pulse = pulseOf(words, time);
    glyphs(ctx, lay, map, time, w, h, {}, (ch, x, cw, y, ri, p) => {
      const dir = (x + cw / 2 - w / 2) / Math.max(1, w * .5);
      glyph(ctx, ch, x, cw, y, {
        dx: dir * lay.size * .22 * pulse, dy: -dir * lay.size * .05 * pulse,
        scaleX: 1 + .05 * pulse, scaleY: 1 + .05 * pulse,
        alpha: .4 + .6 * p, fill: mix('#a5b4fc', '#f0abfc', pulse),
        shadow: { color: rgba('#f0abfc', .4 * pulse), blur: lay.size * .22 },
      });
    });
  });

  E.sigwordcascade = lineLoop((ctx, w, h, style, time) => ({ words, lay }) => {
    setFont(ctx, style.effect, lay.size, style);
    wordsRows(ctx, lay, words, w, h, item => {
      const enter = clamp((time - item.word.time) / .4);
      const flip = Math.cos((1 - enter) * Math.PI / 2);
      ctx.save();
      ctx.globalAlpha *= .25 + .75 * enter;
      ctx.translate(item.cx, item.y - (1 - enter) * lay.size * .35);
      ctx.scale(1, Math.max(.02, flip));
      if (enter < .98) blur(ctx, (1 - enter) * 3.5);
      ctx.fillStyle = item.index % 2 ? '#c4b5fd' : '#fff';
      glow(ctx, rgba('#8b5cf6', .35 * enter), lay.size * .2);
      ctx.fillText(item.text, -item.width / 2, 0);
      ctx.restore();
    });
  });

  E.sigmarqueerail = lineLoop((ctx, w, h, style, time) => ({ text, words, lay, next }) => {
    setFont(ctx, style.effect, lay.size, style);
    const unit = text + '  ·  ';
    const width = ctx.measureText(unit).width;
    const offset = (time * 90) % Math.max(1, width);
    const rows = rowsOf(ctx, lay, w, h);
    const y = rows[0].y;
    const p = U.sungProgress(words, time);
    ctx.save();
    ctx.beginPath();
    ctx.rect(w * .05, y - lay.size, w * .9, lay.size * 2);
    ctx.clip();
    for (let copy = -1; copy <= Math.ceil(w / width) + 1; copy += 1) {
      const startX = w / 2 - width / 2 - offset + copy * width;
      ctx.fillStyle = 'rgba(255,255,255,.22)';
      ctx.fillText(unit, startX, y);
      ctx.save();
      ctx.beginPath();
      ctx.rect(startX, y - lay.size, width * p, lay.size * 2);
      ctx.clip();
      ctx.fillStyle = '#e5e7eb';
      ctx.fillText(unit, startX, y);
      ctx.restore();
    }
    ctx.restore();
  });

  E.sigslotroll = lineLoop((ctx, w, h, style, time) => ({ words, lay, map }) => {
    setFont(ctx, style.effect, lay.size, style);
    glyphs(ctx, lay, map, time, w, h, { clipRow: true }, (ch, x, cw, y, ri, p, cell) => {
      const step = Math.floor((((time * 1.25) + x * .0015) % 1) * 8) / 8;
      const offset = (step - .5) * lay.size * 1.35;
      glyph(ctx, ch, x, cw, y, {
        dy: offset, scaleY: .86, alpha: (1 - Math.abs(step - .5) * 1.2) * (.35 + .65 * p),
        fill: '#fde68a', shadow: { color: rgba('#fbbf24', .35), blur: lay.size * .18 },
      });
    });
  });

  E.sigstompbeat = lineLoop((ctx, w, h, style, time) => ({ words, lay }) => {
    setFont(ctx, style.effect, lay.size, style);
    wordsRows(ctx, lay, words, w, h, item => {
      const pulse = U.wordProgress(item.word, time, .05).pulse;
      ctx.save();
      ctx.translate(item.cx, item.y - pulse * lay.size * .06);
      ctx.rotate(-.045 * pulse);
      ctx.scale(1 + .24 * pulse, 1 + .24 * pulse);
      ctx.globalAlpha *= .4 + .6 * (time >= item.word.time ? 1 : .4);
      ctx.fillStyle = mix('#ffffff', '#fca5a5', pulse);
      glow(ctx, rgba('#ef4444', .3 * pulse), lay.size * .22);
      ctx.fillText(item.text, -item.width / 2, 0);
      ctx.restore();
    });
  });

  E.sigrubberstretch = lineLoop((ctx, w, h, style, time) => ({ words, lay, map }) => {
    setFont(ctx, style.effect, lay.size, style);
    glyphs(ctx, lay, map, time, w, h, {}, (ch, x, cw, y, ri, p) => {
      const phase = time * 3.4 + x * .02;
      const sx = 1 + .32 * Math.sin(phase);
      const sy = 1 - .22 * Math.sin(phase);
      glyph(ctx, ch, x, cw, y, {
        scaleX: sx, scaleY: sy, dy: Math.sin(phase + 1.2) * lay.size * .08,
        alpha: .42 + .58 * p, fill: '#fff',
      });
    });
  });

  /* ------------------------------------------------------------------ */
  /* 10–18  Glow Shaders                                                */
  /* ------------------------------------------------------------------ */

  E.signeonatmosphere = lineLoop((ctx, w, h, style, time) => ({ words, lay, map }) => {
    setFont(ctx, style.effect, lay.size, style);
    const breathe = .5 + .5 * Math.sin(time * 2.1);
    glyphs(ctx, lay, map, time, w, h, {}, (ch, x, cw, y, ri, p) => {
      glyph(ctx, ch, x, cw, y, {
        alpha: .4 + .6 * p, fill: '#a5b4fc',
        shadow: { color: rgba('#6366f1', .55 + .4 * breathe), blur: lay.size * (.18 + .22 * breathe) },
      });
    });
  });

  E.sigtubeignition = lineLoop((ctx, w, h, style, time) => ({ words, lay }) => {
    setFont(ctx, style.effect, lay.size, style);
    const cycle = time % 3.2;
    let power = 1;
    if (cycle < .8) {
      const n = hash(Math.floor(cycle * 28) + 3);
      power = n > .55 ? 1 : n > .2 ? .18 : .04;
    }
    const rows = rowsOf(ctx, lay, w, h);
    ctx.save();
    ctx.globalAlpha *= power;
    rows.forEach(row => {
      ctx.fillStyle = '#e0f2fe';
      glow(ctx, '#38bdf8', lay.size * .42);
      ctx.fillText(row.text, row.x, row.y);
    });
    ctx.restore();
    const p = U.sungProgress(words, time) * .35;
    if (p > 0 && power > .1) {
      ctx.save();
      ctx.globalAlpha *= .3 * power;
      rows.forEach(row => {
        ctx.fillStyle = '#7dd3fc';
        glow(ctx, '#0ea5e9', lay.size * .5);
        ctx.fillText(row.text, row.x, row.y);
      });
      ctx.restore();
    }
  });

  E.sighalobloom = lineLoop((ctx, w, h, style, time) => ({ words, lay }) => {
    setFont(ctx, style.effect, lay.size, style);
    const rows = rowsOf(ctx, lay, w, h);
    const widest = Math.max(...rows.map(row => row.width));
    const cx = w / 2, cy = rows.reduce((sum, row) => sum + row.y, 0) / rows.length;
    for (let ring = 0; ring < 2; ring += 1) {
      const phase = ((time / 2.6) + ring * .5) % 1;
      ctx.save();
      ctx.globalAlpha *= (1 - phase) * .8;
      ctx.strokeStyle = 'rgba(255,255,255,.75)';
      ctx.lineWidth = Math.max(1, lay.size * .012);
      glow(ctx, 'rgba(255,255,255,.35)', lay.size * .18);
      ctx.beginPath();
      ctx.ellipse(cx, cy, (widest * .5 + lay.size * .5) * (.55 + phase), (lay.blockH * .5 + lay.size * .45) * (.55 + phase), 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    rows.forEach(row => {
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,.38)';
      ctx.fillText(row.text, row.x, row.y);
      ctx.restore();
    });
    ctx.save();
    ctx.beginPath();
    ctx.rect(w / 2 - widest / 2, (h - lay.blockH) / 2 - lay.size * .3, widest * U.sungProgress(words, time), lay.blockH + lay.size * .6);
    ctx.clip();
    rows.forEach(row => {
      ctx.fillStyle = '#fff';
      glow(ctx, 'rgba(255,255,255,.5)', lay.size * .24);
      ctx.fillText(row.text, row.x, row.y);
    });
    ctx.restore();
  });

  E.sigemberrise = lineLoop((ctx, w, h, style, time) => ({ words, lay }) => {
    setFont(ctx, style.effect, lay.size, style);
    const rows = rowsOf(ctx, lay, w, h);
    const phase = .5 + .5 * Math.sin(time * 1.5);
    for (let i = 0; i < 16; i += 1) {
      const seed = i + 11;
      const life = ((time * (.35 + hash(seed) * .3)) + hash(seed + 2)) % 1;
      const px = w / 2 + (hash(seed + 4) - .5) * w * .55;
      const py = (h - lay.blockH) / 2 + lay.blockH * (.6 - life * .9);
      ctx.save();
      ctx.globalAlpha *= (1 - life) * .5;
      ctx.fillStyle = '#fb923c';
      glow(ctx, '#f97316', lay.size * .12);
      ctx.beginPath();
      ctx.arc(px, py, Math.max(.6, lay.size * .014 * (1 - life * .5)), 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    rows.forEach(row => {
      ctx.save();
      ctx.globalAlpha *= .55 + .45 * phase;
      ctx.fillStyle = '#fdba74';
      glow(ctx, rgba('#f97316', .55), lay.size * .32);
      ctx.fillText(row.text, row.x, row.y - phase * lay.size * .08);
      ctx.restore();
    });
    karaokeRows(ctx, lay, rows, w, h, words, () => '#fff7ed');
  });

  E.sigultraviolet = lineLoop((ctx, w, h, style, time) => ({ words, lay }) => {
    setFont(ctx, style.effect, lay.size, style);
    const rows = rowsOf(ctx, lay, w, h);
    const hue = (time * 42) % 360;
    const breathe = .5 + .5 * Math.sin(time * 1.7);
    rows.forEach(row => {
      ctx.save();
      ctx.fillStyle = 'rgba(233,213,255,.35)';
      ctx.fillText(row.text, row.x, row.y);
      ctx.restore();
    });
    const p = U.sungProgress(words, time);
    const widest = Math.max(...rows.map(row => row.width));
    ctx.save();
    ctx.beginPath();
    ctx.rect(w / 2 - widest / 2, (h - lay.blockH) / 2 - lay.size * .3, widest * p, lay.blockH + lay.size * .6);
    ctx.clip();
    rows.forEach(row => {
      ctx.fillStyle = `hsl(${hue} 70% 80%)`;
      glow(ctx, `hsl(${(hue + 40) % 360} 90% 60%)`, lay.size * (.2 + .2 * breathe));
      ctx.fillText(row.text, row.x, row.y);
    });
    ctx.restore();
  });

  E.sigphosphor = lineLoop((ctx, w, h, style, time) => ({ words, lay }) => {
    setFont(ctx, style.effect, lay.size, style);
    const rows = rowsOf(ctx, lay, w, h);
    const drift = lay.size * .07 * Math.sin(time * 1.6);
    const draw = (dx, color, alphaValue) => rows.forEach(row => {
      ctx.save();
      ctx.globalAlpha *= alphaValue;
      ctx.fillStyle = color;
      glow(ctx, color, lay.size * .24);
      ctx.fillText(row.text, row.x + dx, row.y);
      ctx.restore();
    });
    draw(-lay.size * .05 - drift, '#10b981', .85);
    draw(lay.size * .05 + drift, '#38bdf8', .85);
    const p = U.sungProgress(words, time);
    const widest = Math.max(...rows.map(row => row.width));
    ctx.save();
    ctx.beginPath();
    ctx.rect(w / 2 - widest / 2, (h - lay.blockH) / 2 - lay.size * .3, widest * p, lay.blockH + lay.size * .6);
    ctx.clip();
    rows.forEach(row => { ctx.fillStyle = '#ecfeff'; ctx.fillText(row.text, row.x, row.y); });
    ctx.restore();
  });

  E.sigspotlight = lineLoop((ctx, w, h, style, time) => ({ words, lay }) => {
    setFont(ctx, style.effect, lay.size, style);
    const rows = rowsOf(ctx, lay, w, h);
    const widest = Math.max(...rows.map(row => row.width));
    const head = (time * .45) % 1;
    const paint = (ctx, left, right) => {
      const g = ctx.createLinearGradient(left, 0, right, 0);
      g.addColorStop(0, '#6b7280');
      g.addColorStop(clamp(head - .18), '#6b7280');
      g.addColorStop(clamp(head), '#ffffff');
      g.addColorStop(clamp(head + .18), '#6b7280');
      g.addColorStop(1, '#6b7280');
      return g;
    };
    rows.forEach(row => { ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillText(row.text, row.x, row.y); });
    const p = U.sungProgress(words, time);
    ctx.save();
    ctx.beginPath();
    ctx.rect(w / 2 - widest / 2, (h - lay.blockH) / 2 - lay.size * .3, widest * p, lay.blockH + lay.size * .6);
    ctx.clip();
    rows.forEach(row => {
      ctx.fillStyle = paint(ctx, w / 2 - widest / 2, w / 2 + widest / 2);
      ctx.fillText(row.text, row.x, row.y);
    });
    ctx.restore();
  });

  E.sigaurorawash = lineLoop((ctx, w, h, style, time) => ({ words, lay }) => {
    setFont(ctx, style.effect, lay.size, style);
    const rows = rowsOf(ctx, lay, w, h);
    const widest = Math.max(...rows.map(row => row.width));
    const cx = w / 2, cy = rows.reduce((sum, row) => sum + row.y, 0) / rows.length;
    const colors = ['#22d3ee', '#a78bfa', '#f472b6', '#34d399'];
    ctx.save();
    blur(ctx, Math.max(8, lay.size * .32));
    for (let i = 0; i < 4; i += 1) {
      const angle = time * .55 + i * TAU / 4;
      const radius = widest * .38;
      ctx.globalAlpha *= .3;
      ctx.fillStyle = colors[i];
      ctx.beginPath();
      ctx.arc(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius * .42, widest * .3, 0, TAU);
      ctx.fill();
      ctx.globalAlpha /= .3;
    }
    ctx.restore();
    rows.forEach(row => { ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillText(row.text, row.x, row.y); });
    const p = U.sungProgress(words, time);
    ctx.save();
    ctx.beginPath();
    ctx.rect(w / 2 - widest / 2, (h - lay.blockH) / 2 - lay.size * .3, widest * p, lay.blockH + lay.size * .6);
    ctx.clip();
    rows.forEach(row => {
      ctx.fillStyle = '#fff';
      glow(ctx, 'rgba(167,139,250,.6)', lay.size * .26);
      ctx.fillText(row.text, row.x, row.y);
    });
    ctx.restore();
  });

  E.sigcandleflicker = lineLoop((ctx, w, h, style, time) => ({ words, lay }) => {
    setFont(ctx, style.effect, lay.size, style);
    const rows = rowsOf(ctx, lay, w, h);
    const n = Math.sin(time * 13.7) * Math.sin(time * 5.3 + 1.4) + Math.sin(time * 29.1) * .35;
    const flicker = clamp(.82 + n * .18, .45, 1);
    rows.forEach(row => {
      ctx.save();
      ctx.globalAlpha *= flicker;
      ctx.fillStyle = '#fef3c7';
      glow(ctx, '#f59e0b', lay.size * (.18 + .14 * flicker));
      ctx.fillText(row.text, row.x, row.y + Math.sin(time * 9.1) * lay.size * .012);
      ctx.restore();
    });
    karaokeRows(ctx, lay, rows, w, h, words, () => '#fffbeb');
  });

  /* ------------------------------------------------------------------ */
  /* 19–26  Cyber Networks                                              */
  /* ------------------------------------------------------------------ */

  E.sigterminalglitch = withTime((ctx, w, h, style, lines, time) => {
    lineScene(ctx, style, lines, time, { upper: true }, ({ words, lay }) => {
      setFont(ctx, style.effect, lay.size, style);
      const rows = rowsOf(ctx, lay, w, h);
      const jx = Math.sin(time * 23) * lay.size * .02;
      const jy = Math.cos(time * 17) * lay.size * .012;
      const widest = Math.max(...rows.map(row => row.width));
      const left = w / 2 - widest / 2, top = (h - lay.blockH) / 2 - lay.size * .2;
      const bracket = lay.size * .3;
      ctx.save();
      ctx.strokeStyle = 'rgba(52,211,153,.9)';
      ctx.lineWidth = Math.max(2, lay.size * .02);
      ctx.strokeRect(left - lay.size * .5 + jx, top, bracket, lay.blockH + lay.size * .4);
      ctx.strokeRect(left + widest + lay.size * .5 + jx - bracket, top, bracket, lay.blockH + lay.size * .4);
      ctx.restore();
      rows.forEach(row => {
        ctx.save();
        ctx.globalAlpha *= .85;
        ctx.fillStyle = 'rgba(239,68,68,.75)';
        ctx.fillText(row.text, row.x - lay.size * .018 + jx, row.y + jy);
        ctx.fillStyle = 'rgba(6,182,212,.75)';
        ctx.fillText(row.text, row.x + lay.size * .018 + jx, row.y + jy);
        ctx.fillStyle = '#34d399';
        glow(ctx, '#34d399', lay.size * .16);
        ctx.fillText(row.text, row.x + jx, row.y);
        ctx.restore();
      });
      karaokeRows(ctx, lay, rows, w, h, words, () => '#bbf7d0');
    });
  });

  E.sigvhstracking = withTime((ctx, w, h, style, lines, time) => {
    lineScene(ctx, style, lines, time, { upper: true }, ({ words, lay }) => {
      setFont(ctx, style.effect, lay.size, style);
      const rows = rowsOf(ctx, lay, w, h);
      const step = Math.floor(time * 6) % 3;
      const skew = [0, -.06, .045][step];
      const dy = [0, -lay.size * .03, lay.size * .015][step];
      const widest = Math.max(...rows.map(row => row.width));
      ctx.save();
      ctx.transform(1, 0, skew, 1, 0, 0);
      rows.forEach(row => {
        ctx.save();
        ctx.globalAlpha *= .8;
        ctx.fillStyle = 'rgba(239,68,68,.8)';
        ctx.fillText(row.text, row.x + lay.size * .03, row.y + dy);
        ctx.fillStyle = 'rgba(34,211,238,.8)';
        ctx.fillText(row.text, row.x - lay.size * .03, row.y + dy);
        ctx.fillStyle = '#e4e4e7';
        ctx.fillText(row.text, row.x, row.y + dy);
        ctx.restore();
      });
      ctx.restore();
      ctx.save();
      ctx.globalAlpha *= .22;
      ctx.fillStyle = '#fff';
      const scanTop = (h - lay.blockH) / 2 - lay.size * .3;
      for (let y = scanTop + (time * 16) % 4; y < scanTop + lay.blockH + lay.size * .6; y += 4) ctx.fillRect(w / 2 - widest / 2, y, widest, 1);
      ctx.restore();
      karaokeRows(ctx, lay, rows, w, h, words, () => '#fafafa');
    });
  });

  E.sigdatacorrupt = withTime((ctx, w, h, style, lines, time) => {
    lineScene(ctx, style, lines, time, { upper: true }, ({ words, lay }) => {
      setFont(ctx, style.effect, lay.size, style);
      const rows = rowsOf(ctx, lay, w, h);
      const widest = Math.max(...rows.map(row => row.width));
      const left = w / 2 - widest / 2;
      const box = { x: left - lay.size * .35, y: (h - lay.blockH) / 2 - lay.size * .25, w: widest + lay.size * .7, h: lay.blockH + lay.size * .5 };
      ctx.save();
      ctx.fillStyle = '#22d3ee';
      ctx.fillRect(box.x, box.y, box.w, box.h);
      ctx.restore();
      const drawText = color => rows.forEach(row => { ctx.fillStyle = color; ctx.fillText(row.text, row.x, row.y); });
      drawText('#08080b');
      for (let band = 0; band < 3; band += 1) {
        const seed = Math.floor(time * 4) + band * 9;
        const hgt = box.h * (.08 + hash(seed) * .18);
        const top = box.y + hash(seed + 1) * (box.h - hgt);
        const shift = (hash(seed + 3) - .5) * lay.size * .3;
        ctx.save();
        ctx.beginPath();
        ctx.rect(box.x, top, box.w, hgt);
        ctx.clip();
        ctx.globalAlpha *= .8;
        rows.forEach(row => {
          ctx.fillStyle = band % 2 ? 'rgba(244,63,94,.9)' : 'rgba(56,189,248,.9)';
          ctx.fillText(row.text, row.x + shift, row.y);
        });
        ctx.restore();
      }
      karaokeRows(ctx, lay, rows, w, h, words, () => 'rgba(8,8,11,.85)');
    });
  });

  E.sigcathodescan = withTime((ctx, w, h, style, lines, time) => {
    lineScene(ctx, style, lines, time, { upper: true }, ({ words, lay }) => {
      setFont(ctx, style.effect, lay.size, style);
      const rows = rowsOf(ctx, lay, w, h);
      const flicker = .82 + .18 * Math.sin(time * 47);
      rows.forEach(row => {
        ctx.save();
        ctx.globalAlpha *= flicker;
        ctx.fillStyle = '#86efac';
        glow(ctx, '#4ade80', lay.size * .3);
        ctx.fillText(row.text, row.x, row.y);
        ctx.restore();
      });
      const top = (h - lay.blockH) / 2 - lay.size * .3, height = lay.blockH + lay.size * .6;
      const widest = Math.max(...rows.map(row => row.width));
      ctx.save();
      ctx.globalAlpha *= .28;
      ctx.fillStyle = '#000';
      for (let y = top + (time * 12) % 4; y < top + height; y += 4) ctx.fillRect(w / 2 - widest / 2, y, widest, 2);
      ctx.restore();
      karaokeRows(ctx, lay, rows, w, h, words, () => '#dcfce7');
    });
  });

  E.sigcamcorder = withTime((ctx, w, h, style, lines, time) => {
    lineScene(ctx, style, lines, time, { upper: true }, ({ words, lay }) => {
      setFont(ctx, style.effect, lay.size, style);
      const rows = rowsOf(ctx, lay, w, h);
      const widest = Math.max(...rows.map(row => row.width));
      const top = (h - lay.blockH) / 2 - lay.size * .55;
      const box = { x: w / 2 - widest / 2 - lay.size * .45, y: top, w: widest + lay.size * .9, h: lay.blockH + lay.size * 1.1 };
      const jitter = Math.sin(time * 31) * .6;
      ctx.save();
      ctx.translate(jitter, Math.cos(time * 27) * .6);
      ctx.strokeStyle = 'rgba(248,250,252,.6)';
      ctx.lineWidth = Math.max(1, lay.size * .012);
      ctx.strokeRect(box.x, box.y, box.w, box.h);
      ctx.restore();
      rows.forEach(row => { ctx.fillStyle = '#f8fafc'; ctx.fillText(row.text, row.x, row.y); });
      ctx.save();
      ctx.fillStyle = '#f87171';
      ctx.globalAlpha *= (Math.floor(time) % 2 === 0) ? 1 : .15;
      const dot = lay.size * .07;
      ctx.beginPath();
      ctx.arc(box.x + dot, box.y - lay.size * .3, dot, 0, TAU);
      ctx.fill();
      ctx.font = `${Math.max(10, lay.size * .16)}px "VT323", monospace`;
      ctx.fillText('REC', box.x + dot * 2.6, box.y - lay.size * .3);
      ctx.globalAlpha *= 1;
      ctx.fillStyle = 'rgba(248,250,252,.85)';
      const clock = `00:04:${String(Math.floor(time) % 60).padStart(2, '0')}`;
      ctx.fillText(clock, box.x + box.w - ctx.measureText(clock).width, box.y + box.h + lay.size * .34);
      ctx.restore();
      karaokeRows(ctx, lay, rows, w, h, words, () => '#ffffff');
    });
  });

  E.sighexrain = withTime((ctx, w, h, style, lines, time) => {
    lineScene(ctx, style, lines, time, { upper: true }, ({ words, lay }) => {
      setFont(ctx, style.effect, lay.size, style);
      const rows = rowsOf(ctx, lay, w, h);
      const widest = Math.max(...rows.map(row => row.width));
      const top = (h - lay.blockH) / 2 - lay.size * .5;
      const height = lay.blockH + lay.size;
      ctx.save();
      ctx.beginPath();
      ctx.rect(w / 2 - widest / 2 - lay.size * .2, top, widest + lay.size * .4, height);
      ctx.clip();
      ctx.font = `${Math.max(9, lay.size * .2)}px "VT323", monospace`;
      ctx.fillStyle = 'rgba(168,85,247,.45)';
      for (let col = 0; col < 7; col += 1) {
        const x = w / 2 + (col - 3) * lay.size * .42;
        for (let row = 0; row < 12; row += 1) {
          const byte = Math.floor(hash(col * 31 + row * 7 + Math.floor(time * 8 + col)) * 255).toString(16).padStart(2, '0').toUpperCase();
          const y = top + ((row * lay.size * .42 + time * lay.size * .9 + col * 37) % height);
          ctx.fillText(byte, x, y);
        }
      }
      ctx.restore();
      rows.forEach(row => {
        ctx.save();
        ctx.fillStyle = '#e9d5ff';
        glow(ctx, '#a855f7', lay.size * .32);
        ctx.fillText(row.text, row.x, row.y);
        ctx.restore();
      });
      karaokeRows(ctx, lay, rows, w, h, words, () => '#faf5ff');
    });
  });

  E.sigsignalloss = withTime((ctx, w, h, style, lines, time) => {
    lineScene(ctx, style, lines, time, { upper: true }, ({ words, lay }) => {
      setFont(ctx, style.effect, lay.size, style);
      const rows = rowsOf(ctx, lay, w, h);
      const widest = Math.max(...rows.map(row => row.width));
      const top = (h - lay.blockH) / 2 - lay.size * .3;
      const height = lay.blockH + lay.size * .6;
      const draw = (dx, color, alphaValue) => rows.forEach(row => {
        ctx.save();
        ctx.globalAlpha *= alphaValue;
        ctx.fillStyle = color;
        ctx.fillText(row.text, row.x + dx, row.y);
        ctx.restore();
      });
      draw(-lay.size * .025, '#f43f5e', .8);
      draw(lay.size * .025, '#22d3ee', .8);
      rows.forEach(row => { ctx.fillStyle = 'rgba(241,245,249,.35)'; ctx.fillText(row.text, row.x, row.y); });
      for (let band = 0; band < 4; band += 1) {
        const seed = Math.floor(time * 3.5) + band * 13;
        const hgt = height * (.08 + hash(seed) * .2);
        const bandTop = top + hash(seed + 2) * (height - hgt);
        const shift = (hash(seed + 5) - .5) * lay.size * .22;
        ctx.save();
        ctx.beginPath();
        ctx.rect(w / 2 - widest / 2, bandTop, widest, hgt);
        ctx.clip();
        rows.forEach(row => { ctx.fillStyle = '#f1f5f9'; ctx.fillText(row.text, row.x + shift, row.y); });
        ctx.restore();
      }
      ctx.save();
      ctx.globalAlpha *= .25;
      ctx.fillStyle = '#fff';
      for (let line = 0; line < 3; line += 1) ctx.fillRect(w / 2 - widest / 2, top + hash(Math.floor(time * 6) + line) * height, widest, 1);
      ctx.restore();
      karaokeRows(ctx, lay, rows, w, h, words, () => '#ffffff');
    });
  });

  E.sigbitcrush = lineLoop((ctx, w, h, style, time) => ({ words, lay, map }) => {
    setFont(ctx, style.effect, lay.size, style);
    glyphs(ctx, lay, map, time, w, h, {}, (ch, x, cw, y, ri, p) => {
      const step = Math.floor(time * 14 + (x / Math.max(1, w)) * 6) % 3;
      const dx = step === 1 ? lay.size * .035 : step === 2 ? -lay.size * .035 : 0;
      const dy = step === 1 ? -lay.size * .035 : step === 2 ? lay.size * .035 : 0;
      glyph(ctx, ch, x, cw, y, { dx: dx + lay.size * .02, dy, alpha: .45 + .55 * p, fill: '#ef4444' });
      glyph(ctx, ch, x, cw, y, { dx: dx - lay.size * .02, dy: -dy, alpha: .45 + .55 * p, fill: '#3b82f6' });
      glyph(ctx, ch, x, cw, y, {
        dx, dy, fill: '#facc15', shadow: { color: 'rgba(250,204,21,.4)', blur: lay.size * .14 },
        scaleX: step === 1 ? 1.04 : step === 2 ? .97 : 1, alpha: .5 + .5 * p,
      });
    });
  });

  /* ------------------------------------------------------------------ */
  /* 27–34  Rare Gem Treatments                                         */
  /* ------------------------------------------------------------------ */

  const gradientRows = (stops, speed, glowColor) => lineLoop((ctx, w, h, style, time) => ({ words, lay }) => {
    setFont(ctx, style.effect, lay.size, style);
    const rows = rowsOf(ctx, lay, w, h);
    const widest = Math.max(...rows.map(row => row.width));
    const left = w / 2 - widest / 2, right = w / 2 + widest / 2;
    const shift = (time * speed) % 1;
    const paint = () => {
      const g = ctx.createLinearGradient(left, (h - lay.blockH) / 2, right, (h + lay.blockH) / 2);
      stops.forEach(([stop, color], index) => {
        g.addColorStop(clamp(stop + shift * .25 * (index % 2 ? -1 : 1)), color);
        g.addColorStop(clamp(stop + shift * .25 * (index % 2 ? -1 : 1) + .0001), color);
      });
      return g;
    };
    rows.forEach(row => { ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillText(row.text, row.x, row.y); });
    const p = U.sungProgress(words, time);
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, (h - lay.blockH) / 2 - lay.size * .3, widest * p, lay.blockH + lay.size * .6);
    ctx.clip();
    rows.forEach(row => {
      ctx.fillStyle = paint();
      glow(ctx, glowColor, lay.size * .24);
      ctx.fillText(row.text, row.x, row.y);
    });
    ctx.restore();
  });

  E.sigiridescent = gradientRows([
    [0, '#fbbf24'], [.2, '#ec4899'], [.4, '#8b5cf6'], [.6, '#38bdf8'], [.8, '#34d399'], [1, '#fbbf24'],
  ], .35, 'rgba(236,72,153,.45)');

  E.siggoldfoil = gradientRows([
    [0, '#78350f'], [.24, '#f59e0b'], [.42, '#fde68a'], [.5, '#fffbeb'], [.58, '#fbbf24'], [.78, '#b45309'], [1, '#451a03'],
  ], .5, 'rgba(245,158,11,.5)');

  E.sigchromemetal = gradientRows([
    [0, '#27272a'], [.22, '#a1a1aa'], [.38, '#ffffff'], [.48, '#d4d4d8'], [.62, '#52525b'], [.82, '#f4f4f5'], [1, '#3f3f46'],
  ], .6, 'rgba(255,255,255,.25)');

  E.sigprismsplit = lineLoop((ctx, w, h, style, time) => ({ words, lay }) => {
    setFont(ctx, style.effect, lay.size, style);
    const rows = rowsOf(ctx, lay, w, h);
    const phase = .5 + .5 * Math.sin(time * 1.6);
    const spread = lay.size * .42 * phase;
    const draw = (dx, color, alphaValue) => rows.forEach(row => {
      ctx.save();
      ctx.globalAlpha *= alphaValue;
      ctx.fillStyle = color;
      ctx.fillText(row.text, row.x + dx, row.y);
      ctx.restore();
    });
    draw(-spread, '#f43f5e', .8);
    draw(spread, '#22d3ee', .8);
    const widest = Math.max(...rows.map(row => row.width));
    ctx.save();
    ctx.beginPath();
    ctx.rect(w / 2 - widest / 2, (h - lay.blockH) / 2 - lay.size * .3, widest * U.sungProgress(words, time), lay.blockH + lay.size * .6);
    ctx.clip();
    rows.forEach(row => {
      ctx.fillStyle = '#fff';
      glow(ctx, 'rgba(255,255,255,.5)', lay.size * .3);
      ctx.fillText(row.text, row.x, row.y);
    });
    ctx.restore();
  });

  E.sigdiamondfacet = lineLoop((ctx, w, h, style, time) => ({ words, lay }) => {
    setFont(ctx, style.effect, lay.size, style);
    const rows = rowsOf(ctx, lay, w, h);
    const sparkle = .5 + .5 * Math.sin(time * 2.4);
    const widest = Math.max(...rows.map(row => row.width));
    rows.forEach(row => {
      ctx.save();
      ctx.globalAlpha *= .9;
      ctx.fillStyle = '#64748b';
      ctx.fillText(row.text, row.x + lay.size * .018, row.y + lay.size * .018);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(row.text, row.x - lay.size * .012, row.y - lay.size * .012);
      ctx.fillStyle = '#ffffff';
      glow(ctx, 'rgba(226,232,240,.55)', lay.size * (.16 + .14 * sparkle));
      ctx.fillText(row.text, row.x, row.y);
      ctx.restore();
    });
    ctx.save();
    ctx.globalAlpha *= .5 + .5 * sparkle;
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 8; i += 1) {
      const seed = i + 21;
      ctx.beginPath();
      ctx.arc(w / 2 - widest / 2 + hash(seed) * widest, (h - lay.blockH) / 2 - lay.size * .2 + hash(seed + 3) * (lay.blockH + lay.size * .4), Math.max(.8, lay.size * .012), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    karaokeRows(ctx, lay, rows, w, h, words, () => '#ffffff');
  });

  E.sigrosequartz = gradientRows([
    [0, '#fbcfe8'], [.3, '#fda4af'], [.55, '#f9a8d4'], [.8, '#fecdd3'], [1, '#fbcfe8'],
  ], .3, 'rgba(244,114,182,.5)');

  E.sigobsidian = lineLoop((ctx, w, h, style, time) => ({ words, lay }) => {
    setFont(ctx, style.effect, lay.size, style);
    const rows = rowsOf(ctx, lay, w, h);
    const shimmer = .5 + .5 * Math.sin(time * 1.9);
    const paint = ctx.createLinearGradient(0, (h - lay.blockH) / 2, 0, (h + lay.blockH) / 2);
    paint.addColorStop(0, '#17171d');
    paint.addColorStop(.5, '#0b0b0f');
    paint.addColorStop(1, '#24242b');
    rows.forEach(row => {
      ctx.save();
      ctx.fillStyle = paint;
      ctx.fillText(row.text, row.x, row.y);
      ctx.lineWidth = Math.max(1, lay.size * .012);
      ctx.strokeStyle = `rgba(255,255,255,${.45 + .4 * shimmer})`;
      ctx.strokeText(row.text, row.x, row.y);
      ctx.restore();
    });
    if (shimmer > .6) {
      ctx.save();
      ctx.globalAlpha *= (shimmer - .6) * 1.4;
      ctx.strokeStyle = 'rgba(226,232,240,.9)';
      ctx.lineWidth = Math.max(1, lay.size * .01);
      rows.forEach(row => ctx.strokeText(row.text, row.x - lay.size * .006, row.y - lay.size * .006));
      ctx.restore();
    }
    karaokeRows(ctx, lay, rows, w, h, words, () => 'rgba(255,255,255,.92)');
  });

  E.sigsodalite = gradientRows([
    [0, '#1e3a8a'], [.25, '#3b82f6'], [.5, '#93c5fd'], [.75, '#1d4ed8'], [1, '#1e3a8a'],
  ], .28, 'rgba(59,130,246,.6)');

  /* ------------------------------------------------------------------ */
  /* 35–42  Liquid & Organic                                            */
  /* ------------------------------------------------------------------ */

  E.sigmetaball = lineLoop((ctx, w, h, style, time) => ({ words, lay, map }) => {
    setFont(ctx, style.effect, lay.size, style);
    glyphs(ctx, lay, map, time, w, h, { stagger: 1, soft: .5 }, (ch, x, cw, y, ri, p, cell) => {
      const phase = time * 2.4 + x * .012;
      const wobble = Math.sin(phase) * .5 + .5;
      glyph(ctx, ch, x, cw, y, {
        dy: -wobble * lay.size * .07, scaleX: .98 + wobble * .12, scaleY: .98 + wobble * .12,
        alpha: (.35 + .65 * p) * .95, fill: 'rgba(255,255,255,.92)',
        blurPx: .8 + wobble * 1.6,
        shadow: { color: 'rgba(148,163,184,.35)', blur: lay.size * .12 },
      });
    });
  });

  E.siginkbleed = lineLoop((ctx, w, h, style, time) => ({ words, lay }) => {
    setFont(ctx, style.effect, lay.size, style);
    const rows = rowsOf(ctx, lay, w, h);
    const widest = Math.max(...rows.map(row => row.width));
    const cx = w / 2, cy = rows.reduce((sum, row) => sum + row.y, 0) / rows.length;
    const phase = ((time % 3) / 3);
    const radius = (.2 + .95 * easeInOut(phase)) * Math.hypot(widest, lay.blockH) * .55;
    const soft = phase < .35 ? (1 - phase / .35) * 4 : 0;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(4, radius), 0, TAU);
    ctx.clip();
    if (soft > .1) blur(ctx, soft);
    rows.forEach(row => {
      ctx.fillStyle = '#f5f5f5';
      glow(ctx, 'rgba(255,255,255,.3)', lay.size * .12);
      ctx.fillText(row.text, row.x, row.y);
    });
    ctx.restore();
    if (phase > .45) {
      ctx.save();
      ctx.globalAlpha *= (1 - phase) * .5;
      ctx.strokeStyle = 'rgba(255,255,255,.5)';
      ctx.lineWidth = Math.max(1, lay.size * .014);
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    karaokeRows(ctx, lay, rows, w, h, words, () => '#ffffff');
  });

  E.sigwaterripple = lineLoop((ctx, w, h, style, time) => ({ words, lay }) => {
    setFont(ctx, style.effect, lay.size, style);
    const rows = rowsOf(ctx, lay, w, h);
    const phase = Math.sin(time * 2.2);
    const widest = Math.max(...rows.map(row => row.width));
    const cx = w / 2, cy = rows.reduce((sum, row) => sum + row.y, 0) / rows.length;
    for (let i = 0; i < 2; i += 1) {
      const p = ((time / 2.4) + i * .5) % 1;
      ctx.save();
      ctx.globalAlpha *= (1 - p) * .4;
      ctx.strokeStyle = '#7dd3fc';
      ctx.lineWidth = Math.max(1, lay.size * .012);
      ctx.beginPath();
      ctx.ellipse(cx, cy, widest * (.3 + p * .4), lay.blockH * (.3 + p * .35), 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    ctx.save();
    ctx.translate(cx, cy);
    ctx.transform(1, 0, phase * .035, 1, 0, 0);
    ctx.scale(1 + .04 * Math.abs(phase), 1 + .04 * Math.abs(phase));
    ctx.translate(-cx, -cy);
    rows.forEach(row => {
      ctx.save();
      ctx.fillStyle = '#bae6fd';
      glow(ctx, 'rgba(56,189,248,.55)', lay.size * .24);
      if (Math.abs(phase) > .8) blur(ctx, 1.2);
      ctx.fillText(row.text, row.x, row.y);
      ctx.restore();
    });
    ctx.restore();
    karaokeRows(ctx, lay, rows, w, h, words, () => '#f0f9ff');
  });

  E.sigmoltendrip = lineLoop((ctx, w, h, style, time) => ({ words, lay }) => {
    setFont(ctx, style.effect, lay.size, style);
    const rows = rowsOf(ctx, lay, w, h);
    const phase = ((time * .8) % 1);
    const sag = easeInOut(phase);
    const color = phase < .45 ? mix('#fef08a', '#fb923c', phase / .45) : mix('#fb923c', '#ef4444', (phase - .45) / .55);
    ctx.save();
    ctx.globalAlpha *= 1 - Math.max(0, phase - .55) * 1.6;
    ctx.translate(w / 2, (h - lay.blockH) / 2);
    ctx.scale(1 - sag * .12, 1 + sag * .42);
    ctx.translate(-w / 2, -(h - lay.blockH) / 2);
    rows.forEach(row => {
      ctx.save();
      ctx.fillStyle = color;
      glow(ctx, '#f97316', lay.size * .28);
      ctx.fillText(row.text, row.x, row.y + sag * lay.size * .32);
      ctx.restore();
    });
    ctx.restore();
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha *= .6 * (1 - Math.max(0, phase - .5) * 1.5);
    for (let i = 0; i < 5; i += 1) {
      const seed = i + 5;
      const x = w / 2 + (hash(seed) - .5) * Math.max(80, lay.size * 4);
      const y = (h + lay.blockH) / 2 + sag * lay.size * (.4 + hash(seed + 2));
      ctx.beginPath();
      ctx.ellipse(x, y, Math.max(1, lay.size * .02), Math.max(2, lay.size * .05 * (1 + hash(seed + 3))), 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  });

  E.sigmercurybead = lineLoop((ctx, w, h, style, time) => ({ words, lay, map }) => {
    setFont(ctx, style.effect, lay.size, style);
    glyphs(ctx, lay, map, time, w, h, {}, (ch, x, cw, y, ri, p) => {
      const phase = time * 2.6 + x * .04;
      const sx = 1 + .1 * Math.sin(phase), sy = 1 + .1 * Math.cos(phase);
      const paint = ctx.createLinearGradient(0, y - lay.size * .5, 0, y + lay.size * .5);
      paint.addColorStop(0, '#ffffff');
      paint.addColorStop(.38, '#9ca3af');
      paint.addColorStop(.56, '#f4f4f5');
      paint.addColorStop(.82, '#52525b');
      paint.addColorStop(1, '#e4e4e7');
      glyph(ctx, ch, x, cw, y, {
        scaleX: sx, scaleY: sy, rotate: Math.sin(phase) * .04,
        alpha: .45 + .55 * p, fill: paint,
        shadow: { color: 'rgba(0,0,0,.55)', blur: lay.size * .06 },
      });
    });
  });

  E.sigsilkwave = lineLoop((ctx, w, h, style, time) => ({ words, lay, map }) => {
    setFont(ctx, style.effect, lay.size, style);
    glyphs(ctx, lay, map, time, w, h, {}, (ch, x, cw, y, ri, p) => {
      const phase = time * 3.2 - x * .02;
      glyph(ctx, ch, x, cw, y, {
        dy: Math.sin(phase) * lay.size * .16, rotate: -Math.sin(phase) * .07,
        alpha: .4 + .6 * p, fill: mix('#f5d0fe', '#f0abfc', .5 + .5 * Math.sin(phase)),
        shadow: { color: 'rgba(240,171,252,.35)', blur: lay.size * .14 },
      });
    });
  });

  E.sigpetalbloom = lineLoop((ctx, w, h, style, time) => ({ words, lay }) => {
    setFont(ctx, style.effect, lay.size, style);
    wordsRows(ctx, lay, words, w, h, item => {
      const phase = .5 + .5 * Math.sin(time * 2.2 - item.index * .7);
      ctx.save();
      ctx.translate(item.cx, item.y + lay.size * .35);
      ctx.rotate(-.28 + .28 * phase);
      ctx.scale(.74 + .26 * phase, .74 + .26 * phase);
      ctx.globalAlpha *= .35 + .65 * phase;
      ctx.fillStyle = '#fecdd3';
      glow(ctx, 'rgba(251,113,133,.35)', lay.size * .18);
      ctx.fillText(item.text, -item.width / 2, 0);
      ctx.restore();
    });
  });

  E.sigvaporbloom = lineLoop((ctx, w, h, style, time) => ({ words, lay }) => {
    setFont(ctx, style.effect, lay.size, style);
    const rows = rowsOf(ctx, lay, w, h);
    const focus = .5 + .5 * Math.sin(time * .95);
    const widest = Math.max(...rows.map(row => row.width));
    const spread = (1 - focus) * lay.size * .09;
    rows.forEach(row => {
      ctx.save();
      ctx.globalAlpha *= .32 + .68 * focus;
      ctx.fillStyle = '#e2e8f0';
      if (focus < .85) blur(ctx, (1 - focus) * 7);
      glow(ctx, 'rgba(226,232,240,.4)', lay.size * .22 * focus);
      U.drawTrackedText(ctx, row.text, row.x + (widest - row.width) / 2, row.y, spread);
      ctx.restore();
    });
    karaokeRows(ctx, lay, rows, w, h, words, () => '#ffffff');
  });

  /* ------------------------------------------------------------------ */
  /* 43–50  Dimensional Depth                                           */
  /* ------------------------------------------------------------------ */

  E.sigchromeextrusion = lineLoop((ctx, w, h, style, time) => ({ words, lay }) => {
    setFont(ctx, style.effect, lay.size, style);
    const rows = rowsOf(ctx, lay, w, h);
    const swing = .5 + .5 * Math.sin(time * 2.2);
    const depth = Math.max(2, Math.round(lay.size * .05 * (1 + swing * .35)));
    const shades = ['#2c2c34', '#43434c', '#62626c', '#8a8a94', '#b8b8c2', '#e4e4ea'];
    for (let layer = depth; layer >= 1; layer -= 1) {
      const color = shades[Math.min(shades.length - 1, Math.floor(layer / depth * shades.length))];
      rows.forEach(row => {
        ctx.save();
        ctx.fillStyle = color;
        ctx.fillText(row.text, row.x + layer, row.y + layer);
        ctx.restore();
      });
    }
    rows.forEach(row => {
      ctx.save();
      ctx.fillStyle = '#ffffff';
      glow(ctx, 'rgba(255,255,255,.25)', lay.size * .1);
      ctx.fillText(row.text, row.x, row.y);
      ctx.restore();
    });
    karaokeRows(ctx, lay, rows, w, h, words, () => '#ffffff');
  });

  E.sigletterflip = lineLoop((ctx, w, h, style, time) => ({ words, lay, map }) => {
    setFont(ctx, style.effect, lay.size, style);
    glyphs(ctx, lay, map, time, w, h, {}, (ch, x, cw, y, ri, p) => {
      const phase = (((time * 1.35) - x * .0035) % 1 + 1) % 1;
      const angle = phase < .5 ? phase * Math.PI : 0;
      const scaleY = Math.cos(angle);
      glyph(ctx, ch, x, cw, y, {
        scaleY: Math.max(.03, Math.abs(scaleY)), scaleX: 1 - Math.abs(scaleY) * .12,
        alpha: .45 + .55 * p,
        fill: Math.abs(scaleY) < .3 ? '#a1a1aa' : '#fff',
        shadow: { color: rgba('#a78bfa', .25), blur: lay.size * .12 },
      });
    });
  });

  E.sigcardstack = lineLoop((ctx, w, h, style, time) => ({ words, lay }) => {
    setFont(ctx, style.effect, lay.size, style);
    const rows = rowsOf(ctx, lay, w, h);
    const swing = Math.sin(time * 2.4) * .5;
    const plates = [[8, '#312e81'], [6, '#4338ca'], [4, '#4f46e5'], [2, '#6366f1']];
    plates.forEach(([offset, color]) => {
      const dx = offset * (swing >= 0 ? 1 : -1) * (1 + Math.abs(swing) * .2);
      rows.forEach(row => {
        ctx.save();
        ctx.fillStyle = color;
        ctx.fillText(row.text, row.x + dx, row.y + offset * .8);
        ctx.restore();
      });
    });
    rows.forEach(row => {
      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.fillText(row.text, row.x + swing, row.y - Math.abs(swing) * 3);
      ctx.restore();
    });
    karaokeRows(ctx, lay, rows, w, h, words, () => '#ffffff');
  });

  E.sigrackfocus = lineLoop((ctx, w, h, style, time) => ({ words, lay }) => {
    setFont(ctx, style.effect, lay.size, style);
    const rows = rowsOf(ctx, lay, w, h);
    const focus = .5 + .5 * Math.sin(time * .85 - Math.PI / 2);
    const sharp = clamp((focus - .35) / .5);
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(1.06 - .06 * sharp, 1.06 - .06 * sharp);
    ctx.translate(-w / 2, -h / 2);
    rows.forEach(row => {
      ctx.save();
      ctx.globalAlpha *= .5 + .5 * sharp;
      ctx.fillStyle = '#fafafa';
      if (sharp < .9) blur(ctx, (1 - sharp) * 7);
      glow(ctx, 'rgba(255,255,255,.45)', lay.size * .2 * sharp);
      ctx.fillText(row.text, row.x, row.y);
      ctx.restore();
    });
    ctx.restore();
    karaokeRows(ctx, lay, rows, w, h, words, () => '#ffffff');
  });

  E.sigkaleidoscope = lineLoop((ctx, w, h, style, time) => ({ words, lay }) => {
    setFont(ctx, style.effect, lay.size, style);
    const rows = rowsOf(ctx, lay, w, h);
    const phase = .5 + .5 * Math.sin(time * 1.8);
    const cx = w / 2, cy = rows.reduce((sum, row) => sum + row.y, 0) / rows.length;
    const ghost = (sx, sy, color, alphaValue) => {
      ctx.save();
      ctx.globalAlpha *= alphaValue;
      ctx.translate(cx, cy);
      ctx.scale(sx, sy);
      ctx.translate(-cx, -cy);
      blur(ctx, 1.6);
      rows.forEach(row => { ctx.fillStyle = color; ctx.fillText(row.text, row.x, row.y); });
      ctx.restore();
    };
    ghost(-1, .82 + .36 * phase, '#a78bfa', .65);
    ghost(-1, -1, '#22d3ee', .5);
    ghost(1, .9 + .2 * phase, '#c4b5fd', .55);
    rows.forEach(row => {
      ctx.save();
      ctx.fillStyle = '#fff';
      glow(ctx, 'rgba(255,255,255,.4)', lay.size * .2);
      ctx.fillText(row.text, row.x, row.y);
      ctx.restore();
    });
    karaokeRows(ctx, lay, rows, w, h, words, () => '#ffffff');
  });

  E.sigorbitring = lineLoop((ctx, w, h, style, time) => ({ words, lay }) => {
    setFont(ctx, style.effect, lay.size, style);
    const rows = rowsOf(ctx, lay, w, h);
    const widest = Math.max(...rows.map(row => row.width));
    const cx = w / 2, cy = rows.reduce((sum, row) => sum + row.y, 0) / rows.length;
    const radius = Math.max(widest, lay.blockH) * .62;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(time * 1.6);
    ctx.lineWidth = Math.max(2, lay.size * .018);
    for (let i = 0; i < 28; i += 1) {
      const a = i / 28 * TAU;
      const alphaValue = i < 16 ? 0 : ((i - 16) / 12) * .9;
      if (alphaValue <= 0) continue;
      ctx.strokeStyle = `rgba(${i > 22 ? '34,211,238' : '167,139,250'},${alphaValue})`;
      glow(ctx, 'rgba(34,211,238,.5)', lay.size * .1);
      ctx.beginPath();
      ctx.arc(0, 0, radius, a, a + TAU / 28 + .02);
      ctx.stroke();
    }
    ctx.restore();
    rows.forEach(row => {
      ctx.save();
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(row.text, row.x, row.y);
      ctx.restore();
    });
    karaokeRows(ctx, lay, rows, w, h, words, () => '#ffffff');
  });

  E.sigtypewriter = lineLoop((ctx, w, h, style, time) => ({ words, lay }) => {
    setFont(ctx, style.effect, lay.size, style);
    const rows = rowsOf(ctx, lay, w, h);
    const total = rows.reduce((sum, row) => sum + Array.from(row.text).length + 1, -1);
    const p = U.sungProgress(words, time);
    const typed = Math.max(0, Math.min(total, Math.floor(total * clamp(p * 1.05))));
    let used = 0;
    let caret = null;
    rows.forEach(row => {
      const chars = Array.from(row.text);
      const slice = Math.max(0, Math.min(chars.length, typed - used));
      const visible = chars.slice(0, slice).join('');
      if (visible) {
        ctx.save();
        ctx.fillStyle = '#f4f4f5';
        ctx.fillText(visible, row.x, row.y);
        ctx.restore();
      }
      if (typed >= used && typed <= used + chars.length) {
        caret = { x: row.x + ctx.measureText(visible).width, y: row.y };
      }
      used += chars.length + 1;
    });
    if (typed < total && Math.floor(time * 2.4) % 2 === 0) {
      const last = caret || { x: rows[0].x, y: rows[0].y };
      ctx.save();
      ctx.fillStyle = '#a3e635';
      ctx.fillRect(last.x + lay.size * .04, last.y - lay.size * .48, Math.max(2, lay.size * .05), lay.size * .96);
      ctx.restore();
    }
    if (typed >= total && Math.floor(time * 2.4) % 2 === 0) {
      const last = rows[rows.length - 1];
      ctx.save();
      ctx.fillStyle = '#a3e635';
      ctx.fillRect(last.x + last.width + lay.size * .04, last.y - lay.size * .48, Math.max(2, lay.size * .05), lay.size * .96);
      ctx.restore();
    }
  });

  E.sigcinemabars = lineLoop((ctx, w, h, style, time) => ({ words, lay }) => {
    setFont(ctx, style.effect, lay.size, style);
    const rows = rowsOf(ctx, lay, w, h);
    const punch = .5 + .5 * Math.sin(time * 1.4 - Math.PI / 2);
    const widest = Math.max(...rows.map(row => row.width));
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(.86 + .24 * punch, .86 + .24 * punch);
    ctx.translate(-w / 2, -h / 2);
    rows.forEach(row => {
      ctx.save();
      ctx.globalAlpha *= .4 + .6 * punch;
      ctx.fillStyle = '#fff';
      if (punch < .9) blur(ctx, (1 - punch) * 2.5);
      glow(ctx, 'rgba(255,255,255,.45)', lay.size * .3 * punch);
      U.drawTrackedText(ctx, row.text, row.x + .16 * lay.size * (1 - punch), row.y, .16 * lay.size * (1 - punch));
      ctx.restore();
    });
    ctx.restore();
    const barH = lay.size * (1.5 - .95 * punch);
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.globalAlpha *= .92;
    ctx.fillRect(w * .05, (h - lay.blockH) / 2 - lay.size * .58 - barH, w * .9, barH);
    ctx.fillRect(w * .05, (h + lay.blockH) / 2 + lay.size * .58, w * .9, barH);
    ctx.restore();
    void widest;
    karaokeRows(ctx, lay, rows, w, h, words, () => '#ffffff');
  });
})();
