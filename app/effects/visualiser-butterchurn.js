/* KEFE — Butterchurn / MilkDrop visualiser. MiniPlayer-only.

   Tries jsDelivr first, then unpkg as a fallback. Detects which global the
   preset packs actually set. Records a human-readable error in lastError
   if loading fails, so the MiniPlayer can show it on-screen.

   BUTTERCHURN API SHAPE
   ---------------------
   The Butterchurn UMD build exposes its API in different places across
   versions: window.butterchurn, window.butterchurn.default, or a nested
   property. resolveButterchurnApi() checks all of them, and falls back to
   a dynamic import() if none of the globals work. If everything fails, the
   error message includes the keys actually present on window.butterchurn
   so the failure mode is visible in the MiniPlayer canvas.
*/
(function () {
  'use strict';

  if (window.kefeButterchurn) return;

  var CDN_SOURCES = [
    {
      name: 'jsdelivr',
      renderer: 'https://cdn.jsdelivr.net/npm/butterchurn@3.0.0-beta.5/dist/butterchurn.min.js',
      base:     'https://cdn.jsdelivr.net/npm/butterchurn-presets@3.0.0-beta.4/dist/base.min.js',
      extra:    'https://cdn.jsdelivr.net/npm/butterchurn-presets@3.0.0-beta.4/dist/extra.min.js'
    },
    {
      name: 'unpkg',
      renderer: 'https://unpkg.com/butterchurn@3.0.0-beta.5/dist/butterchurn.min.js',
      base:     'https://unpkg.com/butterchurn-presets@3.0.0-beta.4/dist/base.min.js',
      extra:    'https://unpkg.com/butterchurn-presets@3.0.0-beta.4/dist/extra.min.js'
    }
  ];

  var PRESET_LIMIT = 100;

  var state = {
    loading: null,
    ready: false,
    lastError: '',
    butterchurn: null,
    presets: {},
    names: [],
    loadedVia: '',
    visualizer: null,
    audioContext: null,
    sourceNode: null,
    canvas: null,
    width: 0,
    height: 0,
    connectedAudio: null,
    currentPreset: ''
  };

  var miniState = {
    butterchurn: null,
    visualizer: null,
    audioContext: null,
    sourceNode: null,
    canvas: null,
    width: 0,
    height: 0,
    connectedAudio: null,
    currentPreset: ''
  };

  function getAppState() {
    return window.state || { style: {} };
  }

  function loadScriptOnce(src, id) {
    return new Promise(function (resolve, reject) {
      var existing = document.getElementById(id);
      if (existing) {
        if (existing.dataset.loaded === 'true') return resolve();
        if (existing.dataset.failed === 'true') {
          existing.remove();
        } else {
          existing.addEventListener('load', resolve, { once: true });
          existing.addEventListener('error', reject, { once: true });
          return;
        }
      }

      var script = document.createElement('script');
      script.id = id;
      script.src = src;
      script.async = false;
      script.onload = function () {
        script.dataset.loaded = 'true';
        resolve();
      };
      script.onerror = function () {
        script.dataset.failed = 'true';
        reject(new Error('Could not load ' + src));
      };
      document.head.appendChild(script);
    });
  }

  /* Butterchurn exposes createVisualizer() in different places depending
     on how the UMD build wrapped it. Check the common shapes. */
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
    var candidates = [
      window.base, window.butterchurnPresets,
      window.extra, window.butterchurnPresetsExtra
    ];
    for (var i = 0; i < candidates.length; i++) {
      var c = candidates[i];
      if (!c) continue;
      var source = (c.default && typeof c.default === 'object') ? c.default : c;
      if (source && typeof source === 'object' && !Array.isArray(source)) {
        Object.assign(combined, source);
      }
    }

    var names = Object.keys(combined)
      .filter(function (name) {
        return combined[name] && typeof combined[name] === 'object';
      })
      .sort(function (a, b) {
        return a.toLowerCase().localeCompare(b.toLowerCase());
      })
      .slice(0, PRESET_LIMIT);

    var selected = {};
    names.forEach(function (name) { selected[name] = combined[name]; });

    state.presets = selected;
    state.names = names;
    return names;
  }

  function ensureAudio() {
    var audio = window.kefeAudioElement;
    if (!audio) throw new Error('Main audio element unavailable.');
    var AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) throw new Error('Web Audio unavailable.');
    if (!state.audioContext) state.audioContext = new AudioCtx();
    if (!state.sourceNode || state.connectedAudio !== audio) {
      if (state.sourceNode) { try { state.sourceNode.disconnect(); } catch (_) {} }
      state.sourceNode = state.audioContext.createMediaElementSource(audio);
      state.sourceNode.connect(state.audioContext.destination);
      state.connectedAudio = audio;
    }
    if (state.audioContext.state === 'suspended') {
      state.audioContext.resume().catch(function () {});
    }
    return state.sourceNode;
  }

  function ensureCanvas(w, h) {
    if (!state.canvas) state.canvas = document.createElement('canvas');
    if (state.width !== w || state.height !== h) {
      state.width = w;
      state.height = h;
      state.canvas.width = Math.max(1, Math.floor(w));
      state.canvas.height = Math.max(1, Math.floor(h));
    }
    return state.canvas;
  }

  function ensureVisualizer(w, h) {
    if (!state.butterchurn || !state.audioContext) return null;
    ensureCanvas(w, h);
    if (!state.visualizer) {
      state.visualizer = state.butterchurn.createVisualizer(
        state.audioContext, state.canvas,
        {
          width: Math.max(1, Math.floor(w)),
          height: Math.max(1, Math.floor(h)),
          pixelRatio: 1,
          textureRatio: 1
        }
      );
      state.visualizer.connectAudio(ensureAudio());
      state.currentPreset = '';
    } else {
      state.visualizer.setRendererSize(
        Math.max(1, Math.floor(w)),
        Math.max(1, Math.floor(h))
      );
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
    state.visualizer.loadPreset(
      state.presets[name],
      Number.isFinite(blendSeconds) ? blendSeconds : 1.5
    );
    state.currentPreset = name;
    return true;
  }

  async function tryLoadFromSource(source) {
    await loadScriptOnce(source.renderer, 'kefe-butterchurn-renderer-' + source.name);

    var api = resolveButterchurnApi();

    // Fallback: if the UMD script did not expose the API cleanly, try a
    // dynamic import on the same URL. On modern browsers the ESM wrapper
    // will be preferred by the CDN, and the module's default export is
    // the visualizer factory.
    if (!api) {
      try {
        var mod = await import(/* @vite-ignore */ source.renderer);
        var candidate = mod.default || mod;
        if (candidate && typeof candidate.createVisualizer === 'function') {
          window.butterchurn = candidate;
          api = candidate;
        }
      } catch (_) {}
    }

    if (!api) {
      var w = window.butterchurn;
      var shape = !w
        ? '(window.butterchurn undefined)'
        : '(keys: ' + Object.keys(w).slice(0, 30).join(', ') + ')';
      throw new Error('No createVisualizer(). Shape ' + shape);
    }

    window.butterchurn = api;
    state.butterchurn = api;

    try { await loadScriptOnce(source.base, 'kefe-butterchurn-base-' + source.name); } catch (_) {}
    try { await loadScriptOnce(source.extra, 'kefe-butterchurn-extra-' + source.name); } catch (_) {}

    var names = collectPresets();

    if (!names.length) {
      var globals = [
        'base', 'butterchurnPresets', 'extra', 'butterchurnPresetsExtra'
      ].map(function (n) {
        var v = window[n];
        return n + '=' + (v == null ? 'undefined' : typeof v);
      }).join(', ');
      throw new Error('Preset packs loaded but no presets found. Globals: ' + globals);
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
      state.lastError = lastError
        ? String(lastError.message || lastError)
        : 'All CDN sources failed';
      throw lastError || new Error(state.lastError);
    })();

    return state.loading;
  }

  async function retry() {
    state.ready = false;
    state.lastError = '';
    state.loading = null;
    state.butterchurn = null;
    state.presets = {};
    state.names = [];
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
    if (!state.ready) {
      prepare().catch(function () {});
      return false;
    }
    try {
      var visualizer = ensureVisualizer(w, h);
      if (!visualizer) return false;
      var name = effectivePreset(appState || getAppState());
      if (!name) return false;
      if (state.currentPreset !== name) applyPreset(name, 1.5);
      visualizer.render();
      ctx.save();
      ctx.drawImage(state.canvas, 0, 0, w, h);
      ctx.restore();
      return true;
    } catch (error) {
      console.warn('[KEFE Butterchurn]', error);
      return false;
    }
  }

  function ensureMiniAudio(audio) {
    var AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx || !audio) return null;
    if (!miniState.audioContext) miniState.audioContext = new AudioCtx();
    if (!miniState.sourceNode || miniState.connectedAudio !== audio) {
      if (miniState.sourceNode) { try { miniState.sourceNode.disconnect(); } catch (_) {} }
      miniState.sourceNode = miniState.audioContext.createMediaElementSource(audio);
      miniState.sourceNode.connect(miniState.audioContext.destination);
      miniState.connectedAudio = audio;
    }
    if (miniState.audioContext.state === 'suspended') miniState.audioContext.resume().catch(function () {});
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
      miniState.visualizer = miniState.butterchurn.createVisualizer(
        miniState.audioContext, miniState.canvas,
        {
          width: miniState.width,
          height: miniState.height,
          pixelRatio: 1,
          textureRatio: 1
        }
      );
      miniState.visualizer.connectAudio(miniState.sourceNode);
      miniState.currentPreset = '';
    } else {
      miniState.visualizer.setRendererSize(miniState.width, miniState.height);
    }
    return miniState.visualizer;
  }

  function drawMini(ctx, w, h, time, appState, audio) {
    if (!ctx || !w || !h || !audio) return false;
    if (!state.ready) {
      prepare().catch(function () {});
      return false;
    }
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
    } catch (error) {
      console.warn('[KEFE Butterchurn MiniPlayer]', error);
      return false;
    }
  }

  function stop() {
    if (state.visualizer) { try { state.visualizer = null; } catch (_) {} }
    if (state.sourceNode) { try { state.sourceNode.disconnect(); } catch (_) {} state.sourceNode = null; }
    if (state.audioContext) { try { state.audioContext.close(); } catch (_) {} state.audioContext = null; }
    state.canvas = null;
    state.connectedAudio = null;
    state.currentPreset = '';
    state.width = 0;
    state.height = 0;
  }

  function stopMini() {
    if (miniState.visualizer) { try { miniState.visualizer = null; } catch (_) {} }
    if (miniState.sourceNode) { try { miniState.sourceNode.disconnect(); } catch (_) {} miniState.sourceNode = null; }
    if (miniState.audioContext) { try { miniState.audioContext.close(); } catch (_) {} miniState.audioContext = null; }
    miniState.canvas = null;
    miniState.connectedAudio = null;
    miniState.currentPreset = '';
    miniState.width = 0;
    miniState.height = 0;
  }

  window.kefeButterchurn = {
    version: 3,
    limit: PRESET_LIMIT,
    prepare: prepare,
    retry: retry,
    selectPreset: selectPreset,
    draw: draw,
    drawMini: drawMini,
    stop: stop,
    stopMini: stopMini,
    presetNames: function () { return state.names.slice(); },
    effectivePreset: effectivePreset,
    get ready() { return state.ready; },
    get lastError() { return state.lastError; },
    get loadedVia() { return state.loadedVia; }
  };

  window.dispatchEvent(new CustomEvent('kefe:butterchurn-ready', {
    detail: window.kefeButterchurn
  }));
})();
