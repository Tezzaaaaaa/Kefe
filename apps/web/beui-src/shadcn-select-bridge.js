/* Migrate editor panel dropdowns to shadcn/ui Select while retaining the
   original native selects as the editor's value source. */
import * as React from "react";
import { createPortal, flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select.js";

const h = React.createElement;
const mounted = new Map();
const mountedSync = new WeakMap();
let prototypeInstalled = false;

function installPrototypeBridge() {
  if (prototypeInstalled || typeof HTMLSelectElement === "undefined") return;
  prototypeInstalled = true;
  for (const property of ["value", "selectedIndex"]) {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, property);
    if (!descriptor?.get || !descriptor?.set) continue;
    Object.defineProperty(HTMLSelectElement.prototype, property, {
      configurable: true,
      enumerable: descriptor.enumerable,
      get() { return descriptor.get.call(this); },
      set(value) {
        descriptor.set.call(this, value);
        mountedSync.get(this)?.();
      },
    });
  }
}

function labelFor(select) {
  const labelledBy = select.getAttribute("aria-labelledby");
  if (labelledBy) {
    const labels = labelledBy.split(/\s+/).map(id => document.getElementById(id)?.textContent.trim()).filter(Boolean);
    if (labels.length) return labels.join(" ");
  }
  return select.getAttribute("aria-label") || select.labels?.[0]?.textContent.trim() || select.id || "Select";
}

function mount(select) {
  if (mounted.has(select) || !select.isConnected || !select.closest(".kefe-panel, body.kefe-standalone-lyrics #ui") || select.multiple ||
      select.id === "visualiserBackground" ||
      select.hidden || select.getAttribute("aria-hidden") === "true" || select.getAttribute("tabindex") === "-1") return;
  const originalTabindex = select.getAttribute("tabindex");
  const originalAriaHidden = select.getAttribute("aria-hidden");
  const wrap = document.createElement("div");
  wrap.className = "kefe-dd";
  select.replaceWith(wrap);
  wrap.append(select);
  select.classList.add("kefe-dd-native");
  select.tabIndex = -1;
  select.setAttribute("aria-hidden", "true");

  // A portal lets the trigger remain adjacent to the canonical native select.
  const reactRoot = createRoot(document.createElement("div"));
  let writing = false;
  function render() {
    wrap.hidden = select.hidden;
    const options = [...select.options].map((option, index) => ({
      index, label: option.textContent.trim(), hidden: option.hidden,
      disabled: option.disabled || (option.parentElement?.tagName === "OPTGROUP" && option.parentElement.disabled),
    })).filter(option => !option.hidden);
    const selected = options.find(option => option.index === select.selectedIndex);
    const current = selected ? `option-${selected.index}` : "";
    reactRoot.render(createPortal(h(Select, {
      value: current, disabled: select.disabled,
      onValueChange(next) {
        const index = Number(next.slice(7));
        if (!Number.isInteger(index) || !select.options[index] || select.options[index].disabled ||
            (select.options[index].parentElement?.tagName === "OPTGROUP" && select.options[index].parentElement.disabled)) return;
        writing = true;
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "selectedIndex").set.call(select, index);
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
        writing = false;
        render();
      },
    }, h(SelectTrigger, { className: "kefe-dd-trigger shad-select-trigger", "aria-label": labelFor(select) }, h(SelectValue, { placeholder: "Choose" })),
      h(SelectContent, { container: document.fullscreenElement || document.body },
        options.map(option => h(SelectItem, { value: `option-${option.index}`, key: option.index, disabled: option.disabled }, option.label || " ")))), wrap));
  }
  flushSync(render);
  installPrototypeBridge();
  const sync = () => { if (!writing) render(); };
  mountedSync.set(select, sync);
  const focusTrigger = () => select.nextElementSibling?.focus({ preventScroll: true });
  select.addEventListener("focus", focusTrigger);
  select.addEventListener("input", sync);
  select.addEventListener("change", sync);
  const observer = new MutationObserver(sync);
  observer.observe(select, { childList: true, subtree: true, attributes: true, characterData: true });
  mounted.set(select, () => {
    observer.disconnect();
    select.removeEventListener("focus", focusTrigger);
    select.removeEventListener("input", sync);
    select.removeEventListener("change", sync);
    mountedSync.delete(select);
    reactRoot.unmount();
    select.classList.remove("kefe-dd-native");
    if (originalTabindex === null) select.removeAttribute("tabindex"); else select.setAttribute("tabindex", originalTabindex);
    if (originalAriaHidden === null) select.removeAttribute("aria-hidden"); else select.setAttribute("aria-hidden", originalAriaHidden);
    if (wrap.isConnected) wrap.replaceWith(select);
  });
}

function scan(node) {
  if (!(node instanceof Element)) return;
  if (node instanceof HTMLSelectElement) mount(node);
  node.querySelectorAll("select").forEach(mount);
}
function start() {
  scan(document.body);
  new MutationObserver(records => {
    for (const record of records) {
      if (record.type === "attributes") {
        if (record.target instanceof HTMLSelectElement) scan(record.target);
      } else record.addedNodes.forEach(scan);
    }
    queueMicrotask(() => {
      for (const [select, destroy] of mounted) {
        if (!select.isConnected || select.multiple) { destroy(); mounted.delete(select); }
      }
    });
  }).observe(document.body, { childList: true, subtree: true, attributes: true,
    attributeFilter: ["multiple", "hidden", "aria-hidden", "tabindex"] });
}
if (typeof window !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
}
