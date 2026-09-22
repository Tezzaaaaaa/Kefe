/* KEFE — Butterchurn / MilkDrop visualiser.
   Loads the official Butterchurn renderer and the curated Butterchurn preset
   packs, exposes exactly 100 sorted presets to KEFE, and renders them into
   the main preview canvas from KEFE's master audio element.
*/
(function () {
  'use strict';

  if (window.kefeButterchurn) return;

  var RENDERER_URL = 'https://unpkg.com/butterchurn@3.0.0-beta.5/dist/butterchurn.min.js';
  var BASE_URL = 'https://unpkg.com/butterchurn-presets@3.0.0-beta.4/dist/base.min.js';
  var EXTRA_URL = 'https://unpkg.com/butterchurn-presets@3.0.0-beta.4/dist/extra.min.js';
  var PRESET_LIMIT = 100;

  var state = {
    loading: null,
    butterchurn: null,
    presets: {},
    names: [],
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

  function loadScript(src, id) {
    return new Promise(function (resolve, reject) {
      var existing = document.getElementById(id);
      if (existing) {
        if (existing.dataset.loaded === 'true') return resolve();
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }

      var script = document.createElement('script');
      script.id = id;
      script.src = src;
      script.async = true;
      script.onload = function () {
        script.dataset.loaded = 'true';
        resolve();
      };
      script.onerror = function () {
        reject(new Error('Could not load ' + src));
      };
      document.head.appendChild(script);
    });
  }

  function collectPresets() {
    var combined = {};
    if (window.base && window.base.default) Object.assign(combined, window.base.default);
    if (window.extra && window.extra.default) Object.assign(combined, window.extra.default);

    var names = Object.keys(combined)
      .filter(function (name) { return combined[name] && typeof combined[name] === 'object'; })
      .sort(function (a, b) { return a.toLowerCase().localeCompare(b.toLowerCase()); })
      .slice(0, PRESET_LIMIT);

    var selected = {};
    names.forEach(function (name) { selected[name] = combined[name]; });

    state.presets = selected;
    state.names = names;
    return names;
  }

  function ensureAudio() {
    var audio = window.kefeAudioElement;
    if (!audio) throw new Error('KEFE master audio element is unavailable.');

    var AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) throw new Error('Web Audio is unavailable in this browser.');

    if (!state.audioContext) state.audioContext = new AudioCtx();

    // A MediaElementSource can only be created once for a given <audio>.
    if (!state.sourceNode || state.connectedAudio !== audio) {
      if (state.sourceNode) {
        try { state.sourceNode.disconnect(); } catch (_) {}
      }
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
        state.audioContext,
        state.canvas,
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

    state.visualizer.loadPreset(state.presets[name], Number.isFinite(blendSeconds) ? blendSeconds : 1.5);
    state.currentPreset = name;
    return true;
  }

  async function prepare() {
    if (!state.loading) {
      state.loading = Promise.all([
        loadScript(RENDERER_URL, 'kefe-butterchurn-renderer'),
        loadScript(BASE_URL, 'kefe-butterchurn-base'),
        loadScript(EXTRA_URL, 'kefe-butterchurn-extra')
      ]).then(function () {
        if (!window.butterchurn) {
          throw new Error('Butterchurn renderer did not initialise.');
        }
        state.butterchurn = window.butterchurn;
        collectPresets();
        return state.names;
      }).catch(function (error) {
        state.loading = null;
        throw error;
      });
    }

    return state.loading;
  }

  async function selectPreset(name) {
    await prepare();
    if (state.names.indexOf(name) < 0) return false;
    if (!getAppState().style) getAppState().style = {};
    getAppState().style.visualiserStyle = 'butterchurn';
    getAppState().style.butterchurnPreset = name;
    state.currentPreset = '';
    return true;
  }

  function draw(ctx, w, h, time, appState) {
    if (!ctx || !w || !h) return false;

    // Loading is intentionally lazy: Butterchurn adds substantial WebGL and
    // preset code, so ordinary KEFE visualisers do not pay that cost.
    if (!state.butterchurn) {
      prepare().catch(function (error) {
        console.warn('[KEFE Butterchurn]', error);
      });
      return false;
    }

    try {
      var visualizer = ensureVisualizer(w, h);
      if (!visualizer) return false;

      var name = effectivePreset(appState || getAppState());
      if (!name) return false;

      if (state.currentPreset !== name) {
        applyPreset(name, 1.5);
      }

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

  window.kefeButterchurn = {
    version: 1,
    limit: PRESET_LIMIT,
    prepare: prepare,
    selectPreset: selectPreset,
    draw: draw,
    presetNames: function () { return state.names.slice(); },
    effectivePreset: effectivePreset,
    get ready() { return !!state.butterchurn && state.names.length === PRESET_LIMIT; }
  };

  window.dispatchEvent(new CustomEvent('kefe:butterchurn-ready', {
    detail: window.kefeButterchurn
  }));
})();
