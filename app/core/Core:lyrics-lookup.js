import { state, media, $ } from './context.js';
import { runtime } from './context.js';
import { toast } from './utils.js';
import {
    songFromFilename, cleanLyricsLookupText, parseAutoSyncedLyrics,
    readAutoLyricsCache, writeAutoLyricsCache, fetchAutomaticLyrics,
    requestSyncedLyrics, parseLyrics, formatTime
} from './module-lyrics.js';
import { resolveAudioLabels, updateMetadataInputs } from './metadata.js';
import { tokens } from './context.js';
import { redrawCurrentPreviewFrame, getMasterDuration } from './playback.js';
import { readiness } from './status.js';

export function resolveLyricsLookupMetadata() {
    const taggedArtist = cleanLyricsLookupText(state.audio.metadata?.artist);
    const taggedTitle  = cleanLyricsLookupText(state.audio.metadata?.title);
    if (taggedArtist && taggedTitle) return { artist: taggedArtist, title: taggedTitle };
    const guessed = songFromFilename(state.audio.file?.name || '');
    return {
        artist: taggedArtist || cleanLyricsLookupText(guessed.artist),
        title:  taggedTitle  || cleanLyricsLookupText(guessed.track)
    };
}

function applyAutomaticLyrics(result) {
    state.lyrics.lines = result.syncedLyrics ? parseAutoSyncedLyrics(result.syncedLyrics) : [];
    state.lyrics.plainText = result.syncedLyrics ? '' : String(result.plainText || '');
    state.lyrics.source = result.source || '';
    redrawCurrentPreviewFrame();
}

export async function autoFetchLyricsForCurrentTrack(file, token) {
    if (!file || token !== tokens.audio || state.audio.file !== file) return;
    const { artist, title } = resolveLyricsLookupMetadata();
    if (!artist || !title) return;
    const status = $('lyricsStatus');
    if (status) { status.textContent = 'Fetching lyrics…'; status.className = 'status'; }
    const cached = readAutoLyricsCache(artist, title);
    if (cached) {
        if (token !== tokens.audio || state.audio.file !== file) return;
        applyAutomaticLyrics(cached);
        if (status) { status.textContent = cached.syncedLyrics ? 'Synced lyrics loaded' : 'Lyrics loaded'; status.className = 'status success'; }
        return;
    }
    const result = await fetchAutomaticLyrics(artist, title);
    if (token !== tokens.audio || state.audio.file !== file) return;
    if (!result) {
        state.lyrics.lines = []; state.lyrics.plainText = ''; state.lyrics.source = '';
        if (status) { status.textContent = 'No lyrics loaded'; status.className = 'status'; }
        redrawCurrentPreviewFrame();
        return;
    }
    writeAutoLyricsCache(artist, title, result);
    applyAutomaticLyrics(result);
    if (status) { status.textContent = result.syncedLyrics ? 'Synced lyrics loaded' : 'Lyrics loaded'; status.className = 'status success'; }
}

// ---- UI wiring ----
export function wireLyricsLookupButtons() {
    $('searchGoogleLyricsBtn').addEventListener('click', function () {
        const r = resolveAudioLabels(state.audio);
        if (!r.title || !r.artist) return;
        const q = `${r.artist} ${r.title} lyrics lrc`;
        window.open('https://www.google.com/search?q=' + encodeURIComponent(q), '_blank', 'noopener,noreferrer');
    });
    $('findLyricsBtn').addEventListener('click', onFindLyrics);
    ['metaArtist', 'metaTitle'].forEach(id => $(id)?.addEventListener('input', () => {}));
}

async function onFindLyrics() {
    const btn = $('findLyricsBtn');
    if (runtime.isExporting) { toast('Finish or cancel the current export first', 'error'); return; }
    const r = resolveAudioLabels(state.audio);
    let artist = r.artist, track = r.title;

    if (!track || !artist) {
        const sourceFile = (media.videoFile && media.videoFile.name) || (state.audio.file && state.audio.file.name) || '';
        if (sourceFile) {
            const g = songFromFilename(sourceFile);
            if (!track && g.track) track = g.track;
            if (!artist && g.artist) artist = g.artist;
            track = String(track || '').replace(/\s*[\(\[][^\)\]]*[\)\]]\s*$/g, '')
                .replace(/\s+(official|lyric|lyrics|audio|visuali[sz]er|video|HD|4K)\s*$/ig, '').trim();
            artist = String(artist || '').trim();
            if (track && $('metaTitle') && !$('metaTitle').value.trim()) $('metaTitle').value = track;
            if (artist && $('metaArtist') && !$('metaArtist').value.trim()) $('metaArtist').value = artist;
            if (track) state.audio.metadata.title = track;
            if (artist) state.audio.metadata.artist = artist;
        }
    }
    if (!track || !artist) {
        const msg = !track && !artist ? 'Enter the song title and artist first' : (!track ? 'Enter the song title first' : 'Enter the artist first');
        $('lyricsStatus').textContent = msg;
        $('lyricsStatus').className = 'status error';
        toast(msg, 'error'); return;
    }
    $('lyricsStatus').textContent = 'Searching...'; $('lyricsStatus').className = 'status loading';
    btn.disabled = true;
    try {
        const ctrl = new AbortController();
        const to = setTimeout(() => ctrl.abort(), 18000);
        let match;
        try { match = await requestSyncedLyrics(artist, track, getMasterDuration() || state.audio.duration, ctrl.signal); }
        catch (e) { throw new Error(e.name === 'AbortError' ? 'Lyrics search timed out' : (e.message || 'Lyrics search failed (network error)')); }
        finally { clearTimeout(to); }
        if (!match || !match.syncedLyrics) throw new Error('No synced lyrics');
        const parsed = parseLyrics(match.syncedLyrics);
        if (!parsed.lines.length) throw new Error('No valid timed lyrics found');
        if (runtime.isExporting) return;
        state.lyrics.lines = parsed.lines;
        if (match.trackName)  state.audio.metadata.title  = String(match.trackName).trim();
        if (match.artistName) state.audio.metadata.artist = String(match.artistName).trim();
        if (match.albumName)  state.audio.metadata.album  = String(match.albumName).trim();
        if (match.trackName || match.artistName || match.albumName) state.audio.metadataSource = 'lyrics-service';
        updateMetadataInputs();
        document.dispatchEvent(new CustomEvent('kefe:lyrics-resolved', { detail: { source: 'lrclib', artist, track, lines: state.lyrics.lines } }));
        $('lyricsStatus').textContent = parsed.lines.length + ' lines loaded' + (parsed.skippedCount ? ' (' + parsed.skippedCount + ' unparsable line' + (parsed.skippedCount === 1 ? '' : 's') + ' skipped)' : '');
        $('lyricsStatus').className = 'status success';
        toast('Lyrics loaded' + (parsed.skippedCount ? ', ' + parsed.skippedCount + ' line(s) could not be parsed' : ''), 'success');
        readiness(); redrawCurrentPreviewFrame();
    } catch (e) {
        if (runtime.isExporting) return;
        $('lyricsStatus').textContent = e.message;
        $('lyricsStatus').className = 'status error';
        toast(e.message, 'error');
    }
    btn.disabled = false;
}

// Re-exports for LRC file loaders
export { formatTime };