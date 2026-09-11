/* KEFE Lyric Video pathway — dedicated style selector presentation. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const qa = (sel, root = document) => [...root.querySelectorAll(sel)];

  const labels = {
    apple: 'Focused, polished lyric stack', brat: 'Bold kinetic typewriter', eternal: 'Handwritten flowing lyric cycle',
    aurora: 'Colour-shifting glow', pulse: 'Rhythmic scale and glow', typewriter: 'Character-by-character reveal',
    instagram: 'Bold social-style lyric stack', fadeup: 'Soft word-by-word rise', decrypt: 'Scrambled characters resolve',
    blur: 'Blurred words sharpen into focus', shiny: 'Diagonal light sweep'
  };

  const demoClasses = new Set(['apple','brat','eternal','aurora','pulse','typewriter','instagram','fadeup','decrypt','blur','shiny']);

  function build() {
    if (document.body.dataset.wizardStep !== 'style') return;
    const block = $('lyricStyleBlock');
    const host = $('wizardStyleMount');
    if (!block || !host) return;
    const source = qsa('[data-effect]', block);
    if (!source.length) return;
    let grid = $('kefeLyricStyleGrid');
    if (!grid) {
      grid = document.createElement('div');
      grid.id = 'kefeLyricStyleGrid';
      grid.className = 'wizard-all-effect-grid';
      grid.setAttribute('role', 'group');
      grid.setAttribute('aria-label', 'Lyric video styles');
      host.appendChild(grid);
    }
    const names = source.map(button => button.dataset.effect).filter(name => demoClasses.has(name));
    if (grid.dataset.names === names.join('|')) { sync(grid); return; }
    grid.dataset.names = names.join('|');
    grid.replaceChildren();
    names.forEach(name => {
      const sourceButton = source.find(button => button.dataset.effect === name);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'wizard-effect-choice';
      button.dataset.wizardEffect = name;
      button.setAttribute('aria-pressed', 'false');
      const demo = document.createElement('span');
      demo.className = 'wizard-effect-demo';
      demo.dataset.effect = name;
      const line = document.createElement('span');
      line.className = 'wizard-effect-demo-line';
      line.textContent = 'LYRICS';
      demo.appendChild(line);
      const copy = document.createElement('span');
      copy.className = 'wizard-effect-copy';
      const title = document.createElement('strong');
      title.textContent = sourceButton.textContent.trim();
      const hint = document.createElement('small');
      hint.textContent = labels[name] || 'Lyric animation';
      copy.append(title, hint);
      button.append(demo, copy);
      button.addEventListener('click', () => sourceButton.click());
      grid.appendChild(button);
    });
    sync(grid);
  }

  function qsa(sel, root) { return qa(sel, root); }

  function sync(grid = $('kefeLyricStyleGrid')) {
    if (!grid) return;
    const current = window.state?.style?.effect || 'apple';
    qa('[data-wizard-effect]', grid).forEach(button => {
      const active = button.dataset.wizardEffect === current;
      button.classList.toggle('selected', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function init() {
    const observer = new MutationObserver(build);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-wizard-step', 'class'] });
    setInterval(() => { build(); sync(); }, 350);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
