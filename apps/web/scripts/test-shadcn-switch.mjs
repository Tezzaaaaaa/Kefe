import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createServer } from "vite";
const dom = new JSDOM('<!doctype html><html><body><main class="kefe-editor"><button class="kefe-switch" role="switch" aria-label="Lyrics" aria-checked="false">Off</button><div class="shad-vis-backing-controls"><button class="kefe-switch kefe-vis-option-power" role="switch" aria-checked="false"></button></div></main></body></html>', { url: "http://localhost/", pretendToBeVisual: true });
for (const key of ["window", "document", "HTMLElement", "HTMLButtonElement", "Element", "Node", "MutationObserver", "Event", "MouseEvent", "getComputedStyle", "navigator"]) {
  Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
}
const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: "custom" });
const tick = () => new Promise(resolve => setTimeout(resolve, 60));
try {
  const native = document.querySelector('.kefe-switch:not(.kefe-vis-option-power)');
  let clicks = 0;
  native.addEventListener("click", () => { clicks++; native.setAttribute("aria-checked", String(native.getAttribute("aria-checked") !== "true")); });
  await server.ssrLoadModule("/beui-src/shadcn-switch-bridge.js");
  if (document.readyState === "loading") document.dispatchEvent(new Event("DOMContentLoaded"));
  await tick();
  let control = native.nextElementSibling.querySelector('[role="switch"]');
  assert.equal(control.getAttribute("data-slot"), "switch");
  assert.equal(control.getAttribute("aria-label"), "Lyrics");
  assert.equal(control.getAttribute("aria-checked"), "false");
  control.click(); await tick();
  assert.equal(clicks, 1); assert.equal(native.getAttribute("aria-checked"), "true");
  assert.equal(control.getAttribute("aria-checked"), "true");
  native.setAttribute("aria-checked", "false"); native.setAttribute("aria-label", "New label"); await tick();
  assert.equal(control.getAttribute("aria-checked"), "false"); assert.equal(control.getAttribute("aria-label"), "New label");
  native.disabled = true; await tick(); assert.ok(control.disabled);
  native.disabled = false; native.hidden = true; await tick(); assert.ok(native.nextElementSibling.hidden);
  native.hidden = false; await tick(); native.focus(); assert.equal(document.activeElement, control);
  const hiddenPower = document.querySelector('.kefe-vis-option-power');
  assert.equal(hiddenPower.nextElementSibling, null, "engine backing switches are not mounted");
  const parent = document.createElement('section'); document.querySelector('.kefe-editor').append(parent);
  parent.append(native); await tick();
  assert.ok(native.nextElementSibling?.classList.contains('kefe-switch-host'), "switch host follows moved backing button");
  native.remove(); await tick();
  parent.append(native); await tick();
  control = native.nextElementSibling.querySelector('[role="switch"]');
  assert.equal(control.getAttribute("aria-checked"), "false");
  console.log("PASS: shadcn switch state, original click handlers, disabled state, moves and remounts");
} finally { await server.close(); dom.window.close(); }
