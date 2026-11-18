/* KEFE — one carousel for every background choice.
   The Background tab used to show two separate galleries: Background Effects (Apple Motion Art, Album Palette
   Gradient, Uploaded Video) and Visualisers (Fluid Ink, Liquid Glass, Glass Lens, ...). This module merges them into a
   single shadcn-style Carousel. Every slide is a proxy for an existing control: clicking it clicks the real background
   button or visualiser tab, so the engines, saved state and settings forms keep working exactly as before. The real
   galleries stay in the DOM (hidden) as the source of truth, and the carousel re-reads them whenever they change. */
(() => {
  'use strict';
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SRC_BG = '#kefeBackgroundEffectOptions [data-background-mode]';
  const SRC_VIS = '.kv-gallery .kv-card[data-visualiser]';
  const ICON = {
    prev: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
    next: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
  };
  let mounted = null;

  function el(tag, cls, attrs) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (attrs) Object.keys(attrs).forEach(k => node.setAttribute(k, attrs[k]));
    return node;
  }

  const orderOf = n => { const v = parseInt(n.style.order, 10); return Number.isNaN(v) ? 99 : v; };

  /* The source controls, in display order: backgrounds first, then visualisers. */
  function readSources() {
    const out = [];
    document.querySelectorAll(SRC_BG).forEach(btn => {
      const label = btn.querySelector('.kefe-background-effect-name')?.textContent.trim() || btn.dataset.backgroundMode;
      out.push({
        key: 'bg:' + btn.dataset.backgroundMode, kind: 'Background', label, source: btn, mode: btn.dataset.backgroundMode,
        disabled: btn.disabled, selected: btn.classList.contains('active'), on: btn.classList.contains('active'),
        desc: { apple: 'Soft animated colour wash.', gradient: 'Gradient pulled from the album artwork.', video: 'Your own footage behind the lyrics.' }[btn.dataset.backgroundMode] || '',
      });
    });
    Array.from(document.querySelectorAll(SRC_VIS)).sort((a, b) => orderOf(a) - orderOf(b)).forEach(card => {
      const tab = card.querySelector('.kv-tab');
      const power = card.querySelector('[role="switch"]');
      out.push({
        key: 'vis:' + card.dataset.visualiser, kind: 'Visualiser', label: card.dataset.label || card.dataset.visualiser,
        source: tab, power, art: card.querySelector('.kv-preview'), disabled: !tab || tab.disabled,
        selected: card.classList.contains('is-active'), on: power?.getAttribute('aria-checked') === 'true',
        desc: card.querySelector('.kv-desc')?.textContent.trim() || '',
      });
    });
    return out;
  }

  function slideFor(item) {
    const slide = el('div', 'kbc-slide', { role: 'group', 'aria-roledescription': 'slide' });
    const card = el('div', 'kbc-card');
    const pick = el('button', 'kbc-pick', { type: 'button' });
    const art = el('span', 'kbc-art');
    art.setAttribute('aria-hidden', 'true');
    if (item.art) {
      art.appendChild(item.art.cloneNode(true));
    } else {
      const holder = el('span', 'kefe-background-effect-card kbc-bg-art', { 'data-background-mode': item.mode });
      const prev = item.source.querySelector('.kefe-background-effect-preview');
      if (prev) holder.appendChild(prev.cloneNode(true));
      art.appendChild(holder);
    }
    const badge = el('span', 'kbc-badge');
    badge.textContent = item.kind;
    art.appendChild(badge);
    const body = el('span', 'kbc-body');
    const name = el('span', 'kbc-name');
    name.textContent = item.label;
    const desc = el('span', 'kbc-desc');
    desc.textContent = item.desc;
    body.append(name, desc);
    pick.append(art, body);
    pick.addEventListener('click', () => {
      if (pick.disabled) return;
      /* Programmatic click on the real control; visualiser tabs turn their engine on when activated. */
      const live = readSources().find(s => s.key === item.key);
      live?.source?.click();
    });
    card.appendChild(pick);
    if (item.kind === 'Visualiser') {
      const foot = el('div', 'kbc-foot');
      const status = el('span', 'kbc-status');
      const sw = el('button', 'kbc-switch', { type: 'button', role: 'switch' });
      sw.appendChild(el('span', 'kbc-switch-thumb'));
      sw.addEventListener('click', () => {
        const live = readSources().find(s => s.key === item.key);
        if (live?.power) live.power.click();
      });
      foot.append(status, sw);
      card.appendChild(foot);
    }
    slide.appendChild(card);
    return { slide, pick, card, item };
  }

  function mount() {
    const group = document.querySelector('.kefe-background-effects-group');
    const options = document.getElementById('kefeBackgroundEffectOptions');
    if (!group || !options || group.dataset.kbcMounted === 'true') return;
    if (!document.querySelector(SRC_VIS) || !document.querySelector(SRC_BG)) return;
    group.dataset.kbcMounted = 'true';
    group.classList.add('kbc-group');

    const heading = group.querySelector('.kefe-background-effects-heading');
    const title = heading?.querySelector('h3');
    if (title) title.textContent = 'Background';
    heading?.querySelector('.kefe-background-effect-preview-nav')?.setAttribute('hidden', '');

    const region = el('div', 'kbc', { role: 'region', 'aria-roledescription': 'carousel', 'aria-label': 'Backgrounds and visualisers' });
    const viewport = el('div', 'kbc-viewport', { tabindex: '0' });
    const track = el('div', 'kbc-track');
    viewport.appendChild(track);
    const controls = el('div', 'kbc-controls');
    const prev = el('button', 'kbc-nav', { type: 'button', 'aria-label': 'Previous option', title: 'Previous option' });
    prev.innerHTML = ICON.prev;
    const count = el('span', 'kbc-count', { 'aria-live': 'polite' });
    const next = el('button', 'kbc-nav', { type: 'button', 'aria-label': 'Next option', title: 'Next option' });
    next.innerHTML = ICON.next;
    controls.append(prev, count, next);
    heading?.insertBefore(controls, heading.querySelector('.kefe-switch-host, #kefeBackgroundEffectToggle'));
    const dots = el('div', 'kbc-dots', { role: 'tablist', 'aria-label': 'Carousel pages' });
    region.append(viewport, dots);
    group.appendChild(region);

    let slides = [];
    let signature = '';

    function build(items) {
      track.replaceChildren();
      slides = items.map(item => {
        const s = slideFor(item);
        track.appendChild(s.slide);
        return s;
      });
      slides.forEach((s, i) => s.slide.setAttribute('aria-label', (i + 1) + ' of ' + slides.length));
    }
    function paint(items) {
      items.forEach((item, i) => {
        const s = slides[i];
        if (!s) return;
        s.item = item;
        s.pick.disabled = item.disabled;
        s.pick.setAttribute('aria-pressed', String(item.selected));
        s.pick.setAttribute('aria-label', item.kind + ': ' + item.label + (item.selected ? ' (selected)' : '') + (item.disabled && item.mode === 'video' ? ' — upload a video first' : ''));
        s.card.classList.toggle('is-selected', item.selected);
        s.card.classList.toggle('is-disabled', item.disabled);
        s.card.classList.toggle('is-on', item.on);
        const status = s.card.querySelector('.kbc-status');
        const sw = s.card.querySelector('.kbc-switch');
        if (status) status.textContent = item.on ? 'On' : 'Off';
        if (sw) {
          sw.setAttribute('aria-checked', String(item.on));
          sw.setAttribute('aria-label', 'Turn ' + item.label + (item.on ? ' off' : ' on'));
          sw.disabled = !item.power || item.power.disabled || item.disabled;
        }
        const desc = s.card.querySelector('.kbc-desc');
        if (desc && item.mode === 'video') desc.textContent = item.disabled ? 'Upload a video above to use it.' : 'Your own footage behind the lyrics.';
      });
      const sel = items.findIndex(i => i.selected);
      mounted.selectedIndex = sel;
    }
    function refresh() {
      const items = readSources();
      const sig = items.map(i => i.key).join('|');
      if (sig !== signature) { signature = sig; build(items); buildDots(); }
      paint(items);
      updateNav();
    }

    /* Navigation: one step scrolls one card; dots jump by a page. */
    const step = () => {
      const first = slides[0]?.slide;
      return first ? first.getBoundingClientRect().width + (parseFloat(getComputedStyle(track).columnGap) || 0) : 0;
    };
    const maxScroll = () => Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    const pageCount = () => Math.max(1, Math.ceil((viewport.scrollWidth - 2) / Math.max(1, viewport.clientWidth)));
    function scrollByCards(dir) {
      viewport.scrollBy({ left: dir * Math.max(step(), viewport.clientWidth * 0.8), behavior: reduced() ? 'auto' : 'smooth' });
    }
    function firstVisibleIndex() {
      const s = step();
      return s ? Math.min(slides.length - 1, Math.round(viewport.scrollLeft / s)) : 0;
    }
    function lastVisibleIndex() {
      const s = step();
      return s ? Math.min(slides.length - 1, Math.max(0, Math.floor((viewport.scrollLeft + viewport.clientWidth - 2) / s) - 0)) : 0;
    }
    function updateNav() {
      const max = maxScroll();
      prev.disabled = viewport.scrollLeft <= 1;
      next.disabled = viewport.scrollLeft >= max - 1;
      const total = slides.length;
      const a = firstVisibleIndex() + 1;
      const b = Math.max(a, lastVisibleIndex() + 1);
      count.textContent = total ? (a === b ? a : a + '–' + b) + ' / ' + total : '';
      const pages = pageCount();
      Array.from(dots.children).forEach((dot, i) => {
        const cur = pages > 1 ? Math.round((viewport.scrollLeft / Math.max(1, max)) * (pages - 1)) : 0;
        dot.classList.toggle('is-active', i === cur);
        dot.setAttribute('aria-selected', String(i === cur));
      });
    }
    function buildDots() {
      const pages = Math.min(8, pageCount());
      dots.hidden = pages < 2;
      dots.replaceChildren(...Array.from({ length: pages }, (_, i) => {
        const dot = el('button', 'kbc-dot', { type: 'button', role: 'tab', 'aria-label': 'Go to page ' + (i + 1) + ' of ' + pages });
        dot.addEventListener('click', () => {
          viewport.scrollTo({ left: pages > 1 ? (i / (pages - 1)) * maxScroll() : 0, behavior: reduced() ? 'auto' : 'smooth' });
        });
        return dot;
      }));
    }
    prev.addEventListener('click', () => scrollByCards(-1));
    next.addEventListener('click', () => scrollByCards(1));
    viewport.addEventListener('scroll', () => requestAnimationFrame(updateNav), { passive: true });
    viewport.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') { e.preventDefault(); scrollByCards(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); scrollByCards(-1); }
    });
    new ResizeObserver(() => { buildDots(); updateNav(); }).observe(viewport);

    /* Follow the real controls. */
    let queued = false;
    const queue = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; refresh(); }); };
    const watch = new MutationObserver(queue);
    const opts = { subtree: true, attributes: true, childList: true, attributeFilter: ['class', 'aria-pressed', 'aria-checked', 'aria-selected', 'disabled', 'data-state', 'hidden'] };
    watch.observe(options, opts);
    const gallery = document.querySelector('.kv-gallery');
    if (gallery) watch.observe(gallery.parentElement || gallery, opts);
    document.addEventListener('kefe-background-change', queue);

    mounted = { refresh, viewport, selectedIndex: -1 };
    refresh();
    /* Bring the current choice into view once. */
    requestAnimationFrame(() => {
      const idx = mounted.selectedIndex;
      if (idx > 0 && slides[idx]) viewport.scrollTo({ left: Math.max(0, slides[idx].slide.offsetLeft - 8), behavior: 'auto' });
      updateNav();
    });
  }

  const obs = new MutationObserver(() => { mount(); if (mounted) obs.disconnect(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { mount(); if (!mounted) obs.observe(document.documentElement, { childList: true, subtree: true }); });
  else { mount(); if (!mounted) obs.observe(document.documentElement, { childList: true, subtree: true }); }
  window.kefeBackgroundCarousel = { refresh: () => mounted?.refresh() };
})();
