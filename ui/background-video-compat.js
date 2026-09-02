/* KEFE — background video upload compatibility
 *
 * IMPORTANT: app.js must never decode an entire background video through
 * Web Audio just to decide whether the video has an audio track. Large
 * MP4/MOV files can make that operation extremely slow or hang on iOS/Safari.
 *
 * This file is loaded before app.js, so it waits for the global
 * detectVideoHasAudio function to exist and then replaces only that optional
 * probe. The actual HTMLVideoElement loading/rendering path in app.js remains
 * unchanged.
 */
(() => {
  'use strict';

  const FAST_PROBE_MARK = '__kefeFastVideoAudioProbeV2';

  function fastDetectVideoHasAudio(file, vid) {
    // Never read/decode the complete File. Browser track metadata is cheap
    // when exposed; otherwise we treat the track as available rather than
    // blocking the upload. Playback itself remains the authoritative test.
    try {
      if (vid?.audioTracks?.length) return Promise.resolve(true);
      if (vid?.mozHasAudio) return Promise.resolve(true);
      if (vid?.webkitAudioDecodedByteCount > 0) return Promise.resolve(true);
    } catch (_) {}

    // Safari/iOS commonly exposes none of the above. Returning true keeps the
    // video immediately usable and allows the existing master-source logic to
    // play the video's own audio. No Web Audio context or ArrayBuffer is used.
    return Promise.resolve(true);
  }

  function install() {
    if (typeof window.detectVideoHasAudio !== 'function') return false;
    if (window.detectVideoHasAudio[FAST_PROBE_MARK]) return true;

    fastDetectVideoHasAudio[FAST_PROBE_MARK] = true;
    window.detectVideoHasAudio = fastDetectVideoHasAudio;
    return true;
  }

  // app.js is loaded immediately after this file. Poll briefly until its
  // global function declaration has been installed, then replace the probe.
  if (!install()) {
    let attempts = 0;
    const timer = setInterval(() => {
      if (install() || ++attempts >= 200) clearInterval(timer);
    }, 25);
  }
})();
