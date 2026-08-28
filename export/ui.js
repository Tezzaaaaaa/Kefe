import { exportVideo, getExportConfig, resolveMasterInfo } from './index.js';

const $ = id => document.getElementById(id);
function replaceButton(id) { const current = $(id); if (!current) return null; const replacement = current.cloneNode(true); current.replaceWith(replacement); return replacement; }
const exportTop = replaceButton('exportBtn');
const exportBottom = replaceButton('exportBottom');
const cancelButton = replaceButton('cancelExport');
const confirmExport = replaceButton('confirmExport');
const closePreflight = replaceButton('closePreflight');
const cancelPreflight = replaceButton('cancelPreflight');

function cleanPart(value) { return String(value || '').replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ').replace(/\s+/g, ' ').replace(/[. ]+$/g, '').trim(); }
function buildFilename() {
    const audio = window.state?.audio || {};
    const metadata = audio.metadata || {};
    const filename = String(audio.file?.name || '').replace(/\.[^.]+$/, '');
    const fallback = filename.replace(/[_]+/g, ' ').trim();
    const titleInput = cleanPart($('metaTitle')?.value);
    const artistInput = cleanPart($('metaArtist')?.value);
    let title = titleInput || cleanPart(metadata.title) || fallback || 'Lyric Video';
    let artist = artistInput || cleanPart(metadata.artist);
    // For a video-as-master export there may be no uploaded audio file to name from.
    if (!filename) {
        const videoFile = window.kefeMedia?.videoFile;
        if (videoFile?.name) { const base = String(videoFile.name).replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim(); if (base) title = cleanPart(base); }
    }
    return `${title}${artist && artist.toLowerCase() !== title.toLowerCase() ? ` - ${artist}` : ''} - KEFE Visualiser.mp4`;
}
function setExportUI(percent, message) { const status = $('exportStatus'); const pct = $('exportPct'); const progress = $('exportProgress'); if (status) status.textContent = message || 'Exporting…'; if (pct) pct.textContent = `${Math.round(percent)}%`; if (progress) progress.value = percent; }
function showOverlay() { $('exportOverlay')?.classList.remove('hidden'); }
function hideOverlay(delay = 1200) { setTimeout(() => $('exportOverlay')?.classList.add('hidden'), delay); }

async function seekAndRender(ctx, width, height, time, signal) {
    if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
    const state = window.state;
    const renderExportFrame = window.kefeRenderFrame;
    const video = window.kefeMedia?.video;
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
    state.playback.currentTime = time;
    renderExportFrame(ctx, width, height, time);
}

async function runExport() {
    const state = window.state;
    const media = window.kefeMedia || {};
    const master = resolveMasterInfo(state, media);
    if (!Number.isFinite(master.duration) || master.duration <= 0) throw new Error('Master duration is unavailable (load an audio file or a video with audio)');
    if (!Array.isArray(state.lyrics?.lines) || !state.lyrics.lines.length) throw new Error('No synced lyrics loaded');
    if (typeof window.kefeRenderFrame !== 'function') throw new Error('KEFE export renderer is not connected');
    const preset = $('exportPreset')?.value || '720p';
    const config = getExportConfig(preset, state.aspect || '9:16');
    return await exportVideo({
        state, media, config, signal: window.kefeExportAbort?.signal, buildFilename,
        onProgress: ({ percent, message }) => setExportUI(percent, message),
        renderFrame: async (ctx, width, height, time) => { await seekAndRender(ctx, width, height, time, window.kefeExportAbort?.signal); }
    });
}

async function startExport() {
    if (window.isExporting) return;
    window.isExporting = true;
    window.kefeExportAbort = new AbortController();
    const previewTime = Number(window.state?.playback?.currentTime) || 0;
    showOverlay();
    setExportUI(0, 'Preparing FFmpeg export…');
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
        else { console.error('[KEFE] FFmpeg export failed:', error); setExportUI(0, `Export failed: ${error?.message || error}`); showOverlay(); }
    } finally {
        try {
            const master = resolveMasterInfo(window.state, window.kefeMedia || {});
            if (Number.isFinite(master.duration) && master.duration > 0) window.state.playback.currentTime = Math.min(previewTime, master.duration);
        } catch {}
        if (window.kefeMedia?.video && Number.isFinite(window.kefeMedia.video.duration)) { try { const video = window.kefeMedia.video; video.pause(); if (video.duration > 0) video.currentTime = ((previewTime % video.duration) + video.duration) % video.duration; } catch {} }
        window.kefeExportAbort = null; window.isExporting = false; if (cancelButton) cancelButton.textContent = 'Close';
        try { window.redrawCurrentPreviewFrame?.(); } catch {}
    }
}

function closePreflightModal() { $('exportPreflight')?.classList.add('hidden'); }
// The Export buttons should open app.js's pre-export check first (project
// validation, plus a summary of resolution/frame count/duration and a
// "this may take a while on a phone" warning for demanding exports) — the
// user confirms from there via #confirmExport, which is wired below to run
// the actual export. Falls back to exporting directly only if that
// preflight function is unexpectedly unavailable, so the button never goes
// dead.
exportTop?.addEventListener('click', () => (window.startExport ? window.startExport() : startExport()));
exportBottom?.addEventListener('click', () => (window.startExport ? window.startExport() : startExport()));
cancelButton?.addEventListener('click', () => { if (window.isExporting) window.kefeExportAbort?.abort(); else $('exportOverlay')?.classList.add('hidden'); });
confirmExport?.addEventListener('click', () => { closePreflightModal(); startExport(); });
closePreflight?.addEventListener('click', closePreflightModal);
cancelPreflight?.addEventListener('click', closePreflightModal);
document.addEventListener('keydown', event => { if ((event.key === 'e' || event.key === 'E') && !['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName)) { event.preventDefault(); event.stopImmediatePropagation(); startExport(); } }, true);
window.startOfflineExport = startExport;
window.kefeCancelExport = () => window.kefeExportAbort?.abort();
console.info('[KEFE] Integrated FFmpeg exporter loaded');
