/* KEFE — background media compatibility and fast upload handoff.
 *
 * app.js owns the actual background renderer. This file only prevents the
 * expensive video-audio probe from reading/decodeing the entire video file.
 * It also gives the UI an immediate loading state while app.js processes the
 * media, so an upload never appears frozen.
 */
(() => {
  'use strict';

  const videoFiles = new WeakSet();
  const input = document.getElementById('backgroundInput');

  // app.js is loaded immediately after this file. Mark video Files before its
  // change handler runs; the patched File.arrayBuffer below then makes the
  // optional audio probe return immediately instead of reading a huge movie.
  if (input) {
    input.addEventListener('change', event => {
      const file = input.files && input.files[0];
      if (!file) return;
      if (String(file.type || '').startsWith('video/')) {
        videoFiles.add(file);
        const status = document.getElementById('backgroundStatus');
        if (status) {
          status.textContent = 'Loading video…';
          status.className = 'status loading';
        }
      } else if (String(file.type || '').startsWith('image/')) {
        const status = document.getElementById('backgroundStatus');
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
      // detectVideoHasAudio() only needs this call for its old Web Audio probe.
      // Returning an empty buffer makes that optional probe fail fast, after
      // which app.js uses browser media-track indicators instead.
      if (videoFiles.has(this)) return Promise.resolve(new ArrayBuffer(0));
      return nativeArrayBuffer.call(this);
    };
  }

  // Keep the legacy global probe safe for any other caller too. It never reads
  // the complete video and therefore cannot stall a large upload.
  const FAST_PROBE_MARK = '__kefeFastVideoAudioProbeV3';
  function fastDetectVideoHasAudio(file, vid) {
    try {
      if (vid?.audioTracks?.length) return Promise.resolve(true);
      if (vid?.mozHasAudio) return Promise.resolve(true);
      if (vid?.webkitAudioDecodedByteCount > 0) return Promise.resolve(true);
    } catch (_) {}
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
})();
