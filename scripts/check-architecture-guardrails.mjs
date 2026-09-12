#!/usr/bin/env node
/* KEFE architecture guardrails — a ratchet, not a rewrite.
 *
 * This does NOT enforce the full target architecture from
 * docs/FOUNDATION-ARCHITECTURE.md in one shot — the codebase isn't there
 * yet, and getting there safely means converting file-by-file with real
 * browser verification between steps (see that doc, section 3).
 *
 * What this script DOES do: freeze today's known trouble spots as a
 * named baseline, and fail the build the moment something NEW appears
 * that matches the same failure pattern. The goal is that the list below
 * only ever shrinks (as files get migrated per the doc) and never grows.
 *
 * Run: node scripts/check-architecture-guardrails.mjs
 */
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

const appFiles = walk(join(root, 'app')).filter(f => f.endsWith('.js'));
const cssFiles = walk(join(root, 'app')).filter(f => f.endsWith('.css'));
const rel = f => relative(root, f).split('\\').join('/');

/* ------------------------------------------------------------
   1. window.render reassignment must be guarded against
      re-installation. This is what effect-app-fx.js was missing
      (fixed alongside this script) — every other file that wraps
      window.render already does this. New render-wrapping code
      must follow the same pattern or it can silently double-apply
      itself if its script ever loads twice.
   ------------------------------------------------------------ */
const RENDER_ASSIGN = /window\.render\s*=[^=]/;
const GUARD_PATTERN = /__kefe\w*(?:Installed|Aurora)\b/;
for (const file of appFiles) {
  const src = readFileSync(file, 'utf8');
  if (RENDER_ASSIGN.test(src) && !GUARD_PATTERN.test(src)) {
    fail(
      `${rel(file)} reassigns window.render without a __kefe*Installed-style ` +
      `re-entry guard. See docs/FOUNDATION-ARCHITECTURE.md section 1.2.`
    );
  }
}

/* ------------------------------------------------------------
   2. window.state direct writes — baselined, not banned.
      These four files are grandfathered because converting them
      requires the incremental migration in the doc, verified live
      (no headless browser available in CI sandbox history to
      auto-verify render/state changes). Any FIFTH file that starts
      writing window.state.x directly fails the build — new code
      should go through window.kefe (app/core/architecture.js)
      instead of adding to the pile.
   ------------------------------------------------------------ */
const STATE_WRITE = /window\.state\.[a-zA-Z]+(\.[a-zA-Z]+)* *=[^=]/;
const STATE_WRITE_BASELINE = new Set([
  'app/effects/aurora-fx.js',
  'app/effects/effect-app-fx.js',
  'app/effects/story-fade.js',
  'app/export/ui.js',
]);
const stateWriters = new Set();
for (const file of appFiles) {
  const src = readFileSync(file, 'utf8');
  if (STATE_WRITE.test(src)) stateWriters.add(rel(file));
}
for (const file of stateWriters) {
  if (!STATE_WRITE_BASELINE.has(file)) {
    fail(
      `${file} writes window.state directly and is not in the baseline. ` +
      `Route new state writes through window.kefe instead ` +
      `(docs/FOUNDATION-ARCHITECTURE.md section 2.1), or if this is a ` +
      `deliberate baselined exception, add it to STATE_WRITE_BASELINE here ` +
      `with a comment explaining why.`
    );
  }
}
for (const file of STATE_WRITE_BASELINE) {
  if (!stateWriters.has(file)) {
    console.log(
      `[guardrail] note: ${file} no longer writes window.state directly — ` +
      `remove it from STATE_WRITE_BASELINE in this script.`
    );
  }
}

/* ------------------------------------------------------------
   3. The retired --kefe-ink/--kefe-paper/--kefe-red/--kefe-muted/
      --kefe-line/--kefe-radius color-token convention must not
      come back. (--kefe-card-index, --kefe-touch-target,
      --kefe-min-ui-size, --kefe-bg-solid-preview are unrelated
      structural custom properties and are fine.)
   ------------------------------------------------------------ */
const RETIRED_TOKENS = ['--kefe-ink', '--kefe-paper', '--kefe-red', '--kefe-muted', '--kefe-line', '--kefe-radius'];
for (const file of cssFiles) {
  const src = readFileSync(file, 'utf8');
  for (const token of RETIRED_TOKENS) {
    if (src.includes(token)) {
      fail(
        `${rel(file)} uses the retired token ${token}. Use the shared ` +
        `tokens in app/ui/styles.css (--text/--surface/--red/etc.) instead. ` +
        `See docs/FOUNDATION-ARCHITECTURE.md section 1.5.`
      );
    }
  }
}

if (failed) {
  console.error('\n[guardrail] FAILED — see messages above.');
  process.exit(1);
}
console.log('[guardrail] OK — no new architecture regressions.');
