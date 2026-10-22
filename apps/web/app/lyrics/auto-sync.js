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
  function align(asr, text, meta) {
    var lines = parseLyrics(text), tokens = [];
    lines.forEach(function (line, li) { line.split(/\s+/).forEach(function (word) { tokens.push({ word: word, line: li }); }); });
    if (!tokens.length || !asr.length) throw new Error('Add lyrics and load a song with vocals first.');
    var timings = new Array(tokens.length), cursor = 0;
    tokens.forEach(function (token, i) {
      var best = -1, score = 0;
      for (var j = cursor; j < Math.min(asr.length, cursor + 9); j++) {
        var s = similarity(token.word, asr[j][0]);
        if (s > score) { score = s; best = j; }
      }
      if (best >= 0 && score >= 0.58) { timings[i] = asr[best][1]; cursor = best + 1; }
    });
    var starts = lines.map(function (_, i) {
      var found = [];
      tokens.forEach(function (t, k) { if (t.line === i && Number.isFinite(timings[k])) found.push(timings[k]); });
      return found.length ? found[0] : null;
    });
    // Fill unsupported lines between measured anchors using line length as a timing weight.
    var known = starts.map(function (t, i) { return tokens.some(function (w, k) { return w.line === i && Number.isFinite(timings[k]); }) ? i : -1; }).filter(function (i) { return i >= 0; });
    if (!known.length) throw new Error('No lyric words matched the recognised vocal; try the larger speech model.');
    for (var li = 0; li < lines.length; li++) {
      if (tokens.some(function (w, k) { return w.line === li && Number.isFinite(timings[k]); })) continue;
      var left = known.filter(function (x) { return x < li; }).pop(), right = known.filter(function (x) { return x > li; })[0];
      if (left != null && right != null) starts[li] = starts[left] + (starts[right] - starts[left]) * (li - left) / (right - left);
      else if (left != null) starts[li] = starts[left] + Math.max(1.1, lines[left].length / 18);
      else starts[li] = Math.max(0, starts[right] - (right - li) * 1.8);
    }
    var out = [];
    if (meta.title) out.push('[ti:' + meta.title + ']');
    if (meta.artist) out.push('[ar:' + meta.artist + ']');
    if (meta.album) out.push('[al:' + meta.album + ']');
    var offset = 0;
    lines.forEach(function (line, li) {
      var ws = line.split(/\s+/), indexes = [];
      tokens.forEach(function (t, k) { if (t.line === li) indexes.push(k); });
      var start = starts[li], next = starts[li + 1], end = Number.isFinite(next) && next > start ? Math.min(next - 0.05, start + Math.max(0.5, line.length / 15)) : start + Math.max(0.8, line.length / 15);
      var weights = ws.map(function (w) { return Math.max(1, w.length); }), total = weights.reduce(function (a, b) { return a + b; }, 0), elapsed = 0;
      var tagged = ws.map(function (word, wi) {
        var estimate = start + (end - start) * elapsed / total; elapsed += weights[wi];
        var k = indexes[wi], measured = k == null ? null : timings[k];
        var t = measured != null && measured >= start - 0.3 && measured < end + 0.2 ? measured : estimate;
        return '<' + stamp(t) + '>' + word;
      }).join(' ');
      out.push('[' + stamp(start) + '] ' + tagged);
    });
    return { lrc: out.join('\n') + '\n', matched: timings.filter(Number.isFinite).length, words: tokens.length, lines: lines.length };
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
  root.kefeAutoSync = { align: align, parseLyrics: parseLyrics };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.kefeAutoSync;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
