(() => {
    'use strict';

    const THEME_KEY = 'kefe-theme-v1';
    const MODES = ['system', 'day', 'night'];
    const LABELS = { system: 'System', day: 'Day', night: 'Night' };
    const ICONS = {
        system: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9Z"/></svg>',
        day: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.8v2M12 19.2v2M2.8 12h2M19.2 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M18.5 5.5l-1.4 1.4M6.9 17.1l-1.4 1.4"/></svg>',
        night: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15.4A8.7 8.7 0 0 1 8.6 4a8.8 8.8 0 1 0 11.4 11.4Z"/></svg>'
    };

    function getMode() {
        try {
            const saved = localStorage.getItem(THEME_KEY);
            return MODES.includes(saved) ? saved : 'system';
        } catch (e) {
            return document.documentElement.dataset.theme === 'day' ? 'day' : document.documentElement.dataset.theme === 'night' ? 'night' : 'system';
        }
    }

    function updateButton(button, mode) {
        const next = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
        button.innerHTML = ICONS[mode];
        button.dataset.theme = mode;
        button.setAttribute('aria-label', `Theme: ${LABELS[mode]}. Click to switch to ${LABELS[next]}`);
        button.title = `Theme: ${LABELS[mode]} — click for ${LABELS[next]}`;
    }

    function setMode(button, mode) {
        if (!MODES.includes(mode)) mode = 'system';
        if (mode === 'system') delete document.documentElement.dataset.theme;
        else document.documentElement.dataset.theme = mode;
        try { localStorage.setItem(THEME_KEY, mode); } catch (e) { /* non-critical */ }
        updateButton(button, mode);
    }

    function init() {
        const control = document.querySelector('.theme-control');
        if (!control) return;

        const button = document.createElement('button');
        button.type = 'button';
        button.id = 'themeSelect';
        button.className = 'theme-cycle-button';

        control.replaceWith(button);
        setMode(button, getMode());
        button.addEventListener('click', () => {
            const current = getMode();
            setMode(button, MODES[(MODES.indexOf(current) + 1) % MODES.length]);
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
})();
