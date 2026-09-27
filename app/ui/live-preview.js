/* KEFE Live Preview — keeps the canvas feeling like the centre of the editor. */
(() => {
  'use strict';
  const preview = document.querySelector('.preview');
  const toolbar = preview?.querySelector('.preview-toolbar');
  const canvas = document.getElementById('stageCanvas');
  const transport = preview?.querySelector('.transport');
  if (!preview || !toolbar || !canvas || preview.dataset.livePreviewReady) return;
  preview.dataset.livePreviewReady = 'true';

  // live-preview.css is already part of index.html. Do not inject a root-relative
  // duplicate stylesheet (the old ./ui/ path produced a 404 on GitHub Pages).

  // Keep playback controls as a dedicated bottom strip rather than mixing them
  // into the Preview heading. This also makes the hierarchy stable at all widths.
  const canvasWrapper = preview.querySelector('.canvas-wrapper');
  if (transport && canvasWrapper) {
    preview.appendChild(transport);
    transport.setAttribute('aria-label', 'Preview playback controls');
  }

  const focusButton = document.createElement('button');
  focusButton.type = 'button';
  focusButton.className = 'preview-focus-button';
  focusButton.id = 'previewFocusButton';
  focusButton.setAttribute('aria-label', 'Open preview fullscreen');
  focusButton.title = 'Fullscreen preview';
  focusButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4H4v4M16 4h4v4M20 16v4h-4M4 16v4h4"/></svg>';
  transport?.appendChild(focusButton);

  const modeBadge = document.getElementById('previewModeBadge');
  const status = document.getElementById('previewStatus');
  const focusBtn = document.getElementById('previewFocusButton');
  let fallbackFullscreen = false;

  function activeLine() {
    const state = window.state;
    if (!state) return null;
    const lines = state.captions?.mode === 'captions' && state.captions?.lines?.length
      ? state.captions.lines
      : state.lyrics?.lines || [];
    const t = Number(state.playback?.currentTime) || 0;
    let current = null;
    for (const line of lines) {
      if (Number(line?.time) <= t) current = line;
      else break;
    }
    return current;
  }

  function sync() {
    const state = window.state;
    if (!state) return;
    if (modeBadge) {
      modeBadge.textContent = state.captions?.mode === 'captions'
        ? 'Captions'
        : state.projectType === 'visualiser' ? 'Visualiser' : 'Lyrics';
    }
    const line = activeLine();
    if (status) status.textContent = state.playback?.isPlaying ? 'Playing' : line?.text ? 'Ready' : 'Ready';
  }

  function toggleFullscreen() {
    const nativeFullscreen = document.fullscreenElement === preview || document.webkitFullscreenElement === preview;
    if (nativeFullscreen) {
      const exit = document.exitFullscreen?.() || document.webkitExitFullscreen?.();
      if (exit?.catch) exit.catch(() => {});
      return;
    }
    if (fallbackFullscreen) {
      fallbackFullscreen = false;
      preview.classList.remove('kefe-preview-fullscreen');
      syncFullscreenState();
      return;
    }

    const request = preview.requestFullscreen || preview.webkitRequestFullscreen;
    if (request && (document.fullscreenEnabled || document.webkitFullscreenEnabled)) {
      try {
        const result = request.call(preview);
        if (result?.catch) {
          result.catch(() => {
            fallbackFullscreen = true;
            preview.classList.add('kefe-preview-fullscreen');
            syncFullscreenState();
          });
        }
        return;
      } catch (_) {}
    }

    fallbackFullscreen = true;
    preview.classList.add('kefe-preview-fullscreen');
    syncFullscreenState();
  }

  focusBtn?.addEventListener('click', toggleFullscreen);
  const syncFullscreenState = () => {
    const active = fallbackFullscreen || document.fullscreenElement === preview || document.webkitFullscreenElement === preview;
    if (focusBtn) {
      focusBtn.setAttribute('aria-label', active ? 'Exit fullscreen preview' : 'Open preview fullscreen');
      focusBtn.title = active ? 'Exit fullscreen' : 'Fullscreen preview';
    }
  };
  document.addEventListener('fullscreenchange', syncFullscreenState);
  document.addEventListener('webkitfullscreenchange', syncFullscreenState);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && fallbackFullscreen) {
      fallbackFullscreen = false;
      preview.classList.remove('kefe-preview-fullscreen');
      syncFullscreenState();
    }
  });

  window.addEventListener('kefe:preview-updated', sync);
  setInterval(sync, 180);
  sync();
})();
