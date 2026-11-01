import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "dist-beui");
const pages = ["index.html", "editor.html"];
const failures = [];

function checkLocalRef(pagePath, page, ref) {
  if (/^(?:https?:|data:|mailto:|tel:|#|javascript:)/i.test(ref)) return;
  const clean = decodeURIComponent(ref.split(/[?#]/, 1)[0]);
  const target = clean.startsWith("/") ? resolve(root, `.${clean}`) : resolve(dirname(pagePath), clean);
  if (!target.startsWith(root + sep) && target !== root) {
    failures.push(`Path escapes build output in ${page}: ${ref}`);
    return;
  }
  if (!existsSync(target)) failures.push(`Missing asset from ${page}: ${ref}`);
}

for (const page of pages) {
  const pagePath = resolve(root, page);
  if (!existsSync(pagePath)) {
    failures.push(`Missing built page: ${page}`);
    continue;
  }
  const html = readFileSync(pagePath, "utf8");
  const refs = [...html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]);
  for (const ref of refs) checkLocalRef(pagePath, page, ref);
}

/* The PWA manifest must keep its stable, root-relative URL. A fingerprinted copy under
   /assets/ breaks every relative icon path, so fail fast if that regresses. */
const editorPath = resolve(root, "editor.html");
if (existsSync(editorPath)) {
  const editorHtml = readFileSync(editorPath, "utf8");
  if (!/rel="manifest"\s+href="\.\/manifest\.webmanifest"/.test(editorHtml)) {
    failures.push("editor.html must link ./manifest.webmanifest, not a fingerprinted copy.");
  }
  if (/assets\/manifest-[^"']+\.webmanifest/.test(editorHtml)) {
    failures.push("editor.html still references a fingerprinted manifest.");
  }
}

const manifestPath = resolve(root, "manifest.webmanifest");
if (!existsSync(manifestPath)) {
  failures.push("Missing built manifest: manifest.webmanifest");
} else {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    failures.push(`manifest.webmanifest is not valid JSON: ${error.message}`);
  }
  if (manifest) {
    for (const icon of Array.isArray(manifest.icons) ? manifest.icons : []) {
      if (!icon || typeof icon.src !== "string") {
        failures.push("manifest.webmanifest contains an icon without a src.");
        continue;
      }
      checkLocalRef(manifestPath, "manifest.webmanifest", icon.src);
    }
    if (!manifest.start_url) failures.push("manifest.webmanifest must define start_url.");
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Production entry points, local assets, and PWA manifest are present and valid.");
