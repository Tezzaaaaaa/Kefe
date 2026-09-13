/* KEFE — forces the internal audio element to be audible when the master
   source is 'uploaded'. Firefox occasionally leaves a stale <audio> element
   muted or with volume 0 after a re-upload; this forces it back. */
(function(){
  'use strict';
  if (window.__kefeAudioWatchdog) return;
  window.__kefeAudioWatchdog = true;

  function tick() {
    var st = window.state;
    var a = window.kefeAudioElement;
    if (!st || !a) return;
    if (!st.audioSource || st.audioSource.master !== 'uploaded') return;
    if (a.muted !== false) a.muted = false;
    if (a.volume !== 1) a.volume = 1;
  }

  setInterval(tick, 400);
  tick();
  console.log('[KEFE] audio watchdog active');
})();
