/* KEFE — background video upload compatibility.
 *
 * app.js owns the background input and the actual media lifecycle. This file
 * only replaces the optional video-audio probe so a large video is never
 * decoded in full just to decide whether it has an audio track.
 */
(() => {
  'use strict';

  const FAST_PROBE_MARK = '__kefeFastVideoAudioProbeV6';

  function fastDetectVideoHasAudio(_file, video) {
    try {
      if (video?.audioTracks?.length) return Promise.resolve(true);
      if (video?.mozHasAudio) return Promise.resolve(true);
      if (video?.webkitAudioDecodedByteCount > 0) return Promise.resolve(true);
    } catch (_) {}

    // Audio detection is advisory. The loaded video remains authoritative;
    // never block a valid upload on browser-specific track metadata.
    return Promise.resolve(true);
  }

  function install() {
    if (typeof window.detectVideoHasAudio !== 'function') return false;
    if (window.detectVideoHasAudio[FAST_PROBE_MARK]) return true;
    fastDetectVideoHasAudio[FAST_PROBE_MARK] = true;
    window.detectVideoHasAudio = fastDetectVideoHasAudio;
    return true;
  }

  // app.js defines detectVideoHasAudio immediately after this compatibility
  // file in the page. Keep this tiny bridge only until that function exists.
  if (!install()) {
    let attempts = 0;
    const timer = setInterval(() => {
      if (install() || ++attempts >= 200) clearInterval(timer);
    }, 25);
  }
})();
