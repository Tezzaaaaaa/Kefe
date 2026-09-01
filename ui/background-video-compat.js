/* KEFE — background video upload compatibility
 *
 * Background video detection previously attempted to decode the ENTIRE video
 * file through Web Audio before accepting it. On iOS/Safari and with large
 * MP4/MOV files this can stall the upload for a long time or never resolve.
 *
 * During a video upload we temporarily make that optional audio-track probe
 * fail fast, allowing the existing HTMLVideoElement loader to accept and
 * display the video immediately. The original AudioContext is restored after
 * the probe window so normal audio analysis remains untouched.
 */
(() => {
  'use strict';

  const input = document.getElementById('backgroundInput');
  if (!input) return;

  const NativeAudioContext = window.AudioContext;
  const NativeWebkitAudioContext = window.webkitAudioContext;
  let restoreTimer = null;

  function restoreAudioContext() {
    if (restoreTimer) clearTimeout(restoreTimer);
    restoreTimer = null;
    if (NativeAudioContext) window.AudioContext = NativeAudioContext;
    if (NativeWebkitAudioContext) window.webkitAudioContext = NativeWebkitAudioContext;
  }

  function installFastVideoProbe() {
    restoreAudioContext();

    function FastProbeAudioContext(...args) {
      const Native = NativeAudioContext || NativeWebkitAudioContext;
      if (!Native) throw new Error('AudioContext unavailable');
      const instance = new Native(...args);
      const originalDecode = instance.decodeAudioData.bind(instance);
      instance.decodeAudioData = function () {
        return Promise.reject(new Error('Skip full-video audio decode during background upload'));
      };
      // Keep the native context API intact for the remainder of the call.
      instance.__kefeOriginalDecodeAudioData = originalDecode;
      return instance;
    }

    FastProbeAudioContext.prototype = (NativeAudioContext || NativeWebkitAudioContext)?.prototype || {};
    window.AudioContext = FastProbeAudioContext;
    window.webkitAudioContext = FastProbeAudioContext;

    // The upload handler reaches its optional audio probe after loadeddata.
    // Ten seconds is deliberately generous for slower devices, then restore
    // the native constructor for captions and all other audio processing.
    restoreTimer = setTimeout(restoreAudioContext, 10000);
  }

  // Capture phase runs before app.js's normal change listener.
  input.addEventListener('change', (event) => {
    const file = event.target?.files?.[0];
    if (file && String(file.type || '').toLowerCase().startsWith('video/')) {
      installFastVideoProbe();
    } else {
      restoreAudioContext();
    }
  }, true);
})();
