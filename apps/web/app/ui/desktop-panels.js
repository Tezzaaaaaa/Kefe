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

  function installAccordion(panel) {
    if (panel.dataset.beuiAccordionReady === 'true') return;
    const head = panel.querySelector(':scope > .kefe-panel-head, :scope > .kefe-form > .kefe-panel-head');
    if (!head) return;
    const key = panel.dataset.panelView;
    head.hidden = false;
    if (!Array.from(panel.children).some(node => node !== head && !node.matches('.kefe-panel[data-panel-view]'))) return;
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'beui-accordion-trigger';
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Collapse ' + (head.querySelector('h2')?.textContent.trim() || key) + ' section');
    toggle.innerHTML = '<span class="beui-accordion-chevron" aria-hidden="true"></span>';
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      head.hidden = false;
      toggle.setAttribute('aria-expanded', String(open));
      panel.classList.toggle('beui-accordion-collapsed', !open);
      toggle.setAttribute('aria-label', (open ? 'Collapse ' : 'Expand ') + (head.querySelector('h2')?.textContent.trim() || key) + ' section');
      if (open) {
        panel.classList.remove('beui-accordion-enter');
        void panel.offsetWidth;
        panel.classList.add('beui-accordion-enter');
      }
    });
    head.append(toggle);
    panel.dataset.beuiAccordionReady = 'true';
  }

  function sync() {
    const active = document.querySelector('.kefe-section.active')?.dataset.panel || 'media';
    if (!mq.matches) {
      panels().forEach(p => {
        p.classList.remove('kefe-pane-shown', 'beui-accordion-collapsed', 'beui-accordion-enter');
        const head = p.querySelector(':scope > .kefe-panel-head, :scope > .kefe-form > .kefe-panel-head');
        if (head) head.hidden = false;
        head?.querySelector(':scope > .beui-accordion-trigger')?.remove();
        delete p.dataset.beuiAccordionReady;
      });
      return;
    }
    panels().forEach(p => {
      p.classList.add('kefe-pane-shown');
      const head = p.querySelector(':scope > .kefe-panel-head, :scope > .kefe-form > .kefe-panel-head');
      if (head) head.hidden = false;
      installAccordion(p);
    });
    rightPanel = LEFT.includes(active) ? rightPanel : active;
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
