import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/motion/select";
import "./legacy-bridge.css";

const roots = new Map();

function readSelect(input) {
  return String(input.value ?? "");
}

function BeUISelectBridge({ input }) {
  const [value, setValue] = useState(() => readSelect(input));
  const options = Array.from(input.options).map((option, index) => ({
    value: option.value,
    label: option.textContent || option.value,
    disabled: option.disabled,
    key: `${option.value}:${index}`,
  }));
  useEffect(() => {
    const sync = () => setValue(readSelect(input));
    input.addEventListener("change", sync);
    input.addEventListener("beui-sync", sync);
    return () => {
      input.removeEventListener("change", sync);
      input.removeEventListener("beui-sync", sync);
    };
  }, [input]);

  function commit(next) {
    if (input.value === next) return;
    input.value = next;
    setValue(next);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  const isAspect = input.id === "kefeAspect";
  return (
    <Select value={value} onValueChange={commit} className="w-full">
      <SelectTrigger
        aria-label={input.getAttribute("aria-label") || input.id || "Select control"}
        className={isAspect
          ? "h-[34px] w-full rounded-lg px-2 text-xs"
          : "min-h-10 w-full rounded-xl"}
      >
        <SelectValue placeholder={input.getAttribute("aria-label") || "Choose an option"} />
      </SelectTrigger>
      <SelectContent className="max-h-64 overflow-y-auto">
        {options.map((option) => (
          <SelectItem key={option.key} value={option.value} disabled={option.disabled}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function mount(input) {
  if (roots.has(input) || input.closest("#beui-settings-root")) return;
  if (!input.isConnected || input.tagName !== "SELECT") return;
  const host = document.createElement("div");
  host.className = input.id === "kefeAspect" ? "beui-select-host is-aspect" : "beui-select-host";
  host.dataset.beuiSelectFor = input.id || input.getAttribute("aria-label") || "select";
  input.insertAdjacentElement("afterend", host);
  input.classList.add("beui-native-select");
  input.setAttribute("aria-hidden", "true");
  input.tabIndex = -1;
  const root = createRoot(host);
  roots.set(input, { root, host });
  root.render(<BeUISelectBridge input={input} />);
}

function scan(root = document) {
  root.querySelectorAll?.("select").forEach(mount);
}

function syncMountedValues() {
  for (const [input, entry] of roots) {
    if (!input.isConnected) {
      entry.root.unmount();
      entry.host.remove();
      roots.delete(input);
      continue;
    }
    input.dispatchEvent(new Event("beui-sync"));
  }
}

function start() {
  scan();
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.matches?.("select")) mount(node);
          scan(node);
        }
      });
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  window.kefeSettings?.onChange?.(() => requestAnimationFrame(syncMountedValues));
  window.addEventListener("kefe:beui-sync-selects", syncMountedValues);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}
