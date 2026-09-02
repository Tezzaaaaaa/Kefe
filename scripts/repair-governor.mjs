import { execFileSync } from 'node:child_process';

const env = process.env;
const base = env.GITHUB_BASE_SHA || env.BASE_SHA || '';
const head = env.GITHUB_SHA || 'HEAD';
const maxFiles = Number(env.KEFE_MAX_PATCH_FILES || 15);
const maxLines = Number(env.KEFE_MAX_PATCH_LINES || 600);
const maxTouchedFilesPerRecentCommit = Number(env.KEFE_MAX_RECENT_FILE_TOUCHES || 3);
const recentCommits = Number(env.KEFE_REPAIR_HISTORY || 8);

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function fail(message) {
  console.error(`REPAIR GOVERNOR: FAIL\n${message}`);
  process.exit(1);
}

if (!base) {
  console.log('REPAIR GOVERNOR: skipped (no GITHUB_BASE_SHA/BASE_SHA provided).');
  process.exit(0);
}

let diff;
try {
  diff = git(['diff', '--numstat', `${base}...${head}`]);
} catch (error) {
  fail(`Unable to inspect the PR diff: ${error.message}`);
}

const rows = diff ? diff.split('\n').filter(Boolean).map(line => {
  const [add, del, ...pathParts] = line.split('\t');
  return { add: Number(add) || 0, del: Number(del) || 0, path: pathParts.join('\t') };
}) : [];
const changedFiles = rows.length;
const changedLines = rows.reduce((sum, row) => sum + row.add + row.del, 0);

if (changedFiles > maxFiles) {
  fail(`Patch touches ${changedFiles} files; budget is ${maxFiles}. Split the change or fix the root cause first.`);
}
if (changedLines > maxLines) {
  fail(`Patch changes ${changedLines} lines; budget is ${maxLines}. This is a patch-sprawl signal.`);
}

let commits = [];
try {
  commits = git(['log', '--format=%H', `-${recentCommits}`, `${base}..${head}`]).split('\n').filter(Boolean);
} catch {
  commits = [];
}

const touchCounts = new Map();
for (const sha of commits) {
  let files = [];
  try {
    files = git(['diff-tree', '--no-commit-id', '--name-only', '-r', sha]).split('\n').filter(Boolean);
  } catch {
    continue;
  }
  for (const file of files) touchCounts.set(file, (touchCounts.get(file) || 0) + 1);
}

const repeated = [...touchCounts.entries()]
  .filter(([, count]) => count >= maxTouchedFilesPerRecentCommit)
  .sort((a, b) => b[1] - a[1]);

if (repeated.length) {
  const detail = repeated.map(([file, count]) => `- ${file}: ${count} commits`).join('\n');
  fail(`The same files were modified repeatedly across recent repair commits. Diagnose before stacking another patch:\n${detail}`);
}

console.log('REPAIR GOVERNOR: PASS');
console.log(`- ${changedFiles} changed files / ${maxFiles} allowed`);
console.log(`- ${changedLines} changed lines / ${maxLines} allowed`);
console.log(`- no repeated-file repair pattern detected across the last ${recentCommits} commits`);
