/* KEFE — Ridgeline audio visualiser.
   Reconstructed from the supplied 100-frame reference GIF.

   The reference is a monochrome perspective stack of thin waveform/ridge
   lines. This implementation keeps that visual language but drives each
   ridge from KEFE's deterministic audio timeline, so it works in preview
   and frame-by-frame export without shipping the reference GIF itself.

   Deterministic for export: temporal smoothing is time-invariant, the
   smoothing state is fully reset on backwards time jumps, and there is
   no Math.random / performance.now / audio.currentTime in the render
   path. Same time → same frame.
*/
(function () {
  'use strict';
  if (window.kefeRidgeline) return;

  /* Reference frame interval for smoothing. All temporal smoothing is
     parameterised so that a 30 FPS export and a 60 FPS preview produce
     the same smoothed curve at the same absolute time. */
  var FIXED_DT = 1 / 60;

  var GRADIENT_PRESETS = {
    'pulsar-white':  { label: 'Pulsar White',  stops: ['#FFFFFF','#FFFFFF','#FFFFFF'] },
    'deep-emerald':  { label: 'Deep Emerald',  stops: ['#00FF88','#00CCAA','#FFFFFF'] },
    'cyber-sunset':  { label: 'Cyber Sunset',  stops: ['#FF00AA','#FF3366','#FFFFFF'] },
    'tokyo-neon':    { label: 'Tokyo Neon',    stops: ['#FF00FF','#00FFFF','#FFFFFF'] },
    'golden-hour':   { label: 'Golden Hour',   stops: ['#FFAA00','#FF5500','#FFFFFF'] }
  };

  function resolveGradientPreset(name) {
    if (!name) return null;
    var preset = GRADIENT_PRESETS[name];
    if (!preset) return null;
    return preset.stops;
  }

  var _analysis = null;
  window.addEventListener('kefe:audio-analysis-ready', function(e){
    _analysis = e.detail || null;
  });

  var state = {
    lastTime: -1,
    smoothed: [],
    width: 0,
    height: 0
  };

  var DEFAULTS = {
    speed: 1,
    depth: 1,
    reaction: 1,
    peaks: 1,
    ridgeFlow: 0.35
  };

  function opts(appState) {
    var s = (appState && appState.style) || {};
    return {
      speed: Number.isFinite(Number(s.ridgeSpeed)) ? Number(s.ridgeSpeed) : DEFAULTS.speed,
      depth: Number.isFinite(Number(s.ridgeDepth)) ? Number(s.ridgeDepth) : DEFAULTS.depth,
      reaction: Number.isFinite(Number(s.ridgeReaction)) ? Number(s.ridgeReaction) : DEFAULTS.reaction,
      peaks: Number.isFinite(Number(s.ridgePeaks)) ? Number(s.ridgePeaks) : DEFAULTS.peaks,
      flow: (appState && appState.style && appState.style.ridgeFlow != null) ? Number(appState.style.ridgeFlow) : 0.35
    };
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function sampleArray(arr, position) {
    if (!arr || !arr.length) return 0;
    var p = clamp(position, 0, arr.length - 1);
    var i = Math.floor(p);
    var j = Math.min(arr.length - 1, i + 1);
    return lerp(Number(arr[i]) || 0, Number(arr[j]) || 0, p - i);
  }

  function currentMaxima() {
    var m = (window.kefeVisualiser && window.kefeVisualiser.maxima) || {};
    return {
      energy: m.energy || 1,
      flux: m.flux || 1,
      bass: m.bass || 1,
      mids: m.mids || 1,
      treble: m.treble || 1
    };
  }

  function sampleTimeline(analysis, time, maxima) {
    if (!analysis || !analysis.frameHopMs || !analysis.energy || !analysis.energy.length) {
      return { energy: 0, flux: 0, bass: 0, mids: 0, treble: 0 };
    }

    var p = Math.max(0, time * 1000 / analysis.frameHopMs);
    var bands = analysis.bands || [];
    var e = sampleArray(analysis.energy, p) / maxima.energy;
    var f = sampleArray(analysis.flux || [], p) / maxima.flux;

    function band(name) {
      if (!bands.length) return 0;
      var i = Math.floor(clamp(p, 0, bands.length - 1));
      var j = Math.min(bands.length - 1, i + 1);
      var a = Number(bands[i] && bands[i][name]) || 0;
      var b = Number(bands[j] && bands[j][name]) || 0;
      return lerp(a, b, p - i) / maxima[name];
    }

    return {
      energy: clamp(e, 0, 1.4),
      flux: clamp(f, 0, 1.4),
      bass: clamp(band('bass'), 0, 1.4),
      mids: clamp(band('mids'), 0, 1.4),
      treble: clamp(band('treble'), 0, 1.4)
    };
  }

  /* Time-invariant exponential smoothing factor.
     The reference alpha is applied once per FIXED_DT; applying it over a
     variable interval dt requires:
        alpha(dt) = 1 - (1 - alpha_ref) ^ (dt / FIXED_DT)
     This is what makes preview (60 Hz) and export (30 Hz) agree. */
  function timeInvariantAlpha(alphaRef, dt) {
    var k = Math.max(0, dt) / FIXED_DT;
    return 1 - Math.pow(1 - alphaRef, k);
  }

  function buildCurve(analysis, centerTime, widthSeconds, rowPeriod, points, row, rows, settings, maxima, dt) {
    var values = new Float32Array(points);
    if (!state.smoothed[row] || state.smoothed[row].length !== points) {
      state.smoothed[row] = new Float32Array(points);
    }
    var rowSmooth = state.smoothed[row];
    var rowDelay = (row - (rows - 1)) * rowPeriod;
    var start = centerTime - widthSeconds * 0.5 + rowDelay;
    var step = widthSeconds / Math.max(1, points - 1);
    var raw = new Float32Array(points);

    for (var i = 0; i < points; i++) {
      var t = start + i * step;
      var a = sampleTimeline(analysis, t, maxima);

      var rowT = row / Math.max(1, rows - 1);
      var trebleW = lerp(0.04, 0.34, rowT);
      var midsW   = lerp(0.10, 0.18, rowT);
      var fluxW   = lerp(0.22, 0.42, rowT);
      var bassW   = lerp(0.34, 0.08, rowT);
      var energyW = lerp(0.60, 0.40, rowT);
      var v = a.energy * energyW
            + a.flux   * fluxW
            + a.bass   * bassW
            + a.mids   * midsW
            + a.treble * trebleW;
      v = Math.pow(Math.max(0, v), lerp(1.28, 0.82, clamp(settings.peaks, 0.3, 2.0) / 2.0));
      v *= settings.reaction;

      var xn = i / Math.max(1, points - 1);
      var centre = Math.exp(-Math.pow((xn - 0.5) / 0.55, 2));
      v *= 0.72 + centre * 0.28;

      var texture = Math.sin(i * 0.37 + row * 1.91 + centerTime * 1.7) * 0.035;
      raw[i] = clamp(v + texture, 0, 1.4);
    }

    var decay = lerp(0.975, 0.986, row / (rows - 1));
    for (i = 1; i < points; i++) {
      var held = raw[i - 1] * decay;
      if (held > raw[i]) raw[i] = held;
    }

    var alphaRef = lerp(0.78, 0.92, row / Math.max(1, rows - 1));
    var alpha = timeInvariantAlpha(alphaRef, dt);
    for (i = 0; i < points; i++) {
      var previous = rowSmooth[i];
      if (previous === 0 || !Number.isFinite(previous)) previous = raw[i];
      previous += (raw[i] - previous) * alpha;
      rowSmooth[i] = previous;
      values[i] = previous;
    }

    return values;
  }

  function backgroundFill(ctx, w, h) {
    try {
      var px = ctx.getImageData(Math.max(0, Math.round(w * 0.004)), Math.max(0, Math.round(h * 0.01)), 1, 1).data;
      return 'rgb(' + px[0] + ',' + px[1] + ',' + px[2] + ')';
    } catch (e) {
      return 'rgb(5,5,8)';
    }
  }

  function hexToRgb(hex) {
    if (Array.isArray(hex)) return hex;
    if (typeof hex !== 'string') return [255,255,255];
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    return [parseInt(h.slice(0,2), 16), parseInt(h.slice(2,4), 16), parseInt(h.slice(4,6), 16)];
  }

  function resetState() {
    state.smoothed = [];
    state.lastTime = -1;
  }

  function draw(ctx, w, h, time, frame, appState, analysis) {
    if (!analysis && _analysis) analysis = _analysis;
    if (!analysis || !analysis.energy || !analysis.energy.length) return;

    var settings = opts(appState);
    var presetName = appState && appState.style && appState.style.ridgeGradientPreset;
    var presetStops = resolveGradientPreset(presetName);
    if (presetStops) {
      settings.gradient = presetStops.map(hexToRgb);
    } else if (settings.gradient && Array.isArray(settings.gradient)) {
      settings.gradient = settings.gradient.map(hexToRgb);
    } else if (typeof settings.gradient === 'string') {
      settings.gradient = settings.gradient.split(',').map(function(x){ return hexToRgb(x.trim()); });
    } else {
      settings.gradient = null;
    }
    var maxima = currentMaxima();
    var rows = 25;
    var points = Math.max(96, Math.min(260, Math.round(w / 3)));
    var speed = Math.max(0.25, settings.speed);
    var flow = Math.max(0, Math.min(2, Number(settings.flow) || 0));
    var widthSeconds = 0.55 / speed;
    var rowPeriod = 0.20 / speed * flow;
    var left = w * 0.015;
    var right = w * 0.985;
    var top = h * 0.115;
    var bottom = h * (0.82 + 0.035 * settings.depth);
    var depth = clamp(settings.depth, 0.5, 2.0);

    if (state.width !== w || state.height !== h || state.lastTime < 0 || time < state.lastTime - 0.001) {
      resetState();
    }

    var dt;
    if (state.lastTime < 0) {
      dt = FIXED_DT;
    } else {
      dt = clamp(time - state.lastTime, 1e-4, 0.25);
    }

    state.width = w;
    state.height = h;
    state.lastTime = time;

    var maskFill = backgroundFill(ctx, w, h);

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (var row = 0; row < rows; row++) {
      var r = row / (rows - 1);
      var perspective = Math.pow(r, 1.16);
      var baseY = lerp(top, bottom, perspective);

      var amplitude = h * lerp(0.055, 0.095, Math.pow(r, 0.6)) * depth;
      var rowScale = lerp(0.52, 1.0, Math.pow(r, 1.1));
      amplitude *= rowScale;

      var curve = buildCurve(analysis, time, widthSeconds, rowPeriod, points, row, rows, settings, maxima, dt);
      var pts = new Array(points);
      for (var i = 0; i < points; i++) {
        var xNorm = i / (points - 1);
        var x = lerp(left, right, xNorm);
        var converge = (0.5 - xNorm) * w * (1 - r) * 0.018;
        x += converge;
        var peak = Math.pow(clamp(curve[i] * (0.6 + 0.8 * r), 0, 1.35), 1.05);
        pts[i] = [x, baseY - peak * amplitude];
      }

      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (i = 1; i < points; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      var skirt = h * 0.045;
      ctx.lineTo(pts[points - 1][0], baseY + skirt);
      ctx.lineTo(pts[0][0], baseY + skirt);
      ctx.closePath();
      ctx.globalAlpha = 1;
      ctx.fillStyle = maskFill;
      ctx.fill();

      var lineAlpha = lerp(0.55, 1.0, Math.pow(r, 0.55));
      ctx.globalAlpha = lineAlpha;
      var grad = settings.gradient;
      if (grad && grad.length) {
        var t = r;
        var seg = Math.min(grad.length - 1, Math.floor(t * (grad.length - 1)));
        var segT = (t * (grad.length - 1)) - seg;
        var c0 = grad[seg];
        var c1 = grad[Math.min(grad.length - 1, seg + 1)] || c0;
        ctx.strokeStyle = 'rgb(' + Math.round(c0[0] + (c1[0] - c0[0]) * segT) + ',' + Math.round(c0[1] + (c1[1] - c0[1]) * segT) + ',' + Math.round(c0[2] + (c1[2] - c0[2]) * segT) + ')';
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,1)';
      }
      ctx.lineWidth = Math.max(0.9, h * lerp(0.0022, 0.0048, r));
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = lineAlpha * 0.35;
      if (grad && grad.length >= 2) {
        var mid = grad[Math.floor(grad.length / 2)];
        ctx.strokeStyle = 'rgb(' + mid[0] + ',' + mid[1] + ',' + mid[2] + ')';
      }
      ctx.lineWidth = Math.max(2.0, h * lerp(0.006, 0.011, r));
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (i = 1; i < points; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';

      ctx.globalAlpha = lineAlpha;
      ctx.lineWidth = Math.max(0.9, h * lerp(0.0022, 0.0048, r));
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (i = 1; i < points; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
    }

    ctx.restore();
  }

  window.kefeRidgeline = {
    version: 2,
    draw: draw,
    refresh: resetState,
    defaults: DEFAULTS,
    presets: GRADIENT_PRESETS
  };
})();
