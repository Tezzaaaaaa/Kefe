const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PNG } = require("pngjs");
const pixelmatch = require("pixelmatch");

const [baselineDir, currentDir] = process.argv.slice(2);
assert.ok(baselineDir && currentDir, "usage: compare-visual-screenshots.cjs <baseline-dir> <current-dir>");

const states = [
  ["desktop", "night"],
  ["desktop", "day"],
  ["mobile", "night"],
  ["mobile", "day"],
];
const threshold = 0.12;
const maxChangedRatio = 0.025;
const results = [];

function findCapture(dir, size, theme) {
  const suffix = `-${size}-${theme}.png`;
  const matches = fs.readdirSync(dir).filter((name) => name.startsWith("volume-card-") && name.endsWith(suffix));
  assert.equal(matches.length, 1, `expected one ${size}/${theme} volume screenshot in ${dir}, found ${matches.length}`);
  return path.join(dir, matches[0]);
}

for (const [size, theme] of states) {
  const before = PNG.sync.read(fs.readFileSync(findCapture(baselineDir, size, theme)));
  const after = PNG.sync.read(fs.readFileSync(findCapture(currentDir, size, theme)));
  assert.equal(after.width, before.width, `${size}/${theme} component width changed (${before.width} → ${after.width})`);
  assert.equal(after.height, before.height, `${size}/${theme} component height changed (${before.height} → ${after.height})`);

  const diff = new PNG({ width: before.width, height: before.height });
  const changedPixels = pixelmatch(before.data, after.data, diff.data, before.width, before.height, {
    threshold,
    includeAA: false,
    diffColor: [255, 30, 30],
    aaColor: [255, 200, 0],
  });
  const totalPixels = before.width * before.height;
  const changedRatio = changedPixels / totalPixels;
  const diffPath = path.join(currentDir, `volume-diff-${size}-${theme}.png`);
  fs.writeFileSync(diffPath, PNG.sync.write(diff));
  results.push({ size, theme, width: before.width, height: before.height, changedPixels, totalPixels, changedPercent: Number((changedRatio * 100).toFixed(3)), diffPath });
}

const lines = [
  "### Volume Card screenshot comparison",
  "Compared Playwright component crops against the previous successful run; pixel threshold 0.12, antialias-only changes ignored, maximum changed-pixel budget 2.5%.",
  "",
  "| Viewport | Theme | Size | Changed pixels |",
  "|---|---|---:|---:|",
  ...results.map((item) => `| ${item.size} | ${item.theme} | ${item.width}×${item.height} | ${item.changedPercent}% (${item.changedPixels}/${item.totalPixels}) |`),
  "",
  "Diff images are included in the screenshot artifact for review.",
  "",
];
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n"));
for (const item of results) {
  console.log(`${item.size}/${item.theme}: ${item.changedPercent}% changed (${item.changedPixels}/${item.totalPixels}); ${item.diffPath}`);
}
const outliers = results.filter((item) => item.changedPixels / item.totalPixels > maxChangedRatio);
assert.equal(outliers.length, 0, `volume Card screenshot changed more than ${maxChangedRatio * 100}% in: ${outliers.map((item) => `${item.size}/${item.theme}=${item.changedPercent}%`).join(", ")}`);
