import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const structure = readFileSync(resolve(root, "app/ui/structure.js"), "utf8");
const editor = readFileSync(resolve(root, "editor.source.html"), "utf8");
const panelStyles = readFileSync(resolve(root, "app/ui/styles.css"), "utf8");
const compactPanelStyles = readFileSync(resolve(root, "app/ui/panels-compact.css"), "utf8");

const expected = ["media", "lyrics", "effects", "background-effects", "visualiser", "export"];
const failures = [];

for (const panel of expected) {
  const escapedAttribute = `data-panel-view=\\"${panel}\\"`;
  const plainAttribute = `data-panel-view="${panel}"`;
  if (!structure.includes(escapedAttribute) && !structure.includes(plainAttribute)) {
    failures.push(`Missing ${panel} editor section in structure.js`);
  }
}

if (editor.includes("legacy-panel-card-bridge")) {
  failures.push("Editor entry still loads the retired React panel-card bridge");
}
if (panelStyles.includes("beui-panel-card-root") || panelStyles.includes("beui-editor-panel-card")) {
  failures.push("Native panel styles still depend on a React Card wrapper");
}
if (!panelStyles.includes(".kefe-panel{display:none") || !compactPanelStyles.includes(".kefe-panel:not(.kefe-settings-embedded-panel)")) {
  failures.push("Native editor panel surface styling is missing");
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("PASS: all six editor sections remain native KEFE panels; the React Card wrapper is not loaded or required by native styles.");
