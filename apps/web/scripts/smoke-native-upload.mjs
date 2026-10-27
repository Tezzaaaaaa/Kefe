import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const entry = readFileSync(resolve(root, "editor.source.html"), "utf8");
const structure = readFileSync(resolve(root, "app/ui/structure.js"), "utf8");
const editorRuntime = readFileSync(resolve(root, "app/editor.js"), "utf8");
const editorStyles = readFileSync(resolve(root, "app/ui/styles.css"), "utf8");
const compactStyles = readFileSync(resolve(root, "app/ui/panels-compact.css"), "utf8");
const bridgeStyles = readFileSync(resolve(root, "beui-src/legacy-bridge.css"), "utf8");
const failures = [];

if (entry.includes("legacy-upload-card-bridge")) failures.push("Editor entry still loads the upload Card bridge");
if (existsSync(resolve(root, "beui-src/legacy-upload-card-bridge.jsx"))) failures.push("Retired upload Card bridge source remains");
if (!structure.includes("kefeUploadZone") || !structure.includes("mediaInput") || !structure.includes("kefe-upload-title")) {
  failures.push("Native upload label, file input, or title are missing from KEFE structure");
}
for (const event of ["dragover", "dragleave", "drop"]) {
  if (!editorRuntime.includes(`addEventListener('${event}'`)) failures.push(`Native upload ${event} handler is missing`);
}
if (!editorStyles.includes(".kefe-upload-zone.beui-upload-dropzone") ||
    !editorStyles.includes(".kefe-upload-zone.beui-upload-dropzone:focus-within") ||
    !editorStyles.includes(".kefe-upload-zone.beui-upload-dropzone.is-dragging")) {
  failures.push("Native upload surface, focus, or drag-over styling is missing");
}
for (const retiredClass of ["beui-upload-card-hosted", "beui-upload-card-root", "beui-upload-card"]) {
  if (editorStyles.includes(retiredClass) || compactStyles.includes(retiredClass) || bridgeStyles.includes(retiredClass)) {
    failures.push(`Styles still depend on retired upload Card wrapper class ${retiredClass}`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("PASS: native upload label/file input and KEFE picker/drop handlers own the upload surface; React Card wrapper source/styles are retired.");
