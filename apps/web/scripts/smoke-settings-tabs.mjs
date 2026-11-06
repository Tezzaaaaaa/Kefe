import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const editor = readFileSync(resolve(root, "editor.source.html"), "utf8");
const adapter = readFileSync(resolve(root, "app/settings/panel-adapter.js"), "utf8");
const panelHtml = readFileSync(resolve(root, "app/settings/panel.html"), "utf8");
const panelStyles = readFileSync(resolve(root, "app/settings/panel.css"), "utf8");
const failures = [];
const bg = readFileSync(resolve(root, "app/visualiser/background.js"), "utf8");

for (const group of ["content", "design", "audio-visuals"]) {
  if (!panelHtml.includes('data-group="' + group + '"')) failures.push("Missing " + group + " workspace.");
}
for (const slot of ["media", "lyric-sync", "lyric-effects", "background", "visualisers", "export"]) {
  if (!panelHtml.includes('data-kefe-slot="' + slot + '"')) failures.push("Missing live control slot: " + slot);
}
if ((panelHtml.match(/data-expanded="true"/g) || []).length !== 6) {
  failures.push("All six native control panels must retain their expanded content state.");
}
if (!panelHtml.includes("Audio &amp; Visualiser") || !panelHtml.includes("<summary>Advanced</summary>")) {
  failures.push("Audio & Visualiser must be clearly named and Export must be inside collapsed Advanced controls.");
}
if (!bg.includes("effectsGroup.dataset.backgroundGroup='effects'") || !bg.includes("Background Effects")) {
  failures.push("Background and Background Effects must have distinct visible group structure.");
}
if (panelHtml.includes("expand-button") || panelHtml.includes("data-expanded=\"false\"")) {
  failures.push("Workspace controls must not be hidden behind accordions.");
}
if (!/panel\\.css\\?v=[^"\\s]+/.test(editor) ||
    editor.includes("mobile-sidebar.js") || editor.includes("desktop-panels.js")) {
  failures.push("The editor must load the workspace layout and retire the six-section sidebars.");
}
if (!adapter.includes("panel.classList.add('kefe-settings-embedded-panel', 'active')") ||
    !adapter.includes("All three KEFE workspaces are required.")) {
  failures.push("The adapter must mount every native panel into the three persistent workspaces.");
}
if (!panelStyles.includes(".kefe-workspace-tabs") || !panelStyles.includes(".kefe-workspace[hidden]")) {
  failures.push("Persistent workspace tabs must control one visible workspace at a time.");
}
if (!panelStyles.includes(".kefe-advanced-controls") || !panelStyles.includes(".kefe-background-effects-group")) {
  failures.push("Advanced and Background Effects groups must have consistent dedicated styling.");
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("PASS: three persistent workspace tabs, tidy section grouping and six native panels are present.");
