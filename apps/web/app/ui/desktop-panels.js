'use strict';
/* Desktop workspace: header nav on top, two editor panels (left = Media + Lyrics,
   right = Effects, Background Effects, Visualiser, Export). The header buttons choose
   the section; each section opens in the panel it belongs to. Mobile keeps one panel. */
(() => {
  const LEFT = ['media', 'lyrics'];
  const editing = document.querySelector('.kefe-editing');
  const rightWrap = editing && editing.querySelector('.kefe-panels');
  if (!editing || !rightWrap) return;
  const mq = window.matchMedia('(min-width: 900px)');
  const leftWrap = document.createElement('div');
  leftWrap.className = 'kefe-panels kefe-panels-left';
  leftWrap.setAttribute('aria-label', 'Content editor');
  let leftPanel = 'media';
  let rightPanel = 'effects';

  const panels = () => Array.from(document.querySelectorAll('.kefe-panel[data-panel-view]'));

  function place() {
    if (mq.matches) {
      if (!leftWrap.parentNode) editing.insertBefore(leftWrap, rightWrap);
      panels().filter(p => LEFT.includes(p.dataset.panelView)).forEach(p => leftWrap.appendChild(p));
    } else {
      const first = rightWrap.firstChild;
      panels().filter(p => LEFT.includes(p.dataset.panelView)).forEach(p => rightWrap.insertBefore(p, first));
      leftWrap.remove();
    }
  }

  function sync() {
    const active = document.querySelector('.kefe-section.active')?.dataset.panel || 'media';
    if (!mq.matches) {
      panels().forEach(p => p.classList.remove('kefe-pane-shown'));
      return;
    }
    if (LEFT.includes(active)) leftPanel = active; else rightPanel = active;
    panels().forEach(p => p.classList.toggle('kefe-pane-shown', p.dataset.panelView === leftPanel || p.dataset.panelView === rightPanel));
    editing.setAttribute('data-active-panel', rightPanel);
    document.querySelectorAll('.kefe-vis-tabs, .kefe-visualiser-preset-row').forEach(el => { el.hidden = rightPanel !== 'visualiser'; });
  }

  document.addEventListener('click', event => {
    if (event.target.closest && event.target.closest('.kefe-section, [data-shell-panel], [data-dock-panel]')) setTimeout(sync, 0);
  });
  mq.addEventListener('change', () => { place(); sync(); });
  place();
  sync();
})();
