/* KEFE upload confirmations: visible success state + media thumbnail. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);

  function ensureCard(dropId, statusId, kind) {
    const drop = $(dropId), status = $(statusId);
    if (!drop || !status) return null;
    let card = drop.querySelector('.kefe-upload-confirmation');
    if (!card) {
      card = document.createElement('div');
      card.className = 'kefe-upload-confirmation';
      card.innerHTML = '<div class="kefe-upload-thumb"></div><div class="kefe-upload-info"><div class="kefe-upload-check"><span>✓</span><b>Uploaded</b></div><div class="kefe-upload-name"></div><div class="kefe-upload-meta"></div></div>';
      drop.appendChild(card);
    }
    return card;
  }

  function setCard(dropId, statusId, kind, file, visual, meta) {
    const card = ensureCard(dropId, statusId, kind);
    if (!card) return;
    const thumb = card.querySelector('.kefe-upload-thumb');
    const name = card.querySelector('.kefe-upload-name');
    const info = card.querySelector('.kefe-upload-meta');
    card.classList.add('is-visible');
    name.textContent = file?.name || (kind === 'audio' ? 'Audio loaded' : 'Background loaded');
    info.textContent = meta || (file ? `${(file.size / 1048576).toFixed(1)} MB` : 'Ready');
    thumb.replaceChildren();
    if (visual instanceof HTMLVideoElement) {
      const poster = document.createElement('canvas');
      poster.width = 320; poster.height = 180;
      const ctx = poster.getContext('2d');
      try { ctx.drawImage(visual, 0, 0, poster.width, poster.height); thumb.style.backgroundImage = `url(${poster.toDataURL('image/jpeg', .82)})`; } catch (_) {}
      thumb.classList.add('video-thumb');
    } else if (visual instanceof HTMLImageElement) {
      thumb.style.backgroundImage = `url(${visual.src})`;
    } else {
      thumb.classList.add('audio-thumb');
      thumb.textContent = '♪';
    }
  }

  function hide(dropId) {
    const card = document.querySelector(`#${dropId} .kefe-upload-confirmation`);
    if (card) card.classList.remove('is-visible');
  }

  function refresh() {
    const state = window.state;
    const media = window.kefeMedia;
    if (!state || !media) return;

    if (state.audio?.file && (state.audio.ready || state.audio.duration > 0)) {
      setCard('audioDrop', 'audioStatus', 'audio', state.audio.file, null,
        [state.audio.metadata?.title, state.audio.metadata?.artist].filter(Boolean).join(' · ') || 'Audio ready');
    } else hide('audioDrop');

    if (media.video && media.videoFile) {
      setCard('bgDrop', 'backgroundStatus', 'video', media.videoFile, media.video, `${media.video.videoWidth || 0} × ${media.video.videoHeight || 0} · Video ready`);
    } else if (media.image) {
      setCard('bgDrop', 'backgroundStatus', 'image', null, media.image, `${media.image.naturalWidth || 0} × ${media.image.naturalHeight || 0} · Image ready`);
    } else hide('bgDrop');
  }

  function injectStyle() {
    if (document.getElementById('kefe-upload-confirmation-style')) return;
    const style = document.createElement('style');
    style.id = 'kefe-upload-confirmation-style';
    style.textContent = `
      .kefe-upload-confirmation{display:none;align-items:center;gap:12px;margin-top:10px;padding:10px;border:1px solid rgba(48,209,88,.72);border-radius:12px;background:linear-gradient(135deg,rgba(48,209,88,.16),rgba(48,209,88,.06));box-shadow:0 0 0 1px rgba(48,209,88,.08),0 8px 22px rgba(0,0,0,.18);text-align:left}
      .kefe-upload-confirmation.is-visible{display:flex}
      .kefe-upload-thumb{width:58px;height:58px;flex:0 0 58px;border-radius:9px;background:var(--surface-3);background-position:center;background-size:cover;display:flex;align-items:center;justify-content:center;color:#fff;font-size:28px;font-weight:700;overflow:hidden}
      .kefe-upload-thumb.audio-thumb{background:linear-gradient(135deg,var(--red),#3070d0)}
      .kefe-upload-info{min-width:0;display:flex;flex-direction:column;gap:2px}
      .kefe-upload-check{display:flex;align-items:center;gap:6px;color:#30d158;font-size:12px;text-transform:uppercase;letter-spacing:.06em}
      .kefe-upload-check span{width:18px;height:18px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:#30d158;color:#07140a;font-size:12px;font-weight:800}
      .kefe-upload-name{font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:245px}
      .kefe-upload-meta{font-size:10.5px;color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:245px}
      #audioDrop:has(.kefe-upload-confirmation.is-visible),#bgDrop:has(.kefe-upload-confirmation.is-visible){border-color:rgba(48,209,88,.65);background:rgba(48,209,88,.055)}
    `;
    document.head.appendChild(style);
  }

  function start() {
    injectStyle();
    refresh();
    setInterval(refresh, 350);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true}); else start();
})();
