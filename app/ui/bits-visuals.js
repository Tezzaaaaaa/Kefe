(() => {
    const $ = id => document.getElementById(id);

    const els = {
        card: $('kefeProjectAid'),
        media: $('kefeAidMedia'),
        lyrics: $('kefeAidLyrics'),
        background: $('kefeAidBackground'),
        export: $('kefeAidExport'),
        progress: $('kefeAidProgress'),
        progressValue: $('kefeAidProgressValue'),
        caption: $('kefeAidCaption'),
        flow: [...document.querySelectorAll('[data-kefe-flow]')],
        detailsToggle: $('kefeAidDetailsToggle'),
        details: $('kefeAidDetails')
    };

    if (!els.card || !window.state) return;

    const hasLyrics = () => Array.isArray(window.state.lyrics?.lines) && window.state.lyrics.lines.length > 0;
    const hasMedia = () => Boolean(window.state.audio?.ready || window.state.audio?.file);
    const hasBackground = () => Boolean(window.state.background?.image || window.state.background?.video || window.state.background?.type);
    const hasExportSettings = () => Boolean(window.state.aspect && window.state.audio?.ready);

    function setStat(element, complete, label) {
        if (!element) return;
        element.textContent = complete ? 'Ready' : label;
        element.parentElement?.setAttribute('data-state', complete ? 'complete' : 'pending');
    }

    function update() {
        const media = hasMedia();
        const lyrics = hasLyrics();
        const background = hasBackground();
        const exportReady = hasExportSettings();
        const states = [media, lyrics, background, exportReady];
        const complete = states.filter(Boolean).length;
        const percent = Math.round((complete / states.length) * 100);

        setStat(els.media, media, 'Add media');
        setStat(els.lyrics, lyrics, 'Add lyrics');
        setStat(els.background, background, 'Choose');
        setStat(els.export, exportReady, 'Configure');

        if (els.progress) els.progress.style.width = `${percent}%`;
        if (els.progressValue) els.progressValue.textContent = `${percent}% ready`;
        if (els.card) els.card.dataset.state = complete === states.length ? 'complete' : 'pending';

        els.flow.forEach((item, index) => {
            item.dataset.complete = String(Boolean(states[index]));
            item.dataset.active = String(!states[index] && states.slice(0, index).every(Boolean));
        });

        if (els.caption) {
            els.caption.textContent = complete === states.length
                ? 'Production setup is ready for preview and export.'
                : `${states.length - complete} setup item${states.length - complete === 1 ? '' : 's'} remaining before export.`;
        }
    }

    els.detailsToggle?.addEventListener('change', () => {
        if (els.details) els.details.dataset.open = String(els.detailsToggle.checked);
    });

    ['change', 'input'].forEach(eventName => {
        document.addEventListener(eventName, update);
    });

    window.addEventListener('kefe:statechange', update);
    update();
})();
