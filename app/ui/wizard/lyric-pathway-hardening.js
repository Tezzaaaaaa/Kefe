/* KEFE Lyric Video pathway — metadata truth, live-sync controls, and step hygiene. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const q = (sel, root = document) => root.querySelector(sel);

  function metadataSourceIsFilename() {
    const source = window.state?.audio?.metadataSource;
    return source === 'filename' || source === 'filename-guess';
  }

  function enforceMetadataTruth() {
    if (!metadataSourceIsFilename()) return;
    const state = window.state;
    if (!state?.audio?.metadata) return;
    state.audio.metadata = { title: '', artist: '', album: '' };
    state.audio.metadataSource = 'none';
    ['metaTitle', 'metaArtist', 'metaAlbum'].forEach(id => {
      const input = $(id);
      if (input && document.activeElement !== input) input.value = '';
    });
  }

  function installLiveControl() {
    const toggle = $('syncLive');
    if (!toggle || toggle.dataset.kefeLiveWired === 'true') return;
    toggle.dataset.kefeLiveWired = 'true';
    const label = toggle.closest('.toggle-row');
    if (!label) return;
    const block = label.closest('.sub-block');
    if (!block || $('kefeLiveAdjustBar')) return;
    const bar = document.createElement('div');
    bar.id = 'kefeLiveAdjustBar';
    bar.style.cssText = 'display:grid;gap:7px;margin-top:10px;padding:10px 11px;border:1px solid var(--line);border-radius:10px;background:var(--surface-2);';
    bar.innerHTML = '<strong style="font-size:12px">Live timing</strong><span id="kefeLiveAdjustStatus" style="font-size:11px;color:var(--text-2)">Turn this on while playing, then set the active lyric to the current playhead.</span><button type="button" id="kefeSetLiveLine" class="file-button">Set active lyric to playhead</button>';
    block.appendChild(bar);
    const status = $('kefeLiveAdjustStatus');
    const refresh = () => {
      const on = toggle.checked;
      if (status) status.textContent = on ? 'Live timing is on. Play the track and set the active lyric when its first word lands.' : 'Turn this on while playing, then set the active lyric to the current playhead.';
    };
    toggle.addEventListener('change', refresh);
    $('kefeSetLiveLine').addEventListener('click', () => {
      if (!toggle.checked) { toggle.checked = true; refresh(); }
      const lines = window.state?.lyrics?.lines || [];
      if (!lines.length) return;
      const t = Number(window.state?.playback?.currentTime) || 0;
      let index = -1;
      for (let i = 0; i < lines.length; i++) { if (Number(lines[i].time) <= t) index = i; else break; }
      if (index < 0) index = 0;
      lines[index].time = t;
      lines.sort((a, b) => (Number(a.time) || 0) - (Number(b.time) || 0));
      for (let i = 0; i < lines.length; i++) lines[i].endTime = i < lines.length - 1 ? Number(lines[i + 1].time) : Math.max(Number(lines[i].time) + .5, Number(lines[i].endTime) || Number(lines[i].time) + 5);
      $('lyricsText').value = lines.map(line => `[${formatLrcTime(line.time)}]${line.text || ''}`).join('\n');
      $('lyricsStatus').textContent = `Adjusted line ${index + 1} to ${formatLrcTime(t)}.`;
      $('lyricsStatus').className = 'status success';
      window.redrawCurrentPreviewFrame?.();
    });
    refresh();
  }

  function formatLrcTime(value) {
    const t = Math.max(0, Number(value) || 0);
    const m = Math.floor(t / 60);
    const s = (t % 60).toFixed(2).padStart(5, '0');
    return `${String(m).padStart(2, '0')}:${s}`;
  }

  function separateBackgroundStep() {
    const step = document.body.dataset.wizardStep;
    const section = $('backgroundSection');
    const panel = $('wizardSection');
    if (!section || !panel) return;
    if (step === 'style' && section.parentNode === panel) {
      const sidebar = document.querySelector('.sidebar');
      if (sidebar) sidebar.appendChild(section);
    }
    section.classList.remove('wizard-inline-background');
    section.querySelector('.wizard-inline-heading')?.remove();
    const heading = q('h3', section);
    if (heading) heading.textContent = 'Background';
  }

  function refresh() {
    enforceMetadataTruth();
    installLiveControl();
    separateBackgroundStep();
  }

  function init() {
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-wizard-step', 'class'] });
    setInterval(refresh, 500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
