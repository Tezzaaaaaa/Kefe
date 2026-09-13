/* Verify the visible lyric-effect UI against the single canonical renderer registry. */
'use strict';
const fs = require('fs');

const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const registry = fs.readFileSync(__dirname + '/../app/effects/renderer-registry.js', 'utf8');

const uiEffects = [...new Set([...html.matchAll(/data-effect="([^"]+)"/g)].map(m => m[1]))];
const registryMatch = registry.match(/const keys = Object\.freeze\(\[([\s\S]*?)\]\);/);
const registered = registryMatch
  ? [...registryMatch[1].matchAll(/'([a-z]+)'/g)].map(m => m[1])
  : [];

if (!registryMatch) {
  console.error('[effect-ui] Could not read the canonical renderer registry.');
  process.exit(1);
}

const missingRenders = uiEffects.filter(effect => !registered.includes(effect));
const registryOnly = registered.filter(effect => !uiEffects.includes(effect));

console.log('visible lyric effects:', uiEffects.join(', '));
console.log('canonical renderer registry:', registered.join(', '));
console.log('visible effects missing renderer:', missingRenders.length ? missingRenders.join(', ') : 'NONE');
console.log('registry-only effects:', registryOnly.length ? registryOnly.join(', ') : 'NONE');

// Registry-only effects are allowed because the guided lyric pathway can expose
// additional renderers without duplicating the static editor button list.
// Only a visible effect without a canonical renderer is a hard failure.
process.exitCode = missingRenders.length ? 1 : 0;
