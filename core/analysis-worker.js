/* KEFE Analysis Worker
 * Deterministic lyric/timeline analysis kept off the editor main thread.
 */
'use strict';

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

function parseLrc(text) {
    const lines = [];
    String(text || '').split(/\r?\n/).forEach((raw, index) => {
        const matches = [...raw.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
        const lyric = raw.replace(/\[[^\]]+\]/g, '').trim();
        if (!matches.length || !lyric) return;
        matches.forEach(match => {
            const fraction = match[3] ? Number(`0.${String(match[3]).padEnd(3, '0')}`) : 0;
            lines.push({ time: Number(match[1]) * 60 + Number(match[2]) + fraction, text: lyric, sourceLine: index + 1, source: 'LRC' });
        });
    });
    lines.sort((a, b) => a.time - b.time);
    const cleaned = [];
    for (const line of lines) {
        const previous = cleaned.at(-1);
        if (previous && Math.abs(previous.time - line.time) < 0.001 && previous.text === line.text) continue;
        cleaned.push(line);
    }
    return cleaned;
}

function estimateWords(text, startMs, endMs) {
    const tokens = String(text || '').trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) return [];
    const span = Math.max(120, endMs - startMs);
    const weights = tokens.map(token => {
        const letters = Array.from(token.replace(/[^\p{L}\p{N}]/gu, '')).length || 1;
        return Math.max(0.75, Math.pow(letters, 0.72)) + (/[,.!?;:]$/.test(token) ? 0.2 : 0);
    });
    const total = weights.reduce((sum, value) => sum + value, 0) || tokens.length;
    let cursor = 0;
    return tokens.map((text, index) => {
        const from = startMs + span * cursor / total;
        cursor += weights[index];
        const to = startMs + span * cursor / total;
        return { text, startMs: from, endMs: Math.max(from + 30, to), estimated: true };
    });
}

function canonicalTimeline(lines, duration = 0) {
    const source = Array.isArray(lines) ? lines : [];
    const result = source.map((line, index) => {
        const startMs = Math.max(0, Math.round((Number(line.time) || 0) * 1000));
        const nextMs = index < source.length - 1 ? Math.max(startMs + 1, Math.round((Number(source[index + 1].time) || 0) * 1000)) : 0;
        const endMs = nextMs || (duration > startMs ? Math.min(duration, startMs + 5000) : startMs + 3000);
        return {
            startMs,
            endMs: Math.max(startMs + 1, endMs),
            text: line.text,
            words: estimateWords(line.text, startMs, Math.max(startMs + 120, endMs)),
            source: line.source || 'LRC'
        };
    });
    for (let i = 0; i < result.length - 1; i++) result[i].endMs = Math.min(result[i].endMs, result[i + 1].startMs);
    return { version: 2, durationMs: Number(duration) || 0, lines: result };
}

function validateLyrics(lines, duration = 0) {
    const gaps = [];
    const overlaps = [];
    for (let i = 1; i < lines.length; i++) {
        const delta = lines[i].time - lines[i - 1].time;
        if (delta > 12) gaps.push({ from: lines[i - 1].time, to: lines[i].time, seconds: delta });
        if (delta < 0) overlaps.push({ from: lines[i].time, to: lines[i - 1].time });
    }
    const lateLines = duration > 0 ? lines.filter(line => line.time > duration).length : 0;
    const activeSpan = lines.length > 1 ? lines.at(-1).time - lines[0].time : 0;
    const averageGap = lines.length > 1 ? activeSpan / (lines.length - 1) : 0;
    const wordCount = lines.reduce((sum, line) => sum + String(line.text || '').trim().split(/\s+/).filter(Boolean).length, 0);
    const charCount = lines.reduce((sum, line) => sum + String(line.text || '').length, 0);
    return {
        count: lines.length,
        wordCount,
        charCount,
        firstTime: lines[0]?.time ?? null,
        lastTime: lines.at(-1)?.time ?? null,
        gaps,
        overlaps,
        lateLines,
        averageGap,
        wordsPerLine: lines.length ? wordCount / lines.length : 0,
        coverage: duration > 0 && lines.length ? clamp(activeSpan / duration, 0, 1) : 0
    };
}

function detectSections(lines) {
    const sections = [];
    for (let i = 0; i < lines.length; i++) {
        const text = String(lines[i].text || '').trim();
        const normal = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').trim();
        const prior = lines.slice(Math.max(0, i - 12), i).map(x => String(x.text || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').trim());
        const repeatIndex = prior.indexOf(normal);
        if (normal && repeatIndex >= 0 && i - (i - 12 + repeatIndex) >= 4) {
            sections.push({ type: 'repeat', startIndex: i, confidence: 0.72 });
        }
    }
    return sections;
}

function recommendStyle({ duration = 0, lineCount = 0, averageGap = 0, textLength = 0 }) {
    const density = duration > 0 ? lineCount / duration : 0;
    if (density > 0.12 || averageGap < 1.2) return 'pulse';
    if (density < 0.025 || averageGap > 7) return 'drift';
    if (textLength > lineCount * 34) return 'fadeup';
    return 'apple';
}

self.onmessage = event => {
    const { id, type, payload = {} } = event.data || {};
    try {
        if (type === 'lyrics') {
            const lines = parseLrc(payload.text || '');
            const duration = Number(payload.duration) || 0;
            const validation = validateLyrics(lines, duration);
            const timeline = canonicalTimeline(lines, duration * 1000);
            const sections = detectSections(lines);
            const recommendation = recommendStyle({ duration, lineCount: lines.length, averageGap: validation.averageGap, textLength: validation.charCount });
            self.postMessage({ id, ok: true, type, result: { lines, timeline, validation, sections, recommendation } });
            return;
        }
        if (type === 'project') {
            const text = String(payload.lyricsText || '');
            const duration = Number(payload.duration) || 0;
            const lines = parseLrc(text);
            const validation = validateLyrics(lines, duration);
            const timeline = canonicalTimeline(lines, duration * 1000);
            const sections = detectSections(lines);
            self.postMessage({ id, ok: true, type, result: {
                lyrics: { lines, timeline, validation, sections },
                recommendation: recommendStyle({ duration, lineCount: lines.length, averageGap: validation.averageGap, textLength: validation.charCount })
            }});
            return;
        }
        throw new Error(`Unknown analysis task: ${type}`);
    } catch (error) {
        self.postMessage({ id, ok: false, error: error?.message || String(error) });
    }
};
