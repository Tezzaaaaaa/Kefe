/* KEFE — shared WebAudio graph for audio-reactive visualisers and video export.
   Keep one MediaElementSource per player element. Audio overlay rendering and controls
   have been removed; this graph remains required by particle audio reactivity and export. */
(function () {
  'use strict';
  var graph = null;

  function fftSize() {
    var p = window.kefeSettings ? Math.round(Number(window.kefeSettings.get('fftPower'))) : 11;
    return Math.pow(2, p >= 9 && p <= 12 ? p : 11);
  }

  function ensureGraph() {
    if (graph) return graph;
    var audio = document.getElementById('kefeAudio');
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!audio || !AC) return null;

    try {
      var ac = new AC();
      var src = ac.createMediaElementSource(audio);

      /* A MediaElementSource takes over the element's native output. Route it to the
         speakers immediately, before creating optional analysis/export nodes: if either
         optional API is unavailable (notably in mobile browsers), playback must remain audible. */
      src.connect(ac.destination);
      graph = { ac: ac, source: src, analyser: null, stream: null };

      try {
        var analyser = ac.createAnalyser();
        analyser.fftSize = fftSize();
        analyser.smoothingTimeConstant = 0.78;
        src.connect(analyser);
        graph.analyser = analyser;
      } catch (e) {
        console.warn('[KEFE audio analyser]', e);
      }

      try {
        var dest = ac.createMediaStreamDestination();
        src.connect(dest);
        graph.stream = dest.stream;
      } catch (e) {
        console.warn('[KEFE audio export stream]', e);
      }
    } catch (e) {
      console.warn('[KEFE audio graph]', e);
      graph = null;
    }
    return graph;
  }

  if (window.kefeSettings && window.kefeSettings.onChange) {
    window.kefeSettings.onChange(function (key) {
      if (key !== 'fftPower' || !graph || !graph.analyser) return;
      try { graph.analyser.fftSize = fftSize(); } catch (e) { console.warn('[KEFE audio graph]', e); }
    });
  }

  window.kefeAudioGraph = {
    ensure: ensureGraph,
    context: function () { return graph ? graph.ac : null; },
    analyser: function () { return graph ? graph.analyser : null; }
  };

  /* Shared preview render-rate gate. Settings → Engine → FPS target caps how often a visualiser
     paints the preview. Only the visible visualiser calls this, so the cap stays accurate. */
  function frameGate(now) {
    var target = Math.round(Number(window.kefeSettings && window.kefeSettings.get('fpsTarget'))) || 60;
    target = Math.max(24, Math.min(120, target));
    var step = 1000 / target;
    var last = frameGate.lastPaint || 0;
    if (!last || now - last >= step - 1) {
      frameGate.lastPaint = now;
      return true;
    }
    return false;
  }

  window.kefeFrameGate = frameGate;

  /* Retain the legacy export hook as a harmless no-op for compatibility. */
  window.kefeAudioOverlay = {
    paint: function () {},
    mode: function () { return 'off'; },
    setMode: function () {}
  };
})();
