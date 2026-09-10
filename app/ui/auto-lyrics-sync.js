/* KEFE Auto Lyrics Sync
 *
 * KEFE already knows how to identify a song and fetch time-synced lyrics for
 * it: ID3 tags are read off the uploaded file (or guessed from its filename),
 * and "Find lyrics automatically" (#findLyricsBtn, app.js) searches lrclib.net
 * for a synced match. This module triggers that existing search automatically
 * once KEFE has a usable song title/artist pair.
 *
 * The lyric-sync panel also owns the existing Song details fields. The fields
 * use an accessible, shadcn-style Command/Combobox interaction: typing gives
 * debounced LRCLIB suggestions, while keyboard and pointer selection write to
 * the same existing metadata fields. No second metadata state is created.
 */
(() => {
    'use strict';
    const $ = id => document.getElementById(id);

    const CONFIDENT_SOURCES = new Set(['embedded', 'project', 'lrc', 'lyrics-service']);
    const attempted = new Set();
    let inFlight = false;
    let suggestionRequest = 0;
    let suggestionTimer = null;

    function moveSongDetailsIntoLyrics() {
        const lyricsPanel = $('lyricsPanel');
        const heading = document.querySelector('.music-details-heading');
        const details = document.querySelector('.music-details');
        const hint = $('musicSyncHint');
        if (!lyricsPanel || !heading || !details || !hint) return;
        if (lyricsPanel.contains(heading)) return;
        const anchor = $('lyricsStatus');
        if (!anchor) return;
        const fragment = document.createDocumentFragment();
        fragment.append(heading, details, hint);
        lyricsPanel.insertBefore(fragment, anchor);
    }

    function installComboboxStyles() {
        if ($('kefe-song-combobox-styles')) return;
        const style = document.createElement('style');
        style.id = 'kefe-song-combobox-styles';
        style.textContent = `
            .kefe-song-combobox{position:relative;display:block}
            .kefe-song-combobox-list{position:absolute;z-index:50;left:0;right:0;top:calc(100% + 5px);margin:0;padding:4px;list-style:none;border:1px solid var(--line-strong);border-radius:10px;background:var(--surface);box-shadow:0 12px 32px rgba(0,0,0,.18);max-height:230px;overflow:auto}
            .kefe-song-combobox-list[hidden]{display:none}
            .kefe-song-combobox-option{display:flex;flex-direction:column;gap:2px;width:100%;padding:9px 10px;border:0;border-radius:7px;background:transparent;color:var(--text);text-align:left;cursor:pointer}
            .kefe-song-combobox-option:hover,.kefe-song-combobox-option[aria-selected="true"]{background:var(--surface-2)}
            .kefe-song-combobox-option strong{font-size:12px;font-weight:700;line-height:1.25}
            .kefe-song-combobox-option span{font-size:10px;color:var(--text-3);line-height:1.25}
            .kefe-song-combobox-empty{padding:9px 10px;color:var(--text-3);font-size:11px}
        `;
        document.head.appendChild(style);
    }

    function makeCombobox(input, kind) {
        if (!input || input.closest('.kefe-song-combobox')) return;
        const wrap = document.createElement('div');
        wrap.className = 'kefe-song-combobox';
        input.parentNode.insertBefore(wrap, input);
        wrap.appendChild(input);
        input.setAttribute('role', 'combobox');
        input.setAttribute('aria-autocomplete', 'list');
        input.setAttribute('aria-expanded', 'false');
        const list = document.createElement('ul');
        list.className = 'kefe-song-combobox-list';
        list.setAttribute('role', 'listbox');
        list.hidden = true;
        wrap.appendChild(list);

        let options = [];
        let activeIndex = -1;

        const close = () => {
            list.hidden = true;
            input.setAttribute('aria-expanded', 'false');
            input.removeAttribute('aria-activedescendant');
            activeIndex = -1;
        };

        const render = results => {
            options = results;
            activeIndex = -1;
            list.replaceChildren();
            if (!results.length) {
                const empty = document.createElement('li');
                empty.className = 'kefe-song-combobox-empty';
                empty.textContent = 'No matching songs found';
                list.appendChild(empty);
                list.hidden = false;
                input.setAttribute('aria-expanded', 'true');
                return;
            }
            results.forEach((item, index) => {
                const option = document.createElement('li');
                option.className = 'kefe-song-combobox-option';
                option.id = `${input.id}-suggestion-${index}`;
                option.setAttribute('role', 'option');
                option.setAttribute('aria-selected', 'false');
                const title = document.createElement('strong');
                title.textContent = item.trackName || item.title || '';
                const detail = document.createElement('span');
                detail.textContent = kind === 'artist'
                    ? `${item.artistName || ''}${item.albumName ? ` · ${item.albumName}` : ''}`
                    : `${item.artistName || ''}${item.albumName ? ` · ${item.albumName}` : ''}`;
                option.append(title, detail);
                option.addEventListener('mousedown', event => {
                    event.preventDefault();
                    select(index);
                });
                list.appendChild(option);
            });
            list.hidden = false;
            input.setAttribute('aria-expanded', 'true');
        };

        const updateActive = () => {
            [...list.querySelectorAll('[role="option"]')].forEach((node, index) => {
                const selected = index === activeIndex;
                node.setAttribute('aria-selected', String(selected));
                if (selected) input.setAttribute('aria-activedescendant', node.id);
            });
            if (activeIndex >= 0) list.children[activeIndex]?.scrollIntoView({ block: 'nearest' });
        };

        const select = index => {
            const item = options[index];
            if (!item) return;
            if (kind === 'artist') {
                input.value = item.artistName || item.trackName || '';
                const title = $('metaTitle');
                if (title && !title.value.trim() && item.trackName) title.value = item.trackName;
            } else {
                input.value = item.trackName || item.title || '';
                const artist = $('metaArtist');
                if (artist && !artist.value.trim() && item.artistName) artist.value = item.artistName;
            }
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            close();
        };

        input.addEventListener('input', () => {
            window.clearTimeout(suggestionTimer);
            const query = input.value.trim();
            if (query.length < 2) { close(); return; }
            suggestionTimer = window.setTimeout(async () => {
                const request = ++suggestionRequest;
                try {
                    const params = new URLSearchParams();
                    if (kind === 'artist') params.set('artist_name', query);
                    else {
                        params.set('track_name', query);
                        const artist = $('metaArtist')?.value.trim();
                        if (artist) params.set('artist_name', artist);
                    }
                    const response = await fetch(`https://lrclib.net/api/search?${params}`, {
                        headers: { Accept: 'application/json', 'X-User-Agent': 'kefe-visualiser/2.0' }
                    });
                    if (!response.ok || request !== suggestionRequest) return;
                    const results = Array.isArray(await response.json()) ? await response.clone().json() : [];
                    render(results.filter(item => item?.trackName || item?.artistName).slice(0, 8));
                } catch (error) {
                    if (request === suggestionRequest) close();
                }
            }, 250);
        });

        input.addEventListener('keydown', event => {
            if (list.hidden) return;
            const count = options.length;
            if (event.key === 'ArrowDown') { event.preventDefault(); activeIndex = count ? (activeIndex + 1) % count : -1; updateActive(); }
            else if (event.key === 'ArrowUp') { event.preventDefault(); activeIndex = count ? (activeIndex - 1 + count) % count : -1; updateActive(); }
            else if (event.key === 'Enter' && activeIndex >= 0) { event.preventDefault(); select(activeIndex); }
            else if (event.key === 'Escape') { event.preventDefault(); close(); }
        });
        input.addEventListener('blur', () => window.setTimeout(close, 120));
    }

    function initSongComboboxes() {
        installComboboxStyles();
        makeCombobox($('metaArtist'), 'artist');
        makeCombobox($('metaTitle'), 'title');
    }

    function resolvedKey() {
        const state = window.state;
        const audio = state?.audio;
        const media = window.kefeMedia || {};
        const hasAudioFile = Boolean(audio?.file);
        const hasVideoAudio = Boolean(media.videoFile && media.videoHasAudio);
        if (!hasAudioFile && !hasVideoAudio) return null;
        const meta = audio?.metadata || {};
        const title = String($('metaTitle')?.value || $('wizardMetaTitle')?.value || meta.title || '').trim();
        if (!title) return null;
        const artist = String($('metaArtist')?.value || $('wizardMetaArtist')?.value || meta.artist || '').trim();
        const source = audio.metadataSource || '';
        if (!CONFIDENT_SOURCES.has(source) && !artist) return null;
        return `${title.toLowerCase()}::${artist.toLowerCase()}`;
    }

    function releaseWhenDone(btn) {
        if (!btn) { inFlight = false; return; }
        const finish = () => { inFlight = false; observer.disconnect(); };
        const observer = new MutationObserver(() => { if (!btn.disabled) finish(); });
        observer.observe(btn, { attributes: true, attributeFilter: ['disabled'] });
        setTimeout(finish, 25000);
    }

    function tick() {
        if (inFlight || window.isExporting) return;
        const state = window.state;
        if (!state || state.lyrics?.lines?.length) return;
        const btn = $('findLyricsBtn');
        if (!btn || btn.disabled) return;
        const key = resolvedKey();
        if (!key || attempted.has(key)) return;
        attempted.add(key);
        inFlight = true;
        releaseWhenDone(btn);
        btn.click();
    }

    async function alignResolvedLyrics() {
        const st = window.state;
        const aligner = window.kefeLyricAligner;
        const captionGen = window.kefeCaptionGen;
        if (!st || !aligner || !captionGen?.transcribeSource) return;
        if (st.lyrics?.alignment?.method === 'media-audio') return;
        const deadline = Date.now() + 15000;
        while (!st.lyrics?.lines?.length && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
        if (!st.lyrics?.lines?.length) return;
        try {
            const transcription = await captionGen.transcribeSource({ onStatus: message => {
                const status = document.getElementById('lyricsStatus');
                if (status) status.textContent = `Aligning lyrics to media audio… ${message}`;
            }});
            const result = aligner.align(st.lyrics.lines, transcription.words, Number(st.audio?.duration || transcription.audio?.duration || 0));
            if (!result.aligned) return;
            st.lyrics.lines = result.lines;
            st.lyrics.alignment = { method: 'media-audio', confidence: result.confidence, offset: result.offset, anchors: result.anchors, error: result.error };
            if (typeof window.redrawCurrentPreviewFrame === 'function') window.redrawCurrentPreviewFrame();
            const status = document.getElementById('lyricsStatus');
            if (status) status.textContent = `Lyrics synced to media audio — ${result.anchors} timing anchors matched.`;
        } catch (error) {
            console.warn('[KEFE] Automatic lyric alignment unavailable:', error);
        }
    }

    document.addEventListener('kefe:lyrics-resolved', alignResolvedLyrics);

    function start() {
        moveSongDetailsIntoLyrics();
        initSongComboboxes();
        tick();
        setInterval(tick, 1200);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
})();
