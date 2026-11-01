import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(webRoot, "dist-beui");
mkdirSync(output, { recursive: true });

// Publish one editor page from the source template; do not ship the template as a second page.
const editorSource = resolve(output, "editor.source.html");
const editorPage = resolve(output, "editor.html");
cpSync(editorSource, editorPage, { force: true });
unlinkSync(editorSource);

/* Vite fingerprints every linked manifest and rewrites the href to
   `./assets/manifest-<hash>.webmanifest`. The manifest's icon URLs are relative to its
   own location, so from `/assets/` they resolve to missing `/assets/app/brand/*` files.
   Restore the stable root link (the manifest is copied to the build root below) and
   remove the unusable hashed duplicate. */
let editorHtml = readFileSync(editorPage, "utf8");
const hashedManifest = /href="\.\/assets\/manifest-[^"]+\.webmanifest"/.exec(editorHtml);
if (!hashedManifest) {
  throw new Error("Expected Vite to emit a fingerprinted manifest link in editor.html.");
}
editorHtml = editorHtml.replace(hashedManifest[0], 'href="./manifest.webmanifest"');
writeFileSync(editorPage, editorHtml);

const assetsDir = resolve(output, "assets");
if (existsSync(assetsDir)) {
  for (const file of readdirSync(assetsDir)) {
    if (/^manifest-[^.]+\.webmanifest$/.test(file)) unlinkSync(resolve(assetsDir, file));
  }
}

for (const entry of ["app", "fonts", "legal"]) {
  const source = resolve(webRoot, entry);
  if (existsSync(source)) {
    cpSync(source, resolve(output, entry), { recursive: true, force: true });
  }
}

for (const file of [
  "apple-lyrics-standalone.html",
  "workspace.html",
  "manifest.webmanifest",
  "sw.js",
]) {
  const source = resolve(webRoot, file);
  if (existsSync(source)) {
    cpSync(source, resolve(output, file), { force: true });
  }
}
