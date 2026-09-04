/* Verify effect UI completeness: every data-effect button must have a
 * EFFECT_LABELS entry in app.js and a registered renderer. */
'use strict';
const fs = require('fs');

const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const app = fs.readFileSync(__dirname + '/../app/app.js', 'utf8');

const buttons = [...html.matchAll(/data-effect="([^"]+)"/g)].map(m => m[1]);
const labels = [...app.matchAll(/([a-z]+): "[^"]+"/g)].map(m => m[1]);
// renderer keys: modular (window.kefeEffects) + canonical native (apple, pulse)
const registered = ['brat', 'aurora', 'eternal', 'typewriter', 'instagram', 'fadeup', 'apple', 'pulse'];

const missingLabels = buttons.filter(b => !labels.includes(b));
const missingRenders = buttons.filter(b => !registered.includes(b));

console.log('effect buttons in UI:', buttons.join(', '));
console.log('buttons missing EFFECT_LABELS entry:', missingLabels.length ? missingLabels.join(', ') : 'NONE');
console.log('buttons missing registered renderer:', missingRenders.length ? missingRenders.join(', ') : 'NONE');

process.exit(missingLabels.length || missingRenders.length ? 1 : 0);