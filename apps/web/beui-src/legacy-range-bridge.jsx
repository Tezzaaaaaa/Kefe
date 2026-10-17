import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { RangeSlider } from "@/components/motion/range-slider";
import "./legacy-bridge.css";

const EXCLUDED = "#kefeTime, .kefe-slider";
const roots = new Map();

function readInput(input) {
  const value = Number(input.value);
  return Number.isFinite(value) ? value : Number(input.min || 0);
}

function BeUIRangeBridge({ input }) {
  const [value, setValue] = useState(() => readInput(input));
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  const parsedStep = Number(input.step || 1);
  const step = Number.isFinite(parsedStep) && parsedStep > 0 ? parsedStep : 1;

  useEffect(() => {
    const sync = () => setValue(readInput(input));
    input.addEventListener("input", sync);
    input.addEventListener("change", sync);
    return () => {
      input.removeEventListener("input", sync);
      input.removeEventListener("change", sync);
    };
  }, [input]);

  function commit(next) {
    const clean = Math.min(max, Math.max(min, next));
    input.value = String(clean);
    setValue(clean);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  return (
    <RangeSlider
      value={Math.min(max, Math.max(min, value))}
      onValueChange={commit}
      min={min}
      max={max}
      step={step}
      aria-label={input.getAttribute("aria-label") || input.id || "Range control"}
      showTicks={max - min > 0 && (max - min) / step <= 30}
    />
  );
}

function mount(input) {
  if (roots.has(input) || input.matches(EXCLUDED)) return;
  if (!input.isConnected || input.type !== "range") return;

  const host = document.createElement("div");
  host.className = "beui-range-host";
  host.dataset.beuiRangeFor = input.id || input.getAttribute("aria-label") || "range";
  input.insertAdjacentElement("afterend", host);

  input.classList.add("beui-native-range");
  input.setAttribute("aria-hidden", "true");
  input.tabIndex = -1;

  const root = createRoot(host);
  roots.set(input, { root, host });
  root.render(<BeUIRangeBridge input={input} />);
}

function scan(root = document) {
  root.querySelectorAll?.('input[type="range"]').forEach(mount);
}

function syncMountedValues() {
  for (const [input, entry] of roots) {
    if (!input.isConnected) {
      entry.root.unmount();
      entry.host.remove();
      roots.delete(input);
      continue;
    }
    input.dispatchEvent(new Event("beui-sync", { bubbles: false }));
    // Trigger the bridge's native sync listener without invoking legacy input handlers.
    input.dispatchEvent(new Event("change", { bubbles: false }));
  }
}

function start() {
  scan();
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.matches?.('input[type="range"]')) mount(node);
          scan(node);
        }
      });
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  window.kefeSettings?.onChange?.(() => requestAnimationFrame(syncMountedValues));
  window.addEventListener("kefe:beui-sync-ranges", syncMountedValues);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}
