import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const editor = readFileSync(resolve(root, "editor.source.html"), "utf8");
const tabsModule = readFileSync(resolve(root, "beui-src/shadcn-settings-tabs.js"), "utf8");
const compactStyles = readFileSync(resolve(root, "app/ui/panels-compact.css"), "utf8");
const failures = [];

if (!editor.includes("shadcn-settings-tabs.js")) {
  failures.push("The editor entry must load the pure-JS grouped settings tabs module");
}
if (editor.includes("legacy-settings-tabs-bridge.jsx") || existsSync(resolve(root, "beui-src/legacy-settings-tabs-bridge.jsx"))) {
  failures.push("Retired React legacy-settings-tabs-bridge.jsx must be removed");
}
if (!tabsModule.includes("export function createShadcnTabs") ||
    !tabsModule.includes('setAttribute("role", "tablist")') ||
    !tabsModule.includes('setAttribute("role", "tab")')) {
  failures.push("shadcn-settings-tabs.js must implement WAI-ARIA Tabs (tablist + tab) in pure JS");
}

const sections = {
  media: "media",
  "lyric-sync": "lyrics",
  "lyric-effects": "effects",
  background: "background-effects",
  visualisers: "visualiser",
  export: "export",
};
for (const [sectionId, nav] of Object.entries(sections)) {
  if (!tabsModule.includes(`"${sectionId}": { nav: "${nav}"`) && !tabsModule.includes(`${sectionId}: { nav: "${nav}"`)) {
    failures.push(`Grouped settings tabs must map the ${sectionId} section to its ${nav} panel`);
  }
}
if (!tabsModule.includes(".kefe-section[data-panel=")) {
  failures.push("Grouped settings tabs must delegate selection to the hidden native section buttons");
}
if (!tabsModule.includes("data-selected-section")) {
  failures.push("Grouped settings tabs must stay in sync with the adapter's selected section");
}
if (!tabsModule.includes("data-modified")) {
  failures.push("Grouped settings tabs must surface modified sections");
}
if (!tabsModule.includes("data-settings-tabs")) {
  failures.push("Each settings column must receive its own grouped tab strip");
}

const compactRules = [
  ".kefe-section-tabs-host",
  ".kefe-section-tabs-list",
  ".kefe-section-tabs-trigger",
  '.kefe-section-tabs-trigger[data-state="active"]',
  ".kefe-section-tabs-dot",
];
for (const rule of compactRules) {
  if (!compactStyles.includes(rule)) failures.push(`Compact grouped-tab style is missing: ${rule}`);
}
if (!/\.kefe-settings-panel \.kefe-section-tabs-mount\s*\{[^}]*position:\s*sticky/s.test(compactStyles)) {
  failures.push("The grouped tab strip must stay docked while the settings column scrolls");
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("PASS: pure-JS grouped shadcn Tabs cover all six settings sections and stay docked inside the preview screen.");
