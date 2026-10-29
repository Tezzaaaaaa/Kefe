const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const [baselineDir, currentDir] = process.argv.slice(2);
assert.ok(baselineDir && currentDir, "usage: compare-screen-states.cjs <baseline-dir> <current-dir>");

function signature(node) {
  if (node.id) return `#${node.id}`;
  if (node.panel) return [node.tag, node.section, node.group, node.panel].join("|");
  if (node.section) return [node.tag, node.section, node.group].join("|");
  return [node.tag, node.group].join("|");
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

const carouselGeometryMismatches = [];

for (const size of ["desktop", "mobile"]) {
  const before = JSON.parse(fs.readFileSync(path.join(baselineDir, `editor-screen-state-${size}-day.json`), "utf8"));
  const after = JSON.parse(fs.readFileSync(path.join(currentDir, `editor-screen-state-${size}-day.json`), "utf8"));
  console.log(`${size}/day: viewport ${JSON.stringify(before.viewport)} → ${JSON.stringify(after.viewport)}; window scroll ${JSON.stringify(before.windowScroll)} → ${JSON.stringify(after.windowScroll)}; active ${before.activeSection} → ${after.activeSection}; expanded ${JSON.stringify(before.expandedSettings)} → ${JSON.stringify(after.expandedSettings)}`);
  for (const [label, state] of [["baseline", before], ["current", after]]) {
    const carousel = state.keyBounds.find(node => node.id === "kefeCarStack");
    const findInput = state.keyBounds.find(node => node.id === "kefeFindInput");
    const findStatus = state.keyBounds.find(node => node.id === "kefeFindStatus");
    const details = carousel ? {
      count: carousel.renderedCardCount,
      domChildCount: carousel.childCount,
      bounds: [carousel.x, carousel.y, carousel.width, carousel.height],
      scroll: { left: carousel.scrollLeft, width: carousel.scrollWidth, clientWidth: carousel.clientWidth },
      children: (carousel.carouselChildren || []).map(child => ({
        index: child.index, tag: child.tag, id: child.id, classes: child.classes,
        dataIndex: child.dataIndex, ariaLabel: child.ariaLabel, ariaPressed: child.ariaPressed,
        tabIndex: child.tabIndex, text: child.text, display: child.display, visibility: child.visibility,
        bounds: child.bounds, contentGeometry: child.contentGeometry,
      })),
      omittedChildren: Math.max(0, carousel.renderedCardCount - (carousel.carouselChildren || []).length),
      findInput: findInput ? { value: findInput.value, bounds: [findInput.x, findInput.y, findInput.width, findInput.height] } : null,
      findStatus: findStatus ? { text: findStatus.text, bounds: [findStatus.x, findStatus.y, findStatus.width, findStatus.height] } : null,
    } : null;
    console.log(`${size}/day carousel child state ${label}: ${JSON.stringify(details)}`);
    assert.ok(details, `${label} ${size}/day carousel capture is missing`);
    assert.equal(details.count, 1, `${label} ${size}/day carousel should contain exactly one fixture card: ${JSON.stringify(details)}`);
    assert.equal(details.omittedChildren, 0, `${label} ${size}/day carousel child capture is incomplete: ${JSON.stringify(details)}`);
    assert.equal(details.children.length, 1, `${label} ${size}/day carousel child identity is missing: ${JSON.stringify(details)}`);
    const child = details.children[0];
    assert.equal(child.tag, "button", `${label} ${size}/day carousel item should be the real button card: ${JSON.stringify(child)}`);
    assert.ok(child.classes.split(/\s+/).includes("kefe-car-card"), `${label} ${size}/day carousel card class is missing: ${JSON.stringify(child)}`);
    assert.equal(child.dataIndex, "0", `${label} ${size}/day carousel card index is not stable: ${JSON.stringify(child)}`);
    assert.equal(child.ariaLabel, "KEFE visual regression fixture by KEFE browser smoke",
      `${label} ${size}/day carousel card accessible identity differs: ${JSON.stringify(child)}`);
    assert.equal(child.ariaPressed, "true", `${label} ${size}/day selected carousel card state is missing: ${JSON.stringify(child)}`);
    assert.ok(!child.hidden && child.display !== "none" && child.visibility !== "hidden"
      && child.bounds.length === 4 && child.bounds.every(Number.isFinite)
      && child.bounds[2] > 0 && child.bounds[3] > 0,
    `${label} ${size}/day carousel card is not visibly rendered with complete geometry: ${JSON.stringify(child)}`);
    assert.ok(child.text.includes("KEFE visual regression fixture") && child.text.includes("KEFE browser smoke"),
      `${label} ${size}/day carousel card visible content is incomplete: ${JSON.stringify(child)}`);
    const expectedContentSelectors = [".kefe-car-art", ".kefe-car-local-icon", ".kefe-car-tag", ".kefe-car-cap", ".kefe-car-cap b", ".kefe-car-cap i"];
    assert.deepEqual((child.contentGeometry || []).map(item => item.selector), expectedContentSelectors,
      `${label} ${size}/day carousel fixture content geometry capture is incomplete: ${JSON.stringify(child.contentGeometry)}`);
    for (const item of child.contentGeometry) {
      assert.equal(item.nodes.length, 1, `${label} ${size}/day fixture element ${item.selector} must render exactly once: ${JSON.stringify(item)}`);
      assert.ok(item.nodes[0].bounds.length === 4 && item.nodes[0].bounds.every(Number.isFinite)
        && item.nodes[0].bounds[2] > 0 && item.nodes[0].bounds[3] > 0,
      `${label} ${size}/day fixture element ${item.selector} must have visible geometry: ${JSON.stringify(item)}`);
    }
    if (label === "current") {
      const baseline = before.keyBounds.find(node => node.id === "kefeCarStack")?.carouselChildren?.[0];
      assert.ok(baseline, `${size}/day baseline carousel card identity is missing`);
      assert.equal(child.ariaLabel, baseline.ariaLabel, `${size}/day carousel accessible identity differs between baseline and current`);
      assert.equal(child.text, baseline.text, `${size}/day carousel visible content differs between baseline and current`);
      assert.deepEqual([child.tag, child.dataIndex], [baseline.tag, baseline.dataIndex],
        `${size}/day carousel stable child identity differs between baseline and current`);
      assert.deepEqual(child.contentGeometry.map(item => item.selector), baseline.contentGeometry.map(item => item.selector),
        `${size}/day carousel fixture rendered content differs between baseline and current`);
      for (let itemIndex = 0; itemIndex < child.contentGeometry.length; itemIndex += 1) {
        const currentItem = child.contentGeometry[itemIndex];
        const baselineItem = baseline.contentGeometry[itemIndex];
        assert.equal(currentItem.nodes.length, baselineItem.nodes.length,
          `${size}/day carousel ${currentItem.selector} count differs between baseline and current`);
        for (let nodeIndex = 0; nodeIndex < currentItem.nodes.length; nodeIndex += 1) {
          const currentNode = currentItem.nodes[nodeIndex];
          const baselineNode = baselineItem.nodes[nodeIndex];
          assert.equal(currentNode.text, baselineNode.text,
            `${size}/day carousel ${currentItem.selector} content differs between baseline and current`);
          const contentGeometryDelta = currentNode.bounds.map((value, index) => Number((value - baselineNode.bounds[index]).toFixed(2)));
          // Keep descendant boxes diagnostic: baseline and native button renderers give these spans different flex allocation, while card geometry is asserted below.
          const contentGeometryComparison = { selector: currentItem.selector, baseline: baselineNode.bounds, current: currentNode.bounds, delta: contentGeometryDelta };
          console.log(`${size}/day populated carousel content geometry baseline/current: ${JSON.stringify(contentGeometryComparison)}`);
        }
      }
      const geometryDelta = child.bounds.map((value, index) => Number((value - baseline.bounds[index]).toFixed(2)));
      const geometryComparison = { baseline: baseline.bounds, current: child.bounds, delta: geometryDelta, tolerancePx: 1 };
      console.log(`${size}/day populated carousel child geometry baseline/current: ${JSON.stringify(geometryComparison)}`);
      if (!geometryDelta.every(delta => Math.abs(delta) <= geometryComparison.tolerancePx)) {
        carouselGeometryMismatches.push({ size, ...geometryComparison });
      }
    }
  }
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
        for (const field of ["x", "y", "width", "height", "childCount", "scrollTop", "scrollLeft", "scrollHeight", "clientHeight"]) {
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
    if (collection === "keyBounds") {
      const mediaChanges = changes.filter(({ oldNode, newNode }) => oldNode.section === "media" || newNode.section === "media");
      console.log(`media content geometry: ${mediaChanges.length} changed entries`);
      for (const change of mediaChanges.slice(0, 10)) {
        console.log(JSON.stringify({ key: change.key, classes: change.newNode.classes, text: change.newNode.text, children: { baseline: change.oldNode.childSummary, current: change.newNode.childSummary }, fields: change.fields,
          baseline: [change.oldNode.x, change.oldNode.y, change.oldNode.width, change.oldNode.height],
          current: [change.newNode.x, change.newNode.y, change.newNode.width, change.newNode.height] }));
      }
      const mediaFlowChanges = mediaChanges.filter(({ oldNode, newNode }) =>
        /kefe-(?:find|search|car-|media-upload-row|upload-zone|upload-title|upload-name)/.test(`${oldNode.classes} ${newNode.classes}`)
      );
      for (const change of mediaFlowChanges.slice(0, 14)) {
        console.log(`KEFE_MEDIA_FLOW_DIFF:${JSON.stringify({ key: change.key, classes: change.newNode.classes, fields: change.fields,
          baseline: [change.oldNode.x, change.oldNode.y, change.oldNode.width, change.oldNode.height],
          current: [change.newNode.x, change.newNode.y, change.newNode.width, change.newNode.height] })}`);
      }
    }
    for (const change of changes.slice(0, 8)) {
      console.log(JSON.stringify({ key: change.key, fields: change.fields,
        baseline: { bounds: [change.oldNode.x, change.oldNode.y, change.oldNode.width, change.oldNode.height], scrollTop: change.oldNode.scrollTop, scrollHeight: change.oldNode.scrollHeight, clientHeight: change.oldNode.clientHeight },
        current: { bounds: [change.newNode.x, change.newNode.y, change.newNode.width, change.newNode.height], scrollTop: change.newNode.scrollTop, scrollHeight: change.newNode.scrollHeight, clientHeight: change.newNode.clientHeight } }));
    }
  }
}
assert.deepEqual(carouselGeometryMismatches, [],
  `populated carousel card geometry differs between baseline and current by more than 1px: ${JSON.stringify(carouselGeometryMismatches)}`);
