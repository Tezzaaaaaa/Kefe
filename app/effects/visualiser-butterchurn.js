/* KEFE — Butterchurn (MilkDrop) visualiser
 *
 * Runs the real Butterchurn engine (jberg/butterchurn 2.6.7) with the real
 * butterchurn-presets 2.4.7 pack. Both are vendored byte-for-byte in
 * vendor/butterchurn/. The engine and the preset data are not modified,
 * re-implemented or approximated — this file is only the bridge to KEFE.
 *
 * KEFE renders frames by time (preview scrub, pause, export), never by a live
 * audio graph, so the bridge does three things:
 *   1. Decodes the master audio once and, for each simulation step, hands
 *      Butterchurn the exact 1024-sample window ending at that step's time,
 *      using the same byte encoding as AnalyserNode.getByteTimeDomainData.
 *   2. Steps the simulation at a fixed SIM_FPS, so preview and export evolve
 *      identically and a paused/redrawn frame never advances the feedback loop.
 *   3. Resets the feedback buffers on seek / export start / preset change.
 */
(function () {
  'use strict';
  if (window.kefeButterchurn) return;

  var SIM_FPS = 30; // fixed simulation rate (preview == export)
  var FFT = 1024; // Butterchurn's analyser window (numSamps * 2)
  var SAMPLE_RATE = 44100;
  var WARMUP_FRAMES = 30; // frames replayed before a seek target so feedback is populated
  var MAX_CATCHUP = 8; // most steps taken for a single draw when playback lags
  var SEEK_FRAMES = 90; // a forward jump bigger than this counts as a seek
  var DEFAULT_PRESET = 'Flexi, martin + geiss - dedicated to the sherwin maxawow';

  function unwrap(g) {
    return g && (g.default || g);
  }
  function engineLib() {
    return unwrap(window.butterchurn);
  }
  function presetLib() {
    return unwrap(window.butterchurnPresets);
  }
  function imageLib() {
    return unwrap(window.butterchurnExtraImages);
  }

  /* ---------- preset catalogue ---------- */
  var presetMap = null;
  var names = [];
  function loadPresetData() {
    if (presetMap) return presetMap;
    var lib = presetLib();
    if (!lib || typeof lib.getPresets !== 'function') return {};
    presetMap = lib.getPresets() || {};
    names = Object.keys(presetMap).sort(function (a, b) {
      return a.toLowerCase().localeCompare(b.toLowerCase());
    });
    return presetMap;
  }
  function effectivePreset(appState) {
    var map = loadPresetData();
    var want = appState && appState.style && appState.style.butterchurnPreset;
    if (want && map[want]) return want;
    if (map[DEFAULT_PRESET]) return DEFAULT_PRESET;
    return names[0] || '';
  }

  /* ---------- audio: decoded PCM -> Butterchurn time-domain windows ---------- */
  var pcm = { file: null, L: null, R: null, promise: null };

  function sourceFile(st) {
    st = st || window.state || {};
    var master = (st.audioSource && st.audioSource.master) || 'uploaded';
    if (master === 'none') return null;
    if (master === 'video') {
      var m = window.kefeMedia;
      return (m && m.videoFile) || null;
    }
    return (st.audio && st.audio.file) || null;
  }

  function ensurePcm(st) {
    var file = sourceFile(st);
    if (!file) {
      pcm = { file: null, L: null, R: null, promise: null };
      return Promise.resolve(false);
    }
    if (pcm.file === file && pcm.promise) return pcm.promise;
    var mine = { file: file, L: null, R: null, promise: null };
    pcm = mine;
    mine.promise = file
      .arrayBuffer()
      .then(function (ab) {
        var Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        return new Ctx(2, 1, SAMPLE_RATE).decodeAudioData(ab);
      })
      .then(function (buf) {
        if (pcm !== mine) return false;
        mine.L = buf.getChannelData(0);
        mine.R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : mine.L;
        if (!window.isExporting && typeof window.redrawCurrentPreviewFrame === 'function') {
          window.redrawCurrentPreviewFrame();
        }
        return true;
      })
      .catch(function (e) {
        console.warn('[KEFE butterchurn] could not decode audio; running on silence', e);
        return false;
      });
    return mine.promise;
  }

  var bufM = new Uint8Array(FFT);
  var bufL = new Uint8Array(FFT);
  var bufR = new Uint8Array(FFT);

  // AnalyserNode.getByteTimeDomainData: floor(128 * (1 + x)), clamped to 0..255.
  function toByte(x) {
    var v = Math.floor(128 * (1 + x));
    return v < 0 ? 0 : v > 255 ? 255 : v;
  }

  function fillAudio(t) {
    var L = pcm.L;
    var R = pcm.R;
    if (!L || !R) {
      bufM.fill(128);
      bufL.fill(128);
      bufR.fill(128);
      return;
    }
    var start = Math.floor(t * SAMPLE_RATE) - FFT; // the FFT samples before t, like an analyser at t
    var n = L.length;
    for (var i = 0; i < FFT; i++) {
      var s = start + i;
      var l = 0;
      var r = 0;
      if (s >= 0 && s < n) {
        l = L[s];
        r = R[s];
      }
      bufL[i] = toByte(l);
      bufR[i] = toByte(r);
      bufM[i] = toByte(0.5 * (l + r)); // the analyser's stereo -> mono downmix
    }
  }

  /* ---------- engine ---------- */
  var eng = null;
  var failMsg = '';

  function createEngine(w, h) {
    var B = engineLib();
    if (!B || typeof B.createVisualizer !== 'function') return null;
    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    // Create the context first so it can keep its drawing buffer: a paused or
    // redrawn preview re-blits the last simulated frame in a later task.
    // Butterchurn's own getContext('webgl2', ...) returns this same context.
    var gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true
    });
    if (!gl) throw new Error('Butterchurn needs WebGL 2, which this browser does not provide.');
    var Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    var vis = B.createVisualizer(new Ctx(2, 1, SAMPLE_RATE), canvas, {
      width: w,
      height: h,
      pixelRatio: 1,
      textureRatio: 1
    });
    var imgs = imageLib();
    if (imgs && typeof imgs.getImages === 'function') vis.loadExtraImages(imgs.getImages());
    return { canvas: canvas, gl: gl, vis: vis, w: w, h: h, preset: null, lastIdx: null, rendered: false };
  }

  // Return the simulation to its just-created state and load `name`.
  function resetSim(name) {
    var r = eng.vis.renderer;
    var gl = eng.gl;
    if (eng.rendered && r) {
      try {
        [r.prevFrameBuffer, r.targetFrameBuffer, r.compFrameBuffer].forEach(function (fb) {
          if (!fb) return;
          gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
          if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE) {
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
          }
        });
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        r.frameNum = 0;
        r.time = 0;
        r.fps = SIM_FPS;
        r.timeHist = [0];
        r.blending = false;
        r.presetTime = 0;
        r.blendStartTime = 0;
        r.blendProgress = 0;
        // Audio-level smoothing history (bass/mid/treb averages) restarts too.
        r.audioLevels = new r.audioLevels.constructor(r.audio);
        // Start from the blank preset, as a fresh visualizer does.
        r.preset = r.blankPreset;
        r.prevPreset = r.blankPreset;
        r.presetEquationRunner = new r.presetEquationRunner.constructor(
          r.blankPreset,
          { frame: 0, time: 0, fps: 45, bass: 1, bass_att: 1, mid: 1, mid_att: 1, treb: 1, treb_att: 1 },
          {
            pixelRatio: r.pixelRatio,
            textureRatio: r.textureRatio,
            texsizeX: r.texsizeX,
            texsizeY: r.texsizeY,
            mesh_width: r.mesh_width,
            mesh_height: r.mesh_height,
            aspectx: r.aspectx,
            aspecty: r.aspecty
          }
        );
      } catch (e) {
        console.warn('[KEFE butterchurn] reset failed', e);
      }
    }
    eng.vis.loadPreset(presetMap[name], 0.0);
    eng.preset = name;
    eng.rendered = false;
  }

  function step(idx) {
    fillAudio(idx / SIM_FPS);
    eng.vis.render({
      audioLevels: { timeByteArray: bufM, timeByteArrayL: bufL, timeByteArrayR: bufR },
      elapsedTime: 1 / SIM_FPS
    });
    eng.rendered = true;
  }

  function notice(ctx, w, h, msg) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.font = '600 ' + Math.round(Math.min(w, h) * 0.032) + 'px "Open Sans", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(msg, w / 2, h / 2);
    ctx.restore();
  }

  function draw(ctx, w, h, time, appState) {
    w = Math.round(w);
    h = Math.round(h);
    if (!(w > 0 && h > 0)) return;
    if (failMsg) return notice(ctx, w, h, failMsg);
    if (!engineLib() || !presetLib()) return notice(ctx, w, h, 'Butterchurn is loading…');
    loadPresetData();
    if (!names.length) return notice(ctx, w, h, 'No Butterchurn presets found');
    ensurePcm(appState);

    if (!eng) {
      try {
        eng = createEngine(w, h);
      } catch (e) {
        failMsg = (e && e.message) || 'Butterchurn failed to start';
        console.error('[KEFE butterchurn]', e);
        return notice(ctx, w, h, failMsg);
      }
      if (!eng) return;
    } else if (eng.w !== w || eng.h !== h) {
      eng.canvas.width = w;
      eng.canvas.height = h;
      eng.vis.setRendererSize(w, h);
      eng.w = w;
      eng.h = h;
    }

    var name = effectivePreset(appState);
    var t = Number.isFinite(time) ? Math.max(0, time) : 0;
    var idx = Math.floor(t * SIM_FPS + 1e-6);
    var last = eng.lastIdx;
    var from;
    if (eng.preset !== name || last === null || idx < last || idx - last > SEEK_FRAMES) {
      resetSim(name);
      from = Math.max(0, idx - (WARMUP_FRAMES - 1));
    } else {
      from = Math.max(last + 1, idx - (MAX_CATCHUP - 1));
    }
    for (var f = from; f <= idx; f++) step(f);
    eng.lastIdx = idx;

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(eng.canvas, 0, 0, w, h);
    ctx.restore();
  }

  // Export calls this before the first frame so the audio is decoded
  // (frames are rendered synchronously and cannot wait for it).
  function prepare() {
    var st = window.state;
    if (!st || st.projectType !== 'visualiser') return Promise.resolve(false);
    if (!st.style || st.style.visualiserStyle !== 'butterchurn') return Promise.resolve(false);
    return ensurePcm(st);
  }

  window.kefeButterchurn = {
    version: 1,
    engineVersion: '2.6.7',
    presetPackVersion: '2.4.7',
    simFps: SIM_FPS,
    draw: draw,
    prepare: prepare,
    // The exact byte windows Butterchurn would be fed at time t (for verification).
    audioWindow: function (t) {
      fillAudio(t);
      return { mono: bufM.slice(), left: bufL.slice(), right: bufR.slice() };
    },
    presetNames: function () {
      loadPresetData();
      return names.slice();
    },
    effectivePreset: effectivePreset,
    isLoaded: function () {
      return !!(engineLib() && presetLib());
    },
    error: function () {
      return failMsg;
    }
  };
})();
