/* Every manifest effect must have a layout spec and at least 4 layout controls. */
'use strict';
const fs = require('fs'), path = require('path');
const manifest = fs.readFileSync(path.join(__dirname, '../app/effects/manifest.js'), 'utf8');
const layout = fs.readFileSync(path.join(__dirname, '../app/effects/layout.js'), 'utf8');
const keys = [...manifest.matchAll(/\{\s*key:\s*'([^']+)'/g)].map(m => m[1]);
const controls = (layout.match(/\{ id: '/g) || []).length;
const missing = keys.filter(k => !new RegExp('\\b' + k + ':\\s*\\{ font:').test(layout));
console.log('layout controls per effect:', controls);
console.log('effects missing layout spec:', missing.length ? missing.join(', ') : 'NONE');
process.exit(missing.length || controls < 4 ? 1 : 0);
