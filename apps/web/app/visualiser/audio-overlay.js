/* KEFE — shared WebAudio graph for audio-reactive visualisers and video export.
   Keep one MediaElementSource per player element. Audio overlay rendering and controls
   have been removed; this graph remains required by particle audio reactivity and export. */
(function () {
  'use strict';
  var graph = null;
  var sourceMap = typeof WeakMap === 'function' ? new WeakMap() : null;
  var silentPlayFrames = 0;
  var audioNoticeDismissed = false;
  var corsNoticeShown = false;
  var stateListenerAttached = typeof WeakSet === 'function' ? new WeakSet() : null;

  function emitState(detail) {
    if (typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
      try { window.dispatchEvent(new CustomEvent('kefe-audio-state-change', { detail: detail })); } catch (_) {}
    }
  }

  function fftSize() {
    var p = window.kefeSettings ? Math.round(Number(window.kefeSettings.get('fftPower'))) : 11;
    return Math.pow(2, p >= 9 && p <= 12 ? p : 11);
  }

  function showResumePrompt(state) {
    if (audioNoticeDismissed) return;
    var res = window.kefeResilience;
    if (!res || typeof res.panelError !== 'function') return;
    res.panelError('visualiser', {
      id: 'audio-resume',
      variant: 'info',
      title: state === 'interrupted' ? 'Audio output interrupted' : 'Audio reactivity paused',
      message: 'Tap Resume audio visuals so this browser lets the visualiser read audio frequencies.',
      retryLabel: 'Resume audio visuals',
      onRetry: function () { return resumeAudio(); },
      continueLabel: 'Continue without audio reactivity',
      onContinue: function () { audioNoticeDismissed = true; }
    });
  }

  function isCrossOriginAudio(audio) {
    if (!audio) return false;
    var src = audio.currentSrc || audio.src || '';
    if (!src || /^(?:blob:|data:)/i.test(src)) return false;
    if (typeof URL !== 'function' || typeof location === 'undefined' || !location.origin) {
      return /^https?:/i.test(src);
    }
    try {
      return new URL(src, location.href).origin !== location.origin;
    } catch (_) {
      return false;
    }
  }

  function showCorsUnavailable() {
    if (corsNoticeShown || audioNoticeDismissed) return;
    corsNoticeShown = true;
    var res = window.kefeResilience;
    if (!res || typeof res.panelError !== 'function') return;
    res.panelError('visualiser', {
      id: 'audio-cors',
      variant: 'info',
      title: 'Visualiser audio input unavailable',
      message: 'Frequency data cannot be read for this audio (browser CORS or iOS audio routing restriction). Playback continues normally.',
      continueLabel: 'Continue without audio reactivity',
      onContinue: function () { audioNoticeDismissed = true; }
    });
  }

  function attachStateListener(ac) {
    if (!ac || typeof ac.addEventListener !== 'function') return;
    if (stateListenerAttached) {
      if (stateListenerAttached.has(ac)) return;
      stateListenerAttached.add(ac);
    }
    ac.addEventListener('statechange', function () {
      var st = ac.state || 'unknown';
      emitState({ state: st, ok: st === 'running', reason: st });
      var audio = document.getElementById('kefeAudio');
      if (st === 'running') {
        silentPlayFrames = 0;
        if (window.kefeResilience && window.kefeResilience.clearPanelError) {
          window.kefeResilience.clearPanelError('visualiser', 'audio-resume');
        }
      } else if ((st === 'suspended' || st === 'interrupted') && audio && !audio.paused) {
        showResumePrompt(st);
      } else if (st === 'closed') {
        if (graph && graph.ac === ac) graph = null;
      }
    });
  }

  function ensureGraph() {
    if (graph && (!graph.ac || graph.ac.state !== 'closed')) return graph;
    var audio = document.getElementById('kefeAudio');
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!audio || !AC) return null;

    try {
      var existing = sourceMap ? sourceMap.get(audio) : null;
      if (existing && existing.ac && existing.ac.state === 'closed') {
        /* An HTMLMediaElement cannot be rebound to a second AudioContext once closed. */
        emitState({ state: 'closed', ok: false, reason: 'context-closed' });
        return null;
      }
      var ac = existing ? existing.ac : new AC();
      var src = existing ? existing.source : ac.createMediaElementSource(audio);
      if (sourceMap && !existing) sourceMap.set(audio, { ac: ac, source: src });

      /* A MediaElementSource takes over the element's native output. Route it to the
         speakers immediately, before creating optional analysis/export nodes: if either
         optional API is unavailable (notably in mobile browsers), playback must remain audible. */
      try { src.connect(ac.destination); } catch (destErr) { console.warn('[KEFE audio destination]', destErr); }
      graph = { ac: ac, source: src, analyser: null, stream: null };
      attachStateListener(ac);

      try {
        var analyser = ac.createAnalyser();
        analyser.fftSize = fftSize();
        analyser.smoothingTimeConstant = 0.78;
        src.connect(analyser);
        graph.analyser = analyser;
      } catch (e) {
        console.warn('[KEFE audio analyser]', e);
      }

      try {
        var dest = ac.createMediaStreamDestination();
        src.connect(dest);
        graph.stream = dest.stream;
      } catch (e) {
        console.warn('[KEFE audio export stream]', e);
      }
    } catch (e) {
      console.warn('[KEFE audio graph]', e);
      emitState({ state: 'unavailable', ok: false, reason: (e && e.name) || 'init-failed' });
      graph = null;
    }
    return graph;
  }

  async function resumeAudio(opts) {
    var g = ensureGraph();
    if (!g || !g.ac) return { ok: false, state: 'unavailable' };
    if (typeof g.ac.resume !== 'function') return { ok: true, state: g.ac.state || 'running' };
    if (g.ac.state === 'running') {
      if (window.kefeResilience && window.kefeResilience.clearPanelError) {
        window.kefeResilience.clearPanelError('visualiser', 'audio-resume');
      }
      return { ok: true, state: 'running' };
    }
    try {
      await g.ac.resume();
      var ok = g.ac.state === 'running';
      emitState({ state: g.ac.state, ok: ok, reason: g.ac.state });
      if (ok) {
        if (window.kefeResilience && window.kefeResilience.clearPanelError) {
          window.kefeResilience.clearPanelError('visualiser', 'audio-resume');
        }
      } else if (opts && opts.promptOnSuspended) {
        showResumePrompt(g.ac.state);
      }
      return { ok: ok, state: g.ac.state };
    } catch (e) {
      console.warn('[KEFE audio resume]', e);
      if (opts && opts.promptOnSuspended) showResumePrompt(g.ac.state || 'suspended');
      emitState({ state: g.ac.state || 'suspended', ok: false, reason: (e && e.message) || 'resume-failed' });
      return { ok: false, state: g.ac.state || 'suspended', error: e };
    }
  }

  function readFrequencyData(outUint8) {
    var g = graph;
    if (!g || !g.analyser) return { ok: false, reason: 'no-analyser' };
    if (g.ac && g.ac.state && g.ac.state !== 'running') {
      var audioEl = document.getElementById('kefeAudio');
      if (audioEl && !audioEl.paused) showResumePrompt(g.ac.state);
      return { ok: false, reason: g.ac.state };
    }
    try {
      g.analyser.getByteFrequencyData(outUint8);
    } catch (e) {
      return { ok: false, reason: (e && e.name) || 'read-failed' };
    }
    var audio = document.getElementById('kefeAudio');
    if (audio && !audio.paused && !audio.muted && audio.volume > 0.05) {
      var hasEnergy = false;
      for (var i = 0; i < outUint8.length; i++) {
        if (outUint8[i] > 0) { hasEnergy = true; break; }
      }
      if (hasEnergy) {
        silentPlayFrames = 0;
        if (corsNoticeShown) {
          corsNoticeShown = false;
          if (window.kefeResilience && window.kefeResilience.clearPanelError) {
            window.kefeResilience.clearPanelError('visualiser', 'audio-cors');
          }
        }
      } else if (isCrossOriginAudio(audio)) {
        silentPlayFrames++;
        if (silentPlayFrames === 45) showCorsUnavailable();
        if (silentPlayFrames >= 45) return { ok: false, reason: 'cors-or-silent' };
      } else {
        silentPlayFrames = 0;
      }
    } else {
      silentPlayFrames = 0;
    }
    return { ok: true, reason: 'running', analyser: g.analyser };
  }

  if (window.kefeSettings && window.kefeSettings.onChange) {
    window.kefeSettings.onChange(function (key) {
      if (key !== 'fftPower' || !graph || !graph.analyser) return;
      try { graph.analyser.fftSize = fftSize(); } catch (e) { console.warn('[KEFE audio graph]', e); }
    });
  }

  window.kefeAudioGraph = {
    ensure: ensureGraph,
    resume: resumeAudio,
    readFrequencyData: readFrequencyData,
    promptResume: function () { showResumePrompt((graph && graph.ac && graph.ac.state) || 'suspended'); },
    resetNotice: function () { audioNoticeDismissed = false; corsNoticeShown = false; silentPlayFrames = 0; },
    status: function () {
      var st = graph && graph.ac ? (graph.ac.state || 'running') : 'uninitialized';
      return {
        state: st,
        hasAnalyser: !!(graph && graph.analyser),
        hasStream: !!(graph && graph.stream),
        silentFrames: silentPlayFrames,
        corsBlocked: silentPlayFrames >= 45,
        audioAvailable: !!(graph && graph.analyser && st === 'running' && silentPlayFrames < 45)
      };
    },
    context: function () { return graph ? graph.ac : null; },
    analyser: function () { return graph ? graph.analyser : null; }
  };

  /* Shared preview render-rate gate. Settings → Engine → FPS target caps how often a visualiser
     paints the preview. Only the visible visualiser calls this, so the cap stays accurate. */
  function frameGate(now) {
    var target = Math.round(Number(window.kefeSettings && window.kefeSettings.get('fpsTarget'))) || 60;
    target = Math.max(24, Math.min(120, target));
    var step = 1000 / target;
    var last = frameGate.lastPaint || 0;
    if (!last || now - last >= step - 1) {
      frameGate.lastPaint = now;
      return true;
    }
    return false;
  }

  window.kefeFrameGate = frameGate;

  /* Retain the legacy export hook as a harmless no-op for compatibility. */
  window.kefeAudioOverlay = {
    paint: function () {},
    mode: function () { return 'off'; },
    setMode: function () {}
  };
})();
