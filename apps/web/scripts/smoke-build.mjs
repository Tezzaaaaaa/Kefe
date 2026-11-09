import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "dist-beui");
const pages = ["index.html", "editor.html", "legal/privacy.html", "legal/terms.html", "apple-lyrics-standalone.html"];
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
// Verify that optional Web Audio analysis/export APIs cannot silence the media element.
{
  const audio = {};
  const destination = {};
  const connected = [];
  let sourceCreations = 0;
  class MockAudioContext {
    constructor() { this.destination = destination; }
    createMediaElementSource() {
      sourceCreations++;
      return { connect(node) { connected.push(node); } };
    }
    createAnalyser() { throw new Error("analysis unavailable"); }
    createMediaStreamDestination() { throw new Error("stream capture unavailable"); }
  }
  const mockWindow = {
    AudioContext: MockAudioContext,
    get kefeSettings() { return null; },
    document: null,
  };
  const sandbox = {
    window: mockWindow,
    console: { warn() {} },
    document: { getElementById(id) { return id === "kefeAudio" ? audio : null; } },
  };
  runInNewContext(
    readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../app/visualiser/audio-overlay.js"), "utf8"),
    sandbox,
  );
  const first = mockWindow.kefeAudioGraph.ensure();
  const second = mockWindow.kefeAudioGraph.ensure();
  if (!first || first.analyser !== null || first.stream !== null || !connected.includes(destination)) {
    failures.push("Audio graph must route media to speakers before optional analysis/export setup.");
  }
  if (first !== second || sourceCreations !== 1) {
    failures.push("Audio graph must reuse one MediaElementSource for the player.");
  }
}
// Exercise the lyric sync quality report with deterministic synthetic word timings.
await import("../app/lyrics/auto-sync.js");
const autoSync = globalThis.kefeAutoSync;
if (!autoSync || typeof autoSync.align !== "function" || typeof autoSync.validateReport !== "function") {
  failures.push("Lyric auto-sync must expose align() and validateReport().");
} else {
  const outOfWindow = autoSync.align(
    [{ text: "one", start: 10, end: 10.4 }, { text: "two", start: 10.5, end: 10.9 }],
    "one two",
    { wordTimings: [10, 1] },
  );
  if (outOfWindow.matched !== 1 || outOfWindow.recognized !== 2) {
    failures.push("Lyric sync must count only word timestamps actually emitted, not rejected out-of-window timestamps.");
  }
  const outOfWindowReport = autoSync.validateReport(outOfWindow);
  if (outOfWindowReport.measuredWords !== 1 || outOfWindowReport.estimatedWords !== 1) {
    failures.push("Lyric sync quality report must distinguish measured and estimated word timings.");
  }
  const weakMatch = autoSync.align([{ text: "bna", start: 2, end: 2.5 }], "banana");
  const weakMatchReport = autoSync.validateReport(weakMatch);
  if (weakMatchReport.lowMatchWords !== 1) {
    failures.push("Lyric sync quality report must flag weak lyric-to-recognition text matches.");
  }
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Production entry points, local assets, and PWA manifest are present and valid.");
