/* KEFE background picker bridge.
 * The file input/change event belongs to app.js. This file only replaces the
 * label trigger with a real button so wizard navigation cannot treat the
 * upload control as navigation.
 */
(() => {
    'use strict';

    function install() {
        const drop = document.getElementById('bgDrop');
        const input = document.getElementById('backgroundInput');
        if (!drop || !input || drop.dataset.kefeUploadButtonReady === '1') return;
        drop.dataset.kefeUploadButtonReady = '1';

        const label = drop.querySelector('label.file-button[for="backgroundInput"]');
        if (!label) return;

        const button = document.createElement('button');
        button.type = 'button';
        button.className = label.className;
        button.textContent = 'Choose image or video…';
        button.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            input.click();
        });
        label.replaceWith(button);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', install, { once: true });
    } else {
        install();
    }
})();
