(function(){
  'use strict';
  if (window.__kefePreviewForce) return;
  window.__kefePreviewForce = true;

  var css = document.createElement('style');
  css.id = 'kefe-preview-css';
  css.textContent = [
    /* 1. Kill the wizard's mini style-preview card. The main canvas is the
          only preview surface in the editor. */
    '.wizard-style-preview{display:none !important}',

    /* 2. Force the main preview to stay expanded on every wizard step.
          wizard.js toggles preview-collapsed on early steps; we override. */
    'body.wizard-mode .preview.preview-collapsed{display:flex !important;visibility:visible !important}',
    'body.wizard-mode .preview.preview-collapsed .canvas-wrapper{display:flex !important}',
    'body.wizard-mode .preview.preview-collapsed canvas{display:block !important}',
    'body.wizard-mode .preview{min-height:0 !important}',

    /* 3. The intro step (before anything is uploaded) gets a small
          "Load audio or video to begin" hint rather than an empty black box. */
  ].join('');
  document.head.appendChild(css);

  function ensureEmptyHint() {
    var wrapper = document.querySelector('.preview .canvas-wrapper');
    if (!wrapper) return null;
    var hint = wrapper.querySelector('.kefe-preview-hint');
    if (hint) return hint;
    hint = document.createElement('div');
    hint.className = 'kefe-preview-hint';
    hint.innerHTML = 'Your preview will appear here.<br>Load audio or video to begin.';
    wrapper.appendChild(hint);
    return hint;
  }

  function hasMedia() {
    var s = window.state || {}, m = window.kefeMedia || {};
    return Boolean(
      (s.audio && s.audio.file) ||
      m.video || m.image || m.videoFile
    );
  }

  function forceExpand() {
    var preview = document.querySelector('.preview');
    if (!preview) return;
    // Never let wizard collapse it.
    preview.classList.remove('preview-collapsed');
    preview.classList.add('preview-expanded');
  }

  function refreshHint() {
    var hint = ensureEmptyHint();
    if (!hint) return;
    hint.classList.toggle('hidden', hasMedia());
  }

  function tick() {
    forceExpand();
    refreshHint();
  }

  tick();
  setInterval(tick, 200);
  ['click','change','input'].forEach(function(ev){
    document.addEventListener(ev, function(){
      setTimeout(tick, 40);
      setTimeout(function(){ try { window.redrawCurrentPreviewFrame?.(); } catch(e){} }, 120);
    }, true);
  });

  // Redraw once media is loaded so the preview lights up immediately.
  var lastHadMedia = false;
  setInterval(function(){
    var now = hasMedia();
    if (now && !lastHadMedia) {
      try { window.redrawCurrentPreviewFrame?.(); } catch(e){}
    }
    lastHadMedia = now;
  }, 300);

  console.log('[KEFE preview] active — mini preview hidden, main preview always expanded');
})();

/* Force the main preview to redraw whenever meaningful state changes —
   media loaded, effect picked, background chosen, wizard step changed,
   captions generated, etc. Never starts playback, only refreshes the
   canvas so the user sees what their current setup looks like. */
(function(){
  'use strict';
  if (window.__kefePreviewSync) return;
  window.__kefePreviewSync = true;

  function signature() {
    var s = window.state || {};
    var m = window.kefeMedia || {};
    var lines = (s.lyrics && s.lyrics.lines) || [];
    var caps = (s.captions && s.captions.lines) || [];
    return [
      document.body.dataset.wizardStep || '',
      s.projectType || '',
      (s.style && s.style.effect) || '',
      (s.style && s.style.visualiserStyle) || '',
      (s.style && s.style.visualFx) || '',
      (s.style && s.style.titleCardEnabled) ? '1' : '0',
      (s.style && s.style.titleCardStyle) || '',
      (s.background && s.background.type) || '',
      (s.background && s.background.solid) || '',
      (s.background && s.background.dim) || '',
      (s.background && s.background.blur) || '',
      (s.audio && s.audio.file && s.audio.file.name) || '',
      (s.audio && s.audio.ready) ? '1' : '0',
      (s.audio && s.audio.metadata && s.audio.metadata.title) || '',
      (s.audio && s.audio.metadata && s.audio.metadata.artist) || '',
      (s.audioSource && s.audioSource.master) || '',
      (m.videoFile && m.videoFile.name) || '',
      (m.video && m.video.readyState) || '0',
      (m.image && m.image.src) || '',
      (s.captions && s.captions.mode) || '',
      lines.length,
      caps.length
    ].join('|');
  }

  function redraw(why) {
    try {
      if (typeof window.redrawCurrentPreviewFrame === 'function') {
        window.redrawCurrentPreviewFrame();
      }
    } catch (e) { /* preview not ready yet — harmless */ }
  }

  var last = '';
  setInterval(function(){
    var sig = signature();
    if (sig !== last) {
      last = sig;
      redraw();
    }
  }, 180);

  // Also nudge on media load events, which can fire after the state
  // signature has already settled (video readyState ticks).
  function attachMediaListeners() {
    var m = window.kefeMedia || {};
    var v = m.video;
    if (v && !v.dataset || (v && !v.__kefeSyncHooked)) {
      if (v) {
        v.__kefeSyncHooked = true;
        ['loadeddata', 'seeked', 'canplay', 'loadedmetadata'].forEach(function(ev){
          v.addEventListener(ev, function(){ redraw('video:' + ev); });
        });
      }
    }
  }
  setInterval(attachMediaListeners, 500);

  console.log('[KEFE] preview sync active');
})();
