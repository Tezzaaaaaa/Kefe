const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PNG } = require("pngjs");
const jpeg = require("jpeg-js");

const [baselineDir, currentDir, outputPath] = process.argv.slice(2);
assert.ok(baselineDir && currentDir && outputPath, "usage: encode-visual-diagnostics.cjs <baseline-dir> <current-dir> <output-json>");
const states = [["desktop", "night"], ["desktop", "day"], ["mobile", "night"], ["mobile", "day"]];

function findCapture(dir, size, theme) {
  const suffix = `-${size}-${theme}.png`;
  const matches = fs.readdirSync(dir).filter(name => name.startsWith("editor-") && !name.startsWith("editor-diff-") && name.endsWith(suffix));
  assert.equal(matches.length, 1, `expected one editor ${size}/${theme} screenshot in ${dir}, found ${matches.length}`);
  return path.join(dir, matches[0]);
}

function makeThumbnail(filename) {
  const source = PNG.sync.read(fs.readFileSync(filename));
  const scale = Math.min(160 / source.width, 200 / source.height, 1);
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const sy = Math.min(source.height - 1, Math.floor((y + 0.5) / scale));
    for (let x = 0; x < width; x += 1) {
      const sx = Math.min(source.width - 1, Math.floor((x + 0.5) / scale));
      const from = (sy * source.width + sx) * 4;
      const to = (y * width + x) * 4;
      data[to] = source.data[from];
      data[to + 1] = source.data[from + 1];
      data[to + 2] = source.data[from + 2];
      data[to + 3] = source.data[from + 3];
    }
  }
  return jpeg.encode({ data, width, height }, 20).data.toString("base64");
}

const thumbnails = [];
for (const [size, theme] of states) {
  const candidates = [
    ["baseline", findCapture(baselineDir, size, theme)],
    ["current", findCapture(currentDir, size, theme)],
    ["diff", path.join(currentDir, `editor-diff-${size}-${theme}.png`)],
  ];
  for (const [kind, filename] of candidates) {
    assert.ok(fs.existsSync(filename), `missing ${kind} image: ${filename}`);
    thumbnails.push({ key: `${size}-${theme}`, kind, jpegBase64: makeThumbnail(filename) });
  }
}
const regions = states.map(([size, theme]) => {
  const filename = path.join(currentDir, `editor-region-diagnostics-${size}-${theme}.json`);
  assert.ok(fs.existsSync(filename), `missing changed-region diagnostics: ${filename}`);
  const report = JSON.parse(fs.readFileSync(filename, "utf8"));
  const leafRegions = report.filter(item => !["kefe-editor", "kefe-panels", "kefe-panels-left", "kefe-panel", "kefe-settings-panel", "kefe-settings-columns", "kefe-settings-mount", "kefe-editing kefe-settings-layout"].includes(item.classes));
  return { key: `${size}-${theme}`, regions: leafRegions.slice(0, 10).map(({ changed, changedPercent, section, panel, tag, id, classes, text, bounds }) => ({ changed, changedPercent, section, panel, tag, id, classes, text, bounds })) };
});
const layoutPath = path.join(currentDir, "layout-comparison.json");
assert.ok(fs.existsSync(layoutPath), `missing baseline/current layout comparison: ${layoutPath}`);
const layout = JSON.parse(fs.readFileSync(layoutPath, "utf8")).map(({ size, counts, unmatchedCurrent, unmatchedBaseline, changes }) => ({
  size, counts, unmatchedCurrent, unmatchedBaseline,
  changes: changes.filter(item => item.tag === "select" || /kefe-(upload|sidebar|section|panel-action|section-heading|vis-tabs|toolbar)/.test(item.classes))
    .sort((a, b) => Object.keys(b.changedFields).length - Object.keys(a.changedFields).length)
    .slice(0, 8)
    .map(({ key, section, panel, tag, classes, changedFields }) => ({
      key, section, panel, tag, classes,
      changedFields: Object.fromEntries(Object.entries(changedFields).filter(([field]) => ["x", "y", "width", "height", "display", "color", "background", "fontWeight", "lineHeight", "border", "radius", "padding", "gap", "gridTemplateColumns", "overflow"].includes(field))),
    })),
}));
fs.writeFileSync(outputPath, JSON.stringify({ thumbnails, regions, layout }));
console.log(`Encoded ${thumbnails.length} visual thumbnails, ${regions.length} region reports, and ${layout.length} layout reports at ${outputPath}`);
