/* KEFE — Ridgeline audio visualiser.
   Reconstructed from the supplied 100-frame reference GIF.

   The reference is a monochrome perspective stack of thin waveform/ridge
   lines. This implementation keeps that visual language but drives each
   ridge from KEFE's deterministic audio timeline, so it works in preview
   and frame-by-frame export without shipping the reference GIF itself.
*/
(function () {
  'use strict';
  if (window.kefeRidgeline) return;

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
    peaks: 1
  };

  function opts(appState) {
    var s = (appState && appState.style) || {};
    return {
      speed: Number.isFinite(Number(s.ridgeSpeed)) ? Number(s.ridgeSpeed) : DEFAULTS.speed,
      depth: Number.isFinite(Number(s.ridgeDepth)) ? Number(s.ridgeDepth) : DEFAULTS.depth,
      reaction: Number.isFinite(Number(s.ridgeReaction)) ? Number(s.ridgeReaction) : DEFAULTS.reaction,
      peaks: Number.isFinite(Number(s.ridgePeaks)) ? Number(s.ridgePeaks) : DEFAULTS.peaks
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

  function sampleTimeline(analysis, time) {
    if (!analysis || !analysis.frameHopMs || !analysis.energy || !analysis.energy.length) {
      return { energy: 0, flux: 0, bass: 0, mids: 0, treble: 0 };
    }

    var p = Math.max(0, time * 1000 / analysis.frameHopMs);
    var bands = analysis.bands || [];
    var e = sampleArray(analysis.energy, p);
    var f = sampleArray(analysis.flux || [], p);

    function band(name) {
      if (!bands.length) return 0;
      var i = Math.floor(clamp(p, 0, bands.length - 1));
      var j = Math.min(bands.length - 1, i + 1);
      var a = Number(bands[i] && bands[i][name]) || 0;
      var b = Number(bands[j] && bands[j][name]) || 0;
      return lerp(a, b, p - i);
    }

    return {
      energy: e,
      flux: f,
      bass: band('bass'),
      mids: band('mids'),
      treble: band('treble')
    };
  }

  function buildCurve(analysis, centerTime, widthSeconds, points, row, settings) {
    var values = new Float32Array(points);
    var rowDelay = row * 0.032 * settings.speed;
    var start = centerTime - widthSeconds * 0.5 + rowDelay;
    var step = widthSeconds / Math.max(1, points - 1);

    for (var i = 0; i < points; i++) {
      var t = start + i * step;
      var a = sampleTimeline(analysis, t);

      // The reference has a clean central ridge with smaller secondary
      // undulations. Energy supplies the broad terrain; spectral flux and
      // upper bands supply the sharper peaks.
      var broad = a.energy;
      var detail = a.flux * 7.0 + a.treble * 0.45 + a.mids * 0.18;
      var bassLift = a.bass * 0.20;
      var v = broad * 0.62 + detail * 0.22 + bassLift;
      v *= settings.reaction;

      // A soft centre emphasis keeps the characteristic mountain cluster
      // near the middle of the frame while still allowing the track to move.
      var xn = i / Math.max(1, points - 1);
      var centre = Math.exp(-Math.pow((xn - 0.5) / 0.34, 2));
      v *= 0.42 + centre * 0.58;

      // Deterministic fine texture: no Math.random(), so preview/export
      // produce the same frame for the same timestamp.
      var texture = Math.sin(i * 0.37 + row * 1.91 + centerTime * 1.7) * 0.035;
      v = clamp(v + texture, 0, 1.4);

      // Row-specific smoothing creates the layered depth of the reference.
      var previous = state.smoothed[row] || v;
      var smoothing = lerp(0.34, 0.62, row / 24);
      previous += (v - previous) * smoothing;
      state.smoothed[row] = previous;
      values[i] = previous;
    }

    return values;
  }

  function draw(ctx, w, h, time, frame, appState, analysis) {
    if (!analysis || !analysis.energy || !analysis.energy.length) return;

    var settings = opts(appState);
    var rows = 25;
    var points = Math.max(96, Math.min(260, Math.round(w / 3)));
    var widthSeconds = 5.8 / Math.max(0.25, settings.speed);
    var left = w * 0.015;
    var right = w * 0.985;
    var top = h * 0.115;
    var bottom = h * (0.82 + 0.035 * settings.depth);
    var depth = clamp(settings.depth, 0.5, 2.0);

    if (state.width !== w || state.height !== h || state.lastTime > time + 0.2) {
      state.smoothed = [];
    }
    state.width = w;
    state.height = h;
    state.lastTime = time;

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(255,255,255,0.86)';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (var row = 0; row < rows; row++) {
      var r = row / (rows - 1);
      var perspective = Math.pow(r, 1.16);
      var baseY = lerp(top, bottom, perspective);

      // Back rows are tighter and fainter; foreground rows are broader and
      // carry the strongest audio displacement.
      var amplitude = h * lerp(0.012, 0.080, Math.pow(r, 1.18)) * depth;
      var rowScale = lerp(0.52, 1.0, Math.pow(r, 1.1));
      amplitude *= rowScale;

      var curve = buildCurve(analysis, time, widthSeconds, points, row, settings);
      var lineAlpha = lerp(0.38, 0.92, Math.pow(r, 0.75));
      ctx.globalAlpha = lineAlpha;
      ctx.lineWidth = Math.max(0.65, h * lerp(0.0017, 0.0032, r));

      ctx.beginPath();
      for (var i = 0; i < points; i++) {
        var xNorm = i / (points - 1);
        var x = lerp(left, right, xNorm);

        // Very slight perspective convergence toward the horizon.
        var converge = (0.5 - xNorm) * w * (1 - r) * 0.018;
        x += converge;

        // Peaks rise from the baseline. Flux gets a small extra lift so
        // drums/plucks produce the crisp needle-like shapes in the reference.
        var peak = Math.pow(clamp(curve[i], 0, 1.25), 1.18);
        var y = baseY - peak * amplitude;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  window.kefeRidgeline = {
    version: 1,
    draw: draw,
    defaults: DEFAULTS
  };
})();
