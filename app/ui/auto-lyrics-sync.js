/* KEFE Auto Lyrics Sync
 *
 * KEFE already knows how to identify a song and fetch time-synced lyrics for
 * it: ID3 tags are read off the uploaded file (or guessed from its filename),
 * and "Find lyrics automatically" (#findLyricsBtn, app.js) searches lrclib.net
 * for a synced match. Previously that search only ran when the user clicked
 * the button by hand. This module triggers the exact same, already-existing
 * search automatically the moment KEFE has a usable song title — no new
 * lookup logic, no new API, just removing the manual step.
 *
 * Design notes:
 * - Never overwrites lyrics the user already has (typed, .lrc upload, or a
 *   previous successful search) — state.lyrics.lines.length is the guard.
 * - Only auto-fires on a title we have real confidence in: embedded ID3 tags,
 *   or a filename that parsed into an explicit "Artist - Title" pair. A bare
 *   filename with no artist (e.g. "New Recording 12.mp3") is too unreliable
 *   to search on automatically, so we wait — either for the user to type
 *   something, or for a better metadata source to show up (e.g. ID3 tags
 *   finish reading a moment after the filename-only guess).
 * - Re-attempts if the resolved title/artist pair changes (e.g. ID3 tags
 *   arrive after an initial filename guess), but never re-attempts the same
 *   pair twice.
 * - Reuses #findLyricsBtn's own click handler rather than reimplementing the
 *   search, so status text, error toasts, and metadata write-back all stay
 *   in sync with the manual flow.
 */
(() => {
    'use strict';
    const $ = id => document.getElementById(id);

    const CONFIDENT_SOURCES = new Set(['embedded', 'project', 'lrc', 'lyrics-service']);
    const attempted = new Set();
    let inFlight = false;

    function resolvedKey() {
        const audio = window.state?.audio;
        if (!audio || !audio.file) return null;
        const meta = audio.metadata || {};
        const title = String(meta.title || '').trim();
        if (!title) return null;
        const artist = String(meta.artist || '').trim();
        const source = audio.metadataSource || '';
        // Filename-derived titles are only trustworthy once they carried an
        // artist too (i.e. the filename actually looked like "Artist - Title").
        // A bare filename guess with no artist is too noisy to search on blind.
        if (!CONFIDENT_SOURCES.has(source) && !artist) return null;
        return `${title.toLowerCase()}::${artist.toLowerCase()}`;
    }

    function releaseWhenDone(btn) {
        if (!btn) { inFlight = false; return; }
        const finish = () => { inFlight = false; observer.disconnect(); };
        const observer = new MutationObserver(() => { if (!btn.disabled) finish(); });
        observer.observe(btn, { attributes: true, attributeFilter: ['disabled'] });
        // Safety net in case the button's disabled state never flips back for
        // some unrelated reason — don't lock auto-sync out forever.
        setTimeout(finish, 25000);
    }

    function tick() {
        if (inFlight || window.isExporting) return;
        const state = window.state;
        if (!state || state.lyrics?.lines?.length) return; // never clobber existing lyrics
        const btn = $('findLyricsBtn');
        if (!btn || btn.disabled) return;
        const key = resolvedKey();
        if (!key || attempted.has(key)) return;
        attempted.add(key);
        inFlight = true;
        releaseWhenDone(btn);
        btn.click();
    }

    function start() {
        tick();
        setInterval(tick, 1200);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
})();
