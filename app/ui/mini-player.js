/* KEFE Now Playing — compact disc-and-card player skin with Butterchurn visuals. */
(() => {
  'use strict';
  if (window.kefeMiniPlayer) return;

  const player = document.createElement('div');
  player.id = 'kefeMiniPlayerModal';
  player.className = 'kefe-mini-modal is-hidden';
  player.setAttribute('role', 'dialog');
  player.setAttribute('aria-modal', 'true');
  player.setAttribute('aria-label', 'KEFE Now Playing');
  player.innerHTML = `
    <div class="kefe-mini-shell">
      <div class="kefe-mini-topline"><span>KEFE / NOW PLAYING</span><div class="kefe-mini-topline-actions"><button type="button" id="kefeMiniSkinToggle" class="kefe-mini-icon-button" aria-label="Switch to Skin 2" title="Skin 2"><span aria-hidden="true">S2</span></button><button type="button" id="kefeMiniFullscreen" class="kefe-mini-icon-button" aria-label="Enter fullscreen" title="Fullscreen"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4H4v4M16 4h4v4M8 20H4v-4M20 16v4h-4"/></svg></button><button type="button" id="kefeMiniClose" class="kefe-mini-close" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div></div>
      <div id="kefeMiniCard" class="kefe-mini-card" role="button" tabindex="0" aria-pressed="false" aria-label="Show cover art" title="Tap to show cover art">
        <div class="kefe-mini-body">
          <div class="kefe-mini-art">
            <div class="kefe-mini-spin">
              <canvas id="kefeMiniCanvas" width="720" height="720"></canvas>
              <div class="kefe-mini-hub"></div>
            </div>
            <div class="kefe-mini-art-caption" aria-hidden="true"><strong id="kefeMiniCapArtist"></strong><span id="kefeMiniCapTitle"></span></div>
          </div>
          <div class="kefe-mini-info">
            <div class="kefe-mini-eq" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
            <div id="kefeMiniArtist" class="kefe-mini-artist">Add music to begin</div>
            <div id="kefeMiniTitle" class="kefe-mini-title">Nothing queued</div>
            <div class="kefe-mini-bar" aria-hidden="true"><span id="kefeMiniProgress"></span></div>
          </div>
          <div id="kefeMiniControlPanel" class="kefe-mini-control-panel">
        <button type="button" id="kefeMiniUpload" class="kefe-mini-add"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V5M8 9l4-4 4 4M5 19h14"/></svg><span>Upload media</span></button><input id="kefeMiniFiles" type="file" accept="audio/*,.aac,.aif,.aiff,.alac,.amr,.ape,.au,.caf,.flac,.m4a,.m4b,.m4r,.mka,.mp2,.mp3,.mpga,.oga,.ogg,.opus,.ra,.wav,.weba,.wma,.wv,.3ga,.ac3,.eac3,.mid,.midi,.mp4,.m4v,.mov,.webm,.3gp,.mkv,.ogv" multiple hidden>
        <div class="kefe-mini-controls" aria-label="Playback controls">
          <button type="button" id="kefeMiniShuffleTrack" class="kefe-mini-control-icon" aria-label="Shuffle queue" title="Shuffle queue"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h2c4 0 6 10 10 10h4M16 5h4v4M20 5l-4 4M4 17h2c1.8 0 3-1.5 4-3M16 15h4v4M20 19l-4-4"/></svg></button>
          <button type="button" id="kefeMiniPrev" class="kefe-mini-control-icon" aria-label="Previous track" title="Previous track"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 6v12M18 6l-8 6 8 6z"/></svg></button>
          <button type="button" id="kefeMiniPlay" class="kefe-mini-play" aria-label="Play" title="Play"><svg class="icon-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z"/></svg></button>
          <button type="button" id="kefeMiniStop" class="kefe-mini-control-icon" aria-label="Stop" title="Stop"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10v10H7z"/></svg></button>
          <button type="button" id="kefeMiniNext" class="kefe-mini-control-icon" aria-label="Next track" title="Next track"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 6v12M6 6l8 6-8 6z"/></svg></button>
          <button type="button" id="kefeMiniRepeat" class="kefe-mini-control-icon" aria-label="Repeat off" title="Repeat off"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 7H7a3 3 0 0 0 0 6h1M7 17h10a3 3 0 0 0 0-6h-1M15 5l2 2-2 2M9 15l-2 2 2 2"/></svg></button>
        </div>
        <input id="kefeMiniSeek" class="kefe-mini-seek" type="range" min="0" max="0" step="0.01" value="0" aria-label="Track position">
        <div class="kefe-mini-clock"><span id="kefeMiniCurrent" class="cur">0 : 00</span><span class="sep"> / </span><span id="kefeMiniDuration" class="dur">0:00</span></div>
        <div class="kefe-mini-actions">
          <div class="kefe-mini-volume"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 10v4h3l4 3V7L8 10H5zM16 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"/></svg><input id="kefeMiniVolume" type="range" min="0" max="1" step="0.01" value="1" aria-label="Volume"></div>
          <button type="button" id="kefeMiniShuffle">Shuffle preset</button>
        </div>
        <div id="kefeMiniNotice" class="kefe-mini-notice" role="status" aria-live="polite" hidden></div>
        <div class="kefe-mini-preset"><span>Visual</span><select id="kefeMiniPreset" aria-label="Butterchurn preset"></select></div>
        <button type="button" id="kefeMiniLyricsToggle" class="kefe-mini-lyrics-toggle" aria-expanded="false" aria-controls="kefeMiniLyricsPanel"><span>Lyrics</span><svg class="lyrics-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>
        <section id="kefeMiniLyricsPanel" class="kefe-mini-lyrics-panel" hidden>
          <div class="kefe-mini-lyrics-head"><span>LYRICS</span><button type="button" id="kefeMiniLyricsClose" aria-label="Close lyrics"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
          <div id="kefeMiniLyricsContent" class="kefe-mini-lyrics-content"><p>No lyrics loaded</p></div>
        </section>
        <div class="kefe-mini-queue"><div class="kefe-mini-queue-head"><div><span>UP NEXT</span><small>Playlist</small></div><span id="kefeMiniQueueCount">0 tracks</span></div><ol id="kefeMiniQueueList"></ol></div>
        </div>
      </div>
      <button type="button" id="kefeMiniVisualToggle" class="kefe-mini-visual-toggle" aria-pressed="false" aria-label="Switch to visualizer" title="Show audio visualizer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14c2.5-8 5.5-8 8 0s5.5 8 8 0M4 10c2.5 8 5.5 8 8 0s5.5-8 8 0"/></svg><span class="sr-only">Visualizer</span></button>
    </div>`;
  document.body.appendChild(player);

  const audio = new Audio();
  audio.preload = 'auto';
  audio.playsInline = true;
  const fallbackState = {
    audio: { file: null, url: null, duration: 0, ready: false, metadata: { title: '', artist: '', album: '' } },
    lyrics: { lines: [] },
    style: { visualiserStyle: 'butterchurn', butterchurnPreset: '' }
  };
  const getState = () => window.state || fallbackState;
  const urls = new Map();
  let tracks = [];
  let index = -1;
  let raf = 0;
  let dragging = false;
  let dragPointerId = null;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let cssFullscreen = false;
  let repeatTrack = false;

  const $ = id => document.getElementById(id);
  const canvas = $('kefeMiniCanvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const card = $('kefeMiniCard');
  const spinEl = player.querySelector('.kefe-mini-spin');
  const shellEl = player.querySelector('.kefe-mini-shell');
  const seekEl = $('kefeMiniSeek');
  const progressEl = $('kefeMiniProgress');
  const reduceMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const SPIN_DEG_PER_SEC = 42;
  let expanded = false;
  let angle = 0;
  let spinVel = 0;
  let settle = null;
  let lastFrame = 0;
  let lastProgress = -1;
  let currentArtwork = null;
  let currentArtworkUrl = '';
  let metadataReadPromise = null;
  let miniVisualiserStyle = 'butterchurn';
  let discDisplay = 'artwork';
  const fmt = t => { t = Math.max(0, Number(t) || 0); return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`; };
  const fmtCur = t => { t = Math.max(0, Number(t) || 0); return `${Math.floor(t / 60)} : ${String(Math.floor(t % 60)).padStart(2, '0')}`; };
  const esc = value => String(value || '').replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));

  function metadata(file) {
    const base = String(file.name || '').replace(/\.[^.]+$/, '');
    const parts = base.split(' - ');
    return { title: parts.pop()?.trim() || base || '', artist: parts.join(' - ').trim() || 'Unknown artist' };
  }

  function loadMediaTags() {
    if (window.jsmediatags) return Promise.resolve(window.jsmediatags);
    if (metadataReadPromise) return metadataReadPromise;
    metadataReadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = './vendor/jsmediatags/jsmediatags.min.js';
      script.onload = () => window.jsmediatags ? resolve(window.jsmediatags) : reject(new Error('Metadata reader unavailable'));
      script.onerror = reject;
      document.head.appendChild(script);
    }).catch(error => { metadataReadPromise = null; throw error; });
    return metadataReadPromise;
  }

  async function readEmbeddedTrackMetadata(track) {
    try {
      const tagsLibrary = await loadMediaTags();
      const result = await new Promise((resolve, reject) => tagsLibrary.read(track.file, { onSuccess: resolve, onError: reject }));
      const tags = result?.tags || {};
      if (tags.title) track.title = String(tags.title).trim();
      if (tags.artist) track.artist = String(tags.artist).trim();
      if (tags.album) track.album = String(tags.album).trim();
      const picture = tags.picture;
      if (picture?.data?.length) {
        if (track.artUrl) URL.revokeObjectURL(track.artUrl);
        track.artUrl = URL.createObjectURL(new Blob([new Uint8Array(picture.data)], { type: picture.format || 'image/jpeg' }));
      }
      return track;
    } catch (_) {
      return track;
    }
  }

  function setCurrentArtwork(url) {
    currentArtworkUrl = url || '';
    currentArtwork = null;
    if (!url) return;
    const image = new Image();
    image.onload = () => { currentArtwork = image; };
    image.src = url;
  }
  function setNowPlaying(title, artist) {
    [['kefeMiniTitle', title], ['kefeMiniCapTitle', title], ['kefeMiniArtist', artist], ['kefeMiniCapArtist', artist]]
      .forEach(([id, text]) => { const el = $(id); if (el) el.textContent = text; });
  }
  function syncProgress() {
    const dur = Number(audio.duration) || 0;
    const p = dur > 0 ? Math.min(1, Math.max(0, (audio.currentTime || 0) / dur)) : 0;
    if (Math.abs(p - lastProgress) < 0.0005) return;
    lastProgress = p;
    progressEl.style.transform = `scaleX(${p})`;
    seekEl.style.setProperty('--p', `${(p * 100).toFixed(2)}%`);
  }
  function setExpanded(value) {
    value = !!value;
    if (value === expanded) return;
    expanded = value;
    card.classList.toggle('is-expanded', expanded);
    shellEl.classList.toggle('is-card-expanded', expanded);
    card.setAttribute('aria-pressed', String(expanded));
    const label = expanded ? 'Show disc' : 'Show cover art';
    card.setAttribute('aria-label', label);
    card.title = expanded ? 'Tap to show disc' : 'Tap to show cover art';
    if (expanded) {
      // Let the disc coast round to upright before the cover opens up.
      const to = Math.ceil(angle / 360) * 360;
      settle = { from: angle, to, start: performance.now(), dur: reduceMotion.matches ? 0 : 650 };
      spinVel = 0;
    } else {
      settle = null;
    }
  }
  function stepSpin(now, dt) {
    if (settle) {
      const t = settle.dur ? Math.min(1, (now - settle.start) / settle.dur) : 1;
      angle = settle.from + (settle.to - settle.from) * (1 - Math.pow(1 - t, 3));
      if (t >= 1) { angle = 0; settle = null; }
    } else {
      const target = !expanded && !audio.paused && !reduceMotion.matches ? SPIN_DEG_PER_SEC : 0;
      spinVel += (target - spinVel) * Math.min(1, dt * 3);
      if (Math.abs(spinVel) < 0.01 && !target) spinVel = 0;
      angle = (angle + spinVel * dt) % 360;
    }
    spinEl.style.transform = `rotate(${angle.toFixed(2)}deg)`;
  }
  function renderQueue() {
    $('kefeMiniQueueCount').textContent = `${tracks.length} ${tracks.length === 1 ? 'track' : 'tracks'}`;
    $('kefeMiniQueueList').innerHTML = tracks.map((t, i) =>
      `<li class="${i === index ? 'active' : ''}"><button type="button" data-mini-track="${i}"><span>${esc(t.title)}</span><small>${esc(t.artist)}</small></button></li>`
    ).join('');
    $('kefeMiniQueueList').querySelectorAll('[data-mini-track]').forEach(b => b.addEventListener('click', () => loadTrack(Number(b.dataset.miniTrack), true)));
  }
  function loadPresets() {
    const select = $('kefeMiniPreset');
    if (!select) return;

    const style = getState().style || {};
    const groups = [
      { key: 'butterchurn', label: 'Butterchurn', api: window.kefeButterchurn, stateKey: 'butterchurnPreset' },
      { key: 'matrixmusic', label: 'Matrix Music', api: window.kefeMatrixVisualiser, stateKey: 'matrixMusicPreset' },
      { key: 'audioreactive', label: 'Audio Reactive Shaders', api: window.kefeAudioReactiveShaders, stateKey: 'audioReactiveShaderPreset' }
    ];

    const current = style.visualiserStyle || 'butterchurn';
    miniVisualiserStyle = current;
    const html = [];
    groups.forEach(group => {
      let items = [];
      if (group.key === 'butterchurn') {
        items = group.api?.presetNames?.() || [];
      } else if (group.key === 'matrixmusic') {
        items = (group.api?.presetRecords?.() || []).map(record => ({ value: record.id, label: record.name }));
      } else if (group.key === 'audioreactive') {
        items = (group.api?.presetNames?.() || []).map((name, i) => ({ value: String(i), label: name }));
      }
      if (!items.length) return;
      html.push(`<optgroup label="${esc(group.label)}">`);
      items.forEach(item => {
        const value = typeof item === 'string' ? item : item.value;
        const label = typeof item === 'string'
          ? item.replace(/^[^-]+[-+]\\s*/,'').trim()
          : item.label;
        html.push(`<option value="${esc(group.key + '::' + value)}">${esc(label)}</option>`);
      });
      html.push('</optgroup>');
    });

    if (!html.length) {
      select.innerHTML = '<option>Loading visualiser presets…</option>';
      return;
    }

    select.innerHTML = html.join('');
    let wanted = '';
    if (current === 'butterchurn') wanted = style.butterchurnPreset ? 'butterchurn::' + style.butterchurnPreset : '';
    if (current === 'matrixmusic') wanted = style.matrixMusicPreset ? 'matrixmusic::' + style.matrixMusicPreset : '';
    if (current === 'audioreactive') wanted = style.audioReactiveShaderPreset !== undefined ? 'audioreactive::' + style.audioReactiveShaderPreset : '';
    if (wanted && [...select.options].some(option => option.value === wanted)) select.value = wanted;
  }

  function choosePreset(value) {
    const parts = String(value || '').split('::');
    const group = parts.shift();
    const preset = parts.join('::');
    const state = getState();
    if (!state.style) state.style = {};

    miniVisualiserStyle = group;
    state.style.visualiserStyle = group;
    if (group === 'butterchurn') {
      state.style.butterchurnPreset = preset;
      try { window.kefeButterchurn?.prepare?.(); } catch (e) {}
    } else if (group === 'matrixmusic') {
      state.style.matrixMusicPreset = preset;
      try { window.kefeMatrixVisualiser?.selectPreset?.(preset, canvas.width, canvas.height); } catch (e) {}
    } else if (group === 'audioreactive') {
      state.style.audioReactiveShaderPreset = Number(preset) || 0;
      try { window.kefeAudioReactiveShaders?.selectPreset?.(Number(preset) || 0, canvas.width, canvas.height); } catch (e) {}
    }
  }
  function syncVisualToggle(button) {
    if (!button) return;
    const visualiserOn = discDisplay === 'visualiser';
    button.setAttribute('aria-pressed', String(visualiserOn));
    button.setAttribute('aria-label', visualiserOn ? 'Switch to album artwork' : 'Switch to audio visualizer');
    button.title = visualiserOn ? 'Show album artwork' : 'Show audio visualizer';
    const label = button.querySelector('span');
    if (label) label.textContent = visualiserOn ? 'Artwork' : 'Visualizer';
  }

  function draw(now) {
    now = now || performance.now();
    const dt = Math.min(0.1, Math.max(0, (now - (lastFrame || now)) / 1000));
    lastFrame = now;
    if (!player.classList.contains('is-hidden')) {
      stepSpin(now, dt);
      syncProgress();
      try {
        const mode = miniVisualiserStyle || 'butterchurn';
        const playing = !audio.paused && !audio.ended;

        // Album artwork is the default disc face. The user can explicitly
        // switch to the selected audio-reactive visualiser.
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (discDisplay === 'artwork' && currentArtwork) {
          ctx.drawImage(currentArtwork, 0, 0, canvas.width, canvas.height);
        }

        if (discDisplay === 'visualiser') {
          const hasArtwork = !!currentArtwork;
          if (hasArtwork) {
            ctx.save();
            ctx.globalAlpha = 0.78;
            ctx.globalCompositeOperation = 'screen';
          }
          try {
            if (mode === 'butterchurn') {
              window.kefeButterchurn?.prepare?.().catch?.(() => {});
              window.kefeButterchurn?.drawMini?.(ctx, canvas.width, canvas.height, audio.currentTime || 0, getState(), audio);
            } else if (mode === 'matrixmusic') {
              window.kefeMatrixVisualiser?.draw?.(ctx, canvas.width, canvas.height);
            } else if (mode === 'audioreactive') {
              window.kefeAudioReactiveShaders?.draw?.(ctx, canvas.width, canvas.height);
            }
          } finally {
            if (hasArtwork) ctx.restore();
          }
        }
      } catch (e) {}
    }
    raf = requestAnimationFrame(draw);
  }

  function clampPosition(x, y) {
    const shell = player.querySelector('.kefe-mini-shell');
    if (!shell) return { x, y };
    const margin = 12;
    const maxX = Math.max(margin, window.innerWidth - shell.offsetWidth - margin);
    const maxY = Math.max(margin, window.innerHeight - shell.offsetHeight - margin);
    return { x: Math.min(Math.max(margin, x), maxX), y: Math.min(Math.max(margin, y), maxY) };
  }

  function setPosition(x, y) {
    const shell = player.querySelector('.kefe-mini-shell');
    if (!shell) return;
    const p = clampPosition(x, y);
    shell.style.transform = 'none';
    shell.style.left = `${p.x}px`;
    shell.style.top = `${p.y}px`;
    shell.style.right = 'auto';
    shell.style.bottom = 'auto';
  }

  function beginDrag(e) {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target.closest('button, input, select, label, a')) return;
    const shell = player.querySelector('.kefe-mini-shell');
    if (!shell) return;
    const rect = shell.getBoundingClientRect();
    dragging = true;
    dragPointerId = e.pointerId;
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    shell.classList.add('is-dragging');
    e.currentTarget.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  }

  function drag(e) {
    if (!dragging || e.pointerId !== dragPointerId) return;
    setPosition(e.clientX - dragOffsetX, e.clientY - dragOffsetY);
  }

  function endDrag(e) {
    if (!dragging || e.pointerId !== dragPointerId) return;
    dragging = false;
    dragPointerId = null;
    player.querySelector('.kefe-mini-shell')?.classList.remove('is-dragging');
  }

  const dragHandle = player.querySelector('.kefe-mini-topline');
  dragHandle?.addEventListener('pointerdown', beginDrag);
  dragHandle?.addEventListener('pointermove', drag);
  dragHandle?.addEventListener('pointerup', endDrag);
  dragHandle?.addEventListener('pointercancel', endDrag);
  window.addEventListener('resize', () => {
    const shell = player.querySelector('.kefe-mini-shell');
    if (!shell || shell.style.left === '') return;
    const rect = shell.getBoundingClientRect();
    setPosition(rect.left, rect.top);
  });
  async function loadTrack(nextIndex, autoplay) {
    if (!tracks.length) return;
    index = Math.max(0, Math.min(tracks.length - 1, nextIndex));
    const track = tracks[index];
    await readEmbeddedTrackMetadata(track);
    let url = urls.get(track.file);
    if (!url) { url = URL.createObjectURL(track.file); urls.set(track.file, url); }
    audio.src = url;
    audio.currentTime = 0;
    getState().audio.file = track.file;
    getState().audio.duration = 0;
    getState().audio.ready = true;
    getState().audio.metadata = { ...getState().audio.metadata, title: track.title, artist: track.artist, album: track.album || getState().audio.metadata?.album || '' };
    const sameAsEditorAudio = window.state?.audio?.file === track.file;
    const editorArtwork = sameAsEditorAudio ? window.kefeAlbumArt?.src : '';
    setCurrentArtwork(track.artUrl || editorArtwork);
    if (!getState().style.visualiserStyle) getState().style.visualiserStyle = 'butterchurn';
    setNowPlaying(track.title, track.artist);
    $('kefeMiniCurrent').textContent = fmtCur(0);
    $('kefeMiniDuration').textContent = fmt(0);
    seekEl.max = '0';
    seekEl.value = '0';
    lastProgress = -1;
    renderLyrics();
    renderQueue();
    try { window.kefeButterchurn?.prepare?.(); } catch (e) {}
    if (autoplay) audio.play().catch(() => {});
  }
  const AUDIO_EXT = new Set([
    'aac', 'aif', 'aiff', 'alac', 'amr', 'ape', 'au', 'caf', 'flac', 'm4a', 'm4b', 'm4r', 'mka', 'mp2', 'mp3', 'mpga',
    'oga', 'ogg', 'opus', 'ra', 'wav', 'weba', 'wma', 'wv', '3ga', 'ac3', 'eac3', 'mid', 'midi',
    // containers that are commonly audio-only
    'mp4', 'm4v', 'mov', 'webm', '3gp', 'mkv', 'ogv'
  ]);
  let noticeTimer = 0;
  function notify(message) {
    const el = $('kefeMiniNotice');
    if (!el) return;
    clearTimeout(noticeTimer);
    el.textContent = message;
    el.hidden = !message;
    if (message) noticeTimer = setTimeout(() => { el.hidden = true; }, 6000);
  }
  function isAudioFile(file) {
    const type = String(file.type || '').toLowerCase();
    const ext = String(file.name || '').toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || '';
    return type.startsWith('audio/') || type.startsWith('video/') || AUDIO_EXT.has(ext) || !type;
  }
  function addFiles(fileList) {
    const all = [...(fileList || [])];
    if (!all.length) return;
    const files = all.filter(isAudioFile);
    const skipped = all.length - files.length;
    if (!files.length) { notify(`No audio found. ${skipped} file${skipped === 1 ? '' : 's'} skipped.`); return; }
    const first = index < 0;
    tracks.push(...files.map(file => ({ file, ...metadata(file) })));
    if (first) loadTrack(0, true);
    renderQueue();
    notify(skipped ? `Added ${files.length}. Skipped ${skipped} non-audio file${skipped === 1 ? '' : 's'}.` : '');
  }
  function renderLyrics() {
    const box = $('kefeMiniLyricsContent');
    if (!box) return;
    const lines = Array.isArray(getState()?.lyrics?.lines) ? getState().lyrics.lines : [];
    box.innerHTML = lines.length
      ? lines.map(line => {
          const text = esc(line?.text || line?.words || '');
          return text ? '<p>' + text + '</p>' : '';
        }).join('')
      : '<p>No lyrics loaded</p>';
  }
  function toggleLyrics() {
    const panel = $('kefeMiniLyricsPanel');
    const button = $('kefeMiniLyricsToggle');
    if (!panel || !button) return;
    const arrow = button.querySelector('.lyrics-chevron');
    const open = panel.hidden;
    panel.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    if (arrow) arrow.innerHTML = open ? '<path d="M6 15l6-6 6 6"/>' : '<path d="M6 9l6 6 6-6"/>';
    if (open) renderLyrics();
  }

  function toggle() {
    if (index < 0) return;
    if (audio.paused) audio.play().catch(() => {}); else audio.pause();
  }
  function next() {
    if (!tracks.length) return;
    if (repeatTrack && index >= 0) return loadTrack(index, true);
    loadTrack((index + 1) % tracks.length, true);
  }
  function prev() { if (tracks.length) loadTrack((index - 1 + tracks.length) % tracks.length, true); }

  audio.addEventListener('loadedmetadata', () => {
    seekEl.max = String(audio.duration || 0);
    $('kefeMiniDuration').textContent = fmt(audio.duration);
    syncProgress();
  });
  audio.addEventListener('timeupdate', () => {
    seekEl.value = String(audio.currentTime || 0);
    $('kefeMiniCurrent').textContent = fmtCur(audio.currentTime);
    syncProgress();
  });
  audio.addEventListener('play', () => {
    shellEl.classList.add('is-playing');
    const button = $('kefeMiniPlay');
    button.setAttribute('aria-label', 'Pause');
    button.title = 'Pause';
    button.innerHTML = '<svg class="icon-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>';
  });
  audio.addEventListener('pause', () => {
    shellEl.classList.remove('is-playing');
    const button = $('kefeMiniPlay');
    button.setAttribute('aria-label', 'Play');
    button.title = 'Play';
    button.innerHTML = '<svg class="icon-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z"/></svg>';
  });
  audio.addEventListener('ended', next);
  audio.addEventListener('error', () => {
    const track = tracks[index];
    if (!track || !audio.src) return;
    if (tracks.length > 1) {
      notify(`Can't play "${track.title}". Skipped.`);
      const bad = index;
      tracks.splice(bad, 1);
      urls.delete(track.file);
      index = -1;
      loadTrack(Math.min(bad, tracks.length - 1), true);
    } else {
      notify(`Can't play "${track.title}". This browser can't decode the format.`);
    }
  });
  $('kefeMiniVisualToggle').addEventListener('click', event => {
    event.stopPropagation();
    discDisplay = discDisplay === 'artwork' ? 'visualiser' : 'artwork';
    syncVisualToggle(event.currentTarget);
    if (discDisplay === 'visualiser' && miniVisualiserStyle === 'butterchurn') {
      try { window.kefeButterchurn?.prepare?.().then?.(loadPresets).catch?.(() => {}); } catch (e) {}
    }
  });
  syncVisualToggle();
  $('kefeMiniSkinToggle').addEventListener('click', event => { event.stopPropagation(); const skin2 = !player.classList.contains('skin-2'); player.classList.toggle('skin-2', skin2); event.currentTarget.setAttribute('aria-label', skin2 ? 'Switch to Skin 1' : 'Switch to Skin 2'); event.currentTarget.title = skin2 ? 'Skin 1' : 'Skin 2'; });
  $('kefeMiniPlay').addEventListener('click', toggle);
  $('kefeMiniStop').addEventListener('click', () => {
    audio.pause();
    try { audio.currentTime = 0; } catch (e) {}
    $('kefeMiniCurrent').textContent = fmtCur(0);
    syncProgress();
  });
  $('kefeMiniNext').addEventListener('click', next);
  $('kefeMiniPrev').addEventListener('click', prev);
  $('kefeMiniUpload').addEventListener('click', () => $('kefeMiniFiles').click());
  $('kefeMiniFiles').addEventListener('change', e => { addFiles(e.target.files); e.target.value = ''; });
  seekEl.addEventListener('input', e => {
    audio.currentTime = Number(e.target.value) || 0;
    $('kefeMiniCurrent').textContent = fmtCur(audio.currentTime);
    syncProgress();
  });
  const volumeEl = $('kefeMiniVolume');
  const syncVolumeFill = () => volumeEl.style.setProperty('--p', `${(Number(volumeEl.value) || 0) * 100}%`);
  volumeEl.addEventListener('input', e => { audio.volume = Math.max(0, Math.min(1, Number(e.target.value) || 0)); syncVolumeFill(); });
  syncVolumeFill();
  card.addEventListener('click', event => {
    if (event.target.closest('button, input, select, a')) return;
    setExpanded(!expanded);
  });
  card.addEventListener('keydown', e => {
    if (e.target !== card || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    setExpanded(!expanded);
  });
  $('kefeMiniRepeat').addEventListener('click', () => {
    repeatTrack = !repeatTrack;
    const button = $('kefeMiniRepeat');
    button.classList.toggle('is-active', repeatTrack);
    button.setAttribute('aria-label', repeatTrack ? 'Repeat track on' : 'Repeat off');
    button.title = repeatTrack ? 'Repeat track on' : 'Repeat off';
  });
  $('kefeMiniShuffleTrack').addEventListener('click', () => {
    if (tracks.length < 2) return;
    let nextIndex = index;
    while (nextIndex === index) nextIndex = Math.floor(Math.random() * tracks.length);
    loadTrack(nextIndex, true);
  });
  $('kefeMiniShuffle').addEventListener('click', () => {
    const select = $('kefeMiniPreset');
    if (!select || !select.options.length) return;
    const options = [...select.options].filter(option => option.value && !option.disabled);
    if (!options.length) return;
    const option = options[Math.floor(Math.random() * options.length)];
    choosePreset(option.value);
    select.value = option.value;
  });
  $('kefeMiniPreset').addEventListener('change', e => choosePreset(e.target.value));
  $('kefeMiniClose').addEventListener('click', () => close());
  $('kefeMiniLyricsToggle').addEventListener('click', toggleLyrics);
  $('kefeMiniLyricsClose').addEventListener('click', toggleLyrics);

  function syncFullscreenUI() {
    const button = $('kefeMiniFullscreen');
    const shell = player.querySelector('.kefe-mini-shell');
    if (!button) return;
    const active = document.fullscreenElement === shell || cssFullscreen;
    button.setAttribute('aria-label', active ? 'Exit fullscreen' : 'Enter fullscreen');
    button.setAttribute('title', active ? 'Exit fullscreen' : 'Fullscreen');
    button.innerHTML = active
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4H4v5M15 4h5v5M9 20H4v-5M20 15v5h-5"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4H4v4M16 4h4v4M8 20H4v-4M20 16v4h-4"/></svg>';
    player.classList.toggle('kefe-mini-css-fullscreen', cssFullscreen);
    shell?.classList.toggle('is-fullscreen', active);
  }
  async function toggleFullscreen() {
    const shell = player.querySelector('.kefe-mini-shell');
    if (!shell) return;
    if (document.fullscreenElement === shell) {
      try { await document.exitFullscreen(); } catch (e) {}
      return;
    }
    if (document.fullscreenElement) {
      try { await document.exitFullscreen(); } catch (e) {}
    }
    if (typeof shell.requestFullscreen === 'function') {
      try {
        await shell.requestFullscreen({ navigationUI: 'hide' });
        cssFullscreen = false;
        syncFullscreenUI();
        return;
      } catch (e) {}
    }
    cssFullscreen = !cssFullscreen;
    syncFullscreenUI();
  }
  document.addEventListener('fullscreenchange', syncFullscreenUI);
  $('kefeMiniFullscreen').addEventListener('click', toggleFullscreen);

  function open() {
    player.classList.remove('is-hidden');
    loadPresets();
    const shell = player.querySelector('.kefe-mini-shell');
    if (shell && !shell.style.left) {
      const x = Math.max(12, (window.innerWidth - shell.offsetWidth) / 2);
      const y = Math.max(12, (window.innerHeight - shell.offsetHeight) / 2);
      setPosition(x, y);
    }
    try { window.kefeButterchurn?.prepare?.().then?.(loadPresets).catch?.(() => {}); } catch (e) {}
    try { window.kefeMatrixVisualiser?.load?.().then?.(loadPresets).catch?.(() => {}); } catch (e) {}
    try { window.kefeAudioReactiveShaders?.load?.().then?.(loadPresets).catch?.(() => {}); } catch (e) {}
    loadPresets();
    if (!raf) raf = requestAnimationFrame(draw);
  }
  function close() {
    if (document.fullscreenElement === player.querySelector('.kefe-mini-shell')) {
      document.exitFullscreen?.().catch?.(() => {});
    }
    cssFullscreen = false;
    syncFullscreenUI();
    player.classList.add('is-hidden');
    setExpanded(false);
    audio.pause();
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }
  window.kefeMiniPlayer = {
    version: 5,
    open,
    close,
    setExpanded,
    addFiles,
    tracks: () => tracks.slice()
  };
  window.dispatchEvent(new CustomEvent('kefe:miniplayer-ready'));
  loadPresets();

  const trigger = document.getElementById('miniPlayerBtn');
  if (trigger) trigger.addEventListener('click', () => open());
})();
