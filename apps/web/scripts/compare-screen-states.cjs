const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const [baselineDir, currentDir] = process.argv.slice(2);
assert.ok(baselineDir && currentDir, "usage: compare-screen-states.cjs <baseline-dir> <current-dir>");

function signature(node) {
  if (node.id) return `#${node.id}`;
  return [node.tag, node.classes, node.section, node.group, node.panel].join("|");
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
  console.log(`${size}/day: viewport ${JSON.stringify(before.viewport)} → ${JSON.stringify(after.viewport)}; window scroll ${JSON.stringify(before.windowScroll)} → ${JSON.stringify(after.windowScroll)}; active ${before.activeSection} → ${after.activeSection}; expanded ${JSON.stringify(before.expandedSettings)} → ${JSON.stringify(after.expandedSettings)}`);
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
        if (Object.keys(fields).length) changes.push({ key, oldNode, newNode, fields });
      }
    }
    changes.sort((a, b) => Math.max(...Object.values(b.fields).map(v => Math.abs(v[1] - v[0])))
      - Math.max(...Object.values(a.fields).map(v => Math.abs(v[1] - v[0]))));
    const unmatchedBefore = [...oldMap].reduce((n, [key, items]) => n + Math.max(0, items.length - (newMap.get(key)?.length || 0)), 0);
    const unmatchedAfter = [...newMap].reduce((n, [key, items]) => n + Math.max(0, items.length - (oldMap.get(key)?.length || 0)), 0);
    console.log(`${collection}: ${changes.length} matched geometry/scroll differences; unmatched current/baseline=${unmatchedAfter}/${unmatchedBefore}`);
    for (const change of changes.slice(0, 8)) {
      console.log(JSON.stringify({ key: change.key, fields: change.fields,
        baseline: { bounds: [change.oldNode.x, change.oldNode.y, change.oldNode.width, change.oldNode.height], scrollTop: change.oldNode.scrollTop, scrollHeight: change.oldNode.scrollHeight, clientHeight: change.oldNode.clientHeight },
        current: { bounds: [change.newNode.x, change.newNode.y, change.newNode.width, change.newNode.height], scrollTop: change.newNode.scrollTop, scrollHeight: change.newNode.scrollHeight, clientHeight: change.newNode.clientHeight } }));
    }
  }
}
