/* KEFE wizard media fix.
 * Loaded after app.js so it can replace the legacy background file input handler.
 * The wizard must be able to accept a local background video as soon as the browser
 * has created a usable video element; audio-track detection must never block upload.
 *
 * Timing rule:
 *   - uploaded audio exists -> uploaded audio is the lyric/timeline master
 *   - no uploaded audio + background video exists -> the video timeline is the master
 *
 * This deliberately does NOT require a separately loaded Audio element for a video
 * source. The video's own currentTime is the authoritative clock in that path.
 */
(() => {
    'use strict';

    const $ = id => document.getElementById(id);
    const state = window.state;
    const media = window.kefeMedia;
    if (!state || !media) return;

    const MAX_BACKGROUND_BYTES = 500 * 1024 * 1024;
    let loadToken = 0;
    let masterGuardTimer = null;

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

    function isVideoSource() {
        return document.body.classList.contains('wizard-src-media') || window.kefeWizardSource === 'media';
    }

    function refreshWizardNext() {
        const btn = $('wizardNextBtn');
        if (!btn) return;
        const step = document.body.dataset.wizardStep;
        if (step !== 'source') return;

        // Background Video is valid as soon as the video itself is readable.
        // Do not make the wizard depend on Safari exposing an audio track.
        const hasVideo = Boolean(media.video && media.videoFile);
        if (isVideoSource()) btn.disabled = !hasVideo;
    }

    function ensureCorrectTimingMaster() {
        if (!media.video || !media.videoFile || !isVideoSource()) return;

        // An explicitly uploaded audio file always wins. Otherwise the uploaded
        // video is the authoritative timing source, regardless of whether the
        // browser can inspect its embedded audio track.
        if (state.audio?.file) {
            if (state.audioSource?.master !== 'uploaded' && typeof window.applyMasterSelection === 'function') {
                state.audioSource.userChosen = true;
                window.applyMasterSelection('uploaded', { userInitiated: false, silent: true });
            }
            return;
        }

        // app.js historically used videoHasAudio as a gate for video-master mode.
        // For wizard video sources that gate is wrong: video currentTime is still
        // the correct lyric clock even when the video is silent or Safari cannot
        // expose the embedded track. Mark it as an available master temporarily;
        // this flag means "video can be the timing source", not "audio detected".
        media.videoHasAudio = true;
        if (state.audioSource?.master !== 'video' && typeof window.applyMasterSelection === 'function') {
            state.audioSource.userChosen = false;
            window.applyMasterSelection('video', { userInitiated: false, silent: true });
        } else if (state.audioSource) {
            state.audioSource.master = 'video';
        }
    }

    function startMasterGuard() {
        if (masterGuardTimer) clearInterval(masterGuardTimer);
        // Audio can finish loading after the background video. The guard keeps
        // the rule deterministic without fighting an explicitly uploaded audio
        // file, which is allowed to take over as master.
        masterGuardTimer = setInterval(() => {
            if (!media.video || !media.videoFile || !isVideoSource()) return;
            ensureCorrectTimingMaster();
        }, 250);
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
        // Detection is informational only. It must never decide whether the
        // video can be the timeline master.
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
        return null;
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

        // Keep video available as a timing master. Do not infer lyric timing
        // from a detached Audio element when the user chose Video as source.
        media.videoHasAudio = true;
        status(`${file.name} · video ready`);
        statusClass('success');
        ensureCorrectTimingMaster();
        refreshWizardNext();

        try { video.currentTime = 0; } catch (e) {}
        if (typeof window.readiness === 'function') window.readiness();
        if (typeof window.redrawCurrentPreviewFrame === 'function') window.redrawCurrentPreviewFrame();
        refreshWizardNext();

        // Refine audio-track information asynchronously for display/debugging,
        // but NEVER switch the timing master away from the uploaded video.
        bestEffortAudioDetection(file, video).then(detected => {
            if (token !== loadToken || media.video !== video) return;
            if (detected === true) status(`${file.name} · has audio`);
            else if (detected === false) status(`${file.name} · no audio track detected`);
            else status(`${file.name} · video ready`);
            statusClass('success');

            // Preserve the timing rule after detection resolves. In particular,
            // never fall back to the virtual/muted clock merely because Safari
            // reported no audio track.
            ensureCorrectTimingMaster();
            if (typeof window.readiness === 'function') window.readiness();
            if (typeof window.redrawCurrentPreviewFrame === 'function') window.redrawCurrentPreviewFrame();
            refreshWizardNext();
        });
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
        startMasterGuard();
    }

    install();

    new MutationObserver(() => {
        refreshWizardNext();
        ensureCorrectTimingMaster();
    }).observe(document.body, {
        attributes: true,
        attributeFilter: ['class', 'data-wizard-step']
    });
})();
