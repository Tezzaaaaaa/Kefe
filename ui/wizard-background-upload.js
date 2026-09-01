/* Stable background image/video picker for the guided wizard. */
(() => {
    'use strict';

    function wire() {
        const drop = document.getElementById('bgDrop');
        const input = document.getElementById('backgroundInput');
        if (!drop || !input || drop.dataset.kefeWizardUploadWired === 'true') return;

        drop.dataset.kefeWizardUploadWired = 'true';

        // The label is intentionally not used for activation in wizard mode.
        // A single delegated handler opens the native picker and prevents the
        // wizard/navigation handlers from treating the click as a page action.
        drop.addEventListener('click', event => {
            if (!document.body.classList.contains('wizard-mode')) return;
            if (event.target === input) return;
            const trigger = event.target.closest('.file-button');
            if (!trigger) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            input.click();
        }, true);

        input.addEventListener('click', event => {
            if (document.body.classList.contains('wizard-mode')) {
                event.stopImmediatePropagation();
            }
        }, true);

        // Prevent the native file input from being cleared or interpreted as
        // a wizard navigation event after selection. app.js remains the sole
        // owner of the change event and calls handleBackgroundFile().
        input.addEventListener('change', event => {
            if (!document.body.classList.contains('wizard-mode')) return;
            event.stopImmediatePropagation();
            const file = input.files && input.files[0];
            if (file && typeof window.handleBackgroundFile === 'function') {
                window.handleBackgroundFile(file);
            }
        }, true);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', wire, { once: true });
    } else {
        wire();
    }
})();
