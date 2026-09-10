/* KEFE — background image/video upload compatibility. */
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

  if (!input) return;

  // Selecting the same file twice must still fire change so replacement is reliable.
  input.addEventListener('click', () => { input.value = ''; }, true);
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;
    const type = String(file.type || '').toLowerCase();
    if (type.startsWith('video/')) {
      videoFiles.add(file);
      setStatus('Loading video…', 'loading');
    } else if (type.startsWith('image/')) {
      setStatus('Loading image…', 'loading');
    }
  }, true);

  // The optional video-audio probe must never read an entire movie into memory.
  const nativeArrayBuffer = File.prototype.arrayBuffer;
  if (typeof nativeArrayBuffer === 'function') {
    File.prototype.arrayBuffer = function () {
      if (videoFiles.has(this)) return Promise.resolve(new ArrayBuffer(0));
      return nativeArrayBuffer.call(this);
    };
  }

  const FAST_PROBE_MARK = '__kefeFastVideoAudioProbeV6';
  function fastDetectVideoHasAudio(_file, video) {
    try {
      if (video?.audioTracks?.length) return Promise.resolve(true);
      if (video?.mozHasAudio) return Promise.resolve(true);
      if (video?.webkitAudioDecodedByteCount > 0) return Promise.resolve(true);
    } catch (_) {}
    // Audio detection is advisory. A valid background video must not be blocked by it.
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
