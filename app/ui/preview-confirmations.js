/* KEFE — confirmation strip on the main preview.
   Shows a short message in the corner of the preview canvas whenever a
   step completes a meaningful action: media loaded, effect chosen,
   background picked, captions generated, etc. Auto-dismisses after a
   few seconds. Non-blocking, doesn't touch the render pipeline. */
(function(){
  'use strict';
  if (window.__kefePreviewConfirmations) return;
  window.__kefePreviewConfirmations = true;

  var css = document.createElement('style');
  css.id = 'kefe-preview-confirmations-css';
  css.textContent = [
    '#kefePreviewConfirm{position:absolute;top:16px;left:16px;z-index:5;',
    '  display:flex;align-items:center;gap:8px;',
    '  padding:8px 12px;border-radius:8px;',
    '  background:rgba(48,209,88,.14);',
    '  border:1px solid rgba(48,209,88,.45);',
    '  color:#30d158;font-size:12px;font-weight:600;letter-spacing:-0.005em;',
    '  pointer-events:none;opacity:0;transform:translateY(-6px);',
    '  transition:opacity .22s ease, transform .22s ease;',
    '  max-width:min(320px, 60%);',
    '}',
    '#kefePreviewConfirm.visible{opacity:1;transform:none}',
    '#kefePreviewConfirm .tick{',
    '  width:14px;height:14px;flex:0 0 14px;border-radius:50%;',
    '  background:#30d158;color:#07140a;',
    '  display:inline-flex;align-items:center;justify-content:center;',
    '  font-size:9px;font-weight:800;line-height:1;',
    '}',
    '#kefePreviewConfirm .text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
  ].join('\n');
  document.head.appendChild(css);

  function host() {
    return document.querySelector('.preview .canvas-wrapper') || document.querySelector('.preview');
  }

  function el() {
    var h = host();
    if (!h) return null;
    var existing = document.getElementById('kefePreviewConfirm');
    if (existing) return existing;
    var box = document.createElement('div');
    box.id = 'kefePreviewConfirm';
    box.innerHTML = '<span class="tick">&#10003;</span><span class="text"></span>';
    if (getComputedStyle(h).position === 'static') h.style.position = 'relative';
    h.appendChild(box);
    return box;
  }

  var dismissTimer = 0;
  function show(message) {
    var box = el();
    if (!box) return;
    box.querySelector('.text').textContent = message;
    box.classList.add('visible');
    clearTimeout(dismissTimer);
    dismissTimer = setTimeout(function() {
      box.classList.remove('visible');
    }, 3200);
  }

  // ---- What triggers a confirmation ----
  var lastSig = '';
  function signature() {
    var s = window.state || {};
    var m = window.kefeMedia || {};
    return [
      (s.audio && s.audio.file && s.audio.file.name) || '',
      (s.audio && s.audio.ready) ? '1' : '0',
      (s.audio && s.audio.metadata && s.audio.metadata.title) || '',
      (m.videoFile && m.videoFile.name) || '',
      (m.image && m.image.src ? '1' : '0') || '',
      (s.style && s.style.effect) || '',
      (s.style && s.style.visualiserStyle) || '',
      (s.style && s.style.titleCardStyle) || '',
      (s.background && s.background.type) || '',
      (s.background && s.background.solid) || '',
      (s.lyrics && s.lyrics.lines && s.lyrics.lines.length) || 0,
      (s.captions && s.captions.lines && s.captions.lines.length) || 0,
      (s.captions && s.captions.mode) || ''
    ].join('|');
  }

  var lastState = {};
  function check() {
    var s = window.state || {};
    var m = window.kefeMedia || {};
    var msg = null;

    // Audio loaded (from not-loaded to loaded)
    var audioName = (s.audio && s.audio.file && s.audio.file.name) || '';
    if (audioName && audioName !== lastState.audioName && s.audio.ready) {
      msg = 'Audio loaded — ' + audioName;
    }
    // Video loaded
    var videoName = (m.videoFile && m.videoFile.name) || '';
    if (videoName && videoName !== lastState.videoName) {
      msg = 'Video loaded — ' + videoName;
    }
    // Image loaded
    var hasImage = Boolean(m.image);
    if (hasImage && !lastState.hasImage) {
      msg = 'Image loaded';
    }
    // Effect changed
    var effect = (s.style && s.style.effect) || '';
    if (effect && effect !== lastState.effect && lastState.effect !== undefined) {
      msg = 'Effect applied — ' + effect;
    }
    // Visualiser style changed
    var vs = (s.style && s.style.visualiserStyle) || '';
    if (vs && vs !== lastState.vs) {
      msg = 'Visualiser style — ' + vs;
    }
    // Title card style changed
    var tcs = (s.style && s.style.titleCardStyle) || '';
    if (tcs && tcs !== lastState.tcs && lastState.tcs !== undefined) {
      msg = 'Title card — ' + tcs;
    }
    // Background type changed
    var bgType = (s.background && s.background.type) || '';
    if (bgType && bgType !== lastState.bgType && lastState.bgType !== undefined) {
      msg = 'Background — ' + bgType;
    }
    // Lyrics loaded
    var lyricCount = (s.lyrics && s.lyrics.lines && s.lyrics.lines.length) || 0;
    if (lyricCount && lyricCount !== lastState.lyricCount && lastState.lyricCount !== undefined) {
      msg = 'Lyrics loaded — ' + lyricCount + ' lines';
    }
    // Captions generated
    var capCount = (s.captions && s.captions.lines && s.captions.lines.length) || 0;
    if (capCount && capCount !== lastState.capCount && lastState.capCount !== undefined) {
      msg = 'Captions generated — ' + capCount + ' blocks';
    }

    // Update last-seen values
    lastState.audioName = audioName;
    lastState.videoName = videoName;
    lastState.hasImage = hasImage;
    lastState.effect = effect;
    lastState.vs = vs;
    lastState.tcs = tcs;
    lastState.bgType = bgType;
    lastState.lyricCount = lyricCount;
    lastState.capCount = capCount;

    if (msg) show(msg);
  }

  setInterval(check, 350);
  console.log('[KEFE] preview confirmations active');
})();
