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
  let changedBounds = null;
  if (changedPixels > 0) {
    changedBounds = { left: before.width, top: before.height, right: -1, bottom: -1 };
    for (let y = 0; y < before.height; y += 1) {
      for (let x = 0; x < before.width; x += 1) {
        const offset = (y * before.width + x) * 4;
        const delta = Math.max(
          Math.abs(before.data[offset] - after.data[offset]),
          Math.abs(before.data[offset + 1] - after.data[offset + 1]),
          Math.abs(before.data[offset + 2] - after.data[offset + 2]),
          Math.abs(before.data[offset + 3] - after.data[offset + 3]),
        );
        if (delta <= threshold * 255) continue;
        changedBounds.left = Math.min(changedBounds.left, x);
        changedBounds.top = Math.min(changedBounds.top, y);
        changedBounds.right = Math.max(changedBounds.right, x);
        changedBounds.bottom = Math.max(changedBounds.bottom, y);
      }
    }
  }
  const sample = (image, x, y) => [...image.data.slice((y * image.width + x) * 4, (y * image.width + x) * 4 + 4)];
  const samplePoints = [[2, 2], [Math.floor(before.width / 2), 2], [before.width - 3, 2],
    [2, Math.floor(before.height / 2)], [Math.floor(before.width / 2), Math.floor(before.height / 2)],
    [before.width - 3, Math.floor(before.height / 2)], [2, before.height - 3],
    [Math.floor(before.width / 2), before.height - 3], [before.width - 3, before.height - 3]];
  const samples = samplePoints.map(([x, y]) => ({ x, y, before: sample(before, x, y), after: sample(after, x, y) }));
  const totalPixels = before.width * before.height;
  const changedRatio = changedPixels / totalPixels;
  const diffPath = path.join(currentDir, `volume-diff-${size}-${theme}.png`);
  fs.writeFileSync(diffPath, PNG.sync.write(diff));
  results.push({ size, theme, width: before.width, height: before.height, changedPixels, totalPixels, changedPercent: Number((changedRatio * 100).toFixed(3)), changedBounds, samples, diffPath });
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
  if (item.changedBounds && item.changedPixels / item.totalPixels > 0.025) {
    console.log(`${item.size}/${item.theme} changed-pixel bounds ${JSON.stringify(item.changedBounds)}; RGBA samples ${JSON.stringify(item.samples)}`);
  }
}
const outliers = results.filter((item) => item.changedPixels / item.totalPixels > maxChangedRatio);
assert.equal(outliers.length, 0, `volume Card screenshot changed more than ${maxChangedRatio * 100}% in: ${outliers.map((item) => `${item.size}/${item.theme}=${item.changedPercent}%`).join(", ")}`);
