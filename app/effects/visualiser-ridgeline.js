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
    peaks: 1
  ,
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
    // analysis-engine hands back raw RMS/flux magnitudes with no fixed
    // ceiling — a loud track and a quiet track both produce "energy"
    // arrays that never approach 1.0. visualiser-beat.js already tracks
    // each track's own peak (maxima) to normalise the other modes; reuse
    // it here so the ridgeline reacts to *this* track's dynamic range
    // instead of drawing everything near the flat baseline.
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

  function buildCurve(analysis, centerTime, widthSeconds, rowPeriod, points, row, rows, settings, maxima) {
    var values = new Float32Array(points);
    if (!state.smoothed[row] || state.smoothed[row].length !== points) {
      state.smoothed[row] = new Float32Array(points);
    }
    var rowSmooth = state.smoothed[row];
    // The front row (row = rows-1) shows the current instant; each row
    // further back shows a real, earlier snapshot of the track — a
    // waterfall, not a copy of the same window nudged by a few ms. That's
    // what makes each ridge trace its own distinct peaks instead of 25
    // near-duplicates of the same curve.
    var rowDelay = (row - (rows - 1)) * rowPeriod;
    var start = centerTime - widthSeconds * 0.5 + rowDelay;
    var step = widthSeconds / Math.max(1, points - 1);
    var raw = new Float32Array(points);

    for (var i = 0; i < points; i++) {
      var t = start + i * step;
      var a = sampleTimeline(analysis, t, maxima);

      // The reference has a clean central ridge with smaller secondary
      // undulations. Energy supplies the broad terrain; spectral flux and
      // upper bands supply the sharper peaks. Every term is now already
      // normalised to this track's own dynamic range (0..~1.4), so the
      // weights below just balance the *shape* of the terrain, not its
      // overall scale — a quiet verse should read as low rolling hills,
      // a loud chorus should spike toward the top of the frame.
      // Row position: 0 = farthest back, 1 = front-most
      var rowT = row / Math.max(1, rows - 1);
      // Front rows: sharp, treble-leaning peaks (plucks, snares)
      // Back rows: broad, bass-leaning hills (kick, sub)
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

      // A soft centre emphasis keeps the characteristic mountain cluster
      // near the middle of the frame while still allowing the track to move.
      var xn = i / Math.max(1, points - 1);
      var centre = Math.exp(-Math.pow((xn - 0.5) / 0.55, 2));
      v *= 0.72 + centre * 0.28;

      // Deterministic fine texture: no Math.random(), so preview/export
      // produce the same frame for the same timestamp.
      var texture = Math.sin(i * 0.37 + row * 1.91 + centerTime * 1.7) * 0.035;
      raw[i] = clamp(v + texture, 0, 1.4);
    }

    // A single strummed chord or drum hit is one instant of audio — sampled
    // point-for-point, it's a needle-thin spike surrounded by flat line,
    // which reads as "only one spot reacts". Real instruments ring out
    // after the attack, so give each point a decaying tail into the points
    // ahead of it (later in time) before it can be overtaken by the next
    // transient. That turns a single strum into a proper rounded mountain
    // instead of a spike, and fills the ridge with the kind of continuous
    // terrain the reference has.
    var decay = lerp(0.975, 0.986, row / (rows - 1));
    for (i = 1; i < points; i++) {
      var held = raw[i - 1] * decay;
      if (held > raw[i]) raw[i] = held;
    }

    for (i = 0; i < points; i++) {
      // Row-specific smoothing creates the layered depth of the reference.
      var previous = rowSmooth[i] || raw[i];
      var smoothing = lerp(0.78, 0.92, row / Math.max(1, rows - 1));
      previous += (raw[i] - previous) * smoothing;
      rowSmooth[i] = previous;
      values[i] = previous;
    }

    return values;
  }

  function backgroundFill(ctx, w, h) {
    // The rows are drawn back-to-front and each one needs to blank out
    // whatever line segments are sitting behind it — that's what gives the
    // reference its solid, occluded "mountain silhouette" look instead of
    // see-through wireframe. The visualiser is drawn straight onto the same
    // canvas as the chosen background (render() in app.js paints the
    // background first), so sample a corner pixel that's outside the ridge
    // band to recover whatever colour is actually there, and mask with
    // that. Falls back to near-black — the reference's own backdrop — if
    // the canvas can't be read (e.g. a tainted cross-origin frame).
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

  function draw(ctx, w, h, time, frame, appState, analysis) {
    if (!analysis && _analysis) analysis = _analysis;
    if (!analysis || !analysis.energy || !analysis.energy.length) return;

    var settings = opts(appState);
    // Normalise gradient setting to RGB triples
    if (settings.gradient && Array.isArray(settings.gradient)) {
      settings.gradient = settings.gradient.map(hexToRgb);
    } else if (typeof settings.gradient === 'string') {
      settings.gradient = settings.gradient.split(',').map(function(x){ return hexToRgb(x.trim()); });
    } else {
      settings.gradient = null;
    }
    var maxima = currentMaxima();
    var rows = 25;
    var points = Math.max(96, Math.min(260, Math.round(w / 3)));
    // Each ridge shows its own short slice of the track (not the whole
    // 5+ second window), and consecutive ridges are staggered by a real
    // chunk of time — together the 25 rows cover roughly the last
    // ROW_SPAN seconds of the track, front row = now.
    var speed = Math.max(0.25, settings.speed);
    var flow = Math.max(0, Math.min(2, Number(settings.flow) || 0));
    // FLOW controls how much each row is shifted in time. At flow = 0 the
    // whole stack collapses to one instant and each row's shape comes
    // purely from its frequency-band weighting — a still column where every
    // line reacts to the current audio with a different curve. At flow > 0
    // rows spread through history like a waterfall.
    var widthSeconds = 0.55 / speed;
    var rowPeriod = 0.20 / speed * flow;   // flow = 0 → all rows sample the same instant
    var left = w * 0.015;
    var right = w * 0.985;
    var top = h * 0.115;
    var bottom = h * (0.82 + 0.035 * settings.depth);
    var floor = bottom + h * 0.08;
    var depth = clamp(settings.depth, 0.5, 2.0);

    if (state.width !== w || state.height !== h || state.lastTime > time + 0.2) {
      state.smoothed = [];
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

      // Back rows are tighter and fainter; foreground rows are broader and
      // carry the strongest audio displacement.
      var amplitude = h * lerp(0.055, 0.095, Math.pow(r, 0.6)) * depth;
      var rowScale = lerp(0.52, 1.0, Math.pow(r, 1.1));
      amplitude *= rowScale;

      var curve = buildCurve(analysis, time, widthSeconds, rowPeriod, points, row, rows, settings, maxima);
      var pts = new Array(points);
      for (var i = 0; i < points; i++) {
        var xNorm = i / (points - 1);
        var x = lerp(left, right, xNorm);

        // Very slight perspective convergence toward the horizon.
        var converge = (0.5 - xNorm) * w * (1 - r) * 0.018;
        x += converge;

        // Peaks rise from the baseline. Flux gets a small extra lift so
        // drums/plucks produce the crisp needle-like shapes in the reference.
        var peak = Math.pow(clamp(curve[i] * (0.6 + 0.8 * r), 0, 1.35), 1.05);
        pts[i] = [x, baseY - peak * amplitude];
      }

      // 1) Mask fill: blanks out whatever is drawn behind this row so
      //    foreground peaks fully occlude the rows further back, matching
      //    the reference's solid-mountain silhouette instead of a
      //    see-through wireframe.
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (i = 1; i < points; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      // Fill only a modest skirt below the ridge line — enough to occlude
      // the immediate row behind, not enough to wipe out the whole stack.
      var skirt = h * 0.045;
      ctx.lineTo(pts[points - 1][0], baseY + skirt);
      ctx.lineTo(pts[0][0], baseY + skirt);
      ctx.closePath();
      ctx.globalAlpha = 1;
      ctx.fillStyle = maskFill;
      ctx.fill();

      // 2) The ridge line itself.
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
      // Glow pass: same curve, wider, lower alpha
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = lineAlpha * 0.35;
      ctx.lineWidth = Math.max(2.0, h * lerp(0.006, 0.011, r));
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (i = 1; i < points; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';

      // Crisp pass on top
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
    version: 1,
    draw: draw,
    defaults: DEFAULTS
  };
})();
