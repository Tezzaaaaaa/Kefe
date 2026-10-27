const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const [baselineDir, currentDir] = process.argv.slice(2);
assert.ok(baselineDir && currentDir, "usage: compare-layout-inventories.cjs <baseline-dir> <current-dir>");

const fields = ["x", "y", "width", "height", "display", "position", "boxSizing", "color", "background", "font", "lineHeight", "border", "radius", "padding", "gap"];
const normalize = (item) => {
  if (item.id) return `#${item.id}`;
  return [item.section, item.panel, item.tag, item.classes, item.text].join("|");
};

for (const size of ["desktop", "mobile"]) {
  const before = JSON.parse(fs.readFileSync(path.join(baselineDir, `editor-layout-${size}-day.json`), "utf8"));
  const after = JSON.parse(fs.readFileSync(path.join(currentDir, `editor-layout-${size}-day.json`), "utf8"));
  const grouped = (items) => {
    const map = new Map();
    for (const item of items) {
      const key = normalize(item);
      const entries = map.get(key) || [];
      entries.push(item);
      map.set(key, entries);
    }
    return map;
  };
  const oldMap = grouped(before);
  const newMap = grouped(after);
  const changes = [];
  for (const [key, oldItems] of oldMap) {
    const newItems = newMap.get(key) || [];
    for (let index = 0; index < Math.min(oldItems.length, newItems.length); index += 1) {
      const oldItem = oldItems[index];
      const newItem = newItems[index];
      const changedFields = {};
      for (const field of fields) {
        const oldValue = oldItem[field];
        const newValue = newItem[field];
        if (["x", "y", "width", "height"].includes(field)) {
          if (Math.abs(oldValue - newValue) > 0.75) changedFields[field] = [Number(oldValue.toFixed(2)), Number(newValue.toFixed(2))];
        } else if (oldValue !== newValue) {
          changedFields[field] = [oldValue, newValue];
        }
      }
      if (Object.keys(changedFields).length) {
        changes.push({ key, section: newItem.section, panel: newItem.panel, text: newItem.text, path: newItem.path, changedFields });
      }
    }
  }
  console.log(`DOM computed-style/layout differences in ${size}/day (same stable selectors matched by order): ${changes.length}`);
  for (const change of changes.slice(0, 50)) console.log(JSON.stringify(change));
  const unmatchedBaseline = [...oldMap].reduce((sum, [key, items]) => sum + Math.max(0, items.length - (newMap.get(key)?.length || 0)), 0);
  const unmatchedCurrent = [...newMap].reduce((sum, [key, items]) => sum + Math.max(0, items.length - (oldMap.get(key)?.length || 0)), 0);
  console.log(`Unmatched current/baseline element signatures: ${unmatchedCurrent}/${unmatchedBaseline}`);
}
