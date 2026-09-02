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
    if (previewEl) previewEl.id = 'previewSection';
    if (!document.querySelector('link[data-kefe-wizard-style-preview]')) { const styleLink = document.createElement('link'); styleLink.rel = 'stylesheet'; styleLink.href = './ui/wizard-style-preview.css'; styleLink.dataset.kefeWizardStylePreview = 'true'; document.head.appendChild(styleLink); }

    const PATHS = {
        lyric: ['intro', 'source', 'content', 'style', 'background', 'preview', 'export'],
        visualiser: ['intro', 'source', 'style', 'background', 'preview', 'export'],
        captioned: ['intro', 'source', 'captions', 'style', 'background', 'preview', 'export'],
        custom: ['intro', 'source', 'content', 'style', 'background', 'preview', 'export']
    };
    const PATH_LABELS = { lyric: 'Lyric Video', visualiser: 'Visualiser', captioned: 'Captioned Video', custom: 'Custom' };
    const PATH_HINTS = { lyric: 'Synced lyrics with expressive motion.', visualiser: 'Audio-reactive visuals with no lyrics.', captioned: 'Timed captions for spoken audio or video.', custom: 'Build the video your way.' };
    const STEP_TITLES = { content: 'Add your content', captions: 'Create your captions', style: 'Choose your look', background: 'Choose your background', export: 'Export your video' };
    const STEP_LABELS = { intro: 'Format', source: 'Media', content: 'Content', captions: 'Captions', style: 'Style', background: 'Background', preview: 'Preview', export: 'Export' };
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
    const fxSectionId = () => { const el = $('visualFxSection') || $('fxSection'); return el ? el.id : null; };

    const panel = document.createElement('div');
    panel.className = 'section wizard-panel';
    panel.id = 'wizardSection';
    sidebar.insertBefore(panel, sidebar.firstChild);

    const nav = document.createElement('div');
    nav.className = 'wizard-nav';
    nav.id = 'wizardNav';
    nav.innerHTML = '<button type="button" id="wizardBackBtn" class="wizard-back" disabled>Back</button><div class="wizard-progress-wrap"><div id="wizardProgress" class="wizard-progress">01 / 06</div><span id="wizardStepLabel" class="wizard-step-label">Format</span><button type="button" id="wizardSkipBtn" class="wizard-skip">Skip setup</button></div><button type="button" id="wizardNextBtn" class="primary wizard-next">Next</button>';
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
        if (step === 'content') return lyricsReady();
        if (step === 'captions') return captionsReady();
        return true;
    }
    function targetsForStep(step) {
        if (step === 'content') return ['textSection'];
        if (step === 'captions') return [$('captionGenSection')?.id].filter(Boolean);
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
        panel.innerHTML = '<p class="wizard-panel-kicker">02 · Media</p><h3 class="wizard-panel-title">What are you starting with?</h3><p class="wizard-panel-hint">Pick your source. KEFE will carry it through the rest of the project.</p><div class="wizard-choices wizard-source-choices">' + options.map(([v,l,h]) => `<button type="button" class="wizard-choice${wizard.source === v ? ' selected' : ''}" data-source="${v}"><span class="wizard-choice-visual"><span class="wizard-choice-icon">${SOURCE_ICONS[v]}</span><span class="wizard-choice-lines"></span></span><span class="wizard-choice-copy"><strong>${l}</strong><span>${h}</span></span></button>`).join('') + '</div>' + (wizard.source ? `<div class="wizard-source-action"><strong>${sourceStatus()}</strong><button type="button" id="wizardSourceAction" class="file-button">${sourceReady() ? 'Replace media' : 'Choose media'}</button></div>` : '');
        panel.querySelectorAll('[data-source]').forEach(btn => btn.addEventListener('click', () => applySourceChoice(btn.dataset.source)));
        $('wizardSourceAction')?.addEventListener('click', chooseSourceMedia);
    }
    function renderIntro() {
        panel.innerHTML = '<p class="wizard-panel-kicker">01 · Start</p><h3 class="wizard-panel-title">What are you making?</h3><p class="wizard-panel-hint">Choose once. KEFE will build the right editing path for you.</p><div class="wizard-choices">' + ['lyric','visualiser','captioned','custom'].map(k => `<button type="button" class="wizard-choice${wizard.choice === k ? ' selected' : ''}" data-choice="${k}"><span class="wizard-choice-visual"><span class="wizard-choice-icon">${CHOICE_ICONS[k]}</span><span class="wizard-choice-lines"></span></span><span class="wizard-choice-copy"><strong>${PATH_LABELS[k]}</strong><span>${PATH_HINTS[k]}</span></span></button>`).join('') + '</div>';
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
        const effectButtons = [...document.querySelectorAll('#lyricStyleBlock [data-effect]')];
        const current = window.state?.style?.effect || 'apple';
        const effectMarkup = wizard.choice === 'visualiser' ? '' : '<div class="wizard-style-group"><div class="wizard-style-heading">Lyric effect</div><div class="wizard-effect-grid">' + effectButtons.map(btn => `<button type="button" class="wizard-effect-choice${(btn.dataset.effect === current || btn.classList.contains('active')) ? ' selected' : ''}" data-forward-effect="${btn.dataset.effect}">${btn.textContent}</button>`).join('') + '</div></div>';
        panel.innerHTML = '<p class="wizard-panel-kicker">04 · Style</p><h3 class="wizard-panel-title">Choose your look</h3><p class="wizard-panel-hint">Configure the style here and see the result immediately.</p><div class="wizard-style-preview" data-effect="' + current + '"><div class="wizard-style-preview-media-wrap">' + previewBackgroundMarkup() + '</div><div class="wizard-style-preview-shade"></div><div class="wizard-style-preview-content"><span class="wizard-style-preview-eyebrow">KEFE · LIVE PREVIEW</span><div class="wizard-style-preview-line">' + previewLineText() + '</div><span class="wizard-style-preview-effect">' + current + '</span></div></div>' + effectMarkup;
        panel.querySelectorAll('[data-forward-effect]').forEach(btn => btn.addEventListener('click', () => {
            const target = [...document.querySelectorAll('#lyricStyleBlock [data-effect]')].find(x => x.dataset.effect === btn.dataset.forwardEffect);
            target?.click();
            panel.querySelectorAll('[data-forward-effect]').forEach(x => x.classList.toggle('selected', x === btn));
            renderStylePreview(btn.dataset.forwardEffect);
        }));
        renderStylePreview(current);
    }
    function renderPreview() {
        const st = window.state || {}, media = window.kefeMedia || {}, labels = { uploaded: 'Audio file', video: 'Background video', none: 'No audio' };
        const rows = [['Format', PATH_LABELS[wizard.choice] || '—'], ['Source', labels[st.audioSource?.master] || (wizard.source === 'media' ? 'Background video' : wizard.source === 'none' ? 'No audio' : 'Audio file')]];
        if (wizard.choice === 'visualiser') rows.push(['Text', 'None — clean visuals']);
        else if (wizard.choice === 'captioned') rows.push(['Captions', st.captions?.lines?.length ? `${st.captions.lines.length} segments` : 'Generated']);
        else rows.push(['Lyrics', st.lyrics?.lines?.length ? `${st.lyrics.lines.length} lines` : 'Loaded']);
        rows.push(['Effect', st.style?.effect || 'Apple'], ['Visual FX', st.style?.visualFx && st.style.visualFx !== 'none' ? st.style.visualFx : 'Off'], ['Background', media.video ? 'Video' : media.image ? 'Image' : `Solid ${st.background?.solid || '#0A0A0A'}`], ['Title intro', st.style?.titleCardEnabled === false ? 'Off' : 'On']);
        panel.innerHTML = '<p class="wizard-panel-kicker">Preview</p><h3 class="wizard-panel-title">Review your video</h3><p class="wizard-panel-hint">Play it once. Everything is already applied and ready for export.</p><div class="wizard-summary">' + rows.map(([k,v]) => `<div class="wizard-summary-row"><span>${k}</span><strong>${v}</strong></div>`).join('') + '</div><button type="button" id="wizardPlayBtn" class="primary full-width">Play full preview</button>';
        $('wizardPlayBtn').addEventListener('click', () => $('playBtn')?.click());
    }

    function applyStep() {
        const steps = stepsFor(), step = steps[wizard.index] || 'preview';
        body.dataset.wizardStep = step;
        document.querySelectorAll('.wizard-current').forEach(el => el.classList.remove('wizard-current'));
        if (step === 'preview' && previewEl) { previewEl.classList.remove('preview-collapsed'); previewEl.classList.add('preview-expanded'); }
        const targetIds = targetsForStep(step);
        let firstTarget = null;

        if (step === 'style') {
            renderStylePanel();
            panel.classList.add('wizard-current');
            firstTarget = panel;
        } else if (targetIds.length) {
            panel.innerHTML = '';
            targetIds.forEach(id => { const el = $(id); if (el) { el.classList.add('wizard-current'); if (!firstTarget) firstTarget = el; } });
        } else {
            if (step === 'intro') renderIntro();
            else if (step === 'source') renderSource();
            else if (step === 'preview') renderPreview();
            panel.classList.add('wizard-current');
            firstTarget = panel;
        }

        if (firstTarget && firstTarget !== panel) { stepHeading.textContent = STEP_TITLES[step] || step; firstTarget.prepend(stepHeading); } else stepHeading.remove();
        $('wizardProgress').textContent = `${pad(wizard.index + 1)} / ${pad(steps.length)}`;
        $('wizardStepLabel').textContent = STEP_LABELS[step] || '';
        $('wizardBackBtn').disabled = wizard.index === 0;
        const next = $('wizardNextBtn'); next.textContent = step === 'export' ? 'Export' : 'Next'; next.disabled = !nextEnabled(step);
        if (firstTarget) { firstTarget.setAttribute('tabindex', '-1'); firstTarget.focus({ preventScroll: true }); }
    }
    function refreshNextState() { const step = stepsFor()[wizard.index], b = $('wizardNextBtn'); if (step && b) b.disabled = !nextEnabled(step); }
    function finishWizard() {
        clearTimeout(fadeTimer); sidebar.classList.remove('wizard-fading'); stepHeading.remove(); nav.remove(); panel.remove(); document.querySelectorAll('.wizard-current').forEach(el => el.classList.remove('wizard-current')); body.classList.remove('wizard-mode'); delete body.dataset.wizardStep;
        document.querySelectorAll('.section-nav-link').forEach(link => link.classList.toggle('active', link.dataset.nav === 'export'));
        document.querySelectorAll('.sidebar .section').forEach(s => s.classList.toggle('active', s.id === 'exportSection'));
        $('exportSection')?.scrollIntoView({ block: 'start', behavior: reducedMotion ? 'auto' : 'smooth' });
    }
    function goTo(index) { const steps = stepsFor(); if (index < 0 || index >= steps.length) return; wizard.index = index; if (reducedMotion) return applyStep(); sidebar.classList.add('wizard-fading'); clearTimeout(fadeTimer); fadeTimer = setTimeout(() => { applyStep(); sidebar.classList.remove('wizard-fading'); }, 150); }

    $('wizardBackBtn').addEventListener('click', () => goTo(wizard.index - 1));
    $('wizardNextBtn').addEventListener('click', () => { const step = stepsFor()[wizard.index]; if (!nextEnabled(step)) return; if (step === 'preview') return finishWizard(); goTo(wizard.index + 1); });
    $('wizardSkipBtn').addEventListener('click', finishWizard);
    sidebar.addEventListener('input', () => setTimeout(refreshNextState, 0));
    sidebar.addEventListener('change', () => setTimeout(refreshNextState, 0));
    sidebar.addEventListener('click', () => setTimeout(refreshNextState, 0));
    applyStep();
})();
