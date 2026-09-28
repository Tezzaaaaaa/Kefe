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
        captioned: ['intro', 'source', 'captions', 'background', 'preview', 'export']
    };
    const PATH_LABELS = { lyric: 'Lyric Video', visualiser: 'Visualiser', captioned: 'Captioned Video'};
    const PATH_HINTS = { lyric: 'Synced lyrics with expressive motion.', visualiser: 'Audio-reactive visuals with no lyrics.', captioned: 'Timed captions for spoken audio or video.'};
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
        media: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m10 9 5 3-5 3z"/></svg>'
    };

    const wizard = { path: 'lyric', index: 0, choice: null, source: null };
    const destroyIntroVeil = () => window.KefeDarkVeil?.destroy?.();
        const stepsFor = () => {
        let steps = PATHS[wizard.path] || PATHS.lyric;
        // Captioned + video source = no background step (the video IS the background)
        if (wizard.path === 'captioned' && wizard.source === 'media') {
            steps = steps.filter(s => s !== 'background');
        }
        return steps;
    };

    const panel = document.createElement('div');
    panel.className = 'section wizard-panel';
    panel.id = 'wizardSection';
    sidebar.insertBefore(panel, sidebar.firstChild);

    const nav = document.createElement('div');
    nav.className = 'wizard-nav';
    nav.id = 'wizardNav';
    nav.innerHTML = '<div class="wizard-glow-button"><span class="wizard-glow wizard-glow-back" aria-hidden="true"></span><button type="button" id="wizardBackBtn" class="wizard-back" disabled>Back</button></div><div class="wizard-progress-wrap"><div id="wizardStepMenu" class="wizard-step-menu" role="list" aria-label="Creation steps"></div><div class="wizard-progress-meta"><div id="wizardProgress" class="wizard-progress">01 / 07</div><span id="wizardStepLabel" class="wizard-step-label">Format</span></div><button type="button" id="wizardSkipBtn" class="wizard-skip">Skip setup</button></div><div class="wizard-glow-button"><span class="wizard-glow wizard-glow-next" aria-hidden="true"></span><button type="button" id="wizardNextBtn" class="primary wizard-next">Next<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></div>';
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
        if (step === 'captions') return ['textSection', 'captionGenSection', 'captionReviewSection'];
        if (step === 'style') return [];
        if (step === 'background') return ['backgroundSection'];
        if (step === 'export') return ['exportSection'];
        return [];
    }
    function sourceStatus() {
        if (wizard.source === 'uploaded') return hasLoadedAudio() ? 'Audio loaded' : 'Choose your audio file.';
        if (wizard.source === 'media') { const m = window.kefeMedia || {}; return m.videoFile ? 'Background video loaded' : m.image ? 'Background image loaded' : 'Choose an image or video.'; }
        return 'Choose your media source.';
    }
    function chooseSourceMedia() { if (wizard.source === 'uploaded') $('audioInput')?.click(); if (wizard.source === 'media') $('backgroundInput')?.click(); }
    function applySourceChoice(source) {
        wizard.source = source; window.kefeWizardSource = source; const st = window.state;
        if (typeof window.applyMasterSelection === 'function') {
            try {
                if (source === 'uploaded') window.applyMasterSelection('uploaded', { userInitiated: false, silent: true });
                if (source === 'media') { if (st?.audioSource) st.audioSource.userChosen = false; const m = window.kefeMedia || {}; if (m.video && m.videoFile && m.videoHasAudio) window.applyMasterSelection('video', { userInitiated: false, silent: true }); }
            } catch (e) {}
        }
        renderSource(); refreshNextState();
    }
    function renderSource() {
        // Visualiser uses the same media-source choices as the other pathways.
        const options = wizard.choice === 'captioned'
            ? [['uploaded', 'Audio file', 'Use a music track or voice recording.'], ['media', 'Background video', 'Use a video and its soundtrack.']]
            : [['uploaded', 'Audio file', 'Use an MP3, WAV or M4A track.'], ['media', 'Background video', 'Use a video as the visual background and its soundtrack.']];
        panel.innerHTML = '<p class="wizard-panel-kicker">02 · Media</p><h3 class="wizard-panel-title">What are you starting with?</h3><p class="wizard-panel-hint">Pick your source. KEFE will carry it through the rest of the project.</p><div class="wizard-choices wizard-source-choices">' + options.map(([v,l,h]) => `<div class="wizard-choice${wizard.source === v ? ' selected' : ''}" data-source="${v}" role="button" tabindex="0"><span class="wizard-choice-visual"><span class="wizard-choice-icon">${SOURCE_ICONS[v]}</span><span class="wizard-choice-lines"></span></span><span class="wizard-choice-copy"><strong>${l}</strong><span>${h}</span>${v !== 'none' ? `<button type="button" class="file-button wizard-source-upload" data-source="${v}">${v === 'uploaded' ? 'Upload audio' : 'Upload media'}</button>` : ''}</span></div>`).join('') + '</div>' + '<div id="wizardMetadataMount"></div><p class="music-sync-hint">Enter the artist and title to find synced lyrics when the file has no metadata.</p>';
        const metadataMount = $('wizardMetadataMount');
        const metadataBlock = document.querySelector('#audioSection .music-details');
        if (metadataMount && metadataBlock) metadataMount.appendChild(metadataBlock);
        panel.querySelectorAll('.wizard-source-choices [data-source]').forEach(btn => btn.addEventListener('click', event => {
            if (event.target.closest('.wizard-source-upload')) return;
            applySourceChoice(btn.dataset.source);
        }));
        panel.querySelectorAll('.wizard-source-upload').forEach(btn => btn.addEventListener('click', event => {
            event.stopPropagation();
            applySourceChoice(btn.dataset.source);
            chooseSourceMedia();
        }));
    }
    function renderIntro() {
        destroyIntroVeil();
        const veil = '<div class="wizard-dark-veil" aria-hidden="true"></div>';
        const projects = [
            ['lyric', 'Lyric Video', 'https://pub-830233752de349e29c6104a501b309d4.r2.dev/hover-img/hover-img-img01-alt.jpg'],
            ['visualiser', 'Visualiser', 'https://pub-830233752de349e29c6104a501b309d4.r2.dev/hover-img/hover-img-img02.jpg'],
            ['captioned', 'Captioned Video', 'https://pub-830233752de349e29c6104a501b309d4.r2.dev/hover-img/hover-img-img03.jpg']
        ];
        panel.innerHTML = veil + '<p class="wizard-panel-kicker">01 · Start</p><h3 class="wizard-panel-title">Choose your KEFE project</h3><div class="wizard-choices-wrap"><div class="wizard-choices wizard-hover-img-menu">' + projects.map(([k,title,image]) => '<button type="button" class="wizard-choice hover-img-project' + (wizard.choice === k ? ' selected' : '') + '" data-choice="' + k + '" data-hover-image="' + image + '"><span class="hover-img-project-copy"><strong>' + title + '</strong></span></button>').join('') + '</div><div class="hover-img-thumbnail-wrapper" aria-hidden="true">' + projects.map(([,title,image], index) => '<div class="hover-img-thumbnail" style="--thumb-index:' + index + '"><img src="' + image + '" alt="' + title + '"></div>').join('') + '</div></div>';
        const veilTarget = panel.querySelector('.wizard-dark-veil');
        if (veilTarget && window.KefeDarkVeil?.mount) {
            requestAnimationFrame(() => window.KefeDarkVeil.mount(veilTarget, {
                hueShift: 0, speed: reducedMotion ? 0 : 0.5, noiseIntensity: 0, scanlineIntensity: 0,
                scanlineFrequency: 0, warpAmount: 0, resolutionScale: 1
            }));
        }
        const menu = panel.querySelector('.wizard-hover-img-menu');
        const thumbnail = panel.querySelector('.hover-img-thumbnail-wrapper');
        if (menu && thumbnail && !reducedMotion) {
            const moveThumbnail = event => {
                thumbnail.dataset.x = event.clientX;
                thumbnail.dataset.y = event.clientY;
                thumbnail.style.transform = 'translate3d(' + event.clientX + 'px,' + event.clientY + 'px,0) translate(-50%,-50%)';
            };
            const hideThumbnail = () => {
                thumbnail.style.transform = 'translate3d(' + thumbnail.dataset.x + 'px,' + thumbnail.dataset.y + 'px,0) translate(-50%,-50%) scale(0)';
            };
            menu.addEventListener('mousemove', moveThumbnail);
            menu.addEventListener('mouseleave', hideThumbnail);
            menu.querySelectorAll('.hover-img-project').forEach((project, index) => {
                project.addEventListener('mouseenter', () => {
                    thumbnail.style.transform = 'translate3d(' + (thumbnail.dataset.x || 0) + 'px,' + (thumbnail.dataset.y || 0) + 'px,0) translate(-50%,-50%) scale(1)';
                    thumbnail.style.setProperty('--active-index', index);
                });
                project.addEventListener('click', () => {
                    const choice = project.dataset.choice;
                    if (wizard.choice === choice) {
                        wizard.choice = null;
                        wizard.path = null;
                        wizard.source = null;
                        wizard.index = 0;
                        project.classList.remove('selected');
                        refreshNextState();
                        return;
                    }
                    if (wizard.choice !== choice) wizard.source = null;
                    wizard.choice = choice;
                    wizard.path = choice;
                    wizard.index = 0;
                    if (typeof window.kefeSetProjectType === 'function') window.kefeSetProjectType(choice);
                    menu.querySelectorAll('.wizard-choice').forEach(x => x.classList.toggle('selected', x.dataset.choice === choice));
                    refreshNextState();
                });
            });
        } else if (menu) {
            menu.querySelectorAll('.wizard-choice').forEach(btn => btn.addEventListener('click', () => {
                const c = btn.dataset.choice;
                if (wizard.choice === c) {
                    wizard.choice = null;
                    wizard.path = null;
                    wizard.source = null;
                    wizard.index = 0;
                    btn.classList.remove('selected');
                    refreshNextState();
                    return;
                }
                if (wizard.choice !== c) wizard.source = null;
                wizard.choice = c;
                wizard.path = c;
                wizard.index = 0;
                if (typeof window.kefeSetProjectType === 'function') window.kefeSetProjectType(c);
                menu.querySelectorAll('.wizard-choice').forEach(x => x.classList.toggle('selected', x.dataset.choice === c));
                refreshNextState();
            }));
        }
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
        const st = window.state || {}, media = window.kefeMedia || {}, labels = { uploaded: 'Audio file', video: 'Background video' };
        const rows = [['Format', PATH_LABELS[wizard.choice] || '—'], ['Source', labels[st.audioSource?.master] || (wizard.source === 'media' ? 'Background video' : wizard.source === 'none' ? 'Audio file' : 'Audio file')]];
        if (wizard.choice === 'visualiser') rows.push(['Text', 'None — clean visuals']);
        else if (wizard.choice === 'captioned') rows.push(['Captions', st.captions?.lines?.length ? `${st.captions.lines.length} segments` : 'Generated']);
        else rows.push(['Lyrics', st.lyrics?.lines?.length ? `${st.lyrics.lines.length} lines` : 'Loaded']);
        rows.push(['Effect', st.style?.effect || 'Apple'], ['Visual FX', st.style?.visualFx && st.style.visualFx !== 'none' ? st.style.visualFx : 'Off'], ['Background', media.video ? 'Video' : media.image ? 'Image' : `Solid ${st.background?.solid || '#0A0A0A'}`], ['Title intro', st.style?.titleCardEnabled === false ? 'Off' : 'On']);
        panel.innerHTML = '<p class="wizard-panel-kicker">Preview</p><h3 class="wizard-panel-title">Review your video</h3><p class="wizard-panel-hint">Play it once. Everything is already applied and ready for export.</p><div class="wizard-summary">' + rows.map(([k,v]) => `<div class="wizard-summary-row"><span>${k}</span><strong>${v}</strong></div>`).join('') + '</div><button type="button" id="wizardPlayBtn" class="primary full-width">Play full preview</button>';
        $('wizardPlayBtn').addEventListener('click', () => $('playBtn')?.click());
    }

    function applyStep() {
        // Move the shared style block back to its permanent home BEFORE
        // the wizard panel is rebuilt. Without this, panel.innerHTML=""
        // destroys #lyricStyleBlock and style/background steps render blank.
        restoreStyleBlock();
        const steps = stepsFor(), step = steps[wizard.index] || 'preview';
        body.dataset.wizardStep = step;
        document.querySelectorAll('.wizard-current').forEach(el => el.classList.remove('wizard-current'));
        if (previewEl) { const showLivePreview = ['lyrics','captions','style','background','preview'].includes(step); previewEl.classList.toggle('preview-expanded', showLivePreview); previewEl.classList.toggle('preview-collapsed', !showLivePreview); }
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
        const stepMenu = $('wizardStepMenu');
        if (stepMenu) {
            stepMenu.innerHTML = steps.map((key, index) => {
                const active = index === wizard.index;
                const done = index < wizard.index;
                return `<span class="wizard-step-menu-item${active ? ' active' : ''}${done ? ' done' : ''}" role="listitem" aria-current="${active ? 'step' : 'false'}"><span class="wizard-step-menu-index">${pad(index + 1)}</span><span class="wizard-step-menu-label">${STEP_LABELS[key] || key}</span></span>`;
            }).join('<span class="wizard-step-menu-line" aria-hidden="true"></span>');
        }
        $('wizardBackBtn').disabled = wizard.index === 0;
        const next = $('wizardNextBtn'); next.textContent = step === 'export' ? 'Export' : 'Next'; next.disabled = !nextEnabled(step);
        if (firstTarget) { firstTarget.setAttribute('tabindex', '-1'); firstTarget.focus({ preventScroll: true }); }
    }
    function refreshNextState() { const step = stepsFor()[wizard.index], b = $('wizardNextBtn'); if (step && b) b.disabled = !nextEnabled(step); }
    function finishWizard() {
        destroyIntroVeil();

        const metadataBlock = document.querySelector('#wizardMetadataMount .music-details');
        if (metadataBlock) $('audioSection')?.appendChild(metadataBlock);

        restoreStyleBlock();

        clearTimeout(fadeTimer); sidebar.classList.remove('wizard-fading'); stepHeading.remove(); nav.remove(); panel.remove(); document.querySelectorAll('.wizard-current').forEach(el => el.classList.remove('wizard-current')); body.classList.remove('wizard-mode'); delete body.dataset.wizardStep;
        document.querySelectorAll('.sidebar .section').forEach(s => s.classList.toggle('active', s.id === 'exportSection'));
        $('exportSection')?.scrollIntoView({ block: 'start', behavior: reducedMotion ? 'auto' : 'smooth' });
    }
    function goTo(index) { const steps = stepsFor(); if (index < 0 || index >= steps.length) return; wizard.index = index; if (reducedMotion) return applyStep(); sidebar.classList.add('wizard-fading'); clearTimeout(fadeTimer); fadeTimer = setTimeout(() => { applyStep(); sidebar.classList.remove('wizard-fading'); }, 150); }

    window.kefeWizard = {
        version: 1,
        getState: () => ({ path: wizard.path, index: wizard.index, step: stepsFor()[wizard.index] || null, choice: wizard.choice, source: wizard.source, steps: [...stepsFor()] })
    };

    $('wizardBackBtn').addEventListener('click', () => goTo(wizard.index - 1));
    $('wizardNextBtn').addEventListener('click', () => {
        const step = stepsFor()[wizard.index];
        if (!nextEnabled(step)) return;
        if (step === 'export') {
            $('exportBottom')?.click();
            return;
        }
        goTo(wizard.index + 1);
    });
    $('wizardSkipBtn').addEventListener('click', finishWizard);
    sidebar.addEventListener('input', () => setTimeout(refreshNextState, 0));
    sidebar.addEventListener('change', () => setTimeout(refreshNextState, 0));
    sidebar.addEventListener('click', () => setTimeout(refreshNextState, 0));
    applyStep();
})();
