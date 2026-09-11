const $ = id => document.getElementById(id);
const qsa = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

const canvas = $('stageCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
const audio = new Audio();

const state = {
    audio: { file: null, url: null, duration: 0, ready: false, metadata: { title: '', artist: '', album: '' }, metadataSource: 'none', hasArtwork: false },
    lyrics: { lines: [] },
    style: {
        effect: 'apple',
        fontSize: 76,
        align: 'left',
        accentColor: '#FFFFFF',
        textColor: '#FFFFFF',
        bratTextColor: '#FFFFFF',
        appleInactiveOpacity: 0.25,
        appleGlow: 0.012,
        appleDepth: 0.008,
        appleLift: 0,
        appleHighlightSpan: 0.92,
        appleVisibleLines: 4,
        appleTopOffset: 0.245,
        appleLineSpacing: 0.72,
        bratSideMargin: 4.5,
        bratTopMargin: 4.5,
        bratTypingSpeed: 1,
        eternalInkColor: '#FFFFFF',
        eternalPenWidth: 21,
        eternalWriteSpan: 0.90,
        eternalGlow: 3,
        eternalPresence: 0.65,
        auroraSpeed: 1.2,
        auroraIntensity: 0.7,
        auroraSaturation: 1.0,
        pulseAmplitude: 0.4,
        pulseFrequency: 1.2,
        pulseGlowSize: 1.0,
        titleCardEnabled: true,
        titleCardDuration: 3,
        titleCardStyle: 'auto'
    },
    background: { type: 'solid', image: null, video: null, dim: 0.35, solid: '#0A0A0A', blur: 0 },
    playback: { isPlaying: false, currentTime: 0, isSeeking: false },
    audioSource: { master: 'uploaded', userChosen: false },
    captions: { mode: 'lyrics', lines: [] },
    captionStyle: { position: 'bottom', opacity: 1, color: '#FFFFFF', shadow: true },
    projectType: 'lyric',
    lyricsOffset: 0,
    touched: { fx: false, background: false, title: false },
    aspect: '9:16'
};
window.state = state;

let media = { image: null, video: null, videoFile: null, videoHasAudio: false };
window.kefeMedia = media;
let audioURL = null;
let backgroundURL = null;
let albumArtworkImage = null;
let albumArtworkURL = null;
let mediaTagsLoadPromise = null;
let audioLoadToken = 0;
let backgroundLoadToken = 0;
let pendingProjectMetadata = null;
let exportClockTime = null;
let renderLoopId = null;
var isExporting = false;
let userScrubbing = false;
let lastVideoHardSync = -Infinity;
let noneClockRunning = false;
let noneClockBase = 0;
let noneClockWall = 0;

const MAX_INK_CACHE_SIZE = 50;
const lastVideoFrame = document.createElement("canvas");
const lastVideoFrameCtx = lastVideoFrame.getContext("2d");
let hasLastVideoFrame = false;

const LINA_PREFS_KEY = 'lina-visualiser-prefs-v1';
function saveLinaPrefs() {
    try {
        localStorage.setItem(LINA_PREFS_KEY, JSON.stringify({
            metadata: state.audio.metadata,
            aspect: state.aspect,
            effect: state.style.effect
        }));
    } catch (e) { }
}
function loadLinaPrefs() {
    try {
        const raw = localStorage.getItem(LINA_PREFS_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (e) { return null; }
}

/* ---------- Theme (Day / Night / System) ---------- */
const THEME_KEY = 'kefe-theme-v1';
function applyTheme(mode) {
    try {
        if (mode === 'day' || mode === 'night') document.documentElement.dataset.theme = mode;
        else delete document.documentElement.dataset.theme;
        localStorage.setItem(THEME_KEY, mode);
    } catch (e) { }
    const select = $('themeSelect');
    if (select) select.value = mode || 'system';
}
function initTheme() {
    let saved = 'system';
    try { saved = localStorage.getItem(THEME_KEY) || 'system'; } catch (e) { }
    applyTheme(['day', 'night'].includes(saved) ? saved : 'system');
    $('themeSelect')?.addEventListener('change', function() { applyTheme(this.value); });
}

/* ---------- Timed text resolution ---------- */
function activeTextMode() { return state.captions.mode === 'captions' ? 'captions' : 'lyrics'; }
const PROJECT_TYPES = ['lyric', 'visualiser', 'captioned', 'custom'];
function timedTextRequired() { return state.projectType !== 'visualiser' && state.projectType !== 'custom'; }
function activeTimedLines() {
    if (state.projectType === 'visualiser') return [];
    if (state.captions.mode === 'captions' && state.captions.lines.length) return state.captions.lines;
    return state.lyrics.lines;
}
function markSectionTouched(key) {
    if (!(key in state.touched) || state.touched[key]) return;
    state.touched[key] = true;
    updateSectionNav();
}

/* ---------- Play button icons ---------- */
const PLAY_ICON = '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M8 5.2v13.6a1 1 0 0 0 1.52.86l10.2-6.8a1 1 0 0 0 0-1.66l-10.2-6.8A1 1 0 0 0 8 5.2Z" fill="currentColor"/></svg>';
const PAUSE_ICON = '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><rect x="6.4" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none"/><rect x="13.6" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none"/></svg>';
function setPlayIcon(playing) {
    const btn = $('playBtn');
    if (btn) btn.innerHTML = playing ? PAUSE_ICON : PLAY_ICON;
}

const linaClamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const hasFiniteNumber = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
function linaSmooth(value) { const t = linaClamp(value); return t * t * (3 - 2 * t); }
function linaSmoother(value) { const t = linaClamp(value); return t * t * t * (t * (t * 6 - 15) + 10); }
function linaSeededRandom(seed) { const n = Math.sin(seed * 12.9898 + 78.233) * 43758.5453; return n - Math.floor(n); }
function median(values) { const valid = values.filter(Number.isFinite).sort((a,b) => a-b); if (!valid.length) return null; const m = Math.floor(valid.length/2); if (valid.length % 2) return valid[m]; return (valid.length % 2) ? valid[m] : (valid[m-1] + valid[m]) / 2; }
function linaNormaliseLine(lines, index) {
    if (!Array.isArray(lines) || index < 0 || index >= lines.length) return null;
    const source = lines[index];
    const start = Number(source.time) || 0;
    const nextLineTime = hasFiniteNumber(lines[index+1]?.time) ? Number(lines[index+1].time) : null;
    const end = hasFiniteNumber(source.endTime) ? Number(source.endTime) : (nextLineTime !== null ? nextLineTime : start + 3);
    const vocalEnd = hasFiniteNumber(source.vocalEndTime) ? Number(source.vocalEndTime) : (source.words && source.words.length > 0 && hasFiniteNumber(source.words[source.words.length-1]?.endTime) ? Number(source.words[source.words.length-1].endTime) : end);
    return { ...source, time: start, endTime: end, vocalEndTime: vocalEnd, nextLineTime };
}
function linaFindActiveLine(lines, time) {
    let index = -1;
    for (let i = 0; i < lines.length; i++) {
        if (hasFiniteNumber(lines[i].time) && time >= Number(lines[i].time)) index = i; else break;
    }
    return index;
}
function estimateFinalVocalWordEnd(words, nextLineTime = Infinity) {
    if (!Array.isArray(words) || !words.length) return null;
    const last = words[words.length-1], start = Number(last.time);
    if (!Number.isFinite(start)) return null;
    const gaps = [];
    for (let i = 0; i < words.length-1; i++) { const a = Number(words[i].time), b = Number(words[i+1].time), gap = b-a; if (Number.isFinite(gap) && gap >= .08 && gap <= 1.8) gaps.push(gap); }
    const cadence = median(gaps) ?? .48;
    const letters = Array.from(String(last.text || "").replace(/[^\p{L}\p{N}]/gu, "")).length;
    let duration = Math.max(linaClamp(.24 + letters * .055, .28, 1.15), linaClamp(cadence * 1.10, .28, 1.25));
    duration = linaClamp(duration, .28, 1.35);
    let end = start + duration;
    if (Number.isFinite(nextLineTime)) end = Math.min(end, Math.max(start + .12, nextLineTime - .08));
    return end;
}
function normaliseEnhancedWordEnds(lines) {
    for (let li = 0; li < lines.length; li++) {
        const line = lines[li]; if (!Array.isArray(line.words) || !line.words.length) continue;
        const nextLineTime = Number(lines[li+1]?.time) || null;
        for (let wi = 0; wi < line.words.length; wi++) {
            const word = line.words[wi], nextWord = line.words[wi+1];
            if (word.explicitEndTime === true && hasFiniteNumber(word.endTime)) continue;
            if (nextWord && hasFiniteNumber(nextWord.time)) word.endTime = Math.max(Number(word.time) + .04, Number(nextWord.time));
            else word.endTime = estimateFinalVocalWordEnd(line.words, nextLineTime);
        }
        const finalWord = line.words[line.words.length-1];
        line.vocalEndTime = hasFiniteNumber(finalWord.endTime) ? Number(finalWord.endTime) : Number(line.time) + .8;
    }
    return lines;
}
function estimateLineVocalEnd(line, nextLine) {
    const start = Number(line.time); if (!Number.isFinite(start)) return null;
    const tokens = String(line.text || "").trim().split(/\s+/).filter(Boolean); if (!tokens.length) return start;
    const nextStart = Number(nextLine?.time);
    const estimated = tokens.reduce((total, token) => total + linaClamp(.16 + Array.from(token.replace(/[^\p{L}\p{N}]/gu, "")).length * .045, .24, .78), 0) + Math.max(0, tokens.length-1) * .055;
    let duration = linaClamp(estimated, .65, 5);
    if (Number.isFinite(nextStart)) duration = Math.min(duration, Math.max(.20, nextStart-start-.10));
    return start + duration;
}

/* ---------- The editor owns application state; lyric effect drawing is dispatched centrally. ---------- */
function renderLyricsEffect(ctx, w, h, style, lines, time) {
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    ctx.shadowBlur = 0;
    const key = style?.effect || 'apple';
    const renderer = window.kefeRendererRegistry?.[key];
    if (typeof renderer === 'function') {
        renderer(ctx, w, h, style || {}, lines || [], time);
    } else {
        console.error(`[KEFE] Missing lyric renderer: ${key}`);
    }
    ctx.restore();
}

/* ---------- Dedicated caption/subtitle style ---------- */
function captionActiveLine(lines, time) {
    let active = null;
    for (const line of lines) {
        const start = Number(line?.time);
        if (!Number.isFinite(start) || start > time) continue;
        if (!String(line?.text || '').trim()) continue;
        const end = Number(line?.endTime);
        const finish = Number.isFinite(end) && end > start ? end : start + 3;
        if (time < finish) active = { line, start, finish };
    }
    return active;
}

