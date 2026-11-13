import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = path => fs.readFileSync(resolve(root, path), "utf8");
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(read("app/effects/manifest.js"), sandbox);
const manifest = sandbox.window.KEFE_EFFECTS;
assert.equal(manifest.length, 73, "Apple plus the 72 supplied effects");
assert.equal(new Set(manifest.map(item => item.key)).size, 73, "effect keys must be unique");
assert.equal(manifest[0].key, "apple");
const keys = Array.from(manifest).slice(1).map(item => item.key);

for (const page of ["editor.source.html", "editor.html"]) {
  const html = read(page);
  assert.ok(html.includes('meta name="kefe-lyric-effects" content="72"'), page + " must declare the 72-effect roster");
  assert.ok(html.includes("effects/lyric-combined-pack.js"), page + " must load the combined renderer");
  for (const retired of ["lyric-premium-kit.js", "lyric-signature-pack.js", "lyric-signature-four.js", "lyric-text-swap.js", "lyric-pull.js"]) {
    assert.ok(!html.includes(retired), page + " must not load " + retired);
  }
}
const editor = read("app/editor.js");
assert.ok(editor.includes("effectDefinitions.filter(([id])=>id!=='karaoke'&&id!=='bounce')"), "picker must be generated from the manifest");
assert.ok(editor.includes("addLyricEffectOption('karaoke','Karaoke')"), "Karaoke entry retained");
assert.ok(editor.includes("addLyricEffectOption('bounce','Bounce Karaoke')"), "Bounce entry retained");

function makeContext() {
  const counter = { paints: 0 };
  const gradient = { addColorStop() {} };
  return {
    canvas: { width: 1280, height: 720 }, font: "700 80px sans-serif",
    textAlign: "start", textBaseline: "alphabetic", fillStyle: "#fff", strokeStyle: "#fff",
    globalAlpha: 1, lineWidth: 1, shadowColor: "transparent", shadowBlur: 0,
    filter: "none", letterSpacing: "0px", globalCompositeOperation: "source-over",
    lineCap: "butt", lineJoin: "miter",
    save() {}, restore() {}, translate() {}, scale() {}, rotate() {}, transform() {},
    setTransform() {}, resetTransform() {}, beginPath() {}, closePath() {}, moveTo() {},
    lineTo() {}, arc() {}, arcTo() {}, ellipse() {}, bezierCurveTo() {}, quadraticCurveTo() {},
    rect() {}, roundRect() {}, clip() {},
    fill() { counter.paints++; }, stroke() { counter.paints++; }, fillRect() { counter.paints++; },
    strokeRect() {}, clearRect() {}, fillText() { counter.paints++; }, strokeText() { counter.paints++; },
    measureText(text) {
      const size = Number((/(\d+(?:\.\d+)?)px/.exec(String(this.font)) || [])[1] || 20);
      return { width: Array.from(String(text)).length * size * 0.52 };
    },
    createLinearGradient() { return gradient; }, createRadialGradient() { return gradient; },
    createConicGradient() { return gradient; }, createPattern() { return null; },
    drawImage() { counter.paints++; }, setLineDash() {}, getLineDash() { return []; },
    get paints() { return counter.paints; },
  };
}
const runtime = {
  console, Math, Number, String, Array, Object, Date, Map, Set, Intl,
  document: { fonts: { load: () => Promise.resolve() } },
  Event: class Event { constructor(type) { this.type = type; } },
  CustomEvent: class CustomEvent { constructor(type) { this.type = type; } },
  dispatchEvent() {},
};
runtime.window = runtime;
runtime.globalThis = runtime;
vm.createContext(runtime);
vm.runInContext(read("app/effects/core.js"), runtime, { filename: "core.js" });
vm.runInContext(read("app/effects/lyric-combined-pack.js"), runtime, { filename: "lyric-combined-pack.js" });
assert.equal(JSON.stringify(Object.keys(runtime.kefeEffects).sort()), JSON.stringify(keys.slice().sort()), "renderer registry must match the 72-effect roster");

const timed = [{
  text: "BURN IT DOWN", time: 1, endTime: 3,
  words: [{ text: "BURN", time: 1, endTime: 1.5 }, { text: "IT", time: 1.5, endTime: 2 }, { text: "DOWN", time: 2, endTime: 3 }],
}];
const untimed = [{ text: "NO WORD TIMINGS", time: 0, endTime: 3 }, { text: "SECOND LINE", time: 3, endTime: 5 }];
for (const key of keys) {
  for (const [width, height, lines, time] of [[1280, 720, timed, 1.7], [360, 640, timed, 2.2], [1280, 720, untimed, 3.4]]) {
    const ctx = makeContext();
    runtime.kefeEffects[key](ctx, width, height, { effect: key, fontSize: 84, kefeMotionFont: "Open Sans" }, lines, time);
    assert.ok(ctx.paints > 0, key + " must render timed and untimed lyrics on desktop and mobile");
  }
  const empty = makeContext();
  runtime.kefeEffects[key](empty, 1280, 720, { fontSize: 84 }, [], 1);
  assert.equal(empty.paints, 0, key + " must safely ignore empty lyrics");
}
vm.runInContext(read("app/effects/lyric-apple.js"), runtime, { filename: "lyric-apple.js" });
const apple = makeContext();
runtime.kefeEffects.apple(apple, 1280, 720, { effect: "apple", fontSize: 84 }, timed, 1.7, null);
assert.ok(apple.paints > 0, "Apple renderer remains functional");
vm.runInContext(read("app/effects/lyric-karaoke.js"), runtime, { filename: "lyric-karaoke.js" });
for (const key of ["karaoke", "bounce"]) {
  const ctx = makeContext();
  runtime.kefeEffects[key](ctx, 1280, 720, { effect: key, fontSize: 84 }, timed, 1.7);
  assert.ok(ctx.paints > 0, key + " renderer remains functional");
}
console.log("PASS: Apple + 72 supplied effects + Karaoke/Bounce; unique registry, both editor entry points, desktop/mobile, timed/untimed and empty-lyrics paths.");
