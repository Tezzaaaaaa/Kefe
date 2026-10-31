import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const editor = readFileSync(resolve(root, "editor.source.html"), "utf8");
const adapter = readFileSync(resolve(root, "app/settings/panel-adapter.js"), "utf8");
const panelStyles = readFileSync(resolve(root, "app/settings/panel.css"), "utf8");
const failures = [];

if (editor.includes("legacy-settings-tabs-bridge.jsx")) {
  failures.push("The retired grouped settings-tab bridge must not load alongside the native section headers");
}
if (!adapter.includes("const selected = item === section;") ||
    !adapter.includes("editing.setAttribute('data-selected-section', key);")) {
  failures.push("Selecting a settings section must close every other section and update the canonical selection");
}
if (!adapter.includes("editing.dataset.selectedSection === 'visualiser'")) {
  failures.push("Visualiser controls must follow the selected section, not an independent accordion state");
}
if (!panelStyles.includes("Editor workspace: keep the preview in the upper half") ||
    !panelStyles.includes("grid-template-columns: minmax(0, 1fr);") ||
    !panelStyles.includes("display: contents;")) {
  failures.push("Desktop settings must be one full-width section stack below the preview");
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("PASS: one active settings section is shown below the desktop preview; duplicate grouped navigation is retired.");
