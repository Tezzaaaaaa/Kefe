/* Verify the production lyric-effect catalogue has a renderer for every entry. */
'use strict';
const fs = require('fs');
const path = require('path');

const manifest = fs.readFileSync(__dirname + '/../app/effects/manifest.js', 'utf8');
const app = fs.readFileSync(__dirname + '/../app/app.js', 'utf8');
const effectsDir = path.join(__dirname, '../app/effects');

const manifestEntries = [...manifest.matchAll(/\{\s*key:\s*'([^']+)'/g)].map(m => m[1]);
const effectSources = fs.readdirSync(effectsDir)
  .filter(name => name.endsWith('.js'))
  .map(name => fs.readFileSync(path.join(effectsDir, name), 'utf8'))
  .join('\n');

// Apple and Pulse are canonical native renderers in app.js. Modular renderers
// register themselves on window.kefeEffects.<key>.
const canonical = new Set(['apple', 'pulse']);
const modular = new Set(
  [...effectSources.matchAll(/window\.kefeEffects\.([a-z][a-z0-9_]*)\s*=/g)].map(m => m[1])
);
const registered = new Set([...canonical, ...modular]);

const duplicateKeys = manifestEntries.filter((key, i) => manifestEntries.indexOf(key) !== i);
const missingRenderers = manifestEntries.filter(key => !registered.has(key));

console.log('production lyric effects:', manifestEntries.join(', '));
console.log('duplicate manifest keys:', duplicateKeys.length ? duplicateKeys.join(', ') : 'NONE');
console.log('manifest entries missing renderer:', missingRenderers.length ? missingRenderers.join(', ') : 'NONE');

process.exit(duplicateKeys.length || missingRenderers.length ? 1 : 0);
