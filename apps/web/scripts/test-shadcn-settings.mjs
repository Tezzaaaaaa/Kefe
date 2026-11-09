import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createServer } from "vite";

const dom = new JSDOM('<!doctype html><html><body><button data-top-panel="settings">Settings</button></body></html>', { url: "http://localhost/", pretendToBeVisual: true });
for (const key of ["window", "document", "HTMLElement", "HTMLInputElement", "HTMLSelectElement", "Element", "Node", "NodeFilter", "DocumentFragment", "MutationObserver", "Event", "KeyboardEvent", "MouseEvent", "CustomEvent", "getComputedStyle", "navigator"]) {
  Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
}
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
dom.window.HTMLElement.prototype.scrollIntoView = function () {};
const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: "custom" });
const tick = () => new Promise(resolve => setTimeout(resolve, 80));
async function waitForFocus(element) {
  const deadline = Date.now() + 2000;
  while (document.activeElement !== element && Date.now() < deadline) await tick();
}
try {
  await server.ssrLoadModule("/app/settings.beui.js");
  await server.ssrLoadModule("/beui-src/shadcn-settings-dialog.js");
  if (document.readyState === "loading") document.dispatchEvent(new Event("DOMContentLoaded"));
  await tick();
  const opener = document.querySelector('[data-top-panel="settings"]');
  opener.focus(); opener.click(); await tick();
  const dialog = document.querySelector('[role="dialog"]');
  assert.ok(dialog, "settings dialog opens");
  assert.equal(dialog.getAttribute("data-slot"), "dialog-content");
  assert.equal(document.querySelector('.beui-settings-root').hidden, false);
  assert.equal(dialog.querySelectorAll('[data-slot="accordion-trigger"]').length, 3);
  assert.equal(dialog.querySelectorAll('button[aria-controls$="-content"]').length, 3);
  const toggle = dialog.querySelector('[role="switch"]');
  assert.ok(toggle, "initial title card group has a Radix switch");
  assert.equal(window.kefeSettings.get("titleCard"), true);
  toggle.click(); await tick();
  assert.equal(window.kefeSettings.get("titleCard"), false);
  assert.equal(toggle.getAttribute("aria-checked"), "false");
  dialog.querySelector('#kefe-settings-engine-trigger').click(); await tick();
  const slider = dialog.querySelector('[role="slider"][aria-label="FPS target"]');
  assert.ok(slider, "engine group has a Radix slider");
  slider.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })); await tick();
  assert.equal(window.kefeSettings.get("fpsTarget"), 70);
  window.kefeSettings.set("fpsTarget", 90); await tick();
  assert.equal(slider.getAttribute("aria-valuenow"), "90");
  dialog.querySelector('#kefe-settings-defaults-trigger').click(); await tick();
  const select = dialog.querySelector('[data-slot="select-trigger"][aria-label="Aspect ratio"]');
  assert.ok(select, "defaults has a Radix select");
  select.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true })); await tick();
  const options = dialog.querySelectorAll('[role="option"]');
  assert.ok(options.length >= 3, "select opens options inside the dialog");
  options[1].click(); await tick();
  assert.equal(window.kefeSettings.get("aspect"), "9:16");
  [...dialog.querySelectorAll('button')].find(b => b.textContent === "Reset to defaults").click(); await tick();
  assert.equal(window.kefeSettings.get("titleCard"), true);
  assert.equal(window.kefeSettings.get("fpsTarget"), 60);
  assert.equal(window.kefeSettings.get("aspect"), "16:9");
  [...dialog.querySelectorAll('button')].find(b => b.textContent === "Done").click(); await tick();
  assert.equal(document.querySelector('[role="dialog"]'), null);
  assert.equal(document.querySelector('.beui-settings-root').hidden, true);
  await waitForFocus(opener);
  assert.equal(document.activeElement, opener);
  opener.click(); await tick();
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await tick();
  assert.equal(document.querySelector('[role="dialog"]'), null, "Escape closes the modal");
  await waitForFocus(opener);
  assert.equal(document.activeElement, opener, "Escape returns focus to its opener");
  console.log("PASS: settings dialog, accordion, slider, switch, select, reset, Escape and focus restoration");
} finally {
  await server.close();
  dom.window.close();
}
