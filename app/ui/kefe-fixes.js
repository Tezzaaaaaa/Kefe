/* KEFE — consolidated UI fixes. Loads last so it can correct earlier modules. */
(() => {
  'use strict';

  function ensureConfirmationCss() {
    if (document.getElementById('kefe-fix-confirm-css')) return;
    const s = document.createElement('style');
    s.id = 'kefe-fix-confirm-css';
    s.textContent = [
      '.kefe-upload-confirmation{display:none;align-items:center;gap:12px;margin-top:10px;padding:10px;border:1px solid rgba(48,209,88,.72);border-radius:12px;background:linear-gradient(135deg,rgba(48,209,88,.16),rgba(48,209,88,.06));text-align:left}',
      '.kefe-upload-confirmation.is-visible{display:flex !important}',
      '.kefe-upload-thumb{width:58px;height:58px;flex:0 0 58px;border-radius:9px;background:var(--surface-3);display:flex;align-items:center;justify-content:center;color:#fff;font-size:28px;font-weight:700;overflow:hidden;background-position:center;background-size:cover}',
      '.kefe-upload-thumb.audio-thumb{background:linear-gradient(135deg,var(--red),#a8241d)}',
      '.kefe-upload-info{min-width:0;display:flex;flex-direction:column;gap:2px}',
      '.kefe-upload-check{display:flex;align-items:center;gap:6px;color:#30d158;font-size:12px;text-transform:uppercase;letter-spacing:.06em}',
      '.kefe-upload-check span{width:18px;height:18px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:#30d158;color:#07140a;font-size:12px;font-weight:800}',
      '.kefe-upload-name{font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:245px}',
      '.kefe-upload-meta{font-size:10.5px;color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:245px}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function forceConfirmation(dropId) {
    const drop = document.getElementById(dropId);
    if (!drop) return null;
    let card = drop.querySelector('.kefe-upload-confirmation');
    if (!card) {
      card = document.createElement('div');
      card.className = 'kefe-upload-confirmation';
      card.innerHTML = '<div class="kefe-upload-thumb"></div><div class="kefe-upload-info"><div class="kefe-upload-check"><span>&#10003;</span><b>Uploaded</b></div><div class="kefe-upload-name"></div><div class="kefe-upload-meta"></div></div>';
      drop.appendChild(card);
    }
    return card;
  }

  function refreshUploadConfirmation() {
    const state = window.state || {};
    const media = window.kefeMedia || {};
    ensureConfirmationCss();

    const audioFile = state.audio && state.audio.file;
    const audioReady = Boolean(audioFile && (state.audio.ready || state.audio.duration > 0));
    const audioCard = audioFile ? forceConfirmation('audioDrop') : null;
    if (audioCard) {
      audioCard.classList.toggle('is-visible', audioReady);
      const name = audioCard.querySelector('.kefe-upload-name');
      const meta = audioCard.querySelector('.kefe-upload-meta');
      if (name) name.textContent = audioFile.name || 'Audio loaded';
      if (meta) meta.textContent = [(state.audio.metadata || {}).title, (state.audio.metadata || {}).artist].filter(Boolean).join(' - ') || 'Audio ready';
    }

    const bgFile = media.videoFile;
    const hasBg = Boolean(media.video || media.image);
    const bgCard = hasBg ? forceConfirmation('bgDrop') : null;
    if (bgCard) {
      bgCard.classList.add('is-visible');
      const name = bgCard.querySelector('.kefe-upload-name');
      const meta = bgCard.querySelector('.kefe-upload-meta');
      if (name) name.textContent = (bgFile && bgFile.name) || (media.image ? 'Image loaded' : 'Background loaded');
      if (meta) meta.textContent = media.video ? 'Video ready' : media.image ? 'Image ready' : 'Ready';
    }
  }

  function patchComboboxes() {
    document.querySelectorAll('.kefe-song-combobox-list [role="option"]').forEach(function (opt) {
      if (opt.dataset.kefeFixed === '1') return;
      opt.dataset.kefeFixed = '1';
      opt.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        opt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      }, true);
    });
  }

  function patchEffectButtons() {
    if (document.getElementById('kefe-fix-fx-css')) return;
    const s = document.createElement('style');
    s.id = 'kefe-fix-fx-css';
    s.textContent = [
      '#lyricStyleBlock .effect-buttons{display:grid !important;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}',
      '#lyricStyleBlock .effect-buttons button{position:relative !important;isolation:isolate;overflow:hidden;min-height:64px;padding:12px 10px;white-space:normal !important;text-align:left;font-weight:600}',
      '#lyricStyleBlock .effect-buttons button::before{position:absolute !important;inset:0;border-radius:inherit;z-index:-2}',
      '#lyricStyleBlock .effect-buttons button::after{position:absolute !important;left:10px;right:10px;top:10px;height:18px;border-radius:6px;z-index:-1}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function patchBackgroundSwatches() {
    if (document.getElementById('kefe-fix-bg-css')) return;
    const s = document.createElement('style');
    s.id = 'kefe-fix-bg-css';
    s.textContent = [
      '#backgroundSection .background-choice-grid{display:grid !important;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}',
      '#backgroundSection .background-choice{display:flex !important;flex-direction:column;gap:6px;padding:8px;border:1px solid var(--line);border-radius:10px;background:var(--surface);cursor:pointer;color:var(--text);text-align:left;min-height:0}',
      '#backgroundSection .background-choice-preview{display:block !important;width:100% !important;height:56px !important;border-radius:7px;background:#0a0a0a;flex:0 0 auto}',
      '#backgroundSection .background-choice-label{display:block !important;font-size:11px;font-weight:600;color:var(--text-2);line-height:1.25}',
      '#backgroundSection .background-choice.active-background{border-color:var(--red);box-shadow:0 0 0 1px var(--red)}',
      '@media(max-width:560px){#backgroundSection .background-choice-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function boot() {
    patchEffectButtons();
    patchBackgroundSwatches();
    ensureConfirmationCss();
    refreshUploadConfirmation();
    patchComboboxes();
    setInterval(refreshUploadConfirmation, 400);
    setInterval(patchComboboxes, 800);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
