/* KEFE wizard — keep the four motion lyric effects visible and immediately testable. */
(() => {
  'use strict';

  const MOTION = {
    rise: 'Rise',
    slide: 'Slide',
    drop: 'Drop',
    drift: 'Drift'
  };

  function findEffectButton(name) {
    return [...document.querySelectorAll('#lyricStyleBlock [data-effect]')]
      .find(button => button.dataset.effect === name);
  }

  function selectEffect(name) {
    const target = findEffectButton(name);
    if (target) {
      target.click();
      return true;
    }
    if (typeof window.setEffect === 'function') {
      window.setEffect(name);
      window.redrawCurrentPreviewFrame?.();
      return true;
    }
    return false;
  }

  function ensureMotionPanel() {
    const wizardPanel = document.getElementById('wizardSection');
    if (!wizardPanel) return;

    const stylePreview = wizardPanel.querySelector('.wizard-style-preview');
    if (!stylePreview) return;

    let group = wizardPanel.querySelector('[data-kefe-motion-effects]');
    if (!group) {
      group = document.createElement('div');
      group.className = 'wizard-style-group wizard-motion-effects';
      group.dataset.kefeMotionEffects = 'true';
      group.innerHTML = `
        <div class="wizard-style-heading">Motion lyric effects</div>
        <p class="wizard-motion-effects-hint">Choose one to play it immediately in the preview.</p>
        <div class="wizard-effect-grid wizard-motion-effect-grid"></div>
      `;
      stylePreview.insertAdjacentElement('afterend', group);
    }

    const grid = group.querySelector('.wizard-motion-effect-grid');
    if (!grid) return;

    for (const [name, label] of Object.entries(MOTION)) {
      let button = grid.querySelector(`[data-motion-effect="${name}"]`);
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'wizard-effect-choice';
        button.dataset.motionEffect = name;
        button.textContent = label;
        button.addEventListener('click', () => {
          if (!selectEffect(name)) return;
          grid.querySelectorAll('[data-motion-effect]').forEach(item => {
            item.classList.toggle('selected', item === button);
          });
        });
        grid.appendChild(button);
      }
    }

    const active = window.state?.style?.effect;
    grid.querySelectorAll('[data-motion-effect]').forEach(button => {
      button.classList.toggle('selected', button.dataset.motionEffect === active);
    });
  }

  const observer = new MutationObserver(ensureMotionPanel);
  function init() {
    ensureMotionPanel();
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
