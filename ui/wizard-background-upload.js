/* KEFE wizard background media picker.
   One job only: open the native file picker without allowing the wizard
   navigation layer or the <label> default action to interfere. app.js owns
   the input's change event and media processing. */
(() => {
    'use strict';

    function wire() {
        const drop = document.getElementById('bgDrop');
        const input = document.getElementById('backgroundInput');
        if (!drop || !input || drop.dataset.kefeWizardUploadWired === 'true') return;

        drop.dataset.kefeWizardUploadWired = 'true';

        drop.addEventListener('click', event => {
            if (!document.body.classList.contains('wizard-mode')) return;
            const trigger = event.target.closest('.file-button');
            if (!trigger) return;

            // The trigger is currently a <label for="backgroundInput">.
            // Prevent its native activation and perform exactly one explicit
            // input.click(), so the picker cannot also trigger wizard actions.
            event.preventDefault();
            event.stopImmediatePropagation();
            input.click();
        }, true);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', wire, { once: true });
    } else {
        wire();
    }
})();
