/* KEFE — audio-reactive visualiser effects.
   Reads analysis data from analysis-engine.js (window event
   'kefe:audio-analysis-ready') and draws reactive visuals into the
   main canvas during both preview and export.

   Modes are selected via state.style.visualiserStyle:
     pulse    — soft radial glow pulsing with the bass band
     spectrum — three reactive bars along the bottom
     waveform — horizontal wave line from the energy curve
     radial   — slow-rotating radial glow driven by energy
*/
(function(){
  'use strict';
  if (window.kefeVisualiser) return;

  var analysis = null;
  var maxima = { energy: 1, bass: 1, mids: 1, treble: 1 };

  function ingest(data) {
    if (!data || !Array.isArray(data.energy) || !data.energy.length) return;
    analysis = data;
    var maxE = 0, maxB = 0, maxM = 0, maxT = 0;
    for (var i = 0; i < data.energy.length; i++) {
      var e = data.energy[i];
      if (e > maxE) maxE = e;
      var b = data.bands && data.bands[i];
      if (b) {
        if (b.bass > maxB) maxB = b.bass;
        if (b.mids > maxM) maxM = b.mids;
        if (b.treble > maxT) maxT = b.treble;
      }
    }
    maxima.energy = maxE || 1;
    maxima.bass = maxB || 1;
    maxima.mids = maxM || 1;
    maxima.treble = maxT || 1;
  }

  window.addEventListener('kefe:audio-analysis-ready', function(e){ ingest(e.detail); });

  function sample(time) {
    if (!analysis || !analysis.frameHopMs) return null;
    var hop = analysis.frameHopMs / 1000;
    var idx = Math.max(0, Math.min(analysis.energy.length - 1, Math.floor(time / hop)));
    var sum = 0, sumB = 0, sumM = 0, sumT = 0, n = 0;
    for (var k = -1; k <= 1; k++) {
      var i2 = idx + k;
      if (i2 < 0 || i2 >= analysis.energy.length) continue;
      sum += analysis.energy[i2] || 0;
      var b = analysis.bands && analysis.bands[i2];
      if (b) {
        sumB += b.bass || 0;
        sumM += b.mids || 0;
        sumT += b.treble || 0;
      }
      n++;
    }
    if (!n) return null;
    return {
      energy: Math.min(1, (sum / n) / maxima.energy),
      bass:   Math.min(1, (sumB / n) / maxima.bass),
      mids:   Math.min(1, (sumM / n) / maxima.mids),
      treble: Math.min(1, (sumT / n) / maxima.treble)
    };
  }

  function drawPulse(ctx, w, h, time, frame) {
    var intensity = frame ? frame.bass * 0.6 + frame.energy * 0.4 : 0;
    var cx = w / 2, cy = h / 2;
    var radius = Math.min(w, h) * (0.25 + intensity * 0.35);
    var grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    var alpha = 0.12 + intensity * 0.32;
    grad.addColorStop(0, 'rgba(255,255,255,' + alpha.toFixed(3) + ')');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  function drawSpectrum(ctx, w, h, time, frame) {
    if (!frame) return;
    var bands = [frame.bass, frame.mids, frame.treble];
    var pad = w * 0.08;
    var barW = (w - pad * 2 - 30) / 3;
    var barH = h * 0.20;
    var baseY = h - pad - barH;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (var i = 0; i < 3; i++) {
      var x = pad + i * (barW + 15);
      var filled = barH * Math.min(1, bands[i] * 1.3);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(x, baseY, barW, barH);
      var grad = ctx.createLinearGradient(0, baseY + barH, 0, baseY);
      grad.addColorStop(0, 'rgba(255,255,255,0.05)');
      grad.addColorStop(1, 'rgba(255,255,255,0.85)');
      ctx.fillStyle = grad;
      ctx.fillRect(x, baseY + barH - filled, barW, filled);
    }
    ctx.restore();
  }

  function drawWaveform(ctx, w, h, time, frame) {
    if (!analysis || !analysis.energy) return;
    var y = h / 2;
    var amp = h * 0.12;
    var samples = 200;
    var hop = analysis.frameHopMs / 1000;
    var startIdx = Math.floor(time / hop);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = Math.max(2, h * 0.003);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (var i = 0; i < samples; i++) {
      var idx = startIdx + i;
      var e = analysis.energy[idx]; if (e === undefined) e = 0;
      var norm = Math.min(1, e / maxima.energy);
      var dev = (norm * 2 - 1) * amp;
      var x = (i / (samples - 1)) * w;
      var yy = y + dev;
      if (i === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawRadial(ctx, w, h, time, frame) {
    if (!frame) return;
    var cx = w / 2, cy = h / 2;
    var intensity = frame.energy;
    var radius = Math.min(w, h) * (0.30 + intensity * 0.15);
    var grad = ctx.createRadialGradient(cx, cy, radius * 0.15, cx, cy, radius * 1.8);
    var alpha = 0.08 + intensity * 0.30;
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, 'rgba(255,255,255,' + (alpha * 0.6).toFixed(3) + ')');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.translate(cx, cy);
    ctx.rotate(time * 0.35);
    ctx.translate(-cx, -cy);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  var MODES = { pulse: drawPulse, spectrum: drawSpectrum, waveform: drawWaveform, radial: drawRadial };

  function draw(ctx, w, h, time, appState) {
    var mode = (appState && appState.style && appState.style.visualiserStyle) || 'pulse';
    var fn = MODES[mode] || drawPulse;
    var frame = sample(time);
    try { fn(ctx, w, h, time, frame); }
    catch (e) { console.warn('[KEFE visualiser]', e); }
  }

  window.kefeVisualiser = {
    draw: draw,
    get data() { return analysis; },
    get modes() { return Object.keys(MODES); },
    ingest: ingest
  };
})();
