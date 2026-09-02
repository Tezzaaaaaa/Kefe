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
  }

  function rebuild() {
    const wizard = document.getElementById('wizardSection');
    if (!wizard) return;
    const source = wizard.querySelector('.wizard-style-group');
    if (!source) return;

    const buttons = effectButtons();
    if (!buttons.length) return;

    source.querySelector('.wizard-style-heading')?.replaceChildren(document.createTextNode('Lyric effects'));
    source.querySelector('.wizard-effect-grid')?.remove();

    const grid = document.createElement('div');
    grid.className = 'wizard-effect-grid wizard-all-effect-grid';
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
      button.textContent = sourceButton.textContent.trim();
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

  function init() {
    rebuild();
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
