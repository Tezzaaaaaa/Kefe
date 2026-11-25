/* KEFE — independent style settings for each lyric effect.
   An empty colour means "use the effect's own colour". */
(function () {
  'use strict';
  var KEY = 'kefe.style.v1';
  var DEFAULT = {
    textColor: '', accentColor: '', inactiveColor: '',
    scale: 100, offsetX: 0, offsetY: 0,
    outline: { on: false, color: '#000000', width: 4 },
    glow: { on: false, color: '#ffffff', blur: 24, strength: 70 }
  };
  var COLOR_SWATCHES = ['#ffffff', '#171719', '#f16a67', '#f0a35e', '#e7cf63', '#77c7a5', '#69a8f4', '#a88be8'];

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function merge(base, extra) {
    var out = clone(base);
    if (!extra || typeof extra !== 'object') return out;
    Object.keys(out).forEach(function (k) {
      if (out[k] && typeof out[k] === 'object') out[k] = Object.assign({}, out[k], extra[k] && typeof extra[k] === 'object' ? extra[k] : {});
      else if (extra[k] != null && typeof extra[k] === typeof out[k]) out[k] = extra[k];
    });
    return out;
  }
  var activeEffect = 'apple', renderingEffect = '';
  var effects = {};
  try {
    var saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && saved.version === 2 && saved.effects && typeof saved.effects === 'object') {
      Object.keys(saved.effects).forEach(function (id) { effects[id] = merge(DEFAULT, saved.effects[id]); });
    } else if (saved && typeof saved === 'object' && ('scale' in saved || 'textColor' in saved || 'outline' in saved || 'glow' in saved)) {
      effects.apple = merge(DEFAULT, saved);
    }
  } catch (e) { /* storage unavailable */ }
  var S = clone(effects[activeEffect] || DEFAULT);
  function persist(id, value) {
    id = id || activeEffect;
    effects[id] = clone(value || (id === activeEffect ? S : DEFAULT));
    try { localStorage.setItem(KEY, JSON.stringify({ version: 2, effects: effects })); } catch (e) { /* ignore */ }
  }
  function stateFor(id) { return id === activeEffect ? S : (effects[id] || DEFAULT); }
  function redraw() { try { if (window.kefeLyrics) window.kefeLyrics.redraw(); } catch (e) { /* ignore */ } }

  function validColor(v) { return /^#[0-9a-f]{6}$/i.test(String(v || '')); }

  /* ---------- effect style ---------- */
  function style(base) {
    var state = stateFor(base.effect || activeEffect);
    var s = Object.assign({}, base);
    s.fontSize = (Number(base.fontSize) || 80) * (state.scale / 100);
    if (validColor(state.textColor)) { s.textColor = state.textColor; s.flipcardsColor = state.textColor; }
    if (validColor(state.accentColor)) { s.accentColor = state.accentColor; s.flipcardsAccent = state.accentColor; }
    if (validColor(state.inactiveColor)) s.karaokeInactiveColor = state.inactiveColor;
    return s;
  }

  /* ---------- post-processing (placement, outline, glow) ---------- */
  var layerA = null, layerB = null;
  function sized(c, w, h) { if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } return c; }
  function active(state) { state = state || S; return state.outline.on || state.glow.on || state.offsetX !== 0 || state.offsetY !== 0; }

  /* Fill every non-transparent pixel of `src` with `color` (a silhouette). */
  function silhouette(dst, src, color, w, h) {
    var g = dst.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over'; g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
  }

  function post(ctx, w, h, paint, effectId) {
    var previousEffect = renderingEffect;
    var id = effectId || activeEffect;
    var state = stateFor(id);
    renderingEffect = id;
    if (!active(state)) {
      try { paint(ctx); } finally { renderingEffect = previousEffect; }
      return;
    }
    layerA = sized(layerA || document.createElement('canvas'), w, h);
    var a = layerA.getContext('2d');
    a.setTransform(1, 0, 0, 1, 0, 0); a.globalAlpha = 1; a.globalCompositeOperation = 'source-over'; a.filter = 'none';
    a.clearRect(0, 0, w, h);
    try {
      paint(a);
      var dx = w * state.offsetX / 100, dy = h * state.offsetY / 100;
      var u = Math.min(w, h) / 720;
      ctx.save();
      try {
        ctx.translate(dx, dy);
        if (state.glow.on) {
          layerB = sized(layerB || document.createElement('canvas'), w, h);
          silhouette(layerB, layerA, state.glow.color, w, h);
          var blur = Math.max(1, state.glow.blur * u);
          var passes = state.glow.strength > 66 ? 3 : state.glow.strength > 33 ? 2 : 1;
          ctx.save();
          try { ctx.filter = 'blur(' + blur + 'px)'; } catch (e) { /* filter unsupported: harder edge */ }
          ctx.globalAlpha = Math.min(1, state.glow.strength / 70);
          for (var i = 0; i < passes; i++) ctx.drawImage(layerB, 0, 0);
          ctx.restore();
        }
        if (state.outline.on && state.outline.width > 0) {
          layerB = sized(layerB || document.createElement('canvas'), w, h);
          silhouette(layerB, layerA, state.outline.color, w, h);
          var r = Math.max(1, state.outline.width * u), steps = Math.max(12, Math.min(32, Math.round(r * 2.5)));
          for (var k = 0; k < steps; k++) {
            var ang = k / steps * Math.PI * 2;
            ctx.drawImage(layerB, Math.cos(ang) * r, Math.sin(ang) * r);
          }
        }
        ctx.drawImage(layerA, 0, 0);
      } finally { ctx.restore(); }
    } finally { renderingEffect = previousEffect; }
  }

  /* ---------- UI ---------- */
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function group(title) {
    var g = el('details', 'kefe-visualiser-control-group kefe-style-disclosure');
    var summary = el('summary', null, title);
    g.appendChild(summary);
    if (title === 'Size and placement') g.open = true;
    return g;
  }
  function slider(label, get, set, min, max, step, fmt) {
    var wrap = el('label', 'kefe-visualiser-field'), head = el('span'), b = el('b', null, label), out = el('output');
    head.append(b, out);
    var input = document.createElement('input'); input.type = 'range'; input.min = min; input.max = max; input.step = step;
    function sync() { input.value = get(); out.textContent = fmt(get()); }
    input.addEventListener('input', function () { set(Number(input.value)); out.textContent = fmt(Number(input.value)); persist(); redraw(); });
    wrap.append(head, input); sync(); wrap.sync = sync;
    return wrap;
  }
  function toggleRow(label, get, set) {
    var row = el('div', 'kefe-visualiser-spin-row'), btn = el('button', 'kefe-btn kefe-switch', ''); btn.type = 'button';
    var state = el('span', 'kefe-switch-state'), track = el('span', 'kefe-switch-track'); track.setAttribute('aria-hidden', 'true'); track.appendChild(el('span', 'kefe-switch-thumb')); btn.append(state, track);
    row.appendChild(el('span', 'kefe-label', label));
    function sync() { var on = !!get(); state.textContent = on ? 'On' : 'Off'; btn.setAttribute('role', 'switch'); btn.setAttribute('aria-label', label); btn.setAttribute('aria-checked', String(on)); btn.classList.toggle('is-on', on); }
    btn.addEventListener('click', function () { set(!get()); sync(); persist(); redraw(); });
    row.appendChild(btn); sync(); row.sync = sync;
    return row;
  }
  function colorRow(label, get, set, allowDefault) {
    var row = el('div', 'kefe-visualiser-spin-row kefe-style-color-row'), right = el('span', 'kefe-style-color-wrap');
    var input = document.createElement('input'); input.type = 'color'; input.className = 'kefe-style-color'; input.setAttribute('aria-label', label + ' custom colour');
    var reset = el('button', 'kefe-btn kefe-style-mini', 'Auto'); reset.type = 'button'; reset.title = 'Use the effect colour';
    var palette = el('div', 'kefe-style-color-swatches'); palette.setAttribute('role', 'group'); palette.setAttribute('aria-label', label + ' preset colours');
    var swatches = COLOR_SWATCHES.map(function (color) {
      var button = el('button', 'kefe-style-swatch'); button.type = 'button';
      button.style.setProperty('--swatch-color', color); button.title = color; button.setAttribute('aria-label', label + ' ' + color);
      button.addEventListener('click', function () { set(color); sync(); persist(); redraw(); });
      palette.appendChild(button); return { color: color, button: button };
    });
    function sync() {
      var current = validColor(get()) ? get().toLowerCase() : '';
      input.value = current || '#ffffff';
      if (allowDefault) reset.hidden = !current;
      swatches.forEach(function (item) { item.button.setAttribute('aria-pressed', item.color === current ? 'true' : 'false'); });
    }
    input.addEventListener('input', function () { set(input.value); sync(); persist(); redraw(); });
    reset.addEventListener('click', function () { set(''); sync(); persist(); redraw(); });
    row.appendChild(el('span', 'kefe-label', label));
    right.appendChild(input); if (allowDefault) right.appendChild(reset);
    row.append(right, palette); sync(); row.sync = sync;
    return row;
  }

  var syncers = [];
  function reg(node) { if (node.sync) syncers.push(node.sync); return node; }

  function buildUi() {
    var panel = document.querySelector('[data-panel-view="effects"] .kefe-form');
    if (!panel || document.getElementById('kefeStyleGroup')) return;
    var wrap = el('div'); wrap.id = 'kefeStyleGroup';
    wrap.style.display = 'grid'; wrap.style.gap = '14px';

    var colours = group('Colour');
    colours.append(
      reg(colorRow('Text', function () { return S.textColor; }, function (v) { S.textColor = v; }, true)),
      reg(colorRow('Active / accent', function () { return S.accentColor; }, function (v) { S.accentColor = v; }, true)),
      reg(colorRow('Inactive words', function () { return S.inactiveColor; }, function (v) { S.inactiveColor = v; }, true))
    );

    var place = group('Size and placement');
    place.append(
      reg(slider('Text size', function () { return S.scale; }, function (v) { S.scale = v; }, 50, 160, 1, function (v) { return v + '%'; })),
      reg(slider('Horizontal', function () { return S.offsetX; }, function (v) { S.offsetX = v; }, -40, 40, 1, function (v) { return (v > 0 ? '+' : '') + v + '%'; })),
      reg(slider('Vertical', function () { return S.offsetY; }, function (v) { S.offsetY = v; }, -40, 40, 1, function (v) { return (v > 0 ? '+' : '') + v + '%'; }))
    );

    var out = group('Outline');
    out.append(
      reg(toggleRow('Outline', function () { return S.outline.on; }, function (v) { S.outline.on = v; })),
      reg(colorRow('Outline colour', function () { return S.outline.color; }, function (v) { S.outline.color = v; }, false)),
      reg(slider('Outline width', function () { return S.outline.width; }, function (v) { S.outline.width = v; }, 1, 16, 1, function (v) { return v + 'px'; }))
    );

    var glow = group('Glow');
    glow.append(
      reg(toggleRow('Glow', function () { return S.glow.on; }, function (v) { S.glow.on = v; })),
      reg(colorRow('Glow colour', function () { return S.glow.color; }, function (v) { S.glow.color = v; }, false)),
      reg(slider('Glow size', function () { return S.glow.blur; }, function (v) { S.glow.blur = v; }, 2, 80, 1, function (v) { return v + 'px'; })),
      reg(slider('Glow strength', function () { return S.glow.strength; }, function (v) { S.glow.strength = v; }, 10, 100, 1, function (v) { return v + '%'; }))
    );

    var resetBtn = el('button', 'kefe-btn shad-btn shad-btn--outline', 'Reset lyric style'); resetBtn.type = 'button';
    resetBtn.dataset.slot = 'button'; resetBtn.dataset.variant = 'outline'; resetBtn.dataset.size = 'default';
    resetBtn.addEventListener('click', function () {
      S = clone(DEFAULT);
      syncers.forEach(function (fn) { fn(); }); persist(); redraw();
    });

    var head = el('div', 'kefe-label', 'Lyric style');
    head.style.marginTop = '4px';
    wrap.append(head, colours, place, out, glow, resetBtn);
    var anchorEl = panel.querySelector('.kefe-font-card');
    if (anchorEl && anchorEl.nextSibling) panel.insertBefore(wrap, anchorEl.nextSibling); else panel.appendChild(wrap);
    syncers.forEach(function (fn) { fn(); });
  }

  function activate(id) {
    if (!id || id === activeEffect) return clone(S);
    effects[activeEffect] = clone(S);
    activeEffect = String(id);
    S = clone(effects[activeEffect] || DEFAULT);
    syncers.forEach(function (fn) { fn(); });
    redraw();
    return clone(S);
  }
  window.kefeStyle = {
    style: style, post: post,
    state: function (id) { return clone(stateFor(id || activeEffect)); },
    applyState: function (value, id) {
      id = id || activeEffect;
      var next = merge(DEFAULT, value);
      effects[id] = clone(next);
      if (id === activeEffect) { S = next; syncers.forEach(function (fn) { fn(); }); }
      persist(id, next); redraw(); return clone(next);
    },
    activate: activate,
    isActive: function (id) { return active(stateFor(id || activeEffect)); },
    get renderingEffect() { return renderingEffect; }
  };
  window.addEventListener('kefe-effect-change', function (event) {
    if (event.detail && event.detail.effect) activate(event.detail.effect);
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildUi); else buildUi();
})();
