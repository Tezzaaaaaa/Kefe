/* KEFE — Quick reel.
   One-tap vertical export for TikTok, Reels and Shorts. It does not add a second exporter: it picks a clip
   (length + start, or the loudest section of the track), sets the existing export controls to 9:16 / MP4 / 1080p,
   hands the clip to the export handler through window.kefeExportClip, clicks the normal Export button, then puts
   the previous aspect, format and resolution back. A plain Export is untouched because kefeExportClip is only set
   for the duration of a reel export. */
(() => {
  'use strict';

  const LENGTHS = [15, 30, 60, 90];
  const BLOCK = 0.25; /* seconds per loudness block */
  const state = { length: 30, start: 0, busy: false, hookCache: null };
  const $ = id => document.getElementById(id);
  const audio = () => $('kefeAudio');

  const fmt = v => {
    v = Math.max(0, Number(v) || 0);
    return Math.floor(v / 60) + ':' + String(Math.floor(v % 60)).padStart(2, '0');
  };
  const duration = () => {
    const d = audio() && audio().duration;
    return Number.isFinite(d) && d > 0 ? d : 0;
  };
  const clipLength = () => Math.max(1, Math.min(state.length, duration() || state.length));
  const maxStart = () => Math.max(0, duration() - clipLength());
  const clampStart = v => Math.max(0, Math.min(Number(v) || 0, maxStart()));
  const playhead = () => {
    const a = audio();
    return a && Number.isFinite(a.currentTime) ? a.currentTime : 0;
  };
  const setSelect = (el, value) => {
    if (!el || el.value === value) return;
    el.value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };

  let root = null;
  const q = sel => root && root.querySelector(sel);

  function say(text) {
    const el = q('#kqrStatus');
    if (el) el.textContent = text || '';
  }

  function render() {
    if (!root || !root.isConnected) return;
    const has = duration() > 0;
    const len = clipLength();
    state.start = clampStart(state.start);
    root.querySelectorAll('[data-kqr-length]').forEach(b => {
      b.setAttribute('aria-pressed', String(Number(b.dataset.kqrLength) === state.length));
      b.disabled = state.busy;
    });
    const slider = q('#kqrStart');
    slider.max = String(Math.max(0, Math.floor(maxStart() * 10) / 10));
    slider.value = String(state.start);
    slider.disabled = !has || state.busy || maxStart() <= 0;
    q('#kqrStartOut').textContent = fmt(state.start);
    ['#kqrPlayhead', '#kqrHook', '#kqrPreview'].forEach(sel => { q(sel).disabled = !has || state.busy; });
    q('#kqrExport').disabled = !has || state.busy;
    q('#kqrExport').textContent = state.busy ? 'Exporting reel…' : 'Export reel';
    q('#kqrSummary').textContent = has
      ? fmt(state.start) + ' – ' + fmt(state.start + len) + ' · ' + Math.round(len) + ' s · 1080 × 1920 · MP4'
      : 'Upload a track in Media to make a reel.';
  }

  /* Loudest stretch of the track, found from the decoded audio. The window starts on a lyric line when one is
     close, so the reel opens on the start of a line instead of halfway through it. */
  async function findHook() {
    const a = audio();
    const engine = window.kefeExportEngine;
    if (!a || !a.src || !engine || typeof engine.decodeAudio !== 'function') throw new Error('Loudest-part search needs a loaded track and a browser that can decode audio.');
    const key = a.currentSrc || a.src;
    if (!state.hookCache || state.hookCache.key !== key) {
      const decoded = await engine.decodeAudio(key, {});
      const rate = decoded.sampleRate, size = Math.max(1, Math.round(rate * BLOCK));
      const chans = [];
      for (let c = 0; c < Math.min(2, decoded.numberOfChannels); c++) chans.push(decoded.getChannelData(c));
      const blocks = [];
      for (let i = 0; i + size <= decoded.length; i += size) {
        let sum = 0;
        for (let c = 0; c < chans.length; c++) { const d = chans[c]; for (let k = i; k < i + size; k += 4) sum += d[k] * d[k]; }
        blocks.push(Math.sqrt(sum / (chans.length * (size / 4))));
      }
      state.hookCache = { key, blocks };
    }
    const blocks = state.hookCache.blocks;
    const win = Math.max(1, Math.round(clipLength() / BLOCK));
    if (blocks.length <= win) return 0;
    let acc = 0, best = -1, bestAt = 0;
    for (let i = 0; i < blocks.length; i++) {
      acc += blocks[i];
      if (i >= win) acc -= blocks[i - win];
      if (i >= win - 1 && acc > best) { best = acc; bestAt = i - win + 1; }
    }
    let start = bestAt * BLOCK;
    const lines = (window.kefeLyrics && window.kefeLyrics.lines && window.kefeLyrics.lines()) || [];
    let snap = null;
    for (const line of lines) {
      const t = Number(line.time);
      if (!Number.isFinite(t)) continue;
      if (Math.abs(t - start) <= 3 && (snap === null || Math.abs(t - start) < Math.abs(snap - start))) snap = t;
    }
    if (snap !== null) start = snap;
    return clampStart(start);
  }

  function preview() {
    const a = audio();
    if (!a || !duration()) return;
    setSelect($('kefeAspect'), '9:16');
    const from = state.start, to = from + clipLength();
    if (window.kefeLyrics && window.kefeLyrics.seek) window.kefeLyrics.seek(from);
    else a.currentTime = from;
    const stop = () => {
      if (a.currentTime >= to || a.paused) { a.removeEventListener('timeupdate', stop); if (a.currentTime >= to) a.pause(); }
    };
    a.addEventListener('timeupdate', stop);
    a.play().catch(() => say('Press play on the timeline to hear the preview.'));
  }

  async function exportReel() {
    const exportButton = $('exportButton');
    const aspect = $('kefeAspect'), format = $('exportFormat'), resolution = $('exportResolution');
    if (!exportButton || !aspect || !format || !resolution) { say('The export controls are not ready yet. Try again in a moment.'); return; }
    if (!duration()) { say('Upload a playable track first.'); return; }
    if (exportButton.disabled || window.kefeAppleCanvasExport) { say('An export is already running.'); return; }
    const before = { aspect: aspect.value, format: format.value, resolution: resolution.value };
    const clip = { start: clampStart(state.start), length: clipLength() };
    state.busy = true;
    render();
    say('');
    const restore = () => {
      window.kefeExportClip = null;
      setSelect(aspect, before.aspect);
      setSelect(format, before.format);
      setSelect(resolution, before.resolution);
      state.busy = false;
      render();
    };
    setSelect(aspect, '9:16');
    setSelect(format, 'mp4');
    setSelect(resolution, '1080');
    window.kefeExportClip = clip;
    /* Let the canvas take the vertical shape before the exporter reads its size. */
    await new Promise(r => setTimeout(r, 250));
    window.addEventListener('kefe-export-finished', event => {
      restore();
      say(event.detail && event.detail.ok ? 'Reel exported (' + Math.round(clip.length) + ' s). Your previous export settings are back.' : '');
    }, { once: true });
    exportButton.click();
    /* The exporter refuses some requests before it starts (no audio, unsupported browser) and then never finishes. */
    setTimeout(() => {
      if (state.busy && !window.kefeAppleCanvasExport) {
        const note = ($('exportStatus') && $('exportStatus').textContent) || 'The export did not start.';
        restore();
        say(note);
      }
    }, 900);
  }

  function build() {
    const wrap = document.createElement('div');
    wrap.id = 'kefeQuickReel';
    wrap.className = 'kefe-quick-reel';
    wrap.innerHTML =
      '<div class="kqr-head"><span class="kefe-label" id="kqrLabel">Quick reel</span>' +
      '<p class="kefe-meta">Vertical 9:16 MP4 for TikTok, Reels and Shorts. Pick a length and where it starts.</p></div>' +
      '<div class="kqr-row kqr-lengths" role="group" aria-labelledby="kqrLabel">' +
      LENGTHS.map(n => '<button type="button" class="shad-btn shad-btn--outline kqr-btn" data-kqr-length="' + n + '" aria-pressed="false">' + n + ' s</button>').join('') +
      '</div>' +
      '<div class="kqr-start"><label class="kefe-label" for="kqrStart">Start <output id="kqrStartOut" for="kqrStart">0:00</output></label>' +
      '<input class="kefe-slider" id="kqrStart" type="range" min="0" max="0" step="0.1" value="0"></div>' +
      '<div class="kqr-row kqr-picks">' +
      '<button type="button" class="shad-btn shad-btn--outline kqr-btn" id="kqrPlayhead">From playhead</button>' +
      '<button type="button" class="shad-btn shad-btn--outline kqr-btn" id="kqrHook">Loudest part</button>' +
      '<button type="button" class="shad-btn shad-btn--outline kqr-btn" id="kqrPreview">Preview</button></div>' +
      '<button type="button" class="shad-btn shad-btn--outline kqr-btn kqr-safe-toggle" id="kqrSafe" aria-pressed="false">Show safe zones on the preview</button>' +
      '<p class="kefe-meta kqr-summary" id="kqrSummary" role="status" aria-live="polite"></p>' +
      '<button type="button" class="kefe-btn primary" id="kqrExport">Export reel</button>' +
      '<p class="kefe-meta" id="kqrStatus" role="status" aria-live="polite"></p>';

    wrap.querySelectorAll('[data-kqr-length]').forEach(b => b.addEventListener('click', () => {
      state.length = Number(b.dataset.kqrLength);
      render();
    }));
    wrap.querySelector('#kqrStart').addEventListener('input', e => { state.start = clampStart(e.target.value); render(); });
    wrap.querySelector('#kqrPlayhead').addEventListener('click', () => { state.start = clampStart(playhead()); say(''); render(); });
    wrap.querySelector('#kqrHook').addEventListener('click', async () => {
      const button = wrap.querySelector('#kqrHook');
      button.disabled = true;
      say('Finding the loudest part…');
      try { state.start = await findHook(); say('Starts at ' + fmt(state.start) + '.'); }
      catch (error) { say((error && error.message) || 'Could not analyse this track.'); }
      render();
    });
    wrap.querySelector('#kqrPreview').addEventListener('click', preview);
    wrap.querySelector('#kqrExport').addEventListener('click', exportReel);
    wrap.querySelector('#kqrSafe').addEventListener('click', e => {
      const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
      e.currentTarget.setAttribute('aria-pressed', String(on));
      const stage = document.querySelector('.kefe-stage');
      if (!stage) return;
      let guide = stage.querySelector('.kqr-guide');
      if (on && !guide) {
        guide = document.createElement('div');
        guide.className = 'kqr-guide';
        guide.setAttribute('aria-hidden', 'true');
        guide.innerHTML = '<span>Keep text inside the box. Buttons and captions cover the edges.</span>';
        stage.appendChild(guide);
      }
      stage.classList.toggle('kqr-show-guide', on);
    });
    return wrap;
  }

  function mount() {
    const form = document.querySelector('.kefe-panel[data-panel-view="export"] .kefe-form');
    if (!form || form.querySelector('#kefeQuickReel')) return;
    root = build();
    form.prepend(root);
    render();
  }

  function start() {
    mount();
    const a = audio();
    if (a) ['loadedmetadata', 'durationchange', 'emptied'].forEach(ev => a.addEventListener(ev, () => { state.hookCache = null; render(); }));
    /* The settings shell can rebuild panels after load; remount if the card went missing. */
    let tries = 0;
    const timer = setInterval(() => { mount(); render(); if (++tries > 20) clearInterval(timer); }, 500);
  }

  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
})();
