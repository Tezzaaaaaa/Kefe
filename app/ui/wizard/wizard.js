/* KEFE — single guided creation flow. The editor owns its controls; this file only guides the user. */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar || sidebar.dataset.kefeWizard === '1') return;
  sidebar.dataset.kefeWizard = '1';
  document.body.classList.add('wizard-mode');

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

  // Remove only obsolete navigation markup. Existing editor sections and controls stay where they are.
  document.querySelectorAll('.section-nav, .section-nav-link').forEach(node => node.remove());

  const panel = document.createElement('div');
  panel.className = 'section wizard-panel';
  panel.id = 'wizardSection';

  const nav = document.createElement('div');
  nav.className = 'wizard-nav';
  nav.innerHTML = '<button type="button" id="wizardBackBtn" class="wizard-back">Back</button><div class="wizard-progress-wrap"><div id="wizardProgress" class="wizard-progress"></div><span id="wizardStepLabel" class="wizard-step-label"></span></div><button type="button" id="wizardNextBtn" class="primary wizard-next">Next</button>';

  sidebar.insertBefore(panel, sidebar.firstChild);
  sidebar.insertBefore(nav, panel.nextSibling);

  const back = $('wizardBackBtn');
  const next = $('wizardNextBtn');

  function mediaReady() {
    const audio = window.state?.audio;
    const media = window.kefeMedia;
    return Boolean(audio?.file || audio?.ready || Number(audio?.duration) > 0 || media?.videoFile);
  }

  function lyricsReady() {
    return Boolean(window.state?.lyrics?.lines?.length || $('lyricsText')?.value.trim());
  }

  function currentStepReady() {
    const step = steps[index];
    if (step.id === 'source') return mediaReady();
    if (step.id === 'lyrics') return lyricsReady();
    return true;
  }

  function showExistingSection(id) {
    sidebar.querySelectorAll(':scope > .section').forEach(section => {
      if (section.id !== 'wizardSection') section.hidden = true;
    });
    if (id) {
      const section = $(id);
      if (section) {
        section.hidden = false;
        section.classList.add('active');
      }
    }
  }

  function renderIntro() {
    panel.innerHTML = '<p class="wizard-panel-kicker">KEFE</p><h3 class="wizard-panel-title">Create a lyric video</h3><p class="wizard-panel-hint">Add your media, lyrics, style and background, then preview and export the result.</p><button type="button" id="startLyricVideo" class="primary wizard-start">Start</button>';
    $('startLyricVideo').onclick = () => {
      index = 1;
      render();
    };
  }

  function renderStepCopy(step) {
    const copy = {
      source: ['01 · Media', 'Add your media', 'Upload the audio or video that drives the project.'],
      lyrics: ['02 · Lyrics', 'Add and sync your lyrics', 'Search for synced lyrics, upload an LRC, or edit them manually.'],
      style: ['03 · Style', 'Choose your lyric style', 'Use the existing lyric style controls and preview.'],
      background: ['04 · Background', 'Choose your background', 'Use a preset or your own image or video.'],
      preview: ['05 · Preview', 'Preview the project', 'Play through the actual project before exporting.'],
      export: ['06 · Export', 'Export the project', 'Export the same project shown in Preview.']
    }[step.id];
    panel.innerHTML = `<p class="wizard-panel-kicker">${copy[0]}</p><h3 class="wizard-panel-title">${copy[1]}</h3><p class="wizard-panel-hint">${copy[2]}</p>`;
  }

  function render() {
    const step = steps[index];
    document.body.dataset.wizardStep = step.id;
    panel.replaceChildren();

    if (step.id === 'intro') renderIntro();
    else renderStepCopy(step);

    showExistingSection(step.target);
    if (step.id === 'preview') document.querySelector('.preview')?.removeAttribute('hidden');
    else document.querySelector('.preview')?.setAttribute('hidden', '');

    $('wizardProgress').textContent = `${String(Math.max(1, index)).padStart(2, '0')} / 06`;
    $('wizardStepLabel').textContent = step.label;
    back.disabled = index === 0;
    next.disabled = index === 0 || !currentStepReady();
    next.textContent = index === steps.length - 1 ? 'Done' : 'Next';

    if (step.id === 'style') $('lyricStyleBlock')?.scrollIntoView({ block: 'nearest' });
    window.dispatchEvent(new CustomEvent('kefe:wizard-step', { detail: { step: step.id, index } }));
  }

  back.onclick = () => {
    if (index > 0) {
      index -= 1;
      render();
    }
  };

  next.onclick = () => {
    if (!currentStepReady()) return;
    if (index < steps.length - 1) {
      index += 1;
      render();
    }
  };

  document.addEventListener('change', event => {
    if (steps[index].id === 'source' || steps[index].id === 'lyrics') next.disabled = index === 0 || !currentStepReady();
  }, true);
  document.addEventListener('input', () => {
    if (steps[index].id === 'source' || steps[index].id === 'lyrics') next.disabled = index === 0 || !currentStepReady();
  }, true);

  render();
})();
