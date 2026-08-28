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
  createElement: () => ({
    className: '', id: '', textContent: '', dataset: {},
    addEventListener() {}, appendChild() {}, setAttribute() {},
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
    beginPath() {}, arc() {}, fill() {}, stroke() {}, closePath() {},
    fillText() {}, strokeText() {},
    fillRect() {}, strokeRect() {}, clearRect() {},
    drawImage() {}, setTransform() {}, clip() {}, rect() {},
    createRadialGradient() { return gradient; },
    createLinearGradient() { return gradient; },
    getImageData() { return { data: new Uint8ClampedArray(4) }; },
    putImageData() {},
    measureText(text) { return { width: String(text).length * 10 }; },
  };
  return ctx;
}

// ---- eval helpers ----
function load(file) {
  const src = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  (0, eval)(`(function(){${src}\n})()`); // execute in this scope so IIFEs see stubs
}

// ---- load order from index.html ----
const scripts = [
  'typography.js',
  'effects/core.js',
  'effects/brat.js',
  'effects/aurora.js',
  'effects/eternal-sunshine.js',
  'effects/typewriter.js',
  'effects/instagram-lyrics.js',
  'effects/story-fade.js',
];
for (const s of scripts) load(s);
// ---- verification ----
const failures = [];
const registered = Object.keys(windowStub.kefeEffects || {}).sort();
const expectKeys = ['brat', 'aurora', 'eternal', 'typewriter', 'instagram', 'fadeup'];
console.log('Registered kefeEffects:', registered.join(', '));
for (const key of expectKeys) {
  if (!windowStub.kefeEffects[key]) failures.push(`missing registration: ${key}`);
}

// typography contract integrity
const contracts = windowStub.KEFE_TYPE?.effects || {};
const fams = windowStub.KEFE_TYPE?.families || {};
for (const key of ['brat', 'aurora', 'eternal', 'typewriter', 'instagram', 'fadeup', 'apple']) {
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

// 1 effect = 1 font: every production effect must resolve to a distinct family,
// so no effect silently shares a face with another.
const famSet = new Set();
for (const key of ['apple', 'brat', 'eternal', 'aurora', 'typewriter', 'instagram', 'fadeup']) {
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