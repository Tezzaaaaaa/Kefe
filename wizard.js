/* KEFE wizard entry point. */
(() => {
    'use strict';

    const preview = document.querySelector('.preview');
    if (preview && !preview.id) preview.id = 'previewSection';

    if (!document.querySelector('link[data-kefe-preview-layout]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = './app/ui/preview-layout.css';
        link.dataset.kefePreviewLayout = 'true';
        document.head.appendChild(link);
    }

    const confirmationStyle = document.createElement('link');
    confirmationStyle.rel = 'stylesheet';
    confirmationStyle.href = './app/ui/upload-confirmations.css?v=20260901';
    confirmationStyle.dataset.kefeUploadConfirmationStyle = 'true';
    document.head.appendChild(confirmationStyle);

    const confirmationScript = document.createElement('script');
    confirmationScript.src = './app/ui/upload-confirmations.js?v=20260901';
    confirmationScript.async = false;
    document.body.appendChild(confirmationScript);

    // Wire the background image/video picker after the editor DOM exists.
    // The picker owns the click/change interaction; app.js remains responsible
    // for actually loading the selected media into the preview/export state.
    const backgroundUploadScript = document.createElement('script');
    backgroundUploadScript.src = './app/ui/wizard-background-upload.js?v=20260901';
    backgroundUploadScript.async = false;
    backgroundUploadScript.dataset.kefeBackgroundUpload = 'true';
    document.body.appendChild(backgroundUploadScript);

    const script = document.createElement('script');
    script.src = './app/ui/wizard.js';
    script.async = false;
    document.body.appendChild(script);
})();
