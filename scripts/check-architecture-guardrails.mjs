import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
let failed = false;

function fail(message) {
  failed = true;
  console.error(`[guardrail] ${message}`);
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git') continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const appFiles = walk(join(root, 'app')).filter((file) => file.endsWith('.js'));
const cssFiles = walk(join(root, 'app')).filter((file) => file.endsWith('.css'));
const rel = (file) => relative(root, file).split('\\').join('/');

// A render wrapper must be installed at most once. This prevents repeated module
// evaluation from stacking wrappers around the same renderer.
const renderAssignment = /window\.render\s*=[^=]/;
const renderGuard = /__kefeVisualFxInstalled\b/;
for (const file of appFiles) {
  const source = readFileSync(file, 'utf8');
  if (renderAssignment.test(source) && !renderGuard.test(source)) {
    fail(`${rel(file)} reassigns window.render without a re-entry guard.`);
  }
}

// These tokens were retired from the product-polish stylesheet. Keep them out of
// the tree rather than allowing a second, competing design-token system to return.
const retiredTokens = /--kefe-(?:ink|paper|red|muted|line|radius)\b/;
for (const file of cssFiles) {
  const source = readFileSync(file, 'utf8');
  if (retiredTokens.test(source)) {
    fail(`${rel(file)} contains retired --kefe-* design tokens.`);
  }
}

if (failed) process.exitCode = 1;
else console.log('[guardrail] architecture checks passed');
