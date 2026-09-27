/* =========================================================================
 * LYRICS MODULE (Standalone)
 * Parsing, fetching, timing, cache, text utilities.
 * Pure functions only — no DOM, no state.
 * ========================================================================= */

const linaClamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const hasFiniteNumber = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
function median(values) {
    const valid = values.filter(Number.isFinite).sort((a, b) => a - b);
    if (!valid.length) return null;
    const m = Math.floor(valid.length / 2);
    if (valid.length % 2) return valid[m];
    return (valid[m - 1] + valid[m]) / 2;
}

export function formatTime(seconds) {
    const m = Math.floor(seconds / 60), s = Math.floor(seconds % 60), c = Math.floor((seconds % 1) * 100);
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + '.' + String(c).padStart(2, '0');
}

export function cleanLyricsLookupText(value) {
    return String(value || '')
        .replace(/\.(mp3|m4a|aac|wav|flac|ogg|oga|opus|webm)$/i, '')
        .replace(/\s*[\(\[][^\)\]]*(?:official\s+(?:audio|video)|official|lyrics?|visuali[sz]er|video|audio|HD|4K|MV|remaster(?:ed)?)[^\)\]]*[\)\]]/gi, ' ')
        .replace(/\s+(?:feat\.?|ft\.?)\s+[^-–—|]+$/i, '')
        .replace(/\s*[-–—|]\s*(?:official\s+(?:audio|video)|lyrics?|visuali[sz]er|video|audio|HD|4K|MV)\s*$/i, '')
        .replace(/\s+/g, ' ')
        .trim();
}

export function songFromFilename(name) {
    if (!name) return { artist: '', track: '' };
    let base = String(name)
        .replace(/\.[^.]+$/, '')
        .replace(/_/g, ' ')
        .trim();

    base = cleanLyricsLookupText(base)
        .replace(/^\d{1,3}\s*[-._]?\s*/, '')
        .trim();

    const parts = base.split(/\s+-\s+/);
    if (parts.length >= 2) {
        return {
            artist: cleanLyricsLookupText(parts[0]),
            track: cleanLyricsLookupText(parts.slice(1).join(' - '))
        };
    }
    return { artist: '', track: cleanLyricsLookupText(base) };
}

export async function fetchWithRetry(url, options, retries = 2, backoffMs = 600) {
    for (let attempt = 0; ; attempt++) {
        let resp;
        try {
            resp = await fetch(url, options);
        } catch (fetchErr) {
            if (fetchErr.name === 'AbortError') throw fetchErr;
            if (attempt >= retries) throw new Error('Lyrics search failed (network error)');
            await new Promise(r => setTimeout(r, backoffMs * Math.pow(2, attempt)));
            continue;
        }
        if ((resp.status >= 500 || resp.status === 429) && attempt < retries) {
            await new Promise(r => setTimeout(r, backoffMs * Math.pow(2, attempt)));
            continue;
        }
        return resp;
    }
}

export function cleanTrackName(value) {
    return String(value || "")
        .replace(/\s*[\[\(][^\]\)]*[\]\)]\s*$/g, "")
        .replace(/\s+(official|lyric|lyrics|audio|visuali[sz]er|video|HD|4K)\s*$/ig, "")
        .replace(/\s+/g, " ")
        .trim();
}

export function isUsefulExportLabel(value) {
    const label = String(value || '').trim();
    return Boolean(label) && !/^(unknown|audio|track|song|recording|output|new recording|voice memo)(?:\s*\d+)?$/i.test(label);
}

export function sanitiseExportFilenamePart(value) {
    return String(value || '')
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/[. ]+$/g, '')
        .trim();
}

export function buildExportFilename(extension, resolved) {
    const title = sanitiseExportFilenamePart(resolved.title) || 'Lyric Video';
    const artist = sanitiseExportFilenamePart(resolved.artist);
    const parts = [title];
    if (artist && artist.toLocaleLowerCase() !== title.toLocaleLowerCase()) parts.push(artist);
    parts.push('KEFE Visualiser');
    const ext = String(extension || 'mp4').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'mp4';
    return parts.join(' - ') + '.' + ext;
}

export function estimateFinalVocalWordEnd(words, nextLineTime = Infinity) {
    if (!Array.isArray(words) || !words.length) return null;
    const last = words[words.length - 1];
    const start = Number(last.time);
    if (!Number.isFinite(start)) return null;
    const gaps = [];
    for (let i = 0; i < words.length - 1; i++) {
        const a = Number(words[i].time), b = Number(words[i + 1].time);
        const gap = b - a;
        if (Number.isFinite(gap) && gap >= 0.08 && gap <= 1.8) gaps.push(gap);
    }
    const cadence = median(gaps) ?? 0.48;
    const letters = Array.from(String(last.text || "").replace(/[^\p{L}\p{N}]/gu, "")).length;
    const textDuration = linaClamp(0.24 + letters * 0.055, 0.28, 1.15);
    const cadenceDuration = linaClamp(cadence * 1.10, 0.28, 1.25);
    let duration = Math.max(textDuration, cadenceDuration);
    duration = linaClamp(duration, 0.28, 1.35);
    let end = start + duration;
    if (Number.isFinite(nextLineTime)) end = Math.min(end, Math.max(start + 0.12, nextLineTime - 0.08));
    return end;
}

export function normaliseEnhancedWordEnds(lines) {
    for (let li = 0; li < lines.length; li++) {
        const line = lines[li];
        if (!Array.isArray(line.words) || !line.words.length) continue;
        const nextLineTime = Number(lines[li + 1]?.time) || null;
        for (let wi = 0; wi < line.words.length; wi++) {
            const word = line.words[wi];
            const nextWord = line.words[wi + 1];
            if (word.explicitEndTime === true && hasFiniteNumber(word.endTime)) continue;
            if (nextWord && hasFiniteNumber(nextWord.time)) {
                word.endTime = Math.max(Number(word.time) + 0.04, Number(nextWord.time));
            } else {
                word.endTime = estimateFinalVocalWordEnd(line.words, nextLineTime);
            }
        }
        const finalWord = line.words[line.words.length - 1];
        line.vocalEndTime = hasFiniteNumber(finalWord.endTime) ? Number(finalWord.endTime) : Number(line.time) + 0.8;
    }
    return lines;
}

export function parseLyrics(raw) {
    if (typeof raw !== 'string') throw new Error('Lyrics must be text');
    const TIME_TAG = /\[(\d{1,3}):([0-5]?\d)(?:[.:](\d{1,3}))?\]/g;
    const METADATA_TAG = /^\[(ar|ti|al|au|length|by|offset|re|tool|ve|cover|coverart|artwork|image):/i;
    const lines = raw.split(/\r?\n/);
    const parsed = [];
    const skipped = [];
    const metadata = { title: '', artist: '', album: '', artwork: '' };
    const declaredOffset = /^\[offset:([+-]?\d+)\]$/im.exec(raw);
    let offsetSeconds = declaredOffset ? Number(declaredOffset[1]) / 1000 : 0;
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        TIME_TAG.lastIndex = 0;
        const timeMatches = [];
        let expectedTimeIndex = 0;
        let timeMatch;
        while ((timeMatch = TIME_TAG.exec(line)) !== null) {
            if (timeMatch.index !== expectedTimeIndex) break;
            timeMatches.push({ match: timeMatch, time: Number(timeMatch[1]) * 60 + Number(timeMatch[2]) + (timeMatch[3] ? Number('0.' + timeMatch[3]) : 0) });
            expectedTimeIndex = timeMatch.index + timeMatch[0].length;
        }
        if (!timeMatches.length) {
            const metaMatch = /^\[(ar|ti|al|offset|cover|coverart|artwork|image):(.+)\]$/i.exec(line);
            if (metaMatch) {
                const key = metaMatch[1].toLowerCase();
                const value = metaMatch[2].trim();
                if (key === 'ar') metadata.artist = value;
                else if (key === 'ti') metadata.title = value;
                else if (key === 'al') metadata.album = value;
                else if (key === 'offset') offsetSeconds = (Number(value) || 0) / 1000;
                else metadata.artwork = value;
            } else if (!METADATA_TAG.test(line)) skipped.push(line);
            continue;
        }
        const contentStart = Math.max(...timeMatches.map(item => item.match.index + item.match[0].length));
        const content = line.slice(contentStart);
        const wordMatches = [];
        const WORD_TAG = /<(\d{1,3}):([0-5]?\d)(?:[.:](\d{1,3}))?>/g;
        const hasWordTimings = content.includes('<') && content.includes('>');
        if (hasWordTimings) {
            const temp = content;
            WORD_TAG.lastIndex = 0;
            let wm;
            while ((wm = WORD_TAG.exec(temp)) !== null) {
                const wt = Math.max(0, Number(wm[1]) * 60 + Number(wm[2]) + (wm[3] ? Number('0.' + wm[3]) : 0) + offsetSeconds);
                const si = wm.index + wm[0].length;
                const ni = temp.indexOf('<', si);
                const ei = ni !== -1 ? ni : temp.length;
                const wtxt = temp.slice(si, ei).trim();
                if (wtxt) wordMatches.push({ text: wtxt, time: wt, explicitEndTime: false, endTime: null });
            }
        }
        const text = content.replace(/<[^>]*>/g, '').trim();
        if (text) {
            for (const item of timeMatches) {
                const time = Math.max(0, item.time + offsetSeconds);
                const entry = { time, endTime: time + 3, text, words: null };
                if (wordMatches.length > 0 && timeMatches.length === 1) entry.words = wordMatches;
                parsed.push(entry);
            }
        } else {
            skipped.push(line);
        }
    }
    parsed.sort((a, b) => a.time - b.time);
    const unique = parsed.filter((entry, index) => index === 0 || entry.time !== parsed[index - 1].time || entry.text !== parsed[index - 1].text);
    for (let i = 0; i < unique.length; i++) {
        if (i < unique.length - 1) { unique[i].endTime = unique[i + 1].time; unique[i].nextLineTime = unique[i + 1].time; }
        else unique[i].endTime = unique[i].time + 5;
    }
    return { lines: normaliseEnhancedWordEnds(unique), skippedCount: skipped.length, skippedLines: skipped, metadata };
}

export function validateLyricTiming(lines, duration = 0) {
    const errors = [], warnings = [];
    if (!Array.isArray(lines) || !lines.length) return { errors, warnings };
    let previous = -Infinity;
    for (let i = 0; i < lines.length; i++) {
        const time = Number(lines[i]?.time);
        if (!Number.isFinite(time) || time < 0) errors.push(`Line ${i + 1} has an invalid timestamp`);
        if (time < previous) errors.push(`Line ${i + 1} is earlier than the previous line`);
        if (time === previous) warnings.push(`Lines ${i} and ${i + 1} share a timestamp`);
        if (Number.isFinite(duration) && duration > 0 && time > duration + 0.1) errors.push(`Line ${i + 1} starts after the audio ends`);
        if (Number.isFinite(time) && Number.isFinite(previous) && previous >= 0 && time - previous > 18) warnings.push(`Long ${Math.round(time - previous)}s gap before line ${i + 1}`);
        const end = Number(lines[i]?.endTime);
        if (Number.isFinite(end) && Number.isFinite(time) && end < time) errors.push(`Line ${i + 1} ends before it starts`);
        previous = time;
    }
    const last = Number(lines[lines.length - 1]?.time);
    if (Number.isFinite(duration) && duration > 0 && Number.isFinite(last) && duration - last > 30) warnings.push('Lyrics finish more than 30 seconds before the audio');
    return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}

const LYRIC_FIX_HINTS = [
    { test: m => /invalid timestamp/i.test(m), hint: 'Open Edit Lyrics and correct the [mm:ss.xx] tag on that line.' },
    { test: m => /earlier than the previous line/i.test(m), hint: 'Lines must be in chronological order — reorder or fix the timestamps in Edit Lyrics.' },
    { test: m => /starts after the audio ends/i.test(m), hint: 'That line plays after your audio finishes. Remove it in Edit Lyrics, or use audio that covers it.' },
    { test: m => /ends before it starts/i.test(m), hint: 'Fix that line so its end time is later than its start (Edit Lyrics).' },
    { test: m => /share a timestamp/i.test(m), hint: 'Two lines start at the same moment — stagger them slightly unless they really overlap.' },
    { test: m => /gap before line/i.test(m), hint: 'Long silence before that line. Use the Sync controls to nudge timing, or leave the pause as intended.' },
    { test: m => /finish more than 30 seconds/i.test(m), hint: 'The tail of the audio has no text — that is fine; the title-card outro covers the ending.' }
];
export function adviceForMessage(message) {
    const found = LYRIC_FIX_HINTS.find(h => h.test(message));
    return found ? found.hint : '';
}

export function shiftedLines(delta, lines) {
    return lines.map(line => {
        const copy = { ...line, time: Math.max(0, Number(line.time) + delta) };
        if (Number.isFinite(Number(line.endTime))) copy.endTime = Math.max(copy.time, Number(line.endTime) + delta);
        if (Array.isArray(line.words)) copy.words = line.words.map(w => ({
            ...w,
            time: Math.max(0, Number(w.time) + delta),
            endTime: Number.isFinite(Number(w.endTime)) ? Math.max(0, Number(w.endTime) + delta) : null
        }));
        return copy;
    });
}

export function splitCaptionText(raw) {
    const parts = [];
    for (const chunk of String(raw || '').split(/\r?\n+/)) {
        const trimmed = chunk.trim();
        if (!trimmed) continue;
        const sentences = trimmed.match(/[^.!?…]+[.!?…]*/g) || [trimmed];
        for (const s of sentences) { if (s.trim()) parts.push(s.trim()); }
    }
    return parts;
}

/* ---------- Auto-lyrics cache ---------- */
const AUTO_LYRICS_CACHE_PREFIX = 'kefe:auto-lyrics:v1:';
export function autoLyricsCacheKey(artist, title) {
    return AUTO_LYRICS_CACHE_PREFIX + encodeURIComponent(
        cleanLyricsLookupText(artist).toLowerCase() + '::' + cleanLyricsLookupText(title).toLowerCase()
    );
}
export function readAutoLyricsCache(artist, title) {
    try {
        const raw = localStorage.getItem(autoLyricsCacheKey(artist, title));
        const parsed = raw ? JSON.parse(raw) : null;
        return parsed && (parsed.syncedLyrics || parsed.plainText) ? parsed : null;
    } catch (error) {
        return null;
    }
}
export function writeAutoLyricsCache(artist, title, result) {
    try {
        localStorage.setItem(autoLyricsCacheKey(artist, title), JSON.stringify({
            artist,
            title,
            syncedLyrics: result.syncedLyrics || '',
            plainText: result.plainText || '',
            source: result.source || ''
        }));
    } catch (error) {}
}

export function parseAutoSyncedLyrics(raw) {
    if (!raw) return [];
    try {
        const parsed = parseLyrics(String(raw));
        return Array.isArray(parsed.lines) ? parsed.lines : [];
    } catch (error) {
        return [];
    }
}

/* ---------- Network fetchers ---------- */
export async function fetchLrclibLyrics(artist, title) {
    const getUrl = 'https://lrclib.net/api/get?artist_name=' + encodeURIComponent(artist) + '&track_name=' + encodeURIComponent(title);
    let response = await fetch(getUrl, { headers: { Accept: 'application/json' } });

    if (response.status === 404) {
        const searchUrl = 'https://lrclib.net/api/search?q=' + encodeURIComponent(artist + ' ' + title);
        response = await fetch(searchUrl, { headers: { Accept: 'application/json' } });
        if (!response.ok) return null;
        const results = await response.json();
        const matches = Array.isArray(results) ? results : [];
        const synced = matches.find(item => String(item?.syncedLyrics || '').trim());
        const plain = matches.find(item => String(item?.plainLyrics || '').trim());
        const item = synced || plain;
        if (!item) return null;
        return { syncedLyrics: String(item.syncedLyrics || ''), plainText: String(item.plainLyrics || ''), source: 'LRCLIB' };
    }

    if (!response.ok) return null;
    const item = await response.json();
    if (!item || (!String(item.syncedLyrics || '').trim() && !String(item.plainLyrics || '').trim())) return null;
    return { syncedLyrics: String(item.syncedLyrics || ''), plainText: String(item.plainLyrics || ''), source: 'LRCLIB' };
}

export async function fetchLyricsOvh(artist, title) {
    const url = 'https://api.lyrics.ovh/v1/' + encodeURIComponent(artist) + '/' + encodeURIComponent(title);
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    const item = await response.json();
    const lyrics = String(item?.lyrics || '').trim();
    return lyrics ? { syncedLyrics: '', plainText: lyrics, source: 'lyrics.ovh' } : null;
}

export async function fetchAutomaticLyrics(artist, title) {
    try {
        const lrclib = await fetchLrclibLyrics(artist, title);
        if (lrclib) return lrclib;
    } catch (error) {
        console.info('LRCLIB automatic lyrics unavailable:', error?.message || error);
    }
    try {
        const ovh = await fetchLyricsOvh(artist, title);
        if (ovh) return ovh;
    } catch (error) {
        console.info('lyrics.ovh automatic lyrics unavailable:', error?.message || error);
    }
    return null;
}

export async function requestSyncedLyrics(artist, track, duration, signal) {
    track = String(track || "")
        .replace(/\s*[\(\[][^\)\]]*[\)\]]\s*$/g, "")
        .replace(/\s+(official|lyric|lyrics|audio|visuali[sz]er|video|HD|4K)\s*$/ig, "")
        .trim();
    artist = String(artist || "").trim();

    const candidates = [];

    function lev(a, b) {
        if (a === b) return 0;
        if (!a) return b.length;
        if (!b) return a.length;
        let prev = [];
        for (let j = 0; j <= b.length; j++) prev[j] = j;
        for (let i = 1; i <= a.length; i++) {
            const curr = [i];
            for (let j = 1; j <= b.length; j++) {
                const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
                curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
            }
            prev = curr;
        }
        return prev[b.length];
    }
    function similar(a, b) {
        a = String(a || "").toLowerCase().trim();
        b = String(b || "").toLowerCase().trim();
        if (!a || !b) return 0;
        const d = lev(a, b);
        return 1 - d / Math.max(a.length, b.length);
    }

    const exact = new URLSearchParams({ artist_name: artist, track_name: track });
    if (Number.isFinite(duration) && duration > 0) exact.set("duration", String(Math.round(duration)));
    let exactResp = null;
    if (artist) {
        exactResp = await fetchWithRetry("https://lrclib.net/api/get?" + exact.toString(), { signal }, 1);
        if (exactResp.ok) {
            const data = await exactResp.json();
            if (data && data.syncedLyrics) return data;
            candidates.push(data);
        }
    }

    const trackOnly = new URLSearchParams({ track_name: track });
    const trackResp = await fetchWithRetry("https://lrclib.net/api/search?" + trackOnly.toString(), { signal });
    if (!trackResp.ok && trackResp.status === 429) throw new Error("Lyrics service is rate-limited, try again shortly");
    const trackResults = trackResp.ok ? (await trackResp.json()) : [];
    if (Array.isArray(trackResults)) {
        const scored = trackResults
            .filter(function(r){ return r && r.syncedLyrics; })
            .map(function(r){
                const artistScore = similar(r.artistName || "", artist);
                const trackScore = similar(r.trackName || "", track);
                let durScore = 0;
                if (Number.isFinite(duration) && duration > 0 && Number.isFinite(Number(r.duration))) {
                    const diff = Math.abs(Number(r.duration) - duration);
                    durScore = diff <= 5 ? 1 : diff <= 20 ? 0.5 : 0;
                }
                return { item: r, score: artistScore * 0.5 + trackScore * 0.35 + durScore * 0.15 };
            })
            .sort(function(a, b){ return b.score - a.score; });

        const best = scored[0];
        if (best && best.score >= 0.55) {
            best.item._correctedArtist = best.item.artistName;
            best.item._correctedTrack = best.item.trackName;
            return best.item;
        }
    }

    const searches = [
        new URLSearchParams({ track_name: track, ...(artist ? { artist_name: artist } : {}) }),
        new URLSearchParams({ q: [artist, track].filter(Boolean).join(" ") })
    ];
    for (const params of searches) {
        const response = await fetchWithRetry("https://lrclib.net/api/search?" + params.toString(), { signal });
        if (!response.ok) throw new Error(response.status === 429 ? "Lyrics service is rate-limited, try again shortly" : "Lyrics service unavailable (" + response.status + ")");
        const results = await response.json();
        if (Array.isArray(results)) candidates.push(...results);
        if (candidates.some(function(item){ return item && item.syncedLyrics; })) break;
    }
    return candidates.find(function(item){ return item && item.syncedLyrics; }) || null;
}
