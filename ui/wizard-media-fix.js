/* KEFE wizard media fix: backgroundInput is owned by app.js. */
(() => {
    'use strict';
    const input = document.getElementById('backgroundInput');
    if (!input) return;
    // Never clone, replace, or intercept this input. app.js owns its change event.
    input.dataset.kefeMediaOwner = '1';

    // Load the local-first project engine after the core editor is available.
    const loadProjectEngine = () => {
        if (window.kefeProject || document.querySelector('script[data-kefe-project-engine]')) return;
        const script = document.createElement('script');
        script.src = './core/project-engine.js';
        script.async = false;
        script.dataset.kefeProjectEngine = 'true';
        document.head.appendChild(script);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadProjectEngine, { once: true });
    else loadProjectEngine();
})();
