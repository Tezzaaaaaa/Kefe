import { state, $ } from '../core/context.js';
import { runtime } from '../core/context.js';
import { linaClamp, markSectionTouched, toast } from '../core/utils.js';
import { redrawCurrentPreviewFrame } from '../core/playback.js';
import { resolveTitleCardDesign } from '../effects/Titlecard.js';

export function syncTitleCardUI() {
    const toggle = $('titleCardEnabled');
    if (toggle) toggle.checked = state.style.titleCardEnabled !== false;
    const dur = $('titleCardDuration');
    if (dur) dur.value = String(linaClamp(Number(state.style.titleCardDuration) || 3, 1, 15));
    const durVal = $('titleCardDurationVal');
    if (durVal) durVal.textContent = `${linaClamp(Number(state.style.titleCardDuration) || 3, 1, 15)}s`;
    const styleSel = $('titleCardStyle');
    if (styleSel) styleSel.value = state.style.titleCardStyle || 'auto';
    updateTitleCardHint();
}

export function updateTitleCardHint() {
    const hint = $('titleCardStyleHint');
    if (!hint) return;
    const chosen = state.style.titleCardStyle || 'auto';
    const resolved = resolveTitleCardDesign(state);
    const labels = { auto: 'Auto (matches effect)', minimal: 'Minimal', spotlight: 'Spotlight', editorial: 'Editorial', statement: 'Statement' };
    hint.textContent = chosen === 'auto' ? `Auto → ${labels[resolved]}` : labels[chosen] || '';
}

export function wireTitleCardControls() {
    $('titleCardEnabled')?.addEventListener('change', function () {
        if (runtime.isExporting) { this.checked = state.style.titleCardEnabled; toast('Finish or cancel the current export first', 'error'); return; }
        state.style.titleCardEnabled = this.checked;
        markSectionTouched('title');
        redrawCurrentPreviewFrame();
    });
    $('titleCardStyle')?.addEventListener('change', function () {
        if (runtime.isExporting) { this.value = state.style.titleCardStyle || 'auto'; toast('Finish or cancel the current export first', 'error'); return; }
        state.style.titleCardStyle = this.value;
        markSectionTouched('title');
        updateTitleCardHint();
        redrawCurrentPreviewFrame();
    });
    $('titleCardDuration')?.addEventListener('input', function () {
        if (runtime.isExporting) { this.value = String(state.style.titleCardDuration || 3); return; }
        state.style.titleCardDuration = linaClamp(Number(this.value) || 3, 1, 15);
        $('titleCardDurationVal').textContent = `${state.style.titleCardDuration}s`;
        markSectionTouched('title');
        redrawCurrentPreviewFrame();
    });
    document.addEventListener('kefe:effect-changed', updateTitleCardHint);
}