/* KEFE wizard media fix: backgroundInput is owned by app.js. */
(() => {
    'use strict';
    const input = document.getElementById('backgroundInput');
    if (!input) return;
    // Never clone, replace, or intercept this input. app.js owns its change event.
    input.dataset.kefeMediaOwner = '1';
})();
