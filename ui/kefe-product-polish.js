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
    ['Midnight','Dark, understated, cinematic','drift','solid','editorial']
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

  const observer = new MutationObserver(() => {
    enhanceChoiceAnimation();
    enhanceStylePanel();
    enhanceEffectButtons();
  });
  observer.observe(body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-wizard-step', 'class'] });
  enhanceChoiceAnimation();
  enhanceStylePanel();
  enhanceEffectButtons();
})();
