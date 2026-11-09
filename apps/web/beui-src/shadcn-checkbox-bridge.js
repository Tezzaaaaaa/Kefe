/* Replace the visible editor checkbox with shadcn/ui Checkbox, while retaining
   the original input for existing editor, persistence and label handlers. */
import * as React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { Checkbox } from "../components/ui/checkbox.js";

const h = React.createElement;
const mounted = new Map();
const scope = ".kefe-editor, .kefe-ms-host, body.kefe-standalone-lyrics #ui, .kft-panel:not(.kft-context-popover)";

function shouldMount(input) {
  return input instanceof HTMLInputElement && input.type === "checkbox" && input.isConnected &&
    !!input.closest(scope) && !input.hidden && input.getAttribute("aria-hidden") !== "true" &&
    !input.classList.contains("kefe-sr-only") && !mounted.has(input);
}
function accessibleName(input) {
  const label = input.getAttribute("aria-label");
  if (label) return label;
  const labels = input.labels ? [...input.labels].map(node => node.textContent.trim()).filter(Boolean) : [];
  return labels.join(" ") || input.title || input.name || input.id || "Checkbox";
}
function mount(input) {
  const originalTabindex = input.getAttribute("tabindex");
  const originalAriaHidden = input.getAttribute("aria-hidden");
  const host = document.createElement("span");
  host.className = "kefe-checkbox-host";
  input.insertAdjacentElement("afterend", host);
  input.classList.add("kefe-shad-checkbox-native");
  input.tabIndex = -1;
  input.setAttribute("aria-hidden", "true");
  const root = createRoot(host);
  let disposed = false;
  function render() {
    if (disposed) return;
    host.hidden = input.hidden;
    const labelledBy = input.getAttribute("aria-labelledby");
    root.render(h(Checkbox, {
      checked: input.indeterminate ? "indeterminate" : input.checked,
      disabled: input.disabled,
      "aria-label": labelledBy ? undefined : accessibleName(input),
      "aria-labelledby": labelledBy || undefined,
      "aria-describedby": input.getAttribute("aria-describedby") || undefined,
      onCheckedChange() {
        // Native click preserves change/input events, label behaviour, and any
        // existing code that listens to the canonical input's click event.
        if (!input.disabled) input.click();
      },
    }));
  }
  flushSync(render);
  const sync = () => render();
  const focusTrigger = () => host.querySelector('[role="checkbox"]')?.focus({ preventScroll: true });
  const overrides = [];
  for (const property of ["checked", "indeterminate"]) {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, property);
    if (descriptor?.get && descriptor?.set && !Object.prototype.hasOwnProperty.call(input, property)) {
      Object.defineProperty(input, property, { configurable: true, enumerable: descriptor.enumerable,
        get() { return descriptor.get.call(this); },
        set(value) { descriptor.set.call(this, value); sync(); },
      });
      overrides.push(property);
    }
  }
  input.addEventListener("input", sync);
  input.addEventListener("change", sync);
  input.addEventListener("focus", focusTrigger);
  const observer = new MutationObserver(sync);
  observer.observe(input, { attributes: true, attributeFilter: ["checked", "disabled", "hidden", "aria-label", "aria-labelledby", "aria-describedby"] });
  mounted.set(input, { host, destroy() {
    disposed = true;
    observer.disconnect();
    input.removeEventListener("input", sync);
    input.removeEventListener("change", sync);
    input.removeEventListener("focus", focusTrigger);
    overrides.forEach(property => delete input[property]);
    root.unmount();
    host.remove();
    input.classList.remove("kefe-shad-checkbox-native");
    if (originalTabindex === null) input.removeAttribute("tabindex"); else input.setAttribute("tabindex", originalTabindex);
    if (originalAriaHidden === null) input.removeAttribute("aria-hidden"); else input.setAttribute("aria-hidden", originalAriaHidden);
  } });
}
function scan(node) {
  if (!(node instanceof Element)) return;
  if (shouldMount(node)) mount(node);
  node.querySelectorAll('input[type="checkbox"]').forEach(input => { if (shouldMount(input)) mount(input); });
}
function start() {
  scan(document.body);
  new MutationObserver(records => {
    for (const record of records) {
      if (record.type === "attributes") {
        if (record.target instanceof HTMLInputElement) scan(record.target);
      }
      else record.addedNodes.forEach(scan);
    }
    queueMicrotask(() => {
      for (const [input, control] of mounted) {
        if (!input.isConnected || input.type !== "checkbox") { control.destroy(); mounted.delete(input); }
        else if (input.nextElementSibling !== control.host) input.insertAdjacentElement("afterend", control.host);
      }
    });
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["type", "hidden", "aria-hidden"] });
}
if (typeof window !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
}
