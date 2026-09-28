import { state, $, qsa, runtime } from '../core/context.js';
import { toast, markSectionTouched } from '../core/utils.js';
import { formatTime } from '../core/module-lyrics.js';
import { splitCaptionText } from '../core/module-lyrics.js';
import { redrawCurrentPreviewFrame } from '../core/playback.js';
import { readiness, refreshLyricsTimingStatus } from '../core/status.js';
import { linaClamp } from '../core/utils.js';
import { autoGenerateCaptions } from '../core/captions-generator.js';

export function applyTextMode(mode) {
    state.captions.mode = mode === 'captions' ? 'captions' : 'lyrics';
    qsa('[data-text-mode]').forEach(b => {
        const active = b.dataset.textMode === state.captions.mode;
        b.classList.toggle('active', active);
        b.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    $('lyricsPanel')?.classList.toggle('hidden', state.captions.mode !== 'lyrics');
    $('captionsPanel')?.classList.toggle('hidden', state.captions.mode !== 'captions');
    $('lyricStyleBlock')?.classList.toggle('hidden', state.captions.mode === 'captions');
    const badge = $('previewModeBadge');
    if (badge) badge.textContent = state.captions.mode === 'captions' ? 'Captions' : 'Lyrics';
    refreshLyricsTimingStatus();
    redrawCurrentPreviewFrame();
}

const CAPTION_POSITIONS = ['bottom', 'top'];
export function applyCaptionPosition(pos) {
    state.captionStyle.position = CAPTION_POSITIONS.includes(pos) ? pos : 'bottom';
    qsa('[data-caption-pos]').forEach(b => b.classList.toggle('active-effect', b.dataset.captionPos === state.captionStyle.position));
    redrawCurrentPreviewFrame();
}
export function syncCaptionStyleUI() {
    const cs = state.captionStyle || {};
    qsa('[data-caption-pos]').forEach(b => b.classList.toggle('active-effect', b.dataset.captionPos === (cs.position || 'bottom')));
    const opPct = Math.round(linaClamp(Number(cs.opacity) || 1, 0.3, 1) * 100);
    const op = $('captionOpacity'); if (op) op.value = String(opPct);
    const opVal = $('captionOpacityVal'); if (opVal) opVal.textContent = `${opPct}%`;
    const colour = $('captionColor'); if (colour && /^#[0-9a-f]{6}$/i.test(cs.color || '')) colour.value = cs.color;
    const shadow = $('captionShadow'); if (shadow) shadow.checked = cs.shadow !== false;
}
export function wireCaptionStyleControls() {
    qsa('[data-caption-pos]').forEach(btn => btn.addEventListener('click', () => {
        if (runtime.isExporting) { syncCaptionStyleUI(); return; }
        applyCaptionPosition(btn.dataset.captionPos);
    }));
    $('captionOpacity')?.addEventListener('input', function () {
        if (runtime.isExporting) { this.value = String(Math.round((Number(state.captionStyle.opacity) || 1) * 100)); return; }
        state.captionStyle.opacity = linaClamp(Number(this.value) / 100, 0.3, 1);
        $('captionOpacityVal').textContent = `${Math.round(state.captionStyle.opacity * 100)}%`;
        redrawCurrentPreviewFrame();
    });
    $('captionColor')?.addEventListener('input', function () {
        if (runtime.isExporting) { this.value = state.captionStyle.color || '#FFFFFF'; return; }
        if (/^#[0-9a-f]{6}$/i.test(this.value)) state.captionStyle.color = this.value;
        redrawCurrentPreviewFrame();
    });
    $('captionShadow')?.addEventListener('change', function () {
        if (runtime.isExporting) { this.checked = state.captionStyle.shadow !== false; return; }
        state.captionStyle.shadow = this.checked;
        redrawCurrentPreviewFrame();
    });
}

export function openCaptionsEditor() {
    if (runtime.isExporting) { toast('Finish or cancel the current export first', 'error'); return; }
    renderCaptionRows();
    $('captionsEditor').classList.remove('hidden');
}
export function renderCaptionRows() {
    const box = $('captionsRows');
    if (!box) return;
    const lines = state.captions.lines;
    if (!lines.length) {
        box.innerHTML = '<div class="caption-hint">No blocks yet — use Auto-generate Timing first, or add blocks below.</div>';
        return;
    }
    box.replaceChildren(...lines.map((line, i) => {
        const row = document.createElement('div'); row.className = 'caption-row';
        const time = document.createElement('span'); time.className = 'caption-time';
        time.textContent = `${formatTime(Number(line.time) || 0)} → ${formatTime(Number(line.endTime) || 0)}`;
        const input = document.createElement('input');
        input.type = 'text'; input.dataset.idx = String(i); input.value = String(line.text || '');
        input.placeholder = 'What is said in this block…';
        input.addEventListener('input', () => { if (lines[i]) lines[i].text = input.value; });
        row.append(time, input);
        return row;
    }));
}

export function wireCaptions() {
    $('autoCaptionsBtn')?.addEventListener('click', autoGenerateCaptions);
    $('editCaptionsBtn')?.addEventListener('click', openCaptionsEditor);
    $('closeCaptions')?.addEventListener('click', () => $('captionsEditor').classList.add('hidden'));
    $('cancelCaptions')?.addEventListener('click', () => $('captionsEditor').classList.add('hidden'));
    $('addCaptionRow')?.addEventListener('click', () => {
        const lines = state.captions.lines;
        const last = lines[lines.length - 1];
        const start = last ? (Number(last.endTime) || (Number(last.time) + 3)) : 0;
        lines.push({ time: start, endTime: start + 3, text: '' });
        renderCaptionRows();
    });
    $('clearCaptionText')?.addEventListener('click', () => {
        state.captions.lines.forEach(l => { l.text = ''; });
        renderCaptionRows();
    });
    $('pasteCaptions')?.addEventListener('click', async function () {
        const status = $('captionsEditorStatus');
        if (!navigator.clipboard || !navigator.clipboard.readText) {
            status.textContent = 'Clipboard paste is not supported here — paste manually with Ctrl/Cmd+V into the text box instead.';
            status.className = 'status error'; return;
        }
        try {
            const text = await navigator.clipboard.readText();
            if (!text) { status.textContent = 'Clipboard is empty'; status.className = 'status error'; return; }
            $('captionsBulkText').value = text;
            status.textContent = 'Pasted — now use “Fit Text to Blocks”.';
            status.className = 'status success';
        } catch { status.textContent = 'Could not read the clipboard — paste manually with Ctrl/Cmd+V instead.'; status.className = 'status error'; }
    });
    $('distributeCaptions')?.addEventListener('click', () => {
        const status = $('captionsEditorStatus');
        const parts = splitCaptionText($('captionsBulkText').value);
        const lines = state.captions.lines;
        if (!lines.length) { status.textContent = 'Generate timing first, then fit text to the blocks.'; status.className = 'status error'; return; }
        if (!parts.length) { status.textContent = 'Add or paste some text first.'; status.className = 'status error'; return; }
        lines.forEach((line, i) => { line.text = parts[i] || line.text || ''; });
        status.textContent = parts.length > lines.length
            ? `Fitted ${lines.length} of ${parts.length} text parts — add ${parts.length - lines.length} more block(s) for the rest.`
            : 'Text fitted across all blocks.';
        status.className = parts.length > lines.length ? 'status' : 'status success';
        renderCaptionRows();
    });
    $('saveCaptions')?.addEventListener('click', function () {
        if (runtime.isExporting) { toast('Finish or cancel the current export first', 'error'); return; }
        const lines = state.captions.lines;
        const withText = lines.filter(l => String(l.text || '').trim());
        if (!lines.length || !withText.length) {
            $('captionsEditorStatus').textContent = 'Add at least one caption block with text.';
            $('captionsEditorStatus').className = 'status error'; return;
        }
        state.captions.lines = withText.sort((a, b) => a.time - b.time);
        markSectionTouched('text');
        readiness(); redrawCurrentPreviewFrame();
        $('captionsEditorStatus').textContent = `Saved ${withText.length} caption blocks.`;
        $('captionsEditorStatus').className = 'status success';
        toast(`Captions saved · ${withText.length} blocks`, 'success');
        setTimeout(() => $('captionsEditor').classList.add('hidden'), 700);
    });
    document.addEventListener('kefe:captions-generated', openCaptionsEditor);
}