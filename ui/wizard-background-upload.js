/* KEFE wizard background media picker.
   The background upload control has exactly one activation path:
   button -> hidden file input -> app.js change handler.
*/
(() => {
    'use strict';

    function wire() {
        const drop = document.getElementById('bgDrop');
        const input = document.getElementById('backgroundInput');
        if (!drop || !input || drop.dataset.kefeWizardUploadWired === 'true') return;

        // Remove the <label for="backgroundInput"> activation path entirely.
        // Labels can trigger the input a second time and can also be interpreted
        // by wizard navigation code as a normal click/navigation action.
        const label = drop.querySelector('label.file-button[for="backgroundInput"]');
        if (label) {
            const button = document.createElement('button');
            button.type = 'button';
            button.id = 'backgroundChooseBtn';
            button.className = label.className;
            button.textContent = label.textContent;
            button.setAttribute('aria-controls', 'backgroundInput');
            label.replaceWith(button);
        }

        const button = document.getElementById('backgroundChooseBtn');
        if (!button) return;

        drop.dataset.kefeWizardUploadWired = 'true';

        // Capture before the wizard's handlers. Only this button opens the
        // picker; the file input's normal change event remains owned by app.js.
        button.addEventListener('click', event => {
            event.preventDefault();
            event.stopImmediatePropagation();
            input.click();
        }, true);

        // Drag/drop is intentionally left to the existing app.js drop-zone
        // implementation. We only own the explicit Choose button.
    }

    function boot() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', wire, { once: true });
        } else {
            wire();
        }
    }

    boot();
})();
