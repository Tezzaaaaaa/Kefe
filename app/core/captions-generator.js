import { state, media, $, runtime } from './context.js';
import { toast } from './utils.js';
import { markSectionTouched, activeTextMode } from './utils.js';
import { readiness } from './status.js';
import { redrawCurrentPreviewFrame, getMasterMode } from './playback.js';

const MIN_SEG = 0.5, MERGE_GAP = 0.35, PAD_HEAD = 0.10, PAD_TAIL = 0.28, MAX_BLOCKS = 2000;

export async function autoGenerateCaptions() {
    if (runtime.isExporting) { toast('Finish or cancel the current export first', 'error'); return; }
    const mode = getMasterMode();
    const file = mode === 'video' ? media.videoFile : state.audio.file;
    if (!file) {
        $('captionsStatus').textContent = 'Add an audio file (or a video with sound) in Step 01 first — captions are generated from its sound.';
        $('captionsStatus').className = 'status error';
        toast('Add audio first — captions are generated from sound', 'error'); return;
    }
    const button = $('autoCaptionsBtn');
    if (button) button.disabled = true;
    $('captionsStatus').textContent = 'Analysing audio for speech and vocals…';
    $('captionsStatus').className = 'status loading';
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) throw new Error('This browser cannot analyse audio');
        const buffer = await file.arrayBuffer();
        const ac = new AudioCtx();
        const decoded = await ac.decodeAudioData(buffer);
        const sr = decoded.sampleRate;
        const data = decoded.getChannelData(0);
        const win = Math.max(1, Math.round(sr * 0.05));
        const rms = [];
        for (let i = 0; i + win <= data.length; i += win) {
            let sum = 0;
            for (let j = i; j < i + win; j += 4) sum += data[j] * data[j];
            rms.push(Math.sqrt(sum / (win / 4)));
        }
        ac.close?.();
        if (!rms.length) throw new Error('Audio is too short to analyse');
        const sorted = rms.slice().sort((a, b) => a - b);
        const floor = sorted[Math.floor(sorted.length * 0.10)] || 0;
        const peak  = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.98))] || 1;
        const thresh = Math.max(0.012, floor + (peak - floor) * 0.14);
        const minW = Math.max(1, Math.round(MIN_SEG / 0.05));
        const mergeW = Math.max(1, Math.round(MERGE_GAP / 0.05));
        const segs = []; let start = -1, silence = 0;
        for (let i = 0; i < rms.length; i++) {
            const loud = rms[i] >= thresh;
            if (loud) { if (start < 0) start = i; silence = 0; }
            else if (start >= 0) {
                silence++;
                if (silence >= mergeW) { const end = i - silence + 1; if (end - start >= minW) segs.push([start, end]); start = -1; silence = 0; }
            }
        }
        if (start >= 0 && rms.length - start >= minW) segs.push([start, rms.length]);
        if (!segs.length) {
            $('captionsStatus').textContent = 'No clear speech or vocals found — the audio may be too quiet. Try louder source material, or add caption blocks manually.';
            $('captionsStatus').className = 'status error'; return;
        }
        const total = decoded.duration;
        state.captions.lines = segs.slice(0, MAX_BLOCKS).map(([a, b]) => ({
            time: Math.max(0, a * 0.05 - PAD_HEAD),
            endTime: Math.min(total, b * 0.05 + PAD_TAIL),
            text: ''
        }));
        markSectionTouched('text');
        $('captionsStatus').textContent = `Generated ${state.captions.lines.length} timed caption blocks — open Edit Captions and type what you hear for each block.`;
        $('captionsStatus').className = 'status success';
        toast(`Generated ${state.captions.lines.length} caption blocks`, 'success');
        readiness(); redrawCurrentPreviewFrame();
        document.dispatchEvent(new CustomEvent('kefe:captions-generated'));
    } catch (e) {
        const reason = e?.name === 'EncodingError'
            ? 'this audio format could not be decoded in the browser — try MP3, M4A or WAV, or add caption blocks manually'
            : (e?.message || 'analysis failed');
        $('captionsStatus').textContent = `Caption generation failed: ${reason}`;
        $('captionsStatus').className = 'status error';
        toast('Caption generation failed', 'error');
    } finally {
        if (button) button.disabled = false;
    }
}