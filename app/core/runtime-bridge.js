/* KEFE runtime bridge — exposes the core editor runtime to modular UI engines. */
(() => {
  'use strict';

  function install() {
    if (window.kefeRuntime?.ready) return true;

    const runtimeState = window.state;
    const runtimeCanvas = document.getElementById('stageCanvas');
    const runtimeMedia = window.kefeMedia;

    if (!runtimeState || !runtimeCanvas || !runtimeMedia) return false;

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
    return true;
  }

  function tryInstall() {
    if (install()) return;
    if (document.readyState === 'loading') return;
    setTimeout(tryInstall, 25);
  }

  window.addEventListener('kefe:app-ready', install, { once: true });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryInstall, { once: true });
  } else {
    tryInstall();
  }
})();
