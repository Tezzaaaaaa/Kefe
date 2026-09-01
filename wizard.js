/* KEFE wizard entry point.
   The editor loads this file from index.html. Keep the implementation in ui/wizard.js,
   but initialise the preview target and preview layout before loading it. */
(() => {
    'use strict';

    const preview = document.querySelector('.preview');
    if (preview && !preview.id) preview.id = 'previewSection';

    // Load the dedicated preview layout after the base/wizard styles so it can
    // control only the drawer + transport without replacing the design system.
    if (!document.querySelector('link[data-kefe-preview-layout]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = './ui/preview-layout.css';
        link.dataset.kefePreviewLayout = 'true';
        document.head.appendChild(link);
    }

    const script = document.createElement('script');
    script.src = './ui/wizard.js';
    script.async = false;
    document.body.appendChild(script);
})();
