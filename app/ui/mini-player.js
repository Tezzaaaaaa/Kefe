/* KEFE Now Playing — compact playlist player with Butterchurn visuals. */
(() => {
  'use strict';
  if (window.kefeMiniPlayer) return;

  const player = document.createElement('div');
  player.id = 'kefeMiniPlayerModal';
  player.className = 'kefe-mini-modal hidden';
  player.setAttribute('role', 'dialog');
  player.setAttribute('aria-modal', 'true');
  player.setAttribute('aria-label', 'KEFE Now Playing');
  player.innerHTML = `
    <div class="kefe-mini-shell kefe-mini-3d">
      <div class="kefe-mini-topline"><span>KEFE / NOW PLAYING</span><button type="button" id="kefeMiniClose" class="kefe-mini-close" aria-label="Close">×</button></div>
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
            <button type="button" id="kefeMiniPrev" aria-label="Previous track">⏮</button>
            <button type="button" id="kefeMiniPlay" class="kefe-mini-play" aria-label="Play">▶</button>
            <button type="button" id="kefeMiniNext" aria-label="Next track">⏭</button>
          </div>
          <input id="kefeMiniSeek" class="kefe-mini-seek" type="range" min="0" max="0" step="0.01" value="0" aria-label="Track position">
          <div class="kefe-mini-time"><span id="kefeMiniCurrent">0:00</span><span id="kefeMiniDuration">0:00</span></div>
          <div class="kefe-mini-actions">
            <label class="kefe-mini-add">Upload media<input id="kefeMiniFiles" type="file" accept="audio/*" multiple class="hidden"></label>
            <button type="button" id="kefeMiniShuffle">Shuffle preset</button>
          </div>
          <div class="kefe-mini-preset"><span>Visual</span><select id="kefeMiniPreset" aria-label="Butterchurn preset"></select></div>
        </div>
      </div>
      <button type="button" id="kefeMiniLyricsToggle" class="kefe-mini-lyrics-toggle" aria-expanded="false" aria-controls="kefeMiniLyricsPanel">Lyrics</button>
      <section id="kefeMiniLyricsPanel" class="kefe-mini-lyrics-panel" hidden>
        <div class="kefe-mini-lyrics-head"><span>LYRICS</span><button type="button" id="kefeMiniLyricsClose" aria-label="Close lyrics">×</button></div>
        <div id="kefeMiniLyricsContent" class="kefe-mini-lyrics-content"><p>No lyrics loaded</p></div>
      </section>
      <div class="kefe-mini-queue"><div class="kefe-mini-queue-head"><span>QUEUE</span><span id="kefeMiniQueueCount">0 tracks</span></div><ol id="kefeMiniQueueList"></ol></div>
    </div>`;
  document.body.appendChild(player);

  const audio = new Audio();
  audio.preload = 'auto';
  audio.playsInline = true;
  const state = window.state;
  const urls = new Map();
  let tracks = [];
  let index = -1;
  let raf = 0;
  let dragging = false;
  let dragPointerId = null;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

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
    const preferred = window.kefeButterchurn?.effectivePreset?.(state);
    if (preferred && names.includes(preferred)) select.value = preferred;
  }
  function choosePreset(name) {
    state.style.visualiserStyle = 'butterchurn';
    state.style.butterchurnPreset = name;
    window.kefeButterchurn?.prepare?.().catch?.(() => {});
  }
  function draw() {
    if (!player.classList.contains('hidden')) {
      try {
        state.style.visualiserStyle = 'butterchurn';
        window.kefeButterchurn?.draw?.(ctx, canvas.width, canvas.height, audio.currentTime || performance.now() / 1000, state);
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
    state.audio.file = track.file;
    state.audio.duration = 0;
    state.audio.ready = true;
    state.audio.metadata = { ...state.audio.metadata, title: track.title, artist: track.artist };
    state.style.visualiserStyle = 'butterchurn';
    if ($('kefeMiniTitle')) $('kefeMiniTitle').textContent = track.title;
    if ($('kefeMiniArtist')) $('kefeMiniArtist').textContent = track.artist;
    renderLyrics();
    renderQueue();
    window.kefeButterchurn?.prepare?.().catch?.(() => {});
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
    const lines = Array.isArray(state?.lyrics?.lines) ? state.lyrics.lines : [];
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
    const open = panel.hidden;
    panel.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    if (open) renderLyrics();
  }

  function toggle() {
    if (index < 0) return;
    if (audio.paused) audio.play().catch(() => {}); else audio.pause();
  }
  function next() { if (tracks.length) loadTrack((index + 1) % tracks.length, true); }
  function prev() { if (tracks.length) loadTrack((index - 1 + tracks.length) % tracks.length, true); }

  audio.addEventListener('loadedmetadata', () => {
    $('kefeMiniSeek').max = String(audio.duration || 0);
    $('kefeMiniDuration').textContent = fmt(audio.duration);
  });
  audio.addEventListener('timeupdate', () => {
    $('kefeMiniSeek').value = String(audio.currentTime || 0);
    $('kefeMiniCurrent').textContent = fmt(audio.currentTime);
  });
  audio.addEventListener('play', () => { $('kefeMiniPlay').textContent = 'Ⅱ'; });
  audio.addEventListener('pause', () => { $('kefeMiniPlay').textContent = '▶'; });
  audio.addEventListener('ended', next);
  $('kefeMiniPlay').addEventListener('click', toggle);
  $('kefeMiniNext').addEventListener('click', next);
  $('kefeMiniPrev').addEventListener('click', prev);
  $('kefeMiniFiles').addEventListener('change', e => { addFiles(e.target.files); e.target.value = ''; });
  $('kefeMiniSeek').addEventListener('input', e => { audio.currentTime = Number(e.target.value) || 0; });
  $('kefeMiniShuffle').addEventListener('click', () => {
    const names = window.kefeButterchurn?.presetNames?.() || [];
    if (names.length) choosePreset(names[Math.floor(Math.random() * names.length)]);
  });
  $('kefeMiniPreset').addEventListener('change', e => choosePreset(e.target.value));
  $('kefeMiniClose').addEventListener('click', () => close());
  $('kefeMiniLyricsToggle').addEventListener('click', toggleLyrics);
  $('kefeMiniLyricsClose').addEventListener('click', toggleLyrics);

  function open() {
    player.classList.remove('hidden');
    loadPresets();
    const shell = player.querySelector('.kefe-mini-shell');
    if (shell && !shell.style.left) {
      const x = Math.max(12, (window.innerWidth - shell.offsetWidth) / 2);
      const y = Math.max(12, (window.innerHeight - shell.offsetHeight) / 2);
      setPosition(x, y);
    }
    window.kefeButterchurn?.prepare?.().catch?.(() => {});
    if (!raf) raf = requestAnimationFrame(draw);
  }
  function close() {
    player.classList.add('hidden');
    audio.pause();
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }
  window.kefeMiniPlayer = { version: 1, open, close, addFiles, tracks: () => tracks.slice() };
  loadPresets();
})();