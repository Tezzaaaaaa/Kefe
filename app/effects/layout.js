/* KEFE — lyric effect layout engine.
 *
 * Every lyric effect renders inside a resolved "box". The user's per-effect
 * controls (size, horizontal, vertical, width, line spacing) move and resize
 * that box; the effect then fits its text inside it. Because the box is always
 * clamped to the canvas safe area, text can never be pushed off-screen — moving
 * the box towards an edge narrows it instead, and the text refits.
 *
 * Effects are called as fn(ctx, boxW, boxH, style, lines, time) with the
 * context already translated to the box origin, so an effect that centres on
 * (w/2, h/2) is automatically centred on the user's chosen position.
 * style.fxBox = { ox, oy, cw, ch } gives the true canvas size for effects that
 * draw full-bleed decoration (translate(-ox,-oy) to reach canvas coordinates).
 */
(() => {
  'use strict';
  if (window.kefeLayout) return;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const num = (v, d) => (Number.isFinite(Number(v)) && v !== '' && v !== null ? Number(v) : d);

  /* The controls every effect gets. `def` is the neutral value. */
  const CONTROLS = [
    { id: 'size',    label: 'Text size',            min: 40,  max: 220, step: 1, def: 100, suffix: '%' },
    { id: 'x',       label: 'Horizontal position',  min: -40, max: 40,  step: 1, def: 0,   suffix: '%' },
    { id: 'y',       label: 'Vertical position',    min: -45, max: 45,  step: 1, def: 0,   suffix: '%' },
    { id: 'width',   label: 'Text width',           min: 40,  max: 100, step: 1, def: 100, suffix: '%' },
    { id: 'spacing', label: 'Line spacing',         min: 70,  max: 170, step: 1, def: 100, suffix: '%' }
  ];

  /* Per-effect natural placement. Fractions of the canvas.
     font   – multiplier on the 76px base (at 1080 short side)
     box    – (w,h) => { cx, cy, w, h }                                      */
  const stdBox = (w, h) => {
    const land = w > h * 1.2, sq = !land && Math.abs(w - h) < 2;
    if (land) return { cx: .5, cy: .5, w: .80 * w, h: .70 * h };
    if (sq)   return { cx: .5, cy: .5, w: .86 * w, h: .66 * h };
    return { cx: .5, cy: .5, w: .88 * w, h: .56 * h };
  };
  const lowBox = (w, h) => { const b = stdBox(w, h); return { ...b, cy: .74, h: .34 * h }; };
  const fullBox = (w, h) => {
    const land = w > h * 1.2;
    return land ? { cx: .5, cy: .5, w: .78 * w, h: .90 * h } : { cx: .5, cy: .5, w: .90 * w, h: .90 * h };
  };
  const squareBox = (w, h) => {
    const s = Math.min(w, h) * .94;
    return { cx: .5, cy: .5, w: Math.min(s, w * .96), h: Math.min(s, h * .94) };
  };

  const SPEC = {
    apple:       { font: 1.00, box: fullBox },
    brat:        { font: 1.75, box: squareBox },
    eternal:     { font: 1.20, box: (w, h) => ({ cx: .5, cy: .5, w: .90 * w, h: (w > h ? .80 : .70) * h }) },
    aurora:      { font: 1.55, box: stdBox },
    pulse:       { font: 1.35, box: stdBox },
    typewriter:  { font: 1.10, box: stdBox },
    instagram:   { font: 1.00, box: (w, h) => ({ cx: .5, cy: .5, w: (w > h ? .60 : .74) * w, h: .80 * h }) },
    fadeup:      { font: 1.35, box: stdBox },
    decrypt:     { font: 1.20, box: stdBox },
    blur:        { font: 1.35, box: stdBox },
    shiny:       { font: 1.40, box: stdBox },
    rise:        { font: 1.30, box: lowBox },
    slide:       { font: 1.30, box: lowBox },
    drop:        { font: 1.30, box: lowBox },
    drift:       { font: 1.30, box: lowBox },
    scrolllines: { font: 1.10, box: fullBox },
    barbie:      { font: 1.60, box: stdBox },
    elasticpop:  { font: 1.60, box: stdBox },
    flipcards:   { font: 1.45, box: stdBox },
    karaoke:     { font: 1.40, box: stdBox },
    trailer:     { font: 1.70, box: stdBox },
    rain:        { font: 1.35, box: stdBox },
    fancy:       { font: 2.00, box: stdBox },
    glitch:      { font: 2.00, box: stdBox },
    analogtv:    { font: 1.50, box: stdBox },
    splitflap:   { font: 1.90, box: stdBox },
    chromatica:  { font: 1.95, box: stdBox }
  };
  const specFor = key => SPEC[key] || { font: 1.2, box: stdBox };

  const keyOf = (effect, id) => `fx_${effect}_${id}`;

  function defaults() {
    const out = {};
    const list = Array.isArray(window.KEFE_EFFECTS) ? window.KEFE_EFFECTS.map(e => e.key) : Object.keys(SPEC);
    for (const eff of list) for (const c of CONTROLS) out[keyOf(eff, c.id)] = c.def;
    return out;
  }

  function get(style, effect) {
    const g = id => num(style && style[keyOf(effect, id)], CONTROLS.find(c => c.id === id).def);
    return {
      size: clamp(g('size'), 40, 220) / 100,
      x: clamp(g('x'), -40, 40) / 100,
      y: clamp(g('y'), -45, 45) / 100,
      width: clamp(g('width'), 40, 100) / 100,
      spacing: clamp(g('spacing'), 70, 170) / 100
    };
  }

  /* Resolve the box for an effect on a w×h canvas. */
  function resolve(effect, w, h, style) {
    const sp = specFor(effect), u = get(style, effect);
    const base = sp.box(w, h);
    const m = Math.min(w, h) * .03;
    const cx = clamp(base.cx * w + u.x * w, m, w - m);
    const cy = clamp(base.cy * h + u.y * h, m, h - m);
    const halfW = Math.max(20, Math.min(base.w * u.width / 2, cx - m, w - m - cx));
    const halfH = Math.max(20, Math.min(base.h / 2, cy - m, h - m - cy));
    const short = Math.min(w, h) / 1080;
    return {
      ox: cx - halfW, oy: cy - halfH, bw: halfW * 2, bh: halfH * 2, cx, cy,
      fontSize: 76 * short * sp.font * u.size, spacing: u.spacing, size: u.size
    };
  }

  /* Draw an effect through its resolved box. */
  function render(effect, ctx, w, h, style, lines, time, fn) {
    const L = resolve(effect, w, h, style);
    const s = Object.assign({}, style, {
      fontSize: L.fontSize,
      fxSpacing: L.spacing,
      fxSize: L.size,
      fxBox: { ox: L.ox, oy: L.oy, cw: w, ch: h, cx: L.cx, cy: L.cy }
    });
    ctx.save();
    ctx.translate(L.ox, L.oy);
    try { fn(ctx, L.bw, L.bh, s, lines, time); } finally { ctx.restore(); }
  }

  /* Control definitions for the UI: [{key,label,min,max,step,suffix,def}] */
  function controls(effect) {
    return CONTROLS.map(c => ({ ...c, key: keyOf(effect, c.id) }));
  }

  window.kefeLayout = Object.freeze({ CONTROLS, SPEC, keyOf, defaults, get, resolve, render, controls });
})();
