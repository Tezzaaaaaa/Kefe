import { state, audio, media, runtime, noneClock, $, lastVideoFrame, lastVideoFrameCtx } from './context.js';
import { fmt, linaClamp, toast } from './utils.js';
import { render } from './renderer.js';
import { updateSyncLive } from './status.js';

export function getMasterMode() { return state.audioSource.master || 'uploaded'; }
export function isMasterPlaying() {
    const m = getMasterMode();
    if (m === 'video') return media.video ? !media.video.paused : false;
    if (m === 'none')  return noneClock.running;
    return !audio.paused;
}

export function getMasterDuration() {
    const m = getMasterMode();
    if (m === 'video') {
        const v = media.video;
        return v && Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 0;
    }
    if (m === 'none') {
        const vd = media.video?.duration > 0 ? media.video.duration : 0;
        const ad = state.audio.duration > 0 ? state.audio.duration : 0;
        let textEnd = 0;
        const last = state.projectType === 'visualiser' ? null : state.lyrics.lines[state.lyrics.lines.length - 1];
        if (last) {
            const t = Number(last.time), e = Number(last.endTime);
            textEnd = Number.isFinite(e) ? e : (Number.isFinite(t) ? t + 3 : 0);
        }
        return Math.max(vd, ad, textEnd + 1, 1);
    }
    return state.audio.duration > 0 ? state.audio.duration : 0;
}

export function getMasterTime() {
    if (runtime.exportClockTime !== null && runtime.exportClockTime !== undefined) return runtime.exportClockTime;
    const m = getMasterMode();
    if (m === 'video') return media.video && Number.isFinite(media.video.currentTime) ? media.video.currentTime : 0;
    if (m === 'none') {
        if (noneClock.running) {
            let t = noneClock.base + (performance.now() - noneClock.wall) / 1000;
            const d = getMasterDuration();
            if (Number.isFinite(d) && d > 0 && t >= d) { t = d; stopNoneClock(); }
            state.playback.currentTime = t;
            return t;
        }
        return Number.isFinite(state.playback.currentTime) ? state.playback.currentTime : 0;
    }
    return Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
}

export function setMasterTime(target) {
    const t = Math.max(0, Number(target) || 0);
    const m = getMasterMode();
    if (m === 'video') {
        const v = media.video;
        if (v && Number.isFinite(v.duration) && v.duration > 0) v.currentTime = wrappedVideoTime(t, v.duration);
    } else if (m === 'none') {
        noneClock.base = t; noneClock.wall = performance.now();
    } else {
        audio.currentTime = t;
    }
    state.playback.currentTime = t;
}

export function startNoneClock(fromTime) {
    noneClock.base = Number.isFinite(fromTime) ? fromTime : state.playback.currentTime;
    noneClock.wall = performance.now();
    noneClock.running = true;
    state.playback.isPlaying = true;
}
export function stopNoneClock() {
    noneClock.running = false; noneClock.base = 0; noneClock.wall = 0;
    state.playback.isPlaying = false;
}
export function wrappedVideoTime(time, duration) {
    if (!Number.isFinite(duration) || duration <= 0) return 0;
    return ((time % duration) + duration) % duration;
}
function circularVideoDrift(cur, target, dur) {
    let drift = target - cur;
    if (dur > 0) { if (drift > dur / 2) drift -= dur; else if (drift < -dur / 2) drift += dur; }
    return drift;
}

export function maintainBackgroundVideoSync(masterTime) {
    if (getMasterMode() === 'video') return;
    if (runtime.exportClockTime !== null) return;
    const v = media.video;
    if (!v || !Number.isFinite(v.duration) || v.duration <= 0 || v.readyState < 2) return;
    const target = wrappedVideoTime(masterTime, v.duration);
    const drift = circularVideoDrift(v.currentTime, target, v.duration);
    const dist = Math.abs(drift);
    const shouldPlay = isMasterPlaying();
    if (!shouldPlay || runtime.userScrubbing) {
        if (!v.paused) v.pause();
        if (dist > 0.035 && !v.seeking) v.currentTime = target;
        v.playbackRate = 1;
        return;
    }
    v.playbackRate = dist <= 0.18 ? linaClamp(1 + drift * 0.20, 0.97, 1.03) : 1;
    const now = performance.now();
    if (dist > 0.40 && !v.seeking && now - runtime.lastVideoHardSync > 250) {
        runtime.lastVideoHardSync = now;
        v.currentTime = target;
    }
    if (v.paused && !v.seeking) v.play().catch(() => {});
}

function syncPreviewTransportUI(t) {
    const seek = $('seek');
    if (seek) { seek.value = String(t); seek.max = getMasterDuration(); }
    const clock = $('clock');
    if (clock) clock.textContent = `${fmt(t)} / ${fmt(getMasterDuration())}`;
}

export function redrawCurrentPreviewFrame() {
    if (runtime.isExporting) return;
    const t = getMasterTime();
    state.playback.currentTime = t;
    maintainBackgroundVideoSync(t);
    updateSyncLive(t);
    try { render(document.getElementById('stageCanvas').getContext('2d'), document.getElementById('stageCanvas').width, document.getElementById('stageCanvas').height, state, media); }
    catch (e) { console.error('Preview redraw error:', e); }
    syncPreviewTransportUI(t);
}
window.redrawCurrentPreviewFrame = redrawCurrentPreviewFrame;

export function kefeRenderFrame(ctx, w, h, time) {
    state.playback.currentTime = time;
    render(ctx, w, h, state, media);
}
window.kefeRenderFrame = kefeRenderFrame;

function tick() {
    if (!runtime.isExporting) {
        const t = getMasterTime();
        state.playback.currentTime = t;
        const seek = $('seek');
        if (seek && !runtime.userScrubbing) seek.value = String(t);
        const clock = $('clock');
        if (clock) clock.textContent = `${fmt(t)} / ${fmt(getMasterDuration())}`;
        maintainBackgroundVideoSync(t);
        updateSyncLive(t);
        try { render(document.getElementById('stageCanvas').getContext('2d'), document.getElementById('stageCanvas').width, document.getElementById('stageCanvas').height, state, media); }
        catch (e) { console.error('Preview render error:', e); }
    }
    runtime.renderLoopId = requestAnimationFrame(tick);
}
export function startSingleRenderLoop() {
    if (runtime.renderLoopId !== null) cancelAnimationFrame(runtime.renderLoopId);
    runtime.renderLoopId = requestAnimationFrame(tick);
}

export async function togglePlayback() {
    if (runtime.exportClockTime !== null) return;
    const m = getMasterMode();
    if (m === 'video') {
        const v = media.video;
        if (v) {
            if (v.paused) { v.muted = false; try { await v.play(); } catch { toast('Playback error', 'error'); } setPlayIcon(true); state.playback.isPlaying = true; }
            else { v.pause(); setPlayIcon(false); state.playback.isPlaying = false; }
        }
        redrawCurrentPreviewFrame(); return;
    }
    if (m === 'none') {
        if (noneClock.running) { stopNoneClock(); setPlayIcon(false); }
        else { startNoneClock(getMasterTime()); setPlayIcon(true); }
        redrawCurrentPreviewFrame(); return;
    }
    if (audio.paused) { try { await audio.play(); } catch { toast('Playback error', 'error'); } }
    else audio.pause();
}

export function seekPreview(target) {
    if (runtime.isExporting || !Number.isFinite(target)) return;
    setMasterTime(target);
    redrawCurrentPreviewFrame();
}

export function stopPlayback() {
    if (runtime.isExporting) return;
    const m = getMasterMode();
    if (m === 'video') { media.video?.pause(); if (media.video) media.video.currentTime = 0; }
    else if (m === 'none') stopNoneClock();
    else { audio.pause(); audio.currentTime = 0; }
    state.playback.currentTime = 0;
    if (media.video && m === 'uploaded' && media.video.duration > 0) media.video.currentTime = 0;
    redrawCurrentPreviewFrame();
}

export function pauseMasterPlayback() {
    const m = getMasterMode();
    if (m === 'uploaded' && !audio.paused) audio.pause();
    else if (m === 'video' && media.video && !media.video.paused) media.video.pause();
    else if (m === 'none' && noneClock.running) stopNoneClock();
}

// --- play icon (tiny helper kept local)
const PLAY_ICON  = '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M8 5.2v13.6a1 1 0 0 0 1.52.86l10.2-6.8a1 1 0 0 0 0-1.66l-10.2-6.8A1 1 0 0 0 8 5.2Z" fill="currentColor"/></svg>';
const PAUSE_ICON = '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><rect x="6.4" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none"/><rect x="13.6" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none"/></svg>';
export function setPlayIcon(playing) {
    const btn = $('playBtn');
    if (btn) btn.innerHTML = playing ? PAUSE_ICON : PLAY_ICON;
}