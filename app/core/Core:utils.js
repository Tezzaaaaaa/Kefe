export const linaClamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
export const hasFiniteNumber = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
export function linaSmooth(v)   { const t = linaClamp(v); return t * t * (3 - 2 * t); }
export function linaSmoother(v) { const t = linaClamp(v); return t * t * t * (t * (t * 6 - 15) + 10); }

export const fmt = t => {
    if (!t || !isFinite(t) || t < 0) return '0:00';
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
};

export function toast(msg, type = '') {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast show ' + type;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => el.classList.remove('show'), 3000);
}

export function linaNormaliseLine(lines, index) {
    if (!Array.isArray(lines) || index < 0 || index >= lines.length) return null;
    const source = lines[index];
    const start = Number(source.time) || 0;
    const nextTime = hasFiniteNumber(lines[index + 1]?.time) ? Number(lines[index + 1].time) : null;
    const end = hasFiniteNumber(source.endTime) ? Number(source.endTime) : (nextTime !== null ? nextTime : start + 3);
    const vocalEnd = hasFiniteNumber(source.vocalEndTime) ? Number(source.vocalEndTime) :
        (source.words?.length && hasFiniteNumber(source.words[source.words.length - 1]?.endTime)
            ? Number(source.words[source.words.length - 1].endTime) : end);
    return { ...source, time: start, endTime: end, vocalEndTime: vocalEnd, nextLineTime: nextTime };
}

export function linaFindActiveLine(lines, time) {
    let index = -1;
    for (let i = 0; i < lines.length; i++) {
        if (hasFiniteNumber(lines[i].time) && time >= Number(lines[i].time)) index = i;
        else break;
    }
    return index;
}

export const PROJECT_TYPES = ['lyric', 'visualiser', 'captioned'];
export const activeTextMode = () => (state.captions.mode === 'captions' ? 'captions' : 'lyrics');
export const timedTextRequired = () => state.projectType !== 'visualiser' && state.projectType !== 'custom';

export function activeTimedLines() {
    if (state.projectType === 'visualiser') return [];
    return state.captions.mode === 'captions' ? state.captions.lines : state.lyrics.lines;
}

// Re-export `state` for convenience so callers can do `import { ... } from '../core/utils.js'`.
import { state } from './context.js';

// Section nav "touched" hook: implementation registered at boot.
export const navHooks = { updateSectionNav: () => {} };
export function markSectionTouched(key) {
    if (!(key in state.touched) || state.touched[key]) return;
    state.touched[key] = true;
    navHooks.updateSectionNav();
}