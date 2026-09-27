/* KEFE runtime bridge — exposes the core editor runtime to modular UI engines. */
(() => {
  'use strict';
  if (window.kefeRuntime?.ready) return;

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