/* KEFE product polish interactions. Safe additive layer over the existing wizard. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const body = document.body;
  if (!body) return;

  const PRESETS = [
    ['Minimal','Clean type, quiet motion','apple','solid','minimal'],
    ['Cinema','Soft contrast, editorial title','eternal','spotlight','editorial'],
    ['Performance','Strong movement, dark stage','fadeup','solid','statement'],
    ['Nordic','Quiet motion, restrained colour','apple','gradient','minimal'],
    ['Eternal Sunshine','Soft focus, warm feeling','eternal','aurora','minimal'],
    ['Chromatic','Bright motion, vivid background','pulse','aurora','statement'],
    ['Y2K','Fast type, graphic backdrop','typewriter','grid','statement'],
    ['Midnight','Dark, understated, cinematic','fadeup','solid','editorial']
  ];

  function clickEffect(name) {
    const button = [...document.querySelectorAll('#lyricStyleBlock [data-effect]')].find(el => el.dataset.effect === name);
    if (button) button.click();
  }
  function clickBackground(name) {
    const button = [...document.querySelectorAll('#backgroundSection [data-background-preset]')].find(el => el.dataset.backgroundPreset === name);
    if (button) button.click();
  }
  function setTitleStyle(name) {
    const select = $('titleCardStyle');
    if (select && [...select.options].some(o => o.value === name)) {
      select.value = name;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
  function applyPreset(preset) {
    const [, , effect, background, title] = preset;
    if (body.dataset.wizardStep === 'style' || document.querySelector('#lyricStyleBlock')) clickEffect(effect);
    clickBackground(background);
    setTitleStyle(title);
    body.dataset.kefePreset = preset[0];
    document.querySelectorAll('.kefe-preset').forEach(b => b.classList.toggle('is-active', b.dataset.preset === preset[0]));
  }

  function enhanceStylePanel() {
    const panel = $('wizardSection');
    if (!panel || body.dataset.wizardStep !== 'style') return;
    if (panel.querySelector('.kefe-presets')) return;
    const wrap = document.createElement('div');
    wrap.className = 'kefe-presets';
    wrap.innerHTML = '<div class="kefe-presets-heading">Quick presets</div>' + PRESETS.map(p => `<button type="button" class="kefe-preset" data-preset="${p[0]}"><strong>${p[0]}</strong><span>${p[1]}</span></button>`).join('');
    panel.appendChild(wrap);
    wrap.querySelectorAll('.kefe-preset').forEach(button => button.addEventListener('click', () => {
      const preset = PRESETS.find(p => p[0] === button.dataset.preset);
      if (preset) applyPreset(preset);
    }));
    if (body.dataset.kefePreset) {
      wrap.querySelectorAll('.kefe-preset').forEach(b => b.classList.toggle('is-active', b.dataset.preset === body.dataset.kefePreset));
    }
  }

  function enhanceEffectButtons() {
    document.querySelectorAll('.wizard-effect-choice').forEach(button => {
      if (!button.dataset.effectName) button.dataset.effectName = button.dataset.forwardEffect || button.textContent.trim();
      button.setAttribute('aria-label', `Use ${button.dataset.effectName} lyric effect`);
    });
  }

  function enhanceChoiceAnimation() {
    document.querySelectorAll('.wizard-choice').forEach((button, index) => {
      button.style.setProperty('--kefe-card-index', index);
    });
  }

  function enhanceLivePreview() {
    const heading = document.querySelector('.preview-heading');
    const preview = document.querySelector('.preview');
    if (!heading || !preview) return;
    if (!heading.querySelector('.preview-live-badge')) {
      const live = document.createElement('span');
      live.className = 'preview-live-badge';
      live.textContent = 'Live';
      heading.appendChild(live);
    }
    if (!heading.querySelector('.preview-effect-badge')) {
      const effect = document.createElement('span');
      effect.className = 'preview-effect-badge';
      heading.appendChild(effect);
    }
    const state = window.state;
    const effectName = state?.style?.effect || document.querySelector('#lyricStyleBlock [data-effect].active-effect')?.dataset.effect || 'apple';
    const effectBadge = heading.querySelector('.preview-effect-badge');
    if (effectBadge) effectBadge.textContent = effectName.replace(/[-_]/g, ' ');
    const liveBadge = heading.querySelector('.preview-live-badge');
    const playing = Boolean(state?.playback?.isPlaying);
    if (liveBadge) liveBadge.classList.toggle('is-playing', playing);
    preview.classList.toggle('is-playing', playing);
  }

  // Load the worker bridge after the existing application scripts have initialised.
  // This keeps analysis isolated from the renderer and requires no bundler.
  function loadAnalysisEngine() {
    if (window.kefeAnalysis || document.querySelector('script[data-kefe-analysis]')) return;
    const script = document.createElement('script');
    script.src = './core/analysis-engine.js';
    script.dataset.kefeAnalysis = '1';
    script.async = true;
    document.head.appendChild(script);
  }

  let analysisTimer = 0;
  let analysisRequest = 0;
  async function analyzeCurrentLyrics() {
    if (!window.kefeAnalysis?.analyzeLyrics) return;
    const input = $('lyricsText');
    const text = input?.value || '';
    if (!text.trim()) return;
    const duration = Number(window.state?.audio?.duration || 0);
    const request = ++analysisRequest;
    try {
      const result = await window.kefeAnalysis.analyzeLyrics(text, duration);
      if (request !== analysisRequest) return;
      window.kefeAnalysis.lastResult = result;
      window.dispatchEvent(new CustomEvent('kefe:lyrics-analyzed', { detail: result }));
      const status = $('lyricsStatus');
      if (status && result.validation) {
        const count = result.validation.count;
        const problems = result.validation.gaps.length + result.validation.overlaps.length + result.validation.lateLines;
        status.textContent = problems ? `${count} lines • ${problems} timing issue${problems === 1 ? '' : 's'}` : `${count} lines • timing checked`;
        status.dataset.analysisRecommendation = result.recommendation || '';
      }
    } catch (error) {
      console.warn('[KEFE Analysis] lyrics analysis failed', error);
    }
  }

  function scheduleAnalysis() {
    clearTimeout(analysisTimer);
    analysisTimer = setTimeout(analyzeCurrentLyrics, 350);
  }

  const observer = new MutationObserver(() => {
    enhanceChoiceAnimation();
    enhanceStylePanel();
    enhanceEffectButtons();
    enhanceLivePreview();
  });
  observer.observe(body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-wizard-step', 'class'] });
  enhanceChoiceAnimation();
  enhanceStylePanel();
  enhanceEffectButtons();
  enhanceLivePreview();
  loadAnalysisEngine();
  document.addEventListener('input', event => {
    if (event.target?.id === 'lyricsText') scheduleAnalysis();
  }, true);
  document.addEventListener('change', event => {
    if (event.target?.id === 'lrcFileInput') scheduleAnalysis();
  }, true);
  window.addEventListener('kefe:analysis-ready', analyzeCurrentLyrics);
  window.setInterval(enhanceLivePreview, 250);
})();
