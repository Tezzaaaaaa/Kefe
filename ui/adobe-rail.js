/* KEFE classic editor rail controller.
   Turns the existing section-nav + sections into an Adobe Express-style
   left icon rail with a single active panel. Only active outside wizard-mode;
   never adds features, just changes how existing sections are shown. */
(() => {
    'use strict';

    // Icon markup matches the existing app's stroke-icon language (see header
    // icons and wizard.js CHOICE_ICONS). Reused/adapted, not a new visual style.
    const RAIL_ICONS = {
        audio: '<path d="M3 12h1.5M6.5 7.5v9M10 4v16M13.5 7.5v9M17 10v4M20.5 12H22"/>',
        text: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M10.5 10.5a2.5 2.5 0 1 0 0 3M17 10.5a2.5 2.5 0 1 0 0 3"/>',
        fx: '<path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4"/>',
        background: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 15.5l-5-5-4 4-3-3-4.5 4.5"/>',
        export: '<path d="M12 4v11M8 11l4 4 4-4M5 20h14"/>'
    };

    function injectIcons(links) {
        links.forEach(link => {
            if (link.querySelector('svg')) return;
            const path = RAIL_ICONS[link.dataset.nav];
            const numEl = link.querySelector('span');
            if (!path || !numEl) return;
            numEl.outerHTML = `<svg class="rail-icon" viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
        });
    }

    function init() {
        const body = document.body;
        const links = Array.from(document.querySelectorAll('.section-nav-link'));
        const sections = Array.from(document.querySelectorAll('.sidebar > .section'));
        if (!links.length || !sections.length) return;

        injectIcons(links);

        function showByKey(key) {
            links.forEach(l => l.classList.toggle('active', l.dataset.nav === key));
            sections.forEach(s => s.classList.toggle('active', s.id === key + 'Section'));
        }

        links.forEach(link => {
            link.addEventListener('click', e => {
                if (body.classList.contains('wizard-mode')) return; // wizard owns navigation while active
                e.preventDefault();
                showByKey(link.dataset.nav);
            });
        });

        function ensureActive() {
            if (body.classList.contains('wizard-mode')) return;
            if (sections.some(s => s.classList.contains('active'))) return;
            const current = links.find(l => l.classList.contains('active')) || links[0];
            showByKey(current.dataset.nav);
        }

        ensureActive();
        new MutationObserver(ensureActive).observe(body, { attributes: true, attributeFilter: ['class'] });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
