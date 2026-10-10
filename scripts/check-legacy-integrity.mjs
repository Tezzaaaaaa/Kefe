#!/usr/bin/env node
/**
 * Read-only integrity checks for KEFE's static legacy editor.
 * This deliberately checks wiring without changing runtime behaviour.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const legacyRoot = path.join(repoRoot, 'artifacts/kefe-visualiser/public/legacy');
const indexPath = path.join(legacyRoot, 'index.html');
const failures = [];

function fail(message) {
  failures.push(message);
}

if (!existsSync(indexPath)) {
  console.error('FAIL: legacy index.html is missing:', path.relative(repoRoot, indexPath));
  process.exit(1);
}

const html = readFileSync(indexPath, 'utf8');
const scriptTags = [...html.matchAll(/<script\b([^>]*)>/gi)];
const localScripts = [];

for (const [, attributes] of scriptTags) {
  const src = attributes.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
  if (!src || /^(?:[a-z]+:|\/\/|#|data:)/i.test(src)) continue;
  if (!src.startsWith('./') && !src.startsWith('../')) continue;

  const cleanSrc = decodeURIComponent(src.split(/[?#]/, 1)[0]);
  const target = path.resolve(legacyRoot, cleanSrc);
  if (!target.startsWith(legacyRoot + path.sep)) {
    fail(`Script escapes the legacy app directory: ${src}`);
    continue;
  }
  if (!existsSync(target)) fail(`Script referenced by index.html is missing: ${src}`);
  localScripts.push(src);
}

const seenScripts = new Set();
for (const src of localScripts) {
  if (seenScripts.has(src)) fail(`Script is loaded more than once: ${src}`);
  seenScripts.add(src);
}

const requiredOrder = [
  './app/effects/manifest.js',
  './app/effects/core.js',
  './app/lyrics/lyric-model.js',
  './app/editor.js',
  './app/visualiser/background.js',
  './app/visualiser/audio-overlay.js',
  './app/visualiser/gradient.js',
  './app/visualiser/fluted-glass.js',
  './app/visualiser/visualiser.js',
];
const positions = requiredOrder.map(src => localScripts.indexOf(src));
for (let i = 0; i < requiredOrder.length; i++) {
  if (positions[i] === -1) fail(`Required script is not loaded by index.html: ${requiredOrder[i]}`);
  if (i > 0 && positions[i - 1] !== -1 && positions[i] !== -1 && positions[i] <= positions[i - 1]) {
    fail(`Script load order changed unexpectedly: ${requiredOrder[i - 1]} must load before ${requiredOrder[i]}`);
  }
}

// Check local stylesheets and icon paths too; broken links can silently damage the UI.
for (const [, attributes] of html.matchAll(/<link\b([^>]*)>/gi)) {
  const href = attributes.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
  if (!href || /^(?:[a-z]+:|\/\/|#|data:)/i.test(href)) continue;
  if (!href.startsWith('./') && !href.startsWith('../')) continue;

  const cleanHref = decodeURIComponent(href.split(/[?#]/, 1)[0]);
  const target = path.resolve(legacyRoot, cleanHref);
  if (!target.startsWith(legacyRoot + path.sep)) {
    fail(`Local link escapes the legacy app directory: ${href}`);
  } else if (!existsSync(target)) {
    fail(`Local asset referenced by index.html is missing: ${href}`);
  }
}

if (failures.length) {
  console.error('KEFE legacy integrity check failed:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log(`KEFE legacy integrity check passed (${localScripts.length} local scripts checked; load order verified).`);
