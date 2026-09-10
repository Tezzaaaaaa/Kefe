/* KEFE runtime bridge — exposes the core editor runtime to modular UI engines. */
(() => {
  'use strict';
  if (window.kefeRuntime?.ready) return;

  // app.js publishes the authoritative editor state and media cache on window.
  // Use that public compatibility surface rather than depending on classic-script
  // lexical bindings, which makes the bridge reliable in smoke tests and when
  // modules are loaded dynamically.
  const runtimeState = window.state;
  const runtimeCanvas = window.canvas || document.getElementById('stageCanvas');
  const runtimeMedia = window.kefeMedia;
  if (!runtimeState || !runtimeCanvas || !runtimeMedia) {
    console.error('[KEFE Runtime] Core editor state is not available. Runtime bridge not installed.');
    return;
  }

  window.state = runtimeState;
  window.canvas = runtimeCanvas;
  window.kefeMedia = runtimeMedia;
  window.isExporting = Boolean(window.isExporting);

  if (typeof window.redrawCurrentPreviewFrame === 'function') {
    window.redrawCurrentPreviewFrame = window.redrawCurrentPreviewFrame;
  }

  if (typeof window.render === 'function') {
    window.kefeRenderFrame = (targetCtx, width, height, time) => {
      if (!targetCtx || !width || !height) return false;
      runtimeState.playback.currentTime = Math.max(0, Number(time) || 0);
      window.render(targetCtx, width, height, runtimeState, runtimeMedia);
      return true;
    };
  }

  window.kefeRuntime = {
    version: 1,
    ready: true,
    state: runtimeState,
    canvas: runtimeCanvas,
    media: runtimeMedia,
    redraw: window.redrawCurrentPreviewFrame || null,
    renderFrame: window.kefeRenderFrame || null
  };
  window.dispatchEvent(new CustomEvent('kefe:runtime-ready'));
})();
