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
assert.equal(api.get("fpsTarget"), 60, "FPS target should default to 60");
assert.equal(api.get("exportResolution"), "1080", "export resolution should default to 1080p");
const schema = api.schema();
assert.ok(schema.some((group) => group.items.some((item) => item.key === "fpsTarget" && item.type === "range")));
assert.ok(schema.some((group) => group.items.some((item) => item.key === "titleCard" && item.type === "toggle")));

let changes = 0;
api.onChange(() => { changes += 1; });
api.set("fpsTarget", 45);
assert.equal(api.get("fpsTarget"), 45);
assert.equal(JSON.parse(stored.get("kefe.settings.v1")).fpsTarget, 45, "changes should persist");
assert.ok(changes > 0, "changes should notify listeners");
api.reset();
assert.equal(api.get("fpsTarget"), 60, "reset should restore the default");
console.log("beUI settings API defaults, schema, persistence, listeners, and reset passed.");
