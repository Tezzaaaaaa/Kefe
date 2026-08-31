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
        // Prefer the app detector if it is exposed. It is still best-effort.
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
        return null; // unknown on browsers such as iOS Safari
    }

    function setVideoAsBackground(file, url, video, token) {
        if (token !== loadToken) return;
        if (!video.videoWidth || !video.videoHeight || !Number.isFinite(video.duration) || video.duration <= 0) {
            status('Video loaded, but its duration could not be read');
            statusClass('error');
            toast('Could not read the video duration', 'error');
            return;
        }

        if (media.video && media.video !== video) {
            try { media.video.pause(); } catch (e) {}
        }
        media.video = video;
        media.videoFile = file;
        media.image = null;
        state.background.type = 'video';
        state.background.video = video;
        state.background.image = null;

        // Unknown audio state must not block the wizard. When the user selected
        // Background Video as the source, treat the video as the master source
        // and let playback itself determine whether it produces sound.
        media.videoHasAudio = true;
        status(`${file.name} · video ready`);
        statusClass('success');
        refreshWizardNext();

        if (typeof window.applyMasterSelection === 'function') {
            if (document.body.classList.contains('wizard-src-media')) {
                state.audioSource.userChosen = false;
                window.applyMasterSelection('video', { userInitiated: false, silent: true });
            } else if (!state.audio.file) {
                window.applyMasterSelection('video', { userInitiated: false, silent: true });
            }
        }

        // Refine the status asynchronously when the browser can actually tell us.
        bestEffortAudioDetection(file, video).then(detected => {
            if (token !== loadToken || media.video !== video) return;
            if (detected === true) {
                media.videoHasAudio = true;
                status(`${file.name} · has audio`);
            } else if (detected === false) {
                // Keep the visual video valid even if it is silent. The wizard
                // source requirement is the video, not a proprietary audio API.
                media.videoHasAudio = false;
                status(`${file.name} · no audio track detected`);
                if (document.body.classList.contains('wizard-src-media') && !state.audio.file && typeof window.applyMasterSelection === 'function') {
                    window.applyMasterSelection('none', { userInitiated: false, silent: true });
                }
            }
            statusClass('success');
            if (typeof window.readiness === 'function') window.readiness();
            if (typeof window.redrawCurrentPreviewFrame === 'function') window.redrawCurrentPreviewFrame();
            refreshWizardNext();
        });

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

    install();

    new MutationObserver(refreshWizardNext).observe(document.body, {
        attributes: true,
        attributeFilter: ['class', 'data-wizard-step']
    });
})();
