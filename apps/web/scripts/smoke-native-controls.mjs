import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const editor = readFileSync(resolve(root, "editor.source.html"), "utf8");
const structure = readFileSync(resolve(root, "app/ui/structure.js"), "utf8");
const runtime = readFileSync(resolve(root, "app/editor.js"), "utf8");
const editorStyles = readFileSync(resolve(root, "app/ui/styles.css"), "utf8");
const compactStyles = readFileSync(resolve(root, "app/ui/panels-compact.css"), "utf8");
const failures = [];

for (const bridge of ["legacy-text-input-bridge", "legacy-textarea-bridge", "legacy-checkbox-bridge"]) {
  if (editor.includes(bridge)) failures.push(`Editor entry still loads ${bridge}`);
}
for (const source of [
  "beui-src/legacy-text-input-bridge.jsx",
  "beui-src/legacy-textarea-bridge.jsx",
  "beui-src/legacy-checkbox-bridge.jsx",
  "beui-src/components/motion/input.tsx",
  "beui-src/components/motion/textarea.tsx",
  "beui-src/components/motion/checkbox.tsx",
]) {
  if (existsSync(resolve(root, source))) failures.push(`Retired bridge/component source remains: ${source}`);
}
if (!structure.includes("kefe-input") || !structure.includes("kefe-textarea") || !structure.includes("lyricsInput")) {
  failures.push("Native metadata inputs and lyrics textarea are not present in KEFE structure");
}
if (!editorStyles.includes('input[type="checkbox"]:not(.kefe-sr-only)') ||
    !editorStyles.includes(".kefe-input") || !editorStyles.includes(".kefe-textarea")) {
  failures.push("Native input, textarea, or checkbox styles are missing");
}
const migratedBridges = [
  "legacy-select-bridge", "legacy-tabs-bridge", "legacy-sidebar-bridge",
  "legacy-chrome-bridge", "legacy-panel-buttons-bridge",
];
for (const bridge of migratedBridges) {
  if (editor.includes(bridge)) failures.push(`Editor entry still loads ${bridge}`);
  if (existsSync(resolve(root, `beui-src/${bridge}.jsx`))) failures.push(`Retired bridge source remains: ${bridge}.jsx`);
}
if (!structure.includes("data-shell-panel") || !structure.includes("data-dock-panel") || !structure.includes("data-accent")) {
  failures.push("Native sidebar, dock, or accent controls are missing from KEFE structure");
}
if (!structure.includes("decoratePanelAction") || !structure.includes("button.type = 'button'") || !structure.includes("kefe-panel-action")) {
  failures.push("Native panel buttons are not decorated in place while preserving button semantics");
}
if (!structure.includes("syncShellSection(button.dataset.panel)") || !structure.includes("aria-current") || !runtime.includes("openEditorPanel")) {
  failures.push("Native sidebar navigation is missing its active-state and panel-selection path");
}
if (runtime.includes(".beui-transport-host")) failures.push("Fullscreen control logic still depends on the retired transport host");

for (const retiredClass of [
  "beui-native-input", "beui-native-textarea", "beui-native-checkbox",
  "beui-native-checkbox-label", "beui-input-host", "beui-textarea-host", "beui-checkbox-host",
  "beui-checkbox-control", "beui-textarea-control", "beui-input-control",
  "beui-native-select", "beui-select-host", "beui-tabs-host", "beui-native-tab",
  "beui-sidebar-nav-host", "beui-native-sidebar-control", "beui-transport-host",
  "beui-native-transport", "beui-panel-button-host", "beui-native-panel-button", "beui-panel-action",
]) {
  if (editorStyles.includes(retiredClass) || compactStyles.includes(retiredClass)) {
    failures.push(`Native styles still depend on retired mirrored-control class ${retiredClass}`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("PASS: editor inputs, selects, section tabs, shell navigation, transport, and panel actions remain directly KEFE-owned; retired mirrors and their source styles are absent.");
