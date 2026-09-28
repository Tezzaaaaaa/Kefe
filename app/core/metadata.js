import { state, $ } from './context.js';
import { songFromFilename, cleanTrackName, isUsefulExportLabel } from './module-lyrics.js';

export function resolveAudioLabels(audioState = state.audio) {
    const metadata = audioState?.metadata || {};
    const fallback = audioState?.file ? songFromFilename(audioState.file.name) : { track:'', artist:'' };
    const fallbackTitle = cleanTrackName(fallback.track);
    const fallbackArtist = String(fallback.artist || '').trim();
    const useFields = audioState === state.audio;
    const titleField  = useFields ? $('metaTitle')  : null;
    const artistField = useFields ? $('metaArtist') : null;
    const albumField  = useFields ? $('metaAlbum')  : null;
    let title  = cleanTrackName(titleField  ? titleField.value  : metadata.title);
    let artist = String(     artistField ? artistField.value : (metadata.artist || '')).trim();
    const album = String(    albumField  ? albumField.value  : (metadata.album  || '')).trim();
    if (!isUsefulExportLabel(title))  title  = fallbackTitle;
    if (!isUsefulExportLabel(artist)) artist = fallbackArtist;
    return { title: String(title || '').trim(), artist: String(artist || '').trim(), album };
}

export function updateMetadataInputs() {
    const t = $('metaTitle'), a = $('metaArtist'), al = $('metaAlbum');
    if (t)  t.value  = state.audio.metadata.title  || '';
    if (a)  a.value  = state.audio.metadata.artist || '';
    if (al) al.value = state.audio.metadata.album  || '';
    updateGoogleLyricsButton();
}

export function updateGoogleLyricsButton() {
    const btn = $('searchGoogleLyricsBtn');
    if (!btn) return;
    const r = resolveAudioLabels(state.audio);
    btn.disabled = !(r.title && r.artist);
}