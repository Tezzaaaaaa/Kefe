// app.js — boot and wiring only.
import { state, audio, media, blobs, runtime, canvas, ctx, $, qsa, applyNightPresentation, loadLinaPrefs } from './core/context.js';
import { toast } from './core/utils.js';
import { activeTimedLines, activeTextMode, PROJECT_TYPES } from './core/utils.js';
import { ASPECTS, setAspectRatio } from './core/aspect.js';
import {
    startSingleRenderLoop, redrawCurrentPreviewFrame,
    togglePlayback, seekPreview, stopPlayback, getMasterTime, getMasterDuration,
    kefeRenderFrame
} from './core/playback.js';
import { readiness, ensureDefaultBackground } from './core/status.js';
import { wireMediaInputs, updateMetadataInputs } from './core/media.js';
import { renderMasterSourceUI, wireMasterChoiceModal, syncMasterSourceUI } from './core/master-source.js';
import { renderEffectControls, setEffect, wireEffectButtons, EFFECT_LABELS } from './ui/effects.js';
import { wireTitleCardControls, syncTitleCardUI } from './ui/title-card.js';
import { wireSyncControls } from './ui/sync.js';
import { applyTextMode, wireCaptions, wireCaptionStyleControls, syncCaptionStyleUI } from './ui/captions.js';
import { wireExportPreflight } from './ui/export-preflight.js';
import { wireLyricsLookupButtons } from './core/lyrics-lookup.js';
import { wireKeyboardShortcuts } from './ui/shortcuts.js';

// ---- one-off boot ----
function init() {
    try {
        ensureDefaultBackground();
        applyNightPresentation();
        $('backgroundColor').value = state.background.solid;
        $('backgroundColorValue').textContent = state.background.solid.toUpperCase();

        const prefs = loadLinaPrefs();
        if (prefs?.metadata && typeof prefs.metadata === 'object') {
            state.audio.metadata.title  = prefs.metadata.title  || '';
            state.audio.metadata.artist = prefs.metadata.artist || '';
            state.audio.metadata.album  = prefs.metadata.album  || '';
        }
        updateMetadataInputs();

        setAspectRatio(prefs?.aspect && ASPECTS[prefs.aspect] ? prefs.aspect : '9:16');
        renderMasterSourceUI();
        wireMasterChoiceModal();
        wireTitleCardControls();
        syncTitleCardUI();
        wireSyncControls();
        wireCaptions();
        qsa('[data-text-mode]').forEach(b => b.addEventListener('click', () => applyTextMode(b.dataset.textMode)));
        applyTextMode(state.captions.mode);
        wireCaptionStyleControls();
        syncCaptionStyleUI();
        wireMediaInputs();
        wireLyricsLookupButtons();
        wireExportPreflight();
        wireKeyboardShortcuts();
        wireEffectButtons();
        wireTransport();
        wireReset();
        wireGlassVisibility();

        readiness();
        setEffect(prefs?.effect && EFFECT_LABELS[prefs.effect] ? prefs.effect : (state.style.effect || 'apple'));
        redrawCurrentPreviewFrame();
        window.dispatchEvent(new CustomEvent('kefe:app-ready'));
        toast('KEFE Visualiser ready', 'success');
    } catch (e) {
        console.error('Init error:', e);
        toast('Error initializing', 'error');
    }
}

function wireTransport() {
    $('playBtn').addEventListener('click', togglePlayback);
    $('stopBtn').addEventListener('click', stopPlayback);
    $('seek').addEventListener('pointerdown', () => { runtime.userScrubbing = true; if (!runtime.isExporting) media.video?.pause(); });
    $('seek').addEventListener('input', e => {
        if (runtime.exportClockTime !== null) return;
        const t = Number(e.target.value); if (!Number.isFinite(t)) return;
        seekPreview(t);
    });
    const finishScrub = () => {
        if (!runtime.userScrubbing) return;
        runtime.userScrubbing = false;
        if (runtime.isExporting) return;
        const m = state.audioSource.master || 'uploaded';
        if (m === 'uploaded' && !audio.paused) media.video?.play().catch(() => {});
        else if (m === 'video') media.video?.play().catch(() => {});
    };
    $('seek').addEventListener('pointerup', finishScrub);
    $('seek').addEventListener('change', finishScrub);
    $('backgroundColor').addEventListener('input', function () {
        if (runtime.isExporting) { this.value = state.background.solid || '#0A0A0A'; return; }
        state.background.solid = this.value;
        $('backgroundColorValue').textContent = this.value.toUpperCase();
        if (!media.image && !media.video) state.background.type = 'solid';
        redrawCurrentPreviewFrame();
    });
    ['metaTitle','metaArtist','metaAlbum'].forEach(id => {
        const input = $(id); if (!input) return;
        input.addEventListener('input', () => {
            const key = id === 'metaTitle' ? 'title' : id === 'metaArtist' ? 'artist' : 'album';
            state.audio.metadata[key] = input.value.trim();
            state.audio.metadataSource = 'manual';
            redrawCurrentPreviewFrame();
        });
    });
    audio.addEventListener('loadedmetadata', function () {
        if (!Number.isFinite(this.duration) || this.duration <= 0) {
            state.audio.ready = false; readiness(); toast('Audio duration could not be read', 'error'); return;
        }
        state.audio.duration = this.duration;
        state.audio.ready = true;
        $('seek').max = getMasterDuration();
        $('clock').textContent = '0:00 / ' + getMasterDuration().toFixed(0);
        readiness();
    });
    audio.addEventListener('play',  () => { if ((state.audioSource.master || 'uploaded') === 'uploaded') { state.playback.isPlaying = true; if (!runtime.isExporting) media.video?.play().catch(() => {}); } });
    audio.addEventListener('pause', () => { if ((state.audioSource.master || 'uploaded') === 'uploaded') { state.playback.isPlaying = false; if (!runtime.isExporting) media.video?.pause(); } });
    audio.addEventListener('seeked', () => { if (!runtime.isExporting) redrawCurrentPreviewFrame(); });
    audio.addEventListener('timeupdate', function () { if ((state.audioSource.master || 'uploaded') === 'uploaded') state.playback.currentTime = this.currentTime || 0; });
}

function wireReset() {
    let timer = null;
    const disarm = () => {
        clearTimeout(timer); timer = null;
        const b = $('resetBtn'); b.dataset.confirmed = ''; b.textContent = 'Reset'; b.classList.remove('confirming');
    };
    const arm = () => {
        const b = $('resetBtn'); b.dataset.confirmed = 'true'; b.textContent = 'Are you sure?'; b.classList.add('confirming');
        clearTimeout(timer); timer = setTimeout(disarm, 4500);
    };
    $('resetBtn').addEventListener('click', () => {
        if (runtime.isExporting) { toast('Finish or cancel the current export first', 'error'); return; }
        if ($('resetBtn').dataset.confirmed !== 'true') { arm(); return; }
        clearTimeout(timer);
        window.location.href = new URL('./', window.location.href).href;
    });
    document.addEventListener('click', e => { if (e.target !== $('resetBtn') && $('resetBtn').dataset.confirmed === 'true') disarm(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('resetBtn').dataset.confirmed === 'true') disarm(); });
}

function wireGlassVisibility() {
    const input = document.getElementById('kefeGlassVisibility');
    const val   = document.getElementById('kefeGlassVisibilityValue');
    if (!input) return;
    const saved = Number(localStorage.getItem('kefeGlassVisibility'));
    if (Number.isFinite(saved)) input.value = String(Math.max(0, Math.min(100, saved)));
    const apply = () => {
        const v = Number(input.value) / 100;
        document.documentElement.style.setProperty('--kefe-glass-visibility', String(v));
        if (val) val.textContent = `${Math.round(v * 100)}%`;
        localStorage.setItem('kefeGlassVisibility', String(Math.round(v * 100)));
    };
    input.addEventListener('input', apply);
    apply();
}

async function checkExportCapability() {
    const missing = [];
    if (typeof HTMLCanvasElement === 'undefined' || typeof HTMLCanvasElement.prototype.getContext !== 'function') missing.push('canvas rendering');
    if (typeof TextEncoder === 'undefined') missing.push('text encoding');
    const hasWebCodecs = typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined';
    const hasFallback  = typeof WebAssembly !== 'undefined' && typeof HTMLCanvasElement.prototype.toBlob === 'function';
    if (!hasWebCodecs && !hasFallback && missing.length === 0) missing.push('neither WebCodecs nor WebAssembly is available for MP4 export');
    if (missing.length) {
        toast('This browser cannot export MP4: ' + missing.join(', ') + '.', 'error');
        $('exportBottom').disabled = true;
        return false;
    }
    return true;
}

// ---- public JS API used by other scripts ----
window.kefeSetProjectType = function (type) {
    if (!PROJECT_TYPES.includes(type)) return;
    if (state.projectType === type) return;
    state.projectType = type;
    if (type === 'captioned') applyTextMode('captions');
    else if (type === 'lyric' && state.captions.mode === 'captions') applyTextMode('lyrics');
    readiness(); redrawCurrentPreviewFrame();
};


// ---- global error surfaces ----
window.addEventListener('error', e => { console.error('Unhandled error:', e.error || e.message); if (!runtime.isExporting) toast('Something went wrong: ' + (e.message || 'unknown error'), 'error'); });
window.addEventListener('unhandledrejection', e => { console.error('Unhandled rejection:', e.reason); if (!runtime.isExporting) toast('Something went wrong: ' + (e.reason?.message || e.reason || 'unknown error'), 'error'); });

// ---- teardown ----
window.addEventListener('beforeunload', () => {
    if (runtime.renderLoopId) cancelAnimationFrame(runtime.renderLoopId);
    if (blobs.audioURL) URL.revokeObjectURL(blobs.audioURL);
    if (blobs.backgroundURL) URL.revokeObjectURL(blobs.backgroundURL);
    if (blobs.albumArtworkURL) URL.revokeObjectURL(blobs.albumArtworkURL);
    if (media.video) { media.video.pause(); media.video.src = ''; }
    audio.pause(); audio.src = '';
    try { window.kefeExportAbort?.abort(); } catch {}
});

// ---- go ----
startSingleRenderLoop();
document.getElementById('kefeHardRefresh')?.addEventListener('click', () => window.location.reload());
init();
checkExportCapability();
