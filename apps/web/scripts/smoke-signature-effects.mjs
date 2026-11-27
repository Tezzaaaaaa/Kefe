/* Static + runtime smoke for native lyric effects and the 97 adapted typography treatments. */
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
  ["Flagship", ["sigluminaire", "sigpresscycle"]],
];
const keys = EXPECTED.flatMap(([, list]) => list);
const addedSignatureKeys = ["sigfrost", "sigvoid", "sigscript", "sigbrat"];
const TYPOGRAPHY = [["Entrance","ty-fade-in"],["Entrance","ty-slide-up"],["Entrance","ty-slide-down"],["Entrance","ty-slide-left"],["Entrance","ty-slide-right"],["Entrance","ty-scale-in"],["Entrance","ty-blur-in"],["Entrance","ty-flip-x"],["Entrance","ty-flip-y"],["Entrance","ty-rotate-in"],["Entrance","ty-bounce-in"],["Entrance","ty-elastic-in"],["Entrance","ty-zoom-in"],["Entrance","ty-zoom-out"],["Entrance","ty-skew-in"],["Entrance","ty-wipe-in"],["Entrance","ty-mask-in"],["Entrance","ty-reveal-up"],["Entrance","ty-drop-in"],["Entrance","ty-float-in"],["Loops & Beats","ty-pulse"],["Loops & Beats","ty-shake"],["Loops & Beats","ty-wobble"],["Loops & Beats","ty-jello"],["Loops & Beats","ty-heartbeat"],["Loops & Beats","ty-bounce-loop"],["Loops & Beats","ty-flash"],["Loops & Beats","ty-rubber-band"],["Loops & Beats","ty-swing"],["Loops & Beats","ty-tada"],["Loops & Beats","ty-flip-loop"],["Loops & Beats","ty-spin-loop"],["Kinetic Text","ty-morph-text"],["Kinetic Text","ty-letter-fade"],["Kinetic Text","ty-number-slide"],["Kinetic Text","ty-slide-cycle"],["Kinetic Text","ty-bounce-cycle"],["Kinetic Text","ty-rotate-cycle"],["Kinetic Text","ty-zoom-cycle"],["Kinetic Text","ty-wave"],["Decode & Data","ty-scramble"],["Decode & Data","ty-typewriter"],["Decode & Data","ty-binary"],["Decode & Data","ty-decrypt"],["Decode & Data","ty-cipher"],["Decode & Data","ty-matrix-rain"],["Decode & Data","ty-glitch-decode"],["Decode & Data","ty-noise"],["Decode & Data","ty-signal"],["Decode & Data","ty-resolve"],["Decode & Data","ty-count-up"],["Decode & Data","ty-percentage"],["Decode & Data","ty-money"],["Decode & Data","ty-year"],["Decode & Data","ty-leading-zero"],["Decode & Data","ty-decimal"],["Decode & Data","ty-progress"],["Decode & Data","ty-hex"],["Decode & Data","ty-answer"],["Decode & Data","ty-phone"],["Surface & Finish","ty-gradient-text"],["Surface & Finish","ty-neon"],["Surface & Finish","ty-glitch-text"],["Surface & Finish","ty-chrome"],["Surface & Finish","ty-emboss"],["Surface & Finish","ty-pressed"],["Surface & Finish","ty-paper-cut"],["Surface & Finish","ty-drop-cap"],["Surface & Finish","ty-rainbow"],["Surface & Finish","ty-glow"],["Surface & Finish","ty-neon-green"],["Typography Styles","ty-monospace"],["Typography Styles","ty-wide"],["Typography Styles","ty-italic"],["Typography Styles","ty-underline"],["Typography Styles","ty-strikethrough"],["Typography Styles","ty-black-weight"],["Typography Styles","ty-case-cycle"],["Typography Styles","ty-lowercase-cycle"],["Typography Styles","ty-capitalize-cycle"],["Beat-Reactive Controls","ty-magnet"],["Beat-Reactive Controls","ty-pressure"],["Beat-Reactive Controls","ty-hover-glow"],["Beat-Reactive Controls","ty-scale-hover"],["Beat-Reactive Controls","ty-expand"],["Beat-Reactive Controls","ty-color-shift"],["Beat-Reactive Controls","ty-italic-hover"],["Beat-Reactive Controls","ty-underline-hover"],["Beat-Reactive Controls","ty-tilt"],["Display & Texture","ty-fade"],["Display & Texture","ty-outline"],["Display & Texture","ty-lcd"],["Display & Texture","ty-split-flap"],["Display & Texture","ty-liquid-fill"],["Display & Texture","ty-fire"],["Display & Texture","ty-ice"],["Display & Texture","ty-shadow-dance"]];
const typographyKeys = TYPOGRAPHY.map(([,key])=>key);
const MATRIX = [["kinetic","lf-karaoke-sweep"],["minimal","lf-line-focus"],["minimal","lf-smooth-glide"],["glow","lf-blur-unveil"],["glow","lf-neon-glow"],["kinetic","lf-kinetic-pop"],["cyber","lf-typewriter"],["glow","lf-sustain-pulse"],["cyber","lf-3d-tilt"],["minimal","lf-genre-theme"],["cyber","lf-chromatic-split"],["kinetic","lf-waveform-stretch"],["glow","lf-liquid-ink"],["cyber","lf-laser-sweep"],["cyber","lf-tunnel-zoom"],["glow","lf-particle-dissolve"],["cyber","lf-strobe-shutter"],["minimal","lf-zero-gravity"],["cyber","lf-cyber-hud"],["minimal","lf-harmony-split"],["glow","lf-holo-flare"],["minimal","lf-vinyl-groove"],["cyber","lf-matrix-stream"],["kinetic","lf-lightning-arc"],["cyber","lf-neon-marquee"],["glow","lf-crystal-glass"],["cyber","lf-thermal-heat"],["kinetic","lf-seismic-tremor"],["glow","lf-velvet-shadow"],["glow","lf-supernova-flare"],["rare glow","lf-anamorphic-streak"],["rare kinetic","lf-spatial-doppler"],["rare cyber","lf-quantum-shift"],["rare glow","lf-biolumen-ripple"],["rare cyber","lf-crt-phosphor"],["rare glow","lf-aurora-wave"],["rare glow","lf-prism-reflection"],["rare kinetic","lf-solar-plasma"],["rare cyber","lf-gravity-well"],["rare glow","lf-volumetric-fog"],["rare kinetic","lf-ferrofluid-pulse"],["rare cyber","lf-vhs-tracking"],["rare cyber","lf-vaporwave-grid"],["rare cyber","lf-cyber-weave"],["rare glow","lf-frost-bloom"],["rare glow","lf-golden-bokeh"],["rare kinetic","lf-kinetic-wave"],["rare glow","lf-nebula-burn"],["rare glow","lf-acid-liquid"],["rare kinetic","lf-cyber-equalizer"]];
const matrixKeys = MATRIX.map(([,key])=>key);

/* ---- manifest ---------------------------------------------------- */
const sandbox = { window: {}, console, Math, Number, String, Array, Object, Map, Set, Intl };
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(read("app/effects/manifest.js"), sandbox, { filename: "manifest.js" });
const manifest = sandbox.window.KEFE_EFFECTS;
assert.ok(Array.isArray(manifest), "manifest must publish KEFE_EFFECTS");
assert.equal(manifest.length, 207, `roster must include Dot Matrix alongside Apple + Text Swap + Lyric Pull + 56 Signature + 97 typography + 50 LyricFX Matrix effects, found ${manifest.length}`);
assert.equal(manifest[0].key, "apple", "Apple must stay first in the roster");
assert.ok(manifest.some(item => item.key === "dotmatrix"), "Dot Matrix must be in the effect roster");
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
for (const key of [...keys, ...addedSignatureKeys, ...typographyKeys, ...matrixKeys]) assert.ok(manifestKeys.includes(key), `${key} is missing from the manifest`);
for (const [category,key] of MATRIX) {
 const entry=manifest.find(item=>item.key===key);
 assert.ok(entry, key+" must be listed");
 const label=category.split(" ").map(x=>x.charAt(0).toUpperCase()+x.slice(1)).join(" ");
 assert.equal(entry.category,"LyricFX — "+label,key+" must retain its source category");
 assert.ok(entry.label&&entry.description,key+" needs a label and description");
}
for (const [category,key] of TYPOGRAPHY) {
 const entry=manifest.find(item=>item.key===key);
 assert.ok(entry, `${key} must be listed`);
 assert.equal(entry.category, `Typography — ${category}`, `${key} must retain its reference category`);
 assert.ok(entry.label&&entry.description, `${key} needs a label and description`);
}
const legacy = Array.from(manifestKeys).filter(key => key !== "apple" && key !== "textswap" && key !== "lyricpull" && !key.startsWith("sig") && !key.startsWith("ty-") && !key.startsWith("lf-"));
assert.deepEqual(legacy, [], `legacy effects must be removed from the roster: ${legacy.join(", ")}`);

/* ---- page wiring ------------------------------------------------- */
const editor = read("editor.source.html");
assert.match(editor, /<meta name="kefe-lyric-signature" content="56">/, "the editor must declare the Signature pack marker");
assert.match(editor, /<meta name="kefe-typography-effects" content="97">/, "the editor must declare the typography pack marker");
assert.match(editor, /<meta name="kefe-lyricfx-effects" content="50">/, "the editor must declare the LyricFX pack marker");
assert.match(editor, /lyric-apple\.js/, "the Apple renderer must stay loaded");
assert.match(editor, /lyric-dot-matrix\.js/, "Dot Matrix renderer must be loaded by the editor");
assert.match(editor, /lyric-karaoke\.js/, "the Karaoke and Bounce renderers must stay loaded");
assert.match(editor, /lyric-signature-pack\.js/, "the Signature pack must be loaded by the editor");
assert.match(editor, /lyric-signature-four\.js/, "the four new Signature treatments must be loaded by the editor");
assert.match(editor, /lyric-typography-pack\.js/, "the typography renderer must be loaded by the editor");
assert.match(editor, /lyricfx-matrix-pack\.js/, "the LyricFX Matrix renderer must be loaded by the editor");
assert.match(editor, /lyric-typography-pack\.js\?v=typography-pack-20261115-2/, "the corrected typography renderer must bypass stale browser cache");
assert.match(editor, /lyricfx-matrix-pack\.js\?v=lyricfx-matrix-20261115-2/, "the corrected Matrix renderer must bypass stale browser cache");
assert.match(editor, /lyric-text-swap\.js/, "Text Swap renderer must be loaded by the editor");
assert.match(editor, /lyric-premium-kit\.js[^]*lyric-signature-pack\.js/, "the premium kit must load before the Signature pack");
assert.match(editor, /effects\/manifest\.js/, "the manifest must be loaded");
for (const file of ["lyric-aurora", "lyric-pulse", "lyric-typewriter", "lyric-glitch", "lyric-inspiration-pack"]) {
  assert.doesNotMatch(editor, new RegExp(`effects/${file}\\.js`), `the retired ${file} renderer must not be loaded`);
}

/* ---- editor picker + preview integration -------------------------- */
const editorSource = read("app/editor.js");
assert.match(editorSource, /effectDefinitions\.filter\(\(\[id\]\)=>id!=='karaoke'&&id!=='bounce'\)\.forEach\(\(\[id,label\]\)=>addLyricEffectOption\(id,label\)\)/, "the picker must be generated from the complete effect manifest");
assert.ok(editorSource.includes("EFFECT_PREVIEW_PHRASE='The quick brown fox jumps over the lazy dog.'"), "effect cards must preview the pangram sample sentence");
assert.match(editorSource, /function startEffectPreview\(entry\)/, "effect previews must animate on hover and keyboard focus");
assert.match(editorSource, /button\.addEventListener\('pointerenter'/, "effect preview animation must start on pointer hover");
assert.match(editorSource, /button\.addEventListener\('pointerleave'/, "effect preview animation must stop when the pointer leaves");
assert.match(editorSource, /paintEffectPreview\(entry,time\)/, "previews must call the selected effect renderer at changing timestamps");
const structure = read("app/ui/structure.js");
assert.ok(structure.includes("The quick brown fox jumps over the lazy dog."), "the lyric input must use the all-alphabet pangram placeholder");
const sectionLayout = read("app/ui/section-layout.css");
assert.match(sectionLayout, /grid-auto-rows: 112px !important;/, "lyric effect cards must retain consistent row sizing across breakpoints");
assert.doesNotMatch(editorSource, /window\.kefeEffects\[state\.effect\]\s*\|\|\s*window\.kefeEffects\.apple/, "a missing renderer must not silently substitute Apple");
assert.match(editorSource, /if\(state\.effect==='apple'\)\{[^}]*?destination-in/, "the safe-edge fade mask must be scoped to Apple only");

/* ---- typography contracts ---------------------------------------- */
const typography = read("app/ui/typography.js");
assert.match(typography, /\n\s+textswap:\s*\{ family: families\./, "Text Swap needs a typography contract");
assert.match(typography, /\n\s+lyricpull:\s*\{ family: families\./, "Lyric Pull needs a typography contract");
for (const key of [...keys, ...addedSignatureKeys]) {
  assert.match(typography, new RegExp(`\\n\\s+${key}:\\s+\\{ family: families\\.`), `${key} needs a typography contract`);
}
for (const key of matrixKeys) assert.ok(typography.includes("'"+key+"': { family: families.ui"), key+" needs a typography contract");
for (const key of typographyKeys) assert.ok(typography.includes(`'${key}': { family: families.ui`), `${key} needs a typography contract`);

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
    drawImage() { counter.fills += 1; }, setLineDash() {}, getLineDash() { return []; },
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
  querySelectorAll() { return []; },
  /* canvases get a working mock context so the kit's bloom / mask / reveal paths run too */
  createElement(tag) {
    if (tag === "canvas") { const canvas = { width: 1, height: 1, style: {} }; canvas.getContext = () => Object.assign(makeContext(), { canvas }); return canvas; }
    return { style: {}, setAttribute() {}, appendChild() {} };
  },
  getElementById() { return null; },
};
vm.createContext(runtime);
vm.runInContext(read("app/effects/core.js"), runtime, { filename: "core.js" });
vm.runInContext(read("app/effects/lyric-premium-kit.js"), runtime, { filename: "lyric-premium-kit.js" });
assert.equal(typeof runtime.kefeFx?.bloom, "function", "the premium kit must publish window.kefeFx");
vm.runInContext(read("app/effects/lyric-signature-pack.js"), runtime, { filename: "lyric-signature-pack.js" });
vm.runInContext(read("app/effects/lyric-signature-four.js"), runtime, { filename: "lyric-signature-four.js" });
vm.runInContext(read("app/effects/lyric-typography-pack.js"), runtime, { filename: "lyric-typography-pack.js" });
for (const key of typographyKeys) assert.equal(typeof runtime.kefeEffects[key], "function", `${key} renderer must register`);
vm.runInContext(read("app/effects/lyricfx-matrix-pack.js"), runtime, { filename: "lyricfx-matrix-pack.js" });
for (const key of matrixKeys) assert.equal(typeof runtime.kefeEffects[key], "function", `${key} renderer must register`);
const typographyRendererSource = read("app/effects/lyric-typography-pack.js");
assert.doesNotMatch(typographyRendererSource, /v\\s*%\\s*(?:5|6|8|9|10)/, "typography effects must not cycle through shared modulo variants");
for (const key of typographyKeys) assert.ok(typographyRendererSource.includes("case '"+key+"'"), key+" must have its own named rendering rule");
const matrixRendererSource = read("app/effects/lyricfx-matrix-pack.js");
for (const key of matrixKeys) assert.ok(matrixRendererSource.includes("case '"+key+"'"), key+" must have its own named rendering rule");
for (const key of addedSignatureKeys) assert.equal(typeof runtime.kefeEffects[key], "function", `${key} renderer must register`);
vm.runInContext(read("app/effects/lyric-text-swap.js"), runtime, { filename: "lyric-text-swap.js" });
assert.equal(typeof runtime.kefeEffects.textswap, "function", "Text Swap renderer must register");
vm.runInContext(read("app/effects/lyric-pull.js"), runtime, { filename: "lyric-pull.js" });
assert.equal(typeof runtime.kefeEffects.lyricpull, "function", "Lyric Pull renderer must register");
const words = [
  { text: "BURN", time: 1, endTime: 1.5 },
  { text: "IT", time: 1.5, endTime: 1.8 },
  { text: "DOWN", time: 1.8, endTime: 2.6 },
];
const lines = [{ text: "BURN IT DOWN", time: 1, endTime: 2.9, words }];
const pullContext = makeContext();
runtime.kefeEffects.lyricpull(pullContext, 1280, 720, { effect: "lyricpull", fontSize: 84 }, lines, 1.6);
assert.ok(pullContext.fills > 0, "Lyric Pull must paint the active word on the canvas");
const pullMobile = makeContext();
runtime.kefeEffects.lyricpull(pullMobile, 360, 640, { effect: "lyricpull", fontSize: 48 }, lines, 2.2);
assert.ok(pullMobile.fills > 0, "Lyric Pull must paint on mobile canvas");
const registered = Object.keys(runtime.kefeEffects || {}).filter(key => key.startsWith("sig"));
assert.deepEqual(registered.sort(), [...keys, ...addedSignatureKeys].sort(), "Signature renderer registrations must match the roster");
const registeredTypography = Object.keys(runtime.kefeEffects || {}).filter(key => key.startsWith("ty-"));
assert.deepEqual(registeredTypography.sort(), [...typographyKeys].sort(), "typography renderer registrations must match the 97-treatment roster");
const registeredMatrix = Object.keys(runtime.kefeEffects || {}).filter(key => key.startsWith("lf-"));
assert.deepEqual(registeredMatrix.sort(), [...matrixKeys].sort(), "LyricFX renderer registrations must match the 50-treatment roster");
assert.equal(typeof runtime.kefeEffects.apple, "undefined", "the Apple renderer is owned by lyric-apple.js");

runtime.dispatchEvent = () => {};
 runtime.Event = class Event {};
 vm.runInContext(read("app/effects/lyric-apple.js"), runtime, { filename: "lyric-apple.js" });
 assert.equal(typeof runtime.kefeEffects.apple, "function", "Apple renderer must register independently");
 const appleContext = makeContext();
 runtime.kefeEffects.apple(appleContext, 1280, 720, { effect: "apple", fontSize: 84 }, lines, 1.6, null);
 assert.ok(appleContext.fills > 0, "Apple renderer must paint the active line in the preview canvas");
/* Karaoke and Bounce are picker entries outside the Signature manifest; make sure their
   renderer stays loaded and paints, so the two buttons never regress to a blank preview. */
vm.runInContext(read("app/effects/lyric-karaoke.js"), runtime, { filename: "lyric-karaoke.js" });
for (const key of ["karaoke", "bounce"]) {
  assert.equal(typeof runtime.kefeEffects[key], "function", `${key} renderer must register from lyric-karaoke.js`);
  const ctx = makeContext();
  runtime.kefeEffects[key](ctx, 1280, 720, { effect: key, fontSize: 84 }, lines, 1.6);
  assert.ok(ctx.fills > 0, `${key} renderer must paint the active line`);
}

const plainLines = [{ text: "NO WORD TIMINGS", time: 0, endTime: 3 }, { text: "SECOND LINE", time: 3, endTime: 5 }];
for (const preset of ["fly-through", "fade-through", "crossfade", "shared-axis-y", "shared-axis-z", "cut"]) {
  runtime.kefeTextSwapPreset = preset;
  const ctx = makeContext();
  runtime.kefeEffects.textswap(ctx, 1280, 720, { effect: "textswap", fontSize: 84 }, plainLines, 3.18);
  assert.ok(ctx.fills > 0, `Text Swap ${preset} must paint during a line transition`);
  ctx.resetFills();
  runtime.kefeEffects.textswap(ctx, 360, 640, { effect: "textswap", fontSize: 48 }, plainLines, 4.2);
  assert.ok(ctx.fills > 0, `Text Swap ${preset} must paint after a transition on mobile`);
}
for (const key of [...keys, ...addedSignatureKeys]) {
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

for (const key of typographyKeys) {
 const ctx=makeContext(),style={effect:key,fontSize:84,kefeMotionFont:"Open Sans",textColor:"#fff"};
 for(const t of [1.08,1.6,2.2]){
  ctx.resetFills();runtime.kefeEffects[key](ctx,1280,720,style,lines,t);assert.ok(ctx.fills>0, `${key} must paint desktop canvas at t=${t}`);
  ctx.resetFills();runtime.kefeEffects[key](ctx,360,640,{...style,fontSize:48},lines,t);assert.ok(ctx.fills>0, `${key} must paint mobile canvas at t=${t}`);
  runtime.kefeEffects[key](ctx,1280,720,style,plainLines,t);runtime.kefeEffects[key](ctx,1280,720,style,[],t);
 }
}
for (const key of matrixKeys) {
 const ctx=makeContext(),style={effect:key,fontSize:84,kefeMotionFont:"Open Sans",textColor:"#fff"};
 for(const t of [1.08,1.6,2.2]){
  ctx.resetFills();runtime.kefeEffects[key](ctx,1280,720,style,lines,t);assert.ok(ctx.fills>0,key+" must paint desktop canvas");
  ctx.resetFills();runtime.kefeEffects[key](ctx,360,640,{...style,fontSize:48},lines,t);assert.ok(ctx.fills>0,key+" must paint mobile canvas");
  runtime.kefeEffects[key](ctx,1280,720,style,plainLines,t);runtime.kefeEffects[key](ctx,1280,720,style,[],t);
 }
}
console.log("Lyric effects verified: Apple + Text Swap + Lyric Pull + "+(keys.length+addedSignatureKeys.length)+" Signature + "+typographyKeys.length+" typography + "+matrixKeys.length+" LyricFX Matrix effects; desktop/mobile canvas tests passed.");
