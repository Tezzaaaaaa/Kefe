/* KEFE wizard entry point.
   The editor loads this file from index.html. Keep the implementation in ui/wizard.js,
   but initialise the preview target before loading it so the preview toggle works. */
(() => {
    'use strict';

    const preview = document.querySelector('.preview');
    if (preview && !preview.id) preview.id = 'previewSection';

    const script = document.createElement('script');
    script.src = './ui/wizard.js';
    script.async = false;
    document.body.appendChild(script);
})();
