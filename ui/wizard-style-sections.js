/* KEFE wizard — keep the style and background controls directly beneath the live look preview. */
(() => {
  'use strict';

  const STYLE_CSS = `
    .wizard-inline-background {
      display: block !important;
      width: min(100%, 760px);
      margin: 18px auto 0;
      padding: 16px;
      box-sizing: border-box;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: var(--surface-2);
    }
    .wizard-inline-background .wizard-inline-heading {
      display: block;
      margin: 0 0 12px;
      color: var(--text-2);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: .08em;
      line-height: 1.3;
      text-transform: uppercase;
    }
    .wizard-inline-background > h3 {
      display: none !important;
    }
    .wizard-inline-background .background-choice-grid {
      margin-top: 0;
    }
    .wizard-inline-background .background-upload-divider {
      margin-top: 14px;
    }
    .wizard-inline-background .sub-block {
      margin-top: 16px;
    }
    .wizard-style-section-heading {
      width: min(100%, 760px);
      margin: 22px auto 0;
      color: var(--text-2);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: .08em;
      line-height: 1.3;
      text-transform: uppercase;
    }
    @media (max-width: 560px) {
      .wizard-inline-background { padding: 14px; }
    }
  `;

  function installStyles() {
    if (document.getElementById('kefeWizardStyleSectionsCSS')) return;
    const style = document.createElement('style');
    style.id = 'kefeWizardStyleSectionsCSS';
    style.textContent = STYLE_CSS;
    document.head.appendChild(style);
  }

  let originalParent = null;
  let originalNextSibling = null;
  let originalHeading = '';

  function rememberBackground(section) {
    if (originalParent) return;
    originalParent = section.parentNode;
    originalNextSibling = section.nextSibling;
    const heading = section.querySelector('h3');
    originalHeading = heading?.textContent || '04 Background';
  }

  function restoreBackground(section) {
    if (!originalParent || section.parentNode !== document.getElementById('wizardSection')) return;
    if (originalNextSibling && originalNextSibling.parentNode === originalParent) originalParent.insertBefore(section, originalNextSibling);
    else originalParent.appendChild(section);
    section.classList.remove('wizard-inline-background', 'wizard-current');
    section.querySelector('.wizard-inline-heading')?.remove();
    const heading = section.querySelector('h3');
    if (heading) heading.textContent = originalHeading;
  }

  function mountBackground() {
    const body = document.body;
    const panel = document.getElementById('wizardSection');
    const section = document.getElementById('backgroundSection');
    if (!panel || !section || body.dataset.wizardStep !== 'style') return;
    rememberBackground(section);
    if (section.parentNode !== panel) panel.appendChild(section);
    section.classList.add('wizard-inline-background', 'wizard-current');
    const heading = section.querySelector('h3');
    if (heading) {
      heading.textContent = '';
      if (!section.querySelector('.wizard-inline-heading')) {
        const inlineHeading = document.createElement('div');
        inlineHeading.className = 'wizard-inline-heading';
        inlineHeading.textContent = 'Choose your background';
        section.insertBefore(inlineHeading, section.firstChild);
      }
    }
  }

  function sync() {
    const body = document.body;
    const panel = document.getElementById('wizardSection');
    const section = document.getElementById('backgroundSection');
    if (!panel || !section) return;
    if (body.dataset.wizardStep === 'style') mountBackground();
    else restoreBackground(section);
  }

  function init() {
    installStyles();
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-wizard-step'], childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
