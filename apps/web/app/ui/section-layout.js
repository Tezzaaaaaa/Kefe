/* KEFE — section layout companion.
   Keeps the settings of the selected visualiser connected to its gallery card: a header
   names the engine being edited, and on the mobile sheet the settings scroll into view
   after a card is chosen. Also brings the active lyric effect into view in its grid. */
(() => {
  'use strict';

  const GALLERY = '.kv-gallery';
  const FORM = '.kefe-visualiser-form';
  let head = null;
  let titleEl = null;
  let hintEl = null;

  const mobileSheet = () => Boolean(document.querySelector('.kefe-ms-host .kefe-panel[data-panel-view="visualiser"]'));

  function ensureHead(form) {
    if (head && head.isConnected && head.nextElementSibling === form) return head;
    if (!head) {
      head = document.createElement('div');
      head.className = 'kefe-vis-settings-head';
      head.hidden = true;
      titleEl = document.createElement('span');
      titleEl.className = 'kefe-vis-settings-title';
      hintEl = document.createElement('p');
      hintEl.className = 'kefe-vis-settings-hint';
      head.append(titleEl, hintEl);
    }
    form.parentNode.insertBefore(head, form);
    return head;
  }

  function activeCard(gallery) {
    return gallery.querySelector('.kv-card.is-active');
  }

  function sync() {
    const gallery = document.querySelector(GALLERY);
    const form = document.querySelector(FORM);
    if (!gallery || !form || !form.parentNode) return;
    const bar = ensureHead(form);
    const card = activeCard(gallery);
    if (card) {
      titleEl.textContent = (card.dataset.label || 'Visualiser') + ' settings';
      hintEl.textContent = '';
      bar.hidden = false;
    } else {
      titleEl.textContent = 'Settings';
      hintEl.textContent = 'Select a visualiser to edit its settings';
      bar.hidden = false;
    }
  }

  function revealSettings() {
    if (!mobileSheet()) return;
    const form = document.querySelector(FORM);
    const host = document.querySelector('.kefe-ms-host');
    if (!form || !host || !head) return;
    const target = head.hidden ? form : head;
    const top = target.getBoundingClientRect().top - host.getBoundingClientRect().top + host.scrollTop - 8;
    host.scrollTo({ top: Math.max(0, top), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  function watchGallery() {
    const gallery = document.querySelector(GALLERY);
    if (!gallery || gallery.dataset.kefeLayoutWatch === 'true') return;
    gallery.dataset.kefeLayoutWatch = 'true';
    new MutationObserver(sync).observe(gallery, { subtree: true, attributes: true, attributeFilter: ['class', 'data-state'] });
    gallery.addEventListener('click', event => {
      if (!(event.target instanceof Element) || !event.target.closest('.kv-tab')) return;
      window.setTimeout(() => { sync(); revealSettings(); }, 120);
    });
    sync();
  }

  function focusActiveEffect() {
    const grid = document.getElementById('lyricEffectOptions');
    const active = grid && grid.querySelector('.kefe-lyric-effect-option.active');
    if (!grid || !active || grid.scrollHeight <= grid.clientHeight + 2) return;
    grid.scrollTop = Math.max(0, active.offsetTop - grid.offsetTop - 4);
  }

  function boot() {
    watchGallery();
    window.setTimeout(focusActiveEffect, 700);
  }

  new MutationObserver(watchGallery).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'complete') boot();
  else window.addEventListener('load', boot, { once: true });
  window.addEventListener('kefe-effects-ready', () => window.setTimeout(focusActiveEffect, 200));
})();
