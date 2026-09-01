/* KEFE wizard entry point. */
(() => {
    'use strict';

    const preview = document.querySelector('.preview');
    if (preview && !preview.id) preview.id = 'previewSection';

    if (!document.querySelector('link[data-kefe-preview-layout]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = './ui/preview-layout.css';
        link.dataset.kefePreviewLayout = 'true';
        document.head.appendChild(link);
    }

    const confirmationStyle = document.createElement('link');
    confirmationStyle.rel = 'stylesheet';
    confirmationStyle.href = './ui/upload-confirmations.css?v=20260901';
    confirmationStyle.dataset.kefeUploadConfirmationStyle = 'true';
    document.head.appendChild(confirmationStyle);

    const confirmationScript = document.createElement('script');
    confirmationScript.src = './ui/upload-confirmations.js?v=20260901';
    confirmationScript.async = false;
    document.body.appendChild(confirmationScript);

    const script = document.createElement('script');
    script.src = './ui/wizard.js';
    script.async = false;
    document.body.appendChild(script);
})();
