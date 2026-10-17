/* KEFE iPhone Lock Screen media integration.
 * Isolated from all lyric renderers, including the Apple Music effect.
 * Web Media Session support varies by browser and iOS version; native Lock Screen
 * lyrics require the companion ActivityKit implementation in apps/ios.
 */
(() => {
  'use strict';
  const audio = document.getElementById('kefeAudio');
  const title = document.getElementById('songTitle');
  const artist = document.getElementById('songArtist');
  const album = document.getElementById('songAlbum');
  if (!audio || !('mediaSession' in navigator)) return;
  const session = navigator.mediaSession;
  let lastPositionUpdate = 0;
  function textValue(input, fallback) { return String(input?.value || '').trim() || fallback; }
  function artwork() {
    const url = album?.dataset?.artUrl;
    return url ? [{ src: url, sizes: '512x512', type: 'image/jpeg' }] : [];
  }
  function syncMetadata() {
    if (!('MediaMetadata' in window)) return;
    try {
      session.metadata = new MediaMetadata({
        title: textValue(title, audio.currentSrc ? 'KEFE audio' : 'KEFE'),
        artist: textValue(artist, 'Unknown artist'),
        album: textValue(album, ''),
        artwork: artwork()
      });
    } catch (error) { console.warn('[KEFE Lock Screen metadata]', error); }
  }
  function syncPlaybackState() {
    try { session.playbackState = audio.paused || audio.ended ? 'paused' : 'playing'; } catch (_) {}
  }
  function seekTo(time) {
    if (!Number.isFinite(time) || !Number.isFinite(audio.duration)) return;
    audio.currentTime = Math.max(0, Math.min(audio.duration, time));
  }
  function setAction(name, callback) { try { session.setActionHandler(name, callback); } catch (_) {} }
  setAction('play', async () => {
    const graph = window.kefeAudioGraph?.context?.();
    if (graph && graph.state === 'suspended') {
      try { await graph.resume(); } catch (error) { console.warn('[KEFE audio context]', error); }
    }
    try { await audio.play(); } catch (error) { console.warn('[KEFE Lock Screen play]', error); }
  });
  setAction('pause', () => audio.pause());
  setAction('stop', () => { audio.pause(); seekTo(0); });
  setAction('seekbackward', details => seekTo(audio.currentTime - (details.seekOffset || 10)));
  setAction('seekforward', details => seekTo(audio.currentTime + (details.seekOffset || 10)));
  setAction('seekto', details => {
    if (details.fastSeek && typeof audio.fastSeek === 'function') audio.fastSeek(details.seekTime);
    else seekTo(details.seekTime);
  });
  function syncPosition(force = false) {
    const now = Date.now();
    if (!force && now - lastPositionUpdate < 1000) return;
    lastPositionUpdate = now;
    if (!Number.isFinite(audio.duration) || audio.duration <= 0 || !Number.isFinite(audio.currentTime)) return;
    try {
      session.setPositionState({
        duration: audio.duration,
        playbackRate: audio.paused ? 0 : (audio.playbackRate || 1),
        position: Math.min(audio.currentTime, audio.duration)
      });
    } catch (_) {}
  }
  ['play', 'pause', 'ended', 'loadedmetadata', 'durationchange', 'seeked', 'ratechange'].forEach(event => {
    audio.addEventListener(event, () => { syncMetadata(); syncPlaybackState(); syncPosition(true); });
  });
  audio.addEventListener('timeupdate', () => syncPosition(false));
  [title, artist, album].forEach(input => {
    input?.addEventListener('input', syncMetadata);
    input?.addEventListener('change', syncMetadata);
  });
  if (album) new MutationObserver(syncMetadata).observe(album, { attributes: true, attributeFilter: ['data-art-url'] });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { syncMetadata(); syncPlaybackState(); syncPosition(true); }
  });
  syncMetadata();
  syncPlaybackState();
})();
