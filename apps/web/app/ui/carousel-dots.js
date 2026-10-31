/* KEFE carousel dots (shadcn carousel "dots" variant).
   Adds a pagination row under the lyric effect carousel: one dot per visible page, the active dot stretches into
   a pill, clicking a dot scrolls to that page. Purely additive: it reads the scroller's geometry and calls scrollTo,
   so the existing arrows, selection and keyboard handling keep working untouched. */
(() => {
  'use strict';
  const SCROLLER = '#lyricEffectOptions';
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  function attach(host) {
    const scroller = host.querySelector(SCROLLER);
    if (!scroller || host.dataset.kefeDots === 'true') return;
    host.dataset.kefeDots = 'true';
    const row = document.createElement('div');
    row.className = 'kefe-carousel-dots';
    row.setAttribute('role', 'tablist');
    row.setAttribute('aria-label', 'Lyric effect pages');
    host.insertAdjacentElement('afterend', row);

    let pages = 0, current = -1;
    // Long carousels collapse to at most 7 dots; each dot is a proportional stop along the scroll range.
    const MAX_DOTS = 7;
    const pageCount = () => Math.min(MAX_DOTS, Math.max(1, Math.ceil((scroller.scrollWidth - 2) / Math.max(1, scroller.clientWidth))));
    const pageIndex = () => {
      const max = scroller.scrollWidth - scroller.clientWidth;
      if (max <= 1) return 0;
      return Math.min(pages - 1, Math.round((scroller.scrollLeft / max) * (pages - 1)));
    };
    function build() {
      const next = pageCount();
      row.hidden = next < 2;
      if (next === pages && row.childElementCount === next) return;
      pages = next; current = -1;
      row.replaceChildren(...Array.from({ length: pages }, (_, i) => {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'kefe-carousel-dot';
        dot.setAttribute('role', 'tab');
        dot.setAttribute('aria-label', 'Go to page ' + (i + 1) + ' of ' + pages);
        dot.addEventListener('click', () => {
          const max = scroller.scrollWidth - scroller.clientWidth;
          const left = pages > 1 ? (i / (pages - 1)) * max : 0;
          scroller.scrollTo({ left, behavior: reduced() ? 'auto' : 'smooth' });
        });
        return dot;
      }));
      update();
    }
    function update() {
      const i = pageIndex();
      if (i === current) return;
      current = i;
      Array.from(row.children).forEach((dot, k) => {
        dot.classList.toggle('is-active', k === i);
        dot.setAttribute('aria-selected', String(k === i));
      });
    }
    scroller.addEventListener('scroll', update, { passive: true });
    new ResizeObserver(build).observe(scroller);
    new MutationObserver(build).observe(scroller, { childList: true });
    build();
  }

  const scan = () => document.querySelectorAll('.kefe-lyric-effect-carousel').forEach(attach);
  scan();
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
})();
