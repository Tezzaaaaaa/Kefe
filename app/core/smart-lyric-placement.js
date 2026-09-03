/* KEFE Smart Lyric Placement — Lucida foreground-aware lyric positioning. */
(() => {
  'use strict';
  if (window.kefeSmartLyricPlacement) return;

  const $ = id => document.getElementById(id);
  const state = window.state;
  const media = window.kefeMedia;
  if (!state || !media) return;

  const STORAGE_KEY = 'kefe-smart-lyrics-v1';
  const SAMPLE_COUNT = 14;
  const FRAME_WIDTH = 640;
  const FRAME_HEIGHT = 360;
  const SAFE = 0.055;
  const MIN_FOREGROUND = 0.012;

  const placement = {
    enabled: false,
    analysing: false,
    ready: false,
    timeline: [],
    base: null,
    request: 0
  };

  function clamp(v, a = 0, b = 1) { return Math.max(a, Math.min(b, Number(v) || 0)); }
  function smooth(v) { const t = clamp(v); return t * t * (3 - 2 * t); }

  function addControls() {
    const section = $('textSection');
    if (!section || $('smartLyricPlacement')) return;

    const box = document.createElement('div');
    box.id = 'smartLyricPlacement';
    box.className = 'section smart-lyric-placement';
    box.innerHTML = `
      <div class="section-subheading">Smart placement</div>
      <button type="button" id="smartLyricPlacementBtn" class="primary">Auto place lyrics</button>
      <div id="smartLyricPlacementStatus" class="status">Moves lyrics around the foreground automatically.</div>
    `;
    section.appendChild(box);

    $('smartLyricPlacementBtn')?.addEventListener('click', run);
  }

  function status(text, type = '') {
    const el = $('smartLyricPlacementStatus');
    if (!el) return;
    el.textContent = text;
    el.className = 'status' + (type ? ' ' + type : '');
  }

  function captureFrame(video, time) {
    return new Promise((resolve, reject) => {
      const target = Math.max(0, Math.min(Number(video.duration) || 0, time));
      const previous = Number(video.currentTime) || 0;
      let settled = false;
      const cleanup = () => {
        video.removeEventListener('seeked', onSeeked);
        clearTimeout(timer);
      };
      const finish = fn => {
        if (settled) return;
        settled = true;
        cleanup();
        try { video.currentTime = previous; } catch (_) {}
        fn();
      };
      const draw = () => {
        try {
          const canvas = document.createElement('canvas');
          const ratio = Math.max(1, (video.videoWidth || 1) / (video.videoHeight || 1));
          canvas.width = FRAME_WIDTH;
          canvas.height = Math.max(180, Math.round(FRAME_WIDTH / ratio));
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(blob => blob ? finish(() => resolve(blob)) : finish(() => reject(new Error('Could not encode video frame'))), 'image/jpeg', 0.86);
        } catch (error) { finish(() => reject(error)); }
      };
      const onSeeked = () => draw();
      const timer = setTimeout(() => finish(() => reject(new Error('Video frame seek timed out'))), 7000);
      video.addEventListener('seeked', onSeeked, { once: true });
      try { video.pause(); video.currentTime = target; } catch (error) { finish(() => reject(error)); }
      if (Math.abs((Number(video.currentTime) || 0) - target) < 0.01 && video.readyState >= 2) draw();
    });
  }

  async function lucidaMask(blob, signal) {
    const body = new FormData();
    body.append('image', blob, 'frame.jpg');
    const response = await fetch('/api/remove-background', { method: 'POST', body, signal });
    if (!response.ok) throw new Error(`Lucida analysis failed (${response.status})`);
    return response.blob();
  }

  async function alphaBounds(blob) {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close?.();
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let minX = width, minY = height, maxX = -1, maxY = -1, count = 0;
    const step = Math.max(1, Math.floor(Math.min(width, height) / 320));
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const a = data[(y * width + x) * 4 + 3];
        if (a < 32) continue;
        count++;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
    if (!count || maxX < 0) return null;
    const area = ((maxX - minX + 1) * (maxY - minY + 1)) / (width * height);
    if (area < MIN_FOREGROUND) return null;
    return {
      x: minX / width, y: minY / height,
      w: (maxX - minX + 1) / width,
      h: (maxY - minY + 1) / height,
      area
    };
  }

  function scoreCandidate(candidate, foreground) {
    const cx = candidate.x + candidate.w / 2;
    const cy = candidate.y + candidate.h / 2;
    const fx = foreground.x + foreground.w / 2;
    const fy = foreground.y + foreground.h / 2;
    const dx = Math.abs(cx - fx);
    const dy = Math.abs(cy - fy);
    const overlapX = Math.max(0, Math.min(candidate.x + candidate.w, foreground.x + foreground.w) - Math.max(candidate.x, foreground.x));
    const overlapY = Math.max(0, Math.min(candidate.y + candidate.h, foreground.y + foreground.h) - Math.max(candidate.y, foreground.y));
    const overlap = overlapX * overlapY;
    const distance = Math.hypot(dx, dy);
    return overlap * 8 - distance * 0.55;
  }

  function chooseAnchor(foreground) {
    if (!foreground) return { x: 0.5, y: 0.25, align: 'left' };
    const fw = foreground.w;
    const fh = foreground.h;
    const candidates = [
      { name: 'left', x: SAFE, y: SAFE, w: Math.max(0.32, 0.43 - SAFE), h: 0.20, align: 'left' },
      { name: 'right', x: 0.57, y: SAFE, w: 0.38, h: 0.20, align: 'right' },
      { name: 'left-mid', x: SAFE, y: 0.30, w: 0.40, h: 0.22, align: 'left' },
      { name: 'right-mid', x: 0.55, y: 0.30, w: 0.40, h: 0.22, align: 'right' },
      { name: 'bottom-left', x: SAFE, y: 0.67, w: 0.40, h: 0.22, align: 'left' },
      { name: 'bottom-right', x: 0.55, y: 0.67, w: 0.40, h: 0.22, align: 'right' },
      { name: 'top-centre', x: 0.15, y: SAFE, w: 0.70, h: 0.18, align: 'center' },
      { name: 'bottom-centre', x: 0.15, y: 0.72, w: 0.70, h: 0.18, align: 'center' }
    ];
    const ranked = candidates.map(c => ({ ...c, score: scoreCandidate(c, foreground) })).sort((a, b) => a.score - b.score);
    const best = ranked[0];
    return {
      x: best.x + best.w / 2,
      y: best.y + best.h * 0.32,
      align: best.align,
      confidence: clamp(0.45 + Math.min(0.45, foreground.area * 1.8))
    };
  }

  function interpolate(a, b, t) {
    const p = smooth(t);
    return {
      x: a.x + (b.x - a.x) * p,
      y: a.y + (b.y - a.y) * p,
      align: p < 0.5 ? a.align : b.align,
      confidence: a.confidence + (b.confidence - a.confidence) * p
    };
  }

  function placementAt(time) {
    const list = placement.timeline;
    if (!list.length) return null;
    if (time <= list[0].time) return list[0];
    for (let i = 1; i < list.length; i++) {
      if (time <= list[i].time) return interpolate(list[i - 1], list[i], (time - list[i - 1].time) / Math.max(0.001, list[i].time - list[i - 1].time));
    }
    return list[list.length - 1];
  }

  function apply(time) {
    if (!placement.enabled || !placement.ready || !placement.timeline.length || !state.style) return;
    const p = placementAt(Number(time) || 0);
    if (!p) return;
    state.style.align = p.align;
    // Apple effect's native 24.5% focal position is the base; smart placement
    // moves the whole lyric stack vertically while preserving its visual rhythm.
    const target = clamp(p.y, 0.12, 0.82);
    state.style.appleTopOffset = target;
  }

  function snapshotBase() {
    if (placement.base) return;
    placement.base = {
      align: state.style.align,
      appleTopOffset: state.style.appleTopOffset
    };
  }

  function restoreBase() {
    if (!placement.base) return;
    state.style.align = placement.base.align;
    state.style.appleTopOffset = placement.base.appleTopOffset;
  }

  function attachRuntime() {
    const redraw = window.redrawCurrentPreviewFrame;
    if (typeof redraw === 'function' && !redraw.__smartPlacementWrapped) {
      const wrapped = function(...args) {
        apply(Number(state.playback?.currentTime) || 0);
        return redraw.apply(this, args);
      };
      wrapped.__smartPlacementWrapped = true;
      window.redrawCurrentPreviewFrame = wrapped;
    }
    if (!window.kefeSmartLyricPlacementRenderHook) {
      window.kefeSmartLyricPlacementRenderHook = true;
      const tick = () => {
        if (placement.enabled && placement.ready) apply(Number(state.playback?.currentTime) || 0);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }

  async function run() {
    if (placement.analysing) return;
    if (window.isExporting) { window.toast?.('Finish or cancel the current export first', 'error'); return; }
    const video = media.video;
    if (!video || !media.videoFile || !Number.isFinite(video.duration) || video.duration <= 0) {
      status('Add a background video first — smart placement needs moving foreground imagery.', 'error');
      window.toast?.('Add a background video first', 'error');
      return;
    }
    if (!state.lyrics?.lines?.length && !(state.captions?.mode === 'captions' && state.captions?.lines?.length)) {
      status('Load lyrics first, then run Auto place lyrics.', 'error');
      window.toast?.('Load lyrics first', 'error');
      return;
    }

    const button = $('smartLyricPlacementBtn');
    const request = ++placement.request;
    placement.analysing = true;
    placement.enabled = false;
    placement.ready = false;
    button && (button.disabled = true);
    snapshotBase();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    try {
      const duration = video.duration;
      const times = Array.from({ length: SAMPLE_COUNT }, (_, i) => duration * (i / Math.max(1, SAMPLE_COUNT - 1)));
      const timeline = [];
      for (let i = 0; i < times.length; i++) {
        status(`Analysing foreground ${i + 1}/${times.length}…`, 'loading');
        const frame = await captureFrame(video, times[i]);
        const mask = await lucidaMask(frame, controller.signal);
        const bounds = await alphaBounds(mask);
        const anchor = chooseAnchor(bounds);
        timeline.push({ time: times[i], ...anchor });
      }
      if (request !== placement.request) return;
      placement.timeline = timeline;
      placement.ready = true;
      placement.enabled = true;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(timeline)); } catch (_) {}
      apply(Number(state.playback?.currentTime) || 0);
      window.redrawCurrentPreviewFrame?.();
      status('Lyrics will now move around the foreground automatically.', 'success');
      window.toast?.('Smart lyric placement applied', 'success');
    } catch (error) {
      if (request !== placement.request) return;
      placement.enabled = false;
      placement.ready = false;
      restoreBase();
      const message = error?.name === 'AbortError' ? 'Smart placement timed out — try a shorter video.' : (error?.message || 'Smart placement failed');
      status(message, 'error');
      window.toast?.('Smart lyric placement failed', 'error');
    } finally {
      clearTimeout(timeout);
      placement.analysing = false;
      if (button) {
        button.disabled = false;
        button.textContent = placement.enabled ? 'Re-analyse lyric placement' : 'Auto place lyrics';
      }
      try { video.currentTime = Number(state.playback?.currentTime) || 0; } catch (_) {}
      window.redrawCurrentPreviewFrame?.();
    }
  }

  window.kefeSmartLyricPlacement = {
    run,
    apply,
    get enabled() { return placement.enabled; },
    get timeline() { return placement.timeline.slice(); }
  };

  window.addEventListener('kefe:runtime-bootstrapped', attachRuntime);
  if (window.kefeRuntime?.ready) attachRuntime();
  addControls();
})();
