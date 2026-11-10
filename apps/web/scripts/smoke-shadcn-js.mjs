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

// 2. All Radix primitives and pure shadcn wrappers must be backed by real primitives.
const slider = read("components/ui/slider.js");
const bridge = read("beui-src/shadcn-slider.js");
assert.match(slider, /@radix-ui\/react-slider/);
assert.match(slider, /SliderPrimitive\.Root/);
assert.match(bridge, /createRoot/);
assert.match(bridge, /input\.dispatchEvent/);

for (const [component, primitive] of [
  ["accordion", "react-accordion"],
  ["button", "react-slot"],
  ["badge", "react-slot"],
  ["checkbox", "react-checkbox"],
  ["collapsible", "react-collapsible"],
  ["dialog", "react-dialog"],
  ["dropzone", "react-slot"],
  ["label", "react-label"],
  ["popover", "react-popover"],
  ["progress", "react-progress"],
  ["radio-group", "react-radio-group"],
  ["select", "react-select"],
  ["separator", "react-separator"],
  ["slider", "react-slider"],
  ["switch", "react-switch"],
  ["tabs", "react-tabs"],
  ["toggle-group", "react-toggle-group"],
  ["tooltip", "react-tooltip"],
]) {
  assert.ok(read(`components/ui/${component}.js`).includes(`@radix-ui/${primitive}`), `${component} must use @radix-ui/${primitive}`);
}
for (const component of ["alert", "card", "input", "table", "textarea"]) {
  assert.ok(read(`components/ui/${component}.js`).includes("data-slot"), `${component} must define data-slot`);
}

// 3. Verify Settings panel HTML & CSS match KEFE's shadcn.io design tokens (#d92f33 accent, Lucide SVGs, no #4f9eff blue).
const panelHtml = read("app/settings/panel.html");
const panelCss = read("app/settings/panel.css");
assert.doesNotMatch(panelHtml, /#4f9eff/i, "panel.html must not contain hardcoded #4f9eff blue");
assert.doesNotMatch(panelHtml, />i<\/button>/, "panel.html info buttons must use Lucide info SVGs instead of serif 'i'");
assert.doesNotMatch(panelCss, /#4f9eff/i, "panel.css must use KEFE --shad-* tokens instead of #4f9eff blue");
assert.doesNotMatch(panelCss, /Georgia,\s*serif/i, "panel.css must not style info buttons with Georgia serif");
assert.doesNotMatch(panelCss, /content:\s*["']›["']/, "panel.css must use Lucide chevron SVGs instead of text '›'");

// 4. Verify shadcn-kefe.css defines Night/Day tokens and core shadcn primitives (no legacy #7777e8 motion artwork override).
const shadcnCss = read("beui-src/shadcn-kefe.css");
const motionArtwork = read("app/visualiser/motion-artwork.js");
assert.doesNotMatch(motionArtwork, /#7777e8/i, "motion-artwork.js must not inject hardcoded #7777e8 purple inline styles");
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
  ".shad-badge[data-slot=\"badge\"]",
  ".shad-label[data-slot=\"label\"]",
  ".shad-separator[data-slot=\"separator\"]",
  ".shad-collapsible[data-slot=\"collapsible\"]",
  ".shad-popover-content[data-slot=\"popover-content\"]",
  ".shad-volume-popover-content",
  '[data-slot="toggle-group"]',
  ".shad-tooltip-content[data-slot=\"tooltip-content\"]",
  '[data-slot="dropzone"]',
  '[data-slot="checkbox"]',
  '[data-slot="alert"]',
  "#kefeMotionArtwork",
]) {
  assert.ok(shadcnCss.includes(selector), `shadcn-kefe.css must define ${selector}`);
}

console.log("PASS: all 23 shadcn/Radix primitives, icons, Night/Day tokens and pure shadcn styling verified.");
