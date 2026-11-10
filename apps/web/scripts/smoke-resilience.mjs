import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(resolve(webRoot, rel), 'utf8');

function setupDom(html = '<!doctype html><html><body></body></html>', opts = {}) {
  const dom = new JSDOM(html, { url: 'https://kefe.example.test/editor.html', ...opts });
  const { window } = dom;
  const ctx = {
    window,
    document: window.document,
    navigator: window.navigator,
    HTMLElement: window.HTMLElement,
    HTMLButtonElement: window.HTMLButtonElement,
    Element: window.Element,
    Node: window.Node,
    CustomEvent: window.CustomEvent,
    Event: window.Event,
    DOMException: window.DOMException || Error,
    AbortController: window.AbortController,
    MutationObserver: window.MutationObserver,
    matchMedia: window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })),
    requestAnimationFrame: window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : (fn) => setTimeout(() => fn(performance.now()), 0),
    cancelAnimationFrame: window.cancelAnimationFrame ? window.cancelAnimationFrame.bind(window) : clearTimeout,
    performance,
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    localStorage: window.localStorage,
    location: window.location,
    URL: window.URL,
    CSS: { escape: (s) => String(s).replace(/[^\w-]/g, '\\$&') },
    devicePixelRatio: 1,
    Float32Array,
    Uint8Array,
    Int32Array,
  };
  Object.defineProperty(window.document, 'hidden', {
    configurable: true,
    writable: true,
    value: false,
  });
  Object.assign(window, {
    matchMedia: ctx.matchMedia,
    requestAnimationFrame: ctx.requestAnimationFrame,
    cancelAnimationFrame: ctx.cancelAnimationFrame,
    CSS: ctx.CSS,
  });
  return { dom, window, ctx };
}

/* 1. kefeResilience core unit tests */
{
  const { window, ctx } = setupDom('<div class="kefe-panel" data-panel-view="visualiser"><div class="kefe-visualiser-form"></div></div>');
  vm.runInNewContext(read('app/ui/resilience.js'), ctx, { filename: 'resilience.js' });
  const R = window.kefeResilience;
  assert.ok(R, 'window.kefeResilience registered');

  let retried = 0;
  let continued = 0;
  const banner = R.panelError('visualiser', {
    id: 'gl-err',
    title: 'WebGL unavailable',
    message: 'Fallback active',
    retryLabel: 'Retry',
    onRetry: () => { retried++; },
    continueLabel: 'Continue',
    onContinue: () => { continued++; },
  });
  assert.ok(banner, 'banner mounted');
  assert.equal(window.document.querySelectorAll('.kefe-resilience-banner').length, 1);

  /* Deduplication by id */
  const banner2 = R.panelError('visualiser', {
    id: 'gl-err',
    title: 'Updated',
    message: 'Updated msg',
    retryLabel: 'Retry',
    onRetry: () => { retried++; },
    continueLabel: 'Continue',
    onContinue: () => { continued++; },
  });
  assert.equal(window.document.querySelectorAll('.kefe-resilience-banner').length, 1);

  banner2.querySelector('.kefe-resilience-retry').click();
  await new Promise(r => setTimeout(r, 0));
  assert.equal(retried, 1, 'Retry handler fired');
  const banner3 = R.panelError('visualiser', {
    id: 'gl-err',
    title: 'With continue',
    message: 'msg',
    continueLabel: 'Continue',
    onContinue: () => { continued++; },
  });
  banner3.querySelector('.kefe-resilience-continue').click();
  assert.equal(continued, 1, 'Continue handler fired');

  R.clearPanelError('visualiser', 'gl-err');
  assert.equal(window.document.querySelectorAll('.kefe-resilience-banner').length, 0, 'banner removed cleanly');

  let caught = null;
  const origErr = console.error;
  console.error = () => {};
  try {
    const safe = R.guard('test', () => { throw new Error('boom'); }, (err) => { caught = err; });
    assert.equal(safe(), undefined, 'guard catches synchronous throw without propagating');
    assert.equal(caught?.message, 'boom', 'guard forwards error to onError callback');
  } finally {
    console.error = origErr;
  }

  const scope = R.createScope();
  let clicks = 0;
  const btn = window.document.createElement('button');
  scope.on(btn, 'click', () => clicks++);
  btn.click();
  scope.dispose();
  btn.click();
  assert.equal(clicks, 1, 'scope.dispose removes event listeners');

  const gate = R.createAsyncGate();
  const t1 = gate.next();
  const t2 = gate.next();
  assert.equal(t1.isCurrent(), false, 'stale token invalidated by next()');
  assert.equal(t2.isCurrent(), true, 'newest token is current');
  gate.cancel();
  assert.equal(t2.isCurrent(), false, 'token invalidated by cancel()');

  assert.equal(R.hasUsableSize({ width: 0, height: 100 }), false);
  assert.equal(R.hasUsableSize({ width: 100, height: 100 }), true);
  assert.equal(R.isImageCorsSafe({ src: 'data:image/png;base64,AA', complete: true, naturalWidth: 10 }), true);
  assert.equal(R.isImageCorsSafe({ src: 'https://cdn.other.test/art.jpg', complete: true, naturalWidth: 10, crossOrigin: '' }), false);
  assert.equal(R.isImageCorsSafe({ src: 'https://cdn.other.test/art.jpg', complete: true, naturalWidth: 10, crossOrigin: 'anonymous' }), true);

  /* Render loop pauses when document.hidden is true, resumes on visibilitychange, and stops on uncaught throw */
  let pauseTicks = 0;
  const pauseLoop = R.createRenderLoop(() => { pauseTicks++; });
  window.document.hidden = true;
  pauseLoop.start();
  await new Promise(r => setTimeout(r, 25));
  assert.equal(pauseTicks, 0, 'render loop does not tick while document is hidden');
  window.document.hidden = false;
  window.document.dispatchEvent(new window.Event('visibilitychange'));
  await new Promise(r => setTimeout(r, 25));
  assert.ok(pauseTicks >= 1, 'render loop resumes when document becomes visible');
  pauseLoop.dispose();

  let loopError = null;
  let ticks = 0;
  const loop = R.createRenderLoop(() => {
    ticks++;
    throw new Error('render crash');
  }, { onError: (err) => { loopError = err; } });
  const origConsoleError = console.error;
  console.error = () => {};
  try {
    loop.start();
    await new Promise(r => setTimeout(r, 30));
  } finally {
    console.error = origConsoleError;
  }
  assert.equal(ticks, 1, 'render loop stops after uncaught throw');
  assert.equal(loopError?.message, 'render crash', 'render loop forwards error to onError');
  assert.equal(loop.hasCrashed(), true, 'render loop marks crashed state');
  loop.dispose();
}

/* 2. audio-overlay single MediaElementSourceNode + silent CORS detection */
{
  const { window, ctx } = setupDom('<audio id="kefeAudio"></audio>');
  const audioEl = window.document.getElementById('kefeAudio');
  Object.defineProperty(audioEl, 'src', { value: 'https://cdn.other.test/track.mp3', configurable: true });
  Object.defineProperty(audioEl, 'currentSrc', { value: 'https://cdn.other.test/track.mp3', configurable: true });
  Object.defineProperty(audioEl, 'paused', { value: false, configurable: true });
  Object.defineProperty(audioEl, 'ended', { value: false, configurable: true });
  Object.defineProperty(audioEl, 'muted', { value: false, configurable: true });
  Object.defineProperty(audioEl, 'volume', { value: 1, configurable: true });

  let sourceCreations = 0;
  class FakeAudioContext {
    constructor() { this.state = 'running'; this.sampleRate = 48000; this.destination = {}; }
    addEventListener() {}
    createAnalyser() { return { fftSize: 2048, frequencyBinCount: 32, smoothingTimeConstant: 0.78, connect() {}, getByteFrequencyData(arr) { arr.fill(0); } }; }
    createMediaElementSource() { sourceCreations++; return { connect() {} }; }
    createMediaStreamDestination() { return { stream: { getAudioTracks: () => [] } }; }
    resume() { return Promise.resolve(); }
  }
  window.AudioContext = ctx.AudioContext = FakeAudioContext;
  vm.runInNewContext(read('app/visualiser/audio-overlay.js'), ctx, { filename: 'audio-overlay.js' });

  const g1 = window.kefeAudioGraph.ensure();
  const g2 = window.kefeAudioGraph.ensure();
  assert.ok(g1 && g2 && g1.src === g2.src, 'reuses MediaElementAudioSourceNode');
  assert.equal(sourceCreations, 1, 'createMediaElementSource called only once per element');

  const bins = new Uint8Array(32);
  let lastRead = null;
  for (let i = 0; i < 48; i++) lastRead = window.kefeAudioGraph.readFrequencyData(bins);
  assert.equal(lastRead.reason, 'cors-or-silent', 'detects prolonged zeroed frequency output during cross-origin playback');
  assert.equal(window.kefeAudioGraph.status().corsBlocked, true, 'reports corsBlocked state');
}

/* 3. Lazy WebGL init & null-WebGL fallback across all WebGL visualisers */
{
  const html = `
    <div class="kefe-stage">
      <canvas id="kefeCanvas" width="1280" height="720"></canvas>
    </div>
    <div class="kefe-panel" data-panel-view="visualiser">
      <div class="kefe-vis-tabs" role="tablist"></div>
      <div class="kefe-visualiser-preset-row" id="kefeVisualiserPresetRow" hidden></div>
      <div class="kefe-visualiser-form"></div>
    </div>
  `;
  const { window, ctx } = setupDom(html);
  let webglCalls = 0;
  const origGetContext = window.HTMLCanvasElement.prototype.getContext;
  window.HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') {
      webglCalls++;
      return null; /* Simulate WebGL disabled / blocked */
    }
    return origGetContext ? origGetContext.call(this, type, ...rest) : null;
  };
  /* Stub stage rect so resize() sees valid geometry */
  window.document.querySelector('.kefe-stage').getBoundingClientRect = () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 });

  vm.runInNewContext(read('app/ui/resilience.js'), ctx, { filename: 'resilience.js' });
  vm.runInNewContext(read('app/visualiser/gradient.js'), ctx, { filename: 'gradient.js' });
  vm.runInNewContext(read('app/visualiser/liquid-glass.js'), ctx, { filename: 'liquid-glass.js' });
  vm.runInNewContext(read('app/visualiser/fluted-glass.js'), ctx, { filename: 'fluted-glass.js' });
  vm.runInNewContext(read('app/visualiser/slow-light.js'), ctx, { filename: 'slow-light.js' });
  vm.runInNewContext(read('app/visualiser/shader-vis.js'), ctx, { filename: 'shader-vis.js' });
  vm.runInNewContext(read('app/visualiser/silk-road.js'), ctx, { filename: 'silk-road.js' });

  if (window.document.readyState === 'loading') {
    await new Promise(resolve => window.document.addEventListener('DOMContentLoaded', resolve, { once: true }));
  }

  /* All tabs must exist, and ZERO WebGL contexts should have been opened at startup */
  assert.equal(webglCalls, 0, 'WebGL contexts are NOT opened eagerly at startup');
  for (const id of ['gradient', 'liquid-glass', 'fluted', 'slow-light', 'silk-road']) {
    assert.ok(window.document.querySelector(`[data-visualiser="${id}"]`), `tab ${id} registered`);
  }

  /* Selecting Liquid Glass when WebGL is null triggers fallback banner + disables power */
  const origConsoleError2 = console.error;
  console.error = () => {};
  try {
    window.document.querySelector('[data-visualiser="liquid-glass"]').click();
    assert.ok(webglCalls >= 1, 'WebGL initialized lazily when tab selected');
    const lgPower = window.document.getElementById('kefeLiquidGlassPower');
    assert.equal(lgPower.disabled, true, 'Liquid Glass power disabled when WebGL unavailable');
    assert.match(lgPower.textContent, /Unavailable/);
    assert.ok(window.document.querySelector('.kefe-resilience-banner[data-kefe-err="liquid-glass-gl"]'), 'inline WebGL fallback banner displayed');

    /* Clicking Continue switches back to Fluid Ink */
    const continueBtn = window.document.querySelector('.kefe-resilience-banner[data-kefe-err="liquid-glass-gl"] .kefe-resilience-continue');
    continueBtn.click();
    assert.equal(window.document.querySelector('[data-visualiser="gradient"]').getAttribute('aria-selected'), 'true', 'Continue button activates Fluid Ink');

    /* Selecting Slow Light, Glass Lens, and Silk Road when WebGL is null also degrades cleanly without throwing */
    window.document.querySelector('[data-visualiser="fluted"]').click();
    assert.equal(window.document.getElementById('flutedPower').disabled, true, 'Glass Lens power disabled when WebGL unavailable');
    window.document.querySelector('[data-visualiser="slow-light"]').click();
    window.document.querySelector('[data-visualiser="slow-light"]').closest('.kefe-vis-option').querySelector('.kefe-vis-option-power').click();
    assert.equal(window.document.querySelector('[data-visualiser="slow-light"]').closest('.kefe-vis-option').querySelector('.kefe-vis-option-power').disabled, true, 'Slow Light power disabled when WebGL unavailable');
    window.document.querySelector('[data-visualiser="silk-road"]').click();
    window.document.querySelector('[data-visualiser="silk-road"]').closest('.kefe-vis-option').querySelector('.kefe-vis-option-power').click();
    assert.equal(window.document.querySelector('[data-visualiser="silk-road"]').closest('.kefe-vis-option').querySelector('.kefe-vis-option-power').disabled, true, 'Silk Road power disabled when WebGL unavailable');
  } finally {
    console.error = origConsoleError2;
  }
}

/* 4. Static structural invariants for async/race/cleanup hardening */
{
  const editorSrc = read('app/editor.js');
  assert.ok(!/image\.src=normalizeArtworkUrl\(cover\);\s*titleArtImage=image;/.test(editorSrc), 'titleArtImage is not assigned prior to onload');
  assert.ok(editorSrc.includes('exportAbort=new AbortController()'), 'editor export supports AbortController cancellation');
  assert.ok(editorSrc.includes('typeof t.clone===\'function\'?t.clone():t'), 'editor export clones shared audio tracks before stopping');
  assert.ok(editorSrc.includes('runEncode(720,exportAbort.signal)'), 'editor export retries at 720p on high-res encoder failure');

  const autoSyncSrc = read('app/lyrics/auto-sync.js');
  assert.ok(!/decodeAudio\(\)[\s\S]*return\s*\{[^}]*context\s*:/.test(autoSyncSrc), 'auto-sync closes AudioContext inside decodeAudio before ML inference');

  const wsSrc = read('app/ui/workspace-state.js');
  assert.ok(wsSrc.includes('dbPromise = null; reject('), 'workspace-state clears cached rejected dbPromise');

  const lyricStudioSrc = read('app/lyrics/lyric-studio.js');
  assert.ok(!/\(function tick\(\).*requestAnimationFrame\(tick\)/.test(lyricStudioSrc), 'lyric-studio does not run unconditional rAF tick');
}

console.log('PASS: smoke-resilience verified all resilience modules and invariants');
