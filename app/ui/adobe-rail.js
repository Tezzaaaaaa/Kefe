/* KEFE editor rail controller.
   The rail is the persistent navigation for the direct editor. */
(() => {
    'use strict';

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


        const order = ['audio', 'text', 'background', 'fx', 'export'];
        links.sort((a, b) => order.indexOf(a.dataset.nav) - order.indexOf(b.dataset.nav));
        links.forEach(link => {
            document.querySelector('.section-nav')?.appendChild(link);
        });

        function showByKey(key) {
            links.forEach(link => link.classList.toggle('active', link.dataset.nav === key));
            sections.forEach(section => section.classList.toggle('active', section.id === `${key}Section`));
        }

        links.forEach(link => {
            link.addEventListener('click', event => {
                if (document.body.classList.contains('wizard-mode')) return;
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
