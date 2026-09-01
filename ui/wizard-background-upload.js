/* Keep background-video selection stable inside the guided wizard. */
(() => {
    'use strict';

    function wire() {
        const drop = document.getElementById('bgDrop');
        const input = document.getElementById('backgroundInput');
        if (!drop || !input || drop.dataset.kefeWizardUploadWired === 'true') return;

        drop.dataset.kefeWizardUploadWired = 'true';

        // The editor's drop-zone wiring and the <label for="backgroundInput">
        // both respond to the same click. In the wizard this can cause the
        // control to be activated twice and the page to jump when the media
        // section is re-rendered. Let the input own activation explicitly.
        drop.addEventListener('click', event => {
            if (!document.body.classList.contains('wizard-mode')) return;
            if (event.target === input) return;
            event.preventDefault();
            event.stopPropagation();
            input.click();
        }, true);

        input.addEventListener('click', event => {
            if (document.body.classList.contains('wizard-mode')) {
                event.stopPropagation();
            }
        }, true);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire, { once: true });
    else wire();
})();
