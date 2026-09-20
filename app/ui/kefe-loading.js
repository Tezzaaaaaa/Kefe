/* KEFE — time-remaining estimates for caption generation and video export.
   Watches the existing progress bars and extrapolates from their rate of
   change to show a human-friendly ETA. Adds no new state, only display. */
(function(){
  'use strict';
  if (window.__kefeLoading) return;
  window.__kefeLoading = true;

  function fmt(seconds){
    if (!isFinite(seconds) || seconds < 0) return '—';
    var s = Math.round(seconds);
    if (s < 5) return 'a few seconds';
    if (s < 60) return s + 's';
    var m = Math.floor(s / 60);
    var rem = s % 60;
    if (rem === 0) return m + 'm';
    return m + 'm ' + rem + 's';
  }

  // A rate tracker for one progress bar. Samples progress over time,
  // computes a sliding-window rate, and extrapolates to 100%.
  function makeTracker(getProgress, isRunning){
    var samples = [];
    var startTime = 0;
    var running = false;
    var lastEstimate = null;

    function snapshot(p, now){
      var elapsed = (now - startTime) / 1000;
      if (samples.length < 2 || p <= 0.01) return { elapsed: elapsed, remaining: null };

      // Use the earliest sample within the last 10 seconds, so the rate
      // estimate adapts as the operation speeds up or slows down.
      var cutoff = now - 10000;
      var first = samples[0];
      for (var i = 0; i < samples.length; i++){
        if (samples[i].t >= cutoff){ first = samples[i]; break; }
      }
      var dt = (now - first.t) / 1000;
      var dp = p - first.p;
      if (dt < 1 || dp <= 0.001) {
        return { elapsed: elapsed, remaining: lastEstimate };
      }
      var rate = dp / dt;
      var remaining = (1 - p) / rate;
      if (!isFinite(remaining) || remaining < 0 || remaining > 3600) remaining = null;
      lastEstimate = remaining;
      return { elapsed: elapsed, remaining: remaining };
    }

    return {
      tick: function(){
        var now = performance.now();
        var nowRunning = isRunning();
        if (!nowRunning){
          if (running){ samples = []; running = false; lastEstimate = null; }
          return null;
        }
        if (!running){ running = true; startTime = now; samples = []; }
        var p = getProgress();
        if (p == null || !isFinite(p)) return null;
        var last = samples[samples.length - 1];
        if (!last || now - last.t >= 400){
          samples.push({ t: now, p: p });
          if (samples.length > 120) samples.shift();
        } else {
          // Still update the last sample's p to avoid missing an increment.
          last.p = p;
        }
        return snapshot(p, now);
      }
    };
  }

  // ---- Caption generator tracker ----
  var capTracker = makeTracker(
    function(){
      var el = document.getElementById('captionGenProgress');
      if (!el || el.hidden) return null;
      var v = Number(el.value);
      return isFinite(v) ? v / 100 : null;
    },
    function(){
      var el = document.getElementById('captionGenTimer');
      return Boolean(el && !el.hidden);
    }
  );

  // ---- Export tracker ----
  var expTracker = makeTracker(
    function(){
      var el = document.getElementById('exportProgress');
      if (!el) return null;
      var v = Number(el.value);
      return isFinite(v) ? v / 100 : null;
    },
    function(){
      var ov = document.getElementById('exportOverlay');
      return Boolean(ov && !ov.classList.contains('hidden'));
    }
  );

  function updateCaption(){
    var timer = document.getElementById('captionGenTimer');
    if (!timer || timer.hidden){
      var stale = document.getElementById('kefeCaptionEta');
      if (stale) stale.remove();
      return;
    }
    var snap = capTracker.tick();
    if (!snap) return;
    var eta = document.getElementById('kefeCaptionEta');
    if (!eta){
      eta = document.createElement('div');
      eta.id = 'kefeCaptionEta';
      eta.style.cssText = 'margin-top:6px;font-size:11px;color:var(--text-2);font-variant-numeric:tabular-nums';
      timer.appendChild(eta);
    }
    var msg = '';
    if (snap.remaining != null && snap.remaining > 2) msg = 'About ' + fmt(snap.remaining) + ' remaining';
    else if (snap.elapsed > 4) msg = 'Estimating time…';
    eta.textContent = msg;
  }

  function updateExport(){
    var ov = document.getElementById('exportOverlay');
    if (!ov || ov.classList.contains('hidden')){
      var stale = document.getElementById('kefeExportEta');
      if (stale) stale.remove();
      return;
    }
    var snap = expTracker.tick();
    if (!snap) return;
    var box = document.getElementById('kefeExportEta');
    if (!box){
      box = document.createElement('div');
      box.id = 'kefeExportEta';
      box.className = 'kefe-export-eta';
      var content = ov.querySelector('.modal-content');
      if (content) content.appendChild(box);
    }
    var msg = 'Elapsed ' + fmt(snap.elapsed);
    if (snap.remaining != null && snap.remaining > 2){
      msg += ' · About ' + fmt(snap.remaining) + ' left';
    } else if (snap.elapsed > 4) {
      msg += ' · Estimating time…';
    }
    box.textContent = msg;
  }

  setInterval(function(){
    try { updateCaption(); } catch(e){}
    try { updateExport(); } catch(e){}
  }, 500);

  console.log('[KEFE] loading ETA indicators active');
})();
