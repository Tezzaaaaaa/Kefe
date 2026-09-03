#!/usr/bin/env node

import { execFileSync } from 'node:child_process';

const MAX_FILES = Number(process.env.KEFE_MAX_CHANGED_FILES || 20);
const MAX_LINES = Number(process.env.KEFE_MAX_CHANGED_LINES || 1000);
const ALLOW_BROAD = process.env.KEFE_ALLOW_BROAD_CHANGE === '1';

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

const staged = process.env.KEFE_GUARD_MODE === 'staged';
const range = process.env.KEFE_GUARD_BASE
  ? `${process.env.KEFE_GUARD_BASE}...HEAD`
  : 'HEAD';

const diffArgs = staged
  ? ['diff', '--cached', '--numstat', '--diff-filter=ACMR']
  : process.env.KEFE_GUARD_BASE
    ? ['diff', '--numstat', '--diff-filter=ACMR', range]
    : ['diff', '--cached', '--numstat', '--diff-filter=ACMR'];

const output = git(diffArgs);
if (!output) {
  console.log('AI change guard: no staged changes to inspect.');
  process.exit(0);
}

const rows = output.split('\n').filter(Boolean).map((line) => {
  const [added, deleted, ...pathParts] = line.split('\t');
  return {
    added: added === '-' ? 0 : Number(added),
    deleted: deleted === '-' ? 0 : Number(deleted),
    path: pathParts.join('\t')
  };
});

const files = rows.length;
const lines = rows.reduce((sum, row) => sum + row.added + row.deleted, 0);
const generatedOrLockOnly = rows.every(({ path }) =>
  /^(package-lock\.json|.*\.lock|coverage\/|dist\/|build\/)/.test(path)
);

console.log(`AI change guard: ${files} file(s), ${lines} changed line(s).`);

if (generatedOrLockOnly) {
  console.log('AI change guard: lock/build-only change; blast-radius thresholds skipped.');
  process.exit(0);
}

if (ALLOW_BROAD) {
  console.warn('AI change guard: broad-change override enabled (KEFE_ALLOW_BROAD_CHANGE=1).');
  process.exit(0);
}

const failures = [];
if (files > MAX_FILES) {
  failures.push(`changed ${files} files; limit is ${MAX_FILES}`);
}
if (lines > MAX_LINES) {
  failures.push(`changed ${lines} lines; limit is ${MAX_LINES}`);
}

if (failures.length) {
  console.error('\nAI change guard BLOCKED the change:');
  for (const failure of failures) console.error(`- ${failure}`);
  console.error('\nIf this is an intentional large change, run it explicitly with KEFE_ALLOW_BROAD_CHANGE=1.');
  process.exit(1);
}

console.log('AI change guard: blast radius is within the allowed limits.');
