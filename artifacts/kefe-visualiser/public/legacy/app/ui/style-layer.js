/* KEFE — lyric style layer.
   One place for the text styling the studio exposes: colours, size, placement, outline, glow, plus the custom-text and logo overlay.
   It works on every lyric effect without touching them:
     style(base)        – merges the user's colour/size choices into the style object an effect receives
     post(ctx,w,h,fn)   – renders an effect through a scratch layer, adding placement, outline and glow
     drawOverlay(ctx…)  – custom text + logo, drawn over the lyric canvas (so previews and exports match)
   Settings persist in localStorage. An empty colour means "use the effect's own colour". */
(function () {
  'use strict';
  var KEY = 'kefe.style.v1';
  var DEFAULT = {
    textColor: '', accentColor: '', inactiveColor: '',
    scale: 100, offsetX: 0, offsetY: 0,
    outline: { on: false, color: '#000000', width: 4 },
    glow: { on: false, color: '#ffffff', blur: 24, strength: 70 },
    text: { on: false, value: '', pos: 'bottom-center', size: 4, color: '#ffffff', opacity: 90 },
    logo: { on: false, pos: 'top-right', size: 12, opacity: 100 }
  };
  var POSITIONS = [
    ['top-left', 'Top left'], ['top-center', 'Top centre'], ['top-right', 'Top right'],
    ['bottom-left', 'Bottom left'], ['bottom-center', 'Bottom centre'], ['bottom-right', 'Bottom right']
  ];

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

  /* ---------- overlay: custom text + logo ---------- */
  var logoImg = null, logoUrl = '';
  function anchor(pos, w, h, bw, bh, margin) {
    var x = pos.indexOf('left') >= 0 ? margin : pos.indexOf('right') >= 0 ? w - margin - bw : (w - bw) / 2;
    var y = pos.indexOf('top') === 0 ? margin : h - margin - bh;
    return { x: x, y: y };
  }
  function drawOverlay(ctx, w, h) {
    var margin = Math.min(w, h) * 0.04;
    if (S.logo.on && logoImg && logoImg.complete && logoImg.naturalWidth) {
      var lw = w * S.logo.size / 100, lh = lw * logoImg.naturalHeight / logoImg.naturalWidth;
      var maxH = h * 0.4;
      if (lh > maxH) { lw *= maxH / lh; lh = maxH; }
      var p = anchor(S.logo.pos, w, h, lw, lh, margin);
      ctx.save(); ctx.globalAlpha = S.logo.opacity / 100;
      try { ctx.drawImage(logoImg, p.x, p.y, lw, lh); } catch (e) { /* tainted or broken image */ }
      ctx.restore();
    }
    var txt = String(S.text.value || '').trim();
    if (S.text.on && txt) {
      var size = Math.max(10, Math.min(w, h) * S.text.size / 100);
      var family = (window.KEFE_TYPE && window.KEFE_TYPE.families && window.KEFE_TYPE.families.default) || 'Inter Tight';
      ctx.save();
      ctx.font = '700 ' + size + 'px "' + family + '",system-ui,sans-serif';
      ctx.textBaseline = 'alphabetic';
      var tw = Math.min(ctx.measureText(txt).width, w - margin * 2);
      var q = anchor(S.text.pos, w, h, tw, size, margin);
      ctx.textAlign = 'left';
      ctx.globalAlpha = S.text.opacity / 100;
      ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = size * 0.25;
      ctx.fillStyle = validColor(S.text.color) ? S.text.color : '#ffffff';
      ctx.fillText(txt, q.x, q.y + size * 0.82, w - margin * 2);
      ctx.restore();
    }
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
    var row = el('div', 'kefe-visualiser-spin-row'), btn = el('button', 'kefe-btn', ''); btn.type = 'button';
    row.appendChild(el('span', 'kefe-label', label));
    function sync() { btn.textContent = get() ? 'On' : 'Off'; btn.setAttribute('aria-pressed', get() ? 'true' : 'false'); }
    btn.addEventListener('click', function () { set(!get()); sync(); persist(); redraw(); });
    row.appendChild(btn); sync(); row.sync = sync;
    return row;
  }
  function colorRow(label, get, set, allowDefault) {
    var row = el('div', 'kefe-visualiser-spin-row'), right = el('span', 'kefe-style-color-wrap');
    var input = document.createElement('input'); input.type = 'color'; input.className = 'kefe-style-color'; input.setAttribute('aria-label', label);
    var reset = el('button', 'kefe-btn kefe-style-mini', 'Auto'); reset.type = 'button'; reset.title = 'Use the effect colour';
    function sync() { input.value = validColor(get()) ? get() : '#ffffff'; if (allowDefault) reset.hidden = !validColor(get()); }
    input.addEventListener('input', function () { set(input.value); reset.hidden = !allowDefault; persist(); redraw(); });
    reset.addEventListener('click', function () { set(''); sync(); persist(); redraw(); });
    row.appendChild(el('span', 'kefe-label', label));
    right.appendChild(input); if (allowDefault) right.appendChild(reset);
    row.appendChild(right); sync(); row.sync = sync;
    return row;
  }
  function selectRow(label, get, set, options) {
    var wrap = el('div'), sel = el('select', 'kefe-select');
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

    var text = group('Custom text');
    var textInput = el('input', 'kefe-input'); textInput.type = 'text'; textInput.maxLength = 80; textInput.placeholder = 'Artist handle, release date, “Out now”…';
    textInput.setAttribute('aria-label', 'Custom text');
    textInput.addEventListener('input', function () { S.text.value = textInput.value; S.text.on = !!textInput.value.trim(); persist(); redraw(); });
    syncers.push(function () { textInput.value = S.text.value; });
    text.append(
      textInput,
      reg(selectRow('Text position', function () { return S.text.pos; }, function (v) { S.text.pos = v; }, POSITIONS)),
      reg(slider('Text size', function () { return S.text.size; }, function (v) { S.text.size = v; }, 2, 12, 0.5, function (v) { return v + '%'; })),
      reg(colorRow('Text colour', function () { return S.text.color; }, function (v) { S.text.color = v; }, false))
    );

    var logo = group('Logo');
    var logoZone = el('label', 'kefe-upload-zone'); logoZone.setAttribute('for', 'kefeLogoInput');
    var logoName = el('span', 'kefe-upload-name', 'Choose a logo (PNG, SVG, JPG)');
    var logoInput = el('input', 'kefe-file'); logoInput.type = 'file'; logoInput.id = 'kefeLogoInput'; logoInput.accept = 'image/*';
    logoZone.append(el('span', 'kefe-upload-title', 'Logo'), logoName, logoInput);
    var logoRemove = el('button', 'kefe-btn', 'Remove logo'); logoRemove.type = 'button'; logoRemove.hidden = true;
    function setLogo(file) {
      if (logoUrl) { URL.revokeObjectURL(logoUrl); logoUrl = ''; }
      if (!file) { logoImg = null; S.logo.on = false; logoZone.classList.remove('kefe-confirmed-container'); logoName.textContent = 'Choose a logo (PNG, SVG, JPG)'; logoRemove.hidden = true; redraw(); return; }
      logoUrl = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { logoImg = img; S.logo.on = true; logoName.textContent = file.name; logoZone.classList.add('kefe-confirmed-container'); logoRemove.hidden = false; redraw(); };
      img.onerror = function () { logoZone.classList.remove('kefe-confirmed-container'); logoName.textContent = 'Could not read that image'; };
      img.src = logoUrl;
    }
    logoInput.addEventListener('change', function () { var f = logoInput.files && logoInput.files[0]; logoInput.value = ''; if (f) setLogo(f); });
    logoRemove.addEventListener('click', function () { setLogo(null); });
    logo.append(
      logoZone, logoRemove,
      reg(selectRow('Logo position', function () { return S.logo.pos; }, function (v) { S.logo.pos = v; }, POSITIONS)),
      reg(slider('Logo size', function () { return S.logo.size; }, function (v) { S.logo.size = v; }, 4, 40, 1, function (v) { return v + '%'; })),
      reg(slider('Logo opacity', function () { return S.logo.opacity; }, function (v) { S.logo.opacity = v; }, 10, 100, 1, function (v) { return v + '%'; }))
    );

    var resetBtn = el('button', 'kefe-btn', 'Reset lyric style'); resetBtn.type = 'button';
    resetBtn.addEventListener('click', function () {
      var keepText = S.text.value; S = clone(DEFAULT); S.text.value = keepText; S.text.on = !!keepText.trim();
      if (logoImg) S.logo.on = true;
      syncers.forEach(function (fn) { fn(); }); persist(); redraw();
    });

    var head = el('div', 'kefe-label', 'Lyric style');
    head.style.marginTop = '4px';
    wrap.append(head, colours, place, out, glow, text, logo, resetBtn);
    var anchorEl = panel.querySelector('.kefe-font-card');
    if (anchorEl && anchorEl.nextSibling) panel.insertBefore(wrap, anchorEl.nextSibling); else panel.appendChild(wrap);
    syncers.forEach(function (fn) { fn(); });
  }

  window.kefeStyle = {
    style: style, post: post, drawOverlay: drawOverlay,
    state: function () { return clone(S); },
    isActive: function () { return active(); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildUi); else buildUi();
})();
