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
for (const group of ["content", "design", "audio-visuals", "export"]) {
  expect(panel.includes('data-group="' + group + '"'), "missing " + group + " workspace");
}
for (const slot of ["media", "lyric-sync", "lyric-effects", "background", "visualisers", "export"]) {
  expect(panel.includes('data-kefe-slot="' + slot + '"'), "missing live control slot " + slot);
}
expect((panel.match(/data-expanded="true"/g) || []).length === 6, "all six native control panels must retain their content state");
expect((panel.match(/data-workspace-tab="/g) || []).length === 4, "all four workspace tabs must remain present");
expect((panel.match(/class="kefe-panel kefe-workspace/g) || []).length === 4, "all four workspace panels must remain present");
expect(panel.includes('role="tablist"') && panel.includes('aria-selected="true"'),
  "workspace tabs must expose accessible selected state");
expect((panel.match(/hidden aria-hidden="true"/g) || []).length === 3,
  "only the selected workspace is visible at a time");
expect(styles.includes(".kefe-workspace-tabs") && styles.includes(".kefe-workspace[hidden]"),
  "workspace tab strip and inactive workspace state must be styled");
expect(styles.includes("@media (max-width: 760px)"),
  "mobile must retain a responsive workspace tab layout");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("PASS: mobile and desktop retain four persistent accessible workspace tabs; only the selected workspace is visible.");
