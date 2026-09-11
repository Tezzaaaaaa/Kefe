/* Verify lyric-effect UI completeness against the single canonical renderer registry. */
'use strict';
const fs = require('fs');

const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const wizard = fs.readFileSync(__dirname + '/../app/ui/wizard/wizard.js', 'utf8');
const registry = fs.readFileSync(__dirname + '/../app/effects/renderer-registry.js', 'utf8');

const staticButtons = [...html.matchAll(/data-effect="([^"]+)"/g)].map(m => m[1]);
const wizardEffectsMatch = wizard.match(/const lyricEffectCopy = \{([\s\S]*?)\};/);
const wizardEffects = wizardEffectsMatch
  ? [...wizardEffectsMatch[1].matchAll(/\b([a-z]+):\s*'/g)].map(m => m[1])
  : [];
const registryMatch = registry.match(/const keys = Object\.freeze\(\[([\s\S]*?)\]\);/);
const registered = registryMatch
  ? [...registryMatch[1].matchAll(/'([a-z]+)'/g)].map(m => m[1])
  : [];

const catalogue = [...new Set([...staticButtons, ...wizardEffects])];
const missingRenders = catalogue.filter(effect => !registered.includes(effect));
const orphanRenderers = registered.filter(effect => !catalogue.includes(effect));

console.log('lyric effects in UI:', catalogue.join(', '));
console.log('renderer registry:', registered.join(', '));
console.log('UI effects missing renderer:', missingRenders.length ? missingRenders.join(', ') : 'NONE');
console.log('registry effects missing UI:', orphanRenderers.length ? orphanRenderers.join(', ') : 'NONE');

process.exit(missingRenders.length || orphanRenderers.length ? 1 : 0);
