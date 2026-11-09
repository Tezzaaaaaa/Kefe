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

for (const group of ["content", "design", "audio-visuals", "export"]) {
  if (!panelHtml.includes('data-group="' + group + '"')) failures.push("Missing " + group + " workspace.");
}
for (const slot of ["media", "lyric-sync", "lyric-effects", "background", "visualisers", "export"]) {
  if (!panelHtml.includes('data-kefe-slot="' + slot + '"')) failures.push("Missing live control slot: " + slot);
}
if ((panelHtml.match(/data-expanded="true"/g) || []).length !== 6) {
  failures.push("All six native control panels must retain their expanded content state.");
}
if (!panelHtml.includes("Visualiser") || (panelHtml.match(/>Effects</g) || []).length !== 2 || panelHtml.includes("kefe-advanced-controls") || !adapter.includes("kefe-subtabs")) {
  failures.push("Effects and Visualiser must be clearly named, and every workspace must list its features as subtabs (no Advanced wrapper).");
}
if (!bg.includes("effectsGroup.dataset.backgroundGroup='effects'") || !bg.includes("Background Effects")) {
  failures.push("Background and Background Effects must have distinct visible group structure.");
}
if (!(panelHtml.includes("kefe-settings-github") || adapter.includes("kefe-settings-github")) ||
    !(panelHtml.includes("https://github.com/Tezzaaaaaa/Kefe") || adapter.includes("https://github.com/Tezzaaaaaa/Kefe"))) {
  failures.push("The KEFE repository link must be available inside Settings.");
}
if (panelHtml.includes("expand-button") || panelHtml.includes("data-expanded=\"false\"")) {
  failures.push("Workspace controls must not be hidden behind accordions.");
}
if (!/panel\.css\?v=[^"\s]+/.test(editor) ||
    editor.includes("mobile-sidebar.js") || editor.includes("desktop-panels.js")) {
  failures.push("The editor must load the workspace layout and retire the six-section sidebars.");
}
if (!adapter.includes("panel.classList.add('kefe-settings-embedded-panel', 'active')") ||
    !adapter.includes("All four KEFE workspaces are required.")) {
  failures.push("The adapter must mount every native panel into the four persistent workspaces.");
}
if (!panelHtml.includes('data-workspace-tab="export"') ||
    panelHtml.indexOf('data-workspace-tab="export"') < panelHtml.indexOf('data-workspace-tab="audio-visuals"') ||
    !panelHtml.includes('data-group="export"')) {
  failures.push("Export must be the final top-level workspace with its own panel.");
}
const audioVisuals = panelHtml.split('data-group="audio-visuals"')[1]?.split('data-group="export"')[0] || "";
if (audioVisuals.includes('data-section-id="export"')) {
  failures.push("Export must not remain inside Visualiser.");
}
if (!panelStyles.includes(".kefe-workspace-tabs") || !panelStyles.includes(".kefe-workspace[hidden]")) {
  failures.push("Persistent workspace tabs must control one visible workspace at a time.");
}
if (!panelStyles.includes(".kefe-subtab") || !panelStyles.includes(".kefe-background-effects-group")) {
  failures.push("Subtabs and Background Effects groups must have consistent dedicated styling.");
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("PASS: four persistent workspace tabs, Export is separate, tidy section grouping and six native panels are present.");
