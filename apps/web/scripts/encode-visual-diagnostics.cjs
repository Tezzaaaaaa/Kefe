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
  const scale = Math.min(480 / source.width, 520 / source.height, 1);
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
  return jpeg.encode({ data, width, height }, 45).data.toString("base64");
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
fs.writeFileSync(outputPath, JSON.stringify(thumbnails));
console.log(`Encoded ${thumbnails.length} visual diagnostic thumbnails at ${outputPath}`);
