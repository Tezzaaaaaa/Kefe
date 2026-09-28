import { state, canvas, $ } from './context.js';
import { runtime } from './context.js';
import { toast } from './utils.js';
import { saveLinaPrefs } from './context.js';
import { redrawCurrentPreviewFrame } from './playback.js';

export const ASPECTS = {
    '9:16': { w:1080, h:1920, label:'1080 × 1920 (Vertical)' },
    '1:1':  { w:1080, h:1080, label:'1080 × 1080 (Square)' },
    '16:9': { w:1920, h:1080, label:'1920 × 1080 (Horizontal)' }
};

export function setAspectRatio(key) {
    if (runtime.isExporting) { toast('Finish or cancel the current export first', 'error'); return; }
    const aspect = ASPECTS[key];
    if (!aspect) return;
    state.aspect = key;
    canvas.width = aspect.w;
    canvas.height = aspect.h;
    const select = $('aspectSelect');
    if (select && select.value !== key) select.value = key;
    const info = $('aspectInfo');
    if (info) info.textContent = aspect.label;
    saveLinaPrefs();
    redrawCurrentPreviewFrame();
}