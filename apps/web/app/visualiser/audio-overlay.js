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
      var analyser = ac.createAnalyser();
      var dest = ac.createMediaStreamDestination();
      analyser.fftSize = fftSize();
      analyser.smoothingTimeConstant = 0.78;
      src.connect(analyser);
      src.connect(ac.destination);
      src.connect(dest);
      graph = { ac: ac, analyser: analyser, stream: dest.stream };
    } catch (e) {
      console.warn('[KEFE audio graph]', e);
      graph = null;
    }
    return graph;
  }

  if (window.kefeSettings && window.kefeSettings.onChange) {
    window.kefeSettings.onChange(function (key) {
      if (key !== 'fftPower' || !graph) return;
      try { graph.analyser.fftSize = fftSize(); } catch (e) { console.warn('[KEFE audio graph]', e); }
    });
  }

  window.kefeAudioGraph = {
    ensure: ensureGraph,
    context: function () { return graph ? graph.ac : null; },
    analyser: function () { return graph ? graph.analyser : null; }
  };

  /* Retain the legacy export hook as a harmless no-op for compatibility. */
  window.kefeAudioOverlay = {
    paint: function () {},
    mode: function () { return 'off'; },
    setMode: function () {}
  };
})();
