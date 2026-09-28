import { state, media, audio, $, qsa, runtime } from './context.js';
import { fmt, toast } from './utils.js';
import { readiness } from './status.js';
import { isMasterPlaying, pauseMasterPlayback, redrawCurrentPreviewFrame } from './playback.js';

export const MASTER_MODES = ['uploaded', 'video'];
export const MASTER_MODE_LABELS = {
    uploaded: 'Uploaded Audio',
    video: 'Background Video Audio'
};

export function getMasterModeFromState() { return state.audioSource.master || 'uploaded'; }

export function masterModeAvailable(mode) {
    if (mode === 'uploaded') return Boolean(state.audio.file);
    if (mode === 'video')    return Boolean(media.video && media.videoFile && media.videoHasAudio);
    return false;
}

export function applyMasterSelection(mode, opts = {}) {
    const userInitiated = Boolean(opts.userInitiated);
    const silent = Boolean(opts.silent);
    if (!MASTER_MODES.includes(mode)) return false;
    if (userInitiated && !masterModeAvailable(mode)) {
        toast('That audio source is not available right now', 'error'); syncMasterSourceUI(); return false;
    }
    if (!userInitiated && state.audioSource.userChosen) { syncMasterSourceUI(); return false; }
    if (runtime.isExporting) { toast('Finish or cancel the current export first', 'error'); return false; }
    if (isMasterPlaying()) pauseMasterPlayback();
    const previous = getMasterModeFromState();
    state.audioSource.master = mode;
    if (userInitiated) {
        state.audioSource.userChosen = true;
        if (!silent && state.lyrics.lines.length) {
            toast('Timed text was synchronized against another source — it may no longer match the new master audio', '');
        }
    }
    if (previous !== mode) {
        if (mode === 'uploaded' && state.audio.file) {
            if (!audio.src || audio.src !== state.audio.url) { audio.src = state.audio.url; audio.load(); }
            if (media.video) { media.video.muted = true; media.video.loop = true; }
        } else if (mode === 'video' && media.video) {
            media.video.muted = false; media.video.loop = false;
            if (audio && !audio.paused) audio.pause();
        } else {
            if (audio && !audio.paused) audio.pause();
            if (media.video) { media.video.muted = true; media.video.loop = true; if (!media.video.paused) media.video.pause(); }
        }
    }
    syncMasterSourceUI(); readiness(); redrawCurrentPreviewFrame();
    return true;
}

export function renderMasterSourceUI() {
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
                if (applyMasterSelection(mode, { userInitiated: true, silent: false })) {
                    toast(MASTER_MODE_LABELS[mode] + ' is now the audio source', 'success');
                }
            });
            box.appendChild(btn);
        }
    }
    syncMasterSourceUI();
}

export function syncMasterSourceUI() {
    const mode = getMasterModeFromState();
    qsa('#audioSourceButtons button').forEach(b => {
        b.classList.toggle('active-effect', b.dataset.master === mode);
        b.disabled = !masterModeAvailable(b.dataset.master) && b.dataset.master !== mode;
    });
    const status = $('audioSourceStatus');
    if (!status) return;
    const upDur = state.audio.duration > 0 ? fmt(state.audio.duration) : '—';
    const vDur = media.video?.duration > 0 ? fmt(media.video.duration) : '—';
    const parts = [
        `<strong>${MASTER_MODE_LABELS[mode] || mode}</strong>`,
        `Uploaded: ${upDur}`,
        `Video audio: ${media.videoHasAudio ? vDur + ' (available)' : '—'}`
    ];
    if (mode === 'video') parts.push('The background video audio drives the timeline.');
    if (mode === 'video' && !state.audio.metadata.title) parts.push('Add a song title above to search for synced lyrics.');
    if (mode === 'none') parts.push('No audio will be heard or exported.');
    status.innerHTML = parts.join(' · ');
}

const modal = () => $('masterAudioChoice');
export function promptMasterAudioChoice() {
    const m = modal();
    if (!m) return;
    const info = $('masterAudioChoiceInfo');
    if (info) {
        const upDur = state.audio.duration > 0 ? fmt(state.audio.duration) : '—';
        const vDur = media.video?.duration > 0 ? fmt(media.video.duration) : '—';
        info.innerHTML = `Uploaded audio: ${upDur} &middot; Video audio: ${vDur}`;
    }
    m.classList.remove('hidden');
}
export function closeMasterAudioChoice() { modal()?.classList.add('hidden'); }

export function wireMasterChoiceModal() {
    const m = modal();
    if (!m) return;
    qsa('#masterAudioChoice [data-master]').forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.master;
            state.audioSource.userChosen = false;
            applyMasterSelection(mode, { userInitiated: true, silent: mode === getMasterModeFromState() });
            closeMasterAudioChoice();
        });
    });
}