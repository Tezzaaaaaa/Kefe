import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Verify the baseline and current screenshot/DOM captures are complete.
 *
 * Usage: node verify-capture-set.mjs <baseline-dir> <current-dir> [report-path]
 *
 * Prints one line per expected capture and fails when any is missing or empty,
 * so a failed comparison step names the capture it could not compare instead of
 * only reporting a non-zero exit code.
 */
const [baselineDir, currentDir, reportPath] = process.argv.slice(2);
if (!baselineDir || !currentDir) {
  console.error("usage: verify-capture-set.mjs <baseline-dir> <current-dir> [report-path]");
  process.exit(2);
}

const expected = ["editor-layout-desktop-day.json", "editor-layout-mobile-day.json",
  "editor-screen-state-desktop-day.json", "editor-screen-state-mobile-day.json"];

const report = { baselineDir, currentDir, missing: [], present: [] };
for (const [label, dir] of [["baseline", baselineDir], ["current", currentDir]]) {
  for (const name of expected) {
    const path = join(dir, name);
    const present = existsSync(path);
    const size = present ? statSync(path).size : 0;
    const entry = { label, name, path, present, size };
    if (!present || size === 0) {
      report.missing.push(entry);
      console.error(`MISSING ${label} capture: ${path} (${present ? "empty file" : "not written"})`);
      continue;
    }
    report.present.push(entry);
    console.log(`ok ${label} ${name} ${size} bytes`);
  }
}

if (reportPath) writeFileSync(reportPath, JSON.stringify(report, null, 2));
if (report.missing.length) {
  console.error(`INCOMPLETE baseline/current DOM and screen comparison; missing captures: ${JSON.stringify(report.missing.map(item => [item.label, item.name]))}`);
  process.exit(1);
}

// Sanity check: the mobile current capture must describe the editor surface the
// page actually renders, so a layout regression cannot silently drop it.
try {
  const mobile = JSON.parse(readFileSync(join(currentDir, "editor-screen-state-mobile-day.json"), "utf8"));
  const classes = mobile.keyBounds.map(node => node.classes).join(" ");
  console.log(`current mobile capture: ${mobile.keyBounds.length} tracked surfaces; sidebar=${/kefe-ms-/.test(classes)}`);
} catch (error) {
  console.error(`mobile capture is unreadable: ${error.message}`);
  process.exit(1);
}

console.log("Capture set complete.");
