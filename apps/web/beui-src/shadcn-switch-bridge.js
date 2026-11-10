/* Expose shadcn/ui Switch for editor toggles while their original buttons keep
   owning the editor and visualiser state. Visualiser engine backing controls
   remain hidden behind the gallery and are deliberately not upgraded. */
import * as React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { Switch } from "../components/ui/switch.js";

const h = React.createElement;
const mounted = new Map();
const selector = 'button.kefe-switch[role="switch"], button.kv-power-switch[role="switch"]';

function shouldMount(button) {
  return button instanceof HTMLButtonElement && button.isConnected && button.matches(selector) &&
    !button.classList.contains("kefe-vis-option-power") && !button.closest(".shad-vis-backing-controls") &&
    button.getAttribute("aria-hidden") !== "true" && !mounted.has(button);
}
function mount(button) {
  const originalTabindex = button.getAttribute("tabindex");
  const originalAriaHidden = button.getAttribute("aria-hidden");
  const host = document.createElement("span");
  host.className = "kefe-switch-host";
  button.insertAdjacentElement("afterend", host);
  button.classList.add("kefe-shad-switch-native");
  button.tabIndex = -1;
  button.setAttribute("aria-hidden", "true");
  const root = createRoot(host);
  let disposed = false;
  function render() {
    if (disposed) return;
    host.hidden = button.hidden;
    const labelledBy = button.getAttribute("aria-labelledby");
    root.render(h(Switch, {
      checked: button.getAttribute("aria-checked") === "true", disabled: button.disabled,
      "aria-label": labelledBy ? undefined : (button.getAttribute("aria-label") || button.title || "Switch"),
      "aria-labelledby": labelledBy || undefined,
      "aria-describedby": button.getAttribute("aria-describedby") || undefined,
      onCheckedChange() { if (!button.disabled) button.click(); },
    }));
  }
  flushSync(render);
  const sync = () => render();
  const focusTrigger = () => host.querySelector('[role="switch"]')?.focus({ preventScroll: true });
  button.addEventListener("focus", focusTrigger);
  const observer = new MutationObserver(sync);
  observer.observe(button, { attributes: true, attributeFilter: ["aria-checked", "disabled", "hidden", "aria-label", "aria-labelledby", "aria-describedby", "title"] });
  mounted.set(button, { host, destroy() {
    disposed = true;
    observer.disconnect();
    button.removeEventListener("focus", focusTrigger);
    root.unmount();
    host.remove();
    button.classList.remove("kefe-shad-switch-native");
    if (originalTabindex === null) button.removeAttribute("tabindex"); else button.setAttribute("tabindex", originalTabindex);
    if (originalAriaHidden === null) button.removeAttribute("aria-hidden"); else button.setAttribute("aria-hidden", originalAriaHidden);
  } });
}
function scan(node) {
  if (!(node instanceof Element)) return;
  if (shouldMount(node)) mount(node);
  node.querySelectorAll(selector).forEach(button => { if (shouldMount(button)) mount(button); });
}
function start() {
  scan(document.body);
  new MutationObserver(records => {
    for (const record of records) {
      if (record.type === "attributes") {
        if (record.target instanceof HTMLButtonElement) scan(record.target);
      } else record.addedNodes.forEach(scan);
    }
    queueMicrotask(() => {
      for (const [button, control] of mounted) {
        if (!button.isConnected || !button.matches(selector) || button.closest(".shad-vis-backing-controls")) {
          control.destroy(); mounted.delete(button);
        } else if (button.nextElementSibling !== control.host) button.insertAdjacentElement("afterend", control.host);
      }
    });
  }).observe(document.body, { childList: true, subtree: true, attributes: true,
    attributeFilter: ["role", "hidden", "aria-hidden"] });
}
if (typeof window !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
}
