import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
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

// 2. Verify zero .jsx or .tsx source files remain anywhere in apps/web/app or apps/web/beui-src.
function walkFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, out);
    else out.push(full);
  }
  return out;
}

const sourceFiles = [
  ...walkFiles(resolve(root, "app")),
  ...walkFiles(resolve(root, "beui-src")),
];
const remainingJsxTsx = sourceFiles.filter((f) => /\.(jsx|tsx|ts)$/.test(f));
assert.deepEqual(
  remainingJsxTsx,
  [],
  `All React/TSX bridges must be converted to pure JS + CSS; found: ${remainingJsxTsx.join(", ")}`,
);

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

// 5. Verify built dist-beui bundle has zero React / Framer Motion / Radix runtime code.
const distAssetsDir = resolve(root, "dist-beui/assets");
if (existsSync(distAssetsDir)) {
  const builtJsFiles = readdirSync(distAssetsDir).filter((f) => f.endsWith(".js"));
  assert.ok(builtJsFiles.length >= 1, "dist-beui/assets must contain the built JS bundle");
  for (const jsFile of builtJsFiles) {
    const bundle = readFileSync(resolve(distAssetsDir, jsFile), "utf8");
    assert.ok(!bundle.includes("__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED"),
      `${jsFile} must not bundle React runtime`);
    assert.ok(!bundle.includes("framer-motion"),
      `${jsFile} must not bundle framer-motion`);
  }
}

console.log("PASS: pure-JS + CSS shadcn.io design system verified (icons, primitives, tokens, zero React/TSX runtime).");
