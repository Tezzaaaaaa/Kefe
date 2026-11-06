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
  const Fx = window.kefeFx || {};
  const setFont = (ctx, key, size, style) => {
    const c = contract(key);
    const family = c.family || style?.kefeMotionFont || 'Open Sans';
    U.setFont(ctx, family, size, Fx.fontWeight ? Fx.fontWeight(family, c.weight || 800) : (c.weight || 800));
    if (Fx.typeQuality) Fx.typeQuality(ctx);
    /* Contract tracking is real letter-spacing at draw time, not just a wrap hint. */
    if (Fx.letterSpacing) Fx.letterSpacing(ctx, (c.tracking || 0) * Math.max(18, size));
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
    const weight = Fx.fontWeight ? Fx.fontWeight(family, c.weight || 800) : (c.weight || 800);
    const set = (target, size) => U.setFont(target, family, size, weight);
    /* layoutText adds tracking itself, so measure with spacing off to avoid counting it twice */
    if (Fx.letterSpacing) Fx.letterSpacing(ctx, 0);
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
    if (Fx.typeQuality) Fx.typeQuality(ctx);
    if (Fx.letterSpacing) Fx.letterSpacing(ctx, (c.tracking || 0) * lay.size);
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
      const t0 = Number(item.line.time) || 0;
      const phase = { enter: item.enter, leave: item.leave, alpha: item.alpha, role: item.role, t: ctx.__kfxTime - t0, line: item.line };
      draw({ line: item.line, next: item.next, text, words, lay, map, index: item.index, phase });
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
      ctx.__kfxTime = timeNow;
      try {
        fn(ctx, w, h, style, lines || [], timeNow);
      } finally {
        /* never leak spacing / filters / blend modes into the next effect or the title card */
        if (Fx.letterSpacing) Fx.letterSpacing(ctx, 0);
        ctx.globalCompositeOperation = 'source-over';
        noGlow(ctx);
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        if ('filter' in ctx) ctx.filter = 'none';
      }
    };
  }

  const lineLoop = (drawLine, opt = {}) => withTime((ctx, w, h, style, lines, time) => {
    lineScene(ctx, style, lines, time, opt, drawLine(ctx, w, h, style, time));
  });

  /* ------------------------------------------------------------------ */
  /* 01–09  Kinetic Dynamics                                            */
  /* ------------------------------------------------------------------ */

  /* Kinetic Punch — every word is struck on its own beat: a sprung scale-in with
     overshoot, a white-hot flash with warm bloom, an anamorphic streak and a
     brief chromatic fringe. Neighbours are pushed apart by the punched word's
     real width (no overlaps), and the whole line lifts away on exit. */
  E.sigkineticpunch = lineLoop((ctx, w, h, style, time) => ({ words, lay, phase }) => {
    setFont(ctx, style.effect, lay.size, style);
    const pal = Fx.palette({ text: '#ffffff', accent: '#ff7a59', inactive: 'rgba(255,255,255,.3)' });
    const rows = Fx.rows(ctx, lay, w, h);
    const items = Fx.words(ctx, rows, words);
    const size = lay.size;
    /* per-word state */
    items.forEach(item => {
      const age = time - item.word.time;
      const hit = age >= 0 ? Fx.spring(age, 3.3, .34) : 0;
      const pre = U.wordProgress(item.word, time, .09).pre * (age < 0 ? 1 : 0);
      item.s = age >= 0 ? 1 + .34 * (1 - hit) : 1 - .035 * pre;
      item.dy = age >= 0 ? -(1 - hit) * size * .07 : pre * size * .012;
      item.flash = age >= 0 ? Math.exp(-age / .15) : 0;
    });
    /* push neighbours apart by the extra width each punched word occupies */
    rows.forEach(row => {
      const own = items.filter(item => item.ri === row.ri);
      const extra = own.map(item => (item.s - 1) * item.width);
      const total = extra.reduce((a, b) => a + b, 0);
      let before = 0;
      own.forEach((item, i) => {
        item.px = item.cx + before + extra[i] / 2 - total / 2;
        before += extra[i];
      });
    });
    const lift = (phase.leave || 0) * size * .3;
    ctx.save();
    ctx.translate(0, -lift);
    const hot = items.filter(item => item.flash > .02);
    if (hot.length) {
      Fx.bloom(ctx, w, h, g => {
        hot.forEach(item => {
          g.save();
          g.translate(item.px, item.y + item.dy);
          g.scale(item.s, item.s);
          g.fillStyle = Fx.rgba(pal.accent, .85 * item.flash);
          g.fillText(item.text, -item.width / 2, 0);
          g.restore();
        });
      }, { radius: size * .5, strength: .8, haze: .3 });
      hot.forEach(item => {
        const span = item.width * item.s * 2.1;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = Fx.lineGradient(ctx, item.px - span / 2, 0, item.px + span / 2, 0, [
          [0, 'rgba(255,255,255,0)'], [.5, Fx.rgba('#ffffff', .85 * item.flash)], [1, 'rgba(255,255,255,0)'],
        ]);
        ctx.fillRect(item.px - span / 2, item.y + item.dy - size * .004, span, Math.max(1.5, size * .014));
        ctx.restore();
      });
    }
    items.forEach(item => {
      const p = U.wordProgress(item.word, time, .06).sweep;
      ctx.save();
      ctx.translate(item.px, item.y + item.dy);
      ctx.scale(item.s, item.s);
      if (item.flash > .25) {
        Fx.chroma(ctx, (g, dx, dy, colour) => {
          g.fillStyle = colour;
          g.fillText(item.text, -item.width / 2 + dx, dy);
        }, { dx: size * .014 * item.flash, strength: .5 * item.flash });
      }
      ctx.shadowColor = 'rgba(0,0,0,.42)';
      ctx.shadowBlur = size * .1;
      ctx.shadowOffsetY = size * .03;
      ctx.fillStyle = U.sweepFill(ctx, -item.width / 2, item.width, p, pal.text, pal.inactive, .32);
      ctx.fillText(item.text, -item.width / 2, 0);
      if (item.flash > .02) {
        /* white-hot strike: the whole word flashes full white at impact, then settles into the sweep */
        ctx.globalAlpha *= clamp(item.flash * 1.15);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(item.text, -item.width / 2, 0);
      }
      ctx.restore();
    });
    ctx.restore();
  }, { width: .8, height: .7 });


  /* Elastic Slam — letters drop in on a damped spring, stretching as they fall
     and squashing as they land (area-preserving), with a short motion trail,
     a landing flash and a hint of chromatic fringe. Unsung letters wait as a
     faint ghost so the line never jumps. */
  E.sigelasticslam = lineLoop((ctx, w, h, style, time) => ({ words, lay, phase }) => {
    setFont(ctx, style.effect, lay.size, style);
    const pal = Fx.palette({ text: '#ffffff', accent: '#ff5c8a', inactive: 'rgba(255,255,255,.14)' });
    const rows = Fx.rows(ctx, lay, w, h);
    const items = Fx.words(ctx, rows, words);
    const glyphList = Fx.chars(ctx, items);
    const size = lay.size;
    const drop = size * .62;
    const lift = (phase.leave || 0) * size * .22;
    ctx.save();
    ctx.translate(0, -lift);
    const state = glyphList.map((g, index) => {
      const word = g.item.word;
      const dur = Math.max(.12, word.endTime - word.time);
      const arrive = word.time + dur * .55 * (g.n > 1 ? g.j / (g.n - 1) : 0);
      const age = time - arrive;
      const e = age > 0 ? Fx.spring(age, 2.5, .5) : 0;
      const v = age > 0 ? (Fx.spring(age + .012, 2.5, .5) - Fx.spring(age - .012, 2.5, .5)) / .024 : 0;
      const stretch = 1 + clamp(v * .05, -.22, .5);
      const sx = 1 / Math.sqrt(Math.max(.4, stretch));
      return { g, age, e, v, stretch, sx, index, dy: -(1 - e) * drop, alpha: clamp(age / .07), rot: (Fx.hash(index * 3.1 + 2) - .5) * .42 * (1 - Math.min(1, e)) };
    });
    ctx.fillStyle = pal.inactive;
    state.filter(st => st.age <= 0).forEach(st => ctx.fillText(st.g.ch, st.g.x, st.g.y));
    const live = state.filter(st => st.age > 0);
    const hot = live.filter(st => st.age < .22);
    if (hot.length) {
      Fx.bloom(ctx, w, h, g => {
        hot.forEach(st => {
          g.save();
          g.translate(st.g.cx, st.g.y + st.dy);
          g.rotate(st.rot);
          g.scale(st.sx, st.stretch);
          g.fillStyle = Fx.rgba(pal.accent, .75 * st.alpha * Math.exp(-st.age / .09));
          g.fillText(st.g.ch, -st.g.w / 2, 0);
          g.restore();
        });
      }, { radius: size * .32, strength: .9 });
    }
    live.forEach(st => {
      const { g } = st;
      const dy = st.dy;
      const sy = st.stretch, sx = st.sx;
      const alpha = st.alpha;
      const draw = (offsetY, a, colour, dx = 0) => {
        ctx.save();
        ctx.globalAlpha *= a;
        ctx.translate(g.cx + dx, g.y + dy + offsetY);
        ctx.rotate(st.rot);
        ctx.scale(sx, sy);
        ctx.fillStyle = colour;
        ctx.fillText(g.ch, -g.w / 2, 0);
        ctx.restore();
      };
      /* motion trail while the glyph is travelling fast */
      const speed = clamp(Math.abs(st.v) * .06);
      if (speed > .05) {
        draw(-drop * .16 * speed * 3, alpha * .16 * speed, pal.text);
        draw(-drop * .3 * speed * 3, alpha * .08 * speed, pal.text);
      }
      if (speed > .12) {
        Fx.chroma(ctx, (c, dx, dyy, colour) => {
          c.save();
          c.translate(g.cx + dx, g.y + dy + dyy);
          c.rotate(st.rot);
          c.scale(sx, sy);
          c.fillStyle = colour;
          c.fillText(g.ch, -g.w / 2, 0);
          c.restore();
        }, { dx: size * .012 * speed, strength: alpha * .6 * speed });
      }
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.4)';
      ctx.shadowBlur = size * .08;
      ctx.shadowOffsetY = size * .025;
      draw(0, alpha, pal.text);
      ctx.restore();
      const flash = Math.exp(-st.age / .07);
      if (flash > .03) draw(0, alpha * flash * .9, '#ffffff');
    });
    ctx.restore();
  }, { width: .8, height: .72 });


  /* Gravity Landing — the whole line drops under real acceleration, stretches
     just before contact, lands with an area-preserving squash pivoting on the
     floor, rebounds twice with decaying height, and leaves a floor shockwave.
     A contact shadow tightens as it approaches; the lit gradient then sweeps
     word by word. */
  E.siggravitylanding = lineLoop((ctx, w, h, style, time) => ({ words, lay, phase }) => {
    setFont(ctx, style.effect, lay.size, style);
    const pal = Fx.palette({ text: '#ffffff', accent: '#a5b4fc', inactive: 'rgba(255,255,255,.3)' });
    const rows = Fx.rows(ctx, lay, w, h);
    const items = Fx.words(ctx, rows, words);
    const size = lay.size;
    const box = Fx.bounds(rows, lay);
    const floor = box.y + box.h + size * .1;
    const fall = .46, t = Math.max(0, phase.t);
    const dist = Math.max(h * .5, size * 3.4);
    const age = t - fall;
    let dy, sx = 1, sy = 1;
    if (age < 0) {
      const k = t / fall;
      dy = -dist * (1 - k * k);
      sy = 1 + .14 * Math.pow(k, 4);
      sx = 1 - .05 * Math.pow(k, 4);
    } else {
      const bounce = (start, len, height) => {
        const u = (age - start) / len;
        return u > 0 && u < 1 ? -height * 4 * u * (1 - u) : 0;
      };
      dy = bounce(0, .3, size * .16) + bounce(.3, .17, size * .05);
      const squash = Math.exp(-age / .1) * (1 + .35 * Math.cos(age * 26));
      sy = 1 - .2 * clamp(squash, -.4, 1);
      sx = 1 + .075 * clamp(squash, -.4, 1);
    }
    const shakeAge = Math.max(0, age);
    const shake = age >= 0 ? Math.sin(shakeAge * 90) * Math.exp(-shakeAge / .06) * size * .012 : 0;
    const lift = (phase.leave || 0) * size * .28;
    /* contact shadow: tightens and darkens as the line comes down */
    const near = age < 0 ? Math.pow(t / fall, 2) : 1;
    ctx.save();
    ctx.globalAlpha *= .55 * near;
    ctx.translate(w / 2, floor + size * .02);
    ctx.scale(1 + (1 - near) * .35, .16);
    ctx.fillStyle = Fx.radial(ctx, 0, 0, 0, box.w * .62, [[0, 'rgba(0,0,0,.65)'], [.6, 'rgba(0,0,0,.25)'], [1, 'rgba(0,0,0,0)']]);
    ctx.beginPath();
    ctx.arc(0, 0, box.w * .62, 0, TAU);
    ctx.fill();
    ctx.restore();
    /* floor shockwave */
    if (age > 0 && age < .7) {
      const u = age / .7;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineWidth = Math.max(1.5, size * .014);
      ctx.strokeStyle = Fx.rgba(pal.accent, .55 * Math.pow(1 - u, 2));
      ctx.beginPath();
      ctx.ellipse(w / 2, floor + size * .02, box.w * (.3 + .5 * Fx.ease.outCubic(u)), size * (.03 + .05 * u), 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    ctx.save();
    ctx.translate(shake, -lift);
    ctx.translate(w / 2, floor);
    ctx.scale(sx, sy);
    ctx.translate(-w / 2, -floor + dy);
    ctx.shadowColor = 'rgba(0,0,0,.4)';
    ctx.shadowBlur = size * .1;
    ctx.shadowOffsetY = size * .03;
    ctx.fillStyle = pal.inactive;
    rows.forEach(row => ctx.fillText(row.text, row.x, row.y));
    ctx.shadowColor = 'transparent';
    const paintLit = g => {
      const cool = pal.textSet ? pal.text : '#b4c0ff';
      g.fillStyle = Fx.lineGradient(g, 0, box.y, 0, box.y + box.h, [[0, pal.text], [.5, pal.textSet ? pal.text : '#e6ebff'], [1, cool]]);
      rows.forEach(row => g.fillText(row.text, row.x, row.y));
    };
    Fx.softReveal(ctx, w, h, items, time, paintLit, { size, edge: .3 });
    ctx.restore();
  }, { width: .84, height: .7 });


  /* Magnet Repulse — each word is a pole: when it is sung its glyphs are driven
     outward from the word's centre of mass along a damped spring, tint towards
     the accent as the field strengthens, and snap back past rest before
     settling. A pair of field rings expands from the word with every hit. */
  E.sigmagnetrepulse = lineLoop((ctx, w, h, style, time) => ({ words, lay, phase }) => {
    setFont(ctx, style.effect, lay.size, style);
    const pal = Fx.palette({ text: '#f4f1ff', accent: '#e879f9', inactive: 'rgba(196,181,253,.32)' });
    const rows = Fx.rows(ctx, lay, w, h);
    const items = Fx.words(ctx, rows, words);
    const list = Fx.chars(ctx, items);
    const size = lay.size;
    const lift = (phase.leave || 0) * size * .26;
    ctx.save();
    ctx.translate(0, -lift);
    /* field rings first so the type sits on top of them */
    items.forEach(item => {
      const age = time - item.word.time;
      if (age < 0 || age > .75) return;
      for (let ring = 0; ring < 2; ring += 1) {
        const u = clamp((age - ring * .09) / .6);
        if (u <= 0 || u >= 1) continue;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineWidth = Math.max(1.2, size * (.016 - ring * .006));
        ctx.strokeStyle = Fx.rgba(pal.accent, .5 * Math.pow(1 - u, 2) * (1 - ring * .4));
        ctx.beginPath();
        ctx.ellipse(item.cx, item.y, item.width * .5 + size * (.12 + .9 * Fx.ease.outCubic(u)), size * (.34 + .55 * Fx.ease.outCubic(u)), 0, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }
    });
    const state = list.map((g, index) => {
      const item = g.item, word = item.word;
      const age = time - word.time;
      const ramp = age > 0 ? 1 - Math.exp(-age / .045) : 0;
      const d = age > 0 ? ramp * Math.exp(-age / .34) * Math.cos(age * 8.5) : 0;
      const dir = (g.cx - item.cx) / Math.max(item.width * .5, size * .3);
      const vert = (Fx.hash(index * 1.9 + 7) - .5) * 1.2;
      const lit = U.charProgress(word, g.j, g.n, time, .85, .3);
      return {
        g, d, lit, field: clamp(Math.abs(d) * 4.6),
        x: g.cx + dir * d * size * .3, y: g.y + (dir * .35 + vert) * d * size * .12,
        rot: dir * d * .5,
      };
    });
    const hot = state.filter(st => st.field > .12);
    if (hot.length) {
      Fx.bloom(ctx, w, h, c => {
        hot.forEach(st => {
          c.save();
          c.translate(st.x, st.y);
          c.rotate(st.rot);
          c.fillStyle = Fx.rgba(pal.accent, .8 * st.field);
          c.fillText(st.g.ch, -st.g.w / 2, 0);
          c.restore();
        });
      }, { radius: size * .34, strength: .85 });
    }
    state.forEach(st => {
      const draw = (colour, alpha) => {
        ctx.save();
        ctx.globalAlpha *= alpha;
        ctx.translate(st.x, st.y);
        ctx.rotate(st.rot);
        ctx.fillStyle = colour;
        ctx.fillText(st.g.ch, -st.g.w / 2, 0);
        ctx.restore();
      };
      draw(pal.inactive, 1);
      draw(pal.text, st.lit);
      if (st.field > .02) draw(pal.accent, st.field * .85);
    });
    ctx.restore();
  }, { width: .8, height: .7 });


  /* Word Cascade — words hinge up out of the floor on a sprung flip with
     depth-of-field: each word starts foreshortened, soft and low, then
     resolves razor sharp with a travelling specular sweep. The word being sung
     carries a violet bloom that follows the voice; sung words settle to clean
     white. */
  E.sigwordcascade = lineLoop((ctx, w, h, style, time) => ({ words, lay, phase }) => {
    setFont(ctx, style.effect, lay.size, style);
    const pal = Fx.palette({ text: '#ffffff', accent: '#a78bfa', inactive: 'rgba(255,255,255,.1)' });
    const rows = Fx.rows(ctx, lay, w, h);
    const items = Fx.words(ctx, rows, words);
    const size = lay.size;
    const lift = (phase.leave || 0) * size * .3;
    ctx.save();
    ctx.translate(0, -lift);
    ctx.fillStyle = pal.inactive;
    items.forEach(item => { if (time < item.word.time - .1) ctx.fillText(item.text, item.x, item.y); });
    const entered = items.filter(item => time >= item.word.time - .1);
    const state = entered.map(item => {
      const age = time - (item.word.time - .1);
      const spr = Math.min(1.05, Fx.spring(age, 1.7, .66));
      const e = clamp(spr);
      const prog = U.wordProgress(item.word, time, .06);
      return { item, e, spr, age, active: prog.pulse * (time < item.word.endTime + .25 ? 1 : 0), sung: prog.sweep };
    });
    const glowing = state.filter(st => st.active > .05);
    if (glowing.length) {
      Fx.bloom(ctx, w, h, c => {
        glowing.forEach(st => {
          c.fillStyle = Fx.rgba(pal.accent, .75 * st.active);
          c.fillText(st.item.text, st.item.x, st.item.y);
        });
      }, { radius: size * .42, strength: .9, haze: .3 });
    }
    state.forEach(st => {
      const { item, e } = st;
      const flip = Math.max(.04, Math.cos((1 - st.spr) * 1.36));
      ctx.save();
      ctx.globalAlpha *= clamp(.15 + e * 1.1);
      ctx.translate(item.cx, item.y + (1 - e) * size * .34);
      ctx.scale(1 - (1 - e) * .05, flip);
      if (e < .97) blur(ctx, (1 - e) * 9);
      ctx.shadowColor = 'rgba(0,0,0,.4)';
      ctx.shadowBlur = size * .1;
      ctx.shadowOffsetY = size * .03;
      ctx.fillStyle = pal.text;
      ctx.fillText(item.text, -item.width / 2, 0);
      ctx.shadowColor = 'transparent';
      if (st.active > .03) {
        ctx.globalAlpha *= st.active * .8;
        ctx.fillStyle = Fx.mix('#ffffff', pal.accent, .55);
        ctx.fillText(item.text, -item.width / 2, 0);
      }
      ctx.restore();
      /* specular band travelling across the word while it unfolds */
      if (e < .98) {
        const bandX = item.x + item.width * (-.2 + 1.4 * e);
        Fx.masked(ctx, w, h, g => {
          g.save();
          g.translate(item.cx, item.y + (1 - e) * size * .34);
          g.scale(1 - (1 - e) * .05, flip);
          g.fillStyle = '#fff';
          g.fillText(item.text, -item.width / 2, 0);
          g.restore();
        }, g => {
          g.fillStyle = Fx.lineGradient(g, bandX - size * .5, 0, bandX + size * .5, 0, [[0, 'rgba(255,255,255,0)'], [.5, `rgba(255,255,255,${.9 * (1 - e)})`], [1, 'rgba(255,255,255,0)']]);
          g.fillRect(bandX - size * .5, item.y - size, size, size * 2);
        });
      }
    });
    ctx.restore();
  }, { width: .8, height: .72 });


  /* Marquee Rail — a single kinetic ticker that follows the vocal: the rail
     glides so the word being sung stays on the centre line (eased between
     anchors, never snapping), words light with a soft sweep, a halo rides the
     active word, and a huge outlined ghost rail drifts at 40% speed behind for
     parallax depth. Both ends feather out. */
  E.sigmarqueerail = lineLoop((ctx, w, h, style, time) => ({ words, lay, phase }) => {
    setFont(ctx, style.effect, lay.size, style);
    const pal = Fx.palette({ text: '#ffffff', accent: '#8ec5ff', inactive: 'rgba(255,255,255,.24)' });
    const rows = Fx.rows(ctx, lay, w, h);
    const items = Fx.words(ctx, rows, words);
    if (!items.length) return;
    const size = lay.size, y = rows[0].y, rowW = rows[0].width;
    /* anchor on the active word, eased between neighbours */
    let k = -1;
    items.forEach((item, i) => { if (time >= item.word.time) k = i; });
    let anchor = items[0].cx;
    if (k >= items.length - 1) anchor = items[items.length - 1].cx;
    else if (k >= 0) {
      const a = items[k], b = items[k + 1];
      const u = clamp((time - a.word.time) / Math.max(.12, b.word.time - a.word.time));
      anchor = Fx.lerp(a.cx, b.cx, U.smoother(clamp((u - .15) / .7)));
    }
    const follow = clamp((rowW - w * .6) / (w * .28));
    const shift = (w / 2 - anchor) * follow + (1 - follow) * 0;
    const active = k >= 0 ? items[k] : null;
    const paintRail = g => {
      g.save();
      g.translate(w / 2 + shift * .4, y);
      g.scale(2.5, 2.5);
      g.translate(-w / 2, -y);
      g.lineWidth = Math.max(.6, size * .006);
      g.strokeStyle = 'rgba(255,255,255,.09)';
      g.strokeText(rows[0].text, rows[0].x, y);
      g.restore();
      g.save();
      g.translate(shift, 0);
      if (active) {
        const p = U.wordProgress(active.word, time, .06);
        const r = Math.max(active.width * .62, size * .55);
        g.fillStyle = Fx.radial(g, active.cx, y, 0, r, [[0, Fx.rgba(pal.accent, .22 * (.4 + .6 * p.pulse))], [1, Fx.rgba(pal.accent, 0)]]);
        g.fillRect(active.cx - r, y - r, r * 2, r * 2);
      }
      Fx.sung(g, items, time, pal.text, pal.inactive, .3);
      g.fillStyle = Fx.rgba(pal.accent, .75);
      for (let i = 0; i < items.length - 1; i += 1) {
        const mid = (items[i].x + items[i].width + items[i + 1].x) / 2;
        g.beginPath();
        g.arc(mid, y, Math.max(2, size * .045), 0, TAU);
        g.fill();
      }
      g.restore();
    };
    const lift = (phase.leave || 0) * size * .25;
    ctx.save();
    ctx.translate(0, -lift);
    const sc = Fx.scratch('kfx-rail', w, h);
    if (sc) {
      Fx.syncText(sc.g, ctx);
      paintRail(sc.g);
      sc.g.globalCompositeOperation = 'destination-in';
      sc.g.fillStyle = Fx.lineGradient(sc.g, w * .04, 0, w * .96, 0, [[0, 'rgba(0,0,0,0)'], [.14, 'rgba(0,0,0,1)'], [.86, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]);
      sc.g.fillRect(0, 0, w, h);
      ctx.drawImage(sc.c, 0, 0);
    } else {
      paintRail(ctx);
    }
    ctx.restore();
  }, { width: 8, height: .6, maxLines: 1 });


  /* Slot Roll — every glyph lives in its own reel window. A column of
     deterministic decoy characters spins through, decelerates on a spring and
     locks onto the real letter with a tiny overshoot. Fast reels smear with
     motion ghosts and fade at the window edges; each lock-in fires a brass
     flash. */
  E.sigslotroll = lineLoop((ctx, w, h, style, time) => ({ words, lay, phase }) => {
    setFont(ctx, style.effect, lay.size, style);
    const pal = Fx.palette({ text: '#fff7e6', accent: '#ffb347', inactive: 'rgba(255,247,230,.16)' });
    const rows = Fx.rows(ctx, lay, w, h);
    const items = Fx.words(ctx, rows, words);
    const list = Fx.chars(ctx, items);
    const size = lay.size, step = size * 1.02, win = lay.lineH * .98;
    const alphabet = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
    const lift = (phase.leave || 0) * size * .25;
    ctx.save();
    ctx.translate(0, -lift);
    const locks = [];
    list.forEach((g, index) => {
      const word = g.item.word;
      const start = word.time - .2 + g.j * .035;
      const age = time - start;
      if (g.ch === ' ') return;
      if (age <= 0) { ctx.fillStyle = pal.inactive; ctx.fillText(g.ch, g.x, g.y); return; }
      const dur = .55 + g.j * .03;
      const e = Fx.spring(age / dur, 1.1, .72);
      const turns = 5 + (index % 3);
      const pos = (1 - e) * turns;
      const speed = clamp(Math.abs(Fx.spring(age / dur + .01, 1.1, .72) - Fx.spring(age / dur - .01, 1.1, .72)) * 20);
      ctx.save();
      ctx.beginPath();
      ctx.rect(g.x - size * .06, g.y - win / 2, g.w + size * .12, win);
      ctx.clip();
      for (let k = -2; k <= 2; k += 1) {
        const row = Math.round(pos) + k;
        const offset = (row - pos) * step;
        const dist = Math.abs(offset) / (win * .5);
        const fade = clamp(1 - Math.pow(dist, 2.2));
        if (fade <= .01) continue;
        const ch = row === 0 ? g.ch : alphabet[Math.floor(Fx.hash(index * 7.3 + row * 3.1) * alphabet.length)];
        for (let ghost = speed > .1 ? -1 : 0; ghost <= (speed > .1 ? 1 : 0); ghost += 1) {
          ctx.globalAlpha *= 1;
          ctx.save();
          ctx.globalAlpha *= fade * (ghost === 0 ? 1 : .35 * speed);
          ctx.fillStyle = ghost === 0 ? pal.text : pal.accent;
          ctx.fillText(ch, g.x + (g.w - ctx.measureText(ch).width) / 2, g.y + offset + ghost * speed * size * .22);
          ctx.restore();
        }
      }
      ctx.restore();
      const lock = age - dur * .62;
      if (lock > 0 && lock < .4) locks.push({ g, flash: Math.exp(-lock / .1) });
    });
    if (locks.length) {
      Fx.bloom(ctx, w, h, c => {
        locks.forEach(l => { c.fillStyle = Fx.rgba(pal.accent, .85 * l.flash); c.fillText(l.g.ch, l.g.x, l.g.y); });
      }, { radius: size * .34, strength: .9 });
    }
    ctx.restore();
  }, { width: .82, height: .7 });


  /* Stomp Beat — each word lands like a kick drum: it is struck down from above
     with a hard ease-in, compresses on impact, and throws a ring shockwave and
     floor dust that travels outward. The whole stage thumps by a hair on every
     hit. Settled words carry a crisp contact shadow. */
  E.sigstompbeat = lineLoop((ctx, w, h, style, time) => ({ words, lay, phase }) => {
    setFont(ctx, style.effect, lay.size, style);
    const pal = Fx.palette({ text: '#ffffff', accent: '#ffd166', inactive: 'rgba(255,255,255,.18)' });
    const rows = Fx.rows(ctx, lay, w, h);
    const items = Fx.words(ctx, rows, words);
    const size = lay.size;
    /* stage thump: sum of decaying kicks from every recent word */
    let thump = 0;
    items.forEach(item => {
      const age = time - item.word.time;
      if (age >= 0 && age < .35) thump += Math.exp(-age / .06) * Math.cos(age * 55);
    });
    const lift = (phase.leave || 0) * size * .25;
    ctx.save();
    ctx.translate(0, -lift + thump * size * .012);
    ctx.fillStyle = pal.inactive;
    items.forEach(item => { if (time < item.word.time - .12) ctx.fillText(item.text, item.x, item.y); });
    items.forEach(item => {
      const t0 = item.word.time;
      const fall = item.index === 0 ? .06 : .12, age = time - t0;
      if (age < -fall) return;
      const base = item.y + size * .5;
      let dy = 0, sy = 1, sx = 1, alpha = 1;
      if (age < 0) {
        const k = (age + fall) / fall;
        dy = -(1 - k * k * k) * size * 1.5;
        sy = 1 + .18 * k;
        sx = 1 - .06 * k;
        alpha = clamp(k * 1.6);
      } else {
        const c = Math.exp(-age / .09) * Math.cos(age * 30);
        sy = 1 - .22 * clamp(c, -.3, 1);
        sx = 1 + .09 * clamp(c, -.3, 1);
      }
      /* shockwave ring + dust on the floor line */
      if (age > 0 && age < .6) {
        const u = age / .6;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = Fx.rgba(pal.accent, .85 * Math.pow(1 - u, 1.6));
        ctx.lineWidth = Math.max(2, size * .026 * (1 - u));
        ctx.beginPath();
        ctx.ellipse(item.cx, base, item.width * (.35 + .6 * Fx.ease.outCubic(u)), size * (.05 + .06 * u), 0, 0, TAU);
        ctx.stroke();
        for (let p = 0; p < 8; p += 1) {
          const dir = p < 4 ? -1 : 1, seed = item.index * 11 + p;
          const dist = Fx.ease.outCubic(u) * size * (.35 + Fx.hash(seed) * .55) * dir;
          const rise = Math.sin(u * Math.PI) * size * (.08 + Fx.hash(seed + 3) * .18);
          ctx.fillStyle = Fx.rgba('#ffffff', .4 * (1 - u));
          ctx.beginPath();
          ctx.arc(item.cx + dir * item.width * .3 + dist, base - rise, Math.max(1.2, size * .016 * (1 - u * .6)), 0, TAU);
          ctx.fill();
        }
        ctx.restore();
      }
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.translate(item.cx, base);
      ctx.scale(sx, sy);
      ctx.translate(0, -size * .5 + dy);
      ctx.shadowColor = 'rgba(0,0,0,.45)';
      ctx.shadowBlur = size * .08;
      ctx.shadowOffsetY = size * .035;
      const p = U.wordProgress(item.word, time, .06).sweep;
      ctx.fillStyle = U.sweepFill(ctx, -item.width / 2, item.width, p, pal.text, 'rgba(255,255,255,.55)', .3);
      ctx.fillText(item.text, -item.width / 2, 0);
      if (age > 0 && age < .14) {
        ctx.shadowColor = 'transparent';
        ctx.globalAlpha *= (1 - age / .14);
        ctx.fillStyle = pal.accent;
        ctx.fillText(item.text, -item.width / 2, 0);
      }
      ctx.restore();
    });
    ctx.restore();
  }, { width: .8, height: .7 });


  /* Rubber Stretch — the sung word is pulled like taffy: glyphs elongate along
     a bell profile (fattest in the middle), volume is preserved by thinning the
     height, neighbours are pushed apart by the real extra width, and when the
     note ends the word snaps back through rest on a damped spring. Tension
     warms the colour towards coral. */
  E.sigrubberstretch = lineLoop((ctx, w, h, style, time) => ({ words, lay, phase }) => {
    setFont(ctx, style.effect, lay.size, style);
    const pal = Fx.palette({ text: '#ffffff', accent: '#ff7b6b', inactive: 'rgba(255,255,255,.26)' });
    const rows = Fx.rows(ctx, lay, w, h);
    const items = Fx.words(ctx, rows, words);
    const size = lay.size;
    const list = Fx.chars(ctx, items);
    const byWord = new Map();
    items.forEach(item => {
      const dur = Math.max(.1, item.word.endTime - item.word.time);
      const peak = .12 + .3 * clamp(dur / .9);
      let a = 0;
      if (time >= item.word.time && time <= item.word.endTime) a = peak * Fx.ease.outCubic((time - item.word.time) / Math.min(.35, dur));
      else if (time > item.word.endTime) a = peak * (1 - Fx.spring(time - item.word.endTime, 3.1, .3));
      item.a = a;
      item.peak = peak;
      const scales = Array.from(item.text).map((_, j, arr) => 1 + a * (.5 + .5 * Math.cos(((j + .5) / arr.length - .5) * Math.PI)) * 1.25);
      item.scales = scales;
      byWord.set(item, scales);
    });
    rows.forEach(row => {
      const own = items.filter(item => item.ri === row.ri);
      const glyphs = list.filter(g => own.includes(g.item));
      own.forEach(item => {
        const mine = glyphs.filter(g => g.item === item);
        item.newWidth = mine.reduce((sum, g) => sum + g.w * item.scales[g.j], 0);
        item.extra = item.newWidth - item.width;
      });
      const total = own.reduce((sum, item) => sum + item.extra, 0);
      let before = 0;
      own.forEach(item => {
        item.left = item.x + before - total / 2 - 0;
        before += item.extra;
      });
    });
    const lift = (phase.leave || 0) * size * .25;
    ctx.save();
    ctx.translate(0, -lift);
    items.forEach(item => {
      let cursor = item.left;
      const mine = list.filter(g => g.item === item);
      mine.forEach(g => {
        const s = item.scales[g.j];
        const gw = g.w * s;
        const tension = clamp(item.a / item.peak);
        const lit = U.charProgress(item.word, g.j, g.n, time, .85, .3);
        const sy = 1 - item.a * .3;
        const draw = (colour, alpha) => {
          ctx.save();
          ctx.globalAlpha *= alpha;
          ctx.translate(cursor + gw / 2, g.y);
          ctx.scale(s, sy);
          ctx.fillStyle = colour;
          ctx.fillText(g.ch, -g.w / 2, 0);
          ctx.restore();
        };
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,.4)';
        ctx.shadowBlur = size * .08;
        ctx.shadowOffsetY = size * .03;
        draw(pal.inactive, 1);
        ctx.restore();
        draw(pal.text, lit);
        if (tension > .04) draw(pal.accent, tension * .55 * Math.max(lit, .3));
        cursor += gw;
      });
    });
    const tense = items.filter(item => item.a > .06);
    if (tense.length) {
      Fx.bloom(ctx, w, h, c => {
        tense.forEach(item => {
          let cursor = item.left;
          list.filter(g => g.item === item).forEach(g => {
            const s = item.scales[g.j];
            c.save();
            c.translate(cursor + g.w * s / 2, g.y);
            c.scale(s, 1 - item.a * .3);
            c.fillStyle = Fx.rgba(pal.accent, .55 * clamp(item.a / item.peak));
            c.fillText(g.ch, -g.w / 2, 0);
            c.restore();
            cursor += g.w * s;
          });
        });
      }, { radius: size * .3, strength: .8 });
    }
    ctx.restore();
  }, { width: .74, height: .7 });


  /* ------------------------------------------------------------------ */
  /* 10–18  Glow Shaders                                                */
  /* ------------------------------------------------------------------ */

  /* Neon Atmosphere — a lit-room treatment. Two coloured auras drift and breathe
     behind the line, unsung words are cold glass tubes (a thin outline), and a
     word switches on as it is sung: white-hot core, coloured tube glow, wide
     haze. The sung word runs a touch hotter than the ones already lit. */
  E.signeonatmosphere = lineLoop((ctx, w, h, style, time) => ({ words, lay, phase }) => {
    setFont(ctx, style.effect, lay.size, style);
    const pal = Fx.palette({ text: '#fff4fb', accent: '#ff3fa4', inactive: 'rgba(255,255,255,.2)' });
    const second = pal.accentSet ? Fx.mix(pal.accent, '#4fd8ff', .7) : '#3fd0ff';
    const rows = Fx.rows(ctx, lay, w, h);
    const items = Fx.words(ctx, rows, words);
    const size = lay.size, box = Fx.bounds(rows, lay);
    const lift = (phase.leave || 0) * size * .2;
    const breathe = .72 + .28 * Math.sin(time * 1.1);
    ctx.save();
    ctx.translate(0, -lift);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    [[pal.accent, -.28, .9, 0], [second, .3, 1.1, 2.1]].forEach(([colour, off, speed, ph]) => {
      const x = box.cx + box.w * (off + .06 * Math.sin(time * .5 * speed + ph));
      const y = box.cy + size * .12 * Math.cos(time * .43 * speed + ph);
      const r = Math.max(box.w * .5, size * 3) * (.9 + .1 * breathe);
      ctx.fillStyle = Fx.radial(ctx, x, y, 0, r, [[0, Fx.rgba(colour, .26 * breathe)], [.55, Fx.rgba(colour, .09 * breathe)], [1, Fx.rgba(colour, 0)]]);
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    });
    ctx.restore();
    /* cold glass tubes for the unsung type */
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1.2, size * .016);
    ctx.strokeStyle = Fx.rgba(pal.accent, .32);
    items.forEach(item => ctx.strokeText(item.text, item.x, item.y));
    ctx.restore();
    const lit = items.map(item => ({ item, p: U.wordProgress(item.word, time, .08) })).filter(o => o.p.sweep > .02);
    if (lit.length) {
      Fx.bloom(ctx, w, h, g => {
        lit.forEach(({ item, p }) => {
          g.fillStyle = Fx.lineGradient(g, item.x, 0, item.x + item.width, 0, [[0, pal.accent], [1, second]]);
          g.globalAlpha = (.55 + .45 * p.pulse) * Math.min(1, p.sweep * 1.5);
          g.fillText(item.text, item.x, item.y);
        });
      }, { radius: size * .55, strength: 1.05, haze: .5 });
    }
    items.forEach(item => {
      const p = U.wordProgress(item.word, time, .08);
      if (p.sweep <= 0) return;
      ctx.save();
      ctx.beginPath();
      ctx.rect(item.x - size * .1, item.y - size, item.width * Math.min(1, p.sweep * 1.12) + size * .2, size * 2);
      ctx.clip();
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(2, size * .03);
      ctx.strokeStyle = Fx.lineGradient(ctx, item.x, 0, item.x + item.width, 0, [[0, pal.accent], [1, second]]);
      ctx.strokeText(item.text, item.x, item.y);
      ctx.fillStyle = pal.text;
      ctx.fillText(item.text, item.x, item.y);
      if (p.pulse > .05) { ctx.globalAlpha *= p.pulse * .5; ctx.fillStyle = '#fff'; ctx.fillText(item.text, item.x, item.y); }
      ctx.restore();
    });
    ctx.restore();
  }, { width: .82, height: .66 });


  /* Tube Ignition — a sign coming alive. Each letter strikes with its own
     deterministic stutter (on, off, on, half, on) before holding with a faint
     mains shimmer. A lit letter is a real tube: wide coloured glass glow, a
     narrow white-hot core, wide bloom and a soft wall wash; unlit tubes are
     dark grey glass. A cold arc flashes at each strike. */
  E.sigtubeignition = lineLoop((ctx, w, h, style, time) => ({ words, lay, phase }) => {
    setFont(ctx, style.effect, lay.size, style);
    const pal = Fx.palette({ text: '#fff0ee', accent: '#ff4d6d', inactive: 'rgba(255,255,255,.12)' });
    const rows = Fx.rows(ctx, lay, w, h);
    const items = Fx.words(ctx, rows, words);
    const list = Fx.chars(ctx, items);
    const size = lay.size, box = Fx.bounds(rows, lay);
    const pattern = [1, 0, 1, 0, .15, 1, .35, 1, 0, 1];
    const state = list.map((g, index) => {
      const word = g.item.word;
      const age = time - (word.time - .05 + g.j * .045);
      let level = 0, strike = 0;
      if (age > 0) {
        const step = Math.floor(age / .052);
        if (step < pattern.length) { level = pattern[step]; strike = step < 3 ? 1 : 0; } else {
          level = .94 + .06 * Math.sin(time * 94 + index) * Fx.noise(time * 9, index);
        }
      }
      return { g, level, strike, age };
    });
    const lift = (phase.leave || 0) * size * .2;
    ctx.save();
    ctx.translate(0, -lift);
    /* wall wash from everything that is on */
    const on = state.filter(st => st.level > .05);
    if (on.length) {
      const total = on.reduce((a, st) => a + st.level, 0) / state.length;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = Fx.radial(ctx, box.cx, box.cy, 0, box.w * .62, [[0, Fx.rgba(pal.accent, .22 * total)], [1, Fx.rgba(pal.accent, 0)]]);
      ctx.fillRect(box.x - box.w * .2, box.cy - box.w * .6, box.w * 1.4, box.w * 1.2);
      ctx.restore();
    }
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1.5, size * .03);
    ctx.strokeStyle = pal.inactive;
    state.forEach(st => ctx.strokeText(st.g.ch, st.g.x, st.g.y));
    ctx.restore();
    if (on.length) {
      Fx.bloom(ctx, w, h, g => {
        g.lineJoin = 'round';
        g.lineWidth = Math.max(3, size * .06);
        on.forEach(st => { g.strokeStyle = Fx.rgba(pal.accent, .9 * st.level); g.strokeText(st.g.ch, st.g.x, st.g.y); });
      }, { radius: size * .6, strength: 1.1, haze: .5 });
    }
    state.forEach(st => {
      if (st.level <= .02) return;
      ctx.save();
      ctx.globalAlpha *= st.level;
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(2.5, size * .05);
      ctx.strokeStyle = pal.accent;
      ctx.strokeText(st.g.ch, st.g.x, st.g.y);
      ctx.lineWidth = Math.max(1, size * .016);
      ctx.strokeStyle = pal.text;
      ctx.strokeText(st.g.ch, st.g.x, st.g.y);
      ctx.restore();
      if (st.strike && st.level > .5) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = Fx.rgba('#cfe6ff', .5);
        ctx.fillRect(st.g.x - size * .05, st.g.y - size * .004, st.g.w + size * .1, Math.max(1.2, size * .012));
        ctx.restore();
      }
    });
    ctx.restore();
  }, { width: .82, height: .66 });


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
  /* 51  Flagship                                                       */
  /* ------------------------------------------------------------------ */

  /* Luminaire — a cinematic title-sequence treatment. Polished metal type with
     real thickness (bronze extrusion + rim light), a brushed grain that a slow
     specular sheen travels across, word-by-word soft reveal, an anamorphic
     streak with lens-flare ghosts riding the sung word, drifting light motes
     that brighten near the voice, a falling-off mirror reflection, film grain
     and a rack-focus entrance / exit. Colours come from the user's text and
     accent choices when set; otherwise champagne gold. */
  E.sigluminaire = lineLoop((ctx, w, h, style, time) => ({ words, lay, phase }) => {
    setFont(ctx, style.effect, lay.size, style);
    const pal = Fx.palette({ text: '#f3d58b', accent: '#ffe6b0', inactive: 'rgba(243,213,139,.22)' });
    const rows = Fx.rows(ctx, lay, w, h);
    const items = Fx.words(ctx, rows, words);
    if (!items.length) return;
    const size = lay.size;
    const box = Fx.bounds(rows, lay);
    const top = Fx.mix(pal.text, '#ffffff', .62), mid = pal.text, low = Fx.mix(pal.text, '#000000', .5), edge = Fx.mix(pal.text, '#ffffff', .8);
    const depth = Math.max(2, Math.round(size * .034));
    const focus = (1 - clamp(phase.enter == null ? 1 : phase.enter)) * 12 + clamp(phase.leave || 0) * 10;
    const lift = (phase.leave || 0) * size * .2;
    const active = items.reduce((best, item) => (time >= item.word.time && time <= item.word.endTime + .3 ? item : best), null);
    const pulse = active ? U.wordProgress(active.word, time, .06).pulse : 0;
    /* slow sheen: one pass every ~5.5s, plus a stronger pass on each new word */
    const sheenAt = (box.x - size) + (box.w + size * 2) * (((time * .18) % 1.25) / 1.25);
    const paintFace = g => {
      /* bronze thickness */
      g.save();
      g.fillStyle = low;
      for (let k = depth; k >= 1; k -= 1) rows.forEach(row => g.fillText(row.text, row.x + k * .45, row.y + k * .85));
      g.restore();
      /* rim light under the face */
      g.save();
      g.lineJoin = 'round';
      g.lineWidth = Math.max(1.2, size * .014);
      g.strokeStyle = Fx.rgba(edge, .7);
      rows.forEach(row => g.strokeText(row.text, row.x - .5, row.y - .8));
      g.restore();
      /* face: polished vertical gradient, then brushed grain + sheen on the glyphs only */
      Fx.masked(g, w, h, m => {
        m.fillStyle = Fx.lineGradient(m, 0, box.y, 0, box.y + box.h, [[0, top], [.38, mid], [.62, Fx.mix(mid, low, .25)], [.8, mid], [1, Fx.mix(mid, low, .55)]]);
        rows.forEach(row => m.fillText(row.text, row.x, row.y));
      }, m => {
        m.fillStyle = 'rgba(255,255,255,.07)';
        for (let y = box.y; y < box.y + box.h; y += 3) {
          if (Fx.hash(y * .71) > .45) m.fillRect(box.x, y, box.w, 1);
        }
        m.fillStyle = 'rgba(0,0,0,.06)';
        for (let y = box.y + 1; y < box.y + box.h; y += 4) {
          if (Fx.hash(y * 1.3 + 5) > .5) m.fillRect(box.x, y, box.w, 1);
        }
        const band = (cx, strength) => {
          m.fillStyle = Fx.lineGradient(m, cx - size * .7, box.y + box.h, cx + size * .7, box.y, [[0, 'rgba(255,255,255,0)'], [.5, `rgba(255,252,240,${strength})`], [1, 'rgba(255,255,255,0)']]);
          m.fillRect(cx - size * .8, box.y - size * .2, size * 1.6, box.h + size * .4);
        };
        Fx.grain(m, box.x, box.y, box.w, box.h, time, .14, 'source-atop');
        band(sheenAt, .5);
        if (active) band(active.cx + (active.width * (U.wordProgress(active.word, time, .06).sweep - .5)), .55 * pulse);
      });
    };
    const paintLit = g => paintFace(g);
    ctx.save();
    ctx.translate(0, -lift);
    /* drifting light motes behind the type */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 30; i += 1) {
      const sp = .012 + Fx.hash(i * 2.3) * .03;
      const x = box.x - size + Fx.hash(i * 5.1 + 1) * (box.w + size * 2) + Math.sin(time * .4 + i) * size * .15;
      const y = box.y + box.h * 1.15 - (((time * sp * h * .5 + Fx.hash(i * 9.7) * box.h * 2.6) % (box.h * 2.6)));
      const near = active ? clamp(1 - Math.abs(x - active.cx) / (size * 3.2)) : 0;
      const a = (.12 + .5 * near * pulse) * (.5 + .5 * Math.sin(time * 1.7 + i * 2.1)) * clamp((y - (box.y - size * 1.2)) / size) ;
      if (a <= .01) continue;
      const r = size * (.025 + Fx.hash(i * 3.3) * .05);
      ctx.fillStyle = Fx.radial(ctx, x, y, 0, r, [[0, Fx.rgba(pal.accent, a)], [1, Fx.rgba(pal.accent, 0)]]);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    /* mirror reflection that falls away */
    const floorY = box.y + box.h + size * .04;
    const refl = Fx.scratch('kfx-refl', w, h);
    if (refl) {
      Fx.syncText(refl.g, ctx);
      refl.g.save();
      refl.g.translate(0, floorY * 2);
      refl.g.scale(1, -1);
      Fx.softReveal(refl.g, w, h, items, time, g => {
        g.fillStyle = Fx.lineGradient(g, 0, box.y, 0, box.y + box.h, [[0, top], [.5, mid], [1, low]]);
        rows.forEach(row => g.fillText(row.text, row.x, row.y));
      }, { size, edge: .3 });
      refl.g.restore();
      refl.g.globalCompositeOperation = 'destination-in';
      refl.g.fillStyle = Fx.lineGradient(refl.g, 0, floorY, 0, floorY + size * .95, [[0, 'rgba(0,0,0,.34)'], [1, 'rgba(0,0,0,0)']]);
      refl.g.fillRect(0, floorY, w, size);
      ctx.drawImage(refl.c, 0, 0);
    }
    /* body: soft contact shadow, ghost line, then the revealed metal under a rack-focus */
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.55)';
    ctx.shadowBlur = size * .18;
    ctx.shadowOffsetY = size * .06;
    ctx.fillStyle = pal.inactive;
    rows.forEach(row => ctx.fillText(row.text, row.x, row.y));
    ctx.restore();
    if (focus > .2) blur(ctx, focus);
    Fx.softReveal(ctx, w, h, items, time, paintLit, { size, edge: .34 });
    if ('filter' in ctx) ctx.filter = 'none';
    /* bloom from the voice + a whisper of glow on everything lit */
    if (active) {
      Fx.bloom(ctx, w, h, g => {
        g.fillStyle = Fx.rgba(pal.accent, .7 * pulse);
        g.fillText(active.text, active.x, active.y);
      }, { radius: size * .5, strength: .95, haze: .4 });
      /* anamorphic streak + flare ghosts */
      const cx = active.cx, cy = active.y;
      const span = Math.min(w * .9, box.w * 1.5 + size * 4);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = Fx.lineGradient(ctx, cx - span / 2, 0, cx + span / 2, 0, [[0, Fx.rgba(pal.accent, 0)], [.5, Fx.rgba('#ffffff', .6 * pulse)], [1, Fx.rgba(pal.accent, 0)]]);
      ctx.fillRect(cx - span / 2, cy - size * .012, span, Math.max(1.5, size * .026));
      [[-.55, .2, '#8fd3ff'], [.45, .14, '#ffd0a0'], [1.2, .3, '#ffb6e1']].forEach(([k, r, tint]) => {
        const gx = box.cx + (cx - box.cx) * -k, rad = size * r;
        ctx.fillStyle = Fx.radial(ctx, gx, cy, 0, rad, [[0, Fx.rgba(tint, .16 * pulse)], [.7, Fx.rgba(tint, .06 * pulse)], [1, Fx.rgba(tint, 0)]]);
        ctx.beginPath();
        ctx.arc(gx, cy, rad, 0, TAU);
        ctx.fill();
      });
      ctx.restore();
    }
    ctx.restore();
  }, { width: .8, height: .66 });

  /* Press Cycle — every sung word is struck through a rapid collage of editorial
     cover styles. Eight original newsstand voices (fashion serif, tabloid, newsprint
     with halftone, terminal mono, glossy pop, torn zine, lifestyle script, sports
     condensed) land as paper tiles on top of each other, each with its own stock,
     ink, texture, tilt and shadow, then the pile whips away and the word settles
     into the clean line. The style order is different for every word. */
  const PRESS_STYLES = [
    { family: 'VogueNoir', weight: 400, bg: '#f3eee4', ink: '#121212', rule: '#121212', fit: .84, tag: 'N° 12' },
    { family: 'Anton', weight: 400, bg: '#ffd400', ink: '#111111', upper: true, fit: .9, tag: 'EXCLUSIVE' },
    { family: 'AuraSerif', weight: 400, bg: '#e6e0cf', ink: '#1c1b18', halftone: true, fit: .86, tag: 'LATE EDITION' },
    { family: 'Courier Prime', weight: 700, bg: '#08100c', ink: '#79ffa0', upper: true, scan: true, fit: .86, tag: 'v2.0' },
    { family: 'Inter Tight', weight: 900, bg: ['#ff3d8b', '#ff8a3d'], ink: '#ffffff', fit: .9, shadow: '#7a0f3a', tag: 'ISSUE 07' },
    { family: 'BlockParty', weight: 400, bg: '#fbfaf6', ink: '#0a0a0a', torn: true, tape: true, fit: .86, tag: 'ZINE' },
    { family: 'Homemade Apple', weight: 400, bg: '#f7d6c7', ink: '#7a2e1d', lower: true, fit: .8, tag: 'Spring' },
    { family: 'Archivo Narrow', weight: 900, bg: '#0b2c73', ink: '#ffffff', upper: true, stripes: true, fit: .92, tag: 'MATCHDAY' },
  ];

  E.sigpresscycle = lineLoop((ctx, w, h, style, time) => ({ words, lay, phase }) => {
    setFont(ctx, style.effect, lay.size, style);
    const pal = Fx.palette({ text: '#ffffff', accent: '#ffffff', inactive: 'rgba(255,255,255,.24)' });
    const rows = Fx.rows(ctx, lay, w, h);
    const items = Fx.words(ctx, rows, words);
    const size = lay.size;
    const lift = (phase.leave || 0) * size * .25;
    const baseFont = ctx.font, baseSpacing = ctx.letterSpacing;
    ctx.save();
    ctx.translate(0, -lift);
    ctx.shadowColor = 'rgba(0,0,0,.35)';
    ctx.shadowBlur = size * .08;
    ctx.shadowOffsetY = size * .025;
    Fx.sung(ctx, items, time, pal.text, pal.inactive, .3);
    ctx.shadowColor = 'transparent';
    const tile = (st, text, cx, cy, tw, th, rot, scale, seed, alpha) => {
      const label = st.upper ? text.toUpperCase() : st.lower ? text.toLowerCase() : text;
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.scale(scale, scale);
      ctx.shadowColor = 'rgba(0,0,0,.5)';
      ctx.shadowBlur = size * .14;
      ctx.shadowOffsetY = size * .05;
      /* paper stock */
      ctx.beginPath();
      if (st.torn) {
        const n = 14;
        for (let i = 0; i <= n; i += 1) ctx.lineTo(-tw / 2 + tw * i / n, -th / 2 + (Fx.hash(seed + i) - .5) * th * .09);
        for (let i = 0; i <= 5; i += 1) ctx.lineTo(tw / 2 + (Fx.hash(seed + 30 + i) - .5) * tw * .03, -th / 2 + th * i / 5);
        for (let i = n; i >= 0; i -= 1) ctx.lineTo(-tw / 2 + tw * i / n, th / 2 + (Fx.hash(seed + 60 + i) - .5) * th * .09);
        for (let i = 5; i >= 0; i -= 1) ctx.lineTo(-tw / 2 + (Fx.hash(seed + 90 + i) - .5) * tw * .03, -th / 2 + th * i / 5);
      } else ctx.rect(-tw / 2, -th / 2, tw, th);
      ctx.closePath();
      ctx.fillStyle = Array.isArray(st.bg) ? Fx.lineGradient(ctx, -tw / 2, -th / 2, tw / 2, th / 2, [[0, st.bg[0]], [1, st.bg[1]]]) : st.bg;
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.save();
      ctx.clip();
      if (st.halftone) {
        ctx.fillStyle = 'rgba(0,0,0,.13)';
        for (let y = -th / 2 + 3; y < th / 2; y += 6) for (let x = -tw / 2 + 3 + ((y / 6) % 2) * 3; x < tw / 2; x += 6) {
          ctx.beginPath(); ctx.arc(x, y, 1.15 + (y + th / 2) / th * 1.2, 0, TAU); ctx.fill();
        }
      }
      if (st.scan) { ctx.fillStyle = 'rgba(121,255,160,.08)'; for (let y = -th / 2; y < th / 2; y += 3) ctx.fillRect(-tw / 2, y, tw, 1); }
      if (st.stripes) { ctx.fillStyle = 'rgba(255,255,255,.08)'; for (let x = -tw; x < tw; x += th * .38) { ctx.beginPath(); ctx.moveTo(x, th / 2); ctx.lineTo(x + th * .2, th / 2); ctx.lineTo(x + th * .2 + th, -th / 2); ctx.lineTo(x + th, -th / 2); ctx.fill(); } }
      if (st.rule) { ctx.fillStyle = st.rule; ctx.fillRect(-tw / 2 + th * .08, -th / 2 + th * .09, tw - th * .16, Math.max(1, th * .014)); ctx.fillRect(-tw / 2 + th * .08, th / 2 - th * .1, tw - th * .16, Math.max(1, th * .014)); }
      ctx.restore();
      /* headline, fitted to the tile */
      const probe = th * .72;
      U.setFont(ctx, st.family, probe, Fx.fontWeight(st.family, st.weight));
      Fx.letterSpacing(ctx, 0);
      const mw = Math.max(1, ctx.measureText(label).width);
      const px = Math.min(probe * 1.25, probe * (tw * st.fit) / mw);
      U.setFont(ctx, st.family, px, Fx.fontWeight(st.family, st.weight));
      Fx.letterSpacing(ctx, 0);
      const tx = -ctx.measureText(label).width / 2;
      if (st.shadow) { ctx.fillStyle = st.shadow; ctx.fillText(label, tx + px * .05, px * .02 + px * .05); }
      ctx.fillStyle = st.ink;
      ctx.fillText(label, tx, px * .02);
      /* micro tag */
      U.setFont(ctx, 'Courier Prime', Math.max(7, th * .11), 700);
      Fx.letterSpacing(ctx, 1);
      ctx.fillStyle = st.ink;
      ctx.globalAlpha *= .55;
      ctx.fillText(st.tag, -tw / 2 + th * .08, th / 2 - th * .09);
      if (st.tape) {
        ctx.globalAlpha = alpha / .55 * .9;
        ctx.fillStyle = 'rgba(255,230,150,.75)';
        ctx.save();
        ctx.translate(tw * .3, -th / 2);
        ctx.rotate(.12);
        ctx.fillRect(-th * .3, -th * .08, th * .6, th * .16);
        ctx.restore();
      }
      ctx.restore();
    };
    items.forEach(item => {
      const count = Math.max(4, Math.min(8, Math.round((item.word.endTime - item.word.time) / .11)));
      const cad = Math.min(.085, Math.max(.05, (item.word.endTime - item.word.time) * .7 / count));
      const t0 = item.word.time, burstEnd = t0 + count * cad;
      const tEnd = burstEnd + .16;
      if (time < t0 || time > tEnd + .14) return;
      const exit = time > tEnd ? clamp((time - tEnd) / .14) : 0;
      const start = Math.floor(Fx.hash(item.index * 4.7 + 3) * PRESS_STYLES.length);
      for (let k = 0; k < count; k += 1) {
        const born = t0 + k * cad;
        if (time < born) break;
        const age = time - born;
        const pop = 1 + .22 * Math.exp(-age / .035);
        const seed = item.index * 17 + k * 5;
        const st = PRESS_STYLES[(start + k * 3) % PRESS_STYLES.length];
        const tw = item.width + size * .6, th = size * 1.12;
        tile(
          st, item.text,
          item.cx + (Fx.hash(seed) - .5) * item.width * .2 + exit * (Fx.hash(seed + 2) - .5) * size * 1.5,
          item.y + (Fx.hash(seed + 1) - .5) * size * .2 - exit * size * .9,
          tw, th, (Fx.hash(seed + 3) - .5) * .13 + exit * (Fx.hash(seed + 4) - .5) * .5,
          pop * (1 - exit * .2), seed, clamp(age / .02) * (1 - exit),
        );
      }
    });
    ctx.font = baseFont;
    Fx.letterSpacing(ctx, 0);
    ctx.restore();
  }, { width: .76, height: .66 });

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
