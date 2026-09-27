import { drawAppleEffect, appleWordsForLine } from './effects/lyric-apple.js';
import { drawBratEffect } from './effects/lyric-brat.js';
import { drawEternalSunshineEffect } from './effects/lyric-eternal.js';
import { drawAuroraEffect } from './effects/lyric-aurora.js';
import { drawPulseEffect } from './effects/lyric-pulse.js';
import { renderTitleCard, resolveTitleCardDesign, titleCardPhase } from './effects/Titlecard.js';
import {
    formatTime, cleanLyricsLookupText, songFromFilename, fetchWithRetry,
    cleanTrackName, isUsefulExportLabel, sanitiseExportFilenamePart,
    buildExportFilename, estimateFinalVocalWordEnd, normaliseEnhancedWordEnds,
    parseLyrics, validateLyricTiming, adviceForMessage, shiftedLines,
    splitCaptionText, readAutoLyricsCache, writeAutoLyricsCache,
    parseAutoSyncedLyrics, fetchAutomaticLyrics, requestSyncedLyrics
} from './core/module-lyrics.js';

const $ = id => document.getElementById(id);
const qsa = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

const canvas = $('stageCanvas');
const ctx = canvas.getContext('2d', { alpha: true });
const audio = new Audio();
window.kefeAudioElement = audio;

const state = {
    audio: { file: null, url: null, duration: 0, ready: false, metadata: { title: '', artist: '', album: '' }, metadataSource: 'none', hasArtwork: false },
    lyrics: { lines: [], plainText: '', source: '' },
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
        titleCardStyle: 'spotlight'
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
let exportClockTime = null;
let renderLoopId = null;
var isExporting = false;
let userScrubbing = false;
let lastVideoHardSync = -Infinity;
let noneClockRunning = false;
let noneClockBase = 0;
let noneClockWall = 0;

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

function applyNightPresentation() {
    document.documentElement.dataset.theme = 'night';
    document.documentElement.style.colorScheme = 'dark';
}

function activeTextMode() { return state.captions.mode === 'captions' ? 'captions' : 'lyrics'; }
const PROJECT_TYPES = ['lyric', 'visualiser', 'captioned'];
function timedTextRequired() {
    return state.projectType !== 'visualiser' && state.projectType !== 'custom';
}
function activeTimedLines() {
    if (state.projectType === 'visualiser') return [];
    if (state.captions.mode === 'captions') return state.captions.lines;
    return state.lyrics.lines;
}
function markSectionTouched(key) {
    if (!(key in state.touched) || state.touched[key]) return;
    state.touched[key] = true;
    updateSectionNav();
}

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

function linaNormaliseLine(lines, index) {
    if (!Array.isArray(lines) || index < 0 || index >= lines.length) return null;
    const source = lines[index];
    const start = Number(source.time) || 0;
    const nextLineTime = hasFiniteNumber(lines[index+1]?.time) ? Number(lines[index+1].time) : null;
    const end = hasFiniteNumber(source.endTime) ? Number(source.endTime) : (nextLineTime !== null ? nextLineTime : start + 3);
    const vocalEnd = hasFiniteNumber(source.vocalEndTime) ? Number(source.vocalEndTime) :
        (source.words && source.words.length > 0 && hasFiniteNumber(source.words[source.words.length-1]?.endTime) ? Number(source.words[source.words.length-1].endTime) : end);
    return { ...source, time: start, endTime: end, vocalEndTime: vocalEnd, nextLineTime };
}

function linaFindActiveLine(lines, time) {
    let index = -1;
    for (let i = 0; i < lines.length; i++) {
        if (hasFiniteNumber(lines[i].time) && time >= Number(lines[i].time)) index = i;
        else break;
    }
    return index;
}

function renderLyricsEffect(ctx, w, h, style, lines, time) {
    ctx.save();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.filter = "none"; ctx.shadowBlur = 0;
    switch(style.effect) {
        case "apple": drawAppleEffect(ctx, w, h, style, lines, time, albumArtworkImage); break;
        case "brat": drawBratEffect(ctx, w, h, style, lines, time); break;
        case "eternal": drawEternalSunshineEffect(ctx, w, h, style, lines, time); break;
        case "aurora": drawAuroraEffect(ctx, w, h, style, lines, time); break;
        case "pulse": drawPulseEffect(ctx, w, h, style, lines, time); break;
        case "typewriter":
        case "instagram":
        case "fadeup":
        default: {
            const fn = window.kefeEffects && window.kefeEffects[style.effect];
            if (typeof fn === "function") fn(ctx, w, h, style, lines, time);
            else drawAppleEffect(ctx, w, h, style, lines, time, albumArtworkImage);
        }
    }
    ctx.restore();
}

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
function wrapCaptionText(ctx, text, maxWidth) {
    const words = String(text || '').trim().split(/\s+/).filter(Boolean);
    const rows = [];
    let row = '';
    for (const word of words) {
        const proposed = row ? row + ' ' + word : word;
        if (row && ctx.measureText(proposed).width > maxWidth) { rows.push(row); row = word; }
        else row = proposed;
    }
    if (row) rows.push(row);
    return rows.slice(0, 3);
}
function renderCaptionStyle(ctx, w, h, lines, time) {
    const cs = state.captionStyle || {};
    const active = captionActiveLine(lines, time);
    if (!active) return;
    const unit = Math.min(w, h);
    const fontSize = Math.max(26, Math.round(unit * 0.037));
    ctx.save();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none'; ctx.shadowBlur = 0;
    ctx.font = `600 ${fontSize}px "Open Sans", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const rows = wrapCaptionText(ctx, active.line.text, w * 0.82);
    if (!rows.length) { ctx.restore(); return; }
    const lineHeight = fontSize * 1.32;
    const safe = unit * 0.085;
    const isTop = cs.position === 'top';
    const lastBaseline = isTop ? safe + fontSize + (rows.length - 1) * lineHeight : h - safe;
    const firstBaseline = lastBaseline - (rows.length - 1) * lineHeight;
    const fade = linaClamp((time - active.start) / 0.15) * linaClamp((active.finish - time) / 0.25);
    const opacity = linaClamp(Number(cs.opacity) || 1, 0.1, 1);
    ctx.globalAlpha = opacity * fade;
    ctx.fillStyle = /^#[0-9a-f]{6}$/i.test(cs.color || '') ? cs.color : '#FFFFFF';
    if (cs.shadow !== false) {
        ctx.strokeStyle = 'rgba(0,0,0,0.88)';
        ctx.lineWidth = Math.max(2, fontSize * 0.085);
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.shadowColor = 'rgba(0,0,0,0.85)';
        ctx.shadowBlur = fontSize * 0.22;
        ctx.shadowOffsetY = Math.max(1.5, fontSize * 0.055);
    }
    rows.forEach((row, i) => {
        const y = firstBaseline + i * lineHeight;
        if (cs.shadow !== false) ctx.strokeText(row, w / 2, y);
        ctx.fillText(row, w / 2, y);
    });
    ctx.restore();
}

function drawCover(ctx, media, w, h, blur) {
    const mw = media.videoWidth || media.width, mh = media.videoHeight || media.height;
    if (!mw || !mh) return;
    const scale = Math.max(w / mw, h / mh);
    const dw = mw * scale, dh = mh * scale;
    const dx = (w - dw) / 2, dy = (h - dh) / 2;
    if (blur > 0) { ctx.filter = `blur(${blur}px)`; ctx.drawImage(media, dx - blur*2, dy - blur*2, dw + blur*4, dh + blur*4); ctx.filter = "none"; }
    else ctx.drawImage(media, dx, dy, dw, dh);
}
function ensureVideoFrameCacheSize(w, h) {
    if (lastVideoFrame.width !== w || lastVideoFrame.height !== h) { lastVideoFrame.width = w; lastVideoFrame.height = h; hasLastVideoFrame = false; }
}
function drawVideoBackgroundStable(ctx, video, w, h, blur) {
    ensureVideoFrameCacheSize(w, h);
    const valid = video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0 && !video.seeking;
    if (valid) {
        drawCover(ctx, video, w, h, blur);
        if (video.paused || video.seeking || !hasLastVideoFrame) {
            lastVideoFrameCtx.clearRect(0, 0, w, h);
            drawCover(lastVideoFrameCtx, video, w, h, blur);
            hasLastVideoFrame = true;
        }
        return;
    }
    if (hasLastVideoFrame) { ctx.drawImage(lastVideoFrame, 0, 0, w, h); return; }
    ctx.fillStyle = state.background.solid || "#0A0A0A";
    ctx.fillRect(0, 0, w, h);
}
function drawBackground(ctx, w, h, bg, media) {
    ctx.save();
    ctx.fillStyle = bg.solid || "#0A0A0A";
    ctx.fillRect(0, 0, w, h);
    if (bg.type === "image" && media.image) drawCover(ctx, media.image, w, h, bg.blur);
    else if (bg.type === "video") drawVideoBackgroundStable(ctx, media.video, w, h, bg.blur);
    if (bg.dim > 0) { ctx.fillStyle = `rgba(0,0,0,${linaClamp(bg.dim)})`; ctx.fillRect(0, 0, w, h); }
    ctx.restore();
}

function drawPlainLyrics(ctx, w, h, text) {
    const rows = String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (!rows.length) return;
    const unit = Math.min(w, h);
    const fontSize = Math.max(28, Math.min(74, unit * 0.038));
    const lineHeight = fontSize * 1.35;
    const maxWidth = w * 0.78;
    ctx.save();
    ctx.font = `600 ${fontSize}px "Open Sans", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = fontSize * 0.12;
    const visible = rows.slice(0, Math.max(1, Math.floor((h * 0.72) / lineHeight)));
    const total = visible.length * lineHeight;
    let y = (h - total) / 2 + lineHeight / 2;
    for (const row of visible) {
        let shown = row;
        while (shown.length > 1 && ctx.measureText(shown).width > maxWidth) shown = shown.slice(0, -2).trim() + '…';
        ctx.fillText(shown, w / 2, y);
        y += lineHeight;
    }
    ctx.restore();
}

function render(ctx, w, h, appState, mediaCache) {
    if (!ctx || !w || !h) return;
    ctx.save();
    try {
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.filter = "none"; ctx.shadowBlur = 0;
        ctx.clearRect(0, 0, w, h);
        const hasPreviewMedia = Boolean(
            appState.audio?.file || mediaCache?.videoFile || mediaCache?.video || mediaCache?.image
        );
        if (hasPreviewMedia) drawBackground(ctx, w, h, appState.background, mediaCache);
        const time = Number.isFinite(appState.playback.currentTime) ? appState.playback.currentTime : 0;
        const cappedTime = (appState.playback.trimTo != null && time > appState.playback.trimTo)
            ? appState.playback.trimTo : time;
        const style = { ...appState.style };
        if (appState.projectType === 'visualiser' && window.kefeVisualiser) {
            window.kefeVisualiser.draw(ctx, w, h, cappedTime, appState, window.kefeAudioElement);
        }
        const appleTitleCard = appState.projectType !== 'captioned' && style.effect === 'apple';
        const tcActive = appState.projectType === 'captioned'
            ? false
            : appleTitleCard
                ? titleCardPhase(appState, cappedTime)
                : renderTitleCard(ctx, w, h, cappedTime, appState, albumArtworkImage, resolveAudioLabels);
        const titleLyricsStart = Number.isFinite(tcActive?.lyricsStart) ? tcActive.lyricsStart : Infinity;
        const timedLines = activeTimedLines();
        const lyricTime = Math.max(0, cappedTime - (Number(appState.lyricsOffset) || 0));

        if (appleTitleCard) {
            if (timedLines.length) {
                try {
                    renderLyricsEffect(ctx, w, h, style, timedLines, lyricTime);
                }
                catch(e) { console.error(`${style.effect} render error:`, e); }
            }
            renderTitleCard(ctx, w, h, cappedTime, appState, albumArtworkImage, resolveAudioLabels);
        } else if (!tcActive || cappedTime >= titleLyricsStart) {
            if (timedLines.length) {
                try {
                    if (activeTextMode() === 'captions') renderCaptionStyle(ctx, w, h, timedLines, lyricTime);
                    else renderLyricsEffect(ctx, w, h, style, timedLines, lyricTime);
                }
                catch(e) { console.error(`${style.effect} render error:`, e); }
            } else if (appState.lyrics.plainText && appState.projectType !== 'visualiser') {
                drawPlainLyrics(ctx, w, h, appState.lyrics.plainText);
            }
        }
    } finally { ctx.restore(); }
}

window.kefeRenderFrame = function(ctx, w, h, time) {
    state.playback.currentTime = time;
    render(ctx, w, h, state, media);
};

function getMasterMode() {
    return (state.audioSource && state.audioSource.master) || 'uploaded';
}
function isMasterPlaying() {
    const mode = getMasterMode();
    if (mode === 'video') { const v = media?.video; return v ? !v.paused : false; }
    if (mode === 'none') return noneClockRunning;
    return !audio.paused;
}
function getMasterDuration() {
    const mode = getMasterMode();
    if (mode === 'video') {
        const v = media?.video;
        return (v && Number.isFinite(v.duration) && v.duration > 0) ? v.duration : 0;
    }
    if (mode === 'none') {
        const vd = (media?.video && Number.isFinite(media.video.duration) && media.video.duration > 0) ? media.video.duration : 0;
        const ad = Number.isFinite(state.audio.duration) && state.audio.duration > 0 ? state.audio.duration : 0;
        let textEnd = 0;
        const lastLine = state.projectType === 'visualiser' ? null : state.lyrics.lines[state.lyrics.lines.length - 1];
        if (lastLine) {
            const t = Number(lastLine.time);
            const e = Number(lastLine.endTime);
            textEnd = Number.isFinite(e) ? e : (Number.isFinite(t) ? t + 3 : 0);
        }
        return Math.max(vd, ad, textEnd + 1, 1);
    }
    return Number.isFinite(state.audio.duration) && state.audio.duration > 0 ? state.audio.duration : 0;
}
function getMasterTime() {
    if (exportClockTime !== null && exportClockTime !== undefined) return exportClockTime;
    const mode = getMasterMode();
    if (mode === 'video') {
        const v = media?.video;
        return (v && Number.isFinite(v.currentTime)) ? v.currentTime : 0;
    }
    if (mode === 'none') {
        if (noneClockRunning) {
            let t = noneClockBase + (performance.now() - noneClockWall) / 1000;
            const d = getMasterDuration();
            if (Number.isFinite(d) && d > 0 && t >= d) { t = d; stopNoneClock(); }
            state.playback.currentTime = t;
            return t;
        }
        return Number.isFinite(state.playback.currentTime) ? state.playback.currentTime : 0;
    }
    return Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
}
function setMasterTime(target) {
    const t = Math.max(0, Number(target) || 0);
    const mode = getMasterMode();
    if (mode === 'video') {
        const v = media?.video;
        if (v && Number.isFinite(v.duration) && v.duration > 0) v.currentTime = wrappedVideoTime(t, v.duration);
    } else if (mode === 'none') {
        noneClockBase = t; noneClockWall = performance.now();
    } else {
        audio.currentTime = t;
    }
    state.playback.currentTime = t;
}
function startNoneClock(fromTime) {
    noneClockBase = Number.isFinite(fromTime) ? fromTime : state.playback.currentTime;
    noneClockWall = performance.now();
    noneClockRunning = true;
    state.playback.isPlaying = true;
}
function stopNoneClock() {
    noneClockRunning = false;
    noneClockBase = 0; noneClockWall = 0;
    state.playback.isPlaying = false;
}
function wrappedVideoTime(time, duration) {
    if (!Number.isFinite(duration) || duration <= 0) return 0;
    return ((time % duration) + duration) % duration;
}
function circularVideoDrift(cur, target, dur) {
    let drift = target - cur;
    if (dur > 0) { if (drift > dur/2) drift -= dur; else if (drift < -dur/2) drift += dur; }
    return drift;
}
function maintainBackgroundVideoSync(masterTime) {
    if (getMasterMode() === 'video') return;
    if (exportClockTime !== null) return;
    const video = media?.video;
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0 || video.readyState < 2) return;
    const target = wrappedVideoTime(masterTime, video.duration);
    const drift = circularVideoDrift(video.currentTime, target, video.duration);
    const distance = Math.abs(drift);
    const shouldPlay = isMasterPlaying();
    if (!shouldPlay || userScrubbing) {
        if (!video.paused) video.pause();
        if (distance > 0.035 && !video.seeking) video.currentTime = target;
        video.playbackRate = 1;
        return;
    }
    if (distance <= 0.18) video.playbackRate = linaClamp(1 + drift * 0.20, 0.97, 1.03);
    else video.playbackRate = 1;
    const now = performance.now();
    if (distance > 0.40 && !video.seeking && now - lastVideoHardSync > 250) {
        lastVideoHardSync = now;
        video.currentTime = target;
    }
    if (video.paused && !video.seeking) video.play().catch(() => {});
}
function syncPreviewTransportUI(t) {
    const seek = $('seek'); if (seek) { seek.value = String(t); seek.max = getMasterDuration(); }
    const clock = $('clock');
    const total = getMasterDuration();
    if (clock) clock.textContent = `${fmt(t)} / ${fmt(total)}`;
}
function redrawCurrentPreviewFrame() {
    if (isExporting) return;
    const t = getMasterTime();
    state.playback.currentTime = t;
    maintainBackgroundVideoSync(t);
    updateSyncLive(t);
    try { render(ctx, canvas.width, canvas.height, state, media); }
    catch(e) { console.error("Preview redraw error:", e); }
    syncPreviewTransportUI(t);
}
window.redrawCurrentPreviewFrame = redrawCurrentPreviewFrame;
function tick() {
    if (!isExporting) {
        const t = getMasterTime();
        state.playback.currentTime = t;
        const seek = $('seek');
        if (seek && !userScrubbing) seek.value = String(t);
        const clock = $('clock');
        if (clock) {
            const total = getMasterDuration();
            clock.textContent = `${fmt(t)} / ${fmt(total)}`;
        }
        maintainBackgroundVideoSync(t);
        updateSyncLive(t);
        try { render(ctx, canvas.width, canvas.height, state, media); }
        catch(e) { console.error("Preview render error:", e); }
    }
    renderLoopId = requestAnimationFrame(tick);
}
function startSingleRenderLoop() {
    if (renderLoopId !== null) cancelAnimationFrame(renderLoopId);
    renderLoopId = requestAnimationFrame(tick);
}

const EFFECT_LABELS = {
    apple: "Apple Music-style focus line with a continuous scrolling lyric stack",
    brat: "5-line album-cover typewriter (edge-to-edge justified)",
    eternal: "Three-line handwritten cycle (Homemade Apple only)",
    aurora: "Flowing colour-gradient lyrics with a soft aurora glow",
    pulse: "Bold lyrics with a rhythmic scale and glow pulse",
    typewriter: "Character-by-character typewriter reveal with a blinking caret",
    instagram: "Bold uppercase Instagram-style stack with a dominant active line",
    fadeup: "Word-by-word fade-up reveal with a soft glow",
    decrypt: "Characters scramble through random glyphs before locking in, left to right",
    blur: "Words drift up from a blur into sharp focus, staggered word by word",
    shiny: "Solid lyric text with a bright diagonal shine sweeping across it"
};

function renderEffectControls() {
    const effect = state.style.effect;
    const container = $('effectControls');
    if (!container) return;
    container.innerHTML = "";
    const controls = [{ key: "fontSize", label: "Size", type: "range", min: 36, max: 150, step: 1, suffix: "px", scale: 1 }];
    if (effect === "apple") {
        controls.push({ key: "align", label: "Alignment", type: "select", options: [["left","Left"],["center","Center"],["right","Right"]] });
    }
    let extraControls = [];
    if (effect === "apple") {
        extraControls = [
            { key: "appleTopOffset", label: "Lyrics position", type: "range", min: 20, max: 38, step: 0.5, suffix: "%", scale: 0.01 },
            { key: "appleLineSpacing", label: "Line spacing", type: "range", min: 45, max: 110, step: 1, suffix: "%", scale: 0.01 },
            { key: "appleInactiveOpacity", label: "Upcoming opacity", type: "range", min: 10, max: 45, step: 1, suffix: "%", scale: 0.01 },
            { key: "appleVisibleLines", label: "Upcoming lines", type: "range", min: 2, max: 6, step: 1, suffix: "", scale: 1 }
        ];
    }
    if (effect === "brat") {
        extraControls = [
            { key: "bratTypingSpeed", label: "Typing speed", type: "range", min: 50, max: 180, step: 5, suffix: "%", scale: 0.01 },
            { key: "bratSideMargin", label: "Side margin", type: "range", min: 1, max: 10, step: 0.5, suffix: "%", scale: 1 },
            { key: "bratTopMargin", label: "Top margin", type: "range", min: 1, max: 10, step: 0.5, suffix: "%", scale: 1 }
        ];
    }
    if (effect === "eternal") {
        extraControls = [
            { key: "eternalPenWidth", label: "Ink width", type: "range", min: 8, max: 40, step: 1, suffix: "%", scale: 1 },
            { key: "eternalWriteSpan", label: "Writing speed", type: "range", min: 60, max: 100, step: 1, suffix: "%", scale: 0.01 },
            { key: "eternalGlow", label: "Ink glow", type: "range", min: 0, max: 15, step: 1, suffix: "", scale: 1 },
            { key: "eternalPresence", label: "Presence", type: "range", min: 0, max: 100, step: 1, suffix: "%", scale: 0.01 },
            { key: "eternalInkColor", label: "Ink colour", type: "color" }
        ];
    }
    if (effect === "aurora") {
        extraControls = [
            { key: "auroraSpeed", label: "Flow speed", type: "range", min: 0.2, max: 2.5, step: 0.1, suffix: "x", scale: 1 },
            { key: "auroraIntensity", label: "Glow intensity", type: "range", min: 0.1, max: 1.5, step: 0.1, suffix: "", scale: 1 },
            { key: "auroraSaturation", label: "Colour saturation", type: "range", min: 0.2, max: 1.8, step: 0.1, suffix: "", scale: 1 }
        ];
    }
    if (effect === "pulse") {
        extraControls = [
            { key: "pulseAmplitude", label: "Pulse strength", type: "range", min: 0.05, max: 1, step: 0.05, suffix: "", scale: 1 },
            { key: "pulseFrequency", label: "Pulse speed", type: "range", min: 0.3, max: 2.5, step: 0.1, suffix: "x", scale: 1 },
            { key: "pulseGlowSize", label: "Glow size", type: "range", min: 0.1, max: 2, step: 0.1, suffix: "", scale: 1 },
            { key: "accentColor", label: "Glow colour", type: "color" }
        ];
    }
    const allControls = [...controls, ...extraControls];
    for (const control of allControls) {
        const row = document.createElement("div");
        row.className = "control-row";
        const label = document.createElement("label");
        label.textContent = control.label;
        row.appendChild(label);
        if (control.type === "range") {
            const val = document.createElement("span");
            val.style.marginLeft = "6px";
            const raw = state.style[control.key] !== undefined ? state.style[control.key] : 76;
            const disp = control.scale !== 1 ? Math.round(raw / control.scale * 100) / 100 : raw;
            val.textContent = `${disp}${control.suffix || ""}`;
            label.appendChild(val);
            const input = document.createElement("input");
            input.type = "range"; input.min = control.min; input.max = control.max; input.step = control.step;
            input.value = disp;
            input.addEventListener("input", () => {
                if (isExporting) { toast('Finish or cancel the current export first', 'error'); input.value = control.scale !== 1 ? Math.round(state.style[control.key] / control.scale * 100) / 100 : state.style[control.key]; return; }
                const next = Number(input.value);
                const scaled = control.scale !== 1 ? next * control.scale : next;
                state.style[control.key] = scaled;
                val.textContent = `${control.scale !== 1 ? Math.round(next * 100) / 100 : next}${control.suffix || ""}`;
                redrawCurrentPreviewFrame();
            });
            row.appendChild(input);
        } else if (control.type === "select") {
            const select = document.createElement("select");
            for (const [value, text] of control.options) {
                const opt = document.createElement("option");
                opt.value = value; opt.textContent = text;
                select.appendChild(opt);
            }
            select.value = state.style.align || "left";
            select.addEventListener("change", () => {
                if (isExporting) { toast('Finish or cancel the current export first', 'error'); select.value = state.style.align || "left"; return; }
                state.style.align = select.value;
                redrawCurrentPreviewFrame();
            });
            row.appendChild(select);
        } else if (control.type === "color") {
            const input = document.createElement("input");
            input.type = "color";
            input.value = state.style[control.key] || "#FFFFFF";
            input.addEventListener("input", () => {
                if (isExporting) { toast('Finish or cancel the current export first', 'error'); input.value = state.style[control.key] || "#FFFFFF"; return; }
                state.style[control.key] = input.value;
                redrawCurrentPreviewFrame();
            });
            row.appendChild(input);
        }
        container.appendChild(row);
    }
}

function setEffect(name) {
    if (isExporting) { toast('Finish or cancel the current export first', 'error'); return false; }
    state.style.effect = name;
    qsa("[data-effect]").forEach(b => b.classList.toggle("active-effect", b.dataset.effect === name));
    const label = $('effectLabel');
    if (label) label.textContent = EFFECT_LABELS[name] || "";
    if (typeof updateTitleCardHint === 'function') updateTitleCardHint();
    renderEffectControls();
    redrawCurrentPreviewFrame();
    saveLinaPrefs();
    return true;
}
qsa("[data-effect]").forEach(b => b.addEventListener("click", () => {
    if (setEffect(b.dataset.effect)) {
        toast(b.textContent + ' activated', 'success');
    }
}));

const fmt = t => {
    if (!t || !isFinite(t) || t < 0) return '0:00';
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
};
function toast(msg, type = '') {
    const el = $('toast');
    el.textContent = msg;
    el.className = 'toast show ' + type;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => el.classList.remove('show'), 3000);
}
function readiness() {
    const masterDur = getMasterDuration();
    const timedLines = activeTimedLines();
    const timingValid = timedLines.length > 0 && validateLyricTiming(timedLines, masterDur).errors.length === 0;
    const masterReady = hasMasterSource() && masterDur > 0;
    const ready = masterReady && (timedTextRequired() ? timingValid : true);
    $('exportBottom').disabled = !ready;
    refreshLyricsTimingStatus();
    updateSectionNav();
}
function ensureDefaultBackground() {
    if (media.image || media.video) return;
    state.background.type = 'solid';
    state.background.image = null;
    state.background.video = null;
    state.background.solid = state.background.solid || '#0A0A0A';
}
function hasMasterSource() {
    const mode = getMasterMode();
    if (mode === 'video') return Boolean(media.video && media.videoFile);
    if (mode === 'none') return getMasterDuration() > 0;
    return Boolean(state.audio.file) && state.audio.ready;
}

function updateSectionNav() {
    const masterDur = getMasterDuration();
    const timed = activeTimedLines();
    const timingOk = timed.length > 0 && validateLyricTiming(timed, masterDur).errors.length === 0;
    const done = {
        audio: hasMasterSource() && masterDur > 0,
        text: timingOk,
        fx: state.touched.fx,
        background: state.touched.background || Boolean(media.image) || Boolean(media.video),
        title: state.touched.title,
        export: hasMasterSource() && masterDur > 0 && timingOk
    };
    qsa('.section-nav-link').forEach(link => {
        const key = link.dataset.nav;
        if (key) link.classList.toggle('done', Boolean(done[key]));
    });
}
function projectValidationIssues() {
    const issues = [];
    const masterDur = getMasterDuration();
    const timedLines = activeTimedLines();
    if (!hasMasterSource()) issues.push('an audio or video source');
    else if (masterDur <= 0) issues.push('a source with a readable duration');
    if (timedTextRequired() && !timedLines.length) issues.push(activeTextMode() === 'captions' ? 'captions' : 'synced lyrics');
    else if (timedLines.length && validateLyricTiming(timedLines, masterDur).errors.length) issues.push('valid lyric timing');
    return issues;
}

function refreshLyricsTimingStatus() {
    const status = activeTextMode() === 'captions' ? $('captionsStatus') : $('lyricsStatus');
    if (!status) return;
    const timedLines = activeTimedLines();
    if (!timedLines.length) {
        status.textContent = activeTextMode() === 'captions'
            ? 'No captions yet — use Auto-generate Timing, or switch to Lyrics.'
            : 'No lyrics yet — search, upload an LRC, or paste your own.';
        status.className = 'status';
        updateSyncStatusUI();
        return;
    }
    const report = validateLyricTiming(timedLines, getMasterDuration());
    if (report.errors.length) {
        const advice = adviceForMessage(report.errors[0]);
        status.textContent = `${timedLines.length} lines · ${report.errors[0]}${advice ? ' — How to fix: ' + advice : ''}`;
        status.className = 'status error';
    } else if (report.warnings.length) {
        const advice = adviceForMessage(report.warnings[0]);
        status.textContent = `${timedLines.length} timed lines · ${report.warnings[0]}${advice ? ' — ' + advice : ''}`;
        status.className = 'status';
    } else {
        status.textContent = `${timedLines.length} timed lines · timing valid`;
        status.className = 'status success';
    }
    updateSyncStatusUI();
}

function nudgeLyricTiming(delta) {
    if (isExporting) { toast('Finish or cancel the current export first', 'error'); return; }
    const mode = activeTextMode();
    const store = mode === 'captions' ? state.captions : state.lyrics;
    if (!store.lines.length) { toast(mode === 'captions' ? 'Generate captions first' : 'Load lyrics first', 'error'); return; }
    store.lines = shiftedLines(delta, store.lines);
    refreshLyricsTimingStatus();
    redrawCurrentPreviewFrame();
    toast(`Shifted all ${mode} by ${delta > 0 ? '+' : ''}${delta}s`, 'success');
}
function updateSyncStatusUI() {
    const slider = $('lyricsOffset');
    const value = $('offsetVal');
    if (slider && document.activeElement !== slider) slider.value = String(state.lyricsOffset || 0);
    if (value) value.textContent = `${(state.lyricsOffset || 0) > 0 ? '+' : ''}${Number(state.lyricsOffset || 0).toFixed(2)}s`;
}
let lastSyncLiveUpdate = 0;
function updateSyncLive(t) {
    const el = $('syncLive');
    if (!el) return;
    const now = performance.now();
    if (now - lastSyncLiveUpdate < 180) return;
    lastSyncLiveUpdate = now;
    const lines = activeTimedLines();
    if (!lines.length) {
        el.textContent = activeTextMode() === 'captions'
            ? 'No captions yet — generate timing to see live sync.'
            : 'No lyrics yet — load lyrics to see live sync.';
        return;
    }
    const idx = linaFindActiveLine(lines, t);
    const total = lines.length;
    const label = activeTextMode() === 'captions' ? 'Caption' : 'Line';
    if (idx < 0) {
        const first = Number(lines[0].time) || 0;
        el.textContent = `First line starts in ${Math.max(0, first - t).toFixed(1)}s · 1/${total}.`;
        return;
    }
    const line = linaNormaliseLine(lines, idx);
    const next = Number(lines[idx + 1]?.time);
    const text = String(line.text || '').slice(0, 42);
    if (Number.isFinite(next) && t < next) el.textContent = `${label} ${idx + 1}/${total} · next in ${(next - t).toFixed(1)}s — “${text}”`;
    else el.textContent = `${label} ${idx + 1}/${total} (last) — “${text}”`;
}
function wireSyncControls() {
    $('lyricsOffset')?.addEventListener('input', function() {
        if (isExporting) { this.value = String(state.lyricsOffset || 0); return; }
        state.lyricsOffset = Number(this.value) || 0;
        updateSyncStatusUI();
        redrawCurrentPreviewFrame();
    });
    $('resetOffset')?.addEventListener('click', () => {
        if (isExporting) return;
        state.lyricsOffset = 0;
        updateSyncStatusUI();
        redrawCurrentPreviewFrame();
    });
    qsa('[data-nudge]').forEach(b => b.addEventListener('click', () => nudgeLyricTiming(Number(b.dataset.nudge))));
}

function resolveLyricsLookupMetadata() {
    const taggedArtist = cleanLyricsLookupText(state.audio.metadata?.artist);
    const taggedTitle = cleanLyricsLookupText(state.audio.metadata?.title);
    if (taggedArtist && taggedTitle) return { artist: taggedArtist, title: taggedTitle };

    const guessed = songFromFilename(state.audio.file?.name || '');
    return {
        artist: taggedArtist || cleanLyricsLookupText(guessed.artist),
        title: taggedTitle || cleanLyricsLookupText(guessed.track)
    };
}

function applyAutomaticLyrics(result) {
    state.lyrics.lines = result.syncedLyrics ? parseAutoSyncedLyrics(result.syncedLyrics) : [];
    state.lyrics.plainText = result.syncedLyrics ? '' : String(result.plainText || '');
    state.lyrics.source = result.source || '';
    redrawCurrentPreviewFrame();
}

async function autoFetchLyricsForCurrentTrack(file, token) {
    if (!file || token !== audioLoadToken || state.audio.file !== file) return;
    const { artist, title } = resolveLyricsLookupMetadata();
    if (!artist || !title) return;
    const status = $('lyricsStatus');
    if (status) { status.textContent = 'Fetching lyrics…'; status.className = 'status'; }

    const cached = readAutoLyricsCache(artist, title);
    if (cached) {
        if (token !== audioLoadToken || state.audio.file !== file) return;
        applyAutomaticLyrics(cached);
        if (status) { status.textContent = cached.syncedLyrics ? 'Synced lyrics loaded' : 'Lyrics loaded'; status.className = 'status success'; }
        return;
    }

    const result = await fetchAutomaticLyrics(artist, title);
    if (token !== audioLoadToken || state.audio.file !== file) return;
    if (!result) {
        state.lyrics.lines = [];
        state.lyrics.plainText = '';
        state.lyrics.source = '';
        if (status) { status.textContent = 'No lyrics loaded'; status.className = 'status'; }
        redrawCurrentPreviewFrame();
        return;
    }

    writeAutoLyricsCache(artist, title, result);
    applyAutomaticLyrics(result);
    if (status) { status.textContent = result.syncedLyrics ? 'Synced lyrics loaded' : 'Lyrics loaded'; status.className = 'status success'; }
}
const ASPECTS = {
    '9:16': { w: 1080, h: 1920, label: '1080 × 1920 (Vertical)' },
    '1:1': { w: 1080, h: 1080, label: '1080 × 1080 (Square)' },
    '16:9': { w: 1920, h: 1080, label: '1920 × 1080 (Horizontal)' }
};
function setAspectRatio(key) {
    if (isExporting) { toast('Finish or cancel the current export first', 'error'); return; }
    const aspect = ASPECTS[key];
    if (!aspect) return;
    state.aspect = key;
    canvas.width = aspect.w;
    canvas.height = aspect.h;
    const select = $('aspectSelect');
    if (select && select.value !== key) select.value = key;
    const info = $('aspectInfo');
    if (info) info.textContent = aspect.label;
    saveLinaPrefs();
    redrawCurrentPreviewFrame();
}

function updateMetadataInputs() {
    const titleInput = $('metaTitle'), artistInput = $('metaArtist'), albumInput = $('metaAlbum');
    if (titleInput) titleInput.value = state.audio.metadata.title || '';
    if (artistInput) artistInput.value = state.audio.metadata.artist || '';
    if (albumInput) albumInput.value = state.audio.metadata.album || '';
    updateGoogleLyricsButton();
}

function setAlbumArtworkBlob(blob, token = audioLoadToken) {
    if (!blob || !String(blob.type || '').startsWith('image/')) return;
    if (albumArtworkURL) URL.revokeObjectURL(albumArtworkURL);
    albumArtworkURL = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => { if (token !== audioLoadToken) return; albumArtworkImage = image; state.audio.hasArtwork = true; window.kefeAlbumArt = image; redrawCurrentPreviewFrame(); };
    image.onerror = () => {
        if (token !== audioLoadToken) return;
        state.audio.hasArtwork = false;
        albumArtworkImage = null;
        window.kefeAlbumArt = null;
        if (albumArtworkURL) { URL.revokeObjectURL(albumArtworkURL); albumArtworkURL = null; }
    };
    image.src = albumArtworkURL;
}

async function setAlbumArtworkReference(reference) {
    const value = String(reference || '').trim();
    if (!value.startsWith('data:image/') || value.length > 14 * 1024 * 1024) return false;
    try { const response = await fetch(value); setAlbumArtworkBlob(await response.blob()); return true; }
    catch (error) { return false; }
}

function loadMediaInfoLibrary() {
    if (window.MediaInfo) return Promise.resolve(window.MediaInfo);
    if (!window.kefeMediaInfoLoadPromise) {
        window.kefeMediaInfoLoadPromise = import("/vendor/mediainfo/MediaInfo.js")
            .then(module => module.default || module.MediaInfo || module)
            .catch(error => {
                window.kefeMediaInfoLoadPromise = null;
                throw error;
            });
    }
    return window.kefeMediaInfoLoadPromise;
}

async function readEmbeddedVideoMetadata(file, token) {
    try {
        const MediaInfo = await loadMediaInfoLibrary();
        const mediaInfo = await (function(){ try { return MediaInfo({
            locateFile: () => "/vendor/mediainfo/MediaInfoModule.wasm" }); } catch (e) { return new MediaInfo({ locateFile: () => "/vendor/mediainfo/MediaInfoModule.wasm" }); } })();

        const result = await mediaInfo.analyzeData(
            file.size,
            async (chunkSize, offset) => {
                const buffer = await file.slice(offset, offset + chunkSize).arrayBuffer();
                return new Uint8Array(buffer);
            }
        );

        mediaInfo.close();

        if (token !== backgroundLoadToken || media.videoFile !== file) return;

        const general = Array.isArray(result?.media?.track)
            ? result.media.track.find(track => track?.['@type'] === 'General')
            : null;

        if (!general || ["project", "manual", "lyrics-service", "lrc"].includes(state.audio.metadataSource)) return;

        const title = String(general.Title || '').trim();
        const artist = String(general.Performer || general.Album_Performer || '').trim();
        const album = String(general.Album || '').trim();

        if (title) state.audio.metadata.title = title;
        if (artist) state.audio.metadata.artist = artist;
        if (album) state.audio.metadata.album = album;

        if (title || artist || album) {
            state.audio.metadataSource = 'embedded';
            updateMetadataInputs();
            saveLinaPrefs();
            redrawCurrentPreviewFrame();
            audioStatus.textContent = file.name + ' · embedded metadata';
        }
        readEmbeddedAudioMetadata(file, token, 'video');
    } catch (error) {
        console.info('No readable embedded video metadata:', error?.message || error);
    }
}

function loadMediaTagsLibrary() {
    if (window.jsmediatags) return Promise.resolve(window.jsmediatags);
    if (!mediaTagsLoadPromise) {
        mediaTagsLoadPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = './vendor/jsmediatags/jsmediatags.min.js';
            script.onload = () => window.jsmediatags ? resolve(window.jsmediatags) : reject(new Error('Metadata reader unavailable'));
            script.onerror = () => reject(new Error('Metadata reader failed to load'));
            document.head.appendChild(script);
        }).catch(error => { mediaTagsLoadPromise = null; throw error; });
    }
    return mediaTagsLoadPromise;
}

async function readEmbeddedAudioMetadata(file, token, source = 'audio') {
    try {
        const tagsLibrary = await loadMediaTagsLibrary();
        const result = await new Promise((resolve, reject) => tagsLibrary.read(file, { onSuccess: resolve, onError: reject }));
        const sourceStillCurrent = source === 'video'
            ? token === backgroundLoadToken && media.videoFile === file
            : token === audioLoadToken && state.audio.file === file;
        if (!sourceStillCurrent) return;
        const tags = result?.tags || {};
        if (!["project", "manual", "lyrics-service", "lrc"].includes(state.audio.metadataSource)) {
            if (tags.title) state.audio.metadata.title = String(tags.title).trim();
            if (tags.artist) state.audio.metadata.artist = String(tags.artist).trim();
            if (tags.album) state.audio.metadata.album = String(tags.album).trim();
            if (tags.title || tags.artist || tags.album) state.audio.metadataSource = 'embedded';
        }
        updateMetadataInputs();
        const picture = tags.picture;
        if (picture?.data?.length) {
            setAlbumArtworkBlob(new Blob([new Uint8Array(picture.data)], { type: picture.format || 'image/jpeg' }), token);
            audioStatus.textContent = file.name + ' · embedded artwork';
        }
        saveLinaPrefs();
        redrawCurrentPreviewFrame();
        if (source !== 'video') void autoFetchLyricsForCurrentTrack(file, token);
    } catch (error) {
        console.info('No readable embedded audio metadata:', error?.message || error);
        if (source !== 'video') void autoFetchLyricsForCurrentTrack(file, token);
    }
}

const MAX_AUDIO_BYTES = 200 * 1024 * 1024;
const MAX_BACKGROUND_BYTES = 500 * 1024 * 1024;
const MAX_LRC_BYTES = 5 * 1024 * 1024;

function handleAudioFile(file) {
    if (isExporting) { toast('Finish or cancel the current export first', 'error'); return; }
    if (!file) return;
    if (file.type && !file.type.startsWith('audio/') && !/\.(mp3|m4a|aac|wav|flac|ogg|oga|opus|webm)$/i.test(file.name)) {
        toast('That doesn\'t look like an audio file', 'error');
        return;
    }
    if (file.size > MAX_AUDIO_BYTES) {
        toast('Audio file too large (max ' + Math.round(MAX_AUDIO_BYTES / 1024 / 1024) + 'MB)', 'error');
        return;
    }
    var __name = (file.name || '').toLowerCase();
    var __type = (file.type || '').toLowerCase();
    if (/\[alac\]/.test(__name) || /\balac\b/.test(__name) || __type === 'audio/x-alac') {
        toast('❌ "' + file.name + '" is a lossless ALAC file. Your browser can play it, but can\u2019t analyse it — the visualiser needs PCM/AAC. Export it as MP3 or AAC/M4A first.', 'error');
        audioStatus.textContent = file.name + ' \u2014 ALAC not supported. Export as MP3 or AAC.';
        audioStatus.className = 'status error';
        return;
    }
    const replacingAudio = Boolean(state.audio.file);
    const token = ++audioLoadToken;
    if (audioURL) URL.revokeObjectURL(audioURL);
    audioURL = URL.createObjectURL(file);
    state.audio.file = file;
    state.audio.url = audioURL;
    state.audio.duration = 0;
    state.audio.ready = false;
    if (state.audioSource) { state.audioSource.master = "uploaded"; state.audioSource.userChosen = false; }
    const parsedMeta = songFromFilename(file.name);
    state.audio.metadata = { title: parsedMeta.track || '', artist: parsedMeta.artist || '', album: '' };
    state.audio.metadataSource = 'filename';
    if (replacingAudio) {
        state.lyrics.lines = [];
        state.lyrics.plainText = '';
        state.lyrics.source = '';
        $('lyricsStatus').textContent = 'No lyrics loaded';
        $('lyricsStatus').className = 'status';
    }
    albumArtworkImage = null;
    state.audio.hasArtwork = false;
    window.kefeAlbumArt = null;
    if (albumArtworkURL) { URL.revokeObjectURL(albumArtworkURL); albumArtworkURL = null; }
    updateMetadataInputs();
    audio.src = audioURL;
    audio.load();
    audioStatus.textContent = file.name;
    audioStatus.className = 'status success';
    toast('Audio loaded: ' + file.name, 'success');
    (function() {
      var fileName = file.name;
      function onLoadError() {
        var code = audio.error ? audio.error.code : 0;
        var reason = code === 4 ? 'unsupported format or codec (Opus, AC3, unusual MP4 variants)'
                   : code === 3 ? 'file is corrupt or truncated'
                   : code === 2 ? 'network error while loading'
                   : code === 1 ? 'load was aborted'
                   : 'unknown error';
        audioStatus.textContent = fileName + ' — ' + reason;
        audioStatus.className = 'status error';
        if (typeof toast === 'function') {
          toast('❌ Could not play "' + fileName + '" — ' + reason + '. Try MP3 or re-encode to AAC/M4A.', 'error');
        }
      }
      audio.addEventListener('error', onLoadError, { once: true });
    })();
    readiness();
    readEmbeddedAudioMetadata(file, token);
}

async function detectVideoHasAudio(file, vid) {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx && file) {
            const ctx = new AudioCtx();
            try {
                const bytes = await file.arrayBuffer();
                const decoded = await new Promise((resolve, reject) => {
                    const maybePromise = ctx.decodeAudioData(bytes.slice(0), resolve, reject);
                    if (maybePromise && typeof maybePromise.then === 'function') maybePromise.then(resolve, reject);
                });
                return Boolean(decoded && decoded.numberOfChannels > 0 && decoded.length > 0);
            } finally {
                try { await ctx.close(); } catch (e) {}
            }
        }
    } catch (e) {}
    try {
        if (vid.audioTracks && vid.audioTracks.length) return true;
        if (vid.mozHasAudio) return true;
        if (vid.webkitAudioDecodedByteCount && vid.webkitAudioDecodedByteCount > 0) return true;
    } catch (e) {}
    return false;
}
function handleBackgroundFile(file) {
    if (isExporting) { toast('Finish or cancel the current export first', 'error'); return; }
    if (!file) return;
    if (!file.type || (!file.type.startsWith('image/') && !file.type.startsWith('video/'))) {
        toast('Background must be an image or video file', 'error');
        return;
    }
    if (file.size > MAX_BACKGROUND_BYTES) {
        toast('Background file too large (max ' + Math.round(MAX_BACKGROUND_BYTES / 1024 / 1024) + 'MB)', 'error');
        return;
    }
    const token = ++backgroundLoadToken;
    const candidateURL = URL.createObjectURL(file);
    if (file.type.startsWith('video/')) {
        const vid = document.createElement('video');
        vid.muted = true; vid.loop = true; vid.playsInline = true;
        vid.src = candidateURL;
        vid.load();
        vid.addEventListener('loadeddata', async function() {
            if (isExporting || token !== backgroundLoadToken) { vid.pause(); vid.src = ''; URL.revokeObjectURL(candidateURL); return; }
            const videoHasAudio = await detectVideoHasAudio(file, vid);
            if (isExporting || token !== backgroundLoadToken) { vid.pause(); vid.src = ''; URL.revokeObjectURL(candidateURL); return; }
            if (media.video && media.video !== vid) { media.video.pause(); media.video.src = ''; }
            if (backgroundURL) URL.revokeObjectURL(backgroundURL);
            backgroundURL = candidateURL;
            vid.addEventListener('ended', function() {
                if (getMasterMode() !== 'video') return;
                setPlayIcon(false);
                state.playback.isPlaying = false;
                if (!isExporting) redrawCurrentPreviewFrame();
            });
            media.video = vid;
            media.videoFile = file;
            media.image = null;
            media.videoHasAudio = videoHasAudio;
            state.background.type = 'video';
            $('backgroundStatus').textContent = file.name + (media.videoHasAudio ? ' · has audio' : '');
            $('backgroundStatus').className = 'status success';
            toast('Background video loaded' + (media.videoHasAudio ? '' : ' (no audio track)'), 'success');
            if (!state.audio.metadata.title && !state.audio.metadata.artist) {
                const guess = songFromFilename(file.name);
                if (guess.track || guess.artist) {
                    state.audio.metadata.title = guess.track;
                    state.audio.metadata.artist = guess.artist;
                    state.audio.metadataSource = 'filename-guess';
                    updateMetadataInputs();
                }
            }

            readEmbeddedVideoMetadata(file, token);
            if (!state.audio.file) {
                applyMasterSelection(media.videoHasAudio ? 'video' : 'uploaded', { userInitiated: false, silent: true });
            } else if (media.videoHasAudio && getMasterMode() !== "video") {
                if (window.kefeWizardSource === "media") {
                    state.audioSource.userChosen = false;
                    applyMasterSelection('video', { userInitiated: false, silent: true });
                } else {
                    if (media.video) media.video.muted = true;
                    state.audioSource.master = "uploaded";
                    state.audioSource.userChosen = true;
                    if (typeof syncMasterSourceUI === "function") syncMasterSourceUI();
                }
            }
            readiness();
            hasLastVideoFrame = false;
            const t = getMasterTime();
            if (Number.isFinite(vid.duration) && vid.duration > 0) vid.currentTime = wrappedVideoTime(t, vid.duration);
            redrawCurrentPreviewFrame();
        });
        vid.addEventListener('error', function() {
            URL.revokeObjectURL(candidateURL);
            if (token !== backgroundLoadToken) return;
            toast('Video failed to load', 'error');
            $('backgroundStatus').textContent = 'Error loading video';
            $('backgroundStatus').className = 'status error';
        });
    } else {
        const img = new Image();
        img.onload = function() {
            if (isExporting || token !== backgroundLoadToken) { URL.revokeObjectURL(candidateURL); return; }
            if (media.video) { media.video.pause(); media.video.src = ''; media.video = null; }
            if (backgroundURL) URL.revokeObjectURL(backgroundURL);
            backgroundURL = candidateURL;
            media.image = img;
            state.background.type = 'image';
            $('backgroundStatus').textContent = file.name;
            $('backgroundStatus').className = 'status success';
            toast('Background image loaded', 'success');
            readiness();
            redrawCurrentPreviewFrame();
        };
        img.onerror = function() {
            URL.revokeObjectURL(candidateURL);
            if (token !== backgroundLoadToken) return;
            toast('Image failed to load', 'error');
            $('backgroundStatus').textContent = 'Error loading image';
            $('backgroundStatus').className = 'status error';
        };
        img.src = candidateURL;
    }
}

const audioInput = document.getElementById('audioInput');
const audioStatus = document.getElementById('audioStatus');

function handleMediaSourceFile(file) {
    if (!file) return;
    const isVideo = (file.type && file.type.startsWith('video/')) || /\.(mp4|mov|webm|m4v|avi|mkv)$/i.test(file.name);
    if (isVideo) handleBackgroundFile(file);
    else handleAudioFile(file);
}

if (audioInput) audioInput.addEventListener('change', function () {
    const file = this.files && this.files[0];
    if (!file) return;
    handleMediaSourceFile(file);
});

const backgroundInput = $('backgroundInput');
backgroundInput.addEventListener('change', function(e) {
    handleBackgroundFile(this.files[0]);
});

$('backgroundColor').addEventListener('input', function() {
    if (isExporting) { this.value = state.background.solid || '#0A0A0A'; return; }
    state.background.solid = this.value;
    $('backgroundColorValue').textContent = this.value.toUpperCase();
    if (!media.image && !media.video) state.background.type = 'solid';
    redrawCurrentPreviewFrame();
});

['metaTitle','metaArtist','metaAlbum'].forEach(id => {
    const input = $(id);
    if (!input) return;
    input.addEventListener('input', () => {
        const key = id === 'metaTitle' ? 'title' : id === 'metaArtist' ? 'artist' : 'album';
        state.audio.metadata[key] = input.value.trim();
        state.audio.metadataSource = 'manual';
        redrawCurrentPreviewFrame();
        saveLinaPrefs();
    });
});

audio.addEventListener('loadedmetadata', function() {
    if (!Number.isFinite(this.duration) || this.duration <= 0) {
        state.audio.ready = false;
        readiness();
        toast('Audio duration could not be read', 'error');
        return;
    }
    state.audio.duration = this.duration;
    state.audio.ready = true;
    applyMasterSelection('uploaded', { userInitiated: false, silent: true });
    const seek = $('seek'); if (seek) seek.max = getMasterDuration();
    $('clock').textContent = '0:00 / ' + fmt(getMasterDuration());
    readiness();
});
audio.addEventListener('error', function() {
    state.audio.ready = false;
    readiness();
    toast('Audio error', 'error');
    audioStatus.textContent = 'Error loading audio';
    audioStatus.className = 'status error';
});
audio.addEventListener('timeupdate', function() { if (getMasterMode() === 'uploaded') state.playback.currentTime = this.currentTime || 0; });
audio.addEventListener('play', function() {
    if (getMasterMode() !== 'uploaded') return;
    setPlayIcon(true);
    state.playback.isPlaying = true;
    if (isExporting) return;
    const video = media?.video;
    if (video && video.readyState >= 2) {
        const target = wrappedVideoTime(audio.currentTime, video.duration);
        if (Math.abs(video.currentTime - target) > 0.20 && !video.seeking) video.currentTime = target;
        video.playbackRate = 1;
        video.play().catch(() => {});
    }
});
audio.addEventListener('pause', function() {
    if (getMasterMode() !== 'uploaded') return;
    setPlayIcon(false);
    state.playback.isPlaying = false;
    if (isExporting) return;
    const video = media?.video;
    if (video) {
        video.pause();
        const target = wrappedVideoTime(audio.currentTime, video.duration);
        if (Number.isFinite(video.duration) && !video.seeking) video.currentTime = target;
    }
    redrawCurrentPreviewFrame();
});
audio.addEventListener('ended', function() { if (getMasterMode() === 'none') return; setPlayIcon(false); state.playback.isPlaying = false; if (!isExporting) redrawCurrentPreviewFrame(); });
audio.addEventListener('seeked', function() { if (!isExporting) redrawCurrentPreviewFrame(); });

async function togglePlayback() {
    if (exportClockTime !== null) return;
    const mode = getMasterMode();
    if (mode === 'video') {
        const v = media?.video;
        if (v) {
            if (v.paused) {
                v.muted = false;
                try { await v.play(); } catch(e) { toast('Playback error', 'error'); }
                setPlayIcon(true); state.playback.isPlaying = true;
            } else {
                v.pause(); setPlayIcon(false); state.playback.isPlaying = false;
            }
        }
        redrawCurrentPreviewFrame();
        return;
    }
    if (mode === 'none') {
        if (noneClockRunning) { stopNoneClock(); setPlayIcon(false); state.playback.isPlaying = false; }
        else { startNoneClock(getMasterTime()); setPlayIcon(true); state.playback.isPlaying = true; }
        redrawCurrentPreviewFrame();
        return;
    }
    if (audio.paused) { try { await audio.play(); } catch(e) { toast('Playback error', 'error'); } }
    else audio.pause();
}
$('playBtn').addEventListener('click', togglePlayback);

function seekPreview(target) {
    if (isExporting) return;
    if (!Number.isFinite(target)) return;
    setMasterTime(target);
    redrawCurrentPreviewFrame();
}
$('seek').addEventListener('pointerdown', function() { userScrubbing = true; if (!isExporting) media?.video?.pause(); });
$('seek').addEventListener('input', function(e) {
    if (exportClockTime !== null) return;
    const target = Number(e.target.value);
    if (!Number.isFinite(target)) return;
    seekPreview(target);
});
function finishScrubbing() {
    if (!userScrubbing) return;
    userScrubbing = false;
    if (isExporting) return;
    const mode = getMasterMode();
    if (mode === 'uploaded' && !audio.paused) media?.video?.play().catch(() => {});
    else if (mode === 'video') media?.video?.play().catch(() => {});
}
$('seek').addEventListener('pointerup', finishScrubbing);
$('seek').addEventListener('change', finishScrubbing);
function stopPlayback() {
    if (isExporting) return;
    const mode = getMasterMode();
    if (mode === 'video') { if (media?.video) { media.video.pause(); media.video.currentTime = 0; } }
    else if (mode === 'none') { stopNoneClock(); }
    else { audio.pause(); audio.currentTime = 0; }
    state.playback.currentTime = 0;
    if (media?.video && mode === 'uploaded' && Number.isFinite(media.video.duration) && media.video.duration > 0) media.video.currentTime = 0;
    redrawCurrentPreviewFrame();
}
$('stopBtn').addEventListener('click', stopPlayback);

const MASTER_MODES = ['uploaded', 'video'];
const MASTER_MODE_LABELS = {
    uploaded: 'Uploaded Audio',
    video: 'Background Video Audio',
};
function masterModeAvailable(mode) {
    if (mode === 'uploaded') return Boolean(state.audio.file);
    if (mode === 'video') return Boolean(media.video && media.videoFile && media.videoHasAudio);
    return false;
}
function applyMasterSelection(mode, opts = {}) {
    const userInitiated = Boolean(opts.userInitiated);
    const silent = Boolean(opts.silent);
    if (!MASTER_MODES.includes(mode)) return false;
    if (userInitiated && !masterModeAvailable(mode)) {
        toast('That audio source is not available right now', 'error');
        syncMasterSourceUI();
        return false;
    }
    if (!userInitiated && state.audioSource.userChosen) {
        syncMasterSourceUI();
        return false;
    }
    if (isExporting) { toast('Finish or cancel the current export first', 'error'); return false; }
    if (isMasterPlaying()) { pauseMasterPlayback(); }
    const previous = getMasterMode();
    state.audioSource.master = mode;
    if (userInitiated) {
        state.audioSource.userChosen = true;
        if (!silent && state.lyrics.lines.length) {
            toast('Timed text was synchronized against another source — it may no longer match the new master audio', '');
            console.warn('[KEFE] Master audio source changed while timed text exists; the text may be out of sync.');
        }
    }
    if (previous !== mode) {
        if (mode === 'uploaded' && state.audio.file) {
            if (!audio.src || audio.src !== state.audio.url) { audio.src = state.audio.url; audio.load(); }
            if (media?.video) { media.video.muted = true; media.video.loop = true; }
        } else if (mode === 'video' && media.video) {
            media.video.muted = false;
            media.video.loop = false;
            if (audio && !audio.paused) audio.pause();
        } else {
            if (audio && !audio.paused) audio.pause();
            if (media?.video) { media.video.muted = true; media.video.loop = true; if (!media.video.paused) media.video.pause(); }
        }
    }
    syncMasterSourceUI();
    readiness();
    redrawCurrentPreviewFrame();
    return true;
}
function pauseMasterPlayback() {
    const mode = getMasterMode();
    if (mode === 'uploaded' && !audio.paused) audio.pause();
    else if (mode === 'video' && media?.video && !media.video.paused) media.video.pause();
    else if (mode === 'none' && noneClockRunning) stopNoneClock();
}
function renderMasterSourceUI() {
    const box = $('audioSourceButtons');
    if (!box) return;
    if (box.dataset.wired !== '1') {
        box.dataset.wired = '1';
        for (const mode of MASTER_MODES) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.dataset.master = mode;
            btn.textContent = MASTER_MODE_LABELS[mode];
            btn.addEventListener('click', () => {
                const ok = applyMasterSelection(mode, { userInitiated: true, silent: false });
                if (ok) toast(MASTER_MODE_LABELS[mode] + ' is now the audio source', 'success');
            });
            box.appendChild(btn);
        }
    }
    syncMasterSourceUI();
}
function syncMasterSourceUI() {
    const mode = getMasterMode();
    const buttons = qsa('#audioSourceButtons button');
    buttons.forEach(b => {
        b.classList.toggle('active-effect', b.dataset.master === mode);
        b.disabled = !masterModeAvailable(b.dataset.master) && b.dataset.master !== mode;
    });
    const status = $('audioSourceStatus');
    if (!status) return;
    const uploadedDur = Number.isFinite(state.audio.duration) && state.audio.duration > 0 ? fmt(state.audio.duration) : '—';
    const videoDur = media?.video && Number.isFinite(media.video.duration) && media.video.duration > 0 ? fmt(media.video.duration) : '—';
    const parts = [];
    parts.push(`<strong>${MASTER_MODE_LABELS[mode] || mode}</strong>`);
    parts.push(`Uploaded: ${uploadedDur}`);
    parts.push(`Video audio: ${media?.videoHasAudio ? videoDur + ' (available)' : '—'}`);
    if (mode === 'video') parts.push('The background video audio drives the timeline.');
    if (mode === 'video' && !state.audio.metadata.title) parts.push('Add a song title above to search for synced lyrics.');
    if (mode === 'none') parts.push('No audio will be heard or exported.');
    status.innerHTML = parts.join(' · ');
}

const masterAudioChoiceModal = $('masterAudioChoice');
function promptMasterAudioChoice() {
    if (!masterAudioChoiceModal) return;
    const info = $('masterAudioChoiceInfo');
    if (info) {
        const uploadedDur = Number.isFinite(state.audio.duration) && state.audio.duration > 0 ? fmt(state.audio.duration) : '—';
        const videoDur = media?.video && Number.isFinite(media.video.duration) && media.video.duration > 0 ? fmt(media.video.duration) : '—';
        info.innerHTML = `Uploaded audio: ${uploadedDur} &middot; Video audio: ${videoDur}`;
    }
    masterAudioChoiceModal.classList.remove('hidden');
}
function closeMasterAudioChoice() { masterAudioChoiceModal?.classList.add('hidden'); }
if (masterAudioChoiceModal) {
    qsa('#masterAudioChoice [data-master]').forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.master;
            state.audioSource.userChosen = false;
            applyMasterSelection(mode, { userInitiated: true, silent: mode === getMasterMode() });
            closeMasterAudioChoice();
        });
    });
}

let resetConfirmTimer = null;
function disarmReset() {
    clearTimeout(resetConfirmTimer);
    resetConfirmTimer = null;
    const button = $('resetBtn');
    button.dataset.confirmed = '';
    button.textContent = 'Reset';
    button.classList.remove('confirming');
    button.setAttribute('aria-label', 'Reset project');
}
function armReset() {
    const button = $('resetBtn');
    button.dataset.confirmed = 'true';
    button.textContent = 'Are you sure?';
    button.classList.add('confirming');
    button.setAttribute('aria-label', 'Confirm project reset');
    clearTimeout(resetConfirmTimer);
    resetConfirmTimer = setTimeout(disarmReset, 4500);
}
function resetProject() {
    if (isExporting) {
        toast('Finish or cancel the current export first', 'error');
        return;
    }
    const button = $('resetBtn');
    if (button.dataset.confirmed !== 'true') {
        armReset();
        return;
    }
    clearTimeout(resetConfirmTimer);
    window.location.href = new URL('./', window.location.href).href;
}
$('resetBtn').addEventListener('click', resetProject);
document.addEventListener('click', event => {
    if (event.target !== $('resetBtn') && $('resetBtn').dataset.confirmed === 'true') disarmReset();
});
document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && $('resetBtn').dataset.confirmed === 'true') disarmReset();
});

function resolveAudioLabels(audioState = state.audio) {
    const metadata = audioState?.metadata || {};
    const fallback = audioState?.file ? songFromFilename(audioState.file.name) : { track: '', artist: '' };
    const fallbackTitle = cleanTrackName(fallback.track);
    const fallbackArtist = String(fallback.artist || '').trim();
    const useWebsiteFields = audioState === state.audio;
    const titleField = useWebsiteFields ? $('metaTitle') : null;
    const artistField = useWebsiteFields ? $('metaArtist') : null;
    const albumField = useWebsiteFields ? $('metaAlbum') : null;
    let title = cleanTrackName(titleField ? titleField.value : metadata.title);
    let artist = String(artistField ? artistField.value : (metadata.artist || '')).trim();
    const album = String(albumField ? albumField.value : (metadata.album || '')).trim();

    if (!isUsefulExportLabel(title)) title = fallbackTitle;
    if (!isUsefulExportLabel(artist)) artist = fallbackArtist;
    return {
        title: String(title || '').trim(),
        artist: String(artist || '').trim(),
        album
    };
}

function updateGoogleLyricsButton() {
    const button = $('searchGoogleLyricsBtn');
    if (!button) return;
    const resolved = resolveAudioLabels(state.audio);
    button.disabled = !(resolved.title && resolved.artist);
}

$('searchGoogleLyricsBtn').addEventListener('click', function() {
    const resolved = resolveAudioLabels(state.audio);
    if (!resolved.title || !resolved.artist) {
        updateGoogleLyricsButton();
        return;
    }
    const query = `${resolved.artist} ${resolved.title} lyrics lrc`;
    const url = 'https://www.google.com/search?q=' + encodeURIComponent(query);
    window.open(url, '_blank', 'noopener,noreferrer');
});

['metaArtist', 'metaTitle'].forEach(id => $(id)?.addEventListener('input', updateGoogleLyricsButton));
updateGoogleLyricsButton();

$('findLyricsBtn').addEventListener('click', async function() {
    if (isExporting) { toast('Finish or cancel the current export first', 'error'); return; }
    let resolved = resolveAudioLabels(state.audio);
    let artist = resolved.artist;
    let track = resolved.title;

    if (!track || !artist) {
        const media = window.kefeMedia || {};
        const sourceFile = (media.videoFile && media.videoFile.name) ||
                           (state.audio && state.audio.file && state.audio.file.name) ||
                           '';
        if (sourceFile) {
            const guessed = songFromFilename(sourceFile);
            if (!track && guessed.track) track = guessed.track;
            if (!artist && guessed.artist) artist = guessed.artist;
            track = String(track || '')
                .replace(/\s*[\(\[][^\)\]]*[\)\]]\s*$/g, '')
                .replace(/\s+(official|lyric|lyrics|audio|visuali[sz]er|video|HD|4K)\s*$/ig, '')
                .trim();
            artist = String(artist || '').trim();
            if (track && $('metaTitle') && !$('metaTitle').value.trim()) $('metaTitle').value = track;
            if (artist && $('metaArtist') && !$('metaArtist').value.trim()) $('metaArtist').value = artist;
            if (track) state.audio.metadata.title = track;
            if (artist) state.audio.metadata.artist = artist;
        }
    }

    if (!track || !artist) {
        const missing = !track && !artist
            ? 'Enter the song title and artist first'
            : (!track ? 'Enter the song title first' : 'Enter the artist first');
        $('lyricsStatus').textContent = missing;
        $('lyricsStatus').className = 'status error';
        toast(missing, 'error');
        return;
    }
    $('lyricsStatus').textContent = 'Searching...';
    $('lyricsStatus').className = 'status loading';
    this.disabled = true;
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 18000);
        let match;
        try {
            match = await requestSyncedLyrics(artist, track, getMasterDuration() || state.audio.duration || audio.duration, controller.signal);
        } catch (fetchErr) {
            throw new Error(fetchErr.name === 'AbortError' ? 'Lyrics search timed out' : (fetchErr.message || 'Lyrics search failed (network error)'));
        } finally {
            clearTimeout(timeoutId);
        }
        if (!match || !match.syncedLyrics) throw new Error('No synced lyrics');
        const parsed = parseLyrics(match.syncedLyrics);
        if (!parsed.lines.length) throw new Error('No valid timed lyrics found');
        if (isExporting) return;
        state.lyrics.lines = parsed.lines;
        if (match.trackName) state.audio.metadata.title = String(match.trackName).trim();
        if (match.artistName) state.audio.metadata.artist = String(match.artistName).trim();
        if (match.albumName) state.audio.metadata.album = String(match.albumName).trim();
        if (match.trackName || match.artistName || match.albumName) state.audio.metadataSource = 'lyrics-service';
        updateMetadataInputs();

        document.dispatchEvent(new CustomEvent('kefe:lyrics-resolved', {
            detail: { source: 'lrclib', artist, track, lines: state.lyrics.lines }
        }));

        $('lyricsStatus').textContent = parsed.lines.length + ' lines loaded' + (parsed.skippedCount ? ' (' + parsed.skippedCount + ' unparsable line' + (parsed.skippedCount === 1 ? '' : 's') + ' skipped)' : '');
        $('lyricsStatus').className = 'status success';
        toast('Lyrics loaded' + (parsed.skippedCount ? ', ' + parsed.skippedCount + ' line(s) could not be parsed' : ''), 'success');
        readiness();
        redrawCurrentPreviewFrame();
    } catch(error) {
        if (isExporting) return;
        $('lyricsStatus').textContent = error.message;
        $('lyricsStatus').className = 'status error';
        toast(error.message, 'error');
    }
    this.disabled = false;
});

$('aspectSelect')?.addEventListener('change', function() { setAspectRatio(this.value); });

$('editLyricsBtn').addEventListener('click', function() {
    if (isExporting) { toast('Finish or cancel the current export first', 'error'); return; }
    if (state.lyrics.lines.length) {
        let text = '';
        for (const line of state.lyrics.lines) {
            text += '[' + formatTime(line.time) + ']' + line.text + '\n';
        }
        $('lyricsText').value = text;
    }
    $('lyricsEditor').classList.remove('hidden');
});
$('closeEditor').addEventListener('click', () => $('lyricsEditor').classList.add('hidden'));
$('cancelEditor').addEventListener('click', () => $('lyricsEditor').classList.add('hidden'));
$('pasteLyrics').addEventListener('click', async function() {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
        $('editorStatus').textContent = window.isSecureContext
            ? 'Clipboard paste isn\'t supported in this browser — try Ctrl/Cmd+V into the box instead'
            : 'Clipboard paste needs HTTPS — try Ctrl/Cmd+V into the box instead';
        $('editorStatus').className = 'status error';
        return;
    }
    try {
        const text = await navigator.clipboard.readText();
        if (!text) {
            $('editorStatus').textContent = 'Clipboard is empty';
            $('editorStatus').className = 'status error';
            return;
        }
        $('lyricsText').value = text;
        $('editorStatus').textContent = 'Pasted from clipboard';
        $('editorStatus').className = 'status success';
    } catch(err) {
        $('editorStatus').textContent = err?.name === 'NotAllowedError'
            ? 'Clipboard permission denied — allow it or paste manually with Ctrl/Cmd+V'
            : 'Could not read clipboard — try Ctrl/Cmd+V into the box instead';
        $('editorStatus').className = 'status error';
    }
});
async function loadLrcFile(file, openEditor = false) {
    if (!file) return;
    const name = String(file.name || '');
    const type = String(file.type || '').toLowerCase();
    const isLrc = /\.lrc$/i.test(name);
    const isTxt = /\.txt$/i.test(name);
    const acceptedType = !type || type === 'text/plain' || type === 'application/octet-stream';
    if (!isLrc && !(isTxt && acceptedType)) {
        toast('Choose an .lrc or .txt file', 'error');
        return;
    }
    if (file.size > MAX_LRC_BYTES) {
        toast('Lyrics file too large (max 5MB)', 'error');
        return;
    }
    try {
        let raw = await file.text();
        if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
        if (/\u0000/.test(raw) || /[\uFFFD]/.test(raw)) {
            const bytes = new Uint8Array(await file.arrayBuffer());
            raw = new TextDecoder('utf-16').decode(bytes);
            if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
        }
        const parsed = parseLyrics(raw);
        if (!parsed.lines.length) throw new Error('No valid timed lyrics found in ' + file.name);
        $('lyricsText').value = raw;
        state.lyrics.lines = parsed.lines;
        state.lyrics.plainText = '';
        state.lyrics.source = 'lrc';
        if (parsed.metadata?.title) state.audio.metadata.title = parsed.metadata.title;
        if (parsed.metadata?.artist) state.audio.metadata.artist = parsed.metadata.artist;
        if (parsed.metadata?.album) state.audio.metadata.album = parsed.metadata.album;
        if (parsed.metadata?.title || parsed.metadata?.artist || parsed.metadata?.album) state.audio.metadataSource = 'lrc';
        updateMetadataInputs();
        if (parsed.metadata?.artwork) await setAlbumArtworkReference(parsed.metadata.artwork);
        $('lyricsStatus').textContent = parsed.lines.length + ' synced lines loaded';
        $('lyricsStatus').className = 'status success';
        $('editorStatus').textContent = 'Loaded ' + file.name;
        $('editorStatus').className = 'status success';
        readiness();
        redrawCurrentPreviewFrame();
        toast('Loaded ' + file.name, 'success');
        if (openEditor) $('lyricsEditor').classList.remove('hidden');
    } catch (error) {
        $('lyricsStatus').textContent = error.message;
        $('lyricsStatus').className = 'status error';
        toast(error.message, 'error');
    }
}
$('uploadLrcMain').addEventListener('click', () => $('lrcFileInput').click());
$('lrcFileInput').addEventListener('change', function() {
    loadLrcFile(this.files?.[0]);
    this.value = '';
});
$('uploadLrc').addEventListener('click', () => $('lrcFileInput').click());
$('saveLyrics').addEventListener('click', function() {
    if (isExporting) { toast('Finish or cancel the current export first', 'error'); return; }
    const raw = $('lyricsText').value.trim();
    if (!raw) {
        $('editorStatus').textContent = 'No lyrics to save';
        $('editorStatus').className = 'status error';
        return;
    }
    try {
        const parsed = parseLyrics(raw);
        if (!parsed.lines.length) {
            $('editorStatus').textContent = 'No valid timed lyrics found';
            $('editorStatus').className = 'status error';
            return;
        }
        state.lyrics.lines = parsed.lines;
        if (parsed.metadata?.title) state.audio.metadata.title = parsed.metadata.title;
        if (parsed.metadata?.artist) state.audio.metadata.artist = parsed.metadata.artist;
        if (parsed.metadata?.album) state.audio.metadata.album = parsed.metadata.album;
        if (parsed.metadata?.title || parsed.metadata?.artist || parsed.metadata?.album) {
            state.audio.metadataSource = 'lrc';
            updateMetadataInputs();
        }
        $('lyricsStatus').textContent = parsed.lines.length + ' lines loaded' + (parsed.skippedCount ? ' (' + parsed.skippedCount + ' unparsable line' + (parsed.skippedCount === 1 ? '' : 's') + ' skipped)' : '');
        $('lyricsStatus').className = 'status success';
        $('editorStatus').textContent = 'Saved ' + parsed.lines.length + ' lines' + (parsed.skippedCount ? ', skipped ' + parsed.skippedCount + ' unparsable line' + (parsed.skippedCount === 1 ? '' : 's') : '');
        $('editorStatus').className = parsed.skippedCount ? 'status' : 'status success';
        toast(parsed.skippedCount ? 'Lyrics saved, ' + parsed.skippedCount + ' line(s) skipped' : 'Lyrics saved', 'success');
        readiness();
        redrawCurrentPreviewFrame();
        setTimeout(() => $('lyricsEditor').classList.add('hidden'), 800);
    } catch(err) {
        $('editorStatus').textContent = err.message;
        $('editorStatus').className = 'status error';
    }
});

async function openExportPreflight() {
    window.kefeSmartRender?.prepare?.();
    if (isExporting) return;
    const issues = projectValidationIssues();
    if (issues.length) { toast('Before export, add: ' + issues.join(', '), 'error'); return; }
    ensureDefaultBackground();
    const preflightPreset = $('exportPreset').value;
    const preflightAspect = state.aspect || '9:16';
    const preflightSizes = {
      '1080p': { '9:16':[1080,1920], '1:1':[1080,1080], '16:9':[1920,1080] },
      '720p':  { '9:16':[720,1280],  '1:1':[720,720],   '16:9':[1280,720]  },
      '480p':  { '9:16':[480,854],   '1:1':[480,480],   '16:9':[854,480]   },
      'instagram': { '9:16':[1080,1920], '1:1':[1080,1080], '16:9':[1920,1080] },
      'tiktok':    { '9:16':[1080,1920], '1:1':[1080,1080], '16:9':[1920,1080] }
    };
    const preflightFps = { '480p': 24, '720p': 30, '1080p': 30, 'instagram': 30, 'tiktok': 30 };
    const preflightKey = preflightSizes[preflightPreset] ? preflightPreset : '720p';
    const preflightDims = preflightSizes[preflightKey][preflightAspect] || preflightSizes[preflightKey]['9:16'];
    const config = {
      width: preflightDims[0],
      height: preflightDims[1],
      fps: preflightFps[preflightKey] || 30
    };
    const duration = getMasterDuration();
    const totalFrames = Math.ceil(duration * config.fps);
    const report = validateLyricTiming(state.lyrics.lines, duration);
    const demand = config.width * config.height * config.fps * duration;
    const demandLabel = demand > 1.2e11 ? 'Very high' : demand > 5e10 ? 'High' : demand > 1.8e10 ? 'Moderate' : 'Light';
    const masterLabel = MASTER_MODE_LABELS[getMasterMode()] || getMasterMode();
    const rows = [
        ['Output', `${config.width} × ${config.height}`], ['Frame rate', `${config.fps} fps`],
        ['Duration', fmt(duration)], ['Frames', totalFrames.toLocaleString()],
        ['Master audio', masterLabel + (getMasterMode() === 'none' ? ' (muted)' : '')],
        ['Text', activeTimedLines().length
            ? `${activeTextMode() === 'captions' ? 'Captions' : 'Lyrics'} · ${activeTimedLines().length} lines`
            : 'None — visual only'],
        ['Background', media.image ? 'Image background' : media.video ? 'Video background' : `Solid ${state.background.solid}`],
        ['Device demand', demandLabel]
    ];
    $('preflightSummary').replaceChildren(...rows.map(([label, value]) => {
        const row = document.createElement('div'); row.className = 'preflight-row';
        const left = document.createElement('span'); left.textContent = label;
        const right = document.createElement('strong'); right.textContent = value;
        row.append(left, right); return row;
    }));
    const warnings = [...report.warnings];
    if (demandLabel === 'High' || demandLabel === 'Very high') warnings.unshift('This export may take a long time on a phone. The finished MP4 timing will remain frame-accurate.');

    const syncReport = assessSyncQuality();
    const preflightRepair = $('preflightRepair');
    if (syncReport.problems.length) {
        $('preflightWarning').textContent = '⚠ ' + syncReport.problems.join(' · ');
        $('preflightWarning').classList.remove('hidden');
        preflightRepair.innerHTML = '';
        syncReport.solutions.forEach((sol, i) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'primary';
            btn.textContent = sol.label;
            btn.addEventListener('click', () => {
                sol.apply();
                openExportPreflight();
            });
            preflightRepair.appendChild(btn);
        });
    } else {
        $('preflightWarning').textContent = warnings.join(' ');
        $('preflightWarning').classList.toggle('hidden', warnings.length === 0);
        preflightRepair.innerHTML = '';
    }
    $('exportPreflight').classList.remove('hidden');
}

function assessSyncQuality() {
    const lines = activeTimedLines();
    const duration = getMasterDuration();
    const report = validateLyricTiming(lines, duration);
    const problems = [];
    const solutions = [];

    if (report.errors.length) {
        problems.push(report.errors[0]);
    }
    if (lines.length && Number.isFinite(duration) && duration > 0) {
        const first = Number(lines[0]?.time);
        const last = Number(lines[lines.length - 1]?.time);
        if (Number.isFinite(last) && duration - last > 30) {
            problems.push(`Lyrics end ${Math.round(duration - last)}s before the audio finishes`);
            solutions.push({
                label: '1. Stretch lyrics to fill the track',
                apply: () => stretchLyricsToDuration(duration)
            });
            solutions.push({
                label: '2. Trim audio to the lyrics',
                apply: () => trimMasterToLyrics(duration, last)
            });
        }
        if (Number.isFinite(first) && first > 3 && duration > 3) {
            problems.push(`First lyric starts ${Math.round(first)}s in — likely a sync offset`);
            solutions.push({
                label: '3. Shift all lyrics earlier',
                apply: () => nudgeLyricTiming(-first)
            });
        }
    }
    const seen = new Set();
    return {
        problems: problems.length ? problems : ['Sync check passed'],
        solutions: solutions.filter(s => { if (seen.has(s.label)) return false; seen.add(s.label); return true; })
    };
}

function stretchLyricsToDuration(duration) {
    const mode = activeTextMode();
    const store = mode === 'captions' ? state.captions : state.lyrics;
    if (!store.lines.length) { toast('Load lyrics first', 'error'); return; }
    const last = Number(store.lines[store.lines.length - 1]?.time);
    if (!Number.isFinite(last) || last <= 0) { toast('Cannot stretch: last line has no time', 'error'); return; }
    const scale = duration / last;
    if (!Number.isFinite(scale) || scale <= 0) { toast('Invalid duration', 'error'); return; }
    store.lines = store.lines.map(line => {
        const copy = { ...line, time: Math.max(0, Number(line.time) * scale) };
        if (Number.isFinite(Number(line.endTime))) copy.endTime = Math.max(copy.time, Number(line.endTime) * scale);
        if (Array.isArray(line.words)) copy.words = line.words.map(w => ({
            ...w,
            time: Math.max(0, Number(w.time) * scale),
            endTime: Number.isFinite(Number(w.endTime)) ? Math.max(0, Number(w.endTime) * scale) : null
        }));
        return copy;
    });
    refreshLyricsTimingStatus();
    redrawCurrentPreviewFrame();
    toast(`Lyrics stretched to fit ${fmt(duration)} track`, 'success');
}

function trimMasterToLyrics(duration, lastLyricTime) {
    const mode = getMasterMode();
    if (mode === 'video' && media?.video) {
        try { media.video.currentTime = 0; } catch (e) {}
        toast(`Video will export up to ${fmt(lastLyricTime)} — the tail is silent`, 'info');
    } else if (mode === 'uploaded' && state.audio?.file) {
        toast(`Audio will export up to ${fmt(lastLyricTime)} — the tail is silent`, 'info');
    } else {
        toast('Trim applies to the master source on export', 'info');
    }
    state.playback.trimTo = lastLyricTime;
}

function closeExportPreflight() { $('exportPreflight').classList.add('hidden'); }
$('closePreflight').addEventListener('click', closeExportPreflight);
$('cancelPreflight').addEventListener('click', closeExportPreflight);

$('exportBottom').addEventListener('click', openExportPreflight);

document.addEventListener('keydown', function(e) {
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    switch(e.key) {
        case ' ': e.preventDefault(); togglePlayback(); break;
        case 'ArrowLeft': e.preventDefault(); seekPreview(Math.max(0, getMasterTime() - 5)); break;
        case 'ArrowRight': e.preventDefault(); seekPreview(Math.min(getMasterDuration(), getMasterTime() + 5)); break;
        case '1': document.querySelector('[data-effect="apple"]')?.click(); break;
        case '2': document.querySelector('[data-effect="brat"]')?.click(); break;
        case '3': document.querySelector('[data-effect="eternal"]')?.click(); break;
        case 'e': case 'E': openExportPreflight(); break;
        case 'f': case 'F':
            if (document.fullscreenElement) document.exitFullscreen();
            else document.querySelector('.preview')?.requestFullscreen().catch(() => {});
            break;
        case '0': stopPlayback(); break;
    }
});

function setupDropZone(zone, inputId) {
    if (!zone) return;
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => {
        e.preventDefault();
        zone.classList.remove('dragover');
        const file = e.dataTransfer?.files?.[0];
        if (!file) return;
        if (inputId === 'audioInput') handleMediaSourceFile(file);
        if (inputId === 'backgroundInput') handleBackgroundFile(file);
    });
}
setupDropZone($('audioDrop'), 'audioInput');
setupDropZone($('bgDrop'), 'backgroundInput');

function syncTitleCardUI() {
    const toggle = $('titleCardEnabled');
    if (toggle) toggle.checked = state.style.titleCardEnabled !== false;
    const dur = $('titleCardDuration');
    if (dur) dur.value = String(linaClamp(Number(state.style.titleCardDuration) || 3, 1, 15));
    const durVal = $('titleCardDurationVal');
    if (durVal) durVal.textContent = `${linaClamp(Number(state.style.titleCardDuration) || 3, 1, 15)}s`;
    const styleSel = $('titleCardStyle');
    if (styleSel) styleSel.value = state.style.titleCardStyle || 'auto';
    updateTitleCardHint();
}
function updateTitleCardHint() {
    const hint = $('titleCardStyleHint');
    if (!hint) return;
    const chosen = state.style.titleCardStyle || 'auto';
    const resolved = resolveTitleCardDesign(state);
    const labels = { auto: 'Auto (matches effect)', minimal: 'Minimal', spotlight: 'Spotlight', editorial: 'Editorial', statement: 'Statement' };
    hint.textContent = chosen === 'auto' ? `Auto → ${labels[resolved]}` : labels[chosen] || '';
}
function wireTitleCardControls() {
    $('titleCardEnabled')?.addEventListener('change', function() {
        if (isExporting) { this.checked = state.style.titleCardEnabled; toast('Finish or cancel the current export first', 'error'); return; }
        state.style.titleCardEnabled = this.checked;
        markSectionTouched('title');
        redrawCurrentPreviewFrame();
    });
    $('titleCardStyle')?.addEventListener('change', function() {
        if (isExporting) { this.value = state.style.titleCardStyle || 'auto'; toast('Finish or cancel the current export first', 'error'); return; }
        state.style.titleCardStyle = this.value;
        markSectionTouched('title');
        updateTitleCardHint();
        redrawCurrentPreviewFrame();
    });
    $('titleCardDuration')?.addEventListener('input', function() {
        if (isExporting) { this.value = String(state.style.titleCardDuration || 3); return; }
        state.style.titleCardDuration = linaClamp(Number(this.value) || 3, 1, 15);
        $('titleCardDurationVal').textContent = `${state.style.titleCardDuration}s`;
        markSectionTouched('title');
        redrawCurrentPreviewFrame();
    });
}

function applyTextMode(mode) {
    state.captions.mode = mode === 'captions' ? 'captions' : 'lyrics';
    qsa('[data-text-mode]').forEach(b => {
        const active = b.dataset.textMode === state.captions.mode;
        b.classList.toggle('active', active);
        b.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    $('lyricsPanel')?.classList.toggle('hidden', state.captions.mode !== 'lyrics');
    $('captionsPanel')?.classList.toggle('hidden', state.captions.mode !== 'captions');
    $('lyricStyleBlock')?.classList.toggle('hidden', state.captions.mode === 'captions');
    const badge = $('previewModeBadge');
    if (badge) badge.textContent = state.captions.mode === 'captions' ? 'Captions' : 'Lyrics';
    refreshLyricsTimingStatus();
    redrawCurrentPreviewFrame();
}

const CAPTION_POSITIONS = ['bottom', 'top'];
function applyCaptionPosition(pos) {
    state.captionStyle.position = CAPTION_POSITIONS.includes(pos) ? pos : 'bottom';
    qsa('[data-caption-pos]').forEach(b => b.classList.toggle('active-effect', b.dataset.captionPos === state.captionStyle.position));
    redrawCurrentPreviewFrame();
}
function syncCaptionStyleUI() {
    const cs = state.captionStyle || {};
    qsa('[data-caption-pos]').forEach(b => b.classList.toggle('active-effect', b.dataset.captionPos === (cs.position || 'bottom')));
    const opacityPct = Math.round(linaClamp(Number(cs.opacity) || 1, 0.3, 1) * 100);
    const op = $('captionOpacity');
    if (op) op.value = String(opacityPct);
    const opVal = $('captionOpacityVal');
    if (opVal) opVal.textContent = `${opacityPct}%`;
    const colour = $('captionColor');
    if (colour && /^#[0-9a-f]{6}$/i.test(cs.color || '')) colour.value = cs.color;
    const shadow = $('captionShadow');
    if (shadow) shadow.checked = cs.shadow !== false;
}
function wireCaptionStyleControls() {
    qsa('[data-caption-pos]').forEach(btn => btn.addEventListener('click', () => {
        if (isExporting) { syncCaptionStyleUI(); return; }
        applyCaptionPosition(btn.dataset.captionPos);
    }));
    $('captionOpacity')?.addEventListener('input', function() {
        if (isExporting) { this.value = String(Math.round((Number(state.captionStyle.opacity) || 1) * 100)); return; }
        state.captionStyle.opacity = linaClamp(Number(this.value) / 100, 0.3, 1);
        const opVal = $('captionOpacityVal');
        if (opVal) opVal.textContent = `${Math.round(state.captionStyle.opacity * 100)}%`;
        redrawCurrentPreviewFrame();
    });
    $('captionColor')?.addEventListener('input', function() {
        if (isExporting) { this.value = state.captionStyle.color || '#FFFFFF'; return; }
        if (/^#[0-9a-f]{6}$/i.test(this.value)) state.captionStyle.color = this.value;
        redrawCurrentPreviewFrame();
    });
    $('captionShadow')?.addEventListener('change', function() {
        if (isExporting) { this.checked = state.captionStyle.shadow !== false; return; }
        state.captionStyle.shadow = this.checked;
        redrawCurrentPreviewFrame();
    });
}

window.kefeSetProjectType = function(type) {
    if (!PROJECT_TYPES.includes(type)) return;
    if (state.projectType === type) return;
    state.projectType = type;
    if (type === 'captioned') {
        if (typeof applyTextMode === 'function') applyTextMode('captions');
        else state.captions.mode = 'captions';
    } else if (type === 'lyric' && state.captions.mode === 'captions') {
        if (typeof applyTextMode === 'function') applyTextMode('lyrics');
        else state.captions.mode = 'lyrics';
    }
    readiness();
    redrawCurrentPreviewFrame();
};

const CAPTION_MIN_SEGMENT = 0.5;
const CAPTION_MERGE_GAP = 0.35;
const CAPTION_PAD_HEAD = 0.10;
const CAPTION_PAD_TAIL = 0.28;
const CAPTION_MAX_BLOCKS = 2000;
async function autoGenerateCaptions() {
    if (isExporting) { toast('Finish or cancel the current export first', 'error'); return; }
    const mode = getMasterMode();
    const file = mode === 'video' ? media?.videoFile : state.audio.file;
    if (!file) {
        $('captionsStatus').textContent = 'Add an audio file (or a video with sound) in Step 01 first — captions are generated from its sound.';
        $('captionsStatus').className = 'status error';
        toast('Add audio first — captions are generated from sound', 'error');
        return;
    }
    const button = $('autoCaptionsBtn');
    if (button) button.disabled = true;
    $('captionsStatus').textContent = 'Analysing audio for speech and vocals…';
    $('captionsStatus').className = 'status loading';
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) throw new Error('This browser cannot analyse audio');
        const buffer = await file.arrayBuffer();
        const actx = new AudioCtx();
        const decoded = await actx.decodeAudioData(buffer);
        const sampleRate = decoded.sampleRate;
        const data = decoded.getChannelData(0);
        const win = Math.max(1, Math.round(sampleRate * 0.05));
        const rms = [];
        for (let i = 0; i + win <= data.length; i += win) {
            let sum = 0;
            for (let j = i; j < i + win; j += 4) sum += data[j] * data[j];
            rms.push(Math.sqrt(sum / (win / 4)));
        }
        actx.close?.();
        if (!rms.length) throw new Error('Audio is too short to analyse');
        const sorted = rms.slice().sort((a, b) => a - b);
        const floor = sorted[Math.floor(sorted.length * 0.10)] || 0;
        const peak = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.98))] || 1;
        const threshold = Math.max(0.012, floor + (peak - floor) * 0.14);
        const minWindows = Math.max(1, Math.round(CAPTION_MIN_SEGMENT / 0.05));
        const mergeWindows = Math.max(1, Math.round(CAPTION_MERGE_GAP / 0.05));
        const segments = [];
        let start = -1, silence = 0;
        for (let i = 0; i < rms.length; i++) {
            const loud = rms[i] >= threshold;
            if (loud) {
                if (start < 0) start = i;
                silence = 0;
            } else if (start >= 0) {
                silence++;
                if (silence >= mergeWindows) {
                    const end = i - silence + 1;
                    if (end - start >= minWindows) segments.push([start, end]);
                    start = -1; silence = 0;
                }
            }
        }
        if (start >= 0 && rms.length - start >= minWindows) segments.push([start, rms.length]);
        if (!segments.length) {
            $('captionsStatus').textContent = 'No clear speech or vocals found — the audio may be too quiet. Try louder source material, or add caption blocks manually.';
            $('captionsStatus').className = 'status error';
            return;
        }
        const total = decoded.duration;
        state.captions.lines = segments.slice(0, CAPTION_MAX_BLOCKS).map(([a, b]) => ({
            time: Math.max(0, a * 0.05 - CAPTION_PAD_HEAD),
            endTime: Math.min(total, b * 0.05 + CAPTION_PAD_TAIL),
            text: ''
        }));
        markSectionTouched('text');
        $('captionsStatus').textContent = `Generated ${state.captions.lines.length} timed caption blocks — open Edit Captions and type what you hear for each block.`;
        $('captionsStatus').className = 'status success';
        toast(`Generated ${state.captions.lines.length} caption blocks`, 'success');
        readiness();
        redrawCurrentPreviewFrame();
        openCaptionsEditor();
    } catch (error) {
        const reason = error?.name === 'EncodingError'
            ? 'this audio format could not be decoded in the browser — try MP3, M4A or WAV, or add caption blocks manually'
            : (error?.message || 'analysis failed');
        $('captionsStatus').textContent = `Caption generation failed: ${reason}`;
        $('captionsStatus').className = 'status error';
        toast('Caption generation failed', 'error');
    } finally {
        if (button) button.disabled = false;
    }
}

function openCaptionsEditor() {
    if (isExporting) { toast('Finish or cancel the current export first', 'error'); return; }
    renderCaptionRows();
    $('captionsEditor').classList.remove('hidden');
}
function renderCaptionRows() {
    const box = $('captionsRows');
    if (!box) return;
    const lines = state.captions.lines;
    if (!lines.length) {
        box.innerHTML = '<div class="caption-hint">No blocks yet — use Auto-generate Timing first, or add blocks below.</div>';
        return;
    }
    box.replaceChildren(...lines.map((line, i) => {
        const row = document.createElement('div');
        row.className = 'caption-row';
        const time = document.createElement('span');
        time.className = 'caption-time';
        time.textContent = `${formatTime(Number(line.time) || 0)} → ${formatTime(Number(line.endTime) || 0)}`;
        const input = document.createElement('input');
        input.type = 'text';
        input.dataset.idx = String(i);
        input.value = String(line.text || '');
        input.placeholder = 'What is said in this block…';
        input.addEventListener('input', () => { if (lines[i]) lines[i].text = input.value; });
        row.append(time, input);
        return row;
    }));
}

function wireCaptions() {
    $('autoCaptionsBtn')?.addEventListener('click', autoGenerateCaptions);
    $('editCaptionsBtn')?.addEventListener('click', openCaptionsEditor);
    $('closeCaptions')?.addEventListener('click', () => $('captionsEditor').classList.add('hidden'));
    $('cancelCaptions')?.addEventListener('click', () => $('captionsEditor').classList.add('hidden'));
    $('addCaptionRow')?.addEventListener('click', () => {
        const lines = state.captions.lines;
        const last = lines[lines.length - 1];
        const start = last ? (Number(last.endTime) || (Number(last.time) + 3)) : 0;
        lines.push({ time: start, endTime: start + 3, text: '' });
        renderCaptionRows();
    });
    $('clearCaptionText')?.addEventListener('click', () => {
        state.captions.lines.forEach(l => { l.text = ''; });
        renderCaptionRows();
    });
    $('pasteCaptions')?.addEventListener('click', async function() {
        const status = $('captionsEditorStatus');
        if (!navigator.clipboard || !navigator.clipboard.readText) {
            status.textContent = 'Clipboard paste is not supported here — paste manually with Ctrl/Cmd+V into the text box instead.';
            status.className = 'status error';
            return;
        }
        try {
            const text = await navigator.clipboard.readText();
            if (!text) { status.textContent = 'Clipboard is empty'; status.className = 'status error'; return; }
            $('captionsBulkText').value = text;
            status.textContent = 'Pasted — now use “Fit Text to Blocks”.';
            status.className = 'status success';
        } catch (err) {
            status.textContent = 'Could not read the clipboard — paste manually with Ctrl/Cmd+V instead.';
            status.className = 'status error';
        }
    });
    $('distributeCaptions')?.addEventListener('click', () => {
        const status = $('captionsEditorStatus');
        const parts = splitCaptionText($('captionsBulkText').value);
        const lines = state.captions.lines;
        if (!lines.length) { status.textContent = 'Generate timing first, then fit text to the blocks.'; status.className = 'status error'; return; }
        if (!parts.length) { status.textContent = 'Add or paste some text first.'; status.className = 'status error'; return; }
        lines.forEach((line, i) => { line.text = parts[i] || line.text || ''; });
        if (parts.length > lines.length) {
            status.textContent = `Fitted ${lines.length} of ${parts.length} text parts — add ${parts.length - lines.length} more block(s) for the rest.`;
            status.className = 'status';
        } else {
            status.textContent = 'Text fitted across all blocks.';
            status.className = 'status success';
        }
        renderCaptionRows();
    });
    $('saveCaptions')?.addEventListener('click', function() {
        if (isExporting) { toast('Finish or cancel the current export first', 'error'); return; }
        const lines = state.captions.lines;
        const withText = lines.filter(l => String(l.text || '').trim());
        if (!lines.length || !withText.length) {
            $('captionsEditorStatus').textContent = 'Add at least one caption block with text.';
            $('captionsEditorStatus').className = 'status error';
            return;
        }
        state.captions.lines = withText.sort((a, b) => a.time - b.time);
        markSectionTouched('text');
        readiness();
        redrawCurrentPreviewFrame();
        $('captionsEditorStatus').textContent = `Saved ${withText.length} caption blocks.`;
        $('captionsEditorStatus').className = 'status success';
        toast(`Captions saved · ${withText.length} blocks`, 'success');
        setTimeout(() => $('captionsEditor').classList.add('hidden'), 700);
    });
}

function wireBackgroundControls() {
    $('bgDim')?.addEventListener('input', function() {
        if (isExporting) { this.value = String(Math.round((state.background.dim || 0) * 100)); return; }
        state.background.dim = Number(this.value) / 100;
        $('bgDimVal').textContent = `${this.value}%`;
        redrawCurrentPreviewFrame();
    });
    $('bgBlur')?.addEventListener('input', function() {
        if (isExporting) { this.value = String(state.background.blur || 0); return; }
        state.background.blur = Number(this.value) || 0;
        $('bgBlurVal').textContent = `${this.value}px`;
        redrawCurrentPreviewFrame();
    });
}
function syncBackgroundControls() {
    const dim = $('bgDim');
    if (dim) dim.value = String(Math.round((state.background.dim ?? 0.35) * 100));
    const dimVal = $('bgDimVal');
    if (dimVal) dimVal.textContent = `${Math.round((state.background.dim ?? 0.35) * 100)}%`;
    const blur = $('bgBlur');
    if (blur) blur.value = String(state.background.blur || 0);
    const blurVal = $('bgBlurVal');
    if (blurVal) blurVal.textContent = `${state.background.blur || 0}px`;
}

function init() {
    try {
        ensureDefaultBackground();
        applyNightPresentation();
        $('backgroundColor').value = state.background.solid;
        $('backgroundColorValue').textContent = state.background.solid.toUpperCase();
        const prefs = loadLinaPrefs();
        if (prefs?.metadata && typeof prefs.metadata === 'object') {
            state.audio.metadata.title = prefs.metadata.title || '';
            state.audio.metadata.artist = prefs.metadata.artist || '';
            state.audio.metadata.album = prefs.metadata.album || '';
            const titleInput = $('metaTitle'), artistInput = $('metaArtist'), albumInput = $('metaAlbum');
            if (titleInput) titleInput.value = state.audio.metadata.title;
            if (artistInput) artistInput.value = state.audio.metadata.artist;
            if (albumInput) albumInput.value = state.audio.metadata.album;
        }
        setAspectRatio(prefs?.aspect && ASPECTS[prefs.aspect] ? prefs.aspect : '9:16');
        renderMasterSourceUI();
        wireTitleCardControls();
        syncTitleCardUI();
        wireSyncControls();
        wireCaptions();
        wireBackgroundControls();
        syncBackgroundControls();
        qsa('[data-text-mode]').forEach(b => b.addEventListener('click', () => applyTextMode(b.dataset.textMode)));
        applyTextMode(state.captions.mode);
        wireCaptionStyleControls();
        syncCaptionStyleUI();
        readiness();
        setEffect(prefs?.effect && EFFECT_LABELS[prefs.effect] ? prefs.effect : (state.style.effect || 'apple'));
        redrawCurrentPreviewFrame();
        toast('KEFE Visualiser ready', 'success');
    } catch(err) {
        console.error('Init error:', err);
        toast('Error initializing', 'error');
    }
}

window.addEventListener('error', function(e) {
    console.error('Unhandled error:', e.error || e.message);
    if (!isExporting) toast('Something went wrong: ' + (e.message || 'unknown error'), 'error');
});
window.addEventListener('unhandledrejection', function(e) {
    console.error('Unhandled rejection:', e.reason);
    if (!isExporting) toast('Something went wrong: ' + (e.reason?.message || e.reason || 'unknown error'), 'error');
});

async function checkExportCapability() {
    const missing = [];
    if (typeof HTMLCanvasElement === 'undefined' ||
        typeof HTMLCanvasElement.prototype.getContext !== 'function') {
        missing.push('canvas rendering');
    }
    if (typeof TextEncoder === 'undefined') missing.push('text encoding');

    const hasWebCodecs = typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined';
    const hasFallback = typeof WebAssembly !== 'undefined' &&
        typeof HTMLCanvasElement.prototype.toBlob === 'function';

    if (!hasWebCodecs && !hasFallback && missing.length === 0) {
        missing.push('neither WebCodecs nor WebAssembly is available for MP4 export');
    }
    if (missing.length) {
        toast('This browser cannot export MP4: ' + missing.join(', ') + '.', 'error');
        $('exportBottom').disabled = true;
        return false;
    }
    return true;
}

startSingleRenderLoop();
init();
checkExportCapability();

window.addEventListener('beforeunload', function() {
    if (renderLoopId) cancelAnimationFrame(renderLoopId);
    if (audioURL) URL.revokeObjectURL(audioURL);
    if (backgroundURL) URL.revokeObjectURL(backgroundURL);
    if (albumArtworkURL) URL.revokeObjectURL(albumArtworkURL);
    if (media.video) { media.video.pause(); media.video.src = ''; }
    audio.pause();
    audio.src = '';
    try { window.kefeExportAbort?.abort(); } catch (e) {}
});
