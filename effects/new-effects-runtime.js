/* KEFE Visualiser — runtime bridge for experimental lyric effects */
(() => {
  'use strict';
  if (typeof window === 'undefined' || typeof window.render !== 'function') return;
  const originalRender = window.render;
  const NEW_EFFECTS = new Set(['karaoke','slide','bounce']);
  const labels = {
    karaoke: 'Word-synchronised karaoke highlight with a clean active-word glow',
    slide: 'Smooth cinematic horizontal lyric handoff',
    bounce: 'Playful word-by-word rise with a restrained bounce'
  };

  window.render = function(ctx, w, h, appState, media) {
    const effect = appState?.style?.effect;
    if (!NEW_EFFECTS.has(effect)) return originalRender(ctx, w, h, appState, media);

    const savedEffect = appState.style.effect;
    const savedLines = appState.lyrics?.lines;
    try {
      // Let the established renderer draw the complete background/title layer,
      // but suppress its lyric renderer before drawing the experimental effect.
      appState.style.effect = 'apple';
      if (appState.lyrics) appState.lyrics.lines = [];
      originalRender(ctx, w, h, appState, media);
      if (appState.lyrics) appState.lyrics.lines = savedLines || [];
      appState.style.effect = savedEffect;
      const renderer = window.kefeEffects?.[savedEffect];
      if (typeof renderer === 'function') renderer(ctx, w, h, appState.style, savedLines || [], Number(appState.playback?.currentTime) || 0);
    } finally {
      appState.style.effect = savedEffect;
      if (appState.lyrics) appState.lyrics.lines = savedLines;
    }
  };

  function install() {
    document.querySelectorAll('[data-effect="karaoke"],[data-effect="slide"],[data-effect="bounce"]').forEach(button => {
      if (button.dataset.kefeExperimentalBound === '1') return;
      button.dataset.kefeExperimentalBound = '1';
      button.addEventListener('click', () => {
        if (window.isExporting) return;
        const name = button.dataset.effect;
        window.state.style.effect = name;
        document.querySelectorAll('[data-effect]').forEach(b => b.classList.toggle('active-effect', b.dataset.effect === name));
        const label = document.getElementById('effectLabel');
        if (label) label.textContent = labels[name] || name;
        try { window.localStorage.setItem('kefe-experimental-effect', name); } catch (_) {}
        window.redrawCurrentPreviewFrame?.();
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
  window.KEFE_NEW_EFFECTS = Object.freeze({ labels });
})();
