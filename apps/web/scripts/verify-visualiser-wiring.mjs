#!/usr/bin/env node
/* KEFE — visualiser wiring audit.
 *
 * Every visualiser must be reachable from the editor and from the export compositor:
 *   page -> tab -> settings panel -> own controls -> power switch -> preview canvas -> export layer
 * and exactly one visualiser may own the preview and the settings panel at a time.
 *
 * Bespoke engines own all of that wiring themselves; "registered" engines are built by the shared
 * shader-vis framework, so their framework evidence is checked once and their registration is
 * checked per engine. Run with: node scripts/verify-visualiser-wiring.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(webRoot, relative), "utf8");

const editorSource = read("editor.source.html");
const editorBuilt = read("editor.html");
const bundleName = (editorBuilt.match(/assets\/editor-[\w-]+\.js/) || [])[0] || "";
const bundle = bundleName && existsSync(resolve(webRoot, bundleName)) ? read(bundleName) : "";
const editor = read("app/editor.js");
const audioPlumbing = read("app/visualiser/audio-overlay.js");
const FRAMEWORK = read("app/visualiser/shader-vis.js");

/* "bespoke" engines build their own tab, panel, controls and canvas.
   "registered" engines are built by the shader-vis framework from a registration definition. */
const engines = [
  { name: "Fluid Ink", id: "gradient", canvas: "kefeFluidInkCanvas", kind: "bespoke", files: ["app/visualiser/gradient.js", "app/visualiser/liquid-flow.js"] },
  { name: "Glass Lens", id: "fluted", canvas: "kefeFlutedGlassCanvas", kind: "bespoke", files: ["app/visualiser/fluted-glass.js"] },
  { name: "Liquid Glass", id: "liquid-glass", canvas: "kefeLiquidGlassCanvas", kind: "bespoke", files: ["app/visualiser/liquid-glass.js"] },
  { name: "Slow Light", id: "slow-light", canvas: "kefeSlowLightCanvas", kind: "bespoke", files: ["app/visualiser/slow-light.js"] },
  { name: "Silk Road", id: "silk-road", canvas: "kefeSilkRoadCanvas", kind: "registered", files: ["app/visualiser/silk-road.js"] },
  { name: "Visuals Mix", id: "visuals-mix", canvas: "kefeVisualsMixCanvas", kind: "registered", files: ["app/visualiser/visuals-mix.js"] },
];

const failures = [];
const rows = [];
const fail = (engine, message) => failures.push(`${engine}: ${message}`);

/* Framework-wide contracts, asserted once. */
const frameworkChecks = {
  "framework mounts engine canvases into the preview stage": FRAMEWORK.includes("stage.insertBefore"),
  "framework builds a tab from the registration": FRAMEWORK.includes("dataset.visualiser = def.id"),
  "framework provides a power switch": FRAMEWORK.includes("kefe-vis-option-power"),
  "framework announces selection": FRAMEWORK.includes("dispatchEvent(new CustomEvent('kefe-visualiser-select'"),
  "framework stands down on another engine": FRAMEWORK.includes("addEventListener('kefe-visualiser-select'"),
  "framework collapses its panel when yielding": FRAMEWORK.includes("view.hidden = true"),
  "framework honours the FPS target": FRAMEWORK.includes("kefeFrameGate"),
  "framework builds per-engine settings controls": FRAMEWORK.includes("def.buildView({"),
};
for (const [label, ok] of Object.entries(frameworkChecks)) if (!ok) failures.push(`shader-vis: ${label}`);

for (const engine of engines) {
  const own = engine.files.map((file) => read(file)).join("\n");
  const text = engine.kind === "registered" ? FRAMEWORK : own;
  const checks = {};

  /* Loaded by the editor page: script tag, or bundled into the editor chunk. */
  checks.loaded = editorSource.includes(`app/visualiser/${engine.files[0].split("/").pop()}`)
    || engine.files.some((file) => bundle.includes(file.split("/").pop().replace(/\.js$/, "")));

  /* Registers a tab the editor toolbar, side panel and beUI tab list all read. */
  checks.tab = engine.kind === "registered"
    ? own.includes("register(") && own.includes(`id: '${engine.id}'`)
    : text.includes(`'${engine.id}'`) && text.includes("kefe-vis-tabs");

  /* Owns a preview canvas mounted inside the preview stage. */
  checks.canvas = engine.kind === "registered"
    ? own.includes(`canvasId: '${engine.canvas}'`) && text.includes("stage.insertBefore")
    : own.includes(`'${engine.canvas}'`) && own.includes("stage.insertBefore");

  /* Ships a settings panel with controls bound to the renderer. */
  checks.settings = engine.kind === "registered"
    ? own.includes("buildView(") && own.includes("fs:") && text.includes("kefe-vis-view")
    : own.includes("kefe-vis-view") && [".kefe-visualiser-field", "slider(", "field(", "addSlider(", "choice("].some((hook) => own.includes(hook));

  /* Exposes its own independent power switch. */
  checks.power = text.includes("kefe-vis-option-power") && (engine.kind === "registered" || own.includes("kefe-vis-option-power"));

  /* Announces selection and stands down when another engine takes over. */
  checks.selects = engine.kind === "registered"
    ? text.includes("dispatchEvent(new CustomEvent('kefe-visualiser-select'") && own.includes("register(")
    : own.includes("dispatchEvent(new CustomEvent('kefe-visualiser-select'");
  checks.yields = text.includes("addEventListener('kefe-visualiser-select'");

  /* Collapses every sibling settings panel when it is selected. */
  checks.solo = /n!==view|n !== view|item !== view|v!==view|v !== view/.test(text);

  /* Reaches the export compositor through the shared layer lookup. */
  checks.exported = editor.includes("function activeVisualiserLayer")
    && (engine.kind === "registered" ? editor.includes("kefeShaderVis?.current?.()") : editor.includes(`'${engine.canvas}'`));

  /* Honours the FPS target setting in its render loop. */
  checks.frameGate = text.includes("kefeFrameGate(");

  rows.push({ name: engine.name, checks });
  for (const [key, ok] of Object.entries(checks)) if (!ok) fail(engine.name, `missing ${key}`);
}

/* Global wiring: settings that claim to drive visualisers must have a consumer. */
const globalChecks = {
  "fps target reaches the render loops": audioPlumbing.includes("kefeFrameGate") && audioPlumbing.includes("fpsTarget"),
  "fps target reaches the exporter": /const exportFps=.*fpsTarget/.test(editor),
  "fft size reaches the audio graph": audioPlumbing.includes("fftPower"),
  "no stale visualiser canvas ids in the exporter": !/getElementById\('kefeLiquidFlowCanvas'\)/.test(editor),
  "exporter never double-paints the composited layer": editor.includes("fluidInkComposited"),
  "exporter resolves every layer through one lookup": /activeVisualiserLayer\(\)/.test(editor),
};
for (const [label, ok] of Object.entries(globalChecks)) if (!ok) failures.push(`settings: ${label}`);

/* Report */
const columns = [
  ["loaded", "page"], ["tab", "tab"], ["canvas", "canvas"], ["settings", "settings"], ["power", "power"],
  ["selects", "selects"], ["yields", "yields"], ["solo", "solo"], ["exported", "export"], ["frameGate", "fps"],
];
const pad = (value, width) => String(value).padEnd(width);
console.log(pad("visualiser", 14) + columns.map(([, label]) => pad(label, 9)).join(""));
console.log("-".repeat(14 + columns.length * 9));
for (const row of rows) {
  console.log(pad(row.name, 14) + columns.map(([key]) => pad(row.checks[key] ? "yes" : "NO", 9)).join(""));
}
console.log("");

if (failures.length) {
  console.error(`Visualiser wiring audit failed (${failures.length}):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`Visualiser wiring audit passed: ${engines.length} engines fully connected.`);
