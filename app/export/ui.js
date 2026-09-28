import { exportVideo } from './index.js';
import { getExportConfig, getSelectedQuality } from './config.js';
import { state, media, runtime } from '../core/context.js';
import { resolveMasterInfo } from './master.js';

window.kefeGetExportConfig = getExportConfig;

const $ = id => document.getElementById(id);
const cancelButton = $('cancelExport');
const confirmExport = $('confirmExport');
const closePreflight = $('closePreflight');
const cancelPreflight = $('cancelPreflight');
let exportAbort = null;

function cleanPart(value) { return String(value || '').replace(/[<>:\"/\\|?*\u0000-\u001F]/g, ' ').replace(/\s+/g, ' ').replace(/[. ]+$/g, '').trim(); }
function buildFilename() {
    const audio = state?.audio || {};
    const metadata = audio.metadata || {};
    const filename = String(audio.file?.name || '').replace(/\.[^.]+$/, '');
    const fallback = filename.replace(/[_]+/g, ' ').trim();
    const titleInput = cleanPart($('metaTitle')?.value);
    const artistInput = cleanPart($('metaArtist')?.value);
    let title = titleInput || cleanPart(metadata.title) || fallback || 'Lyric Video';
    let artist = artistInput || cleanPart(metadata.artist);
    if (!filename) {
        const videoFile = media.videoFile;
        if (videoFile?.name) { const base = String(videoFile.name).replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim(); if (base) title = cleanPart(base); }
    }
    return `${title}${artist && artist.toLowerCase() !== title.toLowerCase() ? ` - ${artist}` : ''} - KEFE Visualiser.mp4`;
}
function setExportUI(percent, message) { const status = $('exportStatus'); const pct = $('exportPct'); const progress = $('exportProgress'); if (status) status.textContent = message || 'Exporting…'; if (pct) pct.textContent = `${Math.round(percent)}%`; if (progress) progress.value = percent; }
function showOverlay() { $('exportOverlay')?.classList.remove('hidden'); }
function hideOverlay(delay = 1200) { setTimeout(() => $('exportOverlay')?.classList.add('hidden'), delay); }

async function seekAndRender(ctx, width, height, time, signal) {
    if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
    const renderExportFrame = window.kefeRenderFrame;
    const video = media.video;
    if (typeof renderExportFrame !== 'function') throw new Error('KEFE export renderer is not connected');
    if (video && Number.isFinite(video.duration) && video.duration > 0) {
        const target = ((time % video.duration) + video.duration) % video.duration;
        if (Math.abs(video.currentTime - target) > 0.002 || video.seeking || video.readyState < 2) {
            await new Promise((resolve, reject) => {
                let settled = false;
                const cleanup = () => { video.removeEventListener('seeked', done); video.removeEventListener('error', failed); signal?.removeEventListener('abort', cancelled); };
                const finish = fn => { if (settled) return; settled = true; cleanup(); fn(); };
                const done = () => finish(resolve);
                const failed = () => finish(() => reject(new Error('Background video seek failed')));
                const cancelled = () => finish(() => reject(new DOMException('Export cancelled', 'AbortError')));
                video.addEventListener('seeked', done, { once: true }); video.addEventListener('error', failed, { once: true }); signal?.addEventListener('abort', cancelled, { once: true });
                try { video.currentTime = target; } catch (error) { finish(() => reject(error)); }
            });
        }
    }
    if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
    const cappedTime = (state.playback.trimTo != null && time > state.playback.trimTo) ? state.playback.trimTo : time;
    renderExportFrame(ctx, width, height, cappedTime);
}

async function runExport() {
        const master = resolveMasterInfo(state, media);
    if (!Number.isFinite(master.duration) || master.duration <= 0) throw new Error('Master duration is unavailable (load an audio file or a video with audio)');
    const textRequired = !state.projectType || state.projectType === 'lyric' || state.projectType === 'captioned';
    const timedLines = state.captions?.mode === 'captions' ? (Array.isArray(state.captions?.lines) ? state.captions.lines : []) : (Array.isArray(state.lyrics?.lines) ? state.lyrics.lines : []);
    if (textRequired && !timedLines.length) throw new Error('No timed text loaded — add synced lyrics or captions');
    if (typeof window.kefeRenderFrame !== 'function') throw new Error('KEFE export renderer is not connected');
    const preset = $('exportPreset')?.value || '720p';
    const config = getExportConfig({ preset, aspect: state.aspect || '9:16', quality: getSelectedQuality() });
    return await exportVideo({
        state, media, config, signal: exportAbort?.signal, buildFilename,
        onProgress: ({ percent, message }) => setExportUI(percent, message),
        renderFrame: async (ctx, width, height, time) => { await seekAndRender(ctx, width, height, time, exportAbort?.signal); }
    });
}

async function executeExport() {
    if (runtime.isExporting) return;
    runtime.isExporting = true;
    exportAbort = new AbortController();
    const previewTime = Number(state?.playback?.currentTime) || 0;
    showOverlay();
    setExportUI(0, 'Preparing export…');
    if (cancelButton) cancelButton.textContent = 'Cancel';
    try {
        const result = await runExport();
        const url = URL.createObjectURL(result.blob);
        const link = document.createElement('a'); link.href = url; link.download = result.filename; document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
        setExportUI(100, `Export complete — ${result.filename}`);
        hideOverlay();
    } catch (error) {
        if (error?.name === 'AbortError') { setExportUI(0, 'Export cancelled'); hideOverlay(); }
        else { console.error('[KEFE] Export failed:', error); setExportUI(0, `Export failed: ${error?.message || error}`); showOverlay(); }
    } finally {
        try {
            const master = resolveMasterInfo(state, media);
            if (Number.isFinite(master.duration) && master.duration > 0) state.playback.currentTime = Math.min(previewTime, master.duration);
        } catch {}
        if (media.video && Number.isFinite(media.video.duration)) { try { const video = media.video; video.pause(); if (video.duration > 0) video.currentTime = ((previewTime % video.duration) + video.duration) % video.duration; } catch {} }
        exportAbort = null; runtime.isExporting = false; if (cancelButton) cancelButton.textContent = 'Close';
        try { window.redrawCurrentPreviewFrame?.(); } catch {}
    }
}

function closePreflightModal() { $('exportPreflight')?.classList.add('hidden'); }

// app.js owns the two Export-button click handlers and opens preflight. Do NOT
// add another click handler here: doing so would bypass preflight or start two
// exports. This module only owns the actual confirmed export and overlay.
cancelButton?.addEventListener('click', () => { if (runtime.isExporting) exportAbort?.abort(); else $('exportOverlay')?.classList.add('hidden'); });
confirmExport?.addEventListener('click', () => { closePreflightModal(); executeExport(); });
closePreflight?.addEventListener('click', closePreflightModal);
cancelPreflight?.addEventListener('click', closePreflightModal);
console.info('[KEFE] Native WebCodecs export with FFmpeg compatibility fallback loaded');
