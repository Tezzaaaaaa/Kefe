/* KEFE wizard — present every lyric effect in one unified, test-ready control. */
(() => {
  'use strict';

  const motion = new Set(['rise', 'slide', 'drop', 'drift']);

  function effectButtons() {
    return [...document.querySelectorAll('#lyricStyleBlock [data-effect]')];
  }

  function applyEffect(name, button, group) {
    const target = effectButtons().find(item => item.dataset.effect === name);
    if (!target) return;
    target.click();
    group.querySelectorAll('[data-wizard-effect]').forEach(item => {
      item.classList.toggle('selected', item === button);
      item.setAttribute('aria-pressed', item === button ? 'true' : 'false');
    });
    const preview = document.querySelector('#wizardSection .wizard-style-preview');
    if (preview) {
      preview.dataset.effect = name;
      const label = preview.querySelector('.wizard-style-preview-effect');
      if (label) label.textContent = name;
      preview.classList.remove('is-animating');
      void preview.offsetWidth;
      preview.classList.add('is-animating');
    }
    window.redrawCurrentPreviewFrame?.();
  }

  function buildDemo(name) {
    const demo = document.createElement('span');
    demo.className = 'wizard-effect-demo';
    demo.setAttribute('aria-hidden', 'true');
    demo.dataset.effect = name;
    const line = document.createElement('span');
    line.className = 'wizard-effect-demo-line';
    line.textContent = 'LYRICS';
    demo.appendChild(line);
    return demo;
  }

  function familyLabel(name) {
    return motion.has(name) ? 'Motion' : 'Classic';
  }

  function rebuild() {
    const wizard = document.getElementById('wizardSection');
    if (!wizard) return;
    const source = wizard.querySelector('.wizard-style-group');
    if (!source) return;

    const buttons = effectButtons();
    if (!buttons.length) return;

    const names = buttons.map(button => button.dataset.effect).join('|');
    const existing = source.querySelector('.wizard-all-effect-grid');
    if (existing?.dataset.effectNames === names) return;

    source.querySelector('.wizard-style-heading')?.replaceChildren(document.createTextNode('Choose your style'));
    source.querySelector('.wizard-effect-grid')?.remove();

    const grid = document.createElement('div');
    grid.className = 'wizard-effect-grid wizard-all-effect-grid';
    grid.dataset.effectNames = names;
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-label', 'Lyric effects');

    const current = window.state?.style?.effect || 'apple';
    buttons.forEach(sourceButton => {
      const name = sourceButton.dataset.effect;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'wizard-effect-choice';
      button.dataset.wizardEffect = name;
      button.dataset.effectFamily = motion.has(name) ? 'motion' : 'classic';
      button.appendChild(buildDemo(name));
      const copy = document.createElement('span');
      copy.className = 'wizard-effect-copy';
      const title = document.createElement('strong');
      title.textContent = sourceButton.textContent.trim();
      const family = document.createElement('small');
      family.textContent = familyLabel(name);
      copy.append(title, family);
      button.appendChild(copy);
      button.setAttribute('aria-label', `Use ${sourceButton.textContent.trim()} lyric effect`);
      button.setAttribute('aria-pressed', name === current ? 'true' : 'false');
      button.classList.toggle('selected', name === current);
      button.addEventListener('click', () => applyEffect(name, button, grid));
      grid.appendChild(button);
    });

    source.appendChild(grid);
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      rebuild();
    });
  }

  const observer = new MutationObserver(schedule);

  function loadStyleSections() {
    if (document.querySelector('script[data-kefe-wizard-style-sections]')) return;
    const script = document.createElement('script');
    script.src = './app/ui/wizard/wizard-style-sections.js';
    script.dataset.kefeWizardStyleSections = 'true';
    document.head.appendChild(script);
  }

  function loadPreviewAspect() {
    if (document.querySelector('script[data-kefe-preview-aspect]')) return;
    const script = document.createElement('script');
    script.src = './app/ui/preview-aspect.js';
    script.dataset.kefePreviewAspect = 'true';
    document.head.appendChild(script);
  }

  function init() {
    rebuild();
    observer.observe(document.body, { childList: true, subtree: true });
    loadStyleSections();
    loadPreviewAspect();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
