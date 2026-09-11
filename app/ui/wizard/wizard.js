/* KEFE guided creation workflow — single wizard entry point and controller. */
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
    if (previewEl) previewEl.id = 'previewSection';

    const PATHS = {
        lyric: ['intro', 'source', 'lyrics', 'style', 'background', 'preview', 'export'],
        visualiser: ['intro', 'source', 'style', 'background', 'preview', 'export'],
        captioned: ['intro', 'source', 'captions', 'style', 'background', 'preview', 'export'],
        custom: ['intro', 'source', 'lyrics', 'style', 'background', 'preview', 'export']
    };
    const PATH_LABELS = { lyric: 'Lyric Video', visualiser: 'Visualiser', captioned: 'Captioned Video', custom: 'Custom' };
    const PATH_HINTS = { lyric: 'Synced lyrics with expressive motion.', visualiser: 'Audio-reactive visuals with no lyrics.', captioned: 'Timed captions for spoken audio or video.', custom: 'Build the video your way.' };
    const STEP_TITLES = { lyrics: 'Add your lyrics', captions: 'Create your captions', style: 'Choose your look', background: 'Choose your background', export: 'Export your video' };
    const STEP_LABELS = { intro: 'Format', source: 'Media', lyrics: 'Lyrics', captions: 'Captions', style: 'Style', background: 'Background', preview: 'Preview', export: 'Export' };
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
    const destroyIntroVeil = () => window.KefeDarkVeil?.destroy?.();
    const isNightTheme = () => document.documentElement.dataset.theme === 'night' || (!document.documentElement.dataset.theme && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
    const stepsFor = () => PATHS[wizard.path] || PATHS.lyric;

    const panel = document.createElement('div');
    panel.className = 'section wizard-panel';
    panel.id = 'wizardSection';
    sidebar.insertBefore(panel, sidebar.firstChild);

    const nav = document.createElement('div');
    nav.className = 'wizard-nav';
    nav.id = 'wizardNav';
    nav.innerHTML = '<button type="button" id="wizardBackBtn" class="wizard-back" disabled>Back</button><div class="wizard-progress-wrap"><div id="wizardProgress" class="wizard-progress">01 / 07</div><span id="wizardStepLabel" class="wizard-step-label">Format</span><button type="button" id="wizardSkipBtn" class="wizard-skip">Skip setup</button></div><button type="button" id="wizardNextBtn" class="primary wizard-next">Next</button>';
    sidebar.appendChild(nav);
    const stepHeading = document.createElement('div');
    stepHeading.className = 'wizard-step-heading';
    let fadeTimer = null;

    function hasLoadedAudio() { const a = window.state?.audio; return Boolean(a && (a.file || a.ready || a.duration > 0)); }
    function sourceReady() {
        if (!wizard.source) return false;
        if (wizard.source === 'none') return true;
        const m = window.kefeMedia || {};
        return wizard.source === 'uploaded' ? hasLoadedAudio() : Boolean(m.image || m.video || m.videoFile);
    }
    function lyricsReady() { if (window.state?.lyrics?.lines?.length) return true; const t = $('lyricsText'); return Boolean(t && t.value.trim()); }
    function captionsReady() { if (window.kefeCaptionGen?.isBusy?.()) return false; return Boolean(window.state?.captions?.lines?.length); }
    function nextEnabled(step) {
        if (step === 'intro') return Boolean(wizard.choice);
        if (step === 'source') return sourceReady();
        if (step === 'lyrics') return lyricsReady();
        if (step === 'captions') return captionsReady();
        return true;
    }
    function targetsForStep(step) {
        if (step === 'lyrics') return ['textSection'];
        if (step === 'captions') return ['textSection'];
        if (step === 'style') return [];
        if (step === 'background') return ['backgroundSection'];
        if (step === 'export') return ['exportSection'];
        return [];
    }
    function sourceStatus() {
        if (wizard.source === 'uploaded') return hasLoadedAudio() ? 'Audio loaded' : 'Choose your audio file.';
        if (wizard.source === 'media') { const m = window.kefeMedia || {}; return m.videoFile ? 'Background video loaded' : m.image ? 'Background image loaded' : 'Choose an image or video.'; }
        return 'Silent project — no audio will be exported.';
    }
    function chooseSourceMedia() { if (wizard.source === 'uploaded') $('audioChooseBtn')?.click(); if (wizard.source === 'media') $('backgroundInput')?.click(); }
    function applySourceChoice(source) {
        wizard.source = source; window.kefeWizardSource = source; const st = window.state;
        if (typeof window.applyMasterSelection === 'function') {
            try {
                if (source === 'none') window.applyMasterSelection('none', { userInitiated: true, silent: true });
                if (source === 'uploaded') window.applyMasterSelection('uploaded', { userInitiated: false, silent: true });
                if (source === 'media') { if (st?.audioSource) st.audioSource.userChosen = false; const m = window.kefeMedia || {}; if (m.video && m.videoFile && m.videoHasAudio) window.applyMasterSelection('video', { userInitiated: false, silent: true }); }
            } catch (e) {}
        }
        renderSource(); refreshNextState();
    }
    function renderSource() {
        const options = wizard.choice === 'captioned'
            ? [['uploaded', 'Audio file', 'Use a music track or voice recording.'], ['media', 'Background video', 'Use a video and its soundtrack.']]
            : [['uploaded', 'Audio file', 'Use an MP3, WAV or M4A track.'], ['media', 'Background video', 'Use a video as the visual background and its soundtrack.'], ['none', 'No audio', 'Create silent visuals.']];
        panel.innerHTML = '<p class="wizard-panel-kicker">02 · Media</p><h3 class="wizard-panel-title">What are you starting with?</h3><p class="wizard-panel-hint">Pick your source. KEFE will carry it through the rest of the project.</p><div class="wizard-choices wizard-source-choices">' + options.map(([v,l,h]) => `<button type="button" class="wizard-choice${wizard.source === v ? ' selected' : ''}" data-source="${v}"><span class="wizard-choice-visual"><span class="wizard-choice-icon">${SOURCE_ICONS[v]}</span><span class="wizard-choice-lines"></span></span><span class="wizard-choice-copy"><strong>${l}</strong><span>${h}</span></span></button>`).join('') + '</div>' + (wizard.source ? `<div class="wizard-source-action"><strong>${sourceStatus()}</strong><button type="button" id="wizardSourceAction" class="file-button">${sourceReady() ? 'Replace media' : 'Choose media'}</button></div>` : '') + '<div id="wizardMetadataMount"></div><p class="music-sync-hint">Enter the artist and title to find synced lyrics when the file has no metadata.</p>';
        const metadataMount = $('wizardMetadataMount');
        const metadataBlock = document.querySelector('#audioSection .music-details');
        if (metadataMount && metadataBlock) metadataMount.appendChild(metadataBlock);
        panel.querySelectorAll('[data-source]').forEach(btn => btn.addEventListener('click', () => applySourceChoice(btn.dataset.source)));
        $('wizardSourceAction')?.addEventListener('click', chooseSourceMedia);
    }
    function renderIntro() {
        destroyIntroVeil();
        const veil = isNightTheme() ? '<div class="wizard-dark-veil" aria-hidden="true"></div>' : '';
        panel.innerHTML = veil + '<p class="wizard-panel-kicker">01 · Start</p><h3 class="wizard-panel-title">What are you making?</h3><p class="wizard-panel-hint">Choose once. KEFE will build the right editing path for you.</p><div class="wizard-choices-wrap"><div class="wizard-choices">' + ['lyric','visualiser','captioned','custom'].map(k => `<button type="button" class="wizard-choice${wizard.choice === k ? ' selected' : ''}" data-choice="${k}"><span class="wizard-choice-visual"><span class="wizard-choice-icon">${CHOICE_ICONS[k]}</span><span class="wizard-choice-lines"></span></span><span class="wizard-choice-copy"><strong>${PATH_LABELS[k]}</strong><span>${PATH_HINTS[k]}</span></span></button>`).join('') + '</div></div>';
        const veilTarget = panel.querySelector('.wizard-dark-veil');
        if (veilTarget && window.KefeDarkVeil?.mount) {
            requestAnimationFrame(() => window.KefeDarkVeil.mount(veilTarget, {
                hueShift: 0,
                speed: reducedMotion ? 0 : 0.5,
                noiseIntensity: 0,
                scanlineIntensity: 0,
                scanlineFrequency: 0,
                warpAmount: 0,
                resolutionScale: 1
            }));
        }
        panel.querySelectorAll('[data-choice]').forEach(btn => btn.addEventListener('click', () => { const c = btn.dataset.choice; if (wizard.choice !== c) wizard.source = null; wizard.choice = c; wizard.path = c; wizard.index = 0; if (typeof window.kefeSetProjectType === 'function') window.kefeSetProjectType(c); panel.querySelectorAll('.wizard-choice').forEach(x => x.classList.toggle('selected', x.dataset.choice === c)); refreshNextState(); }));
    }
    function previewLineText() {
        const st = window.state || {};
        if (wizard.choice === 'visualiser') return 'FEEL THE MUSIC';
        const lines = st.lyrics?.lines || st.captions?.lines || [];
        const line = lines.find(x => x?.text)?.text || lines.find(x => x?.line)?.line || lines.find(x => x?.content)?.content;
        return String(line || 'This is your lyric preview');
    }
    function previewBackgroundMarkup() {
        const m = window.kefeMedia || {};
        if (m.video?.src) return `<video class="wizard-style-preview-media" src="${m.video.src}" muted loop autoplay playsinline aria-hidden="true"></video>`;
        if (m.image?.src) return `<img class="wizard-style-preview-media" src="${m.image.src}" alt="" aria-hidden="true">`;
        const solid = window.state?.background?.solid || '#0A0A0A';
        return `<div class="wizard-style-preview-solid" style="--wizard-preview-solid:${solid}"></div>`;
    }
    function renderStylePreview(effect) {
        const existing = panel.querySelector('.wizard-style-preview');
        if (!existing) return;
        const safeEffect = effect || 'apple';
        existing.dataset.effect = safeEffect;
        const line = existing.querySelector('.wizard-style-preview-line');
        if (line) line.textContent = previewLineText();
        existing.querySelector('.wizard-style-preview-media-wrap')?.replaceChildren(document.createRange().createContextualFragment(previewBackgroundMarkup()));
        if (!reducedMotion) {
            existing.classList.remove('is-animating');
            void existing.offsetWidth;
            existing.classList.add('is-animating');
        }
    }
    function renderStylePanel() {
        const styleBlock = document.querySelector('#lyricStyleBlock');
        const current = window.state?.style?.effect || 'apple';
        const stepNumber = stepsFor().indexOf('style') + 1;

        panel.innerHTML =
            '<p class="wizard-panel-kicker">' + pad(stepNumber) + ' · Style</p>' +
            '<h3 class="wizard-panel-title">Choose your look</h3>' +
            '<p class="wizard-panel-hint">Choose a lyric style and see the result immediately.</p>' +
            '<div class="wizard-style-preview" data-effect="' + current + '">' +
                '<div class="wizard-style-preview-media-wrap">' + previewBackgroundMarkup() + '</div>' +
                '<div class="wizard-style-preview-shade"></div>' +
                '<div class="wizard-style-preview-content">' +
                    '<span class="wizard-style-preview-eyebrow">KEFE · LIVE PREVIEW</span>' +
                    '<div class="wizard-style-preview-line">' + previewLineText() + '</div>' +
                    '<span class="wizard-style-preview-effect">' + current + '</span>' +
                '</div>' +
            '</div>' +
            '<div id="wizardStyleMount"></div>';

        const mount = $('wizardStyleMount');
        if (mount && styleBlock && wizard.choice !== 'visualiser') {
            mount.appendChild(styleBlock);
        }

        renderStylePreview(current);
    }

    function restoreStyleBlock() {
        const styleBlock = document.querySelector('#wizardStyleMount #lyricStyleBlock');
        const lyricsPanel = $('lyricsPanel');
        if (!styleBlock || !lyricsPanel) return;
        const syncBlock = $('lyricsOffset')?.closest('.sub-block');
        lyricsPanel.insertBefore(styleBlock, syncBlock || null);
    }

    function renderPreview() {
        const st = window.state || {}, media = window.kefeMedia || {}, labels = { uploaded: 'Audio file', video: 'Background video', none: 'No audio' };
        const rows = [['Format', PATH_LABELS[wizard.choice] || '—'], ['Source', labels[st.audioSource?.master] || (wizard.source === 'media' ? 'Background video' : wizard.source === 'none' ? 'No audio' : 'Audio file')]];
        if (wizard.choice === 'visualiser') rows.push(['Text', 'None — clean visuals']);
        else if (wizard.choice === 'captioned') rows.push(['Captions', st.captions?.lines?.length ? `${st.captions.lines.length} blocks` : 'Not added']);
        else rows.push(['Lyrics', st.lyrics?.lines?.length ? `${st.lyrics.lines.length} lines` : 'Not added']);
        rows.push(['Style', st.style?.effect || 'Apple']);
        rows.push(['Background', media.videoFile ? 'Uploaded video' : media.image ? 'Uploaded image' : st.background?.preset || 'Solid colour']);
        panel.innerHTML = '<p class="wizard-panel-kicker">' + pad(stepsFor().indexOf('preview') + 1) + ' · Preview</p><h3 class="wizard-panel-title">Review your video</h3><p class="wizard-panel-hint">Everything here is live. Go back to any step to change it.</p><div class="wizard-review-grid">' + rows.map(([k,v]) => `<div class="wizard-review-row"><span>${k}</span><strong>${v}</strong></div>`).join('') + '</div>';
        const preview = $('previewSection');
        if (preview) preview.classList.add('wizard-preview-active');
    }

    function renderExport() {
        const stepNumber = stepsFor().indexOf('export') + 1;
        panel.innerHTML = '<p class="wizard-panel-kicker">' + pad(stepNumber) + ' · Export</p><h3 class="wizard-panel-title">Export your video</h3><p class="wizard-panel-hint">Choose the format and quality below, then export when you are ready.</p><div class="wizard-export-summary"><strong>' + (PATH_LABELS[wizard.choice] || 'Video') + '</strong><span>Your project is ready for final export.</span></div>';
        const exportSection = $('exportSection');
        if (exportSection) exportSection.classList.add('wizard-export-active');
    }

    function syncTargets(step) {
        document.querySelectorAll('.sidebar > .section').forEach(section => section.classList.remove('wizard-current'));
        targetsForStep(step).forEach(id => $(id)?.classList.add('wizard-current'));
        const preview = $('previewSection');
        preview?.classList.toggle('wizard-current', step === 'preview');
    }

    function refreshNextState() {
        const step = stepsFor()[wizard.index];
        const next = $('wizardNextBtn');
        const back = $('wizardBackBtn');
        if (!next || !back) return;
        next.disabled = !nextEnabled(step);
        next.textContent = wizard.index === stepsFor().length - 1 ? 'Finish' : 'Next';
        back.disabled = wizard.index === 0;
        const progress = $('wizardProgress');
        const label = $('wizardStepLabel');
        if (progress) progress.textContent = `${pad(wizard.index + 1)} / ${pad(stepsFor().length)}`;
        if (label) label.textContent = STEP_LABELS[step] || step;
    }

    function applyStep() {
        const steps = stepsFor();
        const step = steps[wizard.index] || 'intro';
        body.dataset.wizardStep = step;
        syncTargets(step);
        if (step === 'intro') renderIntro();
        else if (step === 'source') renderSource();
        else if (step === 'lyrics' || step === 'captions') {
            const textSection = $('textSection');
            if (textSection) textSection.classList.add('wizard-current');
            if (step === 'lyrics') document.querySelector('[data-text-mode="lyrics"]')?.click();
            if (step === 'captions') document.querySelector('[data-text-mode="captions"]')?.click();
            panel.innerHTML = `<p class="wizard-panel-kicker">${pad(wizard.index + 1)} · ${STEP_LABELS[step]}</p><h3 class="wizard-panel-title">${STEP_TITLES[step]}</h3><p class="wizard-panel-hint">Use the editor below, then continue when your ${step === 'lyrics' ? 'lyrics' : 'captions'} are ready.</p>`;
        } else if (step === 'style') renderStylePanel();
        else if (step === 'background') {
            const backgroundSection = $('backgroundSection');
            if (backgroundSection) backgroundSection.classList.add('wizard-current');
            panel.innerHTML = `<p class="wizard-panel-kicker">${pad(wizard.index + 1)} · Background</p><h3 class="wizard-panel-title">${STEP_TITLES.background}</h3><p class="wizard-panel-hint">Choose a built-in background or upload your own image or video.</p>`;
        } else if (step === 'preview') renderPreview();
        else if (step === 'export') renderExport();
        refreshNextState();
        window.dispatchEvent(new CustomEvent('kefe:wizard-step', { detail: { step, index: wizard.index, path: wizard.path } }));
    }

    function finishWizard() {
        body.classList.remove('wizard-mode');
        body.removeAttribute('data-wizard-step');
        destroyIntroVeil();
        restoreStyleBlock();
        document.querySelectorAll('.sidebar > .section').forEach(section => section.classList.remove('wizard-current'));
        $('wizardSection')?.classList.add('wizard-finished');
        window.dispatchEvent(new CustomEvent('kefe:wizard-finished', { detail: { path: wizard.path } }));
    }

    $('wizardBackBtn').addEventListener('click', () => { if (wizard.index > 0) { wizard.index -= 1; applyStep(); } });
    $('wizardNextBtn').addEventListener('click', () => { if (!nextEnabled(stepsFor()[wizard.index])) return; if (wizard.index >= stepsFor().length - 1) finishWizard(); else { wizard.index += 1; applyStep(); } });
    $('wizardSkipBtn').addEventListener('click', finishWizard);
    sidebar.addEventListener('input', () => setTimeout(refreshNextState, 0));
    sidebar.addEventListener('change', () => setTimeout(refreshNextState, 0));
    sidebar.addEventListener('click', () => setTimeout(refreshNextState, 0));
    window.addEventListener('kefe:theme-change', () => { if (stepsFor()[wizard.index] === 'intro') renderIntro(); });

    /* The wizard is the only page-level flow owner. Lyric helpers are loaded here
       once, rather than by the product-polish enhancement layer. */
    function loadWizardSupport(src, marker) {
        if (document.querySelector(`script[data-${marker}]`)) return;
        const script = document.createElement('script');
        script.src = src;
        script.dataset[marker] = '1';
        document.head.appendChild(script);
    }
    loadWizardSupport('./app/ui/wizard/lyric-pathway.js', 'kefe-lyric-pathway');
    loadWizardSupport('./app/ui/wizard/lyric-pathway-hardening.js', 'kefe-lyric-pathway-hardening');
    loadWizardSupport('./app/ui/wizard/lyric-pathway-style.js', 'kefe-lyric-pathway-style');
    loadWizardSupport('./app/ui/wizard/lyric-pathway-save-bridge.js', 'kefe-lyric-pathway-save-bridge');
    loadWizardSupport('./app/ui/wizard/lyric-pathway-complete.js', 'kefe-lyric-pathway-complete');

    applyStep();
})();