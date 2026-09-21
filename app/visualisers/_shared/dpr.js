/* KEFE — shared DPR helpers */
(function () {
  'use strict';
  var root = window.kefeVisualiserShared || (window.kefeVisualiserShared = {});
  root.dpr = Object.freeze({
    value: function (max) {
      var d = Number(window.devicePixelRatio) || 1;
      return Math.max(1, Math.min(Number(max) || 2, d));
    },
    size: function (width, height, max) {
      var d = root.dpr.value(max);
      return { width: Math.max(1, Math.round(width * d)), height: Math.max(1, Math.round(height * d)), dpr: d };
    }
  });
})();
