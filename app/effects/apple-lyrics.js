/* KEFE — Apple Music-style word-by-word lyrics effect.
 * Clean-room AMLL-style data contract. No external dependencies.
 * Rendering is deterministic: no requestAnimationFrame, timers or persistent animation state.
 *
 * Interface: renderAppleLyrics(ctx, boxW, boxH, style, lines, time)
 *   - ctx: already translated to the box origin by kefe-layout
 *   - boxW, boxH: dimensions of the box (draw inside 0..boxW, 0..boxH)
 *   - style: { fontSize, fxSpacing, fxSize, fxBox, ... }
 *   - lines: LyricLine[] (normalised below)
 *   - time: milliseconds
 */
(function () {
  'use strict';

  var FONT_STACK = '"SF Pro Display","SF Pro Text",-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif';
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var num = function (v, d) { return Number.isFinite(Number(v)) && v !== '' && v !== null ? Number(v) : d; };

  /* ---------- Timestamp parsing ---------- */
  function parseTimestamp(value) {
    if (value == null || value === '') return NaN;
    var raw = String(value).trim();
    if (/^\d+(?:\.\d+)?ms$/i.test(raw)) return parseFloat(raw);
    if (/^\d+(?:\.\d+)?s$/i.test(raw)) return parseFloat(raw) * 1000;
    var parts = raw.split(':').map(Number);
    if (parts.some(Number.isNaN)) return NaN;
    if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
    if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000;
    return Number(raw) * 1000;
  }

  function attr(node, name) {
    if (!node) return '';
    var direct = node.getAttribute && node.getAttribute(name);
    if (direct) return direct;
    var list = node.attributes || [];
    for (var i = 0; i < list.length; i++) if (list[i].localName === name) return list[i].value;
    return '';
  }

  /* ---------- Timed fragment splitting ---------- */
  function splitTimedFragment(fragment) {
    var text = String(fragment.text || '').replace(/\s+/g, ' ').trim();
    if (!text) return [];
    if (!Number.isFinite(fragment.startTime) || !Number.isFinite(fragment.endTime) || fragment.endTime <= fragment.startTime) return [];
    var tokens = text.split(/\s+/);
    if (tokens.length === 1) return [{ startTime: fragment.startTime, endTime: fragment.endTime, word: tokens[0], isBG: !!fragment.isBG }];
    var weights = tokens.map(function (t) { return Math.max(1, (t.replace(/[^\p{L}\p{N}]/gu, '') || '').length); });
    var total = weights.reduce(function (a, b) { return a + b; }, 0);
    var cursor = fragment.startTime;
    return tokens.map(function (word, i) {
      var end = i === tokens.length - 1 ? fragment.endTime : cursor + (fragment.endTime - fragment.startTime) * (weights[i] / total);
      var out = { startTime: cursor, endTime: Math.max(cursor + 1, end), word: word, isBG: !!fragment.isBG };
      cursor = out.endTime;
      return out;
    });
  }

  /* ---------- TTML parser ---------- */
  function parseAppleTTML(source) {
    if (Array.isArray(source)) return normaliseLines(source);
    if (typeof source !== 'string' || !source.trim()) return [];
    var doc = new DOMParser().parseFromString(source, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('Invalid TTML');

    return Array.prototype.slice.call(doc.querySelectorAll('p')).map(function (p) {
      var start = parseTimestamp(attr(p, 'begin'));
      var endAttr = parseTimestamp(attr(p, 'end'));
      var dur = parseTimestamp(attr(p, 'dur'));
      var end = Number.isFinite(endAttr) ? endAttr : (Number.isFinite(start) && Number.isFinite(dur) ? start + dur : NaN);
      var primary = [], background = [], translation = '', roman = '';

      function walk(node, inStart, inEnd, role, agent, isBG) {
        if (node.nodeType === 3) {
          var text = node.nodeValue || '';
          if (!text.trim()) return;
          var roleName = String(role || '').toLowerCase();
          var fragment = { text: text, startTime: inStart, endTime: inEnd, isBG: !!isBG, agent: agent };
          if (roleName === 'x-translation') translation += text;
          else if (roleName === 'x-roman') roman += text;
          else if (isBG || roleName === 'x-bg') background.push(fragment);
          else primary.push(fragment);
          return;
        }
        if (node.nodeType !== 1) return;
        var ownStart = parseTimestamp(attr(node, 'begin'));
        var ownEnd = parseTimestamp(attr(node, 'end'));
        var ownDur = parseTimestamp(attr(node, 'dur'));
        var nextStart = Number.isFinite(ownStart) ? ownStart : inStart;
        var nextEnd = Number.isFinite(ownEnd) ? ownEnd : (Number.isFinite(ownDur) && Number.isFinite(nextStart) ? nextStart + ownDur : inEnd);
        var nextRole = attr(node, 'role') || role;
        var nextAgent = attr(node, 'agent') || agent;
        var bg = !!isBG || String(nextRole).toLowerCase() === 'x-bg';
        Array.prototype.slice.call(node.childNodes).forEach(function (child) { walk(child, nextStart, nextEnd, nextRole, nextAgent, bg); });
      }

      Array.prototype.slice.call(p.childNodes).forEach(function (child) { walk(child, start, end, '', attr(p, 'agent'), false); });

      var words = primary.reduce(function (acc, f) { return acc.concat(splitTimedFragment(f)); }, []);
      var bgWords = background.reduce(function (acc, f) { return acc.concat(splitTimedFragment(f)); }, []);
      var text = primary.map(function (f) { return f.text; }).join('').replace(/\s+/g, ' ').trim();

      return normaliseLine({
        words: words,
        backgroundWords: bgWords,
        startTime: Number.isFinite(start) ? start : (words[0] ? words[0].startTime : 0),
        endTime: Number.isFinite(end) ? end : (words.length ? words[words.length - 1].endTime : start || 0),
        isBG: words.length === 0 && bgWords.length > 0,
        isDuet: String(attr(p, 'agent') || '').toLowerCase().indexOf('duet') !== -1,
        translatedLyric: translation.replace(/\s+/g, ' ').trim(),
        romanLyric: roman.replace(/\s+/g, ' ').trim(),
        text: text
      });
    }).filter(Boolean);
  }

  /* ---------- LRC parser ---------- */
  function parseAppleLRC(source) {
    if (typeof source !== 'string') return [];
    var out = [];
    source.split(/\r?\n/).forEach(function (row) {
      var m = row.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/);
      if (!m) return;
      var start = (parseInt(m[1], 10) * 60 + parseFloat(m[2])) * 1000;
      var text = m[3].trim();
      if (!text) return;
      out.push({ words: [{ startTime: start, endTime: start + 2000, word: text, isBG: false }], startTime: start, endTime: start + 2000, isBG: false, isDuet: false, translatedLyric: '', romanLyric: '', text: text });
    });
    for (var i = 0; i < out.length - 1; i++) {
      out[i].endTime = Math.max(out[i].startTime + 100, out[i + 1].startTime);
      out[i].words[0].endTime = out[i].endTime;
    }
    return out;
  }

  /* ---------- Normalisation ---------- */
  function normaliseLine(line) {
    if (!line) return null;
    var words = (Array.isArray(line.words) ? line.words : []).map(function (w) {
      var start = num(w.startTime != null ? w.startTime : (w.time != null ? w.time : w.start), 0);
      var end = num(w.endTime != null ? w.endTime : w.end, start + 100);
      return {
        startTime: start,
        endTime: Math.max(start + 1, end),
        word: String(w.word != null ? w.word : (w.text || '')),
        isBG: !!(w.isBG != null ? w.isBG : w.background)
      };
    }).filter(function (w) { return w.word; });

    var text = String(line.text != null ? line.text : words.map(function (w) { return w.word; }).join('')).replace(/\s+/g, ' ').trim();
    var start = num(line.startTime != null ? line.startTime : (line.time != null ? line.time : line.start), words[0] ? words[0].startTime : 0);
    var end = num(line.endTime != null ? line.endTime : line.end, words.length ? words[words.length - 1].endTime : start + 100);

    return {
      words: words,
      startTime: start,
      endTime: Math.max(start + 1, end),
      isBG: !!line.isBG,
      isDuet: !!line.isDuet,
      translatedLyric: String(line.translatedLyric || line.translation || ''),
      romanLyric: String(line.romanLyric || line.transliteration || ''),
      text: text
    };
  }

  function normaliseLines(lines) {
    if (!Array.isArray(lines)) return [];
    return lines.map(normaliseLine).filter(function (l) { return l && (l.text || l.words.length); });
  }

  /* ---------- Timing helpers ---------- */
  function activeIndex(lines, time) {
    for (var i = 0; i < lines.length; i++) {
      if (time >= lines[i].startTime && time < lines[i].endTime) return i;
    }
    if (!lines.length) return -1;
    if (time >= lines[lines.length - 1].endTime) return lines.length - 1;
    return -1;
  }

  function focusIndex(lines, time) {
    var ai = activeIndex(lines, time);
    if (ai >= 0) return ai;
    if (!lines.length) return 0;
    if (time < lines[0].startTime) return 0;
    return lines.length - 1;
  }

  function wordProgress(word, time) {
    var start = num(word.startTime, 0);
    var end = Math.max(start + 1, num(word.endTime, start + 1));
    return clamp((time - start) / (end - start), 0, 1);
  }

  /* ---------- Text measurement ---------- */
  function measure(ctx, text, size, weight) {
    ctx.font = (weight || 700) + ' ' + size + 'px ' + FONT_STACK;
    return ctx.measureText(text).width;
  }

  /* ---------- Renderer ---------- */
  function renderAppleLyrics(ctx, boxW, boxH, style, lyrics, time) {
    style = style || {};
    var lines = normaliseLines(lyrics);
    if (!lines.length) return;

    var baseSize = num(style.fontSize, 76);
    var spacingFactor = num(style.fxSpacing, 1);
    var highlight = style.highlightColor || '#ffffff';
    var inactive = style.inactiveColor || 'rgba(255,255,255,0.32)';
    var activeOpacity = num(style.activeOpacity, 1);
    var inactiveOpacity = num(style.inactiveOpacity, 0.32);
    var pastOpacity = num(style.pastOpacity, 0.14);
    var activeScale = num(style.activeScale, 1);
    var inactiveScale = num(style.inactiveScale, 0.985);
    var glowRadius = num(style.glowRadius, 7);
    var visibleLines = clamp(Math.round(num(style.visibleLines, 4)), 3, 7);

    var w = boxW, h = boxH;
    var margin = Math.max(12, Math.min(w, h) * 0.03);
    var maxWidth = w - margin * 2;

    var trackSize = baseSize;
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i];
      var words = ln.words.length ? ln.words : [{ word: ln.text || '' }];
      var str = words.map(function (x) { return String(x.word || ''); }).join(' ').trim();
      if (!str) continue;
      var scale = ln.isBG ? 0.66 : 1;
      var needed = measure(ctx, str, trackSize * scale, 700);
      if (needed > maxWidth) {
        var ratio = maxWidth / needed;
        trackSize = Math.max(14, trackSize * ratio);
      }
    }

    var rowH = trackSize * 1.25 + trackSize * spacingFactor * 0.30;
    var focus = focusIndex(lines, time);
    var ai = activeIndex(lines, time);
    var half = Math.floor(visibleLines / 2);
    var first = Math.max(0, focus - half);
    var last = Math.min(lines.length - 1, focus + half);
    var centerY = h * 0.5;

    for (var li = first; li <= last; li++) {
      var line = lines[li];
      var cy = centerY + (li - focus) * rowH;
      var isActive = li === ai;
      var isPast = ai >= 0 && li < ai;
      var relation = Math.abs(li - focus);

      var alpha = isActive ? activeOpacity
                : (isPast ? pastOpacity : inactiveOpacity) * (1 - Math.min(0.35, Math.max(0, relation - 1) * 0.08));
      var scale = isActive ? activeScale : inactiveScale;
      var size = trackSize * (line.isBG ? 0.66 : 1);
      var lineWords = line.words.length ? line.words : [{ startTime: line.startTime, endTime: line.endTime, word: line.text, isBG: line.isBG }];
      var drawWords = lineWords.filter(function (word) { return line.isBG || !word.isBG; });
      if (!drawWords.length) continue;

      var full = drawWords.map(function (x) { return String(x.word || ''); }).join(' ').trim();
      if (!full) continue;

      var total = measure(ctx, full, size, 700);
      var lineAlign = line.isDuet ? 'right' : 'left';
      var startX = lineAlign === 'right' ? w - margin - total : margin;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(w / 2, cy);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -cy);
      ctx.font = '700 ' + size + 'px ' + FONT_STACK;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';

      var x = startX;
      for (var wi = 0; wi < drawWords.length; wi++) {
        var word = drawWords[wi];
        var ww = measure(ctx, word.word, size, 700);
        var p = wordProgress(word, time);

        ctx.globalAlpha = alpha * (word.isBG ? 0.56 : 1);
        ctx.fillStyle = inactive;
        ctx.shadowBlur = 0;
        ctx.fillText(word.word, x, cy);

        if (p > 0) {
          ctx.save();
          ctx.beginPath();
          var reveal = ww * p;
          var fade = Math.min(ww * 0.32, Math.max(6, size * 0.14));
          ctx.rect(x, cy - size * 0.7, Math.max(0, reveal + fade), size * 1.4);
          ctx.clip();
          ctx.globalAlpha = alpha * (word.isBG ? 0.75 : 1);
          ctx.fillStyle = highlight;
          if (isActive && p < 1) {
            ctx.shadowColor = highlight;
            ctx.shadowBlur = glowRadius * Math.sin(p * Math.PI);
          } else {
            ctx.shadowBlur = 0;
          }
          ctx.fillText(word.word, x, cy);
          ctx.restore();
        }

        x += ww + measure(ctx, ' ', size, 700);
      }
      ctx.restore();

      if (isActive && line.translatedLyric) {
        ctx.save();
        ctx.globalAlpha = 0.58;
        ctx.font = '500 ' + Math.max(14, size * 0.38) + 'px ' + FONT_STACK;
        ctx.textAlign = lineAlign === 'right' ? 'right' : 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = 'rgba(255,255,255,0.82)';
        ctx.fillText(line.translatedLyric, lineAlign === 'right' ? w - margin : margin, cy + size * 0.72);
        ctx.restore();
      }
    }
  }

  /* ---------- Hit testing ---------- */
  function computeLayout(boxW, boxH, style, lines) {
    style = style || {};
    var baseSize = num(style.fontSize, 76);
    var spacingFactor = num(style.fxSpacing, 1);
    var visibleLines = clamp(Math.round(num(style.visibleLines, 4)), 3, 7);
    var w = boxW, h = boxH;
    var margin = Math.max(12, Math.min(w, h) * 0.03);
    var maxWidth = w - margin * 2;

    var trackSize = baseSize;
    var ctx = document.createElement('canvas').getContext('2d');
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i];
      var words = ln.words.length ? ln.words : [{ word: ln.text || '' }];
      var str = words.map(function (x) { return String(x.word || ''); }).join(' ').trim();
      if (!str) continue;
      var scale = ln.isBG ? 0.66 : 1;
      var needed = measure(ctx, str, trackSize * scale, 700);
      if (needed > maxWidth) trackSize = Math.max(14, trackSize * (maxWidth / needed));
    }

    return {
      w: w, h: h, margin: margin, trackSize: trackSize,
      rowH: trackSize * 1.25 + trackSize * spacingFactor * 0.30,
      visibleLines: visibleLines,
      centerY: h * 0.5
    };
  }

  function hitTest(boxW, boxH, style, lyrics, time, x, y) {
    var lines = normaliseLines(lyrics);
    if (!lines.length) return null;
    var L = computeLayout(boxW, boxH, style, lines);
    var focus = focusIndex(lines, time);
    var half = Math.floor(L.visibleLines / 2);
    var first = Math.max(0, focus - half);
    var last = Math.min(lines.length - 1, focus + half);
    for (var i = first; i <= last; i++) {
      var cy = L.centerY + (i - focus) * L.rowH;
      var hitSize = L.trackSize * (lines[i].isBG ? 0.66 : 1);
      if (Math.abs(y - cy) <= hitSize * 0.75) return lines[i];
    }
    return null;
  }

  /* ---------- Track loading (legacy helper) ---------- */
  async function loadTrack(data) {
    data = data || {};
    var source = data.ttmlLyrics != null ? data.ttmlLyrics : (data.lyrics || '');
    var lyrics;
    if (Array.isArray(source)) lyrics = normaliseLines(source);
    else if (data.format === 'lrc' || (!data.ttmlLyrics && typeof source === 'string' && /^\s*\[\d+:\d+(?:\.\d+)?\]/m.test(source))) lyrics = parseAppleLRC(source);
    else lyrics = parseAppleTTML(source);

    if (window.state && window.state.lyrics) {
      window.state.lyrics.lines = lyrics.map(function (line) {
        return Object.assign({}, line, {
          time: line.startTime / 1000,
          endTime: line.endTime / 1000,
          words: line.words.map(function (word) {
            return Object.assign({}, word, { text: word.word, time: word.startTime / 1000, endTime: word.endTime / 1000 });
          })
        });
      });
      if (data.title != null && window.state.audio && window.state.audio.metadata) window.state.audio.metadata.title = String(data.title);
      if (data.artist != null && window.state.audio && window.state.audio.metadata) window.state.audio.metadata.artist = String(data.artist);
      if (window.state.captions) window.state.captions.lines = [];
      if (window.state.playback) window.state.playback.currentTime = 0;
    }
    if (typeof window.setMasterTime === 'function') window.setMasterTime(0);
    if (typeof window.redrawCurrentPreviewFrame === 'function') window.redrawCurrentPreviewFrame();
    return Object.assign({}, data, { lyrics: lyrics });
  }

  /* ---------- Effect registration ---------- */
  var effect = Object.freeze({
    id: 'apple',
    name: 'Apple',
    description: 'Apple Music-style word-by-word lyric rendering',
    render: renderAppleLyrics,
    parse: function (source, format) {
      if (format === 'ttml') return parseAppleTTML(source);
      if (format === 'lrc') return parseAppleLRC(source);
      throw new Error('Unsupported format: ' + format);
    },
    hitTest: hitTest,
    defaultConfig: {
      activeOpacity: 1,
      inactiveOpacity: 0.32,
      pastOpacity: 0.14,
      activeScale: 1,
      inactiveScale: 0.985,
      glowRadius: 7,
      highlightColor: '#ffffff',
      inactiveColor: 'rgba(255,255,255,0.32)',
      visibleLines: 4,
      fontFamily: FONT_STACK
    }
  });

  window.kefeAppleLyricsEffect = effect;
  window.kefeAppleLyrics = Object.freeze(Object.assign({}, effect, {
    FONT_STACK: FONT_STACK,
    parseAppleTTML: parseAppleTTML,
    parseAppleLRC: parseAppleLRC,
    renderAppleLyrics: renderAppleLyrics,
    hitTest: hitTest,
    loadTrack: loadTrack
  }));
  if (typeof window.loadTrack !== 'function') window.loadTrack = loadTrack;
  window.KEFE_APPLE_FONT_STACK = FONT_STACK;
})();