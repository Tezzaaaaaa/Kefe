const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const [baselineDir, currentDir] = process.argv.slice(2);
assert.ok(baselineDir && currentDir, "usage: compare-screen-states.cjs <baseline-dir> <current-dir>");

function signature(node) {
  return [node.id, node.classes, node.text].join("|");
}
function index(nodes) {
  const result = new Map();
  for (const node of nodes) {
    const key = signature(node);
    const entries = result.get(key) || [];
    entries.push(node);
    result.set(key, entries);
  }
  return result;
}

for (const size of ["desktop", "mobile"]) {
  const before = JSON.parse(fs.readFileSync(path.join(baselineDir, `editor-screen-state-${size}-day.json`), "utf8"));
  const after = JSON.parse(fs.readFileSync(path.join(currentDir, `editor-screen-state-${size}-day.json`), "utf8"));
  console.log(`${size}/day: viewport=${JSON.stringify(before.viewport)}→${JSON.stringify(after.viewport)}, window-scroll=${JSON.stringify(before.windowScroll)}→${JSON.stringify(after.windowScroll)}, active=${before.activeSection}→${after.activeSection}, expanded=${JSON.stringify(before.expandedSettings)}→${JSON.stringify(after.expandedSettings)}`);
  for (const collection of ["keyBounds", "scrollables"]) {
    const oldMap = index(before[collection]);
    const newMap = index(after[collection]);
    const changes = [];
    for (const [key, oldItems] of oldMap) {
      const newItems = newMap.get(key) || [];
      for (let i = 0; i < Math.min(oldItems.length, newItems.length); i += 1) {
        const oldNode = oldItems[i];
        const newNode = newItems[i];
        const fields = {};
        for (const field of ["x", "y", "width", "height", "scrollTop", "scrollLeft", "scrollHeight", "clientHeight"]) {
          if (Math.abs((oldNode[field] || 0) - (newNode[field] || 0)) > 0.75) fields[field] = [oldNode[field], newNode[field]];
        }
        if (Object.keys(fields).length) changes.push({ key, old: oldNode, current: newNode, fields });
      }
    }
    changes.sort((a, b) => Object.keys(b.fields).length - Object.keys(a.fields).length);
    console.log(`${collection} changed matches=${changes.length}; unmatched baseline/current=${[...oldMap].reduce((n, [key, a]) => n + Math.max(0, a.length - (newMap.get(key)?.length || 0)), 0)}/${[...newMap].reduce((n, [key, a]) => n + Math.max(0, a.length - (oldMap.get(key)?.length || 0)), 0)}`);
    for (const change of changes.slice(0, 20)) console.log(JSON.stringify({ key: change.key, fields: change.fields, baseline: change.old, current: change.current }));
  }
}
