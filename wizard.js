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

    // ----- Locked paths per project type -----
    const PATHS = {
        lyric: ['intro', 'source', 'text', 'fx', 'background', 'title', 'preview', 'review'],
        visualiser: ['intro', 'source', 'fx', 'background', 'title', 'preview', 'review'],
        title: ['intro', 'source', 'titletext', 'background', 'animation', 'preview', 'review']
    };
    const PATH_LABELS = { lyric: 'Lyric Video', visualiser: 'Visualiser', title: 'Title Intro' };
    const PATH_HINTS = {
        lyric: 'Timed lyrics synced to your own audio, styled with KEFE effects.',
        visualiser: 'Audio-reactive visuals for your track — no timed text.',
        title: 'A short animated title card for intros, reels and promos.'
    };
    const STEP_TITLES = {
        intro: 'What are you making?', source: 'Source', text: 'Lyrics & Captions',
        fx: 'Visual FX', background: 'Background', title: 'Title Card',
        titletext: 'Title & Text', animation: 'Animation', preview: 'Preview', review: 'Export Review'
    };

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
            case 'title': return ['titleSection'];
            case 'titletext': return ['audioSection', 'titleSection'];
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

    function applyStep() {
        const steps = PATHS[wizard.path];
        const step = steps[wizard.index] || 'preview';
        body.dataset.wizardStep = step;

        document.querySelectorAll('.wizard-current').forEach(el => el.classList.remove('wizard-current'));
        body.classList.toggle('wizard-src-audio', step === 'source' && wizard.source === 'uploaded');
        body.classList.toggle('wizard-src-media', step === 'source' && wizard.source === 'media');
        body.classList.toggle('wizard-titletext', step === 'titletext');

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
        lyric: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 11h16M4 16h10"/></svg>',
        visualiser: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4"/></svg>',
        title: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M8 10h8M10 14h4"/></svg>'
    };

    function renderPanel(step) {
        if (step === 'intro') return renderIntro();
        if (step === 'source') return renderSource();
        if (step === 'preview') return renderPreview();
        panel.innerHTML = '';
    }

    function renderIntro() {
        panel.innerHTML = [
            '<h3 class="wizard-panel-title">What are you making?</h3>',
            '<p class="wizard-panel-hint">Pick a starting point — you can fine-tune everything before export.</p>',
            '<div class="wizard-choices">',
            ['lyric', 'visualiser', 'title'].map(key => [
                `<button type="button" class="wizard-choice${wizard.choice === key ? ' selected' : ''}" data-choice="${key}">`,
                CHOICE_ICONS[key],
                `<strong>${PATH_LABELS[key]}</strong>`,
                `<span>${PATH_HINTS[key]}</span>`,
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
            panel.querySelectorAll('.wizard-choice').forEach(c => c.classList.toggle('selected', c.dataset.choice === choice));
            $('wizardNextBtn').disabled = false;
        }));
    }

    function renderSource() {
        if (wizard.source === 'none' || wizard.source === 'colour') {
            panel.innerHTML = [
                '<h3 class="wizard-panel-title">Source</h3>',
                `<p class="wizard-panel-note">${wizard.source === 'none'
                    ? 'Muted visuals — no audio will be heard or exported. The timeline follows your timed text.'
                    : 'A clean colour background — no upload needed. You can add media later in the editor.'}</p>`,
                '<button type="button" id="wizardChangeSource">Choose a different source</button>'
            ].join('');
            $('wizardChangeSource').addEventListener('click', () => { wizard.source = null; applyStep(); });
            return;
        }
        const isTitle = wizard.choice === 'title';
        const options = isTitle
            ? [['media', 'Image or video', 'Upload a backdrop from this device.'],
               ['colour', 'Plain colour', 'No upload needed — start from a colour.']]
            : [['uploaded', 'Audio file', 'I have an audio track on this device.'],
               ['none', 'No audio', 'Silent visuals — the timeline runs muted.']];
        panel.innerHTML = [
            '<h3 class="wizard-panel-title">Source</h3>',
            `<p class="wizard-panel-hint">${isTitle ? 'Where does your intro backdrop come from?' : 'Where does your audio come from?'}</p>`,
            '<div class="wizard-choices">',
            options.map(([value, label, hint]) => [
                `<button type="button" class="wizard-choice${wizard.source === value ? ' selected' : ''}" data-source="${value}">`,
                `<strong>${label}</strong><span>${hint}</span></button>`
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
        if (typeof window.applyMasterSelection === 'function') {
            try {
                if (source === 'none') window.applyMasterSelection('none', { userInitiated: true, silent: true });
                if (source === 'uploaded') window.applyMasterSelection('uploaded', { userInitiated: false, silent: true });
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
            ['Audio source', master],
            ['Lyric effect', st.style?.effect || 'apple'],
            ['Visual FX', fx],
            ['Background', bg],
            ['Title card', st.style?.titleCardEnabled === false ? 'Off' : 'On']
        ];
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
        body.classList.remove('wizard-mode', 'wizard-src-audio', 'wizard-src-media', 'wizard-titletext');
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
        const steps = PATHS[wizard.path];
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
        const step = PATHS[wizard.path][wizard.index];
        if (!nextEnabled(step)) return;
        if (step === 'preview') { finishWizard(); return; }
        goTo(wizard.index + 1);
    });
    $('wizardSkipBtn').addEventListener('click', finishWizard);

    applyStep();
})();
