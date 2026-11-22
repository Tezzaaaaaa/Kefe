/* KEFE export engine - deterministic, frame-accurate offline video export.

   The old exporter recorded the live preview with MediaRecorder: frames were whatever the page managed to
   paint in real time, audio was captured from the playing element, and any hitch (a busy tab, a slow
   shader, a background video that drifted) became a choppy, desynced or stuck file.

   This engine renders offline instead. Every output frame i is produced for the exact media time i / fps:
   lyrics, background video, visualiser and the audio spectrum the visualiser reacts to are all evaluated
   at that time, encoded with WebCodecs, and muxed with timestamps taken from frame and sample counts.
   Audio is decoded from the uploaded file and encoded sample-exact, so picture and sound cannot drift
   and the render never depends on how fast the machine is.

   The engine owns encoding, muxing and probing. The editor owns compositing and hands it a renderFrame()
   callback, so the preview and the export keep using the same drawing code. */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : globalThis;

  /* ---------------------------------------------------------------- helpers */
  function abortError() {
    return typeof DOMException === 'function' ? new DOMException('Export cancelled', 'AbortError') : Object.assign(new Error('Export cancelled'), { name: 'AbortError' });
  }
  function throwIfAborted(signal) { if (signal && signal.aborted) throw abortError(); }
  function tagged(message, kind, extra) { return Object.assign(new Error(message), { kind: kind }, extra || {}); }
  function even(n) { return Math.max(2, Math.round(n / 2) * 2); }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function hex2(n) { return (n < 16 ? '0' : '') + n.toString(16); }

  function withTimeout(promise, ms, message, kind) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { reject(tagged(message, kind || 'stall')); }, ms);
      promise.then(function (v) { clearTimeout(timer); resolve(v); }, function (e) { clearTimeout(timer); reject(e); });
    });
  }

  /* A macrotask yield that is not throttled in background tabs (timers are; MessageChannel is not). */
  var yieldWaiters = [];
  var yieldChannel = null;
  function yieldNow() {
    return new Promise(function (resolve) {
      if (!yieldChannel) {
        if (typeof MessageChannel !== 'function') { setTimeout(resolve, 0); return; }
        yieldChannel = new MessageChannel();
        yieldChannel.port1.onmessage = function () { var w = yieldWaiters.shift(); if (w) w(); };
      }
      yieldWaiters.push(resolve);
      yieldChannel.port2.postMessage(0);
    });
  }
  /* Lets the browser paint progress and handle the Cancel button without slowing hidden tabs. */
  function breathe() {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return yieldNow();
    return new Promise(function (resolve) { setTimeout(resolve, 0); });
  }

  /* ----------------------------------------------------------- feature check */
  function supported() {
    return typeof VideoEncoder === 'function' && typeof AudioEncoder === 'function' &&
      typeof VideoFrame === 'function' && typeof AudioData === 'function' &&
      !!(root.OfflineAudioContext || root.webkitOfflineAudioContext) &&
      typeof root.Mp4Muxer !== 'undefined' && typeof root.WebMMuxer !== 'undefined';
  }

  /* ------------------------------------------------------------ audio decode */
  /* Decodes the uploaded track to 48 kHz PCM, the rate every audio codec used here accepts. */
  async function decodeAudio(url, opts) {
    var options = opts || {};
    var signal = options.signal;
    var sampleRate = options.sampleRate || 48000;
    var response;
    try { response = await fetch(url, signal ? { signal: signal } : undefined); }
    catch (error) { if (error && error.name === 'AbortError') throw error; throw tagged('The audio file could not be read for export.', 'audio-decode'); }
    if (!response.ok) throw tagged('The audio file could not be read for export.', 'audio-decode');
    var bytes = await response.arrayBuffer();
    throwIfAborted(signal);
    var OAC = root.OfflineAudioContext || root.webkitOfflineAudioContext;
    if (!OAC) throw tagged('This browser cannot decode audio for export.', 'audio-decode');
    var context;
    try { context = new OAC(2, 1, sampleRate); }
    catch (error) { throw tagged('This browser cannot decode audio for export.', 'audio-decode'); }
    var decoded;
    try {
      decoded = await new Promise(function (resolve, reject) {
        var settled = context.decodeAudioData(bytes, resolve, reject);
        if (settled && typeof settled.then === 'function') settled.then(resolve, reject);
      });
    } catch (error) {
      throw tagged('This audio file could not be decoded for export.', 'audio-decode');
    }
    throwIfAborted(signal);
    if (!decoded || !decoded.length || !decoded.duration) throw tagged('The audio file contains no audio to export.', 'audio-decode');
    return decoded;
  }

  /* ------------------------------------------------------- spectrum analysis */
  /* Reproduces what a Web Audio AnalyserNode would report at a given playback time, so audio-reactive
     visualisers see the same data they see in the live preview (Blackman window, 1/N scaling, temporal
     smoothing, -100..-30 dB mapped to bytes), but computed from the decoded file at an exact time. */
  function makeFft(n) {
    var bits = Math.round(Math.log2(n));
    if ((1 << bits) !== n) throw new Error('FFT size must be a power of two.');
    var cos = new Float64Array(n / 2), sin = new Float64Array(n / 2), rev = new Uint32Array(n);
    for (var i = 0; i < n / 2; i++) { cos[i] = Math.cos(2 * Math.PI * i / n); sin[i] = Math.sin(2 * Math.PI * i / n); }
    for (var j = 0; j < n; j++) {
      var r = 0;
      for (var b = 0; b < bits; b++) r |= ((j >> b) & 1) << (bits - 1 - b);
      rev[j] = r;
    }
    return function (re, im) {
      var k, a;
      for (k = 0; k < n; k++) {
        a = rev[k];
        if (a > k) { var tr = re[k]; re[k] = re[a]; re[a] = tr; var ti = im[k]; im[k] = im[a]; im[a] = ti; }
      }
      for (var size = 2; size <= n; size <<= 1) {
        var half = size >> 1, step = n / size;
        for (var start = 0; start < n; start += size) {
          for (var p = start, q = 0; p < start + half; p++, q += step) {
            var l = p + half;
            var tre = re[l] * cos[q] + im[l] * sin[q];
            var tim = -re[l] * sin[q] + im[l] * cos[q];
            re[l] = re[p] - tre; im[l] = im[p] - tim;
            re[p] += tre; im[p] += tim;
          }
        }
      }
    };
  }

  function createSpectrum(channels, sampleRate, opts) {
    var options = opts || {};
    var fftSize = options.fftSize || 2048;
    var binCount = fftSize / 2;
    var smoothing = options.smoothing == null ? 0.78 : options.smoothing;
    var fps = options.fps || 60;
    /* The live analyser is read about 60 times a second; keep the same decay per second at any export fps. */
    var tau = Math.pow(smoothing, 60 / fps);
    var minDb = -100, maxDb = -30;
    var fft = makeFft(fftSize);
    var win = new Float64Array(fftSize);
    var alpha = 0.16, a0 = (1 - alpha) / 2, a1 = 0.5, a2 = alpha / 2;
    for (var n = 0; n < fftSize; n++) win[n] = a0 - a1 * Math.cos(2 * Math.PI * n / fftSize) + a2 * Math.cos(4 * Math.PI * n / fftSize);
    var re = new Float64Array(fftSize), im = new Float64Array(fftSize);
    var smooth = new Float64Array(binCount);
    var bytes = new Uint8Array(binCount);
    var count = channels.length, length = count ? channels[0].length : 0;

    function update(time) {
      var end = Math.floor(Math.max(0, time) * sampleRate), start = end - fftSize;
      for (var i = 0; i < fftSize; i++) {
        var idx = start + i, v = 0;
        if (idx >= 0 && idx < length) {
          for (var c = 0; c < count; c++) v += channels[c][idx];
          v /= count;
        }
        re[i] = v * win[i]; im[i] = 0;
      }
      fft(re, im);
      for (var k = 0; k < binCount; k++) {
        var magnitude = Math.sqrt(re[k] * re[k] + im[k] * im[k]) / fftSize;
        smooth[k] = tau * smooth[k] + (1 - tau) * magnitude;
        var db = smooth[k] > 0 ? 20 * Math.log10(smooth[k]) : -Infinity;
        var value = Math.floor(255 / (maxDb - minDb) * (db - minDb));
        bytes[k] = value < 0 ? 0 : value > 255 ? 255 : value;
      }
    }
    function fill(out) {
      var m = Math.min(out.length, binCount), i;
      for (i = 0; i < m; i++) out[i] = bytes[i];
      for (; i < out.length; i++) out[i] = 0;
    }
    var context = { sampleRate: sampleRate, state: 'running' };
    var analyser = { frequencyBinCount: binCount, fftSize: fftSize, context: context, smoothingTimeConstant: smoothing, minDecibels: minDb, maxDecibels: maxDb, getByteFrequencyData: fill };
    return { sampleRate: sampleRate, fftSize: fftSize, binCount: binCount, update: update, fill: fill, bytes: bytes, analyser: analyser, context: context };
  }

  /* --------------------------------------------------------- codec planning */
  function avcLevel(w, h, fps) {
    var mbs = Math.ceil(w / 16) * Math.ceil(h / 16), rate = mbs * fps;
    var table = [[0x1f, 108000, 3600], [0x28, 245760, 8192], [0x2a, 522240, 8704], [0x32, 589824, 22080], [0x33, 983040, 36864], [0x34, 2073600, 36864], [0x3c, 4177920, 139264]];
    for (var i = 0; i < table.length; i++) if (rate <= table[i][1] && mbs <= table[i][2]) return table[i][0];
    return 0x3c;
  }
  function vp9Level(w, h, fps) {
    var ps = w * h;
    if (ps <= 983040) return fps > 30 ? 40 : 31;
    if (ps <= 2228224) return fps > 30 ? 41 : 40;
    if (ps <= 8912896) return fps > 30 ? 52 : 51;
    return 61;
  }
  function av1Level(w, h, fps) {
    var ps = w * h;
    if (ps <= 2228224) return fps > 30 ? 9 : 8;
    if (ps <= 8912896) return fps > 30 ? 14 : 13;
    return 17;
  }
  function hevcLevel(w, h, fps) {
    var ps = w * h;
    if (ps <= 983040) return 93;
    if (ps <= 2228224) return fps > 30 ? 123 : 120;
    if (ps <= 8912896) return fps > 30 ? 156 : 153;
    return 186;
  }

  function videoCandidates(container, w, h, fps) {
    var list = [];
    var avc = avcLevel(w, h, fps);
    if (container === 'mp4') {
      list.push({ label: 'H.264 High', codec: 'avc1.6400' + hex2(avc), mux: 'avc', extra: { avc: { format: 'avc' } } });
      list.push({ label: 'H.264 Main', codec: 'avc1.4d40' + hex2(avc), mux: 'avc', extra: { avc: { format: 'avc' } } });
      list.push({ label: 'H.264 Baseline', codec: 'avc1.42e0' + hex2(avc), mux: 'avc', extra: { avc: { format: 'avc' } } });
      list.push({ label: 'HEVC', codec: 'hvc1.1.6.L' + hevcLevel(w, h, fps) + '.B0', mux: 'hevc' });
      list.push({ label: 'VP9', codec: 'vp09.00.' + vp9Level(w, h, fps) + '.08', mux: 'vp9' });
      list.push({ label: 'AV1', codec: 'av01.0.' + (av1Level(w, h, fps) < 10 ? '0' : '') + av1Level(w, h, fps) + 'M.08', mux: 'av1' });
    } else {
      list.push({ label: 'VP9', codec: 'vp09.00.' + vp9Level(w, h, fps) + '.08', mux: 'V_VP9' });
      list.push({ label: 'VP8', codec: 'vp8', mux: 'V_VP8' });
      list.push({ label: 'AV1', codec: 'av01.0.' + (av1Level(w, h, fps) < 10 ? '0' : '') + av1Level(w, h, fps) + 'M.08', mux: 'V_AV1' });
    }
    return list;
  }
  function audioCandidates(container, channels, bitrate) {
    var base = { sampleRate: 48000, numberOfChannels: channels, bitrate: bitrate };
    var list = [];
    if (container === 'mp4') {
      list.push({ label: 'AAC', codec: 'mp4a.40.2', mux: 'aac', config: Object.assign({ codec: 'mp4a.40.2', aac: { format: 'aac' } }, base) });
      list.push({ label: 'Opus', codec: 'opus', mux: 'opus', config: Object.assign({ codec: 'opus' }, base) });
    } else {
      list.push({ label: 'Opus', codec: 'opus', mux: 'A_OPUS', config: Object.assign({ codec: 'opus' }, base) });
    }
    return list;
  }

  /* Bitrate that suits the resolution, capped so the finished file fits in memory (the muxer keeps it there).
     When even the lowest sensible bitrate for this resolution cannot fit, tooLarge is set so the caller can step
     down to a smaller resolution instead of producing a file the browser cannot hold. */
  function chooseBitrates(o) {
    var px = o.width * o.height, fps = o.fps;
    var video = clamp(Math.round(px * fps * 0.14), 5e6, 40e6);
    var floor = Math.max(0.8e6, Math.round(px * fps * 0.04));
    var audio = 192000;
    var mobile = !!o.mobile;
    var budget = o.maxBytes || (mobile ? 220e6 : 520e6);
    var note = '', tooLarge = false;
    var allowance = o.duration > 0 ? budget * 8 / o.duration - audio : video;
    if (allowance < video) {
      if (allowance < floor) { tooLarge = true; video = floor; }
      else { video = Math.floor(allowance); note = 'Video bitrate was limited so a long track still fits in memory.'; }
    }
    return { video: video, audio: audio, note: note, tooLarge: tooLarge };
  }

  /* Encodes a couple of real frames before committing, so a config that is "supported" on paper but
     fails at runtime (a hardware encoder that rejects an odd size, say) is skipped instead of failing the export. */
  async function smokeVideo(config) {
    var encoder, frame, canvas;
    try {
      var produced = 0, failure = null;
      encoder = new VideoEncoder({ output: function () { produced++; }, error: function (e) { failure = e; } });
      encoder.configure(config);
      canvas = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(config.width, config.height) : Object.assign(document.createElement('canvas'), { width: config.width, height: config.height });
      var g = canvas.getContext('2d');
      g.fillStyle = '#202830'; g.fillRect(0, 0, config.width, config.height);
      for (var i = 0; i < 2; i++) {
        frame = new VideoFrame(canvas, { timestamp: i * 33333, duration: 33333 });
        encoder.encode(frame, { keyFrame: i === 0 });
        frame.close(); frame = null;
      }
      await withTimeout(encoder.flush(), 8000, 'Encoder test timed out.', 'video-unsupported');
      return !failure && produced > 0;
    } catch (_) {
      return false;
    } finally {
      try { if (frame) frame.close(); } catch (_) {}
      try { if (encoder && encoder.state !== 'closed') encoder.close(); } catch (_) {}
    }
  }
  async function smokeAudio(config) {
    var encoder, data;
    try {
      var produced = 0, failure = null;
      encoder = new AudioEncoder({ output: function () { produced++; }, error: function (e) { failure = e; } });
      encoder.configure(config);
      var frames = 48000 / 2;
      data = new AudioData({ format: 'f32-planar', sampleRate: config.sampleRate, numberOfFrames: frames, numberOfChannels: config.numberOfChannels, timestamp: 0, data: new Float32Array(frames * config.numberOfChannels) });
      encoder.encode(data); data.close(); data = null;
      await withTimeout(encoder.flush(), 8000, 'Audio encoder test timed out.', 'audio-unsupported');
      return !failure && produced > 0;
    } catch (_) {
      return false;
    } finally {
      try { if (data) data.close(); } catch (_) {}
      try { if (encoder && encoder.state !== 'closed') encoder.close(); } catch (_) {}
    }
  }

  async function probe(o) {
    var notes = [];
    var width = even(o.width), height = even(o.height);
    var video = null;
    var fpsLadder = o.fps > 30 ? [o.fps, 30] : [o.fps];
    for (var f = 0; f < fpsLadder.length && !video; f++) {
      var fps = fpsLadder[f];
      var candidates = videoCandidates(o.container, width, height, fps);
      for (var c = 0; c < candidates.length && !video; c++) {
        var cand = candidates[c];
        var accelerations = ['no-preference', 'prefer-software'];
        for (var a = 0; a < accelerations.length && !video; a++) {
          var wanted = Object.assign({ codec: cand.codec, width: width, height: height, bitrate: o.videoBitrate, framerate: fps, latencyMode: 'quality', bitrateMode: 'variable', hardwareAcceleration: accelerations[a] }, cand.extra || {});
          var support = null;
          try { support = await VideoEncoder.isConfigSupported(wanted); } catch (_) { support = null; }
          if (!support || !support.supported) continue;
          var config = Object.assign({}, wanted, support.config || {});
          if (await smokeVideo(config)) video = { label: cand.label, codec: cand.codec, mux: cand.mux, config: config, fps: fps };
        }
      }
      if (video && f > 0) notes.push('Frame rate was lowered to ' + fps + ' fps because this browser cannot encode ' + o.fps + ' fps at this size.');
    }
    if (!video) throw tagged('This browser cannot encode ' + width + '×' + height + ' ' + o.container.toUpperCase() + ' video.', 'video-unsupported');

    var audio = null;
    var audios = audioCandidates(o.container, o.channels, o.audioBitrate);
    for (var u = 0; u < audios.length && !audio; u++) {
      var ac = audios[u], asup = null;
      try { asup = await AudioEncoder.isConfigSupported(ac.config); } catch (_) { asup = null; }
      if (!asup || !asup.supported) continue;
      var aconfig = Object.assign({}, ac.config, asup.config || {});
      if (await smokeAudio(aconfig)) {
        audio = { label: ac.label, codec: ac.codec, mux: ac.mux, config: aconfig };
        if (o.container === 'mp4' && ac.label !== 'AAC') notes.push('This browser cannot encode AAC, so the MP4 uses Opus audio. It plays in VLC, Chrome and Firefox; use WebM or a different browser if your player needs AAC.');
      }
    }
    if (!audio) throw tagged('This browser cannot encode audio for ' + o.container.toUpperCase() + ' export.', 'audio-unsupported');
    return { container: o.container, width: width, height: height, video: video, audio: audio, notes: notes };
  }

  /* -------------------------------------------------------------- video seek */
  var seekStates = typeof WeakMap === 'function' ? new WeakMap() : null;
  function seekState(v) {
    var s = seekStates && seekStates.get(v);
    if (!s) { s = { last: -1, period: 0, rvfc: true, misses: 0 }; if (seekStates) seekStates.set(v, s); }
    return s;
  }
  /* Puts a <video> on the frame for `time` (looping) and resolves when that frame can be drawn.
     Skips the seek when the target still falls inside the frame already on screen. */
  async function seekVideo(v, time) {
    if (!v) return false;
    var duration = v.duration;
    if (!(duration > 0) || !isFinite(duration)) return false;
    var want = time % duration;
    if (!(want >= 0)) want = 0;
    if (want > duration - 0.002) want = Math.max(0, duration - 0.002);
    var st = seekState(v);
    if (st.last >= 0 && st.period > 0 && want >= st.last && want < st.last + st.period * 0.98 && v.readyState >= 2 && !v.seeking) return true;
    if (Math.abs(v.currentTime - want) < 1e-6 && v.readyState >= 2 && !v.seeking) return true;

    var ok = await new Promise(function (resolve) {
      var finished = false;
      var timer = setTimeout(function () { done(false); }, 6000);
      function done(result) {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        v.removeEventListener('seeked', onSeeked);
        v.removeEventListener('error', onError);
        resolve(result);
      }
      function onError() { done(false); }
      function onSeeked() { done(true); }
      v.addEventListener('seeked', onSeeked);
      v.addEventListener('error', onError);
      try { v.currentTime = want; } catch (_) { done(false); }
    });
    if (!ok) return false;

    /* 'seeked' fires before the compositor has necessarily swapped in the new picture, so drawing straight away
       can return the previous frame (observed on roughly a third of sequential seeks). Wait until the browser
       reports the frame it is actually presenting. */
    var meta = null;
    var visible = typeof document !== 'undefined' && document.visibilityState === 'visible';
    if (visible && st.rvfc && typeof v.requestVideoFrameCallback === 'function') {
      meta = await new Promise(function (resolve) {
        var timer = setTimeout(function () { resolve(null); }, 150);
        v.requestVideoFrameCallback(function (_now, m) { clearTimeout(timer); resolve(m); });
      });
      if (meta) st.misses = 0;
      else if (++st.misses >= 8) st.rvfc = false;
    }
    if (!meta) {
      /* No presentation report (callback unsupported, already delivered, or tab in the background): give the
         compositor two frames to take the new picture. */
      if (visible && typeof requestAnimationFrame === 'function') {
        await new Promise(function (resolve) {
          var left = 2, timer = setTimeout(resolve, 120);
          var tick = function () { if (--left <= 0) { clearTimeout(timer); resolve(); } else requestAnimationFrame(tick); };
          requestAnimationFrame(tick);
        });
      } else {
        await yieldNow(); await yieldNow();
      }
    }
    var shown = meta && typeof meta.mediaTime === 'number' ? meta.mediaTime : -1;
    if (shown >= 0) {
      if (st.last >= 0 && shown > st.last + 1e-4 && shown - st.last < 0.25) st.period = st.period > 0 ? Math.min(st.period, shown - st.last) : shown - st.last;
      st.last = shown;
    } else {
      st.last = -1;
    }
    return true;
  }
  function resetSeek(v) { if (seekStates && v) seekStates.delete(v); }

  /* ------------------------------------------------------- output self-check */
  function verifyOutput(blob, expectedSeconds) {
    return new Promise(function (resolve) {
      if (typeof document === 'undefined') { resolve({ ok: true, checked: false }); return; }
      var v = document.createElement('video');
      var url = URL.createObjectURL(blob);
      var finished = false;
      var timer = setTimeout(function () { finish({ ok: true, checked: false }); }, 8000);
      function finish(result) {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        v.removeAttribute('src');
        try { v.load(); } catch (_) {}
        URL.revokeObjectURL(url);
        resolve(result);
      }
      v.muted = true; v.preload = 'metadata';
      v.onloadedmetadata = function () {
        var d = v.duration;
        if (isFinite(d) && Math.abs(d - expectedSeconds) > Math.max(1, expectedSeconds * 0.02)) finish({ ok: false, checked: true, duration: d, reason: 'The exported video is ' + d.toFixed(1) + 's long but the track is ' + expectedSeconds.toFixed(1) + 's.' });
        else finish({ ok: true, checked: true, duration: d });
      };
      v.onerror = function () { finish({ ok: true, checked: false, warning: 'This browser could not preview the exported file.' }); };
      v.src = url;
    });
  }

  /* ------------------------------------------------------- output inspection */
  /* Looks inside the finished file, the way a viewer would, so a silent or frozen export is caught before
     download instead of after. Never throws: anything it cannot measure on this browser is reported 'unknown'.
       opts.sourcePeak     peak level (0..1) of the uploaded track; audio is only flagged when the source has sound
       opts.expectMotion   true when an uploaded background video should be moving in the picture
     Resolves { audio: 'ok'|'silent'|'missing'|'unknown', audioPeak, audioSeconds, motion: 'ok'|'frozen'|'unknown' }. */
  async function inspectOutput(blob, opts) {
    var o = opts || {};
    var out = { audio: 'unknown', audioPeak: null, audioSeconds: null, motion: 'unknown' };
    try {
      if (blob.size < 160 * 1048576) {
        var OAC = root.OfflineAudioContext || root.webkitOfflineAudioContext;
        if (OAC) {
          var ctx = new OAC(1, 2, 44100);
          var bytes = await blob.arrayBuffer();
          var decoded = await withTimeout(new Promise(function (resolve, reject) {
            var settled = ctx.decodeAudioData(bytes, resolve, reject);
            if (settled && typeof settled.then === 'function') settled.then(resolve, reject);
          }), 30000, 'Audio check timed out.', 'stall');
          var peak = 0;
          for (var c = 0; c < decoded.numberOfChannels; c++) {
            var data = decoded.getChannelData(c);
            for (var i = 0; i < data.length; i += 7) { var v = data[i] < 0 ? -data[i] : data[i]; if (v > peak) peak = v; }
          }
          out.audioPeak = peak; out.audioSeconds = decoded.duration;
          out.audio = (o.sourcePeak > 0.002 && peak < 0.0005) ? 'silent' : 'ok';
        }
      }
    } catch (e) { /* decode not possible here; fall through to the container check */ }
    if (out.audio === 'unknown') {
      /* Could not decode the sound, so look for an audio track in the container itself (WebM track codec ids,
         MP4 sample entries). A file with none is exactly a silent export. */
      try {
        var span = 3 * 1048576, size = blob.size;
        var parts = [await blob.slice(0, Math.min(size, span)).arrayBuffer()];
        if (size > span) parts.push(await blob.slice(Math.max(span, size - span)).arrayBuffer());
        var found = false, tokens = ['A_OPUS', 'A_VORBIS', 'A_AAC', 'mp4a', 'Opus'];
        parts.forEach(function (buf) {
          var u8 = new Uint8Array(buf);
          tokens.forEach(function (t) {
            if (found) return;
            var c0 = t.charCodeAt(0), n = t.length;
            for (var i = 0, last = u8.length - n; i <= last; i++) {
              if (u8[i] !== c0) continue;
              var m = 1; while (m < n && u8[i + m] === t.charCodeAt(m)) m++;
              if (m === n) { found = true; return; }
            }
          });
        });
        if (!found && (o.sourcePeak === undefined || o.sourcePeak > 0.002)) out.audio = 'missing';
      } catch (e) { /* leave unknown */ }
    }

    if (o.expectMotion && typeof document !== 'undefined') {
      var v = document.createElement('video'), url = URL.createObjectURL(blob);
      try {
        v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
        await withTimeout(new Promise(function (resolve, reject) { v.onloadedmetadata = resolve; v.onerror = function () { reject(new Error('unreadable')); }; }), 8000, 'Video check timed out.', 'stall');
        /* Recorder files report no duration until the end is reached once. */
        if (!isFinite(v.duration)) {
          v.currentTime = 1e101;
          await withTimeout(new Promise(function (resolve) { v.ontimeupdate = function () { if (isFinite(v.duration)) resolve(); }; }), 5000, 'x', 'stall');
          v.ontimeupdate = null;
        }
        var d = v.duration;
        if (isFinite(d) && d > 1) {
          var cv = document.createElement('canvas'); cv.width = 48; cv.height = 27;
          var g = cv.getContext('2d', { willReadFrequently: true }), frames = [];
          for (var k = 0; k < 6; k++) {
            var at = d * (0.1 + 0.16 * k);
            await withTimeout(new Promise(function (resolve) { v.onseeked = resolve; v.currentTime = at; }), 4000, 'seek', 'stall');
            await new Promise(function (r) { setTimeout(r, 60); });
            g.drawImage(v, 0, 0, 48, 27);
            var px = g.getImageData(0, 0, 48, 27).data, gray = new Float32Array(48 * 27);
            for (var j = 0; j < gray.length; j++) gray[j] = (px[j * 4] + px[j * 4 + 1] + px[j * 4 + 2]) / 3;
            frames.push(gray);
          }
          var biggest = 0;
          for (var a = 0; a < frames.length; a++) for (var b = a + 1; b < frames.length; b++) {
            var sum = 0; for (var q = 0; q < frames[a].length; q++) sum += Math.abs(frames[a][q] - frames[b][q]);
            biggest = Math.max(biggest, sum / frames[a].length);
          }
          out.motion = biggest < 0.6 ? 'frozen' : 'ok';
        }
      } catch (e) { /* leave motion 'unknown' */ }
      finally { v.removeAttribute('src'); try { v.load(); } catch (_) {} URL.revokeObjectURL(url); }
    }
    return out;
  }

  /* -------------------------------------------------------------------- run */
  /* options:
       format        'mp4' | 'webm'
       width,height  output size in pixels
       fps           requested frame rate (may be lowered if the encoder cannot do it)
       audioBuffer   decoded AudioBuffer from decodeAudio()
       start,length  optional clip in seconds (start inside the track, length of the clip). The clip is
                     rendered as its own video: renderFrame still receives the real media time, so lyrics,
                     background video and the spectrum stay locked to the song, while the muxed timeline
                     starts at zero. A clip that stops before the end of the track gets a short audio fade.
       renderFrame   async (time, index, total) => canvas   paints the frame for that exact media time
       onProgress    (fraction 0..1, stage text)
       onPlan        (plan) called once the codecs are chosen, before rendering starts
       signal        AbortSignal
     Resolves { blob, ext, mime, container, video, audio, fps, frames, duration, notes }. */
  async function run(o) {
    var signal = o.signal;
    var onProgress = o.onProgress || function () {};
    var buffer = o.audioBuffer;
    var sampleRate = buffer.sampleRate;
    var channels = Math.min(2, buffer.numberOfChannels);
    var trackDuration = buffer.length / sampleRate;
    var clipStart = Math.max(0, Math.min(Number(o.start) || 0, Math.max(0, trackDuration - 0.5)));
    var clipLength = Number(o.length) > 0 ? Math.min(Number(o.length), trackDuration - clipStart) : trackDuration - clipStart;
    var isClip = clipStart > 0.001 || clipLength < trackDuration - 0.001;
    var startSample = Math.floor(clipStart * sampleRate);
    var endSample = Math.min(buffer.length, startSample + Math.round(clipLength * sampleRate));
    var duration = (endSample - startSample) / sampleRate;
    var fadeIn = isClip && clipStart > 0.001 ? Math.round(sampleRate * 0.04) : 0;
    var fadeOut = isClip && clipStart + clipLength < trackDuration - 0.001 ? Math.round(sampleRate * 0.6) : 0;
    var container = o.format === 'mp4' ? 'mp4' : 'webm';
    var width = even(o.width), height = even(o.height);
    var mobile = typeof navigator !== 'undefined' && (/iPad|iPhone|iPod|Android/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
    var rates = chooseBitrates({ width: width, height: height, fps: o.fps, duration: duration, mobile: mobile });

    throwIfAborted(signal);
    if (rates.tooLarge) throw tagged('This track is too long to export at ' + width + '\u00d7' + height + ' in browser memory.', 'memory');
    onProgress(0, 'Checking encoder support');
    var plan = await probe({ container: container, width: width, height: height, fps: o.fps, videoBitrate: rates.video, audioBitrate: rates.audio, channels: channels });
    throwIfAborted(signal);
    var fps = plan.video.fps;
    var total = Math.max(1, Math.round(duration * fps));
    var notes = plan.notes.slice();
    if (rates.note) notes.push(rates.note);
    if (o.onPlan) o.onPlan({ fps: fps, video: plan.video.label, audio: plan.audio.label, container: container, frames: total, duration: duration });

    var isMp4 = container === 'mp4';
    var target = new (isMp4 ? root.Mp4Muxer : root.WebMMuxer).ArrayBufferTarget();
    var muxer = isMp4
      ? new root.Mp4Muxer.Muxer({ target: target, video: { codec: plan.video.mux, width: width, height: height, frameRate: fps }, audio: { codec: plan.audio.mux, numberOfChannels: channels, sampleRate: sampleRate }, fastStart: 'in-memory', firstTimestampBehavior: 'cross-track-offset' })
      : new root.WebMMuxer.Muxer({ target: target, video: { codec: plan.video.mux, width: width, height: height, frameRate: fps }, audio: { codec: plan.audio.mux, numberOfChannels: channels, sampleRate: sampleRate }, firstTimestampBehavior: 'permissive' });

    var fatal = null;
    var videoEncoder = null, audioEncoder = null;
    try {
      videoEncoder = new VideoEncoder({
        output: function (chunk, meta) { try { muxer.addVideoChunk(chunk, meta); } catch (e) { fatal = fatal || e; } },
        error: function (e) { fatal = fatal || e; }
      });
      audioEncoder = new AudioEncoder({
        output: function (chunk, meta) { try { muxer.addAudioChunk(chunk, meta); } catch (e) { fatal = fatal || e; } },
        error: function (e) { fatal = fatal || e; }
      });
      videoEncoder.configure(plan.video.config);
      audioEncoder.configure(plan.audio.config);

      var audioPos = startSample;
      var audioChunk = Math.round(sampleRate * 0.5);
      var channelData = [];
      for (var c = 0; c < channels; c++) channelData.push(buffer.getChannelData(c));
      var feedAudio = function (untilSeconds) {
        var limit = Math.min(endSample, startSample + Math.ceil(untilSeconds * sampleRate));
        while (audioPos < limit) {
          var frames = Math.min(audioChunk, endSample - audioPos);
          var data = new Float32Array(frames * channels);
          for (var ch = 0; ch < channels; ch++) data.set(channelData[ch].subarray(audioPos, audioPos + frames), ch * frames);
          if (fadeIn || fadeOut) {
            var rel0 = audioPos - startSample, relEnd = endSample - startSample;
            for (var k = 0; k < frames; k++) {
              var rel = rel0 + k, g = 1;
              if (fadeIn && rel < fadeIn) g = rel / fadeIn;
              if (fadeOut && rel > relEnd - fadeOut) g = Math.min(g, Math.max(0, (relEnd - rel) / fadeOut));
              if (g < 1) for (var cc = 0; cc < channels; cc++) data[cc * frames + k] *= g;
            }
          }
          var chunk = new AudioData({ format: 'f32-planar', sampleRate: sampleRate, numberOfFrames: frames, numberOfChannels: channels, timestamp: Math.round((audioPos - startSample) / sampleRate * 1e6), data: data });
          audioEncoder.encode(chunk);
          chunk.close();
          audioPos += frames;
        }
      };

      var maxQueue = width * height > 4000000 ? 5 : 10;
      var relieve = async function () {
        var lastQueue = videoEncoder.encodeQueueSize, lastMove = Date.now();
        for (;;) {
          if (fatal) throw fatal;
          throwIfAborted(signal);
          var q = videoEncoder.encodeQueueSize;
          if (q <= maxQueue && audioEncoder.encodeQueueSize <= 60) return;
          if (q < lastQueue) { lastQueue = q; lastMove = Date.now(); }
          if (Date.now() - lastMove > 45000) throw tagged('The video encoder stopped responding.', 'stall');
          await new Promise(function (resolve) {
            var timer = setTimeout(resolve, 4);
            try { videoEncoder.addEventListener('dequeue', function () { clearTimeout(timer); resolve(); }, { once: true }); } catch (_) {}
          });
        }
      };

      var keyEvery = Math.max(1, Math.round(fps * 2));
      var frameMicros = 1e6 / fps;
      var lastBreath = Date.now();
      var lastReport = 0;
      for (var i = 0; i < total; i++) {
        if (fatal) throw fatal;
        throwIfAborted(signal);
        var time = i / fps;
        var canvas = await withTimeout(Promise.resolve(o.renderFrame(clipStart + time, i, total)), 30000, 'A frame took too long to render.', 'stall');
        throwIfAborted(signal);
        if (!canvas || !canvas.width) throw tagged('The frame renderer produced no picture.', 'render');
        var frame = new VideoFrame(canvas, { timestamp: Math.round(i * frameMicros), duration: Math.round(frameMicros) });
        try { videoEncoder.encode(frame, { keyFrame: i % keyEvery === 0 }); } finally { frame.close(); }
        feedAudio(Math.min(duration, time + 1));
        await relieve();
        var now = Date.now();
        if (now - lastReport > 200 || i === total - 1) {
          lastReport = now;
          onProgress(0.01 + 0.93 * ((i + 1) / total), 'Rendering video');
        }
        if (now - lastBreath > 120) { lastBreath = now; await breathe(); }
      }

      feedAudio(duration + 1);
      onProgress(0.95, 'Finalising video');
      await withTimeout(videoEncoder.flush(), 180000, 'The video encoder did not finish.', 'stall');
      await withTimeout(audioEncoder.flush(), 90000, 'The audio encoder did not finish.', 'stall');
      if (fatal) throw fatal;
      throwIfAborted(signal);
      muxer.finalize();
      var mime = isMp4 ? 'video/mp4' : 'video/webm';
      var blob = new Blob([target.buffer], { type: mime });
      if (!blob.size || blob.size < 1024) throw tagged('The encoder produced an empty file.', 'render');
      onProgress(0.98, 'Checking the finished file');
      var check = await verifyOutput(blob, duration);
      if (!check.ok) throw tagged(check.reason || 'The exported file failed its self-check.', 'verify');
      if (check.warning) notes.push(check.warning);
      return { blob: blob, ext: isMp4 ? 'mp4' : 'webm', mime: mime, container: container, video: plan.video.label, audio: plan.audio.label, fps: fps, frames: total, duration: duration, start: clipStart, width: width, height: height, notes: notes };
    } finally {
      try { if (videoEncoder && videoEncoder.state !== 'closed') videoEncoder.close(); } catch (_) {}
      try { if (audioEncoder && audioEncoder.state !== 'closed') audioEncoder.close(); } catch (_) {}
    }
  }

  root.kefeExportEngine = {
    supported: supported,
    decodeAudio: decodeAudio,
    inspectOutput: inspectOutput,
    createSpectrum: createSpectrum,
    seekVideo: seekVideo,
    resetSeek: resetSeek,
    run: run,
    probe: probe,
    chooseBitrates: chooseBitrates,
    yieldNow: yieldNow,
    _internals: { makeFft: makeFft, avcLevel: avcLevel, vp9Level: vp9Level, av1Level: av1Level, hevcLevel: hevcLevel, videoCandidates: videoCandidates, audioCandidates: audioCandidates, even: even }
  };
})();
