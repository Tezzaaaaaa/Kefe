/* KEFE upload confirmations: stable success state for audio and background media. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let lastAudioFile = null;
  let lastMediaFile = null;
  let lastMediaVisual = null;
  let lastWizardAction = null;
  let lastWizardState = '';

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

    // Only rebuild the thumbnail when the actual uploaded media changes.
    if (visual === lastMediaVisual && file === lastMediaFile && kind !== 'audio') return;
    thumb.replaceChildren();
    thumb.style.backgroundImage = '';
    if (visual instanceof HTMLVideoElement) {
      const poster = document.createElement('canvas');
      poster.width = 320;
      poster.height = 180;
      const ctx = poster.getContext('2d');
      try {
        ctx.drawImage(visual, 0, 0, poster.width, poster.height);
        thumb.style.backgroundImage = `url(${poster.toDataURL('image/jpeg', .82)})`;
      } catch (_) {}
      thumb.classList.add('video-thumb');
      thumb.classList.remove('audio-thumb');
    } else if (visual instanceof HTMLImageElement) {
      thumb.style.backgroundImage = `url(${visual.src})`;
      thumb.classList.remove('audio-thumb');
    } else {
      thumb.classList.add('audio-thumb');
      thumb.textContent = '♪';
    }
    if (kind === 'audio') lastAudioFile = file;
    else {
      lastMediaFile = file;
      lastMediaVisual = visual;
    }
  }

  function hide(dropId) {
    const card = document.querySelector(`#${dropId} .kefe-upload-confirmation`);
    if (card) card.classList.remove('is-visible');
  }

  function updateWizardMediaConfirmation(media) {
    const action = $('wizardSourceAction');
    if (!action) return;
    const readyVideo = Boolean(media?.video && media?.videoFile);
    const readyImage = Boolean(media?.image && !readyVideo);
    const ready = readyVideo || readyImage;
    const type = readyVideo ? 'video' : readyImage ? 'image' : 'none';
    const key = `${type}:${ready ? 'ready' : 'empty'}`;
    const strong = action.querySelector('strong') || action.previousElementSibling;
    if (!strong) return;

    // Wizard re-renders can replace the action node. Update only that new node
    // or when the underlying media state actually changes.
    if (action === lastWizardAction && key === lastWizardState) return;
    lastWizardAction = action;
    lastWizardState = key;

    action.classList.toggle('is-ready', ready);
    strong.classList.toggle('wizard-upload-success', ready);
    if (readyVideo) strong.innerHTML = '<span class="wizard-upload-check">✓</span> Video uploaded';
    else if (readyImage) strong.innerHTML = '<span class="wizard-upload-check">✓</span> Image uploaded';
  }

  function refresh() {
    const state = window.state || {};
    const media = window.kefeMedia || {};
    const audioReady = Boolean(state.audio?.file && (state.audio.ready || state.audio.duration > 0));

    if (audioReady) {
      if (state.audio.file !== lastAudioFile) {
        setCard('audioDrop', 'audioStatus', 'audio', state.audio.file, null,
          [state.audio.metadata?.title, state.audio.metadata?.artist].filter(Boolean).join(' · ') || 'Audio ready');
      }
    } else hide('audioDrop');

    if (media.video && media.videoFile) {
      if (media.videoFile !== lastMediaFile || media.video !== lastMediaVisual) {
        setCard('bgDrop', 'backgroundStatus', 'video', media.videoFile, media.video, 'Video ready');
      } else {
        const card = ensureCard('bgDrop', 'backgroundStatus', 'video');
        card?.classList.add('is-visible');
      }
    } else if (media.image) {
      if (media.image !== lastMediaVisual) setCard('bgDrop', 'backgroundStatus', 'image', null, media.image, 'Image ready');
      else ensureCard('bgDrop', 'backgroundStatus', 'image')?.classList.add('is-visible');
    } else hide('bgDrop');

    updateWizardMediaConfirmation(media);
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
      .wizard-source-action.is-ready{border-color:rgba(48,209,88,.58);background:rgba(48,209,88,.055)}
      .wizard-upload-success{display:inline-flex;align-items:center;gap:7px;color:#30d158!important;font-weight:700}
      .wizard-upload-check{width:18px;height:18px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:#30d158;color:#07140a;font-size:12px;font-weight:800;line-height:1}
    `;
    document.head.appendChild(style);
  }

  function start() {
    injectStyle();
    refresh();
    // Keep a lightweight readiness watcher, but never rebuild stable UI every tick.
    setInterval(refresh, 500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true}); else start();
})();