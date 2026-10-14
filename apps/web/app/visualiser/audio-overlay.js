/* KEFE — audio graph + audio-reactive overlay.
   window.kefeAudioGraph  – the one WebAudio graph for the player (browsers allow a single MediaElementSource per element).
                            It feeds the analyser used here and the stream used by video export.
   window.kefeAudioOverlay – 2D audio-reactive overlays: waveform, spectrum, radial, pulse.
                            paint(ctx,w,h) is used for both the live preview canvas and the exported frames.
   The graph is only created when something needs it (overlay on, or export), so playback is untouched by default. */
(function () {
  'use strict';
  var KEY = 'kefe.audioOverlay.v1';
  var MODES = [['off', 'Off'], ['waveform', 'Waveform'], ['spectrum', 'Spectrum'], ['radial', 'Radial'], ['pulse', 'Pulse']];
  var POS = [['top', 'Top'], ['center', 'Centre'], ['bottom', 'Bottom']];
  var DEFAULT = { mode: 'off', color: '#ffffff', size: 40, position: 'bottom', opacity: 90, gain: 100 };
  var S = Object.assign({}, DEFAULT);
  try {
    var saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && typeof saved === 'object') {
      if (MODES.some(function (m) { return m[0] === saved.mode; })) S.mode = saved.mode;
      if (/^#[0-9a-f]{6}$/i.test(saved.color || '')) S.color = saved.color;
      if (POS.some(function (p) { return p[0] === saved.position; })) S.position = saved.position;
      ['size', 'opacity', 'gain'].forEach(function (k) { if (Number.isFinite(saved[k])) S[k] = saved[k]; });
    }
  } catch (e) { /* storage unavailable */ }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }

  /* ---------- shared audio graph ---------- */
  var graph = null;
  function ensureGraph() {
    if (graph) return graph;
    var audio = document.getElementById('kefeAudio'), AC = window.AudioContext || window.webkitAudioContext;
    if (!audio || !AC) return null;
    try {
      var ac = new AC(), src = ac.createMediaElementSource(audio), analyser = ac.createAnalyser(), dest = ac.createMediaStreamDestination();
      analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0.78;
      src.connect(analyser); src.connect(ac.destination); src.connect(dest);
      graph = { ac: ac, analyser: analyser, stream: dest.stream };
    } catch (e) { console.warn('[KEFE audio graph]', e); graph = null; }
    return graph;
  }
  window.kefeAudioGraph = {
    ensure: ensureGraph,
    context: function () { return graph ? graph.ac : null; },
    analyser: function () { return graph ? graph.analyser : null; }
  };

  /* ---------- analysis ---------- */
  var freq = new Uint8Array(1024), wave = new Uint8Array(2048), level = { bass: 0, avg: 0, peak: 0 }, ripples = [], lastBass = 0;
  function sample() {
    var an = graph && graph.analyser;
    if (!an) { freq.fill(0); wave.fill(128); level.bass = level.avg = 0; return; }
    if (freq.length !== an.frequencyBinCount) freq = new Uint8Array(an.frequencyBinCount);
    if (wave.length !== an.fftSize) wave = new Uint8Array(an.fftSize);
    an.getByteFrequencyData(freq); an.getByteTimeDomainData(wave);
    var b = 0, bn = Math.max(4, Math.round(freq.length * 0.03)), a = 0;
    for (var i = 0; i < bn; i++) b += freq[i];
    for (var j = 0; j < freq.length * 0.6; j++) a += freq[j];
    level.bass = b / bn / 255; level.avg = a / (freq.length * 0.6) / 255;
  }
  function bars(n) {
    var out = new Array(n), lo = 2, hi = Math.floor(freq.length * 0.72), k = S.gain / 100;
    for (var i = 0; i < n; i++) {
      var a = Math.floor(lo * Math.pow(hi / lo, i / n)), b = Math.max(a + 1, Math.floor(lo * Math.pow(hi / lo, (i + 1) / n))), s = 0;
      for (var x = a; x < b; x++) s = Math.max(s, freq[x]);
      /* gentle tilt so highs are not invisible next to the bass */
      out[i] = Math.min(1, (s / 255) * (0.85 + 0.9 * i / n) * k);
    }
    return out;
  }

  /* ---------- drawing ---------- */
  function bandY(h, bandH) { return S.position === 'top' ? h * 0.06 + bandH / 2 : S.position === 'center' ? h / 2 : h * 0.94 - bandH / 2; }
  function paint(g, w, h) {
    if (S.mode === 'off') return;
    var u = Math.min(w, h), band = h * S.size / 100 * 0.6, cy = bandY(h, band), lw = Math.max(2, u * 0.006), k = S.gain / 100;
    g.save();
    g.globalAlpha = S.opacity / 100; g.strokeStyle = g.fillStyle = S.color; g.lineCap = g.lineJoin = 'round'; g.lineWidth = lw;
    if (S.mode === 'waveform') {
      var n = wave.length, step = Math.max(1, Math.floor(n / 600));
      g.beginPath();
      for (var i = 0, px = 0; i < n; i += step, px++) {
        var x = i / (n - 1) * w, v = ((wave[i] - 128) / 128) * k;
        var y = cy + Math.max(-1, Math.min(1, v)) * band / 2;
        if (px === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    } else if (S.mode === 'spectrum') {
      var count = w > h ? 64 : 40, bs = bars(count), gap = w * 0.12 / count, bw = (w * 0.88 - gap * (count - 1)) / count, x0 = w * 0.06;
      var base = S.position === 'center' ? cy : S.position === 'top' ? cy - band / 2 : cy + band / 2;
      for (var b = 0; b < count; b++) {
        var bh = Math.max(lw, bs[b] * band * (S.position === 'center' ? 0.5 : 1));
        var rx = x0 + b * (bw + gap), r = Math.min(bw / 2, bh / 2);
        g.beginPath();
        if (S.position === 'center') roundRect(g, rx, base - bh, bw, bh * 2, r); else if (S.position === 'top') roundRect(g, rx, base, bw, bh, r); else roundRect(g, rx, base - bh, bw, bh, r);
        g.fill();
      }
    } else if (S.mode === 'radial') {
      var rc = S.position === 'center' ? h / 2 : S.position === 'top' ? h * 0.3 : h * 0.7;
      var inner = u * (0.12 + S.size / 100 * 0.1), len = u * S.size / 100 * 0.32, N = 96, rb = bars(N / 2);
      g.lineWidth = Math.max(2, u * 0.007);
      for (var q = 0; q < N; q++) {
        var m = q < N / 2 ? q : N - 1 - q, ang = q / N * Math.PI * 2 - Math.PI / 2, d = Math.max(0.02, rb[m]) * len;
        g.beginPath(); g.moveTo(w / 2 + Math.cos(ang) * inner, rc + Math.sin(ang) * inner); g.lineTo(w / 2 + Math.cos(ang) * (inner + d), rc + Math.sin(ang) * (inner + d)); g.stroke();
      }
      g.globalAlpha = S.opacity / 100 * 0.5; g.beginPath(); g.arc(w / 2, rc, inner * (0.96 + level.bass * 0.06 * k), 0, Math.PI * 2); g.stroke();
    } else if (S.mode === 'pulse') {
      var pc = S.position === 'center' ? h / 2 : S.position === 'top' ? h * 0.3 : h * 0.7;
      var rad = u * (0.07 + S.size / 100 * 0.12) * (1 + Math.min(1, level.bass * 1.4 * k) * 0.55);
      ripples.forEach(function (rp) {
        g.globalAlpha = S.opacity / 100 * (1 - rp.t) * 0.7; g.lineWidth = Math.max(2, u * 0.005);
        g.beginPath(); g.arc(w / 2, pc, rad + rp.t * u * 0.3, 0, Math.PI * 2); g.stroke();
      });
      g.globalAlpha = S.opacity / 100; g.beginPath(); g.arc(w / 2, pc, rad, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }
  function roundRect(g, x, y, w, h, r) {
    if (g.roundRect) { g.roundRect(x, y, w, h, r); return; }
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  /* ---------- preview canvas ---------- */
  var cv, cctx, stage, audio, running = false, lastT = 0;
  function size() {
    if (!cv || !stage) return;
    var cw = stage.clientWidth || 640, ch = stage.clientHeight || 360, sc = Math.min(1, 960 / Math.max(cw, ch));
    var w = Math.max(2, Math.round(cw * sc)), h = Math.max(2, Math.round(ch * sc));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  }
  function advanceRipples(dt) {
    if (level.bass - lastBass > 0.12 && level.bass > 0.45 && (!ripples.length || ripples[ripples.length - 1].t > 0.18)) ripples.push({ t: 0 });
    lastBass = level.bass * 0.6 + lastBass * 0.4;
    ripples.forEach(function (r) { r.t += dt * 0.9; });
    ripples = ripples.filter(function (r) { return r.t < 1; });
  }
  function loop(now) {
    if (S.mode === 'off') { running = false; if (cctx) cctx.clearRect(0, 0, cv.width, cv.height); return; }
    requestAnimationFrame(loop);
    var dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
    size(); sample(); advanceRipples(dt);
    cctx.clearRect(0, 0, cv.width, cv.height); paint(cctx, cv.width, cv.height);
  }
  function start() {
    if (running || S.mode === 'off') return;
    running = true; lastT = performance.now(); requestAnimationFrame(loop);
  }
  /* Called by export so frames use the current analysis even though the preview loop may be idle. */
  function paintFrame(g, w, h) {
    if (S.mode === 'off') return;
    ensureGraph(); sample(); advanceRipples(1 / 60); paint(g, w, h);
  }

  /* ---------- UI ---------- */
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function buildUi() {
    var form = document.querySelector('[data-panel-view="visualiser"] .kefe-form');
    if (!form || document.getElementById('kefeOverlayGroup')) return;
    var g = el('div', 'kefe-visualiser-control-group'); g.id = 'kefeOverlayGroup';
    g.appendChild(el('div', 'kefe-label', 'Audio overlay'));
    var note = el('div', 'kefe-meta', 'Waveform, spectrum, radial or pulse drawn over the visualiser. Included in exports.'); note.style.marginBottom = '8px';
    g.appendChild(note);

    var modeSel = el('select', 'kefe-select'); modeSel.setAttribute('aria-label', 'Overlay style');
    MODES.forEach(function (m) { var o = el('option', null, m[1]); o.value = m[0]; modeSel.appendChild(o); });
    modeSel.value = S.mode;
    var detail = el('div'); detail.style.display = 'grid'; detail.style.gap = '4px';

    function field(label, key, min, max, fmt) {
      var w = el('label', 'kefe-visualiser-field'), head = el('span'), out = el('output'), input = document.createElement('input');
      head.append(el('b', null, label), out); input.type = 'range'; input.min = min; input.max = max; input.step = 1; input.value = S[key];
      out.textContent = fmt(S[key]);
      input.addEventListener('input', function () { S[key] = Number(input.value); out.textContent = fmt(S[key]); persist(); });
      w.append(head, input); return w;
    }
    var colorRow = el('div', 'kefe-visualiser-spin-row'), color = document.createElement('input');
    color.type = 'color'; color.value = S.color; color.className = 'kefe-style-color'; color.setAttribute('aria-label', 'Overlay colour');
    color.addEventListener('input', function () { S.color = color.value; persist(); });
    colorRow.append(el('span', 'kefe-label', 'Colour'), color);
    var posWrap = el('div'), posSel = el('select', 'kefe-select'); posSel.setAttribute('aria-label', 'Overlay position');
    POS.forEach(function (p) { var o = el('option', null, p[1]); o.value = p[0]; posSel.appendChild(o); });
    posSel.value = S.position; posSel.addEventListener('change', function () { S.position = posSel.value; persist(); });
    posWrap.append(el('label', 'kefe-label', 'Position'), posSel);
    detail.append(colorRow, posWrap, field('Size', 'size', 10, 100, function (v) { return v + '%'; }), field('Opacity', 'opacity', 10, 100, function (v) { return v + '%'; }), field('Sensitivity', 'gain', 40, 220, function (v) { return v + '%'; }));
    detail.hidden = S.mode === 'off';

    modeSel.addEventListener('change', function () {
      S.mode = modeSel.value; persist(); detail.hidden = S.mode === 'off';
      if (S.mode !== 'off') { var a = document.getElementById('kefeAudio'); if (a && a.src) ensureAndResume(); start(); }
    });
    g.append(modeSel, detail);
    form.appendChild(g);
  }
  function ensureAndResume() {
    var gr = ensureGraph(); if (gr && gr.ac.state === 'suspended') gr.ac.resume().catch(function () { /* needs a gesture */ });
  }

  function init() {
    stage = document.querySelector('.kefe-stage'); audio = document.getElementById('kefeAudio');
    if (!stage) return;
    cv = document.createElement('canvas'); cv.id = 'kefeOverlayCanvas'; cv.setAttribute('aria-hidden', 'true');
    var lyricCanvas = document.getElementById('kefeCanvas');
    stage.insertBefore(cv, lyricCanvas || null); cctx = cv.getContext('2d');
    if (window.ResizeObserver) new ResizeObserver(size).observe(stage);
    buildUi(); size();
    if (audio) {
      audio.addEventListener('play', function () { if (S.mode !== 'off') { ensureAndResume(); start(); } });
      audio.addEventListener('loadedmetadata', function () { if (S.mode !== 'off') start(); });
    }
    if (S.mode !== 'off') start();
  }
  function setMode(m) {
    if (!MODES.some(function (x) { return x[0] === m; })) return;
    var sel = document.querySelector('#kefeOverlayGroup select');
    if (sel) { sel.value = m; sel.dispatchEvent(new Event('change')); } else { S.mode = m; persist(); start(); }
  }
  window.kefeAudioOverlay = { paint: paintFrame, mode: function () { return S.mode; }, setMode: setMode };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
