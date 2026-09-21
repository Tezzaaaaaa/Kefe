/* KEFE — shared visualiser palette utilities */
(function () {
  'use strict';
  var root = window.kefeVisualiserShared || (window.kefeVisualiserShared = {});
  function hue(h) { return ((Number(h) || 0) % 1 + 1) % 1; }
  function rgb(h, s, v, a) {
    h = hue(h); s = Math.max(0, Math.min(1, Number(s) || 0)); v = Math.max(0, Math.min(1, Number(v) || 0));
    var i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    var c = [[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]][i % 6];
    return 'rgba(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' + Math.round(c[2] * 255) + ',' + (a == null ? 1 : a) + ')';
  }
  root.palette = Object.freeze({ rgb: rgb, hue: hue });
})();
