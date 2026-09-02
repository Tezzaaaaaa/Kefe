/* KEFE wizard — keep the style and background controls directly beneath the live look preview. */
(() => {
  'use strict';

  const STYLE_CSS = `
    .wizard-inline-background {
      display: block !important;
      width: min(100%, 760px);
    }
  `;

  function injectStyle() {
    if (document.querySelector('style[data-kefe-wizard-inline-style]')) return;
    const style = document.createElement('style');
    style.dataset.kefeWizardInlineStyle = 'true';
    style.textContent = STYLE_CSS;
    document.head.appendChild(style);
  }

  function enhance() {
    injectStyle();
    const wizard = document.getElementById('wizardSection');
    if (!wizard) return;
    const preview = wizard.querySelector('.wizard-style-preview');
    if (!preview) return;
    const background = wizard.querySelector('.wizard-inline-background');
    if (background && background.previousElementSibling !== preview) preview.after(background);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhance, { once: true });
  else enhance();
})();
