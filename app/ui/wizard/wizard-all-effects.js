/* KEFE wizard — present every lyric effect in one unified, test-ready control. */
(() => {
  'use strict';

  const motion = new Set(['rise', 'slide', 'drop', 'drift']);
  const freeMotionOrder = ['rise', 'slide', 'drop', 'drift'];
  const motionLabels = {
    rise: 'Rise',
    slide: 'Slide',
    drop: 'Drop',
    drift: 'Drift'
  };

  const MOTION_CSS = `
    /* Free motion effects — polished visual identity for both selector surfaces. */
    #lyricStyleBlock .effect-buttons button[data-effect="rise"],
    #lyricStyleBlock .effect-buttons button[data-effect="slide"],
    #lyricStyleBlock .effect-buttons button[data-effect="drop"],
    #lyricStyleBlock .effect-buttons button[data-effect="drift"] {
      position: relative;
      isolation: isolate;
      overflow: hidden;
      color: #fff;
      border-color: rgba(255,255,255,.10);
    }
    #lyricStyleBlock .effect-buttons button[data-effect="rise"]::before,
    #lyricStyleBlock .effect-buttons button[data-effect="slide"]::before,
    #lyricStyleBlock .effect-buttons button[data-effect="drop"]::before,
    #lyricStyleBlock .effect-buttons button[data-effect="drift"]::before {
      opacity: .95;
      transition: transform .45s var(--ease), filter .45s ease, opacity .3s ease;
    }
    #lyricStyleBlock .effect-buttons button[data-effect="rise"]::after,
    #lyricStyleBlock .effect-buttons button[data-effect="slide"]::after,
    #lyricStyleBlock .effect-buttons button[data-effect="drop"]::after,
    #lyricStyleBlock .effect-buttons button[data-effect="drift"]::after {
      transition: transform .5s var(--ease), opacity .3s ease;
      filter: blur(5px);
    }
    #lyricStyleBlock .effect-buttons button[data-effect="rise"]::before { background: linear-gradient(150deg,#111827 0%,#315f88 48%,#9bd8ff 100%); }
    #lyricStyleBlock .effect-buttons button[data-effect="rise"]::after { background: linear-gradient(180deg,transparent 8%,rgba(255,255,255,.82) 48%,transparent 88%); transform: translateY(9px); }
    #lyricStyleBlock .effect-buttons button[data-effect="slide"]::before { background: linear-gradient(110deg,#161616 0%,#4a5568 42%,#d9e2ec 100%); }
    #lyricStyleBlock .effect-buttons button[data-effect="slide"]::after { background: linear-gradient(90deg,transparent 0%,rgba(255,255,255,.9) 46%,transparent 100%); transform: translateX(-18px); }
    #lyricStyleBlock .effect-buttons button[data-effect="drop"]::before { background: linear-gradient(160deg,#26170e 0%,#78431f 48%,#f0bd72 100%); }
    #lyricStyleBlock .effect-buttons button[data-effect="drop"]::after { background: radial-gradient(ellipse at 50% 0%,rgba(255,239,202,.9),transparent 62%); transform: translateY(-10px); }
    #lyricStyleBlock .effect-buttons button[data-effect="drift"]::before { background: linear-gradient(135deg,#17142b 0%,#4d3e78 48%,#c7b7ff 100%); }
    #lyricStyleBlock .effect-buttons button[data-effect="drift"]::after { background: linear-gradient(120deg,transparent 8%,rgba(255,255,255,.72) 50%,transparent 92%); transform: translate(9px,7px) rotate(-7deg); }
    #lyricStyleBlock .effect-buttons button[data-effect="rise"]:hover::after { transform: translateY(-5px); }
    #lyricStyleBlock .effect-buttons button[data-effect="slide"]:hover::after { transform: translateX(18px); }
    #lyricStyleBlock .effect-buttons button[data-effect="drop"]:hover::after { transform: translateY(5px); }
    #lyricStyleBlock .effect-buttons button[data-effect="drift"]:hover::after { transform: translate(-5px,-5px) rotate(-7deg); }
    #lyricStyleBlock .effect-buttons button[data-tier="free"] .effect-tier-badge {
      position: absolute;
      right: 7px;
      top: 6px;
      z-index: 2;
      padding: 2px 5px;
      border-radius: 999px;
      background: rgba(255,255,255,.16);
      color: rgba(255,255,255,.92);
      font-size: 8px;
      font-weight: 800;
      letter-spacing: .08em;
      line-height: 1.1;
      text-transform: uppercase;
      pointer-events: none;
    }
    .wizard-all-effect-grid .wizard-effect-choice { position: relative; overflow: hidden; }
    .wizard-all-effect-grid .wizard-effect-choice[data-effect-family="motion"] .wizard-effect-demo { position: relative; overflow: hidden; }
    .wizard-all-effect-grid .wizard-effect-choice[data-effect-family="motion"] .wizard-effect-demo::after {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      opacity: .55;
      filter: blur(8px);
      transform-origin: center;
    }
    .wizard-all-effect-grid .wizard-effect-choice[data-wizard-effect="rise"] .wizard-effect-demo { background: linear-gradient(150deg,#111827,#315f88 52%,#9bd8ff); }
    .wizard-all-effect-grid .wizard-effect-choice[data-wizard-effect="rise"] .wizard-effect-demo::after { background: linear-gradient(180deg,transparent,rgba(255,255,255,.9),transparent); transform: translateY(12px); }
    .wizard-all-effect-grid .wizard-effect-choice[data-wizard-effect="slide"] .wizard-effect-demo { background: linear-gradient(110deg,#161616,#4a5568 48%,#d9e2ec); }
    .wizard-all-effect-grid .wizard-effect-choice[data-wizard-effect="slide"] .wizard-effect-demo::after { background: linear-gradient(90deg,transparent,rgba(255,255,255,.9),transparent); transform: translateX(-24px); }
    .wizard-all-effect-grid .wizard-effect-choice[data-wizard-effect="drop"] .wizard-effect-demo { background: linear-gradient(160deg,#26170e,#78431f 48%,#f0bd72); }
    .wizard-all-effect-grid .wizard-effect-choice[data-wizard-effect="drop"] .wizard-effect-demo::after { background: radial-gradient(ellipse at 50% 0%,rgba(255,239,202,.95),transparent 62%); transform: translateY(-12px); }
    .wizard-all-effect-grid .wizard-effect-choice[data-wizard-effect="drift"] .wizard-effect-demo { background: linear-gradient(135deg,#17142b,#4d3e78 48%,#c7b7ff); }
    .wizard-all-effect-grid .wizard-effect-choice[data-wizard-effect="drift"] .wizard-effect-demo::after { background: linear-gradient(120deg,transparent,rgba(255,255,255,.78),transparent); transform: translate(12px,8px) rotate(-7deg); }
    .wizard-all-effect-grid .wizard-effect-choice[data-wizard-effect="rise"] .wizard-effect-demo-line { animation: kefeFreeRise 2.2s ease-in-out infinite; }
    .wizard-all-effect-grid .wizard-effect-choice[data-wizard-effect="slide"] .wizard-effect-demo-line { animation: kefeFreeSlide 2.2s ease-in-out infinite; }
    .wizard-all-effect-grid .wizard-effect-choice[data-wizard-effect="drop"] .wizard-effect-demo-line { animation: kefeFreeDrop 2.2s ease-in-out infinite; }
    .wizard-all-effect-grid .wizard-effect-choice[data-wizard-effect="drift"] .wizard-effect-demo-line { animation: kefeFreeDrift 2.2s ease-in-out infinite; }
    @keyframes kefeFreeRise { 0%,100% { transform: translateY(7px); opacity:.45; } 35%,70% { transform: translateY(0); opacity:1; } }
    @keyframes kefeFreeSlide { 0%,100% { transform: translateX(-9px); opacity:.45; } 35%,70% { transform: translateX(0); opacity:1; } }
    @keyframes kefeFreeDrop { 0%,100% { transform: translateY(-7px); opacity:.45; } 35%,70% { transform: translateY(0); opacity:1; } }
    @keyframes kefeFreeDrift { 0%,100% { transform: translate(6px,-3px) rotate(-1deg); opacity:.45; } 35%,70% { transform: translate(0) rotate(0); opacity:1; } }
    @media (prefers-reduced-motion: reduce) {
      .wizard-all-effect-grid .wizard-effect-choice[data-effect-family="motion"] .wizard-effect-demo-line { animation: none !important; }
    }
  `;

  function installMotionStyles() {
    if (document.getElementById('kefeFreeMotionEffectCSS')) return;
    const style = document.createElement('style');
    style.id = 'kefeFreeMotionEffectCSS';
    style.textContent = MOTION_CSS;
    document.head.appendChild(style);
  }

  function effectButtons() {
    return [...document.querySelectorAll('#lyricStyleBlock [data-effect]')];
  }

  function promoteFreeMotionEffects() {
    const host = document.querySelector('#lyricStyleBlock .effect-buttons');
    if (!host) return false;
    const buttons = new Map(effectButtons().map(button => [button.dataset.effect, button]));
    freeMotionOrder.slice().reverse().forEach(name => {
      const button = buttons.get(name);
      if (!button) return;
      button.dataset.tier = 'free';
      button.dataset.effectLabel = motionLabels[name];
      button.title = 'Free · ' + motionLabels[name];
      if (!button.querySelector('.effect-tier-badge')) {
        const badge = document.createElement('span');
        badge.className = 'effect-tier-badge';
        badge.textContent = 'Free';
        badge.setAttribute('aria-hidden', 'true');
        button.appendChild(badge);
      }
      host.insertBefore(button, host.firstElementChild);
    });
    return true;
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
    return motion.has(name) ? (name[0].toUpperCase() + name.slice(1) + ' · Free') : 'Classic';
  }

  function rebuild() {
    const wizard = document.getElementById('wizardSection');
    if (!wizard) return;
    const source = wizard.querySelector('.wizard-style-group');
    if (!source) return;

    installMotionStyles();
    promoteFreeMotionEffects();
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
      button.dataset.tier = motion.has(name) ? 'free' : 'paid';
      button.appendChild(buildDemo(name));
      const copy = document.createElement('span');
      copy.className = 'wizard-effect-copy';
      const title = document.createElement('strong');
      title.textContent = sourceButton.dataset.effectLabel || sourceButton.textContent.trim();
      const family = document.createElement('small');
      family.textContent = familyLabel(name);
      copy.append(title, family);
      if (motion.has(name)) {
        const badge = document.createElement('span');
        badge.className = 'effect-tier-badge';
        badge.textContent = 'Free';
        badge.setAttribute('aria-hidden', 'true');
        button.appendChild(badge);
      }
      button.appendChild(copy);
      button.setAttribute('aria-label', `Use ${title.textContent} lyric effect${motion.has(name) ? ' — Free' : ''}`);
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
    installMotionStyles();
    rebuild();
    observer.observe(document.body, { childList: true, subtree: true });
    loadStyleSections();
    loadPreviewAspect();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
