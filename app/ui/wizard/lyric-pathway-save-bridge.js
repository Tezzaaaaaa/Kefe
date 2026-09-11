/* KEFE Lyric Video pathway — commit structured timing edits into the canonical LRC field. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const format = value => {
    const t = Math.max(0, Number(value) || 0);
    const m = Math.floor(t / 60);
    const s = (t % 60).toFixed(2).padStart(5, '0');
    return `${String(m).padStart(2, '0')}:${s}`;
  };
  const sync = () => {
    const lines = window.state?.lyrics?.lines;
    const textarea = $('lyricsText');
    if (!Array.isArray(lines) || !textarea) return;
    textarea.value = lines
      .slice()
      .sort((a, b) => (Number(a.time) || 0) - (Number(b.time) || 0))
      .map(line => `[${format(line.time)}]${String(line.text || '')}`)
      .join('\n');
  };
  document.addEventListener('click', event => {
    if (!event.target.closest('#saveLyrics')) return;
    sync();
  }, true);
  window.addEventListener('kefe:lyric-editor-change', sync);
})();
