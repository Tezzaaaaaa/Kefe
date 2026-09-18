/* KEFE — Cleanup Pass 2
   Adds a "Fine-tune sync" toggle to the preview toolbar that
   reveals the lyric sync fallback row (injected by preview-video-strip.js).
   Hides the row by default. Does not modify the row's behavior. */
(function(){
  'use strict';
  if (window.__kefeCleanup2) return;
  window.__kefeCleanup2 = true;

  function mount() {
    var preview = document.querySelector('.preview');
    var heading = document.querySelector('.preview-heading');
    var row = document.getElementById('kefeSyncRow');
    if (!preview || !heading || !row) return false;
    if (document.querySelector('.kefe-sync-toggle')) return true;

    // ensure closed by default
    preview.dataset.kefeSyncOpen = 'false';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'kefe-sync-toggle';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'kefeSyncRow');
    btn.title = 'Fine-tune lyric timing if autosync was slightly off';
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M4 12h4l2-6 4 12 2-6h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>' +
      '<span>Fine-tune sync</span>';

    btn.addEventListener('click', function(){
      var open = preview.dataset.kefeSyncOpen === 'true';
      preview.dataset.kefeSyncOpen = open ? 'false' : 'true';
      btn.setAttribute('aria-expanded', open ? 'false' : 'true');
    });

    // place just before the status chip so it reads: Preview • Lyrics • Ready • [Fine-tune]
    var statusChip = heading.querySelector('#previewStatus');
    if (statusChip && statusChip.parentElement === heading) {
      heading.insertBefore(btn, statusChip);
    } else {
      heading.appendChild(btn);
    }
    return true;
  }

  var tries = 0;
  var iv = setInterval(function(){
    if (mount() || ++tries > 100) clearInterval(iv);
  }, 100);
})();
