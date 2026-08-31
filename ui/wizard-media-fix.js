/* KEFE wizard media fix.
 * Loaded after app.js so it can replace the legacy background file input handler.
 * The wizard must be able to accept a local background video as soon as the browser
 * has created a usable video element; audio-track detection must never block upload.
 */
(() => {
    'use strict';

    const $ = id => document.getElementById(id);
    const state = window.state;
    const media = window.kefeMedia;
    if (!state || !media) return;

    const MAX_BACKGROUND_BYTES = 500 * 1024 * 1024;
    let loadToken = 0;

    const status = text => {
        const el = $('backgroundStatus');
        if (el) el.textContent = text;
    };
    const statusClass = name => {
        const el = $('backgroundStatus');
        if (el) el.className = `status ${name || ''}`.trim();
    };
    const toast = (msg, type = '') => {
        if (typeof window.toast === 'function') window.toast(msg, type);
    };

    function refreshWizardNext() {
        const btn = $('wizardNextBtn');
        if (!btn) return;
        const step = document.body.dataset.wizardStep;
        if (step !== 'source') return;

        // For the Background Video source, the uploaded video itself is the
        // required source. Audio-track detection is deliberately not part of
        // this gate because Safari/iOS cannot reliably expose audio tracks on
        // local <video> elements.
        const hasVideo = Boolean(media.video && media.videoFile);
        if (document.body.classList.contains('wizard-src-media')) btn.disabled = !hasVideo;
    }

    function clearExistingMedia() {
        if (media.video) {
            try { media.video.pause(); } catch (e) {}
            try { media.video.removeAttribute('src'); media.video.load(); } catch (e) {}
        }
        media.video = null;
        media.videoFile = null;
        media.videoHasAudio = false;
        media.image = null;
        if (state.background) {
            state.background.type = 'solid';
            state.background.video = null;
            state.background.image = null;
        }
    }

    async function bestEffortAudioDetection(file, video) {
        // Use the app's detector when available. It is intentionally best-effort:
        // a failed/unsupported decode must not prevent the video from loading.
        if (typeof window.detectVideoHasAudio === 'function') {
            try {
                const detected = await window.detectVideoHasAudio(file, video);
                if (detected) return true;
            } catch (e) {}
        }
        try {
            if (video.audioTracks && video.audioTracks.length > 0) return true;
            if (video.mozHasAudio === true) return true;
            if (video.webkitAudioDecodedByteCount > 0) return true;
        } catch (e) {}
        return false;
    }

    function setVideoAsBackground(file, url, video, token) {
        if (token !== loadToken) return;
        if (!video.videoWidth || !video.videoHeight || !Number.isFinite(video.duration) || video.duration <= 0) {
            status('Video loaded, but its duration could not be read');
            statusClass('error');
            toast('Could not read the video duration', 'error');
            return;
        }

        // Make the video available to the wizard immediately. Do not wait for
        // audio detection, because that can fail on iOS Safari even for videos
        // that visibly contain an audio stream.
        if (media.video && media.video !== video) {
            try { media.video.pause(); } catch (e) {}
        }
        media.video = video;
        media.videoFile = file;
        media.image = null;
        media.videoHasAudio = false;
        state.background.type = 'video';
        state.background.video = video;
        state.background.image = null;

        status(`${file.name} · loading audio…`);
        statusClass('loading');
        refreshWizardNext();

        // Detect audio after the visual background is already usable.
        bestEffortAudioDetection(file, video).then(hasAudio => {
            if (token !== loadToken || media.video !== video) return;
            media.videoHasAudio = Boolean(hasAudio);
            status(`${file.name}${hasAudio ? ' · has audio' : ' · no audio track detected'}`);
            statusClass('success');

            if (!state.audio.file && typeof window.applyMasterSelection === 'function') {
                window.applyMasterSelection(hasAudio ? 'video' : 'none', { userInitiated: false, silent: true });
            } else if (document.body.classList.contains('wizard-src-media') && hasAudio && typeof window.applyMasterSelection === 'function') {
                state.audioSource.userChosen = false;
                window.applyMasterSelection('video', { userInitiated: false, silent: true });
            }

            if (typeof window.readiness === 'function') window.readiness();
            if (typeof window.redrawCurrentPreviewFrame === 'function') window.redrawCurrentPreviewFrame();
            refreshWizardNext();
        });

        // Position the preview immediately and let the normal render loop take over.
        try { video.currentTime = 0; } catch (e) {}
        if (typeof window.readiness === 'function') window.readiness();
        if (typeof window.redrawCurrentPreviewFrame === 'function') window.redrawCurrentPreviewFrame();
        refreshWizardNext();
    }

    function handleBackgroundVideo(file) {
        if (!file) return;
        if (!file.type || !file.type.startsWith('video/')) {
            toast('Choose a video file for Background Video', 'error');
            return;
        }
        if (file.size > MAX_BACKGROUND_BYTES) {
            toast(`Background file too large (max ${Math.round(MAX_BACKGROUND_BYTES / 1024 / 1024)}MB)`, 'error');
            return;
        }

        const token = ++loadToken;
        const url = URL.createObjectURL(file);
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.playsInline = true;
        video.muted = true;
        video.loop = true;
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');

        const fail = () => {
            if (token !== loadToken) return;
            URL.revokeObjectURL(url);
            media.video = null;
            media.videoFile = null;
            media.videoHasAudio = false;
            status('Error loading video');
            statusClass('error');
            refreshWizardNext();
            toast('Video failed to load. Try MP4 (H.264) or MOV (H.264).', 'error');
        };

        const loaded = () => {
            if (token !== loadToken) return;
            setVideoAsBackground(file, url, video, token);
        };

        video.addEventListener('loadedmetadata', loaded, { once: true });
        video.addEventListener('loadeddata', loaded, { once: true });
        video.addEventListener('error', fail, { once: true });
        video.src = url;
        video.load();

        status(`Loading ${file.name}…`);
        statusClass('loading');
    }

    function handleBackgroundImage(file) {
        if (!file || !file.type?.startsWith('image/')) return;
        if (file.size > MAX_BACKGROUND_BYTES) {
            toast(`Background file too large (max ${Math.round(MAX_BACKGROUND_BYTES / 1024 / 1024)}MB)`, 'error');
            return;
        }
        const token = ++loadToken;
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            if (token !== loadToken) { URL.revokeObjectURL(url); return; }
            clearExistingMedia();
            media.image = img;
            state.background.type = 'image';
            state.background.image = img;
            status(file.name);
            statusClass('success');
            if (typeof window.readiness === 'function') window.readiness();
            if (typeof window.redrawCurrentPreviewFrame === 'function') window.redrawCurrentPreviewFrame();
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            if (token !== loadToken) return;
            status('Error loading image');
            statusClass('error');
            toast('Image failed to load', 'error');
        };
        img.src = url;
    }

    function install() {
        const oldInput = $('backgroundInput');
        if (!oldInput || oldInput.dataset.wizardMediaFix === '1') return;

        // Replacing the input removes the listener installed by app.js. The
        // label's for="backgroundInput" continues to work because the id stays.
        const input = oldInput.cloneNode(true);
        input.dataset.wizardMediaFix = '1';
        oldInput.replaceWith(input);

        input.addEventListener('change', () => {
            const file = input.files?.[0];
            input.value = '';
            if (!file) return;
            if (file.type?.startsWith('video/')) handleBackgroundVideo(file);
            else if (file.type?.startsWith('image/')) handleBackgroundImage(file);
            else toast('Choose an image or video file', 'error');
        });

        refreshWizardNext();
    }

    // app.js has already run when this file is loaded.
    install();

    // The wizard changes body classes/step state dynamically. Keep the Next
    // button correct without modifying wizard.js internals.
    new MutationObserver(refreshWizardNext).observe(document.body, {
        attributes: true,
        attributeFilter: ['class', 'data-wizard-step']
    });
})();
