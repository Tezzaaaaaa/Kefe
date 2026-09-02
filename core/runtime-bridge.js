/* KEFE runtime bridge — exposes the core editor runtime to modular UI engines. */
(() => {
  'use strict';
  if (window.kefeRuntime?.ready) return;

  // app.js is a classic script, so these top-level bindings are available here.
  if (typeof state === 'undefined' || typeof canvas === 'undefined' || typeof media === 'undefined') {
    console.error('[KEFE Runtime] Core editor state is not available. Runtime bridge not installed.');
    return;
  }

  window.state = state;
  window.canvas = canvas;
  window.kefeMedia = media;
  window.isExporting = Boolean(typeof isExporting !== 'undefined' ? isExporting : false);

  if (typeof redrawCurrentPreviewFrame === 'function') {
    window.redrawCurrentPreviewFrame = redrawCurrentPreviewFrame;
  }

  if (typeof render === 'function') {
    window.kefeRenderFrame = (targetCtx, width, height, time) => {
      if (!targetCtx || !width || !height) return false;
      state.playback.currentTime = Math.max(0, Number(time) || 0);
      render(targetCtx, width, height, state, media);
      return true;
    };
  }

  window.kefeRuntime = {
    version: 1,
    ready: true,
    state,
    canvas,
    media,
    redraw: window.redrawCurrentPreviewFrame || null,
    renderFrame: window.kefeRenderFrame || null
  };
  window.dispatchEvent(new CustomEvent('kefe:runtime-ready'));
})();
