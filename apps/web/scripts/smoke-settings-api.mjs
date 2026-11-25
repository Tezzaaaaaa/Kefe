import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(resolve(root, "app/settings.beui.js"), "utf8");
const stored = new Map();
const sandbox = {
  window: {},
  localStorage: {
    getItem(key) { return stored.has(key) ? stored.get(key) : null; },
    setItem(key, value) { stored.set(key, value); },
  },
  console: { warn() {} },
};
runInNewContext(source, sandbox);

const api = sandbox.window.kefeSettings;
assert.ok(api, "settings API should initialise");
assert.equal(api.get("fpsTarget"), undefined, "there is no user-facing FPS cap on rendered visuals");
assert.equal(api.get("exportResolution"), "1080", "export resolution should default to 1080p");
const schema = api.schema();
assert.ok(!schema.some((group) => group.items.some((item) => item.key === "fpsTarget")), "settings must not expose an FPS cap");
assert.ok(schema.some((group) => group.items.some((item) => item.key === "fftPower" && item.type === "range")));
assert.ok(schema.some((group) => group.items.some((item) => item.key === "titleCard" && item.type === "toggle")));

let changes = 0;
api.onChange(() => { changes += 1; });
api.set("fftPower", 12);
assert.equal(api.get("fftPower"), 12);
assert.equal(JSON.parse(stored.get("kefe.settings.v1")).fftPower, 12, "changes should persist");
assert.ok(changes > 0, "changes should notify listeners");
api.reset();
assert.equal(api.get("fftPower"), 11, "reset should restore the audio-analysis default");
console.log("beUI settings API defaults, schema, persistence, listeners, and reset passed.");
