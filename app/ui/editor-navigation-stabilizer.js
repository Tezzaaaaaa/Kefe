/* KEFE final editor navigation/layout stabilizer. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const q = s => document.querySelector(s);
  function boot() {
    const nav = q('.section-nav');
    if (!nav) return;
    const links = [...nav.querySelectorAll('.section-nav-link')];
    links.forEach(link => {
      link.addEventListener('click', e => {
        const href = link.getAttribute('href') || '';
        const id = href.startsWith('#') ? href.slice(1) : '';
        const target = id ? $(id) : null;
        if (!target) return;
        e.preventDefault();
        links.forEach(x => x.classList.toggle('active', x === link));
        target.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
      });
    });
    const exportSection = $('exportSection');
    const top = exportSection?.querySelector('.export-top-controls');
    const heading = exportSection?.querySelector('h3');
    if (top && heading && top.previousElementSibling !== heading) heading.insertAdjacentElement('afterend', top);
    const background = $('backgroundSection');
    if (background) {
      background.hidden = false;
      background.style.removeProperty('display');
      background.style.removeProperty('visibility');
      background.style.removeProperty('opacity');
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
