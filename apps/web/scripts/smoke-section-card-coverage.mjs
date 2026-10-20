import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const structure = readFileSync(resolve(root, "app/ui/structure.js"), "utf8");
const editor = readFileSync(resolve(root, "editor.beui.html"), "utf8");
const cardBridge = readFileSync(resolve(root, "beui-src/legacy-panel-card-bridge.jsx"), "utf8");

const expected = ["media", "lyrics", "effects", "background-effects", "visualiser", "export"];
const failures = [];

for (const panel of expected) {
  const escapedAttribute = `data-panel-view=\\"${panel}\\"`;
  const plainAttribute = `data-panel-view="${panel}"`;
  if (!structure.includes(escapedAttribute) && !structure.includes(plainAttribute)) {
    failures.push(`Missing ${panel} editor section in structure.js`);
  }
}

if (!editor.includes('src="./beui-src/legacy-panel-card-bridge.jsx"')) {
  failures.push("The beUI panel Card bridge is not loaded by editor.beui.html");
}
if (!cardBridge.includes('import { Card } from "@/components/motion/card"')) {
  failures.push("Section containers are not wrapped by the actual beUI Card component");
}
if (!cardBridge.includes('.kefe-panel[data-panel-view]')) {
  failures.push("The Card bridge does not target editor section containers");
}
if (!cardBridge.includes('panel.replaceChildren(host)') || !cardBridge.includes('originalNodes')) {
  failures.push("The Card bridge does not preserve and reattach existing section content");
}
if (!cardBridge.includes('panel.classList.add("beui-panel-card-hosted")')) {
  failures.push("The panel host marker needed for beUI card styling is missing");
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("PASS: all six editor sections are covered by the actual beUI Card bridge; original section content is preserved.");
