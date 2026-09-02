/* KEFE — background media compatibility and fast upload handoff.
 *
 * app.js owns the actual background renderer. This file only prevents the
 * expensive video-audio probe from reading/decodeing the entire video file.
 * It also gives the UI an immediate loading state while app.js processes the
 * media and keeps the guided workflow in sync with the upload state.
 */
(() => {
  'use strict';

  const videoFiles = new WeakSet();
  const input = document.getElementById('backgroundInput');

  if (input) {
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const status = document.getElementById('backgroundStatus');
      if (String(file.type || '').startsWith('video/')) {
        videoFiles.add(file);
        if (status) {
          status.textContent = 'Loading video…';
          status.className = 'status loading';
        }
      } else if (String(file.type || '').startsWith('image/')) {
        if (status) {
          status.textContent = 'Loading image…';
          status.className = 'status loading';
        }
      }
    }, true);
  }

  const nativeArrayBuffer = File.prototype.arrayBuffer;
  if (typeof nativeArrayBuffer === 'function') {
    File.prototype.arrayBuffer = function() {
      // The old optional video-audio probe attempted to read/decode the entire
      // movie. Make that probe fail fast; normal audio/caption files are untouched.
      if (videoFiles.has(this)) return Promise.resolve(new ArrayBuffer(0));
      return nativeArrayBuffer.call(this);
    };
  }

  const FAST_PROBE_MARK = '__kefeFastVideoAudioProbeV4';
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

  // wizard.js keeps its state private, so keep its source step synchronized with
  // the media object exposed by app.js. This also gives an explicit ready state.
  const syncWizardMedia = () => {
    const media = window.kefeMedia || {};
    const ready = Boolean(media.videoFile || media.image);
    if (!ready) return;
    const action = document.getElementById('wizardSourceAction');
    const next = document.getElementById('wizardNextBtn');
    if (document.body?.dataset?.wizardStep === 'source' && next) next.disabled = false;
    if (action) {
      action.textContent = 'Replace media';
      const strong = action.previousElementSibling;
      if (strong) strong.textContent = media.videoFile ? 'Video ready' : 'Image ready';
    }
  };
  setInterval(syncWizardMedia, 150);
})();
