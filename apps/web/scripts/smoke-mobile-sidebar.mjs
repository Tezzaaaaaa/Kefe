import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const editor = read("editor.source.html");
const panel = read("app/settings/panel.html");
const styles = read("app/settings/panel.css");
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

expect(!editor.includes("beui-src/mobile-sidebar.js"), "the retired single-section mobile drawer must not load");
expect(!editor.includes("app/ui/desktop-panels.js"), "the retired two-column desktop panel switcher must not load");
for (const group of ["content", "design", "audio-visuals"]) {
  expect(panel.includes('data-group="' + group + '"'), "missing " + group + " workspace");
}
for (const slot of ["media", "lyric-sync", "lyric-effects", "background", "visualisers", "export"]) {
  expect(panel.includes('data-kefe-slot="' + slot + '"'), "missing live control slot " + slot);
}
expect((panel.match(/data-expanded="true"/g) || []).length === 6, "all six native control panels must start visible");
expect(!panel.includes("expand-button") && !panel.includes('data-expanded="false"'),
  "workspace controls must not depend on accordion expansion");
expect(styles.includes("grid-template-columns: repeat(3, minmax(0, 1fr))"),
  "desktop must present three workspace columns");
expect(styles.includes("@media (max-width: 760px)") &&
  styles.includes("grid-template-columns: minmax(0, 1fr)"),
  "mobile must stack the same three visible workspaces");
expect(styles.includes(".kefe-workspace .section-content") &&
  styles.includes("display: block !important"),
  "workspace content must remain visible without user interaction");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("PASS: mobile and desktop use the same three always-visible workspaces; no section drawer or hidden controls.");
