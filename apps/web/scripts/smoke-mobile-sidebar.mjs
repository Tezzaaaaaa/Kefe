import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Structural smoke test for the mobile editor sidebar.
 *
 * The sidebar must remain a pure enhancement: it hosts the native editor
 * panels (never clones their controls), it only activates below the desktop
 * breakpoint, and it is present in the published editor page.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

const editor = read("editor.source.html");
const source = read("beui-src/mobile-sidebar.jsx");
const sections = read("beui-src/mobile-sidebar-sections.js");
const styles = read("beui-src/mobile-sidebar.css");
const rangeBridge = read("beui-src/legacy-range-bridge.jsx");

const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

// Wired into the published editor page.
expect(editor.includes("beui-src/mobile-sidebar.jsx"), "editor.source.html must load the mobile sidebar module");

// One entry per editor section, each with a group fallback so controls that
// other modules append later are never orphaned.
for (const id of ["media", "lyrics", "effects", "background-effects", "visualiser", "export"]) {
  expect(sections.includes(`id: "${id}"`), `mobile sidebar is missing the ${id} section`);
}
const fallbacks = sections.match(/selectors: \[\]/g) || [];
expect(fallbacks.length >= 5, `every section needs a fallback control group (found ${fallbacks.length})`);

// The shadcn-style surfaces requested for the mobile layout.
for (const marker of [
  "kefe-ms-dock",
  "kefe-ms-drawer",
  "kefe-ms-tabs",
  "kefe-ms-tools",
  "kefe-ms-host",
  "role=\"dialog\"",
  "aria-modal=\"false\"",
]) {
  expect(source.includes(marker), `mobile sidebar is missing ${marker}`);
}

// Sections open inline under the preview via the bottom dock: no icon rail, no dimming scrim.
expect(!source.includes("kefe-ms-rail"), "the sidebar icon rail must stay removed");
expect(source.includes("--kefe-ms-top") && source.includes("--kefe-ms-bottom"), "the section panel must be placed between the timeline and the dock");

// Sliders must keep using the shared beUI RangeSlider bridge: the sidebar may
// only move existing range inputs, never create new ones.
expect(!/createElement\(\s*["']input/.test(source), "mobile sidebar must not create its own inputs");
expect(!/createElement\(\s*["']input/.test(source) && !/type=["']range["']\s*\/>/.test(source),
  "mobile sidebar must not declare its own range inputs");
expect(rangeBridge.includes("RangeSlider"), "the beUI RangeSlider bridge must remain the slider source of truth");

// Appearance lives in its own stylesheet, scoped to the mobile breakpoint.
expect(styles.includes("@media (max-width: 1023px)"), "mobile sidebar styles must be scoped to the mobile breakpoint");
expect(/\.kefe-ms-dock,\s*\n\s*\.kefe-ms-scrim,\s*\n\s*\.kefe-ms-drawer \{\s*\n\s*display: none;/.test(styles),
  "mobile sidebar surfaces must be hidden by default");
expect(styles.includes("html.kefe-ms-enabled .kefe-editing"), "the stacked settings surface must be retired on mobile");
expect(styles.includes("kefe-ms-group-off"), "group tabs must hide inactive control groups");
expect(styles.includes("is-collapsed"), "control groups must support the accordion collapse state");
expect(styles.includes("prefers-reduced-motion"), "mobile sidebar must honour reduced motion");
expect(styles.includes("safe-area-inset-bottom"), "mobile sidebar must respect the device safe area");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("PASS: the mobile editor sidebar hosts the six native panels inline under the preview through the bottom dock, group tabs and an expanding tools menu.");
