/* KEFE MiniPlayer — compact iPod docked bottom-right, in shadow DOM.

   Uses the MAIN editor's audio element (window.kefeAudioElement), not its
   own. On iOS Safari, createMediaElementSource() can only be called once
   per element, and Butterchurn needs it to read frequency data. Sharing
   the main element avoids the double-claim bug and keeps the two in sync.

   FRAME THROTTLE: 60fps cap. ProMotion iPhones fire RAF at 120Hz, and
   Butterchurn advances per render() call, so without this it runs at 2x.
*/
(() => {
  'use strict';
  if (window.kefeIpodPlayer) return;

  const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
.ipod{position:fixed;right:14px;bottom:calc(env(safe-area-inset-bottom,0px) + 14px);width:180px;height:300px;border-radius:30px;background:linear-gradient(180deg,#f5f5f7 0%,#e8e8ec 50%,#d4d4da 100%);box-shadow:0 18px 40px rgba(0,0,0,.5),0 1px 0 rgba(255,255,255,.9) inset,0 -1px 0 rgba(0,0,0,.1) inset,0 0 0 1px rgba(0,0,0,.15);display:flex;flex-direction:column;padding:12px 12px 14px;z-index:11001;font-family:-apple-system,"SF Pro Text",system-ui,sans-serif;user-select:none;-webkit-user-select:none}
.ipod.is-hidden{display:none}
.screen{position:relative;width:100%;flex:0 0 46%;border-radius:6px;background:linear-gradient(180deg,#0a1424 0%,#061020 100%);box-shadow:0 0 0 2px #1a1a1e,0 0 0 3px #2a2a30,0 3px 8px rgba(0,0,0,.6) inset;overflow:hidden;padding:8px 9px;display:flex;flex-direction:column;cursor:pointer}
.screen::before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(120% 70% at 80% -10%,rgba(90,140,200,.35),transparent 55%)}
.screen.is-vis{padding:0}
.screen.is-vis::before{display:none}
.screen.is-vis .statusbar,.screen.is-vis .main,.screen.is-vis .bottom-row,.screen.is-vis .time-row,.screen.is-vis .progress{display:none}
.canvas{position:absolute;inset:0;width:100%;height:100%;opacity:0;transition:opacity .3s;background:#000}
.screen.is-vis .canvas{opacity:1}
.screen.is-vis .art-wrap{opacity:0}
.statusbar{display:flex;align-items:center;gap:3px;font-size:8px;font-weight:600;color:#cfd7e6;position:relative;z-index:2}
.statusbar .spacer{flex:1}
.statusbar svg{fill:currentColor;display:block}
.statusbar .signal{width:11px;height:7px}
.statusbar .battery{width:15px;height:8px}
.main{display:grid;grid-template-columns:46px 1fr;gap:8px;margin-top:6px;position:relative;z-index:2}
.art-wrap{width:46px;height:46px;border-radius:4px;overflow:hidden;background:linear-gradient(160deg,#2a4a68,#0f2438);box-shadow:0 2px 5px rgba(0,0,0,.6)}
.art{width:100%;height:100%;background-size:cover;background-position:center}
.meta{display:flex;flex-direction:column;justify-content:center;min-width:0;gap:1px}
.title{font-size:11px;font-weight:700;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.artist,.album{font-size:9px;font-weight:500;color:#b8c0d0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bottom-row{display:flex;align-items:center;justify-content:space-between;margin-top:auto;position:relative;z-index:2;font-size:8px;color:#a8b0c0}
.dolby{display:inline-flex;align-items:center;gap:2px;font-weight:600}
.dolby svg{width:14px;height:6px;fill:currentColor}
.time-row{display:flex;justify-content:space-between;font-size:7px;color:#7a8494;margin-top:2px;position:relative;z-index:2}
.progress{height:2px;border-radius:99px;background:rgba(255,255,255,.15);overflow:hidden;margin-top:2px;position:relative;z-index:2}
.progress span{display:block;height:100%;width:0%;background:#e8ecf5;transition:width .15s linear}
.wheel-wrap{flex:1;display:flex;align-items:center;justify-content:center;padding-top:10px}
.wheel{position:relative;width:128px;height:128px;border-radius:50%;background:radial-gradient(circle at 50% 40%,#fdfdfd 0%,#e4e4e8 55%,#c8c8ce 100%);box-shadow:0 0 0 1px rgba(0,0,0,.15),0 2px 4px rgba(0,0,0,.25),0 -1px 0 rgba(255,255,255,.9) inset,0 1px 3px rgba(0,0,0,.15) inset}
.wheel-btn{position:absolute;display:flex;align-items:center;justify-content:center;padding:0;border:0;background:transparent;color:#4a4a52;cursor:pointer;border-radius:50%}
.wheel-btn:active{color:#111}
.wheel-btn svg{width:12px;height:12px;fill:currentColor}
.wheel-btn svg[fill="none"]{fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.wheel-menu{top:4px;left:50%;transform:translateX(-50%);width:24px;height:24px}
.wheel-prev{left:4px;top:50%;transform:translateY(-50%);width:24px;height:24px}
.wheel-next{right:4px;top:50%;transform:translateY(-50%);width:24px;height:24px}
.wheel-play{bottom:4px;left:50%;transform:translateX(-50%);width:24px;height:24px}
.wheel-center{position:absolute;inset:34px;border-radius:50%;background:radial-gradient(circle at 50% 40%,#f8f8fa 0%,#dcdce0 100%);border:0;cursor:pointer;box-shadow:0 0 0 1px rgba(0,0,0,.12),0 1px 2px rgba(0,0,0,.2) inset}
.wheel-center:active{background:radial-gradient(circle at 50% 40%,#ececec 0%,#c8c8cc 100%)}
.close{position:absolute;top:6px;right:6px;width:16px;height:16px;display:grid;place-items:center;border:0;border-radius:50%;background:rgba(0,0,0,.55);color:#fff;cursor:pointer;z-index:5}
.close svg{width:8px;height:8px;fill:none;stroke:currentColor;stroke-width:2.5;stroke-linecap:round}
.presets{position:absolute;inset:auto 8px 8px;max-height:70%;overflow:auto;background:rgba(8,12,20,.97);border-radius:8px;padding:6px;box-shadow:0 12px 30px rgba(0,0,0,.7);z-index:6;display:none}
.presets.is-open{display:block}
.presets h4{margin:0 0 4px;font-size:8px;font-weight:700;letter-spacing:.14em;color:#8a93a3;text-transform:uppercase}
.presets optgroup{display:block;margin:4px 0 2px;font-size:7px;font-weight:700;color:#6f7887;letter-spacing:.12em;text-transform:uppercase}
.presets button{display:block;width:100%;text-align:left;padding:5px 6px;border:0;background:transparent;color:#e7ecf4;font-size:10px;font-weight:600;border-radius:5px;cursor:pointer}
.presets button:hover{background:rgba(255,255,255,.08)}
.presets .empty{color:#8a93a3;font-size:9px;padding:4px}
.presets .err{color:#ff8a8a;font-size:9px;padding:4px;line-height:1.4;word-break:break-word}
`;

  const HTML = `
<div class="ipod is-hidden" data-kip="shell">
  <button type="button" class="close" data-kip="close" aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
  <div class="screen" data-kip="screen">
    <canvas class="canvas" data-kip="canvas"></canvas>
    <div class="statusbar"><span data-kip="clock">9:41</span><span class="spacer"></span><svg class="signal" viewBox="0 0 20 12"><rect x="0" y="7.5" width="3.2" height="4.5" rx=".6"/><rect x="4.4" y="5.2" width="3.2" height="6.8" rx=".6"/><rect x="8.8" y="2.6" width="3.2" height="9.4" rx=".6"/><rect x="13.2" y="0" width="3.2" height="12" rx=".6"/></svg><svg class="battery" viewBox="0 0 26 12"><rect x=".5" y="1" width="21" height="10" rx="3" fill="none" stroke="currentColor" stroke-width="1"/><rect x="2" y="2.5" width="18" height="7" rx="1.6"/><rect x="23" y="4.2" width="2" height="3.6" rx=".8"/></svg></div>
    <div class="main"><div class="art-wrap"><div class="art" data-kip="art"></div></div><div class="meta"><div class="title" data-kip="title">Add music</div><div class="artist" data-kip="artist">Nothing queued</div><div class="album" data-kip="album"></div></div></div>
    <div class="bottom-row"><span class="dolby"><svg viewBox="0 0 44 18"><path d="M0 2h6a7 7 0 0 1 0 14H0V2zm3 3v8h3a4 4 0 0 0 0-8H3zM20 2h6a7 7 0 0 1 0 14h-6V2zm3 3v8h3a4 4 0 0 0 0-8h-3z"/></svg>Dolby</span><span data-kip="mode">Music</span></div>
    <div class="time-row"><span data-kip="current">0:00</span><span data-kip="remaining">-0:00</span></div>
    <div class="progress"><span data-kip="progress"></span></div>
  </div>
  <div class="wheel-wrap"><div class="wheel">
    <button type="button" class="wheel-btn wheel-menu" data-kip="menu" aria-label="Presets"><svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
    <button type="button" class="wheel-btn wheel-prev" data-kip="prev" aria-label="Previous"><svg viewBox="0 0 24 24"><path d="M6.5 5v14h1.8V5zM19 5.5L8.5 12 19 18.5z"/></svg></button>
    <button type="button" class="wheel-btn wheel-next" data-kip="next" aria-label="Next"><svg viewBox="0 0 24 24"><path d="M17.5 5v14h-1.8V5zM5 5.5L15.5 12 5 18.5z"/></svg></button>
    <button type="button" class="wheel-btn wheel-play" data-kip="play" aria-label="Play"><svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z"/></svg></button>
    <button type="button" class="wheel-center" data-kip="center" aria-label="Play"></button>
  </div></div>
  <div class="presets" data-kip="presets"><h4>Presets</h4><div data-kip="presetList"></div></div>
</div>`;

  const host = document.createElement('div');
  host.id = 'kefeIpodPlayer';
  host.style.cssText = 'all:initial;position:fixed;inset:0;pointer-events:none;z-index:11000';
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });
  const styleEl = document.createElement('style');
  styleEl.textContent = CSS;
  shadow.appendChild(styleEl);
  const wrap = document.createElement('div');
  wrap.style.cssText = 'all:initial';
  wrap.innerHTML = HTML;
  shadow.appendChild(wrap);
  const shell = shadow.querySelector('.ipod');
  shell.style.setProperty('pointer-events', 'auto', 'important');

  const el = n => shadow.querySelector(`[data-kip="${n}"]`);
  const dom = {
    shell, screen: el('screen'), canvas: el('canvas'), clock: el('clock'),
    art: el('art'), title: el('title'), artist: el('artist'), album: el('album'),
    current: el('current'), remaining: el('remaining'), progress: el('progress'),
    play: el('play'), center: el('center'), prev: el('prev'), next: el('next'),
    close: el('close'), menu: el('menu'), mode: el('mode'),
    presets: el('presets'), presetList: el('presetList'),
  };

  const audio = window.kefeAudioElement || new Audio();
  audio.playsInline = true;

  const ctx = dom.canvas.getContext('2d', { alpha: false });
  let mode = 'art';
  let rafId = 0;
  let lastDrawTime = 0;
  let lastW = 0, lastH = 0;
  let miniPlayerVisualiser = null;
  const TARGET_FRAME_MS = 1000 / 60;

  const fmt = t => {
    const n = Math.max(0, Number(t) || 0);
    return `${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}`;
  };

  function getMainEditorMeta() {
    const mainState = window.state || {};
    const meta = mainState.audio?.metadata || {};
    const file = mainState.audio?.file;
    const videoFile = window.kefeMedia?.videoFile;
    return {
      title: String(meta.title || '').trim(),
      artist: String(meta.artist || '').trim(),
      album: String(meta.album || '').trim(),
      file: file || videoFile || null,
      url: mainState.audio?.url || null
    };
  }

  function getArtworkSrc() {
    const img = window.kefeAlbumArt;
    return (img && img.src) ? img.src : '';
  }

  function syncClock() {
    const d = new Date();
    const h = d.getHours() % 12 || 12;
    dom.clock.textContent = `${h}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  function syncMeta() {
    const main = getMainEditorMeta();
    if (main.file) {
      dom.title.textContent = main.title || 'Untitled';
      dom.artist.textContent = main.artist || '';
      dom.album.textContent = main.album || '';
    } else {
      dom.title.textContent = 'Add music';
      dom.artist.textContent = 'Nothing queued';
      dom.album.textContent = '';
    }
    const artSrc = getArtworkSrc();
    dom.art.style.backgroundImage = artSrc ? `url("${artSrc}")` : '';
  }

  function syncProgress() {
    const dur = Number(audio.duration) || 0;
    const cur = Number(audio.currentTime) || 0;
    dom.progress.style.width = (dur > 0 ? (cur/dur)*100 : 0).toFixed(2) + '%';
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
      dom.canvas.width = w; dom.canvas.height = h;
      lastW = w; lastH = h;
    }
  }

  function drawStatusText(line1, line2) {
    const w = dom.canvas.width, h = dom.canvas.height;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e8ecf5'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const size1 = Math.max(14, Math.round(w * 0.075));
    ctx.font = `600 ${size1}px -apple-system, system-ui, sans-serif`;
    ctx.fillText(line1, w / 2, h / 2 - size1 * 0.7);
    if (line2) {
      const size2 = Math.max(10, Math.round(w * 0.055));
      ctx.font = `500 ${size2}px -apple-system, system-ui, sans-serif`;
      ctx.fillStyle = '#a8b0c0';
      const maxWidth = w * 0.85;
      const words = String(line2).split(' ');
      const lines = [];
      let current = '';
      for (const word of words) {
        const test = current ? current + ' ' + word : word;
        if (ctx.measureText(test).width > maxWidth && current) { lines.push(current); current = word; }
        else current = test;
      }
      if (current) lines.push(current);
      for (let i = 0; i < Math.min(lines.length, 3); i++) {
        ctx.fillText(lines[i], w / 2, h / 2 + size1 * 0.6 + i * (size2 * 1.35));
      }
    }
  }

  function drawFrame(now) {
    rafId = requestAnimationFrame(drawFrame);
    if (shell.classList.contains('is-hidden')) return;
    if (mode !== 'visualiser') return;
    if (now - lastDrawTime < TARGET_FRAME_MS - 1) return;
    lastDrawTime = now;

    resizeCanvas();
    const style = miniPlayerVisualiser || 'butterchurn';

    if (style === 'butterchurn') {
      const bc = window.kefeButterchurn;
      if (!bc) { drawStatusText('Butterchurn not loaded', ''); return; }
      if (bc.lastError) { drawStatusText('Butterchurn failed', bc.lastError); return; }
      if (!bc.ready) { drawStatusText('Loading Butterchurn…', 'First load takes a few seconds'); return; }
      try {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, dom.canvas.width, dom.canvas.height);
        bc.drawMini(ctx, dom.canvas.width, dom.canvas.height, audio.currentTime || 0, window.state, audio);
      } catch (e) { drawStatusText('Draw failed', String(e && e.message || e)); }
      return;
    }

    try {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, dom.canvas.width, dom.canvas.height);
      if (style === 'matrixmusic' && window.kefeMatrixVisualiser) {
        if (!window.kefeMatrixVisualiser.isReady || !window.kefeMatrixVisualiser.isReady()) { drawStatusText('Loading Matrix…', ''); return; }
        window.kefeMatrixVisualiser.draw(ctx, dom.canvas.width, dom.canvas.height, audio.currentTime || 0);
      } else if (style === 'audioreactive' && window.kefeAudioReactiveShaders) {
        if (!window.kefeAudioReactiveShaders.isReady || !window.kefeAudioReactiveShaders.isReady()) { drawStatusText('Loading shaders…', ''); return; }
        window.kefeAudioReactiveShaders.draw(ctx, dom.canvas.width, dom.canvas.height, audio.currentTime || 0);
      } else {
        drawStatusText('Visualiser unavailable', style);
      }
    } catch (e) { drawStatusText('Draw error', String(e && e.message || e)); }
  }

  function setDisplayMode(next) {
    mode = next === 'visualiser' ? 'visualiser' : 'art';
    dom.screen.classList.toggle('is-vis', mode === 'visualiser');
    dom.mode.textContent = mode === 'visualiser' ? 'Vis' : 'Music';
    if (mode === 'visualiser') {
      try { window.kefeButterchurn?.primeMiniAudio?.(audio); } catch (_) {}
      resizeCanvas();
      lastDrawTime = 0;
      if (!rafId) rafId = requestAnimationFrame(drawFrame);
    }
  }

  function currentGroup() { return miniPlayerVisualiser || 'butterchurn'; }

  function cyclePreset(direction) {
    const group = currentGroup();
    let names = [], currentKey = '';
    if (group === 'butterchurn') {
      names = window.kefeButterchurn?.presetNames?.() || [];
      currentKey = (window.state?.style?.butterchurnPreset) || '';
    } else if (group === 'matrixmusic') {
      names = (window.kefeMatrixVisualiser?.presetRecords?.() || []).map(r => r.id);
      currentKey = (window.state?.style?.matrixMusicPreset) || '';
    } else if (group === 'audioreactive') {
      names = (window.kefeAudioReactiveShaders?.presetNames?.() || []).map((_, i) => String(i));
      const cur = window.state?.style?.audioReactiveShaderPreset;
      currentKey = (cur === undefined || cur === null) ? '' : String(cur);
    }
    if (!names.length) return;
    let idx = names.indexOf(currentKey);
    if (idx < 0) idx = 0;
    idx = (idx + direction + names.length) % names.length;
    const next = names[idx];
    if (!window.state) window.state = {};
    if (!window.state.style) window.state.style = {};
    if (group === 'butterchurn') window.state.style.butterchurnPreset = next;
    else if (group === 'matrixmusic') {
      window.state.style.matrixMusicPreset = next;
      try { window.kefeMatrixVisualiser?.selectPreset?.(next, dom.canvas.width, dom.canvas.height); } catch (_) {}
    } else if (group === 'audioreactive') {
      const n = Number(next) || 0;
      window.state.style.audioReactiveShaderPreset = n;
      try { window.kefeAudioReactiveShaders?.selectPreset?.(n, dom.canvas.width, dom.canvas.height); } catch (_) {}
    }
  }

  function togglePlayback() {
    if (!audio.src) return;
    if (audio.paused) {
      try { window.kefeButterchurn?.primeMiniAudio?.(audio); } catch (_) {}
      audio.play().catch(() => {});
    } else audio.pause();
  }

  audio.addEventListener('timeupdate', syncProgress);
  audio.addEventListener('loadedmetadata', syncProgress);
  audio.addEventListener('durationchange', syncProgress);
  audio.addEventListener('play', syncPlayIcon);
  audio.addEventListener('pause', syncPlayIcon);
  audio.addEventListener('ended', syncPlayIcon);

  function buildPresets() {
    const bc = window.kefeButterchurn;
    const bcErr = bc?.lastError || '';
    const bcNames = bc?.presetNames?.() || [];
    const mmReady = !!window.kefeMatrixVisualiser?.isReady?.();
    const mmRecords = window.kefeMatrixVisualiser?.presetRecords?.() || [];
    const arReady = !!window.kefeAudioReactiveShaders?.isReady?.();
    const arNames = window.kefeAudioReactiveShaders?.presetNames?.() || [];

    const html = [];
    html.push('<optgroup>Butterchurn</optgroup>');
    if (bcNames.length) {
      for (const n of bcNames) {
        const label = String(n).replace(/^[^-]+[-+]\s*/, '').trim();
        html.push(`<button type="button" data-kip-preset="butterchurn::${n}">${label}</button>`);
      }
    } else if (bcErr) {
      html.push(`<div class="err">Failed: ${String(bcErr).replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]))}</div>`);
    } else {
      html.push(`<div class="empty">Loading…</div>`);
    }

    html.push('<optgroup>Matrix</optgroup>');
    if (mmRecords.length) {
      for (const r of mmRecords) html.push(`<button type="button" data-kip-preset="matrixmusic::${r.id}">${r.name}</button>`);
    } else html.push(`<div class="empty">${mmReady ? 'No presets' : 'Loading…'}</div>`);

    html.push('<optgroup>Shader</optgroup>');
    if (arNames.length) {
      arNames.forEach((n, i) => html.push(`<button type="button" data-kip-preset="audioreactive::${i}">${n}</button>`));
    } else html.push(`<div class="empty">${arReady ? 'No presets' : 'Loading…'}</div>`);

    dom.presetList.innerHTML = html.join('');
    dom.presetList.querySelectorAll('[data-kip-preset]').forEach(b => {
      b.addEventListener('click', () => applyPreset(b.dataset.kipPreset));
    });
  }

  function applyPreset(encoded) {
    const [group, ...rest] = encoded.split('::');
    const preset = rest.join('::');
    miniPlayerVisualiser = group;
    if (!window.state) window.state = {};
    if (!window.state.style) window.state.style = {};
    if (group === 'butterchurn') window.state.style.butterchurnPreset = preset;
    else if (group === 'matrixmusic') {
      window.state.style.matrixMusicPreset = preset;
      try { window.kefeMatrixVisualiser?.selectPreset?.(preset); } catch (_) {}
    } else if (group === 'audioreactive') {
      const n = Number(preset) || 0;
      window.state.style.audioReactiveShaderPreset = n;
      try { window.kefeAudioReactiveShaders?.selectPreset?.(n); } catch (_) {}
    }
    dom.presets.classList.remove('is-open');
    setDisplayMode('visualiser');
  }

  function preloadVisualisers() {
    try { window.kefeButterchurn?.prepare?.().catch?.(() => {}); } catch (_) {}
    try { window.kefeMatrixVisualiser?.load?.().catch?.(() => {}); } catch (_) {}
    try { window.kefeAudioReactiveShaders?.load?.().catch?.(() => {}); } catch (_) {}
  }

  function open() {
    shell.classList.remove('is-hidden');
    syncMeta(); syncProgress(); syncPlayIcon();
    preloadVisualisers();
    if (mode === 'visualiser') {
      try { window.kefeButterchurn?.primeMiniAudio?.(audio); } catch (_) {}
      resizeCanvas();
      lastDrawTime = 0;
      if (!rafId) rafId = requestAnimationFrame(drawFrame);
    }
  }

  function close() {
    shell.classList.add('is-hidden');
    dom.presets.classList.remove('is-open');
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
  }

  dom.screen.addEventListener('click', e => {
    if (e.target.closest('button')) return;
    setDisplayMode(mode === 'art' ? 'visualiser' : 'art');
  });
  dom.play.addEventListener('click', togglePlayback);
  dom.center.addEventListener('click', togglePlayback);
  dom.next.addEventListener('click', () => { if (mode === 'visualiser') cyclePreset(1); });
  dom.prev.addEventListener('click', () => { if (mode === 'visualiser') cyclePreset(-1); });
  dom.close.addEventListener('click', close);
  dom.menu.addEventListener('click', () => {
    buildPresets();
    dom.presets.classList.toggle('is-open');
  });

  window.addEventListener('resize', () => { if (mode === 'visualiser') resizeCanvas(); });

  setInterval(() => {
    if (dom.presets.classList.contains('is-open')) buildPresets();
  }, 1500);

  let lastMetaSignature = '';
  setInterval(() => {
    if (shell.classList.contains('is-hidden')) return;
    const main = getMainEditorMeta();
    const sig = `${main.title}|${main.artist}|${main.album}|${main.file?.name || ''}|${getArtworkSrc()}`;
    if (sig !== lastMetaSignature) {
      lastMetaSignature = sig;
      syncMeta();
    }
  }, 800);

  syncClock();
  setInterval(syncClock, 30_000);

  window.kefeIpodPlayer = { version: 15, open, close, setDisplayMode };

  const trigger = document.getElementById('miniPlayerBtn') || document.getElementById('ipodPlayerBtn');
  if (trigger) trigger.addEventListener('click', open);
})();
