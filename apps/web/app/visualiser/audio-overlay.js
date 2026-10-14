/* KEFE — shared WebAudio graph for audio-reactive visualisers and video export.
   Keep one MediaElementSource per player element. Audio overlay rendering and controls
   have been removed; this graph remains required by particle audio reactivity and export. */
(function () {
  'use strict';
  var graph = null;

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
      analyser.fftSize = 2048;
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
