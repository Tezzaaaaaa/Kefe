import { state, $, qsa, runtime } from './context.js';
import { activeTextMode, activeTimedLines, timedTextRequired, navHooks, linaClamp, linaFindActiveLine, linaNormaliseLine, toast } from './utils.js';
import { validateLyricTiming, adviceForMessage, shiftedLines } from './module-lyrics.js';
import { getMasterDuration, redrawCurrentPreviewFrame } from './playback.js';
import { media } from './context.js';

export function hasMasterSource() {
    const m = state.audioSource.master || 'uploaded';
    if (m === 'video') return Boolean(media.video && media.videoFile);
    if (m === 'none')  return getMasterDuration() > 0;
    return Boolean(state.audio.file) && state.audio.ready;
}

export function ensureDefaultBackground() {
    if (media.image || media.video) return;
    state.background.type = 'solid';
    state.background.image = null;
    state.background.video = null;
    state.background.solid = state.background.solid || '#0A0A0A';
}

export function projectValidationIssues() {
    const issues = [];
    const d = getMasterDuration();
    const lines = activeTimedLines();
    if (!hasMasterSource()) issues.push('an audio or video source');
    else if (d <= 0) issues.push('a source with a readable duration');
    if (timedTextRequired() && !lines.length) issues.push(activeTextMode() === 'captions' ? 'captions' : 'synced lyrics');
    else if (lines.length && validateLyricTiming(lines, d).errors.length) issues.push('valid lyric timing');
    return issues;
}

export function updateSectionNav() {
    const d = getMasterDuration();
    const timed = activeTimedLines();
    const timingOk = timed.length > 0 && validateLyricTiming(timed, d).errors.length === 0;
    const done = {
        audio: hasMasterSource() && d > 0,
        text: timingOk,
        fx: state.touched.fx,
        background: state.touched.background || Boolean(media.image) || Boolean(media.video),
        title: state.touched.title,
        export: hasMasterSource() && d > 0 && timingOk
    };
    qsa('.section-nav-link').forEach(link => {
        const key = link.dataset.nav;
        if (key) link.classList.toggle('done', Boolean(done[key]));
    });
}
navHooks.updateSectionNav = updateSectionNav;

export function refreshLyricsTimingStatus() {
    const status = activeTextMode() === 'captions' ? $('captionsStatus') : $('lyricsStatus');
    if (!status) return;
    const lines = activeTimedLines();
    if (!lines.length) {
        status.textContent = activeTextMode() === 'captions'
            ? 'No captions yet — use Auto-generate Timing, or switch to Lyrics.'
            : 'No lyrics yet — search, upload an LRC, or paste your own.';
        status.className = 'status';
        updateSyncStatusUI();
        return;
    }
    const report = validateLyricTiming(lines, getMasterDuration());
    if (report.errors.length) {
        const advice = adviceForMessage(report.errors[0]);
        status.textContent = `${lines.length} lines · ${report.errors[0]}${advice ? ' — How to fix: ' + advice : ''}`;
        status.className = 'status error';
    } else if (report.warnings.length) {
        const advice = adviceForMessage(report.warnings[0]);
        status.textContent = `${lines.length} timed lines · ${report.warnings[0]}${advice ? ' — ' + advice : ''}`;
        status.className = 'status';
    } else {
        status.textContent = `${lines.length} timed lines · timing valid`;
        status.className = 'status success';
    }
    updateSyncStatusUI();
}

export function readiness() {
    const d = getMasterDuration();
    const lines = activeTimedLines();
    const timingValid = lines.length > 0 && validateLyricTiming(lines, d).errors.length === 0;
    const masterReady = hasMasterSource() && d > 0;
    const ready = masterReady && (timedTextRequired() ? timingValid : true);
    const btn = $('exportBottom');
    if (btn) btn.disabled = !ready;
    refreshLyricsTimingStatus();
    updateSectionNav();
}

// ---- sync status ----
export function updateSyncStatusUI() {
    const slider = $('lyricsOffset');
    const value = $('offsetVal');
    if (slider && document.activeElement !== slider) slider.value = String(state.lyricsOffset || 0);
    if (value) value.textContent = `${(state.lyricsOffset || 0) > 0 ? '+' : ''}${Number(state.lyricsOffset || 0).toFixed(2)}s`;
}
let lastLiveUpdate = 0;
export function updateSyncLive(t) {
    const el = $('syncLive');
    if (!el) return;
    const now = performance.now();
    if (now - lastLiveUpdate < 180) return;
    lastLiveUpdate = now;
    const lines = activeTimedLines();
    if (!lines.length) {
        el.textContent = activeTextMode() === 'captions' ? 'No captions yet — generate timing to see live sync.' : 'No lyrics yet — load lyrics to see live sync.';
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

export function nudgeLyricTiming(delta) {
    if (runtime.isExporting) { toast('Finish or cancel the current export first', 'error'); return; }
    const mode = activeTextMode();
    const store = mode === 'captions' ? state.captions : state.lyrics;
    if (!store.lines.length) { toast(mode === 'captions' ? 'Generate captions first' : 'Load lyrics first', 'error'); return; }
    store.lines = shiftedLines(delta, store.lines);
    refreshLyricsTimingStatus();
    redrawCurrentPreviewFrame();
    toast(`Shifted all ${mode} by ${delta > 0 ? '+' : ''}${delta}s`, 'success');
}