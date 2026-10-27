import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const editor = readFileSync(resolve(root, "editor.source.html"), "utf8");
const structure = readFileSync(resolve(root, "app/ui/structure.js"), "utf8");
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
for (const retiredClass of [
  "beui-native-input", "beui-native-textarea", "beui-native-checkbox",
  "beui-native-checkbox-label", "beui-input-host", "beui-textarea-host", "beui-checkbox-host",
  "beui-checkbox-control", "beui-textarea-control", "beui-input-control",
]) {
  if (editorStyles.includes(retiredClass) || compactStyles.includes(retiredClass)) {
    failures.push(`Native styles still depend on retired mirrored-control class ${retiredClass}`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("PASS: editor text inputs, lyric textarea, and checkboxes remain directly KEFE-owned; mirrored React controls and their source styles are retired.");
