/* KEFE Now Playing — compact playlist player with Butterchurn visuals. */
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
    <div class="kefe-mini-shell kefe-mini-3d">
      <div class="kefe-mini-topline"><span>KEFE / NOW PLAYING</span><div class="kefe-mini-topline-actions"><button type="button" id="kefeMiniFullscreen" class="kefe-mini-icon-button" aria-label="Enter fullscreen" title="Fullscreen"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4H4v4M16 4h4v4M8 20H4v-4M20 16v4h-4"/></svg></button><button type="button" id="kefeMiniClose" class="kefe-mini-close" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div></div>
      <div class="kefe-mini-grid">
        <div class="kefe-mini-art">
          <canvas id="kefeMiniCanvas" width="720" height="720"></canvas>
          <div class="kefe-mini-art-mark">PS</div>
        </div>
        <div class="kefe-mini-main">
          <div class="kefe-mini-eyebrow">PACIFIC / SOUL</div>
          <div id="kefeMiniTitle" class="kefe-mini-title">Nothing queued</div>
          <div id="kefeMiniArtist" class="kefe-mini-artist">Add music to begin</div>
          <div class="kefe-mini-controls" aria-label="Playback controls">
            <button type="button" id="kefeMiniShuffleTrack" class="kefe-mini-control-icon" aria-label="Shuffle queue" title="Shuffle queue"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h2c4 0 6 10 10 10h4M16 5h4v4M20 5l-4 4M4 17h2c1.8 0 3-1.5 4-3M16 15h4v4M20 19l-4-4"/></svg></button>
            <button type="button" id="kefeMiniPrev" class="kefe-mini-control-icon" aria-label="Previous track" title="Previous track"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 6v12M18 6l-8 6 8 6z"/></svg></button>
            <button type="button" id="kefeMiniPlay" class="kefe-mini-play" aria-label="Play" title="Play"><svg class="icon-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z"/></svg></button>
            <button type="button" id="kefeMiniNext" class="kefe-mini-control-icon" aria-label="Next track" title="Next track"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 6v12M6 6l8 6-8 6z"/></svg></button>
            <button type="button" id="kefeMiniRepeat" class="kefe-mini-control-icon" aria-label="Repeat off" title="Repeat off"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 7H7a3 3 0 0 0 0 6h1M7 17h10a3 3 0 0 0 0-6h-1M15 5l2 2-2 2M9 15l-2 2 2 2"/></svg></button>
          </div>
          <input id="kefeMiniSeek" class="kefe-mini-seek" type="range" min="0" max="0" step="0.01" value="0" aria-label="Track position">
          <div class="kefe-mini-time"><span id="kefeMiniCurrent">0:00</span><span id="kefeMiniDuration">0:00</span></div>
          <div class="kefe-mini-actions">
            <div class="kefe-mini-volume"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 10v4h3l4 3V7L8 10H5zM16 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"/></svg><input id="kefeMiniVolume" type="range" min="0" max="1" step="0.01" value="1" aria-label="Volume"></div>
            <button type="button" id="kefeMiniUpload" class="kefe-mini-add"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V5M8 9l4-4 4 4M5 19h14"/></svg><span>Upload media</span></button><input id="kefeMiniFiles" type="file" accept="audio/*" multiple hidden>
            <button type="button" id="kefeMiniShuffle">Shuffle preset</button>
          </div>
          <div class="kefe-mini-preset"><span>Visual</span><select id="kefeMiniPreset" aria-label="Butterchurn preset"></select></div>
        </div>
      </div>
      <button type="button" id="kefeMiniLyricsToggle" class="kefe-mini-lyrics-toggle" aria-expanded="false" aria-controls="kefeMiniLyricsPanel"><span>Lyrics</span><svg class="lyrics-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>
      <section id="kefeMiniLyricsPanel" class="kefe-mini-lyrics-panel" hidden>
        <div class="kefe-mini-lyrics-head"><span>LYRICS</span><button type="button" id="kefeMiniLyricsClose" aria-label="Close lyrics"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
        <div id="kefeMiniLyricsContent" class="kefe-mini-lyrics-content"><p>No lyrics loaded</p></div>
      </section>
      <div class="kefe-mini-queue"><div class="kefe-mini-queue-head"><div><span>UP NEXT</span><small>Playlist</small></div><span id="kefeMiniQueueCount">0 tracks</span></div><ol id="kefeMiniQueueList"></ol></div>
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
  const fmt = t => { t = Math.max(0, Number(t) || 0); return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`; };
  const esc = value => String(value || '').replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));

  function metadata(file) {
    const base = String(file.name || 'Untitled').replace(/\\.[^.]+$/, '');
    const parts = base.split(' - ');
    return { title: parts.pop()?.trim() || base || 'Untitled', artist: parts.join(' - ').trim() || 'Unknown artist' };
  }
  function renderQueue() {
    $('kefeMiniQueueCount').textContent = `${tracks.length} ${tracks.length === 1 ? 'track' : 'tracks'}`;
    $('kefeMiniQueueList').innerHTML = tracks.map((t, i) =>
      `<li class="${i === index ? 'active' : ''}"><button type="button" data-mini-track="${i}"><span>${esc(t.title)}</span><small>${esc(t.artist)}</small></button></li>`
    ).join('');
    $('kefeMiniQueueList').querySelectorAll('[data-mini-track]').forEach(b => b.addEventListener('click', () => loadTrack(Number(b.dataset.miniTrack), true)));
  }
  function loadPresets() {
    const names = window.kefeButterchurn?.presetNames?.() || [];
    const select = $('kefeMiniPreset');
    if (!select || !names.length) return;
    select.innerHTML = names.map(n => `<option value="${esc(n)}">${esc(n.replace(/^[^-]+[-+]\\s*/,'').trim())}</option>`).join('');
    const preferred = window.kefeButterchurn?.effectivePreset?.(getState());
    if (preferred && names.includes(preferred)) select.value = preferred;
  }
  function choosePreset(name) {
    getState().style.visualiserStyle = 'butterchurn';
    getState().style.butterchurnPreset = name;
    try { window.kefeButterchurn?.prepare?.(); } catch (e) {}
  }
  function draw() {
    if (!player.classList.contains('is-hidden')) {
      try {
        getState().style.visualiserStyle = 'butterchurn';
        window.kefeButterchurn?.draw?.(ctx, canvas.width, canvas.height, audio.currentTime || performance.now() / 1000, getState());
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
  function loadTrack(nextIndex, autoplay) {
    if (!tracks.length) return;
    index = Math.max(0, Math.min(tracks.length - 1, nextIndex));
    const track = tracks[index];
    let url = urls.get(track.file);
    if (!url) { url = URL.createObjectURL(track.file); urls.set(track.file, url); }
    audio.src = url;
    audio.currentTime = 0;
    getState().audio.file = track.file;
    getState().audio.duration = 0;
    getState().audio.ready = true;
    getState().audio.metadata = { ...getState().audio.metadata, title: track.title, artist: track.artist };
    getState().style.visualiserStyle = 'butterchurn';
    if ($('kefeMiniTitle')) $('kefeMiniTitle').textContent = track.title;
    if ($('kefeMiniArtist')) $('kefeMiniArtist').textContent = track.artist;
    renderLyrics();
    renderQueue();
    try { window.kefeButterchurn?.prepare?.(); } catch (e) {}
    if (autoplay) audio.play().catch(() => {});
  }
  function addFiles(fileList) {
    const files = [...(fileList || [])].filter(file => {
      const type = String(file.type || '').toLowerCase();
      const ext = String(file.name || '').toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || '';
      const audioExtensions = new Set([
        'aac', 'aif', 'aiff', 'alac', 'flac', 'm4a', 'mp3', 'oga', 'ogg',
        'opus', 'wav', 'weba', 'webm', 'caf', 'mid', 'midi'
      ]);
      return type.startsWith('audio/') || audioExtensions.has(ext) || !type;
    });
    if (!files.length) return;
    tracks.push(...files.map(file => ({ file, ...metadata(file) })));
    if (index < 0) loadTrack(0, false);
    renderQueue();
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
    $('kefeMiniSeek').max = String(audio.duration || 0);
    $('kefeMiniDuration').textContent = fmt(audio.duration);
  });
  audio.addEventListener('timeupdate', () => {
    $('kefeMiniSeek').value = String(audio.currentTime || 0);
    $('kefeMiniCurrent').textContent = fmt(audio.currentTime);
  });
  audio.addEventListener('play', () => {
    const button = $('kefeMiniPlay');
    button.setAttribute('aria-label', 'Pause');
    button.title = 'Pause';
    button.innerHTML = '<svg class="icon-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>';
  });
  audio.addEventListener('pause', () => {
    const button = $('kefeMiniPlay');
    button.setAttribute('aria-label', 'Play');
    button.title = 'Play';
    button.innerHTML = '<svg class="icon-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z"/></svg>';
  });
  audio.addEventListener('ended', next);
  $('kefeMiniPlay').addEventListener('click', toggle);
  $('kefeMiniNext').addEventListener('click', next);
  $('kefeMiniPrev').addEventListener('click', prev);
  $('kefeMiniUpload').addEventListener('click', () => $('kefeMiniFiles').click());
  $('kefeMiniFiles').addEventListener('change', e => { addFiles(e.target.files); e.target.value = ''; });
  $('kefeMiniSeek').addEventListener('input', e => { audio.currentTime = Number(e.target.value) || 0; });
  $('kefeMiniVolume').addEventListener('input', e => { audio.volume = Math.max(0, Math.min(1, Number(e.target.value) || 0)); });
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
    const names = window.kefeButterchurn?.presetNames?.() || [];
    if (names.length) choosePreset(names[Math.floor(Math.random() * names.length)]);
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
    try { window.kefeButterchurn?.prepare?.(); } catch (e) {}
    if (!raf) raf = requestAnimationFrame(draw);
  }
  function close() {
    if (document.fullscreenElement === player.querySelector('.kefe-mini-shell')) {
      document.exitFullscreen?.().catch?.(() => {});
    }
    cssFullscreen = false;
    syncFullscreenUI();
    player.classList.add('is-hidden');
    audio.pause();
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }
  window.kefeMiniPlayer = {
    version: 3,
    open,
    close,
    addFiles,
    tracks: () => tracks.slice()
  };
  window.dispatchEvent(new CustomEvent('kefe:miniplayer-ready'));
  loadPresets();

  const trigger = document.getElementById('miniPlayerBtn');
  if (trigger) trigger.addEventListener('click', () => open());
})();