'use strict';
/* Desktop workspace: header nav on top, two editor panels (left = Media + Lyrics,
   right = Effects, Background Effects, Visualiser, Export). The header buttons choose
   the section; each section opens in the panel it belongs to. Mobile keeps one panel. */
function initDesktopPanels() {
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
    editing.setAttribute('data-selected-section', active);
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
  }

  // Bring the chosen section into view inside its panel column (and open it if collapsed).
  function reveal() {
    if (!mq.matches) return;
    const key = document.querySelector('.kefe-section.active')?.dataset.panel;
    const panel = key && document.querySelector('.kefe-panel[data-panel-view="' + key + '"]');
    const wrap = panel && panel.parentElement;
    if (!panel || !wrap) return;
    const trigger = panel.querySelector('.beui-accordion-trigger');
    if (trigger && trigger.getAttribute('aria-expanded') === 'false') trigger.click();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const top = panel.getBoundingClientRect().top - wrap.getBoundingClientRect().top + wrap.scrollTop - 12;
    wrap.scrollTo({ top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth' });
  }

  document.addEventListener('click', event => {
    if (event.target.closest && event.target.closest('.kefe-section, [data-shell-panel], [data-dock-panel]')) {
      setTimeout(() => { sync(); reveal(); }, 0);
    }
  });
  mq.addEventListener('change', () => { place(); sync(); });
  place();
  sync();
}

/* Drag the edge of either side panel to resize it. Double-click or Home resets; arrow keys nudge.
   Widths are remembered in localStorage and applied through --kw-left / --kw-right. */
function initPanelResizers() {
  const editor = document.querySelector('.kefe-editor');
  if (!editor || editor.querySelector('.kefe-resizer')) return;
  const KEY = 'kefe.panelWidths';
  const MIN = 300, MAX = 640, MIN_CENTRE = 420, STEP = 16;
  const mq = window.matchMedia('(min-width: 900px)');
  const widths = { left: null, right: null };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    ['left', 'right'].forEach(side => { if (Number.isFinite(saved[side])) widths[side] = saved[side]; });
  } catch (_) {}

  const clamp = (side, value) => {
    const other = widths[side === 'left' ? 'right' : 'left'] ?? 390;
    const max = Math.min(MAX, editor.clientWidth - other - MIN_CENTRE);
    return Math.round(Math.max(MIN, Math.min(Math.max(MIN, max), value)));
  };
  const apply = () => {
    ['left', 'right'].forEach(side => {
      if (widths[side] == null) editor.style.removeProperty('--kw-' + side);
      else editor.style.setProperty('--kw-' + side, widths[side] + 'px');
    });
  };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(widths)); } catch (_) {} };
  const current = side => {
    const panel = editor.querySelector(side === 'left' ? '.kefe-panels-left' : '.kefe-editing > .kefe-panels:not(.kefe-panels-left)');
    return panel ? Math.round(panel.getBoundingClientRect().width) : 360;
  };

  function make(side) {
    const bar = document.createElement('div');
    bar.className = 'kefe-resizer kefe-resizer-' + side;
    bar.setAttribute('role', 'separator');
    bar.setAttribute('aria-orientation', 'vertical');
    bar.setAttribute('aria-label', (side === 'left' ? 'Left' : 'Right') + ' panel width');
    bar.tabIndex = 0;
    bar.title = 'Drag to resize · double-click to reset';
    const set = value => {
      widths[side] = clamp(side, value);
      apply();
      bar.setAttribute('aria-valuenow', String(widths[side]));
    };
    bar.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      event.preventDefault();
      const startX = event.clientX, startW = current(side);
      bar.setPointerCapture(event.pointerId);
      bar.classList.add('is-dragging');
      document.body.classList.add('kefe-resizing');
      const move = e => set(startW + (side === 'left' ? e.clientX - startX : startX - e.clientX));
      const up = () => {
        bar.classList.remove('is-dragging');
        document.body.classList.remove('kefe-resizing');
        bar.removeEventListener('pointermove', move);
        bar.removeEventListener('pointerup', up);
        bar.removeEventListener('pointercancel', up);
        save();
      };
      bar.addEventListener('pointermove', move);
      bar.addEventListener('pointerup', up);
      bar.addEventListener('pointercancel', up);
    });
    bar.addEventListener('dblclick', () => { widths[side] = null; apply(); save(); });
    bar.addEventListener('keydown', event => {
      const dir = side === 'left' ? 1 : -1;
      if (event.key === 'ArrowRight') set(current(side) + STEP * dir);
      else if (event.key === 'ArrowLeft') set(current(side) - STEP * dir);
      else if (event.key === 'Home') { widths[side] = null; apply(); }
      else return;
      event.preventDefault();
      save();
    });
    editor.appendChild(bar);
  }
  make('left');
  make('right');
  apply();
  const refit = () => {
    if (!mq.matches) return;
    ['left', 'right'].forEach(side => { if (widths[side] != null) widths[side] = clamp(side, widths[side]); });
    apply();
  };
  window.addEventListener('resize', refit);
  refit();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDesktopPanels, { once: true });
} else {
  initDesktopPanels();
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPanelResizers, { once: true });
} else {
  initPanelResizers();
}
