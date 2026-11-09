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

for (const entry of ["app", "fonts"]) {
  const source = resolve(webRoot, entry);
  if (existsSync(source)) {
    cpSync(source, resolve(output, entry), { recursive: true, force: true });
  }
}

// The standalone demo is built from its source template at its public URL.
const standaloneSource = resolve(output, "apple-lyrics-standalone.source.html");
cpSync(standaloneSource, resolve(output, "apple-lyrics-standalone.html"), { force: true });
unlinkSync(standaloneSource);

// Legal pages are built from legal-src; publish them at their stable public URLs.
const legalOutput = resolve(output, "legal");
mkdirSync(legalOutput, { recursive: true });
for (const page of ["privacy.html", "terms.html"]) {
  cpSync(resolve(output, "legal-src", page), resolve(legalOutput, page), { force: true });
  unlinkSync(resolve(output, "legal-src", page));
}

for (const file of [
  "workspace.html",
  "manifest.webmanifest",
  "sw.js",
]) {
  const source = resolve(webRoot, file);
  if (existsSync(source)) {
    cpSync(source, resolve(output, file), { force: true });
  }
}
