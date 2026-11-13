(function (root) {
  'use strict';
  var CDN = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';
  var AUTO_SYNC_SCRIPT_URL = typeof document !== 'undefined' && document.currentScript ? document.currentScript.src : '';
  var cached = null;
  var forcedAlignerPromise = null;
  var forcedAligner = null;
  var ORT_URL = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/dist/ort.min.js';
  var ORT_WASM = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/dist/';
  var CHARSU_CORE = 'https://cdn.jsdelivr.net/npm/charsiu-js@0.2.0/dist/index.js';
  var CHARSU_ASSETS = 'https://cdn.jsdelivr.net/npm/charsiu-js@0.2.0/dist/assets-web.js';
  var CHARSU_ASSET_BASE = 'https://cdn.jsdelivr.net/npm/charsiu-js@0.2.0/assets/';
  var EN_ALIGN_MODEL = 'https://huggingface.co/mnaoizyyy/charsiu-js-models/resolve/main/en_w2v2_fc_10ms/model_quantized.onnx';
  function norm(s) { return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}']/gu, ''); }
  var similarityCache = new Map();
  function similarity(a, b) {
    a = norm(a); b = norm(b);
    if (!a || !b) return 0;
    var left = a < b ? a : b, right = a < b ? b : a;
    var key = left + '\u0000' + right;
    if (similarityCache.has(key)) return similarityCache.get(key);
    var prev = new Uint16Array(b.length + 1), cur;
    for (var i = 1; i <= a.length; i++) {
      cur = new Uint16Array(b.length + 1);
      for (var j = 1; j <= b.length; j++) cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
      prev = cur;
    }
    var score = 2 * prev[b.length] / (a.length + b.length);
    if (similarityCache.size > 50000) similarityCache.clear();
    similarityCache.set(key, score);
    return score;
  }
  function parseLyrics(text) {
    return String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/)
      .map(function (line) { return line.replace(/^\s*\[[^\]]+\]\s*/, '').replace(/<\d{1,3}:\d{1,2}(?:[.:]\d+)?\>/g, '').trim(); })
      .filter(function (line) { return line && !/^\[[a-z]{2}:/i.test(line); });
  }
  function stamp(seconds) {
    var cs = Math.round(Math.max(0, seconds) * 100);
    return String(Math.floor(cs / 6000)).padStart(2, '0') + ':' + ((cs % 6000) / 100).toFixed(2).padStart(5, '0');
  }
  function lyricStructure(text) {
    var raw = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/);
    var lines = [], sections = [], active = null;
    raw.forEach(function (rawLine) {
      var header = rawLine.match(/^\s*\[\s*(intro|verse|pre[- ]?chorus|chorus|post[- ]?chorus|bridge|refrain|outro|hook|interlude)(?:\s+([^\]]*))?\s*\]\s*$/i);
      if (header) {
        active = { name: header[1].toLowerCase().replace(/\s+/g, '-'), label: (header[1] + (header[2] ? ' ' + header[2] : '')).trim(), start: lines.length, end: lines.length };
        sections.push(active);
        return;
      }
      var cleaned = rawLine.replace(/^\s*\[[^\]]+\]\s*/, '').replace(/<\d{1,3}:\d{1,2}(?:[.:]\d+)?\>/g, '').trim();
      if (!cleaned || /^\[[a-z]{2}:/i.test(cleaned)) return;
      var lineIndex = lines.length;
      lines.push(cleaned);
      if (active) active.end = lineIndex + 1;
    });
    return { lines: lines, sections: sections };
  }
  function median(values) {
    var sorted = values.filter(Number.isFinite).slice().sort(function (a, b) { return a - b; });
    if (!sorted.length) return 0;
    var middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }
  function asrWordText(item) { return String(Array.isArray(item) ? item[0] : item && (item.word || item.text) || '').trim(); }
  function asrWordStart(item) { return Number(Array.isArray(item) ? item[1] : item && (item.start != null ? item.start : item.timestamp)); }
  function asrWordEnd(item) { return Number(Array.isArray(item) ? item[2] : item && (item.end != null ? item.end : item.timestamp)); }
  function lyricTokens(lines) {
    var tokens = [];
    lines.forEach(function (line, li) {
      line.split(/\s+/).forEach(function (word) { tokens.push({ word: word, line: li }); });
    });
    return tokens;
  }
  /* Monotonic sequence alignment: tolerate ASR insertions, skipped lyric words and
     repeated phrases without the old fixed 12-token look-ahead window. */
  function matchTokens(tokens, asr, from, to) {
    var timings = new Array(tokens.length), indexes = new Array(tokens.length), scores = new Array(tokens.length);
    var begin = Math.max(0, Number(from) || 0);
    var limit = to == null ? asr.length : Math.min(asr.length, to);
    var words = asr.slice(begin, limit), n = tokens.length, m = words.length;
    if (!n || !m) return { timings: timings, indexes: indexes, scores: scores };
    var lyricNorm = tokens.map(function (t) { return norm(t.word); });
    var asrNorm = words.map(function (w) { return norm(asrWordText(w)); });
    var width = m + 1, trace = new Uint8Array((n + 1) * width);
    var previous = new Float64Array(width), current = new Float64Array(width);
    /* Free leading/trailing ASR words: recordings may contain intros and outros. */
    for (var j = 0; j <= m; j++) previous[j] = 0;
    for (var i = 1; i <= n; i++) {
      current[0] = -i * 1.05;
      trace[i * width] = 3;
      for (var j = 1; j <= m; j++) {
        var sim = similarity(lyricNorm[i - 1], asrNorm[j - 1]);
        var match = previous[j - 1] + (sim >= 0.45 ? 2 * sim - 0.65 : -1.25);
        var skipAsr = current[j - 1] - 0.22;
        var skipLyric = previous[j] - 1.05;
        if (match >= skipAsr && match >= skipLyric) {
          current[j] = match; trace[i * width + j] = 1;
        } else if (skipAsr >= skipLyric) {
          current[j] = skipAsr; trace[i * width + j] = 2;
        } else {
          current[j] = skipLyric; trace[i * width + j] = 3;
        }
      }
      var swap = previous; previous = current; current = swap;
    }
    var bestEnd = 0, bestScore = -Infinity;
    for (var k = 0; k <= m; k++) if (previous[k] > bestScore) { bestScore = previous[k]; bestEnd = k; }
    var x = n, y = bestEnd;
    while (x > 0 && y >= 0) {
      var step = trace[x * width + y];
      if (step === 1) {
        var score = similarity(lyricNorm[x - 1], asrNorm[y - 1]);
        if (score >= 0.58) {
          timings[x - 1] = asrWordStart(words[y - 1]);
          indexes[x - 1] = begin + y - 1;
          scores[x - 1] = score;
        }
        x--; y--;
      } else if (step === 2) y--;
      else x--;
      if (y === 0 && x > 0 && trace[x * width] === 3) break;
    }
    return { timings: timings, indexes: indexes, scores: scores };
  }
  function autoWindows(asr, lyricsText, minGap) {
    if (!Array.isArray(asr) || asr.length < 2) return null;
    var structure = lyricStructure(lyricsText), lines = structure.lines;
    if (!lines.length) return null;
    var tokens = lyricTokens(lines), matched = matchTokens(tokens, asr, 0, asr.length);
    var gaps = [];
    var threshold = Number.isFinite(minGap) && minGap > 0 ? minGap : 12;
    for (var i = 1; i < asr.length; i++) {
      var previousEnd = Number(Array.isArray(asr[i - 1]) ? asr[i - 1][2] : asr[i - 1] && asr[i - 1].end);
      var nextStart = asrWordStart(asr[i]);
      if (!Number.isFinite(previousEnd)) previousEnd = asrWordStart(asr[i - 1]);
      if (Number.isFinite(previousEnd) && Number.isFinite(nextStart) && nextStart - previousEnd >= threshold) {
        var boundary = -1, bestDistance = Infinity;
        for (var li = 1; li < lines.length; li++) {
          var leftToken = -1, rightToken = -1;
          for (var ti = 0; ti < tokens.length; ti++) {
            if (tokens[ti].line < li && matched.indexes[ti] != null) leftToken = Math.max(leftToken, ti);
            if (tokens[ti].line >= li && matched.indexes[ti] != null && rightToken < 0) rightToken = ti;
          }
          if (leftToken < 0 || rightToken < 0) continue;
          var leftAsr = matched.indexes[leftToken], rightAsr = matched.indexes[rightToken];
          if (leftAsr < i && rightAsr >= i) {
            var distance = Math.abs((matched.timings[leftToken] + matched.timings[rightToken]) / 2 - (previousEnd + nextStart) / 2);
            var sectionStart = structure.sections.some(function (section) { return section.start === li; });
            distance -= sectionStart ? threshold * 0.05 : 0;
            if (distance < bestDistance) { bestDistance = distance; boundary = li; }
          }
        }
        if (boundary > 0 && boundary < lines.length && (!gaps.length || boundary > gaps[gaps.length - 1].line)) {
          gaps.push({ asr: i, time: (previousEnd + nextStart) / 2, line: boundary });
        }
      }
    }
    if (!gaps.length) return null;
    var windows = [], asrStart = 0, lineStart = 0;
    gaps.forEach(function (gap) {
      windows.push([asrWordStart(asr[asrStart]), asrWordStart(asr[gap.asr - 1]) + 0.01, lineStart, gap.line]);
      asrStart = gap.asr;
      lineStart = gap.line;
    });
    windows.push([asrWordStart(asr[asrStart]), Number(Array.isArray(asr[asr.length - 1]) ? asr[asr.length - 1][2] : asr[asr.length - 1].end) || asrWordStart(asr[asr.length - 1]) + 0.01, lineStart, lines.length]);
    return windows;
  }
  function align(asr, text, meta) {
    var opts = meta || {};
    var structure = lyricStructure(text), lines = structure.lines, tokens = lyricTokens(lines);
    if (!tokens.length || !Array.isArray(asr) || !asr.length) throw new Error('Add lyrics and load a song with vocals first.');
    var windows = Array.isArray(opts.windows) && opts.windows.length ? opts.windows : [[asrWordStart(asr[0]), Number(Array.isArray(asr[asr.length - 1]) ? asr[asr.length - 1][2] : asr[asr.length - 1].end) || asrWordStart(asr[asr.length - 1]) + 0.01, 0, lines.length]];
    var timings = new Array(tokens.length), tokenAsrIndexes = new Array(tokens.length), matchScores = new Array(tokens.length);
    windows.forEach(function (window) {
      var t0 = Number(window[0]), t1 = Number(window[1]), l0 = Math.max(0, Number(window[2]) || 0), l1 = Math.min(lines.length, Number(window[3]));
      if (!Number.isFinite(l1) || l1 <= l0) return;
      var tokenIndexes = [];
      tokens.forEach(function (token, ti) { if (token.line >= l0 && token.line < l1) tokenIndexes.push(ti); });
      var asrIndexes = [];
      asr.forEach(function (word, ai) {
        var start = asrWordStart(word);
        if (Number.isFinite(start) && start >= t0 - 0.5 && start <= t1 + 0.5) asrIndexes.push(ai);
      });
      if (!tokenIndexes.length || !asrIndexes.length) return;
      var localTokens = tokenIndexes.map(function (ti) { return tokens[ti]; });
      var localAsr = asrIndexes.map(function (ai) { return asr[ai]; });
      var matched = matchTokens(localTokens, localAsr, 0, localAsr.length);
      tokenIndexes.forEach(function (ti, localIndex) {
        if (Number.isFinite(matched.timings[localIndex])) {
          timings[ti] = matched.timings[localIndex];
          tokenAsrIndexes[ti] = asrIndexes[matched.indexes[localIndex]];
          matchScores[ti] = matched.scores[localIndex];
        }
      });
    });
    if (Array.isArray(opts.wordTimings)) timings = opts.wordTimings.slice(0, tokens.length);
    var starts = lines.map(function (_, lineIndex) {
      for (var ti = 0; ti < tokens.length; ti++) if (tokens[ti].line === lineIndex && Number.isFinite(timings[ti])) return timings[ti];
      return null;
    });
    var known = starts.map(function (time, index) { return Number.isFinite(time) ? index : -1; }).filter(function (index) { return index >= 0; });
    if (!known.length) throw new Error('No lyric words matched the recognised vocal; try the larger speech model.');
    for (var li = 0; li < lines.length; li++) {
      if (Number.isFinite(starts[li])) continue;
      var left = known.filter(function (index) { return index < li; }).pop();
      var right = known.filter(function (index) { return index > li; })[0];
      if (left != null && right != null) starts[li] = starts[left] + (starts[right] - starts[left]) * (li - left) / (right - left);
      else if (left != null) starts[li] = starts[left] + Math.max(1.1, lines[left].length / 18);
      else starts[li] = Math.max(0, starts[right] - (right - li) * 1.8);
    }
    // Regularise repeated named sections using a median relative-timing template.
    var report = [];
    var groups = Object.create(null);
    structure.sections.forEach(function (section) {
      var baseName = section.name.replace(/\s*\d+\s*$/, '');
      var key = baseName + ':' + (section.end - section.start);
      if (section.end > section.start) (groups[key] || (groups[key] = [])).push(section);
    });
    Object.keys(groups).forEach(function (key) {
      var instances = groups[key];
      if (instances.length < 2) return;
      var templates = [];
      instances.forEach(function (section) {
        var relative = [];
        for (var li = section.start; li < section.end; li++) {
          var time = starts[li];
          var first = starts[section.start], last = starts[section.end - 1];
          relative.push(Number.isFinite(time) && Number.isFinite(first) && Number.isFinite(last) && last > first ? (time - first) / (last - first) : (li - section.start) / Math.max(1, section.end - section.start - 1));
        }
        templates.push(relative);
      });
      var template = templates[0].map(function (_, index) { return median(templates.map(function (row) { return row[index]; })); });
      instances.forEach(function (section, instanceIndex) {
        var first = starts[section.start], last = starts[section.end - 1], duration = last - first;
        if (!Number.isFinite(first) || !Number.isFinite(last) || duration <= 0) return;
        var rawSlopes = [];
        for (var a = 0; a < template.length; a++) for (var b = a + 1; b < template.length; b++) {
          var delta = template[b] - template[a];
          if (Math.abs(delta) > 0.0001) rawSlopes.push((starts[section.start + b] - starts[section.start + a]) / delta);
        }
        var slope = median(rawSlopes);
        var repeatedCount = instances.length;
        var minSlope = instanceIndex === repeatedCount - 1 && repeatedCount > 2 ? 0.9 : 0.97;
        var maxSlope = instanceIndex === repeatedCount - 1 && repeatedCount > 2 ? 1.3 : 1.03;
        if (!Number.isFinite(slope) || slope <= 0) slope = duration;
        var normalisedSlope = Math.max(minSlope, Math.min(maxSlope, slope / duration));
        var corrected = starts.slice(section.start, section.end).map(function (_, index) { return first + template[index] * duration * normalisedSlope; });
        corrected[0] = first;
        corrected[corrected.length - 1] = last;
        corrected.forEach(function (time, index) { starts[section.start + index] = time; });
        report.push(section.label + ': timing template applied (slope ' + normalisedSlope.toFixed(3) + ').');
      });
    });
    var out = [], measuredWordCount = 0, emittedMatchScores = [];
    if (opts.title) out.push('[ti:' + opts.title + ']');
    if (opts.artist) out.push('[ar:' + opts.artist + ']');
    if (opts.album) out.push('[al:' + opts.album + ']');
    lines.forEach(function (line, li) {
      var words = line.split(/\s+/), indexes = [];
      tokens.forEach(function (token, index) { if (token.line === li) indexes.push(index); });
      var start = starts[li], next = starts[li + 1];
      var end = Number.isFinite(next) && next > start ? Math.min(next - 0.05, start + Math.max(0.5, line.length / 15)) : start + Math.max(0.8, line.length / 15);
      var lastMeasured = indexes.length ? timings[indexes[indexes.length - 1]] : NaN;
      if (Number.isFinite(lastMeasured) && lastMeasured > start) end = Math.max(end, lastMeasured + 0.3);
      var weights = words.map(function (word) { return Math.max(1, word.length); });
      var total = weights.reduce(function (sum, value) { return sum + value; }, 0), elapsed = 0;
      var tagged = words.map(function (word, wi) {
        var estimate = start + (end - start) * elapsed / total;
        elapsed += weights[wi];
        var measured = timings[indexes[wi]];
        var hasMeasuredTime = Number.isFinite(measured) && measured >= start - 0.3 && measured < end + 0.2;
        if (hasMeasuredTime) {
          measuredWordCount++;
          if (Number.isFinite(matchScores[indexes[wi]])) emittedMatchScores.push(matchScores[indexes[wi]]);
        }
        var time = hasMeasuredTime ? measured : estimate;
        return '<' + stamp(time) + '>' + word;
      }).join(' ');
      out.push('[' + stamp(start) + '] ' + tagged);
    });
    return { lrc: out.join('\n') + '\n', matched: measuredWordCount, recognized: timings.filter(Number.isFinite).length, matchScores: emittedMatchScores, words: tokens.length, lines: lines.length, report: report, windows: windows, lineStarts: starts.slice(), measuredLineIndexes: known.slice() };
  }
  function validateReport(result) {
    var words = Math.max(0, Number(result && result.words) || 0);
    var measured = Math.max(0, Math.min(words, Number(result && result.matched) || 0));
    var lines = Math.max(0, Number(result && result.lines) || 0);
    var matchedLineAnchors = Array.isArray(result && result.measuredLineIndexes) ? result.measuredLineIndexes.length : 0;
    var coverage = words ? measured / words : 0;
    var warnings = [];
    if (!words) warnings.push('No lyric words were available to assess.');
    else if (coverage < 0.4) warnings.push('Low measured-word coverage: most word timings are estimates.');
    else if (coverage < 0.7) warnings.push('Partial measured-word coverage: review the estimated words carefully.');
    if (lines && matchedLineAnchors < lines) { var estimatedLines = lines - matchedLineAnchors; warnings.push(estimatedLines + (estimatedLines === 1 ? ' lyric line has' : ' lyric lines have') + ' an estimated start anchor.'); }
    var scores = Array.isArray(result && result.matchScores) ? result.matchScores.filter(Number.isFinite) : [];
    var lowMatchWords = scores.filter(function (score) { return score < 0.72; }).length;
    if (lowMatchWords) warnings.push(lowMatchWords + (lowMatchWords === 1 ? ' measured word has' : ' measured words have') + ' weak lyric-text matches and should be checked against the audio.');
    var starts = Array.isArray(result && result.lineStarts) ? result.lineStarts : [];
    for (var i = 1; i < starts.length; i++) {
      if (Number.isFinite(starts[i - 1]) && Number.isFinite(starts[i]) && starts[i] - starts[i - 1] < 0.02) {
        warnings.push('Some adjacent lyric lines have nearly identical start times.');
        break;
      }
    }
    return {
      measuredWords: measured,
      estimatedWords: Math.max(0, words - measured),
      totalWords: words,
      matchedLineAnchors: matchedLineAnchors,
      totalLines: lines,
      coverage: coverage,
      lowMatchWords: lowMatchWords,
      warnings: warnings
    };
  }
  async function decodeAudio(signal) {
    var audio = document.getElementById('kefeAudio'), src = audio && (audio.currentSrc || audio.src);
    if (!src) throw new Error('Load the song in Media first.');
    if (signal && signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    var response;
    try {
      response = await fetch(src, signal ? { signal: signal } : undefined);
    } catch (err) {
      if (err && err.name === 'AbortError') throw err;
      throw new Error('Could not fetch audio for speech recognition (network or CORS error).');
    }
    if (!response.ok) throw new Error('Could not read the loaded audio (HTTP ' + response.status + ').');
    var buffer = await response.arrayBuffer();
    if (signal && signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    var Ctx = root.AudioContext || root.webkitAudioContext;
    if (!Ctx) throw new Error('Web Audio API is unavailable in this browser.');
    var ctx;
    try { ctx = new Ctx({ sampleRate: 16000 }); } catch (e) { ctx = new Ctx(); }
    try {
      var decoded;
      try {
        decoded = await ctx.decodeAudioData(buffer);
      } catch (decodeErr) {
        throw new Error('Could not decode audio for speech recognition. Try MP3, WAV or M4A.');
      }
      if (decoded.sampleRate !== 16000) {
        var Offline = root.OfflineAudioContext || root.webkitOfflineAudioContext;
        if (!Offline) throw new Error('This browser cannot resample audio to 16 kHz for speech recognition.');
        var offline = new Offline(1, Math.ceil(decoded.duration * 16000), 16000);
        var source = offline.createBufferSource(); source.buffer = decoded; source.connect(offline.destination); source.start(0);
        var resampled = await offline.startRendering();
        return { audio: resampled.getChannelData(0).slice() };
      }
      var mono = new Float32Array(decoded.length);
      for (var c = 0; c < decoded.numberOfChannels; c++) {
        var channel = decoded.getChannelData(c);
        for (var i = 0; i < mono.length; i++) mono[i] += channel[i] / decoded.numberOfChannels;
      }
      return { audio: mono };
    } finally {
      if (ctx && typeof ctx.close === 'function') { try { await ctx.close(); } catch (_) {} }
    }
  }
  async function transcribeAudio(audio, model, status) {
    status('Loading speech model; first use downloads it for browser caching…');
    var tf = await import(CDN);
    tf.env.allowLocalModels = false;
    var pipe = await tf.pipeline('automatic-speech-recognition', 'Xenova/whisper-' + model, {
      progress_callback: function (p) { if (p && p.status === 'progress') status('Downloading speech model… ' + Math.round(p.progress || 0) + '%'); }
    });
    status('Recognising vocals and word timestamps…');
    var result = await pipe(audio, { return_timestamps: 'word', chunk_length_s: 30, stride_length_s: 5 });
    return (result.chunks || []).map(function (chunk) {
      return [String(chunk.text || '').trim(), chunk.timestamp[0], chunk.timestamp[1] == null ? chunk.timestamp[0] : chunk.timestamp[1]];
    }).filter(function (w) { return w[0] && Number.isFinite(w[1]); });
  }
  function runWorkerRequest(data, transfer, status, signal) {
    if (typeof root.Worker !== 'function' || !AUTO_SYNC_SCRIPT_URL) return Promise.reject(new Error('Background audio processing is unavailable in this browser.'));
    var worker;
    try { worker = new root.Worker(new URL('auto-sync-worker.js', AUTO_SYNC_SCRIPT_URL)); }
    catch (error) { return Promise.reject(new Error('Could not start background audio processing: ' + (error && error.message ? error.message : String(error)))); }
    return new Promise(function (resolve, reject) {
      var settled = false;
      function finish(error, result) {
        if (settled) return;
        settled = true;
        if (signal) signal.removeEventListener('abort', onAbort);
        worker.terminate();
        if (error) reject(error); else resolve(result);
      }
      function onAbort() { finish(new DOMException('Cancelled', 'AbortError')); }
      worker.onmessage = function (event) {
        var message = event.data || {};
        if (message.status) { status(message.status); return; }
        if (message.error) { finish(new Error(message.error)); return; }
        if (Object.prototype.hasOwnProperty.call(message, 'result')) { finish(null, message.result); return; }
        finish(new Error('Background audio processing returned an invalid response.'));
      };
      worker.onerror = function (event) {
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        finish(new Error('Background audio processing stopped unexpectedly. Please retry.'));
      };
      if (signal) {
        if (signal.aborted) { onAbort(); return; }
        signal.addEventListener('abort', onAbort, { once: true });
      }
      try { worker.postMessage(data, transfer || []); }
      catch (error) { finish(error); }
    });
  }
  async function transcribe(model, status, signal) {
    status('Decoding and resampling audio to 16 kHz…');
    var decoded = await decodeAudio(signal);
    if (signal && signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    if (typeof root.Worker === 'function' && AUTO_SYNC_SCRIPT_URL) {
      return runWorkerRequest({ type: 'transcribe', model: model, audio: decoded.audio.buffer }, [decoded.audio.buffer], status, signal);
    }
    return transcribeAudio(decoded.audio, model, status);
  }
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (root.ort) { resolve(root.ort); return; }
      if (root.kefeOrtScriptPromise) { root.kefeOrtScriptPromise.then(resolve, reject); return; }
      root.kefeOrtScriptPromise = new Promise(function (done, fail) {
        var script = document.createElement('script');
        script.src = src; script.async = true;
        script.onload = function () { if (root.ort) done(root.ort); else { root.kefeOrtScriptPromise = null; fail(new Error('ONNX Runtime loaded without its browser API.')); } };
        script.onerror = function () { root.kefeOrtScriptPromise = null; fail(new Error('Could not load the ONNX Runtime browser engine.')); };
        document.head.appendChild(script);
      });
      root.kefeOrtScriptPromise.then(resolve, reject);
    });
  }
  async function getForcedAligner(status) {
    if (forcedAligner) return forcedAligner;
    if (!forcedAlignerPromise) forcedAlignerPromise = (async function () {
      status('Loading the local forced-alignment engine…');
      var modules = await Promise.all([import(CHARSU_CORE), import(CHARSU_ASSETS), loadScript(ORT_URL)]);
      var core = modules[0], assets = modules[1], ort = modules[2];
      ort.env.wasm.wasmPaths = ORT_WASM;
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.proxy = false;
      status('Loading English pronunciation data…');
      var loaded = await Promise.all([
        assets.loadG2pAssets(CHARSU_ASSET_BASE),
        assets.loadPhoneVocab(CHARSU_ASSET_BASE)
      ]);
      var phonemizer = new core.PhonemizerEn(new core.G2p(loaded[0]), loaded[1]);
      status('Downloading/loading the English phonetic model (~123 MB, first use)…');
      var session = await ort.InferenceSession.create(EN_ALIGN_MODEL, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all'
      });
      forcedAligner = new core.ForcedAligner({ session: session, ort: ort, phonemizer: phonemizer });
      return forcedAligner;
    })().catch(function (error) {
      forcedAlignerPromise = null;
      throw error;
    });
    return forcedAlignerPromise;
  }
  async function forceAlignLyrics(text, asr, status, signal) {
    if (/[^\p{Script=Latin}\p{N}\p{P}\p{Zs}\p{M}]/u.test(text)) {
      throw new Error('Phonetic forced alignment currently supports English/Latin-script lyrics. Choose a multilingual Whisper model for other languages.');
    }
    var aligner = await getForcedAligner(status);
    if (signal && signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    var decoded = await decodeAudio(signal);
    try {
      var structure = lyricStructure(text), lines = structure.lines, tokens = lyricTokens(lines);
      var matched = matchTokens(tokens, asr, 0, asr.length);
      var asrCoverage = matched.indexes.filter(Number.isFinite).length / Math.max(1, tokens.length);
      if (asrCoverage < 0.2) throw new Error('Whisper matched fewer than 20% of the supplied lyric words. Check the lyrics or choose a larger English Whisper model before forcing alignment.');
      var lineTimes = new Array(lines.length);
      tokens.forEach(function (token, index) {
        var ai = matched.indexes[index];
        if (ai == null) return;
        if (lineTimes[token.line] == null) {
          lineTimes[token.line] = asrWordStart(asr[ai]);
        }
      });
      var known = lineTimes.map(function (time, index) { return Number.isFinite(time) ? index : -1; }).filter(function (index) { return index >= 0; });
      if (!known.length) throw new Error('Whisper could not locate the supplied lyrics in the audio. Try a larger Whisper model.');
      for (var li = 0; li < lines.length; li++) {
        if (Number.isFinite(lineTimes[li])) continue;
        var left = known.filter(function (index) { return index < li; }).pop();
        var right = known.filter(function (index) { return index > li; })[0];
        lineTimes[li] = left != null && right != null
          ? lineTimes[left] + (lineTimes[right] - lineTimes[left]) * (li - left) / (right - left)
          : left != null ? lineTimes[left] + 1.6 : Math.max(0, lineTimes[right] - (right - li) * 1.6);
      }
      for (var ti = 1; ti < lineTimes.length; ti++) lineTimes[ti] = Math.max(lineTimes[ti], lineTimes[ti - 1] + 0.01);
      var wordTimings = new Array(tokens.length), completed = 0, failed = 0;
      var firstLine = 0, chunkRanges = [];
      while (firstLine < lines.length) {
        var chunkStartTime = lineTimes[firstLine], endLine = firstLine + 1;
        while (endLine < lines.length && lineTimes[endLine] - chunkStartTime < 18) endLine++;
        chunkRanges.push([firstLine, endLine]);
        firstLine = endLine;
      }
      for (var ci = 0; ci < chunkRanges.length; ci++) {
        if (signal && signal.aborted) throw new DOMException('Cancelled', 'AbortError');
        var range = chunkRanges[ci], localIndexes = [], asrIndexes = [];
        tokens.forEach(function (token, index) {
          if (token.line < range[0] || token.line >= range[1]) return;
          localIndexes.push(index);
          if (matched.indexes[index] != null) asrIndexes.push(matched.indexes[index]);
        });
        if (!localIndexes.length || !asrIndexes.length) { failed++; continue; }
        var firstAsr = Math.min.apply(Math, asrIndexes), lastAsr = Math.max.apply(Math, asrIndexes);
        var audioStart = Math.max(0, asrWordStart(asr[firstAsr]) - 1.8);
        var lastEnd = asrWordEnd(asr[lastAsr]);
        if (!Number.isFinite(lastEnd) || lastEnd <= asrWordStart(asr[lastAsr])) lastEnd = asrWordStart(asr[lastAsr]) + 0.35;
        var audioEnd = Math.min(decoded.audio.length / 16000, lastEnd + 1.8);
        if (audioEnd - audioStart < 1.2) audioEnd = Math.min(decoded.audio.length / 16000, audioStart + 1.2);
        var startSample = Math.max(0, Math.floor(audioStart * 16000));
        var endSample = Math.min(decoded.audio.length, Math.ceil(audioEnd * 16000));
        if (endSample - startSample < 16000) { failed++; continue; }
        var chunkText = lines.slice(range[0], range[1]).join('\n');
        status('Phonetic alignment: section ' + (ci + 1) + ' of ' + chunkRanges.length + '…');
        try {
          var aligned = await aligner.align(decoded.audio.subarray(startSample, endSample), chunkText);
          var localCursor = 0;
          aligned.words.forEach(function (segment) {
            if (!segment || segment[2] === '[SIL]') return;
            var label = norm(segment[2]), found = -1, best = 0;
            for (var k = localCursor; k < localIndexes.length; k++) {
              var score = similarity(label, norm(tokens[localIndexes[k]].word));
              if (score > best) { best = score; found = k; }
              if (score >= 0.72) break;
            }
            if (found >= 0 && best >= 0.55) {
              wordTimings[localIndexes[found]] = audioStart + segment[0];
              localCursor = found + 1;
            }
          });
          completed++;
        } catch (error) {
          failed++;
          status('A lyric section could not be force-aligned; retaining its recognised estimates…');
        }
      }
      if (!wordTimings.some(Number.isFinite)) {
        throw new Error('Forced alignment did not produce usable word timings. Try clearer vocals or use standard Auto-time.');
      }
      status('Forced alignment complete: ' + wordTimings.filter(Number.isFinite).length + ' words measured across ' + completed + ' sections' + (failed ? '; ' + failed + ' sections kept estimated timings.' : '.'));
      return { wordTimings: wordTimings, asrCoverage: asrCoverage };
    } finally { decoded.audio = null; }
  }
  function init() {
    var host = document.querySelector('[data-panel-view="lyrics"] .kefe-form');
    if (!host || document.getElementById('kefeAutoSync')) return;
    var card = document.createElement('section'); card.id = 'kefeAutoSync'; card.className = 'kefe-editor-panel-card';
    card.style.cssText = 'display:grid;gap:8px;min-width:0;margin:8px 0;';
    var title = document.createElement('div'); title.className = 'kefe-label'; title.textContent = '2 · Sync lyrics';
    var help = document.createElement('div'); help.className = 'kefe-meta'; help.textContent = 'If you pasted plain lyrics, KEFE can listen to your song and add the timing. This can take a few minutes the first time.';
    var controls = document.createElement('div'); controls.className = 'kefe-download-row'; controls.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;min-width:0;';
    var select = document.createElement('select'); select.className = 'kefe-select'; select.setAttribute('aria-label', 'Speech recognition model');
    [['tiny','Multilingual · Fast (default)'],['base','Multilingual · Balanced'],['small','Multilingual · More accurate'],['tiny.en','English · Fast'],['base.en','English · More accurate'],['ctc.en','English · Precise alignment']].forEach(function (pair) { var o = document.createElement('option'); o.value = pair[0]; o.textContent = pair[1]; select.appendChild(o); });
    var go = document.createElement('button'); go.type = 'button'; go.className = 'kefe-btn primary'; go.textContent = 'Auto-sync to audio';
    var cancelBtn = document.createElement('button'); cancelBtn.type = 'button'; cancelBtn.className = 'kefe-btn'; cancelBtn.textContent = 'Cancel auto-time'; cancelBtn.hidden = true;
    var undo = document.createElement('button'); undo.type = 'button'; undo.className = 'kefe-btn'; undo.textContent = 'Undo auto-time'; undo.disabled = true;
    var status = document.createElement('div'); status.className = 'kefe-meta'; status.setAttribute('role','status'); status.setAttribute('aria-live','polite');
    var note = document.createElement('div'); note.className = 'kefe-meta';
    var previous = null, activeAbort = null;
    var more = document.createElement('details'); more.className = 'kefe-more';
    var moreSummary = document.createElement('summary'); moreSummary.textContent = 'Language and advanced options';
    var moreHelp = document.createElement('div'); moreHelp.className = 'kefe-meta'; moreHelp.textContent = 'KEFE uses the multilingual model by default. English-only models can improve English recognition; precise English alignment downloads a larger model and uses more memory.';
    more.append(moreSummary, select, moreHelp);
    controls.append(go, undo, cancelBtn); card.append(title, help, controls, more, status, note);
    host.insertBefore(card, host.firstChild);
    cancelBtn.addEventListener('click', function () {
      if (activeAbort) activeAbort.abort();
      cancelBtn.disabled = true;
    });
    go.addEventListener('click', async function () {
      if (activeAbort) return;
      var box = document.getElementById('lyricsInput');
      if (!box || !parseLyrics(box.value).length) { status.textContent = 'Paste the lyrics in the Lyrics editor first.'; return; }
      var api = root.kefeLyrics, model = root.kefeLyricModel;
      if (!api || !model) { status.textContent = 'KEFE lyric editor is not ready.'; return; }
      activeAbort = new AbortController();
      var signal = activeAbort.signal;
      go.disabled = undo.disabled = true; cancelBtn.hidden = false; cancelBtn.disabled = false; note.textContent = '';
      var sourceLyrics = box.value;
      try {
        var audio = document.getElementById('kefeAudio'), src = audio && (audio.currentSrc || audio.src);
        var recognitionModel = select.value === 'ctc.en' ? 'base.en' : select.value;
        if (!cached || cached.model !== recognitionModel || cached.src !== src) {
          cached = { model: recognitionModel, src: src, words: await transcribe(recognitionModel, function (s) { status.textContent = s; }, signal) };
        }
        if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
        if (!cached.words.length) throw new Error('No speech was detected in this audio.');
        var meta = function (id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; };
        var options = { title: meta('songTitle'), artist: meta('songArtist'), album: meta('songAlbum') }, forcedCoverage = null;
        if (select.value === 'ctc.en') {
          var forced = await forceAlignLyrics(sourceLyrics, cached.words, function (s) { status.textContent = s; }, signal);
          options.wordTimings = forced.wordTimings;
          forcedCoverage = forced.asrCoverage;
        }
        if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
        status.textContent = 'Matching recognised words to your lyrics and building timestamps…';
        await new Promise(function (resolve) { setTimeout(resolve, 0); });
        var result = typeof root.Worker === 'function' && AUTO_SYNC_SCRIPT_URL
          ? await runWorkerRequest({ type: 'align', asr: cached.words, text: sourceLyrics, meta: options }, [], function (message) { status.textContent = message; }, signal)
          : align(cached.words, sourceLyrics, options);
        var pct = Math.round(100 * result.matched / result.words);
        var nextLines = model.parseLrc(result.lrc);
        if (!nextLines.length) throw new Error('The timing result could not be applied to the lyric editor.');
        if (box.value !== sourceLyrics || (audio && (audio.currentSrc || audio.src) !== src)) throw new Error('The lyrics or loaded audio changed during syncing. Run auto-time again for the current track.');
        previous = { lines: model.cloneLines(api.lines()), text: box.value };
        api.set(nextLines, 'autosync');
        status.textContent = (select.value === 'ctc.en' ? 'Forced alignment' : 'Auto-sync') + ' complete: ' + result.matched + '/' + result.words + ' word timings measured (' + pct + '%).' + (forcedCoverage == null ? '' : ' Whisper lyric overlap: ' + Math.round(forcedCoverage * 100) + '%');
        var review = validateReport(result);
        note.textContent = 'Measured word timings: ' + review.measuredWords + '/' + review.totalWords + '; estimated: ' + review.estimatedWords + '. ' + review.warnings.join(' ') + (forcedCoverage != null && forcedCoverage < 0.55 ? ' Whisper found limited lyric overlap, so forced timings may be unreliable.' : '') + ' Review line and word timings in the Timing editor before exporting.';
        undo.disabled = false;
      } catch (e) {
        if (e && e.name === 'AbortError') status.textContent = 'Auto-sync cancelled.';
        else status.textContent = 'Auto-sync failed: ' + (e && e.message ? e.message : String(e));
      } finally {
        activeAbort = null;
        go.disabled = false;
        cancelBtn.hidden = true;
        cancelBtn.disabled = false;
        undo.disabled = !previous;
      }
    });
    undo.addEventListener('click', function () {
      if (!previous || !root.kefeLyrics) return;
      root.kefeLyrics.set(previous.lines, 'autosync-restore');
      previous = null; undo.disabled = true; status.textContent = 'Previous lyrics restored.'; note.textContent = '';
    });
  }
  root.kefeAutoSync = {
    align: align,
    transcribeAudio: transcribeAudio,
    autoWindows: autoWindows,
    parseLyrics: parseLyrics,
    validateReport: validateReport
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.kefeAutoSync;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
