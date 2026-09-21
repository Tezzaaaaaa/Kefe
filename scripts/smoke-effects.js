/* Headless integrity test for KEFE lyric effects.
 * Simulates the minimal browser surface each effect touches, loads the scripts
 * in the exact order index.html defines them, and invokes every registered
 * renderer with a mock 2D context to prove nothing throws at runtime. */
'use strict';

const fs = require('fs');
const path = require('path');

// ---- minimal DOM/document/window stubs ----
const listeners = {};
const events = {};
const document = {
  readyState: 'complete',
  fonts: {
    ready: Promise.resolve(true),
    load: async () => true,
  },
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  head: { appendChild() {} },
  createElement: () => ({
    className: '', id: '', textContent: '', dataset: {},
    width: 0, height: 0,
    addEventListener() {}, appendChild() {}, setAttribute() {},
    getContext() { return global.__kefeMakeCtx ? global.__kefeMakeCtx() : null; },
    }),
  addEventListener(name, fn) { (listeners[name] ||= []).push(fn); },
  dispatchEvent(e) { (listeners[e.type] || []).forEach(fn => fn(e)); return true; },
};
global.document = document;

const windowStub = global.window = {
  addEventListener(name, fn) { (listeners[name] ||= []).push(fn); },
  dispatchEvent(e) { (listeners[e.type] || []).forEach(fn => fn(e)); return true; },
  CustomEvent: function (type) { this.type = type; },
  location: { href: 'http://localhost/' },
  localStorage: { getItem: () => null, setItem() {} },
};
windowStub.window = windowStub;
global.location = windowStub.location;
global.CustomEvent = windowStub.CustomEvent;

// ---- mock 2D context that records calls and never throws ----
function makeCtx() {
  const gradient = { addColorStop() {} };
  const ctx = {
    font: '', fillStyle: '', strokeStyle: '', globalAlpha: 1,
    shadowBlur: 0, shadowColor: '', textAlign: 'left', textBaseline: 'alphabetic',
    globalCompositeOperation: 'source-over', filter: 'none', lineWidth: 1,
    save() {}, restore() {}, translate() {}, scale() {}, rotate() {},
    moveTo() {}, lineTo() {}, bezierCurveTo() {}, quadraticCurveTo() {},
    transform() {}, resetTransform() {}, setLineDash() {},
    createPattern() { return { setTransform() {} }; },
    beginPath() {}, arc() {}, fill() {}, stroke() {}, closePath() {},
    fillText() {}, strokeText() {},
    fillRect() {}, strokeRect() {}, clearRect() {},
    drawImage() {}, clip() {}, rect() {},
    createRadialGradient() { return gradient; },
    createLinearGradient() { return gradient; },
    getImageData(w, h) { return { data: new Uint8ClampedArray(4), width: w || 1, height: h || 1 }; },
    createImageData(w, h) { return { data: new Uint8ClampedArray(Math.max(4, (w||1)*(h||1)*4)), width: w || 1, height: h || 1 }; },
    putImageData() {},
    measureText(text) { return { width: String(text).length * 10 }; },
  };
  return ctx;
}

global.__kefeMakeCtx = makeCtx;

// ---- eval helpers ----
function load(file) {
  const src = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  (0, eval)(`(function(){${src}\n})()`); // execute in this scope so IIFEs see stubs
}

// ---- load order from index.html ----
const scripts = [
  'app/ui/typography.js',
  'app/effects/core.js',
  'app/effects/brat.js',
  'app/effects/aurora.js',
  'app/effects/eternal-sunshine.js',
  'app/effects/typewriter.js',
  'app/effects/instagram-lyrics.js',
  'app/effects/story-fade.js',
  'app/effects/apple-lyrics.js',
  'app/effects/lyric-barbie.js',
  'app/effects/lyric-elasticpop.js',
  'app/effects/lyric-flipcards.js',
  'app/effects/lyric-karaoke.js',
  'app/effects/lyric-trailer.js',
  'app/effects/lyric-rain.js',
  'app/effects/lyric-fancy.js',
  'app/effects/lyric-glitch.js',
  'app/effects/lyric-analogtv.js',
  'app/effects/lyric-splitflap.js',
  'app/effects/lyric-chromatica.js'
];
for (const s of scripts) load(s);
// ---- verification ----
const failures = [];
const registered = Object.keys(windowStub.kefeEffects || {}).sort();
const expectKeys = ['brat', 'aurora', 'eternal', 'typewriter', 'instagram', 'fadeup',
  'barbie',
  'elasticpop',
  'flipcards',
  'karaoke',
  'trailer',
  'rain',
  'fancy',
  'glitch',
  'analogtv',
  'splitflap',
  'chromatica'
];
console.log('Registered kefeEffects:', registered.join(', '));
if (!windowStub.kefeAppleLyricsEffect || typeof windowStub.kefeAppleLyricsEffect.render !== 'function') {
  failures.push('missing Apple lyrics renderer registration');
}
for (const key of expectKeys) {
  if (!windowStub.kefeEffects[key]) failures.push(`missing registration: ${key}`);
}

// typography contract integrity
const contracts = windowStub.KEFE_TYPE?.effects || {};
const fams = windowStub.KEFE_TYPE?.families || {};
for (const key of ['brat', 'aurora', 'eternal', 'typewriter', 'instagram', 'fadeup', 'apple', 'barbie', 'elasticpop', 'flipcards', 'karaoke', 'trailer', 'rain', 'fancy', 'glitch', 'analogtv', 'splitflap', 'chromatica']) {
  const c = contracts[key];
  if (!c) { failures.push(`missing typography contract: ${key}`); continue; }
  if (!fams[key]) failures.push(`missing declared family for ${key}`);
  if (!['min', 'max', 'weight', 'family'].every(k => c[k] !== undefined)) {
    failures.push(`incomplete contract ${key}: ${JSON.stringify(c)}`);
  }
}

// utility surface
const U = windowStub.kefeEffectUtils;
for (const m of ['clamp','smooth','smoother','activeLine','lineProgress','wordsFor','wordProgress','contract','setFont','setContractFont','fitText','fitContractText','drawTrackedText','fillTrackedText','fitTextBinary']) {
  if (typeof U?.[m] !== 'function') failures.push(`missing util: ${m}`);
}

// Apple lyrics is a standalone renderer rather than a kefeEffects entry.
try {
  const apple = windowStub.kefeAppleLyricsEffect;
  const appleLines = apple.parse('[00:00.00]First line\n[00:02.00]Second line');
  apple.render(makeCtx(), { width: 1080, height: 1920 }, appleLines, 500, apple.defaultConfig);
} catch (err) {
  failures.push('Apple lyrics renderer threw: ' + err.message);
}

// 1 effect = 1 font: every production effect must resolve to a distinct family,
// so no effect silently shares a face with another.
const famSet = new Set();
for (const key of ['apple', 'brat', 'eternal', 'aurora', 'typewriter', 'instagram', 'fadeup', 'barbie', 'elasticpop', 'flipcards', 'karaoke', 'trailer', 'rain', 'fancy', 'glitch', 'analogtv', 'splitflap', 'chromatica']) {
  const c = contracts[key];
  if (!c || !c.family) continue;
  if (famSet.has(c.family)) failures.push(`font collision: "${c.family}" is shared by ${key} with another effect`);
  famSet.add(c.family);
}
console.log('Distinct effect font assignments:', [...famSet].join(', '));

// exercise each renderer with mock lines
const lines = [
  { time: 0.0, text: 'i got it bad' },
  { time: 3.0, text: 'now you want it' },
  { time: 6.0, text: 'say my name' },
];
const style = {
  fontSize: 76, textColor: '#FFF', accentColor: '#FFF', bratTextColor: '#FFF',
  bratSideMargin: 4.5, bratTopMargin: 4.5, bratTypingSpeed: 1,
  eternalInkColor: '#FFF', eternalPenWidth: 21, eternalWriteSpan: 0.9,
  eternalGlow: 3, eternalPresence: 0.65,
  auroraSpeed: 1.2, auroraIntensity: 0.7, auroraSaturation: 1.0,
};
for (const key of expectKeys) {
  const fn = windowStub.kefeEffects[key];
  try {
    for (const t of [0.1, 1.5, 4, 7.5, 99]) {
      fn(makeCtx(), 1080, 1920, style, lines, t);
    }
  } catch (err) {
    failures.push(`renderer ${key} threw: ${err.message}`);
  }
}

// core util sanity
try {
  const out = U.activeLine(lines, 3.5);
  if (out?.index !== 1) failures.push(`activeLine misbehaved at t=3.5 (idx=${out?.index})`);
  const words = U.wordsFor(lines[1], lines[2]);
  if (!Array.isArray(words) || !words.length) failures.push('wordsFor returned empty');
} catch (err) { failures.push(`util sanity threw: ${err.message}`); }

// fonts readiness gate resolves through stubs
windowStub.kefeTypographyReady?.then?.((ok) => {
  console.log('kefeTypographyReady ->', ok);
  if (!ok) failures.push('typography ready gate resolved false');
  finish();
}).catch((e) => { failures.push('typography ready rejected: ' + e.message); finish(); });

// ensure finish also runs if promise never settles
const timeout = setTimeout(() => { console.log('(typography ready did not settle within timeout)'); finish(); }, 2000);

let done = false;
function finish() {
  if (done) return; done = true; clearTimeout(timeout);
  if (failures.length) {
    console.error('\nFAILURES:\n - ' + failures.join('\n - '));
    process.exit(1);
  }
  console.log('\nALL EFFECT MODULES STRUCTURALLY INTACT — no failures');
  process.exit(0);
}