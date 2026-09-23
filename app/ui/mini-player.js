/* KEFE MiniPlayer — iPod-style audio player with optional visualiser screen.
   Public API: window.kefeIpodPlayer.{open, close, addFiles, setDisplayMode} */
(() => {
  'use strict';
  if (window.kefeIpodPlayer) return;

  const CSS = `
.kip-modal{position:fixed;inset:0;z-index:11000;pointer-events:none;background:rgba(10,10,10,.04)}
.kip-modal.is-hidden{display:none}
.kip-shell{--body:#3a4456;--body-hi:#4a5466;--body-lo:#2b3341;--ink:#eef1f6;--icon:#cdd6e4;pointer-events:auto;position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);box-sizing:border-box;width:min(360px,92vw);aspect-ratio:.604;max-height:92dvh;padding:14px 10px 12px;border-radius:42px;font-family:"SF Pro Text",Inter,-apple-system,"Open Sans",system-ui,sans-serif;color:var(--ink);background:linear-gradient(180deg,var(--body-hi) 0%,var(--body) 14%,var(--body) 78%,var(--body-lo) 100%);box-shadow:0 40px 90px rgba(0,0,0,.6),0 2px 0 rgba(255,255,255,.1) inset,-1px 0 0 rgba(255,255,255,.05) inset,1px 0 0 rgba(0,0,0,.35) inset,0 -2px 0 rgba(0,0,0,.4) inset;display:flex;flex-direction:column}
.kip-shell::before,.kip-shell::after{content:"";position:absolute;left:-3px;width:3px;border-radius:3px 0 0 3px;background:linear-gradient(180deg,#4d5766,#2d3542)}
.kip-shell::before{top:78px;height:30px}
.kip-shell::after{top:120px;height:30px}
.kip-screen{position:relative;box-sizing:border-box;width:100%;aspect-ratio:1.43/1;border-radius:14px;padding:10px 12px;background:linear-gradient(180deg,#0b1a2b 0%,#081220 100%);overflow:hidden;display:flex;flex-direction:column;gap:4px;box-shadow:0 0 0 3px #0a0d13,0 0 0 4px rgba(255,255,255,.04),0 6px 12px rgba(0,0,0,.55) inset;cursor:pointer}
.kip-screen::before{content:"";position:absolute;inset:0;pointer-events:none;z-index:1;background:radial-gradient(140% 80% at 82% -10%,rgba(90,130,190,.28) 0%,transparent 55%),radial-gradient(80% 50% at 0% 100%,rgba(90,130,190,.1) 0%,transparent 60%)}
.kip-canvas{position:absolute;inset:0;width:100%;height:100%;z-index:0;opacity:0;pointer-events:none;transition:opacity .35s ease;background:#000;display:block}
.kip-screen.is-vis .kip-canvas{opacity:1}
.kip-screen.is-vis .kip-art-wrap{opacity:0}
.kip-screen.is-vis .kip-title,.kip-screen.is-vis .kip-artist,.kip-screen.is-vis .kip-album,.kip-screen.is-vis .kip-statusbar,.kip-screen.is-vis .kip-time-row,.kip-screen.is-vis .kip-bottom-row{text-shadow:0 1px 6px rgba(0,0,0,.85)}
.kip-statusbar{position:relative;z-index:2;display:flex;align-items:center;gap:5px;font:600 9px/1 inherit;color:#d5dced}
.kip-statusbar .kip-time{margin-right:2px;font-weight:700}
.kip-statusbar .kip-mode{font-weight:500;color:#c3cbdb}
.kip-statusbar .kip-spacer{flex:1}
.kip-statusbar svg{display:block;color:#d5dced}
.kip-statusbar .kip-signal{width:15px;height:9px;fill:currentColor}
.kip-statusbar .kip-battery{width:20px;height:10px;fill:currentColor}
.kip-statusbar .kip-5g{font:700 9px/1 inherit}
.kip-main{position:relative;z-index:2;display:grid;grid-template-columns:76px minmax(0,1fr);gap:10px;align-items:start;margin-top:2px}
.kip-art-wrap{width:76px;height:76px;border-radius:5px;overflow:hidden;background:#12202f;box-shadow:0 4px 10px rgba(0,0,0,.55);transition:opacity .25s ease}
.kip-art{width:100%;height:100%;background-size:cover;background-position:center;background-image:linear-gradient(160deg,#1c3a55,#0e2233)}
.kip-meta{display:flex;flex-direction:column;gap:1px;min-width:0;padding-top:1px}
.kip-title-row{display:flex;align-items:center;gap:6px;min-width:0}
.kip-title{font:700 16px/1.15 inherit;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kip-artist{font:500 12px/1.25 inherit;color:#d5dced;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kip-album{font:500 12px/1.25 inherit;color:#9aa4b7;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kip-dolby-row{position:relative;z-index:2;display:flex;align-items:center;justify-content:space-between;margin-top:auto}
.kip-dolby{display:inline-flex;align-items:center;gap:5px;font:600 11px/1 inherit;color:#e7ecf4}
.kip-dolby svg{width:22px;height:9px}
.kip-icon-btn{width:26px;height:26px;display:grid;place-items:center;padding:0;border:0;background:transparent;color:var(--icon);cursor:pointer;border-radius:50%}
.kip-icon-btn:hover{color:#fff}
.kip-icon-btn:active{opacity:.6}
.kip-icon-btn svg{width:15px;height:15px}
.kip-time-row{position:relative;z-index:2;display:flex;justify-content:space-between;font:500 9.5px/1 inherit;color:#8a93a3;font-variant-numeric:tabular-nums;margin-top:1px}
.kip-progress{position:relative;z-index:2;height:2.5px;border-radius:99px;background:rgba(255,255,255,.16);overflow:hidden}
.kip-progress span{display:block;height:100%;width:0%;background:#e7ecf4;transition:width .15s linear}
.kip-bottom-row{position:relative;z-index:2;display:flex;align-items:center;justify-content:space-between;margin-top:3px;font:500 10px/1 inherit;color:#b4bccb}
.kip-device{display:inline-flex;align-items:center;gap:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kip-device svg{width:11px;height:11px;flex:0 0 auto}
.kip-wheel{position:relative;width:78%;aspect-ratio:1/1;margin:8px auto 0;border-radius:50%;background:radial-gradient(circle at 50% 40%,#14171d 0%,#0b0d11 68%,#05070a 100%);box-shadow:0 0 0 1px rgba(255,255,255,.04) inset,0 0 0 2px rgba(0,0,0,.5),0 10px 24px rgba(0,0,0,.65) inset,0 1px 0 rgba(255,255,255,.08);flex:0 0 auto}
.kip-wheel::after{content:"";position:absolute;inset:25%;border-radius:50%;background:radial-gradient(circle at 50% 40%,#1c1f26 0%,#0e1014 78%,#05070a 100%);box-shadow:0 0 0 1px rgba(255,255,255,.05) inset,0 6px 14px rgba(0,0,0,.7) inset;pointer-events:none}
.kip-wheel-btn{position:absolute;display:grid;place-items:center;padding:0;border:0;background:transparent;color:#b9c0cc;cursor:pointer;width:40px;height:40px;border-radius:50%;z-index:2}
.kip-wheel-btn:hover{color:#fff}
.kip-wheel-btn:active{transform:scale(.9)}
.kip-wheel-btn svg{width:22px;height:22px;fill:currentColor}
.kip-wheel-btn svg[fill="none"]{fill:none;stroke:currentColor;stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round}
.kip-wheel-menu{top:2px;left:50%;transform:translateX(-50%)}
.kip-wheel-prev{left:2px;top:50%;transform:translateY(-50%)}
.kip-wheel-next{right:2px;top:50%;transform:translateY(-50%)}
.kip-wheel-play{bottom:2px;left:50%;transform:translateX(-50%)}
.kip-wheel-center{position:absolute;inset:25%;border-radius:50%;background:transparent;border:0;cursor:pointer;z-index:3}
.kip-wheel-center:active{background:rgba(255,255,255,.04)}
.kip-close{position:absolute;top:14px;right:14px;width:26px;height:26px;display:grid;place-items:center;border:0;border-radius:50%;background:rgba(0,0,0,.4);color:#fff;cursor:pointer;z-index:5;opacity:.7}
.kip-close svg{width:12px;height:12px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round}
.kip-presets{position:absolute;inset:auto 12px 12px;max-height:66%;overflow:auto;background:rgba(8,12,20,.97);border-radius:14px;padding:10px;box-shadow:0 20px 50px rgba(0,0,0,.7);z-index:6}
.kip-presets[hidden]{display:none}
.kip-presets h4{margin:0 0 8px;font:700 10px/1 inherit;letter-spacing:.14em;color:#8a93a3;text-transform:uppercase}
.kip-presets optgroup{display:block;margin:8px 0 3px;font:700 9px/1 inherit;color:#6f7887;letter-spacing:.12em;text-transform:uppercase}
.kip-presets button{display:block;width:100%;text-align:left;padding:8px 10px;border:0;background:transparent;color:#e7ecf4;font:600 12px/1 inherit;border-radius:8px;cursor:pointer}
.kip-presets button:hover{background:rgba(255,255,255,.08)}
@media(max-width:400px){.kip-shell{padding:12px 8px 10px;border-radius:36px}.kip-screen{padding:8px 10px}.kip-art-wrap,.kip-art{width:66px;height:66px}.kip-title{font-size:15px}}
`;

  const HTML = `
<div class="kip-shell">
  <button type="button" class="kip-close" data-kip="close" aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
  <div class="kip-screen" data-kip="screen">
    <canvas class="kip-canvas" data-kip="canvas" width="720" height="504"></canvas>
    <div class="kip-statusbar">
      <span class="kip-time" data-kip="clock">9:41 AM</span>
      <span class="kip-mode" data-kip="mode">Music</span>
      <span class="kip-spacer"></span>
      <svg class="kip-signal" viewBox="0 0 20 12"><rect x="0" y="7.5" width="3.2" height="4.5" rx=".6"/><rect x="4.4" y="5.2" width="3.2" height="6.8" rx=".6"/><rect x="8.8" y="2.6" width="3.2" height="9.4" rx=".6"/><rect x="13.2" y="0" width="3.2" height="12" rx=".6"/></svg>
      <span class="kip-5g">5G</span>
      <svg class="kip-battery" viewBox="0 0 26 12"><rect x=".5" y="1" width="21" height="10" rx="3"/><rect x="2" y="2.5" width="18" height="7" rx="1.6"/><rect x="23" y="4.2" width="2" height="3.6" rx=".8"/></svg>
    </div>
    <div class="kip-main">
      <div class="kip-art-wrap"><div class="kip-art" data-kip="art"></div></div>
      <div class="kip-meta">
        <div class="kip-title-row"><span class="kip-title" data-kip="title">Add music to begin</span></div>
        <div class="kip-artist" data-kip="artist">Nothing queued</div>
        <div class="kip-album" data-kip="album"></div>
      </div>
    </div>
    <div class="kip-dolby-row">
      <span class="kip-dolby"><svg viewBox="0 0 44 18" fill="currentColor"><path d="M0 2h6a7 7 0 0 1 0 14H0V2zm3 3v8h3a4 4 0 0 0 0-8H3zM20 2h6a7 7 0 0 1 0 14h-6V2zm3 3v8h3a4 4 0 0 0 0-8h-3z"/></svg> Dolby Atmos</span>
      <div style="display:flex;gap:2px">
        <button type="button" class="kip-icon-btn" data-kip="upload" aria-label="Upload"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V5M8 9l4-4 4 4M5 19h14"/></svg></button>
        <button type="button" class="kip-icon-btn" data-kip="star" aria-label="Favorite"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3.5l2.6 6 6.4.5-4.9 4.2 1.5 6.3L12 17l-5.6 3.5 1.5-6.3L3 10l6.4-.5z"/></svg></button>
        <button type="button" class="kip-icon-btn" data-kip="more" aria-label="More"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="6" cy="12" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="18" cy="12" r="2.2"/></svg></button>
      </div>
    </div>
    <div class="kip-time-row"><span data-kip="current">0:00</span><span data-kip="remaining">-0:00</span></div>
    <div class="kip-progress"><span data-kip="progress"></span></div>
    <div class="kip-bottom-row">
      <span class="kip-device"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M6 4v16M9 4v16M12 4.5c1.8 0 2.8 1 2.8 2.8v9.4c0 1.8-1 2.8-2.8 2.8"/></svg> MiniPlayer</span>
      <button type="button" class="kip-icon-btn" data-kip="menu2" aria-label="Presets"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
    </div>
  </div>
  <div class="kip-wheel">
    <button type="button" class="kip-wheel-btn kip-wheel-menu" data-kip="menu" aria-label="Presets"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="4" y="4" width="6.5" height="6.5" rx="1.4"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.4"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.4"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.4"/></svg></button>
    <button type="button" class="kip-wheel-btn kip-wheel-prev" data-kip="prev" aria-label="Previous"><svg viewBox="0 0 24 24"><path d="M6.5 5v14h1.8V5zM19 5.5L8.5 12 19 18.5z"/></svg></button>
    <button type="button" class="kip-wheel-btn kip-wheel-next" data-kip="next" aria-label="Next"><svg viewBox="0 0 24 24"><path d="M17.5 5v14h-1.8V5zM5 5.5L15.5 12 5 18.5z"/></svg></button>
    <button type="button" class="kip-wheel-btn kip-wheel-play" data-kip="play" aria-label="Play"><svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z"/></svg></button>
    <button type="button" class="kip-wheel-center" data-kip="center" aria-label="Play"></button>
  </div>
  <input type="file" accept="audio/*" multiple hidden data-kip="files">
  <div class="kip-presets" data-kip="presets" hidden><h4>Presets</h4><div data-kip="presetList"></div></div>
</div>`;

  const styleEl = document.createElement('style');
  styleEl.id = 'kip-styles';
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);

  const root = document.createElement('div');
  root.id = 'kefeIpodPlayer';
  root.className = 'kip-modal is-hidden';
  root.innerHTML = HTML;
  document.body.appendChild(root);

  const el = name => root.querySelector(`[data-kip="${name}"]`);
  const dom = {
    screen: el('screen'), canvas: el('canvas'), clock: el('clock'), mode: el('mode'),
    art: el('art'), title: el('title'), artist: el('artist'), album: el('album'),
    current: el('current'), remaining: el('remaining'), progress: el('progress'),
    play: el('play'), center: el('center'), prev: el('prev'), next: el('next'),
    close: el('close'), upload: el('upload'), star: el('star'), more: el('more'),
    menu: el('menu'), menu2: el('menu2'), files: el('files'),
    presets: el('presets'), presetList: el('presetList'),
  };

  const audio = new Audio();
  audio.preload = 'auto';
  audio.playsInline = true;

  const ctx = dom.canvas.getContext('2d', { alpha: false });
  const tracks = [];
  const blobUrls = new Map();
  let index = -1;
  let mode = 'art'; // 'art' | 'visualiser'
  let rafId = 0;
  let lastW = 0;
  let lastH = 0;

  const fmt = t => {
    const n = Math.max(0, Number(t) || 0);
    return `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`;
  };

  function parseFilename(name) {
    const base = String(name || '').replace(/\.[^.]+$/, '');
    const parts = base.split(' - ');
    const title = parts.pop()?.trim() || base || 'Untitled';
    const artist = parts.join(' - ').trim() || 'Unknown artist';
    return { title, artist, album: '' };
  }

  function syncClock() {
    const d = new Date();
    const h = d.getHours() % 12 || 12;
    const m = String(d.getMinutes()).padStart(2, '0');
    dom.clock.textContent = `${h}:${m} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
  }

  function syncMeta() {
    const track = tracks[index];
    if (track) {
      dom.title.textContent = track.title;
      dom.artist.textContent = track.artist;
      dom.album.textContent = track.album || '';
    } else {
      dom.title.textContent = 'Add music to begin';
      dom.artist.textContent = 'Nothing queued';
      dom.album.textContent = '';
    }
    const artSrc = window.kefeAlbumArt?.src || '';
    dom.art.style.backgroundImage = artSrc ? `url("${artSrc}")` : '';
  }

  function syncProgress() {
    const dur = Number(audio.duration) || 0;
    const cur = Number(audio.currentTime) || 0;
    dom.progress.style.width = (dur > 0 ? (cur / dur) * 100 : 0).toFixed(2) + '%';
    dom.current.textContent = fmt(cur);
    dom.remaining.textContent = dur > 0 ? '-' + fmt(dur - cur) : '-0:00';
  }

  function syncPlayIcon() {
    const playing = !audio.paused && !audio.ended;
    dom.play.innerHTML = playing
      ? '<svg viewBox="0 0 24 24"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z"/></svg>';
  }

  function resizeCanvas() {
    const rect = dom.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (w !== lastW || h !== lastH) {
      dom.canvas.width = w;
      dom.canvas.height = h;
      lastW = w;
      lastH = h;
    }
  }

  function drawFrame() {
    rafId = requestAnimationFrame(drawFrame);
    if (root.classList.contains('is-hidden') || mode !== 'visualiser') return;
    resizeCanvas();
    const style = window.state?.style?.visualiserStyle || 'butterchurn';
    try {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, dom.canvas.width, dom.canvas.height);
      if (style === 'butterchurn') {
        window.kefeButterchurn?.prepare?.();
        window.kefeButterchurn?.drawMini?.(ctx, dom.canvas.width, dom.canvas.height, audio.currentTime || 0, window.state, audio);
      } else if (style === 'matrixmusic') {
        window.kefeMatrixVisualiser?.draw?.(ctx, dom.canvas.width, dom.canvas.height);
      } else if (style === 'audioreactive') {
        window.kefeAudioReactiveShaders?.draw?.(ctx, dom.canvas.width, dom.canvas.height);
      }
    } catch (e) { /* visualiser APIs are optional */ }
  }

  function setDisplayMode(next) {
    mode = next === 'visualiser' ? 'visualiser' : 'art';
    dom.screen.classList.toggle('is-vis', mode === 'visualiser');
    dom.mode.textContent = mode === 'visualiser' ? 'Visualiser' : 'Music';
    if (mode === 'visualiser') {
      resizeCanvas();
      if (!rafId) rafId = requestAnimationFrame(drawFrame);
    }
  }

  function toggleDisplay() {
    setDisplayMode(mode === 'art' ? 'visualiser' : 'art');
  }

  function getUrlFor(file) {
    let url = blobUrls.get(file);
    if (!url) {
      url = URL.createObjectURL(file);
      blobUrls.set(file, url);
    }
    return url;
  }

  function loadTrack(i, autoplay) {
    if (!tracks.length) return;
    index = Math.max(0, Math.min(tracks.length - 1, i));
    const track = tracks[index];
    audio.src = getUrlFor(track.file);
    audio.currentTime = 0;
    syncMeta();
    if (autoplay) audio.play().catch(() => {});
  }

  function togglePlayback() {
    if (!audio.src && tracks.length) { loadTrack(0, true); return; }
    if (!audio.src) { dom.files.click(); return; }
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  }

  function nextTrack() { if (tracks.length) loadTrack((index + 1) % tracks.length, true); }
  function prevTrack() { if (tracks.length) loadTrack((index - 1 + tracks.length) % tracks.length, true); }

  function addFiles(fileList) {
    const files = [...fileList];
    if (!files.length) return;
    const wasEmpty = tracks.length === 0;
    for (const file of files) tracks.push({ file, ...parseFilename(file.name) });
    if (wasEmpty) loadTrack(0, true);
  }

  audio.addEventListener('timeupdate', syncProgress);
  audio.addEventListener('loadedmetadata', syncProgress);
  audio.addEventListener('play', syncPlayIcon);
  audio.addEventListener('pause', syncPlayIcon);
  audio.addEventListener('ended', nextTrack);

  dom.screen.addEventListener('click', event => {
    if (event.target.closest('button, .kip-art-wrap, .kip-dolby-row')) return;
    toggleDisplay();
  });

  dom.play.addEventListener('click', togglePlayback);
  dom.center.addEventListener('click', togglePlayback);
  dom.prev.addEventListener('click', prevTrack);
  dom.next.addEventListener('click', nextTrack);
  dom.close.addEventListener('click', close);
  dom.upload.addEventListener('click', () => dom.files.click());
  dom.files.addEventListener('change', event => { addFiles(event.target.files); event.target.value = ''; });
  dom.star.addEventListener('click', () => {
    const on = dom.star.style.color === 'rgb(255, 214, 92)';
    dom.star.style.color = on ? '' : 'rgb(255, 214, 92)';
  });
  dom.more.addEventListener('click', () => dom.menu.click());
  dom.menu2.addEventListener('click', () => dom.menu.click());

  window.addEventListener('resize', () => { if (mode === 'visualiser') resizeCanvas(); });

  function buildPresets() {
    const groups = [
      { key: 'butterchurn', label: 'Butterchurn', items: () => (window.kefeButterchurn?.presetNames?.() || []).map(n => ({ value: n, label: n.replace(/^[^-]+[-+]\s*/, '').trim() })) },
      { key: 'matrixmusic', label: 'Matrix Music', items: () => (window.kefeMatrixVisualiser?.presetRecords?.() || []).map(r => ({ value: r.id, label: r.name })) },
      { key: 'audioreactive', label: 'Audio Reactive', items: () => (window.kefeAudioReactiveShaders?.presetNames?.() || []).map((n, i) => ({ value: String(i), label: n })) },
    ];
    const html = [];
    for (const group of groups) {
      const items = group.items();
      if (!items.length) continue;
      html.push(`<optgroup>${group.label}</optgroup>`);
      for (const item of items) {
        html.push(`<button type="button" data-kip-preset="${group.key}::${item.value}">${item.label}</button>`);
      }
    }
    dom.presetList.innerHTML = html.join('') || '<div style="color:#8a93a3;font-size:11px;padding:6px">No presets loaded yet</div>';
    dom.presetList.querySelectorAll('[data-kip-preset]').forEach(btn => {
      btn.addEventListener('click', () => applyPreset(btn.dataset.kipPreset));
    });
  }

  function applyPreset(encoded) {
    const [group, ...rest] = encoded.split('::');
    const preset = rest.join('::');
    if (!window.state) window.state = {};
    if (!window.state.style) window.state.style = {};
    window.state.style.visualiserStyle = group;
    if (group === 'butterchurn') {
      window.state.style.butterchurnPreset = preset;
      window.kefeButterchurn?.prepare?.();
    } else if (group === 'matrixmusic') {
      window.state.style.matrixMusicPreset = preset;
      window.kefeMatrixVisualiser?.selectPreset?.(preset);
    } else if (group === 'audioreactive') {
      const n = Number(preset) || 0;
      window.state.style.audioReactiveShaderPreset = n;
      window.kefeAudioReactiveShaders?.selectPreset?.(n);
    }
    dom.presets.hidden = true;
    setDisplayMode('visualiser');
  }

  dom.menu.addEventListener('click', () => {
    buildPresets();
    dom.presets.hidden = !dom.presets.hidden;
  });

  function open() {
    root.classList.remove('is-hidden');
    syncMeta();
    syncProgress();
    syncPlayIcon();
    if (mode === 'visualiser') {
      resizeCanvas();
      if (!rafId) rafId = requestAnimationFrame(drawFrame);
    }
  }

  function close() {
    root.classList.add('is-hidden');
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
  }

  syncClock();
  setInterval(syncClock, 30_000);

  window.kefeIpodPlayer = { version: 4, open, close, addFiles, setDisplayMode };

  const trigger = document.getElementById('miniPlayerBtn') || document.getElementById('ipodPlayerBtn');
  if (trigger) trigger.addEventListener('click', open);
})();
