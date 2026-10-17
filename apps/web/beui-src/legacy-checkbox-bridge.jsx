import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Checkbox } from "@/components/motion/checkbox";
import "./legacy-bridge.css";

let nextCheckboxId = 0;

function BeUICheckbox({ backing, backingLabel, host }) {
  const [checked, setChecked] = useState(backing.checked);
  const [disabled, setDisabled] = useState(backing.disabled);
  const [label, setLabel] = useState(() => backingLabel?.textContent.trim() || backing.getAttribute("aria-label") || backing.title || "Option");
  const visualId = `beui-${backing.id || `checkbox-${++nextCheckboxId}`}`;

  useEffect(() => {
    const sync = () => {
      setChecked(backing.checked);
      setDisabled(backing.disabled);
      if (backingLabel) setLabel(backingLabel.textContent.trim() || backing.getAttribute("aria-label") || backing.title || "Option");
    };
    backing.addEventListener("input", sync);
    backing.addEventListener("change", sync);
    backing.addEventListener("beui-sync", sync);
    const observer = new MutationObserver(sync);
    observer.observe(backing, { attributes: true, attributeFilter: ["disabled", "checked", "aria-label", "title"] });
    if (backingLabel) observer.observe(backingLabel, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ["hidden", "aria-label", "title"] });
    return () => {
      backing.removeEventListener("input", sync);
      backing.removeEventListener("change", sync);
      backing.removeEventListener("beui-sync", sync);
      observer.disconnect();
    };
  }, [backing, backingLabel]);

  const change = (next) => {
    backing.checked = next;
    setChecked(next);
    backing.dispatchEvent(new Event("input", { bubbles: true }));
    backing.dispatchEvent(new Event("change", { bubbles: true }));
  };

  return (
    <Checkbox
      id={visualId}
      checked={checked}
      onCheckedChange={change}
      disabled={disabled}
      label={label}
      aria-label={label}
      className={`beui-checkbox-control ${backingLabel ? [...backingLabel.classList].filter((name) => name !== "beui-native-checkbox-label").join(" ") : ""}`}
    />
  );
}

function canBridge(input) {
  return input instanceof HTMLInputElement
    && input.type === "checkbox"
    && !input.hidden
    && !input.dataset.beuiCheckboxMounted
    && !input.closest("#beui-settings-root")
    && !input.closest(".beui-checkbox-host");
}

function mount(input) {
  if (!canBridge(input)) return;
  const backingLabel = input.closest("label") || (input.id
    ? [...document.querySelectorAll("label[for]")].find((label) => label.htmlFor === input.id)
    : null);
  const host = document.createElement("div");
  host.className = "beui-checkbox-host";
  if (backingLabel) {
    backingLabel.insertAdjacentElement("beforebegin", host);
    backingLabel.classList.add("beui-native-checkbox-label");
    backingLabel.setAttribute("aria-hidden", "true");
  } else {
    input.insertAdjacentElement("beforebegin", host);
  }
  input.classList.add("beui-native-checkbox");
  input.setAttribute("aria-hidden", "true");
  input.tabIndex = -1;
  input.dataset.beuiCheckboxMounted = "true";
  createRoot(host).render(<BeUICheckbox backing={input} backingLabel={backingLabel} host={host} />);
}

function scan(root = document) {
  if (root instanceof HTMLInputElement) mount(root);
  root.querySelectorAll?.(".kefe-editor input[type=checkbox]").forEach(mount);
}

function start() {
  scan();
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) scan(node);
      });
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}
