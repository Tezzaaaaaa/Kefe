import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createServer } from "vite";

const dom = new JSDOM('<!doctype html><html><body><label for="gain">Gain</label><input id="gain" type="range" min="0" max="10" step="1" value="4"></body></html>', { url: "http://localhost/", pretendToBeVisual: true });
for (const key of ["window", "document", "HTMLElement", "HTMLInputElement", "Element", "Node", "MutationObserver", "Event", "KeyboardEvent", "getComputedStyle", "navigator"]) {
  Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
}
globalThis.CSS = { escape: value => value };
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: "custom" });
const tick = () => new Promise(resolve => setTimeout(resolve, 40));
try {
  await server.ssrLoadModule("/beui-src/shadcn-slider.js");
  if (document.readyState === "loading") document.dispatchEvent(new Event("DOMContentLoaded"));
  await tick();
  const input = document.getElementById("gain");
  let thumb = input.nextElementSibling.querySelector('[role="slider"]');
  assert.ok(thumb, "native range is bridged to a Radix slider");
  assert.equal(thumb.getAttribute("aria-label"), "Gain");
  assert.equal(thumb.getAttribute("aria-valuenow"), "4");
  let inputs = 0, changes = 0;
  input.addEventListener("input", () => inputs++);
  input.addEventListener("change", () => changes++);
  thumb.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
  await tick();
  assert.equal(input.value, "5");
  assert.equal(inputs, 1);
  assert.equal(changes, 1);
  input.value = "8";
  input.disabled = true;
  await tick();
  assert.equal(thumb.getAttribute("aria-valuenow"), "8");
  assert.equal(thumb.getAttribute("aria-disabled"), "true");
  // Moving an input and its bridge must not create a duplicate.
  const parent = document.createElement("section"); document.body.append(parent);
  parent.append(input, input.nextElementSibling);
  await tick();
  assert.equal(parent.querySelectorAll('[role="slider"]').length, 1);
  // Detached controls are cleaned up and can be mounted again later.
  input.remove();
  await tick();
  assert.equal(parent.querySelectorAll('[role="slider"]').length, 0);
  parent.append(input);
  await tick();
  thumb = input.nextElementSibling.querySelector('[role="slider"]');
  assert.ok(thumb);
  assert.equal(thumb.getAttribute("aria-valuenow"), "8");
  const timeline = document.createElement("input");
  timeline.id = "kefeTime"; timeline.type = "range"; timeline.min = "0"; timeline.max = "30"; timeline.step = ".01";
  timeline.setAttribute("aria-label", "Timeline"); timeline.setAttribute("aria-valuetext", "0:00 of 0:30");
  document.body.append(timeline); await tick();
  const timelineThumb = timeline.nextElementSibling.querySelector('[role="slider"]');
  assert.equal(timelineThumb.getAttribute("aria-valuetext"), "0:00 of 0:30");
  timeline.value = "2.5"; timeline.setAttribute("aria-valuetext", "0:02 of 0:30"); await tick();
  assert.equal(timelineThumb.getAttribute("aria-valuenow"), "2.5");
  assert.equal(timelineThumb.getAttribute("aria-valuetext"), "0:02 of 0:30");
  console.log("PASS: Radix slider bridge keyboard, timeline value text, state, move and remount behavior");
} finally {
  await server.close();
  dom.window.close();
}
