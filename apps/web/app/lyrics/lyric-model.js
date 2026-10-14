/* KEFE — lyric data model.
   Pure functions, no DOM. Everything that reads, edits, transforms or exports timed lyrics goes through here
   so the editor, the timing UI, the effects and the exporters agree on one line/word shape:

     line = { text, time, endTime, words?: [{ text, time, endTime }], manualEnd?: boolean }

   Times are seconds. `endTime` is derived (next line start, or +3s for the last line) unless `manualEnd` is set. */
(function (root) {
  'use strict';

  var DEFAULT_TAIL = 3;
  var MIN_WORD = 0.06;

  function num(v, fallback) { v = Number(v); return Number.isFinite(v) ? v : fallback; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function round3(v) { return Math.round(v * 1000) / 1000; }

  /* ---------- timestamps ---------- */
  function fmtStamp(t, digits) {
    digits = digits == null ? 3 : digits;
    var ms = Math.round(Math.max(0, num(t, 0)) * 1000);
    var mins = Math.floor(ms / 60000), secs = (ms % 60000) / 1000;
    return String(mins).padStart(2, '0') + ':' + secs.toFixed(digits).padStart(digits ? 3 + digits : 2, '0');
  }
  function fmtLrc(t) { return '[' + fmtStamp(t, 3) + ']'; }
  /* Accepts "83.5", "1:23.5", "01:23,500", "1:02:03.4". Returns NaN when it cannot be read. */
  function parseStamp(value) {
    var s = String(value == null ? '' : value).trim().replace(',', '.');
    if (!s) return NaN;
    if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
    var parts = s.split(':');
    if (parts.length < 2 || parts.length > 3 || parts.some(function (p) { return !/^\d+(\.\d+)?$/.test(p); })) return NaN;
    return parts.reduce(function (acc, p) { return acc * 60 + Number(p); }, 0);
  }
  function srtStamp(t) {
    var ms = Math.round(Math.max(0, num(t, 0)) * 1000);
    var h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60, r = ms % 1000;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + ',' + String(r).padStart(3, '0');
  }

  /* ---------- words ---------- */
  /* Rough syllable count (vowel groups, silent trailing e) so held/long words get proportionally more time than char count alone. */
  function syllables(token) {
    var w = String(token || '').toLowerCase().replace(/[^\p{L}]/gu, '');
    if (!w) return 0;
    if (/[^\u0000-\u024f]/.test(w)) return Math.max(1, Array.from(w).length * 0.7);   // non-Latin: ~0.7 syllable per glyph
    var m = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '').match(/[aeiouy]{1,2}/g);
    return Math.max(1, m ? m.length : 1);
  }
  function tokenWeight(token) {
    var plain = String(token || '').replace(/[^\p{L}\p{N}]/gu, '');
    var weight = 0.55 * syllables(token) + 0.45 * Math.pow(Math.max(1, Array.from(plain).length), 0.6);
    if (/[,;:\u2014-]$/.test(token)) weight += 0.35;          // breath after clause punctuation
    if (/[.!?\u2026]$/.test(token)) weight += 0.6;            // longer rest after a sentence end
    return Math.max(0.8, weight);
  }
  /* How long a sung line naturally lasts, used so estimated words finish with the vocal instead of crawling across an instrumental gap. */
  function naturalSpan(tokens) {
    var t = 0;
    tokens.forEach(function (tok) { t += 0.2 * syllables(tok) + 0.12; if (/[,;:]$/.test(tok)) t += 0.12; if (/[.!?\u2026]$/.test(tok)) t += 0.2; });
    return t;
  }
  /* Spread a line's words across [start, end] weighted by syllables. Used when no real word timing exists.
     `capToVocal` shortens the sung span when the gap to the next line is much longer than the text needs. */
  function estimateWords(text, start, end, capToVocal) {
    var tokens = String(text || '').trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) return [];
    start = num(start, 0);
    end = Math.max(start + tokens.length * MIN_WORD, num(end, start + DEFAULT_TAIL));
    if (capToVocal) {
      var natural = naturalSpan(tokens), gap = end - start;
      end = start + (gap <= natural * 1.5 ? gap * 0.94 : Math.min(gap * 0.94, natural * 1.3));
    }
    var weights = tokens.map(tokenWeight), total = weights.reduce(function (a, b) { return a + b; }, 0), cursor = 0;
    return tokens.map(function (t, i) {
      var a = start + (end - start) * cursor / total;
      cursor += weights[i];
      var b = start + (end - start) * cursor / total;
      return { text: t, time: round3(a), endTime: round3(Math.max(a + MIN_WORD, b)) };
    });
  }
  /* Real word timing if the line has it, otherwise an estimate. */
  function wordsOf(line, nextTime) {
    if (line && Array.isArray(line.words) && line.words.length) return line.words;
    var start = num(line && line.time, 0);
    var end = num(line && line.endTime, NaN);
    var manual = !!(line && line.manualEnd);
    if (!(end > start)) end = Number.isFinite(nextTime) && nextTime > start ? nextTime : start + DEFAULT_TAIL;
    return estimateWords(line && line.text, start, end, !manual);
  }
  function hasRealWords(line) { return !!(line && Array.isArray(line.words) && line.words.length); }

  function cleanWords(words, lineStart, lineEnd) {
    var out = (words || []).map(function (w) {
      return { text: String((w && w.text) || '').trim(), time: num(w && w.time, NaN), endTime: num(w && w.endTime, NaN) };
    }).filter(function (w) { return w.text && Number.isFinite(w.time); });
    out.sort(function (a, b) { return a.time - b.time; });
    out.forEach(function (w, i) {
      var next = out[i + 1];
      var end = w.endTime;
      if (!(end > w.time)) end = next ? next.time : (Number.isFinite(lineEnd) && lineEnd > w.time ? lineEnd : w.time + 0.3);
      if (next && end > next.time) end = next.time;
      w.endTime = round3(Math.max(w.time + MIN_WORD, end));
      w.time = round3(w.time);
    });
    return out;
  }

  /* ---------- LRC ---------- */
  var LINE_STAMP = /^\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/;
  var WORD_STAMP = /<(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?>/g;
  function stampSeconds(m) {
    var frac = m[3] ? Number(m[3]) / Math.pow(10, m[3].length) : 0;
    return Number(m[1]) * 60 + Number(m[2]) + frac;
  }
  /* Parses standard and enhanced LRC. Enhanced word tags (<mm:ss.xx>word) become `words`. Returns [] if no stamps found. */
  function parseLrc(text) {
    var src = String(text || '').replace(/^﻿/, '').replace(/\r/g, '');
    var off = src.match(/^\[offset:\s*(-?\d+)\s*\]/mi);
    var offset = off ? Number(off[1]) / 1000 : 0;
    var out = [];
    src.split('\n').forEach(function (raw) {
      var line = raw.trim(), m, stamps = [];
      while ((m = line.match(LINE_STAMP))) { stamps.push(stampSeconds(m)); line = line.slice(m[0].length).trim(); }
      if (!stamps.length) return;
      var words = null;
      if (/<\d{1,3}:\d{1,2}/.test(line)) {
        var pieces = [], last = 0, tag;
        WORD_STAMP.lastIndex = 0;
        var marks = [];
        while ((tag = WORD_STAMP.exec(line))) marks.push({ at: tag.index, end: WORD_STAMP.lastIndex, t: stampSeconds(tag) });
        marks.forEach(function (mk, i) {
          var chunk = line.slice(mk.end, i + 1 < marks.length ? marks[i + 1].at : line.length);
          var toks = chunk.trim().split(/\s+/).filter(Boolean);
          /* A tag may cover several words: spread them evenly up to the next tag. The last tag has no known end yet, so use a natural 0.3s per word. */
          var span = i + 1 < marks.length ? Math.max(MIN_WORD * toks.length, marks[i + 1].t - mk.t) : 0.3 * toks.length;
          toks.forEach(function (tok, k) {
            pieces.push({ text: tok, time: mk.t + span * k / toks.length, endTime: NaN });
          });
        });
        if (pieces.length) words = pieces;
      }
      var clean = line.replace(WORD_STAMP, '').replace(/\s+/g, ' ').trim();
      if (!clean) return;
      stamps.forEach(function (t) {
        var time = Math.max(0, t - offset);
        var item = { text: clean, time: time };
        if (words) item.words = words.map(function (w) { return { text: w.text, time: Math.max(0, w.time - offset), endTime: NaN }; });
        out.push(item);
      });
    });
    out.sort(function (a, b) { return a.time - b.time; });
    return out;
  }

  /* Plain lines (no stamps): evenly spaced as a rough starting point the user then edits or tap-syncs. */
  function parsePlain(text, step) {
    step = step || DEFAULT_TAIL;
    return String(text || '').replace(/\r/g, '').split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean)
      .map(function (t, i) { return { text: t, time: i * step }; });
  }

  /* Give every line an endTime and clean its words. */
  function finalize(lines, opts) {
    opts = opts || {};
    var list = (lines || []).filter(function (l) { return l && String(l.text || '').trim() && Number.isFinite(Number(l.time)); })
      .map(function (l) {
        var copy = { text: String(l.text).replace(/\s+/g, ' ').trim(), time: Math.max(0, Number(l.time)) };
        if (l.manualEnd && Number.isFinite(Number(l.endTime))) { copy.endTime = Number(l.endTime); copy.manualEnd = true; }
        if (Array.isArray(l.words) && l.words.length) copy.words = l.words;
        return copy;
      });
    list.sort(function (a, b) { return a.time - b.time; });
    list.forEach(function (l, i) {
      var next = list[i + 1];
      var nextTime = next ? next.time : NaN;
      var tail = Number.isFinite(opts.duration) && opts.duration > l.time ? Math.min(DEFAULT_TAIL, opts.duration - l.time) : DEFAULT_TAIL;
      if (l.manualEnd) l.endTime = Math.max(l.time + 0.2, l.endTime);
      else l.endTime = Number.isFinite(nextTime) && nextTime > l.time ? nextTime : l.time + Math.max(0.5, tail);
      if (l.words) {
        l.words = cleanWords(l.words, l.time, l.endTime);
        if (!l.words.length) delete l.words;
      }
    });
    return list;
  }

  /* Parse the lyrics textarea. Stamped LRC wins; otherwise plain lines. `prev` lets word timing survive text edits. */
  function parseText(text, prev, opts) {
    var synced = parseLrc(text);
    var lines = synced.length ? synced : parsePlain(text, opts && opts.step);
    var out = finalize(lines, opts);
    if (prev && prev.length) {
      out.forEach(function (l) {
        if (l.words) return;
        for (var i = 0; i < prev.length; i++) {
          var p = prev[i];
          if (p.words && p.words.length && p.text === l.text && Math.abs(p.time - l.time) < 0.0015) { l.words = p.words.map(function (w) { return { text: w.text, time: w.time, endTime: w.endTime }; }); break; }
        }
      });
    }
    return out;
  }

  function toLrc(lines, opts) {
    opts = opts || {};
    var rows = [];
    if (opts.meta) {
      if (opts.meta.title) rows.push('[ti:' + opts.meta.title + ']');
      if (opts.meta.artist) rows.push('[ar:' + opts.meta.artist + ']');
      if (opts.meta.album) rows.push('[al:' + opts.meta.album + ']');
    }
    (lines || []).forEach(function (l) {
      var body = l.text;
      if (opts.words && hasRealWords(l)) body = l.words.map(function (w) { return '<' + fmtStamp(w.time, 2) + '>' + w.text; }).join(' ');
      rows.push('[' + fmtStamp(l.time, opts.words ? 2 : 3) + '] ' + body);
    });
    return rows.join('\n') + '\n';
  }

  /* ---------- case ---------- */
  function applyCase(text, mode) {
    var s = String(text == null ? '' : text);
    switch (mode) {
      case 'upper': return s.toUpperCase();
      case 'lower': return s.toLowerCase();
      case 'title': return s.toLowerCase().replace(/(^|[\s\-(["'])(\p{L})/gu, function (_, p, c) { return p + c.toUpperCase(); });
      case 'sentence': return s.toLowerCase().replace(/(^\s*|[.!?]\s+)(\p{L})/gu, function (_, p, c) { return p + c.toUpperCase(); });
      default: return s;
    }
  }

  /* ---------- display modes ---------- */
  /* Display line list handed to the effects. mode: line | word | chunk | karaoke (karaoke = line + guaranteed word timing). */
  function displayLines(lines, opts) {
    opts = opts || {};
    var mode = opts.mode || 'line', caseMode = opts.caseMode || 'asis';
    var chunkSize = clamp(Math.round(num(opts.chunk, 3)), 1, 12);
    var src = lines || [];
    var out = [];
    var cs = function (t) { return caseMode === 'asis' ? t : applyCase(t, caseMode); };
    if (mode === 'line') {
      if (caseMode === 'asis') return src;
      return src.map(function (l) {
        var c = { text: cs(l.text), time: l.time, endTime: l.endTime };
        if (l.words) c.words = l.words.map(function (w) { return { text: cs(w.text), time: w.time, endTime: w.endTime }; });
        return c;
      });
    }
    src.forEach(function (l, i) {
      var next = src[i + 1];
      var words = wordsOf(l, next ? next.time : NaN).map(function (w) { return { text: cs(w.text), time: w.time, endTime: w.endTime }; });
      if (!words.length) return;
      if (mode === 'karaoke') { out.push({ text: cs(l.text), time: l.time, endTime: l.endTime, words: words }); return; }
      var size = mode === 'word' ? 1 : chunkSize;
      for (var k = 0; k < words.length; k += size) {
        var group = words.slice(k, k + size);
        out.push({ text: group.map(function (w) { return w.text; }).join(' '), time: group[0].time, endTime: group[group.length - 1].endTime, words: size > 1 ? group : undefined, _grp: true });
      }
    });
    if (mode === 'karaoke') return out;
    /* Hold each piece until the next one starts when they are close; otherwise let it linger briefly. */
    out.forEach(function (piece, i) {
      var next = out[i + 1];
      var natural = piece.endTime;
      if (next && next.time - natural < 0.6) piece.endTime = Math.max(natural, next.time);
      else piece.endTime = natural + 0.25;
      if (next && piece.endTime > next.time && next.time > piece.time) piece.endTime = next.time;
      delete piece._grp;
      if (!piece.words) delete piece.words;
    });
    return out;
  }

  /* ---------- editing helpers (all return new arrays) ---------- */
  function cloneLines(lines) {
    return (lines || []).map(function (l) {
      var c = { text: l.text, time: l.time, endTime: l.endTime };
      if (l.manualEnd) c.manualEnd = true;
      if (l.words) c.words = l.words.map(function (w) { return { text: w.text, time: w.time, endTime: w.endTime }; });
      return c;
    });
  }
  function shiftLine(line, dt) {
    var c = cloneLines([line])[0];
    c.time = Math.max(0, round3(c.time + dt));
    var applied = c.time - line.time;
    if (c.manualEnd) c.endTime = round3(c.endTime + applied);
    if (c.words) c.words.forEach(function (w) { w.time = round3(Math.max(0, w.time + applied)); w.endTime = round3(Math.max(w.time + MIN_WORD, w.endTime + applied)); });
    return c;
  }
  function shiftAll(lines, dt) {
    return finalize((lines || []).map(function (l) { return shiftLine(l, dt); }));
  }
  /* Move line i so it starts at t. Its words move with it. */
  function setLineStart(lines, i, t) {
    var out = cloneLines(lines);
    if (!out[i] || !Number.isFinite(t)) return finalize(out);
    out[i] = shiftLine(out[i], Math.max(0, t) - out[i].time);
    return finalize(out);
  }
  function setLineText(lines, i, text) {
    var out = cloneLines(lines);
    if (!out[i]) return finalize(out);
    var clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clean) { out.splice(i, 1); return finalize(out); }
    if (clean !== out[i].text) {
      var wasReal = !!out[i].words;
      out[i].text = clean;
      if (wasReal) {
        var old = out[i].words, tokens = clean.split(' ');
        /* Same word count: keep timing, swap the text (typo fix). Otherwise re-estimate over the same span. */
        if (old.length === tokens.length) old.forEach(function (w, k) { w.text = tokens[k]; });
        else out[i].words = estimateWords(clean, out[i].time, out[i].manualEnd ? out[i].endTime : (out[i + 1] ? out[i + 1].time : out[i].time + DEFAULT_TAIL));
      }
    }
    return finalize(out);
  }
  function insertLine(lines, after, text, t) {
    var out = cloneLines(lines);
    var base = out[after] ? out[after].time : (out.length ? out[out.length - 1].time : 0);
    var nextT = out[after + 1] ? out[after + 1].time : base + 2 * DEFAULT_TAIL;
    var time = Number.isFinite(t) ? t : (base + nextT) / 2;
    out.splice(after + 1, 0, { text: String(text || 'New line'), time: Math.max(0, time) });
    return finalize(out);
  }
  function removeLine(lines, i) {
    var out = cloneLines(lines);
    out.splice(i, 1);
    return finalize(out);
  }
  function mergeWithNext(lines, i) {
    var out = cloneLines(lines);
    if (!out[i] || !out[i + 1]) return finalize(out);
    var a = out[i], b = out[i + 1];
    var wa = hasRealWords(a) ? a.words : null, wb = hasRealWords(b) ? b.words : null;
    a.text = a.text + ' ' + b.text;
    if (wa && wb) a.words = wa.concat(wb); else delete a.words;
    if (b.manualEnd) { a.endTime = b.endTime; a.manualEnd = true; }
    out.splice(i + 1, 1);
    return finalize(out);
  }
  /* Split line i before word index k (0 < k < words). Uses real word timing when present, otherwise an estimate. */
  function splitAtWord(lines, i, k) {
    var out = cloneLines(lines);
    var l = out[i];
    if (!l) return finalize(out);
    var next = out[i + 1];
    var words = wordsOf(l, next ? next.time : NaN);
    if (k <= 0 || k >= words.length) return finalize(out);
    var real = hasRealWords(l);
    var left = { text: words.slice(0, k).map(function (w) { return w.text; }).join(' '), time: l.time };
    var right = { text: words.slice(k).map(function (w) { return w.text; }).join(' '), time: words[k].time };
    if (real) { left.words = words.slice(0, k); right.words = words.slice(k); }
    out.splice(i, 1, left, right);
    return finalize(out);
  }
  function setWordStart(lines, i, k, t) {
    var out = cloneLines(lines);
    var l = out[i];
    if (!l || !Number.isFinite(t)) return finalize(out);
    var next = out[i + 1];
    if (!hasRealWords(l)) l.words = estimateWords(l.text, l.time, l.manualEnd ? l.endTime : (next ? next.time : l.time + DEFAULT_TAIL));
    if (!l.words[k]) return finalize(out);
    var lo = k > 0 ? l.words[k - 1].time + 0.01 : 0;
    var hi = k + 1 < l.words.length ? l.words[k + 1].time - 0.01 : Infinity;
    l.words[k].time = round3(clamp(t, lo, hi));
    l.words[k].endTime = NaN;
    if (k > 0) l.words[k - 1].endTime = NaN;
    if (k === 0) { l.time = Math.min(l.time, l.words[0].time); }
    return finalize(out);
  }
  function estimateLineWords(lines, i) {
    var out = cloneLines(lines);
    var l = out[i];
    if (!l) return finalize(out);
    var next = out[i + 1];
    l.words = estimateWords(l.text, l.time, l.manualEnd ? l.endTime : (next ? next.time : l.time + DEFAULT_TAIL));
    return finalize(out);
  }
  function clearLineWords(lines, i) {
    var out = cloneLines(lines);
    if (out[i]) delete out[i].words;
    return finalize(out);
  }

  /* Lyrics given as plain text → timed lines spread across `duration` (a rough draft to refine with tap-sync). */
  function autoTimePlain(text, duration, firstAt) {
    var rows = String(text || '').replace(/\r/g, '').split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (!rows.length) return [];
    var start = Math.max(0, num(firstAt, 0));
    var span = Math.max(rows.length * 1.5, num(duration, rows.length * DEFAULT_TAIL) - start - 2);
    var weights = rows.map(function (r) { return Math.max(8, r.length); });
    var total = weights.reduce(function (a, b) { return a + b; }, 0), cursor = 0;
    return finalize(rows.map(function (r, i) {
      var t = start + span * cursor / total;
      cursor += weights[i];
      return { text: r, time: round3(t) };
    }), { duration: duration });
  }

  /* ---------- transcription output → lines ---------- */
  /* words: [{ text, start, end }] from a speech model. Breaks lines on silence, sentence ends and length. */
  function wordsToLines(words, opts) {
    opts = opts || {};
    var gap = num(opts.gap, 0.8), maxWords = num(opts.maxWords, 9), maxChars = num(opts.maxChars, 46);
    var lines = [], cur = [];
    function flush() {
      if (!cur.length) return;
      var ws = cur.map(function (w) { return { text: w.text, time: w.time, endTime: w.endTime }; });
      lines.push({ text: ws.map(function (w) { return w.text; }).join(' '), time: ws[0].time, endTime: ws[ws.length - 1].endTime, manualEnd: true, words: ws });
      cur = [];
    }
    var cleaned = (words || []).map(function (w) {
      var t = String(w.text == null ? '' : w.text).trim();
      var s = num(w.start != null ? w.start : w.time, NaN), e = num(w.end != null ? w.end : w.endTime, NaN);
      return { text: t, time: s, endTime: e };
    }).filter(function (w) { return w.text && Number.isFinite(w.time); });
    cleaned.forEach(function (w, i) {
      var prev = cur[cur.length - 1];
      if (prev) {
        var prevEnd = Number.isFinite(prev.endTime) ? prev.endTime : prev.time;
        var chars = cur.reduce(function (n, x) { return n + x.text.length + 1; }, 0);
        var sentenceEnd = /[.!?…]["')\]]?$/.test(prev.text) && cur.length >= 4;
        if (w.time - prevEnd >= gap || cur.length >= maxWords || chars + w.text.length > maxChars || sentenceEnd) flush();
      }
      cur.push(w);
    });
    flush();
    return finalize(lines);
  }

  /* ---------- exports ---------- */
  /* SRT cues. The last cue is clipped so it never overlaps the next one. */
  function toSrt(lines, opts) {
    opts = opts || {};
    var shown = displayLines(lines, { mode: opts.mode || 'line', chunk: opts.chunk, caseMode: opts.caseMode });
    var maxLen = num(opts.maxCue, 7);
    var cues = [];
    shown.forEach(function (l, i) {
      var next = shown[i + 1];
      var start = l.time;
      var end = hasRealWords(l) ? Math.max(l.endTime, l.words[l.words.length - 1].endTime) : l.endTime;
      if (!(end > start)) end = start + 1.5;
      end = Math.min(end, start + maxLen);
      if (next && end > next.time - 0.001 && next.time > start) end = Math.max(start + 0.2, next.time - 0.001);
      cues.push((cues.length + 1) + '\n' + srtStamp(start) + ' --> ' + srtStamp(end) + '\n' + l.text + '\n');
    });
    return cues.join('\n');
  }

  function toTimedJson(lines, meta) {
    meta = meta || {};
    var src = lines || [];
    return JSON.stringify({
      format: 'kefe-timed-lyrics',
      version: 1,
      title: meta.title || '',
      artist: meta.artist || '',
      album: meta.album || '',
      duration: Number.isFinite(meta.duration) ? round3(meta.duration) : null,
      offset: round3(num(meta.offset, 0)),
      lines: src.map(function (l, i) {
        var next = src[i + 1];
        var real = hasRealWords(l);
        return {
          index: i,
          start: round3(l.time),
          end: round3(l.endTime),
          text: l.text,
          wordTiming: real ? 'measured' : 'estimated',
          words: wordsOf(l, next ? next.time : NaN).map(function (w) { return { text: w.text, start: round3(w.time), end: round3(w.endTime) }; })
        };
      })
    }, null, 2);
  }

  root.kefeLyricModel = {
    fmtStamp: fmtStamp, fmtLrc: fmtLrc, parseStamp: parseStamp, srtStamp: srtStamp,
    estimateWords: estimateWords, wordsOf: wordsOf, hasRealWords: hasRealWords,
    parseLrc: parseLrc, parsePlain: parsePlain, parseText: parseText, finalize: finalize,
    toLrc: toLrc, toSrt: toSrt, toTimedJson: toTimedJson,
    applyCase: applyCase, displayLines: displayLines,
    cloneLines: cloneLines, shiftAll: shiftAll, setLineStart: setLineStart, setLineText: setLineText,
    insertLine: insertLine, removeLine: removeLine, mergeWithNext: mergeWithNext, splitAtWord: splitAtWord,
    setWordStart: setWordStart, estimateLineWords: estimateLineWords, clearLineWords: clearLineWords,
    autoTimePlain: autoTimePlain, wordsToLines: wordsToLines
  };
})(typeof window !== 'undefined' ? window : globalThis);
