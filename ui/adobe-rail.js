/* KEFE classic editor rail controller.
   Turns the existing section-nav + sections into an Adobe Express-style
   left icon rail with a single active panel. Only active outside wizard-mode;
   never adds features, just changes how existing sections are shown. */
(() => {
    'use strict';
    function init() {
        const body = document.body;
        const links = Array.from(document.querySelectorAll('.section-nav-link'));
        const sections = Array.from(document.querySelectorAll('.sidebar > .section'));
        if (!links.length || !sections.length) return;

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
