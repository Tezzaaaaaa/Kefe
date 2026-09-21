/* KEFE — pin aspect-ratio group + fullscreen button to the top-right corner
   of the preview. Both come out of the toolbar flow entirely, so the
   toolbar never reflows when effect labels change. */
(function(){
  'use strict';
  if (window.__kefePreviewCorner) return;
  window.__kefePreviewCorner = true;

  function moveToCorner() {
    var preview = document.querySelector('.preview');
    if (!preview) return;

    var corner = document.getElementById('kefePreviewCorner');
    if (!corner) {
      corner = document.createElement('div');
      corner.id = 'kefePreviewCorner';
      corner.className = 'kefe-preview-corner';
      preview.appendChild(corner);
    }

    // The aspect group currently lives in .preview-heading
    var format = document.getElementById('previewFormat');
    // Aspect chips stay in the preview heading — CSS locks them there.
    // (was: moved into .kefe-preview-corner, which made them float)

    // The fullscreen button is created by live-preview.js and lives in
    // .preview-live-meta; move just the button into the corner group.
    var focus = document.getElementById('previewFocusButton');
    if (focus && focus.parentElement !== corner) {
      (document.querySelector('.transport')||corner).appendChild(focus);
    }

    // Remove the now-empty .preview-live-meta wrapper if it exists
    var meta = preview.querySelector('.preview-live-meta');
    if (meta && meta.children.length === 0) meta.remove();
  }

  // Run on every DOM mutation so the buttons stay pinned even after
  // wizard rebuilds the preview toolbar.
  setInterval(moveToCorner, 400);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', moveToCorner, { once: true });
  } else {
    moveToCorner();
  }

  console.log('[KEFE] preview corner anchors active');
})();
