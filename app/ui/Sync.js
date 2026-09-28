import { state, $, qsa, runtime } from '../core/context.js';
import { redrawCurrentPreviewFrame } from '../core/playback.js';
import { updateSyncStatusUI, nudgeLyricTiming } from '../core/status.js';

export function wireSyncControls() {
    $('lyricsOffset')?.addEventListener('input', function () {
        if (runtime.isExporting) { this.value = String(state.lyricsOffset || 0); return; }
        state.lyricsOffset = Number(this.value) || 0;
        updateSyncStatusUI();
        redrawCurrentPreviewFrame();
    });
    $('resetOffset')?.addEventListener('click', () => {
        if (runtime.isExporting) return;
        state.lyricsOffset = 0;
        updateSyncStatusUI();
        redrawCurrentPreviewFrame();
    });
    qsa('[data-nudge]').forEach(b => b.addEventListener('click', () => nudgeLyricTiming(Number(b.dataset.nudge))));
}