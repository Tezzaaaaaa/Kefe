/* KEFE — background image/video upload compatibility. */
(() => {
  'use strict';
  const videoFiles = new WeakSet();
  const input = document.getElementById('backgroundInput');
  const status = document.getElementById('backgroundStatus');
  function setStatus(text, kind = '') {
    if (!status) return;
    status.textContent = text;
    status.className = `status${kind ? ` ${kind}` : ''}`;
  }
  if (!input) return;
  input.addEventListener('click', () => { input.value = ''; }, true);
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;
    if (String(file.type || '').toLowerCase().startsWith('video/')) videoFiles.add(file);
    setStatus(`Loading ${file.type.startsWith('video/') ? 'video' : 'image'}…`, 'loading');
  }, true);

  const nativeArrayBuffer = File.prototype.arrayBuffer;
  if (typeof nativeArrayBuffer === 'function') File.prototype.arrayBuffer = function () {
    if (videoFiles.has(this)) return Promise.resolve(new ArrayBuffer(0));
    return nativeArrayBuffer.call(this);
  };

  const FAST_PROBE_MARK = '__kefeFastVideoAudioProbeV6';
  function fastDetectVideoHasAudio(_file, video) {
    try {
      if (video?.audioTracks?.length || video?.mozHasAudio || video?.webkitAudioDecodedByteCount > 0) return Promise.resolve(true);
    } catch (_) {}
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
    const timer = setInterval(() => { if (install() || ++attempts >= 200) clearInterval(timer); }, 25);
  }

  /* Upload portals need an explicit, in-portal confirmation without replacing
     the existing handlers or creating a second upload pipeline. */
  const portals = [
    ['audioInput', 'audioDrop', 'audioStatus', 'Media'],
    ['backgroundInput', 'bgDrop', 'backgroundStatus', 'Background media'],
    ['lrcFileInput', 'lyricsPanel', 'lyricsStatus', 'Lyrics']
  ];
  const size = bytes => {
    if (!Number.isFinite(bytes) || bytes < 1024) return `${bytes || 0} B`;
    const units = ['KB', 'MB', 'GB']; let n = bytes; let i = -1;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return `${n >= 10 ? n.toFixed(0) : n.toFixed(1)} ${units[i]}`;
  };
  const makeCard = (input, zone, label) => {
    let card = zone.querySelector('.kefe-upload-confirmation');
    if (card) return card;
    card = document.createElement('div');
    card.className = 'kefe-upload-confirmation'; card.hidden = true;
    card.setAttribute('role', 'status'); card.setAttribute('aria-live', 'polite');
    card.innerHTML = '<span class="kefe-upload-icon"></span><span class="kefe-upload-copy"></span><button type="button" class="kefe-upload-retry">Replace</button>';
    zone.appendChild(card);
    card.querySelector('button').onclick = () => input.click();
    return card;
  };
  const render = (card, state, label, file) => {
    card.hidden = false; card.dataset.state = state;
    card.querySelector('.kefe-upload-icon').textContent = state === 'success' ? '✓' : state === 'error' ? '!' : '…';
    card.querySelector('.kefe-upload-copy').innerHTML = state === 'success'
      ? `<strong>Upload complete</strong><span>${file.name} · ${size(file.size)}</span>`
      : state === 'error'
        ? `<strong>Upload failed</strong><span>${file.name} could not be loaded.</span>`
        : `<strong>Uploading ${label.toLowerCase()}</strong><span>${file.name}</span>`;
    card.querySelector('button').textContent = state === 'loading' ? 'Replace' : state === 'error' ? 'Try again' : 'Replace';
  };
  const setup = ([inputId, zoneId, statusId, label]) => {
    const el = document.getElementById(inputId), zone = document.getElementById(zoneId), stat = document.getElementById(statusId);
    if (!el || !zone || !stat) return;
    const card = makeCard(el, zone, label);
    el.addEventListener('change', () => {
      const file = el.files?.[0]; if (!file) return;
      render(card, 'loading', label, file);
      let tries = 0;
      const timer = setInterval(() => {
        if (stat.classList.contains('success')) { clearInterval(timer); render(card, 'success', label, file); }
        else if (stat.classList.contains('error') || ++tries >= 150) { clearInterval(timer); render(card, 'error', label, file); }
      }, 100);
    }, true);
  };
  const style = document.createElement('style');
  style.textContent = '.kefe-upload-confirmation{display:grid;grid-template-columns:26px minmax(0,1fr) auto;align-items:center;gap:9px;margin-top:10px;padding:9px 10px;border:1px solid var(--line);border-radius:10px;background:var(--surface-3);text-align:left}.kefe-upload-confirmation[data-state=success]{border-color:var(--red)}.kefe-upload-confirmation[data-state=error]{border-color:var(--red)}.kefe-upload-icon{display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:var(--surface-2);color:var(--red);font-weight:800}.kefe-upload-copy{display:flex;min-width:0;flex-direction:column;gap:2px}.kefe-upload-copy strong{font-size:11px;color:var(--text)}.kefe-upload-copy span{overflow:hidden;color:var(--text-3);font-size:10px;text-overflow:ellipsis;white-space:nowrap}.kefe-upload-retry{min-height:29px;padding:5px 9px;border:1px solid var(--line);border-radius:7px;background:var(--surface-2);color:var(--text-2);font-size:10px;font-weight:700}.kefe-upload-confirmation[data-state=loading] .kefe-upload-icon{animation:kefeUploadPulse 1s ease-in-out infinite}@keyframes kefeUploadPulse{50%{opacity:.4;transform:scale(.9)}}';
  document.head.appendChild(style);
  portals.forEach(setup);
})();
