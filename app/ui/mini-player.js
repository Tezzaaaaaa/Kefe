(() => {
  'use strict';
  if (window.kefeIpodPlayer) return;

  const css = `
.kip-modal{position:fixed;inset:0;z-index:11000;pointer-events:none;background:rgba(10,10,10,.04)}
.kip-modal.is-hidden{display:none}
.kip-shell{--kip-body:#3a4456;--kip-body-hi:#4a5466;--kip-body-lo:#2b3341;--kip-ink:#eef1f6;--kip-mute:#8a93a3;--kip-icon:#cdd6e4;--kip-wheel:#0b0d11;--kip-wheel-2:#14171d;pointer-events:auto;position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);box-sizing:border-box;width:min(360px,92vw);aspect-ratio:.604;max-height:92dvh;padding:14px 10px 12px;border-radius:42px!important;font-family:"SF Pro Text",Inter,-apple-system,"Open Sans",system-ui,sans-serif;color:var(--kip-ink);background:linear-gradient(180deg,var(--kip-body-hi) 0%,var(--kip-body) 14%,var(--kip-body) 78%,var(--kip-body-lo) 100%);box-shadow:0 40px 90px rgba(0,0,0,.6),0 2px 0 rgba(255,255,255,.1) inset,-1px 0 0 rgba(255,255,255,.05) inset,1px 0 0 rgba(0,0,0,.35) inset,0 -2px 0 rgba(0,0,0,.4) inset;display:flex;flex-direction:column}
.kip-shell::before,.kip-shell::after{content:"";position:absolute;left:-3px;width:3px;border-radius:3px 0 0 3px;background:linear-gradient(180deg,#4d5766,#2d3542);box-shadow:0 1px 0 rgba(255,255,255,.06) inset}
.kip-shell::before{top:78px;height:30px}
.kip-shell::after{top:120px;height:30px}
.kip-screen{position:relative;box-sizing:border-box;width:100%;aspect-ratio:1.43/1;border-radius:14px!important;padding:10px 12px;background:linear-gradient(180deg,#0b1a2b 0%,#081220 100%);overflow:hidden;display:flex;flex-direction:column;gap:4px;box-shadow:0 0 0 3px #0a0d13,0 0 0 4px rgba(255,255,255,.04),0 6px 12px rgba(0,0,0,.55) inset}
.kip-screen::before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(140% 80% at 82% -10%,rgba(90,130,190,.28) 0%,transparent 55%),radial-gradient(80% 50% at 0% 100%,rgba(90,130,190,.1) 0%,transparent 60%)}
.kip-statusbar{position:relative;z-index:1;display:flex;align-items:center;gap:5px;font:600 9px/1 inherit;color:#d5dced}
.kip-statusbar .kip-time{margin-right:2px;font-weight:700}
.kip-statusbar .kip-mode{font-weight:500;color:#c3cbdb}
.kip-statusbar .kip-spacer{flex:1}
.kip-statusbar svg{display:block;color:#d5dced}
.kip-statusbar .kip-signal{width:15px;height:9px;fill:currentColor}
.kip-statusbar .kip-battery{width:20px;height:10px;fill:currentColor}
.kip-statusbar .kip-battery rect:first-child{fill:none;stroke:currentColor;stroke-width:.8;opacity:.7}
.kip-statusbar .kip-5g{font:700 9px/1 inherit}
.kip-main{position:relative;z-index:1;display:grid;grid-template-columns:76px minmax(0,1fr);gap:10px;align-items:start;margin-top:2px}
.kip-art-wrap{width:76px;height:76px;border-radius:5px!important;overflow:hidden;background:#12202f;box-shadow:0 4px 10px rgba(0,0,0,.55)}
.kip-art{width:100%;height:100%;background-size:cover;background-position:center;background-image:linear-gradient(160deg,#1c3a55,#0e2233)}
.kip-meta{display:flex;flex-direction:column;gap:1px;min-width:0;padding-top:1px}
.kip-title-row{display:flex;align-items:center;gap:6px;min-width:0}
.kip-title{font:700 16px/1.15 inherit;letter-spacing:-.005em;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kip-explicit{flex:0 0 auto;display:inline-grid;place-items:center;width:13px;height:13px;border-radius:3px!important;background:#dfe4ec;color:#0b1420;font:800 8px/1 inherit}
.kip-artist{font:500 12px/1.25 inherit;color:#d5dced;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kip-album{font:500 12px/1.25 inherit;color:#9aa4b7;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kip-dolby-row{position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;margin-top:auto}
.kip-dolby{display:inline-flex;align-items:center;gap:5px;font:600 11px/1 inherit;color:#e7ecf4}
.kip-dolby svg{width:22px;height:9px;color:#e7ecf4}
.kip-icon-btn{width:20px;height:20px;display:grid;place-items:center;padding:0;border:0;background:transparent;color:var(--kip-icon);cursor:pointer;border-radius:50%!important}
.kip-icon-btn:hover{color:#fff}
.kip-icon-btn:active{opacity:.6}
.kip-icon-btn svg{width:15px;height:15px}
.kip-time-row{position:relative;z-index:1;display:flex;justify-content:space-between;font:500 9.5px/1 inherit;color:#8a93a3;font-variant-numeric:tabular-nums;margin-top:1px}
.kip-progress{position:relative;z-index:1;height:2.5px;border-radius:99px!important;background:rgba(255,255,255,.16);overflow:hidden}
.kip-progress span{display:block;height:100%;width:0%;background:#e7ecf4;border-radius:inherit!important;transition:width .15s linear}
.kip-bottom-row{position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;margin-top:3px;font:500 10px/1 inherit;color:#b4bccb}
.kip-device{display:inline-flex;align-items:center;gap:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kip-device svg{width:11px;height:11px;flex:0 0 auto}
.kip-wheel{position:relative;width:78%;aspect-ratio:1/1;margin:8px auto 0;border-radius:50%!important;background:radial-gradient(circle at 50% 40%,var(--kip-wheel-2) 0%,var(--kip-wheel) 68%,#05070a 100%);box-shadow:0 0 0 1px rgba(255,255,255,.04) inset,0 0 0 2px rgba(0,0,0,.5),0 10px 24px rgba(0,0,0,.65) inset,0 1px 0 rgba(255,255,255,.08),0 -1px 0 rgba(0,0,0,.7);flex:0 0 auto}
.kip-wheel::after{content:"";position:absolute;inset:25%;border-radius:50%!important;background:radial-gradient(circle at 50% 40%,#1c1f26 0%,#0e1014 78%,#05070a 100%);box-shadow:0 0 0 1px rgba(255,255,255,.05) inset,0 6px 14px rgba(0,0,0,.7) inset;pointer-events:none}
.kip-wheel-btn{position:absolute;display:grid;place-items:center;padding:0;border:0;background:transparent;color:#b9c0cc;cursor:pointer;width:34px;height:34px;border-radius:50%!important;z-index:2}
.kip-wheel-btn:hover{color:#fff}
.kip-wheel-btn:active{transform:scale(.9)}
.kip-wheel-btn svg{width:22px;height:22px;fill:currentColor}
.kip-wheel-btn svg[fill="none"]{fill:none;stroke:currentColor;stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round}
.kip-wheel-menu{top:6px;left:50%;transform:translateX(-50%)}
.kip-wheel-prev{left:6px;top:50%;transform:translateY(-50%)}
.kip-wheel-next{right:6px;top:50%;transform:translateY(-50%)}
.kip-wheel-play{bottom:6px;left:50%;transform:translateX(-50%)}
.kip-wheel-center{position:absolute;inset:25%;border-radius:50%!important;background:transparent;border:0;cursor:pointer;z-index:3}
.kip-wheel-center:active{background:rgba(255,255,255,.04)}
.kip-close{position:absolute;top:14px;right:14px;width:26px;height:26px;display:grid;place-items:center;border:0;border-radius:50%!important;background:rgba(0,0,0,.4);color:#fff;cursor:pointer;z-index:5;opacity:0;transition:opacity .15s}
.kip-shell:hover .kip-close{opacity:1}
.kip-close svg{width:12px;height:12px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round}
.kip-presets{position:absolute;inset:auto 12px 12px;max-height:66%;overflow:auto;background:rgba(8,12,20,.97);border-radius:14px!important;padding:10px;box-shadow:0 20px 50px rgba(0,0,0,.7),0 0 0 1px rgba(255,255,255,.06);z-index:6}
.kip-presets[hidden]{display:none}
.kip-presets h4{margin:0 0 8px;font:700 10px/1 inherit;letter-spacing:.14em;color:#8a93a3;text-transform:uppercase}
.kip-presets optgroup{display:block;margin:8px 0 3px;font:700 9px/1 inherit;color:#6f7887;letter-spacing:.12em;text-transform:uppercase}
.kip-presets button{display:block;width:100%;text-align:left;padding:8px 10px;border:0;background:transparent;color:#e7ecf4;font:600 12px/1 inherit;border-radius:8px!important;cursor:pointer}
.kip-presets button:hover{background:rgba(255,255,255,.08)}
.kip-presets button.is-active{background:rgba(91,141,239,.28);color:#fff}
@media(max-width:400px){.kip-shell{padding:12px 8px 10px;border-radius:36px!important}.kip-screen{padding:8px 10px}.kip-art-wrap,.kip-art{width:66px;height:66px}.kip-title{font-size:15px}}
`;

  const style = document.createElement('style');
  style.id = 'kip-styles';
  style.textContent = css;
  document.head.appendChild(style);

  const player = document.createElement('div');
  player.id = 'kefeIpodPlayer';
  player.className = 'kip-modal is-hidden';
  player.setAttribute('role', 'dialog');
  player.setAttribute('aria-modal', 'true');
  player.setAttribute('aria-label', 'KEFE iPod Player');
  player.innerHTML = `
    <div class="kip-shell">
      <button type="button" class="kip-close" id="kipClose" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      <div class="kip-screen">
        <div class="kip-statusbar">
          <span class="kip-time" id="kipClock">9:41 AM</span>
          <span class="kip-mode">Music</span>
          <span class="kip-spacer"></span>
          <svg class="kip-signal" viewBox="0 0 20 12"><rect x="0" y="7.5" width="3.2" height="4.5" rx=".6"/><rect x="4.4" y="5.2" width="3.2" height="6.8" rx=".6"/><rect x="8.8" y="2.6" width="3.2" height="9.4" rx=".6"/><rect x="13.2" y="0" width="3.2" height="12" rx=".6"/></svg>
          <span class="kip-5g">5G</span>
          <svg class="kip-battery" viewBox="0 0 26 12"><rect x=".5" y="1" width="21" height="10" rx="3"/><rect x="2" y="2.5" width="18" height="7" rx="1.6"/><rect x="23" y="4.2" width="2" height="3.6" rx=".8"/></svg>
        </div>
        <div class="kip-main">
          <div class="kip-art-wrap"><div class="kip-art" id="kipArt"></div></div>
          <div class="kip-meta">
            <div class="kip-title-row"><span class="kip-title" id="kipTitle">Add music to begin</span><span class="kip-explicit" id="kipExplicit" hidden>E</span></div>
            <div class="kip-artist" id="kipArtist">Nothing queued</div>
            <div class="kip-album" id="kipAlbum"></div>
          </div>
        </div>
        <div class="kip-dolby-row">
          <span class="kip-dolby"><svg viewBox="0 0 44 18" fill="currentColor"><path d="M0 2h6a7 7 0 0 1 0 14H0V2zm3 3v8h3a4 4 0 0 0 0-8H3zM20 2h6a7 7 0 0 1 0 14h-6V2zm3 3v8h3a4 4 0 0 0 0-8h-3z"/></svg> Dolby Atmos</span>
          <div><button type="button" class="kip-icon-btn" id="kipStar" aria-label="Favorite"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M12 3.5l2.6 6 6.4.5-4.9 4.2 1.5 6.3L12 17l-5.6 3.5 1.5-6.3L3 10l6.4-.5z"/></svg></button><button type="button" class="kip-icon-btn" id="kipMore" aria-label="More"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="6" cy="12" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="18" cy="12" r="2.2"/></svg></button></div>
        </div>
        <div class="kip-time-row"><span id="kipCurrent">0:00</span><span id="kipRemaining">-0:00</span></div>
        <div class="kip-progress"><span id="kipProgress"></span></div>
        <div class="kip-bottom-row">
          <span class="kip-device"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M6 4v16M9 4v16M12 4.5c1.8 0 2.8 1 2.8 2.8v9.4c0 1.8-1 2.8-2.8 2.8"/></svg> kiloByte's AirPods</span>
          <div><button type="button" class="kip-icon-btn" id="kipMessages" aria-label="Messages"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M4 5.5h16v11H9l-5 4z"/></svg></button><button type="button" class="kip-icon-btn" id="kipList" aria-label="Queue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button></div>
        </div>
      </div>
      <div class="kip-wheel">
        <button type="button" class="kip-wheel-btn kip-wheel-menu" id="kipMenu" aria-label="Presets"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="4" y="4" width="6.5" height="6.5" rx="1.4"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.4"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.4"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.4"/></svg></button>
        <button type="button" class="kip-wheel-btn kip-wheel-prev" id="kipPrev" aria-label="Previous"><svg viewBox="0 0 24 24"><path d="M6.5 5v14h1.8V5zM19 5.5L8.5 12 19 18.5z"/></svg></button>
        <button type="button" class="kip-wheel-btn kip-wheel-next" id="kipNext" aria-label="Next"><svg viewBox="0 0 24 24"><path d="M17.5 5v14h-1.8V5zM5 5.5L15.5 12 5 18.5z"/></svg></button>
        <button type="button" class="kip-wheel-btn kip-wheel-play" id="kipPlay" aria-label="Play"><svg viewBox="0 0 24 24"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg></button>
        <button type="button" class="kip-wheel-center" id="kipCenter" aria-label="Play"></button>
      </div>
      <div class="kip-presets" id="kipPresets" hidden><h4>Presets</h4><div id="kipPresetList"></div></div>
    </div>`;
  document.body.appendChild(player);

  const $ = id => document.getElementById(id);
  const audio = window.kefeAudioElement || null;

  const fallbackState = { audio: { file: null, metadata: { title: '', artist: '', album: '' } }, style: {} };
  const getState = () => window.state || fallbackState;
  const fmt = t => { t = Math.max(0, Number(t) || 0); return `${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`; };

  function syncClock() {
    const d = new Date();
    const h = d.getHours() % 12 || 12;
    const m = String(d.getMinutes()).padStart(2,'0');
    $('kipClock').textContent = `${h}:${m} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
  }
  syncClock(); setInterval(syncClock, 30000);

  function syncMeta() {
    const s = getState();
    const md = s.audio?.metadata || {};
    const file = s.audio?.file;
    const title = md.title || (file ? file.name.replace(/\.[^.]+$/,'') : '') || 'Add music to begin';
    $('kipTitle').textContent = title;
    $('kipArtist').textContent = md.artist || 'Nothing queued';
    $('kipAlbum').textContent = md.album || '';
    try {
      const art = window.kefeAlbumArt?.src;
      $('kipArt').style.backgroundImage = art ? `url("${art}")` : '';
    } catch(e){}
  }

  function syncProgress() {
    const dur = Number(audio.duration) || 0;
    const cur = Number(audio.currentTime) || 0;
    $('kipProgress').style.width = (dur > 0 ? (cur / dur * 100) : 0).toFixed(2) + '%';
    $('kipCurrent').textContent = fmt(cur);
    $('kipRemaining').textContent = dur > 0 ? '-' + fmt(dur - cur) : '-0:00';
  }

  function syncPlayIcon() {
    const playing = !audio.paused && !audio.ended;
    $('kipPlay').innerHTML = playing
      ? '<svg viewBox="0 0 24 24"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z"/></svg>';
  }

  function toggle() {
    if (!audio) return;
    if (audio.paused) audio.play().catch(()=>{}); else audio.pause();
  }

  function delegateQueue(id) {
    if (!window.kefeMiniPlayer?.tracks?.().length) return false;
    const control = document.getElementById(id);
    if (!control) return false;
    control.click();
    return true;
  }

  function next() {
    if (!audio) return;
    if (delegateQueue('kefeMiniNext')) return;
    audio.currentTime = 0;
  }

  function prev() {
    if (!audio) return;
    if (delegateQueue('kefeMiniPrev')) return;
    audio.currentTime = 0;
  }

  if (audio) {
    audio.addEventListener('timeupdate', syncProgress);
    audio.addEventListener('loadedmetadata', syncProgress);
    audio.addEventListener('play', syncPlayIcon);
    audio.addEventListener('pause', syncPlayIcon);
    audio.addEventListener('ended', next);
  }

  $('kipPlay').addEventListener('click', toggle);
  $('kipCenter').addEventListener('click', toggle);
  $('kipPrev').addEventListener('click', prev);
  $('kipNext').addEventListener('click', next);
  $('kipClose').addEventListener('click', close);
  $('kipStar').addEventListener('click', () => { $('kipStar').style.color = $('kipStar').style.color === 'rgb(255, 214, 92)' ? '' : 'rgb(255, 214, 92)'; });
  $('kipMore').addEventListener('click', () => { $('kipMenu').click(); });
  $('kipMessages').addEventListener('click', () => {});
  $('kipList').addEventListener('click', () => { $('kipMenu').click(); });

  function buildPresets() {
    const groups = [
      { key: 'butterchurn', label: 'Butterchurn', api: window.kefeButterchurn },
      { key: 'matrixmusic', label: 'Matrix Music', api: window.kefeMatrixVisualiser },
      { key: 'audioreactive', label: 'Audio Reactive', api: window.kefeAudioReactiveShaders }
    ];
    const html = [];
    groups.forEach(g => {
      let items = [];
      if (g.key === 'butterchurn') items = g.api?.presetNames?.() || [];
      else if (g.key === 'matrixmusic') items = (g.api?.presetRecords?.() || []).map(r => ({ value: r.id, label: r.name }));
      else if (g.key === 'audioreactive') items = (g.api?.presetNames?.() || []).map((n,i) => ({ value: String(i), label: n }));
      if (!items.length) return;
      html.push(`<optgroup>${g.label}</optgroup>`);
      items.forEach(it => {
        const value = typeof it === 'string' ? it : it.value;
        const label = typeof it === 'string' ? it.replace(/^[^-]+[-+]\s*/,'').trim() : it.label;
        html.push(`<button type="button" data-preset="${g.key}::${value}">${label}</button>`);
      });
    });
    $('kipPresetList').innerHTML = html.join('');
    $('kipPresetList').querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
      applyPreset(b.dataset.preset);
      $('kipPresets').hidden = true;
    }));
  }

  function applyPreset(value) {
    const [group, ...rest] = String(value).split('::');
    const preset = rest.join('::');
    const state = getState(); if (!state.style) state.style = {};
    state.style.visualiserStyle = group;
    if (group === 'butterchurn') { state.style.butterchurnPreset = preset; try { window.kefeButterchurn?.prepare?.(); } catch(e){} }
    else if (group === 'matrixmusic') { state.style.matrixMusicPreset = preset; try { window.kefeMatrixVisualiser?.selectPreset?.(preset); } catch(e){} }
    else if (group === 'audioreactive') { state.style.audioReactiveShaderPreset = Number(preset) || 0; try { window.kefeAudioReactiveShaders?.selectPreset?.(Number(preset) || 0); } catch(e){} }
  }
  $('kipMenu').addEventListener('click', () => { buildPresets(); $('kipPresets').hidden = !$('kipPresets').hidden; });

  function open() {
    player.classList.remove('is-hidden');
    syncMeta(); syncProgress(); syncPlayIcon();
  }
  function close() { player.classList.add('is-hidden'); if (audio) audio.pause(); }

  window.kefeIpodPlayer = { version: 1, open, close };
  window.addEventListener('kefe:open-ipod', open);

  const trigger = document.getElementById('miniPlayerBtn') || document.getElementById('ipodPlayerBtn');
  if (trigger) trigger.addEventListener('click', open);

  setInterval(syncMeta, 1200);
})();
