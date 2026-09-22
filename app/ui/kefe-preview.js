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

    /* 3. The intro step stays logo-only before any media is loaded. */
  ].join('');
  document.head.appendChild(css);

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

  function tick() {
    forceExpand();
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

;(function(){if(window.__kefeLogoBackdrop)return;window.__kefeLogoBackdrop=true;function ensure(){var w=document.querySelector(".preview .canvas-wrapper");if(!w)return null;var e=w.querySelector(".preview-logo-backdrop");if(!e){e=document.createElement("div");e.className="preview-logo-backdrop";w.appendChild(e)}return e}function hasMedia(){var s=window.state||{},m=window.kefeMedia||{};return Boolean((s.audio&&s.audio.file)||m.video||m.image||m.videoFile)}function tick(){var e=ensure(),p=document.querySelector(".preview");if(!e||!p)return;var media=hasMedia();e.style.display=media?"none":"block";p.classList.toggle("is-placeholder",!media)}tick();setInterval(tick,400)})();

