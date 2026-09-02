/* KEFE Analysis Worker
 * Keeps inexpensive project analysis off the editor's main thread.
 * No DOM, network, or media decoding dependencies.
 */
'use strict';

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

function parseLrc(text) {
    const lines = [];
    String(text || '').split(/\r?\n/).forEach((raw, index) => {
        const matches = [...raw.matchAll(/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
        const lyric = raw.replace(/\[[^\]]+\]/g, '').trim();
        if (!matches.length || !lyric) return;
        matches.forEach(match => {
            const minutes = Number(match[1]);
            const seconds = Number(match[2]);
            const fraction = match[3] ? Number(`0.${String(match[3]).padEnd(3, '0')}`) : 0;
            lines.push({ time: minutes * 60 + seconds + fraction, text: lyric, sourceLine: index + 1 });
        });
    });
    lines.sort((a, b) => a.time - b.time);
    const cleaned = [];
    for (const line of lines) {
        if (cleaned.length && Math.abs(cleaned[cleaned.length - 1].time - line.time) < 0.001 && cleaned[cleaned.length - 1].text === line.text) continue;
        cleaned.push(line);
    }
    return cleaned.map((line, i) => ({ ...line, duration: Math.max(0, (cleaned[i + 1]?.time ?? line.time) - line.time) }));
}

function validateLyrics(lines, duration = 0) {
    const gaps = [];
    const overlaps = [];
    let previous = null;
    for (const line of lines) {
        if (previous) {
            const delta = line.time - previous.time;
            if (delta > 12) gaps.push({ from: previous.time, to: line.time, seconds: delta });
            if (delta < 0) overlaps.push({ from: line.time, to: previous.time });
        }
        previous = line;
    }
    const lateLines = duration > 0 ? lines.filter(line => line.time > duration).length : 0;
    return {
        count: lines.length,
        firstTime: lines[0]?.time ?? null,
        lastTime: lines.at(-1)?.time ?? null,
        gaps,
        overlaps,
        lateLines,
        coverage: duration > 0 && lines.length ? clamp((lines.at(-1).time - lines[0].time) / duration, 0, 1) : 0
    };
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
            const validation = validateLyrics(lines, Number(payload.duration) || 0);
            const averageGap = lines.length > 1 ? (lines.at(-1).time - lines[0].time) / (lines.length - 1) : 0;
            const recommendation = recommendStyle({ duration: Number(payload.duration) || 0, lineCount: lines.length, averageGap, textLength: lines.reduce((sum, line) => sum + line.text.length, 0) });
            self.postMessage({ id, ok: true, type, result: { lines, validation, recommendation } });
            return;
        }
        if (type === 'project') {
            const text = String(payload.lyricsText || '');
            const lines = parseLrc(text);
            const validation = validateLyrics(lines, Number(payload.duration) || 0);
            const averageGap = lines.length > 1 ? (lines.at(-1).time - lines[0].time) / (lines.length - 1) : 0;
            self.postMessage({ id, ok: true, type, result: {
                lyrics: { lines, validation },
                recommendation: recommendStyle({ duration: Number(payload.duration) || 0, lineCount: lines.length, averageGap, textLength: text.length })
            }});
            return;
        }
        throw new Error(`Unknown analysis task: ${type}`);
    } catch (error) {
        self.postMessage({ id, ok: false, error: error?.message || String(error) });
    }
};
