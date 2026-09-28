import { state, media, blobs, albumArtwork, tokens, runtime, $, audio } from './context.js';
import { toast } from './utils.js';
import { songFromFilename } from './module-lyrics.js';
import { updateMetadataInputs } from './metadata.js';
import { readiness } from './status.js';
import { applyMasterSelection, syncMasterSourceUI, getMasterModeFromState } from './master-source.js';
import { getMasterMode, getMasterTime, wrappedVideoTime, redrawCurrentPreviewFrame } from './playback.js';
import { autoFetchLyricsForCurrentTrack } from './lyrics-lookup.js';

const MAX_AUDIO_BYTES = 200 * 1024 * 1024;
const MAX_BACKGROUND_BYTES = 500 * 1024 * 1024;
const MAX_LRC_BYTES = 5 * 1024 * 1024;
export { MAX_LRC_BYTES };

export const audioStatus = document.getElementById('audioStatus');

// ---------- metadata libraries ----------
export function loadMediaTagsLibrary() {
    if (window.jsmediatags) return Promise.resolve(window.jsmediatags);
    if (!media._tagsPromise) {
        media._tagsPromise = new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = './vendor/jsmediatags/jsmediatags.min.js';
            s.onload  = () => window.jsmediatags ? resolve(window.jsmediatags) : reject(new Error('Metadata reader unavailable'));
            s.onerror = () => reject(new Error('Metadata reader failed to load'));
            document.head.appendChild(s);
        }).catch(e => { media._tagsPromise = null; throw e; });
    }
    return media._tagsPromise;
}
export function loadMediaInfoLibrary() {
    if (window.MediaInfo) return Promise.resolve(window.MediaInfo);
    if (!window.kefeMediaInfoLoadPromise) {
        window.kefeMediaInfoLoadPromise = import('/vendor/mediainfo/MediaInfo.js')
            .then(m => m.default || m.MediaInfo || m)
            .catch(e => { window.kefeMediaInfoLoadPromise = null; throw e; });
    }
    return window.kefeMediaInfoLoadPromise;
}

export function setAlbumArtworkBlob(blob, token = tokens.audio) {
    if (!blob || !String(blob.type || '').startsWith('image/')) return;
    if (blobs.albumArtworkURL) URL.revokeObjectURL(blobs.albumArtworkURL);
    blobs.albumArtworkURL = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { if (token !== tokens.audio) return; albumArtwork.image = img; state.audio.hasArtwork = true; window.kefeAlbumArt = img; redrawCurrentPreviewFrame(); };
    img.onerror = () => {
        if (token !== tokens.audio) return;
        state.audio.hasArtwork = false; albumArtwork.image = null; window.kefeAlbumArt = null;
        if (blobs.albumArtworkURL) { URL.revokeObjectURL(blobs.albumArtworkURL); blobs.albumArtworkURL = null; }
    };
    img.src = blobs.albumArtworkURL;
}
export async function setAlbumArtworkReference(reference) {
    const v = String(reference || '').trim();
    if (!v.startsWith('data:image/') || v.length > 14 * 1024 * 1024) return false;
    try { const r = await fetch(v); setAlbumArtworkBlob(await r.blob()); return true; } catch { return false; }
}

// ---------- embedded metadata readers ----------
export async function readEmbeddedAudioMetadata(file, token, source = 'audio') {
    try {
        const tags = await loadMediaTagsLibrary();
        const result = await new Promise((resolve, reject) => tags.read(file, { onSuccess: resolve, onError: reject }));
        const current = source === 'video'
            ? token === tokens.background && media.videoFile === file
            : token === tokens.audio && state.audio.file === file;
        if (!current) return;
        const t = result?.tags || {};
        if (!['project', 'manual', 'lyrics-service', 'lrc'].includes(state.audio.metadataSource)) {
            if (t.title)  state.audio.metadata.title  = String(t.title).trim();
            if (t.artist) state.audio.metadata.artist = String(t.artist).trim();
            if (t.album)  state.audio.metadata.album  = String(t.album).trim();
            if (t.title || t.artist || t.album) state.audio.metadataSource = 'embedded';
        }
        updateMetadataInputs();
        const pic = t.picture;
        if (pic?.data?.length) {
            setAlbumArtworkBlob(new Blob([new Uint8Array(pic.data)], { type: pic.format || 'image/jpeg' }), token);
            audioStatus.textContent = file.name + ' · embedded artwork';
        }
        redrawCurrentPreviewFrame();
        if (source !== 'video') void autoFetchLyricsForCurrentTrack(file, token);
    } catch (e) {
        console.info('No readable embedded audio metadata:', e?.message || e);
        if (source !== 'video') void autoFetchLyricsForCurrentTrack(file, token);
    }
}
export async function readEmbeddedVideoMetadata(file, token) {
    try {
        const MediaInfo = await loadMediaInfoLibrary();
        const info = await (function () { try { return MediaInfo({ locateFile: () => '/vendor/mediainfo/MediaInfoModule.wasm' }); } catch { return new MediaInfo({ locateFile: () => '/vendor/mediainfo/MediaInfoModule.wasm' }); } })();
        const result = await info.analyzeData(file.size, async (chunkSize, offset) => new Uint8Array(await file.slice(offset, offset + chunkSize).arrayBuffer()));
        info.close();
        if (token !== tokens.background || media.videoFile !== file) return;
        const general = Array.isArray(result?.media?.track) ? result.media.track.find(t => t?.['@type'] === 'General') : null;
        if (!general || ['project','manual','lyrics-service','lrc'].includes(state.audio.metadataSource)) return;
        const title  = String(general.Title || '').trim();
        const artist = String(general.Performer || general.Album_Performer || '').trim();
        const album  = String(general.Album || '').trim();
        if (title)  state.audio.metadata.title  = title;
        if (artist) state.audio.metadata.artist = artist;
        if (album)  state.audio.metadata.album  = album;
        if (title || artist || album) {
            state.audio.metadataSource = 'embedded';
            updateMetadataInputs();
            redrawCurrentPreviewFrame();
            audioStatus.textContent = file.name + ' · embedded metadata';
        }
        readEmbeddedAudioMetadata(file, token, 'video');
    } catch (e) { console.info('No readable embedded video metadata:', e?.message || e); }
}

// ---------- file handlers ----------
export function handleAudioFile(file) {
    if (runtime.isExporting) { toast('Finish or cancel the current export first', 'error'); return; }
    if (!file) return;
    if (file.type && !file.type.startsWith('audio/') && !/\.(mp3|m4a|aac|wav|flac|ogg|oga|opus|webm)$/i.test(file.name)) {
        toast("That doesn't look like an audio file", 'error'); return;
    }
    if (file.size > MAX_AUDIO_BYTES) {
        toast('Audio file too large (max ' + Math.round(MAX_AUDIO_BYTES / 1024 / 1024) + 'MB)', 'error'); return;
    }
    const name = (file.name || '').toLowerCase();
    const type = (file.type || '').toLowerCase();
    if (/\[alac\]/.test(name) || /\balac\b/.test(name) || type === 'audio/x-alac') {
        toast('❌ "' + file.name + '" is a lossless ALAC file. Your browser can play it, but can’t analyse it — the visualiser needs PCM/AAC. Export it as MP3 or AAC/M4A first.', 'error');
        audioStatus.textContent = file.name + ' — ALAC not supported. Export as MP3 or AAC.';
        audioStatus.className = 'status error';
        return;
    }
    const replacing = Boolean(state.audio.file);
    const token = ++tokens.audio;
    if (blobs.audioURL) URL.revokeObjectURL(blobs.audioURL);
    blobs.audioURL = URL.createObjectURL(file);
    state.audio.file = file; state.audio.url = blobs.audioURL; state.audio.duration = 0; state.audio.ready = false;
    if (state.audioSource) { state.audioSource.master = 'uploaded'; state.audioSource.userChosen = false; }
    const parsed = songFromFilename(file.name);
    state.audio.metadata = { title: parsed.track || '', artist: parsed.artist || '', album: '' };
    state.audio.metadataSource = 'filename';
    if (replacing) {
        state.lyrics.lines = []; state.lyrics.plainText = ''; state.lyrics.source = '';
        $('lyricsStatus').textContent = 'No lyrics loaded';
        $('lyricsStatus').className = 'status';
    }
    albumArtwork.image = null; state.audio.hasArtwork = false; window.kefeAlbumArt = null;
    if (blobs.albumArtworkURL) { URL.revokeObjectURL(blobs.albumArtworkURL); blobs.albumArtworkURL = null; }
    updateMetadataInputs();
    audio.src = blobs.audioURL; audio.load();
    audioStatus.textContent = file.name; audioStatus.className = 'status success';
    toast('Audio loaded: ' + file.name, 'success');
    audio.addEventListener('error', () => {
        const code = audio.error ? audio.error.code : 0;
        const reason = code === 4 ? 'unsupported format or codec (Opus, AC3, unusual MP4 variants)'
                     : code === 3 ? 'file is corrupt or truncated'
                     : code === 2 ? 'network error while loading'
                     : code === 1 ? 'load was aborted' : 'unknown error';
        audioStatus.textContent = file.name + ' — ' + reason;
        audioStatus.className = 'status error';
        toast('❌ Could not play "' + file.name + '" — ' + reason + '. Try MP3 or re-encode to AAC/M4A.', 'error');
    }, { once: true });
    readiness();
    readEmbeddedAudioMetadata(file, token);
}

export async function detectVideoHasAudio(file, vid) {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx && file) {
            const ac = new AudioCtx();
            try {
                const bytes = await file.arrayBuffer();
                const decoded = await new Promise((resolve, reject) => {
                    const p = ac.decodeAudioData(bytes.slice(0), resolve, reject);
                    if (p?.then) p.then(resolve, reject);
                });
                return Boolean(decoded && decoded.numberOfChannels > 0 && decoded.length > 0);
            } finally { try { await ac.close(); } catch {} }
        }
    } catch {}
    try {
        if (vid.audioTracks && vid.audioTracks.length) return true;
        if (vid.mozHasAudio) return true;
        if (vid.webkitAudioDecodedByteCount && vid.webkitAudioDecodedByteCount > 0) return true;
    } catch {}
    return false;
}

export function handleBackgroundFile(file) {
    if (runtime.isExporting) { toast('Finish or cancel the current export first', 'error'); return; }
    if (!file) return;
    if (!file.type || (!file.type.startsWith('image/') && !file.type.startsWith('video/'))) {
        toast('Background must be an image or video file', 'error'); return;
    }
    if (file.size > MAX_BACKGROUND_BYTES) {
        toast('Background file too large (max ' + Math.round(MAX_BACKGROUND_BYTES / 1024 / 1024) + 'MB)', 'error'); return;
    }
    const token = ++tokens.background;
    const url = URL.createObjectURL(file);
    if (file.type.startsWith('video/')) {
        const vid = document.createElement('video');
        vid.muted = true; vid.loop = true; vid.playsInline = true; vid.src = url; vid.load();
        vid.addEventListener('loadeddata', async () => {
            if (runtime.isExporting || token !== tokens.background) { vid.pause(); vid.src = ''; URL.revokeObjectURL(url); return; }
            const hasAudio = await detectVideoHasAudio(file, vid);
            if (runtime.isExporting || token !== tokens.background) { vid.pause(); vid.src = ''; URL.revokeObjectURL(url); return; }
            if (media.video && media.video !== vid) { media.video.pause(); media.video.src = ''; }
            if (blobs.backgroundURL) URL.revokeObjectURL(blobs.backgroundURL);
            blobs.backgroundURL = url;
            vid.addEventListener('ended', () => {
                if (getMasterMode() !== 'video') return;
                setPlayIcon(false); state.playback.isPlaying = false;
                if (!runtime.isExporting) redrawCurrentPreviewFrame();
            });
            media.video = vid; media.videoFile = file; media.image = null; media.videoHasAudio = hasAudio;
            state.background.type = 'video';
            $('backgroundStatus').textContent = file.name + (hasAudio ? ' · has audio' : '');
            $('backgroundStatus').className = 'status success';
            toast('Background video loaded' + (hasAudio ? '' : ' (no audio track)'), 'success');
            if (!state.audio.metadata.title && !state.audio.metadata.artist) {
                const g = songFromFilename(file.name);
                if (g.track || g.artist) {
                    state.audio.metadata.title = g.track; state.audio.metadata.artist = g.artist;
                    state.audio.metadataSource = 'filename-guess';
                    updateMetadataInputs();
                }
            }
            readEmbeddedVideoMetadata(file, token);
            if (!state.audio.file) {
                applyMasterSelection(hasAudio ? 'video' : 'uploaded', { userInitiated: false, silent: true });
            } else if (hasAudio && getMasterMode() !== 'video') {
                if (media.video) media.video.muted = true;
                state.audioSource.master = 'uploaded';
                state.audioSource.userChosen = true;
                syncMasterSourceUI();
            }
            document.dispatchEvent(new CustomEvent('kefe:background-ready'));
            readiness();
            runtime.hasLastVideoFrame = false;
            const t = getMasterTime();
            if (Number.isFinite(vid.duration) && vid.duration > 0) vid.currentTime = wrappedVideoTime(t, vid.duration);
            redrawCurrentPreviewFrame();
        });
        vid.addEventListener('error', () => {
            URL.revokeObjectURL(url);
            if (token !== tokens.background) return;
            toast('Video failed to load', 'error');
            $('backgroundStatus').textContent = 'Error loading video';
            $('backgroundStatus').className = 'status error';
        });
    } else {
        const img = new Image();
        img.onload = () => {
            if (runtime.isExporting || token !== tokens.background) { URL.revokeObjectURL(url); return; }
            if (media.video) { media.video.pause(); media.video.src = ''; media.video = null; }
            if (blobs.backgroundURL) URL.revokeObjectURL(blobs.backgroundURL);
            blobs.backgroundURL = url;
            media.image = img; state.background.type = 'image';
            $('backgroundStatus').textContent = file.name;
            $('backgroundStatus').className = 'status success';
            toast('Background image loaded', 'success');
            readiness();
            redrawCurrentPreviewFrame();
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            if (token !== tokens.background) return;
            toast('Image failed to load', 'error');
            $('backgroundStatus').textContent = 'Error loading image';
            $('backgroundStatus').className = 'status error';
        };
        img.src = url;
    }
}

export function handleMediaSourceFile(file) {
    if (!file) return;
    const isVideo = (file.type && file.type.startsWith('video/')) || /\.(mp4|mov|webm|m4v|avi|mkv)$/i.test(file.name);
    if (isVideo) handleBackgroundFile(file);
    else handleAudioFile(file);
}

export function wireMediaInputs() {
    const audioInput = document.getElementById('audioInput');
    if (audioInput) audioInput.addEventListener('change', function () {
        const f = this.files && this.files[0];
        if (f) handleMediaSourceFile(f);
    });
    const bgInput = $('backgroundInput');
    bgInput.addEventListener('change', function () { handleBackgroundFile(this.files[0]); });
    setupDropZone($('audioDrop'), 'audioInput');
    setupDropZone($('bgDrop'), 'backgroundInput');
}

function setupDropZone(zone, inputId) {
    if (!zone) return;
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => {
        e.preventDefault(); zone.classList.remove('dragover');
        const f = e.dataTransfer?.files?.[0];
        if (!f) return;
        if (inputId === 'audioInput') handleMediaSourceFile(f);
        if (inputId === 'backgroundInput') handleBackgroundFile(f);
    });
}

// Video plays ended → forward ref
import { setPlayIcon } from './playback.js';