import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Tabs, TabsList, TabsTrigger } from "@/components/motion/tabs";
import "./legacy-bridge.css";

const PANELS = [
  ["media", "Media"],
  ["lyrics", "Lyrics"],
  ["effects", "Effects"],
  ["background-effects", "Background Effects"],
  ["visualiser", "Visualiser"],
  ["export", "Export"],
];

function SectionTabs({ backingButtons }) {
  const [active, setActive] = useState(
    document.querySelector(".kefe-section.active")?.dataset.panel || "media",
  );

  useEffect(() => {
    const sync = (event) => {
      const button = event.target?.closest?.(".kefe-section[data-panel]");
      if (button) setActive(button.dataset.panel);
    };
    document.addEventListener("click", sync);
    return () => document.removeEventListener("click", sync);
  }, []);

  function select(panel) {
    setActive(panel);
    backingButtons.get(panel)?.click();
  }

  return (
    <Tabs value={active} onValueChange={select} variant="segment" className="w-full">
      <TabsList aria-label="Editor sections" wrapperClassName="w-full" className="gap-1">
        {PANELS.map(([value, label]) => (
          <TabsTrigger
            key={value}
            value={value}
            className="min-h-9 shrink-0 px-3 text-xs"
          >
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

function start() {
  const nav = document.querySelector(".kefe-tabs");
  if (!nav || nav.dataset.beuiMounted === "true") return;
  const backingButtons = new Map();
  nav.querySelectorAll(".kefe-section[data-panel]").forEach((button) => {
    backingButtons.set(button.dataset.panel, button);
    button.classList.add("beui-native-tab");
  });
  nav.dataset.beuiMounted = "true";
  const host = document.createElement("div");
  host.className = "beui-tabs-host";
  nav.prepend(host);
  createRoot(host).render(<SectionTabs backingButtons={backingButtons} />);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}
