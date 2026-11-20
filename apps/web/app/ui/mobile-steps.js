/* KEFE — mobile guided steps.

   Turns the six editor sections into one linear flow for phones: a step header (progress,
   "Step 2 of 6", Preview size), a Back / Next bar, and automatic advance from Media to Lyrics
   once the track's lyrics arrive. It only drives the existing settings adapter
   (window.kefeSettingsPanelAdapter.activateSection); desktop layouts never show its UI. */
(() => {
  'use strict';

  /* `section` is the settings section the step lives in. Background and Visualisers share one
     section in the desktop layout, so on phones each gets its own step and the CSS shows only
     that step's slot (see html[data-kefe-step] in mobile-steps.css). */
  const STEPS = [
    { id: 'media', section: 'media', short: 'Media', title: 'Add your song' },
    { id: 'lyrics', section: 'lyric-sync', short: 'Lyrics', title: 'Check your lyrics' },
    { id: 'style', section: 'lyric-effects', short: 'Style', title: 'Pick a lyric style' },
    { id: 'background', section: 'background', short: 'Background', title: 'Set the background' },
    { id: 'visualiser', section: 'background', short: 'Visualiser', title: 'Add a visualiser' },
    { id: 'export', section: 'export', short: 'Export', title: 'Export your video' },
  ];
  const PHONE = window.matchMedia('(max-width: 760px), (pointer: coarse) and (max-height: 520px)');
  const AUTO_ADVANCE_DELAY = 1100;

  let panel = null;
  let header = null;
  let nav = null;
  let index = 0;
  let mediaTouched = false;
  let autoTimer = 0;
  let autoFlashTimer = 0;

  const $ = (selector, root = document) => root.querySelector(selector);

  function currentSectionId() {
    const workspace = panel && panel.querySelector('.kefe-workspace:not([hidden])');
    return (workspace && workspace.dataset.activeSection) || STEPS[0].section;
  }

  function isReady(step) {
    if (step.id === 'media') {
      const audio = document.getElementById('kefeAudio');
      return !!(audio && (audio.currentSrc || audio.getAttribute('src')));
    }
    if (step.id === 'lyrics') {
      const lyrics = document.getElementById('lyricsInput');
      return !!(lyrics && lyrics.value.trim());
    }
    return false;
  }

  function render() {
    if (!header || !nav) return;
    const step = STEPS[index];
    header.querySelectorAll('.kefe-step-dot').forEach((dot, i) => {
      dot.classList.toggle('is-current', i === index);
      dot.classList.toggle('is-done', i < index);
      if (i === index) dot.setAttribute('aria-current', 'step'); else dot.removeAttribute('aria-current');
    });
    $('.kefe-step-count', header).textContent = 'Step ' + (index + 1) + ' of ' + STEPS.length;
    $('.kefe-step-title', header).textContent = step.title;

    const last = index === STEPS.length - 1;
    const back = $('.kefe-step-back', nav);
    const next = $('.kefe-step-next', nav);
    nav.classList.toggle('is-last', last);
    back.disabled = index === 0;
    back.textContent = last ? 'Back · ' + STEPS[index - 1].short : 'Back';
    next.hidden = last;
    if (!last) {
      next.textContent = 'Next · ' + STEPS[index + 1].short;
      next.classList.toggle('is-ready', isReady(step));
    }
  }

  function goTo(target, options) {
    const next = Math.max(0, Math.min(STEPS.length - 1, target));
    const adapter = window.kefeSettingsPanelAdapter;
    if (!adapter) return;
    window.clearTimeout(autoTimer);
    index = next;
    document.documentElement.dataset.kefeStep = STEPS[index].id;
    adapter.activateSection(STEPS[index].section);
    const columns = panel.querySelector(':scope > .kefe-settings-columns');
    if (columns) columns.scrollTop = 0;
    render();
    if (options && options.auto) flash();
  }

  function flash() {
    header.classList.add('is-auto');
    window.clearTimeout(autoFlashTimer);
    autoFlashTimer = window.setTimeout(() => header.classList.remove('is-auto'), 1600);
  }

  /* The adapter owns which section is shown; follow it when something else (the toolbar, a
     restored project) switches section so the step header never disagrees with the screen. */
  function syncFromPanel() {
    const section = currentSectionId();
    if (STEPS[index].section === section) return;
    const found = STEPS.findIndex(step => step.section === section);
    if (found >= 0) {
      index = found;
      document.documentElement.dataset.kefeStep = STEPS[index].id;
      render();
    }
  }

  function setPreviewLarge(large) {
    document.documentElement.classList.toggle('kefe-preview-large', large);
    const button = $('.kefe-step-preview', header);
    button.setAttribute('aria-pressed', String(large));
    button.textContent = large ? 'Smaller preview' : 'Bigger preview';
    window.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('kefe-stage-resize'));
  }

  function build() {
    header = document.createElement('div');
    header.className = 'kefe-step-header';
    header.setAttribute('role', 'group');
    header.setAttribute('aria-label', 'Editing steps');
    const dots = STEPS.map((step, i) =>
      '<button type="button" class="kefe-step-dot" data-step="' + i + '" aria-label="Step ' + (i + 1) + ': ' + step.short + '"></button>'
    ).join('');
    header.innerHTML =
      '<div class="kefe-step-progress">' + dots + '</div>' +
      '<div class="kefe-step-line">' +
        '<div class="kefe-step-text"><span class="kefe-step-count"></span><strong class="kefe-step-title" aria-live="polite"></strong></div>' +
        '<button type="button" class="kefe-step-preview" aria-pressed="false">Bigger preview</button>' +
      '</div>';

    nav = document.createElement('div');
    nav.className = 'kefe-step-nav';
    nav.setAttribute('role', 'group');
    nav.setAttribute('aria-label', 'Step navigation');
    nav.innerHTML =
      '<button type="button" class="kefe-step-back">Back</button>' +
      '<button type="button" class="kefe-step-next">Next</button>';

    panel.insertBefore(header, panel.firstChild);
    panel.appendChild(nav);

    header.addEventListener('click', event => {
      const dot = event.target.closest('.kefe-step-dot');
      if (dot) { goTo(Number(dot.dataset.step)); return; }
      if (event.target.closest('.kefe-step-preview')) {
        setPreviewLarge(!document.documentElement.classList.contains('kefe-preview-large'));
      }
    });
    nav.addEventListener('click', event => {
      if (event.target.closest('.kefe-step-back')) goTo(index - 1);
      else if (event.target.closest('.kefe-step-next')) goTo(index + 1);
    });
  }

  function watch() {
    new MutationObserver(syncFromPanel).observe(panel, {
      subtree: true, attributes: true, attributeFilter: ['hidden', 'data-active-section'],
    });

    /* Only a real upload or pick on the Media step arms auto-advance, so a restored project
       never jumps steps on load. */
    panel.addEventListener('change', event => {
      if (STEPS[index].id === 'media' && event.target.closest('#mediaInput')) mediaTouched = true;
    }, true);
    panel.addEventListener('click', event => {
      if (STEPS[index].id === 'media' && event.target.closest('#kefeSuggestionList, #kefeSuggestions, [data-kefe-carousel], .kefe-carousel')) mediaTouched = true;
    }, true);

    window.addEventListener('kefe-lyrics-changed', event => {
      render();
      const source = event.detail && event.detail.source;
      if (source !== 'load' || !PHONE.matches || !mediaTouched || STEPS[index].id !== 'media') return;
      window.clearTimeout(autoTimer);
      autoTimer = window.setTimeout(() => {
        if (STEPS[index].id === 'media') { mediaTouched = false; goTo(1, { auto: true }); }
      }, AUTO_ADVANCE_DELAY);
    });

    const audio = document.getElementById('kefeAudio');
    if (audio) audio.addEventListener('loadedmetadata', render);
    const lyrics = document.getElementById('lyricsInput');
    if (lyrics) lyrics.addEventListener('input', render);
  }

  function start(attempt) {
    panel = document.getElementById('kefe-settings-panel');
    if (!panel || !window.kefeSettingsPanelAdapter) {
      if (attempt < 150) window.setTimeout(() => start(attempt + 1), 100);
      return;
    }
    if (panel.querySelector('.kefe-step-header')) return;
    build();
    watch();
    const found = STEPS.findIndex(step => step.section === currentSectionId());
    index = found >= 0 ? found : 0;
    document.documentElement.dataset.kefeStep = STEPS[index].id;
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => start(0), { once: true });
  else start(0);
})();
