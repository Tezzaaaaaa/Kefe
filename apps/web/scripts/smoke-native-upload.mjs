import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const entry = readFileSync(resolve(root, "editor.source.html"), "utf8");
const structure = readFileSync(resolve(root, "app/ui/structure.js"), "utf8");
const editorRuntime = readFileSync(resolve(root, "app/editor.js"), "utf8");
const editorStyles = readFileSync(resolve(root, "app/ui/styles.css"), "utf8");
const compactStyles = readFileSync(resolve(root, "app/ui/panels-compact.css"), "utf8");
const shadStyles = readFileSync(resolve(root, "beui-src/shadcn-kefe.css"), "utf8");
const backgroundRuntime = readFileSync(resolve(root, "app/visualiser/background.js"), "utf8");
const mediaRuntime = readFileSync(resolve(root, "app/media-carousel.js"), "utf8");
const failures = [];

if (entry.includes("legacy-upload-card-bridge")) failures.push("Editor entry still loads the upload Card bridge");
if (existsSync(resolve(root, "beui-src/legacy-upload-card-bridge.jsx"))) failures.push("Retired upload Card bridge source remains");
if (!structure.includes("kefeUploadZone") || !structure.includes("mediaInput") || !structure.includes("kefe-upload-title") || !structure.includes("kefe-upload-card")) {
  failures.push("Native upload label, inner Card, file input, or title are missing from KEFE structure");
}
for (const event of ["dragover", "dragleave", "drop"]) {
  if (!editorRuntime.includes(`addEventListener('${event}'`)) failures.push(`Native upload ${event} handler is missing`);
}
if (!editorStyles.includes("#kefeUploadZone.shad-dropzone") ||
    !editorStyles.includes("#kefeUploadZone.shad-dropzone:focus-within") ||
    !editorStyles.includes("#kefeUploadZone.shad-dropzone.is-dragging .kefe-upload-card") ||
    !shadStyles.includes(".shad-dropzone[data-slot=\"dropzone\"]")) {
  failures.push("Upload Dropzone surface, focus, or drag-over styling is missing");
}
for (const retiredClass of ["beui-upload-card-hosted", "beui-upload-card-root", "beui-upload-card"]) {
  if (editorStyles.includes(retiredClass) || compactStyles.includes(retiredClass) || shadStyles.includes(retiredClass)) {
    failures.push(`Styles still depend on retired upload Card wrapper class ${retiredClass}`);
  }
}

if (!backgroundRuntime.includes('id="kefeBgVideoZone"') || !backgroundRuntime.includes('id="bgVideoInput"')) {
  failures.push("Optional background-video picker or its file input is missing");
}
if (!mediaRuntime.includes("uploads.appendChild(zone)") || !mediaRuntime.includes("uploads.appendChild(bgWrap)")) {
  failures.push("Audio and background-video upload controls are not grouped together in Media");
}
if (!compactStyles.includes("grid-template-columns: repeat(2, minmax(0, 1fr)) !important") ||
    !compactStyles.includes("height: 96px !important") ||
    !compactStyles.includes("#kefeBgVideoZone")) {
  failures.push("Audio and background-video upload cards must remain side by side at a compact fixed height");
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("PASS: primary and background-video upload Dropzones keep native inputs, drag/drop handlers, and paired layout.");
