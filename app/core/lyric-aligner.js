/* KEFE Lyric ↔ Media Audio Aligner — DTW edition.
 *
 * Aligns a reference lyric timeline against the actual audio of the loaded
 * master media using Dynamic Time Warping.
 *
 * Pipeline:
 *   1. Whisper transcribes the audio, returning word-level timestamps.
 *   2. Reference lyrics are tokenised into a comparable sequence.
 *   3. A cost matrix measures text similarity between every transcript word
 *      and every lyric word.
 *   4. DTW finds the globally optimal monotonic alignment path.
 *   5. Each lyric word inherits a timestamp from its matched transcript word.
 *   6. Unmatched words (skipped, repeated, ad-libs) are interpolated between
 *      neighbouring anchors.
 *
 * This is the same approach used by syncalong, tuidra, and similar tools.
 * It handles the "song starts 90 seconds in" problem automatically because
 * DTW finds the optimal path regardless of offset.
 */
(function(){
  'use strict';
  if (window.kefeLyricAligner && window.kefeLyricAligner.version === 2) return;

  /* ---------------- text normalisation ---------------- */
  function normalise(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/['’`]/g, '')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function tokensFromText(text) {
    const norm = normalise(text);
    return norm ? norm.split(' ') : [];
  }

  /* ---------------- token shapes ----------------
     A "token" is { text, start, end, lineIndex, wordIndex }.
     Transcript tokens have real timestamps; lyric tokens get filled in by DTW. */
  function tokeniseLyrics(lines) {
    const out = [];
    (lines || []).forEach(function(line, li){
      const words = String(line && line.text || '').trim().split(/\s+/).filter(Boolean);
      words.forEach(function(w, wi){
        const t = normalise(w);
        if (!t) return;
        out.push({
          text: t,
          raw: w,
          lineIndex: li,
          wordIndex: wi,
          start: null,
          end: null
        });
      });
    });
    return out;
  }

  function tokeniseTranscript(words) {
    const out = [];
    (words || []).forEach(function(w, i){
      const t = normalise(w && w.text);
      if (!t) return;
      const start = Number(w.start);
      const end = Number(w.end);
      if (!Number.isFinite(start)) return;
      out.push({
        text: t,
        start: start,
        end: Number.isFinite(end) && end > start ? end : start + 0.3,
        index: i
      });
    });
    return out;
  }

  /* ---------------- similarity ----------------
     Returns a distance in [0, 1]: 0 = perfect match, 1 = nothing in common.
     Uses character-level edit distance (Levenshtein) with a phonetic
     fallback (first letter + length) for near-misses. */
  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a) return b.length;
    if (!b) return a.length;
    const m = a.length, n = b.length;
    let prev = new Array(n + 1);
    let curr = new Array(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
      curr[0] = i;
      for (let j = 1; j <= n; j++) {
        const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        curr[j] = Math.min(
          prev[j] + 1,        // deletion
          curr[j - 1] + 1,    // insertion
          prev[j - 1] + cost  // substitution
        );
      }
      const tmp = prev; prev = curr; curr = tmp;
    }
    return prev[n];
  }

  function tokenDistance(a, b) {
    if (!a || !b) return 1;
    if (a === b) return 0;
    const maxLen = Math.max(a.length, b.length) || 1;
    const lev = levenshtein(a, b) / maxLen;
    // Phonetic shortcut: same first letter and similar length often means
    // Whisper misheard a vowel. Nudge the distance down.
    if (a[0] === b[0] && Math.abs(a.length - b.length) <= 1) {
      return Math.min(lev, lev * 0.7);
    }
    return lev;
  }

  /* ---------------- DTW ----------------
     Builds a cost matrix between lyricTokens (rows) and transcriptTokens
     (columns), then traces the minimum-cost monotonic path.
     Returns an array of pairs: [{ lyricIndex, transcriptIndex }]. */
  function dtw(lyricTokens, transcriptTokens) {
    const N = lyricTokens.length;
    const M = transcriptTokens.length;
    if (!N || !M) return [];

    // Precompute per-pair cost so we don't do it repeatedly.
    const cost = new Float32Array(N * M);
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < M; j++) {
        cost[i * M + j] = tokenDistance(lyricTokens[i].text, transcriptTokens[j].text);
      }
    }

    // Accumulated cost. Use Infinity for the border so paths stay in bounds.
    const D = new Float32Array(N * M);
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < M; j++) {
        const c = cost[i * M + j];
        let minPrev;
        if (i === 0 && j === 0) minPrev = 0;
        else if (i === 0) minPrev = D[i * M + (j - 1)];
        else if (j === 0) minPrev = D[(i - 1) * M + j];
        else {
          const a = D[(i - 1) * M + (j - 1)];  // diagonal
          const b = D[(i - 1) * M + j];        // up (skip transcript)
          const cUp = D[i * M + (j - 1)];      // left (skip lyric)
          minPrev = Math.min(a, b, cUp);
        }
        D[i * M + j] = c + minPrev;
      }
    }

    // Backtrace from bottom-right to top-left.
    const path = [];
    let i = N - 1, j = M - 1;
    while (i >= 0 && j >= 0) {
      path.push({ lyricIndex: i, transcriptIndex: j });
      if (i === 0 && j === 0) break;
      let move;
      if (i === 0) move = 'left';
      else if (j === 0) move = 'up';
      else {
        const a = D[(i - 1) * M + (j - 1)];
        const b = D[(i - 1) * M + j];
        const c = D[i * M + (j - 1)];
        const m = Math.min(a, b, c);
        if (m === a) move = 'diag';
        else if (m === b) move = 'up';
        else move = 'left';
      }
      if (move === 'diag') { i--; j--; }
      else if (move === 'up') { i--; }
      else { j--; }
    }
    path.reverse();
    return path;
  }

  /* ---------------- anchor extraction ----------------
     From the DTW path, keep only the pairs where the match is actually
     good (distance below a threshold). Those become trusted anchors. */
  function anchorsFromPath(path, lyricTokens, transcriptTokens, maxDistance) {
    const anchors = [];
    for (let k = 0; k < path.length; k++) {
      const { lyricIndex, transcriptIndex } = path[k];
      const d = tokenDistance(lyricTokens[lyricIndex].text, transcriptTokens[transcriptIndex].text);
      if (d <= maxDistance) {
        anchors.push({
          lyricIndex: lyricIndex,
          transcriptIndex: transcriptIndex,
          distance: d,
          transcriptStart: transcriptTokens[transcriptIndex].start,
          transcriptEnd: transcriptTokens[transcriptIndex].end
        });
      }
    }
    // Deduplicate anchors that map to the same lyric word from different
    // transcript positions — keep the best match.
    const byLyric = new Map();
    for (const a of anchors) {
      const existing = byLyric.get(a.lyricIndex);
      if (!existing || a.distance < existing.distance) byLyric.set(a.lyricIndex, a);
    }
    return Array.from(byLyric.values()).sort((a, b) => a.lyricIndex - b.lyricIndex);
  }

  /* ---------------- interpolation ----------------
     Fill unmatched lyric tokens by linear interpolation between the nearest
     anchor before and after. Tokens before the first anchor get pulled back
     proportionally. Tokens after the last anchor get pushed forward. */
  function interpolateAnchors(anchors, lyricTokenCount, fallbackDuration) {
    if (!anchors.length) return new Array(lyricTokenCount).fill(null);

    const starts = new Array(lyricTokenCount).fill(null);
    const ends = new Array(lyricTokenCount).fill(null);

    for (const a of anchors) {
      starts[a.lyricIndex] = a.transcriptStart;
      ends[a.lyricIndex] = a.transcriptEnd;
    }

    // Left of the first anchor: extrapolate backwards from the first two
    // anchors if there are at least two; otherwise use the first anchor's
    // start minus a fixed per-word estimate.
    const first = anchors[0];
    const perWord = anchors.length > 1
      ? Math.max(0.12, (anchors[1].transcriptStart - first.transcriptStart) / Math.max(1, anchors[1].lyricIndex - first.lyricIndex))
      : 0.25;
    for (let i = first.lyricIndex - 1; i >= 0; i--) {
      starts[i] = Math.max(0, first.transcriptStart - (first.lyricIndex - i) * perWord);
      ends[i] = starts[i] + perWord;
    }

    // Between anchors: linear interpolation.
    for (let k = 0; k < anchors.length - 1; k++) {
      const a = anchors[k], b = anchors[k + 1];
      const gap = b.lyricIndex - a.lyricIndex;
      if (gap <= 1) continue;
      const tSpan = b.transcriptStart - a.transcriptEnd;
      const perT = tSpan > 0 ? tSpan / gap : perWord;
      for (let i = a.lyricIndex + 1; i < b.lyricIndex; i++) {
        const step = i - a.lyricIndex;
        starts[i] = a.transcriptEnd + perT * step;
        ends[i] = a.transcriptEnd + perT * (step + 1);
      }
    }

    // Right of the last anchor: extrapolate forward from the last two.
    const last = anchors[anchors.length - 1];
    const lastGapWords = anchors.length > 1
      ? last.lyricIndex - anchors[anchors.length - 2].lyricIndex
      : 1;
    const tailPerWord = anchors.length > 1
      ? Math.max(0.12, (last.transcriptStart - anchors[anchors.length - 2].transcriptStart) / Math.max(1, lastGapWords))
      : 0.25;
    for (let i = last.lyricIndex + 1; i < lyricTokenCount; i++) {
      starts[i] = last.transcriptEnd + (i - last.lyricIndex - 1) * tailPerWord;
      ends[i] = starts[i] + tailPerWord;
    }

    // If nothing had a duration, fall back to a flat estimate.
    if (typeof fallbackDuration === 'number' && fallbackDuration > 0) {
      const lastEnd = ends[lyricTokenCount - 1] || 0;
      if (lastEnd > fallbackDuration * 1.5) {
        // Something's wrong with the extrapolation — clamp everything.
        const scale = fallbackDuration / lastEnd;
        for (let i = 0; i < lyricTokenCount; i++) {
          if (starts[i] != null) starts[i] *= scale;
          if (ends[i] != null) ends[i] *= scale;
        }
      }
    }

    return starts.map((s, i) => ({ start: s, end: ends[i] }));
  }

  /* ---------------- main align ---------------- */
  async function align(lines, transcript, duration) {
    const source = Array.isArray(lines) ? lines : [];
    if (!source.length) {
      return { aligned: false, reason: 'no-lyrics', lines: source, confidence: 0, anchors: 0 };
    }
    const lyricTokens = tokeniseLyrics(source);
    const transcriptTokens = tokeniseTranscript(transcript);
    if (!lyricTokens.length || !transcriptTokens.length) {
      return { aligned: false, reason: 'no-match-inputs', lines: source, confidence: 0, anchors: 0 };
    }

    const path = dtw(lyricTokens, transcriptTokens);
    // Distance threshold: 0.45 accepts phonetic near-misses while rejecting
    // genuinely wrong words.
    const anchors = anchorsFromPath(path, lyricTokens, transcriptTokens, 0.45);

    if (anchors.length < 3) {
      return {
        aligned: false,
        reason: 'too-few-anchors',
        lines: source,
        confidence: 0,
        anchors: anchors.length
      };
    }

    // Confidence = anchor count relative to lyric length, weighted by
    // average match quality.
    const avgDist = anchors.reduce((s, a) => s + a.distance, 0) / anchors.length;
    const coverage = Math.min(1, anchors.length / Math.max(3, lyricTokens.length * 0.4));
    const quality = Math.max(0, 1 - avgDist / 0.5);
    const confidence = Math.max(0, Math.min(1, coverage * 0.6 + quality * 0.4));

    // Interpolated per-word timestamps.
    const wordTimes = interpolateAnchors(anchors, lyricTokens.length, duration);

    // Rebuild the lyric lines with new word times.
    const newLines = source.map((line, li) => {
      const lineWords = [];
      for (let i = 0; i < lyricTokens.length; i++) {
        if (lyricTokens[i].lineIndex !== li) continue;
        const t = wordTimes[i];
        if (!t || t.start == null) continue;
        lineWords.push({
          text: lyricTokens[i].raw,
          start: t.start,
          end: t.end != null && t.end > t.start ? t.end : t.start + 0.25
        });
      }
      const first = lineWords[0];
      const last = lineWords[lineWords.length - 1];
      return {
        ...line,
        time: first ? first.start : line.time,
        endTime: last ? last.end : (line.endTime || line.time + 3),
        words: lineWords.length ? lineWords : line.words,
        source: line.source || 'LRCLIB',
        alignment: 'dtw'
      };
    });

    // Enforce monotonic ordering across the whole timeline.
    for (let i = 1; i < newLines.length; i++) {
      if (newLines[i].time < newLines[i - 1].endTime) {
        newLines[i].time = newLines[i - 1].endTime;
      }
      newLines[i].endTime = Math.max(newLines[i].time + 0.05, newLines[i].endTime);
    }

    return {
      aligned: confidence >= 0.35,
      confidence: confidence,
      anchors: anchors.length,
      reason: 'dtw',
      lines: newLines
    };
  }

  window.kefeLyricAligner = {
    version: 2,
    align: align
  };

  console.log('[KEFE] lyric aligner v2 (DTW) loaded');
})();
