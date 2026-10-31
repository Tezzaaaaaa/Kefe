/* Static + runtime smoke for the 50-effect Signature LyricFX pack.
   Verifies the roster, renderer registration, typography contracts, page
   wiring and that every renderer paints the canvas at multiple timestamps. */
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(resolve(webRoot, file), "utf8");

const EXPECTED = [
  ["Kinetic Dynamics", ["sigkineticpunch", "sigelasticslam", "siggravitylanding", "sigmagnetrepulse", "sigwordcascade", "sigmarqueerail", "sigslotroll", "sigstompbeat", "sigrubberstretch"]],
  ["Glow Shaders", ["signeonatmosphere", "sigtubeignition", "sighalobloom", "sigemberrise", "sigultraviolet", "sigphosphor", "sigspotlight", "sigaurorawash", "sigcandleflicker"]],
  ["Cyber Networks", ["sigterminalglitch", "sigvhstracking", "sigdatacorrupt", "sigcathodescan", "sigcamcorder", "sighexrain", "sigsignalloss", "sigbitcrush"]],
  ["Rare Gem Treatments", ["sigiridescent", "siggoldfoil", "sigchromemetal", "sigprismsplit", "sigdiamondfacet", "sigrosequartz", "sigobsidian", "sigsodalite"]],
  ["Liquid & Organic", ["sigmetaball", "siginkbleed", "sigwaterripple", "sigmoltendrip", "sigmercurybead", "sigsilkwave", "sigpetalbloom", "sigvaporbloom"]],
  ["Dimensional Depth", ["sigchromeextrusion", "sigletterflip", "sigcardstack", "sigrackfocus", "sigkaleidoscope", "sigorbitring", "sigtypewriter", "sigcinemabars"]],
];
const keys = EXPECTED.flatMap(([, list]) => list);

/* ---- manifest ---------------------------------------------------- */
const sandbox = { window: {}, console, Math, Number, String, Array, Object, Map, Set, Intl };
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(read("app/effects/manifest.js"), sandbox, { filename: "manifest.js" });
const manifest = sandbox.window.KEFE_EFFECTS;
assert.ok(Array.isArray(manifest), "manifest must publish KEFE_EFFECTS");
assert.equal(manifest.length, 51, `roster must be Apple + 50 Signature effects, found ${manifest.length}`);
assert.equal(manifest[0].key, "apple", "Apple must stay first in the roster");
assert.equal(manifest.filter(item => item.key === "apple").length, 1, "Apple must be listed exactly once");
const manifestKeys = Array.from(manifest, item => item.key);
assert.equal(new Set(manifestKeys).size, manifestKeys.length, "effect keys must be unique");
const labels = Array.from(manifest, item => item.label);
assert.equal(new Set(labels).size, labels.length, "effect labels must be unique");
for (const [category, list] of EXPECTED) {
  const entries = Array.from(manifest).filter(item => item.category === category);
  assert.deepEqual(Array.from(entries, item => item.key), list, `${category} roster changed`);
  for (const entry of entries) {
    assert.ok(entry.label && entry.description, `${entry.key} needs a label and description`);
    assert.equal(entry.key.startsWith("sig"), true, `${entry.key} must use the sig prefix`);
  }
}
for (const key of keys) assert.ok(manifestKeys.includes(key), `${key} is missing from the manifest`);
const legacy = Array.from(manifestKeys).filter(key => key !== "apple" && !key.startsWith("sig"));
assert.deepEqual(legacy, [], `legacy effects must be removed from the roster: ${legacy.join(", ")}`);

/* ---- page wiring ------------------------------------------------- */
const editor = read("editor.source.html");
assert.match(editor, /<meta name="kefe-lyric-signature" content="50">/, "the editor must declare the Signature pack marker");
assert.match(editor, /lyric-apple\.js/, "the Apple renderer must stay loaded");
assert.match(editor, /lyric-signature-pack\.js/, "the Signature pack must be loaded by the editor");
assert.match(editor, /effects\/manifest\.js/, "the manifest must be loaded");
for (const file of ["lyric-aurora", "lyric-pulse", "lyric-typewriter", "lyric-glitch", "lyric-inspiration-pack"]) {
  assert.doesNotMatch(editor, new RegExp(`effects/${file}\\.js`), `the retired ${file} renderer must not be loaded`);
}

/* ---- editor picker + preview integration -------------------------- */
const editorSource = read("app/editor.js");
assert.match(editorSource, /effectDefinitions\.filter\(\(\[id\]\)=>id!=='karaoke'&&id!=='bounce'\)\.forEach\(\(\[id,label\]\)=>addLyricEffectOption\(id,label\)\)/, "the picker must be generated from the complete effect manifest");
assert.doesNotMatch(editorSource, /window\.kefeEffects\[state\.effect\]\s*\|\|\s*window\.kefeEffects\.apple/, "a missing renderer must not silently substitute Apple");
assert.match(editorSource, /if\(state\.effect==='apple'\)\{\s*const u=Math\.min\(W,H\)/, "the pinned-header mask must be scoped to Apple only");

/* ---- typography contracts ---------------------------------------- */
const typography = read("app/ui/typography.js");
for (const key of keys) {
  assert.match(typography, new RegExp(`\\n\\s+${key}: \\{ family: families\\.`), `${key} needs a typography contract`);
}

/* ---- renderer registration + execution --------------------------- */
function makeContext() {
  const counter = { fills: 0 };
  const gradient = { addColorStop() {} };
  const ctx = {
    canvas: { width: 1280, height: 720 },
    font: "700 80px sans-serif", textAlign: "start", textBaseline: "alphabetic",
    fillStyle: "#fff", strokeStyle: "#fff", globalAlpha: 1, lineWidth: 1,
    shadowColor: "transparent", shadowBlur: 0, filter: "none", letterSpacing: "0px",
    globalCompositeOperation: "source-over", lineCap: "butt", lineJoin: "miter",
    save() {}, restore() {}, translate() {}, scale() {}, rotate() {}, transform() {}, setTransform() {}, resetTransform() {},
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {}, arcTo() {}, ellipse() {},
    bezierCurveTo() {}, quadraticCurveTo() {}, rect() {}, roundRect() {}, clip() {},
    fill() { counter.fills += 1; }, stroke() { counter.fills += 1; }, fillRect() { counter.fills += 1; }, strokeRect() {}, clearRect() {},
    fillText() { counter.fills += 1; }, strokeText() { counter.fills += 1; },
    measureText(text) {
      const size = Number((/(\d+(?:\.\d+)?)px/.exec(String(this.font)) || [])[1] || 20);
      return { width: String(text).length * size * .52 };
    },
    createLinearGradient() { return gradient; },
    createRadialGradient() { return gradient; },
    createConicGradient() { return gradient; },
    createPattern() { return null; },
    drawImage() {}, setLineDash() {}, getLineDash() { return []; },
    get fills() { return counter.fills; },
    resetFills() { counter.fills = 0; },
  };
  return ctx;
}

const runtime = { console, Math, Number, String, Array, Object, Date, Map, Set, Intl };
runtime.window = runtime;
runtime.globalThis = runtime;
runtime.document = {
  readyState: "complete", addEventListener() {}, querySelector() { return null; },
  querySelectorAll() { return []; }, createElement() { return { style: {}, setAttribute() {}, appendChild() {} }; },
  getElementById() { return null; },
};
vm.createContext(runtime);
vm.runInContext(read("app/effects/core.js"), runtime, { filename: "core.js" });
vm.runInContext(read("app/effects/lyric-signature-pack.js"), runtime, { filename: "lyric-signature-pack.js" });
const registered = Object.keys(runtime.kefeEffects || {}).filter(key => key.startsWith("sig"));
assert.deepEqual(registered.sort(), [...keys].sort(), "renderer registrations must match the roster");
assert.equal(typeof runtime.kefeEffects.apple, "undefined", "the Apple renderer is owned by lyric-apple.js");

const words = [
  { text: "BURN", time: 1, endTime: 1.5 },
  { text: "IT", time: 1.5, endTime: 1.8 },
  { text: "DOWN", time: 1.8, endTime: 2.6 },
];
const lines = [{ text: "BURN IT DOWN", time: 1, endTime: 2.9, words }];
runtime.dispatchEvent = () => {};
 runtime.Event = class Event {};
 vm.runInContext(read("app/effects/lyric-apple.js"), runtime, { filename: "lyric-apple.js" });
 assert.equal(typeof runtime.kefeEffects.apple, "function", "Apple renderer must register independently");
 const appleContext = makeContext();
 runtime.kefeEffects.apple(appleContext, 1280, 720, { effect: "apple", fontSize: 84 }, lines, 1.6, null);
 assert.ok(appleContext.fills > 0, "Apple renderer must paint the active line in the preview canvas");
const plainLines = [{ text: "NO WORD TIMINGS", time: 0, endTime: 3 }, { text: "SECOND LINE", time: 3, endTime: 5 }];
for (const key of keys) {
  const ctx = makeContext();
  const style = { effect: key, fontSize: 84, kefeMotionFont: "Open Sans" };
  for (const time of [-.4, 0, .6, 1.1, 1.6, 2.2, 2.8, 3.4, 4.8, 6.2]) {
    ctx.resetFills();
    runtime.kefeEffects[key](ctx, 1280, 720, style, lines, time);
    if (time >= 1 && time <= 2.9) assert.ok(ctx.fills > 0, `${key} must paint the active line at t=${time}`);
    runtime.kefeEffects[key](ctx, 360, 640, { ...style, fontSize: 48 }, lines, time);
    runtime.kefeEffects[key](ctx, 1280, 720, style, plainLines, time);
    runtime.kefeEffects[key](ctx, 1280, 720, style, [], time);
  }
}

console.log(`Signature LyricFX verified: Apple + ${keys.length} effects, unique keys/labels, contracts, wiring and canvas output.`);
