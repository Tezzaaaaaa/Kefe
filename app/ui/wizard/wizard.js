/* KEFE Pathway 01 — Lyric Video workflow only. */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const sidebar = document.querySelector('.sidebar');
  const preview = document.querySelector('.preview');
  if (!sidebar || sidebar.dataset.kefePathway01 === '1') return;
  sidebar.dataset.kefePathway01 = '1';

  const steps = [
    { id: 'intro', label: 'Start', target: null },
    { id: 'source', label: 'Media', target: 'audioSection' },
    { id: 'lyrics', label: 'Lyrics', target: 'textSection' },
    { id: 'style', label: 'Style', target: 'textSection' },
    { id: 'background', label: 'Background', target: 'backgroundSection' },
    { id: 'preview', label: 'Preview', target: null },
    { id: 'export', label: 'Export', target: 'exportSection' }
  ];

  let index = 0;
  const panel = document.createElement('div');
  panel.className = 'section wizard-panel';
  panel.id = 'wizardSection';
  sidebar.insertBefore(panel, sidebar.firstChild);

  const nav = document.createElement('div');
  nav.className = 'wizard-nav';
  nav.innerHTML = '<button type="button" id="wizardBackBtn" class="wizard-back">Back</button><div class="wizard-progress-wrap"><div id="wizardProgress" class="wizard-progress"></div><span id="wizardStepLabel" class="wizard-step-label"></span></div><button type="button" id="wizardNextBtn" class="primary wizard-next">Next</button>';
  sidebar.insertBefore(nav, sidebar.children[1] || null);

  const back = $('wizardBackBtn');
  const next = $('wizardNextBtn');

  function audioReady() {
    const audio = window.state?.audio;
    return Boolean(audio && (audio.file || audio.ready || audio.duration > 0));
  }

  function lyricsReady() {
    return Boolean(window.state?.lyrics?.lines?.length || $('lyricsText')?.value.trim());
  }

  function setSectionVisibility(step) {
    sidebar.querySelectorAll(':scope > .section').forEach(section => {
      if (section.id === 'wizardSection') return;
      section.hidden = true;
    });
    if (step.target) $(step.target)?.removeAttribute('hidden');
    if (step.id === 'preview') preview?.removeAttribute('hidden');
    else if (preview) preview.hidden = true;

    if (step.id === 'style') {
      const style = $('lyricStyleBlock');
      if (style) {
        style.hidden = false;
        panel.appendChild(style);
      }
    } else {
      const style = $('lyricStyleBlock');
      const lyrics = $('lyricsPanel');
      if (style && lyrics && !lyrics.contains(style)) lyrics.appendChild(style);
      if (style) style.hidden = step.id !== 'lyrics';
    }
  }

  function valid(step) {
    if (step.id === 'source') return audioReady();
    if (step.id === 'lyrics') return lyricsReady();
    return true;
  }

  function render() {
    const step = steps[index];
    panel.innerHTML = '';

    if (step.id === 'intro') {
      panel.innerHTML = '<p class="wizard-panel-kicker">PATHWAY 01</p><h3 class="wizard-panel-title">Lyric Video</h3><p class="wizard-panel-hint">Create a synced lyric video from your media, lyrics, style and background.</p><button type="button" id="startLyricVideo" class="primary wizard-start">Start Lyric Video</button>';
      $('startLyricVideo').onclick = () => { index = 1; render(); };
    } else if (step.id === 'source') {
      panel.innerHTML = '<p class="wizard-panel-kicker">02 · Media</p><h3 class="wizard-panel-title">Add your media</h3><p class="wizard-panel-hint">Upload the audio or video that will drive the project. Song details appear with the media when available.</p>';
    } else if (step.id === 'lyrics') {
      panel.innerHTML = '<p class="wizard-panel-kicker">03 · Lyrics</p><h3 class="wizard-panel-title">Add and sync your lyrics</h3><p class="wizard-panel-hint">Use song details to find synced lyrics automatically, upload an LRC file, or edit and time the lyrics manually.</p>';
    } else if (step.id === 'style') {
      panel.insertAdjacentHTML('afterbegin', '<p class="wizard-panel-kicker">04 · Style</p><h3 class="wizard-panel-title">Choose your lyric style</h3><p class="wizard-panel-hint">Pick the lyric treatment used by the live project preview.</p>');
    } else if (step.id === 'background') {
      panel.innerHTML = '<p class="wizard-panel-kicker">05 · Background</p><h3 class="wizard-panel-title">Choose your background</h3><p class="wizard-panel-hint">Use a preset or your own image/video. Background settings stay separate from lyric style.</p>';
    } else if (step.id === 'preview') {
      panel.innerHTML = '<p class="wizard-panel-kicker">06 · Preview</p><h3 class="wizard-panel-title">Preview the finished project</h3><p class="wizard-panel-hint">Play through the actual project before exporting.</p>';
    } else if (step.id === 'export') {
      panel.innerHTML = '<p class="wizard-panel-kicker">07 · Export</p><h3 class="wizard-panel-title">Export your lyric video</h3><p class="wizard-panel-hint">Export the same project shown in Preview.</p>';
    }

    $('wizardProgress').textContent = `${String(index + 1).padStart(2, '0')} / 07`;
    $('wizardStepLabel').textContent = step.label;
    back.disabled = index === 0;
    next.textContent = index === steps.length - 1 ? 'Done' : 'Next';
    next.disabled = step.id === 'intro' || !valid(step);
    setSectionVisibility(step);
    window.dispatchEvent(new CustomEvent('kefe:pathway-step', { detail: { pathway: 'lyric', step: step.id, index } }));
  }

  back.onclick = () => { if (index > 0) { index -= 1; render(); } };
  next.onclick = () => {
    if (!valid(steps[index])) return;
    if (index < steps.length - 1) index += 1;
    else return;
    render();
  };

  document.addEventListener('change', () => render(), true);
  document.addEventListener('input', () => {
    if (steps[index].id === 'source' || steps[index].id === 'lyrics') next.disabled = !valid(steps[index]);
  }, true);

  render();
})();
