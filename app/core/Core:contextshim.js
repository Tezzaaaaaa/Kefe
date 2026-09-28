export const state = {
    audio: { file: null, url: null, duration: 0, ready: false, metadata: { title:'', artist:'', album:'' }, metadataSource:'none', hasArtwork:false },
    lyrics: { lines: [], plainText: '', source: '' },
    style: {
        effect:'apple', fontSize:76, align:'left',
        accentColor:'#FFFFFF', textColor:'#FFFFFF', bratTextColor:'#FFFFFF',
        appleInactiveOpacity:0.25, appleGlow:0.012, appleDepth:0.008, appleLift:0,
        appleHighlightSpan:0.92, appleVisibleLines:4, appleTopOffset:0.245, appleLineSpacing:0.72,
        bratSideMargin:4.5, bratTopMargin:4.5, bratTypingSpeed:1,
        eternalInkColor:'#FFFFFF', eternalPenWidth:21, eternalWriteSpan:0.90, eternalGlow:3, eternalPresence:0.65,
        auroraSpeed:1.2, auroraIntensity:0.7, auroraSaturation:1.0,
        pulseAmplitude:0.4, pulseFrequency:1.2, pulseGlowSize:1.0,
        titleCardEnabled:true, titleCardDuration:3, titleCardStyle:'spotlight'
    },
    background: { type:'solid', image:null, video:null, dim:0.35, solid:'#0A0A0A', blur:0 },
    playback: { isPlaying:false, currentTime:0, isSeeking:false },
    audioSource: { master:'uploaded', userChosen:false },
    captions: { mode:'lyrics', lines:[] },
    captionStyle: { position:'bottom', opacity:1, color:'#FFFFFF', shadow:true },
    projectType:'lyric',
    lyricsOffset: 0,
    touched: { fx:false, background:false, title:false },
    aspect: '9:16'
};

export const $ = id => document.getElementById(id);
export const qsa = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

export const canvas = $('stageCanvas');
export const ctx = canvas.getContext('2d', { alpha: true });
export const audio = new Audio();

export const media = { image:null, video:null, videoFile:null, videoHasAudio:false };

export const blobs = { audioURL:null, backgroundURL:null, albumArtworkURL:null };
export const albumArtwork = { image:null };

export const tokens = { audio:0, background:0 };

export const runtime = {
    isExporting: false,
    userScrubbing: false,
    lastVideoHardSync: -Infinity,
    exportClockTime: null,
    renderLoopId: null,
    hasLastVideoFrame: false
};

export const noneClock = { running:false, base:0, wall:0 };

export const lastVideoFrame = document.createElement('canvas');
export const lastVideoFrameCtx = lastVideoFrame.getContext('2d');

const LINA_PREFS_KEY = 'lina-visualiser-prefs-v1';
export function saveLinaPrefs() {
    try {
        localStorage.setItem(LINA_PREFS_KEY, JSON.stringify({
            metadata: state.audio.metadata,
            aspect: state.aspect,
            effect: state.style.effect
        }));
    } catch (_) {}
}
export function loadLinaPrefs() {
    try {
        const raw = localStorage.getItem(LINA_PREFS_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_) { return null; }
}

export function applyNightPresentation() {
    document.documentElement.dataset.theme = 'night';
    document.documentElement.style.colorScheme = 'dark';
}

// ---------- globals existing files expect ----------
window.state = state;
window.kefeAudioElement = audio;
window.kefeMedia = media;

// ---------- compatibility shims (safe to remove later) ----------
Object.defineProperty(window, 'audioLoadToken',      { get: () => tokens.audio,       set: v => { tokens.audio = v; } });
Object.defineProperty(window, 'backgroundLoadToken', { get: () => tokens.background,  set: v => { tokens.background = v; } });
Object.defineProperty(window, 'audioURL',            { get: () => blobs.audioURL,     set: v => { blobs.audioURL = v; } });
Object.defineProperty(window, 'backgroundURL',       { get: () => blobs.backgroundURL, set: v => { blobs.backgroundURL = v; } });
Object.defineProperty(window, 'albumArtworkURL',     { get: () => blobs.albumArtworkURL, set: v => { blobs.albumArtworkURL = v; } });
Object.defineProperty(window, 'albumArtworkImage',   { get: () => albumArtwork.image, set: v => { albumArtwork.image = v; } });
Object.defineProperty(window, 'isExporting',         { get: () => runtime.isExporting, set: v => { runtime.isExporting = v; } });