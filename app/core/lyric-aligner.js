/* KEFE Lyric ↔ Media Audio Aligner
 *
 * Aligns already-resolved synced lyrics against the actual audio track of
 * the loaded master media. It corrects timing only; lyric text is preserved.
 */
(() => {
    'use strict';

    if (window.kefeLyricAligner) return;

    const MIN_MATCHES = 3;
    const MAX_WORD_GAP = 8;
    const MAX_ANCHOR_DRIFT = 3.5;

    const normalise = value => String(value || '')
        .toLowerCase()
        .replace(/['’]/g, '')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    function wordsFromLines(lines) {
        const out = [];
        (lines || []).forEach((line, lineIndex) => {
            const words = normalise(line.text).split(' ').filter(Boolean);
            words.forEach(text => out.push({ text, lineIndex }));
        });
        return out;
    }

    function transcriptWords(words) {
        return (words || [])
            .map((word, index) => ({
                text: normalise(word.text),
                start: Number(word.start),
                end: Number(word.end),
                index
            }))
            .filter(word => word.text && Number.isFinite(word.start));
    }

    function similarity(a, b) {
        if (!a || !b) return 0;
        if (a === b) return 1;
        if (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a))) return 0.78;
        return 0;
    }

    /*
     * Find ordered lyric/transcript anchors. We deliberately use short
     * sequential runs rather than global fuzzy matching so repeated choruses
     * don't get incorrectly paired with one another.
     */
    function findAnchors(lines, transcript) {
        const lyricWords = wordsFromLines(lines);
        const words = transcriptWords(transcript);
        const anchors = [];

        if (!lyricWords.length || !words.length) return anchors;

        let searchFrom = 0;

        for (let li = 0; li < lyricWords.length; li++) {
            const target = lyricWords[li].text;
            let best = null;

            const limit = Math.min(words.length, searchFrom + 80);

            for (let wi = searchFrom; wi < limit; wi++) {
                const score = similarity(target, words[wi].text);
                if (!score) continue;

                let run = score;
                let lyricCursor = li + 1;
                let wordCursor = wi + 1;

                while (
                    lyricCursor < lyricWords.length &&
                    wordCursor < words.length &&
                    lyricWords[lyricCursor].lineIndex === lyricWords[li].lineIndex &&
                    wordCursor < wi + 12
                ) {
                    const s = similarity(lyricWords[lyricCursor].text, words[wordCursor].text);
                    if (!s) break;
                    run += s;
                    lyricCursor++;
                    wordCursor++;
                }

                if (!best || run > best.score) {
                    best = { lyricIndex: li, wordIndex: wi, score: run };
                }
            }

            if (!best || best.score < 1.8) continue;

            const lyric = lyricWords[best.lyricIndex];
            const media = words[best.wordIndex];

            anchors.push({
                lineIndex: lyric.lineIndex,
                lyricTime: Number(lines[lyric.lineIndex].time) || 0,
                mediaTime: media.start,
                score: best.score
            });

            searchFrom = Math.min(words.length, best.wordIndex + 1);
        }

        return anchors;
    }

    function median(values) {
        const sorted = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
        if (!sorted.length) return 0;
        return sorted[Math.floor(sorted.length / 2)];
    }

    function interpolateTime(time, anchors) {
        if (anchors.length < 2) return null;

        if (time <= anchors[0].lyricTime) {
            const a = anchors[0], b = anchors[1];
            const slope = (b.mediaTime - a.mediaTime) / Math.max(0.001, b.lyricTime - a.lyricTime);
            return a.mediaTime + (time - a.lyricTime) * slope;
        }

        for (let i = 0; i < anchors.length - 1; i++) {
            const a = anchors[i], b = anchors[i + 1];
            if (time <= b.lyricTime) {
                const span = Math.max(0.001, b.lyricTime - a.lyricTime);
                const fraction = (time - a.lyricTime) / span;
                return a.mediaTime + (b.mediaTime - a.mediaTime) * fraction;
            }
        }

        const a = anchors[anchors.length - 2];
        const b = anchors[anchors.length - 1];
        const slope = (b.mediaTime - a.mediaTime) / Math.max(0.001, b.lyricTime - a.lyricTime);
        return b.mediaTime + (time - b.lyricTime) * slope;
    }

    function align(lines, transcript, duration = 0) {
        const source = Array.isArray(lines) ? lines : [];
        const anchors = findAnchors(source, transcript);

        if (anchors.length < MIN_MATCHES) {
            return {
                aligned: false,
                confidence: 0,
                offset: 0,
                anchors: anchors.length,
                lines: source
            };
        }

        const offsets = anchors.map(a => a.mediaTime - a.lyricTime);
        const globalOffset = median(offsets);

        const correctedAnchors = anchors.filter(a =>
            Math.abs((a.mediaTime - a.lyricTime) - globalOffset) <= MAX_ANCHOR_DRIFT
        );

        if (correctedAnchors.length < MIN_MATCHES) {
            return {
                aligned: false,
                confidence: 0,
                offset: globalOffset,
                anchors: anchors.length,
                lines: source
            };
        }

        const corrected = source.map((line, index) => {
            const original = Math.max(0, Number(line.time) || 0);

            let nextTime;

            if (correctedAnchors.length >= 4) {
                nextTime = interpolateTime(original, correctedAnchors);
            } else {
                nextTime = original + globalOffset;
            }

            if (!Number.isFinite(nextTime)) nextTime = original + globalOffset;

            const safe = Math.max(0, nextTime);
            return {
                ...line,
                time: duration > 0 ? Math.min(safe, duration) : safe,
                source: line.source || 'LRCLIB',
                alignment: 'media-audio'
            };
        });

        for (let i = 0; i < corrected.length; i++) {
            const next = corrected[i + 1];
            corrected[i].endTime = next
                ? Math.max(corrected[i].time + 0.05, next.time)
                : Math.max(corrected[i].time + 0.05, Number(corrected[i].endTime) || corrected[i].time + 3);
        }

        const residuals = correctedAnchors.map(a => {
            const mapped = interpolateTime(a.lyricTime, correctedAnchors);
            return Number.isFinite(mapped) ? Math.abs(mapped - a.mediaTime) : 0;
        });

        const error = median(residuals);
        const confidence = Math.max(
            0,
            Math.min(
                1,
                (correctedAnchors.length / Math.max(MIN_MATCHES, Math.min(source.length, 12))) *
                Math.max(0, 1 - error / 2)
            )
        );

        return {
            aligned: confidence >= 0.45,
            confidence,
            offset: globalOffset,
            anchors: correctedAnchors.length,
            error,
            lines: corrected
        };
    }

    window.kefeLyricAligner = Object.freeze({
        version: 1,
        align
    });
})();
