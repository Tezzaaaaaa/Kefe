import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Tabs, TabsList, TabsTrigger } from "@/components/motion/tabs";
import "./legacy-bridge.css";

function VisualiserTabs({ backingButtons }) {
  const [active, setActive] = useState(
    [...backingButtons.values()].find((button) => button.getAttribute("aria-selected") === "true")?.dataset.visualiser
      || backingButtons.keys().next().value
      || "",
  );

  useEffect(() => {
    const sync = (event) => {
      const button = event.target?.closest?.(".kefe-vis-tabs button[data-visualiser]");
      if (button && backingButtons.has(button.dataset.visualiser)) {
        setActive(button.dataset.visualiser);
      }
    };
    document.addEventListener("click", sync);
    return () => document.removeEventListener("click", sync);
  }, [backingButtons]);

  function select(value) {
    backingButtons.get(value)?.click();
  }

  return (
    <Tabs value={active} onValueChange={select} variant="segment" className="w-full min-w-0">
      <TabsList aria-label="Choose visualiser" wrapperClassName="w-full" className="flex-wrap gap-1">
        {[...backingButtons.entries()].map(([value, backing]) => {
          const icon = backing.querySelector(".kefe-visualiser-tab-icon")?.textContent || backing.dataset.icon || "";
          const label = backing.querySelector(".kefe-visualiser-tab-label")?.textContent
            || backing.getAttribute("aria-label")
            || backing.title
            || value;
          return (
            <TabsTrigger key={value} value={value} className="min-h-9 shrink-0 gap-2 px-3 text-xs">
              {icon ? <span aria-hidden="true" className="text-sm">{icon}</span> : null}
              <span>{label}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}

function start() {
  const nav = document.querySelector(".kefe-vis-tabs");
  if (!nav || nav.dataset.beuiMounted === "true") return;

  const backingButtons = new Map();
  nav.querySelectorAll('button[role="tab"][data-visualiser]').forEach((button) => {
    backingButtons.set(button.dataset.visualiser, button);
    button.classList.add("beui-native-vis-tab");
  });
  if (!backingButtons.size) return;

  nav.dataset.beuiMounted = "true";
  const host = document.createElement("div");
  host.className = "beui-vis-tabs-host";
  nav.prepend(host);
  createRoot(host).render(<VisualiserTabs backingButtons={backingButtons} />);
}

// The legacy visualiser modules create their tabs during DOMContentLoaded.
// Mount after those initialisers so every existing visualiser is represented.
window.addEventListener("load", start, { once: true });
document.addEventListener("click", (event) => {
  if (event.target?.closest?.('[data-shell-panel="visualiser"], .kefe-section[data-panel="visualiser"]')) {
    window.setTimeout(start, 0);
  }
});
if (document.readyState === "complete") start();
