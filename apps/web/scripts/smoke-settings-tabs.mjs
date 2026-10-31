import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const editor = readFileSync(resolve(root, "editor.source.html"), "utf8");
const bridge = readFileSync(resolve(root, "beui-src/legacy-settings-tabs-bridge.jsx"), "utf8");
const tabs = readFileSync(resolve(root, "beui-src/components/ui/tabs.tsx"), "utf8");
const compactStyles = readFileSync(resolve(root, "app/ui/panels-compact.css"), "utf8");
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const failures = [];

if (!editor.includes("legacy-settings-tabs-bridge.jsx")) {
  failures.push("The editor entry must load the grouped settings tabs bridge");
}
if (!existsSync(resolve(root, "beui-src/components/ui/tabs.tsx"))) {
  failures.push("The shadcn Tabs primitive is missing");
}
if (!tabs.includes('from "@radix-ui/react-tabs"') ||
    !tabs.includes("export { Tabs, TabsList, TabsTrigger, TabsContent }")) {
  failures.push("Tabs must wrap the shadcn/Radix primitive and export the standard parts");
}
if (!packageJson.dependencies?.["@radix-ui/react-tabs"]) {
  failures.push("@radix-ui/react-tabs must be declared as a web app dependency");
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
  if (!bridge.includes(`"${sectionId}": { nav: "${nav}"`) && !bridge.includes(`${sectionId}: { nav: "${nav}"`)) {
    failures.push(`Grouped settings tabs must map the ${sectionId} section to its ${nav} panel`);
  }
}
if (!bridge.includes('document.querySelector(`.kefe-section[data-panel="${nav}"]`)')) {
  failures.push("Grouped settings tabs must delegate selection to the hidden native section buttons");
}
if (!bridge.includes("data-selected-section")) {
  failures.push("Grouped settings tabs must stay in sync with the adapter's selected section");
}
if (!bridge.includes('data-modified="true"')) {
  failures.push("Grouped settings tabs must surface modified sections");
}
if (!bridge.includes('data-settings-tabs={group.dataset.group}')) {
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
console.log("PASS: grouped shadcn Tabs cover all six settings sections and stay docked inside the preview screen.");
