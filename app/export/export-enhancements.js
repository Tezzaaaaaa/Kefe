import { generateSrt, generateVtt, timedLinesForState } from './subtitles.js';
import { getQualityPreset } from './config.js';

const $ = id => document.getElementById(id);

function addControl() {
  const section = $('exportSection');
  if (!section || section.querySelector('.kefe-export-enhancements')) return;
  const wrap = document.createElement('div');
  wrap.className = 'sub-block kefe-export-enhancements';
  wrap.innerHTML = `
    <div class="sub-heading">Export quality</div>
    <label>Quality
      <select id="kefeQualityPreset" aria-label="Export quality">
        <option value="low">Low — Fast export</option>
        <option value="medium" selected>Medium — Balanced</option>
        <option value="high">High — Best for YouTube</option>
        <option value="ultra">Ultra — Maximum quality</option>
        <option value="lossless">Lossless — Very large files</option>
      </select>
    </label>
    <div id="kefeQualityHint" class="sub-hint">Balanced · recommended</div>
    <div class="sub-heading" style="margin-top:12px">Subtitle files</div>
    <div class="lyrics-actions">
      <button type="button" id="exportSrt" class="file-button">Export SRT</button>
      <button type="button" id="exportVtt" class="file-button">Export VTT</button>
    </div>
    <div class="sub-hint">Exports your synced lyrics or captions as standard subtitle files.</div>`;
  const project = section.querySelector('.sub-block:last-child');
  section.insertBefore(wrap, project || null);

  const select = $('kefeQualityPreset');
  const hint = $('kefeQualityHint');
  const saved = localStorage.getItem('kefe-export-quality');
  if (saved && getQualityPreset(saved)) select.value = saved;
  const sync = () => {
    const quality = getQualityPreset(select.value);
    window.kefeExportQuality = select.value;
    hint.textContent = `${quality.description} · ${quality.videoBitrate || 'CRF 0'}`;
    localStorage.setItem('kefe-export-quality', select.value);
  };
  select.addEventListener('change', sync);
  sync();

  function download(text, extension, mime) {
    const lines = timedLinesForState(window.state);
    if (!lines.length) { alert('No synced lyrics or captions are available to export.'); return; }
    const base = (window.state?.audio?.file?.name || 'KEFE Visualiser').replace(/\.[^.]+$/, '').replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ').trim() || 'KEFE Visualiser';
    const blob = new Blob([text(lines)], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `${base}.${extension}`; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  $('exportSrt')?.addEventListener('click', () => download(generateSrt, 'srt', 'application/x-subrip;charset=utf-8'));
  $('exportVtt')?.addEventListener('click', () => download(generateVtt, 'vtt', 'text/vtt;charset=utf-8'));
}

function injectStyle() {
  if (document.getElementById('kefe-export-enhancements-style')) return;
  const style = document.createElement('style');
  style.id = 'kefe-export-enhancements-style';
  style.textContent = `.kefe-export-enhancements{animation:wizardStepIn .24s ease both}.kefe-export-enhancements .lyrics-actions{margin-top:8px}`;
  document.head.appendChild(style);
}

const observer = new MutationObserver(addControl);
observer.observe(document.body, { childList: true, subtree: true });
injectStyle();
addControl();
