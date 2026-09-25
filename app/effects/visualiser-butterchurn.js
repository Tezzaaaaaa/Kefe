/* KEFE — Butterchurn / MilkDrop visualiser. MiniPlayer-only.

   WHY THE RENDERER LOADS AS AN ES MODULE
   --------------------------------------
   jsDelivr and unpkg both serve Butterchurn as an ES module — the .min.js
   build contains `export` statements which a classic <script> tag cannot
   parse (SyntaxError). Loading it as a module via dynamic import() gives
   us the API on mod.default. The preset packs, by contrast, are UMD and
   load fine as classic scripts.

   iOS AUDIO CONTEXT NOTE
   ----------------------
   iOS Safari only allows ONE MediaElementSource per <audio> element. If
   the main editor has already claimed window.kefeAudioElement for its own
   live analyser, calling createMediaElementSource again throws. So we
   track claimed elements in a WeakSet and reuse a shared AudioContext.
*/
(function () {
  'use strict';
  if (window.kefeButterchurn) return;

  var CDN_SOURCES = [
    {
      name: 'local',
      renderer:    './vendor/butterchurn/butterchurn.min.js',
      base:        './vendor/butterchurn/presets-base.min.js',
      extra:       './vendor/butterchurn/presets-extra.min.js'
    }
  ];

  var PRESET_LIMIT = 100;
  var LOAD_TIMEOUT_MS = 15000;

  var state = {
    loading: null, ready: false, lastError: '',
    butterchurn: null, presets: {}, names: [], loadedVia: '',
    visualizer: null, audioContext: null, sourceNode: null,
    canvas: null, width: 0, height: 0,
    connectedAudio: null, currentPreset: ''
  };

  var miniState = {
    butterchurn: null, visualizer: null, audioContext: null, sourceNode: null,
    canvas: null, width: 0, height: 0,
    connectedAudio: null, currentPreset: ''
  };

  function getAppState() { return window.state || { style: {} }; }

  function withTimeout(promise, ms, label) {
    return Promise.race([
      promise,
      new Promise(function (_, reject) {
        setTimeout(function () { reject(new Error('Timed out: ' + label)); }, ms);
      })
    ]);
  }

  function loadScriptOnce(src, id) {
    return new Promise(function (resolve, reject) {
      var existing = document.getElementById(id);
      if (existing) {
        if (existing.dataset.loaded === 'true') return resolve();
        if (existing.dataset.failed === 'true') existing.remove();
        else {
          existing.addEventListener('load', resolve, { once: true });
          existing.addEventListener('error', reject, { once: true });
          return;
        }
      }
      var script = document.createElement('script');
      script.id = id;
      script.src = src;
      script.async = false;
      script.onload = function () { script.dataset.loaded = 'true'; resolve(); };
      script.onerror = function () { script.dataset.failed = 'true'; reject(new Error('Could not load ' + src)); };
      document.head.appendChild(script);
    });
  }

  function resolveButterchurnApi() {
    var w = window.butterchurn;
    if (!w) return null;
    if (typeof w.createVisualizer === 'function') return w;
    if (w.default && typeof w.default.createVisualizer === 'function') return w.default;
    if (w.butterchurn && typeof w.butterchurn.createVisualizer === 'function') return w.butterchurn;
    return null;
  }

  function collectPresets() {
    var combined = {};
    var candidates = [window.base, window.butterchurnPresets, window.extra, window.butterchurnPresetsExtra];
    for (var i = 0; i < candidates.length; i++) {
      var c = candidates[i];
      if (!c) continue;
      var source = (c.default && typeof c.default === 'object') ? c.default : c;
      if (source && typeof source === 'object' && !Array.isArray(source)) Object.assign(combined, source);
    }
    var names = Object.keys(combined)
      .filter(function (n) { return combined[n] && typeof combined[n] === 'object'; })
      .sort(function (a, b) { return a.toLowerCase().localeCompare(b.toLowerCase()); })
      .slice(0, PRESET_LIMIT);
    var selected = {};
    names.forEach(function (n) { selected[n] = combined[n]; });
    state.presets = selected;
    state.names = names;
    return names;
  }

  function getSharedAudioContext() {
    if (!window.__kefeSharedAudioCtx) {
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      window.__kefeSharedAudioCtx = new AudioCtx();
    }
    return window.__kefeSharedAudioCtx;
  }

  function getClaimedSet() {
    if (!window.__kefeClaimedAudioElements) {
      window.__kefeClaimedAudioElements = new WeakSet();
    }
    return window.__kefeClaimedAudioElements;
  }

  function primeMiniAudio(audioElement) {
    if (!audioElement) return false;
    try {
      var sharedCtx = getSharedAudioContext();
      if (!sharedCtx) return false;
      var claimed = getClaimedSet();

      miniState.audioContext = sharedCtx;

      if (claimed.has(audioElement)) {
        miniState.connectedAudio = audioElement;
        if (sharedCtx.state === 'suspended') sharedCtx.resume().catch(function () {});
        return true;
      }

      if (miniState.sourceNode) {
        try { miniState.sourceNode.disconnect(); } catch (_) {}
        miniState.sourceNode = null;
      }
      miniState.sourceNode = sharedCtx.createMediaElementSource(audioElement);
      miniState.sourceNode.connect(sharedCtx.destination);
      miniState.connectedAudio = audioElement;
      claimed.add(audioElement);

      if (sharedCtx.state === 'suspended') sharedCtx.resume().catch(function () {});
      return true;
    } catch (error) {
      return false;
    }
  }

  function ensureAudio() {
    var audio = window.kefeAudioElement;
    if (!audio) throw new Error('Main audio element unavailable.');
    var sharedCtx = getSharedAudioContext();
    if (!sharedCtx) throw new Error('Web Audio unavailable.');
    var claimed = getClaimedSet();

    state.audioContext = sharedCtx;

    if (claimed.has(audio)) {
      state.connectedAudio = audio;
      if (sharedCtx.state === 'suspended') sharedCtx.resume().catch(function () {});
      return state.sourceNode;
    }

    if (state.sourceNode) {
      try { state.sourceNode.disconnect(); } catch (_) {}
      state.sourceNode = null;
    }
    state.sourceNode = sharedCtx.createMediaElementSource(audio);
    state.sourceNode.connect(sharedCtx.destination);
    state.connectedAudio = audio;
    claimed.add(audio);

    if (sharedCtx.state === 'suspended') sharedCtx.resume().catch(function () {});
    return state.sourceNode;
  }

  function ensureCanvas(w, h) {
    if (!state.canvas) state.canvas = document.createElement('canvas');
    if (state.width !== w || state.height !== h) {
      state.width = w; state.height = h;
      state.canvas.width = Math.max(1, Math.floor(w));
      state.canvas.height = Math.max(1, Math.floor(h));
    }
    return state.canvas;
  }

  function ensureVisualizer(w, h) {
    if (!state.butterchurn || !state.audioContext) return null;
    ensureCanvas(w, h);
    if (!state.visualizer) {
      state.visualizer = state.butterchurn.createVisualizer(state.audioContext, state.canvas,
        { width: Math.max(1, Math.floor(w)), height: Math.max(1, Math.floor(h)), pixelRatio: 1, textureRatio: 1 });
      state.visualizer.connectAudio(ensureAudio());
      state.currentPreset = '';
    } else {
      state.visualizer.setRendererSize(Math.max(1, Math.floor(w)), Math.max(1, Math.floor(h)));
    }
    return state.visualizer;
  }

  function effectivePreset(appState) {
    var wanted = appState && appState.style && appState.style.butterchurnPreset;
    return state.names.indexOf(wanted) >= 0 ? wanted : state.names[0] || '';
  }

  function applyPreset(name, blendSeconds) {
    if (!state.visualizer || !state.presets[name]) return false;
    if (state.currentPreset === name) return true;
    state.visualizer.loadPreset(state.presets[name], Number.isFinite(blendSeconds) ? blendSeconds : 1.5);
    state.currentPreset = name;
    return true;
  }

  async function loadButterchurnApi(source) {
    try {
      await withTimeout(loadScriptOnce(source.renderer, 'kefe-butterchurn-renderer-' + source.name), LOAD_TIMEOUT_MS, source.name + ' renderer');
      var apiLocal = resolveButterchurnApi();
      if (apiLocal) return apiLocal;
    } catch (_) {}

    if (source.rendererEsm) {
      try {
        var mod = await withTimeout(import(/* @vite-ignore */ source.rendererEsm), LOAD_TIMEOUT_MS, source.name + ' esm');
        var candidate = mod.default || mod;
        if (candidate && typeof candidate.createVisualizer === 'function') {
          window.butterchurn = candidate;
          return candidate;
        }
      } catch (_) {}
    }

    try {
      var esmUrl = source.renderer.replace(/(@[\d.]+-?[\w.]*\/)/, '$1+esm/');
      var mod2 = await withTimeout(import(/* @vite-ignore */ esmUrl), LOAD_TIMEOUT_MS, source.name + ' esm-wrapped');
      var candidate2 = mod2.default || mod2;
      if (candidate2 && typeof candidate2.createVisualizer === 'function') {
        window.butterchurn = candidate2;
        return candidate2;
      }
    } catch (_) {}

    try {
      await withTimeout(loadScriptOnce(source.renderer, 'kefe-butterchurn-renderer-' + source.name), LOAD_TIMEOUT_MS, source.name + ' renderer');
      var api = resolveButterchurnApi();
      if (api) return api;
    } catch (_) {}

    return null;
  }

  async function tryLoadFromSource(source) {
    var api = await loadButterchurnApi(source);
    if (!api) {
      throw new Error('Could not load butterchurn renderer from ' + source.name);
    }
    state.butterchurn = api;

    try { await withTimeout(loadScriptOnce(source.base, 'kefe-butterchurn-base-' + source.name), LOAD_TIMEOUT_MS, source.name + ' base'); } catch (_) {}
    try { await withTimeout(loadScriptOnce(source.extra, 'kefe-butterchurn-extra-' + source.name), LOAD_TIMEOUT_MS, source.name + ' extra'); } catch (_) {}

    var names = collectPresets();
    if (!names.length) {
      var globals = ['base', 'butterchurnPresets', 'extra', 'butterchurnPresetsExtra']
        .map(function (n) { var v = window[n]; return n + '=' + (v == null ? 'undefined' : typeof v); }).join(', ');
      throw new Error('No presets. Globals: ' + globals);
    }
    state.loadedVia = source.name;
    return names;
  }

  async function prepare() {
    if (state.ready) return state.names;
    if (state.loading) return state.loading;
    state.lastError = '';
    state.loading = (async function () {
      var lastError = null;
      for (var i = 0; i < CDN_SOURCES.length; i++) {
        var source = CDN_SOURCES[i];
        try {
          var names = await tryLoadFromSource(source);
          state.ready = true;
          state.loading = null;
          return names;
        } catch (error) {
          lastError = error;
          try { state.butterchurn = null; } catch (_) {}
          state.presets = {};
          state.names = [];
        }
      }
      state.loading = null;
      state.lastError = lastError ? String(lastError.message || lastError) : 'All CDN sources failed';
      throw lastError || new Error(state.lastError);
    })();
    return state.loading;
  }

  async function retry() {
    state.ready = false; state.lastError = ''; state.loading = null;
    state.butterchurn = null; state.presets = {}; state.names = [];
    return prepare();
  }

  async function selectPreset(name) {
    await prepare();
    if (state.names.indexOf(name) < 0) return false;
    if (!getAppState().style) getAppState().style = {};
    getAppState().style.butterchurnPreset = name;
    state.currentPreset = '';
    return true;
  }

  function draw(ctx, w, h, time, appState) {
    if (!ctx || !w || !h) return false;
    if (!state.ready) { prepare().catch(function () {}); return false; }
    try {
      var visualizer = ensureVisualizer(w, h);
      if (!visualizer) return false;
      var name = effectivePreset(appState || getAppState());
      if (!name) return false;
      if (state.currentPreset !== name) applyPreset(name, 1.5);
      visualizer.render();
      ctx.save(); ctx.drawImage(state.canvas, 0, 0, w, h); ctx.restore();
      return true;
    } catch (error) { return false; }
  }

  function ensureMiniAudio(audio) {
    if (miniState.connectedAudio === audio && miniState.audioContext) {
      if (miniState.audioContext.state === 'suspended') miniState.audioContext.resume().catch(function () {});
      return miniState.sourceNode;
    }
    primeMiniAudio(audio);
    return miniState.sourceNode;
  }

  function ensureMiniVisualizer(w, h, audio) {
    if (!miniState.butterchurn) miniState.butterchurn = state.butterchurn;
    if (!miniState.butterchurn || !ensureMiniAudio(audio)) return null;
    if (!miniState.canvas) miniState.canvas = document.createElement('canvas');
    miniState.width = Math.max(1, Math.floor(w));
    miniState.height = Math.max(1, Math.floor(h));
    miniState.canvas.width = miniState.width;
    miniState.canvas.height = miniState.height;
    if (!miniState.visualizer) {
      miniState.visualizer = miniState.butterchurn.createVisualizer(miniState.audioContext, miniState.canvas,
        { width: miniState.width, height: miniState.height, pixelRatio: 1, textureRatio: 1 });
      miniState.visualizer.connectAudio(miniState.sourceNode || miniState.audioContext);
      miniState.currentPreset = '';
    } else {
      miniState.visualizer.setRendererSize(miniState.width, miniState.height);
    }
    return miniState.visualizer;
  }

  function drawMini(ctx, w, h, time, appState, audio) {
    if (!ctx || !w || !h || !audio) return false;
    if (!state.ready) { prepare().catch(function () {}); return false; }
    try {
      var visualizer = ensureMiniVisualizer(w, h, audio);
      if (!visualizer) return false;
      var name = effectivePreset(appState || getAppState());
      if (!name) return false;
      if (miniState.currentPreset !== name) {
        visualizer.loadPreset(state.presets[name], 1.5);
        miniState.currentPreset = name;
      }
      visualizer.render();
      ctx.drawImage(miniState.canvas, 0, 0, w, h);
      return true;
    } catch (error) { return false; }
  }

  function tryResumeContexts() {
    if (window.__kefeSharedAudioCtx && window.__kefeSharedAudioCtx.state === 'suspended') {
      window.__kefeSharedAudioCtx.resume().catch(function () {});
    }
  }
  ['touchstart', 'click', 'pointerdown'].forEach(function (ev) {
    document.addEventListener(ev, tryResumeContexts, { passive: true, capture: true });
  });

  function stop() {
    if (state.visualizer) state.visualizer = null;
    if (state.sourceNode) { try { state.sourceNode.disconnect(); } catch (_) {} state.sourceNode = null; }
    state.canvas = null; state.connectedAudio = null; state.currentPreset = '';
    state.width = 0; state.height = 0;
  }

  function stopMini() {
    if (miniState.visualizer) miniState.visualizer = null;
    if (miniState.sourceNode) { try { miniState.sourceNode.disconnect(); } catch (_) {} miniState.sourceNode = null; }
    miniState.canvas = null; miniState.connectedAudio = null; miniState.currentPreset = '';
    miniState.width = 0; miniState.height = 0;
  }

  window.kefeButterchurn = {
    version: 8,
    limit: PRESET_LIMIT,
    prepare: prepare,
    retry: retry,
    selectPreset: selectPreset,
    draw: draw,
    drawMini: drawMini,
    primeMiniAudio: primeMiniAudio,
    stop: stop,
    stopMini: stopMini,
    presetNames: function () { return state.names.slice(); },
    effectivePreset: effectivePreset,
    get ready() { return state.ready; },
    get lastError() { return state.lastError; },
    get loadedVia() { return state.loadedVia; }
  };
})();
