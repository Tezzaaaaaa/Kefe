/* KEFE editor rail controller.
   The rail is the persistent navigation for the direct editor. */
(() => {
    'use strict';

    const RAIL_ICONS = {
        audio: '<path d="M3 12h1.5M6.5 7.5v9M10 4v16M13.5 7.5v9M17 10v4M20.5 12H22"/>',
        export: '<path d="M4 8h16M7 4h10M6 8v12h12V8M9 12h6M9 16h6"/>',
        text: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M10.5 10.5a2.5 2.5 0 1 0 0 3M17 10.5a2.5 2.5 0 1 0 0 3"/>',
        fx: '<path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4"/>',
        background: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 15.5l-5-5-4 4-3-3-4.5 4.5"/>'
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

    /* Flowing Menu: turn labels into a reusable marquee track. It is delegated
       here so dynamically-created effect/background options receive the same
       interaction without needing their own component or event handlers. */
    function applyFlowingMenu(root = document) {
        const selectors = [
            '.section-nav-link strong',
            '.effect-buttons button',
            '.background-choice-label',
            '.aspect-buttons button',
            '.lyrics-actions button'
        ];

        root.querySelectorAll(selectors.join(',')).forEach(target => {
            if (target.closest('.kefe-flowing-menu')) return;

            let label = target;
            if (target.matches('button')) {
                const childLabel = target.querySelector('.background-choice-label, .kefe-flowing-label');
                if (childLabel) label = childLabel;
                else {
                    const text = Array.from(target.childNodes)
                        .filter(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim())
                        .map(node => node.textContent.trim())
                        .join(' ');
                    if (!text) return;
                    target.textContent = text;
                    label = target;
                }
            }

            if (!label.textContent.trim() || label.querySelector('.kefe-flowing-track')) return;

            const text = label.textContent.trim();
            label.classList.add('kefe-flowing-label', 'kefe-flowing-ready');
            label.setAttribute('aria-label', text);
            label.textContent = '';

            const track = document.createElement('span');
            track.className = 'kefe-flowing-track';
            for (let i = 0; i < 2; i += 1) {
                const copy = document.createElement('span');
                copy.className = 'kefe-flowing-copy';
                copy.textContent = text;
                copy.setAttribute('aria-hidden', 'true');
                track.appendChild(copy);
            }
            label.appendChild(track);

            const host = target.matches('button') ? target : target.closest('.section-nav-link');
            host?.classList.add('kefe-flowing-menu');
        });
    }

    function init() {
        const links = Array.from(document.querySelectorAll('.section-nav-link'));
        const sections = Array.from(document.querySelectorAll('.sidebar > .section'));
        if (!links.length || !sections.length) return;

        injectIcons(links);

        const order = ['audio', 'text', 'background', 'fx', 'export'];
        links.sort((a, b) => order.indexOf(a.dataset.nav) - order.indexOf(b.dataset.nav));
        links.forEach((link, index) => {
            document.querySelector('.section-nav')?.appendChild(link);
            const label = link.querySelector('strong');
            if (label && link.dataset.nav === 'export') label.textContent = 'Export';
            const section = document.getElementById(`${link.dataset.nav}Section`);
            const sectionIndex = section?.querySelector('.section-index');
            if (sectionIndex) sectionIndex.textContent = String(index + 1).padStart(2, '0');
        });

        function showByKey(key) {
            links.forEach(link => link.classList.toggle('active', link.dataset.nav === key));
            sections.forEach(section => section.classList.toggle('active', section.id === `${key}Section`));
        }

        links.forEach(link => {
            link.addEventListener('click', event => {
                event.preventDefault();
                showByKey(link.dataset.nav);
            });
        });

        const current = links.find(link => link.classList.contains('active')) || links[0];
        showByKey(current.dataset.nav);
        applyFlowingMenu();

        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) applyFlowingMenu(node);
                });
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
