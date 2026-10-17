import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(webRoot, "dist-beui");
mkdirSync(output, { recursive: true });

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
