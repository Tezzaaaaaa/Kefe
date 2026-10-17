import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const css = readFileSync('apps/web/app/ui/styles.css', 'utf8');
const html = readFileSync('apps/web/editor.html', 'utf8');
const visualiserShell = readFileSync('apps/web/app/visualiser/gradient.js', 'utf8');

function rulesFor(selector) {
  const rules = [];
  const pattern = /([^{}]+)\{([^{}]*)\}/g;
  for (const match of css.matchAll(pattern)) {
    const selectors = match[1].trim().split(',').map(value => value.trim());
    if (selectors.includes(selector)) rules.push(match[2]);
  }
  return rules;
}

function lastDisplay(selector, expected, reason) {
  const rules = rulesFor(selector);
  assert.ok(rules.length > 0, `Missing CSS rule: ${selector}`);
  const displayDeclarations = rules.flatMap(rule =>
    [...rule.matchAll(/(?:^|;)\s*display\s*:\s*([^;!}]+)/g)].map(match => match[1].trim())
  );
  assert.equal(
    displayDeclarations.at(-1),
    expected,
    `${reason}: last display declaration for ${selector} must be ${expected}`
  );
}

lastDisplay(
  '.kefe-editing > .kefe-vis-tabs',
  'none',
  'Visualiser tabs must be hidden outside the Visualiser panel'
);
lastDisplay(
  '.kefe-editing > .kefe-visualiser-preset-row',
  'none',
  'Visualiser preset row must be hidden outside the Visualiser panel'
);

assert.match(
  css,
  /\.kefe-editing:has\(\.kefe-panel\[data-panel-view="visualiser"\]\.active\)\s*>\s*\.kefe-vis-tabs\s*\{[^}]*display\s*:\s*flex/s,
  'Visualiser tabs must be shown when the Visualiser panel is active'
);
assert.match(
  css,
  /\.kefe-editing:has\(\.kefe-panel\[data-panel-view="visualiser"\]\.active\)\s*>\s*\.kefe-visualiser-preset-row:not\(\[hidden\]\)\s*\{[^}]*display\s*:\s*flex/s,
  'Preset row must be shown when the Visualiser panel is active'
);
assert.match(html, /app\/ui\/styles\.css\?v=[^"]+/, 'Editor must load the versioned main stylesheet');
assert.match(visualiserShell, /editing\.insertBefore\(tabs, panels\)/, 'Visualiser tabs must remain in the shared editor shell');
assert.match(visualiserShell, /editing\.insertBefore\(presetRow, panels\)/, 'Visualiser presets must remain in the shared editor shell');

console.log('KEFE architecture guards passed.');
