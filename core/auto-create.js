/* KEFE Auto Create
 * Turns the existing editor into a guided one-click creation flow without
 * replacing renderer logic. Uses the existing controls as the source of truth.
 */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  const EFFECTS = new Set(['apple','brat','eternal','aurora','pulse','typewriter','instagram','fadeup']);
  const BACKGROUNDS = new Set(['solid','gradient','spotlight','aurora','grid','grain']);

  function status(text, kind = 'working') {
    const el = $('previewStatus');
    if (!el) return;
    el.textContent = text;
    el.dataset.autoCreateStatus = kind;
  }

  function getAudioFile() {
    return $('audioInput')?.files?.[0] || window.state?.audio?.file || null;
  }

  function getText() {
    return $('lyricsText')?.value?.trim() || '';
  }

  function currentChoice(selector, attr) {
    const el = document.querySelector(`${selector}.active`) || document.querySelector(`${selector}[aria-pressed="true"]`);
    return el?.dataset?.[attr] || null;
  }

  function choose(selector, attr, value) {
    if (!value) return false;
    const el = [...document.querySelectorAll(selector)].find(node => node.dataset?.[attr] === value);
    if (!el) return false;
    el.click();
    return true;
  }

  function chooseEffect(name) {
    return choose('#lyricStyleBlock [data-effect]', 'effect', name);
  }

  function chooseBackground(name) {
    return choose('#backgroundSection [data-background-preset]', 'backgroundPreset', name);
  }

  function chooseTitleStyle(name) {
    const select = $('titleCardStyle');
    if (!select || ![...select.options].some(option => option.value === name)) return false;
    if (select.value === name) return true;
    select.value = name;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function choosePlan(result, hasArtwork = false) {
    const recommendation = String(result?.recommendation || '').toLowerCase();
    const lines = Number(result?.validation?.count || 0);
    const averageLength = Number(result?.metrics?.averageCharacters || 0);
    const density = Number(result?.metrics?.linesPerMinute || 0);

    let effect = 'apple';
    if (recommendation && EFFECTS.has(recommendation)) effect = recommendation;
    else if (density >= 18 || lines >= 140) effect = 'pulse';
    else if (averageLength >= 48) effect = 'eternal';
    else if (density <= 5 && lines > 0) effect = 'fadeup';

    let background = 'gradient';
    if (hasArtwork) background = effect === 'pulse' ? 'aurora' : 'spotlight';
    else if (effect === 'pulse') background = 'aurora';
    else if (effect === 'fadeup') background = 'solid';
    else if (effect === 'eternal') background = 'spotlight';

    const title = effect === 'pulse' ? 'statement' : effect === 'fadeup' ? 'editorial' : 'minimal';
    return { effect, background, title };
  }

  async function waitForAnalysis() {
    if (!window.kefeAnalysis?.analyzeLyrics) return null;
    const text = getText();
    if (!text) return null;
    const duration = Number(window.state?.audio?.duration || 0);
    try {
      return await window.kefeAnalysis.analyzeLyrics(text, duration);
    } catch (error) {
      console.warn('[KEFE Auto Create] analysis failed', error);
      return null;
    }
  }

  async function run(options = {}) {
    if (run.busy) return false;
    run.busy = true;
    try {
      const audio = getAudioFile();
      const lyrics = getText();
      if (!audio && !options.allowWithoutAudio) {
        status('Add an audio file first', 'error');
        $('audioInput')?.focus();
        return false;
      }
      if (!lyrics) {
        status('Add lyrics first', 'error');
        $('lyricsText')?.focus();
        return false;
      }

      status('Analysing lyrics…');
      const analysis = await waitForAnalysis();
      const state = window.state;
      const hasArtwork = Boolean(state?.audio?.hasArtwork || state?.audio?.artwork || state?.audio?.metadata?.artwork);
      const plan = choosePlan(analysis, hasArtwork);

      const fxTouched = Boolean(state?.touched?.fx);
      const bgTouched = Boolean(state?.touched?.background);
      const titleTouched = Boolean(state?.touched?.title);

      status('Building your visual…');
      if (!fxTouched) chooseEffect(plan.effect);
      if (!bgTouched) chooseBackground(plan.background);
      if (!titleTouched) chooseTitleStyle(plan.title);

      await sleep(120);

      const issues = analysis?.validation
        ? Number(analysis.validation.gaps?.length || 0) + Number(analysis.validation.overlaps?.length || 0) + Number(analysis.validation.lateLines || 0)
        : 0;
      const issueText = issues ? ` • ${issues} timing issue${issues === 1 ? '' : 's'}` : '';
      status(`Auto Create ready • ${fxTouched ? 'kept your FX' : plan.effect}${issueText}`, 'ready');

      const detail = { plan, analysis, preserved: { fx: fxTouched, background: bgTouched, title: titleTouched } };
      window.kefeAutoCreate.lastResult = detail;
      window.dispatchEvent(new CustomEvent('kefe:auto-created', { detail }));

      if (window.kefeProject?.save) {
        try { await window.kefeProject.save(); } catch (error) { console.warn('[KEFE Auto Create] save failed', error); }
      }
      return detail;
    } finally {
      run.busy = false;
    }
  }

  function installButton() {
    const actions = document.querySelector('.header-actions');
    if (!actions || document.getElementById('autoCreateBtn')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'autoCreateBtn';
    button.className = 'auto-create-action';
    button.setAttribute('aria-label', 'Auto Create');
    button.title = 'Auto Create';
    button.innerHTML = '<span class="auto-create-spark" aria-hidden="true">✦</span><span>Auto Create</span>';
    button.addEventListener('click', () => run());
    const exportButton = actions.querySelector('#exportBtn');
    actions.insertBefore(button, exportButton || null);
  }

  function bindAudioHint() {
    document.addEventListener('change', event => {
      if (event.target?.id !== 'audioInput') return;
      const button = $('autoCreateBtn');
      if (button) button.classList.add('has-input');
    }, true);
  }

  window.kefeAutoCreate = { version: 1, run, getPlan: choosePlan };
  installButton();
  bindAudioHint();
  window.addEventListener('kefe:project-engine-ready', installButton);
  window.addEventListener('kefe:analysis-ready', installButton);
  new MutationObserver(installButton).observe(document.body, { childList: true, subtree: true });
})();
