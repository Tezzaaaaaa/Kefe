'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function loadEngine() {
  const window = {};
  const dir = __dirname;
  vm.runInNewContext(fs.readFileSync(path.join(dir, 'trailer-stroke-data.js'), 'utf8'), { window });
  vm.runInNewContext(fs.readFileSync(path.join(dir, 'trailer-stroke-engine.js'), 'utf8'), { window });
  return window;
}
function context() {
  const calls = { segments: [], fills: 0 };
  const ctx = {
    save(){}, restore(){}, translate(){}, scale(){}, beginPath(){}, moveTo(x,y){this.last=[x,y];},
    lineTo(x,y){calls.segments.push([this.last&&this.last[0],this.last&&this.last[1],x,y]);this.last=[x,y];},
    stroke(){}, fill(){calls.fills++;}, arc(){},
    set lineCap(v){}, set lineJoin(v){}, set strokeStyle(v){}, set fillStyle(v){},
    set lineWidth(v){}, set shadowBlur(v){}, set shadowColor(v){}, set globalAlpha(v){}
  };
  return { ctx, calls };
}

test('bundled glyph data covers printable ASCII letters, digits and punctuation', () => {
  const w = loadEngine();
  const missing = [];
  for (let n = 33; n <= 126; n++) {
    const ch = String.fromCharCode(n);
    if (!w.KEFETrailerStrokeEngine.hasGlyph(ch)) missing.push(ch);
  }
  assert.deepEqual(missing, ['[', ']', '{', '}']);
});

test('stroke progress is deterministic for the same glyph and time', () => {
  const w = loadEngine(), a = context(), b = context();
  w.KEFETrailerStrokeEngine.draw(a.ctx, 'S', 10, 100, 76, 0.63, 'ink');
  w.KEFETrailerStrokeEngine.draw(b.ctx, 'S', 10, 100, 76, 0.63, 'ink');
  assert.deepEqual(a.calls.segments, b.calls.segments);
});

test('increasing progress reveals a non-decreasing number of path segments', () => {
  const w = loadEngine(), counts = [0, .1, .25, .5, .75, 1].map(p => {
    const c = context();
    w.KEFETrailerStrokeEngine.draw(c.ctx, 'S', 0, 100, 76, p, 'ink');
    return c.calls.segments.length;
  });
  assert.ok(counts[0] === 0);
  for (let i = 1; i < counts.length; i++) assert.ok(counts[i] >= counts[i-1], counts.join(', '));
  assert.ok(counts[counts.length - 1] > 0);
});

test('the same centreline geometry can drive ink and condensation mask', () => {
  const w = loadEngine(), ink = context(), mask = context();
  assert.equal(w.KEFETrailerStrokeEngine.draw(ink.ctx, 'a', 0, 100, 76, .7, 'ink'), true);
  assert.equal(w.KEFETrailerStrokeEngine.draw(mask.ctx, 'a', 0, 100, 76, .7, 'mask'), true);
  assert.deepEqual(ink.calls.segments, mask.calls.segments);
});

test('unknown glyphs fail safely instead of throwing', () => {
  const w = loadEngine(), c = context();
  assert.equal(w.KEFETrailerStrokeEngine.draw(c.ctx, '漢', 0, 100, 76, .5, 'ink'), false);
});
