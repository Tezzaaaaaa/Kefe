/* KEFE — background media compatibility and reliable upload handoff.
 *
 * app.js owns the actual background renderer. This file keeps the shared
 * image/video picker reliable across every guided workflow path and avoids
 * the expensive video-audio probe reading/decoding the entire movie file.
 */
(() => {
  'use strict';

  const videoFiles = new WeakSet();
  const input = document.getElementById('backgroundInput');

  function setStatus(text, kind = '') {
    const status = document.getElementById('backgroundStatus');
    if (!status) return;
    status.textContent = text;
    status.className = `status${kind ? ` ${kind}` : ''}`;
  }

  function openPicker() {
    const picker = document.getElementById('backgroundInput');
    if (!picker) return false;
    // Allow selecting the exact same file again. This is important when a
    // previous upload failed or the user is replacing media with the same file.
    picker.value = '';
    picker.click();
    return true;
  }

  if (input) {
    // Reset before every picker opening so repeated selections fire change.
    input.addEventListener('click', () => { input.value = ''; }, true);

    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const type = String(file.type || '').toLowerCase();
      if (type.startsWith('video/')) {
        videoFiles.add(file);
        setStatus('Loading video…', 'loading');
      } else if (type.startsWith('image/')) {
        setStatus('Loading image…', 'loading');
      }
    }, true);
  }

  // All workflow paths ultimately use the same backgroundInput. Keep every
  // dynamically-created wizard upload/replace control wired to that picker.
  document.addEventListener('click', event => {
    const target = event.target?.closest?.('#wizardSourceAction,[data-background-upload],.wizard-background-upload');
    if (!target) return;
    if (target.matches('button')) {
      event.preventDefault();
      event.stopPropagation();
      openPicker();
    }
  }, true);

  const nativeArrayBuffer = File.prototype.arrayBuffer;
  if (typeof nativeArrayBuffer === 'function') {
    File.prototype.arrayBuffer = function() {
      // The old optional video-audio probe attempted to read/decode the entire
      // movie. Make that probe fail fast; normal audio/caption files are untouched.
      if (videoFiles.has(this)) return Promise.resolve(new ArrayBuffer(0));
      return nativeArrayBuffer.call(this);
    };
  }

  const FAST_PROBE_MARK = '__kefeFastVideoAudioProbeV5';
  function fastDetectVideoHasAudio(file, vid) {
    try {
      if (vid?.audioTracks?.length) return Promise.resolve(true);
      if (vid?.mozHasAudio) return Promise.resolve(true);
      if (vid?.webkitAudioDecodedByteCount > 0) return Promise.resolve(true);
    } catch (_) {}
    // Audio-track detection is advisory only. The video itself is already a
    // valid background source, so never block upload completion on this probe.
    return Promise.resolve(true);
  }

  function install() {
    if (typeof window.detectVideoHasAudio !== 'function') return false;
    if (window.detectVideoHasAudio[FAST_PROBE_MARK]) return true;
    fastDetectVideoHasAudio[FAST_PROBE_MARK] = true;
    window.detectVideoHasAudio = fastDetectVideoHasAudio;
    return true;
  }

  if (!install()) {
    let attempts = 0;
    const timer = setInterval(() => {
      if (install() || ++attempts >= 200) clearInterval(timer);
    }, 25);
  }

  // wizard.js keeps its state private. Poll the public media object so the
  // source step always shows an explicit ready state after image/video load.
  const syncWizardMedia = () => {
    const media = window.kefeMedia || {};
    const ready = Boolean(media.videoFile || media.image);
    const action = document.getElementById('wizardSourceAction');
    const next = document.getElementById('wizardNextBtn');

    if (document.body?.dataset?.wizardStep === 'source' && next) {
      next.disabled = !ready && document.body.dataset.wizardSource !== 'none';
    }
    if (action && ready) {
      action.textContent = 'Replace media';
      const strong = action.previousElementSibling;
      if (strong) strong.textContent = media.videoFile ? 'Video ready' : 'Image ready';
    }
  };
  setInterval(syncWizardMedia, 150);
})();
