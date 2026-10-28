const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const [baselineDir, currentDir] = process.argv.slice(2);
assert.ok(baselineDir && currentDir, "usage: compare-layout-inventories.cjs <baseline-dir> <current-dir>");

const fields = ["x", "y", "width", "height", "display", "position", "boxSizing", "color", "background", "boxShadow", "opacity", "font", "fontWeight", "lineHeight", "letterSpacing", "textTransform", "alignItems", "justifyContent", "overflow", "gridTemplateColumns", "border", "radius", "padding", "margin", "gap", "minWidth", "minHeight", "maxWidth", "maxHeight"];
const geometryFields = new Set(["x", "y", "width", "height"]);
const summaries = [];
const normalize = (item) => {
  if (item.id) return `#${item.id}`;
  const stateClasses = item.classes.split(" ").filter(name => name && !["active", "collapsed", "selected"].includes(name)).join(" ");
  if (item.tag === "section" && item.section) return `section:${item.section}:${stateClasses}`;
  if (item.panel) return `panel:${item.panel}:${item.tag}:${stateClasses}`;
  if (item.section) return `section:${item.section}:${item.tag}:${stateClasses}`;
  return `${item.tag}:${stateClasses}`;
};
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

for (const size of ["desktop", "mobile"]) {
  const before = JSON.parse(fs.readFileSync(path.join(baselineDir, `editor-layout-${size}-day.json`), "utf8"));
  const after = JSON.parse(fs.readFileSync(path.join(currentDir, `editor-layout-${size}-day.json`), "utf8"));
  const oldMap = grouped(before);
  const newMap = grouped(after);
  const changes = [];
  for (const [key, oldItems] of oldMap) {
    const newItems = newMap.get(key) || [];
    for (let index = 0; index < Math.min(oldItems.length, newItems.length); index += 1) {
      const oldItem = oldItems[index];
      const newItem = newItems[index];
      if (newItem.classes.includes("kefe-liquid-swirl")) continue;
      const changedFields = {};
      for (const field of fields) {
        const oldValue = oldItem[field];
        const newValue = newItem[field];
        if (geometryFields.has(field)) {
          if (Math.abs(oldValue - newValue) > 0.75) changedFields[field] = [Number(oldValue.toFixed(2)), Number(newValue.toFixed(2))];
        } else if (oldValue !== newValue) {
          changedFields[field] = [oldValue, newValue];
        }
      }
      if (Object.keys(changedFields).length) changes.push({ key, id: newItem.id, path: newItem.path, section: newItem.section, panel: newItem.panel, tag: newItem.tag, classes: newItem.classes, changedFields });
    }
  }
  const unmatchedBaseline = [...oldMap].reduce((sum, [key, items]) => sum + Math.max(0, items.length - (newMap.get(key)?.length || 0)), 0);
  const unmatchedCurrent = [...newMap].reduce((sum, [key, items]) => sum + Math.max(0, items.length - (oldMap.get(key)?.length || 0)), 0);
  const counts = {};
  for (const change of changes) for (const field of Object.keys(change.changedFields)) counts[field] = (counts[field] || 0) + 1;
  const unmatchedKeys = (source, target) => [...source].flatMap(([key, items]) => Array(Math.max(0, items.length - (target.get(key)?.length || 0))).fill(key));
  const missingCurrent = unmatchedKeys(newMap, oldMap).slice(0, 4);
  const missingBaseline = unmatchedKeys(oldMap, newMap).slice(0, 4);
  summaries.push({ size, counts, unmatchedCurrent, unmatchedBaseline, changes });
  console.log(`${size}/day DOM diff: ${changes.length} matched elements; fields=${JSON.stringify(counts)}; unmatched current/baseline=${unmatchedCurrent}/${unmatchedBaseline}; samples=${JSON.stringify({current: missingCurrent, baseline: missingBaseline})}`);
  const relevant = changes.filter(item => item.section === "media" || item.panel === "media")
    .sort((a, b) => Object.keys(b.changedFields).length - Object.keys(a.changedFields).length);
  for (const item of relevant.slice(0, 8)) {
    console.log(JSON.stringify({ section: item.section, panel: item.panel, tag: item.tag, classes: item.classes, fields: item.changedFields }));
  }
  const effectControls = changes.filter(item =>
    /kefe-(?:lyric-effects-control|lyric-effect-option|lyric-effect-sample|lyric-effect-name|background-effect-control|font-selector-control)/.test(item.classes)
  );
  console.log(`${size}/day lyric-effect control style/geometry differences: ${effectControls.length}`);
  for (const item of effectControls.slice(0, 16)) {
    console.log(`KEFE_EFFECT_CONTROL_DIFF:${JSON.stringify({ section: item.section, panel: item.panel, tag: item.tag, id: item.id, classes: item.classes, fields: item.changedFields })}`);
  }
  const isEffectControl = item => /kefe-(?:lyric-effects-control|lyric-effect-option|lyric-effect-sample|lyric-effect-name|background-effect-control|font-selector-control)/.test(item.path);
  const unmatchedEffectCurrent = [...newMap].flatMap(([key, items]) => items.slice(Math.min(items.length, oldMap.get(key)?.length || 0))).filter(isEffectControl);
  const unmatchedEffectBaseline = [...oldMap].flatMap(([key, items]) => items.slice(Math.min(items.length, newMap.get(key)?.length || 0))).filter(isEffectControl);
  console.log(`${size}/day unmatched lyric-effect descendants current/baseline: ${unmatchedEffectCurrent.length}/${unmatchedEffectBaseline.length}`);
  for (const [side, items] of [["current", unmatchedEffectCurrent], ["baseline", unmatchedEffectBaseline]]) {
    for (const item of items.slice(0, 12)) {
      console.log(`KEFE_EFFECT_UNMATCHED:${JSON.stringify({ side, tag: item.tag, id: item.id, classes: item.classes, text: item.text,
        bounds: [Number(item.x.toFixed(2)), Number(item.y.toFixed(2)), Number(item.width.toFixed(2)), Number(item.height.toFixed(2))],
        display: item.display, color: item.color, background: item.background, border: item.border, padding: item.padding })}`);
    }
  }
  const visualRootChanges = changes.filter(item => item.section === "media" || item.section === "lyric-effects")
    .sort((a, b) => {
      const priority = item => /kefe-form|kefe-slot|content-inner|section-content|kefe-panel-head|kefe-settings-embedded-panel/.test(item.classes)
        ? 0 : /kefe-(?:lyric-effects-control|lyric-effect-option|font-selector-control)|kefe-upload/.test(item.classes) ? 1 : 2;
      return priority(a) - priority(b) || Object.keys(b.changedFields).length - Object.keys(a.changedFields).length;
    });
  for (const item of visualRootChanges.slice(0, 14)) {
    console.log(`KEFE_VISUAL_LAYOUT_DIFF:${JSON.stringify({ key: item.key, section: item.section, panel: item.panel, tag: item.tag, id: item.id,
      classes: item.classes, fields: item.changedFields })}`);
  }
}
fs.writeFileSync(path.join(currentDir, "layout-comparison.json"), JSON.stringify(summaries));
