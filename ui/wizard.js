/* KEFE guided creation workflow.
   Locks the app into a step-by-step flow (one decision at a time) and reuses the
   existing editor sections/controls — nothing is duplicated, and at Export Review
   the complete editor is revealed with Save/Open Project and Export Video intact. */
(() => {
    'use strict';
    const $ = id => document.getElementById(id);
    const body = document.body;
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar || $('wizardSection')) return;

    const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pad = n => String(n).padStart(2, '0');

    body.classList.add('wizard-mode');

    // ----- Preview toggle -----
    // Replace the preview with a slim toggle bar so the setup
    // questions fill the screen. Tap the bar to expand the preview
    // as a half-screen overlay; tap again to collapse it.
    const previewEl = document.getElementById('previewSection');
    if (previewEl) {
        previewEl.classList.add('preview-collapsed');
        const toggleBar = document.createElement('button');
        toggleBar.type = 'button';
        toggleBar.className = 'preview-toggle';
        toggleBar.setAttribute('aria-label', 'Toggle preview');
        toggleBar.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 10h20" stroke="currentColor" stroke-width="1.5" fill="none"/></svg> Preview';
        toggleBar.addEventListener('click', () => {
            const isExpanded = previewEl.classList.toggle('preview-expanded');
            previewEl.classList.toggle('preview-collapsed', !isExpanded);
            toggleBar.setAttribute('aria-pressed', String(isExpanded));
        });
        sidebar.appendChild(toggleBar);
    }

    // ----- Locked paths per project type -----
    const PATHS = {
        lyric: ['intro', 'source', 'text', 'fx', 'background', 'preview', 'review'],
        visualiser: ['intro', 'source', 'fx', 'background', 'preview', 'review'],
        captioned: ['intro', 'source', 'captionsgen', 'captionsreview', 'fx', 'background', 'preview', 'review'],
        custom: ['intro', 'source', 'text', 'fx', 'background', 'preview', 'review']
    };
    const PATH_LABELS = { lyric: 'Lyric Video', visualiser: 'Visualiser', captioned: 'Captioned Video', custom: 'Custom' };
    const PATH_HINTS = {
        lyric: 'Words on screen, synced to your song — the classic lyric video.',
        visualiser: 'Music-driven motion, no lyrics — pure audio-reactive visuals.',
        captioned: 'Spoken words turned into timed captions — podcasts, speeches, voice notes.',
        custom: 'Start blank and combine audio, text, and effects however you like.'
    };
    const STEP_TITLES = {
        intro: 'What are you making?', source: 'Source', text: 'Lyrics & Captions',
        fx: 'Visual FX', background: 'Background',
        preview: 'Preview', review: 'Export Review',
        captionsgen: 'Generate Captions', captionsreview: 'Caption Review'
    };
    const STEP_HINTS = {
        intro: 'Tell us what you have and we will build the rest around it.',
        source: 'Where does the sound come from?',
        text: 'Type or paste the words you want on screen.',
        fx: 'Pick the motion that matches your track.',
        background: 'Choose what sits behind the text.',
        preview: 'Play it back and check the timing.',
        review: 'One last look before export.'
    };

    // The Caption Generator sections are created by caption-generator.js; skip
    // its steps defensively if that module did not boot.
    function stepsFor() {
        const base = PATHS[wizard.path] || PATHS.lyric;
        return base.filter(step => {
            if (step === 'captionsgen') return Boolean($('captionGenSection'));
            if (step === 'captionsreview') return Boolean($('captionReviewSection'));
            return true;
        });
    }

    const wizard = { path: 'lyric', index: 0, choice: null, source: null };

    // The working Visual FX section is created at runtime by effects/effect-app-fx.js;
    // the static #fxSection grid is legacy fallback.
    function fxSectionId() {
        const el = $('visualFxSection') || $('fxSection');
        return el ? el.id : null;
    }

    function targetsForStep(step) {
        if (step === 'source') {
            if (wizard.source === 'uploaded') return ['audioSection'];
            if (wizard.source === 'media') return ['backgroundSection'];
            return [];
        }
        switch (step) {
            case 'text': return ['textSection'];
            case 'fx':
            case 'animation': return [fxSectionId()].filter(Boolean);
            case 'background': return ['backgroundSection'];
            case 'captionsgen': return ['captionGenSection'];
            case 'captionsreview': return ['captionReviewSection'];
            default: return [];
        }
    }

    // ----- Wizard chrome -----
    const panel = document.createElement('div');
    panel.className = 'section wizard-panel';
    panel.id = 'wizardSection';
    sidebar.insertBefore(panel, sidebar.firstChild);

    const nav = document.createElement('div');
    nav.className = 'wizard-nav';
    nav.id = 'wizardNav';
    nav.innerHTML = [
        '<button type="button" id="wizardBackBtn" class="wizard-back" disabled>Back</button>',
        '<div class="wizard-progress-wrap">',
        '<div id="wizardProgress" class="wizard-progress" aria-live="polite">01 / 08</div>',
        '<button type="button" id="wizardSkipBtn" class="wizard-skip">Skip setup</button>',
        '</div>',
        '<button type="button" id="wizardNextBtn" class="primary wizard-next">Next</button>'
    ].join('');
    sidebar.appendChild(nav);

    const stepHeading = document.createElement('div');
    stepHeading.className = 'wizard-step-heading';

    let fadeTimer = null;

    // ----- Step gating -----
    // Next is enabled only when the current step has the required selection or
    // input. Optional styling steps (Visual FX, Background, Title, Animation)
    // and Preview are always passable — "Off"/defaults are valid choices there.
    function hasLoadedAudio() {
        const audio = window.state?.audio;
        return Boolean(audio && (audio.file || audio.ready || audio.duration > 0));
    }

    function sourceReady() {
        if (!wizard.source) return false;
        if (wizard.source === 'none') return true;
        const media = window.kefeMedia || {};
        if (wizard.source === 'uploaded') return hasLoadedAudio() || Boolean(media.videoFile);
        if (wizard.source === 'media') return Boolean(media.image || media.video || media.videoFile);
        return true;
    }

    function lyricsReady() {
        if (window.state?.lyrics?.lines?.length) return true;
        const textarea = $('lyricsText'); // unsaved text in the lyrics editor also counts
        return Boolean(textarea && textarea.value.trim());
    }

    function captionsReady() {
        if (window.kefeCaptionGen?.isBusy?.()) return false; // wait while transcribing
        return Boolean(window.state?.captions?.lines?.length);
    }

    function nextEnabled(step) {
        switch (step) {
            case 'intro': return Boolean(wizard.choice);
            case 'source': return sourceReady();
            case 'text': return lyricsReady();
            case 'captionsgen':
            case 'captionsreview': return captionsReady();
            default: return true; // fx / animation / background / title / titletext / preview
        }
    }

    // Keep the Next button in sync while the user works inside a step (file
    // uploads, lyric edits, async caption generation, source re-choice…).
    // The sidebar is observed because caption generation finishes without any
    // event wizard.js can listen to — it only mutates the DOM.
    let nextRefreshQueued = false;
    function refreshNextState() {
        if (nextRefreshQueued) return;
        nextRefreshQueued = true;
        setTimeout(() => {
            nextRefreshQueued = false;
            const step = stepsFor()[wizard.index];
            const btn = $('wizardNextBtn');
            if (!step || !btn) return;
            btn.disabled = !nextEnabled(step);
        }, 0);
    }

    function applyStep() {
        const steps = stepsFor();
        const step = steps[wizard.index] || 'preview';
        body.dataset.wizardStep = step;
        // Restore the preview canvas once the user reaches the
        // Preview / Export Review step so they can see the result.
        if ((step === 'preview' || step === 'review') && previewEl) {
            previewEl.classList.remove('preview-collapsed');
            previewEl.classList.add('preview-expanded');
        }
        if (step === 'captionsreview' && window.kefeCaptionGen) window.kefeCaptionGen.refreshReview();
        if (step === 'captionsgen' && window.kefeCaptionGen) window.kefeCaptionGen.syncGenerateButton();

        document.querySelectorAll('.wizard-current').forEach(el => el.classList.remove('wizard-current'));
        body.classList.toggle('wizard-src-audio', step === 'source' && wizard.source === 'uploaded');
        body.classList.toggle('wizard-src-media', step === 'source' && wizard.source === 'media');

        const targetIds = targetsForStep(step);
        let firstTarget = null;
        if (targetIds.length) {
            targetIds.forEach(id => {
                const el = $(id);
                if (el) { el.classList.add('wizard-current'); if (!firstTarget) firstTarget = el; }
            });
            panel.innerHTML = '';
        } else {
            renderPanel(step);
            firstTarget = panel;
        }
        panel.classList.toggle('wizard-current', !targetIds.length);

        if (firstTarget && firstTarget !== panel) {
            stepHeading.textContent = STEP_TITLES[step] || '';
            if (step === 'source' && wizard.source) {
                const change = document.createElement('button');
                change.type = 'button';
                change.className = 'wizard-change-source';
                change.textContent = 'Change source';
                change.addEventListener('click', () => { wizard.source = null; applyStep(); });
                stepHeading.appendChild(change);
            }
            firstTarget.prepend(stepHeading);
        } else {
            stepHeading.remove();
        }

        $('wizardProgress').textContent = `${pad(wizard.index + 1)} / ${pad(steps.length)}`;
        $('wizardBackBtn').disabled = wizard.index === 0;
        const nextBtn = $('wizardNextBtn');
        nextBtn.textContent = step === 'preview' ? 'Export Review' : 'Next';
        nextBtn.disabled = !nextEnabled(step);

        if (firstTarget) {
            firstTarget.scrollIntoView({ block: 'nearest', behavior: 'auto' });
            // Keyboard users land at the top of the new step (no stale focus from the old one).
            firstTarget.setAttribute('tabindex', '-1');
            firstTarget.focus({ preventScroll: true });
        }
    }

    // ----- Panel renderers (intro / source decision / preview) -----
    const CHOICE_ICONS = {
        lyric: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 11h16M4 16h10"/><circle cx="18.2" cy="17.4" r="2.6"/><path d="M20.8 17.4V8.2l-2.6.9"/></svg>',
        visualiser: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4"/></svg>',
        captioned: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M10.5 10.5a2.5 2.5 0 1 0 0 3M17 10.5a2.5 2.5 0 1 0 0 3"/></svg>',
        custom: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M5 12h9M5 17h12"/><circle cx="18.6" cy="12" r="2.1"/></svg>'
    };

    function renderPanel(step) {
        if (step === 'intro') return renderIntro();
        if (step === 'source') return renderSource();
        if (step === 'preview') return renderPreview();
        panel.innerHTML = '';
    }

    function renderIntro() {
        panel.innerHTML = [
            '<p class="wizard-panel-kicker">Getting started</p>',
            '<h3 class="wizard-panel-title">What are you making?</h3>',
            '<p class="wizard-panel-hint">Tell us what you have — we will build the rest around it.</p>',
            '<div class="wizard-choices">',
            ['lyric', 'visualiser', 'captioned', 'custom'].map(key => [
                `<button type="button" class="wizard-choice${wizard.choice === key ? ' selected' : ''}" data-choice="${key}">`,
                `<span class="wizard-choice-icon">${CHOICE_ICONS[key]}</span>`,
                '<span class="wizard-choice-copy">',
                `<strong>${PATH_LABELS[key]}</strong>`,
                `<span>${PATH_HINTS[key]}</span>`,
                '</span>',
                '</button>'
            ].join('')),
            '</div>'
        ].join('');
        panel.querySelectorAll('[data-choice]').forEach(btn => btn.addEventListener('click', () => {
            const choice = btn.dataset.choice;
            if (wizard.choice !== choice) wizard.source = null; // sources differ per project type
            wizard.choice = choice;
            wizard.path = choice;
            wizard.index = Math.min(wizard.index, PATHS[choice].length - 1);
            // The final selected type decides what actually renders (lyrics,
            // captions or a clean text-free visualiser).
            if (typeof window.kefeSetProjectType === 'function') window.kefeSetProjectType(choice);
            panel.querySelectorAll('.wizard-choice').forEach(c => c.classList.toggle('selected', c.dataset.choice === choice));
            $('wizardNextBtn').disabled = false;
        }));
    }

    function renderSource() {
        if (wizard.source === 'none') {
            panel.innerHTML = [
                '<h3 class="wizard-panel-title">Audio source</h3>',
                '<p class="wizard-panel-note">Muted visuals — no audio will be heard or exported. The timeline follows your timed text.</p>',
                '<button type="button" id="wizardChangeSource">Choose a different source</button>'
            ].join('');
            $('wizardChangeSource').addEventListener('click', () => { wizard.source = null; applyStep(); });
            return;
        }
        const isCaptioned = wizard.choice === 'captioned';
        const options = isCaptioned
            ? [['uploaded', 'Voice recording or music', 'Upload an audio file — its speech becomes the captions.'],
               ['media', 'Video clip', 'Upload a video — its sound gets transcribed into timed captions.']]
            : wizard.choice === 'visualiser'
            ? [['uploaded', 'Your track', 'Upload the audio file you want to visualise.'],
               ['media', 'Video clip', 'Upload a video — its own audio becomes the soundtrack.'],
               ['none', 'No audio', 'Silent visuals — the timeline runs muted.']]
            : [['uploaded', 'Your track', 'Upload the audio file your lyrics will sync to.'],
               ['media', 'Video clip', 'Upload a video — its own audio becomes the soundtrack.'],
               ['none', 'No audio', 'Silent visuals — the timeline runs muted.']];
        panel.innerHTML = [
            '<h3 class="wizard-panel-title">Audio source</h3>',
            `<p class="wizard-panel-hint">${isCaptioned ? 'Where does your recording come from? Its speech becomes the captions.' : 'Where does the audio come from?'}</p>`,
            '<div class="wizard-choices">',
            options.map(([value, label, hint]) => [
                `<button type="button" class="wizard-choice${wizard.source === value ? ' selected' : ''}" data-source="${value}">`,
                `<strong>${label}</strong>`,
                `<span>${hint}</span>`,
                '</button>'
            ].join('')),
            '</div>'
        ].join('');
        panel.querySelectorAll('[data-source]').forEach(btn => btn.addEventListener('click', () => {
            applySourceChoice(btn.dataset.source);
        }));
    }

    // The wizard decides where content/audio comes from BEFORE upload controls appear;
    // the master source is applied through the app's own selection logic.
    function applySourceChoice(source) {
        wizard.source = source;
        window.kefeWizardSource = source;
        const st = window.state;
        if (typeof window.applyMasterSelection === 'function') {
            try {
                if (source === 'none') window.applyMasterSelection('none', { userInitiated: true, silent: true });
                if (source === 'uploaded') window.applyMasterSelection('uploaded', { userInitiated: false, silent: true });
                if (source === 'media') {
                    // Background Video as the AUDIO source: once a video with an
                    // audio track is uploaded, its audio becomes the master. Allow
                    // the automatic selection to take over, and apply immediately
                    // if a suitable video is already loaded.
                    if (st?.audioSource) st.audioSource.userChosen = false;
                    const m = window.kefeMedia || {};
                    if (m.video && m.videoFile && m.videoHasAudio) {
                        window.applyMasterSelection('video', { userInitiated: false, silent: true });
                    }
                }
            } catch (e) { /* non-fatal: source can still be changed in the editor */ }
        }
        applyStep();
    }

    function renderPreview() {
        const st = window.state || {};
        const mediaCache = window.kefeMedia || {};
        const masterLabels = { uploaded: 'Uploaded audio', video: 'Background video audio', none: 'No audio (muted)' };
        const master = masterLabels[st.audioSource?.master] || 'Uploaded audio';
        const bg = mediaCache.image ? 'Image background' : mediaCache.video ? 'Video background' : `Solid ${st.background?.solid || '#0A0A0A'}`;
        const fx = st.style?.visualFx && st.style.visualFx !== 'none' ? st.style.visualFx : 'Off';
        const rows = [
            ['Project', PATH_LABELS[wizard.choice] || '—'],
            ['Audio source', master]
        ];
        if (wizard.choice === 'visualiser') {
            rows.push(['Timed text', 'None — clean visuals']);
        } else {
            rows.push(['Lyric effect', st.style?.effect || 'apple']);
        }
        rows.push(
            ['Visual FX', fx],
            ['Background', bg],
            ['Title intro', st.style?.titleCardEnabled === false ? 'Off' : 'On']
        );
        if (wizard.choice === 'captioned') {
            rows.splice(3, 0, ['Captions', st.captions?.lines?.length ? `${st.captions.lines.length} generated segments` : 'Not generated yet']);
        }
        panel.innerHTML = [
            '<h3 class="wizard-panel-title">Preview</h3>',
            '<p class="wizard-panel-hint">Watch it in the live canvas — then continue to Export Review, where everything stays editable.</p>',
            '<div class="wizard-summary">',
            rows.map(([k, v]) => `<div class="wizard-summary-row"><span>${k}</span><strong>${v}</strong></div>`).join(''),
            '</div>',
            '<button type="button" id="wizardPlayBtn" class="primary full-width">Play preview</button>'
        ].join('');
        $('wizardPlayBtn').addEventListener('click', () => { $('playBtn')?.click(); });
    }

    // ----- Export Review: reveal the COMPLETE editor -----
    function finishWizard() {
        clearTimeout(fadeTimer);
        sidebar.classList.remove('wizard-fading');
        stepHeading.remove();
        nav.remove();
        panel.remove();
        document.querySelectorAll('.wizard-current').forEach(el => el.classList.remove('wizard-current'));
        body.classList.remove('wizard-mode', 'wizard-src-audio', 'wizard-src-media');
        delete body.dataset.wizardStep;
        // Highlight Export in the section nav, matching the in-app nav behaviour.
        document.querySelectorAll('.section-nav-link').forEach(link => {
            link.classList.toggle('active', link.dataset.nav === 'export');
        });
        document.querySelectorAll('.sidebar .section').forEach(section => {
            section.classList.toggle('active', section.id === 'exportSection');
        });
        const exportSection = $('exportSection');
        if (exportSection) exportSection.scrollIntoView({ block: 'start', behavior: reducedMotion ? 'auto' : 'smooth' });
        if (typeof window.toast === 'function') {
            try { window.toast('Export Review — the full editor is unlocked. Inspect everything, then export.', 'success'); } catch (e) { /* non-fatal */ }
        }
    }

    // ----- Navigation wiring -----
    function goTo(index) {
        const steps = stepsFor();
        if (index < 0 || index >= steps.length) return;
        if (index === wizard.index) { applyStep(); return; }
        wizard.index = index;
        if (reducedMotion) { applyStep(); return; }
        // Fast fade-out → swap step → fade-in.
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
        if (step === 'preview') { finishWizard(); return; }
        goTo(wizard.index + 1);
    });
    $('wizardSkipBtn').addEventListener('click', finishWizard);

    // Live re-evaluation of the Next button as the user completes the current
    // step's requirement (upload, lyrics, generated captions, choice clicks).
    new MutationObserver(refreshNextState).observe(sidebar, { childList: true, subtree: true, characterData: true });
    sidebar.addEventListener('input', refreshNextState);
    sidebar.addEventListener('change', refreshNextState);
    sidebar.addEventListener('click', refreshNextState);

    applyStep();
})();
