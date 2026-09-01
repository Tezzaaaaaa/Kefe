(() => {
  'use strict';
  // Background video is one combined media choice. The uploaded video's own
  // audio is the soundtrack; do not present a separate background-video-audio
  // choice in the guided workflow.
  if (window.kefeBackgroundVideoUpload) return;

  const input = document.getElementById('backgroundInput');
  if (!input) return;

  const setMedia = file => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    window.kefeMedia = window.kefeMedia || {};
    const media = window.kefeMedia;
    if (media.video && media.video.src) {
      try { media.video.pause(); } catch (_) {}
      try { URL.revokeObjectURL(media.video.src); } catch (_) {}
    }
    const video = document.createElement('video');
    video.src = url;
    video.preload = 'metadata';
    video.playsInline = true;
    video.muted = false;
    video.addEventListener('loadedmetadata', () => {
      media.video = video;
      media.videoFile = file;
      media.videoHasAudio = true;
      media.image = null;
      media.imageFile = null;
      window.dispatchEvent(new CustomEvent('kefe:background-video-ready', { detail: { file, video } }));
    }, { once: true });
    video.addEventListener('error', () => {
      try { URL.revokeObjectURL(url); } catch (_) {}
      window.dispatchEvent(new CustomEvent('kefe:background-video-error', { detail: { file } }));
    }, { once: true });
    video.load();
  };

  input.addEventListener('change', () => setMedia(input.files && input.files[0]));
  window.kefeBackgroundVideoUpload = { setMedia };
})();