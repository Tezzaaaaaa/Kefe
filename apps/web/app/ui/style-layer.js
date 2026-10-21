/* KEFE — lyric style layer.
   Shared colour, size, placement, outline and glow controls for lyric effects.
   Settings persist in localStorage. An empty colour means "use the effect's own colour". */
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
  var S = clone(DEFAULT);
  try { S = merge(DEFAULT, JSON.parse(localStorage.getItem(KEY) || 'null')); } catch (e) { /* storage unavailable */ }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }
  function redraw() { try { if (window.kefeLyrics) window.kefeLyrics.redraw(); } catch (e) { /* ignore */ } }

  function validColor(v) { return /^#[0-9a-f]{6}$/i.test(String(v || '')); }

  /* ---------- effect style ---------- */
  function style(base) {
    var s = Object.assign({}, base);
    s.fontSize = (Number(base.fontSize) || 80) * (S.scale / 100);
    if (validColor(S.textColor)) { s.textColor = S.textColor; s.flipcardsColor = S.textColor; }
    if (validColor(S.accentColor)) { s.accentColor = S.accentColor; s.flipcardsAccent = S.accentColor; }
    if (validColor(S.inactiveColor)) s.karaokeInactiveColor = S.inactiveColor;
    return s;
  }

  /* ---------- post-processing (placement, outline, glow) ---------- */
  var layerA = null, layerB = null;
  function sized(c, w, h) { if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } return c; }
  function active() { return S.outline.on || S.glow.on || S.offsetX !== 0 || S.offsetY !== 0; }

  /* Fill every non-transparent pixel of `src` with `color` (a silhouette). */
  function silhouette(dst, src, color, w, h) {
    var g = dst.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over'; g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
  }

  function post(ctx, w, h, paint) {
    if (!active()) { paint(ctx); return; }
    layerA = sized(layerA || document.createElement('canvas'), w, h);
    var a = layerA.getContext('2d');
    a.setTransform(1, 0, 0, 1, 0, 0); a.globalAlpha = 1; a.globalCompositeOperation = 'source-over'; a.filter = 'none';
    a.clearRect(0, 0, w, h);
    paint(a);

    var dx = w * S.offsetX / 100, dy = h * S.offsetY / 100;
    var u = Math.min(w, h) / 720; /* sliders are tuned at 720px; scale so exports match the preview */
    ctx.save();
    ctx.translate(dx, dy);
    if (S.glow.on) {
      layerB = sized(layerB || document.createElement('canvas'), w, h);
      silhouette(layerB, layerA, S.glow.color, w, h);
      var blur = Math.max(1, S.glow.blur * u);
      var passes = S.glow.strength > 66 ? 3 : S.glow.strength > 33 ? 2 : 1;
      ctx.save();
      try { ctx.filter = 'blur(' + blur + 'px)'; } catch (e) { /* filter unsupported: harder edge */ }
      ctx.globalAlpha = Math.min(1, S.glow.strength / 70);
      for (var i = 0; i < passes; i++) ctx.drawImage(layerB, 0, 0);
      ctx.restore();
    }
    if (S.outline.on && S.outline.width > 0) {
      layerB = sized(layerB || document.createElement('canvas'), w, h);
      silhouette(layerB, layerA, S.outline.color, w, h);
      var r = Math.max(1, S.outline.width * u), steps = Math.max(12, Math.min(32, Math.round(r * 2.5))); /* capped: each step is a full-canvas draw, per frame */
      for (var k = 0; k < steps; k++) {
        var ang = k / steps * Math.PI * 2;
        ctx.drawImage(layerB, Math.cos(ang) * r, Math.sin(ang) * r);
      }
    }
    ctx.drawImage(layerA, 0, 0);
    ctx.restore();
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
  function selectRow(label, get, set, options) {
    var wrap = el('div', 'kefe-visualiser-field'), sel = el('select', 'kefe-select');
    options.forEach(function (o) { var op = el('option', null, o[1]); op.value = o[0]; sel.appendChild(op); });
    wrap.appendChild(el('label', 'kefe-label', label)); wrap.appendChild(sel);
    function sync() { sel.value = get(); }
    sel.addEventListener('change', function () { set(sel.value); persist(); redraw(); });
    sync(); wrap.sync = sync;
    return wrap;
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

    var resetBtn = el('button', 'kefe-btn', 'Reset lyric style'); resetBtn.type = 'button';
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

  window.kefeStyle = {
    style: style, post: post,
    state: function () { return clone(S); },
    applyState: function (value) { S = merge(DEFAULT, value); syncers.forEach(function (fn) { fn(); }); persist(); redraw(); return clone(S); },
    isActive: function () { return active(); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildUi); else buildUi();
})();
