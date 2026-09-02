/* KEFE editing flow — keeps first-run editing linear, contextual and recoverable. */
(() => {
  'use strict';
  const body = document.body;
  if (!body || window.kefeEditingFlow) return;
  window.kefeEditingFlow = true;

  const $ = id => document.getElementById(id);
  const wizard = () => $('wizardSection');
  const labels = { intro:'Choose a format', source:'Add your media', content:'Add your lyrics', captions:'Create your captions', style:'Choose your look', background:'Set your background', preview:'Review the result', export:'Export the video' };

  function injectStyles() {
    if ($('kefeEditingFlowStyles')) return;
    const style = document.createElement('style');
    style.id = 'kefeEditingFlowStyles';
    style.textContent = `
      body.wizard-mode .section-nav { pointer-events:none; opacity:.52; }
      body.wizard-mode .section-nav-link { cursor:default; }
      body.wizard-mode .section-nav-link::after { content:''; position:absolute; inset:0; }
      .kefe-flow-context { display:flex; align-items:center; gap:10px; margin:0 0 14px; padding:10px 12px; border:1px solid var(--border-color,#ddd); border-radius:12px; background:var(--panel-bg,#fff); font-size:12px; }
      .kefe-flow-context strong { font-size:12px; }
      .kefe-flow-dots { display:flex; gap:4px; margin-left:auto; }
      .kefe-flow-dot { width:7px; height:7px; border-radius:50%; background:currentColor; opacity:.22; }
      .kefe-flow-dot.done { opacity:.9; }
      .kefe-flow-dot.current { opacity:1; transform:scale(1.25); }
      .kefe-flow-status { opacity:.62; }
      body.wizard-mode .wizard-panel { scroll-margin-top:18px; }
    `;
    document.head.appendChild(style);
  }

  function currentStep() { return body.dataset.wizardStep || ''; }

  function ensureContext() {
    const panel = wizard();
    if (!panel) return;
    let context = panel.querySelector('.kefe-flow-context');
    if (!context) { context = document.createElement('div'); context.className = 'kefe-flow-context'; panel.prepend(context); }
    const step = currentStep();
    const progress = $('wizardProgress')?.textContent?.trim() || '';
    const match = progress.match(/^(\d+)\s*\/\s*(\d+)$/);
    const current = match ? Number(match[1]) : 1;
    const total = match ? Number(match[2]) : 1;
    const dots = Array.from({length: total}, (_, i) => `<i class="kefe-flow-dot ${i + 1 < current ? 'done' : ''} ${i + 1 === current ? 'current' : ''}"></i>`).join('');
    context.innerHTML = `<strong>${labels[step] || 'Edit your video'}</strong><span class="kefe-flow-status">Step ${current} of ${total}</span><span class="kefe-flow-dots" aria-hidden="true">${dots}</span>`;
  }

  function setTextModeForWorkflow() {
    const step = currentStep();
    if (step !== 'content' && step !== 'captions') return;
    const desired = step === 'captions' ? 'captions' : 'lyrics';
    const button = document.querySelector(`[data-text-mode="${desired}"]`);
    if (button && !button.classList.contains('active')) button.click();
  }

  function improveWizardLabels() {
    const next = $('wizardNextBtn');
    if (!next) return;
    const text = { intro:'Continue', source:'Continue', content:'Continue to Style', captions:'Continue to Style', style:'Continue to Background', background:'Review Video', preview:'Finish & Export', export:'Export' }[currentStep()];
    if (text) next.textContent = text;
  }

  function preventSectionJump() {
    if (body.dataset.kefeFlowGuard === '1') return;
    body.dataset.kefeFlowGuard = '1';
    document.addEventListener('click', event => {
      if (!body.classList.contains('wizard-mode')) return;
      const link = event.target.closest('.section-nav-link');
      if (!link) return;
      event.preventDefault();
      event.stopPropagation();
    }, true);
  }

  function refresh() {
    injectStyles();
    if (!body.classList.contains('wizard-mode')) return;
    ensureContext();
    setTextModeForWorkflow();
    improveWizardLabels();
    preventSectionJump();
  }

  const observer = new MutationObserver(refresh);
  observer.observe(body, { childList:true, subtree:true, attributes:true, attributeFilter:['data-wizard-step','class'] });
  refresh();
})();
