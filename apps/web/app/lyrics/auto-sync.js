(function (root) {
  'use strict';
  var CDN = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';
  var cached = null;
  function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z']/g, ''); }
  function similarity(a, b) {
    a = norm(a); b = norm(b);
    if (!a || !b) return 0;
    var prev = new Array(b.length + 1).fill(0), cur;
    for (var i = 1; i <= a.length; i++) {
      cur = new Array(b.length + 1).fill(0);
      for (var j = 1; j <= b.length; j++) cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
      prev = cur;
    }
    return 2 * prev[b.length] / (a.length + b.length);
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
  function lyricTokens(lines) {
    var tokens = [];
    lines.forEach(function (line, li) {
      line.split(/\s+/).forEach(function (word) { tokens.push({ word: word, line: li }); });
    });
    return tokens;
  }
  function matchTokens(tokens, asr, from, to) {
    var timings = new Array(tokens.length), indexes = new Array(tokens.length), cursor = from || 0;
    var limit = to == null ? asr.length : Math.min(asr.length, to);
    tokens.forEach(function (token, i) {
      var best = -1, score = 0;
      for (var j = cursor; j < Math.min(limit, cursor + 12); j++) {
        var candidate = similarity(token.word, asrWordText(asr[j]));
        if (candidate > score) { score = candidate; best = j; }
      }
      if (best >= 0 && score >= 0.58) {
        timings[i] = asrWordStart(asr[best]);
        indexes[i] = best;
        cursor = best + 1;
      }
    });
    return { timings: timings, indexes: indexes };
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
    var timings = new Array(tokens.length), tokenAsrIndexes = new Array(tokens.length);
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
        }
      });
    });
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
    var out = [];
    if (opts.title) out.push('[ti:' + opts.title + ']');
    if (opts.artist) out.push('[ar:' + opts.artist + ']');
    if (opts.album) out.push('[al:' + opts.album + ']');
    lines.forEach(function (line, li) {
      var words = line.split(/\s+/), indexes = [];
      tokens.forEach(function (token, index) { if (token.line === li) indexes.push(index); });
      var start = starts[li], next = starts[li + 1];
      var end = Number.isFinite(next) && next > start ? Math.min(next - 0.05, start + Math.max(0.5, line.length / 15)) : start + Math.max(0.8, line.length / 15);
      var weights = words.map(function (word) { return Math.max(1, word.length); });
      var total = weights.reduce(function (sum, value) { return sum + value; }, 0), elapsed = 0;
      var tagged = words.map(function (word, wi) {
        var estimate = start + (end - start) * elapsed / total;
        elapsed += weights[wi];
        var measured = timings[indexes[wi]];
        var time = Number.isFinite(measured) && measured >= start - 0.3 && measured < end + 0.2 ? measured : estimate;
        return '<' + stamp(time) + '>' + word;
      }).join(' ');
      out.push('[' + stamp(start) + '] ' + tagged);
    });
    return { lrc: out.join('\n') + '\n', matched: timings.filter(Number.isFinite).length, words: tokens.length, lines: lines.length, report: report, windows: windows };
  }
  async function decodeAudio() {
    var audio = document.getElementById('kefeAudio'), src = audio && (audio.currentSrc || audio.src);
    if (!src) throw new Error('Load the song in Media first.');
    var response = await fetch(src);
    if (!response.ok) throw new Error('Could not read the loaded audio.');
    var buffer = await response.arrayBuffer(), Ctx = root.AudioContext || root.webkitAudioContext, ctx = new Ctx();
    try {
      var decoded = await ctx.decodeAudioData(buffer), mono = new Float32Array(decoded.length);
      for (var c = 0; c < decoded.numberOfChannels; c++) {
        var channel = decoded.getChannelData(c);
        for (var i = 0; i < mono.length; i++) mono[i] += channel[i] / decoded.numberOfChannels;
      }
      return { audio: mono, context: ctx };
    } catch (e) { await ctx.close(); throw e; }
  }
  async function transcribe(model, status) {
    status('Decoding loaded audio…');
    var decoded = await decodeAudio();
    try {
      status('Loading speech model; first use downloads it for browser caching…');
      var tf = await import(CDN);
      tf.env.allowLocalModels = false;
      var pipe = await tf.pipeline('automatic-speech-recognition', 'Xenova/whisper-' + model, {
        progress_callback: function (p) { if (p && p.status === 'progress') status('Downloading speech model… ' + Math.round(p.progress || 0) + '%'); }
      });
      status('Recognising vocals and word timestamps…');
      var result = await pipe(decoded.audio, { return_timestamps: 'word', chunk_length_s: 30, stride_length_s: 5 });
      return (result.chunks || []).map(function (chunk) {
        return [String(chunk.text || '').trim(), chunk.timestamp[0], chunk.timestamp[1] == null ? chunk.timestamp[0] : chunk.timestamp[1]];
      }).filter(function (w) { return w[0] && Number.isFinite(w[1]); });
    } finally { if (decoded.context.close) await decoded.context.close(); }
  }
  function init() {
    var host = document.querySelector('[data-panel-view="lyrics"] .kefe-form');
    if (!host || document.getElementById('kefeAutoSync')) return;
    var card = document.createElement('section'); card.id = 'kefeAutoSync'; card.className = 'kefe-editor-panel-card';
    card.style.cssText = 'display:grid;gap:8px;min-width:0;margin:8px 0;';
    var title = document.createElement('div'); title.className = 'kefe-label'; title.textContent = 'Auto-sync lyrics (beta)';
    var help = document.createElement('div'); help.className = 'kefe-meta'; help.textContent = 'Load a song and add plain lyrics above. KEFE recognises vocals locally in your browser, aligns words, and sends enhanced timings to the existing timing editor. Speech-model files are downloaded from the CDN and cached by the browser.';
    var controls = document.createElement('div'); controls.className = 'kefe-download-row'; controls.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;min-width:0;';
    var select = document.createElement('select'); select.className = 'kefe-select'; select.setAttribute('aria-label', 'Speech recognition model');
    [['tiny.en','Fast'],['base.en','More accurate']].forEach(function (pair) { var o = document.createElement('option'); o.value = pair[0]; o.textContent = pair[1]; select.appendChild(o); });
    var go = document.createElement('button'); go.type = 'button'; go.className = 'kefe-mini'; go.textContent = 'Auto-time lyrics';
    var undo = document.createElement('button'); undo.type = 'button'; undo.className = 'kefe-mini'; undo.textContent = 'Restore previous'; undo.disabled = true;
    var status = document.createElement('div'); status.className = 'kefe-meta'; status.setAttribute('role','status'); status.setAttribute('aria-live','polite');
    var note = document.createElement('div'); note.className = 'kefe-meta';
    var previous = null;
    controls.append(select, go, undo); card.append(title, help, controls, status, note);
    var timing = document.getElementById('kefeTimingEditor'); host.insertBefore(card, timing || null);
    go.addEventListener('click', async function () {
      var box = document.getElementById('lyricsInput');
      if (!box || !parseLyrics(box.value).length) { status.textContent = 'Paste the lyrics in the Lyrics editor first.'; return; }
      var api = root.kefeLyrics, model = root.kefeLyricModel;
      if (!api || !model) { status.textContent = 'KEFE lyric editor is not ready.'; return; }
      go.disabled = undo.disabled = true; note.textContent = '';
      try {
        if (!cached || cached.model !== select.value) cached = { model: select.value, words: await transcribe(select.value, function (s) { status.textContent = s; }) };
        if (!cached.words.length) throw new Error('No speech was detected in this audio.');
        var meta = function (id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; };
        var result = align(cached.words, box.value, { title: meta('songTitle'), artist: meta('songArtist'), album: meta('songAlbum') });
        var parsed = model.parseLrc(result.lrc);
        if (!parsed.length) throw new Error('The generated timings did not pass KEFE lyric parsing.');
        previous = { text: box.value, lines: api.lines() };
        box.value = result.lrc; api.set(parsed, 'autosync');
        var pct = Math.round(100 * result.matched / result.words);
        status.textContent = 'Auto-sync complete: ' + result.matched + '/' + result.words + ' words matched (' + pct + '%).';
        note.textContent = (pct < 40 ? 'Low vocal match; much of the timing may be estimated. ' : '') + 'Review line and word timings in the Timing editor before exporting.';
        undo.disabled = false;
      } catch (e) { status.textContent = 'Auto-sync failed: ' + (e && e.message ? e.message : String(e)); }
      finally { go.disabled = false; }
    });
    undo.addEventListener('click', function () {
      if (!previous || !root.kefeLyrics) return;
      var model = root.kefeLyricModel;
      root.kefeLyrics.set(previous.lines, 'autosync');
      var box = document.getElementById('lyricsInput'); if (box) box.value = previous.text;
      previous = null; undo.disabled = true; status.textContent = 'Previous lyrics restored.'; note.textContent = '';
    });
  }
  root.kefeAutoSync = {
    align: align,
    autoWindows: autoWindows,
    parseLyrics: parseLyrics
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.kefeAutoSync;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
