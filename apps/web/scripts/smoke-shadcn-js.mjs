import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderKefeIcon } from "../app/ui/icons.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(resolve(root, rel), "utf8");

// 1. Verify every icon key used across KEFE renders a valid Lucide SVG in pure JS.
const requiredIcons = [
  "play", "pause", "skip-back", "skip-forward", "volume", "mute", "maximize", "minimize",
  "sun", "moon", "search", "sliders", "settings", "close", "check", "chevron-down",
  "chevron-up", "chevron-left", "chevron-right", "music", "list-music", "sparkles",
  "layers", "audio-waveform", "download", "upload", "link", "folder", "wand",
  "info", "check-circle", "alert-triangle", "x-circle", "github", "disc", "gauge",
];
for (const name of requiredIcons) {
  const svg = renderKefeIcon(name);
  assert.match(svg, /^<svg\b[\s\S]*\bclass="lucide\b[\s\S]*<\/svg>$/, `Icon "${name}" must render a valid <svg class="lucide">`);
}

// 2. Migrated primitives must use Radix, not data-slot tags alone.
const slider = read("components/ui/slider.js");
const bridge = read("beui-src/shadcn-slider.js");
assert.match(slider, /@radix-ui\/react-slider/);
assert.match(slider, /SliderPrimitive\.Root/);
assert.match(bridge, /createRoot/);
assert.match(bridge, /input\.dispatchEvent/);
for (const [component, primitive] of [["checkbox", "react-checkbox"], ["switch", "react-switch"], ["select", "react-select"], ["dialog", "react-dialog"], ["accordion", "react-accordion"], ["tabs", "react-tabs"], ["progress", "react-progress"]]) {
  assert.ok(read(`components/ui/${component}.js`).includes(`@radix-ui/${primitive}`), `${component} must use its Radix primitive`);
}

// 3. Verify Settings panel HTML & CSS match KEFE's shadcn.io design tokens (#d92f33 accent, Lucide SVGs, no #4f9eff blue).
const panelHtml = read("app/settings/panel.html");
const panelCss = read("app/settings/panel.css");
assert.doesNotMatch(panelHtml, /#4f9eff/i, "panel.html must not contain hardcoded #4f9eff blue");
assert.doesNotMatch(panelHtml, />i<\/button>/, "panel.html info buttons must use Lucide info SVGs instead of serif 'i'");
assert.doesNotMatch(panelCss, /#4f9eff/i, "panel.css must use KEFE --shad-* tokens instead of #4f9eff blue");
assert.doesNotMatch(panelCss, /Georgia,\s*serif/i, "panel.css must not style info buttons with Georgia serif");
assert.doesNotMatch(panelCss, /content:\s*["']›["']/, "panel.css must use Lucide chevron SVGs instead of text '›'");

// 4. Verify shadcn-kefe.css defines both Night and Day tokens and core shadcn primitives.
const shadcnCss = read("beui-src/shadcn-kefe.css");
for (const selector of [
  'html[data-theme="night"]',
  'html[data-theme="day"]',
  ".shad-slider",
  ".kefe-volume-popover .shad-slider",
  ".shad-switch",
  ".shad-select-trigger",
  ".shad-dialog-content",
  ".shad-accordion-trigger",
  ".shad-command-dialog",
  '[data-slot="toggle-group"]',
  '[data-slot="dropzone"]',
  '[data-slot="checkbox"]',
  '[data-slot="alert"]',
]) {
  assert.ok(shadcnCss.includes(selector), `shadcn-kefe.css must define ${selector}`);
}

// The rest of the UI is still legacy. This check deliberately does not claim
// that adding shadcn-style classes makes those controls shadcn components.
console.log("PASS: migrated shadcn/Radix primitives, icons and existing design tokens verified.");
