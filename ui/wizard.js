/* KEFE guided creation workflow — linear, context-aware setup. */
(() => {
    'use strict';
    const $ = id => document.getElementById(id);
    const body = document.body;
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar || $('wizardSection')) return;

    const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pad = n => String(n).padStart(2, '0');
    body.classList.add('wizard-mode');

    const previewEl = document.querySelector('.preview');
    if (previewEl) {
        previewEl.id = 'previewSection';
        previewEl.classList.add('preview-collapsed');
    }

    /* One linear workflow. Do not make the user revisit earlier sections. */
    const PATHS = {
        lyric: ['intro', 'source', 'content', 'style', 'background', 'preview', 'review'],
        visualiser: ['intro', 'source', 'style', 'background', 'preview', 'review'],
        captioned: ['intro', 'source', 'captions', 'style', 'background', 'preview', 'review'],
        custom: ['intro', 'source', 'content', 'style', 'background', 'preview', 'review']
    };
    const PATH_LABELS = {
        lyric: 'Lyric Video',
        visualiser: 'Visualiser',
        captioned: 'Captioned Video',
        custom: 'Custom'
    };
    const PATH_HINTS = {
        lyric: 'Synced lyrics with expressive motion.',
        visualiser: 'Audio-reactive visuals with no lyrics.',
        captioned: 'Timed captions for spoken audio or video.',
        custom: 'Build the video your way.'
    };
    const STEP_TITLES = {
        content: 'Add your content',
        style: 'Choose your look',
        background: 'Choose your background',
        captions: 'Create your captions'
    };
    const STEP_LABELS = {
        intro: 'Format',
        source: 'Media',
        content: 'Content',
        captions: 'Captions',
        style: 'Style',
        background: 'Background',
        preview: 'Preview',
        review: 'Export'
    };
    const CHOICE_ICONS = {
        lyric: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 11h16M4 16h10"/><circle cx="18.2" cy="17.4" r="2.6"/><path d="M20.8 17.4V8.2l-2.6.9"/></svg>',
        visualiser: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4"/></svg>',
        captioned: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M10.5 10.5a2.5 2.5 0 1 0 0 3M17 10.5a2.5 2.5 0 1 0 0 3"/></svg>',
        custom: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M5 12h9M5 17h12"/><circle cx="18.6" cy="12" r="2.1"/></svg>'
    };
    const SOURCE_ICONS = {
        uploaded: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4M8 8l4-4 4 4M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/></svg>',
        media: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m10 9 5 3-5 3z"/></svg>',
        none: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h10M4 17h16"/><path d="m17 10 4 4m0-4-4 4"/></svg>'
    };

    const wizard = { path: 'lyric', index: 0, choice: null, source: null };
    const stepsFor = () => PATHS[wizard.path] || PATHS.lyric;
    const fxSectionId = () => {
        const el = $('visualFxSection') || $('fxSection');
        return el ? el.id : null;
    };

    const panel = document.createElement('div');
    panel.className = 'section wizard-panel';
    panel.id = 'wizardSection';
    sidebar.insertBefore(panel, sidebar.firstChild);

    const nav = document.createElement('div');
    nav.className = 'wizard-nav';
    nav.id = 'wizardNav';
    nav.innerHTML = '<button type="button" id="wizardBackBtn" class="wizard-back" disabled>Back</button>' +
        '<div class="wizard-progress-wrap"><div id="wizardProgress" class="wizard-progress">01 / 07</div><span id="wizardStepLabel" class="wizard-step-label">Format</span><button type="button" id="wizardSkipBtn" class="wizard-skip">Skip setup</button></div>' +
        '<button type="button" id="wizardNextBtn" class="primary wizard-next">Next</button>';
    sidebar.appendChild(nav);

    const stepHeading = document.createElement('div');
    stepHeading.className = 'wizard-step-heading';
    let fadeTimer = null;

    function hasLoadedAudio() {
        const a = window.state?.audio;
        return Boolean(a && (a.file || a.ready || a.duration > 0));
    }
    function sourceReady() {
        if (!wizard.source) return false;
        if (wizard.source === 'none') return true;
        const m = window.kefeMedia || {};
        if (wizard.source === 'uploaded') return hasLoadedAudio();
        return Boolean(m.image || m.video || m.videoFile);
    }
    function lyricsReady() {
        if (window.state?.lyrics?.lines?.length) return true;
        const t = $('lyricsText');
        return Boolean(t && t.value.trim());
    }
    function captionsReady() {
        if (window.kefeCaptionGen?.isBusy?.()) return false;
        return Boolean(window.state?.captions?.lines?.length);
    }
    function nextEnabled(step) {
        if (step === 'intro') return Boolean(wizard.choice);
        if (step === 'source') return sourceReady();
        if (step === 'content') return lyricsReady();
        if (step === 'captions') return captionsReady();
        return true;
    }

    function targetsForStep(step) {
        if (step === 'content') return ['textSection'];
        if (step === 'captions') return [$('captionGenSection')?.id].filter(Boolean);
        if (step === 'style') return [fxSectionId()].filter(Boolean);
        if (step === 'background') return ['backgroundSection'];
        return [];
    }

    function statusTextForSource() {
        if (wizard.source === 'uploaded') return hasLoadedAudio() ? 'Audio loaded' : 'Choose an audio file below.';
        if (wizard.source === 'media') {
            const m = window.kefeMedia || {};
            return m.videoFile ? 'Background video loaded' : (m.image ? 'Background image loaded' : 'Choose an image or video below.');
        }
        return 'Silent project — no audio will be exported.';
    }

    function sourceAction() {
        if (wizard.source === 'uploaded') $('audioChooseBtn')?.click();
        if (wizard.source === 'media') $('backgroundInput')?.click();
    }

    function applySourceChoice(source) {
        wizard.source = source;
        window.kefeWizardSource = source;
        const st = window.state;
        if (typeof window.applyMasterSelection === 'function') {
            try {
                if (source === 'none') window.applyMasterSelection('none', { userInitiated: true, silent: true });
                if (source === 'uploaded') window.applyMasterSelection('uploaded', { userInitiated: false, silent: true });
                if (source === 'media') {
                    if (st?.audioSource) st.audioSource.userChosen = false;
                    const m = window.kefeMedia || {};
                    if (m.video && m.videoFile && m.videoHasAudio) window.applyMasterSelection('video', { userInitiated: false, silent: true });
                }
            } catch (e) { /* preserve existing app behaviour */ }
        }
        renderSource();
        refreshNextState();
    }

    function renderIntro() {
        panel.innerHTML = '<p class="wizard-panel-kicker">01 · Start</p>' +
            '<h3 class="wizard-panel-title">What are you making?</h3>' +
            '<p class="wizard-panel-hint">Choose once. KEFE will build the right editing path for you.</p>' +
            '<div class="wizard-choices">' +
            ['lyric', 'visualiser', 'captioned', 'custom'].map(k =>
                `<button type="button" class="wizard-choice${wizard.choice === k ? ' selected' : ''}" data-choice="${k}"><span class="wizard-choice-visual"><span class="wizard-choice-icon">${CHOICE_ICONS[k]}</span><span class="wizard-choice-lines"></span></span><span class="wizard-choice-copy"><strong>${PATH_LABELS[k]}</strong><span>${PATH_HINTS[k]}</span></span></button>`
            ).join('') + '</div>';
        panel.querySelectorAll('[data-choice]').forEach(btn => btn.addEventListener('click', () => {
            const c = btn.dataset.choice;
            if (wizard.choice !== c) wizard.source = null;
            wizard.choice = c;
            wizard.path = c;
            wizard.index = 0;
            if (typeof window.kefeSetProjectType === 'function') window.kefeSetProjectType(c);
            panel.querySelectorAll('.wizard-choice').forEach(x => x.classList.toggle('selected', x.dataset.choice === c));
            refreshNextState();
        }));
    }

    function renderSource() {
        const isCaptioned = wizard.choice === 'captioned';
        const options = isCaptioned
            ? [['uploaded', 'Audio file', 'Use a music track or voice recording.'], ['media', 'Background video', 'Use a video and its soundtrack.']]
            : [['uploaded', 'Audio file', 'Use an MP3, WAV or M4A track.'], ['media', 'Background video', 'Use a video as the visual background and its soundtrack.'], ['none', 'No audio', 'Create silent visuals.']];
        panel.innerHTML = '<p class="wizard-panel-kicker">02 · Media</p>' +
            '<h3 class="wizard-panel-title">What are you starting with?</h3>' +
            '<p class="wizard-panel-hint">Pick your source. You will not need to come back here later.</p>' +
            '<div class="wizard-choices wizard-source-choices">' +
            options.map(([v, l, h]) => `<button type="button" class="wizard-choice${wizard.source === v ? ' selected' : ''}" data-source="${v}"><span class="wizard-choice-visual"><span class="wizard-choice-icon">${SOURCE_ICONS[v]}</span><span class="wizard-choice-lines"></span></span><span class="wizard-choice-copy"><strong>${l}</strong><span>${h}</span></span></button>`).join('') +
            '</div>' +
            (wizard.source ? `<div class="wizard-source-action"><strong>${statusTextForSource()}</strong><button type="button" id="wizardSourceAction" class="file-button">${sourceReady() ? 'Replace media' : 'Choose media'}</button></div>` : '');
        panel.querySelectorAll('[data-source]').forEach(btn => btn.addEventListener('click', () => applySourceChoice(btn.dataset.source)));
        $('wizardSourceAction')?.addEventListener('click', sourceAction);
    }

    function renderPreview() {
        const st = window.state || {};
        const media = window.kefeMedia || {};
        const labels = { uploaded: 'Audio file', video: 'Background video', none: 'No audio' };
        const rows = [
            ['Format', PATH_LABELS[wizard.choice] || '—'],
            ['Source', labels[st.audioSource?.master] || (wizard.source === 'media' ? 'Background video' : wizard.source === 'none' ? 'No audio' : 'Audio file')]
        ];
        if (wizard.choice === 'visualiser') rows.push(['Text', 'None — clean visuals']);
        else if (wizard.choice === 'captioned') rows.push(['Captions', st.captions?.lines?.length ? `${st.captions.lines.length} segments` : 'Not generated']);
        else rows.push(['Lyrics', st.lyrics?.lines?.length ? `${st.lyrics.lines.length} lines` : 'Loaded']);
        rows.push(['Effect', st.style?.effect || 'Apple']);
        rows.push(['Visual FX', st.style?.visualFx && st.style.visualFx !== 'none' ? st.style.visualFx : 'Off']);
        rows.push(['Background', media.video ? 'Video' : media.image ? 'Image' : `Solid ${st.background?.solid || '#0A0A0A'}`]);
        rows.push(['Title intro', st.style?.titleCardEnabled === false ? 'Off' : 'On']);
        panel.innerHTML = '<p class="wizard-panel-kicker">Preview</p>' +
            '<h3 class="wizard-panel-title">Your video is ready to review</h3>' +
            '<p class="wizard-panel-hint">Play it once. If everything looks right, continue to export.</p>' +
            '<div class="wizard-summary">' + rows.map(([k, v]) => `<div class="wizard-summary-row"><span>${k}</span><strong>${v}</strong></div>`).join('') + '</div>' +
            '<button type="button" id="wizardPlayBtn" class="primary full-width">Play full preview</button>';
        $('wizardPlayBtn').addEventListener('click', () => $('playBtn')?.click());
    }

    function applyStep() {
        const steps = stepsFor();
        const step = steps[wizard.index] || 'preview';
        body.dataset.wizardStep = step;
        document.querySelectorAll('.wizard-current').forEach(el => el.classList.remove('wizard-current'));
        if ((step === 'preview' || step === 'review') && previewEl) {
            previewEl.classList.remove('preview-collapsed');
            previewEl.classList.add('preview-expanded');
        }
        if (step === 'captions' && window.kefeCaptionGen) {
            window.kefeCaptionGen.refreshReview?.();
            window.kefeCaptionGen.syncGenerateButton?.();
        }

        const targetIds = targetsForStep(step);
        let firstTarget = null;
        if (targetIds.length) {
            panel.innerHTML = '';
            targetIds.forEach(id => {
                const el = $(id);
                if (el) {
                    el.classList.add('wizard-current');
                    if (!firstTarget) firstTarget = el;
                }
            });
        } else {
            if (step === 'intro') renderIntro();
            else if (step === 'source') renderSource();
            else if (step === 'preview') renderPreview();
            else panel.innerHTML = '';
            firstTarget = panel;
        }

        if (firstTarget && firstTarget !== panel) {
            stepHeading.textContent = STEP_TITLES[step] || step;
            firstTarget.prepend(stepHeading);
        } else {
            stepHeading.remove();
        }

        $('wizardProgress').textContent = `${pad(wizard.index + 1)} / ${pad(steps.length)}`;
        $('wizardStepLabel').textContent = STEP_LABELS[step] || '';
        $('wizardBackBtn').disabled = wizard.index === 0;
        const next = $('wizardNextBtn');
        next.textContent = step === 'preview' ? 'Continue to export' : step === 'review' ? 'Export' : 'Next';
        next.disabled = !nextEnabled(step);
        if (firstTarget) {
            firstTarget.setAttribute('tabindex', '-1');
            firstTarget.focus({ preventScroll: true });
        }
    }

    function refreshNextState() {
        const step = stepsFor()[wizard.index];
        const b = $('wizardNextBtn');
        if (step && b) b.disabled = !nextEnabled(step);
    }

    function finishWizard() {
        clearTimeout(fadeTimer);
        sidebar.classList.remove('wizard-fading');
        stepHeading.remove();
        nav.remove();
        panel.remove();
        document.querySelectorAll('.wizard-current').forEach(el => el.classList.remove('wizard-current'));
        body.classList.remove('wizard-mode', 'wizard-src-audio', 'wizard-src-media');
        delete body.dataset.wizardStep;
        document.querySelectorAll('.section-nav-link').forEach(link => link.classList.toggle('active', link.dataset.nav === 'export'));
        document.querySelectorAll('.sidebar .section').forEach(s => s.classList.toggle('active', s.id === 'exportSection'));
        $('exportSection')?.scrollIntoView({ block: 'start', behavior: reducedMotion ? 'auto' : 'smooth' });
    }

    function goTo(index) {
        const steps = stepsFor();
        if (index < 0 || index >= steps.length) return;
        wizard.index = index;
        if (reducedMotion) return applyStep();
        sidebar.classList.add('wizard-fading');
        clearTimeout(fadeTimer);
        fadeTimer = setTimeout(() => {
            applyStep();
            sidebar.classList.remove('wizard-fading');
        }, 150);
    }

    $('wizardBackBtn').addEventListener('click', () => goTo(wizard.index - 1));
    $('wizardNextBtn').addEventListener('click', () => {
        const step = stepsFor()[wizard.index];
        if (!nextEnabled(step)) return;
        if (step === 'review') return finishWizard();
        goTo(wizard.index + 1);
    });
    $('wizardSkipBtn').addEventListener('click', finishWizard);

    sidebar.addEventListener('input', refreshNextState);
    sidebar.addEventListener('change', refreshNextState);
    sidebar.addEventListener('click', () => setTimeout(refreshNextState, 0));
    applyStep();
})();
