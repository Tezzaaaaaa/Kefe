/* KEFE — Song Start Detection. Finds where the actual song begins. */
(function(){
  'use strict';

  function decodeToMono16k(file) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return Promise.reject(new Error("WebAudio not supported"));

    function toMono16k(decoded) {
      const rate = 16000;
      const src = decoded.getChannelData(0);
      const ratio = Math.max(1, Math.floor(decoded.sampleRate / rate));
      const len = Math.floor(src.length / ratio);
      const out = new Float32Array(len);
      for (let i = 0; i < len; i++) {
        let sum = 0;
        for (let j = 0; j < ratio; j++) sum += src[i * ratio + j] || 0;
        out[i] = sum / ratio;
      }
      return { data: out, sampleRate: rate, duration: decoded.duration };
    }

    function decodeBytes(buf) {
      const ctx = new AudioCtx();
      return ctx.decodeAudioData(buf.slice(0)).then(toMono16k).finally(function(){ try { ctx.close(); } catch(e) {} });
    }

    const isVideo = file && (String(file.type || "").startsWith("video/") || /\.(mp4|mov|webm|m4v|mkv)$/i.test(file.name || ""));
    if (!isVideo) return file.arrayBuffer().then(decodeBytes);

    // Video: use FFmpeg to extract audio as WAV, then decode the WAV.
    // FFmpeg.wasm is already loaded for export and works on any container.
    return import("../export/encoder.js").then(function(mod){
      return mod.loadEncoder().then(function(ffmpeg){
        const name = "kefe-songstart-in." + (file.name.split(".").pop() || "mp4");
        const out = "kefe-songstart-out.wav";
        return file.arrayBuffer().then(function(buf){
          return ffmpeg.writeFile(name, new Uint8Array(buf)).then(function(){
            return ffmpeg.exec(["-i", name, "-vn", "-ac", "1", "-ar", "16000", "-f", "wav", "-y", out]);
          }).then(function(){
            return ffmpeg.readFile(out);
          }).then(function(data){
            const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
            try { ffmpeg.deleteFile(name); } catch(e){}
            try { ffmpeg.deleteFile(out); } catch(e){}
            return bytes.buffer;
          });
        });
      });
    }).then(function(wavBuf){
      return decodeBytes(wavBuf);
    });
  }

  function rmsPerWindow(data, sampleRate, windowMs) {
    const win = Math.max(1, Math.round(sampleRate * windowMs / 1000));
    const out = [];
    for (let i = 0; i + win <= data.length; i += win) {
      let sum = 0;
      for (let j = i; j < i + win; j++) sum += data[j] * data[j];
      out.push(Math.sqrt(sum / win));
    }
    return out;
  }

  function dbfs(v) { return 20 * Math.log10(Math.max(1e-6, v)); }

  function findSongStart(audio) {
    const windowMs = 500;
    const rms = rmsPerWindow(audio.data, audio.sampleRate, windowMs);
    if (rms.length < 4) return null;
    const db = rms.map(dbfs);
    const baselineSamples = db.slice(0, Math.min(10, db.length)).sort(function(a,b){return a-b;});
    const baseline = baselineSamples[Math.floor(baselineSamples.length / 2)] || -60;
    const threshold = Math.max(baseline + 8, -35);
    const requiredRun = 4;
    for (let i = 0; i < db.length - requiredRun; i++) {
      let allLoud = true;
      for (let j = 0; j < requiredRun; j++) {
        if (db[i + j] < threshold) { allLoud = false; break; }
      }
      if (allLoud) {
        const t = (i * windowMs) / 1000;
        const confidence = Math.min(1, (db[i] - baseline) / 20);
        return { time: t, confidence: confidence, reasoning: 'Sustained ' + Math.round(db[i] - baseline) + 'dB jump above baseline at ' + t.toFixed(2) + 's' };
      }
    }
    if (db[0] > threshold - 4) {
      return { time: 0, confidence: 0.4, reasoning: 'Track starts immediately' };
    }
    return null;
  }

  window.kefeSongStart = {
    version: 1,
    detect: function(file) {
      if (!file) return Promise.reject(new Error('File required'));
      return decodeToMono16k(file).then(function(audio){
        const result = findSongStart(audio);
        if (result) result.duration = audio.duration;
        return result;
      });
    },
    _rmsPerWindow: rmsPerWindow,
    _dbfs: dbfs,
    _findSongStart: findSongStart
  };

  console.log('[KEFE] song-start detector loaded');
})();
