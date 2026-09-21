/* KEFE — shared visualiser audio features
 * Canonical, stateless feature normalisation for preview/export.
 */
(function () {
  'use strict';
  var root = window.kefeVisualiserShared || (window.kefeVisualiserShared = {});
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, Number(v) || 0)); }
  function read(frame, key, fallback) {
    var value = frame && frame[key];
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
  }
  root.audioFeatures = function (frame) {
    return Object.freeze({
      bass: clamp(read(frame, 'bass', 0), 0, 1.4),
      mids: clamp(read(frame, 'mids', 0), 0, 1.4),
      treble: clamp(read(frame, 'treble', 0), 0, 1.4),
      energy: clamp(read(frame, 'energy', 0), 0, 1.4),
      flux: clamp(read(frame, 'flux', 0), 0, 1.4)
    });
  };
})();
