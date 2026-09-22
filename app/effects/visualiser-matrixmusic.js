/* KEFE — Matrix Music Visualizer preset group.
   Uses the upstream Matrix Music Visualizer renderer/preset data as an isolated
   WebGL surface, driven by KEFE's existing analysed master audio timeline.
   The renderer remains lazy: it is only imported when Matrix Music is selected.
*/
(function () {
  'use strict';

  if (window.kefeMatrixVisualiser) return;

  var CDN = 'https://cdn.jsdelivr.net/gh/cwilliams5/matrix-music-visualizer@main/vendor/matrix/';
  var APP_CDN = 'https://cdn.jsdelivr.net/gh/cwilliams5/matrix-music-visualizer@main/app/';
  var MODULES = {
    reactive: CDN + 'js/reactive.js',
    config: CDN + 'js/config.js',
    renderer: CDN + 'js/regl/main.js',
    presets: APP_CDN + 'presets.js',
    palettes: APP_CDN + 'palette-store.js'
  };

  var state = {
    loading: null,
    makeConfig: null,
    makeRenderer: null,
    A: null,
    mapping: null,
    buildDefaultRecords: null,
    palettes: null,
    records: [],
    renderer: null,
    canvas: null,
    host: null,
    width: 0,
    height: 0,
    presetId: 'pulse-rain',
    mode: 'classic',
    palette: 'mode-default',
    stopped: true
  };

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function frameAt(time, analysis) {
    if (!analysis || !analysis.frameHopMs || !Array.isArray(analysis.energy)) return null;
    var hop = analysis.frameHopMs / 1000;
    var idx = Math.max(0, Math.min(analysis.energy.length - 1, Math.floor(time / hop)));
    var e = analysis.energy[idx] || 0;
    var b = analysis.bands && analysis.bands[idx] || {};
    var flux = analysis.flux && analysis.flux[idx] || 0;
    var maxE = analysis.summary && analysis.summary.peakRms || 1;
    var maxF = analysis.summary && analysis.summary.averageFlux ? analysis.summary.averageFlux * 4 : 1;
    var beat = 0;
    var beatPulse = 0;
    var beatBass = 0;
    var onset = 0;

    if (Array.isArray(analysis.onsetPeaks)) {
      for (var i = 0; i < analysis.onsetPeaks.length; i++) {
        var d = Math.abs(analysis.onsetPeaks[i].time - time);
        if (d < hop * 1.5) {
          beat = 1;
          var strength = Number(analysis.onsetPeaks[i].strength) || 0;
          beatPulse = Math.max(beatPulse, Math.min(1, strength / Math.max(0.0001, maxF)));
          onset = beatPulse;
          if ((b.bass || 0) >= (b.mids || 0)) beatBass = beatPulse;
          break;
        }
        if (analysis.onsetPeaks[i].time > time + 0.25) break;
      }
    }

    return {
      energy: Math.min(1, e / Math.max(0.0001, maxE)),
      level: Math.min(1, e / Math.max(0.0001, maxE)),
      rms: e,
      peak: e,
      bass: Math.min(1, (b.bass || 0) / Math.max(0.0001, maxE)),
      lowMid: Math.min(1, (b.mids || 0) / Math.max(0.0001, maxE)),
      mid: Math.min(1, (b.mids || 0) / Math.max(0.0001, maxE)),
      highMid: Math.min(1, (b.mids || 0) / Math.max(0.0001, maxE)),
      treble: Math.min(1, (b.treble || 0) / Math.max(0.0001, maxE)),
      flux: Math.min(1, flux / Math.max(0.0001, maxF)),
      centroid: Math.min(1, (b.treble || 0) / Math.max(0.0001, (b.bass || 0) + (b.treble || 0) + 0.0001)),
      balance: 0,
      stereoWidth: 0,
      beat: beat,
      beatPulse: beatPulse,
      beatBass: beatBass,
      onset: onset,
      bpm: Number(analysis.bpm) || 0,
      beatPhase: 0,
      beatClock: 0,
      beatCount: 0,
      energySlow: Math.min(1, (analysis.summary && analysis.summary.averageRms || 0) / Math.max(0.0001, maxE)),
      playing: window.kefeAudioElement && !window.kefeAudioElement.paused ? 1 : 0
    };
  }

  function resetShader() {
    if (!state.A) return;
    var keys = Object.keys(state.A.shader || {});
    keys.forEach(function (key) {
      state.A.shader[key] = (key === 'shockX' || key === 'shockY') ? 0.5 : 0;
    });
  }

  function configureActiveRecord(record) {
    if (!state.A || !record) return;
    state.A.reactive = true;
    state.A.intensity = Number(record.intensity) || 1;
    state.A.mixer = clone(record.mixer || {});
    state.A.characterId = record.characterId || record.id;
    state.A.knobs = {};
    resetShader();
  }

  function buildConfig(mode, paletteId) {
    var resolved = state.palettes.resolve(paletteId || 'mode-default');
    var params = {
      version: mode || 'classic',
      effect: resolved.effect,
      resolution: 0.75,
      skipIntro: true,
      useHoloplay: false
    };
    if (resolved.palette) params.palette = resolved.palette;
    if (resolved.stripeColors) params.stripeColors = resolved.stripeColors;

    var stringParams = {};
    Object.keys(params).forEach(function (key) {
      stringParams[key] = String(params[key]);
    });

    var config = state.makeConfig(stringParams);
    config.assetBase = CDN;
    config.resolution = 0.75;
    config.skipIntro = true;
    return config;
  }

  async function load() {
    if (state.loading) return state.loading;

    state.loading = Promise.all([
      import(MODULES.reactive),
      import(MODULES.config),
      import(MODULES.renderer),
      import(MODULES.presets),
      import(MODULES.palettes)
    ]).then(function (mods) {
      state.A = mods[0].A;
      state.makeConfig = mods[1].default;
      state.makeRenderer = mods[2].default;
      state.buildDefaultRecords = mods[3].buildDefaultRecords;
      state.mapping = mods[3].mapping;
      state.palettes = mods[4].palettes;
      state.palettes.init();
      state.records = state.buildDefaultRecords().filter(function (r) {
        return !r.generative && r.id !== 'random';
      });
      state.A.update = function (t) {
        var audio = window.kefeAudioElement;
        var analysis = window.kefeVisualiser && window.kefeVisualiser.data;
        var seconds = audio && Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
        var f = frameAt(seconds, analysis);
        var dt = state.A.features.time ? Math.max(0, t - state.A.features.time) : 1 / 60;
        state.A.features.time = t;
        state.A.features.dt = Math.min(0.25, dt);
        if (f) {
          Object.keys(f).forEach(function (key) {
            if (key !== 'energySlow') state.A.features[key] = f[key];
          });
          state.A.features.energySlow = f.energySlow;
        }
        state.mapping.apply(t, state.A.features.dt);
      };
      return true;
    }).catch(function (error) {
      state.loading = null;
      throw error;
    });

    return state.loading;
  }

  function ensureHost(w, h) {
    if (!state.host) {
      state.host = document.createElement('div');
      state.host.style.position = 'fixed';
      state.host.style.left = '-10000px';
      state.host.style.top = '0';
      state.host.style.pointerEvents = 'none';
      state.host.style.visibility = 'hidden';
      state.host.setAttribute('aria-hidden', 'true');
      document.body.appendChild(state.host);
    }
    if (!state.canvas) {
      state.canvas = document.createElement('canvas');
      state.canvas.setAttribute('aria-hidden', 'true');
      state.host.appendChild(state.canvas);
    }
    state.width = Math.max(1, Math.floor(w));
    state.height = Math.max(1, Math.floor(h));
    state.canvas.style.width = state.width + 'px';
    state.canvas.style.height = state.height + 'px';
    state.canvas.width = state.width;
    state.canvas.height = state.height;
  }

  async function start(w, h) {
    await load();
    ensureHost(w, h);

    var wanted = state.records.find(function (r) { return r.id === state.presetId; }) || state.records[0];
    var mode = wanted && wanted.jumpMode ? wanted.jumpMode : state.mode;
    var palette = wanted && wanted.jumpPalette ? wanted.jumpPalette : state.palette;

    configureActiveRecord(wanted);

    var config = buildConfig(mode, palette);
    state.mode = mode;
    state.palette = palette;

    if (!state.renderer) {
      var oldResize = window.onresize;
      state.renderer = await state.makeRenderer(state.canvas, config);
      window.onresize = oldResize;
    } else {
      await state.renderer.rebuild(config);
    }

    state.stopped = false;
    return true;
  }

  async function selectPreset(id, w, h) {
    await load();
    var record = state.records.find(function (r) { return r.id === id; });
    if (!record) return false;
    state.presetId = id;
    if (w && h) await start(w, h);
    return true;
  }

  function stop() {
    state.stopped = true;
    if (state.A) {
      state.A.reactive = false;
      state.A.mixer = {};
      state.A.knobs = {};
      resetShader();
    }
    if (state.renderer) {
      try { state.renderer.destroy(); } catch (_) {}
      state.renderer = null;
    }
    if (state.host) {
      state.host.remove();
      state.host = null;
      state.canvas = null;
    }
  }

  function draw(ctx, w, h) {
    if (state.stopped) {
      start(w, h).catch(function (error) {
        console.warn('[KEFE Matrix Music]', error);
      });
      return false;
    }
    ensureHost(w, h);
    if (state.canvas && (state.canvas.width !== state.width || state.canvas.height !== state.height)) {
      state.canvas.width = state.width;
      state.canvas.height = state.height;
    }
    if (state.canvas) {
      ctx.save();
      ctx.drawImage(state.canvas, 0, 0, w, h);
      ctx.restore();
      return true;
    }
    return false;
  }

  window.kefeMatrixVisualiser = {
    version: 1,
    load: load,
    start: start,
    stop: stop,
    draw: draw,
    selectPreset: selectPreset,
    presetNames: function () {
      return state.records.map(function (r) { return r.name; });
    },
    presetRecords: function () {
      return state.records.map(function (r) { return clone(r); });
    },
    get activePreset() {
      var record = state.records.find(function (r) { return r.id === state.presetId; });
      return record ? record.name : '';
    }
  };
})();
