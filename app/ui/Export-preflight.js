import { state, media, $, runtime } from '../core/context.js';
import { fmt, toast, activeTimedLines, activeTextMode } from '../core/utils.js';
import { validateLyricTiming } from '../core/module-lyrics.js';
import { getMasterDuration, getMasterMode } from '../core/playback.js';
import { MASTER_MODE_LABELS } from '../core/master-source.js';
import { ensureDefaultBackground, projectValidationIssues, nudgeLyricTiming, refreshLyricsTimingStatus } from '../core/status.js';
import { redrawCurrentPreviewFrame } from '../core/playback.js';

const PRESET_SIZES = {
    '1080p':     { '9:16':[1080,1920], '1:1':[1080,1080], '16:9':[1920,1080] },
    '720p':      { '9:16':[720,1280],  '1:1':[720,720],   '16:9':[1280,720]  },
    '480p':      { '9:16':[480,854],   '1:1':[480,480],   '16:9':[854,480]   },
    'instagram': { '9:16':[1080,1920], '1:1':[1080,1080], '16:9':[1920,1080] },
    'tiktok':    { '9:16':[1080,1920], '1:1':[1080,1080], '16:9':[1920,1080] }
};
const PRESET_FPS = { '480p': 24, '720p': 30, '1080p': 30, 'instagram': 30, 'tiktok': 30 };

export async function openExportPreflight() {
    window.kefeSmartRender?.prepare?.();
    if (runtime.isExporting) return;
    const issues = projectValidationIssues();
    if (issues.length) { toast('Before export, add: ' + issues.join(', '), 'error'); return; }
    ensureDefaultBackground();
    const preset = $('exportPreset').value;
    const aspect = state.aspect || '9:16';
    const key = PRESET_SIZES[preset] ? preset : '720p';
    const dims = PRESET_SIZES[key][aspect] || PRESET_SIZES[key]['9:16'];
    const config = { width: dims[0], height: dims[1], fps: PRESET_FPS[key] || 30 };
    const duration = getMasterDuration();
    const totalFrames = Math.ceil(duration * config.fps);
    const report = validateLyricTiming(state.lyrics.lines, duration);
    const demand = config.width * config.height * config.fps * duration;
    const demandLabel = demand > 1.2e11 ? 'Very high' : demand > 5e10 ? 'High' : demand > 1.8e10 ? 'Moderate' : 'Light';
    const masterLabel = MASTER_MODE_LABELS[getMasterMode()] || getMasterMode();
    const rows = [
        ['Output', `${config.width} × ${config.height}`], ['Frame rate', `${config.fps} fps`],
        ['Duration', fmt(duration)], ['Frames', totalFrames.toLocaleString()],
        ['Master audio', masterLabel + (getMasterMode() === 'none' ? ' (muted)' : '')],
        ['Text', activeTimedLines().length ? `${activeTextMode() === 'captions' ? 'Captions' : 'Lyrics'} · ${activeTimedLines().length} lines` : 'None — visual only'],
        ['Background', media.image ? 'Image background' : media.video ? 'Video background' : `Solid ${state.background.solid}`],
        ['Device demand', demandLabel]
    ];
    $('preflightSummary').replaceChildren(...rows.map(([l, v]) => {
        const row = document.createElement('div'); row.className = 'preflight-row';
        const left = document.createElement('span'); left.textContent = l;
        const right = document.createElement('strong'); right.textContent = v;
        row.append(left, right); return row;
    }));
    const warnings = [...report.warnings];
    if (demandLabel === 'High' || demandLabel === 'Very high') warnings.unshift('This export may take a long time on a phone. The finished MP4 timing will remain frame-accurate.');

    const syncReport = assessSyncQuality();
    const repair = $('preflightRepair');
    if (syncReport.problems.length) {
        $('preflightWarning').textContent = '⚠ ' + syncReport.problems.join(' · ');
        $('preflightWarning').classList.remove('hidden');
        repair.innerHTML = '';
        syncReport.solutions.forEach(sol => {
            const btn = document.createElement('button');
            btn.type = 'button'; btn.className = 'primary'; btn.textContent = sol.label;
            btn.addEventListener('click', () => { sol.apply(); openExportPreflight(); });
            repair.appendChild(btn);
        });
    } else {
        $('preflightWarning').textContent = warnings.join(' ');
        $('preflightWarning').classList.toggle('hidden', warnings.length === 0);
        repair.innerHTML = '';
    }
    $('exportPreflight').classList.remove('hidden');
}

function assessSyncQuality() {
    const lines = activeTimedLines();
    const duration = getMasterDuration();
    const report = validateLyricTiming(lines, duration);
    const problems = [];
    const solutions = [];
    if (report.errors.length) problems.push(report.errors[0]);
    if (lines.length && Number.isFinite(duration) && duration > 0) {
        const first = Number(lines[0]?.time);
        const last = Number(lines[lines.length - 1]?.time);
        if (Number.isFinite(last) && duration - last > 30) {
            problems.push(`Lyrics end ${Math.round(duration - last)}s before the audio finishes`);
            solutions.push({ label: '1. Stretch lyrics to fill the track', apply: () => stretchLyricsToDuration(duration) });
            solutions.push({ label: '2. Trim audio to the lyrics',        apply: () => trimMasterToLyrics(duration, last) });
        }
        if (Number.isFinite(first) && first > 3 && duration > 3) {
            problems.push(`First lyric starts ${Math.round(first)}s in — likely a sync offset`);
            solutions.push({ label: '3. Shift all lyrics earlier', apply: () => nudgeLyricTiming(-first) });
        }
    }
    const seen = new Set();
    return { problems: problems.length ? problems : ['Sync check passed'],
             solutions: solutions.filter(s => { if (seen.has(s.label)) return false; seen.add(s.label); return true; }) };
}

function stretchLyricsToDuration(duration) {
    const mode = activeTextMode();
    const store = mode === 'captions' ? state.captions : state.lyrics;
    if (!store.lines.length) { toast('Load lyrics first', 'error'); return; }
    const last = Number(store.lines[store.lines.length - 1]?.time);
    if (!Number.isFinite(last) || last <= 0) { toast('Cannot stretch: last line has no time', 'error'); return; }
    const scale = duration / last;
    if (!Number.isFinite(scale) || scale <= 0) { toast('Invalid duration', 'error'); return; }
    store.lines = store.lines.map(line => {
        const copy = { ...line, time: Math.max(0, Number(line.time) * scale) };
        if (Number.isFinite(Number(line.endTime))) copy.endTime = Math.max(copy.time, Number(line.endTime) * scale);
        if (Array.isArray(line.words)) copy.words = line.words.map(w => ({
            ...w, time: Math.max(0, Number(w.time) * scale),
            endTime: Number.isFinite(Number(w.endTime)) ? Math.max(0, Number(w.endTime) * scale) : null
        }));
        return copy;
    });
    refreshLyricsTimingStatus(); redrawCurrentPreviewFrame();
    toast(`Lyrics stretched to fit ${fmt(duration)} track`, 'success');
}

function trimMasterToLyrics(duration, lastLyricTime) {
    const mode = getMasterMode();
    if (mode === 'video' && media.video) { try { media.video.currentTime = 0; } catch {} toast(`Video will export up to ${fmt(lastLyricTime)} — the tail is silent`, 'info'); }
    else if (mode === 'uploaded' && state.audio?.file) toast(`Audio will export up to ${fmt(lastLyricTime)} — the tail is silent`, 'info');
    else toast('Trim applies to the master source on export', 'info');
    state.playback.trimTo = lastLyricTime;
}

export function closeExportPreflight() { $('exportPreflight').classList.add('hidden'); }

export function wireExportPreflight() {
    $('closePreflight').addEventListener('click', closeExportPreflight);
    $('cancelPreflight').addEventListener('click', closeExportPreflight);
    $('exportBottom').addEventListener('click', openExportPreflight);
}