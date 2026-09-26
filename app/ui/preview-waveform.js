/* KEFE — waveform strip behind the seek slider.
   Uses the audio energy data from the analysis engine. Drawn onto a
   canvas layered behind the existing slider. Read-only — doesn't change
   any playback behaviour. */
(function(){
  'use strict';
  if (window.__kefePreviewWaveform) return;
  window.__kefePreviewWaveform = true;

  var css = document.createElement('style');
  css.id = 'kefe-preview-waveform-css';
  css.textContent = [
    '.kefe-wave-wrap{position:relative;flex:1 1 auto;min-width:80px;width:auto;height:32px;display:flex;align-items:center}',
    '.kefe-wave-wrap .slider{position:relative;z-index:2;width:100%;margin:0;background:transparent}',
    '.kefe-wave-canvas{position:absolute;inset:0;z-index:1;width:100%;height:100%;pointer-events:none;opacity:0.55}',
    /* Played portion tint (draws over the "past" part of the wave) */
    '.kefe-wave-played{position:absolute;inset:0;z-index:1;pointer-events:none;overflow:hidden;width:0}',
    '.kefe-wave-played .kefe-wave-canvas{opacity:0.95}'
  ].join('\n');
  document.head.appendChild(css);

  var canvas = null;
  var playedCanvas = null;
  var wrap = null;
  var energyCache = null;
  var lastEnergyLen = 0;
  var lastWaveKey = '';

  function build() {
    var slider = document.getElementById('seek');
    if (!slider || slider.dataset.kefeWaveWrapped) return;
    slider.dataset.kefeWaveWrapped = '1';

    wrap = document.createElement('div');
    wrap.className = 'kefe-wave-wrap';
    slider.parentNode.insertBefore(wrap, slider);

    canvas = document.createElement('canvas');
    canvas.className = 'kefe-wave-canvas';
    wrap.appendChild(canvas);

    var played = document.createElement('div');
    played.className = 'kefe-wave-played';
    playedCanvas = document.createElement('canvas');
    playedCanvas.className = 'kefe-wave-canvas';
    played.appendChild(playedCanvas);
    wrap.appendChild(played);

    wrap.appendChild(slider);
  }

  function getEnergy() {
    var data = window.kefeVisualiser && window.kefeVisualiser.data;
    if (data && Array.isArray(data.energy) && data.energy.length) {
      if (lastEnergyLen !== data.energy.length) {
        energyCache = data.energy;
        lastEnergyLen = data.energy.length;
      }
      return energyCache;
    }
    return energyCache;
  }

  function draw() {
    if (!canvas) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(1, wrap.clientWidth);
    var h = Math.max(1, wrap.clientHeight);
    var total = Number(getDuration());
    var cur = Number(getCurrentTime());
    var pct = total > 0 ? Math.max(0, Math.min(1, cur / total)) : 0;
    var playedWrap = wrap.querySelector('.kefe-wave-played');
    if (playedWrap) playedWrap.style.width = (pct * 100) + '%';
    var energy = getEnergy();
    var waveKey = w + 'x' + h + 'x' + dpr + 'x' + (energy ? energy.length : 0);
    if (waveKey === lastWaveKey) return;
    lastWaveKey = waveKey;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      playedCanvas.width = w * dpr;
      playedCanvas.height = h * dpr;
    }

    var ctx = canvas.getContext('2d');
    var pctx = playedCanvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    pctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    pctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    pctx.clearRect(0, 0, w, h);

    // If no analysis data yet, draw a soft flat line so the bar still
    // has a visual rhythm rather than an empty band.
    if (!energy || !energy.length) {
      ctx.strokeStyle = 'rgba(255,255,255,0.10)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
      return;
    }

    var max = 0;
    for (var i = 0; i < energy.length; i++) if (energy[i] > max) max = energy[i];
    if (max <= 0) max = 1;

    var bars = Math.min(energy.length, Math.max(40, Math.floor(w / 3)));
    var barW = w / bars;
    var midY = h / 2;

    function paint(c, color) {
      c.fillStyle = color;
      for (var b = 0; b < bars; b++) {
        var s0 = Math.floor(b * energy.length / bars);
        var s1 = Math.max(s0 + 1, Math.floor((b + 1) * energy.length / bars));
        var peak = 0;
        for (var j = s0; j < s1 && j < energy.length; j++) if (energy[j] > peak) peak = energy[j];
        var v = Math.max(0.04, peak / max);
        var barH = v * (h * 0.82);
        var x = b * barW;
        var y = midY - barH / 2;
        c.fillRect(x, y, Math.max(1, barW - 0.8), barH);
      }
    }

    // Base: muted bars
    paint(ctx, 'rgba(255,255,255,0.34)');

    // Played: brighter
    paint(pctx, 'rgba(239,63,56,0.95)');
  }

  function getDuration() {
    try { return getMasterDuration(); } catch (e) { return 0; }
  }
  function getCurrentTime() {
    try { return getMasterTime(); } catch (e) { return 0; }
  }

  setInterval(function(){
    try {
      build();
      draw();
    } catch (e) { /* ignore */ }
  }, 33);

  console.log('[KEFE] preview waveform active');
})();
