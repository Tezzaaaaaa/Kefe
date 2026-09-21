/* KEFE — deterministic procedural noise */
(function () {
  'use strict';
  var root = window.kefeVisualiserShared || (window.kefeVisualiserShared = {});
  function hash(seed) {
    var x = Math.sin((Number(seed) || 0) * 127.1 + 311.7) * 43758.5453123;
    return x - Math.floor(x);
  }
  function signed(seed) { return hash(seed) * 2 - 1; }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function value2(x, y, seed) {
    var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    var a = hash(ix * 374761 + iy * 668265 + seed * 69069);
    var b = hash((ix + 1) * 374761 + iy * 668265 + seed * 69069);
    var c = hash(ix * 374761 + (iy + 1) * 668265 + seed * 69069);
    var d = hash((ix + 1) * 374761 + (iy + 1) * 668265 + seed * 69069);
    var sx = smooth(fx), sy = smooth(fy);
    return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
  }
  root.noise = Object.freeze({ hash: hash, signed: signed, value2: value2 });
})();
