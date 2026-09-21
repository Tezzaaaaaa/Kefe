/* KEFE — shared visualiser envelopes
 * Stateless response helpers. No module-level mutable envelope state.
 */
(function () {
  'use strict';
  var root = window.kefeVisualiserShared || (window.kefeVisualiserShared = {});
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, Number(v) || 0)); }
  root.attackRelease = function (value, attack, release) {
    var a = Math.max(0.0001, Number(attack) || 0.01);
    var r = Math.max(0.0001, Number(release) || 0.08);
    var v = clamp(value, 0, 1);
    var attackShape = 1 - Math.exp(-v / a);
    var releaseShape = Math.exp(-(1 - v) / r);
    return clamp(Math.max(attackShape, releaseShape), 0, 1);
  };
  root.impulse = function (value, threshold, sharpness) {
    var t = clamp(threshold == null ? 0.65 : threshold, 0, 1);
    var s = Math.max(0.001, Number(sharpness) || 8);
    return value > t ? Math.pow((value - t) / Math.max(0.0001, 1 - t), s) : 0;
  };
})();
