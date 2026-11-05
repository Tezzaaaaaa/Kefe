import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const editor = readFileSync(resolve(root, "editor.source.html"), "utf8");
const adapter = readFileSync(resolve(root, "app/settings/panel-adapter.js"), "utf8");
const panelHtml = readFileSync(resolve(root, "app/settings/panel.html"), "utf8");
const panelStyles = readFileSync(resolve(root, "app/settings/panel.css"), "utf8");
const failures = [];

for (const group of ["content", "design", "audio-visuals"]) {
  if (!panelHtml.includes('data-group="' + group + '"')) failures.push("Missing " + group + " workspace.");
}
for (const slot of ["media", "lyric-sync", "lyric-effects", "background", "visualisers", "export"]) {
  if (!panelHtml.includes('data-kefe-slot="' + slot + '"')) failures.push("Missing live control slot: " + slot);
}
if ((panelHtml.match(/data-expanded="true"/g) || []).length !== 6) {
  failures.push("All six native control panels must be visible from initial load.");
}
if (panelHtml.includes("expand-button") || panelHtml.includes("data-expanded=\"false\"")) {
  failures.push("Workspace controls must not be hidden behind accordions.");
}
if (!editor.includes("panel.css?v=three-workspaces-20261106-1") ||
    editor.includes("mobile-sidebar.js") || editor.includes("desktop-panels.js")) {
  failures.push("The editor must load the workspace layout and retire the six-section sidebars.");
}
if (!adapter.includes("panel.classList.add('kefe-settings-embedded-panel', 'active')") ||
    !adapter.includes("All three KEFE workspaces are required.")) {
  failures.push("The adapter must mount every native panel into the three persistent workspaces.");
}
if (!panelStyles.includes("grid-template-columns: repeat(3, minmax(0, 1fr))") ||
    !panelStyles.includes("grid-template-columns: minmax(0, 1fr)")) {
  failures.push("Workspaces must display in three desktop columns and stack on mobile.");
}
if (!panelStyles.includes(".kefe-workspace .section-content") ||
    !panelStyles.includes("display: block !important")) {
  failures.push("Workspace content must remain visible without accordion interaction.");
}

if (failures.length) {
  console.error(failures.join("\\n"));
  process.exit(1);
}
console.log("PASS: three visible workspaces retain all six native control panels on desktop and mobile.");
