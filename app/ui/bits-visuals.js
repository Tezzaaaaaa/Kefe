(() => {
    'use strict';

    const $ = id => document.getElementById(id);

    function installMarkup() {
        const sidebar = document.querySelector('.sidebar');
        if (!sidebar || $('kefeProjectAid')) return;
        const nav = sidebar.querySelector('.section-nav');
        if (!nav) return;

        const card = document.createElement('section');
        card.id = 'kefeProjectAid';
        card.className = 'kefe-visual-aids';
        card.setAttribute('aria-label', 'Project readiness');
        card.innerHTML = `
            <div class="kefe-aid-card" data-state="pending">
                <div class="kefe-aid-head"><span class="kefe-aid-title">Project readiness</span><span class="kefe-aid-value" id="kefeAidProgressValue">0% ready</span></div>
                <div class="kefe-aid-grid" role="list" aria-label="Production readiness">
                    <div class="kefe-aid-stat" role="listitem"><strong id="kefeAidMedia">Add media</strong><span>Media</span></div>
                    <div class="kefe-aid-stat" role="listitem"><strong id="kefeAidLyrics">Add lyrics</strong><span>Lyrics</span></div>
                    <div class="kefe-aid-stat" role="listitem"><strong id="kefeAidBackground">Choose</strong><span>Background</span></div>
                    <div class="kefe-aid-stat" role="listitem"><strong id="kefeAidExport">Configure</strong><span>Export</span></div>
                </div>
                <div class="kefe-aid-bar" aria-hidden="true"><span id="kefeAidProgress"></span></div>
                <div class="kefe-aid-flow" aria-hidden="true"><span data-kefe-flow></span><span data-kefe-flow></span><span data-kefe-flow></span><span data-kefe-flow></span><span data-kefe-flow></span></div>
                <p class="kefe-aid-caption" id="kefeAidCaption"></p>
                <label class="kefe-aid-toggle"><span>Show production details</span><input id="kefeAidDetailsToggle" type="checkbox" aria-controls="kefeAidDetails"><span class="kefe-aid-switch" aria-hidden="true"></span></label>
                <div class="kefe-aid-details" id="kefeAidDetails" data-open="false"><div class="kefe-aid-detail-list"><div class="kefe-aid-detail-row"><b>Media</b><em>Master audio + source</em></div><div class="kefe-aid-detail-row"><b>Lyrics</b><em>Timed lines / captions</em></div><div class="kefe-aid-detail-row"><b>Background</b><em>Preset or uploaded media</em></div><div class="kefe-aid-detail-row"><b>Export</b><em>Aspect ratio + quality</em></div></div></div>
            </div>`;
        nav.insertAdjacentElement('afterend', card);
    }

    function update() {
        const card = $('kefeProjectAid');
        if (!card || !window.state) return;
        const media = Boolean(window.state.audio?.ready || window.state.audio?.file);
        const lyrics = Array.isArray(window.state.lyrics?.lines) && window.state.lyrics.lines.length > 0;
        const background = Boolean(window.state.background?.image || window.state.background?.video || window.state.background?.type);
        const exportReady = Boolean(window.state.aspect && window.state.audio?.ready);
        const states = [media, lyrics, background, exportReady];
        const complete = states.filter(Boolean).length;
        const percent = Math.round((complete / states.length) * 100);
        const setStat = (id, ready, pending) => { const node = $(id); if (!node) return; node.textContent = ready ? 'Ready' : pending; node.parentElement?.setAttribute('data-state', ready ? 'complete' : 'pending'); };
        setStat('kefeAidMedia', media, 'Add media');
        setStat('kefeAidLyrics', lyrics, 'Add lyrics');
        setStat('kefeAidBackground', background, 'Choose');
        setStat('kefeAidExport', exportReady, 'Configure');
        const progress = $('kefeAidProgress');
        const progressValue = $('kefeAidProgressValue');
        if (progress) progress.style.width = `${percent}%`;
        if (progressValue) progressValue.textContent = `${percent}% ready`;
        card.querySelector('.kefe-aid-card').dataset.state = complete === states.length ? 'complete' : 'pending';
        card.querySelectorAll('[data-kefe-flow]').forEach((item, index) => { item.dataset.complete = String(Boolean(states[index])); item.dataset.active = String(!states[index] && states.slice(0, index).every(Boolean)); });
        const caption = $('kefeAidCaption');
        if (caption) caption.textContent = complete === states.length ? 'Production setup is ready for preview and export.' : `${states.length - complete} setup item${states.length - complete === 1 ? '' : 's'} remaining before export.`;
    }

    function boot() {
        installMarkup();
        const toggle = $('kefeAidDetailsToggle');
        toggle?.addEventListener('change', () => { const details = $('kefeAidDetails'); if (details) details.dataset.open = String(toggle.checked); });
        document.addEventListener('change', update);
        document.addEventListener('input', update);
        window.addEventListener('kefe:statechange', update);
        update();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
    else boot();
})();
