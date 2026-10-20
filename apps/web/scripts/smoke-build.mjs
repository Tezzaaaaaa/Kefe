import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "dist-beui");
const pages = ["index.html", "editor.html", "editor.beui.html", "beui.html"];
const failures = [];

for (const page of pages) {
  const pagePath = resolve(root, page);
  if (!existsSync(pagePath)) {
    failures.push(`Missing built page: ${page}`);
    continue;
  }
  const html = readFileSync(pagePath, "utf8");
  const refs = [...html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]);
  for (const ref of refs) {
    if (/^(?:https?:|data:|mailto:|tel:|#|javascript:)/i.test(ref)) continue;
    const clean = decodeURIComponent(ref.split(/[?#]/, 1)[0]);
    const target = clean.startsWith("/") ? resolve(root, `.${clean}`) : resolve(dirname(pagePath), clean);
    if (!target.startsWith(root + sep) && target !== root) {
      failures.push(`Path escapes build output in ${page}: ${ref}`);
      continue;
    }
    if (!existsSync(target)) failures.push(`Missing asset from ${page}: ${ref}`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Built entry points and their local assets are present.");
